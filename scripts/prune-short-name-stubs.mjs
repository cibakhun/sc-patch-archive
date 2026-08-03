// prune-short-name-stubs.mjs — entfernt die Kurznamen-Stuempfe aus dem fertigen
// assets/universal-items.json.
//
// WARUM ES DIESES SKRIPT GIBT (und nicht einfach ein Neubau):
// Die Ursache sitzt in build-universal-db.mjs und ist dort behoben — `…_short`
// aus global.ini ist die Kurzform desselben Items, kein eigener Gegenstand:
//     item_NameMXOX_NeutronRepeater_S1       = NDB-26 Repeater   <- das Item
//     item_NameMXOX_NeutronRepeater_S1_short = NDB-26            <- nur das Etikett
//
// Ein `npm run sync:items` wuerde die Korrektur aber teuer erkaufen: die lokal
// vorhandene global.ini ist NICHT die, aus der der committete Katalog gebaut
// wurde. Gemessen am 02.08.2026 kostete ein Neubau damit 906 Items (netto -834)
// und 319 Items verloren ihre Bezugsquellen — nur wegen abweichender
// Schreibweisen („(15 cap)" -> „(15 Cap)", „Mk II" -> „MK II", „Auorora").
// Siehe auch die Merknotiz „Item-Finder Daten-Refresh".
//
// Deshalb hier der chirurgische Schnitt: nur die Stuempfe raus, alles andere
// unangetastet. Sobald jemand mit einer frischen p4k-global.ini neu baut,
// greift die Korrektur im Build-Skript und dieses Skript wird ueberfluessig.
//
// DREIFACHE SICHERUNG — entfernt wird nur, was ALLE drei Bedingungen erfuellt:
//   1. Der Name steht in global.ini als Wert eines `…_short`-Schluessels
//   2. Die Kategorie ist „Other" (echte Items sind einsortiert)
//   3. Der Eintrag hat KEINE einzige Bezugsquelle
// Damit kann kein Item mit Daten verloren gehen.
//
// Aufruf: node scripts/prune-short-name-stubs.mjs [--global-ini <pfad>] [--dry]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DB = resolve(ROOT, 'assets', 'universal-items.json');

const argv = process.argv.slice(2);
const iniIx = argv.indexOf('--global-ini');
const DRY = argv.includes('--dry');
const GLOBAL_INI = iniIx >= 0
  ? resolve(argv[iniIx + 1])
  : resolve('G:/Projects/games/Star Citizen/sc-dataminer/extracted/Data/Localization/english/global.ini');

if (!existsSync(GLOBAL_INI)) {
  console.error(`FEHLER: global.ini nicht gefunden: ${GLOBAL_INI}`);
  console.error('Ohne sie laesst sich nicht feststellen, welche Namen Kurzformen sind. Abbruch.');
  process.exit(1);
}

// 1) Alle Kurzform-Werte einsammeln.
const kurzformen = new Set();
for (const line of readFileSync(GLOBAL_INI, 'latin1').split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq < 0) continue;
  let key = line.slice(0, eq).trim();
  const comma = key.indexOf(',');
  if (comma >= 0) key = key.slice(0, comma);
  if (!/^item_name/i.test(key) || !/_short$/i.test(key)) continue;
  const val = line.slice(eq + 1).trim();
  if (val) kurzformen.add(val.toLowerCase());
}

const db = JSON.parse(readFileSync(DB, 'utf8'));
const istListe = Array.isArray(db.items);
const items = istListe ? db.items : Object.values(db.items);

const behalten = [];
const entfernt = [];
const geschuetzt = [];
for (const it of items) {
  const name = String(it.name || '');
  const trifft = kurzformen.has(name.toLowerCase());
  if (!trifft) { behalten.push(it); continue; }

  // Bedingung 2 + 3 — sonst bleibt der Eintrag, auch wenn der Name passt.
  const hatDaten = (it.obtain || []).length > 0;
  const istOther = it.category === 'Other';
  if (hatDaten || !istOther) {
    geschuetzt.push(`${name} (${it.category}, ${(it.obtain || []).length} Bezugsquellen)`);
    behalten.push(it);
    continue;
  }
  entfernt.push(name);
}

console.log(`Kurzformen in global.ini:      ${kurzformen.size}`);
console.log(`Katalog vorher:                ${items.length}`);
console.log(`  entfernt (Stumpf):           ${entfernt.length}`);
console.log(`  behalten trotz Namenstreffer:${geschuetzt.length}`);
console.log(`Katalog nachher:               ${behalten.length}`);
if (geschuetzt.length) {
  console.log('\nDiese trugen den Kurznamen, hatten aber Daten oder eine Kategorie — bleiben:');
  for (const g of geschuetzt.slice(0, 20)) console.log(`   ${g}`);
}
console.log('\nEntfernt (Stichprobe):');
for (const e of entfernt.slice(0, 15)) console.log(`   ${e}`);

if (DRY) {
  console.log('\n--dry: nichts geschrieben.');
  process.exit(0);
}

db.items = istListe ? behalten : Object.fromEntries(behalten.map((i) => [i.id, i]));

// Die Kennzahlen im Kopf muessen mitwandern, sonst widersprechen sie den Daten
// (tests/e2e/db.test.js prueft genau das). Entfernt wurden ausschliesslich
// Eintraege ohne Bezugsquelle, also aendert sich nur items und catalogOnly.
if (db.counts) {
  const mitQuelle = behalten.filter((i) => (i.obtain || []).length > 0).length;
  db.counts.items = behalten.length;
  db.counts.withObtain = mitQuelle;
  db.counts.catalogOnly = behalten.length - mitQuelle;
}

writeFileSync(DB, JSON.stringify(db));
console.log(`\nKennzahlen aktualisiert: items=${db.counts?.items} withObtain=${db.counts?.withObtain} catalogOnly=${db.counts?.catalogOnly}`);
console.log('OK:', DB);
