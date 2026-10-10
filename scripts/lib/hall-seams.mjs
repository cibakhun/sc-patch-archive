// Dichte Nähte der Halle: Kanten, die im Spiel aufeinanderliegen, sollen es
// auch nach dem Packen tun.
//
// Anlass (2026-10-08): Draco rundet die Lage jeder Primitive auf ein eigenes
// Raster (quantizationVolume 'mesh': Raster über die Ausdehnung der
// Primitive, bei der Halle 16 Bit über bis zu 188 m, also 2,9 mm). Kanten
// zweier Teile rücken so bis zu einer Rasterweite je Achse auseinander, und
// durch den Spalt scheint der helle Hintergrund: gepunktete Linien an den
// Paneelkanten. Gemessen an revelyork-single-lod1.glb: an der Nischenwand
// endet das Paneel 2,3 mm über der Zierleiste darunter; von 266 884
// Randecken lag keine genau auf der Ecke eines anderen Teils, 123 373 lagen
// bis 5 mm daneben. Gegenprobe im Bild: verschweißt und mit einem Raster
// für alle Teile gepackt sind die Punkte weg.
//
// sealSeams vor dem Packen, dann draco({ quantizationVolume: 'scene' }):
// Mit einem Raster für alle Teile bleiben gleiche Ecken gleich.
// seamStats prüft das am geschriebenen Artefakt.
import { transformMesh } from '@gltf-transform/functions';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Lage aller Ecken einer Primitive im Raum der Szene (Float64, xyz hintereinander) */
function worldPositions(prim, M) {
  const P = prim.getAttribute('POSITION'), n = P.getCount(), W = new Float64Array(n * 3), v = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    P.getElement(i, v);
    // + 0 macht aus −0 eine 0: Gleichheit wird unten über die Bits geprüft
    W[i * 3] = M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12] + 0;
    W[i * 3 + 1] = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13] + 0;
    W[i * 3 + 2] = M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14] + 0;
  }
  return W;
}

/** Nummer je Ecke: Ecken mit genau derselben Lage (etwa verschiedene Normalen oder UVs) teilen sie */
function positionIds(W) {
  const n = W.length / 3, bits = new Uint32Array(W.buffer, W.byteOffset, n * 6), lid = new Int32Array(n), first = new Map();
  for (let i = 0; i < n; i++) {
    let h = 0;
    for (let c = 0; c < 6; c++) h = Math.imul(h ^ bits[i * 6 + c], 0x9e3779b1);
    h >>>= 0;
    const e = first.get(h);
    if (e === undefined) { first.set(h, i); lid[i] = i; continue; }
    const cand = typeof e === 'number' ? [e] : e;
    const same = cand.find((j) => W[j * 3] === W[i * 3] && W[j * 3 + 1] === W[i * 3 + 1] && W[j * 3 + 2] === W[i * 3 + 2]);
    if (same !== undefined) { lid[i] = same; continue; }
    lid[i] = i;
    if (typeof e === 'number') first.set(h, [e, i]); else e.push(i);
  }
  return lid;
}

/**
 * Gitter über Punkten (Zellweite cell), Nachbarn in den 27 Zellen um einen
 * Punkt. Zellen über einen Streuwert: Kollisionen bringen nur zusätzliche
 * Kandidaten (fn kann einen Punkt mehrfach sehen), die Abstandsprüfung
 * dahinter sortiert sie aus.
 */
function grid(cell) {
  const m = new Map(), h = (ix, iy, iz) => (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) >>> 0;
  return {
    add(x, y, z, i) { const k = h(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)); const a = m.get(k); if (a) a.push(i); else m.set(k, [i]); },
    addCell(ix, iy, iz, i) { const k = h(ix, iy, iz); const a = m.get(k); if (a) a.push(i); else m.set(k, [i]); },
    near(x, y, z, fn) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const a = m.get(h(cx + dx, cy + dy, cz + dz));
        if (a) for (const j of a) fn(j);
      }
    },
  };
}

/**
 * Backt die Knotentransformationen in die Ecken (jeder Knoten danach
 * Identität, alle Teile in einem Raum) und legt Ecken verschiedener
 * Primitive, die höchstens `tol` m auseinanderliegen, auf ihren
 * gemeinsamen Mittelpunkt. Ein Mesh an mehreren Knoten wird je Knoten
 * kopiert. Normalen und Tangenten dreht transformMesh mit.
 * Liefert { nodes, prims, snapped, groups, maxShift }.
 */
