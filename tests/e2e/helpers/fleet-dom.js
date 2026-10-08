// tests/e2e/helpers/fleet-dom.js — Browser-Attrappe für assets/fleet.js.
//
// Muster wie mining-dom.js: das ECHTE Skript läuft in node:vm gegen eine
// Attrappe mit vorgetäuschtem VBAccount und einer In-Memory-Tabelle. Die
// Flotte braucht darüber hinaus MEHRERE Tabs desselben Browsers: sie teilen
// localStorage (ein Schreiben meldet `storage` an die jeweils ANDEREN Tabs,
// wie im Browser), die Sitzung, die Web Locks und den Server. Ein Tab lässt
// sich schliessen (Absturz: seine Zeitgeber, Sperren und offenen Antworten
// sterben mit) und ein neuer öffnen (Neuladen).
//
// Der Server bildet genau das Verhalten nach, auf das sich die Flotte
// verlässt: RLS auf die eigenen Zeilen, POST 201 bzw. 409 bei vorhandener
// Zeile (nur mit `unique`), DELETE per Filter mit 204 auch ohne Treffer, GET
// mit select und Reihenfolge der Anlage. Steuerbar: erzwungene Status, offline,
// angehaltene Anfragen (Schreiben vor oder nach dem Anhalten), verlorene
// Antworten und Antwortkörper, die nie ankommen.
//
// Zeit ist eine Attrappe (Date.now und setTimeout): settle() spielt die
// Zeitgeber der nächsten fünf Sekunden ab (die Sammelpause vor dem Senden),
// nicht die Zeitüberschreitung einer Anfrage nach 20 s — die läuft erst, wenn
// ein Test die Uhr mit advance() vorstellt. Angehaltene Anfragen bleiben
// angehalten, bis der Test sie freigibt.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const CODE = fs.readFileSync(path.resolve('assets/fleet.js'), 'utf8');

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const tick = () => new Promise((r) => setImmediate(r));

