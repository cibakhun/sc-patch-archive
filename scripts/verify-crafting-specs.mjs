// verify-crafting-specs.mjs — Datengatter fuer Groesse/Grade/Ton auf den
// Crafting-Karten (Plan 05-01+05-02 / CRAFT-01..03). Prueft die 15
// gleichnamigen Blueprint-Gruppen, die 57 SizeN-Quantumdrives als
// unabhaengige Gegenprobe des Namens-Joins, die Wertebereiche, die Abdeckung
// je Vehiclegear-Typ, den Schiffswaffen-Ton aus dem Kategorie-Pfad (D-04)
// und die Gesamtabdeckung nach der Sperre ueber alle 1594 Blueprints.
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

/** Spiegel von toneFromWeaponCategoryPath() in crafting.ts (D-04): die 96
 * Vehiclegear-Waffen fuehren game.class = null, ihr Ton steht aber im
 * Kategorie-String des BLUEPRINTS selbst — drittes Segment nach
 * Vehiclegear / Weapons, z. B. "Ballistic" aus
 * "Vehiclegear / Weapons / Ballistic / Cannon". */
function toneFromWeaponCategoryPath(category) {
  const segs = (category || '').split('/').map((s) => s.trim()).filter(Boolean);
  if (segs[0] === 'Vehiclegear' && segs[1] === 'Weapons' && segs[2]) return segs[2];
  return null;
}

/** Spiegel von GRADE_BEARING_TYPES in crafting.ts: eine Bauteilart traegt nur
 * dann einen aussagekraeftigen Grade, wenn mindestens zwei Grades vorkommen und
 * der seltenste mindestens ein Zehntel der Art ausmacht. Sonst ist "A" der
 * Vorgabewert aus AttachDef.Grade und behauptet eine Einstufung, die es im
 * Spiel nicht gibt (152 Schiffswaffen ausnahmslos A, 381 Handwaffen ebenso). */
const gradeBearingTypes = (() => {
  const byType = new Map();
  for (const it of items) {
    const t = it.game?.gameType;
    const gr = it.game?.grade;
    if (!t || !gr) continue;
    let m = byType.get(t);
    if (!m) byType.set(t, (m = new Map()));
    m.set(gr, (m.get(gr) ?? 0) + 1);
  }
  const bearing = new Set();
  for (const [type, counts] of byType) {
    if (counts.size < 2) continue;
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (Math.min(...counts.values()) / total >= 0.1) bearing.add(type);
  }
  return bearing;
})();

