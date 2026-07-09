// Interaktions-Tests des Universal Item Finder gegen ein deterministisches
// Fixture im echten Schema (obtain[]-Bezugsquellen). Läuft im Mock-DOM gegen
// das KANONISCHE Script assets/item-finder-app.js.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { setupMockDOM } from './helpers/dom-mock.js';

const scriptPath = path.resolve('assets/item-finder-app.js');

// ---- Fixture: 6 handverlesene Items + optionale Katalog-Füller für Pagination ----
function makeDb(fillerCount = 0) {
  const items = [
    {
      id: 'alpha-rifle', name: 'Alpha Rifle', category: 'Weapons / Rifle',
      obtain: [
        { kind: 'shop', loc: 'Live Fire Weapons - Area 18', price: 1000 },
        { kind: 'loot', loc: 'Security Bunker' },
      ],
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
      guide: 'Nur in Executive-Spinden im Verwaltungstrakt zu finden.',
    },
    { id: 'delta-relic', name: 'Delta Relic', category: 'Other', obtain: [] },
    {
      id: 'epsilon-runner', name: 'Epsilon Runner', category: 'Vehicle',
      obtain: [{ kind: 'vehicle', loc: 'Astro Armada - Area 18', price: 1500000 }],
    },
    { id: 'quote-co', name: 'Weird "Quoted" & Co', category: 'Other', obtain: [] },
  ];
  for (let i = 1; i <= fillerCount; i++) {
    items.push({
      id: `zz-filler-${String(i).padStart(3, '0')}`,
      name: `Zz Filler ${String(i).padStart(3, '0')}`,
      category: 'Other',
      obtain: [],
    });
  }
  const withObtain = items.filter((i) => i.obtain.length).length;
  return {
    generator: 'scripts/build-universal-db.mjs',
    generatedAt: '2026-07-09',
    note: 'Fixture',
    sources: {},
    counts: { items: items.length, withObtain, catalogOnly: items.length - withObtain },
    items,
  };
}

const CRAFT_FIXTURE = {
  blueprints: [
    {
      name: 'Alpha Rifle', craft_time_seconds: 90, tiers: 2,
      ingredients: [{ slot: 'Metall', options: [{ name: 'Iron', quantity_scu: 2 }] }],
    },
  ],
};

function cards(dom) {
  return dom.elements['uif-results-grid'].querySelectorAll('.uif-card');
}
function cardTitles(dom) {
  return cards(dom).map((c) => c.querySelector('.uif-card-title').textContent);
}

describe('Laden & Grundzustand', () => {
  let dom;
  beforeEach(async () => {
    dom = await setupMockDOM({ db: makeDb(), craft: CRAFT_FIXTURE });
    await dom.runScript(scriptPath);
    await dom.wait(10);
  });

  test('1. Alle Fixture-Items werden gerendert', () => {
    assert.strictEqual(cards(dom).length, 6);
  });

  test('2. Statuszeile zeigt ehrliche Bereichsangabe', () => {
    assert.strictEqual(dom.elements['uif-stats-count'].textContent, '1–6 von 6 Einträgen');
  });

  test('3. Standard-Sortierung ist Name aufsteigend', () => {
    const titles = cardTitles(dom);
    assert.strictEqual(titles[0], 'Alpha Rifle');
    assert.deepStrictEqual([...titles].sort((a, b) => a.localeCompare(b)), titles);
  });

  test('4. Kategorien-Sidebar zeigt jede Wurzel mit Anzahl', () => {
    const btns = dom.elements['uif-category-list'].querySelectorAll('.uif-category-btn');
    assert.strictEqual(btns.length, 5); // Weapons, Armour, Clothing, Vehicle, Other
    const other = btns.find((b) => b.getAttribute('data-category') === 'Other');
    assert.ok(other.textContent.includes('(2)'));
  });

  test('5. Fundart-Chips werden gerendert (Alle/Kaufbar/Loot/Nur Katalog)', () => {
    const chips = dom.elements['uif-kind-chips'].querySelectorAll('.uif-chip');
    assert.deepStrictEqual(chips.map((c) => c.getAttribute('data-kind')), ['all', 'buy', 'loot', 'catalog']);
    assert.ok(chips[0].classList.contains('active'));
  });

  test('6. Keine Pagination bei einer Seite', () => {
    assert.strictEqual(dom.elements['uif-pagination-container'].children.length, 0);
  });
});

