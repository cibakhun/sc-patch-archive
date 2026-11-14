// Kind-Container einer Halle (scripts/lib/hall-kinder.mjs): Die Halle des
// Spiels hängt ihre Frachtaufzüge als eigene Container ein, und der Export
// folgt dem nicht. An ihrer Stelle standen zwei Löcher von 48 x 32 m in den
// Längswänden (14.11.2026, am Bild gefunden). Der Schritt selbst läuft nur
// dort, wo die Spieldateien liegen; dieser Test prüft seine Rechnung an
// kleinen Dokumenten: Einträge lesen, an die genannte Stelle hängen (Lage und
// Drehung im Raum des Containers, Z oben), ein zweites Exemplar ohne zweite
// Geometrie, und die Ruhelage eines Teils.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRLightsPunctual } from '@gltf-transform/extensions';
import { unpartition } from '@gltf-transform/functions';
import { kinderAusXml, kindEinhaengen, kindLage, kinderBaumEinhaengen, wurzelVon } from '../../scripts/lib/hall-kinder.mjs';

// Z oben nach Y oben, wie die Wurzel jedes Exports
const Z_UP = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
const W = Math.SQRT1_2;

// Ein Export: Wurzel, Container-Knoten, darin ein Netz bei (1, 2, 3) und ein Licht bei (0, 0, 5), Achsen des Spiels
function ausfuhr(name) {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene();
  const wurzel = doc.createNode('CryEngine_Z_up').setMatrix(Z_UP);
  scene.addChild(wurzel);
  const innen = doc.createNode(`interior_${name}`);
  wurzel.addChild(innen);
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const mesh = doc.createMesh(`objects/probe/${name}.cga`).addPrimitive(doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]))).setIndices(acc('SCALAR', new Uint16Array([0, 1, 2]))).setMaterial(doc.createMaterial(`${name}_mtl`)));
  innen.addChild(doc.createNode('teil').setMesh(mesh).setTranslation([1, 2, 3]));
  const licht = doc.createExtension(KHRLightsPunctual).createLight().setType('point');
  innen.addChild(doc.createNode(`lg_${name}-000`).setTranslation([0, 0, 5]).setExtension('KHR_lights_punctual', licht));
  return doc;
}
const ort = (n) => n.getWorldMatrix().slice(12, 15).map((v) => Math.round(v * 1000) / 1000);
const unter = (doc, halter, name) => doc.getRoot().listNodes().filter((n) => n.getName() === name && (function auf(k) { return k ? k.getName() === halter || auf(k.getParentNode()) : false; })(n));

test('kinderAusXml: nur fremde Container, pos und rot als Zahlen, ohne Angabe im Ursprung', () => {
  const k = kinderAusXml(`<ObjectContainer><ChildObjectContainers>
    <Child external="1" name="Data/objectcontainers/a/modul.socpak" label="eins" pos="-120.00008200000002,-56,-4" rot="0.70710677,0,0,0.70710677"/>
    <Child external="0" name="Data/objectcontainers/a/eigen.socpak" pos="1,2,3"/>
    <Child external="1" name="Data\\objectcontainers\\b\\ohne.socpak"/>
    <Child external="1" name="Data/objectcontainers/a/kein-container.xml" pos="1,2,3"/>
  </ChildObjectContainers></ObjectContainer>`);
  assert.deepEqual(k, [
    { name: 'Data/objectcontainers/a/modul.socpak', label: 'eins', pos: [-120.00008200000002, -56, -4], rot: [0.70710677, 0, 0, 0.70710677] },
    { name: 'Data/objectcontainers/b/ohne.socpak', label: '', pos: [0, 0, 0], rot: [1, 0, 0, 0] },
  ]);
});

