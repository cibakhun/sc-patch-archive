/* ============================================================
   render-hangar-cards.mjs — Schiffsbilder des Docks aus den Hangar-Modellen.

   WARUM: Das Dock zeigte die Vorschaubilder des Wikis, je Schiff ein anderes
   Motiv (Flug, Werbebild, Landeplatz), bei 13 Schiffen gar keins, und jedes
   kam von einem fremden Server. Krisz (29.10.2026): die Suche ist „painy“.
   Ein Schiff erkennt man am schnellsten, wenn alle gleich stehen: dieselbe
   Ansicht schraeg von vorn, dasselbe Licht, ohne Hintergrund. Dazu je Schiff
   eine Draufsicht als Umriss, maszstabsgetreu, fuer den Groessenvergleich in
   der Schnellansicht.

   WAS: laedt jedes Modell aus public/hangar/ships/<id>.glb (dieselben Dateien
   wie die Halle) in einem Chromium mit three.js und schreibt
     public/hangar/cards/<id>.webp      480x270, schraeg von vorn, transparent
     public/hangar/cards/top/<id>.webp  Draufsicht, Bug oben, weisz auf transparent
     src/data/hangar-cards.json         je Schiff Inhalts-Kennung und die
                                        Maszen des Modells in Metern (w, l, h)
   Die Umrisse haben alle denselben Maszstab je Meter (TOP_PPM), gekappt auf
   TOP_MAX Pixel an der laengsten Seite; die Seite rechnet mit l und w.

   WIE: einmalig nach einem neuen Modellstand, nicht im Build (braucht einen
   Browser mit WebGL, Schiene C). Ohne Grafikkarte reicht SwiftShader:
     CHROME_PATH=/opt/pw-browsers/chromium node scripts/render-hangar-cards.mjs
     node scripts/render-hangar-cards.mjs --only aegs-gladius,drak-cutlass-black
   Rund 2–6 s je Schiff.
   ============================================================ */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public/hangar/cards');
const DATA = path.join(ROOT, 'src/data/hangar-cards.json');
const VIEW = { az: 140, el: 18 };
const CARD = { w: 480, h: 270, pad: 0.06 };
const TOP_PPM = 8;
const TOP_MAX = 320;

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] ?? '' : null; };
const only = arg('--only')?.split(',').filter(Boolean) ?? null;

const ids = Object.keys(JSON.parse(readFileSync(path.join(ROOT, 'src/data/holo-meshes.json'), 'utf8')).meshes);
const unknown = (only ?? []).filter((id) => !ids.includes(id));
if (unknown.length) { console.error(`render-hangar-cards: unbekannte Id ${unknown.join(', ')}`); process.exit(2); }
const todo = only ?? ids;
if (!todo.length) { console.error('render-hangar-cards: keine Id ausgewählt'); process.exit(2); }

