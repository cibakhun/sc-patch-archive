/* ============================================================
   hangar-lage.mjs — Sitzt der Innenraum im Rumpf, hängt nichts lose daneben?

   Gemeinsam für die Werkzeuge scripts/measure-hangar-innenlage.mjs und
   scripts/measure-hangar-inseln.mjs (Web-Fassung und Rohexport, PC) und
   das Tor scripts/verify-hangar-lage.mjs (Schiene A). Anlass: Krisz,
   30.10.2026: „am ende sollen innenräüme auch dabei sein, und jedes schiff
   soll komplett angeschaut werden, innen und aussen“. Befunde:
   .planning/notes/hangar-innenlage.md und hangar-inseln.md.

   hullSpans + judge: Der Rumpf wird gerastert (Voxel 0,2 m, bei großen
   Schiffen gröber, Fläche um ein Voxel verdickt). Auf jeder Geraden längs
   X, Y und Z zählt die Spanne vom ersten bis zum letzten Rumpf-Voxel. Ein
   Dreieck des Innenraums liegt außen, wenn sein Mittelpunkt auf mindestens
   zwei Achsen mindestens OUT_M jenseits der Spanne liegt. Eine offene Tür
   kostet so nur eine Achse; was oben, seitlich oder hinten aus dem Rumpf
   ragt, kostet zwei oder drei. Was in einer Mulde außen am Rumpf liegt,
   sieht die Rechnung nicht: die Röntgenbilder bleiben nötig.

   seatCheck: mindestens SITZ_MIN Dreiecksmitten des Innenraums bis SITZ_R
   um den Pilotensitz. Ein Container, der 8 m neben dem Cockpit noch im
   Rumpf liegt, besteht die Spannen und reißt hier. Dazu, was der Blick
   aus KOPF Höhe senkrecht nach oben bis OBEN_M trifft (Glas, Rumpf, frei).

   islands: Alle Dreiecke gerastert (Voxel 0,5 m, bei großen Schiffen
   gröber). Zellen, die höchstens GAP auseinanderliegen, gehören zusammen.
   Der größte Verbund ist der Rumpf, jeder andere eine Insel; gemeldet
   wird eine Insel außerhalb des Hüllquaders des Rumpfs (mit alle: jede).

   WERKZEUG nennt die Fassung der Rechnung. Wer an Voxeln, Grenzen oder
   Regeln dreht, zählt sie hoch: Das Tor misst dann jedes Schiff neu,
   statt Werte einer anderen Rechnung wiederzuverwenden.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

// 2: Sitzwahl ohne Kopilot (co_pilot, co-pilot), Fahrer vor Mitfahrer
export const WERKZEUG = 'hangar-lage 2';
export const OUT_M = 0.4, SITZ_R = 1.5, SITZ_MIN = 20, KOPF = 0.8, OBEN_M = 4, GAP = 1;

let ioP = null;
const io = () => (ioP ??= draco3d.createDecoderModule().then((d) => new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': d })));

// GLB ohne Bilder lesen: die Rechnung braucht nur Ecken, und die Web-Modelle
// verweisen auf die Bildablage
export async function readGeometry(file) {
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
  const IO = await io();
  if (!j.buffers?.length) return IO.readJSON({ json: j, resources: {} });
  return IO.readJSON({ json: j, resources: { [j.buffers[0].uri ?? '@glb.bin']: new Uint8Array(bin) } });
}

// Knoten mit Netz, die eine Szene erreicht: was der Viewer zeichnet (lose
// Knoten außerhalb der Szene zeichnet er nicht, verify-hangar-gear.mjs)
export function sceneNodes(doc) {
  const out = [], seen = new Set();
  const walk = (n) => { if (seen.has(n)) return; seen.add(n); if (n.getMesh()) out.push(n); for (const c of n.listChildren()) walk(c); };
  for (const s of doc.getRoot().listScenes()) for (const c of s.listChildren()) walk(c);
  return out;
}

// Dreiecke in Weltkoordinaten: [Knoten, a, b, c, Primitiv]; verborgen(materialname)
// lässt aus, was der Viewer nicht zeichnet
export function* worldTris(nodes, verborgen = () => false) {
  const v = [0, 0, 0];
  for (const node of nodes) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix();
    const w = (i, pos) => { pos.getElement(i, v); return [M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]]; };
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION'); if (!pos || verborgen(p.getMaterial()?.getName() || '')) continue;
      const idx = p.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i + 2 < n; i += 3) yield [node, w(idx ? idx.getScalar(i) : i, pos), w(idx ? idx.getScalar(i + 1) : i + 1, pos), w(idx ? idx.getScalar(i + 2) : i + 2, pos), p];
    }
  }
}

// Rumpf rastern, Spannen je Achse; liefert out(p) = Meter jenseits der
// Spanne auf der zweitschlechtesten Achse (0 = innen)
export function hullSpans(hullNodes, verborgen) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const [, a, b, c] of worldTris(hullNodes, verborgen)) for (const p of [a, b, c]) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
  if (!Number.isFinite(mn[0])) return null;
  // große Schiffe gröber, damit das Gitter in den Speicher passt
  const vox = Math.max(0.2, Math.cbrt(mx.reduce((a, v, k) => a * (v - mn[k] + 1.2), 1) / 1.2e8));
  const pad = 3;
  const o = mn.map((v) => v - pad * vox);
  const [X, Y, Z] = mx.map((v, k) => Math.ceil((v - mn[k]) / vox) + 2 * pad + 1);
  const id = (x, y, z) => x + X * (y + Y * z);
  const solid = new Uint8Array(X * Y * Z);
  const mark = (p) => { solid[id(Math.floor((p[0] - o[0]) / vox), Math.floor((p[1] - o[1]) / vox), Math.floor((p[2] - o[2]) / vox))] = 1; };
  for (const [, a, b, c] of worldTris(hullNodes, verborgen)) {
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

export const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;

// Anteil der Innenraum-Dreiecke außerhalb der Spannen; mit versatz sucht
// es den Versatz bis 4 m, mit dem am wenigsten außen liegt
export function judge(spans, nodes, { versatz = false, verborgen } = {}) {
  let tris = 0, aussen = 0, maxM = 0;
  const pts = [];
  for (const [, a, b, c] of worldTris(nodes, verborgen)) {
    const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const d = spans.out(m);
    tris++;
    if (d >= OUT_M) { aussen++; if (d > maxM) maxM = d; }
    if (versatz && tris % 5 === 0) pts.push(m);
  }
  const r = { tris, aussenPct: r2((100 * aussen) / Math.max(1, tris)), maxM: r2(maxM) };
  if (versatz && pts.length) {
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

const isGlass = (m) => { const name = m?.getName() || ''; return (m?.getExtras()?.is_glass || /glass|canopy|window/i.test(name)) && !/headlight|light_glass|lamp|lens|bulb/i.test(name); };
// senkrecht nach oben (+Y): Höhe über o, in der der Strahl das Dreieck trifft
function rayUp(o, a, b, c) {
  const d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
  if (Math.abs(d) < 1e-12) return null;
  const u = ((o[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (o[2] - a[2])) / d;
  const v = ((b[0] - a[0]) * (o[2] - a[2]) - (o[0] - a[0]) * (b[2] - a[2])) / d;
  if (u < 0 || v < 0 || u + v > 1) return null;
  const y = a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
  return y > o[1] ? y - o[1] : null;
}
// Pilotensitz (PC, 30.10.2026): Innenraum um ihn und der Blick nach oben
// aus Kopfhöhe (erstes Rumpfdreieck bis OBEN_M: Glas, Rumpf oder frei)
export function seatCheck(seat, innerNodes, hullNodes, { label = () => null, verborgen } = {}) {
  let nah = 0, best = Infinity, bestNode = null;
  for (const [node, a, b, c] of worldTris(innerNodes, verborgen)) {
    const d = Math.hypot((a[0] + b[0] + c[0]) / 3 - seat.p[0], (a[1] + b[1] + c[1]) / 3 - seat.p[1], (a[2] + b[2] + c[2]) / 3 - seat.p[2]);
    if (d < best) { best = d; bestNode = node; }
    if (d <= SITZ_R) nah++;
  }
  const o = [seat.p[0], seat.p[1] + KOPF, seat.p[2]];
  let hit = OBEN_M, glas = false;
  for (const [, a, b, c, prim] of worldTris(hullNodes, verborgen)) {
    const t = rayUp(o, a, b, c);
    if (t != null && t < hit) { hit = t; glas = isGlass(prim.getMaterial()); }
  }
  const oben = hit < OBEN_M ? (glas ? 'Glas' : 'Rumpf') : 'frei';
  return { name: seat.name, p: seat.p.map(r2), nah, abstand: Number.isFinite(best) ? r2(best) : null, ...(label(bestNode) ? { naechster: label(bestNode) } : {}), oben, obenM: hit < OBEN_M ? r2(hit) : null, ok: nah >= SITZ_MIN };
}
export const seatLine = (s) => (s ? `Sitz ${s.name}: ${s.nah} Dr. bis ${SITZ_R} m (nächstes ${s.abstand ?? '—'} m${s.naechster ? `, ${s.naechster}` : ''}), oben ${s.oben}${s.obenM != null ? ` ${s.obenM} m` : ''} ${s.ok ? '✓' : '✗'}` : 'kein Pilotensitz');
// Pilot zuerst (nicht der Kopilot: copilot, co_pilot, co-pilot), dann der
// Fahrer der Bodenfahrzeuge, dann der Kopilot (er sitzt im Cockpit, anders
// als ein Mitfahrer; 01.11.2026 trifft das kein Schiff), sonst der erste Sitz
export const pickSeat = (list) => list.find((s) => /(?<!co[_-]?)pilot/i.test(s.name)) ?? list.find((s) => /driver/i.test(s.name)) ?? list.find((s) => /pilot/i.test(s.name)) ?? list[0] ?? null;

// Dreiecke in Weltkoordinaten, je Dreieck Knoten und Material
function collect(nodes, verborgen = () => false) {
  const T = [], who = [], v = [0, 0, 0];
  for (const node of nodes) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION'); if (!pos) continue;
      const mat = p.getMaterial()?.getName() || '?';
      if (verborgen(mat)) continue;
      const idx = p.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      const tag = { node, mat };
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

// Inseln: getrennte Teile außerhalb des Hüllquaders des Rumpfs (alle: jede
// Insel); pathOf(knoten) nennt im Rohexport den Knotenpfad
export function islands(nodes, { pathOf = null, alle = false, verborgen } = {}) {
  const { T, who } = collect(nodes, verborgen);
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
  })).filter((c) => alle || c.aussenM > 0);
  return { tris: nt, voxel: r1(vox), rumpf: { min: main.lo.map(r1), max: main.hi.map(r1) }, inseln: list };
}
