// Spiellampen der Halle: Richtung umrechnen, Flächenlichter an ihrer Fläche
// ausrichten.
//
// Der Export legt die Lampen als KHR_lights_punctual-Knoten ab. Die Positionen
// stimmen, die Ausrichtung nicht:
// - Spots: Die −Z-Spalte der Weltmatrix ist ein Vektor im Z-oben-Raum des
//   Spiels und muss nach glTF (x, z, −y). Nachgeprüft per Strahl an der
//   Deluxe-Halle (2026-10-07): Von 30 an einer Fläche montierten Spots zeigen
//   so 19 von ihr weg, ohne Umrechnung einer; die beiden Hauptstrahler unter
//   der Decke zeigen so senkrecht auf den Boden statt waagrecht durch die Halle.
// - Flächenlichter kommen als Punktlichter an; ihre Spalte passt unter keiner
//   Achsvertauschung (bestenfalls 73 von 206). Sie sitzen aber an einer Fläche
//   (Leuchtpaneel, Leiste) und strahlen von ihr weg: Richtung = Normale der
//   nächsten Fläche, zur Lampe hin gedreht.
//
// Arbeitet auf Weltkoordinaten der Halle (glTF-Raum, wie im GLB).

/** CryEngine-Richtung (Z oben) -> glTF (Y oben). */
export const cryToGltf = (d) => [d[0], d[2], -d[1]];

/** Dreiecke aller undurchsichtigen Hallenflächen in Weltkoordinaten, mit BVH. */
export function hallRaycaster(doc, skip = /glass|grid_grayyellow/i) {
  const tris = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const w = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      if (skip.test(mat?.getName() || '') || mat?.getAlphaMode() === 'BLEND') continue;
      const pos = prim.getAttribute('POSITION'), idx = prim.getIndices();
      if (!pos) continue;
      const P = pos.getArray(), n = pos.getCount(), W = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        W[i * 3] = w[0] * x + w[4] * y + w[8] * z + w[12];
        W[i * 3 + 1] = w[1] * x + w[5] * y + w[9] * z + w[13];
        W[i * 3 + 2] = w[2] * x + w[6] * y + w[10] * z + w[14];
      }
      const I = idx ? idx.getArray() : null, m = I ? I.length : n;
      for (let k = 0; k + 2 < m; k += 3) {
        const a = I ? I[k] : k, b = I ? I[k + 1] : k + 1, c = I ? I[k + 2] : k + 2;
        tris.push(W[a * 3], W[a * 3 + 1], W[a * 3 + 2], W[b * 3], W[b * 3 + 1], W[b * 3 + 2], W[c * 3], W[c * 3 + 1], W[c * 3 + 2]);
      }
    }
  }
  const T = new Float32Array(tris), NT = T.length / 9;
  const C = [new Float32Array(NT), new Float32Array(NT), new Float32Array(NT)];
  for (let t = 0; t < NT; t++) for (let a = 0; a < 3; a++) C[a][t] = (T[t * 9 + a] + T[t * 9 + 3 + a] + T[t * 9 + 6 + a]) / 3;
  const order = new Uint32Array(NT);
  for (let i = 0; i < NT; i++) order[i] = i;
  const nodes = [];
  const build = (s, e) => {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = s; i < e; i++) {
      const o = order[i] * 9;
      for (let v = 0; v < 9; v++) { const a = v % 3, q = T[o + v]; if (q < mn[a]) mn[a] = q; if (q > mx[a]) mx[a] = q; }
    }
    const id = nodes.length;
    nodes.push({ mn, mx, l: -1, r: -1, s, c: e - s });
    if (e - s <= 8) return id;
    const ext = [0, 1, 2].map((a) => mx[a] - mn[a]);
    const ax = ext[0] > ext[1] ? (ext[0] > ext[2] ? 0 : 2) : (ext[1] > ext[2] ? 1 : 2);
    const sub = Array.from(order.subarray(s, e)).sort((p, q) => C[ax][p] - C[ax][q]);
    order.set(sub, s);
    const mid = (s + e) >> 1;
    nodes[id].l = build(s, mid);
    nodes[id].r = build(mid, e);
    return id;
  };
  if (NT) build(0, NT);
  /** Nächster Treffer entlang d (Einheitsvektor): { t, n } mit Flächennormale, oder null. */
  function ray(o, d, tmax = 300) {
    if (!NT) return null;
    const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
    let best = tmax, hit = -1;
    const stack = [0];
    while (stack.length) {
      const nd = nodes[stack.pop()];
      let t0 = 0, t1 = best, miss = false;
      for (let a = 0; a < 3 && !miss; a++) {
        let ta = (nd.mn[a] - o[a]) * inv[a], tb = (nd.mx[a] - o[a]) * inv[a];
        if (ta > tb) { const q = ta; ta = tb; tb = q; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) miss = true;
      }
      if (miss) continue;
      if (nd.l >= 0) { stack.push(nd.l, nd.r); continue; }
      for (let i = nd.s; i < nd.s + nd.c; i++) {
        const k = order[i] * 9;
        const e1x = T[k + 3] - T[k], e1y = T[k + 4] - T[k + 1], e1z = T[k + 5] - T[k + 2];
        const e2x = T[k + 6] - T[k], e2y = T[k + 7] - T[k + 1], e2z = T[k + 8] - T[k + 2];
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const id = 1 / det, sx = o[0] - T[k], sy = o[1] - T[k + 1], sz = o[2] - T[k + 2];
        const u = (sx * px + sy * py + sz * pz) * id;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (d[0] * qx + d[1] * qy + d[2] * qz) * id;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * id;
        if (t > 1e-4 && t < best) { best = t; hit = order[i]; }
      }
    }
    if (hit < 0) return null;
    const k = hit * 9;
    const e1 = [T[k + 3] - T[k], T[k + 4] - T[k + 1], T[k + 5] - T[k + 2]], e2 = [T[k + 6] - T[k], T[k + 7] - T[k + 1], T[k + 8] - T[k + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...n) || 1;
    return { t: best, n: n.map((x) => x / l) };
  }
  return { ray, triangles: NT };
}

