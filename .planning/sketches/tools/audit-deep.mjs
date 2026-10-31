/* Tiefenpruefung zum Aufloesungs-Durchgang.
   Zusaetzlich zu audit-responsive.mjs:
     - HITTEST: liefert elementFromPoint in der Mitte jedes Bedienelements
       wirklich dieses Element? Deckt genau das Risiko ab, das ein
       aufgespanntes ::after einbaut — es kann den NACHBARN verdecken.
     - Ueberlappung zweier Bedienelemente (Flaechenanteil).
     - Kopfleisten-Verdeckung: liegt der erste Text unter der festen Nav?
   Aufruf:
     PAGES_FILE=out/pages-breit.json VP_LIST=320x568,844x390 \
       node .planning/sketches/tools/audit-deep.mjs
   Ausgabe: out/deep.json */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, '.planning/sketches/tools/out');
const CHROME = [
  join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));
if (!CHROME) throw new Error('Kein Browser gefunden');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

async function serve(port) {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    let file = join(DIST, p);
    try {
      const s = await stat(file).catch(() => null);
      if (s && s.isDirectory()) file = join(file, 'index.html');
      else if (!s && !extname(file)) {
        if (existsSync(file + '.html')) file += '.html';
        else if (existsSync(join(file, 'index.html'))) file = join(file, 'index.html');
      }
      const buf = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(buf);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('404 ' + p);
    }
  });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  return srv;
}

const VIEWPORTS = (process.env.VP_LIST || '320x568,390x844,768x1024,1024x768,1280x720,1920x1080')
  .split(',').map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { name: s, width: w, height: h, mobile: w <= 820 };
  });

const PAGES = JSON.parse(await readFile(join(OUT, process.env.PAGES_FILE || 'pages.json'), 'utf8'));
const CAP = Number(process.env.HIT_CAP || 500);

