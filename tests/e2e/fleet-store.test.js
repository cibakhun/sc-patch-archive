// Die Flotte (assets/fleet.js) gegen einen Browser mit mehreren Tabs und
// einer In-Memory-Tabelle favorites (tests/e2e/helpers/fleet-dom.js).
//
// Jede Zusicherung liest, was ein Besucher oder der Server sieht: Zeilen in
// der Tabelle, den Schnappschuss, die Ablage im localStorage, den Zustand des
// Knopfs. Der angemeldete Weg ist nur hier nachgewiesen — im Browser prüft ihn
// der Betreiber auf staging (kein Test meldet sich echt an).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBrowser } from './helpers/fleet-dom.js';

const GLADIUS = { ship: 'aegs-gladius', label: 'Gladius', on: 'In fleet', off: 'Add to fleet' };
const CUTLASS = { ship: 'drak-cutlass-black', label: 'Cutlass Black', on: 'In fleet', off: 'Add to fleet' };
const postsOf = (b) => b.server.requests.filter((r) => r.method === 'POST').length;

test('ein Gast-Klick bleibt in diesem Browser, übersteht das Neuladen und erscheint im zweiten Tab', async () => {
  const b = makeBrowser();
  const tab = b.open({ buttons: [GLADIUS] });
  const other = b.open();
  await b.settle();

  tab.click(tab.button());
  await b.settle();
  assert.equal(b.storage.get('vb.fleet.v1'), '{"ships":[{"id":"aegs-gladius","label":"Gladius"}]}');
  assert.equal(tab.button().getAttribute('aria-pressed'), 'true');
  assert.equal(tab.button().textContent, 'In fleet');
  assert.deepEqual(other.ids(), ['aegs-gladius'], 'der zweite Tab folgt über das storage-Ereignis');
  assert.deepEqual(b.server.requests, [], 'ein Gast spricht den Server nie an');

  tab.close();
  const reloaded = b.open({ buttons: [GLADIUS] });
  await b.settle();
  assert.deepEqual(reloaded.snapshot(), { ids: ['aegs-gladius'], mode: 'guest', sync: 'local', error: null, merged: 0 });
  assert.equal(reloaded.button().getAttribute('aria-pressed'), 'true');
});

