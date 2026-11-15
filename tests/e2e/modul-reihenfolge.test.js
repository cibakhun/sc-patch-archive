// Reihenfolge im Lauf eines Moduls (scripts/lib/modul-reihenfolge.mjs).
//
// scripts/extract-hangar-sources.mjs läuft auf oberster Ebene: Die
// Hallenschleife wartet dort auf Funktionen, die weiter unten stehen.
// Funktionen sind von Anfang an da, const und let erst an ihrer Zeile. Eine
// Konstante hinter der Schleife, die eine dieser Funktionen liest, bricht den
// Auszug beim ersten Aufruf ab („Cannot access … before initialization“). Genau
// das stand am 15.11.2026 in PR #371 (MTL_FRISCH), gefunden vom Review: Der
// Auszug läuft nur am Rechner mit den Quelldateien, kein Tor fährt ihn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zuFruehGelesen } from '../../scripts/lib/modul-reihenfolge.mjs';

const funde = (text) => zuFruehGelesen(text).funde.map((f) => `${f.name}@${f.zeile} von ${f.lauf} über ${f.weg.join('<')}`);

test('der Fall aus dem Review: Der Lauf wartet auf eine Funktion, die eine später erklärte Konstante liest', () => {
  const text = 'await f();\nconst X = new Set();\nasync function f() { X.add(1); }\n';
  assert.deepEqual(funde(text), ['X@2 von 1 über f<X']);
  // dieselbe Form läuft wirklich in den Fehler (ohne await, damit sie hier als Funktion läuft)
  assert.throws(() => new Function('f();\nconst X = new Set();\nfunction f() { X.add(1); }')(), ReferenceError);
});

test('steht die Konstante vor dem Lauf, ist nichts zu früh', () => {
  assert.deepEqual(funde('const X = new Set();\nawait f();\nasync function f() { X.add(1); }\n'), []);
  // erklärt und im selben Zug gelesen ist nicht davor
  assert.deepEqual(funde('const X = f();\nfunction f() { return 1; }\n'), []);
});

test('der Weg über weitere Funktionen zählt, auch über eine Pfeilfunktion', () => {
  const text = 'const g = () => h();\nif (g()) console.log(1);\nconst X = 1;\nfunction h() { return X; }\n';
  assert.deepEqual(funde(text), ['X@3 von 2 über g<h<X']);
});

test('ein direkter Griff davor zählt; let und class wie const, var und function nicht', () => {
  assert.deepEqual(funde('console.log(X);\nlet X = 1;\n'), ['X@2 von 1 über X']);
  assert.deepEqual(funde('new K();\nclass K {}\n'), ['K@2 von 1 über K']);
  assert.deepEqual(funde('console.log(X);\nvar X = 1;\n'), []);
  assert.deepEqual(funde('f();\nfunction f() {}\n'), []);
});

test('ein Gliedname oder ein Schlüssel ist kein Griff, die Kurzform schon', () => {
  assert.deepEqual(funde('console.log(a.X, { X: 1 });\nconst X = 1;\nconst a = {};\n').filter((f) => f.startsWith('X@')), []);
  assert.deepEqual(funde('console.log({ X });\nconst X = 1;\n'), ['X@2 von 1 über X']);
});

// Neunte Runde des Reviews an PR #371: drei Formen, die wirklich in den Fehler laufen und die die erste Fassung
// nicht sah. Jede Form fährt hier einmal wirklich (new Function), damit die Erwartung nicht nur behauptet ist.
const wirft = (text) => assert.throws(() => new Function(text)(), ReferenceError, text);
const laeuft = (text) => assert.doesNotThrow(() => new Function(text)(), text);

