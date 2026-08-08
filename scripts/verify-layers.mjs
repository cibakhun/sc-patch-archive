/* ============================================================
   verify-layers.mjs — LAYER-01/LAYER-02, Registry-getrieben.

   Prueft gegen den GEBAUTEN Stand (dist/) fuer Zusicherung 1-3 und 5,
   Vorbild scripts/verify-typo-motion.mjs Zeile fuer Zeile (Abbruch mit
   klarer Meldung wenn dist/ fehlt, je Zusicherung eine Soll-/Ist-Zeile,
   Sammelurteil am Ende, Rueckgabecode 1 bei Fehlschlag). Bleibt als
   eigenstaendiges Werkzeug (`npm run verify:layers`), haengt seit Plan 05
   NACH dem Build im Dockerfile-Tor (wie verify:typo) -- ein Fehlschlag
   blockiert nicht den Build selbst, nur das Auslieferungsimage.

   REGISTRY: scripts/lib/layer-registry.mjs fuehrt die vollstaendige
   Aufzaehlung (A1-A10 geteiltes System, B1-B6 die 19 Patch-Koerper --
   hergeleitet aus den Quelldateien, nicht abgetippt --, C1-C3
   Eigenbauten). Dieses Skript liest nur noch die Registry, baut es NICHT
   mehr selbst zusammen.

   Sechs Zusicherungen:
     1  Die Schicht ist begrenzt (body::after, geteiltes System + 19
        Patch-Kopien, scharf seit Plan 04).
     2  Keine Schicht ueber Text (genau 1 bildschirmfuellende Verlaufs-
        Ebene mit z-index>=9000, maskiert).
     3  Der Beobachter hat keinen Hoehendeckel (.reveal, geteiltes System
        + 19 Patch-Koerper, scharf seit Plan 04).
     4  WCAG AA SCHARF (Plan 05): jede gemessene Stelle (kind:'photo',
        'flat', 'flat-multi', NICHT controlCase) muss am unguenstigsten
        Bildpunkt >= ihre Zielmarke erreichen, in JEDEM Farbmodus.
        Bricht bei Unterschreitung ab und nennt die Stelle.
     5  VOLLSTAENDIGKEITSWAECHTER (Plan 05): durchsucht dist/assets/*.css,
        dist/_astro/*.css und die <style>-Bloecke aller .html unterhalb
        von dist/ nach jeder Regel der Bauart "Scrim/Raster"
        (::before/::after, content:"", position:absolute|fixed, inset:0,
        Hintergrund mit einem *-gradient(...)). Jede gefundene Selektor-
        FAMILIE muss in irgendeinem Registry-Eintrag als selectorFamily
        auftauchen -- sonst FEHLER mit Selektor + Fundstelle.
     6  ABDECKUNG (Plan 05): jeder Registry-Eintrag wurde in diesem Lauf
        tatsaechlich gemessen, in beiden Farbmodi, ueber alle ihm
        zugeordneten Bilddateien/Paletten. Ein uebersprungener Punkt
        (fehlende Bilddatei, nicht aufloesbares Token) ist ein
        FEHLSCHLAG, kein stiller Ausfall.

   Flags:
     --patches   dist-unabhaengiger Vorablauf gegen die 19 Quelldateien
                 (Plan 04, unveraendert).
     --vorher    zusaetzlicher Vorher/Nachher-Vergleich fuer den Hero
                 (Plan 01, unveraendert).
     --closure   fuehrt NUR Zusicherung 5 aus (schnelle Rueckmeldung).
     --report    druckt die volle Werteliste (alle Stellen, beide Modi).
     --json      gibt NACH --report zusaetzlich ein JSON-Objekt aus
                 ({entries, measurements}) -- bei --json bleibt die
                 Konsole sonst still, damit `... > datei.json` gueltiges
                 JSON enthaelt.

     node scripts/verify-layers.mjs
     node scripts/verify-layers.mjs --report --json
     node scripts/verify-layers.mjs --closure
   ============================================================ */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { compositeOver, flattenStack, contrast, parseColor } from './lib/theme-color.mjs';
import { buildRegistry, gradientLayerColorAt, isControlCase, EXCLUSIONS } from './lib/layer-registry.mjs';

const JSON_MODE = process.argv.includes('--json');
const REPORT_MODE = process.argv.includes('--report') || JSON_MODE;
const CLOSURE_ONLY = process.argv.includes('--closure');
const SHOW_VORHER = process.argv.includes('--vorher');

const log = (...args) => {
  if (!JSON_MODE) console.log(...args);
};

