/* ============================================================
   scripts/lib/typo-motion.mjs

   Gemeinsames Zuordnungsmodul fuer Erhebung (audit-typo-motion.mjs)
   UND Massendurchlauf (migrate-typo-motion.mjs). Aus
   audit-typo-motion.mjs HERAUSGEZOGEN (02-03-PLAN.md Task 1) —
   NICHT ein zweites Mal geschrieben. Zwei Regex-Fassungen derselben
   Regel wuerden auseinanderdriften, und dann meldet die Pruefung
   gruen, was der Durchlauf gar nicht angefasst hat.

   Enthaelt NUR die Zuordnungslogik (Skala, Regex, Klassifikation,
   Dateisuche). Berichtsausgabe und Sollzahlen bleiben in den
   jeweiligen Skripten — die sind pro Werkzeug unterschiedlich
   (audit: site-weite Sollzahlen; migrate: --expect je Lauf).
   ============================================================ */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const BASE_PX = 18; // html { font-size: 112.5% } -> 1rem = 18px hier, NICHT 16px

/* ---------------------------------------------------------- */
/* Die Skala (Soll-Werte aus 02-01-PLAN.md, identisch mit assets/theme.css §4) */

export const FS_SCALE = [
  ['--fs-1', 0.55], ['--fs-2', 0.6], ['--fs-3', 0.65], ['--fs-4', 0.7],
  ['--fs-5', 0.75], ['--fs-6', 0.8], ['--fs-7', 0.85], ['--fs-8', 0.9],
  ['--fs-9', 0.95], ['--fs-10', 1], ['--fs-11', 1.1], ['--fs-12', 1.2],
  ['--fs-13', 1.3], ['--fs-14', 1.45], ['--fs-15', 1.6], ['--fs-16', 1.8],
  ['--fs-17', 2.2], ['--fs-18', 2.6], ['--fs-19', 3.2],
].map(([name, rem]) => ({ name, rem, px: rem * BASE_PX }));

export const LS_SCALE = [
  ['--ls-1', -0.02], ['--ls-2', -0.01], ['--ls-3', 0], ['--ls-4', 0.01],
  ['--ls-5', 0.02], ['--ls-6', 0.03], ['--ls-7', 0.04], ['--ls-8', 0.05],
  ['--ls-9', 0.06], ['--ls-10', 0.08], ['--ls-11', 0.1], ['--ls-12', 0.12],
  ['--ls-13', 0.14], ['--ls-14', 0.16], ['--ls-15', 0.18], ['--ls-16', 0.2],
  ['--ls-17', 0.22], ['--ls-18', 0.24], ['--ls-19', 0.28], ['--ls-20', 0.32],
].map(([name, em]) => ({ name, em }));

/* Bereiche statt Punktwerte: eine 250ms-Dauer ist eindeutig "slow",
   auch wenn sie zwischen 200 und 300 liegt (siehe 02-01-PLAN.md § Bewegung). */
export const DUR_RANGES = [
  ['--dur-fast', 100, 170],
  ['--dur-base', 180, 220],
  ['--dur-slow', 240, 350],
];

export const AMBIENT_SELECTOR_RE = /\.reveal\b|\.node\.lit\b|\.era[\w-]*/;

/* Die Hero-Ueberschrift ist eine benannte Ausnahme, keine mechanische
   wie clamp()/em/dynamisch — deshalb per Selektor erkannt, nicht per Wert. */
export const HERO_EXCEPTION_SELECTOR_RE = /\.hero__mark\s+h1\b/;

/* Ein drittes Abbruchzeichen zusaetzlich zu ;/} : ein rohes HTML-Attribut
   (style="font-size:44px", ausserhalb jedes <style>-Blocks) endet mit einem
   schliessenden Anfuehrungszeichen, nicht mit Semikolon oder Klammer. */
export const FS_RE = /font-size\s*:\s*([^;}"]+)[;}"]/g;
export const LS_RE = /letter-spacing\s*:\s*([^;}"]+)[;}"]/g;
export const TR_RE = /transition\s*:\s*([^;}]+)[;}]/g;
export const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/g;

