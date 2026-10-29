// Der URL-Zustand des Hangars (assets/hangar-overview.js), mit woertlichen
// URLs: jeder Zustand der Seite ist ein Link, alte '#<id>'-Links landen beim
// richtigen Schiff, und "Link kopieren" nennt immer das Schiff, aber nie die
// persoenlichen Dock-Filter. Dazu die Schiffssuche des Docks (Zweck,
// Filter, Woerter, Tippfehler, Aehnliche). Der Controller hat beim
// Import keine Seiteneffekte, die reinen Funktionen laufen direkt in node.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseState, serializeState, fillMessage, figuresOf, fleetSummary, compareCell, figureText, dockOrder, pickRandom,
  fold, editDistance, parseQuery, findWords, wordScore, dockSearch,
} from '../../assets/hangar-overview.js';

const ctx = {
  ids: new Set(['aegs-gladius', 'anvl-arrow', 'drak-cutlass-black', 'rsi-aurora-mk2']),
  defaultShip: 'aegs-gladius',
  tabs: ['overview', 'weapons', 'systems', 'cargo'],
  sorts: ['name', 'scm', 'max', 'hull', 'shield', 'dps', 'cargo', 'crew', 'len'],
  purs: new Set(['kampf', 'fracht', 'bergbau']),
  grps: new Set(['kampf:leicht', 'kampf:schwer', 'fracht:mittel']),
  sizes: ['klein', 'mittel', 'gross'],
  crews: new Set(['solo', 'klein', 'gross']),
  cargos: new Set([1, 32, 100, 500]),
  prices: new Set([1e6, 3e6, 1e7, 3e7]),
  makers: new Set(['Drake Interplanetary']),
};
const url = (search, hash = '', scope = 'location') => serializeState(parseState(search, hash, ctx), ctx, scope);

