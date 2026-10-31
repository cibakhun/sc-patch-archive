// Regressionsschutz für das Profil mit Live-Vorschau (Konto → Profil): Das
// Formular steht in vier Reitern, daneben die eigene Pilotenseite im Kleinen.
// Die Skripte greifen über feste ids zu (getElementById(...)! wirft sonst beim
// Laden und legt das ganze Konto lahm), springen per vb:tab auf ein Feld und
// zeigen Erklärtexte nur als Blase. Geprüft wird gegen die Quelle, weil jeder
// dieser Fehler erst im Browser des Nutzers auffiele.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');
const dashboard = read('src/components/account/AccountDashboard.astro');
const markup = fs
  .readdirSync(path.resolve('src/components/account'))
  .filter((f) => f.endsWith('.astro'))
  .map((f) => read(path.join('src/components/account', f)))
  .join('\n');
const dashTs = read('src/scripts/account-dashboard.ts');
const viewTs = read('src/scripts/account-profile-view.ts');
const css = read('assets/account-dossier.css');

const ids = new Set([...markup.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]));
const formStart = dashboard.indexOf('<form id="profileForm"');
const formEnd = dashboard.indexOf('</form>', formStart);
const formSrc = dashboard.slice(formStart, formEnd);
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([a-z-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const tags = (cls) => [...dashboard.matchAll(new RegExp(`<[a-z]+\\b[^>]*class="${cls}\\b[^"]*"[^>]*>`, 'g'))].map((m) => attrs(m[0]));

describe('Profil mit Live-Vorschau', () => {
  test('1. Jede fest erwartete id aus account-dashboard.ts steht im Markup', () => {
    const want = [...dashTs.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)(?:!|\s+as\s+HTML[A-Za-z]*Element(?!\s*\|\s*null))/g)].map((m) => m[1]);
    assert.ok(want.length >= 40, `nur ${want.length} feste ids gefunden – Muster greift nicht mehr`);
    const missing = [...new Set(want)].filter((id) => !ids.has(id));
    assert.deepStrictEqual(missing, [], `ids ohne Element: ${missing.join(', ')}`);
    console.log(`  geprüft: ${new Set(want).size} feste ids`);
  });

  test('2. Jede id der Vorschau (account-profile-view.ts) steht im Markup', () => {
    const want = [...viewTs.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]);
    assert.ok(want.length >= 10, `nur ${want.length} ids gefunden`);
    const missing = [...new Set(want)].filter((id) => !ids.has(id));
    assert.deepStrictEqual(missing, [], `ids ohne Element: ${missing.join(', ')}`);
  });

  test('3. Jeder Reiter hat seinen Abschnitt, und genau einer ist offen', () => {
    const tabs = tags('pfx-tab');
    const secs = tags('pfx-sec');
    assert.strictEqual(tabs.length, 4, `${tabs.length} Reiter statt 4`);
    for (const t of tabs) {
      const sec = secs.find((s) => s['data-pfsec'] === t['data-pfsec']);
      assert.ok(sec, `Reiter ${t.id} (${t['data-pfsec']}) ohne Abschnitt`);
      assert.strictEqual(t['aria-controls'], sec.id, `Reiter ${t.id} zeigt auf ${t['aria-controls']}, Abschnitt heißt ${sec.id}`);
      assert.strictEqual(sec['aria-labelledby'], t.id);
    }
    const open = [...dashboard.matchAll(/<div class="pfx-sec\b[^>]*>/g)].filter((m) => !/\shidden[\s>]/.test(m[0]));
    assert.strictEqual(open.length, 1, `${open.length} Abschnitte offen statt 1`);
    assert.strictEqual(tabs.filter((t) => t['aria-selected'] === 'true').length, 1);
  });

  test('4. Jedes (i) zeigt auf einen verborgenen Erklärtext', () => {
    const tips = [...dashboard.matchAll(/class="pfx-i"[^>]*data-tip="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(tips.length >= 4, `nur ${tips.length} (i)`);
    for (const id of tips) {
      assert.match(dashboard, new RegExp(`<p class="pfx-tiptext" id="${id}" hidden>`), `(i) ${id} ohne verborgenen Text`);
    }
  });

  test('5. Jedes Sprungziel aufs Profil liegt in einem Reiter des Formulars', () => {
    const goto = [...dashboard.matchAll(/data-goto="([^"]+)"/g)].map((m) => m[1]);
    const check = [...dashTs.matchAll(/ck\('[a-z]+', \d+, 'profile', '([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]);
    assert.ok(goto.length >= 6 && check.length >= 6, `Sprungziele: ${goto.length} Vorschau, ${check.length} Profil-Check`);
    const outside = [...new Set([...goto, ...check])].filter((id) => !formSrc.includes(`id="${id}"`));
    assert.deepStrictEqual(outside, [], `Sprungziele außerhalb des Formulars: ${outside.join(', ')}`);
  });

  test('6. Verdeckte Reiter halten nebeneinander die Höhe (schlägt den globalen [hidden]-Riegel)', () => {
    // .dsr [hidden]{display:none!important} gewinnt sonst – der Kasten
    // springt dann bei jedem Reiterwechsel in der Höhe.
    assert.match(css, /\.dsr\s*\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/);
    assert.match(css, /\.dsr \.pfx-sec\[hidden\]\{display:block!important;visibility:hidden\}/);
  });
});
