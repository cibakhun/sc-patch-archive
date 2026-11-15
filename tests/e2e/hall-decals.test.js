// Aufkleber der Industrie-Hallen (scripts/lib/hall-decals.mjs): zwei Regeln des
// Auszugs, die nur am Rechner mit den Spieldateien laufen und deshalb hier an
// kleinen Eingaben stehen (15.11.2026, sechste Runde des Reviews an PR #371).
//
// lageOhneMessung: Wo ein Aufkleber-Teilnetz landet, an dessen Knoten kein
// behaltenes Teilnetz gemessen wurde. Vorher bekam es auch in einer .cga die
// Lage null, sobald irgendein anderer Knoten unverschoben gemessen war.
//
// mtlQuelle: Welche .mtl der Auszug liest. Vorher blieb eine .mtl, die schon
// im Rohordner lag, auch mit --force die alte.
//
// knotenLagen, baumBelegt und ihr Weg durch hallDecalDoc (15.11.2026,
// Aufzugtüren): Die Tür der Abgabe-Nische trägt ihre Aufdrucke an eigenen
// Knoten der Türblätter, an denen der Export kein Teilnetz behält. Sieben
// Teilnetze blieben „ohne Lage“. Ihre Lage nennt der Knotenbaum der .cga;
// er gilt nur, wenn jedes behaltene Teilnetz ihn am Export belegt.
//
// Gedrehte Knoten (15.11.2026, nach dem Merge der Türen): Zwei Kästen messen
// eine Verschiebung, keine Drehung. An einem um 180° gedrehten Blatt stimmte
// das behaltene Teilnetz deshalb für „der Export hat die Dreiecke gewendet“,
// obwohl nichts gewendet war (Normale der Datei im Raum des Knotens gegen die
// des Exports), und ein Aufdruck am selben Knoten wäre nur hingeschoben
// worden statt mitgedreht. Beides beantwortet jetzt der belegte Knotenbaum.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@gltf-transform/core';
import { lageOhneMessung, mtlQuelle, knotenLagen, baumBelegt, hallDecalDoc } from '../../scripts/lib/hall-decals.mjs';
import { nmcKnoten } from '../../scripts/lib/hall-kinder.mjs';

test('Lage ohne Messung: nur in einer .cgfm und nur unverschoben', () => {
  assert.deepEqual(lageOhneMessung('data/objects/a/wand_lod1.cgfm', true), [0, 0, 0]);
  assert.deepEqual(lageOhneMessung('DATA/Objects/A/WAND.CGFM', true), [0, 0, 0]);
  // ein gemessener Knoten ist verschoben oder unklar: nichts annehmen
  assert.equal(lageOhneMessung('data/objects/a/wand_lod1.cgfm', false), undefined);
});

test('Lage ohne Messung: in einer .cga bleibt sie offen, auch wenn alles Gemessene unverschoben ist', () => {
  // der Fall des Befunds: Ein anderer Knoten derselben .cga ist unverschoben gemessen, dieser gar nicht
  assert.equal(lageOhneMessung('data/objects/a/tor_lod1.cgam', true), undefined);
  assert.equal(lageOhneMessung('data/objects/a/tor.cgam', true), undefined);
  assert.equal(lageOhneMessung('data/objects/a/tor.cgam', false), undefined);
});

// ein Rohordner als Liste von Pfaden; holen(base) legt <base>.mtl hinein und zählt mit
function ordner(anfang) {
  const dateien = [...anfang], geholt = [];
  return {
    geholt,
    liste: () => dateien.filter((f) => /\.mtl$/i.test(f)),
    holen: (base) => { geholt.push(base); const f = `roh/Data/Objects/neu/${base}.mtl`; if (!dateien.includes(f)) dateien.push(f); },
  };
}

test('mtlQuelle: fehlt die .mtl, wird sie ausgepackt', () => {
  const o = ordner([]);
  const r = mtlQuelle({ rel: 'objects/neu/util_a', liste: o.liste, holen: o.holen });
  assert.deepEqual(o.geholt, ['util_a']);
  assert.equal(r.datei, 'roh/Data/Objects/neu/util_a.mtl');
  assert.equal(r.neu, true);
});

