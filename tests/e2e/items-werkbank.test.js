// Verhalten der Items-Seite (/items.html, Items-Werkbank) gegen ein
// deterministisches Fixture im echten Schema (obtain[]-Bezugsquellen).
//
// Seit dem 26.11.2026 ist die Werkbank die Items-Seite: Verzeichnis und Item
// Finder in einem, /item-finder.html leitet hierher. Die Tests des Finders
// (behavior.test.js, im Mock-DOM gegen assets/item-finder-app.js) gingen
// mit seinem Skript; was sie zusicherten, steht hier fuer die Werkbank:
// ehrliche Karten (kein Fantasiepreis), Suche, Kategorie, Fundart-Filter,
// Sortierung, Blatt mit Bezugsquellen, Crafting-Rezept, Fehler- und
// Leerzustaende, Erze, Adresse.
//
// Seit dem 27.11.2026 fuehrt das Blatt nicht mehr aufs Item-Datenblatt
// (Krisz: „wofür sollte ein User den Datenblatt öffnen?“); was nur das Blatt
// wusste, kommt aus /items-wege.json (src/lib/itemsWerkbankWege.ts). Hier
// steht ein Fixture dieser Datei in Katalog-Reihenfolge; dass die echte
// Datei dieselben Antworten gibt wie das gebaute Blatt, prueft
// verify:werkbank-items.
//
// Lauf: die GEBAUTE Seite dist/de/items.html (Markup, Texte) im Pruefstand
// (linkedom, scripts/lib/pruefstand.mjs), darin nur das Konfigurations-
// Skript und das KANONISCHE Skript assets/items-werkbank.js. Kategoriebaum
// und Erz-Katalog der Konfiguration werden durch ein Fixture ersetzt, der
// Item-Katalog und die Rezeptdatei kommen aus dem Fixture statt aus dist/.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { oeffneSeite } from '../../scripts/lib/pruefstand.mjs';

const DIST = path.resolve('dist');
const SKRIPT = '/assets/items-werkbank.js';
const QUELLE = fs.readFileSync(path.resolve('assets/items-werkbank.js'), 'utf8');

// ---- Fixture ----
const BAUM = [
  {
    r: 'Weapons', s: 'weapons', n: 'Waffen', c: 3, g: 'gun', f: '#ff6b6b',
    b: [
      { k: 'Weapons / Rifle', s: 'weapons-rifle', n: 'Gewehre', c: 1, g: 'gun' },
      { k: 'Weapons / Pistol', s: 'weapons-pistol', n: 'Pistolen', c: 2, g: 'gun' },
    ],
  },
  { r: 'Armour', s: 'armour', n: 'Rüstung', c: 1, g: 'armor', f: '#4dabf7', b: [{ k: 'Armour / Combat / Light', s: 'armour-combat-light', n: 'Leicht', c: 1, g: 'armor' }] },
  { r: 'Clothing', s: 'clothing', n: 'Kleidung', c: 1, g: 'shirt', f: '#ffd43b', b: [{ k: 'Clothing', s: 'clothing', n: 'Allgemein', c: 1, g: 'shirt' }] },
  { r: 'Vehicle', s: 'vehicle', n: 'Fahrzeuge', c: 1, g: 'ship', f: '#69db7c', b: [{ k: 'Vehicle', s: 'vehicle', n: 'Allgemein', c: 1, g: 'ship' }] },
  { r: 'Commodity', s: 'commodity', n: 'Waren', c: 2, g: 'box', f: '#ced4da', b: [{ k: 'Commodity', s: 'commodity', n: 'Allgemein', c: 2, g: 'box' }] },
  { r: 'Other', s: 'other', n: 'Sonstiges', c: 2, g: 'box', f: '#adb5bd', b: [{ k: 'Other', s: 'other', n: 'Allgemein', c: 2, g: 'box' }] },
];
const ERZE = { url: '/de/topics/mining.html', m: { laranite: ['Laranite', 7], hadanite: ['Hadanite', 0] } };

function makeDb(fuellung = 0) {
  const items = [
    {
      id: 'alpha-rifle', name: 'Alpha Rifle', category: 'Weapons / Rifle',
      obtain: [
        { kind: 'shop', loc: 'Live Fire Weapons - Area 18', price: 1000 },
        { kind: 'loot', loc: 'Security Bunker' },
      ],
      game: { manufacturer: 'Behring', size: 3, stats: { damage: 10 } },
    },
    {
      id: 'beta-helmet', name: 'Beta Helmet', category: 'Armour / Combat / Light',
      obtain: [
        { kind: 'shop', loc: 'Armor Shop - Lorville', price: 500 },
        { kind: 'shop', loc: 'Cubby Blast - Area 18', price: 800 },
      ],
    },
    {
      id: 'gamma-jacket', name: 'Gamma Jacket', category: 'Clothing',
      obtain: [{ kind: 'loot', loc: 'Executive Lockers' }],
      guide: 'Only in executive lockers of the admin wing.',
    },
    { id: 'delta-relic', name: 'Delta Relic', category: 'Other', obtain: [] },
    {
      id: 'epsilon-runner', name: 'Epsilon Runner', category: 'Vehicle',
      obtain: [{ kind: 'vehicle', loc: 'Astro Armada - Area 18', price: 1500000 }],
    },
    { id: 'quote-co', name: 'Weird "Quoted" & Co <b>', category: 'Other', obtain: [] },
    {
      id: 'zeta-pistol', name: 'Zeta Pistol', category: 'Weapons / Pistol',
      obtain: [{ kind: 'exclusive', reason: 'Subscriber' }],
    },
    { id: 'eta-pistol', name: 'Eta Pistol', category: 'Weapons / Pistol', obtain: [{ kind: 'shop', loc: 'Cubby Blast - Area 18', price: 2500 }] },
    { id: 'laranite-ore', name: 'Laranite (Ore)', category: 'Commodity', obtain: [] },
    { id: 'hadanite', name: 'Hadanite', category: 'Commodity', obtain: [] },
  ];
  for (let i = 1; i <= fuellung; i++) {
    const n = String(i).padStart(3, '0');
    items.push({ id: `zz-filler-${n}`, name: `Zz Filler ${n}`, category: 'Other', obtain: [] });
  }
  const mitQuelle = items.filter((i) => i.obtain.length).length;
  return {
    generatedAt: '2026-11-26',
    counts: { items: items.length, withObtain: mitQuelle, catalogOnly: items.length - mitQuelle },
    items,
    sets: [],
  };
}

