// Mining-Werkbank: die Erzsuche kennt deutsche Namen und sagt, warum die
// Liste leer ist (UX-Audit 24.11.2026, Heuristik-Befund P42: „Eis" und
// „Quantanium" leerten die Spalte ohne jede Meldung).
//
// Fuehrt das ECHTE assets/mining-workbench.js gegen das Mock-DOM aus
// (tests/e2e/helpers/mining-dom.js). Die Namensliste kommt wie auf der Seite
// aus der Nutzlast; hier steht nur der Ausschnitt, den die Faelle brauchen.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { makeMiningDomContext, flush } from './helpers/mining-dom.js';

const CODE = fs.readFileSync(path.resolve('assets/mining-workbench.js'), 'utf8');

async function run() {
  const ctx = makeMiningDomContext();
  const data = ctx.document.getElementById('wb-data');
  const payload = JSON.parse(data.textContent);
  payload.alias = { Ice: 'Eis', Copper: 'Kupfer', Iron: 'Eisen' };
  data.textContent = JSON.stringify(payload);
  vm.runInContext(CODE, vm.createContext(ctx));
  await flush();
  return ctx;
}

function suche(ctx, text) {
  const feld = ctx.document.getElementById('wb-q');
  feld.value = text;
  ctx.fire(feld, 'input');
}

function sichtbar(ctx) {
  return ctx.document.getElementById('wb-list').querySelectorAll('.wb__tile')
    .filter((t) => t.style.display !== 'none').map((t) => t.getAttribute('data-min'));
}

test('P42: der deutsche Name findet das Erz, die Leermeldung bleibt zu', async () => {
  const ctx = await run();
  suche(ctx, 'Kupfer');
  assert.deepStrictEqual(sichtbar(ctx), ['Copper']);
  assert.strictEqual(ctx.document.getElementById('wb-nohit').hidden, true);
  suche(ctx, 'eis');
  assert.ok(sichtbar(ctx).includes('Ice'), '„eis" zeigt Ice');
});

test('P42: ein Tippfehler bekommt eine Leermeldung mit Vorschlag', async () => {
  const ctx = await run();
  suche(ctx, 'Quantanium');
  assert.deepStrictEqual(sichtbar(ctx), []);
  const box = ctx.document.getElementById('wb-nohit');
  assert.strictEqual(box.hidden, false);
  assert.match(box.innerHTML, /NO-HIT Quantanium/);
  // Der Nachbau legt Leerraum vor Tags zusammen; im Browser steht dort ein Leerzeichen.
  assert.match(box.innerHTML, /DID-YOU\s*<button type="button" class="wb__sugg" data-sugg="Quantainium">Quantainium<\/button>\?/);
});

test('P42: ohne nahen Namen bleibt es bei der Meldung, ohne Vorschlag', async () => {
  const ctx = await run();
  suche(ctx, 'xyzqw');
  const box = ctx.document.getElementById('wb-nohit');
  assert.strictEqual(box.hidden, false);
  assert.match(box.innerHTML, /NO-HIT xyzqw/);
  assert.doesNotMatch(box.innerHTML, /data-sugg/);
  // Und das Leeren der Suche schliesst sie wieder.
  suche(ctx, '');
  assert.strictEqual(box.hidden, true);
});

test('P42: der Vorschlag korrigiert die Suche und waehlt das Erz', async () => {
  const ctx = await run();
  suche(ctx, 'Quantanium');
  // Der Knopf, den die Leermeldung selbst gezeichnet hat.
  const knopf = ctx.document.getElementById('wb-nohit').querySelector('button');
  assert.ok(knopf && knopf.getAttribute('data-sugg') === 'Quantainium', 'Vorschlagsknopf fehlt');
  ctx.fire(knopf, 'click');
  assert.strictEqual(ctx.document.getElementById('wb-q').value, 'Quantainium');
  assert.strictEqual(ctx.document.getElementById('wb-name').textContent, 'Quantainium');
  assert.deepStrictEqual(sichtbar(ctx), ['Quantainium']);
  assert.strictEqual(ctx.document.getElementById('wb-nohit').hidden, true);
});