describe('Karten-Inhalte (ehrliche Darstellung)', () => {
  let dom;
  beforeEach(async () => {
    dom = await setupMockDOM({ db: makeDb() });
    await dom.runScript(scriptPath);
    await dom.wait(10);
  });

  test('7. Mehrere Quellen: Minimalpreis mit „ab“-Präfix', () => {
    const beta = cards(dom).find((c) => c.getAttribute('data-id') === 'beta-helmet');
    assert.ok(beta.querySelector('.uif-card-price').textContent.includes('ab 500 aUEC'));
  });

  test('8. Loot-only-Item zeigt „Nur Loot“ statt Fantasiepreis', () => {
    const gamma = cards(dom).find((c) => c.getAttribute('data-id') === 'gamma-jacket');
    assert.strictEqual(gamma.querySelector('.uif-card-price').textContent, 'Nur Loot');
  });

  test('9. Katalog-Item: „Keine Handelsdaten“ + „Kein Fundort bekannt“', () => {
    const delta = cards(dom).find((c) => c.getAttribute('data-id') === 'delta-relic');
    assert.strictEqual(delta.querySelector('.uif-card-price').textContent, 'Keine Handelsdaten');
    assert.ok(delta.querySelector('.uif-loc-none'));
  });

  test('10. Mehrere Fundorte: erster Ort + „+N“-Badge', () => {
    const alpha = cards(dom).find((c) => c.getAttribute('data-id') === 'alpha-rifle');
    const loc = alpha.querySelector('.uif-card-location');
    assert.ok(loc.textContent.includes('Live Fire Weapons - Area 18'));
    assert.ok(loc.querySelector('.uif-loc-more').textContent.includes('+1'));
  });

  test('11. Sonderzeichen im Namen werden escaped gerendert', () => {
    const q = cards(dom).find((c) => c.getAttribute('data-id') === 'quote-co');
    assert.ok(q, 'Karte mit Sonderzeichen-Name fehlt');
    assert.ok(q.querySelector('.uif-card-title').textContent.includes('Weird'));
    assert.ok(dom.elements['uif-results-grid'].innerHTML.includes('&amp; Co'));
    assert.ok(!dom.elements['uif-results-grid'].innerHTML.includes('<Weird'));
  });
});

describe('Suche', () => {
  let dom;
  beforeEach(async () => {
    dom = await setupMockDOM({ db: makeDb() });
    await dom.runScript(scriptPath);
    await dom.wait(10);
  });

  test('12. Suche nach Namen findet genau das Item', () => {
    dom.elements['uif-search-input'].value = 'Alpha Rifle';
    assert.deepStrictEqual(cardTitles(dom), ['Alpha Rifle']);
  });

  test('13. Suche ist case-insensitiv', () => {
    dom.elements['uif-search-input'].value = 'ALPHA rifle';
    assert.deepStrictEqual(cardTitles(dom), ['Alpha Rifle']);
  });

  test('14. Suche findet über Fundort', () => {
    dom.elements['uif-search-input'].value = 'Security Bunker';
    assert.deepStrictEqual(cardTitles(dom), ['Alpha Rifle']);
  });

  test('15. Suche findet über Kategorie-Pfad', () => {
    dom.elements['uif-search-input'].value = 'Combat / Light';
    assert.deepStrictEqual(cardTitles(dom), ['Beta Helmet']);
  });

  test('16. Treffer-lose Suche zeigt leere-Ergebnis-Meldung', () => {
    dom.elements['uif-search-input'].value = 'gibtesnicht-xyz';
    const grid = dom.elements['uif-results-grid'];
    assert.ok(grid.querySelector('.uif-empty').textContent.includes('Keine passenden Items'));
    assert.strictEqual(dom.elements['uif-stats-count'].textContent, '0 Einträge');
  });

  test('17. Leeren der Suche stellt alle Items wieder her', () => {
    dom.elements['uif-search-input'].value = 'Alpha';
    dom.elements['uif-search-input'].value = '';
    assert.strictEqual(cards(dom).length, 6);
  });
});

describe('Kategorie-Filter', () => {
  let dom;
  beforeEach(async () => {
    dom = await setupMockDOM({ db: makeDb() });
    await dom.runScript(scriptPath);
    await dom.wait(10);
  });

  function catBtn(cat) {
    return dom.elements['uif-category-list'].querySelectorAll('.uif-category-btn')
      .find((b) => b.getAttribute('data-category') === cat);
  }

  test('18. Klick auf Kategorie filtert das Grid', () => {
    catBtn('Weapons').click();
    assert.deepStrictEqual(cardTitles(dom), ['Alpha Rifle']);
  });

  test('19. Aktive Kategorie ist markiert (nach Re-Render abgefragt)', () => {
    catBtn('Weapons').click();
    assert.ok(catBtn('Weapons').classList.contains('active'));
  });

  test('20. Erneuter Klick hebt den Filter auf (Toggle)', () => {
    catBtn('Clothing').click();
    assert.strictEqual(cards(dom).length, 1);
    catBtn('Clothing').click();
    assert.strictEqual(cards(dom).length, 6);
  });

  test('21. Kategorie + Suche kombinieren sich', () => {
    catBtn('Other').click();
    dom.elements['uif-search-input'].value = 'Delta';
    assert.deepStrictEqual(cardTitles(dom), ['Delta Relic']);
  });
});

