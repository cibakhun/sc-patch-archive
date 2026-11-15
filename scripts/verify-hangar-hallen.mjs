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
       Knoten; die Halle hat ihr Grundlicht (hallGrund, Klinke je Halle),
       und es steht im Lichtgitter: Das Tor rechnet das Gitter mit der
       Funktion des Viewers (hallGitter) ohne Lampen und liest jede Zelle
       zurück, alle sechs Richtungen und die Lichtfarbe; ohne den Namen
       der Halle bleibt es dunkel; die Bühne rechnet ihr Gitter mit
       derselben Funktion und reicht ihr die Halle; gitterDunkel des
       Viewers nennt am selben Gitter dessen dunkelste Stelle (daran
       misst check:hangar-shader, was die laufende Bühne geladen hat)
   [3] Bestand: Schrift, Schirme und die Zahlen des Manifests über ihren
       Klinken und unter ihren Obergrenzen (darunter die eingehängten
       Kind-Container: Frachtaufzüge und Türen); die Lampen aus der
       ausgelieferten Datei, so viele, wie das Manifest nennt, jede
       vollständig, und gezählt wird gegen die Klinke, was die Bühne
       davon nach ihrer eigenen Regel setzt (hallLampeGilt im Viewer);
       mit diesen Lampen gerechnet ist das Lichtgitter überall die Summe
       aus Lampenlicht und Grundlicht; die Flächenlichter strahlen
       entlang ihrer eigenen Achse, und die Lampen, die im Spiel in Ruhe
       dunkel sind, stehen nicht in der Datei (beides nennt die Datei
       selbst, Klinken je Halle)
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
   (p) 15.11.2026, mit dem Grundlicht der Halle (Krisz zur ausgelieferten
       Halle: „viel zu dunkel“, Wände und Decke standen im Schwarz),
       fünfmal am ausgelieferten Viewer gebrochen:
       HALL_FEST ohne grund: „[2] util-lrgtop: die Halle hat kein
       Grundlicht (HALL_FEST.grund null) — Waende und Decke stuenden im
       Schwarz …“;
       grund 2 statt 4.5: „[2] util-lrgtop: das Grundlicht am Boden ist 2
       (Waende) und 2 (Flaechen nach oben), Klinke 3 …“;
       loadHallLights reicht buildHallVolume die Halle nicht mehr durch:
       „[2] der ausgelieferte Viewer legt das Grundlicht der Hallen nicht
       ins Lichtgitter …“ (diese Naht las nur den Quelltext, (q) ersetzt
       sie);
       VOL_GRUND.decke 0 statt 0.4: „[2] util-lrgtop: das Grundlicht
       faellt unter der Decke oder an Unterseiten auf null (Decke 0, …)
       — die Decke staende schwarz“;
       hallGrund ohne export: „[2] util-lrgtop: der ausgelieferte Viewer
       nennt das Grundlicht seiner Hallen nicht mehr (hallGrund) …“.
   (q) 15.11.2026, nach dem Review zu PR #380 (CodeRabbit: Wer die
       Additionen ins Gitter streicht, lässt hallGrund und die
       durchgereichte Halle im Quelltext stehen, die Naht aus (p) blieb
       grün). Seither rechnet das Tor das Gitter selbst nach
       (scripts/lib/hall-gitter.mjs). Sechsmal am ausgelieferten Viewer
       gebrochen, dazu die vier übrigen Brüche aus (p) mit denselben
       Meldungen wie dort:
       der Fall aus dem Review, die drei Zeilen mit den Additionen
       gestrichen: „[2] util-lrgtop: das Grundlicht kommt im Lichtgitter
       des Viewers nicht so an, wie hallGrund es nennt (ohne Lampen
       gerechnet, 286452 Zellen): +x an 286452 Zellen, zuerst in der
       Schicht -1 m ueber dem Boden 0 statt 4.5; -x …; +y …; -y … 0 statt
       2.7; +z …; -z …; Lichtfarbe Rot … 1 statt 0.843; Lichtfarbe Blau …
       1 statt 1.1241 — …“;
       nur die Addition für Unterseiten gestrichen: dieselbe Meldung mit
       „-y an 286452 Zellen, … 0 statt 2.7“ allein;
       = statt += für +x: „[3] util-lrgtop: Lampenlicht und Grundlicht
       stehen nicht zusammen im Lichtgitter: An 89361 von 1718712 Werten
       ist das Gitter mit beidem nicht ihre Summe (zuerst +x: 3.666 statt
       0.0151 der Lampen plus 3.666 Grundlicht) — …“;
       Grundlicht 2 für jede Halle ohne Eintrag: „[2] util-lrgtop: ohne
       Lampen und ohne den Namen der Halle steht Licht im Gitter (1718712
       Werte ueber null, der hoechste 2) — …“;
       die Bühne reicht hallGitter nur den Raum ({ room: h.room }): „[2]
       die Buehne des ausgelieferten Viewers rechnet ihr Lichtgitter nicht
       mit hallGitter und ihrer Halle (1 Aufruf(e) in loadHallLights:
       Zeile 9207 hallGitter(…, { room: h.room }, f, slicer(12, rast)),
       das zweite Argument ist nicht die Halle; …) — …“;
       hallGitter ohne export: „[2] util-lrgtop: der ausgelieferte Viewer
       gibt sein Lichtgitter nicht mehr heraus (hallGitter, VOL_STEP,
       VOL_GRUND) — …“.
       Jede dieser Formen und weitere (jede Richtung einzeln, Höhe nicht
       beachtet, Farbe weiß, das größere statt der Summe, Lampenlicht
       gelöscht) bricht tests/e2e/hall-gitter.test.js am Viewer des Repos.
   (r) 15.11.2026, zweite Runde zu PR #380 (CodeRabbit: const vol = await
       hallGitter(…); vol.a = null; vol.b = null; galt der Naht aus (q)
       als geladen, ein Zuweisungsziel ist auch ein Feldzugriff). Die Naht
       zählt seither nur, wo der Wert eines Felds genommen wird. Wohin er
       danach geht, sagt kein Syntaxbaum: Das misst jetzt die laufende
       Bühne an ihren Uniformen (gitterDunkel, check:hangar-shader, dort
       im Kopf unter LICHTGITTER), und das Tor hält hier fest, dass
       gitterDunkel am nachgerechneten Gitter dessen dunkelste Stelle
       nennt. Dreimal am ausgelieferten Viewer gebrochen:
       der Fall aus dem Review, die Bühne lädt nichts und überschreibt
       das Ergebnis (vol.a = null; vol.b = null;): „[2] die Buehne des
       ausgelieferten Viewers rechnet ihr Lichtgitter nicht mit hallGitter
       und ihrer Halle (1 Aufruf(e) in loadHallLights: Zeile 9220
       hallGitter(…, h, f, slicer(12, rast)), sein Ergebnis wird nicht
       gewartet, benannt und mit a und b gelesen; …) — …“ (der Stand
       davor blieb mit demselben Eingriff grün);
       gitterDunkel zählt das Rot der Lichtfarbe mit: „[2] util-lrgtop:
       der ausgelieferte Viewer nennt die dunkelste Stelle seines
       Lichtgitters nicht so, wie sie in den Zellen steht (gitterDunkel:
       0.8428, in den Zellen: 1.0791) — an dieser Zahl misst
       check:hangar-shader, ob die laufende Buehne das Gitter mit dem
       Grundlicht geladen hat; die Messung dort sagte nichts mehr“;
       gitterDunkel ohne export: dieselbe Meldung mit „gitterDunkel:
       nichts“.
       Jede Form eines Feldzugriffs, der nicht liest (Ziel einer
       Zuweisung, Muster, Schleifenkopf, delete, ++, void, typeof, für
       sich stehend), steht mit ihrem echten Lauf in
       tests/e2e/hall-gitter.test.js, dazu die Grenze der Naht: Formen,
       die lesen und nichts laden.
   (s) 15.11.2026, gedämpfte Lichtgruppen (HALL_FEST.daempf): Die Lampen
       in den Kabinen der Frachtaufzüge hängen wenige Meter über ihrem
       Boden; mit der Stärke der Halle (licht 16) brannte er aus. Fünfmal
       am ausgelieferten Viewer gebrochen und einmal an einer Kopie des
       Tors, je 1 FEHLER:
       die Dämpfung nennt eine Gruppe, von der die ausgelieferte Datei
       keine Lampe trägt (…_lrg_b statt …_lrg_a): „[3] util-lrgtop:
       HALL_FEST.daempf nennt die Lichtgruppe
       lg_elev_util_cargo_hangar_lrg_b, die ausgelieferte Lampendatei
       traegt keine Lampe von ihr — die Daempfung hat ihren Anlass
       verloren (Gruppe umbenannt oder nicht mehr geholt): den Eintrag
       streichen oder an den neuen Namen anpassen“;
       Faktor 1,5: „[3] util-lrgtop:
       HALL_FEST.daempf.lg_elev_util_cargo_hangar_lrg_a ist 1.5, erwartet
       ein Faktor zwischen 0 und 1 — 1 und mehr daempft nicht, 0 und
       weniger loescht die Lampen der Gruppe“;
       hallLampenStaerke rechnet die Dämpfung nicht ein: „[3] util-lrgtop:
       114 von 114 Lampen der Lichtgruppe lg_elev_util_cargo_hangar_lrg_a
       bekommen vom Viewer nicht die gedaempfte Staerke
       (hallLampenStaerke: 16 fuer lg_elev_util_cargo_hangar_lrg_a-000,
       erwartet licht 16 mal 0.25) — der Boden unter ihnen wuerde wieder
       ausbrennen“;
       hallLampenStaerke ohne export: „[3] util-lrgtop: der Viewer nennt
       die Staerke seiner Lampen nicht mehr (hallLampenStaerke,
       lampenGruppe), HALL_FEST.daempf nennt aber 1 Lichtgruppe(n) — ob
       ihre Lampen gedaempft werden, liesse sich nur raten“;
       HALL_FEST ohne daempf (die Klinke gedaempft): „[3] util-lrgtop: der
       Viewer daempft 0 Lampen der ausgelieferten Datei, Klinke 114 —
       Lampen, die wenige Meter ueber ihrem Boden haengen, bekommen wieder
       die volle Staerke der Halle, der Boden unter ihnen brennt aus
       (HALL_FEST.daempf im Viewer; in util-lrgtop die Kabinen der
       Frachtaufzuege)“;
       die Halle dämpft und trägt keine Klinke gedaempft (Kopie des Tors
       ohne den Eintrag, der Viewer unverändert): „[3] util-lrgtop:
       HALL_FEST.daempf nennt 1 Lichtgruppe(n), die Halle hat keine Klinke
       gedaempft (KLINKE) — fiele die Daempfung wieder weg, bliebe das Tor
       gruen“.
       Bleibt hier grün und reißt im Test: lampenGruppe nimmt nur eine
       Nummer vom Namen (keine gedämpfte Gruppe dieser Halle trägt zwei);
       tests/e2e/hall-lampen.test.js hält die Regel am Viewer des Repos,
       dort viermal vorgeführt rot (eine Nummer, ohne Dämpfung gerechnet,
       Gruppe nach dem Anfang des Namens, HALL_FEST ohne daempf).
       Nicht hier geprüft: dass die Bühne ihre Lampen mit
       hallLampenStaerke hebt. Das misst check:hangar-shader an ihrer
       Zeile „… Spiellampen … gesetzt, N gedämpft“ (dort im Kopf unter
       GEDAEMPFTE LAMPEN).
   (t) 15.11.2026, Flächenlichter entlang ihrer eigenen Achse (Lesart
       achse, scripts/lib/hall-lights.mjs): Von der nächsten Fläche weg
       gedreht zeigten in der Large-Halle 22 von 58 ihrer eigenen Richtung
       entgegen. Viermal an der ausgelieferten Lampendatei gebrochen und
       einmal an einer Kopie des Tors, je 1 FEHLER:
       die Datei nennt keine Lesart (so stand sie bis zu diesem Tag):
       „[3] util-lrgtop: die ausgelieferte Lampendatei nennt fuer ihre
       Flaechenlichter die Lesart null, erwartet "achse" — in den Hallen
       fester Groesse strahlen sie entlang ihrer eigenen Achse; von der
       naechsten Flaeche weg gedreht zeigen die Deckenpaneele der Kabinen
       an die Decke und Lampen unter dem Dach in die Kehle
       (FLAECHEN_LESART in build-hangar-assets.mjs, die Halle am PC neu
       bauen)“;
       ein Flächenlicht trägt einen Abstand zu einer Fläche (den schreibt
       nur die alte Lesart): „[3] util-lrgtop: 1 von 58 Flaechenlichtern
       der ausgelieferten Datei tragen einen Abstand zu einer Flaeche
       (gap, zuerst lg_hangar_lrgtop-004), die Datei nennt aber die
       Lesart achse — Liste und Lesart stammen nicht aus demselben Bau“;
       ein Flächenlicht ohne Richtung, und eines mit halber Länge:
       „[3] util-lrgtop: 1 von 58 Flaechenlichtern der ausgelieferten
       Datei tragen keine Richtung der Laenge 1 (zuerst
       lg_hangar_lrgtop-004: null) — sie strahlten rundum, auch in die
       Wand, an der sie sitzen“ (im zweiten Lauf „… [0,-0.5,0]“);
       die Klinke flaechen um eins über dem Bestand (Kopie des Tors):
       „[3] util-lrgtop: 58 Flaechenlichter entlang ihrer eigenen Achse
       in der ausgelieferten Datei, Klinke 59“.
       Nicht hier geprüft: dass die Richtung die des Spiels ist. Die
       Achsen der Lichtknoten kennt nur der Build am PC;
       tests/e2e/hall-licht-richtung.test.js hält die Regel am echten
       Strahl gegen ein kleines Modell, dort viermal vorgeführt rot (die
       Lesart nicht beachtet, eine unbekannte still hingenommen, ein
       Licht ohne Richtung behält sie, hindurch als weg gezählt).
   (u) 15.11.2026, Lampen, die im Spiel in Ruhe dunkel sind
       (scripts/lib/hall-ruhe.mjs): Der Export schrieb sie mit ihrem
       nächsten Zustand, der Stärke hat, und so brannten in der
       Large-Halle 86 Warnleuchten, Notlichter und Strahler. Fünfmal an
       der ausgelieferten Lampendatei gebrochen und zweimal an einer Kopie
       des Tors, je 1 FEHLER:
       die Datei nennt die Regel nicht (ohne ruhe, und mit ruhe ohne
       gruppen): „[3] util-lrgtop: die ausgelieferte Lampendatei nennt
       nicht, welche Lampen im Spiel in Ruhe dunkel sind und wegblieben
       (ruhe mit weg und gruppen) — ohne die Liste des Extraktors brennen
       Warnleuchten, Notlicht und die Strahler in der Grube unter der
       Plattform, die das Spiel erst schaltet (<halle>.ruhe.json fehlt
       neben dem Rohmodell: Halle am PC neu holen und bauen)“;
       eine Lampe der Datei trägt einen der genannten Namen: „[3]
       util-lrgtop: 1 Lampe(n) der ausgelieferten Datei sind im Spiel in
       Ruhe dunkel (zuerst lg_hangar_lrgtop-008); die Datei nennt sie
       selbst unter ruhe — Liste und Lampen stammen nicht aus demselben
       Bau“;
       die Datei nennt eine Lampe weniger als das Manifest: „[3]
       util-lrgtop: die ausgelieferte Lampendatei nennt 85 in Ruhe dunkle
       Lampen, das Manifest 86 — Datei und Manifest stammen nicht aus
       demselben Bau (gemeinsam einchecken)“;
       die Datei nennt weniger Lampen als Namen: „[3] util-lrgtop: die
       ausgelieferte Lampendatei nennt 80 weggelassene Lampen, ihre
       Gruppen nennen 81 Namen — jeder Name steht fuer wenigstens eine
       Lampe“;
       die Klinke ruhe um eins über dem Bestand (Kopie des Tors): „[3]
       util-lrgtop: 86 in Ruhe dunkle Lampen blieben weg, Klinke 87 — die
       Liste nennt weniger als gemessen, ein Teil der Warnleuchten und
       des Notlichts brennt wieder (ein Container fehlt in
       <halle>.ruhe.json, oder das Spiel hat die Lampen geaendert: dann
       die Klinke per Commit mit Ursache senken)“;
       die Halle lässt Lampen weg und trägt keine Klinke ruhe (Kopie des
       Tors ohne den Eintrag): „[3] util-lrgtop: die ausgelieferte
       Lampendatei laesst in Ruhe dunkle Lampen weg (ruhe), die Halle hat
       keine Klinke ruhe (KLINKE) — fiele die Regel wieder weg, bliebe
       das Tor gruen“.
       Nicht hier geprüft: dass die Liste die richtigen Lampen nennt. Das
       hält der Extraktor am PC gegen das Protokoll seines Exports (jede
       Lampe jeder exportierten Gruppe mit der Stärke ihres Zustands,
       sonst bricht er ab), und der Build bricht ab, wenn ein genannter
       Lichtknoten nicht so oft im Modell steht, wie die Liste sagt.
       tests/e2e/hall-ruhe.test.js hält beides an kleinen Entities und
       Protokollen, dort sechsmal vorgeführt rot (auxiliary gilt als
       brennend, ohne die Probe am Protokoll, ohne Exemplare gezählt, ein
       Name öfter im Modell als in der Liste, Kinder ohne Lichter
       mitgezählt, dieselbe Gruppe in zwei Containern).
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
import { lampenName } from './lib/hall-ruhe.mjs';
import { DataUtils } from 'three';
import { gitterWerte, grundImGitter, gitterLicht, gitterDazu, gitterAufrufe, gitterDunkelste } from './lib/hall-gitter.mjs';

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
// grund: Grundlicht der Halle am Boden (hallGrund im Viewer). Krisz am 15.11.2026 zur ausgelieferten Halle:
// „viel zu dunkel“, Wände und Decke standen im Schwarz. In der Messreihe an seiner Startansicht lagen bei 2
// noch 54 % des oberen Bildteils unter 16 von 255, bei 3 waren es 47 %; ausgeliefert wird 4,5 (37 %). Die
// Klinke hält die kleinste Stufe, die er zur Auswahl bekam.
// Seit dem 15.11.2026 brennen auch die Lampen in den Kabinen der beiden Frachtaufzüge (2 × 57; ihre Lichtgruppe
// hängt an der Plattform, und solche Gruppen ließ der Export weg): 912 statt 798 Lampen. Ein Netz mehr trägt
// Aufkleber (151 statt 150), seit Aufdrucke an gedrehten Knoten ihre Lage aus dem Knotenbaum bekommen.
// gedaempft: Lampen der ausgelieferten Datei, die der Viewer schwächer hebt als die Halle (HALL_FEST.daempf,
// hallLampenStaerke): die 114 in den Kabinen. Fällt die Dämpfung weg, brennt der Kabinenboden wieder aus.
// Eine Halle ohne diese Klinke dämpft keine Lampe; nennt HALL_FEST für sie doch eine Gruppe, reißt das Tor.
// flaechen: Flächenlichter der ausgelieferten Datei, die entlang ihrer eigenen Achse strahlen (Lesart achse,
// orientHallLights; die Messung steht in scripts/lib/hall-lights.mjs). Von der nächsten Fläche weg gedreht
// zeigten in der Large-Halle 22 von 58 ihrer eigenen Richtung entgegen: die Deckenpaneele der Kabinen an die
// Decke, acht Lampen unter dem Dach in die Kehle.
// ruhe: Lampen, die im Spiel in Ruhe dunkel sind und deshalb nicht in der ausgelieferten Datei stehen
// (scripts/lib/hall-ruhe.mjs): 76 der Hallengruppe (die Strahler in der Grube unter der Plattform, Drehlichter,
// Notlicht, Hololichter) und je Frachtaufzug 5 Warnleuchten. Der Export schrieb sie mit ihrem nächsten Zustand,
// der Stärke hat, und so brannten sie. Mit ihnen sank die Klinke lampen am 15.11.2026 von 912 auf 826: Die 86
// fehlen der Halle nicht, das Spiel zeigt sie in Ruhe dunkel. Eine Halle ohne diese Klinke lässt keine Lampe weg;
// nennt ihre Lampendatei doch welche, reißt das Tor.
// Am selben Tag kamen die Landeleuchten der Schiffsplattform dazu (44 der 55 Lampen ihrer Lichtgruppe brennen in
// Ruhe; sie hängt am Knochen der Plattform, wie die der Kabinen): 870 statt 826 Lampen.
const KLINKE = {
  'util-lrgtop': { lampen: 870, tor: 18, schriftTris: 2337, schirmTris: 244, schirme: 13, tafeln: 9, aufkleber: 151, schilder: 5, kinder: 14, grund: 3, gedaempft: 114, flaechen: 58, ruhe: 86 },
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
say('[2] Modell: Boden der Seite wie das Lot am Modell, Plattform auf dieser Hoehe, Landeflaeche im Feld des Aufzugs und im Raum, jede Bahn mit Knoten, Grundlicht je Halle ueber der Klinke und im Lichtgitter');
const io = HALLEN.size ? new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() }) : null;
const DOCS = new Map();
let bahnen = 0, padFlaeche = 0;
// Das Grundlicht steht nur dann auf den Flaechen, wenn es im Lichtgitter ankommt. Das Tor rechnet das Gitter
// darum mit der Funktion des Viewers selbst (hallGitter; ihr Ergebnis laedt die Buehne als Textur) und liest
// zurueck, was in jeder Zelle steht (scripts/lib/hall-gitter.mjs, dort auch, warum nicht mehr am Quelltext):
//   ohne Lampen steht in jeder Zelle genau das Grundlicht ihrer Hoehe, in allen sechs Richtungen und in seiner
//   Farbe; dieselbe Halle ohne ihren Namen bleibt dunkel (das Licht stammt aus ihrem Eintrag in HALL_FEST, eine
//   Halle ohne Eintrag bekommt keins); und mit den Lampen der ausgelieferten Datei kommt es zu deren Licht
//   hinzu, statt es zu ersetzen ([3], dort liegen die Lampen).
// Am Quelltext bleibt eine Naht: Die Buehne rechnet ihr Gitter mit eben dieser Funktion und reicht ihr die Halle.
const NAHT = gitterAufrufe(viewerSrc);
const gitterNaht = !NAHT.fehler.length && NAHT.aufrufe.length === 1 && NAHT.aufrufe[0].halle && NAHT.aufrufe[0].genutzt;
if (HALLEN.size && !gitterNaht) fail(`[2] die Buehne des ausgelieferten Viewers rechnet ihr Lichtgitter nicht mit hallGitter und ihrer Halle (${NAHT.fehler[0] ?? (NAHT.aufrufe.length ? `${NAHT.aufrufe.length} Aufruf(e) in loadHallLights: ${NAHT.aufrufe.map((a) => `Zeile ${a.zeile} ${a.knoten}${a.halle ? '' : ', das zweite Argument ist nicht die Halle'}${a.genutzt ? '' : ', sein Ergebnis wird nicht gewartet, benannt und mit a und b gelesen'}`).join(' | ')}` : 'kein Aufruf in loadHallLights')}; erwartet genau einer: const … = await hallGitter(<Lampen>, <Halle>, …), dessen a und b die Buehne laedt) — das Tor rechnete ein Gitter nach, das die Buehne nicht laedt, und ob das Grundlicht auf den Flaechen ankommt, waere ungeprueft`);
const GITTER = new Map();
const m2 = (x) => +x.toFixed(2);
// Gitter der Halle ohne Lampen, mit und ohne ihren Namen; null nach einem FEHLER
async function grundProbe(id, hall) {
  if (typeof viewer?.hallGitter !== 'function' || !(viewer.VOL_STEP > 0) || !Array.isArray(viewer.VOL_GRUND?.farbe)) { fail(`[2] ${id}: der ausgelieferte Viewer gibt sein Lichtgitter nicht mehr heraus (hallGitter, VOL_STEP, VOL_GRUND) — ob das Grundlicht auf den Flaechen ankommt, laesst sich nicht nachrechnen`); return null; }
  let leer = null, fremd = null, roh = null;
  try {
    roh = await viewer.hallGitter([], hall, hall.floor);
    leer = gitterWerte(roh, DataUtils.fromHalfFloat);
    fremd = gitterWerte(await viewer.hallGitter([], { room: hall.room }, hall.floor), DataUtils.fromHalfFloat);
  } catch (e) { fail(`[2] ${id}: das Lichtgitter laesst sich nicht rechnen (hallGitter: ${e.message})`); return null; }
  if (!leer || !fremd) { fail(`[2] ${id}: hallGitter liefert kein Gitter (erwartet res und min aus je drei Zahlen und zwei Halbfloat-Felder a und b mit vier Werten je Zelle)`); return null; }
  const B = grundImGitter(leer, { boden: hall.floor, hoehe: hall.room.height, step: viewer.VOL_STEP, grund: (hoch) => viewer.hallGrund(id, hoch), farbe: viewer.VOL_GRUND.farbe });
  const F = gitterLicht(fremd);
  if (!B.reicht || B.ohneSoll) { fail(`[2] ${id}: das Lichtgitter deckt den Raum nicht vom Boden bis zur Decke (${B.schichten} Schichten von ${m2(B.von)} bis ${m2(B.bis)} m ueber dem Boden, der Raum ist ${hall.room.height} m hoch${B.ohneSoll ? `; fuer ${B.ohneSoll} Schichten nennt hallGrund nichts` : ''}) — Flaechen ausserhalb bekaemen weder Lampen- noch Grundlicht`); return null; }
  if (B.abweichungen.length) { fail(`[2] ${id}: das Grundlicht kommt im Lichtgitter des Viewers nicht so an, wie hallGrund es nennt (ohne Lampen gerechnet, ${B.zellen} Zellen): ${B.abweichungen.map((a) => `${a.was} an ${a.zahl} Zellen, zuerst in der Schicht ${m2(a.ueberBoden)} m ueber dem Boden ${+a.ist.toFixed(4)} statt ${+a.soll.toFixed(4)}`).join('; ')} — Flaechen in dieser Richtung stuenden dunkler oder heller als abgenommen, bei 0 im Schwarz wie am 15.11.2026`); return null; }
  if (F.ueberNull) { fail(`[2] ${id}: ohne Lampen und ohne den Namen der Halle steht Licht im Gitter (${F.ueberNull} Werte ueber null, der hoechste ${+F.hoechster.toFixed(4)}) — das Grundlicht kaeme nicht mehr aus HALL_FEST.${id}: Die Halle von Revel & York bekaeme es auch, und was das Tor oben gemessen hat, waere nicht das Grundlicht dieser Halle`); return null; }
  // Die laufende Buehne meldet nach dem Laden die dunkelste Stelle dessen, was ihre Uniformen tragen (gitterDunkel,
  // Zeile "[hangar] Lichtgitter … geladen (dunkelste Stelle …)"), und check:hangar-shader haelt sie gegen die Klinke
  // der Halle. Hier am selben Gitter: Die Funktion nennt, was in den Zellen steht.
  const D = typeof viewer.gitterDunkel === 'function' ? viewer.gitterDunkel(roh.a, roh.b) : null, S = gitterDunkelste(leer);
  if (D !== S) { fail(`[2] ${id}: der ausgelieferte Viewer nennt die dunkelste Stelle seines Lichtgitters nicht so, wie sie in den Zellen steht (gitterDunkel: ${D === null ? 'nichts' : +(+D).toFixed(4)}, in den Zellen: ${+S.toFixed(4)}) — an dieser Zahl misst check:hangar-shader, ob die laufende Buehne das Gitter mit dem Grundlicht geladen hat; die Messung dort sagte nichts mehr`); return null; }
  GITTER.set(id, leer);
  return { ...B, dunkel: S };
}
const grundlicht = [];
for (const [id, { hall, F }] of HALLEN) {
  let doc;
  try { doc = await io.read(inDist(hall.url)); } catch (e) { fail(`[2] ${id}: das Modell laesst sich nicht lesen (${e.message})`); continue; }
  DOCS.set(id, doc);
  const c = hall.room.center, P = F.pad;
  if (!(Array.isArray(P?.from) && Array.isArray(P?.to) && P.from[0] < P.to[0] && P.from[1] < P.to[1])) { fail(`[2] HALL_FEST.${id}.pad nennt keine Landeflaeche (from, to im Modellraum)`); continue; }
  const mitte = [(P.from[0] + P.to[0]) / 2, (P.from[1] + P.to[1]) / 2];
  if (P.from[0] < c[0] - hall.room.halfW || P.to[0] > c[0] + hall.room.halfW || P.from[1] < c[2] - hall.room.halfL || P.to[1] > c[2] + hall.room.halfL) fail(`[2] ${id}: die Landeflaeche (HALL_FEST.pad ${JSON.stringify(P)}) liegt nicht im Raum der Halle (Mitte ${c[0]}, ${c[2]}, halbe Breite ${hall.room.halfW}, halbe Laenge ${hall.room.halfL})`);
  if (!(F.clear > 0 && F.clear <= hall.room.height)) fail(`[2] ${id}: HALL_FEST.clear ${F.clear} m passt nicht in den Raum (Hoehe ${hall.room.height} m)`);
  // Grundlicht: am Boden ueber der Klinke, unter der Decke und an Unterseiten nicht null
  const G0 = viewer?.hallGrund?.(id, 0), G1 = viewer?.hallGrund?.(id, 1), GK = KLINKE[id]?.grund;
  if (!viewer?.hallGrund) fail(`[2] ${id}: der ausgelieferte Viewer nennt das Grundlicht seiner Hallen nicht mehr (hallGrund) — ob Waende und Decke zu sehen sind, laesst sich nicht pruefen`);
  else if (!G0 || !G1) fail(`[2] ${id}: die Halle hat kein Grundlicht (HALL_FEST.grund ${JSON.stringify(F.grund ?? null)}) — Waende und Decke stuenden im Schwarz, so wie Krisz sie am 15.11.2026 abgelehnt hat („viel zu dunkel“)`);
  else if (!(GK > 0)) fail(`[2] ${id}: keine Klinke fuer das Grundlicht (KLINKE.${id}.grund in diesem Skript) — eine neue Halle traegt die kleinste Stufe ein, die an ihren Bildern noch taugt`);
  else if (!(G0.seite >= GK && G0.oben >= GK)) fail(`[2] ${id}: das Grundlicht am Boden ist ${G0.seite} (Waende) und ${G0.oben} (Flaechen nach oben), Klinke ${GK} — darunter lag in der Messreihe wieder die Haelfte des oberen Bildteils im Schwarz`);
  else if (!(G1.seite > 0 && G1.unten > 0 && G0.unten > 0)) fail(`[2] ${id}: das Grundlicht faellt unter der Decke oder an Unterseiten auf null (Decke ${m2(G1.seite)}, Unterseiten ${m2(G0.unten)} am Boden und ${m2(G1.unten)} oben) — die Decke staende schwarz`);
  else {
    const B = await grundProbe(id, hall);
    if (B) grundlicht.push(`${id} ${G0.seite} am Boden, ${m2(G1.seite)} unter der Decke (Klinke ${GK}), im Lichtgitter nachgerechnet an ${B.zellen} Zellen in ${B.schichten} Schichten von ${m2(B.von)} bis ${m2(B.bis)} m ueber dem Boden, je sechs Richtungen und die Lichtfarbe, dunkelste Stelle ${+B.dunkel.toFixed(3)} (so meldet sie die Buehne nach dem Laden)`);
  }
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
say(`    Grundlicht in ${grundlicht.length} von ${HALLEN.size} Halle(n)${grundlicht.length ? `: ${grundlicht.join('; ')}` : ''}; die Buehne rechnet ihr Gitter mit derselben Funktion: ${gitterNaht ? 'ja' : 'NEIN'}`);

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
  // Flaechenlichter: In den Hallen fester Groesse strahlen sie entlang ihrer eigenen Achse, wie im Spiel. Die
  // Lampendatei nennt die Lesart, mit der der Build sie ausgerichtet hat (flaechen), und unter achse traegt jedes
  // eine Richtung der Laenge 1 und keinen Abstand zu einer Flaeche (gap schreibt nur die Lesart flaeche). Nicht
  // geprueft wird hier, dass die Richtung die des Spiels ist: Die Achsen der Lichtknoten kennt nur der Build am PC
  // (orientHallLights, tests/e2e/hall-licht-richtung.test.js; seine Zeile "… Flaechenlichter entlang ihrer
  // eigenen Achse" nennt, wie viele von ihrer Flaeche weg zeigen).
  let flaechen = null;
  if (lampenRoh) {
    const fl = lampenRoh.filter((l) => wohlgeformt(l) && l.type === 'area');
    const gerichtet = (l) => Array.isArray(l.dir) && l.dir.length === 3 && l.dir.every(Number.isFinite) && Math.abs(Math.hypot(...l.dir) - 1) < 0.01;
    const mitAbstand = fl.filter((l) => l.gap !== undefined), ohne = fl.filter((l) => !gerichtet(l));
    if (L.flaechen !== 'achse') fail(`[3] ${id}: die ausgelieferte Lampendatei nennt fuer ihre Flaechenlichter die Lesart ${JSON.stringify(L.flaechen ?? null)}, erwartet "achse" — in den Hallen fester Groesse strahlen sie entlang ihrer eigenen Achse; von der naechsten Flaeche weg gedreht zeigen die Deckenpaneele der Kabinen an die Decke und Lampen unter dem Dach in die Kehle (FLAECHEN_LESART in build-hangar-assets.mjs, die Halle am PC neu bauen)`);
    else if (mitAbstand.length) fail(`[3] ${id}: ${mitAbstand.length} von ${fl.length} Flaechenlichtern der ausgelieferten Datei tragen einen Abstand zu einer Flaeche (gap, zuerst ${mitAbstand[0].name}), die Datei nennt aber die Lesart achse — Liste und Lesart stammen nicht aus demselben Bau`);
    else if (ohne.length) fail(`[3] ${id}: ${ohne.length} von ${fl.length} Flaechenlichtern der ausgelieferten Datei tragen keine Richtung der Laenge 1 (zuerst ${ohne[0].name}: ${JSON.stringify(ohne[0].dir ?? null)}) — sie strahlten rundum, auch in die Wand, an der sie sitzen`);
    else if (!(fl.length >= K.flaechen)) fail(`[3] ${id}: ${fl.length} Flaechenlichter entlang ihrer eigenen Achse in der ausgelieferten Datei, Klinke ${K.flaechen}`);
    else flaechen = fl.length;
  }
  // In Ruhe dunkle Lampen: Der Export schreibt auch die Lampen, deren Ruhezustand im Spiel keine Staerke hat
  // (Warnleuchten, Notlicht, die Strahler in der Grube unter der Plattform), mit ihrem naechsten Zustand, der
  // Staerke hat. Der Build laesst sie nach der Liste des Extraktors weg (scripts/lib/hall-ruhe.mjs) und schreibt
  // die Regel in die Lampendatei: wie viele wegblieben (weg) und je Lichtgruppe ihre Stellen. Hier geprueft an der
  // ausgelieferten Datei: Sie nennt die Regel, keine ihrer Lampen traegt einen der genannten Namen, Datei und
  // Manifest nennen dieselbe Zahl, und die Zahl haelt ihre Klinke. Nicht hier geprueft wird, dass die Liste die
  // richtigen Lampen nennt: Das haelt der Extraktor am PC gegen das Protokoll seines Exports (jede Lampe jeder
  // Gruppe, sonst bricht er ab) und tests/e2e/hall-ruhe.test.js an der Regel selbst.
  let ruhe = null;
  if (lampenRoh && K.ruhe === undefined && L.ruhe !== undefined) fail(`[3] ${id}: die ausgelieferte Lampendatei laesst in Ruhe dunkle Lampen weg (ruhe), die Halle hat keine Klinke ruhe (KLINKE) — fiele die Regel wieder weg, bliebe das Tor gruen`);
  if (lampenRoh && K.ruhe !== undefined) {
    const R = L.ruhe, G = R && R.gruppen && typeof R.gruppen === 'object' && !Array.isArray(R.gruppen) ? Object.entries(R.gruppen) : null;
    const heil = G && G.length > 0 && Number.isInteger(R.weg) && G.every(([, d]) => Array.isArray(d) && d.length > 0 && d.every((i) => Number.isInteger(i) && i >= 0));
    if (!heil) fail(`[3] ${id}: die ausgelieferte Lampendatei nennt nicht, welche Lampen im Spiel in Ruhe dunkel sind und wegblieben (ruhe mit weg und gruppen) — ohne die Liste des Extraktors brennen Warnleuchten, Notlicht und die Strahler in der Grube unter der Plattform, die das Spiel erst schaltet (<halle>.ruhe.json fehlt neben dem Rohmodell: Halle am PC neu holen und bauen)`);
    else {
      const namen = new Set(G.flatMap(([g, d]) => d.map((i) => lampenName(g, i))));
      const brennt = lampenRoh.filter((l) => namen.has(l?.name));
      if (brennt.length) fail(`[3] ${id}: ${brennt.length} Lampe(n) der ausgelieferten Datei sind im Spiel in Ruhe dunkel (zuerst ${brennt[0].name}); die Datei nennt sie selbst unter ruhe — Liste und Lampen stammen nicht aus demselben Bau`);
      else if (!(R.weg >= namen.size)) fail(`[3] ${id}: die ausgelieferte Lampendatei nennt ${R.weg} weggelassene Lampen, ihre Gruppen nennen ${namen.size} Namen — jeder Name steht fuer wenigstens eine Lampe`);
      else if (R.weg !== M.lights?.ruhe?.weg) fail(`[3] ${id}: die ausgelieferte Lampendatei nennt ${R.weg} in Ruhe dunkle Lampen, das Manifest ${M.lights?.ruhe?.weg ?? 'keine'} — Datei und Manifest stammen nicht aus demselben Bau (gemeinsam einchecken)`);
      else if (!(R.weg >= K.ruhe)) fail(`[3] ${id}: ${R.weg} in Ruhe dunkle Lampen blieben weg, Klinke ${K.ruhe} — die Liste nennt weniger als gemessen, ein Teil der Warnleuchten und des Notlichts brennt wieder (ein Container fehlt in <halle>.ruhe.json, oder das Spiel hat die Lampen geaendert: dann die Klinke per Commit mit Ursache senken)`);
      else ruhe = { weg: R.weg, namen: namen.size, gruppen: G.length };
    }
  }
  // Gedaempfte Lichtgruppen (HALL_FEST.daempf, hallLampenStaerke): Jede nennt einen Faktor zwischen 0 und 1 und
  // Lampen, die die ausgelieferte Datei wirklich traegt. Eine Daempfung ohne Lampen ist eine Ausnahme ohne Anlass
  // (Gruppe umbenannt oder nicht mehr geholt) und reisst. Fuer die Lampen der Datei gibt der Viewer licht mal
  // Faktor zurueck, fuer alle anderen licht. Nicht geprueft wird hier, dass die Buehne ihre Lampen mit dieser
  // Funktion hebt: Sie nennt die Zahl der gedaempften in ihrer Zeile "… Spiellampen … gesetzt, N gedämpft",
  // und check:hangar-shader haelt sie gegen seine Klinke gedaempft (vorgefuehrt rot im Kopf unter (s)).
  let gedaempft = '', gedaempftN = 0, daempfHeil = true;
  const daempf = Object.entries(FEST[id]?.daempf ?? {});
  if (daempf.length) {
    const staerke = typeof viewer?.hallLampenStaerke === 'function' && typeof viewer?.lampenGruppe === 'function' ? viewer.hallLampenStaerke : null;
    if (!staerke) { daempfHeil = false; fail(`[3] ${id}: der Viewer nennt die Staerke seiner Lampen nicht mehr (hallLampenStaerke, lampenGruppe), HALL_FEST.daempf nennt aber ${daempf.length} Lichtgruppe(n) — ob ihre Lampen gedaempft werden, liesse sich nur raten`); }
    else {
      const licht = FEST[id].licht ?? 1, teile = [];
      for (const [gruppe, f] of daempf) {
        const ihre = lampen.filter((l) => viewer.lampenGruppe(l.name) === gruppe);
        if (!(Number.isFinite(f) && f > 0 && f < 1)) { daempfHeil = false; fail(`[3] ${id}: HALL_FEST.daempf.${gruppe} ist ${JSON.stringify(f)}, erwartet ein Faktor zwischen 0 und 1 — 1 und mehr daempft nicht, 0 und weniger loescht die Lampen der Gruppe`); }
        else if (!ihre.length) { daempfHeil = false; fail(`[3] ${id}: HALL_FEST.daempf nennt die Lichtgruppe ${gruppe}, die ausgelieferte Lampendatei traegt keine Lampe von ihr — die Daempfung hat ihren Anlass verloren (Gruppe umbenannt oder nicht mehr geholt): den Eintrag streichen oder an den neuen Namen anpassen`); }
        else {
          const falsch = ihre.filter((l) => staerke(id, l.name) !== licht * f);
          if (falsch.length) { daempfHeil = false; fail(`[3] ${id}: ${falsch.length} von ${ihre.length} Lampen der Lichtgruppe ${gruppe} bekommen vom Viewer nicht die gedaempfte Staerke (hallLampenStaerke: ${staerke(id, falsch[0].name)} fuer ${falsch[0].name}, erwartet licht ${licht} mal ${f}) — der Boden unter ihnen wuerde wieder ausbrennen`); }
          else { teile.push(`${ihre.length} der Gruppe ${gruppe} auf ${f}`); gedaempftN += ihre.length; }
        }
      }
      const andere = lampen.filter((l) => !Object.hasOwn(FEST[id].daempf, viewer.lampenGruppe(l.name)) && staerke(id, l.name) !== licht);
      if (andere.length) { daempfHeil = false; fail(`[3] ${id}: ${andere.length} Lampen ausserhalb der gedaempften Gruppen bekommen vom Viewer nicht die Staerke der Halle (hallLampenStaerke: ${staerke(id, andere[0].name)} fuer ${andere[0].name}, erwartet licht ${licht})`); }
      gedaempft = teile.join(', ');
    }
  }
  // Klinke: so viele Lampen daempft der Viewer in dieser Halle. Ohne Klinke und ohne Daempfung gibt es nichts zu halten;
  // ist die Daempfung oben schon gerissen, steht ihr Grund dort.
  if (daempfHeil && (daempf.length || K.gedaempft !== undefined) && !(gedaempftN >= K.gedaempft)) fail(K.gedaempft === undefined ? `[3] ${id}: HALL_FEST.daempf nennt ${daempf.length} Lichtgruppe(n), die Halle hat keine Klinke gedaempft (KLINKE) — fiele die Daempfung wieder weg, bliebe das Tor gruen` : `[3] ${id}: der Viewer daempft ${gedaempftN} Lampen der ausgelieferten Datei, Klinke ${K.gedaempft} — Lampen, die wenige Meter ueber ihrem Boden haengen, bekommen wieder die volle Staerke der Halle, der Boden unter ihnen brennt aus (HALL_FEST.daempf im Viewer; in util-lrgtop die Kabinen der Frachtaufzuege)`);
  // Grundlicht und Lampenlicht im selben Gitter: mit den Lampen der ausgelieferten Datei gerechnet, einmal mit
  // und einmal ohne den Namen der Halle. Das Gitter mit beidem ist ueberall die Summe; wo eines das andere
  // ersetzte, fehlte sie. (Die Buehne verschiebt die Lampen im Boden von Feld und Streifen, hebt alle um
  // HALL_FEST.licht und nimmt ihre sechs echten aus; fuer die Summe ist das gleich.)
  const leerG = GITTER.get(id);
  let dazu = null;
  if (leerG && lampen.length) {
    const hall = HALLEN.get(id).hall;
    let mit = null, nur = null;
    try {
      mit = gitterWerte(await viewer.hallGitter(lampen, hall, hall.floor), DataUtils.fromHalfFloat);
      nur = gitterWerte(await viewer.hallGitter(lampen, { room: hall.room }, hall.floor), DataUtils.fromHalfFloat);
    } catch (e) { fail(`[3] ${id}: das Lichtgitter laesst sich mit den Lampen der ausgelieferten Datei nicht rechnen (hallGitter: ${e.message})`); }
    const D = mit && nur ? gitterDazu(mit, nur, leerG) : null;
    if (!D) fail(`[3] ${id}: hallGitter liefert mit den Lampen der ausgelieferten Datei kein Gitter in der Groesse des leeren (${leerG.res.join(' x ')})`);
    else if (!(mit.used > 0 && mit.used === nur.used)) fail(`[3] ${id}: von ${lampen.length} Lampen stehen ${mit.used ?? 'keine'} im Gitter mit Grundlicht und ${nur.used ?? 'keine'} im Gitter ohne — erwartet in beiden dieselben und mehr als keine`);
    else if (!D.staerker) fail(`[3] ${id}: an keiner Stelle des Gitters haben die ${mit.used} Lampen mehr Licht als das Grundlicht — ob es ihr Licht ersetzt, laesst sich so nicht pruefen (die Staerken der Lampendatei oder HALL_FEST.grund stimmen nicht)`);
    else if (D.abweichend) fail(`[3] ${id}: Lampenlicht und Grundlicht stehen nicht zusammen im Lichtgitter: An ${D.abweichend} von ${D.werte} Werten ist das Gitter mit beidem nicht ihre Summe (zuerst ${D.erstes.was}: ${+D.erstes.mit.toFixed(4)} statt ${+D.erstes.nur.toFixed(4)} der Lampen plus ${+D.erstes.leer.toFixed(4)} Grundlicht) — eines ersetzt oder daempft das andere, die Halle stuende flacher oder dunkler als abgenommen`);
    else dazu = `im Lichtgitter ${mit.used} davon, an ${D.staerker} von ${D.werte} Werten staerker als das Grundlicht, ueberall kommt es dazu`;
  }
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
  zeilen.push(`    ${id}: ${schrift} Dreiecke Schrift (Klinke ${K.schriftTris}), ${aus} Schirme ohne Bild aus mit ${ausTris} Dreiecken (Klinke ${K.schirmTris}), 0 hell; ${lampenRoh?.length ?? 0} Lampen in der ausgelieferten Datei, davon setzt die Buehne ${ist.lampen}${dazu ? ` (${dazu})` : ''}${gedaempft ? `, gedaempft ${gedaempft} (Klinke ${K.gedaempft})` : ''}${flaechen !== null ? `, ${flaechen} Flaechenlichter entlang ihrer eigenen Achse (Klinke ${K.flaechen})` : ''}${ruhe ? `, ${ruhe.weg} in Ruhe dunkle Lampen weggelassen (${ruhe.namen} Namen in ${ruhe.gruppen} Lichtgruppen, Klinke ${K.ruhe})` : ''}, Bodentor ${ist.tor} Teile, ${ist.schirme} Schirme vom Build ausgeschaltet, ${ist.tafeln} Tafeln mit Logo, ${ist.aufkleber} Netze mit Aufklebern, ${ist.schilder} Schilder aus der vollen Stufe, ${ist.kinder} Kind-Container eingehaengt; ${M.tris} Dreiecke, ${(bytes / 1e6).toFixed(1)} MB, ${M.textures} Texturen, ${M.hull?.pct} % ins Leere`);
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
