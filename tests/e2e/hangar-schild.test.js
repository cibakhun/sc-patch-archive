// Schild der Werkstatt (UX-Prüfung P19): Es laufen höchstens zwei
// Schildgeneratoren gleichzeitig, und der Schildwert eines Schiffs ist die
// Summe der zwei stärksten. Die Prospector hat drei Generatoren zu je 2.160 HP
// und 4.320 HP Schild; Hangar und Loadout zeigten 6.480. Hier: die Auswahl der
// laufenden Generatoren, die Gruppensumme der Werkstatt in Serie und nach
// einem Tausch, und die Konstante in bay.ts (Seitenkopf der Bucht), die
// dieselbe Zahl tragen muss wie die im Skript.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aktiveSchilde, groupTotals, shipSlots, SCHILDE_AKTIV } from '../../assets/hangar-layouts.js';

const items = {
  // Format von /hangar-layouts.json: [name, de, typ, groesse, hersteller, klasse, guete, hp, …]
  'fr-66': ['FR-66', 0, 'shield', 1, 'Gorgon', 'Industrial', 'C', 2160, {}, 0],
  'palisade': ['Palisade', 0, 'shield', 1, 'Seal Corp', 'Military', 'B', 3900, {}, 0],
  'allstop': ['AllStop', 0, 'shield', 1, 'Gorgon', 'Military', 'C', 3168, {}, 0],
  'mantis': ['Mantis GT-220 Gatling', 0, 'gun', 3, 'Gallenson', 0, 'A', 853, { dt: 'p' }, 0],
};
const hp = (k) => items[k][7];

// Prospector: drei Generatoren an drei Ports, dazu eine Waffe, die nicht mitzählt
const prospector = shipSlots([
  ['shield_generator_1', 'shield', 1, 'fr-66', 'shield', 1],
  ['shield_generator_2', 'shield', 1, 'fr-66', 'shield', 1],
  ['shield_generator_3', 'shield', 1, 'fr-66', 'shield', 1],
  ['gun_nose', 'gun', 3, 'mantis', 'pilot', 1],
]);

describe('Schild: höchstens zwei Generatoren laufen', () => {
  test('zwei laufen, wie bei allen Schiffen im Datenstand', () => {
    assert.equal(SCHILDE_AKTIV, 2);
  });

  test('die stärksten laufen, je Stück einmal gezählt', () => {
    assert.deepEqual(aktiveSchilde([['fr-66', 3]], hp), ['fr-66', 'fr-66']);
    assert.deepEqual(aktiveSchilde([['fr-66', 1], ['palisade', 1], ['allstop', 1]], hp), ['palisade', 'allstop']);
    // ein Port mit zwei Stück zählt doppelt, nicht einmal
    assert.deepEqual(aktiveSchilde([['palisade', 2], ['allstop', 1]], hp), ['palisade', 'palisade']);
  });

  test('weniger als zwei, keiner oder eine leere Zahl: nichts erfunden', () => {
    assert.deepEqual(aktiveSchilde([['allstop', 1]], hp), ['allstop']);
    assert.deepEqual(aktiveSchilde([], hp), []);
    assert.deepEqual(aktiveSchilde([['allstop', 0], ['palisade', -1]], hp), []);
  });

  test('Prospector in Serie: 4.320 HP Schild, nicht 6.480', () => {
    const t = groupTotals(prospector, {}, items);
    assert.deepEqual(t.get('shield'), { now: 4320, stock: 4320 });
    assert.deepEqual(t.get('pilot'), { now: 853, stock: 853 }, 'andere Gruppen zählen weiter jedes Stück');
  });

  test('ein stärkerer Generator ersetzt einen schwachen in der Summe, ein dritter schwacher ändert nichts', () => {
    const eins = groupTotals(prospector, { shield_generator_3: 'palisade' }, items).get('shield');
    assert.deepEqual(eins, { now: 3900 + 2160, stock: 4320 });
    const zwei = groupTotals(prospector, { shield_generator_1: 'palisade', shield_generator_3: 'palisade' }, items).get('shield');
    assert.deepEqual(zwei, { now: 3900 * 2, stock: 4320 });
  });

  test('ein Schiff ohne Generator hat keine Schildsumme', () => {
    const t = groupTotals(shipSlots([['gun_nose', 'gun', 3, 'mantis', 'pilot', 1]]), {}, items);
    assert.equal(t.has('shield'), false);
  });

  test('bay.ts zählt mit derselben Zahl wie das Skript', () => {
    const src = readFileSync(new URL('../../src/lib/hangar/bay.ts', import.meta.url), 'utf8');
    const m = src.match(/^const SCHILDE_AKTIV = (\d+);/m);
    assert.ok(m, 'const SCHILDE_AKTIV in bay.ts nicht gefunden');
    assert.equal(Number(m[1]), SCHILDE_AKTIV);
  });
});