test('in derselben Erklärung läuft der Anfangswert vor der Erklärung', () => {
  for (const [text, erwartet] of [
    ['const X = f();\nfunction f() { return X; }\n', ['X@1 von 1 über f<X']],
    ['const a = b, b = 1;\n', ['b@1 von 1 über b']],
    ['const X = X + 1;\n', ['X@1 von 1 über X']],
    ['const g = () => X;\nconst X = g();\n', ['X@2 von 2 über g<X']],
  ]) { assert.deepEqual(funde(text), erwartet, text); wirft(text); }
  // richtig herum, und eine Funktion, die nichts davon liest
  for (const text of ['const a = 1, b = a;\n', 'const X = f();\nfunction f() { return 1; }\n']) { assert.deepEqual(funde(text), [], text); laeuft(text); }
  // die übliche Form: Die Funktion im eigenen Anfangswert läuft erst später (bewusst milde, siehe Kopf der Prüfung)
  assert.deepEqual(funde('const t = setTimeout(() => clearTimeout(t), 1);\n'), []);
});

test('eine Klasse wertet schon bei ihrer Erklärung aus: Erbe, berechnete Namen, statische Felder und Blöcke', () => {
  for (const [text, erwartet] of [
    ['class K { static wert = X; }\nconst X = 1;\n', ['X@2 von 1 über X']],
    ['class K { static { X; } }\nconst X = 1;\n', ['X@2 von 1 über X']],
    ['class K { [X]() {} }\nconst X = 1;\n', ['X@2 von 1 über X']],
    ['class K extends X {}\nconst X = class {};\n', ['X@2 von 1 über X']],
    ['class K extends K {}\n', ['K@1 von 1 über K']],
    // über eine Funktion, die das statische Feld ruft
    ['class K { static wert = f(); }\nconst X = 1;\nfunction f() { return X; }\n', ['X@2 von 1 über f<X']],
  ]) { assert.deepEqual(funde(text), erwartet, text); wirft(text); }
});

test('Methoden, Konstruktor und Felder einer Instanz laufen erst, wenn jemand die Klasse benutzt', () => {
  const spaeter = 'class K { m() { return X; } f = X; constructor() { X; } }\nconst X = 1;\nnew K().m();\n';
  assert.deepEqual(funde(spaeter), []);
  laeuft(spaeter);
  // wer die Klasse davor benutzt, erreicht die Konstante über sie
  const davor = 'class K { f = X; }\nnew K();\nconst X = 1;\n';
  assert.deepEqual(funde(davor), ['X@3 von 2 über K<X']);
  wirft(davor);
  // in statischen Feldern gibt es den eigenen Namen schon
  const selbst = 'class K { static eins = new K(); }\n';
  assert.deepEqual(funde(selbst), []);
  laeuft(selbst);
});

test('Standardwerte laufen mit: im Muster einer Erklärung und an den Parametern einer Funktion', () => {
  for (const [text, erwartet] of [
    ['const { a = X } = {};\nconst X = 1;\n', ['X@2 von 1 über X']],
    ['const [a = X] = [];\nconst X = 1;\n', ['X@2 von 1 über X']],
    ['const { [X]: a } = {};\nconst X = "k";\n', ['X@2 von 1 über X']],
    ['f();\nfunction f(a = X) {}\nconst X = 1;\n', ['X@3 von 1 über f<X']],
    ['const g = (a = X) => a;\ng();\nconst X = 1;\n', ['X@3 von 2 über g<X']],
  ]) { assert.deepEqual(funde(text), erwartet, text); wirft(text); }
  // ein Standardwert darf einen Namen desselben Musters lesen, wenn es ihn schon gibt: Ein Muster läuft Glied für Glied
  const muster = 'const { a, b = a } = { a: 1 };\n';
  assert.deepEqual(funde(muster), []);
  laeuft(muster);
  const dahinter = 'const { b = a, a } = { a: 1 };\n';
  assert.deepEqual(funde(dahinter), ['a@1 von 1 über a']);
  wirft(dahinter);
});

