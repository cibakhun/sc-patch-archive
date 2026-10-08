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
const calls = (tab, method, part) => tab.requests.filter((r) => r.method === method && r.url.includes(part)).length;
const heartbeats = (tab) => calls(tab, 'PATCH', '/rest/v1/profiles?');
const nameAndRoleFetches = (tab) => [calls(tab, 'GET', '/rest/v1/profiles?'), calls(tab, 'GET', '/rest/v1/user_roles?')];
const SIGNED_OUT = { href: '/account/login.html', text: 'Sign in', authed: false };
const SIGNED_IN = { href: '/account.html', text: 'Nova', authed: true };

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

test('landet der Refresh beim Laden erst nach der Frist, zieht der Tab Nav, Rolle und Heartbeat nach', async () => {
  const b = makeAccountBrowser({ expiresIn: -10 });
  const tab = b.open();
  await b.advance(15000);
  assert.deepEqual(tab.nav(), SIGNED_OUT, 'nach der Frist zeigt die Nav abgemeldet');
  assert.equal(heartbeats(tab), 0);

  b.refreshes[0].answer(200, b.fresh(2));
  await b.drain();
  assert.equal(storedToken(b), 'token-2');
  assert.deepEqual(tab.nav(), SIGNED_IN, 'die Nav zeigt das Konto mit Namen');
  assert.equal(tab.admin(), true, 'die Rolle ist angewandt');
  assert.equal(heartbeats(tab), 1, 'der Heartbeat pingt sofort');
  await b.advance(30000);
  assert.equal(heartbeats(tab), 2, 'und danach alle 30 Sekunden');
});

test('lehnt GoTrue den Refresh beim Laden erst nach der Frist ab, zeigt der Tab danach abgemeldet', async () => {
  const b = makeAccountBrowser({ expiresIn: 30 });
  const tab = b.open();
  await b.advance(15000);
  assert.deepEqual(tab.nav(), SIGNED_IN, 'nach der Frist gilt das noch gültige Token');
  assert.equal(tab.admin(), true);

  b.refreshes[0].answer(401, { error: 'invalid_grant' });
  await b.drain();
  assert.equal(b.storage.get(STORE), null);
  assert.deepEqual(tab.nav(), SIGNED_OUT, 'die Nav zeigt abgemeldet');
  assert.equal(tab.admin(), false, 'die Rolle ist zurückgenommen');
});

test('landet der Refresh beim Laden rechtzeitig, holt der Tab Name und Rolle genau einmal', async () => {
  const b = makeAccountBrowser({ expiresIn: -10 });
  const tab = b.open();
  b.refreshes[0].answer(200, b.fresh(2));
  await b.drain();
  assert.deepEqual(tab.nav(), SIGNED_IN);
  assert.equal(heartbeats(tab), 1);
  assert.deepEqual(nameAndRoleFetches(tab), [1, 1]);
});

test('erneuert der Tab sein Token später rechtzeitig, holt er Name und Rolle nicht noch einmal', async () => {
  const b = makeAccountBrowser({ expiresIn: 90 });
  const tab = b.open();
  await b.advance(30000);
  assert.equal(b.refreshes.length, 1, 'der Heartbeat nach 30 Sekunden erneuert das Token');
  b.refreshes[0].answer(200, b.fresh(2));
  await b.drain();
  assert.equal(storedToken(b), 'token-2');
  assert.equal(sessionEvents(tab), 1);
  assert.deepEqual(tab.nav(), SIGNED_IN);
  assert.deepEqual(nameAndRoleFetches(tab), [1, 1]);
});

test('meldet sich ein anderer Tab an, zeigt dieser Tab das Konto und holt Name und Rolle genau einmal', async () => {
  const b = makeAccountBrowser();
  b.signOut();
  const tab = b.open();
  await b.drain();
  assert.deepEqual(tab.nav(), SIGNED_OUT);

  b.signIn(9);
  await b.drain();
  assert.deepEqual(tab.nav(), SIGNED_IN);
  assert.equal(heartbeats(tab), 1);
  assert.deepEqual(nameAndRoleFetches(tab), [1, 1]);
});