test('mtlQuelle: liegt sie schon da, bleibt es ohne --force dabei', () => {
  const o = ordner(['roh/Data/Objects/alt/util_a.mtl']);
  const r = mtlQuelle({ rel: 'objects/alt/util_a', liste: o.liste, holen: o.holen });
  assert.deepEqual(o.geholt, []);
  assert.equal(r.datei, 'roh/Data/Objects/alt/util_a.mtl');
  assert.equal(r.neu, false);
});

test('mtlQuelle: mit --force wird auch die vorhandene .mtl neu ausgepackt, einmal je Lauf und Datei', () => {
  const o = ordner(['roh/Data/Objects/alt/util_a.mtl', 'roh/Data/Objects/alt/schild.mtl']);
  const frisch = new Set();
  const a = mtlQuelle({ rel: 'objects/alt/util_a', liste: o.liste, holen: o.holen, force: true, frisch });
  assert.deepEqual(o.geholt, ['util_a'], 'die vorhandene Datei wird mit --force neu geholt');
  assert.equal(a.datei, 'roh/Data/Objects/alt/util_a.mtl');
  assert.equal(a.neu, true, 'die XML daneben muss neu entstehen');
  // derselbe Dateiname unter einem anderen Pfad im selben Lauf: nicht noch einmal
  const b = mtlQuelle({ rel: 'objects/anders/util_a', liste: o.liste, holen: o.holen, force: true, frisch });
  assert.deepEqual(o.geholt, ['util_a']);
  assert.equal(b.neu, false);
  // eine andere Datei schon
  mtlQuelle({ rel: 'objects/alt/schild', liste: o.liste, holen: o.holen, force: true, frisch });
  assert.deepEqual(o.geholt, ['util_a', 'schild']);
});

test('mtlQuelle: der volle Pfad geht vor dem bloßen Dateinamen, und ein Auszug, der scheitert, bricht nichts ab', () => {
  const o = ordner(['roh/Data/Objects/a/util_a.mtl', 'roh/Data/Objects/b/util_a.mtl']);
  assert.equal(mtlQuelle({ rel: 'objects/b/util_a', liste: o.liste, holen: o.holen }).datei, 'roh/Data/Objects/b/util_a.mtl');
  assert.equal(mtlQuelle({ rel: 'objects/c/util_a', liste: o.liste, holen: o.holen }).datei, 'roh/Data/Objects/a/util_a.mtl');
  const r = mtlQuelle({ rel: 'objects/x/fehlt', liste: () => [], holen: () => { throw new Error('nicht im Archiv'); } });
  assert.equal(r.datei, undefined);
});


// ─── Lage aus dem Knotenbaum (Aufzugtüren, 15.11.2026) ──────────────────────
const EINS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// halbe Drehung um die Hochachse (Z): so steht der linke Kolben der Tür gegen den rechten
const HALB_Z = [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];
const k = (index, parent, ort, dreh = EINS) => ({ index, name: `k${index}`, parent, geom: 0, b2w: ort ? dreh.map((z, i) => [...z, ort[i]]) : null });
const nah = (a, b, tol = 1e-6) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= tol);
// der Baum der Tür in klein: Wurzel 3, Türblatt 2 an (2,0,0), darunter das Netz 0 und der Aufdruck 1
const TUER = () => [k(0, 2, [-2, -1, 0]), k(1, 2, [-0.9, 0.36, 0.25]), k(2, 3, [2, 0, 0]), k(3, null, [0, 0, 0])];

test('knotenLagen: die Lage eines Knotens ist die Kette von der Wurzel her, nicht sein eigener Eintrag', () => {
  const l = knotenLagen(TUER());
  assert.ok(nah(l.get(0).t, [0, -1, 0]), 'Blatt (2,0,0) und Netz (-2,-1,0) heben sich in x auf');
  assert.ok(nah(l.get(1).t, [1.1, 0.36, 0.25]));
  assert.ok(nah(l.get(1).r, [1, 0, 0, 0, 1, 0, 0, 0, 1]));
  // ein gedrehter Elternknoten dreht den Ort des Kindes mit
  const g = knotenLagen([k(0, 1, [0.5, 0.25, 1]), k(1, null, [1, 0, 0], HALB_Z)]);
  assert.ok(nah(g.get(0).t, [0.5, -0.25, 1]), `(1,0,0) + halbe Drehung von (0.5,0.25,1), ist ${g.get(0).t}`);
  assert.ok(nah(g.get(0).r, [-1, 0, 0, 0, -1, 0, 0, 0, 1]));
});

