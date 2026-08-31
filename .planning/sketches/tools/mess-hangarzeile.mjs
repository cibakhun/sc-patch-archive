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
await new Promise((r) => srv.listen(4280, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
for (const vp of (process.env.VP_LIST || '844x390,932x430,390x844,1280x720').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 932, isMobile: w <= 932 });
  const pg = await ctx.newPage();
  await pg.goto('http://127.0.0.1:4280/schiffe/aegs-avenger-stalker.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  const r = await pg.evaluate(() => {
    const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), txt: e.textContent.trim().slice(0, 24) }; };
    const rail = box('.holo__rail');
    /* Die Kopfzeile des Raums: Hersteller links, Masskette rechts. */
    const kand = [...document.querySelectorAll('.holo *')].filter((e) => /HANGAR|hangar/.test(e.textContent) && e.children.length <= 3 && e.textContent.length < 60);
    const kopf = kand.length ? kand[kand.length - 1] : null;
    const kr = kopf ? kopf.getBoundingClientRect() : null;
    return { rail, kopf: kr ? { t: Math.round(kr.top), b: Math.round(kr.bottom), txt: kopf.textContent.trim().slice(0, 30), cls: kopf.className } : null };
  });
  let urteil = 'kein Kopf gefunden';
  if (r.kopf && r.rail) {
    const ueb = Math.min(r.rail.b, r.kopf.b) - Math.max(r.rail.t, r.kopf.t);
    urteil = ueb > 2 ? 'UEBERLAPPUNG ' + ueb + 'px' : 'frei (' + (r.kopf.t - r.rail.b) + 'px Abstand)';
  }
  console.log(vp.padEnd(9) + ' Blende ' + (r.rail ? r.rail.t + '–' + r.rail.b : '?').padEnd(10) + ' | Kopfzeile ' + (r.kopf ? r.kopf.t + '–' + r.kopf.b + ' .' + r.kopf.cls : '?').padEnd(34) + ' → ' + urteil);
  await ctx.close();
}
await b.close(); srv.close();
