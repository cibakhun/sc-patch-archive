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
   gegen. Gewartet wird, bis die Hallendeko steht, das Schiff auf dem Feld
   steht und die Halle ruht (compileFor uebersetzt ganze Gruppen, auch was
   ausserhalb des Bildes liegt).

   WARTEN (14.11.2026): Die Zeile "[hangar] Hallendeko:" kommt, BEVOR die
   Halle uebersetzt und hochgeladen ist. Bis dahin wartete der Lauf danach
   feste 20 s. Ohne KHR_parallel_shader_compile (Software-WebGL) uebersetzt
   der Viewer ein Programm je Aufgabe, und die Zeilen zur Freigabe kommen
   erst mit dem Hochladen. Gemessen in der Cloud mit der Gladius: auf zwei
   Kernen kamen sie 15,6 s nach der Hallendeko (4 s Luft); auf einem Kern
   standen nach 20 s 41 von 97 Programmen, keins mit Schichttafel, 285 von
   886 Bildern frei, keine Zeile zur Geometrie: 4 FEHLER, und an der Halle
   fehlte nichts (sieben Minuten spaeter lud sie noch). Ein zweiter
   Cloud-Rechner riss so dreimal hintereinander. Jetzt fragt der Lauf alle
   2 s den Stand ab: gelinkte Programme, neu angelegte Texturen und Puffer
   der Grafikkarte, Zeilen des Viewers, Dateien unter /hangar/, die noch
   unterwegs sind, und ob das Schiff steht. Ruhe ist, wenn sich der Stand
   in 10 Abfragen hintereinander nicht aendert, keine Datei unterwegs ist
   und das Schiff steht. Eine Abfrage wartet auf den Hauptfaden der Seite:
   Rechnet er zwei Minuten an einem Bild, dauert sie zwei Minuten, die
   Ruhe misst sich also am Takt der Seite und nicht an der Uhr. Texturen
   und Puffer zaehlen beim Anlegen, nicht bei jedem Bild: Figuren mit
   Skelett laden je Bild Daten nach, und das ist kein Laden der Halle.
   Dasselbe gilt nach --wechsel und --innen. Kommt die Halle in 15 min
   nicht zur Ruhe, ist das ein HINWEIS und kein FEHLER (ein sehr langsamer
   Rechner ist kein Fehler des Hangars); die Klinken werten dann einen
   Zwischenstand aus, und reisst eine, steht der Hinweis darueber.
   Antwortet die Seite auf eine einzelne Abfrage 15 min lang gar nicht
   (ihr Hauptfaden haengt), ist das ein FEHLER: page.evaluate() hat keine
   eigene Frist, der Lauf hinge sonst ohne Meldung mit, und geprueft ist
   dann nichts (frage() unten). Die laengste Antwort einer gesunden Seite
   war bisher 136 s (zwei Kerne, Freiraum der Kamera messen).

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
     … --verlauf           jeden neuen Stand beim Warten mit seiner Zeit drucken
       (wo steht die Halle wann: fuer einen Rechner, der nicht zur Ruhe kommt)
     … --wechsel <schiff>  danach auf ein anderes Schiff wechseln (wie der
       Zurueck-Knopf des Browsers, ohne neu zu laden). Mit einem groesseren
       Schiff (etwa anvl-carrack) waechst die Halle, und die Einrichtung wird
       neu gerechnet: der Weg, auf dem ein freigegebener Puffer oder ein
       freigegebenes Bild am ehesten noch einmal gebraucht wird. Gewartet
       wird, bis das Schiff auf dem Feld steht (die Leiste seiner Marken
       traegt data-live); die Zeile nennt dazu die Laenge des Wartungsplatzes
       danach, an der man sieht, ob die Halle gewachsen ist. FEHLER, wenn
       das Schiff nicht ankommt
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
   --ship, --layout, --wechsel und --innen fuer deren Wege mit.
   Dazu die Freigabe der Geometrie (13.11.2026): Der Viewer nimmt die
   Attribut- und Indexpuffer der einfachen Netze der Halle im Moment des
   Hochladens aus dem Arbeitsspeicher (freeGeometry, 159 MB in der hohen
   Stufe). FEHLER, wenn auf diesem Weg jemand einen freigegebenen Puffer
   noch einmal liest (Zeile "[hangar] Geometrie nach der Freigabe noch
   einmal verlangt": der Leser rechnet dann mit einem leeren Puffer) oder
   wenn der Viewer weniger MB freigibt als die Klinke (dann liegen die
   Kopien wieder im Speicher, und kein Bild sieht anders aus). Die Ecken
   der Moebel bleiben stehen: scaleFurniture() rechnet sie neu, wenn die
   Halle waechst. Diesen Weg faehrt --wechsel mit einem groesseren Schiff.
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
   Dazu die komprimierten Texturen (13.11.2026): Am PC laedt der Viewer
   jedes Bild aus seinem Zwilling unter /hangar/ktx/ (KTX2, bei der
   Grafikkarte BC7: 1 Byte je Bildpunkt statt 4) und nur ohne ihn aus dem
   WebP. Dann stimmt jedes Bild, und der Grafikspeicher ist wieder doppelt
   so gross (Gladius, hohe Stufe: 1.507 statt 516 MB Texturen). FEHLER,
   wenn ein Zwilling nicht laedt (Zeile "[hangar] Zwilling … nicht
   geladen": fehlt in dist/, falsches Rezept, Umwandler oder Richtlinie),
   wenn der Viewer den Weg ganz abstellt ("[hangar] Texturen bleiben WebP";
   die Software-Grafik dieses Laufs kann BC7), wenn die Zeile "[hangar]
   Texturen komprimiert:" fehlt oder weniger Bilder nennt als die Klinke
   (ohne --ship und --layout).
     CHROME_PATH=/pfad/zu/chromium npm run check:hangar-shader -- --base …
   ============================================================ */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
// Ein Schalter mit Wert, der ohne Wert kommt (am Ende, leer, oder vor dem naechsten
// Schalter), ist ein Fehler und kein fehlender Schalter: sonst endet der Lauf gruen,
// ohne getan zu haben, was verlangt war (--wechsel am Ende wechselte kein Schiff).
const flag = (n, d) => {
  if (!argv.includes(n)) return d;
  const v = argv[argv.indexOf(n) + 1];
  if (v === undefined || v === '' || v.startsWith('--')) { console.error(`\n${n}: der Wert fehlt\n`); process.exit(2); }
  return v;
};
const BASE = flag('--base', process.env.SMOKE_BASE || 'http://localhost:4321').replace(/\/$/, '');
const SHIP = flag('--ship', null);
const SHOT = flag('--shot', null);
const LAYOUT = flag('--layout', null);
const OHNE_UI = argv.includes('--ohne-ui'), INNEN = argv.includes('--innen'), VERLAUF = argv.includes('--verlauf');
const WECHSEL = flag('--wechsel', null);
if (SHIP && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(SHIP)) { console.error(`\n--ship ${SHIP}: keine Schiffskennung\n`); process.exit(2); }
if (WECHSEL && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(WECHSEL)) { console.error(`\n--wechsel ${WECHSEL}: keine Schiffskennung\n`); process.exit(2); }
if (LAYOUT && !/^[A-Za-z0-9_-]{1,4000}$/.test(LAYOUT)) { console.error(`\n--layout ${LAYOUT}: kein Link-Code\n`); process.exit(2); }
const GRENZE = 16;
// Gemessen 21.10.2026 auf hoch mit der Gladius: 73 Programme, 2 mit
// Schichttafel (Halle und Grube). Klinken nur nach oben.
// frei: Bilder, die der Viewer nach dem Hochladen freigibt. Gemessen
// 13.11.2026 auf hoch mit der Gladius: 897 von 901 (1.054 MB).
// lack: Materialien der Gladius mit gemessener Farbkarte (Zeile "[hangar]
// Lack:"). Gemessen 13.11.2026: 118, keine Farbkarte ohne Mittel.
// geoMB: MB Geometrie der Halle, die der Viewer nach dem Hochladen freigibt
// (Zeile "[hangar] Geometrie nach dem Hochladen freigegeben:"). Gemessen
// 13.11.2026 auf hoch mit der Gladius: 159 MB in 1.603 Puffern.
// ktx: Bilder, die der Viewer aus ihrem komprimierten Zwilling laedt (Zeile
// "[hangar] Texturen komprimiert:"). Gemessen 13.11.2026 auf hoch mit der
// Gladius: 958 am Ende des Prueflaufs (969, wenn die letzten Tauschteile
// geladen sind; seit der Lauf auf die Ruhe wartet, 14.11.2026, endet er
// dort), keins aus dem WebP.
const KLINKE = { programme: 60, schichten: 2, frei: 600, lack: 100, geoMB: 120, ktx: 850 };
// Warten: WARTE_MS ist die Obergrenze je Abschnitt (Hallendeko, Ruhe, Schiff nach
// dem Wechsel, Innenraum). Ruhe heisst RUHE_TAKTE Abfragen im Abstand von TAKT_MS
// ohne neuen Stand (ruhe() unten, Anlass im Kopf unter WARTEN). Dieselbe Frist gilt
// fuer eine einzelne Antwort der Seite (frage() unten).
const WARTE_MS = 15 * 60 * 1000, TAKT_MS = 2000, RUHE_TAKTE = 10;

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
  // Neu angelegte Texturen und Puffer: solange welche dazukommen, laedt die Halle noch
  window.__texNeu = { tex: 0, buf: 0 };
  const ct = C.createTexture, cb = C.createBuffer;
  C.createTexture = function () { window.__texNeu.tex++; return ct.call(this); };
  C.createBuffer = function () { window.__texNeu.buf++; return cb.call(this); };
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
let deko = '', viewer = '', drinnen = '', frei = '', paesse = '', lack = '', geo = '', platz = '', ktx = '', ktxAus = '';
const verlangt = [], geoVerlangt = [], ktxFehlt = [];
const shaderFehler = [];
let zeilen = 0;
// Dateien des Hangars (Modelle, Bilder, Zwillinge), die angefordert und noch nicht da sind
const unterwegs = new Set();
page.on('request', (r) => { try { if (new URL(r.url()).pathname.startsWith('/hangar/')) unterwegs.add(r); } catch { /* keine Adresse */ } });
page.on('requestfinished', (r) => unterwegs.delete(r));
page.on('requestfailed', (r) => unterwegs.delete(r));
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('[hangar]')) zeilen++;
  if (t.startsWith('[hangar] Hallendeko:')) deko = t;
  if (t.startsWith('[hangar] Texturen je Bildshader:')) viewer = t;
  if (t.startsWith('[hangar] Licht drinnen:') || t.startsWith('[hangar] Innenraum geladen:')) drinnen = drinnen ? `${drinnen} · ${t.slice(9)}` : t.slice(9);
  if (/THREE\.WebGLProgram: Shader Error/.test(t)) shaderFehler.push(t.split('\n')[0].slice(0, 200));
  if (t.startsWith('[hangar] Bilder nach dem Hochladen freigegeben:')) frei = t;
  if (t.startsWith('[hangar] Vollbildpässe:')) paesse = t;
  if (t.startsWith('[hangar] Lack:') && !lack) lack = t;
  if (t.startsWith('[hangar] Wartungsplatz bei')) platz = t;
  if (t.startsWith('[hangar] Bild nach der Freigabe noch einmal verlangt')) verlangt.push(t.slice(9, 200));
  if (t.startsWith('[hangar] Geometrie nach dem Hochladen freigegeben:')) geo = t;
  if (t.startsWith('[hangar] Geometrie nach der Freigabe noch einmal verlangt')) geoVerlangt.push(t.slice(9, 200));
  if (/^\[hangar\] Bild .* nicht geladen|Couldn't load texture/.test(t)) bildFehler.push(t.slice(0, 200));
  if (t.startsWith('[hangar] Texturen komprimiert:')) ktx = t;
  if (t.startsWith('[hangar] Texturen bleiben WebP:')) ktxAus = t;
  if (t.startsWith('[hangar] Zwilling ')) ktxFehlt.push(t.slice(9, 200));
});
const bildFehler = [];
const fehler = [];
// Jede Abfrage der Seite wartet auf deren Hauptfaden, und page.evaluate() hat keine
// eigene Frist: Haengt die Seite, hinge der Lauf ohne Meldung mit, und die Obergrenzen
// der Schleifen griffen nie, weil sie zwischen zwei Abfragen stehen. frage() gibt nach
// WARTE_MS auf. Danach fragt niemand die Seite mehr (jede weitere Abfrage scheitert
// sofort), und der Lauf endet mit einem FEHLER: geprueft ist dann nichts.
class Haengt extends Error {}
let haengt = '';
function frage(wo, fn, arg) {
  if (haengt) return Promise.reject(new Haengt(haengt));
  const p = page.evaluate(fn, arg);
  p.catch(() => {});
  let uhr;
  return Promise.race([
    p,
    new Promise((_, nein) => {
      uhr = setTimeout(() => {
        haengt = `die Seite antwortet seit ${WARTE_MS / 60000} min nicht (${wo}): ihr Hauptfaden haengt, Programme und Klinken sind in diesem Lauf nicht geprueft`;
        nein(new Haengt(haengt));
      }, WARTE_MS);
    }),
  ]).finally(() => clearTimeout(uhr));
}
// Wartet, bis die Halle ruht (Anlass und Messung im Kopf unter WARTEN). mitSchiff:
// Ruhe erst, wenn das Schiff auf dem Feld steht (die Leiste seiner Marken traegt
// data-live, syncMarks in hangar-overview.js nach viewer.show()).
const unruhig = [];
let t0 = Date.now();
async function ruhe(was, mitSchiff) {
  const t = Date.now();
  let stand = '', still = 0, neu = 0, traege = 0, s = { prog: 0, tex: 0, buf: 0, schiff: '' };
  while (still < RUHE_TAKTE) {
    if (Date.now() - t > WARTE_MS) {
      unruhig.push(`${was}: nach ${WARTE_MS / 60000} min ${mitSchiff && !s.schiff ? 'steht das Schiff nicht auf dem Feld (die Leiste der Marken traegt kein data-live)' : unterwegs.size ? `${unterwegs.size === 1 ? 'ist noch 1 Datei' : `sind noch ${unterwegs.size} Dateien`} unter /hangar/ unterwegs` : `kommen noch Programme, Texturen, Puffer oder Zeilen dazu (Stand ${neu} Mal neu, zuletzt ${stand})`}`);
      break;
    }
    await page.waitForTimeout(TAKT_MS);
    const a = Date.now();
    s = await frage(`Warten auf die Ruhe, ${was}`, () => { const r = document.querySelector('[data-bay="marks"]'); return { prog: window.__texProgramme?.length ?? 0, tex: window.__texNeu?.tex ?? 0, buf: window.__texNeu?.buf ?? 0, schiff: r?.hasAttribute('data-live') ? r.dataset.id : '' }; });
    traege = Math.max(traege, Date.now() - a);
    const jetzt = `Programme ${s.prog}, Texturen ${s.tex}, Puffer ${s.buf}, Zeilen ${zeilen}, unterwegs ${unterwegs.size}, Schiff ${s.schiff || '—'}`;
    if (jetzt !== stand) {
      stand = jetzt; still = 0; neu++;
      if (VERLAUF) console.log(`    ${String(Math.round((Date.now() - t0) / 1000)).padStart(5)} s  ${stand}`);
    } else if (!unterwegs.size && (!mitSchiff || s.schiff)) still++;
  }
  console.log(`  Gewartet (${was}): ${still < RUHE_TAKTE ? 'KEINE Ruhe' : 'Ruhe'} nach ${Math.round((Date.now() - t) / 1000)} s; Stand ${neu} Mal neu, dann ${still} Abfragen ohne Neues (verlangt ${RUHE_TAKTE}); ${stand}; laengste Antwort der Seite ${Math.round(traege / 1000)} s`);
}
try {
  await page.goto(`${BASE}/hangar.html?grafik=hoch${SHIP ? `&ship=${SHIP}` : ''}${LAYOUT ? `&layout=${LAYOUT}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  t0 = Date.now();
  while (!deko && Date.now() - t0 < WARTE_MS) {
    if (await frage('Warten auf die Hallendeko', () => document.getElementById('hg-fallback')?.hidden === false)) { fehler.push('die Seite zeigt ihren Rueckfall statt der Halle'); break; }
    await page.waitForTimeout(2000);
  }
  if (!deko && !fehler.length) fehler.push(`nach ${WARTE_MS / 60000} min keine Zeile "[hangar] Hallendeko:"`);
  if (deko) {
    console.log(`  Hallendeko nach ${Math.round((Date.now() - t0) / 1000)} s`);
    await ruhe('Laden', true);
  }
  if (deko && WECHSEL) {
    // Steht ein Schiff, traegt die Leiste seiner Marken data-live und seine Kennung
    // (syncMarks in hangar-overview.js, nach viewer.show()). Die Zeile "[hangar] Lack:"
    // taugt dafuer nicht: sie kommt, sobald das Modell geladen ist, in Software-WebGL
    // gut eine Minute, bevor die Halle gewachsen ist und das Schiff auf dem Feld steht.
    const steht = () => frage('--wechsel, steht das Schiff', () => { const r = document.querySelector('[data-bay="marks"]'); return r?.hasAttribute('data-live') ? r.dataset.id : ''; }).catch((e) => { if (e instanceof Haengt) throw e; return ''; });
    const t1 = Date.now(), vorher = await frage('--wechsel', () => window.__texProgramme.length);
    let erst = '', dann = '', kam = 0;
    while (!(erst = await steht()) && Date.now() - t1 < WARTE_MS) await page.waitForTimeout(2000);
    if (!erst) fehler.push(`--wechsel: nach ${WARTE_MS / 60000} min steht das erste Schiff nicht (die Leiste der Marken traegt kein data-live)`);
    else if (erst === WECHSEL) fehler.push(`--wechsel ${WECHSEL}: dieses Schiff steht schon, ein Wechsel findet nicht statt`);
    else {
      await frage('--wechsel, Schiff waehlen', (id) => { const u = new URL(location.href); u.searchParams.set('ship', id); history.pushState(null, '', u); dispatchEvent(new PopStateEvent('popstate')); }, WECHSEL);
      while ((dann = await steht()) !== WECHSEL && Date.now() - t1 < WARTE_MS) await page.waitForTimeout(2000);
      if (dann !== WECHSEL) fehler.push(`--wechsel: nach ${WARTE_MS / 60000} min steht ${WECHSEL} nicht auf dem Feld (kein Schiff mit dieser Kennung, oder das Modell laedt nicht)`);
      else { kam = Date.now() - t1; await ruhe(`Wechsel auf ${WECHSEL}`, true); }
    }
    console.log(`  Wechsel von ${erst || '—'} auf ${WECHSEL}: ${dann === WECHSEL ? `steht nach ${Math.round(kam / 1000)} s` : 'nicht angekommen'}; ${platz ? platz.slice(9).split(':')[0] : 'keine Zeile zum Wartungsplatz'}; Programme dazu: ${(await frage('--wechsel', () => window.__texProgramme.length)) - vorher}`);
  }
  if (deko && INNEN) {
    const vorher = await frage('--innen', () => window.__texProgramme.length);
    const knopf = await frage('--innen, Einsteigen', () => { const b = document.getElementById('hgx-walk'); if (!b || b.hidden) return false; b.click(); return true; });
    if (!knopf) fehler.push('--innen: kein Knopf Einsteigen (#hgx-walk), das Schiff hat keinen Innenraum oder die Seite gibt ihn nicht mit');
    else {
      const t1 = Date.now();
      while (!/Licht drinnen/.test(drinnen) && Date.now() - t1 < WARTE_MS) await page.waitForTimeout(2000);
      if (!/Licht drinnen/.test(drinnen)) fehler.push(`--innen: nach ${WARTE_MS / 60000} min nicht drin (keine Zeile "[hangar] Licht drinnen")`);
      else await ruhe('Innenraum', false);
      console.log(`  Innenraum: ${drinnen || '—'}; Programme dazu: ${(await frage('--innen', () => window.__texProgramme.length)) - vorher}`);
    }
  }
} catch (e) {
  fehler.push(e instanceof Haengt ? e.message : `Aufruf fehlgeschlagen: ${e.message.split('\n')[0]}`);
}
const progs = await frage('Programme lesen', () => window.__texProgramme ?? []).catch((e) => { if (e instanceof Haengt && !fehler.includes(e.message)) fehler.push(e.message); return []; });
// --ohne-ui: nur die Halle, ohne Hilfe, Werkstatt und Leisten, die das Schiff verdecken
if (SHOT && OHNE_UI && !haengt) {
  await frage('--ohne-ui', () => {
    const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    for (const e of document.body.querySelectorAll('*')) if (cv && !e.contains(cv)) e.style.visibility = 'hidden';
  }).catch((e) => fehler.push(`Bedienelemente ausblenden: ${e.message.split('\n')[0]}`));
  await page.waitForTimeout(2000);
}
// Software-WebGL braucht für ein Bild der ganzen Halle oft länger als die 30 s von Playwright
if (SHOT && !haengt) await page.screenshot({ path: SHOT, timeout: 180000 }).catch((e) => fehler.push(`Aufnahme ${SHOT}: ${e.message.split('\n')[0]}`));
await browser.close();
// Die Seite haengt: Was die Konsole bis dahin meldete, ist ein Zwischenstand ohne
// Programme; die Klinken darunter rissen alle und sagten nichts.
if (haengt) {
  console.error(`\ncheck-hangar-shader: ${fehler.length} FEHLER\n`);
  for (const f of fehler) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}

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
const geoN = Number(/freigegeben: (\d+) Puffer/.exec(geo)?.[1] ?? NaN), geoMB = Number(/ mit (\d+) MB/.exec(geo)?.[1] ?? NaN);
console.log(`  Geometrie: ${geo ? geo.slice(9, 160) : 'keine Zeile zur Freigabe'} (Klinke ${KLINKE.geoMB} MB); noch einmal verlangt: ${geoVerlangt.length}`);
for (const v of geoVerlangt.slice(0, 10)) fehler.push(v);
if (geoVerlangt.length > 10) fehler.push(`… und ${geoVerlangt.length - 10} weitere freigegebene Puffer noch einmal verlangt`);
if (deko && !(geoMB >= KLINKE.geoMB)) fehler.push(`der Viewer gibt ${Number.isFinite(geoMB) ? `nur ${geoMB} MB Geometrie in ${geoN} Puffern` : 'keine Geometrie'} nach dem Hochladen frei, Klinke ${KLINKE.geoMB} MB: die Kopien der Netze der Halle bleiben im Arbeitsspeicher (rund 160 MB in der hohen Stufe)`);
console.log(`  ${paesse ? paesse.slice(9, 160) : 'Vollbildpässe: keine Zeile'}`);
if (/erst beim Probebild/.test(paesse)) fehler.push(`${paesse.slice(9, 160)}: der Schluessel des vorab uebersetzten Programms passt nicht zum Pass, die Seite steht beim Laden, bis sie uebersetzt sind`);
else if (deko && !/^\[hangar\] Vollbildpässe: \d+ Shader vorab übersetzt/.test(paesse)) fehler.push('der Viewer meldet keine Zeile "[hangar] Vollbildpässe: … Shader vorab übersetzt": die Nachbearbeitung (Verdeckung, Schein) steht nicht, oder ihre Shader werden nicht mehr vorab uebersetzt');
const lackMit = Number(/\((\d+) mit gemessener Farbkarte/.exec(lack)?.[1] ?? NaN), lackOhne = Number(/, (\d+) ohne Farbmittel\)/.exec(lack)?.[1] ?? NaN);
console.log(`  Farbmittel: ${lack ? `${lackMit} Materialien des Schiffs mit gemessener Farbkarte${SHIP || LAYOUT ? '' : ` (Klinke ${KLINKE.lack})`}, ${lackOhne} Farbkarten ohne Mittel` : 'keine Zeile "[hangar] Lack:"'}`);
if (deko && !lack) fehler.push('der Viewer meldet keine Zeile "[hangar] Lack:" mehr: ob die Farbkarten des Schiffs ihr Mittel tragen, ist ungeprueft');
else if (deko && !(lackOhne === 0)) fehler.push(`${Number.isFinite(lackOhne) ? lackOhne : 'unbekannt viele'} deckende Farbkarten des Schiffs ohne Farbmittel: das Schiff laedt ueber einen Loader, der nicht misst (images(false), HALL_FILES), und der dunkelste Lack wird nicht mehr angehoben`);
else if (deko && !SHIP && !LAYOUT && !(lackMit >= KLINKE.lack)) fehler.push(`nur ${lackMit} Materialien des Schiffs mit gemessener Farbkarte, Klinke ${KLINKE.lack}`);
const ktxN = Number(/komprimiert: (\d+) /.exec(ktx)?.[1] ?? NaN), ktxOhne = Number(/aus dem WebP: (\d+)$/.exec(ktx)?.[1] ?? NaN);
console.log(`  Komprimiert: ${ktx ? ktx.slice(9, 160) : ktxAus ? ktxAus.slice(9, 160) : 'keine Zeile zu den komprimierten Texturen'}${SHIP || LAYOUT ? '' : ` (Klinke ${KLINKE.ktx})`}`);
for (const z of ktxFehlt.slice(0, 5)) fehler.push(z);
if (ktxAus) fehler.push(`${ktxAus.slice(9, 200)}: jede Textur liegt unkomprimiert bei der Grafikkarte`);
else if (deko && !ktx) fehler.push('der Viewer meldet keine Zeile "[hangar] Texturen komprimiert:": er laedt kein Bild aus seinem komprimierten Zwilling (ktxTwin in assets/hangar-viewer.js), jede Textur liegt unkomprimiert bei der Grafikkarte');
else if (deko && !(ktxOhne === 0)) fehler.push(`${Number.isFinite(ktxOhne) ? ktxOhne : 'unbekannt viele'} Bilder ohne ladbaren Zwilling kamen aus dem WebP und liegen unkomprimiert bei der Grafikkarte (verify:hangar-ktx prueft die Dateien in dist/)`);
else if (deko && !SHIP && !LAYOUT && !(ktxN >= KLINKE.ktx)) fehler.push(`nur ${ktxN} Bilder aus komprimierten Zwillingen, Klinke ${KLINKE.ktx}`);
if (bildFehler.length) console.log(`  Bilder nicht geladen: ${bildFehler.length}`);
if (deko && progs.length < KLINKE.programme) fehler.push(`nur ${progs.length} Programme gelinkt, Klinke ${KLINKE.programme}`);
if (deko && schichten < KLINKE.schichten) fehler.push(`nur ${schichten} Programme mit Schichttafel, Klinke ${KLINKE.schichten}: Wartungsplatz oder Deko nicht uebersetzt`);
if (deko && !viewer) fehler.push('der Viewer meldet keine Zeile "[hangar] Texturen je Bildshader" mehr');

for (const u of unruhig) console.log(`  HINWEIS: keine Ruhe (${u}): der Lauf wertet einen Zwischenstand aus`);
if (fehler.length) {
  console.error(`\ncheck-hangar-shader: ${fehler.length} FEHLER\n`);
  if (unruhig.length) console.error('  Die Halle kam in diesem Lauf nicht zur Ruhe (HINWEIS oben). Dann koennen die Klinken zu Programmen, Bildern, Geometrie und Texturen reissen, ohne dass am Hangar etwas fehlt: erst auf einem schnelleren Rechner wiederholen.\n');
  for (const f of fehler) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\ncheck-hangar-shader: kein Bildshader ueber der Grenze, kein freigegebenes Bild und kein freigegebener Puffer noch einmal verlangt, Vollbildpaesse vorab uebersetzt, Farbkarten des Schiffs mit Mittel, jedes Bild aus seinem komprimierten Zwilling ✓\n');
