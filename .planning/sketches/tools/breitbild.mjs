/* Breitbild-Durchgang: misst und fotografiert dist/ auf den Schirmen, die die
   Besucher WIRKLICH haben. Anlass: Umami, 90 Tage bis 06.10.2026, ohne Bots —
   rund ein Drittel der echten Besucher sitzt an 2560 px und breiter
   (2560x1440, 3440x1440, 3840x2160, 5120x1440). Der Auflösungs-Durchgang vom
   30./31.08. hat bei 1920 px aufgehört; darüber war nie gemessen worden.

   Fenstergrößen sind ECHTE Fenster, nicht Bildschirme: Bildschirmhöhe minus
   Taskleiste (48) minus Browserleisten (~87). Ein 1440er Schirm zeigt also
   1305 px Seite, ein 4K-Schirm bei 100 % 2025 px.

   Aufruf:  node .planning/sketches/tools/breitbild.mjs [vp,vp,…] [/a.html /b.html …]
            ohne Seiten → out/pages.json; ohne VP → die sechs Standardfenster.
   Ausgabe: out/breit/<seite>__<vp>.jpg (erster Bildschirm)
            out/breit/befunde.json + Kurzbericht auf stdout.                    */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = resolve(process.cwd());
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, '.planning/sketches/tools/out/breit');
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
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

/* Erst lesen, dann Header — sonst stirbt der Prozess mitten im Lauf
   (ERR_HTTP_HEADERS_SENT, siehe Durchgang 31.08.). */
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  if (!existsSync(f) && existsSync(join(f, 'index.html'))) f = join(f, 'index.html');
  let buf;
  try { buf = await readFile(f); } catch { buf = null; }
  if (!buf) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(buf);
});
const PORT = 4231 + (Number(process.env.PORT_OFF) || 0);
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));

const STANDARD = ['1920x945', '2560x1305', '3440x1305', '3840x2025', '5120x1305', '1080x1785'];
const args = process.argv.slice(2);
const vpArg = args.find((a) => /^\d+x\d+(,\d+x\d+)*$/.test(a));
const VPS = (vpArg ? vpArg.split(',') : STANDARD).map((s) => { const [w, h] = s.split('x').map(Number); return { name: s, w, h }; });
const seitenArg = args.filter((a) => a.startsWith('/'));
const SEITEN = seitenArg.length ? seitenArg : JSON.parse(await readFile(join(ROOT, '.planning/sketches/tools/out/pages.json'), 'utf8'));
const SHOTS = process.env.SHOTS !== '0';

