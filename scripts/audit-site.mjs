// audit-site.mjs — site-weites Publish-Audit über dist/**/*.html.
// Prüft, was Tests nicht abdecken: Verlinkung, Anker, DE/EN-Parität, SEO-Meta,
// Media-Wiederholung (Regel: dieselbe Datei max. 2× pro Seite), Platzhalter,
// Mojibake, A11y-Basics und Seitengewichte.
//
// Aufruf: node scripts/audit-site.mjs   (npm run audit:site) — nach npm run build.
// Exit 1 bei Befunden der Kategorie FEHLER, sonst 0 (WARNUNGEN blocken nicht).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');
if (!existsSync(DIST)) { console.error('dist/ fehlt — erst npm run build.'); process.exit(2); }

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
const allFiles = walk(DIST);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));
const fileSet = new Set(allFiles.map((f) => '/' + f.slice(DIST.length + 1).replaceAll('\\', '/')));
const rel = (f) => '/' + f.slice(DIST.length + 1).replaceAll('\\', '/');

// id-/name-Anker je Datei (lazy, gecacht)
const idCache = new Map();
function idsOf(path) {
  if (!idCache.has(path)) {
    const html = readFileSync(join(DIST, path.slice(1)), 'utf8');
    const ids = new Set();
    for (const m of html.matchAll(/\s(?:id|name)="([^"]+)"/g)) ids.add(m[1]);
    idCache.set(path, ids);
  }
  return idCache.get(path);
}

const errors = [];   // publish-blockierend
const warns = [];    // sollte gefixt werden
const infos = [];    // Hinweise

// Case-SENSITIV: Entwicklungs-Marker sind konventionell GROSS (TODO, FIXME,
// FleetYards' "<= PLACEHOLDER =>"); kleingeschrieben ist es Fließtext — die
// Missions-Tooltips erklären z. B. „the marked spots are placeholders".
// JS-Leckagen (>undefined<, [object Object]) sind ohnehin exakt geschrieben.
/**
 * Entfernt Teilbäume, deren Wurzel-Tag `hidden` trägt. Solche Knoten stehen
 * NICHT im Accessibility-Baum — für die Überschriften-Gliederung existieren sie
 * also nicht. Seiten mit sich gegenseitig ausschließenden Zuständen (Profil da
 * / Profil nicht gefunden) haben je Zustand ein <h1>, sichtbar ist immer nur
 * eines. Ohne diesen Filter meldet der Audit das als „2× <h1>".
 *
 * Bewusst NUR für die h1-Zählung: bei Bildern wollen wir den Alt-Text auch dann
 * sehen, wenn der Block gerade ausgeblendet ist — er wird ja später sichtbar.
 */
function stripHiddenSubtrees(html) {
  // Leere Elemente haben kein schließendes Tag — sie können nichts umschließen.
  // (Ohne diese Liste hält `<img … hidden>` für ein Container-Tag her, findet
  // nie ein </img> und reißt den ganzen Rest des Dokuments mit.)
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const OPEN = /<([a-z][a-z0-9-]*)\b([^>]*?)(\/?)>/gi;
  for (let guard = 0; guard < 100; guard++) {
    OPEN.lastIndex = 0;
    let m;
    let cut = null;
    while ((m = OPEN.exec(html))) {
      const [, rawName, attrs, selfClose] = m;
      const name = rawName.toLowerCase();
      if (selfClose || VOID.has(name)) continue;
      // `hidden` als eigenständiges Attribut (nicht data-hidden, nicht hidden-xy)
      if (!/(^|\s)hidden(\s|=|$)/i.test(attrs)) continue;
      // passendes </name> suchen; gleichnamige Verschachtelung mitzählen
      const TAGS = new RegExp(`<(/?)${name}\\b([^>]*?)(/?)>`, 'gi');
      TAGS.lastIndex = m.index + m[0].length;
      let depth = 1;
      let t;
      while ((t = TAGS.exec(html))) {
        if (t[3]) continue; // self-closing
        depth += t[1] ? -1 : 1;
        if (depth === 0) break;
      }
      // Kein passendes Ende gefunden -> lieber nichts entfernen als zu viel.
      if (depth !== 0) continue;
      cut = [m.index, TAGS.lastIndex];
      break;
    }
    if (!cut) break;
    html = html.slice(0, cut[0]) + html.slice(cut[1]);
  }
  return html;
}

