// Lage der Hallendeko in einer Halle fester Größe
// (scripts/lib/hall-deko.mjs).
//
// Eine solche Halle misst im Browser keinen Grundriss: Was WORK_DEKO_FEST
// nennt, stellt der Viewer hin, auch in eine Wand. Das Tor prüft darum am
// ausgelieferten Modell, ob jedes Stück frei steht (verify:hangar-hallen
// [5]). Hier steht seine Rechnung an Quadern von Hand: Überdeckung gedrehter
// Grundflächen, was auf einem anderen Stück liegt und was schwebt, das Feld
// des Aufzugs, die Fahrspur vor einem Fahrzeug, und die Halle als Dreiecke
// (Wand im Quader, Boden unter dem Stück).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ecken, lokal, drin, ueberdeckung, knotenFlaechen, messpunkte, getragen, fahrspurVor, pruefeLage, hallenRaster, hallImQuader, bodenUnter, LOSE_LEITUNG } from '../../scripts/lib/hall-deko.mjs';

const G = Math.PI / 180;
// ein Stück: Mitte, Maße (Breite, Höhe, Tiefe), Drehung in Grad, Unterkante
const st = (name, c, [b, h, t], grad = 0, y = 0, mehr = {}) => ({ name, node: mehr.node ?? name, zone: 'z', c, a: grad * G, hx: b / 2, hz: t / 2, y, top: y + h, auf: y > 0.05, fahrzeug: false, ...mehr });
// ein Quader als Dreiecke im Rahmen eines Knotens (Ursprung beliebig): alle sechs Seiten, Normalen nach aussen
const quader = ([x0, y0, z0], [x1, y1, z1]) => {
  const p = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 5, 1, 0, 4, 5, 1, 6, 2, 1, 5, 6, 2, 7, 3, 2, 6, 7, 3, 4, 0, 3, 7, 4];
  return { pos: Float32Array.from(p.flat()), idx: Uint16Array.from(idx) };
};
// eine waagrechte Platte der Halle (zwei Dreiecke, Normale nach oben) und eine senkrechte Wand entlang z
const platte = (r, x0, z0, x1, z1, y) => { r.dazu([x0, y, z0], [x0, y, z1], [x1, y, z1]); r.dazu([x0, y, z0], [x1, y, z1], [x1, y, z0]); };
const wand = (r, x, z0, z1, y0, y1) => { r.dazu([x, y0, z0], [x, y1, z0], [x, y1, z1]); r.dazu([x, y0, z0], [x, y1, z1], [x, y0, z1]); };

test('ecken, lokal, drin: Drehung wie makeRotationY (das eigene +x zeigt nach cos a, -sin a)', () => {
  const m = st('a', [10, 20], [4, 1, 2], 90);
  // um 90 Grad gedreht liegt die lange Seite entlang z
  const e = ecken(m).map(([x, z]) => [Math.round(x * 1e6) / 1e6, Math.round(z * 1e6) / 1e6]);
  assert.deepEqual(e.map((p) => p[0]).sort((a, b) => a - b), [9, 9, 11, 11]);
  assert.deepEqual(e.map((p) => p[1]).sort((a, b) => a - b), [18, 18, 22, 22]);
  const [lx, lz] = lokal(m, 10, 18);
  assert.ok(Math.abs(lx - 2) < 1e-9 && Math.abs(lz) < 1e-9, `lokal ${lx}, ${lz}`);
  assert.equal(drin(m, 10.9, 21.9), true);
  assert.equal(drin(m, 11.1, 20), false);
  assert.equal(drin(m, 11.1, 20, 0.2), true);
});

