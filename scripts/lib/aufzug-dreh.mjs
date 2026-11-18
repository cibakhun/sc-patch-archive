// Bahnen der Teile eines Bodentors (aufzugPlan in scripts/build-hangar-assets.mjs).
//
// Die Knochen eines Tors stehen in einem Baum; jede Lage gilt im Raum des
// Elternknochens. Das nmc dump des Extraktors nennt sie b2w, sie ist aber
// die Lage gegen den Elternknochen (belegt am Tor der Medium- und der
// XL-Halle: dort steht der rechte Flügel um 180° um die Hochachse gedreht,
// seine Lamellen fahren mit -6 m in diesem Raum, in der Halle also nach
// +x; und lock_helper_r_01 trägt dieselben Zahlen wie seine Ortsspur).
// Darum rechnet diese Datei die Kette mit Drehungen aus, statt Versätze zu
// summieren.
//
// Das Tor der XL-Halle (utl_hangar_ship_elev_door_xl_a) trägt an seinen
// Flügelkanten Riegel, deren Knochen (lock_helper_*) nicht schieben, sondern
// schwenken: geschlossen um rund 170 bis 190° um die Querachse, in der
// letzten Sekunde von door_close und der ersten von door_open.
//
// Eingaben (hall/<halle>.tor.json des Extraktors, Raum der .cga, Z oben):
//   nodes[i] = { index, name, parent, t, r? }  Lage gegen den Elternknochen in
//     Ruhe (r Drehung als 3 Zeilen, fehlt bei der Einheit; t Ort)
//   cafs[k].tracks[bone] = [[Bild, x, y, z], …]      Ort im Raum des Elternknochens
//   cafs[k].rot[bone]    = [[Bild, x, y, z, w], …]   Drehung im Raum des Elternknochens
// Ausgabe je Teil, im Modellraum der Halle (D = Weltmatrix des Tor-Netzes,
// glTF spaltenweise): keys [s, dx, dy, dz], der Versatz seines Knochens
// gegen zu; dreht er dabei, dazu pivot, der Ort des Knochens in Ruhe, und
// rot [s, qx, qy, qz, qw], die Drehung um ihn. Der Viewer stellt ein Teil
// so: x' = q (x − pivot) + pivot + d.

const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mal = (A, B) => A.map((z) => [0, 1, 2].map((k) => z[0] * B[0][k] + z[1] * B[1][k] + z[2] * B[2][k]));
const quer = (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
const an = (A, v) => A.map((z) => z[0] * v[0] + z[1] * v[1] + z[2] * v[2]);
const minus = (a, b) => a.map((v, i) => v - b[i]);
const plus = (a, b) => a.map((v, i) => v + b[i]);

/** Quaternion [x, y, z, w] als Drehmatrix (Zeilen) */
export function qMatrix(q) {
  const n = Math.hypot(...q), [x, y, z, w] = q.map((v) => v / n);
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}
/** Drehmatrix (Zeilen) als Quaternion [x, y, z, w], w ≥ 0 */
export function matrixQ(m) {
  const tr = m[0][0] + m[1][1] + m[2][2];
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s, s / 4]; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = [s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s, (m[2][1] - m[1][2]) / s]; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = [(m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s, (m[0][2] - m[2][0]) / s]; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = [(m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4, (m[1][0] - m[0][1]) / s]; }
  return q[3] < 0 ? q.map((v) => -v) : q;
}
/** Winkel einer Drehmatrix in Grad */
export const winkel = (m) => (Math.acos(Math.max(-1, Math.min(1, (m[0][0] + m[1][1] + m[2][2] - 1) / 2))) * 180) / Math.PI;

function slerp(a, b, w) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const c = d < 0 ? b.map((v) => -v) : b;
  d = Math.abs(d);
  if (d > 0.9995) { const q = a.map((v, i) => v + (c[i] - v) * w), n = Math.hypot(...q); return q.map((v) => v / n); }
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((v, i) => (Math.sin((1 - w) * th) * v + Math.sin(w * th) * c[i]) / s);
}
// Wert einer Spur zum Bild f: Ort linear, Drehung sphärisch zwischen den Schlüsseln
function spurAn(tr, f, dreh) {
  if (f <= tr[0][0]) return tr[0].slice(1);
  for (let k = 1; k < tr.length; k++) {
    if (tr[k][0] < f) continue;
    const a = tr[k - 1], b = tr[k], w = (f - a[0]) / (b[0] - a[0] || 1);
    return dreh ? slerp(a.slice(1), b.slice(1), w) : a.slice(1).map((v, i) => v + (b[i + 1] - v) * w);
  }
  return tr[tr.length - 1].slice(1);
}

