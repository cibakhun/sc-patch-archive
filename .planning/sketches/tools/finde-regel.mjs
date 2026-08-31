/* Welche CSS-Regel bestimmt eine Eigenschaft an einem Element? Statt im
   Quelltext zu raten, wird der Browser gefragt: alle passenden Regeln in
   Kaskadenreihenfolge, samt Herkunfts-Stylesheet. */
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
await new Promise((r) => srv.listen(4290, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
const [url, sel, prop] = [process.argv[2], process.argv[3] || 'h1', process.argv[4] || 'font-size'];
const [w, h] = (process.env.VP || '844x390').split('x').map(Number);
const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
const pg = await ctx.newPage();
await pg.goto('http://127.0.0.1:4290' + url, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(700);
const r = await pg.evaluate(([sel, prop]) => {
  const el = document.querySelector(sel);
  if (!el) return { fehler: 'Element nicht gefunden' };
  const treffer = [];
  for (const sheet of document.styleSheets) {
    let regeln;
    try { regeln = sheet.cssRules; } catch { continue; }
    const gehe = (liste, bedingung) => {
      for (const r of liste) {
        if (r.media && r.cssRules) { gehe(r.cssRules, (bedingung ? bedingung + ' && ' : '') + r.conditionText); continue; }
        if (r.cssRules && r.conditionText) { gehe(r.cssRules, (bedingung ? bedingung + ' && ' : '') + r.conditionText); continue; }
        if (!r.selectorText || !r.style) continue;
        const wert = r.style.getPropertyValue(prop);
        if (!wert) continue;
        try { if (!el.matches(r.selectorText)) continue; } catch { continue; }
        treffer.push({ sel: r.selectorText.slice(0, 70), wert, bedingung: bedingung || '—',
                       quelle: (sheet.href || 'inline').split('/').pop() });
      }
    };
    gehe(regeln, '');
  }
  return { ist: getComputedStyle(el)[prop], treffer };
}, [sel, prop]);
console.log(url + '  ' + sel + '  ' + prop + ' = ' + r.ist + '   (Fenster ' + w + 'x' + h + ')');
for (const t of (r.treffer || [])) console.log('   ' + t.wert.padEnd(34) + ' ' + t.sel.padEnd(30) + ' @' + t.bedingung.slice(0, 40) + '  [' + t.quelle + ']');
if (r.fehler) console.log('   ' + r.fehler);
await b.close(); srv.close();
