/* STUMM SCROLLBARE KAESTEN: assets/theme.css blendet mit
   `html, body, *{scrollbar-width:none!important}` JEDE Bildlaufleiste aus.
   Ein Kasten, der mehr Inhalt hat als Platz, sieht dann aus wie ein
   vollstaendiger Kasten. Sichtbar wird er nur, wenn er
     a) in mobile-ux.css 5c steht (dauerhafte 8-px-Leiste), oder
     b) in SEL_FADE / SEL_VFADE steht (weiche Kante, data-edgefade[-y]).
   Diese Sonde meldet alles, was scrollt und KEINS von beidem hat.

   Anlass: das Hauptmenue trug 19 Eintraege = 1361 px in 844 px und war
   stumm scrollbar — auf JEDER Seite (30.08.2026).

   PAGES_FILE=pages-breit.json node …/probe-stummerscroll.mjs             */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
const ROOT = resolve(process.cwd());
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, '.planning/sketches/tools/out');
const CHROME = join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  if (!existsSync(f) && existsSync(join(f, 'index.html'))) f = join(f, 'index.html');
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('x'); }
});
await new Promise((r) => srv.listen(4235, '127.0.0.1', r));
const PAGES = JSON.parse(await readFile(join(OUT, process.env.PAGES_FILE || 'pages.json'), 'utf8'));
/* Zustaende mitnehmen — Schubladen und Menue sind zu, bis man klickt. */
const KLICKS = ['.snav__menu-btn', '#cdb-filter-toggle', '#cdb-planner-open', '.snav__search'];

const PROBE = () => {
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) continue;
    const st = getComputedStyle(el);
    const y = /(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 6;
    const x = /(auto|scroll)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 6;
    if (!y && !x) continue;
    if (el === document.body || el === document.documentElement) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) continue;
    /* Hat es ein Signal? */
    const kante = el.hasAttribute('data-edgefade') || el.hasAttribute('data-edgefade-y');
    const leiste = st.scrollbarWidth === 'thin' || st.scrollbarWidth === 'auto';
    /* pauschaler Verlauf aus 5c (background-image auf dem Kasten) */
    const verlauf = st.backgroundImage && st.backgroundImage.includes('gradient') && /34px/.test(st.backgroundSize || '');
    if (kante || leiste || verlauf) continue;
    out.push({
      sel: nm(el), achse: y && x ? 'xy' : y ? 'y' : 'x',
      versteckt: y ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth,
      sichtbar: y ? el.clientHeight : el.clientWidth,
    });
  }
  const best = {};
  for (const o of out) if (!best[o.sel] || best[o.sel].versteckt < o.versteckt) best[o.sel] = o;
  return Object.values(best);
};

const browser = await chromium.launch({ executablePath: CHROME });
const g = {};
for (const vp of (process.env.VP_LIST || '390x844').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  let n = 0;
  for (const url of PAGES) {
    try {
      await page.goto('http://127.0.0.1:4235' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      const runden = [null, ...KLICKS];
      for (const k of runden) {
        if (k) {
          const ok = await page.evaluate((s) => { const b = document.querySelector(s); if (!b || !b.getBoundingClientRect().width) return false; b.click(); return true; }, k);
          if (!ok) continue;
          await page.waitForTimeout(550);
        }
        const r = await page.evaluate(PROBE);
        for (const o of r) {
          const key = o.sel + (k ? '  [offen: ' + k + ']' : '');
          (g[key] ||= { max: 0, achse: o.achse, seiten: new Set(), vps: new Set() });
          g[key].max = Math.max(g[key].max, o.versteckt);
          g[key].seiten.add(url); g[key].vps.add(vp);
        }
        if (k) break; /* ein geoeffneter Zustand je Seite */
      }
    } catch { /* uebersprungen */ }
    if (++n % 50 === 0) process.stderr.write(`  … ${n}\n`);
  }
  await ctx.close();
}
await browser.close(); srv.close();

console.log('\nSTUMM SCROLLBAR (kein Signal, dass mehr da ist):');
const e = Object.entries(g).sort((a, b) => b[1].max - a[1].max);
if (!e.length) console.log('  nichts');
for (const [k, v] of e.slice(0, 25))
  console.log(`  ${String(v.max).padStart(5)}px verborgen (${v.achse})  ${String(v.seiten.size).padStart(3)} Seiten  ${k}\n        (${[...v.seiten].slice(0, 2).join(' ')})`);
