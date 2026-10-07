// Der URL-Zustand des Hangars (assets/hangar-overview.js), mit woertlichen
// URLs: jeder Zustand der Seite ist ein Link, alte '#<id>'-Links landen beim
// richtigen Schiff, und "Link kopieren" nennt immer das Schiff, aber nie die
// persoenlichen Dock-Filter (Graft 6 der Synthese). Der Controller hat beim
// Import keine Seiteneffekte, die reinen Funktionen laufen direkt in node.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseState, serializeState, fillMessage } from '../../assets/hangar-overview.js';

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

describe('Hangar: Vorlagen aus dem Markup', () => {
  test('Mehrzahlform und Zahlengruppen je Sprache', () => {
    assert.equal(fillMessage({ one: '{n} Schiff', other: '{n} Schiffe' }, { n: 1 }, 'de-DE'), '1 Schiff');
    assert.equal(fillMessage({ one: '{n} Schiff', other: '{n} Schiffe' }, { n: 1227 }, 'de-DE'), '1.227 Schiffe');
    assert.equal(fillMessage({ one: '{n} ship', other: '{n} ships' }, { n: 227 }, 'en-US'), '227 ships');
  });
});
