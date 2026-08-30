/* Welcher TEXT ist abgeschnitten? Sucht Elemente, deren Inhalt breiter ist
   als ihr Kasten — getrennt nach „mit Ellipse" (gewollt gekuerzt) und „hart
   abgeschnitten" (kein Hinweis, dass da mehr steht). Zusaetzlich: Text, der
   in einem Kasten mit fester Hoehe senkrecht abgeschnitten wird.
   MSYS_NO_PATHCONV=1 node …/probe-abgeschnitten.mjs "/schiffe.html@390x844" */
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
await new Promise((r) => srv.listen(4227, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
const [url, vp] = process.argv[2].split('@');
const [w, h] = vp.split('x').map(Number);
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4227' + url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1400);
const out = await page.evaluate(() => {
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const hart = {}, mitEllipse = {}, senkrecht = {};
  const zaehl = (bag, key, info) => { (bag[key] ||= { n: 0, max: 0, bsp: '' }); bag[key].n++; bag[key].max = Math.max(bag[key].max, info.cut); if (!bag[key].bsp) bag[key].bsp = info.txt; };
  for (const el of document.querySelectorAll('body *')) {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) continue;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const eigenerText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!eigenerText) continue;
    const txt = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 34);
    /* waagerecht */
    if (/(hidden|clip)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 1) {
      const info = { cut: el.scrollWidth - el.clientWidth, txt };
      if (st.textOverflow === 'ellipsis') zaehl(mitEllipse, nm(el), info);
      else zaehl(hart, nm(el), info);
    }
    /* senkrecht: fester Kasten, mehr Text als Platz, keine Zeilenklammer */
    if (/(hidden|clip)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 2 && st.webkitLineClamp === 'none')
      zaehl(senkrecht, nm(el), { cut: el.scrollHeight - el.clientHeight, txt });
  }
  return { hart, mitEllipse, senkrecht };
});
const zeig = (titel, bag) => {
  const e = Object.entries(bag).sort((a, b) => b[1].max - a[1].max);
  console.log(`\n${titel}: ${e.length} Muster`);
  e.slice(0, 14).forEach(([k, v]) => console.log(`  -${v.max}px  ${v.n}x  ${k}  «${v.bsp}»`));
};
zeig('HART ABGESCHNITTEN (kein Hinweis)', out.hart);
zeig('mit Ellipse (gewollt gekuerzt)', out.mitEllipse);
zeig('SENKRECHT abgeschnitten', out.senkrecht);
await browser.close(); srv.close();