const PLACEHOLDER_RE = /\bTODO\b|\bFIXME\b|PLACEHOLDER|\bTBD\b|\[object Object\]|>undefined<|>null<|>NaN\b/;
const PLACEHOLDER_CI_RE = /lorem ipsum/i;
const MOJIBAKE_RE = /Ã[¤¶¼Ÿ„–©¨]|â€“|â€ž|â€œ|â€¦|Â°|Ã¢/;

let pagesDe = 0, pagesEn = 0;
const mediaViolations = [];
const linkErrors = [];
const anchorErrors = [];
const seoIssues = [];
const a11yIssues = [];
const placeholderHits = [];
const mojibakeHits = [];
const switcherErrors = [];
const basePrefixPages = new Set();
// Semantik-Check: erkennt VALIDE Assets, die als Stand-in wiederverwendet werden.
// Signal 1: dieselbe Datei site-weit unter VERSCHIEDENEN Alt-Texten.
// Signal 2: Entity-benannte Datei (img-/wk-/vid-), deren Alt-Text keinen
//           Namensbestandteil der Datei enthält (Bild ≠ beschriebenes Ding).
const altByAsset = new Map(); // asset -> Map(altNorm -> Set(pages))
const slugMismatch = [];

for (const f of htmlFiles) {
  const page = rel(f);
  const html = readFileSync(f, 'utf8');
  // Markup ohne Inline-Scripts/JSON-LD/Styles: JS-Template-Strings sind keine
  // Links, Meta-/LD-Bild-URLs keine sichtbaren Medien, ::placeholder kein Text.
  const markup = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  // Sprach-Tausch (i18n Stufe 3): EN ist Standardsprache und liegt PRÄFIXLOS
  // auf der Wurzel, DE unter /de/…. Vorher andersherum (/en/-Präfix) — der
  // alte Check hielt deshalb JEDE Wurzel-Seite für Deutsch.
  const isDe = page === '/de.html' || page.startsWith('/de/');
  const isEn = !isDe;
  if (isEn) pagesEn++; else pagesDe++;

  // --- html lang (Onepager sind eigenständige EN-Artefakte, kein DE/EN-Paar) ---
  const isStandalone = page.startsWith('/onepager/');
  const langM = /<html[^>]*\slang="([^"]*)"/.exec(html);
  if (!langM) a11yIssues.push(`${page}: <html> ohne lang-Attribut`);
  else if (!isStandalone && isEn && langM[1] !== 'en') a11yIssues.push(`${page}: lang="${langM[1]}" auf EN-Seite`);
  else if (!isStandalone && !isEn && langM[1] !== 'de') a11yIssues.push(`${page}: lang="${langM[1]}" auf DE-Seite`);

  // --- SEO ---
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim();
  if (!title) seoIssues.push(`${page}: kein <title>`);
  const desc = /<meta\s+name="description"\s+content="([^"]*)"/.exec(html)?.[1];
  if (!desc) seoIssues.push(`${page}: keine meta description`);
  else if (desc.length < 50) seoIssues.push(`${page}: meta description sehr kurz (${desc.length})`);
  const og = /<meta\s+property="og:image"\s+content="([^"]*)"/.exec(html)?.[1];
  // Datei-Existenz nur für EIGENE Bilder prüfbar: Schiffs-Datenblätter nutzen
  // Wiki-CDN-Bilder (media.starcitizen.tools) als og:image — fremde Hosts
  // überspringen statt ihren Pfad fälschlich in dist/ zu suchen.
  const ogRemote = og && /^https?:\/\//.test(og) && !/^https?:\/\/(www\.)?verse-base\.com\//.test(og);
  if (og && !ogRemote) {
    const ogPath = og.replace(/^https?:\/\/[^/]+/, '');
    if (ogPath.startsWith('/') && !fileSet.has(ogPath)) {
      const baseM = /^\/([^/]+)(\/.*)$/.exec(ogPath);
      if (baseM && fileSet.has(baseM[2])) basePrefixPages.add(`${page} (og:image)`);
      else seoIssues.push(`${page}: og:image fehlt als Datei (${ogPath})`);
    }
  }

  // --- h1 ---
  // Gegen `markup`, nicht `html`: Inline-Scripts bauen <h1> als Template-String
  // zusammen (Piloten-Seite) — das ist EIN gerendertes h1, kein zweites.
  const h1Count = (stripHiddenSubtrees(markup).match(/<h1[\s>]/g) || []).length;
  if (h1Count === 0) a11yIssues.push(`${page}: kein <h1>`);
  else if (h1Count > 1) a11yIssues.push(`${page}: ${h1Count}× <h1>`);

  // --- img alt + Media-Semantik ---
  // Ebenfalls gegen `markup`: die Bild-Fallback-Logik ERWÄHNT „<img>" in
  // Kommentaren, und ein Kommentar hat keinen Alt-Text. Gegen `html` gescannt
  // waren 454 der 456 A11y-Warnungen genau dieser Fehlalarm — die echten
  // Befunde gingen darin unter.
  for (const m of markup.matchAll(/<img\b[^>]*>/g)) {
    const src = /src="([^"]*)"/.exec(m[0])?.[1] || '?';
    const altM = /\salt="([^"]*)"/.exec(m[0]);
    if (!altM) {
      a11yIssues.push(`${page}: <img> ohne alt (${src})`);
      continue;
    }
    if (!src.startsWith('/assets/')) continue;
    const alt = altM[1].trim();
    if (!alt) continue; // dekoratives Bild (alt="") ist legitim
    // DE/EN getrennt gruppieren: Übersetzungen desselben Alt-Texts sind kein Konflikt.
    const langKey = isEn ? 'en' : 'de';
    const altNorm = alt.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const assetKey = `${src}|${langKey}`;
    if (!altByAsset.has(assetKey)) altByAsset.set(assetKey, new Map());
    const byAlt = altByAsset.get(assetKey);
    if (!byAlt.has(altNorm)) byAlt.set(altNorm, new Set());
    byAlt.get(altNorm).add(page);
    // Signal 2: Entity-Dateiname vs. Alt-Text. „Ähnliche Schiffe“-Karten (sd__sim)
    // zeigen bewusst ein ANDERES, korrekt benanntes Schiff — kein Mismatch.
    const before = html.slice(Math.max(0, m.index - 300), m.index);
    if (before.includes('sd__sim')) continue;
    // Geprüfte Ausnahmen: Datei zeigt das Benannte, Name matcht nur nicht wörtlich.
    const SLUG_OK = new Set([
      '/assets/wk-a2b.png',      // A2 Hercules („b“ = Bomber-Kürzel der Datei)
      '/assets/vid-isc48.jpg',   // Inside-Star-Citizen-4.8-Poster
      '/assets/img-kruger.jpg',  // Kruger L-21 Wolf (Datei nach Hersteller benannt, s. shipRenders.ts)
    ]);
    if (SLUG_OK.has(src)) continue;
    const fnM = /\/assets\/(?:wk|img|vid)-([a-z0-9-]+)\.(?:jpg|jpeg|png|webp|avif)/.exec(src);
    if (fnM) {
      // Tokens: Bindestrich-Split UND Zahl/Buchstaben-Grenzen (isc48 -> isc),
      // als Vereinigung — sonst zerfallen kurze Namen wie f8c/c1 zu nichts.
      const hyphen = fnM[1].split('-');
      const digit = fnM[1].split(/-|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/);
      const fileTokens = [...new Set([...hyphen, ...digit])].filter((t) => t.length >= 2);
      const altFlat = altNorm.replace(/\s+/g, '');
      const hit = !fileTokens.length || fileTokens.some((tok) => altFlat.includes(tok));
      if (!hit) slugMismatch.push(`${page}: ${src} mit alt "${alt}"`);
    }
  }

  // --- Platzhalter / Mojibake (nur sichtbarer Text, placeholder=-Attribute raus) ---
  const visibleText = markup.replace(/\splaceholder="[^"]*"/gi, '');
  const ph = PLACEHOLDER_RE.exec(visibleText) ?? PLACEHOLDER_CI_RE.exec(visibleText);
  if (ph) placeholderHits.push(`${page}: "${ph[0]}"`);
  const mj = MOJIBAKE_RE.exec(html);
  if (mj) mojibakeHits.push(`${page}: "${mj[0]}"`);

  // --- Media-Wiederholung (Regel: gleiche Datei max 2× SICHTBAR pro Seite;
  //     og:/twitter:/JSON-LD zählen nicht — via markup bereits ausgenommen,
  //     content= wird nicht gezählt) ---
  // Nur wirklich RENDERNDE Referenzen zählen (src/CSS-url). data-lb/data-img
  // sind Lightbox-/Hover-Payloads desselben Slots und zählen nicht doppelt.
  const mediaCounts = new Map();
  for (const m of markup.matchAll(/(?:src=|url\()\(?["']?(\/assets\/[^"')\s>]+\.(?:jpg|jpeg|png|webp|gif|avif))/gi)) {
    const asset = m[1];
    mediaCounts.set(asset, (mediaCounts.get(asset) || 0) + 1);
  }
  for (const [asset, n] of mediaCounts) {
    if (n > 2) mediaViolations.push(`${page}: ${asset} ${n}× sichtbar`);
  }

  // --- interne Links + Anker (ohne Inline-Script-Inhalte) ---
  for (const m of markup.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let url = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:|#$)/.test(url)) continue;
    if (url.startsWith('#')) {
      if (!idsOf(page).has(url.slice(1))) anchorErrors.push(`${page}: Anker ${url} existiert nicht auf der Seite`);
      continue;
    }
    // relative -> absolut
    let [path, frag] = url.split('#');
    path = path.split('?')[0];
    if (!path.startsWith('/')) path = posix.normalize(posix.join(posix.dirname(page), path));
    if (path === '' || path === '/') path = '/index.html';
    if (path.endsWith('/')) path += 'index.html';
    if (!fileSet.has(path)) {
      linkErrors.push(`${page}: ${url} -> ${path} FEHLT`);
      continue;
    }
    if (frag && path.endsWith('.html') && !idsOf(path).has(frag)) {
      anchorErrors.push(`${page}: ${url} — Anker #${frag} fehlt in ${path}`);
    }
  }

  // --- Ambient-Videos: nur lokale Quellen, Datei muss existieren; statische
  //     <video>-Tags (falls je eingeführt) müssen muted+playsinline sein ---
  for (const m of markup.matchAll(/data-bgvid="([^"]+)"/g)) {
    const src = m[1];
    if (!src.startsWith('/assets/')) linkErrors.push(`${page}: data-bgvid extern/ungültig (${src})`);
    else if (!fileSet.has(src)) linkErrors.push(`${page}: data-bgvid-Datei fehlt (${src})`);
    // hero-video.js liefert Chromium/Firefox die WebM-Schwester — muss existieren
    const webm = src.replace(/\.mp4$/, '.webm');
    if (webm !== src && !fileSet.has(webm)) linkErrors.push(`${page}: WebM-Variante fehlt (${webm})`);
  }
  for (const m of markup.matchAll(/<video\b[^>]*>/g)) {
    const tag = m[0];
    const src = /src="([^"]*)"/.exec(tag)?.[1];
    if (src && /^https?:/.test(src)) linkErrors.push(`${page}: <video> mit externer Quelle (${src})`);
    if (!/\bmuted\b/.test(tag)) a11yIssues.push(`${page}: <video> ohne muted`);
    if (!/\bplaysinline\b/.test(tag)) a11yIssues.push(`${page}: <video> ohne playsinline`);
  }

  // --- Sprachumschalter-Ziel existiert? (hreflang/alternate) ---
  // Basis-Präfix-Widerspruch (SITE.url mit Pfad vs. base-lose Root-Links) wird
  // als EIN aggregierter Befund gezählt, nicht je Seite.
  for (const m of html.matchAll(/hreflang="(de|en)"\s+href="([^"]+)"/g)) {
    const target = m[2].replace(/^https?:\/\/[^/]+/, '');
    if (!target.startsWith('/')) continue;
    // Verzeichnis-URLs bedient nginx über `index index.html` — die Startseite
    // heißt in canonical/hreflang bewusst '/' (nicht /index.html).
    let clean = target.split('#')[0];
    if (clean.endsWith('/')) clean += 'index.html';
    if (fileSet.has(clean)) continue;
    const basePrefixM = /^\/([^/]+)(\/.*)$/.exec(clean);
    if (basePrefixM && fileSet.has(basePrefixM[2])) {
      basePrefixPages.add(`${page} (Präfix /${basePrefixM[1]})`);
    } else {
      switcherErrors.push(`${page}: hreflang-${m[1]} -> ${target} FEHLT`);
    }
  }
}

