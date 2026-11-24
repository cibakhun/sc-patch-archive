// Kontoseiten im Terminal der Halle (15.11.2026, src/lib/im-terminal.ts).
// Anmelden und Registrieren laufen dort im Rahmen auf dem Monitor; nur fuer
// Discord oeffnet die Seite ein kleines Fenster, dessen Ruecksprung auf die
// Anmeldeseite mit ?fenster=1 zeigt. Die Seite im Rahmen folgt der Sitzung,
// die im gemeinsamen Speicher entsteht.
//
// 1. Die Regeln: woran die Seite den Rahmen und das kleine Fenster erkennt,
//    wohin der Ruecksprung zeigen darf (nur dieser Ursprung, nur der Pfad),
//    welches storage-Ereignis eine neue Sitzung meldet.
// 2. Der Schluessel der Sitzung ist derselbe, den das Konto-Skript der Seite
//    liest (assets/account-lite.js): Sonst hoerte die Seite im Rahmen auf
//    einen Schluessel, den niemand schreibt.
//
// 3. Der zweite Faktor: Das kleine Fenster endet erst nach passSecondFactor,
//    und die Seite im Rahmen geht erst weiter, wenn die Sitzung keinen Code
//    mehr schuldet (sie fragt ihn nicht selbst). tests/e2e/mfa.test.js haelt
//    daneben fest, dass jede Anmeldung der Seite durch passSecondFactor geht;
//    dieser Test hat einen ersten Stand dieser Runde gefangen, in dem das
//    kleine Fenster davor endete.
//
// 4. Das Konto im Rahmen (src/scripts/account-dashboard.ts): Verbinden und
//    Bestaetigen mit Discord oeffnen das Konto in einem eigenen Tab; weil der
//    Browser nicht sagt, ob der Tab aufging, steht derselbe Weg als Link da.
//    Verbinden und Loesen wirken nur, solange die Sitzung dem Konto gehoert,
//    das die Seite zeigt: Im Rahmen bleibt die Seite stehen, waehrend sich
//    in einem anderen Tab jemand anders anmeldet.
//
// VORGEFUEHRT ROT (15.11.2026), fuenfzehn Eingriffe an der Quelle, jeder fuer
// sich, und jeder reisst den Test, der ihn meint: imTerminal ohne die Frage
// nach dem Rahmen; ein Fenster, das sich nicht fragen laesst, als Terminal;
// jede Marke fenster statt nur fenster=1; der Ruecksprung ueber den Ursprung
// hinaus und mit dem, was an der Adresse haengt; ein geleerter Schluessel
// und der Verifier als Sitzung; STORE in account-lite.js umbenannt; in
// AuthLogin opener und der Hoerer gestrichen, in AuthRegister
// skipBrowserRedirect auf false; der Hoerer von Anmeldung und Registrierung
// ohne die Frage nach dem Code; das kleine Fenster, das ins Konto geht statt
// sich zu schliessen, und eines, das vor dem zweiten Faktor endet.
// Nach dem Review vier weitere zu Punkt 4, ebenfalls alle rot: der Link neben
// dem Tab gestrichen und mit opener; die Frage nach dem Konto der Sitzung
// vor dem Loesen gestrichen; und eine Frage, die immer Ja sagt.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as nodeModule from 'node:module';