test('kinderAusXml: eine Angabe, die keine Zahlenreihe ist, bricht ab', () => {
  assert.throws(() => kinderAusXml('<Child external="1" name="a.socpak" pos="1,2"/>'), /pos="1,2" ist keine Reihe aus 3 Zahlen/);
  assert.throws(() => kinderAusXml('<Child external="1" name="a.socpak" rot="1,0,0,x"/>'), /rot="1,0,0,x" ist keine Reihe aus 4 Zahlen/);
});

test('kindEinhaengen: das Kind steht, wo der Eintrag es nennt, gedreht um die Hochachse des Spiels', () => {
  const room = ausfuhr('halle'), src = ausfuhr('modul');
  // +90° um Z: (1, 2, 3) wird (-2, 1, 3), dazu die Stelle; glTF = (x, z, -y)
  const r = kindEinhaengen(room, src, [{ pos: [-120, -56, -4], rot: [W, 0, 0, W] }], 'modul');
  assert.deepEqual(r, { stellen: 1, knoten: 3, dreiecke: 1, lichter: 1 });
  assert.deepEqual(ort(unter(room, 'kind_modul_1', 'teil')[0]), [-122, -1, 55]);
  assert.deepEqual(ort(unter(room, 'kind_modul_1', 'lg_modul-000')[0]), [-120, 1, 56]);
  // die Halle selbst bleibt, wo sie war
  assert.deepEqual(ort(room.getRoot().listNodes().find((n) => n.getName() === 'teil' && n.getParentNode().getName() === 'interior_halle')), [1, 3, -2]);
});

test('kindEinhaengen: zwei Stellen, zwei Exemplare, eine Geometrie; die Datei bleibt lesbar', async () => {
  const room = ausfuhr('halle'), src = ausfuhr('modul');
  kindEinhaengen(room, src, [{ pos: [-120, -56, -4], rot: [W, 0, 0, W] }, { pos: [-24, -164, -4], rot: [W, 0, 0, -W] }], 'modul');
  assert.deepEqual(ort(unter(room, 'kind_modul_1', 'teil')[0]), [-122, -1, 55]);
  // -90° um Z: (1, 2, 3) wird (2, -1, 3)
  assert.deepEqual(ort(unter(room, 'kind_modul_2', 'teil')[0]), [-22, -1, 165]);
  assert.equal(unter(room, 'kind_modul_1', 'teil')[0].getMesh(), unter(room, 'kind_modul_2', 'teil')[0].getMesh(), 'beide Exemplare teilen sich das Netz');
  assert.equal(room.getRoot().listMeshes().length, 2, 'Netz der Halle und eines des Kindes');
  assert.equal(room.getRoot().listScenes().length, 1, 'die Szene des Kindes ist weg');
  await room.transform(unpartition());
  const io = new NodeIO().registerExtensions([KHRLightsPunctual]);
  const wieder = await io.readBinary(await io.writeBinary(room));
  assert.equal(wieder.getRoot().listNodes().filter((n) => n.getExtension('KHR_lights_punctual')).length, 3, 'Licht der Halle und je Exemplar eines');
  assert.equal(wieder.getRoot().listMeshes().length, 2);
});

test('kindEinhaengen: ein Export mit anderem Aufbau oder eine Angabe, die keine Drehung ist, bricht ab', () => {
  const fremd = new Document();
  fremd.createScene().addChild(fremd.createNode('anders'));
  assert.throws(() => wurzelVon(fremd, 'Probe'), /Probe: erwartet ist eine Szene mit der einen Wurzel CryEngine_Z_up/);
  assert.throws(() => kindEinhaengen(ausfuhr('halle'), fremd, [{ pos: [0, 0, 0], rot: [1, 0, 0, 0] }], 'fremd'), /fremd: erwartet ist eine Szene/);
  assert.throws(() => kindEinhaengen(ausfuhr('halle'), ausfuhr('modul'), [{ pos: [0, 0, 0], rot: [0.5, 0, 0, 0.5] }], 'modul'), /ist keine Drehung/);
  assert.throws(() => kindEinhaengen(ausfuhr('halle'), ausfuhr('modul'), [], 'modul'), /keine Stelle genannt/);
});

