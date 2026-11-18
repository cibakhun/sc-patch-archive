// Bahnen der Teile eines Bodentors (scripts/lib/aufzug-dreh.mjs, aufzugPlan in
// scripts/build-hangar-assets.mjs): Knochen in einer Kette mit Drehungen. Der
// rechte Flügel der Medium- und der XL-Halle steht im Spiel um 180° gedreht,
// die Riegel am Tor der XL-Halle schwenken um ihren Knochen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { achsAbstand, knochenWerk, matrixQ, offenImFeld, qMatrix, torBahn, winkel } from '../../scripts/lib/aufzug-dreh.mjs';

// Raum der .cga (Z oben) -> Modellraum (glTF, y oben): (x, y, z) -> (x, z, -y), dazu ein Versatz
const D = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 10, 2, -30, 1];
const qY = (grad) => { const w = (grad * Math.PI) / 360; return [0, Math.sin(w), 0, Math.cos(w)]; };
const qZ = (grad) => { const w = (grad * Math.PI) / 360; return [0, 0, Math.sin(w), Math.cos(w)]; };
const qDreh = (q, v) => { const [x, y, z, w] = q, [a, b, c] = v, tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a); return [a + w * tx + (y * tz - z * ty), b + w * ty + (z * tx - x * tz), c + w * tz + (x * ty - y * tx)]; };
const nah = (a, b, tol = 2e-3) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

// Tor wie das der XL-Halle, klein. Jede Lage gilt gegen den Elternknochen (so
// steht sie im tor.json). Links: ein Flügel (schiebt 8 m nach -x), daran
// Riegel 1 (geschlossen 180° um y), daran Riegel 2 (geschlossen 90° gegen
// Riegel 1). Rechts: ein Halter um 180° um z gedreht, daran eine Lamelle, die
// in diesem Raum um -6 m fährt, in der Halle also nach +x. Ruhe = zu: Ende
// von door_close, Anfang von door_open.
function tor({ ruheDrehung = 180 } = {}) {
  const nodes = [
    { index: 0, name: 'tor', parent: null, t: [0, 0, 0] },
    { index: 1, name: 'fluegel', parent: 0, t: [0, 0, 0] },
    { index: 2, name: 'riegel_1', parent: 1, t: [-3, 0, 1], r: qMatrix(qY(ruheDrehung)) },
    { index: 3, name: 'riegel_2', parent: 2, t: [1, 0, 0], r: qMatrix(qY(90)) },
    { index: 4, name: 'halter_r', parent: 0, t: [0, 0, 0], r: qMatrix(qZ(180)) },
    { index: 5, name: 'lamelle_r', parent: 4, t: [0, 0, 0] },
  ];
  // Bilder: close 0..30 (die Flügel fahren zu, die Riegel schwenken in den letzten 5 Bildern ein), open umgekehrt
  const close = {
    fps: 30, frames: 30,
    tracks: { fluegel: [[0, -8, 0, 0], [25, 0, 0, 0], [30, 0, 0, 0]], lamelle_r: [[0, -6, 0, 0], [25, 0, 0, 0], [30, 0, 0, 0]] },
    rot: { riegel_1: [[0, ...qY(0)], [25, ...qY(0)], [30, ...qY(180)]], riegel_2: [[0, ...qY(0)], [25, ...qY(0)], [30, ...qY(90)]] },
    dreht: ['riegel_1', 'riegel_2'],
  };
  const open = {
    fps: 30, frames: 30,
    tracks: { fluegel: [[0, 0, 0, 0], [5, 0, 0, 0], [30, -8, 0, 0]], lamelle_r: [[0, 0, 0, 0], [5, 0, 0, 0], [30, -6, 0, 0]] },
    rot: { riegel_1: [[0, ...qY(180)], [5, ...qY(0)], [30, ...qY(0)]], riegel_2: [[0, ...qY(90)], [5, ...qY(0)], [30, ...qY(0)]] },
    dreht: ['riegel_1', 'riegel_2'],
  };
  return { cga: 'tor_xl', nodes, subsets: [], cafs: { door_close: close, door_open: open } };
}
// Ein Punkt am Knochen (im Raum des Knochens) in der Halle zum Bild f, aus dem Knotenbaum gerechnet
function wahrerOrt(T, bone, caf, f, punkt) {
  const W = knochenWerk(T), n = T.nodes.find((x) => x.name === bone), L = W.lage(n, T.cafs[caf], f);
  const x = L.R.map((z, i) => z[0] * punkt[0] + z[1] * punkt[1] + z[2] * punkt[2] + L.t[i]);
  return [x[0] + D[12], x[2] + D[13], -x[1] + D[14]];
}
// Derselbe Punkt, wie der Viewer ihn aus den Bahnen stellt: x' = q (x − pivot) + pivot + Versatz
function bahnOrt(T, bone, b, caf, s, punkt) {
  const ruhe = wahrerOrt(T, bone, 'door_close', T.cafs.door_close.frames, punkt);
  const k = b.keys[caf].find((z) => z[0] === s), q = b.rot[caf].find((z) => z[0] === s).slice(1);
  const rel = ruhe.map((v, i) => v - b.pivot[i]), x = qDreh(q, rel);
  return x.map((v, i) => v + b.pivot[i] + k[i + 1]);
}

