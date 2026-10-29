// Haelt das Verhalten der Edge Function verify-rsi fest.
//
// Geprueft wird der ausgelieferte Code selbst: supabase/functions/verify-rsi/
// handler.js ist reines JavaScript, index.ts reicht nur Deno.env und fetch
// hinein. Hier bekommt der Handler stattdessen eine Attrappe fuer fetch, die
// Auth, die RPCs und die RSI-Seite spielt und Buch fuehrt, was abgerufen wurde.
//
// Die Zusicherungen, auf die sich Dashboard und Datenbank verlassen:
//   * Handle und Code fuer die Pruefung kommen aus der Datenbank, nicht aus
//     der Anfrage (ausser fuer das alte Dashboard mit RSI_LEGACY_FLOW=1).
//   * Drosselung, Zeitlimit, Fremdhost, Riesenseite, fremde Zwischenseite:
//     immer Nicht-2xx. Das alte Dashboard entzieht nur bei 200 mit
//     verified:false; auf Nicht-2xx tut es nichts.
//   * Kein Abruf bei RSI ohne Sitzung, mit ungueltigem Handle oder gedrosselt.
//   * CORS nur fuer die eigenen Herkuenfte, keine Fehlertexte in Antworten.
//   * Das Dashboard erzeugt keinen Code mehr selbst.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createHandler,
  pageVerdict,
  bioSection,
  isProfileUrl,
  readBounded,
  MAX_PAGE_BYTES,
  RSI_TIMEOUT_MS,
} from '../../supabase/functions/verify-rsi/handler.js';

const USER = '11111111-1111-4111-8111-111111111111';
const CODE = 'VB-3F9A-C21B-7D04';
const SB = 'https://proj.supabase.co';

/** Citizen-Seite im Aufbau von RSI: Handle-Zeile, Organisation mit Rang, Bio. */
function page({ handle = 'Pilot_One', bio = '', orgRank = 'Member' } = {}) {
  return `<!doctype html><html><head><title>${handle} | Roberts Space Industries</title></head><body>
<div class="profile left-col"><div class="info">
<p class="entry"><strong class="value">Moniker</strong></p>
<p class="entry"><span class="label">Handle name</span><strong class="value">${handle}</strong></p>
</div></div>
<div class="main-org right-col"><div class="info"><p class="entry"><span class="label">Organization rank</span><strong class="value">${orgRank}</strong></p></div></div>
<div class="entry bio"><span class="label">Bio</span><div class="value">${bio}</div></div>
<p class="entry"><span class="label">Enlisted</span><strong class="value">Jan 1, 2950</strong></p>
</body></html>`;
}

function response(status, body, { url, headers } = {}) {
  const res = new Response(body, { status, headers: headers || { 'Content-Type': 'text/html' } });
  if (url !== undefined) Object.defineProperty(res, 'url', { value: url });
  return res;
}
const json = (status, v) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * world(opts) — Attrappe fuer Auth, RPCs und RSI.
 *   rpc: { rsi_rate_ok, rsi_challenge_issue, rsi_challenge_get, rsi_challenge_result }
 *        Wert oder (args) => Wert; ein Error wird geworfen, eine Zahl als HTTP-Status beantwortet.
 *   rsi: (url, init) => Response | Promise<Response>
 */
