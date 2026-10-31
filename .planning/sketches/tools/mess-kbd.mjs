/* Welche Tastenhinweise sind auf einem TOUCHGERAET sichtbar? Sie sind dort
   ohne Funktion und kosten Platz — auf der Startseite drueckten „Ctrl"/„K"
   den Platzhalter der Suche auf „Search i…" zusammen. */
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
await new Promise((r) => srv.listen(4275, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
/* isMobile setzt pointer:coarse + hover:none — genau die Abfrage, um die es geht. */
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
for (const u of process.argv.slice(2)) {
  await pg.goto('http://127.0.0.1:4275' + u, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => {
    const grob = matchMedia('(hover: none) and (pointer: coarse)').matches;
    const out = [];
    for (const k of document.querySelectorAll('kbd')) {
      if (k.checkVisibility && !k.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = k.getBoundingClientRect();
      if (r.width < 2) continue;
      let el = k, pfad = [];
      for (let i = 0; i < 3 && el; i++, el = el.parentElement)
        pfad.unshift(el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''));
      out.push({ txt: k.textContent.trim().slice(0, 10), br: Math.round(r.width), pfad: pfad.join(' > ') });
    }
    return { grob, out };
  });
  console.log('== ' + u + '   (hover:none & pointer:coarse = ' + r.grob + ')');
  if (!r.out.length) console.log('   keine sichtbaren Tastenhinweise');
  for (const x of r.out) console.log('   „' + x.txt + '"  ' + x.br + 'px   ' + x.pfad);
}
await b.close(); srv.close();
