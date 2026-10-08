// Der Konto-Abgleich des Crafting-Planers (assets/crafting-app.js) gegen eine
// In-Memory-Tabelle crafting_entries (tests/e2e/helpers/crafting-dom.js).
//
// VBAccount.session() liefert null auch dann, wenn die Sitzung nur gerade
// nicht nutzbar ist: der Refresh eines abgelaufenen Tokens scheitert an 5xx,
// 429 oder am Netz oder antwortet nicht binnen 15 s. peek() hält sie dann
// noch (tests/e2e/account-session.test.js). Jede Zusicherung liest, was ein
// Besucher oder der Server sieht: die Ablage im localStorage, den Stern der
// Karte, die Sync-Anzeige, die Zeilen der Tabelle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBrowser } from './helpers/crafting-dom.js';

const MIRROR = 'craft.state.v2.user-1';
const GUEST = 'craft.state.v2';
const mirror = (b) => JSON.parse(b.storage.get(MIRROR));
const methods = (b) => b.server.requests.map((r) => r.method);
const gaps = (calls) => calls.slice(1).map((t, i) => t - calls[i]);
const SYNCING = { state: 'syncing', text: 'Syncing…', login: false, retry: false };

test('eine gerade unbrauchbare Sitzung behält Konto-Kopie und offene Änderung, und sie geht hinaus, sobald die Sitzung wieder trägt', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open();
  await b.settle();
  assert.equal(tab.sync().state, 'synced');
  b.breakSession();

  tab.clickOwn('karna-rifle');
  await b.settle();
  assert.deepEqual(mirror(b), { owned: { 'karna-rifle': true }, plan: {}, pending: ['karna-rifle'] });
  assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(tab.sync(), SYNCING, 'kein Abmelden, kein Fehler: die Sitzung gehört noch diesem Konto');

  b.healSession();
  await b.settle({ horizon: 60000 });
  assert.deepEqual(b.server.rows, [{ user_id: 'user-1', slug: 'karna-rifle', owned: true, plan_qty: 0 }],
    'der Planer fragt selbst wieder, ein gescheiterter Refresh meldet sich nicht');
  assert.deepEqual(mirror(b), { owned: { 'karna-rifle': true }, plan: {}, pending: [] });
  assert.equal(tab.sync().state, 'synced');
});

test('wer mit unbrauchbarer Sitzung lädt, sieht die Konto-Kopie statt der Gast-Ablage, und die offene Änderung samt Gast-Einträgen geht hinaus', async () => {
  const b = makeBrowser({
    session: 'user-1', refreshing: true,
    seed: {
      [MIRROR]: JSON.stringify({ owned: { 'karna-rifle': true }, plan: {}, pending: ['karna-rifle'] }),
      [GUEST]: JSON.stringify({ owned: { 'p4-ar-rifle': true }, plan: {} }),
    },
  });
  const tab = b.open();
  await b.drain();
  assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'true');
  assert.equal(tab.ownButton('p4-ar-rifle').getAttribute('aria-pressed'), 'false', 'die Gast-Ablage wartet auf ihre Übernahme');
  assert.deepEqual(tab.sync(), SYNCING, 'gleich nach dem Laden, nicht erst beim nächsten Versuch');

  b.healSession();
  await b.settle({ horizon: 60000 });
  assert.deepEqual(b.server.rows, [
    { user_id: 'user-1', slug: 'karna-rifle', owned: true, plan_qty: 0 },
    { user_id: 'user-1', slug: 'p4-ar-rifle', owned: true, plan_qty: 0 },
  ]);
  assert.equal(b.storage.get(GUEST), null, 'die Übernahme, die beim Laden ausfiel, holt der nächste Versuch nach');
  assert.deepEqual(mirror(b), { owned: { 'karna-rifle': true, 'p4-ar-rifle': true }, plan: {}, pending: [] });
  assert.equal(tab.sync().state, 'synced');
});

