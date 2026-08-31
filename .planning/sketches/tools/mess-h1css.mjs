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
await new Promise((r) => srv.listen(4284, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
for (const vp of (process.env.VP_LIST || '320x568,360x640,390x844,430x932,768x1024,1280x720').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
  const pg = await ctx.newPage();
  await pg.goto('http://127.0.0.1:4284' + (process.env.URL || '/topics/4-0-0-contested-zones.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(600);
  const r = await pg.evaluate(() => {
    const h1 = document.querySelector('h1');
    const t = [...h1.querySelectorAll('*')].find((e) => /Contested|Storm|Threat/.test(e.textContent)) || h1;
    const st = getComputedStyle(t);
    return { cls: t.className || t.tagName, fs: st.fontSize, ow: st.overflowWrap, wb: st.wordBreak, br: Math.round(t.getBoundingClientRect().width), zeilen: t.getClientRects().length };
  });
  console.log(vp.padEnd(10) + ' ' + String(r.cls).padEnd(18) + ' font-size ' + r.fs.padEnd(9) + ' breite ' + String(r.br).padEnd(5) + ' zeilen ' + r.zeilen + '  overflow-wrap:' + r.ow + ' word-break:' + r.wb);
  await ctx.close();
}
await b.close(); srv.close();
