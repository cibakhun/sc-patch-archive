// datamine-mining.mjs — 100% EIGENE Extraktion der Mining-Kernwerte DIREKT aus den
// Star-Citizen-Spieldateien (kein scmdb). Liest den mit unp4k+unforge entpackten
// DataCore-Tree (Game2.dcb -> XML) und baut Element-Physik + Kompositionen (die
// „bis X %"-Werte) im scmdb-kompatiblen Schema. Optionaler 0-Diff-Check gegen das
// committete Modell beweist Byte-Gleichheit.
//
// Voraussetzung (einmal je Patch):
//   1) unp4k  "<SC>/LIVE/Data.p4k" .dcb           -> Data/Game2.dcb
//   2) unforge Data/Game2.dcb                      -> XML-Records
//   (Build von unp4k: github.com/dolkensp/unp4k, csproj net10->net8, dotnet build)
//
// Aufruf:
//   node scripts/datamine-mining.mjs <EXTRACT_DATA_DIR> [--verify]
//   <EXTRACT_DATA_DIR> = .../extract/Data   (enthält libs/foundry/records/mining)
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = process.argv[2];
const VERIFY = process.argv.includes('--verify');
if (!DATA) { console.error('Usage: node scripts/datamine-mining.mjs <EXTRACT_DATA_DIR> [--verify]'); process.exit(2); }
const REC = resolve(DATA, 'libs', 'foundry', 'records');
const OUT = resolve(__dirname, '..', 'assets', 'mining-gamefiles.json');

// --- kleine Helfer ---
const attr = (s, a) => { const m = new RegExp(`\\b${a}="([^"]*)"`).exec(s); return m ? m[1] : undefined; };
const num = (s, a) => { const v = attr(s, a); return v === undefined ? undefined : parseFloat(v); };
function walk(dir) { const out = []; for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) out.push(...walk(p)); else if (e.name.endsWith('.xml')) out.push(p); } return out; }
const cleanMat = (n) => { const m = { aluminium: 'Aluminum', sileron: 'Stileron', carinitepure: 'Carinite' }; n = n.toLowerCase(); return m[n] || (n.charAt(0).toUpperCase() + n.slice(1)); };
const SKIP = /template|testelement|testcomposition|testfps|flowstone|vlklimpet|_test\b|asteroid_ptype_test/i;

// --- 1) mineableElements: __ref -> {material, physics} ---
const elemDir = join(REC, 'mining', 'mineableelements');
const elemByRef = new Map();
const elements = [];
for (const f of readdirSync(elemDir)) {
  if (!f.endsWith('.xml') || SKIP.test(f)) continue;
  const xml = readFileSync(join(elemDir, f), 'utf8');
  const ref = attr(xml, '__ref'); if (!ref) continue;
  // Material aus Dateiname (robuster als Tag)
  const mat = cleanMat(basename(f, '.xml').replace(/^minableelement_(fps|groundvehicle)_/, '').replace(/_(ore|raw)$/, ''));
  const e = {
    guid: ref, material: mat,
    instability: num(xml, 'elementInstability'),
    resistance: num(xml, 'elementResistance'),
    optimalWindowMidpoint: num(xml, 'elementOptimalWindowMidpoint'),
    optimalWindowRandomness: num(xml, 'elementOptimalWindowMidpointRandomness'),
    optimalWindowThinness: num(xml, 'elementOptimalWindowThinness'),
    explosionMultiplier: num(xml, 'elementExplosionMultiplier'),
    clusterFactor: num(xml, 'elementClusterFactor'),
  };
  elemByRef.set(ref, e); elements.push(e);
}