// Zehnte Runde des Reviews an PR #371: Eine Klasse hat ihren Namen zweimal. Im Innern gibt es ihn schon, wenn
// die statischen Felder laufen; für das Modul gibt es ihn erst, wenn sie durch sind. Eine Funktion des Moduls,
// die ein statisches Feld ruft, liest den äußeren.
test('der Name einer Klasse: im Innern schon in den statischen Teilen da, für das Modul erst danach', () => {
  for (const [text, erwartet] of [
    ['function liesK() { return K; }\nclass K { static wert = liesK(); }\n', ['K@2 von 2 über liesK<K']],
    ['class K { static { liesK(); } }\nfunction liesK() { return K; }\n', ['K@1 von 1 über liesK<K']],
    ['function liesK() { return K; }\nconst K = class { static wert = liesK(); };\n', ['K@2 von 2 über liesK<K']],
    // die Klasse benutzt sich in einem statischen Feld selbst (ihr Name, this): Dann läuft dort schon, was ihre Glieder lesen
    ['class K { static eins = new K(); constructor() { melde(this); } }\nfunction melde(o) { return o instanceof K; }\n', ['K@1 von 1 über melde<K']],
    ['class K { static m() { return X; } static w = this.m(); }\nconst X = 1;\n', ['X@2 von 1 über K<X']],
  ]) { assert.deepEqual(funde(text), erwartet, text); wirft(text); }
  // der Kontrollfall aus dem Review und seine Verwandten: Im Innern ist der eigene Name kein Griff davor
  for (const text of ['class K { static wert = K; }\n', 'class K { static eins = new K(); }\n', 'const K = class K { static wert = K; };\n', 'class K { static f = () => K; }\nK.f();\n']) {
    assert.deepEqual(funde(text), [], text);
    laeuft(text);
  }
  // eine Klasse ohne Namen (läuft nur als Modul, deshalb hier ohne Lauf): this erreicht ihre Glieder trotzdem
  assert.deepEqual(funde('export default class { static m() { return X; } static w = this.m(); }\nconst X = 1;\n'), ['X@2 von 1 über X']);
  assert.deepEqual(funde('export default class { static m() { return X; } static w = 1; }\nconst X = 1;\n'), []);
});

test('in derselben Anweisung zählt ein früherer Anfangswert wie eine frühere Anweisung, der eigene nur mit dem, was sofort läuft', () => {
  for (const [text, erwartet] of [
    ['const a = [1].map(() => b), b = 1;\n', ['b@1 von 1 über b']],
    ['const f = () => g(), h = f(), g = () => 1;\n', ['g@1 von 1 über f<g']],
    // an Ort und Stelle gerufen läuft die Funktion auch im eigenen Anfangswert
    ['const x = (() => x)();\n', ['x@1 von 1 über x']],
  ]) { assert.deepEqual(funde(text), erwartet, text); wirft(text); }
  for (const text of ['const f = () => g(), g = () => 1;\nf();\n', 'const it = (function* () { yield it; })();\nit.next();\n']) { assert.deepEqual(funde(text), [], text); laeuft(text); }
});

test('eine Stelle, die einen Namen nur trägt, ist kein Griff', () => {
  for (const text of [
    'const o = { get X() { return 1; } };\nconst X = 2;\n',
    'class C { get X() { return 1; } set X(v) {} static X() {} }\nnew C();\nconst X = 2;\n',
    'X: for (;;) { break X; }\nconst X = 2;\n',
    'function f() { return new.target; }\nf();\nconst target = 1;\n',
    '/** @type {X} */\nconst a = 1;\nconst X = 2;\n',
  ]) { assert.deepEqual(funde(text), [], text); laeuft(text); }
  // läuft nur als Modul, deshalb hier ohne Lauf
  assert.deepEqual(funde('const u = import.meta.url;\nconst meta = 1;\n'), []);
});

