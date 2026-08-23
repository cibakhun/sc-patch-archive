/* ============================================================
   verify-metrics.mjs — die Bestaende duerfen nur BEWUSST schrumpfen.

   WARUM ES DEN GIBT: Im Juli 2026 hat ein einziger Datenlauf
   (`sync:item-prices` gegen eine veraltete externe global.ini) den
   Item-Katalog um 834 Eintraege verkleinert; 319 Items verloren ihre
   Bezugsquellen. Aufgefallen ist es Wochen spaeter. Nichts im Build hat
   es gemeldet — die Seite baute, lud und funktionierte, sie war nur
   kleiner. Genau dieser Ausfallmodus: kein Absturz, kein roter Test, nur
   weniger Wahrheit.

   Seither existierte als Gegenmittel eine Merkregel im Kopf des
   Betreibers ("nach jedem datamine:items die collapsedNames pruefen").
   Bei vielen parallel arbeitenden Sitzungen ist das die eine Ressource,
   die garantiert reisst. Dieses Skript ersetzt sie durch eine Klinke.

   VERFAHREN: Jede Kennzahl wird aus einem COMMITTETEN Artefakt gelesen
   (kein Datamine-Lauf, kein Netz, keine Data.p4k) und gegen
   scripts/lib/metrics-baseline.mjs gehalten:
     regel 'min'    — darf wachsen, nicht fallen (optional mit Toleranz
                      fuer Kennzahlen, die naturgemaess schwanken)
     regel 'exakt'  — jede Aenderung ist eine Entscheidung
   Waechst ein Bestand, schlaegt nichts an; die Baseline wird gelegentlich
   per bewusstem Commit nachgezogen, dessen Diff die Entwicklung zeigt.
   Schrumpft er, reisst das Tor — und die einzige zulaessige Antwort ist
   ein Baseline-Commit, dessen Botschaft die URSACHE nennt.

   Vier Zusicherungen:
     1  Jede Kennzahl liegt ueber (bzw. auf) ihrer Klinke.
     2  Bijektion Ableser <-> Baseline: keine Kennzahl ohne Regel, keine
        Regel ohne Ableser. Sonst erodiert die Baseline still.
     3  Jede Baseline-Zeile nennt einen Anlass.
     4  Selbstauskunft: wie viele Kennzahlen wurden wirklich gelesen.

     node scripts/verify-metrics.mjs            prueft
     node scripts/verify-metrics.mjs --report   nur Ist-Werte zeigen
   ============================================================ */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASELINE } from './lib/metrics-baseline.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = process.argv.includes('--report');
const rd = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

/* ---------- dist/ einmal zaehlen (readdir, keine Dateiinhalte) ---------- */
const DIST = resolve(ROOT, 'dist');
function zaehleHtml(dir) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += zaehleHtml(join(dir, e.name));
    else if (e.name.endsWith('.html')) n++;
  }
  return n;
}

/* ---------- Die Ableser. Jeder liefert eine Zahl oder null ---------- */
// null heisst "Quelle nicht vorhanden" — das ist etwas anderes als 0 und
// wird als FEHLER gemeldet, nicht als Schrumpfung. Ein Ableser, der bei
// fehlender Datei still 0 liefert, wuerde jede Klinke sofort reissen und
// waere binnen einer Woche abgeschaltet.
const ABLESER = {
  // --- Item-Katalog (assets/universal-items.json) ---
  items: () => rd('assets/universal-items.json').counts?.items,
  itemsMitBezugsquelle: () => rd('assets/universal-items.json').counts?.withObtain,
  itemsMitSpieldaten: () => rd('assets/universal-items.json').counts?.withDetails,
  uexPreiszeilen: () => rd('assets/universal-items.json').counts?.uexRows,
  ruestungsSets: () => rd('assets/universal-items.json').sets?.length,

  // --- Fahrzeuge ---
  fahrzeuge: () => rd('src/data/vehicles.json').vehicles?.length,
  fahrzeugeMitBauteilen: () => Object.keys(rd('src/data/ship-components.json').ships ?? {}).length,
  fahrzeugeMitRolle: () => rd('src/data/vehicle-roles.json').count,
  fahrzeugeMitHardpoints: () => Object.keys(rd('src/data/ship-hardpoints.json').ships ?? {}).length,

  // --- Crafting / Bergbau ---
  blueprints: () => (rd('assets/crafting-db.json').blueprints ?? []).length,
  minerale: () => (rd('assets/mining-db.json').minerals ?? []).length,

  // --- Missionen (src/data/missions.json) ---
  // Familien mit nichtleerem localities[] (nach Filterung von null/leeren
  // Strings) — dieselbe Definition wie scripts/probes/missionsorte-messung.mjs.
  // Wert kommt aus meta.counts.mitOrt (vom Erzeuger geschrieben), NICHT ein
  // zweites Mal aus der Missionsliste nachgerechnet (Phase 18, 18-01-PLAN.md).
  missionenMitOrt: () => rd('src/data/missions.json').meta?.counts?.mitOrt,
  // Zahl der unterschiedenen Ortsarten im Missionstext (Spielort/Zielort/
  // Abholort/Lieferort, ggf. mehr) — Phase 18 Plan 02, Task 3. `null` statt
  // `0`, wenn das Feld fehlt: das Tor meldet dann "Quelle nicht lesbar"
  // statt faelschlich eine Schrumpfung zu behaupten.
  missionsOrtsarten: () => rd('src/data/missions.json').meta?.counts?.ortsarten ?? null,

  // --- Der gebaute Stand ---
  seitenGesamt: () => zaehleHtml(DIST),
  seitenItems: () => zaehleHtml(join(DIST, 'items')),
  seitenMissionen: () => zaehleHtml(join(DIST, 'missionen')),
  seitenCrafting: () => zaehleHtml(join(DIST, 'crafting')),
  seitenSchiffe: () => zaehleHtml(join(DIST, 'schiffe')),
  seitenPatches: () => zaehleHtml(join(DIST, 'patches')),
  seitenThemen: () => zaehleHtml(join(DIST, 'topics')),
  sitemaps: () =>
    existsSync(DIST) ? readdirSync(DIST).filter((n) => /^sitemap.*\.xml$/.test(n)).length : null,
};

