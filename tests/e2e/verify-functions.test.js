// Haelt das Urteil von verify:functions fest, ohne Netz und ohne git.
//
// verify:functions laeuft auf Schiene B (braucht ein Zugriffstoken und git)
// und damit nie im Auslieferungs-Tor. Was hier im Tor laeuft, ist der Kern des
// Vergleichs (pruefe), der Leser fuer supabase/config.toml (jwtSoll) und die
// Liste der Functions im Repository.
//
// Die Staende in diesem Test sind SYNTHETISCH: Namen aus supabase/functions,
// Zeitpunkte erfunden. Kein Live-Stand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pruefe, jwtSoll, repoFunktionen, leseMomentaufnahme, KLINKE_FUNKTIONEN,
} from '../../scripts/verify-functions.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const soll = jwtSoll(readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8'));
const ms = (iso) => Date.parse(iso);

// Repository: jede Function zuletzt am 01.03.2030 geaendert.
const SLUGS = ['bot-role-sync', 'create-checkout-session', 'delete-account', 'register', 'stripe-webhook', 'verify-rsi'];
const REPO = SLUGS.map((slug, i) => ({ slug, commit: { ms: ms(`2030-03-01T1${i}:00:00Z`), kennung: `c0ffee${i}` } }));

/** Die Anlage, je Function am 02.03.2030 ausgerollt, verify_jwt wie config.toml. */
const frisch = () => SLUGS.map((slug) => ({
  slug, version: 3, updated_at: ms('2030-03-02T12:00:00Z'), verify_jwt: soll.has(slug) ? soll.get(slug) : true,
}));

test('verify-functions: eine Function, deren Repository-Stand juenger ist als ihr Deploy, reisst', () => {
  // bot-role-sync am 28.02. ausgerollt, im Repository am 01.03. geaendert.
  const anlage = frisch().map((f) => (f.slug === 'bot-role-sync' ? { ...f, updated_at: ms('2030-02-28T09:00:00Z') } : f));
  const { fehler, warnungen, zeilen } = pruefe(REPO, anlage, soll);
  assert.equal(zeilen.length, 6);
  assert.deepEqual(warnungen, []);
  assert.equal(fehler.length, 1, fehler.join('\n'));
  assert.match(fehler[0], /^bot-role-sync: Repository-Stand c0ffee0 vom 2030-03-01 10:00 UTC ist juenger als der Deploy vom 2030-02-28 09:00 UTC .* ausrollen$/);
  // Derselbe Tag reicht nicht: Deploy um 09:59, Commit um 10:00.
  const knapp = frisch().map((f) => (f.slug === 'bot-role-sync' ? { ...f, updated_at: ms('2030-03-01T09:59:00Z') } : f));
  assert.equal(pruefe(REPO, knapp, soll).fehler.length, 1);
});

test('verify-functions: frisch ausgerollt ist gruen', () => {
  const { fehler, warnungen } = pruefe(REPO, frisch(), soll);
  assert.deepEqual(fehler, []);
  assert.deepEqual(warnungen, []);
});

test('verify-functions: ISO-Zeitstempel (Form von list_edge_functions als Text) werden gelesen', () => {
  const iso = frisch().map((f) => ({ ...f, updated_at: new Date(f.updated_at).toISOString() }));
  assert.deepEqual(pruefe(REPO, iso, soll).fehler, []);
  const kaputt = frisch().map((f) => (f.slug === 'register' ? { ...f, updated_at: 'gestern' } : f));
  assert.deepEqual(pruefe(REPO, kaputt, soll).fehler, ['register: Deploy-Zeitpunkt unlesbar (gestern)']);
});

test('verify-functions: verify_jwt muss supabase/config.toml folgen', () => {
  // Der Webhook mit Anmeldepflicht nimmt keinen Stripe-Aufruf mehr an; die
  // Kontoloeschung ohne sie waere fuer jeden offen.
  const anlage = frisch().map((f) => {
    if (f.slug === 'stripe-webhook') return { ...f, verify_jwt: true };
    if (f.slug === 'delete-account') return { ...f, verify_jwt: false };
    return f;
  });
  assert.deepEqual(pruefe(REPO, anlage, soll).fehler, [
    'delete-account: verify_jwt ist false, supabase/config.toml verlangt true',
    'stripe-webhook: verify_jwt ist true, supabase/config.toml verlangt false',
  ]);
  // Ohne Eintrag gilt der Supabase-Standard true (verify-rsi hat keinen).
  const ohne = frisch().map((f) => (f.slug === 'verify-rsi' ? { ...f, verify_jwt: false } : f));
  assert.deepEqual(pruefe(REPO, ohne, soll).fehler, [
    'verify-rsi: verify_jwt ist false, supabase/config.toml verlangt true (Standard, kein Eintrag)',
  ]);
});

test('verify-functions: fehlt auf der Anlage = FEHLER, nur auf der Anlage = WARNUNG', () => {
  const anlage = [...frisch().filter((f) => f.slug !== 'register'), { slug: 'alt-experiment', version: 1, updated_at: 0, verify_jwt: true }];
  const { fehler, warnungen } = pruefe(REPO, anlage, soll);
  assert.deepEqual(fehler, ['register: steht im Repository, laeuft aber nicht auf der Anlage — ausrollen']);
  assert.deepEqual(warnungen, ['alt-experiment: laeuft auf der Anlage, steht aber nicht im Repository']);
});

test('verify-functions: Klinke und Selbstauskunft gegen das Repository', () => {
  const repo = repoFunktionen(ROOT);
  assert.ok(repo.length >= KLINKE_FUNKTIONEN, `nur ${repo.length} Functions in supabase/functions (Klinke ${KLINKE_FUNKTIONEN})`);
  // Jede Function der Faelle oben steht noch im Repository; sonst prueft der
  // Test Namen, die es nicht mehr gibt.
  for (const { slug } of REPO) assert.ok(repo.includes(slug), `${slug} fehlt in supabase/functions`);
  // config.toml: die Functions, die ohne Anmeldung erreichbar sein muessen.
  for (const slug of ['register', 'create-checkout-session', 'stripe-webhook', 'bot-role-sync']) {
    assert.equal(soll.get(slug), false, `${slug}: verify_jwt = false fehlt in supabase/config.toml`);
  }
  const zuWenig = pruefe(REPO.slice(0, 5), frisch(), soll).fehler;
  assert.ok(zuWenig.some((f) => /^nur 5 Functions im Repository gefunden/.test(f)), zuWenig.join('\n'));
});

test('verify-functions: Momentaufnahme als Liste oder als { functions: [...] }', () => {
  assert.equal(leseMomentaufnahme(JSON.stringify(frisch())).length, 6);
  assert.equal(leseMomentaufnahme(JSON.stringify({ functions: frisch() })).length, 6);
  assert.throws(() => leseMomentaufnahme('{"result":[]}'), /keine Function-Liste/);
});

test('verify-functions: jwtSoll liest nur [functions.*] und ignoriert Kommentare', () => {
  const m = jwtSoll([
    '[auth]',
    'verify_jwt = false',
    '[functions.a]',
    'verify_jwt = false # ohne Anmeldung',
    '[functions.b]',
    '# verify_jwt = false',
    '[functions.c]',
    'verify_jwt=true',
    '[db]',
    'verify_jwt = false',
  ].join('\n'));
  assert.deepEqual([...m], [['a', false], ['c', true]]);
});