/* ---------- --patches: dist-unabhaengiger Vorablauf gegen die Quelle (Plan 04, unveraendert) ---------- */
if (process.argv.includes('--patches')) {
  const PATCH_DIR = 'src/components/patches';
  const files = readdirSync(PATCH_DIR)
    .filter((f) => /^sc-4-[\d-]+\.astro$/.test(f))
    .sort();
  let patchesOk = true;
  const patchFail = (msg) => {
    patchesOk = false;
    console.error(`  FEHLER: ${msg}`);
  };
  console.log(`verify-layers --patches: ${files.length} Quelldatei(en) in ${PATCH_DIR}/\n`);
  for (const f of files) {
    const p = join(PATCH_DIR, f).replace(/\\/g, '/');
    const raw = readFileSync(p, 'utf8');
    const bodyAfterMatches = raw.match(/body::after\{[^}]*\}/g) || [];
    if (bodyAfterMatches.length !== 1) {
      patchFail(`${p}: erwartet genau 1 body::after-Regel, gefunden ${bodyAfterMatches.length}`);
    } else {
      const b = bodyAfterMatches[0];
      const hasScanline = /repeating-linear-gradient/.test(b);
      const hasWebkitMask = /-webkit-mask-image/.test(b);
      const hasMask = /[^-]mask-image/.test(b);
      if (hasScanline) patchFail(`${p}: body::after traegt noch das Zeilenraster`);
      if (!hasWebkitMask) patchFail(`${p}: body::after ohne -webkit-mask-image`);
      if (!hasMask) patchFail(`${p}: body::after ohne mask-image`);
    }
    const OLD_IO =
      "new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.1});";
    const NEW_IO =
      "new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -10% 0px',threshold:0});";
    const hasOld = raw.includes(OLD_IO);
    const hasNew = raw.includes(NEW_IO);
    if (!hasOld && !hasNew) {
      patchFail(`${p}: .reveal-IntersectionObserver nicht im erwarteten Wortlaut gefunden`);
    } else if (hasOld) {
      patchFail(`${p}: .reveal-Beobachter traegt noch die alte Form (threshold:.1, Hoehendeckel)`);
    }
    console.log(`  ${p}: geprueft`);
  }
  console.log(`\nverify-layers --patches: ${patchesOk ? 'ALLE 19 QUELLDATEIEN OK ✓' : 'FEHLGESCHLAGEN ✗'}`);
  process.exit(patchesOk ? 0 : 1);
}

if (!existsSync('dist')) {
  console.error(
    'verify-layers: dist/ fehlt. Erst `npm.cmd run build`, dann `npm run verify:layers` — ' +
      'die Zusicherungen 1-3 und 5 pruefen den GEBAUTEN Stand, nicht die Quelle.'
  );
  process.exit(1);
}

/* ---------- dist einlesen ---------- */
function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const htmlFiles = walk('dist', '.html');
const astroCssFiles = existsSync('dist/_astro')
  ? readdirSync('dist/_astro').filter((f) => f.endsWith('.css')).map((f) => 'dist/_astro/' + f)
  : [];
const assetsCssFiles = existsSync('dist/assets')
  ? readdirSync('dist/assets').filter((f) => f.endsWith('.css')).map((f) => 'dist/assets/' + f)
  : [];

const detailCssPath = 'dist/assets/detail.css';
const themeCssPath = 'dist/assets/theme.css';
const detailJsPath = 'dist/assets/detail.js';
const archiveJsPath = 'dist/assets/archive.js';

let ok = true;
const fail = (msg) => {
  ok = false;
  console.error(`  FEHLER: ${msg}`);
};

const readOr = (path, label) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    fail(`${label} fehlt im gebauten Stand (${path})`);
    return '';
  }
};

const detailCss = readOr(detailCssPath, 'dist/assets/detail.css');
const themeCss = readOr(themeCssPath, 'dist/assets/theme.css');
const detailJs = readOr(detailJsPath, 'dist/assets/detail.js');
const archiveJs = existsSync(archiveJsPath) ? readFileSync(archiveJsPath, 'utf8') : '';
const astroCssText = astroCssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
const assetsCssText = assetsCssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
const sharedCssText = detailCss + '\n' + astroCssText;

const htmlCache = new Map();
for (const f of htmlFiles) htmlCache.set(f, readFileSync(f, 'utf8'));

const classifyHtmlPath = (relPath) => (/^dist\/patches\/sc-[^/]+\.html$/.test(relPath) ? 'patch' : 'other');

