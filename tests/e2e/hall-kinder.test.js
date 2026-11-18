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
import { kinderAusXml, kindEinhaengen, kindLage, kindNur, kinderBaumEinhaengen, kinderBestand, kinderKonfig, planKennung, wurzelVon, nmcKnoten, spurVersatz, eingehaengtGilt, eingehaengtSchreiben, kelvinFarbe, anhangLampen, lampenEinhaengen, lampenZeile, halleAnhang } from '../../scripts/lib/hall-kinder.mjs';
import { lichtZeile } from '../../scripts/lib/hall-lights.mjs';

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

test('planKennung: Stelle, Drehung, Zahl und Tiefe der Kinder zählen, der Ort der Exporte nicht', () => {
  const plan = (aendern = (b) => b) => aendern([{ id: 'modul', name: 'a/modul.socpak', glb: '/tmp/a/modul-lod1.glb', licht: '/tmp/a/modul.txt',
    stellen: [{ pos: [-120, -56, -4], rot: [W, 0, 0, W], label: 'eins' }, { pos: [-24, -164, -4], rot: [W, 0, 0, -W], label: 'zwei' }],
    kinder: [{ id: 'tor', name: 'a/tor.socpak', glb: '/tmp/a/tor-lod1.glb', licht: '/tmp/a/tor.txt', stellen: [{ pos: [0, 10, 0], rot: [0, 0, 0, 1], label: '' }], kinder: [] }] }]);
  const gleich = planKennung(plan());
  assert.equal(planKennung(plan((b) => { b[0].glb = 'D:/anders/modul-lod1.glb'; b[0].licht = 'D:/anders/modul.txt'; b[0].stellen[0].label = 'umbenannt'; return b; })), gleich, 'Pfade und Etiketten ändern das Eingehängte nicht');
  const anders = {
    'derselbe Name aus einem anderen Ordner des Spiels': (b) => { b[0].name = 'b/modul.socpak'; return b; },
    'Stelle verschoben': (b) => { b[0].stellen[1].pos = [-24, -164, -3.5]; return b; },
    'Stelle gedreht': (b) => { b[0].stellen[0].rot = [1, 0, 0, 0]; return b; },
    'eine Stelle weniger': (b) => { b[0].stellen.pop(); return b; },
    'Stellen vertauscht (die Halter tragen ihre Nummer)': (b) => { b[0].stellen.reverse(); return b; },
    'Kind des Kindes fehlt': (b) => { b[0].kinder = []; return b; },
    'Kind des Kindes verschoben': (b) => { b[0].kinder[0].stellen[0].pos = [0, 11, 0]; return b; },
    'ein Kind mehr': (b) => [...b, { id: 'kabine', name: 'a/kabine.socpak', stellen: [{ pos: [0, 0, 0], rot: [1, 0, 0, 0] }], kinder: [] }],
    'kein Kind mehr': () => [],
  };
  const kennungen = new Set([gleich]);
  for (const [was, f] of Object.entries(anders)) {
    const k = planKennung(plan(f));
    assert.notEqual(k, gleich, was);
    kennungen.add(k);
  }
  assert.equal(kennungen.size, Object.keys(anders).length + 1, 'jede Änderung hat ihre eigene Kennung');
});

test('kinderKonfig: Regeln und Plan zusammen; ein Kind an anderer Stelle macht das Eingehängte ungültig', () => {
  const regeln = { folge: [/[\\/]modul\.socpak$/i], lage: [{ cga: 'tor', knochen: 'tor', spur: 'open' }] };
  const baum = (y) => [{ id: 'modul', stellen: [{ pos: [0, y, 0], rot: [1, 0, 0, 0] }], kinder: [] }];
  const k = kinderKonfig(regeln, baum(10));
  assert.equal(kinderKonfig(regeln, baum(10)), k, 'derselbe Stand, dieselbe Kennung');
  assert.notEqual(kinderKonfig(regeln, baum(12)), k, 'das Kind steht woanders');
  assert.notEqual(kinderKonfig(regeln, []), k, 'das Kind steht nicht mehr in der XML');
  assert.notEqual(kinderKonfig({ ...regeln, folge: [/[\\/]anderes\.socpak$/i] }, baum(10)), k, 'andere Muster');
  assert.notEqual(kinderKonfig({ folge: regeln.folge }, baum(10)), k, 'keine Lage mehr');
  const mitNur = kinderKonfig({ ...regeln, nur: [{ kind: 'schrank', netz: ['tuer'] }] }, baum(10));
  assert.notEqual(mitNur, k, 'von einem Kind steht nur noch ein Teil');
  assert.notEqual(kinderKonfig({ ...regeln, nur: [{ kind: 'schrank', netz: ['tuer', 'kabine'] }] }, baum(10)), mitNur, 'andere Auswahl');
  assert.equal(kinderKonfig({ ...regeln, nur: [] }, baum(10)), k, 'eine leere Auswahl ist keine');
  assert.equal(JSON.parse(k).plan, planKennung(baum(10)), 'der Bericht trägt den Plan');
});

// ─── siebte Runde des Reviews an PR #371 (15.11.2026) ───────────────────────
// Der Knotenbaum einer .cga, wie „nmc dump“ ihn druckt (Zeilenenden wie unter
// Windows). tor: wo der Knochen ruht.
const dumpVon = (tor = [0, 0, 0], dreh = false) => [
  '# NMC dump: probe.cga (3 nodes)',
  '',
  '[  0] probe_rendermesh parent=2 geom=0 scale=[0.0000,0.0000,0.0000]',
  `       b2w[0] = [   1.00000,    0.00000,    0.00000,    ${tor[0].toFixed(5)}]`,
  `       b2w[1] = [   0.00000,    1.00000,    0.00000,    ${tor[1].toFixed(5)}]`,
  `       b2w[2] = [   0.00000,    0.00000,    1.00000,    ${tor[2].toFixed(5)}]`,
  '',
  '[  1] probe parent=root geom=2 scale=[0.0000,0.0000,0.0000]',
  '       b2w[0] = [   1.00000,    0.00000,    0.00000,    0.00000]',
  '       b2w[1] = [   0.00000,    1.00000,    0.00000,    0.00000]',
  '       b2w[2] = [   0.00000,    0.00000,    1.00000,    0.00000]',
  '',
  '[  2] anim_door parent=1 geom=3 scale=[1.0000,1.0000,1.0000]',
  dreh ? `       b2w[0] = [   0.00000,   -1.00000,    0.00000,    ${tor[0].toFixed(5)}]` : `       b2w[0] = [   1.00000,    0.00000,    0.00000,    ${tor[0].toFixed(5)}]`,
  dreh ? `       b2w[1] = [   1.00000,    0.00000,    0.00000,    ${tor[1].toFixed(5)}]` : `       b2w[1] = [   0.00000,    1.00000,    0.00000,    ${tor[1].toFixed(5)}]`,
  `       b2w[2] = [   0.00000,    0.00000,    1.00000,    ${tor[2].toFixed(5)}]`,
  '',
].join('\r\n');

