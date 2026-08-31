/* SPERRFLAECHE: wie viel des Bildschirms belegen KLEBENDE oder FESTE
   Elemente dauerhaft? Was hier steht, kann der Leser nicht wegscrollen.

   ⚠⚠ Eine frühere Fassung meldete „0 Seiten ueber 30 %" und lag falsch:
   sie lief ueber 390x844 und ueber die Uebersichtsseiten. Der Fehler sitzt
   (a) im QUERFORMAT, wo dieselbe Leiste plotzlich die halbe Hoehe frisst,
   und (b) auf den DETAILSEITEN, wo eine zweite Leiste dazukommt.
   Immer die flachste Auflösung UND die Detailseiten mitmessen.

   VP_LIST=844x390,932x430,320x568 node …/probe-sperrflaeche.mjs "/a.html" … */
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
await new Promise((r) => srv.listen(Number(process.env.PORT_NR || 4276), '127.0.0.1', r));
const PORT = Number(process.env.PORT_NR || 4276);
const b = await chromium.launch({ executablePath: CHROME });
for (const vp of (process.env.VP_LIST || '844x390').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: true, isMobile: w <= 932 });
  const pg = await ctx.newPage();
  pg.on('pageerror', () => {});
  for (const u of process.argv.slice(2)) {
    try {
      await pg.goto('http://127.0.0.1:' + PORT + u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pg.waitForTimeout(700);
      /* Erst ein Stueck scrollen: eine klebende Leiste zeigt ihre wahre
         Sperrwirkung erst, wenn sie tatsaechlich klebt. */
      await pg.evaluate(() => window.scrollTo(0, 900));
      await pg.waitForTimeout(500);
      const r = await pg.evaluate(() => {
        const vh = window.innerHeight, vw = window.innerWidth;
        const zeilen = [];
        for (const el of document.querySelectorAll('body *')) {
          const st = getComputedStyle(el);
          if (st.position !== 'fixed' && st.position !== 'sticky') continue;
          if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          const r = el.getBoundingClientRect();
          if (r.width < vw * 0.5) continue;              /* nur volle Baender */
          /* ⚠ FEHLALARM-FILTER (31.08.2026): /archiv.html wurde mit 100 %
             gemeldet. Der Uebeltaeter war div.space — der dekorative
             Sternenhimmel, position:fixed ueber den ganzen Schirm, aber
             durchlaessig und hinter allem. Er sperrt gar nichts. Gezaehlt
             wird nur, was Klicks abfaengt UND einen eigenen Grund malt. */
          if (st.pointerEvents === 'none') continue;
          const grund = st.backgroundColor;
          const durchsichtig = grund === 'transparent' || /,\s*0\)$/.test(grund);
          const malt = /blur|url\(|gradient/.test(st.backdropFilter + ' ' + st.backgroundImage);
          if (durchsichtig && !malt) continue;
          if (r.height < 8 || r.height > vh) continue;
          if (r.bottom < 0 || r.top > vh) continue;
          const nm = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
          zeilen.push({ nm, oben: Math.round(Math.max(0, r.top)), unten: Math.round(Math.min(vh, r.bottom)) });
        }
        /* Ueberlappende Baender nur EINMAL zaehlen. */
        const sort = zeilen.slice().sort((a, b) => a.oben - b.oben);
        let summe = 0, ende = -1;
        for (const z of sort) { const von = Math.max(z.oben, ende); if (z.unten > von) { summe += z.unten - von; ende = z.unten; } }
        return { vh, summe, anteil: Math.round((summe / vh) * 100), zeilen };
      });
      const flag = r.anteil >= 30 ? '  <<< ueber 30 %' : '';
      console.log('[' + vp + '] ' + String(r.anteil).padStart(3) + ' %  (' + r.summe + '/' + r.vh + 'px)  ' + u + flag);
      if (r.anteil >= 25) for (const z of r.zeilen) console.log('        ' + z.nm + '  ' + z.oben + '–' + z.unten);
    } catch (e) { console.log('[' + vp + ']  FEHLER ' + u + ' ' + String(e).slice(0, 60)); }
  }
  await ctx.close();
}
await b.close(); srv.close();