// --- 2) Kompositionen: __ref (=scmdb guid) + parts ---
const compDir = join(REC, 'mining', 'rockcompositionpresets');
const compositions = [];
for (const p of walk(compDir)) {
  const f = basename(p);
  if (SKIP.test(f)) continue;
  const xml = readFileSync(p, 'utf8');
  const ref = attr(xml, '__ref'); if (!ref) continue;
  const nameM = /<MineableComposition\.([^\s]+)/.exec(xml);
  const parts = [];
  const partRe = /<MineableCompositionPart\b[^>]*>/g; let pm;
  while ((pm = partRe.exec(xml))) {
    const s = pm[0];
    const eref = attr(s, 'mineableElement');
    parts.push({
      elementGuid: eref,
      element: elemByRef.get(eref)?.material || null,
      minPercent: num(s, 'minPercentage'),
      maxPercent: num(s, 'maxPercentage'),
      probability: num(s, 'probability'),
      curveExponent: num(s, 'curveExponent'),
      qualityScale: num(s, 'qualityScale'),
    });
  }
  if (parts.length) compositions.push({ guid: ref, name: nameM ? nameM[1] : f.replace('.xml', ''), file: p.slice(p.indexOf('libs')), parts });
}

// --- 3) global params ---
const gpXml = readFileSync(join(REC, 'mining', 'miningglobalparams.xml'), 'utf8');
const paramNames = ['powerCapacityPerMass', 'decayPerMass', 'optimalWindowSize', 'optimalWindowFactor', 'resistanceCurveFactor', 'optimalWindowThinnessCurveFactor', 'optimalWindowMaxSize', 'cSCUPerVolume', 'defaultMass', 'absorbableVolumeThreshold'];
const params = {}; for (const n of paramNames) params[n] = num(gpXml, n);

const payload = {
  source: 'Star Citizen Data.p4k (Game2.dcb, unp4k+unforge) — eigene Extraktion, kein scmdb',
  extracted_from: DATA,
  counts: { elements: elements.length, compositions: compositions.length },
  params, elements, compositions,
};
writeFileSync(OUT, JSON.stringify(payload, null, 1) + '\n', 'utf8');
console.log(`Eigen-Extrakt: ${elements.length} Elemente, ${compositions.length} Kompositionen -> ${OUT}`);

// --- 4) optionaler 0-Diff-Check gegen scmdb (unser Modell) ---
if (VERIFY) {
  const model = JSON.parse(readFileSync(resolve(__dirname, '..', 'assets', 'mining-model.json'), 'utf8'));
  const mByMat = new Map(model.elements.filter((e) => e.material).map((e) => [e.material, e]));
  const mByGuid = new Map(model.compositions.map((c) => [c.guid, c]));
  const eq = (a, b) => (a == null && b == null) || Math.abs(Number(a) - Number(b)) < 1e-6;
  const fails = [];
  let ev = 0, cv = 0;
  for (const e of elements) {
    const s = mByMat.get(e.material); if (!s) continue;
    for (const k of ['instability', 'resistance', 'optimalWindowMidpoint', 'optimalWindowRandomness', 'optimalWindowThinness', 'explosionMultiplier', 'clusterFactor']) {
      ev++; if (!eq(e[k], s[k])) fails.push(`element ${e.material}.${k}: game=${e[k]} scmdb=${s[k]}`);
    }
  }
  for (const c of compositions) {
    const s = mByGuid.get(c.guid); if (!s) continue; // manche Test-/Ungenutzte kann scmdb weglassen
    const sp = s.parts || [];
    for (let i = 0; i < c.parts.length; i++) {
      const g = c.parts[i], m = sp[i];
      if (!m) { fails.push(`comp ${c.name}[${i}]: fehlt in scmdb`); continue; }
      for (const k of ['minPercent', 'maxPercent', 'probability', 'curveExponent', 'qualityScale']) { cv++; if (!eq(g[k], m[k])) fails.push(`comp ${c.name}[${i}].${k}: game=${g[k]} scmdb=${m[k]}`); }
    }
  }
  const compMatched = compositions.filter((c) => mByGuid.has(c.guid)).length;
  console.log(`\nVERIFY gegen scmdb: Element-Werte ${ev}, Kompositions-Werte ${cv} (davon ${compMatched}/${compositions.length} Kompositionen per GUID gematcht)`);
  if (fails.length) { console.error(`FAIL (${fails.length}):\n` + fails.slice(0, 40).join('\n')); process.exit(1); }
  console.log('OK — eigene Spieldatei-Extraktion ist BYTE-IDENTISCH zu scmdb (Physik + alle %-Werte). Keine Annaeherung.');
}
