/* Was steht ueber der h1? Jedes Element des Weges dorthin mit seiner Hoehe —
   damit die Reparatur den GROESSTEN Posten trifft und nicht den erstbesten. */
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
await new Promise((r) => srv.listen(4278, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
const [w, h] = (process.env.VP || '844x390').split('x').map(Number);
const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
for (const u of process.argv.slice(2)) {
  await pg.goto('http://127.0.0.1:4278' + u, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  const r = await pg.evaluate(() => {
    const h1 = document.querySelector('h1');
    if (!h1) return null;
    const ziel = h1.getBoundingClientRect();
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.contains(h1)) continue;
      if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 12 || r.width < 40) continue;
      if (r.bottom > ziel.top + 4) continue;          /* nur was DARUEBER endet */
      if (r.top < -50) continue;
      const st = getComputedStyle(el);
      const nm = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      out.push({ nm, oben: Math.round(r.top), h: Math.round(r.height), pos: st.position, wrap: st.flexWrap });
    }
    out.sort((a, b) => b.h - a.h);
    return { h1: { oben: Math.round(ziel.top), h: Math.round(ziel.height) }, vh: window.innerHeight, out: out.slice(0, 12) };
  });
  console.log('== ' + u + '   Fenster ' + w + 'x' + h);
  if (!r) { console.log('   keine h1'); continue; }
  console.log('   h1 beginnt bei ' + r.h1.oben + ', hoch ' + r.h1.h + '  (Fenster ' + r.vh + ')');
  console.log('   groesste Posten darueber:');
  for (const x of r.out) console.log('      ' + String(x.h).padStart(4) + 'px  ab ' + String(x.oben).padStart(4) + '  ' + x.pos.padEnd(8) + ' wrap=' + x.wrap.padEnd(8) + ' ' + x.nm);
}
await b.close(); srv.close();
