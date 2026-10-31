// Anmeldefluss: Rücksprünge aus Discord und aus E-Mail-Links.
//
// 1. src/lib/auth-url.ts liest Fehler-, Link- und Sitzungsparameter aus Query
//    UND Fragment und räumt die Adresse auf: Sitzungs-Tokens verschwinden auf
//    jeder Seite, nur update-password.html behält sie (im Speicher) für alte
//    Recovery-Links; der PKCE-`code` bleibt für supabase-js stehen; ein
//    normales Fragment (#security) und fremde Parameter (?type= im Hangar)
//    bleiben unangetastet.
// 2. Der gemeinsame Client in src/lib/supabase.ts bleibt auf PKCE und liest
//    die Adresse erst NACH der Bereinigung.
// 3. Die Torseite (src/pages/gate.astro, SDK-frei, inline) meldet per PKCE an:
//    code_challenge = S256(code_verifier), der Verifier liegt mit dem
//    Rückziel je Anmeldung im localStorage des Browsers (Rücksprung auch in
//    einem neuen Tab, zwei Tabs stören sich nicht, das Rückziel reist nicht
//    über den Anmeldedienst) und wird erst beim Rücksprung verbraucht, ein
//    Rücksprung ohne ihn wird verworfen, Tokens
//    im Fragment werden nie gespeichert, und gespeichert wird erst, wenn
//    /_gate/mint die Sitzung angenommen hat. Das Inline-Skript läuft dazu in
//    einer nachgebauten Browserumgebung (node:vm), ohne Netz.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as nodeModule from 'node:module';
import { webcrypto, createHash } from 'node:crypto';

// auth-url.ts hat bewusst keine Importe: Typen abstreifen, als data:-Modul laden.
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

const { parseAuthUrl } = await loadTs('src/lib/auth-url.ts');
const SITE = 'https://verse-base.com';
const p = (rel) => parseAuthUrl(SITE + rel);

describe('auth-url: Adresse lesen und bereinigen', () => {
  test('Sitzungs-Tokens im Fragment verschwinden auf jeder Seite, ohne gemerkt zu werden', () => {
    for (const page of ['/account/login.html', '/account.html', '/de/account.html', '/refinery.html', '/pilot/abc']) {
      const r = p(page + '#access_token=A&refresh_token=R&expires_in=3600&token_type=bearer&type=recovery');
      assert.equal(r.hadSessionTokens, true, page);
      assert.equal(r.legacy, null, page);
      assert.equal(r.cleaned, page, page);
    }
  });

  test('auch Tokens in der Query werden entfernt', () => {
    const r = p('/account.html?access_token=A&refresh_token=R');
    assert.equal(r.hadSessionTokens, true);
    assert.equal(r.legacy, null);
    assert.equal(r.cleaned, '/account.html');
  });

  test('nur update-password.html (EN und DE) behält alte Recovery-Tokens im Speicher', () => {
    for (const page of ['/account/update-password.html', '/de/account/update-password.html']) {
      const r = p(page + '#access_token=A&refresh_token=R&expires_in=3600&token_type=bearer&type=recovery');
      assert.deepEqual(r.legacy, { access_token: 'A', refresh_token: 'R' }, page);
      assert.equal(r.type, 'recovery');
      assert.equal(r.cleaned, page);
    }
    // ohne refresh_token kein brauchbares Paar
    assert.equal(p('/account/update-password.html#access_token=A').legacy, null);
  });

  test('der PKCE-code bleibt für supabase-js stehen', () => {
    const r = p('/account/login.html?next=%2Faccount.html&code=abc');
    assert.equal(r.hasCode, true);
    assert.equal(r.cleaned, null);
  });

  test('Fehler kommen aus der Query (PKCE) oder aus dem Fragment (alte Links)', () => {
    const q = p('/account/login.html?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid&next=%2Fa');
    assert.equal(q.error, 'access_denied');
    assert.equal(q.errorCode, 'otp_expired');
    assert.equal(q.errorDescription, 'Email link is invalid');
    assert.equal(q.cleaned, '/account/login.html?next=%2Fa');
    const h = p('/account/login.html#error=access_denied&error_code=otp_expired');
    assert.equal(h.error, 'access_denied');
    assert.equal(h.errorCode, 'otp_expired');
    assert.equal(h.cleaned, '/account/login.html');
  });

  test('token_hash und type aus den Mailvorlagen werden gelesen und entfernt', () => {
    const r = p('/account/update-password.html?token_hash=pkce_abc123&type=recovery');
    assert.equal(r.tokenHash, 'pkce_abc123');
    assert.equal(r.type, 'recovery');
    assert.equal(r.cleaned, '/account/update-password.html');
    const m = p('/account/login.html?confirmed=1&message=Confirmation+link+accepted');
    assert.equal(m.message, 'Confirmation link accepted');
    assert.equal(m.cleaned, '/account/login.html?confirmed=1');
  });

  test('normale Fragmente und fremde Parameter bleiben unangetastet', () => {
    assert.equal(p('/account.html#security').cleaned, null);
    assert.equal(p('/hangar.html?type=ship').cleaned, null);
    assert.equal(p('/hangar.html?type=ship').type, '');
    assert.equal(p('/pilot.html?h=abc').cleaned, null);
    assert.equal(p('/account.html?error=server_error#security').cleaned, '/account.html#security');
  });
});

