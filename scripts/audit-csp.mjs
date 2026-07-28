// Hält die Content-Security-Policy an dem fest, was die Seite WIRKLICH lädt.
//
// Anlass: die erste Fassung der Richtlinie entstand aus Stichproben von fünf
// Seiten. Dabei fehlten `api.fleetyards.net` (3.564 Schiffsbilder), das externe
// YouTube-`iframe_api`-Skript und alles, was der 3D-Viewer braucht — `blob:`
// für Worker und Texturen sowie 'wasm-unsafe-eval' für den Draco-Dekomprimierer.
// Eine CSP bricht nicht beim Deploy, sondern still im Browser des Besuchers;
// deshalb wird sie hier gegen den fertigen Build gemessen statt gelesen.
//
// Läuft im Qualitätstor des Dockerfile mit. Findet es eine Quelle, die die
// Richtlinie nicht deckt, entsteht kein Image.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CONF = 'nginx/default.conf';
const DIST = 'dist';
if (!existsSync(DIST)) { console.error('dist/ fehlt — erst npm run build.'); process.exit(2); }

// ---------------------------------------------------------------- Richtlinie --
const conf = readFileSync(CONF, 'utf8');
const m = /add_header\s+Content-Security-Policy\s+"([^"]+)"/.exec(conf);
if (!m) { console.error(`Keine Content-Security-Policy in ${CONF} gefunden.`); process.exit(2); }

const policy = Object.fromEntries(
  m[1].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [name, ...src] = d.split(/\s+/);
    return [name, src];
  }),
);
/** Quellenliste einer Direktive, mit dem Rückfall auf default-src. */
const srcFor = (name) => policy[name] ?? policy['default-src'] ?? [];
const LOADING = ['img-src', 'script-src', 'frame-src', 'media-src', 'connect-src', 'style-src'];
const allows = (name, host) =>
  srcFor(name).some((s) => s === `https://${host}` || s === host);
const covers = (name, host) =>
  name === '(inline-js)' ? LOADING.some((d) => allows(d, host)) : allows(name, host);

// ------------------------------------------------------------------ Messung --
const found = new Map();   // "direktive host" -> {n, sample}
const note = (directive, url, page) => {
  let host;
  try { host = new URL(url).host; } catch { return; }
  if (host === 'verse-base.com') return;              // die eigene Domain
  const k = `${directive}|${host}`;
  if (!found.has(k)) found.set(k, { n: 0, sample: page });
  found.get(k).n++;
};

// Attribut -> Direktive. `preconnect`/`dns-prefetch` fehlen bewusst: die
// unterliegen der CSP nicht (sie holen keine Ressource).
const PATTERNS = [
  ['img-src', /<img[^>]+src="(https?:\/\/[^"]+)"/g],
  ['img-src', /url\((?:'|")?(https?:\/\/[^'")]+)/g],
  ['img-src', /data-(?:img|lb|fallback)[a-z-]*="(?:img:)?(https?:\/\/[^"]+)"/g],
  ['script-src', /<script[^>]+src="(https?:\/\/[^"]+)"/g],
  ['frame-src', /<iframe[^>]+src="(https?:\/\/[^"]+)"/g],
  ['media-src', /<(?:video|audio|source)[^>]+src="(https?:\/\/[^"]+)"/g],
  ['style-src', /<link[^>]+rel="stylesheet"[^>]+href="(https?:\/\/[^"]+)"/g],
];

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!p.endsWith('.html')) continue;
    const html = readFileSync(p, 'utf8');
    for (const [directive, re] of PATTERNS)
      for (const hit of html.matchAll(re)) note(directive, hit[1], p);

    // Inline-Skripte bauen ihre URLs erst im Browser zusammen (die Klick-zu-
    // Laden-Fassade steckt den YouTube-<iframe> per innerHTML hinein, die
    // Profilseite ihre Bild-Rückfallkette). Die Attribut-Suche oben sieht davon
    // nichts. WELCHE Direktive greift, lässt sich hier nicht zuverlässig raten —
    // deshalb zählt ein Host als gedeckt, sobald IRGENDEINE Lade-Direktive ihn
    // erlaubt. Das findet weiterhin den Fall, auf den es ankommt: einen Host,
    // den die Richtlinie überhaupt nicht kennt.
    for (const s of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      if (/application\/ld\+json/.test(s[0])) continue;   // JSON-LD lädt nichts
      for (const u of s[1].matchAll(/https?:\/\/[a-z0-9.-]+[^\s'"`,)]*/gi)) {
        if (/schema\.org/.test(u[0])) continue;
        note('(inline-js)', u[0], p);
      }
    }
  }
}
walk(DIST);

