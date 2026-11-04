/* ============================================================
   verify-supabase-ziel.mjs — spricht der Bau genau EIN Supabase-Projekt an,
   und zwar das richtige?

   Staging und live sollen getrennte Supabase-Projekte bekommen (Plan
   "Supabase-Trennung Staging/Production", 04.11.2026). Welches ein Bau
   anspricht, entscheidet STAGING=1 ueber die Tabelle in
   scripts/lib/supabase-ziel.mjs. Die Werte landen an vielen Stellen: in
   jeder Seite (Kopfskript mit dem Sitzungsschluessel), in den Client-
   Bundles, im Kopf von account-lite.js, in gate.html, in der
   Datenschutzerklaerung und in der CSP (dist/_csp/). Bleibt EINE davon auf
   dem anderen Projekt stehen, meldet sich auf staging jemand gegen live an
   oder umgekehrt, und keine Seite sieht dabei falsch aus.

   Geprueft am gebauten Artefakt (dist/):
     [1] dist/build.json nennt das Ziel; es ist "vorschau" genau dann, wenn
         der Bau ein Vorschau-Bau ist, und sein Ref ist der aus der Tabelle
     [2] jede Textdatei in dist/ nennt nur dieses Projekt: jeder Host
         *.supabase.co, jeder Sitzungsschluessel sb-<ref>-auth-token und
         jeder Publishable Key gehoert zum Ziel; kein geheimer Schluessel
         (sb_secret_… oder ein altes service_role-JWT), kein altes anon-JWT
         eines anderen Projekts
     [3] die Pflichtstellen tragen das Ziel: account-lite.js (alle drei
         Kopfzeilen), die beiden CSP-Dateien, gate.html, ein Client-Bundle
         unter _astro/, die Datenschutzerklaerung in beiden Sprachen

   Solange beide Ziele auf dasselbe Projekt zeigen (bis Phase 4), kann
   [2] eine vertauschte Wahl nicht sehen — [1] sieht sie trotzdem, weil der
   Stempel den NAMEN des Ziels traegt.

   Selbstauskunft: gelesene Textdateien und Dateien mit dem Ziel, je mit
   Klinke. Kein git, kein Netz, kein Kindprozess — liest nur dist/ und die
   Ziel-Tabelle.

     node scripts/verify-supabase-ziel.mjs
   ============================================================ */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_ZIELE, supabaseZiel, CSP_SUPABASE, LITE_ZEILEN } from './lib/supabase-ziel.mjs';
import { CSP_ORDNER, leseMapWert } from './lib/csp-inline.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// --dist <Ordner> und --klinke-dateien <n>: nur fuer
// tests/e2e/supabase-ziel.test.js (kleine Probe-Artefakte).
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIST = arg('--dist') ? resolve(arg('--dist')) : resolve(ROOT, 'dist');

// Klinken (nur nach oben; nach unten nur per Commit mit Ursache).
// 04.11.2026: 17 756 HTML-Seiten im Live-Bau, jede traegt im Kopfskript den
// Sitzungsschluessel; dazu Skripte, Daten und die CSP-Dateien.
const MIN_TEXTDATEIEN = Number(arg('--klinke-dateien') ?? 15000);
const MIN_MIT_ZIEL = Number(arg('--klinke-dateien') ?? 15000);

// Gelesen wird, was der Browser als Text bekommt. Bilder, Modelle, Schriften
// und Videos koennen keine Projektadresse tragen, die jemand anspricht.
const TEXT = /\.(?:html?|m?js|css|json|xml|txt|conf|webmanifest|svg|map)$/i;

const fehler = [];
const fail = (m) => fehler.push(m);

/* ---------- [1] Stempel ---------- */
const stempelPfad = join(DIST, 'build.json');
if (!existsSync(stempelPfad)) {
  console.error('verify-supabase-ziel: dist/build.json fehlt — erst bauen (npm run build).');
  process.exit(1);
}
const stempel = JSON.parse(readFileSync(stempelPfad, 'utf8'));
const vorschau = stempel.staging === true;
const sollName = vorschau ? 'vorschau' : 'live';
const istName = stempel.supabase?.ziel;
const istRef = stempel.supabase?.ref;
console.log(`verify-supabase-ziel: ${vorschau ? 'Vorschau-Bau' : 'Live-Bau'} — Soll-Ziel "${sollName}"`);
if (istName !== sollName)
  fail(`[1] dist/build.json nennt Supabase-Ziel ${JSON.stringify(istName ?? null)}, ein ${vorschau ? 'Vorschau' : 'Live'}-Bau muss "${sollName}" ansprechen — Schalter in scripts/lib/supabase-ziel.mjs (zielName) pruefen`);