/**
 * /items-wege.json zum Fixture: Positionen wie in makeDb(). Die Orte sind
 * erfunden zugeordnet (Cubby Blast in Pyro), damit ein Item zwei Systeme hat.
 */
function makeWege(db) {
  const pos = new Map(db.items.map((it, i) => [it.id, i]));
  const i = db.items.map(() => null);
  const setze = (id, e) => { if (pos.has(id)) i[pos.get(id)] = e; };
  setze('alpha-rifle', {
    h: 1,
    m: [5, ['Mission A', ''], ['Mission B', 'Stanton'], ['Mission C', '']],
    s: [['Aurora MR', 1], ['Cutlass Black', 1]],
    r: [pos.get('eta-pistol'), pos.get('zeta-pistol')],
  });
  setze('beta-helmet', { w: 2 });
  setze('epsilon-runner', { v: 1 });
  setze('eta-pistol', { f: 1, wm: 1 });
  return {
    sys: {
      'Live Fire Weapons - Area 18': 'Stanton',
      'Armor Shop - Lorville': 'Stanton',
      'Cubby Blast - Area 18': 'Pyro',
      'Astro Armada - Area 18': 'Stanton',
    },
    i,
    sets: {},
  };
}

const CRAFT = {
  blueprints: [
    { name: 'Alpha Rifle', craft_time_seconds: 90, tiers: 2, ingredients: [{ slot: 'Metall', options: [{ name: 'Iron', quantity_scu: 2 }] }] },
  ],
};

/**
 * Oeffnet die Items-Seite mit dem Fixture.
 * opt.db: Katalog (Objekt) oder { status } fuer einen Fehler; opt.craft
 * ebenso; opt.wege: /items-wege.json (Vorgabe: makeWege zum Katalog) oder
 * { status }; opt.query: Adresse (?q=…); opt.sprache: 'de' (Vorgabe) oder 'en'.
 */
async function seite(opt = {}) {
  const lang = opt.sprache || 'de';
  const antworten = new Map();
  const db = opt.db === undefined ? makeDb() : opt.db;
  antworten.set('/assets/universal-items.json', db && db.status ? db : JSON.stringify(db));
  const craft = opt.craft === undefined ? CRAFT : opt.craft;
  antworten.set('/assets/crafting-db.json', craft && craft.status ? craft : JSON.stringify(craft));
  const wege = opt.wege === undefined ? (db && db.items ? makeWege(db) : { status: 404, body: '' }) : opt.wege;
  antworten.set(lang === 'de' ? '/de/items-wege.json' : '/items-wege.json', wege && wege.status ? wege : JSON.stringify(wege));
  const abrufe = [];
  const p = await oeffneSeite({
    dist: DIST,
    seite: lang === 'de' ? 'de/items.html' : 'items.html',
    query: opt.query || '',
    sprache: lang === 'de' ? 'de-DE' : 'en-US',
    antworten,
    // Nur die Konfiguration und das Werkbank-Skript: was die Seite sonst
    // laedt (Kopfleiste, Hilfe, Zaehler), prueft verify:clienttext.
    skripte: (e) => e.name === SKRIPT || (e.code != null && e.code.includes('window.__WZI=')),
    umbau: (name, code) => {
      if (name === SKRIPT) return QUELLE;
      // Kategoriebaum und Erze aus dem Fixture, sonst gilt die gebaute Konfiguration.
      return `${code}\nwindow.__WZI.baum = ${JSON.stringify(BAUM)}; window.__WZI.erze = ${JSON.stringify(ERZE)};`;
    },
  });
  // Abrufe mitzaehlen (die Rezeptdatei laedt erst mit dem ersten Blatt).
  const geladen = p.geladen;
  const adressen = [];
  // Wie im Browser: replaceState aendert die Adresse, die das Skript liest.
  const loc = p.window.location;
  p.window.history.replaceState = function (s, t, u) {
    this.state = s;
    adressen.push(String(u));
    const z = new URL(String(u), loc.href);
    loc.pathname = z.pathname; loc.search = z.search; loc.hash = z.hash; loc.href = z.href;
  };
  await p.settle(500);
  const doc = p.document;
  const $ = (sel) => doc.querySelector(sel);
  const T = p.window.__WZI.t;
  const W = p.window.__WZI.w;
  const kacheln = () => [...doc.querySelectorAll('#wz-gitter .wz-k')];
  const namen = () => kacheln().map((k) => k.querySelector('.wz-k__name').textContent);
  const kachel = (id) => doc.querySelector(`#wz-gitter .wz-k[data-id="${id}"]`);
  const zahl = () => $('#wz-n').textContent;
  const tippe = async (text) => {
    const q = $('#wz-q');
    q.value = text;
    p.fire(q, 'input');
    await p.settle(300);
  };
  const klick = async (el) => { assert.ok(el, 'Element zum Klicken fehlt'); p.fire(el, 'click'); await p.settle(300); };
  const blatt = () => $('#wz-blatt-inh');
  const filter = (attr, wert) => doc.querySelector(`#wz-schublade .wz-f[data-${attr}="${wert}"]`);
  const sortiere = async (wert) => { const s = $('#wz-sort'); s.value = wert; p.fire(s, 'change'); await p.settle(300); };
  return { p, doc, $, T, W, kacheln, namen, kachel, zahl, tippe, klick, blatt, filter, sortiere, adressen, abrufe, geladen };
}

