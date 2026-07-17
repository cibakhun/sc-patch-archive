// build-mining-model.mjs — assembliert assets/mining-model.json AUS DEN EIGENEN
// Extrakten (kein scmdb-Fetch mehr). Quellen:
//   assets/mining-gamefiles.json           (datamine-mining: Physik/Komp/Params/density/rarity)
//   assets/mining-locations-gamefiles.json (datamine-locations: Fundorte je Element)
//   assets/mining-gear-gamefiles.json       (datamine-gear: Laser/Module/Gadgets)
//   assets/mining-frozen.json               (freeze: scanSignature/qualityBands/refineries + Fallbacks)
// game_version aus dem Client-build_manifest.id (neben der Data.p4k).
//
// Aufruf: node scripts/build-mining-model.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_P4K } from './lib/p4k.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const A = resolve(__dirname, '..', 'assets');
const rd = (n) => JSON.parse(readFileSync(resolve(A, n), 'utf8'));
const game = rd('mining-gamefiles.json');
const locs = rd('mining-locations-gamefiles.json');
const gear = rd('mining-gear-gamefiles.json');
const frozen = rd('mining-frozen.json');

// game_version aus Client-Manifest (game-sourced)
let game_version = frozen.frozen_from.replace(/^scmdb\s+/, '');
const bm = resolve(dirname(DEFAULT_P4K), 'build_manifest.id');
if (existsSync(bm)) { try { const d = JSON.parse(readFileSync(bm, 'utf8')).Data; game_version = `${(d.Branch || '').replace(/^sc-alpha-/, '')}-live.${d.RequestedP4ChangeNum}`; } catch { /* Fallback bleibt */ } }

// GUID roh (DataCore-Bytefolge) -> scmdb/unforge mixed-endian dashed
const toHex = (h) => { const b = String(h).match(/../g); return b && b.length === 16 ? b.slice(0, 8).reverse().join('') + b.slice(8).reverse().join('') : String(h); };
const toDashed = (raw) => { const h = toHex(raw); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };

const locByMat = Object.fromEntries((locs.elements || []).map((e) => [e.material, e.locations]));
const meta = frozen.elementMeta || {};

// Elemente: nach Material deduplizieren, anreichern
const seen = new Set();
const elements = [];
for (const e of game.elements || []) {
  if (seen.has(e.material)) continue; seen.add(e.material);
  const m = meta[e.material] || {};
  elements.push({
    guid: toDashed(e.guid), name: e.material, material: e.material,
    density: e.density ?? m.density ?? null,
    instability: e.instability, resistance: e.resistance,
    optimalWindowMidpoint: e.optimalWindowMidpoint, optimalWindowRandomness: e.optimalWindowRandomness,
    optimalWindowThinness: e.optimalWindowThinness, explosionMultiplier: e.explosionMultiplier, clusterFactor: e.clusterFactor,
    rarity: e.rarity ?? m.rarity ?? null,
    scanSignature: e.scanSignature ?? m.scanSignature ?? null, groundScanSignature: e.groundScanSignature ?? null,
    qualityBands: e.qualityBands ?? m.qualityBands ?? null,
    locations: locByMat[e.material] || [],
  });
}
elements.sort((a, b) => a.name.localeCompare(b.name));

const compositions = (game.compositions || []).map((c) => ({
  guid: toDashed(c.guid), name: c.name,
  parts: (c.parts || []).map((p) => ({ element: p.element, elementGuid: toDashed(p.elementGuid), probability: p.probability, minPercent: p.minPercent, maxPercent: p.maxPercent, curveExponent: p.curveExponent, qualityScale: p.qualityScale })),
})).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

const params = { ship: { ...game.params, defaultVolume: game.params.defaultVolume ?? 5122.499 } };
const stripFile = (a) => a.map(({ file, ...rest }) => rest);

const payload = {
  source: 'Star Citizen Data.p4k (Game2.dcb, DataCore v8) — eigene Extraktion; nur Refinery-Yields, scanSignature, qualityBands + Edelstein-rarity als gelabelte Konstanten (siehe mining-frozen.json)',
  source_note: 'Game-akkurates Mining-Physik-Modell aus den eigenen Spieldateien. Formeln am Community-Solver verifiziert. Patch-volatil — ingame prüfen.',
  game_version, snapshot_date: frozen.snapshot_date,
  params, qualityBandBoundaries: game.qualityBandBoundaries ?? [0, 400, 600, 700, 800, 900, 950, 999],
  counts: { elements: elements.length, compositions: compositions.length, lasers: (gear.lasers || []).length, modules: (gear.modules || []).length, gadgets: (gear.gadgets || []).length, refineries: (frozen.refineries || []).length },
  elements, compositions,
  lasers: stripFile(gear.lasers || []), modules: stripFile(gear.modules || []), gadgets: stripFile(gear.gadgets || []),
  refineries: frozen.refineries || [], refineryProfiles: frozen.refineryProfiles || {},
};
writeFileSync(resolve(A, 'mining-model.json'), JSON.stringify(payload) + '\n', 'utf8');
console.log(`mining-model.json: v${game_version} — ${elements.length} Elemente, ${compositions.length} Komp., ${payload.counts.lasers} Laser, ${payload.counts.modules} Module, ${payload.counts.gadgets} Gadgets, ${payload.counts.refineries} Refineries`);
