/* Probe fuer assets/sprachhinweis.js gegen dist/. Spielt einen ECHTEN
   Besucher: navigator.webdriver wird auf false gebogen (sonst schweigt der
   Hinweis absichtlich), die Browsersprache kommt aus `locale`.
   Prueft sieben Faelle und schreibt Aufnahmen nach out/sprache/.
   Aufruf: node .planning/sketches/tools/probe-sprachhinweis.mjs             */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, '.planning/sketches/tools/out/sprache');
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
const PORT = 4261;
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
await mkdir(OUT, { recursive: true });
const BASE = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ executablePath: CHROME });

async function fall(name, { locale, vp = [1920, 945], url, mensch = true, vorher = null, aufnahme = true }) {
  const ctx = await browser.newContext({ locale, viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1, hasTouch: vp[0] < 700 });
  if (mensch) await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(String(e)));
  if (vorher) await vorher(page);
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  const r = await page.evaluate(() => {
    const b = document.querySelector('.vb-sprache');
    if (!b) return null;
    const q = b.getBoundingClientRect();
    const a = b.querySelector('a');
    const z = b.querySelector('button').getBoundingClientRect();
    return { text: b.innerText.replace(/\s+/g, ' ').trim(), lang: b.lang, href: a.getAttribute('href'), x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height), zu: `${Math.round(z.width)}x${Math.round(z.height)}`, sichtbar: getComputedStyle(b).opacity };
  });
  if (aufnahme) await page.screenshot({ path: join(OUT, name + '.png') });
  console.log(`${name.padEnd(28)} ${r ? `ZEIGT „${r.text}" lang=${r.lang} → ${r.href} @${r.x},${r.y} ${r.w}x${r.h} Schliessen ${r.zu} opacity ${r.sichtbar}` : 'kein Hinweis'}${fehler.length ? '  FEHLER: ' + fehler.join(' | ') : ''}`);
  return { ctx, page, r };
}

// 1) Deutscher Browser, englische Einstiegsseite → Hinweis auf Deutsch
await fall('1-de-auf-en-desktop', { locale: 'de-DE', url: '/crafting/th-01-propulsor.html' });
await fall('2-de-auf-en-telefon', { locale: 'de-DE', url: '/item-finder.html', vp: [390, 844] });
// 3) Englischer Browser, deutsche Seite → Hinweis auf Englisch
await fall('3-en-auf-de', { locale: 'en-US', url: '/de/missionen.html' });
// 4) Englischer Browser, englische Seite → nichts
await fall('4-en-auf-en', { locale: 'en-US', url: '/item-finder.html', aufnahme: false });
// 5) Automat (webdriver bleibt true) → nichts
await fall('5-automat', { locale: 'de-DE', url: '/item-finder.html', mensch: false, aufnahme: false });
// 6) Interner Seitenwechsel: von der Startseite per Klick → nichts
{
  const { ctx, page } = await fall('6a-startseite', { locale: 'de-DE', url: '/index.html', aufnahme: false });
  await page.evaluate(() => { const a = document.querySelector('a[href="/item-finder.html"], a[href$="item-finder.html"]'); if (a) a.click(); else location.href = '/item-finder.html'; });
  await page.waitForLoadState('load'); await page.waitForTimeout(1300);
  const n = await page.evaluate(() => ({ ref: document.referrer, hint: !!document.querySelector('.vb-sprache'), url: location.pathname }));
  console.log(`${'6b-intern-weiter'.padEnd(28)} ${n.hint ? 'ZEIGT (FALSCH)' : 'kein Hinweis'}  (Herkunft ${n.ref.replace(BASE, '')} → ${n.url})`);
  await ctx.close();
}
// 7) Geschlossen → beim naechsten Einstieg nichts
{
  const { ctx, page } = await fall('7a-schliessen', { locale: 'de-DE', url: '/schiffe.html', aufnahme: false });
  await page.click('.vb-sprache__zu');
  const weg = await page.evaluate(() => !document.querySelector('.vb-sprache'));
  await page.goto(BASE + '/missionen.html', { referer: 'https://www.bing.com/' });
  await page.waitForTimeout(1300);
  const n = await page.evaluate(() => !!document.querySelector('.vb-sprache'));
  console.log(`${'7b-nach-schliessen'.padEnd(28)} Klick entfernt: ${weg} · naechster Einstieg: ${n ? 'ZEIGT (FALSCH)' : 'kein Hinweis'}`);
  await ctx.close();
}
await browser.close(); srv.close();
