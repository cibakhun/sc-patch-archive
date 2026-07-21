/* ============================================================
   tokenize-theme-colors.mjs

   Ersetzt hartcodierte Schwarz-/Weißwerte im Seiten-CSS durch die
   Rollen-Tokens aus assets/theme.css. Ohne diesen Schritt kann es
   keinen Hellmodus geben: rgba(0,0,0,.55) bleibt schwarz, egal
   welche Palette gilt.

   ------------------------------------------------------------
   DER KERN: ein Farbwert allein sagt nichts. #fff heißt je nach
   Ort etwas anderes:

     .shot h2   { color:#fff }   Text auf einem FOTO   -> --on-media
     .card h3   { color:#fff }   Text auf einer KARTE  -> --text

   Im ersten Fall muss die Farbe hell BLEIBEN (das Motiv ist in
   beiden Modi dunkel), im zweiten muss sie im Hellmodus zu Tinte
   werden. Das Skript entscheidet deshalb anhand des SELEKTORS,
   in welchem Kontext die Deklaration steht:

     MEDIEN  liegt über Foto/Video   -> --on-media*, --scrim-*
     LEISTE  fixierte Kopfzeile      -> --chrome-*
     SEITE   normale Fläche          -> --text, --veil*, --shadow*

   Was sich nicht sicher zuordnen lässt, wird NICHT angefasst,
   sondern gemeldet. Lieber ein Rest von Hand als eine falsche
   automatische Ersetzung.
   ------------------------------------------------------------
       node scripts/tokenize-theme-colors.mjs --dry     Bericht
       node scripts/tokenize-theme-colors.mjs           schreiben
       … --only=<pfadteil>                              eingrenzen
   ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';

/* ---- Selektoren, die Medien-Kontext bedeuten -------------------
   Alles, was über einem Standbild, Video oder Ken-Burns-Hintergrund
   liegt. Bewusst als Liste einzelner, geprüfter Muster statt als
   grobe Heuristik. */
const MEDIA = [
  /\.hero(?![a-z-])/, /\.hero__/, /\.shot(?![a-z-])/, /\.band(?![a-z-])/,
  /\.tile\.img/, /\.tile\s+\.lbl/, /\.tile__media/,
  /\.mosaic/, /\.ship(?![a-z-])/, /\.video(?![a-z-])/, /\.vlbl/, /\.play(?![a-z-])/,
  /\.gtile/, /\.zoomic/, /\.scrolly/, /\.sstep/, /\.tool(?![a-z-])/, /\.tool__/,
  /\.split__media/, /\.editorial__img/, /\.card__media/, /\.pshot/, /\.cover/,
  /\.poster/, /\.thumb(?![a-z-])/, /figcaption/, /\.kenburns/, /\.parallax/,
  /\.lb(?![a-z-])/, /\.lb__/, /\.gal(?![a-z-])/, /\.strip__media/, /\.hcard/,
  /\.pcard/, /\.snav-deck__shots/, /\.holo/,
];

/* Eigenschaften, in denen Schwarz/Weiß KEINE Farbe ist, sondern Form:
   eine Maske blendet über ihren Alphakanal aus — #000 heißt dort
   „sichtbar", nicht „schwarz". Ein Token daraus zu machen, würde die
   Maske zerstören (Verläufe würden zu Vollflächen). */
const NOT_COLOR_PROPS = /^(-webkit-)?mask(-image|-composite|-size|-position|-repeat)?$/;

/* ---- Selektoren der fixierten Leisten ---- */
const CHROME = [/\.topbar/, /\.snav/, /\.deck/];

/* ---- Seitenweite Atmosphäre (Vignette, Scanlines, Cursor-Glow) ---- */
const AMBIENT = [/body::after/, /body:after/, /\.cursorglow/, /\.grain/, /\.vign/];

const matches = (sel, list) => list.some((re) => re.test(sel));

/* ---- Schleier-Stufen über Fotos ---- */
const SCRIMS = [
  [0.08, '--scrim-0'], [0.24, '--scrim-1'], [0.35, '--scrim-2'], [0.46, '--scrim-3'],
  [0.58, '--scrim-4'], [0.72, '--scrim-5'], [0.92, '--scrim-6'],
];
const nearestScrim = (a) =>
  SCRIMS.reduce((best, s) => (Math.abs(s[0] - a) < Math.abs(best[0] - a) ? s : best))[1];

/* Fast-weiße Töne, die als „zweite Textebene auf dem Foto" gemeint sind
   (die Seite benutzt mehrere davon: #f4f7ff, #eef3ff, #d3ddef …). */
const isPaleInk = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r > 190 && g > 200 && b > 210 && Math.min(r, g, b) > 185;
};

const COLOR = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/g;

