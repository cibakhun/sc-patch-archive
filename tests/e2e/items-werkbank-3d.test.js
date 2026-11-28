// Auswahl im 3D-Dialog der Items-Werkbank (/items.html, Krisz 27.11.2026:
// „können wir beim 3d ansicht diese funktionen noch mit einbauen?“, die
// Zeilen aus dem Prototyp): dieses Item, andere Farben einzeln oder alle
// nebeneinander, das ganze Set getragen und seine Einzelteile.
//
// Lauf wie items-werkbank.test.js: die GEBAUTE Seite im Pruefstand, darin
// das Konfigurations-Skript und das KANONISCHE assets/items-werkbank.js; der
// Katalog und die Modell-Liste (/hangar-item3d.json) aus dem Fixture. Der
// Betrachter selbst (WebGL) laeuft hier nicht: an seiner Stelle steht ein
// Modul, das sich merkt, was der Dialog bei jedem zeige() bestellt. Wie der
// Betrachter die Teile stellt, prueft item3d-ansichten.test.js.
//
// Den Dialog gibt es nur im Vorschau-Bau (src/lib/item3d.ts). Im Live-Bau
// bringt der Test eine Kopie mit (DIALOG_KOPIE); dass sie dem gebauten
// Dialog gleicht, prueft Test 1, sobald ein Vorschau-Bau vorliegt, und dass
// der gebaute Dialog die Auswahl traegt, verify:item3d [6].
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { parseHTML } from 'linkedom';
import { oeffneSeite } from '../../scripts/lib/pruefstand.mjs';

const DIST = path.resolve('dist');
const SKRIPT = '/assets/items-werkbank.js';
const QUELLE = fs.readFileSync(path.resolve('assets/items-werkbank.js'), 'utf8');
const BUENDEL = new Map();
const LISTE = '/hangar-item3d.json';
const ABLAGE = 'https://ablage.test/';

// Der Dialog, wie Item3dDialog.astro ihn baut, mit allem, was die Werkbank
// daran liest (Texte als data-*, Haken als data-i3d-*).
const DIALOG_KOPIE = {
  de: { open: 'In 3D ansehen', title: '{name} in 3D', size: '{mb} MB', fail: 'Das 3D-Modell konnte nicht geladen werden.' },
  en: { open: 'View in 3D', title: '{name} in 3D', size: '{mb} MB', fail: 'The 3D model could not be loaded.' },
};
function dialogKopie(lang) {
  const t = DIALOG_KOPIE[lang];
  return `<dialog class="i3d" data-i3d aria-label="${t.open}" data-src="/assets/hangar-item3d.js?v=kopie" data-i3d-liste="${LISTE}?v=kopie"` +
    ` data-open="${t.open}" data-title="${t.title}" data-size="${t.size}" data-loading="…" data-fail="${t.fail}" data-no-gl="…">` +
    '<div class="i3d__box"><header class="i3d__kopf"><p class="i3d__titel" data-i3d-name></p><button type="button" class="i3d__zu" data-i3d-zu></button></header>' +
    '<div class="i3d__buehne" data-i3d-stage><p class="i3d__status" data-i3d-status role="status"></p></div>' +
    '<div class="i3d__wahl" data-i3d-wahl hidden></div>' +
    '<footer class="i3d__fuss"><span class="i3d__groesse" data-i3d-size></span><button type="button" data-i3d-reset hidden></button></footer></div></dialog>';
}
const seitePfad = (lang) => (lang === 'de' ? 'de/items.html' : 'items.html');
const gebautHatDialog = (lang) => /<dialog[^>]*\sdata-i3d[\s>]/.test(fs.readFileSync(path.join(DIST, seitePfad(lang)), 'utf8'));

