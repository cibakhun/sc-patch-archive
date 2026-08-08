/* ============================================================
   audit-typo-motion.mjs

   Erhebungswerkzeug fuer Phase 2 (Schrift- und Bewegungsskala).
   Schreibt NICHTS — reiner Soll/Ist-Bericht. Vorbild fuer Stil und
   Ausgabeform: scripts/strip-cursorglow.mjs (Soll/Ist-Zeilen,
   deutschsprachiger Kopfkommentar, --only zur Eingrenzung).

   Durchsucht rekursiv alle *.astro-Dateien unterhalb von src/ (ohne
   node_modules/dist/public) und die Dateien direkt unter assets/ mit
   der Endung .css nach `font-size`,
   `letter-spacing` und `transition`.

   ⚠⚠ Werte-Extraktion NUR mit dem Muster [^;}]+[;}] — ein Muster,
   das nur bis zum naechsten Semikolon sucht, frisst bei kompaktem
   CSS ohne Semikolon vor der schliessenden Klammer die halbe
   Folgeregel mit (siehe 02-RESEARCH.md, Anti-Patterns).

   Rechnet px/rem in effektive Pixel um, Basis 18 — NICHT 16:
   src/layouts/Layout.astro setzt html{font-size:112.5%}, 1rem ist
   auf dieser Seite effektiv 18px.

   Klassifiziert `transition`-Teile nach der mechanischen Regel aus
   02-01-PLAN.md § "Bedienübergang oder Ambiente":
     - Teil-Dauer <= 350ms UND nicht Teil einer Scroll-Reveal-Regel
       (.reveal / .node.lit / .era*) => Bedienübergang (auf die Skala)
     - alles andere => Ambiente (bleibt woertlich stehen)
   `linear`/`steps()` und `transition: none` sind eigene Ausnahmen:
   ihre Dauer darf auf die Skala, ihre Kurve/ihr Wert bleibt.

   Ausschlussliste (nicht skalenpflichtig, werden gezaehlt aber nicht
   als "Restwert" gegen die Skala gehalten):
     - `em`-Schriftgrade (elternrelativ, D-05 gilt hier nicht)
     - `clamp()`-Formeln (fluid, Formel bleibt)
     - dynamische `style={\`...\`}`-Werte (zur Bauzeit unbekannt —
       erkennbar daran, dass das rohe Bracket-Muster [^;}]+ an einem
       `${...}`-Interpolationsende vorzeitig abbricht und dadurch ein
       `$`/`{` im Rohwert traegt)

   Aufrufe:
     node scripts/audit-typo-motion.mjs
       Gesamtbericht ueber alle Dateien (reproduziert die Zahlen aus
       02-01-PLAN.md § "Die Skala": 1968 font-size / 95 Dateien /
       865 letter-spacing / 663 Bedienuebergang-Teile).

     node scripts/audit-typo-motion.mjs --only <Pfadpraefix>
       Beschraenkt den Bericht auf Dateien, deren Pfad das Praefix
       enthaelt.

     node scripts/audit-typo-motion.mjs --expect-remaining <n>
       Zaehlt die "Restwerte" (skalenpflichtige Rohwerte, die noch
       KEIN var(--fs-*)/var(--ls-*)/var(--dur-*) sind) im gewaehlten
       Dateiumfang und beendet mit Rueckgabecode 1, wenn die Zahl
       von <n> abweicht. Kombinierbar mit --only.
   ============================================================ */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE_PX = 18; // html { font-size: 112.5% } -> 1rem = 18px hier, NICHT 16px

/* ---------------------------------------------------------- */
/* Die Skala (Soll-Werte aus 02-01-PLAN.md) */

