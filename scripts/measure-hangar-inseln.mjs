/* ============================================================
   measure-hangar-inseln.mjs — Lose Teile am Rumpf

   Anlass: Krisz, 30.10.2026: „jedes schiff soll komplett angeschaut
   werden, innen und aussen“. Beim Ansehen aller Rümpfe fielen Teile auf,
   die frei in der Luft hängen: die Flügelwaffen der Hornets gut einen
   Meter neben der Flügelspitze, ein Feuerlöscherschrank über dem
   Avenger, kleine Teile unter 300i/315p/325a/350r und eines 32 m neben
   der 325a. Notiz: .planning/notes/hangar-inseln.md.

   Rechnung: Alle Dreiecke werden gerastert (Voxel 0,5 m, bei großen
   Schiffen gröber). Zellen, die höchstens GAP (1 m) auseinanderliegen,
   gehören zusammen. Der größte Verbund ist der Rumpf; jeder andere ist
   eine Insel. Gemeldet wird eine Insel, wenn sie außerhalb des
   Hüllquaders des Rumpfs liegt. Inseln im Rumpf (Kraftwerke, Kühler,
   Relais in ihren Schächten) sind gewollt und zählen nur mit
   --alle-inseln.

   Werkzeug (gate-registry: rail null):

     node scripts/measure-hangar-inseln.mjs [slug ...|all] [--json datei] [--alle-inseln]
       Web-Fassung: public/hangar/ships/<slug>.glb (all = alle Schiffe im Manifest)
     node scripts/measure-hangar-inseln.mjs --roh <rohexport.glb> [--mit-ausgeblendet] [--json datei]
       Rohexport (PC): Rumpf = alles außer den Containern interior_* (ohne
       Schild, Proxy, Kollision, Schaden); --mit-ausgeblendet nimmt diese
       dazu, um zu sehen, ob der Bau ein verbindendes Teil weglässt. Je
       Insel die Knoten mit ihrem Pfad unter der Schiffswurzel.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const take = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const jsonFile = take('--json');
const rohFile = take('--roh');
const ALLE = args.includes('--alle-inseln');
const MIT_AUS = args.includes('--mit-ausgeblendet');
const slugsArg = args.filter((a) => !a.startsWith('--'));
if (!rohFile && !slugsArg.length) { console.error('node scripts/measure-hangar-inseln.mjs [slug ...|all] [--json datei] [--alle-inseln] | --roh <rohexport.glb> [--mit-ausgeblendet]'); process.exit(2); }

const GAP = 1;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

// GLB ohne Bilder lesen: die Rechnung braucht nur Ecken, und die Web-Modelle
// verweisen auf die Bildablage
async function readGeometry(file) {
  const b = readFileSync(file);
  const n = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + n).toString('utf8'));
  const at = 20 + n;
  const bin = at + 8 <= b.length ? b.subarray(at + 8, at + 8 + b.readUInt32LE(at)) : new Uint8Array(0);
  delete j.images; delete j.textures; delete j.samplers;
  for (const m of j.materials || []) {
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
    if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
    delete m.extensions;
  }
  const keep = (e) => !/texture|materials_/i.test(e);
  j.extensionsUsed = (j.extensionsUsed || []).filter(keep);
  j.extensionsRequired = (j.extensionsRequired || []).filter(keep);
  if (!j.buffers?.length) return io.readJSON({ json: j, resources: {} });
  return io.readJSON({ json: j, resources: { [j.buffers[0].uri ?? '@glb.bin']: new Uint8Array(bin) } });
}

// Dreiecke in Weltkoordinaten, je Dreieck Knoten und Material
function collect(nodes) {
  const T = [], who = [], v = [0, 0, 0];
  for (const node of nodes) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION'); if (!pos) continue;
      const idx = p.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      const tag = { node, mat: p.getMaterial()?.getName() || '?' };
      for (let i = 0; i + 2 < n; i += 3) {
        for (let k = 0; k < 3; k++) {
          pos.getElement(idx ? idx.getScalar(i + k) : i + k, v);
          T.push(M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]);
        }
        who.push(tag);
      }
    }
  }
  return { T, who };
}

const r1 = (v) => Math.round(v * 10) / 10;
function islands(nodes, pathOf) {
  const { T, who } = collect(nodes);
  const nt = who.length;
  if (!nt) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < T.length; i++) { const a = i % 3; if (T[i] < lo[a]) lo[a] = T[i]; if (T[i] > hi[a]) hi[a] = T[i]; }
  const L = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const vox = Math.max(0.5, L / 300);
  const R = Math.max(1, Math.ceil(GAP / vox));
  const key = (x, y, z) => (x * 4096 + y) * 4096 + z;
  const cell = new Map();
  const triCell = new Float64Array(nt);
  const ix = (p, a) => Math.floor((p - lo[a]) / vox);
  for (let t = 0; t < nt; t++) {
    const o = t * 9;
    const len = Math.max(Math.hypot(T[o + 3] - T[o], T[o + 4] - T[o + 1], T[o + 5] - T[o + 2]), Math.hypot(T[o + 6] - T[o], T[o + 7] - T[o + 1], T[o + 8] - T[o + 2]), Math.hypot(T[o + 6] - T[o + 3], T[o + 7] - T[o + 4], T[o + 8] - T[o + 5]));
    const s = Math.max(1, Math.ceil(len / (vox * 0.5)));
    for (let i = 0; i <= s; i++) for (let j = 0; j <= s - i; j++) {
      const u = i / s, w = j / s, z = 1 - u - w;
      const k = key(ix(T[o] * z + T[o + 3] * u + T[o + 6] * w, 0), ix(T[o + 1] * z + T[o + 4] * u + T[o + 7] * w, 1), ix(T[o + 2] * z + T[o + 5] * u + T[o + 8] * w, 2));
      if (!cell.has(k)) cell.set(k, cell.size);
      if (i === 0 && j === 0) triCell[t] = k;
    }
  }
  // Zellen im Abstand bis R verbinden (Union-Find)
  const keys = [...cell.keys()];
  const par = new Int32Array(keys.length).map((_, i) => i);
  const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let ci = 0; ci < keys.length; ci++) {
    const k = keys[ci], z = k % 4096, y = Math.floor(k / 4096) % 4096, x = Math.floor(k / 4096 / 4096);
    for (let dx = 0; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      if (dx === 0 && (dy < 0 || (dy === 0 && dz <= 0))) continue;
      const j = cell.get(key(x + dx, y + dy, z + dz)); if (j === undefined) continue;
      const a = find(ci), b = find(j); if (a !== b) par[a] = b;
    }
  }
  const comp = new Map();
  for (let t = 0; t < nt; t++) {
    const r = find(cell.get(triCell[t]));
    let c = comp.get(r);
    if (!c) comp.set(r, c = { n: 0, lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity], mats: new Map(), nodes: new Map(), innen: 0 });
    c.n++;
    const { node, mat } = who[t];
    c.mats.set(mat, (c.mats.get(mat) || 0) + 1);
    c.nodes.set(node, (c.nodes.get(node) || 0) + 1);
    if (node.getExtras()?.interior) c.innen++;
    for (let q = 0; q < 9; q++) { const a = q % 3, val = T[t * 9 + q]; if (val < c.lo[a]) c.lo[a] = val; if (val > c.hi[a]) c.hi[a] = val; }
  }
  const cs = [...comp.values()].sort((a, b) => b.n - a.n);
  const main = cs[0];
  const aussen = (c) => Math.max(0, ...[0, 1, 2].map((a) => Math.max(main.lo[a] - c.hi[a], c.lo[a] - main.hi[a])));
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k);
  const list = cs.slice(1).map((c) => ({
    tris: c.n, aussenM: r1(aussen(c)), min: c.lo.map(r1), max: c.hi.map(r1),
    innenraum: c.innen === c.n ? 'ja' : c.innen ? 'teils' : 'nein',
    materialien: top(c.mats, 3).map(([m, k]) => `${m} (${k})`),
    ...(pathOf ? { knoten: top(c.nodes, 5).map(([n, k]) => `${pathOf(n)} (${k})`) } : {}),
  })).filter((c) => ALLE || c.aussenM > 0);
  return { tris: nt, voxel: r1(vox), rumpf: { min: main.lo.map(r1), max: main.hi.map(r1) }, inseln: list };
}

const fmt = (c) => `${String(c.tris).padStart(6)} Dr.  ${String(c.aussenM).padStart(5)} m außen  ${c.min.join('/')} .. ${c.max.join('/')}  ${c.innenraum === 'nein' ? '' : `Innenraum ${c.innenraum}  `}${c.materialien[0]}`;
const result = {};
const t0 = Date.now();
if (rohFile) {
  const doc = await readGeometry(rohFile);
  const JUNK = /shield|proxy|collision|damage|nodraw|_lod[1-9]/i;
  const parent = new Map();
  const hull = [];
  for (const scene of doc.getRoot().listScenes()) for (const top of scene.listChildren()) for (const c of top.listChildren()) {
    if (/^interior_/i.test(c.getName())) continue;
    c.traverse((n) => {
      for (const ch of n.listChildren()) parent.set(ch, n);
      const m = n.getMesh();
      if (m && (MIT_AUS || !JUNK.test(`${n.getName()} ${m.listPrimitives()[0]?.getMaterial()?.getName() ?? ''}`))) hull.push(n);
    });
  }
  const pathOf = (n) => { const p = []; for (let x = n; x; x = parent.get(x)) p.unshift(x.getName()); return p.join('/'); };
  const r = islands(hull, pathOf);
  if (!r) { console.error('kein Rumpf im Rohexport'); process.exit(1); }
  result[rohFile] = r;
  console.log(`${rohFile}: ${r.tris} Dr., Voxel ${r.voxel} m, ${r.inseln.length} ${ALLE ? 'Inseln' : 'Inseln außerhalb'}${MIT_AUS ? ' (mit ausgeblendeten Teilen)' : ''}`);
  for (const c of r.inseln) { console.log(`  ${fmt(c)}`); for (const k of c.knoten) console.log(`      ${k}`); }
} else {
  const man = JSON.parse(readFileSync(`${ROOT}src/data/hangar-assets.json`, 'utf8'));
  const slugs = slugsArg[0] === 'all' ? Object.keys(man.ships).sort() : slugsArg;
  for (const slug of slugs) {
    const f = `${ROOT}public/hangar/ships/${slug}.glb`;
    if (!existsSync(f)) { console.log(`${slug}: Rumpf fehlt`); continue; }
    const r = islands((await readGeometry(f)).getRoot().listNodes(), null);
    if (!r) { console.log(`${slug}: leer`); continue; }
    result[slug] = r;
    if (!r.inseln.length) continue;
    console.log(`${slug}  (${r.tris} Dr.)`);
    for (const c of r.inseln) console.log(`  ${fmt(c)}`);
  }
  const all = Object.values(result);
  console.log(`\n${all.length} Rümpfe geprüft in ${Math.round((Date.now() - t0) / 1000)} s; mit ${ALLE ? 'Inseln' : 'losen Teilen außerhalb des Rumpfs'}: ${all.filter((r) => r.inseln.length).length}`);
}
if (jsonFile) writeFileSync(jsonFile, JSON.stringify(result, null, 1));
