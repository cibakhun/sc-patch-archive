// Textregeln (scripts/lib/textregeln.mjs) — jede Regel faengt ihre Fehlerform
// und laesst die gemessenen echten Formen in Ruhe.
//
// Anlass 04.11.2026 (Inhaltsvalidierung der Werkzeuge): dieselben Ausdruecke
// pruefen das statische HTML (audit:site, verify:sprache) und den Text, den
// die Werkzeuge im Browser schreiben (verify:clienttext). Die Gegenbeispiele
// sind keine erfundenen Faelle, sondern Formen, die am selben Tag auf der
// Seite standen und richtig sind ("600i 2951 BIS", Versionsnummern,
// deutsche Tausendergruppen, Raffinerie-Deltas mit U+2212) — faengt eine
// Regel sie, wird das Tor zum Fehlalarm.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROHTEXT_RE, DATUM_DE_AUF_EN_RE, DATUM_EN_AUF_DE_RE, DEZIMAL_EN_AUF_DE_RE, DEZIMAL_DE_AUF_EN_RE,
  DE_UMLAUTWORT_RE, DE_WORT_EN_RE, pruefeStelle, sprachMengen, rohschluesselRe,
} from '../../scripts/lib/textregeln.mjs';

const trifft = (re, t) => re.test(t);

describe('Rohtext: Reste aus dem Zusammensetzen', () => {
  for (const t of ['{count} items found', 'Wo abbauen: {name}', 'Hello ${name}', '{{ title }}', '0.30000000000000004', '1e+21 aUEC', 'Gewicht 5e-7 kg', 'Wanted: {TargetName}']) {
    test(`faengt „${t}"`, () => assert.ok(trifft(ROHTEXT_RE, t)));
  }
  for (const t of ['4.0.1.9428143', 'Alpha 4.10.2', '1.508.220 aUEC', 'Defend Location From Mercs', 'Infinity Custom', 'CL 12157308', '0.25 SCU', 'Item {']) {
    test(`laesst „${t}"`, () => assert.ok(!trifft(ROHTEXT_RE, t)));
  }
});

describe('Datum im Format der anderen Sprache', () => {
  for (const t of ['· 9. Oktober 2026 →', '· 28. Jan – 28. Feb 2025', '· 1.–15. Juli 2026', '· 16.09.2026 bis 4.10.2']) {
    test(`EN-Seite faengt „${t}"`, () => assert.ok(trifft(DATUM_DE_AUF_EN_RE, t)));
  }
  for (const t of ['October 9, 2026', 'Alpha 4.10.2', 'Step 1. Open the menu', 'Jan 28 – Feb 28, 2025']) {
    test(`EN-Seite laesst „${t}"`, () => assert.ok(!trifft(DATUM_DE_AUF_EN_RE, t)));
  }
  for (const t of ['March 26, 2026', 'Oct 9, 2026', '09/16/2026']) {
    test(`DE-Seite faengt „${t}"`, () => assert.ok(trifft(DATUM_EN_AUF_DE_RE, t)));
  }
  for (const t of ['26. März 2026', 'March of the Vanduul', '4/4 Slots']) {
    test(`DE-Seite laesst „${t}"`, () => assert.ok(!trifft(DATUM_EN_AUF_DE_RE, t)));
  }
});

describe('Dezimalzahl im Format der anderen Sprache (ganze Textstelle)', () => {
  for (const t of ['0.01 SCU', '8.75 m', '+0.5', '(−2.5 %)', '×1.25']) {
    test(`DE-Seite faengt „${t}"`, () => assert.ok(trifft(DEZIMAL_EN_AUF_DE_RE, t)));
  }
  for (const t of ['4.10', '1.000 m', '0,01 SCU', 'Alpha 4.0.1', 'Größe 1.5 m bis 2 m']) {
    test(`DE-Seite laesst „${t}"`, () => assert.ok(!trifft(DEZIMAL_EN_AUF_DE_RE, t)));
  }
  for (const t of ['0,2 s', '+1,5', '12,75 aUEC']) {
    test(`EN-Seite faengt „${t}"`, () => assert.ok(trifft(DEZIMAL_DE_AUF_EN_RE, t)));
  }
  for (const t of ['1,508 aUEC', '0.2 s', '3,4']) {
    test(`EN-Seite laesst „${t}"`, () => assert.ok(!trifft(DEZIMAL_DE_AUF_EN_RE, t)));
  }
});

describe('Deutsches Wort auf EN-Seite', () => {
  for (const t of ['Bild öffnen: Asgard', 'Destination Pyro — Trailer abspielen', 'Stabilität & Save Stanton II', 'Ressource suchen...', '· Oktober 2025', '· ab 09.10.2026', '· saisonal']) {
    test(`faengt „${t}"`, () => assert.ok(trifft(DE_UMLAUTWORT_RE, t) || trifft(DE_WORT_EN_RE, t)));
  }
  for (const t of ['600i 2951 BIS', 'Open image: Asgard', 'Search resources…', 'Seasonal', 'October 2025', 'Abyss', 'Bilder-free']) {
    test(`laesst „${t}"`, () => assert.ok(!trifft(DE_UMLAUTWORT_RE, t) && !trifft(DE_WORT_EN_RE, t)));
  }
});

describe('pruefeStelle: eine Pruefung fuer beide Sprachen', () => {
  const M = sprachMengen({
    de: new Map([['UI:a', 'Spieler je Instanz'], ['UI:b', 'Torso']]),
    en: new Map([['UI:a', 'Players per instance'], ['UI:b', 'Core']]),
  });
  const RS = rohschluesselRe(new Set(['ship']));
  const regeln = (t, lang) => pruefeStelle(t, lang, M, RS).map((b) => b.regel);
  test('EN: Katalogtext DE', () => assert.deepEqual(regeln('Spieler je Instanz', 'en'), ['sprache']));
  test('DE: Katalogtext EN', () => assert.deepEqual(regeln('Players per instance', 'de'), ['sprache']));
  test('DE: Dezimalpunkt', () => assert.deepEqual(regeln('0.01 SCU', 'de'), ['dezimal']));
  test('EN: deutsches Datum', () => assert.deepEqual(regeln('9. Oktober 2026', 'en'), ['deWort', 'datum']));
  test('EN: Rohschluessel', () => assert.deepEqual(regeln('ship.sheet.title', 'en'), ['schluessel']));
  test('EN: Platzhalter', () => assert.deepEqual(regeln('Wanted: {TargetName}', 'en'), ['roh']));
  test('saubere Stellen', () => {
    assert.deepEqual(regeln('Players per instance', 'en'), []);
    assert.deepEqual(regeln('0,01 SCU', 'de'), []);
    assert.deepEqual(regeln('October 9, 2026', 'en'), []);
  });
});
