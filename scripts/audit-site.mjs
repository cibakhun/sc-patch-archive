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

const PLACEHOLDER_RE = /\bTODO\b|\bFIXME\b|lorem ipsum|PLACEHOLDER|\bTBD\b|\[object Object\]|>undefined<|>null<|>NaN\b/i;
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

for (const f of htmlFiles) {
  const page = rel(f);
  const html = readFileSync(f, 'utf8');
  // Markup ohne Inline-Scripts/JSON-LD/Styles: JS-Template-Strings sind keine
  // Links, Meta-/LD-Bild-URLs keine sichtbaren Medien, ::placeholder kein Text.
  const markup = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const isEn = page === '/en.html' || page.startsWith('/en/');
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
  if (og) {
    const ogPath = og.replace(/^https?:\/\/[^/]+/, '');
    if (ogPath.startsWith('/') && !fileSet.has(ogPath)) {
      const baseM = /^\/([^/]+)(\/.*)$/.exec(ogPath);
      if (baseM && fileSet.has(baseM[2])) basePrefixPages.add(`${page} (og:image)`);
      else seoIssues.push(`${page}: og:image fehlt als Datei (${ogPath})`);
    }
  }

  // --- h1 ---
  const h1Count = (html.match(/<h1[\s>]/g) || []).length;
  if (h1Count === 0) a11yIssues.push(`${page}: kein <h1>`);
  else if (h1Count > 1) a11yIssues.push(`${page}: ${h1Count}× <h1>`);

  // --- img alt ---
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt=/.test(m[0])) {
      const src = /src="([^"]*)"/.exec(m[0])?.[1] || '?';
      a11yIssues.push(`${page}: <img> ohne alt (${src})`);
    }
  }

  // --- Platzhalter / Mojibake (nur sichtbarer Text, placeholder=-Attribute raus) ---
  const visibleText = markup.replace(/\splaceholder="[^"]*"/gi, '');
  const ph = PLACEHOLDER_RE.exec(visibleText);
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

  // --- Sprachumschalter-Ziel existiert? (hreflang/alternate) ---
  // Basis-Präfix-Widerspruch (SITE.url mit Pfad vs. base-lose Root-Links) wird
  // als EIN aggregierter Befund gezählt, nicht je Seite.
  for (const m of html.matchAll(/hreflang="(de|en)"\s+href="([^"]+)"/g)) {
    const target = m[2].replace(/^https?:\/\/[^/]+/, '');
    if (!target.startsWith('/')) continue;
    const clean = target.split('#')[0];
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
const missingEn = [];
for (const f of htmlFiles) {
  const page = rel(f);
  if (page.startsWith('/en/') || page === '/en.html' || page === '/404.html' || page.startsWith('/onepager/')) continue;
  const enPage = page === '/index.html' ? '/en.html' : '/en' + page;
  if (!fileSet.has(enPage)) missingEn.push(page);
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
section('FEHLER Platzhalter im HTML', placeholderHits, errors);
section('FEHLER Mojibake/Encoding', mojibakeHits, errors);
section('WARNUNG Media-Wiederholung (>2×/Seite)', mediaViolations, warns);
section('WARNUNG SEO', seoIssues, warns);
section('WARNUNG A11y', a11yIssues, warns, 20);
section('INFO DE-Seiten ohne EN-Gegenstück', missingEn, infos, 10);
section('INFO Schwere Seiten (>500 KB HTML)', heavy, infos);
section('INFO Schwere Assets (>1,5 MB)', heavyAssets, infos);

console.log('\n---');
console.log(`FEHLER: ${errors.length} | WARNUNGEN: ${warns.length} | INFOS: ${infos.length}`);
process.exit(errors.length ? 1 : 0);
