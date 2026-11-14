/* ============================================================
   hangar-last-messung.mjs — was der Hangar beim Laden und im Stand kostet.

   EINE SONDE, KEIN TOR (wie alle Dateien unter scripts/probes/): braucht
   einen Browser und eine laufende Seite. Die Schwester
   hangar-gpu-messung.mjs misst die Zeit des Chips je Durchgang; diese hier
   misst alles davor und daneben:

   · Netz: Anfragen und übertragene Bytes je Gruppe (Halle, Schiff, Bilder,
     Requisiten, three.js, Seite), getrennt nach „bis das Bild steht" und
     „danach". Der Vorschau-Server packt nichts; für Text steht daneben, was
     gzip daraus macht (der Rand packt Text, Modelle und Bilder nicht).
   · Zeit: bis zum ersten Bild der Halle (reveal), bis Ruhe im Netz, und
     wie lange der Hauptfaden dabei am Stück belegt war (long tasks).
   · Grafikspeicher: am Zeichenkontext mitgezählt, je Textur (Größe,
     Format, Mip-Stufen), Zwischenbilder (Renderbuffer, mit Abtastungen) und
     Geometrie (Buffer). Unter Windows dazu, was der Grafikprozess dieses
     Browsers laut System wirklich belegt.
   · Bild: Zeichenaufrufe, Dreiecke, Shaderprogramme, Bilder je Sekunde und
     Rechenzeit des Hauptfadens je Bild, in Ruhe und beim Drehen.
   · Arbeitsspeicher: JS-Heap nach einer Müllabfuhr.

   ⚠ Mit --soft (Software-WebGL, Cloud und CI) stimmen Bytes, Speicher und
   Zählungen, aber KEINE Zeit und KEIN Takt. Zeiten nur vom echten Chip.

   ⚠ Zeiten und Takt nur mit --headed (sichtbares Fenster). Ein Browser ohne
   Fenster gilt Windows als Hintergrundarbeit; auf einem Prozessor mit P-
   und E-Kernen rechnen seine Fäden dann nur auf den E-Kernen. Gemessen am
   13.11.2026 auf einem i5-13400F (sechs P-, vier E-Kerne) mit der Gladius
   in der hohen Stufe: ohne Fenster 18 s bis zum Bild und 25 ms Rechenzeit
   je Bild (37 Bilder je Sekunde), mit Fenster 10 s und 10 ms (60 Bilder je
   Sekunde); 16 rechnende Fäden leisteten ohne Fenster so viel wie 3, mit
   Fenster wie 9. Die ersten Zahlen dieser Sonde stammten aus dem Lauf ohne
   Fenster und waren darum um das Zweieinhalbfache zu hoch. Mengen (Bytes,
   Speicher, Zeichenaufrufe) stimmen in beiden Fällen.

     node scripts/probes/hangar-last-messung.mjs --base http://localhost:4391
       [--grafik hoch|mittel|niedrig|auto] [--ship <kennung>] [--telefon]
       [--headed] [--soft] [--netz <Mbit/s>] [--secs 8] [--w 1920 --h 970]
       [--json aus.json] [--shot bild.png] [--top 15]
   ============================================================ */
import { existsSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { chromium, devices } from 'playwright-core';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = flag('--base', 'http://localhost:4391').replace(/\/$/, '');
const GRAFIK = flag('--grafik', 'hoch');
const SHIP = flag('--ship', null);
const TELEFON = argv.includes('--telefon');
const SOFT = argv.includes('--soft');
const HEADED = argv.includes('--headed');
const NETZ = Number(flag('--netz', '0'));
const SECS = Number(flag('--secs', '8'));
const W = Number(flag('--w', '1920')), H = Number(flag('--h', '970'));
const JSON_OUT = flag('--json', null), SHOT = flag('--shot', null);
const TOP = Number(flag('--top', '15'));
if (SHIP && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(SHIP)) { console.error(`\n--ship ${SHIP}: keine Schiffskennung\n`); process.exit(2); }
if (!['hoch', 'mittel', 'niedrig', 'auto'].includes(GRAFIK)) { console.error(`\n--grafik ${GRAFIK}: hoch, mittel, niedrig oder auto\n`); process.exit(2); }

const KANDIDATEN = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/opt/pw-browsers/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);
const BROWSER = KANDIDATEN.find((p) => existsSync(p));
if (!BROWSER) { console.error('\nKein Browser gefunden; einen Pfad über CHROME_PATH setzen.\n'); process.exit(2); }

