/**
 * cut-chassis-keyed.mjs — 9-Slice-Rahmen aus einer FREIGESTELLTEN Vorlage.
 *
 * WARUM EIN ZWEITES WERKZEUG: Die erste Vorlage stand in einer beleuchteten
 * Szene. Die Außenkontur des Geräts musste dort aus Helligkeitsprofilen
 * geschätzt werden — und genau daran ist es viermal gescheitert: der Schnitt
 * lag rechts 16 px IM Gerät, die abgerollte Kante fehlte, und das las sich als
 * glatter Schnitt („da wurde einfach abrupt abgeschnitten").
 *
 * Die neue Vorlage steht auf WEISS. Damit kommt die Silhouette aus der
 * Freistellung statt aus einer Schätzung: alles, was hell genug ist, wird
 * durchsichtig, und der Beschnitt ergibt sich aus dem Alpha-Rechteck. Ein
 * Schnitt ins Gerät ist dadurch baulich ausgeschlossen.
 *
 * Was das Skript tut:
 *   1. stellt den weißen Hintergrund frei (weiche Schwelle, damit an den
 *      Kanten kein heller Saum stehen bleibt),
 *   2. schneidet auf das Alpha-Rechteck zu — plus optional den Tragegriff weg,
 *   3. misst die Bildfläche ein (die große dunkle Fläche in der Mitte),
 *   4. zieht NUR die waagerechten Balken glatt (die Holme behalten ihre
 *      Zeichnung — sie werden kaum gestreckt, siehe cut-chassis-9slice.mjs),
 *   5. stanzt die Bildfläche transparent aus,
 *   6. schreibt WebP mit Alpha und druckt die `border-image`-Werte.
 *
 * Aufruf:
 *   node .planning/sketches/tools/cut-chassis-keyed.mjs <quelle> <zielordner> \
 *        [--griff <y>] [--schwelle 232] [--info]
 *
 *   --griff <y>   alles OBERHALB dieser Zeile abschneiden (Tragegriff weg).
 *                 Ohne Angabe bleibt das Gerät vollständig.
 *   --schwelle    ab welcher Helligkeit der Hintergrund als weiß gilt (232).
 *   --info        nur messen, nichts schreiben.
 */
import { chromium } from 'playwright-core';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const MIME = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp' };
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
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) { console.error('Kein Chrome gefunden — CHROME_PATH setzen.'); process.exit(1); }

