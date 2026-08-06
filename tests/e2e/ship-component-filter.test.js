// Automatisierter Verhaltensnachweis fuer den Komponenten-Filter der
// Schiffsliste (Phase 7) -- deckt D-04, D-08, D-10, D-11 und D-12 ab.
//
// Warum ueberhaupt: der Filter entscheidet ueber Zahlen, die niemand im
// Browser nachzaehlt. Dieser Test zieht das ECHTE Inline-Skript aus
// src/components/ships/ShipsOverview.astro, fuehrt es gegen ein frisches
// Mock-DOM aus (node:vm, kein Browser noetig) und vergleicht die sichtbaren
// Karten mit einer Sollmenge, die er selbst aus src/data/ship-components.json
// ausrechnet. Verletzt eine der Filterentscheidungen ihre Zusage, schlaegt der
// Test in Sekunden fehl statt in einer manuellen Sitzung.
//
// Sprachparitaet ist seit Phase 6 STRUKTURELL statt geprueft: /schiffe.html und
// /de/schiffe.html teilen sich EINEN Koerper, die Seiten sind nur noch Huellen.
// Der Test sichert genau diese Struktur ab (beide Huellen binden denselben
// Koerper ein) und faehrt den Skriptrumpf zusaetzlich mit beiden
// Sprachbeschriftungen, weil die Sprache am Flottencontainer haengt
// (data-results-label/data-nodata-label/data-andup-label) und damit sehr wohl
// eine Fehlerquelle im Zaehlertext bleibt.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { makeShipsDomContext, LABELS } from './helpers/ships-dom.js';

const BODY_PATH = path.resolve('src/components/ships/ShipsOverview.astro');
const EN_SHELL = path.resolve('src/pages/schiffe.astro');
const DE_SHELL = path.resolve('src/pages/de/schiffe.astro');

const bodySource = fs.readFileSync(BODY_PATH, 'utf8');
const enShell = fs.readFileSync(EN_SHELL, 'utf8');
const deShell = fs.readFileSync(DE_SHELL, 'utf8');

// Zieht den Rumpf des <script is:inline> ... </script>-Blocks. Es ist genau EIN
// solcher Block, und er wird unveraendert ausgeliefert (Inline-Skripte
// transformiert Astro nicht) -- die Quelle taugt deshalb direkt als
// Pruefgegenstand.
function extractInlineScript(source) {
  const m = source.match(/<script is:inline>([\s\S]*?)<\/script>/);
  assert.ok(m, 'kein <script is:inline>-Block in ShipsOverview.astro gefunden');
  return m[1];
}

const bodyScript = extractInlineScript(bodySource);

// Laedt die tatsaechlichen Steckplatz-Daten, aus denen die Sollmengen zur
// Laufzeit berechnet werden (nicht fest eingetragen) -- damit ueberlebt der
// Test einen Patch-Day-Refresh von scripts/datamine-ship-components.mjs.
const comp = JSON.parse(fs.readFileSync(path.resolve('src/data/ship-components.json'), 'utf8'));

function idsWithAtLeast(letter, size) {
  return new Set(
    Object.entries(comp.ships)
      .filter(([, entry]) => entry[letter] != null && entry[letter] >= size)
      .map(([id]) => id)
  );
}

// Groesster gespeicherter Wert je Kategorie -- daraus ergibt sich die Laenge
// der Groessenliste (D-10), ohne eine Zahl fest einzutragen.
function maxFor(letter) {
  let max = 0;
  for (const entry of Object.values(comp.ships)) {
    const v = entry[letter];
    if (v != null && v > max) max = v;
  }
  return max;
}

const hardpoints = JSON.parse(fs.readFileSync(path.resolve('src/data/ship-hardpoints.json'), 'utf8'));
const idsWithoutData = new Set(Object.keys(hardpoints.ships).filter((id) => !(id in comp.ships)));
const TOTAL = Object.keys(hardpoints.ships).length;

// Fuehrt das echte Inline-Skript gegen einen frischen Mock-DOM-Kontext aus.
// Ein Kontext pro Aufruf -- kein geteilter Zustand zwischen Testfaellen.
function run(lang) {
  const ctx = makeShipsDomContext({ lang });
  vm.runInContext(bodyScript, vm.createContext(ctx));
  return ctx;
}

// Sichtbare Karten-Ids nach dem aktuellen Filterstand (c.style.display !== 'none').
function visibleIds(ctx) {
  return new Set(ctx.ids.filter((id) => ctx.cardsById[id].style.display !== 'none'));
}