test('knotenLagen: der Baum, wie „nmc dump“ ihn druckt', () => {
  const dump = [
    '[ 0] netz parent=1 geom=0', '  b2w[0] = [1, 0, 0, -2]', '  b2w[1] = [0, 1, 0, -0.948]', '  b2w[2] = [0, 0, 1, 0]',
    '[ 1] right_door parent=root geom=3', '  b2w[0] = [1, 0, 0, 2]', '  b2w[1] = [0, 1, 0, 0]', '  b2w[2] = [0, 0, 1, 0]',
  ].join('\r\n');
  const l = knotenLagen(nmcKnoten(dump));
  assert.ok(nah(l.get(0).t, [0, -0.948, 0]));
});

test('knotenLagen: wo die Kette nicht lesbar ist, steht keine Lage', () => {
  // ohne eigene Lage, und alles darunter
  const ohne = knotenLagen([k(0, 1, [1, 0, 0]), k(1, null, null), k(2, null, [0, 0, 0])]);
  assert.deepEqual([...ohne.keys()], [2]);
  // der Elternknoten steht nicht im Baum
  assert.equal(knotenLagen([k(0, 7, [1, 0, 0])]).size, 0);
  // im Kreis
  assert.equal(knotenLagen([k(0, 1, [1, 0, 0]), k(1, 0, [1, 0, 0])]).size, 0);
  // gespiegelt oder gestreckt ist keine Drehung
  assert.equal(knotenLagen([k(0, null, [0, 0, 0], [[-1, 0, 0], [0, 1, 0], [0, 0, 1]])]).size, 0);
  assert.equal(knotenLagen([k(0, null, [0, 0, 0], [[2, 0, 0], [0, 1, 0], [0, 0, 1]])]).size, 0);
  // kein Baum
  assert.equal(knotenLagen(null).size, 0);
  assert.equal(knotenLagen([]).size, 0);
});

test('baumBelegt: jede Probe muss nach der Lage ihres Knotens auf ihren Kasten im Export fallen', () => {
  const l = knotenLagen(TUER());
  const probe = (node, lo, hi, dx = 0) => ({ node, datei: { lo, hi }, ausfuhr: { lo: [lo[0] + l.get(node).t[0] + dx, lo[1] + l.get(node).t[1], lo[2] + l.get(node).t[2]], hi: [hi[0] + l.get(node).t[0] + dx, hi[1] + l.get(node).t[1], hi[2] + l.get(node).t[2]] } });
  assert.equal(baumBelegt(l, [probe(0, [0, 1, 0], [1, 1, 2])]), true);
  assert.equal(baumBelegt(l, [probe(0, [0, 1, 0], [1, 1, 2]), probe(1, [0, 0, 0], [0.5, 0, 1])]), true);
  // innerhalb der Toleranz von 2 mm, und knapp daneben
  assert.equal(baumBelegt(l, [probe(0, [0, 1, 0], [1, 1, 2], 0.0015)]), true);
  assert.equal(baumBelegt(l, [probe(0, [0, 1, 0], [1, 1, 2], 0.005)]), false);
  // eine von zwei Proben daneben: der ganze Baum gilt nicht
  assert.equal(baumBelegt(l, [probe(0, [0, 1, 0], [1, 1, 2]), probe(1, [0, 0, 0], [0.5, 0, 1], 0.5)]), false);
  // ohne Probe ist nichts belegt, ebenso an einem Knoten ohne Lage und ohne Baum
  assert.equal(baumBelegt(l, []), false);
  assert.equal(baumBelegt(l, [{ node: 9, datei: { lo: [0, 0, 0], hi: [1, 1, 1] }, ausfuhr: { lo: [0, 0, 0], hi: [1, 1, 1] } }]), false);
  assert.equal(baumBelegt(null, [probe(0, [0, 1, 0], [1, 1, 2])]), false);
});