// --- DE/EN-Parität (informativ) ---
// EN präfixlos, DE unter /de/… (Sprach-Tausch): für jede EN-Seite muss das
// /de/-Pendant existieren (DE-Startseite = /de.html wegen build.format:'file').
const missingDe = [];
for (const f of htmlFiles) {
  const page = rel(f);
  if (page === '/de.html' || page.startsWith('/de/') || page === '/404.html' || page.startsWith('/onepager/')) continue;
  const dePage = page === '/index.html' ? '/de.html' : '/de' + page;
  if (!fileSet.has(dePage)) missingDe.push(page);
}

// --- Sitemap gegen die Wirklichkeit prüfen ---------------------------------
// Die Sitemap ist ein Versprechen an Google: „diese URLs gibt es und sie
// gehören in den Index". Zwei Arten, es zu brechen — beide gab es hier:
//   1. beworbene URL existiert gar nicht (/account/index.html statt
//      /account.html) -> „URL nicht gefunden (404)" in der Search Console;
//   2. beworbene URL trägt <meta robots noindex> -> „Übermittelte URL als
//      ‚noindex' markiert".
// Beides ist aus dem fertigen Build eindeutig entscheidbar, also hier.
//
// sitemap.xml ist ein Sitemap-INDEX: seine <loc> zeigen auf fünf Teil-Sitemaps
// (Seiten/Schiffe/Missionen/Items/Crafting). Erst den Index auflösen, dann die
// echten Seiten-URLs aus den Teilen einsammeln.
const sitemapIssues = [];
const sitemapPath = join(DIST, 'sitemap.xml');
const locsOf = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const toPath = (loc) => loc.replace(/^https?:\/\/[^/]+/, '') || '/';
if (!existsSync(sitemapPath)) {
  sitemapIssues.push('sitemap.xml fehlt im Build');
} else {
  const indexXml = readFileSync(sitemapPath, 'utf8');
  const isIndex = /<sitemapindex[\s>]/.test(indexXml);
  // Teil-Sitemaps auflösen (oder die eine Datei selbst, falls es doch ein
  // flaches urlset ist — Rückfall, damit der Check nicht an der Form hängt).
  const partPaths = isIndex ? locsOf(indexXml).map(toPath) : ['/sitemap.xml'];
  const pageLocs = [];
  for (const part of partPaths) {
    const partFile = join(DIST, part.slice(1));
    if (!existsSync(partFile)) {
      sitemapIssues.push(`Teil-Sitemap fehlt im Build: ${part}`);
      continue;
    }
    pageLocs.push(...locsOf(readFileSync(partFile, 'utf8')));
  }
  if (!pageLocs.length) sitemapIssues.push('Sitemap enthält keine Seiten-<loc>-Einträge');

  const seen = new Set();
  for (const loc of pageLocs) {
    // '/' ist die Startseite und liegt als index.html im Build.
    const p = toPath(loc);
    const file = p === '/' ? '/index.html' : p;
    if (seen.has(p)) sitemapIssues.push(`doppelter Eintrag: ${p}`);
    seen.add(p);
    if (!fileSet.has(file)) {
      sitemapIssues.push(`beworben, aber nicht gebaut: ${p}`);
      continue;
    }
    const html = readFileSync(join(DIST, file.slice(1)), 'utf8');
    if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) {
      sitemapIssues.push(`steht auf noindex, aber in der Sitemap: ${p}`);
    }
  }
  // Gegenprobe: gebaute, indexierbare Seiten, die NICHT beworben werden.
  // Onepager sind eigenständige Artefakte und bewusst nicht in der Sitemap.
  for (const f of htmlFiles) {
    const p = rel(f);
    if (p === '/404.html' || p.startsWith('/onepager/') || p.startsWith('/downloads/')) continue;
    const canon = p === '/index.html' ? '/' : p;
    if (seen.has(canon)) continue;
    const html = readFileSync(f, 'utf8');
    if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) continue; // korrekt weggelassen
    sitemapIssues.push(`indexierbar, fehlt aber in der Sitemap: ${p}`);
  }
}

