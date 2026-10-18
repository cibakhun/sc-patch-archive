// Die Layout-Werkstatt im Hangar (assets/hangar-layouts.js): ein Layout ist
// ein Link, der genau dieses Layout wieder oeffnet, auch mit Umlauten im
// Namen; ein Link aus einem aelteren Datenstand verliert nur die Teile, die
// nicht mehr passen; gespeicherte Layouts ueberleben einen kaputten oder
// gesperrten Speicher, ohne die Seite mitzureissen. Dazu die Naht zum
// Controller: der leere Code ist in beiden Dateien derselbe, und ?layout=
// reist durch parseState/serializeState unveraendert, auch beim Teilen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeLayout, decodeLayout, EMPTY_CODE, shipSlots, cleanSlots, candidates, deltaPct, groupTotals,
  sameLayout, createStore, STORE_KEY, MAX_NAME,
} from '../../assets/hangar-layouts.js';
import { EMPTY_LAYOUT, parseState, serializeState } from '../../assets/hangar-overview.js';

// Ein Ausschnitt im Format von /hangar-layouts.json (src/lib/hangar/layouts.ts).
const items = {
  'mantis': ['Mantis GT-220 Gatling', 'Mantis-GT-220-Gatling', 'gun', 3, 'Gallenson', 0, 'A', 853, { dt: 'p' }, 24045],
  'panther': ['CF-337 Panther Repeater', 0, 'gun', 3, 'Klaus & Werner', 0, 'A', 546, { dt: 'e' }, 0],
  'revenant': ['Revenant Gatling', 0, 'gun', 3, 'Anvil', 0, 'A', 1054, { dt: 'p' }, 56955],
  'small': ['Badger Repeater', 0, 'gun', 2, 'Klaus & Werner', 0, 'A', 400, {}, 0],
  'allstop': ['AllStop', 0, 'shield', 1, 'Gorgon', 'Military', 'C', 3168, {}, 0],
  'palisade': ['Palisade', 0, 'shield', 1, 'Seal Corp', 'Military', 'B', 3900, {}, 0],
};
const slots = shipSlots([
  ['gun_nose', 'gun', 3, 'mantis', 'pilot', 1],
  ['gun_left_wing', 'gun', 3, 'panther', 'pilot', 1],
  ['turret', 'gun', 3, 'panther', 'manned', 2],
  ['shield_generator_left', 'shield', 1, 'allstop', 'shield', 1],
]);

describe('Werkstatt: Link-Code', () => {
  test('ein Layout kommt aus seinem Code unveraendert zurueck, Umlaute eingeschlossen', () => {
    const lo = { name: 'Schildkröte · Nachtschicht', slots: { gun_nose: 'revenant', shield_generator_left: 'palisade' } };
    const code = encodeLayout(lo);
    assert.match(code, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeLayout(code), lo);
  });

  test('gleiche Layouts ergeben gleiche Codes, egal in welcher Folge die Slots kamen', () => {
    assert.equal(encodeLayout({ name: 'x', slots: { b: 'panther', a: 'mantis' } }), encodeLayout({ name: 'x', slots: { a: 'mantis', b: 'panther' } }));
  });

  test('der leere Code ist in Werkstatt und Controller derselbe', () => {
    assert.equal(EMPTY_CODE, EMPTY_LAYOUT);
    assert.deepEqual(decodeLayout(EMPTY_CODE), { name: '', slots: {} });
  });

  test('kaputte, fremde oder kuenftige Codes ergeben null statt eines halben Layouts', () => {
    assert.equal(decodeLayout(''), null);
    assert.equal(decodeLayout('%%%'), null);
    assert.equal(decodeLayout('bm9wZQ'), null); // "nope"
    assert.equal(decodeLayout(encodeLayout({ name: 'a', slots: {} }).replace('WzE', 'WzI')), null); // Version 2
    assert.equal(decodeLayout(null), null);
  });

  test('Name gekuerzt und entleert, Schluessel ausserhalb der Regel fallen weg', () => {
    const lo = decodeLayout(encodeLayout({ name: `  ${'x'.repeat(90)}  `, slots: { 'Gun Nose': 'mantis', ok_slot: 'Böse', gun_nose: 'revenant' } }));
    assert.equal(lo.name.length, MAX_NAME);
    assert.deepEqual(lo.slots, { gun_nose: 'revenant' });
  });

  test('?layout= reist durch den Zustand des Controllers, beim Teilen eingeschlossen', () => {
    const ctx = { ids: new Set(['aegs-gladius', 'anvl-arrow']), defaultShip: 'aegs-gladius', tabs: ['overview', 'weapons'], sorts: ['name'], types: new Set(), makers: new Set() };
    const code = encodeLayout({ name: 'Glaskanone', slots: { gun_nose: 'revenant' } });
    const s = parseState(`?ship=anvl-arrow&layout=${code}&q=arrow`, '', ctx);
    assert.equal(s.lo, code);
    assert.equal(serializeState(s, ctx), `?ship=anvl-arrow&layout=${code}&q=arrow`);
    assert.equal(serializeState(s, ctx, 'share'), `?ship=anvl-arrow&layout=${code}`);
    assert.equal(parseState('?layout=<script>', '', ctx).lo, null);
  });
});