const PROBE = (cap) => {
  const out = { overflowPx: 0, wide: [], verdeckt: [], ueberlappt: [], unterNav: [], meta: {} };
  const de = document.documentElement;
  const vw = de.clientWidth, vh = de.clientHeight;
  out.meta.vw = vw; out.meta.vh = vh;
  out.overflowPx = Math.round(de.scrollWidth - vw);
  out.clipPx = Math.round(Math.max(0, document.body.scrollWidth - vw));

  const path = (el) => {
    const bits = []; let n = el, d = 0;
    while (n && n.nodeType === 1 && d < 4) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      else if (n.className && typeof n.className === 'string') {
        const c = n.className.trim().split(/\s+/).slice(0, 3).join('.');
        if (c) s += '.' + c;
      }
      bits.unshift(s); n = n.parentElement; d++;
    }
    return bits.join(' > ');
  };
  const vis = (el, st, r) => {
    if (!(r.width > 0 && r.height > 0)) return false;
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return false;
    if (el.closest('[hidden],[aria-hidden="true"]')) return false;
    /* ⚠ Ein geschlossenes <details> liefert fuer seinen Inhalt WEITERHIN
       einen Kasten mit Groesse — gemessen 30.08.2026 an .cdb-subs: 167 px
       hoch, aber unsichtbar. checkVisibility() kennt den Unterschied,
       getComputedStyle nicht. Ohne diese Zeile meldet der Messer
       Phantom-Ueberlaeufe und Phantom-Verdeckungen. */
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) return false;
    if (/inset\(50%\)|rect\(/.test(st.clipPath) || st.clip !== 'auto') return false;
    if (r.width <= 2 && r.height <= 2) return false;
    if (r.right <= 1 || r.left >= vw - 1) return false;
    return true;
  };

  /* --- waagerechter Ueberlauf (wie im Hauptmesser) --- */
  const flagged = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!vis(el, st, r)) continue;
    if ((r.right > vw + 2 || r.left < -2) && st.position !== 'fixed') {
      let clip = false, n = el.parentElement;
      while (n && n !== document.body) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(n).overflowX)) { clip = true; break; }
        n = n.parentElement;
      }
      if (!clip) flagged.add(el);
    }
  }
  for (const el of flagged) {
    let deeper = false;
    for (const c of flagged) if (c !== el && el.contains(c)) { deeper = true; break; }
    if (deeper) continue;
    const r = el.getBoundingClientRect();
    out.wide.push({ sel: path(el), over: Math.round(r.right - vw) });
  }

  /* --- HITTEST: ist die Mitte des Bedienelements wirklich es selbst? --- */
  const TAP = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role="button"],[role="tab"],[role="switch"]';
  const alle = Array.from(document.querySelectorAll(TAP));
  out.meta.tapGesamt = alle.length;
  const kandidaten = [];
  for (const el of alle) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!vis(el, st, r)) continue;
    if (el.disabled) continue;
    if (r.top < 0 || r.bottom > vh) continue;   /* nur was im Bild steht */
    kandidaten.push({ el, r });
  }
  out.meta.tapImBild = kandidaten.length;
  out.meta.tapGeprueft = Math.min(kandidaten.length, cap);
  const probe = kandidaten.slice(0, cap);

  for (const { el, r } of probe) {
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(x, y);
    if (!top) continue;
    if (top === el || el.contains(top) || top.contains(el)) continue;
    /* Ein Etikett, das SEIN eigenes Feld trifft, ist in Ordnung. */
    if (el.tagName === 'LABEL' && (el.control === top || (el.htmlFor && document.getElementById(el.htmlFor) === top))) continue;
    if (top.closest('label') === el) continue;
    out.verdeckt.push({ sel: path(el), von: path(top), txt: (el.textContent || '').trim().slice(0, 26) });
  }

  /* --- Ueberlappung zweier BEDIENELEMENTE (Flaeche > 25 %) --- */
  for (let i = 0; i < probe.length; i++) {
    for (let j = i + 1; j < probe.length; j++) {
      const a = probe[i], b = probe[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox <= 0 || oy <= 0) continue;
      const flaeche = ox * oy;
      const kleiner = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      if (kleiner > 0 && flaeche / kleiner > 0.25)
        out.ueberlappt.push({ a: path(a.el), b: path(b.el), pct: Math.round((flaeche / kleiner) * 100) });
    }
  }

  /* --- Verdeckung durch die feste Kopfleiste --- */
  const nav = document.querySelector('nav#topbar, header.snav, .snav');
  if (nav) {
    const nr = nav.getBoundingClientRect();
    if (getComputedStyle(nav).position === 'fixed' && nr.height > 0) {
      const main = document.querySelector('main, .dp, body');
      if (main) {
        for (const el of main.querySelectorAll('h1,h2,p,li,td,input,button,a[href]')) {
          const r = el.getBoundingClientRect();
          if (r.height === 0 || r.top < 0) continue;
          /* Die Leiste selbst und alles darin zaehlt nicht — sie verdeckt sich
             nicht. Ebenso wenig, was mitklebt (Brotkrumen, Filterleisten). */
          if (nav.contains(el) || el.closest('nav,header')) continue;
          if (r.top < nr.bottom - 2 && r.bottom > nr.top + 2) {
            const st = getComputedStyle(el);
            if (st.position === 'fixed' || st.position === 'sticky') continue;
            if (el.closest('[style*="position:fixed"]')) continue;
            let p = el.parentElement, klebt = false;
            while (p && p !== document.body) {
              const ps = getComputedStyle(p);
              if (ps.position === 'fixed' || ps.position === 'sticky') { klebt = true; break; }
              p = p.parentElement;
            }
            if (klebt) continue;
            if (!vis(el, st, r)) continue;
            out.unterNav.push({ sel: path(el), top: Math.round(r.top), navBottom: Math.round(nr.bottom) });
            break;
          }
        }
      }
    }
  }
  return out;
};

await mkdir(OUT, { recursive: true });
const PORT = Number(process.env.PORT_NR || 4201);
const srv = await serve(PORT);
const browser = await chromium.launch({ executablePath: CHROME });
const results = [];
let n = 0;
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1,
    colorScheme: 'dark', hasTouch: vp.mobile,
  });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  for (const url of PAGES) {
    try {
      await page.goto(`http://127.0.0.1:${PORT}${url}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(280);
      const r = await page.evaluate(PROBE, CAP);
      results.push({ url, vp: vp.name, ...r });
    } catch (e) {
      results.push({ url, vp: vp.name, error: String(e).slice(0, 140) });
    }
    if (++n % 50 === 0) process.stderr.write(`  … ${n}\n`);
  }
  await ctx.close();
  process.stderr.write(`[${vp.name}] fertig\n`);
}
await browser.close();
srv.close();
await writeFile(join(OUT, process.env.OUT_FILE || 'deep.json'), JSON.stringify(results, null, 1));
console.log(`${results.length} Messungen -> ${process.env.OUT_FILE || 'deep.json'}`);
