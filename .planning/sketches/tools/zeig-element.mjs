/* Ausschnitt um ein bestimmtes Element, dreifach vergroessert. Fuer die
   Gegenprobe: bricht der Text dort WIRKLICH mitten im Wort? */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
const DIST = join(resolve(process.cwd()), 'dist');
const OUT = join(resolve(process.cwd()), '.planning/sketches/tools/out/shots');
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
await new Promise((r) => srv.listen(4296, '127.0.0.1', r));
await mkdir(OUT, { recursive: true });
const [url, text] = [process.argv[2], process.argv[3]];
const [w, h] = (process.env.VP || '320x568').split('x').map(Number);
const b = await chromium.launch({ executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: true, deviceScaleFactor: 3 });
const pg = await ctx.newPage();
await pg.goto('http://127.0.0.1:4296' + url, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1000);
/* ⚠ Erst scrollen, DANN messen — in einem Zug gelesen liefert
   getBoundingClientRect noch die alte Lage, und der Ausschnitt liegt
   ausserhalb des Bildes. */
const gefunden = await pg.evaluate((t) => {
  const el = [...document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div,b')]
    .filter((e) => e.textContent.trim().startsWith(t) && e.children.length === 0).pop();
  if (!el) return false;
  el.setAttribute('data-zeig', '1');
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  return true;
}, text);
await pg.waitForTimeout(700);
const box = !gefunden ? null : await pg.evaluate(() => {
  const el = document.querySelector('[data-zeig]');
  const r = el.getBoundingClientRect();
  return { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12),
           width: Math.min(innerWidth - Math.max(0, r.x - 12), r.width + 24),
           height: Math.min(innerHeight - Math.max(0, r.y - 12), r.height + 24) };
});
if (!box) { console.log('  Text nicht gefunden: ' + text); }
else {
  await pg.waitForTimeout(400);
  const nm = 'zoom-' + text.replace(/[^a-z0-9]+/gi, '-').slice(0, 30) + '.png';
  await pg.screenshot({ path: join(OUT, nm), clip: box });
  console.log('  ' + nm + '   ' + JSON.stringify(box));
}
await b.close(); srv.close();
