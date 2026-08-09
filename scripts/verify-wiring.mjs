/* ============================================================
   verify-wiring.mjs — der Waechter ueber die Waechter.

   Pruefverfahren gegen den QUELLBESTAND (nicht gegen dist/): es geht um
   die Verkabelung selbst, nicht um das gebaute Ergebnis. Laeuft als
   erste Strecke in `npm run gate` und braucht deshalb keinen Build.

   WARUM ES DEN GIBT: Ein Pruefskript, das an keinem Tor haengt, meldet
   nie etwas — und niemand merkt es. Am 09.08.2026 lagen neun solche
   Skripte im Bestand; ein Messlauf fand zwei davon ROT, ohne dass es
   jemand wusste. Ab jetzt ist "liegt lose herum" selbst ein roter
   Befund. Konzept: docs/maschinelle-validierung.md, Baustein B3.

   Sechs Zusicherungen, jede mit Soll/Ist-Zeile:

     1  Bijektion: jede Datei scripts/verify-*.mjs bzw. audit-*.mjs hat
        genau einen Eintrag im Verzeichnis — und jeder Eintrag zeigt auf
        eine Datei, die es gibt. Beide Richtungen, sonst faellt entweder
        ein neues Skript durchs Raster oder das Verzeichnis nennt eine
        Leiche.
     2  Auflösbarkeit: jedes `npm`-Feld im Verzeichnis existiert in
        package.json#scripts. Ein Eintrag, den niemand ausfuehren kann,
        ist eine Behauptung, kein Tor.
     3  Schienen-Verkabelung: `gate` und `gate:data` fahren wirklich ueber
        das Verzeichnis (run-gate.mjs), nicht ueber eine handgepflegte
        zweite Kette; jede Schiene-A-Strecke ist ausfuehrbar, und keine
        Schiene-B/C-Strecke laeuft im Auslieferungs-Tor mit.
     4  Umgebungsmarken (Grundsatz 4, Anlass cf58c76): beruehrt ein
        Pruefskript git, das Netz oder einen Kindprozess, muss der
        Eintrag es unter `env` erklaeren — und umgekehrt muss jede Marke
        im Code eine Entsprechung haben (Zombie-Waechter). Ein
        ungegatterter git-Aufruf riss am 08.08.2026 jeden staging-Build,
        und staging lieferte knapp vier Stunden still den Vortagsstand.
     5  Aussetzungen und Werkzeuge sind begruendet: `disabled` braucht
        einen Grund, `rail: null` ein `why`. Ohne Begruendung ist ein
        stillgelegtes Tor nicht von einem vergessenen zu unterscheiden.
     6  Selbstauskunft + Klinke: das Skript druckt, wie viele Skripte es
        gesehen hat, und faellt unter die Untergrenze nicht durch.

       node scripts/verify-wiring.mjs
   ============================================================ */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKS, rail, plan, disabled } from './lib/gate-registry.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));

// Untergrenze der Skriptzahl. Darf nur nach OBEN wandern (neues Tor) —
// nach unten nur mit geklaerter Ursache, sichtbar im Commit-Diff.
// Stand 09.08.2026: 20 Dateien (17 aus dem Messlauf, dazu verify-wiring,
// verify-metrics und browser-smoke).
const MIN_SCRIPTS = 20;

const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };
const rel = (p) => p.replaceAll('\\', '/');

/* ---------- Bestand einlesen ---------- */
// Was als Pruefskript gilt: die beiden gewachsenen Namensfamilien plus
// namentlich genannte Ausreisser. `browser-smoke.mjs` heisst so, weil es
// keine Datei prueft, sondern eine laufende Seite — es gehoert trotzdem
// unter dieselbe Bijektionspflicht.
const DATEIEN = readdirSync(resolve(ROOT, 'scripts'))
  .filter((n) => /^(verify|audit)-.*\.mjs$/.test(n) || n === 'browser-smoke.mjs')
  .map((n) => `scripts/${n}`)
  .sort();

const eintragNachSkript = new Map(CHECKS.filter((c) => c.script).map((c) => [rel(c.script), c]));