test('ueberdeckung: getrennt, berührend, ineinander, und schräg nur über die Ecke', () => {
  const a = st('a', [0, 0], [2, 1, 2]);
  assert.ok(ueberdeckung(a, st('b', [3, 0], [2, 1, 2])) < 0, 'ein Meter Abstand');
  assert.ok(Math.abs(ueberdeckung(a, st('b', [2, 0], [2, 1, 2]))) < 1e-9, 'Kante an Kante');
  assert.ok(Math.abs(ueberdeckung(a, st('b', [1.5, 0], [2, 1, 2])) - 0.5) < 1e-9, 'halber Meter');
  // um 45 Grad gedreht reicht die Ecke 1,414 m weit: bei 2,3 m Abstand der Mitten 0,114 m im anderen
  const d = st('d', [2.3, 0], [2, 1, 2], 45);
  assert.ok(ueberdeckung(a, d) > 0.1 && ueberdeckung(a, d) < 0.12, `über die Ecke ${ueberdeckung(a, d)}`);
  // diagonal daneben: die achsparallelen Hüllen schneiden sich, die Flächen nicht
  const e = st('e', [1.9, 1.9], [2, 1, 2], 45);
  assert.ok(ueberdeckung(a, e) < 0, `diagonal ${ueberdeckung(a, e)}`);
});

test('knotenFlaechen: Maße, Dreiecke und die tragenden Flächen im Rahmen des Stücks', () => {
  // ein Tisch: Platte 2 × 1 m auf 0,9 bis 1 m, darunter ein Fuß; der Knoten liegt irgendwo
  const f = knotenFlaechen([quader([5, 3.9, 7], [7, 4, 8]), quader([5.9, 3, 7.4], [6.1, 3.9, 7.6])]);
  assert.deepEqual(f.size.map((v) => +v.toFixed(6)), [2, 1, 1]);
  assert.equal(f.tris, 24);
  // nach oben zeigen nur die Deckel: Platte (2 Dreiecke) und Fuß (2 Dreiecke, unter der Platte)
  assert.equal(f.oben.length / 9, 4);
  const hoehen = new Set(); for (let o = 1; o < f.oben.length; o += 3) hoehen.add(+f.oben[o].toFixed(6));
  assert.deepEqual([...hoehen].sort(), [0.9, 1]);
  const xs = []; for (let o = 0; o < f.oben.length; o += 3) xs.push(f.oben[o]);
  assert.ok(Math.abs(Math.min(...xs) + 1) < 1e-6 && Math.abs(Math.max(...xs) - 1) < 1e-6, 'Mitte der Grundfläche im Ursprung');
});

test('getragen: die Kiste liegt auf der Platte, nicht daneben und nicht auf falscher Höhe', () => {
  const tisch = st('tisch', [0, 0], [2, 1, 1], 30);
  // Platte auf 0,9 bis 1 m, darunter ein Fuß bis zum Boden (ohne ihn begänne der Knoten erst bei der Platte)
  const oben = knotenFlaechen([quader([-1, 0.9, -0.5], [1, 1, 0.5]), quader([-0.1, 0, -0.1], [0.1, 0.9, 0.1])]).oben;
  const kiste = (c, y) => st('kiste', c, [0.4, 0.3, 0.4], 10, y);
  assert.equal(getragen(kiste([0, 0], 1), tisch, oben), 2, 'mitten auf der Platte: ihre beiden Dreiecke');
  assert.equal(getragen(kiste([0, 0], 1.2), tisch, oben), 0, '20 cm über der Platte');
  assert.equal(getragen(kiste([0, 0], 1.05), tisch, oben), 2, '5 cm über der Platte gilt noch');
  assert.equal(getragen(kiste([3, 0], 1), tisch, oben), 0, 'neben dem Tisch');
  // die Platte endet im eigenen x bei 1 m: halb über die Kante geschoben trägt sie noch, ganz daneben nicht
  const an = (d) => [d * Math.cos(30 * G), -d * Math.sin(30 * G)];
  assert.ok(getragen(kiste(an(1), 1), tisch, oben) > 0, 'halb über der Kante');
  assert.equal(getragen(kiste(an(1.25), 1), tisch, oben), 0, 'ganz neben der Kante');
  // der Tisch selbst steht höher: Die Fläche liegt dann auf q.y + 1
  assert.equal(getragen(kiste([0, 0], 1.5), { ...tisch, y: 0.5, top: 1.5 }, oben), 2);
  // eine schmale Gabel unter einer breiten Palette trägt, obwohl kein Rasterpunkt sie träfe
  const gabel = knotenFlaechen([quader([-0.6, 0, 0], [0.6, 2, 1.5]), quader([0.3, 0.45, -1.5], [0.45, 0.5, 0])]).oben;
  const stapler = st('stapler', [0, 0], [1.2, 2, 3]);
  assert.ok(getragen(st('palette', [0, -0.75], [2.5, 0.25, 1.2], 90, 0.5), stapler, gabel) > 0);
  assert.equal(getragen(st('palette', [0, -0.75], [2.5, 0.25, 1.2], 90, 0.7), stapler, gabel), 0);
});

