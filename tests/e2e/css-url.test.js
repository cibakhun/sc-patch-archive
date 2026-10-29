// cssUrl (src/lib/cssUrl.ts): eine Bildadresse aus einem Profil wird nur als
// sauber gequoteter CSS-Wert url("…") in style.backgroundImage gesetzt.
// Anlass: Staging-Audit 3.1 — PilotPage.astro setzte banner_url roh in
// `url('…')`, ein Apostroph beendete den CSS-String.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cssUrl } from '../../src/lib/cssUrl.ts';

const BASE = 'https://staging.verse-base.com/pilot/abc';
const SB = 'https://trgjhmbnodoarnfmlcqx.supabase.co/storage/v1/object/public/banners/11111111-2222-3333-4444-555555555555/banner?v=1730000000';

describe('cssUrl', () => {
  test('eigenes Banner und Motiv der Seite bleiben unveraendert', () => {
    assert.equal(cssUrl(SB, BASE), `url("${SB}")`);
    assert.equal(cssUrl('/assets/t-pyro-2.jpg', BASE), 'url("https://staging.verse-base.com/assets/t-pyro-2.jpg")');
  });

  test('Apostroph und Klammern beenden den Wert nicht mehr', () => {
    const v = cssUrl("https://x.example/a.jpg'), url('https://evil.example/t.gif", BASE);
    // genau EIN url(...) mit doppelten Anfuehrungszeichen, kein nacktes " darin
    assert.match(v, /^url\("[^"]*"\)$/);
  });

  test('" und \\ im Host werden escaped, nicht durchgereicht', () => {
    const v = cssUrl('https://a"b.example/x', BASE);
    assert.match(v, /^url\("[^"]*"\)$/);
    assert.ok(v.includes('\\22 '), v);
  });

  test('fremde Schemata und http fremder Hosts: null', () => {
    for (const bad of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'http://evil.example/x.png', 'vbscript:x', '', '   ', null, undefined, 42]) {
      assert.equal(cssUrl(bad, BASE), null, String(bad));
    }
  });

  test('protokoll-relative Adresse wird https und bleibt erlaubt, aber sauber', () => {
    assert.equal(cssUrl('//cdn.discordapp.com/x.png', BASE), 'url("https://cdn.discordapp.com/x.png")');
  });
});

describe('Verdrahtung', () => {
  const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');
  test("kein url('${…}') mehr fuer Profilbanner", () => {
    for (const p of ['src/components/pilot/PilotPage.astro', 'src/scripts/account-dashboard.ts']) {
      const s = read(p);
      assert.doesNotMatch(s, /url\('\$\{(url|bUrl)\}'\)/, p);
      assert.match(s, /cssUrl\(/, p);
    }
  });
});