// Mini-DOM: nur, was fleet.js anfasst.
class El {
  constructor(tag, attrs = {}, text = '') {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.children = [];
    this.parentNode = null;
    this.hidden = Object.prototype.hasOwnProperty.call(attrs, 'hidden');
    this._text = text;
  }
  getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n); }
  removeAttribute(n) { delete this.attrs[n]; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  matches(sel) {
    let m;
    if ((m = /^\[([\w-]+)\]$/.exec(sel))) return this.hasAttribute(m[1]);
    if ((m = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel))) return this.getAttribute(m[1]) === m[2];
    if ((m = /^\.([\w-]+)$/.exec(sel))) return (this.getAttribute('class') || '').split(/\s+/).includes(m[1]);
    return this.tagName === sel.toUpperCase();
  }
  closest(sel) {
    for (let n = this; n; n = n.parentNode) if (n.matches(sel)) return n;
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

// Web Locks: eine Warteschlange je Name, über alle Tabs.
function makeLocks() {
  const queues = new Map();
  const held = new Map();
  function pump(name) {
    if (held.has(name)) return;
    const next = (queues.get(name) || []).shift();
    if (!next) return;
    held.set(name, next);
    Promise.resolve()
      .then(() => next.cb({ name, mode: 'exclusive' }))
      .then((v) => { release(name, next); next.resolve(v); }, (e) => { release(name, next); next.reject(e); });
  }
  function release(name, entry) {
    if (held.get(name) !== entry) return;
    held.delete(name);
    pump(name);
  }
  return {
    forTab: (tab) => ({
      request: (name, cb) => new Promise((resolve, reject) => {
        if (!queues.has(name)) queues.set(name, []);
        queues.get(name).push({ tab, cb, resolve, reject });
        pump(name);
      }),
    }),
    // Ein abgestürzter Tab gibt seine Sperren frei, wie im Browser.
    closeTab(tab) {
      for (const [name, entry] of [...held]) if (entry.tab === tab) { held.delete(name); pump(name); }
      for (const [name, q] of queues) queues.set(name, q.filter((e) => e.tab !== tab));
    },
  };
}

// Server: favorites mit RLS.
function respond(status, body) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(clone(body ?? null)) };
}
function parsePath(p) {
  const [table, qs = ''] = p.split('?');
  const q = {};
  for (const pair of qs.split('&').filter(Boolean)) {
    const i = pair.indexOf('=');
    q[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
  }
  return { table, q };
}
function makeServer({ rows = [], unique = true, owner }) {
  const server = {
    rows: [],
    unique,
    requests: [],
    forced: [],
    holds: [],
    held: [],
    nextId: 1,
    /** Slugs der Zeilen eines Kontos in Anlage-Reihenfolge. */
    slugs: (user = owner) => server.rows.filter((r) => r.user_id === user).map((r) => r.slug),
    /** Zeile von einem anderen Gerät desselben Kontos. */
    insert: (slug, label, user = owner) => server.rows.push({ id: server.nextId++, user_id: user, kind: 'ship', slug, label }),
    /** Nächste Anfrage dieser Methode bekommt `status` (ohne Wirkung). */
    fail: (method, status) => server.forced.push({ method, status }),
    /** Nächste Anfrage dieser Methode scheitert wie fetch ohne Netz. */
    offline: (method) => server.forced.push({ method, offline: true }),
    /** Nächste Anfrage dieser Methode bekommt 200, ihr Körper kommt aber nie an. */
    hangBody: (method) => server.forced.push({ method, hangBody: true }),
    /**
     * Hält die nächste Anfrage dieser Methode an. commit 'before': der Server
     * schreibt sofort, nur die Antwort wartet (späte Antwort). commit 'after':
     * die Anfrage kommt erst bei release() an.
     */
    hold: (method, commit = 'after') => server.holds.push({ method, commit }),
    release: () => server.held.splice(0).forEach((h) => h.go()),
    apply(sess, method, reqPath, body) {
      const user = sess && sess.user && sess.user.id;
      if (!user) return respond(401, { message: 'JWT expired' });
      const { table, q } = parsePath(reqPath);
      if (table !== 'favorites') return respond(404, null);
      const filters = Object.entries(q)
        .filter(([k, v]) => k !== 'select' && k !== 'order' && v.startsWith('eq.'))
        .map(([k, v]) => [k, v.slice(3)]);
      const match = (r) => r.user_id === user && filters.every(([k, v]) => String(r[k]) === v);
      if (method === 'GET') {
        const cols = (q.select || 'slug,label').split(',');
        return respond(200, server.rows.filter(match).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))));
      }
      if (method === 'POST') {
        const dup = server.rows.some((r) => r.user_id === user && r.kind === body.kind && r.slug === body.slug);
        if (server.unique && dup) return respond(409, { code: '23505' });
        server.rows.push({ id: server.nextId++, user_id: user, kind: body.kind, slug: body.slug, label: body.label });
        return respond(201, null);
      }
      if (method === 'DELETE') {
        server.rows = server.rows.filter((r) => !match(r));
        return respond(204, null);
      }
      return respond(405, null);
    },
    rest(tab, sess, method, reqPath, body) {
      server.requests.push({ method, path: reqPath, body: clone(body ?? null) });
      const f = server.forced.findIndex((x) => x.method === method);
      if (f !== -1) {
        const forced = server.forced.splice(f, 1)[0];
        if (forced.offline) return Promise.reject(new TypeError('Failed to fetch'));
        if (forced.hangBody) return Promise.resolve({ ok: true, status: 200, json: () => new Promise(() => {}) });
        return Promise.resolve(respond(forced.status, null));
      }
      const h = server.holds.findIndex((x) => x.method === method);
      if (h !== -1) {
        const { commit } = server.holds.splice(h, 1)[0];
        const early = commit === 'before' ? server.apply(sess, method, reqPath, body) : null;
        return new Promise((resolve) => {
          server.held.push({ go: () => { if (!tab.closed) resolve(early || server.apply(sess, method, reqPath, body)); } });
        });
      }
      return Promise.resolve(server.apply(sess, method, reqPath, body));
    },
  };
  for (const r of rows) {
    server.rows.push({ id: server.nextId++, user_id: r.user_id || owner, kind: r.kind || 'ship', slug: r.slug, label: r.label ?? r.slug });
  }
  return server;
}

