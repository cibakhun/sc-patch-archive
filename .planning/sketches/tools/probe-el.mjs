/* Kastenwerte einzelner Elemente.
   MSYS_NO_PATHCONV=1 node …/probe-el.mjs "/fracturing.html@390x844" ".tool-help,.fc__filters,.fc__pane" */
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
await new Promise((r) => srv.listen(4202, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
const [url, vp] = process.argv[2].split('@');
const [w, h] = vp.split('x').map(Number);
const sels = process.argv[3].split(',');
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4202' + url, { waitUntil: 'load' });
await page.waitForTimeout(900);
const out = await page.evaluate((sels) => {
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const res = [];
  for (const s of sels) {
    for (const el of document.querySelectorAll(s)) {
      const st = getComputedStyle(el), r = el.getBoundingClientRect();
      res.push({
        sel: s, n: nm(el),
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        pos: st.position, z: st.zIndex, ovY: st.overflowY, ovX: st.overflowX,
        cssH: st.height, maxH: st.maxHeight, scrollH: el.scrollHeight,
        parent: el.parentElement ? nm(el.parentElement) + ' [' + getComputedStyle(el.parentElement).overflowY + ',' + Math.round(el.parentElement.getBoundingClientRect().height) + ']' : '-',
      });
    }
  }
  return res;
}, sels);
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close();
