// datamine-locations.mjs — Fundort-Ebene 100% aus den Spieldateien, node-nativ ueber
// den DataCore-Reader (KEIN unp4k/unforge, KEIN scmdb). Kette:
//   HarvestableProviderPreset (Location) -> harvestables[].harvestable
//     -> HarvestablePreset.entityClass -> EntityClassDefinition(MineableRock)
//       -> Components[].composition -> MineableComposition.compositionArray -> element/max%
// Baut element->locations (eff-Ranking top-5/System) + scanSignature je Element.
//
// Aufruf: node scripts/datamine-locations.mjs [--p4k <Data.p4k>] [--verify]
// Ausgabe: assets/mining-locations-gamefiles.json (Zwischenprodukt fuer build-mining-db).
import { writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'mining-locations-gamefiles.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const VERIFY = argv.includes('--verify');

const norm = (s) => (s || '').replace(/\\/g, '/');
const gnorm = (g) => String(g || '').toLowerCase().replace(/[^0-9a-f]/g, '');
const cleanMat = (n) => { const m = { aluminium: 'Aluminum', sileron: 'Stileron', carinitepure: 'Carinite' }; n = String(n || '').toLowerCase(); return m[n] || (n.charAt(0).toUpperCase() + n.slice(1)); };
const matFromFile = (f) => cleanMat(basename(norm(f), '.xml').replace(/^minableelement_(fps|groundvehicle)_/, '').replace(/_(ore|raw)$/, ''));

const p4kPath = argOf('--p4k') ?? DEFAULT_P4K;
const t0 = Date.now();
const p4k = openP4k(p4kPath);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
p4k.close();
const db = openDataCore(dcb);
console.log(`DataCore v${db.version}: ${db.records.length} Records (${Date.now() - t0} ms)`);

/* ---- Indizes ---- */
const matByGuid = new Map();      // MineableElement.id -> material
const compByGuid = new Map();     // MineableComposition.id -> [{el, max}]
const hpresetEntity = new Map();  // HarvestablePreset.id -> entityClass.__ref
const entityComp = new Map();     // EntityClassDefinition(mineable).id -> composition.__ref
const SKIP = /template|test|flowstone|vlklimpet/i;

for (const r of db.records) {
  const sn = db.structs[r.structIndex]?.name;
  const f = norm(r.fileName);
  if (sn === 'MineableElement' && /mining\/mineableelements\//i.test(f)) {
    matByGuid.set(gnorm(r.id), matFromFile(r.fileName));
  } else if (sn === 'MineableComposition' && /mining\/rockcompositionpresets\//i.test(f)) {
    const o = db.readRecord(r, { maxDepth: 4 });
    compByGuid.set(gnorm(r.id), (o.compositionArray || []).map((p) => ({ el: gnorm(p.mineableElement?.__ref), max: p.maxPercentage })));
  } else if (sn === 'HarvestablePreset' && /harvestable\/harvestablepresets\//i.test(f)) {
    const o = db.readRecord(r, { maxDepth: 2 });
    if (o.entityClass?.__ref) hpresetEntity.set(gnorm(r.id), gnorm(o.entityClass.__ref));
  }
}
// mineable-Entities: composition-__ref tief im Components-Baum suchen
const deepComp = (x, seen = { v: null }) => { if (seen.v || !x || typeof x !== 'object') return seen.v; if (x.composition?.__ref) { seen.v = gnorm(x.composition.__ref); return seen.v; } for (const v of Object.values(x)) { deepComp(v, seen); if (seen.v) break; } return seen.v; };
for (const r of db.records) {
  if (db.structs[r.structIndex]?.name !== 'EntityClassDefinition' || !/entities\/mineable\//i.test(norm(r.fileName))) continue;
  if (SKIP.test(norm(r.fileName))) continue;
  const comp = deepComp(db.readRecord(r, { maxDepth: 8 }));
  if (comp) entityComp.set(gnorm(r.id), comp);
}
const resolveParts = (hRef) => { const ec = hpresetEntity.get(gnorm(hRef)); if (!ec) return null; const comp = entityComp.get(ec); return comp ? compByGuid.get(comp) : null; };
console.log(`  Indizes: ${matByGuid.size} Elemente, ${compByGuid.size} Kompositionen, ${hpresetEntity.size} Presets, ${entityComp.size} Rock-Entities`);

/* ---- Location-Namen (kuratiert, wie zuvor) ---- */
const MINING = { SpaceShip_Mineables: 'ship', SpaceShip_Mineables_Rare: 'ship', FPS_Mineables: 'fps', GroundVehicle_Mineables: 'roc', Harvestables: 'harvest' };
// Kuratierte hpp_-Preset -> Anzeigename (Starmap-Zuordnung; nicht rein im Mining-
// DataCore). Stanton nach SC-Kanon, Pyro-Monde per Fingerprint gegen die Alt-DB bestätigt.
const LOC_NAMES = {
  hpp_stanton1: 'Hurston', hpp_stanton1a: 'Arial', hpp_stanton1b: 'Aberdeen', hpp_stanton1c: 'Magda', hpp_stanton1d: 'Ita',
  hpp_stanton2a: 'Cellin', hpp_stanton2b: 'Daymar', hpp_stanton2c: 'Yela', hpp_stanton2c_belt: 'Yela Asteroid Belt',
  hpp_stanton3a: 'Lyria', hpp_stanton3b: 'Wala',
  hpp_stanton4: 'microTech', hpp_stanton4a: 'Calliope', hpp_stanton4b: 'Clio', hpp_stanton4c: 'Euterpe',
  hpp_pyro1: 'Pyro I', hpp_pyro2: 'Pyro II (Monox)', hpp_pyro3: 'Pyro III (Bloom)', hpp_pyro4: 'Pyro IV', hpp_pyro6: 'Pyro VI (Terminus)',
  hpp_pyro5a: 'Pyro V-a (Ignis)', hpp_pyro5b: 'Pyro V-b (Vatra)', hpp_pyro5c: 'Pyro V-c (Adir)', hpp_pyro5d: 'Pyro V-d (Fairo)', hpp_pyro5e: 'Pyro V-e (Fuego)', hpp_pyro5f: 'Pyro V-f (Vuur)',
};
function locName(recName, file) {
  let n = (recName || basename(file, '.xml')).replace(/^HarvestableProviderPreset\./, '');
  const raw = n; const low = n.toLowerCase();
  if (LOC_NAMES[low]) return LOC_NAMES[low];
  const M = { hpp_aaronhalo: 'Aaron Halo', asteroidcluster_low_yield: 'Asteroid Cluster (Low Yield)', asteroidcluster_medium_yield: 'Asteroid Cluster (Medium Yield)', hpp_lagrange_occupied: 'Lagrange (Occupied)', hpp_nyx_keegerbelt: 'Keeger Belt', hpp_nyx_glaciemring: 'Glaciem Ring', hpp_pyro_akirocluster: 'Akiro Cluster', hpp_pyro_deepspaceasteroids: 'Pyro Deep Space Asteroids' };
  if (M[low]) return M[low];
  let m;
  if ((m = /^hpp_lagrange_([a-g])$/.exec(low))) return 'Lagrange ' + m[1].toUpperCase();
  if ((m = /^hpp_pyro_warm0?(\d)$/.exec(low))) return 'Pyro Belt (Warm ' + m[1] + ')';
  if ((m = /^hpp_pyro_cool0?(\d)$/.exec(low))) return 'Pyro Belt (Cool ' + m[1] + ')';
  return raw;
}
const sysFromPath = (p) => (/[\\/]system[\\/](stanton|pyro|nyx)[\\/]/i.exec(p) || [])[1];
const typeFromPath = (p) => { if (/asteroidcluster/i.test(p)) return 'cluster'; if (/lagrange/i.test(p)) return 'lagrange'; if (/asteroidfield/i.test(p)) return 'belt'; return 'planet'; };

/* ---- Provider-Presets -> element -> Fundorte + Bodies (Reverse) + Methoden ---- */
const elemLoc = {}; let nLoc = 0;
const matMethods = {};              // material -> Set(mining)
const bodyFull = new Map();         // system|body -> {system, body, type, mats: Map(material -> {chance, abundance, mining})}
for (const r of db.records) {
  if (db.structs[r.structIndex]?.name !== 'HarvestableProviderPreset') continue;
  const f = norm(r.fileName);
  const sys = sysFromPath(f); if (!sys) continue;
  const system = { stanton: 'Stanton', pyro: 'Pyro', nyx: 'Nyx' }[sys];
  const name = locName(r.name, f);
  const rawLow = String(r.name || '').toLowerCase();
  const type = /_belt\b/.test(rawLow) ? 'belt' : /hpp_(?:stanton|pyro)\d+[a-z]/.test(rawLow) ? 'moon' : typeFromPath(f);
  nLoc++;
  const o = db.readRecord(r, { maxDepth: 4 });
  for (const g of o.harvestableGroups || []) {
    const mining = MINING[g.groupName]; if (!mining) continue;
    const els = (g.harvestables || []).map((h) => ({ h: gnorm(h.harvestable?.__ref), rp: h.relativeProbability || 0 })).filter((e) => e.h);
    const tot = els.reduce((s, e) => s + e.rp, 0); if (!tot) continue;
    for (const e of els) {
      const parts = resolveParts(e.h); if (!parts) continue;
      const depositPct = (e.rp / tot) * 100;
      for (const part of parts) {
        const mat = matByGuid.get(part.el); if (!mat) continue;
        const ab = Math.round(part.max); const chance = +depositPct.toFixed(1); const eff = depositPct * (part.max / 100);
        (matMethods[mat] ??= new Set()).add(mining);
        (elemLoc[mat] ??= new Map());
        const k = name + '|' + system;
        const cur = elemLoc[mat].get(k);
        if (!cur || cur.eff < eff) elemLoc[mat].set(k, { location: name, system, type, mining, abundance: ab, chance, eff });
        const bk = system + '|' + name;
        const bf = bodyFull.get(bk) || bodyFull.set(bk, { system, body: name, type, mats: new Map() }).get(bk);
        const bc = bf.mats.get(mat);
        if (!bc || bc.chance < chance) bf.mats.set(mat, { chance, abundance: ab, mining });
      }
    }
  }
}

const TYPE_PREF = { belt: 0, cluster: 1, lagrange: 2, planet: 3, moon: 4, cave: 5, event: 6, special: 7 };
const cmp = (a, b) => (b.eff - a.eff) || ((TYPE_PREF[a.type] ?? 9) - (TYPE_PREF[b.type] ?? 9)) || a.location.localeCompare(b.location);
function topLocs(mat) { const all = [...(elemLoc[mat]?.values() || [])]; const bySys = {}; for (const x of all) (bySys[x.system] ??= []).push(x); const out = []; for (const s of Object.keys(bySys)) out.push(...bySys[s].sort(cmp).slice(0, 5)); return out.sort(cmp).map((x) => ({ location: x.location, system: x.system, type: x.type, mining: x.mining, abundance: x.abundance, chance: x.chance })); }

const outMats = Object.keys(elemLoc).sort();
console.log(`Fundorte: ${nLoc} Provider-Presets, ${outMats.length} Elemente mit Fundorten`);

const bodies = [...bodyFull.values()].map((b) => ({ system: b.system, body: b.body, type: b.type, minerals: [...b.mats.entries()].map(([name, v]) => ({ name, chance: v.chance, abundance: v.abundance, mining: v.mining })) }));
const out = { source: 'Star Citizen Data.p4k -> Game2.dcb (DataCore v8, node-nativ) — eigene Extraktion, kein scmdb', chain: 'providerpreset -> harvestablepreset -> mineablerock -> composition -> element', counts: { locations: nLoc, elements: outMats.length, bodies: bodies.length }, elements: outMats.map((m) => ({ material: m, methods: [...(matMethods[m] || [])], locations: topLocs(m) })), bodies };
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`Geschrieben: ${OUT}`);

/* ---- Validierung gegen scmdb 4.9 (system+abundance-Multiset der Top-5/System) ---- */
if (VERIFY) {
  const BASE = 'https://scmdb.net/data';
  const H = { 'User-Agent': 'sc-patch-archiv fan site (non-commercial)', Accept: 'application/json' };
  const getJSON = async (u) => { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`); return r.json(); };
  const versions = await getJSON(`${BASE}/versions.json`);
  const live = versions.find((v) => /-live/i.test(v.version));
  const data = await getJSON(`${BASE}/mining_data-${live.version}.json`);
  console.log(`\nVERIFY gegen scmdb ${live.version} …`);
  // scmdb-Fundorte identisch ableiten (wie fetch-scmdb-model)
  const sLoc = {};
  for (const loc of data.locations || []) for (const grp of loc.groups || []) {
    const tot = (grp.deposits || []).reduce((s, d) => s + (d.relativeProbability || 0), 0); if (!tot) continue;
    for (const d of grp.deposits || []) { const comp = data.compositions[d.compositionGuid]; if (!comp?.parts) continue; const dp = (d.relativeProbability || 0) / tot * 100; for (const p of comp.parts) { const en = cleanMat(String(p.elementName || '').replace(/\s*\((?:Ore|Raw|Pure)\)\s*$/i, '').trim()); if (!en) continue; const eff = dp * ((p.maxPercent ?? 100) / 100); (sLoc[en] ??= {}); const k = loc.locationName; if (!sLoc[en][k] || sLoc[en][k].eff < eff) sLoc[en][k] = { system: loc.system, abundance: Math.round(p.maxPercent ?? 0), eff }; } }
  }
  const sTop = (en) => { const all = Object.values(sLoc[en] || {}); const bySys = {}; for (const x of all) (bySys[x.system] ??= []).push(x); const out = []; for (const s of Object.keys(bySys)) out.push(...bySys[s].sort((a, b) => b.eff - a.eff).slice(0, 5)); return out; };
  const sig = (arr) => arr.map((l) => `${l.system}:${l.abundance}`).sort().join(',');
  let ok = 0, diff = 0; const details = [];
  for (const m of outMats) {
    if (!sLoc[m]) continue;
    const a = sig(topLocs(m)), b = sig(sTop(m));
    if (a === b) ok++; else { diff++; if (details.length < 10) details.push(`  ${m}:\n    game : ${a}\n    scmdb: ${b}`); }
  }
  console.log(`  system+abundance-Multiset: OK ${ok}, abweichend ${diff}`);
  if (details.length) console.log(details.join('\n'));
}
