// verify-crafting-specs.mjs — Datengatter fuer Groesse/Grade/Ton auf den
// Crafting-Karten (Phase 08 / CRAFT-01..04). Prueft die 11 gleichnamigen
// Blueprint-Gruppen, die 57 SizeN-Quantumdrives als unabhaengige Gegenprobe
// des Namens-Joins, die Wertebereiche, die Abdeckung je Vehiclegear-Typ, den
// Schiffswaffen-Ton aus dem Kategorie-Pfad und die Gesamtabdeckung nach der
// Sperre ueber alle 1605 Blueprints, und seit dem 27.08.2026 zusaetzlich,
// dass gleichnamige Bauplaene in EINER Liste unterscheidbar beschriftet
// werden (Pruefblock 10, Register id 49).
//
// KEINE SPIEGELUNG MEHR (07.08.2026): dieses Skript prueft die ECHTEN
// Funktionen aus src/lib/crafting.ts und src/lib/items.ts. Frueher stand hier
// eine handgepflegte Kopie von blueprintSpecs()/COLLIDING_NAMES/
// hasGradeSemantics — Node's TypeScript-Unterstuetzung loest die
// extensionlosen relativen Importe (`from './items'`) nicht auf, ein blosser
// import() scheitert mit "Cannot find module './items'". Die Kopie musste
// deshalb bei jeder Aenderung von Hand nachgezogen werden, und genau das ging
// an einem Tag zweimal beinahe schief. Loesung: die Quelle wird mit esbuild
// gebuendelt und importiert. Aendert sich die Logik, prueft das Gatter sie
// automatisch mit.
//
// Pruefblock 3 (die 11 Namensgruppen) vergleicht weiterhin bewusst NICHT
// gegen das Ergebnis der echten Funktion — das waere zirkulaer —, sondern
// gegen eine hier neu berechnete Diskriminante (item_stats-Signatur).
//
// Aufruf: node scripts/verify-crafting-specs.mjs   (npm run verify:crafting)
// Exit 0 = alle Pruefungen unauffaellig, Exit 1 = mindestens ein Befund.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const craftDb = JSON.parse(readFileSync(resolve(ROOT, 'assets', 'crafting-db.json'), 'utf8'));
const itemsDb = JSON.parse(readFileSync(resolve(ROOT, 'assets', 'universal-items.json'), 'utf8'));
const items = itemsDb.items;

const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };

/* ---------- Die echte Quelle laden (kein Nachbau) ---------- */

