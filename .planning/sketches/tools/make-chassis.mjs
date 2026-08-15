/**
 * make-chassis.mjs — bereitet eine gerenderte Gehäuse-Grafik für den Einbau auf.
 *
 * WARUM NICHT 9-SLICE (der erste Plan, verworfen nach dem Vermessen):
 * `border-image` streckt die Mitte jeder Kante. Diese Vorlage hat aber genau
 * dort ihre Zeichnung — eine mittige Steckerbuchse mit Lüftungsgittern unten,
 * einen angewinkelten Griffansatz oben. Beides würde verschmieren. Statt die
 * Grafik dem Verfahren anzupassen, wird das Verfahren der Grafik angepasst:
 * das Chassis bleibt EIN Bild mit festem Seitenverhältnis, die Bildfläche ist
 * ein Prozentkasten darin. Nichts verzerrt, die Zeichnung bleibt unangetastet.
 *
 * Was das Skript tut:
 *   1. übermalt benannte Stellen mit sauberem Blech (`--heal`, z. B. den Griff),
 *   2. schneidet auf das Gerät zu (`--crop`),
 *   3. misst die Bildfläche selbst ein (Helligkeitssprung von der Mitte nach
 *      außen, Median über fünf Abtastlinien),
 *   4. schreibt WebP in mehreren Breiten,
 *   5. druckt die Bildfläche als Prozentwerte plus fertiges CSS.
 *
 * Chrome über playwright-core dient als Bildwerkzeug — sharp und ImageMagick
 * gibt es in diesem Projekt nicht, Chrome schon.
 *
 * Aufruf:
 *   node .planning/sketches/tools/make-chassis.mjs <quelle> <zielordner> \
 *        [--crop x,y,w,h] [--heal sx,sy,sw,sh:dx,dy,dw,dh] [--widths 1600,2400] \
 *        [--screen x,y,w,h] [--thr 62] [--info]
 */
import { chromium } from 'playwright-core';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

/* ⚠ Die Quelle geht als DATEN-URL in die Seite, nicht als file://-Pfad: eine
   frisch geöffnete Seite steht auf about:blank, und von dort verweigert Chrome
   den Zugriff auf lokale Dateien. `img.decode()` wirft dann "EncodingError: The
   source image cannot be decoded" — das sieht aus wie ein kaputtes Bild, ist
   aber eine Herkunftssperre. */
const MIME = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
               '.webp':'image/webp', '.avif':'image/avif' };
const toDataUrl = (p) => {
  const mime = MIME[extname(p).toLowerCase()];
  if (!mime) throw new Error(`Unbekanntes Bildformat: ${extname(p)}`);
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
};

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) { console.error('Kein Chrome gefunden — Pfad über CHROME_PATH setzen.'); process.exit(1); }

const argv = process.argv.slice(2);
const flags = {}; const pos = []; const heals = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    if (k === 'info') flags.info = true;
    else if (k === 'heal') heals.push(argv[++i]);
    else flags[k] = argv[++i];
  } else pos.push(argv[i]);
}
const [src, outDir] = pos;
if (!src) { console.error('Aufruf: node make-chassis.mjs <quelle> <zielordner> …'); process.exit(1); }
const nums = (s) => (s ? s.split(',').map((n) => Math.round(Number(n.trim()))) : null);
const SRC_URL = toDataUrl(src);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();

