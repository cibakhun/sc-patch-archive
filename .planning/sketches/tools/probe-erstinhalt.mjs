/* Wie weit unten faengt der eigentliche Inhalt an, und wie viel Platz
   fressen Hero, Hilfe und Filter davor? Misst je Seite:
     heroBis     Unterkante des Hero/Kopfbilds
     hilfeBis    Unterkante der aufgeklappten Erstbesuch-Hilfe
     filterBis   Unterkante der Filterkonsole
     ersterInhalt  Oberkante der ersten Ergebnis-/Inhaltskarte
     spalten     Spaltenzahl des Ergebnisrasters
   node .planning/sketches/tools/probe-erstinhalt.mjs 390x844            */
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
await new Promise((r) => srv.listen(4225, '127.0.0.1', r));

const SEITEN = [
  { url: '/index.html', hero: 'header.hero, .hero', filter: null, raster: '.tools', karte: '.tool' },
  { url: '/schiffe.html', hero: '.sdb__hero', filter: '.sdb__filter, .sdb__console', raster: '.fgrid, .sdb__grid', karte: '.fcard' },
  { url: '/missionen.html', hero: '.mx__hero', filter: '.mx__bar', raster: '.mx__grid', karte: '.mc' },
  { url: '/item-finder.html', hero: '.hero--tool', filter: '.uif-controls, .uif-filterbar', raster: '.uif-results', karte: '.uif-card' },
  { url: '/topics/crafting.html', hero: '.hero--tool', filter: '.cdb-bar', raster: '#cdb-grid', karte: '.cbp' },
  { url: '/archiv.html', hero: '.hero, header.hero', filter: '.cbar', raster: '.dive, .icards', karte: '.icard' },
  { url: '/evolution.html', hero: '.hero, .dp-hero', filter: '.evo__legend', raster: '.evo__scroll', karte: '.evo__td' },
  { url: '/downloads.html', hero: 'section.hero', filter: '.tools', raster: '.grid, .ops', karte: '.op, .gitem' },
  { url: '/refinery.html', hero: '.hero--acct', filter: null, raster: null, karte: '.acx-field' },
  { url: '/precision-jump.html', hero: 'header.alm', filter: '.pj-filters, .pj-bar', raster: '.pj-tblscroll', karte: '.pj-field' },
];

const browser = await chromium.launch({ executablePath: CHROME });
const vp = process.argv[2] || '390x844';
const [w, h] = vp.split('x').map(Number);
console.log('=== ' + vp + '  (alle Werte in px vom Seitenanfang)');
for (const s of SEITEN) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
  const page = await ctx.newPage();
  try {
    await page.goto('http://127.0.0.1:4225' + s.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(1300);
    const r = await page.evaluate((s) => {
      const q = (sel) => { if (!sel) return null; for (const one of sel.split(',')) { const el = document.querySelector(one.trim()); if (el) return el; } return null; };
      const unten = (el) => (el ? Math.round(el.getBoundingClientRect().bottom + window.scrollY) : null);
      const oben = (el) => (el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null);
      const hilfe = document.querySelector('details.tool-help[open]');
      const raster = q(s.raster);
      let spalten = null;
      if (raster) {
        const gtc = getComputedStyle(raster).gridTemplateColumns;
        spalten = gtc && gtc !== 'none' ? gtc.split(' ').filter(Boolean).length : null;
      }
      const karte = q(s.karte);
      return {
        heroBis: unten(q(s.hero)), hilfeBis: unten(hilfe), filterBis: unten(q(s.filter)),
        ersterInhalt: oben(karte),
        karteBreite: karte ? Math.round(karte.getBoundingClientRect().width) : null,
        spalten, seitenHoehe: Math.round(document.documentElement.scrollHeight),
      };
    }, s);
    const bs = (v) => (v == null ? '  —' : (v / h).toFixed(1) + ' Schirm');
    console.log(
      s.url.padEnd(24) +
      'Hero ' + String(r.heroBis ?? '—').padStart(5) +
      ' | Hilfe ' + String(r.hilfeBis ?? '—').padStart(5) +
      ' | Filter ' + String(r.filterBis ?? '—').padStart(5) +
      ' | 1. Inhalt ' + String(r.ersterInhalt ?? '—').padStart(5) + ' (' + bs(r.ersterInhalt) + ')' +
      ' | Karte ' + String(r.karteBreite ?? '—').padStart(4) + 'px' +
      ' | Spalten ' + (r.spalten ?? '—'),
    );
  } catch (e) {
    console.log(s.url.padEnd(24) + 'FEHLER ' + String(e).slice(0, 70));
  }
  await ctx.close();
}
await browser.close(); srv.close();
