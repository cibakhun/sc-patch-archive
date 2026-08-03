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

// 1) Alle item_name-Schluessel einlesen — die Kurzformen brauchen ihre Langform.
const alleKeys = new Map();
for (const line of readFileSync(GLOBAL_INI, 'latin1').split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq < 0) continue;
  let key = line.slice(0, eq).trim();
  const comma = key.indexOf(',');
  if (comma >= 0) key = key.slice(0, comma);
  if (!/^item_name/i.test(key)) continue;
  alleKeys.set(key, line.slice(eq + 1).trim());
}

// kurzform (lowercase) -> Langform aus dem Basis-Schluessel (oder null)
const kurzformen = new Map();
for (const [key, val] of alleKeys) {
  if (!/_short$/i.test(key) || !val) continue;
  const lang = alleKeys.get(key.replace(/_short$/i, ''));
  const k = val.toLowerCase();
  // Bei mehreren Treffern die erste Langform behalten, die wirklich abweicht.
  if (!kurzformen.has(k) || (kurzformen.get(k) === null && lang)) {
    kurzformen.set(k, lang && lang.toLowerCase() !== k ? lang : null);
  }
}

const db = JSON.parse(readFileSync(DB, 'utf8'));
const istListe = Array.isArray(db.items);
const items = istListe ? db.items : Object.values(db.items);

// Namensregister des Katalogs — braucht Regel B, um die Langform nachzuweisen.
const imKatalog = new Set(items.map((i) => String(i.name || '').toLowerCase()));

const behalten = [];
const entferntStumpf = [];   // Regel A
const entferntDublette = []; // Regel B
const geschuetzt = [];
for (const it of items) {
  const name = String(it.name || '');
  const k = name.toLowerCase();
  if (!kurzformen.has(k)) { behalten.push(it); continue; }

  // Nichts anfassen, was Daten traegt — das gilt fuer beide Regeln.
  if ((it.obtain || []).length > 0) {
    geschuetzt.push(`${name} — ${(it.obtain || []).length} Bezugsquellen`);
    behalten.push(it);
    continue;
  }

  // Regel A: Serien-/Kurznamen-Stumpf ohne jede Einordnung.
  if (it.category === 'Other') { entferntStumpf.push(name); continue; }

  // Regel B: Kurzetikett einer Variante, deren LANGFORM ebenfalls im Katalog
  // steht — dann ist dieser Eintrag beweisbar dieselbe Sache:
  //     …_01_arctic01       = A03 "Canuto" Sniper Rifle
  //     …_01_arctic01_short = A03 C Sniper Rifle
  // Ohne vorhandene Langform bliebe er die einzige Vertretung des Items und
  // muss stehen bleiben.
  const lang = kurzformen.get(k);
  if (lang && imKatalog.has(lang.toLowerCase())) { entferntDublette.push([name, lang]); continue; }

  geschuetzt.push(`${name} (${it.category}) — keine Langform im Katalog`);
  behalten.push(it);
}

const entfernt = [...entferntStumpf, ...entferntDublette.map((d) => d[0])];
console.log(`Kurzformen in global.ini:        ${kurzformen.size}`);
console.log(`Katalog vorher:                  ${items.length}`);
console.log(`  A: Stuempfe (Other, leer):     ${entferntStumpf.length}`);
console.log(`  B: Kurzetikett mit Langform:   ${entferntDublette.length}`);
console.log(`  behalten trotz Namenstreffer:  ${geschuetzt.length}`);
console.log(`Katalog nachher:                 ${behalten.length}`);
console.log('\nRegel A — entfernte Stuempfe (Stichprobe):');
for (const e of entferntStumpf.slice(0, 8)) console.log(`   ${e}`);
console.log('\nRegel B — Kurzetikett -> vorhandene Langform (Stichprobe):');
for (const [s, l] of entferntDublette.slice(0, 8)) console.log(`   "${s}"  ->  "${l}"`);
if (geschuetzt.length) {
  console.log('\nBehalten (Stichprobe):');
  for (const g of geschuetzt.slice(0, 8)) console.log(`   ${g}`);
}

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
