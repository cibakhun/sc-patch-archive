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
        /* ⚠ Gemessen wird in ZEILEN, nicht in Pixeln. Die erste Fassung
           meldete jede Ueberschrift, deren Unterlaenge 3 px ueber die
           Fensterkante ragt — 43 von 44 Seiten, davon 41 voellig lesbar.
           Ein Befund ist erst einer, wenn eine ganze TEXTZEILE fehlt. */
        /* ⚠⚠ NICHT h1.getClientRects(): enthaelt die h1 Block-Kinder (die
           Augenbraue ist ein eigenes display:block-span), liefert das
           genau EIN Rect — den ganzen Kasten. Die zweite Fassung meldete
           daraufhin „KEINE Zeile lesbar" fuer 44 von 44 Seiten, deren
           Titel im Bild vollstaendig zu lesen waren.
           Echte Zeilenkaesten gibt nur eine Range ueber die TEXTKNOTEN. */
        const zeilen = [];
        const geh = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
        for (let t = geh.nextNode(); t; t = geh.nextNode()) {
          if (!t.textContent.trim()) continue;
          const rg = document.createRange();
          rg.selectNodeContents(t);
          for (const z of rg.getClientRects()) if (z.height > 2) zeilen.push(z);
        }
        const vh = window.innerHeight;
        const ganz = zeilen.filter((z) => z.bottom <= vh + 2).length;
        return { oben: Math.round(r.top), unten: Math.round(r.bottom), vh,
                 zeilen: zeilen.length, sichtbar: ganz,
                 txt: h1.textContent.trim().slice(0, 30) };
      });
      gemessen++;
      if (!r) continue;
      /* Ganz sichtbar heisst: Unterkante ueber der Fensterkante. */
      if (r.sichtbar >= r.zeilen) continue;
      schlecht++;
      const wie = r.sichtbar === 0 ? 'KEINE Zeile lesbar' : (r.zeilen - r.sichtbar) + ' von ' + r.zeilen + ' Zeilen fehlen';
      console.log('[' + vp + '] ' + u + '\n        h1 „' + r.txt + '"  ' + r.oben + '–' + r.unten + ' bei vh ' + r.vh + '  → ' + wie);
    } catch { /* uebersprungen */ }
  }
  await ctx.close();
}
await b.close(); srv.close();
console.log('\nMessungen: ' + gemessen + '   Seiten mit angeschnittener h1: ' + schlecht);