describe('supabase.ts: gemeinsamer Client', () => {
  const src = fs.readFileSync(path.resolve('src/lib/supabase.ts'), 'utf8');
  const shared = /export const supabase = createClient\([^)]*\{([\s\S]*?)\n\}\);/.exec(src);

  test('flowType pkce, kein impliziter Rücksprung', () => {
    assert.ok(shared, 'export const supabase = createClient(…) nicht gefunden');
    assert.match(shared[1], /flowType:\s*'pkce'/);
    assert.doesNotMatch(shared[1], /flowType:\s*'implicit'/);
    assert.match(shared[1], /detectSessionInUrl:\s*\(\)\s*=>\s*false/);
  });

  test('die Adresse wird VOR createClient bereinigt', () => {
    const take = src.indexOf('takeAuthFromUrl()');
    const create = src.indexOf('export const supabase = createClient');
    assert.ok(take > 0 && create > 0 && take < create, 'takeAuthFromUrl() muss vor createClient stehen');
  });
});

// ------------------------------------------------------------ Torseite ----
const gateSrc = fs.readFileSync(path.resolve('src/pages/gate.astro'), 'utf8');
const inline = /<script define:vars=\{\{[^}]*\}\}>([\s\S]*?)<\/script>/.exec(gateSrc);
const SB = 'https://sb.example';

function el() {
  const handlers = {};
  return {
    textContent: '', innerHTML: '', disabled: false, attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, fn) { handlers[t] = fn; }, fire(t, ev) { return handlers[t] && handlers[t](ev); },
    elements: { namedItem: (n) => ({ value: n === 'email' ? 'a@b.c' : 'pw' }) },
  };
}

/** Führt das Inline-Skript in einer nachgebauten Seite aus. */
function runGate({ search = '', hash = '', session = {}, local = {}, answers = {} } = {}) {
  const els = {};
  const getEl = (id) => (els[id] ||= el());
  const ss = new Map(Object.entries(session));
  const ls = new Map(Object.entries(local));
  const calls = [];
  const page = { replaced: null, href: null };
  const loc = {
    origin: 'https://staging.verse-base.com', pathname: '/gate.html', search, hash,
    replace(u) { page.replaced = u; },
    set href(u) { page.href = u; }, get href() { return this.origin + this.pathname + this.search + this.hash; },
  };
  const store = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) });
  const respond = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
  const sandbox = {
    document: { getElementById: getEl },
    location: loc,
    history: {
      replaceState(_s, _t, u) {
        const x = new URL(u, loc.origin);
        loc.pathname = x.pathname; loc.search = x.search; loc.hash = x.hash;
      },
    },
    sessionStorage: store(ss), localStorage: store(ls),
    fetch(url, init = {}) {
      calls.push({ url, init });
      if (url.startsWith(SB + '/auth/v1/token?grant_type=pkce')) return respond(...(answers.pkce || [200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, token_type: 'bearer' }]));
      if (url.startsWith(SB + '/auth/v1/token?grant_type=password')) return respond(200, { access_token: 'PW', refresh_token: 'R2' });
      if (url.startsWith(SB + '/auth/v1/token?grant_type=refresh_token')) return respond(...(answers.refresh || [200, { access_token: 'NEW', refresh_token: 'NEWR', expires_in: 3600, token_type: 'bearer' }]));
      if (url === '/_gate/mint') {
        const m = typeof answers.mint === 'function' ? answers.mint(init.headers && init.headers.Authorization) : answers.mint;
        return respond(...(m || [204, {}]));
      }
      return respond(404, {});
    },
    crypto: webcrypto, TextEncoder, URL, URLSearchParams, btoa, encodeURIComponent, parseInt, Math, Date, JSON, setTimeout,
  };
  vm.runInNewContext(`var SB_URL=${JSON.stringify(SB)},SB_KEY='key',STORE='sb-test-auth-token';\n` + inline[1], sandbox);
  return { els, getEl, ss, ls, calls, page, loc };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