/* ---------- [1] Die Schicht ist begrenzt ---------- */
log('\n[1] body::after im geteilten System (dist/assets/detail.css) traegt kein Zeilenraster mehr, beide Masken-Schreibweisen');
{
  const sharedMatch = detailCss.match(/body::after\{[^}]*\}/);
  if (!sharedMatch) {
    fail('body::after fehlt in dist/assets/detail.css');
  } else {
    const b = sharedMatch[0];
    const hasScanline = /repeating-linear-gradient/.test(b);
    const hasWebkitMask = /-webkit-mask-image/.test(b);
    const hasMask = /[^-]mask-image/.test(b);
    log(`    Zeilenraster entfernt: Soll true   Ist ${!hasScanline}`);
    log(`    -webkit-mask-image vorhanden: Soll true   Ist ${hasWebkitMask}`);
    log(`    mask-image vorhanden: Soll true   Ist ${hasMask}`);
    if (hasScanline) fail('dist/assets/detail.css: body::after traegt noch das Zeilenraster');
    if (!hasWebkitMask) fail('dist/assets/detail.css: body::after ohne -webkit-mask-image');
    if (!hasMask) fail('dist/assets/detail.css: body::after ohne mask-image');
  }

  let patchOkCount = 0;
  const patchFailFiles = [];
  const otherFiles = [];
  for (const [path, html] of htmlCache) {
    const m = html.match(/body::after\{[^}]*\}/g) || [];
    if (!m.length) continue;
    const bucket = classifyHtmlPath(path);
    if (bucket === 'patch') {
      const bodyAfterOk = m.every((b) => !/repeating-linear-gradient/.test(b) && /-webkit-mask-image/.test(b) && /[^-]mask-image/.test(b));
      if (bodyAfterOk) patchOkCount++;
      else patchFailFiles.push(path);
    } else {
      otherFiles.push(path);
    }
  }
  const patchTotal = patchOkCount + patchFailFiles.length;
  log(`    Patch-Kopien maskiert+rasterfrei: Soll ${patchTotal}   Ist ${patchOkCount} (von ${patchTotal} Patch-Seiten mit eigenem body::after)`);
  if (patchFailFiles.length) {
    fail(`${patchFailFiles.length} Patch-Kopie(n) tragen noch die alte, unmaskierte body::after-Regel mit Zeilenraster: ${patchFailFiles.slice(0, 5).join(', ')}${patchFailFiles.length > 5 ? ', …' : ''}`);
  }
  if (otherFiles.length) {
    log(`    Beobachtungswert: body::after ausserhalb des Registry-Bestands dieser Phase in ${otherFiles.length} Datei(en) (${otherFiles.slice(0, 5).join(', ')}${otherFiles.length > 5 ? ', …' : ''}) — ausserhalb des Datei-Anfassbestands, nicht Teil dieses Plans`);
  }
}

/* ---------- [2] Keine Schicht ueber Text ---------- */
log('\n[2] Kein bildschirmfuellendes Pseudo-Element mit z-index >= 9000 + Farbverlauf im geteilten CSS, ausser der einen maskierten Vignette');
{
  const blocks = extractRuleBlocks(stripComments(sharedCssText));
  const suspicious = blocks.filter((blk) => {
    const zm = /z-index:\s*(\d+)/.exec(blk.body);
    return /position:\s*fixed/.test(blk.body) && /inset:\s*0\b/.test(blk.body) && zm && parseInt(zm[1], 10) >= 9000 && /gradient\(/.test(blk.body);
  });
  log(`    Gefundene bildschirmfuellende Verlaufs-Ebenen (z-index>=9000): Soll 1   Ist ${suspicious.length}`);
  if (suspicious.length !== 1) {
    fail(`Erwartet genau 1 bildschirmfuellende Verlaufs-Ebene mit z-index>=9000 (die maskierte Vignette), gefunden: ${suspicious.length}`);
    for (const s of suspicious) console.error(`      ! ${s.selector}`);
  } else {
    const hasMask = /mask-image/.test(suspicious[0].body);
    log(`    Die eine gefundene Ebene ("${suspicious[0].selector}") ist maskiert: Soll true   Ist ${hasMask}`);
    if (!hasMask) fail(`Die verbleibende Verlaufs-Ebene "${suspicious[0].selector}" traegt keine Maske`);
  }
}

/* ---------- [3] Der Beobachter hat keinen Hoehendeckel ---------- */
log('\n[3] .reveal-Beobachter in dist/assets/detail.js traegt keinen Sichtbarkeitsanteil groesser 0');
{
  const ioCall = /new IntersectionObserver\(function\(es\)\{[^]*?\},\{([^}]*)\}\)/.exec(detailJs);
  let thresholdOk = false;
  if (ioCall) {
    const opts = ioCall[1];
    const tm = /threshold:\s*([\d.]+)/.exec(opts);
    const threshold = tm ? parseFloat(tm[1]) : 0;
    thresholdOk = threshold <= 0;
    log(`    .reveal-Beobachter threshold: Soll <= 0   Ist ${threshold}`);
  } else {
    log('    .reveal-Beobachter nicht gefunden — pruefe Datei manuell');
  }
  if (!ioCall || !thresholdOk) fail('dist/assets/detail.js: .reveal-IntersectionObserver traegt noch einen Sichtbarkeitsanteil > 0');

  const archiveIoMatch = /revealIO\s*=\s*new IntersectionObserver\(\s*function[^]*?\},\s*(\{[^}]*\})\s*\)/.exec(archiveJs);
  let archiveThreshold = 'nicht gefunden';
  if (archiveIoMatch) {
    const tm = /threshold:\s*([\d.]+)/.exec(archiveIoMatch[1]);
    archiveThreshold = tm ? tm[1] : 'kein threshold-Feld (Standard 0)';
  }
  log(`    Beobachtungswert: assets/archive.js .reveal-threshold (revealIO) — Ist ${archiveThreshold}`);

  let patchCheckedFiles = 0;
  const patchThresholdOverFiles = new Set();
  for (const [path, html] of htmlCache) {
    if (classifyHtmlPath(path) !== 'patch') continue;
    patchCheckedFiles++;
    const hits = html.match(/threshold:\s*\.?\d[\d.]*/g) || [];
    for (const h of hits) {
      const v = parseFloat(h.split(':')[1]);
      if (v > 0) { patchThresholdOverFiles.add(path); break; }
    }
  }
  log(`    Patch-Beobachter ohne Hoehendeckel: Soll ${patchCheckedFiles}   Ist ${patchCheckedFiles - patchThresholdOverFiles.size} (von ${patchCheckedFiles} Patch-Seiten)`);
  if (patchThresholdOverFiles.size) {
    fail(`${patchThresholdOverFiles.size} Patch-Seite(n) tragen noch einen .reveal-Beobachter mit threshold > 0: ${[...patchThresholdOverFiles].slice(0, 5).join(', ')}${patchThresholdOverFiles.size > 5 ? ', …' : ''}`);
  }

  const importantHits = (() => {
    let n = 0;
    for (const html of htmlCache.values()) n += (html.match(/!important/g) || []).length;
    return n;
  })();
  log(`    Beobachtungswert: !important-Fundstellen site-weit — Ist ${importantHits} (D-03/Plan 03 traegt die 21 defensiven .reveal-Overrides ab)`);
}

