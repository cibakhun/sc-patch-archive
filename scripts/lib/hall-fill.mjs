/* ============================================================
   hall-fill.mjs — Geometrie der Fuellung (scripts/build-hall-furniture.mjs,
   FILL): Was die dichte Hallenstufe an einer Stelle ganz weglaesst, nimmt
   die Moebeldatei aus der vollen Stufe mit, nur die Dreiecke, die die
   dichte Stufe nicht deckungsgleich traegt. Build und verify:hangar-hall
   rechnen mit denselben Funktionen und derselben Toleranz.
   ============================================================ */

// Naeher als das an einer Flaeche der dichten Stufe gilt ein Dreieck als
// deckungsgleich (beide flimmerten gegeneinander)
export const FILL_TOL = 0.005;

export const inBox = (b, p, pad = 0) => p.every((v, a) => v >= b[0][a] - pad && v <= b[1][a] + pad);

// Beruehrt das Dreieck den Kasten (Huellquader, um pad erweitert)?
export const touches = (b, t, pad = 0) => [0, 1, 2].every((a) => Math.min(t[0][a], t[1][a], t[2][a]) <= b[1][a] + pad && Math.max(t[0][a], t[1][a], t[2][a]) >= b[0][a] - pad);

export const centroid = (t) => [0, 1, 2].map((a) => (t[0][a] + t[1][a] + t[2][a]) / 3);

// Dreiecke einer Primitive (gltf-transform) im Raum ihres Knotens samt
// Eltern; ohne Indizes je drei Ecken eins
export function worldTris(node, prim) {
  const w = node.getWorldMatrix(), P = prim.getAttribute('POSITION').getArray(), I = prim.getIndices()?.getArray();
  const at = (i) => [0, 1, 2].map((a) => w[a] * P[i * 3] + w[4 + a] * P[i * 3 + 1] + w[8 + a] * P[i * 3 + 2] + w[12 + a]);
  const n = I ? I.length / 3 : P.length / 9, out = [];
  for (let t = 0; t < n; t++) out.push(I ? [at(I[t * 3]), at(I[t * 3 + 1]), at(I[t * 3 + 2])] : [at(t * 3), at(t * 3 + 1), at(t * 3 + 2)]);
  return out;
}

// Quadrat des Abstands von p zum Dreieck [a, b, c] (naechster Punkt nach
// Ericson, Real-Time Collision Detection 5.1.5)
export function dist2(p, [a, b, c]) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const at = (o, u, s) => [o[0] + s * u[0], o[1] + s * u[1], o[2] + s * u[2]];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  let q;
  if (d1 <= 0 && d2 <= 0) q = a;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp), vc = d1 * d4 - d3 * d2;
    const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp), vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) q = b;
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) q = at(a, ab, d1 / (d1 - d3));
    else if (d6 >= 0 && d5 <= d6) q = c;
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) q = at(a, ac, d2 / (d2 - d6));
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) q = at(b, sub(c, b), (d4 - d3) / ((d4 - d3) + (d5 - d6)));
    else { const den = 1 / (va + vb + vc); q = at(at(a, ab, vb * den), ac, vc * den); }
  }
  const d = sub(p, q);
  return dot(d, d);
}
