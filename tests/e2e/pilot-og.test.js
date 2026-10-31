// Regressionsschutz für „Teilen und Einladen" (Kontoseite Runde 4): Wer
// /de/pilot/<handle> in Discord postet, soll die Karte dieses Piloten sehen.
// nginx/pilot.js setzt dafür die Vorschau-Kopfzeilen der statischen Seite,
// die Einladungskarte im Freunde-Bereich zeigt dieselbe Karte vorab
// (src/lib/pilotPreview.ts). Geprüft wird das njs-Modul in node:vm gegen die
// GEBAUTE Seite: verschiebt Layout.astro einen <meta>, griffe die Ersetzung
// sonst still ins Leere, und jeder geteilte Link sähe wieder leer aus.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pilotPreview } from '../../src/lib/pilotPreview.ts';

const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');
const src = read('nginx/pilot.js');
const conf = read('nginx/default.conf');
const docker = read('Dockerfile');
const consts = read('src/consts.ts');
const pilotPage = read('src/components/pilot/PilotPage.astro');
const register = read('src/components/account/AuthRegister.astro');
const friends = read('src/components/account/FriendsManager.astro');
const pages = { de: read('dist/de/pilot.html'), en: read('dist/pilot.html') };

// Das Modul so laden, wie njs es tut: ein Default-Export, `fs` und `ngx`
// kommen von außen.
const load = (ctx = {}) => {
  const body = src
    .replace(/^import fs from 'fs';$/m, '')
    .replace(/^export default (\{[^}]*\});$/m, 'return $1;');
  assert.notStrictEqual(body, src, 'Import/Export-Zeile von nginx/pilot.js nicht gefunden');
  const sandbox = {
    fs: ctx.fs || { readFileSync: (p) => (p.endsWith('/de/pilot.html') ? pages.de : pages.en) },
    ngx: ctx.ngx || { fetch: () => Promise.reject(new Error('kein Netz')) },
    process: { env: ctx.env || {} },
    setTimeout, clearTimeout, Promise, RegExp, String, JSON,
  };
  return vm.runInNewContext(`(function(){${body}})()`, sandbox);
};
const mod = load();

const metaOf = (html, attr, name) => {
  const m = new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html);
  return m ? m[1] : null;
};
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const TARGETS = [
  ['name', 'description'], ['property', 'og:title'], ['property', 'og:description'], ['property', 'og:url'],
  ['property', 'og:image'], ['property', 'og:image:alt'], ['name', 'twitter:card'], ['name', 'twitter:image'], ['name', 'theme-color'],
];
const KRISZ = {
  handle: 'krisz', display_name: 'Krisz', bio: 'Mining, Hangar, Loadouts.', banner_url: '/assets/img-cutlass.jpg',
  avatar_url: 'https://cdn.discordapp.com/avatars/1/a.png', avatar_color: '#2dd4ff', org_name: 'VerseBase',
};

