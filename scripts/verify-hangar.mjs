/* ============================================================
   verify-hangar.mjs — Tor fuer die Hangar-Buchten (Schiene A).

   WARUM ES DEN GIBT: Die Ausstattung im Hangar ist ein Bau-Join aus fuenf
   Dateien (vehicles, holo-meshes, ship-loadouts, ship-hardpoints,
   universal-items), gerendert in 454 Buchtdokumente, die die Seite je Schiff
   holt (src/lib/hangar/bay.ts). Jeder Fehler eines Joins ist still: eine
   fehlende Bucht ist ein 404 nur fuer den, der genau dieses Schiff waehlt,
   eine falsche Achsregel setzt Marker in die Luft, ein gebrochener Item-Join
   laesst Zeilen ohne Zahlen. Die Seite baut trotzdem und sieht gut aus.
   Dieses Tor liest das ARTEFAKT (dist/), druckt jede Zahl und reisst bei
   gebrochenem Join oder unter einer Klinke. Kein git, kein Netz, keine
   Data.p4k, kein Kindprozess — schienenfaehig fuer Schiene A.

   SIEBZEHN ZUSICHERUNGEN, jede mit Soll-/Ist-Zeile:
     1  Eine Id-Menge an vier Stellen, je Hangarseite: das Dock
        (li[data-id]), die Modellliste der Szene (#hg-stage, Form der
        StageConfig aus src/lib/hangar/stage.ts), die EN-Buchten, die
        DE-Buchten. Die Zahl selbst hat ihre Klinke in verify:metrics
        (seitenHangarBuchten), neben allen anderen Seitenzahlen. Seit
        24.10.2026 dazu der Ort: 'werk' (Werkhalle) genau fuer die
        Bodenfahrzeuge aus src/data/vehicles.json (isSpaceship === false),
        seit 25.10.2026 samt den Gravlev-Raedern (isGravlev, Krisz:
        „dragonfly undso gehört auch zur bodenfahrzeugen“), Klinke werkhalle.
     2  Buchtgestalt: main[data-bay-id] gleich Dateiname, genau die drei
        Regionen head, panel, marks und keine weitere (der Controller setzt
        nur diese ein), je Bucht ein Tab-Panel fuer genau die Tabs,
        die die Tab-Leiste der Hangarseite nennt (aus dist/hangar.html
        gelesen, keine eigene Liste), kein <style>, kein <script>, style= nur
        als Balkenbreite (die Kostenbremse: Buchten bleiben reines HTML).
     3  Marker am Rumpf, in zwei Haelften.
        3a Jedes data-p: drei endliche Zahlen in der data-box, je Achse um
           15 % (mindestens 1 m) erweitert; jede Zeile aus data-rows fuehrt
           den Port des Markers in data-ports und steht in seinem Tab. Faengt
           Punkte und Box, die verschieden umgerechnet wurden.
        3b Die Z-Ausdehnung der Box (glTF-Bugachse) liegt innerhalb 30 % der
           Schiffslaenge aus dem Dock (data-v unter len, aus vehicles.json,
           nicht aus der Hardpoint-Datei). Faengt eine falsche Achsregel,
           die Punkte UND Box verschiebt; die sieht 3a nicht.
     4  EN gleich DE je Schiff: Zeilen und Marker. verify:sync beweist schon
        die Elementfolge; diese Zeile nennt das Schiff.
     5  Zaehlungen gegen die Klinken (KLINKEN unten).
     6  Groessendeckel: groesste Bucht, Summe je Sprache.
     7  Viewer-Naht: dist/assets/hangar-viewer.js liefert project, focus,
        setCover, onFrame, fit und paint. Reisst sie, nennt die Meldung
        .planning/notes/hangar-naht.md.
     8  Import-Map vor dem ersten Modul-Skript auf beiden Hangarseiten: ein
        Modul-Skript davor laesst Chrome die Map verwerfen, und three.js
        laedt nicht mehr.
     9  Jede Vorlage, die der Controller verlangt, steht auf beiden Seiten.
        Die Ids kommen aus dem ausgelieferten Code selbst (jeder msg('…')-
        Aufruf in dist/assets/hangar-overview.js), nicht aus einer Liste
        hier: eine aus HangarPage.astro entfernte Vorlage hinterlaesst sonst
        still eine leere Stelle.
    10  Dock-Daten, so wie der Client sie liest. Jede Karte traegt data-v
        mit genau so vielen Werten, wie data-stats Schluessel nennt, jeder
        eine endliche Zahl oder '-'. data-stats nennt jede Zeile der
        Vergleichstabelle (#hgx-cmp-table tr[data-k], mindestens 13) und
        jede Sortieroption ausser dem Namen. Die Werte jeder Karte stimmen
        mit dem Ueberblick der EN-Bucht desselben Schiffs ueberein, fuer die
        Kennwerte, die er druckt. Sortierung, Vergleich und Flottenzeile
        rechnen nur mit data-v; eine verrutschte Folge vertauscht still
        Fracht und Besatzung, und Anzahl und Zahlform allein sehen das nicht.
    11  Jeder Port in data-ports und data-port der Buchten passt auf die
        Portregel des Controllers (PORT_RE, gelesen aus
        dist/assets/hangar-overview.js). Sonst verwirft parseState den
        tiefen Link ?hp= auf genau diesen Hardpoint still.
    12  Leistungsstufen (hoch, mittel, niedrig; Krisz 2026-10-15: „auf
        komplett potato fluessig“). Der ausgelieferte Viewer wird geladen
        und pickQuality an einer festen Liste von Grafikchips geprueft
        (schwache Laptops und Telefone niedrig, Mittelklasse mittel, starke
        hoch, Wahl von Hand gewinnt); der Viewer liefert quality und
        onQuality; der Controller gibt Chipname und Wahl an initHangar
        weiter; beide Hangarseiten tragen den Grafik-Schalter mit genau
        den Stufen des Viewers. Ohne das faellt ein schwaches Geraet still
        in die volle Stufe zurueck, und nur ein Ruckeln verriete es.
    13  Getauschte Bordwaffen am Modell (Layout-Werkstatt): jede URL unter
        models in dist/hangar-layouts.json traegt ?v= und liegt in dist/,
        und die Schiffs-GLBs in dist/hangar/ships tragen ihre Serienwaffen als
        Tauschteile (Knoten mit extras.swap und 16 endlichen Zahlen in
        extras.anchor, aus dem JSON-Block der Datei gelesen). Zwei Klinken:
        Modelle und Ports mit Tauschteilen.
    14  Lackierungen der Werkstatt: paints in dist/hangar-layouts.json je
        Schiff (auch ohne tauschbare Bauteile), Serienpalette und jede Lackierung mit drei
        #rrggbb-Toenen, eindeutiger Kennung und Namen. Je Schiff mit Lack
        (dist/hangar/ships) zaehlt die Pruefung die Materialien, deren
        baseColorFactor ein Ton der Serienpalette ist (linear, wie der
        Viewer sie in paint() sucht): ohne Treffer faerbt die Lackierung am
        Modell nichts um. Klinken: Schiffe, Lackierungen, umfaerbbare
        Schiffe mit Lack.
    15  Raketen der Werkstatt: jeder Raketen-, Torpedo- und Bombenslot in
        dist/hangar-layouts.json hat ein Serienteil im Katalog derselben
        Art und Groesse, die Gruppe passt zur Art (Bombe zu bomb, sonst
        missile), und die Stueckzahl ist eine ganze Zahl ab 1. Bietet ein
        Slot Halterungen an, steht jede in racks, die erste (Serie) traegt
        genau Art, Raketengroesse und Anzahl des Slots, keine kommt doppelt
        vor, und in jede passt mindestens eine Rakete des Katalogs.
        Klinken: Schiffe mit Raketenslots, Raketenslots, Slots mit
        mindestens einer Alternative zum Serienteil, Slots mit Wahl der
        Halterung.
    16  Bildlook, Ausgabe und Ton (Krisz 2026-10-20: „besseres Licht,
        Colorgrading, Geraeusche“). Die zwei Textstellen, mit denen der
        Viewer sich in three.js einhaengt (LOOK_HOOK in der Tonabbildung,
        OETF im OutputShader), stehen je genau einmal in dist/vendor/three;
        beide liest das Tor aus dem ausgelieferten Viewer. Die Lookwerte
        sind endliche Zahlen in der Form von LOOK_GLSL. Der Viewer liefert
        setSound und sound, der Controller gibt sound an initHangar, beide
        Hangarseiten tragen den Ton-Schalter. Ohne das faellt die Halle
        nach einem Update von three.js still auf den alten Look zurueck.
        Seit 20.10.2026 abends (Aufnahmen statt Synthese): Jeder Klang in
        SND_FILES liegt als MP3 in dem Ordner, den die Seite mitgibt
        (hall.lift.sound), und dessen Version ist der Inhalt der Dateien.
        Klinke: KLINKE_TON Klaenge. Seit 21.10.2026 (flotter Takt, Klaenge
        geschnitten): Der Anschlag beider Torklaenge (SND_HIT) liegt
        hoechstens TOR_TAKT_LUFT neben dem Ende der Bahn (HALL_GATE.ms).
    17  Bildablage der Schiffe (seit 25.10.2026, Krisz: alle Schiffe mit
        echten Texturen). Die Schiffs-GLBs in dist/hangar/ships tragen kein
        Bild mehr eingebettet, jeder Verweis ../tex/<inhalt>.<endung> liegt
        in dist/hangar/tex, und jeder Dateiname dort ist sha256 seines
        Inhalts (16 Zeichen; die URL steht ein Jahr im Cache). Deckel fuer
        GLB und Ablage zusammen und je Datei, Klinke: Schiffe mit Ablage.
        Verwaiste Bilder: WARNUNG (Ballast, kein Schaden).

   VORGEFUEHRT ROT (die Meldungen stehen in den Commit-Botschaften):
     a  dist/hangar-bay/aegs-gladius.html nach dem Bauen loeschen   -> [1]
     b  toGltf() in src/lib/hangar/ports.ts auf (x, y, z), bauen    -> [3b]
        ([3a] und [5] bleiben gruen: Punkte, Box und Zahlen wandern
        gemeinsam — genau dafuer gibt es 3b)
     c  joinItem() in src/lib/hangar/bay.ts ohne Namensnormalisierung,
        bauen                                                       -> [5]
     d  in dist/hangar.html einer Karte einen Wert aus data-v nehmen  -> [10]
     e  in dist/hangar.html zwei Werte einer Karte tauschen          -> [10]
     f  in einer gebauten Bucht einen Port gross schreiben           -> [11]
     g  in dist/assets/hangar-viewer.js GPU_WEAK ohne u?hd           -> [12]
     h  dist/hangar/weapons/ndb-30-repeater.glb loeschen             -> [13]
     i  in dist/hangar-layouts.json models leeren                    -> [13]
     j  in dist/hangar-layouts.json einen Ton auf 'rot' setzen       -> [14]
     k  in dist/hangar-layouts.json die Serienpalette der Gladius
        verstellen (Ton trifft kein Material mehr)                   -> [14]
     l  in dist/hangar-layouts.json die Torpedos aus items nehmen    -> [15]
     m  in dist/hangar-layouts.json die Plaetze der MSD-322 auf 3
        setzen (Serie passt nicht mehr zum Slot)                     -> [15]
     n  in dist/vendor/three/three.module.min.js den Einhaengepunkt
        CustomToneMapping umbenennen                                -> [16]
     o  in dist/hangar.html data-off des Ton-Schalters entfernen    -> [16]
     p  dist/hangar/ton/tor-zu.mp3 loeschen                         -> [16]
     q  in dist/assets/hangar-viewer.js HALL_GATE.ms auf 15000        -> [16]
     r  dist/hangar/tex/00027238071d0638.webp loeschen               -> [17]
        (fehlt fuer rsi-constellation-andromeda.glb)
     s  dist/hangar/ships/orig-300i.glb durch die Fassung mit
        eingebetteten Bildern ersetzen                              -> [17]
        (147 Bilder eingebettet, und Klinke 9 < 10)
     t  ein Bild der Ablage mit dem Inhalt eines anderen
        ueberschreiben                                              -> [17]

     node scripts/verify-hangar.mjs            Tor
     node scripts/verify-hangar.mjs --report   nur Ist-Werte, kein Urteil
                                               (zum bewussten Anheben)
   ============================================================ */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORT = process.argv.includes('--report');

