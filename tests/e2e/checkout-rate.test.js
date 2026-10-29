// Haelt die Bremse je Anschluss der Edge Function create-checkout-session fest
// (supabase/functions/create-checkout-session/rate.js, Staging-Audit 3.2).
//
// Zusicherungen:
//   * Die Adresse kommt aus cf-connecting-ip; ein vom Aufrufer gesetzter
//     x-forwarded-for-Anfang zaehlt nicht.
//   * An die Datenbank geht nur ein HMAC-Schluessel, nie die Adresse.
//   * false von checkout_rate_ok heisst gebremst, alles andere laesst die
//     Spende durch (Ausfall offen) und steht im Log.
//   * index.ts fragt die Bremse VOR Stripe und antwortet 429 mit Retry-After.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import { clientIp, subjectOf, ipKey, checkoutAllowed, LIMIT_PER_HOUR } from '../../supabase/functions/create-checkout-session/rate.js';

const H = (o) => new Headers(o);
const ENV = { SUPABASE_URL: 'https://sb.example/', SUPABASE_SERVICE_ROLE_KEY: 'service-key', CHECKOUT_RATE_SECRET: 'pepper' };

function rpc(answer) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (answer instanceof Error) throw answer;
    const [status, body] = answer;
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { calls, fetchImpl };
}

describe('clientIp', () => {
  test('cf-connecting-ip vor allem anderen', () => {
    assert.equal(clientIp(H({ 'cf-connecting-ip': '203.0.113.7', 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '1.2.3.4' })), '203.0.113.7');
  });
  test('ohne Cloudflare-Kopf: x-real-ip, dann der LETZTE x-forwarded-for-Eintrag', () => {
    assert.equal(clientIp(H({ 'x-real-ip': '198.51.100.1' })), '198.51.100.1');
    assert.equal(clientIp(H({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' })), '203.0.113.9');
  });
  test('IPv6 zaehlt je /64, ::ffff:-Adressen als IPv4, Unsinn ist unbekannt', () => {
    assert.equal(subjectOf('2001:db8:1:2:aaaa::1'), subjectOf('2001:db8:1:2:bbbb::9'));
    assert.equal(subjectOf('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
    assert.notEqual(subjectOf('2001:db8:1:3::1'), subjectOf('2001:db8:1:2::1'));
    assert.equal(subjectOf('::ffff:203.0.113.7'), '203.0.113.7');
    assert.equal(clientIp(H({ 'cf-connecting-ip': '2001:db8::1' })), '2001:db8:0:0::/64');
    assert.equal(clientIp(H({ 'cf-connecting-ip': 'x; drop table' })), '');
    assert.equal(subjectOf('1::2::3'), '');
    assert.equal(clientIp(H({})), '');
  });
});

describe('ipKey', () => {
  test('HMAC-SHA-256 mit dem Geheimwert, 64 Hex-Zeichen, Adresse nicht enthalten', async () => {
    const k = await ipKey('203.0.113.7', 'pepper');
    assert.equal(k, createHmac('sha256', 'pepper').update('checkout-rate:203.0.113.7').digest('hex'));
    assert.match(k, /^[0-9a-f]{64}$/);
    assert.notEqual(await ipKey('203.0.113.7', 'anderer'), k);
  });
});

describe('checkoutAllowed', () => {
  test('RPC mit Service-Key und HMAC-Schluessel; true laesst durch', async () => {
    const { calls, fetchImpl } = rpc([200, true]);
    const ok = await checkoutAllowed({ headers: H({ 'cf-connecting-ip': '203.0.113.7' }), env: ENV, fetch: fetchImpl });
    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://sb.example/rest/v1/rpc/checkout_rate_ok');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer service-key');
    const body = JSON.parse(calls[0].init.body);
    assert.deepEqual(Object.keys(body), ['p_ip_key']);
    assert.equal(body.p_ip_key, createHmac('sha256', 'pepper').update('checkout-rate:203.0.113.7').digest('hex'));
    assert.ok(!calls[0].init.body.includes('203.0.113.7'), 'Adresse geht nicht an die Datenbank');
  });

  test('false von der Datenbank bremst', async () => {
    const { fetchImpl } = rpc([200, false]);
    assert.equal(await checkoutAllowed({ headers: H({ 'cf-connecting-ip': '203.0.113.7' }), env: ENV, fetch: fetchImpl }), false);
  });

  test('ohne CHECKOUT_RATE_SECRET ist der Service-Key der Geheimwert', async () => {
    const { calls, fetchImpl } = rpc([200, true]);
    await checkoutAllowed({ headers: H({ 'cf-connecting-ip': '203.0.113.7' }), env: { ...ENV, CHECKOUT_RATE_SECRET: '' }, fetch: fetchImpl });
    assert.equal(JSON.parse(calls[0].init.body).p_ip_key, createHmac('sha256', 'service-key').update('checkout-rate:203.0.113.7').digest('hex'));
  });

  test('Ausfall offen, aber im Log: 500, Netzfehler, unklare Antwort, keine Adresse', async () => {
    for (const [answer, headers] of [
      [[500, {}], { 'cf-connecting-ip': '203.0.113.7' }],
      [new Error('boom'), { 'cf-connecting-ip': '203.0.113.7' }],
      [[200, { x: 1 }], { 'cf-connecting-ip': '203.0.113.7' }],
      [[200, false], {}],
    ]) {
      const logs = [];
      const { fetchImpl } = rpc(answer);
      assert.equal(await checkoutAllowed({ headers: H(headers), env: ENV, fetch: fetchImpl, log: (m) => logs.push(m) }), true);
      assert.equal(logs.length, 1, JSON.stringify(answer));
    }
  });
});

describe('Verdrahtung', () => {
  const src = fs.readFileSync('supabase/functions/create-checkout-session/index.ts', 'utf8');
  const sql = fs.readFileSync('supabase/migrations/20261030160000_checkout_rate_limit.sql', 'utf8');

  test('index.ts fragt die Bremse vor dem Rumpf und vor Stripe und antwortet 429 mit Retry-After', () => {
    const ask = src.indexOf('await checkoutAllowed(');
    const body = src.indexOf('await req.json()');
    const stripe = src.indexOf('new Stripe(');
    assert.ok(ask > 0 && body > ask && stripe > ask, 'checkoutAllowed steht nicht vor req.json() und new Stripe(');
    assert.match(src, /json\(\{ error: 'rate_limited' \}, 429, origin, \{ 'Retry-After':/);
  });

  test('Grenze in Function und Migration gleich, RPC nur fuer service_role', () => {
    assert.match(sql, new RegExp(`if recent >= ${LIMIT_PER_HOUR} then`));
    assert.match(sql, /revoke all on function public\.checkout_rate_ok\(text\) from public, anon, authenticated;/);
    assert.match(sql, /grant execute on function public\.checkout_rate_ok\(text\) to service_role;/);
  });

  test('Datenschutzerklaerung nennt die Bremse (DE und EN)', () => {
    const de = fs.readFileSync('src/pages/de/datenschutz.astro', 'utf8');
    const en = fs.readFileSync('src/pages/datenschutz.astro', 'utf8');
    assert.match(de, /höchstens\s+zehn\s+Aufrufe\s+in\s+der\s+Stunde/);
    assert.match(de, /älter\s+als\s+eine\s+Stunde/);
    assert.match(en, /at\s+most\s+ten\s+calls\s+per\s+hour/);
    assert.match(en, /older\s+than\s+one\s+hour/);
  });
});
