/* Welche Fassung des Schiffs-Bühnenbilds laedt der Browser je Fenster —
   und um welchen Faktor wird sie hochgezogen? Gegen dist/ (Bilder kommen
   echt aus dem Netz). Aufruf:
     node .planning/sketches/tools/probe-buehnenbild.mjs /schiffe/a.html …   */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = join(resolve(process.cwd()), 'dist');
const CHROME = join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  let b = null;
  try { b = await readFile(f); } catch { b = null; }
  if (!b) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(b);
});
await new Promise((r) => srv.listen(4267, '127.0.0.1', r));
const SEITEN = process.argv.slice(2);
const FENSTER = [[390, 844, 3], [1920, 945, 1], [1536, 730, 1.25], [2560, 1305, 1], [3840, 2025, 1]];
const browser = await chromium.launch({ executablePath: CHROME });
for (const url of SEITEN) {
  console.log(`\n== ${url}`);
  for (const [w, h, dpr] of FENSTER) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: w < 700, hasTouch: w < 700 });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:4267' + url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => { const i = document.querySelector('#shipfig img.is-active'); return !i || (i.complete && (i.naturalWidth > 0 || i.dataset.bad)); }, null, { timeout: 20000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const i = document.querySelector('#shipfig img.is-active');
      if (!i) return null;
      const q = i.getBoundingClientRect();
      const fit = getComputedStyle(i).objectFit;
      /* ⚠ Bei srcset mit w-Angaben meldet naturalWidth NICHT die Dateibreite,
         sondern die auf CSS-Pixel umgerechnete (Kandidat ÷ Dichte) — sie ist
         dann ~ die Kastenbreite, der Faktor sähe immer nach 1 aus. Die echte
         Dateibreite steht im Namen des gewählten Kandidaten (…/1920px-…).
         Seitenverhältnis bleibt richtig, deshalb Höhe daraus skalieren. */
      const m = (i.currentSrc || '').match(/\/(\d+)px-/);
      const dateiW = m ? Number(m[1]) : i.naturalWidth;
      const dateiH = i.naturalWidth ? i.naturalHeight * (dateiW / i.naturalWidth) : 0;
      const dpr = devicePixelRatio;
      const f = dateiW ? (fit === 'cover' ? Math.max(q.width * dpr / dateiW, q.height * dpr / dateiH) : q.width * dpr / dateiW) : 0;
      return { cur: (i.currentSrc || '').split('/').pop().slice(0, 26), nat: dateiW, w: Math.round(q.width), f: Math.round(f * 100) / 100, srcset: !!i.getAttribute('srcset'), bad: !!i.dataset.bad };
    });
    console.log(`  ${(w + 'x' + h + '@' + dpr).padEnd(16)} ${r ? `${r.cur.padEnd(28)} ${String(r.nat).padStart(5)} px → ${r.w} CSS px · Faktor (Geraetepixel) ${r.f}${r.srcset ? '' : ' · ohne srcset'}${r.bad ? ' · KAPUTT' : ''}` : 'kein Bühnenbild'}`);
    await ctx.close();
  }
}
await browser.close(); srv.close();