// Der Klick wartet auf crypto.subtle.digest, bevor er die Adresse setzt:
// warten, bis sie steht (hoechstens 2 s), statt auf eine feste Zeit.
const until = async (cond) => {
  for (let t = 0; t < 2000 && !cond(); t += 10) await new Promise((r) => setTimeout(r, 10));
};
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// Laufende Anmeldungen, wie die Torseite sie unter vb_gate_pkce ablegt.
const F1 = 'Flow1Flow1Flow1A';
const F2 = 'Flow2Flow2Flow2B';
const flows = (o) => ({ vb_gate_pkce: JSON.stringify(o) });
const flow = (v, n = '/', t = Date.now()) => ({ v, n, t });

describe('Torseite: Discord-Anmeldung per PKCE', () => {
  test('Inline-Skript gefunden', () => assert.ok(inline, '<script define:vars> in gate.astro nicht gefunden'));

  test('Sprung zu Discord trägt code_challenge = S256(Verifier); Verifier und Rückziel bleiben im Browser', async () => {
    const g = runGate({ search: '?next=%2Faccount.html%3Ftoken_hash%3Dpkce_abc%26type%3Drecovery' });
    g.getEl('gateDiscordBtn').fire('click');
    await until(() => !!g.page.href);
    const stored = JSON.parse(g.ls.get('vb_gate_pkce'));
    const ids = Object.keys(stored);
    assert.equal(ids.length, 1);
    assert.match(ids[0], /^[A-Za-z0-9_-]{16}$/);
    const { v: verifier, n, t } = stored[ids[0]];
    assert.match(verifier || '', /^[A-Za-z0-9_-]{43,128}$/);
    assert.equal(n, '/account.html?token_hash=pkce_abc&type=recovery');
    assert.ok(Math.abs(Date.now() - t) < 5000);
    const u = new URL(g.page.href);
    assert.equal(u.origin + u.pathname, SB + '/auth/v1/authorize');
    assert.equal(u.searchParams.get('provider'), 'discord');
    assert.equal(u.searchParams.get('code_challenge_method'), 's256');
    assert.equal(u.searchParams.get('code_challenge'), b64url(createHash('sha256').update(verifier).digest()));
    // Nur die Kennung reist mit: kein Rückziel, keine Einmal-Parameter beim
    // Anmeldedienst oder bei Discord.
    assert.equal(u.searchParams.get('redirect_to'), 'https://staging.verse-base.com/gate.html?f=' + ids[0]);
    assert.doesNotMatch(g.page.href, /token_hash|account\.html|next/);
    assert.deepEqual([...g.ls.keys()], ['vb_gate_pkce'], 'außer den Anmeldungen nichts gespeichert');
    assert.equal(g.ss.size, 0);
  });

  test('zwei Tabs: jede Anmeldung behält ihren eigenen Eintrag', async () => {
    const g = runGate({ search: '?next=%2Fpatches.html', local: flows({ [F1]: flow('A'.repeat(43), '/hangar.html') }) });
    g.getEl('gateDiscordBtn').fire('click');
    await until(() => !!g.page.href);
    const stored = JSON.parse(g.ls.get('vb_gate_pkce'));
    assert.equal(Object.keys(stored).length, 2);
    assert.equal(stored[F1].v, 'A'.repeat(43), 'die Anmeldung des anderen Tabs bleibt stehen');
  });

  test('Rücksprung in einem neuen Tab findet den Verifier (localStorage)', async () => {
    const g = runGate({ search: '?f=' + F1 + '&code=C2', local: flows({ [F1]: flow('W'.repeat(43)) }) });
    await settle();
    const tok = g.calls.find((c) => c.url.includes('grant_type=pkce'));
    assert.ok(tok, 'kein Aufruf von /auth/v1/token?grant_type=pkce');
    assert.equal(JSON.parse(tok.init.body).code_verifier, 'W'.repeat(43));
    assert.equal(g.ls.has('vb_gate_pkce'), false, 'Verifier ist verbraucht');
  });

  test('Rücksprung verbraucht nur den eigenen Eintrag', async () => {
    const g = runGate({ search: '?f=' + F1 + '&code=C2', local: flows({ [F1]: flow('W'.repeat(43)), [F2]: flow('Z'.repeat(43)) }) });
    await settle();
    assert.equal(JSON.parse(g.calls.find((c) => c.url.includes('grant_type=pkce')).init.body).code_verifier, 'W'.repeat(43));
    assert.deepEqual(Object.keys(JSON.parse(g.ls.get('vb_gate_pkce'))), [F2]);
  });

  test('abgelaufener Eintrag (älter als 15 Minuten) gilt nicht und wird weggeräumt', async () => {
    const g = runGate({ search: '?f=' + F1 + '&code=C2', local: flows({ [F1]: flow('W'.repeat(43), '/', Date.now() - 16 * 60 * 1000) }) });
    await settle();
    assert.equal(g.calls.length, 0);
    assert.equal(g.ls.has('vb_gate_pkce'), false);
    // Seit 31.10.2026 (anderes Discord-Konto im privaten Fenster): ein
    // Rücksprung mit gültiger Kennung, aber ohne Eintrag hier zeigt den
    // Rücklink fürs erste Fenster statt der Fehlermeldung. Eingelöst wird
    // trotzdem nichts (calls bleibt leer, oben).
    assert.equal(g.getEl('gateBack').hidden, false);
  });

  test('das frühere Format (bloßer Verifier) wird nicht eingelöst', async () => {
    const g = runGate({ search: '?next=%2Fpatches.html&code=C1', local: { vb_gate_pkce: 'V'.repeat(43) } });
    await settle();
    assert.equal(g.calls.length, 0);
    assert.equal(g.ls.has('vb_gate_pkce'), false);
  });

  test('das Rückziel aus dem Eintrag geht erneut durch safeNext', async () => {
    const g = runGate({ search: '?f=' + F1 + '&code=C1', local: flows({ [F1]: flow('V'.repeat(43), '/.//evil.example') }) });
    await settle();
    assert.equal(g.page.replaced, '/');
  });

  test('jeder Aufruf der Torseite räumt abgelaufene Einträge weg, laufende bleiben', async () => {
    const g = runGate({ search: '?next=%2Fx', local: flows({ [F1]: flow('A'.repeat(43), '/pilot/abc', Date.now() - 3 * 86400 * 1000), [F2]: flow('B'.repeat(43)) }) });
    await settle();
    assert.deepEqual(Object.keys(JSON.parse(g.ls.get('vb_gate_pkce'))), [F2]);
    const h = runGate({ local: flows({ [F1]: flow('A'.repeat(43), '/pilot/abc', Date.now() - 3 * 86400 * 1000) }) });
    await settle();
    assert.equal(h.ls.has('vb_gate_pkce'), false, 'nur Abgelaufenes: Schlüssel weg');
  });

  test('ein bloßer Aufruf der Torseite lässt eine laufende Anmeldung in Ruhe', async () => {
    const local = flows({ [F1]: flow('X'.repeat(43)) });
    const g = runGate({ local });
    await settle();
    assert.equal(g.ls.get('vb_gate_pkce'), local.vb_gate_pkce);
    assert.equal(g.calls.length, 0);
  });

  test('Rücksprung mit code: Einlösen mit Verifier, speichern erst nach angenommenem mint', async () => {
    const g = runGate({ search: '?f=' + F1 + '&code=C1', local: flows({ [F1]: flow('V'.repeat(43), '/patches.html') }) });
    assert.equal(g.loc.search, '?next=%2Fpatches.html', 'code und Kennung bleiben nicht in der Adresse, das Rückziel steht wieder da');
    await settle();
    const tok = g.calls.find((c) => c.url.includes('grant_type=pkce'));
    assert.ok(tok, 'kein Aufruf von /auth/v1/token?grant_type=pkce');
    assert.deepEqual(JSON.parse(tok.init.body), { auth_code: 'C1', code_verifier: 'V'.repeat(43) });
    const mint = g.calls.find((c) => c.url === '/_gate/mint');
    assert.equal(mint.init.headers.Authorization, 'Bearer AT');
    assert.equal(JSON.parse(g.ls.get('sb-test-auth-token')).access_token, 'AT');
    assert.equal(g.page.replaced, '/patches.html');
    assert.equal(g.ls.has('vb_gate_pkce'), false, 'Verifier ist verbraucht');
  });

  test('mint lehnt ab (kein Testpilot): nichts gespeichert, Hinweis', async () => {
    const g = runGate({ search: '?f=' + F1 + '&code=C1', local: flows({ [F1]: flow('V'.repeat(43)) }), answers: { mint: [403, {}] } });
    await settle();
    assert.equal(g.ls.size, 0);
    assert.equal(g.page.replaced, null);
    assert.match(g.getEl('gateDiscordStatus').textContent, /no Test Pilot access/);
  });

  test('Tokens im Fragment werden nie übernommen, nur weggeräumt', async () => {
    const g = runGate({ hash: '#access_token=A&refresh_token=R&expires_in=3600&token_type=bearer' });
    await settle();
    assert.equal(g.loc.hash, '');
    assert.equal(g.ls.size, 0);
    assert.equal(g.calls.length, 0, 'weder mint noch Token-Aufruf mit fremden Tokens');
    assert.equal(g.page.replaced, null);
  });

  test('fremde Tokens im Fragment überschreiben eine bestehende Sitzung nicht', async () => {
    const own = JSON.stringify({ access_token: 'OWN', refresh_token: 'OWNR', expires_at: 9999999999 });
    const g = runGate({ hash: '#access_token=A&refresh_token=R&expires_in=3600&token_type=bearer', local: { 'sb-test-auth-token': own } });
    await settle();
    assert.equal(g.ls.get('sb-test-auth-token'), own);
    const mints = g.calls.filter((c) => c.url === '/_gate/mint');
    assert.deepEqual(mints.map((c) => c.init.headers.Authorization), ['Bearer OWN']);
  });

  test('code ohne Verifier in diesem Browser: verworfen', async () => {
    const g = runGate({ search: '?code=FOREIGN' });
    await settle();
    assert.equal(g.calls.length, 0);
    assert.equal(g.ls.size, 0);
    assert.equal(g.loc.search, '');
    assert.match(g.getEl('gateDiscordStatus').textContent, /could not be completed/);
  });

  test('Fehler kommt bei PKCE in der Query an', async () => {
    const g = runGate({ search: '?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user' });
    await settle();
    const msg = g.getEl('gateDiscordStatus').textContent;
    assert.match(msg, /Discord did not work\. Do you already have a VerseBase account with the same e-mail\?/);
    assert.equal(g.getEl('gateDiscordStatus').innerHTML, '', 'Meldungen gehen als Text, nie als HTML');
    // Discord legt seit 29.10.2026 selbst Konten an, die E-Mail-Registrierung
    // ist pausiert: kein Verweis mehr auf register.html.
    assert.doesNotMatch(msg, /register/i);
    assert.equal(g.loc.search, '');
  });

  test('E-Mail-Anmeldung speichert ebenfalls erst nach angenommenem mint', async () => {
    const g = runGate({ answers: { mint: [403, {}] } });
    g.getEl('gateForm').fire('submit', { preventDefault() {} });
    await settle();
    assert.ok(g.calls.some((c) => c.url.includes('grant_type=password')));
    assert.equal(g.ls.size, 0);
  });
});