test('baumBelegt: eine halbe Drehung belegt, eine schräge nicht (streng)', () => {
  const halb = knotenLagen([k(0, null, [1, 0, 0], HALB_Z)]);
  // Kasten (0..1, 0..2, 0..3) wird zu (-1..0, -2..0, 0..3), dazu der Ort (1,0,0)
  assert.equal(baumBelegt(halb, [{ node: 0, datei: { lo: [0, 0, 0], hi: [1, 2, 3] }, ausfuhr: { lo: [0, -2, 0], hi: [1, 0, 3] } }]), true);
  // dieselbe Probe, als wäre der Knoten nur verschoben: fällt durch
  assert.equal(baumBelegt(halb, [{ node: 0, datei: { lo: [0, 0, 0], hi: [1, 2, 3] }, ausfuhr: { lo: [1, 0, 0], hi: [2, 2, 3] } }]), false);
  // 45° um Z: der Kasten der gedrehten Ecken ist größer als der eines schräg liegenden Dreiecks
  const c = Math.SQRT1_2, schraeg = knotenLagen([k(0, null, [0, 0, 0], [[c, -c, 0], [c, c, 0], [0, 0, 1]])]);
  assert.equal(schraeg.size, 1, 'die Lage selbst ist lesbar');
  // die Punkte (0,0,0), (1,0,0), (1,1,0) liegen gedreht in x -0..0.7071, y 0..1.4142
  assert.equal(baumBelegt(schraeg, [{ node: 0, datei: { lo: [0, 0, 0], hi: [1, 1, 0] }, ausfuhr: { lo: [0, 0, 0], hi: [c, 2 * c, 0] } }]), false);
});

// Eine Tür in klein für hallDecalDoc. Die Datei trägt zwei Teilnetze: den Aufdruck (Material 1, Knoten 1),
// den der Export auslässt, und das Blech (Material 2, Knoten 0), das er behält. Lagen der Datei im Raum
// ihres Knotens; der Export zeigt das Blech dort, wo der Baum es hinstellt (versatzBlech).
const BLECH = [[0, 1, 0], [1, 1, 0], [1, 1, 2], [0, 1, 2]], DRUCK = [[0, 0, 0], [0.5, 0, 0], [0.5, 0, 1], [0, 0, 1]];
// stellBlech: wohin der Export eine Ecke des Blechs stellt (sonst verschoben um versatzBlech). umlauf: die
// Dreiecke des Blechs im Export. knotenDruck: der Knoten, an dem der Aufdruck hängt. aufdruck: trägt das
// ausgelassene Teilnetz ein Aufkleber-Material?
function tuer({ baum = TUER(), versatzBlech = [0, -1, 0], stellBlech = (p) => p.map((x, q) => x + versatzBlech[q]), umlauf = [0, 1, 2, 0, 2, 3], knotenDruck = 1, aufdruck = true, endung = 'cgam', mitBaum = true } = {}) {
  const ecken = [...DRUCK, ...BLECH];
  const g = {
    subs: [{ mat: 1, node: knotenDruck, firstIndex: 0, numIndices: 6 }, { mat: 2, node: 0, firstIndex: 6, numIndices: 6 }],
    pos: new Float32Array(ecken.flat()), idx: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]),
    uv: new Float32Array(16), col: new Uint8Array(32).fill(255), nor: new Float32Array(ecken.flatMap(() => [0, -1, 0])),
  };
  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive().setMaterial(doc.createMaterial('tuer_mtl_blech_02'))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(BLECH.flatMap(stellBlech))).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(umlauf)).setBuffer(buffer));
  doc.createScene('halle').addChild(doc.createNode('tuer').setMesh(doc.createMesh('objects/tuer/tuer_a.cga').addPrimitive(prim)));
  const gefragt = [];
  const r = hallDecalDoc({
    doc, Document, lod: 1,
    files: new Map([[`tuer_a_lod1.${endung}`, [`roh/tuer_a_lod1.${endung}`]]]),
    read: (f) => f,
    leseNetz: () => g,
    leseMaterial: () => 'objects/tuer/tuer.mtl',
    subMaterials: () => [null, { name: 'aufdruck', decal: aufdruck, shader: 'Illum', d: 'aufdruck.dds' }, { name: 'blech' }],
    ...(mitBaum ? { knoten: (kopf) => { gefragt.push(kopf); return baum; } } : {}),
  });
  const p = r.doc?.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const lage = p ? [...p.getAttribute('POSITION').getArray()].map((x) => +x.toFixed(4)) : null;
  const normale = p ? [...p.getAttribute('NORMAL').getArray()].slice(0, 3).map((x) => +x.toFixed(4)) : null;
  return { report: r.report, lage, normale, gefragt, dreiecke: p ? [...p.getIndices().getArray()] : null };
}

