/* SENKRECHTER Ueberstand: ragt ein Kind unten aus einem Elternkasten mit
   FESTER Hoehe heraus, obwohl der Kasten nichts abschneidet? Dann liegt der
   Inhalt ueber dem, was darunter kommt.

   Diese Klasse hat die Mining-Werkbank am 30.08.2026 auf dem Telefon
   zerlegt: das Geraet rechnete 712 px aus der Fensterhoehe, der Inhalt
   brauchte 779 — die Erzliste lag ueber der Fusszeile. Keine der bis dahin
   gefahrenen Messungen (Ueberlauf, Zielgroesse, Schrift) konnte das sehen.

   PAGES_FILE=pages-breit.json VP_LIST=390x844,320x568 \
     node .planning/sketches/tools/probe-ueberstand.mjs                    */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
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
await new Promise((r) => srv.listen(4229, '127.0.0.1', r));

const PAGES = JSON.parse(await readFile(join(OUT, process.env.PAGES_FILE || 'pages.json'), 'utf8'));
const VPS = (process.env.VP_LIST || '390x844,320x568').split(',');

const PROBE = () => {
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const sicht = (el) => !el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true });
  const raus = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!sicht(el)) continue;
    const st = getComputedStyle(el);
    /* Nur Kaesten mit AUSGERECHNETER, nicht inhaltsbestimmter Hoehe. */
    if (st.height === 'auto') continue;
    if (/(hidden|clip|auto|scroll)/.test(st.overflowY)) continue;  /* schneidet ab oder scrollt */
    if (st.display === 'inline' || st.display === 'contents') continue;
    const r = el.getBoundingClientRect();
    if (r.height < 40) continue;
    let maxUnten = r.bottom, schuld = null;
    for (const c of el.children) {
      if (!sicht(c)) continue;
      const cs = getComputedStyle(c);
      if (cs.position === 'absolute' || cs.position === 'fixed') continue; /* Deko liegt bewusst drueber */
      const cr = c.getBoundingClientRect();
      if (cr.bottom > maxUnten + 2) { maxUnten = cr.bottom; schuld = c; }
    }
    if (schuld) raus.push({ kasten: nm(el), kind: nm(schuld), ueber: Math.round(maxUnten - r.bottom), kastenH: Math.round(r.height), cssH: st.height });
  }
  /* nur die groessten je Kasten */
  const best = {};
  for (const x of raus) if (!best[x.kasten] || best[x.kasten].ueber < x.ueber) best[x.kasten] = x;
  return Object.values(best).sort((a, b) => b.ueber - a.ueber).slice(0, 12);
};

const browser = await chromium.launch({ executablePath: CHROME });
const alles = [];
for (const vp of VPS) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  let n = 0;
  for (const url of PAGES) {
    try {
      await page.goto('http://127.0.0.1:4229' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      const r = await page.evaluate(PROBE);
      if (r.length) alles.push({ url, vp, treffer: r });
    } catch { /* Seite uebersprungen */ }
    if (++n % 50 === 0) process.stderr.write(`  … ${n}\n`);
  }
  await ctx.close();
  process.stderr.write(`[${vp}] fertig\n`);
}
await browser.close(); srv.close();
await writeFile(join(OUT, process.env.OUT_FILE || 'ueberstand.json'), JSON.stringify(alles, null, 1));

const g = {};
for (const a of alles) for (const t of a.treffer) {
  const k = t.kasten + '  <-  ' + t.kind;
  (g[k] ||= { max: 0, seiten: new Set(), vps: new Set() });
  g[k].max = Math.max(g[k].max, t.ueber); g[k].seiten.add(a.url); g[k].vps.add(a.vp);
}
console.log(`\nSENKRECHTER UEBERSTAND aus Kaesten mit fester Hoehe: ${Object.keys(g).length} Muster`);
Object.entries(g).sort((a, b) => b[1].max - a[1].max).slice(0, 25).forEach(([k, v]) =>
  console.log(`  +${v.max}px  ${v.seiten.size} Seiten [${[...v.vps].join(',')}]  ${k}\n        (${[...v.seiten].slice(0, 2).join(' ')})`));
