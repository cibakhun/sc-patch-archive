/* ============================================================
   verify-layers.mjs — LAYER-01/LAYER-02, Registry-getrieben.

   Prueft gegen den GEBAUTEN Stand (dist/), Vorbild scripts/verify-typo-motion.mjs
   Zeile fuer Zeile (Abbruch mit klarer Meldung wenn dist/ fehlt, je Zusicherung
   eine Soll-/Ist-Zeile, Sammelurteil am Ende, Rueckgabecode 1 bei Fehlschlag).
   Bleibt als eigenstaendiges Werkzeug (`npm run verify:layers`), absichtlich
   NICHT in `npm run build` eingehaengt — dieselbe Begruendung wie im Kopf von
   verify-fx.mjs/verify-typo-motion.mjs: ein Tor, das den Build blockiert,
   fliegt beim ersten Fehlalarm wieder raus. Das Einhaengen ins Dockerfile-Tor
   macht Plan 05.

   REGISTRY: eine Tabelle von Messstellen. Dieser Plan (Tracer) traegt genau
   EINEN Eintrag — den Hero des geteilten Systems (assets/detail.css). Plan 05
   waechst die Aufzaehlung auf alle betroffenen Stellen, ohne dieses Skript
   neu zu schreiben (nur REGISTRY erweitern).

   Vier Zusicherungen:
     1  Die Schicht ist begrenzt — body::after im geteilten System
        (dist/assets/detail.css) traegt kein Zeilenraster mehr und fuehrt
        BEIDE Maskenschreibweisen. Die 19 Patch-Kopien (dist/patches/sc-*.html)
        sind in DIESEM Plan noch nicht angehoben (Plan 04) und werden nur als
        Beobachtungswert gemeldet, nicht blockierend.
     2  Keine Schicht ueber Text — im geteilten CSS gibt es keine Regel, die
        ein bildschirmfuellendes Pseudo-Element (position:fixed;inset:0) mit
        z-index >= 9000 UND einem Farbverlauf erzeugt, ausser der einen
        maskierten Vignette.
     3  Der Beobachter hat keinen Hoehendeckel — dist/assets/detail.js traegt
        fuer .reveal keinen Sichtbarkeitsanteil groesser 0. archive.js und die
        Patch-Koerper werden als Beobachtungswert gemeldet (Plan 03/04 heben
        sie an).
     4  Der Kontrast ist zusammengerechnet — je Registry-Eintrag x Hell/Dunkel
        wird ein echter Bildpunkt (sharp) durch Scrim + Zeilenraster
        geschickt (compositeOver/flattenStack aus theme-color.mjs) und gegen
        die Textfarbe ins Verhaeltnis gesetzt. Ausgegeben werden der
        unguenstigste (volles --scanline, massgeblich) und der
        zeilengemittelte (Tastverhaeltnis 1:3, Zusatzangabe) Wert. Noch KEIN
        hartes Abbruchkriterium in diesem Plan (Aufzaehlung ist noch nicht
        vollstaendig) — Plan 05 zieht die D-04-Zielmarke (4,5:1 / 3:1) an.

   --vorher: rechnet zusaetzlich denselben Stapel MIT der unmaskierten
   Vignette UND dem Zeilenraster UEBER Vordergrund UND Hintergrund (der
   Stand vor diesem Plan — body::after lag als EINE fixe Ebene ueber der
   gesamten Seite, Foto und Text gleichermassen). Beziffert die Verbesserung,
   statt sie zu behaupten (Pitfall 3, 03-RESEARCH.md: gleichmaessiges
   Eintruemen beider Seiten erhaelt das WCAG-Verhaeltnis NICHT — deshalb
   muessen Vordergrund UND Hintergrund je fuer sich durch den Stapel).

     node scripts/verify-layers.mjs
     node scripts/verify-layers.mjs --vorher
   ============================================================ */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { compositeOver, flattenStack, contrast, parseColor } from './lib/theme-color.mjs';

if (!existsSync('dist')) {
  console.error(
    'verify-layers: dist/ fehlt. Erst `npm.cmd run build`, dann `npm run verify:layers` — ' +
      'alle vier Zusicherungen pruefen den GEBAUTEN Stand, nicht die Quelle.'
  );
  process.exit(1);
}

const SHOW_VORHER = process.argv.includes('--vorher');

/* ---------- REGISTRY ----------
   Ein Eintrag je Messstelle. Dieser Plan traegt genau einen: den Hero des
   geteilten Systems. Plan 05 haengt weitere Eintraege an, OHNE dieses
   Skript umzubauen. */