const ALLE = 10;

describe('Laden und Grundzustand', () => {
  test('1. Jedes Fixture-Item wird als Kachel gezeichnet, die Zahl stimmt', async () => {
    const s = await seite();
    assert.strictEqual(s.kacheln().length, ALLE);
    assert.strictEqual(s.zahl(), String(ALLE));
    assert.strictEqual(s.$('#wz-gitter').getAttribute('aria-busy'), null, 'aria-busy bleibt nach dem Laden stehen');
    assert.deepStrictEqual(s.p.fehler, []);
  });

  test('2. Kein Fehler im Pruefstand, beide Sprachen', async () => {
    const en = await seite({ sprache: 'en' });
    assert.strictEqual(en.kacheln().length, ALLE);
    assert.deepStrictEqual(en.p.fehler, []);
  });

  test('3. „Empfohlen“: erst kauf- oder findbare Items, Katalogeintraege ans Ende', async () => {
    const s = await seite();
    const n = s.namen();
    assert.ok(n.indexOf('Alpha Rifle') < n.indexOf('Delta Relic'));
    assert.ok(n.indexOf('Beta Helmet') < n.indexOf('Hadanite'));
    // Exklusiv steht zwischen Kaufbar/Loot und reinem Katalog.
    assert.ok(n.indexOf('Gamma Jacket') < n.indexOf('Zeta Pistol'));
    assert.ok(n.indexOf('Zeta Pistol') < n.indexOf('Delta Relic'));
  });

  test('4. Gruppen-Chips zeigen jede Gruppe des Baums mit Anzahl', async () => {
    const s = await seite();
    const chips = [...s.doc.querySelectorAll('#wz-chips [data-chip]')];
    assert.strictEqual(chips.length, BAUM.length + 1, 'Alle + eine je Gruppe');
    const waffen = chips.find((c) => c.getAttribute('data-chip') === 'weapons');
    assert.ok(waffen.textContent.includes('Waffen'));
    assert.ok(waffen.querySelector('em').textContent === '3');
  });

  test('5. Fundart-Filter: Alle, Kaufbar, Loot, Exklusiv, Nur Katalog mit Anzahl', async () => {
    const s = await seite();
    const art = [...s.doc.querySelectorAll('#wz-f-art .wz-f')].map((b) => b.getAttribute('data-art'));
    assert.deepStrictEqual(art, ['all', 'buy', 'loot', 'exclusive', 'catalog']);
    const n = (k) => s.filter('art', k).querySelector('em').textContent;
    assert.strictEqual(n('all'), String(ALLE));
    assert.strictEqual(n('buy'), '4');
    assert.strictEqual(n('loot'), '2');
    assert.strictEqual(n('exclusive'), '1');
    assert.strictEqual(n('catalog'), '4');
  });

  test('6. 70 Items: 60 Kacheln zuerst, die Marke laedt den Rest nach', async () => {
    const s = await seite({ db: makeDb(60) });
    // Der Pruefstand meldet jede beobachtete Marke als sichtbar: der Rest
    // kommt ohne Zutun. Gezaehlt wird am Ende, und keine Kachel doppelt.
    const ids = s.kacheln().map((k) => k.getAttribute('data-id'));
    assert.strictEqual(ids.length, 70);
    assert.strictEqual(new Set(ids).size, 70);
    assert.strictEqual(s.zahl(), '70');
    assert.ok(!s.$('#wz-gitter .wz-mehr'), 'Marke steht nach dem letzten Nachladen noch');
  });
});

describe('Kacheln: ehrliche Darstellung', () => {
  test('7. Mehrere Quellen: kleinster Preis mit „ab“', async () => {
    const s = await seite();
    const preis = s.kachel('beta-helmet').querySelector('.wz-k__preis').textContent;
    assert.ok(preis.startsWith(s.T.priceFrom + ' '), preis);
    assert.ok(preis.includes('500'), preis);
    assert.ok(!preis.includes('800'), preis);
  });

  test('8. Nur Loot: „Nur Loot“ statt eines erfundenen Preises', async () => {
    const s = await seite();
    const preis = s.kachel('gamma-jacket').querySelector('.wz-k__preis');
    assert.strictEqual(preis.textContent, s.T.lootOnly);
    assert.ok(preis.classList.contains('is-still'));
  });

  test('9. Katalogeintrag: keine Handelsdaten, kein Fundort bekannt', async () => {
    const s = await seite();
    const k = s.kachel('delta-relic');
    assert.strictEqual(k.querySelector('.wz-k__preis').textContent, s.T.noTradeData);
    assert.strictEqual(k.querySelector('.wz-k__ort').textContent, s.T.noSourceData);
  });

  test('10. Mehrere Orte: der erste Ort und „+N“', async () => {
    const s = await seite();
    const ort = s.kachel('alpha-rifle').querySelector('.wz-k__ort');
    assert.ok(ort.textContent.includes('Live Fire Weapons - Area 18'));
    assert.strictEqual(ort.querySelector('i').textContent, '+1');
  });

  test('11. Exklusiv: „Exklusiv“ statt eines Preises', async () => {
    const s = await seite();
    assert.strictEqual(s.kachel('zeta-pistol').querySelector('.wz-k__preis').textContent, s.T.kindExclusive);
  });

  test('12. Sonderzeichen im Namen werden maskiert, kein eingeschleustes Element', async () => {
    const s = await seite();
    const k = s.kachel('quote-co');
    assert.strictEqual(k.querySelector('.wz-k__name').textContent, 'Weird "Quoted" & Co <b>');
    assert.strictEqual(k.querySelector('.wz-k__name b'), null);
  });

  test('13. Item ohne Datenblatt ist eine Schaltflaeche, mit Datenblatt ein Link', async () => {
    const s = await seite();
    assert.ok(s.kachel('alpha-rifle').querySelector('.wz-k__name a[href="/de/items/alpha-rifle.html"]'));
    const ohne = s.kachel('delta-relic');
    assert.strictEqual(ohne.querySelector('.wz-k__name a'), null);
    assert.strictEqual(ohne.getAttribute('role'), 'button');
    assert.strictEqual(ohne.getAttribute('tabindex'), '0');
  });
});

