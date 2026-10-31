// Regressionsschutz für das Schild im Bereich „Sicherheit & Konto": oben
// „Konto-Schutz: 3 von 4" mit je einem Knopf pro Punkt. Ein offener Punkt
// springt dorthin, wo man ihn erledigt; ein falsches Sprungziel wäre ein Knopf,
// der nichts tut. Den Zwei-Faktor-Punkt meldet account-mfa.ts mit 'vb:mfa' –
// fehlt die Meldung, zählt das Schild für Admins einen Punkt zu wenig.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');
const dashboard = read('src/components/account/AccountDashboard.astro');
const mfa = read('src/components/account/MfaSettings.astro');
const secTs = read('src/scripts/account-security.ts');
const mfaTs = read('src/scripts/account-mfa.ts');
const css = read('assets/account-dossier.css');
const markup = dashboard + '\n' + mfa;
const has = (id) => new RegExp(`\\sid="${id}"`).test(markup);
// Liegt das Element innerId im Element outerId? Zählt <div>/<form> ab
// dem öffnenden Tag von outerId, bis dessen Ebene wieder zu ist.
const within = (outerId, innerId) => {
  const open = markup.lastIndexOf('<', markup.indexOf(`id="${outerId}"`));
  if (open < 0) return false;
  const re = /<(\/?)(div|form)\b/g;
  re.lastIndex = open;
  let depth = 0, end = -1, m;
  while ((m = re.exec(markup))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) { end = m.index; break; }
  }
  return end > open && markup.slice(open, end).includes(`id="${innerId}"`);
};

const steps = [...dashboard.matchAll(/<button type="button" class="sec-step"([^>]*)>/g)].map((m) =>
  Object.fromEntries([...m[1].matchAll(/([a-z-]+)=(?:"([^"]*)"|\{([^}]*)\})/g)].map((a) => [a[1], a[2] ?? a[3]])),
);

describe('Sicherheit: Schild „Konto-Schutz"', () => {
  test('1. Vier Punkte: Passwort, Discord, RSI, Zwei-Faktor – je mit beiden Beschriftungen', () => {
    assert.deepStrictEqual(steps.map((s) => s['data-step']), ['pass', 'dc', 'rsi', 'mfa']);
    for (const s of steps) {
      assert.ok(s['data-on'] && s['data-off'], `Punkt ${s['data-step']} ohne Beschriftung`);
    }
    console.log(`  geprüft: ${steps.length} Punkte`);
  });

  test('2. Jedes Sprungziel (offen und erledigt) gibt es im Markup', () => {
    const missing = steps.flatMap((s) => [s['data-go'], s['data-done-go']]).filter((id) => !id || !has(id));
    assert.deepStrictEqual(missing, [], `Sprungziele ohne Element: ${missing.join(', ')}`);
  });

  test('3. Offene Punkte springen in das Formular, das sie erledigt', () => {
    const go = Object.fromEntries(steps.map((s) => [s['data-step'], s['data-go']]));
    assert.ok(within('passForm', go.pass), `Passwort springt auf ${go.pass}, nicht ins Passwort-Formular`);
    assert.ok(within('secRsiForm', go.rsi), `RSI springt auf ${go.rsi}, nicht ins RSI-Formular`);
    assert.strictEqual(go.dc, 'secDcLink');
    assert.ok(within('mfaAddRow', go.mfa), `Zwei-Faktor springt auf ${go.mfa}, nicht in die Einrichtung`);
  });

  test('4. Zwei-Faktor meldet sich beim Schild, auch wenn die Karte verborgen bleibt', () => {
    const hide = mfaTs.indexOf('card.hidden = !(');
    const send = mfaTs.indexOf("new CustomEvent('vb:mfa'");
    const ret = mfaTs.indexOf('if (card.hidden) return;', hide);
    assert.ok(hide > -1 && send > hide && send < ret, 'vb:mfa muss nach der Sichtbarkeit und vor dem frühen return fallen');
    assert.match(secTs, /addEventListener\('vb:mfa'/);
    for (const k of ['pass', 'dc', 'rsi', 'mfa']) assert.match(secTs, new RegExp(`shield\\.${k} =`), `Schild-Punkt ${k} wird nie gesetzt`);
  });

  test('5. Die Erklärung der Zwei-Faktor-Karte steht hinter dem (i), nicht als Absatz', () => {
    const tips = [...mfa.matchAll(/class="pfx-i"[^>]*data-tip="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(tips.length >= 1);
    for (const id of tips) assert.match(mfa, new RegExp(`<p class="pfx-tiptext" id="${id}" hidden>`));
  });

  test('6. Breit drei Spalten, Zwei-Faktor über zwei', () => {
    assert.match(css, /@container secx \(min-width:1000px\)\{\s*\.sec-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
    assert.match(css, /\.dsr \.sec-grid \.mfa-card\{grid-column:span 2\}/);
  });
});
