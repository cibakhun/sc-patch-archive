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
  try { res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end('x'); }
});
await new Promise((r) => srv.listen(4272, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
for (const u of process.argv.slice(2)) {
  console.log('== ' + u);
  for (const vp of [[320, 568], [360, 640], [390, 844], [430, 932]]) {
    const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, colorScheme: 'dark', hasTouch: true });
    const pg = await ctx.newPage();
    await pg.goto('http://127.0.0.1:4272' + u, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(700);
    const r = await pg.evaluate(() => {
      const kopf = document.querySelector('.dp-top,.dp-head,header,.site-head');
      const krume = document.querySelector('.dp-crumb,.dp-top nav,nav[aria-label]');
      const nm = (e) => e ? (typeof e.className === 'string' && e.className.trim() ? e.className.trim().split(/\s+/)[0] : e.tagName.toLowerCase()) : null;
      return { kopf: kopf ? Math.round(kopf.getBoundingClientRect().height) : null, kopfSel: nm(kopf),
               krume: krume ? Math.round(krume.getBoundingClientRect().height) : null, krumeSel: nm(krume),
               navh: getComputedStyle(document.documentElement).getPropertyValue('--nav-h').trim() };
    });
    console.log('   ' + vp[0] + 'x' + vp[1] + '  Kopf ' + r.kopf + 'px (' + r.kopfSel + ')  Krume ' + r.krume + 'px (' + r.krumeSel + ')  --nav-h=' + (r.navh || '—'));
    await ctx.close();
  }
}
await b.close(); srv.close();
