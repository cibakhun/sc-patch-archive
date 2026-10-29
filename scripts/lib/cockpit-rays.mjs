/* ============================================================
   cockpit-rays.mjs — Strahlen durch die Haube eines Schiffsmodells.

   Gemeinsam fuer das Werkzeug scripts/measure-hangar-cockpit.mjs (Rohexport
   gegen Web-Fassung, PC) und das Tor scripts/verify-hangar-cockpit.mjs
   (Schiene A). Anlass und Befund: .planning/notes/hangar-cockpit-hohl.md
   (Krisz, 29.10.2026, Gladius: „siehst wie das schiff von innen hohl ist?“).

   Je Schiff RAYS Strahlen von aussen durch das Haubenglas hinein
   (Stichprobe flaechengewichtet, Richtung zur Haubenmitte und nach unten,
   leicht gestreut, fester Startwert: gleiche Datei, gleiches Ergebnis).
   Hinter dem Glas zaehlt die erste undurchsichtige Flaeche:
     Vorderseite oder zweiseitig  → zu (man sieht etwas)
     Rueckseite eines einseitigen  → hohl (man sieht durch eine Flaeche)
     nichts bis REACH             → frei (Glas auf beiden Seiten)
   Bei hohl zaehlt dazu, was hinter der Rueckseite kommt: eine Flaeche, die
   der Viewer zeichnet (man sieht durch eine Innenwand auf das Schiff),
   oder bis REACH nichts → durch (man sieht durch das Schiff in die Halle,
   das Bild aus Krisz' Meldung).
   Glas = Material mit glass/canopy/window im Namen und Alpha BLEND,
   ohne Scheinwerfer- und Lampenglaeser. Ein Startpunkt zaehlt nur, wenn er
   von aussen frei zu sehen ist (der Gegenstrahl trifft nichts
   Undurchsichtiges): Innenfenster eines behaltenen Innenraums sind keine
   Haube.

   WERKZEUG nennt die Fassung der Messung. Wer an Strahlen, Glas oder den
   Regeln dreht, zaehlt sie hoch: Das Tor misst dann jedes Schiff neu,
   statt Werte einer anderen Rechnung wiederzuverwenden.
   ============================================================ */
export const WERKZEUG = 'cockpit-rays 1';
export const RAYS = 160, REACH = 30, NEAR = 8;
const GLASS = /glass|canopy|window/i;
const NOT_GLASS = /headlight|light_glass|lamp|lens|bulb/i;

const mul = (a, b) => {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
};