const size = await page.evaluate(async (url) => {
  const img = new Image(); img.src = url; await img.decode();
  return { w: img.naturalWidth, h: img.naturalHeight };
}, SRC_URL);
console.log(`Quelle: ${basename(src)} — ${size.w} × ${size.h}`);
if (flags.info) { await browser.close(); process.exit(0); }
if (!outDir) { console.error('Zielordner fehlt.'); await browser.close(); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const crop = nums(flags.crop) || [0, 0, size.w, size.h];
const healSpecs = heals.map((h) => {
  const [s, d] = h.split(':');
  return { s: nums(s), d: nums(d) };
});

/* Schritt 1+2 in einem Durchgang: erst übermalen, dann zuschneiden. Die
   Reihenfolge ist wichtig — die Heilstellen sind in QUELL-Koordinaten
   angegeben, damit sie beim Nachjustieren des Zuschnitts nicht wandern. */
const cropped = await page.evaluate(async ({ url, crop, healSpecs }) => {
  const img = new Image(); img.src = url; await img.decode();
  const full = document.createElement('canvas');
  full.width = img.naturalWidth; full.height = img.naturalHeight;
  const fg = full.getContext('2d');
  fg.drawImage(img, 0, 0);
  /* Übermalen: eine saubere Blechbahn über die Störstelle kacheln. Der Rand
     wird weich ausgeblendet, sonst steht dort eine sichtbare Naht. */
  for (const { s, d } of healSpecs) {
    const patch = document.createElement('canvas');
    patch.width = d[2]; patch.height = d[3];
    const pg = patch.getContext('2d');
    for (let x = 0; x < d[2]; x += s[2]) {
      pg.drawImage(full, s[0], s[1], s[2], s[3], x, 0, s[2], s[3]);
    }
    const grad = pg.createLinearGradient(0, 0, d[2], 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.10, 'rgba(0,0,0,1)');
    grad.addColorStop(0.90, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    pg.globalCompositeOperation = 'destination-in';
    pg.fillStyle = grad; pg.fillRect(0, 0, d[2], d[3]);
    fg.drawImage(patch, d[0], d[1]);
  }
  const c = document.createElement('canvas');
  c.width = crop[2]; c.height = crop[3];
  c.getContext('2d').drawImage(full, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]);
  return c.toDataURL('image/png');
}, { url: SRC_URL, crop, healSpecs });

/* Schritt 3: Bildfläche einmessen. Von der Mitte nach außen laufen, bis die
   Helligkeit über die Schwelle springt (= Blende). Median über fünf
   Abtastlinien, damit ein Reflex oder das Logo auf dem Bildschirm nicht zu
   früh abbricht. */
const screen = nums(flags.screen) || await page.evaluate(async ({ url, thr }) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const lum = (x, y) => {
    const i = ((y | 0) * c.width + (x | 0)) * 4;
    return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  };
  const cx = c.width >> 1, cy = c.height >> 1;
  const median = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };
  /* ⚠ Fünf Abtastlinien reichten NICHT: rechts sitzt eine dunkle Gitterblende
     IM Gehäuse, und der Scan lief mitten durch sie hindurch — gemessen kamen
     36 px Blende rechts gegen 220 px links heraus. Jetzt 41 Linien über die
     mittleren 60 % und der Median darüber; einzelne dunkle Einbauten können
     das Ergebnis damit nicht mehr verschieben. */
  const SAMPLES = 41;
  const walk = (fixed, from, to, horiz) => {
    let p = from; const step = to > from ? 1 : -1;
    for (; p !== to; p += step) {
      if ((horiz ? lum(p, fixed) : lum(fixed, p)) > thr) break;
    }
    return p;
  };
  const spread = (n, half) =>
    Array.from({ length: SAMPLES }, (_, i) => n + Math.round((i / (SAMPLES - 1) - 0.5) * 2 * half));
  const rows = spread(cy, Math.round(c.height * 0.3));
  const cols = spread(cx, Math.round(c.width * 0.3));
  const left   = median(rows.map((y) => walk(y, cx, 0, true)));
  const right  = median(rows.map((y) => walk(y, cx, c.width - 1, true)));
  const top    = median(cols.map((x) => walk(x, cy, 0, false)));
  const bottom = median(cols.map((x) => walk(x, cy, c.height - 1, false)));
  return [left + 1, top + 1, right - left - 1, bottom - top - 1];
}, { url: cropped, thr: Number(flags.thr || 62) });

/* Schritt 4: Ausgabe in mehreren Breiten. Die Seite liefert Bilder als WebP;
   das PNG bleibt als verlustfreie Zwischenstufe für spätere Zuschnitte. */
const widths = (nums(flags.widths) || [1600, 2400]).sort((a, b) => a - b);
const stem = basename(src, extname(src)).replace(/[-_]?(src|source|quelle)$/i, '') || 'chassis';
const written = [];
for (const w of widths) {
  const out = await page.evaluate(async ({ url, w }) => {
    const img = new Image(); img.src = url; await img.decode();
    const h = Math.round((w / img.naturalWidth) * img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    return { url: c.toDataURL('image/webp', 0.9), h };
  }, { url: cropped, w });
  const buf = Buffer.from(out.url.split(',')[1], 'base64');
  const file = join(outDir, `${stem}-${w}.webp`);
  writeFileSync(file, buf);
  written.push({ file, w, h: out.h, kb: buf.length / 1024 });
}
await browser.close();

const [sx, sy, sw, sh] = screen;
const pct = (n, d) => ((n / d) * 100).toFixed(3);
console.log(`
Zuschnitt   : ${crop[2]} × ${crop[3]}   (aus ${crop[0]},${crop[1]})
Bildfläche  : ${sx},${sy}  ${sw} × ${sh}${flags.screen ? '  (vorgegeben)' : `  (erkannt, Schwelle ${flags.thr || 62})`}
Übermalt    : ${healSpecs.length} Stelle(n)

Geschrieben:${written.map((x) => `
  ${basename(x.file)}  ${x.w} × ${x.h}  —  ${x.kb.toFixed(0)} KB`).join('')}

CSS — Chassis mit festem Seitenverhältnis, Bildfläche als Prozentkasten:

  .chassis {
    position: relative;
    aspect-ratio: ${crop[2]} / ${crop[3]};
    background: url('${stem}-${widths[0]}.webp') center/100% 100% no-repeat;
  }
  .chassis__screen {
    position: absolute;
    left:   ${pct(sx, crop[2])}%;
    top:    ${pct(sy, crop[3])}%;
    width:  ${pct(sw, crop[2])}%;
    height: ${pct(sh, crop[3])}%;
  }

Bei 1280 px Fensterbreite: Chassis ${Math.round(1280 * crop[3] / crop[2])} px hoch,
Bildfläche ${Math.round(1280 * sw / crop[2])} × ${Math.round(1280 * sw / crop[2] * (sh / sw))} px.
`);
