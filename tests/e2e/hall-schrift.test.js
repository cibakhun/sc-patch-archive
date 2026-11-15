// Schrift der Industrie-Hallen (scripts/lib/hall-decals.mjs): Buchstaben und
// Ziffern sind einzelne Vierecke aus einem Alphabet-Atlas. Zwei Dinge gingen
// dort verloren, und beide sah man erst im Bild (14.11.2026): Schrift, die das
// Rastern der Halle unter ihre Tafel schob, und Schilder, deren leichtere
// Stufe im Spiel nur noch einen Teil der Buchstaben trägt. Die gebauten Hallen
// liegen nicht in jedem Baum, deshalb prüft dieser Test die beiden Schritte
// des Builds an kleinen Dokumenten: swapHallText (Geometrie der vollen Stufe
// einsetzen) und liftHallText (von der Tafel abrücken).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@gltf-transform/core';
import { SCHRIFT, swapHallText, liftHallText, hallTextDoc } from '../../scripts/lib/hall-decals.mjs';

const TEXT = 'lorville_brand_a_mtl_alphabet_a_primary_05', WAND = 'util_a_default_mtl_panel_02';

// n Vierecke nebeneinander in der Ebene z = 0, Normale +z
function vierecke(doc, buffer, n, material, extras = {}) {
  const pos = new Float32Array(n * 12), nor = new Float32Array(n * 12), uv = new Float32Array(n * 8), idx = new Uint16Array(n * 6);
  for (let q = 0; q < n; q++) {
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([x, y], k) => {
      pos.set([q * 2 + x, y, 0], q * 12 + k * 3); nor.set([0, 0, 1], q * 12 + k * 3); uv.set([x, y], q * 8 + k * 2);
    });
    idx.set([0, 1, 2, 2, 3, 0].map((v) => v + q * 4), q * 6);
  }
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  return doc.createPrimitive().setMaterial(material).setExtras(extras)
    .setAttribute('POSITION', acc('VEC3', pos)).setAttribute('NORMAL', acc('VEC3', nor)).setAttribute('TEXCOORD_0', acc('VEC2', uv))
    .setIndices(acc('SCALAR', idx));
}
const tris = (p) => p.getIndices().getCount() / 3;

// Halle: ein Schild mit ausgedünnter Schrift (1 Viereck), seiner Tafel und einem schon angehängten Aufkleber
function halle({ doppelt = false } = {}) {
  const doc = new Document(), buffer = doc.createBuffer();
  const text = doc.createMaterial(TEXT).setAlphaMode('MASK'), wand = doc.createMaterial(WAND), kleber = doc.createMaterial('decal_mtl_stripe_03').setAlphaMode('BLEND');
  const scene = doc.createScene();
  const netz = () => {
    const m = doc.createMesh('primary_sign_test_a')
      .addPrimitive(vierecke(doc, buffer, 1, text)).addPrimitive(vierecke(doc, buffer, 1, wand)).addPrimitive(vierecke(doc, buffer, 3, kleber, { hall_decal: true }));
    scene.addChild(doc.createNode('schild').setMesh(m));
    return m;
  };
  const erstes = netz(), zweites = doppelt ? netz() : null;
  return { doc, erstes, zweites, text, wand };
}
// Ersatz aus dem Extraktor: dasselbe Schild mit n Vierecken Schrift
function ersatz({ n = 4, nr = 0, signatur = [2, 2], material = TEXT, prim = 0 } = {}) {
  const doc = new Document(), buffer = doc.createBuffer();
  const m = doc.createMesh('primary_sign_test_a').setExtras({ nr, tris: signatur, exemplare: 1 })
    .addPrimitive(vierecke(doc, buffer, n, doc.createMaterial(material), { schrift: { prim, mat: 5, node: 0, trisAlt: 2, trisNeu: n * 2 } }));
  doc.createScene().addChild(doc.createNode('schild').setMesh(m));
  return doc;
}

test('SCHRIFT trifft Alphabet- und Ziffernmaterial, sonst nichts', () => {
  for (const name of [TEXT, 'freight_brand_a_mtl_Alphabet_a_Prim_Upper_nodecal_06', 'lorville_brand_a_mtl_number_screen_a_08', 'arccorp_brand_b_hospital_mtl_alphabet_a_tertiary_017']) assert.match(name, SCHRIFT);
  for (const name of [WAND, 'lowtech_alpha_ext_a_mtl_glow_013', 'sign_billboard_1_mtl_glow_main_05', 'alphabet_a_primary']) assert.doesNotMatch(name, SCHRIFT);
});

