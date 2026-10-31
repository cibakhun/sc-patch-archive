// Anderes Discord-Konto, ohne das angemeldete abzumelden (31.10.2026,
// src/lib/discord-elsewhere.ts). Discord nimmt immer das Konto, das im
// Browser angemeldet ist; der Weg führt über ein privates Fenster, und die
// Anmeldung landet trotzdem im ersten Fenster.
//
// 1. Die Regeln: Rücklink (nur next, f, code), angenommen wird nur ein Link
//    auf dieselbe Seite desselben Ursprungs, Tasten je Browser.
// 2. Die Torseite (gate.astro, bundlerfrei) mit ZWEI Fenstern in node:vm,
//    jedes mit eigenem Speicher wie ein normales und ein privates Fenster:
//    erstes Fenster beginnt, privates zeigt den Rücklink ohne etwas
//    einzulösen, Einfügen im ersten öffnet ihn, dort löst der Verifier ein.
// 3. Verdrahtung auf Anmelde- und Kontoseite. Auf der Kontoseite gibt es
//    bewusst KEINEN kopierbaren Verbindungslink (der hinge irgendein
//    Discord-Konto an dieses Konto).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as nodeModule from 'node:module';
import { webcrypto, createHash } from 'node:crypto';

async function loadTs(rel) {
  const src = fs.readFileSync(path.resolve(rel), 'utf8');
  let js;
  if (typeof nodeModule.stripTypeScriptTypes === 'function') js = nodeModule.stripTypeScriptTypes(src);
  else js = (await import('esbuild')).transformSync(src, { loader: 'ts', format: 'esm' }).code;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const L = await loadTs('src/lib/discord-elsewhere.ts');
const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');

const ORIGIN = 'https://verse-base.com';
const CODE = '3f1c2a9e-7b4d-4e8a-9c21-5d6e7f8a9b0c';

describe('Regeln (discord-elsewhere.ts)', () => {
  test('Rücklink: dieselbe Seite, nur next, f und code', () => {
    assert.equal(
      L.returnLink(`${ORIGIN}/de/account/login.html?next=%2Fde%2Faccount.html&code=${CODE}&utm=x`),
      `${ORIGIN}/de/account/login.html?next=%2Fde%2Faccount.html&code=${CODE}`,
    );
    assert.equal(L.returnLink(`${ORIGIN}/gate.html?f=Flow1Flow1Flow1A&code=${CODE}`), `${ORIGIN}/gate.html?f=Flow1Flow1Flow1A&code=${CODE}`);
    assert.equal(L.returnLink(`${ORIGIN}/de/account/login.html`), '', 'ohne code nichts');
    assert.equal(L.returnLink(`${ORIGIN}/x?code=a%20b`), '', 'code nur aus Zeichen einer UUID');
    assert.equal(L.returnLink(`${ORIGIN}/gate.html?f=kurz&code=${CODE}`), '', 'kaputte Kennung');
    assert.equal(L.returnLink('kein link'), '');
  });

  test('Einfügen: nur ein Rücklink auf genau diese Seite', () => {
    const here = `${ORIGIN}/de/account/login.html?next=%2Fde%2Faccount.html`;
    const back = `${ORIGIN}/de/account/login.html?next=%2Fde%2Faccount.html&code=${CODE}`;
    assert.equal(L.acceptReturn('  ' + back + '\n', here), `/de/account/login.html?next=%2Fde%2Faccount.html&code=${CODE}`);
    assert.equal(L.acceptReturn(back.replace(ORIGIN, 'https://evil.example'), here), '', 'fremder Ursprung');
    assert.equal(L.acceptReturn(back.replace('https:', 'http:'), here), '', 'anderes Schema = anderer Ursprung');
    assert.equal(L.acceptReturn(`${ORIGIN}/account/login.html?code=${CODE}`, here), '', 'andere Seite (EN statt DE)');
    assert.equal(L.acceptReturn(`${ORIGIN}/de/account/login.html?next=x`, here), '', 'ohne code');
    assert.equal(L.acceptReturn('javascript:alert(1)', here), '');
    assert.equal(L.acceptReturn('mein Passwort', here), '', 'gewöhnlicher Text bleibt Text');
    assert.equal(L.acceptReturn(back + ' ' + back, here), '');
  });

  test('Tasten je Browser, auf Telefon keine', () => {
    const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
    const FF = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0';
    const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15';
    const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
    assert.deepEqual(L.privateKeys(WIN, 'de'), ['Strg', '⇧', 'N']);
    assert.deepEqual(L.privateKeys(WIN, 'en'), ['Ctrl', 'Shift', 'N']);
    assert.deepEqual(L.privateKeys(FF, 'en'), ['Ctrl', 'Shift', 'P']);
    assert.deepEqual(L.privateKeys(MAC, 'en'), ['⌘', '⇧', 'N']);
    assert.deepEqual(L.privateKeys(PHONE, 'de'), []);
    assert.deepEqual(L.pasteKeys(WIN, 'de'), ['Strg', 'V']);
    assert.deepEqual(L.pasteKeys(MAC, 'de'), ['⌘', 'V']);
  });
});

// ------------------------------------------------------- Torseite, zwei Fenster
const gateSrc = read('src/pages/gate.astro');
const inline = /<script define:vars=\{\{[^}]*\}\}>([\s\S]*?)<\/script>/.exec(gateSrc);
const SB = 'https://sb.example';
const STAGING = 'https://staging.verse-base.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

