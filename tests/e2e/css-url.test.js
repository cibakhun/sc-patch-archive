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

  test('blob: der eigenen Origin und Zugangsdaten in der Adresse: null', () => {
    for (const bad of ['blob:https://staging.verse-base.com/0b5a-1', 'https://user:pw@cdn.example/x.png', 'https://user@cdn.example/x.png']) {
      assert.equal(cssUrl(bad, BASE), null, bad);
    }
    // lokal (http, eigene Origin) bleibt erlaubt, fremdes http nicht
    assert.equal(cssUrl('/assets/x.jpg', 'http://localhost:4321/pilot/a'), 'url("http://localhost:4321/assets/x.jpg")');
    assert.equal(cssUrl('http://localhost:4322/x.jpg', 'http://localhost:4321/pilot/a'), null);
  });

  test('Bau-Daten (Schiffsbilder des Wikis) bleiben erlaubt, Prototyp-Schluessel nicht', () => {
    const wiki = 'https://media.starcitizen.tools/thumb/8/87/100i_Microtech_-_cropped.png/1280px-100i_Microtech_-_cropped.png.webp';
    assert.equal(cssUrl(wiki, BASE), `url("${wiki}")`);
    assert.equal(cssUrl({}.constructor, BASE), null);
  });

  test('protokoll-relative Adresse wird https und bleibt erlaubt, aber sauber', () => {
    assert.equal(cssUrl('//cdn.discordapp.com/x.png', BASE), 'url("https://cdn.discordapp.com/x.png")');
  });
});

describe('Verdrahtung', () => {
  const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');

  // Senke statt Feld: im Code, der im Browser laeuft (src/scripts/*.ts und
  // die <script>-Bloecke der .astro-Dateien), entsteht kein CSS-url() per
  // Einsetzen in einen Template-String. Die Werte dort kommen aus Profilen
  // oder Daten zur Laufzeit; der Weg ist cssUrl(). Frontmatter und
  // Template-Attribute (Bau-Daten zur Bauzeit) zaehlen nicht mit.
  test('kein url(${…}) per Template-String im Browser-Code ausser in cssUrl', () => {
    const files = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|astro)$/.test(e.name)) files.push(p);
      }
    };
    walk('src');
    const SINK = /url\(\s*['"]?\$\{/;
    const funde = [];
    let geprueft = 0;
    for (const f of files) {
      if (f.split(path.sep).join('/') === 'src/lib/cssUrl.ts') continue;
      const src = read(f);
      const teile = f.endsWith('.astro')
        ? [...src.matchAll(/^[ \t]*<script\b[^>]*>([\s\S]*?)<\/script>/gm)].map((m) => m[1])
        : f.includes(`${path.sep}scripts${path.sep}`) ? [src] : [];
      for (const t of teile) {
        geprueft++;
        t.split('\n').forEach((z, i) => { if (SINK.test(z)) funde.push(`${f}: ${z.trim().slice(0, 90)}`); });
      }
    }
    assert.ok(geprueft >= 50, `nur ${geprueft} Skriptteile gelesen — Leser kaputt?`);
    assert.deepEqual(funde, [], 'CSS-url() aus einem Template-String; cssUrl() aus src/lib/cssUrl.ts nehmen');
  });

  test("kein url('${…}') mehr fuer Profilbanner", () => {
    for (const p of ['src/components/pilot/PilotPage.astro', 'src/scripts/account-dashboard.ts']) {
      const s = read(p);
      assert.doesNotMatch(s, /url\('\$\{(url|bUrl)\}'\)/, p);
      assert.match(s, /cssUrl\(/, p);
    }
  });
});