test('pruefeLage: Stapel, getragene Last, Schweben, Ineinander', () => {
  const palette = knotenFlaechen([quader([-1.25, 0, -0.6], [1.25, 0.25, 0.6])]).oben;
  // ein Stapler: Rumpf hinten, zwei Gabeln vorn auf 0,5 m (die Mitte zwischen ihnen ist frei)
  const stapler = knotenFlaechen([quader([-0.6, 0, 0], [0.6, 2, 1.5]), quader([-0.45, 0.45, -1.5], [-0.3, 0.5, 0]), quader([0.3, 0.45, -1.5], [0.45, 0.5, 0])]).oben;
  const oben = (n) => ({ palette, stapler }[n]);
  const P = (name, c, y, grad = 0) => st(name, c, [2.5, 0.25, 1.2], grad, y, { node: 'palette' });
  const K = (name, c, y) => st(name, c, [1.2, 1.2, 1.2], 0, y, { node: 'kiste' });
  const S = st('stapler', [10, 0], [1.2, 2, 3], 0, 0, { node: 'stapler' });
  const gut = [P('p1', [0, 0], 0), K('k1', [-0.6, 0], 0.25), K('k2', [0.62, 0], 0.25), S, P('last', [10, -0.75], 0.5, 90), K('k3', [10, -0.75], 0.75)];
  const r = pruefeLage(gut, { oben, feld: null, spur: { laenge: 8, rand: 0.3 } });
  assert.deepEqual([r.ineinander, r.schwebt, r.imFeld, r.imSpur], [[], [], [], []]);
  assert.deepEqual({ amBoden: r.zahlen.amBoden, gestapelt: r.zahlen.gestapelt, getragen: r.zahlen.getragen }, { amBoden: 2, gestapelt: 4, getragen: 4 });
  // dieselbe Last 20 cm höher schwebt und steckt dann im Stapler (der trägt sie nicht mehr)
  const hoch = pruefeLage([S, P('last', [10, -0.75], 0.7, 90)], { oben, feld: null, spur: { laenge: 8, rand: 0.3 } });
  assert.deepEqual(hoch.schwebt, ['last auf 0.7 m']);
  assert.equal(hoch.ineinander.length, 1);
  // die Kiste auf der Palette auf der Gabel steckt nicht im Stapler: Er trägt sie über die Palette
  assert.equal(r.ineinander.length, 0);
  // zwei Kisten am Boden ineinander
  const eng = pruefeLage([K('a', [0, 0], 0), K('b', [1, 0], 0)], { oben, feld: null, spur: { laenge: 8, rand: 0.3 } });
  assert.deepEqual(eng.ineinander, ['a mit b 0.20 m']);
  // übereinander ohne gemeinsame Höhe und zwei flache Stücke: erlaubt
  const flach = pruefeLage([st('matte', [0, 0], [2, 0.1, 2]), st('schlauch', [0.5, 0], [3, 0.2, 0.3])], { oben, feld: null, spur: { laenge: 8, rand: 0.3 } });
  assert.deepEqual(flach.ineinander, []);
});