/** Spiegel von blueprintSpecs() in crafting.ts. */
function blueprintSpecs(b) {
  if (collidingNames.has(b.name.toLowerCase())) return null;
  const item = itemByName.get(b.name.toLowerCase());
  if (!item) return null;
  const g = item.game;
  const eq = hasGradeSemantics(item);
  const size = eq && g?.size != null ? g.size : null;
  const grade = eq && g?.grade && g.gameType && gradeBearingTypes.has(g.gameType) ? g.grade : null;
  const tone = g?.class ?? toneFromWeaponCategoryPath(b.category);
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
// Erwartungswerte nachgezogen am 07.08.2026 beim Zusammenfuehren mit staging.
// Cooler faellt von 71/71/70 auf 70/70/69, weil "Nightfall" aus
// assets/universal-items.json verschwunden ist (staging baut den Katalog mit
// 9167 statt 9788 Eintraegen). Der Blueprint existiert weiter und bleibt
// auffindbar — er zeigt nur keine Kennwerte mehr, was nach D-06 richtig ist.
const COVERAGE_EXPECTED = {
  Powerplant: { n: 75, gated: 4, size: 71, grade: 71, tone: 71 },
  Cooler: { n: 75, gated: 2, size: 70, grade: 70, tone: 69 },
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

/* ---------- 7) Schiffswaffen-Ton aus dem Kategorie-Pfad (D-04, Plan 05-02) ---------- */
console.log('7) Schiffswaffen-Ton aus dem Kategorie-Pfad …');
const weaponBps = craftDb.blueprints.filter((b) => {
  const segs = (b.category || '').split('/').map((s) => s.trim()).filter(Boolean);
  return segs[0] === 'Vehiclegear' && segs[1] === 'Weapons';
});
let weaponChecked = 0, weaponBad = 0;
for (const b of weaponBps) {
  weaponChecked++;
  const expectedTone = toneFromWeaponCategoryPath(b.category);
  const sp = blueprintSpecs(b);
  if (!sp || sp.tone !== expectedTone) {
    weaponBad++;
    fail.push(`Schiffswaffen-Ton: "${b.name}" (${b.category}) erwartet Ton "${expectedTone}", gemessen ${JSON.stringify(sp)}`);
  }
}
console.log(`   Schiffswaffen geprueft: ${weaponChecked} | Abweichungen: ${weaponBad}`);
need(weaponChecked === 96, `Schiffswaffen: erwartet 96 geprueft, gemessen ${weaponChecked}`);
need(weaponBad === 0, `Schiffswaffen-Ton: ${weaponBad} Abweichungen`);

/* ---------- 8) Gesamtabdeckung nach der Sperre (Plan 05-02) ---------- */
console.log('8) Gesamtabdeckung nach der Sperre …');
let totalWithSpec = 0, totalSize = 0, totalGrade = 0, totalTone = 0, totalNone = 0;
let toneFromClass = 0, toneFromPath = 0;
for (const b of craftDb.blueprints) {
  const item = itemByName.get(b.name.toLowerCase());
  const sp = blueprintSpecs(b);
  if (!sp) { totalNone++; continue; }
  totalWithSpec++;
  if (sp.size != null) totalSize++;
  if (sp.grade != null) totalGrade++;
  if (sp.tone != null) {
    totalTone++;
    if (item?.game?.class) toneFromClass++; else toneFromPath++;
  }
}
console.log(`   Chip-Reihen (mind. 1 Angabe): ${totalWithSpec} | Groesse: ${totalSize} | Grade: ${totalGrade} | Ton: ${totalTone} (${toneFromClass} aus game.class, ${toneFromPath} aus dem Pfad) | ohne jede Angabe: ${totalNone}`);
// Erwartungswerte nachgezogen am 07.08.2026 beim Zusammenfuehren mit staging.
// Fuenf Blueprints haben ihre Einzelgroesse verloren, alle aus gutem Grund:
//   broadspec, gvsr repeater, revenant gatling, tarantula gt-870 mark 3 cannon
//     — staging fuehrt fuer mehrdeutige Anzeigenamen seit dem 06.08. `sizes[]`
//       + `variants[]` statt einer erfundenen Einzelgroesse. Genau die Fehler-
//       klasse, gegen die auch die Kollisionssperre hier gebaut ist; zwei
//       unabhaengige Wege, dasselbe Problem zu erkennen.
//   nightfall — aus dem Item-Katalog verschwunden (9788 -> 9167 Eintraege).
// Alle fuenf zeigen jetzt nichts an statt eines geratenen Wertes (D-06).
// Offen als Folgearbeit: die vier Varianten-Items koennten ihre Groessen als
// "S3 / S4 / S6" zeigen, so wie es die Item-Seite bereits tut.
need(totalWithSpec === 1513, `Chip-Reihen: erwartet 1513, gemessen ${totalWithSpec}`);
need(totalSize === 1509, `Groesse: erwartet 1509, gemessen ${totalSize}`);
// 315 statt 1509 seit dem 07.08.2026: der Grade erscheint nur noch bei den
// fuenf Bauteilarten, bei denen er im Spiel etwas unterscheidet (Kraftwerk 71,
// Kuehler 70, Schild 62, Radar 55, Quantenantrieb 57 = 315). Zuvor trugen 1194
// Karten ein "Grade A", das nur der Vorgabewert aus AttachDef.Grade war —
// aufgefallen an einer Dominance-1 Scattergun. Siehe GRADE_BEARING_TYPES.
need(totalGrade === 315, `Grade: erwartet 315, gemessen ${totalGrade}`);
need(
  ['PowerPlant', 'Cooler', 'Shield', 'Radar', 'QuantumDrive'].every((t) => gradeBearingTypes.has(t)),
  `gradeBearingTypes deckt die fuenf Bauteilarten nicht ab: [${[...gradeBearingTypes].sort().join(', ')}]`,
);
need(
  !['WeaponGun', 'WeaponPersonal', 'Char_Armor_Helmet', 'Paints'].some((t) => gradeBearingTypes.has(t)),
  `gradeBearingTypes laesst eine Art mit konstantem Grade durch: [${[...gradeBearingTypes].sort().join(', ')}]`,
);
need(totalTone === 495, `Ton: erwartet 495, gemessen ${totalTone}`);
need(toneFromClass === 399, `Ton aus game.class: erwartet 399, gemessen ${toneFromClass}`);
need(toneFromPath === 96, `Ton aus dem Pfad: erwartet 96, gemessen ${toneFromPath}`);
need(totalNone === 81, `ohne jede Angabe: erwartet 81, gemessen ${totalNone}`);
need(totalWithSpec + totalNone === craftDb.blueprints.length, `Selbstkonsistenz: ${totalWithSpec} + ${totalNone} != ${craftDb.blueprints.length}`);

/* ---------- 9) Wertebereich Ton ---------- */
console.log('9) Wertebereich Ton …');
const VALID_TONES = new Set([
  'Ballistic', 'Civilian', 'Military', 'Industrial', 'Laser',
  'Stealth', 'Competition', 'Electron', 'Distortion',
]);
let toneRangeChecked = 0, toneRangeBad = 0;
const toneDist = {};
for (const b of craftDb.blueprints) {
  const sp = blueprintSpecs(b);
  if (!sp?.tone) continue;
  toneRangeChecked++;
  toneDist[sp.tone] = (toneDist[sp.tone] ?? 0) + 1;
  if (!VALID_TONES.has(sp.tone)) {
    toneRangeBad++;
    fail.push(`Wertebereich Ton: "${b.name}" hat unbekannten Ton "${sp.tone}"`);
  }
}
console.log(`   Ton geprueft: ${toneRangeChecked} | ausserhalb der bekannten 9 Werte: ${toneRangeBad}`);
console.log(`   Verteilung: ${Object.entries(toneDist).sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
need(toneRangeBad === 0, `${toneRangeBad} Toene ausserhalb der bekannten 9 Werte`);

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
