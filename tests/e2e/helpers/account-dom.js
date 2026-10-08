// tests/e2e/helpers/account-dom.js — Browser-Attrappe für assets/account-lite.js.
//
// Muster wie fleet-dom.js: das ECHTE Skript läuft in node:vm, je Tab ein
// Kontext. Die Tabs teilen localStorage (ein Schreiben meldet `storage` an die
// jeweils ANDEREN Tabs, wie im Browser) und den Auth-Server. Jede
// Refresh-Anfrage bleibt angehalten, bis der Test sie beantwortet: mit einem
// Status, ohne Netz oder gar nicht. Das Profil heißt Nova, die Rolle ist
// admin, der Heartbeat (PATCH) bekommt 204. Jeder Tab trägt das Konto-Element
// aus SiteNav (nav()), zeigt die Admin-Klasse am Dokument (admin()) und führt
// Buch über seine Anfragen (requests).
//
// Zeit ist eine Attrappe (Date.now, setTimeout, setInterval): ein Zeitgeber
// läuft erst, wenn der Test die Uhr mit advance() vorstellt.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const CODE = fs.readFileSync(path.resolve('assets/account-lite.js'), 'utf8');
export const STORE = 'sb-trgjhmbnodoarnfmlcqx-auth-token';

const tick = () => new Promise((r) => setImmediate(r));
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function respond(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError('Unexpected end of JSON input')) : Promise.resolve(clone(body))),
  };
}

/**
 * makeAccountBrowser({ expiresIn }) — ein Browser, in dem user-1 angemeldet
 * ist; sein Token läuft in `expiresIn` Sekunden ab (negativ: schon abgelaufen).
 * refreshes: je Refresh-Anfrage { answer(status, body), offline() }.
 */
