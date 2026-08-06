// verify-crafting-specs.mjs — Datengatter fuer Groesse/Grade/Ton auf den
// Crafting-Karten (Plan 05-01/CRAFT-03). Prueft die 15 gleichnamigen
// Blueprint-Gruppen, die 57 SizeN-Quantumdrives als unabhaengige Gegenprobe
// des Namens-Joins, die Wertebereiche und die Abdeckung je Vehiclegear-Typ.
//
// Spiegel-Hinweis: dieses Skript importiert `blueprints` und
// `blueprintSpecs` NICHT direkt aus src/lib/crafting.ts. Node's native
// TypeScript-Unterstuetzung entfernt die Typen aus der angefragten Datei
// selbst, loest aber deren extensionlose relative Importe (`from './items'`,
// `from '../i18n/ui'`) nicht auf — ein blosser `import()` von crafting.ts
// scheitert deshalb mit "Cannot find module './items'" (gemessen). Ohne
// Bundler/Loader (den dieses Projekt fuer Node-Skripte nicht einsetzt) bleibt
// nur die Spiegelung: die Funktionen unten sind Zeile fuer Zeile dieselbe
// Logik wie `COLLIDING_NAMES`/`blueprintSpecs`/`hasGradeSemantics` in
// src/lib/crafting.ts und src/lib/items.ts. Aendert sich die Logik dort,
// muss sie hier nachgezogen werden — Pruefblock 3 (die 15 Namensgruppen)
// vergleicht deshalb bewusst NICHT gegen das Ergebnis der echten Funktion
// (das waere zirkulaer), sondern gegen die vom Skript selbst neu berechnete
// Diskriminante (item_stats-Signatur), siehe dort.
//
// Aufruf: node scripts/verify-crafting-specs.mjs   (npm run verify:crafting)
// Exit 0 = alle Pruefungen unauffaellig, Exit 1 = mindestens ein Befund.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const craftDb = JSON.parse(readFileSync(resolve(ROOT, 'assets', 'crafting-db.json'), 'utf8'));
const itemsDb = JSON.parse(readFileSync(resolve(ROOT, 'assets', 'universal-items.json'), 'utf8'));
const items = itemsDb.items;

const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };

/* ---------- Spiegel von src/lib/crafting.ts + src/lib/items.ts ---------- */

const itemByName = new Map(items.map((i) => [i.name.toLowerCase(), i]));

function rootCategory(cat) {
  return (cat || 'Other').split('/')[0].trim() || 'Other';
}

/** Spiegel von hasGradeSemantics() in src/lib/items.ts. */
function hasGradeSemantics(item) {
  return /Vehiclegear|Weapons|Armour|Attachment/.test(rootCategory(item.category));
}

/** Spiegel der stabilen, schluesselsortierten Serialisierung in crafting.ts. */
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

const byName = new Map();
for (const b of craftDb.blueprints) {
  const key = b.name.toLowerCase();
  const list = byName.get(key);
  if (list) list.push(b);
  else byName.set(key, [b]);
}

/** Spiegel von COLLIDING_NAMES in crafting.ts. */
const collidingNames = new Set();
for (const [name, list] of byName) {
  if (list.length < 2) continue;
  const sigs = new Set(list.map((b) => stableStringify(b.item_stats ?? null)));
  if (sigs.size > 1) collidingNames.add(name);
}

/** Spiegel von blueprintSpecs() in crafting.ts. */
function blueprintSpecs(b) {
  if (collidingNames.has(b.name.toLowerCase())) return null;
  const item = itemByName.get(b.name.toLowerCase());
  if (!item) return null;
  const g = item.game;
  const eq = hasGradeSemantics(item);
  const size = eq && g?.size != null ? g.size : null;
  const grade = eq && g?.grade ? g.grade : null;
  const tone = g?.class ?? null;
  if (size == null && grade == null && tone == null) return null;
  return { size, grade, tone };
}

const byBpName = (name) => byName.get(name.toLowerCase())?.[0] ?? null;

/* ---------- 1) Referenzwerte ---------- */
console.log('1) Referenzwerte …');
const REFERENCE = [
  ['Allegro', 4, 'A', 'Civilian'],
  ['Atlas', 1, 'A', 'Civilian'],
  ['Hemera', 2, 'A', 'Civilian'],
  ['Erebos', 3, 'A', 'Civilian'],
  ['Lotus', 2, 'A', 'Civilian'],
  ['Cassandra', 2, 'A', 'Stealth'],
  ['Cirrus', 2, 'C', 'Stealth'],
  ['Drift', 1, 'C', 'Stealth'],
];
let refChecked = 0, refBad = 0;
for (const [name, size, grade, tone] of REFERENCE) {
  const bp = byBpName(name);
  if (!bp) { refBad++; console.log(`   FEHLT: ${name} nicht in crafting-db.json`); continue; }
  refChecked++;
  const sp = blueprintSpecs(bp);
  if (!sp || sp.size !== size || sp.grade !== grade || sp.tone !== tone) {
    refBad++;
    console.log(`   ABWEICHUNG: ${name} erwartet {size:${size},grade:${grade},tone:${tone}} gemessen ${JSON.stringify(sp)}`);
  }
}
console.log(`   geprueft: ${refChecked} | abweichend: ${refBad}`);