const argv = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    if (k === 'info') flags.info = true; else flags[k] = argv[++i];
  } else pos.push(argv[i]);
}
const [src, outDir] = pos;
if (!src) { console.error('Aufruf: node cut-chassis-keyed.mjs <quelle> <zielordner> …'); process.exit(1); }
/* Vier durch Komma getrennte Zahlen oder nichts. */
const nums = (s) => {
  if (!s) return null;
  const a = s.split(',').map((n) => Math.round(Number(n.trim())));
  return a.length === 4 && a.every(Number.isFinite) ? a : null;
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();

const res = await page.evaluate(async ({ url, thr, griff }) => {
  const img = new Image(); img.src = url; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, W, H);
  const d = im.data;

  /* ---- 1) Weiß freistellen -------------------------------------------------
     Weiche Schwelle: ab `thr` voll durchsichtig, 26 Stufen darunter linear
     ausblenden. Eine harte Schwelle liesse an den Kanten einen hellen Saum
     stehen — genau der wuerde spaeter wieder wie ein Schnitt aussehen. */
  const FEATHER = 26;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    if (lum >= thr) { d[i + 3] = 0; continue; }
    if (lum > thr - FEATHER) d[i + 3] = Math.round(255 * (thr - lum) / FEATHER);
  }
  g.putImageData(im, 0, 0);

  /* ---- 2) Auf das Alpha-Rechteck zuschneiden -------------------------------
     DAS ist der Punkt: der Beschnitt kommt aus der Freistellung, nicht aus
     einer Schaetzung. Ein Schnitt ins Geraet ist damit ausgeschlossen. */
  const A = (x, y) => d[(y * W + x) * 4 + 3];
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (A(x, y) > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (griff > 0 && griff > y0) y0 = griff;      // Tragegriff abschneiden
  const CW = x1 - x0 + 1, CH = y1 - y0 + 1;

  const cut = document.createElement('canvas');
  cut.width = CW; cut.height = CH;
  const cg = cut.getContext('2d', { willReadFrequently: true });
  cg.drawImage(c, x0, y0, CW, CH, 0, 0, CW, CH);

  /* ---- 3) Bildflaeche einmessen -------------------------------------------
     Die grosse dunkle Flaeche in der Mitte. Von der Mitte nach aussen laufen,
     bis es hell wird; Median ueber 41 Linien, damit dunkle Einbauten IM Rahmen
     (Gitterblenden) das Ergebnis nicht verschieben. */
  const cd = cg.getImageData(0, 0, CW, CH).data;
  const L = (x, y) => {
    const i = ((y | 0) * CW + (x | 0)) * 4;
    return cd[i + 3] < 40 ? 255 : 0.2126 * cd[i] + 0.7152 * cd[i + 1] + 0.0722 * cd[i + 2];
  };
  const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
  const cx = CW >> 1, cy = CH >> 1;
  const spread = (n, half) => Array.from({ length: 41 }, (_, i) =>
    n + Math.round((i / 40 - 0.5) * 2 * half));
  const walk = (fixed, from, to, horiz) => {
    let p = from; const step = to > from ? 1 : -1;
    for (; p !== to; p += step) if ((horiz ? L(p, fixed) : L(fixed, p)) > 62) break;
    return p;
  };
  const rows = spread(cy, Math.round(CH * 0.3));
  const cols = spread(cx, Math.round(CW * 0.3));
  const al = med(rows.map((y) => walk(y, cx, 0, true))) + 1;
  const ar = med(rows.map((y) => walk(y, cx, CW - 1, true))) - 1;
  const at = med(cols.map((x) => walk(x, cy, 0, false))) + 1;
  const ab = med(cols.map((x) => walk(x, cy, CH - 1, false))) - 1;

  return {
    quelle: [W, H], crop: [x0, y0, CW, CH],
    apt: [al, at, ar - al + 1, ab - at + 1],
    png: cut.toDataURL('image/png'),
  };
}, { url: toDataUrl(src), thr: Number(flags.schwelle || 232), griff: Number(flags.griff || 0) });

const [CW, CH] = [res.crop[2], res.crop[3]];
const [ax, ay, aw, ah] = res.apt;
const INSET = { left: ax, top: ay, right: CW - (ax + aw), bottom: CH - (ay + ah) };

console.log(`
Quelle      : ${res.quelle[0]} x ${res.quelle[1]}
Freigestellt: Zuschnitt ${res.crop[0]},${res.crop[1]}  ${CW} x ${CH}
Bildflaeche : ${ax},${ay}  ${aw} x ${ah}
Blende      : ${INSET.left} / ${INSET.top} / ${INSET.right} / ${INSET.bottom}  (l/o/r/u)`);

if (flags.info) { await browser.close(); process.exit(0); }
if (!outDir) { console.error('Zielordner fehlt.'); await browser.close(); process.exit(1); }
mkdirSync(outDir, { recursive: true });