// --- Seitengewichte ---
const heavy = [];
for (const f of htmlFiles) {
  const kb = Math.round(statSync(f).size / 1024);
  if (kb > 500) heavy.push(`${rel(f)}: ${kb} KB HTML`);
}
const heavyAssets = allFiles
  .filter((f) => !f.endsWith('.html'))
  .map((f) => [rel(f), statSync(f).size])
  .filter(([, s]) => s > 1_500_000)
  .map(([p, s]) => `${p}: ${(s / 1048576).toFixed(1)} MB`);

// ---------- Report ----------
function section(title, list, bucket, cap = 15) {
  console.log(`\n== ${title}: ${list.length} ==`);
  for (const l of list.slice(0, cap)) console.log('   ' + l);
  if (list.length > cap) console.log(`   … +${list.length - cap} weitere`);
  bucket.push(...list);
}

console.log(`Seiten: ${pagesDe} DE + ${pagesEn} EN = ${htmlFiles.length}`);
section('FEHLER Tote interne Links', linkErrors, errors);
section('FEHLER Tote Anker', anchorErrors, errors);
section('FEHLER Sprachumschalter-Ziele fehlen', switcherErrors, errors);
if (basePrefixPages.size) {
  console.log(`\n== FEHLER Basis-Präfix-Widerspruch (SITE.url mit Pfad, Links ohne base): ${basePrefixPages.size} Seiten betroffen ==`);
  console.log('   hreflang/og-URLs zeigen auf ein Pfad-Präfix, unter dem die Dateien nicht liegen.');
  console.log('   Entscheid nötig: Root-Deploy (SITE.url ohne Pfad) ODER base: setzen + Links umstellen.');
  errors.push(`Basis-Präfix-Widerspruch auf ${basePrefixPages.size} Seiten`);
}
section('FEHLER Sitemap widerspricht dem Build', sitemapIssues, errors, 20);
section('FEHLER Platzhalter im HTML', placeholderHits, errors);
section('FEHLER Mojibake/Encoding', mojibakeHits, errors);
section('WARNUNG Media-Wiederholung (>2×/Seite)', mediaViolations, warns);

