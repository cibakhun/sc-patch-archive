/* ETIKETTEN, DIE MIT ELLIPSE GEKAPPT WERDEN. Anders als beim harten
   Schnitt (probe-abgeschnittenes-feld.mjs) ist der Verlust hier SICHTBAR
   — „WITH DATA SHE…" sagt dem Leser, dass etwas fehlt. Trotzdem fehlt es:
   bei einem Etikett ueber einer Kennzahl ist Umbruch fast immer besser
   als Kappen, denn Platz nach unten ist da, Platz nach rechts nicht.

   Gemeldet wird nur, wo die Ellipse WIRKLICH greift (scrollWidth >
   clientWidth), nicht wo sie bloss vorsorglich im CSS steht.             */
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
const PORT = Number(process.env.PORT_NR || 4285);
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
const PAGES = process.argv.slice(2).length ? process.argv.slice(2)
  : JSON.parse(await readFile(join(resolve(process.cwd()), '.planning/sketches/tools/out', process.env.PAGES_FILE || 'pages.json'), 'utf8'));
const b = await chromium.launch({ executablePath: CHROME });
const g = {};
let n = 0;
for (const vp of (process.env.VP_LIST || '360x640').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: true });
  const pg = await ctx.newPage();
  pg.on('pageerror', () => {});
  for (const u of PAGES) {
    try {
      await pg.goto('http://127.0.0.1:' + PORT + u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pg.waitForTimeout(400);
      const r = await pg.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          const st = getComputedStyle(el);
          if (st.textOverflow !== 'ellipsis') continue;
          if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          if (el.scrollWidth <= el.clientWidth + 1) continue;
          const txt = el.textContent.trim();
          if (!txt || txt.length < 4) continue;
          out.push({ sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''),
                     txt: txt.slice(0, 26), fehlt: el.scrollWidth - el.clientWidth });
        }
        return out;
      });
      n++;
      for (const x of r.slice(0, 4)) {
        const k = x.sel + '  „' + x.txt + '"  (fehlen ' + x.fehlt + 'px)  [' + vp + ']';
        (g[k] ||= new Set()).add(u);
      }
    } catch { /* uebersprungen */ }
  }
  await ctx.close();
}
await b.close(); srv.close();
const e = Object.entries(g).sort((a, b) => b[1].size - a[1].size);
console.log('\nMessungen: ' + n + '   Ellipsen, die WIRKLICH greifen: ' + e.length + ' Muster');
for (const [k, v] of e.slice(0, 20)) console.log('  ' + String(v.size).padStart(4) + ' Seiten  ' + k + '\n           (' + [...v].slice(0, 2).join('  ') + ')');