test('Ruhe: am Ende von door_close steht der Riegel auf seinem Knochen in Ruhe, ohne Versatz und ohne Drehung', () => {
  const b = torBahn(tor(), 'riegel_1', D, { steps: 6 });
  assert.equal(b.dreht, true);
  assert.deepEqual(b.pivot, [7, 3, -30]);
  assert.deepEqual(b.keys.close.at(-1).slice(1), [0, 0, 0]);
  assert.ok(nah(b.rot.close.at(-1).slice(1), [0, 0, 0, 1], 1e-5));
  assert.ok(nah(b.rot.open[0].slice(1), [0, 0, 0, 1], 1e-5));
  assert.deepEqual(b.kette, ['riegel_1', 'fluegel', 'tor']);
});

test('Gedrehter Halter: die Lamelle rechts fährt in der Halle nach +x, obwohl ihre Spur -6 m sagt', () => {
  const r = torBahn(tor(), 'lamelle_r', D, { steps: 6 }), l = torBahn(tor(), 'fluegel', D, { steps: 6 });
  assert.equal(r.dreht, false);
  assert.equal(r.rot, undefined);
  assert.deepEqual(r.keys.open.at(-1).slice(1), [6, 0, 0]);
  assert.deepEqual(r.keys.close[0].slice(1), [6, 0, 0]);
  assert.deepEqual(l.keys.open.at(-1).slice(1), [-8, 0, 0]);
});

test('Bahn: jeder Punkt am Riegel landet, wo der Knotenbaum ihn hat, auch am Riegel unter dem Riegel', () => {
  const T = tor();
  for (const bone of ['riegel_1', 'riegel_2']) {
    const b = torBahn(T, bone, D, { steps: 6 });
    for (const caf of ['close', 'open']) for (const [s] of b.keys[caf]) {
      const f = Math.round(s * 30 * 2) / 2, punkt = [0.7, 0.2, -0.4];   // Zeiten stehen auf ms gerundet
      const soll = wahrerOrt(T, bone, `door_${caf}`, f, punkt), ist = bahnOrt(T, bone, b, caf, s, punkt);
      assert.ok(nah(ist, soll), `${bone} ${caf} ${s} s: ${ist} statt ${soll}`);
    }
  }
});

test('Stützstellen: die Bilder, an denen die Drehspur sich ändert, kommen zu den gleichmäßigen dazu', () => {
  const b = torBahn(tor(), 'riegel_1', D, { steps: 3 });
  // gleichmäßig 0, 10, 20, 30; dazu 25 (Beginn des Schwenks) in close und 5 (Ende) in open
  assert.deepEqual(b.keys.close.map((k) => Math.round(k[0] * 30)), [0, 10, 20, 25, 30]);
  assert.deepEqual(b.keys.open.map((k) => Math.round(k[0] * 30)), [0, 5, 10, 20, 30]);
  // offen: der Riegel ist um 180° zurückgeschwenkt
  assert.ok(Math.abs(winkel(qMatrix(b.rot.open.at(-1).slice(1))) - 180) < 0.01);
});

test('gerundete Ruhelage: ein Teil, das nur schiebt, dreht nicht; ein echter Schwenk bleibt einer', () => {
  // so steht eine um 30° gedrehte Ruhelage im tor.json (auf 1e-6 gerundet, Zeilen nicht mehr ganz Länge 1)
  const r6 = (m) => m.map((z) => z.map((v) => Math.round(v * 1e6) / 1e6 + 0));
  const t = tor();
  t.nodes[4].r = r6(qMatrix(qZ(30)));
  t.nodes.push({ index: 6, name: 'lamelle_30', parent: 0, t: [2, 0, 0], r: r6(qMatrix(qZ(30))) });
  for (const [k, c] of Object.entries({ close: t.cafs.door_close, open: t.cafs.door_open })) c.tracks.lamelle_30 = k === 'close' ? [[0, -4, 0, 0], [25, 2, 0, 0], [30, 2, 0, 0]] : [[0, 2, 0, 0], [5, 2, 0, 0], [30, -4, 0, 0]];
  for (const bone of ['lamelle_r', 'lamelle_30']) {
    const b = torBahn(t, bone, D, { steps: 6 });
    assert.equal(b.dreht, false, `${bone}: ${b.maxGrad}°`);
    assert.equal(b.rot, undefined);
  }
  t.nodes[2].r = r6(t.nodes[2].r);
  const b = torBahn(t, 'riegel_1', D, { steps: 6 });
  assert.ok(b.dreht && Math.abs(b.maxGrad - 180) < 0.01, `${b.maxGrad}`);
});

