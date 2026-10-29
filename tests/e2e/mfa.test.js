// Zweiter Faktor (TOTP) für Anmeldung, Konto und Torseite.
//
// 1. src/lib/mfa.ts gegen einen nachgebauten supabase-js-Client: wann der
//    Code fällig ist, dass ein Code gegen JEDEN bestätigten Faktor geprüft
//    wird (zwei Geräte), Fehlerbilder (falsch, gedrosselt, kein Faktor), der
//    QR-Code als sichere Bildadresse, Einrichten räumt angefangene Faktoren ab.
// 2. Die Torseite (src/pages/gate.astro, SDK-frei, inline) in einer
//    nachgebauten Browserumgebung (node:vm), ohne Netz: hat das Konto einen
//    bestätigten Faktor und die frische Sitzung kein aal2, wird erst nach dem
//    Code gemintet, und gespeichert wird die Sitzung MIT Code.
// 3. Verdrahtung: jede Seite, die anmeldet oder heikle Änderungen erlaubt,
//    trägt den Code-Dialog und fragt ihn ab.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as nodeModule from 'node:module';
import { webcrypto } from 'node:crypto';

async function loadTs(rel) {
  const src = fs.readFileSync(path.resolve(rel), 'utf8');
  let js;
  if (typeof nodeModule.stripTypeScriptTypes === 'function') {
    js = nodeModule.stripTypeScriptTypes(src);
  } else {
    const { transformSync } = await import('esbuild');
    js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
  }
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const M = await loadTs('src/lib/mfa.ts');

const jwt = (claims) => 'h.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.s';
const err = (status, code) => ({ status, code, message: code });

/** Nachgebauter Client: Faktoren, Stufe, Antworten je Faktor-ID. */
function fakeClient({ factors = [], current = 'aal1', verify = {}, enrollErr = null, unenrollErr = null } = {}) {
  const calls = [];
  let level = current;
  const verified = () => factors.filter((f) => f.status === 'verified');
  const auth = {
    async getSession() { return { data: { session: { access_token: jwt({ aal: level }) } }, error: null }; },
    mfa: {
      async getAuthenticatorAssuranceLevel(token) {
        calls.push(['aal', token || null]);
        return { data: { currentLevel: level, nextLevel: verified().length ? 'aal2' : level }, error: null };
      },
      async listFactors() {
        calls.push(['list']);
        return { data: { all: factors, totp: verified().filter((f) => f.factor_type === 'totp') }, error: null };
      },
      async challengeAndVerify({ factorId, code }) {
        calls.push(['verify', factorId, code]);
        const r = verify[factorId];
        if (r === 'ok') { level = 'aal2'; return { data: {}, error: null }; }
        return { data: null, error: r || err(422, 'mfa_verification_failed') };
      },
      async enroll(p) {
        calls.push(['enroll', p]);
        if (enrollErr) return { data: null, error: enrollErr };
        return { data: { id: 'new', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#000000" d="M0 0h1v1H0z"/></svg>', secret: 'ABCDEFGHIJKLMNOP', uri: 'otpauth://totp/x' } }, error: null };
      },
      async unenroll({ factorId }) {
        calls.push(['unenroll', factorId]);
        return { data: unenrollErr ? null : { id: factorId }, error: unenrollErr };
      },
    },
  };
  return { auth, calls, get level() { return level; } };
}
const F = (id, status = 'verified', name = id) => ({ id, factor_type: 'totp', status, friendly_name: name, created_at: '2026-10-30T10:00:00Z' });

describe('mfa.ts', () => {
  test('normalizeCode: sechs Ziffern, Leerzeichen und Bindestrich erlaubt', () => {
    assert.equal(M.normalizeCode('123456'), '123456');
    assert.equal(M.normalizeCode(' 123 456 '), '123456');
    assert.equal(M.normalizeCode('123-456'), '123456');
    assert.equal(M.normalizeCode('12345'), null);
    assert.equal(M.normalizeCode('1234567'), null);
    assert.equal(M.normalizeCode('12a456'), null);
    assert.equal(M.normalizeCode(''), null);
  });

  test('needsCode: nur mit bestätigtem Faktor und ohne aal2', async () => {
    assert.equal(await M.needsCode(fakeClient()), false, 'ohne Faktor kein Code');
    assert.equal(await M.needsCode(fakeClient({ factors: [F('a', 'unverified')] })), false, 'angefangener Faktor zählt nicht');
    assert.equal(await M.needsCode(fakeClient({ factors: [F('a')] })), true);
    assert.equal(await M.needsCode(fakeClient({ factors: [F('a')], current: 'aal2' })), false);
  });

  test('needsCode(fresh) fragt mit dem Zugangstoken beim Server nach', async () => {
    const c = fakeClient({ factors: [F('a')] });
    assert.equal(await M.needsCode(c, true), true);
    assert.equal(c.calls[0][0], 'aal');
    assert.match(c.calls[0][1] || '', /^h\./, 'getAuthenticatorAssuranceLevel bekommt das JWT');
  });

  test('verifyCode prüft jeden bestätigten Faktor, bis einer passt', async () => {
    const c = fakeClient({ factors: [F('handy'), F('alt', 'unverified'), F('tablet')], verify: { tablet: 'ok' } });
    assert.equal(await M.verifyCode(c, '123456'), 'ok');
    assert.deepEqual(c.calls.filter((x) => x[0] === 'verify').map((x) => x[1]), ['handy', 'tablet'], 'unbestätigte Faktoren werden nie gefragt');
    assert.equal(c.level, 'aal2');
  });

  test('verifyCode: falsch, gedrosselt, kein Faktor, Netz', async () => {
    assert.equal(await M.verifyCode(fakeClient({ factors: [F('a'), F('b')] }), '000000'), 'wrong');
    assert.equal(await M.verifyCode(fakeClient({ factors: [F('a'), F('b')], verify: { a: err(429, 'over_request_rate_limit') } }), '000000'), 'rate');
    assert.equal(await M.verifyCode(fakeClient(), '000000'), 'none');
    assert.equal(await M.verifyCode(fakeClient({ factors: [F('a')], verify: { a: err(0, 'unexpected_failure') } }), '000000'), 'error');
  });

  test('qrImageSrc: neu kodiert, weißer Grund, nur SVG', () => {
    const src = M.qrImageSrc('data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000"/></svg>');
    assert.match(src, /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
    assert.ok(!src.includes('#'), 'ein # bliebe sonst als Fragment stehen');
    const svg = decodeURIComponent(src.split(',')[1]);
    assert.match(svg, /^<svg[^>]*><rect width="100%" height="100%" fill="white"\/><path/);
    assert.equal(M.qrImageSrc('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(M.qrImageSrc('javascript:alert(1)'), '');
    assert.equal(M.qrImageSrc(''), '');
  });

  test('groupSecret und uniqueFactorName', () => {
    assert.equal(M.groupSecret('ABCDEFGHIJ'), 'ABCD EFGH IJ');
    assert.equal(M.uniqueFactorName('', [], 'Authenticator'), 'Authenticator');
    assert.equal(M.uniqueFactorName('Handy', ['handy'], 'Authenticator'), 'Handy 2');
    assert.equal(M.uniqueFactorName('Handy', ['Handy', 'Handy 2'], 'Authenticator'), 'Handy 3');
    assert.equal(M.uniqueFactorName('x'.repeat(80), [], 'A').length, 40);
  });

  test('startEnroll räumt angefangene Faktoren ab und vergibt einen freien Namen', async () => {
    const c = fakeClient({ factors: [F('v1', 'verified', 'Handy'), F('p1', 'unverified', 'Tablet')] });
    const r = await M.startEnroll(c, 'Handy', 'Authenticator');
    assert.equal(r.ok, true);
    assert.deepEqual(c.calls.filter((x) => x[0] === 'unenroll').map((x) => x[1]), ['p1']);
    const e = c.calls.find((x) => x[0] === 'enroll')[1];
    assert.deepEqual(e, { factorType: 'totp', friendlyName: 'Handy 2', issuer: 'VerseBase' });
    assert.equal(r.secret, 'ABCDEFGHIJKLMNOP');
    assert.match(r.qr, /^data:image\/svg\+xml;charset=utf-8,/);
  });

  test('startEnroll: Fehlerbilder', async () => {
    assert.deepEqual(await M.startEnroll(fakeClient({ enrollErr: err(403, 'insufficient_aal') }), '', 'A'), { ok: false, reason: 'aal' });
    assert.deepEqual(await M.startEnroll(fakeClient({ enrollErr: err(422, 'too_many_enrolled_mfa_factors') }), '', 'A'), { ok: false, reason: 'limit' });
    assert.deepEqual(await M.startEnroll(fakeClient({ enrollErr: err(422, 'mfa_totp_enroll_not_enabled') }), '', 'A'), { ok: false, reason: 'disabled' });
  });

  test('finishEnroll und removeFactor', async () => {
    assert.equal(await M.finishEnroll(fakeClient({ verify: { n: 'ok' } }), 'n', '123456'), 'ok');
    assert.equal(await M.finishEnroll(fakeClient(), 'n', '123456'), 'wrong');
    assert.equal(await M.removeFactor(fakeClient(), 'a'), 'ok');
    assert.equal(await M.removeFactor(fakeClient({ unenrollErr: err(422, 'insufficient_aal') }), 'a'), 'aal');
  });
});

// ------------------------------------------------------------ Torseite ----
const gateSrc = fs.readFileSync(path.resolve('src/pages/gate.astro'), 'utf8');
const inline = /<script define:vars=\{\{[^}]*\}\}>([\s\S]*?)<\/script>/.exec(gateSrc);
const SB = 'https://sb.example';

function el() {
  const handlers = {};
  return {
    textContent: '', innerHTML: '', disabled: false, hidden: false, attrs: {}, value: '',
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, fn) { handlers[t] = fn; }, fire(t, ev) { return handlers[t] && handlers[t](ev); },
    focus() {},
    elements: { namedItem: (n) => ({ value: n === 'email' ? 'a@b.c' : n === 'code' ? (el.code || '') : 'pw' }) },
  };
}

const AAL1 = jwt({ sub: 'u1', aal: 'aal1' });
const AAL2 = jwt({ sub: 'u1', aal: 'aal2' });
const withFactors = (token, factors) => ({ access_token: token, refresh_token: 'R', expires_in: 3600, token_type: 'bearer', user: { id: 'u1', factors } });
const TOTP = (id) => ({ id, factor_type: 'totp', status: 'verified' });

function runGate({ search = '', local = {}, answers = {} } = {}) {
  const els = {};
  const getEl = (id) => (els[id] ||= el());
  const ls = new Map(Object.entries(local));
  const calls = [];
  const page = { replaced: null, href: null };
  const loc = {
    origin: 'https://staging.verse-base.com', pathname: '/gate.html', search, hash: '',
    replace(u) { page.replaced = u; },
    set href(u) { page.href = u; }, get href() { return this.origin + this.pathname + this.search + this.hash; },
  };
  const store = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) });
  const respond = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
  const verified = new Map(Object.entries(answers.verify || {}));
  const sandbox = {
    document: { getElementById: getEl },
    location: loc,
    history: { replaceState(_s, _t, u) { const x = new URL(u, loc.origin); loc.pathname = x.pathname; loc.search = x.search; loc.hash = x.hash; } },
    sessionStorage: store(new Map()), localStorage: store(ls),
    fetch(url, init = {}) {
      calls.push({ url, init });
      if (url.startsWith(SB + '/auth/v1/token?grant_type=pkce')) return respond(...(answers.pkce || [200, withFactors(AAL1, [])]));
      if (url.startsWith(SB + '/auth/v1/token?grant_type=password')) return respond(...(answers.password || [200, withFactors(AAL1, [])]));
      const m = /\/auth\/v1\/factors\/([^/]+)\/(challenge|verify)$/.exec(url);
      if (m && m[2] === 'challenge') return respond(200, { id: 'ch-' + m[1], type: 'totp' });
      if (m && m[2] === 'verify') {
        const v = verified.get(m[1]);
        return v === 'ok' ? respond(200, withFactors(AAL2, [TOTP(m[1])])) : respond(v || 422, { code: 'mfa_verification_failed' });
      }
      if (url === '/_gate/mint') {
        const auth = init.headers && init.headers.Authorization;
        const mintFor = answers.mint || ((a) => (a === 'Bearer ' + AAL2 ? 204 : 403));
        return respond(mintFor(auth), {});
      }
      return respond(404, {});
    },
    crypto: webcrypto, TextEncoder, URL, URLSearchParams, btoa, atob, encodeURIComponent, parseInt, Math, Date, JSON, String, setTimeout,
  };
  vm.runInNewContext(`var SB_URL=${JSON.stringify(SB)},SB_KEY='key',STORE='sb-test-auth-token';\n` + inline[1], sandbox);
  return { els, getEl, ls, calls, page, loc };
}
const settle = () => new Promise((r) => setTimeout(r, 40));
const mints = (g) => g.calls.filter((c) => c.url === '/_gate/mint').map((c) => c.init.headers.Authorization);

describe('Torseite: zweiter Faktor', () => {
  test('Inline-Skript gefunden', () => assert.ok(inline));

  test('Passwort-Anmeldung mit Faktor: kein mint ohne Code, Code-Formular erscheint', async () => {
    const g = runGate({ answers: { password: [200, withFactors(AAL1, [TOTP('f1')])] } });
    g.getEl('gateForm').fire('submit', { preventDefault() {} });
    await settle();
    assert.deepEqual(mints(g), [], 'aal1-Sitzung eines Kontos mit Faktor geht nicht ans Tor');
    assert.equal(g.getEl('gateMfaForm').hidden, false);
    assert.equal(g.ls.size, 0, 'nichts gespeichert');
  });

  test('Code richtig: challenge+verify mit dem Zugangstoken, mint und Speichern der aal2-Sitzung', async () => {
    const g = runGate({ search: '?next=%2Fpatches.html', answers: { password: [200, withFactors(AAL1, [TOTP('f1')])], verify: { f1: 'ok' } } });
    g.getEl('gateForm').fire('submit', { preventDefault() {} });
    await settle();
    el.code = '123 456';
    g.getEl('gateMfaForm').fire('submit', { preventDefault() {} });
    await settle();
    const ch = g.calls.find((c) => c.url.endsWith('/factors/f1/challenge'));
    assert.equal(ch.init.headers.Authorization, 'Bearer ' + AAL1);
    assert.equal(ch.init.headers.apikey, 'key');
    const v = g.calls.find((c) => c.url.endsWith('/factors/f1/verify'));
    assert.deepEqual(JSON.parse(v.init.body), { challenge_id: 'ch-f1', code: '123456' });
    assert.deepEqual(mints(g), ['Bearer ' + AAL2]);
    assert.equal(JSON.parse(g.ls.get('sb-test-auth-token')).access_token, AAL2);
    assert.equal(g.page.replaced, '/patches.html');
  });

  test('zwei Geräte: erster Faktor lehnt ab, zweiter passt', async () => {
    const g = runGate({ answers: { password: [200, withFactors(AAL1, [TOTP('a'), TOTP('b')])], verify: { b: 'ok' } } });
    g.getEl('gateForm').fire('submit', { preventDefault() {} });
    await settle();
    el.code = '654321';
    g.getEl('gateMfaForm').fire('submit', { preventDefault() {} });
    await settle();
    assert.deepEqual(g.calls.filter((c) => c.url.includes('/verify')).map((c) => c.url.split('/')[6]), ['a', 'b']);
    assert.deepEqual(mints(g), ['Bearer ' + AAL2]);
  });

  test('Code falsch: Hinweis, kein mint, nichts gespeichert', async () => {
    const g = runGate({ answers: { password: [200, withFactors(AAL1, [TOTP('f1')])] } });
    g.getEl('gateForm').fire('submit', { preventDefault() {} });
    await settle();
    el.code = '000000';
    g.getEl('gateMfaForm').fire('submit', { preventDefault() {} });
    await settle();
    assert.match(g.getEl('gateMfaStatus').textContent, /not right/);
    assert.deepEqual(mints(g), []);
    assert.equal(g.ls.size, 0);
  });

  test('Code richtig, aber kein Testpilot: Code-Schritt zu, kein zweiter Versuch ins Leere', async () => {
    const g = runGate({ answers: { password: [200, withFactors(AAL1, [TOTP('f1')])], verify: { f1: 'ok' }, mint: () => 403 } });
    g.getEl('gateForm').fire('submit', { preventDefault() {} });
    await settle();
    el.code = '123456';
    g.getEl('gateMfaForm').fire('submit', { preventDefault() {} });
    await settle();
    assert.match(g.getEl('gateMfaStatus').textContent, /no Test Pilot access/);
    assert.equal(g.getEl('gateMfaBtn').disabled, true);
    assert.equal(g.getEl('gateMfaCode').disabled, true);
    assert.equal(g.ls.size, 0);
  });

  test('Tor kurz nicht erreichbar: Code-Schritt bleibt offen, ein neuer Code versucht es erneut', async () => {
    const g = runGate({ answers: { password: [200, withFactors(AAL1, [TOTP('f1')])], verify: { f1: 'ok' }, mint: () => 503 } });
    g.getEl('gateForm').fire('submit', { preventDefault() {} });
    await settle();
    el.code = '123456';
    g.getEl('gateMfaForm').fire('submit', { preventDefault() {} });
    await settle();
    assert.match(g.getEl('gateMfaStatus').textContent, /try again/);
    assert.equal(g.getEl('gateMfaBtn').disabled, false);
    el.code = '234567';
    g.getEl('gateMfaForm').fire('submit', { preventDefault() {} });
    await settle();
    assert.equal(g.calls.filter((c) => c.url.endsWith('/verify')).length, 2);
  });

  test('Eingabe ohne sechs Ziffern geht nicht an den Server', async () => {
    const g = runGate({ answers: { password: [200, withFactors(AAL1, [TOTP('f1')])] } });
    g.getEl('gateForm').fire('submit', { preventDefault() {} });
    await settle();
    el.code = '12345';
    g.getEl('gateMfaForm').fire('submit', { preventDefault() {} });
    await settle();
    assert.equal(g.calls.filter((c) => c.url.includes('/factors/')).length, 0);
    assert.match(g.getEl('gateMfaStatus').textContent, /six digits/);
  });

  test('Discord-Rücksprung mit Faktor: erst der Code', async () => {
    const pkce = JSON.stringify({ Flow1Flow1Flow1A: { v: 'V'.repeat(43), n: '/', t: Date.now() } });
    const g = runGate({ search: '?f=Flow1Flow1Flow1A&code=C1', local: { vb_gate_pkce: pkce }, answers: { pkce: [200, withFactors(AAL1, [TOTP('f1')])] } });
    await settle();
    assert.deepEqual(mints(g), []);
    assert.equal(g.getEl('gateMfaForm').hidden, false);
    assert.equal(g.ls.has('sb-test-auth-token'), false);
  });

  test('ohne Faktor bleibt alles wie bisher (direkt mint)', async () => {
    const g = runGate({ answers: { mint: () => 204 } });
    g.getEl('gateForm').fire('submit', { preventDefault() {} });
    await settle();
    assert.deepEqual(mints(g), ['Bearer ' + AAL1]);
    assert.equal(g.calls.filter((c) => c.url.includes('/factors/')).length, 0);
  });

  test('gespeicherte aal1-Sitzung, Tor lehnt ab: Code wird angeboten', async () => {
    const stored = JSON.stringify(withFactors(AAL1, [TOTP('f1')]));
    const g = runGate({ local: { 'sb-test-auth-token': stored } });
    await settle();
    assert.deepEqual(mints(g), ['Bearer ' + AAL1]);
    assert.equal(g.getEl('gateMfaForm').hidden, false);
    assert.match(g.getEl('gateMfaStatus').textContent, /authenticator app/);
  });
});

// ------------------------------------------------------------ Verdrahtung ----
describe('Verdrahtung des Code-Dialogs', () => {
  const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');

  test('Anmeldung, Passwort zurücksetzen und Konto tragen den Dialog', () => {
    for (const p of ['src/components/account/AuthLogin.astro', 'src/components/account/AuthUpdatePassword.astro', 'src/components/account/AccountDashboard.astro']) {
      assert.match(read(p), /<MfaCodeDialog lang=\{lang\} \/>/, p);
    }
  });

  test('Konto: Dialog liegt ausserhalb des verborgenen #dash (wird beim Laden gebraucht)', () => {
    const s = read('src/components/account/AccountDashboard.astro');
    const open = s.indexOf('<div id="dash" hidden');
    const ends = [...s.matchAll(/<\/dialog>\r?\n<\/div>/g)];
    const close = ends.length ? ends[ends.length - 1].index : -1;
    const dlg = s.indexOf('<MfaCodeDialog lang={lang} />');
    assert.ok(open > 0 && close > open, '#dash und sein Ende gefunden');
    assert.ok(dlg > close, 'MfaCodeDialog steht nach dem Ende von #dash');
  });

  test('Anmeldung: Passwort und bestehende Sitzung (Discord-Rücksprung) gehen durch passSecondFactor', () => {
    const s = read('src/components/account/AuthLogin.astro');
    assert.equal((s.match(/if \(!\(await passSecondFactor\(\)\)\) return;\s*go\(\);/g) || []).length, 2);
    assert.doesNotMatch(s, /if \(!error\) \{\s*go\(\);/, 'kein Sprung ins Konto direkt nach signInWithPassword');
  });

  test('Konto: Code vor dem Aufbau und nach jeder erneuten Bestätigung', () => {
    const s = read('src/scripts/account-dashboard.ts');
    const user = s.indexOf('const user = userData.user;');
    const ask = s.indexOf('if (await needsCode(supabase, true))');
    assert.ok(user > 0 && ask > user && ask - user < 600, 'Abfrage direkt nach getUser()');
    const ci = s.slice(s.indexOf('const confirmIdentity'), s.indexOf('// Bestätigen mit Discord'));
    assert.match(ci, /needsCode\(supabase\)\) && !\(await askCode\(supabase\)\)\) return D\.msgMfaNeed!/);
  });

  test('Passwort zurücksetzen: Code vor updateUser', () => {
    const s = read('src/components/account/AuthUpdatePassword.astro');
    const ask = s.indexOf('needsCode(rc)');
    const upd = s.indexOf('rc.auth.updateUser({ password })');
    assert.ok(ask > 0 && upd > ask);
  });
});
