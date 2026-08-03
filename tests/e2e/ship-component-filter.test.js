// Automatisierter Verhaltensnachweis fuer den Komponenten-Filter der
// Schiffsliste (Phase 5, Plan 03) -- deckt D-04, D-08, D-10, D-11 und D-12 ab
// UND belegt die Sprachparitaet zwischen src/pages/schiffe.astro (EN) und
// src/pages/de/schiffe.astro (DE).
//
// Warum ueberhaupt: die 67 EN/DE-Seitenpaare werden von Hand doppelt
// gepflegt (Class-A-Befund, .planning/codebase/CONCERNS.md), und nichts im
// Build vergleicht sie. Dieser Test zieht das ECHTE Inline-Skript aus BEIDEN
// .astro-Quellen, fuehrt es gegen ein frisches Mock-DOM aus (node:vm, kein
// Browser noetig) und prueft beide Sprachfassungen mit identischen
// Erwartungen. Faellt eine Sprachfassung von der anderen ab, oder verletzt
// eine der Filterentscheidungen D-04/D-08/D-10/D-11/D-12, schlaegt der Test
// fehl -- in Sekunden, nicht in einer manuellen Browser-Sitzung.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { makeShipsDomContext } from './helpers/ships-dom.js';

const EN_PATH = path.resolve('src/pages/schiffe.astro');
const DE_PATH = path.resolve('src/pages/de/schiffe.astro');

const enSource = fs.readFileSync(EN_PATH, 'utf8');
const deSource = fs.readFileSync(DE_PATH, 'utf8');

// Zieht den Rumpf des <script is:inline> ... </script>-Blocks. Es ist je
// Datei genau EIN solcher Block, und er wird unveraendert ausgeliefert
// (Inline-Skripte werden von Astro nicht transformiert) -- die Quelle taugt
// deshalb direkt als Pruefgegenstand.
function extractInlineScript(source, label) {
  const m = source.match(/<script is:inline>([\s\S]*?)<\/script>/);
  assert.ok(m, `[${label}] kein <script is:inline>-Block gefunden`);
  return m[1];
}

const enScript = extractInlineScript(enSource, 'EN');
const deScript = extractInlineScript(deSource, 'DE');

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

const hardpoints = JSON.parse(fs.readFileSync(path.resolve('src/data/ship-hardpoints.json'), 'utf8'));
const idsWithoutData = new Set(Object.keys(hardpoints.ships).filter((id) => !(id in comp.ships)));

// Fuehrt das echte Inline-Skript EINER Sprachfassung gegen einen frischen
// Mock-DOM-Kontext aus. Ein Kontext pro Aufruf -- kein geteilter Zustand
// zwischen Testfaellen.
function run(script, lang) {
  const ctx = makeShipsDomContext({ lang });
  const context = vm.createContext(ctx);
  vm.runInContext(script, context);
  return ctx;
}

// Sichtbare Karten-Ids nach dem aktuellen Filterstand (c.style.display !== 'none').
function visibleIds(ctx) {
  return new Set(
    ctx.ids.filter((id) => ctx.cardsById[id].style.display !== 'none')
  );
}

function selectComponent(ctx, letter) {
  ctx.elements['sf-comp'].value = letter;
}
function selectSize(ctx, size) {
  ctx.elements['sf-size'].value = size == null ? '' : String(size);
}
function selectMaker(ctx, maker) {
  ctx.elements['sf-maker'].value = maker;
}

const LANGS = [
  { label: 'EN', lang: 'en', script: enScript, countSuffix: (n) => `${n} results`, noDataSuffix: (n, noData) => `${n} results · ${noData} without slot data` },
  { label: 'DE', lang: 'de', script: deScript, countSuffix: (n) => `${n} Treffer`, noDataSuffix: (n, noData) => `${n} Treffer · ${noData} ohne Steckplatz-Daten` },
];

describe('Quellpruefungen (Sprachparitaet an der Naht zum Server)', () => {
  for (const { label, source } of [
    { label: 'EN', source: enSource },
    { label: 'DE', source: deSource },
  ]) {
    test(`[${label}] ruft compAttr am Kartenelement auf`, () => {
      assert.match(source, /data-comp=\{compAttr\(id\)\}/, `[${label}] data-comp={compAttr(id)} fehlt am fcard-Element`);
    });
    test(`[${label}] traegt die Ids sf-comp und sf-size`, () => {
      assert.match(source, /id="sf-comp"/, `[${label}] id="sf-comp" fehlt`);
      assert.match(source, /id="sf-size"/, `[${label}] id="sf-size" fehlt`);
    });
  }
});

