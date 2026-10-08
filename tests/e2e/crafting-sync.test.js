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
const LOCAL = { state: 'local', text: 'This device only', login: true, retry: false };
const KARNA_1 = { user_id: 'user-1', slug: 'karna-rifle', owned: true, plan_qty: 0 };
// So liefert account-lite die Sitzung von user-1, wenn ihr Refresh erst nach dem Abmelden landet.
const SESSION_1 = { access_token: 'token-user-1', refresh_token: 'refresh-user-1', user: { id: 'user-1' } };

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
  await b.drain();
  assert.equal(tab.sync().state, 'synced', 'der Zug des vorigen Kontos plant für user-2 keine Wiederholung');
  await b.settle({ horizon: 60000 });
  assert.deepEqual(b.server.requests.filter((r) => r.method !== 'GET'), [], 'nichts wird für user-2 geschrieben');
  assert.deepEqual(JSON.parse(b.storage.get('craft.state.v2.user-2')), { owned: {}, plan: {}, pending: [] });
  assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'false');
  assert.equal(tab.sync().state, 'synced');
});

test('die Gast-Ablage wandert einmal je Anmelden: was das Konto danach auf einem anderen Gerät entfernt, holt sie nicht zurück, auch nicht nach einem Refresh', async () => {
  const cases = [
    { at: 'Abgleich bei Tab-Rückkehr', act: (b, tab) => { b.advance(61000); tab.hide(); tab.show(); } },
    { at: 'Refresh gemeldet', act: (b) => b.landRefresh() },
  ];
  for (const c of cases) {
    const b = makeBrowser({
      session: 'user-1',
      rows: [{ user_id: 'user-1', slug: 'karna-rifle', owned: true, plan_qty: 0 }],
      seed: { [GUEST]: JSON.stringify({ owned: { 'karna-rifle': true }, plan: {} }) },
    });
    const tab = b.open();
    await b.settle();
    assert.ok(b.storage.get(GUEST), 'Voraussetzung: nichts Neues übernommen, die Gast-Ablage liegt noch');

    b.server.rows = [];
    c.act(b, tab);
    await b.settle({ horizon: 60000 });
    assert.deepEqual(b.server.rows, [], c.at);
    assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'false', c.at);
  }
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

test('meldet sich der Besucher ab, während der Abgleich die Zeilen holt, landen sie weder auf dem Gerät noch im nächsten Konto', async () => {
  for (const answer of [undefined, 503]) {
    const at = answer ? `GET mit ${answer}` : 'GET mit Zeilen';
    const b = makeBrowser({ session: 'user-1', rows: [KARNA_1] });
    b.server.hold('GET');
    const tab = b.open();
    await b.settle();
    b.signOut();
    await b.settle();
    b.server.release(answer);
    await b.settle();
    assert.equal(b.storage.get(GUEST), null, at);
    assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'false', at);
    assert.deepEqual(tab.sync(), LOCAL, at);

    b.signIn('user-2');
    await b.settle();
    assert.deepEqual(b.server.rows, [KARNA_1], at);
  }
});

test('meldet sich der Besucher ab, während eine Änderung unterwegs ist, bleibt vom Konto nichts auf dem Gerät und die Anzeige bei „nur dieses Gerät"', async () => {
  for (const answer of [undefined, 'offline']) {
    const at = answer ? `POST ${answer}` : 'POST angekommen';
    const b = makeBrowser({ session: 'user-1' });
    const tab = b.open();
    await b.settle();
    b.server.hold('POST');
    tab.clickOwn('karna-rifle');
    await b.settle();
    b.signOut();
    await b.settle();
    b.server.release(answer);
    await b.settle();
    assert.deepEqual(b.storage.keys().filter((k) => k.startsWith(GUEST)), [], at);
    assert.deepEqual(tab.sync(), LOCAL, at);
  }
});

test('meldet sich der Besucher ab, während der Abgleich noch die Sitzung prüft, fragt der Planer für das alte Konto nichts mehr ab', async () => {
  const b = makeBrowser({ session: 'user-1', rows: [KARNA_1] });
  const tab = b.open();
  await b.settle();
  b.holdSession(1);
  b.advance(61000);
  tab.hide();
  tab.show();
  await b.settle();
  b.signOut();
  await b.settle();
  const before = b.server.requests.length;

  b.releaseSession(SESSION_1);
  await b.settle();
  assert.equal(b.server.requests.length, before);
  assert.equal(b.storage.get(GUEST), null);
  assert.deepEqual(tab.sync(), LOCAL);
});

