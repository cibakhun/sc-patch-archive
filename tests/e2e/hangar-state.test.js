// Der URL-Zustand des Hangars (assets/hangar-overview.js), mit woertlichen
// URLs: jeder Zustand der Seite ist ein Link, alte '#<id>'-Links landen beim
// richtigen Schiff, und "Link kopieren" nennt immer das Schiff, aber nie die
// persoenlichen Dock-Filter. Der Controller hat beim
// Import keine Seiteneffekte, die reinen Funktionen laufen direkt in node.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseState, serializeState, fillMessage, figuresOf, fleetSummary, compareCell, figureText, dockOrder, pickRandom } from '../../assets/hangar-overview.js';

const ctx = {
  ids: new Set(['aegs-gladius', 'anvl-arrow', 'drak-cutlass-black', 'rsi-aurora-mk2']),
  defaultShip: 'aegs-gladius',
  tabs: ['overview', 'weapons', 'systems', 'cargo'],
  sorts: ['name', 'scm', 'max', 'hull', 'shield', 'dps', 'cargo', 'crew', 'len'],
  types: new Set(['Kampf', 'Mehrzweck']),
  makers: new Set(['Drake Interplanetary']),
};
const url = (search, hash = '', scope = 'location') => serializeState(parseState(search, hash, ctx), ctx, scope);

describe('Hangar: URL-Zustand', () => {
  test('eine nackte Seite ist das Startschiff im Ueberblick', () => {
    assert.equal(url(''), '');
    assert.deepEqual(parseState('', '', ctx), {
      ship: 'aegs-gladius', tab: 'overview', hp: null, cmp: [], view: 'stage',
      fleetOnly: false, sort: 'name', q: '', type: '', maker: '',
    });
  });

  test('alte #id-Links waehlen das Schiff und werden zu ?ship=', () => {
    assert.equal(url('', '#drak-cutlass-black'), '?ship=drak-cutlass-black');
    assert.equal(url('', '#nope'), '');
    assert.equal(url('?ship=anvl-arrow', '#drak-cutlass-black'), '?ship=anvl-arrow');
  });

  test('ein geteilter Link kommt unveraendert zurueck', () => {
    const full = '?ship=drak-cutlass-black&tab=weapons&hp=hardpoint_turret&cmp=drak-cutlass-black,aegs-gladius&view=compare&fleet=1&sort=cargo&q=cutlass&type=Mehrzweck&maker=Drake%20Interplanetary';
    assert.equal(url(full), full);
  });

  test('Vergleichs-Ids sind bekannt, einmalig und hoechstens drei', () => {
    assert.equal(url('?cmp=anvl-arrow,nope,anvl-arrow,aegs-gladius,rsi-aurora-mk2,drak-cutlass-black'), '?cmp=anvl-arrow,aegs-gladius,rsi-aurora-mk2');
    assert.equal(url('?view=compare'), '');
    assert.equal(url('?cmp=anvl-arrow&view=compare'), '?cmp=anvl-arrow');
    assert.equal(url('?cmp=anvl-arrow,aegs-gladius&view=compare'), '?cmp=anvl-arrow,aegs-gladius&view=compare');
  });

  test('einen Hardpoint gibt es nur auf einem Ausstattungs-Tab', () => {
    assert.equal(url('?tab=weapons&hp=hardpoint_gun_nose'), '?tab=weapons&hp=hardpoint_gun_nose');
    assert.equal(url('?hp=hardpoint_gun_nose'), '');
    assert.equal(url('?tab=weapons&hp=<script>'), '?tab=weapons');
  });

  test('unbekannte Werte fallen auf die Vorgabe zurueck', () => {
    assert.equal(url('?ship=nope&tab=nope&sort=nope&type=nope&maker=nope&fleet=2'), '');
  });

  test('Link kopieren nennt das Schiff und laesst die Dock-Filter weg', () => {
    assert.equal(url('', '', 'share'), '?ship=aegs-gladius');
    assert.equal(
      url('?ship=drak-cutlass-black&tab=systems&cmp=anvl-arrow&fleet=1&sort=cargo&q=cut&type=Mehrzweck&maker=Drake%20Interplanetary', '', 'share'),
      '?ship=drak-cutlass-black&tab=systems&cmp=anvl-arrow',
    );
  });
});

describe('Hangar: Dock-Daten und Flottenzeile', () => {
  test('data-v liest sich in der Folge von data-stats; "-" ist unbekannt, 0 bleibt 0', () => {
    assert.deepEqual(figuresOf(['scm', 'cargo', 'crew', 'price'], '1193 0 1 -'), { scm: 1193, cargo: 0, crew: 1, price: null });
    assert.deepEqual(figuresOf(['dps', 'len'], '1944.5'), { dps: 1944.5, len: null });
  });

  test('die Flottenzeile summiert Fracht und Crew und zaehlt Rollenfamilien, fremde Ids nicht', () => {
    const ships = new Map([
      ['aegs-gladius', { stat: { cargo: 0, crew: 1 }, fam: ['jaeger'] }],
      ['drak-cutlass-black', { stat: { cargo: 46, crew: 2 }, fam: ['frachttransport', 'jaeger'] }],
      ['argo-atls', { stat: { cargo: null, crew: null }, fam: [] }],
    ]);
    assert.deepEqual(
      fleetSummary(['aegs-gladius', 'drak-cutlass-black', 'argo-atls', 'nope'], ships),
      { n: 3, scu: 46, crew: 3, roles: 2 },
    );
    assert.deepEqual(fleetSummary([], ships), { n: 0, scu: 0, crew: 0, roles: 0 });
  });
});

