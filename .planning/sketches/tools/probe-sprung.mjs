/* Landet ein Sprungziel unter den klebenden Leisten?
   node …/probe-sprung.mjs   (misst /armor-sets.html ueber mehrere Fenster) */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
const DIST = join(resolve(process.cwd()), 'dist');
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
await new Promise((r) => srv.listen(4207, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: CHROME });
for (const vp of (process.env.VPS || '320x568,390x844,768x1024,1024x768,1280x720,1920x1080').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4207' + (process.env.URL || '/armor-sets.html'), { waitUntil: 'load' });
  await page.addInitScript((s) => { window.__SEL = s; }, process.env.SEL || '.as-jump');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(700);
  const r = await page.evaluate(async () => {
    const nav = document.querySelector(window.__SEL || '.as-jump');
    if (!nav) return { fehler: 'keine .as-jump' };
    const link = nav.querySelector('a[href^="#"]');
    if (!link) return { fehler: 'kein Sprunglink' };
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const ziel = document.getElementById(id);
    if (!ziel) return { fehler: 'Ziel ' + id + ' fehlt' };
    link.click();
    await new Promise((r) => setTimeout(r, 900));
    /* Untere Kante von allem, was oben dauerhaft klebt. */
    let chrom = 0;
    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      if (st.position !== 'fixed' && st.position !== 'sticky') continue;
      const b = el.getBoundingClientRect();
      if (b.height === 0 || b.top > 4 || st.visibility === 'hidden' || st.display === 'none') continue;
      if (el.closest('[hidden],[aria-hidden="true"]')) continue;
      chrom = Math.max(chrom, b.bottom);
    }
    const zr = ziel.getBoundingClientRect();
    const kopf = ziel.querySelector('h2,h3') || ziel;
    const kr = kopf.getBoundingClientRect();
    return {
      ziel: id, zielTop: Math.round(zr.top), kopfTop: Math.round(kr.top),
      klebendUnten: Math.round(chrom),
      verdeckt: Math.round(chrom - kr.top),
      scrollMarginTop: getComputedStyle(ziel).scrollMarginTop,
    };
  });
  console.log(vp.padEnd(10), JSON.stringify(r));
  if (process.env.SHOT) await page.screenshot({ path: '.planning/sketches/tools/out/shots/sprung_' + vp + '.png' });
  await ctx.close();
}
await browser.close(); srv.close();
