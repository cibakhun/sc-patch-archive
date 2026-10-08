// tests/e2e/helpers/crafting-dom.js — Browser-Attrappe für den Konto-Abgleich
// des Crafting-Planers (assets/crafting-app.js).
//
// Muster wie fleet-dom.js: das ECHTE Skript läuft in node:vm gegen ein
// Mini-DOM, ein vorgetäuschtes VBAccount und eine In-Memory-Tabelle
// crafting_entries. Die Seite trägt nur, was Karten und Abgleich brauchen:
// Karten im Markup aus src/components/CraftingApp.astro (★/＋ setzt das
// Skript selbst per innerHTML) und die Sync-Anzeige.
//
// VBAccount trennt wie account-lite die gespeicherte Sitzung (peek) von der
// nutzbaren (session). breakSession() lässt session() null liefern, während
// peek() die Sitzung noch hält: so sieht es ein Seitenskript, wenn der Refresh
// eines abgelaufenen Tokens an 5xx, 429 oder am Netz scheitert oder nicht
// binnen 15 s antwortet (tests/e2e/account-session.test.js). healSession()
// macht sie wieder nutzbar, ohne Ereignis: ein gescheiterter Refresh meldet
// sich nicht, erst ein späterer Versuch trägt wieder. landRefresh() macht sie
// nutzbar und meldet vb-account-session, wie account-lite nach einem
// gelungenen Refresh. holdSession(n) hält die nächsten n Sitzungsprüfungen an,
// bis releaseSession() sie beantwortet (ein hängender Refresh).
//
// Mehrere Tabs teilen localStorage, Sitzung und Server; ein Schreiben meldet
// `storage` an die jeweils ANDEREN Tabs, wie im Browser.
// server.hold(method, commit) hält die nächste Anfrage dieser Methode an, bis
// server.release() sie beantwortet: wie sonst auch, mit einem Status oder wie
// fetch ohne Netz ('offline'). commit 'after' (Vorgabe): die Anfrage kommt
// erst bei release() beim Server an, ein Status bleibt ohne Wirkung; 'before':
// der Server liest oder schreibt sofort, nur die Antwort kommt spät.
//
// Zeit ist eine Attrappe (Date.now, setTimeout, requestAnimationFrame):
// settle() spielt die Zeitgeber bis zum Horizont ab, Vorgabe 5 s.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const CODE = fs.readFileSync(path.resolve('assets/crafting-app.js'), 'utf8');
const DB_URL = '/assets/crafting-db.json?v=test';
const DISMANTLE_URL = '/assets/dismantling-items.json?v=test';

/** Die Karten der Seite, in DB-Reihenfolge. */
export const BLUEPRINTS = [
  { slug: 'karna-rifle', name: 'Karna Rifle', top: 'FPS Weapons', sub: 'Rifle' },
  { slug: 'p4-ar-rifle', name: 'P4-AR Rifle', top: 'FPS Weapons', sub: 'Rifle' },
];

// Die englische Seite (CraftingApp.astro, JS_T).
const STRINGS = {
  owned: 'Owned', addPlan: 'Add to planner',
  syncLocal: 'This device only', syncBusy: 'Syncing…', syncOn: 'Synced to your account', syncErr: 'Not saved',
  syncMerged: '{n} local entries moved into your account.',
};

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const tick = () => new Promise((r) => setImmediate(r));

// ---- Mini-DOM: nur, was crafting-app.js beim Laden und im Abgleich anfasst.
const VOID = new Set(['br', 'hr', 'img', 'input', 'link', 'meta']);
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const dataAttr = (k) => 'data-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

class Text {
  constructor(value) { this.nodeType = 3; this.nodeValue = String(value); this.parentNode = null; }
  get textContent() { return this.nodeValue; }
}

