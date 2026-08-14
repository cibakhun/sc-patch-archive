// verify-mining.mjs — Integritäts-/Konsistenz-Check der committeten Mining-Daten
// (assets/mining-model.json + mining-db.json). Braucht WEDER scmdb NOCH die Data.p4k —
// prüft nur, dass die generierten Daten in sich stimmig sind und die UI nicht bricht.
// Für den game-genauen 0-Diff-Cross-Check gegen scmdb: `node scripts/datamine-*.mjs --verify`.
//
//   node scripts/verify-mining.mjs
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_P4K } from './lib/p4k.mjs';

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

// 8) Wachposten gegen interne Klassennamen (D-07): kein ausgelieferter Anzeigename
// darf dem Muster "nur Kleinbuchstaben, Ziffern, Unterstriche, mind. ein Unterstrich"
// folgen — genau die Form von z. B. mining_laser_shin_hofstede_s0.
const CLASS_NAME_RX = /^[a-z0-9]+(_[a-z0-9]+)+$/;
const NAME_GROUPS = [
  ['laser', model.lasers], ['module', model.modules], ['gadget', model.gadgets],
  ['element', model.elements], ['mineral', db.minerals],
];
for (const [kind, arr] of NAME_GROUPS) {
  for (const x of arr || []) {
    if (typeof x.name === 'string' && CLASS_NAME_RX.test(x.name)) {
      fail.push(`${kind} "${x.name}": interner Klassenname statt Anzeigename ausgeliefert (D-07)`);
    }
  }
}

// 9) Die beiden Sichten auf dieselbe Tatsache muessen deckungsgleich sein.
// mining-db haelt Fundorte doppelt: vorwaerts (minerals[].locations) und rueckwaerts
// (bodies[].minerals). Bis 08/2026 wurden beide getrennt aufgebaut und die Vorwaerts-
// sicht zusaetzlich auf Top-5 je System gekappt — es fehlten 248 von 521 Paaren, und
// 163 gemeinsame Paare trugen unterschiedliche Werte. Nichts hat das bemerkt, weil
// kein Test die beiden Sichten gegeneinander hielt. Dieser hier tut es.
{
  const fwd = new Map(), bwd = new Map();
  for (const m of db.minerals) for (const l of m.locations || []) fwd.set(`${m.name}||${l.location}`, l);
  for (const b of db.bodies) for (const e of b.minerals || []) bwd.set(`${e.name}||${b.body}`, e);

  const onlyFwd = [...fwd.keys()].filter((k) => !bwd.has(k));
  const onlyBwd = [...bwd.keys()].filter((k) => !fwd.has(k));
  for (const k of onlyFwd.slice(0, 5)) fail.push(`Paar nur in minerals[].locations, fehlt in bodies[]: ${k}`);
  if (onlyFwd.length > 5) fail.push(`… und ${onlyFwd.length - 5} weitere Paare nur in minerals[]`);
  for (const k of onlyBwd.slice(0, 5)) fail.push(`Paar nur in bodies[].minerals, fehlt in minerals[]: ${k}`);
  if (onlyBwd.length > 5) fail.push(`… und ${onlyBwd.length - 5} weitere Paare nur in bodies[]`);

  let valDiff = 0;
  for (const [k, a] of fwd) {
    const b = bwd.get(k); if (!b) continue;
    for (const f of ['chance', 'maxShare', 'eff', 'mining']) {
      if (a[f] !== b[f]) {
        if (valDiff < 5) fail.push(`Paar ${k}: ${f} weicht ab — minerals[]=${a[f]} bodies[]=${b[f]}`);
        valDiff++; break;
      }
    }
  }
  if (valDiff > 5) fail.push(`… und ${valDiff - 5} weitere Paare mit abweichenden Werten`);

  // 10) Wertebereiche. eff = Summe(chance_i * max_i)/100 kann per Definition weder
  // ueber die chance noch ueber den maxShare hinausgehen; ein Verstoss bedeutet
  // Doppelzaehlung in der Aggregation (gemessen: ein Element zweimal in derselben
  // Komposition trieb Daymar auf 104,3 %).
  for (const m of db.minerals) for (const l of m.locations || []) {
    const at = `${m.name} @ ${l.location}`;
    for (const f of ['chance', 'maxShare', 'eff']) {
      need(typeof l[f] === 'number', `${at}: ${f} fehlt oder ist keine Zahl`);
    }
    need(l.chance > 0 && l.chance <= 100, `${at}: chance ausserhalb (0..100] — ${l.chance}`);
    need(l.maxShare > 0 && l.maxShare <= 100, `${at}: maxShare ausserhalb (0..100] — ${l.maxShare}`);
    need(l.eff > 0 && l.eff <= 100, `${at}: eff ausserhalb (0..100] — ${l.eff}`);
    need(l.eff <= l.chance + 0.05, `${at}: eff (${l.eff}) > chance (${l.chance}) — Doppelzaehlung?`);
    need(l.eff <= l.maxShare + 0.05, `${at}: eff (${l.eff}) > maxShare (${l.maxShare}) — Doppelzaehlung?`);
    need(l.location && l.system && l.mining, `${at}: location/system/mining unvollstaendig`);
  }

  // 11) systems[] muss zu den Fundorten passen (sonst filtert die Werkbank ins Leere).
  for (const m of db.minerals) {
    const fromLoc = new Set((m.locations || []).map((l) => l.system));
    const declared = new Set(m.systems || []);
    for (const s of fromLoc) need(declared.has(s), `Mineral ${m.name}: Fundort in ${s}, aber systems[] fuehrt es nicht`);
    for (const s of declared) need(fromLoc.has(s), `Mineral ${m.name}: systems[] nennt ${s} ohne Fundort dort`);
  }
}

// 12) game_version gegen den installierten Client (best effort — verify:mining
// soll ausdruecklich ohne p4k/Netz funktionieren, siehe Kopfkommentar).
const bmPath = resolve(dirname(DEFAULT_P4K), 'build_manifest.id');
if (existsSync(bmPath)) {
  try {
    const d = JSON.parse(readFileSync(bmPath, 'utf8'))?.Data ?? {};
    const clientVersion = `${(d.Branch || '').replace(/^sc-alpha-/, '')}-live.${d.RequestedP4ChangeNum}`;
    need(model.game_version === clientVersion, `game_version (${model.game_version}) stimmt nicht mit dem installierten Client ueberein (${clientVersion})`);
  } catch {
    console.log('  (game_version-Abgleich uebersprungen: build_manifest.id nicht lesbar)');
  }
} else {
  console.log('  (game_version-Abgleich uebersprungen: keine lokale Spielinstallation gefunden)');
}

if (fail.length) { console.error(`FAIL (${fail.length}):\n` + fail.slice(0, 40).join('\n')); process.exit(1); }
console.log(`OK — Mining-Daten konsistent: ${model.elements.length} Elemente, ${model.compositions.length} Komp., ${usableLasers.length} Laser, ${db.minerals.length} Minerale, ${db.bodies.length} Bodies · ${db.game_version}`);
