// Haelt die Supabase-Zugangsdaten an EINER Wahrheit fest.
//
// Sie stehen zwangslaeufig zweimal im Repo: src/consts.ts fuer alles, was durch
// Astro laeuft, und assets/account-lite.js als hartkodierter Kopf — das Skript
// ist bewusst SDK- und importfrei (~4 KB), damit es auf JEDER Seite ausserhalb
// von /account/ mitlaufen kann. Ein Generator fuer drei Konstanten waere mehr
// Bauwerk als Nutzen; laufen duerfen sie trotzdem nicht auseinander. Genau das
// prueft diese Datei: driften sie, ist die Sitzungsanzeige site-weit tot,
// waehrend /account/ weiter funktioniert — ein Fehlerbild, das man lange sucht.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const consts = fs.readFileSync(path.resolve('src/consts.ts'), 'utf8');
const lite = fs.readFileSync(path.resolve('assets/account-lite.js'), 'utf8');

/** Wert eines Feldes aus dem SUPABASE-Block in consts.ts. */
function fromConsts(key) {
  const block = /export const SUPABASE = \{([\s\S]*?)\} as const;/.exec(consts);
  assert.ok(block, 'SUPABASE-Block in consts.ts nicht gefunden');
  const m = new RegExp(`${key}:\\s*'([^']+)'`).exec(block[1]);
  assert.ok(m, `${key} fehlt im SUPABASE-Block`);
  return m[1];
}

/** Wert einer var im Kopf von account-lite.js. */
function fromLite(name) {
  const m = new RegExp(`var ${name} = '([^']+)'`).exec(lite);
  assert.ok(m, `${name} fehlt in account-lite.js`);
  return m[1];
}

describe('Supabase-Konfiguration: consts.ts == account-lite.js', () => {
  test('1. Projekt-URL ist identisch', () => {
    assert.strictEqual(fromLite('SB_URL'), fromConsts('url'));
  });

  test('2. Publishable Key ist identisch', () => {
    assert.strictEqual(fromLite('SB_KEY'), fromConsts('publishableKey'));
  });

  test('3. localStorage-Schlüssel der Sitzung ist identisch', () => {
    assert.strictEqual(fromLite('STORE'), fromConsts('storageKey'));
  });

  test('4. Der Sitzungsschlüssel gehört zur Projekt-URL (Ref-Bindung)', () => {
    const ref = new URL(fromConsts('url')).hostname.split('.')[0];
    assert.strictEqual(fromConsts('storageKey'), `sb-${ref}-auth-token`);
  });

  test('5. Nur der PUBLISHABLE Key steht im Client — nie ein Secret/Service-Key', () => {
    for (const [name, src] of [['consts.ts', consts], ['account-lite.js', lite]]) {
      assert.ok(!/service_role|sb_secret_|SUPABASE_SERVICE/i.test(src), `${name}: Secret-Key im Client`);
    }
  });
});