/* ---------- 2) SizeN-Gegenprobe ---------- */
console.log('2) SizeN-Gegenprobe …');
const SIZE_RE = /Size(\d+)/;
let sizeNChecked = 0, sizeNBad = 0;
for (const b of craftDb.blueprints) {
  const m = SIZE_RE.exec(b.category || '');
  if (!m) continue;
  sizeNChecked++;
  const expected = Number(m[1]);
  const sp = blueprintSpecs(b);
  if (!sp || sp.size !== expected) {
    sizeNBad++;
    console.log(`   ABWEICHUNG: ${b.name} Kategorie-Groesse ${expected} != gejointe Groesse ${sp?.size ?? 'null'}`);
  }
}
console.log(`   geprueft: ${sizeNChecked} | abweichend: ${sizeNBad}`);
need(sizeNChecked === 57, `SizeN-Gegenprobe: erwartet 57 geprueft, gemessen ${sizeNChecked}`);
need(sizeNBad === 0, `SizeN-Gegenprobe: ${sizeNBad} Abweichungen`);

/* ---------- 3) Die 15 gleichnamigen Blueprints ---------- */
console.log('3) Die 15 gleichnamigen Blueprints — Diskriminante item_stats …');
const EXPECTED_COLLIDING = ['antium core jet', 'broadspec', 'main powerplant', 'serac', 'stellate'].sort();

const dupGroups = [...byName.entries()].filter(([, list]) => list.length > 1);
let groupsCollidingMeasured = 0, groupsCollidingCards = 0, groupsUnauffaellig = 0;
let overheatOnlyDiffering = 0;
const collisionFindings = [];

for (const [name, list] of dupGroups) {
  const sigs = new Set(list.map((b) => stableStringify(b.item_stats ?? null)));
  const isColliding = sigs.size > 1;

  const overheatVals = new Set(list.map((b) => b.item_stats?.overheat_temperature ?? null));
  if (overheatVals.size > 1) overheatOnlyDiffering++;

  if (isColliding) {
    groupsCollidingMeasured++;
    groupsCollidingCards += list.length;
    for (const b of list) {
      const sp = blueprintSpecs(b);
      if (sp !== null) collisionFindings.push(`GESPERRTE GRUPPE ZEIGT CHIPS: "${b.name}" (Kategorie ${b.category}) liefert ${JSON.stringify(sp)} statt null`);
    }
  } else {
    groupsUnauffaellig++;
    if (collidingNames.has(name)) collisionFindings.push(`UNAUFFAELLIGE GRUPPE GESPERRT: "${name}" ist trotz identischer item_stats in COLLIDING_NAMES`);
    const results = list.map((b) => JSON.stringify(blueprintSpecs(b)));
    if (new Set(results).size > 1) collisionFindings.push(`UNAUFFAELLIGE GRUPPE UNEINHEITLICH: "${name}" liefert unterschiedliche Ergebnisse je Mitglied: ${results.join(' vs ')}`);
  }
}

console.log(`   Namensgruppen: ${dupGroups.length} | kollidierend: ${groupsCollidingMeasured} (${groupsCollidingCards} Karten) | unauffaellig: ${groupsUnauffaellig}`);
console.log(`   kollidierende Namen: ${[...collidingNames].sort().join(', ')}`);
console.log(`   Selbstprobe: ein Vergleich nur ueber overheat_temperature faende ${overheatOnlyDiffering} von ${groupsCollidingMeasured} Gruppen — Hinweis, damit der Vergleich nie auf dieses eine Feld verschlankt wird.`);

need(dupGroups.length === 15, `Namensgruppen: erwartet 15, gemessen ${dupGroups.length}`);
need(groupsCollidingMeasured === 5, `kollidierende Gruppen: erwartet 5, gemessen ${groupsCollidingMeasured}`);
need(groupsCollidingCards === 10, `gesperrte Karten: erwartet 10, gemessen ${groupsCollidingCards}`);
need(groupsUnauffaellig === 10, `unauffaellige Gruppen: erwartet 10, gemessen ${groupsUnauffaellig}`);
const measuredColliding = [...collidingNames].sort();
need(
  JSON.stringify(measuredColliding) === JSON.stringify(EXPECTED_COLLIDING),
  `kollidierende Namen weichen ab — erwartet [${EXPECTED_COLLIDING.join(', ')}], gemessen [${measuredColliding.join(', ')}]`,
);
for (const f of collisionFindings) fail.push(f);

