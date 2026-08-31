/* TABFALLE: Landet der Tastaturfokus in einem geschlossenen Off-Canvas?
   Eine per transform weggeschobene Schublade bleibt fokussierbar, wenn sie
   nicht `inert`, `visibility:hidden` oder `display:none` traegt. Der Nutzer
   tabbt dann in Bedienelemente, die er nicht sieht — und ein Screenreader
   liest sie als Teil der Seite vor.

   Gemessen wird ehrlich: TAB druecken und schauen, wo der Fokus landet.  */
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
/* ⚠ Port aus der Umgebung: mit fester Zahl scheitert jeder zweite Lauf an
   EADDRINUSE, solange ein frueherer Server noch haengt — und der Fehler
   sieht aus wie ein Messergebnis von null. */
const PORT = Number(process.env.PORT_NR || 4288);
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
const ZIELE = (process.env.PANELS || '.mx__bar,[data-offcanvas]').split(',');
for (const u of process.argv.slice(2)) {
  for (const vp of (process.env.VP_LIST || '320x568,390x844').split(',')) {
    const [w, h] = vp.split('x').map(Number);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: true, isMobile: true });
    const pg = await ctx.newPage();
    await pg.goto('http://127.0.0.1:'+PORT + u, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1300);
    let drin = 0, ausserhalb = 0, erste = null;
    for (let i = 0; i < 45; i++) {
      await pg.keyboard.press('Tab');
      const r = await pg.evaluate((sel) => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const panel = sel.map((s) => a.closest(s)).find(Boolean);
        const k = a.getBoundingClientRect();
        return { nm: a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + (typeof a.className === 'string' && a.className.trim() ? '.' + a.className.trim().split(/\s+/)[0] : ''),
                 imPanel: !!panel, sichtbar: k.right > 0 && k.left < innerWidth && k.bottom > 0 && k.top < innerHeight,
                 x: Math.round(k.left) };
      }, ZIELE);
      if (!r) continue;
      if (r.imPanel && !r.sichtbar) { drin++; if (!erste) erste = r; } else ausserhalb++;
    }
    const urteil = drin ? 'TABFALLE: ' + drin + ' unsichtbare Ziele (erstes: ' + erste.nm + ' bei x=' + erste.x + ')' : 'sauber';
    console.log('[' + vp + '] ' + u.padEnd(20) + '  ' + ausserhalb + ' sichtbare Stationen  → ' + urteil);
    await ctx.close();
  }
}
await b.close(); srv.close();
