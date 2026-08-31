/* GEGENPROBE zu `inert`: laesst sich die Schublade noch oeffnen, bedienen
   und schliessen? Ein Attribut, das den Fokus fernhaelt, kann genauso gut
   die ganze Schublade lahmlegen — das muss gemessen werden, nicht
   angenommen. Geprueft wird die ganze Kette: Knopf tippen, Filter
   anklicken, Trefferzahl vergleichen, schliessen. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
const DIST = join(resolve(process.cwd()), 'dist');
const CHROME = join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  /* ⚠ ERST lesen, DANN Header: umgekehrt stirbt der Prozess an
     ERR_HTTP_HEADERS_SENT, sobald eine Datei fehlt — mitten im Messlauf. */
  let b;
  try { b = await readFile(f); } catch { res.writeHead(404); res.end('x'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(b);
});
await new Promise((r) => srv.listen(4289, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
for (const vp of ['320x568', '390x844', '844x390', '1280x720']) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 932, isMobile: w <= 932 });
  const pg = await ctx.newPage();
  const fehler = [];
  pg.on('pageerror', (e) => fehler.push(String(e).slice(0, 60)));
  await pg.goto('http://127.0.0.1:4289/missionen.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1400);
  const schritte = [];
  const zahl = async () => pg.evaluate(() => {
    const e = document.querySelector('#mx-count, #mx-count-m');
    return e ? e.textContent.trim() : '?';
  });
  const vorher = await zahl();
  const knopf = await pg.$('#mx-filter-toggle');
  const knopfDa = knopf && await knopf.isVisible();
  if (knopfDa) {
    await knopf.click();
    await pg.waitForTimeout(600);
    const auf = await pg.evaluate(() => {
      const p = document.querySelector('.mx__bar');
      return { offen: p.classList.contains('is-open'), inert: p.hasAttribute('inert'),
               x: Math.round(p.getBoundingClientRect().left) };
    });
    schritte.push('geoeffnet=' + auf.offen + ' inert=' + auf.inert + ' x=' + auf.x);
    /* Ein echter Filterklick: die erste Auswahl in der Schublade. */
    const geklickt = await pg.evaluate(() => {
      const p = document.querySelector('.mx__bar');
      const b = [...p.querySelectorAll('button, input[type=checkbox], select')].find((e) => e.offsetParent !== null && e.id !== 'mx-filter-close');
      if (!b) return 'kein Bedienelement';
      b.click();
      return b.tagName.toLowerCase() + (b.id ? '#' + b.id : '');
    });
    await pg.waitForTimeout(700);
    schritte.push('geklickt=' + geklickt);
    schritte.push('Treffer ' + vorher + ' -> ' + (await zahl()));
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(600);
    const zu = await pg.evaluate(() => {
      const p = document.querySelector('.mx__bar');
      return p.classList.contains('is-open') + '/' + p.hasAttribute('inert');
    });
    schritte.push('nach Esc offen/inert=' + zu);
  } else {
    const p = await pg.evaluate(() => {
      const e = document.querySelector('.mx__bar');
      const st = getComputedStyle(e);
      return { inert: e.hasAttribute('inert'), pos: st.position, sichtbar: e.getBoundingClientRect().left >= 0 };
    });
    schritte.push('kein Schubladenknopf (Spaltenmodus) — inert=' + p.inert + ' position=' + p.pos + ' im Bild=' + p.sichtbar);
  }
  console.log('[' + vp + '] ' + schritte.join('  |  ') + (fehler.length ? '   JS-FEHLER: ' + fehler[0] : ''));
  await ctx.close();
}
await b.close(); srv.close();