describe('Fundart-Filter (Chips)', () => {
  let dom;
  beforeEach(async () => {
    dom = await setupMockDOM({ db: makeDb() });
    await dom.runScript(scriptPath);
    await dom.wait(10);
  });

  function chip(kind) {
    return dom.elements['uif-kind-chips'].querySelectorAll('.uif-chip')
      .find((c) => c.getAttribute('data-kind') === kind);
  }

  test('22. „Kaufbar“ zeigt nur Items mit Shop-/Händler-Quelle', () => {
    chip('buy').click();
    assert.deepStrictEqual(cardTitles(dom), ['Alpha Rifle', 'Beta Helmet', 'Epsilon Runner']);
  });

  test('23. „Loot“ zeigt nur Items mit Loot-Quelle', () => {
    chip('loot').click();
    assert.deepStrictEqual(cardTitles(dom), ['Alpha Rifle', 'Gamma Jacket']);
  });

  test('24. „Nur Katalog“ zeigt Items ohne Bezugsquelle', () => {
    chip('catalog').click();
    assert.deepStrictEqual(cardTitles(dom), ['Delta Relic', 'Weird "Quoted" & Co']);
  });

  test('25. Zurück auf „Alle“ hebt den Filter auf', () => {
    chip('catalog').click();
    chip('all').click();
    assert.strictEqual(cards(dom).length, 6);
  });
});

describe('Sortierung', () => {
  let dom;
  beforeEach(async () => {
    dom = await setupMockDOM({ db: makeDb() });
    await dom.runScript(scriptPath);
    await dom.wait(10);
  });

  test('26. Name absteigend', () => {
    dom.elements['uif-sort-select'].value = 'name_desc';
    const titles = cardTitles(dom);
    assert.strictEqual(titles[0], 'Weird "Quoted" & Co');
  });

  test('27. Preis aufsteigend: billigstes zuerst, preislose ans Ende (nach Name)', () => {
    dom.elements['uif-sort-select'].value = 'price_asc';
    assert.deepStrictEqual(cardTitles(dom), [
      'Beta Helmet', 'Alpha Rifle', 'Epsilon Runner',
      'Delta Relic', 'Gamma Jacket', 'Weird "Quoted" & Co',
    ]);
  });

  test('28. Preis absteigend: teuerstes zuerst, preislose bleiben am Ende', () => {
    dom.elements['uif-sort-select'].value = 'price_desc';
    const titles = cardTitles(dom);
    assert.deepStrictEqual(titles.slice(0, 3), ['Epsilon Runner', 'Alpha Rifle', 'Beta Helmet']);
  });
});

describe('Pagination (70 Einträge)', () => {
  let dom;
  beforeEach(async () => {
    dom = await setupMockDOM({ db: makeDb(64) }); // 6 + 64 = 70
    await dom.runScript(scriptPath);
    await dom.wait(10);
  });

  function pag() { return dom.elements['uif-pagination-container']; }

  test('29. Seite 1 zeigt 60 Karten, Statuszeile stimmt', () => {
    assert.strictEqual(cards(dom).length, 60);
    assert.strictEqual(dom.elements['uif-stats-count'].textContent, '1–60 von 70 Einträgen');
  });

  test('30. „Weiter“ blättert zur Restseite mit 10 Karten', () => {
    pag().querySelector('#uif-next-btn').click();
    assert.strictEqual(cards(dom).length, 10);
    assert.strictEqual(dom.elements['uif-stats-count'].textContent, '61–70 von 70 Einträgen');
  });

  test('31. Seiteninfo und Endzustand: „Weiter“ ist auf letzter Seite deaktiviert', () => {
    pag().querySelector('#uif-page-last').click();
    assert.ok(pag().querySelector('#uif-page-info').textContent.includes('Seite 2 von 2'));
    assert.strictEqual(pag().querySelector('#uif-next-btn').getAttribute('disabled'), 'disabled');
  });

  test('32. „Anfang“ springt von hinten zurück auf Seite 1', () => {
    pag().querySelector('#uif-page-last').click();
    pag().querySelector('#uif-page-first').click();
    assert.strictEqual(cards(dom).length, 60);
  });

  test('33. Filterwechsel setzt auf Seite 1 zurück', () => {
    pag().querySelector('#uif-next-btn').click();
    dom.elements['uif-search-input'].value = 'Zz Filler';
    assert.strictEqual(dom.elements['uif-stats-count'].textContent, '1–60 von 64 Einträgen');
  });
});

