/* ============================================================
   verify-hangar-hallen.mjs — die Hallen fester Größe: je Hangargröße die
   Halle, die das Spiel für sie baut (Industrie-Bausatz), gegen dist/.

   WARUM ES DAS GIBT (14.11.2026): Krisz: „Baue mal alle Gangarten
   vollständig aus in vollste Tiefe, Assets Textur Materialien Szene npc ui
   deko alles“, als Baustil wählte er „Industrie wie Lorville und Area18“.
   Seither lädt die Seite je Schiff die Halle seiner Stufe (StageConfig
   halls, HALL_FEST im Viewer). verify:hangar-hall misst nur die Halle der
   Seite (Revel & York) mit ihrem Schacht und ihrer Werkstatt; von einer
   Halle fester Größe weiß es nichts. Was an der ersten (Large) brach, sah
   man jedes Mal erst im Bild:

   - Der Boden. Der Build lotet die Höhe des Bodens am geschriebenen Modell
     (floor im Manifest), die Bühne setzt die Halle danach. Als die Halle
     ihren eigenen Aufzug bekam, traf das Lot die Plattform statt der
     Torflügel darunter, der Boden stieg von 2,25 auf 2,501, und alles, was
     gegen die alte Höhe vermessen war, stand 25 cm zu hoch: Das Fenster des
     Terminals ragte über den Rahmen seines Bildschirms (verify:hangar-orte
     [8] fand es am Modell). [2] hält darum Boden, Plattform, Landefläche
     und Bahnen des Aufzugs am ausgelieferten Modell gegeneinander.
   - Schirme ohne Bild standen leuchtend weiß am Eingang, Schilder trugen
     in der leichteren Stufe des Spiels nur einen Teil ihrer Buchstaben
     (4 von 27 an der Tafel über dem Tor). [3] zählt beides am Modell.
   - Der Bau schnitt für die Halle eine Einrichtungsdatei mit, die die
     Seite nie lädt. [4] hält den Ordner frei davon.

   Geprüft wird jede Halle, die beide Hangarseiten als Halle einer Stufe
   ausliefern (hg-stage, halls). Welche Hallen es gibt, nennt der Viewer
   (HALL_FEST); eine, die dieser Bau nicht ausliefert, wird genannt und
   ist kein FEHLER (ihr Modell liegt dann noch nicht im Repo). Dass keine
   wieder verschwindet, hält die Klinke MIN_HALLEN.

   [1] Seite: je Stufe die Halle, die HALL_FEST für sie nennt, in beiden
       Sprachen gleich, mit Modell, Lampen und Aufzug in dist/, so groß,
       wie Seite und Manifest sagen
   [2] Modell: der Boden der Seite ist der, den das Lot am ausgelieferten
       Modell trifft; die Plattform liegt auf dieser Höhe; Landefläche,
       Feld des Aufzugs und Raum liegen ineinander; jede Bahn hat ihren
       Knoten
   [3] Bestand: Schrift, Schirme und die Zahlen des Manifests über ihren
       Klinken und unter ihren Obergrenzen (darunter die eingehängten
       Kind-Container: Frachtaufzüge und Türen); die Lampen aus der
       ausgelieferten Datei, so viele, wie das Manifest nennt, jede
       vollständig, und gezählt wird gegen die Klinke, was die Bühne
       davon nach ihrer eigenen Regel setzt (hallLampeGilt im Viewer)
   [4] Kein Ballast: keine Einrichtungs-, Telefon- oder zweite Stufe einer
       solchen Halle in dist/, und keine Datei mit Bahnen eines Aufzugs,
       die keine Hangarseite nennt

   Schiene A: liest dist/ und für [3] das Manifest
   src/data/hangar-assets.json. Kein git, kein Netz, kein Kindprozess. Im
   Live-Bau gibt es keinen Hangar (nurMitHangar in der Registry).

   VORGEFUEHRT ROT (14.11.2026, a bis i am PC gegen die gebaute
   Large-Halle, bevor ihr Modell im Repo lag; k im Cloud-Rechner gegen den
   Vorschau-Bau mit ihr). Jede Gegenprobe verändert dist/ (b eine Kopie des
   Skripts, k dazu das Manifest) und stellt danach zurück; der Lauf danach
   war grün:
   (a) Einrichtungsdatei der Halle in dist/: „[4] dist/hangar/hall/ traegt
       util-lrgtop.furniture.glb: Die Seite laedt fuer eine Halle fester
       Groesse nur ihr Modell …“. So stand es ungestellt auch im ersten
       Lauf, bevor build-hall-furniture die Halle ausließ (dazu
       util-lrgtop.patch.glb).
   (b) Klinke der Schrift ein Dreieck über dem Modell: „[3] util-lrgtop:
       das Modell traegt 2089 Dreiecke Schrift, Klinke 2090 …“
   (c) beide Seiten nennen den Boden der ersten Fassung (floor 2.25):
       „[2] … das Lot trifft den Boden des ausgelieferten Modells bei
       2.501, die Seite nennt 2.25 … stuende um 0.251 m daneben“, „[2] …
       die Oberseite der Plattform liegt im Modell bei 2.5, der Boden der
       Seite bei 2.25 …“, „[3] … das Manifest nennt den Boden bei 2.501,
       die Seite bei 2.25“
   (d) die Bahnen nennen für die Plattform den Knoten aufzug_pax: „[2] …
       1 Bahn(en) ohne Knoten mit Netz im Modell (aufzug_pax) …“
   (e) util-lrgtop.lights.json aus dist/ genommen: „[1] util-lrgtop: die
       Lampen des Spiels (lights: …) fehlt in dist/ …“
   (f) HALL_FEST.pad.from -100 statt -108: „[2] … die Landeflaeche (Mitte
       -68, 112) sitzt nicht mitten im Feld des Aufzugs (Mitte -72.001,
       112) …“
   (g) ein Schirm ohne Bild hell (Grundfarbe 0.9 im JSON der GLB, gleich
       viele Zeichen, die Datei bleibt gleich groß): „[3] … das Modell
       traegt 188 Dreiecke ausgeschalteter Schirme (9 Materialien …),
       Klinke 196 …“ und „[3] … 1 Schirm(e) ohne Bild sind hell:
       lowtech_alpha_prop_screens_02_mtl_screen_01_03 (0.9, 0.9, 0.9, 8
       Dreiecke) …“
   (h) nur de/hangar.html nennt floor 2.25: „[1] hangar.html und
       de/hangar.html liefern verschiedene Hallen aus (Stufe L: floor) …“
   (i) screen_off_01_mtl__00 umgefärbt (hinter „_mtl_“ weist sein Name es
       nicht als Schirm aus): „[3] … 142 Dreiecke ausgeschalteter Schirme
       (9 Materialien …), Klinke 196 …“
   (k) 14.11.2026, mit den Frachtaufzügen im Modell (Kind-Container,
       scripts/lib/hall-kinder.mjs) und den Klinken dafür: die Halle des
       Stands davor, ohne die beiden Aufzüge (Modell, Lampen und Manifest
       getauscht, `bytes` der Seiten angepasst), 7 FEHLER: „[3] … 196
       Dreiecke ausgeschalteter Schirme …, Klinke 244 …“, „[3] … 2089
       Dreiecke Schrift, Klinke 2337 …“, „[3] … 678 Lampen des Spiels,
       Klinke 798“, „[3] … 10 vom Build ausgeschaltete Schirme, Klinke
       13“, „[3] … 7 Tafeln mit dem Logo des Betreibers, Klinke 9“, „[3] …
       130 Netze mit Aufklebern, Klinke 148“, „[3] … 1.27 % Blickstrahlen
       ins Leere, Obergrenze 0.3 …“ (an der Stelle jedes Aufzugs stand ein
       Loch von 48 x 32 m in der Längswand). Die Zahlen in (b), (g) und (i)
       sind die ihres Tages, vor den Aufzügen.
   (l) 14.11.2026, Befund von CodeRabbit an PR #371: Die Klinke der Lampen
       las ihre Zahl aus dem Manifest, die ausgelieferte Lampendatei
       wurde nur auf ihr Dasein geprüft. Mit einer leeren Liste in
       dist/hangar/hall/util-lrgtop.lights.json ({"v":2,"lights":[]})
       blieb das Tor grün („798 Lampen“), und die Halle hätte mit dem
       Bühnenlicht gestanden. Seither liest [3] die Datei selbst, an
       ihr fünfmal gebrochen:
       leere Liste: „[3] … die ausgelieferte Lampendatei traegt 0
       Lampen, das Manifest nennt 798 …“ und „[3] … 0 Lampen des
       Spiels, Klinke 798“;
       Fassung 1 statt 2: „[3] … nennt die Fassung 1, die Buehne nimmt
       Lampen erst ab Fassung 2 …“;
       einer Lampe den Ort genommen: „[3] … 1 von 798 Lampen der
       ausgelieferten Datei sind unvollstaendig …“ und „[3] … 797 Lampen
       des Spiels, die die Buehne setzt …, Klinke 798“ (Wortlaut seit m);
       nach 5000 Zeichen abgeschnitten: „[3] … die ausgelieferte
       Lampendatei laesst sich nicht lesen …“;
       auf 700 Lampen gekürzt: „[3] … traegt 700 Lampen, das Manifest
       nennt 798 …“ und „[3] … 700 Lampen des Spiels, Klinke 798“.
   (m) 14.11.2026, zweite Runde desselben Reviews: (l) zählte jeden
       wohlgeformten Eintrag. Die Bühne lässt aber Umgebungslicht,
       Einträge ohne Stärke und Flächenlicht unter 1 m weg; mit 798
       Einträgen der Art „ambient“ blieb das Tor von (l) grün, und die
       Halle hätte mit dem Bühnenlicht gestanden. Das Tor zählt seither
       mit der Regel des Viewers selbst (hallLampeGilt, aus dem
       ausgelieferten Modul), fünfmal gebrochen:
       alle 798 Einträge „ambient“: „[3] … 0 Lampen des Spiels, die die
       Buehne setzt (von 798 in der ausgelieferten Datei; 798 laesst sie
       weg: Umgebungslicht, ohne Staerke oder Flaechenlicht unter 1 m),
       Klinke 798“;
       die 50 Flächenlichter auf 0,5 m Reichweite: „[3] … 748 Lampen …
       (… 50 laesst sie weg …), Klinke 798“;
       einer Lampe die Stärke 0: „[3] … 797 Lampen … (… 1 laesst sie weg
       …), Klinke 798“;
       im ausgelieferten Viewer wählt loadHallLights wieder mit eigener
       Regel: „[3] … die Buehne waehlt ihre Lampen nicht mehr mit
       hallLampeGilt aus (loadHallLights) …“;
       der ausgelieferte Viewer gibt hallLampeGilt nicht mehr heraus:
       „[3] … der Viewer nennt nicht mehr, welche Lampen er setzt …“.
   (n) 14.11.2026, dritte Runde desselben Reviews: Die Seite nannte die
       Bahnen des Aufzugs, sobald die Datei <halle>.aufzug.json auf der
       Platte lag, auch wenn der letzte Bau der Halle keinen Aufzug mehr
       gemeldet hatte; die Datei eines früheren Baus blieb liegen. Jetzt
       fragt die Seite das Manifest (aufzugOf in HangarApp.astro), der
       Bau räumt die Datei weg, wenn er keinen Aufzug baut, und [4] hält
       den Ordner frei davon. Zweimal gebrochen:
       eine zweite Datei util-medtop.aufzug.json in dist/hangar/hall/:
       „[4] dist/hangar/hall/ traegt util-medtop.aufzug.json, und keine
       Hangarseite nennt sie: der Rest eines frueheren Baus …“;
       das Manifest ohne den Eintrag aufzug der Large-Halle, die Datei
       liegt weiter in public/, neu gebaut: Die Seite nennt sie nicht
       mehr, 3 FEHLER: „[1] util-lrgtop: die Bahnen ihres Aufzugs
       (aufzug: nicht genannt) fehlt in dist/ …“, „[1] nur 0 Halle(n)
       fester Groesse ausgeliefert, Klinke 1“ und „[4] dist/hangar/hall/
       traegt util-lrgtop.aufzug.json, und keine Hangarseite nennt sie
       …“.
   (o) 15.11.2026, mit den Türen der neun Personenaufzüge und der
       Abgabe-Nische im Modell und der Klinke kinder (der Build zählt die
       eingehängten Kind-Container am Rohmodell, kinderBestand in
       scripts/lib/hall-kinder.mjs), am Vorschau-Bau im Cloud-Rechner;
       verändert wurde das Manifest, danach zurückgestellt. Zweimal
       gebrochen:
       ohne den Eintrag kinder (so nennt es jeder Bau vor diesem Stand):
       „[3] util-lrgtop: keine Kind-Container mit Geometrie eingehaengt
       (das Manifest nennt keinen; …), Klinke 14“;
       mit den Zahlen der Halle ohne ihre Türen (kinder 4: die beiden
       Frachtaufzüge und ihre Kabinen; 148 Netze mit Aufklebern), 2
       FEHLER: „[3] … 148 Netze mit Aufklebern, Klinke 150“ und „[3] … 4
       Kind-Container mit Geometrie eingehaengt
       (elev_util_cargo_hangar_lrg_a 2,
       hangar_component_module_cargo_elevator_lrg 2; …), Klinke 14“.
   KONTROLLE, bleibt grün: das Gehäuse
   comms_screenroom_large_screens_1_mtl_plastic_black_02 hell (0.9). Die
   erste Fassung zählte jedes Material mit „screen“ im Namen und meldete
   hier „1 Schirm(e) ohne Bild sind hell“.
   Ungestellt rot war außerdem die erste Fassung der Schrift-Regel („114
   Dreiecke Schrift ohne Schnitt nach dem Alpha ihrer Karte“): Zwei
   Wandschriften mischt das Spiel (BLEND, Alpha 0,6). Die Regel verlangt
   seither nur, dass keine deckend oder ohne Farbkarte gezeichnet wird.

     node scripts/verify-hangar-hallen.mjs
   ============================================================ */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { floorLevel } from './lib/hall-hull.mjs';
