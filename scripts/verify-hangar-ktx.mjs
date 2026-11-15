/* ============================================================
   verify-hangar-ktx.mjs — Tor fuer die komprimierten Zwillinge der
   Hangar-Bilder (Schiene A, nur mit Hangar).

   WARUM ES DEN GIBT: Seit dem 13.11.2026 laedt der Hangar am PC jede
   Textur aus einer KTX2-Datei unter /hangar/ktx/ statt aus ihrem WebP,
   seit dem 15.11.2026 am Telefon aus deren kleiner Fassung unter
   /hangar/ktx-klein/ ([8])
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
   der Ablage dist/hangar/tex/, die Zwillinge dist/hangar/ktx/, ihre
   kleinen Fassungen dist/hangar/ktx-klein/ und den ausgelieferten Viewer
   dist/assets/hangar-viewer.js (in Node geladen).

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
         kommen an den Zwilling; der Weg ist mit ?bilder=webp aus, am
         Telefon unter einem Deckel des Waechters und mit gewaehlter Stufe
         auch (dort laeuft er sonst mit zwei Workern), und verlangt BC7
         oder ASTC; die Schluessel werden
         gelesen, bevor der Puffer zum Umwandler geht; die Mip-Stufen gehen
         nach dem Hochladen aus dem Arbeitsspeicher (mit Falle); ein
         Sampler ohne Mips laedt nur die groesste Stufe; die niedrige Stufe
         laesst die grossen Stufen weg; antwortet der Umwandler nicht,
         stellt ein Waechter den Weg ab, statt den Hangar warten zu
         lassen; der Umwandler wird vor den Bildern angefordert, und der
         Waechter zaehlt erst, wenn er angekommen ist (ueber 16 Mbit/s
         stellte er sonst ab, obwohl nichts kaputt war); das Aus gilt fuer
         alles, was noch laedt oder umwandeln will; beim Abbau wird der
         Loader samt Workern frei, auch wenn sein Start erst danach fertig
         wird. Ob die Zwillinge im Browser wirklich laden, prueft
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
     [8] Kleine Fassungen fuers Telefon (15.11.2026): Zu jedem Zwilling
         liegt unter dist/hangar/ktx-klein/ genau eine Datei gleichen
         Namens, und der Ordner traegt nichts anderes. Jede ist Byte fuer
         Byte, was ktxKlein (scripts/lib/hangar-ktx.mjs) aus ihrem
         Zwilling macht: dieselbe Datei ohne die Mip-Stufen ueber
         KTX_KLEIN_MAX. Dass eine so gekuerzte Datei dasselbe Bild traegt,
         zeigt der ausgelieferte Umwandler: Er wandelt je Art mindestens
         MIN_PROBEN gekuerzte Fassungen in die Formate eines Telefons um,
         und jede Stufe ist bitgleich mit derselben Stufe des Zwillings.
         Der Viewer holt am Telefon aus diesem Ordner, mit Rezept und
         Kante an der URL, und seine Automatik am Telefon laedt genau
         diese Kante ([5]). Fehlte eine Fassung, luede das Telefon fuer
         das Bild still das WebP, viermal so schwer bei der Grafikkarte;
         genau dieser Speicher hat Krisz' iPhone 12 am 15.11.2026 den
         Zeichenkontext gekostet.

   VORGEFUEHRT ROT (13.11.2026; [8] und die Stellen des Telefons am
   15.11.2026), jede Meldung im Commit:
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
     j  bis t (mit n2 und t2, dreizehn Faelle): je eine der
        ersten elf Nahtstellen im Viewer oder Controller
        in dist/ aendern                                -> [6]
     w  bis y (mit w2, w3, x2, x3, y2, acht Faelle): die
        drei Nahtstellen aus dem Review zu PR #361: der
        Waechter zaehlt vor dem Umwandler, der Umwandler
        kommt erst mit dem ersten Bild, das Aus laesst
        weiter laden oder umwandeln, der Abbau gibt den
        Loader nicht frei                               -> [6]
     u  den Umwandler in dist/ durch den unveraenderten
        aus node_modules/three ersetzen                 -> [7]
     v  im Umwandler in dist/ eine der beiden Korrekturen
        verfaelschen (Empfaenger eines Aufrufs gestrichen;
        ebenso: `this` nicht uebergeben, Rueckgabe
        gestrichen)                                     -> [7]
     k1 eine kleine Fassung loeschen                     -> [8]
     k2 eine fremde Datei in ktx-klein/ legen            -> [8]
     k3 eine kleine Fassung durch ihren ganzen Zwilling
        ersetzen                                        -> [8]
     k4 in einer kleinen Fassung ein Byte einer Stufe
        aendern                                         -> [8]
     k5 kleine Fassungen mit einem ktxKlein bauen, das die
        Bildbeschreibungen der falschen Stufen behaelt
        (die ersten statt der letzten)                  -> [8]
     k6 KTX_KLEIN im Viewer auf 512                     -> [5]
     k7 den Ordner der kleinen Fassungen im Viewer
        aendern                                         -> [5]
     k8 TEX_PHONE_AUTO im Viewer auf 128                 -> [5]
     k9 KTX_TEL im Viewer ohne !opts.cap (die leichte
        Ansicht bekaeme die Zwillinge auch)              -> [6]
     k10 am Telefon vier statt zwei Worker               -> [6]
   NICHT ERFASST: ob ein echtes Telefon die Zwillinge traegt (ASTC und ETC2
   auf seinem Grafikchip, Speicher des Umwandlers). Das Tor wandelt mit dem
   ausgelieferten Umwandler in Node um; ein Telefon gibt es hier nicht
   (.planning/WINDOWS.md).
   NICHT ERFASST: der Abbau von Argumenten nach einem Aufruf
   (runDestructors, destructorFunction in der ersten Korrektur). Kein
   Aufruf des Umwandlers hat ein Argument, das abgebaut werden muss; ohne
   diese Zeilen bleibt jedes Ergebnis gleich (13.11.2026 probiert). Sie
   stehen dort, weil emscripten sie an der Stelle fuehrt.
   ============================================================ */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BAU, KTX_KLEIN_MAX, KTX_KLEIN_ORDNER, KTX_NAME, KTX_ORDNER, bestand, dateiAnfang, ktxKlein, ktxKleinWeg, ktxKopf } from './lib/hangar-ktx.mjs';
