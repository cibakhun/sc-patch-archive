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
       wie Seite und Manifest sagen; jede mit dem Gerätesatz des
       Wartungsplatzes am Schiff (dienst), den der Viewer für sie nimmt
       (dienstSatz)
   [2] Modell: der Boden der Seite ist der, den das Lot am ausgelieferten
       Modell trifft; die Plattform liegt auf dieser Höhe; Landefläche,
       Feld des Aufzugs und Raum liegen ineinander; jede Bahn hat ihren
       Knoten, und offen liegt kein Teil des Tors über dem Feld (ein Flügel,
       der falsch herum fährt: so am rechten der Medium-Halle, solange der
       Build die Drehung seines Halters nicht mitrechnete; offenImFeld in
       scripts/lib/aufzug-dreh.mjs); die Halle hat ihr Grundlicht (hallGrund, Klinke je Halle),
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
   [5] Deko: die Arbeitsszenen einer Halle fester Größe (WORK_DEKO_FEST
       im Viewer). Diese Hallen messen im Browser keinen Grundriss (bei
       1,8 Mio. Dreiecken kostete er Ladezeit), die Bühne stellt jedes
       Stück so hin, wie der Block es nennt. Darum hier am ausgelieferten
       Modell, mit der Rechnung des Viewers (dekoGlieder) und
       scripts/lib/hall-deko.mjs: Der Block ist der Plan, den die Bühne
       für die Halle nimmt (dekoPlan), die Seite gibt ihr den Satz mit;
       jede Zone nennt Stufe, Wand, Bezugspunkt und eine Herkunft aus dem
       Katalog; jeder Knoten steht mit Geometrie im Satz; kein Stück im
       Feld des Aufzugs oder näher als 1 m daran, keines in einem
       anderen, keines schwebt, keines vor einem Fahrzeug in dessen
       Fahrspur; keines steckt in der Halle (Dreiecke des Modells gegen
       den Quader des Stücks, ohne die fahrenden Teile des Aufzugs), und
       unter jedem, das am Boden steht, liegt Boden. Gegenprobe im selben
       Lauf: Am Bezugspunkt jeder Zone (er liegt auf ihrer Wand) trifft
       dieselbe Messung die Halle; täte sie es nirgends, liefe sie leer.
       Klinken und Obergrenzen je Halle (KLINKE_DEKO, OBERGRENZE_DEKO)
   [6] Ankunft (22.11.2026, Hangar-Politur): Die Ladeszene zeigt beim
       ersten Laden und beim Hallenwechsel ein Standbild der Halle, in die
       das Schiff kommt (ankunftAn in hangar-overview.js). Fehlt es, steht
       sie vor leerem Grund, und niemand merkt es, bis er hinsieht. Je
       ausgelieferter Halle fester Größe und für die Werkhalle ('werk',
       sobald ein Fahrzeug dort steht) nennen beide Seiten dasselbe Bild,
       es liegt als WebP in dist/, seine Version ist die seines Inhalts,
       und es bleibt unter ANKUNFT_MAX; Klinke MIN_ANKUNFT. Ein Bild ohne
       ausgelieferte Halle ist nur eine WARNUNG. Neue Bilder:
       scripts/build-hangar-ankunft.mjs

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
   (v) 18.11.2026, das Bodentor offen neben dem Feld (offenImFeld aus
       scripts/lib/aufzug-dreh.mjs): Die Bahnen der rechten Torflügel der
       Medium-Halle fuhren, als die Hallen S, M und XL dazukamen, nach
       innen, weil ihr Halter im Spiel um 180° gedreht steht; im Bild lag
       das Schiff auf ihnen. An einer Kopie von dist/ (alles verlinkt, nur
       die geänderte Datei kopiert) die Bahnen der fünf rechten Flügel
       gespiegelt, 1 FEHLER: „[2] util-medtop: offen liegen 5 Teile des
       Tors ueber dem Feld des Aufzugs (aufzug_tor_02 2.18 x 88 m,
       aufzug_tor_03 6 x 88 m, aufzug_tor_04 6 x 88 m, aufzug_tor_05 6 x
       88 m) — sie fahren falsch herum, das Schiff stuende auf ihnen;
       Bahnen aus scripts/lib/aufzug-dreh.mjs neu bauen“.
       Die Riegel am Tor der XL-Halle, die um ihren Knochen schwenken,
       rechnet dieselbe Regel mit Drehung um den Drehpunkt; das hält
       tests/e2e/aufzug-dreh.test.js an einem kleinen Tor (ein Riegel,
       der offen ins Feld schwenkt, wird genannt, einer, der hinaus
       schwenkt, nicht; der Flügel falsch herum wird genannt), und der Build bricht dort ab, wo eine Bahn
       nicht zur Ruhelage des Knotenbaums passt.
       Nach dem Review von CodeRabbit an PR #389 fallen unvollständige
       Teile nicht mehr still aus der Probe: Jedes Teil braucht, was
       ownLift im Viewer verlangt (box, je Richtung zwei Schlüssel), ein
       Teil mit Drehdaten dazu keysRot mit zwei Schlüsseln je Richtung und
       einen Drehpunkt. Zweimal an einer Kopie von dist/ gebrochen:
       box des ersten Torteils der Medium-Halle gelöscht, 1 FEHLER: „[2]
       util-medtop: 1 Teil(e) des Bodentors unvollstaendig (aufzug_tor_00:
       ohne box) — der Viewer baute den Aufzug nicht oder zoege einen
       Riegel ohne Schwenk; Bahnen neu bauen“;
       am ersten Riegel der XL-Halle nur der letzte Schlüssel von
       keysRot.open behalten, 1 FEHLER: „[2] util-xltop: 1 Teil(e) des
       Bodentors unvollstaendig (aufzug_tor_34: keysRot.open mit 1
       Schluessel(n)) — …“.
       Zweite Runde desselben Reviews: Jeder Schlüssel muss aus endlichen
       Zahlen bestehen (vier in keys, fünf in keysRot mit einer Drehung,
       die nicht aus lauter Nullen ist), und das Feld des Aufzugs aus zwei
       Ecken zu je zwei Zahlen mit from kleiner als to; sonst ergaben
       Mitte und Überdeckung NaN, und kein Vergleich schlug an. Viermal an
       einer Kopie von dist/ gebrochen, je 1 FEHLER:
       an die Öffnungsbahn des ersten Torteils der Medium-Halle ein
       Schlüssel [1] gehängt: „[2] util-medtop: 1 Teil(e) des Bodentors
       unvollstaendig (aufzug_tor_00: keys.open[61] ist kein Schluessel
       aus 4 Zahlen) — …“;
       am ersten Riegel der XL-Halle ein Schlüssel von keysRot.open mit
       der Drehung 0,0,0,0: „[2] util-xltop: 1 Teil(e) des Bodentors
       unvollstaendig (aufzug_tor_34: keysRot.open[3] ist kein Schluessel
       aus 5 Zahlen mit einer Drehung) — …“;
       feld.from der Small-Halle leer: „[2] util-smltop: die Bahnen nennen
       das Feld des Aufzugs nicht als zwei Ecken aus je zwei Zahlen (feld
       {"from":[],"to":[66,72]})“;
       from und to der Large-Halle vertauscht: „[2] util-lrgtop: das Feld
       des Aufzugs ist leer oder verkehrt herum (from -28.001, 192, to
       -116, 32)“.
   (w) 18.11.2026, der Wartungsplatz am Schiff in jeder Halle fester
       Größe (dienstSatz im Viewer, dienst in der Zeile der Seite). Krisz:
       „die assets wieder um die schiffe herum platzieren in den neuen
       hallen“; seit PR #371 stand dort kein Gerät mehr. Viermal an einer
       Kopie von dist/ gebrochen:
       dienst der Medium-Halle aus beiden Seiten genommen, 2 FEHLER: „[1]
       util-medtop: die Seite nennt keinen Geraetesatz fuer den
       Wartungsplatz am Schiff (dienst) — in dieser Halle stuende kein
       Geraet um das Schiff“ und „[1] nur 3 Halle(n) fester Groesse mit
       dem Geraetesatz des Wartungsplatzes, Klinke 4“;
       der Viewer exportiert dienstSatz nicht mehr, 1 FEHLER: „[1] der
       Viewer nennt nicht mehr, welchen Geraetesatz eine Halle fuer den
       Wartungsplatz am Schiff nimmt (dienstSatz) — ob in den Hallen
       fester Groesse Geraet am Schiff steht, liesse sich nur raten“;
       der Viewer nimmt auch für Hallen fester Größe nur den Satz der
       Werkstatt (wie vor diesem Tag), 5 FEHLER, je Halle „[1]
       util-smltop: die Seite nennt den Geraetesatz, der Viewer nimmt
       fuer diese Halle aber keinen (dienstSatz) — der Wartungsplatz
       bliebe leer“ und „[1] nur 0 Halle(n) fester Groesse mit dem
       Geraetesatz des Wartungsplatzes, Klinke 4“;
       die Seite nennt für die XL-Halle eine Datei, die dist/ nicht hat,
       2 FEHLER: „[1] util-xltop: der Geraetesatz des Wartungsplatzes
       (/hangar/props/dienst-fehlt.glb) fehlt in dist/ — in dieser Halle
       stuende kein Geraet um das Schiff“ und die Klinke wie oben.
       Nicht hier geprüft: ob die Geräte dann auch am Schiff stehen. Das
       zählt check:hangar-shader im Browser (Klinke plaetze je Halle in
       KLINKE_FEST, dort vorgeführt rot).
       Die Klinken und Obergrenzen der neuen Hallen laufen durch dieselben
       Zeilen wie die der Large-Halle; an einer Kopie des Tors je eine
       verschoben (Tor der XL-Halle 39 statt 38, Dreiecke der Small-Halle
       höchstens 900000), 2 FEHLER: „[3] util-smltop: 929357 Dreiecke,
       Obergrenze 900000 — die Halle ist schwerer oder offener geworden“
       und „[3] util-xltop: 38 Teile des Bodentors, Klinke 39“.
   (x) 18.11.2026, Hauptstrahler und Lampenlicht im Gitter
       (HALL_FEST.strahler, HALL_FEST.gitter; Krisz: „wie man das auf dem
       nbild sieht ist die beleuchtung super kacke“): Die sechs Fluter
       über der Landefläche strahlten türkis und von beiden Seiten gleich
       stark, die Wände standen im gleichmäßigen Grundlicht. Vierzehnmal
       am ausgelieferten Viewer gebrochen und zweimal an einer Kopie des
       Tors, je 1 FEHLER:
       der Eintrag strahler fehlt: „[3] util-lrgtop: die Halle hat eine
       Klinke strahler (6), HALL_FEST nennt fuer sie keine Hauptstrahler
       mehr — ihre Fluter strahlten wieder in der Farbe des Spiels und
       von beiden Seiten gleich stark (Krisz, 18.11.2026: „die
       beleuchtung [ist] super kacke“)“;
       weiss 1,5: „[3] util-lrgtop: HALL_FEST.strahler ist
       {"ab":300,"weiss":1.5,"seiten":[1,0.5]}, erwartet ab ueber null
       (Spielstaerke), weiss von 0 bis 1 und seiten aus zwei Faktoren
       ueber null bis 2 (+x, -x)“;
       hallStrahler ohne export: „[3] util-lrgtop: der Viewer nennt seine
       Hauptstrahler nicht mehr (hallStrahler), HALL_FEST.strahler stellt
       aber welche — ob er sie stellt, liesse sich nur raten“;
       ab 700 (über jeder Lampe der Datei): „[3] util-lrgtop:
       HALL_FEST.strahler stellt Lampen ab der Staerke 700, die
       ausgelieferte Lampendatei traegt davon 0 auf der Seite +x der
       Landeflaeche und 0 auf -x — die Einstellung hat ihren Anlass
       verloren (die Datei nennt die Staerke ihrer Fluter anders, oder
       sie fehlen): ab anpassen oder den Eintrag streichen“;
       hallStrahler übergeht die Seite: „[3] util-lrgtop: 3 von 6
       Hauptstrahlern stellt der Viewer nicht, wie HALL_FEST.strahler es
       nennt (hallStrahler fuer lg_hangar_lrgtop-343 bei x -115.638:
       Staerke mal 1, Farbe [0.832,0.981,0.988], erwartet mal 0.5 und
       [0.832,0.981,0.988]) — das Schiff stuende wieder farbstichig oder
       von beiden Seiten gleich hell da“;
       hallStrahler mischt die Farbe nicht: dieselbe Meldung mit „6 von
       6“, „Farbe [0.521,0.947,0.965], erwartet mal 1 und
       [0.832,0.981,0.988]“;
       hallStrahler übergeht die Schwelle: „[3] util-lrgtop: der Viewer
       stellt 864 Lampen unter der Staerke 300 als Hauptstrahler (zuerst
       lg_hangar_lrgtop-000 mit 5) — Wandleuchten bekaemen die Farbe und
       den Faktor der Fluter“;
       die Schleife der Bühne ohne den Faktor (… * (s?.staerke ?? 1)
       gestrichen), und getrennt davon die Rangfolge ohne die
       Hauptstrahler zuerst: beide Male „[3] util-lrgtop: die Buehne des
       ausgelieferten Viewers stellt ihre Lampen nicht mehr mit
       hallStrahler, bevor sie Rangfolge und Gitter rechnet (…) — die
       Regel stuende im Viewer, ohne dass eine Lampe sie bekommt“;
       gitter 0: „[3] util-lrgtop: HALL_FEST.gitter ist 0, erwartet ein
       Faktor ueber null“;
       hallGitterLampen ohne export: „[3] util-lrgtop: der Viewer hebt das
       Lampenlicht seines Gitters nicht mehr (hallGitterLampen),
       HALL_FEST.gitter nennt aber 3 — die Waende stuenden wieder im
       gleichmaessigen Grundlicht, ohne dass man sieht, woher ihr Licht
       kommt“;
       hallGitterLampen hebt auch die Hauptstrahler: „[3] util-lrgtop:
       hallGitterLampen hebt die Lampen nicht, wie HALL_FEST.gitter es
       nennt (aus Staerke 2 und einem Hauptstrahler mit 5 wird [6,15],
       erwartet [6, 5])“;
       hallGitterLampen ändert die übergebene Liste: dieselbe Meldung mit
       „wird [6,5], erwartet [6, 5]; die uebergebene Liste ist danach
       veraendert“ (die Bühne zählt danach ihre gedämpften Lampen an
       derselben Liste);
       die Bühne reicht ihrem Gitter die Lampen ohne hallGitterLampen:
       „[3] util-lrgtop: die Buehne des ausgelieferten Viewers reicht
       ihrem Lichtgitter die Lampen nicht durch hallGitterLampen (…) —
       HALL_FEST.gitter 3 kaeme bei den Waenden nicht an“;
       die Klinke strahler um eins über dem Bestand (Kopie des Tors): „[3]
       util-lrgtop: der Viewer stellt 6 Hauptstrahler der ausgelieferten
       Datei, Klinke 7 — ein Teil der Fluter strahlt wieder in der Farbe
       des Spiels und mit voller Staerke“;
       die Halle ohne Klinke strahler (Kopie des Tors): „[3] util-lrgtop:
       HALL_FEST.strahler stellt 6 Hauptstrahler, die Halle hat keine
       Klinke strahler (KLINKE) — fiele die Einstellung wieder weg,
       bliebe das Tor gruen“.
       Nicht hier geprüft: ob die Halle damit gut aussieht. Das ist ein
       Sichturteil (.planning/WINDOWS.md). Dass die Schwelle nur die
       Fluter trifft, hält tests/e2e/hall-lampen.test.js an der
       Lampendatei (die stärkste übrige Lampe liegt unter der halben
       Schwelle), dort sechsmal vorgeführt rot. Dass die Bühne im Browser
       wirklich sechs stellt, hält check:hangar-shader gegen seine Klinke
       strahler.
   (xi) 20.11.2026, Hauptstrahler der XL-Halle mit bis und mal
       (HALL_FEST.strahler; Krisz: „Alles beheben“ zu den Bildern vom PC
       vom 19.11.2026, die Polaris stand in der XL-Halle fast schwarz):
       Die Fluter über den Längsseiten hängen dort 105 m hoch und 146 m
       von der Mitte des Felds; bis 1000 lässt die vier Strahler der
       Stirnwände gewöhnliche Lampen bleiben, mal 12 hebt die Fluter.
       Viermal am ausgelieferten Viewer gebrochen und einmal an einer
       Kopie des Tors, je 1 FEHLER:
       hallStrahler übergeht bis: „[3] util-xltop: der Viewer stellt 4
       Lampen ausserhalb der Staerke 300 bis unter 1000 als
       Hauptstrahler (zuerst Light-123512 mit 1000) — die Strahler
       darueber bekaemen Farbe und Faktor der Fluter, mit dem Faktor mal
       einen gleissenden Fleck am Boden“;
       hallStrahler übergeht mal: „[3] util-xltop: 4 von 4
       Hauptstrahlern stellt der Viewer nicht, wie HALL_FEST.strahler es
       nennt (hallStrahler fuer lg_hangar_xltop-372 bei x -10.965:
       Staerke mal 1, …, erwartet mal 12 …)“;
       mal 25 (über MAL_MAX) und bis 300 (nicht über ab): beide Male
       „[3] util-xltop: HALL_FEST.strahler ist {…}, erwartet ab ueber
       null (Spielstaerke), bis (wenn es steht) ueber ab, …, und mal
       (wenn es steht) ueber null bis 20“;
       die XL-Halle ohne Klinke strahler (Kopie des Tors): „[3]
       util-xltop: HALL_FEST.strahler stellt 4 Hauptstrahler, die Halle
       hat keine Klinke strahler (KLINKE) — fiele die Einstellung wieder
       weg, bliebe das Tor gruen“.
       Dieselben Brüche in tests/e2e/hall-lampen.test.js, viermal rot:
       bis übergangen („util-xltop: ab bis (1000) ist eine Lampe kein
       Hauptstrahler“ und „der stärkste Hauptstrahler hat 1000, bis ist
       1000“), mal übergangen („eine Lampe auf der Seite +x bekommt den
       ersten Faktor (mal 12)“, 1 statt 12), bis 2000 („bis 2000 nimmt
       keine Lampe der Datei aus: eine Ausnahme ohne Anlass“), mal 0
       („strahler.mal ist 0, erwartet ein Faktor über null“).
       Nicht hier geprüft: ob die Polaris damit gut aussieht
       (.planning/WINDOWS.md), und dass die Bühne im Browser vier
       Hauptstrahler stellt (check:hangar-shader, Klinke strahler in
       KLINKE_FEST).
   (xii) 24.11.2026, Hauptstrahler auch in Small und Medium (Krisz auf
       die Frage, ob das Licht der Large-Halle passt: „Schau doch
       selber“; beim Urteil an Bildern vom PC gefunden: Dieselben
       türkisen Fluter färbten dort Lack und Deck von 300i, 400i und
       Cutlass Black). HALL_FEST.strahler mit den Werten der Large-Halle,
       Klinke strahler 2 (Small) und 4 (Medium). Am Vorschau-Bau des
       Commits „Hangar: Licht der Large-Halle auch in Small und Medium“
       (gebaut als b630d6c0, bevor er auf den neuesten staging-Stand
       gesetzt wurde; derselbe Viewer) auf dem PC dreimal rot, je 1 FEHLER, danach
       zurückgestellt (Läufer .cache/licht/rot.ps1, nicht im Repo):
       util-smltop ohne strahler im ausgelieferten Viewer: „[3]
       util-smltop: die Halle hat eine Klinke strahler (2), HALL_FEST
       nennt fuer sie keine Hauptstrahler mehr — ihre Fluter strahlten
       wieder in der Farbe des Spiels …“; util-medtop ohne strahler:
       dasselbe für util-medtop mit „(4)“; eine Kopie des Tors ohne die
       Klinke strahler von util-smltop: „[3] util-smltop:
       HALL_FEST.strahler stellt 2 Hauptstrahler, die Halle hat keine
       Klinke strahler (KLINKE) — fiele die Einstellung wieder weg,
       bliebe das Tor gruen“. Ohne Eingriff grün: „2 Hauptstrahler ab
       Staerke 300 (1 auf +x mal 1, 1 auf -x mal 0.5, Anteil Weiss 0.65;
       Klinke 2)“ und „4 Hauptstrahler ab Staerke 300 (2 auf +x mal 1, 2
       auf -x mal 0.5, …; Klinke 4)“. Dass die Bühne sie im Browser
       stellt, hält check:hangar-shader (dort unter HAUPTSTRAHLER).
   (y) 21.11.2026, die Arbeitsszenen der Large-Halle ([5]; Krisz auf
       der Karte vom 15.11.2026: „Alle vier einbauen“). Einundzwanzig
       Eingriffe in den ausgelieferten Viewer (Block WORK_DEKO_FEST,
       dekoPlan), in beide Hangarseiten oder in eine Kopie des Tors,
       jeder rot, der Lauf danach grün (Läufer .cache/rot5.mjs, nicht im
       Repo):
       ein Container 0,6 m in die Kabinenwand: „… 1 Stuecke stecken in
       der Halle (fracht-west fracht_hurston_freight_container_a …: 386
       Dreiecke der Halle)“ und „… stehen nicht auf dem Boden ihrer Zone
       (… 9 von 25 Messpunkten …)“;
       die Schlauchtrommel ins Feld des Aufzugs: „… stehen im Feld des
       Aufzugs oder naeher als 1 m daran …“, dazu ineinander und ohne
       Boden;
       ein zweiter Container 0,3 m neben dem ersten: „… 1 Paare von
       Stuecken stecken ineinander …“;
       ein gestapeltes Stück 0,5 m höher: „… 1 Stuecke schweben (… auf
       3.26 m) …“;
       eine Kiste 4 m vor den Stapler: „… stehen vor einem Fahrzeug in
       seiner Fahrspur von 8 m …“;
       boden 0,5 für die Gasse der Betankung: „… 10 Stuecke stehen nicht
       auf dem Boden ihrer Zone …“;
       deko aus halls der Seiten genommen: „… die Seite gibt der Halle
       den Satz der Hallendeko nicht mit (halls.L.deko) …“;
       dekoPlan gibt für feste Hallen keinen Plan: „… die Buehne nimmt
       fuer diese Halle keinen Plan, der Block WORK_DEKO_FEST nennt aber
       einen (dekoPlan) …“;
       ein Knoten, den der Satz nicht trägt: „… der Satz traegt 1 Knoten
       nicht oder ohne Geometrie …“;
       aus „munition+treibstoff“: „… ist weder ein Arbeitsplatz noch
       eine Kategorie noch eine Zone des Katalogs …“;
       die Messung erst ab 60 m über dem Boden (Kopie des Tors): „… 0
       Zonen, hinter deren Bezugspunkt die Messung die Wand der Halle
       trifft …, Klinke 5“;
       die Zone der Wartung entfernt: „… 4 Zonen, Klinke 5“, „… 100
       Stuecke, Klinke 119“ und die Gegenprobe 4 von 5;
       Obergrenzen 400.000 und 300.000 (Kopie): „… 466070 Dreiecke Deko,
       Obergrenze 400000 …“ und „… 339085 … auf der mittleren Stufe,
       Obergrenze 300000 …“;
       der Block umbenannt: „[5] der ausgelieferte Viewer traegt keinen
       Block work-deko-fest …“ (in der Meldung mit seinen
       Kommentarzeichen);
       der Block leer: „… KLINKE_DEKO haelt Arbeitsszenen fuer diese
       Halle, WORK_DEKO_FEST nennt sie nicht mehr …“;
       spuren in einer Zone: „… spuren prueft dieses Tor nicht …“;
       eine Halle, die HALL_FEST nicht kennt: „… WORK_DEKO_FEST nennt die
       Halle, HALL_FEST kennt sie nicht …“;
       die Halle ohne Klinke (Kopie): „… die Halle traegt
       Arbeitsszenen, hat aber keine Klinke (KLINKE_DEKO) …“;
       stufe niedrig: „… stufe niedrig ist weder mittel noch hoch …“;
       der Block kein JSON mehr: „[5] WORK_DEKO_FEST im ausgelieferten
       Viewer ist kein JSON mehr …“;
       der Block null (nach dem Review von CodeRabbit): „[5]
       WORK_DEKO_FEST ist keine Liste { Halle: { zonen } }, sondern
       null“. Die erste Fassung meldete hier „keine Halle fester Groesse
       traegt Arbeitsszenen, nichts zu messen“ und blieb grün.
       Ebenso aus dem Review: Was auf einem anderen Stück liegt, braucht
       darunter nach oben zeigende Dreiecke. Die erste Fassung ließ
       Oberkante und Mitte in der Hülle genügen, und eine Kiste über
       einem offenen Rahmen galt als getragen (vorgeführt in
       tests/e2e/hall-deko.test.js, gegen die alte Fassung rot). Mit der
       Regel bleiben alle 45 gestapelten Stücke getragen, und das um
       0,5 m gehobene meldet weiter „… schweben …“.
       Nicht hier geprüft: ob die Szenen gut aussehen (.planning/
       WINDOWS.md #185), und dass die Bühne im Browser alle 119 Stücke
       stellt (check:hangar-shader, Klinke szenen in KLINKE_FEST, dort
       viermal vorgeführt rot).
   (z) 23.11.2026, die Ankunftsbilder ([6]) im Cloud-Rechner gegen den
       Vorschau-Bau, jede Gegenprobe in dist/ und danach zurückgestellt:
       util-xltop.webp gelöscht, werk.webp durch das Bild der Medium-Halle
       ersetzt und in de/hangar.html die Version von util-smltop um eine
       Stelle geändert, 4 FEHLER: „[6] hangar.html und de/hangar.html
       nennen verschiedene Ankunftsbilder …“, „[6] util-xltop:
       /hangar/ankunft/util-xltop.webp?v=66e44123 fehlt in dist/ …“, „[6]
       werk: … traegt die Version 5a61ec87, der Inhalt 2713c2b9 …“, „[6]
       nur 3 Ankunftsbild(er) in Ordnung, Klinke 5“; dazu `ankunft` aus
       beiden Seiten gestrichen, 6 FEHLER: je Halle „[6] util-smltop: kein
       Ankunftsbild (StageConfig ankunft) …“ und „[6] nur 0 … Klinke 5“.
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
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { floorLevel } from './lib/hall-hull.mjs';
import { offenImFeld } from './lib/aufzug-dreh.mjs';
import { SCHRIFT, SCHIRM_AUS } from './lib/hall-decals.mjs';
import { lampenName } from './lib/hall-ruhe.mjs';
import { ecken, knotenFlaechen, pruefeLage, hallenRaster, hallImQuader, bodenUnter, LOSE_LEITUNG } from './lib/hall-deko.mjs';
import { DataUtils } from 'three';
import { gitterWerte, grundImGitter, gitterLicht, gitterDazu, gitterAufrufe, gitterDunkelste } from './lib/hall-gitter.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const STUFEN = ['S', 'M', 'L', 'XL'];

// Klinken (Grundsatz 5: nur nach oben; nach unten per Commit mit Ursache)
// [6] Ankunftsbilder: vier Hallen und die Werkhalle (22.11.2026); Obergrenze je Bild in Bytes
const MIN_ANKUNFT = 5, ANKUNFT_MAX = 100 * 1024;
const MIN_HALLEN = 4; // ausgelieferte Hallen fester Größe (14.11.2026: 1, die Large-Halle; 18.11.2026: 4, dazu Small, Medium und XL)
const MIN_DIENST = 4; // davon mit dem Gerätesatz des Wartungsplatzes am Schiff (18.11.2026: alle vier)
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
// strahler: Hauptstrahler der ausgelieferten Datei, die der Viewer stellt (HALL_FEST.strahler, hallStrahler): in
// util-lrgtop die sechs Fluter unter der Decke (Stärke 600, drei über jeder Längsseite der Landefläche). Krisz am
// 18.11.2026 zur ausgelieferten Halle: „die beleuchtung [ist] super kacke“; sie strahlten türkis und von beiden
// Seiten gleich stark, das Schiff stand farbstichig und ohne Form da. Eine Halle ohne diese Klinke stellt keine;
// nennt HALL_FEST für sie doch welche, reißt das Tor.
// In util-xltop (20.11.2026) die vier Fluter über den Längsseiten (je 300, 105 m über dem Boden), mit bis 1000
// ohne die vier Strahler der Stirnwände und mit mal 12 so stark, dass aufs Schiff so viel Licht kommt wie in der
// Large-Halle; ohne sie stand die Polaris dort fast schwarz (Aufnahme vom PC, 19.11.2026).
// In util-smltop und util-medtop (24.11.2026) die Fluter über der Landefläche mit denselben Werten wie in
// Large (Small zwei je 300, Medium vier je 600, je zur Hälfte auf beiden Seiten): Sie färbten dort Lack und Deck
// türkis (Origin 300i, 400i und Cutlass Black am Bild vom PC). Krisz am 24.11.2026 zum Licht der Large-Halle:
// „Schau doch selber“.
// MAL_MAX: höchster Faktor mal; darüber brennt jeder Lack aus, auch im Abstand der XL-Halle.
const MAL_MAX = 20;
const KLINKE = {
  'util-lrgtop': { lampen: 870, tor: 18, schriftTris: 2337, schirmTris: 244, schirme: 13, tafeln: 9, aufkleber: 151, schilder: 5, kinder: 14, grund: 3, gedaempft: 114, flaechen: 58, ruhe: 86, strahler: 6 },
  // Small, Medium und XL (18.11.2026), gemessen am Vorschau-Bau mit ihren Modellen; dieselben Regeln wie Large.
  // Gedämpft sind auch dort die Lampen der Kabinen ihrer Frachtaufzüge (Small 1 Aufzug, Medium und XL je 2).
  'util-smltop': { lampen: 379, tor: 26, schriftTris: 1324, schirmTris: 190, schirme: 12, tafeln: 4, aufkleber: 92, schilder: 4, kinder: 7, grund: 3, gedaempft: 28, flaechen: 29, ruhe: 57, strahler: 2 },
  'util-medtop': { lampen: 653, tor: 12, schriftTris: 1893, schirmTris: 248, schirme: 13, tafeln: 9, aufkleber: 144, schilder: 5, kinder: 9, grund: 3, gedaempft: 86, flaechen: 52, ruhe: 75, strahler: 4 },
  'util-xltop': { lampen: 1339, tor: 38, schriftTris: 4348, schirmTris: 422, schirme: 13, tafeln: 12, aufkleber: 159, schilder: 5, kinder: 26, grund: 3, gedaempft: 126, flaechen: 107, ruhe: 162, strahler: 4 },
};
// Dreiecke und Bytes des Modells, Texturen, Anteil der Blickstrahlen, die ins Leere gehen (%).
// util-lrgtop: 1,70 Mio. Dreiecke galten für die Halle ohne ihre Frachtaufzüge (1 551 505); mit beiden sind es
// 1 783 379, mit den zehn Türen und ihren Aufdrucken 1 815 431 (22,8 MB, 263 Texturen). Ohne die Frachtaufzüge
// gingen 1,27 % der Strahlen ins Leere (zwei Löcher von 48 × 32 m in den Längswänden), mit ihnen 0,01 %: Die
// Grenze 0,3 % hält die Hülle geschlossen.
const OBERGRENZE = {
  'util-lrgtop': { tris: 1850000, bytes: 24e6, texturen: 270, leck: 0.3 },
  // 18.11.2026 gemessen: Small 929 357 Dreiecke, 16,1 MB, 245 Texturen, 0,16 % ins Leere; Medium 1 334 693, 19,1 MB,
  // 250, 0,02 %; XL 3 514 537, 35,7 MB, 258, 0,06 %. Die XL liegt über der Warnschwelle des Builds (1,6 Mio., nicht
  // dezimiert): Sie ist doppelt so lang wie Large und trägt zwei Kontrollräume, zwei Frachtaufzüge und 20 Türen.
  'util-smltop': { tris: 950000, bytes: 17e6, texturen: 252, leck: 0.3 },
  'util-medtop': { tris: 1360000, bytes: 20e6, texturen: 257, leck: 0.3 },
  'util-xltop': { tris: 3550000, bytes: 37e6, texturen: 265, leck: 0.3 },
};
// Arbeitsszenen je Halle (WORK_DEKO_FEST im Viewer, [5]): Zonen, Stücke, davon auf der mittleren Stufe (der
// Rest steht erst auf der hohen), Fahrzeuge mit freier Fahrspur, und Zonen, an deren Bezugspunkt die Messung
// gegen das Modell die Wand trifft (anWand, die Gegenprobe: 0 hieße, sie liefe leer).
// util-lrgtop, 15.11.2026: ankommende Fracht im westlichen Frachtaufzug, Treibstoff und Munition im östlichen,
// eine Betankung in der Westgasse, eine Wartung in der Ostgasse.
const KLINKE_DEKO = {
  'util-lrgtop': { zonen: 5, stuecke: 119, mittel: 84, fahrzeuge: 2, anWand: 5 },
};
// Dreiecke der Deko, alle und auf der mittleren Stufe. Die Halle selbst trägt 1,8 Mio.; Krisz am 13.11.2026:
// „braucht viel zu viele Ressourcen“. util-lrgtop steht bei 466 070 und 339 085.
const OBERGRENZE_DEKO = {
  'util-lrgtop': { tris: 480000, trisMittel: 350000 },
};
// Abstand zum Feld des Aufzugs (m); Fahrspur vor einem Fahrzeug (Länge und Rand, m); was ein Fahrzeug ist;
// ab dieser Höhe über dem Boden der Zone zählt Halle im Quader eines Stücks (darunter liegen Bodenleisten und
// Kabelrinnen); Boden unter einem Stück: Messpunkte, die Boden auf ± tol treffen, wenigstens dieser Anteil
// (die Kabelrinnen im Boden der Large-Halle liegen 8 bis 10 cm tief, einzelne Fugen haben keinen Boden).
const DEKO_ABSTAND = 1, DEKO_SPUR = { laenge: 8, rand: 0.3 }, DEKO_FAHRZEUG = /^prop_fahrzeug_|_forklift_/;
const DEKO_BAND = 0.15, DEKO_BODEN = { tol: 0.12, anteil: 0.6 };
// Gegenprobe: Quader vom Bezugspunkt einer Zone zur Wand hin, in dem die Messung die Halle treffen muss (m)
const DEKO_PROBE = { breite: 1, tiefe: 6 };
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
// Wartungsplatz am Schiff (WORK_DIENST, layDienst im Viewer): Jede Halle fester Groesse nennt den Geraetesatz in
// ihrer Zeile (dienst), er liegt so gross in dist/, wie die Seite sagt, und der Viewer nimmt ihn fuer sie
// (dienstSatz). Krisz am 18.11.2026: „die assets wieder um die schiffe herum platzieren in den neuen hallen“; seit
// die Stufen ihre eigenen Hallen haben (PR #371), stand dort kein Geraet mehr am Schiff. Ob die Plaetze an einem
// Schiff wirklich stehen, sagt die laufende Buehne (Zeile "[hangar] Wartungsplatz bei", check:hangar-shader).
const satz = typeof viewer?.dienstSatz === 'function' ? viewer.dienstSatz : null;
let mitDienst = 0;
if (HALLEN.size && !satz) fail('[1] der Viewer nennt nicht mehr, welchen Geraetesatz eine Halle fuer den Wartungsplatz am Schiff nimmt (dienstSatz) — ob in den Hallen fester Groesse Geraet am Schiff steht, liesse sich nur raten');
for (const [id, { hall }] of HALLEN) {
  const D = hall.dienst;
  if (!D?.url) { fail(`[1] ${id}: die Seite nennt keinen Geraetesatz fuer den Wartungsplatz am Schiff (dienst) — in dieser Halle stuende kein Geraet um das Schiff`); continue; }
  if (!existsSync(inDist(D.url))) { fail(`[1] ${id}: der Geraetesatz des Wartungsplatzes (${D.url}) fehlt in dist/ — in dieser Halle stuende kein Geraet um das Schiff`); continue; }
  const b = statSync(inDist(D.url)).size;
  if (D.bytes !== b) { fail(`[1] ${id}: der Geraetesatz des Wartungsplatzes in dist/ hat ${b} Bytes, die Seite nennt ${D.bytes} — Seite und Datei stammen nicht aus demselben Bau`); continue; }
  const nimmt = satz?.(hall);
  if (satz && nimmt?.url !== D.url) { fail(`[1] ${id}: die Seite nennt den Geraetesatz, der Viewer nimmt fuer diese Halle aber ${nimmt?.url ?? 'keinen'} (dienstSatz) — der Wartungsplatz bliebe leer`); continue; }
  mitDienst++;
}
if (mitDienst < MIN_DIENST) fail(`[1] nur ${mitDienst} Halle(n) fester Groesse mit dem Geraetesatz des Wartungsplatzes, Klinke ${MIN_DIENST}`);
say(`    Wartungsplatz am Schiff: ${mitDienst} von ${HALLEN.size} Halle(n) mit Geraetesatz, den der Viewer fuer sie nimmt (Klinke ${MIN_DIENST})`);

/* ---------- [2] Modell ---------- */
say('[2] Modell: Boden der Seite wie das Lot am Modell, Plattform auf dieser Hoehe, Landeflaeche im Feld des Aufzugs und im Raum, jede Bahn mit Knoten, das Tor offen neben dem Feld, Grundlicht je Halle ueber der Klinke und im Lichtgitter');
const io = HALLEN.size ? new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() }) : null;
const DOCS = new Map(), AUFZUG = new Map();
let bahnen = 0, padFlaeche = 0, torOffen = 0, torSchwenk = 0;
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
  AUFZUG.set(id, A);
  const knoten = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const netze = (n) => (n.getMesh() ? 1 : 0) + n.listChildren().reduce((s, k) => s + netze(k), 0);
  const teile = [...(A.tor?.teile ?? []), ...(A.plattform ? [A.plattform] : [])];
  const lose = teile.filter((t) => !t?.node || !knoten.has(t.node) || !netze(knoten.get(t.node)));
  if (!A.plattform?.node || !(A.tor?.teile?.length > 0)) fail(`[2] ${id}: die Bahnen nennen ${A.plattform?.node ? 'kein Bodentor' : 'keine Plattform'} — die Buehne baute den Aufzug nicht`);
  else if (lose.length) fail(`[2] ${id}: ${lose.length} Bahn(en) ohne Knoten mit Netz im Modell (${lose.slice(0, 4).map((t) => t?.node ?? '(ohne Namen)').join(', ')}) — dieses Teil bliebe stehen, waehrend der Aufzug faehrt`);
  else bahnen += teile.length;
  if (!(A.plattform?.weg > 0)) fail(`[2] ${id}: die Plattform hat keinen Fahrweg (plattform.weg ${A.plattform?.weg ?? '—'})`);
  const feld = A.feld;
  // je zwei endliche Zahlen und from kleiner als to: sonst ergaeben Mitte und Ueberdeckung NaN, und kein Vergleich schluege an
  const ecke = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
  if (!(ecke(feld?.from) && ecke(feld?.to))) fail(`[2] ${id}: die Bahnen nennen das Feld des Aufzugs nicht als zwei Ecken aus je zwei Zahlen (feld ${JSON.stringify(feld ?? null)})`);
  else if (!(feld.from[0] < feld.to[0] && feld.from[1] < feld.to[1])) fail(`[2] ${id}: das Feld des Aufzugs ist leer oder verkehrt herum (from ${feld.from.join(', ')}, to ${feld.to.join(', ')})`);
  else {
    const fm = [(feld.from[0] + feld.to[0]) / 2, (feld.from[1] + feld.to[1]) / 2];
    if (Math.hypot(fm[0] - mitte[0], fm[1] - mitte[1]) > 0.05) fail(`[2] ${id}: die Landeflaeche (Mitte ${mitte.join(', ')}) sitzt nicht mitten im Feld des Aufzugs (Mitte ${fm.map((v) => +v.toFixed(3)).join(', ')}) — das Schiff staende neben der Mitte der Plattform`);
    if (P.from[0] < feld.from[0] || P.to[0] > feld.to[0] || P.from[1] < feld.from[1] || P.to[1] > feld.to[1]) fail(`[2] ${id}: die Landeflaeche ${JSON.stringify(P)} ragt ueber das Feld des Aufzugs ${JSON.stringify(feld)} hinaus`);
    // jedes Teil so vollstaendig, wie der Viewer es verlangt (ownLift): box und je Richtung mindestens zwei
    // Schluessel, sonst baut er den ganzen Aufzug nicht; ein Riegel mit Drehdaten dazu keysRot mit zwei
    // Schluesseln je Richtung und einen Drehpunkt aus drei Zahlen, sonst zeichnet er ihn ohne Schwenk
    const zahlen = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
    // eine Bahn: ein Feld aus mindestens zwei Schluesseln, jeder aus n endlichen Zahlen (Zeit und Versatz bzw.
    // Zeit und Quaternion); eine Quaternion aus lauter Nullen ist keine Drehung
    const bahnMangel = (b, n, wo, dreh) => {
      if (!Array.isArray(b) || b.length < 2) return `${wo} mit ${Array.isArray(b) ? b.length : 0} Schluessel(n)`;
      const schlecht = b.findIndex((s) => !zahlen(s, n) || (dreh && !s.slice(1).some((v) => v !== 0)));
      return schlecht < 0 ? null : `${wo}[${schlecht}] ist kein Schluessel aus ${n} Zahlen${dreh ? ' mit einer Drehung' : ''}`;
    };
    const torMangel = (t) => {
      const m = [];
      if (!(Array.isArray(t?.box) && t.box.length === 2 && t.box.every((e) => zahlen(e, 3)))) m.push('ohne box');
      for (const k of ['close', 'open']) m.push(bahnMangel(t?.keys?.[k], 4, `keys.${k}`, false));
      if (t?.keysRot || t?.pivot) {
        for (const k of ['close', 'open']) m.push(bahnMangel(t.keysRot?.[k], 5, `keysRot.${k}`, true));
        if (!zahlen(t.pivot, 3)) m.push('pivot ist kein Punkt');
      }
      return m.filter(Boolean);
    };
    const mangel = (A.tor?.teile ?? []).map((t) => [t, torMangel(t)]).filter(([, m]) => m.length);
    if (mangel.length) fail(`[2] ${id}: ${mangel.length} Teil(e) des Bodentors unvollstaendig (${mangel.slice(0, 4).map(([t, m]) => `${t?.node ?? '(ohne Namen)'}: ${m.join(', ')}`).join('; ')}) — der Viewer baute den Aufzug nicht oder zoege einen Riegel ohne Schwenk; Bahnen neu bauen`);
    // offen liegt jedes Teil des Tors neben der Oeffnung (unter dem Boden, aus); geprueft werden die vollstaendigen
    const tt = (A.tor?.teile ?? []).filter((t) => !torMangel(t).length);
    const imFeld = offenImFeld(tt, feld);
    if (imFeld.length) fail(`[2] ${id}: offen liegen ${imFeld.length} Teile des Tors ueber dem Feld des Aufzugs (${imFeld.slice(0, 4).map((t) => `${t.node} ${t.x} x ${t.z} m`).join(', ')}) — sie fahren falsch herum, das Schiff stuende auf ihnen; Bahnen aus scripts/lib/aufzug-dreh.mjs neu bauen`);
    torOffen += tt.length;
    torSchwenk += tt.filter((t) => t.keysRot).length;
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
if (HALLEN.size && !torOffen) fail('[2] kein Teil eines Bodentors offen gegen das Feld geprueft — die Bahnen nennen keine Torteile mit Kasten und Schliessbahn');
say(`    ${DOCS.size} Modell(e) gelesen, ${bahnen} Bahnen mit Knoten, ${torOffen} Torteile offen neben dem Feld geprueft (${torSchwenk} davon schwenken um ihren Knochen), ${padFlaeche.toFixed(0)} m² Plattform auf der Hoehe des Bodens`);
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
  // Hauptstrahler (HALL_FEST.strahler, hallStrahler): Die Schwelle ab trifft Lampen der ausgelieferten Datei auf
  // beiden Seiten der Landeflaeche (eine Einstellung ohne Lampen ist eine Ausnahme ohne Anlass und reisst), der
  // Viewer gibt fuer jede den Faktor ihrer Seite und ihre Farbe mit dem Anteil weiss zu Weiss gemischt zurueck, fuer
  // jede andere Lampe nichts, und die Buehne stellt ihre Lampen mit dieser Funktion, bevor sie Rangfolge und Gitter
  // rechnet. Wie viele sie gestellt hat, nennt sie in ihrer Zeile "…, N Hauptstrahler"; check:hangar-shader haelt
  // das gegen seine Klinke strahler (dort im Kopf unter HAUPTSTRAHLER; dieses Tor vorgefuehrt rot im Kopf unter (x)).
  let strahler = '';
  const ST = FEST[id]?.strahler;
  if (ST !== undefined || K.strahler !== undefined) {
    const H = typeof viewer?.hallStrahler === 'function' ? viewer.hallStrahler : null;
    const pad = FEST[id]?.pad, mitte = pad ? (pad.from[0] + pad.to[0]) / 2 : NaN;
    const heil = ST && Number.isFinite(ST.ab) && ST.ab > 0 && (ST.bis === undefined || (Number.isFinite(ST.bis) && ST.bis > ST.ab)) && Number.isFinite(ST.weiss) && ST.weiss >= 0 && ST.weiss <= 1 && Array.isArray(ST.seiten) && ST.seiten.length === 2 && ST.seiten.every((f) => Number.isFinite(f) && f > 0 && f <= 2) && (ST.mal === undefined || (Number.isFinite(ST.mal) && ST.mal > 0 && ST.mal <= MAL_MAX));
    if (ST === undefined) fail(`[3] ${id}: die Halle hat eine Klinke strahler (${K.strahler}), HALL_FEST nennt fuer sie keine Hauptstrahler mehr — ihre Fluter strahlten wieder in der Farbe des Spiels und von beiden Seiten gleich stark (Krisz, 18.11.2026: „die beleuchtung [ist] super kacke“)`);
    else if (!heil) fail(`[3] ${id}: HALL_FEST.strahler ist ${JSON.stringify(ST)}, erwartet ab ueber null (Spielstaerke), bis (wenn es steht) ueber ab, weiss von 0 bis 1, seiten aus zwei Faktoren ueber null bis 2 (+x, -x) und mal (wenn es steht) ueber null bis ${MAL_MAX}`);
    else if (!H) fail(`[3] ${id}: der Viewer nennt seine Hauptstrahler nicht mehr (hallStrahler), HALL_FEST.strahler stellt aber welche — ob er sie stellt, liesse sich nur raten`);
    else if (!Number.isFinite(mitte)) fail(`[3] ${id}: HALL_FEST nennt Hauptstrahler, aber keine Landeflaeche (pad): ihre Seiten haben keine Mitte`);
    else {
      const traf = (l) => l.intensity >= ST.ab && !(l.intensity >= (ST.bis ?? Infinity));
      const haupt = lampen.filter(traf), plus = haupt.filter((l) => l.pos[0] > mitte).length, minus = haupt.length - plus;
      const soll = (l) => ({ staerke: ST.seiten[l.pos[0] > mitte ? 0 : 1] * (ST.mal ?? 1), farbe: (l.color || [1, 1, 1]).map((v) => v + (1 - v) * ST.weiss) });
      const falsch = haupt.filter((l) => { const r = H(id, l, mitte), w = soll(l); return !r || r.staerke !== w.staerke || !Array.isArray(r.farbe) || r.farbe.length !== 3 || r.farbe.some((v, i) => !(Math.abs(v - w.farbe[i]) < 1e-9)); });
      const fremd = lampen.filter((l) => !traf(l) && H(id, l, mitte) !== null);
      const naht = /const s = hallStrahler\(h\.id, l, o\[0\]\);\s*l\.intensity \*= hallLampenStaerke\(h\.id, l\.name\) \* \(s\?\.staerke \?\? 1\);\s*if \(s\) \{ l\.color = s\.farbe; l\.haupt = true; haupt\+\+; \}/.test(viewerSrc)
        && /cand\.sort\(\(a, b\) => \(b\.haupt \? 1 : 0\) - \(a\.haupt \? 1 : 0\) \|\| b\.score - a\.score\);/.test(viewerSrc);
      if (!plus || !minus) fail(`[3] ${id}: HALL_FEST.strahler stellt Lampen ab der Staerke ${ST.ab}${ST.bis ? ` unter ${ST.bis}` : ''}, die ausgelieferte Lampendatei traegt davon ${plus} auf der Seite +x der Landeflaeche und ${minus} auf -x — die Einstellung hat ihren Anlass verloren (die Datei nennt die Staerke ihrer Fluter anders, oder sie fehlen): ab anpassen oder den Eintrag streichen`);
      else if (falsch.length) { const l = falsch[0], r = H(id, l, mitte), w = soll(l); fail(`[3] ${id}: ${falsch.length} von ${haupt.length} Hauptstrahlern stellt der Viewer nicht, wie HALL_FEST.strahler es nennt (hallStrahler fuer ${l.name} bei x ${l.pos[0]}: ${r ? `Staerke mal ${r.staerke}, Farbe ${JSON.stringify(r.farbe?.map?.((v) => +v.toFixed(3)) ?? r.farbe)}` : 'nichts'}, erwartet mal ${w.staerke} und ${JSON.stringify(w.farbe.map((v) => +v.toFixed(3)))}) — das Schiff stuende wieder farbstichig oder von beiden Seiten gleich hell da`); }
      else if (fremd.length) fail(`[3] ${id}: der Viewer stellt ${fremd.length} Lampen ausserhalb der Staerke ${ST.ab}${ST.bis ? ` bis unter ${ST.bis}` : ''} als Hauptstrahler (zuerst ${fremd[0].name} mit ${fremd[0].intensity}) — ${fremd[0].intensity >= ST.ab ? 'die Strahler darueber bekaemen Farbe und Faktor der Fluter, mit dem Faktor mal einen gleissenden Fleck am Boden' : 'Wandleuchten bekaemen die Farbe und den Faktor der Fluter'}`);
      else if (!naht) fail(`[3] ${id}: die Buehne des ausgelieferten Viewers stellt ihre Lampen nicht mehr mit hallStrahler, bevor sie Rangfolge und Gitter rechnet (in loadHallLights erwartet: const s = hallStrahler(h.id, l, o[0]); l.intensity *= hallLampenStaerke(h.id, l.name) * (s?.staerke ?? 1); if (s) { l.color = s.farbe; l.haupt = true; haupt++; } und die Rangfolge mit den Hauptstrahlern zuerst) — die Regel stuende im Viewer, ohne dass eine Lampe sie bekommt`);
      else if (K.strahler === undefined) fail(`[3] ${id}: HALL_FEST.strahler stellt ${haupt.length} Hauptstrahler, die Halle hat keine Klinke strahler (KLINKE) — fiele die Einstellung wieder weg, bliebe das Tor gruen`);
      else if (!(haupt.length >= K.strahler)) fail(`[3] ${id}: der Viewer stellt ${haupt.length} Hauptstrahler der ausgelieferten Datei, Klinke ${K.strahler} — ein Teil der Fluter strahlt wieder in der Farbe des Spiels und mit voller Staerke`);
      else strahler = `${haupt.length} Hauptstrahler ab Staerke ${ST.ab}${ST.bis ? ` unter ${ST.bis}` : ''} (${plus} auf +x mal ${ST.seiten[0]}, ${minus} auf -x mal ${ST.seiten[1]}${ST.mal ? `, beide mal ${ST.mal}` : ''}, Anteil Weiss ${ST.weiss}; Klinke ${K.strahler})`;
    }
  }
  // Lampenlicht im Gitter (HALL_FEST.gitter, hallGitterLampen): ein Faktor ueber null, der Viewer hebt damit die
  // Staerke jeder Lampe ausser den Hauptstrahlern und laesst die Liste, wie sie ist, und die Buehne reicht ihrem
  // Gitter die Lampen durch diese Funktion.
  let gitterMal = '';
  const GF = FEST[id]?.gitter;
  if (GF !== undefined) {
    const G = typeof viewer?.hallGitterLampen === 'function' ? viewer.hallGitterLampen : null;
    const probe = [{ name: 'a', intensity: 2, pos: [0, 0, 0] }, { name: 'b', intensity: 5, pos: [1, 0, 0], haupt: true }], vorher = JSON.stringify(probe);
    let aus = null;
    try { aus = G ? G(id, probe) : null; } catch { /* unten */ }
    if (!(Number.isFinite(GF) && GF > 0)) fail(`[3] ${id}: HALL_FEST.gitter ist ${JSON.stringify(GF)}, erwartet ein Faktor ueber null`);
    else if (!G) fail(`[3] ${id}: der Viewer hebt das Lampenlicht seines Gitters nicht mehr (hallGitterLampen), HALL_FEST.gitter nennt aber ${GF} — die Waende stuenden wieder im gleichmaessigen Grundlicht, ohne dass man sieht, woher ihr Licht kommt`);
    else if (!Array.isArray(aus) || aus.length !== 2 || aus[0]?.intensity !== 2 * GF || aus[1]?.intensity !== 5 || JSON.stringify(probe) !== vorher) fail(`[3] ${id}: hallGitterLampen hebt die Lampen nicht, wie HALL_FEST.gitter es nennt (aus Staerke 2 und einem Hauptstrahler mit 5 wird ${JSON.stringify(aus?.map?.((l) => l?.intensity) ?? aus)}, erwartet [${2 * GF}, 5]${JSON.stringify(probe) !== vorher ? '; die uebergebene Liste ist danach veraendert' : ''})`);
    else if (!/await hallGitter\(hallGitterLampen\(h\.id, all\.filter\(\(l\) => !lit\.has\(l\)\)\), h, /.test(viewerSrc)) fail(`[3] ${id}: die Buehne des ausgelieferten Viewers reicht ihrem Lichtgitter die Lampen nicht durch hallGitterLampen (in loadHallLights erwartet: await hallGitter(hallGitterLampen(h.id, all.filter((l) => !lit.has(l))), h, …)) — HALL_FEST.gitter ${GF} kaeme bei den Waenden nicht an`);
    else gitterMal = `Lampenlicht im Gitter mal ${GF}`;
  }
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
  zeilen.push(`    ${id}: ${schrift} Dreiecke Schrift (Klinke ${K.schriftTris}), ${aus} Schirme ohne Bild aus mit ${ausTris} Dreiecken (Klinke ${K.schirmTris}), 0 hell; ${lampenRoh?.length ?? 0} Lampen in der ausgelieferten Datei, davon setzt die Buehne ${ist.lampen}${dazu ? ` (${dazu})` : ''}${gedaempft ? `, gedaempft ${gedaempft} (Klinke ${K.gedaempft})` : ''}${strahler ? `, ${strahler}` : ''}${gitterMal ? `, ${gitterMal}` : ''}${flaechen !== null ? `, ${flaechen} Flaechenlichter entlang ihrer eigenen Achse (Klinke ${K.flaechen})` : ''}${ruhe ? `, ${ruhe.weg} in Ruhe dunkle Lampen weggelassen (${ruhe.namen} Namen in ${ruhe.gruppen} Lichtgruppen, Klinke ${K.ruhe})` : ''}, Bodentor ${ist.tor} Teile, ${ist.schirme} Schirme vom Build ausgeschaltet, ${ist.tafeln} Tafeln mit Logo, ${ist.aufkleber} Netze mit Aufklebern, ${ist.schilder} Schilder aus der vollen Stufe, ${ist.kinder} Kind-Container eingehaengt; ${M.tris} Dreiecke, ${(bytes / 1e6).toFixed(1)} MB, ${M.textures} Texturen, ${M.hull?.pct} % ins Leere`);
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

/* ---------- [5] Deko ---------- */
say('[5] Deko: die Arbeitsszenen der Hallen fester Groesse am ausgelieferten Modell: jedes Stueck mit Knoten im Satz, auf dem Boden oder auf einem anderen Stueck, keines im Feld des Aufzugs, in der Halle, in einem anderen oder vor einem Fahrzeug');
const dfm = /\/\* work-deko-fest \*\/([\s\S]*?)\/\* \/work-deko-fest \*\//.exec(viewerSrc);
// gelesen: der Block war JSON. Erst dann zaehlt seine Form; ein Lesefehler ist schon gemeldet und wird nicht doppelt
let DEKO_FEST = null, dekoGelesen = false;
try { if (dfm) { DEKO_FEST = JSON.parse(dfm[1]); dekoGelesen = true; } } catch (e) { fail(`[5] WORK_DEKO_FEST im ausgelieferten Viewer ist kein JSON mehr (${e.message})`); }
if (!dfm) fail('[5] der ausgelieferte Viewer traegt keinen Block /* work-deko-fest */ … /* /work-deko-fest */ — umbenannt oder entfernt? Dann dieses Tor mitnehmen');
// auch null: dekoPlan im Viewer griffe dann ins Leere (TypeError beim Laden jeder Halle), und [5] liefe ohne diese Pruefung still leer
if (dekoGelesen && (DEKO_FEST === null || typeof DEKO_FEST !== 'object' || Array.isArray(DEKO_FEST))) { fail(`[5] WORK_DEKO_FEST ist keine Liste { Halle: { zonen } }, sondern ${JSON.stringify(DEKO_FEST).slice(0, 60)}`); DEKO_FEST = null; }
for (const id of Object.keys(KLINKE_DEKO)) if (DEKO_FEST && !DEKO_FEST[id]) fail(`[5] ${id}: KLINKE_DEKO haelt Arbeitsszenen fuer diese Halle, WORK_DEKO_FEST nennt sie nicht mehr — die Halle stuende wieder leer; soll sie das, den Eintrag in KLINKE_DEKO per Commit mit Ursache entfernen`);
let dekoKat = null;
if (DEKO_FEST && Object.keys(DEKO_FEST).length) {
  try { dekoKat = JSON.parse(readFileSync(join(DIST, 'hangar/props/katalog.json'), 'utf8')); } catch (e) { fail(`[5] dist/hangar/props/katalog.json ist nicht lesbar (${e.message})`); }
}
// Herkunft wie verify:hangar-hall [17]: ein Arbeitsplatz, eine Kategorie oder eine Zone, wie das Spiel sie stellt
const dekoHerkunft = new Set([...(dekoKat?.arbeitsplaetze ?? []).map((a) => a.name), ...Object.keys(dekoKat?.kategorien ?? {}), ...(dekoKat?.zonen ?? []).map((z) => z.name)]);
const dekoImKatalog = new Set((dekoKat?.props ?? []).map((q) => q.node));
const SAETZE = new Map(), dekoZeilen = [];
for (const [id, plan] of Object.entries(DEKO_FEST ?? {})) {
  const K = KLINKE_DEKO[id], G = OBERGRENZE_DEKO[id], H = HALLEN.get(id), tag = `[5] ${id}`;
  if (!FEST[id]) { fail(`${tag}: WORK_DEKO_FEST nennt die Halle, HALL_FEST kennt sie nicht — Deko ohne Halle (Zombie): den Eintrag entfernen oder an den neuen Namen anpassen`); continue; }
  const zonen = Array.isArray(plan?.zonen) ? plan.zonen : [];
  if (!zonen.length) { fail(`${tag}: WORK_DEKO_FEST nennt die Halle ohne Zonen — ein Eintrag ohne Anlass, herausnehmen`); continue; }
  if (!H) { dekoZeilen.push(`    ${id}: ${zonen.length} Zonen, NICHT geprueft, weil dieser Bau die Halle nicht ausliefert`); continue; }
  if (!K || !G) { fail(`${tag}: die Halle traegt Arbeitsszenen, hat aber keine ${!K ? 'Klinke (KLINKE_DEKO)' : 'Obergrenze (OBERGRENZE_DEKO)'} — ${!K ? 'fielen sie wieder weg' : 'wuechsen sie'}, bliebe das Tor gruen`); continue; }
  // Seite und Viewer: Die Buehne laedt den Satz, den die Seite der Halle mitgibt, und stellt den Plan, den dekoPlan nennt
  const DK = H.hall.deko, file = DK?.url ? inDist(DK.url) : null;
  if (!file || !existsSync(file)) { fail(`${tag}: ${DK?.url ? `der Satz der Hallendeko (${DK.url.split('?')[0]}) fehlt in dist/` : `die Seite gibt der Halle den Satz der Hallendeko nicht mit (halls.${H.stufe}.deko)`} — die Buehne stellte ${zonen.length} Zonen nicht auf, die Halle stuende still leer (HangarApp.astro, public/hangar/props/deko.glb)`); continue; }
  if (typeof viewer?.dekoPlan !== 'function' || typeof viewer?.dekoGlieder !== 'function') { fail(`${tag}: der ausgelieferte Viewer nennt den Plan seiner Deko nicht mehr (dekoPlan, dekoGlieder) — wo die Buehne die Stuecke hinstellt, liesse sich nur raten`); continue; }
  const P = viewer.dekoPlan(id);
  if (JSON.stringify(P) !== JSON.stringify(plan)) { fail(`${tag}: die Buehne nimmt fuer diese Halle ${P ? 'einen anderen Plan als den Block WORK_DEKO_FEST' : 'keinen Plan, der Block WORK_DEKO_FEST nennt aber einen'} (dekoPlan) — geprueft wuerde, was nicht steht`); continue; }
  // Der Block: je Zone Name, Stufe, Herkunft, Wand, Bezugspunkt, Hoehe ihres Bodens und Glieder
  const paar = (q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite), namen = new Set();
  let heil = true;
  const bruch = (m) => { heil = false; fail(m); };
  for (const z of zonen) {
    if (typeof z?.name !== 'string' || !z.name || namen.has(z.name)) { bruch(`${tag}: Zone ohne oder mit doppeltem Namen (${z?.name})`); continue; }
    namen.add(z.name);
    if (!['mittel', 'hoch'].includes(z.stufe)) bruch(`${tag} ${z.name}: stufe ${z.stufe} ist weder mittel noch hoch — die Buehne stellte die Zone nie oder auch auf der niedrigsten Stufe`);
    if (!['w', 'o', 'n', 's'].includes(z.wand) || !paar(z.at)) bruch(`${tag} ${z.name}: wand ${z.wand} (w, o, n oder s) und at [x, z] im Modellraum noetig`);
    if (z.boden !== undefined && !Number.isFinite(z.boden)) bruch(`${tag} ${z.name}: boden ${JSON.stringify(z.boden)} ist keine Hoehe in Metern ueber dem Hallenboden`);
    if (dekoKat && !dekoHerkunft.has(z.aus)) bruch(`${tag} ${z.name}: aus „${z.aus}“ ist weder ein Arbeitsplatz noch eine Kategorie noch eine Zone des Katalogs — woher die Zusammenstellung kommt, ist nicht belegt`);
    if (!(Array.isArray(z.glieder) && z.glieder.length)) { bruch(`${tag} ${z.name}: Zone ohne Glieder`); continue; }
    for (const g of z.glieder) if (!(Array.isArray(g) && typeof g[0] === 'string' && g.length >= 3 && g.length <= 5 && g.slice(1).every(Number.isFinite) && (g[4] ?? 0) >= 0)) bruch(`${tag} ${z.name}: Glied ${JSON.stringify(g)} braucht [Knoten, x, z, Drehung, Hoehe ab 0]`);
    const fremd = Object.keys(z).filter((k) => !['name', 'stufe', 'aus', 'wand', 'at', 'boden', 'glieder'].includes(k));
    if (fremd.length) bruch(`${tag} ${z.name}: ${fremd.join(', ')} prueft dieses Tor nicht (Spuren, Leitungen und Gehwege kennt bisher nur die Halle von Revel & York, verify:hangar-hall [17]) — erst das Tor erweitern, dann stellen`);
  }
  if (!heil) continue;
  // Der Satz: Masse, Dreiecke und nach oben zeigende Flaechen je Knoten (wie kitParts im Viewer: die Huelle der Geometrie)
  let satz = SAETZE.get(file);
  if (!satz) {
    let sd = null;
    try { sd = await io.read(file); } catch (e) { fail(`${tag}: der Satz der Hallendeko laesst sich nicht lesen (${e.message})`); continue; }
    satz = new Map();
    for (const node of (sd.getRoot().getDefaultScene() ?? sd.getRoot().listScenes()[0])?.listChildren() ?? []) {
      const teile = (node.getMesh()?.listPrimitives() ?? []).map((p) => ({ pos: p.getAttribute('POSITION')?.getArray(), idx: p.getIndices()?.getArray() ?? null })).filter((t) => t.pos);
      if (teile.length) satz.set(node.getName(), knotenFlaechen(teile));
    }
    SAETZE.set(file, satz);
  }
  const knotenNamen = [...new Set(zonen.flatMap((z) => z.glieder.map((g) => g[0])))];
  const lost = knotenNamen.filter((n) => !satz.has(n));
  if (lost.length) { fail(`${tag}: der Satz traegt ${lost.length} Knoten nicht oder ohne Geometrie, die WORK_DEKO_FEST nennt (${lost.slice(0, 3).join(', ')}) — die Buehne liesse das Stueck still weg (der Packer nimmt bisher nur die Knoten aus WORK_DEKO: scripts/build-hangar-dienst.mjs um diesen Block erweitern und neu packen)`); continue; }
  const ohneKat = knotenNamen.filter((n) => !dekoImKatalog.has(n));
  if (dekoKat && ohneKat.length) fail(`${tag}: ${ohneKat.length} Requisiten stehen nicht im Katalog (${ohneKat.slice(0, 3).join(', ')}) — ihre Bedeutung (wofuer, wo im Spiel) ist nicht belegt`);
  const lose = knotenNamen.filter((n) => LOSE_LEITUNG.test(n));
  if (lose.length) fail(`${tag}: ${lose.length} lose Kabel und Schlaeuche (${lose.slice(0, 3).join(', ')}) — ihre Enden laegen frei (Krisz: „kabel connected nicht“); Leitungen von Geraet zu Geraet stellt bisher nur die Halle von Revel & York`);
  // Lage jedes Stuecks, mit der Rechnung des Viewers
  const stuecke = [];
  let krumm = 0;
  for (const z of zonen) {
    const gl = viewer.dekoGlieder(z, (n) => { const e = satz.get(n); return e ? { x: e.size[0], y: e.size[1], z: e.size[2] } : null; });
    krumm += gl?.ohne ?? 0;
    for (const g of gl?.glieder ?? []) {
      if (!(Array.isArray(g.at) && [...g.at, g.a, g.y, g.top, g.hx, g.hz].every(Number.isFinite))) { krumm++; continue; }
      stuecke.push({ name: `${z.name} ${String(g.node).replace(/^prop_/, '')} (${(g.lokal ?? []).join(', ')})`, node: g.node, zone: z.name, stufe: z.stufe, c: g.at, a: g.a, hx: g.hx, hz: g.hz, y: g.y, top: g.top, auf: !!g.auf, fahrzeug: DEKO_FAHRZEUG.test(g.node), bo: z.boden ?? 0, tris: satz.get(g.node)?.tris ?? 0 });
    }
  }
  const soll = zonen.reduce((s, z) => s + z.glieder.length, 0);
  if (krumm || stuecke.length !== soll) { fail(`${tag}: der Viewer nennt die Lage von ${stuecke.length} der ${soll} Stuecke (dekoGlieder), ${krumm} ohne Lage oder ohne Knoten — was die Buehne mit ihnen taete, ist ungeprueft`); continue; }
  const A = AUFZUG.get(id), doc = DOCS.get(id);
  if (!(Array.isArray(A?.feld?.from) && Array.isArray(A?.feld?.to)) || !doc) { fail(`${tag}: ohne ${doc ? 'das Feld des Aufzugs' : 'das Modell der Halle'} ([2]) laesst sich nicht pruefen, ob die Deko frei steht`); continue; }
  const L = pruefeLage(stuecke, { oben: (n) => satz.get(n)?.oben, feld: A.feld, abstand: DEKO_ABSTAND, spur: DEKO_SPUR });
  const drei = (l) => l.slice(0, 3).join('; ');
  if (L.imFeld.length) fail(`${tag}: ${L.imFeld.length} Stuecke stehen im Feld des Aufzugs oder naeher als ${DEKO_ABSTAND} m daran (${drei(L.imFeld)}) — dort faehrt die Plattform mit dem Schiff: x/z in WORK_DEKO_FEST nachziehen`);
  if (L.ineinander.length) fail(`${tag}: ${L.ineinander.length} Paare von Stuecken stecken ineinander (${drei(L.ineinander)}) — x/z in WORK_DEKO_FEST nachziehen`);
  if (L.schwebt.length) fail(`${tag}: ${L.schwebt.length} Stuecke schweben (${drei(L.schwebt)}) — darunter hat kein Stueck derselben Zone auf dieser Hoehe eine tragende Flaeche (nach oben zeigende Dreiecke, nicht nur die Huelle)`);
  if (L.imSpur.length) fail(`${tag}: ${L.imSpur.length} Stuecke stehen vor einem Fahrzeug in seiner Fahrspur von ${DEKO_SPUR.laenge} m (${drei(L.imSpur)}) — neben oder hinter das Fahrzeug stellen`);
  // Die Halle am Ort der Deko: alle Dreiecke im Band ueber dem Boden und die nach oben zeigenden auf Bodenhoehe,
  // ohne die Teile, die mit dem Aufzug fahren (Torfluegel und Plattform stehen im Modell in Ruhe)
  // (der Quader der Gegenprobe je Zone, mit der Rechnung des Viewers gelegt: von 0,5 m vor dem Bezugspunkt zur Wand hin)
  const proben = zonen.map((z) => {
    const g = viewer.dekoGlieder({ ...z, glieder: [['gegenprobe', 0, DEKO_PROBE.tiefe / 2 - 0.5, 0, 0]] }, () => ({ x: DEKO_PROBE.breite, y: 2, z: DEKO_PROBE.tiefe })).glieder[0];
    return { c: g.at, a: g.a, hx: g.hx, hz: g.hz };
  });
  const F = H.hall.floor, punkte = [...stuecke.flatMap(ecken), ...proben.flatMap(ecken)], xs = punkte.map((p) => p[0]), zs = punkte.map((p) => p[1]);
  const bereich = [Math.min(...xs) - 1.5, Math.min(...zs) - 1.5, Math.max(...xs) + 1.5, Math.max(...zs) + 1.5];
  const bos = zonen.map((z) => z.boden ?? 0), hoch = Math.max(...stuecke.map((m) => m.top), ...bos.map((b) => b + 2));
  const wand = hallenRaster({ zelle: 2, bereich, band: [F + Math.min(...bos) + DEKO_BAND, F + hoch + 0.1] });
  const boden = hallenRaster({ zelle: 1, bereich, band: [F + Math.min(...bos) - 0.15, F + Math.max(...bos) + 0.15] });
  const beweglich = new Set([...(A.tor?.teile ?? []).map((t) => t.node), A.plattform?.node].filter(Boolean));
  let hallTris = 0;
  const lauf = (node, weg) => {
    weg ||= beweglich.has(node.getName());
    const mesh = node.getMesh();
    if (mesh && !weg) {
      const m = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const Pa = prim.getAttribute('POSITION')?.getArray(), I = prim.getIndices()?.getArray();
        if (!Pa) continue;
        const cnt = I ? I.length : Pa.length / 3;
        const at = (i) => { const x = Pa[i * 3], y = Pa[i * 3 + 1], z = Pa[i * 3 + 2]; return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; };
        for (let i = 0; i + 2 < cnt; i += 3) {
          const a = at(I ? I[i] : i), b = at(I ? I[i + 1] : i + 1), c = at(I ? I[i + 2] : i + 2);
          hallTris++;
          wand.dazu(a, b, c);
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
          const ny = uz * wx - ux * wz, len = Math.hypot(uy * wz - uz * wy, ny, ux * wy - uy * wx);
          if (len > 1e-10 && ny / len >= 0.7) boden.dazu(a, b, c);
        }
      }
    }
    for (const k of node.listChildren()) lauf(k, weg);
  };
  for (const sz of doc.getRoot().listScenes()) for (const k of sz.listChildren()) lauf(k, false);
  const inHalle = [], ohneBoden = [];
  let auf = 0, bodenTrifft = 0, bodenVon = 0;
  for (const m of stuecke) {
    const y0 = F + (m.auf ? m.y + 0.02 : m.bo + DEKO_BAND), y1 = F + m.top;
    const n = y1 > y0 ? hallImQuader(m, y0, y1, wand) : 0;
    if (n) inHalle.push(`${m.name}: ${n} Dreiecke der Halle`);
    if (m.auf) { auf++; continue; }
    const b = bodenUnter(m, F + m.bo, boden, { tol: DEKO_BODEN.tol });
    bodenTrifft += b.auf; bodenVon += b.von;
    if (b.auf < DEKO_BODEN.anteil * b.von) ohneBoden.push(`${m.name}: ${b.auf} von ${b.von} Messpunkten`);
  }
  if (inHalle.length) fail(`${tag}: ${inHalle.length} Stuecke stecken in der Halle (${drei(inHalle)}) — gemessen am ausgelieferten Modell ab ${DEKO_BAND} m ueber dem Boden der Zone, ohne die fahrenden Teile des Aufzugs: x/z in WORK_DEKO_FEST nachziehen`);
  if (ohneBoden.length) fail(`${tag}: ${ohneBoden.length} Stuecke stehen nicht auf dem Boden ihrer Zone (${drei(ohneBoden)}; erwartet Boden auf ± ${DEKO_BODEN.tol} m unter wenigstens ${DEKO_BODEN.anteil * 100} % der Messpunkte) — sie hingen ueber einer Kante oder in der Luft: x/z oder boden der Zone nachmessen`);
  // Gegenprobe: Hinter dem Bezugspunkt einer Zone steht ihre Wand. Dieselbe Messung trifft sie mit einem Quader,
  // der vom Bezugspunkt DEKO_PROBE.tiefe m zur Wand hin reicht; traefe sie nirgends, saehe das Raster die Halle
  // nicht (falsches Band, falscher Raum, falsche Drehung der Zone), und jedes Stueck gaelte als frei.
  const ohneWand = zonen.filter((z, i) => !hallImQuader(proben[i], F + (z.boden ?? 0) + DEKO_BAND, F + (z.boden ?? 0) + 2, wand)).map((z) => z.name), anWand = zonen.length - ohneWand.length;
  const ist = { zonen: zonen.length, stuecke: stuecke.length, mittel: stuecke.filter((m) => m.stufe === 'mittel').length, fahrzeuge: stuecke.filter((m) => m.fahrzeug).length, anWand };
  for (const [k, was] of [['zonen', 'Zonen'], ['stuecke', 'Stuecke'], ['mittel', 'Stuecke auf der mittleren Stufe'], ['fahrzeuge', 'Fahrzeuge'], ['anWand', `Zonen, hinter deren Bezugspunkt die Messung die Wand der Halle trifft (von ${zonen.length}${ohneWand.length ? `, nicht bei ${ohneWand.join(', ')}` : ''}; traefe sie nirgends, saehe sie die Halle nicht, und jedes Stueck gaelte als frei; liegt der Bezugspunkt einer neuen Zone frei im Raum, die Klinke per Commit mit Ursache anpassen)`]]) {
    if (!(ist[k] >= K[k])) fail(`${tag}: ${ist[k]} ${was}, Klinke ${K[k] ?? 'fehlt'}`);
  }
  const tris = Math.round(stuecke.reduce((s, m) => s + m.tris, 0)), trisMittel = Math.round(stuecke.filter((m) => m.stufe === 'mittel').reduce((s, m) => s + m.tris, 0));
  const schwer = () => [...new Map(stuecke.map((m) => [m.node, m.tris])).entries()].sort((p, q) => q[1] - p[1]).slice(0, 3).map(([n, t]) => `${n.replace(/^prop_/, '')} ${Math.round(t)}`).join(', ');
  if (!(tris <= G.tris)) fail(`${tag}: ${tris} Dreiecke Deko, Obergrenze ${G.tris} — die Halle wird schwerer (die schwersten Stuecke: ${schwer()})`);
  if (!(trisMittel <= G.trisMittel)) fail(`${tag}: ${trisMittel} Dreiecke Deko auf der mittleren Stufe, Obergrenze ${G.trisMittel} — Zonen auf die hohe Stufe legen oder leichtere Stuecke nehmen (die schwersten: ${schwer()})`);
  dekoZeilen.push(`    ${id}: ${ist.zonen} Zonen (Klinke ${K.zonen}), ${ist.stuecke} Stuecke (Klinke ${K.stuecke}), davon ${ist.mittel} auf der mittleren Stufe (Klinke ${K.mittel}); ${tris} Dreiecke (Obergrenze ${G.tris}), ${trisMittel} auf der mittleren Stufe (Obergrenze ${G.trisMittel}); ${L.zahlen ? `Lage: ${JSON.stringify(L.zahlen)}; ` : ''}${ist.fahrzeuge} Fahrzeuge mit ${DEKO_SPUR.laenge} m freier Fahrspur (Klinke ${K.fahrzeuge}); gegen ${wand.tris.length / 9} von ${hallTris} Dreiecken der Halle am Ort der Deko gemessen (ohne ${beweglich.size} fahrende Teile des Aufzugs), ${inHalle.length} Stuecke darin; ${stuecke.length - auf} am Boden, ${bodenTrifft} von ${bodenVon} Messpunkten treffen Boden (${boden.tris.length / 9} Bodenflaechen), ${auf} auf einem anderen Stueck; Gegenprobe: hinter ${anWand} von ${zonen.length} Bezugspunkten trifft die Messung die Wand (Klinke ${K.anWand})`);
}
for (const z of dekoZeilen) say(z);
if (!dekoZeilen.length) say(`    ${DEKO_FEST && Object.keys(DEKO_FEST).length ? 'keine Halle vollstaendig gemessen' : 'keine Halle fester Groesse traegt Arbeitsszenen, nichts zu messen'}`);

/* ---------- [6] Ankunft ---------- */
say('[6] Ankunft: je ausgelieferter Halle fester Groesse und fuer die Werkhalle ein Standbild der Ladeszene, in beiden Sprachen gleich, als WebP in dist/ mit der Version seines Inhalts');
const ankSeiten = PAGES.map((page) => {
  try { return JSON.parse(/<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(page.html)?.[1] ?? 'null'); } catch { return null; }
});
if (JSON.stringify(ankSeiten[0]?.ankunft ?? null) !== JSON.stringify(ankSeiten[1]?.ankunft ?? null)) fail(`[6] ${PAGES[0].file} und ${PAGES[1].file} nennen verschiedene Ankunftsbilder — je nach Sprache kaeme ein anderes Bild`);
const ank = ankSeiten[0]?.ankunft ?? {};
const mitWerk = Object.values(ankSeiten[0]?.models ?? {}).some((e) => e?.[3] === 'werk');
const ankBrauchen = [...HALLEN.keys(), ...(mitWerk ? ['werk'] : [])];
let ankGut = 0, ankBytes = 0;
for (const key of ankBrauchen) {
  const url = ank[key];
  const neu = `node scripts/build-hangar-ankunft.mjs --only ${key}`;
  if (typeof url !== 'string' || !url) { fail(`[6] ${key}: kein Ankunftsbild (StageConfig ankunft) — die Ladeszene stuende vor leerem Grund; ${neu}`); continue; }
  const f = inDist(url);
  if (!existsSync(f)) { fail(`[6] ${key}: ${url} fehlt in dist/ — die Ladeszene stuende vor leerem Grund; ${neu}`); continue; }
  const buf = readFileSync(f);
  const v = /\?v=([0-9a-f]+)$/.exec(url)?.[1] ?? null;
  const sha = createHash('sha1').update(buf).digest('hex').slice(0, 8);
  if (v !== sha) { fail(`[6] ${key}: ${url} traegt die Version ${v ?? '(keine)'}, der Inhalt ${sha} — der Jahres-Cache hielte ein altes Bild`); continue; }
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') { fail(`[6] ${key}: ${url} ist kein WebP`); continue; }
  if (buf.length > ANKUNFT_MAX) { fail(`[6] ${key}: ${(buf.length / 1024).toFixed(1)} KB, Obergrenze ${ANKUNFT_MAX / 1024} KB — das Bild kaeme spaet neben der Halle, auf die es wartet; BILD in build-hangar-ankunft.mjs kleiner`); continue; }
  ankGut++;
  ankBytes += buf.length;
}
const ankLose = Object.keys(ank).filter((k) => !ankBrauchen.includes(k));
if (ankGut < MIN_ANKUNFT) fail(`[6] nur ${ankGut} Ankunftsbild(er) in Ordnung, Klinke ${MIN_ANKUNFT}`);
say(`    ${ankGut} von ${ankBrauchen.length} Ankunftsbild(ern) in Ordnung (Klinke ${MIN_ANKUNFT}), zusammen ${(ankBytes / 1024).toFixed(1)} KB, das groesste hoechstens ${ANKUNFT_MAX / 1024} KB${ankBrauchen.length ? `: ${ankBrauchen.join(', ')}` : ''}`);
if (ankLose.length) say(`    WARNUNG: Ankunftsbild(er) ohne ausgelieferte Halle: ${ankLose.join(', ')} (public/hangar/ankunft/), laedt niemand`);

if (fehler.length) {
  console.error(`\nverify-hangar-hallen: ${fehler.length} FEHLER`);
  for (const f of fehler) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('\nverify-hangar-hallen: ALLE ZUSICHERUNGEN ERFUELLT ✓');
