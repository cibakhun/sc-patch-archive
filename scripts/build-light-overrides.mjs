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
 *
 * Ausnahme (gefunden 08.08.2026 an src/components/pilot/PilotPage.astro,
 * siehe 04-03-SUMMARY.md): besteht ein <style>-Block NUR aus der dunklen
 * Palette plus dem generierten hellen Zwilling (kein weiterer Selektor
 * danach — ein reiner Paletten-Block, getrennt vom Rest des Seiten-CSS),
 * dann IST der helle Zwilling selbst die letzte Zeile — und die
 * Selbstheilung hätte ihn als vermeintlichen Rückstand mitgelöscht, ohne
 * ihn neu zu erzeugen (kein :root{}-Block mehr vorhanden, aus dem
 * build-light-palettes.mjs schöpfen könnte). Eine Zeile, die UNMITTELBAR
 * der aktuellen Hellmodus-Marke folgt, ist per Definition kein Rückstand
 * eines früheren, kaputten Laufs, sondern die JETZIGE, gültige Palette.
 */
function stripTrailingRootRules(css) {
  const lines = css.split('\n');
  let end = lines.length;
  while (end > 0) {
    const t = lines[end - 1].trim();
    if (t === '') { end--; continue; }
    if (/^:root[\s[{]/.test(t)) {
      const prev = (lines[end - 2] || '').trim();
      if (prev.includes('erzeugt von scripts/build-light-palettes.mjs')) break;
      end--;
      continue;
    }
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

/* ---- CSS tiefenbewusst durchlaufen: nur Regeln auf oberster Ebene ----
   Kommentare werden als UNDURCHSICHTIGE Spannen uebersprungen, bevor ihre
   Zeichen die Klammertiefe beeinflussen koennen. Ohne das zaehlt ein
   Kommentar, der ueber CSS-Syntax REDET (z. B. "... in einem :root{}-
   Block: ..." als Prosa), seine eigenen Klammern mit — gefunden
   08.08.2026 an src/components/ArmorSets.astro (04-03-SUMMARY.md): ein
   Kommentar erwaehnte woertlich ":root{}"-Block", das Klammernpaar darin
   schloss die Tiefenzaehlung vorzeitig und riss die naechste echte Regel
   (.dp {...}) mitten entzwei — die "Selektor"-Zeile der Folgeregel bestand
   danach aus Kommentarresten statt aus ".dp". */
function topLevelRules(css) {
  const rules = [];
  let depth = 0, i = 0, selStart = 0, atRule = false;
  const skipComment = () => {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      return true;
    }
    return false;
  };
  while (i < css.length) {
    if (skipComment()) continue;
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) {
        const sel = css.slice(selStart, i).trim();
        atRule = sel.startsWith('@');
        if (!atRule) {
          const bodyStart = i + 1;
          let d = 1, j = bodyStart;
          while (j < css.length && d > 0) {
            if (css[j] === '/' && css[j + 1] === '*') {
              const end = css.indexOf('*/', j + 2);
              j = end === -1 ? css.length : end + 2;
              continue;
            }
            if (css[j] === '{') d++; else if (css[j] === '}') d--;
            j++;
          }
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

    // Selektoren, die BEREITS eine von Hand geschriebene
    // ":root[data-theme='light'] <sel>"-Regel im selben <style>-Block tragen
    // (ausserhalb des generierten Abschnitts, der oben schon entfernt wurde).
    // Gefunden 08.08.2026 an src/components/ArmorSets.astro (04-03-SUMMARY.md):
    // ".dp" haelt seine Seltenheitsfarben bewusst als eigene --rar-*-Variablen
    // MIT handgeschriebenem hellen Gegenstueck (Kommentar: "Bewusst NICHT in
    // einem :root{}-Block ... wuerde hier eine zweite Wahrheit anlegen"). Ohne
    // diese Sperre wuerde das Skript trotzdem eine ZWEITE, automatisch aus
    // paperVersion() abgeleitete ":root[data-theme='light'] .dp{...}"-Regel
    // anhaengen, die die kuratierten Werte durch Quellreihenfolge ueberschreibt.
    const existingLightSelectors = new Set(
      [...css.matchAll(/:root\[data-theme=["']light["']\]\s*([^{]+)\{/g)].map((mm) => mm[1].trim())
    );

    for (const { sel: selRaw, body } of topLevelRules(css)) {
      // Kommentare gehören beim Selektor-Fang mit dazu ("/* … */\n:root{…}").
      // Ohne sie hier zu entfernen greift die :root-Sperre nicht — und das
      // Skript dunkelt die ERZEUGTE HELLE PALETTE ab (--bg wird grau).
      const sel = selRaw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (!sel || sel.includes(':root') || MEDIA.some((re) => re.test(sel)) || existingLightSelectors.has(sel)) continue;

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