describe('Torseite: gespeicherte Sitzung wird erneuert', () => {
  const now = () => Math.floor(Date.now() / 1000);
  const stored = (o) => ({ 'sb-test-auth-token': JSON.stringify({ access_token: 'OLD', refresh_token: 'OLDR', token_type: 'bearer', ...o }) });
  const mintsOf = (g) => g.calls.filter((c) => c.url === '/_gate/mint').map((c) => c.init.headers.Authorization);
  const refreshes = (g) => g.calls.filter((c) => c.url.includes('grant_type=refresh_token'));

  test('abgelaufenes Zugangstoken: erst erneuern, zurückschreiben, dann mint mit dem neuen', async () => {
    const g = runGate({ search: '?next=%2Fpilot%2Fabc', local: stored({ expires_at: now() - 600 }) });
    await settle();
    assert.equal(refreshes(g).length, 1);
    assert.deepEqual(JSON.parse(refreshes(g)[0].init.body), { refresh_token: 'OLDR' });
    assert.deepEqual(mintsOf(g), ['Bearer NEW']);
    const saved = JSON.parse(g.ls.get('sb-test-auth-token'));
    assert.equal(saved.refresh_token, 'NEWR', 'rotiertes refresh_token liegt wieder in der Ablage');
    assert.ok(saved.expires_at > now(), 'expires_at ergänzt');
    assert.equal(g.page.replaced, '/pilot/abc');
  });

  test('noch gültiges Token: kein Refresh, direkt mint', async () => {
    const g = runGate({ local: stored({ expires_at: now() + 1800 }) });
    await settle();
    assert.equal(refreshes(g).length, 0);
    assert.deepEqual(mintsOf(g), ['Bearer OLD']);
  });

  test('refresh_token abgelehnt: Sitzung weg, kein mint mit dem toten Token', async () => {
    const g = runGate({ local: stored({ expires_at: now() - 600 }), answers: { refresh: [400, { error: 'invalid_grant' }] } });
    await settle();
    assert.equal(g.ls.has('sb-test-auth-token'), false);
    assert.deepEqual(mintsOf(g), []);
    assert.equal(g.page.replaced, null);
    assert.match(g.getEl('gateDiscordStatus').textContent, /sign-in has expired/);
  });

  test('Serverfehler beim Refresh: Sitzung bleibt liegen, kein mint mit abgelaufenem Token', async () => {
    const g = runGate({ local: stored({ expires_at: now() - 600 }), answers: { refresh: [503, {}] } });
    await settle();
    assert.equal(JSON.parse(g.ls.get('sb-test-auth-token')).refresh_token, 'OLDR');
    assert.deepEqual(mintsOf(g), []);
    assert.match(g.getEl('gateDiscordStatus').textContent, /Could not renew/);
  });

  test('anderer Tab erneuert gerade: kein zweiter Refresh, dessen Ergebnis wird genommen', async () => {
    const local = { ...stored({ expires_at: now() - 600 }), 'sb-lite-refresh-lock': String(Date.now()) };
    const g = runGate({ local });
    // Der andere Tab schreibt waehrend der Wartezeit die erneuerte Sitzung.
    g.ls.set('sb-test-auth-token', JSON.stringify({ access_token: 'TAB', refresh_token: 'TABR', expires_at: now() + 3600 }));
    await new Promise((r) => setTimeout(r, 1700));
    assert.equal(refreshes(g).length, 0);
    assert.deepEqual(mintsOf(g), ['Bearer TAB']);
  });

  test('Token nach der Uhr gültig, vom Anmeldedienst abgewiesen: einmal erneuern, dann hinein', async () => {
    const g = runGate({ search: '?next=%2Fpatches.html', local: stored({ expires_at: now() + 1800 }), answers: { mint: (a) => (a === 'Bearer NEW' ? [204, {}] : [403, { ok: false, grund: 'kein-zugang' }]) } });
    await settle();
    assert.deepEqual(mintsOf(g), ['Bearer OLD', 'Bearer NEW']);
    assert.equal(refreshes(g).length, 1);
    assert.equal(JSON.parse(g.ls.get('sb-test-auth-token')).access_token, 'NEW');
    assert.equal(g.page.replaced, '/patches.html');
  });

  test('abgewiesen, Erneuern scheitert am Server: kein zweites mint mit demselben Token', async () => {
    const g = runGate({ local: stored({ expires_at: now() + 1800 }), answers: { mint: [403, { ok: false, grund: 'kein-zugang' }], refresh: [503, {}] } });
    await settle();
    assert.deepEqual(mintsOf(g), ['Bearer OLD']);
    assert.equal(refreshes(g).length, 1);
    assert.match(g.getEl('gateDiscordStatus').textContent, /Could not renew/);
  });

  test('abgewiesen auch nach dem Erneuern: Hinweis, kein dritter Versuch', async () => {
    const g = runGate({ local: stored({ expires_at: now() + 1800 }), answers: { mint: [403, { ok: false, grund: 'kein-zugang' }] } });
    await settle();
    assert.deepEqual(mintsOf(g), ['Bearer OLD', 'Bearer NEW']);
    assert.match(g.getEl('gateDiscordStatus').textContent, /expired/);
  });

  test('kein Testpilot: kein Erneuern, Hinweis', async () => {
    const g = runGate({ local: stored({ expires_at: now() + 1800 }), answers: { mint: [403, { ok: false, grund: 'kein-testpilot' }] } });
    await settle();
    assert.equal(refreshes(g).length, 0);
    assert.match(g.getEl('gateDiscordStatus').textContent, /no Test Pilot access/);
  });

  test('gültige Sitzung ohne Testpilot-Zugang: Hinweis statt Stille', async () => {
    const g = runGate({ local: stored({ expires_at: now() + 1800 }), answers: { mint: [403, {}] } });
    await settle();
    assert.match(g.getEl('gateDiscordStatus').textContent, /no Test Pilot access/);
    assert.equal(g.page.replaced, null);
  });
});

