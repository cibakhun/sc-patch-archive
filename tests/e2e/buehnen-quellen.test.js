// Zählung der Quellen einer Bühne (scripts/lib/buehnen-quellen.mjs, verify:hangar [24]).
//
// Die Zählung sagt, ob jede Stelle im Rumpf von initHangar, an der etwas von
// außen kommt, in einem Aufruf von lebt(…) steht. Zweimal fand das Review an
// PR #371 eine Form, die die Zählung über Zeilen und Klammern täuschte
// (15.11.2026): ein lebt( daneben, und eine Klammer in einer Zeichenkette.
// Seither liest sie den Syntaxbaum. Die Fälle hier sind die Negativproben.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buehnenQuellen } from '../../scripts/lib/buehnen-quellen.mjs';

const buehne = (rumpf) => `const draussen = () => fetch('/nie');\nexport async function initHangar(el, h) {\n${rumpf}\n}\n`;
const kurz = (rumpf, o) => { const r = buehnenQuellen(buehne(rumpf), o); return { fehler: r.fehler.length, q: r.quellen.map((x) => `${x.art}${x.geschuetzt ? ' +' : ' -'}`) }; };

test('jede Quellform wird gefunden; in lebt(…) ist sie geschützt', () => {
  const r = kurz(`
    const a = await lebt(fetch(h.lights));
    const m = await lebt(import('./modul.js'));
    const b = await lebt(createImageBitmap(blob));
    const i = await lebt(new Promise((r) => { const img = new Image(); img.onload = () => r(img); }));
    const g = await lebt(loader.loadAsync(url));
    lebt(new Promise((r) => schrift.load(url, r)));`);
  assert.deepEqual(r, { fehler: 0, q: ['fetch +', 'import +', 'createImageBitmap +', 'new Image +', '.loadAsync +', '.load +'] });
});

test('ohne lebt(…) ist sie ungeschützt; was außerhalb der Funktion steht, zählt nicht', () => {
  assert.deepEqual(kurz('const r = await fetch(h.lights);'), { fehler: 0, q: ['fetch -'] });
  // das fetch der ersten Zeile des Moduls (draussen) gehört nicht zur Bühne
  assert.deepEqual(kurz('return 1;'), { fehler: 0, q: [] });
});

test('ein lebt(…) daneben schützt nicht', () => {
  assert.deepEqual(kurz('const r = await lebt(null) ?? await fetch(h.lights);').q, ['fetch -']);
  assert.deepEqual(kurz('await lebt(warte); const r = await fetch(h.lights);').q, ['fetch -']);
  // die Fortsetzung hinter lebt(…) läuft, nachdem lebt geantwortet hat: Sie steht in keinem seiner Argumente
  assert.deepEqual(kurz('lebt(a).then(() => fetch(b));').q, ['fetch -']);
});

test('eine Klammer in einer Zeichenkette, einem Muster oder einem Kommentar hält den Schutz nicht offen', () => {
  // der Fall aus dem Review: Die Klammerzählung blieb nach '(' in der Zeichenkette offen
  assert.deepEqual(kurz("await lebt(Promise.resolve('(')); const r = await fetch(url);").q, ['fetch -']);
  assert.deepEqual(kurz('await lebt(Promise.resolve("((")); const r = await fetch(url);').q, ['fetch -']);
  assert.deepEqual(kurz('await lebt(Promise.resolve(`(${x}(`)); const r = await fetch(url);').q, ['fetch -']);
  assert.deepEqual(kurz("await lebt(s.replace(/\\(/g, '')); const r = await fetch(url);").q, ['fetch -']);
  assert.deepEqual(kurz('await lebt(x /* ( */); const r = await fetch(url);').q, ['fetch -']);
});

test('ein Wort in einem Kommentar oder einer Zeichenkette ist keine Quelle', () => {
  const r = kurz(`
    // hier stand einmal fetch(h.lights) und loader.load(url)
    const hinweis = 'fetch(url) und import(x) und new Image()';
    /* createImageBitmap(bild) */
    return hinweis;`);
  assert.deepEqual(r, { fehler: 0, q: [] });
});

test('ein Aufruf über mehrere Zeilen bleibt einer; die Zeile ist die, in der die Quelle beginnt', () => {
  const r = buehnenQuellen(buehne('  const a = await lebt(\n    fetch(\n      h.lights,\n    ),\n  );'));
  assert.equal(r.quellen.length, 1);
  assert.equal(r.quellen[0].geschuetzt, true);
  assert.equal(r.quellen[0].zeile, 4);
  assert.equal(r.quellen[0].text.trim(), 'fetch(');
});

test('jede Quelle trägt ihren eigenen Text: Zwei Quellen einer Zeile sind zwei Knoten', () => {
  // der Fall aus dem Review (neunte Runde): ein Abruf auf der Zeile einer benannten Ausnahme. Das Tor band die
  // Ausnahme an die Zeile, der zweite Abruf galt mit. Es bindet sie seither an knoten.
  const r = buehnenQuellen(buehne("try { bild = await createImageBitmap(renderer.domElement); } catch { return null; } fetch('/spaet');"));
  assert.deepEqual(r.quellen.map((q) => [q.knoten, q.geschuetzt]), [['createImageBitmap(renderer.domElement)', false], ["fetch('/spaet')", false]]);
  assert.equal(r.quellen[0].text, r.quellen[1].text);
  // über mehrere Zeilen: der ganze Aufruf, nicht nur seine erste Zeile
  const m = buehnenQuellen(buehne('loader.load(url, (g) => {\n  resolve(g);\n}, undefined, reject);'));
  assert.equal(m.quellen[0].knoten, 'loader.load(url, (g) => {\n  resolve(g);\n}, undefined, reject)');
});

test('nur der blanke Aufruf zählt als Abruf, ein gleichnamiges Glied nicht; Schutz und Funktion sind wählbar', () => {
  assert.deepEqual(kurz('const r = await zwischenlager.fetch(schluessel);').q, []);
  assert.deepEqual(kurz('const r = await wach(fetch(u));', { schutz: 'wach' }).q, ['fetch +']);
  assert.deepEqual(kurz('const r = await wach(fetch(u));').q, ['fetch -']);
});

test('ein Text, der sich nicht lesen lässt, oder ohne die Funktion ist keine Zählung', () => {
  assert.ok(buehnenQuellen('export async function initHangar( {').fehler.length > 0);
  const ohne = buehnenQuellen('export function anders() { return fetch(1); }');
  assert.deepEqual(ohne.quellen, []);
  assert.match(ohne.fehler.join(' '), /initHangar steht nicht im Text/);
});

test('der Viewer des Repos: lesbar, und jede ungeschützte Quelle ist eine der vier benannten Ausnahmen des Tors', () => {
  const r = buehnenQuellen(readFileSync(new URL('../../assets/hangar-viewer.js', import.meta.url), 'utf8'));
  assert.deepEqual(r.fehler, []);
  const geschuetzt = r.quellen.filter((q) => q.geschuetzt).length, ohne = r.quellen.filter((q) => !q.geschuetzt);
  // Selbstauskunft: dieselbe Klinke wie GROESSE.quellen in scripts/verify-hangar.mjs
  assert.ok(geschuetzt >= 23, `nur ${geschuetzt} Quellen hinter lebt()`);
  assert.equal(ohne.length, 4, ohne.map((q) => `${q.zeile}: ${q.text.trim().slice(0, 80)}`).join('\n'));
  // jede der vier beginnt anders: Nur so kann eine Ausnahme genau eine von ihnen meinen
  assert.equal(new Set(ohne.map((q) => q.knoten.slice(0, 30))).size, 4);
});