import { SCHRIFT, SCHIRM_AUS } from './lib/hall-decals.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const STUFEN = ['S', 'M', 'L', 'XL'];

// Klinken (Grundsatz 5: nur nach oben; nach unten per Commit mit Ursache)
const MIN_HALLEN = 1; // ausgelieferte Hallen fester Größe (14.11.2026: 1, die Large-Halle)
// je Halle, gemessen am gebauten Stand: Lampen des Spiels, Teile des Bodentors, Dreiecke der Schrift im Modell,
// Dreiecke ausgeschalteter Schirme im Modell, vom Build ausgeschaltete Schirme, Tafeln mit Logo, Netze mit
// Aufklebern, aus der vollen Stufe geholte Schilder, eingehängte Kind-Container mit Geometrie.
// util-lrgtop mit ihren beiden Frachtaufzügen (Kind-Container, scripts/lib/hall-kinder.mjs): 678 Lampen der
// Halle und 2 × 60 der Aufzüge, 7 Tafeln mit Logo und je eine am Bedienhäuschen. Fehlen die Aufzüge wieder,
// reißen Lampen, Tafeln, Schirme und die Obergrenze für Strahlen ins Leere zugleich.
// Seit dem 15.11.2026 trägt sie auch die Türen ihrer neun Personenaufzüge und der Abgabe-Nische (dieselbe
// Bibliothek, von jedem dieser Container steht nur die Tür). Sie sind klein: Fehlten sie wieder, bliebe jede
// andere Zahl über ihrer Klinke und die Hülle fast so dicht wie zuvor (7 statt 9 von 67 500 Strahlen gingen
// ohne sie ins Leere). Darum zählt der Build die Halter der Kinder am Rohmodell (kinderBestand, kinder im
// Manifest): 2 Frachtaufzüge, 2 Kabinen darin, 9 Türen der Personenaufzüge, 1 Tür der Abgabe. Beide Türnetze
// tragen Aufkleber, die Klinke dafür stieg mit ihnen von 148 auf 150.
const KLINKE = {
  'util-lrgtop': { lampen: 798, tor: 18, schriftTris: 2337, schirmTris: 244, schirme: 13, tafeln: 9, aufkleber: 150, schilder: 5, kinder: 14 },
};
// Dreiecke und Bytes des Modells, Texturen, Anteil der Blickstrahlen, die ins Leere gehen (%).
// util-lrgtop: 1,70 Mio. Dreiecke galten für die Halle ohne ihre Frachtaufzüge (1 551 505); mit beiden sind es
// 1 783 379, mit den zehn Türen und ihren Aufdrucken 1 815 431 (22,8 MB, 263 Texturen). Ohne die Frachtaufzüge
// gingen 1,27 % der Strahlen ins Leere (zwei Löcher von 48 × 32 m in den Längswänden), mit ihnen 0,01 %: Die
// Grenze 0,3 % hält die Hülle geschlossen.
const OBERGRENZE = {
  'util-lrgtop': { tris: 1850000, bytes: 24e6, texturen: 270, leck: 0.3 },
};
// Schirme ohne Bild. Aus ist ein Material ohne Farb- und Leuchtkarte in der Farbe, die das Spiel seinen
// ausgeschalteten Schirmen gibt und der Build denen ohne Bild (SCHIRM_AUS, 0,0048). Ihre Dreiecke im Modell
// hält eine Klinke: In der Large-Halle sind es 9 vom Build ausgeschaltete Materialien (der Rohexport nennt
// 10, zwei gleichnamige legt der Build zusammen; darum zählt die Klinke Dreiecke und vergleicht nicht mit
// der Zahl des Manifests) und screen_off_01 des Spiels. Hell (Grundfarbe oder Leuchten über SCHIRM_HELL,
// linear; der Export gab ihnen 1) darf keines sein, dessen eigener Name hinter „_mtl_“ es als Schirm
// ausweist. Der Name der Datei davor zählt nicht: comms_screenroom_large_screens_1_mtl_plastic_black_02
// ist das Gehäuse, kein Schirm.
const SCHIRM_HELL = 0.5;
const istSchirm = (name) => /screen/i.test(name.split(/_mtl_/i).pop());
// Höhen in m: Boden der Seite gegen das Lot am Modell, Plattform gegen den Boden
const TOL_LOT = 0.002, TOL_PAD = 0.01;

