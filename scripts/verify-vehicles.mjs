// Feld-für-Feld-Vergleich: Spieldaten-Katalog gegen den Wiki-Katalog.
//
// Der Katalog wird NICHT blind getauscht. Dieses Skript sagt je Feld, wie viele
// Fahrzeuge identisch sind, wo Werte fehlen und wo sie abweichen — Abweichungen
// mit Beispielen, damit jede einzelne beurteilt werden kann, bevor die Wiki
// abgeschaltet wird.
//
// Aufruf: node scripts/verify-vehicles.mjs [--field <name>] [--all]
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rd = (p) => JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', p), 'utf8'));
const argv = process.argv.slice(2);
const FIELD = argv.includes('--field') ? argv[argv.indexOf('--field') + 1] : null;
const ALL = argv.includes('--all');

const wiki = new Map(rd('vehicles.json').vehicles.map((v) => [v.id, v]));
const game = rd('vehicles-gamefiles.json').vehicles;

// Direkt vergleichbare Skalare. Links = Feld im Spiel-Katalog, rechts im Wiki-Katalog.
const SCALARS = [
  ['name', 'name'], ['manufacturer', 'manufacturer'], ['makerCode', 'makerCode'],
  ['sizeDe', 'sizeDe'], ['crewMin', 'crewMin'], ['crewMax', 'crewMax'], ['cargoSCU', 'cargoSCU'],
  ['scmSpeed', 'scmSpeed'], ['maxSpeed', 'maxSpeed'], ['boostForward', 'boostForward'],
  ['pitch', 'pitch'], ['yaw', 'yaw'], ['roll', 'roll'],
  ['hullHp', 'hullHp'], ['shieldHp', 'shieldHp'], ['qtSpeedMs', 'qtSpeedMs'],
  ['insClaimMin', 'insClaimMin'], ['insExpediteMin', 'insExpediteMin'], ['insExpediteCost', 'insExpediteCost'],
  ['cmLaunchers', 'cmLaunchers'],
];

const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= Math.max(0.05, Math.abs(b) * 0.005);
const rows = [];
for (const [gk, wk] of SCALARS) {
  if (FIELD && gk !== FIELD) continue;
  let same = 0, diff = [], missingGame = 0, missingWiki = 0;
  for (const g of game) {
    const w = wiki.get(g.id);
    if (!w) continue;
    const a = g[gk], b = w[wk];
    if (a == null && b == null) continue;
    if (a == null) { missingGame++; continue; }
    if (b == null) { missingWiki++; continue; }
    if (a === b || near(a, b)) same++;
    else diff.push(`${w.name}: Spiel ${JSON.stringify(a)} vs Wiki ${JSON.stringify(b)}`);
  }
  rows.push({ field: gk, same, diff, missingGame, missingWiki });
}

console.log(`Fahrzeuge: Spiel ${game.length} · Wiki ${wiki.size}\n`);
console.log('Feld                identisch  abweichend  fehlt(Spiel)  fehlt(Wiki)');
console.log('-'.repeat(72));
for (const r of rows)
  console.log(`${r.field.padEnd(20)}${String(r.same).padStart(9)}${String(r.diff.length).padStart(12)}${String(r.missingGame).padStart(14)}${String(r.missingWiki).padStart(13)}`);

for (const r of rows) {
  if (!r.diff.length) continue;
  console.log(`\n=== ${r.field}: ${r.diff.length} Abweichungen ===`);
  for (const d of (ALL || FIELD ? r.diff : r.diff.slice(0, 8))) console.log('  ' + d);
  if (!ALL && !FIELD && r.diff.length > 8) console.log(`  … ${r.diff.length - 8} weitere (--all)`);
}

// Bewaffnung: Waffenzahl je Schiff
let armSame = 0; const armDiff = [];
for (const g of game) {
  const w = wiki.get(g.id);
  if (!w) continue;
  const gn = g.fixedWeapons.reduce((n, x) => n + x.count, 0);
  const wn = (w.fixedWeapons ?? []).reduce((n, x) => n + x.count, 0);
  if (gn === wn) armSame++; else armDiff.push(`${w.name}: Spiel ${gn} vs Wiki ${wn} Pilotwaffen`);
}
console.log(`\n=== Pilotwaffen-Anzahl: ${armSame} identisch, ${armDiff.length} abweichend ===`);
for (const d of (ALL ? armDiff : armDiff.slice(0, 10))) console.log('  ' + d);

