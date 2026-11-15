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