test('beim Anmelden wandern nur fehlende Gast-Schiffe ins Konto, danach ist die Gast-Kopie leer', async () => {
  const b = makeBrowser({
    guest: [{ id: 'aegs-gladius', label: 'Gladius' }, { id: 'anvl-arrow', label: 'Arrow' }],
    rows: [{ slug: 'anvl-arrow', label: 'Arrow' }],
  });
  const tab = b.open();
  await b.settle();
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius', 'anvl-arrow'], mode: 'guest', sync: 'local', error: null, merged: 0 });

  b.signIn('user-1');
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['anvl-arrow', 'aegs-gladius']);
  assert.equal(b.storage.get('vb.fleet.v1'), null);
  assert.equal(b.storage.get('vb.fleet.v1.user-1'),
    '{"ships":[{"id":"anvl-arrow","label":"Arrow"},{"id":"aegs-gladius","label":"Gladius"}],"pending":{},"merged":1}');
  assert.deepEqual(tab.snapshot(), { ids: ['anvl-arrow', 'aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 1 });

  tab.close();
  const reloaded = b.open();
  await b.settle();
  assert.equal(postsOf(b), 1, 'ein zweiter Lauf schickt nichts mehr');
  assert.deepEqual(reloaded.snapshot(), { ids: ['anvl-arrow', 'aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 1 },
    'der Hinweis steht, bis ihn jemand schliesst');
});

test('eine an jeder Stelle abgebrochene Übernahme endet nach dem Neuladen im selben Stand, ohne doppelte Zeile', async () => {
  const crashes = [
    { at: 'GET unterwegs', hold: ['GET', 'after'], rowsAtCrash: [], merged: 1 },
    { at: 'POST noch nicht angekommen', hold: ['POST', 'after'], rowsAtCrash: [], merged: 1 },
    { at: 'POST geschrieben, Antwort verloren', hold: ['POST', 'before'], rowsAtCrash: ['aegs-gladius'], merged: 0 },
  ];
  for (const c of crashes) {
    const b = makeBrowser({ session: 'user-1', unique: false, guest: [{ id: 'aegs-gladius', label: 'Gladius' }] });
    b.server.hold(...c.hold);
    const first = b.open();
    await b.settle();
    assert.deepEqual(b.server.slugs(), c.rowsAtCrash, c.at);
    assert.equal(b.storage.get('vb.fleet.v1'), '{"ships":[{"id":"aegs-gladius","label":"Gladius"}]}',
      `${c.at}: die Gast-Kopie bleibt, bis der Server bestätigt hat`);
    first.close();

    const second = b.open();
    await b.settle();
    assert.deepEqual(b.server.slugs(), ['aegs-gladius'], c.at);
    assert.equal(b.storage.get('vb.fleet.v1'), null, c.at);
    assert.equal(b.storage.get('vb.fleet.v1.user-1'),
      `{"ships":[{"id":"aegs-gladius","label":"Gladius"}],"pending":{}${c.merged ? ',"merged":1' : ''}}`, c.at);
    assert.deepEqual(second.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: c.merged }, c.at);
  }
});

test('eine abgelehnte Übernahme behält die Gast-Kopie, zeigt den Fehler und gelingt beim erneuten Versuch', async () => {
  const b = makeBrowser({ session: 'user-1', guest: [{ id: 'aegs-gladius', label: 'Gladius' }] });
  b.server.fail('POST', 500);
  const tab = b.open({ retry: true });
  await b.settle();
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'error', error: 'write', merged: 0 });
  assert.equal(b.storage.get('vb.fleet.v1'), '{"ships":[{"id":"aegs-gladius","label":"Gladius"}]}');
  assert.equal(tab.retryButton().hidden, false);

  tab.click(tab.retryButton());
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.equal(b.storage.get('vb.fleet.v1'), null);
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 1 });
  assert.equal(tab.retryButton().hidden, true);
});

test('ein Klick im Konto auf ein noch nicht übernommenes Gast-Schiff gilt, die Gast-Kopie überstimmt ihn nicht', async () => {
  const b = makeBrowser({ session: 'user-1', guest: [{ id: 'aegs-gladius', label: 'Gladius' }] });
  b.server.fail('POST', 500);
  const tab = b.open({ buttons: [GLADIUS] });
  await b.settle();
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'error', error: 'write', merged: 0 });

  tab.click(tab.button());
  await b.settle();
  assert.deepEqual(b.server.slugs(), []);
  assert.equal(b.storage.get('vb.fleet.v1'), null);
  assert.deepEqual(tab.snapshot(), { ids: [], mode: 'account', sync: 'synced', error: null, merged: 0 });
});

test('ein abgelehnter Klick bleibt stehen, sagt es und geht beim erneuten Versuch hinaus', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open({ buttons: [CUTLASS] });
  await b.settle();
  b.server.fail('POST', 500);

  tab.click(tab.button());
  await b.settle();
  assert.deepEqual(tab.snapshot(), { ids: ['drak-cutlass-black'], mode: 'account', sync: 'error', error: 'write', merged: 0 });
  assert.equal(tab.button().getAttribute('aria-pressed'), 'true', 'der Klick wird nicht still zurückgenommen');
  assert.equal(JSON.parse(b.storage.get('vb.fleet.v1.user-1')).pending['drak-cutlass-black'].op, 'add');
  assert.deepEqual(b.server.slugs(), []);

  const retried = tab.fleet.retry();
  await b.settle();
  await retried;
  assert.deepEqual(b.server.slugs(), ['drak-cutlass-black']);
  assert.equal(b.storage.get('vb.fleet.v1.user-1'), '{"ships":[{"id":"drak-cutlass-black","label":"Cutlass Black"}],"pending":{}}');
  assert.deepEqual(tab.snapshot(), { ids: ['drak-cutlass-black'], mode: 'account', sync: 'synced', error: null, merged: 0 });
});

