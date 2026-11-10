// Die Layout-Werkstatt im Hangar (assets/hangar-layouts.js): ein Layout ist
// ein Link, der genau dieses Layout wieder oeffnet, auch mit Umlauten im
// Namen; ein Link aus einem aelteren Datenstand verliert nur die Teile, die
// nicht mehr passen; gespeicherte Layouts ueberleben einen kaputten oder
// gesperrten Speicher, ohne die Seite mitzureissen. Dazu die Naht zum
// Controller: der leere Code ist in beiden Dateien derselbe und kostet keine
// Adresse, ?layout= reist durch parseState/serializeState unveraendert, auch
// beim Teilen, und die Station (?station=, frueher ?pane=) bleibt beim Teilen daheim.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeLayout, decodeLayout, EMPTY_CODE, shipSlots, cleanSlots, candidates, deltaPct, groupTotals,
  sameLayout, createStore, STORE_KEY, MAX_NAME, rackSlot, rackMissile, changeCount,
  syncLayouts, layoutKey, sessionUid, accountStore,
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

  test('die Lackierung reist als viertes Feld mit; Serienlack laesst den Code wie zuvor', () => {
    const lo = { name: 'Rot', slots: { gun_nose: 'revenant' }, paint: '0d451905d1a0429215ab410823b6d2aa' };
    assert.deepEqual(decodeLayout(encodeLayout(lo)), lo);
    assert.equal(encodeLayout({ name: '', slots: {}, paint: null }), EMPTY_CODE);
    assert.equal(encodeLayout({ name: '', slots: {}, paint: 'Böse Farbe' }), EMPTY_CODE);
    assert.ok(!('paint' in decodeLayout(EMPTY_CODE)));
    assert.ok(!sameLayout({ ship: 'aegs-gladius', name: '', slots: {}, paint: 'abc' }, { ship: 'aegs-gladius', name: '', slots: {} }));
  });

  test('Halterungen reisen als fuenftes Feld; ohne sie bleibt der Code wie zuvor', () => {
    const lo = { name: 'Igel', slots: { missilerack_left_wing_outer: 'marksman' }, racks: { missilerack_left_wing_outer: 'msd-341-missile-rack' } };
    const code = encodeLayout(lo);
    assert.deepEqual(decodeLayout(code), lo);
    assert.deepEqual(JSON.parse(Buffer.from(code, 'base64url').toString('utf8')), [1, 'Igel', lo.slots, '', lo.racks]);
    assert.deepEqual(decodeLayout(encodeLayout({ ...lo, paint: 'abc' })), { ...lo, paint: 'abc' });
    // der Code ohne Halterungen, wie ihn aeltere Seiten schreiben und lesen
    assert.equal(encodeLayout({ name: 'x', slots: {} }), 'WzEsIngiLHt9XQ');
    assert.equal(encodeLayout({ name: 'x', slots: {}, racks: {} }), 'WzEsIngiLHt9XQ');
    assert.ok(!sameLayout({ ship: 's', ...lo }, { ship: 's', ...lo, racks: {} }));
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
    const ctx = { ids: new Set(['aegs-gladius', 'anvl-arrow']), defaultShip: 'aegs-gladius', tabs: ['overview', 'weapons'], sorts: ['name'], purs: new Set(), grps: new Set(), sizes: [], crews: new Set(), cargos: new Set(), prices: new Set(), makers: new Set() };
    const code = encodeLayout({ name: 'Glaskanone', slots: { gun_nose: 'revenant' } });
    const s = parseState(`?ship=anvl-arrow&layout=${code}&q=arrow`, '', ctx);
    assert.equal(s.lo, code);
    assert.equal(serializeState(s, ctx), `?ship=anvl-arrow&layout=${code}&q=arrow`);
    assert.equal(serializeState(s, ctx, 'share'), `?ship=anvl-arrow&layout=${code}`);
    assert.equal(parseState('?layout=<script>', '', ctx).lo, null);
  });

  test('Serie kostet keine Adresse; die Uebersicht steht als ?station=uebersicht, geteilt nie', () => {
    const ctx = { ids: new Set(['aegs-gladius', 'anvl-arrow']), defaultShip: 'aegs-gladius', tabs: ['overview', 'weapons'], sorts: ['name'], purs: new Set(), grps: new Set(), sizes: [], crews: new Set(), cargos: new Set(), prices: new Set(), makers: new Set() };
    assert.equal(parseState(`?layout=${EMPTY_CODE}`, '', ctx).lo, null);
    assert.equal(parseState('', '', ctx).station, 'loadout');
    assert.equal(parseState('?station=nope', '', ctx).station, 'loadout');
    const s = parseState('?ship=anvl-arrow&station=uebersicht', '', ctx);
    assert.equal(s.station, 'uebersicht');
    assert.equal(serializeState(s, ctx), '?ship=anvl-arrow&station=uebersicht');
    assert.equal(serializeState(s, ctx, 'share'), '?ship=anvl-arrow');
  });

  test('das alte ?pane=ship bleibt lesbar und wird zur Uebersicht', () => {
    const ctx = { ids: new Set(['aegs-gladius', 'anvl-arrow']), defaultShip: 'aegs-gladius', tabs: ['overview', 'weapons'], sorts: ['name'], purs: new Set(), grps: new Set(), sizes: [], crews: new Set(), cargos: new Set(), prices: new Set(), makers: new Set() };
    assert.equal(serializeState(parseState('?ship=anvl-arrow&pane=ship', '', ctx), ctx), '?ship=anvl-arrow&station=uebersicht');
    assert.equal(parseState('?pane=layout', '', ctx).station, 'loadout');
    // die neue Form gewinnt, wenn beide dastehen
    assert.equal(parseState('?pane=ship&station=loadout', '', ctx).station, 'loadout');
  });

  test('„Als Tafel“ reist als ?tafel=1 mit, geteilt nie', () => {
    const ctx = { ids: new Set(['aegs-gladius']), defaultShip: 'aegs-gladius', tabs: ['overview'], sorts: ['name'], purs: new Set(), grps: new Set(), sizes: [], crews: new Set(), cargos: new Set(), prices: new Set(), makers: new Set() };
    const s = parseState('?station=uebersicht&tafel=1', '', ctx);
    assert.equal(s.flat, true);
    assert.equal(serializeState(s, ctx), '?station=uebersicht&tafel=1');
    assert.equal(serializeState(s, ctx, 'share'), '?ship=aegs-gladius');
    assert.equal(parseState('?tafel=ja', '', ctx).flat, false);
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

  test('Raketen: je Halterung derselbe Untertyp und dieselbe Groesse, Schaden mal Stueckzahl', () => {
    const ord = {
      ignite: ['Ignite II Missile', 'Ignite-II-Rakete', 'missile', 2, 'FireStorm Kinetics', 0, 'A', 2404, { trk: 'i' }, 680],
      bullet: ['\'Bullet\' II Missile', 0, 'missile', 2, 'Vanduul', 0, 'A', 2824, { trk: 'i' }, 420],
      igniteG: ['Ignite II-G Missile', 0, 'gmissile', 2, 'FireStorm Kinetics', 0, 'A', 2404, { trk: 'i' }, 0],
      arrester: ['Arrester III Missile', 0, 'missile', 3, 'FireStorm Kinetics', 0, 'A', 2564, { trk: 'c' }, 0],
      reaper: ['Reaper V Missile', 0, 'torpedo', 5, 'Talon', 0, 'A', 14901, { trk: 'e' }, 0],
    };
    const rack = shipSlots([['missilerack_left_wing_outer', 'missile', 2, 'ignite', 'missile', 2]]);
    assert.deepEqual(candidates(rack[0], ord), ['bullet', 'ignite']);
    assert.deepEqual(groupTotals(rack, { missilerack_left_wing_outer: 'bullet' }, ord).get('missile'), { now: 2824 * 2, stock: 2404 * 2 });
    assert.deepEqual(cleanSlots({ missilerack_left_wing_outer: 'igniteG' }, rack, ord), { slots: {}, racks: {}, dropped: 1 });
  });

  test('Halterungen: die gewaehlte formt den Slot, die Rakete folgt ihr, ein Link bleibt lesbar', () => {
    const ord = {
      ignite: ['Ignite II Missile', 0, 'missile', 2, 'FireStorm Kinetics', 0, 'A', 2404, { trk: 'i' }, 680],
      marksman: ['Marksman I Missile', 0, 'missile', 1, 'Behring', 0, 'A', 1142, { trk: 'i' }, 300],
      spark: ['Spark I Missile', 0, 'missile', 1, 'FireStorm Kinetics', 0, 'A', 1188, { trk: 'c' }, 300],
      arrester: ['Arrester III Missile', 0, 'missile', 3, 'FireStorm Kinetics', 0, 'A', 3600, { trk: 'c' }, 0],
      viper: ['Viper III Missile', 0, 'missile', 3, 'Nova Pyrotechnica', 0, 'A', 3257, { trk: 'i' }, 0],
    };
    const racks = {
      'msd-322-missile-rack': ['MSD-322 Missile Rack', 0, 3, 2, 2, 'missile', 'Behring', 4760],
      'msd-341-missile-rack': ['MSD-341 Missile Rack', 0, 3, 4, 1, 'missile', 'Behring', 3173],
      'msd-313-missile-rack': ['MSD-313 Missile Rack', 0, 3, 1, 3, 'missile', 'Behring', 7140],
    };
    const k = 'missilerack_left_wing_outer';
    const [slot] = shipSlots([[k, 'missile', 2, 'ignite', 'missile', 2, Object.keys(racks)]]);
    assert.deepEqual(shipSlots([[k, 'missile', 2, 'ignite', 'missile', 2, ['msd-322-missile-rack']]])[0].racks, null);
    assert.deepEqual([rackSlot(slot, 'msd-341-missile-rack', racks)].map((x) => [x.type, x.size, x.count]), [['missile', 1, 4]]);
    assert.equal(rackSlot(slot, 'msd-322-missile-rack', racks), slot);
    assert.equal(rackSlot(slot, 'fremd', racks), slot);
    // dasselbe Verfolgungssignal vor dem staerkeren Schaden
    assert.equal(rackMissile(rackSlot(slot, 'msd-341-missile-rack', racks), ord, 'ignite'), 'marksman');
    assert.equal(rackMissile(rackSlot(slot, 'msd-313-missile-rack', racks), ord, 'ignite'), 'viper');
    // getauschte Halterung ohne Rakete im Link: rackMissile fuellt, nichts faellt weg
    assert.deepEqual(cleanSlots({}, [slot], ord, { [k]: 'msd-313-missile-rack' }, racks), { slots: { [k]: 'viper' }, racks: { [k]: 'msd-313-missile-rack' }, dropped: 0 });
    // Serienhalterung faellt still weg; eine fremde Halterung zaehlt, ihre S1-Rakete passt dann nicht in die Serie
    assert.deepEqual(cleanSlots({ [k]: 'spark' }, [slot], ord, { [k]: 'msd-341-missile-rack' }, racks), { slots: { [k]: 'spark' }, racks: { [k]: 'msd-341-missile-rack' }, dropped: 0 });
    assert.deepEqual(cleanSlots({ [k]: 'ignite' }, [slot], ord, { [k]: 'msd-322-missile-rack' }, racks), { slots: {}, racks: {}, dropped: 0 });
    assert.deepEqual(cleanSlots({ [k]: 'spark' }, [slot], ord, { [k]: 'weg' }, racks), { slots: {}, racks: {}, dropped: 2 });
    assert.deepEqual(groupTotals([slot], { [k]: 'marksman' }, ord, { [k]: 'msd-341-missile-rack' }, racks).get('missile'), { now: 1142 * 4, stock: 2404 * 2 });
    // eine Halterung samt Rakete ist ein Slot
    assert.equal(changeCount({ slots: { [k]: 'marksman' }, racks: { [k]: 'msd-341-missile-rack' } }), 1);
    assert.equal(changeCount({ slots: { [k]: 'marksman' }, racks: { [k]: 'msd-341-missile-rack' }, paint: 'abc' }), 2);
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

  test('die Lackierung wird mitgespeichert; ein Eintrag ohne sie traegt kein leeres Feld', () => {
    const store = createStore(memory(), () => 1);
    store.save({ id: 'cccc3333', ship: 'aegs-gladius', name: 'Lack', slots: {}, paint: '0d451905d1a0429215ab410823b6d2aa' });
    store.save({ id: 'dddd4444', ship: 'aegs-gladius', name: 'Serie', slots: {}, paint: undefined });
    assert.equal(store.get('cccc3333').paint, '0d451905d1a0429215ab410823b6d2aa');
    assert.ok(!('paint' in store.get('dddd4444')));
    store.save({ id: 'eeee5555', ship: 'aegs-gladius', name: 'Igel', slots: { r: 'marksman' }, racks: { r: 'msd-341-missile-rack' } });
    assert.deepEqual(store.get('eeee5555').racks, { r: 'msd-341-missile-rack' });
    assert.ok(!('racks' in store.get('dddd4444')));
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

// Konto (Krisz 10-29): angemeldet liegt die Ablage im Spiegel des Kontos und
// wird mit hangar_layouts abgeglichen. Ein Server im Speicher steht fuer
// PostgREST: GET liefert alle Zeilen des Kontos, POST ist ein Upsert.
describe('Werkstatt: Ablage im Konto', () => {
  const UID = '0f9c2b1e-1111-4a2b-9c3d-123456789abc';
  const memory = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), raw: m };
  };
  const server = () => {
    const rows = new Map();
    let fail = false;
    const rest = async (method, path, body) => {
      if (fail) return { ok: false, json: async () => ({}) };
      if (method === 'GET') return { ok: true, json: async () => [...rows.values()].map((r) => JSON.parse(JSON.stringify(r))) };
      assert.equal(method, 'POST');
      assert.match(path, /on_conflict=user_id,id/);
      for (const r of body) {
        assert.equal(r.user_id, UID);
        // Wie der Trigger touch_hangar_layout: ein aelterer rev ueberschreibt keinen juengeren.
        if (rows.has(r.id) && r.rev < rows.get(r.id).rev) continue;
        rows.set(r.id, { id: r.id, rev: r.rev, deleted: r.deleted, entry: r.entry });
      }
      return { ok: true, json: async () => null };
    };
    return { rows, rest, setFail: (v) => { fail = v; } };
  };
  const lay = (id, name) => ({ id, ship: 'aegs-gladius', name, slots: { gun_nose: 'revenant' } });

  test('Schluessel: Gast hat den alten, das Konto einen eigenen Spiegel', () => {
    assert.equal(layoutKey(null), STORE_KEY);
    assert.equal(layoutKey(UID), `${STORE_KEY}.${UID}`);
    assert.equal(sessionUid({ user: { id: UID } }), UID);
    assert.equal(sessionUid({ user: { id: '../x' } }), null);
    assert.equal(sessionUid(null), null);
  });

  test('beim ersten Abgleich wandern die Gast-Layouts ins Konto und verlassen den Gastspeicher', async () => {
    const mem = memory();
    const srv = server();
    createStore(mem, () => 10).save(lay('aaaa1111', 'Gast'));
    const res = await syncLayouts({ storage: mem, uid: UID, rest: srv.rest, now: () => 20 });
    assert.equal(res.ok, true);
    assert.equal(res.migrated, 1);
    assert.equal(srv.rows.get('aaaa1111').entry.name, 'Gast');
    assert.deepEqual(createStore(mem, () => 0, STORE_KEY).list(), []);
    assert.deepEqual(createStore(mem, () => 0, layoutKey(UID)).list().map((e) => e.name), ['Gast']);
  });

  test('scheitert der Server, bleibt das Gast-Layout im Gastspeicher und nichts geht verloren', async () => {
    const mem = memory();
    const srv = server();
    srv.setFail(true);
    createStore(mem, () => 10).save(lay('aaaa1111', 'Gast'));
    const res = await syncLayouts({ storage: mem, uid: UID, rest: srv.rest, now: () => 20 });
    assert.equal(res.ok, false);
    assert.equal(createStore(mem).list().length, 1);
    srv.setFail(false);
    assert.equal((await syncLayouts({ storage: mem, uid: UID, rest: srv.rest, now: () => 30 })).ok, true);
    assert.equal(srv.rows.size, 1);
    assert.deepEqual(createStore(mem).list(), []);
  });

  test('zweites Geraet: holt die Layouts, Aenderung und Loeschen ziehen hin und her', async () => {
    const srv = server();
    const pc = memory();
    const phone = memory();
    const pcStore = createStore(pc, () => 100, layoutKey(UID));
    pcStore.save(lay('aaaa1111', 'Eins'));
    pcStore.save(lay('bbbb2222', 'Zwei'));
    await syncLayouts({ storage: pc, uid: UID, rest: srv.rest, now: () => 110 });

    const r1 = await syncLayouts({ storage: phone, uid: UID, rest: srv.rest, now: () => 120 });
    assert.equal(r1.changed, true);
    const phoneStore = createStore(phone, () => 200, layoutKey(UID));
    assert.deepEqual(phoneStore.list().map((e) => e.name).sort(), ['Eins', 'Zwei']);

    // Handy benennt um und loescht, der PC zieht nach.
    phoneStore.save({ ...phoneStore.get('aaaa1111'), name: 'Eins neu' });
    phoneStore.remove('bbbb2222');
    await syncLayouts({ storage: phone, uid: UID, rest: srv.rest, now: () => 210 });
    assert.equal(srv.rows.get('bbbb2222').deleted, true);
    assert.equal(srv.rows.get('bbbb2222').entry, null);
    const r2 = await syncLayouts({ storage: pc, uid: UID, rest: srv.rest, now: () => 220 });
    assert.equal(r2.changed, true);
    assert.deepEqual(pcStore.list().map((e) => e.name), ['Eins neu']);
    // Ein weiterer Lauf laedt das geloeschte Layout nicht wieder hoch.
    await syncLayouts({ storage: pc, uid: UID, rest: srv.rest, now: () => 230 });
    assert.equal(srv.rows.get('bbbb2222').deleted, true);
    assert.ok(!('gone' in JSON.parse(pc.getItem(layoutKey(UID)))));
  });

  test('zurueckgeholt nach dem Abgleich schlaegt den Grabstein; der juengere Stand gewinnt', async () => {
    const srv = server();
    const mem = memory();
    let t = 100;
    const store = createStore(mem, () => t, layoutKey(UID));
    const a = store.save(lay('aaaa1111', 'Eins'));
    await syncLayouts({ storage: mem, uid: UID, rest: srv.rest, now: () => t });
    t = 200;
    const gone = store.remove(a.id);
    await syncLayouts({ storage: mem, uid: UID, rest: srv.rest, now: () => t });
    t = 300;
    store.restore(gone);
    await syncLayouts({ storage: mem, uid: UID, rest: srv.rest, now: () => t });
    assert.equal(srv.rows.get('aaaa1111').deleted, false);
    assert.equal(store.get('aaaa1111').updated, 100);
    // Ein aelterer Stand auf dem Server ueberschreibt den juengeren hier nicht.
    srv.rows.set('aaaa1111', { id: 'aaaa1111', rev: 50, deleted: false, entry: { ...store.get('aaaa1111'), name: 'Alt' } });
    await syncLayouts({ storage: mem, uid: UID, rest: srv.rest, now: () => 310 });
    assert.equal(store.get('aaaa1111').name, 'Eins');
    assert.equal(srv.rows.get('aaaa1111').entry.name, 'Eins');
  });

  test('zwei Geraete gleichzeitig: der aeltere Upsert ueberschreibt den juengeren nicht, der naechste Lauf zieht nach', async () => {
    const srv = server();
    const a = memory();
    const b = memory();
    const sa = createStore(a, () => 100, layoutKey(UID));
    sa.save(lay('aaaa1111', 'A'));
    await syncLayouts({ storage: a, uid: UID, rest: srv.rest, now: () => 100 });
    await syncLayouts({ storage: b, uid: UID, rest: srv.rest, now: () => 100 });
    const sb = createStore(b, () => 300, layoutKey(UID));
    sb.save({ ...sb.get('aaaa1111'), name: 'B neu' });
    createStore(a, () => 200, layoutKey(UID)).save({ ...sa.get('aaaa1111'), name: 'A alt' });
    // B schreibt zuerst (rev 300), dann kommt A mit rev 200 an.
    await syncLayouts({ storage: b, uid: UID, rest: srv.rest, now: () => 310 });
    const gotA = await syncLayouts({ storage: a, uid: UID, rest: srv.rest, now: () => 320 });
    assert.equal(gotA.changed, true);
    assert.equal(srv.rows.get('aaaa1111').entry.name, 'B neu');
    assert.equal(sa.get('aaaa1111').name, 'B neu');
    // Auch ein verspaeteter Upsert direkt am Server bleibt wirkungslos.
    await srv.rest('POST', 'hangar_layouts?on_conflict=user_id,id', [{ user_id: UID, id: 'aaaa1111', rev: 150, deleted: true, entry: null }]);
    assert.equal(srv.rows.get('aaaa1111').deleted, false);
  });

  test('Gleichstand zwischen Layout und Grabstein: der Grabstein gewinnt auf beiden Seiten', async () => {
    const srv = server();
    const mem = memory();
    const store = createStore(mem, () => 500, layoutKey(UID));
    store.save(lay('aaaa1111', 'Eins'));
    srv.rows.set('aaaa1111', { id: 'aaaa1111', rev: 500, deleted: true, entry: null });
    await syncLayouts({ storage: mem, uid: UID, rest: srv.rest, now: () => 600 });
    assert.equal(store.get('aaaa1111'), null);
    const mem2 = memory();
    const s2 = createStore(mem2, () => 700, layoutKey(UID));
    s2.save(lay('bbbb2222', 'Zwei'));
    s2.remove('bbbb2222');
    srv.rows.set('bbbb2222', { id: 'bbbb2222', rev: 700, deleted: false, entry: { ...lay('bbbb2222', 'Zwei'), created: 1, updated: 1 } });
    await syncLayouts({ storage: mem2, uid: UID, rest: srv.rest, now: () => 800 });
    assert.equal(srv.rows.get('bbbb2222').deleted, true);
    assert.equal(s2.get('bbbb2222'), null);
  });

  test('kaputte Zeilen vom Server fallen weg, statt den Spiegel zu verderben', async () => {
    const srv = server();
    const mem = memory();
    srv.rows.set('x', { id: 'x', rev: 1, deleted: false, entry: { id: 'x' } });
    srv.rows.set('cccc3333', { id: 'cccc3333', rev: 'nope', deleted: false, entry: lay('cccc3333', 'a') });
    srv.rows.set('dddd4444', { id: 'dddd4444', rev: 5, deleted: false, entry: { ...lay('eeee5555', 'falsche id') } });
    const r = await syncLayouts({ storage: mem, uid: UID, rest: srv.rest, now: () => 10 });
    assert.equal(r.ok, true);
    assert.deepEqual(createStore(mem, () => 0, layoutKey(UID)).list(), []);
  });

  test('die Seite folgt der Sitzung: Gast schreibt in den Gastspeicher, angemeldet in den Spiegel', () => {
    const mem = memory();
    let sess = null;
    const account = { peek: () => sess, session: async () => sess, rest: async () => ({ ok: false }) };
    const acct = accountStore({ storage: mem, account, onChange() {}, win: {} });
    acct.store.save(lay('aaaa1111', 'Gast'));
    assert.equal(acct.signedIn(), false);
    assert.ok(mem.raw.has(STORE_KEY));
    sess = { user: { id: UID } };
    assert.equal(acct.signedIn(), true);
    assert.deepEqual(acct.store.list(), []);
    acct.store.save(lay('bbbb2222', 'Konto'));
    assert.ok(mem.raw.has(layoutKey(UID)));
    sess = null;
    assert.deepEqual(acct.store.list().map((e) => e.name), ['Gast']);
  });
  // Die Anzeige „In deinem Konto gespeichert" (Werkstatt, Kontoseite) liest
  // state(). Sie darf es nur sagen, wenn der letzte Abgleich jede Aenderung
  // mitnahm (Pruefung der Konto-Anzeigen, 07.11.2026).
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  test('ist die Sitzung gerade nicht nutzbar, meldet der Abgleich keinen Kontostand, der nicht stimmt', async () => {
    const mem = memory();
    const srv = server();
    let usable = true;
    const sess = { user: { id: UID } };
    const seen = [];
    const account = { peek: () => sess, session: async () => (usable ? sess : null), rest: (_sess, ...a) => srv.rest(...a) };
    const acct = accountStore({ storage: mem, account, onChange() { seen.push(acct.state()); }, win: {} });
    await acct.sync();
    assert.equal(acct.state(), 'synced', 'Voraussetzung');

    usable = false; // Refresh scheitert an 5xx oder am Netz, die Sitzung bleibt gespeichert
    acct.store.save(lay('aaaa1111', 'Neu'));
    assert.equal(acct.state(), 'pending');
    await wait(450);
    await acct.sync();
    assert.equal(srv.rows.size, 0, 'Voraussetzung: nichts kam an');
    assert.equal(acct.state(), 'error', 'nicht „gespeichert": das Layout liegt nur in diesem Browser');
    assert.equal(seen.at(-1), 'error', 'die Seite malt die Anzeige neu');

    usable = true;
    await acct.sync();
    assert.deepEqual([...srv.rows.keys()], ['aaaa1111']);
    assert.equal(acct.state(), 'synced');
  });

  test('wer speichert, waehrend ein Abgleich laeuft, sieht erst „gespeichert", wenn auch sein Layout angekommen ist', async () => {
    const mem = memory();
    const srv = server();
    const sess = { user: { id: UID } };
    let hold = null;
    const rest = async (_sess, method, ...a) => {
      if (method === 'POST' && !hold) await new Promise((r) => { hold = r; });
      return srv.rest(method, ...a);
    };
    const seen = [];
    const account = { peek: () => sess, session: async () => sess, rest };
    const acct = accountStore({ storage: mem, account, onChange() { seen.push([acct.state(), [...srv.rows.keys()].sort().join()]); }, win: {} });
    acct.store.save(lay('aaaa1111', 'Erstes'));
    const first = acct.sync(); // der Upsert von aaaa1111 haengt
    await wait(10);
    acct.store.save(lay('bbbb2222', 'Zweites'));
    await wait(450); // touched() stoesst den naechsten Abgleich an, er wartet auf den laufenden
    hold();
    await first;
    await wait(10);
    assert.deepEqual(srv.rows.has('bbbb2222'), true, 'Voraussetzung: der zweite Lauf brachte es');
    assert.deepEqual(seen.filter(([st]) => st === 'synced').map(([, rows]) => rows), ['aaaa1111,bbbb2222'],
      '„gespeichert" erst, als beide Layouts beim Server lagen');
    assert.equal(acct.state(), 'synced');
  });

  test('solange das Gespeicherte noch unterwegs ist, sagt die Anzeige nicht „gespeichert"', async () => {
    // cubic zu PR #310: zwischen dem Ablauf der 400-ms-Frist und der Antwort
    // des Servers lag die Aenderung weder im Zeitgeber noch in `again`, und
    // state() gab den VORIGEN Erfolg zurueck. Jede Neuzeichnung in diesem
    // Fenster sagte „In deinem Konto gespeichert" ueber ein Layout, dessen
    // Upsert noch lief (und scheitern konnte).
    const mem = memory();
    const srv = server();
    const sess = { user: { id: UID } };
    let hold = null;
    let halten = false;
    const rest = async (_sess, method, ...a) => {
      if (method === 'POST' && halten) { halten = false; await new Promise((r) => { hold = r; }); }
      return srv.rest(method, ...a);
    };
    const account = { peek: () => sess, session: async () => sess, rest };
    const acct = accountStore({ storage: mem, account, onChange() {}, win: {} });
    await acct.sync();
    assert.equal(acct.state(), 'synced', 'Voraussetzung');

    halten = true;
    acct.store.save(lay('aaaa1111', 'Neu'));
    await wait(450); // die Frist ist um, der Upsert haengt
    assert.equal(typeof hold, 'function', 'Voraussetzung: der Upsert laeuft');
    assert.equal(srv.rows.size, 0, 'Voraussetzung: noch nichts angekommen');
    assert.equal(acct.state(), 'pending', 'nicht „gespeichert", solange der Upsert laeuft');

    srv.setFail(true); // und er scheitert
    hold();
    await wait(10);
    assert.equal(acct.state(), 'error');

    srv.setFail(false);
    await acct.sync();
    assert.deepEqual([...srv.rows.keys()], ['aaaa1111']);
    assert.equal(acct.state(), 'synced');
  });

  test('speichert ein anderer Tab, sagt dieser Tab erst „gespeichert", wenn es im Konto liegt', async () => {
    // cubic zu PR #310 (zweiter Lauf): Tab A speichert, Tab B (Kontoseite,
    // Werkstatt) bekommt das storage-Ereignis und malte neu, sagte aber
    // weiter „gespeichert" aus SEINEM letzten Lauf. Scheitert A beim
    // Hochschicken oder schliesst vor der Frist, lag das Layout nur im
    // gemeinsamen Spiegel. Jetzt zaehlt die fremde Aenderung wie eine eigene,
    // und B bringt sie selbst hoch.
    const mem = memory();
    const srv = server();
    const sess = { user: { id: UID } };
    let aScheitert = false;
    const restA = async (_sess, method, ...a) => (method === 'POST' && aScheitert ? { ok: false, json: async () => ({}) } : srv.rest(method, ...a));
    const tabA = accountStore({ storage: mem, account: { peek: () => sess, session: async () => sess, rest: restA }, onChange() {}, win: {} });
    let ereignis = null;
    const winB = { addEventListener(typ, f) { if (typ === 'storage') ereignis = f; } };
    const seenB = [];
    const tabB = accountStore({
      storage: mem,
      account: { peek: () => sess, session: async () => sess, rest: (_sess, ...a) => srv.rest(...a) },
      onChange() { seenB.push([tabB.state(), [...srv.rows.keys()].join()]); },
      win: winB,
    });
    await tabA.sync();
    await tabB.sync();
    assert.equal(tabB.state(), 'synced', 'Voraussetzung');
    assert.equal(typeof ereignis, 'function', 'B hoert auf storage');
    ereignis({ key: 'sb-x-auth-token' });
    ereignis({ key: layoutKey(null) });
    assert.equal(tabB.state(), 'synced', 'fremde Schluessel aendern am Kontostand nichts');

    aScheitert = true;
    tabA.store.save(lay('aaaa1111', 'Aus Tab A'));
    ereignis({ key: layoutKey(UID) }); // so meldet der Browser B die Aenderung
    assert.equal(tabB.state(), 'pending', 'nicht „gespeichert": A hat noch nichts hochgeschickt');

    await wait(450); // A scheitert beim Hochschicken, B gleicht selbst ab
    await wait(20);
    assert.equal(tabA.state(), 'error', 'Voraussetzung: A brachte es nicht hoch');
    assert.deepEqual([...srv.rows.keys()], ['aaaa1111'], 'B hat es hochgebracht');
    assert.equal(tabB.state(), 'synced');
    assert.ok(seenB.filter(([st]) => st === 'synced').every(([, rows]) => rows === '' || rows === 'aaaa1111'));
    assert.deepEqual(seenB.at(-1), ['synced', 'aaaa1111'], '„gespeichert" erst, als es beim Server lag');
  });

  test('zwei Tabs schaukeln sich ueber storage-Ereignisse nicht auf', async (t) => {
    // Jeder Abgleich schreibt den Spiegel, jeder Schreibvorgang weckt den
    // anderen Tab. Wie im Browser: Ereignis nur bei geaendertem Wert, nur im
    // ANDEREN Tab, asynchron. Nach dem Speichern muss Ruhe einkehren.
    const raw = new Map();
    const hoerer = { A: null, B: null };
    let offen = true; // am Ende schliessen beide Tabs, sonst hielte ein Aufschaukeln den Lauf am Leben
    const speicher = (ich) => ({
      getItem: (k) => (raw.has(k) ? raw.get(k) : null),
      setItem(k, v) {
        v = String(v);
        if (raw.get(k) === v) return;
        raw.set(k, v);
        const anderer = hoerer[ich === 'A' ? 'B' : 'A'];
        if (anderer) setTimeout(() => { if (offen) anderer({ key: k }); }, 0);
      },
    });
    const srv = server();
    let anfragen = 0;
    const sess = { user: { id: UID } };
    const account = { peek: () => sess, session: async () => sess, rest: (_sess, ...a) => { anfragen++; return srv.rest(...a); } };
    const win = (ich) => ({ addEventListener(typ, f) { if (typ === 'storage') hoerer[ich] = f; } });
    const tabA = accountStore({ storage: speicher('A'), account, onChange() {}, win: win('A') });
    const tabB = accountStore({ storage: speicher('B'), account, onChange() {}, win: win('B') });
    try {
      await tabA.sync();
      await tabB.sync();
      tabA.store.save(lay('aaaa1111', 'Eins'));
      await wait(1500);
      const nachEinsPunktFuenf = anfragen;
      await wait(900);
      t.diagnostic(`${anfragen} Anfragen fuer Anmelden zweier Tabs und eine Speicherung`);
      assert.equal(anfragen, nachEinsPunktFuenf, `nach dem Speichern laufen weiter Abgleiche (${anfragen} Anfragen)`);
      assert.ok(anfragen <= 8, `zu viele Anfragen fuer eine Speicherung: ${anfragen}`);
      assert.deepEqual([...srv.rows.keys()], ['aaaa1111']);
      assert.equal(tabA.state(), 'synced');
      assert.equal(tabB.state(), 'synced');
    } finally {
      offen = false;
    }
  });

  test('ein Abgleich ohne eigene Aenderung laesst „gespeichert" stehen', async () => {
    // Gegenstueck: der Abgleich beim Zurueckkehren in den Tab holt nur fremde
    // Aenderungen. Was dieser Browser hatte, liegt schon im Konto; ein
    // „Synchronisiere…" bei jedem Tab-Wechsel waere Flackern ohne Inhalt.
    const mem = memory();
    const srv = server();
    const sess = { user: { id: UID } };
    let hold = null;
    let halten = false;
    const rest = async (_sess, method, ...a) => {
      if (method === 'GET' && halten) { halten = false; await new Promise((r) => { hold = r; }); }
      return srv.rest(method, ...a);
    };
    const account = { peek: () => sess, session: async () => sess, rest };
    const acct = accountStore({ storage: mem, account, onChange() {}, win: {} });
    acct.store.save(lay('aaaa1111', 'Alt'));
    await wait(450); // die Frist stoesst den Abgleich an
    await acct.sync();
    assert.deepEqual([...srv.rows.keys()], ['aaaa1111'], 'Voraussetzung');
    assert.equal(acct.state(), 'synced', 'Voraussetzung');
    halten = true;
    const lauf = acct.sync();
    await wait(10);
    assert.equal(typeof hold, 'function', 'Voraussetzung: der Abgleich laeuft');
    assert.equal(acct.state(), 'synced');
    hold();
    await lauf;
    assert.equal(acct.state(), 'synced');
  });
});
