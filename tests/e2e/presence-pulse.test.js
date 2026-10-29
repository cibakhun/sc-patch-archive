// Der Präsenz-Puls in assets/account-lite.js und die Einstellung
// profiles.presence_visibility ('friends' Vorgabe, 'all', 'none'), siehe
// supabase/migrations/20261030110000_presence_visibility.sql. Bei 'none' darf
// der Puls keine Zeitpunkte senden, auch nicht den ersten beim Laden; jeder
// andere Wert pulst wie bisher. Kennt die Datenbank die Spalte noch nicht,
// laufen Name und Puls trotzdem. Das Skript läuft echt in node:vm
// (tests/e2e/helpers/account-dom.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAccountBrowser } from './helpers/account-dom.js';

const pulses = (tab) => tab.requests.filter((r) => r.method === 'PATCH' && r.url.includes('/rest/v1/profiles?'));
const profileReads = (tab) => tab.requests.filter((r) => r.method === 'GET' && r.url.includes('/rest/v1/profiles?'));
const SIGNED_IN = { href: '/account.html', text: 'Nova', authed: true, title: 'Nova' };

test('Vorgabe (friends): der Puls sendet beim Laden und alle 30 Sekunden, und fragt die Einstellung mit ab', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, profile: { presence_visibility: 'friends', share_activity: true } });
  const tab = b.open();
  await b.drain();
  assert.equal(profileReads(tab).length, 1, 'Name und Einstellung in EINER Abfrage');
  assert.match(profileReads(tab)[0].url, /select=display_name,handle,presence_visibility,share_activity/);
  assert.equal(pulses(tab).length, 1);
  const [first] = pulses(tab);
  assert.match(first.url, /select=share_activity,presence_visibility/);
  assert.ok(first.body.last_seen && first.body.last_active, 'beide Zeitpunkte');
  assert.equal(first.body.activity, 'ship|Gladius', 'Rich Presence wie bisher');
  await b.advance(30000);
  assert.equal(pulses(tab).length, 2);
  assert.deepEqual(tab.nav(), SIGNED_IN);
});

test('none: kein einziger Puls, auch nicht beim Laden', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, profile: { presence_visibility: 'none', share_activity: true } });
  const tab = b.open();
  await b.drain();
  await b.advance(120000);
  assert.equal(pulses(tab).length, 0);
  assert.deepEqual(tab.nav(), SIGNED_IN, 'der Name kommt trotzdem');
});

test('der erste Puls wartet auf die Profilzeile: bei none geht nie ein Zeitpunkt hinaus', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, holdReads: true, profile: { presence_visibility: 'none' } });
  const tab = b.open();
  await b.drain();
  assert.equal(pulses(tab).length, 0, 'solange die Einstellung unbekannt ist, wartet der Puls');
  for (const r of b.reads.splice(0)) r.answer();
  await b.drain();
  await b.advance(60000);
  assert.equal(pulses(tab).length, 0);
});

test('scheitert die Profilzeile, gilt der Cache des Dashboards, ohne Cache die Vorgabe', async () => {
  for (const [cached, want] of [[{ presence_visibility: 'none' }, 0], [null, 1]]) {
    const b = makeAccountBrowser({ expiresIn: 3600, holdReads: true, profile: { presence_visibility: 'friends' } });
    const tab = b.open();
    if (cached) tab.setItem('vb_profile_user-1', JSON.stringify(cached));
    await b.drain();
    for (const r of b.reads.splice(0)) r.answer(503);
    await b.drain();
    assert.equal(pulses(tab).length, want, JSON.stringify(cached));
  }
});

test('auf einem anderen Gerät auf none gestellt: die nächste Antwort des Pulses beendet ihn', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, profile: { presence_visibility: 'friends', share_activity: true } });
  const tab = b.open();
  await b.drain();
  assert.equal(pulses(tab).length, 1);
  b.profile.presence_visibility = 'none';
  await b.advance(30000);
  assert.equal(pulses(tab).length, 2, 'dieser Puls erfährt die Einstellung (die Datenbank verwirft seine Zeitpunkte)');
  await b.advance(90000);
  assert.equal(pulses(tab).length, 2, 'danach keiner mehr');
});

test('das Dashboard im selben Tab: none stoppt sofort, friends pulst sofort wieder', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, profile: { presence_visibility: 'friends', share_activity: true } });
  const tab = b.open();
  await b.drain();
  assert.equal(pulses(tab).length, 1);
  tab.fire('vb-account-prefs', { detail: { presence_visibility: 'none', share_activity: true } });
  await b.drain();
  await b.advance(60000);
  assert.equal(pulses(tab).length, 1, 'kein Puls nach none');
  tab.fire('vb-account-prefs', { detail: { presence_visibility: 'friends', share_activity: true } });
  await b.drain();
  assert.equal(pulses(tab).length, 2, 'wieder sichtbar: sofort ein Puls, nicht erst in 30 Sekunden');
});

test('das Dashboard in einem anderen Tab speichert none: dieser Tab hört über storage auf', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, profile: { presence_visibility: 'friends', share_activity: true } });
  const tab = b.open();
  const other = b.open();
  await b.drain();
  assert.equal(pulses(tab).length, 1);
  other.setItem('vb_profile_user-1', JSON.stringify({ presence_visibility: 'none', share_activity: true }));
  await b.drain();
  await b.advance(60000);
  assert.equal(pulses(tab).length, 1);
});

test('share_activity aus: der Puls sendet Zeitpunkte, aber keine Aktivität', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, profile: { presence_visibility: 'all', share_activity: false } });
  const tab = b.open();
  await b.drain();
  assert.equal(pulses(tab).length, 1);
  assert.equal(pulses(tab)[0].body.activity, null);
  assert.ok(pulses(tab)[0].body.last_seen);
});

test('Datenbank ohne presence_visibility: Name und Puls laufen weiter, je Tab nur ein Fehlversuch', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, profile: { share_activity: true }, missing: ['presence_visibility'] });
  const tab = b.open();
  await b.drain();
  assert.deepEqual(tab.nav(), SIGNED_IN, 'der Name kommt aus der zweiten, schlichten Abfrage');
  assert.equal(profileReads(tab).length, 2);
  assert.equal(pulses(tab).length, 2, 'erster Puls 400, sofort schlichter nachgesendet');
  assert.match(pulses(tab)[1].url, /select=share_activity$/);
  assert.equal(pulses(tab)[1].body.activity, 'ship|Gladius', 'mit Aktivität wie bisher');
  await b.advance(30000);
  assert.equal(pulses(tab).length, 3, 'danach ein Puls je Takt, ohne neuen Fehlversuch');
  assert.match(pulses(tab)[2].url, /select=share_activity$/);
});