// Im Browser vor jedem Skript der Seite.
function vorSeite(opt) {
  const L = (window.__last = { ctxs: [], reveal: null, long: [], frames: [], on: false });
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o) {
    if (opt.soft && o && typeof o === 'object') { o = { ...o }; delete o.failIfMajorPerformanceCaveat; }
    const gl = gc.call(this, t, o);
    if (gl && t === 'webgl2' && !gl.__last) wrap(gl);
    return gl;
  };
  if (opt.soft) {
    const gp = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (p) { return p === 0x9246 ? opt.gpu : gp.call(this, p); };
  }
  // Bytes je Bildpunkt nach internem Format. RGB zählt wie RGBA: die
  // Treiber legen drei Kanäle in vier ab.
  const BPP = {
    0x8058: 4, 0x8C43: 4, 0x8051: 4, 0x8C41: 4, 0x1908: 4, 0x1907: 4, 0x8229: 1, 0x822B: 2, 0x1903: 1, 0x1909: 1, 0x1906: 1, 0x190A: 2,
    0x881A: 8, 0x8814: 16, 0x881B: 8, 0x8815: 16, 0x822D: 2, 0x822F: 4, 0x822E: 4, 0x8230: 8, 0x8C3A: 4, 0x8C3D: 4,
    0x81A5: 2, 0x81A6: 4, 0x8CAC: 4, 0x88F0: 4, 0x8CAD: 8, 0x1902: 4, 0x84F9: 4, 0x8D48: 1,
  };
  const FMT = {
    0x8058: 'RGBA8', 0x8C43: 'SRGB8_A8', 0x8051: 'RGB8', 0x8C41: 'SRGB8', 0x1908: 'RGBA', 0x1907: 'RGB', 0x8229: 'R8', 0x822B: 'RG8',
    0x881A: 'RGBA16F', 0x8814: 'RGBA32F', 0x822D: 'R16F', 0x822F: 'RG16F', 0x822E: 'R32F', 0x8C3A: 'R11G11B10F',
    0x81A5: 'DEPTH16', 0x81A6: 'DEPTH24', 0x8CAC: 'DEPTH32F', 0x88F0: 'DEPTH24_S8', 0x8CAD: 'DEPTH32F_S8',
  };
  const fmt = (f) => FMT[f] || `0x${f.toString(16)}`;
  function wrap(gl) {
    const S = { gl, tex: new Map(), rb: new Map(), buf: new Map(), progs: 0, unit: 0, boundTex: {}, boundRb: null, boundBuf: {}, draws: 0, tris: 0, multi: 0, teile: 0, compressed: 0 };
    gl.__last = S;
    L.ctxs.push(S);
    const o = (k) => gl[k].bind(gl);
    const base = (target) => (target >= 0x8515 && target <= 0x851A ? 0x8513 : target);
    const cur = (target) => S.boundTex[`${S.unit}:${base(target)}`];
    const set = (target, level, f, w, h, d, levels, bytes) => {
      const t = cur(target);
      if (!t) return;
      const r = S.tex.get(t) || { faces: {}, mip: false, target: base(target) };
      const key = target >= 0x8515 && target <= 0x851A ? target : 0;
      if (levels != null) {
        // texStorage: alle Stufen auf einmal, bei Würfeln je Seite
        let sum = 0;
        for (let i = 0, ww = w, hh = h, dd = d; i < levels; i++) {
          sum += ww * hh * dd * (BPP[f] ?? 4);
          ww = Math.max(1, ww >> 1); hh = Math.max(1, hh >> 1);
          if (target === 0x806F) dd = Math.max(1, dd >> 1);
        }
        r.faces = { 0: sum * (base(target) === 0x8513 ? 6 : 1) };
        r.w = w; r.h = h; r.d = d; r.f = f; r.levels = levels; r.storage = true;
      } else if (level === 0) {
        r.faces[key] = bytes ?? w * h * d * (BPP[f] ?? 4);
        r.w = w; r.h = h; r.d = d; r.f = f; r.levels = 1;
        if (bytes != null) r.compressed = true;
      } else if (bytes != null) {
        r.faces[`${key}:${level}`] = bytes;
      } else {
        r.faces[`${key}:${level}`] = w * h * d * (BPP[f] ?? 4);
      }
      S.tex.set(t, r);
    };
    const dims = (s) => [s?.naturalWidth || s?.videoWidth || s?.displayWidth || s?.width || 0, s?.naturalHeight || s?.videoHeight || s?.displayHeight || s?.height || 0];
    const f = {};
    for (const k of ['createTexture', 'bindTexture', 'activeTexture', 'deleteTexture', 'texImage2D', 'texStorage2D', 'texImage3D', 'texStorage3D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'generateMipmap',
      'bindRenderbuffer', 'renderbufferStorage', 'renderbufferStorageMultisample', 'deleteRenderbuffer', 'bindBuffer', 'bufferData', 'deleteBuffer', 'linkProgram',
      'drawArrays', 'drawElements', 'drawRangeElements', 'drawArraysInstanced', 'drawElementsInstanced']) f[k] = o(k);
    gl.activeTexture = (u) => { S.unit = u; return f.activeTexture(u); };
    gl.bindTexture = (t, x) => { S.boundTex[`${S.unit}:${t}`] = x; return f.bindTexture(t, x); };
    gl.deleteTexture = (x) => { S.tex.delete(x); return f.deleteTexture(x); };
    gl.texImage2D = (...a) => {
      if (a.length >= 9) set(a[0], a[1], a[2], a[3], a[4], 1);
      else { const [w, h] = dims(a[5]); set(a[0], a[1], a[2], w, h, 1); }
      return f.texImage2D(...a);
    };
    gl.texStorage2D = (t, levels, fi, w, h) => { set(t, 0, fi, w, h, 1, levels); return f.texStorage2D(t, levels, fi, w, h); };
    gl.texImage3D = (...a) => { set(a[0], a[1], a[2], a[3], a[4], a[5]); return f.texImage3D(...a); };
    gl.texStorage3D = (t, levels, fi, w, h, d) => { set(t, 0, fi, w, h, d, levels); return f.texStorage3D(t, levels, fi, w, h, d); };
    gl.compressedTexImage2D = (...a) => {
      const n = typeof a[6] === 'number' ? a[6] : a[6]?.byteLength ?? 0;
      set(a[0], a[1], a[2], a[3], a[4], 1, null, n);
      S.compressed++;
      return f.compressedTexImage2D(...a);
    };
    gl.compressedTexSubImage2D = (...a) => {
      // nach texStorage2D mit gepacktem Format: die Stufe wiegt, was ankommt
      const t = cur(a[0]), r = t && S.tex.get(t);
      if (r?.storage && !r.packed) { r.packed = true; r.faces = {}; r.compressed = true; }
      if (r?.packed) { const n = typeof a[7] === 'number' ? a[7] : a[7]?.byteLength ?? 0; r.faces[`${a[0]}:${a[1]}`] = n; }
      return f.compressedTexSubImage2D(...a);
    };
    gl.generateMipmap = (t) => { const x = cur(t), r = x && S.tex.get(x); if (r && !r.storage) r.mip = true; return f.generateMipmap(t); };
    gl.bindRenderbuffer = (t, x) => { S.boundRb = x; return f.bindRenderbuffer(t, x); };
    gl.renderbufferStorage = (t, fi, w, h) => { if (S.boundRb) S.rb.set(S.boundRb, { w, h, f: fi, s: 1 }); return f.renderbufferStorage(t, fi, w, h); };
    gl.renderbufferStorageMultisample = (t, s, fi, w, h) => { if (S.boundRb) S.rb.set(S.boundRb, { w, h, f: fi, s: Math.max(1, s) }); return f.renderbufferStorageMultisample(t, s, fi, w, h); };
    gl.deleteRenderbuffer = (x) => { S.rb.delete(x); return f.deleteRenderbuffer(x); };
    gl.bindBuffer = (t, x) => { S.boundBuf[t] = x; return f.bindBuffer(t, x); };
    gl.bufferData = (t, d, ...r) => { const b = S.boundBuf[t]; if (b) S.buf.set(b, typeof d === 'number' ? d : d?.byteLength ?? 0); return f.bufferData(t, d, ...r); };
    gl.deleteBuffer = (x) => { S.buf.delete(x); return f.deleteBuffer(x); };
    gl.linkProgram = (p) => { S.progs++; return f.linkProgram(p); };
    const tri = (m, n) => (m === 4 ? n / 3 : m === 5 || m === 6 ? n - 2 : 0);
    const count = (m, n, i = 1) => { S.draws++; S.tris += tri(m, n) * i; };
    gl.drawArrays = (m, a, n) => { count(m, n); return f.drawArrays(m, a, n); };
    gl.drawElements = (m, n, t, off) => { count(m, n); return f.drawElements(m, n, t, off); };
    gl.drawRangeElements = (m, a, b, n, t, off) => { count(m, n); return f.drawRangeElements(m, a, b, n, t, off); };
    gl.drawArraysInstanced = (m, a, n, i) => { count(m, n, i); return f.drawArraysInstanced(m, a, n, i); };
    gl.drawElementsInstanced = (m, n, t, off, i) => { count(m, n, i); return f.drawElementsInstanced(m, n, t, off, i); };
    // BatchedMesh (Wartungsplatz, Hallendeko, Schachttor) zeichnet three über
    // WEBGL_multi_draw, direkt am Erweiterungsobjekt und nicht über gl.draw*:
    // ein Aufruf mit vielen Teilen. Ohne diese Stelle fehlten die Aufrufe
    // und ihre Dreiecke in der Zählung.
    const multi = (m, counts, co, n, inst, io) => {
      S.draws++; S.multi++; S.teile += n;
      for (let k = 0; k < n; k++) S.tris += tri(m, counts[co + k]) * (inst ? inst[io + k] : 1);
    };
    const getExt = gl.getExtension.bind(gl);
    gl.getExtension = (name) => {
      const e = getExt(name);
      if (name === 'WEBGL_multi_draw' && e && !e.__lastGezaehlt) {
        e.__lastGezaehlt = true;
        const o = { a: e.multiDrawArraysWEBGL.bind(e), e: e.multiDrawElementsWEBGL.bind(e), ai: e.multiDrawArraysInstancedWEBGL.bind(e), ei: e.multiDrawElementsInstancedWEBGL.bind(e) };
        e.multiDrawArraysWEBGL = (m, firsts, fo, counts, co, n) => { multi(m, counts, co, n); return o.a(m, firsts, fo, counts, co, n); };
        e.multiDrawElementsWEBGL = (m, counts, co, t, offs, oo, n) => { multi(m, counts, co, n); return o.e(m, counts, co, t, offs, oo, n); };
        e.multiDrawArraysInstancedWEBGL = (m, firsts, fo, counts, co, ic, io, n) => { multi(m, counts, co, n, ic, io); return o.ai(m, firsts, fo, counts, co, ic, io, n); };
        e.multiDrawElementsInstancedWEBGL = (m, counts, co, t, offs, oo, ic, io, n) => { multi(m, counts, co, n, ic, io); return o.ei(m, counts, co, t, offs, oo, ic, io, n); };
      }
      return e;
    };
  }
  // Bilder: Zählung und Rechenzeit je requestAnimationFrame
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    for (const S of L.ctxs) { S.draws = 0; S.tris = 0; S.multi = 0; S.teile = 0; }
    const c0 = performance.now();
    try { cb(t); } finally {
      if (L.on) {
        const cpu = performance.now() - c0;
        let draws = 0, tris = 0, multi = 0, teile = 0;
        for (const S of L.ctxs) { draws += S.draws; tris += S.tris; multi += S.multi; teile += S.teile; }
        if (draws) L.frames.push({ t: c0, cpu, draws, tris, multi, teile });
      }
    }
  });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) L.long.push({ t: e.startTime, ms: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch { /* ohne Messung */ }
  const iv = setInterval(() => {
    if ([...document.querySelectorAll('canvas')].some((c) => c.style.opacity !== '0' && c.width > 100 && c.isConnected && L.ctxs.some((S) => S.gl.canvas === c))) { L.reveal = performance.now(); clearInterval(iv); }
  }, 50);
  L.speicher = () => {
    const out = { tex: [], texBytes: 0, rbBytes: 0, bufBytes: 0, rb: [], progs: 0, leinwand: 0, compressed: 0 };
    for (const S of L.ctxs) {
      if (!S.gl.canvas.isConnected) continue;
      for (const r of S.tex.values()) {
        let b = Object.values(r.faces).reduce((a, x) => a + x, 0);
        if (r.mip) b = Math.round(b * 4 / 3);
        out.tex.push({ w: r.w, h: r.h, d: r.d, f: fmt(r.f), mip: r.mip || r.levels > 1, bytes: b, art: r.target === 0x8513 ? 'Würfel' : r.target === 0x806F ? '3D' : r.target === 0x8C1A ? 'Stapel' : '2D', gepackt: !!r.compressed });
        out.texBytes += b;
      }
      for (const r of S.rb.values()) { const b = r.w * r.h * (BPP[r.f] ?? 4) * r.s; out.rb.push({ w: r.w, h: r.h, f: fmt(r.f), s: r.s, bytes: b }); out.rbBytes += b; }
      for (const b of S.buf.values()) out.bufBytes += b;
      out.progs += S.progs;
      out.compressed += S.compressed;
      const a = S.gl.getContextAttributes();
      // Leinwand: Farbe und Tiefe, mit Kantenglättung je vierfach plus das aufgelöste Bild
      out.leinwand += S.gl.drawingBufferWidth * S.gl.drawingBufferHeight * 4 * ((a.antialias ? 4 : 1) * 2 + 1);
    }
    return out;
  };
}

const MB = (b) => (b / 1048576).toFixed(1);
const gruppe = (u) => {
  const p = new URL(u).pathname;
  if (p.startsWith('/hangar/hall/')) return 'Halle';
  // /holo/: das Modell der Datenblätter, Rückfall für Schiffe ohne eigene Geometrie-Fassung (HangarApp.astro: geo[id] ?? meshes[id])
  if (p.startsWith('/hangar/ships/') || p.startsWith('/hangar/geo/') || p.startsWith('/holo/')) return 'Schiff (Modell)';
  if (p.startsWith('/hangar/tex/')) return 'Schiff (Bilder)';
  if (p.startsWith('/hangar/props/') || p.startsWith('/hangar/lift/') || p.startsWith('/hangar/werkhalle/')) return 'Requisiten, Schacht, Werkhalle';
  if (p.startsWith('/hangar/npc/')) return 'Crew';
  if (p.startsWith('/hangar/')) return `Hangar sonst (${p.split('/')[2]})`;
  if (p.startsWith('/vendor/')) return 'three.js';
  if (/\.(js|mjs)$/.test(p)) return 'Seite: Skripte';
  if (/\.(woff2?|ttf)$/.test(p)) return 'Seite: Schriften';
  if (/\.(png|jpe?g|webp|avif|svg|ico)$/.test(p)) return 'Seite: Bilder';
  return 'Seite: sonst';
};

const args = SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []), `--window-size=${W},${H + 120}`];
const browser = await chromium.launch({ executablePath: BROWSER, headless: !HEADED, args });
const tel = devices['iPhone 14'];
const ctx = await browser.newContext(TELEFON
  ? { viewport: tel.viewport, deviceScaleFactor: tel.deviceScaleFactor, isMobile: true, hasTouch: true, userAgent: tel.userAgent, bypassCSP: true }
  : { viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true });