test('Gegenprobe: passt die Spur nicht zur Ruhelage des Knotenbaums, bricht der Build ab', () => {
  // der Knotenbaum sagt 90° statt der 180°, die door_close am Ende hat
  assert.throws(() => torBahn(tor({ ruheDrehung: 90 }), 'riegel_1', D), /riegel_1 steht am Ende von door_close .* 90\.00° neben seiner Ruhelage/);
  // ein Tor, das in der Halle skaliert stünde, dreht der Viewer nicht richtig
  const S = D.slice(); S[0] = 2;
  assert.throws(() => torBahn(tor(), 'riegel_1', S), /keine reine Drehung/);
  assert.throws(() => torBahn(tor(), 'riegel_9', D), /riegel_9 fehlt/);
});

test('offenImFeld: ein Teil, das offen über der Öffnung liegt, wird genannt; neben ihr nicht', () => {
  const feld = { from: [-10, -5], to: [10, 5] };
  const teil = (node, box, offen, extra = {}) => ({ node, box, keys: { close: [[0, ...offen], [1, 0, 0, 0]], open: [[0, 0, 0, 0], [1, ...offen]] }, ...extra });
  // links und rechts je 10 m breit, offen um 10 m nach außen: neben dem Feld
  const gut = [teil('l', [[-10, 0, -5], [0, 1, 5]], [-10, 0, 0]), teil('r', [[0, 0, -5], [10, 1, 5]], [10, 0, 0])];
  assert.deepEqual(offenImFeld(gut, feld), []);
  // rechts falsch herum: liegt offen bei x -10..0, mitten im Feld
  const falsch = [gut[0], teil('r', [[0, 0, -5], [10, 1, 5]], [-10, 0, 0])];
  assert.deepEqual(offenImFeld(falsch, feld), [{ node: 'r', x: 10, z: 10 }]);
  // ein Riegel, der offen um 180° um seinen Knochen am Rand schwenkt: liegt er zu außerhalb (x 10..12),
  // schwenkt er ins Feld (x 8..10) und wird genannt; liegt er zu am Rand innen (x 8..10), schwenkt er hinaus
  const schwenk = { pivot: [10, 0, 0], keysRot: { close: [[0, 0, 1, 0, 0], [1, 0, 0, 0, 1]], open: [[0, 0, 0, 0, 1], [1, 0, 1, 0, 0]] } };
  const riegel = teil('riegel', [[10, 0, -1], [12, 1, 1]], [0, 0, 0], schwenk);
  assert.deepEqual(offenImFeld([riegel], feld), [{ node: 'riegel', x: 2, z: 2 }]);
  const hinaus = teil('riegel', [[8, 0, -1], [10, 1, 1]], [0, 0, 0], schwenk);
  assert.deepEqual(offenImFeld([hinaus], feld), []);
});

test('achsAbstand: die Mitte eines Riegels liegt nah an der Achse durch seinen Knochen, entlang der Achse egal', () => {
  const b = torBahn(tor(), 'riegel_1', D, { steps: 6 });
  // Achse durch (7, 3, -30) längs der Modellachse z (Spiel-y): 238 m längs der Achse, 0,5 m daneben
  assert.ok(Math.abs(achsAbstand(b, [7.5, 3, 208]) - 0.5) < 1e-6);
  assert.ok(Math.abs(achsAbstand(b, [-10, 3, -30]) - 17) < 1e-6);
});

test('matrixQ ist die Umkehrung von qMatrix, auch nahe 180°', () => {
  for (const q of [qY(0), qY(37), qY(179.9), qY(180), [0.2, -0.5, 0.3, 0.787]]) {
    const n = Math.hypot(...q), e = q.map((v) => v / n), back = matrixQ(qMatrix(e)), sign = Math.sign(back[3] * e[3] + back[1] * e[1] + back[0] * e[0] + back[2] * e[2]) || 1;
    assert.ok(nah(back.map((v) => v * sign), e, 1e-9), `${q} -> ${back}`);
  }
});
