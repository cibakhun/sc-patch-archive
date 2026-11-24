/* ============================================================
   verify-sprachweiche.mjs — fuehrt DE/EN auf jeder Seite aufs Gegenstueck?

   ANLASS (24.11.2026, UX-Audit Task-Flows T9 / Feature-Audit H2): Auf
   /patches/sc-4-10-3, der Chronik 4.10.3, im Hangar und im Advanced
   Loadout fuehrte der Umschalter auf die Startseite der anderen Sprache,
   obwohl das Gegenstueck im selben Bau stand. Ursache: Diese Seiten werden
   beim Bauen eingehaengt (astro.config.mjs) und fehlten in der Routenliste,
   aus der der Umschalter liest (src/lib/routeTwins.ts). Kein Tor sah es:
   _verify prueft nur, ob ein Ziel existiert, und die Startseite existiert;
   tests/e2e/layout.test.js nimmt eine Stichprobe von elf Seiten.

   Dieses Tor liest JEDE Seite in dist/ und prueft am Artefakt:

     [1] Jede Umschalter-Option (a.langsw__opt im Seitenkopf, a.dp-lang auf
         den Datenblaettern) zeigt auf das Gegenstueck in der anderen
         Sprache, wenn es im Bau steht — nicht auf die Startseite, nicht
         auf eine andere Seite.
     [2] Steht kein Gegenstueck im Bau, zeigt sie auf eine Seite der
         anderen Sprache, die es gibt (die Startseite), nie ins Leere.
     [3] Die hreflang-Paare im Kopf (<link rel="alternate">) nennen genau
         diese Seite und ihr Gegenstueck, und beide stehen im Bau.
     [4] Im Vorschau-Bau stehen die eingehaengten Seiten (Hangar, Patch-
         Seiten vor der Abnahme) unter den geprueften — die Klasse, an der
         der Fehler lag, faellt nicht still aus der Pruefung.

   Gegenstueck = dieselbe Regel wie scripts/lib/page-pairs.mjs: EN /x.html
   <-> DE /de/x.html, Startseite /index.html <-> /de.html. Bewusst NICHT
   aus src/i18n/ui.ts gelesen: das Tor prueft das Ergebnis gegen die
   Adressregel, nicht den Code gegen sich selbst.

   Selbstauskunft: Seiten gelesen, Seiten mit Umschalter (beide Arten),
   Optionen geprueft, davon aufs Gegenstueck / ohne Gegenstueck, hreflang-
   Paare; Klinken fuer Seiten mit Umschalter und, im Vorschau-Bau, fuer
   eingehaengte Seiten. Kein git, kein Netz, kein Kindprozess — nur dist/.

     node scripts/verify-sprachweiche.mjs [--dist <Ordner>]
         [--klinke-seiten <n>] [--klinke-eingehaengt <n>]   (fuer den Test)
   ============================================================ */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HANGAR_ROUTES } from './lib/hangar-switch.mjs';
import { VORSCHAU_PATCH_ROUTES } from './lib/vorschau-patches.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIST = arg('--dist') ? resolve(arg('--dist')) : resolve(ROOT, 'dist');

// Klinken (Stand 24.11.2026: live 18.650, Vorschau 18.658 Seiten mit Umschalter):
// Seiten mit Umschalter im Live-Bau; der Vorschau-Bau hat mehr.
const MIN_MIT_UMSCHALTER = Number(arg('--klinke-seiten') ?? 18500);
// Eingehaengte Seiten mit Umschalter im Vorschau-Bau (Hangar, Loadout,
// Patch 4.10.3 und Chronik, je zwei Sprachen; die Buchten haben keinen).
const MIN_EINGEHAENGT = Number(arg('--klinke-eingehaengt') ?? 8);

const stempel = resolve(DIST, 'build.json');
if (!existsSync(stempel)) {
  console.error('verify-sprachweiche: dist/build.json fehlt — erst bauen (npm run build).');
  process.exit(1);
}
const vorschau = JSON.parse(readFileSync(stempel, 'utf8')).staging !== false;
console.log(`verify-sprachweiche: ${vorschau ? 'Vorschau-Bau' : 'Live-Bau'} (${relative(ROOT, DIST) || DIST})`);