const page = await ctx.newPage();
if (HEADED) await page.bringToFront();
const GPU_NAME = TELEFON ? 'Apple GPU' : 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)';
await page.addInitScript(vorSeite, { soft: SOFT, gpu: GPU_NAME });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
if (NETZ > 0) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: NETZ * 125000, uploadThroughput: NETZ * 125000 / 4 });
await cdp.send('Performance.enable');

const reqs = new Map();
// laufend: Anfragen, die unterwegs sind. Ruhe im Netz heißt: keine läuft
// mehr UND seit RUHE ist keine fertig geworden. Nur auf die letzte fertige
// zu sehen, endete zu früh, wenn eine große Datei länger als RUHE lud
// (mit --netz die Regel).
const laufend = new Set();
let letzte = Date.now();
cdp.on('Network.requestWillBeSent', (e) => { if (/^https?:/.test(e.request.url)) { reqs.set(e.requestId, { url: e.request.url, t0: e.timestamp, wall: e.wallTime }); laufend.add(e.requestId); } });
cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.mime = e.response.mimeType; r.status = e.response.status; } });
cdp.on('Network.loadingFinished', (e) => { laufend.delete(e.requestId); const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.t1 = e.timestamp; letzte = Date.now(); r.id = e.requestId; } });
cdp.on('Network.loadingFailed', (e) => { laufend.delete(e.requestId); const r = reqs.get(e.requestId); if (r) { r.failed = e.errorText; letzte = Date.now(); } });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[hangar]')) logs.push(t); });
page.on('pageerror', (e) => logs.push(`FEHLER der Seite: ${String(e).slice(0, 200)}`));

