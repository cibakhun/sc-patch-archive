/* Zustaende, die eine ruhende Messung nie sieht: ausgefahrene Panels,
   Suchschicht, Menue-Deck, Modal. Fuer jeden Zustand wird geprueft:
   passt der Kasten ins Fenster, laeuft die Seite noch ueber, ist der
   Schliessen-Knopf im Bild und mindestens 40 px gross.
   node .planning/sketches/tools/probe-zustaende.mjs [390x844] */
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
await new Promise((r) => srv.listen(4215, '127.0.0.1', r));

const FAELLE = [
  { name: 'Crafting: Filter-Schublade', url: '/topics/crafting.html', klick: '#cdb-filter-toggle', panel: '#cdb-sidebar', zu: '.cdb-side-hd button, #cdb-sidebar .cdb-x' },
  { name: 'Crafting: Planer', url: '/topics/crafting.html', klick: '#cdb-planner-open', panel: '#cdb-planner', zu: '#cdb-planner .cdb-x' },
  { name: 'Missionen: Filter', url: '/missionen.html', klick: '#mx-filter-toggle', panel: '#mx-bar', zu: '#mx-filter-close' },
  { name: 'Menue-Deck', url: '/index.html', klick: '.snav__menu-btn', panel: '#snavDeck', zu: '#snavDeck button, #snavDeck a' },
  { name: 'Suchschicht', url: '/index.html', klick: '.snav__search', panel: '#scs', zu: '.scs__x, #scs button' },
  { name: 'Item-Finder: Modal', url: '/item-finder.html', klick: '.uif-card-link', panel: '.uif-modal-overlay, .uif-modal-container', zu: '.uif-modal-close' },
  { name: 'Schiffe: Filter', url: '/schiffe.html', klick: '[data-offcanvas-toggle], .sdb__filter-toggle, #sdb-filter-toggle', panel: '[data-offcanvas]', zu: '[data-offcanvas] button' },
];

const browser = await chromium.launch({ executablePath: CHROME });
for (const vp of (process.argv[2] || '390x844').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  console.log('\n===== ' + vp);
  for (const f of FAELLE) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
    const page = await ctx.newPage();
    try {
      await page.goto('http://127.0.0.1:4215' + f.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1100);
      const r = await page.evaluate(async (f) => {
        const q = (s) => { for (const one of s.split(',')) { const el = document.querySelector(one.trim()); if (el) return el; } return null; };
        const btn = q(f.klick);
        if (!btn) return { fehler: 'Ausloeser nicht gefunden' };
        const br = btn.getBoundingClientRect();
        if (br.width === 0) return { fehler: 'Ausloeser unsichtbar (Breite 0)' };
        btn.click();
        await new Promise((r) => setTimeout(r, 700));
        const p = q(f.panel);
        if (!p) return { fehler: 'Panel nicht gefunden' };
        const pr = p.getBoundingClientRect();
        const de = document.documentElement;
        const zu = q(f.zu);
        const zr = zu ? zu.getBoundingClientRect() : null;
        return {
          panel: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.width), Math.round(pr.height)],
          imBild: pr.left >= -1 && pr.right <= de.clientWidth + 1 && pr.top >= -1,
          hoeherAlsFenster: Math.round(pr.height - de.clientHeight),
          scrollbar: /(auto|scroll)/.test(getComputedStyle(p).overflowY) || [...p.querySelectorAll('*')].some((c) => /(auto|scroll)/.test(getComputedStyle(c).overflowY) && c.scrollHeight > c.clientHeight + 4),
          seiteUeberlauf: Math.round(de.scrollWidth - de.clientWidth),
          seiteGesperrt: /(hidden|clip)/.test(getComputedStyle(document.body).overflowY),
          schliessen: zr ? { box: [Math.round(zr.width), Math.round(zr.height)], imBild: zr.top >= 0 && zr.bottom <= de.clientHeight } : 'nicht gefunden',
        };
      }, f);
      console.log('  ' + f.name.padEnd(28) + JSON.stringify(r));
    } catch (e) {
      console.log('  ' + f.name.padEnd(28) + 'FEHLER ' + String(e).slice(0, 90));
    }
    await ctx.close();
  }
}
await browser.close(); srv.close();
