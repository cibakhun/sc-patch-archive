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
function run(lang, search = '') {
  const ctx = makeShipsDomContext({ lang, search });
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

    // UX-Audit 24.11.2026 (TF B03) loest D-11 ab: "Turm" allein heisst "hat
    // einen Turm". Vorher blieben alle Karten stehen, bis eine Mindestgroesse
    // gewaehlt war.
    test(`[${lang.label}] Bauteilart ohne Groesse filtert ab S1 -- Turm zeigt genau die Schiffe mit Turm`, () => {
      const expected = idsWithAtLeast('t', 1);
      selectComponent(ctx, 't');
      assert.deepStrictEqual(visibleIds(ctx), expected, `[${lang.label}] Turm ohne Groesse weicht von t>=1 ab`);
      assert.ok(expected.size > 0 && expected.size < TOTAL, `[${lang.label}] Vorbedingung: Turm trennt (${expected.size} von ${TOTAL})`);
      assert.strictEqual(
        ctx.elements['sf-count'].textContent,
        withNoData(expected.size, idsWithoutData.size),
        `[${lang.label}] Zaehler nennt bei Bauteil ohne Groesse die Schiffe ohne Steckplatz-Daten nicht`
      );
    });

    test(`[${lang.label}] sf-compsize ist deaktiviert, bis eine Bauteilart gewaehlt ist, und nennt den Grund`, () => {
      const sel = ctx.elements['sf-compsize'];
      assert.strictEqual(sel.disabled, true, `[${lang.label}] sf-compsize sollte anfangs deaktiviert sein`);
      assert.strictEqual(sel.options[0].textContent, L.off, `[${lang.label}] gesperrt nennt der Leereintrag den Grund nicht`);
      selectComponent(ctx, 'w');
      assert.strictEqual(sel.disabled, false, `[${lang.label}] sf-compsize sollte nach Wahl der Bauteilart freigeschaltet sein`);
      assert.strictEqual(sel.options[0].textContent, L.any, `[${lang.label}] freigeschaltet heisst der Leereintrag nicht "beliebig"`);
      selectComponent(ctx, '');
      assert.strictEqual(sel.disabled, true, `[${lang.label}] ohne Bauteilart wieder gesperrt`);
      assert.strictEqual(sel.options[0].textContent, L.off, `[${lang.label}] zurueckgesperrt fehlt der Grund`);
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
      // Vorbedingung: der Zweig "ohne Steckplatz-Daten" ist nur geprueft, wenn
      // es solche Schiffe gibt. Das sind genau die ATLS-Anzuege, deren
      // Implementations-XML keine Steckplaetze traegt (bis CL 13165946 vier,
      // seit dem Hotfix 4.10.3, CL 13220821, acht: grad02, IKTI, GEO IKTI und
      // GEO IKTI NTLS kamen dazu). Faellt ein anderes Schiff heraus, reisst es.
      assert.ok(idsWithoutData.size > 0, 'Vorbedingung: mindestens ein Schiff ohne Steckplatz-Daten');
      assert.deepStrictEqual(
        [...idsWithoutData].filter((id) => !id.startsWith('argo-atls')),
        [],
        'Vorbedingung: ohne Steckplatz-Daten sind nur ATLS-Anzuege erwartet'
      );
      assert.deepStrictEqual([...idsWithoutData].sort(), [...comp.missing].sort(), 'Vorbedingung: Fehlliste in ship-components.json weicht ab');
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
      assert.deepStrictEqual(visibleIds(ctx), idsWithAtLeast('s', 1), `[${lang.label}] nach dem Wechsel gilt die neue Art ab S1`);
    });
  });
}

// ---- Sortierung und Zustand in der Adresse (UX-Audit 24.11.2026) ----------
// Die Karten im Nachbau tragen keine Preise (-1). Fuer die Sortierproben
// bekommen drei Karten Werte, der Rest bleibt "ohne Preis".
function preise(ctx) {
  const [a, b, c] = ctx.ids;
  ctx.cardsById[a].setAttribute('data-game', '500');
  ctx.cardsById[b].setAttribute('data-game', '100');
  ctx.cardsById[c].setAttribute('data-game', '300');
  return [a, b, c];
}
function reihenfolge(ctx) {
  return ctx.elements['sf-fleet'].children.filter((k) => k.className === 'fcard').map((k) => k.getAttribute('data-q'));
}
function waehle(ctx, id, value) {
  ctx.elements[id].value = value;
  ctx.elements[id].dispatchEvent({ type: 'change' });
}