const url = `${BASE}/hangar.html?${GRAFIK === 'auto' ? '' : `grafik=${GRAFIK}`}${SHIP ? `&ship=${SHIP}` : ''}`;
console.log(`\n=== Last des Hangars: ${url} ===`);
console.log(`Browser ${BROWSER}${SOFT ? ' (Software-WebGL: KEINE Zeiten)' : ''} · ${TELEFON ? `Telefon ${tel.viewport.width}×${tel.viewport.height} @${tel.deviceScaleFactor}` : `${W}×${H}`}${NETZ ? ` · Netz ${NETZ} Mbit/s` : ' · Netz ungebremst'}\n`);

const start = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
const WARTE = SOFT ? 20 * 60000 : 4 * 60000;
let rueckfall = false;
while (Date.now() - start < WARTE) {
  if (await page.evaluate(() => window.__last.reveal != null)) break;
  if (await page.evaluate(() => document.getElementById('hg-fallback')?.hidden === false)) { rueckfall = true; break; }
  await page.waitForTimeout(250);
}
if (rueckfall) { console.error('FEHLER: die Seite zeigt ihren Rückfall statt der Halle.\n' + logs.join('\n')); await browser.close(); process.exit(1); }
const reveal = await page.evaluate(() => window.__last.reveal);
if (reveal == null) { console.error(`FEHLER: nach ${WARTE / 60000} min kein Bild der Halle.\n` + logs.join('\n')); await browser.close(); process.exit(1); }
// Ruhe: keine Anfrage läuft mehr, und vier Sekunden ohne fertige Anfrage
// (unter Software länger, dort rechnet die Seite zwischen den Anfragen lange).
// Läuft die Frist WARTE ab, während noch geladen wird oder bevor die
// Ruhefrist um ist, ist die Messung unvollständig: Das sagt der Bericht,
// statt Ruhe zu melden. ruheDa hält beide Bedingungen fest; nur auf offene
// Anfragen zu sehen, meldete Ruhe, wenn die letzte Anfrage kurz vor der
// Frist fertig wurde (Befund CodeRabbit, 13.11.2026).
const RUHE = SOFT ? 25000 : 4000;
while ((laufend.size > 0 || Date.now() - letzte < RUHE) && Date.now() - start < WARTE) await page.waitForTimeout(250);
const offen = [...laufend].map((id) => reqs.get(id)?.url).filter(Boolean);
const ruheDa = laufend.size === 0 && Date.now() - letzte >= RUHE;
const ruhe = (letzte - start) / 1000;
await page.waitForTimeout(SOFT ? 5000 : 3000);

