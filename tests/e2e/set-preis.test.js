// Gesamtpreis eines Ruestungs-Sets (Task-Flow D05, UX-Audit 24.11.2026).
// Rechnung: src/lib/setPreis.ts. Geprueft gegen den Katalog selbst, jedes Set:
// die Summe ist die guenstigste Variante je Kernteil, Kernteile ohne
// Ladenpreis werden benannt statt still weggelassen, und der Laden „alles an
// einem Ort“ fuehrt wirklich jedes Kernteil.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function bundle(entries) {
  const { buildSync } = await import('esbuild');
  const src = entries.map((e) => `export * from ${JSON.stringify(path.resolve(e))};`).join('\n');
  const out = buildSync({
    stdin: { contents: src, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-preis-'));
  const file = path.join(dir, 'mod.mjs');
  fs.writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

describe('Set-Preis', async () => {
  const M = await bundle(['src/lib/setPreis.ts', 'src/lib/items.ts']);
  const laden = (i) => (i.obtain || []).filter((o) => o.kind === 'shop' && typeof o.price === 'number' && o.price > 0);

  test('jedes Set: Summe, fehlende Teile und Laden stimmen mit dem Katalog (Selbstauskunft)', () => {
    let sets = 0, mitPreis = 0, mitOrt = 0, mitTeilOrt = 0;
    for (const s of M.armorSets) {
      sets++;
      const p = M.setPreis(s.id);
      const kern = M.setItemsBySlot(s.id).filter(([slot]) => M.KERN_SLOTS.includes(slot));
      assert.deepEqual(p.teile, kern.map(([slot]) => slot), `${s.id}: Kernteile`);
      let summe = 0;
      const ohne = [];
      for (const [slot, list] of kern) {
        const preise = list.flatMap(laden).map((o) => o.price);
        if (preise.length) summe += Math.min(...preise);
        else ohne.push(slot);
      }
      assert.deepEqual(p.ohnePreis, ohne, `${s.id}: ohne Ladenpreis`);
      assert.equal(p.ab, ohne.length === kern.length ? null : summe, `${s.id}: Summe`);
      if (p.ab != null) mitPreis++;
      // Laden: unabhaengig nachgerechnet. Jeder Laden, der jedes Kernteil mit
      // Ladenpreis fuehrt (ab zwei solchen Teilen), mit seiner Summe; gewaehlt
      // ist der guenstigste, die uebrigen zaehlen als „weitere“.
      const bepreist = kern.filter(([slot]) => !ohne.includes(slot));
      const kandidaten = [];
      if (bepreist.length >= 2) {
        const orte = new Set(bepreist[0][1].flatMap(laden).map((o) => o.loc));
        for (const loc of orte) {
          let summeDort = 0, alle = true;
          for (const [, list] of bepreist) {
            const dort = list.flatMap(laden).filter((o) => o.loc === loc).map((o) => o.price);
            if (!dort.length) { alle = false; break; }
            summeDort += Math.min(...dort);
          }
          if (alle) kandidaten.push(summeDort);
        }
      }
      assert.equal(!!p.ort, kandidaten.length > 0, `${s.id}: Laden genau dann, wenn einer jedes Kernteil mit Preis fuehrt`);
      if (p.ort) {
        mitOrt++;
        if (ohne.length) mitTeilOrt++;
        assert.equal(p.ort.summe, Math.min(...kandidaten), `${s.id}: der guenstigste gemeinsame Laden`);
        assert.equal(p.ort.weitere, kandidaten.length - 1, `${s.id}: Zahl der weiteren Laeden`);
        const dortSumme = bepreist.reduce((a, [, list]) => a + Math.min(...list.flatMap(laden).filter((o) => o.loc === p.ort.loc).map((o) => o.price)), 0);
        assert.equal(p.ort.summe, dortSumme, `${s.id}: ${p.ort.loc} fuehrt jedes Kernteil mit Preis zu dieser Summe`);
        assert.ok(p.ort.summe >= p.ab, `${s.id}: ein Laden kann nicht unter der Summe der guenstigsten Teile liegen`);
      }
    }
    console.log(`set-preis: ${sets} Sets geprueft, ${mitPreis} mit Preis, ${mitOrt} mit gemeinsamem Laden (davon ${mitTeilOrt} nur fuer die Teile mit Preis)`);
    // Klinken, gemessen am 24.11.2026: 143 Sets, 48 mit Preis, 21 mit einem
    // Laden fuer jedes Kernteil mit Preis (zwei und mehr), 2 davon ohne Preis
    // fuer ein weiteres Kernteil (FBL-8a, Lynx).
    assert.ok(sets >= 140, `nur ${sets} Sets`);
    assert.ok(mitPreis >= 48, `nur ${mitPreis} Sets mit Preis`);
    assert.ok(mitOrt >= 21, `nur ${mitOrt} Sets mit gemeinsamem Laden`);
    assert.ok(mitTeilOrt >= 2, `nur ${mitTeilOrt} Sets mit Laden fuer die Teile mit Preis`);
  });

  test('Rechnung am Beispiel: guenstigste Variante je Teil, Laden mit allem', () => {
    const p = M.setPreis('adp-mk4');
    assert.deepEqual(p.teile, ['Helmet', 'Torso', 'Arms', 'Legs']);
    assert.deepEqual(p.ohnePreis, []);
    assert.ok(p.ab > 0);
    assert.ok(p.ort && p.ort.summe >= p.ab, "ADP-mk4 gibt es in einem Laden ganz");
    // Ohne Ladenpreis fuer den Helm: der Laden gilt fuer die drei anderen.
    const f = M.setPreis('fbl-8a');
    assert.deepEqual(f.ohnePreis, ['Helmet']);
    assert.ok(f.ort && f.ort.summe >= f.ab, 'FBL-8a: Laden fuer Torso, Arme und Beine');
  });
});
