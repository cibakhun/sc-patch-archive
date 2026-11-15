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

   HALLEN FESTER GROESSE (14.11.2026): Ein Schiff, dessen Groesse eine Halle
   des Industrie-Bausatzes hat (hg-stage, halls; als erste die Large-Halle
   util-lrgtop, etwa mit --ship anvl-carrack), steht nicht mehr in der
   gestreckten Halle. Dort gibt es keine Hallendeko und noch keinen
   Wartungsplatz: Der Lauf wartete 15 min auf die Zeile "[hangar]
   Hallendeko:", die dort nie kommt, und endete rot mit „nach 15 min keine
   Zeile "[hangar] Hallendeko:"“; keine Klinke griff, und auf die Ruhe der
   Halle wartete er nicht (so gelaufen mit --ship anvl-carrack). Er
   nimmt jetzt auch die Zeile "[hangar] Aufzug der Halle:" als Zeichen, dass
   die Halle steht (nur eine Halle fester Groesse baut ihren Aufzug aus dem
   eigenen Modell; in der gestreckten Halle kommt sie nie, dort bleibt die
   Hallendeko Pflicht), liest am geholten Modell unter /hangar/hall/, welche
   es ist, und wertet gegen deren eigene Klinken aus (KLINKE_FEST). FEHLER,
   wenn die Halle dort keinen Eintrag hat oder keines der Modelle aus
   hg-stage geholt wurde.
   Hallenwechsel (14.11.2026): --wechsel anvl-carrack von der Gladius aus
   baut die Buehne um (umbauen in hangar-overview.js), die Carrack steht
   danach in der Large-Halle. Der Lauf wertete die Zeilen der neuen Buehne
   gegen die Klinken der gestreckten Halle: 3 FEHLER (560 Bilder
   freigegeben gegen Klinke 600, 107 MB Geometrie gegen 120, 562 Bilder
   aus Zwillingen gegen 850), und an keiner der beiden Hallen fehlte
   etwas. Jetzt liest er aus hg-stage, welche Halle die Seite fuer das
   erste und fuer das neue Schiff nennt (wie hallOf der Seite). Sind es
   zwei, verlangt er den Beleg an der Buehne selbst (das Modell der neuen
   Halle geholt und eine neue Zeile zu ihrem Aufzug; fuer die gestreckte
   Halle eine neue Zeile zur Hallendeko) und wertet dann jede Halle fuer
   sich: den Stand vor dem Wechsel (Programme, Schichttafeln, freigegebene
   Bilder und Geometrie, Zwillinge) gegen die Klinken der ersten, und was
   seit dem Wechsel dazukam, gegen die der neuen. Fuer die neue Halle
   zaehlen nur Zeilen, die ihre Buehne selbst gemeldet hat (die der alten
   blieben sonst stehen und saehen gruen aus), und die Klinke ktx gilt
   dort nicht (es steht nicht mehr das erste Schiff der Liste). Die Grenze
   von 16 Texturen und die noch einmal verlangten Bilder und Puffer gelten
   ueber den ganzen Lauf.
   Vorgefuehrt rot (14.11.2026, je eine Kopie des Skripts mit einem
   Eingriff, --wechsel anvl-carrack von der Gladius aus, 4 von 4 Laeufen
   rot, das Skript selbst danach gruen): die Klinke frei beider Hallen auf
   9999 (2 FEHLER: „vor dem Hallenwechsel (revelyork-single): der Viewer
   gab nur 897 Bilder … frei“ und „der Viewer gibt nur 560 Bilder … frei“);
   die Large-Halle ohne Eintrag in KLINKE_FEST („die Halle util-lrgtop hat
   keine eigenen Klinken“); die Seite baut die Buehne nicht um (Eingriff
   in ihr Skript auf dem Weg zum Browser, die Carrack laesst die
   gestreckte Halle auf 129 m wachsen: „die Seite nennt fuer anvl-carrack
   die Halle util-lrgtop …, aber ihr Modell unter /hangar/hall/ wurde nicht
   geholt: die Halle hat nicht gewechselt, das Schiff steht in der
   falschen“); die neue Buehne meldet ihre freigegebenen Bilder nicht
   („der Viewer gibt keine Bilder nach dem Hochladen frei, Klinke 500“;
   ohne die Regel zu den Zeilen stuende dort die 897 der alten Halle).
   Vorgefuehrt rot (14.11.2026, je eine Kopie des Skripts mit einem
   Eingriff, Carrack in der Large-Halle, 5 von 5 Laeufen rot): die Halle
   ohne Eintrag in KLINKE_FEST; ihre vier Klinken ueber dem Gemessenen
   (4 FEHLER); Grenze 14 statt 16 (die 8 Programme mit 15 Texturen beim
   Namen); das Muster fuer das Modell verbogen („hat aber keines der
   Modelle ihrer Hallen fester Groesse geholt“); die Zeile zum Aufzug
   kommt nicht („weder die Zeile … noch …“, mit 1 min Frist statt 15).
   Die Meldungen stehen in der PR der Large-Halle.
   Halle des Schiffs (15.11.2026, Befund von CodeRabbit an PR #371): Ob
   das Schiff in der Halle steht, die die Seite fuer es nennt, verglich
   der Lauf nur nach --wechsel. Mit --ship anvl-carrack haette eine
   Seite, die die Carrack in der gestreckten Halle laesst, gruen gegen
   deren Klinken geendet. Jetzt vergleicht jeder Lauf nach dem Laden:
   die Halle, die hg-stage fuer das Schiff auf dem Feld nennt (wie hallOf
   der Seite), gegen die, die steht (eine Halle fester Groesse am
   geholten Modell, die gestreckte an der Zeile zur Hallendeko, die nur
   sie meldet). FEHLER, wenn es zwei sind, oder wenn eine der beiden
   nicht zu lesen ist. Mit --ship muss ausserdem dieses Schiff auf dem
   Feld stehen: Eine Kennung, die die Seite nicht kennt, zeigt das erste
   Schiff der Liste, und der Lauf pruefte gruen das falsche.
   Vorgefuehrt rot (15.11.2026, Kopie des Skripts mit einem Eingriff in
   das Skript der Seite auf dem Weg zum Browser: Sie nimmt fuer jedes
   Schiff die Halle der Seite und baut nie um; --ship anvl-carrack):
   „die Seite nennt fuer anvl-carrack die Halle util-lrgtop, es steht
   aber revelyork-single: das Schiff steht in der falschen Halle, und
   die Klinken dieses Laufs gelten der falschen“. Das Skript des Stands
   davor endete mit demselben Eingriff gruen. Und ohne Eingriff mit
   --ship gibt-es-nicht: „--ship gibt-es-nicht: auf dem Feld steht
   aegs-gladius: die Seite kennt diese Kennung nicht oder zeigt ein
   anderes Schiff, geprueft waere das falsche“.
   Nachfrage dazu (15.11.2026, selbe PR): Steht nach der ganzen Frist
   kein Schiff auf dem Feld, meldet ruhe() nur ihren Hinweis, und die
   Vergleiche oben fielen still aus. Seither ist das ein FEHLER, wie
   schon nach --wechsel; die Unruhe allein bleibt ein Hinweis.
   Vorgefuehrt rot (Kopie des Skripts mit 3 min Frist, ohne --wechsel;
   die Seite verliert data-live an der Leiste der Marken sofort
   wieder): „nach 3 min steht kein Schiff auf dem Feld (die Leiste der
   Marken traegt kein data-live): in welcher Halle es steht, ist
   ungeprueft“. Das Skript des Stands davor endete mit demselben
   Eingriff gruen, nur mit dem Hinweis zur Ruhe.
   Gesehen und offen: In einem von vier Laeufen linkten nach der
   gemeldeten Ruhe noch vier Programme ohne Namen (hoechstens eine
   Textur); ein Lauf ueber 15 min zaehlte 58 statt 54 Programme, keins
   ueber 15 Texturen. Ein Programm, das so spaet linkt, zaehlt der Lauf
   nicht.

     node scripts/check-hangar-shader.mjs --base http://localhost:4321
     node scripts/check-hangar-shader.mjs --base … --ship anvl-carrack
       (ein anderes Schiff als das erste der Liste; seit 25.10.2026 tragen
       alle Schiffe ihre echten Materialien, .planning/notes/hangar-alle-schiffe.md.
       Die Carrack steht seit 14.11.2026 in der Large-Halle: dieser Aufruf
       prueft deren Programme, siehe HALLEN FESTER GROESSE)
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
       Schiff (etwa drak-cutlass-black, Groesse M) waechst die Halle, und die
       Einrichtung wird neu gerechnet: der Weg, auf dem ein freigegebener
       Puffer oder ein freigegebenes Bild am ehesten noch einmal gebraucht
       wird. Mit einem Schiff, dessen Groesse eine Halle fester Groesse hat
       (anvl-carrack, bis 14.11.2026 das Beispiel fuers Wachsen), wechselt
       stattdessen die Halle: die alte wird abgebaut, die neue geladen. Dann
       wertet der Lauf jede Halle fuer sich (HALLEN FESTER GROESSE,
       Hallenwechsel). Gewartet wird, bis das Schiff auf dem Feld steht (die
       Leiste seiner Marken traegt data-live); die Zeile nennt dazu die
       Laenge des Wartungsplatzes danach, an der man sieht, ob die Halle
       gewachsen ist, oder den Hallenwechsel. FEHLER, wenn das Schiff nicht
       ankommt, oder wenn die Seite fuer das Schiff eine andere Halle nennt
       und die Buehne nicht wechselt
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
   Jedes Schiff des Laufs zaehlt (15.11.2026, Befund von CodeRabbit an
   PR #371): Bis dahin behielt der Lauf nur die erste Zeile, nach
   --wechsel blieb der Lack des zweiten Schiffs ungeprueft, auch der der
   neuen Buehne nach einem Hallenwechsel. Jetzt merkt er jede Zeile: die
   Klinke gilt weiter dem ersten Schiff, ohne Farbmittel darf keine
   Karte eines Schiffs bleiben, und nach einem Hallenwechsel muss die
   neue Buehne ihre eigene Zeile bringen.
   Vorgefuehrt rot (15.11.2026, Kopie des Skripts mit einem Eingriff in
   den Viewer auf dem Weg zum Browser, --wechsel anvl-carrack von der
   Gladius aus): ab dem zweiten Schiff meldet der Viewer drei Karten
   ohne Mittel („Schiff 2 des Laufs: 3 deckende Farbkarten ohne
   Farbmittel (Lack: 59 von 173 Materialien …)“; das Skript des Stands
   davor endete mit demselben Eingriff gruen); der Viewer meldet seinen
   Lack nur fuer das erste Schiff („seit dem Hallenwechsel meldet der
   Viewer keine Zeile "[hangar] Lack:": ob die Farbkarten des Schiffs
   in der neuen Halle ihr Mittel tragen, ist ungeprueft“).
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
// Hallen fester Groesse (hg-stage, halls: der Industrie-Bausatz, 14.11.2026) haben
// keine Hallendeko und noch keinen Wartungsplatz, also kein Programm mit
// Schichttafel, und ihre Bilder und Netze sind andere: jede traegt ihre eigenen
// Klinken (KLINKE_FEST). Welche Halle steht, sagt der Lauf an zwei Dingen:
// der Zeile "[hangar] Aufzug der Halle:" (nur eine Halle fester Groesse baut ihren
// Aufzug aus dem eigenen Modell) und dem Modell unter /hangar/hall/, das die Seite
// dafuer geholt hat. Eine Halle ohne Eintrag ist ein FEHLER: sonst liefe sie ohne
// Untergrenze, und ein Lauf, der sie halb erreicht, saehe gruen aus.
// lack haengt am Schiff und bleibt oben; ktx gilt ohne --ship und --layout und
// gehoert in den Eintrag der Halle, sobald das erste Schiff der Liste in ihr steht.
// util-lrgtop, gemessen 14.11.2026 auf hoch mit der Carrack (jeder Lauf gleich): 54
// Programme in Ruhe, keins mit Schichttafel (die Klinke steigt mit dem Wartungsplatz
// und den Werkszenen der Halle); 560 Bilder freigegeben (235 MB); 107 MB Geometrie
// in 1.640 Puffern; hoechstens 15 Texturen je Bildshader.
const KLINKE_FEST = {
  'util-lrgtop': { programme: 48, schichten: 0, frei: 500, geoMB: 95 },
};
// Eine Halle ohne Eintrag: der Lauf ist rot, und seine Zeilen nennen keine Klinke einer anderen Halle
const OHNE_KLINKEN = { programme: '—', schichten: '—', frei: '—', geoMB: '—', ktx: '—' };
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
let deko = '', aufzug = '', viewer = '', drinnen = '', frei = '', paesse = '', lack = '', geo = '', platz = '', ktx = '', ktxAus = '';
// Wie oft die Halle sich gemeldet hat (dekoN, aufzugN: jede Buehne meldet sich einmal) und bei welcher Zeile des
// Viewers eine Meldung zuletzt kam (kam): daran haengt nach einem Hallenwechsel, was der neuen Buehne gehoert
let dekoN = 0, aufzugN = 0;
const kam = {};
// Modelle unter /hangar/hall/, die die Seite geholt hat (welche Halle steht)
const hallen = new Set();
const verlangt = [], geoVerlangt = [], ktxFehlt = [];
// Jede Zeile "[hangar] Lack:" des Laufs (eine je Schiff, das eine Buehne laedt) mit der Zeile, bei der sie kam
const lacke = [];
const shaderFehler = [];
let zeilen = 0;
// Dateien des Hangars (Modelle, Bilder, Zwillinge), die angefordert und noch nicht da sind
const unterwegs = new Set();
page.on('request', (r) => { try { const p = new URL(r.url()).pathname; if (p.startsWith('/hangar/')) unterwegs.add(r); const h = /^\/hangar\/hall\/([a-z0-9-]+)\.glb$/.exec(p); if (h) hallen.add(h[1]); } catch { /* keine Adresse */ } });
page.on('requestfinished', (r) => unterwegs.delete(r));
page.on('requestfailed', (r) => unterwegs.delete(r));
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('[hangar]')) zeilen++;
  if (t.startsWith('[hangar] Hallendeko:')) { deko = t; dekoN++; }
  // nur die Zeile zur Plattform selbst (die Warnung zu ihrer Hoehe beginnt gleich)
  if (/^\[hangar\] Aufzug der Halle: Plattform \d+ Dreiecke/.test(t)) { aufzug = t; aufzugN++; }
  if (t.startsWith('[hangar] Texturen je Bildshader:')) { viewer = t; kam.viewer = zeilen; }
  if (t.startsWith('[hangar] Licht drinnen:') || t.startsWith('[hangar] Innenraum geladen:')) drinnen = drinnen ? `${drinnen} · ${t.slice(9)}` : t.slice(9);
  if (/THREE\.WebGLProgram: Shader Error/.test(t)) shaderFehler.push(t.split('\n')[0].slice(0, 200));
  if (t.startsWith('[hangar] Bilder nach dem Hochladen freigegeben:')) { frei = t; kam.frei = zeilen; }
  if (t.startsWith('[hangar] Vollbildpässe:')) { paesse = t; kam.paesse = zeilen; }
  if (t.startsWith('[hangar] Lack:')) { lacke.push({ t, bei: zeilen }); if (!lack) lack = t; }
  if (t.startsWith('[hangar] Wartungsplatz bei')) platz = t;
  if (t.startsWith('[hangar] Bild nach der Freigabe noch einmal verlangt')) verlangt.push(t.slice(9, 200));
  if (t.startsWith('[hangar] Geometrie nach dem Hochladen freigegeben:')) { geo = t; kam.geo = zeilen; }
  if (t.startsWith('[hangar] Geometrie nach der Freigabe noch einmal verlangt')) geoVerlangt.push(t.slice(9, 200));
  if (/^\[hangar\] Bild .* nicht geladen|Couldn't load texture/.test(t)) bildFehler.push(t.slice(0, 200));
  if (t.startsWith('[hangar] Texturen komprimiert:')) { ktx = t; kam.ktx = zeilen; }
  if (t.startsWith('[hangar] Texturen bleiben WebP:')) ktxAus = t;
  if (t.startsWith('[hangar] Zwilling ')) ktxFehlt.push(t.slice(9, 200));
});
const bildFehler = [];
const fehler = [];
// Die Klinken dieses Laufs (K) und ob die Halle steht: mit ihrer Deko, oder als Halle fester Groesse (fest) mit eigenen Klinken
let K = KLINKE, fest = '', steht = false;
// Hat --wechsel die Halle gewechselt: der Stand der ersten Halle davor (ihre Klinken, ihre Zeilen, ihre Programme)
let vor = null;
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
  // Hallen fester Groesse, wie die Seite sie mitgibt (hg-stage, halls)
  const feste = await frage('Hallen fester Groesse lesen', () => { try { return Object.values(JSON.parse(document.getElementById('hg-stage')?.textContent ?? '{}').halls ?? {}).map((h) => h.id); } catch { return []; } });
  while (!deko && !aufzug && Date.now() - t0 < WARTE_MS) {
    if (await frage('Warten auf die Halle', () => document.getElementById('hg-fallback')?.hidden === false)) { fehler.push('die Seite zeigt ihren Rueckfall statt der Halle'); break; }
    await page.waitForTimeout(2000);
  }
  if (!deko && !aufzug && !fehler.length) fehler.push(`nach ${WARTE_MS / 60000} min weder die Zeile "[hangar] Hallendeko:" noch, fuer eine Halle fester Groesse, "[hangar] Aufzug der Halle:"`);
  if (deko) console.log(`  Hallendeko nach ${Math.round((Date.now() - t0) / 1000)} s`);
  else if (aufzug) {
    // Die Halle, deren Modell die Seite geholt hat; ohne eines davon steht keine Halle fester Groesse
    fest = feste.find((id) => hallen.has(id)) ?? '';
    console.log(`  Halle fester Groesse ${fest || '—'}: ihr Aufzug nach ${Math.round((Date.now() - t0) / 1000)} s`);
    if (!fest) fehler.push(`die Seite meldet "[hangar] Aufzug der Halle:", hat aber keines der Modelle ihrer Hallen fester Groesse geholt (hg-stage nennt ${feste.join(', ') || 'keine'}; geholt: ${[...hallen].join(', ') || 'keins'}): welche Halle steht, ist unbekannt`);
    else if (!KLINKE_FEST[fest]) { fehler.push(`die Halle ${fest} hat keine eigenen Klinken (KLINKE_FEST): ohne Untergrenze saehe ein Lauf, der sie nur halb erreicht, gruen aus`); K = OHNE_KLINKEN; }
    else K = KLINKE_FEST[fest];
  }
  steht = Boolean(deko || (aufzug && K !== KLINKE && K !== OHNE_KLINKEN));
  if (steht) await ruhe('Laden', true);
  // Steht ein Schiff, traegt die Leiste seiner Marken data-live und seine Kennung
  // (syncMarks in hangar-overview.js, nach viewer.show()). Die Zeile "[hangar] Lack:"
  // taugt dafuer nicht: sie kommt, sobald das Modell geladen ist, in Software-WebGL
  // gut eine Minute, bevor die Halle gewachsen ist und das Schiff auf dem Feld steht.
  const aufDemFeld = () => frage('steht das Schiff', () => { const r = document.querySelector('[data-bay="marks"]'); return r?.hasAttribute('data-live') ? r.dataset.id : ''; }).catch((e) => { if (e instanceof Haengt) throw e; return ''; });
  // Die Halle, die die Seite fuer ein Schiff nennt (hallOf in hangar-overview.js: die seiner Stufe, sonst die der Seite)
  const halleVon = (schiff) => frage('Halle des Schiffs', (id) => { try { const j = JSON.parse(document.getElementById('hg-stage')?.textContent ?? '{}'), m = j.models?.[id]; return (m && m[3] === 'halle' && m[4] && j.halls?.[m[4]]?.id) || j.opts?.hall?.id || ''; } catch { return ''; } }, schiff);
  // Steht die Halle, die die Seite fuer das Schiff auf dem Feld nennt (HALLEN FESTER GROESSE, Halle
  // des Schiffs)? Welche steht, sagt die Buehne selbst: eine Halle fester Groesse am geholten Modell
  // (fest), die gestreckte an der Zeile zur Hallendeko, die nur sie meldet; sie ist die der Seite.
  if (steht) {
    const schiff = await aufDemFeld();
    const soll = schiff ? await halleVon(schiff) : '';
    const ist = fest || (deko ? await frage('Halle der Seite', () => { try { return JSON.parse(document.getElementById('hg-stage')?.textContent ?? '{}').opts?.hall?.id || ''; } catch { return ''; } }) : '');
    console.log(`  Halle des Schiffs: ${schiff || 'kein Schiff auf dem Feld'}${schiff ? `, die Seite nennt ${soll || 'keine'}, es steht ${ist || 'unbekannt'}` : ''}`);
    // Ohne Schiff auf dem Feld gibt es nichts zu vergleichen: ruhe() hat dann die ganze Frist auf es gewartet und
    // meldet das nur als Hinweis (die Halle kam nicht zur Ruhe). Fuer diesen Lauf ist es ein FEHLER, wie nach --wechsel.
    if (!schiff) fehler.push(`nach ${WARTE_MS / 60000} min steht kein Schiff auf dem Feld (die Leiste der Marken traegt kein data-live): in welcher Halle es steht${SHIP ? ` und ob es ${SHIP} ist` : ''}, ist ungeprueft`);
    // mit --ship muss auch dieses Schiff stehen: Eine Kennung, die die Seite nicht kennt, zeigt das erste der Liste
    if (SHIP && schiff && schiff !== SHIP) fehler.push(`--ship ${SHIP}: auf dem Feld steht ${schiff}: die Seite kennt diese Kennung nicht oder zeigt ein anderes Schiff, geprueft waere das falsche`);
    if (schiff && !(soll && ist)) fehler.push(`welche Halle die Seite fuer ${schiff} nennt (${soll || 'keine'}) oder welche steht (${ist || 'unbekannt'}), ist aus hg-stage nicht zu lesen: ob das Schiff in seiner Halle steht, ist ungeprueft`);
    else if (schiff && soll !== ist) fehler.push(`die Seite nennt fuer ${schiff} die Halle ${soll}, es steht aber ${ist}: das Schiff steht in der falschen Halle, und die Klinken dieses Laufs gelten der falschen`);
  }
  if (steht && WECHSEL) {
    const t1 = Date.now(), vorher = await frage('--wechsel', () => window.__texProgramme.length);
    const stand = { K, frei, geo, ktx, n: vorher, dekoN, aufzugN, zeilen };
    let erst = '', dann = '', kam1 = 0, h0 = '', h1 = '';
    while (!(erst = await aufDemFeld()) && Date.now() - t1 < WARTE_MS) await page.waitForTimeout(2000);
    if (!erst) fehler.push(`--wechsel: nach ${WARTE_MS / 60000} min steht das erste Schiff nicht (die Leiste der Marken traegt kein data-live)`);
    else if (erst === WECHSEL) fehler.push(`--wechsel ${WECHSEL}: dieses Schiff steht schon, ein Wechsel findet nicht statt`);
    else {
      await frage('--wechsel, Schiff waehlen', (id) => { const u = new URL(location.href); u.searchParams.set('ship', id); history.pushState(null, '', u); dispatchEvent(new PopStateEvent('popstate')); }, WECHSEL);
      while ((dann = await aufDemFeld()) !== WECHSEL && Date.now() - t1 < WARTE_MS) await page.waitForTimeout(2000);
      if (dann !== WECHSEL) fehler.push(`--wechsel: nach ${WARTE_MS / 60000} min steht ${WECHSEL} nicht auf dem Feld (kein Schiff mit dieser Kennung, oder das Modell laedt nicht)`);
      else {
        kam1 = Date.now() - t1;
        await ruhe(`Wechsel auf ${WECHSEL}`, true);
        // Nennt die Seite fuer das neue Schiff eine andere Halle, hat sie die Buehne umgebaut (umbauen in
        // hangar-overview.js): Was der Viewer danach meldet, gehoert der neuen Halle und wird gegen deren
        // Klinken gewertet, der Stand davor gegen die der ersten. Belegt wird der Wechsel an der Buehne
        // selbst: eine Halle fester Groesse am geholten Modell und einer neuen Zeile zu ihrem Aufzug, die
        // gestreckte Halle an einer neuen Zeile zur Hallendeko.
        h0 = await halleVon(erst); h1 = await halleVon(WECHSEL);
        if (h0 && h1 && h0 !== h1) {
          const neuFest = feste.includes(h1);
          if (neuFest ? !(hallen.has(h1) && aufzugN > stand.aufzugN) : !(dekoN > stand.dekoN)) {
            fehler.push(`--wechsel: die Seite nennt fuer ${WECHSEL} die Halle ${h1} (fuer ${erst}: ${h0}), aber ${neuFest ? `${hallen.has(h1) ? 'die Zeile "[hangar] Aufzug der Halle:" kam nach dem Wechsel nicht' : 'ihr Modell unter /hangar/hall/ wurde nicht geholt'}` : 'die Zeile "[hangar] Hallendeko:" kam nach dem Wechsel nicht'}: die Halle hat nicht gewechselt, das Schiff steht in der falschen`);
            h1 = h0;
          } else {
            vor = { ...stand, halle: h0 };
            fest = neuFest ? h1 : '';
            // Zeilen, die die neue Buehne nicht selbst gemeldet hat, gelten fuer sie nicht (die der alten blieben sonst stehen)
            if (!(kam.frei > stand.zeilen)) frei = '';
            if (!(kam.geo > stand.zeilen)) geo = '';
            if (!(kam.ktx > stand.zeilen)) ktx = '';
            if (!(kam.viewer > stand.zeilen)) viewer = '';
            if (!(kam.paesse > stand.zeilen)) paesse = '';
            if (neuFest && !KLINKE_FEST[h1]) { fehler.push(`die Halle ${h1} hat keine eigenen Klinken (KLINKE_FEST): ohne Untergrenze saehe ein Lauf, der sie nur halb erreicht, gruen aus`); K = OHNE_KLINKEN; steht = false; }
            else K = neuFest ? KLINKE_FEST[h1] : KLINKE;
          }
        }
      }
    }
    console.log(`  Wechsel von ${erst || '—'} auf ${WECHSEL}: ${dann === WECHSEL ? `steht nach ${Math.round(kam1 / 1000)} s` : 'nicht angekommen'}; ${vor ? `Halle gewechselt von ${h0} auf ${h1}` : platz ? platz.slice(9).split(':')[0] : 'keine Zeile zum Wartungsplatz'}; Programme dazu: ${(await frage('--wechsel', () => window.__texProgramme.length)) - vorher}`);
  }
  if (steht && INNEN) {
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
// Nach einem Hallenwechsel zaehlen fuer die Klinken der Halle am Ende nur die Programme seit dem Wechsel
const seit = progs.slice(vor ? vor.n : 0);
const max = progs.reduce((a, p) => Math.max(a, p.n), 0), schichten = seit.filter((p) => p.schichten).length;
const oben = [...progs].sort((a, b) => b.n - a.n).slice(0, 4).map((p) => `${p.name} ${p.n}`).join(', ');
if (vor) {
  // Die erste Halle, wie sie vor dem Wechsel stand, gegen ihre eigenen Klinken
  const n = progs.slice(0, vor.n), s = n.filter((p) => p.schichten).length, wo = `vor dem Hallenwechsel (${vor.halle})`, mitKtx = !SHIP && !LAYOUT;
  const f = Number(/freigegeben: (\d+) /.exec(vor.frei)?.[1] ?? NaN), g = Number(/ mit (\d+) MB/.exec(vor.geo)?.[1] ?? NaN), k = Number(/komprimiert: (\d+) /.exec(vor.ktx)?.[1] ?? NaN);
  console.log(`  Vor dem Hallenwechsel (${vor.halle}): ${n.length} Programme (Klinke ${vor.K.programme}), ${s} mit Schichttafel (Klinke ${vor.K.schichten}), ${f} Bilder freigegeben (Klinke ${vor.K.frei}), ${g} MB Geometrie freigegeben (Klinke ${vor.K.geoMB})${mitKtx ? `, ${k} Bilder aus komprimierten Zwillingen (Klinke ${vor.K.ktx ?? '—'})` : ''}`);
  if (n.length < vor.K.programme) fehler.push(`${wo}: nur ${n.length} Programme gelinkt, Klinke ${vor.K.programme}`);
  if (s < vor.K.schichten) fehler.push(`${wo}: nur ${s} Programme mit Schichttafel, Klinke ${vor.K.schichten}: Wartungsplatz oder Deko nicht uebersetzt`);
  if (!(f >= vor.K.frei)) fehler.push(`${wo}: der Viewer gab ${Number.isFinite(f) ? `nur ${f}` : 'keine'} Bilder nach dem Hochladen frei, Klinke ${vor.K.frei}`);
  if (!(g >= vor.K.geoMB)) fehler.push(`${wo}: der Viewer gab ${Number.isFinite(g) ? `nur ${g} MB` : 'keine'} Geometrie nach dem Hochladen frei, Klinke ${vor.K.geoMB} MB`);
  if (mitKtx && !(k >= vor.K.ktx)) fehler.push(vor.K.ktx === undefined ? `${wo}: die Halle hat keine Klinke ktx (KLINKE_FEST), und dieser Lauf (ohne --ship und --layout) braucht sie: ${k} Bilder aus komprimierten Zwillingen gemessen` : `${wo}: nur ${k} Bilder aus komprimierten Zwillingen, Klinke ${vor.K.ktx}`);
}
console.log(`  Programme gelinkt: ${progs.length}${vor ? `, davon ${seit.length} seit dem Hallenwechsel` : ''} (Klinke ${K.programme}), davon mit Schichttafel: ${schichten} (Klinke ${K.schichten})`);
console.log(`  hoechstens ${max} Texturen; die meisten: ${oben || '—'}`);
console.log(`  ${fest ? `Halle fester Groesse ${fest}, ohne Hallendeko: ${aufzug.slice(9, 100)}` : deko ? deko.slice(9, 100) : 'Hallendeko: —'}`);
console.log(`  Viewer meldet: ${viewer ? viewer.slice(9) : '—'}`);
for (const p of ueber) fehler.push(`${p.name} braucht ${p.n} Texturen, Grenze ${GRENZE}: unter Windows unsichtbar`);
for (const p of kaputt) fehler.push(p.zaehlung ? `Zaehlung eines Programms fehlgeschlagen (${p.zaehlung}): ungeprueft` : `${p.name} linkt nicht`);
for (const s of shaderFehler) fehler.push(s);
for (const b of bildFehler.slice(0, 10)) fehler.push(b);
const freiN = Number(/freigegeben: (\d+) /.exec(frei)?.[1] ?? NaN);
console.log(`  Bilder: ${frei ? frei.slice(9, 160) : 'keine Zeile zur Freigabe'} (Klinke ${K.frei}); noch einmal verlangt: ${verlangt.length}`);
for (const v of verlangt.slice(0, 10)) fehler.push(v);
if (verlangt.length > 10) fehler.push(`… und ${verlangt.length - 10} weitere freigegebene Bilder noch einmal verlangt`);
if (steht && !(freiN >= K.frei)) fehler.push(`der Viewer gibt ${Number.isFinite(freiN) ? `nur ${freiN}` : 'keine'} Bilder nach dem Hochladen frei, Klinke ${K.frei}: die ausgepackten Bilder bleiben im Arbeitsspeicher (rund 1 GB in der hohen Stufe)`);
const geoN = Number(/freigegeben: (\d+) Puffer/.exec(geo)?.[1] ?? NaN), geoMB = Number(/ mit (\d+) MB/.exec(geo)?.[1] ?? NaN);
console.log(`  Geometrie: ${geo ? geo.slice(9, 160) : 'keine Zeile zur Freigabe'} (Klinke ${K.geoMB} MB); noch einmal verlangt: ${geoVerlangt.length}`);
for (const v of geoVerlangt.slice(0, 10)) fehler.push(v);
if (geoVerlangt.length > 10) fehler.push(`… und ${geoVerlangt.length - 10} weitere freigegebene Puffer noch einmal verlangt`);
if (steht && !(geoMB >= K.geoMB)) fehler.push(`der Viewer gibt ${Number.isFinite(geoMB) ? `nur ${geoMB} MB Geometrie in ${geoN} Puffern` : 'keine Geometrie'} nach dem Hochladen frei, Klinke ${K.geoMB} MB: die Kopien der Netze der Halle bleiben im Arbeitsspeicher (rund 160 MB in der hohen Stufe)`);
console.log(`  ${paesse ? paesse.slice(9, 160) : 'Vollbildpässe: keine Zeile'}`);
if (/erst beim Probebild/.test(paesse)) fehler.push(`${paesse.slice(9, 160)}: der Schluessel des vorab uebersetzten Programms passt nicht zum Pass, die Seite steht beim Laden, bis sie uebersetzt sind`);
else if (steht && !/^\[hangar\] Vollbildpässe: \d+ Shader vorab übersetzt/.test(paesse)) fehler.push('der Viewer meldet keine Zeile "[hangar] Vollbildpässe: … Shader vorab übersetzt": die Nachbearbeitung (Verdeckung, Schein) steht nicht, oder ihre Shader werden nicht mehr vorab uebersetzt');
const lackMit = Number(/\((\d+) mit gemessener Farbkarte/.exec(lack)?.[1] ?? NaN), lackOhne = Number(/, (\d+) ohne Farbmittel\)/.exec(lack)?.[1] ?? NaN);
console.log(`  Farbmittel: ${lack ? `${lackMit} Materialien des Schiffs mit gemessener Farbkarte${SHIP || LAYOUT ? '' : ` (Klinke ${KLINKE.lack})`}, ${lackOhne} Farbkarten ohne Mittel` : 'keine Zeile "[hangar] Lack:"'}`);
if (steht && !lack) fehler.push('der Viewer meldet keine Zeile "[hangar] Lack:" mehr: ob die Farbkarten des Schiffs ihr Mittel tragen, ist ungeprueft');
else if (steht && !(lackOhne === 0)) fehler.push(`${Number.isFinite(lackOhne) ? lackOhne : 'unbekannt viele'} deckende Farbkarten des Schiffs ohne Farbmittel: das Schiff laedt ueber einen Loader, der nicht misst (images(false), HALL_FILES), und der dunkelste Lack wird nicht mehr angehoben`);
else if (steht && !SHIP && !LAYOUT && !(lackMit >= KLINKE.lack)) fehler.push(`nur ${lackMit} Materialien des Schiffs mit gemessener Farbkarte, Klinke ${KLINKE.lack}`);
// Jedes weitere Schiff des Laufs (--wechsel) meldet seinen Lack selbst: die Klinke oben gilt dem ersten,
// ohne Farbmittel darf keines bleiben, und nach einem Hallenwechsel muss die neue Buehne ihre Zeile bringen
// (die der alten sagt nichts darueber, ob die neue ihr Schiff ueber einen Loader holt, der misst).
const lackNeu = vor ? lacke.filter((l) => l.bei > vor.zeilen) : [];
if (lacke.length > 1 || vor) console.log(`  Farbmittel, alle Schiffe des Laufs: ${lacke.length} Zeilen${vor ? `, davon ${lackNeu.length} seit dem Hallenwechsel` : ''}; ohne Farbmittel je Zeile: ${lacke.map((l) => /, (\d+) ohne Farbmittel\)/.exec(l.t)?.[1] ?? '?').join(', ') || '—'}`);
lacke.slice(1).forEach((l, i) => {
  const ohne = Number(/, (\d+) ohne Farbmittel\)/.exec(l.t)?.[1] ?? NaN);
  if (steht && !(ohne === 0)) fehler.push(`Schiff ${i + 2} des Laufs: ${Number.isFinite(ohne) ? ohne : 'unbekannt viele'} deckende Farbkarten ohne Farbmittel (${l.t.slice(9, 200)})`);
});
if (steht && vor && !lackNeu.length) fehler.push('seit dem Hallenwechsel meldet der Viewer keine Zeile "[hangar] Lack:": ob die Farbkarten des Schiffs in der neuen Halle ihr Mittel tragen, ist ungeprueft');
const ktxN = Number(/komprimiert: (\d+) /.exec(ktx)?.[1] ?? NaN), ktxOhne = Number(/aus dem WebP: (\d+)$/.exec(ktx)?.[1] ?? NaN);
// Die Klinke ktx gilt mit dem ersten Schiff der Liste: nicht mit --ship und --layout, und nicht in der Halle nach einem Hallenwechsel
const mitKtx = !SHIP && !LAYOUT && !vor;
console.log(`  Komprimiert: ${ktx ? ktx.slice(9, 160) : ktxAus ? ktxAus.slice(9, 160) : 'keine Zeile zu den komprimierten Texturen'}${mitKtx ? ` (Klinke ${K.ktx ?? '—'})` : ''}`);
for (const z of ktxFehlt.slice(0, 5)) fehler.push(z);
if (ktxAus) fehler.push(`${ktxAus.slice(9, 200)}: jede Textur liegt unkomprimiert bei der Grafikkarte`);
else if (steht && !ktx) fehler.push('der Viewer meldet keine Zeile "[hangar] Texturen komprimiert:": er laedt kein Bild aus seinem komprimierten Zwilling (ktxTwin in assets/hangar-viewer.js), jede Textur liegt unkomprimiert bei der Grafikkarte');
else if (steht && !(ktxOhne === 0)) fehler.push(`${Number.isFinite(ktxOhne) ? ktxOhne : 'unbekannt viele'} Bilder ohne ladbaren Zwilling kamen aus dem WebP und liegen unkomprimiert bei der Grafikkarte (verify:hangar-ktx prueft die Dateien in dist/)`);
else if (steht && mitKtx && !(ktxN >= K.ktx)) fehler.push(K.ktx === undefined ? `die Halle ${fest} hat keine Klinke ktx (KLINKE_FEST), und dieser Lauf (ohne --ship und --layout) braucht sie: ${ktxN} Bilder aus komprimierten Zwillingen gemessen` : `nur ${ktxN} Bilder aus komprimierten Zwillingen, Klinke ${K.ktx}`);
if (bildFehler.length) console.log(`  Bilder nicht geladen: ${bildFehler.length}`);
if (steht && seit.length < K.programme) fehler.push(`nur ${seit.length} Programme ${vor ? 'seit dem Hallenwechsel ' : ''}gelinkt, Klinke ${K.programme}`);
if (steht && schichten < K.schichten) fehler.push(`nur ${schichten} Programme mit Schichttafel, Klinke ${K.schichten}: Wartungsplatz oder Deko nicht uebersetzt`);
if (steht && !viewer) fehler.push('der Viewer meldet keine Zeile "[hangar] Texturen je Bildshader" mehr');

for (const u of unruhig) console.log(`  HINWEIS: keine Ruhe (${u}): der Lauf wertet einen Zwischenstand aus`);
if (fehler.length) {
  console.error(`\ncheck-hangar-shader: ${fehler.length} FEHLER\n`);
  if (unruhig.length) console.error('  Die Halle kam in diesem Lauf nicht zur Ruhe (HINWEIS oben). Dann koennen die Klinken zu Programmen, Bildern, Geometrie und Texturen reissen, ohne dass am Hangar etwas fehlt: erst auf einem schnelleren Rechner wiederholen.\n');
  for (const f of fehler) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\ncheck-hangar-shader: kein Bildshader ueber der Grenze, kein freigegebenes Bild und kein freigegebener Puffer noch einmal verlangt, Vollbildpaesse vorab uebersetzt, Farbkarten des Schiffs mit Mittel, jedes Bild aus seinem komprimierten Zwilling ✓\n');
