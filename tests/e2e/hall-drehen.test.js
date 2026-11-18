// Drehung einer Halle um die Hochachse vor dem Build (scripts/lib/hall-drehen.mjs,
// HALL_DREH in scripts/build-hangar-assets.mjs): die Small-Halle steht im Spiel
// quer zur Schiffsachse des Viewers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@gltf-transform/core';
import { drehY, hallDrehen } from '../../scripts/lib/hall-drehen.mjs';

// Export wie der des Spiels: eine Wurzel (Z oben -> Y oben), darunter ein Netz bei (1, 0, 2) im Raum der Wurzel
function halle({ wurzeln = 1 } = {}) {
  const doc = new Document();
  const scene = doc.createScene();
  const zUp = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
  for (let i = 0; i < wurzeln; i++) {
    const w = doc.createNode(`CryEngine_Z_up${i || ''}`).setMatrix(zUp);
    w.addChild(doc.createNode('netz').setMesh(doc.createMesh('m')).setTranslation([1, -2, 3]));
    scene.addChild(w);
  }
  return doc;
}
const ort = (doc, n = 'netz') => doc.getRoot().listNodes().find((x) => x.getName() === n).getWorldTranslation().map((v) => Math.round(v * 1e9) / 1e9 + 0);

test('drehY: +90° bringt +x nach -z, 180° kehrt x und z um, 0 ist die Einheit', () => {
  const an = (m, v) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + 0);
  assert.deepEqual(an(drehY(90), [1, 0, 0]), [0, 0, -1]);
  assert.deepEqual(an(drehY(90), [0, 0, 1]), [1, 0, 0]);
  assert.deepEqual(an(drehY(180), [1, 5, 2]), [-1, 5, -2]);
  assert.deepEqual(drehY(0), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
});

test('hallDrehen: die Wurzel dreht, jede Weltlage darunter mit', () => {
  const doc = halle();
  // vorher: Wurzel Z oben -> Y oben, (1, -2, 3) im Spiel ist (1, 3, 2) im Modell
  assert.deepEqual(ort(doc), [1, 3, 2]);
  assert.equal(hallDrehen(doc, 90), 90);
  assert.deepEqual(ort(doc), [2, 3, -1]);
  // die Höhe bleibt, der Abstand zur Achse auch
  const roh = halle();
  hallDrehen(roh, 180);
  assert.deepEqual(ort(roh), [-1, 3, -2]);
});

test('hallDrehen: ohne Drehung geschieht nichts, mehr als eine Wurzel oder keine Zahl bricht ab', () => {
  const doc = halle();
  const vorher = doc.getRoot().listNodes()[0].getMatrix().slice();
  assert.equal(hallDrehen(doc, 0), 0);
  assert.equal(hallDrehen(doc), 0);
  assert.deepEqual(doc.getRoot().listNodes()[0].getMatrix(), vorher);
  assert.throws(() => hallDrehen(halle({ wurzeln: 2 }), 90), /erwartet ist eine Wurzel, gefunden 2/);
  assert.throws(() => hallDrehen(halle(), Number.NaN), /NaN ist keine Zahl/);
});
