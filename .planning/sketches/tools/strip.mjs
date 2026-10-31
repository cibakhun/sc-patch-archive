/* Ein hoher Streifen je Seite zum HINSEHEN (nicht zum Messen).
   ⚠⚠ WICHTIG, aus einem Fehler gelernt (30.08.2026): der Streifen wird aus
   ECHTEN Aufnahmen im echten Fenster (390x844) zusammengesetzt und danach
   gestapelt. Die erste Fassung hat stattdessen EIN Fenster von 390x(844*3)
   aufgenommen — dort wird `min-height:92svh` zu 2329 px statt 776, und ein
   voellig normaler Hero sieht aus wie ein Fehler. Wer vh/svh-Layouts in
   einem ueberhohen Fenster fotografiert, fotografiert eine Seite, die es
   nicht gibt.

   MSYS_NO_PATHCONV=1 node .planning/sketches/tools/strip.mjs 390x844 4 \
       "/index.html" "/schiffe.html" …
   (2. Argument = wie viele Bildschirme)                                   */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = join(resolve(process.cwd()), 'dist');
const OUT = join(resolve(process.cwd()), '.planning/sketches/tools/out/strips');
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
await new Promise((r) => srv.listen(4223, '127.0.0.1', r));
await mkdir(OUT, { recursive: true });

const vp = process.argv[2] || '390x844';
const schirme = Number(process.argv[3] || 4);
const [w, h] = vp.split('x').map(Number);
const seiten = process.argv.slice(4);
const SCALE = Number(process.env.SCALE || 0.8);

const browser = await chromium.launch({ executablePath: CHROME });
for (const url of seiten) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'dark', hasTouch: w <= 820 });
  const page = await ctx.newPage();
  const bilder = [];
  try {
    await page.goto('http://127.0.0.1:4223' + url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(1300);
    for (let i = 0; i < schirme; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * h);
      await page.waitForTimeout(650); /* .reveal braucht den Beobachter */
      const buf = await page.screenshot();
      bilder.push('data:image/png;base64,' + buf.toString('base64'));
      const amEnde = await page.evaluate((y) => y + window.innerHeight >= document.documentElement.scrollHeight - 4, i * h);
      if (amEnde) break;
    }
    /* Stapeln: die Einzelbilder in eine leere Seite legen und EINMAL
       aufnehmen — kein Bildbearbeitungspaket noetig. */
    const blatt = await ctx.newPage();
    await blatt.setViewportSize({ width: w, height: h * bilder.length });
    await blatt.setContent(
      '<body style="margin:0;background:#000;font:12px monospace;color:#0f0">' +
      bilder.map((b, i) => `<div style="position:relative"><img src="${b}" style="display:block;width:${w}px">` +
        `<span style="position:absolute;left:2px;top:2px;background:#000a;padding:1px 4px">${i + 1}</span></div>`).join('') +
      '</body>');
    await blatt.waitForTimeout(400);
    const name = (url.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root') + `__${vp}.png`;
    await blatt.screenshot({ path: join(OUT, name), fullPage: true, scale: 'css' });
    await blatt.close();
    console.log('  ' + name + '  (' + bilder.length + ' Schirme)');
  } catch (e) {
    console.log('  FEHLER ' + url + ' ' + String(e).slice(0, 90));
  }
  await ctx.close();
}
await browser.close(); srv.close();
