/* ============================================================
   render-am-schiff.mjs — ruhende Bilder fuer „Am Schiff“ in der Chronik 4.10.3.

   WARUM: Die Buehne zeigt bis zum Klick ein Bild, kein WebGL. Das Bild kommt
   aus demselben Viewer (assets/patch-4-10-3/am-schiff.js) in Ruhestellung,
   mit dem roten Teil; das Modell loest es nach dem Klick ohne Sprung ab.
   Das Raumlicht des Viewers rechnet dieses Skript ebenfalls vorab: der
   PMREMGenerator hielt die Seite im Browser kalt 0,6 s an.

   WAS: schreibt mit --umgebung (oder wenn sie fehlt)
     assets/patch-4-10-3/raum-umgebung.bin   RoomEnvironment als PMREM-Atlas
       384x512 (Wuerfelseite 128), RGB als Halbfloat, gzip; Groesse 128 statt
       256 weicht im Bild um 0,4 Stufen im Mittel ab und ist ein Viertel so gross.
   Dann liest es Modell und Einbauorte aus dem gebauten Vorschau-Stand
   (dist/de/patches/4-10-3-film.html, .amschiff__daten) und schreibt je Schiff
     assets/patch-4-10-3/render/<id>-am-schiff.webp       1200x675
     assets/patch-4-10-3/render/<id>-am-schiff-800.webp   800x450
   Gerendert wird mit 1600x900 und verkleinert. Eine groessere Datei als die
   Buehne (rund 1150 px am Schreibtisch) kostete beim ersten Zeichnen 35 ms.
   Die Bilder sind deckend auf dem Grund der Buehne (--bg-2): ein Bild mit
   Alphakanal hielt beim Vorladen kalt ein Bild bis 34 ms an.

   WIE (Schiene C, braucht Chromium mit WebGL), nach einem Vorschau-Bau:
     $env:STAGING='1'; npm run build; node scripts/render-am-schiff.mjs [--umgebung]
   ============================================================ */
import { gzipSync } from 'node:zlib';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'assets/patch-4-10-3/render');
const W = 1600, H = 900, GROSS = 1200, KLEIN = 800;
const WEBP = { quality: 82, effort: 6 };
const GRUND = '#0b0c12';

const html = readFileSync(path.join(ROOT, 'dist/de/patches/4-10-3-film.html'), 'utf8');
const json = /<script type="application\/json" class="amschiff__daten">([\s\S]*?)<\/script>/.exec(html)?.[1];
if (!json) { console.error('render-am-schiff: .amschiff__daten fehlt, erst mit STAGING=1 bauen'); process.exit(2); }
const schiffe = JSON.parse(json).map((s) => ({ ...s, id: path.basename(s.modell.split('?')[0], '.glb') }));

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/vendor/three/three.module.min.js","three/addons/":"/vendor/three/addons/"}}</script>
<style>html,body{margin:0;background:transparent}#b{position:relative;width:${W}px;height:${H}px}#b canvas{position:absolute;inset:0;width:100%;height:100%}</style>
</head><body><div id="b"></div><script type="module">
import { buehne } from '/assets/patch-4-10-3/am-schiff.js';
const b = buehne(document.getElementById('b'), { eilig: true });
window.zeige = (s) => b.zeige(s);
window.bereit = true;
</script></body></html>`;

const UMGEBUNG = path.join(ROOT, 'assets/patch-4-10-3/raum-umgebung.bin');
const UMGEBUNG_SEITE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/vendor/three/three.module.min.js"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from '/assets/patch-4-10-3/RoomEnvironment.js';
const r = new THREE.WebGLRenderer();
const rt = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 128 });
const px = new Uint16Array(rt.width * rt.height * 4);
r.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, px);
window.umgebung = { w: rt.width, h: rt.height, rgb: Array.from(px.filter((_, i) => i % 4 !== 3)) };
</script></body></html>`;

const TYPES = { '.bin': 'application/octet-stream', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/render.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  if (url === '/umgebung.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(UMGEBUNG_SEITE); return; }
  const file = url.startsWith('/assets/patch-4-10-3/') ? path.join(ROOT, url)
    : url.startsWith('/vendor/') || url.startsWith('/hangar/') ? path.join(ROOT, 'public', url) : null;
  const erlaubt = file && [path.join(ROOT, 'assets', 'patch-4-10-3'), path.join(ROOT, 'public')].some((d) => file.startsWith(d + path.sep));
  if (!erlaubt || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));

const BROWSER = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p));
if (!BROWSER) { console.error('render-am-schiff: kein Browser gefunden, CHROME_PATH setzen'); process.exit(2); }
const browser = await chromium.launch({ executablePath: BROWSER, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// Ruhestellung: bei reduzierter Bewegung pendelt nichts, und das Teil leuchtet voll.
if (process.argv.includes('--umgebung') || !existsSync(UMGEBUNG)) {
  const seite = await browser.newPage();
  await seite.goto(`http://127.0.0.1:${server.address().port}/umgebung.html`);
  const u = await (await seite.waitForFunction(() => window.umgebung)).jsonValue();
  if (u.w !== 384 || u.h !== 512) throw new Error(`Raumlicht ${u.w}x${u.h} statt 384x512 (am-schiff.js liest diese Groesse)`);
  await writeFile(UMGEBUNG, gzipSync(Buffer.from(new Uint16Array(u.rgb).buffer), { level: 9 }));
  console.log(`raum-umgebung.bin: ${u.w}x${u.h}`);
  await seite.close();
}
const page = await browser.newPage({ viewport: { width: W, height: H }, reducedMotion: 'reduce' });
page.on('pageerror', (e) => { console.error('render-am-schiff:', e.message); process.exitCode = 1; });
await page.goto(`http://127.0.0.1:${server.address().port}/render.html`);
await page.waitForFunction(() => window.bereit);
for (const s of schiffe) {
  if (!(await page.evaluate((x) => window.zeige(x), s))) throw new Error(`${s.id}: Modell nicht gezeigt`);
  await page.waitForTimeout(500);
  const bild = await sharp(await page.locator('#b').screenshot({ omitBackground: true })).flatten({ background: GRUND }).toBuffer();
  await writeFile(path.join(OUT, `${s.id}-am-schiff.webp`), await sharp(bild).resize(GROSS, GROSS * H / W, { kernel: 'lanczos3' }).webp(WEBP).toBuffer());
  await writeFile(path.join(OUT, `${s.id}-am-schiff-${KLEIN}.webp`), await sharp(bild).resize(KLEIN, KLEIN * H / W, { kernel: 'lanczos3' }).webp(WEBP).toBuffer());
  console.log(`${s.id}: ${s.hardpoints.join(', ')}${s.bauteil ? ` (Bauteil ${s.bauteil})` : ''}`);
}
await browser.close();
server.close();
