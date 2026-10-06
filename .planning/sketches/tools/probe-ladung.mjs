/* Was lädt eine Seite wirklich? Anfragen, Bytes, Schriften (vorgeladen vs.
   benutzt) — gegen dist/, je Seite in einem frischen Kontext (kalter Cache).
   Aufruf: node .planning/sketches/tools/probe-ladung.mjs [1920x945] /a.html /b.html …
   Ausgabe: stdout. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = join(resolve(process.cwd()), 'dist');
const CHROME = [
  join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium_headless_shell-1228', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  let buf = null;
  try { buf = await readFile(f); } catch { buf = null; }
  if (!buf) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(buf);
});
await new Promise((r) => srv.listen(4247, '127.0.0.1', r));

const args = process.argv.slice(2);
const vpArg = args.find((a) => /^\d+x\d+$/.test(a)) || '1920x945';
const [W, H] = vpArg.split('x').map(Number);
const SEITEN = args.filter((a) => a.startsWith('/'));
const browser = await chromium.launch({ executablePath: CHROME });
for (const url of SEITEN) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const reqs = [];
  page.on('requestfinished', async (rq) => {
    try {
      const r = await rq.response();
      const body = r ? await r.body().catch(() => Buffer.alloc(0)) : Buffer.alloc(0);
      reqs.push({ url: rq.url(), type: rq.resourceType(), bytes: body.length });
    } catch { /* egal */ }
  });
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:4247' + url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const pre = Array.from(document.querySelectorAll('link[rel=preload][as=font]')).map((l) => l.getAttribute('href'));
    const used = [];
    document.fonts.forEach((f) => { if (f.status === 'loaded') used.push(`${f.family.replace(/"/g, '')} ${f.weight}${f.style === 'italic' ? 'i' : ''}`); });
    const fam = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length) continue;
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const st = getComputedStyle(el);
      fam.add(st.fontFamily.split(',')[0].replace(/["']/g, '').trim() + ' ' + st.fontWeight);
    }
    const lcp = performance.getEntriesByType('largest-contentful-paint');
    return { pre, used, families: Array.from(fam).slice(0, 14), cls: 0, inlineCss: Array.from(document.querySelectorAll('style')).reduce((s, x) => s + x.textContent.length, 0), htmlLen: document.documentElement.outerHTML.length };
  });
  const byType = {};
  for (const r of reqs) { const k = r.type; byType[k] = byType[k] || { n: 0, kb: 0 }; byType[k].n++; byType[k].kb += r.bytes / 1024; }
  const local = reqs.filter((r) => r.url.startsWith('http://127.0.0.1'));
  const fontReqs = reqs.filter((r) => r.type === 'font').map((r) => r.url.split('/').pop() + ` ${Math.round(r.bytes / 1024)}k`);
  console.log(`\n== ${url} @${W}x${H}  (${Date.now() - t0} ms)`);
  console.log('  Anfragen: ' + Object.entries(byType).map(([k, v]) => `${k} ${v.n}×/${Math.round(v.kb)}k`).join(' · ') + `  (lokal ${local.length}, fremd ${reqs.length - local.length})`);
  console.log('  HTML ' + Math.round(info.htmlLen / 1024) + 'k, davon inline-CSS ' + Math.round(info.inlineCss / 1024) + 'k');
  console.log('  vorgeladen: ' + info.pre.map((p) => p.split('/').pop()).join(', '));
  console.log('  geladene Schriften: ' + fontReqs.join(', '));
  console.log('  benutzte Familien: ' + info.families.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