class El {
  constructor(tag, attrs = {}, kids = []) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = {};
    this.style = {};
    // Wie DOMStringMap: liest und schreibt die data-*-Attribute.
    this.dataset = new Proxy({}, {
      get: (_, k) => (typeof k === 'string' ? this.getAttribute(dataAttr(k)) ?? undefined : undefined),
      set: (_, k, v) => { this.setAttribute(dataAttr(k), v); return true; },
    });
    for (const k of kids) this.appendChild(typeof k === 'string' ? new Text(k) : k);
  }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get classList() {
    const list = () => this.className.split(/\s+/).filter(Boolean);
    const write = (l) => this.setAttribute('class', l.join(' '));
    return {
      contains: (c) => list().includes(c),
      add: (...cs) => write([...new Set([...list(), ...cs])]),
      remove: (...cs) => write(list().filter((c) => !cs.includes(c))),
      toggle: (c, force) => {
        const on = force === undefined ? !list().includes(c) : !!force;
        write(on ? [...new Set([...list(), c])] : list().filter((x) => x !== c));
        return on;
      },
    };
  }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get href() { return this.getAttribute('href') || ''; }
  set href(v) { this.setAttribute('href', v); }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(v) { this.childNodes = []; if (String(v)) this.appendChild(new Text(v)); }
  set innerHTML(html) { this.childNodes = []; for (const n of parseHTML(String(html))) this.appendChild(n); }
  getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n); }
  removeAttribute(n) { delete this.attrs[n]; }
  appendChild(c) {
    if (c.parentNode) c.parentNode.childNodes = c.parentNode.childNodes.filter((x) => x !== c);
    c.parentNode = this;
    this.childNodes.push(c);
    return c;
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
  emit(ev) { for (const fn of (this.listeners[ev.type] || []).slice()) fn.call(this, ev); }
  matches(sel) { return matchesSelector(this, sel); }
  closest(sel) {
    for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n.matches(sel)) return n;
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => n.children.forEach((c) => { if (c.matches(sel)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

// Selektoren: Typ, #id, .klasse, [attr], [attr="wert"], Nachfahre (Leerzeichen), Liste (Komma).
function parseCompound(s) {
  const c = { tag: null, id: null, classes: [], attrs: [] };
  for (const m of s.matchAll(/([#.]?)([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (m[3]) c.attrs.push([m[3], m[4] ?? null]);
    else if (m[1] === '#') c.id = m[2];
    else if (m[1] === '.') c.classes.push(m[2]);
    else c.tag = m[2].toUpperCase();
  }
  return c;
}
function matchCompound(n, c) {
  if (!n || n.nodeType !== 1) return false;
  if (c.tag && n.tagName !== c.tag) return false;
  if (c.id && n.getAttribute('id') !== c.id) return false;
  const own = n.className.split(/\s+/);
  if (!c.classes.every((k) => own.includes(k))) return false;
  return c.attrs.every(([a, v]) => (v === null ? n.hasAttribute(a) : n.getAttribute(a) === v));
}
function matchesSelector(el, sel) {
  return sel.split(',').some((group) => {
    const chain = group.trim().match(/(?:[^\s[]+|\[[^\]]*\])+/g).map(parseCompound);
    if (!matchCompound(el, chain[chain.length - 1])) return false;
    let i = chain.length - 2;
    for (let n = el.parentNode; n && i >= 0; n = n.parentNode) if (matchCompound(n, chain[i])) i--;
    return i < 0;
  });
}
function parseHTML(html) {
  const root = new El('template');
  const stack = [root];
  for (const m of html.matchAll(/<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g)) {
    const top = stack[stack.length - 1];
    if (m[1]) {
      while (stack.length > 1 && stack.pop().tagName !== m[1].toUpperCase());
    } else if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = decode(a[2] ?? '');
      const el = top.appendChild(new El(m[2], attrs));
      if (!m[4] && !VOID.has(m[2].toLowerCase())) stack.push(el);
    } else {
      top.appendChild(new Text(decode(m[5])));
    }
  }
  return root.childNodes.slice();
}

// Karte wie im SSR von CraftingApp.astro: data-i + data-time, Rest sichtbar.
function card(bp, i) {
  return new El('article', { class: 'cbp', 'data-i': String(i), 'data-time': '90' }, [
    new El('div', { class: 'cbp__top' }, [new El('span', { class: 'cbp__cat' }, [bp.top, new El('em', {}, [bp.sub])])]),
    new El('h3', { class: 'cbp__name' }, [new El('a', { href: `/crafting/${bp.slug}.html` }, [bp.name])]),
    new El('div', { class: 'cbp__meta' }, [new El('span', { title: 'Craft time' }, ['⏱ 1m 30s']), new El('span', { title: 'Ingredients' }, ['◆ 0'])]),
  ]);
}

// ---- Server: crafting_entries mit RLS auf die eigenen Zeilen.
function respond(status, body) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(clone(body ?? null)) };
}
function parsePath(p) {
  const [table, qs = ''] = p.split('?');
  const q = {};
  for (const pair of qs.split('&').filter(Boolean)) {
    const i = pair.indexOf('=');
    q[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return { table, q };
}
function makeServer(rows) {
  const server = {
    rows: rows.map((r) => ({ user_id: r.user_id, slug: r.slug, owned: !!r.owned, plan_qty: r.plan_qty || 0 })),
    requests: [],
    holds: [],
    held: [],
    hold: (method, commit = 'after') => server.holds.push({ method, commit }),
    /** answer: Status oder 'offline' (siehe hold). Ein geschlossener Tab erfährt nichts mehr. */
    release: (answer) => server.held.splice(0).forEach((go) => go(answer)),
    /** Nur die älteste angehaltene Anfrage beantworten. */
    releaseOne: (answer) => { const go = server.held.shift(); if (go) go(answer); },
    apply(sess, method, reqPath, body, prefer) {
      const user = sess && sess.user && sess.user.id;
      if (!user) return respond(401, { message: 'JWT expired' });
      const { table, q } = parsePath(reqPath);
      if (table !== 'crafting_entries') return respond(404, null);
      const mine = (r) => r.user_id === user;
      if (method === 'GET') {
        const cols = q.select.split(',');
        return respond(200, server.rows.filter(mine).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))));
      }
      if (method === 'POST') {
        if (q.on_conflict !== 'user_id,slug') return respond(400, null);
        if (!body.every(mine)) return respond(403, { code: '42501' });
        // Postgres: ON CONFLICT DO UPDATE trifft dieselbe Zeile nicht zweimal in einer Anweisung.
        if (new Set(body.map((r) => r.slug)).size !== body.length) return respond(500, { code: '21000' });
        const at = (r) => server.rows.findIndex((x) => x.user_id === r.user_id && x.slug === r.slug);
        // Ohne merge-duplicates ist eine vorhandene Zeile ein Konflikt, kein Upsert.
        if (!/resolution=merge-duplicates/.test(prefer || '') && body.some((r) => at(r) !== -1)) return respond(409, { code: '23505' });
        for (const r of body) {
          const row = { user_id: r.user_id, slug: r.slug, owned: r.owned, plan_qty: r.plan_qty };
          const i = at(r);
          if (i === -1) server.rows.push(row);
          else server.rows[i] = row;
        }
        return respond(201, null);
      }
      if (method === 'DELETE') {
        const owner = q.user_id.replace(/^eq\./, '');
        const slugs = q.slug.replace(/^in\.\(|\)$/g, '').split(',').map(decodeURIComponent);
        server.rows = server.rows.filter((r) => !(mine(r) && r.user_id === owner && slugs.includes(r.slug)));
        return respond(204, null);
      }
      return respond(405, null);
    },
    rest(tab, sess, method, reqPath, body, prefer) {
      server.requests.push({ method, path: reqPath, body: clone(body ?? null) });
      const sent = clone(body);
      const answer = () => server.apply(sess, method, reqPath, sent, prefer);
      const h = server.holds.findIndex((x) => x.method === method);
      if (h === -1) return Promise.resolve(answer());
      const early = server.holds.splice(h, 1)[0].commit === 'before' ? answer() : null;
      return new Promise((resolve, reject) => server.held.push((late) => {
        if (tab.closed) return;
        if (late === 'offline') reject(new TypeError('Failed to fetch'));
        else resolve(late ? respond(late, null) : early || answer());
      }));
    },
  };
  return server;
}

/**
 * makeBrowser(opts) — ein Browser mit gemeinsamem Speicher, Sitzung und Server.
 *   session     'user-1' = beim Öffnen angemeldet (sonst Gast)
 *   refreshing  true = das Token ist abgelaufen und der Refresh trägt noch
 *               nicht: session() liefert null, peek() hat die Sitzung
 *   rows        Server-Zeilen [{user_id, slug, owned, plan_qty}]
 *   seed        { schlüssel: rohwert } — Vorbestand im localStorage
 */
export function makeBrowser(opts = {}) {
  const clock = { now: Date.UTC(2026, 9, 8, 20, 0, 0), timers: [], seq: 0 };
  const data = new Map(Object.entries(opts.seed || {}));
  const tabs = [];
  const server = makeServer(opts.rows || []);
  const account = { session: null, stored: null, reject: false, holds: 0, held: [] };
  const sessionFor = (uid) => ({ access_token: `token-${uid}`, refresh_token: `refresh-${uid}`, user: { id: uid } });
  if (opts.session) account.session = account.stored = sessionFor(opts.session);
  if (opts.session && opts.refreshing) account.session = null;
  const db = {
    blueprints: BLUEPRINTS.map((bp) => ({ name: bp.name, category: `${bp.top} / ${bp.sub}`, craft_time_seconds: 90, ingredients: [], missions: [] })),
    dismantle_blacklist: [],
  };

  class FakeDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(clock.now); }
    static now() { return clock.now; }
  }

  const accountEvent = () => tabs.forEach((t) => setImmediate(() => t.fireWindow('vb-account-session')));

  const browser = {
    clock,
    server,
    /** Zeitpunkte aller session()-Aufrufe, über alle Tabs. */
    sessionCalls: [],
    storage: {
      get: (k) => (data.has(k) ? data.get(k) : null),
      keys: () => [...data.keys()].sort(),
    },
    /** Anmelden oder Abmelden in einem anderen Tab: account-lite meldet vb-account-session überall. */
    signIn(uid) { account.session = account.stored = sessionFor(uid); accountEvent(); },
    signOut() { account.session = account.stored = null; accountEvent(); },
    /** Sitzung liegt noch im Speicher, ist aber nicht nutzbar (Refresh scheitert oder hängt). */
    breakSession() { account.session = null; },
    healSession() { account.session = account.stored; },
    landRefresh() { account.session = account.stored; accountEvent(); },
    holdSession(n = Infinity) { account.holds = n; },
    /** Der Reihe nach: mit `value`, sonst mit der dann nutzbaren Sitzung. Ein geschlossener Tab erfährt nichts mehr. */
    releaseSession(value) {
      account.holds = 0;
      for (const h of account.held.splice(0)) {
        if (!h.tab.closed) h.resolve(clone(value === undefined ? account.session : value));
      }
    },
    /**
     * Der nächste Refresh wird abgelehnt (400/401/403): account-lite räumt die
     * Sitzung weg und meldet vb-account-session, bevor der Aufrufer null bekommt.
     */
    rejectRefresh() { account.reject = true; },
    async settle({ horizon = 5000, limit = 400 } = {}) {
      const until = clock.now + horizon;
      for (let n = 0; n < limit; n++) {
        await browser.drain();
        const due = clock.timers.filter((t) => t.at <= until).sort((a, b) => a.at - b.at || a.id - b.id);
        if (!due.length) return;
        clock.timers = clock.timers.filter((t) => t !== due[0]);
        if (due[0].at > clock.now) clock.now = due[0].at;
        due[0].fn();
      }
      throw new Error(`settle: nach ${limit} Schritten noch nicht zur Ruhe gekommen`);
    },
    /** Nur Mikroaufgaben und Ereignisse abarbeiten, keine Zeitgeber. */
    async drain() { for (let i = 0; i < 8; i++) await tick(); },
    advance(ms) { clock.now += ms; },
    open() {
      const tab = { closed: false, lagged: null };
      tabs.push(tab);

      const grid = new El('div', { class: 'cdb-grid', id: 'cdb-grid' }, BLUEPRINTS.map(card));
      const sync = new El('div', { class: 'cdb-sync', 'data-state': 'local' }, [
        new El('span', { class: 'cdb-sync__dot', 'aria-hidden': 'true' }),
        new El('span', { class: 'cdb-sync__txt' }, [STRINGS.syncLocal]),
        new El('a', { class: 'cdb-sync__login', href: '/account/login.html' }, ['Sign in']),
        new El('button', { type: 'button', class: 'cdb-sync__retry', hidden: '' }, ['Retry']),
      ]);
      const html = new El('html');
      const body = html.appendChild(new El('body', {}, [
        sync,
        new El('b', { id: 'cdb-count' }, [String(BLUEPRINTS.length)]),
        grid,
        new El('p', { class: 'cdb-empty', id: 'cdb-empty', hidden: '' }),
        new El('button', { type: 'button', id: 'cdb-plan-clear' }, ['Clear']),
      ]));

      const winL = {};
      const docL = {};
      const add = (map) => (type, fn, o) => { (map[type] ||= []).push({ fn, once: !!(o && o.once) }); };
      const remove = (map) => (type, fn) => { map[type] = (map[type] || []).filter((l) => l.fn !== fn); };
      const fire = (map, type, ev) => {
        for (const l of (map[type] || []).slice()) {
          if (l.once) remove(map)(type, l.fn);
          l.fn(ev);
        }
      };
      const later = (fn, ms) => {
        const id = ++clock.seq;
        clock.timers.push({ id, at: clock.now + Math.max(0, Number(ms) || 0), fn, tab });
        return id;
      };
      const document = {
        readyState: 'interactive',
        visibilityState: 'visible',
        documentElement: html,
        body,
        querySelectorAll: (s) => html.querySelectorAll(s),
        querySelector: (s) => html.querySelector(s),
        createElement: (tag) => new El(tag),
        addEventListener: add(docL),
        removeEventListener: remove(docL),
      };
      const others = (key, oldValue, newValue) => tabs.forEach((t) => {
        if (t !== tab) setImmediate(() => t.fireWindow('storage', { key, oldValue, newValue }));
      });
      const sandbox = {
        document,
        localStorage: {
          getItem: (k) => (data.has(k) ? data.get(k) : null),
          setItem: (k, v) => {
            const old = data.has(k) ? data.get(k) : null;
            data.set(k, String(v));
            if (old !== String(v)) others(k, old, String(v));
          },
          removeItem: (k) => {
            if (!data.has(k)) return;
            const old = data.get(k);
            data.delete(k);
            others(k, old, null);
          },
          key: (i) => [...data.keys()][i] ?? null,
          get length() { return data.size; },
        },
        location: { pathname: '/topics/crafting.html', search: '' },
        URLSearchParams,
        __CRAFT: {
          lang: 'en', dbUrl: DB_URL, dismantleUrl: DISMANTLE_URL, dismantleEfficiency: 0.5,
          icons: {}, mine: { url: '/mining.html', names: {} }, t: STRINGS,
        },
        fetch: (url) => {
          const body = url === DB_URL ? db : url === DISMANTLE_URL ? [] : undefined;
          if (body === undefined) return Promise.reject(new TypeError('Failed to fetch'));
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(clone(body)) });
        },
        VBAccount: {
          peek: () => clone(account.stored),
          session: () => {
            browser.sessionCalls.push(clock.now);
            if (account.holds > 0) {
              account.holds--;
              return new Promise((resolve) => account.held.push({ tab, resolve }));
            }
            if (!account.reject) return Promise.resolve(clone(account.session));
            account.reject = false;
            account.session = account.stored = null;
            return Promise.resolve().then(() => { tab.fireWindow('vb-account-session'); return null; });
          },
          rest: (sess, method, p, b, prefer) => server.rest(tab, sess, method, p, b, prefer),
          loginHref: () => '/account/login.html?next=%2Ftopics%2Fcrafting.html',
          isDE: false,
        },
        Event: class Event { constructor(type) { this.type = type; } },
        Date: FakeDate,
        setTimeout: later,
        clearTimeout: (id) => { clock.timers = clock.timers.filter((t) => t.id !== id); },
        requestAnimationFrame: (fn) => later(fn, 16),
        addEventListener: add(winL),
        removeEventListener: remove(winL),
        dispatchEvent: (ev) => { fire(winL, ev.type, ev); return true; },
        console,
      };
      sandbox.window = sandbox;

      const cardOf = (slug) => grid.querySelector(`.cbp a[href="/crafting/${slug}.html"]`).closest('.cbp');
      // Klick wie im Browser: vom Knopf bis zum Dokument, der Handler hängt am Raster.
      const press = (target) => {
        const path = [];
        for (let n = target; n && n.nodeType === 1; n = n.parentNode) path.push(n);
        let stopped = false;
        const ev = {
          type: 'click', target, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
          preventDefault() {}, stopPropagation() { stopped = true; }, composedPath: () => path.slice(),
        };
        for (const n of path) { n.emit(ev); if (stopped) return; }
        fire(docL, 'click', ev);
      };
      Object.assign(tab, {
        /** Der ★ einer Karte (setzt das Skript selbst). */
        ownButton: (slug) => cardOf(slug).querySelector('.cbp__own'),
        clickOwn: (slug) => press(tab.ownButton(slug)),
        /** Das ＋ einer Karte: eins mehr im Planer, die Klasse in-plan zeigt es an. */
        addButton: (slug) => cardOf(slug).querySelector('.cbp__add'),
        clickAdd: (slug) => press(tab.addButton(slug)),
        /** „Planer leeren". */
        clickClear: () => press(body.querySelector('#cdb-plan-clear')),
        /** „Erneut versuchen" der Sync-Anzeige. */
        clickRetry: () => press(sync.querySelector('.cdb-sync__retry')),
        /** Was die Sync-Anzeige zeigt. */
        sync: () => ({
          state: sync.getAttribute('data-state'),
          text: sync.querySelector('.cdb-sync__txt').textContent,
          login: !sync.querySelector('.cdb-sync__login').hidden,
          retry: !sync.querySelector('.cdb-sync__retry').hidden,
        }),
        show() { document.visibilityState = 'visible'; fire(docL, 'visibilitychange', { type: 'visibilitychange' }); },
        hide() { document.visibilityState = 'hidden'; fire(docL, 'visibilitychange', { type: 'visibilitychange' }); },
        fireWindow(type, init = {}) {
          if (tab.closed) return;
          if (tab.lagged) tab.lagged.push([type, init]);
          else fire(winL, type, { type, ...init });
        },
        /** Ereignisse kommen verspätet an: der Tab bleibt bedienbar, weiss aber noch nichts. */
        lag() { tab.lagged = []; },
        unlag() {
          const queued = tab.lagged || [];
          tab.lagged = null;
          queued.forEach(([type, init]) => fire(winL, type, { type, ...init }));
        },
        /** Schliessen: seine Zeitgeber laufen nicht weiter. */
        close() {
          tab.closed = true;
          clock.timers = clock.timers.filter((t) => t.tab !== tab);
        },
      });

      vm.runInContext(CODE, vm.createContext(sandbox));
      return tab;
    },
  };
  return browser;
}