// ---- Fixture ----
const BAUM = [
  { r: 'Weapons', s: 'weapons', n: 'Waffen', c: 4, g: 'gun', f: '#ff6b6b', b: [{ k: 'Weapons / Rifle', s: 'weapons-rifle', n: 'Gewehre', c: 4, g: 'gun' }] },
  { r: 'Armour', s: 'armour', n: 'Rüstung', c: 12, g: 'armor', f: '#4dabf7', b: [{ k: 'Armour / Combat / Heavy', s: 'armour-combat-heavy', n: 'Schwer', c: 12, g: 'armor' }] },
];
const RUESTUNG = 'Armour / Combat / Heavy';
const teil = (stelle, part, farbe) => ({
  id: `corbel-${stelle.toLowerCase()}-${farbe.toLowerCase().replace(/\s+/g, '-')}`,
  name: `Corbel ${stelle} ${farbe}`,
  category: RUESTUNG,
  obtain: [],
  game: { setId: 'corbel', part, weight: 'Heavy' },
});
// Corbel: Helm, Torso und Beine in Raider Camo und Smolder, Beine auch in
// Halcyon, Arme nur in Raider Camo. Der Torso in Smolder hat kein Modell.
const ITEMS = [
  teil('Helmet', 'Helmet', 'Raider Camo'), teil('Helmet', 'Helmet', 'Smolder'),
  teil('Core', 'Core', 'Raider Camo'), teil('Core', 'Core', 'Smolder'),
  teil('Arms', 'Arms', 'Raider Camo'),
  teil('Legs', 'Legs', 'Raider Camo'), teil('Legs', 'Legs', 'Smolder'), teil('Legs', 'Legs', 'Halcyon'),
  { id: 'tcs-4-undersuit', name: 'TCS-4 Undersuit', category: RUESTUNG, obtain: [], game: { setId: 'tcs-4', part: 'FullBody', weight: 'Undersuit' } },
  { id: 'karna-rifle', name: 'Karna Rifle', category: 'Weapons / Rifle', obtain: [] },
  { id: 'karna-alpine-sunset-rifle', name: 'Karna "Alpine Sunset" Rifle', category: 'Weapons / Rifle', obtain: [] },
  { id: 'karna-valor-rifle', name: 'Karna "Valor" Rifle', category: 'Weapons / Rifle', obtain: [] },
  { id: 'lone-rifle', name: 'Lone Rifle', category: 'Weapons / Rifle', obtain: [] },
];
const SETS = [
  {
    id: 'corbel', name: 'Corbel', manufacturer: 'Clark Defense Systems', weight: 'Heavy', source: 'prefix', parts: 8, coreSlots: 4,
    slots: {
      Helmet: ['Corbel Helmet Raider Camo', 'Corbel Helmet Smolder'],
      Torso: ['Corbel Core Raider Camo', 'Corbel Core Smolder'],
      Arms: ['Corbel Arms Raider Camo'],
      Legs: ['Corbel Legs Halcyon', 'Corbel Legs Raider Camo', 'Corbel Legs Smolder'],
    },
  },
  { id: 'tcs-4', name: 'TCS-4', manufacturer: 'Clark Defense Systems', weight: 'Undersuit', source: 'prefix', parts: 1, coreSlots: 0, slots: { Undersuit: ['TCS-4 Undersuit'] } },
];
// Modelle: jedes Item ausser dem Smolder-Torso, je 512 kB.
const MODELLE = Object.fromEntries(ITEMS.filter((i) => i.id !== 'corbel-core-smolder').map((i) => [i.id, [`${i.id}.gltf`, 512]]));
const url = (id) => ABLAGE + MODELLE[id][0];

/**
 * Oeffnet die Werkbank mit dem Fixture und dem Blatt von opt.item.
 * opt.kopie: die Kopie des Dialogs statt des gebauten (im Live-Bau immer).
 */
