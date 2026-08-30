/* Warum ragt es hinaus? Fuer jedes ueberstehende Element wird die
   Mindestbreite (min-content) der Kette darunter gemessen — so faellt auf,
   welches Wort bzw. welche nowrap-Regel den Kasten aufspreizt.
   MSYS_NO_PATHCONV=1 node …/probe-ursache.mjs "/patches/sc-4-7-0.html@320x568" */
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
await new Promise((r) => srv.listen(4209, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
const [url, vp] = process.argv[2].split('@');
const [w, h] = vp.split('x').map(Number);
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4209' + url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
const out = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const vis = (el) => {
    const st = getComputedStyle(el), r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && !el.closest('[hidden],[aria-hidden="true"]');
  };
  const raus = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 2) continue;
    if (getComputedStyle(el).position === 'fixed') continue;
    let clip = false, n = el.parentElement;
    while (n && n !== document.body) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(n).overflowX)) { clip = true; break; } n = n.parentElement; }
    if (clip) continue;
    let tiefer = false;
    for (const c of el.children) { const cr = c.getBoundingClientRect(); if (cr.right > vw + 2 && vis(c)) { tiefer = true; break; } }
    if (tiefer) continue;
    raus.push(el);
  }
  const res = [];
  for (const el of raus.slice(0, 8)) {
    /* min-content der Kette: welches Kind zwingt die Breite? */
    const kette = [];
    let cur = el, tiefe = 0;
    while (cur && tiefe < 6) {
      const st = getComputedStyle(cur);
      const alt = cur.style.width;
      cur.style.width = 'min-content';
      const mc = Math.round(cur.getBoundingClientRect().width);
      cur.style.width = alt;
      kette.push({
        n: nm(cur), minContent: mc, breite: Math.round(cur.getBoundingClientRect().width),
        ws: st.whiteSpace, wrap: st.overflowWrap, minW: st.minWidth,
        txt: (cur.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      });
      /* zum breitesten Kind absteigen */
      let best = null, bw = -1;
      for (const c of cur.children) { if (!vis(c)) continue; const cw = c.getBoundingClientRect().width; if (cw > bw) { bw = cw; best = c; } }
      cur = best; tiefe++;
    }
    const r = el.getBoundingClientRect();
    res.push({ sel: nm(el), ueber: Math.round(r.right - vw), breite: Math.round(r.width), elternBreite: Math.round(el.parentElement.getBoundingClientRect().width), kette });
  }
  return { vw, anzahl: raus.length, res };
});
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close();