/**
 * Eine einzelne Deklaration umschreiben. Gibt null zurück, wenn unklar.
 *
 * `hints` beschreibt den REGELBLOCK, nicht die Deklaration — zwei Fälle
 * lassen sich nur so richtig entscheiden:
 *
 *   onAccent   Der Block füllt sich selbst mit var(--accent). Dann ist
 *              ein #fff daneben nicht „Textfarbe", sondern „Schrift auf
 *              der Akzentfläche" -> --ink. Das kippt im Hellmodus
 *              mit, --text nicht (dunkle Schrift auf dunklem Akzent).
 *   textFill   Der Block nutzt background-clip:text. Dann ist der
 *              Verlauf im background die SCHRIFT -> --title-hi/-lo,
 *              nicht ein Schleier.
 */
function rewriteDecl(prop, value, ctx, hints, report) {
  let unresolved = false;

  const out = value.replace(COLOR, (raw) => {
    const s = raw.replace(/\s+/g, '');
    const rgba = /^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/.exec(s);
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
    // Kanäle bestimmen — Hex wie rgb() gleich behandeln. Nur so werden auch
    // die FAST-schwarzen Tinten der Seite erfasst (#0e1214, #04060c, #05070d).
    // Ohne das blieben genau die Stellen dunkel, an denen Schrift auf einer
    // Akzentfläche sitzt: im Hellmodus dunkel auf dunkel.
    let ch = null;
    if (rgba) ch = [+rgba[1], +rgba[2], +rgba[3]];
    else if (hex) {
      const h6 = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1];
      ch = [0, 2, 4].map((k) => parseInt(h6.slice(k, k + 2), 16));
    }
    const isBlack = ch !== null && ch[0] < 34 && ch[1] < 34 && ch[2] < 40;
    const isWhite = ch !== null && ch[0] > 242 && ch[1] > 242 && ch[2] > 242;
    const alpha = rgba && rgba[4] !== undefined ? +rgba[4] : 1;

    if (!isBlack && !isWhite) {
      if (ctx === 'media' && prop === 'color' && isPaleInk(s)) return 'var(--on-media-dim)';
      return raw; // farbiger Wert -> gehört zur Palette, nicht hierher
    }

    /* Schrift, die als Verlauf gemalt wird (background-clip:text). */
    if (hints.textFill && (prop === 'background' || prop === 'background-image' || prop === 'background-color')) {
      return isWhite ? 'var(--title-hi)' : 'var(--title-lo)';
    }

    /* Schrift auf einer Akzentfläche desselben Blocks. */
    if (hints.onAccent && (prop === 'color' || prop === 'fill' || prop === '-webkit-text-fill-color')) {
      return ctx === 'media' ? 'var(--ink-media)' : 'var(--ink)';
    }

    /* ---------- MEDIEN ---------- */
    if (ctx === 'media') {
      if (isBlack) {
        if (prop === 'text-shadow' || prop === 'box-shadow' || prop === 'filter') return 'var(--on-media-shadow)';
        if (alpha >= 0.995) return 'var(--media-void)'; // deckende Fläche hinter dem Motiv
        // Der Lightbox-Hintergrund hat ein eigenes Token: er verdeckt die
        // ganze Seite, nicht nur ein Motiv.
        if (hints.lightbox && (prop === 'background' || prop === 'background-color')) return 'var(--lb-backdrop)';
        return `var(${nearestScrim(alpha)})`;
      }
      if (prop === 'color' || prop === '-webkit-text-fill-color' || prop === 'fill' || prop === 'stroke') return 'var(--on-media)';
      if (prop.startsWith('border')) return 'var(--on-media-line)';
      if (prop === 'background' || prop === 'background-color') return 'var(--on-media-veil)';
      unresolved = true;
      return raw;
    }

    /* ---------- ATMOSPHÄRE ----------
       Zwei Werte in einer Deklaration: die kräftige Abdunklung zum
       Bildrand und die feinen CRT-Zeilen. Im Hellmodus sind beide
       Tokens fast auf null gesetzt. */
    if (ctx === 'ambient') {
      if (isBlack) return alpha >= 0.4 ? 'var(--vignette)' : 'var(--scanline)';
      unresolved = true;
      return raw;
    }

    /* ---------- LEISTE ---------- */
    if (ctx === 'chrome') {
      if (isBlack) {
        if (prop === 'box-shadow' || prop === 'text-shadow') return 'var(--shadow-color)';
        if (alpha >= 0.9) return 'var(--chrome-solid)';
        if (alpha >= 0.75) return 'var(--chrome-top)';
        // Schwächere Schwarztöne in der Leiste sind Schleier auf
        // Bedienelementen (Suchfeld, Menüknopf), keine Leistenfläche.
        if (prop === 'background' || prop === 'background-color') return alpha <= 0.45 ? 'var(--veil)' : 'var(--veil-2)';
        unresolved = true;
        return raw;
      }
      if (prop.startsWith('border')) return 'var(--line-soft)';
      if (prop === 'color') return 'var(--text)';
      unresolved = true;
      return raw;
    }

    /* ---------- SEITE ---------- */
    if (isBlack) {
      if (prop === 'box-shadow' || prop === 'text-shadow' || prop === 'filter') return 'var(--shadow-color)';
      if (prop === 'background' || prop === 'background-color') return alpha <= 0.5 ? 'var(--veil)' : 'var(--veil-2)';
      if (prop === 'color') return 'var(--ink)'; // schwarze Schrift = liegt auf einer Akzentfläche
      if (prop.startsWith('border')) return 'var(--line-soft)';
      unresolved = true;
      return raw;
    }
    // Weiß auf normaler Fläche
    if (prop === 'color' || prop === 'fill' || prop === '-webkit-text-fill-color') return 'var(--text)';
    if (prop === 'stroke') return 'var(--text)';
    if (prop.startsWith('border')) return 'var(--line-soft)';
    if (prop === 'background' || prop === 'background-color') return alpha < 0.9 ? 'var(--veil-hi)' : 'var(--surface)';
    unresolved = true;
    return raw;
  });

  if (unresolved) {
    report.push({ prop, value, ctx });
    return null;
  }
  return out === value ? null : out;
}