function el(tag = 'div') {
  const handlers = {};
  const cls = new Set();
  return {
    tag, textContent: '', disabled: false, hidden: false, attrs: {}, value: '', href: '#', children: [],
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, fn) { (handlers[t] ||= []).push(fn); },
    fire(t, ev = {}) { for (const fn of handlers[t] || []) fn(ev); },
    appendChild(c) { this.children.push(c); }, focus() {},
    elements: { namedItem: () => ({ value: '' }) },
  };
}

/** Ein Fenster: eigener Speicher (privat = leer), eigene Adresse. */
function openWindow({ search = '', ls = new Map(), clip }) {
  const els = {};
  const getEl = (id) => (els[id] ||= el());
  // Was im Markup `hidden` trägt, beginnt auch hier verborgen.
  for (const m of gateSrc.matchAll(/<[a-z]+ [^>]*id="([A-Za-z]+)"[^>]*\shidden[\s>]/g)) getEl(m[1]).hidden = true;
  const docHandlers = {};
  const calls = [];
  const page = { replaced: null, href: null };
  const loc = {
    origin: STAGING, pathname: '/gate.html', search, hash: '',
    replace(u) { page.replaced = u; },
    set href(u) { page.href = u; }, get href() { return this.origin + this.pathname + this.search + this.hash; },
  };
  const store = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) });
  const respond = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
  const sandbox = {
    document: {
      getElementById: getEl,
      createElement: (t) => el(t),
      addEventListener: (t, fn) => { (docHandlers[t] ||= []).push(fn); },
    },
    navigator: { userAgent: UA, clipboard: { writeText: (t) => { clip.text = t; return Promise.resolve(); } } },
    location: loc,
    history: { replaceState(_s, _t, u) { const x = new URL(u, loc.origin); loc.pathname = x.pathname; loc.search = x.search; loc.hash = x.hash; } },
    sessionStorage: store(new Map()), localStorage: store(ls),
    fetch(url, init = {}) {
      calls.push({ url, init });
      if (url.startsWith(SB + '/auth/v1/token?grant_type=pkce')) return respond(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, token_type: 'bearer', user: { id: 'u2', factors: [] } });
      if (url === '/_gate/mint') return respond(204, {});
      return respond(404, {});
    },
    crypto: webcrypto, TextEncoder, URL, URLSearchParams, btoa, atob, encodeURIComponent, parseInt, Math, Date, JSON, String, setTimeout,
  };
  vm.runInNewContext(`var SB_URL=${JSON.stringify(SB)},SB_KEY='key',STORE='sb-test-auth-token';\n` + inline[1], sandbox);
  const paste = (text) => {
    let prevented = false;
    const ev = { clipboardData: { getData: () => text }, preventDefault() { prevented = true; } };
    for (const fn of docHandlers.paste || []) fn(ev);
    return prevented;
  };
  return { els, getEl, ls, calls, page, loc, paste, docHandlers };
}
const until = async (cond) => { for (let t = 0; t < 2000 && !cond(); t += 10) await new Promise((r) => setTimeout(r, 10)); };
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('Torseite: anderes Discord-Konto über ein privates Fenster', () => {
  test('Inline-Skript gefunden', () => assert.ok(inline));

  test('erstes Fenster beginnt, privates zeigt den Rücklink, Einfügen meldet im ersten Fenster an', async () => {
    const clip = { text: '' };
    // 1) Normales Fenster: aufklappen -> neue Anmeldung, Link zum Kopieren.
    const first = openWindow({ search: '?next=%2Fpatches.html', clip });
    first.getEl('gateOtherBtn').fire('click');
    await until(() => first.getEl('gateOtherCopy').href !== '#');
    assert.equal(first.getEl('gateOther').hidden, false);
    const link = new URL(first.getEl('gateOtherCopy').href);
    assert.equal(link.origin + link.pathname, SB + '/auth/v1/authorize');
    const redirect = new URL(link.searchParams.get('redirect_to'));
    const f = redirect.searchParams.get('f');
    assert.equal(redirect.origin + redirect.pathname, STAGING + '/gate.html');
    const flows = JSON.parse(first.ls.get('vb_gate_pkce'));
    assert.deepEqual(Object.keys(flows), [f], 'der Verifier bleibt im ersten Fenster');
    assert.equal(link.searchParams.get('code_challenge'), b64url(createHash('sha256').update(flows[f].v).digest()));
    assert.equal(flows[f].n, '/patches.html');
    assert.ok(!link.href.includes(flows[f].v), 'der Verifier steht nicht im Link');
    assert.equal(first.getEl('gateOtherBtn').attrs['aria-expanded'], 'true');
    first.getEl('gateOtherCopy').fire('click', { preventDefault() {} });
    await until(() => clip.text);
    assert.equal(clip.text, link.href, 'Klick kopiert statt zu navigieren');
    assert.equal(first.page.href, null);

    // 2) Privates Fenster: leerer Speicher, Discord springt mit code zurück.
    const priv = openWindow({ search: `?f=${f}&code=${CODE}`, clip });
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(priv.calls.length, 0, 'hier wird nichts eingelöst');
    assert.equal(priv.ls.size, 0, 'und nichts gespeichert');
    assert.equal(priv.loc.search, '', 'code nicht in der Adresse');
    assert.equal(priv.getEl('gateBack').hidden, false, 'Rücklink statt Fehlermeldung');
    assert.equal(priv.getEl('gateDiscordStatus').textContent, '');
    clip.text = '';
    priv.getEl('gateBackCopy').fire('click');
    await until(() => clip.text);
    const back = clip.text;
    assert.equal(back, `${STAGING}/gate.html?f=${f}&code=${CODE}`);

    // 3) Zurück im ersten Fenster: Strg+V irgendwo auf der Seite.
    assert.equal(first.paste(back), true, 'Einfügen wird übernommen');
    assert.equal(first.page.href, `/gate.html?f=${f}&code=${CODE}`);

    // 4) Das erste Fenster öffnet den Link: Einlösen mit SEINEM Verifier.
    const again = openWindow({ search: `?f=${f}&code=${CODE}`, ls: first.ls, clip });
    await until(() => again.page.replaced);
    const tok = again.calls.find((c) => c.url.includes('grant_type=pkce'));
    assert.deepEqual(JSON.parse(tok.init.body), { auth_code: CODE, code_verifier: flows[f].v });
    assert.equal(JSON.parse(again.ls.get('sb-test-auth-token')).access_token, 'AT');
    assert.equal(again.page.replaced, '/patches.html');
  });

  test('Einfügen: fremde Links und gewöhnlicher Text öffnen nichts', async () => {
    const clip = { text: '' };
    const w = openWindow({ clip });
    w.getEl('gateOtherBtn').fire('click');
    await until(() => w.getEl('gateOtherCopy').href !== '#');
    const f = Object.keys(JSON.parse(w.ls.get('vb_gate_pkce')))[0];
    assert.equal(w.paste('mein-passwort'), false);
    assert.equal(w.paste(`https://evil.example/gate.html?f=${f}&code=${CODE}`), false);
    assert.equal(w.paste(`${STAGING}/account.html?f=${f}&code=${CODE}`), false);
    assert.equal(w.paste(`${STAGING}/gate.html?f=${f}`), false);
    assert.equal(w.page.href, null);
    assert.match(w.getEl('gateOtherStatus').textContent, /not the link/);
    // Gültige Form, aber eine Anmeldung, die dieser Browser nie begonnen hat.
    assert.equal(w.paste(`${STAGING}/gate.html?f=Other0Other0Othe&code=${CODE}`), true);
    assert.equal(w.page.href, null, 'nicht geöffnet');
    assert.match(w.getEl('gateOtherStatus').textContent, /another browser/);
  });

  test('der Discord-Knopf selbst bleibt, wie er war: Sprung zum Anmeldedienst', async () => {
    const w = openWindow({ clip: {} });
    w.getEl('gateDiscordBtn').fire('click');
    await until(() => w.page.href);
    assert.ok(w.page.href.startsWith(SB + '/auth/v1/authorize?provider=discord&redirect_to='));
  });
});

