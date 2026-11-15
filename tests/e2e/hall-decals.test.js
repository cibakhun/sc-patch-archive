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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lageOhneMessung, mtlQuelle } from '../../scripts/lib/hall-decals.mjs';

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