console.log('\n[1] Bijektion: Dateibestand <-> Verzeichnis');
const ohneEintrag = DATEIEN.filter((f) => !eintragNachSkript.has(f));
const totEintrag = CHECKS.filter((c) => c.script && !existsSync(resolve(ROOT, c.script)));
console.log(`    Pruefskripte im Bestand: ${DATEIEN.length}   Eintraege im Verzeichnis: ${CHECKS.length}`);
console.log(`    ohne Eintrag — Soll: 0   Ist: ${ohneEintrag.length}`);
console.log(`    Eintraege ohne Datei — Soll: 0   Ist: ${totEintrag.length}`);
for (const f of ohneEintrag)
  fail.push(`${f} hat keinen Eintrag in scripts/lib/gate-registry.mjs — jedes Pruefskript gehoert an eine Schiene (oder wird mit rail:null + why als Werkzeug gefuehrt)`);
for (const c of totEintrag)
  fail.push(`Verzeichnis-Eintrag "${c.id}" nennt ${c.script} — die Datei gibt es nicht`);

// Doppelte Kennungen faenden sonst still die falsche Strecke.
const doppelt = CHECKS.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
need(!doppelt.length, `doppelte Kennung(en) im Verzeichnis: ${doppelt.join(', ')}`);

console.log('\n[2] Aufloesbarkeit: jedes npm-Feld existiert in package.json');
const mitNpm = CHECKS.filter((c) => c.npm);
const geisterhaft = mitNpm.filter((c) => !pkg.scripts?.[c.npm]);
console.log(`    Eintraege mit npm-Skript: ${mitNpm.length}   nicht aufloesbar — Soll: 0   Ist: ${geisterhaft.length}`);
for (const c of geisterhaft)
  fail.push(`Strecke "${c.id}" nennt npm-Skript "${c.npm}" — package.json kennt es nicht`);

console.log('\n[3] Schienen-Verkabelung');
const A = rail('A'), B = rail('B'), C = rail('C');
const laeuftA = plan('A'), laeuftB = plan('B');
console.log(`    Schiene A: ${A.length} Strecken (${laeuftA.length} scharf, ${A.length - laeuftA.length} ausgesetzt)`);
console.log(`    Schiene B: ${B.length} Strecken   Schiene C: ${C.length}   Werkzeuge: ${CHECKS.filter((c) => c.rail === null).length}`);
// `gate` MUSS ueber das Verzeichnis fahren. Eine handgepflegte &&-Kette
// waere eine zweite Wahrheit — genau der Zustand, den dieses Tor abloest.
const gateCmd = pkg.scripts?.gate ?? '';
const gateDataCmd = pkg.scripts?.['gate:data'] ?? '';
need(/run-gate\.mjs/.test(gateCmd), `package.json#gate faehrt nicht ueber scripts/run-gate.mjs (steht: "${gateCmd}") — eine handgepflegte Kette waere eine zweite Wahrheit neben dem Verzeichnis`);
// `gate` MUSS Schiene A sein. Ohne diese Zeile liesse sich das
// Auslieferungs-Tor unbemerkt auf eine andere (womoeglich duenne) Schiene
// umbiegen, und das Dockerfile pruefte still etwas anderes als gedacht.
need(!/--rail\s+(?!A\b)\w+/.test(gateCmd), `package.json#gate faehrt eine fremde Schiene (steht: "${gateCmd}") — das Auslieferungs-Tor ist Schiene A`);
need(/run-gate\.mjs/.test(gateDataCmd) && /--rail\s+B/.test(gateDataCmd), `package.json#gate:data faehrt nicht ueber run-gate.mjs --rail B (steht: "${gateDataCmd}")`);
// Jede scharfe A-Strecke muss ausfuehrbar sein (npm-Feld vorhanden).
for (const c of laeuftA) need(c.npm, `Schiene-A-Strecke "${c.id}" hat kein npm-Skript und kann im Tor nicht laufen`);
for (const c of laeuftB) need(c.npm, `Schiene-B-Strecke "${c.id}" hat kein npm-Skript und kann in gate:data nicht laufen`);
// Und keine Fremdschiene darf im Auslieferungs-Tor mitlaufen.
const fremdInA = laeuftA.filter((c) => c.rail !== 'A');
need(!fremdInA.length, `Fremde Schiene im Auslieferungs-Tor: ${fremdInA.map((c) => c.id).join(', ')}`);
console.log(`    gate -> run-gate.mjs: ${/run-gate\.mjs/.test(gateCmd) ? 'ja' : 'NEIN'}   gate:data -> --rail B: ${/--rail\s+B/.test(gateDataCmd) ? 'ja' : 'NEIN'}`);