describe('Werkstatt: passende Teile', () => {
  test('Kandidaten: dieselbe Art und Groesse, staerkster Kennwert zuerst', () => {
    assert.deepEqual(candidates(slots[0], items), ['revenant', 'mantis', 'panther']);
    assert.deepEqual(candidates(slots[3], items), ['palisade', 'allstop']);
  });

  test('ein alter Link verliert nur, was nicht mehr passt; Serie faellt still weg', () => {
    const { slots: clean, dropped } = cleanSlots({ gun_nose: 'small', gun_left_wing: 'revenant', turret: 'panther', gone_port: 'mantis', shield_generator_left: 'weg' }, slots, items);
    assert.deepEqual(clean, { gun_left_wing: 'revenant' });
    assert.equal(dropped, 3);
  });

  test('Abstand in ganzen Prozent, ohne Bezug keiner', () => {
    assert.equal(deltaPct(1054, 853), 24);
    assert.equal(deltaPct(546, 853), -36);
    assert.equal(deltaPct(5, 0), null);
    assert.equal(deltaPct(5, null), null);
  });

  test('Gruppensummen zaehlen Stueckzahlen und kennen die Serie', () => {
    const t = groupTotals(slots, { gun_nose: 'revenant', turret: 'mantis' }, items);
    assert.deepEqual(t.get('pilot'), { now: 1054 + 546, stock: 853 + 546 });
    assert.deepEqual(t.get('manned'), { now: 853 * 2, stock: 546 * 2 });
    assert.deepEqual(t.get('shield'), { now: 3168, stock: 3168 });
  });
});

describe('Werkstatt: Ablage', () => {
  const memory = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), raw: m };
  };

  test('speichern, ersetzen, loeschen und zurueckholen', () => {
    let t = 1000;
    const mem = memory();
    const store = createStore(mem, () => t);
    const a = store.save({ id: 'aaaa1111', ship: 'aegs-gladius', name: 'Eins', slots: { gun_nose: 'revenant' } });
    t = 2000;
    store.save({ id: 'bbbb2222', ship: 'anvl-arrow', name: 'Zwei', slots: {} });
    assert.deepEqual(store.list().map((e) => e.id), ['bbbb2222', 'aaaa1111']);
    t = 3000;
    const a2 = store.save({ ...a, name: 'Eins neu' });
    assert.equal(a2.created, 1000);
    assert.equal(a2.updated, 3000);
    assert.deepEqual(store.list().map((e) => e.name), ['Eins neu', 'Zwei']);
    const gone = store.remove('bbbb2222');
    assert.equal(store.list().length, 1);
    assert.ok(store.restore(gone));
    assert.deepEqual(store.list().map((e) => e.id), ['aaaa1111', 'bbbb2222']);
    assert.ok(sameLayout(store.get('aaaa1111'), { ship: 'aegs-gladius', name: 'Eins neu', slots: { gun_nose: 'revenant' } }));
  });

  test('kaputter Inhalt ergibt eine leere oder bereinigte Liste, keinen Wurf', () => {
    const mem = memory();
    mem.setItem(STORE_KEY, '{nope');
    assert.deepEqual(createStore(mem).list(), []);
    mem.setItem(STORE_KEY, JSON.stringify({ v: 1, layouts: [{ id: 'x' }, { id: 'cccc3333', ship: 'aegs-gladius', name: 'ok', slots: { gun_nose: 'revenant', 'BAD KEY': 'x' }, created: 5, updated: 6 }] }));
    assert.deepEqual(createStore(mem).list(), [{ id: 'cccc3333', ship: 'aegs-gladius', name: 'ok', slots: { gun_nose: 'revenant' }, created: 5, updated: 6 }]);
  });

  test('ein gesperrter Speicher liefert leer und meldet das Speichern als gescheitert', () => {
    const locked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
    const store = createStore(locked);
    assert.deepEqual(store.list(), []);
    assert.equal(store.save({ id: 'dddd4444', ship: 'aegs-gladius', name: '', slots: {} }), null);
    assert.equal(createStore(null).save({ id: 'dddd4444', ship: 'aegs-gladius', name: '', slots: {} }), null);
  });
});