const BROWSER = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p));
if (!BROWSER) { console.error('render-hangar-cards: kein Browser gefunden, CHROME_PATH setzen'); process.exit(2); }

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/vendor/three/three.module.min.js","three/addons/":"/vendor/three/addons/"}}</script>
<style>html,body{margin:0;background:transparent}</style></head><body><canvas id="c" width="1440" height="810"></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from '/env/RoomEnvironment.js';
const canvas = document.getElementById('c');
const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setClearColor(0x000000, 0);
r.outputColorSpace = THREE.SRGBColorSpace;
const env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/vendor/three/addons/libs/draco/gltf/'));
window.shot = async (url, az, el, ppm, maxPx) => {
  const scene = new THREE.Scene();
  scene.environment = env;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-1, 2, 1.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd7a0, 1.2); rim.position.set(2, 1, -2); scene.add(rim);
  const root = (await loader.loadAsync(url)).scene;
  // Glas halb durchsichtig, sonst steht vor jedem Cockpit eine graue Scheibe.
  root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.transmission > 0 || m.transparent) { m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 0.35); m.depthWrite = false; } });
  scene.add(root);
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const rad = s.length() / 2, fov = 30;
  r.setSize(1440, 810, false);
  const cam = new THREE.PerspectiveCamera(fov, canvas.width / canvas.height, rad / 100, rad * 100);
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  cam.position.copy(c).addScaledVector(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)), rad / Math.sin(THREE.MathUtils.degToRad(fov / 2)) * 1.05);
  cam.lookAt(c);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.35;
  r.render(scene, cam);
  const card = canvas.toDataURL('image/png');
  // Draufsicht: orthografisch, Bug oben (die Modelle zeigen mit dem Bug nach -Z).
  const k = Math.min(ppm, maxPx / Math.max(s.x, s.z));
  const W = Math.ceil(s.x * k) + 4, H = Math.ceil(s.z * k) + 4;
  const top = new THREE.OrthographicCamera(-W / 2 / k, W / 2 / k, H / 2 / k, -H / 2 / k, 0.01, s.y + 10);
  top.position.set(c.x, box.max.y + 2, c.z); top.up.set(0, 0, -1); top.lookAt(c);
  scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  r.setSize(W, H, false); r.toneMapping = THREE.NoToneMapping;
  r.render(scene, top);
  const plan = canvas.toDataURL('image/png');
  root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  return { card, plan, size: [s.x, s.y, s.z] };
};
window.ready = true;
</script></body></html>`;

const PAGE_ENV = path.join(ROOT, 'node_modules/three/examples/jsm/environments/RoomEnvironment.js');
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = null;
  if (url === '/render.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  if (url === '/env/RoomEnvironment.js') file = PAGE_ENV;
  else if (url.startsWith('/vendor/') || url.startsWith('/hangar/')) file = path.join(ROOT, 'public', url);
  // Nach dem Dekodieren kann ein „..%2f“ aus public/ fuehren: nur was darin liegt.
  if (!file || !(file === PAGE_ENV || file.startsWith(path.join(ROOT, 'public') + path.sep)) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: BROWSER, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let page = null;
const fresh = async () => {
  await page?.close();
  page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  await page.goto(`${base}/render.html`);
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
};

await mkdir(path.join(OUT, 'top'), { recursive: true });
const prev = existsSync(DATA) ? JSON.parse(await readFile(DATA, 'utf8')) : { ships: {} };
const ships = { ...prev.ships };
const png = (d) => Buffer.from(d.split(',')[1], 'base64');
// Nach jedem Schiff geschrieben: bricht der Lauf ab, passen Bilder und
// Kennungen trotzdem zusammen (verify:hangar [19] prueft v gegen den Inhalt).
const saveData = () => writeFile(DATA, `${JSON.stringify({ view: VIEW, card: { w: CARD.w, h: CARD.h }, topMax: TOP_MAX, ships: Object.fromEntries(Object.keys(ships).sort().map((k) => [k, ships[k]])) }, null, 1)}\n`);
const round = (x) => Math.round(x * 10) / 10;

/**
 * Nimmt Kleinteile aus dem Bild, die fern vom Schiff schweben (ein loser Stab
 * neben der 325a machte sie im Rahmen winzig): Inseln im Alphakanal mit
 * weniger als 5 % der Flaeche der groessten, die ausserhalb ihres um ein
 * Zehntel erweiterten Rahmens liegen. Der Stab der 325a hat 1,1 %. Gerechnet auf einem Raster aus
 * 4x4-Bloecken. Liefert das Bild und wie viele Inseln wegfielen.
 */
async function dropSpecks(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const S = 4, gw = Math.ceil(W / S), gh = Math.ceil(H / S);
  const grid = new Uint8Array(gw * gh);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 8) grid[((y / S) | 0) * gw + ((x / S) | 0)] = 1;
  const lab = new Int32Array(gw * gh).fill(-1);
  const comps = [];
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i] || lab[i] >= 0) continue;
    const c = { n: 0, x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
    lab[i] = comps.length;
    const todo = [i];
    while (todo.length) {
      const j = todo.pop();
      const x = j % gw, y = (j / gw) | 0;
      c.n++; c.x0 = Math.min(c.x0, x); c.y0 = Math.min(c.y0, y); c.x1 = Math.max(c.x1, x); c.y1 = Math.max(c.y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, nj = ny * gw + nx;
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && grid[nj] && lab[nj] < 0) { lab[nj] = comps.length; todo.push(nj); }
      }
    }
    comps.push(c);
  }
  if (comps.length < 2) return { buf, dropped: 0 };
  const main = comps.reduce((a, b) => (b.n > a.n ? b : a));
    const px = (main.x1 - main.x0) * 0.1 + 2, py = (main.y1 - main.y0) * 0.1 + 2;
  const keep = comps.map((c) => c === main || c.n >= main.n * 0.05
    || (c.x1 >= main.x0 - px && c.x0 <= main.x1 + px && c.y1 >= main.y0 - py && c.y0 <= main.y1 + py));
  const dropped = keep.filter((k) => !k).length;
  if (!dropped) return { buf, dropped };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const l = lab[((y / S) | 0) * gw + ((x / S) | 0)];
    if (l >= 0 && !keep[l]) data[(y * W + x) * 4 + 3] = 0;
  }
  return { buf: await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), dropped };
}

let done = 0, failed = 0;
for (const id of todo) {
  const glb = path.join(ROOT, 'public/hangar/ships', `${id}.glb`);
  if (!existsSync(glb)) { console.log(`  fehlt  ${id} (kein Hangar-Modell)`); failed++; continue; }
  // Eine Seite je 25 Schiffe: SwiftShader gibt Speicher nur beim Schliessen ganz frei.
  if (done % 25 === 0) await fresh();
  const t0 = Date.now();
  try {
    const r = await page.evaluate(([u, az, el, ppm, mx]) => window.shot(u, az, el, ppm, mx), [`/hangar/ships/${id}.glb`, VIEW.az, VIEW.el, TOP_PPM, TOP_MAX]);
    const shot = await dropSpecks(png(r.card));
    const trimmed = await sharp(shot.buf).trim({ threshold: 1 }).toBuffer();
    const m = await sharp(trimmed).metadata();
    const k = Math.min((CARD.w * (1 - 2 * CARD.pad)) / m.width, (CARD.h * (1 - 2 * CARD.pad)) / m.height);
    const fit = await sharp(trimmed).resize(Math.max(1, Math.round(m.width * k)), Math.max(1, Math.round(m.height * k)), { kernel: 'lanczos3' }).toBuffer();
    const card = await sharp({ create: { width: CARD.w, height: CARD.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fit, gravity: 'centre' }]).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toBuffer();
    // Breite und Laenge in Metern aus dem Umriss selbst, wie er nach dem
    // Zuschnitt dasteht: die Seite streckt ihn auf genau diese Masse.
    const top = await dropSpecks(png(r.plan));
    const planPng = await sharp(top.buf).trim({ threshold: 1 }).toBuffer();
    const pm = await sharp(planPng).metadata();
    const ppm = Math.min(TOP_PPM, TOP_MAX / Math.max(r.size[0], r.size[2]));
    const plan = await sharp(planPng).webp({ quality: 85, alphaQuality: 85, effort: 6 }).toBuffer();
    await writeFile(path.join(OUT, `${id}.webp`), card);
    await writeFile(path.join(OUT, 'top', `${id}.webp`), plan);
    const v = createHash('sha256').update(card).update(plan).digest('hex').slice(0, 8);
    ships[id] = { v, w: round(pm.width / ppm), l: round(pm.height / ppm), h: round(r.size[1]) };
    await saveData();
    done++;
    console.log(`  ${id.padEnd(40)} ${String(Date.now() - t0).padStart(5)} ms  ${(card.length / 1024).toFixed(0)} + ${(plan.length / 1024).toFixed(0)} KB${shot.dropped + top.dropped ? `  ${shot.dropped + top.dropped} lose Teile weg` : ''}`);
  } catch (e) {
    failed++;
    console.log(`  FEHLER ${id}: ${String(e).slice(0, 160)}`);
    await fresh();
  }
}
await browser.close();
server.close();
await saveData();
console.log(`\nrender-hangar-cards: ${done} Schiffe gerendert, ${failed} fehlgeschlagen, ${Object.keys(ships).length} in ${path.relative(ROOT, DATA)}`);
if (failed) process.exit(1);
