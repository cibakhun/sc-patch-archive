// Einleitungssatz der englischen Item-Seiten: grammatisch fuer jedes Item.
//
// Anlass 04.11.2026 (Datenqualitaets-Audit): die Satzvorlage
// "<Name> is a <Hersteller> <Art> in Star Citizen Alpha …" nahm als Art die
// Blatt-Kategorie, und die ist oft ein Plural: "The ADP Legs Aqua is a Clark
// Defense Systems Legs", "The Calico Arms Desert is a Kastak Arms Arms" —
// 2.597 der 5.369 EN-Item-Seiten (3.239 Items der DB; gegen den alten
// Satz rot mit genau dieser Zahl). Gleiche Klasse wie "The The Butcher Helmet": eine
// Vorlage, die auf eine Form der Daten trifft, die sie nicht erwartet.
//
// Geprueft wird fuer JEDES Item der DB (keine Stichprobe, keine festen
// Namen): nach "is a/an …" steht nie ein Plural aus den Kategorien der
// Daten, und nie "The The".
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function bundle(entries) {
  const { buildSync } = await import('esbuild');
  const src = entries.map((e) => `export * from ${JSON.stringify(path.resolve(e))};`).join('\n');
  const out = buildSync({
    stdin: { contents: src, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'item-satz-'));
  const file = path.join(dir, 'mod.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const M = await bundle(['src/lib/itemSeo.ts', 'src/lib/items.ts']);
const ITEMS = M.db.items;

describe('Item-Einleitung EN', () => {
  // Plurale aus den Kategorien der Daten ("Legs", "Helmets", "Undersuits"),
  // nicht aus einer Liste im Test: kommt eine neue Kategorie dazu, gilt sie mit.
  // Nur ein gross geschriebenes Wort auf -s: "mobiGlas" ist ein Produktname
  // in der Einzahl (erste Fassung meldete 20 mobiGlas-Huellen falsch).
  const plurale = new Set(ITEMS.map((i) => M.leafCategory(i.category)).filter((c) => /^[A-Z][a-z]*[^s]s$/.test(c)));

  test('nach "is a/an" steht kein Plural aus den Kategorien', () => {
    assert.ok(ITEMS.length >= 9000, `nur ${ITEMS.length} Items (Klinke 9.000)`);
    assert.ok(plurale.size >= 10, `nur ${plurale.size} Plural-Kategorien — die Pruefung liefe leer`);
    const falsch = [];
    let saetze = 0;
    for (const i of ITEMS) {
      const lead = M.itemSeo(i, 'en').lead;
      const m = /\bis an? (.+?) in Star Citizen Alpha/.exec(lead);
      if (!m) continue;
      saetze++;
      const letztes = m[1].split(' ').pop();
      if (plurale.has(letztes)) falsch.push(`${i.name}: „${lead.slice(0, m.index + m[0].length)}"`);
    }
    assert.ok(saetze >= 9000, `nur ${saetze} Saetze mit "is a/an" geprueft`);
    assert.equal(falsch.length, 0, `${falsch.length} EN-Einleitungen mit Plural nach "is a":\n${falsch.slice(0, 5).join('\n')}`);
  });

  test('kein "The The" aus der Satzvorlage', () => {
    for (const i of ITEMS) {
      const lead = M.itemSeo(i, 'en').lead;
      assert.ok(!/\bThe The\b/.test(lead), `${i.name}: ${lead.slice(0, 80)}`);
    }
  });
});