/* Klinken in der Bauform von scripts/lib/metrics-baseline.mjs. 'min' darf
   wachsen, nie fallen; Senken nur per Commit, der die Ursache nennt. 'max'
   ist ein Deckel. Startwerte aus dem ersten gebauten dist/ am 07.10.2026
   (Build mit 17.962 Seiten), nicht geschaetzt. */
const KLINKEN = [
  {
    id: 'slotZeilen', wert: 2410, regel: 'min', toleranzProzent: 2,
    anlass: 'Zeilen je (Art, Item, Groesse) ueber 223 Loadouts, EN. Atmet leicht mit jedem Datenlauf.',
  },
  {
    id: 'slotZeilenMitWerten', wert: 1980, regel: 'min', toleranzProzent: 2,
    anlass: 'Zeilen, deren Item per Name und Groesse Kennwerte findet (Details mit Werten). Ein gebrochener Item-Join faellt weit darunter.',
  },
  {
    id: 'marker', wert: 3389, regel: 'min', toleranzProzent: 2,
    anlass: '3.389 von 3.621 Loadout-Ports tragen einen Bone, keiner verteilt seine Items auf zwei Tabs. Faellt, wenn der Hardpoint-Join oder die Portnamen brechen.',
  },
  {
    id: 'werkhalle', wert: 41, regel: 'min',
    anlass: 'Bodenfahrzeuge (vehicles.json isSpaceship === false, 31) und Gravlev-Raeder (isGravlev, 10: Dragonfly, Nox, X1, Pulse, HoverQuad; Krisz 25.10.2026) mit Hangar-Modell, die in der Werkhalle hinter der Westnische stehen (Krisz 24.10.2026). Faellt die Zahl, stehen sie still wieder auf dem Schiffsfeld.',
  },
  {
    id: 'schiffeMitWaffen', wert: 211, regel: 'min',
    anlass: '211 Schiffe zeigen mindestens eine Waffenzeile; 16 sind unbewaffnet oder ohne Loadout.',
  },
  {
    id: 'rumpfLaengeAufZ', wert: 200, regel: 'min', toleranzProzent: 2,
    anlass: 'Zusicherung 3b: bei 200 von 225 Schiffen mit bekannter Laenge liegt die Z-Ausdehnung der Rumpfbox innerhalb 30 % der Laenge aus vehicles.json. Eine falsche Achsregel drueckt die Zahl auf etwa 10. Toleranz, weil Rumpfbox und Wiki-Laenge aus verschiedenen Quellen stammen und ein einzelner Rumpf im Datenlauf kippen darf.',
  },
  {
    id: 'buchtMaxKB', wert: 48, regel: 'max',
    anlass: 'Kostenbremse: eine Bucht wird bei jedem Schiffswechsel geholt. Heute 20,5 KB (rsi-polaris, DE). Item-Beschreibungen oder Inline-CSS sprengen den Deckel.',
  },
  {
    id: 'buchtenSummeMB', wert: 4, regel: 'max',
    anlass: 'Kostenbremse fuer das Image und jedes Tor, das dist/ durchlaeuft (454 Dateien). Heute 3,09 MB DE.',
  },
];

const findings = [];
const fail = (msg) => findings.push(msg);
const say = (s = '') => console.log(s);
const sollIst = (soll, ist) => say(`    Soll: ${soll}   Ist: ${ist}`);

if (!existsSync(join(DIST, 'hangar.html'))) {
  console.error('verify-hangar: dist/hangar.html fehlt — erst `npm run build`.');
  process.exit(2);
}

const PAGES = [
  { lang: 'en', file: 'hangar.html' },
  { lang: 'de', file: 'de/hangar.html' },
].map((p) => ({ ...p, html: readFileSync(join(DIST, p.file), 'utf8') }));

const dockIds = (html) => [...html.matchAll(/<li data-id="([^"]+)"/g)].map((m) => m[1]);

// Die Modellliste der Seite: die StageConfig der Szene in #hg-stage
// (src/lib/hangar/stage.ts). Liefert die Ids, deren Eintrag die Form
// [glb, Werkslack oder null, Herstellerkuerzel, Ort] hat, und die Formfehler.
function stageModels(html) {
  const m = /<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return { ids: null, bad: ['kein #hg-stage'] };
  let cfg;
  try { cfg = JSON.parse(m[1]); } catch (e) { return { ids: null, bad: [`#hg-stage ist kein JSON (${e.message})`] }; }
  const bad = [];
  if (typeof cfg.viewer !== 'string' || !cfg.viewer.includes('hangar-viewer.js')) bad.push('viewer ist keine URL von hangar-viewer.js');
  if (!cfg.opts || typeof cfg.opts !== 'object') bad.push('opts fehlt');
  const ids = [], werk = [];
  for (const [id, e] of Object.entries(cfg.models ?? {})) {
    const ok = Array.isArray(e) && e.length === 4 && typeof e[0] === 'string' && e[0] && (e[1] === null || typeof e[1] === 'string') && typeof e[2] === 'string' && (e[3] === 'halle' || e[3] === 'werk');
    if (ok) ids.push(id); else bad.push(`models["${id}"] hat nicht die Form [glb, tex|null, maker, 'halle'|'werk']`);
    if (ok && e[3] === 'werk') werk.push(id);
  }
  return { ids, werk, bad };
}

// Das Dock so gelesen, wie der Client es liest: data-stats und data-v je Karte.
function readDock(html) {
  const keys = (/id="hg-strip"[^>]*\sdata-stats="([^"]*)"/.exec(html)?.[1] ?? '').split(' ').filter(Boolean);
  const cards = [...html.matchAll(/<li data-id="([^"]+)"[^>]*\sdata-v="([^"]*)"/g)].map((m) => ({ id: m[1], v: m[2].split(' ') }));
  const figures = new Map(cards.map((c) => [c.id, Object.fromEntries(keys.map((k, i) => [k, c.v[i] === undefined || c.v[i] === '-' ? null : Number(c.v[i])]))]));
  return { keys, cards, figures };
}
const DOCK = { en: readDock(PAGES[0].html), de: readDock(PAGES[1].html) };

// Buchten per Regex gelesen, keine HTML-Bibliothek: wie audit-site.
const REGIONS = ['head', 'panel', 'marks'];
function parseBay(file, html) {
  const id = /<main class="hgx-baydoc" data-bay-id="([^"]+)"/.exec(html)?.[1] ?? null;
  const tabs = [...html.matchAll(/role="tabpanel" id="hgx-tp-([a-z]+)"/g)].map((m) => ({ tab: m[1], at: m.index }));
  const tabAt = (at) => {
    let t = null;
    for (const x of tabs) if (x.at < at) t = x.tab;
    return t;
  };
  const numbers = new Map([...html.matchAll(/<div class="hgx-d" id="hgx-d-([^"]+)" hidden>(<dl>)?/g)].map((m) => [m[1], !!m[2]]));
  const rows = [...html.matchAll(/<li class="hgx-slot" data-row="([^"]+)" data-kind="([^"]+)" data-ports="([^"]*)">/g)].map((m) => ({
    key: m[1], kind: m[2], ports: m[3].split(' ').filter(Boolean), tab: tabAt(m.index), numbers: numbers.get(m[1]) === true,
  }));
  const marks = [...html.matchAll(/<i class="hgx-mk" data-tab="([^"]+)" data-port="([^"]+)" data-rows="([^"]*)" data-p="([^"]*)">/g)].map((m) => ({
    tab: m[1], port: m[2], rows: m[3].split(' ').filter(Boolean), p: m[4].split(' ').map(Number),
  }));
  // Nur das Ueberblick-Panel: der Fracht-Tab traegt eigene hg-row-Zeilen (cargo, ore).
  const ovAt = html.indexOf('id="hgx-tp-overview"');
  const ovEnd = ovAt < 0 ? -1 : html.indexOf('role="tabpanel"', ovAt);
  const ovHtml = ovAt < 0 ? '' : html.slice(ovAt, ovEnd < 0 ? undefined : ovEnd);
  const overview = [...ovHtml.matchAll(/<div class="hg-row(?: is-na)?" data-k="([a-zA-Z0-9]+)"><dt>[^<]*<\/dt><dd>([^<]*)<\/dd>/g)].map((m) => ({ k: m[1], text: m[2] }));
  const box = (/data-box="([^"]*)"/.exec(html)?.[1] ?? '').split(' ').filter(Boolean).map(Number);
  const styleAttrs = [...html.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]);
  return {
    file, id, bytes: Buffer.byteLength(html),
    regions: [...html.matchAll(/\sdata-bay="([a-z]+)"/g)].map((m) => m[1]),
    tabs: tabs.map((x) => x.tab), rows, marks, overview,
    box: box.length === 6 ? box : null,
    styleTags: (html.match(/<style\b/g) || []).length,
    scriptTags: (html.match(/<script\b/g) || []).length,
    styleAttrs,
  };
}