const fehler = [];
const fail = (m) => fehler.push(m);
const say = (m) => console.log(m);

const PAGES = ['hangar.html', 'de/hangar.html'].map((file) => ({ file, html: existsSync(join(DIST, file)) ? readFileSync(join(DIST, file), 'utf8') : null }));
if (PAGES.some((p) => p.html === null)) {
  console.error('verify-hangar-hallen: dist/hangar.html oder dist/de/hangar.html fehlt — erst als Vorschau bauen (STAGING=1 npm run build).');
  process.exit(1);
}
console.log('verify-hangar-hallen: prueft die Hallen fester Groesse, die dist/hangar.html und dist/de/hangar.html ausliefern\n');

const inDist = (url) => join(DIST, String(url).replace(/^\//, '').replace(/[?#].*$/, ''));
const viewerFile = join(DIST, 'assets/hangar-viewer.js');
const viewerSrc = existsSync(viewerFile) ? readFileSync(viewerFile, 'utf8') : '';
let viewer = null;
try { viewer = viewerSrc ? await import(pathToFileURL(viewerFile).href) : null; } catch (e) { fail(`dist/assets/hangar-viewer.js laedt nicht als Modul (${e.message})`); }
let FEST = null;
try { FEST = JSON.parse(/\/\* hall-fest \*\/([\s\S]*?)\/\* \/hall-fest \*\//.exec(viewerSrc)?.[1] ?? 'null'); } catch { /* unten */ }
if (!FEST || typeof FEST !== 'object') {
  console.error('verify-hangar-hallen: dist/assets/hangar-viewer.js nennt die Hallen fester Groesse nicht (Block zwischen /* hall-fest */ und /* /hall-fest */) — ohne ihn baut die Buehne keine davon.');
  process.exit(1);
}

/* ---------- [1] Seite ---------- */
say('[1] Seite: je Hangargroesse die Halle, die der Viewer fuer sie nennt, in beiden Sprachen gleich und vollstaendig in dist/');
const HALLEN = new Map();
const proSeite = PAGES.map((page) => {
  let cfg = null;
  try { cfg = JSON.parse(/<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(page.html)?.[1] ?? 'null'); } catch { /* unten */ }
  if (!cfg) { fail(`[1] ${page.file}: keine StageConfig (#hg-stage) — die Seite startet keine Buehne`); return null; }
  return cfg.halls ?? {};
});
if (proSeite.every(Boolean) && JSON.stringify(proSeite[0]) !== JSON.stringify(proSeite[1])) {
  const anders = [...new Set([...Object.keys(proSeite[0]), ...Object.keys(proSeite[1])])].map((s) => [s, [...new Set([...Object.keys(proSeite[0][s] ?? {}), ...Object.keys(proSeite[1][s] ?? {})])].filter((k) => JSON.stringify(proSeite[0][s]?.[k]) !== JSON.stringify(proSeite[1][s]?.[k]))]).filter(([, k]) => k.length);
  fail(`[1] ${PAGES[0].file} und ${PAGES[1].file} liefern verschiedene Hallen aus (${anders.map(([s, k]) => `Stufe ${s}: ${k.join(', ')}`).join('; ')}) — je nach Sprache stuende das Schiff in einer anderen Halle oder auf anderer Hoehe`);
}
for (const [stufe, hall] of Object.entries(proSeite[0] ?? {})) {
  const F = FEST[hall?.id];
  if (!STUFEN.includes(stufe)) { fail(`[1] halls nennt die Stufe „${stufe}“, die es nicht gibt (${STUFEN.join(', ')})`); continue; }
  if (!hall?.id || !F) { fail(`[1] Stufe ${stufe}: die Seite liefert die Halle ${hall?.id ?? '(ohne id)'} aus, die der Viewer nicht als Halle fester Groesse kennt (HALL_FEST) — die Buehne zoege sie wie die Halle von Revel & York auseinander`); continue; }
  if (F.size !== stufe) { fail(`[1] Stufe ${stufe}: die Seite liefert ${hall.id} aus, der Viewer nennt sie fuer ${F.size} (HALL_FEST.size)`); continue; }
  const fehlt = [['url', 'das Modell'], ['lights', 'die Lampen des Spiels'], ['aufzug', 'die Bahnen ihres Aufzugs']].filter(([k]) => !hall[k] || !existsSync(inDist(hall[k])));
  if (fehlt.length) { fail(`[1] ${hall.id}: ${fehlt.map(([k, was]) => `${was} (${k}: ${hall[k] ?? 'nicht genannt'})`).join(', ')} fehlt in dist/ — ${fehlt.some(([k]) => k === 'url') ? 'die Stufe bliebe ohne Halle' : 'die Halle stuende dunkel oder ohne Plattform'}`); continue; }
  const r = hall.room;
  if (!(Array.isArray(r?.center) && r.center.length === 3 && r.center.every(Number.isFinite) && r.halfW > 0 && r.halfL > 0 && r.height > 0)) { fail(`[1] ${hall.id}: die Seite nennt den Raum nicht vollstaendig (room: ${JSON.stringify(r ?? null)})`); continue; }
  if (!Number.isFinite(hall.floor)) { fail(`[1] ${hall.id}: die Seite nennt die Hoehe des Bodens nicht (floor) — die Buehne lotete sie erst am geladenen Modell, bei ueber einer Million Dreiecken spuerbar`); continue; }
  const bytes = statSync(inDist(hall.url)).size;
  if (hall.bytes !== bytes) { fail(`[1] ${hall.id}: das Modell in dist/ hat ${bytes} Bytes, die Seite nennt ${hall.bytes} — Seite und Modell stammen nicht aus demselben Bau (Manifest und Datei gemeinsam einchecken)`); continue; }
  HALLEN.set(hall.id, { stufe, hall, F, bytes });
}
const ohne = Object.keys(FEST).filter((id) => !HALLEN.has(id));
if (HALLEN.size < MIN_HALLEN) fail(`[1] nur ${HALLEN.size} Halle(n) fester Groesse ausgeliefert, Klinke ${MIN_HALLEN}`);
say(`    ${HALLEN.size} Halle(n) ausgeliefert (Klinke ${MIN_HALLEN})${HALLEN.size ? `: ${[...HALLEN.values()].map((h) => `${h.stufe} ${h.hall.id}`).join(', ')}` : ''}${ohne.length ? `; der Viewer nennt ausserdem ${ohne.join(', ')}, NICHT geprueft, weil dieser Bau sie nicht ausliefert` : ''}`);

/* ---------- [2] Modell ---------- */
say('[2] Modell: Boden der Seite wie das Lot am Modell, Plattform auf dieser Hoehe, Landeflaeche im Feld des Aufzugs und im Raum, jede Bahn mit Knoten');
const io = HALLEN.size ? new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() }) : null;
const DOCS = new Map();
let bahnen = 0, padFlaeche = 0;
for (const [id, { hall, F }] of HALLEN) {
  let doc;
  try { doc = await io.read(inDist(hall.url)); } catch (e) { fail(`[2] ${id}: das Modell laesst sich nicht lesen (${e.message})`); continue; }
  DOCS.set(id, doc);
  const c = hall.room.center, P = F.pad;
  if (!(Array.isArray(P?.from) && Array.isArray(P?.to) && P.from[0] < P.to[0] && P.from[1] < P.to[1])) { fail(`[2] HALL_FEST.${id}.pad nennt keine Landeflaeche (from, to im Modellraum)`); continue; }
  const mitte = [(P.from[0] + P.to[0]) / 2, (P.from[1] + P.to[1]) / 2];
  if (P.from[0] < c[0] - hall.room.halfW || P.to[0] > c[0] + hall.room.halfW || P.from[1] < c[2] - hall.room.halfL || P.to[1] > c[2] + hall.room.halfL) fail(`[2] ${id}: die Landeflaeche (HALL_FEST.pad ${JSON.stringify(P)}) liegt nicht im Raum der Halle (Mitte ${c[0]}, ${c[2]}, halbe Breite ${hall.room.halfW}, halbe Laenge ${hall.room.halfL})`);
  if (!(F.clear > 0 && F.clear <= hall.room.height)) fail(`[2] ${id}: HALL_FEST.clear ${F.clear} m passt nicht in den Raum (Hoehe ${hall.room.height} m)`);
  // der Ursprung, an den die Buehne das Modell setzt (ohne ihn lotet sie selbst)
  const O = viewer?.hallOrigin?.(hall);
  if (!Array.isArray(O) || Math.abs(O[0] - mitte[0]) > 1e-6 || Math.abs(O[2] - mitte[1]) > 1e-6 || O[1] !== hall.floor) fail(`[2] ${id}: die Buehne setzt die Halle nicht auf die Mitte ihrer Landeflaeche und den Boden der Seite (hallOrigin ${JSON.stringify(O ?? null)}, erwartet ${mitte[0]}, ${hall.floor}, ${mitte[1]})`);
  // Boden: dasselbe Lot wie im Build, am ausgelieferten Modell
  const lot = floorLevel(doc, hall.room);
  if (lot == null || Math.abs(lot - hall.floor) > TOL_LOT) fail(`[2] ${id}: das Lot trifft den Boden des ausgelieferten Modells bei ${lot ?? '(nichts)'}, die Seite nennt ${hall.floor} — Modell und Manifest stammen nicht aus demselben Bau; alles, was in Hallenmetern vermessen ist (Leitstand, Kamera, Deko), stuende um ${lot == null ? '?' : Math.abs(lot - hall.floor).toFixed(3)} m daneben`);
  // Bahnen des Aufzugs
  let A = null;
  try { A = JSON.parse(readFileSync(inDist(hall.aufzug), 'utf8')); } catch (e) { fail(`[2] ${id}: die Bahnen des Aufzugs lassen sich nicht lesen (${e.message})`); continue; }
  const knoten = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const netze = (n) => (n.getMesh() ? 1 : 0) + n.listChildren().reduce((s, k) => s + netze(k), 0);
  const teile = [...(A.tor?.teile ?? []), ...(A.plattform ? [A.plattform] : [])];
  const lose = teile.filter((t) => !t?.node || !knoten.has(t.node) || !netze(knoten.get(t.node)));
  if (!A.plattform?.node || !(A.tor?.teile?.length > 0)) fail(`[2] ${id}: die Bahnen nennen ${A.plattform?.node ? 'kein Bodentor' : 'keine Plattform'} — die Buehne baute den Aufzug nicht`);
  else if (lose.length) fail(`[2] ${id}: ${lose.length} Bahn(en) ohne Knoten mit Netz im Modell (${lose.slice(0, 4).map((t) => t?.node ?? '(ohne Namen)').join(', ')}) — dieses Teil bliebe stehen, waehrend der Aufzug faehrt`);
  else bahnen += teile.length;
  if (!(A.plattform?.weg > 0)) fail(`[2] ${id}: die Plattform hat keinen Fahrweg (plattform.weg ${A.plattform?.weg ?? '—'})`);
  const feld = A.feld;
  if (!(Array.isArray(feld?.from) && Array.isArray(feld?.to))) fail(`[2] ${id}: die Bahnen nennen das Feld des Aufzugs nicht (feld)`);
  else {
    const fm = [(feld.from[0] + feld.to[0]) / 2, (feld.from[1] + feld.to[1]) / 2];
    if (Math.hypot(fm[0] - mitte[0], fm[1] - mitte[1]) > 0.05) fail(`[2] ${id}: die Landeflaeche (Mitte ${mitte.join(', ')}) sitzt nicht mitten im Feld des Aufzugs (Mitte ${fm.map((v) => +v.toFixed(3)).join(', ')}) — das Schiff staende neben der Mitte der Plattform`);
    if (P.from[0] < feld.from[0] || P.to[0] > feld.to[0] || P.from[1] < feld.from[1] || P.to[1] > feld.to[1]) fail(`[2] ${id}: die Landeflaeche ${JSON.stringify(P)} ragt ueber das Feld des Aufzugs ${JSON.stringify(feld)} hinaus`);
  }
  // Oberseite der Plattform: die Hoehe, auf der die meiste nach oben gewandte Flaeche ihres Knotens liegt
  const pad = A.plattform?.node ? knoten.get(A.plattform.node) : null;
  if (pad) {
    const je = new Map(), v = [0, 0, 0];
    pad.traverse((n) => {
      const m = n.getWorldMatrix();
      for (const prim of n.getMesh()?.listPrimitives() ?? []) {
        if (prim.getMaterial()?.getAlphaMode() === 'BLEND') continue;
        const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), cnt = idx ? idx.getCount() : pos.getCount();
        const at = (i) => { pos.getElement(i, v); return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]; };
        for (let i = 0; i + 2 < cnt; i += 3) {
          const [a, b, d] = [0, 1, 2].map((k) => at(idx ? idx.getScalar(i + k) : i + k));
          const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
          const n3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], len = Math.hypot(...n3);
          if (!(len > 1e-10) || n3[1] / len < 0.99) continue;
          const y = Math.round(((a[1] + b[1] + d[1]) / 3) * 200) / 200;
          je.set(y, (je.get(y) ?? 0) + len / 2);
        }
      }
    });
    const [oben, flaeche] = [...je].sort((p, q) => q[1] - p[1])[0] ?? [null, 0];
    const soll = (P.to[0] - P.from[0]) * (P.to[1] - P.from[1]);
    if (oben == null || Math.abs(oben - hall.floor) > TOL_PAD) fail(`[2] ${id}: die Oberseite der Plattform liegt im Modell bei ${oben ?? '(keine Flaeche)'}, der Boden der Seite bei ${hall.floor} — das Schiff stuende ${oben == null ? '' : `${Math.abs(oben - hall.floor).toFixed(3)} m `}ueber oder in seiner Plattform`);
    else if (flaeche < 0.5 * soll) fail(`[2] ${id}: auf der Hoehe des Bodens traegt die Plattform nur ${flaeche.toFixed(0)} m² (Landeflaeche ${soll.toFixed(0)} m²) — sie ist nicht mehr die Flaeche, auf der das Schiff steht`);
    else padFlaeche += flaeche;
  }
}
say(`    ${DOCS.size} Modell(e) gelesen, ${bahnen} Bahnen mit Knoten, ${padFlaeche.toFixed(0)} m² Plattform auf der Hoehe des Bodens`);

