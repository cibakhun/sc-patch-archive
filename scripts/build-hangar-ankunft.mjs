/* ============================================================
   build-hangar-ankunft.mjs — Ankunftsbilder der Hallen fuer die Ladeszene.

   WARUM: Beim ersten Laden und beim Hallenwechsel stand im Hangar ein leeres
   Bild mit einem 2 px duennen Balken, eine halbe Minute und laenger (Krisz
   22.11.2026: „alles noch sehr alpha vibey“). Die Ladeszene (ankunftAn in
   assets/hangar-overview.js) zeigt stattdessen ein Standbild der Halle, in
   die das Schiff gleich kommt, darauf Name und Ladeschritte, und blendet
   dann ins Live-Bild. Das Standbild muss es geben, bevor die Halle geladen
   ist: also vorab gerendert, klein und weichgezeichnet (der Blick passt nie
   genau zur Kamera des Schiffs, die Unschaerfe verbirgt das, und das
   Scharfwerden beim Ueberblenden liest sich als Ankommen).

   WAS: oeffnet die gebaute Seite (dist/, Vorschau-Bau: STAGING=1) je Halle
   mit einem typischen Schiff dieser Stufe, wartet, bis es steht, blendet das
   Schiff aus und schreibt das Bild der Leinwand als
     public/hangar/ankunft/<halle>.webp     960x540, weichgezeichnet
   <halle>: die Id der Halle (HALL_OF_SIZE in src/lib/hangar/stage.ts) und
   'werk' fuer die Werkhalle der Bodenfahrzeuge. HangarApp.astro liest den
   Ordner und gibt die Bilder in #hg-stage als `ankunft` weiter.

   WIE: einmalig nach einem neuen Hallenstand, nicht im Build (braucht einen
   Browser mit WebGL, Schiene C). Ohne Grafikkarte reicht SwiftShader, dann
   rund zwei Minuten je Halle:
     STAGING=1 npm run build
     node scripts/build-hangar-ankunft.mjs
     node scripts/build-hangar-ankunft.mjs --only util-xltop,werk
     node scripts/build-hangar-ankunft.mjs --base http://127.0.0.1:4321
     node scripts/build-hangar-ankunft.mjs --gpu     (am PC: Grafikkarte, sichtbares Fenster)
   ============================================================ */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'public/hangar/ankunft');
// je Halle ein Schiff, das sie typisch fuellt: Die Kamera steht, wie sie
// fuer dieses Schiff steht, das Schiff selbst wird ausgeblendet
const HALLEN = [
  ['util-smltop', 'orig-300i'],
  ['util-medtop', 'crus-spirit-c1'],
  ['util-lrgtop', 'orig-600i'],
  ['util-xltop', 'rsi-polaris'],
  ['werk', 'tmbl-cyclone'],
];
const BILD = { w: 960, h: 540, blur: 2.2, q: 62 };
// der Griff auf die Buehne: nur in diesem Lauf, die Seite selbst bietet keinen
const HAKEN = 'const controls = new OrbitControls(camera, renderer.domElement);';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] ?? '' : null; };
const only = arg('--only')?.split(',').filter(Boolean) ?? null;
const unknown = (only ?? []).filter((k) => !HALLEN.some(([h]) => h === k));
if (unknown.length) { console.error(`build-hangar-ankunft: unbekannte Halle ${unknown.join(', ')} (bekannt: ${HALLEN.map(([h]) => h).join(', ')})`); process.exit(2); }
const todo = HALLEN.filter(([h]) => !only || only.includes(h));

const BROWSER = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p));
if (!BROWSER) { console.error('build-hangar-ankunft: kein Browser gefunden, CHROME_PATH setzen'); process.exit(2); }

let base = arg('--base'), server = null;
if (!base) {
  if (!existsSync(path.join(DIST, 'de/hangar.html'))) { console.error('build-hangar-ankunft: dist/de/hangar.html fehlt, erst als Vorschau bauen (STAGING=1 npm run build)'); process.exit(2); }
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  server = createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    let f = path.join(DIST, p.endsWith('/') ? `${p}index.html` : p);
    // an der Verzeichnisgrenze pruefen: ein blosses Praefix liesse dist-* daneben durch,
    // und dist selbst liesse ueber den .html-Rueckfall dist.html daneben durch
    if (!f.startsWith(DIST + path.sep)) { res.writeHead(403).end(); return; }
    if (!existsSync(f) || statSync(f).isDirectory()) {
      if (existsSync(`${f}.html`)) f += '.html';
      else { res.writeHead(404).end(); return; }
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] ?? 'application/octet-stream' });
    createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
}