// Netz auswerten
const nav = await page.evaluate(() => ({ origin: performance.timeOrigin, dcl: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd, load: performance.getEntriesByType('navigation')[0]?.loadEventEnd }));
const revealWall = (nav.origin + reveal) / 1000;
const rows = new Map();
let all = 0, allN = 0, vor = 0, textRoh = 0, textGz = 0;
const fehlAnfragen = [];
for (const r of reqs.values()) {
  if (r.failed || r.bytes == null) { if (r.failed && !/ERR_ABORTED/.test(r.failed)) fehlAnfragen.push(`${r.failed} ${r.url}`); continue; }
  const g = gruppe(r.url);
  const row = rows.get(g) || { n: 0, bytes: 0, vor: 0, gz: 0 };
  row.n++; row.bytes += r.bytes; all += r.bytes; allN++;
  const before = r.wall + (r.t1 - r.t0) <= revealWall;
  if (before) { row.vor += r.bytes; vor += r.bytes; }
  let gz = r.bytes;
  if (/javascript|json|html|css|svg|text\//.test(r.mime || '') && r.bytes > 1024) {
    try {
      const b = await cdp.send('Network.getResponseBody', { requestId: r.id });
      const raw = Buffer.from(b.body, b.base64Encoded ? 'base64' : 'utf8');
      gz = gzipSync(raw, { level: 6 }).length;
      textRoh += r.bytes; textGz += gz;
    } catch { /* Antwort schon verworfen */ }
  }
  row.gz += gz;
  rows.set(g, row);
}
const gzAll = [...rows.values()].reduce((a, r) => a + r.gz, 0);

