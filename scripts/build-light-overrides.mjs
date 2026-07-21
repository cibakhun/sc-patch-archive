/* ============================================================
   build-light-overrides.mjs   (Durchgang 2 nach tokenize-theme-colors)

   Es bleibt eine Sorte Farbe übrig, die kein Token ist und keine
   Palette: SEMANTISCHE Statusfarben, direkt ins Bauteil-CSS
   geschrieben.

       .mc__chip--guild { color:#9fd8c8 }     Gilde
       .rff__ochip.pos  { color:#7ee0a8 }     Gewinn
       .mcd__rar--rare  { color:#8fd0ff }     Seltenheit

   Alle sind blasse Pastelltöne — bewusst so gewählt, weil sie auf
   schwarzem Grund leuchten sollen. Auf Papier verschwinden sie:
   im Kontrasttest lagen sie bei 1,4:1 bis 2,6:1.

   Umbenennen wäre falsch (die Bedeutung hängt am Farbton: grün =
   Gewinn, rot = Verlust). Also erzeugt dieses Skript zu jeder
   solchen Regel eine helle Entsprechung mit GLEICHEM FARBTON,
   aber papiertauglicher Helligkeit, und hängt sie ans Ende des
   Stilblocks:

       :root[data-theme="light"] .mc__chip--guild{color:#1a6b57}

   Idempotent: der erzeugte Abschnitt wird bei jedem Lauf ersetzt.
       node scripts/build-light-overrides.mjs [--dry] [--only=…]
   ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { toOklch, oklch, oklcha, parseColor, contrast, ensureContrast } from './lib/theme-color.mjs';

const BEGIN = '/* Hell-Entsprechungen — erzeugt von scripts/build-light-overrides.mjs. Nicht von Hand ändern. */';
/* Alles ab der Marke bis zum Ende des Stilblocks. Bewusst so grob: der
   erzeugte Abschnitt wird IMMER als Letztes angehängt, und eine Regel, die
   nur einzelne erzeugte Zeilen zählt, lässt bei einem Formatfehler Reste
   stehen, die dann nie wieder verschwinden. */
const BLOCK = /\n?[ \t]*\/\* Hell-Entsprechungen[\s\S]*$/;

/**
 * Selbstheilung. Eine frühere, fehlerhafte Fassung dieses Skripts hat
 * Zeilen ohne Marke ans Blockende geschrieben — darunter ein blankes
 * `:root{…}`, das die DUNKLE Palette überschrieb (der Akzent wurde grau).
 *
 * Ein Stilblock endet nie regulär auf :root-Regeln: die Palette steht
 * immer ganz oben. Ein zusammenhängender Schwanz aus :root-Zeilen am
 * Ende ist deshalb sicher als Rückstand erkennbar und wird entfernt.
 * Danach erzeugt dieser Lauf den Abschnitt sauber neu.
 */