export function makeAccountBrowser({ expiresIn = -10 } = {}) {
  const clock = { now: Date.UTC(2026, 9, 8, 12, 0, 0), timers: [], seq: 0 };
  const data = new Map();
  const tabs = [];
  const refreshes = [];
  data.set(STORE, JSON.stringify({
    access_token: 'token-1', refresh_token: 'refresh-1', token_type: 'bearer',
    expires_at: Math.floor(clock.now / 1000) + expiresIn, user: { id: 'user-1' },
  }));

  class FakeDate extends Date {
    constructor(...args) { if (args.length) super(...args); else super(clock.now); }
    static now() { return clock.now; }
  }

  function authServer(url, init) {
    if (!url.includes('/auth/v1/token')) {
      if (init.method === 'PATCH') return Promise.resolve(respond(204));
      if (url.includes('/rest/v1/profiles?')) return Promise.resolve(respond(200, [{ display_name: 'Nova', handle: 'nova' }]));
      if (url.includes('/rest/v1/user_roles?')) return Promise.resolve(respond(200, [{ role: 'admin' }]));
      return Promise.resolve(respond(200, []));
    }
    const entry = { body: JSON.parse(init.body) };
    const p = new Promise((resolve, reject) => {
      entry.answer = (status, body) => resolve(respond(status, body));
      entry.offline = () => reject(new TypeError('Failed to fetch'));
    });
    refreshes.push(entry);
    return p;
  }

  /** Schreibt wie /account/ (supabase-js, dort läuft account-lite nicht): jeder account-lite-Tab hört storage. */
  const fromAccountPage = (value) => {
    const old = data.has(STORE) ? data.get(STORE) : null;
    if (value === null) data.delete(STORE);
    else data.set(STORE, value);
    for (const t of tabs) setImmediate(() => t.fire('storage', { key: STORE, oldValue: old, newValue: value }));
  };

  const browser = {
    clock,
    refreshes,
    storage: { get: (k) => (data.has(k) ? data.get(k) : null) },
    /** Antwort von GoTrue auf einen Refresh: neues Token, ohne expires_at. */
    fresh: (n) => ({ access_token: `token-${n}`, refresh_token: `refresh-${n}`, token_type: 'bearer', expires_in: 3600, user: { id: 'user-1' } }),
    /** Abmelden auf /account/: GoTrue löscht die Sitzung samt ihren Refresh-Tokens. */
    signOut: () => fromAccountPage(null),
    /** Neu anmelden auf /account/: eine neue Sitzung token-n/refresh-n. */
    signIn: (n) => fromAccountPage(JSON.stringify({ ...browser.fresh(n), expires_at: Math.floor(clock.now / 1000) + 3600 })),
    async drain() { for (let i = 0; i < 8; i++) await tick(); },
    async advance(ms) {
      const until = clock.now + ms;
      for (;;) {
        await browser.drain();
        const due = clock.timers.filter((t) => t.at <= until).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        clock.now = Math.max(clock.now, due.at);
        if (due.every) due.at += due.every;
        else clock.timers = clock.timers.filter((t) => t !== due);
        due.fn();
      }
      clock.now = until;
      await browser.drain();
    },
    open() {
      const tab = { events: [], requests: [] };
      tabs.push(tab);
      const listeners = {};
      const session = new Map();
      const classes = () => {
        const set = new Set();
        return { set, classList: { toggle: (c, on = !set.has(c)) => { if (on) set.add(c); else set.delete(c); return on; } } };
      };
      const root = classes();
      // Wie das Konto-Element in SiteNav.astro, Seite auf Englisch.
      const attrs = { 'data-login': '/account/login.html', 'data-dash': '/account.html', 'data-l-login': 'Sign in', 'data-l-acct': 'Account' };
      const label = { textContent: attrs['data-l-login'] };
      const acct = classes();
      const nav = {
        href: attrs['data-login'],
        title: '',
        classList: acct.classList,
        getAttribute: (name) => (name in attrs ? attrs[name] : null),
        querySelector: (sel) => (sel === '.js-nav-acct-txt' ? label : null),
      };
      const later = (every) => (fn, ms) => {
        const id = ++clock.seq;
        const wait = Math.max(0, Number(ms) || 0);
        clock.timers.push({ id, at: clock.now + wait, fn, every: every ? Math.max(1, wait) : 0 });
        return id;
      };
      const cancel = (id) => { clock.timers = clock.timers.filter((t) => t.id !== id); };
      const emitStorage = (key, oldValue, newValue) => {
        for (const other of tabs) if (other !== tab) setImmediate(() => other.fire('storage', { key, oldValue, newValue }));
      };
      const sandbox = {
        localStorage: {
          getItem: (k) => (data.has(k) ? data.get(k) : null),
          setItem: (k, v) => {
            const old = data.has(k) ? data.get(k) : null;
            data.set(k, String(v));
            if (old !== String(v)) emitStorage(k, old, String(v));
          },
          removeItem: (k) => {
            if (!data.has(k)) return;
            const old = data.get(k);
            data.delete(k);
            emitStorage(k, old, null);
          },
        },
        sessionStorage: {
          getItem: (k) => (session.has(k) ? session.get(k) : null),
          setItem: (k, v) => session.set(k, String(v)),
          removeItem: (k) => session.delete(k),
        },
        location: { pathname: '/schiffe/aegs-gladius.html', search: '' },
        document: {
          readyState: 'complete',
          visibilityState: 'visible',
          cookie: '',
          documentElement: { classList: root.classList },
          querySelectorAll: (sel) => (sel === '.js-nav-acct' ? [nav] : []),
          addEventListener() {},
        },
        fetch: (url, init) => {
          tab.requests.push({ method: init.method, url });
          return authServer(url, init);
        },
        Event: class Event { constructor(type) { this.type = type; } },
        Date: FakeDate,
        setTimeout: later(false),
        setInterval: later(true),
        clearTimeout: cancel,
        clearInterval: cancel,
        addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
        removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
        dispatchEvent: (ev) => {
          tab.events.push(ev.type);
          for (const fn of (listeners[ev.type] || []).slice()) fn(ev);
          return true;
        },
        console,
      };
      sandbox.window = sandbox;
      tab.fire = (type, init) => { for (const fn of (listeners[type] || []).slice()) fn({ type, ...init }); };
      vm.runInContext(CODE, vm.createContext(sandbox));
      tab.session = () => sandbox.VBAccount.session();
      tab.nav = () => ({ href: nav.href, text: label.textContent, authed: acct.set.has('is-authed') });
      tab.admin = () => root.set.has('is-admin');
      return tab;
    },
  };
  return browser;
}
