// Lage der Arbeitsplätze am Boden der Werkhalle (scripts/lib/werk-boden.mjs).
//
// Der Viewer stellt jedes Stück aus WERK_BODEN so hin, wie der Block es
// nennt; die Garage misst keinen Grundriss. verify:hangar-hall [18] rechnet
// darum am ausgelieferten Modell nach, ob jedes Stück auf dem Boden oder auf
// einem anderen steht, keines in Wand oder Vorbau steckt und Grube und
// Einfahrt frei bleiben. Hier steht dieselbe Rechnung an einer Garage von
// Hand: Boden auf -0,12 m, eine Wand, ein Vorbau, eine Grube.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { werkBodenStuecke, pruefeWerkBoden, BODEN_ANTEIL } from '../../scripts/lib/werk-boden.mjs';
import { knotenFlaechen, hallenRaster } from '../../scripts/lib/hall-deko.mjs';

// ein Quader als Dreiecke im Rahmen eines Knotens (Ursprung unten mittig)
const quader = ([x0, y0, z0], [x1, y1, z1]) => {
  const p = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 5, 1, 0, 4, 5, 1, 6, 2, 1, 5, 6, 2, 7, 3, 2, 6, 7, 3, 4, 0, 3, 7, 4];
  return { pos: Float32Array.from(p.flat()), idx: Uint16Array.from(idx) };
};
// Knoten des Satzes: Schrank 1 x 2 x 0,6 m, Kiste 0,4 x 0,3 x 0,4 m
const KNOTEN = {
  schrank: knotenFlaechen([quader([-0.5, 0, -0.3], [0.5, 2, 0.3])]),
  kiste: knotenFlaechen([quader([-0.2, 0, -0.2], [0.2, 0.3, 0.2])]),
};
const masse = (n) => (KNOTEN[n] ? { size: KNOTEN[n].size } : null);
const oben = (n) => KNOTEN[n]?.oben;

// Garage: Boden auf -0,12 m von x -10 bis 10, z -5 bis 5 (nach oben), Wand bei z -5,
// Vorbau ab 2,4 m über z -5 bis -3 (Unterseite), dazu alle Dreiecke im Raster „alle“
function garage() {
  const bereich = [-12, -7, 12, 7];
  const boden = hallenRaster({ zelle: 1, bereich, band: [-0.6, 0.6] }), alle = hallenRaster({ zelle: 1, bereich, band: [0, 3.2] });
  const platte = (r, x0, z0, x1, z1, y, auf = true) => {
    // nach oben: (x0,z0) (x0,z1) (x1,z1) gegen den Uhrzeigersinn von oben gesehen
    if (auf) { r.dazu([x0, y, z0], [x0, y, z1], [x1, y, z1]); r.dazu([x0, y, z0], [x1, y, z1], [x1, y, z0]); }
    else { r.dazu([x0, y, z0], [x1, y, z1], [x0, y, z1]); r.dazu([x0, y, z0], [x1, y, z0], [x1, y, z1]); }
  };
  const wand = (r, z, x0, x1, y0, y1) => { r.dazu([x0, y0, z], [x0, y1, z], [x1, y1, z]); r.dazu([x0, y0, z], [x1, y1, z], [x1, y0, z]); };
  platte(boden, -10, -5, 10, 5, -0.12);
  for (const r of [alle]) { platte(r, -10, -5, 10, 5, -0.12); wand(r, -5, -10, 10, -0.12, 3); platte(r, -10, -5, 10, -3, 2.4, false); }
  return { boden, alle };
}
const block = (glieder) => ({ zonen: [{ name: 'z', glieder }] });
const FREI = [{ name: 'Grube', c: [6, 2], a: 0, hx: 1.5, hz: 1.5 }];