describe('Detail-Modal', () => {
  let dom;
  beforeEach(async () => {
    dom = await setupMockDOM({ db: makeDb(), craft: CRAFT_FIXTURE });
    await dom.runScript(scriptPath);
    await dom.wait(10);
  });

  function openCard(id) {
    cards(dom).find((c) => c.getAttribute('data-id') === id).click();
  }
  function modal() { return dom.elements['uif-item-modal']; }
  function body() { return dom.elements['uif-modal-body-content']; }

  test('34. Karte öffnet Modal mit Bezugsquellen-Tabelle', () => {
    openCard('alpha-rifle');
    assert.strictEqual(modal().style.display, 'flex');
    const rows = body().querySelectorAll('.uif-obtain-row');
    assert.strictEqual(rows.length, 2);
    assert.ok(body().textContent.includes('Live Fire Weapons - Area 18'));
    assert.ok(body().textContent.includes('1.000 aUEC'));
  });

  test('35. Volatilitäts-Hinweis steht im Modal', () => {
    openCard('alpha-rifle');
    assert.ok(body().textContent.includes('Patch-volatil'));
  });

  test('36. Katalog-Item zeigt ehrlichen Katalog-Hinweis statt Tabelle', () => {
    openCard('delta-relic');
    assert.strictEqual(body().querySelectorAll('.uif-obtain-row').length, 0);
    assert.ok(body().textContent.includes('keine verifizierten Shop- oder Loot-Daten'));
  });

  test('37. Loot-Guide wird angezeigt', () => {
    openCard('gamma-jacket');
    assert.ok(body().textContent.includes('Fundort-Guide'));
    assert.ok(body().textContent.includes('Executive-Spinden'));
  });

  test('38. Crafting-Rezept erscheint, wenn Blueprint existiert', () => {
    openCard('alpha-rifle');
    assert.ok(body().textContent.includes('Crafting-Rezept'));
    assert.ok(body().textContent.includes('1m 30s'));
    assert.ok(body().textContent.includes('Iron'));
  });

  test('39. Kein Crafting-Abschnitt ohne Blueprint', () => {
    openCard('beta-helmet');
    assert.ok(!body().textContent.includes('Crafting-Rezept'));
  });

  test('40. Öffnen sperrt Hintergrund-Scroll, Schließen gibt ihn frei', () => {
    openCard('alpha-rifle');
    assert.strictEqual(dom.body.style.overflow, 'hidden');
    dom.elements['uif-modal-close-btn'].click();
    assert.strictEqual(modal().style.display, 'none');
    assert.strictEqual(dom.body.style.overflow, '');
  });

  test('41. Klick auf Overlay schließt das Modal', () => {
    openCard('alpha-rifle');
    modal().dispatchEvent('click');
    assert.strictEqual(modal().style.display, 'none');
  });
});

describe('Fehler- und Leerzustände', () => {
  test('42. Fetch-Fehler zeigt ehrliche Fehlermeldung (kein Dev-Sprech)', async () => {
    const dom = await setupMockDOM({ db: makeDb(), failDb: true });
    await dom.runScript(scriptPath);
    await dom.wait(10);
    const gridText = dom.elements['uif-results-grid'].textContent;
    assert.ok(gridText.includes('konnte nicht geladen werden'));
    assert.ok(!/dataminer/i.test(gridText));
    assert.strictEqual(dom.elements['uif-stats-count'].textContent, '0 Einträge');
  });

  test('43. Leere Datenbank rendert leeren Zustand ohne Crash', async () => {
    const empty = makeDb();
    empty.items = [];
    empty.counts = { items: 0, withObtain: 0, catalogOnly: 0 };
    const dom = await setupMockDOM({ db: empty });
    await dom.runScript(scriptPath);
    await dom.wait(10);
    assert.ok(dom.elements['uif-results-grid'].textContent.includes('Keine passenden Items'));
  });

  test('44. Fehlende Crafting-DB bricht die App nicht', async () => {
    const dom = await setupMockDOM({ db: makeDb(), craft: null });
    await dom.runScript(scriptPath);
    await dom.wait(10);
    assert.strictEqual(cards(dom).length, 6);
  });
});