test('ein Klick ohne Netz übersteht das Schliessen des Tabs und geht beim nächsten Besuch hinaus', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open({ buttons: [GLADIUS] });
  await b.settle();
  b.server.offline('POST');
  tab.click(tab.button());
  await b.settle();
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'error', error: 'offline', merged: 0 });
  tab.close();

  const next = b.open();
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.deepEqual(next.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 0 });
});

test('ein zweites Senden nach verlorener Antwort ist harmlos: 409 und ein DELETE ohne Treffer gelten als erledigt', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open({ buttons: [GLADIUS] });
  await b.settle();
  b.server.hold('POST', 'before');
  tab.click(tab.button());
  await b.settle();
  tab.close();

  const reloaded = b.open({ buttons: [GLADIUS] });
  await b.settle();
  assert.equal(postsOf(b), 2, 'der Klick ging nach dem Neuladen noch einmal hinaus');
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.deepEqual(reloaded.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 0 });

  b.server.rows = [];
  reloaded.click(reloaded.button());
  await b.settle();
  assert.deepEqual(reloaded.snapshot(), { ids: [], mode: 'account', sync: 'synced', error: null, merged: 0 });
  assert.equal(b.storage.get('vb.fleet.v1.user-1'), '{"ships":[],"pending":{}}');
});

test('zwei Tabs ohne Web Locks schicken denselben Klick doppelt: das Schiff erscheint einmal und geht mit allen Zeilen', async () => {
  const b = makeBrowser({ session: 'user-1', unique: false, locks: false });
  const a = b.open({ buttons: [GLADIUS] });
  const c = b.open({ buttons: [GLADIUS] });
  await b.settle();
  b.server.hold('POST', 'after');
  b.server.hold('POST', 'after');

  a.click(a.button());
  c.fleet.retry();
  await b.settle();
  b.server.release();
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius', 'aegs-gladius']);
  assert.deepEqual(a.ids(), ['aegs-gladius']);
  assert.deepEqual(c.ids(), ['aegs-gladius']);

  c.click(c.button());
  await b.settle();
  assert.deepEqual(b.server.slugs(), [], 'DELETE per slug nimmt jede Zeile dieses Schiffs mit');
  assert.deepEqual(a.ids(), []);
});

test('mit Web Locks schickt derselbe Klick aus zwei Tabs genau eine Zeile', async () => {
  const b = makeBrowser({ session: 'user-1', unique: false });
  const a = b.open({ buttons: [GLADIUS] });
  const c = b.open({ buttons: [GLADIUS] });
  await b.settle();
  b.server.hold('POST', 'after');

  a.click(a.button());
  c.fleet.retry();
  await b.settle();
  b.server.release();
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.equal(postsOf(b), 1);
  assert.deepEqual(a.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 0 });
});

test('eine späte Antwort auf den ersten Klick löscht den neueren zweiten Klick nicht', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open({ buttons: [CUTLASS] });
  await b.settle();
  b.server.hold('POST', 'before');

  tab.click(tab.button());
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['drak-cutlass-black'], 'der Server hat geschrieben, die Antwort steht noch aus');
  tab.click(tab.button());
  assert.equal(JSON.parse(b.storage.get('vb.fleet.v1.user-1')).pending['drak-cutlass-black'].op, 'del');

  b.server.release();
  await b.settle();
  assert.deepEqual(b.server.slugs(), []);
  assert.deepEqual(tab.snapshot(), { ids: [], mode: 'account', sync: 'synced', error: null, merged: 0 });
  assert.equal(tab.button().getAttribute('aria-pressed'), 'false');
});

test('ein GET, der vor einem Klick abging, macht den Klick nicht rückgängig', async () => {
  const b = makeBrowser({ session: 'user-1', rows: [{ slug: 'anvl-arrow', label: 'Arrow' }] });
  b.server.hold('GET', 'after');
  const tab = b.open({ buttons: [GLADIUS] });
  await b.settle();
  tab.click(tab.button());

  b.server.release();
  await b.settle();
  assert.deepEqual(tab.ids(), ['anvl-arrow', 'aegs-gladius']);
  assert.deepEqual(b.server.slugs(), ['anvl-arrow', 'aegs-gladius']);
});