test('nmcKnoten: Index, Name, Elternknoten, Art und Lage je Knoten', () => {
  const k = nmcKnoten(dumpVon([0, 0, 2]));
  assert.deepEqual(k.map((n) => [n.index, n.name, n.parent, n.geom]), [[0, 'probe_rendermesh', 2, 0], [1, 'probe', null, 2], [2, 'anim_door', 1, 3]]);
  assert.deepEqual(k[2].b2w, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 2]]);
  // ohne die Zeilen zur Lage bleibt der Knoten lesbar, seine Lage aber offen
  assert.equal(nmcKnoten('[  0] teil parent=root geom=0 scale=[1,1,1]\n')[0].b2w, null);
});

test('spurVersatz: ruht der Knochen im Ursprung, ist der letzte Wert der Spur der Versatz', () => {
  // so das Tor des Frachtaufzugs der Large-Halle (an den Rohdateien gemessen: Ruhelage 0/0/0, Spur 0/0/0 bis 0/0/6)
  assert.deepEqual(spurVersatz(nmcKnoten(dumpVon()), 'anim_door', [[0, 0, 0], [0, 0, 3], [0, 0, 6]]), { ruhe: [0, 0, 0], versatz: [0, 0, 6] });
});

test('spurVersatz: ruht der Knochen woanders, zählt nur der Weg ab der Ruhelage', () => {
  // der Fall des Befunds: Die Spur nennt die Lage im Raum des Elternknotens, die Ruhelage steckt schon im Netz
  assert.deepEqual(spurVersatz(nmcKnoten(dumpVon([0, 0, 2])), 'anim_door', [[0, 0, 2], [0, 0, 8]]), { ruhe: [0, 0, 2], versatz: [0, 0, 6] });
});

test('spurVersatz: ein gedrehter Knochen, ein Knoten ohne Lage oder eine leere Spur bricht ab', () => {
  assert.throws(() => spurVersatz(nmcKnoten(dumpVon([0, 0, 0], true)), 'anim_door', [[0, 0, 6]]), /anim_door gedreht/);
  assert.throws(() => spurVersatz(nmcKnoten('[  0] netz parent=1 geom=0 scale=[1,1,1]\n[  1] anim_door parent=root geom=3 scale=[1,1,1]\n'), 'anim_door', [[0, 0, 6]]), /ohne lesbare Lage/);
  assert.throws(() => spurVersatz(nmcKnoten(dumpVon()), 'anim_door', []), /keine Lage/);
  assert.throws(() => spurVersatz(nmcKnoten(dumpVon()), 'anim_tor', [[0, 0, 6]]), /keinen Knochen anim_tor/);
});

test('spurVersatz: ein gedrehtes Netz geht, wenn seine Drehung den Versatz nicht ändert', () => {
  // so das 30-m-Tor des Frachtaufzugs der XL-Halle: das Netz des 25-m-Tors um 180° um die Hochachse gedreht
  // Zeilen 3 bis 5 sind die Lage des Netzes (Knoten 0)
  const netzLage = (r0, r1, r2) => { const z = dumpVon().split('\r\n'); [z[3], z[4], z[5]] = [r0, r1, r2].map((r, i) => `       b2w[${i}] = [${r.map((v) => v.toFixed(5).padStart(11)).join(',')},     0.00000]`); return z.join('\r\n'); };
  const dump = netzLage([-1, 0, 0], [0, -1, 0], [0, 0, 1]);
  assert.match(dump, /b2w\[1\] = \[\s+0\.00000,\s+-1\.00000/, 'die Probe dreht das Netz (Knoten 0)');
  assert.deepEqual(spurVersatz(nmcKnoten(dump), 'anim_door', [[0, 0, 0], [0, 0, 6]]), { ruhe: [0, 0, 0], versatz: [0, 0, 6] });
  // fährt das Tor seitwärts, dreht die halbe Drehung den Weg um: das bricht ab
  assert.throws(() => spurVersatz(nmcKnoten(dump), 'anim_door', [[0, 0, 0], [2, 0, 6]]), /probe_rendermesh gedreht, und die Drehung ändert den Versatz 2,0,6/);
  // um die Querachse gedreht, ändert sich auch der senkrechte Weg
  const kipp = netzLage([1, 0, 0], [0, 0, -1], [0, 1, 0]);
  assert.throws(() => spurVersatz(nmcKnoten(kipp), 'anim_door', [[0, 0, 6]]), /probe_rendermesh gedreht, und die Drehung ändert den Versatz 0,0,6/);
});

// ein Rohordner als Tabelle: Name -> { zeit, text }
function platte(anfang) {
  const d = new Map(Object.entries(anfang));
  let uhr = 100;
  return {
    d,
    w: { da: (f) => d.has(f), zeit: (f) => d.get(f).zeit, lies: (f) => d.get(f).text },
    schreib: (f, text = '') => d.set(f, { zeit: ++uhr, text }),
    weg: (f) => d.delete(f),
  };
}
const FRAGE = { modell: 'halle.glb', licht: 'halle.lights-src.txt', bericht: 'halle.kinder.json', konfig: 'K1', quellen: ['roh.glb', 'kind.glb'] };
const STAND = { 'roh.glb': { zeit: 1 }, 'kind.glb': { zeit: 2 }, 'halle.glb': { zeit: 5 }, 'halle.lights-src.txt': { zeit: 5 }, 'halle.kinder.json': { zeit: 5, text: '{"konfig":"K1"}' } };

test('eingehaengtGilt: Modell, Lichtprotokoll und Bericht da, dieselbe Konfiguration, keine Quelle jünger', () => {
  assert.equal(eingehaengtGilt(FRAGE, platte(STAND).w), true);
  assert.equal(eingehaengtGilt({ ...FRAGE, force: true }, platte(STAND).w), false);
  assert.equal(eingehaengtGilt({ ...FRAGE, konfig: 'K2' }, platte(STAND).w), false);
  assert.equal(eingehaengtGilt(FRAGE, platte({ ...STAND, 'kind.glb': { zeit: 9 } }).w), false);
  for (const f of ['halle.glb', 'halle.kinder.json']) { const p = platte(STAND); p.weg(f); assert.equal(eingehaengtGilt(FRAGE, p.w), false, f); }
});

test('eingehaengtGilt: ohne Lichtprotokoll oder mit unlesbarem Bericht gilt nichts', () => {
  // der Fall des Befunds: Modell und Bericht stehen, das Lichtprotokoll fehlt
  const p = platte(STAND);
  p.weg('halle.lights-src.txt');
  assert.equal(eingehaengtGilt(FRAGE, p.w), false);
  assert.equal(eingehaengtGilt(FRAGE, platte({ ...STAND, 'halle.kinder.json': { zeit: 5, text: '{"konfig":"K' } }).w), false);
});

test('eingehaengtSchreiben: ein Lauf, der an irgendeiner Stelle abbricht, gilt beim nächsten nicht als fertig', async () => {
  // eine Quelle hat sich geändert (jünger als das alte Modell), der Lauf baut neu und bricht nach Schritt n ab
  for (let n = 0; n <= 3; n++) {
    const p = platte({ ...STAND, 'kind.glb': { zeit: 50 } });
    let schritt = 0;
    const tu = (f) => () => { if (schritt++ >= n) throw new Error('abgebrochen'); return f(); };
    await assert.rejects(eingehaengtSchreiben({
      berichtWeg: tu(() => p.weg('halle.kinder.json')),
      licht: tu(() => p.schreib('halle.lights-src.txt')),
      modell: tu(async () => p.schreib('halle.glb')),
      bericht: tu(() => p.schreib('halle.kinder.json', '{"konfig":"K1"}')),
    }), /abgebrochen/);
    assert.equal(eingehaengtGilt(FRAGE, p.w), false, `Abbruch nach ${n} Schritten`);
  }
  // und der ganze Lauf gilt
  const p = platte({ ...STAND, 'kind.glb': { zeit: 50 } });
  await eingehaengtSchreiben({ berichtWeg: () => p.weg('halle.kinder.json'), licht: () => p.schreib('halle.lights-src.txt'), modell: async () => p.schreib('halle.glb'), bericht: () => p.schreib('halle.kinder.json', '{"konfig":"K1"}') });
  assert.equal(eingehaengtGilt(FRAGE, p.w), true);
});

// Ein Aufzug für Personen, wie das Spiel ihn einhängt: die Tür vorn, dahinter in einer Gruppe die Kabine mit
// ihrer Leuchte (Netz und Licht), dazu das Licht des Containers. Die Tür ist das Netz aus ausfuhr().
function schrank(name = 'schrank') {
  const doc = ausfuhr(name), innen = doc.getRoot().listNodes().find((n) => n.getName() === `interior_${name}`);
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const netz = (datei, dreiecke) => doc.createMesh(`objects/probe/${datei}.cga`).addPrimitive(doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array(9 * dreiecke))).setIndices(acc('SCALAR', new Uint16Array(3 * dreiecke).map((_, i) => i))));
  const gruppe = doc.createNode('gruppe_kabine').setTranslation([0, 4, 0]);
  innen.addChild(gruppe);
  gruppe.addChild(doc.createNode('kabine').setMesh(netz('kabine', 5)));
  const leuchte = doc.createNode('leuchte').setMesh(netz('leuchte', 2));
  gruppe.addChild(leuchte);
  leuchte.addChild(doc.createNode('lg_leuchte-001').setExtension('KHR_lights_punctual', doc.createExtension(KHRLightsPunctual).createLight().setType('spot')));
  return doc;
}
const TUER = /(^|[\\/])schrank\.(cga|cgf)$/i;

