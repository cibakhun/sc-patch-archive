// Build a GAME-ACCURATE mineral DB (patch 4.8.3) from scmdb datamined data.
// No prices (crowdsourced/volatile) — only facts verifiable against game files:
// which materials are mineable, by what method, where (real deposit regions +
// abundance %), and the reverse body->minerals index. Curated attributes (kind,
// refine, weight, code) are carried over from the previous db for the REAL
// materials only (phantom/non-mineable UEX commodities are dropped).
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] || 'G:/Projects/games/Star Citizen/sc-patch-archive/assets/mining-db.json';
const PREV = 'G:/Projects/games/Star Citizen/sc-patch-archive/assets/mining-db.json';
const H = { 'User-Agent': 'sc-patch-archiv fan site (non-commercial)', Accept: 'application/json' };
const BASE = 'https://scmdb.net/data';
const SNAP = process.env.SNAP_DATE || '2026-07-06';

const getJSON = async (u) => { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`); return r.json(); };

// clean material name: strip (Ore|Raw|Pure) suffix, unify spelling, merge Carinitepure
const cleanMat = (s) => {
  let x = String(s || '').replace(/\s*\((?:Ore|Raw|Pure)\)\s*$/i, '').trim();
  if (/^Aluminium$/i.test(x)) x = 'Aluminum';
  if (/^Carinitepure$/i.test(x)) x = 'Carinite';
  return x;
};
const MINING = { SpaceShip_Mineables: 'ship', SpaceShip_Mineables_Rare: 'ship', FPS_Mineables: 'hand', GroundVehicle_Mineables: 'roc', Harvestables: 'harvest' };
// space vs surface by location type
const SPACE_TYPES = new Set(['belt', 'cluster', 'lagrange']);
// method priority when a material appears in several groups
const METHOD_RANK = { ship: 0, roc: 1, hand: 2, harvest: 3 };

const versions = await getJSON(`${BASE}/versions.json`);
const live = versions.find((v) => /-live/i.test(v.version)) || versions[0];
const ver = live.version;
const data = await getJSON(`${BASE}/mining_data-${ver}.json`);

// rarity by clean material name (from mineableElements)
const rarityByMat = new Map();
for (const e of Object.values(data.mineableElements || {})) {
  const m = cleanMat(e.materialName || e.name);
  if (e.rarity) rarityByMat.set(m, e.rarity);
}

// aggregate: material -> best abundance per (system::location)
const matLoc = new Map();       // mat -> Map(key -> {location,system,type,mining,abundance})
const matMethods = new Map();   // mat -> Set(method)
const bodyMats = new Map();     // "system|location" -> {system,location,type, mats:Map(mat->ab)}
for (const loc of data.locations || []) {
  for (const g of loc.groups || []) {
    const mining = MINING[g.groupName];
    if (!mining) continue; // skip Salvage_* etc.
    for (const d of g.deposits || []) {
      const comp = data.compositions[d.compositionGuid];
      if (!comp?.parts) continue;
      for (const p of comp.parts) {
        const mat = cleanMat(p.elementName);
        if (!mat) continue;
        const ab = Math.round(p.maxPercent ?? 0);
        (matMethods.get(mat) || matMethods.set(mat, new Set()).get(mat)).add(mining);
        const lm = matLoc.get(mat) || matLoc.set(mat, new Map()).get(mat);
        const k = `${loc.system}::${loc.locationName}`;
        if (!lm.has(k) || lm.get(k).abundance < ab) lm.set(k, { location: loc.locationName, system: loc.system, type: loc.locationType, mining, abundance: ab });
        const bk = `${loc.system}|${loc.locationName}`;
        const bm = bodyMats.get(bk) || bodyMats.set(bk, { system: loc.system, location: loc.locationName, type: loc.locationType, mats: new Map() }).get(bk);
        if (!bm.mats.has(mat) || bm.mats.get(mat) < ab) bm.mats.set(mat, ab);
      }
    }
  }
}

// curated attrs from previous db (kind typo-fixed, weight, refine, code)
const prev = JSON.parse(readFileSync(PREV, 'utf8'));
const KIND_FIX = { Minteral: 'Mineral', 'Man-made': 'Metal', 'Raw Materials': 'Mineral', Liquid: 'Ice' };
const prevByName = new Map(prev.minerals.map((m) => [m.name, m]));

const SYS_ORDER = ['Stanton', 'Pyro', 'Nyx'];
const TYPE_PREF = { belt: 0, cluster: 1, lagrange: 2, planet: 3, moon: 4, cave: 5, event: 6, special: 7 };
const locSort = (a, b) => (b.abundance - a.abundance) || ((TYPE_PREF[a.type] ?? 9) - (TYPE_PREF[b.type] ?? 9)) || a.location.localeCompare(b.location);

const minerals = [...matLoc.keys()].sort().map((mat) => {
  const locs = [...matLoc.get(mat).values()].sort(locSort);
  const methods = matMethods.get(mat);
  const method = [...methods].sort((a, b) => METHOD_RANK[a] - METHOD_RANK[b])[0];
  const systems = [...new Set(locs.map((l) => l.system))].sort((a, b) => {
    const ia = SYS_ORDER.indexOf(a), ib = SYS_ORDER.indexOf(b);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b);
  });
  const prevM = prevByName.get(mat) || {};
  let kind = prevM.kind || '';
  if (KIND_FIX[kind]) kind = KIND_FIX[kind];
  // ship ores are refined; hand gems / roc / harvest sold whole
  const needs_refine = method === 'ship';
  return {
    name: mat,
    code: prevM.code || null,
    kind: kind || null,
    weight_scu: prevM.weight_scu || null,
    method,
    methods: [...methods],
    rarity: rarityByMat.get(mat) || null,
    needs_refine,
    systems,
    locations: locs, // array of {location,system,type,mining,abundance}
  };
});

// bodies (reverse index), grouped, sorted; only mining-relevant bodies
const bodies = [...bodyMats.values()]
  .map((b) => ({
    system: b.system,
    body: b.location,
    type: b.type,
    space: SPACE_TYPES.has(b.type),
    minerals: [...b.mats.keys()].sort(),
  }))
  .sort((a, b) => {
    const ia = SYS_ORDER.indexOf(a.system), ib = SYS_ORDER.indexOf(b.system);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.body.localeCompare(b.body);
  });

const payload = {
  source: 'scmdb.net (datamined CIG game files)',
  source_url: 'https://scmdb.net/',
  source_note: 'Game-akkurate Mining-Fakten aus den datamined 4.8.3-Spieldateien (Abbaubarkeit, Fundorte, Abundance %). Keine Verkaufspreise — nur im Spiel verifizierbare Vorkommen. Patch-volatil.',
  game_version: ver,
  snapshot_date: SNAP,
  live_systems: [...new Set(minerals.flatMap((m) => m.systems))].sort((a, b) => {
    const ia = SYS_ORDER.indexOf(a), ib = SYS_ORDER.indexOf(b);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b);
  }),
  counts: { minerals: minerals.length, bodies: bodies.length },
  minerals,
  bodies,
};

writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
console.log(`version ${ver}`);
console.log(`minerals ${minerals.length}, bodies ${bodies.length}`);
console.log('methods dist:', JSON.stringify(minerals.reduce((a, m) => ((a[m.method] = (a[m.method] || 0) + 1), a), {})));
console.log('kinds:', JSON.stringify([...new Set(minerals.map((m) => m.kind))]));
console.log('no-rarity materials:', minerals.filter((m) => !m.rarity).map((m) => m.name).join(', '));
console.log('sample (Quantainium):', JSON.stringify(minerals.find((m) => m.name === 'Quantainium'), null, 1));
