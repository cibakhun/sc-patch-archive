// Der Suchkern (assets/smart-suche.js), den Schiffsfinder im Hangar und Suche
// der Items-Werkbank teilen (Krisz 27.11.2026: „können wir bei items dieses
// smart search was wir bei den schiffen schon haben in der hangar?“). Der
// Hangar importiert ihn statisch, die Werkbank per import(); hier die reinen
// Funktionen, die beide gleich brauchen. Das Verhalten im Hangar sichern
// weiter tests/e2e/hangar-state.test.js und verify-hangar [19].
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fold, editDistance, slack, menge, preisMuster, erkenne, wortWert, ohneBegriff } from '../../assets/smart-suche.js';
import * as hangar from '../../assets/hangar-overview.js';

describe('Suchkern', () => {
  test('fold: klein, ohne Akzente, ß als ss, Apostrophe weg, ein Leerzeichen', () => {
    assert.equal(fold('  Großer  JÄGER '), 'grosser jager');
    assert.equal(fold("Kilgore's"), 'kilgores');
    assert.equal(fold(null), '');
  });

  test('editDistance: Vertauschung zaehlt eins, Abbruch ueber max', () => {
    assert.equal(editDistance('prospektor', 'prospector'), 1);
    assert.equal(editDistance('behrnig', 'behring'), 1);
    assert.equal(editDistance('abc', 'xyz', 1), 2);
    assert.deepEqual([slack(3), slack(4), slack(8)], [0, 1, 2]);
  });

  test('menge und preisMuster: Einheiten, Komma, nackte Zahl je Seite', () => {
    assert.equal(menge('2,5', 'mio'), 2_500_000);
    assert.equal(menge('10', 'k'), 10_000);
    const items = erkenne('helm unter 10k', {}, [], [preisMuster()]);
    assert.deepEqual(items.hits, [{ kind: 'price', key: 10_000, t: 'unter 10k' }]);
    assert.equal(erkenne('bis 500', {}, [], [preisMuster()]).hits[0].key, 500);
    // Im Hangar meint eine nackte Zahl unter 1000 Millionen.
    assert.equal(erkenne('unter 3', {}, [], [preisMuster((n) => (Number(n) < 1000 ? 'm' : ''))]).hits[0].key, 3_000_000);
  });

  test('erkenne: laengere Wendung zuerst, Art in ihrer Folge, Rest bleibt frei', () => {
    const vocab = {
      kat: [{ k: 'helme', w: ['helm', 'helmet'] }],
      pk: [{ k: 'Heavy', w: ['schwer', 'heavy'] }, { k: 'SuperHeavy', w: ['super heavy'] }],
      sys: [{ k: 'pyro', w: ['pyro'] }],
      nick: { cutty: 'cutlass' },
    };
    const r = erkenne('Super Heavy Helm Pyro Morozov', vocab, ['kat', 'pk', 'sys']);
    assert.deepEqual(r.hits.map((h) => `${h.kind}:${h.key}:${h.t}`), ['pk:SuperHeavy:super heavy', 'kat:helme:helm', 'sys:pyro:pyro']);
    assert.deepEqual(r.words, ['morozov']);
    assert.deepEqual(erkenne('cutty', vocab, []).words, ['cutlass']);
    // Derselbe Begriff zweimal ist ein Treffer, und keiner bleibt als freies Wort.
    const zwei = erkenne('pyro pyro', vocab, ['sys']);
    assert.equal(zwei.hits.length, 1);
    assert.deepEqual(zwei.words, []);
    assert.deepEqual(erkenne('helm pyro helmet pyro', vocab, ['kat', 'sys']).words, []);
  });

  test('wortWert: ganzes Wort vor Anfang vor Teilstueck vor Tippfehler, Rest ab drei Zeichen', () => {
    const felder = [[['morozov', 'helmet'], 100, 80, 35], [['roussimoff'], 60, 45, 20]];
    assert.equal(wortWert('morozov', felder, 'morozov helmet roussimoff'), 100);
    assert.equal(wortWert('moro', felder, ''), 80);
    assert.equal(wortWert('ozov', felder, ''), 60);
    assert.equal(wortWert('morzov', felder, '', false), 0);
    assert.equal(wortWert('morzov', felder, '', true), 35);
    assert.equal(wortWert('roussimof', felder, '', true), 45);
    assert.equal(wortWert('lorville', felder, 'morozov area18'), 0);
    assert.equal(wortWert('lorv', [[[], 100, 80, 35]], 'shop in lorville'), 40);
  });

  test('ohneBegriff: nimmt die Wortfolge im Wortlaut des Besuchers heraus', () => {
    assert.equal(ohneBegriff('Pyro  Helme', 'pyro'), 'Helme');
    assert.equal(ohneBegriff('Morozov Super Heavy', 'super heavy'), 'Morozov');
    assert.equal(ohneBegriff('Größe 3 Laser', 'grosse 3'), 'Laser');
    // Jedes Vorkommen, sonst kaeme der Chip nach dem Klick wieder.
    assert.equal(ohneBegriff('Pyro Helm pyro', 'pyro'), 'Helm');
  });

  test('der Hangar nutzt denselben Kern', () => {
    assert.equal(hangar.fold, fold);
    assert.equal(hangar.editDistance, editDistance);
  });
});