// Die Prüfung gegen den Lauf selbst. Drei Runden des Reviews fanden je eine Form, die die Prüfung anders las als
// die Sprache. Deshalb steht hier jede Form, die sie kennt, neben dem, was der Lauf wirklich tut (new Function):
//   gleich  sie meldet genau dann einen Fund, wenn der Lauf in den Fehler geht
//   streng  der Lauf geht durch, sie meldet trotzdem (mit Grund)
//   milde   der Lauf geht in den Fehler, sie meldet nichts (mit Grund)
// Eine Abweichung ohne Grund gibt es nicht, und eine benannte Abweichung reißt, sobald sie nicht mehr stimmt.
const WEITERGEREICHT = 'eine Funktion, die eine frühere Stelle nur weiterreicht, gilt als gerufen';
const KLASSE_BENUTZT = 'wer eine Klasse benutzt, erreicht alles, was sie liest';
const NACH_NAMEN = 'gelesen wird nach Namen, ohne Geltungsbereiche';
const LAUF = [
  // der Name einer Klasse, innen und außen
  ['gleich', 'function liesK() { return K; }\nclass K { static wert = liesK(); }\n'],
  ['gleich', 'function baue() { return new K(); }\nclass K { static eins = baue(); }\n'],
  ['gleich', 'class K { static { liesK(); } }\nfunction liesK() { return K; }\n'],
  ['gleich', 'class K extends K {}\n'],
  ['gleich', 'class K { static [K] = 1; }\n'],
  ['gleich', 'function liesK() { return K; }\nconst K = class { static wert = liesK(); };\n'],
  ['gleich', 'const K = class { static wert = K; };\n'],
  ['gleich', 'class K { static wert = K; }\n'],
  ['gleich', 'class K { static eins = new K(); }\n'],
  ['gleich', 'class K { static f = () => K; }\nK.f();\n'],
  ['gleich', 'class K { static f = () => this; }\nK.f();\n'],
  ['gleich', 'class K { static w = (() => K)(); }\n'],
  ['gleich', 'const K = class K { static wert = K; };\n'],
  ['gleich', 'const A = class K { static wert = K; };\n'],
  ['gleich', 'class K {}\nclass L extends K { static w = new K(); }\n'],
  ['gleich', 'function erbe() { return K; }\nclass K extends erbe() {}\n'],
  ['gleich', 'class A { static w = new B(); }\nclass B {}\n'],
  ['gleich', 'var K = class { static w = liesK(); };\nfunction liesK() { return K; }\n'],
  // die Klasse benutzt sich in ihren statischen Teilen selbst
  ['gleich', 'class K { static m() { return X; } static w = this.m(); }\nconst X = 1;\n'],
  ['gleich', 'class K { static m() { return X; } static w = K.m(); }\nconst X = 1;\n'],
  ['gleich', 'class K { static { this.m(); } static m() { return X; } }\nconst X = 1;\n'],
  ['gleich', 'class K { static w = new this(); constructor() { X; } }\nconst X = 1;\n'],
  ['gleich', 'class K { static eins = new K(); constructor() { melde(this); } }\nfunction melde(o) { return o instanceof K; }\n'],
  ['gleich', 'class K { static w = this.m(); static m() { return f(); } }\nfunction f() { return K; }\n'],
  ['gleich', 'class K { static f = () => liesK(); static w = K.f(); }\nfunction liesK() { return K; }\n'],
  ['gleich', 'class K { static w = K.m(); static m() { return 1; } }\n'],
  ['gleich', 'const X = class K { static m() { return X; } static w = this.m(); };\n'],
  ['gleich', 'class A { static m() { return X; } }\nclass B extends A { static w = super.m(); }\nconst X = 1;\n'],
  ['streng', 'class K { static a = 1; static b = this.a + 1; m() { return X; } }\nconst X = 1;\nnew K().m();\n', KLASSE_BENUTZT],
  ['streng', 'class Vek { static NULL = new Vek(); plus() { return vek(); } }\nfunction vek() { return new Vek(); }\nVek.NULL.plus();\n', KLASSE_BENUTZT],
  // dieselbe Anweisung
  ['gleich', 'const X = f();\nfunction f() { return X; }\n'],
  ['gleich', 'const a = b, b = 1;\n'],
  ['gleich', 'const a = 1, b = a;\n'],
  ['gleich', 'let a = 1, b = a;\n'],
  ['gleich', 'const a = [1].map(() => b), b = 1;\n'],
  ['gleich', 'const a = () => b, b = a();\n'],
  ['gleich', 'const a = () => b, b = 1;\na();\n'],
  ['gleich', 'const f = () => g(), g = () => 1;\nf();\n'],
  ['gleich', 'const f = () => g(), h = f(), g = () => 1;\n'],
  ['streng', 'const t = setTimeout(() => u, 1), u = 2;\n', WEITERGEREICHT],
  // der eigene Anfangswert
  ['gleich', 'const x = (() => x)();\n'],
  ['gleich', 'const x = (function () { return x; })();\n'],
  ['gleich', 'const it = (function* () { yield it; })();\nit.next();\n'],
  ['gleich', 'const p = (async () => { await 0; void p; })();\n'],
  ['gleich', 'const t = setTimeout(() => clearTimeout(t), 1);\n'],
  ['milde', 'const xs = [1].map(() => xs);\n', 'im eigenen Anfangswert zählt der Rumpf einer dort geschriebenen Funktion nicht, sonst wäre die Zeile darüber ein Fund'],
  // Muster
  ['gleich', 'const { b = a, a } = { a: 1 };\n'],
  ['gleich', 'const { a, b = a } = { a: 1 };\n'],
  ['gleich', 'const { a = a } = {};\n'],
  ['gleich', 'const [a = b, b] = [];\n'],
  ['gleich', 'const { x: { y = z }, z } = { x: {}, z: 1 };\n'],
  ['gleich', 'const { [a]: c, a } = { a: "k" };\n'],
  ['gleich', 'const { a, [a]: c } = { a: "k", k: 1 };\n'],
  ['gleich', 'const { a = () => b, b } = {};\na();\n'],
  ['gleich', 'const { a = (() => b)(), b } = {};\n'],
  ['gleich', 'const { a = X } = {};\nconst X = 1;\n'],
  // frühere Anweisungen
  ['gleich', 'f();\nconst X = new Set();\nfunction f() { X.add(1); }\n'],
  ['gleich', 'const X = new Set();\nf();\nfunction f() { X.add(1); }\n'],
  ['gleich', 'typeof X;\nconst X = 1;\n'],
  ['gleich', 'X = 1;\nlet X;\n'],
  ['gleich', 'lege();\nlet ablage;\nfunction lege() { ablage = new Map(); }\n'],
  ['gleich', 'console.log;\nvar X = 1;\nX;\n'],
  ['gleich', 'class K { f = X; }\nnew K();\nconst X = 1;\n'],
  ['gleich', 'class K { m() { return X; } f = X; constructor() { X; } }\nconst X = 1;\nnew K().m();\n'],
  ['gleich', 'f();\nfunction f(a = X) {}\nconst X = 1;\n'],
  ['streng', 'setTimeout(() => X, 1);\nconst X = 1;\n', WEITERGEREICHT],
  ['streng', '(async () => { await 0; X; })();\nconst X = 1;\n', 'eine async-Funktion läuft nach ihrem ersten await erst später weiter, gezählt wird ihr ganzer Rumpf'],
  ['streng', 'const o = { m() { return X; } };\nconst X = 1;\no.m();\n', WEITERGEREICHT],
  ['streng', 'const o = { get a() { return X; } };\nconst X = 1;\no.a;\n', WEITERGEREICHT],
  // Namen
  ['gleich', 'const o = { get X() { return 1; } };\nconst X = 2;\n'],
  ['gleich', 'X: for (;;) { break X; }\nconst X = 2;\n'],
  ['gleich', 'function f() { return new.target; }\nf();\nconst target = 1;\n'],
  ['gleich', 'function f() { const X = 2; return 1; }\nf();\nconst X = 1;\n'],
  ['streng', 'function f(X) { return X; }\nf();\nconst X = 1;\n', NACH_NAMEN],
  ['streng', 'for (const X of [1]) X;\nconst X = 2;\n', NACH_NAMEN],
  ['streng', 'try { throw 1; } catch (X) { X; }\nconst X = 2;\n', NACH_NAMEN],
];