test('swapHallText: die Schrift bekommt die Geometrie der vollen Stufe, Material und Nachbarn bleiben', () => {
  const { doc, erstes, text, wand } = halle();
  const s = swapHallText(doc, ersatz({ n: 4 }));
  assert.deepEqual(s, { netze: 1, teilnetze: 1, trisAlt: 2, trisNeu: 8, fremd: [] });
  const [p0, p1, p2] = erstes.listPrimitives();
  assert.equal(tris(p0), 8, 'vier Buchstaben statt einem');
  assert.equal(p0.getAttribute('POSITION').getCount(), 16);
  assert.equal(p0.getAttribute('NORMAL').getCount(), 16);
  assert.equal(p0.getAttribute('TEXCOORD_0').getCount(), 16);
  assert.equal(p0.getMaterial(), text, 'das Material des Exports bleibt');
  assert.deepEqual(p0.getAttribute('POSITION').getElement(15, []), [6, 1, 0], 'letzte Ecke des vierten Buchstabens');
  assert.equal(tris(p1), 2); assert.equal(p1.getMaterial(), wand);
  assert.equal(tris(p2), 6, 'der Aufkleber bleibt, wie er ist');
});

test('swapHallText: ein schon angehängter Aufkleber zählt nicht zur Signatur des Netzes', () => {
  // Signatur des Extraktors: nur die Primitive des Exports (Schrift 2, Tafel 2 Dreiecke)
  const { doc } = halle();
  assert.equal(swapHallText(doc, ersatz({ signatur: [2, 2] })).teilnetze, 1);
  const anders = halle();
  assert.deepEqual(swapHallText(anders.doc, ersatz({ signatur: [2, 2, 6] })).fremd, ['primary_sign_test_a'], 'mit dem Aufkleber in der Signatur ist es ein fremdes Netz');
});

test('swapHallText: fremdes Netz oder fremdes Material wird gemeldet und nicht angefasst', () => {
  const a = halle();
  const sa = swapHallText(a.doc, ersatz({ signatur: [4, 2] }));
  assert.deepEqual(sa, { netze: 0, teilnetze: 0, trisAlt: 0, trisNeu: 0, fremd: ['primary_sign_test_a'] });
  assert.equal(tris(a.erstes.listPrimitives()[0]), 2);

  const b = halle();
  const sb = swapHallText(b.doc, ersatz({ material: 'lorville_brand_a_mtl_number_a_primary_09' }));
  assert.deepEqual(sb.fremd, ['primary_sign_test_a #0']);
  assert.equal(sb.teilnetze, 0); assert.equal(sb.netze, 0);
  assert.equal(tris(b.erstes.listPrimitives()[0]), 2);

  const c = halle();
  assert.deepEqual(swapHallText(c.doc, ersatz({ prim: 1 })).fremd, ['primary_sign_test_a #1'], 'der Platz im Netz muss zum Material passen');
  assert.equal(tris(c.erstes.listPrimitives()[1]), 2);
});

test('swapHallText: bei gleichnamigen Netzen entscheidet die Nummer', () => {
  const { doc, erstes, zweites } = halle({ doppelt: true });
  swapHallText(doc, ersatz({ n: 3, nr: 1 }));
  assert.equal(tris(erstes.listPrimitives()[0]), 2);
  assert.equal(tris(zweites.listPrimitives()[0]), 6);
});

test('liftHallText: Schrift rückt 5 mm längs ihrer Normale ab, Tafel und Aufkleber bleiben', () => {
  const { doc, erstes } = halle();
  // ein Aufkleber mit Schriftmaterial (hat seinen Abstand schon aus addHallDecals) und Schrift ohne Alpha-Schnitt
  const buffer = doc.getRoot().listBuffers()[0];
  const kleberSchrift = vierecke(doc, buffer, 1, erstes.listPrimitives()[0].getMaterial(), { hall_decal: true });
  const deckend = vierecke(doc, buffer, 1, doc.createMaterial('lorville_brand_a_mtl_alphabet_a_secondary_06'));
  erstes.addPrimitive(kleberSchrift).addPrimitive(deckend);
  const s = liftHallText(doc);
  assert.deepEqual(s, { primitive: 1, ecken: 4, mm: 5 });
  const z = (p) => p.getAttribute('POSITION').getElement(0, [])[2];
  const [text, wand, kleber] = erstes.listPrimitives();
  assert.ok(Math.abs(z(text) - 0.005) < 1e-6, `Schrift liegt ${z(text)} m über ihrer Tafel`);
  assert.equal(z(wand), 0); assert.equal(z(kleber), 0); assert.equal(z(kleberSchrift), 0);
  assert.equal(z(deckend), 0, 'nur Material, das nach Alpha schneidet (MASK)');
  // nach dem Einsetzen der vollen Stufe rückt die neue Geometrie ab, nicht die alte
  const voll = halle();
  swapHallText(voll.doc, ersatz({ n: 4 }));
  assert.deepEqual(liftHallText(voll.doc), { primitive: 1, ecken: 16, mm: 5 });
});

