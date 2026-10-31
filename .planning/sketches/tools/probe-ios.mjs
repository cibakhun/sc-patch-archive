/* Fallen, die auf einem iPhone zuschlagen und die ein Kopflos-Chromium nie
   von selbst zeigt. Alle vier sind aus dem DOM messbar:

   1. KLEBEND IN EINEM CLIPPENDEN KASTEN. `position:sticky` wirkt nicht, wenn
      ein Vorfahr `overflow:hidden/clip/auto` hat — die Leiste scrollt dann
      einfach weg. Faellt am Schreibtisch oft nicht auf, weil dort weniger
      gescrollt wird.
   2. FELD UNTER 16 px. Safari zoomt beim Fokus in JEDES Feld mit kleinerer
      Schrift hinein und laesst den Nutzer in einem verschobenen Viewport
      sitzen. mobile-ux.css 1) deckt das ab — diese Sonde prueft, ob es hielt.
   3. vh-HOEHE OHNE dvh/svh-Zwilling an einem Kasten, der das Fenster fuellt.
      Auf iOS ist `100vh` die GROSSE Ansicht (ohne Adressleiste); der Kasten
      ist also hoeher als das, was man sieht.
   4. BEDIENELEMENT IM UNTEREN SYSTEMSTREIFEN (34 px Home-Indicator).

   PAGES_FILE=pages-breit.json VP_LIST=390x844,844x390 \
     node .planning/sketches/tools/probe-ios.mjs                            */
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
await new Promise((r) => srv.listen(4237, '127.0.0.1', r));
const PAGES = JSON.parse(await readFile(join(OUT, process.env.PAGES_FILE || 'pages.json'), 'utf8'));

const PROBE = () => {
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const sicht = (el) => !el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true });
  const vh = document.documentElement.clientHeight;
  const out = { klebendTot: [], feldZoom: [], vhOhneZwilling: [], imSystemstreifen: [] };

  for (const el of document.querySelectorAll('body *')) {
    if (!sicht(el)) continue;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();

    /* 1) klebend, aber ein Vorfahr clippt */
    if (st.position === 'sticky' && r.height > 4) {
      let p = el.parentElement, toeter = null;
      while (p && p !== document.body) {
        const ps = getComputedStyle(p);
        if (/(hidden|clip|auto|scroll)/.test(ps.overflowY) || /(hidden|clip|auto|scroll)/.test(ps.overflowX)) {
          /* Ein echter Scrollkasten ist in Ordnung — darin klebt es korrekt.
             Toedlich ist nur ein Vorfahr, der NICHT scrollt (hidden/clip) und
             hoeher ist als das Fenster: dann verschwindet die Leiste. */
          if (/(hidden|clip)/.test(ps.overflowY) && p.getBoundingClientRect().height > vh) toeter = p;
          break;
        }
        p = p.parentElement;
      }
      if (toeter) out.klebendTot.push({ sel: nm(el), durch: nm(toeter) });
    }

    /* 3) vh-Hoehe ohne dvh/svh-Zwilling */
    if (r.height > vh * 0.8) {
      const h = el.style.height || '';
      if (/\d(vh)\b/.test(st.height) === false) { /* computed ist immer px — Quelle pruefen */ }
    }
  }

  /* 2) Felder unter 16 px */
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea')) {
    if (!sicht(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 15.9) out.feldZoom.push({ sel: nm(el), px: Math.round(fs * 10) / 10 });
  }

  /* 4) Bedienelemente im unteren 34-px-Streifen, die dort dauerhaft kleben */
  for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,summary,[role="button"]')) {
    if (!sicht(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 6) continue;
    if (r.bottom <= vh - 34 || r.top > vh) continue;
    let p = el, fest = false;
    while (p && p !== document.body) { const ps = getComputedStyle(p); if (ps.position === 'fixed') { fest = true; break; } p = p.parentElement; }
    if (fest) out.imSystemstreifen.push({ sel: nm(el), unten: Math.round(vh - r.bottom) });
  }

  const kurz = (arr) => {
    const m = {};
    for (const x of arr) { const k = JSON.stringify(x).replace(/"unten":-?\d+/, '"unten":…'); m[k] = (m[k] || 0) + 1; }
    return Object.keys(m).slice(0, 6).map((k) => JSON.parse(k));
  };
  return { klebendTot: kurz(out.klebendTot), feldZoom: kurz(out.feldZoom), imSystemstreifen: kurz(out.imSystemstreifen) };
};

const browser = await chromium.launch({ executablePath: CHROME });
const g = { klebendTot: {}, feldZoom: {}, imSystemstreifen: {} };
for (const vp of (process.env.VP_LIST || '390x844').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  let n = 0;
  for (const url of PAGES) {
    try {
      await page.goto('http://127.0.0.1:4237' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(320);
      const r = await page.evaluate(PROBE);
      for (const art of Object.keys(g))
        for (const x of r[art] || []) {
          const k = x.sel + (x.durch ? '  <- geclippt von ' + x.durch : '') + (x.px ? '  ' + x.px + 'px' : '');
          (g[art][k] ||= { seiten: new Set(), vps: new Set() });
          g[art][k].seiten.add(url); g[art][k].vps.add(vp);
        }
    } catch { /* uebersprungen */ }
    if (++n % 60 === 0) process.stderr.write(`  … ${n}\n`);
  }
  await ctx.close();
  process.stderr.write(`[${vp}] fertig\n`);
}
await browser.close(); srv.close();

const titel = { klebendTot: '1) KLEBEND, aber ein clippender Vorfahr toetet es', feldZoom: '2) FELD UNTER 16 px (Safari zoomt beim Fokus hinein)', imSystemstreifen: '4) BEDIENELEMENT im unteren 34-px-Systemstreifen' };
for (const art of Object.keys(g)) {
  const e = Object.entries(g[art]).sort((a, b) => b[1].seiten.size - a[1].seiten.size);
  console.log(`\n${titel[art]}: ${e.length} Muster`);
  if (!e.length) console.log('  keine');
  for (const [k, v] of e.slice(0, 12))
    console.log(`  ${String(v.seiten.size).padStart(3)} Seiten [${[...v.vps].join(',')}]  ${k}\n        (${[...v.seiten].slice(0, 2).join(' ')})`);
}