export function sealSeams(doc, { tol = 1e-4 } = {}) {
  const root = doc.getRoot();
  if (root.listAnimations().length || root.listSkins().length) throw new Error('sealSeams: Halle mit Animation oder Skin, Einbacken würde sie zerstören');
  // Kameras und Lampen hängen an Knoten, die gleich auf Identität gehen
  if (root.listNodes().some((n) => n.getCamera() || n.listExtensions().length)) throw new Error('sealSeams: Knoten mit Kamera oder Erweiterung (Lampe?), erst herausnehmen');
  const meshNodes = root.listNodes().filter((n) => n.getMesh());
  const world = new Map(meshNodes.map((n) => [n, n.getWorldMatrix()]));
  const used = new Set();
  for (const n of meshNodes) {
    if (used.has(n.getMesh())) n.setMesh(n.getMesh().clone());
    used.add(n.getMesh());
  }
  for (const n of meshNodes) transformMesh(n.getMesh(), world.get(n));
  for (const n of root.listNodes()) n.setMatrix(IDENTITY);

  const prims = meshNodes.flatMap((n) => n.getMesh().listPrimitives());
  const pos = prims.map((p) => p.getAttribute('POSITION'));
  const arr = pos.map((P) => P.getArray().slice());
  const owner = [], local = [];
  pos.forEach((P, pi) => { for (let i = 0; i < P.getCount(); i++) { owner.push(pi); local.push(i); } });
  const N = owner.length, at = (g, c) => arr[owner[g]][local[g] * 3 + c];
  const parent = new Int32Array(N).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const G = grid(tol);
  for (let g = 0; g < N; g++) G.add(at(g, 0), at(g, 1), at(g, 2), g);
  for (let g = 0; g < N; g++) {
    const x = at(g, 0), y = at(g, 1), z = at(g, 2);
    G.near(x, y, z, (h) => {
      if (h <= g || owner[h] === owner[g]) return;
      if (Math.hypot(at(h, 0) - x, at(h, 1) - y, at(h, 2) - z) <= tol) { const a = find(g), b = find(h); if (a !== b) parent[a] = b; }
    });
  }
  const sum = new Map();
  for (let g = 0; g < N; g++) {
    const r = find(g);
    let s = sum.get(r);
    if (!s) sum.set(r, (s = { x: 0, y: 0, z: 0, c: 0, p: new Set() }));
    s.x += at(g, 0); s.y += at(g, 1); s.z += at(g, 2); s.c++; s.p.add(owner[g]);
  }
  const next = arr.map((a) => a.slice());
  let snapped = 0, groups = 0, maxShift = 0;
  for (const s of sum.values()) if (s.p.size > 1) groups++;
  for (let g = 0; g < N; g++) {
    const s = sum.get(find(g));
    if (s.p.size < 2) continue;
    const k = local[g] * 3, a = next[owner[g]], m = [s.x / s.c, s.y / s.c, s.z / s.c];
    maxShift = Math.max(maxShift, Math.hypot(m[0] - a[k], m[1] - a[k + 1], m[2] - a[k + 2]));
    a[k] = m[0]; a[k + 1] = m[1]; a[k + 2] = m[2];
    snapped++;
  }
  pos.forEach((P, pi) => P.setArray(next[pi]));
  return { nodes: meshNodes.length, prims: prims.length, snapped, groups, maxShift };
}

/**
 * Randecken (an Kanten, die nur ein Dreieck ihrer Primitive benutzt; Kanten
 * nach Lage, nicht nach Index) gegen Randecken anderer Primitive, im Raum der
 * Szene: dicht (Abstand höchstens eps, am gepackten Artefakt 0), klaffend
 * (eps < d <= tol), einsam (keine fremde Randecke in tol). Einsame Ecken,
 * die höchstens tol neben einer fremden Randkante liegen, aber weiter als
 * eps, sind klaffende T-Stöße. eps > 0 für die ungepackte Quelle, deren
 * Knotentransformationen Rundungsrauschen tragen. tJunctions: false spart
 * die T-Stöße (den größten Teil der Rechenzeit; tGap ist dann null).
 * Liefert { boundaryVerts, sealed, crack, crackMm, lone, tGap, tGapMm }
 * (…Mm: Anzahl je angefangenem Millimeter).
 */
