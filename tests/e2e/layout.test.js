// Prüft die gebauten Seiten (dist/) — DE + EN, Nav-Verdrahtung, keine Dev-Sprache.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Sprach-Tausch (i18n Stufe 3): EN ist Standardsprache und liegt PRÄFIXLOS
// auf der Wurzel, DE unter /de/… (DE-Startseite = /de.html, format:'file').
const deHtml = fs.readFileSync(path.resolve('dist/de/item-finder.html'), 'utf8');
const enHtml = fs.readFileSync(path.resolve('dist/item-finder.html'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve('dist/index.html'), 'utf8');
const deIndexHtml = fs.readFileSync(path.resolve('dist/de.html'), 'utf8');

// Skript- und Daten-URLs tragen einen sha1-Content-Hash als ?v= (ItemFinderApp
// .astro). Der Hash ist PFLICHT — /assets/* wird mit max-age=86400 ausgeliefert,
// ohne ihn bekaeme ein wiederkehrender Besucher bis zu 24 h das alte Skript zum
// neuen HTML. Die Tests pruefen deshalb den Pfad und lassen den Hash zu, statt
// ihn zu verbieten; ein FEHLENDER Hash waere der Fehler.
const VER = String.raw`\?v=[0-9a-f]{6,}`;

describe('Item-Finder-Seite (DE)', () => {
  test('1. Seite existiert und lädt das App-Script (mit Cache-Bust-Hash)', () => {
    assert.match(deHtml, new RegExp(`src=["'][^"']*item-finder-app\\.js${VER}["']`, 'i'));
  });

  test('2. window.__UIF-Konfiguration mit lang=de ist eingebettet', () => {
    assert.ok(deHtml.includes('window.__UIF='));
    assert.ok(deHtml.includes('"lang":"de"'));
    assert.match(deHtml, new RegExp(`"dbUrl":"/assets/universal-items\\.json${VER}"`));
  });

  test('3. Alle App-Anker sind vorhanden', () => {
    for (const id of [
      'uif-app', 'uif-search-input', 'uif-kind-chips', 'uif-category-list',
      'uif-stats-count', 'uif-sort-select', 'uif-results-grid',
      'uif-pagination-container', 'uif-item-modal', 'uif-modal-body-content',
    ]) {
      assert.ok(deHtml.includes(`id="${id}"`), `fehlender Anker #${id}`);
    }
  });

  test('4. Hero nennt ehrliche Zahlen (Items + verifizierte Quellen)', () => {
    assert.ok(deHtml.includes('verifizierten Bezugsquellen'));
    assert.ok(deHtml.includes('Mit Quellen'));
  });

  test('5. Keine Entwickler-Sprache im UI', () => {
    assert.ok(!/run the dataminer/i.test(deHtml));
  });

  test('6. Patch-Volatilitäts-Hinweis vorhanden', () => {
    assert.ok(deHtml.includes('ingame prüfen'));
  });
});

describe('Item-Finder-Seite (EN)', () => {
  test('7. EN-Seite existiert und ist englisch konfiguriert', () => {
    assert.ok(enHtml.includes('window.__UIF='));
    assert.ok(enHtml.includes('"lang":"en"'));
  });

  test('8. EN-Seite hat englische Copy', () => {
    assert.ok(enHtml.includes('verified sources'));
    assert.ok(enHtml.includes('patch-volatile'));
  });
});

describe('Navigation', () => {
  test('9. EN-Nav verlinkt /item-finder.html (mit .html, wie alle Links)', () => {
    assert.ok(indexHtml.includes('href="/item-finder.html"'));
    assert.ok(!indexHtml.includes('href="/item-finder"'));
  });

  test('10. DE-Nav verlinkt /de/item-finder.html (existiert wirklich)', () => {
    assert.ok(deIndexHtml.includes('href="/de/item-finder.html"'));
    assert.ok(fs.existsSync(path.resolve('dist/de/item-finder.html')));
  });
});

// Der Sprachumschalter leitet sein Ziel seit dem Umbau selbst aus der
// Routenliste ab (src/lib/routeTwins.ts) statt aus einem Prop je Seite. Das
// kann auf zwei Arten kaputtgehen, und nur EINE davon fällt sonst auf:
//   * Ziel existiert nicht  -> `_verify` wird rot (gedeckt)
//   * Ziel zeigt still auf die STARTSEITE statt auf den Zwilling -> nichts
//     merkt es. Genau dieser Fall lag vorher auf /de/missionen.html vor.
// Deshalb hier eine Stichprobe quer durch die Seitenarten.
describe('Sprachumschalter zeigt auf den echten Zwilling', () => {
  const target = (file) => {
    const html = fs.readFileSync(path.resolve(file), 'utf8');
    const m = /class="langsw__opt" href="([^"]+)"/.exec(html);
    assert.ok(m, `kein Sprachumschalter in ${file}`);
    return m[1];
  };

  const PAARE = [
    ['dist/index.html', '/de.html'],
    ['dist/de.html', '/index.html'],
    ['dist/missionen.html', '/de/missionen.html'],
    ['dist/de/missionen.html', '/missionen.html'],
    ['dist/archiv.html', '/de/archiv.html'],
    ['dist/de/archiv.html', '/archiv.html'],
    ['dist/item-finder.html', '/de/item-finder.html'],
    ['dist/patches/sc-4-9-0.html', '/de/patches/sc-4-9-0.html'],
    ['dist/de/patches/sc-4-9-0.html', '/patches/sc-4-9-0.html'],
    ['dist/topics/4-5-0-engineering.html', '/de/topics/4-5-0-engineering.html'],
    ['dist/de/topics/4-5-0-engineering.html', '/topics/4-5-0-engineering.html'],
  ];

  for (const [file, erwartet] of PAARE) {
    test(`${file} -> ${erwartet}`, () => {
      assert.strictEqual(target(file), erwartet);
      assert.ok(fs.existsSync(path.resolve('dist' + erwartet)), `${erwartet} fehlt im Build`);
    });
  }
});

describe('Assets im Build', () => {
  test('11. App-Script und DB liegen in dist/assets', () => {
    assert.ok(fs.existsSync(path.resolve('dist/assets/item-finder-app.js')));
    assert.ok(fs.existsSync(path.resolve('dist/assets/universal-items.json')));
    assert.ok(fs.existsSync(path.resolve('dist/assets/dismantling-items.json')));
  });
});