describe('Suche', () => {
  test('14. Nach Namen: genau das Item', async () => {
    const s = await seite();
    await s.tippe('Gamma Jacket');
    assert.deepStrictEqual(s.namen(), ['Gamma Jacket']);
    assert.strictEqual(s.zahl(), '1');
  });

  test('15. Gross- und Kleinschreibung zaehlt nicht', async () => {
    const s = await seite();
    await s.tippe('bEtA hElMeT');
    assert.deepStrictEqual(s.namen(), ['Beta Helmet']);
  });

  test('16. Findet ueber den Ort', async () => {
    const s = await seite();
    await s.tippe('Lorville');
    assert.deepStrictEqual(s.namen(), ['Beta Helmet']);
  });

  test('17. Findet ueber die Kategorie', async () => {
    const s = await seite();
    await s.tippe('pistol');
    assert.deepStrictEqual(s.namen().sort(), ['Eta Pistol', 'Zeta Pistol']);
  });

  test('18. Mehrere Woerter muessen alle treffen', async () => {
    const s = await seite();
    await s.tippe('area 18 helmet');
    assert.deepStrictEqual(s.namen(), ['Beta Helmet']);
  });

  test('19. Ohne Treffer: Leer-Meldung mit Knopf, der alles zuruecksetzt', async () => {
    const s = await seite();
    await s.tippe('xyzzy-gibtsnicht');
    const leer = s.$('#wz-gitter .wz-leer');
    assert.ok(leer, 'keine Leer-Meldung');
    assert.ok(leer.textContent.includes(s.W.leerT));
    assert.strictEqual(s.zahl(), '0');
    await s.klick(leer.querySelector('[data-alles-weg]'));
    assert.strictEqual(s.kacheln().length, ALLE);
    assert.strictEqual(s.$('#wz-q').value, '');
  });

  test('20. Leeren der Suche stellt alle Items wieder her', async () => {
    const s = await seite();
    await s.tippe('Alpha');
    assert.strictEqual(s.kacheln().length, 1);
    await s.tippe('');
    assert.strictEqual(s.kacheln().length, ALLE);
  });

  test('21. Treffer im Namen werden markiert', async () => {
    const s = await seite();
    await s.tippe('rifle');
    assert.strictEqual(s.kachel('alpha-rifle').querySelector('.wz-k__name mark').textContent, 'Rifle');
  });

  test('22. Bester Namenstreffer zuerst (Relevanz)', async () => {
    const s = await seite();
    await s.tippe('pistol');
    // Beide beginnen nicht mit „pistol“: gleiche Stufe, dann der Grundrang
    // (kaufbar vor exklusiv).
    assert.deepStrictEqual(s.namen(), ['Eta Pistol', 'Zeta Pistol']);
  });
});

describe('Adresse', () => {
  test('23. ?q= fuellt die Suche beim Laden und filtert (Ziel der Kopfsuche)', async () => {
    const s = await seite({ query: '?q=Lorville' });
    assert.strictEqual(s.$('#wz-q').value, 'Lorville');
    assert.deepStrictEqual(s.namen(), ['Beta Helmet']);
  });

  test('24. ?kat= waehlt die Kategorie (Knopf „Diese Kategorie filtern“ der Kategorieliste)', async () => {
    const s = await seite({ query: '?kat=weapons-pistol' });
    assert.deepStrictEqual(s.namen().sort(), ['Eta Pistol', 'Zeta Pistol']);
    assert.ok(s.$('#wz-aktiv [data-weg="kat"]'), 'kein Chip fuer die gewaehlte Kategorie');
  });

  test('25. ?item= oeffnet das Blatt des Items (Id oder Name, Favoriten und Crafting-Links)', async () => {
    const s = await seite({ query: '?item=beta-helmet' });
    assert.strictEqual(s.blatt().querySelector('#wzb-name').textContent, 'Beta Helmet');
    const s2 = await seite({ query: '?item=' + encodeURIComponent('Gamma Jacket') });
    assert.strictEqual(s2.blatt().querySelector('#wzb-name').textContent, 'Gamma Jacket');
  });

  test('26. ?art=, ?sort= werden gelesen; Unsinn wird ignoriert', async () => {
    const s = await seite({ query: '?art=loot&sort=name-z' });
    assert.deepStrictEqual(s.namen(), ['Gamma Jacket', 'Alpha Rifle']);
    assert.strictEqual(s.$('#wz-sort').value, 'name-z');
    const s2 = await seite({ query: '?art=<script>&sort=drop' });
    assert.strictEqual(s2.kacheln().length, ALLE);
    assert.strictEqual(s2.$('#wz-sort').value, 'relevanz');
  });

  test('27. Tippen schreibt ?q= in die Adresse, Leeren nimmt es heraus', async () => {
    const s = await seite();
    await s.tippe('Beta');
    assert.match(s.adressen.at(-1), /^\/de\/items\.html\?q=Beta$/);
    await s.tippe('');
    assert.strictEqual(s.adressen.at(-1), '/de/items.html');
  });

  test('28. Kategorie und Auswahl stehen in der Adresse (teilbarer Link)', async () => {
    const s = await seite();
    await s.klick(s.doc.querySelector('#wz-chips [data-chip="weapons"]'));
    await s.klick(s.kachel('eta-pistol'));
    assert.strictEqual(s.adressen.at(-1), '/de/items.html?gruppe=weapons&item=eta-pistol');
  });
});