/**
 * makeBrowser(opts) — ein Browser mit gemeinsamem Speicher, Sitzung und Server.
 *   session  'user-1' = beim Öffnen angemeldet (sonst Gast)
 *   guest    [{id,label}] als Gast-Flotte vorbelegt ('vb.fleet.v1')
 *   rows     Server-Zeilen [{slug,label,user_id?}] (user_id Vorgabe: session oder 'user-1')
 *   unique   false = die Tabelle hat keinen Eindeutigkeitsschlüssel (doppelte Zeilen möglich)
 *   locks    false = Browser ohne Web Locks
 *   seed     { schlüssel: rohwert } — beliebiger Vorbestand im localStorage
 *   storageBroken  true = jeder Zugriff auf localStorage wirft (gesperrte Cookies)
 *   refreshing     true = das Token von `session` ist abgelaufen, und account-lite
 *                  refresht es im selben Tab: session() liefert null, peek() hat
 *                  die Sitzung noch. landRefresh() lässt den Refresh landen.
 */
export function makeBrowser(opts = {}) {
  const owner = opts.session || 'user-1';
  const clock = { now: Date.UTC(2026, 9, 7, 20, 0, 0), timers: [], seq: 0 };
  const data = new Map();
  const tabs = [];
  const locks = makeLocks();
  const server = makeServer({ rows: opts.rows, unique: opts.unique !== false, owner });
  const account = { session: null, stored: null };
  const sessionFor = (uid, n = 1) => ({ access_token: `token-${uid}-${n}`, refresh_token: `refresh-${uid}-${n}`, user: { id: uid } });
  if (opts.session) account.session = account.stored = sessionFor(opts.session);
  if (opts.session && opts.refreshing) account.session = null;
  if (opts.guest) data.set('vb.fleet.v1', JSON.stringify({ ships: opts.guest }));
  for (const [k, v] of Object.entries(opts.seed || {})) data.set(k, v);

  class FakeDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(clock.now); }
    static now() { return clock.now; }
  }

  const accountEvent = () => tabs.forEach((t) => setImmediate(() => t.fireWindow('vb-account-session')));

  const browser = {
    clock,
    server,
    tabs,
    storage: {
      get: (k) => (data.has(k) ? data.get(k) : null),
      keys: () => [...data.keys()].sort(),
    },
    /** Anmelden in einem anderen Tab: account-lite meldet vb-account-session überall. */
    signIn(uid) { account.session = account.stored = sessionFor(uid); accountEvent(); },
    signOut() { account.session = account.stored = null; accountEvent(); },
    /** Sitzung liegt noch im Speicher, ist aber nicht nutzbar (offline, abgelaufen). */
    breakSession() { account.session = null; },
    healSession() { account.session = account.stored; },
    /**
     * Der Refresh aus `refreshing` landet im selben Tab: ein neues Token im
     * Speicher, aber kein Ereignis. storage meldet der Browser nur anderen Tabs.
     */
    landRefresh() { account.session = account.stored = sessionFor(account.stored.user.id, 2); },
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
    open(page = {}) {
      const tab = { closed: false, snaps: [] };
      tabs.push(tab);

      const storageView = {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => {
          const old = data.has(k) ? data.get(k) : null;
          v = String(v);
          data.set(k, v);
          if (old !== v) emitStorage(k, old, v);
        },
        removeItem: (k) => {
          if (!data.has(k)) return;
          const old = data.get(k);
          data.delete(k);
          emitStorage(k, old, null);
        },
        key: (i) => [...data.keys()][i] ?? null,
        get length() { return data.size; },
        clear: () => { data.clear(); emitStorage(null, null, null); },
      };
      if (opts.storageBroken) {
        const denied = () => { throw new Error('SecurityError: The operation is insecure.'); };
        for (const m of ['getItem', 'setItem', 'removeItem', 'key', 'clear']) storageView[m] = denied;
        Object.defineProperty(storageView, 'length', { get: denied });
      }
      function emitStorage(key, oldValue, newValue) {
        for (const other of tabs) {
          if (other !== tab && !other.closed) setImmediate(() => other.fireWindow('storage', { key, oldValue, newValue }));
        }
      }

      const html = new El('html');
      const body = html.appendChild(new El('body'));
      for (const b of page.buttons || []) {
        const btn = body.appendChild(new El('button', {
          type: 'button',
          'data-fleet-ship': b.ship,
          'data-fleet-label': b.label,
          ...(b.on ? { 'data-fleet-on': b.on } : {}),
          ...(b.off ? { 'data-fleet-off': b.off } : {}),
          'aria-pressed': 'false',
        }));
        btn.appendChild(new El('svg', { 'aria-hidden': 'true' }));
        btn.appendChild(new El('span', { class: 'js-fleet-txt' }, b.off || ''));
      }
      if (page.retry) {
        body.appendChild(new El('button', {
          type: 'button', 'data-fleet-retry': '', hidden: '',
          'data-fleet-unsaved': 'Not saved · try again', 'data-fleet-unsynced': 'Not synced · try again',
        }, 'Not saved · try again'));
      }

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
      const document = {
        readyState: 'interactive',
        visibilityState: 'visible',
        documentElement: html,
        body,
        querySelectorAll: (s) => html.querySelectorAll(s),
        querySelector: (s) => html.querySelector(s),
        addEventListener: add(docL),
        removeEventListener: remove(docL),
      };
      const sandbox = {
        document,
        localStorage: storageView,
        navigator: opts.locks === false ? {} : { locks: locks.forTab(tab) },
        VBAccount: {
          peek: () => clone(account.stored),
          session: () => Promise.resolve(clone(account.session)),
          rest: (sess, method, p, b) => server.rest(tab, sess, method, p, b),
          loginHref: () => '/account/login.html?next=%2F',
          isDE: false,
        },
        Event: class Event { constructor(type) { this.type = type; } },
        Date: FakeDate,
        setTimeout: (cb, ms) => {
          const id = ++clock.seq;
          clock.timers.push({ id, at: clock.now + Math.max(0, Number(ms) || 0), fn: cb, tab });
          return id;
        },
        clearTimeout: (id) => { clock.timers = clock.timers.filter((t) => t.id !== id); },
        addEventListener: add(winL),
        removeEventListener: remove(winL),
        dispatchEvent: (ev) => { fire(winL, ev.type, ev); return true; },
        console,
      };
      sandbox.window = sandbox;

      Object.assign(tab, {
        sandbox,
        document,
        ids: () => clone(sandbox.VBFleet.ids()),
        snapshot: () => clone(tab.snaps[tab.snaps.length - 1]),
        button: (i = 0) => body.querySelectorAll('[data-fleet-ship]')[i],
        retryButton: () => body.querySelector('[data-fleet-retry]'),
        /** Klick wie im Browser: Ziel ist das innere Bildzeichen, der Handler hängt am document. */
        click(el) {
          if (tab.closed) return;
          const target = el.children[0] || el;
          fire(docL, 'click', { type: 'click', target, preventDefault() {}, stopPropagation() {} });
        },
        show() { document.visibilityState = 'visible'; fire(docL, 'visibilitychange', { type: 'visibilitychange' }); },
        hide() { document.visibilityState = 'hidden'; fire(docL, 'visibilitychange', { type: 'visibilitychange' }); },
        fireWindow(type, init = {}) {
          if (tab.closed || tab.frozen) return;
          if (tab.lagging) { tab.lagged.push([type, init]); return; }
          fire(winL, type, { type, ...init });
        },
        /** Ereignisse kommen verspätet an: der Tab bleibt bedienbar, weiss aber noch nichts. */
        lag() { tab.lagging = true; tab.lagged = []; },
        unlag() {
          tab.lagging = false;
          tab.lagged.splice(0).forEach(([type, init]) => fire(winL, type, { type, ...init }));
        },
        /** bfcache: eingefroren kommt kein Ereignis an; beim Zurückkehren nur pageshow mit persisted. */
        freeze() { tab.frozen = true; document.visibilityState = 'hidden'; },
        thaw() {
          tab.frozen = false;
          document.visibilityState = 'visible';
          fire(winL, 'pageshow', { type: 'pageshow', persisted: true });
        },
        /** Der Refresh dieses Tabs hängt: session() kehrt nie zurück. */
        hangSession() { sandbox.VBAccount.session = () => new Promise(() => {}); },
        /** Absturz oder Schliessen: nichts aus diesem Tab läuft danach noch weiter. */
        close() {
          tab.closed = true;
          clock.timers = clock.timers.filter((t) => t.tab !== tab);
          locks.closeTab(tab);
        },
      });

      vm.runInContext(CODE, vm.createContext(sandbox));
      tab.fleet = sandbox.VBFleet;
      tab.fleet.subscribe((s) => tab.snaps.push(clone(s)));
      return tab;
    },
  };
  return browser;
}
