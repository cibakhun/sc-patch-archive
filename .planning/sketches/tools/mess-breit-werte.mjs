/* Gegenprobe zum Breitbild-Zuschlag: die BERECHNETEN Werte je Fenster.
   Bis 1920 px muessen sie exakt dem alten Stand entsprechen (Zuschlag 0,
   Kopfleisten-Polster = clamp-Wert). Gegen dist/.
   Aufruf: node .planning/sketches/tools/mess-breit-werte.mjs              */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = join(resolve(process.cwd()), 'dist');
const CHROME = join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
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
await new Promise((r) => srv.listen(4259, '127.0.0.1', r));

const PRUEF = [
  ['/item-finder.html', '.uif-container', 'maxWidth'],
  ['/topics/crafting.html', '.cdb', 'maxWidth'],
  ['/missionen.html', '.mx__wrap', 'width'],
  ['/schiffe.html', '.sdb__panel', 'maxWidth'],
  ['/schiffe.html', '.snav', 'paddingLeft'],
  ['/missionen/emergency-blinding-hope-in-trouble.html', '.snav__back', 'left'],
  ['/crafting/th-01-propulsor.html', '.dp-bar', 'paddingLeft'],
];
const VPS = ['360x740', '1024x768', '1280x720', '1920x945', '2200x1100', '2560x1305', '3440x1305'];
const browser = await chromium.launch({ executablePath: CHROME });
const tab = {};
for (const vp of VPS) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const [url, sel, prop] of PRUEF) {
    await page.goto('http://127.0.0.1:4259' + url, { waitUntil: 'load' });
    const v = await page.evaluate(([sel, prop]) => {
      const el = document.querySelector(sel);
      if (!el) return '—';
      if (getComputedStyle(el).display === 'none' || el.hidden) return 'versteckt';
      return getComputedStyle(el)[prop];
    }, [sel, prop]);
    const k = `${url.split('/').pop().slice(0, 22)} ${sel} ${prop}`;
    (tab[k] = tab[k] || {})[vp] = v;
  }
  await ctx.close();
}
await browser.close(); srv.close();
console.log(''.padEnd(52) + VPS.map((v) => v.padStart(11)).join(''));
for (const [k, row] of Object.entries(tab)) console.log(k.padEnd(52) + VPS.map((v) => String(row[v]).padStart(11)).join(''));