/* ---------- [3] Bestand ---------- */
say('[3] Bestand: Schrift und Schirme am Modell, Lampen in der ausgelieferten Datei, Zahlen des Manifests ueber ihren Klinken und unter ihren Obergrenzen');
let manifest = null;
try { manifest = JSON.parse(readFileSync(join(ROOT, 'src/data/hangar-assets.json'), 'utf8')); } catch (e) { if (HALLEN.size) fail(`[3] src/data/hangar-assets.json ist nicht lesbar (${e.message})`); }
const zeilen = [];
for (const [id, { bytes }] of HALLEN) {
  const K = KLINKE[id], G = OBERGRENZE[id], doc = DOCS.get(id), M = manifest?.hall?.[id];
  if (!K || !G) { fail(`[3] ${id}: keine Klinken und Obergrenzen fuer diese Halle (KLINKE, OBERGRENZE in diesem Skript) — eine neue Halle traegt ihre gemessenen Zahlen ein`); continue; }
  if (!doc || !M) { if (doc) fail(`[3] ${id}: das Manifest nennt die Halle nicht (src/data/hangar-assets.json, hall.${id})`); continue; }
  // am Modell: Dreiecke der Schrift, Schirme ohne Bild
  const tris = new Map();
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial();
    if (m) tris.set(m, (tris.get(m) ?? 0) + (p.getIndices() ?? p.getAttribute('POSITION')).getCount() / 3);
  }
  let schrift = 0, schriftOffen = 0, aus = 0, ausTris = 0;
  const hell = [];
  for (const [m, n] of tris) {
    const name = m.getName();
    if (SCHRIFT.test(name)) { schrift += n; if (m.getAlphaMode() === 'OPAQUE' || !m.getBaseColorTexture()) schriftOffen += n; }
    if (m.getBaseColorTexture() || m.getEmissiveTexture()) continue;
    const f = m.getBaseColorFactor(), e = Math.max(...m.getEmissiveFactor());
    if (e === 0 && f.slice(0, 3).every((x) => Math.abs(x - SCHIRM_AUS) < 1e-4)) { aus++; ausTris += n; }
    else if (istSchirm(name) && (Math.max(f[0], f[1], f[2]) > SCHIRM_HELL || e > SCHIRM_HELL)) hell.push(`${name} (${f.slice(0, 3).map((x) => +x.toFixed(2)).join(', ')}, ${n} Dreiecke)`);
  }
  if (ausTris < K.schirmTris) fail(`[3] ${id}: das Modell traegt ${ausTris} Dreiecke ausgeschalteter Schirme (${aus} Materialien ohne Karte in der Farbe ${SCHIRM_AUS}), Klinke ${K.schirmTris} — ein Schirm ohne Bild ist umgefaerbt oder fehlt (hallScreensOff schaltet sie aus, nach ihm darf kein Schritt ihre Farbe anfassen)`);
  if (schrift < K.schriftTris) fail(`[3] ${id}: das Modell traegt ${schrift} Dreiecke Schrift, Klinke ${K.schriftTris} — Schilder haben Buchstaben verloren (die leichtere Stufe des Spiels duennt sie aus; swapHallText setzt die der vollen Stufe ein)`);
  if (schriftOffen) fail(`[3] ${id}: ${schriftOffen} Dreiecke Schrift, die deckend oder ohne Farbkarte gezeichnet werden (erwartet: Schnitt oder Mischung nach dem Alpha der Karte, MASK oder BLEND) — die Buchstaben stuenden als dunkle Bloecke da`);
  if (hell.length) fail(`[3] ${id}: ${hell.length} Schirm(e) ohne Bild sind hell: ${hell.slice(0, 4).join('; ')} — das Spiel malt sie zur Laufzeit, ohne Bild gehoeren sie ausgeschaltet (hallScreensOff)`);
  // die Lampen, wie sie ausgeliefert werden: Die Buehne liest diese Datei, nicht das Manifest. Gezaehlt wird, was
  // sie davon wirklich setzt, mit der Regel des Viewers selbst (hallLampeGilt: mit Ort und Staerke, kein
  // Umgebungslicht, kein Flaechenlicht unter LAMP_MIN_RADIUS). Eine zweite, hier nachgebaute Regel liefe
  // auseinander: Die erste Fassung zaehlte jeden wohlgeformten Eintrag, auch die, die der Viewer weglaesst.
  let L = null;
  try { L = JSON.parse(readFileSync(inDist(HALLEN.get(id).hall.lights), 'utf8')); } catch (e) { fail(`[3] ${id}: die ausgelieferte Lampendatei laesst sich nicht lesen (${e.message}) — die Halle stuende mit dem Buehnenlicht statt mit den Lampen des Spiels`); }
  const lampenRoh = Array.isArray(L?.lights) ? L.lights : null;
  const gilt = typeof viewer?.hallLampeGilt === 'function' ? viewer.hallLampeGilt : null;
  if (!gilt) fail(`[3] ${id}: der Viewer nennt nicht mehr, welche Lampen er setzt (hallLampeGilt) — das Tor koennte nur raten, was von der Datei leuchtet`);
  else if (!/const all = \(d\.lights \|\| \[\]\)\.filter\(hallLampeGilt\);/.test(viewerSrc)) fail(`[3] ${id}: die Buehne waehlt ihre Lampen nicht mehr mit hallLampeGilt aus (loadHallLights) — Tor und Buehne zaehlten wieder nach verschiedenen Regeln`);
  const wohlgeformt = (l) => l && typeof l.type === 'string' && Array.isArray(l.pos) && l.pos.length === 3 && l.pos.every(Number.isFinite) && Number.isFinite(l.intensity);
  const kaputt = (lampenRoh ?? []).filter((l) => !wohlgeformt(l)).length;
  const lampen = (lampenRoh ?? []).filter((l) => wohlgeformt(l) && gilt?.(l));
  if (L && !lampenRoh) fail(`[3] ${id}: die ausgelieferte Lampendatei traegt keine Liste (lights) — die Halle stuende mit dem Buehnenlicht`);
  if (L && !((L.v ?? 1) >= 2)) fail(`[3] ${id}: die ausgelieferte Lampendatei nennt die Fassung ${L.v ?? 'nicht'}, die Buehne nimmt Lampen erst ab Fassung 2 (Richtungen im Raum des Modells) — die Halle stuende mit dem Buehnenlicht`);
  if (kaputt) fail(`[3] ${id}: ${kaputt} von ${lampenRoh.length} Lampen der ausgelieferten Datei sind unvollstaendig (ohne Art, ohne Ort aus drei Zahlen oder ohne Staerke)`);
  if (lampenRoh && lampenRoh.length !== M.lights?.total) fail(`[3] ${id}: die ausgelieferte Lampendatei traegt ${lampenRoh.length} Lampen, das Manifest nennt ${M.lights?.total ?? 'keine'} — Datei und Manifest stammen nicht aus demselben Bau (gemeinsam einchecken)`);
  const lampenAus = (lampenRoh?.length ?? 0) - kaputt - lampen.length;
  // im Manifest: was der Build gezaehlt hat (die Lampen aus der ausgelieferten Datei)
  const ist = { lampen: lampen.length, tor: M.aufzug?.teile, schirme: M.schirme?.aus, tafeln: M.logo?.tafeln, aufkleber: M.aufkleber?.netze, schilder: M.schriftVoll?.teilnetze, kinder: M.kinder?.exemplare };
  for (const [k, was] of [['lampen', gilt ? `Lampen des Spiels, die die Buehne setzt (von ${lampenRoh?.length ?? 0} in der ausgelieferten Datei${lampenAus ? `; ${lampenAus} laesst sie weg: Umgebungslicht, ohne Staerke oder Flaechenlicht unter ${viewer?.LAMP_MIN_RADIUS ?? '?'} m` : ''})` : 'Lampen des Spiels gezaehlt (ohne die Regel des Viewers zaehlt das Tor keine)'], ['tor', 'Teile des Bodentors'], ['schirme', 'vom Build ausgeschaltete Schirme'], ['tafeln', 'Tafeln mit dem Logo des Betreibers'], ['aufkleber', 'Netze mit Aufklebern'], ['schilder', 'aus der vollen Stufe geholte Schilder'], ['kinder', `Kind-Container mit Geometrie eingehaengt (${Object.entries(M.kinder?.je ?? {}).map(([k, e]) => `${k} ${e?.exemplare}`).join(', ') || 'das Manifest nennt keinen'}; es sind Frachtaufzuege, ihre Kabinen und die Tueren der Personenaufzuege und der Abgabe, wo einer fehlt, steht ein Loch in der Wand)`]]) {
    if (!(ist[k] >= K[k])) fail(`[3] ${id}: ${ist[k] ?? 'keine'} ${was}, Klinke ${K[k]}`);
  }
  const fremd = [...(M.aufkleber?.fremd ?? []), ...(M.schriftVoll?.fremd ?? [])];
  if (fremd.length) fail(`[3] ${id}: ${fremd.length} Netz(e), an denen Aufkleber oder Schrift ihren Platz nicht fanden (${fremd.slice(0, 4).join(', ')}) — der Extraktor und der Build sehen nicht dasselbe Modell`);
  if (M.aufkleber?.karten?.ohneKarte?.length) fail(`[3] ${id}: ${M.aufkleber.karten.ohneKarte.length} Aufkleber-Material(ien) ohne Karte (${M.aufkleber.karten.ohneKarte.slice(0, 4).join(', ')})`);
  if (!(M.hallPalette?.materials > 0) || M.hallPalette?.missing) fail(`[3] ${id}: die Farben der Halle fehlen an ${M.hallPalette?.missing ?? 'allen'} Material(ien) (hallPalette ${JSON.stringify(M.hallPalette ?? null)})`);
  if (M.bytes !== bytes) fail(`[3] ${id}: das Manifest nennt ${M.bytes} Bytes, das Modell in dist/ hat ${bytes} — die Zahlen des Manifests gehoeren zu einem anderen Bau`);
  if (M.floor !== HALLEN.get(id).hall.floor) fail(`[3] ${id}: das Manifest nennt den Boden bei ${M.floor}, die Seite bei ${HALLEN.get(id).hall.floor}`);
  const ueber = [['tris', M.tris, 'Dreiecke'], ['bytes', bytes, 'Bytes'], ['texturen', M.textures, 'Texturen'], ['leck', M.hull?.pct, '% Blickstrahlen ins Leere']].filter(([k, v]) => !(v <= G[k]));
  for (const [k, v, was] of ueber) fail(`[3] ${id}: ${v ?? 'keine Zahl fuer'} ${was}, Obergrenze ${G[k]} — die Halle ist schwerer oder offener geworden`);
  zeilen.push(`    ${id}: ${schrift} Dreiecke Schrift (Klinke ${K.schriftTris}), ${aus} Schirme ohne Bild aus mit ${ausTris} Dreiecken (Klinke ${K.schirmTris}), 0 hell; ${lampenRoh?.length ?? 0} Lampen in der ausgelieferten Datei, davon setzt die Buehne ${ist.lampen}, Bodentor ${ist.tor} Teile, ${ist.schirme} Schirme vom Build ausgeschaltet, ${ist.tafeln} Tafeln mit Logo, ${ist.aufkleber} Netze mit Aufklebern, ${ist.schilder} Schilder aus der vollen Stufe, ${ist.kinder} Kind-Container eingehaengt; ${M.tris} Dreiecke, ${(bytes / 1e6).toFixed(1)} MB, ${M.textures} Texturen, ${M.hull?.pct} % ins Leere`);
}
for (const z of zeilen) say(z);
if (!zeilen.length) say(`    ${HALLEN.size ? 'keine Halle vollstaendig gemessen' : 'keine Halle ausgeliefert, nichts zu messen'}`);