/* Rohe style={`…`}-Zuweisungen im Markup (ausserhalb jedes <style>-Blocks),
   Pitfall 5 — zur Bauzeit nicht bekannt, ausgenommen von der Skalenpflicht. */
export const DYNAMIC_STYLE_ATTR_RE = /style=\{`[^`]*(?:font-size|letter-spacing|transition)[^`]*`\}/g;

/* Kurven, die auf --ease-ui wandern (D-04/D-07): die drei fast-identischen
   cubic-bezier() UND jede blanke ease/ease-out/ease-in-out-Angabe. `linear`
   und `steps()` sind eigene Ausnahmen (Dauer darf, Kurve bleibt) und werden
   HIER bewusst nicht erfasst. */
export const CURVE_CUBIC_BEZIER_RE = /cubic-bezier\([^)]*\)/;
export const CURVE_KEYWORD_RE = /\b(ease-in-out|ease-in|ease-out|ease)\b/;
export const LINEAR_OR_STEPS_RE = /\blinear\b|\bsteps\(/;

/* ---------------------------------------------------------- */
/* Dateisuche */

export function walkAstro(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'public') continue;
    const p = join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) out = out.concat(walkAstro(p));
    else if (e.name.endsWith('.astro')) out.push(p);
  }
  return out;
}