const REGISTRY = [
  {
    id: 'hero-detail',
    label: '.hero (assets/detail.css, geteiltes System)',
    container: '.hero',
    image: 'public/assets/cz-facility.jpg',
    imageUsedBy: 'src/pages/topics/4-0-0-contested-zones.astro (.hero__photo, Motiv des Archetyps)',
    // "unteres linkes Viertel" (Plan-Vorgabe): .hero sitzt auf
    // justify-content:flex-end, dort steht .hero .lead.
    anchor: { xFrac: 0.18, yFrac: 0.85 },
    scrimDeclaration: '.hero__photo::after: --scrim-2 -> --scrim-4 bei 55% -> --bg (linear-gradient 180deg)',
    scanlineOverlay: true,
    // Vignette wirkt an diesem Ankerpunkt NICHT (ausmaskiert) — er liegt
    // innerhalb der durch body::after mask-image freigestellten Textspalte
    // (.hero__in sitzt auf max-width:var(--maxw)).
    vignetteMaskedHere: true,
    text: {
      body: { tokenKey: '--on-media-dim', minRatio: 4.5, label: 'Fliesstext (.hero .lead)' },
      large: { tokenKey: '--on-media', minRatio: 3.0, label: 'grosse Schrift (Registry-Form fuer andere Archetypen, z. B. .band .big/.sstep h3)' },
    },
  },
];

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
const sharedCssText = detailCss + '\n' + astroCssText;

const htmlCache = new Map();
for (const f of htmlFiles) htmlCache.set(f, readFileSync(f, 'utf8'));

const classifyHtmlPath = (relPath) => (/^dist\/patches\/sc-[^/]+\.html$/.test(relPath) ? 'patch' : 'other');

/* ---------- [1] Die Schicht ist begrenzt ---------- */
console.log('\n[1] body::after im geteilten System (dist/assets/detail.css) traegt kein Zeilenraster mehr, beide Masken-Schreibweisen');
{
  const sharedMatch = detailCss.match(/body::after\{[^}]*\}/);
  if (!sharedMatch) {
    fail('body::after fehlt in dist/assets/detail.css');
  } else {
    const b = sharedMatch[0];
    const hasScanline = /repeating-linear-gradient/.test(b);
    const hasWebkitMask = /-webkit-mask-image/.test(b);
    const hasMask = /[^-]mask-image/.test(b);
    console.log(`    Zeilenraster entfernt: Soll true   Ist ${!hasScanline}`);
    console.log(`    -webkit-mask-image vorhanden: Soll true   Ist ${hasWebkitMask}`);
    console.log(`    mask-image vorhanden: Soll true   Ist ${hasMask}`);
    if (hasScanline) fail('dist/assets/detail.css: body::after traegt noch das Zeilenraster');
    if (!hasWebkitMask) fail('dist/assets/detail.css: body::after ohne -webkit-mask-image');
    if (!hasMask) fail('dist/assets/detail.css: body::after ohne mask-image');
  }

  // Beobachtungswert (NICHT blockierend in diesem Plan — Plan 04 hebt an):
  // die 19 Patch-Kopien tragen noch die alte, unmaskierte Regel mit Raster.
  let patchHits = 0, otherHits = 0;
  const patchFiles = [], otherFiles = [];
  for (const [path, html] of htmlCache) {
    const m = html.match(/body::after\{[^}]*\}/g) || [];
    if (!m.length) continue;
    const bucket = classifyHtmlPath(path);
    if (bucket === 'patch') { patchHits += m.length; patchFiles.push(path); }
    else { otherHits += m.length; otherFiles.push(path); }
  }
  console.log(`    Beobachtungswert (nicht blockierend): body::after-Kopien in Patch-Seiten — Ist ${patchHits} ueber ${patchFiles.length} Datei(en) (Plan 04 hebt an)`);
  if (otherHits) {
    console.log(`    Beobachtungswert: body::after ausserhalb des Registry-Bestands dieser Phase in ${otherFiles.length} Datei(en) (${otherFiles.slice(0, 5).join(', ')}${otherFiles.length > 5 ? ', …' : ''}) — ausserhalb des Datei-Anfassbestands, nicht Teil dieses Plans`);
  }
}

