/* ============================================================
   verify-hangar-ktx.mjs — Tor fuer die komprimierten Zwillinge der
   Hangar-Bilder (Schiene A, nur mit Hangar).

   WARUM ES DEN GIBT: Seit dem 13.11.2026 laedt der Hangar am PC jede
   Textur aus einer KTX2-Datei unter /hangar/ktx/ statt aus ihrem WebP
   (Krisz: „es braucht viel zu viele Ressourcen um das Hangar laufen zu
   lassen"; Grafikspeicher 2,0 GB -> 1,0 GB, scripts/lib/hangar-ktx.mjs).
   Die Zwillinge haengen an nichts als an ihrem Namen: der Viewer rechnet
   ihn aus dem Inhalt des WebP und fragt die Datei ab. Fehlt sie, laedt er
   still das WebP — das Bild stimmt, und der Gewinn ist weg, ohne dass es
   jemand sieht. Baut jemand Schiffe oder Halle neu und vergisst
   build-hangar-ktx, ist genau das der Stand. Und eine Datei mit falschem
   Inhalt (anderes Bild, andere Art, kein Farbmittel) zeigte ein Schiff
   fleckig oder schwarz.

   Dieses Tor liest das ARTEFAKT: jedes GLB unter dist/hangar/, die Bilder
   der Ablage dist/hangar/tex/, die Zwillinge dist/hangar/ktx/ und den
   ausgelieferten Viewer dist/assets/hangar-viewer.js (in Node geladen).

   ZUSICHERUNGEN
     [1] Bestand: Jedes Bild, das ein GLB ueber eine Textur benutzt, ist
         lesbar (Ablage oder eingebettet, WebP); mindestens MIN_GLB Dateien
         und MIN_BILDER verschiedene Bilder.
     [2] Vollstaendig: Zu jedem Bild liegt genau ein Zwilling, und im
         Ordner liegt nichts anderes (kein Zwilling ohne Bild).
     [3] Inhalt: Jeder Zwilling ist eine lesbare KTX2-Datei im
         Basis-Format (vkFormat 0; eine unkomprimierte KTX2 liesse den
         Loader einen zweiten Dekoder holen, den die Richtlinie der Seite
         nicht deckt, audit:csp), mit Mip-Stufen bis 1 x 1, so gross wie
         sein WebP, mit der Art, die der Bestand verlangt (Normal-Karten
         UASTC mit Zstandard, alles andere ETC1S), dem Rezept BAU und der
         Byte-Zahl seines WebP.
     [4] Farbmittel: Jede Grundfarben-Karte traegt HGmittel, drei Zahlen
         zwischen 0 und 1; nicht jede dieselben (mindestens MIN_MITTEL
         verschiedene Werte).
     [5] Viewer: Der ausgelieferte Viewer haengt dasselbe Rezept an die
         URL (KTX_BAU), liest die Schluessel einer Datei dieses Baus so wie
         das Tor (ktxKv) und holt Loader und Umwandler von dort, wo sie in
         dist/ liegen.
     [6] Nahtstellen im Viewer: Stellen, an denen kein Bild anders aussieht,
         wenn sie reissen, nur der Speicher wieder waechst oder ein Schiff
         fleckig wird: der Zwilling wird zuerst gefragt und ohne ihn das
         WebP geladen; Ladebalken, Farbmittel und die Merkmale des Bildes
         kommen an den Zwilling; der Weg ist am Telefon und mit
         ?bilder=webp aus und verlangt BC7 oder ASTC; die Schluessel werden
         gelesen, bevor der Puffer zum Umwandler geht; die Mip-Stufen gehen
         nach dem Hochladen aus dem Arbeitsspeicher (mit Falle); ein
         Sampler ohne Mips laedt nur die groesste Stufe; die niedrige Stufe
         laesst die grossen Stufen weg; antwortet der Umwandler nicht,
         stellt ein Waechter den Weg ab, statt den Hangar warten zu
         lassen. Ob die Zwillinge im Browser wirklich laden, prueft
         check:hangar-shader.
     [7] Umwandler ohne Code aus Zeichenketten: Die Seite erlaubt kein
         'unsafe-eval', und der Umwandler, wie three ihn ausliefert, baut
         seine Aufrufer mit new Function — unter der Richtlinie startet
         er nicht (13.11.2026: der Hangar blieb gegen den echten nginx
         beim Laden stehen, in der Vorschau ohne Richtlinie lief alles).
         Der ausgelieferte Umwandler wandelt deshalb hier, in einem
         Kontext ohne Code aus Zeichenketten, mindestens MIN_PROBEN
         Zwillinge jeder Art nach BC7 und ASTC um, und jedes Ergebnis ist
         bitgleich mit dem des unveraenderten Umwandlers aus
         node_modules/three (scripts/lib/hangar-basis.mjs).

   VORGEFUEHRT ROT (13.11.2026), jede Meldung im Commit:
     a  einen Zwilling loeschen                         -> [2]
     b  eine fremde Datei in den Ordner legen           -> [2]
     c  einen Zwilling durch den eines anderen Bildes
        ersetzen (anderes Mass, andere Bytes)           -> [3]
     d  HGart einer Normal-Karte auf c setzen            -> [3]
     e  HGbau auf ein anderes Rezept setzen             -> [3]
     f  HGmittel einer Grundfarben-Karte entfernen      -> [4]
     g  eine Datei nach den ersten 60 Byte abschneiden  -> [3]
     g2 eine Datei mitten in den Mip-Stufen abschneiden -> [3]
     h  KTX_BAU im Viewer aendern                       -> [5]
     i  basis_transcoder.wasm aus dist/ nehmen          -> [5], [7]
     j  bis t (mit n2, zwoelf Faelle): je eine der elf
        Nahtstellen im Viewer oder Controller in dist/
        aendern                                         -> [6]
     u  den Umwandler in dist/ durch den unveraenderten
        aus node_modules/three ersetzen                 -> [7]
     v  im Umwandler in dist/ eine der beiden Korrekturen
        verfaelschen (Empfaenger eines Aufrufs gestrichen;
        ebenso: `this` nicht uebergeben, Rueckgabe
        gestrichen)                                     -> [7]
   NICHT ERFASST: der Abbau von Argumenten nach einem Aufruf
   (runDestructors, destructorFunction in der ersten Korrektur). Kein
   Aufruf des Umwandlers hat ein Argument, das abgebaut werden muss; ohne
   diese Zeilen bleibt jedes Ergebnis gleich (13.11.2026 probiert). Sie
   stehen dort, weil emscripten sie an der Stelle fuehrt.
   ============================================================ */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BAU, KTX_NAME, KTX_ORDNER, bestand, dateiAnfang, ktxKopf } from './lib/hangar-ktx.mjs';