test('hallTextDoc: ohne leichtere Stufe oder ohne Spieldateien gibt es nichts zu holen', () => {
  const { doc } = halle();
  const leer = { netze: 0, teilnetze: 0, trisAlt: 0, trisNeu: 0, trisNeuMitExemplaren: 0, ohneLage: [], ausBaum: [], liste: [] };
  assert.deepEqual(hallTextDoc({ doc, files: new Map(), read: () => { throw new Error('nicht lesen'); }, lod: 0, Document }), { doc: null, report: leer });
  assert.deepEqual(hallTextDoc({ doc, files: new Map(), read: () => { throw new Error('nicht lesen'); }, lod: 1, Document }), { doc: null, report: leer });
  // eine Datei, die sich nicht lesen lässt, ist kein Treffer und kein Abbruch
  const files = new Map([['primary_sign_test_a_lod1.cgfm', ['raw/primary_sign_test_a_lod1.cgfm']], ['primary_sign_test_a.cgfm', ['raw/primary_sign_test_a.cgfm']]]);
  assert.deepEqual(hallTextDoc({ doc, files, read: () => Buffer.from('kein Netz'), lod: 1, Document }), { doc: null, report: leer });
});

// ─── Schild an einem gedrehten Knoten (15.11.2026) ──────────────────────────
// Zwei Kästen messen eine Verschiebung, keine Drehung: Hängt das Schild in seiner .cga an einem um 180°
// gedrehten Knoten, trüge die gemessene Verschiebung die Buchstaben der Grundstufe nur hin, gespiegelt
// um die Mitte des ersten, und die Abstimmung über die Umlaufrichtung fiele falsch aus. Dort stellt der
// belegte Knotenbaum der Datei den Ersatz hin.
// Datei im Raum ihres Knotens: Buchstaben-Vierecke in der Ebene y = 0,5 (Normale -y), je 1 breit im Abstand 2,
// dahinter die Tafel. Leichtere Stufe: 1 Buchstabe, Grundstufe: 3.
function schildDateien(n) {
  const ecken = [], idx = [];
  const viereck = (x0, x1, y) => { const b = ecken.length; ecken.push([x0, y, 0], [x1, y, 0], [x1, y, 1], [x0, y, 1]); idx.push(b, b + 1, b + 2, b + 2, b + 3, b); };
  for (let q = 0; q < n; q++) viereck(q * 2, q * 2 + 1, 0.5);
  viereck(0, 6, 0.6);
  return {
    subs: [{ mat: 5, node: 0, firstIndex: 0, numIndices: n * 6 }, { mat: 2, node: 0, firstIndex: n * 6, numIndices: 6 }],
    pos: new Float32Array(ecken.flat()), idx: new Uint32Array(idx), uv: new Float32Array(ecken.length * 2),
    col: new Uint8Array(ecken.length * 4).fill(255), nor: new Float32Array(ecken.flatMap(() => [0, -1, 0])),
  };
}
// stell: wohin der Export eine Ecke der Datei stellt. baum: was „nmc dump“ für die .cga nennt.
function schild({ stell, baum, mitBaum = true, vollN = 3 }) {
  const lod = schildDateien(1), voll = schildDateien(vollN);
  const doc = new Document(), buffer = doc.createBuffer();
  const prim = (sub, material) => {
    const ix = [...lod.idx.subarray(sub.firstIndex, sub.firstIndex + sub.numIndices)], ecken = [...new Set(ix)];
    return doc.createPrimitive().setMaterial(doc.createMaterial(material))
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(ecken.flatMap((e) => stell([lod.pos[e * 3], lod.pos[e * 3 + 1], lod.pos[e * 3 + 2]])))).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(ix.map((e) => ecken.indexOf(e)))).setBuffer(buffer));
  };
  doc.createScene().addChild(doc.createNode('schild').setMesh(doc.createMesh('objects/schild/schild_a.cga').addPrimitive(prim(lod.subs[0], TEXT)).addPrimitive(prim(lod.subs[1], WAND))));
  const gefragt = [];
  const r = hallTextDoc({
    doc, Document, lod: 1,
    files: new Map([['schild_a_lod1.cgam', ['roh/schild_a_lod1.cgam']], ['schild_a.cgam', ['roh/schild_a.cgam']]]),
    read: (f) => f,
    leseNetz: (f) => (f.includes('_lod1') ? lod : voll),
    ...(mitBaum ? { knoten: (kopf) => { gefragt.push(kopf); return baum; } } : {}),
  });
  const p = r.doc?.getRoot().listMeshes()[0]?.listPrimitives()[0];
  if (!p) return { report: r.report, gefragt, x: null };
  const P = [...p.getAttribute('POSITION').getArray()].map((v) => +v.toFixed(4)), I = p.getIndices().getArray();
  const e = (i) => P.slice(I[i] * 3, I[i] * 3 + 3), a = e(0), b = e(1), c = e(2);
  const u = b.map((v, q) => v - a[q]), w = c.map((v, q) => v - a[q]);
  return {
    report: r.report, gefragt,
    x: P.filter((v, i) => i % 3 === 0).reduce((m, v) => [Math.min(m[0], v), Math.max(m[1], v)], [Infinity, -Infinity]),
    y: [...new Set(P.filter((v, i) => i % 3 === 1))],
    normale: [...p.getAttribute('NORMAL').getArray()].slice(0, 3).map((v) => +v.toFixed(4)),
    // wohin das erste Dreieck zeigt (Umlaufrichtung)
    vorn: Math.sign(u[2] * w[0] - u[0] * w[2]),
  };
}
const knotenS = (ort, dreh = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) => [{ index: 0, name: 'schild', parent: null, geom: 0, b2w: dreh.map((z, i) => [...z, ort[i]]) }];
const HALB_Z = [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];

