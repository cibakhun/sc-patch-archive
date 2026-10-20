/* ============================================================
   verify-hangar-hall.mjs — Tor fuer die Ausnahmen der echten Halle
   (Schiene A).

   WARUM ES DEN GIBT: Die Halle kommt nach Material zusammengelegt, ein
   Knoten je Material. Ein einzelnes Spielteil, das in der Halle nicht
   stehen soll (am 08.10.2026 ein Ausgangs-Wandstueck frei vor der
   Stirnwand), laesst sich darum nicht ausblenden, nur beim Laden aus den
   Dreiecken schneiden: HALL_DROP in assets/hangar-viewer.js, je Teil ein
   Quader im Modellraum der Halle. Baut der PC die Halle neu (volle Stufe,
   anderer Ursprung), trifft der Quader still nichts mehr, und das Teil
   steht wieder da. Oder er trifft zu viel. Beides sieht man erst, wenn
   jemand hinschaut.

   Dieses Tor liest das ARTEFAKT: den Block HALL_DROP aus dem
   ausgelieferten Viewer, die Halle aus der StageConfig der Hangarseite
   und jede Hallenstufe, die die Seite laedt (url, lite.url), aus dist/.
   Darauf rechnet es dieselbe Regel wie der Viewer (dropHallParts):
   zusammenhaengende Teile (gemeinsame Ecken auf 5 mm), ganz in `reach`,
   mit mindestens einer Ecke in `seen`. Fuer [12] und [15] liest es dazu das
   Manifest src/data/hangar-assets.json. Kein git, kein Netz, keine
   Data.p4k, kein Kindprozess.

   SECHZEHN ZUSICHERUNGEN, jede mit Soll-/Ist-Zeile:
     1  Jeder Schluessel in HALL_DROP ist die Halle der Seite (sonst ist
        der Eintrag ein Zombie: die Halle gibt es nicht mehr).
     2  Jeder Eintrag traegt why, reach, seen und min, und seen liegt in
        reach. Die Halle der Seite traegt mindestens so viele Eintraege wie
        ihre Klinke (KLINKE_EINTRAEGE): ein geloeschter Eintrag liesse das
        Teil sonst still zurueckkehren, und das Tor saehe nichts mehr.
     3  Jeder Eintrag trifft in jeder Hallenstufe mindestens `min` Dreiecke
        (Klinke je Eintrag; sie waechst nur, siehe Grundsatz 5).
     4  Kein Eintrag nimmt mehr als 2 % der Dreiecke einer Stufe: Gedacht
        ist die Regel fuer einzelne Teile, nicht fuer Waende.
     5  Die Moebel kommen mit (seit 08.10.2026): Am Rechner laedt die Seite
        die leichtere Stufe und die Moebel als eigene Datei, die
        scripts/build-hall-furniture.mjs beim Build aus der vollen Stufe
        schneidet. Zusammen tragen Halle und Moebeldatei mindestens so viele
        Moebel wie die Klinke (KLINKE_MOEBEL), nie doppelt, und die
        Moebeldatei stammt aus genau der vollen Stufe, die in dist/ liegt
        (sha1). Sonst fehlen die Moebel still, oder sie zeigen einen alten
        Stand, nachdem der PC die Halle neu gebaut hat. Steht die volle
        Stufe trotz leichterer als Halle der Seite, fehlte die Moebeldatei
        beim Build: Die Seite zeigt dann alles, laedt aber das Vierfache an
        Waenden, und das Tor reisst.
     6  Die Naehte jeder Hallenstufe halten (seit 08.10.2026): Draco rundete
        die Lage jeder Primitive auf ihr eigenes Raster, Kanten zweier
        Teile klafften danach bis 5 mm, und durch den Spalt schien der helle
        Hintergrund (gepunktete Linien an den Paneelkanten). Gezaehlt werden
        Randecken, die hoechstens 5 mm neben der Randecke eines anderen
        Teils liegen, aber nicht genau darauf (seamStats in
        scripts/lib/hall-seams.mjs). Obergrenze je Halle
        (OBERGRENZE_KLAFFEND), sie sinkt mit jeder dichteren Halle; dazu
        eine Untergrenze dichter Randecken (KLINKE_DICHT), damit eine leere
        oder anders zerlegte Halle das Tor nicht still bestehen laesst.
     7  Was der leichteren Stufe fehlt, kommt aus der vollen (seit
        10.10.2026): Ihr fehlen zwei Drittel des Glases (Abdeckungen der
        Kabelrinnen und Bodenkanaele, Scheiben der Glassaeulen, Kabine an
        der Suedwand) und die Rohre in den Glassaeulen. Die Moebeldatei
        bringt diese Materialien ganz aus der vollen Stufe (Knoten mit dem
        Schluessel, den der Viewer hinter der Marke hall-detail nennt), der
        Viewer laesst dafuer die Teile der leichteren Stufe mit denselben
        Materialien fallen. Mindestens so viele Dreiecke wie die Klinke
        (KLINKE_ERGAENZUNG), keines davon ein Moebel, jedes Material der
        leichteren Stufe, das unter die Regel faellt, wird ersetzt (sonst
        laege dort Glas doppelt oder das alte duenne), und nichts davon im
        Bereich einer Ausnahme aus HALL_DROP (sonst kaeme ein entferntes
        Teil ueber die Ergaenzung zurueck). Jedes Material der Ergaenzung
        faellt unter die Regel: Der Viewer liesse fuer jedes andere alle
        Teile der leichteren Stufe mit diesem Material fallen. Und jede
        Primitive traegt einen Attributsatz (Semantik und Typ), den die
        leichtere Stufe mit demselben Material auch traegt: Der Viewer
        gibt ihr das Material nach Name und Eckfarben, ein anderer Satz
        braeuchte ein eigenes Shaderprogramm, und fehlten
        Texturkoordinaten, laege die Textur verschmiert.
     8  Was die leichtere Stufe an einer Stelle ganz weglaesst, setzt die
        Moebeldatei dazu (seit 10.10.2026, FILL in
        scripts/build-hall-furniture.mjs, Knoten mit dem Schluessel hinter
        der Marke hall-fill), auf den Kasten des Eintrags zugeschnitten:
        je Bereich mindestens seine Klinke (KLINKE_FUELLUNG), kein Bereich
        ohne Klinke oder ohne Dreiecke, gerechnet gegen genau die
        leichtere Stufe in dist/ (sha1). Kein Dreieck liegt ganz oder
        teilweise auf einer gleich ausgerichteten Flaeche der leichteren
        Stufe (Probepunkte hoechstens SAMPLE_STEP auseinander, unter
        FILL_TOL; beide flimmerten gegeneinander), keines mit einer Ecke
        im Bereich einer Ausnahme aus HALL_DROP. Material und Attributsatz
        traegt die leichtere Stufe genauso (die Moebeldatei bringt
        Ergaenzung und Fuellung ohne Texturen, der Viewer gibt ihnen das
        gleichnamige Material der leichteren Stufe; dasselbe gilt in [7]
        fuer die Ergaenzung).
     9  Am Telefon kommt dasselbe (seit 10.10.2026): Dort laedt die Seite
        nur die leichtere Stufe, ohne Moebeldatei (641 000 Dreiecke
        Moebel). Ergaenzung und Fuellung bringt dort eine eigene kleine
        Datei (opts.hall.patch, gebaut von scripts/build-hall-furniture.mjs
        neben der Moebeldatei), die der Viewer am Telefon an deren Stelle
        laedt (Marke hall-patch). Sie stammt aus genau der ausgelieferten
        Moebeldatei (sha1) und traegt genau deren Knoten mit Ergaenzung und
        Fuellung, je Primitive gleich in Schluessel, Material, Attributsatz
        und Geometrie (Lage und jedes Attribut je Ecke), kein Moebel, keine
        Textur. Sonst fehlten am Telefon Glas, Rohre und Fuellung still,
        oder ihnen fehlten die Texturkoordinaten (so beim ersten Bau: prune
        ohne keepAttributes).
    10  Das Schiffsfeld faehrt als Aufzug (seit 14.10.2026): HALL_LIFT im
        Viewer nennt je Halle ein Rechteck im Modellraum (x/z) und einen
        Hoehenbereich des Bodens. Der Viewer nimmt beim Laden jedes Dreieck,
        das ganz darin liegt, in eine eigene Gruppe, die beim
        Schiffswechsel ab- und auffaehrt. Das traegt nur, solange der Rand
        des Rechtecks genau zwischen den Dreiecken verlaeuft: Kein
        Dreieck, das bleibt, hat eine Ecke tief im Feld (mehr als 1 cm
        innerhalb, auf Bodenhoehe), sonst laege ein Splitter Boden ueber dem
        offenen Schacht oder ein Stueck Feld bliebe oben stehen. Baut der PC
        die Halle neu oder verschiebt sie, trifft das Rechteck daneben. Dazu
        traegt das Feld in jeder Hallenstufe mindestens `min` Dreiecke, und
        jeder Schluessel ist die Halle der Seite.
    11  Unter dem Feld steht der Schacht aus dem Spiel (seit 16.10.2026):
        HALL_SHAFT im Viewer reiht je Halle die Teile eines Schachtbausatzes
        (Wand, Rippe, Ecke, Randleiste, Warnlampen) um das Feld aus
        HALL_LIFT, die Seite gibt Bausatz und Lampenliste mit
        (opts.hall.lift). Vorher fuhr das Feld in ein schwarzes Loch, die
        Bodenkanten der Halle schwebten (Bericht des Betreibers 15.10.2026).
        Geprueft: jeder Schluessel ist die Halle der Seite und hat ein
        Feld; die Seite gibt genau den genannten Bausatz mit, beide Dateien
        liegen in dist/; der Bausatz traegt alle Teile, jedes Wandteil in
        seinem Rahmen und so lang wie in der Lampenliste; Laengs- und
        Querwand sind mit den Ecken ohne Luecke bedeckt (sonst saehe man
        hinter den Schacht), die Randleiste reicht genau bis ans Ende
        (sonst klafft die Kante zum Hallenboden), jede Rippe traegt
        genau eine Warnlampe; die Dreiecke liegen zwischen Klinke und Obergrenze,
        die Lampen ueber ihrer Klinke (KLINKE_SCHACHT). Seit Schacht-Tiefe
        (17.10.2026) zeigt der Schacht die Karten und die Abnutzung des
        Spiels: Jedes Teil traegt Texturkoordinaten, der Knoten wear_0 bringt
        die zweite Schicht, und genug Dreiecke tragen ihre Maske (COLOR_0.a).
        Das Beiwerk aus SHAFT_DECO (Lichtrahmen, Leuchten) hat seine Knoten
        und genug Exemplare im Schacht; seine Dreiecke zaehlen zur
        Obergrenze.
    12  Die Werkstatt kommt mit (seit 17.10.2026): Die Halle wirkte steril
        (Betreiber 16.10.2026), Geraet und Bodenspuren kommen aus anderen
        Spielhallen (werkstatt.glb, werkstatt-boden.glb, Anordnung in
        werkstatt.json). Der Viewer (placeWorkshop) laesst jeden Platz,
        dessen Knoten fehlt, still weg. Geprueft: Nennt das Manifest die
        Werkstatt, gibt die Seite sie mit; alle drei Dateien liegen in
        dist/; jeder Platz der Anordnung und jede Spur auf dem Feld (Block
        work-field im Viewer) hat seinen Knoten in der richtigen Datei (das
        Geraet am Schiff prueft seit 18.10.2026 [14]);
        Decals liegen flach; Geraet, Decals, Plaetze und Feldspuren ueber
        ihrer Klinke, Dreiecke und Bytes unter der Obergrenze
        (KLINKE_WERKSTATT, OBERGRENZE_WERKSTATT; Telefone laden nur die
        Bodendatei). Der Feldboden (Block work-pad): jeder genannte Boden
        hat seinen Knoten in der Bodendatei und seine Kachel in der json,
        und je Hallenstufe tragen mindestens KLINKE_WERKSTATT.pad
        fahrende Dreiecke ([10]) ein Material aus WORK_PAD.mats; sonst
        bliebe das Feld still Lack.
    13  Das Schiffsfeld steht in der Hallenmitte (seit 18.10.2026): Das Feld
        des Spiels lag 4 m neben der Achse von Waenden, Decke und Rahmen-
        linie (Betreiber 18.10.2026: „unser platform ist nicht mittig“).
        HALL_SHIFT im Viewer rueckt es um `field` m und laesst zwei
        Bodenstreifen daneben die Plaetze tauschen; was ueber eine
        Streifenkante reicht, teilt der Viewer (shiftHallFloor). Geprueft:
        jeder Schluessel ist die Halle der Seite und hat ein Feld; die
        Feldmitte liegt danach auf der Raummitte; die Tiefe `z` ist die des
        Felds; Feld und Streifen bedecken vorher und nachher dieselbe
        Breite ohne Ueberlappung (sonst klafft eine Luecke oder Boden liegt
        doppelt). Je Hallenstufe und in der Moebeldatei: kein Bodendreieck
        reicht ueber die Feldenden in z, keins ist im Streifen und nicht
        teilbar, kein Stueck landet nach dem Ruecken im Feld (es laege ueber
        dem Schacht), und je Streifen wandern mindestens `min` Dreiecke.
    14  Der Wartungsplatz am Schiff kommt mit (seit 18.10.2026): Das Geraet
        stand verstreut und zu wenig (Betreiber 18.10.2026: „nicht
        belivable plaziert“). Der Viewer stellt je Schiff Arbeitsplaetze,
        Leitungen und Oelspuren um den Rumpf (Block work-dienst, layDienst),
        aus einem Geraetesatz, den
        scripts/build-hangar-dienst.mjs aus dem Geraetekatalog packt (ein
        BatchedMesh je Material). Fehlt ein Knoten oder passt ein
        Attributsatz nicht, steht das Schiff still ohne Geraet. Geprueft:
        liegt der Satz bereit, gibt die Seite ihn mit; er liegt in dist/ und
        passt zum Block des ausgelieferten Viewers und zu seinen Quellen in
        dist/ (Fingerabdruck); jeder genannte Knoten steht oben im Satz,
        jede Requisite im Katalog; je Material ein Attributsatz mit Index,
        dienst_flach mit Farbe und Rauheit je Ecke, die uebrigen mit
        Texturkoordinaten; Leitungen liegen laengs z (der Viewer biegt sie
        so); jede Stelle, Leitung und Spur im Block ist gueltig;
        Plaetze, Glieder, Leitungen, Spuren und Requisiten ueber ihrer
        Klinke, Materialien (Zeichenbefehle), Dreiecke und Bytes unter der
        Obergrenze (KLINKE_DIENST, OBERGRENZE_DIENST).
    15  Das Schachttor schliesst beim Wechsel (seit 18.10.2026): Das Schiff
        tauschte unten bei offenem Schacht, man sah es ploppen (Betreiber
        18.10.2026). Das Tor des Spiels (lift.<Bausatz>.gate im Manifest,
        buildGate im Viewer) geht ueber der sinkenden Plattform zu und ueber
        der steigenden auf. Der Viewer nimmt nur Teile, die irgendwann mehr
        als HALL_GATE.reach ins Feld reichen und offen ganz draussen liegen,
        und streckt das Tor laengs auf das Feld. Geprueft: Nennt das
        Manifest ein Tor, gibt die Seite genau dieses mit, beide Dateien in
        dist/; jede Bahn laeuft von 0 bis zur Dauer und schliesst an
        closed/open an (sonst springt ein Teil); Materialien, die der Schacht
        gleichnamig traegt, haben dieselben Bilder (der Viewer nimmt dessen
        Karten); mit derselben Auswahl
        mindestens KLINKE_TOR Teile, und geschlossen deckt ihr Rahmen jede
        Zelle des Felds (sonst saehe man durch den Spalt den Tausch);
        Dreiecke, Materialien nach dem Zusammenlegen (Zeichenbefehle) und
        Bytes unter OBERGRENZE_TOR. Seit 19.10.2026 tragen die
        Palettenlacke (paint_b_*) die Farbe der Palette am Tor (Betreiber
        19.10.2026: „textur mässig undso passts auch nicht“); jeder hat
        seinen Eintrag, mindestens KLINKE_TOR.lacke.
    16  Um das Feld liegt der feste Rand des Spiels (seit 19.10.2026): Das
        Tor kam aus dem Nichts (Betreiber 19.10.2026: „es ploppt aus dem
        nichts rein“, „soll so aussehen wie ein element was da fest verbaut
        ist“). Im Spiel umrahmt ein 4 m breiter Gitterstegring die
        Oeffnung, das Tor kommt aus der Fuge davor. HALL_RAND im Viewer
        reiht seine Teile (lift.<Bausatz>.rand) je Seite um unser Feld,
        der Hallenshader spart den Boden darunter aus. Geprueft: Nennt das
        Manifest den Rand, gibt die Seite genau diesen mit, beide Dateien
        in dist/; jeder genannte Knoten steht im Rand; die Stege decken
        jede Seite von 0 bis zur Laenge ohne Luecke und Ueberlappung und
        liegen buendig mit dem Boden (hgCut spart bis 0,3 m darunter aus);
        Ecken, Leuchten und Schriftzug liegen im Rand und auf ihrer Seite;
        Materialien, die der Schacht gleichnamig traegt, haben dieselben
        Bilder (der Viewer nimmt dessen Karten);
        Teile ueber KLINKE_RAND, Dreiecke, Materialien nach dem
        Zusammenlegen (Zeichenbefehle in jedem Bild) und Bytes unter
        OBERGRENZE_RAND.
   ============================================================ */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { seamStats } from './lib/hall-seams.mjs';
import { FILL_TOL, touches, samples, normalOf, withNormals, onLite, worldTris } from './lib/hall-fill.mjs';
import { sha8 } from './lib/eol-sha.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PAGE = 'de/hangar.html';
const MAX_SHARE = 0.02;
// Klinke je Halle: so viele Ausnahmen traegt HALL_DROP fuer sie mindestens.
// Nach oben mit jedem neuen Eintrag, nach unten nur per Commit, dessen
// Botschaft die Ursache nennt (Grundsatz 5).
const KLINKE_EINTRAEGE = { 'revelyork-single': 1 };
// Klinke je Halle: so viele Moebel (Knoten mit extras.furniture und
// extras.anchor) laedt die Seite am Rechner mindestens. Stand 08.10.2026:
// 137 in der vollen Stufe. Gleiche Regel wie oben.
const KLINKE_MOEBEL = { 'revelyork-single': 137 };
// Naehte je Halle (seamStats, Randecken bis 5 mm neben einem anderen Teil).
// OBERGRENZE_KLAFFEND sinkt nur; steigen nur per Commit, dessen Botschaft
// die Ursache nennt. KLINKE_DICHT steigt nur. Stand 10.10.2026, 1a878120
// (PC-Lauf „Hallen-Naehte“: bis 0,1 mm verschweisst, ein Raster fuer alle
// Teile): 1 753 klaffend, 121 915 dicht; vorher, je Primitive gerundet,
// 123 373 klaffend, 0 dicht. Die uebrigen klaffen schon in der
// ungerundeten Quelle (2 718 Ecken zwischen 0,1 und 5 mm); was durch sie
// scheint, ist seit dem dunklen Hintergrund der Halle dunkel wie die
// Fugen. Sie zu schliessen hiesse Spielgeometrie verschieben.
const OBERGRENZE_KLAFFEND = { 'revelyork-single': 1753 };
const KLINKE_DICHT = { 'revelyork-single': 121915 };
// Klinke je Halle: so viele Dreiecke Ergaenzung (Glas, Rohre der
// Glassaeulen) bringt die Moebeldatei aus der vollen Stufe mindestens.
// Stand 10.10.2026, volle Stufe fbd0e9c9: 15 482 (Glas 15 398 in vier
// Materialien, Rohre 84). Gleiche Regel wie oben.
const KLINKE_ERGAENZUNG = { 'revelyork-single': 15482 };
// Klinke je Halle und Bereich der Fuellung: so viele Dreiecke setzt die
// Moebeldatei dort mindestens dazu, auf den Kasten zugeschnitten. Stand
// 10.10.2026, volle Stufe fbd0e9c9 gegen die leichtere 1a878120:
// Holzblende auf dem Deckenkasten 14 (vorher 6 ganze Dreiecke, die bis
// unter die Leiste der leichteren Stufe reichten), Rohrstueck mitten an
// der Decke 142, Rueckwand der Schlitze unten im Nordtor 4 (24 weitere im
// Kasten deckungsgleich mit der leichteren Stufe, ausgelassen). Gleiche
// Regel wie oben.
// Schacht je Halle (HALL_SHAFT): Dreiecke des gebauten Schachts bei 36 m
// Tiefe zwischen Klinke und Obergrenze, Lampen der Lampenliste mit Licht
// mindestens. Stand 16.10.2026, Bausatz medtop dd92c876: 28 264 Dreiecke
// (der Viewer zaehlt dasselbe), 84 Lampen. Obergrenze 60 000: so viel wie
// ein mittleres Schiff, fuer zwei Sekunden Fahrt. Abnutzung (worn): Dreiecke
// des Bausatzes mit Wear-Maske, Stand 17.10.2026 (Bausatz aus hangar-werkstatt
// Teil B) 2713. Beiwerk (deco): Exemplare der Arten aus SHAFT_DECO im
// Schacht, 51 Leuchten und 35 Lichtrahmen; ihre Dreiecke zaehlen zur
// Obergrenze. Gleiche Regel wie oben.
const KLINKE_SCHACHT = { 'revelyork-single': { minTris: 28264, maxTris: 60000, lights: 84, worn: 2713, deco: 86 } };
// field 12 -> 9 (18.10.2026): die drei Oelflecken auf dem Feld liegen jetzt
// nach Schiffsgroesse unter dem Schiff (WORK_DIENST.spuren, [14]); die
// grosse Lache in der Feldmitte sah aus wie verschuettete Tinte (Betreiber).
// service entfaellt: WORK_SERVICE ist im Wartungsplatz aufgegangen ([14]).
const KLINKE_WERKSTATT = { props: 25, decals: 24, items: 131, field: 9, pad: 31888 };
// Wartungsplatz (Stand 18.10.2026 abends; am Carrack wirkte der Platz
// winzig, Gerät insgesamt zu wenig, Betreiber): Plätze nach Schiffsgröße
// (ab/bis), 20 Plätze, 131 Glieder, 6 Leitungen, 13 Spuren aus 50
// Requisiten. Obergrenze des Satzes: 41 Materialien (je Material ein
// Zeichenbefehl je Durchgang auf mittel und hoch), 203 151 Dreiecke,
// 4,9 MB. Was ein Schiff kostet, prüft das Tor je Größe (DIENST_KLASSEN:
// Dragonfly, Gladius, Cutlass, Carrack, größte Ausdehnung in m; Fahrzeuge
// unter 10 m bekommen seit 19.10.2026 nur sechs Plätze, das Gerät war
// größer als sie); jedes Band zwischen
// zwei Grenzen ab/bis braucht eine davon. Ein kleines Schiff zahlt das
// Gerät der großen nicht (layDienst schaltet Materialien ohne sichtbares
// Stück ab). Gleiche Regel wie oben, Obergrenzen steigen nur per Commit
// mit Ursache. 20.10.2026: winzig/klein/mittel +2000..3000, weil die
// schwebende Bergbau-Platte (workbench_table_1_a, 3812) der fahrbaren
// Werkbank des Spiels (workbench_mobile_1_a, 7856) gewichen ist.
const KLINKE_DIENST = { stationen: 20, glieder: 131, leitungen: 6, spuren: 13, props: 50 };
const OBERGRENZE_DIENST = { mats: 41, tris: 210000, bytes: 5.2e6 };
const DIENST_KLASSEN = { winzig: 6.5, klein: 20, mittel: 40, gross: 120 };
const KLINKE_DIENST_KLASSE = { winzig: { stationen: 6 }, klein: { stationen: 10 }, mittel: { stationen: 11 }, gross: { stationen: 19 } };
const OBERGRENZE_DIENST_KLASSE = { winzig: { mats: 24, tris: 117000 }, klein: { mats: 30, tris: 213000 }, mittel: { mats: 34, tris: 257000 }, gross: { mats: 41, tris: 560000 } };
const OBERGRENZE_WERKSTATT = { tris: 150000, bytes: 8e6, boden: 2 * 1024 * 1024 };
// Schachttor ([15], seit 18.10.2026): Teile, die ins Feld reichen (14 beim
// Einbau: Mittelfluegel, Stirnplatten, Riegel, Zahnstangen, Zylinder); die
// Kosten hoechstens die Haelfte des Schachtbudgets (.planning/notes/
// hangar-schachttor.md: rund 6 Zeichenbefehle, 30 000 Dreiecke)
const KLINKE_TOR = { teile: 14, lacke: 3 };
const OBERGRENZE_TOR = { tris: 30000, mats: 6, bytes: 2e6 };
// Fester Rand um das Feld ([16], seit 19.10.2026): Gitterstegring des
// Spiels, 4 m breit, mit Landeleuchten und Schriftzug (42 Teile beim
// Einbau: 4 Ecken mit Leuchte, je Seite Stege und Leuchten, zwei
// Bodenleuchten). In Ruhe immer zu sehen, also knapp halten.
const KLINKE_RAND = { teile: 42 };
const OBERGRENZE_RAND = { tris: 10000, mats: 10, bytes: 1e6 };
const KLINKE_FUELLUNG ={ 'revelyork-single': { 'Holzblende auf dem Deckenkasten': 14, 'Rohrstueck mitten an der Decke': 142, 'Rueckwand der Schlitze unten im Nordtor': 4 } };

