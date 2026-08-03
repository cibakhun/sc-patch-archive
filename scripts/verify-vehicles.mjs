// Feld-für-Feld-Vergleich: frischer Extraktionslauf gegen den committeten Katalog.
//
// STAND 01.4-05 (der Tausch): bis hierher verglich dieses Skript den
// Spieldaten-Katalog gegen den WIKI-Katalog, bevor Letzterer abgeschaltet
// wurde (D-16) — das war der Beweis, den D-14 forderte. Nach dem Tausch ist
// `src/data/vehicles.json` selbst der Spieldaten-Katalog; der sinnvolle
// Bezugspunkt für einen künftigen Patch-Tag-Lauf ist deshalb nicht mehr die
// Wiki, sondern der zuletzt COMMITTETE Stand — dieselbe Bauform (Feld-für-
// Feld, Abweichungen mit Beispielen, Deckungs-Wächter), nur der Vergleich
// zeigt jetzt, was ein frischer Lauf gegenüber dem committeten Katalog ändert.
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

const committed = new Map(rd('vehicles.json').vehicles.map((v) => [v.id, v]));
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
    const w = committed.get(g.id);
    if (!w) continue;
    const a = g[gk], b = w[wk];
    if (a == null && b == null) continue;
    if (a == null) { missingGame++; continue; }
    if (b == null) { missingWiki++; continue; }
    if (a === b || near(a, b)) same++;
    else diff.push(`${w.name}: frisch ${JSON.stringify(a)} vs committet ${JSON.stringify(b)}`);
  }
  rows.push({ field: gk, same, diff, missingGame, missingWiki });
}

console.log(`Fahrzeuge: frischer Lauf ${game.length} · committet ${committed.size}\n`);
console.log('Feld                identisch  abweichend  fehlt(frisch) fehlt(committet)');
console.log('-'.repeat(72));
for (const r of rows)
  console.log(`${r.field.padEnd(20)}${String(r.same).padStart(9)}${String(r.diff.length).padStart(12)}${String(r.missingGame).padStart(14)}${String(r.missingWiki).padStart(13)}`);

for (const r of rows) {
  if (!r.diff.length) continue;
  console.log(`\n=== ${r.field}: ${r.diff.length} Abweichungen ===`);
  for (const d of (ALL || FIELD ? r.diff : r.diff.slice(0, 8))) console.log('  ' + d);
  if (!ALL && !FIELD && r.diff.length > 8) console.log(`  … ${r.diff.length - 8} weitere (--all)`);
}

/* ------------------------------------------------------------------------ */
/* Akzeptierte Abweichungsklassen (01.4-04, Task 3): Felder, bei denen der   */
/* Spielwert bewusst vom Wiki-Wert abweicht — begruendet und benannt, nicht  */
/* stumm toleriert (T-01.4-14). Die vollstaendige Abweichungsliste bleibt    */
/* oben im normalen Feld-Bericht sichtbar — ein NEUES Fahrzeug mit derselben */
/* Abweichung faellt dort weiterhin auf. Hier steht nur die Einordnung,      */
/* warum die Zahl selbst kein offener Befund mehr ist.                      */
/* ------------------------------------------------------------------------ */
const ACCEPTED_DEVIATIONS = {
  hullHp: 'Wiki-Huellenwerte sind veraltet (D-09/D-10) — die Abweichungen sind '
    + 'unregelmaessig verteilt (kein gemeinsamer Faktor, anders als shieldHp), '
    + 'mit Veralterung vereinbar. Spielwert = Summe der Bauteil-Trefferpunkte '
    + 'ohne hardpoint_*-Teile — gegen den frischen Client (Changelist 12326004, '
    + '01.4-04) erneut belegt: Buccaneer 7980 bestaetigt, Regel trifft 191/223 '
    + 'Wiki-Werte gegen 182/223 fuer "alle Teile zaehlen" (scratch/probe-hullhp-rule.mjs).',
};
console.log(`\n=== Akzeptierte Abweichungsklassen (begruendet, nicht stumm toleriert) ===`);
for (const [field, reason] of Object.entries(ACCEPTED_DEVIATIONS)) {
  const r = rows.find((x) => x.field === field);
  const n = r?.diff.length ?? 0;
  console.log(`  ${field}: ${n} Fahrzeuge — ${reason}`);
}

// Bewaffnung: Waffenzahl je Schiff
let armSame = 0; const armDiff = [];
for (const g of game) {
  const w = committed.get(g.id);
  if (!w) continue;
  const gn = g.fixedWeapons.reduce((n, x) => n + x.count, 0);
  const wn = (w.fixedWeapons ?? []).reduce((n, x) => n + x.count, 0);
  if (gn === wn) armSame++; else armDiff.push(`${w.name}: frisch ${gn} vs committet ${wn} Pilotwaffen`);
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
  // pilotDps/turretDps (01.4-06, Gap 1): bisher NICHT im Riegel — genau
  // deshalb fiel der "alle-oder-nichts"-Rueckschritt (192 -> 162 bei
  // pilotDps) durch keinen automatisierten Waechter auf, nur durch die
  // manuelle Vorzustands-Pruefung des Phasen-Verifizierers. Untergrenzen sind
  // der NACH dem Teilsummen-Fix gemessene Ist-Stand (171/72 von 227) — ein
  // kuenftiger Rueckfall auf "alle-oder-nichts" wuerde sie sofort unterschreiten.
  pilotDps: 171, turretDps: 72,
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