// -------------------------------------------------------------- Verdrahtung
describe('Verdrahtung', () => {
  const comp = read('src/components/account/DiscordElsewhere.astro');
  const login = read('src/components/account/AuthLogin.astro');
  const dash = read('src/components/account/AccountDashboard.astro');
  const dashJs = read('src/scripts/account-dashboard.ts');

  test('Anmeldeseite: Knopf unter Discord, Rücklink im privaten Fenster', () => {
    assert.match(login, /<DiscordElsewhere lang=\{lang\} mode="login" \/>/);
    assert.ok(login.indexOf('id="discordBtn"') < login.indexOf('<DiscordElsewhere'), 'unter dem Discord-Knopf');
    assert.match(login, /const landing = location\.href;/);
    assert.ok(login.indexOf('const landing = location.href;') < login.indexOf('dropCodeFromUrl();'), 'Adresse gemerkt, bevor sie aufgeräumt wird');
    assert.match(login, /const back = returnLink\(landing\);[\s\S]{0,400}box\.hidden = false;/);
    assert.match(login, /id="loginBack" hidden/);
  });

  // 31.10.2026 im Bild gesehen: `.acx-back { display: grid }` schlug das
  // hidden-Attribut, der Rücklink-Kasten stand bei jedem Aufruf da.
  test('verborgene Kästen bleiben verborgen, auch mit eigener display-Regel', () => {
    for (const [name, src, scope] of [['AuthLogin', login, null], ['DiscordElsewhere', comp, '.dce']]) {
      const css = (/<style[^>]*>([\s\S]*?)<\/style>/.exec(src) || [])[1] || '';
      const hiddenClasses = [...src.matchAll(/<[a-z]+ class="([a-z-]+)[^"]*"[^>]*\shidden[\s>]/g)].map((m) => m[1]);
      assert.ok(hiddenClasses.length > 0, name + ': verborgene Kästen gefunden');
      for (const cls of hiddenClasses) {
        if (!new RegExp('\\.' + cls + '\\s*\\{[^}]*display:').test(css)) continue;
        const guarded = css.includes('.' + cls + '[hidden] { display: none; }') || (scope && css.includes(scope + ' [hidden] { display: none; }'));
        assert.ok(guarded, `${name}: .${cls} hat display und keinen [hidden]-Schutz`);
      }
    }
  });

  test('Baustein: Anmeldung ohne Sprung, Verifier-Prüfung, nur eigener Rücklink', () => {
    assert.match(comp, /skipBrowserRedirect: true/);
    // Wieder aufklappen überschreibt den Verifier des kopierten Links nicht.
    assert.match(comp, /if \(mode === 'login' && link && Date\.now\(\) - preparedAt < KEEP_MS\) return;/);
    assert.ok(comp.indexOf('preparedAt = Date.now();') > comp.indexOf('signInWithOAuth'), 'Zeitpunkt erst nach erfolgreichem Start');
    assert.match(comp, /SUPABASE\.storageKey \+ '-code-verifier'/);
    assert.match(comp, /acceptReturn\(text, location\.href\)/);
    assert.match(comp, /location\.assign\(rel\)/);
    // supabase-js legt den Verifier genau unter diesem Schlüssel ab.
    const authJs = read('node_modules/@supabase/auth-js/dist/module/GoTrueClient.js');
    assert.match(authJs, /`\$\{this\.storageKey\}-code-verifier`/);
  });

  test('Kontoseite: kein kopierbarer Verbindungslink, Karte zieht nach', () => {
    assert.match(dash, /<DiscordElsewhere lang=\{lang\} mode="link" \/>/);
    const linkBranch = /if \(mode === 'link'\) \{\s*link = ([^;]+);/.exec(comp);
    assert.ok(linkBranch, 'Zweig für mode link fehlt');
    assert.equal(linkBranch[1], "location.origin + location.pathname + '?dc=1'", 'nur die Kontoseite selbst');
    assert.doesNotMatch(comp, /linkIdentity/, 'ein Verbindungslink wäre eine Vollmacht für fremde Discord-Konten');
    assert.match(dashJs, /addEventListener\('vb:discord-recheck', \(\) => \{ void dcRender\(\); \}\)/);
    assert.match(dashJs, /get\('dc'\) === '1'/);
  });
});