test('Abmelden räumt jeden Konto-Spiegel weg und zeigt wieder die Gast-Flotte', async () => {
  const b = makeBrowser({ session: 'user-1', rows: [{ slug: 'aegs-gladius', label: 'Gladius' }] });
  const tab = b.open();
  await b.settle();
  assert.deepEqual(b.storage.keys(), ['vb.fleet.v1.user-1']);

  b.signOut();
  await b.settle();
  assert.deepEqual(b.storage.keys(), []);
  assert.deepEqual(tab.snapshot(), { ids: [], mode: 'guest', sync: 'local', error: null, merged: 0 });

  const leftover = makeBrowser({ seed: { 'vb.fleet.v1.user-9': '{"ships":[{"id":"anvl-arrow","label":"Arrow"}],"pending":{}}' } });
  const guest = leftover.open();
  await leftover.settle();
  assert.deepEqual(leftover.storage.keys(), [], 'der Spiegel eines Vorgängers bleibt ohne Sitzung nicht liegen');
  assert.deepEqual(guest.snapshot(), { ids: [], mode: 'guest', sync: 'local', error: null, merged: 0 });
});

test('eine gerade unbrauchbare Sitzung behält den offenen Klick, gilt als Abgleich und liefert ihn bei der Rückkehr auf den Tab', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open({ buttons: [GLADIUS], retry: true });
  await b.settle();
  b.breakSession();

  tab.click(tab.button());
  await b.settle();
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'syncing', error: null, merged: 0 });
  assert.equal(tab.retryButton().hidden, true, 'kein Fehler: die Sitzung gehört noch diesem Konto');
  assert.equal(JSON.parse(b.storage.get('vb.fleet.v1.user-1')).pending['aegs-gladius'].op, 'add');

  b.healSession();
  tab.hide();
  tab.show();
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 0 });
});

test('bei der Rückkehr auf den Tab nach einer Minute holt die Flotte, was ein anderes Gerät geändert hat', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open();
  await b.settle();
  b.server.insert('anvl-arrow', 'Arrow');

  b.advance(61000);
  tab.hide();
  tab.show();
  await b.settle();
  assert.deepEqual(tab.ids(), ['anvl-arrow']);
});

test('der Knopf liest Schiff und Namen beim Klick und zeigt den Zustand mit aria-pressed und Beschriftung', async () => {
  const b = makeBrowser();
  const tab = b.open({ buttons: [GLADIUS] });
  await b.settle();
  assert.equal(tab.button().getAttribute('aria-pressed'), 'false');

  tab.button().setAttribute('data-fleet-ship', 'anvl-arrow');
  tab.button().setAttribute('data-fleet-label', 'Arrow');
  tab.click(tab.button());
  await b.settle();
  assert.equal(b.storage.get('vb.fleet.v1'), '{"ships":[{"id":"anvl-arrow","label":"Arrow"}]}');
  assert.equal(tab.button().getAttribute('aria-pressed'), 'true');
  assert.equal(tab.button().textContent, 'In fleet');

  tab.click(tab.button());
  await b.settle();
  assert.equal(tab.button().getAttribute('aria-pressed'), 'false');
  assert.equal(tab.button().textContent, 'Add to fleet');
});

test('kaputte oder fremde Einträge im Speicher und ungültige ids werden übergangen', async () => {
  const b = makeBrowser({
    seed: { 'vb.fleet.v1': '{"ships":[{"id":"aegs-gladius","label":"Gladius"},{"id":"<b>x</b>"},{"id":"aegs-gladius"},"x",null]}' },
  });
  const tab = b.open();
  await b.settle();
  assert.deepEqual(tab.ids(), ['aegs-gladius']);
  assert.equal(await tab.fleet.toggle('Not An Id', 'x'), false);
  assert.deepEqual(tab.ids(), ['aegs-gladius']);

  const broken = makeBrowser({ seed: { 'vb.fleet.v1': '{nicht json' } });
  const other = broken.open();
  await broken.settle();
  assert.equal(await other.fleet.toggle('anvl-arrow', 'Arrow'), true);
  assert.equal(broken.storage.get('vb.fleet.v1'), '{"ships":[{"id":"anvl-arrow","label":"Arrow"}]}');
});