test('kindNur: nur die Tür bleibt, Kabine, Leuchte und jedes Licht fallen samt ihren leeren Ästen', async () => {
  const src = schrank();
  const r = kindNur(src, [TUER], 'schrank');
  assert.deepEqual(r, { netze: 1, dreiecke: 1, wegNetze: 2, wegDreiecke: 7, wegLichter: 2 });
  assert.deepEqual(src.getRoot().listNodes().map((n) => n.getName()).sort(), ['CryEngine_Z_up', 'interior_schrank', 'teil']);
  assert.deepEqual(src.getRoot().listMeshes().map((m) => m.getName()), ['objects/probe/schrank.cga']);
  // die Tür steht, wo sie stand
  assert.deepEqual(ort(src.getRoot().listNodes().find((n) => n.getName() === 'teil')), [1, 3, -2]);
  // die Datei bleibt lesbar und trägt kein Licht mehr
  await src.transform(unpartition());
  const io = new NodeIO().registerExtensions([KHRLightsPunctual]);
  const wieder = await io.readBinary(await io.writeBinary(src));
  assert.equal(wieder.getRoot().listNodes().filter((n) => n.getExtension('KHR_lights_punctual')).length, 0);
  assert.equal(wieder.getRoot().listMeshes().length, 1);
});

test('kindNur: ein Ast bleibt, solange ein behaltenes Netz darunter hängt; ein Muster ohne Netz bricht ab', () => {
  const src = schrank();
  const r = kindNur(src, [TUER, /(^|[\\/])leuchte\.cga$/i], 'schrank');
  assert.deepEqual([r.netze, r.dreiecke, r.wegNetze, r.wegLichter], [2, 3, 1, 2]);
  assert.deepEqual(src.getRoot().listNodes().map((n) => n.getName()).sort(), ['CryEngine_Z_up', 'gruppe_kabine', 'interior_schrank', 'leuchte', 'teil']);
  assert.throws(() => kindNur(schrank(), [TUER, /(^|[\\/])gibt_es_nicht\.cga$/i], 'schrank'), /schrank: kein Netz trifft .*gibt_es_nicht.*ohne Anlass/);
});

test('kinderBaumEinhaengen mit nur: neun Türen, keine Kabine, keine Lichtzeile; andere Kinder bleiben ganz', async () => {
  const stellen = Array.from({ length: 9 }, (_, i) => ({ pos: [10 * i, 0, 0], rot: [1, 0, 0, 0] }));
  const baum = [{ id: 'schrank', name: 'a/schrank.socpak', stellen, kinder: [] }, { id: 'modul', name: 'a/modul.socpak', stellen: [{ pos: [0, 50, 0], rot: [1, 0, 0, 0] }], kinder: [] }];
  const nur = [{ kind: 'schrank', muster: [TUER], exemplare: 0 }];
  const liste = [], room = ausfuhr('halle');
  const lichter = await kinderBaumEinhaengen(room, baum, { lese: (c) => (c.id === 'schrank' ? schrank() : ausfuhr(c.id)), zeilen: (c) => [`Light 'lg_${c.id}-000' type=Omni intensity=1 radius=2`], nur, liste });
  assert.equal(nur[0].exemplare, 9);
  assert.deepEqual(lichter, ["Light 'lg_modul-000' type=Omni intensity=1 radius=2"], 'nur das Modul bringt seine Lichtzeile mit');
  const netze = room.getRoot().listNodes().filter((n) => n.getMesh()).map((n) => n.getMesh().getName().split('/').pop());
  assert.equal(netze.filter((n) => n === 'schrank.cga').length, 9);
  assert.equal(netze.filter((n) => n === 'kabine.cga' || n === 'leuchte.cga').length, 0);
  assert.equal(room.getRoot().listNodes().filter((n) => n.getExtension('KHR_lights_punctual')).length, 2, 'Licht der Halle und des Moduls');
  const e = liste.find((x) => x.id === 'schrank');
  assert.deepEqual([e.exemplare, e.jeExemplar.dreiecke, e.jeExemplar.lichtknoten, e.jeExemplar.lichtzeilen], [9, 1, 0, 0]);
  assert.deepEqual(e.nur, { netze: 1, dreiecke: 1, wegNetze: 2, wegDreiecke: 7, wegLichter: 2 });
  assert.equal(liste.find((x) => x.id === 'modul').nur, undefined);
  // die neunte Tür steht an ihrer Stelle: (1, 2, 3) + (80, 0, 0); glTF = (x, z, -y)
  assert.deepEqual(ort(unter(room, 'kind_schrank_9', 'teil')[0]), [81, 3, -2]);
});