describe('Sortierung: Preise in beide Richtungen (TF B02)', () => {
  test('Ingame-Preis aufsteigend: guenstigstes zuerst, Karten ohne Preis am Ende', () => {
    const ctx = run('de');
    const [a, b, c] = preise(ctx);
    waehle(ctx, 'sf-sort', 'game-asc');
    const r = reihenfolge(ctx);
    assert.deepStrictEqual(r.slice(0, 3), [b, c, a], 'aufsteigend falsch');
    assert.strictEqual(r.length, ctx.ids.length, 'beim Sortieren ging eine Karte verloren');
  });
  test('Ingame-Preis absteigend bleibt wie bisher: teuerstes zuerst, ohne Preis am Ende', () => {
    const ctx = run('de');
    const [a, b, c] = preise(ctx);
    waehle(ctx, 'sf-sort', 'game');
    assert.deepStrictEqual(reihenfolge(ctx).slice(0, 3), [a, c, b], 'absteigend falsch');
  });
  test('zurueck auf Name stellt die Ausgangsreihenfolge her', () => {
    const ctx = run('de');
    preise(ctx);
    waehle(ctx, 'sf-sort', 'game-asc');
    waehle(ctx, 'sf-sort', 'name');
    assert.deepStrictEqual(reihenfolge(ctx), ctx.ids, 'Name A-Z stellt die Reihenfolge nicht wieder her');
  });
});

describe('Zustand in der Adresse (HE B05, TF T2)', () => {
  test('ohne Adresszusatz: nichts gefiltert, nichts umgeschrieben', () => {
    const ctx = run('de');
    assert.strictEqual(visibleIds(ctx).size, TOTAL);
    assert.deepStrictEqual(ctx.urls, [], 'das Laden darf die Adresse nicht anfassen');
    assert.strictEqual(ctx.elements['sf-sort'].value, 'name');
  });

  test('Laden mit Adresszusatz stellt Felder UND Liste her (auch ohne Zurueck-Cache)', () => {
    const ctx = run('de', '?maker=orig&comp=w&compsize=3');
    assert.strictEqual(ctx.elements['sf-maker'].value, 'orig');
    assert.strictEqual(ctx.elements['sf-comp'].value, 'w');
    assert.strictEqual(ctx.elements['sf-compsize'].value, '3');
    assert.strictEqual(ctx.elements['sf-compsize'].disabled, false);
    const expected = new Set([...idsWithAtLeast('w', 3)].filter((id) => id.startsWith('orig-')));
    assert.deepStrictEqual(visibleIds(ctx), expected, 'Liste passt nicht zur Auswahl aus der Adresse');
    assert.deepStrictEqual(ctx.urls, [], 'das Lesen darf die Adresse nicht umschreiben');
  });

  test('unbekannte Werte fallen auf den Ausgangswert zurueck', () => {
    const ctx = run('en', '?maker=gibtsnicht&sort=quatsch&compsize=4');
    assert.strictEqual(ctx.elements['sf-maker'].value, '');
    assert.strictEqual(ctx.elements['sf-sort'].value, 'name');
    assert.strictEqual(ctx.elements['sf-compsize'].value, '', 'Groesse ohne Bauteilart darf nicht greifen');
    assert.strictEqual(visibleIds(ctx).size, TOTAL);
  });

  test('Sortierung aus der Adresse greift beim Laden', () => {
    const ctx = makeShipsDomContext({ lang: 'de', search: '?sort=game-asc' });
    const [a, b, c] = preise(ctx);
    vm.runInContext(bodyScript, vm.createContext(ctx));
    assert.deepStrictEqual(reihenfolge(ctx).slice(0, 3), [b, c, a]);
  });

  test('Felder ueberschreibt die Adresse, auch wenn der Browser etwas anderes hineinschrieb', () => {
    const ctx = makeShipsDomContext({ lang: 'de', search: '' });
    // Zuruecknavigieren ohne Cache: der Browser stellt die Auswahl her, die
    // Adresse sagt "keine Auswahl" — gewinnen muss die Adresse.
    ctx.elements['sf-maker'].value = 'orig';
    vm.runInContext(bodyScript, vm.createContext(ctx));
    assert.strictEqual(ctx.elements['sf-maker'].value, '');
    assert.strictEqual(visibleIds(ctx).size, TOTAL);
  });

  test('jede Auswahl schreibt die Adresse, Ausgangswerte fallen heraus, fremde Zusaetze bleiben', () => {
    const ctx = run('de', '?utm_source=x');
    selectMaker(ctx, 'orig');
    assert.strictEqual(ctx.urls.at(-1), '/schiffe.html?utm_source=x&maker=orig');
    selectComponent(ctx, 't');
    selectSize(ctx, 2);
    waehle(ctx, 'sf-sort', 'pledge-asc');
    assert.strictEqual(ctx.urls.at(-1), '/schiffe.html?utm_source=x&maker=orig&comp=t&compsize=2&sort=pledge-asc');
    selectComponent(ctx, '');
    waehle(ctx, 'sf-sort', 'name');
    selectMaker(ctx, '');
    assert.strictEqual(ctx.urls.at(-1), '/schiffe.html?utm_source=x', 'Ausgangswerte und gesperrte Felder gehoeren nicht in die Adresse');
  });

  test('geschriebene Adresse stellt beim naechsten Laden denselben Stand her (Rundreise)', () => {
    const a = run('de');
    selectMaker(a, 'orig');
    selectComponent(a, 'w');
    selectSize(a, 3);
    const url = a.urls.at(-1);
    const b = run('de', url.slice(url.indexOf('?')));
    assert.deepStrictEqual(visibleIds(b), visibleIds(a));
    assert.strictEqual(b.elements['sf-count'].textContent, a.elements['sf-count'].textContent);
  });
});