test('Abmelden, während ein Abgleich hängt: der Klick eines neuen Gasts landet nicht im alten Konto', async () => {
  const b = makeBrowser({ session: 'user-1' });
  b.server.hold('GET', 'after');
  const old = b.open();
  await b.settle();
  b.signOut();
  await b.settle();
  assert.deepEqual(old.snapshot(), { ids: [], mode: 'guest', sync: 'local', error: null, merged: 0 });
  assert.deepEqual(b.storage.keys(), []);

  const next = b.open({ buttons: [GLADIUS] });
  await b.settle();
  next.click(next.button());
  await b.settle();
  b.server.release();
  await b.settle();
  assert.deepEqual(b.server.slugs('user-1'), []);
  assert.equal(b.storage.get('vb.fleet.v1'), '{"ships":[{"id":"aegs-gladius","label":"Gladius"}]}');
  assert.deepEqual(old.ids(), ['aegs-gladius']);
});

test('entfernt ein zweiter Tab ein Gast-Schiff, während die Übernahme läuft, geht es nicht ins Konto', async () => {
  const b = makeBrowser({ guest: [{ id: 'aegs-gladius', label: 'Gladius' }, { id: 'anvl-arrow', label: 'Arrow' }] });
  const first = b.open();
  const second = b.open({ buttons: [{ ship: 'anvl-arrow', label: 'Arrow', on: 'In fleet', off: 'Add to fleet' }] });
  await b.settle();
  b.server.hold('POST', 'after');
  b.signIn('user-1');
  await b.settle();

  second.click(second.button());
  await b.settle();
  b.server.release();
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.deepEqual(first.ids(), ['aegs-gladius']);
  assert.deepEqual(second.ids(), ['aegs-gladius']);
});

test('eine abgelehnte Schreibung hält die übrigen Klicks nicht auf', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open({ buttons: [GLADIUS, CUTLASS] });
  await b.settle();
  b.server.fail('POST', 400);

  tab.click(tab.button(0));
  tab.click(tab.button(1));
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['drak-cutlass-black']);
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius', 'drak-cutlass-black'], mode: 'account', sync: 'error', error: 'write', merged: 0 });
  assert.equal(JSON.parse(b.storage.get('vb.fleet.v1.user-1')).pending['aegs-gladius'].op, 'add');
});

test('ein Tab bleibt nicht auf "syncing" stehen, wenn ein anderer Tab den offenen Klick bestätigt', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const a = b.open();
  const c = b.open({ buttons: [GLADIUS] });
  await b.settle();
  b.server.hold('GET', 'after');

  a.fleet.retry();
  await b.drain();
  c.click(c.button());
  await b.settle();
  b.server.release();
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.deepEqual(a.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 0 });
  assert.deepEqual(c.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 0 });
});

test('ein Klick während des Sendens ersetzt die ältere Absicht, bevor sie hinausgeht', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open({ buttons: [CUTLASS, GLADIUS] });
  await b.settle();
  b.server.hold('POST', 'after');

  tab.click(tab.button(0));
  tab.click(tab.button(1));
  await b.settle();
  tab.click(tab.button(1));
  b.server.release();
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['drak-cutlass-black']);
  assert.deepEqual(b.server.requests.filter((r) => r.body && r.body.slug === 'aegs-gladius'), [],
    'das veraltete POST für die Gladius geht nie hinaus');
  assert.deepEqual(tab.snapshot(), { ids: ['drak-cutlass-black'], mode: 'account', sync: 'synced', error: null, merged: 0 });
});

test('nur der sichtbare Tab übernimmt die Gast-Flotte, der Hinweis gilt für jeden Tab des Kontos', async () => {
  const b = makeBrowser({ guest: [{ id: 'aegs-gladius', label: 'Gladius' }] });
  const background = b.open();
  background.hide();
  const front = b.open();
  await b.settle();

  b.signIn('user-1');
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.equal(postsOf(b), 1);
  assert.equal(front.snapshot().merged, 1);
  assert.equal(background.snapshot().merged, 1);
  assert.deepEqual(background.ids(), ['aegs-gladius']);
});

