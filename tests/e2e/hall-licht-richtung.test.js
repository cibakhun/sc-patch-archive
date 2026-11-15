// Wohin die Flächenlichter einer Halle strahlen (orientHallLights in
// scripts/lib/hall-lights.mjs).
//
// Der Build läuft nur am PC mit den geholten Hallen, kein Tor fährt ihn. Hier
// steht die Regel am echten Strahl gegen ein kleines Modell: eine Decke, eine
// Leuchte mit Scheibe darunter, eine Wand. Die Lesart 'achse' (Hallen fester
// Größe) lässt einem Flächenlicht die Richtung, mit der es ankommt; die Lesart
// 'flaeche' (alle anderen Hallen) dreht es von der nächsten Fläche weg. Der
// Fall, um den es geht, ist das Deckenpaneel in der Kabine eines
// Frachtaufzugs: Die Lampe sitzt 9 cm über der Scheibe ihrer Leuchte und
// strahlt nach unten. Unter 'flaeche' zeigt sie an die Decke.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@gltf-transform/core';
import { hallRaycaster, orientHallLights, FLAECHEN_LESARTEN } from '../../scripts/lib/hall-lights.mjs';

// Rechteck in einer Ebene, als zwei Dreiecke: a ist eine Ecke, u und v die Kanten
function modell(platten) {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene();
  for (const [name, a, u, v] of platten) {
    const P = [a, a.map((x, i) => x + u[i]), a.map((x, i) => x + u[i] + v[i]), a.map((x, i) => x + v[i])];
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(P.flat())).setBuffer(buffer);
    const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer);
    const mesh = doc.createMesh(name).addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setIndices(idx).setMaterial(doc.createMaterial(name)));
    scene.addChild(doc.createNode(name).setMesh(mesh));
  }
  return doc;
}
// Kabine: Decke bei y 12, die Scheibe einer Leuchte bei y 10,28 (1 × 1 m), eine Wand bei x 5
const KABINE = () => hallRaycaster(modell([
  ['decke', [-6, 12, -6], [12, 0, 0], [0, 0, 12]],
  ['scheibe', [-0.5, 10.28, -0.5], [1, 0, 0], [0, 0, 1]],
  ['wand', [5, 0, -6], [0, 12, 0], [0, 0, 12]],
]));
const lampe = (type, pos, dir, mehr = {}) => ({ type, pos, dir, intensity: 1, radius: 10, name: 'l', ...mehr });
const PANEEL = () => lampe('area', [0, 10.375, 0], [0, -1, 0]);
// die Lesart flaeche rundet mit Vorzeichen: −0 schreibt JSON als 0
const ohneMinusNull = (v) => v.map((x) => x + 0);

test('der Strahl trifft das Modell, wie die Fälle unten es brauchen', () => {
  const rc = KABINE();
  assert.equal(rc.triangles, 6);
  assert.ok(Math.abs(rc.ray([0, 10.375, 0], [0, -1, 0], 1.2).t - 0.095) < 1e-3, 'die Scheibe liegt 9,5 cm unter der Lampe');
  assert.equal(rc.ray([0, 10.375, 0], [0, 1, 0], 1.2), null, 'die Decke liegt 1,625 m über ihr, außer Reichweite');
  assert.ok(Math.abs(rc.ray([4.9, 5, 0], [1, 0, 0], 1.2).t - 0.1) < 1e-3);
});

test('achse: das Deckenpaneel im Gehäuse seiner Leuchte behält seine Richtung nach unten', () => {
  const l = PANEEL();
  const o = orientHallLights([l], KABINE(), 1.2, { flaechen: 'achse' });
  assert.deepEqual(l.dir, [0, -1, 0]);
  assert.equal(l.gap, undefined, 'einen Abstand zur Fläche trägt nur die Lesart flaeche ein');
  assert.deepEqual(o, { spots: 0, area: 1, areaMounted: 1, spotsAway: 0, spotsMounted: 0, flaechen: 'achse', areaAway: 0, areaInto: 1, areaOhne: 0 });
});

