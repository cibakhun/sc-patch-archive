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
  ROHTEXT_RE, VORLAGE_RE, DATUM_DE_AUF_EN_RE, DATUM_EN_AUF_DE_RE, DEZIMAL_EN_AUF_DE_RE, DEZIMAL_DE_AUF_EN_RE,
  DE_UMLAUTWORT_RE, DE_WORT_EN_RE, INTERN_RE, ohneTechnischeDetails, textStellen, pruefeStelle, sprachMengen, rohschluesselRe,
  ZAHL_EN_AUF_DE_RE, ZAHL_DE_AUF_EN_RE, PLATZHALTERWERT_RE, DE_FUNKTIONSWORT_RE, DOPPELWORT_EN_RE,
} from '../../scripts/lib/textregeln.mjs';

const trifft = (re, t) => re.test(t);

describe('Rohtext: Reste aus dem Zusammensetzen', () => {
  for (const t of ['Hello ${name}', '{{ title }}', '0.30000000000000004', '1e+21 aUEC', '-1e+21 aUEC', 'Δ −2.5e-7', 'Gewicht 5e-7 kg', 'Wanted: {TargetName}']) {
    test(`faengt „${t}"`, () => assert.ok(trifft(ROHTEXT_RE, t)));
  }
  for (const t of ['4.0.1.9428143', 'Alpha 4.10.2', '1.508.220 aUEC', 'Defend Location From Mercs', 'Infinity Custom', 'CL 12157308', '0.25 SCU', 'Item {', '{n} Slots', 'id-1e-5']) {
    test(`laesst „${t}"`, () => assert.ok(!trifft(ROHTEXT_RE, t)));
  }
});