/* ---- Messung im Browser --------------------------------------------- */
const PROBE = async () => {
  const de = document.documentElement;
  const vw = de.clientWidth, vh = de.clientHeight;
  const out = { vw, vh, docH: de.scrollHeight, lines: null, upscaled: [], bar: null, text: null, grids: [], firstCtrl: null, wideText: [] };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) return null;
    if (el.closest('[hidden],[aria-hidden="true"],dialog:not([open])')) return null;
    return r;
  };
  const sel = (el) => {
    const bits = []; let n = el, d = 0;
    while (n && n.nodeType === 1 && d < 3) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      else if (typeof n.className === 'string' && n.className.trim()) s += '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.');
      bits.unshift(s); n = n.parentElement; d++;
    }
    return bits.join(' > ');
  };
  const ownText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);

  /* 1) Zeilenlänge im Fließtext (Zeichen je Zeile über echte Zeilenkästen) */
  let worst = 0, over = 0, measured = 0, worstSel = '';
  for (const el of document.querySelectorAll('p, li, dd, blockquote, figcaption')) {
    const r = visible(el); if (!r) continue;
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt.length < 160) continue;
    const range = document.createRange(); range.selectNodeContents(el);
    const tops = new Set(Array.from(range.getClientRects()).filter((q) => q.width > 4).map((q) => Math.round(q.top)));
    const lines = Math.max(1, tops.size);
    if (lines < 2) continue;
    const cpl = Math.round(txt.length / lines);
    measured++;
    if (cpl > 100) over++;
    if (cpl > worst) { worst = cpl; worstSel = sel(el) + ' (' + Math.round(r.width) + 'px)'; }
  }
  out.lines = { measured, over100: over, worst, worstSel };

  /* 2) Hochskalierte Bilder: <img> und CSS-Hintergründe, gerendert größer als
        die Datei hergibt (DPR 1 → Faktor = gerenderte / natürliche Breite). */
  const imgs = [];
  for (const im of document.querySelectorAll('img')) {
    const r = visible(im); if (!r || !im.naturalWidth) continue;
    if (r.top > vh * 2) continue;
    const fit = getComputedStyle(im).objectFit;
    const f = fit === 'cover' ? Math.max(r.width / im.naturalWidth, r.height / im.naturalHeight) : r.width / im.naturalWidth;
    if (f > 1.3 && r.width > 320) imgs.push({ kind: 'img', sel: sel(im), src: (im.currentSrc || im.src).split('/').pop().slice(0, 50), w: Math.round(r.width), nat: im.naturalWidth, f: Math.round(f * 100) / 100 });
  }
  const bgs = [];
  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el);
    const m = st.backgroundImage && st.backgroundImage.match(/url\("?([^")]+)"?\)/);
    if (!m) continue;
    const r = visible(el); if (!r || r.width < 600) continue;
    if (r.top > vh * 2) continue;
    bgs.push({ el, r, url: m[1], size: st.backgroundSize });
  }
  await Promise.all(bgs.map((b) => new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const nw = im.naturalWidth, nh = im.naturalHeight;
      if (!nw) return res();
      let f;
      if (/cover/.test(b.size)) f = Math.max(b.r.width / nw, b.r.height / nh);
      else if (/contain/.test(b.size)) f = Math.min(b.r.width / nw, b.r.height / nh);
      else if (/^\d+(\.\d+)?%/.test(b.size)) f = (parseFloat(b.size) / 100) * b.r.width / nw;
      else if (/^\d+(\.\d+)?px/.test(b.size)) f = parseFloat(b.size) / nw;
      else f = 1;
      if (f > 1.3 && !/\.svg/i.test(b.url)) imgs.push({ kind: 'bg', sel: sel(b.el), src: b.url.split('/').pop().slice(0, 50), w: Math.round(b.r.width), nat: nw, f: Math.round(f * 100) / 100, size: b.size });
      res();
    };
    im.onerror = () => res();
    im.src = b.url;
  })));
  out.upscaled = imgs;

  /* 3) Kopfleiste: wie weit liegen ihre Bedienelemente auseinander? */
  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'sticky') continue;
    const r = visible(el); if (!r) continue;
    if (r.top > 12 || r.width < vw * 0.8 || r.height > 220) continue;
    const ctl = Array.from(el.querySelectorAll('a, button, input, select')).map((c) => [c, visible(c)]).filter(([, q]) => q && q.right > 0 && q.left < vw);
    if (!ctl.length) continue;
    const L = Math.min(...ctl.map(([, q]) => q.left)), R = Math.max(...ctl.map(([, q]) => q.right));
    out.bar = { sel: sel(el), h: Math.round(r.height), left: Math.round(L), right: Math.round(R), spread: Math.round(R - L), n: ctl.length };
    break;
  }

  /* 4) Wo steht Text? Waagerechte Ausdehnung im ersten und zweiten Schirm,
        ohne die Kopfleiste. */
  let tl = Infinity, tr = -Infinity, nText = 0;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!ownText(el)) continue;
    const r = visible(el); if (!r) continue;
    if (r.top < (out.bar ? out.bar.h : 0) || r.top > vh * 2) continue;
    const st = getComputedStyle(el);
    if (st.position === 'fixed') continue;
    tl = Math.min(tl, r.left); tr = Math.max(tr, r.right); nText++;
    if (r.width > 1700 && st.display !== 'inline') wide.push({ sel: sel(el), w: Math.round(r.width) });
  }
  out.text = nText ? { left: Math.round(tl), right: Math.round(tr), span: Math.round(tr - tl), n: nText } : null;
  out.wideText = wide.slice(0, 6);

  /* 5) Raster mit sehr vielen Spalten */
  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el);
    if (st.display !== 'grid' && st.display !== 'inline-grid') continue;
    const cols = st.gridTemplateColumns.split(/\s+/).filter((x) => /px$/.test(x)).length;
    if (cols < 7) continue;
    const r = visible(el); if (!r || r.top > vh * 3) continue;
    out.grids.push({ sel: sel(el), cols, w: Math.round(r.width) });
  }
  out.grids = out.grids.slice(0, 5);

  /* 6) Erste echte Bedienung (Eingabe/Auswahl) unterhalb der Kopfleiste */
  for (const c of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
    const r = visible(c); if (!r) continue;
    if (out.bar && r.top < out.bar.h) continue;
    out.firstCtrl = { sel: sel(c), top: Math.round(r.top + scrollY) };
    break;
  }
  return out;
};