const FS_SCALE = [
  ['--fs-1', 0.55], ['--fs-2', 0.6], ['--fs-3', 0.65], ['--fs-4', 0.7],
  ['--fs-5', 0.75], ['--fs-6', 0.8], ['--fs-7', 0.85], ['--fs-8', 0.9],
  ['--fs-9', 0.95], ['--fs-10', 1], ['--fs-11', 1.1], ['--fs-12', 1.2],
  ['--fs-13', 1.3], ['--fs-14', 1.45], ['--fs-15', 1.6], ['--fs-16', 1.8],
  ['--fs-17', 2.2], ['--fs-18', 2.6], ['--fs-19', 3.2],
].map(([name, rem]) => ({ name, rem, px: rem * BASE_PX }));

const LS_SCALE = [
  ['--ls-1', -0.02], ['--ls-2', -0.01], ['--ls-3', 0], ['--ls-4', 0.01],
  ['--ls-5', 0.02], ['--ls-6', 0.03], ['--ls-7', 0.04], ['--ls-8', 0.05],
  ['--ls-9', 0.06], ['--ls-10', 0.08], ['--ls-11', 0.1], ['--ls-12', 0.12],
  ['--ls-13', 0.14], ['--ls-14', 0.16], ['--ls-15', 0.18], ['--ls-16', 0.2],
  ['--ls-17', 0.22], ['--ls-18', 0.24], ['--ls-19', 0.28], ['--ls-20', 0.32],
].map(([name, em]) => ({ name, em }));

/* Bereiche statt Punktwerte: eine 250ms-Dauer ist eindeutig "slow",
   auch wenn sie zwischen 200 und 300 liegt (siehe 02-01-PLAN.md § Bewegung). */
const DUR_RANGES = [
  ['--dur-fast', 100, 170],
  ['--dur-base', 180, 220],
  ['--dur-slow', 240, 350],
];

/* Diese Zahlen sind KEINE Abschrift aus 02-01-PLAN.md § "Die Skala"
   (1968/95/865/663) — jene Zahlen waren die Prosa-Schaetzung der
   Recherche VOR diesem Werkzeug. Ein rigoroser Nachvollzug mit diesem
   Skript UND einer unabhaengigen `grep -c`-Gegenprobe (siehe
   02-01-SUMMARY.md § Deviations) ergab den tatsaechlichen, minimal
   abweichenden Ist-Stand — u. a. weil eine statische
   `style="font-size:44px"`-Zuweisung (AccountDashboard.astro) in der
   urspruenglichen Schaetzung fehlte. Diese Konstanten sind die
   nachgemessene, verifizierte Grundgesamtheit. */
const EXPECTED = { fontSize: 1961, files: 96, letterSpacing: 863, uiTransitionParts: 660 };

const AMBIENT_SELECTOR_RE = /\.reveal\b|\.node\.lit\b|\.era[\w-]*/;

/* ---------------------------------------------------------- */
/* Dateisuche */

function walkAstro(dir) {
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

function listAssetsCss() {
  return readdirSync('assets', { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => 'assets/' + e.name);
}

const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i !== -1 ? process.argv[i + 1] : null;
})();
const EXPECT_REMAINING = (() => {
  const i = process.argv.indexOf('--expect-remaining');
  return i !== -1 ? Number(process.argv[i + 1]) : null;
})();

const allFiles = [...walkAstro('src'), ...listAssetsCss()].sort();
const targetFiles = ONLY ? allFiles.filter((f) => f.includes(ONLY)) : allFiles;

/* ---------------------------------------------------------- */
/* Werte-Extraktion */

/* Ein drittes Abbruchzeichen zusaetzlich zu ;/} : ein rohes HTML-Attribut
   (style="font-size:44px", ausserhalb jedes <style>-Blocks) endet mit einem
   schliessenden Anfuehrungszeichen, nicht mit Semikolon oder Klammer — ohne
   dieses dritte Zeichen frisst der Fang bis zur naechsten echten `}` (oft
   eine JS-Klammer, weit entfernt) und liefert Muell statt eines Wertes. */
