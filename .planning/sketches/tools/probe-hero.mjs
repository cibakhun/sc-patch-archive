/* "Werkzeug, keine Leinwand": wie viel vom Fenster ist weg, bevor die
   Bedienung anfaengt?  node …/probe-hero.mjs 1280x720 1181x560 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
const DIST = join(resolve(process.cwd()), 'dist');
const CHROME = join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  if (!existsSync(f) && existsSync(join(f, 'index.html'))) f = join(f, 'index.html');
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('x'); }
});
await new Promise((r) => srv.listen(4197, '127.0.0.1', r));

const PAGES = ['/missionen.html', '/schiffe.html', '/item-finder.html', '/topics/crafting.html',
  '/refinery.html', '/precision-jump.html', '/fracturing.html', '/evolution.html', '/archiv.html',
  '/armor-sets.html', '/downloads.html', '/topics/mining.html'];

const browser = await chromium.launch({ executablePath: CHROME });
for (const vp of process.argv.slice(2)) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  console.log('\n=== ' + vp);
  for (const url of PAGES) {
    await page.goto('http://127.0.0.1:4197' + url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const vh = document.documentElement.clientHeight;
      const CTRL = 'main input:not([type=hidden]), main select, main button, main [role="button"], main a.tool, main article, main .cbp, main .mc, main .fcard';
      let firstTop = null, what = '';
      for (const el of document.querySelectorAll(CTRL)) {
        const b = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        if (b.height === 0 || st.visibility === 'hidden' || st.display === 'none') continue;
        if (el.closest('.tool-help, details')) continue;
        firstTop = Math.round(b.top);
        what = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '');
        break;
      }
      return { vh, firstTop, what };
    });
    const pct = r.firstTop == null ? '—' : Math.round((r.firstTop / r.vh) * 100) + '%';
    console.log(`  ${String(r.firstTop).padStart(5)}px (${pct.padStart(4)}) ${url}  -> ${r.what}`);
  }
  await ctx.close();
}
await browser.close(); srv.close();
