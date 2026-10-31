import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
const DIST = join(resolve(process.cwd()), 'dist');
const CHROME = join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  /* ⚠ ERST lesen, DANN Header: umgekehrt stirbt der Prozess an
     ERR_HTTP_HEADERS_SENT, sobald eine Datei fehlt — mitten im Messlauf. */
  let b;
  try { b = await readFile(f); } catch { res.writeHead(404); res.end('x'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(b);
});
await new Promise((r) => srv.listen(4279, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
for (const vp of ['844x390', '932x430', '390x844', '1280x720']) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 932, isMobile: w <= 932 });
  const pg = await ctx.newPage();
  await pg.goto('http://127.0.0.1:4279/schiffe/aegs-avenger-stalker.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  const r = await pg.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return 'fehlt'; const r = e.getBoundingClientRect(); return Math.round(r.height) + 'px ab ' + Math.round(r.top); };
    const w = document.querySelector('.holo__wrap');
    return { holo: q('.holo'), wrap: q('.holo__wrap'), rail: q('.holo__rail'), h1: q('h1'),
             wrapCSS: w ? getComputedStyle(w).height : '—', mt: getComputedStyle(document.querySelector('.holo')).marginTop };
  });
  console.log(vp.padEnd(9) + ' .holo ' + r.holo.padEnd(16) + ' | wrap ' + r.wrap.padEnd(16) + ' (' + r.wrapCSS + ') | rail ' + r.rail.padEnd(14) + ' | h1 ' + r.h1 + ' | .holo margin-top ' + r.mt);
  await ctx.close();
}
await b.close(); srv.close();
