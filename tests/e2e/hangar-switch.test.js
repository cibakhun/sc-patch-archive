// Live bekommt alles von staging ausser dem Hangar (Krisz 31.10.2026).
// Schalter und Begruendung: scripts/lib/hangar-switch.mjs. Hier: die Regel
// ist an beiden Stellen dieselbe, die Routen haengen nur im Vorschau-Bau,
// der Bauschritt raeumt live auf, das Tor sieht Reste, und jede Stelle, die
// zum Hangar fuehrt, fragt den Schalter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hangarImBau, hangarImArtefakt, HANGAR_ROUTES, HANGAR_DIST_FILES, HANGAR_HREF } from '../../scripts/lib/hangar-switch.mjs';
import { hangarRoutes } from '../../astro.config.mjs';

const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');

test('Regel: Hangar nur mit STAGING=1, an beiden Stellen gleich', () => {
  assert.equal(hangarImBau({ STAGING: '1' }), true);
  assert.equal(hangarImBau({}), false);
  assert.equal(hangarImBau({ STAGING: '0' }), false);
  assert.match(read('src/lib/seo.ts'), /export const HAS_HANGAR: boolean = IS_STAGING;/);
  assert.match(read('src/lib/seo.ts'), /process\.env\?\.STAGING === '1'/);
  assert.match(read('src/lib/hangarFlag.ts'), /typeof __VB_HANGAR__ === 'boolean' \? __VB_HANGAR__ : true/);
  assert.match(read('astro.config.mjs'), /define: \{ __VB_HANGAR__: JSON\.stringify\(hangarImBau\(\)\) \}/);
});

test('Routen: liegen nicht unter src/pages und haengen nur im Vorschau-Bau', () => {
  for (const r of HANGAR_ROUTES) assert.ok(fs.existsSync(path.resolve(r.entrypoint)), r.entrypoint);
  const inPages = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? inPages(path.join(dir, e.name)) : /hangar/i.test(e.name) || /hangar/i.test(dir) ? [path.join(dir, e.name)] : []);
  assert.deepEqual(inPages('src/pages'), [], 'keine Hangar-Route unter src/pages');
  const haenge = (env) => {
    const got = [];
    hangarRoutes(env).hooks['astro:config:setup']({ injectRoute: (r) => got.push(r.pattern), logger: { info() {} } });
    return got;
  };
  assert.deepEqual(haenge({ STAGING: '1' }), HANGAR_ROUTES.map((r) => r.pattern));
  assert.deepEqual(haenge({}), []);
});

function probe() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-hangar-'));
  const put = (rel, txt = 'x') => { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), txt); };
  put('hangar/tex/a.webp');
  put('hangar/ships/b.glb');
  put('hangar.html', '<a href="/schiffe.html">x</a>');
  put('de/hangar-loadout.html');
  put('hangar-bay/aegs-gladius.html');
  put('hangar-layouts.json', '{}');
  put('assets/hangar-viewer.js');
  put('assets/account-lite.js');
  put('schiffe.html', '<a href="/schiffe/aegs-gladius.html">Gladius</a>');
  put('de/schiffe.html', '<a href="/de/schiffe.html">Schiffe</a>');
  return { d, put };
}
const run = (args, env = {}) => spawnSync(process.execPath, args, { env: { ...process.env, STAGING: '', ...env }, encoding: 'utf8' });

test('Bauschritt: live raeumt Hangar weg, laesst den Rest, Vorschau laesst alles', () => {
  const a = probe();
  let r = run(['scripts/_hangar-switch.mjs', '--dist', a.d]);
  assert.equal(r.status, 0, r.stderr);
  for (const gone of ['hangar', 'hangar.html', 'de/hangar-loadout.html', 'hangar-bay', 'hangar-layouts.json', 'assets/hangar-viewer.js'])
    assert.equal(fs.existsSync(path.join(a.d, gone)), false, gone);
  for (const kept of ['assets/account-lite.js', 'schiffe.html', 'de/schiffe.html']) assert.ok(fs.existsSync(path.join(a.d, kept)), kept);
  assert.match(r.stdout, /Hangar entfernt \(2 Ordner, \d+ Dateien\)/);

  const b = probe();
  r = run(['scripts/_hangar-switch.mjs', '--dist', b.d], { STAGING: '1' });
  assert.equal(r.status, 0);
  assert.ok(fs.existsSync(path.join(b.d, 'hangar/ships/b.glb')));
  assert.ok(fs.existsSync(path.join(b.d, 'hangar.html')));
});