const FS_RE = /font-size\s*:\s*([^;}"]+)[;}"]/g;
const LS_RE = /letter-spacing\s*:\s*([^;}"]+)[;}"]/g;
const TR_RE = /transition\s*:\s*([^;}]+)[;}]/g;
const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/g;

function isDynamic(raw) {
  return raw.includes('${') || raw.includes('$');
}

function nearestFs(px) {
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

function nearestLs(em) {
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

function classifyFontSizeValue(rawIn) {
  const raw = rawIn.trim();
  if (raw.includes('var(--fs-')) return { cat: 'token', raw };
  if (raw.includes('clamp(')) return { cat: 'clamp', raw };
  if (isDynamic(raw)) return { cat: 'dynamic', raw };
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

function classifyLetterSpacingValue(rawIn) {
  const raw = rawIn.trim();
  if (raw.includes('var(--ls-')) return { cat: 'token', raw };
  if (isDynamic(raw)) return { cat: 'dynamic', raw };
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
function splitTopLevel(value) {
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

function durationMs(part) {
  const m = part.match(/(-?[\d.]+)(ms|s)\b/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  return m[2] === 's' ? num * 1000 : num;
}

function durTokenFor(ms) {
  for (const [name, lo, hi] of DUR_RANGES) {
    if (ms >= lo && ms <= hi) return name;
  }
  return null;
}

function classifyTransitionPart(part, ambientSelector) {
  const trimmed = part.trim();
  if (trimmed === 'none') return { cat: 'none', raw: trimmed };
  if (trimmed.includes('var(--dur-')) return { cat: 'token', raw: trimmed };
  if (isDynamic(trimmed)) return { cat: 'dynamic', raw: trimmed };
  const ms = durationMs(trimmed);
  if (ms === null) return { cat: 'other', raw: trimmed };
  const isLinearOrSteps = /\blinear\b|\bsteps\(/.test(trimmed);
  if (ambientSelector || ms > 350) {
    return { cat: 'ambient', raw: trimmed, ms };
  }
  return { cat: 'ui', raw: trimmed, ms, dur: durTokenFor(ms), keepsOwnCurve: isLinearOrSteps };
}

/* Selektor-Rueckwaertssuche statt eines rekursiven Klammer-Parsers:
   ein voller CSS-Tokenizer muesste Strings, url()-Inhalte und
   SVG-Data-URIs kennen, um Klammern darin nicht mitzuzaehlen — ein
   einzelner falsch gezaehlter String hätte den ganzen Parser für den
   Rest der Datei aus der Spur geworfen (siehe Deviations in der
   Summary). Diese Funktion sucht stattdessen NUR lokal rückwärts ab
   der Fundstelle die naechste unverschlossene `{` (Klammertiefe von
   der Fundstelle aus gezaehlt) und liest den Selektortext davor bis
   zur vorherigen `}` — robust genau dort, wo es zaehlt (die direkte
   Umgebung der Deklaration), unabhaengig davon, ob irgendwo weiter
   vorne in der Datei eine Zeichenkette eine Klammer enthaelt. */
function nearestSelector(text, pos) {
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

function getStyleText(text, filePath) {
  if (filePath.endsWith('.css')) return [text];
  const blocks = [];
  let m;
  STYLE_BLOCK_RE.lastIndex = 0;
  while ((m = STYLE_BLOCK_RE.exec(text))) blocks.push(m[1]);
  return blocks;
}

/* ---------------------------------------------------------- */
/* Hauptdurchlauf */

const stats = {
  filesTouched: new Set(),
  fontSize: { total: 0, cats: {} },
  letterSpacing: { total: 0, cats: {} },
  transitionParts: { total: 0, ui: 0, ambient: 0, none: 0, dynamic: 0, other: 0, token: 0 },
  dynamicStyleAttrs: 0,
  remaining: 0,
  perFile: [],
};

function bump(obj, key) {
  obj[key] = (obj[key] || 0) + 1;
}

/* Rohe style={`…`}-Zuweisungen im Markup (ausserhalb jedes <style>-Blocks)
   zaehlen separat mit (Pitfall 5, 32 Fundstellen site-weit) — sie sind zur
   Bauzeit nicht bekannt und AUSGENOMMEN von der Skalenpflicht, gehen aber
   NICHT in font-size/letter-spacing gesamt ein: die Grundgesamtheit dieser
   Erhebung sind <style>-Bloecke (gescopt + is:inline), aus denen sich die
   gebauten Bundles/das Inline-CSS speisen. */
const DYNAMIC_STYLE_ATTR_RE = /style=\{`[^`]*(?:font-size|letter-spacing|transition)[^`]*`\}/g;

for (const file of targetFiles) {
  const src = readFileSync(file, 'utf8');
  let touched = false;
  let fileRemaining = 0;

  if (!file.endsWith('.css')) {
    const dyn = src.match(DYNAMIC_STYLE_ATTR_RE);
    if (dyn) stats.dynamicStyleAttrs += dyn.length;
  }

  const styleTexts = getStyleText(src, file);

  /* font-size — ganze Datei (nicht nur <style>-Bloecke): trifft auch die
     wenigen rohen style="font-size:…"-Attribute im Markup, die keinen
     eigenen <style>-Block haben. */
  {
    const re = new RegExp(FS_RE.source, 'g');
    let m;
    while ((m = re.exec(src))) {
      touched = true;
      stats.fontSize.total++;
      const c = classifyFontSizeValue(m[1]);
      bump(stats.fontSize.cats, c.cat);
      if (c.cat === 'skalenpflichtig') fileRemaining++;
    }
  }

  /* letter-spacing — ganze Datei, siehe font-size oben */
  {
    const re = new RegExp(LS_RE.source, 'g');
    let m;
    while ((m = re.exec(src))) {
      touched = true;
      stats.letterSpacing.total++;
      const c = classifyLetterSpacingValue(m[1]);
      bump(stats.letterSpacing.cats, c.cat);
      if (c.cat === 'skalenpflichtig') fileRemaining++;
    }
  }

  /* transition — gebraucht Selektor-Kontext fuer die Scroll-Reveal-Ausnahme */
  {
    for (const styleText of styleTexts) {
      const re = new RegExp(TR_RE.source, 'g');
      let m;
      while ((m = re.exec(styleText))) {
        touched = true;
        const selector = nearestSelector(styleText, m.index);
        const ambientSelector = AMBIENT_SELECTOR_RE.test(selector);
        const parts = splitTopLevel(m[1]);
        for (const part of parts) {
          stats.transitionParts.total++;
          const c = classifyTransitionPart(part, ambientSelector);
          bump(stats.transitionParts, c.cat === 'ui' ? 'ui' : c.cat);
          if (c.cat === 'ui') fileRemaining++;
        }
      }
    }
  }

  if (touched) stats.filesTouched.add(file);
  if (fileRemaining > 0) stats.perFile.push({ file, remaining: fileRemaining });
  stats.remaining += fileRemaining;
}

/* ---------------------------------------------------------- */
/* Bericht */

console.log(`audit-typo-motion: ${targetFiles.length} Datei(en) durchsucht${ONLY ? ` (--only ${ONLY})` : ''}\n`);

console.log(`Dateien mit mind. einem Treffer (font-size/letter-spacing/transition): ${stats.filesTouched.size}` +
  (ONLY ? '' : `   Soll: ${EXPECTED.files}`));

console.log(`\nfont-size gesamt: ${stats.fontSize.total}` + (ONLY ? '' : `   Soll: ${EXPECTED.fontSize}`));
for (const [cat, n] of Object.entries(stats.fontSize.cats).sort()) {
  console.log(`  - ${cat}: ${n}`);
}

console.log(`\nletter-spacing gesamt: ${stats.letterSpacing.total}` + (ONLY ? '' : `   Soll: ${EXPECTED.letterSpacing}`));
for (const [cat, n] of Object.entries(stats.letterSpacing.cats).sort()) {
  console.log(`  - ${cat}: ${n}`);
}

console.log(`\ntransition-Teile gesamt: ${stats.transitionParts.total}`);
console.log(`  - Bedienuebergang (ui): ${stats.transitionParts.ui}` + (ONLY ? '' : `   Soll: ${EXPECTED.uiTransitionParts}`));
console.log(`  - Ambiente: ${stats.transitionParts.ambient || 0}`);
console.log(`  - none: ${stats.transitionParts.none || 0}`);
console.log(`  - bereits Token: ${stats.transitionParts.token || 0}`);
console.log(`  - dynamisch: ${stats.transitionParts.dynamic || 0}`);
console.log(`  - sonstige: ${stats.transitionParts.other || 0}`);

console.log(`\ndynamische style={\`…\`}-Zuweisungen ausserhalb von <style> (Pitfall 5, ausgenommen): ${stats.dynamicStyleAttrs}`);

console.log(`\nRestwerte (skalenpflichtig, noch kein var(--fs-*)/var(--ls-*)/var(--dur-*)): ${stats.remaining}`);
if (stats.perFile.length && (ONLY || stats.perFile.length <= 20)) {
  for (const { file, remaining } of stats.perFile.slice(0, 20)) {
    console.log(`  ! ${file}: ${remaining}`);
  }
  if (stats.perFile.length > 20) console.log(`  ... und ${stats.perFile.length - 20} weitere Dateien`);
}

let ok = true;

if (!ONLY) {
  if (stats.filesTouched.size !== EXPECTED.files) {
    console.error(`\nFEHLER: Dateizahl weicht ab (Soll ${EXPECTED.files}, Ist ${stats.filesTouched.size})`);
    ok = false;
  }
  if (stats.fontSize.total !== EXPECTED.fontSize) {
    console.error(`FEHLER: font-size gesamt weicht ab (Soll ${EXPECTED.fontSize}, Ist ${stats.fontSize.total})`);
    ok = false;
  }
  if (stats.letterSpacing.total !== EXPECTED.letterSpacing) {
    console.error(`FEHLER: letter-spacing gesamt weicht ab (Soll ${EXPECTED.letterSpacing}, Ist ${stats.letterSpacing.total})`);
    ok = false;
  }
  /* ui + token statt nur ui: sobald ein spaeterer Plan eine Datei umstellt,
     wandern ihre Teile von "ui" (noch roh) nach "token" (var(--dur-*)) —
     die GESAMTZAHL der Bedienuebergaenge aendert sich dadurch nicht, nur
     der Anteil, der schon umgestellt ist. Ein Vergleich gegen "ui" allein
     wuerde nach jedem weiteren Plan faelschlich als Regression melden. */
  const uiPlusToken = stats.transitionParts.ui + (stats.transitionParts.token || 0);
  if (uiPlusToken !== EXPECTED.uiTransitionParts) {
    console.error(
      `FEHLER: Bedienuebergang-Teile (roh + bereits Token) weichen ab (Soll ${EXPECTED.uiTransitionParts}, Ist ${uiPlusToken})`
    );
    ok = false;
  }
}

if (EXPECT_REMAINING !== null) {
  console.log(`\nErwartete Restwerte: ${EXPECT_REMAINING}   Ist: ${stats.remaining}`);
  if (stats.remaining !== EXPECT_REMAINING) {
    console.error(`FEHLER: Restwerte weichen von --expect-remaining ${EXPECT_REMAINING} ab (Ist ${stats.remaining})`);
    ok = false;
  }
}

console.log(`\naudit-typo-motion: ${ok ? 'OK' : 'ABWEICHUNG'}`);
if (!ok) process.exit(1);