test('gehört die Sitzung schon einem anderen Konto, bevor dessen Ereignis den Planer erreicht, geht nichts mit ihr hinaus und nichts von ihm in die Kopie des vorigen', async () => {
  const cases = [
    { at: 'beim Abgleich', act: (b, tab) => { b.advance(61000); tab.hide(); tab.show(); } },
    { at: 'beim Senden', act: (b, tab) => tab.clickOwn('karna-rifle') },
  ];
  for (const c of cases) {
    const b = makeBrowser({ session: 'user-1', rows: [{ user_id: 'user-2', slug: 'p4-ar-rifle', owned: true, plan_qty: 0 }] });
    const tab = b.open();
    await b.settle();
    tab.lag();
    b.signIn('user-2');
    c.act(b, tab);
    await b.settle();
    assert.deepEqual(methods(b).filter((m) => m !== 'GET'), [], c.at);
    assert.ok(!String(b.storage.get(MIRROR)).includes('p4-ar-rifle'), c.at);
    assert.notEqual(tab.sync().state, 'error', c.at);

    tab.unlag();
    await b.settle();
    assert.equal(tab.ownButton('p4-ar-rifle').getAttribute('aria-pressed'), 'true', c.at);
    assert.equal(tab.sync().state, 'synced', c.at);
  }
});

test('zwei Tabs ändern während eines Sitzungsausfalls je einen Blueprint, der zweite weiss noch nichts vom ersten: wird der erste geschlossen, kommen trotzdem beide im Konto an', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const one = b.open();
  const two = b.open();
  await b.settle();
  b.breakSession();
  two.lag();
  one.clickOwn('karna-rifle');
  await b.settle();
  two.clickOwn('p4-ar-rifle');
  await b.settle();
  assert.deepEqual(mirror(b).pending, ['karna-rifle', 'p4-ar-rifle']);
  one.close();

  b.healSession();
  await b.settle({ horizon: 60000 });
  assert.deepEqual(b.server.rows.map((r) => r.slug), ['karna-rifle', 'p4-ar-rifle']);
});

test('ein Tab zeigt, was der andere im Planer ändert, und zählt auf diesem Stand weiter, angemeldet wie als Gast', async () => {
  for (const session of [undefined, 'user-1']) {
    const at = session ? 'angemeldet' : 'Gast';
    const b = makeBrowser({ session });
    const one = b.open();
    const two = b.open();
    await b.settle();
    one.clickAdd('karna-rifle');
    one.clickAdd('karna-rifle');
    await b.settle();
    assert.ok(two.addButton('karna-rifle').classList.contains('in-plan'), at);
    if (!session) assert.deepEqual(one.sync(), LOCAL, at);
    two.clickAdd('karna-rifle');
    await b.settle();
    assert.deepEqual(JSON.parse(b.storage.get(session ? MIRROR : GUEST)).plan, { 'karna-rifle': 3 }, at);
    if (session) assert.deepEqual(b.server.rows, [{ user_id: 'user-1', slug: 'karna-rifle', owned: false, plan_qty: 3 }], at);
  }
});

test('zwei Klicks, während die Sitzung noch geprüft wird: wird der Tab davor geschlossen, stehen trotzdem beide in der Konto-Kopie und kommen beim nächsten Besuch an', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open();
  await b.settle();
  b.holdSession();
  tab.clickOwn('karna-rifle');
  await b.settle();
  tab.clickOwn('p4-ar-rifle');
  await b.settle();
  assert.deepEqual(mirror(b).pending, ['karna-rifle', 'p4-ar-rifle']);
  tab.close();

  b.releaseSession();
  b.open();
  await b.settle();
  assert.deepEqual(b.server.rows.map((r) => r.slug), ['karna-rifle', 'p4-ar-rifle']);
});

test('ändert ein Klick einen Blueprint, dessen vorige Änderung noch unterwegs ist, bleibt er offen, bis auch er angekommen ist', async () => {
  const cases = [
    { at: 'Stern', click: (tab) => tab.clickOwn('karna-rifle'), rows: [] },
    { at: 'Planmenge', click: (tab) => tab.clickAdd('karna-rifle'), rows: [{ user_id: 'user-1', slug: 'karna-rifle', owned: false, plan_qty: 2 }] },
  ];
  for (const c of cases) {
    const b = makeBrowser({ session: 'user-1' });
    const tab = b.open();
    await b.settle();
    b.server.hold('POST');
    c.click(tab);
    await b.settle();
    c.click(tab);
    b.server.release();
    await b.drain();
    assert.deepEqual(mirror(b).pending, ['karna-rifle'], c.at);

    await b.settle();
    assert.deepEqual(b.server.rows, c.rows, c.at);
    assert.deepEqual(mirror(b).pending, [], c.at);
  }
});

