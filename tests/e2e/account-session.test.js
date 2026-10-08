// Die Sitzung, die assets/account-lite.js auf rund 900 Seiten an die
// Seitenskripte weiterreicht (VBAccount.session), wenn ihr Token abläuft.
// Das Skript läuft echt in node:vm (tests/e2e/helpers/account-dom.js); jede
// Zusicherung liest, was ein Seitenskript bekommt, was im localStorage steht
// und welche Ereignisse der Tab sendet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAccountBrowser, STORE } from './helpers/account-dom.js';

const tokenOf = (s) => (s ? s.access_token : null);
const storedToken = (b) => tokenOf(JSON.parse(b.storage.get(STORE) ?? 'null'));
const sessionEvents = (tab) => tab.events.filter((e) => e === 'vb-account-session').length;

test('zwei Aufrufe während eines Refreshs bekommen beide die neue Sitzung, ein Refresh genügt', async () => {
  const b = makeAccountBrowser({ expiresIn: -10 });
  const tab = b.open();
  assert.equal(b.refreshes.length, 1, 'boot() refresht das abgelaufene Token');

  const first = tab.session();
  const second = tab.session();
  b.refreshes[0].answer(200, b.fresh(2));
  assert.deepEqual([tokenOf(await first), tokenOf(await second)], ['token-2', 'token-2']);
  assert.equal(b.refreshes.length, 1);
  assert.equal(storedToken(b), 'token-2');
  assert.equal(sessionEvents(tab), 1, 'Seitenskripte im selben Tab erfahren vom Refresh');
});

test('eine Ablehnung des Tokens (400, 401, 403) meldet ab und räumt die Sitzung weg', async () => {
  for (const status of [400, 401, 403]) {
    const b = makeAccountBrowser({ expiresIn: -10 });
    const tab = b.open();
    const s = tab.session();
    b.refreshes[0].answer(status, { error: 'invalid_grant' });
    assert.equal(await s, null, `${status}`);
    assert.equal(b.storage.get(STORE), null, `${status}: die Sitzung ist weg`);
    assert.equal(sessionEvents(tab), 1, `${status}: Seitenskripte erfahren vom Abmelden`);
  }
});

test('ein Serverfehler (503, 429) oder fehlendes Netz behält die Sitzung und liefert null', async () => {
  for (const outcome of [503, 429, 'offline']) {
    const b = makeAccountBrowser({ expiresIn: -10 });
    const tab = b.open();
    const s = tab.session();
    if (outcome === 'offline') b.refreshes[0].offline();
    else b.refreshes[0].answer(outcome, { message: 'try later' });
    assert.equal(await s, null, `${outcome}`);
    assert.equal(storedToken(b), 'token-1', `${outcome}: die Sitzung bleibt für den nächsten Versuch liegen`);
    assert.equal(sessionEvents(tab), 0, `${outcome}`);
  }
});

test('scheitert der Refresh eines noch gültigen Tokens, bleibt das Token nutzbar', async () => {
  const b = makeAccountBrowser({ expiresIn: 30 });
  const tab = b.open();
  const s = tab.session();
  b.refreshes[0].answer(503, { message: 'try later' });
  assert.equal(tokenOf(await s), 'token-1');
  assert.equal(storedToken(b), 'token-1');
});

test('ein Refresh ohne Antwort gibt seine Aufrufer nach 15 Sekunden frei, eine späte Antwort kommt noch an', async () => {
  const b = makeAccountBrowser({ expiresIn: -10 });
  const tab = b.open();
  let got = 'wartet';
  tab.session().then((s) => { got = tokenOf(s); });
  await b.advance(14000);
  assert.equal(got, 'wartet', 'vor der Frist wartet der Aufrufer auf den Refresh');
  await b.advance(1000);
  assert.equal(got, null);
  assert.equal(storedToken(b), 'token-1');

  b.refreshes[0].answer(200, b.fresh(2));
  await b.drain();
  assert.equal(storedToken(b), 'token-2');
  assert.equal(sessionEvents(tab), 1, 'die späte Sitzung wird gemeldet');
  assert.equal(tokenOf(await tab.session()), 'token-2');
});

test('ein zweiter Tab refresht nicht parallel und erfährt den Refresh des ersten über storage', async () => {
  const b = makeAccountBrowser({ expiresIn: -10 });
  b.open();
  const second = b.open();
  assert.equal(b.refreshes.length, 1, 'die Sperre im localStorage hält den zweiten Tab vom eigenen Refresh ab');
  assert.equal(await second.session(), null);

  b.refreshes[0].answer(200, b.fresh(2));
  await b.drain();
  assert.equal(sessionEvents(second), 1);
  assert.equal(tokenOf(await second.session()), 'token-2');
});
