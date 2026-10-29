// Kontoloeschung verlangt eine frische Anmeldung
// (supabase/functions/delete-account/fresh.ts).
//
// fresh.ts hat keine Importe und laeuft hier unveraendert gegen selbst
// gebaute Tokens. Dazu eine Quelltext-Zusicherung an index.ts: die Pruefung
// steht nach getUser() und vor dem Aufraeumen und dem Loeschen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { signedInRecently, secondFactorMissing, REAUTH_WINDOW } from '../../supabase/functions/delete-account/fresh.ts';

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64')
  .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (claims) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(claims)}.sig`;
const NOW = 1_800_000_000;

test('Anmeldung vor zwei Minuten gilt als frisch', () => {
  assert.equal(signedInRecently(jwt({ amr: [{ method: 'password', timestamp: NOW - 120 }] }), NOW), true);
});

test('Anmeldung juenger als das Fenster, ein anderer Eintrag alt: frisch', () => {
  const t = jwt({ amr: [{ method: 'oauth', timestamp: NOW - 86400 }, { method: 'password', timestamp: NOW - 30 }] });
  assert.equal(signedInRecently(t, NOW), true);
});

test('Anmeldung am Fensterrand und davor gilt nicht', () => {
  assert.equal(signedInRecently(jwt({ amr: [{ method: 'password', timestamp: NOW - REAUTH_WINDOW }] }), NOW), false);
  assert.equal(signedInRecently(jwt({ amr: [{ method: 'oauth', timestamp: NOW - 3 * 3600 }] }), NOW), false);
});

test('ohne amr, mit kaputtem amr oder kaputtem Token: nicht frisch', () => {
  assert.equal(signedInRecently(jwt({ sub: 'x' }), NOW), false);
  assert.equal(signedInRecently(jwt({ amr: 'password' }), NOW), false);
  assert.equal(signedInRecently(jwt({ amr: [{ method: 'password' }] }), NOW), false);
  assert.equal(signedInRecently(jwt({ amr: [{ method: 'password', timestamp: 'bald' }] }), NOW), false);
  assert.equal(signedInRecently('kein.token', NOW), false);
  assert.equal(signedInRecently('', NOW), false);
});

test('ein Zeitpunkt weit in der Zukunft zaehlt nicht', () => {
  assert.equal(signedInRecently(jwt({ amr: [{ method: 'password', timestamp: NOW + 3600 }] }), NOW), false);
});

test('Konto ohne bestaetigten Faktor: kein Code noetig', () => {
  const t = jwt({ aal: 'aal1', amr: [{ method: 'password', timestamp: NOW }] });
  assert.equal(secondFactorMissing(t, []), false);
  assert.equal(secondFactorMissing(t, undefined), false);
  assert.equal(secondFactorMissing(t, [{ factor_type: 'totp', status: 'unverified' }]), false);
});

test('Konto mit bestaetigtem Faktor: nur eine Sitzung mit Code darf loeschen', () => {
  const f = [{ factor_type: 'totp', status: 'verified' }];
  assert.equal(secondFactorMissing(jwt({ aal: 'aal1' }), f), true);
  assert.equal(secondFactorMissing(jwt({}), f), true);
  assert.equal(secondFactorMissing(jwt({ aal: 'AAL2' }), f), true);
  assert.equal(secondFactorMissing('kaputt', f), true);
  assert.equal(secondFactorMissing(jwt({ aal: 'aal2' }), f), false);
});

test('index.ts prueft die Frische nach getUser und vor Aufraeumen und Loeschen', () => {
  const src = fs.readFileSync(path.resolve('supabase/functions/delete-account/index.ts'), 'utf8');
  const at = (s) => { const i = src.indexOf(s); assert.ok(i >= 0, `fehlt: ${s}`); return i; };
  const getUser = at('auth.getUser()');
  const fresh = at('signedInRecently(jwt');
  const reauth = at("'reauth_required'");
  assert.ok(getUser < fresh && fresh < reauth, 'Frische-Pruefung nicht nach getUser');
  assert.ok(reauth < at('purgeUserFiles(admin.storage'), 'Frische-Pruefung nicht vor dem Aufraeumen');
  assert.ok(reauth < at('deleteUser(user.id)'), 'Frische-Pruefung nicht vor dem Loeschen');
  const mfa = at("'mfa_required'");
  assert.ok(getUser < at('secondFactorMissing(jwt, user.factors)') && mfa < at('purgeUserFiles(admin.storage'),
    'Code-Pruefung nicht zwischen getUser und Aufraeumen');
});