const ziel = supabaseZiel(sollName);
if (istRef !== ziel.ref)
  fail(`[1] dist/build.json nennt Ref ${JSON.stringify(istRef ?? null)}, die Tabelle fuer "${sollName}" ${ziel.ref} — dist/ stammt aus einem anderen Stand; npm run build neu`);
console.log(`  [1] Stempel: Ziel ${istName ?? '—'} (${istRef ?? '—'}), Tabelle: ${ziel.ref}`);

/* ---------- [2] jede Textdatei nennt nur dieses Projekt ---------- */
const MUSTER = [
  { was: 'Host', re: /\b([a-z0-9-]+)\.supabase\.co\b/g, soll: (m) => m[1] === ziel.ref },
  { was: 'Sitzungsschluessel', re: /\bsb-([a-z0-9]+)-auth-token\b/g, soll: (m) => m[1] === ziel.ref },
  { was: 'Publishable Key', re: /\bsb_publishable_[A-Za-z0-9_-]+/g, soll: (m) => m[0] === ziel.publishableKey },
  { was: 'geheimer Schluessel', re: /\bsb_secret_[A-Za-z0-9_-]+/g, soll: () => false },
  // Die alten Supabase-Schluessel sind JWTs (anon / service_role). Der
  // Nutzlastteil sagt, wofuer: service_role ist geheim, ein anon-Schluessel
  // eines anderen Projekts ist ein fremdes Projekt. Andere JWTs gehen das
  // Tor nichts an (null).
  { was: 'Supabase-JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]*/g, soll: supabaseJwt,
    zeige: (m) => `Supabase-JWT (role ${jwtNutzlast(m[1])?.role ?? '?'}, ref ${jwtNutzlast(m[1])?.ref ?? '?'})` },
];
/** Nutzlast eines JWT-Mittelteils, oder null. */
function jwtNutzlast(teil) {
  try { return JSON.parse(Buffer.from(teil, 'base64url').toString('utf8')); } catch { return null; }
}
/** true: anon-Schluessel des Ziels · false: geheim oder fremdes Projekt · null: kein Supabase-JWT. */
function supabaseJwt(m) {
  const n = jwtNutzlast(m[1]);
  if (!n || typeof n !== 'object' || (n.iss !== 'supabase' && !('role' in n && 'ref' in n))) return null;
  if (n.role === 'service_role' || n.role === 'supabase_admin') return false;
  return n.ref === ziel.ref ? true : false;
}
// Die anderen Ziele der Tabelle, nur fuer eine lesbare Meldung.
const andereZiele = new Map(
  Object.keys(SUPABASE_ZIELE).filter((n) => n !== sollName).map((n) => [supabaseZiel(n).ref, n]),
);