/* ---------- CSS-Kommentare entfernen (vor jeder Regex-Analyse) ---------- */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/* ---------- CSS-Block-Extraktion (fuer Zusicherung 2+5) ---------- */
function extractRuleBlocks(css, out = []) {
  let i = 0;
  const n = css.length;
  while (i < n) {
    const brace = css.indexOf('{', i);
    if (brace === -1) break;
    const selectorStart = i;
    const selector = css.slice(selectorStart, brace).trim();
    let depth = 1;
    let j = brace + 1;
    while (j < n && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1);
    if (/^@(media|supports)/.test(selector)) {
      extractRuleBlocks(body, out);
    } else if (selector && !selector.startsWith('@')) {
      out.push({ selector, body });
    }
    i = j;
  }
  return out;
}

/* ---------- [5] Vollstaendigkeitswaechter ---------- */
/* Bauart "Scrim/Raster": ::before/::after, content:"", position absolute
   ODER fixed, inset:0, Hintergrund mit einem *-gradient(...). Genau die
   Form, die A1-A5/B1-B5/C1-C3 tatsaechlich benutzen (per grep bestaetigt,
   siehe 03-05-PLAN.md <enumeration_principle>). Echte Elemente (kein
   `content:""`, z. B. archive.css' .space-Backdrop) werden bewusst NICHT
   erfasst -- siehe EXCLUSIONS in layer-registry.mjs (X-archiv-space). */
function findGradientPseudoSelectors(css, sourceLabel, out) {
  const blocks = extractRuleBlocks(stripComments(css));
  for (const blk of blocks) {
    if (!/::(before|after)/.test(blk.selector)) continue;
    const hasContent = /content:\s*(""|'')/.test(blk.body);
    const hasPosition = /position:\s*(absolute|fixed)/.test(blk.body);
    const hasInset = /inset:\s*0\b/.test(blk.body);
    const hasGradient = /(linear-gradient|radial-gradient|repeating-linear-gradient)\(/.test(blk.body);
    if (hasContent && hasPosition && hasInset && hasGradient) {
      // Jeder einzelne Selektor der (ggf. kommagetrennten) Liste ist eine
      // eigene Familie -- normalisiert (Leerraum kollabiert).
      for (const sel of blk.selector.split(',')) {
        const norm = sel.trim().replace(/\s+/g, ' ');
        if (norm && !out.has(norm)) out.set(norm, sourceLabel);
      }
    }
  }
}

function extractHtmlStyleBlocks(html) {
  const blocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks.join('\n');
}

log('\n[5] Vollstaendigkeitswaechter — jede Scrim/Raster-Selektor-Familie im GEBAUTEN Stand hat einen Registry-Eintrag');
const registry = buildRegistry();
const knownFamilies = new Set();
for (const entry of registry) for (const fam of entry.selectorFamilies || []) knownFamilies.add(fam);
const excludedFamilies = new Set();
for (const ex of EXCLUSIONS) for (const fam of ex.selectorFamilies || []) { knownFamilies.add(fam); excludedFamilies.add(fam); }

const foundFamilies = new Map(); // selector -> erste Fundstelle
findGradientPseudoSelectors(themeCss, 'dist/assets/theme.css', foundFamilies);
findGradientPseudoSelectors(detailCss, 'dist/assets/detail.css', foundFamilies);
findGradientPseudoSelectors(assetsCssText, 'dist/assets/*.css', foundFamilies);
findGradientPseudoSelectors(astroCssText, 'dist/_astro/*.css', foundFamilies);
for (const [path, html] of htmlCache) {
  const styleText = extractHtmlStyleBlocks(html);
  if (styleText) findGradientPseudoSelectors(styleText, path, foundFamilies);
}

const orphans = [];
for (const [sel, src] of foundFamilies) {
  if (!knownFamilies.has(sel)) orphans.push({ sel, src });
}
log(`    Gefundene Selektor-Familien (Scrim/Raster-Bauart): ${foundFamilies.size}   Registry-Familien: ${knownFamilies.size - excludedFamilies.size}   Benannt ausgeschlossen: ${excludedFamilies.size}   Ohne Eintrag: ${orphans.length}`);
if (orphans.length) {
  fail(`${orphans.length} Selektor-Familie(n) ohne Registry-Eintrag gefunden:`);
  for (const o of orphans.slice(0, 15)) console.error(`      ! ${o.sel}  (${o.src})`);
} else {
  log('    Jede gefundene Selektor-Familie hat einen Registry-Eintrag.');
}

if (CLOSURE_ONLY) {
  console.log(`\nverify-layers --closure: ${orphans.length === 0 ? 'GESCHLOSSEN ✓' : 'FEHLGESCHLAGEN ✗'}`);
  process.exit(orphans.length === 0 ? 0 : 1);
}

/* ---------- Token-Extraktion (global, mode-unabhaengig laut theme.css-Kopfkommentar) ---------- */
function allTokenValues(css, name) {
  const re = new RegExp(`${name.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')}\\s*:\\s*([^;\\r\\n]+);`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(css))) out.push(m[1].trim());
  return out;
}