function stripTrailingRootRules(css) {
  const lines = css.split('\n');
  let end = lines.length;
  while (end > 0) {
    const t = lines[end - 1].trim();
    if (t === '') { end--; continue; }
    if (/^:root[\s[{]/.test(t)) { end--; continue; }
    break;
  }
  return lines.slice(0, end).join('\n');
}

/* Medien-Kontext: dort MUSS die Farbe blass bleiben (dunkles Motiv). */
const MEDIA = [
  /\.hero(?![a-z-])/, /\.hero__/, /\.shot(?![a-z-])/, /\.band(?![a-z-])/, /\.tile\.img/,
  /\.mosaic/, /\.ship(?![a-z-])/, /\.video(?![a-z-])/, /\.vlbl/, /\.gtile/, /\.zoomic/,
  /\.scrolly/, /\.sstep/, /\.tool(?![a-z-])/, /figcaption/, /\.lb(?![a-z-])/, /\.holo/,
  /\.pcard/, /\.snav-deck__shots/, /\[data-media-surface\]/,
];

const PROPS = new Set(['color', 'border-color', 'border-left-color', 'border-right-color', 'border-top-color', 'border-bottom-color', 'outline-color', 'text-decoration-color', 'caret-color', 'fill', 'stroke']);

/** Nur einzelne, blanke Farbwerte — keine Verläufe, kein var(), kein color-mix(). */
function soleColor(value) {
  const v = value.trim();
  if (/var\(|color-mix|gradient|inherit|currentcolor|transparent/i.test(v)) return null;
  if (!/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))$/.test(v)) return null;
  return parseColor(v);
}

const rgbHex = (c) => `#${[c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;

function paperVersion(c, prop) {
  const { L, C, h } = toOklch(rgbHex(c));
  // Nur eingreifen, wenn die Farbe für dunklen Grund gedacht war. Die Schwelle
  // liegt bei 0,56: darunter reicht der Kontrast auf Weiß meist schon, darüber
  // ist es zuverlässig eine „leuchtet auf Schwarz"-Farbe. Blasse Graustufen
  // wie #8fa3a0 (Seltenheit „gewöhnlich") liegen knapp darüber.
  if (L < 0.56) return null;
  // Eigene Variablen tragen fast immer Text -> strenger Maßstab.
  const isText = prop === 'color' || prop === 'fill' || prop.startsWith('--');
  // Text braucht AA (4,5:1); Rahmen und Striche reichen 3:1.
  // Ziel bewusst über dem Grenzwert (4,75 statt 4,5): die Flächen sind selten
  // reinweiß, sondern leicht getönt (#fffdfa …). Genau auf 4,5 gerechnet
  // landen die Werte in der Messung dann bei 4,35 und fallen durch.
  const target = isText
    ? ensureContrast(oklch(0.46, Math.min(C * 1.2, 0.19), h), '#ffffff', 4.75)
    : ensureContrast(oklch(0.57, Math.min(C * 1.1, 0.17), h), '#ffffff', 3.2);
  if (c.alpha !== undefined && c.alpha < 0.995) {
    const o = toOklch(target);
    // Halbtransparente Rahmen: kräftiger machen, sonst verschwinden sie auf Weiß.
    return oklcha(o.L, o.C, o.h, Math.min(1, c.alpha + 0.18));
  }
  return target;
}

/* ---- CSS tiefenbewusst durchlaufen: nur Regeln auf oberster Ebene ---- */
function topLevelRules(css) {
  const rules = [];
  let depth = 0, i = 0, selStart = 0, atRule = false;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) {
        const sel = css.slice(selStart, i).trim();
        atRule = sel.startsWith('@');
        if (!atRule) {
          const bodyStart = i + 1;
          let d = 1, j = bodyStart;
          while (j < css.length && d > 0) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
          rules.push({ sel, body: css.slice(bodyStart, j - 1) });
          i = j; selStart = i; depth = 0; continue;
        }
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) selStart = i + 1;
    }
    i++;
  }
  return rules;
}

/* ---------------------------------------------------------- */

const DRY = process.argv.includes('--dry');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const files = [];
for await (const f of glob('src/**/*.astro')) files.push(f.replace(/\\/g, '/'));
files.sort();
const targets = ONLY ? files.filter((f) => f.includes(ONLY)) : files;

let changed = 0, generated = 0;
const samples = [];

for (const file of targets) {
  const src = await readFile(file, 'utf8');
  let touched = false;

  const out = src.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, cssRaw, close) => {
    // Vorlauf entfernen -> wiederholbar, und Rückstände alter Läufe heilen.
    const css = stripTrailingRootRules(cssRaw.replace(BLOCK, '\n'));
    const lines = [];

    for (const { sel: selRaw, body } of topLevelRules(css)) {
      // Kommentare gehören beim Selektor-Fang mit dazu ("/* … */\n:root{…}").
      // Ohne sie hier zu entfernen greift die :root-Sperre nicht — und das
      // Skript dunkelt die ERZEUGTE HELLE PALETTE ab (--bg wird grau).
      const sel = selRaw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (!sel || sel.includes(':root') || MEDIA.some((re) => re.test(sel))) continue;

      const decls = [];
      for (const d of body.split(';')) {
        const k = d.indexOf(':');
        if (k < 0) continue;
        const prop = d.slice(0, k).trim().toLowerCase();
        // Eigene Variablen zählen mit: die Bauteile halten ihre semantischen
        // Farben oft dort (--rar für Seltenheit, --gc für Gruppenfarbe) und
        // benutzen sie erst später über var(). Palettenblöcke sind über den
        // :root-Ausschluss oben schon draußen.
        const isVar = prop.startsWith('--');
        if (!isVar && !PROPS.has(prop)) continue;
        const c = soleColor(d.slice(k + 1));
        if (!c) continue;
        const paper = paperVersion(c, prop);
        if (!paper) continue;
        decls.push(`${prop}:${paper}`);
        if (samples.length < 8) samples.push(`${sel} { ${prop}: ${d.slice(k + 1).trim()} -> ${paper} }`);
      }
      if (decls.length) {
        lines.push(`:root[data-theme="light"] ${sel}{${decls.join(';')}}`);
        generated += decls.length;
      }
    }

    // Auch ohne neue Regeln zurückschreiben: `css` ist bereits um den Block
    // des vorherigen Laufs bereinigt. Täte man das nicht, bliebe ein einmal
    // fehlerhaft erzeugter Block für immer stehen.
    if (!lines.length) return open + css + close;
    touched = true;
    return open + css.replace(/\s*$/, '\n') + BEGIN + '\n' + lines.join('\n') + '\n' + close;
  });

  if (out !== src) {
    changed++;
    if (!DRY) await writeFile(file, out);
  }
}

console.log(`build-light-overrides: ${generated} Hell-Entsprechungen in ${changed} Dateien${DRY ? ' (Probelauf)' : ''}`);
if (samples.length) {
  console.log('\nBeispiele:');
  for (const s of samples) console.log('  ' + s);
}
