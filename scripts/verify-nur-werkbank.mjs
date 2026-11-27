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
import { parseHTML } from 'linkedom';

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

/**
 * Pfad eines Link-Ziels, aufgeloest gegen die Seite, auf der er steht
 * (`basis`): relative Ziele wie „../crafting.html“ und Umwege wie
 * „/topics/../crafting.html“ landen auf dem echten Pfad (Review #482).
 * Eigene Domain zaehlt wie ein Pfad, fremde Herkunft und andere Schemata
 * (mailto:, javascript:) fallen heraus; Abfrage und Sprungmarke weg.
 */
const EIGEN = 'https://verse-base.com';
const EIGENE_HOSTS = /^(?:www\.|staging\.)?verse-base\.com$/i;
/* Zeichenreferenzen wie im HTML-Parser (Review #482): „&#47;crafting.html“,
 * „&#x2F;crafting.html“ und „&bsol;crafting.html“ sind im Browser Wege nach
 * /crafting.html. Entschluesselt wird mit dem HTML-Parser von linkedom (wie
 * im Pruefstand), also mit der vollen Tabelle benannter Referenzen und den
 * Regeln fuer Attributwerte: „&ampy“ bleibt stehen, „&#128;“ wird „€“.
 * Verschachteltes wie „&amp;#47;“ wird nur einmal entschluesselt und bleibt
 * „&#47;“ — genau das zeigt auch der Browser. Nur Werte mit „&“ gehen durch
 * den Parser. */
const ENTSCHLUESSLER = parseHTML('<!doctype html><html><body></body></html>').document.createElement('div');
function entschluesseln(wert) {
  if (!wert.includes('&')) return wert;
  ENTSCHLUESSLER.innerHTML = '<a href="' + wert.replace(/"/g, '&quot;') + '"></a>';
  return ENTSCHLUESSLER.firstChild?.getAttribute('href') ?? wert;
}
function pfad(h, basis = '/') {
  const roh = h.trim();
  let u;
  try { u = new URL(roh, EIGEN + basis); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || !EIGENE_HOSTS.test(u.hostname)) return null;
  let x = u.pathname;
  try { x = decodeURI(x); } catch {}
  return x;
}

/* Anker in einem Durchgang wie der HTML-Tokenizer (Review #482). Grundsatz:
 * nur echte Kommentare fallen weg, im Zweifel zaehlt ein Anker.
 * - Kommentare (auch „<!-->“ und unbeendete) und Pseudo-Kommentare
 *   „<!…>“/„<?…>“ fallen weg. Ein Durchgang reicht, weil nichts erneut nach
 *   Kommentaren gelesen wird: in „<<!-- -->!-- <a href=…> -->“ ist der Anker
 *   auch im Browser echt.
 * - Ein Tag endet am ersten „>“ ausserhalb eines Werts; Anfuehrungszeichen
 *   schliessen wie im Tokenizer nur direkt nach „=“ einen Wert ein. Ein
 *   „<!--“ oder „<a“ in einem Attributwert ist darum weder Kommentar noch Anker.
 * - Tagnamen enden nur an Leerraum, „/“ oder „>“: <title-card> ist kein <title>.
 * - Rohtext (<script>, <style>, <textarea>, <title>, <xmp>, <iframe>,
 *   <noembed>, <noframes>) kennt keine Kommentare, wird aber weiter nach
 *   Ankern durchsucht: Vorlagen in Skripten erzeugen echte Links, und in SVG
 *   sind <title> und <style> gar kein Rohtext. */
const TRENNER = String.raw`(?=[\t\n\f\r />])`;
const TAGREST = String.raw`((?:[^>"'=]|=[\t\n\f\r ]*"[^"]*"|=[\t\n\f\r ]*'[^']*'|=|["'])*)`;
const ROHTEXT = 'script|style|textarea|title|xmp|iframe|noembed|noframes';
const TOKEN = new RegExp([
  String.raw`<(${ROHTEXT})${TRENNER}${TAGREST}>([\s\S]*?)(?:<\/\1${TRENNER}[^>]*>|$)`,
  String.raw`<!--(?:-?>|[\s\S]*?--!?>|[\s\S]*$)`,
  String.raw`<[!?][^>]*>?`,
  String.raw`<(\/?[a-z][^\t\n\f\r />]*)${TAGREST}>`,
  String.raw`[^<]+`,
  '<',
].join('|'), 'gi');
const ANKER = new RegExp(String.raw`<a${TRENNER}${TAGREST}>`, 'gi');
function* ankerAttribute(html) {
  for (const m of html.matchAll(TOKEN)) {
    if (m[1]) { for (const [, attr] of m[3].matchAll(ANKER)) yield attr; }
    else if (m[4] && m[4].toLowerCase() === 'a') yield m[5];
  }
}

/** Attribute eines Tags, Werte als Ganzes gelesen (wie in verify-bezugswege.mjs). */
function attribute(attr) {
  const m = new Map();
  for (const [, name, wert] of attr.matchAll(/([^\s"'>\/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g)) {
    const n = name.toLowerCase();
    if (!m.has(n)) m.set(n, wert == null ? '' : wert.replace(/^(["'])([\s\S]*)\1$/, '$2'));
  }
  return m;
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
      const p = pfad(entschluesseln(m[1]));
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
  // Jeder Anker als ganzes Tag, auch mit „>“ in einem Attributwert; das Ziel
  // ist das echte href, nicht ein „href=“ im Wert eines anderen Attributs.
  for (const attr of ankerAttribute(readFileSync(f, 'utf8'))) {
    const href = attribute(attr).get('href');
    if (href == null) continue;
    const p = pfad(entschluesseln(href), von);
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