test('hängt der Refresh, fragt der nächste Versuch nach der Frist mit demselben Token, und die späte erste Antwort meldet nicht ab', async () => {
  const b = makeAccountBrowser({ expiresIn: -10 });
  const tab = b.open();
  let first = 'wartet';
  tab.session().then((s) => { first = tokenOf(s); });
  await b.advance(15000);
  assert.equal(first, null);

  await b.advance(2000);
  const retry = tab.session();
  assert.deepEqual(b.refreshes.map((r) => r.body.refresh_token), ['refresh-1', 'refresh-1'], 'der Versuch nach 17 s fragt erneut, mit demselben Token');
  // GoTrue v2.197.0 (internal/tokens/service.go): wer das Eltern-Token des
  // aktiven Tokens schickt, bekommt das aktive zurück, auch nach den 10 s,
  // mit neu ausgestelltem Zugangstoken.
  b.refreshes[1].answer(200, b.fresh(2));
  assert.equal(tokenOf(await retry), 'token-2');
  b.refreshes[0].answer(200, { ...b.fresh(2), access_token: 'token-2a' });
  await b.drain();
  const stored = JSON.parse(b.storage.get(STORE) ?? 'null');
  assert.equal(stored && stored.refresh_token, 'refresh-2');
  const now = await tab.session();
  assert.equal(now && now.refresh_token, 'refresh-2');
});

test('eine späte Antwort für die abgemeldete Sitzung lässt die neue Anmeldung stehen', async () => {
  const late = [
    ['GoTrue hat die Sitzung beim Abmelden gelöscht', 400, { error_code: 'refresh_token_not_found' }],
    ['GoTrue hatte vor dem Abmelden erneuert', 200, 'fresh'],
  ];
  for (const [why, status, body] of late) {
    const b = makeAccountBrowser({ expiresIn: -10 });
    const tab = b.open();
    const waiting = tab.session();
    b.signOut();
    b.signIn(9);
    await b.drain();
    b.refreshes[0].answer(status, body === 'fresh' ? b.fresh(2) : body);
    const got = await waiting;
    assert.equal(storedToken(b), 'token-9', `${why}: die neue Anmeldung bleibt gespeichert`);
    assert.equal(tokenOf(got), 'token-9', `${why}: wer auf den Refresh wartet, bekommt die neue Anmeldung`);
  }
});

test('eine späte neue Sitzung nach dem Abmelden meldet nicht wieder an', async () => {
  const b = makeAccountBrowser({ expiresIn: 30 });
  const tab = b.open();
  const waiting = tab.session();
  b.signOut();
  await b.drain();
  b.refreshes[0].answer(200, b.fresh(2));
  assert.equal(await waiting, null, 'wer auf den Refresh wartet, ist abgemeldet');
  assert.equal(b.storage.get(STORE), null);
  assert.equal(sessionEvents(tab), 1, 'Seitenskripte erfahren nur vom Abmelden');
});

test('erneuert ein anderer Tab, während der Refresh hier hängt, bekommt der Wartende nach der Frist dessen Sitzung', async () => {
  const b = makeAccountBrowser({ expiresIn: -10 });
  const tab = b.open();
  const other = b.open();
  const waiting = tab.session();
  await b.advance(11000);
  const elsewhere = other.session();
  b.refreshes[1].answer(200, b.fresh(2));
  assert.equal(tokenOf(await elsewhere), 'token-2');
  await b.advance(4000);
  assert.equal(tokenOf(await waiting), 'token-2');
});

test('scheitert der Refresh hier, nachdem ein anderer Tab erneuert hat, bekommt der Wartende dessen Sitzung', async () => {
  for (const outcome of [503, 'offline', 'ohne access_token']) {
    const b = makeAccountBrowser({ expiresIn: -10 });
    const tab = b.open();
    const other = b.open();
    const waiting = tab.session();
    await b.advance(11000);
    const elsewhere = other.session();
    b.refreshes[1].answer(200, b.fresh(2));
    await elsewhere;
    if (outcome === 'offline') b.refreshes[0].offline();
    else if (outcome === 503) b.refreshes[0].answer(503, { message: 'try later' });
    else b.refreshes[0].answer(200, {});
    assert.equal(tokenOf(await waiting), 'token-2', `${outcome}`);
    assert.equal(storedToken(b), 'token-2', `${outcome}`);
  }
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