// Speicher
await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
const metr = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const sp = await page.evaluate(() => window.__last.speicher());
const lang = await page.evaluate(() => ({ vor: window.__last.long.filter((l) => l.t < window.__last.reveal), nach: window.__last.long.filter((l) => l.t >= window.__last.reveal) }));
const sum = (a) => a.reduce((x, l) => x + l.ms, 0), max = (a) => a.reduce((x, l) => Math.max(x, l.ms), 0);

// Grafikspeicher des Grafikprozesses laut Windows (dedizierter Speicher)
async function vram() {
  if (process.platform !== 'win32' || SOFT) return null;
  const ps = `$ErrorActionPreference='SilentlyContinue'; $g=@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match 'playwright' -and $_.CommandLine -match '--type=gpu-process' } | ForEach-Object { [int]$_.ProcessId }); $s=(Get-Counter '\\GPU Process Memory(*)\\Dedicated Usage').CounterSamples | Where-Object { $_.InstanceName -match '^pid_(\\d+)_' -and $g -contains [int]$matches[1] }; [Console]::WriteLine(($s | Measure-Object CookedValue -Sum).Sum)`;
  return new Promise((res) => {
    let out = '';
    const p = spawn('powershell', ['-NoProfile', '-Command', ps]);
    p.on('error', () => res(null));
    p.stdout.on('data', (d) => { out += d; });
    p.on('close', () => { const v = Number(out.trim().replace(',', '.')); res(Number.isFinite(v) && v > 0 ? v : null); });
  });
}
const vramBytes = await vram();