test(`die Prüfung gegen den Lauf selbst: ${LAUF.length} Formen, jede Abweichung benannt`, () => {
  const zahl = { gleich: 0, streng: 0, milde: 0 };
  let fehler = 0;
  for (const [art, text, grund] of LAUF) {
    let durch = true;
    try { new Function(text)(); } catch (e) { assert.ok(e instanceof ReferenceError, `${JSON.stringify(text)} läuft in einen anderen Fehler: ${e}`); durch = false; }
    const fund = funde(text).length > 0;
    const stand = `${JSON.stringify(text)}: Der Lauf geht ${durch ? 'durch' : 'in den Fehler'}, die Prüfung meldet ${fund ? `„${funde(text)[0]}“` : 'nichts'}`;
    assert.ok(art in zahl, `${JSON.stringify(text)}: unbekannte Art „${art}“`);
    if (art === 'gleich') assert.equal(fund, !durch, stand);
    else {
      assert.ok(grund, `${JSON.stringify(text)}: Abweichung ohne Grund`);
      assert.ok(art === 'streng' ? durch && fund : !durch && !fund, `${stand}. Als „${art}“ benannt (${grund}), das stimmt nicht mehr`);
    }
    zahl[art]++;
    if (!durch) fehler++;
  }
  // Selbstauskunft: Die Tabelle hat beide Sorten in Menge, und die Abweichungen bleiben wenige
  assert.ok(fehler >= 30, `nur ${fehler} Formen laufen in den Fehler`);
  assert.ok(zahl.gleich - (fehler - zahl.milde) >= 20, `nur ${zahl.gleich - (fehler - zahl.milde)} Formen laufen durch und bleiben ohne Fund`);
  assert.ok(zahl.milde <= 1, `${zahl.milde} Formen als milde benannt: Jede weitere ist eine Lücke, die erst begründet sein will`);
});