// 26 Richtungen: Würfelflächen, -kanten und -ecken
const DIRS = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  if (!x && !y && !z) continue;
  const l = Math.hypot(x, y, z);
  DIRS.push([x / l, y / l, z / l]);
}

/**
 * Richtet die Lampenliste aus (verändert sie): Spots umgerechnet, Flächenlichter
 * von der nächsten Fläche weg (bis `reach` m; weiter weg: dir null = rundum).
 * Gibt eine Selbstauskunft zurück.
 */
export function orientHallLights(lights, rc, reach = 1.2) {
  const out = { spots: 0, area: 0, areaMounted: 0, spotsAway: 0, spotsMounted: 0 };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  for (const l of lights) {
    if (l.type === 'spot' && l.dir) {
      l.dir = cryToGltf(l.dir).map(r3);
      out.spots++;
      // Gegenprobe: sitzt der Spot an einer Fläche, zeigt er von ihr weg?
      const back = rc.ray(l.pos, l.dir.map((x) => -x), reach);
      if (back) { out.spotsMounted++; if (!(rc.ray(l.pos, l.dir, 0.6))) out.spotsAway++; }
    } else if (l.type === 'area') {
      out.area++;
      let best = null;
      for (const d of DIRS) {
        const h = rc.ray(l.pos, d, reach);
        if (h && (!best || h.t < best.t)) best = { ...h, d };
      }
      if (best) {
        // Normale zur Lampe hin drehen
        const s = best.n[0] * best.d[0] + best.n[1] * best.d[1] + best.n[2] * best.d[2] > 0 ? -1 : 1;
        l.dir = best.n.map((x) => r3(x * s));
        l.gap = r3(best.t);
        out.areaMounted++;
      } else {
        l.dir = null;
      }
    }
  }
  return out;
}