/* ---------- Lesen ---------- */
const fail = [];
const zeilen = [];
let gelesen = 0;

const baselineNach = new Map(BASELINE.map((b) => [b.id, b]));

for (const [id, ablesen] of Object.entries(ABLESER)) {
  const b = baselineNach.get(id);
  let ist = null;
  let fehler = null;
  try {
    ist = ablesen();
  } catch (e) {
    fehler = e.message;
  }
  if (fehler != null || ist == null || Number.isNaN(ist)) {
    fail.push(`${id}: Quelle nicht lesbar (${fehler ?? 'Feld fehlt oder ist null'}) — das ist keine Schrumpfung, sondern ein kaputter Ableser`);
    zeilen.push({ id, soll: b?.wert ?? '—', ist: '—', regel: b?.regel ?? '—', urteil: 'QUELLE' });
    continue;
  }
  gelesen++;
  if (!b) {
    zeilen.push({ id, soll: '—', ist, regel: '—', urteil: 'OHNE REGEL' });
    continue;
  }
  const grenze =
    b.regel === 'exakt' ? b.wert : Math.floor(b.wert * (1 - (b.toleranzProzent ?? 0) / 100));
  const ok = b.regel === 'exakt' ? ist === b.wert : ist >= grenze;
  zeilen.push({
    id,
    soll: b.regel === 'exakt' ? b.wert : `>= ${grenze}`,
    ist,
    regel: b.regel + (b.toleranzProzent ? ` -${b.toleranzProzent}%` : ''),
    urteil: ok ? 'ok' : 'GERISSEN',
  });
  if (!ok && !REPORT) {
    fail.push(
      b.regel === 'exakt'
        ? `${id}: ${ist} statt genau ${b.wert} — Aenderung nur per bewusstem Baseline-Commit (Anlass: ${b.anlass})`
        : `${id}: ${ist} liegt unter der Klinke ${grenze} (Baseline ${b.wert}${b.toleranzProzent ? `, Toleranz ${b.toleranzProzent}%` : ''}) — Ursache klaeren, nicht die Klinke senken. Anlass der Klinke: ${b.anlass}`,
    );
  }
}

/* ---------- Ausgabe ---------- */
console.log('\n[1] Kennzahlen gegen die Klinke');
console.log(`    ${'Kennzahl'.padEnd(24)}${'Soll'.padStart(12)}${'Ist'.padStart(10)}   Regel`);
console.log('    ' + '-'.repeat(66));
for (const z of zeilen)
  console.log(
    `    ${z.id.padEnd(24)}${String(z.soll).padStart(12)}${String(z.ist).padStart(10)}   ` +
      `${String(z.regel).padEnd(12)}${z.urteil === 'ok' ? '' : z.urteil}`,
  );

console.log('\n[2] Bijektion Ableser <-> Baseline');
const ohneRegel = Object.keys(ABLESER).filter((id) => !baselineNach.has(id));
const ohneAbleser = BASELINE.filter((b) => !(b.id in ABLESER));
console.log(`    Ableser: ${Object.keys(ABLESER).length}   Baseline-Zeilen: ${BASELINE.length}`);
console.log(`    ohne Regel — Soll: 0   Ist: ${ohneRegel.length}`);
console.log(`    ohne Ableser — Soll: 0   Ist: ${ohneAbleser.length}`);
for (const id of ohneRegel)
  fail.push(`Kennzahl "${id}" wird gelesen, hat aber keine Baseline-Zeile — ungeprueft ist schlimmer als ungemessen`);
for (const b of ohneAbleser)
  fail.push(`Baseline-Zeile "${b.id}" hat keinen Ableser — die Regel laeuft ins Leere`);

console.log('\n[3] Jede Baseline-Zeile nennt einen Anlass');
const ohneAnlass = BASELINE.filter((b) => !b.anlass?.trim());
console.log(`    ohne Anlass — Soll: 0   Ist: ${ohneAnlass.length}`);
for (const b of ohneAnlass)
  fail.push(`Baseline-Zeile "${b.id}" nennt keinen Anlass — eine Zahl ohne Herkunft ist in einem Jahr unantastbar`);

console.log('\n[4] Selbstauskunft');
console.log(`    Kennzahlen wirklich gelesen: ${gelesen} von ${Object.keys(ABLESER).length}`);

if (REPORT) {
  console.log('\n(--report: nur Ist-Werte, kein Urteil)\n');
  process.exit(0);
}
if (fail.length) {
  console.error(`\nverify-metrics: ${fail.length} FEHLER\n`);
  for (const f of fail) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\nverify-metrics: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