for (const lang of LANGS) {
  describe(`Komponenten-Filter [${lang.label}]`, () => {
    let ctx;
    beforeEach(() => {
      ctx = run(lang.script, lang.lang);
    });

    test(`[${lang.label}] D-04: Waffe + S5 zeigt genau die Schiffe mit gespeichertem w>=5`, () => {
      const expected = idsWithAtLeast('w', 5);
      selectComponent(ctx, 'w');
      selectSize(ctx, 5);
      const visible = visibleIds(ctx);
      assert.deepStrictEqual(
        visible,
        expected,
        `[${lang.label}] sichtbare Ids bei w>=5 weichen von der aus ship-components.json berechneten Sollmenge ab`
      );
    });

    test(`[${lang.label}] Ankerschiff orig-100i ist bei Waffe+S5 NICHT sichtbar (gespeicherter Wert 3)`, () => {
      selectComponent(ctx, 'w');
      selectSize(ctx, 5);
      assert.strictEqual(
        ctx.cardsById['orig-100i'].style.display,
        'none',
        `[${lang.label}] orig-100i sollte bei Waffe+S5 ausgeblendet sein (w=3 < 5)`
      );
    });

    test(`[${lang.label}] Ankerschiff aegs-hammerhead ist bei Turm+S5 sichtbar (gespeicherter Wert 5)`, () => {
      selectComponent(ctx, 't');
      selectSize(ctx, 5);
      assert.strictEqual(
        ctx.cardsById['aegs-hammerhead'].style.display,
        '',
        `[${lang.label}] aegs-hammerhead sollte bei Turm+S5 sichtbar sein (t=5 >= 5)`
      );
    });

    test(`[${lang.label}] D-11: Bauteilart ohne Groesse filtert noch nicht -- alle 227 Karten bleiben sichtbar`, () => {
      selectComponent(ctx, 'w');
      const visible = visibleIds(ctx);
      assert.strictEqual(
        visible.size,
        227,
        `[${lang.label}] erwartet 227 sichtbare Karten ohne gesetzte Groesse, gemessen: ${visible.size}`
      );
    });

    test(`[${lang.label}] D-11: sf-size ist deaktiviert, bis eine Bauteilart gewaehlt ist`, () => {
      assert.strictEqual(ctx.elements['sf-size'].disabled, true, `[${lang.label}] sf-size sollte anfangs deaktiviert sein`);
      selectComponent(ctx, 'w');
      assert.strictEqual(ctx.elements['sf-size'].disabled, false, `[${lang.label}] sf-size sollte nach Wahl der Bauteilart freigeschaltet sein`);
    });

    test(`[${lang.label}] D-10: Groessenliste fuer Schild hat 4 Eintraege + Leereintrag`, () => {
      selectComponent(ctx, 's');
      assert.strictEqual(
        ctx.elements['sf-size'].options.length,
        5,
        `[${lang.label}] erwartet 5 Eintraege (4 Groessen + Leereintrag) fuer Schild, gemessen: ${ctx.elements['sf-size'].options.length}`
      );
    });

    test(`[${lang.label}] D-10: Groessenliste fuer Waffe hat 10 Eintraege + Leereintrag`, () => {
      selectComponent(ctx, 'w');
      assert.strictEqual(
        ctx.elements['sf-size'].options.length,
        11,
        `[${lang.label}] erwartet 11 Eintraege (10 Groessen + Leereintrag) fuer Waffe, gemessen: ${ctx.elements['sf-size'].options.length}`
      );
    });

    test(`[${lang.label}] D-08: ohne aktiven Bauteilfilter bleibt der Zaehlertext unveraendert`, () => {
      assert.strictEqual(
        ctx.elements['sf-count'].textContent,
        lang.countSuffix(227),
        `[${lang.label}] Ausgangszaehler weicht ab`
      );
    });

    test(`[${lang.label}] D-08: bei aktivem Bauteilfilter nennt der Zaehler die Schiffe ohne Steckplatz-Daten`, () => {
      const expected = idsWithAtLeast('w', 5);
      selectComponent(ctx, 'w');
      selectSize(ctx, 5);
      assert.strictEqual(
        ctx.elements['sf-count'].textContent,
        lang.noDataSuffix(expected.size, idsWithoutData.size),
        `[${lang.label}] Zaehlertext bei aktivem Bauteilfilter weicht ab`
      );
      assert.strictEqual(idsWithoutData.size, 4, `[${lang.label}] Vorbedingung: erwartet 4 Schiffe ohne Steckplatz-Daten`);
    });

    test(`[${lang.label}] D-12: Bauteilfilter + Herstellerfeld ergeben die Schnittmenge, Zaehler stimmt`, () => {
      const maker = 'orig';
      const expected = new Set(
        [...idsWithAtLeast('w', 3)].filter((id) => id.startsWith(maker + '-'))
      );
      selectComponent(ctx, 'w');
      selectSize(ctx, 3);
      selectMaker(ctx, maker);
      const visible = visibleIds(ctx);
      assert.deepStrictEqual(
        visible,
        expected,
        `[${lang.label}] Schnittmenge aus Bauteilfilter (w>=3) und Hersteller "${maker}" weicht ab`
      );
      assert.strictEqual(
        ctx.elements['sf-count'].textContent,
        lang.noDataSuffix(expected.size, 0),
        `[${lang.label}] Zaehler bei kombiniertem Filter weicht ab (0 ohne Steckplatz-Daten, weil kein orig-Schiff in der Fehlliste steht)`
      );
    });
  });
}

describe('Sprachparitaet (identische sichtbare Karten-Ids bei identischen Eingaben)', () => {
  test('Waffe + S5 liefert in EN und DE dieselbe Menge sichtbarer Ids', () => {
    const enCtx = run(enScript);
    const deCtx = run(deScript);
    selectComponent(enCtx, 'w');
    selectSize(enCtx, 5);
    selectComponent(deCtx, 'w');
    selectSize(deCtx, 5);
    assert.deepStrictEqual(visibleIds(enCtx), visibleIds(deCtx), 'EN und DE liefern unterschiedliche sichtbare Ids bei Waffe+S5');
  });

  test('Turm + S5 kombiniert mit Hersteller "aegs" liefert in EN und DE dieselbe Menge sichtbarer Ids', () => {
    const enCtx = run(enScript);
    const deCtx = run(deScript);
    selectComponent(enCtx, 't');
    selectSize(enCtx, 5);
    selectMaker(enCtx, 'aegs');
    selectComponent(deCtx, 't');
    selectSize(deCtx, 5);
    selectMaker(deCtx, 'aegs');
    assert.deepStrictEqual(visibleIds(enCtx), visibleIds(deCtx), 'EN und DE liefern unterschiedliche sichtbare Ids bei Turm+S5+aegs');
  });
});
