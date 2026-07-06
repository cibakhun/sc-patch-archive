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
// Guard: NUR die LIVE-Version nutzen (nie PTU). Lieber abbrechen als still PTU-
// Daten einbauen — der letzte gute Snapshot in assets/ bleibt dann erhalten.
const live = versions.find((v) => /-live/i.test(v.version));
if (!live) throw new Error(`Keine -live-Version bei scmdb (nur: ${versions.map((v) => v.version).join(', ')}). Abbruch — behalte letzten guten Snapshot.`);
const ver = live.version;
const data = await getJSON(`${BASE}/mining_data-${ver}.json`);

// rarity by clean material name (from mineableElements)
const rarityByMat = new Map();
for (const e of Object.values(data.mineableElements || {})) {
  const m = cleanMat(e.materialName || e.name);
  if (e.rarity) rarityByMat.set(m, e.rarity);
}

// Fundort-Ableitung EXAKT wie scmdb, PRIMÄR-basiert (je Rock-Typ das dominante
// Erz): chance = normierte relativeProbability je Mining-Gruppe (= scmdbs
// Location-%), abundance = maxPercent des primären Erzes. Ranking je Mineral nach
// eff = chance × abundance/100, Top-5/System. Bodies = voller Mineral-Mix je Ort.
const SYS_ORDER = ['Stanton', 'Pyro', 'Nyx'];
const TYPE_PREF = { belt: 0, cluster: 1, lagrange: 2, planet: 3, moon: 4, cave: 5, event: 6, special: 7 };
const RARITY_RANK = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
// Reale L-Punkt-Zuordnung der abstrakten Lagrange-Spawn-Profile. Aus den Stanton-
// Objekt-Containern (Data.p4k) abgeleitet; hier als kuratierte Map (deckt sich mit
// scmdb). Ein Profil wird an mehreren physischen L-Punkten verwendet.
const LOC_POINTS = {
  'Lagrange A': ['HUR-L1', 'HUR-L4'],
  'Lagrange B': ['ARC-L5', 'CRU-L4', 'MIC-L3'],
  'Lagrange C': ['HUR-L5', 'MIC-L1', 'MIC-L2', 'MIC-L5', 'CRU-L3'],
  'Lagrange D': ['ARC-L3', 'CRU-L5', 'MIC-L4'],
  'Lagrange E': ['CRU-L1', 'CRU-L2', 'HUR-L3'],
  'Lagrange F': ['HUR-L2', 'ARC-L1', 'ARC-L2', 'ARC-L4'],
  'Lagrange G': ['CRU-L5', 'MIC-L4'],
  'Lagrange (Occupied)': ['CRU-L5', 'MIC-L4'],
};
const locByMat = {};            // mat -> { locName -> {location,system,type,mining,abundance,chance,eff} }
const matMethods = new Map();   // mat -> Set(method)
const bodyFull = new Map();     // "system|location" -> {system, location, type, mats: Map(mat -> {chance,abundance,mining}) }
for (const loc of data.locations || []) {
  for (const g of loc.groups || []) {
    const mining = MINING[g.groupName];
    if (!mining) continue; // skip Salvage_* etc.
    const tot = (g.deposits || []).reduce((s, d) => s + (d.relativeProbability || 0), 0);
    if (!tot) continue;
    for (const d of g.deposits || []) {
      const comp = data.compositions[d.compositionGuid];
      if (!comp?.parts?.length) continue;
      // primäres Erz = Teil mit höchstem maxPercent (= das Ziel-Erz dieses Rock-Typs)
      let prim = comp.parts[0];
      for (const p of comp.parts) if ((p.maxPercent ?? 0) > (prim.maxPercent ?? 0)) prim = p;
      const mat = cleanMat(prim.elementName);
      if (!mat) continue;
      const chance = +(((d.relativeProbability || 0) / tot) * 100).toFixed(1); // = scmdbs Location-% (Fund-Chance je Gruppe)
      const abundance = Math.round(prim.maxPercent ?? 0);
      const eff = chance * ((prim.maxPercent ?? 100) / 100);
      (matMethods.get(mat) || matMethods.set(mat, new Set()).get(mat)).add(mining);
      (locByMat[mat] ??= {});
      const k = loc.locationName;
      if (!locByMat[mat][k] || locByMat[mat][k].eff < eff) {
        locByMat[mat][k] = { location: loc.locationName, system: loc.system, type: loc.locationType, mining, abundance, chance, eff };
      }
      const bk = `${loc.system}|${loc.locationName}`;
      const bf = bodyFull.get(bk) || bodyFull.set(bk, { system: loc.system, location: loc.locationName, type: loc.locationType, mats: new Map() }).get(bk);
      const cur = bf.mats.get(mat);
      if (!cur || cur.chance < chance) bf.mats.set(mat, { chance, abundance, mining });
    }
  }
}
const cmp = (a, b) => (b.eff - a.eff) || ((TYPE_PREF[a.type] ?? 9) - (TYPE_PREF[b.type] ?? 9)) || a.location.localeCompare(b.location);
const topLocs = (mat, nPerSys = 5) => {
  const all = Object.values(locByMat[mat] || {});
  const bySys = {};
  for (const x of all) (bySys[x.system] ??= []).push(x);
  const picked = [];
  for (const sys of Object.keys(bySys)) picked.push(...bySys[sys].sort(cmp).slice(0, nPerSys));
  return picked.sort(cmp).map((x) => ({ location: x.location, system: x.system, type: x.type, mining: x.mining, abundance: x.abundance, chance: x.chance, ...(LOC_POINTS[x.location] ? { points: LOC_POINTS[x.location] } : {}) }));
};

// curated attrs from previous db (kind typo-fixed, weight, refine, code)
const prev = JSON.parse(readFileSync(PREV, 'utf8'));
const KIND_FIX = { Minteral: 'Mineral', 'Man-made': 'Metal', 'Raw Materials': 'Mineral', Liquid: 'Ice' };
const prevByName = new Map(prev.minerals.map((m) => [m.name, m]));

const minerals = [...Object.keys(locByMat)].sort().map((mat) => {
  const locs = topLocs(mat);
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
    locations: locs, // array of {location,system,type,mining,abundance,chance}
  };
});

// Bodies = voller Mineral-Mix je Ort (wie scmdbs Location-Ansicht): je Erz die
// Fund-Chance (%) + Abundance; „best" = wertvollstes/seltenstes Erz am Ort.
const bodies = [...bodyFull.values()]
  .map((b) => {
    const mins = [...b.mats.entries()]
      .map(([name, v]) => ({ name, chance: v.chance, abundance: v.abundance, mining: v.mining, rarity: rarityByMat.get(name) || null }))
      .sort((x, y) => (y.chance - x.chance) || x.name.localeCompare(y.name));
    let best = null;
    for (const m of mins) {
      if (m.rarity == null) continue;
      const rank = RARITY_RANK[m.rarity] ?? 9;
      if (!best || rank < best.rank || (rank === best.rank && m.chance < best.chance)) best = { name: m.name, chance: m.chance, rarity: m.rarity, rank };
    }
    return {
      system: b.system, body: b.location, type: b.type, space: SPACE_TYPES.has(b.type),
      points: LOC_POINTS[b.location] || null,
      methods: [...new Set(mins.map((m) => m.mining))],
      best: best ? { name: best.name, chance: best.chance, rarity: best.rarity } : null,
      minerals: mins.map((m) => ({ name: m.name, chance: m.chance, abundance: m.abundance, mining: m.mining, rarity: m.rarity })),
    };
  })
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