// strahl(o, d, art, t): je gezaehltem Strahl Ursprung, Richtung (Raum der
// Datei), Art (zu, hohl, durch, frei) und Abstand der ersten Flaeche; zum
// Nachstellen einzelner Blicke im Viewer
export function measure(doc, { strahl } = {}) {
  // Dreiecke in Weltkoordinaten; Art: 0 einseitig, 1 zweiseitig, 2 Glas, 3 sonst durchsichtig
  // nur Knoten, die die Szene erreicht: was der Viewer zeichnet (lose
  // Knoten im Kreis, Hornet F7C-R, CSV-Cargo: verify-hangar-gear.mjs)
  const parts = []; let T = 0; const seen = new Set();
  const walk = (node, parent) => {
    if (seen.has(node)) return;
    seen.add(node);
    const W = mul(parent, node.getMatrix());
    for (const p of node.getMesh()?.listPrimitives() ?? []) {
      if (p.getMode() !== 4 || !p.getAttribute('POSITION')) continue;
      const n = Math.floor((p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3);
      parts.push({ W, p, n }); T += n;
    }
    for (const c of node.listChildren()) walk(c, W);
  };
  for (const scene of doc.getRoot().listScenes()) for (const node of scene.listChildren()) walk(node, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const X = new Float64Array(T * 9), kind = new Uint8Array(T);
  let t0 = 0;
  for (const { W, p, n } of parts) {
    const m = p.getMaterial(); const name = m?.getName() || '';
    const blend = m?.getAlphaMode() === 'BLEND';
    const k = blend && GLASS.test(name) && !NOT_GLASS.test(name) ? 2 : blend ? 3 : m?.getDoubleSided() ? 1 : 0;
    const P = p.getAttribute('POSITION'); const I = p.getIndices()?.getArray();
    const v = new Float64Array(P.getCount() * 3); const e = [0, 0, 0];
    for (let i = 0; i < P.getCount(); i++) {
      P.getElement(i, e);
      v[3 * i] = W[0] * e[0] + W[4] * e[1] + W[8] * e[2] + W[12];
      v[3 * i + 1] = W[1] * e[0] + W[5] * e[1] + W[9] * e[2] + W[13];
      v[3 * i + 2] = W[2] * e[0] + W[6] * e[1] + W[10] * e[2] + W[14];
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) { const a = I ? I[3 * i + j] : 3 * i + j; X[9 * (t0 + i) + 3 * j] = v[3 * a]; X[9 * (t0 + i) + 3 * j + 1] = v[3 * a + 1]; X[9 * (t0 + i) + 3 * j + 2] = v[3 * a + 2]; }
      kind[t0 + i] = k;
    }
    t0 += n;
  }
  const glass = []; for (let t = 0; t < T; t++) if (kind[t] === 2) glass.push(t);
  if (!glass.length) return { tris: T, glass: 0 };
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of glass) for (let j = 0; j < 9; j++) { const k = j % 3; lo[k] = Math.min(lo[k], X[9 * t + j]); hi[k] = Math.max(hi[k], X[9 * t + j]); }
  // Kandidaten: Dreiecke mit einer Ecke im Hüllquader der Haube plus Rand;
  // NEAR für die erste Fläche, REACH für den Blick hinter eine Rückseite
  const nah = new Uint8Array(T), weit = [];
  const inBox = (t, r) => { for (let j = 0; j < 3; j++) { const q = 9 * t + 3 * j; if (X[q] > lo[0] - r && X[q] < hi[0] + r && X[q + 1] > lo[1] - r && X[q + 1] < hi[1] + r && X[q + 2] > lo[2] - r && X[q + 2] < hi[2] + r) return true; } return false; };
  for (let t = 0; t < T; t++) if (inBox(t, REACH)) { weit.push(t); if (inBox(t, NEAR)) nah[t] = 1; }
  const tree = bvh(X, weit);
  const area = glass.map((t) => { const b = 9 * t; const e1 = [X[b + 3] - X[b], X[b + 4] - X[b + 1], X[b + 5] - X[b + 2]], e2 = [X[b + 6] - X[b], X[b + 7] - X[b + 1], X[b + 8] - X[b + 2]];
    return Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2; });
  const total = area.reduce((a, b) => a + b, 0);
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ctr = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
  let zu = 0, hohl = 0, frei = 0, innen = 0, durch = 0;
  for (let s = 0, tries = 0; s < RAYS && tries < 20 * RAYS; tries++) {
    let r = rnd() * total, g = 0; while (r > area[g] && g < area.length - 1) r -= area[g++];
    const b = 9 * glass[g]; let u = rnd(), w = rnd(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const p = [0, 1, 2].map((k) => X[b + k] + u * (X[b + 3 + k] - X[b + k]) + w * (X[b + 6 + k] - X[b + k]));
    let d = [0, 1, 2].map((k) => ctr[k] - p[k] + (rnd() - 0.5) * 0.6 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 0.3);
    const dl = Math.hypot(...d); d = d.map((x) => x / dl);
    // nur Außenglas: von außen muss der Punkt frei zu sehen sein. Innenfenster
    // (Türen, Zwischenwände) zählten sonst mit, und ihre Strahlen träfen die
    // Rückseiten von Wänden mitten im Schiff
    if (firstHit(p, d.map((x) => -x), 0.02).t < REACH) { innen++; continue; }
    s++;
    const o = [0, 1, 2].map((k) => p[k] - d[k] * 0.3);
    const { t: best, tri: bestT, front: bestFront } = firstHit(o, d, 0.32);
    let art = 'zu';
    if (bestT < 0) { frei++; art = 'frei'; }
    else if (bestFront) zu++;
    else {
      hohl++; art = 'hohl';
      // hinter der Rückseite: sieht man noch eine Fläche des Schiffs, oder die Halle?
      if (firstHit(o, d, best + 0.01, true).tri < 0) { durch++; art = 'durch'; }
    }
    strahl?.(o, d, art, best);
  }
  // erste undurchsichtige Fläche auf dem Strahl o + t·d (t > tmin), ohne
  // sichtbar nur unter den nahen Dreiecken; sichtbar: nur Flächen, die der
  // Viewer von dort zeichnet, bis REACH
  // Liegt bis 2 cm hinter der nächsten Fläche eine Vorderseite (Decal,
  // doppelte Lage), zählt die: unabhängig von der Reihenfolge der Dreiecke.
  function firstHit(o, d, tmin, sichtbar = false) {
    let best = Infinity, bestT = -1, bestF = Infinity, bestFT = -1;
    const inv = d.map((x) => 1 / (Math.abs(x) < 1e-12 ? 1e-12 : x));
    const { box, kid, tri } = tree; const st = [0];
    while (st.length) {
      const ni = st.pop(), q6 = 6 * ni;
      let tn = tmin, tf = Math.min(best + 0.02, REACH);
      for (let k = 0; k < 3 && tn <= tf; k++) {
        const a = (box[q6 + k] - o[k]) * inv[k], c = (box[q6 + 3 + k] - o[k]) * inv[k];
        tn = Math.max(tn, Math.min(a, c)); tf = Math.min(tf, Math.max(a, c));
      }
      if (tn > tf) continue;
      const cnt = kid[2 * ni + 1];
      if (!cnt) { st.push(kid[2 * ni], kid[2 * ni] + 1); continue; }
      for (let i = kid[2 * ni]; i < kid[2 * ni] + cnt; i++) {
        const t = tri[i]; if (kind[t] >= 2 || (!sichtbar && !nah[t])) continue; // durchsichtig oder fern
        const q = 9 * t; // Möller–Trumbore
        const e1x = X[q + 3] - X[q], e1y = X[q + 4] - X[q + 1], e1z = X[q + 5] - X[q + 2], e2x = X[q + 6] - X[q], e2y = X[q + 7] - X[q + 1], e2z = X[q + 8] - X[q + 2];
        const hx = d[1] * e2z - d[2] * e2y, hy = d[2] * e2x - d[0] * e2z, hz = d[0] * e2y - d[1] * e2x;
        const a = e1x * hx + e1y * hy + e1z * hz; if (Math.abs(a) < 1e-12) continue;
        const f = 1 / a, sx = o[0] - X[q], sy = o[1] - X[q + 1], sz = o[2] - X[q + 2];
        const uu = f * (sx * hx + sy * hy + sz * hz); if (uu < 0 || uu > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const vv = f * (d[0] * qx + d[1] * qy + d[2] * qz); if (vv < 0 || uu + vv > 1) continue;
        const tt = f * (e2x * qx + e2y * qy + e2z * qz);
        if (tt <= tmin || tt >= REACH) continue; // vor dem Glas oder zu weit
        // a = -d·(e1×e2): a > 0 heißt, der Strahl sieht die Vorderseite
        const front = a > 0 || kind[t] === 1;
        if (sichtbar && !front) continue;
        if (tt < best) { best = tt; bestT = t; }
        if (front && tt < bestF) { bestF = tt; bestFT = t; }
      }
    }
    const front = bestFT >= 0 && bestF <= best + 0.02;
    return { t: best, tri: front ? bestFT : bestT, front };
  }
  const rays = zu + hohl + frei;
  return { tris: T, glass: glass.length, rays, innen, zu, hohl, frei, durch, hohlPct: rays ? Math.round((100 * hohl) / rays) : null, durchPct: rays ? Math.round((100 * durch) / rays) : null };
}

// Hüllquaderbaum über die Dreiecke ids (Teilung in der Mitte der längsten
// Achse der Schwerpunkte, Blätter bis 8 Dreiecke): ein Strahl prüft so
// einige hundert statt aller Dreiecke um die Haube.
function bvh(X, ids) {
  const LEAF = 8, n = ids.length, T = X.length / 9;
  const tri = Int32Array.from(ids);
  // je Dreieck (nach Nummer) Hüllquader und dessen Mitte
  const tb = new Float32Array(T * 6), cen = new Float32Array(T * 3);
  for (const t of ids) for (let k = 0; k < 3; k++) {
    const a = X[9 * t + k], b = X[9 * t + 3 + k], c = X[9 * t + 6 + k];
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c);
    tb[6 * t + k] = lo; tb[6 * t + 3 + k] = hi; cen[3 * t + k] = (lo + hi) / 2;
  }
  const max = Math.max(1, Math.ceil(n / 2) + 2);
  const box = new Float32Array(max * 6), kid = new Int32Array(max * 2);
  let used = 1;
  const st = [0, 0, n];
  while (st.length) {
    const e = st.pop(), s = st.pop(), ni = st.pop();
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
    for (let i = s; i < e; i++) {
      const t = tri[i], b = 6 * t, c = 3 * t;
      if (tb[b] < x0) x0 = tb[b]; if (tb[b + 1] < y0) y0 = tb[b + 1]; if (tb[b + 2] < z0) z0 = tb[b + 2];
      if (tb[b + 3] > x1) x1 = tb[b + 3]; if (tb[b + 4] > y1) y1 = tb[b + 4]; if (tb[b + 5] > z1) z1 = tb[b + 5];
      if (cen[c] < cx0) cx0 = cen[c]; if (cen[c] > cx1) cx1 = cen[c];
      if (cen[c + 1] < cy0) cy0 = cen[c + 1]; if (cen[c + 1] > cy1) cy1 = cen[c + 1];
      if (cen[c + 2] < cz0) cz0 = cen[c + 2]; if (cen[c + 2] > cz1) cz1 = cen[c + 2];
    }
    const q = 6 * ni;
    box[q] = x0 - 1e-3; box[q + 1] = y0 - 1e-3; box[q + 2] = z0 - 1e-3; box[q + 3] = x1 + 1e-3; box[q + 4] = y1 + 1e-3; box[q + 5] = z1 + 1e-3;
    if (e - s <= LEAF) { kid[2 * ni] = s; kid[2 * ni + 1] = e - s; continue; }
    const dx = cx1 - cx0, dy = cy1 - cy0, dz = cz1 - cz0;
    const ax = dx >= dy && dx >= dz ? 0 : dy >= dz ? 1 : 2;
    // Median nach Mitte (Quickselect)
    const mid = (s + e) >> 1;
    for (let l = s, r = e - 1; l < r;) {
      const pv = cen[3 * tri[(l + r) >> 1] + ax]; let i = l, j = r;
      while (i <= j) {
        while (cen[3 * tri[i] + ax] < pv) i++;
        while (cen[3 * tri[j] + ax] > pv) j--;
        if (i <= j) { const t = tri[i]; tri[i] = tri[j]; tri[j] = t; i++; j--; }
      }
      if (mid <= j) r = j; else if (mid >= i) l = i; else break;
    }
    if (used + 2 > max) throw new Error('bvh: Knotenvorrat zu klein');
    kid[2 * ni] = used; kid[2 * ni + 1] = 0;
    st.push(used, s, mid, used + 1, mid, e); used += 2;
  }
  return { box, kid, tri };
}