async function seite(opt = {}) {
  const lang = opt.sprache || 'de';
  const kopie = opt.kopie || !gebautHatDialog(lang);
  const antworten = new Map();
  antworten.set('/assets/universal-items.json', JSON.stringify({ generatedAt: '2026-11-27', counts: { items: ITEMS.length }, items: ITEMS, sets: SETS }));
  antworten.set('/assets/crafting-db.json', JSON.stringify({ blueprints: [] }));
  antworten.set(lang === 'de' ? '/de/items-wege.json' : '/items-wege.json', JSON.stringify({ sys: {}, i: ITEMS.map(() => null), sets: {} }));
  antworten.set(LISTE, JSON.stringify({ base: ABLAGE, items: MODELLE }));
  const p = await oeffneSeite({
    dist: DIST,
    esbuild,
    buendel: BUENDEL,
    importe: true,
    seite: seitePfad(lang),
    query: opt.item ? `?item=${encodeURIComponent(opt.item)}` : '',
    sprache: lang === 'de' ? 'de-DE' : 'en-US',
    antworten,
    skripte: (e) => e.name === SKRIPT || (e.code != null && e.code.includes('window.__WZI=')),
    umbau: (name, code) => {
      // Der Betrachter: merkt sich jede Bestellung, zeichnet nichts.
      if (name === SKRIPT) return QUELLE.replace('import(d.dataset.src)', 'window.__betrachter(d.dataset.src)');
      const dialog = kopie
        ? `document.querySelectorAll('dialog[data-i3d]').forEach(function (d) { d.remove(); });
           document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(dialogKopie(lang))});
           window.__WZI.i3dListe = ${JSON.stringify(`${LISTE}?v=kopie`)};`
        : '';
      return `${code}
        window.__WZI.baum = ${JSON.stringify(BAUM)};
        ${dialog}
        window.__bestellt = [];
        window.__betrachter = function (src) {
          return Promise.resolve({ zeige: function (d) {
            window.__bestellt.push({ src: src, modelle: (d.dataset.i3dModelle || '').split(' '), art: d.dataset.i3dArt, modell: d.dataset.i3dModel });
          } });
        };`;
    },
  });
  await p.settle(500);
  const doc = p.document;
  const W = p.window.__WZI.w;
  const dlg = () => doc.querySelector('dialog[data-i3d]');
  const wahl = () => dlg().querySelector('[data-i3d-wahl]');
  const klick = async (el) => { assert.ok(el, 'Element zum Klicken fehlt'); p.fire(el, 'click'); await p.settle(300); };
  const reihen = () => [...wahl().querySelectorAll('.i3d__reihe')].map((r) => ({
    lbl: r.querySelector('.i3d__lbl').textContent,
    chips: [...r.querySelectorAll('[data-i3d-ansicht]')].map((b) => b.textContent),
  }));
  const chip = (text) => [...wahl().querySelectorAll('[data-i3d-ansicht]')].find((b) => b.textContent === text);
  const gedrueckt = () => [...wahl().querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent);
  // Aus dem Pruefstand (eigener Kontext) als schlichte Werte herausholen.
  const letzte = () => JSON.parse(JSON.stringify(p.window.__bestellt[p.window.__bestellt.length - 1] ?? null));
  const titel = () => dlg().querySelector('[data-i3d-name]').textContent;
  const groesse = () => dlg().querySelector('[data-i3d-size]').textContent;
  const oeffne3d = async () => klick(doc.querySelector('#wz-blatt-inh [data-i3d-zeige]'));
  return { p, doc, W, dlg, wahl, klick, reihen, chip, gedrueckt, letzte, titel, groesse, oeffne3d, kopie };
}

