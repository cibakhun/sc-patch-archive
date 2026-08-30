/* Aufnahmen aus dist/.  Aufruf:
   node .planning/sketches/tools/shoot.mjs "/index.html@390x844" "/archiv.html@390x844:full"
   Suffix :full = ganze Seite (sonst nur der erste Bildschirm). */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = join(resolve(process.cwd()), 'dist');
const OUT = join(resolve(process.cwd()), '.planning/sketches/tools/out/shots');
const CHROME = [
  `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium_headless_shell-1228\\chrome-headless-shell-win64\\chrome-headless-shell.exe`,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };

const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  if (!existsSync(f) && existsSync(join(f, 'index.html'))) f = join(f, 'index.html');
  try {
    const b = await readFile(f);
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('404'); }
});
const PORT = 4191;
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
for (const spec of process.argv.slice(2)) {
  const full = spec.endsWith(':full');
  const s = full ? spec.slice(0, -5) : spec;
  const [url, vp] = s.split('@');
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}${url}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(600);
  /* Nach unten laufen: `.reveal` steht bis zum ersten IntersectionObserver-
     Durchlauf auf opacity:0 — eine Vollseiten-Aufnahme zeigt sonst eine
     leere Seite und behauptet einen Fehler, den es nicht gibt. */
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += Math.floor(window.innerHeight * 0.8)) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
  if (process.env.SCROLL_TO) {
    await page.evaluate((y) => window.scrollTo(0, Number(y)), process.env.SCROLL_TO);
    await page.waitForTimeout(400);
  }
  const name = (url.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root') + `_${vp}${full ? '_full' : ''}.png`;
  await page.screenshot({ path: join(OUT, name), fullPage: full });
  console.log('  ' + join(OUT, name));
  await ctx.close();
}
await browser.close();
srv.close();