test('Tor: Live-Bau mit Hangar-Rest oder -Link ist rot, sauber gruen', () => {
  const tor = (d) => run(['scripts/verify-hangar-schalter.mjs', '--dist', d, '--klinke-seiten', '1']);
  const a = probe();
  a.put('build.json', JSON.stringify({ staging: false }));
  let r = tor(a.d);
  assert.equal(r.status, 1, 'Reste im Live-Bau');
  assert.match(r.stderr, /\[1\] dist\/hangar\/ gehoert nicht in den Live-Bau/);

  run(['scripts/_hangar-switch.mjs', '--dist', a.d]);
  r = tor(a.d);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /\[2\] 2 Seiten gelesen: 0 mit Verweis/);

  a.put('de/schiffe.html', '<a class="favhangar" href="/de/hangar.html?ship=x">3D</a>');
  r = tor(a.d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[2\] dist\/de\/schiffe\.html: href="\/de\/hangar\.html/);

  a.put('de/schiffe.html', '<script type="module" src="/assets/hangar-viewer.js"></script>');
  assert.equal(tor(a.d).status, 1, 'Hangar-Skript geladen');

  // Klinke: zu wenig gelesen ist rot, auch wenn sonst alles stimmt.
  a.put('de/schiffe.html', '<a href="/de/schiffe.html">Schiffe</a>');
  r = run(['scripts/verify-hangar-schalter.mjs', '--dist', a.d, '--klinke-seiten', '50']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Klinke 50/);
});

test('Tor: Vorschau-Bau ohne Hangar ist rot', () => {
  const a = probe();
  a.put('build.json', JSON.stringify({ staging: true }));
  run(['scripts/_hangar-switch.mjs', '--dist', a.d]); // versehentlich live geraeumt
  const r = run(['scripts/verify-hangar-schalter.mjs', '--dist', a.d, '--klinke-seiten', '1']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[3\] dist\/hangar\.html fehlt im Vorschau-Bau/);
});

test('Muster: Dateien und Links', () => {
  for (const f of ['hangar.html', 'de/hangar.html', 'hangar-loadout.html', 'de/hangar-loadout.html', 'hangar-layouts.json', 'assets/hangar-crew.js'])
    assert.ok(HANGAR_DIST_FILES.test(f), f);
  for (const f of ['schiffe.html', 'assets/account-lite.js', 'de/hangarx.html', 'assets/hangar.css']) assert.ok(!HANGAR_DIST_FILES.test(f), f);
  assert.ok(HANGAR_HREF.test('<a href="/hangar.html">'));
  assert.ok(HANGAR_HREF.test('<a href="/de/hangar-bay/aegs-gladius.html">'));
  assert.ok(HANGAR_HREF.test('<a href="https://verse-base.com/de/hangar-loadout.html?x">'));
  assert.ok(!HANGAR_HREF.test('<a href="/schiffe.html">Hangar</a>'));
});