test('ein 409 ohne doppelte Zeile (etwa ein Fremdschlüssel) gilt nicht als erledigt', async () => {
  const b = makeBrowser({ session: 'user-1', guest: [{ id: 'aegs-gladius', label: 'Gladius' }] });
  b.server.fail('POST', 409);
  const tab = b.open();
  await b.settle();
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'error', error: 'write', merged: 0 });
  assert.equal(b.storage.get('vb.fleet.v1'), '{"ships":[{"id":"aegs-gladius","label":"Gladius"}]}');
});

test('aus dem bfcache zurück zeigt der Tab nach einem Abmelden wieder die Gast-Flotte', async () => {
  const b = makeBrowser({ session: 'user-1', rows: [{ slug: 'aegs-gladius', label: 'Gladius' }] });
  const tab = b.open({ buttons: [GLADIUS] });
  await b.settle();
  assert.equal(tab.button().getAttribute('aria-pressed'), 'true');

  tab.freeze();
  b.signOut();
  await b.settle();
  tab.thaw();
  await b.settle();
  assert.deepEqual(tab.snapshot(), { ids: [], mode: 'guest', sync: 'local', error: null, merged: 0 });
  assert.equal(tab.button().getAttribute('aria-pressed'), 'false');
  assert.deepEqual(b.storage.keys(), []);
});

test('meldet sich ein anderes Konto an, verlässt der Spiegel des vorigen den Browser', async () => {
  const b = makeBrowser({
    session: 'user-1',
    rows: [{ slug: 'aegs-gladius', label: 'Gladius' }, { slug: 'anvl-arrow', label: 'Arrow', user_id: 'user-2' }],
  });
  const tab = b.open();
  await b.settle();
  assert.deepEqual(b.storage.keys(), ['vb.fleet.v1.user-1']);

  b.signIn('user-2');
  await b.settle();
  assert.deepEqual(b.storage.keys(), ['vb.fleet.v1.user-2']);
  assert.deepEqual(tab.snapshot(), { ids: ['anvl-arrow'], mode: 'account', sync: 'synced', error: null, merged: 0 });
});

test('toggle() im Konto antwortet erst, wenn der Schreibversuch gelaufen ist', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open();
  await b.settle();
  let answered = null;
  tab.fleet.toggle('anvl-arrow', 'Arrow').then((v) => { answered = v; });
  await b.drain();
  assert.equal(answered, null, 'vor dem Senden steht noch keine Antwort');
  assert.deepEqual(b.server.slugs(), []);

  await b.settle();
  assert.equal(answered, true);
  assert.deepEqual(b.server.slugs(), ['anvl-arrow']);
});

test('angemeldet zeigt die Seite den Spiegel sofort, noch bevor der Server antwortet', async () => {
  const b = makeBrowser({
    session: 'user-1',
    seed: { 'vb.fleet.v1.user-1': '{"ships":[{"id":"aegs-gladius","label":"Gladius"}],"pending":{}}' },
  });
  b.server.hold('GET', 'after');
  const tab = b.open({ buttons: [GLADIUS] });
  assert.deepEqual(tab.ids(), ['aegs-gladius']);
  assert.equal(tab.button().getAttribute('aria-pressed'), 'true');
});

test('eine hängende Anfrage gibt die Sperre nach 20 Sekunden frei', async () => {
  const b = makeBrowser({ session: 'user-1' });
  b.server.hold('GET', 'after');
  const stuck = b.open();
  await b.settle();
  const other = b.open({ buttons: [GLADIUS] });
  await b.settle();
  other.click(other.button());
  await b.settle();
  assert.deepEqual(b.server.slugs(), [], 'solange die Sperre hängt, geht nichts hinaus');

  b.advance(20000);
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.deepEqual(other.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 0 });
  assert.deepEqual(stuck.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'error', error: 'offline', merged: 0 });
});

