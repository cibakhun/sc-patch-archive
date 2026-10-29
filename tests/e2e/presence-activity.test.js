// Die Angabe "was ich gerade mache" im Heartbeat von assets/account-lite.js
// und der Schalter profiles.share_activity ("Freunde sehen, was ich gerade
// mache"). Die Datenschutzerklaerung sagt: ist er aus, wird die Angabe
// geleert und nicht mehr mitgeschickt. Bis 29.10.2026 galt ein unbekannter
// Schalter als "an" — ein Browser ohne Dashboard-Cache schickte beim ersten
// Puls jeder Seite die Angabe mit, auch bei ausgeschaltetem Schalter.
// Das Skript laeuft echt in node:vm (tests/e2e/helpers/account-dom.js), auf
// /schiffe/aegs-gladius.html: die Angabe dort ist 'ship|Gladius'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAccountBrowser } from './helpers/account-dom.js';

/** Die Koerper aller Heartbeats dieses Tabs, in Reihenfolge. */
const pings = (tab) => tab.requests
  .filter((r) => r.method === 'PATCH' && r.url.includes('/rest/v1/profiles?'))
  .map((r) => JSON.parse(r.body));
const SHIP = 'ship|Gladius';

test('Schalter aus, kein Cache: kein Puls traegt je eine Angabe, der zweite leert sie', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, shareActivity: false });
  const tab = b.open();
  await b.drain();
  const [first, second] = pings(tab);
  assert.equal('activity' in first, false, 'der erste Puls fasst die Angabe nicht an');
  assert.equal(second.activity, null, 'kaum ist der Schalter bekannt, wird geleert');
  await b.advance(60000);
  assert.ok(pings(tab).length >= 4, 'der Puls laeuft weiter');
  assert.deepEqual(pings(tab).filter((p) => p.activity), [], 'keine Angabe verlaesst den Browser');
});

test('Schalter an, kein Cache: die Angabe kommt mit dem sofort nachgereichten Puls', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, shareActivity: true });
  const tab = b.open();
  await b.drain();
  const [first, second] = pings(tab);
  assert.equal('activity' in first, false);
  assert.equal(second.activity, SHIP);
  assert.equal(pings(tab).length, 2, 'genau ein Nachreichen, keine Schleife');

  const next = tab.reload();
  await b.drain();
  assert.equal(pings(next).length, 1, 'die naechste Seite im Tab kennt den Schalter schon');
  assert.equal(pings(next)[0].activity, SHIP);
});

test('ein "aus" im Dashboard-Cache gewinnt gegen den im Tab gemerkten Wert', async () => {
  const b = makeAccountBrowser({ expiresIn: 3600, shareActivity: false });
  b.storage.set('vb_profile_user-1', JSON.stringify({ share_activity: false }));
  const tab = b.open(new Map([['vb_share_user-1', '1']]));
  await b.drain();
  assert.equal(pings(tab).length, 1);
  assert.equal(pings(tab)[0].activity, null, 'schon der erste Puls schickt nichts mit');
});