test('bleibt die Sitzung unbrauchbar, fragt der Planer nach 2 s wieder, dann doppelt so lange, höchstens einmal je Minute, und ein neuer Ausfall beginnt wieder bei 2 s', async () => {
  const b = makeBrowser({ session: 'user-1', refreshing: true });
  const tab = b.open();
  await b.settle({ horizon: 300000 });
  assert.deepEqual(gaps(b.sessionCalls), [2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  assert.deepEqual(tab.sync(), SYNCING);

  b.healSession();
  await b.settle({ horizon: 61000 });
  assert.equal(tab.sync().state, 'synced');
  b.breakSession();
  const from = b.sessionCalls.length;
  tab.clickOwn('karna-rifle');
  await b.settle({ horizon: 10000 });
  assert.deepEqual(gaps(b.sessionCalls.slice(from)), [2000, 4000]);
});

test('zwei Klicks, während die Sitzung noch geprüft wird: kommt die Prüfung ohne Sitzung zurück, stehen beide in der Konto-Kopie und überstehen das Schliessen des Tabs', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open();
  await b.settle();
  b.holdSession();
  tab.clickOwn('karna-rifle');
  await b.settle();
  tab.clickOwn('p4-ar-rifle');
  await b.settle();
  b.breakSession();
  b.releaseSession();
  await b.settle();
  assert.deepEqual(mirror(b).pending, ['karna-rifle', 'p4-ar-rifle']);
  tab.close();

  b.healSession();
  b.open();
  await b.settle();
  assert.deepEqual(b.server.rows.map((r) => r.slug), ['karna-rifle', 'p4-ar-rifle']);
});

test('wer klickt, während der Planer beim Laden auf den Refresh wartet, findet den Klick im Konto, auch wenn der Refresh erst nach der Frist landet', async () => {
  const b = makeBrowser({ session: 'user-1', refreshing: true });
  b.holdSession(1);
  const tab = b.open();
  await b.drain();
  tab.clickOwn('karna-rifle');
  await b.settle();
  b.releaseSession(null);
  await b.drain();

  b.landRefresh();
  await b.settle({ horizon: 60000 });
  assert.deepEqual(b.server.rows, [{ user_id: 'user-1', slug: 'karna-rifle', owned: true, plan_qty: 0 }]);
  assert.equal(b.storage.get(GUEST), null, 'die Übernahme hängt nicht am Weg, auf dem die Sitzung zurückkam');
  assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'true');
  assert.equal(tab.sync().state, 'synced');
});

test('meldet sich ein anderes Konto an, während die Sitzung noch geprüft wird, landet keine Änderung des vorigen Kontos im neuen', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open();
  await b.settle();
  b.holdSession(1);
  tab.clickOwn('karna-rifle');
  await b.settle();
  b.signIn('user-2');
  await b.settle();

  b.releaseSession(null);
  await b.settle({ horizon: 60000 });
  assert.deepEqual(b.server.requests.filter((r) => r.method !== 'GET'), [], 'nichts wird für user-2 geschrieben');
  assert.deepEqual(JSON.parse(b.storage.get('craft.state.v2.user-2')), { owned: {}, plan: {}, pending: [] });
  assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'false');
  assert.equal(tab.sync().state, 'synced');
});

test('die Gast-Ablage wandert einmal je Anmelden: was das Konto danach auf einem anderen Gerät entfernt, holt sie nicht zurück', async () => {
  const b = makeBrowser({
    session: 'user-1',
    rows: [{ user_id: 'user-1', slug: 'karna-rifle', owned: true, plan_qty: 0 }],
    seed: { [GUEST]: JSON.stringify({ owned: { 'karna-rifle': true }, plan: {} }) },
  });
  const tab = b.open();
  await b.settle();
  assert.ok(b.storage.get(GUEST), 'Voraussetzung: nichts Neues übernommen, die Gast-Ablage liegt noch');

  b.server.rows = [];
  b.advance(61000);
  tab.hide();
  tab.show();
  await b.settle({ horizon: 60000 });
  assert.deepEqual(b.server.rows, []);
  assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'false');
});

test('meldet account-lite einen gelungenen Refresh, gleicht der Planer sofort ab und fragt danach nicht noch einmal', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open();
  await b.settle();
  b.breakSession();
  tab.clickOwn('karna-rifle');
  await b.settle();

  b.landRefresh();
  await b.drain();
  assert.deepEqual(b.server.rows, [{ user_id: 'user-1', slug: 'karna-rifle', owned: true, plan_qty: 0 }]);
  await b.settle({ horizon: 120000 });
  assert.deepEqual(methods(b), ['GET', 'GET', 'POST'], 'der geplante Versuch ist mit dem Abgleich erledigt');
  assert.equal(tab.sync().state, 'synced');
});

test('ohne gespeicherte Sitzung ist der Besucher abgemeldet: die Konto-Kopie verschwindet samt offener Änderung', async () => {
  const cases = [
    { at: 'Abmelden in einem anderen Tab', act: (b, tab) => { tab.clickOwn('karna-rifle'); b.signOut(); } },
    { at: 'Refresh beim Senden abgelehnt', act: (b, tab) => { tab.clickOwn('karna-rifle'); b.rejectRefresh(); } },
    { at: 'Refresh beim Abgleich abgelehnt', act: (b, tab) => { b.rejectRefresh(); b.advance(61000); tab.hide(); tab.show(); } },
    { at: 'Abmelden, dessen Ereignis noch unterwegs ist', act: (b, tab) => { tab.clickOwn('karna-rifle'); tab.lag(); b.signOut(); } },
  ];
  for (const c of cases) {
    const b = makeBrowser({ session: 'user-1' });
    const tab = b.open();
    await b.settle();
    c.act(b, tab);
    await b.settle({ horizon: 60000 });
    assert.equal(b.storage.get(MIRROR), null, c.at);
    assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'false', c.at);
    assert.deepEqual(tab.sync(), { state: 'local', text: 'This device only', login: true, retry: false }, c.at);
    assert.deepEqual(b.server.rows, [], c.at);
  }
});