/* ---------- [2] Keine Schicht ueber Text ---------- */
console.log('\n[2] Kein bildschirmfuellendes Pseudo-Element mit z-index >= 9000 + Farbverlauf im geteilten CSS, ausser der einen maskierten Vignette');
{
  const blocks = extractRuleBlocks(stripComments(sharedCssText));
  const suspicious = blocks.filter((blk) => {
    const zm = /z-index:\s*(\d+)/.exec(blk.body);
    return /position:\s*fixed/.test(blk.body) && /inset:\s*0\b/.test(blk.body) && zm && parseInt(zm[1], 10) >= 9000 && /gradient\(/.test(blk.body);
  });
  console.log(`    Gefundene bildschirmfuellende Verlaufs-Ebenen (z-index>=9000): Soll 1   Ist ${suspicious.length}`);
  if (suspicious.length !== 1) {
    fail(`Erwartet genau 1 bildschirmfuellende Verlaufs-Ebene mit z-index>=9000 (die maskierte Vignette), gefunden: ${suspicious.length}`);
    for (const s of suspicious) console.error(`      ! ${s.selector}`);
  } else {
    const hasMask = /mask-image/.test(suspicious[0].body);
    console.log(`    Die eine gefundene Ebene ("${suspicious[0].selector}") ist maskiert: Soll true   Ist ${hasMask}`);
    if (!hasMask) fail(`Die verbleibende Verlaufs-Ebene "${suspicious[0].selector}" traegt keine Maske`);
  }
}

/* ---------- [3] Der Beobachter hat keinen Hoehendeckel ---------- */
console.log('\n[3] .reveal-Beobachter in dist/assets/detail.js traegt keinen Sichtbarkeitsanteil groesser 0');
{
  // Die IO-Konstruktor-Aufrufzeile selbst untersuchen — dieselbe Zeile, die
  // auch .reveal beobachtet (assets/detail.js ist eine einzige IIFE-Zeile
  // pro Anweisung, kein Minifizierer dazwischen).
  const ioCall = /new IntersectionObserver\(function\(es\)\{[^]*?\},\{([^}]*)\}\)/.exec(detailJs);
  let thresholdOk = false;
  if (ioCall) {
    const opts = ioCall[1];
    const tm = /threshold:\s*([\d.]+)/.exec(opts);
    const threshold = tm ? parseFloat(tm[1]) : 0; // kein threshold-Feld => Standard 0, ebenfalls sicher
    thresholdOk = threshold <= 0;
    console.log(`    .reveal-Beobachter threshold: Soll <= 0   Ist ${threshold}`);
  } else {
    console.log('    .reveal-Beobachter nicht gefunden — pruefe Datei manuell');
  }
  if (!ioCall || !thresholdOk) fail('dist/assets/detail.js: .reveal-IntersectionObserver traegt noch einen Sichtbarkeitsanteil > 0');

  // Beobachtungswerte (NICHT blockierend in diesem Plan — Plan 03/04 heben an).
  // Zielgenau auf den revealIO-Konstruktor in archive.js, NICHT auf die
  // erste "threshold:"-Fundstelle irgendwo danach — die Datei traegt
  // mehrere unabhaengige Beobachter (eraIO, Counters, revealIO) mit
  // unterschiedlichen Schwellen.
  const archiveMatch = /revealIO\s*=\s*new IntersectionObserver\([^]*?\{\s*threshold:\s*([\d.]+)\s*\}/.exec(archiveJs);
  console.log(`    Beobachtungswert: assets/archive.js .reveal-threshold (revealIO) — Ist ${archiveMatch ? archiveMatch[1] : 'nicht gefunden'} (Plan 03 hebt an)`);

  let patchThresholdHits = 0;
  const patchThresholdFiles = new Set();
  for (const [path, html] of htmlCache) {
    if (classifyHtmlPath(path) !== 'patch') continue;
    const hits = html.match(/threshold:\s*\.?\d[\d.]*/g) || [];
    if (hits.length) { patchThresholdHits += hits.length; patchThresholdFiles.add(path); }
  }
  console.log(`    Beobachtungswert: Patch-Seiten mit eigenem threshold>0 — Ist ${patchThresholdFiles.size} Datei(en), ${patchThresholdHits} Fundstelle(n) (Plan 04 hebt an)`);

  const importantHits = (() => {
    let n = 0;
    for (const html of htmlCache.values()) n += (html.match(/!important/g) || []).length;
    return n;
  })();
  console.log(`    Beobachtungswert: !important-Fundstellen site-weit — Ist ${importantHits} (D-03/Plan 03 traegt die 21 defensiven .reveal-Overrides ab)`);
}

/* ---------- CSS-Kommentare entfernen (vor jeder Regex-Analyse) ----------
   Ohne das faengt z. B. der Kopfkommentar von detail.css ("4.0.x Pyro
   --bg:#120f0c …") jede naive --bg-/Selektor-Suche ein — die Beispielwerte
   dort sehen wie echte Deklarationen aus. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/* ---------- CSS-Block-Extraktion (fuer Zusicherung 2) ---------- */
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

/* ---------- Token-Extraktion fuer Zusicherung 4 ---------- */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function allTokenValues(css, name) {
  // [^;\r\n]+ statt [^;]+: Deklarationen sind einzeilig — verhindert, dass
  // ein fehlendes ";" (oder ein Komment-Rest) die Erfassung ueber mehrere
  // Zeilen hinweg laufen laesst.
  const re = new RegExp(`${escapeRe(name)}\\s*:\\s*([^;\\r\\n]+);`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(css))) out.push(m[1].trim());
  return out;
}

