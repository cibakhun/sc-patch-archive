// Betrachter von „In 3D ansehen“ (assets/hangar-item3d.js) mit mehreren
// Teilen auf einmal (Krisz 27.11.2026: die Auswahl aus dem Prototyp, andere
// Farben nebeneinander und das ganze Set getragen, auch in der Werkbank).
//
// Geprueft wird, was ohne WebGL pruefbar ist: was der Betrachter aus dem
// Dialog liest (auftrag) und wie er die geladenen Teile stellt (anordnen).
// Die Teile sind Wuerfel bekannter Groesse statt echter Modelle; wie die
// Werkbank die Auswahl baut, steht in items-werkbank-3d.test.js.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { auftrag, anordnen } from '../../assets/hangar-item3d.js';

// Ein Teil wie aus dem glTF: eine Szene, darin das Mesh an seiner Stelle am
// Koerper (Breite, Hoehe, Tiefe; Mitte x, y, z).
function teil(b, h, t, x = 0, y = 0, z = 0) {
  const s = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, t));
  m.position.set(x, y, z);
  s.add(m);
  return s;
}
const huelle = (o) => new THREE.Box3().setFromObject(o);
const nah = (ist, soll, was) => assert.ok(Math.abs(ist - soll) < 1e-6, `${was}: ${ist}, erwartet ${soll}`);

describe('auftrag: was der Dialog bestellt', () => {
  test('1. Ein Modell aus data-i3d-model, wie auf der Item-Seite', () => {
    const a = auftrag({ i3dModel: 'https://ablage/a.glb' });
    assert.deepStrictEqual(a.urls, ['https://ablage/a.glb']);
    assert.strictEqual(a.art, 'einzeln');
  });

  test('2. Mehrere aus data-i3d-modelle; nebeneinander nur auf Bestellung, sonst getragen', () => {
    const n = auftrag({ i3dModel: 'a', i3dModelle: 'a  b\nc', i3dArt: 'nebeneinander' });
    assert.deepStrictEqual(n.urls, ['a', 'b', 'c']);
    assert.strictEqual(n.art, 'nebeneinander');
    assert.strictEqual(auftrag({ i3dModelle: 'a b', i3dArt: 'getragen' }).art, 'getragen');
    assert.strictEqual(auftrag({ i3dModelle: 'a b', i3dArt: 'quer' }).art, 'getragen');
    assert.strictEqual(auftrag({ i3dModelle: 'a b' }).art, 'getragen');
  });

  test('3. Ein einzelnes Teil ist einzeln, gleich welche Art bestellt ist', () => {
    assert.strictEqual(auftrag({ i3dModelle: 'a', i3dArt: 'nebeneinander' }).art, 'einzeln');
  });

  test('4. Der Schluessel unterscheidet Teile und Art (sonst luede der Betrachter nicht neu)', () => {
    const k = (ds) => auftrag(ds).schluessel;
    assert.strictEqual(k({ i3dModel: 'a' }), k({ i3dModelle: 'a', i3dModel: 'a' }));
    assert.notStrictEqual(k({ i3dModelle: 'a b', i3dArt: 'nebeneinander' }), k({ i3dModelle: 'a b', i3dArt: 'getragen' }));
    assert.notStrictEqual(k({ i3dModelle: 'a b' }), k({ i3dModelle: 'b a' }));
  });

  test('5. Nichts bestellt: keine Adresse', () => {
    assert.deepStrictEqual(auftrag({}).urls, []);
  });
});

describe('anordnen: wie die Teile stehen', () => {
  test('6. Einzeln: das Teil in die Mitte geruckt, keine Reihe', () => {
    const s = teil(1, 2, 1, 5, 7, -3);
    const l = anordnen([s], 'einzeln');
    const b = huelle(l.gruppe);
    nah(b.getCenter(new THREE.Vector3()).length(), 0, 'Mitte');
    assert.strictEqual(l.reihe, false);
    assert.strictEqual(l.lang, false);
    nah(l.box.max.y - l.box.min.y, 2, 'Hoehe der Huelle');
  });

  test('7. Getragen: jedes Teil bleibt, wo es am Koerper sitzt', () => {
    const helm = teil(0.4, 0.4, 0.4, 0, 1.7, 0);
    const beine = teil(0.5, 1, 0.4, 0, 0.5, 0);
    // Eine Szene, die schon verschoben ankommt (zweites Oeffnen), zaehlt
    // nicht: der Betrachter stellt sie zurueck.
    beine.position.set(3, 3, 3);
    const l = anordnen([helm, beine], 'getragen');
    const hm = huelle(helm).getCenter(new THREE.Vector3());
    const bm = huelle(beine).getCenter(new THREE.Vector3());
    nah(hm.y - bm.y, 1.2, 'Abstand Helm zu Beinen');
    nah(hm.x - bm.x, 0, 'seitlich');
    nah(huelle(l.gruppe).getCenter(new THREE.Vector3()).length(), 0, 'Mitte des Sets');
    assert.strictEqual(l.reihe, false);
  });

  test('8. Nebeneinander: von links nach rechts, ohne Ueberlappen, mit Luecke, mittig', () => {
    const s = [teil(1, 1, 1, 0, 0.5, 0), teil(2, 1, 1, 9, 0.5, 0), teil(1, 1, 1, -4, 0.5, 0)];
    const l = anordnen(s, 'nebeneinander');
    const b = s.map(huelle);
    // Die Luecke ist ein Fuenftel des breitesten Teils.
    nah(b[1].min.x - b[0].max.x, 0.4, 'Luecke 1–2');
    nah(b[2].min.x - b[1].max.x, 0.4, 'Luecke 2–3');
    nah(b[0].min.y, b[1].min.y, 'gleiche Hoehe');
    nah(huelle(l.gruppe).getCenter(new THREE.Vector3()).length(), 0, 'Mitte der Reihe');
    nah(l.box.max.x - l.box.min.x, 1 + 2 + 1 + 0.8, 'Breite der Huelle');
    assert.strictEqual(l.reihe, true);
    assert.strictEqual(l.lang, false);
  });

  test('9. Lange Teile (Waffen) nebeneinander: untereinander, das erste oben', () => {
    const s = [teil(0.1, 0.2, 1, 0, 0, 0), teil(0.1, 0.2, 1.2, 0, 0, 0)];
    const l = anordnen(s, 'nebeneinander');
    const b = s.map(huelle);
    assert.strictEqual(l.lang, true);
    assert.ok(b[0].min.y > b[1].max.y, 'das erste steht ueber dem zweiten');
    nah(b[0].min.y - b[1].max.y, 0.2 * 0.2, 'Luecke');
    nah(b[0].getCenter(new THREE.Vector3()).x, b[1].getCenter(new THREE.Vector3()).x, 'gleiche Spalte');
  });
});