// Der zweite Zug geht erst hinaus, wenn der erste beantwortet ist. Sonst kann
// er vor ihm beim Server ankommen: der Server behält den ersten Klick, und die
// Bestätigung des zweiten nimmt den Blueprint trotzdem aus `pending`.
const SECOND_CLICK = [
  { at: 'Stern', click: (tab) => tab.clickOwn('karna-rifle'), rows: [], mirror: { owned: {}, plan: {}, pending: [] } },
  {
    at: 'Planmenge', click: (tab) => tab.clickAdd('karna-rifle'),
    rows: [{ user_id: 'user-1', slug: 'karna-rifle', owned: false, plan_qty: 2 }],
    mirror: { owned: {}, plan: { 'karna-rifle': 2 }, pending: [] },
  },
];
async function clickTwiceWhileFirstHangs(b, c, first, second) {
  await b.settle();
  b.server.hold('POST', 'after');
  c.click(first);
  await b.settle();
  c.click(second);
  await b.settle();
  b.server.release();
  await b.settle();
}

test('ein zweiter Klick auf einen Blueprint, dessen erster Zug noch nicht beim Server ist, kommt nach ihm an, und der nächste Abgleich holt den ersten nicht zurück, mit und ohne Web Locks', async () => {
  for (const locks of [true, false]) {
    for (const c of SECOND_CLICK) {
      const at = `${c.at}, ${locks ? 'mit' : 'ohne'} Web Locks`;
      const b = makeBrowser({ session: 'user-1', locks });
      const tab = b.open();
      await clickTwiceWhileFirstHangs(b, c, tab, tab);
      assert.deepEqual(b.server.rows, c.rows, at);
      assert.deepEqual(mirror(b), c.mirror, at);

      b.advance(61000);
      tab.hide();
      tab.show();
      await b.settle();
      assert.deepEqual(mirror(b), c.mirror, at);
    }
  }
});

test('ein Abgleich, der beginnt, während ein Zug unterwegs ist, liest erst nach dessen Antwort: der Klick verschwindet nicht aus der Anzeige', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open();
  await b.settle();
  b.server.hold('POST', 'after');
  tab.clickOwn('karna-rifle');
  await b.settle();
  b.server.hold('GET', 'before');
  b.landRefresh();
  await b.settle();
  b.server.releaseOne();
  await b.settle();
  b.server.release();
  await b.settle();
  assert.deepEqual(b.server.rows, [KARNA_1]);
  assert.deepEqual(mirror(b), { owned: { 'karna-rifle': true }, plan: {}, pending: [] });
  assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'true');
});

test('„Erneut versuchen" schickt die offene Änderung und holt danach den Stand: sie kommt an, auch wenn das Lesen scheitert, und was ein anderes Gerät geändert hat, erscheint', async () => {
  const P4_1 = { user_id: 'user-1', slug: 'p4-ar-rifle', owned: true, plan_qty: 0 };
  const cases = [
    { at: 'Lesen scheitert', before: (b) => b.server.hold('GET'), answer: 503, rows: [KARNA_1], state: 'error', p4: 'false' },
    { at: 'anderes Gerät', before: (b) => b.server.rows.push({ ...P4_1 }), rows: [P4_1, KARNA_1], state: 'synced', p4: 'true' },
  ];
  for (const c of cases) {
    const b = makeBrowser({ session: 'user-1' });
    const tab = b.open();
    await b.settle();
    b.server.hold('POST');
    tab.clickOwn('karna-rifle');
    await b.settle();
    b.server.release(503);
    await b.settle();
    assert.equal(tab.sync().retry, true, c.at);

    c.before(b);
    tab.clickRetry();
    await b.settle();
    b.server.release(c.answer);
    await b.settle();
    assert.deepEqual(b.server.rows, c.rows, c.at);
    assert.equal(tab.sync().state, c.state, c.at);
    assert.equal(tab.ownButton('p4-ar-rifle').getAttribute('aria-pressed'), c.p4, c.at);
  }
});

