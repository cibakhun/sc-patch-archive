/* ============================================================
   hall-fill.mjs — Geometrie der Fuellung (scripts/build-hall-furniture.mjs,
   FILL): Was die dichte Hallenstufe an einer Stelle ganz weglaesst, nimmt
   die Moebeldatei aus der vollen Stufe mit, auf den Kasten des Eintrags
   zugeschnitten und ohne die Dreiecke, die die dichte Stufe ohnehin
   traegt. Build und verify:hangar-hall rechnen mit denselben Funktionen,
   denselben Probepunkten und derselben Toleranz.
   ============================================================ */

// Naeher als das an einer Flaeche der dichten Stufe gilt ein Punkt als
// deckungsgleich (beide Flaechen flimmerten dort gegeneinander)
export const FILL_TOL = 0.005;

export const inBox = (b, p, pad = 0) => p.every((v, a) => v >= b[0][a] - pad && v <= b[1][a] + pad);

// Beruehrt das Dreieck den Kasten (Huellquader, um pad erweitert)?
export const touches = (b, t, pad = 0) => [0, 1, 2].every((a) => Math.min(t[0][a], t[1][a], t[2][a]) <= b[1][a] + pad && Math.max(t[0][a], t[1][a], t[2][a]) >= b[0][a] - pad);

export const centroid = (t) => [0, 1, 2].map((a) => (t[0][a] + t[1][a] + t[2][a]) / 3);

// Probepunkte eines Dreiecks: Schwerpunkt und drei innere Punkte, je auf
// halbem Weg vom Schwerpunkt zu einer Ecke. Liegt nur ein Teil des
// Dreiecks auf der dichten Stufe (ein langes Dreieck ueber eine Kante
// hinaus), trifft das mindestens eine Probe, der Schwerpunkt allein oft
// nicht.
export const samples = (t) => [centroid(t), ...[0, 1, 2].map((k) => [0, 1, 2].map((a) => (4 * t[k][a] + t[(k + 1) % 3][a] + t[(k + 2) % 3][a]) / 6))];

const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
export function normalOf(t) {
  const u = sub(t[1], t[0]), v = sub(t[2], t[0]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1;
  return n.map((x) => x / l);
}
// Dreiecke der dichten Stufe als { t, n } fuer onLite
export const withNormals = (list) => list.map((t) => ({ t, n: normalOf(t) }));
// Liegt der Punkt q eines Dreiecks mit Normale n auf einer Flaeche der
// dichten Stufe? Naeher als FILL_TOL und annaehernd gleich ausgerichtet
// (bis 25°): Nur so flimmern zwei Flaechen gegeneinander. Kreuzt eine
// Flaeche nur, etwa eine Ebene laengs durch ein Rohr, liegen die Proben an
// der Schnittlinie auch nahe, flimmern aber nicht.
export const onLite = (q, n, near) => near.some((l) => Math.abs(n[0] * l.n[0] + n[1] * l.n[1] + n[2] * l.n[2]) >= 0.9 && dist2(q, l.t) <= FILL_TOL * FILL_TOL);

// Schneidet ein Vieleck auf den Kasten zu (Sutherland-Hodgman an seinen
// sechs Ebenen). Ecken sind { p: [x, y, z], a: [Attribut, …] }; die
// Attribute laufen linear mit. Liefert die Ecken des Rests, leer, wenn
// nichts im Kasten liegt.
const lerp = (u, v, s) => u.map((x, i) => x + (v[i] - x) * s);
export function clipToBox(poly, box) {
  for (let axis = 0; axis < 3 && poly.length; axis++) for (const side of [0, 1]) {
    const lim = box[side][axis], inside = (v) => (side ? v.p[axis] <= lim : v.p[axis] >= lim), out = [];
    poly.forEach((cur, i) => {
      const prev = poly[(i + poly.length - 1) % poly.length];
      if (inside(cur) !== inside(prev)) {
        const s = (lim - prev.p[axis]) / (cur.p[axis] - prev.p[axis]);
        out.push({ p: lerp(prev.p, cur.p, s), a: prev.a.map((x, k) => lerp(x, cur.a[k], s)) });
      }
      if (inside(cur)) out.push(cur);
    });
    poly = out;
  }
  return poly;
}

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
