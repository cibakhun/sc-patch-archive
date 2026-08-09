/* ============================================================
   run-gate.mjs — fuehrt aus, was scripts/lib/gate-registry.mjs sagt.

   `npm run gate`       Schiene A (Auslieferung) — auch die Zeile im Dockerfile
   `npm run gate:data`  Schiene B (Datenlauf, lokal nach jedem Datamine- oder
                        Sync-Lauf)

   WARUM ueber ein Verzeichnis statt als &&-Kette in package.json: eine
   handgepflegte Kette ist eine zweite Wahrheit neben dem Verzeichnis, und
   zwei Wahrheiten laufen auseinander. Hier gibt es nur eine — was im
   Verzeichnis steht, laeuft; was nicht drinsteht, laeuft nicht, und
   verify-wiring reisst, sobald ein Skript ohne Eintrag existiert.

   Der Aufruf geht bewusst NICHT ueber `npm run <name>` je Strecke: das
   waeren 16 zusaetzliche npm-Starts (~0,4 s pro Stueck). Stattdessen wird
   der Befehlstext aus package.json aufgeloest und direkt ausgefuehrt —
   inklusive der `pre*`-Haken, die npm sonst selbst faehrt (pretest:e2e
   erklaert einen fehlenden Build, statt an ENOENT zu sterben). Die Haken
   stehen als eigene Schritte im Plan, damit nichts unsichtbar mitlaeuft.

   Schalter:
     --rail A|B|C   Schiene (Vorgabe A)
     --only <id>    nur diese Strecke (mehrfach erlaubt) — zur Diagnose
     --list         Plan zeigen, nichts ausfuehren
     --continue     bei Fehlschlag weiterlaufen und am Ende alles melden

       node scripts/run-gate.mjs [--rail B] [--only verify:fx] [--list]
   ============================================================ */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKS, plan, disabled } from './lib/gate-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));

const argv = process.argv.slice(2);
const flagValues = (name) =>
  argv.reduce((acc, a, i) => (a === name && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);
const RAIL = (flagValues('--rail')[0] || 'A').toUpperCase();
const ONLY = flagValues('--only');
const LIST = argv.includes('--list');
const KEEP_GOING = argv.includes('--continue');

const RAIL_NAME = { A: 'Auslieferung', B: 'Datenlauf', C: 'Deploy' };

/* ---------- Plan aufstellen ---------- */
let strecken = plan(RAIL);
if (ONLY.length) {
  const byId = new Map(CHECKS.map((c) => [c.id, c]));
  const unbekannt = ONLY.filter((id) => !byId.has(id));
  if (unbekannt.length) {
    console.error(`Unbekannte Strecke(n): ${unbekannt.join(', ')}`);
    console.error(`Bekannt sind: ${CHECKS.map((c) => c.id).join(', ')}`);
    process.exit(2);
  }
  strecken = ONLY.map((id) => byId.get(id));
}

// Jede Strecke in ihre Schritte aufloesen: erst der pre*-Haken (falls es
// einen gibt), dann der Befehl selbst. Beides sichtbar im Plan.
const schritte = [];
for (const c of strecken) {
  if (!c.npm) {
    console.error(`Strecke "${c.id}" hat kein npm-Skript und kann nicht ausgefuehrt werden.`);
    process.exit(2);
  }
  const cmd = pkg.scripts?.[c.npm];
  if (!cmd) {
    console.error(`package.json kennt kein Skript "${c.npm}" (Strecke ${c.id}).`);
    process.exit(2);
  }
  const pre = pkg.scripts?.[`pre${c.npm}`];
  if (pre) schritte.push({ label: `pre${c.npm}`, cmd: pre, hook: true });
  schritte.push({ label: c.id, cmd });
}

/* ---------- Kopf ---------- */
const titel = ONLY.length
  ? `npm run gate — nur ${ONLY.join(', ')}`
  : `npm run gate — Schiene ${RAIL} (${RAIL_NAME[RAIL] ?? '?'})`;
console.log(`\n=== ${titel} ===`);
console.log(`${strecken.length} Strecke(n), ${schritte.length} Schritt(e)\n`);

if (LIST) {
  for (const [i, s] of schritte.entries())
    console.log(`${String(i + 1).padStart(2)}. ${s.label.padEnd(22)} ${s.cmd}${s.hook ? '   (Haken)' : ''}`);
  meldeSchulden();
  process.exit(0);
}

/* ---------- Ausfuehren ---------- */
const t0 = Date.now();
const ergebnisse = [];
let ersterFehler = 0;

for (const [i, s] of schritte.entries()) {
  const nr = `${String(i + 1).padStart(2)}/${schritte.length}`;
  console.log(`\n──────── ${nr}  ${s.label} ────────`);
  const t = Date.now();
  const r = spawnSync(s.cmd, { cwd: ROOT, shell: true, stdio: 'inherit' });
  const sek = (Date.now() - t) / 1000;
  const code = r.status ?? (r.error ? 1 : 0);
  if (r.error) console.error(`  Start fehlgeschlagen: ${r.error.message}`);
  ergebnisse.push({ label: s.label, code, sek });
  if (code !== 0) {
    if (!ersterFehler) ersterFehler = code;
    if (!KEEP_GOING) {
      console.error(`\n✗ ${s.label} fehlgeschlagen (Exit ${code}) — Kette abgebrochen.`);
      break;
    }
    console.error(`\n✗ ${s.label} fehlgeschlagen (Exit ${code}) — weiter wegen --continue.`);
  }
}

/* ---------- Selbstauskunft ---------- */
// Ohne die Zahl "wie viele Strecken sind wirklich gelaufen" ist eine leer
// laufende Kette von einer echten nicht zu unterscheiden — beide melden
// gruen. Dieselbe Regel wie in verify-weapon-sizes.mjs.
console.log(`\n\n=== Bilanz Schiene ${RAIL} ===`);
for (const e of ergebnisse)
  console.log(`  ${e.code === 0 ? '✓' : '✗'} ${e.label.padEnd(22)} ${e.sek.toFixed(1).padStart(6)}s`);
const gelaufen = ergebnisse.filter((e) => e.code === 0).length;
console.log(
  `\n  ${gelaufen} von ${schritte.length} Schritten gruen · ` +
    `Gesamtzeit ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
meldeSchulden();

if (ersterFehler) {
  console.error(`\n✗ Tor ROT — Schiene ${RAIL} nicht bestanden.\n`);
  process.exit(ersterFehler);
}
if (ergebnisse.length !== schritte.length) {
  console.error('\n✗ Tor ROT — nicht alle Schritte ausgefuehrt.\n');
  process.exit(1);
}
console.log(`\n✓ Tor GRUEN — Schiene ${RAIL} vollstaendig bestanden.\n`);

/** Ausgesetzte Strecken bei JEDEM Lauf melden — ein stillgelegtes Tor,
 *  an das sich niemand erinnert, ist schlimmer als gar keins. */
function meldeSchulden() {
  const aus = disabled().filter((c) => c.rail === RAIL);
  if (!aus.length) return;
  console.log(`\n  ⚠ Ausgesetzt auf dieser Schiene (${aus.length}) — Schuldenposten:`);
  for (const c of aus) console.log(`    · ${c.id}: ${c.disabled}`);
}