/**
 * Werkzeug je Tor: Lage jedes Knochens in der Halle der .cga, in Ruhe und
 * zu jedem Bild einer Spur. Knochen ohne Spur bleiben in ihrer Ruhelage
 * gegen den Elternknochen.
 */
export function knochenWerk(part) {
  const by = new Map(part.nodes.map((n) => [n.index, n]));
  const eltern = (n) => (n.parent != null ? by.get(n.parent) : null);
  const setze = (P, R, t) => (P ? { R: mal(P.R, R), t: plus(an(P.R, t), P.t) } : { R, t });
  const ruhe = (n) => setze(eltern(n) ? ruhe(eltern(n)) : null, n.r ?? I3, n.t);
  const lage = (n, caf, f) => {
    const pos = caf.tracks?.[n.name], rot = caf.rot?.[n.name];
    const R = rot ? qMatrix(spurAn(rot, f, true)) : n.r ?? I3, t = pos ? spurAn(pos, f, false) : n.t;
    return setze(eltern(n) ? lage(eltern(n), caf, f) : null, R, t);
  };
  const kette = (n) => { const out = []; for (let a = n; a; a = eltern(a)) out.push(a); return out; };
  return { by, ruhe, lage, kette };
}

/**
 * Bahn eines Teils (Knochen bone) über die Spuren close und open, im
 * Modellraum der Halle. D: Weltmatrix des Tor-Netzes (glTF, 16 Werte
 * spaltenweise), steps: gleichmäßige Stützstellen je Spur; dazu kommen die
 * Bilder, an denen eine Drehspur der Kette sich ändert. dreht: ob das Teil
 * dabei um mehr als 0,01° dreht; nur dann trägt die Bahn pivot und rot.
 */
export function torBahn(part, bone, D, { steps = 60, tol = { m: 0.01, grad: 0.5 } } = {}) {
  const W = knochenWerk(part);
  const n = part.nodes.find((x) => x.name === bone);
  if (!n) throw new Error(`Tor: Knochen ${bone} fehlt`);
  const A = [[D[0], D[4], D[8]], [D[1], D[5], D[9]], [D[2], D[6], D[10]]];
  const AAt = mal(A, quer(A));
  if (AAt.some((z, i) => z.some((v, k) => Math.abs(v - (i === k ? 1 : 0)) > 1e-6))) throw new Error('Tor: seine Lage in der Halle ist keine reine Drehung (Skalierung oder Scherung)');
  const At = quer(A), ins = (v) => plus(an(A, v), [D[12], D[13], D[14]]);
  const r3 = (v) => Math.round(v * 1000) / 1000 + 0, r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
  const ruhe = W.ruhe(n), Rt = quer(ruhe.R);
  const kette = W.kette(n).map((k) => k.name);
  let maxGrad = 0;
  const bahn = (caf) => {
    const bilder = new Set([...Array(steps + 1)].map((_, k) => (k / steps) * caf.frames));
    for (const name of kette) {
      const tr = caf.rot?.[name];
      if (!tr) continue;
      tr.forEach((s, k) => {
        const anders = (o) => o && o.slice(1).some((v, i) => Math.abs(v - s[i + 1]) > 1e-5);
        if (anders(tr[k - 1]) || anders(tr[k + 1])) bilder.add(Math.min(caf.frames, Math.max(0, s[0])));
      });
    }
    const keys = [], rot = [];
    let prev = null;
    for (const f of [...bilder].sort((a, b) => a - b)) {
      const L = W.lage(n, caf, f);
      const d = an(A, minus(L.t, ruhe.t)), Rd = mal(L.R, Rt), Rm = mal(mal(A, Rd), At);
      maxGrad = Math.max(maxGrad, winkel(Rd));
      let q = matrixQ(Rm);
      if (prev && q[0] * prev[0] + q[1] * prev[1] + q[2] * prev[2] + q[3] * prev[3] < 0) q = q.map((v) => -v);
      prev = q;
      const s = r3(f / caf.fps);
      keys.push([s, ...d.map(r3)]);
      rot.push([s, ...q.map(r5)]);
    }
    return { keys, rot };
  };
  const close = part.cafs.door_close, open = part.cafs.door_open;
  // zu = Ruhelage der .cga: dort endet door_close und beginnt door_open, in Ort und Drehung
  for (const [caf, f, wo] of [[close, close.frames, 'am Ende von door_close'], [open, 0, 'am Anfang von door_open']]) {
    const L = W.lage(n, caf, f), m = Math.hypot(...minus(L.t, ruhe.t)), g = winkel(mal(L.R, Rt));
    if (m > tol.m || g > tol.grad) throw new Error(`Tor: ${bone} steht ${wo} ${m.toFixed(3)} m und ${g.toFixed(2)}° neben seiner Ruhelage: Spur und Knotenbaum passen nicht zusammen`);
  }
  const c = bahn(close), o = bahn(open);
  const dreht = maxGrad > 0.01;
  return { keys: { close: c.keys, open: o.keys }, ...(dreht ? { pivot: ins(ruhe.t).map(r3), rot: { close: c.rot, open: o.rot } } : {}), dreht, maxGrad, kette };
}

