/* WORTBRUCH IN DER UEBERSCHRIFT: `overflow-wrap:anywhere` rettet ein Layout
   vor dem Ueberlauf, aber an einer 60-px-Schrift zerlegt es das Wort:
   „Contest / ed Zones". Gemessen wird, ob das laengste Wort der h1 in eine
   Zeile passt — nicht die CSS-Regel, sondern die WIRKUNG.

   VP_LIST=320x568,360x640 node …/mess-wortbruch.mjs "/a.html" …           */
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
const PORT = Number(process.env.PORT_NR || 4283);
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
const PAGES = process.argv.slice(2).length ? process.argv.slice(2)
  : JSON.parse(await readFile(join(resolve(process.cwd()), '.planning/sketches/tools/out', process.env.PAGES_FILE || 'pages.json'), 'utf8'));
const b = await chromium.launch({ executablePath: CHROME });
let n = 0, schlecht = 0;
const muster = {};
for (const vp of (process.env.VP_LIST || '320x568').split(',')) {
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
        const lineal = document.createElement('span');
        lineal.style.cssText = 'position:absolute;left:-9999px;visibility:hidden;white-space:pre';
        document.body.appendChild(lineal);
        /* Auch die KINDER der Ueberschriften: dort steht der eigentliche
           Titel, wenn die h1 eine Augenbraue traegt. */
        for (const el of document.querySelectorAll('h1,h2,.do__feat h4,h1 *,h2 *')) {
          if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          const st = getComputedStyle(el);
          /* Nur wo ein harter Bruch ueberhaupt erlaubt ist. */
          if (!/anywhere|break-word/.test(st.overflowWrap + ' ' + st.wordBreak)) continue;
          /* ⚠⚠ NICHT el.textContent: eine h1 traegt oft eine Augenbraue als
             eigenes Kind, und textContent klebt beide ohne Trennung
             zusammen — die erste Fassung meldete das Phantomwort
             „ZonesContested" (554 px) auf jeder Themenseite. Gemessen
             werden nur die EIGENEN Textknoten des Elements, in seiner
             eigenen Schrift. */
          const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
          if (!txt) continue;
          const woerter = txt.split(/\s+/).filter((x) => x.length > 3);
          if (!woerter.length) continue;
          lineal.style.font = st.font;
          lineal.style.letterSpacing = st.letterSpacing;
          lineal.style.textTransform = st.textTransform;
          let laengst = '', bw = 0;
          for (const w of woerter) { lineal.textContent = w; const b = lineal.getBoundingClientRect().width; if (b > bw) { bw = b; laengst = w; } }
          /* ⚠ Elemente mit 1 px Breite sind Screenreader-Ueberschriften
             (h1.wb__ctitle der Werkbank) — sie werden nie gemalt und
             melden sonst jedes Wort als Bruch. */
          if (el.getBoundingClientRect().width < 40) continue;
          const platz = el.getBoundingClientRect().width - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
          if (bw <= platz + 1) continue;
          out.push({ tag: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''),
                     wort: laengst, braucht: Math.round(bw), platz: Math.round(platz) });
        }
        lineal.remove();
        return out;
      });
      n++;
      for (const x of r.slice(0, 2)) {
        schlecht++;
        const k = x.tag + '  „' + x.wort + '" braucht ' + x.braucht + ', hat ' + x.platz + '  [' + vp + ']';
        (muster[k] ||= []).push(u);
      }
    } catch { /* uebersprungen */ }
  }
  await ctx.close();
}
await b.close(); srv.close();
console.log('\nMessungen: ' + n + '   Wortbrueche: ' + schlecht + '  (' + Object.keys(muster).length + ' Muster)');
for (const [k, v] of Object.entries(muster).sort((a, b) => b[1].length - a[1].length).slice(0, 20))
  console.log('  ' + String(v.length).padStart(4) + ' Seiten  ' + k + '\n           (' + v.slice(0, 2).join('  ') + ')');