describe('Kategorie', () => {
  test('29. Gruppen-Chip filtert, zweiter Klick hebt auf', async () => {
    const s = await seite();
    const chip = () => s.doc.querySelector('#wz-chips [data-chip="weapons"]');
    await s.klick(chip());
    assert.strictEqual(s.kacheln().length, 3);
    assert.ok(chip().classList.contains('is-an'), 'gewaehlter Chip nicht markiert');
    await s.klick(chip());
    assert.strictEqual(s.kacheln().length, ALLE);
  });

  test('30. Unterkategorie in der zweiten Reihe', async () => {
    const s = await seite();
    await s.klick(s.doc.querySelector('#wz-chips [data-chip="weapons"]'));
    const blatt = s.doc.querySelector('#wz-chips [data-chipblatt="weapons-rifle"]');
    assert.ok(blatt, 'keine zweite Reihe fuer eine Gruppe mit zwei Kategorien');
    await s.klick(blatt);
    assert.deepStrictEqual(s.namen(), ['Alpha Rifle']);
  });

  test('31. Kategorie und Suche wirken zusammen', async () => {
    const s = await seite();
    await s.klick(s.doc.querySelector('#wz-chips [data-chip="weapons"]'));
    await s.tippe('area 18');
    assert.deepStrictEqual(s.namen().sort(), ['Alpha Rifle', 'Eta Pistol']);
  });

  test('32. Der Chip der Kategorie oben nimmt sie wieder heraus', async () => {
    const s = await seite();
    await s.klick(s.doc.querySelector('#wz-chips [data-chip="armour"]'));
    assert.strictEqual(s.kacheln().length, 1);
    await s.klick(s.$('#wz-aktiv [data-weg="kat"]'));
    assert.strictEqual(s.kacheln().length, ALLE);
  });
});

describe('Fundart-Filter', () => {
  test('33. Kaufbar: nur Items mit Shop- oder Haendler-Quelle', async () => {
    const s = await seite();
    await s.klick(s.filter('art', 'buy'));
    assert.deepStrictEqual(s.namen().sort(), ['Alpha Rifle', 'Beta Helmet', 'Epsilon Runner', 'Eta Pistol']);
  });

  test('34. Loot: nur Items mit Loot-Quelle', async () => {
    const s = await seite();
    await s.klick(s.filter('art', 'loot'));
    assert.deepStrictEqual(s.namen().sort(), ['Alpha Rifle', 'Gamma Jacket']);
  });

  test('35. Exklusiv: genau diese, und sie zaehlen nicht als Katalog', async () => {
    const s = await seite();
    await s.klick(s.filter('art', 'exclusive'));
    assert.deepStrictEqual(s.namen(), ['Zeta Pistol']);
    await s.klick(s.filter('art', 'catalog'));
    assert.ok(!s.namen().includes('Zeta Pistol'));
  });

  test('36. Nur Katalog: Items ohne Bezugsquelle', async () => {
    const s = await seite();
    await s.klick(s.filter('art', 'catalog'));
    assert.deepStrictEqual(s.namen().sort(), ['Delta Relic', 'Hadanite', 'Laranite (Ore)', 'Weird "Quoted" & Co <b>']);
  });

  test('37. Zurueck auf „Alle“ und „Zuruecksetzen“ heben den Filter auf', async () => {
    const s = await seite();
    await s.klick(s.filter('art', 'loot'));
    await s.klick(s.filter('art', 'all'));
    assert.strictEqual(s.kacheln().length, ALLE);
    await s.klick(s.filter('art', 'loot'));
    await s.klick(s.$('#wz-f-reset'));
    assert.strictEqual(s.kacheln().length, ALLE);
  });

  test('38. Filterknopf zaehlt die aktiven Filter', async () => {
    const s = await seite();
    assert.strictEqual(s.$('#wz-filterknopf').getAttribute('data-n'), null);
    await s.klick(s.filter('art', 'buy'));
    assert.strictEqual(s.$('#wz-filterknopf').getAttribute('data-n'), '1');
  });
});

describe('Sortierung', () => {
  test('39. Name absteigend', async () => {
    const s = await seite();
    await s.sortiere('name-z');
    const n = s.namen();
    assert.strictEqual(n[0], 'Zeta Pistol');
    assert.ok(n.indexOf('Zeta Pistol') < n.indexOf('Alpha Rifle'));
    assert.strictEqual(n.at(-1), 'Alpha Rifle');
  });

  test('40. Preis aufsteigend: billigstes zuerst, preislose am Ende', async () => {
    const s = await seite();
    await s.sortiere('preis');
    const n = s.namen();
    assert.deepStrictEqual(n.slice(0, 4), ['Beta Helmet', 'Alpha Rifle', 'Eta Pistol', 'Epsilon Runner']);
  });

  test('41. Preis absteigend: teuerstes zuerst, preislose bleiben am Ende', async () => {
    const s = await seite();
    await s.sortiere('preis-z');
    const n = s.namen();
    assert.deepStrictEqual(n.slice(0, 4), ['Epsilon Runner', 'Eta Pistol', 'Alpha Rifle', 'Beta Helmet']);
    assert.ok(n.indexOf('Delta Relic') > 3);
  });

  test('42. Name A–Z: das Grundmodell vor seinen Varianten', async () => {
    const db = makeDb();
    db.items.push({ id: 'alpha-rifle-sunset', name: 'Alpha "Sunset" Rifle', category: 'Weapons / Rifle', obtain: [] });
    const s = await seite({ db });
    await s.sortiere('name');
    const n = s.namen();
    assert.ok(n.indexOf('Alpha Rifle') < n.indexOf('Alpha "Sunset" Rifle'));
  });
});