test('kindLage: das Teil fährt im Raum seines Netzes, alles andere bleibt', () => {
  const src = ausfuhr('tor');
  // der Knoten des Tors steht um 180° gedreht im Container (wie im Aufzugsmodul): 1 m längs seiner
  // eigenen x-Achse ist im Container 1 m zurück, 6 m nach oben bleiben 6 m nach oben
  const tor = src.getRoot().listNodes().find((n) => n.getName() === 'teil').setRotation([0, 0, 1, 0]);
  assert.equal(kindLage(src, /(^|[\\/])tor\.cga$/i, [1, 0, 6]), 1);
  assert.deepEqual(tor.getTranslation().map((v) => Math.round(v * 1000) / 1000), [0, 2, 9]);
  assert.deepEqual(src.getRoot().listNodes().find((n) => n.getName() === 'lg_tor-000').getTranslation(), [0, 0, 5]);
  assert.equal(kindLage(src, /(^|[\\/])anderes\.cga$/i, [0, 0, 6]), 0, 'kein Netz getroffen, nichts gestellt');
});

test('kinderBaumEinhaengen: Kind im Kind, zwei Exemplare; gestellt wird jedes Teil genau einmal', async () => {
  // Halle -> Modul an zwei Stellen -> darin die Kabine mit dem Tor an einer Stelle, um 180° gedreht
  const baum = [{ id: 'modul', name: 'a/modul.socpak', stellen: [{ pos: [-120, -56, -4], rot: [W, 0, 0, W] }, { pos: [-24, -164, -4], rot: [W, 0, 0, -W] }],
    kinder: [{ id: 'tor', name: 'a/tor.socpak', stellen: [{ pos: [0, 10, 0], rot: [0, 0, 0, 1] }], kinder: [] }] }];
  const lagen = [{ muster: /(^|[\\/])tor\.cga$/i, versatz: [0, 0, 6], knoten: 0 }];
  const liste = [], room = ausfuhr('halle');
  const lichter = await kinderBaumEinhaengen(room, baum, { lese: (c) => ausfuhr(c.id), zeilen: (c) => [`Light 'lg_${c.id}-000' type=Omni intensity=1 radius=2`], lagen, liste });
  assert.equal(lagen[0].knoten, 2, 'ein Tor je Exemplar des Moduls');
  // Tor: (1, 2, 3) + 6 nach oben = (1, 2, 9); in der Kabine um 180° um Z und 10 nach y: (-1, 8, 9);
  // Modul 1 um +90°: (-8, -1, 9), dazu (-120, -56, -4) = (-128, -57, 5); glTF = (x, z, -y)
  assert.deepEqual(ort(unter(room, 'kind_modul_1', 'teil').find((n) => /tor\.cga$/.test(n.getMesh().getName()))), [-128, 5, 57]);
  // Modul 2 um -90°: (8, 1, 9), dazu (-24, -164, -4) = (-16, -163, 5)
  assert.deepEqual(ort(unter(room, 'kind_modul_2', 'teil').find((n) => /tor\.cga$/.test(n.getMesh().getName()))), [-16, 5, 163]);
  // das Netz des Moduls selbst fährt nicht
  assert.deepEqual(ort(unter(room, 'kind_modul_1', 'teil').find((n) => /modul\.cga$/.test(n.getMesh().getName()))), [-122, -1, 55]);
  assert.deepEqual(lichter, ["Light 'lg_modul-000' type=Omni intensity=1 radius=2", "Light 'lg_tor-000' type=Omni intensity=1 radius=2", "Light 'lg_modul-000' type=Omni intensity=1 radius=2", "Light 'lg_tor-000' type=Omni intensity=1 radius=2"]);
  assert.deepEqual(liste.map((e) => [e.id, e.ebene, e.exemplare, e.jeExemplar.dreiecke, e.jeExemplar.lichtknoten]), [['tor', 1, 2, 1, 1], ['modul', 0, 2, 2, 2]]);
});
