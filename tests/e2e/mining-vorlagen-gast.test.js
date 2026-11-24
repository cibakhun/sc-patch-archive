// Mining-Vorlagen ohne Konto (UX-Audit 24.11.2026, Task-Flow 9.3): Gaeste
// speichern, benennen um und loeschen Vorlagen in diesem Browser; beim
// Anmelden wandern sie einmal ins Konto, so wie der Crafting-Planer seinen
// Stand uebernimmt. Gleichnamige Kontovorlagen bleiben unangetastet.
//
// Fuehrt das ECHTE assets/mining-workbench.js gegen das Mock-DOM aus
// (tests/e2e/helpers/mining-dom.js); `account.session: null` ist der Gast.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { makeMiningDomContext, flush } from './helpers/mining-dom.js';

const CODE = fs.readFileSync(path.resolve('assets/mining-workbench.js'), 'utf8');
const KEY = 'vb.mining.presets.v1';

async function run(opts = {}, gast = null) {
  const ctx = makeMiningDomContext(opts);
  if (gast) ctx.localStorage.setItem(KEY, JSON.stringify({ v: 1, presets: gast }));
  vm.runInContext(CODE, vm.createContext(ctx));
  await flush();
  return ctx;
}
const GAST = { account: { session: null, rows: [] } };
const ablage = (ctx) => JSON.parse(ctx.localStorage.getItem(KEY) || 'null');
const namen = (ctx) => ctx.document.getElementById('wb-preset-list').querySelectorAll('.wb__pre-item').map((r) => r.getAttribute('data-preset'));
const zeile = (ctx, n) => ctx.document.getElementById('wb-preset-list').querySelectorAll('.wb__pre-item').find((r) => r.getAttribute('data-preset') === n) || null;
const knopf = (ctx, n, attr) => zeile(ctx, n).querySelectorAll('button').find((b) => b.getAttribute(attr) !== null) || null;
function anheften(ctx, erz) {
  const t = ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile').find((x) => x.getAttribute('data-min') === erz);
  ctx.fire(t.querySelector('.wb__pin'), 'click');
}
async function neu(ctx, name) {
  ctx.fire(ctx.elements['wb-pre-new'], 'click');
  ctx.elements['wb-pre-name'].value = name;
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();
}
const meldung = (ctx) => (ctx.elements['wb-pre-msg'].hidden ? '' : ctx.elements['wb-pre-msg'].textContent);

test('9.3: Gaeste sehen die Vorlagen-Liste und den Hinweis, wo sie liegen', async () => {
  const ctx = await run(GAST);
  assert.strictEqual(ctx.elements['wb-pre-pick'].hidden, false, 'Vorlagen-Liste fuer Gaeste verborgen');
  assert.strictEqual(ctx.elements['wb-pre-guest'].hidden, false, 'Hinweis „liegen in diesem Browser" fehlt');
  assert.strictEqual(ctx.account.calls.length, 0, 'ohne Sitzung darf nichts an die Tabelle gehen');
});

test('9.3: Gast speichert, ueberschreibt nicht still, benennt um und loescht, alles im Browser', async () => {
  const ctx = await run(GAST);
  anheften(ctx, 'Gold');
  await neu(ctx, 'Gold-Runde');
  assert.deepStrictEqual(namen(ctx), ['Gold-Runde']);
  assert.strictEqual(meldung(ctx), 'SAVED');
  let a = ablage(ctx);
  assert.strictEqual(a.v, 1);
  assert.deepStrictEqual(a.presets.map((p) => [p.name, p.minerals.join()]), [['Gold-Runde', 'Gold']]);

  anheften(ctx, 'Quantainium');
  await neu(ctx, 'Quant');
  assert.deepStrictEqual(namen(ctx), ['Gold-Runde', 'Quant']);

  // Umbenennen auf einen vergebenen Namen: 409 wie bei der Tabelle
  ctx.fire(knopf(ctx, 'Quant', 'data-pre-rename'), 'click');
  ctx.elements['wb-pre-name'].value = 'Gold-Runde';
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();
  assert.strictEqual(meldung(ctx), 'NAME-TAKEN');
  assert.deepStrictEqual(namen(ctx), ['Gold-Runde', 'Quant']);

  ctx.fire(knopf(ctx, 'Quant', 'data-pre-rename'), 'click');
  ctx.elements['wb-pre-name'].value = 'Quantainium-Feld';
  ctx.fire(ctx.elements['wb-pre-ok'], 'click');
  await flush();
  assert.deepStrictEqual(namen(ctx), ['Gold-Runde', 'Quantainium-Feld']);

  // Loeschen mit Rueckfrage
  ctx.fire(knopf(ctx, 'Gold-Runde', 'data-pre-del'), 'click');
  ctx.fire(knopf(ctx, 'Gold-Runde', 'data-pre-delok'), 'click');
  await flush();
  assert.deepStrictEqual(namen(ctx), ['Quantainium-Feld']);
  a = ablage(ctx);
  assert.deepStrictEqual(a.presets.map((p) => p.name), ['Quantainium-Feld']);
  assert.strictEqual(ctx.account.calls.length, 0, 'kein Aufruf an die Tabelle im Gast-Pfad');

  // naechster Besuch: die Vorlage ist noch da
  const ctx2 = await run(GAST, a.presets);
  assert.deepStrictEqual(namen(ctx2), ['Quantainium-Feld']);
});

