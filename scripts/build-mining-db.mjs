// build-mining-db.mjs — assembliert assets/mining-db.json (Mineral-DB für MiningApp)
// AUS DEN EIGENEN Extrakten, kein scmdb-Fetch. Quellen:
//   assets/mining-locations-gamefiles.json (Fundorte je Mineral + Bodies + Methoden)
//   assets/mining-gamefiles.json           (rarity je Erz)
//   assets/mining-frozen.json               (rarity-Fallback für Edelsteine)
//   assets/mining-db.json (PREV)            (kuratiert: code/kind/weight_scu)
// game_version aus dem Client-build_manifest.id.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_P4K } from './lib/p4k.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const A = resolve(__dirname, '..', 'assets');
const OUT = resolve(A, 'mining-db.json');
const rd = (n) => JSON.parse(readFileSync(resolve(A, n), 'utf8'));
const locs = rd('mining-locations-gamefiles.json');
const game = rd('mining-gamefiles.json');
const frozen = rd('mining-frozen.json');
const curated = rd('mining-curated.json'); // kuratierte Attribute (getrennt, wird NIE überschrieben)

const SYS_ORDER = ['Stanton', 'Pyro', 'Nyx'];
const RARITY_RANK = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
const METHOD_RANK = { ship: 0, roc: 1, hand: 2, fps: 2, harvest: 3 };
const SPACE_TYPES = new Set(['belt', 'cluster', 'lagrange']);
const KIND_FIX = { Minteral: 'Mineral', 'Man-made': 'Metal', 'Raw Materials': 'Mineral', Liquid: 'Ice' };
const LOC_POINTS = {
  'Lagrange A': ['HUR-L1', 'HUR-L4'], 'Lagrange B': ['ARC-L5', 'CRU-L4', 'MIC-L3'],
  'Lagrange C': ['HUR-L5', 'MIC-L1', 'MIC-L2', 'MIC-L5', 'CRU-L3'], 'Lagrange D': ['ARC-L3', 'CRU-L5', 'MIC-L4'],
  'Lagrange E': ['CRU-L1', 'CRU-L2', 'HUR-L3'], 'Lagrange F': ['HUR-L2', 'ARC-L1', 'ARC-L2', 'ARC-L4'],
  'Lagrange G': ['CRU-L5', 'MIC-L4'], 'Lagrange (Occupied)': ['CRU-L5', 'MIC-L4'],
};
const bySys = (a, b) => { const ia = SYS_ORDER.indexOf(a), ib = SYS_ORDER.indexOf(b); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || String(a).localeCompare(b); };

// rarity: primär game-sourced (Erz-Namensschema), Fallback frozen (Edelsteine)
const rarityByMat = {};
for (const e of game.elements || []) if (e.rarity && !(e.material in rarityByMat)) rarityByMat[e.material] = e.rarity;
for (const [mat, m] of Object.entries(frozen.elementMeta || {})) if (!rarityByMat[mat] && m.rarity) rarityByMat[mat] = m.rarity;

// game_version aus Client-Manifest
let game_version = (frozen.frozen_from || '').replace(/^scmdb\s+/, '');
const bm = resolve(dirname(DEFAULT_P4K), 'build_manifest.id');
if (existsSync(bm)) { try { const d = JSON.parse(readFileSync(bm, 'utf8')).Data; game_version = `${(d.Branch || '').replace(/^sc-alpha-/, '')}-live.${d.RequestedP4ChangeNum}`; } catch { /* Fallback */ } }

const prevByName = new Map(Object.entries(curated.minerals || {}));
const withPoints = (l) => (LOC_POINTS[l.location] ? { ...l, points: LOC_POINTS[l.location] } : l);

// Mineralliste = alle realen Elemente (dedup nach Material), damit auch Hand-Edelsteine
// ohne providerpreset-Fundort (Event-/Cave-Deposits) erhalten bleiben.
const locByMat = new Map((locs.elements || []).map((e) => [e.material, e]));
const seenMat = new Set();
const matList = [];
for (const e of game.elements || []) { if (!seenMat.has(e.material)) { seenMat.add(e.material); matList.push(e.material); } }
const minerals = matList.map((mat) => {
  const el = locByMat.get(mat) || { material: mat, methods: [], locations: [] };
  const methods = el.methods || [];
  const prevM = prevByName.get(mat) || {};
  const method = [...methods].sort((a, b) => (METHOD_RANK[a] ?? 9) - (METHOD_RANK[b] ?? 9))[0] || prevM.method || null;
  const systems = [...new Set((el.locations || []).map((l) => l.system))].sort(bySys);
  let kind = prevM.kind || ''; if (KIND_FIX[kind]) kind = KIND_FIX[kind];
  return {
    name: mat, code: prevM.code || null, kind: kind || null, weight_scu: prevM.weight_scu || null,
    method, methods, rarity: rarityByMat[mat] || null,
    needs_refine: method === 'ship',
    systems, locations: (el.locations || []).map(withPoints),
  };
}).filter((m) => m.code || m.kind || m.locations.length) // Phantome (weder kuratiert noch Fundort) raus
  .sort((a, b) => a.name.localeCompare(b.name));

const bodies = (locs.bodies || []).map((b) => {
  const mins = (b.minerals || []).map((m) => ({ ...m, rarity: rarityByMat[m.name] || null })).sort((x, y) => (y.chance - x.chance) || x.name.localeCompare(y.name));
  let best = null;
  for (const m of mins) { if (m.rarity == null) continue; const rank = RARITY_RANK[m.rarity] ?? 9; if (!best || rank < best.rank || (rank === best.rank && m.chance < best.chance)) best = { name: m.name, chance: m.chance, rarity: m.rarity, rank }; }
  return {
    system: b.system, body: b.body, type: b.type, space: SPACE_TYPES.has(b.type),
    points: LOC_POINTS[b.body] || null,
    methods: [...new Set(mins.map((m) => m.mining))],
    best: best ? { name: best.name, chance: best.chance, rarity: best.rarity } : null,
    minerals: mins.map((m) => ({ name: m.name, chance: m.chance, abundance: m.abundance, mining: m.mining, rarity: m.rarity })),
  };
}).sort((a, b) => bySys(a.system, b.system) || a.body.localeCompare(b.body));

const payload = {
  source: 'Star Citizen Data.p4k (Game2.dcb, DataCore v8) — eigene Extraktion, kein scmdb',
  source_url: 'https://verse-base.com/',
  source_note: `Game-akkurate Mining-Fakten direkt aus den Spieldateien (${game_version}): Abbaubarkeit, Fundorte, Abundance %, rarity. Keine Verkaufspreise — nur im Spiel verifizierbare Vorkommen. Planeten-Anzeigenamen kuratiert (Starmap). Patch-volatil.`,
  game_version, snapshot_date: frozen.snapshot_date,
  live_systems: [...new Set(minerals.flatMap((m) => m.systems))].sort(bySys),
  counts: { minerals: minerals.length, bodies: bodies.length },
  minerals, bodies,
};
writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
console.log(`mining-db.json: v${game_version} — ${minerals.length} Minerale, ${bodies.length} Bodies`);
console.log('  Methoden:', JSON.stringify(minerals.reduce((a, m) => ((a[m.method] = (a[m.method] || 0) + 1), a), {})));
console.log('  ohne rarity:', minerals.filter((m) => !m.rarity).map((m) => m.name).join(', ') || '—');
console.log('  ohne code/kind:', minerals.filter((m) => !m.code || !m.kind).map((m) => m.name).join(', ') || '—');