test('pruefeLage: Oberkante allein trägt nicht, die Fläche darunter zählt (offener Rahmen gegen Tischplatte)', () => {
  // ein Rahmen 2 × 2 m, 1 m hoch: vier Pfosten und vier Holme oben, in der Mitte offen
  const rahmen = knotenFlaechen([
    quader([-1, 0, -1], [-0.9, 1, -0.9]), quader([0.9, 0, -1], [1, 1, -0.9]), quader([0.9, 0, 0.9], [1, 1, 1]), quader([-1, 0, 0.9], [-0.9, 1, 1]),
    quader([-1, 0.9, -1], [1, 1, -0.9]), quader([-1, 0.9, 0.9], [1, 1, 1]), quader([-1, 0.9, -1], [-0.9, 1, 1]), quader([0.9, 0.9, -1], [1, 1, 1]),
  ]).oben;
  // derselbe Umriss mit geschlossener Platte
  const tisch = knotenFlaechen([quader([-1, 0.9, -1], [1, 1, 1]), quader([-0.1, 0, -0.1], [0.1, 0.9, 0.1])]).oben;
  const oben = (n) => ({ rahmen, tisch }[n]);
  const spur = { laenge: 8, rand: 0.3 };
  const R = st('rahmen', [0, 0], [2, 1, 2], 0, 0, { node: 'rahmen' }), T = st('tisch', [0, 0], [2, 1, 2], 0, 0, { node: 'tisch' });
  // die Kiste mitten über dem offenen Rahmen: Oberkante und Mitte stimmen, darunter ist nichts
  const kiste = (c, y = 1) => st('kiste', c, [0.5, 0.4, 0.5], 0, y, { node: 'kiste' });
  const offen = pruefeLage([R, kiste([0, 0])], { oben, feld: null, spur });
  assert.deepEqual(offen.schwebt, ['kiste auf 1 m']);
  assert.equal(offen.zahlen.getragen, 0);
  // auf dem Holm des Rahmens liegt sie auf
  assert.deepEqual(pruefeLage([R, kiste([0.8, 0])], { oben, feld: null, spur }).schwebt, []);
  // auf der geschlossenen Platte liegt sie auf, ob in der Mitte oder am Rand
  for (const c of [[0, 0], [0.6, -0.6]]) {
    const zu = pruefeLage([T, kiste(c)], { oben, feld: null, spur });
    assert.deepEqual([zu.schwebt, zu.zahlen.getragen], [[], 1], `Tisch, Kiste bei ${c}`);
  }
  // ohne Flächen (Knoten ohne Geometrie) trägt nichts, auch wenn die Hülle passt
  assert.deepEqual(pruefeLage([st('leer', [0, 0], [2, 1, 2], 0, 0, { node: 'leer' }), kiste([0, 0])], { oben, feld: null, spur }).schwebt, ['kiste auf 1 m']);
});

test('pruefeLage: Feld des Aufzugs mit Abstand, Fahrspur vor dem Fahrzeug', () => {
  const oben = () => undefined, feld = { from: [-10, -20], to: [10, 20] }, spur = { laenge: 8, rand: 0.3 };
  const K = (name, c) => st(name, c, [1, 1, 1]);
  const r = pruefeLage([K('weit', [14, 0]), K('nah', [11.2, 0]), K('drauf', [9, 5])], { oben, feld, abstand: 1, spur });
  assert.deepEqual(r.imFeld, ['nah', 'drauf']);
  assert.equal(r.zahlen.feld, 3);
  assert.deepEqual(pruefeLage([K('nah', [11.2, 0])], { oben, feld, abstand: 0, spur }).imFeld, []);
  // Fahrzeug bei 0 Grad: Front nach -z, die Spur reicht von seiner Front 8 m weit
  const auto = st('auto', [30, 0], [2, 1.5, 4], 0, 0, { fahrzeug: true });
  const S = fahrspurVor(auto, spur);
  assert.deepEqual([S.c[0], S.c[1], S.hx, S.hz].map((v) => +v.toFixed(6)), [30, -6, 1.3, 4]);
  const f = pruefeLage([auto, K('davor', [30.5, -7]), K('daneben', [32.4, -7]), K('dahinter', [30, 4]), K('weiter', [30, -11])], { oben, feld: null, spur });
  assert.deepEqual(f.imSpur, ['davor vor auto']);
  // um 90 Grad gedreht zeigt die Front nach -x
  const quer = st('auto', [30, 0], [2, 1.5, 4], 90, 0, { fahrzeug: true });
  assert.deepEqual(pruefeLage([quer, K('davor', [23, 0.5]), K('alt', [30.5, -7])], { oben, feld: null, spur }).imSpur, ['davor vor auto']);
});