// Was der Build am Rohmodell zählt und ins Manifest schreibt (kinder); verify:hangar-hallen hält die Zahl über
// einer Klinke. Fielen die Türen wieder weg, bliebe sonst nur ein Loch im Bild.
test('kinderBestand: je Kennung die Halter mit Dreiecken; ein Kind im Kind zählt unter seiner Kennung und bei seinem Elterncontainer mit', async () => {
  const stellen = Array.from({ length: 9 }, (_, i) => ({ pos: [10 * i, 0, 0], rot: [1, 0, 0, 0] }));
  const baum = [{ id: 'schrank', name: 'a/schrank.socpak', stellen, kinder: [] },
    { id: 'modul', name: 'a/modul.socpak', stellen: [{ pos: [0, 50, 0], rot: [1, 0, 0, 0] }, { pos: [0, -50, 0], rot: [1, 0, 0, 0] }], kinder: [{ id: 'tor', name: 'a/tor.socpak', stellen: [{ pos: [0, 10, 0], rot: [1, 0, 0, 0] }], kinder: [] }] }];
  const room = ausfuhr('halle');
  assert.deepEqual(kinderBestand(room), { exemplare: 0, je: {} }, 'eine Halle ohne Kinder nennt keine');
  await kinderBaumEinhaengen(room, baum, { lese: (c) => (c.id === 'schrank' ? schrank() : ausfuhr(c.id)), nur: [{ kind: 'schrank', muster: [TUER], exemplare: 0 }] });
  // neun Türen (je 1 Dreieck), zwei Module (je ihr Netz und das ihres Tors), zwei Tore (im zweiten Modul als Kopie)
  assert.deepEqual(kinderBestand(room), { exemplare: 13, je: { modul: { exemplare: 2, tris: 4 }, schrank: { exemplare: 9, tris: 9 }, tor: { exemplare: 2, tris: 2 } } });
  // die Datei, die der Build liest, trägt die Halter noch
  await room.transform(unpartition());
  const io = new NodeIO().registerExtensions([KHRLightsPunctual]);
  assert.equal(kinderBestand(await io.readBinary(await io.writeBinary(room))).exemplare, 13);
});

test('kinderBestand: ein Halter ohne Dreieck zählt nicht, ein fremder Knoten mit extras.kind auch nicht', () => {
  const room = ausfuhr('halle');
  kindEinhaengen(room, schrank(), [{ pos: [0, 0, 0], rot: [1, 0, 0, 0] }, { pos: [10, 0, 0], rot: [1, 0, 0, 0] }], 'schrank');
  assert.equal(kinderBestand(room).je.schrank.exemplare, 2);
  // dem zweiten Exemplar jedes Netz genommen: Der Halter steht noch im Baum, in der Wand bliebe das Loch
  const zwei = room.getRoot().listNodes().find((n) => n.getName() === 'kind_schrank_2');
  zwei.traverse((n) => n.setMesh(null));
  assert.deepEqual(kinderBestand(room), { exemplare: 1, je: { schrank: { exemplare: 1, tris: 8 } } });
  // extras.kind an einem Knoten, der kein Halter ist (anderer Name), und ein Halter mit fremder Kennung im Namen
  const teil = room.getRoot().listNodes().find((n) => n.getName() === 'teil');
  teil.setExtras({ kind: 'schrank' });
  room.getRoot().listNodes().find((n) => n.getName() === 'kind_schrank_1').setExtras({ kind: 'anders', stelle: 1 });
  assert.deepEqual(kinderBestand(room), { exemplare: 0, je: {} });
});

// ─── Lampen einer Lichtgruppe, die an einem Knochen hängt (15.11.2026) ───────
// Die Kabine des Frachtaufzugs der Large-Halle stand mit ihren Leuchten im Modell, aber ohne Lampe: Ihre
// Lichtgruppe hängt am Knochen der Plattform, und solche Gruppen lässt der Export weg. Die Entities hier sind
// so gebaut, wie die .soc des Aufzugs sie nennt (Träger ohne Pos und Rotate, die Gruppe mit eigenem Ort).
const lampeXml = ({ name = 'l_probe-001', aktiv = 1, typ = 'SoftOmni', temp = 0, staerke = '0.050000001', kelvin = 2500, farbe = [0.25, 0.5, 0.75], radius = 5, fov = 75, rot = '1,0,0,0', ort = '1,2,3.1' } = {}) => `
      <Light EntityCryGUID="x" Name="${name}">
        <BaseProperties ViewDistRatio="100" Holographic="0" />
        <EntityComponentLight __type="LightComponentParams" active="${aktiv}" lightType="${typ}" importance="Standard" useTemperature="${temp}">
          <sizeParams __type="LightSizeParams" lightRadius="${radius}" bulbRadius="0.05" planeWidth="0.1" planeHeight="0.6" />
          <offState __type="LightStateParams_Off" presetTag="" />
          <defaultState __type="LightStateParams_Default" intensity="${staerke}" presetTag="default" lightStyle="0" temperature="${kelvin}">
            <color __type="RGB" r="${farbe[0]}" g="${farbe[1]}" b="${farbe[2]}" />
          </defaultState>
          <auxiliaryState __type="LightStateParams_Aux" intensity="2" presetTag="" lightStyle="3" temperature="1000">
            <color __type="RGB" r="1" g="0.1" b="0" />
          </auxiliaryState>
          <projectorParams __type="LightProjectorParams" texture="textures/lights/generic/rect.dds" FOV="${fov}" focusedBeam="0" />
        </EntityComponentLight>
        <GeomLink EntityCryGUID="y" />
        <RelativeXForm rotation="${rot}" translation="${ort}" />
      </Light>`;
const GRUPPE = 'Name="lg_anhang" ParentEntityCryGUID="p1" AttachmentType="CharacterBone" AttachmentTarget="anim_lift" ParentOffsetPos="-0.01,-11,0.5" ParentOffsetRot="1,0,0,0" Pos="-0.01,-11,0.5" EntityClass="LightGroupObjectAttach" EntityCryGUID="g1"';
const TRAEGER = 'Name="Plattform" EntityClass="LoadingPlatform" EntityCryGUID="p1"';
const containerXml = ({ lampen = [lampeXml()], gruppe = GRUPPE, traeger = TRAEGER, mehr = '' } = {}) => `<Entities>
  <Entity ${traeger}>
    <Components><geom __type="GlobalResourceGeometry" path="objects/probe/plattform_a.cga" /></Components>
  </Entity>
  <Entity Name="leer" EntityClass="AreaShape" EntityCryGUID="s1" />
  <Entity ${gruppe}>
    <Lights>${lampen.join('')}
    </Lights>
  </Entity>${mehr}
</Entities>`;
const WAS = { gruppe: 'lg_anhang', knochen: 'anim_lift' };
// fünf Lampen: Wandleuchte (Farbe genannt), Strahler mit Farbtemperatur (um 90° um Z gedreht), eine ohne
// Stärke im Ruhezustand, eine abgeschaltete, ein Flächenlicht
const FUENF = [
  lampeXml(),
  lampeXml({ name: 'l_probe_key-001', typ: 'Projector', temp: 1, staerke: 30, kelvin: 3500, radius: 20, fov: 110, rot: `${W},0,0,${W}`, ort: '4,5,6' }),
  lampeXml({ name: 'l_probe_spin-001', typ: 'Projector', temp: 1, staerke: 0, kelvin: 1000, ort: '0,0,7' }),
  lampeXml({ name: 'l_probe_aus-001', aktiv: 0, ort: '0,0,8' }),
  lampeXml({ name: 'l_probe_ceil-001', typ: 'Planar', staerke: '2.4000001', radius: 10, ort: '0,-4,7.9' }),
];
const nah6 = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

