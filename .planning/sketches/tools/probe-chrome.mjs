/* Wie viel Fenster ist dauerhaft weg? Summiert alles, was OBEN klebt
   (feste Nav, Brotkrumen, Filterleisten, Registerkarten) und setzt es ins
   Verhaeltnis zur Fensterhoehe. Auf einem flachen Fenster (Telefon quer,
   Netbook) frisst dieselbe Leiste, die am Schreibtisch 8 % kostet,
   schnell 40 %.

   PAGES_FILE=pages-breit.json VP_LIST=844x390,1024x600,390x844 \
     node .planning/sketches/tools/probe-chrome.mjs                        */
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
await new Promise((r) => srv.listen(4247, '127.0.0.1', r));
const PAGES = JSON.parse(await readFile(join(OUT, process.env.PAGES_FILE || 'pages.json'), 'utf8'));

/* Nach dem Scrollen messen: erst dann klebt, was kleben soll. */
const PROBE = () => {
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const vh = document.documentElement.clientHeight;
  let unten = 0;
  const teile = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) continue;
    const st = getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'sticky') continue;
    if (st.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.height < 8 || r.width < vh * 0.02) continue;
    if (r.top > 6 || r.bottom <= 0) continue;      /* nur was OBEN klebt */
    /* Geparkte Schublade: liegt komplett links/rechts ausserhalb. */
    if (r.right <= 1 || r.left >= document.documentElement.clientWidth - 1) continue;
    if (r.width < document.documentElement.clientWidth * 0.5) continue; /* echte Leisten */
    if (r.bottom > unten) { unten = r.bottom; }
    teile.push(nm(el) + ':' + Math.round(r.height));
  }
  return { vh, unten: Math.round(unten), pct: Math.round((unten / vh) * 100), teile: teile.slice(0, 5) };
};

const browser = await chromium.launch({ executablePath: CHROME });
const g = {};
for (const vp of (process.env.VP_LIST || '844x390').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  let n = 0;
  for (const url of PAGES) {
    try {
      await page.goto('http://127.0.0.1:4247' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(300);
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(400);
      const r = await page.evaluate(PROBE);
      if (r.pct >= 30) (g[vp] ||= []).push({ url, ...r });
    } catch { /* uebersprungen */ }
    if (++n % 60 === 0) process.stderr.write(`  … ${n}\n`);
  }
  await ctx.close();
  process.stderr.write(`[${vp}] fertig\n`);
}
await browser.close(); srv.close();

for (const vp of Object.keys(g)) {
  const l = g[vp].sort((a, b) => b.pct - a.pct);
  console.log(`\n=== ${vp}: ${l.length} Seiten, auf denen klebendes Chrome >= 30 % des Fensters frisst`);
  const seen = new Set();
  for (const x of l) {
    const k = x.teile.join('|');
    if (seen.has(k) && seen.size > 8) continue;
    seen.add(k);
    console.log(`  ${String(x.pct).padStart(3)}%  ${String(x.unten).padStart(4)}px  ${x.url}\n        ${x.teile.join('  ')}`);
  }
}
if (!Object.keys(g).length) console.log('\nkeine Seite ueber 30 %');
