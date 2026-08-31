/* KONTAKTBOGEN: mehrere Seiten NEBENEINANDER, je N Bildschirme untereinander.
   Zum Hinsehen, nicht zum Messen — grobe Brueche (Ueberlappung, leere
   Flaechen, schiefe Kaesten) fallen im Ueberblick auf, danach zoomt man mit
   strip.mjs in die eine Seite hinein.

   ⚠⚠ Wie strip.mjs: jede Aufnahme entsteht im ECHTEN Fenster (390x844) und
   wird erst danach gestapelt. Ein ueberhohes Fenster macht aus `92svh` eine
   ganz andere Seite — dieser Fehler ist am 30.08.2026 einmal passiert.

   MSYS_NO_PATHCONV=1 node …/kontaktbogen.mjs 390x844 3 bogen1 "/a.html" "/b.html" … */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = join(resolve(process.cwd()), 'dist');
const OUT = join(resolve(process.cwd()), '.planning/sketches/tools/out/bogen');
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
await new Promise((r) => srv.listen(4245, '127.0.0.1', r));
await mkdir(OUT, { recursive: true });

const vp = process.argv[2] || '390x844';
const schirme = Number(process.argv[3] || 3);
const name = process.argv[4] || 'bogen';
const seiten = process.argv.slice(5);
const [w, h] = vp.split('x').map(Number);

const browser = await chromium.launch({ executablePath: CHROME });
const spalten = [];
for (const url of seiten) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'dark', hasTouch: w <= 820 });
  const page = await ctx.newPage();
  const bilder = [];
  try {
    await page.goto('http://127.0.0.1:4245' + url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < schirme; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * h);
      await page.waitForTimeout(600);
      bilder.push('data:image/png;base64,' + (await page.screenshot()).toString('base64'));
      if (await page.evaluate((y) => y + window.innerHeight >= document.documentElement.scrollHeight - 4, i * h)) break;
    }
  } catch (e) {
    console.log('  FEHLER ' + url + ' ' + String(e).slice(0, 70));
  }
  spalten.push({ url, bilder });
  await ctx.close();
}

/* Alle Spalten in EINE Seite legen und einmal aufnehmen. */
const blatt = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
const breite = spalten.length * (w + 8) + 8;
await blatt.setViewportSize({ width: Math.min(breite, 4000), height: 800 });
await blatt.setContent(
  '<body style="margin:0;background:#111;display:flex;gap:8px;padding:8px;font:11px monospace;color:#7f7">' +
  spalten.map((s) =>
    '<div style="flex:none;width:' + w + 'px">' +
    '<div style="background:#000;padding:3px 5px;color:#9f9;white-space:nowrap;overflow:hidden">' + s.url + '</div>' +
    s.bilder.map((b) => '<img src="' + b + '" style="display:block;width:' + w + 'px;border-top:2px solid #333">').join('') +
    '</div>').join('') +
  '</body>');
await blatt.waitForTimeout(600);
await blatt.screenshot({ path: join(OUT, name + '__' + vp + '.png'), fullPage: true });
console.log('  ' + name + '__' + vp + '.png  (' + spalten.length + ' Seiten)');
await browser.close(); srv.close();
