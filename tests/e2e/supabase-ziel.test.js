// verify:supabase-ziel an kleinen Probe-Artefakten vorgefuehrt: sauber
// gruen, und jede Abweichung, fuer die das Tor da ist, rot. Ziel-Tabelle
// und Begruendung: scripts/lib/supabase-ziel.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { supabaseZiel, liteMitZiel, CSP_SUPABASE } from '../../scripts/lib/supabase-ziel.mjs';

const LITE = fs.readFileSync(path.resolve('assets/account-lite.js'), 'utf8');
const FREMD = 'zzzzzzzzzzzzzzzzzzzz';

/** Ein Probe-dist, wie es der Bau fuer `name` schreibt (nur die Pflichtstellen). */
function probe(name) {
  const z = supabaseZiel(name);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-sbziel-'));
  const put = (rel, txt) => { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), txt); };
  put('build.json', JSON.stringify({ sha: 'dev', staging: name === 'vorschau', supabase: { ziel: z.ziel, ref: z.ref } }));
  const kopf = `<script>try{localStorage.getItem('${z.storageKey}')}catch(e){}</script>`;
  put('index.html', `<html><head>${kopf}</head><body>Start</body></html>`);
  put('de/index.html', `<html><head>${kopf}</head><body>Start</body></html>`);
  put('gate.html', `<html><head>${kopf}<script>const SB_URL=${JSON.stringify(z.url)},SB_KEY=${JSON.stringify(z.publishableKey)};</script></head></html>`);
  put('datenschutz.html', `<html><head>${kopf}</head><li><strong>${new URL(z.url).host}</strong> (Supabase</li></html>`);
  put('de/datenschutz.html', `<html><head>${kopf}</head><li><strong>${new URL(z.url).host}</strong> (Supabase</li></html>`);
  put('_astro/supabase.abc123.js', `const e=${JSON.stringify({ url: z.url, publishableKey: z.publishableKey, storageKey: z.storageKey })};`);
  put('assets/account-lite.js', liteMitZiel(LITE, z));
  for (const { datei, wert } of CSP_SUPABASE) put(`_csp/${datei}`, `# Probe\ncsp "${wert(z)}";\n`);
  put('hangar/schiff.glb', `binaer ${FREMD}.supabase.co`); // keine Textdatei: wird nicht gelesen
  return { d, put, z };
}
const tor = (d, klinke = '1') =>
  spawnSync(process.execPath, ['scripts/verify-supabase-ziel.mjs', '--dist', d, '--klinke-dateien', klinke], { encoding: 'utf8' });

test('sauberer Live- und Vorschau-Bau: gruen, mit Selbstauskunft', () => {
  for (const name of ['live', 'vorschau']) {
    const { d } = probe(name);
    const r = tor(d);
    assert.equal(r.status, 0, `${name}: ${r.stderr}${r.stdout}`);
    assert.match(r.stdout, new RegExp(`Soll-Ziel "${name}"`));
    assert.match(r.stdout, /\[2\] 10 Textdateien gelesen \(Klinke 1\): 9 nennen das Ziel \(Klinke 1\), 0 ein anderes Projekt/);
    assert.match(r.stdout, /\[3\] 9 Pflichtstellen geprueft/);
  }
});

test('[1] vertauschte Wahl ist rot, auch solange beide Ziele dasselbe Projekt nennen', () => {
  const a = probe('live');
  a.put('build.json', JSON.stringify({ staging: true, supabase: { ziel: 'live', ref: a.z.ref } }));
  let r = tor(a.d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[1\] dist\/build\.json nennt Supabase-Ziel "live", ein Vorschau-Bau muss "vorschau" ansprechen/);

  a.put('build.json', JSON.stringify({ staging: false }));
  r = tor(a.d);
  assert.equal(r.status, 1, 'Stempel ohne Ziel');
  assert.match(r.stderr, /nennt Supabase-Ziel null/);

  a.put('build.json', JSON.stringify({ staging: false, supabase: { ziel: 'live', ref: FREMD } }));
  r = tor(a.d);
  assert.equal(r.status, 1, 'Stempel mit fremdem Ref');
  assert.match(r.stderr, new RegExp(`nennt Ref "${FREMD}", die Tabelle fuer "live"`));
});

test('[2] ein fremdes Projekt an einer einzigen Stelle ist rot', () => {
  const faelle = [
    ['de/missionen/x.html', `<img src="https://${FREMD}.supabase.co/storage/v1/object/public/a.png">`, /Host zzzz/],
    ['_astro/chat.def456.js', `localStorage.getItem("sb-${FREMD}-auth-token")`, /Sitzungsschluessel sb-zzzz/],
    ['assets/daten.json', '{"k":"sb_publishable_fremderSchluessel_123"}', /Publishable Key sb_publishable_fremder/],
    ['_astro/admin.js', 'const k="sb_secret_abcdef";', /geheimer Schluessel sb_secret_/],
  ];
  for (const [datei, text, meldung] of faelle) {
    const a = probe('live');
    a.put(datei, text);
    const r = tor(a.d);
    assert.equal(r.status, 1, datei);
    assert.match(r.stderr, new RegExp(`\\[2\\] dist/${datei.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}: `), datei);
    assert.match(r.stderr, meldung, datei);
  }
});

test('[3] eine Pflichtstelle ohne das Ziel ist rot', () => {
  const a = probe('live');
  fs.rmSync(path.join(a.d, '_csp/supabase-ws.conf'));
  let r = tor(a.d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[3\] dist\/_csp\/supabase-ws\.conf traegt das Ziel "live" nicht/);

  const b = probe('live');
  b.put('assets/account-lite.js', LITE.replace(/^(\s*var STORE = ).*$/m, "$1'sb-lite';"));
  r = tor(b.d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[3\] dist\/assets\/account-lite\.js: var STORE traegt/);

  const c = probe('live');
  c.put('de/datenschutz.html', '<html><li><strong>supabase.com</strong></li></html>');
  r = tor(c.d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[3\] dist\/de\/datenschutz\.html traegt/);
});

test('Klinke: zu wenig gelesen ist rot, auch wenn sonst alles stimmt', () => {
  const { d } = probe('live');
  const r = tor(d, '50');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /gelesen: 10 Textdateien, Klinke 50/);
  assert.match(r.stderr, /nur 9 Dateien nennen das Ziel, Klinke 50/);
});
