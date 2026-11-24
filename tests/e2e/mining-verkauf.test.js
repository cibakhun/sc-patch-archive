// Mining-Werkbank: Verkaufsort fuer das raffinierte Erz (UX-Audit
// 24.11.2026, Paket G: G7).
//
// Fuehrt das ECHTE assets/mining-workbench.js gegen das Mock-DOM aus und
// reicht ihm die Preistafel aus dem ECHTEN assets/refinery-data.json mit --
// genau so, wie MiningWorkbench.astro sie in die Nutzlast legt (Erze mit
// Preis, je { a: Durchschnitt, m: bester Preis, l: bester Ort }).
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { makeMiningDomContext, flush } from './helpers/mining-dom.js';

const CODE = fs.readFileSync(path.resolve('assets/mining-workbench.js'), 'utf8');
const REF = JSON.parse(fs.readFileSync(path.resolve('assets/refinery-data.json'), 'utf8'));
const SELL = Object.fromEntries(REF.ores
  .filter((o) => o.sell || o.sellMax)
  .map((o) => [o.name, { a: o.sell, m: o.sellMax, l: o.sellLoc }]));

async function run(opts = {}) {
  const ctx = makeMiningDomContext(opts);
  const data = ctx.document.getElementById('wb-data');
  const payload = JSON.parse(data.textContent);
  payload.sell = SELL;
  data.textContent = JSON.stringify(payload);
  vm.runInContext(CODE, vm.createContext(ctx));
  await flush();
  return ctx;
}

function tile(ctx, name) {
  const t = ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile')
    .find((x) => x.getAttribute('data-min') === name);
  assert.ok(t, `Kachel fuer "${name}" fehlt`);
  return t;
}

test('G7: ein Erz mit Preis zeigt seinen besten Verkaufsort samt Preis', async () => {
  const ctx = await run();
  ctx.fire(tile(ctx, 'Gold'), 'click');
  const g = SELL.Gold;
  assert.ok(g && g.l && g.m, 'die Preistafel kennt Gold mit Ort und Preis');
  assert.strictEqual(ctx.document.getElementById('wb-sellsec').hidden, false);
  const html = ctx.document.getElementById('wb-sell').innerHTML;
  assert.ok(html.includes(g.l), `Ort "${g.l}" fehlt: ${html}`);
  assert.match(html, /aUEC\/SCU/);
});

test('G7: ein Erz ohne Preis laesst den Abschnitt zu', async () => {
  const ctx = await run();
  const ohne = Object.values(ctx.byName).find((m) => !SELL[m.name]);
  assert.ok(ohne, 'es gibt ein Erz ohne Verkaufspreis');
  ctx.fire(tile(ctx, ohne.name), 'click');
  assert.strictEqual(ctx.document.getElementById('wb-sellsec').hidden, true);
});