test('ändert ein zweiter Tab denselben Blueprint, während der Zug des ersten noch nicht beim Server ist, kommt seine Änderung nach dem ersten an', async () => {
  for (const c of SECOND_CLICK) {
    const b = makeBrowser({ session: 'user-1' });
    const one = b.open();
    const two = b.open();
    await clickTwiceWhileFirstHangs(b, c, one, two);
    assert.deepEqual(b.server.rows, c.rows, c.at);
    assert.deepEqual(mirror(b), c.mirror, c.at);
  }
});

test('Tab-Rückkehr und Verlassen der Seite schicken eine offene Änderung sofort, ohne offene fragen sie nicht nach der Sitzung', async () => {
  const cases = [
    { at: 'Tab-Rückkehr', act: (tab) => { tab.hide(); tab.show(); } },
    { at: 'Seite verlassen', act: (tab) => tab.fireWindow('pagehide') },
  ];
  for (const c of cases) {
    const b = makeBrowser({ session: 'user-1' });
    const tab = b.open();
    await b.settle();
    const calls = b.sessionCalls.length;
    c.act(tab);
    await b.drain();
    assert.equal(b.sessionCalls.length, calls, c.at);

    b.breakSession();
    tab.clickOwn('karna-rifle');
    await b.settle({ horizon: 1000 });
    b.healSession();
    c.act(tab);
    await b.drain();
    assert.deepEqual(b.server.rows, [KARNA_1], c.at);
  }
});

test('wer die Seite verlässt, solange eine Änderung offen ist, schickt sie beim Verlassen noch hinaus, obwohl der Browser danach keine Sperre mehr zuteilt', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open();
  await b.settle();
  tab.clickOwn('karna-rifle');
  tab.fireWindow('pagehide');
  tab.close();
  await b.settle();
  assert.deepEqual(b.server.rows, [KARNA_1]);
});

test('„Planer leeren" nimmt jeden Eintrag aus der Ablage und aus dem Konto', async () => {
  for (const session of [undefined, 'user-1']) {
    const at = session ? 'angemeldet' : 'Gast';
    const b = makeBrowser({ session });
    const tab = b.open();
    await b.settle();
    tab.clickAdd('karna-rifle');
    tab.clickAdd('p4-ar-rifle');
    await b.settle();
    tab.clickClear();
    await b.settle();
    assert.deepEqual(JSON.parse(b.storage.get(session ? MIRROR : GUEST)).plan, {}, at);
    assert.deepEqual(b.server.rows, [], at);
  }
});

test('kein Konto-Spiegel überlebt seine Sitzung, auch wenn beim Abmelden oder Kontowechsel kein Planer offen war', async () => {
  const seed = { [MIRROR]: JSON.stringify({ owned: { 'karna-rifle': true }, plan: {}, pending: ['karna-rifle'] }) };
  const cases = [
    { at: 'abgemeldet, ohne offenen Planer', opts: { seed } },
    { at: 'anderes Konto, ohne offenen Planer', opts: { seed, session: 'user-2' } },
    { at: 'anderes Konto, bei offenem Planer', opts: { session: 'user-1' }, act: (b) => b.signIn('user-2') },
  ];
  for (const c of cases) {
    const b = makeBrowser(c.opts);
    b.open();
    await b.settle();
    if (c.act) c.act(b);
    await b.settle();
    assert.equal(b.storage.get(MIRROR), null, c.at);
  }
});

test('wer mit gespeicherter Sitzung lädt, während deren Refresh noch hängt, sieht sofort die Konto-Kopie, und ein Klick geht ins Konto statt in die Gast-Ablage', async () => {
  const b = makeBrowser({
    session: 'user-1', refreshing: true, rows: [KARNA_1],
    seed: { [MIRROR]: JSON.stringify({ owned: { 'karna-rifle': true }, plan: {}, pending: [] }) },
  });
  b.holdSession(1);
  const tab = b.open();
  await b.drain();
  assert.equal(tab.ownButton('karna-rifle').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(tab.sync(), SYNCING);

  tab.clickOwn('p4-ar-rifle');
  await b.drain();
  assert.equal(b.storage.get(GUEST), null);
  assert.deepEqual(mirror(b), { owned: { 'karna-rifle': true, 'p4-ar-rifle': true }, plan: {}, pending: ['p4-ar-rifle'] });

  b.releaseSession(null);
  b.landRefresh();
  await b.settle({ horizon: 60000 });
  assert.deepEqual(b.server.rows.map((r) => r.slug), ['karna-rifle', 'p4-ar-rifle']);
  assert.equal(tab.sync().state, 'synced');
});
