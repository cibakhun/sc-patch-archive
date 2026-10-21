/* ============================================================
   check-hangar-shader.mjs — kein Bildshader des Hangars ueber 16 Texturen

   WARUM: Chrome unter Windows (ANGLE ueber Direct3D 11) erlaubt 16
   Texturen je Bildshader. Ein Programm darueber linkt dort nicht; sein
   Material bleibt unsichtbar, nur sein Schatten faellt. So fehlten
   Wartungsplatz und Hallendeko auf staging (Krisz, 21.10.2026): der Shader
   der lackierten Geraete (dienst_flach) brauchte 17. Software-WebGL
   (SwiftShader: CI, Cloud) erlaubt 32 und zeigte alles — jede Aufnahme
   dort war gruen, der Rauchtest sieht die Halle gar nicht (Rueckfall).

   WIE: laedt /hangar.html?grafik=hoch (nur dort steht die ganze
   Hallendeko) in Chromium mit Software-WebGL und gibt sich als Grafikkarte
   aus, sonst zeigt die Seite ihren Rueckfall. Zaehlt beim Linken jedes
   Programms selbst die Sampler, die sein Bildshader wirklich nutzt, und
   liest die Zeile des Viewers ("[hangar] Texturen je Bildshader") nur
   gegen. Gewartet wird, bis die Hallendeko steht und der Viewer sie
   uebersetzt hat (compileFor uebersetzt ganze Gruppen, auch was ausserhalb
   des Bildes liegt).

   FEHLER: ein Programm ueber 16 Texturen; ein Programm linkt nicht; die
   Hallendeko oder die Zeile des Viewers kommt nicht. Klinken: Programme
   gesamt und Programme mit Schichttafel (Wartungsplatz und Deko), damit ein
   Lauf, der die Halle nicht erreicht, nicht gruen aussieht.

     node scripts/check-hangar-shader.mjs --base http://localhost:4321
     CHROME_PATH=/pfad/zu/chromium npm run check:hangar-shader -- --base …
   ============================================================ */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = flag('--base', process.env.SMOKE_BASE || 'http://localhost:4321').replace(/\/$/, '');
const GRENZE = 16;
// Gemessen 21.10.2026 auf hoch mit der Gladius: 73 Programme, 2 mit
// Schichttafel (Halle und Grube). Klinken nur nach oben.
const KLINKE = { programme: 60, schichten: 2 };
const WARTE_MS = 15 * 60 * 1000, NACHLAUF_MS = 20000;

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
if (!BROWSER) {
  console.error('\nKein Browser gefunden; einen Pfad ueber CHROME_PATH setzen.\n');
  process.exit(2);
}

