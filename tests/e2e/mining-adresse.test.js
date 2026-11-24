// Mining-Werkbank: die Adresse traegt die Auswahl, und der Weg zum
// Routenrechner steht an Halo-Erzen (UX-Audit 24.11.2026, Paket G: G3, G5).
//
// Fuehrt das ECHTE assets/mining-workbench.js gegen das Mock-DOM aus
// (tests/e2e/helpers/mining-dom.js) und reicht dem Kontext einen
// aufzeichnenden Verlauf (history.replaceState) und einen Pfad mit. Ohne
// diese zwei Felder bleibt das Skript still -- genau so laufen die
// uebrigen Mining-Tests weiter, deshalb stehen sie hier und nicht im Helfer.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { makeMiningDomContext, flush } from './helpers/mining-dom.js';

const CODE = fs.readFileSync(path.resolve('assets/mining-workbench.js'), 'utf8');

async function run(opts = {}) {
  const ctx = makeMiningDomContext(opts);
  const calls = [];
  const history = {
    state: null,
    replaceState(state, _t, url) {
      calls.push(url);
      const u = new URL(url, 'http://localhost');
      ctx.location.search = u.search;
      ctx.location.hash = u.hash;
    },
  };
  ctx.location.pathname = '/topics/mining.html';
  ctx.location.hash = opts.hash || '';
  ctx.history = history;
  ctx.window.history = history;
  ctx.window.matchMedia = undefined;
  // Fuer die Halo-Verweise: der Pfad kommt aus der Nutzlast der Seite.
  const data = ctx.document.getElementById('wb-data');
  const payload = JSON.parse(data.textContent);
  payload.pjPath = '/precision-jump.html';
  data.textContent = JSON.stringify(payload);
  vm.runInContext(CODE, vm.createContext(ctx));
  await flush();
  return { ctx, calls };
}

function tile(ctx, name) {
  const t = ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile')
    .find((x) => x.getAttribute('data-min') === name);
  assert.ok(t, `Kachel fuer "${name}" fehlt`);
  return t;
}

function locRow(ctx, loc) {
  return ctx.document.getElementById('wb-locs').querySelectorAll('.wb__row2')
    .find((row) => row.getAttribute('data-loc') === loc) || null;
}

test('G5: das Laden allein schreibt die Adresse nicht um', async () => {
  const { calls } = await run();
  assert.deepStrictEqual(calls, []);
});

test('G5: eine Erzwahl steht danach in der Adresse, Sprungmarke bleibt', async () => {
  const { ctx, calls } = await run({ hash: '#db' });
  ctx.fire(tile(ctx, 'Gold'), 'click');
  assert.strictEqual(calls.at(-1), '/topics/mining.html?mineral=Gold#db');
});

test('G5: die Fundort-Ansicht setzt ?fundort=, der Rueckweg nimmt ihn wieder heraus', async () => {
  const { ctx, calls } = await run();
  ctx.fire(tile(ctx, 'Quantainium'), 'click');
  const row = locRow(ctx, 'Aaron Halo');
  assert.ok(row, 'Quantainium fuehrt die Fundortzeile "Aaron Halo"');
  ctx.fire(row, 'click');
  assert.strictEqual(calls.at(-1), '/topics/mining.html?mineral=Quantainium&fundort=Aaron+Halo');
  ctx.fire(tile(ctx, 'Gold'), 'click');
  assert.strictEqual(calls.at(-1), '/topics/mining.html?mineral=Gold');
});

test('G5: eine geteilte Adresse oeffnet dasselbe Erz (Rundlauf)', async () => {
  const { ctx } = await run({ search: '?mineral=Gold' });
  assert.strictEqual(ctx.document.getElementById('wb-name').textContent, 'Gold');
});

test('G3: Halo-Erze verlinken Precision Jump, andere nicht', async () => {
  const { ctx } = await run();
  ctx.fire(tile(ctx, 'Quantainium'), 'click');
  const links = ctx.document.getElementById('wb-links').innerHTML;
  assert.match(links, /href="\/precision-jump\.html">Precision Jump\s*<b>Aaron Halo<\/b>/);
  const ohneHalo = Object.values(ctx.byName).find((m) => m.locs.length && !m.locs.some((l) => l.p === 'Aaron Halo'));
  assert.ok(ohneHalo, 'es gibt ein Erz mit Fundorten ausserhalb des Halos');
  ctx.fire(tile(ctx, ohneHalo.name), 'click');
  assert.doesNotMatch(ctx.document.getElementById('wb-links').innerHTML, /precision-jump/);
});

test('G3: die Fundort-Ansicht des Halos traegt den Verweis', async () => {
  const { ctx } = await run({ search: '?fundort=Aaron%20Halo' });
  assert.match(ctx.document.getElementById('wb-locview').innerHTML, /href="\/precision-jump\.html"/);
});
