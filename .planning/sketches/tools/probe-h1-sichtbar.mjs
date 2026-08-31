/* IST DIE UEBERSCHRIFT BEIM LADEN SICHTBAR? „Werkzeug, keine Leinwand":
   wer auf einer Detailseite landet, muss ohne Scrollen sehen, WAS er
   anschaut. Gemessen wird die Unterkante der h1 gegen die Fensterhoehe.

   VP_LIST=844x390,932x430,320x568 node …/probe-h1-sichtbar.mjs "/a.html" … */
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
const PORT = Number(process.env.PORT_NR || 4277);
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
const PAGES = process.argv.slice(2).length ? process.argv.slice(2)
  : JSON.parse(await readFile(join(resolve(process.cwd()), '.planning/sketches/tools/out', process.env.PAGES_FILE || 'pages.json'), 'utf8'));
const b = await chromium.launch({ executablePath: CHROME });
let schlecht = 0, gemessen = 0;
for (const vp of (process.env.VP_LIST || '844x390').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: true, isMobile: w <= 932 });
  const pg = await ctx.newPage();
  pg.on('pageerror', () => {});
  for (const u of PAGES) {
    try {
      await pg.goto('http://127.0.0.1:' + PORT + u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pg.waitForTimeout(600);
      const r = await pg.evaluate(() => {
        const h1 = document.querySelector('h1');
        if (!h1) return null;
        if (h1.checkVisibility && !h1.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
        const r = h1.getBoundingClientRect();
        return { oben: Math.round(r.top), unten: Math.round(r.bottom), vh: window.innerHeight, txt: h1.textContent.trim().slice(0, 30) };
      });
      gemessen++;
      if (!r) continue;
      /* Ganz sichtbar heisst: Unterkante ueber der Fensterkante. */
      if (r.unten <= r.vh) continue;
      schlecht++;
      const wie = r.oben >= r.vh ? 'GAR NICHT' : 'angeschnitten (' + Math.round(((r.vh - r.oben) / (r.unten - r.oben)) * 100) + ' % zu sehen)';
      console.log('[' + vp + '] ' + u + '\n        h1 „' + r.txt + '"  ' + r.oben + '–' + r.unten + ' bei vh ' + r.vh + '  → ' + wie);
    } catch { /* uebersprungen */ }
  }
  await ctx.close();
}
await b.close(); srv.close();
console.log('\nMessungen: ' + gemessen + '   Seiten mit angeschnittener h1: ' + schlecht);