describe('Hangar: Vergleichszellen', () => {
  const speed = { digits: 0, unit: 'm/s', better: 1 };
  test('Abweichung mit Vorzeichen und Einheit, Ton nach der Richtung von "besser"', () => {
    assert.deepEqual(compareCell(1150, 1193, speed, 'en-US'), { value: '1,150 m/s', delta: '-43 m/s', tone: 'down' });
    assert.deepEqual(compareCell(29760, 6110, { digits: 0, unit: 'HP', better: 1 }, 'de-DE'), { value: '29.760 HP', delta: '+23.650 HP', tone: 'up' });
    assert.deepEqual(compareCell(2010960, 2262330, { digits: 0, unit: 'aUEC', better: -1 }, 'en-US'), { value: '2,010,960 aUEC', delta: '-251,370 aUEC', tone: 'up' });
    assert.deepEqual(compareCell(37.5, 21, { digits: 1, unit: 'm', better: 0 }, 'de-DE'), { value: '37,5 m', delta: '+16,5 m', tone: 'flat' });
  });

  test('Rundung auf die Stellen des Kennwerts, keine Abweichung ohne Basis, Wert oder Unterschied', () => {
    assert.deepEqual(compareCell(2797.8, 1944.5, { digits: 1, unit: 'DPS', better: 1 }, 'en-US'), { value: '2,797.8 DPS', delta: '+853.3 DPS', tone: 'up' });
    assert.deepEqual(compareCell(1193, null, speed, 'en-US'), { value: '1,193 m/s', delta: null, tone: null });
    assert.deepEqual(compareCell(null, 1193, speed, 'en-US'), { value: '–', delta: null, tone: null });
    assert.deepEqual(compareCell(3, 3, { digits: 0, unit: '', better: 0 }, 'en-US'), { value: '3', delta: null, tone: null });
  });
});

describe('Hangar: Sortierung und Zufallsschiff', () => {
  const ships = [
    { id: 'aegs-gladius', stat: { cargo: 0, scm: 226 } },
    { id: 'anvl-arrow', stat: { cargo: null, scm: 229 } },
    { id: 'drak-caterpillar', stat: { cargo: 576, scm: 155 } },
    { id: 'drak-cutlass-black', stat: { cargo: 46, scm: 217 } },
    { id: 'rsi-aurora-mk2', stat: { cargo: 46, scm: null } },
  ];
  test('Kennwerte absteigend, ohne Wert ans Ende, Gleichstand in Namensfolge; Name ist die gebaute Folge', () => {
    assert.deepEqual(dockOrder(ships, 'cargo'), ['drak-caterpillar', 'drak-cutlass-black', 'rsi-aurora-mk2', 'aegs-gladius', 'anvl-arrow']);
    assert.deepEqual(dockOrder(ships, 'scm'), ['anvl-arrow', 'aegs-gladius', 'drak-cutlass-black', 'drak-caterpillar', 'rsi-aurora-mk2']);
    assert.deepEqual(dockOrder(ships, 'name'), ['aegs-gladius', 'anvl-arrow', 'drak-caterpillar', 'drak-cutlass-black', 'rsi-aurora-mk2']);
  });

  test('der Wert auf der Karte liest sich wie in der Tafel', () => {
    assert.equal(figureText(576, { digits: 0, unit: 'SCU' }, 'de-DE'), '576 SCU');
    assert.equal(figureText(1944.5, { digits: 1, unit: 'DPS' }, 'de-DE'), '1.944,5 DPS');
    assert.equal(figureText(null, { digits: 0, unit: 'SCU' }, 'en-US'), '–');
  });

  test('das Zufallsschiff kommt aus den sichtbaren und ist nie das gezeigte', () => {
    assert.equal(pickRandom(['a', 'b', 'c'], 'b', () => 0), 'a');
    assert.equal(pickRandom(['a', 'b', 'c'], 'b', () => 0.99), 'c');
    assert.equal(pickRandom(['b'], 'b', () => 0.5), null);
    assert.equal(pickRandom([], 'b', () => 0.5), null);
  });
});

describe('Hangar: Vorlagen aus dem Markup', () => {
  test('Mehrzahlform und Zahlengruppen je Sprache', () => {
    assert.equal(fillMessage({ one: '{n} Schiff', other: '{n} Schiffe' }, { n: 1 }, 'de-DE'), '1 Schiff');
    assert.equal(fillMessage({ one: '{n} Schiff', other: '{n} Schiffe' }, { n: 1227 }, 'de-DE'), '1.227 Schiffe');
    assert.equal(fillMessage({ one: '{n} ship', other: '{n} ships' }, { n: 227 }, 'en-US'), '227 ships');
  });
});
