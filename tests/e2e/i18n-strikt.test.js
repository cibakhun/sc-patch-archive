// Strikte Uebersetzung: ein fehlender Schluessel oder eine fehlende Sprache
// bricht den Bau ab, statt still auf der Seite zu landen.
//
// Anlass 04.11.2026 (Datenqualitaets-Audit):
//  1. useTranslations()/itemT() gaben bei einem unbekannten Schluessel den
//     Schluessel selbst zurueck — ein „ship.sheet.title" waere woertlich auf
//     der Seite gelandet, und kein Tor haette es gesehen.
//  2. Funktionen mit `lang: Locale = DEFAULT_LOCALE` kippten beim Sprach-
//     tausch (EN wurde Standard) still auf Englisch: die deutschen Schiffs-
//     seiten zeigten englische Preise, Profile und Vergleiche.
//  3. Die Kategorielisten zeigten bei Exklusiv-Items den englischen Satz der
//     Datenquelle („Promotional item — not obtainable in-game") auch auf DE.
//  4. Missionen zeigten „Spieler je Instanz: -1" (Platzhalter der Spieldaten).
//
// Die Tests laden die echten Module aus src/ (gebuendelt mit esbuild) und
// pruefen Invarianten, keine Momentwerte: JEDE Exklusiv-Zeile der Item-DB hat
// in beiden Sprachen ein Label, und JEDE Mission zeigt eine Spielerzahl >= 1
// oder gar keine.
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-strikt-'));
  const file = path.join(dir, 'mod.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const M = await bundle(['src/i18n/ui.ts', 'src/i18n/itemText.ts', 'src/lib/missions.ts']);
const ITEMS = JSON.parse(fs.readFileSync('assets/universal-items.json', 'utf8')).items;

describe('Uebersetzung: kein stiller Rueckfall', () => {
  test('useTranslations: unbekannter Schluessel bricht ab und nennt ihn', () => {
    for (const lang of ['de', 'en']) {
      const t = M.useTranslations(lang);
      assert.throws(() => t('ship.sheet.title'), /ship\.sheet\.title/, lang);
    }
  });

  test('useTranslations: bekannte Schluessel liefern je Sprache ihren Text', () => {
    const de = M.useTranslations('de')('skip.toContent');
    const en = M.useTranslations('en')('skip.toContent');
    assert.ok(de && en && de !== en, `${de} / ${en}`);
    assert.notEqual(de, 'skip.toContent');
  });

  test('assertLocale: fehlende oder fremde Sprache bricht ab', () => {
    assert.equal(M.assertLocale('de', 'test'), 'de');
    assert.equal(M.assertLocale('en', 'test'), 'en');
    for (const bad of [undefined, null, '', 'fr', 'DE']) {
      assert.throws(() => M.assertLocale(bad, 'test'), /test/, String(bad));
    }
    assert.throws(() => M.useTranslations(undefined));
    assert.throws(() => M.itemT(undefined));
  });

  test('itemT: unbekannter Schluessel bricht ab', () => {
    assert.throws(() => M.itemT('de')('gibtEsNicht'), /gibtEsNicht/);
    assert.ok(M.itemT('de')('kindBuy'));
  });

  test('itemLabel: Katalogwert der Seite, sonst der Rohwert der Spieldaten', () => {
    assert.equal(M.itemLabel('de', 'wHeavy', 'Heavy'), 'Schwer');
    assert.equal(M.itemLabel('en', 'wHeavy', 'Heavy'), 'Heavy');
    assert.equal(M.itemLabel('de', 'wGibtEsNicht', 'Roh'), 'Roh');
  });
});

describe('Bezugsarten: Exklusiv-Zeilen in der Sprache der Seite', () => {
  const zeilen = ITEMS.flatMap((i) => (i.obtain ?? []).filter((o) => o.kind === 'exclusive'));

  test('jede Exklusiv-Zeile der Item-DB hat in DE und EN ein Label', () => {
    assert.ok(zeilen.length >= 500, `nur ${zeilen.length} Exklusiv-Zeilen (Klinke 500)`);
    for (const o of zeilen) {
      for (const lang of ['de', 'en']) {
        const s = M.obtainLabel(o, lang);
        assert.ok(s && s.trim(), `${o.reason} ${lang}`);
      }
    }
  });

  test('DE zeigt nie den englischen Satz der Datenquelle', () => {
    let geprueft = 0;
    for (const o of zeilen) {
      const de = M.obtainLabel(o, 'de');
      assert.notEqual(de, o.loc, `${o.reason}: „${o.loc}" stuende roh auf der DE-Seite`);
      geprueft++;
    }
    assert.ok(geprueft >= 500);
  });

  test('Orte (keine Exklusiv-Zeile) bleiben Eigennamen', () => {
    assert.equal(M.obtainLabel({ kind: 'shop', loc: 'Area18 · Cubby Blast' }, 'de'), 'Area18 · Cubby Blast');
  });

  test('eine Bezugsart ohne Label bricht ab', () => {
    assert.throws(() => M.obtainLabel({ kind: 'exclusive', loc: 'x', reason: 'GibtEsNicht' }, 'de'), /GibtEsNicht/);
  });
});

describe('Missionen: Spieler je Instanz', () => {
  test('Platzhalter der Spieldaten werden nicht angezeigt', () => {
    for (const roh of [-1, 0, null, undefined, 1.5, NaN]) {
      assert.equal(M.spielerJeInstanz({ maxPlayers: roh }), null, String(roh));
    }
    assert.equal(M.spielerJeInstanz({ maxPlayers: 1 }), 1);
    assert.equal(M.spielerJeInstanz({ maxPlayers: 4 }), 4);
  });
});