test('die Stelle, die einen Namen erklärt, ist kein Griff, eine Ausfuhrliste auch nicht', () => {
  for (const text of ['function f() { const X = 2; return 1; }\nf();\nconst X = 1;\n', 'function f(X) { return 1; }\nf();\nconst X = 1;\n']) { assert.deepEqual(funde(text), [], text); laeuft(text); }
  assert.deepEqual(funde('export { X };\nconst X = 1;\n'), []);
  // gelesen wird weiter nach Namen: Liest die Funktion ihren eigenen gleichnamigen Namen, zählt das mit (zu streng)
  assert.deepEqual(funde('function f(X) { return X; }\nf();\nconst X = 1;\n'), ['X@3 von 2 über f<X']);
});

test('ein Text, der sich nicht lesen lässt, meldet das', () => {
  assert.ok(zuFruehGelesen('const = ;').fehler.length > 0);
});

// Der Auszug und die beiden Bauskripte der Hallen laufen auf oberster Ebene und nur mit den Quelldateien
// oder am Rechner mit dem Spiel. Je Datei die Untergrenze der gelesenen Erklärungen (Selbstauskunft: Die
// Prüfung hat das Modul wirklich gelesen).
for (const [datei, mindestens] of [['scripts/extract-hangar-sources.mjs', 25], ['scripts/build-hangar-assets.mjs', 90], ['scripts/build-hall-furniture.mjs', 8]]) {
  test(`${datei}: Kein Lauf liest eine Konstante vor ihrer Erklärung`, () => {
    const r = zuFruehGelesen(readFileSync(new URL(`../../${datei}`, import.meta.url), 'utf8'));
    assert.deepEqual(r.fehler, []);
    assert.ok(r.erklaerungen >= mindestens, `nur ${r.erklaerungen} Erklärungen der obersten Ebene gelesen (Untergrenze ${mindestens})`);
    assert.deepEqual(r.funde.map((f) => `${f.name} (Zeile ${f.zeile}) über ${f.weg.join(' <- ')}, erreicht von Zeile ${f.lauf}`), []);
  });
}