test('ohne nutzbaren Speicher schaltet der Gast-Knopf trotzdem an und wieder aus', async () => {
  const b = makeBrowser({ storageBroken: true });
  const tab = b.open({ buttons: [GLADIUS] });
  await b.settle();
  tab.click(tab.button());
  await b.settle();
  assert.equal(tab.button().getAttribute('aria-pressed'), 'true');

  tab.click(tab.button());
  await b.settle();
  assert.equal(tab.button().getAttribute('aria-pressed'), 'false');
  assert.deepEqual(tab.snapshot(), { ids: [], mode: 'guest', sync: 'local', error: null, merged: 0 });
});

test('Abmelden mitten in der Übernahme: der Rest der Gast-Flotte bleibt in diesem Browser', async () => {
  const b = makeBrowser({ session: 'user-1', guest: [{ id: 'aegs-gladius', label: 'Gladius' }, { id: 'anvl-arrow', label: 'Arrow' }] });
  b.server.hold('POST', 'after');
  const tab = b.open();
  await b.settle();
  b.server.release();
  b.signOut();
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.equal(b.storage.get('vb.fleet.v1'), '{"ships":[{"id":"anvl-arrow","label":"Arrow"}]}');
  assert.deepEqual(tab.snapshot(), { ids: ['anvl-arrow'], mode: 'guest', sync: 'local', error: null, merged: 0 });
});

test('entfernt ein Tab, der vom Anmelden noch nichts weiss, ein Gast-Schiff, geht es nicht ins Konto', async () => {
  const b = makeBrowser({ guest: [{ id: 'aegs-gladius', label: 'Gladius' }, { id: 'anvl-arrow', label: 'Arrow' }] });
  const first = b.open();
  const late = b.open({ buttons: [{ ship: 'anvl-arrow', label: 'Arrow', on: 'In fleet', off: 'Add to fleet' }] });
  await b.settle();
  b.server.hold('POST', 'after');
  late.lag();
  b.signIn('user-1');
  await b.settle();

  late.click(late.button());
  b.server.release();
  await b.settle();
  late.unlag();
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius']);
  assert.deepEqual(first.ids(), ['aegs-gladius']);
  assert.deepEqual(late.ids(), ['aegs-gladius']);
});

test('läuft ein Refresh im selben Tab, wartet die Flotte als Abgleich und gleicht ab, sobald er gelandet ist, ohne jedes Ereignis', async () => {
  const b = makeBrowser({
    session: 'user-1', refreshing: true,
    rows: [{ slug: 'anvl-arrow', label: 'Arrow' }], guest: [{ id: 'aegs-gladius', label: 'Gladius' }],
  });
  const tab = b.open({ buttons: [GLADIUS], retry: true });
  await b.settle();
  assert.deepEqual(tab.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'syncing', error: null, merged: 0 });
  assert.equal(tab.retryButton().hidden, true, 'kein "nicht gespeichert", solange der Refresh läuft');

  b.landRefresh();
  await b.settle({ horizon: 60000 });
  assert.deepEqual(b.server.slugs(), ['anvl-arrow', 'aegs-gladius']);
  assert.equal(b.storage.get('vb.fleet.v1'), null);
  assert.deepEqual(tab.snapshot(), { ids: ['anvl-arrow', 'aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 1 });
  assert.equal(tab.button().getAttribute('aria-pressed'), 'true');
});

test('hängt session() in einem Tab, endet sein Lauf nach 20 Sekunden offline, und der Klick eines anderen Tabs geht hinaus', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const stuck = b.open();
  await b.settle();
  stuck.hangSession();
  stuck.fleet.retry();
  await b.drain();
  const other = b.open({ buttons: [GLADIUS] });
  await b.settle();
  other.click(other.button());
  await b.settle();
  assert.deepEqual(b.server.slugs(), [], 'solange der Lauf die Sperre hält, geht nichts hinaus');

  b.advance(20000);
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius'], 'nach der Frist ist die Sperre frei');
  assert.deepEqual(other.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'synced', error: null, merged: 0 });
  assert.deepEqual(stuck.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'error', error: 'offline', merged: 0 });
});