export function seamStats(doc, { tol = 0.005, eps = 0, tJunctions = true } = {}) {
  const root = doc.getRoot();
  const bv = [], be = [];
  let pi = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const I = p.getIndices();
      if (p.getMode() !== 4 || !I) { pi++; continue; }
      const W = worldPositions(p, M), ia = I.getArray(), lid = positionIds(W), n = W.length / 3;
      // Kante als eine Zahl a·n + b (a < b), exakt bis n² < 2^53
      const uses = new Map();
      for (let t = 0; t + 2 < ia.length; t += 3) for (const [u, w] of [[ia[t], ia[t + 1]], [ia[t + 1], ia[t + 2]], [ia[t + 2], ia[t]]]) {
        const a = lid[u], b = lid[w];
        if (a === b) continue;
        const k = a < b ? a * n + b : b * n + a;
        uses.set(k, (uses.get(k) || 0) + 1);
      }
      const ends = new Set();
      for (const [k, c] of uses) {
        if (c !== 1) continue;
        const a = Math.floor(k / n), b = k % n;
        ends.add(a); ends.add(b);
        be.push([W[a * 3], W[a * 3 + 1], W[a * 3 + 2], W[b * 3], W[b * 3 + 1], W[b * 3 + 2], pi]);
      }
      for (const i of ends) bv.push([W[i * 3], W[i * 3 + 1], W[i * 3 + 2], pi]);
      pi++;
    }
  }
  const G = grid(tol);
  bv.forEach((v, i) => G.add(v[0], v[1], v[2], i));
  let sealed = 0, crack = 0;
  const crackMm = {}, lone = [];
  bv.forEach((v, i) => {
    let best = Infinity;
    G.near(v[0], v[1], v[2], (j) => {
      const w = bv[j];
      if (w[3] === v[3]) return;
      const d = Math.hypot(w[0] - v[0], w[1] - v[1], w[2] - v[2]);
      if (d < best) best = d;
    });
    if (best <= eps) sealed++;
    else if (best <= tol) { crack++; const mm = Math.ceil(best * 1000); crackMm[mm] = (crackMm[mm] || 0) + 1; }
    else lone.push(i);
  });
  let tGap = 0;
  const tGapMm = {};
  if (!tJunctions) return { boundaryVerts: bv.length, sealed, crack, crackMm, lone: lone.length, tGap: null, tGapMm: null };
  // T-Stöße: Randkanten in ein grobes Gitter, in jede Zelle, die sie streifen
  const C = Math.max(tol * 10, 0.05), E = grid(C), step = C / 2;
  be.forEach((e, k) => {
    const L = Math.hypot(e[3] - e[0], e[4] - e[1], e[5] - e[2]), s = Math.max(1, Math.ceil(L / step));
    let px = NaN, py = NaN, pz = NaN;
    for (let q = 0; q <= s; q++) {
      const t = q / s, ix = Math.floor((e[0] + (e[3] - e[0]) * t) / C), iy = Math.floor((e[1] + (e[4] - e[1]) * t) / C), iz = Math.floor((e[2] + (e[5] - e[2]) * t) / C);
      if (ix === px && iy === py && iz === pz) continue;
      px = ix; py = iy; pz = iz;
      E.addCell(ix, iy, iz, k);
    }
  });
  for (const i of lone) {
    const [x, y, z, p] = bv[i];
    let best = Infinity;
    const checked = new Set();
    E.near(x, y, z, (k) => {
      if (checked.has(k)) return;
      checked.add(k);
      const e = be[k];
      if (e[6] === p) return;
      const bx = e[3] - e[0], by = e[4] - e[1], bz = e[5] - e[2], L = bx * bx + by * by + bz * bz;
      const t = L ? Math.max(0, Math.min(1, ((x - e[0]) * bx + (y - e[1]) * by + (z - e[2]) * bz) / L)) : 0;
      const d = Math.hypot(x - e[0] - t * bx, y - e[1] - t * by, z - e[2] - t * bz);
      if (d < best) best = d;
    });
    if (best > Math.max(eps, 1e-6) && best <= tol) { tGap++; const mm = Math.ceil(best * 1000); tGapMm[mm] = (tGapMm[mm] || 0) + 1; }
  }
  return { boundaryVerts: bv.length, sealed, crack, crackMm, lone: lone.length, tGap, tGapMm };
}
