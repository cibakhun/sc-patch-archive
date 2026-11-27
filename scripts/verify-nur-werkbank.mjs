/* ============================================================
   verify-nur-werkbank.mjs  (Krisz 26.11.2026)

   „braucht ja kein mensch sehen, soll auch nicht verlinkt werden. werkbank
   ist das einzige für menschen“ und „keine verlinkung“ (Krisz, 26.11.2026,
   zum Blueprint-Verzeichnis neben der Werkbank). Fuer Menschen gibt es die
   Werkbaenke; Verzeichnisse sind nur fuer Google da. Sie bleiben gebaut,
   indexierbar und in der Sitemap, aber keine Seite fuer Menschen verlinkt
   sie, und die Suche fuehrt nicht hinein.

   Google-Seiten (GOOGLE unten, jede mit Anlass):
     - das Blueprint-Verzeichnis /crafting.html und seine Kategorieseiten
       /crafting/category/<kat>[-<n>].html, beide Sprachen.
   Untereinander duerfen sie sich verlinken (Kategorie -> Verzeichnis,
   Blaettern zwischen den Seiten einer Kategorie): das ist der Weg, auf dem
   Google sie von der Sitemap aus durchgeht.

   [1] Bestand: jede Google-Seite ist gebaut (Klinke je Sprache), und im
       Live-Bau steht jede in der Sitemap (dist/sitemap-*.xml). Im
       Vorschau-Bau sind die Sitemaps absichtlich leer (src/lib/seo.ts,
       IS_STAGING); dort entfaellt der Sitemap-Teil, und die Kopfzeile sagt es.
   [2] Keine Seite fuer Menschen verlinkt eine Google-Seite: jedes <a href>
       jeder gebauten Seite ausser den Google-Seiten selbst, ohne Kommentare,
       aufgeloest auf den Pfad (Abfrage und Sprungmarke weg, die eigene
       Domain wie ein Pfad). Jede Fundstelle ist ein FEHLER mit Seite und Ziel.
   [3] Die Suche fuehrt nicht hinein: kein Eintrag beider Suchregister
       (search-index.json, search-index-more.json je Sprache) zeigt mit `u`
       oder `c` auf eine Google-Seite.

   Selbstauskunft: druckt Google-Seiten je Sprache, gepruefte Seiten, Links
   und Sucheintraege und reisst unter den Klinken.

       node scripts/verify-nur-werkbank.mjs     (npm run verify:nur-werkbank)
   ============================================================ */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/* ---------- Google-Seiten (benannt, mit Anlass) ---------- */
const VERZEICHNIS =
  'Blueprint-Verzeichnis: nur fuer Google (Krisz 26.11.2026 „braucht ja kein mensch sehen, soll auch nicht verlinkt werden“); Menschen nehmen die Werkbank /topics/crafting.html, die Kategorie oeffnet sie mit ?kat=.';
const GOOGLE = [
  { name: 'Blueprint-Verzeichnis', muster: /^\/(?:de\/)?crafting\.html$/, klinke: 1, anlass: VERZEICHNIS },
  { name: 'Blueprint-Kategorien', muster: /^\/(?:de\/)?crafting\/category\/[^/]+\.html$/, klinke: 60, anlass: VERZEICHNIS },
];

/* ---------- Klinken (gemessen 26.11.2026, Live-Bau) ---------- */
const KLINKE = {
  seiten: 17000, // gepruefte Seiten fuer Menschen (live 18.448)
  links: 1200000, // aufgeloeste <a href> darin (live 1.369.351)
  such: 15000, // Eintraege beider Suchregister, beide Sprachen (live 15.554)
};

if (!existsSync(DIST)) {
  console.error('verify:nur-werkbank: dist/ fehlt. Erst `npm run build`, dann pruefen.');
  process.exit(1);
}
let stempel = null;
try {
  stempel = JSON.parse(readFileSync(join(DIST, 'build.json'), 'utf8'));
} catch {}
if (typeof stempel?.staging !== 'boolean') {
  console.error('verify:nur-werkbank: dist/build.json fehlt oder nennt `staging` nicht als true/false — unbekannter Bau, das Tor prueft nicht ins Blaue.');
  process.exit(1);
}
const vorschau = stempel.staging;

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}
const urlVon = (f) => '/' + f.slice(DIST.length + 1).replace(/\\/g, '/');
const dateien = walk(DIST).sort();
const googleArt = (p) => GOOGLE.find((g) => g.muster.test(p)) ?? null;