const themeCssClean = stripComments(themeCss);
const detailCssClean = stripComments(detailCss);

// Medien-Tokens (--scrim-*, --on-media*): laut theme.css-Kopfkommentar
// "Absichtlich in BEIDEN Modi dunkel" -- EIN Wert, nicht pro Modus.
const GLOBAL = {
  scrim0: parseColor(allTokenValues(themeCssClean, '--scrim-0')[0]),
  scrim1: parseColor(allTokenValues(themeCssClean, '--scrim-1')[0]),
  scrim2: parseColor(allTokenValues(themeCssClean, '--scrim-2')[0]),
  scrim3: parseColor(allTokenValues(themeCssClean, '--scrim-3')[0]),
  scrim4: parseColor(allTokenValues(themeCssClean, '--scrim-4')[0]),
  scrim5: parseColor(allTokenValues(themeCssClean, '--scrim-5')[0]),
  scrim6: parseColor(allTokenValues(themeCssClean, '--scrim-6')[0]),
  onMedia: parseColor(allTokenValues(themeCssClean, '--on-media')[0]),
  onMediaDim: parseColor(allTokenValues(themeCssClean, '--on-media-dim')[0]),
  mediaVoid: parseColor(allTokenValues(themeCssClean, '--media-void')[0]),
  // --veil/--veil-2 SIND mode-abhaengig (anders als --scrim-*/--on-media*) --
  // theme.css deklariert sie getrennt fuer :root{} (dunkel) und
  // :root[data-theme="light"]{} (hell), siehe Kopfkommentar "Schleier:
  // Richtung dreht sich um".
  veil: { dunkel: parseColor(allTokenValues(themeCssClean, '--veil')[0]), hell: parseColor(allTokenValues(themeCssClean, '--veil')[1]) },
  veil2: { dunkel: parseColor(allTokenValues(themeCssClean, '--veil-2')[0]), hell: parseColor(allTokenValues(themeCssClean, '--veil-2')[1]) },
  // Geteilte Fallback-Palette (assets/detail.css :root{} + theme.css
  // :root[data-theme="light"]) -- Rueckfall, den A1/A2/A5/A10 benutzen
  // (Praezedenz aus Plan 01, 03-01-SUMMARY.md "Rueckfall aus detail.css").
  bg: {
    dunkel: allTokenValues(detailCssClean, '--bg')[0],
    hell: allTokenValues(themeCssClean, '--bg')[0],
  },
};

/* ---------- Sonderfaelle (C1/C2/C3): aus den EIGENEN Quelldateien gelesen ---------- */
function safeReadSrc(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}
const indexAstroRaw = stripComments(safeReadSrc('src/pages/index.astro'));
const pilotRaw = stripComments(safeReadSrc('src/components/pilot/PilotPage.astro'));
const archiveCssRaw = stripComments(safeReadSrc('assets/archive.css'));
const themeCssSrcRaw = stripComments(safeReadSrc('assets/theme.css'));

function pickHex(block, tok) {
  return new RegExp(`${tok}\\s*:\\s*(#[0-9a-fA-F]{3,8})`).exec(block || '')?.[1];
}
function pickAny(block, tok) {
  // wie pickHex, aber fuer rgba(...)-Werte (--veil/--veil-2 sind KEIN Hex).
  return new RegExp(`${tok}\\s*:\\s*([^;]+);`).exec(block || '')?.[1]?.trim();
}