/* ---------- [4] Kein Ballast ---------- */
say('[4] Kein Ballast: keine Einrichtungs-, Telefon- oder zweite Stufe einer Halle fester Groesse in dist/');
let frei = 0;
for (const id of Object.keys(FEST)) {
  const zuviel = [`${id}.furniture.glb`, `${id}.patch.glb`, `${id}-lod1.glb`].filter((n) => existsSync(join(DIST, 'hangar/hall', n)));
  if (zuviel.length) fail(`[4] dist/hangar/hall/ traegt ${zuviel.join(', ')}: Die Seite laedt fuer eine Halle fester Groesse nur ihr Modell (die Moebel stehen darin), diese Dateien gingen ungenutzt mit hinaus (scripts/build-hall-furniture.mjs schneidet nur neben einer dichten Kopie)`);
  else frei++;
}
// Bahnen eines Aufzugs, die keine Seite nennt: der Rest eines frueheren Baus. Die Seite nennt die Datei nur,
// wenn der Bau der Halle sie gemeldet hat (aufzugOf in HangarApp.astro fragt das Manifest).
const hallOrdner = join(DIST, 'hangar/hall');
const genannt = new Set(proSeite.flatMap((h) => Object.values(h ?? {}).map((x) => (x?.aufzug ? inDist(x.aufzug) : ''))).filter(Boolean));
const bahnDateien = existsSync(hallOrdner) ? readdirSync(hallOrdner).filter((n) => n.endsWith('.aufzug.json')) : [];
const lose = bahnDateien.filter((n) => !genannt.has(join(hallOrdner, n)));
if (lose.length) fail(`[4] dist/hangar/hall/ traegt ${lose.join(', ')}, und keine Hangarseite nennt sie: der Rest eines frueheren Baus, das Manifest meldet fuer diese Halle keinen Aufzug (mehr). Die Datei gehoert geloescht, oder die Halle neu gebaut (scripts/build-hangar-assets.mjs --kind hall)`);
say(`    ${frei} von ${Object.keys(FEST).length} Halle(n) ohne ungenutzte Dateien; ${bahnDateien.length} Datei(en) mit Bahnen eines Aufzugs, ${bahnDateien.length - lose.length} davon von der Seite genannt`);

if (fehler.length) {
  console.error(`\nverify-hangar-hallen: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('\nverify-hangar-hallen: ALLE ZUSICHERUNGEN ERFUELLT ✓');