// Semantik-Auswertung: gleiche Datei, WIDERSPRÜCHLICHE Alt-Texte. Varianten
// desselben Motivs („rsi polaris“ vs „the stolen polaris“) teilen Inhaltswörter;
// gemeldet wird nur, wenn zwei Alt-Texte KEIN gemeinsames Inhaltswort haben —
// das war das Muster der echten Stand-ins („high tier loot“ vs „supply depot“).
const STOP = new Set(['the', 'a', 'an', 'in', 'of', 'at', 'on', 'and', 'with', 'der', 'die', 'das', 'im', 'in', 'einer', 'eines', 'einem', 'und', 'vor', 'von', 'mit', 'des', 'dem', 'am', 'als']);
const contentTokens = (s) => new Set(s.split(' ').filter((w) => w.length >= 3 && !STOP.has(w)));
const multiAlt = [];
for (const [asset, byAlt] of altByAsset) {
  if (byAlt.size < 2) continue;
  const variants = [...byAlt.keys()];
  let conflict = null;
  outer: for (let i = 0; i < variants.length; i++) {
    for (let j = i + 1; j < variants.length; j++) {
      const A = contentTokens(variants[i]);
      const B = contentTokens(variants[j]);
      if (![...A].some((t) => B.has(t))) { conflict = [variants[i], variants[j]]; break outer; }
    }
  }
  if (conflict) multiAlt.push(`${asset}: "${conflict[0]}" vs "${conflict[1]}"`);
}
section('WARNUNG Media-Semantik: 1 Datei, widersprüchliche Alt-Texte', multiAlt, warns, 20);
section('WARNUNG Media-Semantik: Dateiname passt nicht zum Alt-Text', slugMismatch, warns, 20);
section('WARNUNG SEO', seoIssues, warns);
section('WARNUNG A11y', a11yIssues, warns, 20);
section('INFO EN-Seiten ohne DE-Gegenstück', missingDe, infos, 10);
section('INFO Schwere Seiten (>500 KB HTML)', heavy, infos);
section('INFO Schwere Assets (>1,5 MB)', heavyAssets, infos);

console.log('\n---');
console.log(`FEHLER: ${errors.length} | WARNUNGEN: ${warns.length} | INFOS: ${infos.length}`);
process.exit(errors.length ? 1 : 0);
