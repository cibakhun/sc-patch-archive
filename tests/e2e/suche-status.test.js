// Die Suche sagt, was sie gerade tut (07.11.2026).
//
// Anlass: Krisz tippte am iPhone auf staging "Panther" in die Suche und sah
// zwischen Eingabe und Fusszeile nur einen leeren Streifen. Der Treffer
// (CF-337 Panther Repeater) steht im ZWEITEN Index-Teil (Items und
// Blueprints). assets/search-overlay.js liess die Liste in drei Lagen
// wortlos leer:
//   1. der erste Teil kam nicht an — auf staging etwa, wenn der Testpilot-
//      Ausweis gerade ablief: der Abruf landet per Umleitung auf der
//      HTML-Torseite, r.json() wirft, und `index` blieb null, bis die Suche
//      neu geoeffnet wurde;
//   2. der erste Teil war da, der zweite noch unterwegs (auf dem Telefon
//      spuerbar laenger) — "nichts gefunden" waere verfrueht, also stand dort
//      gar nichts;
//   3. der zweite Teil kam nicht an: dann hiess es "kein Treffer", obwohl
//      Items und Blueprints nie durchsucht wurden.
//
// Diese Datei faehrt das ECHTE Skript in einem node:vm gegen ein kleines
// DOM und einen gesteuerten fetch(). Sie misst Verhalten: welche Zeilen in
// der Liste stehen, nicht wie der Quelltext aussieht. Die Texte kommen aus
// den echten Modulen (src/lib/searchUi.ts, gebuendelt wie in
// i18n-strikt.test.js), damit auch die Verdrahtung der data-Attribute
// geprueft ist — in beiden Sprachen.
//
// Die Tastenhinweise auf Touch-Geraeten (CSS) prueft der Browser-Rauchtest
// (scripts/browser-smoke.mjs, probeSuche), nicht diese Datei.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const CODE = fs.readFileSync(path.resolve('assets/search-overlay.js'), 'utf8');