const indexDarkRoot = /:root\s*\{([^}]*)\}/.exec(indexAstroRaw)?.[1] ?? '';
const indexLightRoot = /:root\[data-theme=["']light["']\]\s*\{([^}]*)\}/.exec(indexAstroRaw)?.[1] ?? '';
const pilotDarkRoot = /:root\s*\{([^}]*)\}/.exec(pilotRaw)?.[1] ?? '';
// PilotPage traegt data-media-surface -- theme.css remappt --text/--bg
// NUR im Hellmodus. --veil ist im Hellmodus ebenfalls remappt (auf denselben
// Wert wie der globale Dunkel-Rueckfall, siehe theme.css [data-media-surface]).
const mediaSurfaceBlock = /:root\[data-theme=["']light["']\]\s*\[data-media-surface\]\s*\{([^}]*)\}/.exec(themeCssSrcRaw)?.[1] ?? '';
const globalDarkVeilBlock = /:root\s*\{([^}]*--veil:[^}]*)\}/.exec(themeCssSrcRaw)?.[1] ?? '';

// archive.css: EIN Token-Block fuer :root UND :root[data-theme='light']
// zusammen ("THEME-INVARIANT", siehe Kopfkommentar der Datei) -- ein
// einziger Wert fuer beide Modi.
const archiveTokenBlock = /:root\s*,\s*:root\[data-theme=["']light["']\]\s*\{([^}]*)\}/.exec(archiveCssRaw)?.[1] ?? '';

const SPECIAL = {
  homeBg: { dunkel: pickHex(indexDarkRoot, '--bg'), hell: pickHex(indexLightRoot, '--bg') },
  ppBg: parseColor(pickHex(pilotDarkRoot, '--bg')), // == --media-void, siehe PilotPage.astro Kommentar zu data-media-surface
  ppVeil: parseColor(pickAny(mediaSurfaceBlock, '--veil') || pickAny(globalDarkVeilBlock, '--veil')),
  ppTextDark: parseColor(pickHex(pilotDarkRoot, '--text')),
  archiveText: parseColor(pickHex(archiveTokenBlock, '--text')),
  archiveMuted: parseColor(pickHex(archiveTokenBlock, '--muted')),
};

function buildTokensForEntry(entry, mode, imageCtx) {
  const bgHex =
    (imageCtx && (mode === 'dunkel' ? imageCtx.bgDark : imageCtx.bgLight)) ||
    (entry.id === 'C2-home-hero' ? (mode === 'dunkel' ? SPECIAL.homeBg.dunkel : SPECIAL.homeBg.hell) : null) ||
    (mode === 'dunkel' ? GLOBAL.bg.dunkel : GLOBAL.bg.hell);
  return {
    scrim0: GLOBAL.scrim0,
    scrim1: GLOBAL.scrim1,
    scrim2: GLOBAL.scrim2,
    scrim3: GLOBAL.scrim3,
    scrim4: GLOBAL.scrim4,
    scrim5: GLOBAL.scrim5,
    scrim6: GLOBAL.scrim6,
    scrim6Half: { ...GLOBAL.scrim6, alpha: GLOBAL.scrim6.alpha * 0.5 },
    bg: parseColor(bgHex),
    veil: GLOBAL.veil[mode],
    veil2: GLOBAL.veil2[mode],
    ppVeil: SPECIAL.ppVeil,
    ppBg: SPECIAL.ppBg,
    ppBgMix78: { ...SPECIAL.ppBg, alpha: 0.78 },
  };
}

function resolveTextColor(tokenKey, mode) {
  if (tokenKey.startsWith('#')) return parseColor(tokenKey);
  switch (tokenKey) {
    case '--on-media':
      return GLOBAL.onMedia;
    case '--on-media-dim':
      return GLOBAL.onMediaDim;
    case 'ppText':
      return mode === 'hell' ? GLOBAL.onMedia : SPECIAL.ppTextDark;
    case 'archiveText':
      return SPECIAL.archiveText;
    case 'archiveMuted':
      return SPECIAL.archiveMuted;
    default:
      throw new Error(`resolveTextColor: unbekannter Textrollen-Token "${tokenKey}"`);
  }
}

const MODES = ['dunkel', 'hell'];

/* ---------- sharp-Sampling ---------- */
const sampleCache = new Map();
async function sampleAnchorColor(imagePath, xFrac, yFrac, patchFrac = 0.03) {
  const key = `${imagePath}@${xFrac},${yFrac}`;
  if (sampleCache.has(key)) return sampleCache.get(key);
  const img = sharp(imagePath);
  const meta = await img.metadata();
  const w = meta.width, h = meta.height;
  const pw = Math.max(1, Math.round(w * patchFrac));
  const ph = Math.max(1, Math.round(h * patchFrac));
  const left = Math.min(w - pw, Math.max(0, Math.round(w * xFrac - pw / 2)));
  const top = Math.min(h - ph, Math.max(0, Math.round(h * yFrac - ph / 2)));
  const { data, info } = await img
    .extract({ left, top, width: pw, height: ph })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += channels) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  const out = { r: r / n / 255, g: g / n / 255, b: b / n / 255, alpha: 1 };
  sampleCache.set(key, out);
  return out;
}

function resolveImagePath(img) {
  if (existsSync(img.path)) return img.path;
  if (img.fallbackPath && existsSync(img.fallbackPath)) return img.fallbackPath;
  return null;
}

/* ---------- [4]+[6]: Messen, AA scharf pruefen, Abdeckung ausweisen ---------- */
log('\n[4]+[6] Kontrast je Registry-Eintrag x Hell/Dunkel x Bilddatei — WCAG AA scharf, Abdeckung vollstaendig');

const measurements = [];
const entryReports = [];

async function measurePhotoEntry(entry) {
  const images = entry.perPatchImages || entry.images || [];
  let entryOk = true;
  if (!images.length) {
    fail(`Registry-Eintrag "${entry.id}": kind:'photo' ohne Bilddatei`);
    return false;
  }
  for (const img of images) {
    const resolved = resolveImagePath(img);
    if (!resolved) {
      fail(`Registry-Eintrag "${entry.id}" (${img.id}): Bilddatei fehlt (${img.path}${img.fallbackPath ? ' / ' + img.fallbackPath : ''})`);
      entryOk = false;
      continue;
    }
    let pixel;
    try {
      pixel = await sampleAnchorColor(resolved, entry.anchor.xFrac, entry.anchor.yFrac);
    } catch (e) {
      fail(`Registry-Eintrag "${entry.id}" (${img.id}): sharp-Sampling fehlgeschlagen (${e.message})`);
      entryOk = false;
      continue;
    }
    for (const mode of MODES) {
      const tokens = buildTokensForEntry(entry, mode, img);
      const bgComposited = scrimColorAtSafe(entry.scrim, entry.anchor.xFrac, entry.anchor.yFrac, tokens, pixel);
      if (entry.controlCase) {
        measurements.push({ id: entry.id, image: img.id, mode, controlCase: true });
        continue;
      }
      for (const [roleKey, role] of Object.entries(entry.text || {})) {
        const textColor = resolveTextColor(role.tokenKey, mode);
        const ratio = contrast(textColor, bgComposited);
        const meets = ratio >= role.minRatio;
        measurements.push({ id: entry.id, image: img.id, mode, role: roleKey, worst: ratio, threshold: role.minRatio, meets });
        log(`    [${entry.id}/${img.id}] ${mode} ${role.label}: ${ratio.toFixed(2)}:1 (Marke ${role.minRatio}:1) ${meets ? 'OK' : 'FEHLT'}`);
        if (!meets) {
          fail(`"${entry.label}" [${img.id}] ${mode}: ${role.label} = ${ratio.toFixed(2)}:1, unter der Marke ${role.minRatio}:1`);
          entryOk = false;
        }
      }
    }
  }
  return entryOk;
}

function scrimColorAtSafe(scrim, xFrac, yFrac, tokens, base) {
  const layerColors = scrim.layers.map((l) => gradientLayerColorAt(l, xFrac, yFrac, tokens)).reverse();
  let acc = { ...base, alpha: 1 };
  for (const c of layerColors) {
    const a = c.alpha ?? 1;
    acc = { r: c.r * a + acc.r * (1 - a), g: c.g * a + acc.g * (1 - a), b: c.b * a + acc.b * (1 - a), alpha: 1 };
  }
  return acc;
}

function measureFlatEntry(entry) {
  let entryOk = true;
  for (const mode of MODES) {
    const { fg, bg } = entry.resolve()[mode];
    if (!fg || !bg) {
      fail(`Registry-Eintrag "${entry.id}": ${mode}-Token nicht aufloesbar (fg=${fg}, bg=${bg})`);
      entryOk = false;
      continue;
    }
    const ratio = contrast(parseColor(fg), parseColor(bg));
    if (entry.controlCase) {
      measurements.push({ id: entry.id, mode, controlCase: true, worst: ratio });
      log(`    [${entry.id}] ${mode}: ${ratio.toFixed(2)}:1 (Kontrollfall, keine AA-Marke)`);
      continue;
    }
    const role = entry.text?.body;
    const meets = !role || ratio >= role.minRatio;
    measurements.push({ id: entry.id, mode, worst: ratio, threshold: role?.minRatio ?? null, meets });
    log(`    [${entry.id}] ${mode} ${role?.label ?? ''}: ${ratio.toFixed(2)}:1${role ? ` (Marke ${role.minRatio}:1) ${meets ? 'OK' : 'FEHLT'}` : ''}`);
    if (role && !meets) {
      fail(`"${entry.label}" ${mode}: ${role.label} = ${ratio.toFixed(2)}:1, unter der Marke ${role.minRatio}:1`);
      entryOk = false;
    }
  }
  return entryOk;
}

function measureFlatMultiEntry(entry) {
  let entryOk = true;
  const role = entry.text?.body;
  for (const p of entry.perPatchTokens) {
    for (const mode of MODES) {
      const mutedHex = mode === 'dunkel' ? p.mutedDark : p.mutedLight;
      const bg2Hex = mode === 'dunkel' ? p.bg2Dark : p.bg2Light;
      if (!mutedHex || !bg2Hex) {
        fail(`Registry-Eintrag "${entry.id}" (${p.id}): ${mode}-Token nicht aufloesbar (--muted=${mutedHex}, --bg-2=${bg2Hex})`);
        entryOk = false;
        continue;
      }
      const ratio = contrast(parseColor(mutedHex), parseColor(bg2Hex));
      const meets = ratio >= role.minRatio;
      measurements.push({ id: entry.id, image: p.id, mode, worst: ratio, threshold: role.minRatio, meets });
      if (!meets) {
        fail(`"${entry.label}" [${p.id}] ${mode}: ${role.label} = ${ratio.toFixed(2)}:1, unter der Marke ${role.minRatio}:1`);
        entryOk = false;
      }
    }
  }
  log(`    [${entry.id}] ${entry.perPatchTokens.length} Patch-Paletten x 2 Modi geprueft`);
  return entryOk;
}

const runMeasurement = async () => {
  for (const entry of registry) {
    let entryOk;
    if (entry.kind === 'photo') entryOk = await measurePhotoEntry(entry);
    else if (entry.kind === 'flat') entryOk = measureFlatEntry(entry);
    else if (entry.kind === 'flat-multi') entryOk = measureFlatMultiEntry(entry);
    else {
      fail(`Registry-Eintrag "${entry.id}": unbekannte kind "${entry.kind}"`);
      entryOk = false;
    }
    entryReports.push({ id: entry.id, label: entry.label, rationale: entry.rationale, controlCase: !!entry.controlCase, measured: entryOk });
  }
};

await runMeasurement();

/* --vorher: Hero-spezifischer Vorher/Nachher-Vergleich (Plan 01, unveraendert) */
if (SHOW_VORHER) {
  const heroEntry = registry.find((e) => e.id === 'A1-hero');
  if (heroEntry) {
    const img = heroEntry.images[0];
    const pixel = await sampleAnchorColor(img.path, heroEntry.anchor.xFrac, heroEntry.anchor.yFrac);
    for (const mode of MODES) {
      const tokens = buildTokensForEntry(heroEntry, mode, null);
      // Vorher: Zeilenraster UND Vignette lagen in body::after (Foto+Text
      // gleichermassen). Volle Vignette (theme.css) x ambient-opacity,
      // konservativ (Praezedenz Plan 01) -- direkt aus theme.css gelesen.
      const vignetteRaw = allTokenValues(themeCssClean, '--vignette')[mode === 'dunkel' ? 0 : 1];
      const ambientRaw = allTokenValues(themeCssClean, '--ambient-opacity')[mode === 'dunkel' ? 0 : 1];
      const scanlineRaw = allTokenValues(themeCssClean, '--scanline')[mode === 'dunkel' ? 0 : 1];
      const vignetteColor = parseColor(vignetteRaw);
      const ambientOpacity = parseFloat(ambientRaw);
      const scanlineColor = parseColor(scanlineRaw);
      const scanWorst = { r: scanlineColor.r, g: scanlineColor.g, b: scanlineColor.b, alpha: scanlineColor.alpha * ambientOpacity };
      const vignetteLayer = { r: vignetteColor.r, g: vignetteColor.g, b: vignetteColor.b, alpha: vignetteColor.alpha * ambientOpacity };
      const bgAfter = scrimColorAtSafe(heroEntry.scrim, heroEntry.anchor.xFrac, heroEntry.anchor.yFrac, tokens, pixel);
      const bgAfterWithRaster = compositeOver(scanWorst, bgAfter);
      for (const [roleKey, role] of Object.entries(heroEntry.text)) {
        const textColor = resolveTextColor(role.tokenKey, mode);
        const worstRatio = contrast(textColor, bgAfterWithRaster);
        const ambientOnTop = [scanWorst, vignetteLayer];
        const bgBefore = flattenStack(flattenStack(pixel, [scrimColorAtSafe(heroEntry.scrim, heroEntry.anchor.xFrac, heroEntry.anchor.yFrac, tokens, pixel)]), ambientOnTop);
        const fgBefore = flattenStack(textColor, ambientOnTop);
        const beforeRatio = contrast(fgBefore, bgBefore);
        console.log(`    [--vorher][${mode}] ${role.label}: vorher ${beforeRatio.toFixed(2)}:1 -> nachher ${worstRatio.toFixed(2)}:1`);
      }
    }
  }
}

/* ---------- Zusicherung 6 zusammenfassen ---------- */
log('\n[6] Abdeckung — jeder Registry-Eintrag gemessen, in beiden Farbmodi, ueber alle zugeordneten Bilder/Paletten');
const unmeasured = entryReports.filter((e) => !e.measured);
log(`    Registry-Eintraege: ${entryReports.length}   Vollstaendig gemessen: ${entryReports.length - unmeasured.length}   Uebersprungen/fehlgeschlagen: ${unmeasured.length}`);
if (unmeasured.length) {
  fail(`${unmeasured.length} Registry-Eintrag/Eintraege nicht vollstaendig gemessen: ${unmeasured.map((e) => e.id).join(', ')}`);
}
const withoutRationale = entryReports.filter((e) => !e.rationale);
if (withoutRationale.length) {
  fail(`${withoutRationale.length} Registry-Eintrag/Eintraege ohne Begruendungsfeld: ${withoutRationale.map((e) => e.id).join(', ')}`);
}

log(`\nverify-layers: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);

if (JSON_MODE) {
  console.log(
    JSON.stringify(
      {
        ok,
        entries: entryReports,
        measurements,
        orphans,
        summary: { entryCount: entryReports.length, measurementCount: measurements.length },
      },
      null,
      2
    )
  );
}

if (!ok) process.exit(1);