test('kommt der Körper einer Antwort nie an, endet der Lauf ebenso nach 20 Sekunden offline', async () => {
  const b = makeBrowser({ session: 'user-1' });
  b.server.hangBody('GET');
  const stuck = b.open();
  await b.settle();
  const other = b.open({ buttons: [GLADIUS] });
  await b.settle();
  other.click(other.button());
  await b.settle();
  assert.deepEqual(b.server.slugs(), []);

  b.advance(20000);
  await b.settle();
  assert.deepEqual(b.server.slugs(), ['aegs-gladius'], 'nach der Frist ist die Sperre frei');
  assert.deepEqual(stuck.snapshot(), { ids: ['aegs-gladius'], mode: 'account', sync: 'error', error: 'offline', merged: 0 });
});

test('der Wiederholen-Knopf sagt "nicht gespeichert" nur, solange ein Klick das Konto nicht erreicht hat', async () => {
  const unsaved = 'Not saved · try again';
  const unsynced = 'Not synced · try again';
  const cases = [
    { at: 'abgelehntes Schreiben', click: true, setup: (b) => b.server.fail('POST', 500), error: 'write', text: unsaved },
    { at: 'Schreiben ohne Netz', click: true, setup: (b) => b.server.offline('POST'), error: 'offline', text: unsaved },
    { at: 'abgelehntes Lesen', click: false, setup: (b) => b.server.fail('GET', 500), error: 'read', text: unsynced },
    { at: 'Lesen ohne Netz', click: false, setup: (b) => b.server.offline('GET'), error: 'offline', text: unsynced },
  ];
  for (const c of cases) {
    const b = makeBrowser({ session: 'user-1' });
    if (!c.click) c.setup(b);
    const tab = b.open({ buttons: [GLADIUS], retry: true });
    await b.settle();
    if (c.click) {
      c.setup(b);
      tab.click(tab.button());
      await b.settle();
    }
    assert.equal(tab.snapshot().error, c.error, c.at);
    assert.equal(tab.retryButton().hidden, false, c.at);
    assert.equal(tab.retryButton().textContent, c.text, c.at);
  }
});

test('der Hinweis zur Übernahme übersteht den Weg vom Datenblatt in den Hangar, bis er geschlossen wird', async () => {
  const b = makeBrowser({ guest: [{ id: 'aegs-gladius', label: 'Gladius' }] });
  const sheet = b.open({ buttons: [GLADIUS] });
  await b.settle();
  b.signIn('user-1');
  await b.settle();
  assert.equal(sheet.snapshot().merged, 1);
  sheet.close();

  const hangar = b.open();
  const other = b.open();
  await b.settle();
  assert.equal(hangar.snapshot().merged, 1, 'der Hangar kennt die Übernahme vom Datenblatt');
  hangar.fleet.dismissMerged();
  await b.settle();
  assert.equal(hangar.snapshot().merged, 0);
  assert.equal(other.snapshot().merged, 0, 'geschlossen in einem Tab heisst geschlossen in allen');
  assert.equal(b.storage.get('vb.fleet.v1.user-1'), '{"ships":[{"id":"aegs-gladius","label":"Gladius"}],"pending":{}}');
});
// Wie im Crafting-Planer: eine Anfrage, deren Frist abläuft, wird
// abgebrochen. Sonst gäbe der Lauf die Sperre frei, während sie noch
// unterwegs ist, und ein spätes Hinzufügen nach dem Entfernen holte das
// Schiff zurück.
test('endet ein Lauf nach 20 Sekunden, kommt seine Anfrage nicht mehr nach dem nächsten an', async () => {
  const b = makeBrowser({ session: 'user-1' });
  const tab = b.open({ buttons: [GLADIUS] });
  await b.settle();
  b.server.hold('POST');
  tab.click(tab.button());
  await b.settle();
  b.advance(20000);
  await b.settle();
  assert.equal(tab.snapshot().sync, 'error', 'Voraussetzung: der Lauf endete nach der Frist');

  tab.click(tab.button());
  await b.settle();
  assert.deepEqual(b.server.slugs(), []);

  b.server.release();
  await b.settle();
  assert.deepEqual(b.server.slugs(), [], 'entfernt bleibt entfernt');
});