/* ---------- 4) Wertebereiche ---------- */
console.log('4) Wertebereiche …');
const VALID_GRADES = new Set(['A', 'B', 'C', 'D']);
let gradeChecked = 0, gradeBad = 0, sizeChecked = 0, sizeBad = 0;
for (const b of craftDb.blueprints) {
  const sp = blueprintSpecs(b);
  if (!sp) continue;
  if (sp.grade != null) {
    gradeChecked++;
    if (!VALID_GRADES.has(sp.grade)) { gradeBad++; fail.push(`Wertebereich Grade: "${b.name}" hat "${sp.grade}"`); }
  }
  if (sp.size != null) {
    sizeChecked++;
    if (!(Number.isInteger(sp.size) && sp.size >= 0 && sp.size <= 7)) { sizeBad++; fail.push(`Wertebereich Groesse: "${b.name}" hat ${sp.size}`); }
  }
}
console.log(`   Grade geprueft: ${gradeChecked} | ausserhalb A-D: ${gradeBad}`);
console.log(`   Groesse geprueft: ${sizeChecked} | ausserhalb 0-7: ${sizeBad}`);

/* ---------- 5) Ruestung ohne Ton ---------- */
console.log('5) Ruestung ohne Ton …');
const armourBps = craftDb.blueprints.filter((b) => rootCategory(b.category) === 'Armour');
let armourWithTone = 0;
for (const b of armourBps) {
  const sp = blueprintSpecs(b);
  if (sp?.tone != null) { armourWithTone++; fail.push(`Ruestung mit Ton: "${b.name}" liefert Ton "${sp.tone}" (D-05 verletzt)`); }
}
console.log(`   Armour-Blueprints geprueft: ${armourBps.length} | mit Ton: ${armourWithTone}`);
need(armourBps.length === 913, `Armour-Blueprints: erwartet 913, gemessen ${armourBps.length}`);
need(armourWithTone === 0, `${armourWithTone} Armour-Blueprints mit Ton`);

/* ---------- 6) Abdeckung ---------- */
console.log('6) Abdeckung je Vehiclegear-Typ …');
const COVERAGE_EXPECTED = {
  Powerplant: { n: 75, gated: 4, size: 71, grade: 71, tone: 71 },
  Cooler: { n: 75, gated: 2, size: 71, grade: 71, tone: 70 },
  Shield: { n: 62, gated: 0, size: 62, grade: 62, tone: 61 },
  Radar: { n: 60, gated: 2, size: 55, grade: 55, tone: 55 },
  Quantumdrive: { n: 57, gated: 0, size: 57, grade: 57, tone: 56 },
};
for (const [type, exp] of Object.entries(COVERAGE_EXPECTED)) {
  const bps = craftDb.blueprints.filter((b) => b.category.includes('Vehiclegear') && b.category.includes(`/ ${type}`));
  let gated = 0, size = 0, grade = 0, tone = 0;
  for (const b of bps) {
    if (collidingNames.has(b.name.toLowerCase())) { gated++; continue; }
    const sp = blueprintSpecs(b);
    if (sp?.size != null) size++;
    if (sp?.grade != null) grade++;
    if (sp?.tone != null) tone++;
  }
  console.log(`   ${type}: n=${bps.length} gesperrt=${gated} Groesse=${size} Grade=${grade} Ton=${tone}`);
  need(bps.length === exp.n, `${type}: n erwartet ${exp.n}, gemessen ${bps.length}`);
  need(gated === exp.gated, `${type}: gesperrt erwartet ${exp.gated}, gemessen ${gated}`);
  need(size === exp.size, `${type}: Groesse erwartet ${exp.size}, gemessen ${size}`);
  need(grade === exp.grade, `${type}: Grade erwartet ${exp.grade}, gemessen ${grade}`);
  need(tone === exp.tone, `${type}: Ton erwartet ${exp.tone}, gemessen ${tone}`);
}

/* ---------- Verdikt ---------- */
console.log('---');
if (refBad > 0) fail.push(`Referenzwerte: ${refBad} von ${refChecked} abweichend`);
if (fail.length === 0) {
  console.log('OK: alle Pruefungen unauffaellig.');
  process.exit(0);
} else {
  console.log(`BEFUNDE (${fail.length}):`);
  for (const f of fail) console.log(`   - ${f}`);
  process.exit(1);
}