describe('Teilen: eigene Link-Vorschau je Pilot', () => {
  test('1. Jede Vorschau-Kopfzeile der gebauten Seite wird ersetzt, der Rumpf bleibt Byte für Byte', () => {
    let n = 0;
    for (const lang of ['de', 'en']) {
      const before = pages[lang];
      const after = mod.withPilot(before, KRISZ, lang === 'de');
      // Nur mit Profilbild (ohne Titelbild) wird die Karte klein: twitter:card dort prüfen.
      const thumb = mod.withPilot(before, { ...KRISZ, banner_url: '' }, lang === 'de');
      for (const [attr, name] of TARGETS) {
        assert.notStrictEqual(metaOf(before, attr, name), null, `${lang}: <meta ${attr}="${name}"> fehlt in der gebauten Seite`);
        const got = name === 'twitter:card' ? thumb : after;
        assert.notStrictEqual(metaOf(got, attr, name), metaOf(before, attr, name), `${lang}: ${name} unverändert`);
        n++;
      }
      assert.match(after, /<title>Krisz \(@krisz\) \| VerseBase<\/title>/);
      // Inline-Skripte stehen per sha256 in der CSP: unterhalb von </head> darf sich nichts ändern.
      assert.strictEqual(after.slice(after.indexOf('</head>')), before.slice(before.indexOf('</head>')));
    }
    console.log(`  geprüft: ${n} Kopfzeilen in 2 Sprachen`);
  });

  test('2. Fremder Text landet escaped in den Attributen, Bilder nur von hier oder https', () => {
    const evil = {
      handle: 'evil', display_name: '"><script>alert(1)</script>', bio: "$& $1 $` it's",
      banner_url: 'javascript:alert(1)', avatar_url: '//evil.example/a.png', avatar_color: 'red;x', org_name: null,
    };
    const out = mod.withPilot(pages.de, evil, true);
    const head = out.slice(0, out.indexOf('</head>'));
    assert.ok(!head.includes('<script>alert'), 'Name roh im Kopf');
    assert.strictEqual(unesc(metaOf(out, 'property', 'og:description')), "$& $1 $` it's");
    assert.strictEqual(metaOf(out, 'property', 'og:image'), metaOf(pages.de, 'property', 'og:image'), 'fremdes Bild übernommen');
    assert.strictEqual(metaOf(out, 'name', 'theme-color'), metaOf(pages.de, 'name', 'theme-color'));
    for (const bad of ['http://x.example/a.png', 'data:image/png;base64,AAAA', '/a//b.png', 'https://x.example/a".png']) {
      const o = mod.withPilot(pages.de, { ...KRISZ, banner_url: bad, avatar_url: '' }, true);
      assert.strictEqual(metaOf(o, 'property', 'og:image'), metaOf(pages.de, 'property', 'og:image'), `Bild ${bad} übernommen`);
    }
    assert.strictEqual(mod.withPilot(pages.de, { ...KRISZ, handle: 'a b' }, true), pages.de, 'ungültiger Handle verändert die Seite');
  });

  test('3. Seite und Einladungskarte zeigen dieselbe Karte (nginx/pilot.js = src/lib/pilotPreview.ts)', () => {
    const cases = [
      KRISZ,
      { ...KRISZ, banner_url: '', bio: '' },
      { ...KRISZ, banner_url: '', avatar_url: '', org_name: '', avatar_color: '' },
      { ...KRISZ, display_name: '', bio: 'x '.repeat(300), org_name: 'A'.repeat(90) },
    ];
    for (const lang of ['de', 'en']) {
      const origin = /<meta property="og:url" content="(https:\/\/[^/]+)\//.exec(pages[lang])[1];
      for (const p of cases) {
        const out = mod.withPilot(pages[lang], p, lang === 'de');
        const pv = pilotPreview(p, lang, origin);
        assert.strictEqual(unesc(metaOf(out, 'property', 'og:title')), pv.title);
        assert.strictEqual(unesc(metaOf(out, 'property', 'og:description')), pv.desc);
        assert.strictEqual(metaOf(out, 'property', 'og:url'), pv.url);
        assert.strictEqual(metaOf(out, 'property', 'og:image'), pv.image || metaOf(pages[lang], 'property', 'og:image'));
        assert.strictEqual(metaOf(out, 'name', 'twitter:card'), pv.image && !pv.large ? 'summary' : 'summary_large_image');
        assert.strictEqual(metaOf(out, 'name', 'theme-color'), pv.color || metaOf(pages[lang], 'name', 'theme-color'));
      }
    }
  });

  test('4. page(): Profil holen, bei jedem Fehler die Seite unverändert', async () => {
    const run = async (fetchImpl, h = 'Krisz') => {
      const calls = [];
      const m = load({ ngx: { fetch: (url, opt) => { calls.push({ url, opt }); return fetchImpl(); } } });
      const r = { uri: '/de/pilot.html', args: { h }, headersOut: {}, warn() {}, error() {}, sent: null, return(code, body) { this.sent = { code, body }; } };
      await m.page(r);
      return { r, calls };
    };
    const ok = await run(() => Promise.resolve({ status: 200, json: () => Promise.resolve([KRISZ]) }));
    assert.strictEqual(ok.r.sent.code, 200);
    assert.strictEqual(ok.r.headersOut['Content-Type'], 'text/html; charset=utf-8');
    assert.match(ok.r.sent.body, /<title>Krisz \(@krisz\)/);
    assert.match(ok.calls[0].url, /\/rest\/v1\/public_profiles\?select=[a-z_,]+&handle=eq\.krisz&limit=1$/, 'Handle nicht klein geschrieben oder Abfrage anders');
    assert.ok(ok.calls[0].opt.headers.apikey, 'ohne apikey');
    for (const bad of [
      () => Promise.reject(new Error('netz')),
      () => Promise.resolve({ status: 500, json: () => Promise.resolve(null) }),
      () => Promise.resolve({ status: 200, json: () => Promise.reject(new Error('json')) }),
      () => Promise.resolve({ status: 200, json: () => Promise.resolve([]) }),
    ]) {
      const { r } = await run(bad);
      assert.strictEqual(r.sent.code, 200);
      assert.strictEqual(r.sent.body, pages.de, 'Fehlerfall verändert die Seite');
    }
    const none = await run(() => Promise.resolve({ status: 200, json: () => Promise.resolve([KRISZ]) }), '../x');
    assert.strictEqual(none.calls.length, 0, 'ungültiger Handle fragt trotzdem an');
  });

  test('5. Verdrahtung: nginx-Orte mit Tor, Modul im Image, Schlüssel wie im Seiten-JS', () => {
    assert.match(conf, /^js_import pilot from \/etc\/nginx\/pilot\.js;$/m);
    for (const loc of ['/de/pilot.html', '/pilot.html']) {
      const re = new RegExp(`location = ${loc.replace(/[./]/g, '\\$&')} \\{\\s*if \\(\\$vb_gate_ok = "0"\\) \\{ return 302 /gate\\.html\\?next=\\$vb_next; \\}\\s*js_content pilot\\.page;\\s*\\}`);
      assert.match(conf, re, `location = ${loc} ohne Tor oder ohne pilot.page`);
    }
    assert.match(docker, /^COPY nginx\/pilot\.js \/etc\/nginx\/pilot\.js$/m);
    const sb = /export const SUPABASE = \{\s*url: '([^']+)',\s*publishableKey: '([^']+)'/.exec(consts);
    assert.ok(sb, 'SUPABASE-Block in src/consts.ts nicht gefunden');
    const [, url, key] = sb;
    assert.ok(src.includes(`'${url}'`) && src.includes(`'${key}'`), 'Rückfall-URL/Schlüssel in nginx/pilot.js weicht von src/consts.ts ab');
    // Gleiche Handle-Regel wie die Seite selbst, sonst holt nginx andere Piloten als sie.
    assert.ok(pilotPage.includes('/^[a-z0-9_]{3,24}$/') && src.includes('/^[a-z0-9_]{3,24}$/'));
  });

  test('6. Einladen: Rückweg nach dem Registrieren und vorbefülltes Feld', () => {
    assert.match(pilotPage, /cta\.href = app\.dataset\.register \+ '\?next=' \+ encodeURIComponent\(location\.pathname \+ location\.search\)/);
    assert.match(pilotPage, /\?add=\$\{encodeURIComponent\(handle\)\}#friends/);
    assert.match(register, /safeNext\(nextRaw, location\.origin, ''\)/);
    // Jeder Ausgang der Registrierung trägt das Ziel weiter.
    for (const exit of ['location.replace(nextOk || D.dash!)', 'withNext(D.login!)', "withNext(dcReg.dataset.login || '/account/login.html')"]) {
      assert.ok(register.includes(exit), `Registrierung verliert ?next= bei ${exit}`);
    }
    assert.match(friends, /get\('add'\)/);
    for (const id of ['fmInvite', 'fmInviteUrl', 'fmInviteCopy', 'fmInviteShare', 'fmInviteOpen', 'fmDc', 'fmDcTitle', 'fmDcDesc', 'fmDcImg', 'fmInviteTip']) {
      assert.match(friends, new RegExp(`\\sid="${id}"`), `#${id} fehlt`);
    }
  });
});