function alle(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) alle(p, out);
    else out.push(relative(DIST, p).split('\\').join('/'));
  }
  return out;
}
const dateien = alle(DIST).filter((f) => TEXT.test(f)).sort();
let mitZiel = 0;
let fremdDateien = 0;
const fremdBeispiele = [];
// Fuer [3] behalten: nur die Pflichtstellen und die Client-Bundles, nicht
// alle 18 000 Seiten im Speicher.
const PFLICHT_DATEIEN = new Set([
  'assets/account-lite.js', 'gate.html', 'datenschutz.html', 'de/datenschutz.html',
  ...CSP_SUPABASE.map(({ datei }) => `${CSP_ORDNER}/${datei}`),
]);
const behalten = (f) => PFLICHT_DATEIEN.has(f) || (f.startsWith('_astro/') && f.endsWith('.js'));
const inhalt = new Map();
for (const f of dateien) {
  const t = readFileSync(join(DIST, f), 'utf8');
  let hatZiel = false;
  const fremd = [];
  // Schneller Vorfilter: ohne diese Teilstrings kann keines der Muster treffen.
  if (t.includes('supabase.co') || t.includes('-auth-token') || t.includes('sb_publishable_') || t.includes('sb_secret_') || t.includes('eyJ')) {
    for (const { was, re, soll, zeige } of MUSTER) {
      for (const m of t.matchAll(re)) {
        const urteil = soll(m);
        if (urteil === true) hatZiel = true;
        else if (urteil === false)
          fremd.push(zeige ? zeige(m) : `${was} ${m[0].length > 60 ? m[0].slice(0, 57) + '…' : m[0]}${andereZiele.has(m[1]) ? ` (Ziel "${andereZiele.get(m[1])}")` : ''}`);
      }
    }
  }
  if (hatZiel) mitZiel++;
  if (fremd.length) {
    fremdDateien++;
    if (fremdBeispiele.length < 10) fremdBeispiele.push(`dist/${f}: ${[...new Set(fremd)].slice(0, 3).join(', ')}`);
  }
  if (behalten(f)) inhalt.set(f, t);
}
for (const b of fremdBeispiele) fail(`[2] ${b} — gehoert nicht zum Ziel "${sollName}" (${ziel.ref})`);
if (fremdDateien > fremdBeispiele.length) fail(`[2] … und ${fremdDateien - fremdBeispiele.length} weitere Dateien mit fremdem Projekt`);
console.log(`  [2] ${dateien.length} Textdateien gelesen (Klinke ${MIN_TEXTDATEIEN}): ${mitZiel} nennen das Ziel (Klinke ${MIN_MIT_ZIEL}), ${fremdDateien} ein anderes Projekt — Soll: 0`);

/* ---------- [3] Pflichtstellen ---------- */
const pflicht = [];
const pruefe = (stelle, ok) => { pflicht.push(stelle); if (!ok) fail(`[3] ${stelle} traegt das Ziel "${sollName}" nicht`); };
const lite = inhalt.get('assets/account-lite.js') ?? '';
for (const [name, wert] of LITE_ZEILEN)
  pruefe(`dist/assets/account-lite.js: var ${name}`, lite.includes(`var ${name} = '${wert(ziel)}';`));
for (const { datei, wert } of CSP_SUPABASE) {
  const t = inhalt.get(`${CSP_ORDNER}/${datei}`);
  pruefe(`dist/${CSP_ORDNER}/${datei}`, t !== undefined && leseMapWert(t) === wert(ziel));
}
const gate = inhalt.get('gate.html') ?? '';
pruefe('dist/gate.html (Tor-Seite)', gate.includes(ziel.url) && gate.includes(ziel.publishableKey));
// URL, Key und Sitzungsschluessel muessen im Bundle stehen; fehlt einer,
// startet supabase-js auf den Kontoseiten nicht.
const bundles = [...inhalt].filter(([f]) => f.startsWith('_astro/')).map(([, t]) => t);
pruefe('dist/_astro/ (Client-Bundle: URL, Publishable Key, Sitzungsschluessel)',
  [ziel.url, ziel.publishableKey, ziel.storageKey].every((wert) => bundles.some((t) => t.includes(wert))));
const host = new URL(ziel.url).host;
for (const f of ['datenschutz.html', 'de/datenschutz.html'])
  pruefe(`dist/${f}`, (inhalt.get(f) ?? '').includes(`<strong>${host}</strong>`));
console.log(`  [3] ${pflicht.length} Pflichtstellen geprueft`);

if (dateien.length < MIN_TEXTDATEIEN) fail(`gelesen: ${dateien.length} Textdateien, Klinke ${MIN_TEXTDATEIEN} — unvollstaendiger Bau?`);
if (mitZiel < MIN_MIT_ZIEL) fail(`nur ${mitZiel} Dateien nennen das Ziel, Klinke ${MIN_MIT_ZIEL} — traegt das Kopfskript den Sitzungsschluessel nicht mehr? (src/consts.ts, __VB_SUPABASE__)`);

if (fehler.length) {
  console.error(`\nFEHLER: ${fehler.length}`);
  for (const m of fehler) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log(`verify-supabase-ziel: ALLE ZUSICHERUNGEN ERFUELLT ✓ (Ziel "${sollName}", ${ziel.ref})`);
