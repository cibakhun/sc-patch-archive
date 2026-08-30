/* Aufloesungs-Durchgang: misst dist/ ueber viele Viewports.
   Aufruf:  node .planning/sketches/tools/audit-responsive.mjs [--pages=a,b] [--vp=360x740]
   Ausgabe: .planning/sketches/tools/out/responsive.json + Kurzbericht auf stdout. */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, '.planning/sketches/tools/out');

const CHROME = [
  `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium_headless_shell-1228\\chrome-headless-shell-win64\\chrome-headless-shell.exe`,
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

const VIEWPORTS = (process.env.VP_LIST || [
  '320x568', '360x740', '390x844', '414x896',
  '768x1024', '820x1180', '1024x768', '1181x560', '1280x720', '1920x1080',
].join(',')).split(',').map((s) => {
  const [w, h] = s.split('x').map(Number);
  return { name: s, width: w, height: h, mobile: w <= 820 };
});

const PAGES = JSON.parse(await readFile(join(OUT, 'pages.json'), 'utf8'));

/* ---- Messung im Browser ---------------------------------------------- */
const PROBE = () => {
  const out = { overflowPx: 0, wide: [], clipped: [], tiny: [], smallFont: [], traps: [], meta: {} };
  const de = document.documentElement;
  const vw = de.clientWidth, vh = de.clientHeight;
  out.meta.vw = vw; out.meta.vh = vh;
  out.meta.scrollW = Math.max(de.scrollWidth, document.body.scrollWidth);
  out.meta.deScrollW = de.scrollWidth;
  out.meta.bodyScrollW = document.body.scrollWidth;
  out.meta.scrollH = Math.max(de.scrollHeight, document.body.scrollHeight);
  out.meta.vbTop = getComputedStyle(de).getPropertyValue('--vb-top').trim();
  /* Nur was das Wurzelelement WIRKLICH schiebt, ist ein Ueberlauf. Ein
     groesseres body.scrollWidth bedeutet: der Inhalt ist abgeschnitten
     (haeufig dekorative Hintergrundschichten) — separat als clipPx. */
  out.overflowPx = Math.round(de.scrollWidth - vw);
  out.clipPx = Math.round(Math.max(0, document.body.scrollWidth - vw));
  const vp = document.querySelector('meta[name="viewport"]');
  out.meta.viewportTag = vp ? vp.getAttribute('content') : null;

  const path = (el) => {
    const bits = [];
    let n = el, d = 0;
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
    /* nur-fuer-Screenreader / bewusst geparkt */
    if (el.closest('[hidden],[aria-hidden="true"]')) return false;
    /* ⚠ Ein geschlossenes <details> liefert fuer seinen Inhalt WEITERHIN
       einen Kasten mit Groesse — gemessen 30.08.2026 an .cdb-subs: 167 px
       hoch, aber unsichtbar. checkVisibility() kennt den Unterschied,
       getComputedStyle nicht. Ohne diese Zeile meldet der Messer
       Phantom-Ueberlaeufe und Phantom-Verdeckungen. */
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) return false;
    if (/inset\(50%\)|rect\(/.test(st.clipPath) || st.clip !== 'auto') return false;
    if (r.width <= 2 && r.height <= 2) return false;
    if (r.right <= 1 || r.left >= vw - 1) return false;   /* off-canvas geparkt */
    return true;
  };

  const all = Array.from(document.querySelectorAll('body *'));
  const flagged = new Set();

  for (const el of all) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!vis(el, st, r)) continue;

    /* a) waagerechter Ueberlauf, der NICHT in einem Scrollkasten steckt */
    if (r.right > vw + 1 || r.left < -1) {
      if (st.position !== 'fixed') {
        let clipped = false, n = el.parentElement;
        while (n && n !== document.body) {
          const ps = getComputedStyle(n);
          if (/(auto|scroll|hidden|clip)/.test(ps.overflowX)) { clipped = true; break; }
          n = n.parentElement;
        }
        if (!clipped && (r.right > vw + 2 || r.left < -2)) flagged.add(el);
      }
    }

    /* b) abgeschnittener Inhalt in einem Kasten ohne Bildlauf */
    if (/(hidden|clip)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 4) {
      const txt = (el.textContent || '').trim().slice(0, 40);
      if (st.textOverflow !== 'ellipsis' && el.childElementCount < 40) {
        out.clipped.push({ sel: path(el), cut: el.scrollWidth - el.clientWidth, txt });
      }
    }

    /* c) Schrift unter 12 px mit echtem Text */
    const fs = parseFloat(st.fontSize);
    if (fs && fs < 11.5) {
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own) out.smallFont.push({ sel: path(el), px: Math.round(fs * 10) / 10, txt: el.textContent.trim().slice(0, 30) });
    }
  }

  /* nur die TIEFSTEN Ueberlaeufer melden (das ist der echte Verursacher) */
  for (const el of flagged) {
    let hasFlaggedChild = false;
    for (const c of flagged) if (c !== el && el.contains(c)) { hasFlaggedChild = true; break; }
    if (hasFlaggedChild) continue;
    const r = el.getBoundingClientRect();
    out.wide.push({ sel: path(el), w: Math.round(r.width), right: Math.round(r.right), over: Math.round(r.right - vw) });
  }

  /* d) Fingerkuppen */
  const TAP = 'a,button,input,select,textarea,summary,label,[role="button"],[role="tab"],[role="switch"],[tabindex]';
  for (const el of document.querySelectorAll(TAP)) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!vis(el, st, r)) continue;
    if (el.type === 'hidden' || el.disabled) continue;
    let w = r.width, h = r.height;
    for (const pe of ['::before', '::after']) {
      const ps = getComputedStyle(el, pe);
      if (ps.content === 'none' || ps.position !== 'absolute') continue;
      const g = (v) => (v === 'auto' ? 0 : parseFloat(v) || 0);
      /* Gestreckter Verweis: ::after mit inset:0 spannt die GANZE Karte auf.
         Der enthaltende Block ist der naechste positionierte Vorfahr. */
      const stretched = ['top', 'right', 'bottom', 'left'].every((k) => ps[k] === '0px');
      if (stretched) {
        let anc = el.parentElement;
        while (anc && getComputedStyle(anc).position === 'static') anc = anc.parentElement;
        if (anc) {
          const ar = anc.getBoundingClientRect();
          w = Math.max(w, ar.width); h = Math.max(h, ar.height);
          continue;
        }
      }
      /* Eigener Kasten mit fester Groesse (z. B. width:44px;height:44px). */
      const pw = parseFloat(ps.width) || 0, ph = parseFloat(ps.height) || 0;
      w = Math.max(w, pw); h = Math.max(h, ph);
      w = Math.max(w, r.width + Math.max(0, -g(ps.left)) + Math.max(0, -g(ps.right)));
      h = Math.max(h, r.height + Math.max(0, -g(ps.top)) + Math.max(0, -g(ps.bottom)));
    }
    if (w < 40 || h < 40) {
      const inline = st.display.startsWith('inline') && el.closest('p,li,figcaption,blockquote');
      out.tiny.push({ sel: path(el), w: Math.round(w), h: Math.round(h), inline: !!inline,
        txt: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24) });
    }
  }

  /* e) Bildlauf-Fallen und Raumfresser */
  const bs = getComputedStyle(document.body), hs = getComputedStyle(de);
  /* Eine Sperre ist nur dann eine Falle, wenn im gesperrten Kasten
     tatsaechlich mehr Inhalt steckt, als er zeigt. Ein body, der genauso
     hoch ist wie sein Inhalt, sperrt nichts weg. */
  const bodyLocked = /(hidden|clip)/.test(bs.overflowY) && document.body.scrollHeight > document.body.clientHeight + 4;
  const htmlLocked = /(hidden|clip)/.test(hs.overflowY) && de.scrollHeight > de.clientHeight + 4;
  if (bodyLocked || htmlLocked)
    out.traps.push({ kind: 'kein-scroll', detail: `${Math.max(document.body.scrollHeight, de.scrollHeight)}px Inhalt, overflow-y gesperrt` });
  for (const el of all) {
    const st = getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (!vis(el, st, r)) continue;
    if (st.pointerEvents === 'none') continue;
    if (r.height > vh * 0.34 && r.width > vw * 0.6)
      out.traps.push({ kind: 'raumfresser', sel: path(el), h: Math.round(r.height), pct: Math.round((r.height / vh) * 100) });
  }
  return out;
};

/* ---- Lauf ------------------------------------------------------------- */
await mkdir(OUT, { recursive: true });
const PORT = 4183 + (Number(process.env.PORT_OFF) || 0);
const srv = await serve(PORT);
const browser = await chromium.launch({ executablePath: CHROME });
const results = [];
let n = 0;
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1, colorScheme: 'dark',
    isMobile: false, hasTouch: vp.mobile,
    userAgent: vp.mobile
      ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151 Mobile Safari/537.36'
      : undefined,
  });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  for (const url of PAGES) {
    try {
      await page.goto(`http://127.0.0.1:${PORT}${url}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(350);
      const r = await page.evaluate(PROBE);
      results.push({ url, vp: vp.name, ...r });
    } catch (e) {
      results.push({ url, vp: vp.name, error: String(e).slice(0, 120) });
    }
    n++;
    if (n % 20 === 0) process.stderr.write(`  … ${n}\n`);
  }
  await ctx.close();
  process.stderr.write(`[${vp.name}] fertig\n`);
}
await browser.close();
srv.close();
await writeFile(join(OUT, 'responsive.json'), JSON.stringify(results, null, 1));
console.log(`\n${results.length} Messungen geschrieben -> .planning/sketches/tools/out/responsive.json`);