describe('Werkbank: Auswahl im 3D-Dialog', () => {
  test('1. Die Kopie des Dialogs gleicht dem gebauten (nur im Vorschau-Bau pruefbar)', (t) => {
    if (!gebautHatDialog('de')) { t.diagnostic('Live-Bau: kein gebauter Dialog, die Tests laufen mit der Kopie'); return; }
    const haken = (html) => {
      const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
      const d = document.querySelector('dialog[data-i3d]');
      return {
        attr: [...d.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).sort(),
        innen: [...d.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.name)).filter((n) => n.startsWith('data-i3d')).sort(),
      };
    };
    const gebaut = fs.readFileSync(path.join(DIST, seitePfad('de')), 'utf8').match(/<dialog[^>]*\sdata-i3d[\s>][\s\S]*?<\/dialog>/)[0];
    assert.deepStrictEqual(haken(dialogKopie('de')), haken(gebaut));
  });

  test('2. Rüstungsteil: dieses Item, andere Farben, ganzes Set getragen, Einzelteile', async () => {
    const s = await seite({ item: 'corbel-legs-raider-camo' });
    await s.oeffne3d();
    assert.ok(s.dlg().hasAttribute('open'), 'Dialog ist offen');
    assert.strictEqual(s.wahl().hidden, false, 'Auswahl ist sichtbar');
    assert.deepStrictEqual(s.reihen(), [
      { lbl: s.W.i3dDieses, chips: ['Corbel Legs Raider Camo'] },
      { lbl: s.W.i3dFarben, chips: ['Halcyon', 'Smolder', s.W.i3dAlle.replace('{n}', '3')] },
      { lbl: s.W.i3dSet, chips: [s.W.i3dGetragen.replace('{name}', 'Corbel Raider Camo')] },
      // Gleiche Farbe aus dem Set: die Stelle; der Unteranzug ist fremd und
      // heisst, wie er heisst.
      { lbl: s.W.i3dTeile, chips: [s.p.window.__WZI.t.slotHelmet, s.p.window.__WZI.t.slotTorso, s.p.window.__WZI.t.slotArms, 'TCS-4 Undersuit'] },
    ]);
    // Zuerst das Item selbst, einzeln.
    assert.deepStrictEqual(s.letzte().modelle, [url('corbel-legs-raider-camo')]);
    assert.strictEqual(s.letzte().art, 'einzeln');
    assert.strictEqual(s.letzte().modell, url('corbel-legs-raider-camo'));
    assert.deepStrictEqual(s.gedrueckt(), ['Corbel Legs Raider Camo']);
    assert.strictEqual(s.titel(), 'Corbel Legs Raider Camo');
    assert.strictEqual(s.groesse(), '0,5 MB');
    assert.deepStrictEqual(s.p.fehler, []);
  });

  test('3. „Alle 3 nebeneinander“: das Item zuerst, dann die anderen Farben', async () => {
    const s = await seite({ item: 'corbel-legs-raider-camo' });
    await s.oeffne3d();
    await s.klick(s.chip(s.W.i3dAlle.replace('{n}', '3')));
    assert.deepStrictEqual(s.letzte().modelle, ['corbel-legs-raider-camo', 'corbel-legs-halcyon', 'corbel-legs-smolder'].map(url));
    assert.strictEqual(s.letzte().art, 'nebeneinander');
    assert.strictEqual(s.titel(), 'Corbel Legs: Raider Camo, Halcyon, Smolder');
    assert.strictEqual(s.dlg().getAttribute('aria-label'), 'Corbel Legs: Raider Camo, Halcyon, Smolder in 3D');
    assert.strictEqual(s.groesse(), s.W.i3dTeileGroesse.replace('{n}', '3').replace('{mb}', '1,5'));
    assert.deepStrictEqual(s.gedrueckt(), [s.W.i3dAlle.replace('{n}', '3')]);
  });

  test('4. Ganzes Set getragen: je Stelle die Farbe des Items, dazu der Unteranzug', async () => {
    const s = await seite({ item: 'corbel-legs-raider-camo' });
    await s.oeffne3d();
    await s.klick(s.chip(s.W.i3dGetragen.replace('{name}', 'Corbel Raider Camo')));
    assert.deepStrictEqual(s.letzte().modelle,
      ['corbel-helmet-raider-camo', 'corbel-core-raider-camo', 'corbel-arms-raider-camo', 'corbel-legs-raider-camo', 'tcs-4-undersuit'].map(url));
    assert.strictEqual(s.letzte().art, 'getragen');
    assert.strictEqual(s.titel(), s.W.i3dGetragen.replace('{name}', 'Corbel Raider Camo'));
    assert.strictEqual(s.groesse(), s.W.i3dTeileGroesse.replace('{n}', '5').replace('{mb}', '2,5'));
  });

  test('5. Eine andere Farbe und ein Einzelteil zeigen je dieses eine Item', async () => {
    const s = await seite({ item: 'corbel-legs-raider-camo' });
    await s.oeffne3d();
    await s.klick(s.chip('Smolder'));
    assert.deepStrictEqual(s.letzte().modelle, [url('corbel-legs-smolder')]);
    assert.strictEqual(s.letzte().art, 'einzeln');
    assert.strictEqual(s.titel(), 'Corbel Legs Smolder');
    await s.klick(s.chip(s.p.window.__WZI.t.slotHelmet));
    assert.deepStrictEqual(s.letzte().modelle, [url('corbel-helmet-raider-camo')]);
    assert.strictEqual(s.titel(), 'Corbel Helmet Raider Camo');
    assert.deepStrictEqual(s.gedrueckt(), [s.p.window.__WZI.t.slotHelmet]);
    // Zurueck zum Item.
    await s.klick(s.chip('Corbel Legs Raider Camo'));
    assert.deepStrictEqual(s.letzte().modelle, [url('corbel-legs-raider-camo')]);
    assert.deepStrictEqual(s.p.fehler, []);
  });

  test('6. Fehlt einer Stelle die Farbe (oder ihr Modell), traegt das Set eine andere und sagt keine Farbe', async () => {
    const s = await seite({ item: 'corbel-legs-smolder' });
    await s.oeffne3d();
    const r = s.reihen();
    // Arme gibt es nur in Raider Camo, der Smolder-Torso hat kein Modell.
    assert.deepStrictEqual(r.find((x) => x.lbl === s.W.i3dSet).chips, [s.W.i3dGetragen.replace('{name}', 'Corbel')]);
    assert.deepStrictEqual(r.find((x) => x.lbl === s.W.i3dTeile).chips,
      [s.p.window.__WZI.t.slotHelmet, 'Corbel Core Raider Camo', 'Corbel Arms Raider Camo', 'TCS-4 Undersuit']);
    await s.klick(s.chip(s.W.i3dGetragen.replace('{name}', 'Corbel')));
    assert.deepStrictEqual(s.letzte().modelle,
      ['corbel-helmet-smolder', 'corbel-core-raider-camo', 'corbel-arms-raider-camo', 'corbel-legs-smolder', 'tcs-4-undersuit'].map(url));
  });

  test('7. Waffe ohne Set: andere Farben aus demselben Grundmodell, kein Set', async () => {
    const s = await seite({ item: 'karna-alpine-sunset-rifle' });
    await s.oeffne3d();
    assert.deepStrictEqual(s.reihen(), [
      { lbl: s.W.i3dDieses, chips: ['Karna "Alpine Sunset" Rifle'] },
      { lbl: s.W.i3dFarben, chips: [s.W.i3dGrund, 'Valor', s.W.i3dAlle.replace('{n}', '3')] },
    ]);
    await s.klick(s.chip(s.W.i3dAlle.replace('{n}', '3')));
    assert.deepStrictEqual(s.letzte().modelle, ['karna-alpine-sunset-rifle', 'karna-rifle', 'karna-valor-rifle'].map(url));
    assert.strictEqual(s.titel(), `Karna Rifle: Alpine Sunset, ${s.W.i3dGrund}, Valor`);
  });

  test('8. Item ohne Geschwister: keine Auswahl, nur das Modell', async () => {
    const s = await seite({ item: 'lone-rifle' });
    await s.oeffne3d();
    assert.strictEqual(s.wahl().hidden, true);
    assert.strictEqual(s.wahl().innerHTML, '');
    assert.deepStrictEqual(s.letzte().modelle, [url('lone-rifle')]);
  });

  test('9. Ein anderes Item baut die Auswahl neu, beim Wiederoeffnen gilt wieder das Item', async () => {
    const s = await seite({ item: 'corbel-legs-raider-camo' });
    await s.oeffne3d();
    await s.klick(s.chip('Smolder'));
    await s.klick(s.dlg().querySelector('[data-i3d-zu]'));
    assert.strictEqual(s.dlg().hasAttribute('open'), false);
    await s.oeffne3d();
    assert.deepStrictEqual(s.letzte().modelle, [url('corbel-legs-raider-camo')]);
    assert.deepStrictEqual(s.gedrueckt(), ['Corbel Legs Raider Camo']);
    // Ins Blatt des Helms (Einzelteile im Blatt) und dort 3D.
    await s.klick(s.dlg().querySelector('[data-i3d-zu]'));
    await s.klick(s.doc.querySelector('#wz-blatt-inh [data-oeffne="corbel-helmet-raider-camo"]'));
    await s.oeffne3d();
    assert.deepStrictEqual(s.reihen()[0].chips, ['Corbel Helmet Raider Camo']);
    assert.deepStrictEqual(s.reihen()[1].chips, ['Smolder', s.W.i3dAlle.replace('{n}', '2')]);
    assert.deepStrictEqual(s.letzte().modelle, [url('corbel-helmet-raider-camo')]);
    assert.deepStrictEqual(s.p.fehler, []);
  });

  test('10. Englische Seite: englische Zeilen, Groesse mit Punkt', async () => {
    const s = await seite({ item: 'corbel-legs-raider-camo', sprache: 'en' });
    await s.oeffne3d();
    const r = s.reihen();
    assert.deepStrictEqual(r.map((x) => x.lbl), ['This item', 'Other colors', 'Full set', 'Parts']);
    assert.ok(r[1].chips.includes('All 3 side by side'));
    assert.deepStrictEqual(r[2].chips, ['Corbel Raider Camo worn']);
    assert.strictEqual(s.groesse(), '0.5 MB');
    await s.klick(s.chip('Corbel Raider Camo worn'));
    assert.strictEqual(s.groesse(), '5 parts · 2.5 MB');
    assert.deepStrictEqual(s.p.fehler, []);
  });

  test('11. Mit der Kopie des Dialogs laeuft dasselbe (wie im Live-Bau)', async () => {
    const s = await seite({ item: 'corbel-legs-raider-camo', kopie: true });
    await s.oeffne3d();
    assert.strictEqual(s.reihen().length, 4);
    assert.strictEqual(s.letzte().src, '/assets/hangar-item3d.js?v=kopie');
    assert.deepStrictEqual(s.p.fehler, []);
  });
});