console.log('\n[4] Umgebungsmarken: git / Netz / Kindprozess deklariert (Grundsatz 4)');
// Je Art: wie sieht sie im CODE aus, und wie muss die Marke im
// Verzeichnis sie BENENNEN. Beide Richtungen werden geprueft — eine
// undeklarierte Abhaengigkeit ist der cf58c76-Fall, eine Marke ohne
// Fundstelle ein Zombie.
const ARTEN = [
  {
    name: 'git',
    imCode: /(?:execFileSync|spawnSync|execSync)\s*\(\s*['"`]git\b|(?:execSync|exec)\s*\(\s*['"`][^'"`]*\bgit\s/,
    inMarke: /\bgit\b/i,
  },
  {
    name: 'Netz',
    imCode: /\bfetch\s*\(|from\s+['"]node:https?['"]|require\(\s*['"]node:https?['"]/,
    inMarke: /\bfetch\s*\(|\bNetz\b|https?:\/\//i,
  },
  {
    name: 'Kindprozess',
    imCode: /from\s+['"]node:child_process['"]|require\(\s*['"]node:child_process['"]/,
    inMarke: /Kindprozess|child_process|execFileSync|spawnSync|execSync/i,
  },
];
let geprueft = 0, uebersprungen = 0, marken = 0;
for (const c of CHECKS) {
  // Nur einzelne Skriptdateien lassen sich zeichensicher lesen; Eintraege,
  // die auf ein Verzeichnis zeigen (tests/e2e/), werden sichtbar
  // uebersprungen statt stillschweigend als "sauber" gezaehlt.
  if (!c.script) { uebersprungen++; continue; }
  const abs = resolve(ROOT, c.script);
  if (!existsSync(abs) || statSync(abs).isDirectory()) { uebersprungen++; continue; }
  geprueft++;
  const quelle = readFileSync(abs, 'utf8');
  const marke = c.env ?? '';
  for (const art of ARTEN) {
    const imCode = art.imCode.test(quelle);
    const benannt = art.inMarke.test(marke);
    if (imCode && !benannt)
      fail.push(`${c.id}: beruehrt ${art.name}, aber der Verzeichnis-Eintrag erklaert es nicht (Feld env fehlt oder nennt ${art.name} nicht). Genau daran riss cf58c76 jeden staging-Build.`);
    if (!imCode && benannt && c.env)
      fail.push(`${c.id}: die Umgebungsmarke nennt ${art.name}, im Skript kommt es nicht mehr vor — Zombie-Marke, entfernen`);
    if (imCode && benannt) marken++;
  }
}
console.log(`    Skripte zeichenweise geprueft: ${geprueft}   uebersprungen (Verzeichnis/ohne Datei): ${uebersprungen}`);
console.log(`    gedeckte Umgebungsberuehrungen: ${marken}   undeklariert + Zombies — Soll: 0`);

console.log('\n[5] Aussetzungen und Werkzeuge sind begruendet');
const aus = disabled();
const ohneGrund = aus.filter((c) => !c.disabled?.trim());
const werkzeugeOhneWhy = CHECKS.filter((c) => c.rail === null && !c.why?.trim());
console.log(`    ausgesetzte Strecken: ${aus.length}   davon ohne Grund — Soll: 0   Ist: ${ohneGrund.length}`);
console.log(`    Werkzeuge (rail:null): ${CHECKS.filter((c) => c.rail === null).length}   davon ohne why — Soll: 0   Ist: ${werkzeugeOhneWhy.length}`);
for (const c of ohneGrund) fail.push(`Strecke "${c.id}" ist ausgesetzt, nennt aber keinen Grund`);
for (const c of werkzeugeOhneWhy) fail.push(`"${c.id}" ist als Werkzeug gefuehrt (rail:null), begruendet es aber nicht (why)`);
for (const c of aus) console.log(`      ⚠ ${c.id}: ${c.disabled.split('.')[0]}.`);

console.log('\n[6] Selbstauskunft');
// Ohne diese Zahl waere ein Verzeichnis, das nach einem Umbau nur noch
// zwei Strecken kennt, von einem vollstaendigen nicht zu unterscheiden —
// beide melden gruen. Dieselbe Regel wie in verify-weapon-sizes.mjs.
console.log(`    Pruefskripte im Bestand: ${DATEIEN.length}   Untergrenze: ${MIN_SCRIPTS}`);
need(DATEIEN.length >= MIN_SCRIPTS, `nur ${DATEIEN.length} Pruefskripte gefunden, Untergrenze ist ${MIN_SCRIPTS} — Ursache klaeren, nicht die Untergrenze senken`);

if (fail.length) {
  console.error(`\nverify-wiring: ${fail.length} FEHLER\n`);
  for (const f of fail) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\nverify-wiring: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