// Im Browser vor jedem Skript der Seite: Grafikkarte vortaeuschen, die
// Leistungsbremse aus getContext nehmen, und je gelinktem Programm zaehlen.
function vorSeite() {
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o) {
    if (o && typeof o === 'object') { o = { ...o }; delete o.failIfMajorPerformanceCaveat; }
    return gc.call(this, t, o);
  };
  const C = WebGL2RenderingContext.prototype, gp = C.getParameter, link = C.linkProgram;
  C.getParameter = function (p) { return p === 0x9246 ? 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)' : gp.call(this, p); };
  window.__texProgramme = [];
  C.linkProgram = function (prog) {
    link.call(this, prog);
    try {
      const fs = (this.getAttachedShaders(prog) || []).find((s) => this.getShaderParameter(s, this.SHADER_TYPE) === this.FRAGMENT_SHADER);
      const src = fs ? this.getShaderSource(fs) || '' : '';
      const art = new Set(['SAMPLER_2D', 'SAMPLER_CUBE', 'SAMPLER_3D', 'SAMPLER_2D_ARRAY', 'SAMPLER_2D_SHADOW', 'SAMPLER_CUBE_SHADOW', 'SAMPLER_2D_ARRAY_SHADOW', 'INT_SAMPLER_2D', 'UNSIGNED_INT_SAMPLER_2D'].map((k) => this[k]));
      let n = 0;
      const ok = this.getProgramParameter(prog, this.LINK_STATUS);
      if (ok) for (let i = 0, c = this.getProgramParameter(prog, this.ACTIVE_UNIFORMS); i < c; i++) {
        const u = this.getActiveUniform(prog, i);
        if (u && art.has(u.type) && new RegExp('\\b' + u.name.replace(/\[\d+\]$/, '') + '\\b').test(src)) n += u.size;
      }
      const name = (src.match(/#define SHADER_NAME (.+)/) || [])[1] || '?';
      window.__texProgramme.push({ name: name.trim(), n, ok, schichten: /dienstTafel/.test(src) });
    } catch (e) {
      window.__texProgramme.push({ name: '?', n: 0, ok: false, zaehlung: e.message, schichten: false });
    }
  };
}

console.log(`\n=== Bildshader des Hangars gegen ${BASE} ===`);
console.log(`Browser: ${BROWSER} (Software-WebGL, Grafikkarte vorgetaeuscht)   Grenze: ${GRENZE} Texturen je Bildshader\n`);
const browser = await chromium.launch({ executablePath: BROWSER, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(vorSeite);
let deko = '', viewer = '';
const shaderFehler = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('[hangar] Hallendeko:')) deko = t;
  if (t.startsWith('[hangar] Texturen je Bildshader:')) viewer = t;
  if (/THREE\.WebGLProgram: Shader Error/.test(t)) shaderFehler.push(t.split('\n')[0].slice(0, 200));
});
const fehler = [];
try {
  await page.goto(`${BASE}/hangar.html?grafik=hoch`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const t0 = Date.now();
  while (!deko && Date.now() - t0 < WARTE_MS) {
    if (await page.evaluate(() => document.getElementById('hg-fallback')?.hidden === false)) { fehler.push('die Seite zeigt ihren Rueckfall statt der Halle'); break; }
    await page.waitForTimeout(2000);
  }
  if (!deko && !fehler.length) fehler.push(`nach ${WARTE_MS / 60000} min keine Zeile "[hangar] Hallendeko:"`);
  if (deko) await page.waitForTimeout(NACHLAUF_MS);
} catch (e) {
  fehler.push(`Aufruf fehlgeschlagen: ${e.message.split('\n')[0]}`);
}
const progs = await page.evaluate(() => window.__texProgramme ?? []).catch(() => []);
await browser.close();

const ueber = progs.filter((p) => p.n > GRENZE), kaputt = progs.filter((p) => !p.ok);
const max = progs.reduce((a, p) => Math.max(a, p.n), 0), schichten = progs.filter((p) => p.schichten).length;
const oben = [...progs].sort((a, b) => b.n - a.n).slice(0, 4).map((p) => `${p.name} ${p.n}`).join(', ');
console.log(`  Programme gelinkt: ${progs.length} (Klinke ${KLINKE.programme}), davon mit Schichttafel: ${schichten} (Klinke ${KLINKE.schichten})`);
console.log(`  hoechstens ${max} Texturen; die meisten: ${oben || '—'}`);
console.log(`  ${deko ? deko.slice(9, 100) : 'Hallendeko: —'}`);
console.log(`  Viewer meldet: ${viewer ? viewer.slice(9) : '—'}`);
for (const p of ueber) fehler.push(`${p.name} braucht ${p.n} Texturen, Grenze ${GRENZE}: unter Windows unsichtbar`);
for (const p of kaputt) fehler.push(p.zaehlung ? `Zaehlung eines Programms fehlgeschlagen (${p.zaehlung}): ungeprueft` : `${p.name} linkt nicht`);
for (const s of shaderFehler) fehler.push(s);
if (deko && progs.length < KLINKE.programme) fehler.push(`nur ${progs.length} Programme gelinkt, Klinke ${KLINKE.programme}`);
if (deko && schichten < KLINKE.schichten) fehler.push(`nur ${schichten} Programme mit Schichttafel, Klinke ${KLINKE.schichten}: Wartungsplatz oder Deko nicht uebersetzt`);
if (deko && !viewer) fehler.push('der Viewer meldet keine Zeile "[hangar] Texturen je Bildshader" mehr');

if (fehler.length) {
  console.error(`\ncheck-hangar-shader: ${fehler.length} FEHLER\n`);
  for (const f of fehler) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\ncheck-hangar-shader: kein Bildshader ueber der Grenze ✓\n');
