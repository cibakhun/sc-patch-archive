/* AUSWAHLFELD SCHMALER ALS SEIN EIGENER TEXT.
   Ein `<select>` bekommt vom Browser keine Ellipse: passt der gewaehlte
   Optionstext nicht, wird er hart abgeschnitten, und der Aufklapp-Pfeil
   steht direkt hinter dem Torso des Wortes. Auf dem Bildschirm liest man
   dann „All manufact⌄" — und weiss nicht, ob das Feld kaputt ist oder ob
   der Eintrag wirklich so heisst.

   ⚠ Warum kein Ueberlauf-Tor das findet: `select` hat `overflow:hidden`
   von Haus aus, `scrollWidth` ist bei ihm gleich `clientWidth`. Der
   Ueberstand existiert im Kasten-Modell gar nicht. Gemessen werden muss
   die BREITE DES TEXTES in der Schrift des Feldes — hier gegen einen
   unsichtbaren Klon.

   Gefunden am 31.08.2026 auf /schiffe.html: bei 320 px waren 6 von 7
   Feldern zu schmal, bei 390 px noch 2.

   Gilt genauso fuer `<option>`-Listen mit langen Eintraegen und fuer
   Knoepfe mit `white-space:nowrap`; beide werden hier mitgemessen.

   PAGES_FILE=pages-werkzeuge.json VP_LIST=320x568,360x640,390x844 \
     node .planning/sketches/tools/probe-abgeschnittenes-feld.mjs         */
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
const PORT = Number(process.env.PORT_NR || 4271);
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
const PAGES = JSON.parse(await readFile(join(OUT, process.env.PAGES_FILE || 'pages.json'), 'utf8'));

const PROBE = () => {
  const nm = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const sicht = (el) => !el.checkVisibility || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true });
  const out = [];
  const lineal = document.createElement('span');
  lineal.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre';
  document.body.appendChild(lineal);
  const breiteVon = (text, st) => {
    lineal.style.font = st.font;
    lineal.style.letterSpacing = st.letterSpacing;
    lineal.style.textTransform = st.textTransform;
    lineal.textContent = text;
    return lineal.getBoundingClientRect().width;
  };

  for (const s of document.querySelectorAll('select')) {
    if (!sicht(s)) continue;
    const r = s.getBoundingClientRect();
    if (r.width < 8) continue;
    const st = getComputedStyle(s);
    const opt = s.options[s.selectedIndex];
    if (!opt) continue;
    /* Der Pfeil des Browsers braucht rechts Platz. Chromium nimmt dafuer
       rund 16 px; wo die Seite ein eigenes Hintergrundbild als Pfeil setzt,
       steckt der Platz schon in padding-right. Konservativ: 14 px, und nur
       melden, wenn mehr als 4 px wirklich fehlen. */
    const pfeil = st.appearance === 'none' || /url\(|gradient/.test(st.backgroundImage) ? 0 : 14;
    const noetig = breiteVon(opt.text, st)
      + parseFloat(st.paddingLeft) + parseFloat(st.paddingRight)
      + parseFloat(st.borderLeftWidth) + parseFloat(st.borderRightWidth) + pfeil;
    const fehlt = Math.round(noetig - r.width);
    if (fehlt > 4) out.push({ sel: nm(s), art: 'select', text: opt.text.slice(0, 28), hat: Math.round(r.width), fehlt });
  }

  /* Knoepfe und Etiketten mit nowrap: dort schneidet `overflow:hidden`
     ebenso, und ohne hidden laeuft der Text aus seinem Kasten heraus. */
  for (const el of document.querySelectorAll('button,a,label,summary,th,td,span,div')) {
    if (!sicht(el)) continue;
    const st = getComputedStyle(el);
    if (st.whiteSpace !== 'nowrap' && st.whiteSpace !== 'pre') continue;
    if (st.textOverflow === 'ellipsis') continue;      /* Absicht, sichtbar gemacht */
    if (st.overflow === 'visible') continue;           /* laeuft heraus — andere Klasse */
    const eigen = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (eigen.length < 3) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8) continue;
    const noetig = breiteVon(eigen, st) + parseFloat(st.paddingLeft) + parseFloat(st.paddingRight);
    const fehlt = Math.round(noetig - r.width);
    if (fehlt > 4) out.push({ sel: nm(el), art: 'nowrap', text: eigen.slice(0, 28), hat: Math.round(r.width), fehlt });
  }
  lineal.remove();
  return out;
};

const browser = await chromium.launch({ executablePath: CHROME });
const g = {};
let geprueft = 0;
for (const vp of (process.env.VP_LIST || '390x844').split(',')) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: w <= 932 });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  let n = 0;
  for (const url of PAGES) {
    try {
      await page.goto(`http://127.0.0.1:${PORT}` + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
      const r = await page.evaluate(PROBE);
      geprueft++;
      for (const x of r.slice(0, 6)) {
        const k = `${x.art} ${x.sel} „${x.text}" (hat ${x.hat}, fehlt ${x.fehlt})`;
        (g[k] ||= { seiten: new Set(), vps: new Set(), fehlt: 0 });
        g[k].seiten.add(url); g[k].vps.add(vp);
        g[k].fehlt = Math.max(g[k].fehlt, x.fehlt);
      }
    } catch { /* uebersprungen */ }
    if (++n % 60 === 0) process.stderr.write(`  … ${n}\n`);
  }
  await ctx.close();
  process.stderr.write(`[${vp}] fertig\n`);
}
await browser.close(); srv.close();

const e = Object.entries(g).sort((a, b) => b[1].fehlt - a[1].fehlt);
console.log(`\nMessungen: ${geprueft}`);
console.log(`ABGESCHNITTENE FELDER: ${e.length} Muster`);
if (!e.length) console.log('  keine');
for (const [k, v] of e.slice(0, 25))
  console.log(`  ${String(v.seiten.size).padStart(3)} Seiten [${[...v.vps].join(',')}]  ${k}\n        (${[...v.seiten].slice(0, 2).join(' ')})`);