// Bilder: in Ruhe, dann beim Drehen
async function bilder(label, drive) {
  await page.evaluate(() => { window.__last.frames = []; window.__last.on = true; });
  const t0 = Date.now();
  await drive();
  const secs = (Date.now() - t0) / 1000;
  const fr = await page.evaluate(() => { window.__last.on = false; return window.__last.frames; });
  if (!fr.length) return { label, fps: 0, n: 0 };
  const med = (k) => { const a = fr.map((x) => x[k]).sort((x, y) => x - y); return a[a.length >> 1]; };
  const p95 = (k) => { const a = fr.map((x) => x[k]).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * 0.95))]; };
  return { label, n: fr.length, fps: +(fr.length / secs).toFixed(1), cpu: +med('cpu').toFixed(2), cpu95: +p95('cpu').toFixed(2), draws: med('draws'), tris: Math.round(med('tris')), multi: med('multi'), teile: med('teile') };
}
const vw = TELEFON ? tel.viewport.width : W, vh = TELEFON ? tel.viewport.height : H;
const stand = await bilder('in Ruhe', () => page.waitForTimeout(SECS * 1000));
const dreh = TELEFON ? null : await bilder('beim Drehen', async () => {
  const cx = vw / 2, cy = vh * 0.45;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000) {
    const k = (Date.now() - t0) / 1000;
    await page.mouse.move(cx + Math.sin(k * 1.3) * vw * 0.25, cy + Math.sin(k * 0.7) * 30);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
});
if (SHOT) await page.screenshot({ path: SHOT, timeout: 240000 }).catch((e) => console.log(`Aufnahme nicht gelungen: ${String(e).split('\n')[0]}`));
await browser.close();