async function bundle(entry) {
  const { buildSync } = await import('esbuild');
  const out = buildSync({
    stdin: { contents: `export * from ${JSON.stringify(path.resolve(entry))};`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suche-status-'));
  const file = path.join(dir, 'mod.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}
const { searchRootData } = await bundle('src/lib/searchUi.ts');

/* ---------- Ein kleines DOM, gerade gross genug fuer das Overlay ---------- */
class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.listeners = {};
    this.hidden = false;
    this.className = '';
    this.textContent = '';
    this.value = '';
    const self = this;
    this.classList = {
      add(c) { const s = new Set(self.className.split(' ').filter(Boolean)); s.add(c); self.className = [...s].join(' '); },
      remove(c) { self.className = self.className.split(' ').filter((x) => x && x !== c).join(' '); },
    };
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v);
  }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { this.children.push(c); return c; }
  set innerHTML(v) { if (v === '') this.children = []; else throw new Error('innerHTML nur zum Leeren'); }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  fire(t, ev = {}) { for (const fn of this.listeners[t] || []) fn({ preventDefault() {}, target: this, ...ev }); }
  focus() {}
  select() {}
  querySelectorAll(sel) {
    if (sel === 'li[role="option"]') return this.children.filter((c) => c.attrs.role === 'option');
    if (sel === '[data-scs-close]') return [];
    throw new Error(`Selektor nicht nachgebaut: ${sel}`);
  }
  // Text der Zeile wie im Browser: eigene Worte plus die der Kinder.
  get text() { return [this.textContent, ...this.children.map((c) => c.text)].filter(Boolean).join(' '); }
  find(cls) {
    for (const c of this.children) {
      if (c.className.split(' ').includes(cls)) return c;
      const tief = c.find(cls);
      if (tief) return tief;
    }
    return null;
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
async function flush() { for (let i = 0; i < 8; i++) await tick(); }

const ITEMS = [
  { k: 'item', b: 'Guns', t: 'CF-337 Panther Repeater', s: 'Klaus & Werner · S3', u: '/items/cf-337-panther-repeater.html', x: '' },
  { k: 'bauplan', b: 'Guns', t: 'CF-337 Panther Repeater', s: 'Ship components', u: '/crafting/cf-337-panther-repeater.html', x: '' },
];
const ERSTER = [
  { k: 'schiff', b: 'Anvil', t: 'Arrow', s: 'Anvil Aerospace', u: '/schiffe/arrow.html', x: '' },
];

/* Antworten je Index-Teil, gesteuert vom Test:
     'ok'     JSON wie ausgeliefert
     'tor'    200 mit HTML (Umleitung auf /gate.html) — r.json() wirft
     'warten' haengt, bis der Test ihn mit .loese() freigibt */
function netz(plan) {
  const offen = {};
  const abrufe = [];
  const fetch = (url) => {
    abrufe.push(url);
    const teil = /more/.test(url) ? 'more' : 'index';
    const daten = teil === 'more' ? ITEMS : ERSTER;
    const art = (Array.isArray(plan[teil]) ? plan[teil].shift() : plan[teil]) || 'ok';
    const antwort = () => {
      if (art === 'tor') return Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token <')) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(daten))) });
    };
    if (art === 'warten') return new Promise((r) => { offen[teil] = () => r(antwort().then((x) => x)); });
    return antwort();
  };
  return { fetch, abrufe, loese: (teil) => { offen[teil](); delete offen[teil]; } };
}

function boot(lang, plan) {
  const root = new El('div');
  root.hidden = true;
  for (const [k, v] of Object.entries(searchRootData(lang))) root.setAttribute(k, v);
  const input = new El('input');
  const list = new El('ul');
  const byId = { scs: root, 'scs-in': input, 'scs-list': list };
  const doc = new El('#document');
  doc.getElementById = (id) => byId[id] || null;
  doc.createElement = (t) => new El(t);
  doc.activeElement = null;
  const n = netz(plan);
  // Eigene Uhr statt der echten (Review #312): die Sperrfrist fuer den
  // Neuversuch beim Tippen (RETRY_MS) haengt an Date.now(). Mit der echten
  // Uhr loeste ein CI-Rechner, der zwischen Oeffnen und Tippen laenger als
  // 2,5 s haengt, den Neuversuch selbst aus, und der Fehlertest saehe
  // Treffer statt der Fehlerzeile. Die Uhr steht, bis ein Test sie stellt.
  const uhr = { t: 1_000_000 };
  const win = {
    document: doc,
    fetch: n.fetch,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    location: { href: '' },
    setTimeout, clearTimeout,
    Date: { now: () => uhr.t },
  };
  win.window = win;
  vm.runInContext(CODE, vm.createContext(win));
  assert.equal(typeof win.__scsOpen, 'function', 'das Skript hat sich nicht angemeldet');
  const tippe = (s) => { input.value = s; input.fire('input'); };
  const zeilen = () => list.children.map((c) => c.className);
  return { win, root, input, list, n, uhr, tippe, zeilen, rd: searchRootData(lang) };
}

for (const lang of ['de', 'en']) {
  describe(`Suche zeigt Laden und Scheitern (${lang})`, () => {
    test('erster Teil kommt nicht an (Umleitung aufs Tor): Fehlerzeile mit Knopf, nicht leer', async () => {
      const s = boot(lang, { index: ['tor', 'ok'], more: ['tor', 'ok'] });
      s.win.__scsOpen();
      await flush();
      // Schon vor dem Tippen sichtbar: die Suche weiss, dass sie nichts hat.
      assert.equal(s.list.children.length, 1, 'ohne Index muss eine Zeile erklaeren, warum nichts kommt');
      s.tippe('Panther');
      await flush();
      const z = s.list.children[0];
      assert.match(z.className, /scs__status--fehler/);
      assert.ok(z.text.includes(s.rd['data-failed-title']), `Fehlertitel fehlt: "${z.text}"`);
      const knopf = z.find('scs__retry');
      assert.ok(knopf, 'die Fehlerzeile braucht einen Knopf "Erneut versuchen"');
      assert.equal(knopf.textContent, s.rd['data-retry']);
      // Der Knopf holt neu, und jetzt stehen die Panther-Treffer da.
      knopf.fire('click');
      await flush();
      const arten = s.list.children.filter((c) => c.attrs.role === 'option').map((c) => c.className);
      assert.ok(arten.some((c) => c.includes('scs__hit--item')), `kein Item-Treffer nach dem Neuversuch: ${s.zeilen()}`);
      assert.equal(s.n.abrufe.length, 4, 'je Teil genau ein Neuversuch');
    });

    test('zweiter Teil noch unterwegs: Ladezeile statt leerer Liste, danach die Treffer', async () => {
      const s = boot(lang, { more: 'warten' });
      s.win.__scsOpen();
      await flush();
      s.tippe('Panther');
      await flush();
      assert.deepEqual(s.zeilen(), ['scs__empty scs__status scs__status--laedt']);
      assert.ok(s.list.children[0].text.includes(s.rd['data-loading-more']));
      s.n.loese('more');
      await flush();
      const treffer = s.list.children.filter((c) => c.attrs.role === 'option');
      assert.equal(treffer.length, 2, `Panther-Treffer nach dem zweiten Teil: ${s.zeilen()}`);
      assert.ok(!s.zeilen().some((c) => c.includes('scs__status')), 'die Ladezeile muss danach weg sein');
    });

    test('Treffer aus dem ersten Teil stehen, darunter der Hinweis, dass Items noch kommen', async () => {
      const s = boot(lang, { more: 'warten' });
      s.win.__scsOpen();
      await flush();
      s.tippe('Arrow');
      await flush();
      const z = s.zeilen();
      assert.ok(z[0].includes('scs__hit--schiff'), `Schiff zuerst: ${z}`);
      assert.ok(z.at(-1).includes('scs__status--laedt'), `Ladehinweis als letzte Zeile: ${z}`);
    });

    test('erster Teil noch unterwegs: Ladezeile, sobald getippt wurde', async () => {
      const s = boot(lang, { index: 'warten', more: 'warten' });
      s.win.__scsOpen();
      await flush();
      assert.equal(s.list.children.length, 0, 'vor dem Tippen kein Ladehinweis (kein Flackern beim Oeffnen)');
      s.tippe('Panther');
      await flush();
      assert.deepEqual(s.zeilen(), ['scs__empty scs__status scs__status--laedt']);
      assert.ok(s.list.children[0].text.includes(s.rd['data-loading']));
    });

    test('zweiter Teil kommt nicht an: kein blankes "kein Treffer", sondern Hinweis mit Knopf', async () => {
      const s = boot(lang, { more: ['tor', 'ok'] });
      s.win.__scsOpen();
      await flush();
      s.tippe('Panther');
      await flush();
      const z = s.list.children[0];
      assert.match(z.className, /scs__status--fehler/);
      assert.ok(z.text.includes(s.rd['data-failed-more']), `Hinweis auf fehlende Items fehlt: "${z.text}"`);
      assert.ok(z.find('scs__retry'), 'Knopf zum Neuversuch fehlt');
    });

    test('Tippen holt einen gescheiterten Teil von selbst neu, aber nicht je Buchstabe', async () => {
      const s = boot(lang, { more: ['tor', 'ok'] });
      s.win.__scsOpen();
      await flush();
      s.tippe('P');
      s.tippe('Pa');
      s.tippe('Pan');
      await flush();
      assert.equal(s.n.abrufe.filter((u) => /more/.test(u)).length, 1, 'innerhalb der Sperrfrist kein neuer Abruf');
      s.uhr.t += 3000;
      s.tippe('Panther');
      await flush();
      assert.equal(s.n.abrufe.filter((u) => /more/.test(u)).length, 2, 'nach der Sperrfrist genau ein neuer Abruf');
      assert.ok(s.zeilen().some((c) => c.includes('scs__hit--item')), `Items nach dem Neuversuch: ${s.zeilen()}`);
    });

    test('nichts gefunden bleibt "kein Treffer", wenn beide Teile da sind', async () => {
      const s = boot(lang, {});
      s.win.__scsOpen();
      await flush();
      s.tippe('zzqxw');
      await flush();
      // Dieser Fall war schon vorher richtig und bleibt es: eine Zeile, der
      // Leer-Titel, kein Knopf.
      assert.equal(s.list.children.length, 1);
      const z = s.list.children[0];
      assert.match(z.className, /scs__empty/);
      assert.ok(z.text.includes(s.rd['data-empty-title']));
      assert.equal(z.find('scs__retry'), null, 'bei echtem "kein Treffer" gibt es nichts zu wiederholen');
    });
  });
}