// Client-JS baut URLs auch zur Laufzeit zusammen — die statische Suche oben
// sieht das nicht. Diese Muster sind die bekannten Fälle.
for (const f of readdirSync('assets').filter((f) => f.endsWith('.js'))) {
  const js = readFileSync(join('assets', f), 'utf8');
  for (const hit of js.matchAll(/(?:src|href)="(https?:\/\/[^"'+]+)/g))
    note(/iframe/i.test(hit[0]) || /embed/.test(hit[1]) ? 'frame-src' : 'connect-src', hit[1], `assets/${f}`);
}

// ------------------------------------------------------- Laufzeit-Fähigkeiten --
// Blob-Worker und WebAssembly tauchen in keinem Attribut auf, brauchen aber
// eigene Einträge. Quelle ist der Code, der sie benutzt.
const capChecks = [
  { files: ['public/vendor/three/addons/loaders/DRACOLoader.js'], pattern: /new Worker\(/,
    need: ['worker-src', 'blob:'], why: 'DRACOLoader startet einen Worker aus einem Blob' },
  { files: ['public/vendor/three/addons/loaders/DRACOLoader.js'], pattern: /new Worker\(/,
    need: ['script-src', "'wasm-unsafe-eval'"], why: 'Draco dekomprimiert die Meshes per WebAssembly' },
  { files: ['public/vendor/three/addons/loaders/GLTFLoader.js'], pattern: /createObjectURL/,
    need: ['img-src', 'blob:'], why: 'GLTFLoader legt Texturen als blob:-URL an' },
  { files: ['assets/hero-video.js'], pattern: /createObjectURL/,
    need: ['media-src', 'blob:'], why: 'hero-video.js spielt das Video aus einem Blob' },
];

// ------------------------------------------------------------------ Bericht --
const missing = [];
for (const [k, v] of found) {
  const [directive, host] = k.split('|');
  if (!covers(directive, host)) missing.push(`${directive}: ${host} fehlt (${v.n}×, z. B. ${v.sample})`);
}
for (const c of capChecks) {
  const used = c.files.some((f) => existsSync(f) && c.pattern.test(readFileSync(f, 'utf8')));
  if (used && !srcFor(c.need[0]).includes(c.need[1]))
    missing.push(`${c.need[0]}: ${c.need[1]} fehlt — ${c.why}`);
}

console.log(`CSP geprüft gegen ${DIST}/ — ${found.size} externe Quelle(n) gefunden:`);
for (const k of [...found.keys()].sort()) {
  const [directive, host] = k.split('|');
  console.log(`  ${covers(directive, host) ? '✓' : '✗'} ${directive.padEnd(12)} ${host}  (${found.get(k).n}×)`);
}

if (missing.length) {
  console.log(`\nNICHT GEDECKT (${missing.length}):`);
  for (const p of missing) console.log('   ' + p);
  console.log(`\nEintragen in ${CONF} — die Seite würde diese Ressourcen sonst im Browser verlieren.`);
  process.exitCode = 1;
} else {
  console.log('\nAlles, was die Seite lädt, deckt die Richtlinie ab ✓');
}