/* ------------------------------------------------------------------------ */
/* Deckungs-Waechter (01.4-01, Task 2, Schritt 5) — bleibender Riegel gegen  */
/* die stille Verkleinerung. Bisher verglich dieses Skript nur WERTE; ab     */
/* hier prueft es zusaetzlich die DECKUNG: fuer jedes Feld des Zielschemas   */
/* die Zahl der Fahrzeuge mit nicht-leerem Wert, Exit 1 sobald ein Feld      */
/* unter seine hinterlegte Untergrenze faellt.                              */
/*                                                                          */
/* Die Untergrenzen sind die am 03.08.2026 (01.4-01, Schritt 7) gemessene   */
/* Feldbelegung des frischen Katalogs (223 Fahrzeuge, Changelist 12326004), */
/* Feld fuer Feld gegen den Katalog vom 02.08.2026 abgeglichen — kein Feld  */
/* war dabei geschrumpft. Dieselbe Bauform wie der Schrumpf-Riegel in       */
/* build-universal-db.mjs (Phase 01.3).                                    */
/* ------------------------------------------------------------------------ */
const COVERAGE_FLOOR = {
  id: 223, name: 223, manufacturer: 223, makerCode: 223,
  typeEn: 223, typeDe: 223, roleEn: 223, roleDe: 223,
  sizeClass: 223, sizeDe: 223,
  descriptionEn: 219, descriptionDe: 219,
  // crewMin/crewMax (01.4-04, D-17): crewMin loest das alte Feld `crew` ab (223
  // gebaute Fahrzeuge + 4 ATLS-Uebernahmen = 227 moeglich, Floor bleibt bei der
  // alten, gemessenen Untergrenze 223 stehen). crewMax ist eingefroren
  // (vehicle-external.json, Plan 03) — 218 von 227 gemessen: 223 gebaute
  // Fahrzeuge minus 9 bewusst ausgelassene ruecklaeufige Spannen (600i Touring,
  // Idris-M/P, Ironclad, Starfarer, Starlancer TAC, MOLE, MOTH, ROC-DS) plus
  // 4 ATLS-Uebernahmen.
  crewMin: 223, crewMax: 218, isGravlev: 223, isSpaceship: 223,
  scmSpeed: 183, maxSpeed: 183, boostForward: 183,
  pitch: 183, yaw: 183, roll: 183,
  hullHp: 223, shieldHp: 208,
  qtSpeedMs: 176, qtSpoolS: 176,
  cargoSCU: 223,
  insClaimMin: 223, insExpediteMin: 223, insExpediteCost: 223,
  fixedWeapons: 175, fixedWeaponMounts: 132, turretWeapons: 83, missileRacks: 148,
  cmLaunchers: 223, components: 223,
};

const nonEmpty = (x) =>
  x != null &&
  !(Array.isArray(x) && !x.length) &&
  !(typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length);

const coverage = {};
for (const v of game)
  for (const [k, x] of Object.entries(v))
    if (nonEmpty(x)) coverage[k] = (coverage[k] ?? 0) + 1;

console.log(`\n=== Deckungs-Waechter (Untergrenzen aus 01.4-01, Schritt 7) ===`);
const shrunk = [];
for (const [field, floor] of Object.entries(COVERAGE_FLOOR)) {
  const have = coverage[field] ?? 0;
  console.log(`  ${field.padEnd(18)}${String(have).padStart(4)} / ${String(floor).padStart(4)} erwartet`);
  if (have < floor) shrunk.push(`${field}: ${have} < ${floor}`);
}
if (shrunk.length) {
  console.error(`\n✗ ${shrunk.length} Feld(er) unter der Deckungs-Untergrenze — stille Verkleinerung:`);
  for (const s of shrunk) console.error(`   ${s}`);
  process.exit(1);
}
console.log('✓ keine Feld-Deckung unter der gemessenen Untergrenze');