function alle(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) alle(p, out);
    else if (e.name.endsWith('.html')) out.push('/' + relative(DIST, p).split('\\').join('/'));
  }
  return out;
}
const seiten = alle(DIST);
const imBau = new Set(seiten);

const istDe = (p) => p === '/de.html' || p.startsWith('/de/');
/** Gegenstueck nach der Adressregel (page-pairs.mjs), als Pfad ab Wurzel. */
function gegenstueck(p) {
  if (p === '/index.html') return '/de.html';
  if (p === '/de.html') return '/index.html';
  return istDe(p) ? p.slice(3) : '/de' + p;
}
/** Eigener Ursprung (site in astro.config.mjs). Eine Option oder ein
 *  hreflang auf einen anderen Ursprung ist nie das Gegenstueck, auch wenn
 *  der Pfad passt (Review PR #426). */
const HAUS = 'https://verse-base.com';
/** href -> Pfad im Bau ("/" -> /index.html, Anker und Abfrage weg), relativ
 *  zur Seite aufgeloest; null bei fremdem Ursprung oder kaputter Adresse. */
function zuPfad(href, seite) {
  let u;
  try { u = new URL(href.trim(), HAUS + seite); } catch { return null; }
  if (u.origin !== HAUS) return null;
  let p;
  try { p = decodeURIComponent(u.pathname); } catch { p = u.pathname; }
  if (p === '' || p === '/') p = '/index.html';
  if (p === '/de' || p === '/de/') p = '/de.html';
  return p;
}
const START = { de: '/de.html', en: '/index.html' };