describe('Blatt', () => {
  test('43. Kachel oeffnet das Blatt mit Bezugsquellen, billigste zuerst', async () => {
    const s = await seite();
    await s.klick(s.kachel('beta-helmet'));
    const b = s.blatt();
    assert.strictEqual(b.querySelector('#wzb-name').textContent, 'Beta Helmet');
    const zeilen = [...b.querySelectorAll('.wzb-q li')];
    assert.strictEqual(zeilen.length, 2);
    assert.ok(zeilen[0].textContent.includes('Armor Shop - Lorville'));
    assert.ok(zeilen[0].textContent.includes('500'));
    assert.ok(s.kachel('beta-helmet').classList.contains('is-sel'), 'gewaehlte Kachel nicht markiert');
  });

  test('44. Volatilitaets-Hinweis steht im Blatt', async () => {
    const s = await seite();
    await s.klick(s.kachel('alpha-rifle'));
    assert.ok(s.blatt().textContent.includes(s.T.volatileNote));
  });

  test('45. Katalogeintrag: ehrlicher Hinweis statt Tabelle', async () => {
    const s = await seite();
    await s.klick(s.kachel('delta-relic'));
    const b = s.blatt();
    assert.strictEqual(b.querySelector('.wzb-q'), null);
    assert.ok(b.textContent.includes(s.T.catalogNote));
  });

  test('46. Fundort-Guide wird gezeigt (englischer Spieltext mit lang="en")', async () => {
    const s = await seite();
    await s.klick(s.kachel('gamma-jacket'));
    const g = s.blatt().querySelector('.wzb-guide');
    assert.ok(g);
    assert.strictEqual(g.getAttribute('lang'), 'en');
    assert.ok(g.textContent.includes('executive lockers'));
  });

  test('47. Ø-Preis als Kennzahl, wenn er vom kleinsten Preis abweicht', async () => {
    const s = await seite();
    await s.klick(s.kachel('beta-helmet'));
    const kenn = s.blatt().querySelector('.wzb-kenn').textContent;
    assert.ok(kenn.includes(s.W.kSchnitt), kenn);
    assert.ok(kenn.includes('650'), kenn);
    await s.klick(s.kachel('epsilon-runner'));
    assert.ok(!s.blatt().querySelector('.wzb-kenn').textContent.includes(s.W.kSchnitt), 'Ø bei nur einer Quelle');
  });

  test('48. Kein Weg aufs Datenblatt: kein Item-, Bauplan-, Schiffsblatt, keine Kategorieliste', async () => {
    // Krisz 27.11.2026: „wofür sollte ein User den Datenblatt öffnen?“
    const s = await seite();
    const blattZiele = /^\/(?:de\/)?(?:items\/(?!category\/)[^/]+\.html|items\/category\/|crafting(?:\.html|\/)|schiffe\/|missionen\/|armor-sets\.html)/;
    for (const id of ['alpha-rifle', 'beta-helmet', 'epsilon-runner', 'eta-pistol', 'delta-relic']) {
      await s.klick(s.kachel(id));
      const b = s.blatt();
      assert.ok(b.querySelector('#wzb-name'), id);
      for (const a of b.querySelectorAll('a[href]')) {
        const pfad = new URL(a.getAttribute('href'), 'https://x.test/de/items.html').pathname;
        assert.ok(!blattZiele.test(pfad), `${id}: ${a.getAttribute('href')}`);
      }
      assert.strictEqual(b.querySelector('.wzb-haupt[href]'), null, `${id}: Hauptknopf fuehrt weg`);
    }
  });

  test('49. Crafting-Rezept erscheint, wenn es einen Bauplan gibt; sonst kein Abschnitt', async () => {
    const s = await seite();
    await s.klick(s.kachel('alpha-rifle'));
    const c = s.blatt().querySelector('.wzb-craft');
    assert.ok(c, 'kein Rezept-Abschnitt');
    assert.ok(c.textContent.includes('Iron'));
    assert.ok(c.textContent.includes('1 min 30 s'));
    // In die Crafting-Werkbank mit genau diesem Bauplan, nicht auf sein Blatt.
    assert.ok(s.blatt().querySelector('a[href="/de/topics/crafting.html?bp=Alpha%20Rifle&bpi=0"]'), 'kein Weg in die Crafting-Werkbank');
    assert.strictEqual(s.blatt().querySelector('a[href^="/de/crafting/"]'), null, 'Link aufs Bauplan-Blatt');
    await s.klick(s.kachel('beta-helmet'));
    assert.strictEqual(s.blatt().querySelector('.wzb-craft'), null);
    assert.strictEqual(s.blatt().querySelector('#wzb-craft'), null, 'leerer Platzhalter bleibt stehen');
  });

  test('50. Die Rezeptdatei laedt erst mit dem ersten Blatt, und nur einmal', async () => {
    const s = await seite();
    const n = () => s.geladen.filter((x) => x === '/assets/crafting-db.json').length;
    assert.strictEqual(n(), 0, 'Rezeptdatei laedt schon beim Start');
    await s.klick(s.kachel('alpha-rifle'));
    await s.klick(s.kachel('beta-helmet'));
    await s.klick(s.kachel('gamma-jacket'));
    assert.strictEqual(n(), 1);
  });

  test('51. Pfad im Blatt waehlt Gruppe und Kategorie', async () => {
    const s = await seite();
    await s.klick(s.kachel('eta-pistol'));
    await s.klick(s.blatt().querySelector('.wzb-pfad button[data-kat="weapons-pistol"]'));
    assert.deepStrictEqual(s.namen().sort(), ['Eta Pistol', 'Zeta Pistol']);
  });
});

