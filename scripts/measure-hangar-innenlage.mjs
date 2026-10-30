/* ============================================================
   measure-hangar-innenlage.mjs — Sitzt der Innenraum im Rumpf?

   Anlass: Krisz, 30.10.2026: „am ende sollen innenräüme auch dabei sein,
   und jedes schiff soll komplett angeschaut werden, innen und aussen“.
   Röntgenbilder der begehbaren Innenräume (#263) zeigten bei Cutlass,
   Hammerhead, Carrack, Vanguard und anderen Innenräume, die oben oder
   hinten aus dem Rumpf ragen. Der Hüllquader-Test des Baus (inHull) sieht
   das nicht. Notiz: .planning/notes/hangar-innenlage.md.

   Rechnung: Der Rumpf wird gerastert (Voxel 0,2 m, bei großen Schiffen
   gröber, Fläche um ein Voxel verdickt). Auf jeder Geraden längs X, Y
   und Z zählt die Spanne vom ersten bis zum letzten Rumpf-Voxel. Ein
   Dreieck des Innenraums liegt außen, wenn sein Mittelpunkt auf mindestens
   zwei Achsen mindestens 0,4 m jenseits der Spanne liegt. Eine offene Tür
   kostet so nur eine Achse; was oben, seitlich oder hinten aus dem Rumpf
   ragt, kostet zwei oder drei. Was in einer Mulde außen am Rumpf liegt,
   sieht die Rechnung nicht: die Röntgenbilder bleiben nötig.

   Werkzeug (gate-registry: rail null):

     node scripts/measure-hangar-innenlage.mjs [slug ...|all] [--json datei] [--versatz]
       Web-Fassung: public/hangar/ships/<slug>.glb gegen
       public/hangar/interior/<slug>.glb (all = alle Innenräume im Manifest)
     node scripts/measure-hangar-innenlage.mjs --roh <rohexport.glb> [--json datei] [--versatz]
       Rohexport (PC): Rumpf = alles außer den Containern interior_* (ohne
       Schild, Proxy, Kollision, Schaden), Bericht je Container

   --versatz sucht je Innenraum (Web) oder je Container (roh) den
   Versatz bis 4 m, mit dem am wenigsten außen liegt.
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
const VERSATZ = args.includes('--versatz');
const slugsArg = args.filter((a) => !a.startsWith('--'));
if (!rohFile && !slugsArg.length) { console.error('node scripts/measure-hangar-innenlage.mjs [slug ...|all] [--json datei] [--versatz] | --roh <rohexport.glb>'); process.exit(2); }

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

// Dreiecke in Weltkoordinaten: [Knoten, a, b, c]
function* worldTris(nodes) {
  const v = [0, 0, 0];
  for (const node of nodes) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix();
    const w = (i, pos) => { pos.getElement(i, v); return [M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]]; };
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION'); if (!pos) continue;
      const idx = p.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i + 2 < n; i += 3) yield [node, w(idx ? idx.getScalar(i) : i, pos), w(idx ? idx.getScalar(i + 1) : i + 1, pos), w(idx ? idx.getScalar(i + 2) : i + 2, pos)];
    }
  }
}

// Rumpf rastern, Spannen je Achse; liefert out(p) = Meter jenseits der
// Spanne auf der zweitschlechtesten Achse (0 = innen)
function hullSpans(hullNodes) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const [, a, b, c] of worldTris(hullNodes)) for (const p of [a, b, c]) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
  if (!Number.isFinite(mn[0])) return null;
  // große Schiffe gröber, damit das Gitter in den Speicher passt
  const vox = Math.max(0.2, Math.cbrt(mx.reduce((a, v, k) => a * (v - mn[k] + 1.2), 1) / 1.2e8));
  const pad = 3;
  const o = mn.map((v) => v - pad * vox);
  const [X, Y, Z] = mx.map((v, k) => Math.ceil((v - mn[k]) / vox) + 2 * pad + 1);
  const id = (x, y, z) => x + X * (y + Y * z);
  const solid = new Uint8Array(X * Y * Z);
  const mark = (p) => { solid[id(Math.floor((p[0] - o[0]) / vox), Math.floor((p[1] - o[1]) / vox), Math.floor((p[2] - o[2]) / vox))] = 1; };
  for (const [, a, b, c] of worldTris(hullNodes)) {
    const len = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]));
    const s = Math.max(1, Math.ceil(len / (vox * 0.5)));
    for (let i = 0; i <= s; i++) for (let j = 0; j <= s - i; j++) {
      const u = i / s, t = j / s, w = 1 - u - t;
      mark([a[0] * w + b[0] * u + c[0] * t, a[1] * w + b[1] * u + c[1] * t, a[2] * w + b[2] * u + c[2] * t]);
    }
  }
  const span = (len) => [new Int16Array(len).fill(32767), new Int16Array(len).fill(-1)];
  const [xl, xh] = span(Y * Z), [yl, yh] = span(X * Z), [zl, zh] = span(X * Y);
  for (let z = 1; z < Z - 1; z++) for (let y = 1; y < Y - 1; y++) for (let x = 1; x < X - 1; x++) {
    if (!solid[id(x, y, z)]) continue;
    // verdickt um ein Voxel: Nähte und Spalte zählen als Rumpf
    for (let d = -1; d <= 1; d++) for (let e = -1; e <= 1; e++) {
      const i1 = (y + d) + Y * (z + e), i2 = (x + d) + X * (z + e), i3 = (x + d) + X * (y + e);
      if (x - 1 < xl[i1]) xl[i1] = x - 1; if (x + 1 > xh[i1]) xh[i1] = x + 1;
      if (y - 1 < yl[i2]) yl[i2] = y - 1; if (y + 1 > yh[i2]) yh[i2] = y + 1;
      if (z - 1 < zl[i3]) zl[i3] = z - 1; if (z + 1 > zh[i3]) zh[i3] = z + 1;
    }
  }
  const beyond = (c, lo, hi) => (hi < 0 ? 9999 : Math.max(lo - c, c - hi, 0));
  const out = (p) => {
    const x = Math.floor((p[0] - o[0]) / vox), y = Math.floor((p[1] - o[1]) / vox), z = Math.floor((p[2] - o[2]) / vox);
    if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z) return 99;
    const d = [beyond(x, xl[y + Y * z], xh[y + Y * z]), beyond(y, yl[x + X * z], yh[x + X * z]), beyond(z, zl[x + X * y], zh[x + X * y])].sort((u, v) => v - u);
    return Math.min(99, d[1] * vox);
  };
  return { out, vox, size: mx.map((v, k) => v - mn[k]) };
}

const OUT_M = 0.4;
const r2 = (v) => Math.round(v * 100) / 100;
function judge(spans, nodes) {
  let tris = 0, aussen = 0, maxM = 0;
  const pts = [];
  for (const [, a, b, c] of worldTris(nodes)) {
    const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const d = spans.out(m);
    tris++;
    if (d >= OUT_M) { aussen++; if (d > maxM) maxM = d; }
    if (VERSATZ && tris % 5 === 0) pts.push(m);
  }
  const r = { tris, aussenPct: r2((100 * aussen) / Math.max(1, tris)), maxM: r2(maxM) };
  if (VERSATZ && pts.length) {
    // jeder n-te Mittelpunkt, höchstens 20 000; erst grob (0,5 m), dann fein (0,1 m)
    const step = Math.max(1, Math.ceil(pts.length / 20000));
    const P = pts.filter((_, i) => i % step === 0);
    const frac = (dx, dy, dz) => { let o = 0; for (const p of P) if (spans.out([p[0] + dx, p[1] + dy, p[2] + dz]) >= OUT_M) o++; return o / P.length; };
    let best = [0, 0, 0, frac(0, 0, 0)];
    const search = (c, R, s) => { for (let dx = -R; dx <= R + 1e-9; dx += s) for (let dy = -R; dy <= R + 1e-9; dy += s) for (let dz = -R; dz <= R + 1e-9; dz += s) { const f = frac(c[0] + dx, c[1] + dy, c[2] + dz); if (f < best[3] - 1e-9) best = [c[0] + dx, c[1] + dy, c[2] + dz, f]; } };
    search([0, 0, 0], 4, 0.5);
    search(best.slice(0, 3), 0.4, 0.1);
    r.versatz = best.slice(0, 3).map(r2);
    r.mitVersatzPct = r2(best[3] * 100);
  }
  return r;
}

const result = {};
const t0 = Date.now();
if (rohFile) {
  const doc = await readGeometry(rohFile);
  const containers = [];
  const hull = [];
  const JUNK = /shield|proxy|collision|damage|nodraw|_lod[1-9]/i;
  for (const scene of doc.getRoot().listScenes()) for (const top of scene.listChildren()) for (const c of top.listChildren()) {
    if (/^interior_/i.test(c.getName())) { containers.push(c); continue; }
    c.traverse((n) => { const m = n.getMesh(); if (m && !JUNK.test(`${n.getName()} ${m.listPrimitives()[0]?.getMaterial()?.getName() ?? ''}`)) hull.push(n); });
  }
  const spans = hullSpans(hull);
  if (!spans) { console.error('kein Rumpf im Rohexport'); process.exit(1); }
  console.log(`${rohFile}: Rumpf ${spans.size.map(r2).join(' x ')} m, Voxel ${r2(spans.vox)} m, ${containers.length} Container`);
  for (const c of containers) {
    const nodes = []; c.traverse((n) => n.getMesh() && nodes.push(n));
    const r = { ...judge(spans, nodes), t: c.getTranslation().map(r2), r: c.getRotation().map((v) => Math.round(v * 1e4) / 1e4), s: c.getScale().map(r2) };
    result[c.getName()] = r;
    console.log(`  ${c.getName().padEnd(48)} ${String(r.tris).padStart(8)} Dr.  außen ${String(r.aussenPct).padStart(6)} % (bis ${r.maxM} m)  t ${r.t.join(' ')}  r ${r.r.join(' ')}${r.versatz ? `  Versatz ${r.versatz.join(' ')} -> ${r.mitVersatzPct} %` : ''}`);
  }
} else {
  const man = JSON.parse(readFileSync(`${ROOT}src/data/hangar-assets.json`, 'utf8'));
  const slugs = slugsArg[0] === 'all' ? Object.keys(man.interior ?? {}).sort() : slugsArg;
  for (const slug of slugs) {
    const hullF = `${ROOT}public/hangar/ships/${slug}.glb`, inF = `${ROOT}public/hangar/interior/${slug}.glb`;
    if (!existsSync(hullF) || !existsSync(inF)) { console.log(`${slug}: Rumpf oder Innenraum fehlt`); continue; }
    const hull = await readGeometry(hullF), inner = await readGeometry(inF);
    // den groben Innenraum im Rumpf (extras.interior) nicht als Rumpf zählen
    const spans = hullSpans(hull.getRoot().listNodes().filter((n) => n.getMesh() && !n.getExtras()?.interior));
    const r = judge(spans, inner.getRoot().listNodes());
    result[slug] = { ...r, voxel: r2(spans.vox) };
    console.log(`${slug.padEnd(36)} ${String(r.tris).padStart(8)} Dr.  außen ${String(r.aussenPct).padStart(6)} % (bis ${r.maxM} m)${r.versatz ? `  Versatz ${r.versatz.join(' ')} -> ${r.mitVersatzPct} %` : ''}`);
  }
  const all = Object.values(result);
  const over = (p) => all.filter((r) => r.aussenPct >= p).length;
  console.log(`\n${all.length} Innenräume gemessen in ${Math.round((Date.now() - t0) / 1000)} s; mindestens 1 % außen: ${over(1)}, mindestens 5 %: ${over(5)}, mindestens 20 %: ${over(20)}`);
}
if (jsonFile) writeFileSync(jsonFile, JSON.stringify(result, null, 1));
