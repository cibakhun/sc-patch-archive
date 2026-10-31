/* „Werkzeug, keine Leinwand": wie tief liegt das erste Bedienelement des
   Hauptbereichs, und ist es beim Laden im Bild? Gemessen wird der Zustand,
   den ein ERSTBESUCHER sieht — also mit selbst aufgeklappter Hilfe. */
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
  let b;
  try { b = await readFile(f); } catch { res.writeHead(404); res.end('x'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(b);
});
await new Promise((r) => srv.listen(4325, '127.0.0.1', r));
const b = await chromium.launch({ executablePath: CHROME });
for (const vp of (process.env.VP_LIST || '1024x768,1024x600,1280x720,1181x560,768x1024').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  for (const u of process.argv.slice(2)) {
    /* Frisches Profil je Messung: die Hilfe merkt sich den Erstbesuch. */
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark' });
    const pg = await ctx.newPage();
    await pg.goto('http://127.0.0.1:4325' + u, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1300);
    const r = await pg.evaluate(() => {
      const haupt = document.querySelector('main, .mx__main, [role=main]') || document.body;
      const kandidaten = [...haupt.querySelectorAll('button, input, select, a[href], summary')]
        .filter((e) => !e.closest('nav, header, .snav, .dp-bar, .tool-help'))
        .filter((e) => !e.checkVisibility || e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter((x) => x.r.width > 20 && x.r.height > 12)
        /* ⚠ Auch die WAAGERECHTE Lage pruefen: die geschlossene
           Filter-Schublade steht bei x = −288 und ihr Schliessen-Knopf
           bei top = 17. Ohne diese Zeile meldete die Sonde ihn als
           „erste Bedienung bei 17px = 3 %" — auf drei von fuenf
           Aufloesungen, und genau dort, wo die Schublade wirkt. */
        .filter((x) => x.r.right > 0 && x.r.left < window.innerWidth)
        .sort((a, b) => a.r.top - b.r.top);
      if (!kandidaten.length) return null;
      const k = kandidaten[0];
      const hilfe = document.querySelector('details.tool-help, .tool-help details, details[class*=help]');
      return { top: Math.round(k.r.top), vh: window.innerHeight,
               sel: k.e.tagName.toLowerCase() + (k.e.id ? '#' + k.e.id : '') + (typeof k.e.className === 'string' && k.e.className.trim() ? '.' + k.e.className.trim().split(/\s+/)[0] : ''),
               txt: (k.e.textContent || k.e.placeholder || '').trim().slice(0, 22),
               hilfeOffen: hilfe ? hilfe.hasAttribute('open') : null };
    });
    if (!r) { console.log(`[${vp}] ${u}  kein Bedienelement gefunden`); }
    else {
      const anteil = Math.round((r.top / r.vh) * 100);
      const urteil = r.top < r.vh ? 'im Bild' : 'UNTER DER KANTE';
      console.log(`[${vp}] ${u.padEnd(18)} erste Bedienung bei ${String(r.top).padStart(4)}px = ${String(anteil).padStart(3)} %  → ${urteil}   (${r.sel} „${r.txt}", Hilfe offen: ${r.hilfeOffen})`);
    }
    await ctx.close();
  }
}
await b.close(); srv.close();
