// Mining-Werkbank: Fundorte nach Ertrag oder Chance (UX-Audit 24.11.2026,
// Task-Flow F01). Tragen alle Orte eines Erzes dieselben Zahlen, sagt die
// Liste das einmal oben, statt dieselbe Zeile an jedem Ort zu wiederholen.
//
// Fuehrt das ECHTE assets/mining-workbench.js gegen das Mock-DOM aus
// (tests/e2e/helpers/mining-dom.js), wie die uebrigen Mining-Tests.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { makeMiningDomContext, flush } from './helpers/mining-dom.js';

const CODE = fs.readFileSync(path.resolve('assets/mining-workbench.js'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.resolve('assets/mining-db.json'), 'utf8'));

async function run(opts = {}) {
  const ctx = makeMiningDomContext(opts);
  ctx.window.matchMedia = undefined;
  vm.runInContext(CODE, vm.createContext(ctx));
  await flush();
  return ctx;
}

const $ = (ctx, id) => ctx.document.getElementById(id);
const rows = (ctx) => $(ctx, 'wb-locs').querySelectorAll('.wb__row2');
const tile = (ctx, name) => $(ctx, 'wb-list').querySelectorAll('.wb__tile').find((x) => x.getAttribute('data-min') === name);
const knopf = (ctx, k) => $(ctx, 'wb-locsort').querySelectorAll('button').find((b) => b.getAttribute('data-locsort') === k);

function waehle(ctx, name) {
  const t = tile(ctx, name);
  assert.ok(t, `Kachel fuer "${name}" fehlt`);
  ctx.fire(t, 'click');
}

// Die Daten selbst: welche Erze tragen an allen Orten dieselben Zahlen?
const gleich = DB.minerals.filter((m) => {
  const l = m.locations || [];
  return l.length > 1 && l.every((x) => x.chance === l[0].chance && x.maxShare === l[0].maxShare && x.eff === l[0].eff);
}).map((m) => m.name);
const verschieden = DB.minerals.filter((m) => {
  const l = m.locations || [];
  return l.length > 1 && new Set(l.map((x) => x.chance)).size > 1 && new Set(l.map((x) => x.eff)).size > 1;
}).map((m) => m.name);

test('F01: die Daten tragen beide Faelle (Selbstauskunft)', () => {
  assert.ok(gleich.includes('Quantainium'), 'Quantainium hat nicht mehr ueberall dieselben Zahlen; Test neu bemessen');
  assert.ok(gleich.length >= 3, `nur ${gleich.length} Erze mit gleichen Zahlen`);
  assert.ok(verschieden.length >= 10, `nur ${verschieden.length} Erze mit verschiedenen Zahlen`);
});

test('F01: gleiche Zahlen an allen Orten stehen einmal oben, ohne Umschalter', async () => {
  const ctx = await run();
  waehle(ctx, 'Quantainium');
  const n = DB.minerals.find((m) => m.name === 'Quantainium').locations.length;
  assert.strictEqual($(ctx, 'wb-locsort').hidden, true, 'Umschalter sichtbar, obwohl er nichts umsortieren kann');
  const key = $(ctx, 'wb-lockey').textContent;
  assert.match(key, new RegExp(`^LOC-SAME ${n} \\| CHANCE .+ · UP-TO .+ · AVG `), key);
  const r = rows(ctx);
  assert.strictEqual(r.length, n);
  for (const row of r) {
    assert.ok(!/CHANCE|UP-TO/.test(row.innerHTML), 'Zeile wiederholt die Zahlen');
    assert.ok(!/wb__bar/.test(row.innerHTML), 'Zeile zeigt einen Balken, der nichts unterscheidet');
  }
  // nach System geordnet
  const sys = r.map((row) => (row.innerHTML.match(/<span class="s">([^<]*)<\/span>/) || [])[1] || '');
  const sortiert = [...sys].sort((a, b) => a.split(' · ').pop().localeCompare(b.split(' · ').pop()));
  assert.deepStrictEqual(sys.map((s) => s.split(' · ').pop()), sortiert.map((s) => s.split(' · ').pop()));
});

test('F01: Umschalter sortiert nach Chance und zurueck nach Ertrag, und merkt sich die Wahl', async () => {
  const ctx = await run();
  const name = verschieden[0];
  const m = DB.minerals.find((x) => x.name === name);
  waehle(ctx, name);
  assert.strictEqual($(ctx, 'wb-locsort').hidden, false, `kein Umschalter bei ${name}`);
  assert.strictEqual($(ctx, 'wb-lockey').textContent, 'LOC-KEY');
  assert.strictEqual(knopf(ctx, 'ef').getAttribute('aria-pressed'), 'true');
  const orte = () => rows(ctx).map((row) => row.getAttribute('data-loc'));
  const nachEf = [...m.locations].sort((a, b) => b.eff - a.eff).map((l) => l.location);
  assert.deepStrictEqual(orte().map((o) => m.locations.find((l) => l.location === o).eff), nachEf.map((o) => m.locations.find((l) => l.location === o).eff));

  ctx.fire(knopf(ctx, 'ch'), 'click');
  assert.strictEqual(knopf(ctx, 'ch').getAttribute('aria-pressed'), 'true');
  assert.strictEqual(knopf(ctx, 'ef').getAttribute('aria-pressed'), 'false');
  assert.strictEqual($(ctx, 'wb-lockey').textContent, 'LOC-KEY-CH');
  const ch = orte().map((o) => m.locations.find((l) => l.location === o).chance);
  for (let i = 1; i < ch.length; i++) assert.ok(ch[i - 1] >= ch[i], `Chance nicht fallend: ${ch.join(', ')}`);
  // rechts steht jetzt die Chance, die Unterzeile behaelt nur den Hoechstanteil
  const erste = rows(ctx)[0].innerHTML;
  assert.ok(!/CHANCE/.test(erste), 'Chance steht doppelt (rechts und in der Unterzeile)');
  assert.match(erste, /UP-TO/);
  const gespeichert = JSON.parse(ctx.localStorage.getItem('vb-mining-wb'));
  assert.strictEqual(gespeichert.locSort, 'ch');

  ctx.fire(knopf(ctx, 'ef'), 'click');
  assert.strictEqual($(ctx, 'wb-lockey').textContent, 'LOC-KEY');
  assert.strictEqual(JSON.parse(ctx.localStorage.getItem('vb-mining-wb')).locSort, 'ef');
});

test('F01: die gemerkte Sortierung gilt beim naechsten Besuch', async () => {
  const name = verschieden[0];
  const ctx = await run({ localStorageSeed: { sel: name, locSort: 'ch' } });
  assert.strictEqual(knopf(ctx, 'ch').getAttribute('aria-pressed'), 'true');
  assert.strictEqual($(ctx, 'wb-lockey').textContent, 'LOC-KEY-CH');
});
