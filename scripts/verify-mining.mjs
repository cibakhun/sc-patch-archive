// verify-mining.mjs — Integritäts-/Konsistenz-Check der committeten Mining-Daten
// (assets/mining-model.json + mining-db.json). Braucht WEDER scmdb NOCH die Data.p4k —
// prüft nur, dass die generierten Daten in sich stimmig sind und die UI nicht bricht.
// Für den game-genauen 0-Diff-Cross-Check gegen scmdb: `node scripts/datamine-*.mjs --verify`.
//
//   node scripts/verify-mining.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const A = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const rd = (n) => JSON.parse(readFileSync(resolve(A, n), 'utf8'));
const model = rd('mining-model.json');
const db = rd('mining-db.json');
const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };

// 1) FracturingCalc: jede Komposition-Part.element muss ein element.name sein
const elemNames = new Set(model.elements.map((e) => e.name));
for (const c of model.compositions) for (const p of c.parts || []) {
  if (p.element && !elemNames.has(p.element)) fail.push(`comp ${c.name}: part.element "${p.element}" hat kein passendes element.name`);
}
// 2) Element-Physik + density vollständig (FracturingCalc)
for (const e of model.elements) for (const k of ['resistance', 'instability', 'density', 'optimalWindowThinness']) {
  need(e[k] != null, `element ${e.name}: ${k} fehlt`);
}
// 3) Laser haben mining.dps (FracturingCalc-Filter !builtIn && mining.dps)
const usableLasers = model.lasers.filter((l) => !l.builtIn && l.mining?.dps);
need(usableLasers.length >= 8, `nur ${usableLasers.length} nutzbare Laser mit dps (erwartet ≥8)`);
// 4) params.ship + Refineries
for (const k of ['resistanceCurveFactor', 'decayPerMass', 'powerCapacityPerMass', 'cSCUPerVolume', 'optimalWindowSize']) need(model.params?.ship?.[k] != null, `params.ship.${k} fehlt`);
need((model.refineries || []).length > 0 && Object.keys(model.refineryProfiles || {}).length > 0, 'refineries/refineryProfiles fehlen');
// 5) DB-Minerale: name + method + kind
for (const m of db.minerals) { need(m.name, 'Mineral ohne name'); need(m.method, `Mineral ${m.name}: method fehlt`); need(m.kind, `Mineral ${m.name}: kind fehlt`); }
// 6) DB-Body-Minerale referenzieren existierende Minerale
const minNames = new Set(db.minerals.map((m) => m.name));
for (const b of db.bodies) for (const m of b.minerals || []) if (!minNames.has(m.name)) fail.push(`body ${b.body}: Mineral "${m.name}" nicht in minerals[]`);
// 7) game_version konsistent + gesetzt
need(model.game_version && db.game_version, 'game_version fehlt');
need(model.game_version === db.game_version, `game_version model(${model.game_version}) != db(${db.game_version})`);
need(!/4\.8/.test(model.game_version), `game_version ist noch 4.8: ${model.game_version}`);

if (fail.length) { console.error(`FAIL (${fail.length}):\n` + fail.slice(0, 40).join('\n')); process.exit(1); }
console.log(`OK — Mining-Daten konsistent: ${model.elements.length} Elemente, ${model.compositions.length} Komp., ${usableLasers.length} Laser, ${db.minerals.length} Minerale, ${db.bodies.length} Bodies · ${db.game_version}`);
