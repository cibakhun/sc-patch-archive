// Wächter für die Waffengrößen im Fahrzeug-Katalog.
//
// WARUM ES DEN GIBT: Anzeigenamen sind in Star Citizen nicht eindeutig. Vier
// verschiedene Items heißen "Revenant Gatling" (S3/S4/S6/S4), drei "Tarantula
// GT-870 Mark 3 Cannon" (S3/S7/S8). Jede Pipeline-Stufe, die einen Namen als
// Schlüssel benutzt, kann darum stillschweigend die falsche Größe einsetzen —
// genau das ist passiert und stand auf 15 Schiffen im Datenblatt.
//
// Der Wächter vergleicht vehicles.json Waffe für Waffe gegen das Stock-Loadout
// aus den Spieldateien (src/data/ship-loadouts.json) und geht bei Abweichung
// mit Exit-Code 1 raus. Er prüft dabei drei Dinge:
//   1. Größe je Waffe == Größe im Loadout desselben Schiffs
//   2. fixedWeaponSizes ist wirklich die Summe der fixedWeapons[].size
//   3. keine Waffe ist größer als der größte Hardpoint des Schiffs
//      (physikalisch unmöglich — schlägt an, bevor jemand die Zahl glaubt)
//
// Aufruf: node scripts/verify-weapon-sizes.mjs [--quiet]
import { readFile } from 'node:fs/promises';

const QUIET = process.argv.includes('--quiet');
const rd = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const snapshot = await rd('../src/data/vehicles.json');
const loadouts = await rd('../src/data/ship-loadouts.json');

const sizesByShip = new Map();
for (const [ship, ports] of Object.entries(loadouts.ships ?? {})) {
  const m = new Map();
  for (const items of Object.values(ports)) {
    for (const it of items) {
      if (it.cat !== 'weapon' || it.size == null || !it.name) continue;
      if (!m.has(it.name)) m.set(it.name, new Set());
      m.get(it.name).add(it.size);
    }
  }
  sizesByShip.set(ship, m);
}

const expand = (l) => { const o = []; for (const { size, count } of l ?? []) for (let i = 0; i < count; i++) o.push(size); return o; };
const errors = [];
const warnings = [];
let checkedShips = 0, checkedGuns = 0, unresolved = 0;

for (const v of snapshot.vehicles) {
  const guns = v.fixedWeapons ?? [];
  if (!guns.length) continue;
  checkedShips++;
  const truth = sizesByShip.get(v.id);

  // 1) je Waffe gegen das Loadout
  const flat = [];
  for (const w of guns) {
    checkedGuns++;
    if (w.size == null) { unresolved++; continue; }
    for (let i = 0; i < w.count; i++) flat.push(w.size);
    const real = truth?.get(w.name);
    if (!real) {
      warnings.push(`${v.name}: "${w.name}" (S${w.size}) steht nicht im Stock-Loadout`);
    } else if (!real.has(w.size)) {
      errors.push(`${v.name}: "${w.name}" ist S${w.size}, im Spiel S${[...real].sort().join('/S')}`);
    }
  }

  // 2) Aggregat == Summe der Einzelgrößen
  const agg = expand(v.fixedWeaponSizes).sort((a, b) => a - b).join(',');
  const own = flat.slice().sort((a, b) => a - b).join(',');
  if (agg !== own) errors.push(`${v.name}: fixedWeaponSizes [${agg}] != Summe der Waffen [${own}]`);

  // 3) Waffe größer als ihr Hardpoint
  const hp = expand(v.fixedWeaponMounts).sort((a, b) => b - a);
  const gs = flat.slice().sort((a, b) => b - a);
  if (hp.length && hp.length === gs.length && gs.some((s, i) => s > hp[i]))
    errors.push(`${v.name}: Waffen [${gs}] passen nicht in die Hardpoints [${hp}]`);
}

if (!QUIET) {
  console.log(`geprüft: ${checkedShips} bewaffnete Schiffe · ${checkedGuns} Waffeneinträge`);
  if (unresolved) console.log(`ohne Größe (ehrlich leer): ${unresolved}`);
  for (const w of warnings) console.log(`  Hinweis: ${w}`);
}
if (errors.length) {
  console.error(`\n✗ ${errors.length} Waffengrößen widersprechen den Spieldaten:`);
  for (const e of errors) console.error(`   ${e}`);
  console.error('\n  -> node scripts/datamine-ship-loadouts.mjs && node scripts/enrich-weapon-sizes.mjs');
  process.exit(1);
}
if (!QUIET) console.log('✓ alle Waffengrößen decken sich mit den Spieldaten');