/**
 * Teile des Tors, die offen über dem Feld des Aufzugs liegen (Ende von
 * door_open). Offen liegt jedes Teil unter dem Hallenboden neben der
 * Öffnung; ragt eines um mehr als `rand` Meter in beiden Richtungen ins Feld,
 * fährt es falsch herum (so am rechten Flügel der Medium-Halle, solange der
 * Build Versätze summierte, statt die Drehung des Flügels mitzurechnen).
 * teile: Einträge aus <halle>.aufzug.json (box, keys, keysRot?, pivot?),
 * feld: { from: [x, z], to: [x, z] }. Liefert [{ node, x, z }] mit der Tiefe
 * der Überdeckung in x und z.
 */
export function offenImFeld(teile, feld, rand = 0.5) {
  const out = [];
  for (const t of teile) {
    const d = t.keys.open.at(-1).slice(1), [lo, hi] = t.box;
    let ecken = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]);
    if (t.keysRot && t.pivot) {
      const R = qMatrix(t.keysRot.open.at(-1).slice(1));
      ecken = ecken.map((e) => plus(an(R, minus(e, t.pivot)), t.pivot));
    }
    ecken = ecken.map((e) => plus(e, d));
    const x0 = Math.min(...ecken.map((e) => e[0])), x1 = Math.max(...ecken.map((e) => e[0]));
    const z0 = Math.min(...ecken.map((e) => e[2])), z1 = Math.max(...ecken.map((e) => e[2]));
    const x = Math.min(x1, feld.to[0]) - Math.max(x0, feld.from[0]), z = Math.min(z1, feld.to[1]) - Math.max(z0, feld.from[1]);
    if (x > rand && z > rand) out.push({ node: t.node, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
  }
  return out;
}

/**
 * Wie weit die Mitte eines drehenden Teils (Modellraum) von der Achse liegt,
 * um die es schwenkt (durch pivot, Richtung aus der größten Drehung seiner
 * Bahn). Liegt sie weit ab, dreht das Teil um einen falschen Punkt.
 */
export function achsAbstand(bahn, mitte) {
  let best = null, g = -1;
  for (const k of ['close', 'open']) for (const r of bahn.rot[k]) { const w = Math.abs(r[4]) < 1 ? 2 * Math.acos(Math.min(1, Math.abs(r[4]))) : 0; if (w > g) { g = w; best = r; } }
  const v = best.slice(1, 4), n = Math.hypot(...v);
  if (!(n > 1e-9)) return 0;
  const a = v.map((x) => x / n), p = minus(mitte, bahn.pivot), s = p[0] * a[0] + p[1] * a[1] + p[2] * a[2];
  return Math.hypot(...p.map((x, i) => x - s * a[i]));
}