function world({ rpc = {}, rsi, auth = 200, env = {} } = {}) {
  const calls = { auth: [], rpc: [], rsi: [] };
  const R = {
    rsi_rate_ok: true,
    rsi_challenge_issue: { rsi_handle: 'Pilot_One', code: CODE, confirmed: false, expires_at: '2026-10-31T12:00:00Z' },
    rsi_challenge_get: {
      rsi_handle: 'Pilot_One', code: CODE, expired: false, confirmed: false,
      checked_recently: false, profile_verified: false, profile_code: null,
    },
    rsi_challenge_result: 'verified',
    ...rpc,
  };
  const fetchImpl = async (url, init = {}) => {
    if (url === `${SB}/auth/v1/user`) {
      calls.auth.push(init);
      return auth === 200 ? json(200, { id: USER }) : json(auth, { msg: 'nope' });
    }
    const m = /^https:\/\/proj\.supabase\.co\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (m) {
      const args = JSON.parse(init.body);
      calls.rpc.push({ fn: m[1], args, init });
      const r = R[m[1]];
      const v = typeof r === 'function' ? r(args) : r;
      if (v instanceof Error) throw v;
      if (typeof v === 'number') return json(v, { message: 'db says no' });
      return json(200, v);
    }
    if (url.startsWith('https://robertsspaceindustries.com/')) {
      calls.rsi.push({ url, init });
      return (rsi || (() => response(200, page({ bio: `Hi ${CODE}` }), { url })))(url, init);
    }
    throw new Error('unerwartete Adresse ' + url);
  };
  const logs = [];
  const handler = createHandler({
    env: (k) => ({
      SUPABASE_URL: SB,
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      ...env,
    })[k],
    fetch: fetchImpl,
    log: (...a) => logs.push(a.join(' ')),
  });
  const call = async (body, { origin = 'https://staging.verse-base.com', authz = 'Bearer eyJhbGciOi.eyJzdWIi.sig', method = 'POST', raw } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (origin) headers.Origin = origin;
    if (authz) headers.Authorization = authz;
    const res = await handler(new Request(`${SB}/functions/v1/verify-rsi`, {
      method,
      headers,
      body: method === 'POST' ? (raw !== undefined ? raw : JSON.stringify(body)) : undefined,
    }));
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers, text };
  };
  const fns = () => calls.rpc.map((c) => c.fn);
  return { call, calls, fns, logs };
}

describe('verify-rsi: Zugang, CORS, Antworten', () => {
  test('CORS: eigene Herkunft wird gespiegelt, fremde nicht, nie "*"', async () => {
    const w = world();
    for (const o of ['https://verse-base.com', 'https://www.verse-base.com', 'https://staging.verse-base.com']) {
      const r = await w.call({ action: 'challenge', rsi_handle: 'Pilot_One' }, { origin: o });
      assert.strictEqual(r.headers.get('access-control-allow-origin'), o);
      assert.match(r.headers.get('vary') || '', /Origin/);
    }
    const r = await w.call({ action: 'challenge', rsi_handle: 'Pilot_One' }, { origin: 'https://evil.example' });
    assert.strictEqual(r.headers.get('access-control-allow-origin'), 'https://verse-base.com');
  });

  test('OPTIONS beantwortet den Preflight ohne Sitzung und ohne Abruf', async () => {
    const w = world();
    const r = await w.call(null, { method: 'OPTIONS', authz: null });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers.get('access-control-allow-origin'), 'https://staging.verse-base.com');
    assert.match(r.headers.get('access-control-allow-headers'), /authorization/);
    assert.deepStrictEqual([w.calls.auth.length, w.calls.rpc.length, w.calls.rsi.length], [0, 0, 0]);
  });

  test('ohne Sitzung: 401, kein RPC, kein Abruf bei RSI', async () => {
    const w = world();
    assert.strictEqual((await w.call({ rsi_handle: 'Pilot_One' }, { authz: null })).status, 401);
    const w2 = world({ auth: 401 });
    assert.strictEqual((await w2.call({ rsi_handle: 'Pilot_One' })).status, 401);
    assert.deepStrictEqual([w2.calls.rpc.length, w2.calls.rsi.length], [0, 0]);
  });

  test('ungueltiges Handle: 400 vor Drosselung und Abruf', async () => {
    for (const h of ['..', 'a', 'Bob RSI', 'x'.repeat(61), '../../account', 42, { x: 1 }]) {
      const w = world();
      const r = await w.call({ action: 'challenge', rsi_handle: h });
      assert.strictEqual(r.status, 400, `Handle ${JSON.stringify(h)}`);
      assert.deepStrictEqual(r.data, { error: 'invalid_handle' });
      assert.deepStrictEqual([w.calls.rpc.length, w.calls.rsi.length], [0, 0]);
    }
  });

  test('zu grosse oder kaputte Anfrage: 413 bzw. 400', async () => {
    const w = world();
    assert.strictEqual((await w.call(null, { raw: JSON.stringify({ rsi_handle: 'x'.repeat(5000) }) })).status, 413);
    assert.strictEqual((await w.call(null, { raw: '{nope' })).status, 400);
    assert.strictEqual((await w.call(null, { raw: '[1,2]' })).status, 400);
    assert.strictEqual((await w.call({ action: 'delete' })).status, 400);
  });

  test('gedrosselt: 429 mit Retry-After, ohne verified-Feld, kein Abruf', async () => {
    const w = world({ rpc: { rsi_rate_ok: false } });
    const r = await w.call({ rsi_handle: 'Pilot_One' });
    assert.strictEqual(r.status, 429);
    assert.deepStrictEqual(r.data, { error: 'rate_limited' });
    assert.strictEqual(r.headers.get('retry-after'), '3600');
    assert.strictEqual(w.calls.rsi.length, 0);
    assert.deepStrictEqual(w.fns(), ['rsi_rate_ok']);
  });

  test('interne Fehler: 500 mit fester Kennung, ohne Fehlertext', async () => {
    const w = world({ rpc: { rsi_challenge_get: new Error('geheime Interna: connection to 10.0.0.5 refused') } });
    const r = await w.call({ rsi_handle: 'Pilot_One' });
    assert.strictEqual(r.status, 500);
    assert.deepStrictEqual(r.data, { error: 'internal' });
    assert.ok(!r.text.includes('geheime'), 'Fehlertext in der Antwort');
    assert.ok(w.logs.some((l) => l.includes('geheime')), 'Fehlertext gehoert ins Log');
    const w2 = world({ rpc: { rsi_rate_ok: 503 } });
    const r2 = await w2.call({ rsi_handle: 'Pilot_One' });
    assert.strictEqual(r2.status, 500);
    assert.ok(!r2.text.includes('db says no'));
  });

  test('ohne Konfiguration: 503 statt Absturz', async () => {
    const w = world({ env: { SUPABASE_SERVICE_ROLE_KEY: '' } });
    assert.strictEqual((await w.call({ rsi_handle: 'Pilot_One' })).status, 503);
  });
});