import { BASIS_FORMATE, basisStart } from './lib/hangar-basis.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist'), HANGAR = join(DIST, 'hangar'), ZIEL = join(HANGAR, KTX_ORDNER);

// Klinken (13.11.2026: 1.195 GLB, 9.621 Bilder, davon 1.809 Normal-Karten
// und 5.296 Grundfarben-Karten)
const MIN_GLB = 1150, MIN_BILDER = 9300, MIN_NORMAL = 1700, MIN_GRUND = 5000, MIN_MITTEL = 2000;
// Deckel (Repo und Image): die Zwillinge wogen am 13.11.2026 zusammen
// 459 MB (ihre WebP 310 MB), der größte 1,0 MB. Krisz hat der Umstellung mit
// der Schätzung „rund 460 MB" aus der Probe zugestimmt; was darüber wächst,
// soll jemand entscheiden und nicht still passieren.
const MAX_MB = 560, MAX_DATEI_MB = 8;
// [7]: so viele Zwillinge je Art wandelt das Tor mit dem ausgelieferten Umwandler um
const MIN_PROBEN = 40;
const ANFANG = 4096;

const fehler = [];
const fail = (m) => fehler.push(m);
const say = (m) => console.log(m);
const mb = (n) => (n / 1048576).toFixed(1);

if (!existsSync(HANGAR)) {
  console.error('verify-hangar-ktx: dist/hangar/ fehlt — erst als Vorschau bauen (STAGING=1 npm run build).');
  process.exit(1);
}
say('Geprüftes Artefakt: dist/hangar/ (GLB, Ablage tex/, Zwillinge ktx/) und dist/assets/hangar-viewer.js');

