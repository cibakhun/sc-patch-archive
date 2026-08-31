/* Faengt die geschlossene Filter-Schublade Klicks ab? Eine per transform
   weggeschobene Schublade bleibt im DOM und behaelt ihre Groesse; wenn sie
   dabei pointer-events erbt, liegt ein unsichtbarer Deckel ueber der
   Seite. Gemessen wird mit elementFromPoint an fuenf Stellen. */
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
await new Promise((r) => srv.listen(4287, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
for (const vp of ['320x568', '390x844', '844x390']) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  await pg.goto('http://127.0.0.1:4287/missionen.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1400);
  const r = await pg.evaluate(() => {
    const bar = document.querySelector('.mx__bar');
    const st = getComputedStyle(bar);
    const k = bar.getBoundingClientRect();
    const treffer = [];
    for (const p of [[0.5, 0.3], [0.5, 0.5], [0.5, 0.8], [0.1, 0.5], [0.9, 0.5]]) {
      const el = document.elementFromPoint(innerWidth * p[0], innerHeight * p[1]);
      treffer.push(el ? (el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '')) : 'nichts');
    }
    return { pos: st.position, tf: st.transform, vis: st.visibility, pe: st.pointerEvents, op: st.opacity,
             kasten: [Math.round(k.left), Math.round(k.top), Math.round(k.right), Math.round(k.bottom)], treffer };
  });
  console.log(vp + '  position:' + r.pos + '  transform:' + String(r.tf).slice(0, 30) + '  visibility:' + r.vis + '  pointer-events:' + r.pe + '  opacity:' + r.op);
  console.log('        Kasten ' + JSON.stringify(r.kasten) + '   getroffen: ' + r.treffer.join(', '));
  await ctx.close();
}
await b.close(); srv.close();
