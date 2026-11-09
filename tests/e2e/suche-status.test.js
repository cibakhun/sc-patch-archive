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
    this.style = { setProperty() {} };
    this.offsetHeight = 70;
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
  removeAttribute(k) { delete this.attrs[k]; }
  getBoundingClientRect() { return { top: 300, bottom: 370, left: 0, right: 720, width: 720, height: 70 }; }
  contains(x) { return x === this || this.children.some((c) => c.contains && c.contains(x)); }
  appendChild(c) { this.children.push(c); return c; }
  set innerHTML(v) { if (v === '') this.children = []; else throw new Error('innerHTML nur zum Leeren'); }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  fire(t, ev = {}) { for (const fn of this.listeners[t] || []) fn({ preventDefault() {}, target: this, ...ev }); }
  focus() {}
  select() {}
  querySelectorAll(sel) {
    if (sel === 'li[role="option"]') return this.children.filter((c) => c.attrs.role === 'option');
    if (sel === '[data-scs-close]' || sel === '[data-hs-close]') return [];
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

function boot(lang, plan, { feld = false } = {}) {
  const root = new El('div');
  root.hidden = true;
  for (const [k, v] of Object.entries(searchRootData(lang))) root.setAttribute(k, v);
  const input = new El('input');
  const list = new El('ul');
  const byId = { scs: root, 'scs-in': input, 'scs-list': list };
  // Das Feld der Startseite (src/components/HomeSearch.astro): dieselben ids
  // wie dort. Ohne `feld` gibt es es nicht — wie auf jeder anderen Seite.
  if (feld) {
    byId.hs = new El('div');
    byId['hs-in'] = new El('input');
    byId['hs-list'] = new El('ul');
    byId['hs-field'] = new El('div');
  }
  const doc = new El('#document');
  doc.getElementById = (id) => byId[id] || null;
  doc.createElement = (t) => new El(t);
  doc.createElementNS = (_ns, t) => new El(t);
  doc.createTextNode = (t) => { const n = new El('#text'); n.textContent = String(t); return n; };
  doc.documentElement = new El('html');
  doc.readyState = 'complete';
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
    innerHeight: 800,
    scrollY: 0,
    scrollTo() {},
    addEventListener() {},
  };
  win.window = win;
  vm.runInContext(CODE, vm.createContext(win));
  assert.equal(typeof win.__scsOpen, 'function', 'das Skript hat sich nicht angemeldet');
  const tippe = (s) => { input.value = s; input.fire('input'); };
  const zeilen = () => list.children.map((c) => c.className);
  // Nur die waehlbaren Zeilen (Treffer, "+ N weitere"), ohne Kopf, Gruppen-
  // ueberschriften und Statuszeilen.
  const optionen = (l = list) => l.children.filter((c) => c.attrs.role === 'option');
  const feldTippe = (s) => { byId['hs-in'].value = s; byId['hs-in'].fire('input'); };
  return { win, root, input, list, n, uhr, tippe, zeilen, optionen, feldTippe, feld: byId['hs-list'], rd: searchRootData(lang) };
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
      assert.ok(s.optionen()[0].className.includes('scs__hit--schiff'), `Schiff zuerst: ${z}`);
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

/* ---------- Ein Suchkern, zwei Oberflaechen (09.11.2026, Skizze 016) ----------
   Das grosse Feld der Startseite sucht selbst; der Dialog (Strg+K) bleibt auf
   allen anderen Seiten. Beide muessen fuer dieselbe Eingabe dieselben Zeilen
   in derselben Reihenfolge zeigen — sonst gaebe es doch wieder zwei Suchen. */
const VIEL = [
  ...['Mining', 'Fracturing'].map((t) => ({ k: 'werkzeug', b: '', t, s: 'Werkzeug', u: `/${t.toLowerCase()}.html`, x: 'mining bergbau' })),
  ...Array.from({ length: 5 }, (_, i) => ({ k: 'mission', b: 'Search', t: `Mining Job ${i + 1}`, s: '', u: `/missionen/m${i}.html`, x: '' })),
  { k: 'schiff', b: 'Drake', t: 'Golem', s: 'Drake · Mining', u: '/schiffe/golem.html', x: 'mining' },
];
const VIEL_MORE = [
  ...Array.from({ length: 6 }, (_, i) => ({ k: 'item', b: 'Mining Laser', t: `Mining Laser ${i + 1}`, s: 'Shubin', u: `/items/ml${i}.html`, x: '', ...(i % 2 ? {} : { c: `/topics/crafting.html?bp=ML${i}&bpi=${i}` }) })),
  { k: 'bauplan', b: 'Mining', t: 'Mining Gadget', s: 'Vehiclegear', u: '/crafting/mg.html', x: '', c: '/topics/crafting.html?bp=MG&bpi=9' },
];
function bootViel(lang) {
  ERSTER.splice(0, ERSTER.length, ...VIEL);
  ITEMS.splice(0, ITEMS.length, ...VIEL_MORE);
  return boot(lang, {}, { feld: true });
}
const ERSTER_ALT = ERSTER.slice();
const ITEMS_ALT = ITEMS.slice();
function zurueck() {
  ERSTER.splice(0, ERSTER.length, ...ERSTER_ALT);
  ITEMS.splice(0, ITEMS.length, ...ITEMS_ALT);
}
const bild = (l) => l.children.map((c) => `${c.attrs.role === 'option' ? 'o' : '-'} ${c.className.replace(/\s*\bsel\b/, '')} | ${c.text}`);

for (const lang of ['de', 'en']) {
  describe(`Ein Suchkern fuer Dialog und Startseiten-Feld (${lang})`, () => {
    test('dieselbe Eingabe ergibt in Feld und Dialog dieselbe Liste', async () => {
      const s = bootViel(lang);
      try {
        s.win.__scsOpen();
        await flush();
        s.tippe('mining');
        s.feldTippe('mining');
        await flush();
        const dialog = bild(s.list).filter((z) => !z.includes('scs__head'));
        const feld = bild(s.feld).filter((z) => !z.includes('scs__head'));
        assert.ok(dialog.length > 5, `zu wenige Zeilen im Dialog: ${dialog.join(' / ')}`);
        assert.deepEqual(feld, dialog);
      } finally { zurueck(); }
    });

    test('Gruppen in der Reihenfolge ihres besten Treffers, je drei Zeilen und "+ N weitere"', async () => {
      const s = bootViel(lang);
      try {
        s.win.__scsOpen();
        await flush();
        s.tippe('mining');
        await flush();
        const gruppen = s.list.children.filter((c) => c.className.includes('scs__grp')).map((c) => c.className.split('--')[1]);
        // Werkzeuge (+20) zuerst, dann Missionen (Titel beginnt mit "Mining"),
        // die Items, das Schiff (nur ueber x), der Bauplan.
        assert.deepEqual(gruppen, ['tools', 'missions', 'items', 'recipes', 'ships']);
        const mehr = s.list.children.filter((c) => c.className.includes('scs__more'));
        assert.equal(mehr.length, 2, 'Missionen (5) und Items (6) brauchen je "+ N weitere"');
        assert.ok(mehr[0].text.includes('2') && mehr[0].text.includes(s.rd['data-g-missions']), `Text: ${mehr[0].text}`);
        // Der Klick klappt auf, und die erste neue Zeile ist gewaehlt.
        mehr[0].fire('click');
        const ops = s.optionen();
        const gewaehlt = ops.find((c) => c.className.includes('sel'));
        assert.ok(gewaehlt && /\bJob 4\b/.test(gewaehlt.text), `gewaehlt: ${gewaehlt && gewaehlt.text}`);
        assert.equal(s.list.children.filter((c) => c.className.includes('scs__more')).length, 1);
      } finally { zurueck(); }
    });

    test('Item mit Rezept: ein Treffer mit "Herstellen", Pfeil rechts fuehrt ins Werkzeug', async () => {
      const s = bootViel(lang);
      try {
        s.win.__scsOpen();
        await flush();
        s.tippe('mining laser 1');
        await flush();
        const z = s.optionen()[0];
        assert.ok(z.className.includes('scs__hit--item'), z.className);
        const knopf = z.find('scs__craft');
        assert.ok(knopf, 'Item mit c braucht den Knopf "Herstellen"');
        assert.ok(knopf.text.includes(s.rd['data-craft']), knopf.text);
        // Pfeil rechts am Ende der Eingabe = Herstellen.
        const ev = { key: 'ArrowRight', preventDefault() {}, target: s.input };
        s.input.selectionStart = s.input.selectionEnd = s.input.value.length;
        for (const fn of s.win.document.listeners.keydown || []) fn(ev);
        assert.equal(s.win.location.href, '/topics/crafting.html?bp=ML0&bpi=0');
        // Ohne c kein Knopf.
        s.tippe('mining laser 2');
        await flush();
        assert.equal(s.optionen()[0].find('scs__craft'), null);
      } finally { zurueck(); }
    });

    test('leeres Feld: Werkzeuge als Kacheln, nichts vorgewaehlt', async () => {
      const s = bootViel(lang);
      try {
        s.win.__scsOpen();
        await flush();
        const ops = s.optionen();
        assert.equal(ops.length, 2);
        assert.ok(ops.every((c) => c.className.includes('scs__chip')));
        assert.ok(!ops.some((c) => c.className.includes('sel')), 'Enter darf im leeren Feld nichts oeffnen');
        assert.ok(s.list.children.some((c) => c.className.includes('scs__hint')));
      } finally { zurueck(); }
    });
  });
}