test('jede Stelle, die zum Hangar fuehrt, fragt den Schalter', () => {
  assert.match(read('src/components/SiteNav.astro'), /\.\.\.\(HAS_HANGAR\s*\?\s*\[\s*\{\s*href: L\('\/hangar\.html'\)/);
  assert.match(read('src/components/ShipDetail.astro'), /\{HAS_HANGAR && \(\s*<a class="favhangar"/);
  assert.match(read('src/components/ships/ShipsOverview.astro'), /\{HAS_HANGAR && <a class="sdb__hangar"/);
  const dash = read('src/components/account/AccountDashboard.astro');
  assert.match(dash, /const hangarHref = HAS_HANGAR \? href\('\/hangar\.html', lang\) : href\('\/schiffe\.html', lang\);/);
  assert.match(dash, /if \(!HAS_HANGAR\) CK\.savedCta = /);
  assert.match(dash, /if \(!HAS_HANGAR\) \{\s*SV\.emptyHint = /);
  const lo = read('src/scripts/account-layouts.ts');
  assert.match(lo, /HANGAR_ON \? \(layouts\.store\.list\(\) as LayoutEntry\[\]\)/);
  assert.match(lo, /if \(started \|\| !HANGAR_ON\) return;/);
  assert.match(read('src/components/pilot/PilotPage.astro'), /const shown = HANGAR_ON \?/);
  // Keine weitere Quelldatei ausserhalb des Hangars nennt eine Hangar-Seite.
  const quellen = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? quellen(p) : /\.(astro|ts|js|mjs)$/.test(e.name) ? [p] : [];
  });
  const erlaubt = new Set(['src/components/SiteNav.astro', 'src/components/ShipDetail.astro', 'src/components/ships/ShipsOverview.astro',
    'src/components/account/AccountDashboard.astro', 'src/scripts/account-layouts.ts', 'src/components/pilot/PilotPage.astro']);
  const fremd = [...quellen('src'), ...quellen('assets')]
    .map((p) => p.split(path.sep).join('/'))
    .filter((p) => !/^src\/(hangar-routes|components\/hangar|lib\/hangar)\/|^assets\/hangar-|^src\/i18n\/(hangarText|layoutText)\.ts$/.test(p))
    .filter((p) => /\/hangar(?:-loadout)?\.html/.test(read(p)) && !erlaubt.has(p));
  // account-lite.js erkennt die Hangar-Seiten nur, um die Aktivitaet zu
  // benennen (kein Link); live kommt dort niemand hin.
  assert.deepEqual(fremd, ['assets/account-lite.js']);
});

test('Tore fragen das Artefakt an EINER Stelle; ohne Stempel gilt der strenge Fall', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-stempel-'));
  assert.equal(hangarImArtefakt(d), true, 'kein Stempel: Hangar gilt als da');
  fs.writeFileSync(path.join(d, 'build.json'), '{kaputt');
  assert.equal(hangarImArtefakt(d), true, 'kaputter Stempel: Hangar gilt als da');
  fs.writeFileSync(path.join(d, 'build.json'), JSON.stringify({ staging: true }));
  assert.equal(hangarImArtefakt(d), true);
  fs.writeFileSync(path.join(d, 'build.json'), JSON.stringify({ staging: false }));
  assert.equal(hangarImArtefakt(d), false);
  for (const f of ['scripts/run-gate.mjs', 'scripts/verify-metrics.mjs', 'scripts/verify-help.mjs', 'scripts/verify-vorklick.mjs']) {
    const t = read(f);
    assert.match(t, /import \{ hangarImArtefakt \} from '\.\/lib\/hangar-switch\.mjs';/, f);
    assert.doesNotMatch(t, /\.staging !== false/, `${f} liest den Stempel selbst`);
  }
  // Live-Bau: die Hangar-Strecken entfallen nur mit Registry-Feld, und die
  // Baseline-Zeile der Buchten verlangt dort 0 statt 227.
  assert.match(read('scripts/lib/metrics-baseline.mjs'), /id: 'seitenHangarBuchten',[\s\S]{0,200}nurMitHangar: true/);
  assert.match(read('scripts/verify-metrics.mjs'), /if \(b\.nurMitHangar && !MIT_HANGAR\) \{\s*const leer = ist === 0;/);
});

test('Browser-Rauchtest: Hangar-Seiten nur mit Hangar, live muessen sie 404 sein', () => {
  const t = read('scripts/browser-smoke.mjs');
  // Beide Hangar-Seiten tragen das Feld, sonst liefe der Live-Lauf in 404.
  const hangarSeiten = [...t.matchAll(/id: '(hangar[\w-]*)'[\s\S]*?\}/g)].map((m) => m[0]);
  assert.equal(hangarSeiten.length, 2, 'hangar und hangar-layout');
  for (const s of hangarSeiten) assert.match(s, /nurMitHangar: true/, s.slice(0, 40));
  // Dieselbe Regel wie hangarImArtefakt(): Stempel des laufenden Artefakts, strenger Fall bei Fehlen.
  assert.match(t, /let MIT_HANGAR = true;[\s\S]{0,200}fetch\(`\$\{BASE\}\/build\.json`[\s\S]{0,160}\.staging !== false/);
  // Im Live-Lauf entfallen sie nicht still: jede muss 404 antworten.
  assert.match(t, /const ok = status === 404;\s*if \(!ok\) fehler\.push\(/);
});