describe('Fehler- und Leerzustaende', () => {
  test('52. Katalog nicht geladen: ehrliche Meldung mit neuem Versuch, keine „Nichts gefunden“', async () => {
    const s = await seite({ db: { status: 500, body: '' } });
    const leer = s.$('#wz-gitter .wz-leer');
    assert.ok(leer, 'keine Fehlermeldung');
    assert.strictEqual(leer.getAttribute('role'), 'alert');
    assert.ok(leer.textContent.includes(s.T.loadError));
    assert.ok(leer.querySelector('[data-neu-laden]'));
    assert.ok(!/fetch|http|json|undefined/i.test(leer.textContent), leer.textContent);
    // Suchen ersetzt die Meldung nicht.
    await s.tippe('Alpha');
    assert.ok(s.$('#wz-gitter .wz-leer[role="alert"]'));
  });

  test('53. Leerer Katalog: Leer-Meldung ohne Absturz', async () => {
    const s = await seite({ db: { items: [], sets: [] } });
    assert.ok(s.$('#wz-gitter .wz-leer'));
    assert.strictEqual(s.zahl(), '0');
    assert.deepStrictEqual(s.p.fehler, []);
  });

  test('54. Fehlende Rezeptdatei bricht das Blatt nicht', async () => {
    const s = await seite({ craft: { status: 404, body: '' } });
    await s.klick(s.kachel('alpha-rifle'));
    assert.strictEqual(s.blatt().querySelector('#wzb-name').textContent, 'Alpha Rifle');
    assert.strictEqual(s.blatt().querySelector('.wzb-craft'), null);
    assert.deepStrictEqual(s.p.fehler, []);
  });
});

describe('Erze verweisen auf die Mining-Seite', () => {
  test('55. Erz-Kachel nennt den Abbau mit Zahl der Fundorte statt „Kein Fundort bekannt“', async () => {
    const s = await seite();
    const ort = s.kachel('laranite-ore').querySelector('.wz-k__ort').textContent;
    assert.ok(ort.includes('7'), ort);
    assert.ok(!ort.includes(s.T.noSourceData), ort);
  });

  test('56. Erz-Blatt verlinkt das Mineral auf der Mining-Seite', async () => {
    const s = await seite();
    await s.klick(s.kachel('laranite-ore'));
    assert.ok(s.blatt().querySelector('a[href="/de/topics/mining.html?mineral=Laranite#db"]'));
  });

  test('57. Ohne erfasste Fundorte steht der Verweis ohne Zahl', async () => {
    const s = await seite();
    const ort = s.kachel('hadanite').querySelector('.wz-k__ort').textContent;
    assert.strictEqual(ort, s.T.oreCardOhne);
  });
});

