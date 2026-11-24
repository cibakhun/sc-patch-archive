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
    let sets = 0, mitPreis = 0, mitOrt = 0;
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
      if (p.ort) {
        mitOrt++;
        assert.ok(p.ohnePreis.length === 0 && p.teile.length >= 2, `${s.id}: Laden nur bei vollstaendigem Preis`);
        let ortSumme = 0;
        for (const [, list] of kern) {
          const dort = list.flatMap(laden).filter((o) => o.loc === p.ort.loc).map((o) => o.price);
          assert.ok(dort.length, `${s.id}: ${p.ort.loc} fuehrt nicht jedes Kernteil`);
          ortSumme += Math.min(...dort);
        }
        assert.equal(p.ort.summe, ortSumme, `${s.id}: Summe im Laden`);
        assert.ok(p.ort.summe >= p.ab, `${s.id}: ein Laden kann nicht unter der Summe der guenstigsten Teile liegen`);
      }
    }
    console.log(`set-preis: ${sets} Sets geprueft, ${mitPreis} mit Preis, ${mitOrt} mit Laden fuer alle Kernteile`);
    // Klinken, gemessen am 24.11.2026: 143 Sets, 48 mit Preis, 19 mit einem
    // Laden fuer alle Kernteile (zwei und mehr).
    assert.ok(sets >= 140, `nur ${sets} Sets`);
    assert.ok(mitPreis >= 48, `nur ${mitPreis} Sets mit Preis`);
    assert.ok(mitOrt >= 19, `nur ${mitOrt} Sets mit Laden fuer alles`);
  });

  test('Rechnung am Beispiel: guenstigste Variante je Teil, Laden mit allem', () => {
    const p = M.setPreis('adp-mk4');
    assert.deepEqual(p.teile, ['Helmet', 'Torso', 'Arms', 'Legs']);
    assert.deepEqual(p.ohnePreis, []);
    assert.ok(p.ab > 0);
    assert.ok(p.ort && p.ort.summe >= p.ab, "ADP-mk4 gibt es in einem Laden ganz");
  });
});
