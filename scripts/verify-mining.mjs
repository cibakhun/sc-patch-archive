// verify-mining.mjs — Frische-/Exaktheits-Check der Mining-Daten gegen LIVE scmdb.
// Zieht die datamined 4.8.x-Quelle neu, rechnet das Modell nach und prüft:
//   1) assets/mining-model.json  == Live-Ableitung  (0-Diff, game-genau)
//   2) assets/mining-db.json ship-Fundorte == Modell (Abschnitt 01 == 02)
// Exit 1 bei Abweichung. So kann kein „ungefährer" Wert unbemerkt reinrutschen.
//
//   node scripts/verify-mining.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const A = resolve(__dirname, '..', 'assets');
const BASE = 'https://scmdb.net/data';
const H = { 'User-Agent': 'sc-patch-archiv fan site (non-commercial)', Accept: 'application/json' };
const getJSON = async (u) => { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`); return r.json(); };
const norm = (o) => JSON.stringify(o);

const versions = await getJSON(`${BASE}/versions.json`);
const live = versions.find((v) => /-live/i.test(v.version));
if (!live) { console.error(`FAIL: keine -live-Version bei scmdb (${versions.map((v) => v.version).join(', ')})`); process.exit(1); }
const ver = live.version;
const data = await getJSON(`${BASE}/mining_data-${ver}.json`);

// --- Modell aus Live neu ableiten (identisch zu fetch-scmdb-model.mjs) ---
const MINING = { SpaceShip_Mineables: 'ship', SpaceShip_Mineables_Rare: 'ship', FPS_Mineables: 'fps', GroundVehicle_Mineables: 'roc', Harvestables: 'harvest' };
const TYPE_PREF = { belt: 0, cluster: 1, lagrange: 2, planet: 3, moon: 4, cave: 5, station: 6, event: 7, special: 8 };
const locByElem = {};
for (const loc of data.locations || []) for (const g of loc.groups || []) {
  const tot = (g.deposits || []).reduce((s, d) => s + (d.relativeProbability || 0), 0);
  const mining = MINING[g.groupName] || null;
  for (const d of g.deposits || []) {
    const comp = data.compositions[d.compositionGuid]; if (!comp?.parts) continue;
    const depositPct = tot > 0 ? ((d.relativeProbability || 0) / tot) * 100 : 0;
    for (const p of comp.parts) {
      const en = p.elementName; if (!en) continue;
      const eff = depositPct * ((p.maxPercent ?? 100) / 100);
      (locByElem[en] ??= {});
      const k = loc.locationName;
      if (!locByElem[en][k] || locByElem[en][k].eff < eff) locByElem[en][k] = { location: loc.locationName, system: loc.system, type: loc.locationType, mining, abundance: Math.round(p.maxPercent ?? 0), eff };
    }
  }
}
const cmp = (a, b) => (b.eff - a.eff) || ((TYPE_PREF[a.type] ?? 9) - (TYPE_PREF[b.type] ?? 9)) || a.location.localeCompare(b.location);
const topLocs = (en, n = 5) => {
  const bySys = {};
  for (const x of Object.values(locByElem[en] || {})) (bySys[x.system] ??= []).push(x);
  const picked = [];
  for (const s of Object.keys(bySys)) picked.push(...bySys[s].sort(cmp).slice(0, n));
  return picked.sort(cmp).map((x) => ({ location: x.location, system: x.system, type: x.type, mining: x.mining, abundance: x.abundance }));
};
const freshEl = Object.entries(data.mineableElements).map(([guid, e]) => ({
  guid, name: e.name, material: e.materialName, density: e.density, instability: e.instability, resistance: e.resistance,
  rarity: e.rarity, scanSignature: e.scanSignature, groundScanSignature: e.groundScanSignature,
  qualityBands: e.qualityBands, locations: topLocs(e.name),
}));

const model = JSON.parse(readFileSync(`${A}/mining-model.json`, 'utf8'));
const db = JSON.parse(readFileSync(`${A}/mining-db.json`, 'utf8'));
const fails = [];

// 1) model elements 0-diff (physics + signatures + locations)
if (model.source_version !== ver) fails.push(`model.source_version ${model.source_version} != live ${ver}`);
const mById = new Map(model.elements.map((e) => [e.guid, e]));
for (const fe of freshEl) {
  const ce = mById.get(fe.guid);
  if (!ce) { fails.push(`Element fehlt im Modell: ${fe.name}`); continue; }
  for (const k of ['density', 'instability', 'resistance', 'rarity', 'scanSignature', 'groundScanSignature']) {
    if (norm(ce[k]) !== norm(fe[k])) fails.push(`model ${fe.material}.${k}: ${norm(ce[k])} != live ${norm(fe[k])}`);
  }
  if (norm(ce.qualityBands) !== norm(fe.qualityBands)) fails.push(`model ${fe.material}.qualityBands drift`);
  if (norm(ce.locations) !== norm(fe.locations)) fails.push(`model ${fe.material}.locations drift`);
}

// 2) db ship-mineable locations == model locations (Abschnitt 01 == 02)
const modelByMat = new Map(model.elements.filter((e) => e.material).map((e) => [e.material, e]));
for (const m of db.minerals) {
  const e = modelByMat.get(m.name); if (!e) continue;
  const sig = (arr) => (arr || []).map((l) => `${l.location}|${l.system}|${l.abundance}`).join(';');
  if (sig(m.locations) !== sig(e.locations)) fails.push(`db ${m.name}: Fundorte weichen vom Modell ab`);
}

console.log(`Live: ${ver} | Modell-Elemente: ${model.elements.length} | DB-Minerale: ${db.minerals.length}`);
if (fails.length) { console.error(`\nFAIL (${fails.length}):\n` + fails.slice(0, 40).join('\n')); process.exit(1); }
console.log('OK — Mining-Daten sind 0-Diff-genau zu LIVE scmdb (game-akkurat, keine Annäherung).');