test('kelvinFarbe: die Farbe, die der Export für eine Farbtemperatur schreibt', () => {
  // an den Lichtzeilen der Large-Halle abgelesen (useTemp=true)
  for (const [k, farbe] of [[1000, [1, 0.26635462, 0]], [2500, [1, 0.62378275, 0.27477717]], [3500, [1, 0.7550343, 0.55226105]], [4000, [1, 0.80712247, 0.6512995]], [15000, [0.71000713, 0.80438167, 1]]]) {
    assert.ok(nah6(kelvinFarbe(k), farbe), `${k} K: ${kelvinFarbe(k)} statt ${farbe}`);
  }
  assert.deepEqual(kelvinFarbe(6600), [1, 1, 1]);
  assert.throws(() => kelvinFarbe(0), /keine positive Zahl/);
  assert.throws(() => kelvinFarbe(NaN), /keine positive Zahl/);
});

test('anhangLampen: die Lampen der Gruppe am Knochen, benannt nach ihrer Stelle; ohne Stärke im Ruhezustand bleibt eine Lampe aus', () => {
  const r = anhangLampen(containerXml({ lampen: FUENF }), WAS);
  assert.equal(r.traeger, 'plattform_a');
  assert.deepEqual(r.aus, ['lg_anhang-002', 'lg_anhang-003'], 'ohne Stärke und abgeschaltet; die Stelle im Namen bleibt die der Gruppe');
  assert.deepEqual(r.lampen.map((l) => [l.name, l.eigen, l.typ, l.temp, l.staerke, l.radius, l.fov]), [
    ['lg_anhang-000', 'l_probe-001', 'SoftOmni', false, 0.050000001, 5, null],
    ['lg_anhang-001', 'l_probe_key-001', 'Projector', true, 30, 20, 110],
    ['lg_anhang-004', 'l_probe_ceil-001', 'Planar', false, 2.4000001, 10, null],
  ]);
  // Farbe: genannt, oder aus der Farbtemperatur; der Zustand auxiliary (rot, Stärke 2) zählt nie
  assert.deepEqual(r.lampen[0].farbe, [0.25, 0.5, 0.75]);
  assert.ok(nah6(r.lampen[1].farbe, [1, 0.7550343, 0.55226105]));
  // Ort und Drehung stehen, wie RelativeXForm sie nennt: ohne den Ort der Gruppe (-0.01, -11, 0.5)
  assert.deepEqual(r.lampen[0].ort, [1, 2, 3.1]);
  assert.deepEqual(r.lampen[1].ort, [4, 5, 6]);
  assert.ok(nah6(r.lampen[1].dreh, [W, 0, 0, W]));
});

test('anhangLampen: was nicht nachgemessen ist, bricht ab', () => {
  const lies = (o, was = WAS) => () => anhangLampen(containerXml(o), was);
  assert.throws(lies({}, { gruppe: 'lg_anders', knochen: 'anim_lift' }), /Lichtgruppe lg_anders: 0 Entities dieses Namens/);
  assert.throws(lies({ mehr: `<Entity ${GRUPPE}><Lights>${lampeXml()}</Lights></Entity>` }), /2 Entities dieses Namens/);
  assert.throws(lies({}, { gruppe: 'lg_anhang', knochen: 'anim_pad' }), /erwartet ist eine LightGroupObjectAttach am Knochen anim_pad \(CharacterBone\), gefunden LightGroupObjectAttach \/ CharacterBone \/ anim_lift/);
  // eine gewöhnliche Lichtgruppe schreibt der Export selbst
  assert.throws(lies({ gruppe: 'Name="lg_anhang" Pos="1,2,3" EntityClass="LightGroup" EntityCryGUID="g1"' }), /gefunden LightGroup \/ ohne Angabe \/ ohne Angabe/);
  assert.throws(lies({ gruppe: GRUPPE.replace('ParentEntityCryGUID="p1"', 'ParentEntityCryGUID="p9"') }), /der Träger \(ParentEntityCryGUID\) steht 0 Mal im Container/);
  // ein Träger, der selbst an einem Bauteil hängt: dann gälte RelativeXForm in einem Raum, den niemand nachgemessen hat
  assert.throws(lies({ traeger: `${TRAEGER} Pos="0,0,2" ParentEntityCryGUID="s1"` }), /der Träger Plattform hängt selbst an einem Bauteil \(ParentEntityCryGUID\)/);
  assert.throws(lies({ traeger: `${TRAEGER} Pos="0,0"` }), /Plattform Pos: "0,0" ist keine Reihe aus 3 Zahlen/);
  // ein skalierter Knochen (Gruppe doppelt so groß wie ihr Versatz) ist nicht nachgemessen; Lagen, die keine sind, ebenso
  assert.throws(lies({ gruppe: GRUPPE.replace(' Pos="-0.01,-11,0.5"', ' Pos="-0.01,-11,0.5" Scale="2,2,2"') }), /Scale 2,2,2 gegen ParentOffsetScale 1,1,1 ergibt einen skalierten Knochen/);
  assert.throws(lies({ gruppe: GRUPPE.replace('ParentOffsetRot="1,0,0,0"', 'ParentOffsetRot="0.5,0,0,0.5"') }), /lg_anhang ParentOffsetRot 0\.5,0,0,0\.5 ist keine Drehung/);
  assert.throws(lies({ gruppe: GRUPPE.replace(' Pos="-0.01,-11,0.5"', ' Pos="-0.01,-11"') }), /lg_anhang Pos: "-0.01,-11" ist keine Reihe aus 3 Zahlen/);
  // ein Träger, der seinen Ort ausdrücklich im Ursprung nennt, gilt wie einer ohne Angabe
  const imUrsprung = anhangLampen(containerXml({ traeger: `${TRAEGER} Pos="0,0,0" Rotate="1,0,0,0"` }), WAS);
  assert.deepEqual([imUrsprung.lampen.length, imUrsprung.traegerOrt, imUrsprung.lampen[0].ort], [1, [0, 0, 0], [1, 2, 3.1]]);
  assert.deepEqual(anhangLampen(containerXml(), WAS).traegerOrt, [0, 0, 0]);
  // der Knochen der Probe: Gruppe (-0.01, -11, 0.5) weniger ihr Versatz (-0.01, -11, 0.5), ungedreht
  assert.deepEqual([imUrsprung.knochenOrt, imUrsprung.knochenDreh], [[0, 0, 0], [1, 0, 0, 0]]);
  // Angaben einer Lampe, aus denen keine Lampe wird
  assert.throws(lies({ lampen: [lampeXml({ rot: '0.5,0,0,0.5' })] }), /lg_anhang-000 \(l_probe-001\): rotation 0.5,0,0,0.5 ist keine Drehung/);
  assert.throws(lies({ lampen: [lampeXml({ ort: '1,2' })] }), /translation: "1,2" ist keine Reihe aus 3 Zahlen/);
  assert.throws(lies({ lampen: [lampeXml({ typ: 'Projector', fov: 0 })] }), /FOV 0 ergeben keine Lampe/);
  assert.throws(lies({ lampen: [lampeXml({ radius: 0 })] }), /Reichweite 0 ergeben keine Lampe/);
  assert.throws(lies({ lampen: [lampeXml({ staerke: 'x' })] }), /intensity="x" ist keine Zahl/);
  assert.throws(lies({ lampen: [lampeXml().replace(/<RelativeXForm[^>]*\/>/, '')] }), /ohne EntityComponentLight, defaultState mit Farbe oder RelativeXForm/);
  // eine Gruppe, in der im Ruhezustand nichts brennt, ist kein Anlass
  assert.throws(lies({ lampen: [lampeXml({ staerke: 0 }), lampeXml({ aktiv: 0 })] }), /keine Lampe mit Stärke im defaultState \(2 ohne\)/);
});