test('hallDecalDoc: ein Aufdruck an einem Knoten ohne behaltenes Teilnetz steht, wo der belegte Knotenbaum ihn hinstellt', () => {
  const t = tuer();
  assert.deepEqual(t.report.ohneLage, []);
  assert.deepEqual(t.report.ausBaum, ['tuer_a #1 Knoten 1']);
  // Knoten 1 liegt bei (2,0,0) + (-0.9,0.36,0.25)
  assert.deepEqual(t.lage, DRUCK.flatMap((p) => [p[0] + 1.1, p[1] + 0.36, p[2] + 0.25]).map((x) => +x.toFixed(4)));
  assert.deepEqual(t.normale, [0, -1, 0]);
  assert.deepEqual(t.gefragt, ['roh/tuer_a.cga'], 'gefragt wird der Kopf der Grundstufe, einmal');
  assert.equal(t.report.aufkleber.teilnetze, 1);
});

test('hallDecalDoc: steht der Knoten des Aufdrucks gedreht, drehen Lage und Normale mit', () => {
  // der Aufdruck hängt an einem halb gedrehten Kolben: Knoten 1 unter Knoten 4 (halbe Drehung um Z, bei (1,0,0))
  const baum = [k(0, 2, [-2, -1, 0]), k(1, 4, [0.25, 0, 0]), k(2, 3, [2, 0, 0]), k(3, null, [0, 0, 0]), k(4, 3, [1, 0, 0], HALB_Z)];
  const t = tuer({ baum });
  assert.deepEqual(t.report.ohneLage, []);
  // p -> (1,0,0) + halbe Drehung von (p + (0.25,0,0)) = (0.75 - x, -y, z)
  assert.deepEqual(t.lage, DRUCK.flatMap((p) => [0.75 - p[0], -p[1], p[2]]).map((x) => +x.toFixed(4)));
  assert.deepEqual(t.normale, [0, 1, 0]);
});

test('hallDecalDoc: ohne Knotenbaum, ohne Beleg oder ohne Lage des Knotens bleibt der Aufdruck ohne Lage', () => {
  const offen = (t, warum) => { assert.deepEqual(t.report.ohneLage, ['tuer_a #1 Knoten 1'], warum); assert.deepEqual(t.report.ausBaum, [], warum); assert.equal(t.lage, null, warum); };
  offen(tuer({ mitBaum: false }), 'der Auszug reicht keinen Baum herein');
  offen(tuer({ baum: null }), 'die Datei hat keinen lesbaren Baum');
  offen(tuer({ baum: [] }), 'der Baum ist leer');
  // der Export zeigt das Blech 5 cm neben der Stelle, an die der Baum es stellt: Der Baum gilt nicht
  offen(tuer({ versatzBlech: [0.05, -1, 0] }), 'das behaltene Teilnetz belegt den Baum nicht');
  // der Baum stimmt, nennt den Knoten des Aufdrucks aber ohne Lage
  offen(tuer({ baum: [k(0, 2, [-2, -1, 0]), k(1, 2, null), k(2, 3, [2, 0, 0]), k(3, null, [0, 0, 0])] }), 'der Knoten des Aufdrucks hat keine Lage');
});

test('hallDecalDoc: der Knotenbaum wird nur für eine .cga gefragt, und nur, wenn das Netz Aufdrucke zurückbekommt', () => {
  // .cgfm: ein Netz ohne Knotenbaum; verschoben gemessen, also auch nicht über lageOhneMessung
  const f = tuer({ endung: 'cgfm' });
  assert.deepEqual(f.gefragt, []);
  assert.deepEqual(f.report.ohneLage, ['tuer_a #1 Knoten 1']);
  // .cga, deren ausgelassenes Teilnetz kein Aufkleber ist: nichts zurückzuholen, also keine Frage
  const o = tuer({ aufdruck: false });
  assert.deepEqual(o.gefragt, []);
  assert.equal(o.report.andere.teilnetze, 1);
});

