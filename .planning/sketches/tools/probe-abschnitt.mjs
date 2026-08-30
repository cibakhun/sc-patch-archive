/* Was ragt unter die Falz? Meldet jedes Element, dessen Unterkante unter der
   von <main> liegt, MIT Vorfahrenkette samt overflow-y je Glied — nur so
   ist zu sehen, ob es wirklich abgeschnitten ist oder bloss in einem
   Bildlaufkasten steckt.
   MSYS_NO_PATHCONV=1 node .planning/sketches/tools/probe-abschnitt.mjs "/topics/mining.html@1280x720" */
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
await new Promise((r) => srv.listen(4196, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
const [url, vp] = process.argv[2].split('@');
const [w, h] = vp.split('x').map(Number);
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4196' + url, { waitUntil: 'load' });
await page.waitForTimeout(600);
const out = await page.evaluate(() => {
  const de = document.documentElement, cs = (el) => getComputedStyle(el);
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const main = document.querySelector('main');
  const mb = main.getBoundingClientRect().bottom;
  const over = [];
  for (const el of main.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    if (r.bottom > mb + 1) {
      const chain = []; let p = el;
      while (p && p.tagName !== 'MAIN') { chain.unshift(nm(p) + '[' + cs(p).overflowY + ',' + Math.round(p.getBoundingClientRect().height) + ']'); p = p.parentElement; }
      over.push({ n: nm(el), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), ovY: cs(el).overflowY, chain: chain.join(' > ') });
    }
  }
  const deep = over.filter((o, i) => true);
  return { vh: de.clientHeight, mainBottom: Math.round(mb), count: over.length, over: over.filter(o=>!/wb__wall/.test(o.n)).slice(0, 6) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close();