test('9.3: dieselben Grenzen wie die Tabelle (Name bis 60 Zeichen)', async () => {
  const ctx = await run(GAST);
  anheften(ctx, 'Gold');
  await neu(ctx, 'x'.repeat(61));
  assert.strictEqual(meldung(ctx), 'FAIL');
  assert.strictEqual(ablage(ctx), null);
});

test('9.3: beim Anmelden wandern Gast-Vorlagen einmal ins Konto, gleiche Namen bekommen (2)', async () => {
  const lang = 'y'.repeat(60);
  const ctx = await run({ account: { rows: [{ name: 'Alt', minerals: ['Gold'], locations: [] }, { name: lang, minerals: ['Gold'], locations: [] }] } }, [
    { name: 'Alt', minerals: ['Quantainium'], locations: [] },
    { name: 'Neu', minerals: ['Gold'], locations: [] },
    { name: lang, minerals: ['Quantainium'], locations: [] },
  ]);
  const posts = ctx.account.calls.filter((c) => c.method === 'POST');
  assert.strictEqual(posts.length, 1, 'ein POST fuer alle Gast-Vorlagen');
  assert.strictEqual(posts[0].path, 'mining_sig_presets?on_conflict=user_id,name');
  const gesendet = Array.from(posts[0].body).map((b) => b.name);
  assert.deepStrictEqual(gesendet, ['Alt (2)', 'Neu', 'y'.repeat(56) + ' (2)']);
  assert.ok(gesendet.every((n) => n.length <= 60));
  // die Kontovorlage „Alt" ist unveraendert
  assert.deepStrictEqual(Array.from(ctx.account.rows.find((r) => r.name === 'Alt').minerals), ['Gold']);
  assert.strictEqual(ablage(ctx), null, 'Gast-Ablage nach der Uebernahme nicht leer');
  assert.strictEqual(meldung(ctx), 'SYNCED 3');
  assert.strictEqual(ctx.elements['wb-pre-guest'].hidden, true);
  assert.ok(namen(ctx).includes('Alt (2)') && namen(ctx).includes('Neu'));
});

test('9.3: scheitert die Uebernahme, bleiben die Vorlagen im Browser', async () => {
  const gast = [{ name: 'Behalten', minerals: ['Gold'], locations: [] }];
  const ctx = await run({ account: { rows: [], postOk: false } }, gast);
  assert.strictEqual(meldung(ctx), 'SYNC-FAIL');
  assert.deepStrictEqual(ablage(ctx).presets.map((p) => p.name), ['Behalten']);
});

test('9.3: ohne Gast-Vorlagen macht die Anmeldung keinen zusaetzlichen Aufruf', async () => {
  const ctx = await run({ account: { rows: [] } });
  assert.deepStrictEqual(ctx.account.calls.map((c) => c.method), ['GET']);
});

test('9.3: laesst der Browser sich nichts nehmen, geht nichts ans Konto (keine doppelte Vorlage spaeter)', async () => {
  const ctx = makeMiningDomContext({ account: { rows: [] } });
  ctx.localStorage.setItem(KEY, JSON.stringify({ v: 1, presets: [{ name: 'Bleibt', minerals: ['Gold'], locations: [] }] }));
  ctx.localStorage.removeItem = () => { throw new Error('SecurityError'); };
  vm.runInContext(CODE, vm.createContext(ctx));
  await flush();
  assert.deepStrictEqual(ctx.account.calls.filter((c) => c.method === 'POST'), [], 'ohne genommene Ablage kein POST');
  assert.deepStrictEqual(ablage(ctx).presets.map((p) => p.name), ['Bleibt']);
});

test('9.3: scheitern Uebernahme und Zuruecklegen, sagt die Werkbank das', async () => {
  const ctx = makeMiningDomContext({ account: { rows: [], postOk: false } });
  ctx.localStorage.setItem(KEY, JSON.stringify({ v: 1, presets: [{ name: 'Weg', minerals: ['Gold'], locations: [] }] }));
  const setItem = ctx.localStorage.setItem.bind(ctx.localStorage);
  ctx.localStorage.setItem = (k, v) => { if (k === KEY) throw new Error('QuotaExceededError'); return setItem(k, v); };
  vm.runInContext(CODE, vm.createContext(ctx));
  await flush();
  assert.strictEqual(meldung(ctx), 'SYNC-LOST');
});