async function loadTs(rel) {
  const src = fs.readFileSync(path.resolve(rel), 'utf8');
  let js;
  if (typeof nodeModule.stripTypeScriptTypes === 'function') js = nodeModule.stripTypeScriptTypes(src);
  else js = (await import('esbuild')).transformSync(src, { loader: 'ts', format: 'esm' }).code;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const L = await loadTs('src/lib/im-terminal.ts');
// auf LF: unter Windows (core.autocrlf) kommen die Quellen mit CRLF, die Muster erwarten \n
const read = (p) => fs.readFileSync(path.resolve(p), 'utf8').replace(/\r\n/g, '\n');

const ORIGIN = 'https://verse-base.com';
const LOGIN = '/de/account/login.html';

// ein Fenster, wie imTerminal() es fragt: gerahmt oder nicht, mit oder ohne Merkmal
const fenster = ({ gerahmt, merkmal }) => {
  const win = { document: { documentElement: { hasAttribute: (n) => merkmal && n === 'data-vb-terminal' } } };
  win.self = win;
  win.top = gerahmt ? {} : win;
  return win;
};

describe('Regeln (im-terminal.ts)', () => {
  test('im Terminal: gerahmt UND vom Terminal gezeichnet', () => {
    assert.equal(L.imTerminal(fenster({ gerahmt: true, merkmal: true })), true);
    // ein fremder Rahmen (oder das Terminal hat die Seite noch nicht eingerichtet)
    assert.equal(L.imTerminal(fenster({ gerahmt: true, merkmal: false })), false);
    // dieselbe Seite im eigenen Tab, auch wenn das Merkmal stehen geblieben waere
    assert.equal(L.imTerminal(fenster({ gerahmt: false, merkmal: true })), false);
    assert.equal(L.imTerminal(fenster({ gerahmt: false, merkmal: false })), false);
  });

  test('im Terminal: ein Fenster, das sich nicht fragen laesst, ist keines', () => {
    const zu = { get self() { throw new Error('SecurityError'); } };
    assert.equal(L.imTerminal(zu), false);
  });

  test('kleines Fenster: nur die Marke fenster=1', () => {
    assert.equal(L.imFenster('?fenster=1'), true);
    assert.equal(L.imFenster('?next=%2Fde%2Faccount.html&fenster=1&code=abc'), true);
    for (const s of ['', '?', '?fenster', '?fenster=0', '?fenster=true', '?fenster=11', '?x=fenster', '?Fenster=1', '#fenster=1']) {
      assert.equal(L.imFenster(s), false, s);
    }
  });

  test('Ruecksprung: derselbe Ursprung, nur der Pfad, dazu die Marke', () => {
    const ziel = `${ORIGIN}${LOGIN}?fenster=1`;
    assert.equal(L.fensterZiel(ORIGIN, LOGIN), ziel);
    // was an der Adresse der Anmeldeseite haengt, reist nicht mit
    assert.equal(L.fensterZiel(ORIGIN, `${LOGIN}?next=%2Fde%2Fpilot%2Fx&code=abc#oben`), ziel);
    assert.equal(L.fensterZiel(ORIGIN, `${ORIGIN}${LOGIN}`), ziel);
    assert.equal(L.imFenster(new URL(L.fensterZiel(ORIGIN, LOGIN)).search), true);
  });

  test('Ruecksprung: nichts, was den Ursprung verlaesst', () => {
    for (const p of ['https://example.org/de/account/login.html', '//example.org/login', '/\\example.org/login', 'http://verse-base.com/de/account/login.html', 'javascript:alert(1)']) {
      assert.equal(L.fensterZiel(ORIGIN, p), '', p);
    }
    // ohne brauchbaren Ursprung gibt es kein Ziel
    assert.equal(L.fensterZiel('', LOGIN), '');
    assert.equal(L.fensterZiel('kein ursprung', LOGIN), '');
  });

  test('Sitzung entstanden: der Schluessel der Sitzung bekommt einen Wert', () => {
    const key = 'sb-abcdefghijklmnopqrst-auth-token';
    assert.equal(L.sitzungKam({ key, newValue: '{"access_token":"x"}' }), true);
    // abgemeldet (der Wert geht) oder der ganze Speicher geleert (key null)
    assert.equal(L.sitzungKam({ key, newValue: null }), false);
    assert.equal(L.sitzungKam({ key, newValue: '' }), false);
    assert.equal(L.sitzungKam({ key: null, newValue: null }), false);
    // der Verifier fuer Discord liegt daneben und ist keine Sitzung
    assert.equal(L.sitzungKam({ key: `${key}-code-verifier`, newValue: 'v' }), false);
    assert.equal(L.sitzungKam({ key: 'vb-link', newValue: '{}' }), false);
    assert.equal(L.sitzungKam({ key: 'hg-term-an', newValue: '-' }), false);
  });
});

describe('Verdrahtung', () => {
  test('der Schluessel ist der, den das Konto-Skript der Seite liest', () => {
    const m = /var STORE = '([^']+)'/.exec(read('assets/account-lite.js'));
    assert.ok(m, 'assets/account-lite.js nennt seinen Schluessel nicht mehr als STORE');
    assert.match(m[1], L.SITZUNG_KEY);
    assert.doesNotMatch(`${m[1]}-code-verifier`, L.SITZUNG_KEY);
  });

  test('Anmelden und Registrieren nehmen Marke, Namen und Form aus der einen Quelle', () => {
    for (const f of ['src/components/account/AuthLogin.astro', 'src/components/account/AuthRegister.astro']) {
      const s = read(f);
      assert.match(s, /from '\.\.\/\.\.\/lib\/im-terminal'/, f);
      assert.match(s, /window\.open\('', FENSTER_NAME, FENSTER_FORM\)/, f);
      assert.match(s, /fensterZiel\(location\.origin, /, f);
      assert.match(s, /skipBrowserRedirect: true/, f);
      // das kleine Fenster darf die Halle nicht steuern koennen
      assert.match(s, /\.opener = null/, f);
      assert.match(s, /sitzungKam\(e\)/, f);
      // der Hoerer geht erst weiter, wenn die Sitzung keinen Code mehr schuldet:
      // Den zweiten Faktor fragt das Fenster, in dem die Anmeldung laeuft
      const hoerer = /addEventListener\('storage', \(e\) => \{([\s\S]*?)\n    \}\);/.exec(s)?.[1] ?? '';
      assert.match(hoerer, /sitzungKam\(e\)[\s\S]*needsCode\(supabase, true\)/, f);
      assert.doesNotMatch(hoerer, /askCode|passSecondFactor/, f);
    }
    // im kleinen Fenster endet die Anmeldung erst nach dem zweiten Faktor: kein Weg an passSecondFactor vorbei
    const an = read('src/components/account/AuthLogin.astro');
    assert.doesNotMatch(an, /if \(klein\)[^\n]*return;/);
    assert.match(an, /const go = \(\) => \{ if \(klein\) fertig\(\); else location\.replace\(next\); \};/);
    assert.equal(L.FENSTER_PARAM, 'fenster');
    assert.match(L.FENSTER_FORM, /^popup,/);
  });

  test('das Konto im Rahmen: Discord in einem eigenen Tab, und der Weg steht auch als Link da', () => {
    const s = read('src/scripts/account-dashboard.ts');
    const tab = /const discordImTab = \([\s\S]*?\n    \};/.exec(s)?.[0] ?? '';
    assert.match(tab, /if \(!imTerminal\(\)\) return false;\n\s*window\.open\(location\.href, '_blank', 'noopener'\);/);
    // ob der Tab aufging, sagt der Browser nicht: derselbe Weg als Link, ebenfalls ohne opener
    assert.match(tab, /a\.href = location\.href;\s*a\.target = '_blank';\s*a\.rel = 'noopener';[\s\S]*zeile\.append\(' ', a\);/);
    // Bestaetigen und Verbinden gehen im Terminal diesen Weg, bevor sie sonst etwas tun
    assert.equal((s.match(/if \(discordImTab\(/g) ?? []).length, 2);
    const seite = read('src/components/account/AccountDashboard.astro');
    assert.equal((seite.match(/^\s*termTabLink: '[^']+',$/gm) ?? []).length, 2, 'der Text des Links fehlt in einer Sprache');
    assert.match(seite, /data-msg-term-tab-link=\{COPY\.termTabLink\}/);
  });

  test('Verbinden und Loesen mit Discord wirken nur auf das Konto, das die Seite zeigt', () => {
    const s = read('src/scripts/account-dashboard.ts');
    const frage = /const selbesKonto = async[\s\S]*?\n        \};/.exec(s)?.[0] ?? '';
    assert.match(frage, /sitzt = \(await supabase\.auth\.getSession\(\)\)\.data\.session\?\.user\.id \?\? '';/);
    assert.match(frage, /if \(sitzt === user\.id\) return true;\s*dcSay\(D\.dcOtherSession \|\| '', 'err'\);\s*return false;/);
    // die Frage steht vor dem Aufruf, der das Konto aendert
    for (const [knopf, ruf] of [['dcBtn', '.linkIdentity('], ['dcOff', '.unlinkIdentity(']]) {
      const h = new RegExp(`${knopf}\\.addEventListener\\('click', async \\(\\) => \\{([\\s\\S]*?)\\n        \\}\\);`).exec(s)?.[1] ?? '';
      const i = h.indexOf('if (!(await selbesKonto())) return;'), j = h.indexOf(ruf);
      assert.ok(i >= 0 && j > i, `${knopf}: die Frage nach dem Konto der Sitzung fehlt vor ${ruf}`);
    }
    const seite = read('src/components/account/AccountDashboard.astro');
    assert.equal((seite.match(/^\s*dcOtherSession: '[^']+',$/gm) ?? []).length, 2, 'die Meldung fehlt in einer Sprache');
    assert.match(seite, /data-dc-other-session=\{COPY\.dcOtherSession\}/);
  });
});