import { BASIS_FORMATE, BASIS_FORMATE_TELEFON, basisStart } from './lib/hangar-basis.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist'), HANGAR = join(DIST, 'hangar'), ZIEL = join(HANGAR, KTX_ORDNER), KLEIN = join(HANGAR, KTX_KLEIN_ORDNER);

// Klinken (13.11.2026: 1.195 GLB, 9.621 Bilder, davon 1.809 Normal-Karten
// und 5.296 Grundfarben-Karten)
const MIN_GLB = 1150, MIN_BILDER = 9300, MIN_NORMAL = 1700, MIN_GRUND = 5000, MIN_MITTEL = 2000;
// Deckel (Repo und Image): die Zwillinge wogen am 13.11.2026 zusammen
// 459 MB (ihre WebP 310 MB), der größte 1,0 MB. Krisz hat der Umstellung mit
// der Schätzung „rund 460 MB" aus der Probe zugestimmt; was darüber wächst,
// soll jemand entscheiden und nicht still passieren.
const MAX_MB = 560, MAX_DATEI_MB = 8;
// [8]: die kleinen Fassungen wogen am 15.11.2026 zusammen 163,5 MB (nur im
// Image, nicht im Repo: public/hangar/ktx-klein/ ist gitignored), 5.447 von
// 9.621 sind gekürzt, der Rest war schon klein
const MAX_KLEIN_MB = 200, MIN_GEKUERZT = 5200;
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
say('Geprüftes Artefakt: dist/hangar/ (GLB, Ablage tex/, Zwillinge ktx/, kleine Fassungen ktx-klein/) und dist/assets/hangar-viewer.js');

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
const gekuerzt = new Map();   // Kennung -> gestrichene Stufen, für [8] (nur gute Zwillinge, die gekürzt werden)
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
  if (ktxKleinWeg(k) > 0) gekuerzt.set(id, ktxKleinWeg(k));
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
  // Ort und Fassung an der URL: am PC der ganze Zwilling mit dem Rezept, am
  // Telefon (KTX_TEL) die kleine Fassung mit Rezept und Kante
  const ort = /const KTX_ORT = KTX_TEL \? '([^']+)' : '([^']+)', KTX_V = KTX_TEL \? `\$\{KTX_BAU\}-\$\{KTX_KLEIN\}` : KTX_BAU;/.exec(src);
  const holt = /fetch\(`\$\{KTX_ORT\}\$\{id\}\.ktx2\?v=\$\{KTX_V\}`/.test(src);
  const ziel = holt ? ort?.[2] : null, zielKlein = holt ? ort?.[1] : null;
  if (ziel !== `/hangar/${KTX_ORDNER}/`) fail(`[5] der Viewer holt die Zwillinge von ${ziel ?? '(keine Stelle gefunden)'}, sie liegen unter /hangar/${KTX_ORDNER}/`);
  else naht++;
  if (zielKlein !== `/hangar/${KTX_KLEIN_ORDNER}/`) fail(`[5] der Viewer holt am Telefon die kleinen Fassungen von ${zielKlein ?? '(keine Stelle gefunden)'}, sie liegen unter /hangar/${KTX_KLEIN_ORDNER}/, oder ihre URL trägt Rezept und Kante nicht mehr (ändert sich die Kante, lüde der Browser sonst ein Jahr lang die alten Dateien): jedes Bild käme am Telefon aus dem WebP`);
  else naht++;
  const kante = Number(/^export const KTX_KLEIN = (\d+);$/m.exec(src)?.[1] ?? NaN), auto = Number(/TEX_PHONE_AUTO = (\d+),/.exec(src)?.[1] ?? NaN);
  if (kante !== KTX_KLEIN_MAX) fail(`[5] der Viewer nennt für die kleinen Fassungen ${Number.isFinite(kante) ? `${kante} px` : '(keine Kante gefunden)'}, gebaut sind sie bis ${KTX_KLEIN_MAX} px (KTX_KLEIN in assets/hangar-viewer.js und KTX_KLEIN_MAX in scripts/lib/hangar-ktx.mjs gehören zusammen)`);
  else naht++;
  if (auto !== KTX_KLEIN_MAX) fail(`[5] die Automatik am Telefon lädt ${Number.isFinite(auto) ? `${auto} px` : '(TEX_PHONE_AUTO nicht gefunden)'} Kante, die kleinen Fassungen tragen ${KTX_KLEIN_MAX} px: Darüber fehlten dem Telefon die Stufen (das Bild bliebe unschärfer als verlangt), darunter lüde es Stufen, die es nicht hochlädt`);
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
say(`    ${naht} von 10 Stellen in Ordnung`);

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
    ['am Telefon nur in der Automatik ohne Deckel, mit ?bilder=webp aus', /const KTX_TEL = SMALL && !FORCED && !opts\.cap;/.test(src) && /const KTX_AN = \(!SMALL \|\| KTX_TEL\) && opts\.bilder !== 'webp' && !!globalThis\.crypto\?\.subtle;/.test(src) && /const BILDER = new URLSearchParams\(location\.search\)\.get\('bilder'\);/.test(ctrl) && /pad: BODEN, bilder: BILDER,/.test(ctrl) && /cap: deckel,/.test(ctrl),
      `${V} oder dist/assets/hangar-overview.js: am Telefon laufen die Zwillinge auch unter einem Deckel des Wächters oder mit gewählter Stufe (die leichte Ansicht, die auf Krisz' iPhone steht, wäre nicht mehr der unveränderte Weg zurück), oder ?bilder=webp stellt den Weg nicht mehr ab (Vergleich beider Wege) (15.11.2026)`],
    ['am Telefon zwei Worker', /\.setWorkerLimit\(KTX_TEL \? 2 : Math\.max\(2, Math\.min\(4, \(navigator\.hardwareConcurrency \|\| 4\) - 1\)\)\)/.test(src),
      `${V}: am Telefon startet der Loader der Zwillinge wieder bis zu vier Worker, jeder mit seinem eigenen Umwandler im Arbeitsspeicher (15.11.2026: zwei)`],
    ['nur mit BC7 oder ASTC', /if \(!\(L\.workerConfig\.bptcSupported \|\| L\.workerConfig\.astcSupported\)\) \{ L\.dispose\(\); throw new Error\(/.test(src),
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
    // Die drei folgenden kamen mit dem Review zu PR #361 (13.11.2026). Über
    // eine Leitung mit 16 Mbit/s stellte die erste Fassung des Wächters den
    // Weg nach 15 s ab, obwohl nichts kaputt war: Der Umwandler stand hinter
    // Hunderten von Zwillingen in der Schlange. 451 Bilder kamen aus dem
    // WebP, der Rest lief danach doch noch durch den Umwandler.
    ['Umwandler zuerst angefordert, Wächter zählt erst danach', /L\.init\(\)\.then\(\(\) => \{ ktxWach\.bereit = true; \}, \(e\) => ktxTot\(/.test(src) && /if \(!ktxWach\.bereit\) return;\s*if \(ktxWach\.fertig !== ktxWach\.gesehen\)/.test(src) && /\n  if \(KTX_AN\) ktxStart\(\);\n/.test(src),
      `${V}: der Umwandler wird nicht mehr vor den Bildern angefordert, oder der Wächter zählt schon, bevor er angekommen ist: über eine langsame Leitung stellt der Wächter die komprimierten Texturen ab, obwohl nichts kaputt ist (16 Mbit/s: nach 15 s, 451 Bilder aus dem WebP)`],
    ['das Aus gilt für alles', /if \(ktxWach\.aus\) return;\s*ktxWach\.aus = true;/.test(src) && /ktxWach\.ab\.abort\(\);/.test(src) && /credentials: 'same-origin', signal: ktxWach\.ab\.signal \}\);/.test(src) && /if \(ktxWach\.aus\) \{ nein\(new Error\(/.test(src),
      `${V}: nach dem Aus laden Zwillinge weiter, oder ein Bild geht noch an den abgestellten Loader: der Wächter stellt jede Sekunde neu ab, Bilder laden doppelt, und ein Teil der Texturen kommt doch noch komprimiert an`],
    ['Loader beim Abbau frei, auch bei spätem Start', /ktxTot\('der Hangar ist abgebaut', false\);\s*draco\.dispose\(\);/.test(src) && /alt\?\.then\(ktxFrei\)/.test(src) && /L\.setWorkerLimit\(0\);\s*L\.dispose\(\);\s*L\.transcoderPending\?\.then\(\(\) => \{ L\.workerPool\.dispose\(\); if \(L\.workerSourceURL\) URL\.revokeObjectURL\(L\.workerSourceURL\); \}\)/.test(src),
      `${V}: der Viewer gibt den Loader der Zwillinge beim Abbau nicht mehr frei, oder ein Start, der erst nach der Freigabe fertig wird, legt wieder Worker an und wandelt die wartenden Bilder um`],
  ];
  const gutN = NAHT.filter((l) => l[1]).length;
  say(`    ${gutN} von ${NAHT.length} Nahtstellen${gutN === NAHT.length ? '' : `, fehlt: ${NAHT.filter((l) => !l[1]).map((l) => l[0]).join(', ')}`}`);
  for (const [, ok, msg] of NAHT) if (!ok) fail(`[6] ${msg}${/\(\d\d\.\d\d\.\d{4}[^)]*\)$/.test(msg) ? '' : ' (13.11.2026)'}`);
}

/* ---------- [7] Umwandler ohne Code aus Zeichenketten ---------- */
say('[7] Der ausgelieferte Umwandler läuft ohne Code aus Zeichenketten und wandelt wie der unveränderte');
let mein = null;   // der ausgelieferte Umwandler, auch für [8]
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
    let ihr = null;
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

/* ---------- [8] Kleine Fassungen fürs Telefon ---------- */
say('[8] Kleine Fassungen fürs Telefon');
{
  const BAUEN_KLEIN = 'node scripts/build-hangar-ktx-klein.mjs baut sie (läuft in npm run build vor Astro), dann neu bauen';
  const klDa = existsSync(KLEIN) ? readdirSync(KLEIN) : [];
  const zw = da.filter((n) => KTX_NAME.test(n)), zwSet = new Set(zw), klSet = new Set(klDa);
  const klFehlt = zw.filter((n) => !klSet.has(n)), klFremd = klDa.filter((n) => !zwSet.has(n));
  for (const n of klFehlt.slice(0, 8)) fail(`[8] ${KTX_KLEIN_ORDNER}/${n} fehlt: das Telefon lüde dieses Bild still aus dem WebP, viermal so schwer bei der Grafikkarte`);
  if (klFehlt.length) fail(`[8] ${klFehlt.length} kleine Fassung${klFehlt.length === 1 ? '' : 'en'} fehl${klFehlt.length === 1 ? 't' : 'en'} — ${BAUEN_KLEIN}`);
  for (const n of klFremd.slice(0, 5)) fail(`[8] ${KTX_KLEIN_ORDNER}/${n} gehört zu keinem Zwilling`);
  if (klFremd.length) fail(`[8] ${klFremd.length} Datei${klFremd.length === 1 ? '' : 'en'} in ${KTX_KLEIN_ORDNER}/ ohne Zwilling — ${BAUEN_KLEIN} (der Lauf räumt sie weg)`);
  // Byte für Byte, was ktxKlein aus dem Zwilling macht. Hier werden beide
  // Ordner ganz gelesen (gut 600 MB, wenige Sekunden): Ein Kopf allein sagte
  // nicht, dass die Stufen darin die des Zwillings sind.
  let gleich = 0, anders = 0, klBytes = 0, klGekuerzt = 0, zuGross = 0;
  for (const n of zw) {
    if (!klSet.has(n)) continue;
    const gross = readFileSync(join(ZIEL, n)), klein = readFileSync(join(KLEIN, n));
    klBytes += klein.length;
    let soll = null, warum = '';
    try { soll = ktxKlein(gross, KTX_KLEIN_MAX); } catch (e) { warum = `ktxKlein kann den Zwilling nicht kürzen (${e.message})`; }
    if (soll && soll !== gross) klGekuerzt++;
    const k = soll && soll.equals(klein) ? ktxKopf(klein.subarray(0, ANFANG), klein.length) : null;
    if (k && Math.max(k.breite, k.hoehe) > KTX_KLEIN_MAX) { zuGross++; warum = `${k.breite} x ${k.hoehe}, über ${KTX_KLEIN_MAX} px`; }
    if (soll && soll.equals(klein) && !warum) { gleich++; continue; }
    if (++anders <= 8) fail(`[8] ${KTX_KLEIN_ORDNER}/${n} ist nicht, was ktxKlein aus ${KTX_ORDNER}/${n} macht (${warum || `${klein.length} Bytes, erwartet ${soll.length}${klein.length === soll.length ? ', Inhalt weicht ab' : ''}`}) — ${BAUEN_KLEIN}`);
  }
  if (anders > 8) fail(`[8] … und ${anders - 8} weitere kleine Fassungen weichen ab`);
  say(`    ${gleich} von ${zw.length} kleinen Fassungen Byte für Byte wie aus ihrem Zwilling gekürzt (bis ${KTX_KLEIN_MAX} px; ${klGekuerzt} gekürzt, Klinke ${MIN_GEKUERZT}; ${zw.length - klGekuerzt} waren schon klein), ${klFremd.length} fremde Dateien; ${mb(klBytes)} MB (Deckel ${MAX_KLEIN_MB} MB)`);
  if (klGekuerzt < MIN_GEKUERZT && zw.length >= MIN_BILDER) fail(`[8] nur ${klGekuerzt} Zwillinge werden gekürzt, Klinke ${MIN_GEKUERZT} — kürzt ktxKlein noch (KTX_KLEIN_MAX ${KTX_KLEIN_MAX} px)? Ungekürzt lüde das Telefon die ganzen Dateien`);
  if (klBytes > MAX_KLEIN_MB * 1048576) fail(`[8] die kleinen Fassungen wiegen zusammen ${mb(klBytes)} MB, Deckel ${MAX_KLEIN_MB} MB (Image): Ursache klären, nicht den Deckel heben`);
  // Trägt eine gekürzte Datei dasselbe Bild? Der ausgelieferte Umwandler
  // wandelt sie in die Formate eines Telefons um; jede Stufe muss bitgleich
  // mit derselben Stufe des Zwillings sein. Proben je Art gleichmäßig über
  // die sortierten Kennungen der gekürzten.
  if (!mein) fail('[8] der ausgelieferte Umwandler läuft nicht ([7]): ob eine gekürzte Datei dasselbe Bild trägt, ließ sich nicht prüfen');
  else {
    let laeufe = 0, gut8 = 0;
    const schief = [], jeArt = { n: 0, c: 0, d: 0 };
    for (const art of ['n', 'c', 'd']) {
      const ids = [...gekuerzt.keys()].filter((id) => inv.bilder.get(id)?.art === art && klSet.has(`${id}.ktx2`)).sort();
      const schritt = Math.max(1, Math.floor(ids.length / MIN_PROBEN));
      for (let i = 0; i < ids.length && jeArt[art] < MIN_PROBEN; i += schritt) {
        const id = ids[i], weg = gekuerzt.get(id);
        const gross = readFileSync(join(ZIEL, `${id}.ktx2`)), klein = readFileSync(join(KLEIN, `${id}.ktx2`));
        jeArt[art]++;
        for (const [name, format] of Object.entries(BASIS_FORMATE_TELEFON)) {
          laeufe++;
          try {
            const a = mein.wandle(klein, format), b = mein.wandle(gross, format, weg);
            if (a.sha === b.sha && a.bytes === b.bytes && a.stufen === b.stufen && a.bytes > 0 && Math.max(a.breite, a.hoehe) <= KTX_KLEIN_MAX) gut8++;
            else schief.push(`${KTX_KLEIN_ORDNER}/${id}.ktx2 nach ${name}: ${a.stufen} Stufen, ${a.bytes} Bytes ${a.sha.slice(0, 12)}; dieselben Stufen des Zwillings: ${b.stufen}, ${b.bytes} Bytes ${b.sha.slice(0, 12)}`);
          } catch (e) { schief.push(`${KTX_KLEIN_ORDNER}/${id}.ktx2 (${art}) nach ${name}: ${String(e?.message ?? e).slice(0, 160)}`); }
        }
      }
      if (jeArt[art] < MIN_PROBEN) fail(`[8] nur ${jeArt[art]} gekürzte Proben der Art ${art} (Klinke ${MIN_PROBEN})`);
    }
    for (const z of schief.slice(0, 5)) fail(`[8] eine gekürzte Fassung trägt nicht dasselbe Bild wie ihr Zwilling: ${z} — ktxKlein in scripts/lib/hangar-ktx.mjs kürzt falsch`);
    if (schief.length > 5) fail(`[8] … und ${schief.length - 5} weitere Abweichungen`);
    say(`    ${jeArt.n + jeArt.c + jeArt.d} gekürzte Fassungen (je Art ${MIN_PROBEN} verlangt) nach ${Object.keys(BASIS_FORMATE_TELEFON).join(', ')}: ${gut8} von ${laeufe} Ergebnissen bitgleich mit denselben Stufen des Zwillings`);
  }
}

if (fehler.length) {
  console.error(`\nverify-hangar-ktx: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('\nverify-hangar-ktx: ALLE ZUSICHERUNGEN ERFUELLT ✓');