const findings = [];
const say = (s) => console.log(s);
const fail = (s) => findings.push(s);
const sollIst = (soll, ist) => say(`    Soll: ${soll}\n    Ist:  ${ist}`);
const fromUrl = (u) => join(DIST, decodeURI(String(u).split('?')[0]).replace(/^\//, ''));

say(`verify-hangar-hall: prueft ${join('dist', PAGE)} und die Dateien, die sie laedt`);
if (!existsSync(join(DIST, PAGE))) {
  console.error(`\nverify-hangar-hall: ${join('dist', PAGE)} fehlt — erst bauen (npm run build)\n`);
  process.exit(1);
}
const html = readFileSync(join(DIST, PAGE), 'utf8');
const sm = /<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(html);
const stage = sm ? JSON.parse(sm[1]) : null;
if (!stage) fail(`${PAGE}: keine StageConfig (#hg-stage)`);
const hall = stage?.opts?.hall ?? null;
const viewerFile = stage?.viewer ? fromUrl(stage.viewer) : null;
const viewer = viewerFile && existsSync(viewerFile) ? readFileSync(viewerFile, 'utf8') : '';
if (!viewer) fail(`${PAGE}: der Viewer der StageConfig (${stage?.viewer}) liegt nicht in dist/`);

// Der Block steht im Viewer zwischen /* hall-drop */ und /* /hall-drop */ und ist JSON
const bm = /\/\* hall-drop \*\/([\s\S]*?)\/\* \/hall-drop \*\//.exec(viewer);
let drop = null;
try { drop = bm ? JSON.parse(bm[1]) : null; } catch (e) { fail(`HALL_DROP im Viewer ist kein JSON mehr (${e.message})`); }
if (viewer && !bm) fail('der Viewer traegt keinen Block /* hall-drop */ … /* /hall-drop */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
drop ??= {};

say('\n[1] Jeder Schluessel in HALL_DROP ist die Halle der Seite');
const keys = Object.keys(drop);
const orphan = keys.filter((k) => k !== hall?.id);
say(`    Halle der Seite: ${hall?.id ?? '(keine)'}   Schluessel: ${keys.join(', ') || '(keine)'}`);
sollIst('0 Schluessel ohne Halle', orphan.length);
for (const k of orphan) fail(`[1] HALL_DROP["${k}"]: die Seite laedt diese Halle nicht${hall && !hall.id ? ' (opts.hall traegt keine id — HangarApp.astro)' : ''}; Eintrag entfernen oder die Halle zurueck`);

say('\n[2] Jeder Eintrag traegt why, reach, seen, min; seen liegt in reach');
const entries = (hall?.id && drop[hall.id]) || [];
const box = (b) => Array.isArray(b) && b.length === 2 && b.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) && b[0].every((v, i) => v < b[1][i]);
const malformed = [];
for (const [i, d] of entries.entries()) {
  const why = typeof d.why === 'string' && d.why.length > 10;
  const inside = box(d.reach) && box(d.seen) && d.seen[0].every((v, a) => v >= d.reach[0][a]) && d.seen[1].every((v, a) => v <= d.reach[1][a]);
  if (!why || !inside || !(Number.isInteger(d.min) && d.min > 0)) malformed.push(`Eintrag ${i}${why ? '' : ' ohne Anlass'}${inside ? '' : ' mit kaputtem reach/seen'}${Number.isInteger(d.min) && d.min > 0 ? '' : ' ohne Klinke min'}`);
}
const klinke = hall?.id ? KLINKE_EINTRAEGE[hall.id] ?? 0 : 0;
const staleKlinke = Object.keys(KLINKE_EINTRAEGE).filter((k) => k !== hall?.id);
say(`    Eintraege: ${entries.length}   Klinke: ${klinke}`);
sollIst(`0 unvollstaendige Eintraege, mindestens ${klinke}`, `${malformed.length} unvollstaendig, ${entries.length} Eintraege`);
for (const m of malformed) fail(`[2] ${m}`);
if (entries.length < klinke) fail(`[2] HALL_DROP["${hall.id}"] traegt ${entries.length} Eintraege, die Klinke verlangt ${klinke}: ein Eintrag ist verschwunden, und sein Teil steht wieder in der Halle. Zurueckholen, oder KLINKE_EINTRAEGE in diesem Tor per Commit mit Ursache senken`);
for (const k of staleKlinke) fail(`[2] KLINKE_EINTRAEGE["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);

// Die Regel des Viewers (dropHallParts) gegen eine Hallenstufe
async function measure(file, list) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const doc = await io.read(file);
  // Dieselben Geometrien wie dropHallParts: Eine Geometrie, die mehrere
  // Meshes tragen, bleibt im Viewer unberuehrt, ebenso Primitive ohne Index.
  // GLTFLoader teilt sie, wenn mehrere Knoten dasselbe Mesh stellen (er
  // klont den Knoten, nicht die Geometrie) und wenn Primitive dieselben
  // Accessoren nennen; gezaehlt wird darum je Knoten das Paar aus Index und
  // POSITION. Geometriegruppen legt GLTFLoader nicht an.
  const acc = new Map(), refs = new Map();
  const geo = (p) => [p.getIndices(), p.getAttribute('POSITION')].map((a) => (a ? acc.get(a) ?? acc.set(a, acc.size).get(a) : -1)).join(':');
  for (const node of doc.getRoot().listNodes()) for (const p of node.getMesh()?.listPrimitives() ?? []) refs.set(geo(p), (refs.get(geo(p)) || 0) + 1);
  const tris = [];
  let skipped = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const w = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const P = p.getAttribute('POSITION')?.getArray(), I = p.getIndices()?.getArray();
      if (!P) continue;
      if (!I || refs.get(geo(p)) > 1) { skipped++; continue; }
      const pos = new Float64Array(P.length);
      for (let i = 0; i < P.length; i += 3) {
        const x = P[i], y = P[i + 1], z = P[i + 2];
        pos[i] = w[0] * x + w[4] * y + w[8] * z + w[12];
        pos[i + 1] = w[1] * x + w[5] * y + w[9] * z + w[13];
        pos[i + 2] = w[2] * x + w[6] * y + w[10] * z + w[14];
      }
      tris.push({ pos, I });
    }
  }
  const total = tris.reduce((s, t) => s + t.I.length / 3, 0);
  if (skipped) say(`    (${skipped} Primitive ohne Index oder mehrfach gestellt: der Viewer schneidet dort nicht, hier ebenso)`);
  const out = [];
  for (const d of list) {
    const [r0, r1] = d.reach, [s0, s1] = d.seen;
    const inR = (p, i) => p[i] >= r0[0] && p[i] <= r1[0] && p[i + 1] >= r0[1] && p[i + 1] <= r1[1] && p[i + 2] >= r0[2] && p[i + 2] <= r1[2];
    const inS = (p, i) => p[i] >= s0[0] && p[i] <= s1[0] && p[i + 1] >= s0[1] && p[i + 1] <= s1[1] && p[i + 2] >= s0[2] && p[i + 2] <= s1[2];
    const ids = new Map(), par = [], seen = [];
    const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const kids = tris.map(({ pos }) => {
      const kid = new Int32Array(pos.length / 3).fill(-1);
      for (let v = 0; v < kid.length; v++) {
        if (!inR(pos, v * 3)) continue;
        const k = (Math.round(pos[v * 3] * 200) + 65536) * 17179869184 + (Math.round(pos[v * 3 + 1] * 200) + 65536) * 131072 + (Math.round(pos[v * 3 + 2] * 200) + 65536);
        let id = ids.get(k);
        if (id === undefined) { id = par.length; par.push(id); seen.push(0); ids.set(k, id); }
        if (inS(pos, v * 3)) seen[id] = 1;
        kid[v] = id;
      }
      return kid;
    });
    const anchors = [];
    tris.forEach(({ I }, m) => {
      const kid = kids[m];
      for (let t = 0; t + 2 < I.length; t += 3) {
        const a = kid[I[t]], b = kid[I[t + 1]], c = kid[I[t + 2]];
        if (a >= 0 && b >= 0 && c >= 0) { const r = find(a); par[find(b)] = r; par[find(c)] = r; }
        else { if (a >= 0) anchors.push(a); if (b >= 0) anchors.push(b); if (c >= 0) anchors.push(c); }
      }
    });
    const held = new Set(anchors.map(find)), shown = new Set();
    for (let i = 0; i < seen.length; i++) if (seen[i]) shown.add(find(i));
    const gone = new Set();
    let n = 0;
    tris.forEach(({ I }, m) => {
      const kid = kids[m];
      for (let t = 0; t + 2 < I.length; t += 3) {
        const a = kid[I[t]];
        if (a < 0 || kid[I[t + 1]] < 0 || kid[I[t + 2]] < 0) continue;
        const r = find(a);
        if (!held.has(r) && shown.has(r)) { gone.add(r); n++; }
      }
    });
    out.push({ tris: n, parts: gone.size });
  }
  // Naehte gegen dieselbe Stufe; die T-Stoesse kosten das Doppelte und
  // bleiben der Selbstauskunft des PC-Builds
  return { total, out, seams: seamStats(doc, { tJunctions: false }), doc };
}

say('\n[3] Jeder Eintrag trifft in jeder Hallenstufe mindestens seine Klinke');
say('[4] Kein Eintrag nimmt mehr als 2 % einer Stufe');
const files = hall ? [hall.url, hall.lite?.url].filter(Boolean) : [];
let measured = 0;
const seamRuns = [];
const stageDocs = new Map();
for (const u of files) {
  const f = fromUrl(u);
  if (!existsSync(f)) { fail(`[3] Hallenstufe ${u} liegt nicht in dist/`); continue; }
  const { total, out, seams, doc } = await measure(f, entries);
  stageDocs.set(u.split('?')[0], doc);
  measured++;
  seamRuns.push({ u: u.split('?')[0], ...seams });
  say(`    ${u.split('?')[0]}: ${total} Dreiecke`);
  out.forEach((r, i) => {
    const d = entries[i], name = d.why.split(' (')[0], share = total ? r.tris / total : 0;
    say(`      „${name}“: ${r.tris} Dreiecke in ${r.parts} Teilen (Klinke ${d.min}, Anteil ${(share * 100).toFixed(2)} %)`);
    if (r.tris < d.min) fail(`[3] „${name}“ trifft in ${u.split('?')[0]} nur ${r.tris} Dreiecke statt mindestens ${d.min}: Halle neu gebaut oder verschoben? reach/seen in HALL_DROP (assets/hangar-viewer.js) nachmessen, oder den Eintrag entfernen, wenn das Teil nicht mehr in der Halle steht`);
    if (share > MAX_SHARE) fail(`[4] „${name}“ nimmt ${(share * 100).toFixed(2)} % von ${u.split('?')[0]}: zu weit gefasst, die Regel ist fuer einzelne Teile`);
  });
}
sollIst(`${files.length} Hallenstufen gemessen, jeder Eintrag ueber seiner Klinke, unter 2 %`, `${measured} gemessen, ${findings.filter((f) => /^\[[34]\]/.test(f)).length} Befunde`);
if (entries.length && !measured) fail('[3] Eintraege, aber keine Hallenstufe gemessen — die Seite laedt keine Halle?');

say('\n[5] Die Moebel kommen mit, einmal, aus der ausgelieferten vollen Stufe');
// Nur der JSON-Block eines GLB (Knoten und extras), ohne zu dekodieren
const glbJson = (file) => {
  const b = readFileSync(file);
  return b.readUInt32LE(0) === 0x46546c67 ? JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) : null;
};
// Attributsatz einer Primitive (Semantik:Typ, sortiert) und je
// Materialname die Saetze, die eine Datei traegt
const attrSig = (json, p) => Object.keys(p.attributes ?? {}).sort().map((s) => `${s}:${json.accessors?.[p.attributes[s]]?.type ?? '?'}`).join(',');
const sigsByMat = (json) => {
  const m = new Map();
  for (const mesh of json?.meshes ?? []) for (const p of mesh.primitives) {
    const n = json.materials?.[p.material]?.name ?? '?';
    if (!m.has(n)) m.set(n, new Set());
    m.get(n).add(attrSig(json, p));
  }
  return m;
};
// Eine Datei dekodiert, einmal fuer [7] bis [9]
const decoded = new Map();
const decode = (file) => {
  if (!decoded.has(file)) decoded.set(file, draco3d.createDecoderModule().then((dec) => new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': dec }).read(file)));
  return decoded.get(file);
};
const sha1 = (file) => createHash('sha1').update(readFileSync(file)).digest('hex');
const sha1Bytes = (b) => (b ? createHash('sha1').update(b).digest('hex') : '');
const furnNodes = (json) => (json?.nodes ?? []).filter((n) => n.extras?.furniture != null && Array.isArray(n.extras?.anchor) && n.extras.anchor.length === 3 && n.extras.anchor.every(Number.isFinite)).length;
const klinkeMoebel = hall?.id ? KLINKE_MOEBEL[hall.id] ?? 0 : 0;
let inHall = 0, inFile = 0, furnSrc = '';
if (hall?.url && existsSync(fromUrl(hall.url))) inHall = furnNodes(glbJson(fromUrl(hall.url)));
if (hall?.furniture?.url) {
  const ff = fromUrl(hall.furniture.url);
  if (!existsSync(ff)) fail(`[5] die Moebeldatei ${hall.furniture.url} liegt nicht in dist/`);
  else {
    const json = glbJson(ff);
    const of = json?.extras?.furnitureOf;
    inFile = furnNodes(json);
    const src = of?.file ? join(DIST, 'hangar/hall', of.file) : null;
    const now = src && existsSync(src) ? createHash('sha1').update(readFileSync(src)).digest('hex') : null;
    furnSrc = of?.file ? `${of.file} sha1 ${String(of.sha1).slice(0, 8)}` : '(ohne Herkunft)';
    if (!of?.file || !of?.sha1) fail(`[5] ${hall.furniture.url.split('?')[0]} nennt keine Quelle (extras.furnitureOf): nicht von scripts/build-hall-furniture.mjs gebaut?`);
    else if (!now) fail(`[5] die Quelle der Moebel (${of.file}) liegt nicht in dist/hangar/hall/`);
    else if (now !== of.sha1) fail(`[5] die Moebel stammen aus einer aelteren ${of.file} (sha1 ${of.sha1.slice(0, 8)}, ausgeliefert ${now.slice(0, 8)}): npm run build neu laufen lassen (scripts/build-hall-furniture.mjs schneidet sie neu)`);
    if (of?.nodes != null && of.nodes !== inFile) fail(`[5] die Moebeldatei traegt ${inFile} Moebel, ihre Herkunft nennt ${of.nodes}`);
  }
}
say(`    in der Halle ${inHall}, in der Moebeldatei ${inFile}${furnSrc ? ` (aus ${furnSrc})` : ''}   Klinke: ${klinkeMoebel}`);
sollIst(`mindestens ${klinkeMoebel} Moebel, nur an einer Stelle`, `${inHall + inFile}${inHall && inFile ? ' (doppelt)' : ''}`);
if (inHall && !inFile && hall?.lite?.url) fail(`[5] die Seite laedt am Rechner die volle Stufe ${hall.url.split('?')[0]} (${inHall} Moebel darin), obwohl es ${hall.lite.url.split('?')[0]} gibt: die Moebeldatei fehlte beim Build (scripts/build-hall-furniture.mjs vor astro build?)`);
if (inHall && inFile) fail(`[5] Moebel doppelt: die Halle der Seite (${hall.url.split('?')[0]}) stellt ${inHall} selbst, und die Moebeldatei kommt dazu — HangarApp.astro gibt die Moebeldatei nur zur leichteren Stufe`);
if (inHall + inFile < klinkeMoebel) fail(`[5] die Seite laedt ${inHall + inFile} Moebel, die Klinke verlangt ${klinkeMoebel}: Moebeldatei fehlt (scripts/build-hall-furniture.mjs im Build?) oder die volle Stufe kam mit weniger Moebeln; KLINKE_MOEBEL nur per Commit mit Ursache senken`);
for (const k of Object.keys(KLINKE_MOEBEL).filter((k) => k !== hall?.id)) fail(`[5] KLINKE_MOEBEL["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);

say('\n[6] Die Naehte jeder Hallenstufe halten');
const grenze = hall?.id ? OBERGRENZE_KLAFFEND[hall.id] : undefined, dicht = hall?.id ? KLINKE_DICHT[hall.id] : undefined;
for (const r of seamRuns) {
  const mm = Object.entries(r.crackMm).map(([k, n]) => `bis ${k} mm ${n}`).join(', ');
  say(`    ${r.u}: ${r.boundaryVerts} Randecken, ${r.sealed} dicht, ${r.crack} klaffend${mm ? ` (${mm})` : ''}, ${r.lone} ohne Gegenstueck`);
  if (grenze !== undefined && r.crack > grenze) fail(`[6] ${r.u}: ${r.crack} klaffende Randecken, die Obergrenze ist ${grenze}: Die Halle kam wieder je Primitive gerundet (Spalte an den Paneelkanten, gepunktete Linien). Im PC-Build (scripts/build-hangar-assets.mjs) vor dem Packen sealSeams, dann draco mit quantizationVolume 'scene' (.planning/notes/hallen-naehte.md); OBERGRENZE_KLAFFEND nur per Commit mit Ursache anheben`);
  if (dicht !== undefined && r.sealed < dicht) fail(`[6] ${r.u}: ${r.sealed} dichte Randecken, die Klinke verlangt ${dicht}: Halle anders zerlegt oder ohne gemeinsames Raster gepackt? KLINKE_DICHT nur per Commit mit Ursache senken`);
}
if (hall?.id && measured && (grenze === undefined || dicht === undefined)) fail(`[6] die Halle ${hall.id} hat keine OBERGRENZE_KLAFFEND oder KLINKE_DICHT in diesem Tor: gemessene Werte eintragen`);
for (const k of new Set([...Object.keys(OBERGRENZE_KLAFFEND), ...Object.keys(KLINKE_DICHT)].filter((k) => k !== hall?.id))) fail(`[6] OBERGRENZE_KLAFFEND/KLINKE_DICHT["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);
sollIst(`hoechstens ${grenze ?? '?'} klaffend, mindestens ${dicht ?? '?'} dicht, je Stufe`, seamRuns.map((r) => `${r.crack} klaffend, ${r.sealed} dicht`).join('; ') || '(keine Stufe gemessen)');

say('\n[7] Was der leichteren Stufe fehlt, bringt die Moebeldatei ganz aus der vollen');
// Der Schluessel steht im Viewer: const HALL_DETAIL = /* hall-detail */ '…'
const km = /\/\* hall-detail \*\/\s*'([^']+)'/.exec(viewer);
const detailKey = km?.[1] ?? null;
const klinkeErg = hall?.id ? KLINKE_ERGAENZUNG[hall.id] ?? 0 : 0;
let ergTris = 0, ergMats = new Set(), liteRule = [], inDrop = 0, ergSigBad = 0;
if (viewer && !km) fail('[7] der Viewer traegt keinen Schluessel /* hall-detail */ \'…\' mehr: Die Ergaenzung aus der Moebeldatei kaeme dann zum duennen Glas der leichteren Stufe dazu, statt es zu ersetzen. Marke zurueck (assets/hangar-viewer.js, HALL_DETAIL), oder dieses Tor mitnehmen');
if (hall?.furniture?.url && existsSync(fromUrl(hall.furniture.url)) && detailKey) {
  const ff = fromUrl(hall.furniture.url), json = glbJson(ff), of = json?.extras?.furnitureOf;
  const rule = of?.detail?.rule;
  const det = (json?.nodes ?? []).filter((n) => n.extras?.[detailKey] === true && n.mesh != null);
  for (const n of det) {
    if (n.extras?.furniture != null || n.extras?.anchor) fail(`[7] Knoten ${n.name ?? '?'} ist Ergaenzung und Moebel zugleich: scripts/build-hall-furniture.mjs trennt beides`);
    for (const p of json.meshes[n.mesh].primitives) {
      ergTris += (json.accessors[p.indices ?? p.attributes?.POSITION]?.count ?? 0) / 3;
      ergMats.add(json.materials?.[p.material]?.name ?? '?');
    }
  }
  // Was die leichtere Stufe unter derselben Regel traegt, muss die Ergaenzung ersetzen
  const lite = existsSync(fromUrl(hall.url)) ? glbJson(fromUrl(hall.url)) : null;
  if (!rule) fail(`[7] ${hall.furniture.url.split('?')[0]} nennt keine Regel der Ergaenzung (extras.furnitureOf.detail.rule): nicht vom aktuellen scripts/build-hall-furniture.mjs gebaut?`);
  else if (lite) {
    const re = new RegExp(rule, 'i'), used = new Set();
    for (const m of lite.meshes ?? []) for (const p of m.primitives) used.add(lite.materials?.[p.material]?.name ?? '?');
    liteRule = [...used].filter((n) => re.test(n));
    for (const n of [...ergMats].filter((n) => !used.has(n))) fail(`[7] die Ergaenzung traegt „${n}“, die leichtere Stufe nicht: Die Moebeldatei bringt nur Namen und Faktoren mit, ohne das gleichnamige Material der leichteren Stufe bliebe das Teil ohne Texturen. Regel DETAIL in scripts/build-hall-furniture.mjs pruefen`);
    for (const n of [...ergMats].filter((n) => !re.test(n))) fail(`[7] die Ergaenzung traegt „${n}“, das nicht unter ihre Regel ${rule} faellt: Der Viewer liesse dafuer alle Teile der leichteren Stufe mit diesem Material fallen. Knoten mit extras.${detailKey} nur fuer die Regel (scripts/build-hall-furniture.mjs)`);
    for (const n of liteRule.filter((n) => !ergMats.has(n))) fail(`[7] die leichtere Stufe traegt „${n}“ (Regel ${rule}), die Ergaenzung nicht: Dort bliebe das duenne Glas, und kam das Material in der vollen Stufe umbenannt, laege es doppelt. Regel DETAIL in scripts/build-hall-furniture.mjs pruefen`);
  }
  // Dieselben Attribute wie die leichtere Stufe mit diesem Material
  const liteSigs = sigsByMat(lite);
  for (const n of det) for (const p of json.meshes[n.mesh].primitives) {
    const mn = json.materials?.[p.material]?.name ?? '?', s = attrSig(json, p);
    if (!liteSigs.has(mn) || liteSigs.get(mn).has(s)) continue;
    ergSigBad++;
    fail(`[7] die Ergaenzung traegt „${mn}“ mit ${s}, die leichtere Stufe nur mit ${[...liteSigs.get(mn)].join(' / ')}: Der Viewer gibt ihr das Material nach Name und Eckfarben (ohne Gegenstueck bliebe sie ohne Texturen), ein anderer Satz braucht ein eigenes Shaderprogramm, und fehlen Texturkoordinaten, liegt die Textur verschmiert. Moebeldatei neu bauen; bleibt es, in scripts/build-hall-furniture.mjs die Attribute der Ergaenzung (prune vor dem Tausch der Materialien) auf die der leichteren Stufe bringen`);
  }
  // Nichts davon im Bereich einer Ausnahme (Ecken in reach). Die Ecken
  // genuegen: HALL_DROP nimmt nur Teile, die ganz in reach liegen; ein
  // Dreieck, das den Kasten nur schneidet, gehoert zu einem Teil, das auch
  // die leichtere Stufe behaelt (so die Glasscheibe ueber der Trennwand).
  if (det.length && entries.length) {
    const doc = await decode(ff);
    for (const node of doc.getRoot().listNodes()) {
      if (node.getExtras()?.[detailKey] !== true) continue;
      const w = node.getWorldMatrix();
      for (const p of node.getMesh()?.listPrimitives() ?? []) {
        // ohne Indizes je drei Ecken ein Dreieck, wie Build und Viewer zaehlen
        const P = p.getAttribute('POSITION').getArray(), I = p.getIndices()?.getArray() ?? null;
        const m = I ? I.length : P.length / 3;
        for (let t = 0; t + 2 < m; t += 3) {
          const hit = (I ? [I[t], I[t + 1], I[t + 2]] : [t, t + 1, t + 2]).some((i) => {
            const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
            const q = [w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]];
            return entries.some((d) => q.every((v, a) => v >= d.reach[0][a] && v <= d.reach[1][a]));
          });
          if (hit) inDrop++;
        }
      }
    }
    if (inDrop) fail(`[7] die Ergaenzung bringt ${inDrop} Dreiecke in den Bereich einer Ausnahme aus HALL_DROP zurueck: Das entfernte Teil stuende dort wieder (mit Glas oder Rohren). Regel DETAIL enger fassen oder die Ausnahme auch auf die Ergaenzung anwenden`);
  }
  if (ergTris < klinkeErg) fail(`[7] die Moebeldatei bringt ${ergTris} Dreiecke Ergaenzung, die Klinke verlangt ${klinkeErg}: Dann fehlt der Seite wieder das Glas auf Kabelrinnen, Bodenkanaelen und Glassaeulen (scripts/build-hall-furniture.mjs, DETAIL; Schluessel im Viewer „${detailKey}“). KLINKE_ERGAENZUNG nur per Commit mit Ursache senken`);
} else if (hall?.furniture?.url) {
  // ohne Schluessel ist oben schon ein Befund; fehlt die Datei, meldet es [5]
} else say('    (die Seite laedt keine Moebeldatei: Telefon-Stufe oder volle Stufe, nichts zu ergaenzen)');
for (const k of Object.keys(KLINKE_ERGAENZUNG).filter((k) => k !== hall?.id)) fail(`[7] KLINKE_ERGAENZUNG["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);
say(`    Schluessel im Viewer: ${detailKey ?? '(keiner)'}   Materialien: ${[...ergMats].map((n) => n.replace(/^.*_mtl_/, '')).join(', ') || '(keine)'}`);
say(`    leichtere Stufe unter der Regel: ${liteRule.map((n) => n.replace(/^.*_mtl_/, '')).join(', ') || '(keine)'}`);
sollIst(`mindestens ${klinkeErg} Dreiecke, jedes Material der leichteren Stufe ersetzt, 0 im Bereich einer Ausnahme, Attribute wie die leichtere Stufe`, `${ergTris} Dreiecke in ${ergMats.size} Materialien, ${liteRule.filter((n) => !ergMats.has(n)).length} nicht ersetzt, ${inDrop} im Bereich einer Ausnahme, ${ergSigBad} Primitiven mit anderen Attributen`);

say('\n[8] Was die leichtere Stufe an einer Stelle ganz weglaesst, setzt die Moebeldatei dazu');
// Der Schluessel steht im Viewer: const HALL_FILL = /* hall-fill */ '…'
const fk = /\/\* hall-fill \*\/\s*'([^']+)'/.exec(viewer);
const fillKey = fk?.[1] ?? null;
const klinkeFill = hall?.id ? KLINKE_FUELLUNG[hall.id] ?? {} : {};
const fillBy = {};
let fillTris = 0, fillNear = 0, fillCoinc = 0, fillPartial = 0, fillInDrop = 0, fillSigBad = 0, fillRegions = [];
if (viewer && !fk) fail('[8] der Viewer traegt keinen Schluessel /* hall-fill */ \'…\' mehr: Die Fuellung aus der Moebeldatei kaeme dann mit dem Material der vollen Stufe (eigenes Shaderprogramm, eigene Texturen). Marke zurueck (assets/hangar-viewer.js, HALL_FILL), oder dieses Tor mitnehmen');
if (hall?.furniture?.url && existsSync(fromUrl(hall.furniture.url)) && fillKey) {
  const ff = fromUrl(hall.furniture.url), json = glbJson(ff), fill = json?.extras?.furnitureOf?.fill;
  const liteUrl = hall.url.split('?')[0], liteDoc = stageDocs.get(liteUrl);
  if (!fill || !Array.isArray(fill.regions)) fail(`[8] ${hall.furniture.url.split('?')[0]} nennt keine Fuellung (extras.furnitureOf.fill): nicht vom aktuellen scripts/build-hall-furniture.mjs gebaut?`);
  else {
    fillRegions = fill.regions;
    // gerechnet gegen die leichtere Stufe, die die Seite laedt
    const liteSha = existsSync(fromUrl(hall.url)) ? createHash('sha1').update(readFileSync(fromUrl(hall.url))).digest('hex') : null;
    if (fill.sha1 !== liteSha) fail(`[8] die Fuellung ist gegen ${fill.file ?? '(keine)'} sha1 ${String(fill.sha1).slice(0, 8)} gerechnet, die Seite laedt ${liteUrl} sha1 ${String(liteSha).slice(0, 8)}: Moebeldatei neu bauen (scripts/build-hall-furniture.mjs)`);
    for (const r of fill.regions) if (!r.tris) fail(`[8] der Bereich „${r.name}“ (FILL) fuellt nichts mehr: Traegt die leichtere Stufe die Stelle inzwischen selbst, den Eintrag aus FILL in scripts/build-hall-furniture.mjs und aus KLINKE_FUELLUNG nehmen, sonst den Kasten nachmessen`);
  }
  const nodes = (json?.nodes ?? []).filter((n) => n.extras?.[fillKey] != null && n.mesh != null);
  for (const n of nodes) {
    if (n.extras?.furniture != null || n.extras?.anchor || (detailKey && n.extras?.[detailKey])) fail(`[8] Knoten ${n.name ?? '?'} ist Fuellung und zugleich Moebel oder Ergaenzung: scripts/build-hall-furniture.mjs trennt das`);
    const name = String(n.extras[fillKey]);
    for (const p of json.meshes[n.mesh].primitives) fillBy[name] = (fillBy[name] ?? 0) + (json.accessors[p.indices ?? p.attributes?.POSITION]?.count ?? 0) / 3;
  }
  fillTris = Object.values(fillBy).reduce((a, b) => a + b, 0);
  // Die Fuellung bringt nur Namen und Faktoren mit; das Material samt
  // Texturen gibt ihr der Viewer aus der leichteren Stufe, nach Name und
  // Eckfarben; dafuer traegt sie deren Attributsatz
  const liteSigs = sigsByMat(existsSync(fromUrl(hall.url)) ? glbJson(fromUrl(hall.url)) : null);
  for (const n of nodes) for (const p of json.meshes[n.mesh].primitives) {
    const mn = json.materials?.[p.material]?.name ?? '?', s = attrSig(json, p);
    if (!liteSigs.has(mn)) fail(`[8] die Fuellung „${n.extras[fillKey]}“ traegt „${mn}“, die leichtere Stufe nicht: Ohne das gleichnamige Material bliebe sie ohne Texturen. Material in FILL (scripts/build-hall-furniture.mjs) pruefen`);
    else if (!liteSigs.get(mn).has(s)) {
      fillSigBad++;
      fail(`[8] die Fuellung „${n.extras[fillKey]}“ traegt „${mn}“ mit ${s}, die leichtere Stufe nur mit ${[...liteSigs.get(mn)].join(' / ')}: Der Viewer gibt ihr das Material nach Name und Eckfarben (ohne Gegenstueck bliebe sie ohne Texturen), ein anderer Satz braucht ein eigenes Shaderprogramm, und fehlen Texturkoordinaten, liegt die Textur verschmiert. Moebeldatei neu bauen; bleibt es, clipInto in scripts/build-hall-furniture.mjs pruefen (je Attributsatz der leichteren Stufe eine Primitive)`);
    }
  }
  for (const [name, k] of Object.entries(klinkeFill)) if ((fillBy[name] ?? 0) < k) fail(`[8] „${name}“: ${fillBy[name] ?? 0} Dreiecke Fuellung, die Klinke verlangt ${k}: Dort sieht man wieder durch die leichtere Stufe ins Dunkle (FILL in scripts/build-hall-furniture.mjs). KLINKE_FUELLUNG nur per Commit mit Ursache senken`);
  for (const name of Object.keys(fillBy).filter((n) => !(n in klinkeFill))) fail(`[8] „${name}“ fuellt ${fillBy[name]} Dreiecke ohne Klinke: in KLINKE_FUELLUNG dieses Tors eintragen`);
  // Liegt sie auf der leichteren Stufe, oder im Bereich einer Ausnahme?
  // Je Bereich gegen die Dreiecke der leichteren Stufe an seinem Rand,
  // mit denselben Probepunkten wie der Build
  if (nodes.length) {
    if (!liteDoc) fail(`[8] die leichtere Stufe ${liteUrl} ist nicht gemessen ([3]): ohne sie kein Abgleich der Fuellung`);
    const doc = await decode(ff);
    const regs = new Map();
    for (const node of doc.getRoot().listNodes()) {
      const name = node.getExtras()?.[fillKey];
      if (name == null) continue;
      const r = regs.get(String(name)) ?? { tris: [], near: [], coinc: 0, partial: 0 };
      for (const p of node.getMesh()?.listPrimitives() ?? []) r.tris.push(...worldTris(node, p));
      regs.set(String(name), r);
    }
    for (const r of regs.values()) {
      r.box = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
      for (const q of r.tris.flat()) for (let a = 0; a < 3; a++) { r.box[0][a] = Math.min(r.box[0][a], q[a]); r.box[1][a] = Math.max(r.box[1][a], q[a]); }
    }
    for (const node of liteDoc?.getRoot().listNodes() ?? []) for (const p of node.getMesh()?.listPrimitives() ?? []) for (const t of worldTris(node, p)) for (const r of regs.values()) if (touches(r.box, t, 0.05)) r.near.push(t);
    for (const [name, r] of regs) {
      fillNear += r.near.length;
      const near = withNormals(r.near);
      for (const t of r.tris) {
        const n = normalOf(t), pr = samples(t), on = pr.filter((q) => onLite(q, n, near)).length;
        if (on === pr.length) r.coinc++;
        else if (on) r.partial++;
        if (t.some((q) => entries.some((d) => q.every((v, a) => v >= d.reach[0][a] && v <= d.reach[1][a])))) fillInDrop++; // Ecken genuegen, wie in [7]
      }
      fillCoinc += r.coinc;
      fillPartial += r.partial;
      if (r.coinc) fail(`[8] „${name}“: ${r.coinc} Dreiecke der Fuellung liegen ganz auf einer gleich ausgerichteten Flaeche der leichteren Stufe (unter ${FILL_TOL * 1000} mm): Dort flimmern beide gegeneinander, der Build laesst solche aus. Moebeldatei neu bauen (scripts/build-hall-furniture.mjs)`);
      if (r.partial) fail(`[8] „${name}“: ${r.partial} Dreiecke der Fuellung liegen teilweise auf einer gleich ausgerichteten Flaeche der leichteren Stufe (unter ${FILL_TOL * 1000} mm): Dort flimmern beide gegeneinander. Kasten in FILL (scripts/build-hall-furniture.mjs) so enger fassen oder teilen, dass er die Flaeche nicht mehr schneidet`);
    }
    if (fillInDrop) fail(`[8] die Fuellung bringt ${fillInDrop} Dreiecke in den Bereich einer Ausnahme aus HALL_DROP zurueck: Das entfernte Teil stuende dort wieder. Kasten in FILL enger fassen`);
  }
} else if (!hall?.furniture?.url) say('    (die Seite laedt keine Moebeldatei: nichts zu fuellen)');
for (const k of Object.keys(KLINKE_FUELLUNG).filter((k) => k !== hall?.id)) fail(`[8] KLINKE_FUELLUNG["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);
say(`    Schluessel im Viewer: ${fillKey ?? '(keiner)'}   Bereiche: ${fillRegions.map((r) => `${r.name} ${fillBy[r.name] ?? 0} (Klinke ${klinkeFill[r.name] ?? '?'}, ${r.skipped ?? '?'} deckungsgleich ausgelassen)`).join('; ') || '(keine)'}   leichtere Stufe daneben: ${fillNear} Dreiecke`);
sollIst(`je Bereich mindestens seine Klinke, 0 ganz oder teilweise aufliegend, 0 im Bereich einer Ausnahme, Attribute wie die leichtere Stufe`, `${fillTris} Dreiecke in ${Object.keys(fillBy).length} Bereichen, ${fillCoinc} ganz und ${fillPartial} teilweise aufliegend, ${fillInDrop} im Bereich einer Ausnahme, ${fillSigBad} Primitiven mit anderen Attributen`);

say('\n[9] Am Telefon bringt die Telefon-Datei Ergaenzung und Fuellung, dieselben Knoten');
// Der Viewer laedt sie am Telefon an Stelle der Moebeldatei:
// furniture: /* hall-patch */ opts.hall.patch
const patchMark = /\/\* hall-patch \*\/\s*opts\.hall\.patch\b/.test(viewer);
let patchNodes = 0, patchTris = 0, patchMissing = 0, patchExtra = 0, patchForeign = 0, patchTex = 0, patchBytes = 0, furnParts = 0;
if (viewer && !patchMark) fail('[9] der Viewer laedt am Telefon die Telefon-Datei nicht mehr (furniture: /* hall-patch */ opts.hall.patch im Zweig fuer Telefone): Dort fehlten wieder Glas, Rohre und die Fuellung. Marke zurueck (assets/hangar-viewer.js, Aufruf von loadRealHall), oder dieses Tor mitnehmen');
if (hall?.furniture?.url && !hall.patch?.url) fail('[9] die Seite gibt zur Moebeldatei keine Telefon-Datei mit (opts.hall.patch): Am Telefon fehlten Glas, Rohre und die Fuellung. scripts/build-hall-furniture.mjs baut sie neben die Moebeldatei, HangarApp.astro reicht sie weiter');
if (hall?.patch?.url && !hall.furniture?.url) fail(`[9] die Seite gibt eine Telefon-Datei (${hall.patch.url.split('?')[0]}) ohne Moebeldatei mit: Sie ist aus einer Moebeldatei geschnitten, ohne diese ist sie ein Rest (HangarApp.astro)`);
// Fingerabdruck einer Primitive: je Dreieck die Ecken (Lage im Modellraum
// der Halle, dazu jedes Attribut), so gedreht, dass die kleinste vorn steht
// (der Drehsinn bleibt), sortiert. Der Build packt beide Dateien aus
// denselben Daten mit denselben Draco-Rastern; gleich heissen also
// gleiche Zahlen, nur die Reihenfolge darf wechseln.
const primPrint = (node, p) => {
  const w = node.getWorldMatrix(), P = p.getAttribute('POSITION'), I = p.getIndices();
  const accs = p.listSemantics().filter((x) => x !== 'POSITION').sort().map((x) => p.getAttribute(x));
  const e = [], vk = (i) => {
    const [x, y, z] = P.getElement(i, e);
    const q = [w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]];
    return [q, ...accs.map((a) => a.getElement(i, []))].map((v) => v.map((c) => c.toFixed(4)).join(',')).join(';');
  };
  const n = I ? I.getCount() : P.getCount(), out = [];
  for (let t = 0; t + 2 < n; t += 3) {
    const k = (I ? [I.getScalar(t), I.getScalar(t + 1), I.getScalar(t + 2)] : [t, t + 1, t + 2]).map(vk);
    const r = k.indexOf([...k].sort()[0]);
    out.push(`${k[r]}|${k[(r + 1) % 3]}|${k[(r + 2) % 3]}`);
  }
  return { tris: out.length, print: createHash('sha1').update(out.sort().join('\n')).digest('hex').slice(0, 12) };
};
// Je Primitive mit Ergaenzung oder Fuellung: Schluessel, Material, Attributsatz, Fingerabdruck
const partsOf = (doc) => {
  const out = [];
  for (const node of doc.getRoot().listNodes()) {
    const x = node.getExtras() ?? {};
    const kind = detailKey && x[detailKey] === true ? `${detailKey}` : fillKey && x[fillKey] != null ? `${fillKey}=${x[fillKey]}` : null;
    if (!kind) continue;
    for (const p of node.getMesh()?.listPrimitives() ?? []) {
      const sig = p.listSemantics().sort().map((s) => `${s}:${p.getAttribute(s).getType()}`).join(',');
      const { tris, print } = primPrint(node, p);
      out.push({ key: `${kind} | ${p.getMaterial()?.getName() ?? '?'} | ${sig} | ${tris} Dreiecke | ${print}`, tris });
    }
  }
  return out;
};
if (hall?.patch?.url && hall.furniture?.url) {
  const pf = fromUrl(hall.patch.url), ff = fromUrl(hall.furniture.url);
  if (!existsSync(pf)) fail(`[9] die Telefon-Datei ${hall.patch.url.split('?')[0]} liegt nicht in dist/`);
  else if (existsSync(ff)) {
    patchBytes = readFileSync(pf).length;
    const pj = glbJson(pf), of = pj?.extras?.patchOf, furnSha = sha1(ff), ffName = ff.split(/[\\/]/).pop();
    if (!of?.sha1) fail(`[9] ${hall.patch.url.split('?')[0]} nennt keine Herkunft (extras.patchOf): nicht von scripts/build-hall-furniture.mjs gebaut?`);
    else if (of.file !== ffName || of.sha1 !== furnSha) fail(`[9] die Telefon-Datei stammt aus ${of.file} sha1 ${String(of.sha1).slice(0, 8)}, ausgeliefert ist ${ffName} sha1 ${furnSha.slice(0, 8)}: npm run build neu laufen lassen (scripts/build-hall-furniture.mjs baut beide zusammen)`);
    const furnIn = furnNodes(pj);
    patchTex = (pj?.images?.length ?? 0) + (pj?.textures?.length ?? 0);
    if (furnIn) fail(`[9] die Telefon-Datei traegt ${furnIn} Moebel: Am Telefon sollen sie nicht laden (641 000 Dreiecke). scripts/build-hall-furniture.mjs nimmt sie heraus`);
    if (patchTex) fail(`[9] die Telefon-Datei traegt ${pj.images?.length ?? 0} Bilder und ${pj.textures?.length ?? 0} Texturen: Ergaenzung und Fuellung bekommen ihre Texturen im Viewer aus der leichteren Stufe, in der Datei waeren sie nur Gewicht`);
    for (const n of pj?.nodes ?? []) if (n.mesh != null && !(detailKey && n.extras?.[detailKey] === true) && !(fillKey && n.extras?.[fillKey] != null)) patchForeign++;
    if (patchForeign) fail(`[9] die Telefon-Datei traegt ${patchForeign} Knoten, die weder Ergaenzung noch Fuellung sind: Der Viewer setzte sie am Telefon ungeprueft in die Halle (scripts/build-hall-furniture.mjs)`);
    // Dieselben Teile wie die Moebeldatei, je Primitive
    const [fdoc, pdoc] = await Promise.all([decode(ff), decode(pf)]);
    const want = partsOf(fdoc), have = partsOf(pdoc);
    furnParts = want.length;
    patchNodes = new Set(pdoc.getRoot().listNodes().filter((n) => n.getMesh()).map((n) => n)).size;
    patchTris = have.reduce((a, b) => a + b.tris, 0);
    const left = new Map();
    for (const { key } of have) left.set(key, (left.get(key) ?? 0) + 1);
    const miss = [];
    for (const { key } of want) { if (left.get(key)) left.set(key, left.get(key) - 1); else miss.push(key); }
    const extra = [...left].flatMap(([k, n]) => Array(n).fill(k));
    patchMissing = miss.length; patchExtra = extra.length;
    if (miss.length || extra.length) fail(`[9] die Telefon-Datei weicht von der Moebeldatei ab: ${miss.length} Primitive fehlen oder sind anders (${miss.slice(0, 3).join('; ')}${miss.length > 3 ? '; …' : ''}), ${extra.length} sind zu viel oder anders (${extra.slice(0, 3).join('; ')}${extra.length > 3 ? '; …' : ''}). Am Telefon saehe die Halle dann anders aus als am Rechner. Moebeldatei und Telefon-Datei neu bauen (scripts/build-hall-furniture.mjs, prune mit keepAttributes)`);
  }
}
const klinkePatch = klinkeErg + Object.values(klinkeFill).reduce((a, b) => a + b, 0);
if (hall?.patch?.url && hall.furniture?.url && patchTris < klinkePatch) fail(`[9] die Telefon-Datei bringt ${patchTris} Dreiecke, Ergaenzung und Fuellung verlangen zusammen ${klinkePatch} (KLINKE_ERGAENZUNG und KLINKE_FUELLUNG)`);
say(`    Viewer laedt sie am Telefon: ${patchMark ? 'ja' : 'nein'}   Datei: ${hall?.patch?.url?.split('?')[0] ?? '(keine)'} ${patchBytes ? `${(patchBytes / 1e3).toFixed(0)} KB` : ''}`);
sollIst(`aus der ausgelieferten Moebeldatei, deren ${furnParts} Primitiven mit Ergaenzung und Fuellung gleich (mindestens ${klinkePatch} Dreiecke), 0 Moebel, 0 Texturen, 0 fremde Knoten`, `${patchTris} Dreiecke in ${patchNodes} Knoten, ${patchMissing} fehlen oder anders, ${patchExtra} zu viel, ${patchTex} Texturen und Bilder, ${patchForeign} fremde Knoten`);

say('\n[10] Das Schiffsfeld faehrt als Aufzug: kein bleibendes Dreieck reicht hinein');
// Der Block steht im Viewer zwischen /* hall-lift */ und /* /hall-lift */ und ist JSON
const lm = /\/\* hall-lift \*\/([\s\S]*?)\/\* \/hall-lift \*\//.exec(viewer);
let liftAll = null;
try { liftAll = lm ? JSON.parse(lm[1]) : null; } catch (e) { fail(`[10] HALL_LIFT im Viewer ist kein JSON mehr (${e.message})`); }
if (viewer && !lm) fail('[10] der Viewer traegt keinen Block /* hall-lift */ … /* /hall-lift */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
liftAll ??= {};
for (const k of Object.keys(liftAll).filter((k) => k !== hall?.id)) fail(`[10] HALL_LIFT["${k}"]: die Seite laedt diese Halle nicht; Eintrag entfernen oder die Halle zurueck`);
const LIFT = hall?.id ? liftAll[hall.id] ?? null : null;
const LIFT_E = 0.01;
const liftRuns = [], liftExtra = [];
// Moebel- und Telefon-Datei, wie [10] sie liest; [13] braucht sie auch
const extraDocs = new Map();
if (LIFT) {
  const pair = (q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite);
  if (!(pair(LIFT.from) && pair(LIFT.to) && pair(LIFT.y) && LIFT.from[0] < LIFT.to[0] && LIFT.from[1] < LIFT.to[1] && LIFT.y[0] < LIFT.y[1] && Number.isInteger(LIFT.min) && LIFT.min > 0)) {
    fail(`[10] HALL_LIFT["${hall.id}"] braucht from [x, z], to [x, z], y [unten, oben] und eine Klinke min`);
  } else {
    const [x0, z0] = LIFT.from, [x1, z1] = LIFT.to, [y0, y1] = LIFT.y, e = LIFT_E;
    // wie cutHallLift: im Kasten (x/z um 1 cm erweitert) faehrt es mit
    const inBox = (x, y, z) => x >= x0 - e && x <= x1 + e && z >= z0 - e && z <= z1 + e && y >= y0 && y <= y1;
    const deep = (x, y, z) => x > x0 + e && x < x1 - e && z > z0 + e && z < z1 - e && y >= y0 && y <= y1;
    for (const [u, doc] of stageDocs) {
      // Dieselben Geometrien wie der Viewer: mehrfach gestellte und solche
      // ohne Index schneidet er nicht, dort zaehlt jede Ecke im Feld als Riss
      const acc = new Map(), refs = new Map();
      const geo = (p) => [p.getIndices(), p.getAttribute('POSITION')].map((a) => (a ? acc.get(a) ?? acc.set(a, acc.size).get(a) : -1)).join(':');
      for (const node of doc.getRoot().listNodes()) for (const p of node.getMesh()?.listPrimitives() ?? []) refs.set(geo(p), (refs.get(geo(p)) || 0) + 1);
      let moved = 0, torn = 0;
      const ex = [], mats = new Map();
      for (const node of doc.getRoot().listNodes()) {
        const mesh = node.getMesh();
        // Moebel bleiben stehen (der Viewer nimmt sie aus, samt Kindern)
        let furn = false;
        for (let a = node; a && !furn; a = a.getParentNode()) furn = Array.isArray(a.getExtras()?.anchor);
        if (!mesh || furn) continue;
        const w = node.getWorldMatrix();
        for (const p of mesh.listPrimitives()) {
          const P = p.getAttribute('POSITION')?.getArray(), I = p.getIndices()?.getArray();
          if (!P) continue;
          const cuts = !!I && !(refs.get(geo(p)) > 1);
          const at = (i) => {
            const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
            return [w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]];
          };
          const n = I ? I.length : P.length / 3;
          for (let t = 0; t + 2 < n; t += 3) {
            const q = [at(I ? I[t] : t), at(I ? I[t + 1] : t + 1), at(I ? I[t + 2] : t + 2)];
            if (cuts && q.every((v) => inBox(...v))) {
              moved++;
              const mn = p.getMaterial()?.getName() ?? '';
              mats.set(mn, (mats.get(mn) || 0) + 1);
              continue;
            }
            if (q.some((v) => deep(...v))) {
              torn++;
              if (ex.length < 2) ex.push(`${p.getMaterial()?.getName()?.split('_mtl_').pop() ?? '?'} ${q.map((v) => `(${v.map((c) => c.toFixed(2)).join(' ')})`).join(' ')}`);
            }
          }
        }
      }
      liftRuns.push({ u, moved, torn, mats });
      say(`    ${u}: ${moved} Dreiecke fahren, ${torn} reichen hinein`);
      if (torn) fail(`[10] ${u}: ${torn} Dreiecke bleiben stehen und reichen mehr als 1 cm ins Schiffsfeld (z. B. ${ex.join('; ')}): Halle neu gebaut oder verschoben? Rand in HALL_LIFT (assets/hangar-viewer.js) nachmessen, er muss genau zwischen den Dreiecken liegen`);
      if (moved < LIFT.min) fail(`[10] ${u}: nur ${moved} Dreiecke im Schiffsfeld, die Klinke verlangt ${LIFT.min}: Liegt das Feld noch an dieser Stelle? HALL_LIFT nachmessen; min nur per Commit mit Ursache senken`);
    }
    if (!stageDocs.size) fail('[10] HALL_LIFT, aber keine Hallenstufe gemessen ([3])');
    // Moebeldatei und Telefon-Datei setzt der Viewer erst nach dem Schnitt
    // ein: Was davon auf Bodenhoehe im Feld liegt, bliebe ueber dem offenen
    // Schacht stehen. Ein Moebel, das nur mit der Kante hineinragt, steht
    // daneben fest (gezaehlt, kein Fehler); steht sein Bezugspunkt im Feld,
    // schwebte es.
    for (const u of [hall?.furniture?.url, hall?.patch?.url].filter(Boolean)) {
      const f = fromUrl(u);
      if (!existsSync(f)) continue;
      const doc = await decode(f);
      extraDocs.set(u.split('?')[0], doc);
      let stay = 0, over = 0, floating = 0;
      const ex = [], fx = [];
      for (const node of doc.getRoot().listNodes()) {
        let anchor = null;
        for (let a = node; a && !anchor; a = a.getParentNode()) anchor = Array.isArray(a.getExtras()?.anchor) ? a : null;
        const x = anchor?.getExtras().anchor;
        if (anchor === node && x && deep(...x)) { floating++; if (fx.length < 2) fx.push(`${node.getName()} (${x.map((c) => c.toFixed(2)).join(' ')})`); }
        const mesh = node.getMesh();
        if (!mesh) continue;
        const w = node.getWorldMatrix();
        let hit = false;
        for (const p of mesh.listPrimitives()) {
          const P = p.getAttribute('POSITION')?.getArray();
          if (!P) continue;
          for (let i = 0; i + 2 < P.length && !hit; i += 3) {
            const vx = P[i], vy = P[i + 1], vz = P[i + 2];
            hit = deep(w[0] * vx + w[4] * vy + w[8] * vz + w[12], w[1] * vx + w[5] * vy + w[9] * vz + w[13], w[2] * vx + w[6] * vy + w[10] * vz + w[14]);
          }
          if (hit && !anchor && ex.length < 2) ex.push(`${node.getName()} ${p.getMaterial()?.getName()?.split('_mtl_').pop() ?? '?'}`);
        }
        if (hit) { if (anchor) over++; else stay++; }
      }
      say(`    ${u.split('?')[0]}: ${stay} Teile auf Bodenhoehe im Feld, ${floating} Moebel mit Bezugspunkt im Feld, ${over} Moebelteile ragen mit der Kante hinein`);
      if (stay) fail(`[10] ${u.split('?')[0]}: ${stay} Teile (Ergaenzung oder Fuellung) liegen auf Bodenhoehe im Schiffsfeld (z. B. ${ex.join('; ')}) und blieben ueber dem offenen Schacht stehen: Der Viewer setzt diese Datei nach dem Schnitt ein. Teil aus dem Feld nehmen (scripts/build-hall-furniture.mjs) oder HALL_LIFT nachmessen`);
      if (floating) fail(`[10] ${u.split('?')[0]}: ${floating} Moebel stehen im Schiffsfeld (${fx.join('; ')}) und schwebten bei abgefahrenem Aufzug: HALL_LIFT nachmessen oder das Moebel per HALL_DROP herausnehmen`);
      liftExtra.push({ u: u.split('?')[0], stay, floating, over });
    }
  }
}
sollIst(LIFT ? `je Hallenstufe 0 Dreiecke, die ins Feld reichen, mindestens ${LIFT.min} fahren; aus Moebel- und Telefon-Datei 0 Teile und 0 Moebel im Feld` : 'kein Aufzug fuer diese Halle', [...liftRuns.map((r) => `${r.u}: ${r.torn} reichen hinein, ${r.moved} fahren`), ...liftExtra.map((r) => `${r.u}: ${r.stay} Teile, ${r.floating} Moebel`)].join('; ') || '(nichts gemessen)');

say('\n[11] Unter dem Feld steht der Schacht aus dem Spiel, ohne Luecke an Wand und Rand');
// Der Block steht im Viewer zwischen /* hall-shaft */ und /* /hall-shaft */ und ist JSON
const shm = /\/\* hall-shaft \*\/([\s\S]*?)\/\* \/hall-shaft \*\//.exec(viewer);
let shaftAll = null;
try { shaftAll = shm ? JSON.parse(shm[1]) : null; } catch (e) { fail(`[11] HALL_SHAFT im Viewer ist kein JSON mehr (${e.message})`); }
if (viewer && !shm) fail('[11] der Viewer traegt keinen Block /* hall-shaft */ … /* /hall-shaft */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
shaftAll ??= {};
for (const k of Object.keys(shaftAll).filter((k) => k !== hall?.id)) fail(`[11] HALL_SHAFT["${k}"]: die Seite laedt diese Halle nicht; Eintrag entfernen oder die Halle zurueck`);
for (const k of Object.keys(KLINKE_SCHACHT).filter((k) => k !== hall?.id)) fail(`[11] KLINKE_SCHACHT["${k}"]: die Seite laedt diese Halle nicht; den Eintrag hier per Commit mit Ursache entfernen`);
const SHAFT = hall?.id ? shaftAll[hall.id] ?? null : null;
const shaftRun = { parts: 0, tris: 0, lamps: 0, lights: 0, sides: [], uvTris: 0, wornTris: 0, deco: 0, decoTris: 0, decoKinds: [] };
// Beiwerk im Schacht: Block /* shaft-deco */ [Knoten, …] /* /shaft-deco */ im Viewer (JSON)
const sdm = /\/\* shaft-deco \*\/([\s\S]*?)\/\* \/shaft-deco \*\//.exec(viewer);
let decoNames = null, decoJsonBad = false;
try { decoNames = sdm ? JSON.parse(sdm[1]) : null; } catch (e) { decoJsonBad = true; fail(`[11] SHAFT_DECO im Viewer ist kein JSON mehr (${e.message})`); }
if (viewer && SHAFT && !sdm) fail('[11] der Viewer traegt keinen Block /* shaft-deco */ … /* /shaft-deco */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
// auch null oder eine Zahl: Der Viewer riefe darauf .includes auf, der Schacht fiele weg
if (sdm && !decoJsonBad && !(Array.isArray(decoNames) && decoNames.every((n) => typeof n === 'string' && n))) { fail(`[11] SHAFT_DECO muss eine Liste von Knotennamen sein (ist ${JSON.stringify(decoNames)}): Der Viewer baute den Schacht nicht`); decoNames = null; }
if (SHAFT && !LIFT) fail(`[11] HALL_SHAFT["${hall.id}"] ohne HALL_LIFT: Der Schacht steht unter dem Aufzug, ohne Feld gibt es keinen`);
if (!SHAFT && hall?.lift) fail(`[11] die Seite gibt einen Schacht mit (${hall.lift.url?.split('?')[0]}), HALL_SHAFT im Viewer kennt fuer ${hall.id} keinen: Er wuerde geladen, aber nie gebaut. HALL_SHAFT eintragen oder HangarApp.astro ohne lift`);
if (SHAFT && LIFT) {
  const K = KLINKE_SCHACHT[hall.id];
  if (!K) fail(`[11] die Halle ${hall.id} hat keine KLINKE_SCHACHT in diesem Tor: gemessene Werte eintragen`);
  const pairs = (a) => Array.isArray(a) && a.every((q) => Array.isArray(q) && q.length === 2 && typeof q[0] === 'string' && Number.isFinite(q[1]));
  if (!SHAFT.kit || !pairs(SHAFT.long) || !pairs(SHAFT.cross) || !Array.isArray(SHAFT.lamps?.long) || !Array.isArray(SHAFT.lamps?.cross)) fail(`[11] HALL_SHAFT["${hall.id}"] braucht kit, long und cross als [Teil, Anfang] und lamps { long, cross }`);
  else if (!hall.lift?.url || !hall.lift?.json) fail(`[11] HALL_SHAFT["${hall.id}"] nennt den Bausatz ${SHAFT.kit}, die Seite gibt keinen Schacht mit (opts.hall.lift { url, json }): Der Viewer liesse das Feld wieder ins Schwarze fahren. hangar-assets.json (lift) und HangarApp.astro pruefen`);
  else if (!existsSync(fromUrl(hall.lift.url)) || !existsSync(fromUrl(hall.lift.json))) fail(`[11] der Schacht ${hall.lift.url.split('?')[0]} oder seine Lampenliste ${hall.lift.json.split('?')[0]} liegt nicht in dist/`);
  else if (!hall.lift.url.split('?')[0].endsWith(`/${SHAFT.kit}.glb`)) fail(`[11] HALL_SHAFT["${hall.id}"] nennt den Bausatz ${SHAFT.kit}, die Seite laedt ${hall.lift.url.split('?')[0]}`);
  else {
    let info = null;
    try { info = JSON.parse(readFileSync(fromUrl(hall.lift.json), 'utf8')); } catch (e) { fail(`[11] ${hall.lift.json.split('?')[0]} ist kein JSON (${e.message})`); }
    const doc = await decode(fromUrl(hall.lift.url));
    // je Teil: Ausdehnung im Bezugssystem des Teils und Dreiecke
    const box = new Map();
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const w = node.getWorldMatrix(), mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      let tris = 0;
      for (const p of mesh.listPrimitives()) {
        const P = p.getAttribute('POSITION')?.getArray();
        if (!P) continue;
        tris += (p.getIndices()?.getCount() ?? P.length / 3) / 3;
        for (let i = 0; i + 2 < P.length; i += 3) {
          const x = P[i], y = P[i + 1], z = P[i + 2];
          const q = [w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]];
          for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], q[a]); mx[a] = Math.max(mx[a], q[a]); }
        }
      }
      box.set(node.getName(), { mn, mx, tris });
    }
    const need = ['wall', 'wall_upper', 'rib', 'corner', 'rim', 'rim_corner', 'light_0', 'light_1'];
    const miss = need.filter((r) => !box.has(r));
    if (miss.length) fail(`[11] dem Schacht ${hall.lift.url.split('?')[0]} fehlen Teile: ${miss.join(', ')} (der Viewer baut ihn dann nicht)`);
    // Schacht-Tiefe (17.10.2026): Der Viewer legt die Karten des Spiels nur
    // auf ein Material, dessen Stuecke alle Koordinaten tragen, sonst nimmt
    // er ihren Mittelwert (die Wand wird wieder einfarbig). Die Abnutzung
    // zeigt er, wo COLOR_0.a abfaellt, mit den Karten des Knotens wear_0
    // (Material <Name>_wear); fehlt eins davon, bleibt der Lack still neu.
    const wearMats = new Set();
    for (const node of doc.getRoot().listNodes()) if (node.getName() === 'wear_0') for (const p of node.getMesh()?.listPrimitives() ?? []) if (p.getMaterial()?.getBaseColorTexture()) wearMats.add(p.getMaterial().getName());
    const noUv = [];
    for (const node of doc.getRoot().listNodes()) {
      if (![...need, 'rim_8'].includes(node.getName())) continue;
      for (const p of node.getMesh()?.listPrimitives() ?? []) {
        const I = p.getIndices()?.getArray(), C = p.getAttribute('COLOR_0'), name = p.getMaterial()?.getName() ?? '';
        const t = (I ? I.length : p.getAttribute('POSITION').getCount()) / 3;
        if (p.getAttribute('TEXCOORD_0')) shaftRun.uvTris += t; else noUv.push(`${node.getName()}/${name.split('_mtl_').pop()}`);
        if (!wearMats.has(`${name}_wear`) || C?.getElementSize() !== 4) continue;
        const a = (i) => C.getElement(i, [])[3];
        for (let k = 0; k < t; k++) {
          const [i0, i1, i2] = I ? [I[k * 3], I[k * 3 + 1], I[k * 3 + 2]] : [k * 3, k * 3 + 1, k * 3 + 2];
          if (Math.min(a(i0), a(i1), a(i2)) < 0.5) shaftRun.wornTris++;
        }
      }
    }
    if (noUv.length) fail(`[11] im Schacht ${hall.lift.url.split('?')[0]} tragen ${noUv.join(', ')} keine Texturkoordinaten: Der Viewer naehme fuer das ganze Material wieder den Mittelwert der Karten (einfarbige Wand). Export pruefen (prune mit keepAttributes, hangar-werkstatt Teil B)`);
    if (!wearMats.size) fail(`[11] der Schacht ${hall.lift.url.split('?')[0]} hat keinen Knoten wear_0 mit Farbkarte: Die Abnutzung des Spiels fiele still weg, der Lack saehe neu aus`);
    // Beiwerk (SHAFT_DECO im Viewer): Lichtrahmen und Leuchtengehaeuse an den
    // Schachtwaenden. Der Viewer laesst eine Art ohne Knoten oder ohne
    // Exemplare in info.deco still weg, ebenso Exemplare auf dem Hallenboden
    // (ueber y -0,5) und ohne Drehung; sonst setzt er jedes (shaftDecoList),
    // gezaehlt wird hier mit derselben Regel
    if (decoNames) for (const n of decoNames) {
      const ds = (info?.deco ?? []).filter((e) => e.node === n);
      if (!box.has(n) || !box.get(n).tris) fail(`[11] SHAFT_DECO nennt ${n}, der Schacht ${hall.lift.url.split('?')[0]} hat dafuer keinen Knoten mit Dreiecken: Das Beiwerk fiele still weg. Name pruefen (Befund PC in .planning/notes/hangar-schacht-tiefe.md)`);
      else if (!ds.length) fail(`[11] SHAFT_DECO nennt ${n}, ${hall.lift.json.split('?')[0]} hat dafuer keinen Eintrag in deco: keine Exemplare, nichts zu setzen`);
      else {
        const inShaft = ds.flatMap((d) => d.at ?? []).filter((e) => e.at?.[1] < -0.5 && Array.isArray(e.q) && e.q.length === 4).length;
        shaftRun.deco += inShaft; shaftRun.decoTris += inShaft * box.get(n).tris;
        shaftRun.decoKinds.push(`${n} ${inShaft}`);
      }
    }
    // Rahmen jedes Teils (x entlang der Wand, y nach oben, ab 0) gegen die
    // Lampenliste: verrutscht ein Teil beim Export, klafft die Wand
    const E = 0.05;
    for (const r of ['wall', 'wall_upper', 'rib', 'rim', 'rim_8']) {
      const b = box.get(r), sz = info?.modules?.[r]?.size;
      if (!b || !sz) { if (r !== 'rim_8') fail(`[11] Teil ${r}: keine Groesse in ${hall.lift.json.split('?')[0]} (modules.${r}.size)`); continue; }
      if (Math.abs(b.mn[0]) > E || Math.abs(b.mx[0] - sz[0]) > E || Math.abs(b.mn[1]) > E || Math.abs(b.mx[1] - sz[1]) > E || b.mx[2] > E) fail(`[11] Teil ${r} liegt nicht in seinem Rahmen: x ${b.mn[0].toFixed(2)}..${b.mx[0].toFixed(2)} (Soll 0..${sz[0]}), y ${b.mn[1].toFixed(2)}..${b.mx[1].toFixed(2)} (Soll 0..${sz[1]}), Wand bei z <= 0 (Ist bis ${b.mx[2].toFixed(2)}). Export pruefen (scripts/build-hangar-assets.mjs, LIFT_PARTS)`);
    }
    const corner = box.get('corner');
    const inset = corner ? Math.max(0, corner.mx[0]) : 0;   // so weit ragt die Ecke an beiden Waenden herein
    const len = { long: LIFT.to[1] - LIFT.from[1], cross: LIFT.to[0] - LIFT.from[0] };
    const sizeOf = (r) => info?.modules?.[r]?.size?.[0] ?? (box.get(r) ? box.get(r).mx[0] - box.get(r).mn[0] : 0);
    for (const kind of ['long', 'cross']) {
      const L0 = len[kind];
      // Innenflaeche bedeckt: Ecken an beiden Enden, dazu die Teile
      const iv = [[0, inset], [L0 - inset, L0], ...SHAFT[kind].map(([r, a]) => [a, a + sizeOf(r)])].map(([a, b]) => [Math.max(0, a), Math.min(L0, b)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
      let reach = 0, gap = null;
      for (const [a, b] of iv) { if (a > reach + 0.01 && !gap) gap = [reach, a]; reach = Math.max(reach, b); }
      if (reach < L0 - 0.01 && !gap) gap = [reach, L0];
      const bad = SHAFT[kind].filter(([r]) => !box.has(r) || !['wall', 'rib'].includes(r)).map(([r]) => r);
      if (bad.length) fail(`[11] HALL_SHAFT["${hall.id}"].${kind}: ${bad.join(', ')} ist kein Wandteil (wall, rib)`);
      if (gap) fail(`[11] die ${kind === 'long' ? 'Laengswand' : 'Querwand'} (${L0} m) hat eine Luecke von ${gap[0].toFixed(2)} bis ${gap[1].toFixed(2)} m: Dort saehe man hinter den Schacht ins Leere. HALL_SHAFT["${hall.id}"].${kind} nachrechnen (Ecke ${inset.toFixed(2)} m, ${SHAFT[kind].map(([r, a]) => `${r} ab ${a}`).join(', ')})`);
      // Randleiste: 16er, dann 8er bis genau ans Ende (wie buildShaft)
      const r16 = sizeOf('rim'), r8 = box.has('rim_8') ? sizeOf('rim_8') : 0;
      let a = 0, rims = 0;
      for (; r16 > 0 && a + r16 <= L0 + 1e-3; a += r16) rims++;
      for (; r8 > 0 && a + r8 <= L0 + 1e-3; a += r8) rims++;
      if (Math.abs(a - L0) > 0.01) fail(`[11] die Randleiste der ${kind === 'long' ? 'Laengswand' : 'Querwand'} endet bei ${a} m statt ${L0} m: Dort klafft die Kante zwischen Hallenboden und Schacht`);
      // genau eine Warnlampe je Rippe (wie im Spiel): eine doppelt gesetzte darf keine fehlende verdecken
      const ribs = SHAFT[kind].filter(([r]) => r === 'rib').map(([, a0]) => a0), wand = kind === 'long' ? 'Laengswand' : 'Querwand';
      const onRib = SHAFT.lamps[kind].map((c) => [c, ribs.find((a0) => c >= a0 && c <= a0 + sizeOf('rib'))]);
      if (!ribs.length) fail(`[11] HALL_SHAFT["${hall.id}"].${kind}: die ${wand} hat keine Rippe, im Spiel traegt jede Schachtwand Rippen mit Warnlampen; ohne sie zaehlte diese Pruefung nichts`);
      for (const [c, a0] of onRib) if (a0 == null) fail(`[11] Warnlampe bei ${c} m an der ${wand} sitzt auf keiner Rippe`);
      for (const a0 of ribs) {
        const n = onRib.filter(([, o]) => o === a0).length;
        if (n !== 1) fail(`[11] die Rippe ab ${a0} m an der ${wand} traegt ${n} Warnlampen statt einer: HALL_SHAFT["${hall.id}"].lamps.${kind} nachrechnen (${SHAFT.lamps[kind].join(', ') || 'keine'})`);
      }
      const tris = 2 * ((box.get('corner')?.tris ?? 0) + (box.get('rim_corner')?.tris ?? 0) + (box.get('light_1')?.tris ?? 0)
        + SHAFT[kind].reduce((n, [r]) => n + (box.get(r)?.tris ?? 0), 0) + SHAFT.lamps[kind].length * (box.get('light_0')?.tris ?? 0)) + 2 * rims * (box.get('rim')?.tris ?? 0);
      shaftRun.tris += tris; shaftRun.parts += 2 * (3 + SHAFT[kind].length + SHAFT.lamps[kind].length + rims); shaftRun.lamps += 2 * SHAFT.lamps[kind].length;
      shaftRun.sides.push(`${kind} ${L0} m: ${gap ? 'Luecke' : 'dicht'}, Rand ${a} m`);
    }
    // Lampen, die der Viewer rechnet (shaftLights): mit Stärke, Reichweite, nicht der Dunst
    shaftRun.lights = (info?.lights ?? []).filter((l) => (l.states?.emergency?.intensity ?? l.intensity ?? 0) > 0.05 && l.radius > 0 && l.role !== 'fog').length;
    if (K) {
      if (shaftRun.tris + shaftRun.decoTris > K.maxTris) fail(`[11] der Schacht kommt mit Beiwerk auf ${shaftRun.tris + shaftRun.decoTris} Dreiecke (${shaftRun.decoTris} davon Beiwerk), die Obergrenze ist ${K.maxTris}: zu teuer fuer einen Schiffswechsel. Bausatz pruefen (scripts/build-hangar-assets.mjs, Art lift); Obergrenze nur per Commit mit Ursache anheben`);
      if (shaftRun.tris < K.minTris) fail(`[11] der Schacht kommt nur auf ${shaftRun.tris} Dreiecke, die Klinke verlangt ${K.minTris}: Teile verloren oder vereinfacht? KLINKE_SCHACHT nur per Commit mit Ursache senken`);
      if (shaftRun.lights < K.lights) fail(`[11] ${hall.lift.json.split('?')[0]} bringt ${shaftRun.lights} Schachtlampen mit Licht, die Klinke verlangt ${K.lights}: Lampen beim Export verloren (Zustand emergency)? KLINKE_SCHACHT nur per Commit mit Ursache senken`);
      if (decoNames && shaftRun.deco < K.deco) fail(`[11] im Schacht stehen nur ${shaftRun.deco} Exemplare Beiwerk (${shaftRun.decoKinds.join(', ') || 'keine'}), die Klinke verlangt ${K.deco}: Exemplare beim Export verloren oder SHAFT_DECO gekuerzt? KLINKE_SCHACHT nur per Commit mit Ursache senken`);
      if (shaftRun.wornTris < K.worn) fail(`[11] im Schacht tragen nur ${shaftRun.wornTris} Dreiecke des Bausatzes Abnutzung (COLOR_0.a unter 0,5 auf einem Material mit wear_0-Schicht), die Klinke verlangt ${K.worn}: Vertexfarbe beim Export auf drei Kanaele geschrumpft? KLINKE_SCHACHT nur per Commit mit Ursache senken`);
    }
  }
}
sollIst(SHAFT ? `Bausatz ${SHAFT.kit} mit allen Teilen in ihrem Rahmen, Laengs- und Querwand ohne Luecke, Randleiste bis ans Ende, je Rippe genau eine Warnlampe, ${KLINKE_SCHACHT[hall.id]?.minTris ?? '?'} bis ${KLINKE_SCHACHT[hall.id]?.maxTris ?? '?'} Dreiecke, mindestens ${KLINKE_SCHACHT[hall.id]?.lights ?? '?'} Lampen, alle Teile mit Texturkoordinaten, mindestens ${KLINKE_SCHACHT[hall.id]?.worn ?? '?'} Dreiecke mit Abnutzung, mindestens ${KLINKE_SCHACHT[hall.id]?.deco ?? '?'} Exemplare Beiwerk mit Knoten` : 'kein Schacht fuer diese Halle', SHAFT ? `${shaftRun.parts} Teile, ${shaftRun.tris} Dreiecke (bei 36 m), ${shaftRun.lamps} Warnlampen, ${shaftRun.lights} Lampen; ${shaftRun.sides.join('; ')}; Bausatz ${shaftRun.uvTris} Dreiecke mit Koordinaten, ${shaftRun.wornTris} mit Abnutzung; Beiwerk ${shaftRun.decoKinds.join(', ') || 'keins'} (${shaftRun.decoTris} Dreiecke)` : '(nichts gemessen)');

say('\n[12] Die Werkstatt kommt mit, jeder Platz und jede Spur auf dem Feld hat ihren Knoten');
let manifest = null;
try { manifest = JSON.parse(readFileSync(join(ROOT, 'src/data/hangar-assets.json'), 'utf8')); } catch (e) { fail(`[12] src/data/hangar-assets.json ist nicht lesbar (${e.message})`); }
const W = hall?.workshop ?? null, WM = manifest?.props?.werkstatt ?? null;
const workRun = { props: 0, decals: 0, items: 0, field: 0, tris: 0, bytes: 0, boden: 0, pad: [] };
const fm = /\/\* work-field \*\/([\s\S]*?)\/\* \/work-field \*\//.exec(viewer);
let field = null;
try { field = fm ? JSON.parse(fm[1]) : null; } catch (e) { fail(`[12] WORK_FIELD im Viewer ist kein JSON mehr (${e.message})`); }
if (viewer && W && !fm) fail('[12] der Viewer traegt keinen Block /* work-field */ … /* /work-field */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
const pm = /\/\* work-pad \*\/([\s\S]*?)\/\* \/work-pad \*\//.exec(viewer);
let pad = null;
try { pad = pm ? JSON.parse(pm[1]) : null; } catch (e) { fail(`[12] WORK_PAD im Viewer ist kein JSON mehr (${e.message})`); }
if (viewer && W && !pm) fail('[12] der Viewer traegt keinen Block /* work-pad */ … /* /work-pad */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
let padRe = null;
if (pad) {
  if (typeof pad.mats !== 'string' || !pad.mats.trim()) fail('[12] WORK_PAD.mats muss ein nichtleerer regulaerer Ausdruck sein: Leer traefe er jedes Material, und die Klinke zaehlte das ganze Feld');
  else try { padRe = new RegExp(pad.mats, 'i'); } catch (e) { fail(`[12] WORK_PAD.mats ist kein regulaerer Ausdruck (${e.message})`); }
}
if (WM && !W) fail(`[12] das Manifest nennt die Werkstatt (${WM.url}), die Seite gibt sie nicht mit (opts.hall.workshop): Die Halle bliebe steril. HangarApp.astro pruefen (props.werkstatt, json und boden)`);
if (W) {
  const files = { glb: W.url, json: W.json, boden: W.boden?.url };
  const missing = Object.entries(files).filter(([, u]) => !u || !existsSync(fromUrl(u))).map(([k, u]) => `${k} ${u?.split('?')[0] ?? '(keine)'}`);
  if (missing.length) fail(`[12] von der Werkstatt fehlt in dist/: ${missing.join(', ')}`);
  else {
    let info = null;
    try { info = JSON.parse(readFileSync(fromUrl(W.json), 'utf8')); } catch (e) { fail(`[12] ${W.json.split('?')[0]} ist kein JSON (${e.message})`); }
    if (info && info.v !== 1) fail(`[12] ${W.json.split('?')[0]} hat Version ${info.v}, der Viewer liest v 1`);
    // Knoten oben im GLB mit Dreiecken und Hoehe (aus den Accessor-Grenzen, ohne zu dekodieren)
    const nodesOf = (u) => {
      const j = glbJson(fromUrl(u)), out = new Map();
      for (const i of j?.scenes?.[j.scene ?? 0]?.nodes ?? []) {
        const nd = j.nodes[i];
        let tris = 0, y0 = Infinity, y1 = -Infinity;
        const walk = (k) => {
          const q = j.nodes[k];
          for (const pr of j.meshes?.[q.mesh]?.primitives ?? []) {
            const pos = j.accessors?.[pr.attributes?.POSITION];
            tris += (pr.indices != null ? j.accessors[pr.indices].count : pos?.count ?? 0) / 3;
            if (pos?.min && pos?.max) { y0 = Math.min(y0, pos.min[1] * (q.scale?.[1] ?? 1)); y1 = Math.max(y1, pos.max[1] * (q.scale?.[1] ?? 1)); }
          }
          for (const c of q.children ?? []) walk(c);
        };
        walk(i);
        if (nd.name) out.set(nd.name, { tris, flat: y1 - y0 });
      }
      return out;
    };
    const props = nodesOf(W.url), decals = nodesOf(W.boden.url);
    const P = [...props.keys()].filter((n) => n.startsWith('prop_')), D = [...decals.keys()].filter((n) => n.startsWith('decal_'));
    workRun.props = P.length; workRun.decals = D.length;
    workRun.tris = P.reduce((sum, n) => sum + props.get(n).tris, 0);
    workRun.bytes = readFileSync(fromUrl(W.url)).length; workRun.boden = readFileSync(fromUrl(W.boden.url)).length;
    const items = info?.layout?.items ?? [];
    workRun.items = items.length;
    const lost = items.filter((it) => !(it.node?.startsWith('prop_') ? props : decals).has(it.node)).map((it) => it.node);
    if (lost.length) fail(`[12] ${lost.length} Plaetze der Anordnung nennen Knoten, die ihre Datei nicht traegt (${[...new Set(lost)].slice(0, 3).join(', ')}): Der Viewer liesse sie still weg. Export pruefen (scripts/build-hangar-assets.mjs, Art props)`);
    const bent = D.filter((n) => decals.get(n).flat > 0.02);
    if (bent.length) fail(`[12] ${bent.length} Decals liegen nicht flach (${bent.slice(0, 3).map((n) => `${n} ${decals.get(n).flat.toFixed(2)} m hoch`).join(', ')}): Der Viewer legt sie als Quadrat in x/z auf den Boden, sie stuenden sonst im Raum`);
    for (const [n, u, v] of field ?? []) {
      if (!decals.has(n)) fail(`[12] WORK_FIELD nennt ${n}, ${W.boden.url.split('?')[0]} traegt den Knoten nicht: Die Spur fehlte still auf dem Feld. Namen im Viewer nachziehen`);
      else if (!(Math.abs(u) <= 1 && Math.abs(v) <= 1)) fail(`[12] WORK_FIELD ${n} bei ${u}, ${v}: ausserhalb des Felds (Bruchteile der halben Breite und Laenge, -1 bis 1)`);
      else workRun.field++;
    }
    const K = KLINKE_WERKSTATT, O = OBERGRENZE_WERKSTATT;
    if (workRun.props < K.props) fail(`[12] ${W.url.split('?')[0]} traegt ${workRun.props} Geraete (prop_*), die Klinke verlangt ${K.props}: beim Export verloren? KLINKE_WERKSTATT nur per Commit mit Ursache senken`);
    if (workRun.decals < K.decals) fail(`[12] ${W.boden.url.split('?')[0]} traegt ${workRun.decals} Decal-Arten, die Klinke verlangt ${K.decals}: beim Export verloren? KLINKE_WERKSTATT nur per Commit mit Ursache senken`);
    if (workRun.items < K.items) fail(`[12] die Anordnung hat ${workRun.items} Plaetze, die Klinke verlangt ${K.items}: KLINKE_WERKSTATT nur per Commit mit Ursache senken`);
    if (workRun.field < K.field) fail(`[12] auf dem Feld liegen ${workRun.field} Spuren (WORK_FIELD), die Klinke verlangt ${K.field}: KLINKE_WERKSTATT nur per Commit mit Ursache senken`);
    if (workRun.tris > O.tris) fail(`[12] das Geraet hat ${workRun.tris} Dreiecke, die Obergrenze ist ${O.tris}: zu teuer neben der Halle. OBERGRENZE_WERKSTATT nur per Commit mit Ursache anheben`);
    if (workRun.bytes + workRun.boden > O.bytes) fail(`[12] die Werkstatt wiegt ${((workRun.bytes + workRun.boden) / 1e6).toFixed(2)} MB, die Obergrenze ist ${O.bytes / 1e6} MB`);
    if (workRun.boden > O.boden) fail(`[12] die Bodendatei wiegt ${(workRun.boden / 1048576).toFixed(2)} MiB, die Obergrenze ist ${O.boden / 1048576} MiB: Telefone laden sie`);
    // Feldboden (WORK_PAD): Knoten in der Bodendatei, Kachel in der json, je
    // Hallenstufe genug fahrende Dreiecke ([10]) mit einem genannten Material
    if (pad) {
      const floors = Object.entries(pad.floors ?? {});
      if (!floors.length || !(pad.pick === 'lack' || Object.hasOwn(pad.floors, pad.pick ?? ''))) fail(`[12] WORK_PAD braucht floors { Name: Knoten } und pick, einen der Namen oder "lack" (gewaehlt ist ${pad.pick ?? 'nichts'})`);
      for (const [k, node] of floors) {
        if (!decals.has(node)) { fail(`[12] WORK_PAD.floors.${k} nennt ${node}, ${W.boden.url.split('?')[0]} traegt den Knoten nicht: Mit dieser Wahl bliebe das Feld still Lack. Namen im Viewer nachziehen`); continue; }
        const fl = (info?.floors ?? []).find((e) => e.node === node || e.wearNode === node);
        if (!(fl?.tiling?.[0] > 0)) fail(`[12] ${W.json.split('?')[0]} nennt fuer ${node} keine Kachel (floors[].tiling): Der Viewer naehme 4 m an, der Boden saehe verzogen aus`);
      }
      if (padRe) for (const r of liftRuns) {
        const n = [...r.mats].filter(([m]) => padRe.test(m)).reduce((sum, [, c]) => sum + c, 0);
        workRun.pad.push(`${r.u}: ${n}`);
        if (n < K.pad) fail(`[12] ${r.u}: ${n} Dreiecke des Felds tragen ein Material aus WORK_PAD.mats (${pad.mats}), die Klinke verlangt ${K.pad}: Material umbenannt oder Halle neu gebaut? Das Feld bliebe still Lack. KLINKE_WERKSTATT.pad nur per Commit mit Ursache senken`);
      }
      if (padRe && !liftRuns.length) fail('[12] WORK_PAD, aber kein Schiffsfeld gemessen ([10])');
    }
  }
}
for (const k of Object.keys(KLINKE_WERKSTATT).filter(() => !WM)) fail(`[12] KLINKE_WERKSTATT.${k}: das Manifest nennt keine Werkstatt mehr; den Eintrag hier per Commit mit Ursache entfernen`);
sollIst(W ? `alle Dateien in dist/, jeder Platz und jede Feldspur mit Knoten, Decals flach; mindestens ${KLINKE_WERKSTATT.props} Geraete, ${KLINKE_WERKSTATT.decals} Decal-Arten, ${KLINKE_WERKSTATT.items} Plaetze, ${KLINKE_WERKSTATT.field} Feldspuren, Feld ${pad?.pick === 'lack' ? 'im Lack der Halle, Vergleichsboeden' : `aus Spielboden ${pad?.pick ?? '?'}, alle Boeden`} mit Knoten und Kachel, je Hallenstufe ${KLINKE_WERKSTATT.pad} Felddreiecke darunter (WORK_PAD); hoechstens ${OBERGRENZE_WERKSTATT.tris} Dreiecke, ${OBERGRENZE_WERKSTATT.bytes / 1e6} MB, Bodendatei ${OBERGRENZE_WERKSTATT.boden / 1048576} MiB` : 'keine Werkstatt fuer diese Halle', W ? `${workRun.props} Geraete, ${workRun.decals} Decal-Arten, ${workRun.items} Plaetze, ${workRun.field} Feldspuren, Spielboden ${workRun.pad.join(', ') || 'keiner'}; ${workRun.tris} Dreiecke, ${((workRun.bytes + workRun.boden) / 1e6).toFixed(2)} MB, Bodendatei ${(workRun.boden / 1048576).toFixed(2)} MiB` : '(nichts gemessen)');

say('\n[13] Das Schiffsfeld steht in der Hallenmitte, der Boden daneben ohne Luecke');
// Der Block steht im Viewer zwischen /* hall-shift */ und /* /hall-shift */ und ist JSON
const sfm = /\/\* hall-shift \*\/([\s\S]*?)\/\* \/hall-shift \*\//.exec(viewer);
let shiftAll = null;
try { shiftAll = sfm ? JSON.parse(sfm[1]) : null; } catch (e) { fail(`[13] HALL_SHIFT im Viewer ist kein JSON mehr (${e.message})`); }
if (viewer && !sfm) fail('[13] der Viewer traegt keinen Block /* hall-shift */ … /* /hall-shift */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
shiftAll ??= {};
for (const k of Object.keys(shiftAll).filter((k) => k !== hall?.id)) fail(`[13] HALL_SHIFT["${k}"]: die Seite laedt diese Halle nicht; Eintrag entfernen oder die Halle zurueck`);
const SHIFT = hall?.id ? shiftAll[hall.id] ?? null : null;
const shiftRuns = [];
let shiftCentre = null;
if (SHIFT && !LIFT) fail(`[13] HALL_SHIFT["${hall.id}"] ohne Schiffsfeld in HALL_LIFT: Es gibt nichts zu verschieben`);
if (SHIFT && LIFT) {
  const pair = (q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite);
  const strips = Array.isArray(SHIFT.strips) ? SHIFT.strips : [];
  const okStrips = strips.length && strips.every((s) => Array.isArray(s) && s.length === 3 && s.every(Number.isFinite) && s[0] < s[1]);
  if (!(Number.isFinite(SHIFT.field) && pair(SHIFT.z) && pair(SHIFT.y) && okStrips && Array.isArray(SHIFT.min) && SHIFT.min.length === strips.length && SHIFT.min.every((m) => Number.isInteger(m) && m > 0))) {
    fail(`[13] HALL_SHIFT["${hall.id}"] braucht field (m), z [von, bis], y [unten, oben], strips [[x von, bis, um m], …] und je Streifen eine Klinke in min`);
  } else {
    const E = LIFT_E, [fx0, fz0] = LIFT.from, [fx1, fz1] = LIFT.to, d = SHIFT.field, [sy0, sy1] = SHIFT.y, [sz0, sz1] = SHIFT.z;
    // Mitte: das Feld danach auf der Mittelachse des Raums
    shiftCentre = (fx0 + fx1) / 2 + d;
    const rc = hall.room?.center?.[0];
    if (!Number.isFinite(rc)) fail('[13] die Seite gibt der Halle keinen Raum (room.center) mit: Ohne ihn ist die Mitte nicht pruefbar');
    else if (Math.abs(shiftCentre - rc) > 0.05) fail(`[13] das Feld steht danach bei x ${shiftCentre}, die Raummitte bei x ${rc}: field in HALL_SHIFT nachmessen`);
    if (Math.abs(sz0 - fz0) > E || Math.abs(sz1 - fz1) > E) fail(`[13] HALL_SHIFT.z (${sz0}..${sz1}) ist nicht die Laenge des Felds (${fz0}..${fz1}): Die Streifen saeßen dann gegen das Feld versetzt`);
    // Breite: vorher und nachher dieselbe Strecke, ohne Ueberlappung
    const before = [[fx0, fx1], ...strips.map(([a, b]) => [a, b])], after = [[fx0 + d, fx1 + d], ...strips.map(([a, b, by]) => [a + by, b + by])];
    const union = (iv) => iv.slice().sort((p, q) => p[0] - q[0]).reduce((u, [a, b]) => (u.length && a <= u[u.length - 1][1] + E ? (u[u.length - 1][1] = Math.max(u[u.length - 1][1], b), u) : [...u, [a, b]]), []);
    const sum = (iv) => iv.reduce((s, [a, b]) => s + b - a, 0), ub = union(before), ua = union(after);
    if (ub.length !== ua.length || ub.some(([a, b], i) => Math.abs(a - ua[i][0]) > E || Math.abs(b - ua[i][1]) > E)) fail(`[13] Feld und Streifen decken vorher ${ub.map(([a, b]) => `${a}..${b}`).join(', ')}, nachher ${ua.map(([a, b]) => `${a}..${b}`).join(', ')}: Dort entstuende eine Luecke im Boden oder Boden laege doppelt`);
    if (Math.abs(sum(before) - sum(ub)) > E || Math.abs(sum(after) - sum(ua)) > E) fail('[13] Feld und Streifen ueberlappen sich (vorher oder nachher): Boden laege doppelt');
    const cuts = [...new Set(strips.flatMap(([a, b]) => [a, b]))].sort((p, q) => p - q);
    const stripOf = (lo, hi) => strips.findIndex(([a, b]) => lo >= a - E && hi <= b + E);
    for (const [u, doc] of [...stageDocs, ...extraDocs]) {
      // Hallenstufe: das Feld ist schon geschnitten ([10]); Moebel- und
      // Telefon-Datei kommen erst danach dazu
      const stage = stageDocs.has(u);
      // wie der Viewer (shiftHallFloor): mehrfach gestellte Geometrie und
      // solche ohne Index setzt er nicht um, Moebel wandern ueber ihren Bezugspunkt
      const acc = new Map(), refs = new Map();
      const geo = (p) => [p.getIndices(), p.getAttribute('POSITION')].map((a) => (a ? acc.get(a) ?? acc.set(a, acc.size).get(a) : -1)).join(':');
      for (const node of doc.getRoot().listNodes()) for (const p of node.getMesh()?.listPrimitives() ?? []) refs.set(geo(p), (refs.get(geo(p)) || 0) + 1);
      const moved = strips.map(() => 0);
      let split = 0, edge = 0, stuck = 0, deep = 0, furn = 0;
      const ex = [];
      const inLift = (q) => q.every(([x, y, z]) => x >= fx0 - E && x <= fx1 + E && z >= fz0 - E && z <= fz1 + E && y >= LIFT.y[0] && y <= LIFT.y[1]);
      for (const node of doc.getRoot().listNodes()) {
        let anchor = null;
        for (let a = node; a && !anchor; a = a.getParentNode()) anchor = Array.isArray(a.getExtras()?.anchor) ? a : null;
        if (anchor) {
          const x = anchor.getExtras().anchor;
          if (anchor === node && x[2] >= sz0 && x[2] < sz1 && strips.some(([a, b]) => x[0] >= a && x[0] < b)) furn++;
          continue;
        }
        const mesh = node.getMesh();
        if (!mesh) continue;
        const w = node.getWorldMatrix();
        for (const p of mesh.listPrimitives()) {
          const P = p.getAttribute('POSITION')?.getArray(), I = p.getIndices()?.getArray();
          if (!P) continue;
          const can = !!I && !(refs.get(geo(p)) > 1);
          const at = (i) => {
            const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
            return [w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]];
          };
          const n = I ? I.length : P.length / 3;
          for (let t = 0; t + 2 < n; t += 3) {
            const q = [at(I ? I[t] : t), at(I ? I[t + 1] : t + 1), at(I ? I[t + 2] : t + 2)];
            if (stage && can && inLift(q)) continue;   // faehrt mit dem Feld ([10])
            const xs = q.map((v) => v[0]), lo = Math.min(...xs), hi = Math.max(...xs);
            const ys = q.map((v) => v[1]), zs = q.map((v) => v[2]);
            const inY = Math.min(...ys) >= sy0 && Math.max(...ys) <= sy1, overX = hi > cuts[0] + E && lo < cuts[cuts.length - 1] - E;
            const zIn = Math.min(...zs) >= sz0 - E && Math.max(...zs) <= sz1 + E, zTouch = Math.max(...zs) > sz0 + E && Math.min(...zs) < sz1 - E;
            // Stuecke nach dem Umsetzen: [von, bis] in x, je Teil zwischen zwei Schnitten
            let pieces = [[lo, hi, 0]];
            if (inY && zIn && overX) {
              if (!can) { stuck++; if (ex.length < 2) ex.push(`bleibt stehen: ${p.getMaterial()?.getName()?.split('_mtl_').pop() ?? '?'} x ${lo.toFixed(2)}..${hi.toFixed(2)}`); continue; }
              const s = stripOf(lo, hi);
              if (s >= 0) { moved[s]++; pieces = [[lo + strips[s][2], hi + strips[s][2], 1]]; } else {
                split++;
                const ks = [lo, ...cuts.filter((k) => lo < k - E && hi > k + E), hi];
                pieces = ks.slice(1).map((b, i) => {
                  const a = ks[i], s2 = stripOf(a, b);
                  if (s2 >= 0) moved[s2]++;
                  return s2 >= 0 ? [a + strips[s2][2], b + strips[s2][2], 1] : [a, b, 0];
                });
              }
            } else if (inY && overX && zTouch) {
              // ragt ueber ein Feldende: der Viewer teilt nur in x
              edge++;
              if (ex.length < 2) ex.push(`ueber dem Feldende: ${p.getMaterial()?.getName()?.split('_mtl_').pop() ?? '?'} z ${Math.min(...zs).toFixed(2)}..${Math.max(...zs).toFixed(2)}`);
              continue;
            }
            // danach im Feld: Boden unter dem Feld bliebe ueber dem offenen Schacht
            const zDeep = Math.min(...zs) < fz1 - E && Math.max(...zs) > fz0 + E, yDeep = Math.min(...ys) <= LIFT.y[1] && Math.max(...ys) >= LIFT.y[0];
            if (zDeep && yDeep && pieces.some(([a, b]) => a < fx1 + d - E && b > fx0 + d + E)) {
              deep++;
              if (ex.length < 2) ex.push(`im Feld: ${p.getMaterial()?.getName()?.split('_mtl_').pop() ?? '?'} x ${lo.toFixed(2)}..${hi.toFixed(2)}`);
            }
          }
        }
      }
      shiftRuns.push({ u, moved, split, edge, stuck, deep, furn, stage });
      say(`    ${u}: ${moved.map((m, i) => `Streifen ${strips[i][0]}..${strips[i][1]} um ${strips[i][2]} m ${m}`).join(', ')} Dreiecke, ${split} geteilt; ${edge} ueber den Feldenden, ${stuck} bleiben stehen, ${deep} danach im Feld; ${furn} Moebel wandern mit`);
      if (edge) fail(`[13] ${u}: ${edge} Dreiecke reichen ueber ein Feldende in die Streifen (z. B. ${ex.join('; ')}): Der Viewer teilt nur in x, dort risse der Boden. HALL_SHIFT.z nachmessen oder die Halle pruefen`);
      if (stuck) fail(`[13] ${u}: ${stuck} Dreiecke in den Streifen kann der Viewer nicht umsetzen (mehrfach gestellt oder ohne Index; z. B. ${ex.join('; ')}): Sie blieben stehen, der Boden laege doppelt`);
      if (deep) fail(`[13] ${u}: ${deep} Dreiecke laegen nach dem Umsetzen im Feld (z. B. ${ex.join('; ')}) und blieben ueber dem offenen Schacht stehen: strips in HALL_SHIFT nachmessen`);
      if (stage) moved.forEach((m, i) => { if (m < SHIFT.min[i]) fail(`[13] ${u}: Streifen ${strips[i][0]}..${strips[i][1]} traegt ${m} Dreiecke, die Klinke verlangt ${SHIFT.min[i]}: Liegt der Boden noch an dieser Stelle? HALL_SHIFT nachmessen; min nur per Commit mit Ursache senken`); });
    }
    if (!stageDocs.size) fail('[13] HALL_SHIFT, aber keine Hallenstufe gemessen ([3])');
  }
}
sollIst(SHIFT ? `Feld danach in der Raummitte (x ${hall?.room?.center?.[0]}); vorher und nachher dieselbe Breite ohne Ueberlappung; je Hallenstufe 0 Dreiecke ueber den Feldenden, 0 stehenbleibende, 0 danach im Feld, je Streifen mindestens ${Array.isArray(SHIFT.min) ? SHIFT.min.join(' / ') : '?'}` : 'keine Verschiebung fuer diese Halle', shiftRuns.length ? `Feld bei x ${shiftCentre}; ${shiftRuns.map((r) => `${r.u}: ${r.moved.join(' / ')} umgesetzt, ${r.split} geteilt, ${r.edge} ueber den Enden, ${r.stuck} stehen, ${r.deep} im Feld`).join('; ')}` : '(nichts gemessen)');

say('\n[14] Der Wartungsplatz am Schiff kommt mit, jedes Stueck hat seinen Knoten');
const dm = /\/\* work-dienst \*\/([\s\S]*?)\/\* \/work-dienst \*\//.exec(viewer);
let dienst = null;
try { dienst = dm ? JSON.parse(dm[1]) : null; } catch (e) { fail(`[14] WORK_DIENST im Viewer ist kein JSON mehr (${e.message})`); }
const DI = W?.dienst ?? null;
const dienstRun = { stationen: 0, glieder: 0, leitungen: 0, spuren: 0, props: 0, mats: 0, tris: 0, bytes: 0, quellen: 0, klassen: {}, baender: 0 };
if (W && !DI) fail(`[14] die Seite gibt den Geraetesatz nicht mit (opts.hall.workshop.dienst): Das Schiff stuende ohne Wartungsplatz. ${existsSync(join(ROOT, 'public/hangar/props/dienst.glb')) ? 'HangarApp.astro pruefen' : 'public/hangar/props/dienst.glb fehlt, neu packen: node scripts/build-hangar-dienst.mjs'}`);
if (DI && !dm) fail('[14] die Seite gibt den Geraetesatz mit, der Viewer traegt keinen Block /* work-dienst */ … /* /work-dienst */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
if (DI && dienst) {
  const frac = (v) => Number.isFinite(v) && Math.abs(v) <= 1;
  // Der Block: Stellen, Glieder, Leitungen, Spuren (wie layDienst sie liest)
  const names = new Set(), props = new Set(), decals = new Set();
  const spot = (q) => Array.isArray(q) && ['seite', 'ende'].includes(q[0]) && Math.abs(q[1]) === 1 && frac(q[2]);
  for (const st of dienst.stationen ?? []) {
    if (typeof st.name !== 'string' || names.has(st.name)) fail(`[14] WORK_DIENST: Platz ohne oder mit doppeltem Namen (${st.name})`);
    names.add(st.name);
    for (const q of [st.wo, ...(st.sonst ?? [])]) if (!spot(q)) fail(`[14] WORK_DIENST ${st.name}: Stelle ${JSON.stringify(q)} ist keine ["seite"|"ende", ±1, Bruchteil -1..1]; layDienst liesse den Platz still weg`);
    if (!(st.glieder?.length)) fail(`[14] WORK_DIENST ${st.name}: Platz ohne Glieder`);
    const ab = st.ab ?? 0, bis = st.bis ?? Infinity;
    if (st.frei !== undefined && !(Number.isFinite(st.frei) && st.frei >= 0 && st.frei <= 20)) fail(`[14] WORK_DIENST ${st.name}: frei ${st.frei} ist kein Abstand zum Rumpf in m (0..20)`);
    if (!(Number.isFinite(ab) && ab >= 0 && (bis === Infinity || Number.isFinite(bis)) && ab < bis)) fail(`[14] WORK_DIENST ${st.name}: ab ${st.ab} / bis ${st.bis} ist kein Bereich der Schiffsgroesse in m (0 <= ab < bis); layDienst stellte den Platz an kein Schiff`);
    for (const g of st.glieder ?? []) {
      if (!(typeof g[0] === 'string' && g.slice(1).every(Number.isFinite) && g.length >= 3)) fail(`[14] WORK_DIENST ${st.name}: Glied ${JSON.stringify(g)} braucht [Knoten, x, z, Drehung, Hoehe]`);
      else { props.add(g[0]); dienstRun.glieder++; }
    }
    dienstRun.stationen++;
  }
  for (const l of dienst.leitungen ?? []) {
    if (!(names.has(l.von?.[0]) && l.von.slice(1).every(Number.isFinite) && Array.isArray(l.nach) && l.nach.length === 2 && l.nach.every(frac) && typeof l.node === 'string')) fail(`[14] WORK_DIENST Leitung ${l.name}: braucht node, von [Platz, x, z, Hoehe] mit einem Platz des Blocks und nach [quer, laengs] in -1..1`);
    else { props.add(l.node); dienstRun.leitungen++; }
  }
  for (const sp of dienst.spuren ?? []) {
    const atShip = typeof sp[0] === 'string' && frac(sp[1]) && Math.abs(sp[2]) <= 1.2 && sp[3] > 0 && sp[3] <= 0.5 && Number.isFinite(sp[4] ?? 0);
    const atSpot = typeof sp[0] === 'string' && names.has(sp[1]) && Number.isFinite(sp[2]) && Number.isFinite(sp[3]) && sp[4] > 0 && sp[4] <= 4 && Number.isFinite(sp[5] ?? 0);
    if (!atShip && !atSpot) fail(`[14] WORK_DIENST Spur ${JSON.stringify(sp)}: braucht [Knoten, quer (-1..1), laengs (bis ±1,2), Kante (Bruchteil der Breite, bis 0,5), Drehung] oder [Knoten, Platz des Blocks, x, z, Kante (m, bis 4), Drehung]`);
    else { decals.add(sp[0]); dienstRun.spuren++; }
  }
  dienstRun.props = props.size;
  const file = fromUrl(DI.url);
  if (!existsSync(file)) fail(`[14] ${DI.url.split('?')[0]} fehlt in dist/`);
  else {
    const j = glbJson(file);
    dienstRun.bytes = readFileSync(file).length;
    let kat = null;
    try { kat = JSON.parse(readFileSync(join(DIST, 'hangar/props/katalog.json'), 'utf8')); } catch (e) { fail(`[14] dist/hangar/props/katalog.json ist nicht lesbar (${e.message})`); }
    // Fingerabdruck: zum Block des ausgelieferten Viewers und zu den Quellen in dist/,
    // Text auf LF wie beim Erzeuger (lib/eol-sha.mjs; CRLF-Arbeitskopie unter Windows)
    const st = j?.asset?.extras?.dienst;
    const stale = [];
    if (!st?.block || st.block !== sha8(dm[1].trim())) stale.push(`Block (Satz ${st?.block ?? 'ohne'}, Viewer ${sha8(dm[1].trim())})`);
    // Quellen, die der Block verlangt: Katalog, die Kategoriedatei jeder Requisite, der Decal-Satz fuer die Spuren
    const want = new Set(['public/hangar/props/katalog.json']);
    for (const q of kat?.props ?? []) if (props.has(q.node) && q.file) want.add(`public${q.file.split('?')[0]}`);
    if (decals.size && W?.boden?.url) want.add(`public${W.boden.url.split('?')[0]}`);
    for (const rel of want) if (!(rel in (st?.quellen ?? {}))) stale.push(`${rel} fehlt im Fingerabdruck`);
    for (const [rel, h] of Object.entries(st?.quellen ?? {})) {
      const f = join(DIST, rel.replace(/^public\//, ''));
      dienstRun.quellen++;
      if (!existsSync(f)) stale.push(`${rel} fehlt in dist/`);
      else if (sha8(readFileSync(f)) !== h) stale.push(rel);
    }
    if (!dienstRun.quellen) stale.push('keine Quellen im Fingerabdruck');
    if (stale.length) fail(`[14] ${DI.url.split('?')[0]} passt nicht mehr: ${stale.join(', ')}. Neu packen: node scripts/build-hangar-dienst.mjs`);
    // Knoten oben im Satz, Requisiten im Katalog
    const top = new Map((j?.scenes?.[j.scene ?? 0]?.nodes ?? []).map((i) => [j.nodes[i].name, j.nodes[i]]));
    const lost = [...props, ...decals].filter((n) => !top.has(n));
    if (lost.length) fail(`[14] der Geraetesatz traegt ${lost.length} Knoten nicht, die WORK_DIENST nennt (${lost.slice(0, 3).join(', ')}): Das Stueck fehlte still am Schiff`);
    // buildDienst nimmt nur Knoten mit Geometrie; ein leerer Knoten fehlte ebenso still
    const empty = [...props, ...decals].filter((n) => top.has(n) && !(j.meshes?.[top.get(n).mesh]?.primitives?.length));
    if (empty.length) fail(`[14] ${empty.length} Knoten des Geraetesatzes ohne Geometrie (${empty.slice(0, 3).join(', ')}): Das Stueck fehlte still am Schiff. Neu packen: node scripts/build-hangar-dienst.mjs`);
    const inKat = new Set((kat?.props ?? []).map((q) => q.node));
    const noKat = [...props].filter((n) => !inKat.has(n));
    if (kat && noKat.length) fail(`[14] ${noKat.length} Requisiten des Wartungsplatzes stehen nicht im Katalog (${noKat.slice(0, 3).join(', ')}): Ihre Bedeutung (wofuer, wo im Spiel) ist nicht belegt`);
    // je Material ein Attributsatz mit Index (ein BatchedMesh je Material)
    const sigs = sigsByMat(j);
    dienstRun.mats = sigs.size;
    for (const [m, set] of sigs) {
      if (set.size !== 1) fail(`[14] ${m} kommt im Geraetesatz mit ${set.size} verschiedenen Attributsaetzen (${[...set].join(' | ')}): Der Viewer legt je Material ein BatchedMesh an und braeche den Wartungsplatz ab`);
      const sig = [...set][0] ?? '';
      if (m === 'dienst_flach' ? !(/_TINT:VEC3/.test(sig) && /_RM:VEC2/.test(sig)) : !/TEXCOORD_0:VEC2/.test(sig)) fail(`[14] ${m}: Attributsatz ${sig} — dienst_flach braucht _TINT und _RM, die uebrigen TEXCOORD_0`);
    }
    const unindexed = (j?.meshes ?? []).flatMap((me) => me.primitives).filter((pr) => pr.indices == null).length;
    if (unindexed) fail(`[14] ${unindexed} Teile des Geraetesatzes ohne Index: Ein BatchedMesh braucht sie alle mit oder alle ohne`);
    // Dreiecke je Knoten (wie oft er steht) und Lage der Leitungen
    const extent = (nd) => {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      let tris = 0;
      for (const pr of j.meshes?.[nd.mesh]?.primitives ?? []) {
        const pos = j.accessors?.[pr.attributes?.POSITION];
        tris += (pr.indices != null ? j.accessors[pr.indices].count : pos?.count ?? 0) / 3;
        for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos?.min?.[a] ?? Infinity); hi[a] = Math.max(hi[a], pos?.max?.[a] ?? -Infinity); }
      }
      return { tris, size: hi.map((v, a) => v - lo[a]) };
    };
    for (const [n, nd] of top) dienstRun.tris += extent(nd).tris;
    for (const l of dienst.leitungen ?? []) {
      const nd = top.get(l.node);
      if (!nd) continue;
      const [x, y, z] = extent(nd).size;
      if (!(z > 5 * Math.max(x, y))) fail(`[14] Leitung ${l.name}: ${l.node} liegt nicht laengs z (${x.toFixed(2)} × ${y.toFixed(2)} × ${z.toFixed(2)} m); layDienst biegt sie laengs z und legte sie quer`);
    }
    // Je Schiffsgroesse (ab/bis): welche Plaetze stehen, wie viele Dreiecke
    // zeichnet der Platz (jedes Glied, jede Leitung, jede Spur einmal) und
    // wie viele Materialien braucht er, also Zeichenbefehle je Durchgang
    // (layDienst schaltet ein BatchedMesh ohne sichtbares Stueck ab)
    const matsOf = (n) => new Set((j.meshes?.[top.get(n)?.mesh]?.primitives ?? []).map((pr) => j.materials?.[pr.material]?.name));
    // Jedes Band zwischen zwei Grenzen (ab/bis) braucht eine Größe in
    // DIENST_KLASSEN, sonst prüft das Tor die Schiffe darin nicht
    const edges = [...new Set([0, ...(dienst.stationen ?? []).flatMap((s) => [s.ab, s.bis]).filter((v) => typeof v === 'number'), Infinity])].sort((a, b) => a - b);
    dienstRun.baender = edges.length - 1;
    for (let i = 0; i + 1 < edges.length; i++) {
      const lo = edges[i], hi = edges[i + 1];
      if (!Object.values(DIENST_KLASSEN).some((m) => m >= lo && m < hi)) fail(`[14] Schiffe von ${lo} bis ${hi} m: keine Groesse in DIENST_KLASSEN liegt darin, Plaetze und Kosten dieses Bands prueft das Tor nicht. Eine Groesse (Schiff, groesste Ausdehnung in m) mit Klinke und Obergrenze ergaenzen`);
    }
    for (const [kl, span] of Object.entries(DIENST_KLASSEN)) {
      const on = (dienst.stationen ?? []).filter((s) => span >= (s.ab ?? 0) && span < (s.bis ?? Infinity));
      const names = new Set(on.map((s) => s.name)), uses = [];
      for (const s of on) for (const g of s.glieder ?? []) uses.push(g[0]);
      for (const l of dienst.leitungen ?? []) if (names.has(l.von?.[0])) uses.push(l.node);
      for (const sp of dienst.spuren ?? []) if (typeof sp[1] !== 'string' || names.has(sp[1])) uses.push(sp[0]);
      const mats = new Set();
      let tris = 0;
      for (const n of uses) { if (!top.has(n)) continue; tris += extent(top.get(n)).tris; for (const m of matsOf(n)) mats.add(m); }
      const r = { stationen: on.length, mats: mats.size, tris: Math.round(tris) };
      dienstRun.klassen[kl] = r;
      const KK = KLINKE_DIENST_KLASSE[kl], OK = OBERGRENZE_DIENST_KLASSE[kl];
      if (r.stationen < KK.stationen) fail(`[14] an einem Schiff von ${span} m (${kl}) stehen ${r.stationen} Plaetze, die Klinke verlangt ${KK.stationen}: ab/bis in WORK_DIENST pruefen; KLINKE_DIENST_KLASSE nur per Commit mit Ursache senken`);
      if (r.mats > OK.mats) fail(`[14] an einem Schiff von ${span} m (${kl}) braucht der Wartungsplatz ${r.mats} Materialien, die Obergrenze ist ${OK.mats}: je Material ein Zeichenbefehl in jedem Durchgang. Geraet mit eigenen Materialien nur an groessere Schiffe (ab) oder flach zusammenlegen; OBERGRENZE_DIENST_KLASSE nur per Commit mit Ursache anheben`);
      if (r.tris > OK.tris) fail(`[14] an einem Schiff von ${span} m (${kl}) zeichnet der Wartungsplatz ${r.tris} Dreiecke, die Obergrenze ist ${OK.tris}: OBERGRENZE_DIENST_KLASSE nur per Commit mit Ursache anheben`);
    }
    const K = KLINKE_DIENST, O = OBERGRENZE_DIENST;
    for (const k of Object.keys(K)) if (dienstRun[k] < K[k]) fail(`[14] der Wartungsplatz hat ${dienstRun[k]} ${k}, die Klinke verlangt ${K[k]}: KLINKE_DIENST nur per Commit mit Ursache senken`);
    if (dienstRun.mats > O.mats) fail(`[14] der Geraetesatz traegt ${dienstRun.mats} Materialien, die Obergrenze ist ${O.mats}: je Material ein Zeichenbefehl in jedem Durchgang. Flache Teile zusammenlegen (scripts/build-hangar-dienst.mjs); OBERGRENZE_DIENST nur per Commit mit Ursache anheben`);
    if (dienstRun.tris > O.tris) fail(`[14] der Geraetesatz hat ${dienstRun.tris} Dreiecke, die Obergrenze ist ${O.tris}: OBERGRENZE_DIENST nur per Commit mit Ursache anheben`);
    if (dienstRun.bytes > O.bytes) fail(`[14] der Geraetesatz wiegt ${(dienstRun.bytes / 1e6).toFixed(2)} MB, die Obergrenze ist ${O.bytes / 1e6} MB`);
  }
}
sollIst(DI ? `Satz in dist/, passend zu Block und ${dienstRun.quellen || '?'} Quellen; jeder Knoten im Satz, jede Requisite im Katalog; je Material ein Attributsatz mit Index; Leitungen laengs z; mindestens ${KLINKE_DIENST.stationen} Plaetze, ${KLINKE_DIENST.glieder} Glieder, ${KLINKE_DIENST.leitungen} Leitungen, ${KLINKE_DIENST.spuren} Spuren, ${KLINKE_DIENST.props} Requisiten; hoechstens ${OBERGRENZE_DIENST.mats} Materialien, ${OBERGRENZE_DIENST.tris} Dreiecke, ${OBERGRENZE_DIENST.bytes / 1e6} MB; jedes Band zwischen zwei Grenzen ab/bis mit einer Groesse; je Schiffsgroesse ${Object.entries(DIENST_KLASSEN).map(([k, m]) => `${m} m: mindestens ${KLINKE_DIENST_KLASSE[k].stationen} Plaetze, hoechstens ${OBERGRENZE_DIENST_KLASSE[k].mats} Materialien und ${OBERGRENZE_DIENST_KLASSE[k].tris} Dreiecke`).join('; ')}` : 'kein Wartungsplatz fuer diese Halle', DI ? `${dienstRun.stationen} Plaetze, ${dienstRun.glieder} Glieder, ${dienstRun.leitungen} Leitungen, ${dienstRun.spuren} Spuren, ${dienstRun.props} Requisiten; ${dienstRun.mats} Materialien, ${Math.round(dienstRun.tris)} Dreiecke, ${(dienstRun.bytes / 1e6).toFixed(2)} MB; ${dienstRun.baender} Groessenbaender, je Schiffsgroesse ${Object.entries(DIENST_KLASSEN).map(([k, m]) => { const r = dienstRun.klassen[k]; return r ? `${m} m: ${r.stationen} Plaetze, ${r.mats} Materialien, ${r.tris} Dreiecke` : `${m} m: nicht gemessen`; }).join('; ')}` : '(nichts gemessen)');

say('\n[15] Das Schachttor schliesst die Oeffnung beim Wechsel, ohne Spalt, und liegt offen ganz draussen');
// Der Block steht im Viewer zwischen /* hall-gate */ und /* /hall-gate */ und ist JSON
const gm = /\/\* hall-gate \*\/([\s\S]*?)\/\* \/hall-gate \*\//.exec(viewer);
let GATE = null;
try { GATE = gm ? JSON.parse(gm[1]) : null; } catch (e) { fail(`[15] HALL_GATE im Viewer ist kein JSON mehr (${e.message})`); }
const gateEntry = SHAFT?.kit ? manifest?.lift?.[SHAFT.kit]?.gate ?? null : null;
const GT = hall?.lift?.gate ?? null;
const gateRun = { teile: 0, ohne: [], zellen: 0, offen: 0, tris: 0, mats: 0, bytes: 0, bahnen: 0, zwillinge: 0, lacke: 0 };
// Baut der Viewer ein Tor (Block hall-gate) und laedt die Seite den Schacht,
// gehoert eins dazu: Fiele es aus Manifest und Seite, liefe [15] sonst leer.
const gateWant = !!(gateEntry || GT || (gm && SHAFT?.kit && hall?.lift));
if (gateWant) {
  if (!gateEntry) fail(`[15] der Viewer baut ein Schachttor (HALL_GATE) und die Seite laedt den Schacht ${SHAFT?.kit ?? '?'}, das Manifest nennt aber keins (lift.${SHAFT?.kit ?? '?'}.gate): Beim Wechsel bliebe der Schacht offen, und das Schiff ploppte sichtbar. scripts/build-hangar-assets.mjs (Schachttor) pruefen`);
  if (viewer && !gm) fail('[15] der Viewer traegt keinen Block /* hall-gate */ … /* /hall-gate */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
  if (GATE && !(GATE.reach >= 0 && GATE.reach < 1 && GATE.ms >= 600 && GATE.ms <= 6000 && GATE.clear >= 0 && GATE.lead >= 0 && GATE.lead <= 1000)) fail(`[15] HALL_GATE ${JSON.stringify(GATE)}: reach 0..1 m, ms 600..6000, clear >= 0, lead 0..1000 ms erwartet`);
  if (!GT?.url || !GT?.json) fail(`[15] ${gateEntry ? `das Manifest nennt ein Schachttor (lift.${SHAFT?.kit}.gate), ` : ''}die Seite gibt keins mit (opts.hall.lift.gate { url, json }): Beim Wechsel bliebe der Schacht offen, und das Schiff ploppte sichtbar. HangarApp.astro pruefen`);
  else if (!existsSync(fromUrl(GT.url)) || !existsSync(fromUrl(GT.json))) fail(`[15] das Schachttor ${GT.url.split('?')[0]} oder seine Bahnen ${GT.json.split('?')[0]} liegen nicht in dist/`);
  else if (gateEntry && GT.url.split('?')[0] !== gateEntry.url) fail(`[15] die Seite laedt das Schachttor ${GT.url.split('?')[0]}, das Manifest nennt ${gateEntry.url}`);
  else if (GATE && LIFT && hall?.lift?.json) {
    let gi = null, si = null;
    try { gi = JSON.parse(readFileSync(fromUrl(GT.json), 'utf8')); } catch (e) { fail(`[15] ${GT.json.split('?')[0]} ist kein JSON (${e.message})`); }
    try { si = JSON.parse(readFileSync(fromUrl(hall.lift.json), 'utf8')); } catch { si = null; }
    gateRun.bytes = readFileSync(fromUrl(GT.url)).length;
    const doc = await decode(fromUrl(GT.url));
    // je Knoten: Ausdehnung im Knoten (der Viewer setzt den Knoten auf seine Bahn), Dreiecke, Materialien
    const nodes = new Map();
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], prims = [];
      let tris = 0;
      for (const p of mesh.listPrimitives()) {
        const P = p.getAttribute('POSITION')?.getArray();
        if (!P) continue;
        tris += (p.getIndices()?.getCount() ?? P.length / 3) / 3;
        for (let i = 0; i + 2 < P.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P[i + a]); hi[a] = Math.max(hi[a], P[i + a]); }
        prims.push(p);
      }
      nodes.set(node.getName(), { lo, hi, tris, prims });
    }
    // Feld aus HALL_LIFT, Oeffnung des Spiels aus der Lampenliste des Schachts (wie buildGate)
    const hx = (LIFT.to[0] - LIFT.from[0]) / 2, hz = (LIFT.to[1] - LIFT.from[1]) / 2;
    const sz = (2 * hz) / (si?.shaft?.inner?.[1] ?? 88), T = Math.max(gi?.anim?.close?.s ?? 0, gi?.anim?.open?.s ?? 0);
    if (!(T > 0)) fail(`[15] ${GT.json.split('?')[0]}: anim.close.s / anim.open.s fehlen; der Viewer baute das Tor nicht`);
    const into = (lo, hi, p) => Math.min(Math.min(p[0] + hi[0], hx) - Math.max(p[0] + lo[0], -hx), Math.min((p[2] + hi[2]) * sz, hz) - Math.max((p[2] + lo[2]) * sz, -hz));
    const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 0.01);
    const used = [];
    for (const p of gi?.parts ?? []) {
      const n = nodes.get(p.node), K = p.keys;
      const okKeys = (ks, s) => Array.isArray(ks) && ks.length > 1 && ks.every((k, i) => Array.isArray(k) && k.length === 4 && k.every(Number.isFinite) && (i === 0 || k[0] > ks[i - 1][0])) && Math.abs(ks[0][0]) < 0.01 && Math.abs(ks.at(-1)[0] - s) < 0.01;
      if (!n || !n.tris) { fail(`[15] ${GT.json.split('?')[0]} nennt ${p.node}, das Tor hat dafuer keinen Knoten mit Dreiecken`); continue; }
      if (!okKeys(K?.close, gi.anim?.close?.s) || !okKeys(K?.open, gi.anim?.open?.s)) { fail(`[15] ${p.node}: keys.close/keys.open brauchen [t, x, y, z] mit steigender Zeit von 0 bis anim.*.s`); continue; }
      gateRun.bahnen++;
      // Bahnen schliessen aneinander an: zu endet, wo auf beginnt, und umgekehrt (sonst springt das Teil)
      const cl = p.closed?.pos, op = p.open?.pos;
      if (!cl || !op || !near(K.close.at(-1).slice(1), cl) || !near(K.open[0].slice(1), cl) || !near(K.open.at(-1).slice(1), op) || !near(K.close[0].slice(1), op)) fail(`[15] ${p.node}: die Bahnen treffen closed/open nicht (zu endet ${K.close.at(-1).slice(1).join(', ')}, auf beginnt ${K.open[0].slice(1).join(', ')}; closed ${cl?.join(', ')}, open ${op?.join(', ')}): Das Teil spraenge beim Richtungswechsel`);
      // dieselbe Auswahl wie buildGate
      const reach = Math.max(...[...K.close, ...K.open].map((k) => into(n.lo, n.hi, [k[1], k[2], k[3]])));
      if (reach < GATE.reach) { gateRun.ohne.push(`${p.node} nie im Feld`); continue; }
      if (into(n.lo, n.hi, K.open.at(-1).slice(1)) >= 0) { gateRun.ohne.push(`${p.node} offen im Feld`); continue; }
      used.push({ p, n });
    }
    gateRun.teile = used.length;
    // Geschlossen: jede Zelle des Felds (CELL m) unter einem Teil, das bis
    // an den Boden reicht (Oberkante ueber -0,5 m); sonst saehe man durch den
    // Spalt den Tausch. Rahmen der Teile, Loecher in einem Teil sieht das nicht.
    const CELL = 0.25, nx = Math.round((2 * hx) / CELL), nz = Math.round((2 * hz) / CELL), cov = new Uint8Array(nx * nz);
    for (const { p, n } of used) {
      const c = p.keys.close.at(-1);
      if (c[2] + n.hi[1] < -0.5) continue;
      const x0 = c[1] + n.lo[0], x1 = c[1] + n.hi[0], z0 = (c[3] + n.lo[2]) * sz, z1 = (c[3] + n.hi[2]) * sz;
      for (let j = 0; j < nz; j++) {
        const z = -hz + (j + 0.5) * CELL;
        if (z < z0 || z > z1) continue;
        for (let i = 0; i < nx; i++) { const x = -hx + (i + 0.5) * CELL; if (x >= x0 && x <= x1) cov[j * nx + i] = 1; }
      }
    }
    gateRun.zellen = nx * nz;
    gateRun.offen = cov.length - cov.reduce((a, v) => a + v, 0);
    if (gateRun.offen) fail(`[15] geschlossen deckt das Tor ${gateRun.offen} von ${gateRun.zellen} Zellen (${CELL} m) des Felds nicht: Durch den Spalt saehe man den Tausch. Auswahl (HALL_GATE.reach) oder Streckung laengs pruefen`);
    // Kosten: Dreiecke, Bytes, Materialien nach dem Zusammenlegen (gleiche Karten = eins, wie buildGate)
    // Palettenlacke wie im Viewer (GATE_PALETTE): Farbe der Palette am Tor;
    // ein farbiger Lack bleibt fuer sich (hgShade ist ein Wert)
    const PAL = gi?.palette, PAL_E = ['', 'primary', 'secondary', 'tertiary'];
    const colOf = (m) => PAL?.entries?.[PAL_E[PAL.layers?.[m.getName().split('_mtl_').pop()] ?? 0]]?.linear ?? m.getBaseColorFactor().slice(0, 3);
    const hue = (m) => { const c = colOf(m), hi = Math.max(...c); return hi > 0 && (hi - Math.min(...c)) / hi > 0.3 ? `|${c.join(',')}` : ''; };
    const texKey = (m) => [m?.getBaseColorTexture(), m?.getNormalTexture(), m?.getMetallicRoughnessTexture(), m?.getEmissiveTexture()].map((t) => (t ? doc.getRoot().listTextures().indexOf(t) : '-')).join('|') + `|${m?.getAlphaMode()}|${m?.getDoubleSided()}|${m?.getMetallicFactor()}|${m?.getRoughnessFactor()}${m ? hue(m) : ''}`;
    const groups = new Set();
    for (const { n } of used) { gateRun.tris += n.tris; for (const pr of n.prims) groups.add(texKey(pr.getMaterial())); }
    gateRun.mats = groups.size;
    // Palettenlacke (paint_b_*): Das Spiel faerbt sie mit der Palette am
    // Tor. Ohne Eintrag truege das Tor die fast schwarze Behaelterpalette
    // des Exports (bis 19.10.2026 mit GATE_PAINT zu stumpfem Grau gehoben).
    for (const m of new Set(used.flatMap(({ n }) => n.prims.map((pr) => pr.getMaterial())).filter(Boolean))) {
      const nm = m.getName().split('_mtl_').pop();
      if (!/^paint_b_/.test(nm)) continue;
      const e = PAL?.entries?.[PAL_E[PAL?.layers?.[nm] ?? 0]];
      if (!(Array.isArray(e?.linear) && e.linear.length === 3 && e.linear.every((v) => Number.isFinite(v) && v >= 0 && v <= 1))) fail(`[15] ${nm} ist ein Palettenlack, ${GT.json.split('?')[0]} traegt dafuer keine Farbe (palette.layers / palette.entries.*.linear): Das Tor laege fast schwarz. scripts/build-hangar-assets.mjs (buildTor, Palette) pruefen`);
      else gateRun.lacke++;
    }
    // Gleichnamige Materialien im Schacht: Der Viewer nimmt deren Karten, also
    // muessen es dieselben Bilder sein (sonst truege das Tor fremde Texturen)
    const shaftDoc = await decode(fromUrl(hall.lift.url));
    const maps = (m) => [['Farbe', m.getBaseColorTexture()], ['Normale', m.getNormalTexture()], ['Rauheit', m.getMetallicRoughnessTexture()]];
    const twinOf = new Map(shaftDoc.getRoot().listMaterials().map((m) => [m.getName(), m]));
    const usedMats = new Set(used.flatMap(({ n }) => n.prims.map((pr) => pr.getMaterial())).filter(Boolean));
    for (const m of usedMats) {
      const tw = twinOf.get(m.getName());
      if (!tw) continue;
      gateRun.zwillinge++;
      const twMaps = new Map(maps(tw));
      for (const [k, t] of maps(m)) {
        const u = twMaps.get(k);
        if (!t || !u) continue;
        if (sha1Bytes(t.getImage()) !== sha1Bytes(u.getImage())) fail(`[15] ${m.getName()}: die Karte ${k} des Tors ist ein anderes Bild als die des gleichnamigen Schachtmaterials; der Viewer naehme die des Schachts. Export pruefen oder das Material umbenennen`);
      }
    }
    const O = OBERGRENZE_TOR;
    if (gateRun.teile < KLINKE_TOR.teile) fail(`[15] nur ${gateRun.teile} Teile des Tors reichen ins Feld (ohne: ${gateRun.ohne.join(', ')}), die Klinke verlangt ${KLINKE_TOR.teile}: Teile beim Export verloren oder HALL_GATE.reach zu streng? KLINKE_TOR nur per Commit mit Ursache senken`);
    if (gateRun.lacke < KLINKE_TOR.lacke) fail(`[15] nur ${gateRun.lacke} Palettenlacke am Tor tragen die Farbe des Spiels, die Klinke verlangt ${KLINKE_TOR.lacke}: KLINKE_TOR nur per Commit mit Ursache senken`);
    if (gateRun.tris > O.tris) fail(`[15] das Tor zeichnet ${gateRun.tris} Dreiecke, die Obergrenze ist ${O.tris}: zu teuer fuer einen Schiffswechsel (halbes Schachtbudget). Kleinere LOD exportieren; OBERGRENZE_TOR nur per Commit mit Ursache anheben`);
    if (gateRun.mats > O.mats) fail(`[15] das Tor braucht ${gateRun.mats} Materialien (Zeichenbefehle je Durchgang), die Obergrenze ist ${O.mats}: OBERGRENZE_TOR nur per Commit mit Ursache anheben`);
    if (gateRun.bytes > O.bytes) fail(`[15] das Tor wiegt ${(gateRun.bytes / 1e6).toFixed(2)} MB, die Obergrenze ist ${O.bytes / 1e6} MB`);
  }
}
sollIst(gateWant ? `Tor in dist/ wie im Manifest; jede Bahn von 0 bis zur Dauer, an closed/open anschliessend; mindestens ${KLINKE_TOR.teile} Teile im Feld und offen draussen; geschlossen 0 offene Zellen; mindestens ${KLINKE_TOR.lacke} Palettenlacke in der Farbe des Spiels; Materialien wie im Schacht mit denselben Karten; hoechstens ${OBERGRENZE_TOR.tris} Dreiecke, ${OBERGRENZE_TOR.mats} Materialien, ${OBERGRENZE_TOR.bytes / 1e6} MB` : 'kein Schachttor fuer diese Halle', gateWant ? `${gateRun.bahnen} Bahnen, ${gateRun.teile} Teile im Feld (ohne: ${gateRun.ohne.join(', ') || 'keins'}); geschlossen ${gateRun.offen} von ${gateRun.zellen} Zellen offen; ${gateRun.lacke} Palettenlacke; ${gateRun.zwillinge} Materialien mit Schachtkarten verglichen; ${gateRun.tris} Dreiecke, ${gateRun.mats} Materialien, ${(gateRun.bytes / 1e6).toFixed(2)} MB` : '(nichts gemessen)');

say('\n[16] Der feste Rand liegt rund um das Feld, ohne Luecke, buendig mit dem Boden');
// Block /* hall-rand */ … /* /hall-rand */ im Viewer (JSON), wie buildRand
const rm = /\/\* hall-rand \*\/([\s\S]*?)\/\* \/hall-rand \*\//.exec(viewer);
let RAND = null;
try { RAND = rm ? JSON.parse(rm[1]) : null; } catch (e) { fail(`[16] HALL_RAND im Viewer ist kein JSON mehr (${e.message})`); }
const randEntry = SHAFT?.kit ? manifest?.lift?.[SHAFT.kit]?.rand ?? null : null;
const RT = hall?.lift?.rand ?? null;
const randRun = { teile: 0, tris: 0, mats: 0, bytes: 0, seiten: 0, stege: 0, zwillinge: 0 };
// Liegt der Rand bereit (Manifest) oder baut der Viewer einen, gehoert er
// auf die Seite: Fiele er weg, laege das Feld ohne Rahmen, und der
// Hallenboden fehlte dort nicht mehr (hgCut liefe leer) — oder umgekehrt.
const randWant = !!(randEntry || RT || (rm && SHAFT?.kit && hall?.lift));
if (randWant) {
  if (!randEntry) fail(`[16] der Viewer baut einen Rand (HALL_RAND) und die Seite laedt den Schacht ${SHAFT?.kit ?? '?'}, das Manifest nennt aber keinen (lift.${SHAFT?.kit ?? '?'}.rand): scripts/build-hangar-assets.mjs (buildRand) pruefen`);
  if (viewer && !rm) fail('[16] der Viewer traegt keinen Block /* hall-rand */ … /* /hall-rand */ mehr — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
  if (!RT?.url || !RT?.json) fail(`[16] ${randEntry ? `das Manifest nennt einen Rand (lift.${SHAFT?.kit}.rand), ` : ''}die Seite gibt keinen mit (opts.hall.lift.rand { url, json }): Das Feld laege ohne Rahmen. HangarApp.astro pruefen`);
  else if (!existsSync(fromUrl(RT.url)) || !existsSync(fromUrl(RT.json))) fail(`[16] der Rand ${RT.url.split('?')[0]} oder ${RT.json.split('?')[0]} liegt nicht in dist/`);
  else if (randEntry && RT.url.split('?')[0] !== randEntry.url) fail(`[16] die Seite laedt den Rand ${RT.url.split('?')[0]}, das Manifest nennt ${randEntry.url}`);
  else if (RAND && LIFT && hall?.lift?.json) {
    let si = null;
    try { si = JSON.parse(readFileSync(fromUrl(hall.lift.json), 'utf8')); } catch { si = null; }
    randRun.bytes = readFileSync(fromUrl(RT.url)).length;
    const doc = await decode(fromUrl(RT.url));
    // je Knoten: Ausdehnung im Schachtraum des Spiels (Knoten mit Lage), Dreiecke, Materialien
    const nodes = new Map();
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const w = node.getWorldMatrix(), pts = [];
      let tris = 0;
      const mats = new Set();
      for (const pr of mesh.listPrimitives()) {
        const P = pr.getAttribute('POSITION')?.getArray();
        if (!P) continue;
        tris += (pr.getIndices()?.getCount() ?? P.length / 3) / 3;
        if (pr.getMaterial()) mats.add(pr.getMaterial());
        for (let i = 0; i + 2 < P.length; i += 3) {
          const x = P[i], y = P[i + 1], z = P[i + 2];
          pts.push([w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]]);
        }
      }
      if (pts.length) nodes.set(node.getName(), { pts, tris, mats });
    }
    // Seiten wie shaftSides im Viewer: Anfang o, entlang t, nach aussen n
    const sidesOf = (hx, hz) => [
      { o: [hx, -hz], t: [0, 1], n: [1, 0], len: 2 * hz, kind: 'long' },
      { o: [-hx, hz], t: [0, -1], n: [-1, 0], len: 2 * hz, kind: 'long' },
      { o: [hx, hz], t: [-1, 0], n: [0, 1], len: 2 * hx, kind: 'cross' },
      { o: [-hx, -hz], t: [1, 0], n: [0, -1], len: 2 * hx, kind: 'cross' },
    ];
    const gx = (si?.shaft?.inner?.[0] ?? 56) / 2, gz = (si?.shaft?.inner?.[1] ?? 88) / 2, hx = (LIFT.to[0] - LIFT.from[0]) / 2, hz = (LIFT.to[1] - LIFT.from[1]) / 2;
    const game = sidesOf(gx, gz), ours = sidesOf(hx, hz), W = RAND.width;
    // Exemplar im Bezugssystem seiner Seite des Spiels (randSideOf): a entlang, w nach aussen
    const local = new Map();
    const loc = (name) => {
      if (local.has(name)) return local.get(name);
      const n = nodes.get(name);
      if (!n) { local.set(name, null); return null; }
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const p of n.pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
      let s = game[0], bd = Infinity;
      for (const g of game) {
        const a = (c[0] - g.o[0]) * g.t[0] + (c[2] - g.o[1]) * g.t[1], ww = (c[0] - g.o[0]) * g.n[0] + (c[2] - g.o[1]) * g.n[1];
        const d = (ww < -0.5 ? 100 : 0) + Math.max(0, -4 - a) + Math.max(0, a - g.len);
        if (d < bd) { bd = d; s = g; }
      }
      const r = { a0: Infinity, a1: -Infinity, w0: Infinity, w1: -Infinity, y0: lo[1], y1: hi[1], side: s, tris: n.tris, mats: n.mats };
      for (const p of n.pts) {
        const x = p[0] - s.o[0], z = p[2] - s.o[1], a = x * s.t[0] + z * s.t[1], ww = x * s.n[0] + z * s.n[1];
        r.a0 = Math.min(r.a0, a); r.a1 = Math.max(r.a1, a); r.w0 = Math.min(r.w0, ww); r.w1 = Math.max(r.w1, ww);
      }
      local.set(name, r);
      return r;
    };
    // Materialien nach dem Zusammenlegen (gleiche Karten = eins, wie matKey im Viewer)
    const texKey = (m) => { const c = m.getBaseColorFactor().slice(0, 3), hi = Math.max(...c); return [m.getBaseColorTexture(), m.getNormalTexture(), m.getMetallicRoughnessTexture(), m.getEmissiveTexture()].map((t) => (t ? doc.getRoot().listTextures().indexOf(t) : '-')).join('|') + `|${m.getAlphaMode()}|${m.getDoubleSided()}|${m.getMetallicFactor()}|${m.getRoughnessFactor()}` + (hi > 0 && (hi - Math.min(...c)) / hi > 0.3 ? `|${c.join(',')}` : ''); };
    const E = 0.05, mats = new Set(), usedMats = new Set();
    const need = (name, where) => { const L = loc(name); if (!L) fail(`[16] HALL_RAND ${where} nennt ${name}, der Rand hat dafuer keinen Knoten mit Dreiecken: buildRand braeche ab, das Feld laege ohne Rahmen`); return L; };
    const count = (L) => { randRun.teile++; randRun.tris += L.tris; for (const m of L.mats) { mats.add(texKey(m)); usedMats.add(m); } };
    const pairs = (v) => Array.isArray(v) && v.every((q) => Array.isArray(q) && q.length === 2 && typeof q[0] === 'string' && Number.isFinite(q[1]));
    if (!(W > 0 && W <= 8 && Array.isArray(RAND.corner) && pairs(RAND.long) && pairs(RAND.cross) && pairs(RAND.lights?.long) && pairs(RAND.lights?.cross) && pairs(RAND.once ?? []))) fail(`[16] HALL_RAND braucht width (m), corner [Knoten], long/cross/lights.long/lights.cross/once als [Knoten, a]`);
    else {
      for (const s of ours) {
        const steg = [];
        for (const n of RAND.corner) {
          const L = need(n, 'corner');
          if (!L) continue;
          count(L);
          if (L.a0 < -W - E || L.a1 > E || L.w0 < -E || L.w1 > W + E) fail(`[16] Ecke ${n}: liegt von a ${L.a0.toFixed(2)} bis ${L.a1.toFixed(2)}, w ${L.w0.toFixed(2)} bis ${L.w1.toFixed(2)} m, erwartet im Quadrat vor dem Seitenanfang (a −${W}..0, w 0..${W})`);
        }
        for (const [n, a] of RAND[s.kind]) {
          const L = need(n, s.kind);
          if (!L) continue;
          count(L);
          const len = L.a1 - L.a0, lo = /steg/.test(n) ? a : a - len / 2;
          if (/steg/.test(n)) steg.push([lo, lo + len, n]);
          else if (lo < -E || lo + len > s.len + E) fail(`[16] ${n} an a ${a} auf der ${s.kind === 'long' ? 'Laengs' : 'Quer'}seite reicht von ${lo.toFixed(2)} bis ${(lo + len).toFixed(2)} m, die Seite ist ${s.len} m lang`);
          if (L.w0 < -E || L.w1 > W + E) fail(`[16] ${n}: liegt von w ${L.w0.toFixed(2)} bis ${L.w1.toFixed(2)} m, der Rand ist ${W} m breit: Es ragte ins Feld oder auf den Hallenboden`);
          if (/steg/.test(n) && (Math.abs(L.y1) > 0.02 || L.y0 < -0.3)) fail(`[16] ${n}: Oberkante ${L.y1.toFixed(3)} m, Unterkante ${L.y0.toFixed(3)} m; der Steg muss buendig mit dem Boden liegen (±0,02) und nicht tiefer als 0,3 m reichen (so weit spart der Hallenshader den Boden aus, hgCut)`);
        }
        for (const [n, a] of RAND.lights[s.kind]) {
          const L = need(n, `lights.${s.kind}`);
          if (!L) continue;
          count(L);
          const len = L.a1 - L.a0;
          if (a - len / 2 < -E || a + len / 2 > s.len + E || L.w0 < -E || L.w1 > W + E) fail(`[16] Leuchte ${n} an a ${a}: liegt ausserhalb der Seite (0..${s.len} m) oder des Rands (w 0..${W} m)`);
        }
        // Stege decken die Seite von 0 bis zur Laenge, ohne Luecke und ohne Ueberlappung
        steg.sort((p, q) => p[0] - q[0]);
        let at = 0;
        for (const [lo, hi, n] of steg) {
          if (lo > at + E) fail(`[16] ${s.kind === 'long' ? 'Laengs' : 'Quer'}seite: Luecke im Steg von ${at.toFixed(2)} bis ${lo.toFixed(2)} m (vor ${n}); man saehe unter den Boden`);
          if (lo < at - E) fail(`[16] ${s.kind === 'long' ? 'Laengs' : 'Quer'}seite: ${n} ueberlappt den Steg davor um ${(at - lo).toFixed(2)} m; beide flimmerten gegeneinander`);
          at = Math.max(at, hi);
          randRun.stege++;
        }
        if (Math.abs(at - s.len) > E) fail(`[16] ${s.kind === 'long' ? 'Laengs' : 'Quer'}seite: die Stege enden bei ${at.toFixed(2)} m, die Seite ist ${s.len} m lang`);
        randRun.seiten++;
      }
      for (const [n, a] of RAND.once ?? []) {
        const L = need(n, 'once');
        if (!L) continue;
        const s = ours.find((q) => q.t[0] === L.side.t[0] && q.t[1] === L.side.t[1]);
        count(L);
        const len = L.a1 - L.a0;
        if (a - len / 2 < -E || a + len / 2 > s.len + E || L.w0 < -E || L.w1 > W + E) fail(`[16] ${n} an a ${a}: liegt ausserhalb seiner Seite (0..${s.len} m) oder des Rands (w 0..${W} m)`);
      }
      randRun.mats = mats.size;
      // Gleichnamige Materialien im Schacht: Der Viewer nimmt deren Karten (wie [15])
      const shaftDoc = await decode(fromUrl(hall.lift.url));
      const maps = (m) => [['Farbe', m.getBaseColorTexture()], ['Normale', m.getNormalTexture()], ['Rauheit', m.getMetallicRoughnessTexture()]];
      const twinOf = new Map(shaftDoc.getRoot().listMaterials().map((m) => [m.getName(), m]));
      for (const m of usedMats) {
        const tw = twinOf.get(m.getName());
        if (!tw) continue;
        randRun.zwillinge++;
        const twMaps = new Map(maps(tw));
        for (const [k, t] of maps(m)) {
          const u = twMaps.get(k);
          if (t && u && sha1Bytes(t.getImage()) !== sha1Bytes(u.getImage())) fail(`[16] ${m.getName()}: die Karte ${k} des Rands ist ein anderes Bild als die des gleichnamigen Schachtmaterials; der Viewer naehme die des Schachts. Export pruefen oder das Material umbenennen`);
        }
      }
      const O = OBERGRENZE_RAND;
      if (randRun.teile < KLINKE_RAND.teile) fail(`[16] der Rand traegt ${randRun.teile} Teile, die Klinke verlangt ${KLINKE_RAND.teile}: Eintrag in HALL_RAND verloren? KLINKE_RAND nur per Commit mit Ursache senken`);
      if (randRun.tris > O.tris) fail(`[16] der Rand zeichnet ${randRun.tris} Dreiecke, die Obergrenze ist ${O.tris}: Er ist in Ruhe immer zu sehen. OBERGRENZE_RAND nur per Commit mit Ursache anheben`);
      if (randRun.mats > O.mats) fail(`[16] der Rand braucht ${randRun.mats} Materialien (Zeichenbefehle in jedem Bild), die Obergrenze ist ${O.mats}: OBERGRENZE_RAND nur per Commit mit Ursache anheben`);
      if (randRun.bytes > O.bytes) fail(`[16] der Rand wiegt ${(randRun.bytes / 1e6).toFixed(2)} MB, die Obergrenze ist ${O.bytes / 1e6} MB`);
    }
  }
}
sollIst(randWant ? `Rand in dist/ wie im Manifest; jede Seite mit Stegen von 0 bis zur Laenge, ohne Luecke und Ueberlappung, buendig mit dem Boden; Ecken, Leuchten und Schriftzug im Rand; Materialien wie im Schacht mit denselben Karten; mindestens ${KLINKE_RAND.teile} Teile; hoechstens ${OBERGRENZE_RAND.tris} Dreiecke, ${OBERGRENZE_RAND.mats} Materialien, ${OBERGRENZE_RAND.bytes / 1e6} MB` : 'kein Rand fuer diese Halle', randWant ? `${randRun.seiten} Seiten, ${randRun.stege} Stege, ${randRun.teile} Teile, ${randRun.zwillinge} Materialien mit Schachtkarten verglichen; ${randRun.tris} Dreiecke, ${randRun.mats} Materialien, ${(randRun.bytes / 1e6).toFixed(2)} MB` : '(nichts gemessen)');

say('\n[Selbstauskunft]');
say(`    Halle: ${hall?.id ?? '(keine)'}   Eintraege: ${entries.length}   Hallenstufen gemessen: ${measured}   Moebel: ${inHall + inFile}   Ergaenzung: ${ergTris} Dreiecke   Fuellung: ${fillTris} Dreiecke   Telefon: ${patchTris} Dreiecke   Randecken: ${seamRuns.map((r) => r.boundaryVerts).join(', ') || 0}   Aufzug: ${liftRuns.map((r) => r.moved).join(', ') || 0} Dreiecke   Schacht: ${shaftRun.parts} Teile, ${shaftRun.tris} Dreiecke, ${shaftRun.lights} Lampen, ${shaftRun.wornTris} mit Abnutzung, ${shaftRun.deco} Beiwerk   Werkstatt: ${workRun.props} Geraete, ${workRun.decals} Decals, ${workRun.items} Plaetze, ${workRun.field} Feldspuren, Spielboden ${workRun.pad.join(', ') || 0} Dreiecke   Wartungsplatz: ${dienstRun.stationen} Plaetze, ${dienstRun.glieder} Glieder, ${dienstRun.leitungen} Leitungen, ${dienstRun.spuren} Spuren, ${dienstRun.props} Requisiten, ${dienstRun.mats} Materialien, ${dienstRun.tris} Dreiecke   Schachttor: ${gateRun.teile} Teile, ${gateRun.zellen} Zellen, ${gateRun.tris} Dreiecke, ${gateRun.mats} Materialien, ${gateRun.lacke} Palettenlacke   Rand: ${randRun.seiten} Seiten, ${randRun.stege} Stege, ${randRun.teile} Teile, ${randRun.tris} Dreiecke, ${randRun.mats} Materialien`);

if (findings.length) {
  console.error(`\nverify-hangar-hall: ${findings.length} FEHLER\n`);
  for (const f of findings) console.error(`  · ${f}`);
  console.error('');
  process.exit(1);
}
say('\nverify-hangar-hall: ALLE ZUSICHERUNGEN ERFUELLT ✓\n');