/* ---- Ein CSS-Block (Inhalt eines <style>) umschreiben ---- */
function rewriteCss(css, file, report, stats) {
  // Innerste Regelblöcke: selector { declarations }
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (full, selRaw, body) => {
    // Bei verschachtelten At-Regeln enthält der Selektor noch "@media(…){".
    const sel = selRaw.replace(/^[\s\S]*\{/, '').trim();
    if (sel.startsWith('@') || sel.startsWith('--') || !body.includes('#') && !/rgba?\(/.test(body)) return full;
    // Hellmodus-Regeln nie anfassen — weder die erzeugten noch die von Hand
    // geschriebenen. Dort steht #000 bewusst als „abdunkeln" in einem
    // color-mix(); die Rollen-Regel unten würde daraus var(--ink) machen,
    // was im Hellmodus Weiß ist und die Farbe genau falsch herum aufhellt.
    if (sel.includes('[data-theme=')) return full;

    const ctx = matches(sel, AMBIENT) ? 'ambient'
      : matches(sel, MEDIA) ? 'media'
      : matches(sel, CHROME) ? 'chrome'
      : 'page';

    const hints = {
      onAccent: /background(-color)?\s*:\s*var\(--(accent|hot|gold)/.test(body),
      textFill: /background-clip\s*:\s*text/.test(body),
      lightbox: /^\.lb(?![a-z_-])/.test(sel.trim()),
    };

    const newBody = body.replace(/(^|;)\s*([-a-zA-Z]+)\s*:\s*([^;]+)/g, (d, sep, prop, value) => {
      // Eigene Eigenschaften (--bg, --ink …) sind die Palette selbst — die
      // setzt build-light-palettes.mjs, hier nie anfassen.
      if (prop.trim().startsWith('--')) return d;
      if (NOT_COLOR_PROPS.test(prop.trim().toLowerCase())) return d;
      if (!COLOR.test(value)) { COLOR.lastIndex = 0; return d; }
      COLOR.lastIndex = 0;
      const local = [];
      const rewritten = rewriteDecl(prop.trim().toLowerCase(), value, ctx, hints, local);
      if (local.length) {
        for (const u of local) report.push({ file, sel, ...u });
        return d;
      }
      if (rewritten === null) return d;
      stats.decls++;
      return `${sep}${prop}:${rewritten}`;
    });

    return selRaw + '{' + newBody + '}';
  });
}

/* ---------------------------------------------------------- */

const DRY = process.argv.includes('--dry');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const files = [];
for await (const f of glob('src/**/*.astro')) files.push(f.replace(/\\/g, '/'));
files.sort();
const targets = ONLY ? files.filter((f) => f.includes(ONLY)) : files;

const report = [];
const stats = { decls: 0 };
let changedFiles = 0;

for (const file of targets) {
  const src = await readFile(file, 'utf8');
  let out = src;

  // Alle <style>-Blöcke der Datei (is:inline wie auch komponenten-lokal).
  out = out.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, css, close) => {
    const before = stats.decls;
    const next = rewriteCss(css, file, report, stats);
    return stats.decls > before ? open + next + close : m;
  });

  if (out !== src) {
    changedFiles++;
    if (!DRY) await writeFile(file, out);
  }
}

console.log(
  `tokenize-theme-colors: ${stats.decls} Deklarationen in ${changedFiles} Dateien ` +
    `${DRY ? 'würden umgeschrieben (Probelauf)' : 'umgeschrieben'}`
);

if (report.length) {
  // Nach Muster gruppieren, nicht nach Vorkommen — sonst 500 Zeilen Rauschen.
  const byPattern = new Map();
  for (const r of report) {
    const key = `${r.ctx}  ${r.prop}: ${r.value.trim().slice(0, 90)}`;
    const e = byPattern.get(key) || { n: 0, sel: r.sel, file: r.file };
    e.n++;
    byPattern.set(key, e);
  }
  console.log(`\nNicht zugeordnet — von Hand prüfen (${report.length} Vorkommen, ${byPattern.size} Muster):`);
  for (const [k, v] of [...byPattern].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${String(v.n).padStart(4)}x  ${k}`);
    console.log(`          z. B. ${v.sel}  in ${v.file}`);
  }
}
