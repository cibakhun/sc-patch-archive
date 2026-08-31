/* EINE Seite, ALLE Aufloesungen nebeneinander — der Bogen fuer die Frage
   „passt es ueberall?". Jede Spalte ist ein Fenster, oben beschriftet.
   Alle Spalten werden auf dieselbe Anzeigebreite skaliert, damit sich die
   VERHAELTNISSE vergleichen lassen; wer Text lesen will, nimmt strip.mjs.

   ⚠⚠ Jede Aufnahme entsteht im ECHTEN Fenster. Ein ueberhohes Fenster macht
   aus `92svh` eine ganz andere Seite — dieser Fehler ist am 30.08.2026
   einmal passiert und hat eine halbe Runde Fehlalarme gekostet.

   MSYS_NO_PATHCONV=1 node …/aufloesungsbogen.mjs schmal "/index.html" …
     schmal = 320x568,360x640,390x844,430x932,844x390,932x430
     breit  = 768x1024,820x1180,1024x600,1024x768,1280x720,1440x900,1920x1080,2560x1440
   SCHIRME=2 nimmt zwei Bildschirme je Fenster.                            */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = join(resolve(process.cwd()), 'dist');
const OUT = join(resolve(process.cwd()), '.planning/sketches/tools/out/aufl');
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
await new Promise((r) => srv.listen(4267, '127.0.0.1', r));
await mkdir(OUT, { recursive: true });

const SATZ = {
  schmal: ['320x568', '360x640', '390x844', '430x932', '844x390', '932x430'],
  breit: ['768x1024', '820x1180', '1024x600', '1024x768', '1280x720', '1440x900', '1920x1080', '2560x1440'],
};
const satzName = process.argv[2] || 'schmal';
const vps = SATZ[satzName] || satzName.split(',');
const seiten = process.argv.slice(3);
const SCHIRME = Number(process.env.SCHIRME || 1);
const SPALTE = Number(process.env.SPALTE || 300);   /* Anzeigebreite je Spalte */

const browser = await chromium.launch({ executablePath: CHROME });
for (const url of seiten) {
  const spalten = [];
  for (const vp of vps) {
    const [w, h] = vp.split('x').map(Number);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'dark', hasTouch: w <= 932 });
    const page = await ctx.newPage();
    const bilder = [];
    try {
      await page.goto('http://127.0.0.1:4267' + url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(1100);
      for (let i = 0; i < SCHIRME; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), i * h);
        await page.waitForTimeout(550);
        bilder.push('data:image/png;base64,' + (await page.screenshot()).toString('base64'));
        if (await page.evaluate((y) => y + window.innerHeight >= document.documentElement.scrollHeight - 4, i * h)) break;
      }
    } catch (e) { /* Spalte bleibt leer */ }
    spalten.push({ vp, w, bilder });
    await ctx.close();
  }
  const blatt = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
  await blatt.setViewportSize({ width: Math.min(spalten.length * (SPALTE + 8) + 8, 4000), height: 800 });
  await blatt.setContent(
    '<body style="margin:0;background:#111;display:flex;gap:8px;padding:8px;font:11px monospace;color:#7f7;align-items:flex-start">' +
    spalten.map((s) =>
      '<div style="flex:none;width:' + SPALTE + 'px">' +
      '<div style="background:#000;padding:3px 5px;color:#9f9">' + s.vp + '</div>' +
      s.bilder.map((b) => '<img src="' + b + '" style="display:block;width:' + SPALTE + 'px;border-top:2px solid #333">').join('') +
      '</div>').join('') +
    '</body>');
  await blatt.waitForTimeout(500);
  const name = (url.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root') + '__' + satzName + '.png';
  await blatt.screenshot({ path: join(OUT, name), fullPage: true });
  await blatt.close();
  console.log('  ' + name);
}
await browser.close(); srv.close();
