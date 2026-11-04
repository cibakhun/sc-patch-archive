// Haelt die Supabase-Zugangsdaten an EINER Wahrheit fest.
//
// Die Wahrheit ist die Ziel-Tabelle in scripts/lib/supabase-ziel.mjs (je Bau
// "live" oder, mit STAGING=1, "vorschau"). Von dort bekommen sie:
//   · src/consts.ts ueber das Vite-define __VB_SUPABASE__ (astro.config.mjs)
//     — alles, was durch Astro laeuft, Seiten wie Client-Bundles;
//   · assets/account-lite.js als hartkodierter Kopf — das Skript ist bewusst
//     SDK- und importfrei (~4 KB), damit es auf JEDER Seite ausserhalb von
//     /account/ mitlaufen kann. Die Quelle traegt die Live-Werte,
//     scripts/_sync-assets.mjs setzt beim Kopieren das Ziel des Baus ein.
// Driften sie, ist die Sitzungsanzeige site-weit tot, waehrend /account/
// weiter funktioniert — ein Fehlerbild, das man lange sucht. Gegen das
// fertige dist/ prueft dasselbe verify:supabase-ziel.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  SUPABASE_ZIELE, supabaseZiel, zielName, zielImBau, liteMitZiel, LITE_ZEILEN,
} from '../../scripts/lib/supabase-ziel.mjs';

const consts = fs.readFileSync(path.resolve('src/consts.ts'), 'utf8');
const config = fs.readFileSync(path.resolve('astro.config.mjs'), 'utf8');
const lib = fs.readFileSync(path.resolve('scripts/lib/supabase-ziel.mjs'), 'utf8');
const lite = fs.readFileSync(path.resolve('assets/account-lite.js'), 'utf8');

/** Wert einer var im Kopf von account-lite.js. */
function fromLite(src, name) {
  const m = new RegExp(`var ${name} = '([^']+)'`).exec(src);
  assert.ok(m, `${name} fehlt in account-lite.js`);
  return m[1];
}

describe('Supabase-Ziel: eine Tabelle, alle Abnehmer', () => {
  test('1. STAGING=1 waehlt "vorschau", alles andere "live"', () => {
    assert.strictEqual(zielName({ STAGING: '1' }), 'vorschau');
    assert.strictEqual(zielName({}), 'live');
    assert.strictEqual(zielName({ STAGING: '0' }), 'live');
    assert.strictEqual(zielImBau({ STAGING: '1' }).ziel, 'vorschau');
    assert.throws(() => supabaseZiel('produktion'), /unbekannt/);
  });

  test('2. Jedes Ziel: URL, Sitzungsschluessel und Ref gehoeren zusammen', () => {
    for (const name of Object.keys(SUPABASE_ZIELE)) {
      const z = supabaseZiel(name);
      assert.match(z.ref, /^[a-z0-9]{20}$/, `${name}: Ref`);
      assert.strictEqual(z.url, `https://${z.ref}.supabase.co`);
      assert.strictEqual(z.storageKey, `sb-${z.ref}-auth-token`);
      assert.match(z.publishableKey, /^sb_publishable_/, `${name}: kein Publishable Key`);
    }
  });

  test('3. src/consts.ts liest das Ziel aus dem Bau und raet nicht', () => {
    const block = /export const SUPABASE = \{([\s\S]*?)\} as const;/.exec(consts);
    assert.ok(block, 'SUPABASE-Block in consts.ts nicht gefunden');
    for (const key of ['url', 'publishableKey', 'storageKey'])
      assert.match(block[1], new RegExp(`\\b${key}: __VB_SUPABASE__\\.${key},`), `${key} kommt nicht aus __VB_SUPABASE__`);
    assert.ok(!/supabase\.co|sb_publishable_/.test(consts), 'consts.ts nennt ein Projekt woertlich');
    assert.match(consts, /if \(typeof __VB_SUPABASE__ !== 'object' \|\| __VB_SUPABASE__ === null\) \{\s*throw new Error/);
    assert.match(config, /__VB_SUPABASE__: JSON\.stringify\(supabaseFuerSeite\(\)\)/);
    assert.match(config, /const \{ url, publishableKey, storageKey \} = zielImBau\(\);/);
  });

  test('4. Quelle von account-lite.js traegt genau die Live-Werte', () => {
    const live = supabaseZiel('live');
    assert.strictEqual(fromLite(lite, 'SB_URL'), live.url);
    assert.strictEqual(fromLite(lite, 'SB_KEY'), live.publishableKey);
    assert.strictEqual(fromLite(lite, 'STORE'), live.storageKey);
    // Live unveraendert: die Einsetzung ist dort eine Identitaet.
    assert.strictEqual(liteMitZiel(lite, live), lite);
  });

  test('5. Einsetzen fuer ein anderes Projekt trifft alle drei Zeilen und sonst nichts', () => {
    const fremd = { url: 'https://abcdefghijklmnopqrst.supabase.co', publishableKey: 'sb_publishable_test', storageKey: 'sb-abcdefghijklmnopqrst-auth-token' };
    const out = liteMitZiel(lite, fremd);
    assert.strictEqual(fromLite(out, 'SB_URL'), fremd.url);
    assert.strictEqual(fromLite(out, 'SB_KEY'), fremd.publishableKey);
    assert.strictEqual(fromLite(out, 'STORE'), fremd.storageKey);
    assert.ok(!out.includes(supabaseZiel('live').ref), 'Live-Ref steht nach dem Einsetzen noch im Skript');
    const zeilenWeg = (a, b) => a.split('\n').filter((z, i) => z !== b.split('\n')[i]).length;
    assert.strictEqual(zeilenWeg(lite, out), LITE_ZEILEN.length, 'mehr als die drei Kopfzeilen geaendert');
    // CRLF (Windows-Checkout) bleibt CRLF — auch wenn die Quelle hier schon
    // mit CRLF ausgecheckt ist (deshalb erst auf LF normalisieren).
    const crlfQuelle = lite.replace(/\r?\n/g, '\r\n');
    const crlf = liteMitZiel(crlfQuelle, fremd);
    assert.strictEqual(fromLite(crlf, 'SB_URL'), fremd.url);
    assert.ok(!/(^|[^\r])\n/.test(crlf), 'LF ohne CR nach dem Einsetzen');
    assert.ok(!/\r\r/.test(crlf), 'doppeltes CR nach dem Einsetzen');
    assert.strictEqual(crlf.split('\r\n').length, crlfQuelle.split('\r\n').length, 'Zeilenzahl veraendert');
  });

  test('6. Kopf weicht ab -> Bau reisst statt halb umzustellen', () => {
    assert.throws(() => liteMitZiel(lite.replace(/^\s*var SB_KEY = .*$/m, ''), supabaseZiel('live')), /SB_KEY.*0×/);
    const doppelt = lite.replace(/^(\s*var STORE = .*)$/m, '$1\n$1');
    assert.throws(() => liteMitZiel(doppelt, supabaseZiel('live')), /STORE.*2×/);
  });

  test('7. Nur der PUBLISHABLE Key steht im Client — nie ein Secret/Service-Key', () => {
    for (const [name, src] of [['consts.ts', consts], ['supabase-ziel.mjs', lib], ['account-lite.js', lite]]) {
      assert.ok(!/service_role|sb_secret_|SUPABASE_SERVICE/i.test(src), `${name}: Secret-Key im Client`);
    }
  });
});
