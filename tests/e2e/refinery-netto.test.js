// Refinery: Netto pro Stunde je Methode (UX-Audit 24.11.2026, Task-Flow F06).
// Die Methoden-Tabelle kennt nur Stufen; der Vergleich rechnet mit den Werten,
// die der Spieler im Terminal abliest. Geprueft werden die drei Helfer aus
// src/lib/refineryJobs.ts und, am Quelltext, dass Seite und Vorschau sie nutzen.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { parseDauer, nettoProStunde, besteZeile } from '../../src/lib/refineryJobs.ts';

test('parseDauer: Schreibweisen aus Terminal und Tastatur', () => {
  const faelle = [
    ['5:32', 332], ['5:32:30', 332.5], ['0:45', 45],
    ['5h 32m', 332], ['5h32m', 332], ['2d 4h', 3120], ['2d4h30m', 3150],
    ['90 min', 90], ['5 Std', 300], ['3 std 20 min', 200], ['1 Tag', 1440], ['45m 10s', 45 + 10 / 60],
    ['5,5', 330], ['5.5', 330], ['  4  ', 240],
  ];
  for (const [ein, soll] of faelle) assert.strictEqual(parseDauer(ein), soll, JSON.stringify(ein));
});

test('parseDauer: Unsinn, null und Grenzen ergeben null', () => {
  for (const ein of ['', '   ', 'abc', '5h x', 'h', '0', '0:00', '-3', '5:75', '31d', '1e3', null, undefined]) {
    assert.strictEqual(parseDauer(ein), null, JSON.stringify(ein));
  }
  assert.strictEqual(parseDauer('30d'), 30 * 1440);
});

test('nettoProStunde: Ausbeute mal Preis minus Kosten, durch Stunden', () => {
  assert.deepStrictEqual(nettoProStunde(30, 1000, 4200, 120), { netto: 25800, proStunde: 12900 });
  assert.deepStrictEqual(nettoProStunde(10, 100, 0, 30), { netto: 1000, proStunde: 2000 });
  // Kosten ueber dem Erloes: negativ, nicht verschluckt
  assert.deepStrictEqual(nettoProStunde(1, 100, 400, 60), { netto: -300, proStunde: -300 });
  // ohne Ausbeute, Preis oder Dauer kein Ergebnis
  assert.strictEqual(nettoProStunde(0, 1000, 0, 60), null);
  assert.strictEqual(nettoProStunde(10, 0, 0, 60), null);
  assert.strictEqual(nettoProStunde(10, 1000, 0, null), null);
  assert.strictEqual(nettoProStunde(10, 1000, 0, 0), null);
});

test('besteZeile: hoechstes Netto pro Stunde, erst ab zwei Ergebnissen', () => {
  assert.strictEqual(besteZeile([null, { proStunde: 5 }, { proStunde: 9 }]), 2);
  assert.strictEqual(besteZeile([{ proStunde: 9 }, { proStunde: 9 }]), 0);
  assert.strictEqual(besteZeile([{ proStunde: -5 }, { proStunde: -2 }]), 1);
  assert.strictEqual(besteZeile([{ proStunde: 5 }, null, null]), -1);
  assert.strictEqual(besteZeile([]), -1);
});

test('Seite und Vorschau nutzen die Helfer (Quelltext)', () => {
  const src = fs.readFileSync(path.resolve('src/components/account/RefineryDashboard.astro'), 'utf8');
  assert.match(src, /import \{[^}]*parseDauer[^}]*nettoProStunde[^}]*besteZeile[^}]*\} from '\.\.\/\.\.\/lib\/refineryJobs'/);
  assert.match(src, /id="rf-vgl"/);
  assert.strictEqual((src.match(/data-vgl-row/g) || []).length, 2, 'eine Zeilenvorlage im Markup, ein Abgriff im Skript');
  assert.match(src, /id="rfd-pv-rate"/);
  assert.match(src, /\$\('rfd-pv-rate'\)\.textContent/);
  // beide Sprachen tragen jeden Text des Vergleichs
  for (const k of ['vglTitle', 'vglLead', 'vglOre', 'vglPrice', 'vglRow', 'vglMethod', 'vglYield', 'vglTime', 'vglCost', 'vglNet', 'vglBest', 'vglNeed', 'pvRate']) {
    assert.strictEqual((src.match(new RegExp(`\\b${k}:`, 'g')) || []).length, 2, k);
  }
});
