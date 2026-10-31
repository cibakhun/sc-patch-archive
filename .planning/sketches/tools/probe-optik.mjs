/* VERZERRTE BILDER — das gerenderte Seitenverhaeltnis weicht vom
   natuerlichen ab, ohne dass `object-fit` es auffaengt.

   ⚠⚠ WAS HIER FRUEHER STAND UND WARUM ES WEG IST (30.08.2026)
   Diese Sonde hatte zwei weitere Klassen, die BEIDE nur Fehlalarme
   lieferten. Sie stehen hier als Warnung, damit sie niemand ein zweites
   Mal baut:

   „TEXT AUF TEXT" — drei Anlaeufe, 47 / 28 / 11 gemeldete Muster, davon
   nachgesehen NULL echte:
     1. getBoundingClientRect(): bei einem Inline-Element ueber mehrere
        Zeilen ist das die VEREINIGUNG aller Zeilen. Ein Chip im
        Fliesstext „ueberlappt" den Absatz damit zu 100 %.
     2. getClientRects() (die echten Zeilenkaesten): besser, aber der
        „NO IMAGE"-Platzhalter einer Schiffskarte ist so gross wie das
        Medienfeld und schneidet Hersteller, Name und Status — verdeckt
        aber nichts, weil er dahinter liegt.
     3. elementFromPoint auf der Textmitte: meldete auf 40 Patch-Seiten
        „eyebrow unter h1". Nachgesehen (Ausschnitt bei 844x390, zweifach
        vergroessert) ist die Augenbraue vollstaendig lesbar — die h1
        darunter hat font-size 186px und einen Kasten, der ueberall
        trifft, auch dort wo keine Glyphe steht.
   Der gemeinsame Grund: das DOM weiss, wo ein KASTEN liegt, nicht wo eine
   GLYPHE gemalt wird. Verlaesslich ginge das nur ueber einen
   Bildpunktvergleich. Bis dahin gilt Grundsatz 3 aus CLAUDE.md —
   Fehlalarme sind teurer als Luecken.

   „FAST LEERER BILDSCHIRM" — dieselbe Geschichte: die Belegungsrechnung
   zaehlt Elemente mit EIGENEM Text, und in einer Karte traegt den Text
   das Enkelkind. /archiv.html wurde als „11 % belegt" gemeldet und war
   im Bild randvoll mit Zeitstrahl-Karten.

   PAGES_FILE=pages-breit.json VP_LIST=390x844,844x390 \
     node .planning/sketches/tools/probe-optik.mjs                          */
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
await new Promise((r) => srv.listen(4259, '127.0.0.1', r));
const PAGES = JSON.parse(await readFile(join(OUT, process.env.PAGES_FILE || 'pages.json'), 'utf8'));

const PROBE = () => {
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const sicht = (el) => !el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true });
  const out = [];
  for (const img of document.querySelectorAll('img')) {
    if (!sicht(img)) continue;
    if (!img.naturalWidth || !img.naturalHeight) continue;
    const st = getComputedStyle(img);
    /* cover/contain/scale-down halten das Verhaeltnis selbst ein. */
    if (st.objectFit === 'cover' || st.objectFit === 'contain' || st.objectFit === 'scale-down') continue;
    const r = img.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) continue;
    const soll = img.naturalWidth / img.naturalHeight, ist = r.width / r.height;
    const abw = Math.abs(ist - soll) / soll;
    if (abw > 0.12) out.push({ sel: nm(img), abw: Math.round(abw * 100), soll: soll.toFixed(2), ist: ist.toFixed(2) });
  }
  return out;
};

const browser = await chromium.launch({ executablePath: CHROME });
const g = {};
let geprueft = 0;
for (const vp of (process.env.VP_LIST || '390x844').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 820 });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  let n = 0;
  for (const url of PAGES) {
    try {
      await page.goto('http://127.0.0.1:4259' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      const r = await page.evaluate(PROBE);
      geprueft++;
      for (const x of r.slice(0, 4)) {
        const k = `${x.sel} ${x.abw}% (soll ${x.soll}, ist ${x.ist})`;
        (g[k] ||= { seiten: new Set(), vps: new Set() });
        g[k].seiten.add(url); g[k].vps.add(vp);
      }
    } catch { /* uebersprungen */ }
    if (++n % 60 === 0) process.stderr.write(`  … ${n}\n`);
  }
  await ctx.close();
  process.stderr.write(`[${vp}] fertig\n`);
}
await browser.close(); srv.close();

const e = Object.entries(g).sort((a, b) => b[1].seiten.size - a[1].seiten.size);
console.log(`\nMessungen: ${geprueft}`);
console.log(`VERZERRTE BILDER: ${e.length} Muster`);
if (!e.length) console.log('  keine');
for (const [k, v] of e.slice(0, 15))
  console.log(`  ${String(v.seiten.size).padStart(3)} Seiten [${[...v.vps].join(',')}]  ${k}\n        (${[...v.seiten].slice(0, 2).join(' ')})`);