test('anhangLampen: steht der Träger nicht im Ursprung, kommt sein Ort zu jeder Lampe dazu', () => {
  // so nennt die .soc der Large-Halle die Schiffsplattform: Träger bei -72/-112/2,5, die Gruppe einen halben Meter darüber
  const gruppe = GRUPPE.replace('ParentOffsetPos="-0.01,-11,0.5"', 'ParentOffsetPos="0,0,0.5"').replace('Pos="-0.01,-11,0.5"', 'Pos="-72,-112,3"');
  const r = anhangLampen(containerXml({ lampen: FUENF, gruppe, traeger: `${TRAEGER} Pos="-72,-112,2.5"` }), WAS);
  assert.deepEqual(r.traegerOrt, [-72, -112, 2.5]);
  // der Knochen: die Gruppe (-72, -112, 3) weniger ihr Versatz (0, 0, 0.5), also der Ort des Trägers
  assert.deepEqual([r.knochenOrt, r.knochenDreh], [[-72, -112, 2.5], [1, 0, 0, 0]]);
  // die Angabe (1, 2, 3.1) plus der Ort des Knochens
  assert.ok(nah6(r.lampen[0].ort, [-71, -110, 5.6]), String(r.lampen[0].ort));
  assert.ok(nah6(r.lampen[1].ort, [-68, -107, 8.5]), String(r.lampen[1].ort));
  // Drehung, Stärke und Namen bleiben, wie sie ohne den Ort wären
  const ohne = anhangLampen(containerXml({ lampen: FUENF }), WAS);
  assert.deepEqual(r.lampen.map(({ ort: o, ...l }) => l), ohne.lampen.map(({ ort: o, ...l }) => l));
  assert.deepEqual(r.aus, ohne.aus);
});

test('anhangLampen: der Knochen folgt aus der Gruppe und ihrem Versatz, auch wo er nicht am Ort des Trägers ruht', () => {
  // so nennt die .soc der Medium-Halle die Schiffsplattform: Träger bei 56/67/6,5, Knochen einen halben Meter darunter
  const medium = GRUPPE.replace('ParentOffsetPos="-0.01,-11,0.5"', 'ParentOffsetPos="0,0.014277996595865261,6.2234089675527571"').replace('Pos="-0.01,-11,0.5"', 'Pos="56,67.014277989787388,12.223398668628704" Scale="1.0000005,1.0000005,1.0000005"').replace('EntityCryGUID="g1"', 'EntityCryGUID="g1" ParentOffsetScale="1.0000004768371582"');
  const m = anhangLampen(containerXml({ lampen: FUENF, gruppe: medium, traeger: `${TRAEGER} Pos="56,67,6.5"` }), WAS);
  assert.deepEqual([m.traegerOrt, m.knochenOrt, m.knochenDreh], [[56, 67, 6.5], [56, 67, 6], [1, 0, 0, 0]]);
  assert.ok(nah6(m.lampen[0].ort, [57, 69, 9.1]), String(m.lampen[0].ort));
  // so die Kabine des Frachtaufzugs der Small-Halle: das Bauteil im Ursprung, sein Knochen 4,5 m davor
  const kabine = GRUPPE.replace('ParentOffsetPos="-0.01,-11,0.5"', 'ParentOffsetPos="0.19219599999999559,-0.48171699999997486,0.057314999999999117"').replace('ParentOffsetRot="1,0,0,0"', 'ParentOffsetRot="1,0,0,-3.2584137e-07"').replace('Pos="-0.01,-11,0.5"', 'Pos="0.19223537642574229,-4.9816582237786236,0.057224820558968048"');
  const k = anhangLampen(containerXml({ lampen: FUENF, gruppe: kabine }), WAS);
  assert.deepEqual([k.knochenOrt, k.knochenDreh], [[0, -4.4999, -0.0001], [1, 0, 0, 0]], 'die winzige Drehung des Versatzes (3e-7) zählt nicht');
  assert.ok(nah6(k.lampen[0].ort, [1, -2.4999, 3.0999]), String(k.lampen[0].ort));
  // Drehung, Stärke und Namen bleiben, wo der Knochen ungedreht ist
  const ohne = anhangLampen(containerXml({ lampen: FUENF }), WAS);
  assert.deepEqual(k.lampen.map(({ ort: o, ...l }) => l), ohne.lampen.map(({ ort: o, ...l }) => l));
});

test('anhangLampen: an einem gedrehten Träger drehen Ort und Achse jeder Lampe mit', () => {
  // so nennt die .soc der Small-Halle die Schiffsplattform: Träger bei -48/-42/6,5, um 90° um Z gedreht; die Gruppe
  // halb gedreht und doppelt skaliert, ihr Versatz um 90° gedreht und ebenso doppelt: der Knochen ist der Träger
  const small = GRUPPE.replace('ParentOffsetPos="-0.01,-11,0.5"', 'ParentOffsetPos="-1.0000001111620804e-06,0.0077329993854391432,8.3565593282391433"').replace('ParentOffsetRot="1,0,0,0"', 'ParentOffsetRot="0.70710695,0,0,0.70710707" ParentOffsetScale="2.0000011920928955"').replace('Pos="-0.01,-11,0.5"', 'Pos="-48.007732998156598,-42.000000998156111,14.856558000000007" Rotate="0,0,0,1" Scale="2.0000012,2.0000012,2.0000012"');
  const r = anhangLampen(containerXml({ lampen: FUENF, gruppe: small, traeger: `${TRAEGER} Pos="-48,-42,6.5" Rotate="0.70710677,0,0,0.70710677"` }), WAS);
  assert.deepEqual(r.knochenOrt, [-48, -42, 6.5]);
  assert.ok(nah6(r.knochenDreh, [W, 0, 0, W]), String(r.knochenDreh));
  // (1, 2, 3.1) um 90° um Z: (-2, 1, 3.1), dazu der Knochen
  assert.ok(nah6(r.lampen[0].ort, [-50, -41, 9.6]), String(r.lampen[0].ort));
  assert.ok(nah6(r.lampen[1].ort, [-53, -38, 12.5]), String(r.lampen[1].ort));
  // der Strahler war um 90° um Z gedreht, mit dem Knochen sind es 180°
  assert.ok(nah6(r.lampen[1].dreh, [0, 0, 0, 1]), String(r.lampen[1].dreh));
  // gleich gedreht, ob die Drehung als q oder -q dasteht
  const minus = anhangLampen(containerXml({ lampen: FUENF, gruppe: small.replace('Rotate="0,0,0,1"', 'Rotate="0,0,0,-1"'), traeger: TRAEGER }), WAS);
  assert.ok(nah6(minus.knochenDreh, r.knochenDreh), String(minus.knochenDreh));
  assert.ok(minus.lampen.every((l, i) => nah6(l.ort, r.lampen[i].ort)));
});