// ─── Gedrehte Knoten (15.11.2026) ───────────────────────────────────────────
// Das Blech hängt an einem halb gedrehten Blatt: Knoten 0 unter Knoten 4 (halbe Drehung um Z, bei (1,0,0)).
// Der Export zeigt es dort, wohin der Baum es stellt: (x, y, z) -> (1 - x, -y, z). Der Aufdruck hängt am
// ungedrehten Knoten 1 wie in TUER().
const BLATT = () => [k(0, 4, [0, 0, 0]), k(1, 2, [-0.9, 0.36, 0.25]), k(2, 3, [2, 0, 0]), k(3, null, [0, 0, 0]), k(4, 3, [1, 0, 0], HALB_Z)];
const HALB = (p) => [1 - p[0], -p[1], p[2]];
const GEWENDET = [0, 2, 1, 0, 3, 2];

test('hallDecalDoc: ein um 180° gedrehtes Blatt stimmt nicht für „gewendet“', () => {
  // Datei: Normale des Blechs -y im Raum seines Knotens. Export: dieselben Dreiecke, gedreht, Normale +y.
  // Ohne die Drehung des Knotens zeigten die beiden Normalen gegeneinander, und der Aufdruck bekäme
  // gewendete Dreiecke: Sein Material ist einseitig, man sähe seine Rückseite, also nichts.
  const t = tuer({ baum: BLATT(), stellBlech: HALB });
  assert.deepEqual(t.report.ohneLage, []);
  assert.equal(t.report.gedreht, 0, 'der Export hat nichts gewendet');
  assert.deepEqual(t.dreiecke, [0, 1, 2, 0, 2, 3]);
  assert.deepEqual(t.lage, DRUCK.flatMap((p) => [p[0] + 1.1, p[1] + 0.36, p[2] + 0.25]).map((x) => +x.toFixed(4)));
});

test('hallDecalDoc: hat der Export am gedrehten Blatt wirklich gewendet, wendet der Aufdruck mit', () => {
  const t = tuer({ baum: BLATT(), stellBlech: HALB, umlauf: GEWENDET });
  assert.equal(t.report.gedreht, 1);
  assert.deepEqual(t.dreiecke, GEWENDET);
  // und am ungedrehten Knoten wie zuvor: gewendet heißt gewendet
  const u = tuer({ umlauf: GEWENDET });
  assert.equal(u.report.gedreht, 1);
  assert.deepEqual(u.dreiecke, GEWENDET);
  assert.equal(tuer().report.gedreht, 0);
});

test('hallDecalDoc: ein Aufdruck am gedrehten Knoten dreht mit, auch wenn dort ein behaltenes Teilnetz gemessen ist', () => {
  // Aufdruck und Blech am selben, gedrehten Knoten 0. Die beiden Kästen des Blechs sind gleich groß, die
  // Messung nennt eine Verschiebung von (0,-2,0), und die trüge den Aufdruck nach y = -2 statt ihn zu drehen.
  const t = tuer({ baum: BLATT(), stellBlech: HALB, knotenDruck: 0 });
  assert.deepEqual(t.report.ohneLage, []);
  assert.deepEqual(t.report.ausBaum, ['tuer_a #1 Knoten 0']);
  assert.deepEqual(t.report.gedrehterKnoten, ['tuer_a #1 Knoten 0']);
  assert.deepEqual(t.lage, DRUCK.flatMap(HALB).map((x) => +x.toFixed(4)));
  assert.deepEqual(t.normale, [0, 1, 0]);
  assert.deepEqual(t.dreiecke, [0, 1, 2, 0, 2, 3]);
});

test('hallDecalDoc: am ungedrehten Knoten bleibt die gemessene Verschiebung, mit und ohne Baum', () => {
  for (const mitBaum of [true, false]) {
    const t = tuer({ knotenDruck: 0, mitBaum });
    assert.deepEqual(t.report.ohneLage, []);
    assert.deepEqual(t.report.ausBaum, [], 'gemessen, nicht aus dem Baum');
    assert.deepEqual(t.report.gedrehterKnoten, []);
    assert.deepEqual(t.lage, DRUCK.flatMap((p) => [p[0], p[1] - 1, p[2]]).map((x) => +x.toFixed(4)));
    assert.deepEqual(t.normale, [0, -1, 0]);
  }
  // der Baum belegt die Drehung nicht (der Export zeigt das Blech nur verschoben): Dann gilt er nicht,
  // und es bleibt bei der Messung
  const u = tuer({ baum: BLATT(), knotenDruck: 0 });
  assert.deepEqual(u.report.ausBaum, []);
  assert.deepEqual(u.lage, DRUCK.flatMap((p) => [p[0], p[1] - 1, p[2]]).map((x) => +x.toFixed(4)));
});
