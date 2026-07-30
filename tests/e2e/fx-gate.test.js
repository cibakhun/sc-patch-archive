// Automatisierter Nachweis der FX-Gatter-Logik (01.1-01, Task 3).
//
// Warum überhaupt: der Prüfbrowser dieser Umgebung meldet
// prefers-reduced-motion: false und bietet keine Emulation (STATE.md,
// RESEARCH.md „Environment Availability") — FX-06 ist damit im Browser
// nicht messbar. Dieser Test führt das ECHTE assets/detail.js in einem
// node:vm-Kontext gegen ein steuerbares Mock-DOM aus und zählt
// requestAnimationFrame-Aufrufe. Das ist eine Messung, keine Codelektüre,
// und bleibt als Regressionsgatter erhalten.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { makeFxContext } from './helpers/fx-dom.js';

const scriptPath = path.resolve('assets/detail.js');

// Führt das echte assets/detail.js frisch (eigener node:vm-Kontext) gegen
// die per opts gesteuerte Mock-DOM-Umgebung aus. Pro Testfall ein frischer
// Kontext — kein geteilter Zustand zwischen Testfällen.
async function run(opts) {
  const code = await fs.readFile(scriptPath, 'utf8');
  const ctx = makeFxContext(opts);
  const context = vm.createContext(ctx);
  vm.runInContext(code, context);
  return ctx;
}

test('FX-02: fx=off, reduce=false — Kaltstart fordert kein Bild an', async () => {
  const ctx = await run({ fx: 'off', reduce: false });
  ctx.pump(5);
  assert.strictEqual(ctx.calls, 0, `erwartet 0 rAF-Aufrufe im Leerlauf, gemessen: ${ctx.calls}`);
});

test('FX-03: fx=on, reduce=false — Kette startet und meldet sich selbst wieder an', async () => {
  const ctx = await run({ fx: 'on', reduce: false });
  assert.ok(ctx.calls >= 1, `erwartet mindestens 1 rAF-Aufruf nach dem Laden, gemessen: ${ctx.calls}`);
  ctx.pump(10);
  assert.ok(ctx.calls >= 10, `erwartet mindestens 10 rAF-Aufrufe nach 10 abgepumpten Rückrufen, gemessen: ${ctx.calls}`);
});

test('FX-05: Abschalten während des Laufs beendet die Kette', async () => {
  const ctx = await run({ fx: 'on', reduce: false });
  const before = ctx.calls;
  assert.ok(before >= 1, `Vorbedingung: Kette muss laufen, gemessen vor dem Abschalten: ${before}`);
  ctx.dispatch('vbfxchange', { on: false });
  ctx.pump(10);
  const diff = ctx.calls - before;
  assert.ok(
    diff <= 1,
    `erwartet höchstens 1 weiteren rAF-Aufruf nach dem Abschalten (bereits angemeldete Rückrufe), gemessen: ${diff} (vorher ${before}, nachher ${ctx.calls})`
  );
});

test('FX-05: zwei Ein-Ereignisse hintereinander starten die Kette nur einmal (kein Doppelstart)', async () => {
  // Kuehler Akzent (accentIsWarm()===false) haelt den #embers-Zweig
  // geschlossen, damit hier ausschliesslich die #stars-Kette gezaehlt wird —
  // sonst liefen zwei unabhaengige Ketten (Sterne + Embers) parallel und die
  // Zaehlung waere nicht mehr "eine Kette".
  const ctx = await run({ fx: 'off', reduce: false, accent: '#3da5d9' });
  assert.strictEqual(ctx.calls, 0, `Vorbedingung: Kaltstart mit fx=off darf noch nicht laufen, gemessen: ${ctx.calls}`);
  ctx.dispatch('vbfxchange', { on: true });
  ctx.dispatch('vbfxchange', { on: true });
  ctx.pump(3);
  assert.ok(ctx.calls >= 1, `erwartet, dass die Kette ueberhaupt anlaeuft, gemessen: ${ctx.calls}`);
  assert.ok(
    ctx.calls <= 4,
    `erwartet Zunahme einer EINZELNEN Kette (1 Start + 3 abgepumpte Wiederanmeldungen = 4), gemessen: ${ctx.calls} — ein Doppelstart läge deutlich darüber`
  );
});

test('FX-06/D-12: fx=on, reduce=true — reduzierte Bewegung schlägt die gespeicherte Wahl', async () => {
  const ctx = await run({ fx: 'on', reduce: true });
  ctx.pump(5);
  assert.strictEqual(
    ctx.calls,
    0,
    `erwartet 0 rAF-Aufrufe trotz gespeicherter Wahl 'on', weil reduce=true die Wahl schlägt (FX-06/D-12), gemessen: ${ctx.calls}`
  );
});

test('fx=off ohne #stars-Leinwand (hasStars=false) — kein Absturz, keine Aufrufe', async () => {
  const ctx = await run({ fx: 'off', reduce: false, hasStars: false });
  ctx.pump(5);
  assert.strictEqual(ctx.calls, 0, `erwartet 0 rAF-Aufrufe ohne #stars-Element und mit fx=off, gemessen: ${ctx.calls}`);
});
