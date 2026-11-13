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
     node scripts/check-hangar-shader.mjs --base … --ship anvl-carrack
       (ein anderes Schiff als das erste der Liste; seit 25.10.2026 tragen
       alle Schiffe ihre echten Materialien, .planning/notes/hangar-alle-schiffe.md)
     … --shot schiff.png   Aufnahme der Halle am Ende (zum Hinsehen)
     … --layout <code>     mit Layout aus der Werkstatt (?layout=, encodeLayout in
       assets/hangar-layouts.js), etwa einer Lackierung als viertem Feld; sie
       liegt nach dem Laden am Modell (bis 29.10.2026 erst nach einem Klick auf
       den Lack, .planning/notes/hangar-landung.md)
     … --ohne-ui           Aufnahme nur der Halle, Bedienelemente ausgeblendet
     … --innen             danach einsteigen (Knopf #hgx-walk): der Innenraum
       laedt erst dann (.planning/notes/hangar-innenleben.md), seine
       Programme zaehlen mit; die Aufnahme zeigt dann den Blick drinnen.
       FEHLER, wenn das Schiff keinen Innenraum hat oder das Einsteigen nicht
       ankommt (Zeile "[hangar] Licht drinnen")
   Dazu FEHLER, wenn ein Bild des Schiffs nicht laedt (Bildablage
   /hangar/tex/, Meldung des Viewers oder von GLTFLoader).
   Dazu die Freigabe der Bilder (13.11.2026): Der Viewer nimmt jedes Bild
   nach dem Hochladen aus dem Arbeitsspeicher (freeImages, 1 GB in der
   hohen Stufe). FEHLER, wenn er auf diesem Weg ein freigegebenes Bild noch
   einmal verlangt (Zeile "[hangar] Bild nach der Freigabe noch einmal
   verlangt": die Flaeche zeigt dann eine Farbe statt ihrer Karte) oder
   wenn er weniger Bilder freigibt als die Klinke (dann liegt das GB
   wieder im Speicher, und kein Bild sieht anders aus). Das gilt mit
   --ship, --layout und --innen fuer deren Wege mit.
   Dazu die Shader der Vollbildpaesse (13.11.2026): Verdeckung, Entrauscher
   und Schein uebersetzt der Viewer vorab im Hintergrund. Passt der
   Schluessel des vorab uebersetzten Programms nicht zu dem, mit dem der
   Pass wirklich zeichnet (three fuehrt darin etwa, ob die Geometrie
   Normalen hat), uebersetzt das Probebild sie im Stehen: 1,2 s Stillstand
   beim Laden, und kein Bild sieht anders aus. FEHLER, wenn der Viewer das
   meldet (Zeile "[hangar] Vollbildpässe: … erst beim Probebild
   übersetzt") oder gar keine Zeile zu den Paessen kommt (dann steht die
   Nachbearbeitung nicht).
   Dazu das Farbmittel (13.11.2026): Der Viewer misst das Mittel einer
   Farbkarte nur noch fuer Dateien, deren Materialien dressTextured() liest
   (Schiff, Tauschteile, Innenraum), nicht mehr fuer die 324 Farbkarten der
   Halle (0,35 s Rechenzeit im Hauptfaden bei jedem Laden). Geht dabei das
   Schiff durch den Loader der Halle, traegt keine seiner Karten ein Mittel,
   und der dunkelste Lack wird nicht mehr angehoben (albedoFloor): das Schiff
   steht fleckig schwarz da. FEHLER, wenn die Zeile "[hangar] Lack:" eine
   deckende Farbkarte ohne Farbmittel meldet oder weniger Materialien mit
   Mittel als die Klinke (ohne --ship und --layout, also mit der Gladius).
     CHROME_PATH=/pfad/zu/chromium npm run check:hangar-shader -- --base …
   ============================================================ */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const BASE = flag('--base', process.env.SMOKE_BASE || 'http://localhost:4321').replace(/\/$/, '');
const SHIP = flag('--ship', null);
const SHOT = flag('--shot', null);
const LAYOUT = flag('--layout', null);
const OHNE_UI = argv.includes('--ohne-ui'), INNEN = argv.includes('--innen');
if (SHIP && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(SHIP)) { console.error(`\n--ship ${SHIP}: keine Schiffskennung\n`); process.exit(2); }
if (LAYOUT && !/^[A-Za-z0-9_-]{1,4000}$/.test(LAYOUT)) { console.error(`\n--layout ${LAYOUT}: kein Link-Code\n`); process.exit(2); }
const GRENZE = 16;
// Gemessen 21.10.2026 auf hoch mit der Gladius: 73 Programme, 2 mit
// Schichttafel (Halle und Grube). Klinken nur nach oben.
// frei: Bilder, die der Viewer nach dem Hochladen freigibt. Gemessen
// 13.11.2026 auf hoch mit der Gladius: 897 von 901 (1.054 MB).
// lack: Materialien der Gladius mit gemessener Farbkarte (Zeile "[hangar]
// Lack:"). Gemessen 13.11.2026: 118, keine Farbkarte ohne Mittel.
const KLINKE = { programme: 60, schichten: 2, frei: 600, lack: 100 };
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
      window.__texProgramme.push({ name: '?', n: 0, ok: false, zaehlung: String(e?.message || e || 'ohne Meldung'), schichten: false });
    }
  };
}

