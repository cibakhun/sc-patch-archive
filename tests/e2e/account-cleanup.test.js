// Abmelden und Konto loeschen lassen keine Kontodaten im Browser zurueck
// (src/lib/account-cleanup.ts), und das Dashboard ruft das Aufraeumen an
// den richtigen Stellen auf (src/scripts/account-dashboard.ts).
//
// account-cleanup.ts hat keine Importe und laeuft hier unveraendert (Node
// entfernt die Typen beim Laden) gegen einen nachgebauten Speicher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { clearAccountTraces, accountKeys } from '../../src/lib/account-cleanup.ts';

const UID = '11111111-1111-4111-8111-111111111111';
const OLD = '22222222-2222-4222-8222-222222222222';

/** Speicher mit dem Storage-Ausschnitt, den account-cleanup.ts braucht. */
function store(entries) {
  const m = new Map(Object.entries(entries));
  return {
    map: m,
    get length() { return m.size; },
    key(i) { return [...m.keys()][i] ?? null; },
    removeItem(k) { m.delete(k); },
  };
}

const BROWSER = () => ({
  local: store({
    [`vb_profile_${UID}`]: '{"bio":"x","rsi_code":"VERSEBASE-VERIFY-ABC"}',
    [`vb_profile_${OLD}`]: '{"bio":"vorher"}',
    vb_rsi_code: 'VERSEBASE-VERIFY-ABC',
    [`vb.fleet.v1.${UID}`]: '{"ships":[]}',
    [`craft.state.v2.${UID}`]: '{"owned":{}}',
    'craft.state.v2': '{"owned":{}}',
    'vb.theme': 'dark',
    'sb-trgjhmbnodoarnfmlcqx-auth-token': '{"access_token":"t"}',
  }),
  session: store({
    vb_user_role: JSON.stringify({ uid: UID, role: 'admin', ts: 1 }),
    'vb.dcLinking': '1',
    'vb:from': '/hangar.html',
  }),
});

test('Abmelden entfernt Profil-Caches (auch fruehere Konten), RSI-Code und Rolle', () => {
  const b = BROWSER();
  clearAccountTraces(UID, 'signout', b);
  assert.deepEqual([...b.local.map.keys()].sort(), [
    'craft.state.v2',
    `craft.state.v2.${UID}`,
    'sb-trgjhmbnodoarnfmlcqx-auth-token',
    `vb.fleet.v1.${UID}`,
    'vb.theme',
  ].sort(), 'Werkzeug-Spiegel, Gast-Ablage, Einstellungen und die Sitzung (signOut) bleiben');
  assert.deepEqual([...b.session.map.keys()], ['vb:from']);
});

test('Konto loeschen entfernt zusaetzlich die Werkzeug-Spiegel des Kontos', () => {
  const b = BROWSER();
  clearAccountTraces(UID, 'delete', b);
  assert.deepEqual([...b.local.map.keys()].sort(), [
    'craft.state.v2',
    'sb-trgjhmbnodoarnfmlcqx-auth-token',
    'vb.theme',
  ].sort());
  assert.ok(accountKeys(UID, 'delete').local.includes(`vb.fleet.v1.${UID}`));
});

test('gesperrter Speicher bricht nichts ab', () => {
  const boom = { get length() { throw new Error('SecurityError'); }, key() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.doesNotThrow(() => clearAccountTraces(UID, 'signout', { local: boom, session: null }));
  assert.doesNotThrow(() => clearAccountTraces(UID, 'delete', {}));
});

// Quelltext-Zusicherungen an das Dashboard: die Aufrufe stehen VOR signOut,
// sonst liefe eine Weiterleitung womoeglich vorher los.
const dash = fs.readFileSync(path.resolve('src/scripts/account-dashboard.ts'), 'utf8');

function handlerAround(marker, span = 900) {
  const at = dash.indexOf(marker);
  assert.ok(at > 0, `Marker nicht gefunden: ${marker}`);
  return dash.slice(at, at + span);
}

test('Abmelde-Knopf raeumt vor signOut auf', () => {
  const h = handlerAround("getElementById('btnLogout')");
  const clean = h.indexOf("clearAccountTraces(user.id, 'signout'");
  const out = h.indexOf('supabase.auth.signOut(');
  assert.ok(clean > 0 && out > clean, 'clearAccountTraces(..., signout) steht vor signOut');
});

test('Kontoloeschung raeumt nach Erfolg und vor signOut auf', () => {
  const h = handlerAround("functions.invoke('delete-account'");
  const ok = h.indexOf('if (error) throw error;');
  const clean = h.indexOf("clearAccountTraces(user.id, 'delete'");
  const out = h.indexOf('supabase.auth.signOut(');
  assert.ok(ok > 0 && clean > ok && out > clean, 'erst Erfolg, dann aufraeumen, dann abmelden');
});

test('Bild entfernen loescht die Datei im Bucket, nicht nur den Verweis', () => {
  const h = handlerAround("removeEl.addEventListener('click'", 1400);
  const db = h.indexOf('.update({ [o.stateKey]: null })');
  const rm = h.indexOf('supabase.storage.from(o.bucket).remove([`${user.id}/${o.kind}`])');
  assert.ok(db > 0, 'Profilzeile wird geleert');
  assert.ok(rm > db, 'danach die Datei entfernt');
});