// Bericht
console.log('── Netz (erster Besuch, ohne Zwischenspeicher)');
console.log(`   ${String(allN).padStart(4)} Anfragen, ${MB(all)} MB${textRoh ? ` (Text gepackt: etwa ${MB(gzAll)} MB über die Leitung)` : ''}; davon ${MB(vor)} MB, bis das Bild steht`);
for (const [g, r] of [...rows].sort((a, b) => b[1].bytes - a[1].bytes)) console.log(`   ${g.padEnd(34)} ${String(r.n).padStart(4)} × ${MB(r.bytes).padStart(7)} MB${r.gz !== r.bytes ? ` (gepackt ${MB(r.gz)})` : ''}${r.vor < r.bytes ? `   bis zum Bild ${MB(r.vor)}` : ''}`);
if (fehlAnfragen.length) console.log(`   ⚠ ${fehlAnfragen.length} Anfragen gescheitert: ${fehlAnfragen.slice(0, 3).join('; ')}`);
// ohne Fenster: siehe Kopf (Hintergrundarbeit, auf Prozessoren mit E-Kernen viel zu langsam)
const OHNE_FENSTER = SOFT || HEADED ? '' : ' (ohne Fenster gemessen: Zeiten und Takt fallen auf Prozessoren mit E-Kernen zu schlecht aus, mit --headed wiederholen)';
console.log(`\n── Zeit${SOFT ? ' (Software-WebGL: nicht belastbar)' : ''}${OHNE_FENSTER}`);
console.log(`   Seite da (DOMContentLoaded) ${(nav.dcl / 1000).toFixed(2)} s · Bild der Halle ${(reveal / 1000).toFixed(2)} s · ${ruheDa ? `Ruhe im Netz ${ruhe.toFixed(1)} s` : `Netz nach ${(WARTE / 60000).toFixed(0)} min nicht in Ruhe`}`);
if (offen.length) console.log(`   ⚠ UNVOLLSTÄNDIG: ${offen.length} Anfragen liefen noch, als die Frist ablief; ihre Bytes fehlen unten, und Speicher und Bilder sind während des Ladens gemessen:\n     ${offen.slice(0, 5).join('\n     ')}`);
else if (!ruheDa) console.log(`   ⚠ UNVOLLSTÄNDIG: die Frist lief ab, bevor ${RUHE / 1000} s ohne fertige Anfrage vergangen waren; die Seite kann danach noch geladen haben, und Speicher und Bilder sind dann während des Ladens gemessen.`);
console.log(`   Hauptfaden am Stück belegt: bis zum Bild ${Math.round(sum(lang.vor))} ms in ${lang.vor.length} Blöcken (längster ${Math.round(max(lang.vor))} ms), danach ${Math.round(sum(lang.nach))} ms in ${lang.nach.length} (längster ${Math.round(max(lang.nach))} ms)`);
console.log('\n── Grafikspeicher (am Zeichenkontext gezählt)');
const ges = sp.texBytes + sp.rbBytes + sp.bufBytes + sp.leinwand;
console.log(`   gesamt ${MB(ges)} MB: Texturen ${MB(sp.texBytes)} MB in ${sp.tex.length} (${sp.tex.filter((t) => t.gepackt).length} gepackt) · Zwischenbilder ${MB(sp.rbBytes)} MB in ${sp.rb.length} · Geometrie ${MB(sp.bufBytes)} MB · Leinwand etwa ${MB(sp.leinwand)} MB`);
if (vramBytes) console.log(`   laut Windows belegt der Grafikprozess ${MB(vramBytes)} MB dedizierten Grafikspeicher`);
const kl = new Map();
for (const t of sp.tex) { const k = `${t.art} ${Math.max(t.w, t.h) >= 4096 ? '≥4096' : Math.max(t.w, t.h) >= 2048 ? '2048' : Math.max(t.w, t.h) >= 1024 ? '1024' : Math.max(t.w, t.h) >= 512 ? '512' : '<512'}`; const e = kl.get(k) || { n: 0, b: 0 }; e.n++; e.b += t.bytes; kl.set(k, e); }
console.log('   Texturen nach Kantenlänge: ' + [...kl].sort((a, b) => b[1].b - a[1].b).map(([k, e]) => `${k} px ${e.n} × = ${MB(e.b)} MB`).join(' · '));
console.log(`   die ${TOP} größten:`);
for (const t of sp.tex.sort((a, b) => b.bytes - a.bytes).slice(0, TOP)) console.log(`     ${`${t.w}×${t.h}${t.d > 1 ? `×${t.d}` : ''}`.padEnd(14)} ${t.art.padEnd(6)} ${t.f.padEnd(10)} ${t.mip ? 'mit Mips ' : 'ohne Mips'} ${MB(t.bytes).padStart(6)} MB`);
if (sp.rb.length) console.log('   Zwischenbilder: ' + sp.rb.sort((a, b) => b.bytes - a.bytes).slice(0, 8).map((r) => `${r.w}×${r.h} ${r.f}${r.s > 1 ? ` ×${r.s}` : ''} ${MB(r.bytes)} MB`).join(' · '));
console.log(`\n── Bild${OHNE_FENSTER}`);
console.log(`   ${sp.progs} Shaderprogramme`);
for (const b of [stand, dreh].filter(Boolean)) console.log(b.n ? `   ${b.label.padEnd(12)} ${String(b.fps).padStart(6)} Bilder/s · ${b.draws} Zeichenaufrufe${b.multi ? ` (davon ${b.multi} Sammelaufrufe mit ${b.teile} Teilen)` : ''} · ${b.tris.toLocaleString('de-DE')} Dreiecke · Hauptfaden ${b.cpu} ms je Bild (95 %: ${b.cpu95} ms)` : `   ${b.label.padEnd(12)} kein Bild gezeichnet`);
console.log('\n── Arbeitsspeicher');
console.log(`   JS-Heap ${MB(metr.JSHeapUsedSize)} MB belegt (${MB(metr.JSHeapTotalSize)} MB reserviert), ${metr.Nodes} DOM-Knoten`);
console.log('\n── Meldungen des Viewers');
for (const l of logs.filter((x) => /Leistungsstufe|Texturen je|Bilder nach dem Hochladen|Bild nach der Freigabe|Geometrie nach dem Hochladen|Geometrie nach der Freigabe|FEHLER/.test(x))) console.log(`   ${l}`);
console.log('');
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ url, soft: SOFT, fenster: HEADED, telefon: TELEFON, netz: NETZ, netzwerk: { anfragen: allN, bytes: all, gepackt: gzAll, bisBild: vor, gruppen: Object.fromEntries(rows) }, zeit: { dcl: nav.dcl, bild: reveal, ruhe: ruheDa ? ruhe * 1000 : null, offen, langVor: sum(lang.vor), langNach: sum(lang.nach), langMax: Math.max(max(lang.vor), max(lang.nach)) }, grafik: { gesamt: ges, texturen: sp.texBytes, zwischenbilder: sp.rbBytes, geometrie: sp.bufBytes, leinwand: sp.leinwand, vram: vramBytes, tex: sp.tex, rb: sp.rb, programme: sp.progs }, bild: { stand, dreh }, heap: metr.JSHeapUsedSize, logs }, null, 1));
