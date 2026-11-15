// Lichtgitter einer Halle zurücklesen (scripts/lib/hall-gitter.mjs).
//
// verify:hangar-hallen [2] hielt das Grundlicht der Halle zuerst am Quelltext
// fest: hallGrund kommt in der Gitterfunktion vor, loadHallLights reicht ihr
// die Halle durch. CodeRabbit am 15.11.2026 zu PR #380: Wer die Additionen
// ins Gitter streicht, lässt beides stehen, und das Tor bleibt grün, während
// keine Fläche mehr Grundlicht bekommt. Seither rechnet das Tor das Gitter
// mit hallGitter des Viewers und liest die Zellen zurück.
//
// Hier steht jede Form, in der das Grundlicht verloren gehen kann, als
// Bruch am echten Viewer: Der Quelltext wird an genau einer Stelle
// verändert, als Modul geladen, und dieselben drei Rechnungen wie im Tor
// müssen den Bruch nennen. Steht eine der Zeilen nicht mehr so im Viewer,
// scheitert der Test an dieser Stelle mit ihrem Namen; dann gehört die Form
// hier an den neuen Wortlaut angepasst, nicht gestrichen.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DataUtils } from 'three';
import { gitterWerte, grundImGitter, gitterLicht, gitterDazu, gitterAufrufe, gitterDunkelste, RICHTUNGEN, TOL } from '../../scripts/lib/hall-gitter.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const QUELLE = readFileSync(join(ROOT, 'assets/hangar-viewer.js'), 'utf8');
// die erste Halle mit Grundlicht, so wie das Tor den Block liest
const FEST = JSON.parse(/\/\* hall-fest \*\/([\s\S]*?)\/\* \/hall-fest \*\//.exec(QUELLE)[1]);
const ID = Object.keys(FEST).find((id) => FEST[id].grund > 0);
// ein kleiner Raum, damit jede Form in Millisekunden gerechnet ist: 7 × 7 × 9 Zellen
const HALLE = { id: ID, room: { center: [0, 0, 0], halfW: 6, halfL: 8, height: 10 } };
const BODEN = 0.5;
const LAMPEN = [
  { type: 'point', pos: [0, 5, 0], intensity: 50, radius: 12 },
  { type: 'spot', pos: [3, 9, 2], dir: [0, -1, 0], angle: 60, intensity: 200, radius: 15, color: [1, 0.8, 0.6] },
  { type: 'area', pos: [-5.5, 4, 0], dir: [1, 0, 0], intensity: 30, radius: 8 },
];

// veränderte Fassungen des Viewers liegen im Repo (dort findet node three), in .cache/ (nicht eingecheckt)
mkdirSync(join(ROOT, '.cache'), { recursive: true });
const ORDNER = mkdtempSync(join(ROOT, '.cache', 'hall-gitter-test-'));
after(() => rmSync(ORDNER, { recursive: true, force: true }));
let nr = 0;
async function viewer(alt, neu) {
  let text = QUELLE;
  if (alt !== undefined) {
    assert.equal(QUELLE.split(alt).length - 1, 1, `die Zeile, die diese Form bricht, steht nicht (mehr) genau einmal im Viewer: ${alt}`);
    text = QUELLE.replace(alt, () => neu);
  }
  const datei = join(ORDNER, `viewer-${nr++}.mjs`);
  writeFileSync(datei, text);
  return import(pathToFileURL(datei).href);
}

// dieselben Rechnungen wie verify:hangar-hallen [2] und [3]
async function urteil(v) {
  const lesen = async (lampen, h) => gitterWerte(await v.hallGitter(lampen, h, BODEN), DataUtils.fromHalfFloat);
  const leer = await lesen([], HALLE), fremd = await lesen([], { room: HALLE.room });
  const mit = await lesen(LAMPEN, HALLE), nur = await lesen(LAMPEN, { room: HALLE.room });
  const B = grundImGitter(leer, { boden: BODEN, hoehe: HALLE.room.height, step: v.VOL_STEP, grund: (hoch) => v.hallGrund(ID, hoch), farbe: v.VOL_GRUND.farbe });
  return { B, F: gitterLicht(fremd), D: gitterDazu(mit, nur, leer), neben: B.abweichungen.map((a) => a.was) };
}
const FARBE = ['Lichtfarbe Rot', 'Lichtfarbe Blau'];

test('der Viewer, wie er im Repo steht: Das Grundlicht steht in jeder Zelle, nur in dieser Halle, und kommt zum Lampenlicht hinzu', async () => {
  assert.ok(ID, 'keine Halle in HALL_FEST hat Grundlicht');
  const { B, F, D } = await urteil(await viewer());
  assert.deepEqual(B.abweichungen, []);
  assert.equal(B.zellen, 7 * 7 * 9);
  assert.equal(B.schichten, 7);
  assert.ok(B.reicht && B.von === -1 && B.bis === 11, `Schichten von ${B.von} bis ${B.bis}`);
  assert.equal(B.ohneSoll, 0);
  assert.deepEqual(F, { ueberNull: 0, hoechster: 0 });
  assert.equal(D.abweichend, 0, JSON.stringify(D.erstes));
  assert.equal(D.werte, 7 * 7 * 9 * 6);
  assert.ok(D.staerker > 100, `nur an ${D.staerker} Werten sind die Lampen stärker als das Grundlicht`);
});

test('der Fall aus dem Review: ohne die Additionen ins Gitter fehlt das Grundlicht in allen sechs Richtungen und in der Farbe', async () => {
  const v = await viewer(
    '        face[n * 6] += g.seite; face[n * 6 + 1] += g.seite; face[n * 6 + 2] += g.oben;\n        face[n * 6 + 3] += g.unten; face[n * 6 + 4] += g.seite; face[n * 6 + 5] += g.seite;\n        rgb[n * 3] += q * gr; rgb[n * 3 + 1] += q * gg; rgb[n * 3 + 2] += q * gb;\n',
    '',
  );
  // was die erste Fassung des Tors las, steht alles noch da
  assert.ok(typeof v.hallGrund === 'function' && v.hallGrund(ID, 0).seite > 0);
  const { B, neben } = await urteil(v);
  assert.deepEqual(neben, [...RICHTUNGEN, ...FARBE]);
  for (const a of B.abweichungen.slice(0, 6)) { assert.equal(a.zahl, B.zellen); assert.equal(a.ist, 0); assert.ok(a.soll > 0); }
});

test('fehlt eine einzige Richtung, nennt die Rechnung genau diese', async () => {
  const zeilen = ['face[n * 6] += g.seite;', 'face[n * 6 + 1] += g.seite;', 'face[n * 6 + 2] += g.oben;', 'face[n * 6 + 3] += g.unten;', 'face[n * 6 + 4] += g.seite;', 'face[n * 6 + 5] += g.seite;'];
  for (const [s, zeile] of zeilen.entries()) {
    const { B, neben } = await urteil(await viewer(zeile, ''));
    assert.deepEqual(neben, [RICHTUNGEN[s]], zeile);
    assert.equal(B.abweichungen[0].zahl, B.zellen, zeile);
  }
});

test('Unterseiten so hell wie Oberseiten, die Höhe nicht beachtet, die Farbe weiß: jedes fällt auf', async () => {
  const unten = await urteil(await viewer('face[n * 6 + 3] += g.unten;', 'face[n * 6 + 3] += g.oben;'));
  assert.deepEqual(unten.neben, ['-y']);
  const hoch = await urteil(await viewer('const g = hallGrund(h.id, (y0 + j * VOL_STEP - f) / height), q = g.seite / gl;', 'const g = hallGrund(h.id, 0), q = g.seite / gl;'));
  assert.deepEqual(hoch.neben, RICHTUNGEN);
  // die unterste Schicht liegt unter dem Boden und bekommt ohnehin das volle Licht: Der Bruch beginnt darüber
  for (const a of hoch.B.abweichungen) { assert.equal(a.schicht, 1); assert.equal(a.zahl, 7 * 9 * 6); assert.ok(a.ist > a.soll); }
  const farbe = await urteil(await viewer('        rgb[n * 3] += q * gr; rgb[n * 3 + 1] += q * gg; rgb[n * 3 + 2] += q * gb;\n', ''));
  assert.deepEqual(farbe.neben, FARBE);
});

test('die Halle wird nicht gefragt: kein Grundlicht, oder eines für jede Halle', async () => {
  const keins = await urteil(await viewer('  if (hallGrund(h.id, 0)) {\n    const [gr, gg, gb] = VOL_GRUND.farbe', '  if (hallGrund(null, 0)) {\n    const [gr, gg, gb] = VOL_GRUND.farbe'));
  assert.deepEqual(keins.neben, [...RICHTUNGEN, ...FARBE]);
  const alle = await urteil(await viewer('  const g = HALL_FEST[id]?.grund;\n', '  const g = HALL_FEST[id]?.grund ?? 2;\n'));
  // in der Halle selbst stimmt alles, aber die Halle ohne Eintrag ist nicht mehr dunkel
  assert.deepEqual(alle.neben, []);
  assert.equal(alle.F.ueberNull, 7 * 7 * 9 * 6);
  assert.equal(alle.F.hoechster, 2);
});

test('ersetzt das Grundlicht das Lampenlicht, statt dazuzukommen, fehlt die Summe', async () => {
  const gleich = await urteil(await viewer('face[n * 6] += g.seite;', 'face[n * 6] = g.seite;'));
  // ohne Lampen sieht man es nicht
  assert.deepEqual(gleich.neben, []);
  assert.ok(gleich.D.abweichend > 0);
  assert.equal(gleich.D.erstes.was, '+x');
  assert.ok(gleich.D.erstes.mit < gleich.D.erstes.nur + gleich.D.erstes.leer);
  const groesser = await urteil(await viewer('face[n * 6 + 2] += g.oben;', 'face[n * 6 + 2] = Math.max(face[n * 6 + 2], g.oben);'));
  assert.deepEqual(groesser.neben, []);
  assert.ok(groesser.D.abweichend > 0);
  assert.equal(groesser.D.erstes.was, '+y');
  // und andersherum: Mit dem Grundlicht verschwindet das Licht der Lampen
  const weg = await urteil(await viewer('  if (hallGrund(h.id, 0)) {\n    const [gr, gg, gb] = VOL_GRUND.farbe', '  if (hallGrund(h.id, 0)) {\n    face.fill(0);\n    const [gr, gg, gb] = VOL_GRUND.farbe'));
  assert.deepEqual(weg.neben, []);
  assert.ok(weg.D.abweichend > 0);
  // dort steht nur noch das Grundlicht
  assert.equal(weg.D.erstes.mit, weg.D.erstes.leer);
  assert.ok(weg.D.erstes.nur > 0);
  // verschwindet es in jeder Halle, stimmt die Summe (null plus Grundlicht), aber nirgends sind die Lampen
  // stärker als das Grundlicht: Das Tor meldet, dass es so nichts prüfen kann
  const nie = await urteil(await viewer('  // Grundlicht der Halle (hallGrund) in jede Zelle, je Schicht nach ihrer Höhe\n', '  face.fill(0);\n'));
  assert.equal(nie.D.abweichend, 0);
  assert.equal(nie.D.staerker, 0);
});

test('Spiel der Halbfloats: Eine Stufe daneben gilt, ein Prozent daneben nicht', () => {
  const hf = DataUtils.toHalfFloat, grund = () => ({ seite: 4.4603, oben: 4.4603, unten: 2.6762 }), farbe = [0.75, 0.92, 1];
  const hell = 0.2126 * 0.75 + 0.7152 * 0.92 + 0.0722;
  const bau = (werte) => {
    const a = new Uint16Array(3 * 4), b = new Uint16Array(3 * 4);
    for (let n = 0; n < 3; n++) { for (let s = 0; s < 4; s++) a[n * 4 + s] = hf(werte[s]); for (let s = 0; s < 4; s++) b[n * 4 + s] = hf(werte[4 + s]); }
    return gitterWerte({ a, b, res: [1, 3, 1], min: [0, -1, 0], used: 0 }, DataUtils.fromHalfFloat);
  };
  const o = { boden: 0, hoehe: 2, step: 2, grund, farbe };
  const genau = [4.4603, 4.4603, 4.4603, 2.6762, 4.4603, 4.4603, 0.75 / hell, 1 / hell];
  // gepackt liegt 4,4603 bei 4,457: daneben, aber innerhalb einer Stufe
  assert.ok(Math.abs(DataUtils.fromHalfFloat(hf(4.4603)) - 4.4603) > 1e-3);
  assert.deepEqual(grundImGitter(bau(genau), o).abweichungen, []);
  assert.ok(grundImGitter(bau(genau), o).reicht);
  const daneben = grundImGitter(bau(genau.map((x, s) => (s === 3 ? x * 0.99 : x))), o);
  assert.deepEqual(daneben.abweichungen.map((a) => [a.was, a.zahl]), [['-y', 3]]);
  assert.ok(TOL < 0.01 && TOL >= 2 ** -10, `TOL ${TOL}`);
  // zu niedrig für den Raum: Die oberste Schicht liegt unter der Decke
  assert.equal(grundImGitter(bau(genau), { ...o, hoehe: 4 }).reicht, false);
  // nennt die Halle für eine Schicht kein Grundlicht, ist sie nicht geprüft
  const ohne = grundImGitter(bau(genau), { ...o, grund: (hoch) => (hoch > 0.5 ? null : grund()) });
  assert.equal(ohne.ohneSoll, 1);
});

test('kein Gitter: falsche Felder, falsche Längen, ohne Ecke', () => {
  const halb = DataUtils.fromHalfFloat, a = new Uint16Array(8), b = new Uint16Array(8);
  assert.ok(gitterWerte({ a, b, res: [2, 1, 1], min: [0, 0, 0] }, halb));
  assert.equal(gitterWerte(null, halb), null);
  assert.equal(gitterWerte({ a, b, res: [2, 1], min: [0, 0, 0] }, halb), null);
  assert.equal(gitterWerte({ a, b, res: [2, 1, 2], min: [0, 0, 0] }, halb), null);
  assert.equal(gitterWerte({ a: new Float32Array(8), b, res: [2, 1, 1], min: [0, 0, 0] }, halb), null);
  assert.equal(gitterWerte({ a, b: new Uint16Array(4), res: [2, 1, 1], min: [0, 0, 0] }, halb), null);
  assert.equal(gitterWerte({ a, b, res: [2, 1, 1], min: [0, NaN, 0] }, halb), null);
  assert.equal(gitterWerte({ a, b, res: [2, 0, 1], min: [0, 0, 0] }, halb), null);
  // verschieden große Gitter lassen sich nicht aufeinanderlegen
  const klein = gitterWerte({ a, b, res: [2, 1, 1], min: [0, 0, 0] }, halb), quer = gitterWerte({ a, b, res: [1, 2, 1], min: [0, 0, 0] }, halb);
  assert.equal(gitterDazu(klein, klein, quer), null);
  assert.equal(gitterDazu(klein, klein, klein).abweichend, 0);
});

// Was die laufende Bühne nach dem Laden meldet (gitterDunkel an ihren Uniformen, Zeile "[hangar] Lichtgitter …
// geladen (dunkelste Stelle …)") und check:hangar-shader gegen die Klinke der Halle hält.
test('die dunkelste Stelle eines Gitters: gitterDunkel liest die sechs Richtungen beider Felder, nicht die Lichtfarbe', async () => {
  const v = await viewer(), hf = DataUtils.toHalfFloat;
  const mit = await v.hallGitter(LAMPEN, HALLE, BODEN), nur = await v.hallGitter(LAMPEN, { room: HALLE.room }, BODEN);
  // am gerechneten Gitter dasselbe wie die Zellen selbst: mit Grundlicht dessen dunkelste Stufe (Unterseiten in
  // der obersten Schicht), ohne Grundlicht null (Lampen allein lassen Zellen im Schwarz)
  assert.equal(v.gitterDunkel(mit.a, mit.b), gitterDunkelste(gitterWerte(mit, DataUtils.fromHalfFloat)));
  const oben = v.hallGrund(ID, (-1 + (mit.res[1] - 1) * v.VOL_STEP) / HALLE.room.height).unten;
  assert.ok(Math.abs(v.gitterDunkel(mit.a, mit.b) - oben) <= TOL * oben, `${v.gitterDunkel(mit.a, mit.b)} statt ${oben}`);
  assert.equal(v.gitterDunkel(nur.a, nur.b), 0);
  // je Zelle zählen a ganz und die ersten zwei von b; Rot und Blau der Lichtfarbe (b, dritter und vierter Wert) nicht
  const feld = (...w) => Uint16Array.from(w.map(hf));
  assert.equal(v.gitterDunkel(feld(5, 5, 5, 5, 6, 6, 6, 6), feld(5, 5, 0.1, 0.2, 6, 6, 0, 0)), 5);
  for (let i = 0; i < 4; i++) { const a = [5, 5, 5, 5, 6, 6, 6, 6]; a[4 + i] = 2; assert.equal(v.gitterDunkel(feld(...a), feld(5, 5, 1, 1, 6, 6, 1, 1)), 2, `a, Wert ${i}`); }
  for (let i = 0; i < 2; i++) { const b = [5, 5, 1, 1, 6, 6, 1, 1]; b[i] = 3; assert.equal(v.gitterDunkel(feld(5, 5, 5, 5, 6, 6, 6, 6), feld(...b)), 3, `b, Wert ${i}`); }
  // kein Gitter: nichts geladen, zwei Längen, keine ganzen Zellen, keine Halbfloat-Felder
  for (const [a, b] of [[null, null], [undefined, mit.b], [mit.a, null], [feld(1, 1, 1, 1), feld(1, 1, 1, 1, 1, 1, 1, 1)], [feld(1, 1, 1), feld(1, 1, 1)], [new Uint16Array(0), new Uint16Array(0)], [[1, 1, 1, 1], [1, 1, 1, 1]], [new Float32Array(4), new Float32Array(4)]]) assert.equal(v.gitterDunkel(a, b), null);
});

// Die Naht liest Regeln der Sprache nach (welches h ist gemeint, wird das Ergebnis gelesen). Darum läuft jede
// Form auch wirklich: mit einer Gitterfunktion, die mitschreibt, welche Halle sie bekam und ob a und b ihres
// Ergebnisses gelesen wurden. Wo die Naht strenger ist als die Sprache, steht es an der Form.
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
async function wirklich(rumpf, kopf = 'async function loadHallLights(h) {') {
  const halle = { room: {} }, bekam = [], gelesen = new Set();
  const hallGitter = async (lampen, h) => { bekam.push(h); return { get a() { gelesen.add('a'); return 1; }, get b() { gelesen.add('b'); return 2; }, res: [1, 1, 1], used: 0 }; };
  const lauf = new AsyncFunction('hallGitter', 'halle', `
    const liste = [], f = 0, g = { room: {} }, andere = [{ h: {} }], alt = [{ a: 0, b: 0 }], alle = [], lit = new Set(), pause = null;
    const tex = (x) => x, zaehl = () => {}, werfen = () => { throw new Error('x'); }, spaeter = (fn) => fn();
    let vol_a, vol_b, x = 1, y;
    ${kopf}
      ${rumpf}
    }
    return loadHallLights(halle);`);
  let fehler = null;
  try { await lauf(hallGitter, halle); } catch (e) { fehler = e; }
  return { halle: bekam.length > 0 && bekam.every((h) => h === halle), genutzt: gelesen.has('a') && gelesen.has('b'), rufe: bekam.length, fehler };
}

test('die Naht am Quelltext: Die Bühne rechnet ihr Gitter mit hallGitter, reicht ihm die Halle und lädt, was es liefert', async () => {
  const echt = gitterAufrufe(QUELLE);
  assert.deepEqual(echt.fehler, []);
  assert.deepEqual(echt.aufrufe.map((a) => [a.halle, a.genutzt]), [[true, true]]);
  const form = (rumpf, kopf = 'async function loadHallLights(h) {') => gitterAufrufe(`export async function initHangar() {\n  ${kopf}\n    ${rumpf}\n  }\n}\n`);
  const kurz = (r) => r.aufrufe.map((a) => `${a.halle ? 'Halle' : 'fremd'} ${a.genutzt ? 'genutzt' : 'verworfen'}`);
  const LADEN = 'vol_a = tex(vol.a, vol.res); vol_b = tex(vol.b, vol.res);';
  // [Form, Urteil der Naht, wo sie strenger ist als die Sprache (sonst nichts), Kopf der Funktion]
  const FORMEN = [
    [`const vol = await hallGitter(liste, h, f, pause); ${LADEN}`, 'Halle genutzt'],
    // über mehrere Zeilen bleibt es ein Aufruf
    [`const vol = await hallGitter(\n      alle.filter((l) => !lit.has(l)),\n      h,\n      f,\n    );\n    ${LADEN}`, 'Halle genutzt'],
    // der Parameter darf anders heißen, gemeint ist der erste
    [`const vol = await hallGitter(liste, raum, f); ${LADEN}`, 'Halle genutzt', null, 'async function loadHallLights(raum, zwei) {'],
    // gelesen wird auch aus einem inneren Pfeil, solange es dasselbe vol ist
    ['const vol = await hallGitter(liste, h, f); spaeter(() => { x = tex(vol.a); y = tex(vol.b); });', 'Halle genutzt'],
    // nur daneben neu gebunden: Der Aufruf meint weiter die Halle
    [`andere.forEach((h) => zaehl(h)); { const h = 1; zaehl(h); } const vol = await hallGitter(liste, h, f); ${LADEN}`, 'Halle genutzt'],

    // nicht die Halle: nur ihr Raum, ein Nachbau, eine andere, gar keine
    [`const vol = await hallGitter(liste, h.room, f); ${LADEN}`, 'fremd genutzt'],
    [`const vol = await hallGitter(liste, { room: h.room }, f); ${LADEN}`, 'fremd genutzt'],
    [`const vol = await hallGitter(liste, g, f); ${LADEN}`, 'fremd genutzt'],
    [`const vol = await hallGitter(h); ${LADEN}`, 'fremd genutzt'],
    // derselbe Name, ein anderer Wert: neu gebunden zwischen Aufruf und Funktion
    [`await Promise.all(andere.map(async (h) => { const vol = await hallGitter(liste, h, f); ${LADEN} }));`, 'fremd genutzt'],
    [`await Promise.all(andere.map(async ({ h }) => { const vol = await hallGitter(liste, h, f); ${LADEN} }));`, 'fremd genutzt'],
    [`await Promise.all(andere.map(async function (h) { const vol = await hallGitter(liste, h, f); ${LADEN} }));`, 'fremd genutzt'],
    [`for (const h of andere) { const vol = await hallGitter(liste, h, f); ${LADEN} }`, 'fremd genutzt'],
    [`for (let h = 0; h < 1; h++) { const vol = await hallGitter(liste, h, f); ${LADEN} }`, 'fremd genutzt'],
    [`{ const [h] = andere; const vol = await hallGitter(liste, h, f); ${LADEN} }`, 'fremd genutzt'],
    [`try { werfen(); } catch (h) { const vol = await hallGitter(liste, h, f); ${LADEN} }`, 'fremd genutzt'],
    [`switch (x) { case 1: let h = 1; const vol = await hallGitter(liste, h, f); ${LADEN} }`, 'fremd genutzt'],
    // im selben Block erst später erklärt: Der Aufruf liest es zu früh und bricht ab, gerechnet wird nichts
    [`{ const vol = await hallGitter(liste, h, f); ${LADEN} const h = 1; }`, 'fremd genutzt', 'bricht ab, nichts wird gelesen'],

    // gerechnet und verworfen: ohne Namen, nicht gewartet, nie oder nur halb gelesen, ein anderes vol gelesen
    ['await hallGitter(liste, h, f);', 'Halle verworfen'],
    [`const vol = hallGitter(liste, h, f); ${LADEN}`, 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); zaehl(vol.used);', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); x = tex(vol.a);', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); alt.forEach((vol) => { x = tex(vol.a); y = tex(vol.b); });', 'Halle verworfen'],
    ['{ const vol = await hallGitter(liste, h, f); } { const vol = alt[0]; x = tex(vol.a); y = tex(vol.b); }', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); // x = tex(vol.a); y = tex(vol.b);', 'Halle verworfen'],
    // nur beschrieben, nie gelesen (CodeRabbit zu PR #380, zweite Runde: Ein Zuweisungsziel ist auch ein Feldzugriff)
    ['const vol = await hallGitter(liste, h, f); vol.a = null; vol.b = null;', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); vol.a = vol.b = null;', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); (vol.a) = null; (vol.b) = null;', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); [vol.a, vol.b] = [null, null];', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); [vol.a = 1, ...vol.b] = [];', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); ({ k: vol.a, l: vol.b } = { k: 0, l: 0 });', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); for (vol.a of [1]) zaehl(); for (vol.b in { k: 1 }) zaehl();', 'Halle verworfen'],
    ['const vol = await hallGitter(liste, h, f); delete vol.a; delete vol.b;', 'Halle verworfen'],
    // eines gelesen, das andere nur beschrieben
    ['const vol = await hallGitter(liste, h, f); x = tex(vol.a); vol.b = null;', 'Halle verworfen'],
    // erst beschrieben, dann gelesen: Gelesen ist gelesen (was dann im Feld steht, sieht erst die laufende Bühne)
    [`const vol = await hallGitter(liste, h, f); vol.a = alt[0].a; ${LADEN}`, 'Halle genutzt'],
    // gelesen wird auch in einem Muster rechts vom =, als Vorgabe darin und hinter einem Komma
    ['const vol = await hallGitter(liste, h, f); [vol_a, vol_b] = [vol.a, vol.b];', 'Halle genutzt'],
    ['const vol = await hallGitter(liste, h, f); [vol_a = vol.a, vol_b = vol.b] = [];', 'Halle genutzt'],
    ['const vol = await hallGitter(liste, h, f); x = { k: vol.a, l: [...alt, vol.b] };', 'Halle genutzt'],
    ['const vol = await hallGitter(liste, h, f); x = (zaehl(), vol.a); y = (zaehl(), vol.b);', 'Halle genutzt'],
    ['const vol = await hallGitter(liste, h, f); for (const q of [vol.a, vol.b]) zaehl(q);', 'Halle genutzt'],
    // strenger als die Sprache: Hier ruft die Sprache das Feld ab. Es ist aber nur Ziel (++, +=, ??=), oder sein
    // Wert und was nur aus ihm gerechnet ist, fällt an Ort und Stelle weg (für sich stehend, void, links vom Komma)
    ['const vol = await hallGitter(liste, h, f); vol.a++; --vol.b;', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); vol.a += 1; vol.b ??= 1; vol.a ||= 1; vol.b &&= 1;', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); vol.a; vol.b;', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); (vol.a); ((vol.b));', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); void vol.a; void vol.b;', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); x = void vol.a; y = void (vol.b, 1);', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); typeof vol.a; typeof vol.b;', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); vol.a, vol.b, zaehl();', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); !vol.a; vol.b + 1;', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); vol.a == null; vol.a === vol.b;', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); await vol.a; await (vol.b);', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); vol.a ? 1 : 2; vol.b && zaehl(); x > 5 ? vol.a : vol.b;', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); vol.a.length; vol.b[0]; alt[vol.a];', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); [vol.a, ...alt, vol.b]; ({ k: vol.a, ...vol.b });', 'Halle verworfen', 'liest und wirft weg'],
    ['const vol = await hallGitter(liste, h, f); `${vol.a} ${vol.b}`;', 'Halle verworfen', 'liest und wirft weg'],
    // strenger als die Sprache: Diese lesen das Gitter wirklich, die Naht kennt nur die eine Schreibweise
    // const x = await … und x.a, x.b an diesem Namen
    ['hallGitter(liste, h, f).then((vol) => { x = tex(vol.a); y = tex(vol.b); });', 'Halle verworfen', 'liest wirklich'],
    ['const { a, b } = await hallGitter(liste, h, f); x = tex(a); y = tex(b);', 'Halle verworfen', 'liest wirklich'],
    ["const vol = await hallGitter(liste, h, f); x = tex(vol['a']); y = tex(vol['b']);", 'Halle verworfen', 'liest wirklich'],
    ['const vol = await hallGitter(liste, h, f); x = tex((vol).a); y = tex((vol).b);', 'Halle verworfen', 'liest wirklich'],
    ['const vol = await hallGitter(liste, h, f); const zwei = vol; x = tex(zwei.a); y = tex(zwei.b);', 'Halle verworfen', 'liest wirklich'],
    // Die Grenze der Naht (genutzt in scripts/lib/hall-gitter.mjs): Wohin ein gelesener Wert danach geht, verfolgt
    // sie nicht. Diese Formen gelten ihr als genutzt, und keine lädt das Gitter. Das sieht erst die laufende Bühne,
    // die an ihren Uniformen zurückliest (gitterDunkel, check:hangar-shader).
    ['const vol = await hallGitter(liste, h, f); const q = vol.a, r = vol.b;', 'Halle genutzt'],
    ['const vol = await hallGitter(liste, h, f); zaehl(vol.a, vol.b);', 'Halle genutzt'],
    ['const vol = await hallGitter(liste, h, f); void tex(vol.a, vol.b);', 'Halle genutzt'],
    ['const vol = await hallGitter(liste, h, f); x = typeof vol.a; y = !vol.b;', 'Halle genutzt'],
    ['const vol = await hallGitter(liste, h, f); x = vol.a.length; if (vol.b) zaehl();', 'Halle genutzt'],
    ['const vol = await hallGitter(liste, h, f); vol.a.toFixed(0); vol.b[0] = 1;', 'Halle genutzt'],
    [`const vol = await hallGitter(liste, h, f); if (x > 5) { ${LADEN} }`, 'Halle genutzt', 'läuft nie'],
  ];
  for (const [rumpf, urteil, strenger, kopf] of FORMEN) {
    assert.deepEqual(kurz(form(rumpf, kopf)), [urteil], rumpf);
    const w = await wirklich(rumpf, kopf);
    const lief = `${w.halle ? 'Halle' : 'fremd'} ${w.genutzt ? 'genutzt' : 'verworfen'}`;
    if (strenger === 'liest wirklich' || strenger === 'liest und wirft weg') { assert.equal(w.fehler, null, `${rumpf}: ${w.fehler}`); assert.equal(lief, 'Halle genutzt', rumpf); continue; }
    if (strenger === 'läuft nie') { assert.equal(w.fehler, null, `${rumpf}: ${w.fehler}`); assert.equal(lief, 'Halle verworfen', rumpf); continue; }
    if (strenger === 'bricht ab, nichts wird gelesen') { assert.ok(w.fehler instanceof ReferenceError && w.rufe === 0, rumpf); continue; }
    assert.equal(w.fehler, null, `${rumpf}: ${w.fehler}`);
    assert.equal(w.rufe, 1, rumpf);
    assert.equal(lief, urteil, rumpf);
  }

  // kein Aufruf: gestrichen, auskommentiert, in einer Zeichenkette, in einer anderen Funktion
  for (const ohne of [
    'const vol = await altesGitter(liste, h.room, f);',
    '// const vol = await hallGitter(liste, h, f);',
    'const s = "const vol = await hallGitter(liste, h, f);";',
    `return true;\n  }\n  async function anders(h) {\n    const vol = await hallGitter(liste, h, f); ${LADEN}`,
  ]) assert.deepEqual(kurz(form(ohne)), [], ohne);
  // zwei Aufrufe sind zwei: Das Tor verlangt genau einen
  assert.deepEqual(kurz(form(`const vol = await hallGitter(liste, h, f); ${LADEN} const zwei = await hallGitter(liste, g, f);`)), ['Halle genutzt', 'fremd verworfen']);
  // ohne die Funktion, ohne Parameter, mit einem Muster statt eines Namens
  assert.match(gitterAufrufe('function anders() {}').fehler.join(), /loadHallLights steht nicht im Text/);
  assert.match(form('const vol = await hallGitter(liste, h, f);', 'async function loadHallLights() {').fehler.join(), /keine Halle als ersten Parameter/);
  assert.match(form('const vol = await hallGitter(liste, h, f);', 'async function loadHallLights({ h }) {').fehler.join(), /keine Halle als ersten Parameter/);
  // ein Text, der sich nicht lesen lässt, ist keine Zählung
  assert.ok(gitterAufrufe('async function loadHallLights(h) { const vol = await hallGitter(liste, h, f; }').fehler.length > 0);
});