function readBays(dir) {
  const abs = join(DIST, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((n) => n.endsWith('.html')).sort()
    .map((n) => parseBay(`${dir}/${n}`, readFileSync(join(abs, n), 'utf8')))
    .map((b, i, all) => ({ ...b, name: all[i].file.replace(/^.*\//, '').replace(/\.html$/, '') }));
}
const BAYS = { en: readBays('hangar-bay'), de: readBays('de/hangar-bay') };
const bayIds = (lang) => new Set(BAYS[lang].map((b) => b.name));

say('\n[1] Eine Id-Menge: Dock, Modellliste, EN-Buchten, DE-Buchten (je Hangarseite); Ort Werkhalle genau fuer Bodenfahrzeuge');
// Bodenfahrzeuge samt Gravlev-Raedern (Krisz 25.10.2026), wie HangarApp.astro
const BODEN = new Set(JSON.parse(readFileSync(join(ROOT, 'src/data/vehicles.json'), 'utf8')).vehicles.filter((v) => v.isSpaceship === false || v.isGravlev === true).map((v) => v.id));
const werkZahl = [];
for (const page of PAGES) {
  const stage = stageModels(page.html);
  if (stage.ids) {
    const werk = new Set(stage.werk), falsch = stage.ids.filter((id) => werk.has(id) !== BODEN.has(id));
    say(`    ${page.file}: Werkhalle ${werk.size}, Bodenfahrzeuge mit Modell ${stage.ids.filter((id) => BODEN.has(id)).length}`);
    sollIst('0 falsch zugeordnet', falsch.length);
    for (const id of falsch) fail(`[1] ${page.file}: ${id} steht ${werk.has(id) ? 'in der Werkhalle, ist aber kein Bodenfahrzeug' : 'auf dem Schiffsfeld, ist aber ein Bodenfahrzeug'} (vehicles.json isSpaceship, isGravlev) — HangarApp.astro`);
    werkZahl.push(werk.size);
  }
  const places = {
    Dock: new Set(dockIds(page.html)),
    Modelle: new Set(stage.ids ?? []),
    'EN-Bucht': bayIds('en'),
    'DE-Bucht': bayIds('de'),
  };
  for (const b of stage.bad) fail(`[1] ${page.file}: ${b} — Vertrag: src/lib/hangar/stage.ts, .planning/notes/hangar-naht.md`);
  const all = new Set(Object.values(places).flatMap((s) => [...s]));
  const diffs = [];
  for (const id of [...all].sort()) {
    const missing = Object.entries(places).filter(([, s]) => !s.has(id)).map(([k]) => k);
    if (!missing.length) continue;
    const present = Object.keys(places).filter((k) => !missing.includes(k));
    diffs.push(`${id}: ${present.join(' und ')}, aber keine ${missing.join(', keine ')}`);
  }
  say(`    ${page.file}: ${Object.entries(places).map(([k, s]) => `${k} ${s.size}`).join(' · ')}`);
  sollIst('0 Abweichungen', diffs.length);
  for (const d of diffs.slice(0, 10)) say(`      ${d}`);
  for (const d of diffs) fail(`[1] ${page.file}: ${d}`);
}

say('\n[2] Buchtgestalt: Id = Datei, drei Regionen, Tabs der Seite, reines HTML');
const pageTabs = (html) => [...html.matchAll(/role="tab" id="hgx-tab-([a-z]+)"/g)].map((m) => m[1]).join(' ');
const refTabs = pageTabs(PAGES[0].html);
if (!refTabs) fail('[2] hangar.html traegt keine Tab-Leiste (role="tab" id="hgx-tab-…")');
if (pageTabs(PAGES[1].html) !== refTabs) fail(`[2] de/hangar.html nennt die Tabs "${pageTabs(PAGES[1].html)}" statt "${refTabs}"`);
let shapeBad = 0, shapeChecked = 0;
for (const lang of ['en', 'de']) {
  for (const b of BAYS[lang]) {
    shapeChecked++;
    const bad = [];
    if (b.id !== b.name) bad.push(`main[data-bay-id]="${b.id}" statt "${b.name}"`);
    // Jede Region genau einmal und keine weitere: eine Region, die der Controller nicht einsetzt, ist totes Gewicht je Abruf.
    if (b.regions.join(' ') !== REGIONS.join(' ')) bad.push(`Regionen "${b.regions.join(' ')}" statt "${REGIONS.join(' ')}"`);
    if (b.tabs.join(' ') !== refTabs) bad.push(`Tabs "${b.tabs.join(' ')}" statt "${refTabs}"`);
    if (b.styleTags || b.scriptTags) bad.push(`${b.styleTags}× <style>, ${b.scriptTags}× <script>`);
    const foreign = b.styleAttrs.filter((s) => !/^--w:\d+%$/.test(s));
    if (foreign.length) bad.push(`style= ausser Balkenbreite: "${foreign[0]}"`);
    if (bad.length) { shapeBad++; fail(`[2] ${b.file}: ${bad.join('; ')}`); }
  }
}
say(`    Tab-Folge: ${refTabs}`);
sollIst(`0 abweichende von ${shapeChecked} Buchten`, shapeBad);
if (!refTabs.includes('overview')) fail('[2] keine Bucht traegt ein Ueberblick-Panel');

say('\n[3a] Marker in der Rumpfbox und an einer Zeile, die ihren Port fuehrt (EN)');
let markTotal = 0;
const outside = [];
for (const b of BAYS.en) {
  const rowBy = new Map(b.rows.map((r) => [r.key, r]));
  for (const m of b.marks) {
    markTotal++;
    const where = `${b.name} ${m.port}`;
    if (m.p.length !== 3 || !m.p.every(Number.isFinite)) { outside.push(`${where}: data-p ist kein Punkt`); continue; }
    if (!b.box) { outside.push(`${where}: Bucht ohne data-box`); continue; }
    for (let a = 0; a < 3; a++) {
      const lo = b.box[a], hi = b.box[a + 3];
      const pad = Math.max(1, (hi - lo) * 0.15);
      if (m.p[a] < lo - pad || m.p[a] > hi + pad) { outside.push(`${where}: Achse ${'xyz'[a]} ${m.p[a]} ausserhalb ${lo}…${hi} (±${pad.toFixed(2)})`); break; }
    }
    if (!m.rows.length) outside.push(`${where}: Marker ohne Zeile`);
    for (const key of m.rows) {
      const r = rowBy.get(key);
      if (!r) outside.push(`${where}: Zeile ${key} fehlt`);
      else if (!r.ports.includes(m.port)) outside.push(`${where}: Zeile ${key} fuehrt den Port nicht`);
      else if (r.tab !== m.tab) outside.push(`${where}: Zeile ${key} steht in ${r.tab}, der Marker in ${m.tab}`);
    }
  }
}
say(`    Marker geprueft: ${markTotal}`);
sollIst('0 ausserhalb oder ohne Zeile', outside.length);
for (const o of outside.slice(0, 10)) say(`      ${o}`);
for (const o of outside) fail(`[3a] ${o}`);

say('\n[3b] Z-Ausdehnung der Rumpfbox gegen die Schiffslaenge aus dem Dock (data-v len, EN)');
let withLen = 0, alongZ = 0;
for (const b of BAYS.en) {
  const len = DOCK.en.figures.get(b.name)?.len ?? null;
  if (!(len > 0) || !b.box) continue;
  withLen++;
  const ez = b.box[5] - b.box[2];
  if (Math.abs(ez - len) / len <= 0.3) alongZ++;
}
say(`    Schiffe mit Laenge und Box: ${withLen}   davon Laenge entlang Z (±30 %): ${alongZ}`);
const ist = {
  rumpfLaengeAufZ: alongZ,
  marker: markTotal,
  slotZeilen: BAYS.en.reduce((n, b) => n + b.rows.length, 0),
  slotZeilenMitWerten: BAYS.en.reduce((n, b) => n + b.rows.filter((r) => r.numbers).length, 0),
  schiffeMitWaffen: BAYS.en.filter((b) => b.rows.some((r) => r.tab === 'weapons')).length,
  werkhalle: werkZahl.length ? Math.min(...werkZahl) : 0,
};

say('\n[4] EN gleich DE je Schiff: Zeilen und Marker');
const deBy = new Map(BAYS.de.map((b) => [b.name, b]));
const parity = [];
for (const en of BAYS.en) {
  const de = deBy.get(en.name);
  if (!de) continue; // fehlt die DE-Bucht, meldet [1] das Schiff
  const sig = (b) => `${b.rows.map((r) => r.key).join(',')}|${b.marks.length}`;
  if (sig(en) !== sig(de)) parity.push(`${en.name}: EN ${en.rows.length} Zeilen/${en.marks.length} Marker, DE ${de.rows.length}/${de.marks.length}`);
}
say(`    Paare geprueft: ${BAYS.en.filter((b) => deBy.has(b.name)).length}`);
sollIst('0 Abweichungen', parity.length);
for (const p of parity.slice(0, 10)) say(`      ${p}`);
for (const p of parity) fail(`[4] ${p}`);

for (const lang of ['en', 'de']) {
  const sizes = BAYS[lang].map((b) => b.bytes);
  ist[`buchtMaxKB:${lang}`] = sizes.length ? Math.max(...sizes) / 1024 : 0;
  ist[`buchtenSummeMB:${lang}`] = sizes.reduce((a, b) => a + b, 0) / 1048576;
}
say('\n[5] Zaehlungen gegen die Klinken (EN; [4] haelt DE gleich)   [6] Groessendeckel je Sprache');
say(`    ${'Kennzahl'.padEnd(24)}${'Soll'.padStart(12)}${'Ist'.padStart(12)}`);
for (const k of KLINKEN) {
  const values = k.regel === 'max' ? ['en', 'de'].map((l) => [`${k.id} ${l.toUpperCase()}`, ist[`${k.id}:${l}`]]) : [[k.id, ist[k.id]]];
  for (const [label, v] of values) {
    const grenze = k.regel === 'max' ? k.wert : Math.floor(k.wert * (1 - (k.toleranzProzent ?? 0) / 100));
    const ok = k.regel === 'max' ? v <= grenze : v >= grenze;
    const shown = Number.isInteger(v) ? v : v.toFixed(2);
    say(`    ${label.padEnd(24)}${((k.regel === 'max' ? '<= ' : '>= ') + grenze).padStart(12)}${String(shown).padStart(12)}${ok ? '' : '   GERISSEN'}`);
    if (!ok) {
      fail(k.regel === 'max'
        ? `[6] ${label}: ${shown} ueber dem Deckel ${grenze} — Anlass: ${k.anlass}`
        : `[5] ${label}: ${v} liegt unter der Klinke ${grenze} (Baseline ${k.wert}${k.toleranzProzent ? `, Toleranz ${k.toleranzProzent} %` : ''}) — Ursache klaeren, nicht die Klinke senken. Anlass: ${k.anlass}`);
    }
  }
}

say('\n[7] Viewer-Naht: hangar-viewer.js liefert project, focus, setCover, onFrame, fit, paint');
const viewerFile = join(DIST, 'assets', 'hangar-viewer.js');
const viewer = existsSync(viewerFile) ? readFileSync(viewerFile, 'utf8') : '';
const api = viewer.slice(viewer.lastIndexOf('return {'));
const SEAM = ['project', 'focus', 'setCover', 'onFrame', 'fit', 'paint'];
const seam = SEAM.filter((n) => new RegExp(`\\b${n}\\b`).test(api));
sollIst(SEAM.join(', '), seam.join(', ') || '—');
if (seam.length !== SEAM.length) fail(`[7] dist/assets/hangar-viewer.js liefert nicht mehr ${SEAM.filter((n) => !seam.includes(n)).join(', ')} — Absprache: .planning/notes/hangar-naht.md`);

say('\n[8] Import-Map vor dem ersten Modul-Skript (beide Hangarseiten)');
for (const page of PAGES) {
  const map = page.html.search(/<script\b[^>]*type="importmap"/);
  const mod = page.html.search(/<script\b[^>]*type="module"/);
  const ok = map >= 0 && (mod < 0 || map < mod);
  say(`    ${page.file}: Import-Map bei ${map}, erstes Modul-Skript bei ${mod}${ok ? '' : '   GERISSEN'}`);
  if (!ok) fail(`[8] ${page.file}: ${map < 0 ? 'keine Import-Map' : 'ein Modul-Skript steht vor der Import-Map'} — three.js laedt dann nicht`);
}

say('\n[9] Jede Vorlage aus msg(…) im Controller steht auf beiden Hangarseiten');
const ctrlFile = join(DIST, 'assets', 'hangar-overview.js');
const ctrl = existsSync(ctrlFile) ? readFileSync(ctrlFile, 'utf8') : '';
if (!ctrl) fail('[9] dist/assets/hangar-overview.js fehlt');
const msgIds = [...new Set([...ctrl.matchAll(/\bmsg\('([a-z-]+)'\)/g)].map((m) => m[1]))];
for (const page of PAGES) {
  const missing = msgIds.filter((id) => !page.html.includes(`data-msg="${id}"`));
  say(`    ${page.file}: ${msgIds.length - missing.length} von ${msgIds.length} (${msgIds.join(', ') || '—'})`);
  for (const id of missing) fail(`[9] ${page.file}: Vorlage data-msg="${id}" fehlt, der Controller verlangt sie`);
}
if (ctrl && !msgIds.length) fail('[9] keine msg(…)-Aufrufe im Controller gefunden — der Leser ist kaputt, nicht der Controller leer');

say('\n[10] Dock-Daten: data-v in der Folge von data-stats, gegen Vergleichstabelle, Sortierung und Ueberblick (beide Hangarseiten)');
// Zahl einer Zeile des EN-Ueberblicks ("1,944.5 DPS", "21 m", "1"); der Strich ist unbekannt.
const enNumber = (text) => (text.trim() === '–' ? null : Number(text.replace(/,/g, '').trim().split(' ')[0]));
const overviewBy = new Map(BAYS.en.map((b) => [b.name, b.overview]));
for (const page of PAGES) {
  const { keys, cards, figures } = DOCK[page.lang];
  const bad = cards.filter((c) => c.v.length !== keys.length || c.v.some((x) => x !== '-' && !Number.isFinite(Number(x))));
  const total = dockIds(page.html).length;
  const cmpHtml = /id="hgx-cmp-table">([\s\S]*?)<\/table>/.exec(page.html)?.[1] ?? '';
  const cmpKeys = [...cmpHtml.matchAll(/<tr data-k="([a-zA-Z0-9]+)"/g)].map((m) => m[1]);
  const sortHtml = /<select id="hgx-sort"[^>]*>([\s\S]*?)<\/select>/.exec(page.html)?.[1] ?? '';
  const sortKeys = [...sortHtml.matchAll(/<option value="([a-zA-Z0-9]+)"/g)].map((m) => m[1]).filter((k) => k !== 'name');
  const missing = [...new Set([...cmpKeys, ...sortKeys])].filter((k) => !keys.includes(k));
  // Anzahl und Zahlform sehen eine verrutschte Folge nicht; der Ueberblick
  // derselben Bucht nennt die Werte mit Namen.
  let compared = 0;
  const off = [];
  for (const c of cards) {
    for (const row of overviewBy.get(c.id) ?? []) {
      if (!keys.includes(row.k)) continue;
      compared++;
      const v = figures.get(c.id)[row.k];
      const want = v === null || v <= 0 ? null : v; // fuer 0 druckt der Ueberblick den Strich
      if (enNumber(row.text) !== want) off.push(`${c.id} ${row.k}: data-v ${v ?? '-'}, Ueberblick "${row.text}"`);
    }
  }
  say(`    ${page.file}: ${keys.length} Schluessel, ${cards.length} von ${total} Karten mit data-v, Vergleichstabelle ${cmpKeys.length} Zeilen, Sortierung ${sortKeys.length} Kennwerte, ${compared} Werte gegen den Ueberblick`);
  sollIst(`0 abweichende Karten, alle ${total} mit data-v, 0 fehlende Schluessel, 0 Werte neben dem Ueberblick`, `${bad.length} abweichend, ${total - cards.length} ohne, ${missing.length} fehlend, ${off.length} daneben`);
  for (const c of bad.slice(0, 10)) say(`      ${c.id}: ${c.v.length} Werte "${c.v.join(' ')}"`);
  for (const o of off.slice(0, 10)) say(`      ${o}`);
  for (const c of bad) fail(`[10] ${page.file}: Karte ${c.id} traegt ${c.v.length} Werte statt ${keys.length} oder einen, der keine Zahl ist — catalog.ts dockFigures`);
  if (cards.length !== total) fail(`[10] ${page.file}: ${total - cards.length} Karten ohne data-v`);
  if (!keys.length) fail(`[10] ${page.file}: das Dock nennt keine Schluessel (data-stats)`);
  if (cmpKeys.length < 13) fail(`[10] ${page.file}: die Vergleichstabelle hat ${cmpKeys.length} Zeilen, mindestens 13`);
  if (!compared) fail(`[10] ${page.file}: kein Wert gegen den Ueberblick geprueft — der Leser ist kaputt, nicht das Dock leer`);
  for (const k of missing) fail(`[10] ${page.file}: ${k} steht in der Vergleichstabelle oder der Sortierung, aber nicht in data-stats`);
  for (const o of off) fail(`[10] ${page.file}: ${o} — data-v und data-stats laufen auseinander (catalog.ts dockFigures)`);
}

say('\n[11] Jeder Port der Buchten passt auf PORT_RE des Controllers (EN und DE)');
const portRule = /const PORT_RE = \/(.+)\/([a-z]*);/.exec(ctrl);
if (!portRule) fail('[11] dist/assets/hangar-overview.js nennt keine PORT_RE mehr — der Leser ist kaputt oder die Regel ist umgezogen');
else {
  const rule = new RegExp(portRule[1], portRule[2]);
  let ports = 0;
  const wrong = [];
  for (const lang of ['en', 'de']) {
    for (const b of BAYS[lang]) {
      for (const p of new Set([...b.rows.flatMap((r) => r.ports), ...b.marks.map((m) => m.port)])) {
        ports++;
        if (!rule.test(p)) wrong.push(`${b.file}: "${p}"`);
      }
    }
  }
  say(`    Regel /${portRule[1]}/${portRule[2]}   Ports geprueft: ${ports}`);
  sollIst('0 Ports neben der Regel', wrong.length);
  for (const w of wrong.slice(0, 10)) say(`      ${w}`);
  for (const w of wrong) fail(`[11] ${w} passt nicht auf PORT_RE; parseState verwirft ?hp= mit diesem Port`);
  if (!ports) fail('[11] keine Ports gelesen');
}

say('\n[12] Leistungsstufen: pickQuality gegen eine Liste von Grafikchips, Naht zu Controller und Seite');
// Erwartung je Chip, wie WEBGL_debug_renderer_info ihn meldet (Chrome/ANGLE,
// Firefox, Safari, Telefone). Wer die Einteilung bewusst aendert, aendert sie hier mit.
const CHIPS = [
  ['ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)', {}, 'niedrig'],
  ['ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0, D3D11)', {}, 'niedrig'],
  ['Mesa Intel(R) UHD Graphics 620 (KBL GT2)', {}, 'niedrig'],
  ['ANGLE (NVIDIA, NVIDIA GeForce GT 1030 Direct3D11 vs_5_0 ps_5_0, D3D11)', {}, 'niedrig'],
  ['ANGLE (AMD, AMD Radeon(TM) R7 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', {}, 'niedrig'],
  ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', {}, 'niedrig'],
  ['Mali-G52 MC2', { small: true }, 'niedrig'],
  ['Adreno (TM) 506', { small: true }, 'niedrig'],
  ['PowerVR Rogue GE8320', { small: true }, 'niedrig'],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', { memory: 2 }, 'niedrig'],
  ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)', {}, 'mittel'],
  ['ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)', { cores: 12 }, 'mittel'],
  ['ANGLE (NVIDIA, NVIDIA GeForce MX450 Direct3D11 vs_5_0 ps_5_0, D3D11)', {}, 'mittel'],
  ['Adreno (TM) 640', { small: true, memory: 8, cores: 8 }, 'mittel'],
  ['Mali-G78 MP20', { small: true, memory: 8, cores: 8 }, 'mittel'],
  ['', { small: true, cores: 8 }, 'mittel'],
  ['', { cores: 4 }, 'mittel'],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', { memory: 8, cores: 16 }, 'hoch'],
  ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)', { memory: 8, cores: 8 }, 'hoch'],
  ['ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', { cores: 12 }, 'hoch'],
  ['ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', { cores: 8 }, 'hoch'],
  ['Apple GPU', { small: true }, 'hoch'],
  ['Adreno (TM) 730', { small: true, memory: 8, cores: 8 }, 'hoch'],
  ['', { memory: 8, cores: 8 }, 'hoch'],
  ['Mali-G52 MC2', { small: true, forced: 'hoch' }, 'hoch'],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', { forced: 'niedrig' }, 'niedrig'],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', { forced: 'ultra', memory: 8 }, 'hoch'],
];
const CHIPS_MIN = 25;
const LEVELS = ['niedrig', 'mittel', 'hoch'];
{
  let mod = null;
  try { mod = await import(new URL(`file://${viewerFile}`).href); } catch (e) { fail(`[12] dist/assets/hangar-viewer.js laedt nicht als Modul (${e.message})`); }
  let checked = 0;
  const wrong = [];
  if (mod) {
    const lv = JSON.stringify(mod.QUALITY_LEVELS ?? null);
    sollIst(`QUALITY_LEVELS ${JSON.stringify(LEVELS)}`, lv);
    if (lv !== JSON.stringify(LEVELS)) fail(`[12] QUALITY_LEVELS ist ${lv} statt ${JSON.stringify(LEVELS)}: Schalter, Controller und dieses Tor nennen die drei Stufen`);
    if (typeof mod.pickQuality !== 'function') fail('[12] der Viewer exportiert pickQuality nicht mehr');
    else {
      for (const [gpu, o, want] of CHIPS) {
        checked++;
        const got = mod.pickQuality({ gpu, ...o })?.level;
        if (got !== want) wrong.push(`${gpu || '(kein Name)'} ${JSON.stringify(o)}: ${got} statt ${want}`);
      }
    }
  }
  sollIst(`${CHIPS.length} Chips in ihrer Stufe`, `${checked - wrong.length} von ${checked}`);
  for (const w of wrong) { say(`      ${w}`); fail(`[12] pickQuality: ${w}`); }
  if (checked < CHIPS_MIN) fail(`[12] nur ${checked} Grafikchips geprueft, Klinke ${CHIPS_MIN}`);
  const apiQ = ['quality', 'onQuality'].filter((n) => !new RegExp(`\\b${n}\\b`).test(api));
  sollIst('Viewer liefert quality, onQuality', apiQ.length ? `fehlt ${apiQ.join(', ')}` : 'ja');
  for (const n of apiQ) fail(`[12] dist/assets/hangar-viewer.js liefert ${n} nicht mehr: der Grafik-Schalter zeigt dann keine Stufe`);
  const ctrl = existsSync(join(DIST, 'assets', 'hangar-overview.js')) ? readFileSync(join(DIST, 'assets', 'hangar-overview.js'), 'utf8') : '';
  const call = /initHangar\([^{]*\{([^}]*)\}/.exec(ctrl)?.[1] ?? '';
  const passes = /\bgpu:/.test(call) && /\bquality:/.test(call);
  sollIst('Controller gibt gpu und quality an initHangar', passes ? 'ja' : `nein (${call.trim().slice(0, 80) || 'kein Aufruf'})`);
  if (!passes) fail('[12] dist/assets/hangar-overview.js gibt gpu und quality nicht mehr an initHangar: jedes Geraet bekaeme die Stufe ohne Chipnamen und ohne Wahl von Hand');
  for (const page of PAGES) {
    const sel = /<select id="hgx-gfx">([\s\S]*?)<\/select>/.exec(page.html)?.[1] ?? null;
    const vals = sel === null ? null : [...sel.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
    const okSel = vals && JSON.stringify(vals) === JSON.stringify(['auto', ...LEVELS.slice().reverse()]);
    say(`    ${page.file}: Grafik-Schalter ${vals ? vals.join(', ') : 'fehlt'}${okSel ? '' : '   GERISSEN'}`);
    if (!okSel) fail(`[12] ${page.file}: Grafik-Schalter #hgx-gfx ${vals ? `nennt ${vals.join(', ')}` : 'fehlt'} statt auto, hoch, mittel, niedrig`);
  }
  ist.chips = checked;
}

say('\n[13] Getauschte Bordwaffen: Modelle der Werkstatt und Tauschteile der Schiffe');
// Sperrklinken (Grundsatz 5), Startwerte aus dem ersten Bau am 18.10.2026:
// 112 der 125 gebauten Waffenmodelle passen in einen Werkstatt-Slot, die
// zehn Schiffe mit Lack tragen 37 Waffen-Ports als Tauschteile.
const TAUSCH = { modelle: 112, ports: 37 };
{
  const lf = join(DIST, 'hangar-layouts.json');
  const ld = existsSync(lf) ? JSON.parse(readFileSync(lf, 'utf8')) : {};
  const models = Object.entries(ld.models ?? {});
  const bad = models.filter(([, u]) => !/\?v=[0-9a-f]{6,}$/.test(u) || !existsSync(join(DIST, u.replace(/\?.*$/, ''))));
  for (const [k, u] of bad.slice(0, 10)) fail(`[13] Werkstatt-Modell ${k}: ${u} ohne ?v= oder nicht in dist/`);
  const notGun = models.filter(([k]) => ld.items?.[k]?.[2] !== 'gun');
  for (const [k] of notGun.slice(0, 10)) fail(`[13] Werkstatt-Modell ${k} ist keine Bordwaffe der Werkstatt`);
  const shipDir = join(DIST, 'hangar', 'ships');
  let ports = 0, nodes = 0, badAnchor = 0;
  const perShip = [];
  for (const f of existsSync(shipDir) ? readdirSync(shipDir).filter((x) => x.endsWith('.glb')) : []) {
    const buf = readFileSync(join(shipDir, f));
    const len = buf.readUInt32LE(12);
    const gltf = buf.toString('utf8', 16, 20) === 'JSON' ? JSON.parse(buf.toString('utf8', 20, 20 + len)) : {};
    const mine = new Set();
    for (const n of gltf.nodes ?? []) {
      const x = n.extras;
      if (typeof x?.swap !== 'string') continue;
      nodes++;
      mine.add(`${x.swap}|${x.item ?? 0}`);
      if (!Array.isArray(x.anchor) || x.anchor.length !== 16 || !x.anchor.every(Number.isFinite)) badAnchor++;
    }
    ports += mine.size;
    perShip.push(`${f.replace(/\.glb$/, '')} ${mine.size}`);
  }
  if (badAnchor) fail(`[13] ${badAnchor} Tauschteil-Knoten ohne gueltige anchor-Matrix: der Viewer setzt die Waffe dort nicht`);
  say(`    Werkstatt-Modelle: ${models.length} (${bad.length} ohne Datei/Version, ${notGun.length} keine Bordwaffe)   Tauschteile: ${ports} Ports in ${perShip.length} Schiffen, ${nodes} Knoten`);
  say(`      ${perShip.join(', ')}`);
  sollIst(`Modelle >= ${TAUSCH.modelle}, Ports >= ${TAUSCH.ports}`, `${models.length}, ${ports}`);
  if (models.length < TAUSCH.modelle) fail(`[13] nur ${models.length} Waffenmodelle in der Werkstatt (Klinke ${TAUSCH.modelle}): fehlt src/data/hangar-assets.json weapons oder der Schluessel-Join in src/lib/hangar/layouts.ts?`);
  if (ports < TAUSCH.ports) fail(`[13] nur ${ports} Waffen-Ports mit Tauschteilen (Klinke ${TAUSCH.ports}): Schiffe ohne markSwapParts gebaut (scripts/build-hangar-assets.mjs)?`);
  ist.tauschModelle = models.length; ist.tauschPorts = ports;
}

say('\n[14] Lackierungen: Daten der Werkstatt und Palettenmaterialien der Schiffe mit Lack');
// Sperrklinken (Grundsatz 5), Startwerte aus dem ersten Datenlauf am
// 18.10.2026 (datamine:paints): 207 Schiffe, 2068 Lackierungen; von den zehn
// Schiffen mit Lack sind neun umfaerbbar (die 300i hat keine Serienpalette
// und keine Lackierungen).
const LACK = { schiffe: 207, lackierungen: 2068, umfaerbbar: 9 };
{
  const lf = join(DIST, 'hangar-layouts.json');
  const ld = existsSync(lf) ? JSON.parse(readFileSync(lf, 'utf8')) : {};
  const HEXC = /^#[0-9a-f]{6}$/;
  const entries = Object.entries(ld.paints ?? {});
  let rows = 0, pattern = 0;
  for (const [ship, p] of entries) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(ship)) fail(`[14] Lackierungen unter der Schiffskennung ${JSON.stringify(ship)}, die der Controller nie meldet`);
    if (!Array.isArray(p.base) || p.base.length !== 3 || !p.base.every((c) => HEXC.test(c))) fail(`[14] ${ship}: Serienpalette ${JSON.stringify(p.base)} ist nicht drei #rrggbb`);
    const ids = new Set();
    for (const r of p.list ?? []) {
      rows++;
      if (r[5] === 1) pattern++;
      const ok = Array.isArray(r) && r.length === 6 && /^[a-z0-9][a-z0-9-]{0,63}$/.test(r[0]) && typeof r[1] === 'string' && r[1].trim()
        && r.slice(2, 5).every((c) => HEXC.test(c)) && (r[5] === 0 || r[5] === 1);
      if (!ok) fail(`[14] ${ship}: Lackierung ${JSON.stringify(r).slice(0, 120)} hat nicht die Form [kennung, name, #haupt, #zweit, #akzent, 0|1]`);
      if (ids.has(r[0])) fail(`[14] ${ship}: Kennung ${r[0]} doppelt`);
      ids.add(r[0]);
    }
  }
  // Wie der Viewer (hullTint): Ton der Serienpalette, sRGB nach linear, Summe
  // der Abstaende < 3e-3; traegt das Modell Lackkanaele, nur mit passendem Kanal.
  const lin = (h) => [1, 3, 5].map((i) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const shipDir = join(DIST, 'hangar', 'ships');
  const tex = existsSync(shipDir) ? readdirSync(shipDir).filter((x) => x.endsWith('.glb')).map((x) => x.replace(/\.glb$/, '')) : [];
  const perShip = [];
  let recolor = 0;
  for (const ship of tex) {
    const p = ld.paints?.[ship];
    if (!p) { perShip.push(`${ship} ohne Lackierungen`); continue; }
    const buf = readFileSync(join(shipDir, `${ship}.glb`));
    const len = buf.readUInt32LE(12);
    const gltf = buf.toString('utf8', 16, 20) === 'JSON' ? JSON.parse(buf.toString('utf8', 20, 20 + len)) : {};
    const want = p.base.map(lin);
    const hits = [0, 0, 0];
    const tagged = (gltf.materials ?? []).some((m) => m.extras?.palette_tint != null);
    for (const m of gltf.materials ?? []) {
      const f = m.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
      const pt = m.extras?.palette_tint;
      const i = want.findIndex((w, k) => (tagged ? pt === k + 1 : true) && Math.abs(w[0] - f[0]) + Math.abs(w[1] - f[1]) + Math.abs(w[2] - f[2]) < 3e-3);
      if (i >= 0) hits[i]++;
    }
    if (hits.some(Boolean)) recolor++;
    perShip.push(`${ship} ${hits.join('/')}`);
  }
  say(`    Schiffe mit Lackierungen: ${entries.length}   Lackierungen: ${rows} (${pattern} mit Muster)   umfaerbbar mit Lack: ${recolor} von ${tex.length}`);
  say(`      Palettenmaterialien Haupt/Zweit/Akzent: ${perShip.join(', ')}`);
  sollIst(`Schiffe >= ${LACK.schiffe}, Lackierungen >= ${LACK.lackierungen}, umfaerbbar >= ${LACK.umfaerbbar}`, `${entries.length}, ${rows}, ${recolor}`);
  if (entries.length < LACK.schiffe) fail(`[14] nur ${entries.length} Schiffe mit Lackierungen (Klinke ${LACK.schiffe}): fehlt src/data/ship-paints.json oder passt die Schiffskennung nicht?`);
  if (rows < LACK.lackierungen) fail(`[14] nur ${rows} Lackierungen (Klinke ${LACK.lackierungen})`);
  if (recolor < LACK.umfaerbbar) fail(`[14] nur ${recolor} Schiffe mit Lack, deren Palettenmaterialien die Serienpalette tragen (Klinke ${LACK.umfaerbbar}): die Lackierung faerbt am Modell nichts um`);
  ist.lackSchiffe = entries.length; ist.lackierungen = rows; ist.lackUmfaerbbar = recolor;
}

say('\n[15] Raketen der Werkstatt: Serienteil, Art, Groesse und Gruppe je Halterung');
// Sperrklinken (Grundsatz 5), Startwerte aus dem ersten Bau am 19.10.2026.
const RAKETEN = { schiffe: 152, slots: 468, tauschbar: 462, halterWahl: 214 };
{
  const lf = join(DIST, 'hangar-layouts.json');
  const ld = existsSync(lf) ? JSON.parse(readFileSync(lf, 'utf8')) : {};
  const ORD = new Set(['missile', 'torpedo', 'gmissile', 'bomb']);
  const items = ld.items ?? {};
  // Kandidaten je Art und Groesse, wie candidates() im Client
  const pool = new Map();
  for (const it of Object.values(items)) if (ORD.has(it[2])) pool.set(`${it[2]}|${it[3]}`, (pool.get(`${it[2]}|${it[3]}`) ?? 0) + 1);
  let ships = 0, slots = 0, swappable = 0, rackPorts = 0;
  const byType = {};
  const racks = ld.racks ?? {};
  const usedRacks = new Set();
  for (const [ship, rows] of Object.entries(ld.ships ?? {})) {
    const mine = rows.filter((r) => ORD.has(r[1]));
    if (!mine.length) continue;
    ships++;
    for (const [key, type, size, stock, group, count] of mine) {
      slots++;
      byType[type] = (byType[type] ?? 0) + 1;
      const it = items[stock];
      if (!it) fail(`[15] ${ship} ${key}: Serienteil ${JSON.stringify(stock)} fehlt im Katalog der Werkstatt`);
      else if (it[2] !== type || it[3] !== size) fail(`[15] ${ship} ${key}: Serienteil ${stock} ist ${it[2]} S${it[3]}, der Slot ${type} S${size}`);
      if (group !== (type === 'bomb' ? 'bomb' : 'missile')) fail(`[15] ${ship} ${key}: Gruppe ${group} passt nicht zur Art ${type}`);
      if (!Number.isInteger(count) || count < 1) fail(`[15] ${ship} ${key}: Stueckzahl ${count}`);
      if ((pool.get(`${type}|${size}`) ?? 0) > 1) swappable++;
      const choice = mine.find((r) => r[0] === key)?.[6];
      if (!choice) continue;
      rackPorts++;
      if (!Array.isArray(choice) || choice.length < 2 || new Set(choice).size !== choice.length) fail(`[15] ${ship} ${key}: Halterungen ${JSON.stringify(choice)} sind keine Wahl aus mindestens zwei verschiedenen`);
      for (const rk of choice) {
        usedRacks.add(rk);
        const r = racks[rk];
        const form = Array.isArray(r) && r.length === 8 && typeof r[0] === 'string' && !!r[0].trim()
          && (r[1] === 0 || (typeof r[1] === 'string' && !!r[1].trim())) && Number.isInteger(r[2]) && r[2] >= 1
          && Number.isInteger(r[3]) && r[3] >= 1 && Number.isInteger(r[4]) && r[4] >= 1 && ORD.has(r[5])
          && (r[6] === 0 || (typeof r[6] === 'string' && !!r[6].trim())) && (r[7] === 0 || (Number.isFinite(r[7]) && r[7] > 0));
        if (!form) { fail(`[15] ${ship} ${key}: Halterung ${rk} fehlt in racks oder hat nicht die Form [name, nameDe|0, groesse, plaetze, raketengroesse, art, hersteller|0, preis|0]`); continue; }
        if (!pool.get(`${r[5]}|${r[4]}`)) fail(`[15] ${ship} ${key}: in Halterung ${rk} (${r[5]} S${r[4]}) passt keine Rakete des Katalogs`);
      }
      const st = racks[choice[0]];
      if (st && (st[5] !== type || st[4] !== size || st[3] !== count)) fail(`[15] ${ship} ${key}: Serienhalterung ${choice[0]} traegt ${st[3]}x ${st[5]} S${st[4]}, der Slot ${count}x ${type} S${size}`);
    }
  }
  const idle = Object.keys(racks).filter((k) => !usedRacks.has(k));
  if (idle.length) fail(`[15] ${idle.length} Halterungen in racks, die kein Slot anbietet: ${idle.slice(0, 5).join(', ')}`);
  say(`    Schiffe mit Raketenslots: ${ships}   Slots: ${slots} (${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(', ')})   mit Alternative: ${swappable}   mit Wahl der Halterung: ${rackPorts} (${Object.keys(racks).length} Halterungen)`);
  sollIst(`Schiffe >= ${RAKETEN.schiffe}, Slots >= ${RAKETEN.slots}, mit Alternative >= ${RAKETEN.tauschbar}, mit Halterwahl >= ${RAKETEN.halterWahl}`, `${ships}, ${slots}, ${swappable}, ${rackPorts}`);
  if (ships < RAKETEN.schiffe) fail(`[15] nur ${ships} Schiffe mit Raketenslots (Klinke ${RAKETEN.schiffe}): bricht der Join Rakete -> Katalog in src/lib/hangar/layouts.ts (itemType, typeOf)?`);
  if (slots < RAKETEN.slots) fail(`[15] nur ${slots} Raketenslots (Klinke ${RAKETEN.slots})`);
  if (swappable < RAKETEN.tauschbar) fail(`[15] nur ${swappable} Raketenslots mit einer Alternative zum Serienteil (Klinke ${RAKETEN.tauschbar}): fehlen Raketen oder Torpedos im Katalog?`);
  if (rackPorts < RAKETEN.halterWahl) fail(`[15] nur ${rackPorts} Raketenslots mit Wahl der Halterung (Klinke ${RAKETEN.halterWahl}): fehlt src/data/ship-missile-racks.json, oder passt die Serienhalterung nicht mehr zum Loadout (rackChoice in src/lib/hangar/layouts.ts)?`);
  ist.raketenSchiffe = ships; ist.raketenSlots = slots; ist.raketenTauschbar = swappable; ist.halterWahl = rackPorts;
}

// Sperrklinke (Grundsatz 5), Startwert 20.10.2026: Klaenge des Hangars in
// SND_FILES (Plattform 3, Tor 2); am 21.10.2026 von 12 auf 6, die sechs
// Dampfklaenge sind raus (Krisz: „dampf sound ist super crappy“), dann von
// 6 auf 5, der Warnton ist raus (Krisz: „mach diesen alarm sound aus“)
const KLINKE_TON = 5;
// Anschlag der Torklaenge neben dem Ende der Bahn, Anteil der Bahn: Darüber
// liefe das Tor ein gutes Stück still, oder der Klang finge vor ihm an
const TOR_TAKT_LUFT = 0.25;
say('\n[16] Bildlook, Ausgabe und Ton: Einhaengepunkte in three.js, Naht zu Controller und Seite');
// Der Viewer haengt sich mit zwei Textstellen in three.js ein (Bildlook in
// die Tonabbildung, Rauschen hinter die sRGB-Umrechnung). Beide liest das Tor
// aus dem ausgelieferten Viewer selbst, keine Liste hier: nach einem Update
// von three.js fiele die Halle sonst still auf ACES zurueck, und nur ein
// Auge, das den alten Look kennt, saehe es.
{
  const vendor = (...p) => { const f = join(DIST, 'vendor', 'three', ...p); return existsSync(f) ? readFileSync(f, 'utf8') : ''; };
  const times = (text, needle) => (needle && text ? text.split(needle).length - 1 : 0);
  const anchors = [
    ['Bildlook', /const LOOK_HOOK = '([^']+)'/, 'three.module.min.js', vendor('three.module.min.js'), 'LOOK_GLSL an den neuen tonemapping_pars_fragment anpassen'],
    ['Ausgaberauschen', /OETF = '([^']+)'/, 'addons/shaders/OutputShader.js', vendor('addons', 'shaders', 'OutputShader.js'), 'die Zeile nach sRGBTransferOETF im OutputShader neu suchen'],
  ];
  for (const [name, re, file, text, fix] of anchors) {
    const needle = re.exec(viewer)?.[1] ?? null;
    const n = times(text, needle);
    sollIst(`${name}: Einhaengepunkt genau einmal in ${file}`, needle ? String(n) : 'der Viewer nennt keinen');
    if (!needle) fail(`[16] dist/assets/hangar-viewer.js nennt den Einhaengepunkt fuer ${name} nicht mehr — der Leser ist kaputt oder der Code ist umgezogen`);
    else if (n !== 1) fail(`[16] ${name}: der Einhaengepunkt steht ${n}-mal in dist/vendor/three/${file} statt einmal; three.js geaendert? ${fix}`);
    else ist.haken = (ist.haken ?? 0) + 1;
  }
  // Die Werte des Looks: von Hand gestimmt, also endliche Zahlen in der Form,
  // die LOOK_GLSL einsetzt (ein NaN baut und zeichnet schwarz).
  let look = null;
  try { look = JSON.parse(/\/\* hall-look \*\/ (\{[^}]*\}) \/\* \/hall-look \*\//.exec(viewer)?.[1] ?? 'null'); } catch { look = null; }
  const num = (x) => typeof x === 'number' && Number.isFinite(x);
  const shape = { exposure: 1, slope: 3, offset: 3, power: 3, sat: 1, curve: 1, shadow: 3, high: 3, balance: 1 };
  const badLook = look ? Object.entries(shape).filter(([k, n]) => !(n === 1 ? num(look[k]) && (look[k] > 0 || k === 'curve') : Array.isArray(look[k]) && look[k].length === n && look[k].every(num))).map(([k]) => k) : null;
  sollIst(`Lookwerte: ${Object.keys(shape).join(', ')}`, badLook === null ? 'nicht lesbar' : badLook.length ? `falsch: ${badLook.join(', ')}` : 'ja');
  if (badLook === null) fail('[16] dist/assets/hangar-viewer.js: der Block /* hall-look */ … /* /hall-look */ fehlt oder ist kein JSON');
  else if (badLook.length) fail(`[16] Lookwerte ${badLook.join(', ')} fehlen oder sind keine endlichen Zahlen in der Form von LOOK_GLSL`);
  // Ton: Viewer liefert Schalter und Abfrage, der Controller gibt die
  // gespeicherte Wahl an initHangar, beide Seiten tragen den Schalter.
  // Ohne Zeilenkommentare: der Kommentar über setSound nennt „sound():“ und
  // hielt die Prüfung grün, auch als das echte sound: fehlte.
  const apiCode = api.replace(/\/\/[^\n]*/g, '');
  const apiS = ['setSound', 'sound'].filter((n) => !new RegExp(`\\b${n}\\s*[(:]`).test(apiCode));
  sollIst('Viewer liefert setSound, sound', apiS.length ? `fehlt ${apiS.join(', ')}` : 'ja');
  for (const n of apiS) fail(`[16] dist/assets/hangar-viewer.js liefert ${n} nicht mehr: der Ton-Schalter bleibt verborgen`);
  const call = /initHangar\([^{]*\{([^}]*)\}/.exec(ctrl)?.[1] ?? '';
  sollIst('Controller gibt sound an initHangar', /\bsound:/.test(call) ? 'ja' : 'nein');
  if (!/\bsound:/.test(call)) fail('[16] dist/assets/hangar-overview.js gibt sound nicht mehr an initHangar: wer den Ton ausgeschaltet hat, hoert ihn beim naechsten Besuch wieder');
  for (const page of PAGES) {
    const btn = /<button\b[^>]*\bid="hgx-snd"[^>]*>/.exec(page.html)?.[0] ?? null;
    const ok = btn && /\bdata-on="[^"]+"/.test(btn) && /\bdata-off="[^"]+"/.test(btn) && /\bhidden\b/.test(btn) && page.html.includes('id="hgx-snd-now"');
    say(`    ${page.file}: Ton-Schalter ${btn ? (ok ? 'mit data-on, data-off, hidden und Anzeige' : 'unvollstaendig') : 'fehlt'}${ok ? '' : '   GERISSEN'}`);
    if (ok) ist.tonSeiten = (ist.tonSeiten ?? 0) + 1;
    if (!ok) fail(`[16] ${page.file}: Ton-Schalter #hgx-snd ${btn ? 'ohne data-on, data-off, hidden oder #hgx-snd-now' : 'fehlt'} (HangarPage.astro)`);
  }
  // Die Klänge selbst (seit 20.10.2026 abends Aufnahmen statt Synthese,
  // scripts/build-hangar-sound.mjs): Jeder Name in SND_FILES des Viewers
  // liegt als MP3 in dem Ordner, den die Seite mitgibt (hall.lift.sound),
  // und die Version dort ist der Inhalt dieser Dateien. Fehlt eine, bleibt
  // ihr Anlass still, und niemand merkt es, der den Ton nicht anhat; passt
  // die Version nicht, hört ein Besucher ein Jahr lang die alte Fassung.
  const sndNames = (() => { try { return JSON.parse((/const SND_FILES = (\[[^\]]*\]);/.exec(viewer)?.[1] ?? 'null').replace(/'/g, '"')); } catch { return null; } })();
  sollIst(`Klaenge: SND_FILES im Viewer, mindestens ${KLINKE_TON} Dateien`, sndNames ? String(sndNames.length) : 'nicht lesbar');
  if (!sndNames) fail('[16] dist/assets/hangar-viewer.js: const SND_FILES = [...] fehlt oder ist nicht lesbar — der Leser ist kaputt oder der Code ist umgezogen');
  else if (sndNames.length < KLINKE_TON) fail(`[16] der Viewer nennt ${sndNames.length} Klaenge, die Klinke ist ${KLINKE_TON}: KLINKE_TON nur per Commit mit Ursache senken`);
  // Tor und Klang im selben Takt (seit 21.10.2026): Die Torklaenge sind auf
  // eine Bahn geschnitten, der Viewer legt ihren Anschlag (SND_HIT) auf das
  // Ende der Bahn. Ist die Bahn viel laenger als der Schnitt, laeuft das Tor
  // erst still; ist sie viel kuerzer, faengt der Klang vor ihm an. So war
  // es vom 20. auf den 21.10., nur andersherum: Tor im Takt der ganzen
  // Aufnahme, 15 s je Bahn, und Krisz fand den Wechsel viel zu langsam.
  const gateMs = (() => { try { return JSON.parse(/\/\* hall-gate \*\/([\s\S]*?)\/\* \/hall-gate \*\//.exec(viewer)?.[1] ?? 'null')?.ms ?? null; } catch { return null; } })();
  const hits = (() => { try { return JSON.parse((/const SND_HIT = (\{[^}]*\});/.exec(viewer)?.[1] ?? 'null').replace(/'/g, '"')); } catch { return null; } })();
  const torHits = ['tor-auf', 'tor-zu'].map((n) => [n, hits?.[n]]);
  sollIst(`Torklaenge: Anschlag (SND_HIT) hoechstens ${TOR_TAKT_LUFT * 100} % der Bahn neben ihrem Ende (HALL_GATE.ms)`, gateMs && hits ? `Bahn ${gateMs} ms, Anschlag ${torHits.map(([n, h]) => `${n} ${h} s`).join(', ')}` : 'nicht lesbar');
  if (!hits) fail('[16] dist/assets/hangar-viewer.js: const SND_HIT = {...} fehlt oder ist nicht lesbar — der Leser ist kaputt oder der Code ist umgezogen');
  else if (!(gateMs > 0)) fail('[16] dist/assets/hangar-viewer.js: HALL_GATE.ms im Block /* hall-gate */ fehlt — der Leser ist kaputt oder der Code ist umgezogen');
  else for (const [n, h] of torHits) {
    if (!(h > 0)) fail(`[16] SND_HIT im Viewer nennt ${n} nicht: der Torklang saesse nirgends`);
    else if (Math.abs(h * 1000 - gateMs) > TOR_TAKT_LUFT * gateMs) fail(`[16] ${n} schlaegt ${h} s nach seinem Anfang an, eine Bahn des Tors dauert ${gateMs / 1000} s: ${h * 1000 < gateMs ? 'das Tor liefe erst still' : 'der Klang finge vor dem Tor an'}. Klaenge auf den Takt schneiden (scripts/build-hangar-sound.mjs) oder HALL_GATE.ms zurueck`);
  }
  for (const page of PAGES) {
    let snd = null;
    try { snd = JSON.parse(/<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(page.html)?.[1] ?? 'null')?.opts?.hall?.lift?.sound ?? null; } catch { snd = null; }
    const dir = snd?.dir && /^\/[\w/-]+\/$/.test(snd.dir) ? join(DIST, ...snd.dir.split('/').filter(Boolean)) : null;
    const files = (sndNames ?? []).map((n) => join(dir ?? DIST, `${n}.mp3`));
    // MP3 ohne Kopf: Rahmensynchron 0xFFE am Anfang
    const bad = dir ? files.filter((f) => { if (!existsSync(f) || statSync(f).size < 2000) return true; const b = readFileSync(f); return !(b[0] === 0xff && (b[1] & 0xe0) === 0xe0); }) : files;
    // Version wie HangarApp.astro: über alle MP3 im Ordner, nach Namen
    // sortiert. Eine übrige Datei (in SND_FILES nicht mehr genannt) geht
    // mit hinein und ist nur Ballast: WARNUNG, kein FEHLER.
    const all = dir && existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort() : [];
    const h = createHash('sha1');
    for (const f of all) h.update(readFileSync(join(dir, f)));
    const v = h.digest('hex').slice(0, 8), vOk = !!snd?.v && snd.v === v;
    const extra = all.filter((f) => !(sndNames ?? []).includes(f.slice(0, -4)));
    if (extra.length) say(`    WARNUNG: ${extra.join(', ')} in ${snd.dir} nennt der Viewer nicht (SND_FILES): wird mit ausgeliefert, aber nie gespielt`);
    sollIst(`${page.file}: Klaenge in ${snd?.dir ?? '?'}, je MP3 ab 2 KB, Version aus dem Inhalt`, !snd ? 'die Seite gibt keinen Ordner mit (hall.lift.sound)' : `${files.length - bad.length} von ${files.length} da, Version ${vOk ? 'passt' : `${snd.v} statt ${v}`}`);
    if (!snd) fail(`[16] ${page.file}: hall.lift.sound fehlt in #hg-stage (HangarApp.astro): der Ton-Schalter schaltet nichts ein`);
    else if (!dir) fail(`[16] ${page.file}: hall.lift.sound.dir "${snd.dir}" ist kein Ordnerpfad der Seite`);
    else {
      for (const f of bad) fail(`[16] ${f.slice(DIST.length + 1)} fehlt, ist kleiner als 2 KB oder kein MP3 ohne Kopf: dieser Klang bliebe still (scripts/build-hangar-sound.mjs)`);
      if (!vOk) fail(`[16] ${page.file}: Version der Klaenge ${snd.v} passt nicht zum Inhalt der Dateien (${v}, sha1 ueber alle MP3 im Ordner nach Namen sortiert wie HangarApp.astro)`);
      if (!bad.length && vOk) ist.tonDateien = files.length;
    }
  }
}

say('\n[17] Bildablage der Schiffe: jeder Verweis liegt in dist/, Name = Inhalt, kein Bild mehr eingebettet, Groessen');
// Seit 25.10.2026 tragen die Schiffs-GLBs ihre Bilder nicht mehr selbst,
// sondern verweisen auf /hangar/tex/<inhalt>.webp (scripts/lib/glb-texpool.mjs,
// .planning/notes/hangar-alle-schiffe.md): ein Bild, das viele Schiffe nutzen,
// liegt einmal da. Fehlt eine Datei, bleibt das Material ohne Karte, und das
// sieht nur, wer genau dieses Schiff waehlt. Klinke: Schiffe mit Bildablage
// (Start 10, waechst mit jedem Lauf des PCs). Deckel: zusammen BILDER.gesamtMB
// fuer GLB und Ablage (Repo und Auslieferungs-Image), je Datei BILDER.dateiMB
// (GitHub warnt ab 50 MB und lehnt ab 100 MB ab).
const BILDER = { schiffe: 90, gesamtMB: 1600, dateiMB: 50 };
{
  const shipDir = join(DIST, 'hangar', 'ships'), texDir = join(DIST, 'hangar', 'tex');
  const NAME = /^\.\.\/tex\/([0-9a-f]{16})\.(webp|png|jpg|ktx2)$/;
  const glbs = existsSync(shipDir) ? readdirSync(shipDir).filter((x) => x.endsWith('.glb')).sort() : [];
  const used = new Map();   // Datei -> Zahl der Schiffe
  let refs = 0, embedded = 0, pooledShips = 0, glbBytes = 0, big = [];
  const missing = new Set(), foreign = [];
  for (const f of glbs) {
    const buf = readFileSync(join(shipDir, f));
    glbBytes += buf.length;
    if (buf.length > BILDER.dateiMB * 1048576) big.push(`${f} ${(buf.length / 1048576).toFixed(1)} MB`);
    const len = buf.readUInt32LE(12);
    const gltf = buf.toString('utf8', 16, 20) === 'JSON' ? JSON.parse(buf.toString('utf8', 20, 20 + len)) : {};
    const mine = new Set();
    let emb = 0;
    for (const img of gltf.images ?? []) {
      if (img.bufferView !== undefined) { emb++; continue; }
      const m = NAME.exec(img.uri ?? '');
      if (!m) { foreign.push(`${f}: ${String(img.uri).slice(0, 60)}`); continue; }
      refs++;
      const file = img.uri.slice('../tex/'.length);
      mine.add(file);
      if (!existsSync(join(texDir, file))) missing.add(`${f} -> ${file}`);
    }
    for (const x of mine) used.set(x, (used.get(x) ?? 0) + 1);
    embedded += emb;
    if (emb) fail(`[17] ${f}: ${emb} Bilder noch eingebettet: node scripts/pool-hangar-textures.mjs (verlustfrei) oder neu bauen (scripts/build-hangar-assets.mjs legt sie selbst ab)`);
    if (mine.size && !emb) pooledShips++;
  }
  const files = existsSync(texDir) ? readdirSync(texDir) : [];
  let poolBytes = 0;
  const wrongName = [], orphans = [];
  for (const f of files) {
    const b = readFileSync(join(texDir, f));
    poolBytes += b.length;
    if (b.length > BILDER.dateiMB * 1048576) big.push(`tex/${f} ${(b.length / 1048576).toFixed(1)} MB`);
    if (createHash('sha256').update(b).digest('hex').slice(0, 16) !== f.replace(/\.\w+$/, '')) wrongName.push(f);
    if (!used.has(f)) orphans.push(f);
  }
  const shared = [...used.values()].filter((n) => n > 1).length;
  const totalMB = (glbBytes + poolBytes) / 1048576;
  say(`    Schiffe: ${glbs.length} (mit Bildablage ${pooledShips})   Bildverweise: ${refs} auf ${used.size} Dateien (${shared} in mehr als einem Schiff)   eingebettet: ${embedded}`);
  say(`    GLB ${(glbBytes / 1048576).toFixed(1)} MB + Ablage ${files.length} Dateien ${(poolBytes / 1048576).toFixed(1)} MB = ${totalMB.toFixed(1)} MB`);
  if (orphans.length) say(`    WARNUNG: ${orphans.length} Bilder in dist/hangar/tex nennt kein Schiff (${orphans.slice(0, 3).join(', ')}${orphans.length > 3 ? ', …' : ''}): Ballast im Image, der Bau entfernt sie (prunePool)`);
  sollIst(`Schiffe mit Bildablage >= ${BILDER.schiffe}, jeder Verweis da und Name = sha256 des Inhalts, zusammen <= ${BILDER.gesamtMB} MB, je Datei <= ${BILDER.dateiMB} MB`, `${pooledShips}, ${missing.size} fehlen, ${wrongName.length} falsch benannt, ${totalMB.toFixed(1)} MB, ${big.length} zu gross`);
  for (const x of [...missing].slice(0, 10)) fail(`[17] ${x} fehlt in dist/hangar/tex: das Material bleibt ohne diese Karte (Ablage nicht mit eingecheckt oder vom Bau zu frueh entfernt?)`);
  for (const x of wrongName.slice(0, 10)) fail(`[17] dist/hangar/tex/${x}: Name ist nicht der Inhalt (sha256, 16 Zeichen); die URL ist ein Jahr im Cache, ein geaenderter Inhalt unter altem Namen erreicht niemanden`);
  for (const x of foreign.slice(0, 10)) fail(`[17] ${x}: Bild mit URI ausserhalb der Ablage (../tex/<inhalt>.<endung>)`);
  for (const x of big.slice(0, 10)) fail(`[17] ${x} ueber ${BILDER.dateiMB} MB: GitHub lehnt ab 100 MB ab; Karten verkleinern oder Schiff teilen`);
  if (totalMB > BILDER.gesamtMB) fail(`[17] Schiffe mit Ablage zusammen ${totalMB.toFixed(1)} MB ueber dem Deckel von ${BILDER.gesamtMB} MB (Repo und Image): Karten grosser Schiffe kleiner oder Innenraum weg, Budget in .planning/notes/hangar-alle-schiffe.md`);
  if (pooledShips < BILDER.schiffe) fail(`[17] nur ${pooledShips} Schiffe mit Bildablage (Klinke ${BILDER.schiffe}): fehlt dist/hangar/tex oder ein Schiff traegt seine Bilder wieder selbst?`);
  ist.bildSchiffe = pooledShips; ist.bildDateien = files.length; ist.bildMB = Math.round(totalMB);
}

say('\n[Selbstauskunft]');
say(`    Hangarseiten: ${PAGES.length}   Buchten: EN ${BAYS.en.length}, DE ${BAYS.de.length}   Zeilen EN: ${ist.slotZeilen}   Marker EN: ${ist.marker}   Grafikchips: ${ist.chips}   Waffenmodelle: ${ist.tauschModelle}   Tauschports: ${ist.tauschPorts}   Lackierungen: ${ist.lackierungen} in ${ist.lackSchiffe} Schiffen   Raketenslots: ${ist.raketenSlots} in ${ist.raketenSchiffe} Schiffen   Einhaengepunkte: ${ist.haken ?? 0} von 2   Ton-Schalter: ${ist.tonSeiten ?? 0} Seiten   Klaenge: ${ist.tonDateien ?? 0} Dateien   Schiffe mit Bildablage: ${ist.bildSchiffe ?? 0} (${ist.bildDateien ?? 0} Bilder, ${ist.bildMB ?? 0} MB)`);

if (REPORT) {
  say('\n(--report: nur Ist-Werte, kein Urteil)\n');
  process.exit(0);
}
if (findings.length) {
  console.error(`\nverify-hangar: ${findings.length} FEHLER\n`);
  for (const f of findings.slice(0, 40)) console.error(`  · ${f}`);
  if (findings.length > 40) console.error(`  … +${findings.length - 40} weitere`);
  console.error('');
  process.exit(1);
}
say('\nverify-hangar: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
