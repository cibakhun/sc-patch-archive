/* Wie viele Spalten zeigt ein Werkzeug-Raster je Fenster — und steht der
   Titel auf der Kante des Rasters? Gegen dist/.
   Aufruf: node .planning/sketches/tools/mess-spalten.mjs [vp,vp,…]            */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = join(resolve(process.cwd()), 'dist');
const CHROME = join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  let b = null;
  try { b = await readFile(f); } catch { b = null; }
  if (!b) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(b);
});
await new Promise((r) => srv.listen(4253, '127.0.0.1', r));

const ZIELE = [
  ['/item-finder.html', '.uif-results', '.hero__in h1'],
  ['/de/item-finder.html', '.uif-results', '.hero__in h1'],
  ['/topics/crafting.html', '.cdb-grid', '.hero__in h1'],
  ['/missionen.html', '.mx__grid', '.mx__h1'],
  ['/de/missionen.html', '.mx__grid', '.mx__h1'],
  ['/schiffe.html', '.sdb__fleet', '.sdb__hero h1'],
  ['/de/schiffe.html', '.sdb__fleet', '.sdb__hero h1'],
];
const VPS = (process.argv[2] || '1280x720,1920x945,2048x1015,2560x1305,3440x1305,3840x2025,5120x1305').split(',');
const browser = await chromium.launch({ executablePath: CHROME });
for (const vp of VPS) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const zeilen = [];
  for (const [url, raster, titel] of ZIELE) {
    await page.goto('http://127.0.0.1:4253' + url, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const r = await page.evaluate(([raster, titel]) => {
      const g = document.querySelector(raster);
      if (!g) return null;
      const cols = getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter((x) => /px$/.test(x));
      const gr = g.getBoundingClientRect();
      const t = document.querySelector(titel);
      const tr = t ? t.getBoundingClientRect() : null;
      const bar = document.querySelector('.snav__left, .dp-bar');
      return { n: cols.length, w: Math.round(cols.length ? parseFloat(cols[0]) : 0), gl: Math.round(gr.left), gw: Math.round(gr.width), tl: tr ? Math.round(tr.left) : null, bl: bar ? Math.round(bar.getBoundingClientRect().left) : null };
    }, [raster, titel]);
    zeilen.push(r ? `${url.padEnd(22)} ${String(r.n).padStart(2)} Sp. à ${r.w}px · Raster ${r.gl}+${r.gw} · Titel x=${r.tl} · Leiste x=${r.bl}` : `${url} — Raster fehlt`);
  }
  console.log(`\n[${vp}]\n  ` + zeilen.join('\n  '));
  await ctx.close();
}
await browser.close(); srv.close();