// Kommentar-bereinigt: der Kopfkommentar von detail.css listet Beispielwerte
// wie "--bg:#120f0c" fuer jede Patch-Palette — ohne stripComments() waere
// das die ERSTE (falsche) Fundstelle fuer jede Token-Suche.
const themeCssClean = stripComments(themeCss);
const detailCssClean = stripComments(detailCss);

const vignetteVals = allTokenValues(themeCssClean, '--vignette'); // [0]=dunkel, [1]=hell (Reihenfolge im Bestand)
const scanlineVals = allTokenValues(themeCssClean, '--scanline');
const ambientVals = allTokenValues(themeCssClean, '--ambient-opacity');
const scrim2Raw = allTokenValues(themeCssClean, '--scrim-2')[0]; // in BEIDEN Modi gleich (Layer 3, siehe theme.css-Kopfkommentar)
const scrim4Raw = allTokenValues(themeCssClean, '--scrim-4')[0];
const onMediaRaw = allTokenValues(themeCssClean, '--on-media')[0];
const onMediaDimRaw = allTokenValues(themeCssClean, '--on-media-dim')[0];
const bgDarkRaw = allTokenValues(detailCssClean, '--bg')[0]; // Rueckfall aus detail.css :root{} (Layer 1, jede Seite setzt eigentlich selbst)
const bgLightRaw = allTokenValues(themeCssClean, '--bg')[0]; // Hellmodus-Override, hoehere Spezifitaet (0,2,0) schlaegt Seiten-:root{}

const MODES = [
  { key: 'dunkel', idx: 0, bgRaw: bgDarkRaw },
  { key: 'hell', idx: 1, bgRaw: bgLightRaw },
];

function tokensFor(mode) {
  return {
    vignette: parseColor(vignetteVals[mode.idx]),
    scanline: parseColor(scanlineVals[mode.idx]),
    ambientOpacity: parseFloat(ambientVals[mode.idx]),
    scrim2: parseColor(scrim2Raw),
    scrim4: parseColor(scrim4Raw),
    bg: parseColor(mode.bgRaw),
    '--on-media': onMediaRaw,
    '--on-media-dim': onMediaDimRaw,
  };
}

/* ---------- Kompositions-Bausteine ---------- */
const SCANLINE_DUTY = 1 / 3; // repeating-linear-gradient(0deg,scanline 0 1px,transparent 1px 3px) — 1 von 3 Pixelzeilen

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpColor(c1, c2, t) {
  return {
    r: lerp(c1.r, c2.r, t),
    g: lerp(c1.g, c2.g, t),
    b: lerp(c1.b, c2.b, t),
    alpha: lerp(c1.alpha ?? 1, c2.alpha ?? 1, t),
  };
}
// .hero__photo::after: linear-gradient(180deg,--scrim-2,--scrim-4 55%,--bg)
function scrimAt(yFrac, tokens) {
  if (yFrac <= 0.55) return lerpColor(tokens.scrim2, tokens.scrim4, yFrac / 0.55);
  return lerpColor(tokens.scrim4, tokens.bg, (yFrac - 0.55) / 0.45);
}
function scanlineLayer(tokens, rowAveraged) {
  const alpha = rowAveraged
    ? tokens.scanline.alpha * tokens.ambientOpacity * SCANLINE_DUTY
    : tokens.scanline.alpha * tokens.ambientOpacity;
  return { r: tokens.scanline.r, g: tokens.scanline.g, b: tokens.scanline.b, alpha };
}
// Konservativer Ankerwert: die Bindung an die tatsaechliche radiale Position
// von body::after's Vignette (radial-gradient(130% 115% at 50% 42%, ...))
// ist ausserhalb dieses Tracers — Plan 05 kann das verfeinern. Hier wird der
// volle Token-Wert angesetzt (derselbe "unguenstigster Fall ist die
// massgebliche Lesart"-Grundsatz, den diese Zusicherung ohnehin fuer das
// Zeilenraster anwendet), dokumentiert statt stillschweigend angenommen.
function vignetteLayerFull(tokens) {
  return { r: tokens.vignette.r, g: tokens.vignette.g, b: tokens.vignette.b, alpha: tokens.vignette.alpha * tokens.ambientOpacity };
}