describe('Was sonst nur das Datenblatt wusste', () => {
  test('58. „So bekommst du es“: je Weg eine Karte in der Reihenfolge des Blatts', async () => {
    const s = await seite();
    await s.klick(s.kachel('alpha-rifle'));
    const wl = s.blatt().querySelector('#wzb-wege .wzb-wl');
    assert.ok(wl, 'keine Wege-Uebersicht');
    const arten = [...wl.querySelectorAll(':scope > li[data-weg]')].map((li) => li.getAttribute('data-weg'));
    assert.deepStrictEqual(arten, ['kaufen', 'finden', 'herstellen', 'ab-werk']);
    assert.strictEqual(wl.getAttribute('data-wege'), '4');
    // Ab Werk springt zur Schiffsliste im Blatt, nicht auf ein Schiffsblatt.
    assert.ok(wl.querySelector('[data-weg="ab-werk"] button[data-sprung="wzb-serie"]'));
    const chips = [...s.blatt().querySelectorAll('#wzb-mehr .wzb-serie a')].map((a) => a.getAttribute('href'));
    assert.deepStrictEqual(chips, ['/de/schiffe.html?q=Aurora%20MR', '/de/schiffe.html?q=Cutlass%20Black']);
  });

  test('59. Missionen zum Bauplan: drei offen, der Rest in der Crafting-Werkbank', async () => {
    const s = await seite();
    await s.klick(s.kachel('alpha-rifle'));
    const k = s.blatt().querySelector('[data-weg="herstellen"]');
    const ul = k.querySelector('[data-missionen]');
    assert.strictEqual(ul.getAttribute('data-missionen'), '5');
    const zeilen = [...ul.querySelectorAll('li')].map((li) => li.textContent);
    assert.deepStrictEqual(zeilen, ['Mission A', 'Mission B (Stanton)', 'Mission C']);
    const mehr = [...k.querySelectorAll('a')].find((a) => a.textContent.includes(s.W.craftMehr.replace('{n}', '2')));
    assert.ok(mehr, k.textContent);
    assert.ok(mehr.getAttribute('href').startsWith('/de/topics/crafting.html?bp='));
  });

  test('60. Kaufen nach System: Knoepfe filtern die Bezugsquellen, die Wahl bleibt', async () => {
    const s = await seite();
    await s.klick(s.kachel('beta-helmet'));
    const b = s.blatt();
    const leiste = b.querySelector('[data-sysfilter]');
    assert.ok(leiste && !leiste.hidden, 'keine System-Knoepfe');
    assert.deepStrictEqual([...leiste.querySelectorAll('button')].map((x) => x.getAttribute('data-sys')), ['', 'stanton', 'pyro']);
    // Die Kaufen-Karte nennt beide Systeme.
    const sys = [...b.querySelectorAll('[data-weg="kaufen"] li[data-system]')].map((li) => li.getAttribute('data-system'));
    assert.deepStrictEqual(sys.sort(), ['Pyro', 'Stanton']);
    await s.klick(leiste.querySelector('button[data-sys="pyro"]'));
    const sichtbar = [...b.querySelectorAll('.wzb-q li[data-z]')].filter((li) => !li.hidden).map((li) => li.textContent);
    assert.strictEqual(sichtbar.length, 1);
    assert.ok(sichtbar[0].includes('Cubby Blast'), sichtbar[0]);
    assert.strictEqual(s.p.window.localStorage.getItem('vb-system'), 'pyro');
    // Ein Item mit nur einem System bekommt keine Knoepfe.
    await s.klick(s.kachel('eta-pistol'));
    assert.strictEqual(s.blatt().querySelector('[data-sysfilter]').hidden, true, 'ein System allein braucht keinen Filter');
  });

  test('61. „Falschen Wert melden“ in jedem Blatt, mit dem Item als Bezug', async () => {
    const s = await seite();
    for (const id of ['alpha-rifle', 'delta-relic']) {
      await s.klick(s.kachel(id));
      const a = s.blatt().querySelector('a[data-melden]');
      assert.ok(a, id);
      assert.strictEqual(a.getAttribute('href'), `/de/feedback.html?wert=/de/items/${id}.html`);
      assert.strictEqual(a.textContent, s.W.melden);
    }
  });

  test('62. Aehnliche Items oeffnen ihr Blatt in der Werkbank', async () => {
    const s = await seite();
    await s.klick(s.kachel('alpha-rifle'));
    const ids = [...s.blatt().querySelectorAll('[data-aehnlich] li')].map((li) => li.getAttribute('data-item'));
    assert.deepStrictEqual(ids, ['eta-pistol', 'zeta-pistol']);
    await s.klick(s.blatt().querySelector('[data-aehnlich] button[data-oeffne="eta-pistol"]'));
    assert.strictEqual(s.blatt().querySelector('#wzb-name').textContent, 'Eta Pistol');
  });

  test('63. Fahrzeug, Wikelo und Bruchrechner fuehren in Schiffsliste und Werkzeuge', async () => {
    const s = await seite();
    await s.klick(s.kachel('epsilon-runner'));
    assert.ok(s.blatt().querySelector('[data-fahrzeug]'));
    assert.ok(s.blatt().querySelector('a[href="/de/schiffe.html?q=Epsilon%20Runner"]'));
    await s.klick(s.kachel('beta-helmet'));
    const wk = s.blatt().querySelector('[data-weg="wikelo"] a');
    assert.strictEqual(wk.getAttribute('href'), '/de/topics/wikelo-emporium.html?item=Beta%20Helmet');
    await s.klick(s.kachel('eta-pistol'));
    const wz = [...s.blatt().querySelectorAll('[data-werkzeug]')].map((a) => [a.getAttribute('data-werkzeug'), a.getAttribute('href')]);
    assert.deepStrictEqual(wz, [['bruch', '/de/fracturing.html'], ['wikelo-material', '/de/topics/wikelo-emporium.html?item=Eta%20Pistol']]);
  });

  test('64. Preisspanne steht bei den Bezugsquellen', async () => {
    const s = await seite();
    await s.klick(s.kachel('beta-helmet'));
    const sp = s.blatt().querySelector('.wzb-preise [data-spanne]');
    assert.ok(sp, 'keine Preisspanne');
    assert.strictEqual(sp.textContent, '500–800');
  });

  test('65. Ohne /items-wege.json: Blatt ohne Wege, aber mit Melden und ohne Fehler', async () => {
    const s = await seite({ wege: { status: 404, body: '' } });
    await s.klick(s.kachel('alpha-rifle'));
    const b = s.blatt();
    assert.strictEqual(b.querySelector('#wzb-name').textContent, 'Alpha Rifle');
    assert.strictEqual(b.querySelector('#wzb-wege'), null);
    assert.ok(b.querySelector('a[data-melden]'));
    assert.ok(b.querySelector('.wzb-craft'), 'Rezept fehlt mit der Wege-Datei');
    assert.deepStrictEqual(s.p.fehler, []);
  });

  test('66. Wege-Datei zu einem anderen Katalog wird verworfen, nicht falsch zugeordnet', async () => {
    const db = makeDb();
    const wege = makeWege(db);
    wege.i.pop();
    const s = await seite({ db, wege });
    await s.klick(s.kachel('alpha-rifle'));
    assert.strictEqual(s.blatt().querySelector('#wzb-wege'), null);
    assert.strictEqual(s.blatt().querySelector('[data-aehnlich]'), null);
  });

  test('67. Die Wege-Datei laedt erst mit dem ersten Blatt, und nur einmal', async () => {
    const s = await seite();
    const n = () => s.geladen.filter((x) => x === '/de/items-wege.json').length;
    assert.strictEqual(n(), 0, 'Wege-Datei laedt schon beim Start');
    await s.klick(s.kachel('alpha-rifle'));
    await s.klick(s.kachel('beta-helmet'));
    assert.strictEqual(n(), 1);
  });
});