/* ---- Lauf ------------------------------------------------------------ */
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const befunde = [];
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  for (const url of SEITEN) {
    try {
      await page.goto(`http://127.0.0.1:${PORT}${url}`, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1200);
      const r = await page.evaluate(PROBE);
      befunde.push({ url, vp: vp.name, ...r });
      if (SHOTS) {
        const name = (url.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root') + '__' + vp.name + '.jpg';
        await page.screenshot({ path: join(OUT, name), type: 'jpeg', quality: 72 });
      }
    } catch (e) {
      befunde.push({ url, vp: vp.name, error: String(e).slice(0, 160) });
    }
  }
  await ctx.close();
  process.stderr.write(`[${vp.name}] ${SEITEN.length} Seiten\n`);
}
await browser.close();
srv.close();
await writeFile(join(OUT, 'befunde.json'), JSON.stringify(befunde, null, 1));

/* ---- Kurzbericht ------------------------------------------------------ */
const fehler = befunde.filter((b) => b.error);
console.log(`\n${befunde.length} Messungen (${SEITEN.length} Seiten × ${VPS.length} Fenster), ${fehler.length} Fehler`);
for (const f of fehler) console.log(`  FEHLER ${f.url} @${f.vp}: ${f.error}`);
for (const vp of VPS) {
  const rows = befunde.filter((b) => b.vp === vp.name && !b.error);
  const lang = rows.filter((b) => b.lines && b.lines.worst > 100);
  const scal = rows.filter((b) => b.upscaled.length);
  const breit = rows.filter((b) => b.bar && b.text && b.bar.spread > b.text.span * 1.6 && b.bar.spread > 1800);
  const viele = rows.filter((b) => b.grids.length);
  console.log(`\n[${vp.name}] Zeilen>100 Z.: ${lang.length} · hochskaliert: ${scal.length} · Kopfleiste viel breiter als Inhalt: ${breit.length} · Raster ≥7 Sp.: ${viele.length}`);
  for (const b of lang) console.log(`  Zeile  ${b.url}  ${b.lines.worst} Z./Zeile  ${b.lines.worstSel}`);
  for (const b of scal) for (const i of b.upscaled.slice(0, 3)) console.log(`  Skala  ${b.url}  ×${i.f}  ${i.kind} ${i.src} (${i.w}px aus ${i.nat}px)  ${i.sel}`);
  for (const b of breit) console.log(`  Leiste ${b.url}  Bedienung ${b.bar.left}…${b.bar.right} (${b.bar.spread}px)  Text ${b.text.left}…${b.text.right} (${b.text.span}px)`);
  for (const b of viele) for (const g of b.grids.slice(0, 2)) console.log(`  Raster ${b.url}  ${g.cols} Sp. auf ${g.w}px  ${g.sel}`);
}