/* ---------- [4] Der Kontrast ist zusammengerechnet ---------- */
console.log('\n[4] Kontrast je Registry-Eintrag x Hell/Dunkel — zusammengerechnet aus Foto + Scrim + Zeilenraster (nicht aus zwei CSS-Tokens)');

const runMeasurement = async () => {
  for (const entry of REGISTRY) {
    console.log(`\n    -- ${entry.label} --`);
    console.log(`       Bild: ${entry.image} (${entry.imageUsedBy})`);
    console.log(`       Scrim: ${entry.scrimDeclaration}`);

    if (!existsSync(entry.image)) {
      fail(`Registry-Eintrag "${entry.id}": Bilddatei fehlt (${entry.image})`);
      continue;
    }

    const pixel = await sampleAnchorColor(entry.image, entry.anchor.xFrac, entry.anchor.yFrac);

    for (const mode of MODES) {
      const tokens = tokensFor(mode);
      const scrim = scrimAt(entry.anchor.yFrac, tokens);
      const scanWorst = scanlineLayer(tokens, false);
      const scanAvg = scanlineLayer(tokens, true);

      // NACHHER (jetziger Stand): Vignette liegt an diesem Ankerpunkt NICHT
      // (ausmaskiert), das Zeilenraster liegt UNTER dem Text — nur der
      // Hintergrund wird getoent, der Textglyph bleibt die reine CSS-Farbe.
      const bgAfterWorst = flattenStack(pixel, [scrim, scanWorst]);
      const bgAfterAvg = flattenStack(pixel, [scrim, scanAvg]);

      for (const [roleKey, role] of Object.entries(entry.text)) {
        const textColor = parseColor(tokens[role.tokenKey]);
        const worstRatio = contrast(textColor, bgAfterWorst);
        const avgRatio = contrast(textColor, bgAfterAvg);
        const meetsAA = worstRatio >= role.minRatio;
        console.log(
          `       [${mode.key}] ${role.label} (${role.tokenKey}): unguenstigster Wert ${worstRatio.toFixed(2)}:1, zeilengemittelt ${avgRatio.toFixed(2)}:1 — Zielmarke D-04 ${role.minRatio}:1, Beobachtung: ${meetsAA ? 'erreicht' : 'noch offen (Plan 05 zieht die Aufzaehlung an)'}`
        );

        if (SHOW_VORHER) {
          // VORHER: Zeilenraster UND Vignette lagen in body::after, EINER
          // fixen Ebene ueber der GESAMTEN Seite (z-index:9000) — Foto UND
          // Text gleichermassen darunter. Deshalb muessen HIER Vordergrund
          // UND Hintergrund je fuer sich durch denselben Ambiente-Stapel
          // geschickt werden (Pitfall 3): gleichmaessiges Eintruemen beider
          // Seiten erhaelt das WCAG-Verhaeltnis NICHT.
          const vign = vignetteLayerFull(tokens);
          const ambientOnTop = [scanWorst, vign];
          const bgBefore = flattenStack(flattenStack(pixel, [scrim]), ambientOnTop);
          const fgBefore = flattenStack(textColor, ambientOnTop);
          const beforeRatio = contrast(fgBefore, bgBefore);
          const delta = worstRatio - beforeRatio;
          console.log(
            `         vorher (unmaskierte Vignette + Raster UEBER Text): ${beforeRatio.toFixed(2)}:1 -> nachher ${worstRatio.toFixed(2)}:1 (Differenz ${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`
          );
        }
      }
    }
  }
};

await runMeasurement();

console.log(`\nverify-layers: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
if (!ok) process.exit(1);

/* ---------- sharp-Sampling ---------- */
async function sampleAnchorColor(imagePath, xFrac, yFrac, patchFrac = 0.03) {
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
  return { r: r / n / 255, g: g / n / 255, b: b / n / 255, alpha: 1 };
}