export function listAssetsCss() {
  return readdirSync('assets', { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => 'assets/' + e.name);
}

export function allTargetFiles() {
  return [...walkAstro('src'), ...listAssetsCss()].sort();
}

/* ---------------------------------------------------------- */
/* Werte-Klassifikation */

export function isDynamic(raw) {
  return raw.includes('${') || raw.includes('$');
}

export function nearestFs(px) {
  let best = FS_SCALE[0];
  let bestDiff = Math.abs(px - best.px);
  for (const s of FS_SCALE) {
    const diff = Math.abs(px - s.px);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return { step: best, deviationPct: (bestDiff / best.px) * 100 };
}

export function nearestLs(em) {
  let best = LS_SCALE[0];
  let bestDiff = Math.abs(em - best.em);
  for (const s of LS_SCALE) {
    const diff = Math.abs(em - s.em);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return { step: best, deviationEm: bestDiff };
}

export function classifyFontSizeValue(rawIn, isHeroException) {
  const raw = rawIn.trim();
  if (raw.includes('var(--fs-')) return { cat: 'token', raw };
  if (raw.includes('clamp(')) return { cat: 'clamp', raw };
  if (isDynamic(raw)) return { cat: 'dynamic', raw };
  if (isHeroException) return { cat: 'hero-exception', raw };
  const cleaned = raw.replace(/!important/i, '').trim();
  const m = cleaned.match(/^(-?[\d.]+)(rem|em|px)$/);
  if (!m) return { cat: 'other', raw };
  const [, numStr, unit] = m;
  const num = parseFloat(numStr);
  if (unit === 'em') return { cat: 'em', raw, num };
  const px = unit === 'rem' ? num * BASE_PX : num;
  const nearest = nearestFs(px);
  return { cat: 'skalenpflichtig', raw, unit, num, px, nearest };
}

export function classifyLetterSpacingValue(rawIn, isHeroException) {
  const raw = rawIn.trim();
  if (raw.includes('var(--ls-')) return { cat: 'token', raw };
  if (isDynamic(raw)) return { cat: 'dynamic', raw };
  if (isHeroException) return { cat: 'hero-exception', raw };
  const cleaned = raw.replace(/!important/i, '').trim();
  if (cleaned === 'normal') return { cat: 'keyword', raw }; // Browser-Vorgabe, keine Laenge
  if (/^0$/.test(cleaned)) {
    // einheitenloses Null ist gueltiges CSS (letter-spacing:0) — faellt exakt
    // auf --ls-3 (0em).
    const nearest = nearestLs(0);
    return { cat: 'skalenpflichtig', raw, num: 0, nearest };
  }
  const m = cleaned.match(/^(-?[\d.]+)(em|px|rem)$/);
  if (!m) return { cat: 'other', raw };
  const [, numStr, unit] = m;
  const num = parseFloat(numStr);
  if (unit !== 'em') return { cat: 'other', raw, num, unit }; // site-weit sind alle Fundstellen `em`
  const nearest = nearestLs(num);
  return { cat: 'skalenpflichtig', raw, num, nearest };
}

/* Top-Level-Kommas splitten, Klammertiefe zaehlen — cubic-bezier(a,b,c,d)
   darf nicht zerrissen werden. */
export function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/* Wie splitTopLevel, behaelt aber die Original-Spannen (inkl. umgebendem
   Leerraum, OHNE das trennende Komma) bei — der Massendurchlauf braucht die
   Spannen, um NUR die Dauer/Kurve innerhalb eines Teils zu ersetzen, ohne
   Kommas/Leerraum zwischen unveraenderten Teilen anzufassen. */
export function splitTopLevelWithSpans(value) {
  const spans = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      spans.push({ start, end: i, text: value.slice(start, i) });
      start = i + 1;
    }
  }
  if (start < value.length) spans.push({ start, end: value.length, text: value.slice(start) });
  return spans;
}

export function durationMs(part) {
  const m = part.match(/(-?[\d.]+)(ms|s)\b/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  return m[2] === 's' ? num * 1000 : num;
}

export function durTokenFor(ms) {
  for (const [name, lo, hi] of DUR_RANGES) {
    if (ms >= lo && ms <= hi) return name;
  }
  return null;
}

export function classifyTransitionPart(part, ambientSelector) {
  const trimmed = part.trim();
  if (trimmed === 'none') return { cat: 'none', raw: trimmed };
  if (trimmed.includes('var(--dur-')) return { cat: 'token', raw: trimmed };
  if (isDynamic(trimmed)) return { cat: 'dynamic', raw: trimmed };
  const ms = durationMs(trimmed);
  if (ms === null) return { cat: 'other', raw: trimmed };
  const isLinearOrSteps = LINEAR_OR_STEPS_RE.test(trimmed);
  if (ambientSelector || ms > 350) {
    return { cat: 'ambient', raw: trimmed, ms };
  }
  return { cat: 'ui', raw: trimmed, ms, dur: durTokenFor(ms), keepsOwnCurve: isLinearOrSteps };
}

/* Selektor-Rueckwaertssuche statt eines rekursiven Klammer-Parsers: siehe
   02-01-SUMMARY.md Deviation 1 — ein rekursiver Klammertiefe-Parser fuer
   ganze Dateien verlor bei Patch-Komponenten ~55% aller transition-Funde. */
export function nearestSelector(text, pos) {
  let depth = 0;
  for (let k = pos - 1; k >= 0; k--) {
    const ch = text[k];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) {
        const end = k;
        let depth2 = 0;
        let start = 0;
        for (let l = k - 1; l >= 0; l--) {
          const c2 = text[l];
          if (c2 === '{') depth2++;
          else if (c2 === '}') {
            if (depth2 === 0) {
              start = l + 1;
              break;
            }
            depth2--;
          }
        }
        return text.slice(start, end).trim();
      }
      depth--;
    }
  }
  return '';
}

export function getStyleText(text, filePath) {
  if (filePath.endsWith('.css')) return [{ text, offset: 0 }];
  const blocks = [];
  let m;
  const re = new RegExp(STYLE_BLOCK_RE.source, 'g');
  while ((m = re.exec(text))) blocks.push({ text: m[1], offset: m.index + m[0].indexOf(m[1]) });
  return blocks;
}

/* Zeilennummer (1-basiert) einer Fundstelle — nur fuer Berichte, nicht fuer
   die Ersetzung selbst (die arbeitet index-basiert auf dem Rohtext). */
export function lineOf(text, pos) {
  let n = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text[i] === '\n') n++;
  }
  return n;
}