// Seiten, die beim Bauen eingehaengt werden (Muster -> Regex), fuer [4].
const EINGEHAENGT = [...HANGAR_ROUTES, ...VORSCHAU_PATCH_ROUTES]
  .filter((r) => r.entrypoint.endsWith('.astro'))
  .map((r) => new RegExp('^' + r.pattern.split('/').map((s) => (s.startsWith('[') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/') + '\\.html$'));

const fehler = [];
const fehlerZahl = { 1: 0, 2: 0, 3: 0 };
const melde = (nr, text) => { if (++fehlerZahl[nr] <= 15) fehler.push(`[${nr}] ${text}`); };

let mitUmschalter = 0, mitLangsw = 0, mitDpLang = 0, optionen = 0, aufsGegenstueck = 0, hreflangPaare = 0;
let eingehaengtGeprueft = 0;
const ohneGegenstueck = [];

// Attribute in allen drei Schreibweisen des HTML (doppelt, einfach, ohne
// Anfuehrungszeichen), Kommentare zaehlen nicht (Review PR #426). Bewusst
// kein DOM-Parser: 19.000 Seiten je Lauf, und Astro schreibt die Tags
// selbst; die Tests decken die Schreibweisen ab.
const A_TAG = /<a\b[^>]*>/gi;
const LINK_TAG = /<link\b[^>]*>/gi;
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]).replace(/&amp;/g, '&') : null;
};
const ohneKommentare = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

for (const seite of seiten) {
  const html = ohneKommentare(readFileSync(resolve(DIST, '.' + seite), 'utf8'));
  const zwilling = gegenstueck(seite);
  const zwillingDa = imBau.has(zwilling);
  const zielSprache = istDe(seite) ? 'en' : 'de';

  // [1] + [2] Umschalter-Optionen
  let hier = 0;
  let langsw = false, dpLang = false;
  for (const m of html.matchAll(A_TAG)) {
    const tag = m[0];
    const klasse = attr(tag, 'class') ?? '';
    const art = /(?:^|\s)langsw__opt(?:\s|$)/.test(klasse) ? 'langsw' : /(?:^|\s)dp-lang(?:\s|$)/.test(klasse) ? 'dp-lang' : null;
    if (!art) continue;
    if (art === 'langsw') langsw = true; else dpLang = true;
    hier++;
    optionen++;
    const href = attr(tag, 'href');
    const ziel = href == null ? null : zuPfad(href, seite);
    if (zwillingDa) {
      if (ziel === zwilling) aufsGegenstueck++;
      else melde(1, `${seite} (${art}): zeigt auf ${href ?? '(kein href)'} statt aufs Gegenstueck ${zwilling}${ziel === START[zielSprache] ? ' — Startseite' : href != null && !ziel ? ' — fremder Ursprung' : ''}`);
    } else {
      if (ziel && imBau.has(ziel) && (istDe(ziel) ? 'de' : 'en') === zielSprache) continue;
      melde(2, `${seite} (${art}): kein Gegenstueck im Bau, Option zeigt auf ${href ?? '(kein href)'}${!ziel ? ' — fremder Ursprung' : !imBau.has(ziel) ? ' — steht nicht im Bau' : ' — nicht die andere Sprache'}`);
    }
  }
  if (hier) {
    mitUmschalter++;
    if (langsw) mitLangsw++;
    if (dpLang) mitDpLang++;
    if (!zwillingDa) ohneGegenstueck.push(seite);
    if (vorschau && EINGEHAENGT.some((re) => re.test(seite))) eingehaengtGeprueft++;
  }

  // [3] hreflang-Paare im Kopf
  const alt = {};
  for (const m of html.matchAll(LINK_TAG)) {
    if (!/^alternate$/i.test(attr(m[0], 'rel') ?? '')) continue;
    const hl = attr(m[0], 'hreflang');
    const href = attr(m[0], 'href');
    if (hl === 'de' || hl === 'en') alt[hl] = href;
  }
  if (alt.de || alt.en) {
    hreflangPaare++;
    const eigen = istDe(seite) ? 'de' : 'en';
    const erwartet = { [eigen]: seite, [zielSprache]: zwilling };
    for (const l of ['de', 'en']) {
      const p = alt[l] == null ? null : zuPfad(alt[l], seite);
      if (p !== erwartet[l]) melde(3, `${seite}: hreflang="${l}" nennt ${alt[l] ?? '(fehlt)'}, erwartet ${erwartet[l]}`);
      else if (!imBau.has(p)) melde(3, `${seite}: hreflang="${l}" nennt ${p}, das steht nicht im Bau`);
    }
  }
}

for (const nr of [1, 2, 3]) if (fehlerZahl[nr] > 15) fehler.push(`[${nr}] … und ${fehlerZahl[nr] - 15} weitere`);

console.log(`  [1] ${optionen} Optionen auf ${mitUmschalter} Seiten (${mitLangsw} mit Seitenkopf-Umschalter, ${mitDpLang} Datenblaetter): ${aufsGegenstueck} aufs Gegenstueck, ${fehlerZahl[1]} daneben`);
console.log(`  [2] ${ohneGegenstueck.length} Seiten ohne Gegenstueck im Bau, ${fehlerZahl[2]} davon zeigen ins Leere oder in dieselbe Sprache${ohneGegenstueck.length ? ': ' + ohneGegenstueck.slice(0, 12).join(', ') + (ohneGegenstueck.length > 12 ? ` … (+${ohneGegenstueck.length - 12})` : '') : ''}`);
console.log(`  [3] ${hreflangPaare} Seiten mit hreflang-Paar geprueft, ${fehlerZahl[3]} daneben`);
if (vorschau) {
  console.log(`  [4] ${eingehaengtGeprueft} eingehaengte Seiten mit Umschalter geprueft (Klinke ${MIN_EINGEHAENGT})`);
  if (eingehaengtGeprueft < MIN_EINGEHAENGT) fehler.push(`[4] nur ${eingehaengtGeprueft} eingehaengte Seiten mit Umschalter, Klinke ${MIN_EINGEHAENGT} — Hangar oder Vorschau-Patches nicht im Bau oder ohne Umschalter?`);
} else {
  console.log('  [4] Live-Bau: keine eingehaengten Seiten (verify:hangar-schalter, verify:vorschau-patches)');
}

if (mitUmschalter < MIN_MIT_UMSCHALTER) fehler.push(`nur ${mitUmschalter} Seiten mit Umschalter, Klinke ${MIN_MIT_UMSCHALTER} — unvollstaendiger Bau oder Umschalter verloren?`);
console.log(`  Selbstauskunft: ${seiten.length} Seiten gelesen, ${mitUmschalter} mit Umschalter (Klinke ${MIN_MIT_UMSCHALTER})`);

if (fehler.length) {
  console.error(`\nFEHLER: ${fehlerZahl[1] + fehlerZahl[2] + fehlerZahl[3] + fehler.filter((f) => /^\[4\]|^nur /.test(f)).length}`);
  for (const m of fehler) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('verify-sprachweiche: ALLE ZUSICHERUNGEN ERFUELLT ✓');