mkdirSync(OUT, { recursive: true });
// --gpu: mit der Grafikkarte im sichtbaren Fenster (am PC schneller); sonst SwiftShader
const GPU = process.argv.includes('--gpu');
const browser = await chromium.launch({ executablePath: BROWSER, headless: !GPU, args: [...(GPU ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
let fehler = 0;
try {
  for (const [halle, ship] of todo) {
    const t0 = Date.now();
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, locale: 'de-DE' });
    // Leinwand lesbar halten; Hinweise, Hilfe und der Einstieg am Leitstand
    // gelten als gesehen, sonst stuende die Kamera vor dem Bildschirm
    await ctx.addInitScript((soft) => {
      // Ohne Grafikkarte nennt sich SwiftShader beim Namen, und die Seite
      // startet dann keine Buehne (gpuMiss): Sie sieht eine Grafikkarte der
      // Mittelklasse und waehlt die hohe Stufe, wie die meisten Besucher
      if (soft) {
        for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
          if (!C) continue;
          const gp = C.prototype.getParameter;
          C.prototype.getParameter = function (p) {
            if (p === 0x9246) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)';
            if (p === 0x9245) return 'Google Inc. (NVIDIA)';
            return gp.call(this, p);
          };
        }
      }
      const gc = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attrs) {
        if (attrs && typeof attrs === 'object' && /webgl/.test(type)) { attrs = { ...attrs, preserveDrawingBuffer: true }; delete attrs.failIfMajorPerformanceCaveat; }
        return gc.call(this, type, attrs);
      };
      try {
        sessionStorage.setItem('hg-besuch', '1');
        for (const [k, v] of [['vb.help.seen', '{"hangar":1}'], ['hg-hint', '1'], ['hg-tipps', '1']]) localStorage.setItem(k, v);
      } catch { /* ohne Speicher steht hoechstens ein Hinweis mehr im Bild, die Leinwand zaehlt allein */ }
    }, !GPU);
    await ctx.route((u) => u.origin !== new URL(base).origin, (r) => r.abort());
    let haken = true;
    await ctx.route(/hangar-viewer[^/]*\.js/, async (route) => {
      const r = await route.fetch();
      const body = await r.text();
      haken = body.includes(HAKEN);
      await route.fulfill({ response: r, body: body.replace(HAKEN, `${HAKEN} window.__ankunft = { cur: () => current, controls };`) });
    });
    const page = await ctx.newPage();
    try {
      await page.goto(`${base}/de/hangar.html?ship=${ship}&tafel=1`, { waitUntil: 'domcontentloaded', timeout: 120e3 });
      await page.waitForFunction(() => {
        if (!document.getElementById('hg-fallback')?.hidden) throw new Error(`keine Buehne: ${document.getElementById('hg-fallback').textContent.trim().slice(0, 120)}`);
        return window.__ankunft?.cur() && document.getElementById('hg-load')?.hidden;
      }, null, { timeout: 600e3, polling: 1000 });
      // Licht, Schatten und Kamerafahrt zur Ruhe kommen lassen
      await page.waitForTimeout(6000);
      // Das Schiff aus: seine Teile, nicht die Gruppe (deren Sichtbarkeit setzt
      // der Viewer jedes Bild neu). Ein Hauch Hoehe aendert die Kennung, an der
      // er erkennt, dass die Schattenkarten neu muessen (shadowsDue), sonst
      // bliebe der Schatten des Schiffs am Boden; 'end' weckt die Bildschleife.
      await page.evaluate(() => {
        const a = window.__ankunft, g = a.cur().group;
        for (const k of g.children) k.visible = false;
        g.position.y += 0.002;
        a.controls.dispatchEvent({ type: 'end' });
      });
      await page.waitForTimeout(2500);
      const url = await page.evaluate(() => document.querySelector('#hg-canvas canvas')?.toDataURL('image/png'));
      if (!url) throw new Error('keine Leinwand');
      const file = path.join(OUT, `${halle}.webp`);
      const info = await sharp(Buffer.from(url.split(',')[1], 'base64'))
        .resize(BILD.w, BILD.h, { fit: 'cover' })
        .blur(BILD.blur)
        .webp({ quality: BILD.q, effort: 6 })
        .toFile(file);
      console.log(`${halle.padEnd(12)} ${ship.padEnd(16)} ${(info.size / 1024).toFixed(1)} KB  ${((Date.now() - t0) / 1000).toFixed(0)} s  -> ${path.relative(ROOT, file)}`);
    } catch (e) {
      fehler++;
      console.error(`${halle}: ${haken ? e.message : 'Haken im Viewer nicht gefunden (OrbitControls-Zeile geaendert?), HAKEN anpassen'}`);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server?.close();
}
if (fehler) { console.error(`build-hangar-ankunft: ${fehler} von ${todo.length} Hallen ohne Bild`); process.exit(1); }
console.log(`build-hangar-ankunft: ${todo.length} Bilder in ${path.relative(ROOT, OUT)}`);
