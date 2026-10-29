// Ruecksprungziel ?next= der Anmeldeseite: src/lib/safe-next.ts laesst nur
// Pfade auf derselben Origin durch, Query und Fragment bleiben erhalten.
import { test } from 'node:test';
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

const ORIGIN = 'https://verse-base.com';
const FREMD = ['/.//evil.example', '/..//evil.example', '/%2e//evil.example', '/./\\evil.example', '/x/..//evil.example', '//evil.example', '/\\evil.example', 'https://evil.example/', '\t/evil.example'];
const GUT = [['/account.html?x=1#y', '/account.html?x=1#y'], ['/de/account.html', '/de/account.html'], ['/', '/']];

test('safeNext: fremde Ziele -> Rueckfall, eigene bleiben', async () => {
  const { safeNext } = await loadTs('src/lib/safe-next.ts');
  for (const raw of FREMD) assert.equal(safeNext(raw, ORIGIN, '/dash'), '/dash', raw);
  for (const [raw, soll] of GUT) assert.equal(safeNext(raw, ORIGIN, '/dash'), soll, raw);
  assert.equal(safeNext('', ORIGIN, '/dash'), '/dash');
});

test('AuthLogin.astro nutzt die gemeinsame Regel', () => {
  const s = fs.readFileSync(path.resolve('src/components/account/AuthLogin.astro'), 'utf8');
  assert.match(s, /import \{ safeNext \} from '\.\.\/\.\.\/lib\/safe-next';/);
  assert.match(s, /const next = safeNext\(rawNext, location\.origin, D\.dash!\);/);
});