const tmp = mkdtempSync(join(tmpdir(), 'verify-crafting-'));
let src;
try {
  const esbuild = await import('esbuild');
  await esbuild.build({
    stdin: {
      contents:
        "export * as craft from './src/lib/crafting.ts';\n" +
        "export * as itemlib from './src/lib/items.ts';\n",
      resolveDir: ROOT,
      sourcefile: 'verify-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: join(tmp, 'src.mjs'),
    loader: { '.json': 'json' },
    logLevel: 'silent',
  });
  src = await import(pathToFileURL(join(tmp, 'src.mjs')).href);
} catch (err) {
  console.error('FEHLER: src/lib/crafting.ts liess sich nicht buendeln — das Gatter kann die echte Logik nicht pruefen.');
  console.error(String(err && err.message ? err.message : err));
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}

const { blueprintSpecs, COLLIDING_NAMES, toneFromWeaponCategoryPath, resolvedByGuid, blueprintListLabels } = src.craft;
const { GRADE_BEARING_TYPES, hasGradeSemantics, rootCategory } = src.itemlib;
const itemByName = new Map(items.map((i) => [i.name.toLowerCase(), i]));
const collidingNames = COLLIDING_NAMES;
const gradeBearingTypes = GRADE_BEARING_TYPES;

/** Schluesselsortierte Serialisierung — die UNABHAENGIGE Diskriminante fuer
 *  Pruefblock 3. Bewusst hier neu geschrieben und nicht importiert: sie soll
 *  das Ergebnis der echten Sperre pruefen, nicht daraus folgen. */
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
  if (!sp || sp.sizes.length !== 1 || sp.sizes[0] !== size || sp.grade !== grade || sp.tone !== tone) {
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
  if (!sp || !sp.sizes.includes(expected)) {
    sizeNBad++;
    console.log(`   ABWEICHUNG: ${b.name} Kategorie-Groesse ${expected} != gejointe Groessen [${sp?.sizes?.join(', ') ?? '-'}]`);
  }
}
console.log(`   geprueft: ${sizeNChecked} | abweichend: ${sizeNBad}`);
need(sizeNChecked === 57, `SizeN-Gegenprobe: erwartet 57 geprueft, gemessen ${sizeNChecked}`);
need(sizeNBad === 0, `SizeN-Gegenprobe: ${sizeNBad} Abweichungen`);

/* ---------- 3) Die 11 gleichnamigen Blueprints ---------- */
// 4.10-Datenlauf 27.08.2026: 15 -> 13 Namensgruppen, 5 -> 4 kollidierende.
// `antium core jet` ist herausgefallen — die beiden gleichnamigen Baupläne
// führen in 4.10 identische item_stats, sind also keine nachweislich
// verschiedenen Items mehr. Das ist eine ECHTE Aenderung der Spieldaten, keine
// Messschwankung: die Sperre COLLIDING_NAMES leitet sich bei jedem Build aus
// den Daten ab und hat die Gruppe deshalb von selbst freigegeben.
console.log('3) Die 11 gleichnamigen Blueprints — Diskriminante item_stats …');
const EXPECTED_COLLIDING = ['broadspec', 'main powerplant', 'serac', 'stellate'].sort();

const dupGroups = [...byName.entries()].filter(([, list]) => list.length > 1);
let groupsCollidingMeasured = 0, groupsCollidingCards = 0, groupsUnauffaellig = 0;
let overheatOnlyDiffering = 0;
let guidResolvedCards = 0, nameOnlyCards = 0;
const collisionFindings = [];

for (const [name, list] of dupGroups) {
  const sigs = new Set(list.map((b) => stableStringify(b.item_stats ?? null)));
  const isColliding = sigs.size > 1;

  const overheatVals = new Set(list.map((b) => b.item_stats?.overheat_temperature ?? null));
  if (overheatVals.size > 1) overheatOnlyDiffering++;

  if (isColliding) {
    groupsCollidingMeasured++;
    groupsCollidingCards += list.length;
    // Seit dem guid-Join gilt fuer eine kollidierende Gruppe: wer seine
    // entity_guid im Katalog trifft, ist zweifelsfrei bestimmt und DARF seine
    // Kennwerte zeigen. Wer nur ueber den Namen gefunden wuerde, MUSS leer
    // bleiben — dort waere es geraten.
    for (const b of list) {
      const sp = blueprintSpecs(b);
      if (resolvedByGuid(b)) {
        guidResolvedCards++;
        if (sp === null) collisionFindings.push(`EINDEUTIGE KARTE OHNE KENNWERTE: "${b.name}" (${b.category}) trifft seine guid, liefert aber null`);
      } else {
        nameOnlyCards++;
        if (sp !== null) collisionFindings.push(`GERATEN: "${b.name}" (${b.category}) wurde nur ueber den Namen gefunden, liefert aber ${JSON.stringify(sp)} statt null`);
      }
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
console.log(`   per entity_guid eindeutig bestimmt: ${guidResolvedCards} Karten (zeigen Kennwerte) | nur per Name auffindbar: ${nameOnlyCards} (bleiben leer)`);
console.log(`   Selbstprobe: ein Vergleich nur ueber overheat_temperature faende ${overheatOnlyDiffering} von ${groupsCollidingMeasured} Gruppen — Hinweis, damit der Vergleich nie auf dieses eine Feld verschlankt wird.`);
// Alle Karten der Kollisionsgruppen sind seit den guidAliases/Varianten-Ids
// eindeutig bestimmt. Faellt das je zurueck, ist ein Schluessel verloren
// gegangen — dann zeigt die Seite wieder weniger, als sie belegen koennte.
// 10 -> 8 im 4.10-Lauf, weil die Gruppe `antium core jet` (2 Karten) nicht
// mehr kollidiert; nameOnlyCards bleibt bei 0, es ist kein Schluessel verloren.
need(guidResolvedCards === 8, `per guid bestimmte Kollisionskarten: erwartet 8, gemessen ${guidResolvedCards}`);
need(nameOnlyCards === 0, `nur per Name auffindbare Kollisionskarten: erwartet 0, gemessen ${nameOnlyCards}`);

// Alle vier Zahlen 4.10-Datenlauf 27.08.2026, gemessen an 1.605 Bauplaenen
// (vorher 1.594). Die Gruppenzahl SINKT, obwohl der Bestand waechst — 4.10 hat
// gleichnamige Doubletten aufgeloest, nicht neue erzeugt.
need(dupGroups.length === 11, `Namensgruppen: erwartet 11, gemessen ${dupGroups.length}`);
need(groupsCollidingMeasured === 4, `kollidierende Gruppen: erwartet 4, gemessen ${groupsCollidingMeasured}`);
need(groupsCollidingCards === 8, `gesperrte Karten: erwartet 8, gemessen ${groupsCollidingCards}`);
need(groupsUnauffaellig === 7, `unauffaellige Gruppen: erwartet 7, gemessen ${groupsUnauffaellig}`);
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
  for (const sz of sp.sizes) {
    sizeChecked++;
    if (!(Number.isInteger(sz) && sz >= 0 && sz <= 12)) { sizeBad++; fail.push(`Wertebereich Groesse: "${b.name}" hat ${sz}`); }
  }
}
console.log(`   Grade geprueft: ${gradeChecked} | ausserhalb A-D: ${gradeBad}`);
console.log(`   Groesse geprueft: ${sizeChecked} | ausserhalb 0-12: ${sizeBad}`);

/* ---------- 5) Ruestung ohne Ton ---------- */
console.log('5) Ruestung ohne Ton …');
const armourBps = craftDb.blueprints.filter((b) => rootCategory(b.category) === 'Armour');
let armourWithTone = 0;
for (const b of armourBps) {
  const sp = blueprintSpecs(b);
  if (sp?.tone != null) { armourWithTone++; fail.push(`Ruestung mit Ton: "${b.name}" liefert Ton "${sp.tone}" (D-05 verletzt)`); }
}
console.log(`   Armour-Blueprints geprueft: ${armourBps.length} | mit Ton: ${armourWithTone}`);
// 913 -> 916: drei neue Ruestungs-Bauplaene im 4.10-Datenlauf 27.08.2026.
need(armourBps.length === 916, `Armour-Blueprints: erwartet 916, gemessen ${armourBps.length}`);
need(armourWithTone === 0, `${armourWithTone} Armour-Blueprints mit Ton`);

/* ---------- 6) Abdeckung ---------- */
console.log('6) Abdeckung je Vehiclegear-Typ …');
// Cooler stand am 07.08.2026 kurzzeitig auf 70/70/69, weil "NightFall" aus
// assets/universal-items.json verschwunden war. Ursache war ein Fehlgriff der
// Kurznamen-Bereinigung (scripts/prune-short-name-stubs.mjs, Regel B): in der
// global.ini ist "NightFall" die Kurzform des *Nightfall Repeater*, gleichzeitig
// heisst aber ein eigenstaendiger Kuehler so. Die Regel entscheidet am Namen und
// loeschte den Kuehler mit. Eintrag wiederhergestellt, Regel um einen Schutz
// fuer Eintraege mit Spieldaten ergaenzt -> wieder 71/71/70.
// 4.10-Datenlauf 27.08.2026: Powerplant und Shield je -1, weil die
// Entdopplung in datamine-crafting.mjs genau dort je eine zeichengleiche
// Doublette entfernt hat (FullForce = Powerplant, Glacis = Shield).
const COVERAGE_EXPECTED = {
  Powerplant: { n: 74, leer: 0, size: 74, grade: 74, tone: 72 },
  Cooler: { n: 75, leer: 2, size: 73, grade: 73, tone: 72 },
  Shield: { n: 61, leer: 0, size: 61, grade: 61, tone: 60 },
  Radar: { n: 60, leer: 3, size: 57, grade: 57, tone: 57 },
  Quantumdrive: { n: 57, leer: 0, size: 57, grade: 57, tone: 56 },
};
for (const [type, exp] of Object.entries(COVERAGE_EXPECTED)) {
  const bps = craftDb.blueprints.filter((b) => b.category.includes('Vehiclegear') && b.category.includes(`/ ${type}`));
  // "leer" = die Karte zeigt keine Kennwerte, gefragt wird die ECHTE Funktion.
  // Frueher zaehlte dieser Block stattdessen die Namensliste und uebersprang
  // diese Karten — er waere blind dafuer gewesen, dass der guid-Join die
  // Haelfte der Kollisionen jetzt eindeutig aufloest.
  let leer = 0, size = 0, grade = 0, tone = 0;
  for (const b of bps) {
    const sp = blueprintSpecs(b);
    if (!sp) { leer++; continue; }
    if (sp.sizes.length) size++;
    if (sp.grade != null) grade++;
    if (sp.tone != null) tone++;
  }
  console.log(`   ${type}: n=${bps.length} ohne Kennwerte=${leer} Groesse=${size} Grade=${grade} Ton=${tone}`);
  need(bps.length === exp.n, `${type}: n erwartet ${exp.n}, gemessen ${bps.length}`);
  need(leer === exp.leer, `${type}: ohne Kennwerte erwartet ${exp.leer}, gemessen ${leer}`);
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
  if (sp.sizes.length) totalSize++;
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
// 1532 -> 1540 im 4.10-Datenlauf 27.08.2026 (1.605 statt 1.594 Bauplaene).
// ⚠ Diese Zahl haengt NICHT nur an crafting-db.json: sie wird ueber
// itemSizes() aus dem Item-Katalog abgeleitet. Ein Zwischenstand mitten im
// Datenlauf mass 1534 — erst nach `sync:items` stand sie bei 1542, nach der Entdopplung bei 1540. Diese
// Erwartungen also immer NACH dem vollstaendigen Lauf ablesen, nie zwischendrin.
need(totalWithSpec === 1540, `Chip-Reihen: erwartet 1540, gemessen ${totalWithSpec}`);
// 1513 statt 1510 seit dem 07.08.2026: die Crafting-Schicht leitet die Groesse
// nicht mehr selbst aus `g.size` ab, sondern nimmt `itemSizes()` aus items.ts.
// Damit tragen auch die mehrdeutigen Anzeigenamen ihre Groessen — GVSR
// Repeater "S2 / S10", Revenant Gatling "S3 / S4 / S6", Tarantula GT-870
// "S3 / S7 / S8". Die beiden BroadSpec-Karten bleiben gesperrt (Kollision),
// deshalb +3 und nicht +5.
need(totalSize === 1540, `Groesse: erwartet 1540, gemessen ${totalSize}`);
// 315 statt 1509 seit dem 07.08.2026: der Grade erscheint nur noch bei den
// fuenf Bauteilarten, bei denen er im Spiel etwas unterscheidet (Kraftwerk 71,
// Kuehler 70, Schild 62, Radar 55, Quantenantrieb 57 = 315). Zuvor trugen 1194
// Karten ein "Grade A", das nur der Vorgabewert aus AttachDef.Grade war —
// aufgefallen an einer Dominance-1 Scattergun. Siehe GRADE_BEARING_TYPES.
need(totalGrade === 322, `Grade: erwartet 322, gemessen ${totalGrade}`);
need(
  ['PowerPlant', 'Cooler', 'Shield', 'Radar', 'QuantumDrive'].every((t) => gradeBearingTypes.has(t)),
  `gradeBearingTypes deckt die fuenf Bauteilarten nicht ab: [${[...gradeBearingTypes].sort().join(', ')}]`,
);
need(
  !['WeaponGun', 'WeaponPersonal', 'Char_Armor_Helmet', 'Paints'].some((t) => gradeBearingTypes.has(t)),
  `gradeBearingTypes laesst eine Art mit konstantem Grade durch: [${[...gradeBearingTypes].sort().join(', ')}]`,
);
need(totalTone === 504, `Ton: erwartet 504, gemessen ${totalTone}`);
need(toneFromClass === 404, `Ton aus game.class: erwartet 404, gemessen ${toneFromClass}`);
need(toneFromPath === 100, `Ton aus dem Pfad: erwartet 100, gemessen ${toneFromPath}`);
// 62 -> 65 im 4.10-Datenlauf 27.08.2026. Zusammen mit 1540 Chip-Reihen ergibt
// das genau die 1.605 Bauplaene — die Selbstprobe eine Zeile tiefer haelt beide
// Zahlen aneinander, eine allein koennte still auseinanderlaufen.
need(totalNone === 65, `ohne jede Angabe: erwartet 65, gemessen ${totalNone}`);
need(totalWithSpec + totalNone === craftDb.blueprints.length, `Selbstkonsistenz: ${totalWithSpec} + ${totalNone} != ${craftDb.blueprints.length}`);

/* ---------- 10) Zwei gleiche Chips nebeneinander ---------- */
// Anlass: Register id 49 (27.08.2026). Die Bauplan-Liste der Missionsseite
// zeigte zweimal `BroadSpec`; beide Chips fuehrten auf verschiedene Seiten,
// waren aber zeichengleich beschriftet. Der Slug war eindeutig, die Beschrif-
// tung nicht.
//
// Geprueft wird die ECHTE Funktion aus src/lib/crafting.ts, gefuettert mit
// jeder gleichnamigen Gruppe des Bestands — das ist der schaerfste Fall, der
// in einer Liste auftreten kann. Kommen zwei gleiche Beschriftungen heraus,
// ist der Unterscheider unbrauchbar geworden (etwa weil ein Patch die Massen
// angeglichen hat) und die Seite raet wieder.
console.log('10) Gleichnamige Bauplaene tragen unterscheidbare Beschriftungen …');
// Dieselbe Menge wie in Pruefblock 3 — dort ist ihre Groesse zugesichert.
let gruppenGeprueft = 0;
// ⚠ Gegen list[0].name vergleichen, NICHT gegen den Map-Schluessel: byName ist
// kleingeschrieben, die Beschriftung traegt die echte Schreibweise. Der erste
// Anlauf verglich gegen den Schluessel und meldete elf Fehlalarme.
for (const [, list] of dupGroups) {
  const name = list[0].name;
  for (const lang of ['de', 'en']) {
    const labels = blueprintListLabels(list, lang);
    gruppenGeprueft++;
    if (new Set(labels).size !== labels.length)
      fail.push(`gleichnamige Gruppe "${name}" [${lang}]: Beschriftungen nicht unterscheidbar — [${labels.join(' | ')}]`);
    if (labels.some((l) => !l.startsWith(name)))
      fail.push(`gleichnamige Gruppe "${name}" [${lang}]: Beschriftung verliert den Namen — [${labels.join(' | ')}]`);
  }
}
// Gegenprobe: ein Name, der nur EINMAL vorkommt, darf keinen Zusatz bekommen.
const einzel = [...byName.values()].find((list) => list.length === 1);
if (einzel) {
  const l = blueprintListLabels(einzel, 'de');
  need(l.length === 1 && l[0] === einzel[0].name, `Einzelname "${einzel[0].name}" wurde veraendert zu "${l[0]}"`);
}
console.log(`   gleichnamige Gruppen: ${dupGroups.length} | Beschriftungssaetze geprueft: ${gruppenGeprueft} (je DE und EN) | Einzelname-Gegenprobe: 1`);

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
rmSync(tmp, { recursive: true, force: true });
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
