/* Traegt die Seite ueberhaupt die HAUSSCHRIFT? Die Schrift-Token stehen
   NICHT global, sondern in den Seiten-Stylesheets (archive.css,
   data-page.css, account-dossier.css) bzw. im eigenen :root eigenstaendiger
   Seiten. Wer keins davon laedt und sie auch nicht selbst setzt, bekommt
   den Browser-Standard — und die Seite steht in Times New Roman, waehrend
   die Farben aus theme.css weiter stimmen. Genau deshalb faellt es beim
   fluechtigen Blick nicht auf.

   Gefunden am 30.08.2026 auf /impressum, /datenschutz und beiden
   DE-Fassungen.

   PAGES_FILE=pages-breit.json node …/probe-schrift.mjs                    */
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
await new Promise((r) => srv.listen(4255, '127.0.0.1', r));
const PAGES = JSON.parse(await readFile(join(OUT, process.env.PAGES_FILE || 'pages.json'), 'utf8'));

/* Die vier Hausschriften. Alles andere ist ein Rueckfall. */
const HAUS = /Barlow|Orbitron|Rajdhani|Teko|Share Tech Mono/i;

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
const page = await ctx.newPage();
page.on('pageerror', () => {});
const schlecht = [];
let n = 0, geprueft = 0;
for (const url of PAGES) {
  try {
    await page.goto('http://127.0.0.1:4255' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(250);
    /* ⚠ NICHT die Token-Namen pruefen: die eigenstaendigen One-Pager fuehren
       ihre eigenen (--font-head statt --font-display) und wurden dadurch
       faelschlich gemeldet. Gemessen wird, was der Leser SIEHT — jedes
       sichtbare Element mit eigenem Text, dessen Schriftfamilie keine der
       vier Hausschriften nennt. */
    const r = await page.evaluate(() => {
      const treffer = {};
      for (const el of document.querySelectorAll('body *')) {
        if (el.checkVisibility && !el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) continue;
        const eigen = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
        if (!eigen) continue;
        const ff = getComputedStyle(el).fontFamily;
        if (/Barlow|Orbitron|Rajdhani|Teko|Share Tech|ui-monospace|monospace/i.test(ff)) continue;
        const k = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
        (treffer[k] ||= { n: 0, ff: ff.slice(0, 22) }).n++;
      }
      return treffer;
    });
    geprueft++;
    const treffer = Object.entries(r).map(([k, v]) => `${k} (${v.ff}) x${v.n}`);
    if (treffer.length) schlecht.push({ url, treffer: treffer.slice(0, 4) });
  } catch { /* uebersprungen */ }
  if (++n % 60 === 0) process.stderr.write(`  … ${n}\n`);
}
await browser.close(); srv.close();

console.log(`\nSeiten geprueft: ${geprueft}`);
console.log(`Seiten mit sichtbarem Text in FREMDSCHRIFT: ${schlecht.length}`);
const g = {};
for (const s of schlecht) (g[s.treffer.join(' | ')] ||= []).push(s.url);
for (const [k, v] of Object.entries(g).sort((a, b) => b[1].length - a[1].length))
  console.log(`  ${String(v.length).padStart(3)} Seiten  ${k}\n        (${v.slice(0, 3).join(' ')})`);
if (!schlecht.length) console.log('  keine');