describe('Filter-Schublade auf dem Handy (TF V26/M4)', () => {
  test('Knopf oeffnet und schliesst, aria-expanded laeuft mit', () => {
    const ctx = run('de');
    const mehr = ctx.elements['sf-mehr'];
    const knopf = ctx.elements['sf-toggle'];
    knopf.click();
    assert.ok(mehr.classList.contains('is-open'));
    assert.strictEqual(knopf.getAttribute('aria-expanded'), 'true');
    ctx.elements['sf-close'].click();
    assert.ok(!mehr.classList.contains('is-open'));
    assert.strictEqual(knopf.getAttribute('aria-expanded'), 'false');
    knopf.click();
    ctx.elements['sf-show'].click();
    assert.ok(!mehr.classList.contains('is-open'), '"N Treffer anzeigen" schliesst wie das Kreuz');
  });

  test('der Knopf zaehlt gesetzte Filter, die Mindestgroesse nicht eigens', () => {
    const ctx = run('de');
    const knopf = ctx.elements['sf-toggle'];
    assert.strictEqual(knopf.getAttribute('data-n'), null);
    selectMaker(ctx, 'orig');
    assert.strictEqual(knopf.getAttribute('data-n'), '1');
    selectComponent(ctx, 'w');
    selectSize(ctx, 3);
    assert.strictEqual(knopf.getAttribute('data-n'), '2');
    selectComponent(ctx, '');
    selectMaker(ctx, '');
    assert.strictEqual(knopf.getAttribute('data-n'), null);
  });

  test('"N Treffer anzeigen" nennt die Zahl der sichtbaren Karten', () => {
    for (const lang of ['de', 'en']) {
      const ctx = run(lang);
      selectMaker(ctx, 'orig');
      const n = visibleIds(ctx).size;
      assert.ok(n > 0 && n < TOTAL);
      assert.strictEqual(ctx.elements['sf-show'].textContent, LABELS[lang].show.replace('{n}', String(n)));
      assert.ok(!ctx.elements['sf-show'].classList.contains('is-leer'));
    }
  });

  test('ohne Treffer sagt der Knopf das und wird grau', () => {
    const ctx = run('de');
    ctx.elements['sf-q'].value = 'gibtsnichtxyz';
    assert.strictEqual(visibleIds(ctx).size, 0);
    assert.strictEqual(ctx.elements['sf-show'].textContent, LABELS.de.none);
    assert.ok(ctx.elements['sf-show'].classList.contains('is-leer'));
  });

  test('Zuruecksetzen nimmt die acht Felder zurueck, Suche und Sortierung bleiben', () => {
    const ctx = run('de', '?q=a&maker=orig&comp=w&compsize=3&sort=pledge-asc');
    ctx.elements['sf-reset'].click();
    for (const id of ['sf-maker', 'sf-career', 'sf-rolefam', 'sf-size', 'sf-sig', 'sf-feat', 'sf-comp', 'sf-compsize']) {
      assert.strictEqual(ctx.elements[id].value, '', id + ' ist nicht zurueckgesetzt');
    }
    assert.strictEqual(ctx.elements['sf-compsize'].disabled, true);
    assert.strictEqual(ctx.elements['sf-q'].value, 'a');
    assert.strictEqual(ctx.elements['sf-sort'].value, 'pledge-asc');
    assert.strictEqual(ctx.urls.at(-1), '/schiffe.html?q=a&sort=pledge-asc');
    assert.strictEqual(ctx.elements['sf-toggle'].getAttribute('data-n'), null);
  });
});
