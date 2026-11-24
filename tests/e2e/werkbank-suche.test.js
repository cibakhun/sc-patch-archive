// Die Suche der Crafting-Werkbank verzeiht Tippfehler und kennt deutsche
// Gattungswoerter (24.11.2026, UX-Audit HE P02, Nachtrag zu Paket B).
//
// Anlass: Die Kopfsuche fand „karna gewehr" und „Karna Rifel" seit #431, die
// Liste der Werkbank (/topics/crafting.html) fand beides nicht: sie verglich
// die ganze Eingabe als eine Zeichenkette mit je einem Feld der Karte.
// Gemessen vorher auf staging: „karna gewehr" 0, „Karna Rifel" 0,
// „Arclight Pistl" 0, „rüstung helm" 0 Treffer.
//
// Geprueft am echten assets/crafting-app.js (Attrappe
// tests/e2e/helpers/crafting-dom.js) mit der echten Tabelle GATTUNG aus
// src/lib/searchAliases.ts, so wie CraftingApp.astro sie uebergibt. Dazu:
// norm, abstand und erlaubt sind Kopien aus assets/search-overlay.js und
// muessen es bleiben, sonst verzeihen beide Suchen verschieden.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeBrowser } from './helpers/crafting-dom.js';

async function bundle(entry) {
  const { buildSync } = await import('esbuild');
  const out = buildSync({
    stdin: { contents: `export * from ${JSON.stringify(path.resolve(entry))};`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'werkbank-suche-'));
  const file = path.join(dir, 'mod.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}
const { GATTUNG } = await bundle('src/lib/searchAliases.ts');
// Wie CraftingApp.astro (window.__CRAFT.gattung).
const gattung = GATTUNG.map(([re, w]) => [re.source, w]);

// Karten wie im Katalog: Name, Kategorie-Schluessel, ganzer Pfad aus der DB.
const KARTEN = [
  { slug: 'karna-fate-rifle', name: 'Karna "Fate" Rifle', top: 'Weapons', sub: 'Rifle', res: ['Copper', 'Tin', 'Iron'] },
  { slug: 'p4-ar-blacklist-rifle', name: 'P4-AR "Blacklist" Rifle', top: 'Weapons', sub: 'Rifle', res: ['Copper', 'Iron'] },
  { slug: 'arclight-herrero-pistol', name: 'Arclight "Herrero" Pistol', top: 'Weapons', sub: 'Pistol', res: ['Tin'] },
  { slug: 'deadrig-shotgun', name: 'Deadrig Shotgun', top: 'Weapons', sub: 'Shotgun', res: ['Iron'] },
  { slug: 'antium-core', name: 'Antium Core', top: 'Armour', sub: 'Hunter', category: 'Armour / Hunter / Heavy', res: ['Aluminum'] },
  // Sechs Zutaten: die sechste steht nicht in der Karte (hoechstens fuenf
  // Chips), die Suche kennt sie erst, wenn die DB geladen ist.
  { slug: 'bracer', name: 'Bracer', top: 'Vehiclegear', sub: 'Cooler', res: ['Tungsten', 'Copper', 'Tin', 'Iron', 'Aluminum', 'Quantainium'] },
];
const ALLE = KARTEN.map((k) => k.slug);

async function seite() {
  const browser = makeBrowser({ blueprints: KARTEN, gattung });
  const tab = browser.open();
  await browser.settle();
  return { browser, tab };
}
async function suche(q) {
  const { tab } = await seite();
  tab.search(q);
  const v = tab.visible();
  assert.equal(tab.count(), String(v.length), `Zahl ueber der Liste zu „${q}"`);
  return v;
}

describe('Werkbank-Suche: Kopien aus der Kopfsuche', () => {
  const quelle = (datei) => fs.readFileSync(path.resolve(datei), 'utf8');
  const kopf = quelle('assets/search-overlay.js');
  const werkbank = quelle('assets/crafting-app.js');
  const STUECKE = {
    norm: /\n  var norm = function \(s\) \{\n[\s\S]*?\n  \};\n/,
    abstand: /\n  function abstand\(q, w, k\) \{\n[\s\S]*?\n  \}\n/,
    erlaubt: /\n  var erlaubt = function \(q\) \{[^\n]*\};\n/,
  };
  for (const [name, re] of Object.entries(STUECKE)) {
    test(`${name} ist in beiden Skripten woertlich gleich`, () => {
      const a = re.exec(kopf);
      const b = re.exec(werkbank);
      assert.ok(a, `${name} fehlt in assets/search-overlay.js`);
      assert.ok(b, `${name} fehlt in assets/crafting-app.js`);
      assert.equal(b[0], a[0], `${name}: assets/crafting-app.js weicht von assets/search-overlay.js ab`);
    });
  }
  test('GATTUNG kommt ohne eigene Flags aus (das Skript baut jede Zeile mit „i")', () => {
    assert.ok(GATTUNG.length >= 30, `nur ${GATTUNG.length} Zeilen in GATTUNG`);
    for (const [re] of GATTUNG) assert.equal(re.flags, 'i', `${re} traegt die Flags „${re.flags}"`);
    console.log(`  ${GATTUNG.length} Gattungszeilen an die Werkbank uebergeben`);
  });
});

describe('Werkbank-Suche am echten Skript', () => {
  test('deutsche Gattungswoerter: „karna gewehr", „gewehr", „schrotflinte", „rüstung", „kühler"', async () => {
    assert.deepEqual(await suche('karna gewehr'), ['karna-fate-rifle']);
    assert.deepEqual(await suche('gewehr'), ['karna-fate-rifle', 'p4-ar-blacklist-rifle']);
    assert.deepEqual(await suche('schrotflinte'), ['deadrig-shotgun']);
    // „Armour“ im Kategorie-Schluessel.
    assert.deepEqual(await suche('rüstung'), ['antium-core']);
    assert.deepEqual(await suche('kühler'), ['bracer']);
  });

  test('Umlaute und ß wie die Kopfsuche: „Rustung", „KUHLER"', async () => {
    assert.deepEqual(await suche('Rustung'), ['antium-core']);
    assert.deepEqual(await suche('KUHLER'), ['bracer']);
  });

  test('Tippfehler: „Karna Rifel", „Arclight Pistl", „Deadrig Shotgn", „gewher"', async () => {
    assert.deepEqual(await suche('Karna Rifel'), ['karna-fate-rifle']);
    assert.deepEqual(await suche('Arclight Pistl'), ['arclight-herrero-pistol']);
    assert.deepEqual(await suche('Deadrig Shotgn'), ['deadrig-shotgun']);
    assert.deepEqual(await suche('gewher'), ['karna-fate-rifle', 'p4-ar-blacklist-rifle']);
  });

  test('jedes Suchwort muss treffen, die Reihenfolge ist egal', async () => {
    assert.deepEqual(await suche('rifle karna'), ['karna-fate-rifle']);
    assert.deepEqual(await suche('karna pistol'), []);
  });

  test('woertliche Treffer bleiben genau: kein Tippfehler-Zuschlag, wo das Wort dasteht', async () => {
    assert.deepEqual(await suche('rifle'), ['karna-fate-rifle', 'p4-ar-blacklist-rifle']);
    assert.deepEqual(await suche('p4-ar'), ['p4-ar-blacklist-rifle']);
    // „core" steht woertlich (Antium Core): „cooler" kommt nicht dazu.
    assert.deepEqual(await suche('core'), ['antium-core']);
    // Unter vier Zeichen kein Tippfehler.
    assert.deepEqual(await suche('krn'), []);
    // Kein Wort in der Naehe: nichts.
    assert.deepEqual(await suche('xylophon'), []);
  });

  test('Zutaten zaehlen mit, auch die aus der DB nachgelieferten, und mit Tippfehler', async () => {
    const browser = makeBrowser({ blueprints: KARTEN, gattung });
    const tab = browser.open();
    // Vor der DB kennt die Karte nur ihre fuenf Chips.
    tab.search('quantainium');
    assert.deepEqual(tab.visible(), []);
    await browser.settle();
    // Die DB liefert die sechste Zutat nach; die Liste filtert neu, ohne
    // dass jemand weitertippt.
    assert.deepEqual(tab.visible(), ['bracer']);
    tab.search('quantanium');
    assert.deepEqual(tab.visible(), ['bracer']);
    tab.search('tungstn');
    assert.deepEqual(tab.visible(), ['bracer']);
  });

  test('leeres Feld zeigt wieder alles', async () => {
    const { tab } = await seite();
    tab.search('karna gewehr');
    assert.equal(tab.visible().length, 1);
    tab.search('   ');
    assert.deepEqual(tab.visible(), ALLE);
    assert.equal(tab.count(), String(ALLE.length));
  });
});