test('flaeche: dasselbe Paneel dreht sich von der Scheibe weg an die Decke (so stand es bis zum 15.11.2026 in der Large-Halle)', () => {
  const l = PANEEL();
  const o = orientHallLights([l], KABINE());
  assert.deepEqual(ohneMinusNull(l.dir), [0, 1, 0]);
  assert.equal(l.gap, 0.095);
  assert.deepEqual(o, { spots: 0, area: 1, areaMounted: 1, spotsAway: 0, spotsMounted: 0 }, 'die Selbstauskunft der alten Lesart bleibt, wie sie im Manifest steht');
});

test('achse: Flächenlichter an der Wand, die von ihr weg zeigen, zählen als montiert und weg; schräg bleibt schräg', () => {
  const an = lampe('area', [4.9, 5, 0], [-1, 0, 0]);
  const schraeg = lampe('area', [4.9, 6, 0], [-0.707, -0.707, 0]);
  const frei = lampe('area', [0, 5, 0], [0.6, 0, 0.8]);
  const o = orientHallLights([an, schraeg, frei], KABINE(), 1.2, { flaechen: 'achse' });
  assert.deepEqual(an.dir, [-1, 0, 0]);
  assert.deepEqual(schraeg.dir, [-0.707, -0.707, 0], 'die Richtung des Spiels wird nicht auf die Normale der Wand gezogen');
  assert.deepEqual(frei.dir, [0.6, 0, 0.8], 'frei im Raum: bleibt gerichtet (unter flaeche strahlte es rundum)');
  assert.equal(o.area, 3); assert.equal(o.areaAway, 2); assert.equal(o.areaInto, 0); assert.equal(o.areaMounted, 2);
});

test('flaeche: an der Wand von ihr weg, frei im Raum ohne Richtung', () => {
  const an = lampe('area', [4.9, 5, 0], [0, 0, 1]);
  const frei = lampe('area', [0, 5, 0], [0.6, 0, 0.8]);
  const o = orientHallLights([an, frei], KABINE());
  assert.deepEqual(ohneMinusNull(an.dir), [-1, 0, 0]);
  assert.equal(an.gap, 0.1);
  assert.equal(frei.dir, null);
  assert.equal(o.areaMounted, 1);
});

test('achse: ein Flächenlicht ohne brauchbare Richtung wird gezählt und strahlt rundum', () => {
  for (const dir of [null, undefined, [0, 0, 0], [1, 0], [NaN, 0, 1], 'unten']) {
    const l = lampe('area', [0, 5, 0], dir);
    const o = orientHallLights([l], KABINE(), 1.2, { flaechen: 'achse' });
    assert.equal(l.dir, null, `dir ${JSON.stringify(dir)}`);
    assert.equal(o.areaOhne, 1);
    assert.equal(o.areaMounted, 0);
  }
});

test('Spots und Punktlichter bleiben in beiden Lesarten, wie sie ankommen', () => {
  for (const flaechen of FLAECHEN_LESARTEN) {
    const spot = lampe('spot', [0, 11.9, 3], [0, -1, 0]), punkt = lampe('point', [0, 5, 0], [1, 0, 0]);
    const o = orientHallLights([spot, punkt], KABINE(), 1.2, { flaechen });
    assert.deepEqual(spot.dir, [0, -1, 0]);
    assert.deepEqual(punkt.dir, [1, 0, 0]);
    assert.equal(o.spots, 1); assert.equal(o.spotsMounted, 1); assert.equal(o.spotsAway, 1); assert.equal(o.area, 0);
  }
});

test('eine unbekannte Lesart bricht ab, statt still die alte zu nehmen', () => {
  assert.deepEqual(FLAECHEN_LESARTEN, ['flaeche', 'achse']);
  for (const flaechen of ['Achse', 'x', '', null, 1]) {
    assert.throws(() => orientHallLights([PANEEL()], KABINE(), 1.2, { flaechen }), /unbekannte Lesart für Flächenlichter/, JSON.stringify(flaechen));
  }
  // ohne Angabe: die alte Lesart
  const l = PANEEL();
  orientHallLights([l], KABINE(), 1.2, {});
  assert.deepEqual(ohneMinusNull(l.dir), [0, 1, 0]);
});
