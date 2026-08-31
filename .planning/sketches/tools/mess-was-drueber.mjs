/* Was steht ueber einem BELIEBIGEN Element? Wie mess-stapel.mjs, aber das
   Ziel wird per Waehler uebergeben — fuer die Frage „warum liegt die erste
   Bedienung so tief". */
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
  let b;
  try { b = await readFile(f); } catch { res.writeHead(404); res.end('x'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(b);
});
await new Promise((r) => srv.listen(4326, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
const ziel = process.env.ZIEL || 'h1';
for (const vp of (process.env.VP_LIST || '1181x560').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  for (const u of process.argv.slice(2)) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
    const pg = await ctx.newPage();
    await pg.goto('http://127.0.0.1:4326' + u, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1300);
    const r = await pg.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const z = el.getBoundingClientRect();
      const out = [];
      for (const e of document.querySelectorAll('body *')) {
        if (e.contains(el)) continue;
        if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
        const r = e.getBoundingClientRect();
        if (r.height < 14 || r.width < 60) continue;
        if (r.right <= 0 || r.left >= window.innerWidth) continue;   /* ausgelagert */
        if (r.bottom > z.top + 4) continue;
        if (r.top < -60) continue;
        const nm = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        out.push({ nm, oben: Math.round(r.top), h: Math.round(r.height) });
      }
      out.sort((a, b) => b.h - a.h);
      return { ziel: Math.round(z.top), vh: window.innerHeight, out: out.slice(0, 8) };
    }, ziel);
    console.log('[' + vp + '] ' + u + '   „' + ziel + '" beginnt bei ' + (r ? r.ziel : '?') + ' (Fenster ' + (r ? r.vh : h) + ')');
    if (r) for (const x of r.out) console.log('      ' + String(x.h).padStart(4) + 'px  ab ' + String(x.oben).padStart(4) + '   ' + x.nm);
    await ctx.close();
  }
}
await b.close(); srv.close();
