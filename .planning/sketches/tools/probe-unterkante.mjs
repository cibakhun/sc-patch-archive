/* Was klebt am UNTEREN Fensterrand? Auf einem iPhone liegt dort der
   Home-Indicator (34 px) und auf Android die Gestenleiste. Ohne
   `env(safe-area-inset-bottom)` liegt alles, was dort klebt, darunter.
   PAGES_FILE=pages-breit.json node …/probe-unterkante.mjs                */
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
await new Promise((r) => srv.listen(4231, '127.0.0.1', r));
const PAGES = JSON.parse(await readFile(join(OUT, process.env.PAGES_FILE || 'pages.json'), 'utf8'));

/* Zustaende mitnehmen: die Schubladen sind zu, bis man sie oeffnet. */
const OEFFNER = ['#cdb-filter-toggle', '#cdb-planner-open', '.snav__menu-btn', '.snav__search'];

const PROBE = () => {
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const vh = document.documentElement.clientHeight;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) continue;
    const st = getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.height < 8 || r.width < 8) continue;
    /* klebt es an der Unterkante? */
    if (r.bottom < vh - 6 || r.top > vh) continue;
    /* was steht in den letzten 34 px (Home-Indicator)? */
    const drin = [];
    for (const k of el.querySelectorAll('a,button,input,select,summary,[role="button"]')) {
      const kr = k.getBoundingClientRect();
      if (kr.height < 6) continue;
      if (kr.bottom > vh - 34) drin.push(nm(k) + ' (' + Math.round(vh - kr.bottom) + 'px ueber der Kante)');
    }
    out.push({ sel: nm(el), pos: st.position, unten: Math.round(vh - r.bottom), hoehe: Math.round(r.height), imIndikator: drin.slice(0, 4) });
  }
  return out;
};

const browser = await chromium.launch({ executablePath: CHROME });
const treffer = {};
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', () => {});
let n = 0;
for (const url of PAGES) {
  try {
    await page.goto('http://127.0.0.1:4231' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(350);
    for (const zustand of ['zu', ...OEFFNER]) {
      if (zustand !== 'zu') {
        const ok = await page.evaluate((s) => { const b = document.querySelector(s); if (!b || !b.getBoundingClientRect().width) return false; b.click(); return true; }, zustand);
        if (!ok) continue;
        await page.waitForTimeout(500);
      }
      const r = await page.evaluate(PROBE);
      for (const x of r) {
        const k = x.sel + (zustand === 'zu' ? '' : '  [nach Klick ' + zustand + ']');
        (treffer[k] ||= { n: 0, seiten: new Set(), imIndikator: new Set(), hoehe: x.hoehe, pos: x.pos });
        treffer[k].n++; treffer[k].seiten.add(url);
        for (const d of x.imIndikator) treffer[k].imIndikator.add(d);
      }
      if (zustand !== 'zu') break; /* ein Zustand je Seite reicht */
    }
  } catch { /* uebersprungen */ }
  if (++n % 50 === 0) process.stderr.write(`  … ${n}\n`);
}
await browser.close(); srv.close();

console.log('\nAM UNTEREN FENSTERRAND KLEBEND (390x844):');
const e = Object.entries(treffer).sort((a, b) => b[1].seiten.size - a[1].seiten.size);
if (!e.length) console.log('  nichts');
for (const [k, v] of e.slice(0, 20)) {
  console.log(`  ${String(v.seiten.size).padStart(3)} Seiten  ${v.pos.padEnd(7)} h=${String(v.hoehe).padStart(4)}  ${k}`);
  for (const d of [...v.imIndikator].slice(0, 3)) console.log(`        im Indikator-Streifen: ${d}`);
}
