// Normalen mit Kantenwinkel neu berechnen (wie three.js toCreasedNormals).
//
// Die Hallen-Exporte tragen geglättete Normalen über harte Kanten hinweg:
// Rund 27 % der Boden- und Wanddreiecke haben eine Eckennormale, die mehr
// als 25° von der Fläche abweicht. Auf dem flachen Boden erscheinen dann
// helle Keile („Sägezähne") entlang jeder Fuge. Hier bekommt jede Ecke den
// Mittelwert der anliegenden Flächen, die höchstens `crease` von ihrer
// eigenen Fläche abweichen: Flächen bleiben flach, Rundungen bleiben rund.
//
// Arbeitet auf einer glTF-Transform-Primitive mit Indizes. Ecken mit gleicher
// Position, gleichen übrigen Attributen und gleicher neuer Normale werden
// wieder zusammengelegt, damit der Index-Puffer erhalten bleibt.

export function creaseNormals(prim, crease = Math.PI / 6) {
  const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), nor = prim.getAttribute('NORMAL');
  if (!pos || !idx || !nor) return null;
  const P = pos.getArray(), I = idx.getArray(), nTri = I.length / 3, vertsBefore = pos.getCount();
  const fn = new Float32Array(nTri * 3);
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    // Kreuzprodukt ungenormt = flächengewichtet
    fn[t * 3] = uy * vz - uz * vy; fn[t * 3 + 1] = uz * vx - ux * vz; fn[t * 3 + 2] = ux * vy - uy * vx;
  }
  // Ecken je Position (gerundet auf 0,1 mm) sammeln
  const key = (v) => `${Math.round(P[v * 3] * 1e4)},${Math.round(P[v * 3 + 1] * 1e4)},${Math.round(P[v * 3 + 2] * 1e4)}`;
  const byPos = new Map();
  for (let k = 0; k < I.length; k++) {
    const kk = key(I[k]);
    let l = byPos.get(kk); if (!l) byPos.set(kk, l = []);
    l.push(k);
  }
  const cosC = Math.cos(crease);
  const unit = (t) => { const x = fn[t * 3], y = fn[t * 3 + 1], z = fn[t * 3 + 2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const cornerN = new Float32Array(I.length * 3);
  let changed = 0;
  const NA = nor.getArray();
  for (const list of byPos.values()) {
    for (const k of list) {
      const t = (k / 3) | 0, [ax, ay, az] = unit(t);
      let sx = 0, sy = 0, sz = 0;
      for (const k2 of list) {
        const t2 = (k2 / 3) | 0, [bx, by, bz] = unit(t2);
        if (ax * bx + ay * by + az * bz >= cosC) { sx += fn[t2 * 3]; sy += fn[t2 * 3 + 1]; sz += fn[t2 * 3 + 2]; }
      }
      const l = Math.hypot(sx, sy, sz);
      if (l < 1e-20) { sx = NA[I[k] * 3]; sy = NA[I[k] * 3 + 1]; sz = NA[I[k] * 3 + 2]; } else { sx /= l; sy /= l; sz /= l; }
      cornerN.set([sx, sy, sz], k * 3);
      const v = I[k] * 3;
      if (NA[v] * sx + NA[v + 1] * sy + NA[v + 2] * sz < 0.996) changed++;
    }
  }
  // Ecke -> Vertex: alter Vertex + neue Normale (auf 1e-3 gerundet) als Schlüssel
  const remap = new Map(), newIndex = new Uint32Array(I.length), src = [];
  for (let k = 0; k < I.length; k++) {
    const kk = `${I[k]}|${Math.round(cornerN[k * 3] * 1e3)},${Math.round(cornerN[k * 3 + 1] * 1e3)},${Math.round(cornerN[k * 3 + 2] * 1e3)}`;
    let ni = remap.get(kk);
    if (ni === undefined) { ni = src.length; remap.set(kk, ni); src.push(k); }
    newIndex[k] = ni;
  }
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem), A = acc.getArray(), n = acc.getElementSize();
    const out = new A.constructor(src.length * n);
    for (let i = 0; i < src.length; i++) {
      if (sem === 'NORMAL') { out.set(cornerN.subarray(src[i] * 3, src[i] * 3 + 3), i * 3); continue; }
      const v = I[src[i]];
      for (let c = 0; c < n; c++) out[i * n + c] = A[v * n + c];
    }
    acc.setArray(out);
  }
  idx.setArray(src.length > 65535 ? newIndex : new Uint16Array(newIndex));
  return { corners: I.length, changed, vertsBefore, vertsAfter: src.length };
}
