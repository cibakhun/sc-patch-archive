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
import { kinderAusXml, kindEinhaengen, kindLage, kindNur, kinderBaumEinhaengen, kinderBestand, kinderKonfig, planKennung, wurzelVon, nmcKnoten, spurVersatz, eingehaengtGilt, eingehaengtSchreiben } from '../../scripts/lib/hall-kinder.mjs';

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
