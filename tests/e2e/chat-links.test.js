// Links im Chat (src/lib/chatLinks.ts): eigene Seiten werden zu Links und
// Karten, fremde Adressen bleiben Text. Loadout-Links nur, wenn es den Hangar
// gibt (Vorschau-Bau); live wären sie tote Verweise.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as nodeModule from 'node:module';

async function loadTs(rel) {
  const src = fs.readFileSync(path.resolve(rel), 'utf8');
  let js;
  if (typeof nodeModule.stripTypeScriptTypes === 'function') {
    js = nodeModule.stripTypeScriptTypes(src);
  } else {
    const { transformSync } = await import('esbuild');
    js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
  }
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const { findChatLinks, chatLinkPath, splitChatText } = await loadTs('src/lib/chatLinks.ts');

describe('Chat: eigene Links erkennen', () => {
  test('Schiff, Item und Loadout, als volle Adresse oder als Pfad', () => {
    const t = 'schau https://verse-base.com/schiffe/aegs-gladius.html und /de/items/100i.html, '
      + 'dazu https://staging.verse-base.com/de/hangar.html?ship=drak-cutlass-black&layout=WzEsIiIse31d!';
    const ls = findChatLinks(t, true);
    assert.deepEqual(ls.map((l) => [l.kind, l.slug]), [['ship', 'aegs-gladius'], ['item', '100i'], ['loadout', 'drak-cutlass-black']]);
    assert.equal(ls[2].layout, 'WzEsIiIse31d');
    assert.equal(ls[2].page, 'hangar');
    for (const l of ls) assert.equal(t.slice(l.start, l.end).includes(l.slug), true);
    assert.equal(t.slice(ls[0].start, ls[0].end), 'https://verse-base.com/schiffe/aegs-gladius.html');
    assert.equal(t.slice(ls[1].start, ls[1].end), '/de/items/100i.html');
  });

  test('ohne Hangar bleiben Loadout-Links Text', () => {
    const t = 'https://verse-base.com/hangar-loadout.html?ship=aegs-gladius&layout=WzEsIiIse31d';
    assert.equal(findChatLinks(t, false).length, 0);
    assert.equal(findChatLinks(t, true)[0].page, 'hangar-loadout');
  });

  test('fremde Adressen und Pfade in fremden Links bleiben Text', () => {
    for (const t of [
      'https://example.com/schiffe/aegs-gladius.html',
      'https://verse-base.com.evil.io/schiffe/aegs-gladius.html',
      'http://evil.io/?u=/schiffe/aegs-gladius.html',
      'javascript:alert(1)//verse-base.com/schiffe/x.html',
      '/schiffe/../account.html',
      '/schiffe/Gladius.html',
      '/schiffe/aegs-gladius.html?x=<script>',
      'x/schiffe/aegs-gladius.html',
    ]) assert.equal(findChatLinks(t, true).length, 0, t);
  });

  test('Ziel in der Sprache des Lesers', () => {
    const [ship, lo] = findChatLinks('/de/schiffe/aegs-gladius.html /hangar.html?ship=aegs-gladius', true);
    assert.equal(chatLinkPath(ship, 'en'), '/schiffe/aegs-gladius.html');
    assert.equal(chatLinkPath(ship, 'de'), '/de/schiffe/aegs-gladius.html');
    assert.equal(chatLinkPath(lo, 'de'), '/de/hangar.html?ship=aegs-gladius');
  });

  test('Text zerfällt lückenlos in Klartext und Links', () => {
    const t = 'a /schiffe/aegs-gladius.html b';
    const parts = splitChatText(t, findChatLinks(t, true));
    assert.equal(parts.length, 3);
    assert.equal(parts[0], 'a ');
    assert.equal(parts[2], ' b');
    assert.equal(parts.map((p) => (typeof p === 'string' ? p : t.slice(p.start, p.end))).join(''), t);
  });
});