describe('verify-rsi: Code vom Server', () => {
  test('challenge: Code kommt aus rsi_challenge_issue, fuer genau dieses Konto und Handle', async () => {
    const w = world();
    const r = await w.call({ action: 'challenge', rsi_handle: '@Pilot_One ', rsi_code: 'VB-AAAA-AAAA-AAAA' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.data, { rsi_handle: 'Pilot_One', code: CODE, confirmed: false, expires_at: '2026-10-31T12:00:00Z' });
    const issue = w.calls.rpc.find((c) => c.fn === 'rsi_challenge_issue');
    assert.deepStrictEqual(issue.args, { p_user: USER, p_handle: 'Pilot_One' });
    assert.strictEqual(issue.init.headers.Authorization, 'Bearer service-key');
    assert.strictEqual(w.calls.rsi.length, 0, 'Code holen ruft RSI nicht ab');
  });

  test('verify: Handle und Code aus der Datenbank, Werte aus der Anfrage zaehlen nicht', async () => {
    // Die Seite traegt den Code aus der Anfrage, aber nicht den gespeicherten.
    const w = world({
      rpc: { rsi_challenge_result: (a) => (a.p_found ? 'verified' : 'not_found') },
      rsi: (url) => response(200, page({ bio: 'VB-1111-2222-3333' }), { url }),
    });
    const r = await w.call({ action: 'verify', rsi_handle: 'Pilot_One', rsi_code: 'VB-1111-2222-3333' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.verified, false);
    const res = w.calls.rpc.find((c) => c.fn === 'rsi_challenge_result');
    assert.deepStrictEqual(res.args, { p_user: USER, p_handle: 'Pilot_One', p_code: CODE, p_found: false });
  });

  test('verify: gefunden -> verified, gespeichert ueber rsi_challenge_result', async () => {
    const w = world();
    const r = await w.call({ action: 'verify', rsi_handle: 'Pilot_One' });
    assert.deepStrictEqual([r.status, r.data], [200, { verified: true, persisted: true, rsi_handle: 'Pilot_One' }]);
    assert.deepStrictEqual(w.fns(), ['rsi_rate_ok', 'rsi_challenge_get', 'rsi_challenge_result']);
    assert.strictEqual(w.calls.rsi[0].url, 'https://robertsspaceindustries.com/citizens/Pilot_One');
  });

  test('verify ohne Handle nimmt das Handle aus dem Profil (Nachpruefung)', async () => {
    const w = world();
    await w.call({ action: 'verify' });
    assert.deepStrictEqual(w.calls.rpc.find((c) => c.fn === 'rsi_challenge_get').args, { p_user: USER, p_handle: null });
  });

  test('kein Code, abgelaufen, gewechselt, Handle vergeben: Nicht-2xx', async () => {
    const cases = [
      [{ rsi_challenge_get: { rsi_handle: 'Pilot_One', code: null, profile_verified: false } }, 409, 'no_challenge'],
      [{ rsi_challenge_get: { rsi_handle: null } }, 409, 'no_handle'],
      [{ rsi_challenge_get: { rsi_handle: 'Bad Handle', code: CODE } }, 409, 'invalid_handle'],
      [{ rsi_challenge_get: { rsi_handle: 'Pilot_One', code: CODE, expired: true } }, 410, 'challenge_expired'],
      [{ rsi_challenge_result: 'stale' }, 409, 'challenge_changed'],
      [{ rsi_challenge_result: 'taken' }, 409, 'handle_taken'],
      [{ rsi_challenge_result: 'no_profile' }, 409, 'no_profile'],
    ];
    for (const [rpc, status, error] of cases) {
      const r = await world({ rpc }).call({ rsi_handle: 'Pilot_One' });
      assert.deepStrictEqual([r.status, r.data], [status, { error }], error);
    }
  });

  test('nicht gefunden beim verifizierten Handle: 200 verified:false, revoked', async () => {
    const w = world({
      rpc: { rsi_challenge_result: 'revoked' },
      rsi: (url) => response(200, page({ bio: 'nichts' }), { url }),
    });
    const r = await w.call({ action: 'verify' });
    assert.deepStrictEqual([r.status, r.data], [200, { verified: false, persisted: true, revoked: true, rsi_handle: 'Pilot_One' }]);
  });

  test('frische Nachpruefung (unter 6 h) ruft RSI nicht ab', async () => {
    const w = world({ rpc: { rsi_challenge_get: { rsi_handle: 'Pilot_One', code: CODE, confirmed: true, checked_recently: true, profile_verified: true, profile_code: CODE } } });
    const r = await w.call({ action: 'verify' });
    assert.deepStrictEqual([r.status, r.data.verified, r.data.cached], [200, true, true]);
    assert.strictEqual(w.calls.rsi.length, 0);
  });
});

describe('verify-rsi: verifiziertes Konto mit offenem neuem Code', () => {
  // Das Abzeichen haengt am Altcode; im Dialog wurde ein neuer Code geholt,
  // der (noch) nicht in der Bio steht.
  const OLD = 'VERSEBASE-VERIFY-AB12CD';
  const get = { rsi_handle: 'Pilot_One', code: CODE, expired: false, confirmed: false, checked_recently: true, profile_verified: true, profile_code: OLD };
  const outcome = (a) => (a.p_code === OLD ? (a.p_found ? 'verified' : 'revoked') : (a.p_found ? 'verified' : 'not_found'));

  test('neuer Code fehlt, Altcode steht noch: Abzeichen bleibt (Nachpruefung mit dem Altcode)', async () => {
    const w = world({ rpc: { rsi_challenge_get: get, rsi_challenge_result: outcome }, rsi: (url) => response(200, page({ bio: OLD }), { url }) });
    const r = await w.call({ action: 'verify' });
    assert.deepStrictEqual([r.status, r.data.verified], [200, true]);
    assert.deepStrictEqual(w.calls.rpc.find((c) => c.fn === 'rsi_challenge_result').args, { p_user: USER, p_handle: 'Pilot_One', p_code: OLD, p_found: true });
    assert.strictEqual(w.calls.rsi.length, 1, 'ein Abruf fuer beide Codes');
  });

  test('neuer Code steht in der Bio: er wird verifiziert', async () => {
    const w = world({ rpc: { rsi_challenge_get: get, rsi_challenge_result: outcome }, rsi: (url) => response(200, page({ bio: CODE }), { url }) });
    const r = await w.call({ action: 'verify', rsi_handle: 'Pilot_One' });
    assert.deepStrictEqual([r.status, r.data.verified], [200, true]);
    assert.strictEqual(w.calls.rpc.find((c) => c.fn === 'rsi_challenge_result').args.p_code, CODE);
  });

  test('beide fehlen: entzogen wird ueber den Code, an dem das Abzeichen hing', async () => {
    const w = world({ rpc: { rsi_challenge_get: get, rsi_challenge_result: outcome }, rsi: (url) => response(200, page({ bio: 'nichts' }), { url }) });
    const r = await w.call({ action: 'verify' });
    assert.deepStrictEqual([r.status, r.data.revoked], [200, true]);
    assert.deepStrictEqual(w.calls.rpc.find((c) => c.fn === 'rsi_challenge_result').args, { p_user: USER, p_handle: 'Pilot_One', p_code: OLD, p_found: false });
  });

  test('neuer Code abgelaufen: Nachpruefung mit dem Altcode statt 410', async () => {
    const w = world({ rpc: { rsi_challenge_get: { ...get, expired: true }, rsi_challenge_result: outcome }, rsi: (url) => response(200, page({ bio: OLD }), { url }) });
    const r = await w.call({ action: 'verify' });
    assert.deepStrictEqual([r.status, r.data.verified], [200, true]);
    assert.strictEqual(w.calls.rpc.find((c) => c.fn === 'rsi_challenge_result').args.p_code, OLD);
  });

  test('offener neuer Code: kein Ergebnis aus dem Zwischenspeicher', async () => {
    const w = world({ rpc: { rsi_challenge_get: { ...get, confirmed: true }, rsi_challenge_result: outcome }, rsi: (url) => response(200, page({ bio: OLD }), { url }) });
    await w.call({ action: 'verify' });
    assert.strictEqual(w.calls.rsi.length, 1);
  });
});

describe('verify-rsi: alter Ablauf (main bis zum naechsten Release)', () => {
  const legacyGet = { rsi_handle: 'Pilot_One', code: null, profile_verified: false, profile_code: null };
  const legacyPage = (url) => response(200, page({ bio: 'VERSEBASE-VERIFY-AB12CD' }), { url });

  test('Code aus der Anfrage ohne RSI_LEGACY_FLOW: 409, kein Abruf', async () => {
    const w = world({ rpc: { rsi_challenge_get: legacyGet }, rsi: legacyPage });
    const r = await w.call({ rsi_handle: 'Pilot_One', rsi_code: 'VERSEBASE-VERIFY-AB12CD' });
    assert.deepStrictEqual([r.status, r.data], [409, { error: 'no_challenge' }]);
    assert.strictEqual(w.calls.rsi.length, 0);
  });

  test('mit RSI_LEGACY_FLOW=1: nur das alte Format, gespeichert ueber rsi_challenge_result', async () => {
    const w = world({ rpc: { rsi_challenge_get: legacyGet }, rsi: legacyPage, env: { RSI_LEGACY_FLOW: '1' } });
    const r = await w.call({ rsi_handle: 'Pilot_One', rsi_code: 'VERSEBASE-VERIFY-AB12CD' });
    assert.deepStrictEqual([r.status, r.data.verified], [200, true]);
    assert.strictEqual(w.calls.rpc.find((c) => c.fn === 'rsi_challenge_result').args.p_code, 'VERSEBASE-VERIFY-AB12CD');
    // Ein Praefix eines fremden Altcodes in der Bio ist kein Treffer.
    const w3 = world({ rpc: { rsi_challenge_get: legacyGet, rsi_challenge_result: (a) => (a.p_found ? 'verified' : 'not_found') }, rsi: legacyPage, env: { RSI_LEGACY_FLOW: '1' } });
    const r3 = await w3.call({ rsi_handle: 'Pilot_One', rsi_code: 'VERSEBASE-VERIFY-AB12' });
    assert.deepStrictEqual([r3.status, r3.data.verified], [200, false]);
    assert.strictEqual(w3.calls.rpc.find((c) => c.fn === 'rsi_challenge_result').args.p_found, false);
    for (const code of ['<html', ' ', 'Pilot_One', 'VB-1111-2222-3333', 'VERSEBASE-VERIFY-', 'versebase-verify-ab12cd']) {
      const w2 = world({ rpc: { rsi_challenge_get: legacyGet }, rsi: legacyPage, env: { RSI_LEGACY_FLOW: '1' } });
      const r2 = await w2.call({ rsi_handle: 'Pilot_One', rsi_code: code });
      assert.strictEqual(r2.status, 409, `Code ${JSON.stringify(code)}`);
      assert.strictEqual(w2.calls.rsi.length, 0);
    }
  });

  test('Altfall (vor dem Umbau verifiziert): Nachpruefung mit dem Code aus dem Profil, auch ohne Schalter', async () => {
    const w = world({
      rpc: { rsi_challenge_get: { rsi_handle: 'Pilot_One', code: null, profile_verified: true, profile_code: 'VERSEBASE-VERIFY-AB12CD' } },
      rsi: legacyPage,
    });
    const r = await w.call({ rsi_handle: 'Pilot_One', rsi_code: 'VERSEBASE-VERIFY-ZZZZZZ' });
    assert.deepStrictEqual([r.status, r.data.verified], [200, true]);
    assert.strictEqual(w.calls.rpc.find((c) => c.fn === 'rsi_challenge_result').args.p_code, 'VERSEBASE-VERIFY-AB12CD');
  });
});

describe('verify-rsi: Abruf bei RSI', () => {
  test('mit Zeitlimit und Weiterleitung "follow" (nicht "error")', async () => {
    const w = world();
    await w.call({ rsi_handle: 'Pilot_One' });
    const { init } = w.calls.rsi[0];
    assert.ok(init.signal instanceof AbortSignal, 'kein AbortSignal');
    assert.strictEqual(init.redirect, 'follow');
    assert.strictEqual(RSI_TIMEOUT_MS, 8000);
  });

  test('Zeitlimit: 504, nichts festgehalten', async () => {
    const w = world({ rsi: () => { throw new DOMException('signal timed out', 'TimeoutError'); } });
    const r = await w.call({ rsi_handle: 'Pilot_One' });
    assert.deepStrictEqual([r.status, r.data], [504, { error: 'rsi_timeout' }]);
    assert.ok(!w.fns().includes('rsi_challenge_result'));
  });

  test('Netzfehler, 5xx, 404: Nicht-2xx, nichts festgehalten', async () => {
    const cases = [
      [() => { throw new TypeError('fetch failed'); }, 502, 'rsi_unreachable'],
      [(url) => response(503, 'busy', { url }), 502, 'rsi_unreachable'],
      [(url) => response(404, 'not found', { url }), 404, 'rsi_profile_not_found'],
    ];
    for (const [rsi, status, error] of cases) {
      const w = world({ rsi });
      const r = await w.call({ rsi_handle: 'Pilot_One' });
      assert.deepStrictEqual([r.status, r.data], [status, { error }]);
      assert.ok(!w.fns().includes('rsi_challenge_result'));
    }
  });

  test('Weiterleitung auf einen anderen Host oder eine andere Seite: 502', async () => {
    for (const final of [
      'https://evil.example/citizens/Pilot_One',
      'http://robertsspaceindustries.com/citizens/Pilot_One',
      'https://robertsspaceindustries.com/',
      'https://robertsspaceindustries.com/citizens/Someone_Else',
    ]) {
      const w = world({ rsi: () => response(200, page({ bio: CODE }), { url: final }) });
      const r = await w.call({ rsi_handle: 'Pilot_One' });
      assert.deepStrictEqual([r.status, r.data], [502, { error: 'rsi_unexpected' }], final);
      assert.ok(!w.fns().includes('rsi_challenge_result'));
    }
    // Kanonische Schreibweise und Sprachpfad auf demselben Host sind in Ordnung.
    for (const final of ['https://robertsspaceindustries.com/citizens/pilot_one', 'https://robertsspaceindustries.com/en/citizens/Pilot_One/']) {
      assert.ok(isProfileUrl(final, 'Pilot_One'), final);
    }
  });

  test('Seite ueber 2 MB: 502, gelesen wird hoechstens bis zur Grenze', async () => {
    let pulled = 0;
    const chunk = new Uint8Array(64 * 1024).fill(0x41);
    const stream = new ReadableStream({
      pull(ctrl) {
        if (pulled >= 6 * 1024 * 1024) { ctrl.close(); return; }
        pulled += chunk.byteLength;
        ctrl.enqueue(chunk);
      },
    });
    const w = world({ rsi: (url) => response(200, stream, { url }) });
    const r = await w.call({ rsi_handle: 'Pilot_One' });
    assert.deepStrictEqual([r.status, r.data], [502, { error: 'rsi_too_large' }]);
    assert.ok(pulled <= MAX_PAGE_BYTES + 3 * chunk.byteLength, `gelesen: ${pulled}`);
    const w2 = world({ rsi: (url) => response(200, 'x', { url, headers: { 'Content-Length': String(MAX_PAGE_BYTES + 1) } }) });
    assert.strictEqual((await w2.call({ rsi_handle: 'Pilot_One' })).status, 502);
    assert.strictEqual(await readBounded(new Response('abc').body, 3), 'abc');
    assert.strictEqual(await readBounded(new Response('abcd').body, 3), null);
  });

  test('Zwischenseite oder Seite ohne Bio: 502, weder verifiziert noch entzogen', async () => {
    const bodies = [
      '<html><head><title>Just a moment...</title></head><body>Pilot_One<div class="entry bio"></div></body></html>',
      '<html><body><script>window._cf_chl_opt={}</script>Pilot_One</body></html>',
      '<html><body>Pilot_One, aber ohne Bio-Abschnitt ' + CODE + '</body></html>',
      page({ handle: 'Jemand_Anders', bio: CODE }).replace(/Pilot_One/g, ''),
    ];
    for (const b of bodies) {
      const w = world({ rsi: (url) => response(200, b, { url }) });
      const r = await w.call({ rsi_handle: 'Pilot_One' });
      assert.deepStrictEqual([r.status, r.data], [502, { error: 'rsi_unrecognized' }]);
      assert.ok(!w.fns().includes('rsi_challenge_result'));
    }
  });
});

describe('verify-rsi: wo der Code stehen muss', () => {
  test('nur im Bio-Abschnitt zaehlt er, nicht im Rang der Organisation', () => {
    assert.strictEqual(pageVerdict(page({ bio: `Hallo ${CODE}` }), CODE, 'Pilot_One'), 'found');
    assert.strictEqual(pageVerdict(page({ bio: `hallo ${CODE.toLowerCase()}` }), CODE, 'Pilot_One'), 'found');
    assert.strictEqual(pageVerdict(page({ orgRank: CODE, bio: 'nichts' }), CODE, 'Pilot_One'), 'elsewhere');
    assert.strictEqual(pageVerdict(page({ bio: '' }), CODE, 'Pilot_One'), 'missing');
  });

  test('der Code zaehlt nur als ganzes Wort: ein kuerzerer Altcode ist kein Treffer im laengeren', () => {
    const bio = page({ bio: 'Mein Code: VERSEBASE-VERIFY-AB12CD.' });
    assert.strictEqual(pageVerdict(bio, 'VERSEBASE-VERIFY-AB12CD', 'Pilot_One'), 'found');
    assert.strictEqual(pageVerdict(bio, 'VERSEBASE-VERIFY-AB12', 'Pilot_One'), 'missing');
    assert.strictEqual(pageVerdict(bio, 'VERSEBASE-VERIFY-A', 'Pilot_One'), 'missing');
    assert.strictEqual(pageVerdict(page({ bio: `${CODE}x` }), CODE, 'Pilot_One'), 'missing');
    assert.strictEqual(pageVerdict(page({ bio: `<p>${CODE}</p>` }), CODE, 'Pilot_One'), 'found');
    assert.strictEqual(pageVerdict(page({ bio: `${CODE.slice(0, -1)}X ${CODE}` }), CODE, 'Pilot_One'), 'found');
  });

  test('der Bio-Abschnitt endet am naechsten Eintrag', () => {
    const html = page({ bio: 'nichts' }).replace('Jan 1, 2950', CODE);
    assert.strictEqual(pageVerdict(html, CODE, 'Pilot_One'), 'elsewhere');
    assert.ok(bioSection(html).includes('nichts'));
    assert.strictEqual(bioSection('<div class="entry">x</div>'), null);
    assert.ok(bioSection("<div class='bio entry'><div class=\"value\">x</div></div>").includes('x'));
    // "entry-value" ist kein "entry": der Abschnitt endet dort nicht.
    assert.ok(bioSection('<div class="entry bio"><div class="value entry-value">abc</div></div><p class="entry">z</p>').includes('abc'));
  });

  test('Ersatzmarke: Beschriftung "Bio", wenn die Klasse "entry bio" fehlt', () => {
    const alt = page({ bio: `Hi ${CODE}`, orgRank: 'Boss' }).replace('class="entry bio"', 'class="entry"');
    assert.strictEqual(pageVerdict(alt, CODE, 'Pilot_One'), 'found');
    const altOrg = page({ bio: 'nichts', orgRank: CODE }).replace('class="entry bio"', 'class="entry"');
    assert.strictEqual(pageVerdict(altOrg, CODE, 'Pilot_One'), 'elsewhere');
    assert.strictEqual(bioSection('<p class="entry"><span class="label">Biography</span>x</p>'), null);
  });

  test('Code nur ausserhalb der Bio: neue Verifizierung 200 verified:false, Nachpruefung 409 ohne Ergebnis', async () => {
    const w = world({
      rpc: { rsi_challenge_result: (a) => (a.p_found ? 'verified' : 'not_found') },
      rsi: (url) => response(200, page({ orgRank: CODE, bio: 'nichts' }), { url }),
    });
    const r = await w.call({ action: 'verify', rsi_handle: 'Pilot_One' });
    assert.deepStrictEqual([r.status, r.data.verified], [200, false]);
    assert.strictEqual(w.calls.rpc.find((c) => c.fn === 'rsi_challenge_result').args.p_found, false);
    const w2 = world({
      rpc: { rsi_challenge_get: { rsi_handle: 'Pilot_One', code: CODE, confirmed: true, checked_recently: false, profile_verified: true, profile_code: CODE } },
      rsi: (url) => response(200, page({ orgRank: CODE, bio: 'nichts' }), { url }),
    });
    const r2 = await w2.call({ action: 'verify' });
    assert.deepStrictEqual([r2.status, r2.data], [409, { error: 'code_outside_bio' }]);
    assert.ok(!w2.fns().includes('rsi_challenge_result'), 'nichts festgehalten');
  });
});

describe('Dashboard: kein Code mehr aus dem Browser', () => {
  const src = fs.readFileSync(path.resolve('src/scripts/account-dashboard.ts'), 'utf8');

  test('kein selbst erzeugter Code, kein gespeicherter Code im Browser', () => {
    assert.ok(!/VERSEBASE-VERIFY-\$\{/.test(src), 'Code-Generator im Dashboard');
    assert.ok(!/setItem\(\s*['"]vb_rsi_code/.test(src), 'vb_rsi_code wird noch geschrieben');
    assert.ok(!/rsi_code\s*:/.test(src), 'rsi_code wird noch gesendet oder geschrieben');
  });

  test('der Code kommt aus der Function (action challenge), gepruefte wird per action verify', () => {
    assert.match(src, /action:\s*'challenge'/);
    assert.match(src, /action:\s*'verify'/);
  });
});