test('halleAnhang: die Lichtgruppe an einem Knochen der Halle selbst, Probe an ihren eigenen Leuchten, Einträge mit kind bleiben', () => {
  const { lampen } = anhangLampen(containerXml({ lampen: FUENF }), WAS);
  const room = ausfuhr('halle');
  const anhang = [
    { kind: 'kabine', gruppe: 'lg_kabine', knochen: 'anim_lift', anLeuchte: 1, lampen, exemplare: 0 },
    { gruppe: 'lg_anhang', knochen: 'pad_large', anLeuchte: 1, lampen, exemplare: 0 },
  ];
  const zeilen = halleAnhang(room, anhang);
  assert.deepEqual(zeilen, lampen.map(lampenZeile));
  assert.deepEqual([anhang[1].exemplare, anhang[1].anNetz], [1, 1], 'die Wandleuchte sitzt an ihrem Netzknoten');
  assert.deepEqual([anhang[0].exemplare, anhang[0].anNetz], [0, undefined], 'der Eintrag der Kabine wartet auf sein Kind');
  const knoten = room.getRoot().listNodes();
  assert.equal(knoten.find((n) => n.getName() === 'anhang_lg_anhang').getParentNode().getName(), 'CryEngine_Z_up');
  assert.equal(knoten.find((n) => n.getName() === 'anhang_lg_kabine'), undefined);
  assert.deepEqual(ort(knoten.find((n) => n.getName() === 'lg_anhang-001')), [4, 6, -5]);
  // ohne Eintrag für die Halle geschieht nichts
  const leer = ausfuhr('halle'), vorher = leer.getRoot().listNodes().length;
  assert.deepEqual(halleAnhang(leer, [anhang[0]]), []);
  assert.equal(leer.getRoot().listNodes().length, vorher);
  // sitzen die Lampen nicht an den Leuchten der Halle, bricht der Schritt ab und nennt die Halle
  const daneben = lampen.map((l) => ({ ...l, ort: [l.ort[0], l.ort[1], l.ort[2] + 0.5] }));
  const kaputt = ausfuhr('halle');
  assert.throws(() => halleAnhang(kaputt, [{ gruppe: 'lg_anhang', knochen: 'pad_large', anLeuchte: 1, lampen: daneben, exemplare: 0 }]), /anhang Halle: Halle: nur 0 von 3 Lampen der Gruppe lg_anhang sitzen an einem Netzknoten/);
  assert.equal(kaputt.getRoot().listNodes().filter((n) => n.getExtension('KHR_lights_punctual')).length, 1, 'nach dem Abbruch hängt keine Lampe im Modell');
});

test('lampenEinhaengen: Lichtknoten im Raum des Containers, so wie der Export sie bei einer gewöhnlichen Gruppe schreibt', async () => {
  const doc = ausfuhr('kabine');
  const { lampen } = anhangLampen(containerXml({ lampen: FUENF }), WAS);
  const r = lampenEinhaengen(doc, lampen, { name: 'kabine', gruppe: 'lg_anhang', anLeuchte: 1 });
  assert.deepEqual([r.lampen, r.anNetz], [3, 1], 'die Wandleuchte sitzt 0,1 m über dem Knoten ihres Netzes (1, 2, 3)');
  const knoten = (n) => doc.getRoot().listNodes().find((x) => x.getName() === n);
  // unter der Wurzel, neben dem Container-Knoten; glTF = (x, z, -y)
  assert.equal(knoten('anhang_lg_anhang').getParentNode().getName(), 'CryEngine_Z_up');
  assert.deepEqual(ort(knoten('lg_anhang-000')), [1, 3.1, -2]);
  assert.deepEqual(ort(knoten('lg_anhang-001')), [4, 6, -5]);
  // der Strahler strahlt längs seiner +X-Achse (so liest der Build die Richtung): um 90° um Z gedreht zeigt sie nach +y des Spiels, im Modell nach -z
  assert.ok(nah6(knoten('lg_anhang-001').getWorldMatrix().slice(0, 3), [0, 0, -1]));
  const licht = (n) => knoten(n).getExtension('KHR_lights_punctual');
  assert.deepEqual([licht('lg_anhang-000').getType(), licht('lg_anhang-001').getType(), licht('lg_anhang-004').getType()], ['point', 'spot', 'point']);
  // Stärke mal 1500, Reichweite, Kegel = halbes FOV, innen 0,8 davon
  assert.ok(Math.abs(licht('lg_anhang-001').getIntensity() - 45000) < 1e-6);
  assert.equal(licht('lg_anhang-001').getRange(), 20);
  assert.ok(nah6([licht('lg_anhang-001').getOuterConeAngle(), licht('lg_anhang-001').getInnerConeAngle()], [55 * Math.PI / 180, 44 * Math.PI / 180]));
  assert.deepEqual(licht('lg_anhang-000').getColor(), [0.25, 0.5, 0.75]);
  // die Zeilen liest der Build mit derselben Regel wie die des Exports (lichtZeile): Name, Typ, Stärke und Reichweite des Spiels
  assert.deepEqual(r.zeilen.map(lichtZeile), [
    { name: 'lg_anhang-000', type: 'SoftOmni', intensity: 0.050000001, radius: 5 },
    { name: 'lg_anhang-001', type: 'Projector', intensity: 30, radius: 20 },
    { name: 'lg_anhang-004', type: 'Planar', intensity: 2.4000001, radius: 10 },
  ]);
  assert.equal(r.zeilen[1], "Light 'lg_anhang-001' type=Projector useTemp=true temperature=3500 intensity=30 radius=20 color=[1, 0.75503434, 0.55226111]");
  assert.deepEqual(lichtZeile("Light 'lg_hangar_lrgtop-000' type=Projector useTemp=true temperature=3500 intensity=5 radius=12 color=[1.0, 0.7550343, 0.55226105]"), { name: 'lg_hangar_lrgtop-000', type: 'Projector', intensity: 5, radius: 12 }, 'eine Zeile des Exports selbst');
  assert.equal(lichtZeile('Exported 12 meshes'), null);
  // die Datei bleibt lesbar: das Licht des Containers und die drei angehängten
  await doc.transform(unpartition());
  const io = new NodeIO().registerExtensions([KHRLightsPunctual]);
  const wieder = await io.readBinary(await io.writeBinary(doc));
  assert.equal(wieder.getRoot().listNodes().filter((n) => n.getExtension('KHR_lights_punctual')).length, 4);
});

