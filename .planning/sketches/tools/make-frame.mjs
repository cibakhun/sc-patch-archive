/**
 * make-frame.mjs — schneidet aus einer gerenderten Gehäuse-Grafik einen
 * 9-Slice-Rahmen für `border-image`.
 *
 * WARUM SO: Ein gefrästes Metallgehäuse laesst sich mit CSS-Verlaeufen oder
 * SVG-Filtern nicht ueberzeugend nachbauen (vorgefuehrt in Skizze 008 und 009).
 * Mit `border-image` bleibt die Grafik das Original, die Ecken behalten ihre
 * feste Groesse und nur die geraden Strecken dazwischen werden gedehnt oder
 * gekachelt. Der Rahmen ist damit aufloesungsunabhaengig einsetzbar, ohne dass
 * die Fraesungen verzerren.
 *
 * Was das Skript tut:
 *   1. laedt die Quellgrafik,
 *   2. schneidet sie auf das Geraet zu (Hintergrund/Anbauten weg),
 *   3. stanzt die Bildflaeche in der Mitte transparent aus,
 *   4. schreibt PNG + WebP,
 *   5. druckt die passenden `border-image-slice`/`-width`-Werte.
 *
 * Es benutzt Chrome ueber playwright-core als Bildwerkzeug — sharp und
 * ImageMagick sind in diesem Projekt nicht vorhanden, Chrome ist es.
 *
 * Aufruf:
 *   node .planning/sketches/tools/make-frame.mjs <quelle> <zielordner> \
 *        [--crop x,y,w,h] [--screen x,y,w,h] [--slice o,r,u,l] [--info]
 *
 *   --info    nur Masse der Quelle ausgeben, nichts schreiben
 *   --crop    Ausschnitt aus der Quelle (Standard: ganze Grafik)
 *   --screen  transparent zu stanzende Bildflaeche, RELATIV zum Ausschnitt
 *   --slice   Schnittbreiten oben,rechts,unten,links (Standard: aus --screen)
 */
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, basename, extname } from 'node:path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.error('Kein Chrome gefunden. Pfad ueber CHROME_PATH setzen.');
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const k = args[i].slice(2);
    if (k === 'info') flags.info = true;
    else flags[k] = args[++i];
  } else pos.push(args[i]);
}
const [src, outDir] = pos;
if (!src) {
  console.error('Aufruf: node make-frame.mjs <quelle> <zielordner> [--info] …');
  process.exit(1);
}
const nums = (s) => (s ? s.split(',').map((n) => Math.round(Number(n.trim()))) : null);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();

const size = await page.evaluate(async (url) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  return { w: img.naturalWidth, h: img.naturalHeight };
}, pathToFileURL(src).href);

console.log(`Quelle: ${basename(src)} — ${size.w} x ${size.h}`);
if (flags.info) { await browser.close(); process.exit(0); }

if (!outDir) { console.error('Zielordner fehlt.'); await browser.close(); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const crop = nums(flags.crop) || [0, 0, size.w, size.h];

/* Bildflaeche automatisch finden statt nach Augenmass setzen: der Bildschirm
   ist die grosse dunkle Flaeche in der Mitte. Von der Mitte aus nach aussen
   laufen, bis die Helligkeit ueber die Schwelle springt (= Blende). Das ist
   robuster als geschaetzte Zahlen und liefert reproduzierbare Schnittkanten. */
async function detectScreen() {
  return page.evaluate(async ({ url, crop, thr }) => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas');
    c.width = crop[2]; c.height = crop[3];
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const lum = (x, y) => {
      const i = ((y | 0) * c.width + (x | 0)) * 4;
      return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    };
    const cx = Math.floor(c.width / 2), cy = Math.floor(c.height / 2);
    /* Median mehrerer Abtastlinien — eine einzelne Zeile kann einen Reflex
       oder ein Symbol auf dem Bildschirm treffen und zu frueh abbrechen. */
    const scan = (fixed, from, to, horiz) => {
      const hits = [];
      for (const off of [-120, -60, 0, 60, 120]) {
        let p = from;
        const step = to > from ? 1 : -1;
        for (; p !== to; p += step) {
          const v = horiz ? lum(p, fixed + off) : lum(fixed + off, p);
          if (v > thr) break;
        }
        hits.push(p);
      }
      hits.sort((a, b) => a - b);
      return hits[2];
    };
    const left   = scan(cy, cx, 0, true);
    const right  = scan(cy, cx, c.width - 1, true);
    const top    = scan(cx, cy, 0, false);
    const bottom = scan(cx, cy, c.height - 1, false);
    return [left + 1, top + 1, right - left - 1, bottom - top - 1];
  }, { url: pathToFileURL(src).href, crop, thr: Number(flags.thr || 62) });
}

const screen = nums(flags.screen) || await detectScreen();
if (!flags.screen) {
  console.log(`Bildflaeche automatisch erkannt: ${screen.join(', ')}  (Schwelle ${flags.thr || 62})`);
}
/* Standard-Schnittbreiten: genau bis an die Bildflaeche heran. Die Ecken des
   9-Slice bleiben dadurch unverzerrt, gedehnt wird nur, was gerade ist. */
const slice = nums(flags.slice) || [
  screen[1],                              // oben
  crop[2] - (screen[0] + screen[2]),      // rechts
  crop[3] - (screen[1] + screen[3]),      // unten
  screen[0],                              // links
];

const dataUrl = await page.evaluate(async ({ url, crop, screen, radius }) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = crop[2]; c.height = crop[3];
  const g = c.getContext('2d');
  g.drawImage(img, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]);
  /* Die Bildflaeche transparent stanzen — mit den gerundeten Ecken des
     Originals, sonst stehen an den Ecken vier harte Zacken. */
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.roundRect(screen[0], screen[1], screen[2], screen[3], radius);
  g.fill();
  return c.toDataURL('image/png');
}, { url: pathToFileURL(src).href, crop, screen, radius: Number(flags.radius || 14) });

const stem = basename(src, extname(src)).replace(/[-_]?(src|source|quelle)$/i, '');
const outPng = join(outDir, `${stem}-frame.png`);
writeFileSync(outPng, Buffer.from(dataUrl.split(',')[1], 'base64'));

/* WebP daneben: die Seite liefert Bilder sonst durchgehend als WebP aus. */
const webp = await page.evaluate(async (u) => {
  const img = new Image(); img.src = u; await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/webp', 0.92);
}, dataUrl);
const outWebp = join(outDir, `${stem}-frame.webp`);
writeFileSync(outWebp, Buffer.from(webp.split(',')[1], 'base64'));

await browser.close();

const [t, r, b, l] = slice;
console.log(`
Geschrieben:
  ${outPng}
  ${outWebp}   (${(Buffer.from(webp.split(',')[1], 'base64').length / 1024).toFixed(0)} KB)

Rahmen  : ${crop[2]} x ${crop[3]}
Bildflaeche: ${screen[0]},${screen[1]} ${screen[2]} x ${screen[3]}

CSS:
  border-image-source: url('${stem}-frame.webp');
  border-image-slice: ${t} ${r} ${b} ${l} fill;
  border-image-width: ${t}px ${r}px ${b}px ${l}px;
  border-style: solid;
  border-color: transparent;

⚠ 'fill' NICHT weglassen: ohne das zeichnet border-image die Mittelkachel gar
   nicht — bei einem ausgestanzten Rahmen faellt das nicht auf, bei einem mit
   Inhalt in der Mitte schon.
⚠ border-image-width in px setzen, nicht in Vielfachen der border-width:
   sonst skaliert der Rahmen mit der Schriftgroesse.
`);