function selectComponent(ctx, letter) {
  ctx.elements['sf-comp'].value = letter;
  ctx.elements['sf-comp'].dispatchEvent({ type: 'change' });
}
function selectSize(ctx, size) {
  ctx.elements['sf-compsize'].value = size == null ? '' : String(size);
  ctx.elements['sf-compsize'].dispatchEvent({ type: 'change' });
}
function selectMaker(ctx, maker) {
  ctx.elements['sf-maker'].value = maker;
  ctx.elements['sf-maker'].dispatchEvent({ type: 'change' });
}

const LANGS = [
  { label: 'EN', lang: 'en' },
  { label: 'DE', lang: 'de' },
];

describe('Struktur: EIN Koerper fuer beide Sprachen (Phase 6)', () => {
  test('beide Seitenhuellen binden denselben Koerper ein', () => {
    assert.match(enShell, /components\/ships\/ShipsOverview\.astro/, 'EN-Huelle bindet ShipsOverview.astro nicht ein');
    assert.match(deShell, /components\/ships\/ShipsOverview\.astro/, 'DE-Huelle bindet ShipsOverview.astro nicht ein');
  });

  test('keine Huelle traegt ein eigenes Inline-Skript (sonst liefe der Filter doppelt)', () => {
    assert.doesNotMatch(enShell, /<script is:inline>/, 'EN-Huelle traegt ein eigenes Inline-Skript');
    assert.doesNotMatch(deShell, /<script is:inline>/, 'DE-Huelle traegt ein eigenes Inline-Skript');
  });

  test('der Koerper ruft compAttr am Kartenelement auf', () => {
    assert.match(bodySource, /data-comp=\{compAttr\(id\)\}/, 'data-comp={compAttr(id)} fehlt am fcard-Element');
  });

  test('der Koerper traegt die Ids sf-comp und sf-compsize', () => {
    assert.match(bodySource, /id="sf-comp"/, 'id="sf-comp" fehlt');
    assert.match(bodySource, /id="sf-compsize"/, 'id="sf-compsize" fehlt');
  });

  test('sf-size bleibt der Groessenklassen-Filter aus Phase 6, nicht die Bauteilgroesse', () => {
    assert.match(bodySource, /id="sf-size"[\s\S]{0,200}sizeClasses\.map/, 'sf-size fuellt sich nicht mehr aus sizeClasses — Namenskollision mit dem Bauteilfilter?');
  });

  test('die Sprache haengt am Flottencontainer, nicht im Skript', () => {
    for (const attr of ['data-results-label', 'data-nodata-label', 'data-andup-label']) {
      assert.match(bodySource, new RegExp(attr), `${attr} fehlt am Flottencontainer`);
    }
  });

  test('D-07: der Koerper zeigt nirgends eine Steckplatz-Groesse an', () => {
    // Erlaubt ist data-comp als Attribut; verboten ist jede Ausgabe davon in
    // sichtbarem Text (etwa ein Chip mit der Groesse).
    assert.doesNotMatch(bodySource, /fcard__chip[^>]*>\s*\{?\s*compAttr/, 'eine Karte gibt die Steckplatz-Groesse sichtbar aus (verletzt D-07)');
  });
});

for (const lang of LANGS) {
  const L = LABELS[lang.lang];
  const results = (n) => `${n} ${L.results}`;
  const withNoData = (n, noData) => `${n} ${L.results} · ${noData} ${L.nodata}`;

  describe(`Komponenten-Filter [${lang.label}]`, () => {
    let ctx;
    beforeEach(() => {
      ctx = run(lang.lang);
    });

    test(`[${lang.label}] D-04: Waffe + S5 zeigt genau die Schiffe mit gespeichertem w>=5`, () => {
      const expected = idsWithAtLeast('w', 5);
      selectComponent(ctx, 'w');
      selectSize(ctx, 5);
      assert.deepStrictEqual(
        visibleIds(ctx),
        expected,
        `[${lang.label}] sichtbare Ids bei w>=5 weichen von der aus ship-components.json berechneten Sollmenge ab`
      );
    });

    test(`[${lang.label}] Ankerschiff orig-100i ist bei Waffe+S5 NICHT sichtbar (gespeicherter Wert 3)`, () => {
      selectComponent(ctx, 'w');
      selectSize(ctx, 5);
      assert.strictEqual(ctx.cardsById['orig-100i'].style.display, 'none', `[${lang.label}] orig-100i sollte bei Waffe+S5 ausgeblendet sein (w=3 < 5)`);
    });

    test(`[${lang.label}] Ankerschiff aegs-hammerhead ist bei Turm+S5 sichtbar (gespeicherter Wert 5)`, () => {
      selectComponent(ctx, 't');
      selectSize(ctx, 5);
      assert.strictEqual(ctx.cardsById['aegs-hammerhead'].style.display, '', `[${lang.label}] aegs-hammerhead sollte bei Turm+S5 sichtbar sein (t=5 >= 5)`);
    });

    test(`[${lang.label}] D-11: Bauteilart ohne Groesse filtert noch nicht -- alle Karten bleiben sichtbar`, () => {
      selectComponent(ctx, 'w');
      assert.strictEqual(visibleIds(ctx).size, TOTAL, `[${lang.label}] erwartet ${TOTAL} sichtbare Karten ohne gesetzte Groesse`);
    });

    test(`[${lang.label}] D-11: sf-compsize ist deaktiviert, bis eine Bauteilart gewaehlt ist`, () => {
      assert.strictEqual(ctx.elements['sf-compsize'].disabled, true, `[${lang.label}] sf-compsize sollte anfangs deaktiviert sein`);
      selectComponent(ctx, 'w');
      assert.strictEqual(ctx.elements['sf-compsize'].disabled, false, `[${lang.label}] sf-compsize sollte nach Wahl der Bauteilart freigeschaltet sein`);
    });

    test(`[${lang.label}] D-10: die Groessenliste reicht je Kategorie bis zum groessten gespeicherten Wert`, () => {
      for (const letter of ['s', 'w', 't']) {
        selectComponent(ctx, letter);
        const expected = maxFor(letter) + 1; // + Leereintrag
        assert.strictEqual(
          ctx.elements['sf-compsize'].options.length,
          expected,
          `[${lang.label}] Kategorie "${letter}": erwartet ${expected} Eintraege (${maxFor(letter)} Groessen + Leereintrag)`
        );
      }
    });

    test(`[${lang.label}] D-10: die Groesseneintraege tragen die Beschriftung dieser Sprache`, () => {
      selectComponent(ctx, 's');
      const first = ctx.elements['sf-compsize'].options[1];
      assert.strictEqual(first.textContent, L.andup.replace('{n}', '1'), `[${lang.label}] erster Groesseneintrag falsch beschriftet`);
    });

    test(`[${lang.label}] D-08: ohne aktiven Bauteilfilter bleibt der Zaehlertext unveraendert`, () => {
      assert.strictEqual(ctx.elements['sf-count'].textContent, results(TOTAL), `[${lang.label}] Ausgangszaehler weicht ab`);
    });

    test(`[${lang.label}] D-08: bei aktivem Bauteilfilter nennt der Zaehler die Schiffe ohne Steckplatz-Daten`, () => {
      const expected = idsWithAtLeast('w', 5);
      selectComponent(ctx, 'w');
      selectSize(ctx, 5);
      assert.strictEqual(
        ctx.elements['sf-count'].textContent,
        withNoData(expected.size, idsWithoutData.size),
        `[${lang.label}] Zaehlertext bei aktivem Bauteilfilter weicht ab`
      );
      assert.strictEqual(idsWithoutData.size, 4, 'Vorbedingung: erwartet 4 Schiffe ohne Steckplatz-Daten');
    });

    test(`[${lang.label}] D-12: Bauteilfilter + Herstellerfeld ergeben die Schnittmenge, Zaehler stimmt`, () => {
      const maker = 'orig';
      const expected = new Set([...idsWithAtLeast('w', 3)].filter((id) => id.startsWith(maker + '-')));
      selectComponent(ctx, 'w');
      selectSize(ctx, 3);
      selectMaker(ctx, maker);
      assert.deepStrictEqual(visibleIds(ctx), expected, `[${lang.label}] Schnittmenge aus w>=3 und Hersteller "${maker}" weicht ab`);
      assert.strictEqual(
        ctx.elements['sf-count'].textContent,
        withNoData(expected.size, 0),
        `[${lang.label}] Zaehler bei kombiniertem Filter weicht ab (0 ohne Steckplatz-Daten, weil kein orig-Schiff in der Fehlliste steht)`
      );
    });

    test(`[${lang.label}] Wechsel der Bauteilart setzt die Groessenwahl zurueck`, () => {
      selectComponent(ctx, 'w');
      selectSize(ctx, 5);
      selectComponent(ctx, 's');
      assert.strictEqual(ctx.elements['sf-compsize'].value, '', `[${lang.label}] die Groessenwahl der vorigen Kategorie steht noch`);
      assert.strictEqual(visibleIds(ctx).size, TOTAL, `[${lang.label}] nach dem Wechsel darf noch nicht gefiltert sein (D-11)`);
    });
  });
}