test('lampenEinhaengen: sitzen zu wenige Lampen an einer Leuchte, gilt der Raum nicht, und der Schritt bricht ab', () => {
  const { lampen } = anhangLampen(containerXml({ lampen: FUENF }), WAS);
  // der Fall, an dem die Regel gemessen ist: den Ort der Gruppe dazugerechnet, läge jede Lampe 11 m neben ihrer Leuchte
  const versetzt = lampen.map((l) => ({ ...l, ort: [l.ort[0] - 0.01, l.ort[1] - 11, l.ort[2] + 0.5] }));
  const doc = ausfuhr('kabine');
  assert.throws(() => lampenEinhaengen(doc, versetzt, { name: 'kabine', gruppe: 'lg_anhang', anLeuchte: 1 }), /kabine: nur 0 von 3 Lampen der Gruppe lg_anhang sitzen an einem Netzknoten \(bis 0.3 m\), erwartet sind wenigstens 1/);
  assert.equal(doc.getRoot().listNodes().filter((n) => n.getExtension('KHR_lights_punctual')).length, 1, 'nach dem Abbruch hängt keine Lampe im Modell');
  // ohne Untergrenze hängt der Schritt ein, was man ihm gibt, und nennt die Zahl
  assert.equal(lampenEinhaengen(ausfuhr('kabine'), versetzt, { name: 'kabine', gruppe: 'lg_anhang' }).anNetz, 0);
  // ein Netz tiefer im Baum zählt mit seinem Ort im Raum des Containers: die Leuchte des Schranks hängt in einer Gruppe bei (0, 4, 0)
  const tief = lampenEinhaengen(schrank(), [{ ...lampen[0], ort: [0, 4.2, 0] }], { name: 'schrank', gruppe: 'lg_anhang', anLeuchte: 1 });
  assert.equal(tief.anNetz, 1);
});

test('kinderBaumEinhaengen mit anhang: die Kabine bringt ihre Lampen in jedes Exemplar mit, Zeilen und Knoten gleich oft', async () => {
  // Halle -> Modul an zwei Stellen -> darin die Kabine, um 180° gedreht (wie der Frachtaufzug der Large-Halle)
  const baum = [{ id: 'modul', name: 'a/modul.socpak', stellen: [{ pos: [-120, -56, -4], rot: [W, 0, 0, W] }, { pos: [-24, -164, -4], rot: [W, 0, 0, -W] }],
    kinder: [{ id: 'kabine', name: 'a/kabine.socpak', stellen: [{ pos: [0, 10, 0], rot: [0, 0, 0, 1] }], kinder: [] }] }];
  const { lampen } = anhangLampen(containerXml({ lampen: FUENF }), WAS);
  const anhang = [{ kind: 'kabine', gruppe: 'lg_anhang', knochen: 'anim_lift', anLeuchte: 1, lampen, exemplare: 0 }];
  const liste = [], meldungen = [], room = ausfuhr('halle');
  const lichter = await kinderBaumEinhaengen(room, baum, { lese: (c) => ausfuhr(c.id), zeilen: (c) => [`Light 'lg_${c.id}-000' type=Omni intensity=1 radius=2`], anhang, liste, melde: (m) => meldungen.push(m) });
  assert.equal(anhang[0].exemplare, 2, 'eine Kabine je Exemplar des Moduls');
  // je Exemplar des Moduls: seine Zeile, die der Kabine, dann die drei angehängten
  const jeModul = ["Light 'lg_modul-000' type=Omni intensity=1 radius=2", "Light 'lg_kabine-000' type=Omni intensity=1 radius=2", ...lampen.map(lampenZeile)];
  assert.deepEqual(lichter, [...jeModul, ...jeModul]);
  // jede Zeile findet ihren Knoten: je Name gleich viele Lichtknoten wie Zeilen (so verbindet der Build)
  const zaehl = (namen) => namen.reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map());
  const knoten = zaehl(room.getRoot().listNodes().filter((n) => n.getExtension('KHR_lights_punctual') && n.getName() !== 'lg_halle-000').map((n) => n.getName()));
  assert.deepEqual([...knoten].sort(), [...zaehl(lichter.map((z) => lichtZeile(z).name))].sort());
  assert.equal(knoten.get('lg_anhang-001'), 2);
  // der Strahler (4, 5, 6) der Kabine: um 180° um Z und 10 nach y in das Modul: (-4, 5, 6);
  // Modul 1 um +90°: (-5, -4, 6), dazu (-120, -56, -4) = (-125, -60, 2); glTF = (x, z, -y)
  assert.deepEqual(ort(unter(room, 'kind_modul_1', 'lg_anhang-001')[0]), [-125, 2, 60]);
  // Modul 2 um -90°: (5, 4, 6), dazu (-24, -164, -4) = (-19, -160, 2)
  assert.deepEqual(ort(unter(room, 'kind_modul_2', 'lg_anhang-001')[0]), [-19, 2, 160]);
  const e = liste.find((x) => x.id === 'kabine');
  assert.deepEqual([e.exemplare, e.jeExemplar.lichtknoten, e.jeExemplar.lichtzeilen], [2, 4, 4]);
  assert.deepEqual(e.anhang, [{ gruppe: 'lg_anhang', lampen: 3, anNetz: 1 }]);
  assert.equal(liste.find((x) => x.id === 'modul').anhang, undefined);
  assert.match(meldungen.find((m) => m.includes('Kind kabine')), /; 3 Lampe\(n\) der Lichtgruppe lg_anhang angehängt, 1 davon an einer Leuchte$/);
  // ohne die Regel bleibt die Kabine dunkel, wie bisher
  const ohne = await kinderBaumEinhaengen(ausfuhr('halle'), baum, { lese: (c) => ausfuhr(c.id), zeilen: (c) => [`Light 'lg_${c.id}-000' type=Omni intensity=1 radius=2`] });
  assert.equal(ohne.length, 4);
});

test('kinderBaumEinhaengen mit anhang: nur und anhang am selben Kind widersprechen sich', async () => {
  const baum = [{ id: 'schrank', name: 'a/schrank.socpak', stellen: [{ pos: [0, 0, 0], rot: [1, 0, 0, 0] }], kinder: [] }];
  const { lampen } = anhangLampen(containerXml(), WAS);
  await assert.rejects(kinderBaumEinhaengen(ausfuhr('halle'), baum, { lese: () => schrank(), nur: [{ kind: 'schrank', muster: [TUER], exemplare: 0 }], anhang: [{ kind: 'schrank', gruppe: 'lg_anhang', lampen, anLeuchte: 0, exemplare: 0 }] }),
    /schrank: nur und anhang am selben Kind widersprechen sich/);
});

test('kinderKonfig: eine Regel für angehängte Lampen macht das Eingehängte ungültig', () => {
  const regeln = { folge: [/[\\/]modul\.socpak$/i] };
  const baum = [{ id: 'modul', stellen: [{ pos: [0, 10, 0], rot: [1, 0, 0, 0] }], kinder: [] }];
  const k = kinderKonfig(regeln, baum);
  const mit = kinderKonfig({ ...regeln, anhang: [{ kind: 'kabine', gruppe: 'lg_anhang', knochen: 'anim_lift', anLeuchte: 12 }] }, baum);
  assert.notEqual(mit, k, 'die Kabine bekommt ihre Lampen');
  assert.notEqual(kinderKonfig({ ...regeln, anhang: [{ kind: 'kabine', gruppe: 'lg_anhang', knochen: 'anim_lift', anLeuchte: 20 }] }, baum), mit, 'andere Untergrenze');
  assert.equal(kinderKonfig({ ...regeln, anhang: [] }, baum), k, 'eine leere Liste ist keine Regel');
});