test('hallImQuader: Wand im Stück, Wand daneben, Boden unter dem Band, gedrehtes Stück', () => {
  const r = hallenRaster({ zelle: 2, bereich: [-20, -20, 20, 20], band: [0.15, 6] });
  platte(r, -20, -20, 20, 20, 0);          // Boden: liegt unter dem Band und zählt nicht
  wand(r, 5, -10, 10, 0, 4);               // Wand bei x = 5
  assert.equal(r.tris.length / 9, 2, 'nur die Wand liegt im Band');
  const K = (c, grad = 0) => st('k', c, [2, 2, 2], grad);
  assert.equal(hallImQuader(K([3, 0]), 0.15, 2, r), 0, 'einen Meter vor der Wand');
  assert.ok(hallImQuader(K([4.5, 0]), 0.15, 2, r) > 0, 'steckt einen halben Meter in der Wand');
  // 2 cm Spiel: Rücken genau an der Wand ist frei
  assert.equal(hallImQuader(K([4, 0]), 0.15, 2, r), 0, 'Rücken an der Wand');
  // um 45 Grad gedreht reicht die Ecke 1,41 m weit
  assert.ok(hallImQuader(K([3.8, 0], 45), 0.15, 2, r) > 0, 'die Ecke steckt in der Wand');
  assert.equal(hallImQuader(K([3.5, 0], 45), 0.15, 2, r), 0, 'die Ecke bleibt davor');
  // die Wand endet auf 4 m: darüber frei
  assert.equal(hallImQuader(K([4.5, 0]), 4.1, 6, r), 0);
  // ein Balken über dem Stück zählt erst, wenn das Stück so hoch reicht
  const b = hallenRaster({ zelle: 2, bereich: [-20, -20, 20, 20], band: [0.15, 6] });
  platte(b, -1, -1, 1, 1, 3);
  assert.equal(hallImQuader(K([0, 0]), 0.15, 2, b), 0);
  assert.ok(hallImQuader(K([0, 0]), 0.15, 3.5, b) > 0);
});

test('bodenUnter: Boden da, Loch, Kante, und Boden auf anderer Höhe', () => {
  const r = hallenRaster({ zelle: 2, bereich: [-20, -20, 20, 20], band: [-0.2, 0.2] });
  platte(r, -20, -20, 0, 20, 0);            // Boden nur links von x = 0
  platte(r, 0, -20, 20, 20, -1.2);          // rechts die Grube: liegt ausserhalb des Bands
  const K = (c) => st('k', c, [2, 1, 2]);
  assert.deepEqual(bodenUnter(K([-5, 0]), 0, r), { auf: 25, von: 25 });
  assert.deepEqual(bodenUnter(K([5, 0]), 0, r), { auf: 0, von: 25 });
  const kante = bodenUnter(K([0, 0]), 0, r);
  assert.ok(kante.auf >= 10 && kante.auf <= 15, `halb über der Kante: ${kante.auf}`);
  // die Zone nennt 0,3 m über dem Hallenboden, die Fläche liegt bei 0
  assert.deepEqual(bodenUnter(K([-5, 0]), 0.3, r), { auf: 0, von: 25 });
  assert.equal(messpunkte(K([0, 0]), 5).length, 25);
});

test('LOSE_LEITUNG: lose Bodenkabel und Bodenschläuche, nicht die Geräte, an denen eine Leitung hängt', () => {
  for (const n of ['prop_kabel_cable_floor_1_a', 'prop_kabel_cable_straight_2m_a', 'prop_kabel_cables_bundle_a', 'prop_schlauch_hose_floor_1_c']) assert.ok(LOSE_LEITUNG.test(n), n);
  for (const n of ['prop_kabel_cable_reel_2_a', 'prop_kabel_cable_terminal_1_floor_a', 'prop_schlauch_hose_reel_1_065x045x045_a', 'prop_schlauch_maintenance_hose_1_a', 'prop_schlauch_hose_floor_1_f_end']) assert.ok(!LOSE_LEITUNG.test(n), n);
});
