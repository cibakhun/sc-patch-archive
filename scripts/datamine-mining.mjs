// datamine-mining.mjs — 100% EIGENE Extraktion der Mining-Kernwerte DIREKT aus den
// Star-Citizen-Spieldateien, node-nativ ueber den DataCore-Reader (KEIN unp4k/unforge,
// KEIN scmdb). Liest Game2.dcb direkt aus der Data.p4k und baut Element-Physik +
// Kompositionen (die „bis X %"-Werte) + Global-Params. Optionaler 0-Diff-Check gegen
// LIVE-scmdb (gleicher Patch) beweist Game-Genauigkeit.
//
// Aufruf:
//   npm run datamine:mining                       (Default-p4k aus lib/p4k.mjs)
//   node scripts/datamine-mining.mjs [--p4k <Data.p4k>] [--verify]
//   SC_P4K=<pfad> node scripts/datamine-mining.mjs
// Ausgabe: assets/mining-gamefiles.json (Zwischenprodukt fuer build-mining-*.mjs).
import { writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'mining-gamefiles.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const VERIFY = argv.includes('--verify');

const norm = (s) => (s || '').replace(/\\/g, '/');
const gnorm = (g) => String(g || '').toLowerCase().replace(/[^0-9a-f]/g, '');
// DataCore speichert die GUID als zwei little-endian uint64 (rohe Bytefolge);
// scmdb/unforge zeigen den mixed-endian String → beide 8-Byte-Haelften byteweise
// umdrehen. z.B. roh 144028e4336c1dd66ae14d03060b2693 -> d61d6c33e428401493260b06034de16a
const toScmdbHex = (h) => { const b = gnorm(h).match(/../g); return b && b.length === 16 ? b.slice(0, 8).reverse().join('') + b.slice(8).reverse().join('') : gnorm(h); };
const SKIP = /template|testelement|testcomposition|testfps|flowstone|vlklimpet|_test\b|asteroid_ptype_test|_organic\b|_obstacle\b/i;
const cleanMat = (n) => { const m = { aluminium: 'Aluminum', sileron: 'Stileron', carinitepure: 'Carinite' }; n = String(n || '').toLowerCase(); return m[n] || (n.charAt(0).toUpperCase() + n.slice(1)); };
const matFromFile = (f) => cleanMat(basename(norm(f), '.xml').replace(/^minableelement_(fps|groundvehicle)_/, '').replace(/_(ore|raw)$/, ''));
const findKey = (o, key) => { let r; (function w(x) { if (r !== undefined || !x || typeof x !== 'object') return; if (key in x) { r = x[key]; return; } for (const v of Object.values(x)) w(v); })(o); return r; };
const RARITY_RANK = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
const rarityByMat = new Map();
const GROUND_SIG = 4000; // baseSignatureParams.signatures[4], in 4.9 durchgängig

/* ---- DataCore laden ---- */
const p4kPath = argOf('--p4k') ?? DEFAULT_P4K;
const t0 = Date.now();
const p4k = openP4k(p4kPath);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
p4k.close();
const db = openDataCore(dcb);
console.log(`DataCore v${db.version}: ${db.records.length} Records (${Date.now() - t0} ms) aus ${p4kPath}`);

/* ---- 1) mineableElements: guid -> {material, Physik} ---- */
const elemByGuid = new Map();
const elements = [];
for (const r of db.records) {
  if (db.structs[r.structIndex]?.name !== 'MineableElement') continue;
  if (!/mining\/mineableelements\//i.test(norm(r.fileName)) || SKIP.test(norm(r.fileName))) continue;
  const o = db.readRecord(r, { maxDepth: 3 });
  const e = {
    guid: gnorm(r.id),
    material: matFromFile(r.fileName),
    instability: o.elementInstability,
    resistance: o.elementResistance,
    optimalWindowMidpoint: o.elementOptimalWindowMidpoint,
    optimalWindowRandomness: o.elementOptimalWindowMidpointRandomness,
    optimalWindowThinness: o.elementOptimalWindowThinness,
    explosionMultiplier: o.elementExplosionMultiplier,
    clusterFactor: o.elementClusterFactor,
    _rtRef: o.resourceType?.__ref,
  };
  elemByGuid.set(e.guid, e);
  elements.push(e);
}

/* ---- 2) Kompositionen: guid + compositionArray ---- */
const compositions = [];
for (const r of db.records) {
  if (db.structs[r.structIndex]?.name !== 'MineableComposition') continue;
  if (!/mining\/rockcompositionpresets\//i.test(norm(r.fileName)) || SKIP.test(norm(r.fileName))) continue;
  // rarity je Element aus dem Kompositions-Namensschema (<rarity>shipmineables[asteroid]_<element>)
  const rm = /\/(legendary|epic|rare|uncommon|common)shipmineables(?:asteroid)?_([a-z0-9]+)\.xml$/i.exec(norm(r.fileName));
  if (rm) { const mat = cleanMat(rm[2]), rar = rm[1].toLowerCase(), cur = rarityByMat.get(mat); if (cur == null || RARITY_RANK[rar] < RARITY_RANK[cur]) rarityByMat.set(mat, rar); }
  const o = db.readRecord(r, { maxDepth: 4 });
  const parts = (o.compositionArray || []).map((p) => {
    const eg = gnorm(p.mineableElement?.__ref);
    return {
      elementGuid: eg,
      element: elemByGuid.get(eg)?.material ?? (p.mineableElement?.name ? matFromFile(p.mineableElement.name.split('.').pop()) : null),
      minPercent: p.minPercentage,
      maxPercent: p.maxPercentage,
      probability: p.probability,
      curveExponent: p.curveExponent,
      qualityScale: p.qualityScale,
    };
  });
  if (parts.length) compositions.push({ guid: gnorm(r.id), name: String(r.name || '').replace(/^MineableComposition\./, ''), file: norm(r.fileName).slice(norm(r.fileName).indexOf('libs')), parts });
}

/* ---- scanSignature je Erz: aus der element-spezifischen mineable-Rock-Entity
   (radarProperties.baseSignatureParams.signatures[4]); variiert pro Erz. Die
   GENERISCHEN Rocks (mineablerock.xml …) haben pauschal 4000 = groundScanSignature. ---- */
const sigByMat = new Map();
for (const r of db.records) {
  if (db.structs[r.structIndex]?.name !== 'EntityClassDefinition') continue;
  const m = /entities\/mineable\/.*\bmineablerock_[a-z0-9]+_([a-z0-9]+)\.xml$/i.exec(norm(r.fileName));
  if (!m || SKIP.test(norm(r.fileName))) continue;
  const mat = cleanMat(m[1]);
  const sig = findKey(db.readRecord(r, { maxDepth: 8, typed: true }), 'signatures');
  const val = Array.isArray(sig) ? sig.find((x) => x > 0) : null;
  if (val != null && !sigByMat.has(mat)) sigByMat.set(mat, val);
}

/* ---- qualityBands je Erz aus crafting/qualityquantization/quantization_<erz>.xml
   (mappedValue je Band); qualityBandBoundaries = band.start (global, uniform). ---- */
const qualByMat = new Map();
let qualityBandBoundaries = null;
for (const r of db.records) {
  const m = /crafting\/qualityquantization\/quantization_([a-z0-9]+)\.xml$/i.exec(norm(r.fileName));
  if (!m || /template/i.test(norm(r.fileName))) continue;
  const bands = findKey(db.readRecord(r, { maxDepth: 5 }), 'bands');
  if (!Array.isArray(bands) || !bands.length) continue;
  qualByMat.set(cleanMat(m[1]), bands.map((b) => b.mappedValue));
  if (!qualityBandBoundaries) qualityBandBoundaries = bands.map((b) => b.start);
}

/* ---- Anreicherung: density (resourceType.densityType), rarity (Namensschema), Signaturen ---- */
const rtCache = new Map();
const rtDensity = (ref) => { if (!ref) return null; if (rtCache.has(ref)) return rtCache.get(ref); const rr = db.recordById.get(ref); const d = rr ? (findKey(db.readRecord(rr, { maxDepth: 4 }), 'gramsPerCubicCentimeter') ?? null) : null; rtCache.set(ref, d); return d; };
for (const e of elements) {
  e.name = e.material;                         // = composition part.element (FracturingCalc-Lookup)
  e.density = rtDensity(e._rtRef);
  e.rarity = rarityByMat.get(e.material) ?? null;
  e.scanSignature = sigByMat.get(e.material) ?? null;
  e.groundScanSignature = GROUND_SIG;
  e.qualityBands = qualByMat.get(e.material) ?? null;
  delete e._rtRef;
}
const noRarity = elements.filter((e) => !e.rarity).map((e) => e.material);
const noDensity = elements.filter((e) => e.density == null).map((e) => e.material);
if (noRarity.length) console.log(`  (ohne rarity: ${noRarity.join(', ')})`);
if (noDensity.length) console.log(`  (ohne density: ${noDensity.join(', ')})`);

/* ---- 3) Global-Params (base + ship/fps/vehicle-Varianten fuer cSCUPerVolume etc.) ---- */
const flatNums = (o, out = {}) => { for (const [k, v] of Object.entries(o || {})) { if (typeof v === 'number') { if (!(k in out)) out[k] = v; } else if (v && typeof v === 'object' && !Array.isArray(v)) flatNums(v, out); } return out; };
const readParamsRec = (rx) => { const r = db.records.find((x) => rx.test(norm(x.fileName))); return r ? flatNums(db.readRecord(r, { maxDepth: 4 })) : {}; };
const pBase = readParamsRec(/mining\/miningglobalparams\.xml$/i);
const pShip = readParamsRec(/mining\/miningglobalparamsship\.xml$/i);
const pVeh = readParamsRec(/mining\/miningglobalparamsgroundvehicle\.xml$/i);
const pFps = readParamsRec(/mining\/miningglobalparamsfps\.xml$/i);
const WANT = ['powerCapacityPerMass', 'decayPerMass', 'optimalWindowSize', 'optimalWindowFactor', 'resistanceCurveFactor', 'optimalWindowThinnessCurveFactor', 'optimalWindowMaxSize', 'cSCUPerVolume', 'defaultMass', 'absorbableVolumeThreshold'];
const params = {};
for (const k of WANT) { for (const src of [pBase, pShip, pVeh, pFps]) { if (k in src) { params[k] = src[k]; break; } } }
const missing = WANT.filter((k) => !(k in params));
if (missing.length) console.log(`  (Params nicht in globalparams gefunden: ${missing.join(', ')} — evtl. per-Entity/Controller, in build-mining-model klaeren)`);

const payload = {
  source: 'Star Citizen Data.p4k -> Game2.dcb (DataCore v8, node-nativ) — eigene Extraktion, kein scmdb',
  p4k: p4kPath,
  counts: { elements: elements.length, compositions: compositions.length },
  params, qualityBandBoundaries, elements, compositions,
};
writeFileSync(OUT, JSON.stringify(payload, null, 1) + '\n', 'utf8');
console.log(`Eigen-Extrakt: ${elements.length} Elemente, ${compositions.length} Kompositionen, ${Object.keys(params).length}/${WANT.length} Params -> ${OUT}`);

/* ---- 4) optionaler 0-Diff-Check gegen LIVE-scmdb (gleicher Patch) ---- */
if (VERIFY) {
  const BASE = 'https://scmdb.net/data';
  const H = { 'User-Agent': 'sc-patch-archiv fan site (non-commercial)', Accept: 'application/json' };
  const getJSON = async (u) => { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`); return r.json(); };
  const versions = await getJSON(`${BASE}/versions.json`);
  const live = versions.find((v) => /-live/i.test(v.version));
  if (!live) { console.error('VERIFY: keine -live-Version bei scmdb'); process.exit(1); }
  console.log(`\nVERIFY gegen scmdb ${live.version} …`);
  const data = await getJSON(`${BASE}/mining_data-${live.version}.json`);
  const sElem = new Map(Object.entries(data.mineableElements || {}).map(([g, e]) => [gnorm(g), e]));
  const sComp = new Map(Object.entries(data.compositions || {}).map(([g, c]) => [gnorm(g), c]));
  const eq = (a, b) => (a == null && b == null) || Math.abs(Number(a) - Number(b)) < 1e-4;
  const fails = [];
  let ev = 0, cv = 0, eMatched = 0, cMatched = 0, eSkip = 0;
  for (const e of elements) {
    const s = sElem.get(toScmdbHex(e.guid)); if (!s) { eSkip++; continue; } // scmdb laesst Test-/Ungenutzte weg
    eMatched++;
    for (const k of ['instability', 'resistance', 'optimalWindowMidpoint', 'optimalWindowRandomness', 'optimalWindowThinness', 'explosionMultiplier', 'clusterFactor']) { ev++; if (!eq(e[k], s[k])) fails.push(`element ${e.material}.${k}: game=${e[k]} scmdb=${s[k]}`); }
    if (e.scanSignature != null && s.scanSignature != null) { ev++; if (!eq(e.scanSignature, s.scanSignature)) fails.push(`element ${e.material}.scanSignature: game=${e.scanSignature} scmdb=${s.scanSignature}`); }
    if (Array.isArray(e.qualityBands) && Array.isArray(s.qualityBands)) { ev++; if (JSON.stringify(e.qualityBands) !== JSON.stringify(s.qualityBands)) fails.push(`element ${e.material}.qualityBands: game=[${e.qualityBands}] scmdb=[${s.qualityBands}]`); }
  }
  for (const c of compositions) {
    const s = sComp.get(toScmdbHex(c.guid)); if (!s) continue; cMatched++;
    const sp = s.parts || [];
    for (let i = 0; i < c.parts.length; i++) {
      const g = c.parts[i], m = sp[i];
      if (!m) { fails.push(`comp ${c.name}[${i}]: fehlt in scmdb`); continue; }
      for (const k of ['minPercent', 'maxPercent', 'probability', 'curveExponent', 'qualityScale']) { cv++; if (!eq(g[k], m[k])) fails.push(`comp ${c.name}[${i}].${k}: game=${g[k]} scmdb=${m[k]}`); }
    }
  }
  console.log(`  Elemente ${eMatched}/${elements.length} gematcht (${ev} Werte, ${eSkip} nicht in scmdb), Kompositionen ${cMatched}/${compositions.length} gematcht (${cv} Werte)`);
  if (fails.length) { console.error(`FAIL (${fails.length}):\n` + fails.slice(0, 40).join('\n')); process.exit(1); }
  console.log('OK — eigene DataCore-Extraktion ist 0-Diff zu scmdb (Physik + alle %-Werte). Keine Annaeherung.');
}