/** Pfad eines Link-Ziels: eigene Domain wie ein Pfad, Abfrage und Sprungmarke weg. */
function pfad(h) {
  let x = h.trim().replace(/&amp;/g, '&');
  x = x.replace(/^https?:\/\/(?:www\.|staging\.)?verse-base\.com/i, '');
  if (!x.startsWith('/')) return null;
  x = x.split(/[?#]/)[0];
  try { x = decodeURI(x); } catch {}
  return x;
}

const probleme = [];
const meld = (s) => probleme.push(s);

console.log('=== verify:nur-werkbank: Verzeichnisse nur fuer Google, Werkbaenke fuer Menschen ===');
console.log(`Artefakt: dist/ — ${vorschau ? 'Vorschau-Bau (STAGING=1)' : 'Live-Bau'}`);
console.log('');

/* ---------- [1] Bestand und Sitemap ---------- */
console.log('[1] Google-Seiten gebaut' + (vorschau ? ' (Sitemap: entfaellt im Vorschau-Bau, dort absichtlich leer)' : ' und in der Sitemap'));
const googleSeiten = dateien.map(urlVon).filter((p) => googleArt(p));
let sitemapPfade = null;
if (!vorschau) {
  sitemapPfade = new Set();
  for (const f of readdirSync(DIST).filter((n) => /^sitemap.*\.xml$/.test(n))) {
    for (const m of readFileSync(join(DIST, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const p = pfad(m[1]);
      if (p) sitemapPfade.add(p);
    }
  }
}
for (const g of GOOGLE) {
  for (const sprache of ['en', 'de']) {
    const liste = googleSeiten.filter((p) => g.muster.test(p) && (sprache === 'de') === p.startsWith('/de/'));
    const fehlend = sitemapPfade ? liste.filter((p) => !sitemapPfade.has(p)) : [];
    console.log(`    ${g.name} (${sprache}): ${liste.length} Seiten (Klinke ${g.klinke})` + (sitemapPfade ? `   nicht in der Sitemap — Soll: 0   Ist: ${fehlend.length}` : ''));
    if (liste.length < g.klinke) meld(`[1] ${g.name} (${sprache}): nur ${liste.length} Seiten gebaut, Klinke ${g.klinke}`);
    for (const p of fehlend.slice(0, 10)) meld(`[1] ${p} fehlt in der Sitemap — Google findet die Seite sonst nicht mehr, weil keine Seite fuer Menschen sie verlinkt`);
    if (fehlend.length > 10) meld(`[1] … und ${fehlend.length - 10} weitere Seiten von ${g.name} (${sprache}) ohne Sitemap-Eintrag`);
  }
}

/* ---------- [2] Links von Seiten fuer Menschen ---------- */
console.log('');
console.log('[2] Keine Seite fuer Menschen verlinkt eine Google-Seite');
let geprueft = 0;
let links = 0;
const funde = [];
for (const f of dateien) {
  const von = urlVon(f);
  if (googleArt(von)) continue;
  geprueft++;
  // Kommentare bis zum Fixpunkt entfernen: ein einzelner Durchgang kann aus
  // Resten wie „<!<!-- -->-- … -->“ einen neuen Kommentar zusammensetzen.
  let html = readFileSync(f, 'utf8');
  for (let vorher = ''; vorher !== html; ) { vorher = html; html = html.replace(/<!--[\s\S]*?-->/g, ''); }
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const p = pfad(m[1] ?? m[2] ?? '');
    if (p == null) continue;
    links++;
    const g = googleArt(p);
    if (g) funde.push(`${von} -> ${p} (${g.name})`);
  }
}
console.log(`    gepruefte Seiten: ${geprueft} (Klinke ${KLINKE.seiten})   Links: ${links} (Klinke ${KLINKE.links})`);
console.log(`    Links auf Google-Seiten — Soll: 0   Ist: ${funde.length}`);
for (const s of funde.slice(0, 20)) meld(`[2] ${s}`);
if (funde.length > 20) meld(`[2] … und ${funde.length - 20} weitere Links auf Google-Seiten`);
if (geprueft < KLINKE.seiten) meld(`[2] nur ${geprueft} Seiten geprueft, Klinke ${KLINKE.seiten}`);
if (links < KLINKE.links) meld(`[2] nur ${links} Links gelesen, Klinke ${KLINKE.links} — liest der Abgleich das Markup noch?`);

/* ---------- [3] Suchregister ---------- */
console.log('');
console.log('[3] Die Suche fuehrt nicht in die Google-Seiten');
let eintraege = 0;
const suchFunde = [];
for (const rel of ['search-index.json', 'search-index-more.json', 'de/search-index.json', 'de/search-index-more.json']) {
  const f = join(DIST, rel);
  if (!existsSync(f)) {
    meld(`[3] dist/${rel} fehlt — das Tor kann die Suche nicht pruefen`);
    continue;
  }
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const liste = Array.isArray(j) ? j : Array.isArray(j?.e) ? j.e : Array.isArray(j?.entries) ? j.entries : null;
  if (!liste) {
    meld(`[3] dist/${rel}: keine Eintragsliste gefunden (Array, .e oder .entries) — Format geaendert?`);
    continue;
  }
  for (const e of liste) {
    eintraege++;
    for (const k of ['u', 'c']) {
      const p = typeof e?.[k] === 'string' ? pfad(e[k]) : null;
      const g = p && googleArt(p);
      if (g) suchFunde.push(`${rel}: „${e.t ?? '?'}“ ${k} -> ${p} (${g.name})`);
    }
  }
}
console.log(`    Eintraege: ${eintraege} (Klinke ${KLINKE.such})   auf Google-Seiten — Soll: 0   Ist: ${suchFunde.length}`);
for (const s of suchFunde.slice(0, 20)) meld(`[3] ${s}`);
if (suchFunde.length > 20) meld(`[3] … und ${suchFunde.length - 20} weitere Sucheintraege auf Google-Seiten`);
if (eintraege < KLINKE.such) meld(`[3] nur ${eintraege} Sucheintraege gelesen, Klinke ${KLINKE.such}`);

console.log('');
if (probleme.length) {
  for (const p of probleme) console.error('FEHLER ' + p);
  console.error(`verify:nur-werkbank: ${probleme.length} FEHLER`);
  process.exit(1);
}
console.log('verify:nur-werkbank: gruen — Verzeichnisse nur fuer Google, kein Weg fuer Menschen hinein.');
