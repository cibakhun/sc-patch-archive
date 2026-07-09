// Prüft die gebauten Seiten (dist/) — DE + EN, Nav-Verdrahtung, keine Dev-Sprache.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const deHtml = fs.readFileSync(path.resolve('dist/item-finder.html'), 'utf8');
const enHtml = fs.readFileSync(path.resolve('dist/en/item-finder.html'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve('dist/index.html'), 'utf8');
const enIndexHtml = fs.readFileSync(path.resolve('dist/en.html'), 'utf8');

describe('Item-Finder-Seite (DE)', () => {
  test('1. Seite existiert und lädt das App-Script', () => {
    assert.match(deHtml, /src=["'][^"']*item-finder-app\.js["']/i);
  });

  test('2. window.__UIF-Konfiguration mit lang=de ist eingebettet', () => {
    assert.ok(deHtml.includes('window.__UIF='));
    assert.ok(deHtml.includes('"lang":"de"'));
    assert.ok(deHtml.includes('"dbUrl":"/assets/universal-items.json"'));
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
  test('9. DE-Nav verlinkt /item-finder.html (mit .html, wie alle Links)', () => {
    assert.ok(indexHtml.includes('href="/item-finder.html"'));
    assert.ok(!indexHtml.includes('href="/item-finder"'));
  });

  test('10. EN-Nav verlinkt /en/item-finder.html (existiert wirklich)', () => {
    assert.ok(enIndexHtml.includes('href="/en/item-finder.html"'));
    assert.ok(fs.existsSync(path.resolve('dist/en/item-finder.html')));
  });
});

describe('Assets im Build', () => {
  test('11. App-Script und DB liegen in dist/assets', () => {
    assert.ok(fs.existsSync(path.resolve('dist/assets/item-finder-app.js')));
    assert.ok(fs.existsSync(path.resolve('dist/assets/universal-items.json')));
    assert.ok(fs.existsSync(path.resolve('dist/assets/dismantling-items.json')));
  });
});