/* ---- 4-6) Balken glattziehen, Bildflaeche ausstanzen, schreiben ----------- */
const out = await page.evaluate(async ({ png, CW, CH, ax, ay, aw, ah, label, plug }) => {
  const img = new Image(); img.src = png; await img.decode();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);

  /* ---- Steckerbuchse VOR dem Glattziehen herausschneiden -------------------
     Sie sitzt mittig im Sockel und wird gleich mit uebermalt; als eigenes,
     mittig gesetztes Stueck kommt sie danach in fester Groesse wieder obenauf.
     Mittig um die Mitte der BILDFLAECHE, nicht um die Bildmitte — das Geraet
     ist nicht zwingend mittig im Bild. */
  const pw = plug ? plug[2] : Math.round(aw * 0.36);
  const px = plug ? plug[0] : Math.round(ax + aw / 2 - pw / 2);
  const py = plug ? plug[1] : ay + ah;
  const ph = plug ? plug[3] : CH - (ay + ah);
  const pc = document.createElement('canvas');
  pc.width = pw; pc.height = ph;
  pc.getContext('2d').drawImage(c, px, py, pw, ph, 0, 0, pw, ph);
  const plugUrl = pc.toDataURL('image/webp', 0.92);

  /* ---- Aufgedruckte Beschriftung uebermalen -------------------------------
     ⚠ Sie ragt ueber die Streckgrenze in die ECKKACHEL, und die bleibt sonst
     unberuehrt — genau daran ist die Seriennummer der ersten Vorlage zweimal
     stehengeblieben. Quelle ist eine Blechspur LINKS davon, gestreckt. */
  if (label) {
    const [lx, ly, lw, lh] = label;
    const patch = document.createElement('canvas');
    patch.width = lw; patch.height = lh;
    const pg2 = patch.getContext('2d');
    pg2.imageSmoothingEnabled = false;
    pg2.drawImage(c, lx - 12, ly, 1, lh, 0, 0, lw, lh);
    const gr = pg2.createLinearGradient(0, 0, lw, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.06, 'rgba(0,0,0,1)');
    gr.addColorStop(0.94, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    pg2.globalCompositeOperation = 'destination-in';
    pg2.fillStyle = gr; pg2.fillRect(0, 0, lw, lh);
    g.drawImage(patch, lx, ly);
  }

  /* NUR die waagerechten Balken: sie werden stark gestaucht (bei schmalen
     Fenstern auf rund die Haelfte). Die HOLME bleiben unberuehrt — sie werden
     kaum gestreckt und wuerden ihre Zeichnung verlieren. */
  const bars = [
    { s: [Math.round(ax + aw * 0.06), 0, 1, ay], d: [ax, 0, aw, ay] },
    { s: [Math.round(ax + aw * 0.10), ay + ah, 1, CH - (ay + ah)], d: [ax, ay + ah, aw, CH - (ay + ah)] },
  ];
  for (const { s, d } of bars) {
    const patch = document.createElement('canvas');
    patch.width = d[2]; patch.height = d[3];
    const pg = patch.getContext('2d');
    pg.imageSmoothingEnabled = false;
    pg.drawImage(c, s[0], s[1], s[2], s[3], 0, 0, d[2], d[3]);
    const grad = pg.createLinearGradient(0, 0, d[2], 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.03, 'rgba(0,0,0,1)');
    grad.addColorStop(0.97, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    pg.globalCompositeOperation = 'destination-in';
    pg.fillStyle = grad; pg.fillRect(0, 0, d[2], d[3]);
    g.drawImage(patch, d[0], d[1]);
  }

  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.roundRect(ax, ay, aw, ah, 16);
  g.fill();
  return { frame: c.toDataURL('image/webp', 0.92), plug: plugUrl, plugMasse: [pw, ph] };
}, {
  png: res.png, CW, CH, ax, ay, aw, ah,
  label: nums(flags.label),
  plug: nums(flags.plug),
});

await browser.close();
const buf = Buffer.from(out.frame.split(',')[1], 'base64');
const file = join(outDir, 'chassis-frame.webp');
writeFileSync(file, buf);
const pbuf = Buffer.from(out.plug.split(',')[1], 'base64');
writeFileSync(join(outDir, 'chassis-plug.webp'), pbuf);

const r = (n) => (n / INSET.left).toFixed(3);
console.log(`
Geschrieben : ${file}  ${(buf.length / 1024).toFixed(0)} KB
              chassis-plug.webp  ${(pbuf.length/1024).toFixed(0)} KB  (${out.plugMasse[0]}x${out.plugMasse[1]})

CSS:
  border-image-slice: ${INSET.top} ${INSET.right} ${INSET.bottom} ${INSET.left} fill;
  border-image-width: calc(var(--rahmen)*${r(INSET.top)}) calc(var(--rahmen)*${r(INSET.right)}) calc(var(--rahmen)*${r(INSET.bottom)}) var(--rahmen);
  border-width:       calc(var(--rahmen)*${r(INSET.top)}) calc(var(--rahmen)*${r(INSET.right)}) calc(var(--rahmen)*${r(INSET.bottom)}) var(--rahmen);

⚠ 'fill' ist Pflicht. ⚠ border-image-width UND border-width muessen gleich sein.
`);