console.log(`\n=== Bildshader des Hangars gegen ${BASE}${SHIP ? ` (Schiff ${SHIP})` : ''} ===`);
console.log(`Browser: ${BROWSER} (Software-WebGL, Grafikkarte vorgetaeuscht)   Grenze: ${GRENZE} Texturen je Bildshader\n`);
const browser = await chromium.launch({ executablePath: BROWSER, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(vorSeite);
let deko = '', viewer = '', drinnen = '', frei = '', paesse = '', lack = '';
const verlangt = [];
const shaderFehler = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('[hangar] Hallendeko:')) deko = t;
  if (t.startsWith('[hangar] Texturen je Bildshader:')) viewer = t;
  if (t.startsWith('[hangar] Licht drinnen:') || t.startsWith('[hangar] Innenraum geladen:')) drinnen = drinnen ? `${drinnen} · ${t.slice(9)}` : t.slice(9);
  if (/THREE\.WebGLProgram: Shader Error/.test(t)) shaderFehler.push(t.split('\n')[0].slice(0, 200));
  if (t.startsWith('[hangar] Bilder nach dem Hochladen freigegeben:')) frei = t;
  if (t.startsWith('[hangar] Vollbildpässe:')) paesse = t;
  if (t.startsWith('[hangar] Lack:') && !lack) lack = t;
  if (t.startsWith('[hangar] Bild nach der Freigabe noch einmal verlangt')) verlangt.push(t.slice(9, 200));
  if (/^\[hangar\] Bild .* nicht geladen|Couldn't load texture/.test(t)) bildFehler.push(t.slice(0, 200));
});
const bildFehler = [];
const fehler = [];
try {
  await page.goto(`${BASE}/hangar.html?grafik=hoch${SHIP ? `&ship=${SHIP}` : ''}${LAYOUT ? `&layout=${LAYOUT}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const t0 = Date.now();
  while (!deko && Date.now() - t0 < WARTE_MS) {
    if (await page.evaluate(() => document.getElementById('hg-fallback')?.hidden === false)) { fehler.push('die Seite zeigt ihren Rueckfall statt der Halle'); break; }
    await page.waitForTimeout(2000);
  }
  if (!deko && !fehler.length) fehler.push(`nach ${WARTE_MS / 60000} min keine Zeile "[hangar] Hallendeko:"`);
  if (deko) await page.waitForTimeout(NACHLAUF_MS);
  if (deko && INNEN) {
    const vorher = await page.evaluate(() => window.__texProgramme.length);
    const knopf = await page.evaluate(() => { const b = document.getElementById('hgx-walk'); if (!b || b.hidden) return false; b.click(); return true; });
    if (!knopf) fehler.push('--innen: kein Knopf Einsteigen (#hgx-walk), das Schiff hat keinen Innenraum oder die Seite gibt ihn nicht mit');
    else {
      const t1 = Date.now();
      while (!/Licht drinnen/.test(drinnen) && Date.now() - t1 < WARTE_MS) await page.waitForTimeout(2000);
      if (!/Licht drinnen/.test(drinnen)) fehler.push(`--innen: nach ${WARTE_MS / 60000} min nicht drin (keine Zeile "[hangar] Licht drinnen")`);
      else await page.waitForTimeout(NACHLAUF_MS);
      console.log(`  Innenraum: ${drinnen || '—'}; Programme dazu: ${(await page.evaluate(() => window.__texProgramme.length)) - vorher}`);
    }
  }
} catch (e) {
  fehler.push(`Aufruf fehlgeschlagen: ${e.message.split('\n')[0]}`);
}
const progs = await page.evaluate(() => window.__texProgramme ?? []).catch(() => []);
// --ohne-ui: nur die Halle, ohne Hilfe, Werkstatt und Leisten, die das Schiff verdecken
if (SHOT && OHNE_UI) {
  await page.evaluate(() => {
    const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    for (const e of document.body.querySelectorAll('*')) if (cv && !e.contains(cv)) e.style.visibility = 'hidden';
  }).catch((e) => fehler.push(`Bedienelemente ausblenden: ${e.message.split('\n')[0]}`));
  await page.waitForTimeout(2000);
}
// Software-WebGL braucht für ein Bild der ganzen Halle oft länger als die 30 s von Playwright
if (SHOT) await page.screenshot({ path: SHOT, timeout: 180000 }).catch((e) => fehler.push(`Aufnahme ${SHOT}: ${e.message.split('\n')[0]}`));
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
for (const b of bildFehler.slice(0, 10)) fehler.push(b);
const freiN = Number(/freigegeben: (\d+) /.exec(frei)?.[1] ?? NaN);
console.log(`  Bilder: ${frei ? frei.slice(9, 160) : 'keine Zeile zur Freigabe'} (Klinke ${KLINKE.frei}); noch einmal verlangt: ${verlangt.length}`);
for (const v of verlangt.slice(0, 10)) fehler.push(v);
if (verlangt.length > 10) fehler.push(`… und ${verlangt.length - 10} weitere freigegebene Bilder noch einmal verlangt`);
if (deko && !(freiN >= KLINKE.frei)) fehler.push(`der Viewer gibt ${Number.isFinite(freiN) ? `nur ${freiN}` : 'keine'} Bilder nach dem Hochladen frei, Klinke ${KLINKE.frei}: die ausgepackten Bilder bleiben im Arbeitsspeicher (rund 1 GB in der hohen Stufe)`);
console.log(`  ${paesse ? paesse.slice(9, 160) : 'Vollbildpässe: keine Zeile'}`);
if (/erst beim Probebild/.test(paesse)) fehler.push(`${paesse.slice(9, 160)}: der Schluessel des vorab uebersetzten Programms passt nicht zum Pass, die Seite steht beim Laden, bis sie uebersetzt sind`);
else if (deko && !/^\[hangar\] Vollbildpässe: \d+ Shader vorab übersetzt/.test(paesse)) fehler.push('der Viewer meldet keine Zeile "[hangar] Vollbildpässe: … Shader vorab übersetzt": die Nachbearbeitung (Verdeckung, Schein) steht nicht, oder ihre Shader werden nicht mehr vorab uebersetzt');
const lackMit = Number(/\((\d+) mit gemessener Farbkarte/.exec(lack)?.[1] ?? NaN), lackOhne = Number(/, (\d+) ohne Farbmittel\)/.exec(lack)?.[1] ?? NaN);
console.log(`  Farbmittel: ${lack ? `${lackMit} Materialien des Schiffs mit gemessener Farbkarte${SHIP || LAYOUT ? '' : ` (Klinke ${KLINKE.lack})`}, ${lackOhne} Farbkarten ohne Mittel` : 'keine Zeile "[hangar] Lack:"'}`);
if (deko && !lack) fehler.push('der Viewer meldet keine Zeile "[hangar] Lack:" mehr: ob die Farbkarten des Schiffs ihr Mittel tragen, ist ungeprueft');
else if (deko && !(lackOhne === 0)) fehler.push(`${Number.isFinite(lackOhne) ? lackOhne : 'unbekannt viele'} deckende Farbkarten des Schiffs ohne Farbmittel: das Schiff laedt ueber einen Loader, der nicht misst (images(false), HALL_FILES), und der dunkelste Lack wird nicht mehr angehoben`);
else if (deko && !SHIP && !LAYOUT && !(lackMit >= KLINKE.lack)) fehler.push(`nur ${lackMit} Materialien des Schiffs mit gemessener Farbkarte, Klinke ${KLINKE.lack}`);
if (bildFehler.length) console.log(`  Bilder nicht geladen: ${bildFehler.length}`);
if (deko && progs.length < KLINKE.programme) fehler.push(`nur ${progs.length} Programme gelinkt, Klinke ${KLINKE.programme}`);
if (deko && schichten < KLINKE.schichten) fehler.push(`nur ${schichten} Programme mit Schichttafel, Klinke ${KLINKE.schichten}: Wartungsplatz oder Deko nicht uebersetzt`);
if (deko && !viewer) fehler.push('der Viewer meldet keine Zeile "[hangar] Texturen je Bildshader" mehr');

if (fehler.length) {
  console.error(`\ncheck-hangar-shader: ${fehler.length} FEHLER\n`);
  for (const f of fehler) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\ncheck-hangar-shader: kein Bildshader ueber der Grenze, kein freigegebenes Bild noch einmal verlangt, Vollbildpaesse vorab uebersetzt, Farbkarten des Schiffs mit Mittel ✓\n');