describe('Rücksprungziel ?next= bleibt auf der eigenen Origin', () => {
  const ORIGIN = 'https://staging.verse-base.com';
  const FREMD = ['/.//evil.example', '/..//evil.example', '/%2e//evil.example', '/./\\evil.example', '/x/..//evil.example', '//evil.example', '/\\evil.example', 'https://evil.example/', '\t/evil.example'];
  const GUT = [['/pilot/star_runner?ref=discord', '/pilot/star_runner?ref=discord'], ['/schiffe/a.html?x=1#y', '/schiffe/a.html?x=1#y'], ['/de/pilot/x', '/de/pilot/x'], ['/', '/']];

  test('src/lib/safe-next.ts: fremde Ziele -> Rückfall, eigene bleiben', async () => {
    const { safeNext } = await loadTs('src/lib/safe-next.ts');
    for (const raw of FREMD) assert.equal(safeNext(raw, ORIGIN, '/dash'), '/dash', raw);
    for (const [raw, soll] of GUT) assert.equal(safeNext(raw, ORIGIN, '/dash'), soll, raw);
    assert.equal(safeNext('', ORIGIN, '/dash'), '/dash');
  });

  test('Torseite: mit Sitzung springt sie nie auf einen fremden Host', async () => {
    for (const raw of FREMD) {
      const g = runGate({ search: '?next=' + encodeURIComponent(raw), local: { 'sb-test-auth-token': JSON.stringify({ access_token: 'AT', refresh_token: 'R', expires_at: 9999999999 }) } });
      await settle();
      assert.equal(g.page.replaced, '/', raw);
    }
  });

  test('Torseite: Pfad und Query aus ?next= kommen unverändert an', async () => {
    for (const [raw, soll] of GUT) {
      const g = runGate({ search: '?next=' + encodeURIComponent(raw), local: { 'sb-test-auth-token': JSON.stringify({ access_token: 'AT', refresh_token: 'R', expires_at: 9999999999 }) } });
      await settle();
      assert.equal(g.page.replaced, soll, raw);
    }
  });

  test('AuthLogin.astro nutzt die gemeinsame Regel', () => {
    const s = fs.readFileSync(path.resolve('src/components/account/AuthLogin.astro'), 'utf8');
    assert.match(s, /import \{ safeNext \} from '\.\.\/\.\.\/lib\/safe-next';/);
    assert.match(s, /const next = safeNext\(rawNext, location\.origin, D\.dash!\);/);
  });
});
