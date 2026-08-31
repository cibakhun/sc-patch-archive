/* STILL GEKAPPTER INHALT — die Luecke, die alle Ueberlauf-Tore lassen.

   `html { overflow-x: clip }` (Layout.astro) schneidet waagerechten
   Ueberstand ab, OHNE dass er in `scrollWidth` auftaucht. Genauso jeder
   Kasten mit `overflow:hidden`. Ein Element, das darunter ueber die
   rechte Kante ragt, ist damit unsichtbar UND unmessbar: das
   Ueberlauf-Tor meldet 0, und der Leser sieht die halbe Zeile.

   Gemessen wird deshalb nicht der Ueberlauf des Dokuments, sondern die
   LAGE jedes sichtbaren Textelements gegen die Fensterkante — und ob ein
   Vorfahre den Ueberstand wegschneidet.

   ⚠ Erwartete Fehlalarm-Quellen, hier bereits ausgeschlossen:
     - waagerechte Bildlaufkaesten (dort ist Ueberstand ABSICHT, der
       Leser scrollt): jeder Vorfahre mit overflow-x auto/scroll.
     - Dekoration ohne eigenen Text.
     - Elemente ausserhalb des Bildes (aria-hidden, Off-Canvas).

   GEGENPROBE 31.08.2026 — eine Sonde, die nie etwas findet, ist
   Dekoration. Bei 240x568 (unter jedem realen Geraet) meldet sie
   verlaesslich vier Faelle:
       h1 „VerseBase"        20px drueber, gekappt von body
       span.fprice__u „aUEC" 10px drueber, gekappt von dd.v   (3x)
   Bei 320x568 und 390x844 ueber dieselben Seiten: 0. Die Sonde ist also
   scharf, und die Site ist ab der schmalsten realen Geraetebreite sauber.

   PAGES_FILE=pages-massiv.json VP_LIST=320x568 \
     node .planning/sketches/tools/probe-still-gekappt.mjs               */
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
const PORT = Number(process.env.PORT_NR || 4321);
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
const PAGES = process.argv.slice(2).length ? process.argv.slice(2)
  : JSON.parse(await readFile(join(resolve(process.cwd()), '.planning/sketches/tools/out', process.env.PAGES_FILE || 'pages.json'), 'utf8'));

const PROBE = () => {
  const vw = window.innerWidth;
  const out = [];
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  for (const el of document.querySelectorAll('body *')) {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) continue;
    /* Nur Elemente mit EIGENEM Text — Container melden sonst dasselbe
       noch einmal, und Dekoration hat nichts zu verlieren. */
    const eigen = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (eigen.length < 4) continue;
    const r = el.getBoundingClientRect();
    const drueber = Math.round(r.right - vw);
    if (drueber < 6) continue;
    if (r.left > vw) continue;                     /* ganz draussen: Off-Canvas */
    /* Schneidet ein Vorfahre wirklich? Und ist es KEIN Bildlaufkasten? */
    let schneidet = null, scrollbar = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const st = getComputedStyle(p);
      const ox = st.overflowX;
      if (ox === 'auto' || ox === 'scroll') { scrollbar = true; break; }
      if ((ox === 'hidden' || ox === 'clip') && !schneidet) schneidet = nm(p);
    }
    if (scrollbar) continue;
    const stH = getComputedStyle(document.documentElement).overflowX;
    if (!schneidet && (stH === 'hidden' || stH === 'clip')) schneidet = 'html';
    if (!schneidet) continue;                      /* echter Ueberlauf — anderes Tor */
    out.push({ sel: nm(el), txt: eigen.slice(0, 30), drueber, durch: schneidet });
  }
  return out;
};

const browser = await chromium.launch({ executablePath: CHROME });
const g = {};
let n = 0;
for (const vp of (process.env.VP_LIST || '320x568').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  for (const u of PAGES) {
    try {
      await page.goto('http://127.0.0.1:' + PORT + u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      const r = await page.evaluate(PROBE);
      n++;
      for (const x of r.slice(0, 4)) {
        const k = `${x.sel}  „${x.txt}"  ${x.drueber}px drueber, gekappt von ${x.durch}  [${vp}]`;
        (g[k] ||= new Set()).add(u);
      }
    } catch { /* uebersprungen */ }
  }
  await ctx.close();
  process.stderr.write(`[${vp}] fertig\n`);
}
await browser.close(); srv.close();
const e = Object.entries(g).sort((a, b) => b[1].size - a[1].size);
console.log(`\nMessungen: ${n}   STILL GEKAPPT: ${e.length} Muster`);
if (!e.length) console.log('  keine');
for (const [k, v] of e.slice(0, 20))
  console.log(`  ${String(v.size).padStart(4)} Seiten  ${k}\n           (${[...v].slice(0, 2).join('  ')})`);