test('hallTextDoc: an einem gedrehten Knoten stellt der Knotenbaum die Buchstaben der Grundstufe hin', () => {
  // der Knoten steht bei (4,0,0), halb um Z gedreht: (x, y, z) -> (4 - x, -y, z)
  const t = schild({ stell: (p) => [4 - p[0], -p[1], p[2]], baum: knotenS([4, 0, 0], HALB_Z) });
  assert.deepEqual(t.report.ohneLage, []);
  assert.deepEqual(t.report.ausBaum, ['schild_a #5 Knoten 0']);
  assert.equal(t.report.teilnetze, 1);
  assert.deepEqual(t.x, [-1, 4], 'drei Buchstaben von x = 4 nach links; nur verschoben stünden sie von 3 bis 8');
  assert.deepEqual(t.y, [-0.5]);
  assert.deepEqual(t.normale, [0, 1, 0], 'die Normale dreht mit');
  assert.equal(t.vorn, 1, 'die Dreiecke zeigen nach +y wie im Export, nicht gewendet');
  assert.deepEqual(t.gefragt, ['roh/schild_a.cga'], 'gefragt wird der Kopf der Grundstufe, einmal');
});

test('hallTextDoc: am ungedrehten Knoten bleibt die gemessene Verschiebung, und ohne Ersatz wird kein Baum gefragt', () => {
  for (const mitBaum of [true, false]) {
    const t = schild({ stell: (p) => [p[0] + 4, p[1], p[2]], baum: knotenS([4, 0, 0]), mitBaum });
    assert.deepEqual(t.report.ohneLage, []);
    assert.deepEqual(t.report.ausBaum, []);
    assert.deepEqual(t.x, [4, 9]);
    assert.deepEqual(t.y, [0.5]);
    assert.deepEqual(t.normale, [0, -1, 0]);
    assert.equal(t.vorn, -1);
  }
  // die Grundstufe trägt nicht mehr Buchstaben als die leichtere: nichts zu holen, keine Frage an den Baum
  const o = schild({ stell: (p) => [p[0] + 4, p[1], p[2]], baum: knotenS([4, 0, 0]), vollN: 1 });
  assert.equal(o.report.teilnetze, 0);
  assert.deepEqual(o.gefragt, []);
});
