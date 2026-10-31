// UV-Inseln vor der Draco-Quantisierung in die Nähe des Ursprungs holen.
//
// Draco quantisiert TEXCOORD über den Wertebereich der GANZEN Primitive.
// Die Spiel-Exporte tragen gekachelte UVs mit Versätzen von mehreren hundert
// Einheiten (Halle: −914…750). Mit 12 Bit wird ein Quantisierungsschritt dann
// ≈0,4 UV breit, und kleine Dreiecke fallen auf einen Punkt oder eine Linie:
// Die Textur erscheint als Schmiere oder Streifen (Halle 2026-10-07: 80 % der
// Dreiecke ohne UV-Fläche).
//
// Abhilfe: Jede zusammenhängende UV-Insel (über gemeinsame Indizes) wird um
// ein ganzzahliges Vielfaches der Kachel verschoben. Weil die Texturen kacheln,
// ändert das am Bild nichts, aber der Wertebereich schrumpft auf die größte
// Insel. Bei KHR_texture_transform mit Skalierung s < 1 wird um ganze
// Vielfache von 1/s verschoben, damit die Phase gleich bleibt.

/** Kachelperiode in UV-Einheiten für die Texturen einer Primitive. */
export function uvPeriod(prim, semantic = 'TEXCOORD_0') {
  const mat = prim.getMaterial();
  if (!mat) return 1;
  const coord = semantic === 'TEXCOORD_1' ? 1 : 0;
  let period = 1;
  const infos = [
    mat.getBaseColorTextureInfo(), mat.getNormalTextureInfo(), mat.getMetallicRoughnessTextureInfo(),
    mat.getEmissiveTextureInfo(), mat.getOcclusionTextureInfo(),
  ].filter((ti) => ti && ti.getTexCoord() === coord);
  for (const ti of infos) {
    const tr = ti.getExtension('KHR_texture_transform');
    if (!tr) continue;
    for (const s of tr.getScale()) {
      if (s > 0 && s < 1) period = Math.max(period, Math.round(1 / s));
    }
  }
  return period;
}

/** Verschiebt jede UV-Insel der Primitive. Gibt Wertebereich vorher/nachher zurück. */
export function normalizeUvIslands(prim, semantic = 'TEXCOORD_0') {
  const uv = prim.getAttribute(semantic);
  const idx = prim.getIndices();
  if (!uv || !idx) return null;
  const n = uv.getCount();
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  for (let t = 0; t + 2 < idx.getCount(); t += 3) {
    const a = idx.getScalar(t), b = idx.getScalar(t + 1), c = idx.getScalar(t + 2);
    unite(a, b); unite(b, c);
  }
  const minU = new Map(), minV = new Map();
  const e = [0, 0];
  let before = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    uv.getElement(i, e);
    const r = find(i);
    if (!(e[0] >= minU.get(r))) minU.set(r, e[0]);
    if (!(e[1] >= minV.get(r))) minV.set(r, e[1]);
    before = [Math.min(before[0], e[0]), Math.max(before[1], e[0]), Math.min(before[2], e[1]), Math.max(before[3], e[1])];
  }
  const p = uvPeriod(prim, semantic);
  const arr = uv.getArray().slice();
  const after = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const du = Math.floor(minU.get(r) / p) * p, dv = Math.floor(minV.get(r) / p) * p;
    const u = arr[i * 2] - du, v = arr[i * 2 + 1] - dv;
    arr[i * 2] = u; arr[i * 2 + 1] = v;
    after[0] = Math.min(after[0], u); after[1] = Math.max(after[1], u);
    after[2] = Math.min(after[2], v); after[3] = Math.max(after[3], v);
  }
  uv.setArray(arr);
  return { before: Math.max(before[1] - before[0], before[3] - before[2]), after: Math.max(after[1] - after[0], after[3] - after[2]) };
}

/** Anteil der Dreiecke ohne UV-Fläche (Punkt oder Linie) über alle Primitiven. */
export function degenerateUvShare(root, semantic = 'TEXCOORD_0') {
  let tris = 0, deg = 0;
  const A = [0, 0], B = [0, 0], C = [0, 0];
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const uv = prim.getAttribute(semantic), idx = prim.getIndices();
    if (!uv || !idx) continue;
    for (let t = 0; t + 2 < idx.getCount(); t += 3) {
      uv.getElement(idx.getScalar(t), A); uv.getElement(idx.getScalar(t + 1), B); uv.getElement(idx.getScalar(t + 2), C);
      tris++;
      if (Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) < 1e-9) deg++;
    }
  }
  return { tris, deg, share: tris ? deg / tris : 0 };
}

/** Quantisierungsbits für TEXCOORD: Schritt ≤ 1/4096 UV über den größten Bereich. */
export function texcoordBits(root, semantic = 'TEXCOORD_0') {
  let range = 1;
  const e = [0, 0];
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const uv = prim.getAttribute(semantic);
    if (!uv) continue;
    let a = [Infinity, -Infinity, Infinity, -Infinity];
    for (let i = 0; i < uv.getCount(); i++) {
      uv.getElement(i, e);
      a = [Math.min(a[0], e[0]), Math.max(a[1], e[0]), Math.min(a[2], e[1]), Math.max(a[3], e[1])];
    }
    range = Math.max(range, a[1] - a[0], a[3] - a[2]);
  }
  return Math.min(24, Math.max(12, Math.ceil(Math.log2(range * 4096))));
}