describe('Hangar: URL-Zustand', () => {
  test('eine nackte Seite ist das Startschiff im Ueberblick', () => {
    assert.equal(url(''), '');
    assert.deepEqual(parseState('', '', ctx), {
      ship: 'aegs-gladius', tab: 'overview', hp: null, cmp: [], view: 'stage', lo: null, pane: 'layout',
      fleetOnly: false, sort: 'name', q: '', pur: '', grp: '', size: [], crew: '', cargo: 0, price: 0, maker: '',
    });
  });

  test('alte #id-Links waehlen das Schiff und werden zu ?ship=', () => {
    assert.equal(url('', '#drak-cutlass-black'), '?ship=drak-cutlass-black');
    assert.equal(url('', '#nope'), '');
    assert.equal(url('?ship=anvl-arrow', '#drak-cutlass-black'), '?ship=anvl-arrow');
  });

  test('ein geteilter Link kommt unveraendert zurueck', () => {
    const full = '?ship=drak-cutlass-black&tab=weapons&hp=hardpoint_turret&cmp=drak-cutlass-black,aegs-gladius&view=compare&fleet=1&sort=cargo&q=cutlass'
      + '&pur=kampf&grp=schwer&size=klein,mittel&crew=solo&cargo=100&price=3000000&maker=Drake%20Interplanetary';
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
    assert.equal(url('?ship=nope&tab=nope&sort=nope&pur=nope&grp=nope&size=nope&crew=nope&cargo=99&price=5&maker=nope&fleet=2'), '');
    // ein alter Link mit ?type= (Rolle vor dem Umbau der Suche) faellt weg, statt die Seite zu stoeren
    assert.equal(url('?type=Kampf&ship=anvl-arrow'), '?ship=anvl-arrow');
  });

  test('eine Unterrolle gibt es nur unter ihrem Zweck; Groessen in fester Folge, einmalig', () => {
    assert.equal(url('?grp=schwer'), '');
    assert.equal(url('?pur=fracht&grp=schwer'), '?pur=fracht');
    assert.equal(url('?pur=kampf&grp=schwer'), '?pur=kampf&grp=schwer');
    assert.equal(url('?size=gross,klein,klein,riesig'), '?size=klein,gross');
  });

  test('Link kopieren nennt das Schiff und laesst die Dock-Filter weg', () => {
    assert.equal(url('', '', 'share'), '?ship=aegs-gladius');
    assert.equal(
      url('?ship=drak-cutlass-black&tab=systems&cmp=anvl-arrow&fleet=1&sort=cargo&q=cut&pur=kampf&size=klein&crew=solo&cargo=1&price=1000000&maker=Drake%20Interplanetary', '', 'share'),
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

// Ein Ausschnitt des echten Vokabulars (src/lib/hangar/finder.ts vocab()).
const vocab = {
  pur: [
    { k: 'kampf', w: ['kampf', 'combat', 'jäger', 'fighter'] },
    { k: 'fracht', w: ['fracht', 'cargo', 'frachter', 'hauler'] },
    { k: 'bergbau', w: ['bergbau', 'mining', 'miner'] },
    { k: 'erkundung', w: ['erkundung', 'exploration', 'expedition'] },
  ],
  grp: [
    { k: 'kampf:schwer', w: ['schwere jäger', 'schwerer jäger', 'heavy fighter'] },
    { k: 'erkundung:expedition', w: ['expedition'] },
  ],
  size: [{ k: 'klein', w: ['klein', 'small'] }, { k: 'mittel', w: ['mittel', 'medium'] }, { k: 'gross', w: ['groß', 'large'] }],
  crew: [{ k: 'solo', w: ['solo', 'allein'] }],
  maker: [{ k: 'Drake Interplanetary', w: ['drake interplanetary', 'drake', 'drak'] }],
  nick: { cutty: 'cutlass', prospi: 'prospector' },
};
const crew = { solo: { min: 1, max: 1 }, klein: { min: 2, max: 4 }, gross: { min: 5, max: null } };
const ship = (id, name, maker, tags, rest) => ({ id, ...findWords(name, maker, tags), maker, pur: [], grp: [], size: '', stat: {}, ...rest });
const fleet = [
  ship('aegs-gladius', 'Gladius', 'Aegis Dynamics', 'leichter jager kampf klein', { pur: ['kampf'], grp: ['kampf:leicht'], size: 'klein', stat: { crew: 1, cargo: 0, len: 20, dps: 1900, price: 800000 } }),
  ship('anvl-hornet-f7c-mk2', 'F7C Hornet Mk II', 'Anvil Aerospace', 'mittlerer jager kampf klein', { pur: ['kampf'], grp: ['kampf:mittel'], size: 'klein', stat: { crew: 1, cargo: 2, len: 22, dps: 2600, price: 1500000 } }),
  ship('anvl-hornet-f7a-mk2', 'F7A Hornet Mk II', 'Anvil Aerospace', 'mittlerer jager kampf klein', { pur: ['kampf'], grp: ['kampf:mittel'], size: 'klein', stat: { crew: 1, cargo: 0, len: 22, dps: 3000, price: null } }),
  ship('aegs-sabre', 'Sabre', 'Aegis Dynamics', 'mittlerer jager kampf klein', { pur: ['kampf'], grp: ['kampf:mittel'], size: 'klein', stat: { crew: 1, cargo: 0, len: 26, dps: 2500, price: null } }),
  ship('drak-cutlass-black', 'Cutlass Black', 'Drake Interplanetary', 'mittlerer frachter fracht kampf mittel', { pur: ['fracht', 'kampf'], grp: ['fracht:mittel'], size: 'mittel', stat: { crew: 2, cargo: 46, len: 38, dps: 1600, price: 1400000 } }),
  ship('drak-mule', 'Mule', 'Drake Interplanetary', 'fracht fahrzeug', { pur: ['fracht'], size: 'fahrzeug', stat: { crew: 1, cargo: 6, len: 5, price: 50000 } }),
  ship('argo-mole', 'MOLE', 'Argo Astronautics', 'bergbau mittel', { pur: ['bergbau'], size: 'mittel', stat: { crew: 4, cargo: 96, len: 40, price: 4900000 } }),
  ship('misc-prospector', 'Prospector', 'Musashi Industrial and Starflight Concern', 'bergbau klein', { pur: ['bergbau'], size: 'klein', stat: { crew: 1, cargo: 32, len: 24, price: 2000000 } }),
  ship('misc-hull-a', 'Hull A', 'Musashi Industrial and Starflight Concern', 'leichter frachter fracht klein', { pur: ['fracht'], size: 'klein', stat: { crew: 1, cargo: 64, len: 30, price: 1600000 } }),
  ship('rsi-constellation-andromeda', 'Constellation Andromeda', 'Roberts Space Industries', 'kanonenschiff kampf fracht gross', { pur: ['kampf', 'fracht'], size: 'gross', stat: { crew: 4, cargo: 96, len: 61, dps: 4000, price: 7000000 } }),
  ship('rsi-carrack', 'Carrack', 'Anvil Aerospace', 'expedition erkundung gross', { pur: ['erkundung'], grp: ['erkundung:expedition'], size: 'gross', stat: { crew: 6, cargo: 456, len: 126, price: 30000000 } }),
  ship('rsi-pisces-expedition', 'C8X Pisces Expedition', 'Anvil Aerospace', 'erkundung beiboot', { pur: ['erkundung'], size: 'beiboot', stat: { crew: 2, cargo: 4, len: 13, price: 700000 } }),
];
const find = (q, over = {}) => {
  const p = parseQuery(q, vocab);
  return [...dockSearch(fleet, { hits: p.hits, words: p.words, ...over }, crew)].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
};

describe('Hangar: Schiffssuche', () => {
  test('fold spricht dieselben Woerter wie finder.ts: klein, ohne Akzente, ß als ss', () => {
    assert.equal(fold('  Großer  JÄGER '), 'grosser jager');
    assert.equal(fold("San'tok.yāi"), 'santok.yai');
  });

  test('Tippfehler-Abstand mit Vertauschung, Abbruch ueber max', () => {
    assert.equal(editDistance('prospektor', 'prospector'), 1);
    assert.equal(editDistance('carrakc', 'carrack'), 1);
    assert.equal(editDistance('gladius', 'cutlass', 2), 3);
  });

  test('die Suche erkennt Zweck, Crew, Groesse, Hersteller und Zahlen und laesst den Rest als Woerter', () => {
    assert.deepEqual(parseQuery('Bergbau  solo', vocab), {
      hits: [{ kind: 'pur', key: 'bergbau', t: 'bergbau' }, { kind: 'crew', key: 'solo', t: 'solo' }], words: [],
    });
    assert.deepEqual(parseQuery('schwerer Jäger', vocab).hits, [{ kind: 'grp', key: 'kampf:schwer', t: 'schwerer jager' }]);
    assert.deepEqual(parseQuery('ab 100 scu drake', vocab).hits, [{ kind: 'cargo', key: 100, t: 'ab 100 scu' }, { kind: 'maker', key: 'Drake Interplanetary', t: 'drake' }]);
    assert.deepEqual(parseQuery('unter 2 mio', vocab).hits, [{ kind: 'price', key: 2e6, t: 'unter 2 mio' }]);
    assert.deepEqual(parseQuery('under 3', vocab).hits, [{ kind: 'price', key: 3e6, t: 'under 3' }]);
    assert.deepEqual(parseQuery('cutty black', vocab), { hits: [], words: ['cutlass', 'black'] });
  });

  test('ohne Namen finden: Zweck und Crew grenzen ein, Arten verknuepft mit und', () => {
    assert.deepEqual(find('bergbau solo'), ['misc-prospector']);
    assert.deepEqual(find('miner'), ['argo-mole', 'misc-prospector']);
    assert.deepEqual(find('fracht ab 40 scu'), ['drak-cutlass-black', 'misc-hull-a', 'rsi-constellation-andromeda']);
    assert.deepEqual(find('fracht ab 50 scu'), ['misc-hull-a', 'rsi-constellation-andromeda']);
    assert.deepEqual(find('klein mittel bergbau'), ['argo-mole', 'misc-prospector']);
    assert.deepEqual(find('kampf unter 1,5 mio'), ['aegs-gladius', 'anvl-hornet-f7c-mk2', 'drak-cutlass-black']);
  });

  test('ein erkannter Begriff im Namen zaehlt auch, und vorn', () => {
    assert.deepEqual(find('expedition'), ['rsi-pisces-expedition', 'rsi-carrack']);
  });

  test('Name vor Hersteller vor Rolle, Wortanfang und Spitzname, Tippfehler nur wenn sonst nichts trifft', () => {
    assert.deepEqual(find('hornet'), ['anvl-hornet-f7a-mk2', 'anvl-hornet-f7c-mk2']);
    assert.deepEqual(find('f7c'), ['anvl-hornet-f7c-mk2']);
    assert.deepEqual(find('cutty'), ['drak-cutlass-black']);
    assert.deepEqual(find('prospektor'), ['misc-prospector']);
    assert.deepEqual(find('mole'), ['argo-mole']);
    assert.deepEqual(find('mul'), ['drak-mule']);
    const by = (id) => fleet.find((x) => x.id === id);
    assert.equal(wordScore('anvil', by('anvl-hornet-f7c-mk2')), 60);
    assert.equal(wordScore('frachter', by('drak-cutlass-black')), 40);
    assert.equal(wordScore('glad', by('aegs-gladius')), 80);
  });

  test('Filter aus den Pillen gelten hart, die Flotte als Menge', () => {
    assert.deepEqual(find('', { pur: 'kampf', size: ['klein'], crew: 'solo' }), ['aegs-gladius', 'aegs-sabre', 'anvl-hornet-f7a-mk2', 'anvl-hornet-f7c-mk2']);
    assert.deepEqual(find('', { cargo: 100 }), ['rsi-carrack']);
    assert.deepEqual(find('', { price: 1e6 }), ['aegs-gladius', 'drak-mule', 'rsi-pisces-expedition']);
    assert.deepEqual(find('', { crew: 'gross' }), ['rsi-carrack']);
    assert.deepEqual(find('', { grp: 'fracht:mittel' }), ['drak-cutlass-black']);
    assert.deepEqual(find('', { maker: 'Drake Interplanetary', only: new Set(['drak-mule', 'aegs-gladius']) }), ['drak-mule']);
    assert.deepEqual(find('xyzzy'), []);
  });
});