// Breite und Höhe eines WebP aus seinem Kopf (VP8, VP8L, VP8X)
function webpMass(b) {
  if (b.length < 30 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null;
  const art = b.toString('latin1', 12, 16);
  if (art === 'VP8 ') return b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a ? [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff] : null;
  if (art === 'VP8L') { if (b[20] !== 0x2f) return null; const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1]; }
  if (art === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  return null;
}

/* ---------- [1] Bestand ---------- */
say('[1] Bestand der Bilder');
const inv = bestand(HANGAR);
for (const f of inv.fehler.slice(0, 12)) fail(`[1] ${f}`);
if (inv.fehler.length > 12) fail(`[1] … und ${inv.fehler.length - 12} weitere Bilder nicht lesbar`);
const zahl = { n: 0, c: 0, d: 0 };
for (const b of inv.bilder.values()) zahl[b.art]++;
const grund = [...inv.bilder.values()].filter((b) => b.grund).length;
say(`    ${inv.glbs} GLB (Klinke ${MIN_GLB}), ${inv.verweise} Verweise, ${inv.bilder.size} verschiedene Bilder (Klinke ${MIN_BILDER}): ${zahl.n} Normal-Karten (Klinke ${MIN_NORMAL}), ${zahl.c} Farbe, ${zahl.d} Daten; ${grund} Grundfarben-Karten (Klinke ${MIN_GRUND})`);
if (inv.glbs < MIN_GLB) fail(`[1] nur ${inv.glbs} GLB unter dist/hangar/, Klinke ${MIN_GLB} — Bau unvollständig? Ursache klären, nicht die Klinke senken`);
if (inv.bilder.size < MIN_BILDER) fail(`[1] nur ${inv.bilder.size} verschiedene Bilder, Klinke ${MIN_BILDER}`);
if (zahl.n < MIN_NORMAL) fail(`[1] nur ${zahl.n} Normal-Karten erkannt, Klinke ${MIN_NORMAL} — liest der Bestand die Materialien noch?`);
if (grund < MIN_GRUND) fail(`[1] nur ${grund} Grundfarben-Karten erkannt, Klinke ${MIN_GRUND}`);

/* ---------- [2] Vollstaendig ---------- */
say('[2] Jedes Bild hat seinen Zwilling, der Ordner trägt nichts anderes');
const da = existsSync(ZIEL) ? readdirSync(ZIEL) : [];
const fremd = da.filter((n) => !KTX_NAME.test(n)), waisen = da.filter((n) => KTX_NAME.test(n) && !inv.bilder.has(n.slice(0, 16)));
const fehlt = [...inv.bilder].filter(([id]) => !existsSync(join(ZIEL, `${id}.ktx2`)));
say(`    ${inv.bilder.size - fehlt.length} von ${inv.bilder.size} Zwillingen da, ${waisen.length} ohne Bild, ${fremd.length} fremde Dateien`);
const BAUEN = 'node scripts/build-hangar-ktx.mjs --basisu <pfad> baut sie (Kopf des Skripts), dann neu bauen';
for (const [id, b] of fehlt.slice(0, 8)) fail(`[2] Zwilling ktx/${id}.ktx2 fehlt (Bild in ${[...b.in][0]}${b.in.size > 1 ? ` und ${b.in.size - 1} weiteren` : ''}): der Hangar lüde dieses Bild still aus dem WebP, unkomprimiert`);
if (fehlt.length) fail(`[2] ${fehlt.length} Zwilling${fehlt.length === 1 ? '' : 'e'} fehl${fehlt.length === 1 ? 't' : 'en'} — ${BAUEN}`);
for (const n of waisen.slice(0, 5)) fail(`[2] ktx/${n} gehört zu keinem Bild mehr`);
if (waisen.length) fail(`[2] ${waisen.length} Zwilling${waisen.length === 1 ? '' : 'e'} ohne Bild — ${BAUEN} (der Lauf räumt sie weg)`);
for (const n of fremd.slice(0, 5)) fail(`[2] ktx/${n} ist kein Zwilling (Name <16 Hex>.ktx2)`);

/* ---------- [3] Inhalt, [4] Farbmittel ---------- */
say('[3] Inhalt jedes Zwillings, [4] Farbmittel der Grundfarben-Karten');
let gut = 0, mitMittel = 0, bytes = 0, webpBytes = 0, schlecht = 0;
const groesse = { n: 0, c: 0, d: 0 }, mittelWerte = new Set(), gross = [];
let erster = null;   // Bytes eines guten Zwillings mit Farbmittel, für [5]
const melde = (id, text) => { if (++schlecht <= 12) fail(text); };
for (const [id, b] of inv.bilder) {
  const f = join(ZIEL, `${id}.ktx2`);
  if (!existsSync(f)) continue;
  // Kopf, Index und Schlüssel stehen am Anfang; die Stufen prüft ktxKopf
  // gegen die Länge der Datei. Ganz gelesen wären es 770 MB je Lauf.
  const laenge = statSync(f).size, buf = dateiAnfang(f, ANFANG), k = ktxKopf(buf, laenge), wo = `ktx/${id}.ktx2`;
  if (!k) { melde(id, `[3] ${wo} ist keine lesbare KTX2-Datei (${laenge} Bytes; Kopf, Schlüssel oder eine Mip-Stufe liegen nicht in der Datei)`); continue; }
  const mass = webpMass(b.lies(32));
  const soll = b.art === 'n' ? 2 : 1;   // Superkompression: 2 Zstandard (UASTC), 1 BasisLZ (ETC1S)
  const stufen = mass ? Math.floor(Math.log2(Math.max(mass[0], mass[1]))) + 1 : 0;
  const mangel =
    k.vkFormat !== 0 ? `vkFormat ${k.vkFormat} statt 0 (Basis)`
    : !mass ? 'sein WebP hat keinen lesbaren Kopf'
    : k.breite !== mass[0] || k.hoehe !== mass[1] ? `${k.breite} x ${k.hoehe}, sein WebP ist ${mass[0]} x ${mass[1]}`
    : k.stufen !== stufen ? `${k.stufen} Mip-Stufen, erwartet ${stufen}`
    : k.ebenen.some((e) => e.len < 1) ? 'eine Mip-Stufe ist leer'
    : k.kv.HGbau !== BAU ? `Rezept ${k.kv.HGbau ?? 'fehlt'} statt ${BAU}`
    : k.kv.HGart !== b.art ? `Art ${k.kv.HGart ?? 'fehlt'}, der Bestand verlangt ${b.art}`
    : k.super !== soll ? `Superkompression ${k.super}, für Art ${b.art} erwartet ${soll}`
    : Number(k.kv.HGwebp) !== b.webp ? `HGwebp ${k.kv.HGwebp}, sein WebP hat ${b.webp} Bytes`
    : null;
  if (mangel) { melde(id, `[3] ${wo}: ${mangel} — ${BAUEN}`); continue; }
  if (laenge > MAX_DATEI_MB * 1048576) gross.push(`${wo} ${mb(laenge)} MB`);
  gut++; bytes += laenge; webpBytes += b.webp; groesse[b.art] += laenge;
  if (b.grund) {
    const m = (k.kv.HGmittel ?? '').split(',').map(Number);
    if (m.length !== 3 || !m.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) { melde(id, `[4] ${wo}: Grundfarben-Karte ohne Farbmittel (HGmittel ${k.kv.HGmittel ?? 'fehlt'}): der dunkelste Lack würde nicht mehr angehoben, das Schiff stünde fleckig schwarz da — ${BAUEN}`); continue; }
    mitMittel++; mittelWerte.add(k.kv.HGmittel);
    erster ??= { id, buf: readFileSync(f), kv: k.kv };
  }
}
if (schlecht > 12) fail(`[3] … und ${schlecht - 12} weitere Zwillinge mit Mangel`);
say(`    ${gut} von ${inv.bilder.size} Zwillingen in Ordnung: ${mb(bytes)} MB (Deckel ${MAX_MB} MB; ihre WebP ${mb(webpBytes)} MB); Normal ${mb(groesse.n)} MB, Farbe ${mb(groesse.c)} MB, Daten ${mb(groesse.d)} MB`);
say(`    ${mitMittel} von ${grund} Grundfarben-Karten mit Farbmittel, ${mittelWerte.size} verschiedene Werte (Klinke ${MIN_MITTEL})`);
if (bytes > MAX_MB * 1048576) fail(`[3] die Zwillinge wiegen zusammen ${mb(bytes)} MB, Deckel ${MAX_MB} MB (Repo und Image): neue Bilder kleiner bauen oder den Deckel mit Krisz heben`);
for (const g of gross.slice(0, 5)) fail(`[3] ${g} über ${MAX_DATEI_MB} MB: so groß wird kein Zwilling einer Karte bis 2048 px`);
if (mittelWerte.size < MIN_MITTEL && mitMittel >= MIN_MITTEL) fail(`[4] nur ${mittelWerte.size} verschiedene Farbmittel, Klinke ${MIN_MITTEL} — misst build-hangar-ktx noch am Bild?`);

/* ---------- [5] Viewer ---------- */
say('[5] Der ausgelieferte Viewer und sein Loader');
let naht = 0;
const VIEWER = join(DIST, 'assets', 'hangar-viewer.js');
if (!existsSync(VIEWER)) fail('[5] dist/assets/hangar-viewer.js fehlt');
else {
  const src = readFileSync(VIEWER, 'utf8');
  const bau = /^export const KTX_BAU = '([^']+)';$/m.exec(src)?.[1];
  if (bau !== BAU) fail(`[5] der Viewer hängt Rezept ${bau ?? '(keins gefunden)'} an die URL, die Zwillinge tragen ${BAU}: nach einem Rezeptwechsel lüde der Browser ein Jahr lang die alten Dateien aus seinem Cache (KTX_BAU in assets/hangar-viewer.js und BAU in scripts/lib/hangar-ktx.mjs gehören zusammen)`);
  else naht++;
  const ziel = /fetch\(`(\/hangar\/[^`$]*)\$\{id\}\.ktx2\?v=\$\{KTX_BAU\}`/.exec(src)?.[1];
  if (ziel !== `/hangar/${KTX_ORDNER}/`) fail(`[5] der Viewer holt die Zwillinge von ${ziel ?? '(keine Stelle gefunden)'}, sie liegen unter /hangar/${KTX_ORDNER}/`);
  else naht++;
  const pfad = /setTranscoderPath\('([^']+)'\)/.exec(src)?.[1];
  for (const n of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
    if (!pfad || !existsSync(join(DIST, pfad, n))) fail(`[5] der Umwandler ${pfad ?? '(kein Pfad im Viewer)'}${n} liegt nicht in dist/: kein Zwilling ließe sich auspacken, jedes Bild käme aus dem WebP`);
    else naht++;
  }
  const lader = /import\('three\/addons\/(loaders\/KTX2Loader\.js)'\)/.exec(src)?.[1];
  if (!lader || !existsSync(join(DIST, 'vendor', 'three', 'addons', lader))) fail('[5] der Viewer lädt KTX2Loader nicht mehr von three/addons/loaders/, oder die Datei fehlt in dist/vendor/three/');
  else naht++;
  // ktxKv des Viewers liest eine Datei dieses Baus wie das Tor. Der Viewer
  // importiert three über die Import-Map der Seite; in Node gibt es die
  // nicht, darum wird nur die eine Funktion aus dem Quelltext gerufen.
  const fn = /^export function ktxKv\(buf\) \{\n[\s\S]*?\n\}\n/m.exec(src)?.[0];
  if (!fn) fail('[5] ktxKv steht nicht mehr als eigene Funktion im Viewer');
  else if (!erster) fail('[5] kein guter Zwilling mit Farbmittel da, an dem sich ktxKv prüfen ließe');
  else {
    try {
      const mod = await import(`data:text/javascript;base64,${Buffer.from(fn).toString('base64')}`);
      const ab = erster.buf.buffer.slice(erster.buf.byteOffset, erster.buf.byteOffset + erster.buf.byteLength);
      const kv = mod.ktxKv(ab);
      const anders = Object.keys(erster.kv).filter((key) => kv[key] !== erster.kv[key]);
      if (anders.length) fail(`[5] ktxKv des Viewers liest ktx/${erster.id}.ktx2 anders als das Tor (${anders.join(', ')})`);
      else naht++;
      if (Object.keys(mod.ktxKv(new ArrayBuffer(40))).length || Object.keys(mod.ktxKv(ab.slice(0, 90))).length) fail('[5] ktxKv des Viewers liest Schlüssel aus einer abgeschnittenen Datei');
      else naht++;
    } catch (e) { fail(`[5] ktxKv des Viewers läuft nicht (${e.message})`); }
  }
}
say(`    ${naht} von 7 Stellen in Ordnung`);

/* ---------- [6] Nahtstellen im Viewer ---------- */
say('[6] Nahtstellen im Viewer');
{
  const src = existsSync(VIEWER) ? readFileSync(VIEWER, 'utf8') : '';
  const ctrlFile = join(DIST, 'assets', 'hangar-overview.js');
  const ctrl = existsSync(ctrlFile) ? readFileSync(ctrlFile, 'utf8') : '';
  const V = 'dist/assets/hangar-viewer.js';
  const NAHT = [
    ['Zwilling zuerst gefragt', /const images = embeddedImages\(8, \(parser\) => shipTex\.count\(parser\), SMALL \? TEX_MAX : 0, ktxTwin\);/.test(src) && /const p = id === null \? bild\(\) : Promise\.resolve\(id\)\.then\(\(k\) => \(k \? twin\.load\(k\) : null\)\)/.test(src),
      `${V}: embeddedImages() bekommt ktxTwin nicht mehr oder fragt den Zwilling nicht mehr zuerst: jede Textur kommt aus dem WebP und liegt unkomprimiert bei der Grafikkarte`],
    ['ohne Zwilling das WebP', /if \(!z\) return bild\(\);/.test(src) && /ktxStat\.miss\+\+;[\s\S]{0,260}?return null;/.test(src),
      `${V}: fehlt ein Zwilling, lädt der Viewer nicht mehr das WebP an seiner Stelle (oder zählt ihn nicht mehr): das Material bliebe ohne diese Karte`],
    ['Ladebalken und Farbmittel aus der Datei', /if \(pooled\) count\?\.\(z\.webp\);\s*if \(mean && colour\.has\(i\)\) t\.userData\.mean = z\.mean;/.test(src) && /webp: Number\(kv\.HGwebp\) \|\| 0, mean: /.test(src),
      `${V}: der Zwilling meldet dem Ladebalken die Bytes seines WebP nicht mehr oder trägt sein Farbmittel nicht mehr an die Textur: der Balken bliebe stehen, oder der dunkelste Lack würde nicht mehr angehoben`],
    ['Merkmale des Bildes am Zwilling', /const t = dress\(z\.t\);/.test(src) && /const dress = \(t\) => \{\s*if \(def\.extras && typeof def\.extras === 'object'\) Object\.assign\(t\.userData, def\.extras\);/.test(src),
      `${V}: der Zwilling bekommt die Merkmale seines Bildes nicht mehr (images[].extras, etwa neutral): eine neutrale Karte gälte als echte, und ihr Farbmittel dunkelte das Material ab`],
    ['aus am Telefon und mit ?bilder=webp', /const KTX_AN = !SMALL && opts\.bilder !== 'webp' && !!globalThis\.crypto\?\.subtle;/.test(src) && /const BILDER = new URLSearchParams\(location\.search\)\.get\('bilder'\);/.test(ctrl) && /pad: BODEN, bilder: BILDER,/.test(ctrl),
      `${V} oder dist/assets/hangar-overview.js: der Weg über die Zwillinge ist am Telefon nicht mehr aus (dort unerprobt), oder ?bilder=webp stellt ihn nicht mehr ab (Vergleich beider Wege)`],
    ['nur mit BC7 oder ASTC', /if \(L\.workerConfig\.bptcSupported \|\| L\.workerConfig\.astcSupported\) return L;/.test(src),
      `${V}: der Viewer verlangt für die Zwillinge kein BC7 oder ASTC mehr: ohne ein solches Format packt der Umwandler nach RGBA aus, nichts ist gewonnen und das Laden dauert länger`],
    ['Schlüssel vor dem Umwandeln gelesen', /const kv = ktxKv\(buf\);\s*if \(kv\.HGbau !== KTX_BAU\) throw[^\n]*\n\s*stage = 'Umwandeln';\s*const t = await ktxWandle\(L, buf\);/.test(src),
      `${V}: die Schlüssel des Zwillings werden nicht mehr gelesen, bevor der Puffer zum Umwandler geht (danach ist er leer), oder das Rezept wird nicht mehr verglichen`],
    ['Mip-Stufen nach dem Hochladen frei, mit Falle', /Object\.defineProperty\(mm, 'data', \{ get: ask, configurable: true \}\)/.test(src) && /\(isBitmap\(t\.source\?\.data\) \|\| t\.isCompressedTexture\)\) return;/.test(src),
      `${V}: die Bytes einer komprimierten Textur bleiben nach dem Hochladen im Arbeitsspeicher (freeImages, noteTextures), oder die Falle meldet einen späteren Leser nicht mehr`],
    ['Sampler ohne Mips lädt nur die größte Stufe', /if \(t\.isCompressedTexture && t\.mipmaps\.length > 1 && \(t\.minFilter === THREE\.LinearFilter \|\| t\.minFilter === THREE\.NearestFilter\)\) t\.mipmaps = \[t\.mipmaps\[0\]\];/.test(src),
      `${V}: eine komprimierte Textur, deren Sampler keine Mip-Stufen liest, lädt wieder alle hoch: ein Drittel mehr Grafikspeicher für diese Karten`],
    ['niedrige Stufe ohne die großen Stufen', /if \(TEX_MAX\) while \(t\.mipmaps\.length > 1 && Math\.max\(t\.mipmaps\[0\]\.width, t\.mipmaps\[0\]\.height\) > TEX_MAX\) t\.mipmaps\.shift\(\);/.test(src),
      `${V}: in der niedrigen Stufe gehen die großen Mip-Stufen der Zwillinge wieder zur Grafikkarte (TEX_MAX): viermal so viel Grafikspeicher wie mit dem verkleinerten WebP`],
    ['Wächter des Umwandlers', Number(/const KTX_STILL_S = (\d+);/.exec(src)?.[1] ?? NaN) <= 30 && /if \(\+\+ktxWach\.still >= KTX_STILL_S\) ktxTot\(/.test(src) && /L\.parse\(buf, \(t\) => fertig\(ja, t\), \(e\) => fertig\(nein, e\)\);/.test(src)
      && /ktxLoader = Promise\.resolve\(null\);[\s\S]{0,260}?for \(const nein of offen\) nein\(new Error\(why\)\);/.test(src),
      `${V}: antwortet der Umwandler nicht (Worker scheitert beim Start), wartet der Viewer wieder ohne Ende auf ihn, statt nach höchstens 30 s auf das WebP zurückzufallen: der Hangar bliebe beim Laden stehen`],
  ];
  const gutN = NAHT.filter((l) => l[1]).length;
  say(`    ${gutN} von ${NAHT.length} Nahtstellen${gutN === NAHT.length ? '' : `, fehlt: ${NAHT.filter((l) => !l[1]).map((l) => l[0]).join(', ')}`}`);
  for (const [, ok, msg] of NAHT) if (!ok) fail(`[6] ${msg} (13.11.2026)`);
}

/* ---------- [7] Umwandler ohne Code aus Zeichenketten ---------- */
say('[7] Der ausgelieferte Umwandler läuft ohne Code aus Zeichenketten und wandelt wie der unveränderte');
{
  const ORT = join(DIST, 'vendor', 'three', 'addons', 'libs', 'basis'), QUELLE = join(ROOT, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
  const jsF = join(ORT, 'basis_transcoder.js'), wasmF = join(ORT, 'basis_transcoder.wasm');
  if (!existsSync(jsF) || !existsSync(wasmF)) fail('[7] basis_transcoder.js oder .wasm fehlt in dist/vendor/three/addons/libs/basis/');
  else if (!existsSync(join(QUELLE, 'basis_transcoder.js'))) fail('[7] node_modules/three fehlt: erst `npm ci`, dann prüfen (der Vergleich braucht den unveränderten Umwandler)');
  else {
    const glue = readFileSync(jsF, 'utf8'), wasm = readFileSync(wasmF);
    // statisch: keine der Stellen, an denen embind Code aus einer Zeichenkette baut
    const stellen = [...glue.matchAll(/newFunc\(Function\b|\bnew Function\(|\beval\(/g)].length;
    if (stellen) fail(`[7] dist/vendor/three/addons/libs/basis/basis_transcoder.js baut an ${stellen} Stelle(n) Code aus einer Zeichenkette (newFunc(Function, …), new Function, eval): die Richtlinie der Seite verbietet das, der Umwandler startete im Browser nicht (benannte Korrektur in scripts/verify-vendor-three.mjs, PATCHED)`);
    // Proben: je Art gleichmäßig über die sortierten Kennungen
    const proben = [];
    for (const art of ['n', 'c', 'd']) {
      const ids = [...inv.bilder].filter(([id, b]) => b.art === art && existsSync(join(ZIEL, `${id}.ktx2`))).map(([id]) => id).sort();
      const schritt = Math.max(1, Math.floor(ids.length / MIN_PROBEN));
      for (let i = 0; i < ids.length && proben.filter((x) => x.art === art).length < MIN_PROBEN; i += schritt) proben.push({ art, id: ids[i] });
    }
    let mein = null, ihr = null;
    try { mein = await basisStart(glue, wasm, { zeichenketten: false }); }
    catch (e) { fail(`[7] der ausgelieferte Umwandler startet nicht ohne Code aus Zeichenketten (${String(e?.message ?? e).slice(0, 240)}): unter der Richtlinie der Seite antwortete kein Worker, und jedes Bild käme nach der Frist des Wächters aus dem WebP`); }
    try { ihr = await basisStart(readFileSync(join(QUELLE, 'basis_transcoder.js'), 'utf8'), readFileSync(join(QUELLE, 'basis_transcoder.wasm')), { zeichenketten: true }); }
    catch (e) { fail(`[7] der unveränderte Umwandler aus node_modules/three startet nicht (${String(e?.message ?? e).slice(0, 200)}): der Vergleich ist nicht möglich`); }
    let gleich = 0, laeufe = 0;
    const anders = [];
    if (mein && ihr) {
      for (const { art, id } of proben) {
        const buf = readFileSync(join(ZIEL, `${id}.ktx2`));
        for (const [name, format] of Object.entries(BASIS_FORMATE)) {
          laeufe++;
          try {
            const a = mein.wandle(buf, format), b = ihr.wandle(buf, format);
            if (a.sha === b.sha && a.bytes === b.bytes && a.stufen === b.stufen && a.bytes > 0) gleich++;
            else anders.push(`ktx/${id}.ktx2 nach ${name}: ${a.bytes} Bytes ${a.sha.slice(0, 12)}, unverändert ${b.bytes} Bytes ${b.sha.slice(0, 12)}`);
          } catch (e) { anders.push(`ktx/${id}.ktx2 (${art}) nach ${name}: ${String(e?.message ?? e).slice(0, 160)}`); }
        }
      }
      for (const z of anders.slice(0, 5)) fail(`[7] der ausgelieferte Umwandler wandelt anders als der unveränderte: ${z}`);
      if (anders.length > 5) fail(`[7] … und ${anders.length - 5} weitere Abweichungen`);
      for (const art of ['n', 'c', 'd']) {
        const n = proben.filter((x) => x.art === art).length;
        if (n < MIN_PROBEN) fail(`[7] nur ${n} Proben der Art ${art} (Klinke ${MIN_PROBEN})`);
      }
    }
    say(`    ${proben.length} Zwillinge (je Art ${MIN_PROBEN} verlangt) nach ${Object.keys(BASIS_FORMATE).join(' und ')}: ${gleich} von ${laeufe} Ergebnissen bitgleich mit dem unveränderten Umwandler, ${stellen} Stellen mit Code aus Zeichenketten`);
  }
}

if (fehler.length) {
  console.error(`\nverify-hangar-ktx: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('\nverify-hangar-ktx: ALLE ZUSICHERUNGEN ERFUELLT ✓');