test('ein Schrank an der Wand und eine Kiste darauf: alles richtig', () => {
  const { stuecke, ohne } = werkBodenStuecke(block([['schrank', 0, -0.12, -4.6, 0], ['kiste', 0, 1.88, -4.6, 0]]), masse);
  assert.deepEqual(ohne, []);
  // der Schrank (2 m hoch) passt unter den Vorbau nicht: hier 0,6 m tief bis z -4,3, also unter dem Vorbau (bis z -3)
  // und 2 m hoch, der Vorbau beginnt bei 2,4 m über 0 -> Oberkante 1,88 < 2,4: passt
  const e = pruefeWerkBoden(stuecke, { ...garage(), oben, frei: FREI, raum: { x: [-10, 10], z: [-5, 5] } });
  assert.deepEqual(e.inWand, []);
  assert.deepEqual(e.schwebt, []);
  assert.deepEqual(e.ineinander, []);
  assert.deepEqual(e.imWeg, []);
  assert.deepEqual(e.draussen, []);
  assert.equal(e.zahlen.amBoden, 1);
  assert.equal(e.zahlen.getragen, 1);
});

test('vorgeführt rot: in der Wand, unter dem Vorbau, schwebend, versunken, ineinander, in der Grube, draußen', () => {
  const G = garage();
  const fall = (glieder) => pruefeWerkBoden(werkBodenStuecke(block(glieder), masse).stuecke, { ...G, oben, frei: FREI, raum: { x: [-10, 10], z: [-5, 5] } });
  // 10 cm in die Wand bei z -5
  assert.equal(fall([['schrank', 0, -0.12, -4.8, 0]]).inWand.length, 1);
  // auf eine Kiste von 0,6 m gestellt ragt der Schrank in den Vorbau (2,4 m)
  assert.equal(fall([['schrank', 0, 0.5, -4.0, 0]]).inWand.length, 1);
  // auf 0 statt -0,12 m: steht nicht auf dem Boden, liegt auf nichts
  const s = fall([['kiste', 0, 0, 0, 0]]);
  assert.equal(s.schwebt.length, 1);
  assert.equal(s.zahlen.amBoden, 0);
  // 5 cm versunken: auch kein Boden auf der Unterkante
  assert.equal(fall([['kiste', 0, -0.17, 0, 0]]).schwebt.length, 1);
  // halb über dem Rand des Bodens (x 10): weniger als BODEN_ANTEIL der Punkte tragen
  assert.ok(BODEN_ANTEIL > 0.5);
  assert.equal(fall([['schrank', 10, -0.12, 0, 0]]).schwebt.length, 1);
  // zwei Schränke ineinander
  assert.equal(fall([['schrank', 0, -0.12, 0, 0], ['schrank', 0.6, -0.12, 0, 90]]).ineinander.length, 1);
  // Kiste in der Grube
  assert.deepEqual(fall([['kiste', 6.5, -0.12, 2.5, 0]]).imWeg, ['z/1 kiste in Grube']);
  // draußen: über den Innenraum hinaus
  assert.equal(fall([['kiste', 9.9, -0.12, 0, 0]]).draussen.length, 1);
});

test('Mitte der Grundfläche: Ursprung des Knotens versetzt und gedreht wie makeRotationY', () => {
  const { stuecke } = werkBodenStuecke(block([['schrank', 2, 0, 3, 90]]), () => ({ size: [1, 2, 0.6], mitte: [0.5, 0] }));
  // das eigene +x zeigt nach (cos a, -sin a) = (0, -1): Mitte bei z 3 - 0,5
  assert.ok(Math.abs(stuecke[0].c[0] - 2) < 1e-9 && Math.abs(stuecke[0].c[1] - 2.5) < 1e-9, JSON.stringify(stuecke[0].c));
  assert.equal(werkBodenStuecke(block([['fehlt', 0, 0, 0, 0]]), masse).ohne[0], 'fehlt');
});

test('zwei niedrige Kisten am selben Platz sind ineinander, nebeneinander nicht', () => {
  const G = garage();
  const fall = (glieder) => pruefeWerkBoden(werkBodenStuecke(block(glieder), masse).stuecke, { ...G, oben, frei: FREI, raum: { x: [-10, 10], z: [-5, 5] } });
  // 0,3 m hoch: die Hallendeko liesse dieses Paar aus (Matten und Kabel liegen dort übereinander)
  const ein = fall([['kiste', 0, -0.12, 0, 0], ['kiste', 0.1, -0.12, 0, 0]]);
  assert.equal(ein.ineinander.length, 1);
  assert.equal(ein.zahlen.paare, 1);
  assert.deepEqual(fall([['kiste', 0, -0.12, 0, 0], ['kiste', 0.5, -0.12, 0, 0]]).ineinander, []);
});