// Kleingeschriebene Vorlagen ({count}, {name}) stehen im statischen HTML zu
// Recht ungefuellt in versteckten Textspeichern (Layout-Werkstatt, 68 Stellen
// im Vorschau-Bau 04.11.2026) — deshalb eigene Regel, nur fuer Text, den ein
// Skript geschrieben hat (pruefeStelle).
describe('Satzvorlage im geschriebenen Text', () => {
  for (const t of ['{count} items found', 'Wo abbauen: {name}', '{n} Slots']) {
    test(`faengt „${t}"`, () => assert.ok(trifft(VORLAGE_RE, t)));
  }
  for (const t of ['Item {', '{ }', 'a {B} c']) {
    test(`laesst „${t}"`, () => assert.ok(!trifft(VORLAGE_RE, t)));
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

describe('Dezimalzahl im Format der anderen Sprache', () => {
  // Ganze Textstelle (auch ohne Einheit mit Vorzeichen) und, seit der
  // Staging-Abnahme 04.11.2026, Zahl mit Einheit mitten im Text.
  for (const t of ['0.01 SCU', '8.75 m', '+0.5', '(−2.5 %)', '×1.25', 'Größe 1.5 m bis 2 m', 'L 20 m · B 15 m · H 6.5 m', 'Agilität: 97.0 °/s Ø, Perzentil 79', 'Grundriss 6.5 m lang, 15 m breit']) {
    test(`DE-Seite faengt „${t}"`, () => assert.ok(trifft(DEZIMAL_EN_AUF_DE_RE, t)));
  }
  for (const t of ['4.10', '1.000 m', '0,01 SCU', 'Alpha 4.0.1', 'Alpha 4.10.2 · 15.200 REM', 'L 20 m · B 15 m · H 6,5 m', 'Patch 4.10 am 9. Oktober']) {
    test(`DE-Seite laesst „${t}"`, () => assert.ok(!trifft(DEZIMAL_EN_AUF_DE_RE, t)));
  }
  for (const t of ['0,2 s', '+1,5', '12,75 aUEC']) {
    test(`EN-Seite faengt „${t}"`, () => assert.ok(trifft(DEZIMAL_DE_AUF_EN_RE, t)));
  }
  for (const t of ['1,508 aUEC', '0.2 s', '3,4', 'Sizes 1,000 m and up']) {
    test(`EN-Seite laesst „${t}"`, () => assert.ok(!trifft(DEZIMAL_DE_AUF_EN_RE, t)));
  }
});

describe('Interner Bezeichner im sichtbaren Text', () => {
  for (const t of ['PU_Delivery_Local_DrugProduction_Stanton4_KlimIntro', 'Orte: RR_P3_L2, Bloom', 'RADR_GNRP_S03_Idris_TEMP']) {
    test(`faengt „${t}"`, () => assert.ok(trifft(INTERN_RE, t)));
  }
  for (const t of ['PU/PU_Missions/DeliveryMission/PU_LinearDelivery.xml', 'Cookie vb_gate_exp', 'PYAM-FARSTAT-1-5', 'A_B', 'Item_Name']) {
    test(`laesst „${t}"`, () => assert.ok(!trifft(INTERN_RE, t)));
  }
  test('Technische Details (details.md__tech) duerfen interne Namen tragen', () => {
    const html = '<p>Angebote</p><details class="md__tech" data-astro-cid-x><summary>Technische Details</summary><dl><dd><code>PU_Delivery_Local_X_Y</code></dd></dl></details><td><code>RR_P3_L2</code></td>';
    const treffer = textStellen(ohneTechnischeDetails(html)).filter((t) => INTERN_RE.test(t));
    assert.deepEqual(treffer, ['RR_P3_L2']);
  });
});

describe('Deutsches Wort auf EN-Seite', () => {
  for (const t of ['Bild öffnen: Asgard', 'Destination Pyro — Trailer abspielen', 'Stabilität & Save Stanton II', 'Ressource suchen...', 'Suchen', 'Speichern', 'Layout Teilen', '· Oktober 2025', '· ab 09.10.2026', '· saisonal']) {
    test(`faengt „${t}"`, () => assert.ok(trifft(DE_UMLAUTWORT_RE, t) || trifft(DE_WORT_EN_RE, t)));
  }
  for (const t of ['600i 2951 BIS', 'Open image: Asgard', 'Search resources…', 'Seasonal', 'October 2025', 'Abyss', 'Bilder-free', 'Ab Initio', 'Bis Sector']) {
    test(`laesst „${t}"`, () => assert.ok(!trifft(DE_UMLAUTWORT_RE, t) && !trifft(DE_WORT_EN_RE, t)));
  }
});

describe('Zahl mit Tausendergruppen im Format der anderen Sprache', () => {
  for (const t of ['1,508,220', '1,508.5', 'Preis 1,508 aUEC']) {
    test(`DE-Seite faengt „${t}"`, () => assert.ok(trifft(ZAHL_EN_AUF_DE_RE, t)));
  }
  for (const t of ['1.508.220', '4,5', '1.508 aUEC', 'Alpha 4.10.2']) {
    test(`DE-Seite laesst „${t}"`, () => assert.ok(!trifft(ZAHL_EN_AUF_DE_RE, t)));
  }
  for (const t of ['1.508.220', '1.508,5', 'Price 1.508 aUEC']) {
    test(`EN-Seite faengt „${t}"`, () => assert.ok(trifft(ZAHL_DE_AUF_EN_RE, t)));
  }
  for (const t of ['1,508,220', '4.0.1.9428143', 'Alpha 4.10.2', '1,508 aUEC']) {
    test(`EN-Seite laesst „${t}"`, () => assert.ok(!trifft(ZAHL_DE_AUF_EN_RE, t)));
  }
});

describe('Platzhalterwert -1', () => {
  for (const t of ['-1', ' -1 ']) test(`faengt „${t}"`, () => assert.ok(trifft(PLATZHALTERWERT_RE, t)));
  for (const t of ['-10', 'Rang -1', '−1', '1']) test(`laesst „${t}"`, () => assert.ok(!trifft(PLATZHALTERWERT_RE, t)));
});

describe('Deutsches Funktionswort auf EN-Seite', () => {
  for (const t of ['Keine Treffer', 'Schiff wählen', '3 Items gefunden', 'Laser und Waffen']) {
    test(`faengt „${t}"`, () => assert.ok(trifft(DE_FUNKTIONSWORT_RE, t)));
  }
  for (const t of ['Bundle', 'Undead Order', 'Isthmus', 'Fürstenberg', 'Zurückhaltung']) {
    test(`laesst „${t}"`, () => assert.ok(!trifft(DE_FUNKTIONSWORT_RE, t)));
  }
});

describe('Englisches Doppelwort aus einer Satzvorlage', () => {
  for (const t of ['Visit The The Ship', 'Buy A A Drake']) test(`faengt „${t}"`, () => assert.ok(trifft(DOPPELWORT_EN_RE, t)));
  for (const t of ['The Ship', 'Theatre The End', 'A Ann']) test(`laesst „${t}"`, () => assert.ok(!trifft(DOPPELWORT_EN_RE, t)));
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
  test('EN: interner Name', () => assert.deepEqual(regeln('Wanted: PU_Bounty_Target_Stanton1', 'en'), ['intern']));
  test('EN: Platzhalter', () => assert.deepEqual(regeln('Wanted: {TargetName}', 'en'), ['roh']));
  test('DE: Satzvorlage', () => assert.deepEqual(regeln('{count} kompatible Items gefunden', 'de'), ['roh']));
  test('saubere Stellen', () => {
    assert.deepEqual(regeln('Players per instance', 'en'), []);
    assert.deepEqual(regeln('0,01 SCU', 'de'), []);
    assert.deepEqual(regeln('October 9, 2026', 'en'), []);
  });
});
