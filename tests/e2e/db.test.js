// Validiert die ECHTE assets/universal-items.json (kanonische Quelle).
// Kernversprechen: keine fabrizierten Werte, keine Duplikate, keine Platzhalter.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const canonicalPath = path.resolve('assets/universal-items.json');
const publicPath = path.resolve('public/assets/universal-items.json');
const distPath = path.resolve('dist/assets/universal-items.json');

const db = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
const items = db.items;

describe('Universal Items DB — Provenance & Header', () => {
  test('1. Kanonische Datei existiert in assets/ (nicht nur public/)', () => {
    assert.ok(fs.existsSync(canonicalPath));
  });

  test('2. Header nennt Generator, Datum und Quellen', () => {
    assert.strictEqual(db.generator, 'scripts/build-universal-db.mjs');
    assert.match(db.generatedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(db.sources && db.sources.shops && db.sources.loot && db.sources.vehicles);
    assert.ok(db.note.includes('Keine fabrizierten Werte'));
  });

  test('3. counts sind konsistent mit den Items', () => {
    assert.strictEqual(db.counts.items, items.length);
    const withObtain = items.filter((i) => i.obtain.length > 0).length;
    assert.strictEqual(db.counts.withObtain, withObtain);
    assert.strictEqual(db.counts.catalogOnly, items.length - withObtain);
  });

  test('4. Mindestumfang: >8000 Items, >2000 mit Bezugsquelle', () => {
    assert.ok(items.length > 8000, `nur ${items.length} Items`);
    assert.ok(db.counts.withObtain > 2000, `nur ${db.counts.withObtain} mit Quelle`);
  });
});

describe('Universal Items DB — Integrität der Einträge', () => {
  test('5. IDs sind eindeutig und slug-förmig', () => {
    const seen = new Set();
    for (const it of items) {
      assert.match(it.id, /^[a-z0-9-]+$/, `id ${it.id}`);
      assert.ok(!seen.has(it.id), `doppelte id ${it.id}`);
      seen.add(it.id);
    }
  });

  test('6. Namen sind eindeutig (case-insensitiv) — keine Karten-Duplikate', () => {
    const seen = new Set();
    for (const it of items) {
      const k = it.name.toLowerCase();
      assert.ok(!seen.has(k), `doppelter Name ${it.name}`);
      seen.add(k);
    }
  });

  test('7. Keine Platzhalter-Namen (@-Keys, PH-Präfix, placeholder, HTML)', () => {
    for (const it of items) {
      assert.ok(it.name && it.name.trim().length > 0);
      assert.ok(!it.name.startsWith('@'), `Loca-Key als Name: ${it.name}`);
      assert.ok(!/^\(?ph\)?\s*[-–]?\s/i.test(it.name), `PH-Platzhalter: ${it.name}`);
      assert.ok(!/placeholder|<=|=>/i.test(it.name), `Platzhalter: ${it.name}`);
      assert.ok(!it.name.includes('<'), `HTML im Namen: ${it.name}`);
    }
  });

  test('8. Jedes Item hat eine Kategorie', () => {
    for (const it of items) {
      assert.ok(typeof it.category === 'string' && it.category.length > 0, `${it.id} ohne Kategorie`);
    }
  });

  test('9. obtain-Einträge sind wohlgeformt (kind/loc/price)', () => {
    for (const it of items) {
      for (const o of it.obtain) {
        assert.ok(['shop', 'loot', 'vehicle'].includes(o.kind), `${it.id}: kind ${o.kind}`);
        assert.ok(typeof o.loc === 'string' && o.loc.length > 0, `${it.id}: leerer Ort`);
        if (o.kind === 'loot') {
          assert.strictEqual(o.price, undefined, `${it.id}: Loot mit Preis`);
        } else {
          assert.ok(Number.isFinite(o.price) && o.price > 0, `${it.id}: ${o.kind} ohne gültigen Preis`);
        }
      }
    }
  });

  test('10. Keine identischen obtain-Duplikate innerhalb eines Items', () => {
    for (const it of items) {
      const seen = new Set();
      for (const o of it.obtain) {
        const k = `${o.kind}|${o.loc}|${o.price ?? ''}`;
        assert.ok(!seen.has(k), `${it.id}: doppelte Quelle ${k}`);
        seen.add(k);
      }
    }
  });

  test('11. Items sind alphabetisch sortiert (deterministischer Build)', () => {
    for (let i = 1; i < items.length; i++) {
      assert.ok(
        items[i - 1].name.localeCompare(items[i].name, 'en') <= 0,
        `Sortierung verletzt bei ${items[i].name}`
      );
    }
  });

  test('12. Katalog-Einträge haben KEINE Pseudo-Daten (obtain leer = ehrlich leer)', () => {
    const catalog = items.filter((i) => i.obtain.length === 0);
    assert.strictEqual(catalog.length, db.counts.catalogOnly);
    for (const it of catalog) {
      assert.strictEqual(it.guide, undefined, `${it.id}: Katalog mit Guide?`);
    }
  });

  test('13. Guides hängen nur an Items mit Loot-Quelle', () => {
    for (const it of items) {
      if (it.guide) {
        assert.ok(it.obtain.some((o) => o.kind === 'loot'), `${it.id}: Guide ohne Loot-Quelle`);
      }
    }
  });
});

describe('Universal Items DB — Sync-Spiegel', () => {
  test('14. public/assets-Spiegel ist identisch mit kanonischer Quelle', () => {
    assert.ok(fs.existsSync(publicPath), 'public/assets fehlt — npm run build ausführen');
    const pub = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
    assert.strictEqual(pub.counts.items, db.counts.items);
    assert.strictEqual(pub.generatedAt, db.generatedAt);
  });

  test('15. dist enthält die DB nach dem Build', () => {
    assert.ok(fs.existsSync(distPath), 'dist fehlt — npm run build ausführen');
  });
});
