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

   DREIUNDZWANZIG ZUSICHERUNGEN, jede mit Soll-/Ist-Zeile:
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
        Dazu das Telefon (Krisz 12. und 13.11.2026: „Auf dem Handy laedt
        es die ganze Zeit neu“, „versucht es immer noch die ganze Zeit zu
        laden“): Texturdeckel als Klinken (Automatik 256 px, von Hand
        512/384/256, unter dem Deckel des Waechters 192/128), die Bilder
        kommen schon verkleinert aus dem Loader
        (fitSize und limiter am Modul nachgerechnet), und der Waechter
        der Seite senkt dort beim ersten Abbruch und fuehrt eine Spur,
        deren Woerter auf beiden Hangarseiten stehen.
    13  Getauschte Bordwaffen am Modell (Layout-Werkstatt): jede URL unter
        models in dist/hangar-layouts.json traegt ?v= und liegt in dist/,
        und die Schiffs-GLBs in dist/hangar/ships tragen ihre Serienwaffen als
        Tauschteile (Knoten mit extras.swap und 16 endlichen Zahlen in
        extras.anchor, aus dem JSON-Block der Datei gelesen). Zwei Klinken:
        Modelle und Ports mit Tauschteilen.
    14  Lackierungen der Werkstatt: paints in dist/hangar-layouts.json je
        Schiff (auch ohne tauschbare Bauteile), Serienpalette und jede Lackierung mit drei
        #rrggbb-Toenen, eindeutiger Kennung und Namen, Glanz je Kanal
        wahlweise als [#glanzfarbe, glaette 0..255]. Je Schiff mit Lack
        (dist/hangar/ships) zaehlt die Pruefung die Palettenmaterialien wie
        der Viewer sie in paint() sucht: mit extras.palette nach dessen
        Kanal, sonst die, deren baseColorFactor ein Ton der Serienpalette
        ist (linear). Ohne Treffer faerbt die Lackierung am Modell nichts
        um. Klinken: Schiffe, Lackierungen, umfaerbbare Schiffe mit Lack.
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
        GLB, Innenraeume und Ablage zusammen und je Datei, Klinke: Schiffe
        mit Ablage. Verwaiste Bilder: WARNUNG (Ballast, kein Schaden).
    18  Platzhaltermaterial (seit 27.10.2026, Krisz: weisses Cockpit der
        325a). Dreiecke der Schiffs-GLBs ohne Material oder mit namenlosem
        Material (Ersatz des Exports, im Hangar reinweiss) zaehlen. Seit dem
        Nachtrag keines mehr, ausser den Luecken im Spiel selbst
        (PLATZHALTER_AUSNAHMEN, je mit Anlass und Zombie-Waechter).
    19  Schiffswahl (seit 29.10.2026, Krisz: „painy“; Entwurf 2). Je
        Hangarseite: jede Karte zeigt ihr gerendertes Bild
        /hangar/cards/<id>.webp?v=, Bild und Umriss (top/) liegen in dist/,
        v ist sha256 beider Dateien (die URL steht lange im Cache), data-fp
        sind Breite und Laenge in Metern (zwei Zahlen > 0); eine Karte ohne
        eigenes Bild zeigt das des Wikis: WARNUNG, render-hangar-cards
        nachholen (Schiene C). data-q ist unter fold() des ausgelieferten
        Controllers unveraendert (sonst trifft die Suche diese Woerter nie),
        jeder Zweck aus data-p ist eine Stufe der Pille Wofuer, jede
        Unterrolle aus data-g eine Taste in #hgx-subs, jede Groesse eine
        Stufe der Pille Groesse, und jedes Schiff hat einen Zweck (sonst
        findet es keine Stufe der Pille Wofuer). Dazu Proben durch die ausgelieferte Suche
        (#hgx-vocab, parseQuery, findShip, dockSearch) ueber die Karten aus
        dist/, je Sprache: Spitzname, Zweck mit Crew, Fracht, Preis,
        Tippfehler. Klinken: Karten mit eigenem Bild, Proben.
    20  Begehbare Innenraeume (seit 29.10.2026, Krisz: „ja ich will auch
        in die innenräume“). Je Hangarseite: opts.interior nennt je
        Werkslack-Datei, die ein Schiff zeigt, einen Innenraum in
        dist/hangar/interior und seine Liste /hangar-innen/<id>.json (Lampen
        und Einstiegspunkte, jede mit Lage, Version gleich der des
        Innenraums); sein Hüllquader liegt im Hüllquader des Rumpfs (aus dem
        JSON-Teil beider GLB, Rand 0,5 m), der Knopf #hgx-walk steht auf der
        Seite. Ohne Einstiegspunkte: WARNUNG. Klinke: Innenraeume. [17]
        zaehlt die Innenraeume in Ablage und Deckel mit.
    21  Stationen (seit 10.11.2026, ROADMAP Phase 22 H1, Krisz: „okay baus
        mal“). Je Hangarseite: die Leiste #hgx-st traegt genau die Stationen
        des ausgelieferten Controllers (STATIONS) als Reiter, in seiner
        Folge, und den Knopf „Als Tafel“; opts.holo.module ist
        /assets/hangar-holo3d.js?v= mit dem Inhalt als Version, und das
        Modul exportiert holoLayer; der Viewer liefert station, canStation
        und onStation. Proben durch parseState/serializeState: jede Station
        hin und zurueck, mit ?tafel=1 und beim Teilen (bleibt daheim), das
        alte ?pane=ship als Uebersicht, Unsinn faellt auf die Vorgabe.
        Tafel „Ausruestung“ (Krisz 10.11.2026: Loadout in die Uebersicht,
        „eine zentrale Bedieneroberflaeche“): die Werkstatt gibt board und
        act heraus, der Controller reicht beides an die Halle, das Modul
        zeichnet sie; und jedes Wort, das die Werkstatt mit m('…') holt,
        steht auf beiden Seiten in #hgl-msg. Fehlt eines, zeigt die
        gezeichnete Tafel den rohen Schluessel, und kein Textpruefer sieht
        ihn. Tafeln am Boden schauen zur Kamera (Krisz 11.11.2026: „die
        sollen richtung kamera schauen“; ein verkehrtes Vorzeichen drehte
        sie bis dahin von der Bildmitte weg): panelYaw und panelSpread des
        ausgelieferten Moduls werden geladen und fuer drei Linsen (Jaeger,
        grosses Schiff mit weitem Blick, kleine Tafel) in vier
        Blickrichtungen je links, rechts und in der Mitte nachgerechnet.
        Die aeussere Kante steht naeher an der Kamera als die innere, im
        Bild um hoechstens FACE_RISE hoeher und um genau so viel, solange
        die Tafel der Kamera nicht ganz zugewandt ist; geradeaus dreht sie
        sich gar nicht, und die Breite im Bild stimmt mit einer eigenen
        Projektion ueberein. FACE_RISE selbst steht auf der angesehenen
        und abgenommenen Staerke (KANTE_ANGESEHEN). Klinken: Stationen,
        Proben, Woerter, Stellungen.
    22  Datenblatt des Bauteils (seit 11.11.2026, Krisz: „man koennte die
        itemdatenblatt seite direkt in das hangar reinbauen fuer komponente
        und waffen“). Steht ein Slot offen, zeigt die rechte Tafel sein
        Bauteil. Naht: die Werkstatt liefert sheet und nimmt peek, der
        Controller reicht item weiter, das Modul zeichnet drawItem, schickt
        peek und bekommt vom Viewer das Modell (part). Rang-Rechnung: das
        ausgelieferte Skript der Werkstatt wird geladen, und classRank,
        classStrip und LOWER bestehen Proben mit festen Zahlen (Platz mit
        Gleichstand, weniger ist besser, fehlender Wert, Streifen). Ein
        falscher Platz saehe auf der Tafel so glaubwuerdig aus wie ein
        richtiger. Wege: jedes Ziel von „Herstellen“ (cu) und jede
        Item-Seite (pg) liegt in dist/, in beiden Sprachen; sn und sl
        stehen genau an den Teilen mit Ladenpreis. Die Vorlagen der Links
        (data-item, data-pre) stehen an #hgl beider Seiten in ihrer
        Sprache. Klinken: Teile mit Laden, mit Rezept, mit Item-Seite,
        Proben.
    23  Raum der Kamera (seit 13.11.2026, Krisz: „es auch am glitchen wenn
        man zb grosse schiffe reinruft“). Die Grenze der Kamera war eine
        Kugel, die in die Breite der Halle passt; bei 21 Schiffen ragten
        Bug und Heck darueber hinaus, die Kamera stand ganz herausgezoomt
        im Rumpf, und bei 15 lag der Mindestabstand auf oder ueber der
        Kugel, also zoomte nichts. Kein Bild verriet es, solange niemand vor den Bug
        drehte. Der ausgelieferte Viewer wird geladen und camPlan rechnet
        jedes Schiff der Halle mit seinen Maszen aus dem Dock (Laenge und
        Breite: das Groessere aus data-v und dem Umriss data-fp; fehlt die
        Hoehe, wird sie geschaetzt): hinter Bug und Heck kommt die Kamera
        mindestens RAUM_LUFT m ueber die halbe Laenge, zwischen Mindest-
        abstand und Kugel bleiben mindestens RAUM_ZOOM m, der Gang zu den
        Stirnwaenden liegt im Raum (vor den Galerien, unter den Wannen,
        vor den Stirnwaenden), die Grenze ist rundum stetig (kein Sprung
        beim Drehen) und nirgends enger als die Kugel, und Schiffe bis
        34 m merken nichts (far = ball, Mindestabstand 0,45 x Spannweite). Dazu Proben mit festen Zahlen:
        die Grenzen von vier Schiffen, wie sie am 13.11.2026 gerendert und
        angesehen wurden. Wer CAM_AIR, CAM_SIDE, CAM_TOP, CAM_END oder
        CAM_NEAR aendert, rendert erst und zieht die Zahlen dann nach.
        Und am Rand des Gangs (Review der PR #354): Das Blickziel bleibt
        nicht in der Hallenmitte. Schieben traegt es bis neben den Gang
        (Carrack 5,75 m), ein Hardpoint liegt am Fluegelende. Dort sprang
        die Grenze beim Drehen von far auf die Kugel (Carrack 24,5 m,
        Idris 54,7 m bei 0,01 Grad), und bis dahin stand die Kamera ganz
        draussen neben dem Gang, wo der Federarm sie in einem Bild
        hereinriss (Carrack 37,6 m beim Schieben, 52,8 m beim Drehen).
        Je Schiff mit Gang werden 105 Ziele im, am und neben dem Gang
        gerechnet, je 2 859 Richtungen und 375 um 10 cm geschobene: Beim
        Drehen aendert sich die Grenze hoechstens um far² / Rand je
        Bogenmasz (Rand: Tiefe des Ziels der Startansicht im Gang), beim
        Schieben um far² / (Rand x Kugel) je Meter, am und neben dem Gang
        gilt die Kugel, jenseits der Kugel steht die Kamera im Gang, die
        Startansicht bleibt ungedaempft, und far ist hoechstens das
        RAUM_STEIL-Fache des Rands. Nicht endliche Zahlen sind
        ausdruecklich FEHLER: NaN besteht jeden Vergleich mit < und >,
        und eine Startansicht ohne Zahl (home: NaN) lief gruen durch.
        Und die Buehne nutzt den gerechneten Raum: Ihre Grenzen kommen
        aus camSpace, keepRoom laeuft nach controls.update vor keepFree.
        Und der Federarm ruht: Haelt eine Wand die Kamera vor dem
        gewuenschten Abstand, gleitet sie je Bild hinaus und camPull holt
        sie zurueck, je nach Start um Bruchteile eines Millimeters anders.
        Die Tafeln hielten sie darum nie fuer ruhend und fanden ihren
        Platz nicht (Ausruestung vor den Schiffswerten), der Viewer
        schlief nie ein. Mit der Raste (camRest) steht sie auf das Bit
        gleich: gerechnet an 16 Lagen ueber je 360 Bilder wechselnder
        Dauer, dazu rueckt die Wand heran und zurueck, und keepFree
        stellt die Kamera auf den Halt von camRest.
        Klinken: Schiffe, davon mit Gang, Proben, Lagen des Federarms,
        Ziele am Rand des Gangs.
    24  Hangargroessen (seit 13.11.2026, Krisz: „small Hangar, Medium,
        large und extra large einführen genau wie ingame, dann haben wir
        auch richtige grössenreferenzen“). Die Halle wuchs fuer jedes
        Schiff auf sein Masz, 19 verschiedene Hallen fuer 190 Schiffe.
        Jetzt rastet sie auf eine von vier Stufen ein (HALL_GROW.sizes im
        Viewer), und die Stufe eines Schiffs kommt aus seiner
        Groessenklasse (fuenftes Glied von models[id] in #hg-stage).
        Geprueft wird: (a) die Stufen selbst, vier in der Folge S, M, L,
        XL, die kleinste ohne Zuwachs, jede in jeder Richtung mindestens
        so grosz wie die vorige, je Seite in ganzen Schritten der
        Bodenkachel, und Feld und freie Hoehe jeder Stufe wie im Entwurf
        abgenommen (GROESSE_FELD: wer sie aendert, rendert erst); (b)
        jedes Schiff der Halle mit den Maszen wie in [23]: die Stufe der
        Seite ist die seiner Groessenklasse (vehicles.json), camPlan des
        ausgelieferten Viewers nennt eine Stufe und genau deren Zuwachs,
        nie eine kleinere als die des Schiffs, und das Schiff steht mit
        1 m Rand auf dem Feld und 4 m unter den Wannen (hier selbst
        nachgemessen, nicht dem Viewer geglaubt); (c) Abweichungen von der
        Groessenklasse sind benannt (GROESSE_AUSNAHMEN, je mit Anlass und
        Zombie-Waechter): Der Clipper ist breiter als das Feld seiner
        Stufe, die Javelin faszt keine. Eine neue Abweichung ohne Eintrag
        ist WARNUNG, kein FEHLER: Die Halle faszt das Schiff, und die
        Zeile nennt die Halle, in der es steht; (d) die Naht: growFor
        nimmt growPick und meldet die Stufe, show() traegt Id und Stufe
        in die Masze, der Controller gibt die Stufe mit und hoert auf
        onHangar, Titelblock und Hologramm bekommen die Zeile; (e) die
        Woerter der Zeile stehen auf beiden Seiten, mit ihren
        Platzhaltern, deutsch anders als englisch. Klinken: Schiffe, je
        Stufe, Stellen der Naht, Woerter.

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
     g2 dort TEX_PHONE_AUTO = 512 (13.11.2026: die Automatik am
        Telefon luede wieder 512 MB Texturen)                        -> [12]
     g3 dort TEX_PHONE mittel: 512 (die Stufen von Hand laegen
        wieder aufeinander)                                         -> [12]
     g4 dort dem Loader den Deckel nehmen (embeddedImages(8, …)
        ohne SMALL ? TEX_MAX : 0): alle Bilder wieder in voller
        Groesse zugleich im Speicher                                -> [12]
     g5 dort in limiter() den Platz nach einer Aufgabe nicht mehr
        freigeben (.finally(done) gestrichen): 3 von 12 Aufgaben,
        das Laden bliebe nach drei Bildern stehen                   -> [12]
     g6 dort in fitSize() Math.max durch Math.min ersetzen: ein
        Bild 1024 x 512 kaeme mit 512 x 256 statt 256 x 128         -> [12]
     g7 in dist/assets/hangar-overview.js sofort: TELEFON durch
        sofort: false ersetzen (am Telefon zaehlte der erste
        Abbruch wieder nur)                                         -> [12]
     g8 dort laufPhase('steht') streichen (die Spur hielte jeden
        Abbruch fuer einen beim Aufbau)                             -> [12]
     g9 in dist/de/hangar.html data-spur-kontext streichen (die
        Zeile liesse aus, was abbrach)                              -> [12]
     g10 dort WAECHTER.v auf 1 (alte Deckel gaelten wieder)         -> [12]
     g11 in dist/assets/hangar-viewer.js TEX_PHONE_CAP mittel: 256
        (unter dem Deckel des Waechters luede jede Stufe wieder
        dieselbe Kante)                                             -> [12]
     g12 in dist/assets/hangar-overview.js meldungPlatz(); nach
        fallback.hidden = false in noStage() streichen (am Telefon
        ragte die Meldung mit Verlauf in die Knoepfe des Titels)    -> [12]
     g13 dort in waechterOffen() die Pruefung o.v !== WAECHTER.v
        streichen (ein Lauf von vor einem Update setzte der neuen
        Halle am Telefon sofort einen Deckel)                       -> [12]
     g14 dort meldungPlatz(); nach dem Tausch der Regionen in
        showBay() streichen (ein laengerer Schiffsname schoebe die
        Knoepfe des Titels unter eine sichtbare Meldung)            -> [12]
     g15 in dist/assets/hangar-viewer.js in fitImage() return own
        durch return null ersetzen: ohne createImageBitmap bliebe
        jedes Bild gross, 903 statt 198 MB Texturen                 -> [12]
     g16 in dist/assets/hangar-overview.js in offenSetzen() die
        Zeile laeufeAendern(…) streichen (14.11.2026: der Vermerk
        stuende wieder nur in der Registerkarte, und ein Browser,
        der sie nach dem Absturz neu aufbaut, luede ohne Ende)      -> [12]
     g17 dort in waechterBefund() die Zeile mit wie: 'start'
        streichen (ohne Vermerk zaehlte am Telefon nichts mehr)     -> [12]
     g18 dort anlaufSetzen(); nach offenSetzen(); in startBuehne
        streichen (kein Start truege sich mehr ein)                 -> [12]
     g19 dort in waechterLeicht() !!telefon durch false ersetzen
        (unter dem Deckel luede das Telefon dreimal die echte
        Halle, rund 950 statt 340 MB)                               -> [12]
     g20 dort hall: null, crew: null aus dem Aufruf nehmen (die
        leichte Buehne bekaeme die echte Halle doch)                -> [12]
     g21 dort WAECHTER.anlauf.zahl auf 4 (ohne Vermerk liefe die
        Schleife zehn statt sechs Laeufe)                           -> [12]
     g22 dort WAECHTER.anlauf.ruhe auf 5e3 (die Liste der Starts
        waere leer, bevor der Speicher nach dem Laden faellt)       -> [12]
     g23 in dist/de/hangar.html den Knopf #hgx-leicht-voll
        streichen (aus der leichten Ansicht fuehrte kein Weg zur
        vollen Halle)                                               -> [12]
     g24 dort data-geraet an #hg-fallback streichen (die Meldung
        nennte das Geraet nicht mehr)                               -> [12]
     g25 in dist/assets/hangar-viewer.js if (!REAL) buildStage();
        streichen (ohne echte Halle stuende das Schiff im Leeren)   -> [12]
     g26 in dist/assets/hangar-overview.js anlaufAbschied(); aus
        dem pagehide-Lauscher nehmen (wer die Seite dreimal kurz
        besucht, bekaeme die leichte Ansicht)                       -> [12]
     g27 dort in abbruch() die Zeile anlaufWeg(); streichen
        (derselbe Abbruch zaehlte ueber die Starts noch einmal)     -> [12]
     g28 dort im Vermerk der Registerkarte v: WAECHTER.v streichen
        (kein Vermerk der Registerkarte zaehlte mehr)               -> [12]
     g29 dort in waechterStart() das return 'aus' nach einem
        nicht gemerkten Abbruch streichen                           -> [12]
     g30 dort anlaufAbschied(); aus laufEnde() nehmen (drei Starts
        mit Meldung zaehlten als Abbruch)                           -> [12]
     h  dist/hangar/weapons/ndb-30-repeater.glb loeschen             -> [13]
     i  in dist/hangar-layouts.json models leeren                    -> [13]
     i2 dist/hangar/components/POWR_AEGS_S04_Idris_SCItem.glb
        loeschen (Serienteil von 36 Ankern)                         -> [13]
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
     u  in dist/hangar/ships/aegs-gladius.glb dem Material
        metal_steel_025 den Namen nehmen (27.10.2026, nach dem
        Nachtrag: aegs-gladius 25072 Dreiecke)                      -> [18]
     v  in dist/hangar/ships/rsi-scorpius-antares.glb dem namenlosen
        Material einen Namen geben (Ausnahme ohne Anlass)            -> [18]
     w  dist/hangar/cards/top/aegs-gladius.webp loeschen             -> [19]
     x  in dist/hangar.html einem data-q ein „Jäger“ geben           -> [19]
     y  in dist/hangar.html im #hgx-vocab den Spitznamen cutty
        streichen (29.10.2026: „cutty“ -> drak-cutter vorn)          -> [19]
     z  Bau vor dem Nachtrag in finder.ts (Laufbahn, Boden ohne
        Rollendaten): 6 Schiffe ohne Zweck (vier ATLS, Clipper,
        Retaliator)                                                  -> [19]
    aa  in dist/hangar/interior/misc-freelancer.glb die Wurzeln um
        6 m nach hinten setzen (30.10.2026: ragt 1.81 m ueber den
        Rumpf)                                                       -> [20]
    bb  dist/hangar-innen/drak-cutlass-black.json loeschen           -> [20]
    cc  Bau mit 5 statt 26 Innenraeumen (30.10.2026, vor dem
        zweiten Stapel des PCs: Klinke 26)                          -> [20]
    dd  in dist/assets/hangar-overview.js ?pane=ship nicht mehr als
        Uebersicht lesen                                            -> [21]
    ee  dist/assets/hangar-holo3d.js nach dem Bauen aendern (Version
        passt nicht mehr zum Inhalt)                                -> [21]
    ff  den Schluessel station, aus dem Rueckgabeobjekt von
        dist/assets/hangar-viewer.js streichen (Kommentare nennen ihn
        weiter; bis cubic auf PR #327 hielten sie die Pruefung gruen) -> [21]
    gg  in dist/assets/hangar-holo3d.js beim Material der Tafel
        depthTest: false streichen (10.11.2026: Halle schnitt die
        Ironclad-Tafel an)                                          -> [21]
    hh  in dist/hangar.html das Wort data-m="holo.title" aus #hgl-msg
        streichen (10.11.2026: vor dem Neubau stand „HOLO.TITLE“ als
        Kopf der Tafel)                                             -> [21]
    ii  in dist/assets/hangar-layouts.js board aus der Rueckgabe von
        initWorkshop streichen                                      -> [21]
    jj  in dist/hangar-layouts.json dem Attrition-3 als Weg ins
        Crafting (cu) eine Seite geben, die es nicht gibt           -> [22]
    kk  in dist/assets/hangar-holo3d.js drawItem umbenennen (die
        rechte Tafel bliebe beim Schiff; [21] reisst mit, weil die
        Version nicht mehr zum Inhalt passt)                        -> [22]
    ll  in dist/assets/hangar-layouts.js classRank um eins
        verschieben (rank: better statt better + 1): jeder Platz
        auf der Tafel saehe richtig aus und waere falsch            -> [22]
    mm  in dist/hangar.html data-item von #hgl streichen (der Knopf
        „Item-Seite“ fehlte auf der englischen Tafel)               -> [22]
    nn  Neubau mit der Reparatur vertauschter Netze ohne leeren
        Anker (11.11.2026: Starlifter-Kraftwerke, Bugwaffe 300i und
        350r, 2212 statt 2220 Tausch-Ports)                         -> [13]
    oo  in dist/assets/hangar-holo3d.js panelYaw zur falschen Seite
        drehen (flat - statt flat +): die aeussere Kante stuende
        -7,6 % hoeher, die Tafel schaute weg                        -> [21]
    pp  dort den Export von panelYaw streichen: 0 statt 36
        Stellungen nachgerechnet                                    -> [21]
    qq  dort panelSpread immer 1 liefern lassen: die Tafel wuerde
        im Bild breiter als gezeichnet (1,0865)                     -> [21]
    ss  dort die Grenze aus panelYaw nehmen (immer ganz zur
        Kamera): 14,6 % am Jaeger, 30,4 % am grossen Schiff         -> [21]
    tt  dort FACE_RISE auf 0.08 setzen: die Stellungen bestuenden,
        die abgenommene Staerke gaelte nicht mehr                   -> [21]
    uu  in dist/assets/hangar-viewer.js die Grenzen von vor dem
        13.11.2026 (camSpace: min 0,45 x Spannweite, far = ball):
        kein Schiff mit Gang, kleinste Luft -23,50 m, kleinster
        Zoom 0 m, 100 Befunde                                       -> [23]
    vv  dort in camReach die Kugel nicht mehr als Untergrenze
        nehmen (return L): zur Seite stuende die Kamera naeher als
        bisher. Das Tor blieb dabei erst gruen; seither prueft es
        die Kugel als Untergrenze                                   -> [23]
    ww  dort CAM_SIDE auf [1, 0] setzen: der Gang reicht in die
        Galerien, und die abgenommenen Zahlen gelten nicht mehr     -> [23]
    xx  dort in camReach im Gang gleich far liefern (return L >
        sp.ball ? sp.far : sp.ball): die Grenze springt beim Drehen -> [23]
    yy  dort im Bild der Buehne keepRoom(); vor keepFree(); streichen:
        die Kamera bliebe nicht in dem Raum, den das Tor rechnet     -> [23]
    zz  dort die Raste des Federarms abstellen (camRest: same =
        false): 13 FEHLER, die Kamera stuende an 102 Stellen in 120
        Bildern, 0,38 mm auseinander (Carrack, Wand bei 75,98 m)    -> [23]
    ab  dort in keepFree die Kamera wieder nur auf das Ergebnis
        der Suche stellen (c.copy(keepAt(t, lo))): die gerechnete
        Ruhe gaelte im Hangar nicht                                 -> [23]
    ac  dort camReach wie im ersten Stand der PR #354 (let L =
        sp.far, ohne die Tiefe des Ziels): 197 Befunde, die Grenze
        springt beim Drehen (600i: 17,24 m bei 0,49 Grad, erlaubt
        1,48), neben dem Gang darf die Kamera bis far              -> [23]
    ad  dort neben dem Gang die Kugel, im Gang aber far ohne die
        Wurzel (let L = sp.far): 77 Befunde, 890 Jump 1,02 m vor dem
        Rand 57,87 m bei 0,49 Grad (erlaubt 4,84)                   -> [23]
    ae  dort statt der Wurzel die vierte Wurzel: 44 Befunde, die
        Grenze dreht steiler als um das Ziel der Startansicht
        (Carrack 3,62 m bei 0,49 Grad, erlaubt 3,21)                -> [23]
    af  dort in camSpace min = NaN: 190 Befunde „keine endliche
        Zahl“, alle 16 Proben rot. Das Tor von vor dem Review
        meldete dazu 0 Befunde, die 16 Proben bestanden mit NaN,
        nur die Klinke der Gaenge hielt                             -> [23]
    ag  dort in camSpace edge = 60: die Startansicht waere
        gedaempft (Carrack home 57,45 statt 74,03 m, 600i nur 0,16 m
        hinter Bug und Heck)                                        -> [23]
    ah  dort in camPlan home: NaN: 190 Befunde und 4 Proben rot.
        Das Tor von vor dem Review blieb dabei ganz gruen           -> [23]
    ai  in dist/assets/hangar-viewer.js die Zeile streichen, die
        capabilities.maxTextures anhebt (13.11.2026)                -> [12]
    aj  dort den Getter colorTexture von BatchedMesh streichen      -> [12]
    ak  in dist/assets/hangar-holo3d.js forceSinglePass aus basic()
        nehmen ([21] reisst mit: Version passt nicht mehr)          -> [12]
    al  in dist/assets/hangar-viewer.js plane.deleteAttribute('normal')
        aus buildComposer() streichen (13.11.2026; im Browser reisst
        check:hangar-shader: 12 von 12 erst beim Probebild)         -> [12]
    am  dort eine Umgebungskugel wieder mit eigenem
        new THREE.PMREMGenerator(renderer) bauen                    -> [12]
    an  dort in texBudget() p.fragmentShader streichen              -> [12]
    ao  dort in captureHallEnv() stLayer?.mirror(true) streichen
        (13.11.2026: die Kugel der Halle kaeme wieder mit dem
        Schleier der Hologramme, halb so hell)                      -> [12]
    ap  dort in captureHallEnv() die Zeile const unrest = hallRest();
        streichen (13.11.2026: nach einem Schiffswechsel kaeme die
        Kugel wieder vom geschlossenen Tor statt vom Schiffsfeld,
        ein Viertel bis ein Drittel dunkler)                        -> [12]
    aq  dort in growStep() scaleLamps() am Ende des Gleitens wieder
        durch renderHallShadows() ersetzen (der Schatten des Schiffs
        bliebe nach dem Wechsel groeber als nach frischem Laden)    -> [12]
    (ar bis bb sind an die PR des Auswahlfensters der Ausruestung
     vergeben und kommen mit ihr)
    bc  in dist/assets/hangar-viewer.js "sizes" aus HALL_GROW nehmen
        (14.11.2026; die Halle wuechse wieder je Schiff: 7 Befunde,
        [23] reisst mit an den Proben Carrack, Idris-M und
        Constellation)                                              -> [24]
    bd  dort Medium 20 statt 24 m breiter: kein ganzer Kachelschritt,
        Feld 52 statt 56 m, die Ausnahme Clipper nennt die falsche
        Stufe; WARNUNG nennt Clipper und Star Runner in Large       -> [24]
    be  dort Large 72 statt 64 m laenger (Feld 88 x 168 m)          -> [24]
    bf  dort Medium und Large vertauscht                            -> [24]
    bg  dort in growPick die Stufe ohne Messen nehmen (if (true)):
        Clipper ragt 19,5 m ueber das Feld von Small, beide
        Ausnahmen verlieren ihren Anlass, [23] reisst an der Javelin -> [24]
    bh  dort growPick bei Small beginnen lassen statt bei der Stufe
        des Schiffs: 19 Befunde (600i in Medium statt Large), WARNUNG
        nennt 31 Schiffe                                            -> [24]
    bi  dort in growFor() die Zeile mit hangarTell() streichen      -> [24]
    bj  dort in show() hangar aus info nehmen                       -> [24]
    bk  in dist/assets/hangar-overview.js hangar aus dem Aufruf von
        viewer.show() nehmen                                        -> [24]
    bl  dort v.onHangar?.(onHangar) streichen                       -> [24]
    bm  in dist/hangar.html der Carrack in #hg-stage die Stufe S
        geben                                                       -> [24]
    bn  dort dem Clipper die Stufe M geben (Ausnahme ohne Anlass:
        Zombie-Waechter)                                            -> [24]
    bo  dort der Gladius das fuenfte Glied nehmen ([1] reisst mit:
        Form von models)                                            -> [24]
    bp  in dist/de/hangar.html data-own der Vorlage leeren          -> [24]
    bq  in dist/hangar.html die Zeile #hgx-gr streichen             -> [24]
    br  dort allen Schiffen der Stufe Medium S geben: 14 Befunde,
        WARNUNG nennt 22 Schiffe                                    -> [24]
    bs  in dist/assets/hangar-viewer.js t.hangar aus den Zeilen des
        Hologramms nehmen                                           -> [24]
    bt  in dist/assets/hangar-overview.js hangar aus labelOf() nehmen -> [24]

     node scripts/verify-hangar.mjs            Tor
     node scripts/verify-hangar.mjs --report   nur Ist-Werte, kein Urteil
                                               (zum bewussten Anheben)
   ============================================================ */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const GROESSEN = ['S', 'M', 'L', 'XL'];
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
    // fünftes Glied: Hangargröße des Schiffs ([24]), null in der Werkhalle und ohne Größenklasse
    const ok = Array.isArray(e) && e.length === 5 && typeof e[0] === 'string' && e[0] && (e[1] === null || typeof e[1] === 'string') && typeof e[2] === 'string' && (e[3] === 'halle' || e[3] === 'werk')
      && (e[4] === null || (e[3] === 'halle' && GROESSEN.includes(e[4])));
    if (ok) ids.push(id); else bad.push(`models["${id}"] hat nicht die Form [glb, tex|null, maker, 'halle'|'werk', ${GROESSEN.map((g) => `'${g}'`).join('|')}|null (nur auf dem Schiffsfeld)]`);
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
// Zahl einer Zeile des EN-Ueberblicks ("48,552 kg", "226 m/s", "1"); der Strich ist unbekannt.
// Die Besatzung steht als Spanne wie bei CIG ("2–4"); data-v traegt die Hoechstbesatzung.
const enNumber = (text) => {
  if (text.trim() === '–') return null;
  const first = text.replace(/,/g, '').trim().split(' ')[0];
  const span = /^(\d+)–(\d+)$/.exec(first);
  return Number(span ? span[2] : first);
};
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
  // cap: Deckel des Waechters der Seite (wiederholter Abbruch der Buehne,
  // assets/hangar-overview.js). Er senkt, auch unter eine Wahl von Hand, und
  // hebt nie.
  ['Apple GPU', { small: true, cap: 'mittel' }, 'mittel'],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', { forced: 'hoch', cap: 'niedrig' }, 'niedrig'],
  ['Mali-G52 MC2', { small: true, cap: 'hoch' }, 'niedrig'],
  ['Adreno (TM) 640', { small: true, memory: 8, cores: 8, cap: 'mittel' }, 'mittel'],
  ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', { cap: 'aus' }, 'hoch'],
];
const CHIPS_MIN = 30;
const LEVELS = ['niedrig', 'mittel', 'hoch'];
{
  let mod = null;
  try { mod = await import(pathToFileURL(viewerFile).href); } catch (e) { fail(`[12] dist/assets/hangar-viewer.js laedt nicht als Modul (${e.message})`); }
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
  // Texturdeckel am Telefon (Krisz, 12.11.2026: „Auf dem Handy laedt es die
  // ganze Zeit neu“). Ohne ihn lud die Halle im Telefonformat 905 MB
  // Texturen, mehr als ein Telefon einer Seite gibt. Seit 13.11.2026 („Das
  // Handy versucht es immer noch die ganze Zeit zu laden“) startet die
  // Automatik am Telefon in jeder Stufe mit TEL_TEX.auto px (gemessen in der
  // hohen Stufe: 206 statt 518 MB Texturen); eine Wahl von Hand bekommt drei Stufen mit
  // echtem Abstand, und unter dem Deckel des Waechters (cap) sinkt die
  // Kante mit jeder Stufe weiter, sonst senkte er ins Leere. Klinken: Deckel
  // nur nach unten; groesser nur per Commit, der den Grafikspeicher neu
  // misst und die Zahl nennt.
  const TEL_TEX = { auto: 256, hoch: 512, mittel: 384, niedrig: 256, capMittel: 192, capNiedrig: 128 };
  const tp = /const TEX_PHONE = \{ hoch: (\d+), mittel: (\d+), niedrig: (\d+) \}, TEX_PHONE_AUTO = (\d+), TEX_PHONE_CAP = \{ mittel: (\d+), niedrig: (\d+) \};/.exec(viewer);
  const telZeile = /const TEX_MAX = SMALL \? \(FORCED \? TEX_PHONE\[Q0\] : \(opts\.cap === Q0 && TEX_PHONE_CAP\[Q0\]\) \|\| TEX_PHONE_AUTO\) :/.test(viewer);
  const telWirkt = /if \(TEX_MAX\) await shrinkTextures\(/.test(viewer);
  const [tHoch, tMittel, tNiedrig, tAuto, tCapM, tCapN] = tp ? tp.slice(1).map(Number) : [0, 0, 0, 0, 0, 0];
  const telOk = !!tp && telZeile && telWirkt && tAuto > 0 && tAuto <= TEL_TEX.auto && tNiedrig > 0 && tNiedrig <= TEL_TEX.niedrig
    && tMittel > tNiedrig && tMittel <= TEL_TEX.mittel && tHoch > tMittel && tHoch <= TEL_TEX.hoch
    && tCapN > 0 && tCapN <= TEL_TEX.capNiedrig && tCapM > tCapN && tCapM <= TEL_TEX.capMittel && tCapM < tAuto;
  sollIst(`Texturen am Telefon: Automatik hoechstens ${TEL_TEX.auto} px, unter dem Deckel des Waechters ${TEL_TEX.capMittel}/${TEL_TEX.capNiedrig} px, von Hand hoechstens ${TEL_TEX.hoch}/${TEL_TEX.mittel}/${TEL_TEX.niedrig} px, jede Stufe kleiner als die darueber`,
    !tp ? 'kein Deckel gefunden' : !telZeile ? 'Deckel da, aber TEX_MAX liest ihn nicht mehr so' : !telWirkt ? 'Deckel da, aber nicht mehr angewandt' : `Automatik ${tAuto} px, unter dem Deckel ${tCapM}/${tCapN} px, von Hand ${tHoch}/${tMittel}/${tNiedrig} px`);
  if (!telOk) fail(`[12] dist/assets/hangar-viewer.js: der Texturdeckel am Telefon fehlt, wirkt nicht mehr, liegt ueber der Klinke (Automatik ${TEL_TEX.auto} px, unter dem Deckel des Waechters ${TEL_TEX.capMittel}/${TEL_TEX.capNiedrig} px, von Hand ${TEL_TEX.hoch}/${TEL_TEX.mittel}/${TEL_TEX.niedrig} px) oder seine Stufen liegen nicht mehr auseinander: mit vollen Texturen brauchte die Halle am Telefon ueber 1 GB Grafikspeicher und lud in einer Schleife neu, und wo jede Stufe dieselbe Kante laedt, senkt der Waechter ins Leere`);
  // Am Telefon kommen die Bilder schon klein aus dem Loader (13.11.2026).
  // Vorher packte jede Datei alle ihre Bilder in voller Groesse aus, und
  // der Deckel verkleinerte erst danach: bis zu 818 MB ausgepackte Bilder
  // zugleich, in der niedrigen Stufe 698 MB (Telefonformat, Gladius). Der
  // Loader bekommt den Deckel, packt hoechstens FIT_MAX Bilder zugleich aus
  // und gibt das grosse frei, sobald das kleine steht. Die beiden Helfer
  // rechnet das Tor am ausgelieferten Modul nach.
  const FIT_MAX = 4;
  const ladeDeckel = /embeddedImages\(\d+, [^\n]*, SMALL \? TEX_MAX : 0(?:, ktxTwin)?\);/.test(viewer);   // seit 13.11.2026 folgt der Weg zu den komprimierten Zwillingen (verify:hangar-ktx)
  const fitZugleich = Number(/const FIT_AT_ONCE = (\d+);/.exec(viewer)?.[1] ?? NaN);
  const kleinPacken = /const gate = max \? limiter\(FIT_AT_ONCE\) : null;/.test(viewer)
    && /const big = await decode\(\), small = await fitImage\(big, max\);[^}]{0,160}big\.close\(\);/.test(viewer);
  // Browser ohne createImageBitmap: fitImage gibt als letzten Ausweg eine
  // eigene Leinwand je Bild zurueck, nie die gemeinsame (fitCv), die das
  // naechste Bild ueberschreibt. Ohne den Ausweg blieb dort jedes Bild gross
  // (nachgestellt im Telefonformat: 903 statt 198 MB Texturen).
  const fitKoerper = /async function fitImage\(im, max\) \{[\s\S]*?\n\}\n/.exec(viewer)?.[0] ?? '';
  const eigeneLeinwand = /const own = document\.createElement\('canvas'\);[\s\S]{0,200}?drawImage\(fitCv, 0, 0\);\s*return own;/.test(fitKoerper) && !/return fitCv\b/.test(fitKoerper);
  let fitIst = 'fitSize fehlt', limIst = 'limiter fehlt', fitOk = false, limOk = false;
  if (typeof mod?.fitSize === 'function') {
    const soll = [[256, 128], [64, 256], null, null, [512, 1], [1, 256]];
    const ist = [[1024, 512, 256], [300, 1200, 256], [256, 256, 256], [0, 0, 256], [4096, 1, 512], [2, 2048, 256]].map((a) => mod.fitSize(...a));
    fitOk = JSON.stringify(ist) === JSON.stringify(soll);
    fitIst = fitOk ? `${soll.length} Groessen richtig` : `falsch: ${JSON.stringify(ist)}`;
  }
  if (typeof mod?.limiter === 'function' && fitZugleich >= 1) {
    const N = 12, lim = mod.limiter(fitZugleich), folge = [];
    let jetzt = 0, hoechst = 0, fehler = 0, frist = null;
    const alle = Promise.all(Array.from({ length: N }, (_, k) => lim(async () => {
      jetzt++; hoechst = Math.max(hoechst, jetzt); folge.push(k);
      await new Promise((r) => setTimeout(r, k % 3));
      jetzt--;
      // eine Aufgabe scheitert: ihr Platz muss trotzdem frei werden
      if (k === 4) throw new Error('Probe');
    }).catch(() => { fehler++; })));
    // Gibt der Limiter einen Platz nicht frei, wartet der Rest ewig: Frist statt haengendem Tor
    const fertig = await Promise.race([alle.then(() => true), new Promise((r) => { frist = setTimeout(() => r(false), 3000); })]);
    clearTimeout(frist);
    const inReihe = folge.join() === Array.from({ length: folge.length }, (_, k) => k).join();
    limOk = fertig && folge.length === N && hoechst === Math.min(N, fitZugleich) && fehler === 1 && inReihe;
    limIst = `${folge.length} von ${N} Aufgaben gelaufen${fertig ? '' : ' (der Rest wartet nach 3 s noch)'}, hoechstens ${hoechst} zugleich${inReihe ? '' : ', Reihenfolge vertauscht'}`;
  }
  const packOk = ladeDeckel && kleinPacken && fitZugleich >= 1 && fitZugleich <= FIT_MAX && fitOk && limOk;
  sollIst(`Telefon: Bilder kommen verkleinert aus dem Loader, hoechstens ${FIT_MAX} zugleich in voller Groesse`,
    !ladeDeckel ? 'der Loader bekommt den Deckel nicht' : !kleinPacken ? 'das Auspacken verkleinert nicht mehr oder gibt das grosse Bild nicht frei' : `${Number.isFinite(fitZugleich) ? fitZugleich : 'ohne Zahl'} zugleich; ${fitIst}; ${limIst}`);
  if (!packOk) fail(`[12] dist/assets/hangar-viewer.js: am Telefon packt der Loader die Bilder nicht mehr klein aus (erwartet: embeddedImages(…, SMALL ? TEX_MAX : 0), darin limiter(FIT_AT_ONCE) mit hoechstens ${FIT_MAX}, fitImage(big, max) und big.close(); fitSize und limiter rechnen wie beschrieben): jede Datei laege wieder mit allen Bildern in voller Groesse im Speicher, 818 MB zugleich statt 129 MB, in jeder Stufe gleich`);
  sollIst('fitImage ohne createImageBitmap: eigene Leinwand je Bild als letzter Ausweg, nie die gemeinsame', !fitKoerper ? 'fitImage nicht gefunden' : eigeneLeinwand ? 'eigene Leinwand, fitCv bleibt intern' : 'kein Ausweg, oder die gemeinsame Leinwand wird selbst zurueckgegeben');
  if (!eigeneLeinwand) fail('[12] dist/assets/hangar-viewer.js: fitImage() hat keinen Ausweg mehr fuer Browser ohne createImageBitmap (erwartet: eine eigene Leinwand je Bild, gezeichnet von fitCv, und fitCv selbst wird nie zurueckgegeben): shrinkTextures() liesse dort jedes Bild in voller Groesse, im Telefonformat 903 statt 198 MB Texturen');
  // Drei Leerlaeufe des Zeichners (Krisz, 13.11.2026: „es braucht viel zu
  // viele Ressourcen“), gemessen mit der Gladius in der hohen Stufe auf
  // einer RTX 3070 Ti mit i5-13400F: three r185 warnte je Bild rund 100 Mal
  // vor der 17. Textureinheit (2 500 bis 7 000 Zeilen je Sekunde in der
  // Konsole), suchte fuer jedes BatchedMesh bei jedem Zeichnen das
  // Shaderprogramm neu (91 Mal je Bild) und zeichnete 30 Hologrammflaechen
  // in zwei Zuegen. Zusammen 13,2 statt 10,0 ms Rechenzeit je Bild beim
  // Drehen im sichtbaren Fenster: Der Hauptfaden war zu 90 statt zu 61 %
  // belegt, die 60 Bilder je Sekunde hielt er in beiden Faellen. (Ohne
  // Fenster, wo der Browser nur auf den E-Kernen rechnet, waren es 33
  // statt 25 ms und 28 statt 37 Bilder je Sekunde.) Faellt eine der drei
  // Stellen weg, aendert sich kein Bild, nur die Last: Darum haelt dieses
  // Tor sie fest. Wer three anhebt und eine Stelle dort behoben findet,
  // nimmt sie hier mit Begruendung heraus.
  const holoQ = existsSync(join(DIST, 'assets', 'hangar-holo3d.js')) ? readFileSync(join(DIST, 'assets', 'hangar-holo3d.js'), 'utf8') : '';
  const LEERLAUF = [
    ['Warnflut zur Textureinheit', /getParameter\(gl\.MAX_COMBINED_TEXTURE_IMAGE_UNITS\);\s*if \(units > renderer\.capabilities\.maxTextures\) renderer\.capabilities\.maxTextures = units;/.test(viewer),
      'dist/assets/hangar-viewer.js hebt renderer.capabilities.maxTextures nicht mehr auf MAX_COMBINED_TEXTURE_IMAGE_UNITS: three warnt dann wieder bei jedem Zeichnen mit mehr als 16 Textureinheiten, tausende Zeilen je Sekunde'],
    ['Shaderprogramm je BatchedMesh', /if \(!\('colorTexture' in THREE\.BatchedMesh\.prototype\)\) \{\s*Object\.defineProperty\(THREE\.BatchedMesh\.prototype, 'colorTexture', \{[^}]*get\(\) \{ return this\._colorsTexture; \}/.test(viewer),
      'dist/assets/hangar-viewer.js gibt BatchedMesh kein colorTexture mehr: three r185 sucht dann fuer Wartungsplatz, Hallendeko und Schachttor bei jedem Zeichnen das Shaderprogramm neu'],
    ['Hologrammflaechen in einem Zug', /const basic = \([^\n]*\n[^\n]*new THREE\.MeshBasicMaterial\(\{[^\n}]*side: THREE\.DoubleSide[^\n}]*forceSinglePass: true/.test(holoQ),
      'dist/assets/hangar-holo3d.js: basic() baut die Flaechen der Hologramme ohne forceSinglePass: three zeichnet sie dann in zwei Zuegen und setzt beide Male das Material neu auf'],
  ];
  sollIst('Leerlaeufe des Zeichners abgestellt (3 Stellen)', LEERLAUF.filter((l) => l[1]).length === LEERLAUF.length ? `${LEERLAUF.length} von ${LEERLAUF.length}` : `${LEERLAUF.filter((l) => l[1]).length} von ${LEERLAUF.length}, fehlt: ${LEERLAUF.filter((l) => !l[1]).map((l) => l[0]).join(', ')}`);
  for (const [, ok, msg] of LEERLAUF) if (!ok) fail(`[12] ${msg} (13.11.2026)`);
  // Bilder nach dem Hochladen aus dem Arbeitsspeicher (Krisz, 13.11.2026,
  // derselbe Anlass). Gemessen mit der Gladius in der hohen Stufe: 901
  // ausgepackte Bilder mit 1.055 MB lagen neben ihren Texturen bei der
  // Grafikkarte noch in der Seite, die damit 2,1 statt 1,0 GB hielt. Faellt
  // eine der Stellen weg, sieht kein Bild anders aus, nur der Speicher
  // waechst wieder (oder, bei der letzten, ein Verlust des Zeichenkontexts
  // fuellt die Konsole mit Fehlern). Ob auf einem Weg ein freigegebenes
  // Bild noch einmal verlangt wird, prueft check:hangar-shader im Browser.
  const FREI = [
    ['Texturen je Bildquelle gemerkt', /return \{ name: 'hg_embedded_images', afterRoot: noteTextures \};/.test(viewer) && /function noteTextures\(result\) \{/.test(viewer),
      'dist/assets/hangar-viewer.js: der Loader merkt sich die Texturen je Bildquelle nicht mehr (afterRoot: noteTextures): freeImages() gibt dann kein Bild mehr frei'],
    ['Freigabe nach dem Hochladen', /renderer\.initTexture\(t\);[\s\S]{0,160}?\}\s*freeImages\(tex\);/.test(viewer),
      'dist/assets/hangar-viewer.js: prepare() ruft freeImages(tex) nach dem Hochladen nicht mehr: die ausgepackten Bilder bleiben im Arbeitsspeicher, rund 1 GB in der hohen Stufe'],
    ['Bild geschlossen, Platzhalter an seiner Stelle', /im\.close\(\);\s*src\.data = goneImage\(/.test(viewer),
      'dist/assets/hangar-viewer.js: freeImages() schliesst das Bild nicht mehr oder setzt keinen Platzhalter: entweder bleibt der Speicher belegt, oder three.js laedt ein geschlossenes Bild hoch und das Zeichnen bricht ab'],
    ['still nach Verlust des Zeichenkontexts', /addEventListener\('webglcontextlost', \(\) => \{ texQuiet = true;/.test(viewer),
      'dist/assets/hangar-viewer.js stellt die Freigabe nach einem Verlust des Zeichenkontexts nicht mehr still (texQuiet): three.js laedt danach alles neu hoch, und jeder Platzhalter meldet einen Fehler'],
  ];
  sollIst(`Bilder nach dem Hochladen freigegeben (${FREI.length} Stellen)`, FREI.filter((l) => l[1]).length === FREI.length ? `${FREI.length} von ${FREI.length}` : `${FREI.filter((l) => l[1]).length} von ${FREI.length}, fehlt: ${FREI.filter((l) => !l[1]).map((l) => l[0]).join(', ')}`);
  for (const [, ok, msg] of FREI) if (!ok) fail(`[12] ${msg} (13.11.2026)`);
  // Geometrie der Halle nach dem Hochladen aus dem Arbeitsspeicher (Krisz,
  // 13.11.2026, derselbe Anlass). Gemessen mit der Gladius in der hohen
  // Stufe: 240 MB an Attribut- und Indexpuffern lagen neben ihren Kopien
  // bei der Grafikkarte noch in der Seite, 183 MB davon in einfachen Netzen
  // der Halle; die Freigabe nimmt 159 MB heraus. Faellt eine der Stellen
  // weg, sieht kein Bild anders aus, nur der Speicher waechst wieder (oder,
  // bei der zweiten, bleibt die Einrichtung nach einem Wechsel auf ein
  // groesseres Schiff in der falschen Groesse stehen; bei der dritten
  // verschwinden Netze der Halle beim Drehen, weil three ihre Kugel aus
  // einem leeren Puffer rechnet). Ob auf einem Weg ein
  // freigegebener Puffer noch einmal gelesen wird, prueft
  // check:hangar-shader im Browser.
  const GEO = [
    ['Halle und Werkhalle vor dem Hochladen angemeldet', /hallClosing = true;[\s\S]{0,300}?freeGeometry\(model\b[^\n]*\);\s*if \(werk\) freeGeometry\(werk\.group\);\s*await prepare\(model\);/.test(viewer),
      'dist/assets/hangar-viewer.js: der Bau der Halle meldet ihre Netze nicht mehr vor prepare(model) zur Freigabe an (freeGeometry(model), freeGeometry(werk.group)): die Kopien der Geometrie bleiben im Arbeitsspeicher, rund 160 MB in der hohen Stufe'],
    ['Ecken der Moebel bleiben', /freeGeometry\(model, new Set\(furniture\.map\(\(f\) => f\.mesh\.geometry\.attributes\.position\)\)\);/.test(viewer) && /\|\| keep\?\.has\(at\)\) continue;/.test(viewer),
      'dist/assets/hangar-viewer.js: freeGeometry() laesst die Ecken der Moebel nicht mehr stehen (keep): waechst die Halle mit einem groesseren Schiff, rechnet scaleFurniture() sie aus einem leeren Puffer, und die Einrichtung bleibt in der falschen Groesse stehen'],
    ['Kugel und Kasten vorher gerechnet', /if \(!g\.boundingBox\) g\.computeBoundingBox\(\);\s*if \(!g\.boundingSphere\) g\.computeBoundingSphere\(\);[\s\S]{0,400}?at\.onUpload\(/.test(viewer),
      'dist/assets/hangar-viewer.js: freeGeometry() rechnet Kugel und Kasten nicht mehr, bevor es die Freigabe anmeldet: three rechnet sie dann beim ersten Zeichnen aus einem schon leeren Puffer, und das Netz faellt aus der Sichtpruefung'],
    ['Freigabe im Moment des Hochladens, mit Falle', /at\.onUpload\(function \(\) \{\s*if \(texQuiet\) return;[\s\S]{0,300}?goneArray\(this, label\);/.test(viewer) && /console\.error\(`\[hangar\] Geometrie nach der Freigabe noch einmal verlangt/.test(viewer),
      'dist/assets/hangar-viewer.js: freeGeometry() gibt den Puffer nicht mehr beim Hochladen frei (onUpload, goneArray), oder die Falle meldet einen spaeteren Leser nicht mehr: entweder bleibt der Speicher belegt, oder ein Leser rechnet still mit einem leeren Puffer'],
    ['nur einfache Netze', /if \(!n\.isMesh \|\| n\.isBatchedMesh \|\| n\.isSkinnedMesh \|\| n\.isInstancedMesh\) return;\s*const g = n\.geometry;\s*if \(!g \|\| !g\.attributes\.position \|\| Object\.keys\(g\.morphAttributes\)\.length\) return;/.test(viewer),
      'dist/assets/hangar-viewer.js: freeGeometry() nimmt BatchedMesh, Netze mit Knochen, Instanzen oder Morphzielen nicht mehr aus: three liest deren Puffer nach dem Hochladen noch (Kugel je Teil, Knochenkasten, Morphziele)'],
  ];
  sollIst(`Geometrie der Halle nach dem Hochladen freigegeben (${GEO.length} Stellen)`, GEO.filter((l) => l[1]).length === GEO.length ? `${GEO.length} von ${GEO.length}` : `${GEO.filter((l) => l[1]).length} von ${GEO.length}, fehlt: ${GEO.filter((l) => !l[1]).map((l) => l[0]).join(', ')}`);
  for (const [, ok, msg] of GEO) if (!ok) fail(`[12] ${msg} (13.11.2026)`);
  // Stillstand beim Laden (Krisz, 13.11.2026, derselbe Anlass). Gemessen
  // im sichtbaren Fenster, jeder Aufruf am Zeichenkontext gestoppt: Die
  // Shader der Vollbildpaesse wurden vorab uebersetzt, aber mit einer
  // Geometrie mit Normalen, und three fuehrt das im Schluessel eines
  // Programms. Die zwoelf Programme benutzte nie jemand, das Probebild
  // uebersetzte die echten im Stehen (1,2 s, davon 1 s der Entrauscher der
  // Verdeckung). Jede Umgebungskugel baute ihren eigenen PMREM-Generator
  // und gab ihn frei, die zweite uebersetzte dessen Shader deshalb noch
  // einmal (0,4 s kurz nach dem ersten Bild). Und die Zaehlung der Texturen
  // fragte je Programm zweimal beim Grafikprozess nach dem Typ seiner
  // Shader. Faellt eine Stelle weg, sieht kein Bild anders aus, die Seite
  // steht nur wieder. Ob die Paesse wirklich vorab uebersetzt sind, prueft
  // check:hangar-shader im Browser.
  const pmremNeu = (viewer.match(/new THREE\.PMREMGenerator\(/g) ?? []).length;
  const STILLSTAND = [
    ['Vollbildpaesse ohne Normalen vorab', /plane\.deleteAttribute\('normal'\);[\s\S]{0,600}?await compileFor\(quad, rt, quad\);/.test(viewer) && /Vollbildpässe: \$\{spaet\} von/.test(viewer),
      'dist/assets/hangar-viewer.js: buildComposer() uebersetzt die Shader der Vollbildpaesse nicht mehr mit einer Geometrie ohne Normalen vorab (oder meldet es nicht mehr): das Probebild uebersetzt sie dann im Stehen, 1,2 s Stillstand bei jedem ersten Besuch'],
    ['ein PMREM-Generator fuer alle Kugeln', pmremNeu === 1 && /function pmremFor\(renderer\) \{/.test(viewer),
      `dist/assets/hangar-viewer.js baut ${pmremNeu} statt 1 PMREM-Generator (pmremFor): jeder eigene uebersetzt seine Shader neu, 0,4 s Stillstand kurz nach dem ersten Bild`],
    ['Texturzaehlung ohne Rueckfrage', /const frag = p\.fragmentShader \?\? /.test(viewer),
      'dist/assets/hangar-viewer.js: texBudget() nimmt den Bildshader nicht mehr von three (p.fragmentShader): die Suche ueber den Typ fragt je Programm zweimal beim Grafikprozess nach und wartet mitten im Laden auf die Antwort'],
    // Farbmittel nur, wo es jemand liest (13.11.2026). imageMean() lief fuer
    // jede Farbkarte jeder Datei: 439 Messungen beim Laden der Gladius in der
    // hohen Stufe, 324 davon fuer die Halle, zusammen 0,45 bis 0,5 s
    // Rechenzeit im Hauptfaden (im Viewer gestoppt, sichtbares Fenster);
    // gelesen wird das Mittel nur in dressTextured() (Schiff, Tauschteile,
    // Innenraum). Jetzt 115 Messungen und 0,11 s. Ob das Schiff seine Mittel
    // noch bekommt, prueft check:hangar-shader im Browser.
    ['Farbmittel nur fuer Dateien des Schiffs', /if \(mean && colour\.has\(i\)\) t\.userData\.mean = await imageMean\(bitmap\);/.test(viewer)
      && /const hallLoader = new GLTFLoader\(\)\.setDRACOLoader\(draco\)\.register\(images\(false\)\);/.test(viewer)
      && /\(HALL_FILES\.has\(key\) \? hallLoader : loader\)\.load\(url, /.test(viewer)
      && ['hall', 'furniture', 'workshop', 'workshop-floor', 'dienst', 'werk', 'werkdecke', 'deko'].every((k) => new RegExp(`const HALL_FILES = new Set\\(\\[[^\\]]*'${k}'`).test(viewer)),
      'dist/assets/hangar-viewer.js misst das Mittel der Farbkarten wieder fuer die Dateien der Halle (hallLoader mit images(false), HALL_FILES in fetchGltf): 324 Messungen im Hauptfaden, die niemand liest, 0,35 s Rechenzeit bei jedem Laden'],
  ];
  sollIst(`Stillstand beim Laden abgestellt (${STILLSTAND.length} Stellen)`, STILLSTAND.filter((l) => l[1]).length === STILLSTAND.length ? `${STILLSTAND.length} von ${STILLSTAND.length}` : `${STILLSTAND.filter((l) => l[1]).length} von ${STILLSTAND.length}, fehlt: ${STILLSTAND.filter((l) => !l[1]).map((l) => l[0]).join(', ')}`);
  for (const [, ok, msg] of STILLSTAND) if (!ok) fail(`[12] ${msg} (13.11.2026)`);
  // Umgebungskugel der Halle ohne die Hologramme der Stationen (13.11.2026,
  // beim Bildvergleich derselben Runde gefunden). Ihr Schleier ist ein
  // Rechteck ueber dem ganzen Bild und lag ueber jeder Seite der Kugel:
  // Standen die Hologramme beim Aufnehmen schon (das Schiff war vor der Halle
  // fertig), kam sie halb so hell heraus (Mittel 0,094 statt 0,19), und wie
  // hell die Halle stand, hing an der Reihenfolge, in der Schiff und Halle
  // fertig wurden. Die Aufnahme blendet sie aus wie das Spiegelbild des
  // Bodens (mirror() in hangar-holo3d.js).
  const kugelOhne = /function captureHallEnv\([\s\S]{0,3000}?stLayer\?\.mirror\(true\);\s*const rt = pmremFor\(renderer\)\.fromScene\(scene,[^\n]*\n\s*stLayer\?\.mirror\(false\);/.test(viewer)
    && /mirror\(on\) \{[^}]*dim\.visible = vis;[^}]*root\.visible = vis;/.test(holoQ);
  sollIst('Umgebungskugel der Halle ohne Hologramme aufgenommen', kugelOhne ? 'ja' : 'nein');
  if (!kugelOhne) fail('[12] dist/assets/hangar-viewer.js: captureHallEnv() nimmt die Umgebungskugel nicht mehr ohne die Hologramme der Stationen auf (stLayer?.mirror um fromScene, oder mirror() in hangar-holo3d.js blendet Schleier und Tafeln nicht mehr aus): ihr Schleier halbiert die Kugel, und die Halle steht je nach Ladereihenfolge anders hell da (13.11.2026)');
  // Licht der Halle nach einem Schiffswechsel wie nach frischem Laden
  // (13.11.2026, im Bildvergleich Pisces <-> Carrack gefunden). Waechst die
  // Halle fuer das naechste Schiff, nimmt growSettled() die Kugel unter
  // geschlossenem Tor neu auf: Schiffsfeld und Wartungsplatz sind dort
  // ausgeblendet, unter der Kugel lag das Tor, und sie kam 25 bis 33 %
  // dunkler heraus (Carrack 0,137 statt 0,204) und blieb es bis zum naechsten
  // Wechsel der Hallengroesse. hallRest() stellt die Halle fuer die Aufnahme
  // in Ruhelage. Die Schattenkegel richtete scaleWorld() vor dem Gleiten, als
  // die Lampen noch am alten Ort standen (Carrack nach der Pisces: focus 1
  // statt 0,77): growStep() richtet sie am Ende des Gleitens neu.
  const kugelRuhe = /function hallRest\(\) \{[\s\S]{0,700}?\[\[lf, true\], \[dn, true\], \[sh\?\.gate\?\.group, false\]/.test(viewer)
    && /function captureHallEnv\([\s\S]{0,3500}?const unrest = hallRest\(\);\s*stLayer\?\.mirror\(true\);\s*const rt = pmremFor\(renderer\)\.fromScene\(scene,[^\n]*\n\s*stLayer\?\.mirror\(false\);\s*unrest\(\);/.test(viewer);
  const kegelEnde = /function growStep\(now\) \{[\s\S]{0,900}?if \(t >= 1\) scaleLamps\(\);/.test(viewer);
  sollIst('Licht der Halle nach Schiffswechsel wie frisch geladen (Kugel in Ruhelage, Schattenkegel am Ende des Gleitens)', kugelRuhe && kegelEnde ? 'ja' : `nein (Kugel ${kugelRuhe ? 'ja' : 'nein'}, Kegel ${kegelEnde ? 'ja' : 'nein'})`);
  if (!kugelRuhe) fail('[12] dist/assets/hangar-viewer.js: captureHallEnv() nimmt die Umgebungskugel nicht mehr in Ruhelage auf (hallRest() um fromScene: Schiffsfeld und Wartungsplatz sichtbar, Tor und Schacht aus): nach einem Schiffswechsel kommt sie vom geschlossenen Tor und steht ein Viertel bis ein Drittel dunkler als nach frischem Laden (13.11.2026)');
  if (!kegelEnde) fail('[12] dist/assets/hangar-viewer.js: growStep() richtet die Schattenkegel am Ende des Gleitens nicht mehr neu (scaleLamps()): nach einem Schiffswechsel bleibt der Schatten des Schiffs groeber als nach frischem Laden (13.11.2026)');
  const ctrl =existsSync(join(DIST, 'assets', 'hangar-overview.js')) ? readFileSync(join(DIST, 'assets', 'hangar-overview.js'), 'utf8') : '';
  const call = /initHangar\([^{]*\{([^}]*)\}/.exec(ctrl)?.[1] ?? '';
  const passes = /\bgpu:/.test(call) && /\bquality:/.test(call);
  sollIst('Controller gibt gpu und quality an initHangar', passes ? 'ja' : `nein (${call.trim().slice(0, 80) || 'kein Aufruf'})`);
  if (!passes) fail('[12] dist/assets/hangar-overview.js gibt gpu und quality nicht mehr an initHangar: jedes Geraet bekaeme die Stufe ohne Chipnamen und ohne Wahl von Hand');
  // Waechter gegen die Neu-Lade-Schleife (Krisz, 12.11.2026: „Auf dem Handy
  // laedt es die ganze Zeit neu“): Sein Deckel muss beim Viewer ankommen,
  // und beide muessen dieselben Stufen meinen. Ohne das zaehlte die Seite
  // Abbrueche und luede trotzdem in derselben Stufe neu.
  const capDa = /\bcap:/.test(call);
  sollIst('Controller gibt den Deckel des Waechters (cap) an initHangar', capDa ? 'ja' : 'nein');
  if (!capDa) fail('[12] dist/assets/hangar-overview.js gibt cap nicht an initHangar: der Deckel des Waechters senkte keine Stufe, die Neu-Lade-Schleife kaeme zurueck');
  let ctrlMod = null;
  try { ctrlMod = await import(pathToFileURL(join(DIST, 'assets', 'hangar-overview.js')).href); } catch (e) { fail(`[12] dist/assets/hangar-overview.js laedt nicht als Modul (${e.message})`); }
  if (ctrlMod) {
    const ws = JSON.stringify(ctrlMod.WAECHTER?.stufen ?? null);
    sollIst(`Stufen des Waechters ${JSON.stringify(LEVELS)}`, ws);
    if (ws !== JSON.stringify(LEVELS)) fail(`[12] WAECHTER.stufen in dist/assets/hangar-overview.js ist ${ws} statt ${JSON.stringify(LEVELS)}: Waechter und Viewer muessen dieselben Stufen nennen`);
  }
  // Seit 13.11.2026 (WAECHTER.v 2): Am Telefon senkt schon der erste
  // Abbruch, und der Stand fuehrt eine Spur (Stufe, Phase, Art), die die
  // Meldung zeigt. Geprueft am ausgelieferten Modul und an den Naehten: Der
  // Controller nennt das Telefon mit derselben Abfrage wie der Viewer, gibt
  // sofort, Phase und Art an waechterAbbruch, der Vermerk traegt die Phase,
  // und sie rueckt beim Laden vor ('bauen' ab 90 %, 'steht' mit dem ersten
  // Schiff). v ist eine Klinke: Sinkt sie, gelten Deckel wieder, die fuer
  // eine schwerere Halle gemerkt wurden.
  const WAECHTER_V = 3;
  if (ctrlMod) {
    const W = ctrlMod.WAECHTER ?? {}, T = Date.UTC(2026, 10, 13, 12, 0, 0);
    const leer = ctrlMod.waechterStand?.(null, T);
    const erst = leer && ctrlMod.waechterAbbruch?.(leer, T, 'hoch', { phase: 'bauen', wie: 'seite' });
    const sofort = leer && ctrlMod.waechterAbbruch?.(leer, T, 'hoch', { sofort: true, phase: 'bauen', wie: 'seite' });
    // drei Laeufe am Telefon, jeder bricht ab: hoch, mittel, niedrig, dann aus
    let stand = leer, laeufe = 0;
    for (; stand && stand.deckel !== 'aus' && laeufe < 9; laeufe++) {
      stand = ctrlMod.waechterStand(ctrlMod.waechterText(ctrlMod.waechterAbbruch(stand, T + laeufe * 60e3, stand.deckel ?? 'hoch', { sofort: true, phase: 'bauen', wie: 'kontext' })), T + laeufe * 60e3);
    }
    const zeilen = stand ? ctrlMod.waechterVerlauf?.(stand.spur, (k) => k.toUpperCase()) ?? [] : [];
    // Vermerk „Lauf offen“: nur einer der eigenen Fassung zaehlt. Einer von
    // vor dem Update (ohne v) setzte der leichteren Halle sonst sofort einen
    // Deckel, von niedrig aus gleich „aus“ fuer 30 Tage.
    const vermerk = (o) => ctrlMod.waechterOffen?.(JSON.stringify({ t: T, id: 'x', stufe: 'niedrig', ...o }), T + 1000);
    const vermerkIst = `Vermerk der eigenen Fassung ${vermerk({ v: W.v }) ? 'zaehlt' : 'zaehlt nicht'}, einer ohne Fassung ${vermerk({}) ? 'zaehlt' : 'zaehlt nicht'}, einer aelteren ${vermerk({ v: W.v - 1 }) ? 'zaehlt' : 'zaehlt nicht'}`;
    const vermerkOk = !!vermerk({ v: W.v }) && vermerk({}) === null && vermerk({ v: W.v - 1 }) === null;
    const regelOk = W.v >= WAECHTER_V && erst?.deckel === null && sofort?.deckel === 'mittel' && laeufe === 3
      && zeilen.length === 3 && zeilen[0] === 'HOCH, BAUEN, KONTEXT' && zeilen[2] === 'NIEDRIG, BAUEN, KONTEXT' && vermerkOk;
    sollIst(`Waechter ab v ${WAECHTER_V}: am Telefon senkt der erste Abbruch, drei Laeufe bis aus, die Spur nennt Stufe, Phase und Art, ein Vermerk „Lauf offen“ zaehlt nur in der eigenen Fassung`,
      `v ${W.v}, erster Abbruch ohne sofort: Deckel ${erst?.deckel ?? 'keiner'}, mit sofort: ${sofort?.deckel ?? 'keiner'}; ${laeufe} Laeufe bis aus; Spur: ${zeilen.join(' | ') || 'leer'}; ${vermerkIst}`);
    if (!regelOk) fail(`[12] dist/assets/hangar-overview.js: der Waechter rechnet nicht mehr wie am 13.11.2026 abgenommen (v mindestens ${WAECHTER_V}; ohne sofort wird der erste Abbruch nur vermerkt, mit sofort senkt er auf mittel; am Telefon drei Laeufe bis aus; waechterVerlauf nennt je Abbruch Stufe, Phase und Art; waechterOffen nimmt nur Vermerke der eigenen Fassung): am Telefon liefe die Schleife laenger, die Meldung sagte nicht mehr, wie weit die Laeufe kamen, oder ein Lauf von vor einem Update setzte der neuen Halle einen Deckel`);
    const telQ = /const TELEFON = window\.matchMedia\('([^']+)'\)\.matches;/.exec(ctrl)?.[1] ?? null;
    const smallQ = /const SMALL = matchMedia\('([^']+)'\)\.matches;/.exec(viewer)?.[1] ?? null;
    const naht = [
      [telQ !== null && telQ === smallQ, `Telefon heisst im Controller „${telQ}“, im Viewer „${smallQ}“`],
      [/waechterAbbruch\(vor, Date\.now\(\), stufe, \{ sofort: TELEFON, phase, wie \}\)/.test(ctrl), 'abbruch() gibt sofort, phase und wie nicht an waechterAbbruch'],
      [/const e = \{ id: lauf\.id, t: Date\.now\(\), stufe: lauf\.stufe, phase: lauf\.phase \};/.test(ctrl) && /JSON\.stringify\(\{ v: WAECHTER\.v, \.\.\.e \}\)/.test(ctrl), 'der Vermerk „Lauf offen“ traegt Fassung oder Phase nicht'],
      [/if \(p >= 90\) laufPhase\('bauen'\);/.test(ctrl) && /placed = id;\s*laufPhase\('steht'\);/.test(ctrl), 'die Phase rueckt beim Laden nicht vor (bauen ab 90 %, steht mit dem ersten Schiff)'],
      [/abbruch\(was\.stufe, was\.wie, was\.phase\)/.test(ctrl) && /abbruch\(stufe, 'kontext', phase\)/.test(ctrl), 'die beiden Wege (Seite neu gestartet, Zeichenkontext verloren) nennen Art oder Phase nicht'],
      [/waechterVerlauf\(stand\.spur,/.test(ctrl) && /if \(why === 'failed'\) grund\(fallback, detail\);/.test(ctrl) && /grund\(modelErr, e\);/.test(ctrl), 'die Meldungen zeigen Spur oder technischen Grund nicht mehr'],
      // Schmal waechst die Buehne mit der Meldung: mit Verlauf oder Grund ragte sie sonst in die Knoepfe unter dem Schiffsnamen
      [(ctrl.match(/(?:fallback|modelErr)\.hidden = false;\s*meldungPlatz\(\);/g) ?? []).length === 3 && /modelErr\.hidden = true;\s*meldungPlatz\(\);/.test(ctrl), 'eine Meldung der Buehne erscheint oder geht, ohne dass meldungPlatz() den Platz am Telefon nachmisst (erwartet nach jedem hidden = false von fallback und modelErr und nach modelErr.hidden = true)'],
      // ... und mit dem Titel: Ein neues Schiff tauscht ihn erst nach dem Laden der Bucht, ein laengerer Name macht ihn hoeher
      [/replaceWith\(doc\.importNode\(regions\[name\], true\)\);\s*(?:\/\/[^\n]*\n\s*)?meldungPlatz\(\);/.test(ctrl) && /bayErr\.hidden = false;\s*meldungPlatz\(\);/.test(ctrl), 'der Titel wechselt (showBay nach dem Tausch der Regionen, showBayError), ohne dass meldungPlatz() den Platz einer sichtbaren Meldung nachmisst'],
    ];
    const offen = naht.filter(([ok]) => !ok).map(([, was]) => was);
    sollIst(`${naht.length} Naehte von Spur und Sofort-Regel im Controller`, offen.length ? `${naht.length - offen.length} von ${naht.length}: ${offen.join('; ')}` : `${naht.length} von ${naht.length}`);
    for (const was of offen) fail(`[12] dist/assets/hangar-overview.js: ${was}. Vom Telefon kommt nichts zurueck ausser dieser Zeile unter der Meldung; ohne sie laesst sich von aussen nicht sagen, woran ein Lauf scheiterte`);
    // Die Woerter der Spur stehen auf jeder Hangarseite: je Phase und Art eines, dazu die beiden Einleitungen
    const woerter = ['data-spur', 'data-grund', 'data-geraet', ...[...(W.phasen ?? []), ...(W.arten ?? [])].map((k) => `data-spur-${k}`)];
    let wortSeiten = 0;
    for (const page of PAGES) {
      const tag = /<div[^>]*id="hg-fallback"[^>]*>/.exec(page.html)?.[0] ?? '';
      const fehlt = woerter.filter((w) => !new RegExp(`\\s${w}="[^"]+"`).test(tag));
      if (!/<p[^>]*id="hgx-modelerr"[^>]*\sdata-grund="[^"]+"/.test(page.html)) fehlt.push('data-grund an #hgx-modelerr');
      if (fehlt.length) fail(`[12] dist/${page.file}: an der Meldung der Buehne fehlt ${fehlt.join(', ')}: die Zeile unter der Meldung bliebe leer oder liesse ein Wort aus`);
      else wortSeiten++;
    }
    sollIst(`${woerter.length} Woerter fuer Spur, Grund und Geraet auf jeder Hangarseite`, `${wortSeiten} von ${PAGES.length} Seiten`);
    if ((W.phasen ?? []).length < 3 || (W.arten ?? []).length < 3) fail(`[12] WAECHTER nennt ${(W.phasen ?? []).length} Phasen und ${(W.arten ?? []).length} Arten, erwartet mindestens 3 und 3`);
  }
  // Seit 14.11.2026 (WAECHTER.v 3, Krisz nach v 2: „Ne immer noch Dauer
  // Neulade Loop“). Nachgestellt: Baut der Browser die Registerkarte nach dem
  // Ende der Seite neu auf, ist ihr Speicher leer, kein Abbruch wurde
  // gezaehlt, 7 Laeufe in 55 s ohne Ende. Drei Zusicherungen:
  // 1. Der Vermerk „Lauf offen“ steht auch im Speicher des Geraets.
  // 2. Am Telefon zaehlen die Starts, auch wenn kein Vermerk ueberlebt: Eine
  //    Schleife endet dort ohne jeden Vermerk nach hoechstens LAEUFE_OHNE
  //    Laeufen (Klinken, nur abwaerts: ANLAUF_ZAHL Starts, die nicht standen,
  //    bevor einer zaehlt; RUHE_MIN nur aufwaerts: so lange muss eine Buehne
  //    stehen, bis die Starts vor ihr nicht mehr zaehlen, gemessen faellt der
  //    Arbeitsspeicher erst rund eine halbe Minute nach dem Laden).
  // 3. Unter jedem Deckel laeuft am Telefon die leichte Buehne: Die Seite
  //    gibt dem Viewer weder echte Halle noch Besatzung, er baut seine eigene
  //    (gemessen im Telefonformat mit der Gladius: rund 340 statt 950 MB
  //    Arbeitsspeicher der Seite beim Laden). Sie sagt es in einer Zeile mit
  //    Knopf zur vollen Halle.
  const ANLAUF_ZAHL = 2, LAEUFE_OHNE = 6, RUHE_MIN = 30e3;
  if (ctrlMod) {
    const W = ctrlMod.WAECHTER ?? {}, T = Date.UTC(2026, 10, 14, 6, 0, 0);
    const befund = typeof ctrlMod.waechterBefund === 'function' ? ctrlMod.waechterBefund : () => undefined;
    const leichtFn = typeof ctrlMod.waechterLeicht === 'function' ? ctrlMod.waechterLeicht : () => undefined;
    const zahl = W.anlauf?.zahl ?? 0, ruhe = W.anlauf?.ruhe ?? 0, frist = W.anlauf?.frist ?? 0;
    const starts = Array.from({ length: zahl }, (_, i) => T + i * 20e3);
    const tot = befund({ tot: [{ t: T, stufe: 'hoch', phase: 'bauen' }], anlauf: [], telefon: true });
    const ohne = befund({ tot: [], anlauf: starts, telefon: true });
    const pc = befund({ tot: [], anlauf: starts, telefon: false });
    const einer = befund({ tot: [], anlauf: starts.slice(1), telefon: true });
    // Telefon, an dem kein Vermerk ueberlebt und jeder Lauf abbricht, bevor er steht
    let stand = ctrlMod.waechterStand?.(null, T) ?? null, anlauf = [], now = T;
    const laeufe = [];
    for (let i = 0; stand && typeof ctrlMod.waechterAnlauf === 'function' && typeof ctrlMod.waechterAnlaufText === 'function' && i < 40 && stand.deckel !== 'aus'; i++) {
      now += 20e3;
      const was = befund({ tot: [], anlauf: ctrlMod.waechterAnlauf(ctrlMod.waechterAnlaufText(anlauf), now), telefon: true });
      if (was) {
        stand = ctrlMod.waechterAbbruch(ctrlMod.waechterStand(ctrlMod.waechterText(stand), now), now, was.stufe, { sofort: true, phase: was.phase, wie: was.wie });
        anlauf = [];
      }
      if (stand.deckel === 'aus') break;
      laeufe.push(leichtFn(stand.deckel, true) ? 'leicht' : 'voll');
      anlauf.push(now);
    }
    const voll = laeufe.filter((l) => l === 'voll').length;
    const durch = ctrlMod.waechterLaeufe?.(ctrlMod.waechterLaeufeText?.([{ id: 'x', t: T, stufe: 'mittel', phase: 'bauen' }]) ?? null, T + 1000) ?? [];
    const leichtIst = `Telefon mit Deckel mittel ${leichtFn('mittel', true) === true ? 'leicht' : 'voll'}, niedrig ${leichtFn('niedrig', true) === true ? 'leicht' : 'voll'}, ohne Deckel ${leichtFn(null, true) === false ? 'voll' : 'leicht'}, PC mit Deckel ${leichtFn('mittel', false) === false ? 'voll' : 'leicht'}`;
    const v3Ok = tot?.wie === 'seite' && tot.stufe === 'hoch' && tot.phase === 'bauen' && ohne?.wie === 'start' && pc === null && einer === null
      && zahl >= 1 && zahl <= ANLAUF_ZAHL && ruhe >= RUHE_MIN && (zahl + 1) * (ruhe + 60e3) <= frist
      && stand?.deckel === 'aus' && laeufe.length >= 1 && laeufe.length <= LAEUFE_OHNE && voll === zahl
      && leichtFn('mittel', true) === true && leichtFn('niedrig', true) === true && leichtFn('mittel', false) === false && leichtFn('aus', true) === false && leichtFn(null, true) === false
      && durch.length === 1 && durch[0].id === 'x' && durch[0].stufe === 'mittel' && durch[0].phase === 'bauen';
    sollIst(`Waechter ab v 3: ein toter Lauf zaehlt als Abbruch der Seite; am Telefon zaehlen hoechstens ${ANLAUF_ZAHL} Starts, die mindestens ${RUHE_MIN / 1000} s nicht standen, auch ohne Vermerk; ohne jeden Vermerk hoechstens ${LAEUFE_OHNE} Laeufe bis aus; unter dem Deckel am Telefon die leichte Buehne`,
      `toter Lauf: ${tot?.wie ?? 'nichts'}; ${zahl} Starts am Telefon: ${ohne?.wie ?? 'nichts'}, am PC: ${pc?.wie ?? 'nichts'}, ${Math.max(0, zahl - 1)} am Telefon: ${einer?.wie ?? 'nichts'}; Ruhe ${ruhe / 1000} s, Frist ${frist / 60e3} min; ohne Vermerk ${laeufe.length} Laeufe bis ${stand?.deckel ?? 'nichts'} (${laeufe.join(' ') || 'keiner'}); ${leichtIst}; Vermerk im Geraet ${durch.length === 1 ? 'geht durch den Speicher' : 'geht verloren'}`);
    if (!v3Ok) fail(`[12] dist/assets/hangar-overview.js: der Waechter rechnet nicht mehr wie am 14.11.2026 abgenommen (waechterBefund: toter Lauf zaehlt als 'seite', am Telefon zaehlen hoechstens ${ANLAUF_ZAHL} Starts als 'start', am PC keine; WAECHTER.anlauf.ruhe mindestens ${RUHE_MIN / 1000} s und drei Laeufe in der Frist; ohne jeden Vermerk hoechstens ${LAEUFE_OHNE} Laeufe bis aus, davon so viele mit voller Halle wie Starts zaehlen; waechterLeicht: am Telefon unter jedem Deckel, sonst nie; waechterLaeufe liest, was waechterLaeufeText schreibt): Ein Telefon, dessen Browser die Registerkarte nach dem Absturz neu aufbaut, luede wieder ohne Ende neu, oder es versuchte dreimal dieselbe Halle`);
    const startTeil = ctrl.slice(Math.max(0, ctrl.indexOf('async function waechterStart()')), Math.max(0, ctrl.indexOf('async function waechterStart()')) + 1800);
    // je Naht: erfuellt, Datei, was fehlt, was daraus folgte
    const SCHLEIFE = 'ein Telefon, dessen Browser die Registerkarte nach dem Absturz neu aufbaut, luede wieder ohne Ende neu', DREIMAL = 'das Telefon versuchte nach einem Abbruch wieder dieselbe Halle (rund 950 statt 340 MB)', FALSCH = 'ein Besucher ohne Abbruch bekaeme die leichte Ansicht';
    const naht3 = [
      [/laeufeAendern\(\(l\) => \[\.\.\.l\.filter\(\(x\) => x\.id !== e\.id\), e\]\);/.test(ctrl), 'hangar-overview.js', 'offenSetzen() vermerkt den Lauf nicht mehr im Speicher des Geraets', SCHLEIFE],
      [/waechterLaeufe\(lies\(\(\) => localStorage, LAEUFE_KEY\), now\)/.test(startTeil) && /waechterAnlauf\(lies\(\(\) => localStorage, ANLAUF_KEY\), now\)/.test(startTeil) && /waechterBefund\(\{ tot, anlauf, telefon: TELEFON \}\)/.test(startTeil), 'hangar-overview.js', 'waechterStart liest die offenen Laeufe des Geraets oder die Starts nicht mehr', SCHLEIFE],
      [/offenSetzen\(\);\s*anlaufSetzen\(\);/.test(ctrl), 'hangar-overview.js', 'der Start der Buehne traegt sich nicht mehr in die Liste der Starts ein', 'ueberlebt kein Vermerk, zaehlte am Telefon nichts mehr, und es luede ohne Ende neu'],
      [/setTimeout\(\(\) => \{ if \(lauf\?\.id === id\) anlaufWeg\(\); \}, WAECHTER\.anlauf\.ruhe\);/.test(ctrl), 'hangar-overview.js', 'eine Buehne, die steht, leert die Liste der Starts nicht mehr', FALSCH],
      [/window\.addEventListener\('pagehide', \(\) => \{ offenWeg\(\); anlaufAbschied\(\); \}\);/.test(ctrl), 'hangar-overview.js', 'wer die Seite von sich aus verlaesst, nimmt Vermerk oder Start nicht mehr heraus', 'wer dreimal kurz hereinschaut oder von Hand neu laedt, zaehlte als Abbruch'],
      [/anlaufWeg\(\);\s*console\.warn\(`\[hangar\] Abbruch der Buehne/.test(ctrl), 'hangar-overview.js', 'ein gezaehlter Abbruch leert die Starts nicht', 'derselbe Abbruch zaehlte ueber die Starts ein zweites Mal und senkte zwei Stufen'],
      [/function laufEnde\(\) \{ lauf = null; offenWeg\(\); anlaufAbschied\(\); \}/.test(ctrl), 'hangar-overview.js', 'ein Lauf, der mit einer Meldung endet (kein Start, Kontext im Hintergrund verloren), bleibt als Start ohne Abschied stehen', FALSCH],
      [/const leicht = waechterLeicht\(deckel, TELEFON\);/.test(ctrl) && /const buehne = leicht \? \{ \.\.\.stageCfg\.opts, hall: null, crew: null \} : stageCfg\.opts;/.test(ctrl) && /\.\.\.buehne\b/.test(call), 'hangar-overview.js', 'unter einem Deckel bekommt der Viewer am Telefon weiter die echte Halle und die Besatzung', DREIMAL],
      [/const REAL = !!\(opts\.hall\?\.url && opts\.hall\.room\);/.test(viewer) && /if \(!REAL\) buildStage\(\);/.test(viewer) && /if \(opts\.crew\?\.module && REAL\) \{/.test(viewer), 'hangar-viewer.js', 'der Viewer baut ohne echte Halle keine eigene mehr (REAL, buildStage) oder laedt die Besatzung auch ohne sie', 'in der leichten Ansicht stuende das Schiff im Leeren'],
    ];
    const offen3 = naht3.filter(([ok]) => !ok);
    sollIst(`${naht3.length} Naehte von Vermerk im Geraet, Starts und leichter Buehne`, offen3.length ? `${naht3.length - offen3.length} von ${naht3.length}: ${offen3.map(([, , was]) => was).join('; ')}` : `${naht3.length} von ${naht3.length}`);
    for (const [, datei, was, folge] of offen3) fail(`[12] dist/assets/${datei}: ${was}: ${folge} (14.11.2026)`);
    // Die Zeile der leichten Ansicht steht auf jeder Hangarseite, mit Text und Knopf
    let leichtSeiten = 0;
    for (const page of PAGES) {
      const el = /<p[^>]*id="hgx-leicht"[^>]*>([\s\S]*?)<\/p>/.exec(page.html);
      const text = el ? (/<span>([^<]+)<\/span>/.exec(el[1])?.[1] ?? '').trim() : '';
      const knopf = el ? (/<button[^>]*id="hgx-leicht-voll"[^>]*>([^<]+)<\/button>/.exec(el[1])?.[1] ?? '').trim() : '';
      const zu = el ? /\shidden(?:[\s>=])/.test(el[0].slice(0, el[0].indexOf('>') + 1)) : false;
      if (!el || !text || !knopf || !zu) fail(`[12] dist/${page.file}: die Zeile der leichten Ansicht ${!el ? 'fehlt (#hgx-leicht)' : !text ? 'hat keinen Text' : !knopf ? 'hat keinen Knopf zur vollen Halle (#hgx-leicht-voll)' : 'ist nicht von Anfang an verborgen (hidden)'}: Am Telefon stuende das Schiff ohne Erklaerung in der gebauten Halle, oder kein Weg fuehrte zurueck`);
      else leichtSeiten++;
    }
    sollIst('Zeile der leichten Ansicht mit Text und Knopf, anfangs verborgen, auf jeder Hangarseite', `${leichtSeiten} von ${PAGES.length} Seiten`);
  }
  // Der einzige Weg, auf dem die Seite nach verlorenem Zeichenkontext von
  // selbst neu laedt, haengt am Waechter: im Rueckruf von onLost zaehlt
  // abbruch(), und neu geladen wird nur hinter „if (neuLaden)“.
  const lostAt = ctrl.indexOf('.onLost(');
  const lostFn = lostAt < 0 ? '' : ctrl.slice(lostAt, lostAt + 2000);
  const neu = lostFn.match(/[^\n]*(?:location\.reload\(\)|neuWennSichtbar\(\))/g) ?? [];
  const lostOk = /\babbruch\(/.test(lostFn) && neu.length === 1 && /if \(neuLaden\) neuWennSichtbar\(\)/.test(neu[0]);
  sollIst('Neuladen nach verlorenem Zeichenkontext nur ueber den Waechter', lostOk ? 'ja' : `nein (${lostFn ? `${neu.length} Neuladen im Rueckruf, erwartet eines hinter „if (neuLaden)“` : 'kein Rueckruf onLost gefunden'})`);
  if (!lostOk) fail('[12] dist/assets/hangar-overview.js: der Rueckruf von onLost zaehlt den Abbruch nicht mehr (abbruch()) oder laedt nicht mehr genau einmal und nur danach neu (if (neuLaden) neuWennSichtbar()): ungezaehltes Neuladen ist die Schleife vom 12.11.2026');
  // Der zweite Weg, ein Abbruch beim Start (die Seite wurde beendet und neu
  // geladen): Kann er nicht gemerkt werden, bleibt die Buehne fuer dieses
  // Laden aus. Sonst startete sie ungezaehlt wieder, und die Schleife liefe.
  // Dazu haelt ein Zeitgeber den Vermerk „Lauf offen“ frisch, sonst zaehlte
  // ein Abbruch nach langem Ansehen nicht.
  const startAt = ctrl.indexOf('async function waechterStart()');
  const startFn = startAt < 0 ? '' : ctrl.slice(startAt, startAt + 1800);
  const startOk = /if \(was && !abbruch\([^\n]*\)\) return 'aus';/.test(startFn);
  const pulsOk = /setInterval\(offenSetzen, WAECHTER\.puls\)/.test(ctrl) && ctrlMod && ctrlMod.WAECHTER?.puls > 0 && ctrlMod.WAECHTER.puls < ctrlMod.WAECHTER.frisch;
  sollIst('Start ohne gemerkten Abbruch bleibt ohne Buehne, Vermerk „Lauf offen“ wird frisch gehalten', startOk && pulsOk ? 'ja' : `nein (${[!startFn && 'waechterStart nicht gefunden', startFn && !startOk && 'Start prueft abbruch() nicht', !pulsOk && 'kein Zeitgeber unter der Frist'].filter(Boolean).join(', ')})`);
  if (!startOk) fail('[12] dist/assets/hangar-overview.js: waechterStart startet die Buehne auch dann, wenn der Abbruch des vorigen Laufs nicht gemerkt wurde (erwartet „if (was && !abbruch(…)) return \'aus\'“): ohne Speicher zaehlte kein Abbruch, die Neu-Lade-Schleife liefe weiter');
  if (!pulsOk) fail('[12] dist/assets/hangar-overview.js: der Vermerk „Lauf offen“ wird nicht mehr frisch gehalten (setInterval(offenSetzen, WAECHTER.puls), puls unter frisch): ein Abbruch nach langem Ansehen zaehlte nicht');
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
// ports nachgezogen am 11.11.2026 auf 2220 (Waffen und Komponenten, je
// Schiff, Port und Item; 231 Schiffe): Der Neubau mit der Reparatur
// vertauschter Netze nahm acht Ports den Anker, weil ihre Wurzel kein Netz
// mehr trug (Starlifter A2, C2, M2: beide Kraftwerke; 300i und 350r:
// Bugwaffe). Die alte Klinke von 37 sah das nicht.
const TAUSCH = { modelle: 112, ports: 2220 };
// Komponenten (Kraftwerk, Kühler, Schild, Quantum, Radar) tauschen seit dem
// 31.10.2026 wie die Bordwaffen; jeder Komponentenanker nennt in extras.stock
// das Modell seines Serienteils, das der Viewer an leeren Ankern einsetzt
// (.planning/notes/hangar-komponenten/probe.md). Gemessen 31.10.2026: 311
// Komponentenmodelle in der Werkstatt. Gezählt wird je Anker (Schiff, Port,
// Exemplar), nicht je Knoten: 1465 Anker mit Serienteil (die frühere Zahl
// 1783 zählte jeden Teilknoten eines eingebauten Teils mit). 18 Komponenten-
// Ports haben im Spiel kein Modell (890 Jump, MOLE, Idris M/P, Javelin,
// ROC-DS), mehr ohne Serienteil ist ein Rückfall im Bau.
// Werkstatt-Slots für Komponenten an Schiffen mit Modell: 1349 (01.11.2026;
// ein Slot fasst alle Exemplare eines Ports, darum weniger als Anker).
const KOMP = { modelle: 311, serie: 1465, ohneSerie: 18, slots: 1349 };
const KOMP_TYPES = new Set(['power', 'cooler', 'shield', 'quantum', 'radar']);
// Komponenten-Slots der Werkstatt (dist/hangar-layouts.json), für die das
// Schiffsmodell keinen Anker hat: der Tausch im Reiter Systeme bleibt dort im
// 3D unsichtbar. Benannte Ausnahmen (Grundsatz 6), Anlass für alle: der
// Rohexport hat für den Port keinen Helfer (gemessen 01.11.2026); behoben
// erst mit dem vollständigen Export. Ein Slot ohne Anker, der hier fehlt, ist
// FEHLER, ebenso ein Eintrag, dessen Slot inzwischen einen Anker hat.
const OHNE_ANKER = new Set([
  'aegs-redeemer power_plant_2', 'aegs-redeemer shield_generator_3', 'aegs-redeemer shield_generator_4', 'aegs-redeemer shield_generator_5', 'aegs-redeemer shield_generator_6',
  'anvl-hurricane powerplant_02', 'anvl-valkyrie shield_03', 'anvl-valkyrie shield_04',
  'argo-mpuv-transport scanner', 'argo-raft shield_generator_3', 'drak-vulture shield_generator_rear',
  'misc-hull-c rear_power_plant_b', 'misc-hull-c shield_generator03', 'misc-hull-c shield_generator04',
  'misc-prospector shield_generator_b', 'misc-prospector shield_generator_c',
  'misc-starfarer powerplant_b', 'misc-starfarer shield_generator_b', 'misc-starfarer shield_generator_c',
  'misc-starfarer-gemini powerplant_b', 'misc-starfarer-gemini shield_generator_b', 'misc-starfarer-gemini shield_generator_c',
  'orig-400i cooler_2', 'orig-400i power_plant_2',
]);
{
  const lf = join(DIST, 'hangar-layouts.json');
  const ld = existsSync(lf) ? JSON.parse(readFileSync(lf, 'utf8')) : {};
  const models = Object.entries(ld.models ?? {});
  const bad = models.filter(([, u]) => !/\?v=[0-9a-f]{6,}$/.test(u) || !existsSync(join(DIST, u.replace(/\?.*$/, ''))));
  for (const [k, u] of bad.slice(0, 10)) fail(`[13] Werkstatt-Modell ${k}: ${u} ohne ?v= oder nicht in dist/`);
  const notGun = models.filter(([k]) => ld.items?.[k]?.[2] !== 'gun' && !KOMP_TYPES.has(ld.items?.[k]?.[2]));
  for (const [k] of notGun.slice(0, 10)) fail(`[13] Werkstatt-Modell ${k} ist weder Bordwaffe noch Komponente der Werkstatt`);
  const komp = models.filter(([k]) => KOMP_TYPES.has(ld.items?.[k]?.[2]));
  const guns = models.length - komp.length;
  const shipDir = join(DIST, 'hangar', 'ships');
  let ports = 0, nodes = 0, badAnchor = 0;
  const serieFehlt = new Map();   // URL -> Schiffe
  // Komponentenanker (Schiff|Port|Exemplar) mit Serienteil, Komponenten-Ports ohne
  const serieAnker = new Set(), kompPorts = new Set(), kompPortsSerie = new Set();
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
      const isKomp = KOMP_TYPES.has(x.cat);
      if (isKomp) kompPorts.add(`${f}|${x.swap}|${x.item ?? 0}`);
      if (x.stock === undefined) continue;
      if (!isKomp) fail(`[13] ${f.replace(/\.glb$/, '')} ${x.swap}: Serienteil an einem Knoten ohne Komponentenart (cat ${x.cat ?? '—'}): der Viewer setzt dort ein Kraftwerk o. ae. ein`);
      else { serieAnker.add(`${f}|${x.swap}|${x.item ?? 0}|${x.inst ?? 0}`); kompPortsSerie.add(`${f}|${x.swap}|${x.item ?? 0}`); }
      const okUrl = typeof x.stock === 'string' && /^\/hangar\/components\/[A-Za-z0-9_.-]+\.glb\?v=[0-9a-f]{6,}$/.test(x.stock) && existsSync(join(DIST, x.stock.replace(/\?.*$/, '')));
      if (!okUrl) serieFehlt.set(String(x.stock), [...(serieFehlt.get(String(x.stock)) ?? []), f.replace(/\.glb$/, '')]);
    }
    ports += mine.size;
    perShip.push(`${f.replace(/\.glb$/, '')} ${mine.size}`);
  }
  if (badAnchor) fail(`[13] ${badAnchor} Tauschteil-Knoten ohne gueltige anchor-Matrix: der Viewer setzt die Waffe dort nicht`);
  // Slot der Werkstatt -> Anker im Modell: Schluessel = Port ohne hardpoint_,
  // bei mehreren Items im Port mit .<i> (src/lib/hangar/layouts.ts)
  const ankerKeys = new Set();
  for (const p of kompPorts) {
    const [f, swap, item] = p.split('|');
    const base = `${f.replace(/\.glb$/, '')} ${swap.replace(/^hardpoint_/, '')}`;
    ankerKeys.add(`${base}.${item}`);
    if (item === '0') ankerKeys.add(base);
  }
  const shipsMitModell = new Set(perShip.map((x) => x.split(' ')[0]));
  let kompSlots = 0;
  const ohneAnker = [];
  for (const [id, slots] of Object.entries(ld.ships ?? {})) {
    if (!shipsMitModell.has(id)) continue;
    for (const [key, type] of slots) {
      if (!KOMP_TYPES.has(type)) continue;
      kompSlots++;
      if (!ankerKeys.has(`${id} ${key}`)) ohneAnker.push(`${id} ${key}`);
    }
  }
  const ohneAnkerNeu = ohneAnker.filter((k) => !OHNE_ANKER.has(k));
  const ohneAnkerZombie = [...OHNE_ANKER].filter((k) => !ohneAnker.includes(k));
  const serie = serieAnker.size;
  const ohneSerie = [...kompPorts].filter((p) => !kompPortsSerie.has(p)).map((p) => p.replace(/\.glb\|/, ' ').replace(/\|\d+$/, ''));
  say(`    Werkstatt-Modelle: ${models.length} (${guns} Bordwaffen, ${komp.length} Komponenten; ${bad.length} ohne Datei/Version, ${notGun.length} weder noch)   Tauschteile: ${ports} Ports in ${perShip.length} Schiffen, ${nodes} Knoten, Komponentenanker mit Serienteil ${serie}, Komponenten-Ports ohne ${ohneSerie.length}; Komponenten-Slots der Werkstatt ${kompSlots}, ohne Anker ${ohneAnker.length} (benannt ${OHNE_ANKER.size})`);
  say(`      ${perShip.join(', ')}`);
  sollIst(`Bordwaffen-Modelle >= ${TAUSCH.modelle}, Ports >= ${TAUSCH.ports}, Komponenten-Modelle >= ${KOMP.modelle}, Anker mit Serienteil >= ${KOMP.serie}, Komponenten-Ports ohne Serienteil <= ${KOMP.ohneSerie}, jedes Serienteil in dist/, Komponenten-Slots >= ${KOMP.slots}, jeder mit Anker ausser ${OHNE_ANKER.size} benannten`, `${guns}, ${ports}, ${komp.length}, ${serie}, ${ohneSerie.length}, ${serieFehlt.size} fehlen, ${kompSlots}, ${ohneAnkerNeu.length} ohne Anker unbenannt, ${ohneAnkerZombie.length} Ausnahmen ohne Anlass`);
  for (const [u, ships] of [...serieFehlt].slice(0, 10)) fail(`[13] Serienteil ${u} (${ships.length} Anker, z. B. ${ships[0]}) ohne ?v= oder nicht in dist/hangar/components: der leere Anker bleibt leer`);
  if (guns < TAUSCH.modelle) fail(`[13] nur ${guns} Waffenmodelle in der Werkstatt (Klinke ${TAUSCH.modelle}): fehlt src/data/hangar-assets.json weapons oder der Schluessel-Join in src/lib/hangar/layouts.ts?`);
  if (komp.length < KOMP.modelle) fail(`[13] nur ${komp.length} Komponentenmodelle in der Werkstatt (Klinke ${KOMP.modelle}): fehlt src/data/hangar-assets.json components oder COMPONENT_MODELS in src/lib/hangar/layouts.ts?`);
  if (serie < KOMP.serie) fail(`[13] nur ${serie} Komponentenanker mit Serienteil (Klinke ${KOMP.serie}): Schiffe ohne extras.stock gebaut (scripts/build-hangar-assets.mjs)?`);
  if (ohneSerie.length > KOMP.ohneSerie) fail(`[13] ${ohneSerie.length} Komponenten-Ports ohne Serienteil (Klinke ${KOMP.ohneSerie}: ${ohneSerie.slice(0, 6).join(', ')}${ohneSerie.length > 6 ? ', …' : ''}): der Anker bleibt leer. Fehlt das Komponentenmodell im Manifest, als die Schiffe gebaut wurden (Komponenten vor den Schiffen bauen)?`);
  for (const k of ohneAnkerNeu.slice(0, 10)) fail(`[13] Komponenten-Slot ${k}: die Werkstatt bietet ihn an, das Schiffsmodell hat dort keinen Anker (Tausch bleibt im 3D unsichtbar). Port im Bau verloren (markSwapParts)? Stimmt es, in OHNE_ANKER mit Anlass benennen`);
  if (ohneAnkerNeu.length > 10) fail(`[13] … und ${ohneAnkerNeu.length - 10} weitere Komponenten-Slots ohne Anker`);
  for (const k of ohneAnkerZombie) fail(`[13] Ausnahme OHNE_ANKER ${k} ohne Anlass: der Slot hat jetzt einen Anker oder es gibt ihn nicht mehr, Eintrag streichen`);
  if (kompSlots < KOMP.slots) fail(`[13] nur ${kompSlots} Komponenten-Slots der Werkstatt an Schiffen mit Modell (Klinke ${KOMP.slots}): fehlt dist/hangar-layouts.json ships, oder bietet die Werkstatt Komponenten nicht mehr an (src/lib/hangar/layouts.ts)?`);
  if (ports < TAUSCH.ports) fail(`[13] nur ${ports} Tausch-Ports mit Anker, Waffen und Komponenten (Klinke ${TAUSCH.ports}): Schiffe ohne markSwapParts gebaut, oder eine Wurzel ohne Netz ohne leeren Anker (markSwapParts, scripts/build-hangar-assets.mjs)?`);
  ist.tauschModelle = guns; ist.tauschPorts = ports; ist.kompModelle = komp.length; ist.kompSerie = serie;
}

say('\n[14] Lackierungen: Daten der Werkstatt und Palettenmaterialien der Schiffe mit Lack');
// Sperrklinken (Grundsatz 5), Startwerte aus dem ersten Datenlauf am
// 18.10.2026 (datamine:paints): 207 Schiffe, 2068 Lackierungen; von den zehn
// Schiffen mit Lack sind neun umfaerbbar (die 300i hat keine Serienpalette
// und keine Lackierungen). 27.10.2026 nach Hangar-Alle: 2103 Lackierungen,
// 203 von 231 Schiffen mit Lack umfaerbbar.
const LACK = { schiffe: 207, lackierungen: 2103, umfaerbbar: 203 };
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
      // Glanz je Kanal (optional): [[#glanzfarbe, glaette 0..255] x3]
      const fin = (f) => Array.isArray(f) && f.length === 3 && f.every((x) => Array.isArray(x) && x.length === 2 && HEXC.test(x[0]) && Number.isInteger(x[1]) && x[1] >= 0 && x[1] <= 255);
      const ok = Array.isArray(r) && (r.length === 6 || (r.length === 7 && fin(r[6]))) && /^[a-z0-9][a-z0-9-]{0,63}$/.test(r[0]) && typeof r[1] === 'string' && r[1].trim()
        && r.slice(2, 5).every((c) => HEXC.test(c)) && (r[5] === 0 || r[5] === 1);
      if (!ok) fail(`[14] ${ship}: Lackierung ${JSON.stringify(r).slice(0, 120)} hat nicht die Form [kennung, name, #haupt, #zweit, #akzent, 0|1, glanz?]`);
      if (ids.has(r[0])) fail(`[14] ${ship}: Kennung ${r[0]} doppelt`);
      ids.add(r[0]);
    }
  }
  // Wie der Viewer (hullTint): Traegt der Bau extras.palette, zaehlt allein
  // dessen Kanal. Sonst Ton der Serienpalette, sRGB nach linear, Summe der
  // Abstaende < 3e-3; traegt das Modell Lackkanaele, nur mit passendem Kanal.
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
    const pal = (gltf.materials ?? []).some((m) => m.extras?.palette);
    for (const m of gltf.materials ?? []) {
      if (pal) { const ch = m.extras?.palette?.ch; if ([1, 2, 3].includes(ch)) hits[ch - 1]++; continue; }
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
// 12.11.2026 (4.10.3): je -4. Phoenix Emerald (4) und Hammerhead Showdown (8)
// haben keinen Fahrzeug-Record mehr, Galaxy (4) und Liberator (4) kommen dazu
// (src/data/ship-missile-racks.json vorher/nachher).
const RAKETEN = { schiffe: 152, slots: 464, tauschbar: 458, halterWahl: 210 };
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
// (GitHub warnt ab 50 MB und lehnt ab 100 MB ab). Die begehbaren Innenräume
// (dist/hangar/interior, PC-Lauf Hangar-Innenleben) nutzen dieselbe Ablage
// und zählen mit. Deckel am 30.10.2026 von 1600 auf 2400 MB gehoben, Anlass:
// die Innenräume, nach 26 Schiffen 5,6 MB je Schiff samt Ablage, für rund
// 190 Schiffe mit Innenraum zusammen 2,0 bis 2,1 GB
// (.planning/notes/hangar-innenleben.md, Auftrag Teil A 4). Die Komponenten
// zum Tausch (dist/hangar/components, .planning/notes/hangar-komponenten/)
// legen ihre Bilder ebenso ab und zählen mit.
const BILDER = { schiffe: 231, gesamtMB: 2400, dateiMB: 50 };
{
  const shipDir = join(DIST, 'hangar', 'ships'), innerDir = join(DIST, 'hangar', 'interior'), compDir = join(DIST, 'hangar', 'components'), texDir = join(DIST, 'hangar', 'tex');
  const NAME = /^\.\.\/tex\/([0-9a-f]{16})\.(webp|png|jpg|ktx2)$/;
  const glbs = existsSync(shipDir) ? readdirSync(shipDir).filter((x) => x.endsWith('.glb')).sort() : [];
  const inners = existsSync(innerDir) ? readdirSync(innerDir).filter((x) => x.endsWith('.glb')).sort() : [];
  const comps = existsSync(compDir) ? readdirSync(compDir).filter((x) => x.endsWith('.glb')).sort() : [];
  const used = new Map();   // Datei -> Zahl der Dateien (Rumpf, Innenraum, Komponente je eins)
  let refs = 0, embedded = 0, pooledShips = 0, glbBytes = 0, innerBytes = 0, compBytes = 0, big = [];
  const missing = new Set(), foreign = [];
  for (const [dir, f] of [...glbs.map((f) => [shipDir, f]), ...inners.map((f) => [innerDir, `interior/${f}`]), ...comps.map((f) => [compDir, `components/${f}`])]) {
    const buf = readFileSync(join(dir, f.replace(/^(interior|components)\//, '')));
    const hull = dir === shipDir;
    if (hull) glbBytes += buf.length; else if (dir === innerDir) innerBytes += buf.length; else compBytes += buf.length;
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
    if (hull && mine.size && !emb) pooledShips++;
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
  const totalMB = (glbBytes + innerBytes + compBytes + poolBytes) / 1048576;
  say(`    Schiffe: ${glbs.length} (mit Bildablage ${pooledShips})   Innenräume: ${inners.length}   Komponenten: ${comps.length}   Bildverweise: ${refs} auf ${used.size} Dateien (${shared} in mehr als einer Datei)   eingebettet: ${embedded}`);
  say(`    GLB ${(glbBytes / 1048576).toFixed(1)} MB + Innenräume ${(innerBytes / 1048576).toFixed(1)} MB + Komponenten ${(compBytes / 1048576).toFixed(1)} MB + Ablage ${files.length} Dateien ${(poolBytes / 1048576).toFixed(1)} MB = ${totalMB.toFixed(1)} MB`);
  if (orphans.length) say(`    WARNUNG: ${orphans.length} Bilder in dist/hangar/tex nennt kein Schiff, kein Innenraum und keine Komponente (${orphans.slice(0, 3).join(', ')}${orphans.length > 3 ? ', …' : ''}): Ballast im Image, der Bau entfernt sie (prunePool)`);
  sollIst(`Schiffe mit Bildablage >= ${BILDER.schiffe}, jeder Verweis da und Name = sha256 des Inhalts, zusammen <= ${BILDER.gesamtMB} MB, je Datei <= ${BILDER.dateiMB} MB`, `${pooledShips}, ${missing.size} fehlen, ${wrongName.length} falsch benannt, ${totalMB.toFixed(1)} MB, ${big.length} zu gross`);
  for (const x of [...missing].slice(0, 10)) fail(`[17] ${x} fehlt in dist/hangar/tex: das Material bleibt ohne diese Karte (Ablage nicht mit eingecheckt oder vom Bau zu frueh entfernt?)`);
  for (const x of wrongName.slice(0, 10)) fail(`[17] dist/hangar/tex/${x}: Name ist nicht der Inhalt (sha256, 16 Zeichen); die URL ist ein Jahr im Cache, ein geaenderter Inhalt unter altem Namen erreicht niemanden`);
  for (const x of foreign.slice(0, 10)) fail(`[17] ${x}: Bild mit URI ausserhalb der Ablage (../tex/<inhalt>.<endung>)`);
  for (const x of big.slice(0, 10)) fail(`[17] ${x} ueber ${BILDER.dateiMB} MB: GitHub lehnt ab 100 MB ab; Karten verkleinern oder Schiff teilen`);
  if (totalMB > BILDER.gesamtMB) fail(`[17] Schiffe, Innenräume, Komponenten und Ablage zusammen ${totalMB.toFixed(1)} MB ueber dem Deckel von ${BILDER.gesamtMB} MB (Repo und Image): Karten grosser Schiffe kleiner oder Innenraum weg, Budget in .planning/notes/hangar-alle-schiffe.md`);
  if (pooledShips < BILDER.schiffe) fail(`[17] nur ${pooledShips} Schiffe mit Bildablage (Klinke ${BILDER.schiffe}): fehlt dist/hangar/tex oder ein Schiff traegt seine Bilder wieder selbst?`);
  ist.bildSchiffe = pooledShips; ist.bildDateien = files.length; ist.bildMB = Math.round(totalMB);
}

say('\n[18] Schiffe ohne Platzhaltermaterial: keine Flaeche, fuer die der Export kein Spielmaterial fand');
// Findet der Export zu einer Geometrie kein Material, setzt er ein namenloses
// Ersatzmaterial ein (Grundfarbe 0,8, Rauheit 0,5, keine Karte). Im Hangar
// ist das reines Weiss: Krisz, 27.10.2026, Cockpit der 325a: „was ist mit
// schiff interior?“ Ursache und Nachtrag: .planning/notes/hangar-innenraum.md.
// Gezaehlt werden Dreiecke ohne Material oder mit namenlosem Material. Seit
// dem Nachtrag (pc/hangar-innenraum, 390151 -> 56) gilt: kein Schiff traegt
// welche, ausser den benannten Luecken im Spiel selbst. Eine Ausnahme mit
// mehr Dreiecken ist FEHLER, eine ohne (Zombie) auch: dann ist sie zu
// streichen.
const PLATZHALTER_AUSNAHMEN = {
  'drak-caterpillar': { dreiecke: 22, anlass: 'Camera02: DRAK_Caterpillar_Exterior.mtl hat kein Untermaterial 54 (nur 53)' },
  'drak-caterpillar-pirate': { dreiecke: 22, anlass: 'Camera02: DRAK_Caterpillar_Exterior.mtl hat kein Untermaterial 54 (nur 53)' },
  'rsi-scorpius-antares': { dreiecke: 12, anlass: 'TempBox: rsi_scorpius_antares_missile_turret.cga nennt kein .mtl (Platzhalterbox)' },
};
{
  const shipDir = join(DIST, 'hangar', 'ships');
  const glbs = existsSync(shipDir) ? readdirSync(shipDir).filter((x) => x.endsWith('.glb')).sort() : [];
  const hit = [];
  let tris = 0;
  for (const f of glbs) {
    const buf = readFileSync(join(shipDir, f));
    if (buf.toString('utf8', 16, 20) !== 'JSON') { fail(`[18] ${f}: kein JSON-Block am Anfang, Schiff nicht geprueft`); continue; }
    const gltf = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
    let t = 0, all = 0;
    for (const me of gltf.meshes ?? []) for (const p of me.primitives ?? []) {
      const acc = gltf.accessors?.[p.indices ?? p.attributes?.POSITION];
      const n = (acc?.count ?? 0) / 3;
      all += n;
      const m = p.material == null ? null : gltf.materials?.[p.material];
      if (!m?.name) t += n;
    }
    if (t) { hit.push({ slug: f.replace(/\.glb$/, ''), t: Math.round(t), pct: (100 * t) / all }); tris += t; }
  }
  hit.sort((a, b) => b.t - a.t);
  const erlaubt = Object.values(PLATZHALTER_AUSNAHMEN).reduce((n, a) => n + a.dreiecke, 0);
  say(`    Schiffe geprueft: ${glbs.length}   mit Platzhalter: ${hit.length}   Dreiecke mit Platzhalter: ${Math.round(tris)}   benannte Ausnahmen: ${Object.keys(PLATZHALTER_AUSNAHMEN).length} (${erlaubt} Dreiecke)`);
  for (const h of hit.slice(0, 8)) say(`      ${h.slug.padEnd(40)} ${String(h.t).padStart(7)} Dreiecke (${h.pct.toFixed(1)} %)${PLATZHALTER_AUSNAHMEN[h.slug] ? `  Ausnahme: ${PLATZHALTER_AUSNAHMEN[h.slug].anlass}` : ''}`);
  sollIst(`kein Schiff mit Platzhalter ausser ${Object.keys(PLATZHALTER_AUSNAHMEN).length} benannten (je hoechstens ihre Zahl), alle ${BILDER.schiffe} Schiffe geprueft`, `${Math.round(tris)} Dreiecke in ${hit.length} von ${glbs.length}`);
  if (glbs.length < BILDER.schiffe) fail(`[18] nur ${glbs.length} Schiffe in dist/hangar/ships geprueft (Klinke ${BILDER.schiffe})`);
  const fremd = hit.filter((h) => !PLATZHALTER_AUSNAHMEN[h.slug]);
  if (fremd.length) {
    fail(`[18] ${fremd.length} Schiffe tragen das Platzhaltermaterial des Exports (${fremd.slice(0, 4).map((h) => `${h.slug} ${h.t}`).join(', ')}${fremd.length > 4 ? ', …' : ''} Dreiecke): im Hangar reinweiss. Materialnachtrag: node scripts/extract-hangar-sources.mjs ships-matfix --ships <slug>, dann neu bauen (.planning/notes/hangar-innenraum.md)`);
  }
  for (const [slug, a] of Object.entries(PLATZHALTER_AUSNAHMEN)) {
    const h = hit.find((x) => x.slug === slug);
    if (!glbs.includes(`${slug}.glb`)) fail(`[18] Ausnahme ${slug}: Schiff nicht mehr in dist/hangar/ships, Ausnahme streichen`);
    else if (!h) fail(`[18] Ausnahme ${slug} (${a.anlass}) ohne Anlass: das Schiff traegt keinen Platzhalter mehr, Ausnahme in PLATZHALTER_AUSNAHMEN streichen`);
    else if (h.t > a.dreiecke) fail(`[18] ${slug}: ${h.t} Dreiecke mit Platzhalter, die Ausnahme deckt ${a.dreiecke} (${a.anlass})`);
  }
  ist.platzhalter = Math.round(tris); ist.platzhalterSchiffe = hit.length;
}

say('\n[19] Schiffswahl: Bilder und Umrisse der Karten, Woerter und Stufen der Suche, Proben durch die ausgelieferte Suche');
// Sperrklinken (Grundsatz 5), Startwerte aus dem ersten Bau am 29.10.2026:
// alle 231 Hangar-Schiffe mit eigenem Bild, 6 Proben je Sprache.
const WAHL = { karten: 231, proben: 12 };
{
  const ent = (v) => v.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  let mod = null;
  try { mod = await import(pathToFileURL(ctrlFile).href); } catch (e) { fail(`[19] dist/assets/hangar-overview.js laedt nicht als Modul (${e.message})`); }
  for (const fn of ['fold', 'parseQuery', 'findShip', 'dockSearch', 'figuresOf']) if (mod && typeof mod[fn] !== 'function') { fail(`[19] der Controller exportiert ${fn} nicht mehr`); mod = null; }
  // Proben je Sprache: Suchtext und was jeder Treffer erfuellen muss. Wer
  // die Suche bewusst aendert, aendert sie hier mit.
  const PROBEN = {
    en: [
      ['cutty', 1, (hits, best) => best.includes('drak-cutlass-black'), 'Spitzname: die Cutlass Black unter den besten'],
      ['mining solo', 2, (hits, best, s) => hits.every((id) => s(id).pur.includes('bergbau') && s(id).stat.crew === 1), 'jeder Treffer Bergbau mit Crew 1'],
      ['100 scu', 10, (hits, best, s) => hits.every((id) => s(id).stat.cargo >= 100), 'jeder Treffer ab 100 SCU'],
      ['under 2m', 10, (hits, best, s) => hits.every((id) => s(id).stat.price != null && s(id).stat.price <= 2e6), 'jeder Treffer bis 2 Mio. aUEC'],
      ['prospecter', 1, (hits, best) => best.includes('misc-prospector'), 'Tippfehler: die Prospector vorn'],
      ['heavy fighter', 3, (hits, best, s) => hits.every((id) => s(id).grp.includes('kampf:schwer') || s(id).name.includes('heavy')), 'jeder Treffer schwerer Jaeger'],
    ],
    de: [
      ['cutty', 1, (hits, best) => best.includes('drak-cutlass-black'), 'Spitzname: die Cutlass Black unter den besten'],
      ['bergbau solo', 2, (hits, best, s) => hits.every((id) => s(id).pur.includes('bergbau') && s(id).stat.crew === 1), 'jeder Treffer Bergbau mit Crew 1'],
      ['ab 100 scu', 10, (hits, best, s) => hits.every((id) => s(id).stat.cargo >= 100), 'jeder Treffer ab 100 SCU'],
      ['unter 2 mio', 10, (hits, best, s) => hits.every((id) => s(id).stat.price != null && s(id).stat.price <= 2e6), 'jeder Treffer bis 2 Mio. aUEC'],
      ['prospektor', 1, (hits, best) => best.includes('misc-prospector'), 'Tippfehler: die Prospector vorn'],
      ['schwerer jäger', 3, (hits, best, s) => hits.every((id) => s(id).grp.includes('kampf:schwer') || s(id).name.includes('schwerer')), 'jeder Treffer schwerer Jaeger'],
    ],
  };
  let eigen = 0, proben = 0;
  for (const page of PAGES) {
    const html = page.html;
    const { keys } = DOCK[page.lang];
    const lis = [...html.matchAll(/<li data-id="([^"]+)"([^>]*)>\s*<a class="hg-card"[^>]*>\s*(?:<img src="([^"]*)"[^>]*>|<i class="hg-noimg"><\/i>)\s*<span class="hg-card__n">([^<]*)<\/span>/g)];
    const attr = (a, k) => ent(new RegExp(`\\sdata-${k}="([^"]*)"`).exec(a)?.[1] ?? '');
    const opts = (f) => new Set([...html.matchAll(new RegExp(`class="hgx-opt" data-f="${f}" data-v="([^"]*)"`, 'g'))].map((m) => ent(m[1])));
    const purs = opts('pur'), sizes = opts('size');
    const grps = new Set([...html.matchAll(/class="hgx-sub" data-of="([^"]+)" data-grp="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`));
    const total = dockIds(html).length;
    let mine = 0;
    const ohne = [], bild = [], wort = [], stufe = [], zwecklos = [];
    const pool = [];
    for (const [, id, a, src, nameRaw] of lis) {
      const m = /^\/hangar\/cards\/([^/?]+)\.webp\?v=([0-9a-f]{8})$/.exec(src ?? '');
      if (!m || m[1] !== id) ohne.push(id);
      else {
        mine++;
        const card = join(DIST, 'hangar', 'cards', `${id}.webp`), top = join(DIST, 'hangar', 'cards', 'top', `${id}.webp`);
        if (!existsSync(card) || !existsSync(top)) bild.push(`${id}: ${!existsSync(card) ? 'Bild' : 'Umriss'} fehlt in dist/hangar/cards`);
        else if (createHash('sha256').update(readFileSync(card)).update(readFileSync(top)).digest('hex').slice(0, 8) !== m[2]) bild.push(`${id}: v=${m[2]} ist nicht der Inhalt von Bild und Umriss (src/data/hangar-cards.json veraltet?)`);
        const fpv = attr(a, 'fp').split(' ').map(Number);
        if (fpv.length !== 2 || !fpv.every((x) => Number.isFinite(x) && x > 0)) bild.push(`${id}: data-fp „${attr(a, 'fp')}“ sind nicht zwei Masze in Metern`);
      }
      const q = attr(a, 'q');
      if (mod && mod.fold(q) !== q) wort.push(`${id}: data-q „${q.slice(0, 60)}“ aendert sich unter fold()`);
      if (!attr(a, 'p')) zwecklos.push(id);
      for (const p of attr(a, 'p').split(' ').filter(Boolean)) if (!purs.has(p)) stufe.push(`${id}: Zweck ${p} ist keine Stufe der Pille Wofuer`);
      for (const g of attr(a, 'g').split(' ').filter(Boolean)) if (!grps.has(g)) stufe.push(`${id}: Unterrolle ${g} hat keine Taste in #hgx-subs`);
      const sz = attr(a, 'sz');
      if (sz && !sizes.has(sz)) stufe.push(`${id}: Groesse ${sz} ist keine Stufe der Pille Groesse`);
      if (mod) pool.push(mod.findShip({ id, name: ent(nameRaw), mk: attr(a, 'mk'), q, p: attr(a, 'p'), g: attr(a, 'g'), sz }, mod.figuresOf(keys, attr(a, 'v'))));
    }
    if (page.lang === 'en') eigen = mine;
    say(`    ${page.file}: ${lis.length} von ${total} Karten gelesen, ${mine} mit eigenem Bild, ${lis.length - zwecklos.length} mit Zweck, Stufen: ${purs.size} Zwecke, ${grps.size} Unterrollen, ${sizes.size} Groessen`);
    if (lis.length !== total) fail(`[19] ${page.file}: ${total - lis.length} Karten ohne die Form li > a.hg-card > img + .hg-card__n — der Leser ist kaputt oder die Karte umgebaut`);
    if (ohne.length) say(`    WARNUNG: ${ohne.length} Karten zeigen das Bild des Wikis statt eines eigenen (${ohne.slice(0, 4).join(', ')}${ohne.length > 4 ? ', …' : ''}): node scripts/render-hangar-cards.mjs --only <id> (Schiene C)`);
    for (const b of bild.slice(0, 6)) fail(`[19] ${page.file}: ${b}`);
    for (const w of wort.slice(0, 6)) fail(`[19] ${page.file}: ${w} (finder.ts tagsOf faltet anders als der Controller)`);
    for (const x of stufe.slice(0, 6)) fail(`[19] ${page.file}: ${x}`);
    if (zwecklos.length) fail(`[19] ${page.file}: ${zwecklos.length} Schiffe ohne Zweck (${zwecklos.slice(0, 6).join(', ')}): unter keiner Stufe der Pille Wofuer zu finden — shipFinder in src/lib/hangar/finder.ts (Familien, Laufbahn, Boden)`);
    if (!purs.size || !sizes.size || !grps.size) fail(`[19] ${page.file}: Pillen oder Unterrollen fehlen (Wofuer ${purs.size}, Groesse ${sizes.size}, Unterrollen ${grps.size})`);
    // Proben durch die ausgelieferte Suche, mit dem Vokabular dieser Seite.
    let vocab = null;
    try { vocab = JSON.parse(/<script type="application\/json" id="hgx-vocab">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? 'null'); } catch { vocab = null; }
    if (!vocab) { fail(`[19] ${page.file}: #hgx-vocab fehlt oder ist kein JSON`); continue; }
    if (!mod) continue;
    const crew = Object.fromEntries(vocab.crew.map((c) => [c.k, c]));
    const byId = new Map(pool.map((x) => [x.id, x]));
    for (const [text, min, ok, what] of PROBEN[page.lang]) {
      const p = mod.parseQuery(text, vocab);
      const res = mod.dockSearch(pool, { hits: p.hits, words: p.words }, crew);
      const hits = [...res.keys()];
      const top = Math.max(...res.values());
      const best = hits.filter((id) => res.get(id) === top);
      const pass = hits.length >= min && ok(hits, best, (id) => byId.get(id));
      say(`      „${text}“ -> ${hits.length} Treffer, vorn ${best.slice(0, 3).join(', ') || '–'}${pass ? '' : '   <- FALSCH'}`);
      if (pass) proben++;
      else fail(`[19] ${page.file}: Probe „${text}“: ${hits.length} Treffer (mindestens ${min}), erwartet: ${what} — parseQuery/dockSearch im Controller oder vocab() in finder.ts`);
    }
  }
  sollIst(`Karten mit eigenem Bild >= ${WAHL.karten}, Proben >= ${WAHL.proben}, kein Bild-, Wort- oder Stufenfehler`, `${eigen} Karten, ${proben} Proben`);
  if (eigen < WAHL.karten) fail(`[19] nur ${eigen} Karten mit eigenem Bild (Klinke ${WAHL.karten}): src/data/hangar-cards.json oder public/hangar/cards fehlen?`);
  if (proben < WAHL.proben && !findings.some((f) => f.startsWith('[19]'))) fail(`[19] nur ${proben} Proben bestanden (Klinke ${WAHL.proben})`);
  ist.wahlKarten = eigen; ist.wahlProben = proben;
}

say('\n[20] Begehbare Innenräume: Datei, Lampen und Einstiegspunkte je Schiff, im Modellraum des Rumpfs, Naht zu Controller und Seite');
// Seit 29.10.2026 (Krisz 20:49: „ja ich will auch in die innenräume“) gibt
// die Szene je Werkslack-Datei einen Innenraum mit (opts.interior, HangarApp
// .astro), den der Viewer beim Einsteigen lädt und neben das Modell des
// Rumpfs hängt, ohne eigene Verschiebung. Stimmt sein Modellraum nicht,
// steht der Innenraum neben dem Schiff; fehlt die Datei oder ihre Liste
// /hangar-innen/<id>.json, scheitert das Einsteigen, und das sieht nur, wer
// genau dieses Schiff betritt. Hüllquader aus dem JSON-Teil der GLB (Knoten
// und Eckwerte der Positionen): jeder Hüllquader des Innenraums im Hüllquader
// des Rumpfs mit INNEN.rand Spielraum. Klinke: Innenräume auf der Seite.
const INNEN = { min: 217, randM: 0.5 };
{
  const glbJson = (file) => {
    const buf = readFileSync(file);
    return buf.toString('utf8', 16, 20) === 'JSON' ? JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12))) : null;
  };
  // Hüllquader einer Szene: je Knoten mit Netz die acht Ecken der Eckwerte
  // seiner Positionen, mit der Weltmatrix des Knotens (TRS oder matrix)
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const trs = (n) => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  const bounds = (j) => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const walk = (i, P) => {
      const n = j.nodes[i], M = mul(P, trs(n));
      for (const p of n.mesh !== undefined ? j.meshes[n.mesh].primitives : []) {
        const a = j.accessors[p.attributes.POSITION];
        if (!a?.min || !a?.max) continue;
        for (let c = 0; c < 8; c++) {
          const v = [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]];
          for (let k = 0; k < 3; k++) { const w = M[k] * v[0] + M[4 + k] * v[1] + M[8 + k] * v[2] + M[12 + k]; lo[k] = Math.min(lo[k], w); hi[k] = Math.max(hi[k], w); }
        }
      }
      for (const c of n.children ?? []) walk(c, M);
    };
    for (const i of j.scenes?.[j.scene ?? 0]?.nodes ?? []) walk(i, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return { lo, hi };
  };
  const pathOf = (u) => String(u ?? '').split('?')[0];
  let innen = 0, imRumpf = 0, mitPunkten = 0, lampen = 0;
  const seen = new Set();
  for (const page of PAGES) {
    let cfg = null;
    try { cfg = JSON.parse(/<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(page.html)?.[1] ?? 'null'); } catch { cfg = null; }
    const map = cfg?.opts?.interior;
    if (!map || typeof map !== 'object') { fail(`[20] ${page.file}: opts.interior fehlt in #hg-stage (HangarApp.astro): kein Schiff bietet Einsteigen an`); continue; }
    if (!/id="hgx-walk"/.test(page.html)) fail(`[20] ${page.file}: Knopf #hgx-walk fehlt (HangarPage.astro): Einsteigen ist nicht zu erreichen`);
    const tex = new Set(Object.values(cfg.models ?? {}).map((e) => pathOf(e?.[1])).filter(Boolean));
    const n = Object.keys(map).length;
    if (page.lang === 'de') innen = n;
    for (const [hull, e] of Object.entries(map)) {
      const id = hull.replace(/^\/hangar\/ships\//, '').replace(/\.glb$/, '');
      if (!tex.has(hull)) fail(`[20] ${page.file}: Innenraum zu ${hull}, aber kein Schiff zeigt diese Werkslack-Datei (models): der Viewer findet ihn nie`);
      const glb = join(DIST, pathOf(e?.url)), meta = join(DIST, pathOf(e?.meta));
      if (!e?.url || !existsSync(glb)) { fail(`[20] ${page.file}: ${id}: Innenraum ${pathOf(e?.url) || '(ohne url)'} fehlt in dist/: Einsteigen scheitert`); continue; }
      if (!e?.meta || !existsSync(meta)) { fail(`[20] ${page.file}: ${id}: Liste ${pathOf(e?.meta) || '(ohne meta)'} fehlt in dist/ (src/pages/hangar-innen/[id].json.ts)`); continue; }
      const v = /[?&]v=([^&]+)/.exec(e.url)?.[1], mv = /[?&]v=([^&]+)/.exec(e.meta)?.[1];
      if (v !== mv) fail(`[20] ${page.file}: ${id}: Version der Liste (${mv}) nicht die des Innenraums (${v}): der Jahres-Cache hielte alte Lampen und Punkte`);
      if (seen.has(id)) continue;
      seen.add(id);
      let m = null;
      try { m = JSON.parse(readFileSync(meta, 'utf8')); } catch { m = null; }
      if (!m || !Array.isArray(m.lights) || !Array.isArray(m.spots)) { fail(`[20] ${id}: ${pathOf(e.meta)} ist keine Liste { lights, spots }`); continue; }
      const badP = [...m.lights, ...m.spots].filter((x) => !Array.isArray(x?.p) || x.p.length !== 3 || !x.p.every(Number.isFinite)).length;
      if (badP) fail(`[20] ${id}: ${badP} Lampen oder Punkte ohne Lage [x, y, z]`);
      if (m.spots.length) mitPunkten++;
      else say(`    WARNUNG: ${id}: keine Einstiegspunkte, der Viewer steigt in der Mitte des Innenraums ein`);
      lampen += m.lights.length;
      const hullFile = join(DIST, hull);
      if (!existsSync(hullFile)) { fail(`[20] ${id}: Rumpf ${hull} fehlt in dist/`); continue; }
      const a = bounds(glbJson(glb)), h = bounds(glbJson(hullFile));
      const over = Math.max(0, ...[0, 1, 2].flatMap((k) => [h.lo[k] - INNEN.randM - a.lo[k], a.hi[k] - h.hi[k] - INNEN.randM]));
      if (over > 0) fail(`[20] ${id}: Innenraum ragt ${over.toFixed(2)} m über den Hüllquader des Rumpfs: Modellraum stimmt nicht (Wurzel wie beim Rumpf, scripts/build-hangar-assets.mjs --kind interior)`);
      else imRumpf++;
    }
  }
  sollIst(`Innenräume auf der Seite >= ${INNEN.min}, je Datei und Liste in dist/, Version gleich, Hüllquader im Rumpf (Rand ${INNEN.randM} m), Knopf da`, `${innen} Innenräume, ${imRumpf} im Rumpf, ${mitPunkten} mit Einstiegspunkten, ${lampen} Lampen`);
  if (innen < INNEN.min) fail(`[20] nur ${innen} Innenräume auf /de/hangar.html (Klinke ${INNEN.min}): opts.interior in HangarApp.astro oder interior im Manifest leer?`);
  ist.innen = innen; ist.innenLampen = lampen;
}

say('\n[21] Stationen (Phase 22, H1): Leiste je Seite, Hologramm-Modul mit Version, Viewer-Naht, ?station= hin und zurueck, ?pane=ship lesbar');
// Sperrklinken (Grundsatz 5), Startwerte aus dem ersten Bau am 10.11.2026:
// zwei Stationen (Uebersicht, Loadout; Kampf kommt mit H2), 14 Proben der
// Adresse je Seite. Woerter der Werkstatt: 47 mit der Tafel „Ausruestung“,
// 116 seit dem Datenblatt des Bauteils (11.11.2026), 118 mit seinem Weg in
// der flachen Werkstatt (sheet.open, sheet.back).
const STATIONEN = { stationen: 2, proben: 28, woerter: 118, stellungen: 36 };
// Keine Klinke, ein Sichturteil (WINDOWS #156): wie stark sich die Tafeln zur
// Kamera drehen, ist am 11.11.2026 gerendert verglichen und so abgenommen.
// Die Stellungen unten rechnen gegen den Wert des Moduls; ohne diese Zahl
// bestuenden sie auch mit 0.3. Wer FACE_RISE aendert, rendert neu, sieht hin
// und zieht sie im selben Commit nach.
const KANTE_ANGESEHEN = 0.065;
{
  let mod = null;
  try { mod = await import(pathToFileURL(ctrlFile).href); } catch (e) { fail(`[21] dist/assets/hangar-overview.js laedt nicht als Modul (${e.message})`); }
  for (const fn of ['parseState', 'serializeState', 'shipClass', 'rankIn']) if (mod && typeof mod[fn] !== 'function') { fail(`[21] der Controller exportiert ${fn} nicht mehr`); mod = null; }
  const list = Array.isArray(mod?.STATIONS) ? mod.STATIONS : [];
  const vor = mod?.STATION_DEFAULT;
  if (mod && (!list.length || !list.includes(vor))) fail(`[21] STATIONS (${list.join(', ') || '—'}) nennt die Vorgabe STATION_DEFAULT (${vor}) nicht`);
  // Viewer-Naht und Modul
  const VNAHT = ['station', 'canStation', 'onStation'];
  // als Schluessel des Rueckgabeobjekts (station, / canStation: / onStation(),
  // ohne Zeilenkommentare: die nennen die Namen auch (wie [16])
  const apiOhneK = api.replace(/\/\/[^\n]*/g, '');
  const vfehlt = VNAHT.filter((n) => !new RegExp(`(?:^|[\\s,{])${n}\\s*(?:[(:,]|$)`, 'm').test(apiOhneK));
  if (vfehlt.length) fail(`[21] dist/assets/hangar-viewer.js liefert ${vfehlt.join(', ')} nicht: die Seite bleibt bei der Tafel, die Halle zeigt nie eine Station`);
  const holoFile = join(DIST, 'assets', 'hangar-holo3d.js');
  const holoSrc = existsSync(holoFile) ? readFileSync(holoFile) : null;
  if (!holoSrc) fail('[21] dist/assets/hangar-holo3d.js fehlt: Stationen in der Halle laden nicht');
  else if (!/export function holoLayer\(/.test(holoSrc.toString('utf8'))) fail('[21] dist/assets/hangar-holo3d.js exportiert holoLayer nicht mehr (Naht zum Viewer, station())');
  // Tafeln liegen im Bild immer über Halle, Deko und Schiff (Krisz 10.11.2026
  // zur Ironclad-Tafel, die eine Kante durchstieß: „das soll nicht passieren“)
  let ueber = '—';
  if (holoSrc) {
    const hs = holoSrc.toString('utf8');
    const an = /P\.mesh = new THREE\.Mesh\([^\n]*depthTest: false/.test(hs), zurueck = /P\.mesh\.material\.depthTest\s*=/.test(hs);
    if (!an) fail('[21] dist/assets/hangar-holo3d.js: das Material der Tafel (P.mesh) zeichnet nicht ohne Tiefentest: Wände, Decke oder Rumpf schneiden sie an');
    else if (zurueck) fail('[21] dist/assets/hangar-holo3d.js setzt P.mesh.material.depthTest nachträglich: die Tafel kann wieder angeschnitten werden');
    else ueber = 'ohne Tiefentest';
  }
  // Tafeln am Boden schauen zur Kamera (Krisz 11.11.2026: „die sollen
  // richtung kamera schauen“). Nachgerechnet am ausgelieferten Modul, mit
  // eigener Geometrie statt seiner Winkel: was das Auge sieht, ist, welche
  // Kante der Tafel naeher an der Kamera steht und um wie viel.
  let schaut = '—', stellungen = 0;
  if (holoSrc) {
    let hm = null;
    try { hm = await import(pathToFileURL(holoFile).href); } catch (e) { fail(`[21] dist/assets/hangar-holo3d.js laedt nicht als Modul (${e.message})`); }
    if (hm && (typeof hm.panelYaw !== 'function' || typeof hm.panelSpread !== 'function' || !(hm.FACE_RISE > 0))) {
      fail('[21] dist/assets/hangar-holo3d.js exportiert panelYaw, panelSpread oder FACE_RISE nicht mehr: wohin die Tafeln schauen, prueft dann nichts');
    } else if (hm) {
      if (Math.abs(hm.FACE_RISE - KANTE_ANGESEHEN) > 1e-9) fail(`[21] dist/assets/hangar-holo3d.js: FACE_RISE ist ${hm.FACE_RISE}, angesehen und abgenommen sind ${KANTE_ANGESEHEN} (WINDOWS #156): erst rendern und hinsehen, dann die Zahl im Tor nachziehen`);
      const NEIG = 0.22, WEIT = 14, EPS = 1e-4, c = { x: 3, y: 5, z: -7 };
      // Linsen: halbe Tafelbreite im Bild je Bildweite (reach) und wie weit die
      // Tafel neben der Blickachse steht. Startansicht eines Jaegers, weiter
      // Blick eines grossen Schiffs (64 Grad), und eine kleine Tafel, die sich
      // ganz zuwenden darf.
      const LINSEN = [['Jäger', 0.162, 0.55], ['großes Schiff', 0.264, 0.88], ['kleine Tafel', 0.02, 0.5]];
      const falsch = [];
      for (const [linse, reach, seitlich] of LINSEN) for (const kurs of [0, 1.1, 2.6, -2]) {
        const fh = { x: Math.sin(kurs), z: -Math.cos(kurs) }, r = { x: -fh.z, z: fh.x };   // Blick und rechts im Grundriss
        const f = { x: fh.x * Math.cos(NEIG), y: -Math.sin(NEIG), z: fh.z * Math.cos(NEIG) };
        const tiefe = (q) => (q.x - c.x) * f.x + (q.y - c.y) * f.y + (q.z - c.z) * f.z;
        const quer = (q) => (q.x - c.x) * r.x + (q.z - c.z) * r.z;
        const bildX = (q) => quer(q) / tiefe(q);
        for (const seite of [-1, 0, 1]) {
          stellungen++;
          const at = { x: c.x + fh.x * WEIT + r.x * WEIT * seitlich * seite, y: 0, z: c.z + fh.z * WEIT + r.z * WEIT * seitlich * seite };
          const yaw = hm.panelYaw(f, c, at, reach), flach = Math.atan2(-f.x, -f.z);
          const wo = `${linse}, Blick ${kurs} rad, Tafel ${seite < 0 ? 'links' : seite > 0 ? 'rechts' : 'mittig'}`;
          if (!Number.isFinite(yaw)) { falsch.push(`${wo}: panelYaw liefert ${yaw}`); continue; }
          const dreh = Math.atan2(Math.sin(yaw - flach), Math.cos(yaw - flach));
          const u = { x: Math.cos(yaw), z: -Math.sin(yaw) };                 // Breite der Tafel
          const kante = (k) => ({ x: at.x + u.x * k, y: 0, z: at.z + u.z * k });
          // Breite im Bild gegen eine eigene Projektion: Steigung von bildX entlang der Tafel, gemessen an einer Tafel quer zum Blick
          const mass = ((bildX(kante(EPS)) - bildX(kante(-EPS))) / (2 * EPS)) * tiefe(at), spr = hm.panelSpread(f, c, at, yaw);
          if (!(Math.abs(spr - mass) < 1e-3)) { falsch.push(`${wo}: panelSpread ${Number(spr).toFixed(4)}, die Projektion ergibt ${mass.toFixed(4)}: die Tafel stünde breiter oder schmaler im Bild als gezeichnet`); continue; }
          if (seite === 0) {
            if (Math.abs(dreh) > 1e-9) falsch.push(`${wo}: um ${dreh.toFixed(3)} rad gedreht, obwohl sie vor der Kamera steht`);
            continue;
          }
          // so breit, wie place() sie stellt; aussen = weiter von der Blickachse
          const halb = (reach * tiefe(at)) / spr;
          const a = kante(halb), b = kante(-halb), aussen = Math.abs(quer(a)) > Math.abs(quer(b)) ? a : b, innen = aussen === a ? b : a;
          const hoeher = tiefe(innen) / tiefe(aussen) - 1;                    // um so viel steht die aeussere Kante im Bild hoeher
          const ganz = Math.atan2(c.x - at.x, c.z - at.z), bisGanz = Math.abs(Math.atan2(Math.sin(ganz - yaw), Math.cos(ganz - yaw)));
          if (!(hoeher > 0.01)) falsch.push(`${wo}: die äußere Kante steht im Bild ${(hoeher * 100).toFixed(1)} % höher als die innere, sie schaut nicht zur Kamera`);
          else if (hoeher > hm.FACE_RISE + 1e-6) falsch.push(`${wo}: die äußere Kante steht ${(hoeher * 100).toFixed(1)} % höher als die innere, mehr als FACE_RISE ${hm.FACE_RISE}: die Zeilen laufen zu schräg`);
          else if (hoeher < hm.FACE_RISE - 1e-6 && bisGanz > 1e-6) falsch.push(`${wo}: die äußere Kante steht nur ${(hoeher * 100).toFixed(1)} % höher, obwohl die Tafel der Kamera noch ${bisGanz.toFixed(3)} rad abgewandt ist und FACE_RISE ${hm.FACE_RISE} erlaubt`);
        }
      }
      for (const t of falsch) fail(`[21] Tafel am Boden, ${t}`);
      schaut = falsch.length ? `${falsch.length} von ${stellungen} Stellungen falsch` : `zur Kamera in ${stellungen} Stellungen (äußere Kante höchstens ${hm.FACE_RISE * 100} % höher)`;
    }
  }
  // Tafel „Ausruestung“ in der Halle: Werkstatt, Controller und Modul halten
  // dieselbe Naht (board hin, act zurueck)
  const wsFile = join(DIST, 'assets', 'hangar-layouts.js');
  const ohneK = (t) => t.replace(/\/\/[^\n]*/g, '');
  const ws = existsSync(wsFile) ? ohneK(readFileSync(wsFile, 'utf8')) : '';
  const wsAus = /return\s*\{([^{}]*)\};?\s*\}\s*$/.exec(ws)?.[1] ?? '';
  const nahtFehlt = [
    [/\bboard\b/.test(wsAus) && /\bact\b/.test(wsAus), 'dist/assets/hangar-layouts.js gibt board und act nicht mehr heraus'],
    [/workshop\?\.board\(\)/.test(ohneK(ctrl)) && /workshop\?\.act\(/.test(ohneK(ctrl)), 'dist/assets/hangar-overview.js reicht board und act der Werkstatt nicht mehr an die Halle'],
    [!!holoSrc && /function drawLoadout\(/.test(holoSrc.toString('utf8')) && /act: 'lo'/.test(holoSrc.toString('utf8')), 'dist/assets/hangar-holo3d.js zeichnet die Tafel nicht mehr (drawLoadout) oder meldet ihre Klicks nicht (act lo)'],
  ].filter(([ok]) => !ok).map(([, text]) => text);
  for (const text of nahtFehlt) fail(`[21] ${text}: die Tafel „Ausrüstung“ in der Halle bleibt leer oder stumm`);
  // Woerter der Werkstatt: jedes m('…') des Skripts steht in #hgl-msg
  const wsKeys = [...new Set([...ws.matchAll(/\bm\('([A-Za-z0-9_.]+)'/g)].map((m) => m[1]))];
  let woerterSeiten = 0;
  for (const page of PAGES) {
    const box = /id="hgl-msg"[^>]*>([\s\S]*?)<\/div>/.exec(page.html)?.[1] ?? '';
    const da = new Set([...box.matchAll(/<span[^>]*\bdata-m="([^"]+)"[^>]*>([^<]*)</g)].filter((m) => m[2].trim()).map((m) => m[1]));
    const ohne = wsKeys.filter((k) => !da.has(k));
    if (ohne.length) fail(`[21] ${page.file}: #hgl-msg fehlt ${ohne.length === 1 ? 'das Wort' : 'Wörter'} ${ohne.join(', ')}: die Werkstatt zeigt den rohen Schlüssel (LAYOUT_MSG in src/components/hangar/LayoutWorkshop.astro)`);
    else woerterSeiten++;
  }
  const holoV = holoSrc ? createHash('sha1').update(holoSrc).digest('hex').slice(0, 8) : '';
  let proben = 0, leisten = 0;
  for (const page of PAGES) {
    // Leiste: genau die Stationen des Controllers als Reiter, in seiner Folge, dazu „Als Tafel“
    const bar = /id="hgx-st"[\s\S]*?id="hgx-tafel"[^>]*>/.exec(page.html)?.[0] ?? '';
    const tabs = [...bar.matchAll(/data-station="([a-z]+)"/g)].map((m) => m[1]);
    if (!bar) fail(`[21] ${page.file}: keine Stationen-Leiste #hgx-st mit dem Knopf „Als Tafel“ (#hgx-tafel)`);
    else if (tabs.join() !== list.join()) fail(`[21] ${page.file}: Reiter der Leiste (${tabs.join(', ') || '—'}) sind nicht die Stationen des Controllers (${list.join(', ')})`);
    else leisten++;
    // Modul der Halle: versionierte URL, Version ist der Inhalt
    const cfgRaw = /<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(page.html)?.[1];
    let mUrl = '';
    try { mUrl = JSON.parse(cfgRaw ?? '{}').opts?.holo?.module ?? ''; } catch { mUrl = ''; }
    const v = /^\/assets\/hangar-holo3d\.js\?v=([0-9a-f]{8})$/.exec(mUrl)?.[1];
    if (!v) fail(`[21] ${page.file}: opts.holo.module ist keine versionierte URL von /assets/hangar-holo3d.js (${mUrl || '—'})`);
    else if (holoV && v !== holoV) fail(`[21] ${page.file}: Version des Hologramm-Moduls ${v}, Inhalt ${holoV}: der Cache hielte den alten Stand`);
    // Adresse: jede Station hin und zurueck, die alte Form, „Als Tafel“, Teilen
    if (!mod) continue;
    const ids = dockIds(page.html);
    const def = /data-default-ship="([^"]+)"/.exec(page.html)?.[1] ?? ids[0];
    const ctx = { ids: new Set(ids), defaultShip: def, tabs: ['overview'], sorts: ['name'], purs: new Set(), grps: new Set(), sizes: [], crews: new Set(), cargos: new Set(), prices: new Set(), makers: new Set() };
    const rund = (q, scope = 'location') => mod.serializeState(mod.parseState(q, '', ctx), ctx, scope);
    const probe = (q, soll, scope) => {
      proben++;
      const ist = rund(q, scope);
      if (ist !== soll) fail(`[21] ${page.file}: ${q || '(leer)'}${scope ? ` (${scope})` : ''} ergibt ${ist || '(leer)'}, erwartet ${soll || '(leer)'}`);
    };
    for (const st of list) {
      probe(`?station=${st}`, st === vor ? '' : `?station=${st}`);
      probe(`?station=${st}&tafel=1`, st === vor ? '?tafel=1' : `?station=${st}&tafel=1`);
      probe(`?ship=${def}&station=${st}`, `?ship=${def}`, 'share');
    }
    probe('', '');
    probe('?station=nope', '');
    probe('?pane=ship', list.includes('uebersicht') ? '?station=uebersicht' : '');
    probe('?pane=layout', '');
    probe('?pane=ship&station=loadout', list.includes('loadout') && vor === 'loadout' ? '' : '?station=loadout');
    probe('?tafel=ja', '');
    probe('?tafel=1', '?tafel=1');
    probe(`?ship=${def}&station=uebersicht&tafel=1`, `?ship=${def}`, 'share');
  }
  sollIst(`Stationen >= ${STATIONEN.stationen}, Leiste mit genau ihnen auf beiden Seiten, Modul ${holoV || '—'} versioniert, Viewer liefert ${VNAHT.join(', ')}, Tafeln ohne Tiefentest und zur Kamera in >= ${STATIONEN.stellungen} Stellungen, Proben der Adresse >= ${STATIONEN.proben}`,
    `${list.length} Stationen (${list.join(', ') || '—'}, Vorgabe ${vor ?? '—'}), Leiste auf ${leisten} von ${PAGES.length} Seiten, Tafeln ${ueber}, ${schaut}, ${proben} Proben`);
  sollIst(`Tafel „Ausrüstung“: Naht Werkstatt, Controller, Modul ganz; Wörter der Werkstatt >= ${STATIONEN.woerter}, alle in #hgl-msg auf beiden Seiten`,
    `Naht ${nahtFehlt.length ? `mit ${nahtFehlt.length === 1 ? 'einer Lücke' : `${nahtFehlt.length} Lücken`}` : 'ganz'}, ${wsKeys.length} Wörter, vollständig auf ${woerterSeiten} von ${PAGES.length} Seiten`);
  if (wsKeys.length < STATIONEN.woerter) fail(`[21] nur ${wsKeys.length} Wörter im Skript der Werkstatt gefunden (Klinke ${STATIONEN.woerter}): heisst m() dort anders, prüft diese Stelle nichts mehr`);
  if (list.length < STATIONEN.stationen) fail(`[21] nur ${list.length} Stationen im Controller (Klinke ${STATIONEN.stationen})`);
  if (proben < STATIONEN.proben) fail(`[21] nur ${proben} Proben der Adresse (Klinke ${STATIONEN.proben}): der Controller laedt nicht oder STATIONS ist kuerzer geworden`);
  if (stellungen < STATIONEN.stellungen) fail(`[21] nur ${stellungen} Stellungen der Tafeln nachgerechnet (Klinke ${STATIONEN.stellungen}): das Modul laedt nicht oder exportiert die Rechnung nicht mehr`);
  ist.stationen = list.length; ist.stationenProben = proben; ist.werkstattWoerter = wsKeys.length;
}

say('\n[22] Datenblatt des Bauteils in der Halle: Naht Werkstatt, Controller, Modul, Viewer; Rang-Rechnung am ausgelieferten Skript; Wege mit Zielen in dist/');
// Sperrklinken (Grundsatz 5). Erster Bau am 11.11.2026: 499 Bauteile, 340
// mit Laden, 388 mit Rezept, 499 mit Item-Seite. Laeden und Rezepte kommen
// aus Fremddaten und duerfen nach einem Datenlauf schwanken (Grundsatz 3),
// darum liegen ihre Klinken mit Abstand darunter: sie fangen, dass layouts.ts
// die Felder nicht mehr schreibt, nicht jeden Laden, der schliesst. Die
// Proben der Rang-Rechnung zaehlen genau.
const BLATT = { kauf: 250, rezept: 300, seite: 450, proben: 9 };
{
  const ohneK = (t) => t.replace(/\/\/[^\n]*/g, '');
  const wsFile = join(DIST, 'assets', 'hangar-layouts.js');
  const ws = existsSync(wsFile) ? ohneK(readFileSync(wsFile, 'utf8')) : '';
  const holoFile = join(DIST, 'assets', 'hangar-holo3d.js');
  const holo = existsSync(holoFile) ? ohneK(readFileSync(holoFile, 'utf8')) : '';
  // Naht: Werkstatt liefert das Blatt (board().sheet), der Controller reicht
  // es als item weiter, das Modul zeichnet es rechts und holt das Modell
  // des Bauteils beim Viewer (ctx.part)
  const naht = [
    [/function sheetOf\(/.test(ws) && /\bpaints, sheet,/.test(ws) && /what === 'peek'/.test(ws), 'dist/assets/hangar-layouts.js baut das Datenblatt nicht mehr (sheetOf), gibt es mit board() nicht heraus (sheet) oder nimmt das Teil unter dem Zeiger nicht an (act peek)'],
    [/item:\s*lo\?\.sheet/.test(ohneK(ctrl)), 'dist/assets/hangar-overview.js reicht das Datenblatt der Werkstatt nicht mehr an die Halle (item: lo?.sheet)'],
    [/function drawItem\(/.test(holo) && /d\.item\s*\?\s*\[drawItem/.test(holo) && /\['peek',/.test(holo), 'dist/assets/hangar-holo3d.js zeichnet das Datenblatt nicht mehr (drawItem), stellt es nicht rechts auf (rightOf) oder meldet das Teil unter dem Zeiger nicht (peek)'],
    [/ctx\.part\(/.test(holo) && /part:\s*loadPartRaw/.test(ohneK(viewer)), 'das Modell des Bauteils kommt nicht mehr an: dist/assets/hangar-holo3d.js fragt ctx.part nicht oder dist/assets/hangar-viewer.js reicht loadPartRaw nicht hinein'],
  ].filter(([ok]) => !ok).map(([, text]) => text);
  for (const text of naht) fail(`[22] ${text}: die rechte Tafel bleibt beim Schiff oder das Bauteil-Hologramm fehlt`);
  // Rang-Rechnung am ausgelieferten Skript: Platz, Gleichstand, weniger ist
  // besser, Lage auf dem Streifen
  let proben = 0;
  let lib = null;
  try { lib = await import(pathToFileURL(wsFile).href); } catch (e) { fail(`[22] dist/assets/hangar-layouts.js laedt nicht als Modul (${e.message})`); }
  if (lib && (typeof lib.classRank !== 'function' || typeof lib.classStrip !== 'function' || !(lib.LOWER instanceof Set))) { fail('[22] dist/assets/hangar-layouts.js exportiert classRank, classStrip oder LOWER nicht mehr: Datenblatt und Advanced Loadout rechnen ohne sie nicht'); lib = null; }
  if (lib) {
    const gleich = (was, ist2, soll) => { proben++; if (JSON.stringify(ist2) !== JSON.stringify(soll)) fail(`[22] Rang-Rechnung: ${was} ergibt ${JSON.stringify(ist2)}, erwartet ${JSON.stringify(soll)}`); };
    const v = [2041.67, 877.5, 683.63, 683.63, 562.5, 501.67, 455.25, 105, 105, 34.67];
    gleich('classRank(v, 501.67)', lib.classRank(v, 501.67), { rank: 6, of: 10, same: 0, worse: 4 });
    gleich('classRank(v, 683.63)', lib.classRank(v, 683.63), { rank: 3, of: 10, same: 1, worse: 6 });
    gleich('classRank(v, 562.5) nach zwei Teilen auf Platz 3', lib.classRank(v, 562.5)?.rank, 5);
    gleich('classRank(v, 34.67, lower)', lib.classRank(v, 34.67, true), { rank: 1, of: 10, same: 0, worse: 9 });
    gleich('classRank ohne eigenen Wert', lib.classRank(v, 7), null);
    const st = lib.classStrip([10, 20, 20, 50]), lo = lib.classStrip([10, 20, 20, 50], true);
    gleich('classStrip Punkte', st?.dots, [[0, 1], [25, 2], [100, 1]]);
    gleich('classStrip Lage des Besten', [st?.x(50), lo?.x(10)], [100, 100]);
    gleich('classStrip Median', st?.med, 25);
    gleich('LOWER', ['sp.dly', 'sp.lkT', 'sp.em', 'sp.regen'].map((k) => lib.LOWER.has(k)), [true, true, true, false]);
  }
  // Wege: was das Blatt nennt, gibt es. Jede Adresse ins Crafting und jede
  // Item-Seite liegt in dist/, in beiden Sprachen (die Seite setzt /de davor)
  const lf = join(DIST, 'hangar-layouts.json');
  const ld = existsSync(lf) ? JSON.parse(readFileSync(lf, 'utf8')) : {};
  let kauf = 0, rezept = 0, seite = 0;
  const tot = [];
  const da = (pfad) => existsSync(join(DIST, pfad.replace(/^\//, '').replace(/[?#].*$/, '')));
  for (const [k, it] of Object.entries(ld.items ?? {})) {
    const x = it[8] ?? {};
    if (it[9]) {
      if (Number.isInteger(x.sn) && x.sn > 0 && typeof x.sl === 'string' && x.sl.trim()) kauf++;
      else tot.push(`${k}: Ladenpreis ohne Zahl der Läden (sn) oder Ort (sl)`);
    } else if (x.sn || x.sl) tot.push(`${k}: Läden genannt (sn, sl), aber kein Ladenpreis`);
    if (x.ct || x.cu) {
      if (!(x.ct > 0) || typeof x.cu !== 'string' || !x.cu.startsWith('/')) tot.push(`${k}: Rezept ohne Bauzeit (ct) oder ohne Adresse (cu)`);
      else if (!da(x.cu) || !da(`/de${x.cu}`)) tot.push(`${k}: Adresse ins Crafting ${x.cu} liegt nicht in dist/ (EN und DE)`);
      else rezept++;
    }
    if (x.pg) {
      const id = k.split('~')[0];
      if (!da(`/items/${id}.html`) || !da(`/de/items/${id}.html`)) tot.push(`${k}: Item-Seite /items/${id}.html liegt nicht in dist/ (EN und DE)`);
      else seite++;
    }
  }
  for (const t of tot.slice(0, 10)) fail(`[22] ${t}: das Datenblatt zeigt einen Weg, der ins Leere führt`);
  if (tot.length > 10) fail(`[22] … und ${tot.length - 10} weitere Wege ins Leere`);
  // Vorlagen der Seite: Adresse der Item-Seite mit Platzhalter, Sprachpräfix
  let vorlagen = 0;
  for (const page of PAGES) {
    const tag = /<aside[^>]*\bid="hgl"[^>]*>/.exec(page.html)?.[0] ?? '';
    const item = /\bdata-item="([^"]*)"/.exec(tag)?.[1], pre = /\bdata-pre(?:="([^"]*)")?/.exec(tag);
    const soll = page.lang === 'de' ? '/de/items/ITEMID.html' : '/items/ITEMID.html', sollPre = page.lang === 'de' ? '/de' : '';
    if (item !== soll) fail(`[22] ${page.file}: data-item an #hgl ist ${item ?? 'nicht gesetzt'}, erwartet ${soll}: der Knopf „Item-Seite“ fehlt oder führt in die falsche Sprache`);
    else if (!pre || (pre[1] ?? '') !== sollPre) fail(`[22] ${page.file}: data-pre an #hgl ist ${pre ? `„${pre[1] ?? ''}“` : 'nicht gesetzt'}, erwartet „${sollPre}“: „Herstellen“ führt in die falsche Sprache`);
    else vorlagen++;
  }
  sollIst(`Naht ganz; Bauteile mit Laden >= ${BLATT.kauf}, mit Rezept >= ${BLATT.rezept}, mit Item-Seite >= ${BLATT.seite}, jedes Ziel in dist/; Proben der Rang-Rechnung >= ${BLATT.proben}; Vorlagen auf beiden Seiten`,
    `Naht ${naht.length ? `mit ${naht.length === 1 ? 'einer Lücke' : `${naht.length} Lücken`}` : 'ganz'}, ${Object.keys(ld.items ?? {}).length} Bauteile, ${kauf} mit Laden, ${rezept} mit Rezept, ${seite} mit Item-Seite, ${tot.length} Wege ins Leere, ${proben} Proben, Vorlagen auf ${vorlagen} von ${PAGES.length} Seiten`);
  if (kauf < BLATT.kauf) fail(`[22] nur ${kauf} Bauteile mit Laden (Klinke ${BLATT.kauf}): schreibt layouts.ts sn und sl nicht mehr?`);
  if (rezept < BLATT.rezept) fail(`[22] nur ${rezept} Bauteile mit Rezept (Klinke ${BLATT.rezept}): findet recipeForItem die Rezepte der Schiffsteile nicht mehr?`);
  if (seite < BLATT.seite) fail(`[22] nur ${seite} Bauteile mit Item-Seite (Klinke ${BLATT.seite})`);
  if (proben < BLATT.proben) fail(`[22] nur ${proben} Proben der Rang-Rechnung (Klinke ${BLATT.proben}): das Skript der Werkstatt lädt nicht`);
  ist.blattKauf = kauf; ist.blattRezept = rezept; ist.blattSeite = seite; ist.blattProben = proben;
}

say('\n[23] Raum der Kamera: jedes Schiff der Halle durch camPlan des ausgelieferten Viewers (Luft hinter Bug und Heck, Zoom, Gang im Raum, stetig), Proben mit festen Zahlen');
// Sperrklinken (Grundsatz 5). Erster Bau am 13.11.2026: 190 Schiffe der
// Halle gerechnet (184 mit Maszen im Dock, 6 nur mit Umriss), 60 davon mit
// Gang zu den Stirnwaenden, 16 Proben. Die Masze kommen aus dem Katalog und
// duerfen nach einem Datenlauf leicht schwanken, darum etwas Abstand.
// Gesenkt am 13.11.2026 mit den festen Hangargroessen ([24]): gang von 56
// auf 30, rand von 5880 auf 3150 (105 Ziele je Schiff mit Gang). Ursache:
// Die Hallen der Stufen sind breiter als die Halle nach Masz (Medium 96 m
// statt 72 m im Raum), und die Kugel der Kamera waechst mit der Breite
// (Medium 45,96 m statt 34,47 m, Large 61,28 m, Extra Large 107,23 m). Einen
// Gang braucht nur, wessen halbe Laenge plus 17,4 m ueber die Kugel reicht:
// vorher 60 Schiffe, jetzt 33. Den uebrigen 27 gibt die Kugel selbst mehr
// Luft hinter Bug und Heck als vorher der Gang (die Pruefung der Luft gilt
// weiter fuer alle 190).
const RAUM = { schiffe: 188, gang: 30, proben: 16, ruhe: 16, rand: 3150 };
// m hinter Bug und Heck (CAM_AIR 17,4 abzueglich Rand vor der Stirnwand am
// Tor: gebaut 13,2) und m Zoom zwischen Mindestabstand und Kugel (gebaut 4,47)
const RAUM_LUFT = 10, RAUM_ZOOM = 4;
// Rand des Gangs: Ziele im, am und neben dem Gang, je Schiff mit Gang
// (Anteile der halben Breite, der Hoehe und der halben Laenge des Gangs, von
// seiner Mitte aus), und far hoechstens so viele Male die Tiefe des Ziels
// der Startansicht im Gang (gebaut 8,39 am Javelin, 252 m ueber 30 m unter
// den Wannen: je Grad Drehung dort hoechstens 14,7 % von far; Carrack 4,68,
// Idris 4,24)
const RAND_X = [-1.04, -0.98, 0, 0.75, 0.98, 1, 1.04], RAND_Y = [0.45, 0.97, 1.02], RAND_Z = [-1.02, -0.97, 0, 0.97, 1.02];
const RAUM_STEIL = 9;
// Angesehen und abgenommen am 13.11.2026 (Masze wie in der Halle gemessen):
// Mindestabstand, Kugel, Hoechstabstand hinter Bug und Heck, Startansicht.
// Aendern sich die Zahlen, stehen die Kameras anders: erst rendern und
// hinsehen, dann hier nachziehen.
// Nachgezogen am 13.11.2026 mit den festen Hangargroessen ([24]), nach neuen
// Bildern der vier Startansichten: Jedes Schiff steht in der Halle seiner
// Stufe (hangar), die breiter ist als die Halle nach Masz. Kugel und
// Startansicht ruecken mit: Carrack in Large 57,45 auf 61,28 m und 74,03 auf
// 79,68 m, Idris-M in Extra Large 84,26 auf 107,23 m und 113,52 auf 138,99 m,
// Constellation in Medium 34,47 auf 45,96 m und 40,19 auf 49,35 m. Der
// Hoechstabstand hinter Bug und Heck und der Mindestabstand bleiben, die
// Gladius in Small aendert sich nicht.
const RAUM_PROBEN = [
  ['Carrack', { len: 129.13, halfW: 36.19, height: 28.76, hangar: 'L' }, { min: 30, ball: 61.28, far: 81.97, home: 79.68 }],
  ['Idris-M', { len: 243.18, halfW: 63.34, height: 53.71, hangar: 'XL' }, { min: 30, ball: 107.23, far: 138.99, home: 138.99 }],
  ['Constellation Andromeda', { len: 63.9, halfW: 13.25, height: 14.84, hangar: 'M' }, { min: 28.76, ball: 45.96, far: 49.35, home: 49.35 }],
  ['Gladius', { len: 22.42, halfW: 8.69, height: 5.59, hangar: 'S' }, { min: 10.09, ball: 34.47, far: 34.47, home: 34.47 }],
];
{
  let mod = null;
  try { mod = await import(pathToFileURL(viewerFile).href); } catch (e) { fail(`[23] dist/assets/hangar-viewer.js laedt nicht als Modul (${e.message})`); }
  if (mod && (typeof mod.camPlan !== 'function' || typeof mod.camReach !== 'function' || typeof mod.camSpace !== 'function')) { fail('[23] der Viewer exportiert camPlan, camReach oder camSpace nicht mehr: den Raum der Kamera prüft dann nichts'); mod = null; }
  let hall = null, models = {};
  try { const cfg = JSON.parse(/<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(PAGES[0].html)?.[1] ?? 'null'); hall = cfg?.opts?.hall ?? null; models = cfg?.models ?? {}; } catch { hall = null; }
  const clear = (() => { try { return JSON.parse(/\/\* hall-grow \*\/([\s\S]*?)\/\* \/hall-grow \*\//.exec(viewer)?.[1] ?? 'null')?.[hall?.id]?.clear ?? null; } catch { return null; } })();
  let schiffe = 0, gang = 0, geschaetzt = 0, proben = 0, luftMin = Infinity, zoomMin = Infinity, rand = 0, randR = 0, steil = 0, randMin = Infinity, farRand = 0;
  // Richtungen fuer den Rand des Gangs, einmal fuer alle Schiffe: drei
  // Umlaeufe (1,8, 12 und 40 Grad Hoehe) und vier Boegen vom Boden bis fast
  // senkrecht, je halbes Grad; c: Sehne zur vorigen Richtung
  const RAND_DIRS = (() => {
    const G = Math.PI / 180, at = (az, e) => ({ x: Math.cos(e * G) * Math.sin(az * G), y: Math.sin(e * G), z: Math.cos(e * G) * Math.cos(az * G) }), out = [];
    for (const e of [1.8, 12, 40]) out.push(Array.from({ length: 721 }, (_, i) => at(i / 2, e)));
    for (const az of [0, 37, 90, 233]) out.push(Array.from({ length: 174 }, (_, i) => at(az, 1.8 + i / 2)));
    for (const b of out) for (let i = 1; i < b.length; i++) b[i].c = Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y, b[i].z - b[i - 1].z);
    return out;
  })();
  const bad = [];
  if (mod && !hall?.room) fail('[23] #hg-stage nennt keine Halle mit Raum (opts.hall.room): die Grenzen der Kamera sind nicht zu rechnen');
  else if (mod && !mod.camPlan(hall, { len: 20, halfW: 8, height: 5 })) fail(`[23] camPlan rechnet die Halle ${hall.id} nicht (kein Feld in HALL_LIFT oder kein Zuwachs in HALL_GROW)`);
  else if (mod) {
    const { figures } = DOCK.en;
    const fps = new Map([...PAGES[0].html.matchAll(/<li data-id="([^"]+)"([^>]*)>/g)].map((m) => [m[1], (/\sdata-fp="([^"]*)"/.exec(m[2])?.[1] ?? '').split(' ').map(Number)]));
    const el = (5 * Math.PI) / 180, f2 = (x) => x.toFixed(2);
    for (const [id, e] of Object.entries(models)) {
      if (!Array.isArray(e) || e[3] !== 'halle') continue;
      const fig = figures.get(id) ?? {}, fp = fps.get(id) ?? [];
      const len = Math.max(fig.len ?? 0, fp[1] || 0), wid = Math.max(fig.wid ?? 0, fp[0] || 0);
      if (!(len > 0 && wid > 0)) continue;
      // ohne Hoehe im Dock: geschaetzt, sie aendert nur den Zuwachs nach oben
      const hgt = fig.hgt > 0 ? fig.hgt : Math.max(3, wid / 4);
      if (!(fig.hgt > 0)) geschaetzt++;
      // mit der Hangargröße des Schiffs von der Seite ([24]): der Raum der Halle, in der es steht
      const info = { len, halfW: wid / 2, height: hgt, hangar: e[4] ?? null }, span = Math.max(len, wid, 6), p = mod.camPlan(hall, info);
      // NaN besteht jeden Vergleich mit < und >: nicht endliche Grenzen
      // ausdruecklich, sonst gaelte eine kaputte Rechnung als bestanden
      const krank = p ? Object.entries({ min: p.min, Kugel: p.ball, far: p.far, Startansicht: p.home, Rand: p.edge, 'Gang x': p.box?.x?.[0] + p.box?.x?.[1], 'Gang oben': p.box?.y, 'Gang z': p.box?.z?.[0] + p.box?.z?.[1] }).filter(([, v]) => !Number.isFinite(v)).map(([k]) => k) : ['alles (camPlan liefert nichts)'];
      if (krank.length) { bad.push(`${id}: camPlan liefert keine endliche Zahl für ${krank.join(', ')}: die Grenzen der Kamera sind nicht zu prüfen, im Hangar stünde sie irgendwo`); continue; }
      schiffe++;
      const t = { x: 0, y: Math.max(1.2, hgt * 0.45 + 0.3), z: 0 };
      const hin = (az) => ({ x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: Math.cos(el) * Math.cos(az) });
      // hinter Bug (-z) und Heck (+z)
      for (const [was, az] of [['Bug', Math.PI], ['Heck', 0]]) {
        const luft = mod.camReach(p, t, hin(az)) - len / 2;
        luftMin = Math.min(luftMin, luft);
        if (!(luft >= RAUM_LUFT)) bad.push(`${id}: vor dem ${was} kommt die Kamera nur ${f2(luft)} m über die halbe Länge (${f2(len / 2)} m) hinaus, verlangt sind ${RAUM_LUFT}: ganz herausgezoomt stünde sie im oder am Rumpf`);
      }
      const zoom = p.ball - p.min;
      zoomMin = Math.min(zoomMin, zoom);
      if (!(zoom >= RAUM_ZOOM) || !(p.far >= p.ball)) bad.push(`${id}: zwischen Mindestabstand ${f2(p.min)} m und Kugel ${f2(p.ball)} m bleiben ${f2(zoom)} m Zoom, verlangt sind ${RAUM_ZOOM} (Höchstabstand ${f2(p.far)} m)`);
      if (!(p.home >= p.ball - 1e-9 && p.home <= p.far + 1e-9)) bad.push(`${id}: Startansicht ${f2(p.home)} m liegt nicht zwischen Kugel ${f2(p.ball)} m und Höchstabstand ${f2(p.far)} m`);
      // der Gang im Raum: vor den Galerien (7 m vor der Wand), unter den Wannen, vor den Stirnwänden
      const hx = (p.box.x[1] - p.box.x[0]) / 2, hz = (p.box.z[1] - p.box.z[0]) / 2, oben = (clear ?? p.room.height - p.grow[1]) + p.grow[1];
      if (hx > p.room.halfW - 7.6 || hz > p.room.halfL - 3.9 || p.box.y > oben - 4 || p.ball > 0.96 * Math.min(p.room.halfW, p.room.halfL))
        bad.push(`${id}: der Raum der Kamera reicht aus der Halle (Gang halb ${f2(hx)} x ${f2(hz)} m, bis ${f2(p.box.y)} m hoch, Kugel ${f2(p.ball)} m; Raum halb ${p.room.halfW} x ${p.room.halfL} m, frei bis ${f2(oben)} m)`);
      // stetig: rundum je Grad kein Sprung über 6 % des Höchstabstands; und
      // nirgends, auch nicht nach oben, enger als die Kugel
      let prev = mod.camReach(p, t, hin(0)), sprung = 0, eng = Math.min(prev, mod.camReach(p, t, { x: 0, y: 1, z: 0 }));
      for (let g = 1; g <= 360; g++) { const r = mod.camReach(p, t, hin((g * Math.PI) / 180)); sprung = Math.max(sprung, Math.abs(r - prev)); eng = Math.min(eng, r); prev = r; }
      if (!(sprung <= 0.06 * p.far)) bad.push(`${id}: die Grenze springt beim Drehen um ${f2(sprung)} m je Grad (Höchstabstand ${f2(p.far)} m): die Kamera ruckt`);
      if (!(eng >= p.ball - 1e-9)) bad.push(`${id}: die Grenze fällt auf ${f2(eng)} m unter die Kugel (${f2(p.ball)} m): zur Seite und nach oben stünde die Kamera näher als bisher`);
      if (p.far > p.ball + 1e-9) {
        gang++;
        // Rand des Gangs (Review PR #354). Das Blickziel bleibt nicht in der
        // Hallenmitte: Schieben trägt es bis vor die Wände (Carrack: 5,75 m
        // neben den Gang), ein Hardpoint liegt am Flügelende. Dort sprang die
        // Grenze: Ziel 1 cm neben dem Gang, Kamera längs der Halle, 0,01 Grad
        // Drehung, und sie fiel von far auf die Kugel (Carrack 24,5 m, Idris
        // 54,7 m), die Kamera stand bis dahin ganz draußen neben dem Gang.
        // Für jedes Ziel gilt: beim Drehen ändert sich die Grenze höchstens
        // um far² / Rand je Bogenmaß (Rand: Tiefe des Ziels der Startansicht
        // im Gang, p.edge), beim Schieben um far² / (Rand · Kugel) je Meter,
        // am und neben dem Gang gilt die Kugel, und jenseits der Kugel steht
        // die Kamera im Gang.
        const B = p.box, K = p.far ** 2 / p.edge, mx = (B.x[0] + B.x[1]) / 2, mz = (B.z[0] + B.z[1]) / 2, bx = (B.x[1] - B.x[0]) / 2, bz = (B.z[1] - B.z[0]) / 2;
        const tief = (q) => Math.min(q.x - B.x[0], B.x[1] - q.x, B.y - q.y, q.z - B.z[0], B.z[1] - q.z), ort = (q) => `(${f2(q.x)}, ${f2(q.y)}, ${f2(q.z)})`;
        randMin = Math.min(randMin, p.edge); farRand = Math.max(farRand, p.far / p.edge);
        if (!(tief(t) >= p.edge - 1e-9)) bad.push(`${id}: das Ziel der Startansicht liegt ${f2(tief(t))} m tief im Gang, gerechnet wird mit ${f2(p.edge)} m: die Startansicht stünde näher als abgenommen`);
        if (!(p.far <= RAUM_STEIL * p.edge)) bad.push(`${id}: far ${f2(p.far)} m ist mehr als das ${RAUM_STEIL}-Fache der Tiefe des Ziels der Startansicht im Gang (${f2(p.edge)} m): beim Drehen rückte die Kamera um mehr als ${(RAUM_STEIL * 1.745).toFixed(1)} % von far je Grad`);
        const w = { dreh: null, schub: null, neben: null, aus: null, wert: null };
        for (const fx of RAND_X) for (const fy of RAND_Y) for (const fz of RAND_Z) {
          const q = { x: mx + fx * bx, y: fy * B.y, z: mz + fz * bz }, tq = tief(q), wo = tq > 0 ? `${f2(tq)} m tief im Gang` : `${f2(-tq)} m neben dem Gang`;
          rand++;
          for (const bogen of RAND_DIRS) {
            let prev = NaN;
            for (let i = 0; i < bogen.length; i++) {
              const d = bogen[i], r = mod.camReach(p, q, d);
              randR++;
              if (!(r >= p.ball - 1e-9 && r <= p.far + 1e-9)) { w.wert ??= `am Ziel ${ort(q)} (${wo}) ist die Grenze ${f2(r)} m, außerhalb von Kugel ${f2(p.ball)} m und far ${f2(p.far)} m`; prev = r; continue; }
              if (i) { const x = Math.abs(r - prev) / (K * d.c); steil = Math.max(steil, x); if (x > 1 + 1e-9 && !(w.dreh?.x >= x)) w.dreh = { x, s: `am Ziel ${ort(q)} (${wo}) ändert sich die Grenze bei ${(d.c * 180 / Math.PI).toFixed(2)} Grad Drehung um ${f2(Math.abs(r - prev))} m (${f2(prev)} auf ${f2(r)} m), erlaubt sind ${f2(K * d.c)} m: die Kamera springt beim Drehen` }; }
              prev = r;
              if (!(tq > 0) && r > p.ball + 1e-9) w.neben ??= `das Ziel ${ort(q)} liegt ${wo}, und die Kamera darf doch ${f2(r)} m weit (Kugel ${f2(p.ball)} m): sie stünde neben dem Gang vor Galerien und Wänden`;
              if (r > p.ball + 1e-9) { const cx = q.x + d.x * r, cy = q.y + d.y * r, cz = q.z + d.z * r; if (cx < B.x[0] - 1e-6 || cx > B.x[1] + 1e-6 || cy > B.y + 1e-6 || cz < B.z[0] - 1e-6 || cz > B.z[1] + 1e-6) w.aus ??= `am Ziel ${ort(q)} (${wo}) steht die Kamera bei ${f2(r)} m jenseits der Kugel außerhalb des Gangs (${f2(cx)}, ${f2(cy)}, ${f2(cz)})`; }
              // 10 cm schieben, längs jeder Achse
              if (i % 24 === 0) for (const a of ['x', 'y', 'z']) {
                const r2 = mod.camReach(p, { ...q, [a]: q[a] + 0.1 }, d), x = Math.abs(r2 - r) / ((K / p.ball) * 0.1);
                randR++;
                if (!(x <= 1 + 1e-9) && !(w.schub?.x >= x)) w.schub = { x, s: `am Ziel ${ort(q)} (${wo}) ändert sich die Grenze bei 10 cm Schieben (${a}) um ${f2(Math.abs(r2 - r))} m (${f2(r)} auf ${f2(r2)} m), erlaubt sind ${f2((K / p.ball) * 0.1)} m: die Kamera springt beim Schieben` };
              }
            }
          }
        }
        for (const v of Object.values(w)) if (v) bad.push(`${id}: ${v.s ?? v}`);
      }
      // kleine Schiffe merken nichts
      if (span <= 34 && (Math.abs(p.far - p.ball) > 1e-9 || Math.abs(p.min - Math.max(4, span * 0.45)) > 1e-9)) bad.push(`${id}: ${f2(span)} m Spannweite, und doch ändern sich die Grenzen (min ${f2(p.min)}, Kugel ${f2(p.ball)}, far ${f2(p.far)}): Schiffe bis 34 m sollen nichts merken`);
    }
    for (const [name, info, soll] of RAUM_PROBEN) {
      const p = mod.camPlan(hall, info);
      for (const k of Object.keys(soll)) {
        proben++;
        if (!(Math.abs(p?.[k] - soll[k]) <= 0.02)) fail(`[23] Probe ${name}: ${k} ist ${Number.isFinite(p?.[k]) ? p[k].toFixed(2) : String(p?.[k])} m, angesehen und abgenommen sind ${soll[k]} m: erst rendern und hinsehen, dann die Zahl im Tor nachziehen (RAUM_PROBEN)`);
      }
    }
  }
  // Die Bühne nutzt, was hier gerechnet wird: Ihre Grenzen kommen aus
  // camSpace, und nach controls.update hält keepRoom die Kamera im Raum,
  // bevor der Federarm (keepFree) sie vor Wände und Rumpf stellt
  const draht = [
    [/camSp = camSpace\(shipInfo,/, 'die Bühne rechnet ihren Raum nicht mehr mit camSpace'],
    [/controls\.minDistance = camSp\.min;\s*controls\.maxDistance = camSp\.far;/, 'Mindest- und Höchstabstand der Bühne kommen nicht mehr aus camSpace'],
    [/controls\.update\(dt\);[\s\S]{0,400}?keepRoom\(\);\s*keepFree\(\);/, 'keepRoom läuft nicht mehr nach controls.update und vor keepFree'],
    [/function keepRoom\(\) \{[\s\S]{0,300}?camReach\(camSp,/, 'keepRoom fragt camReach nicht mehr'],
  ];
  let verdrahtet = 0;
  for (const [re, was] of draht) { if (re.test(viewer)) verdrahtet++; else fail(`[23] ${was}: der hier geprüfte Raum gälte im Hangar nicht`); }
  // Der Federarm ruht. Hält eine Wand die Kamera vor dem gewünschten Abstand
  // (Carrack hinter dem Heck: 75,98 m vor 81,97 m), gleitet sie je Bild das
  // Fünffache der Bilddauer des Wegs hinaus, und der Federarm holt sie zurück
  // (camPull). Ohne Raste landete er je nach Start um Bruchteile eines
  // Millimeters daneben: Die Tafeln hielten die Kamera nie für ruhend und
  // fanden ihren Platz nicht, der Viewer schlief nie ein (13.11.2026). Mit
  // der Raste (camRest) steht sie ab dem zweiten Bild auf das Bit gleich,
  // bei jeder Bilddauer; rückt die Wand, folgt sie.
  let ruhe = 0, ruht = 0;
  if (mod && (typeof mod.camPull !== 'function' || typeof mod.camRest !== 'function')) fail('[23] der Viewer exportiert camPull oder camRest nicht mehr: ob der Federarm ruht, prüft dann nichts');
  else if (mod) {
    const el = (10 * Math.PI) / 180, t = { x: 0, y: 12.88, z: 0 }, d = { x: 0, y: Math.sin(el), z: Math.cos(el) };
    for (const [name, , soll] of RAUM_PROBEN) for (const vor of [0.37, 2.11, 5.99, 9.83]) {
      const want = soll.far, H = { t: [0, 0, 0], d: [0, 0, 0], x: -1 }, genau = (6 * want) / 48 / 4096;
      let wand = want - vor, r = wand - 0.25, f = 0, gut = true;
      // n Bilder mit wechselnder Dauer (8 bis 24 ms), wie die Bühne sie rechnet:
      // hinausgleiten, und nur wo die Kamera dann nicht frei steht, holt der
      // Federarm sie zurück. Gibt die Stellen der letzten 120 Bilder zurück.
      const bilder = (n) => {
        const orte = new Set();
        for (let i = 0; i < n; i++, f++) {
          const dt = (8 + ((f * 7919) % 17)) / 1000, L = r + (want - r) * Math.min(1, dt * 5);
          if (L <= wand) r = L;
          else {
            const lo = mod.camPull(L, (x) => x <= wand);
            if (lo < 0) { orte.add(NaN); break; }
            r = mod.camRest(H, t, d, lo, L) ? H.x : lo;
          }
          if (i >= n - 120) orte.add(r);
        }
        return orte;
      };
      ruhe++;
      const orte = bilder(360);
      if (orte.size !== 1 || !Number.isFinite(r)) { gut = false; bad.push(`${name}: hält eine Wand die Kamera bei ${wand.toFixed(2)} m vor ${want} m, steht sie nicht still (${orte.size} Stellen in 120 Bildern, ${((Math.max(...orte) - Math.min(...orte)) * 1000).toFixed(2)} mm auseinander): die Tafeln fänden ihren Platz nicht, der Viewer schliefe nie ein`); }
      else if (r > wand || wand - r > genau) { gut = false; bad.push(`${name}: der Federarm stellt die Kamera auf ${r.toFixed(4)} m, die Wand steht bei ${wand.toFixed(4)} m (erlaubt bis ${(genau * 1000).toFixed(2)} mm davor)`); }
      // die Wand rückt 5 cm heran, dann 10 cm zurück: die Kamera folgt beide Male und ruht wieder
      for (const schritt of [-0.05, 0.1]) {
        wand += schritt;
        const o2 = bilder(360);
        if (gut && (o2.size !== 1 || r > wand || wand - r > genau)) { gut = false; bad.push(`${name}: rückt die Wand um ${schritt * 100} cm auf ${wand.toFixed(2)} m, steht die Kamera bei ${r.toFixed(4)} m (${o2.size} Stellen in 120 Bildern): die Raste hält sie fest oder in der Wand`); }
      }
      if (gut) ruht++;
    }
    const kf = /function keepFree\(\) \{[\s\S]{0,3000}?camPull\(L, [\s\S]{0,600}?camRest\(H, t, keepD, lo, L\)\) c\.set\(H\.t\[0\] \+ H\.d\[0\] \* H\.x,/;
    if (!kf.test(viewer)) fail('[23] keepFree sucht nicht mehr mit camPull oder stellt die Kamera nicht mehr auf den Halt von camRest: die hier gerechnete Ruhe gälte im Hangar nicht');
  }
  for (const t of bad.slice(0, 12)) fail(`[23] ${t}`);
  if (bad.length > 12) fail(`[23] … und ${bad.length - 12} weitere Befunde am Raum der Kamera`);
  sollIst(`Schiffe der Halle >= ${RAUM.schiffe}, davon mit Gang >= ${RAUM.gang}; hinter Bug und Heck >= ${RAUM_LUFT} m, Zoom >= ${RAUM_ZOOM} m, Gang im Raum, stetig; am Rand des Gangs >= ${RAUM.rand} Ziele ohne Sprung, far <= ${RAUM_STEIL} x Rand; Proben >= ${RAUM.proben}; Federarm ruht in allen Lagen (>= ${RAUM.ruhe})`,
    `${schiffe} Schiffe (${geschaetzt} mit geschätzter Höhe), ${gang} mit Gang, kleinste Luft ${Number.isFinite(luftMin) ? luftMin.toFixed(2) : '—'} m, kleinster Zoom ${Number.isFinite(zoomMin) ? zoomMin.toFixed(2) : '—'} m, ${bad.length} Befunde, am Rand des Gangs ${rand} Ziele und ${randR} Richtungen (steilste Stelle ${(steil * 100).toFixed(1)} % des Erlaubten, kleinster Rand ${Number.isFinite(randMin) ? randMin.toFixed(2) : '—'} m, far höchstens ${farRand.toFixed(2)} x Rand), ${proben} Proben, ${verdrahtet} von ${draht.length} Stellen der Bühne, Federarm ruht in ${ruht} von ${ruhe} Lagen`);
  if (schiffe < RAUM.schiffe) fail(`[23] nur ${schiffe} Schiffe der Halle gerechnet (Klinke ${RAUM.schiffe}): lädt der Viewer nicht, fehlt #hg-stage oder nennt das Dock keine Maße mehr?`);
  if (gang < RAUM.gang) fail(`[23] nur ${gang} Schiffe mit Gang zu den Stirnwänden (Klinke ${RAUM.gang}): große Schiffe stünden wieder in der Kugel`);
  if (proben < RAUM.proben) fail(`[23] nur ${proben} Proben am Raum der Kamera (Klinke ${RAUM.proben})`);
  if (mod && rand < RAUM.rand) fail(`[23] nur ${rand} Ziele am Rand des Gangs gerechnet (Klinke ${RAUM.rand}): ob die Grenze dort springt, prüft dann nichts`);
  if (mod && ruhe < RAUM.ruhe) fail(`[23] nur ${ruhe} Lagen des Federarms gerechnet (Klinke ${RAUM.ruhe})`);
  ist.raumSchiffe = schiffe; ist.raumGang = gang; ist.raumProben = proben; ist.raumRuhe = ruht; ist.raumRand = rand;
}

say('\n[24] Hangargrößen: vier feste Stufen im Viewer, jedes Schiff der Halle in seiner Stufe und ganz auf dem Feld, Zeile im Titelblock');
// Feste Hangargrößen (13.11.2026, Krisz: „small Hangar, Medium, large und
// extra large einführen genau wie ingame, dann haben wir auch richtige
// grössenreferenzen“). Sperrklinken (Grundsatz 5), erster Bau: 190 Schiffe
// der Halle, davon 107 in Small, 48 in Medium, 27 in Large, 7 in Extra
// Large, eines (Javelin) in einer Halle nach Maß. Die Stufe kommt aus der
// Größenklasse im Katalog und darf nach einem Datenlauf für einzelne
// Schiffe wechseln, darum etwas Abstand.
const GROESSE = { schiffe: 188, S: 100, M: 44, L: 24, XL: 6, draht: 9, worte: 14 };
// Stufe je Größenklasse (vehicles.json sizeClass), wie src/lib/hangar/stage.ts
// sie der Bühne mitgibt: hier ein zweites Mal, damit ein Dreher dort auffällt
const GROESSE_KLASSE = { 1: 'S', 2: 'S', 3: 'M', 4: 'M', 5: 'L', 6: 'XL' };
// Feld (Breite x Länge) und freie Höhe darüber in m je Stufe, wie am
// 13.11.2026 gerendert und von Krisz im Entwurf abgenommen („Ja“ zu „vier
// feste Stufen bauen“, Bilder G-1 und G-2). Ändern sich die Zahlen, steht
// jedes Schiff der Stufe in einer anderen Halle: erst rendern und hinsehen,
// dann hier nachziehen.
const GROESSE_FELD = { S: [32, 96, 35.48], M: [56, 96, 35.48], L: [88, 160, 59.48], XL: [184, 304, 99.48] };
// Schiffe, deren Halle nicht die Stufe ihrer Größenklasse ist (Grundsatz 6:
// benannt, mit Anlass und Zombie-Wächter). von: Stufe der Seite, auf: Stufe
// der Halle ('' = keine fasst es, Halle nach Maß).
const GROESSE_AUSNAHMEN = {
  'drak-clipper': { von: 'S', auf: 'M', anlass: 'Größenklasse 2, sein Modell ist aber 49,5 m breit und das Feld der Stufe Small 32 m: Der Viewer nimmt die nächste Stufe, die es fasst' },
  'aegs-javelin': { von: 'XL', auf: '', anlass: '469,9 m lang und 218,8 m breit, das Feld der Stufe Extra Large misst 184 x 304 m: Kein Hangar fasst es, die Halle wächst auf sein Maß wie vor den Stufen' },
};
{
  const R = /\/\* hall-grow \*\/([\s\S]*?)\/\* \/hall-grow \*\//.exec(viewer), RL = /\/\* hall-lift \*\/([\s\S]*?)\/\* \/hall-lift \*\//.exec(viewer);
  let cfg = null, G = null, LIFT = null;
  try { cfg = JSON.parse(/<script type="application\/json" id="hg-stage">([\s\S]*?)<\/script>/.exec(PAGES[0].html)?.[1] ?? 'null'); } catch { cfg = null; }
  const hall = cfg?.opts?.hall ?? null, models = cfg?.models ?? {};
  try { G = JSON.parse(R?.[1] ?? 'null')?.[hall?.id] ?? null; LIFT = JSON.parse(RL?.[1] ?? 'null')?.[hall?.id] ?? null; } catch { G = LIFT = null; }
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
  // (a) die Stufen im Viewer
  const sizes = Array.isArray(G?.sizes) ? G.sizes : null, step = G?.step, feld = LIFT && [LIFT.to?.[0] - LIFT.from?.[0], LIFT.to?.[1] - LIFT.from?.[1]];
  let stufen = 0;
  const formOk = !!sizes && sizes.length === GROESSEN.length && sizes.every((z, i) => Array.isArray(z) && z.length === 4 && z[0] === GROESSEN[i] && z.slice(1).every((v) => Number.isFinite(v) && v >= 0));
  if (!hall?.id || !G) fail('[24] HALL_GROW im Viewer nennt die Halle der Seite nicht: ohne ihren Eintrag gibt es keine Hangargrößen');
  else if (!formOk) fail(`[24] HALL_GROW["${hall.id}"].sizes braucht genau ${GROESSEN.length} Stufen [Name, x, y, z] in der Folge ${GROESSEN.join(', ')} (gefunden ${JSON.stringify(G.sizes ?? null)}): Ohne sie wächst die Halle wieder für jedes Schiff auf sein Maß`);
  else if (!(Number.isFinite(step) && step > 0) || !(feld?.every((v) => Number.isFinite(v) && v > 0)) || !Number.isFinite(G.clear)) fail(`[24] step, clear oder das Feld (HALL_LIFT) der Halle ${hall.id} fehlen: die Stufen sind nicht nachzurechnen`);
  else {
    sizes.forEach((z, i) => {
      const [name, x, y, zz] = z, vor = i ? sizes[i - 1] : null;
      // je Seite ganze Schritte (x und z wachsen nach beiden Seiten, y nur nach oben): sonst läuft die Textur an der Kante der gestreckten Platten versetzt weiter
      const ganz = (v, n) => Math.abs(v / (n * step) - Math.round(v / (n * step))) < 1e-9;
      if (!ganz(x, 2) || !ganz(y, 1) || !ganz(zz, 2)) fail(`[24] Stufe ${name} [${x}, ${y}, ${zz}]: x und z brauchen Vielfache von ${2 * step} m (je Seite ein ganzer Schritt von ${step} m), y von ${step} m: sonst läuft die Textur des Bodens an den Streifen versetzt weiter`);
      if (i === 0 && (x || y || zz)) fail(`[24] Stufe ${name} [${x}, ${y}, ${zz}] ist nicht die Halle ohne Zuwachs: Die kleinste Stufe ist die Halle, wie sie gebaut ist`);
      if (vor && !(x >= vor[1] && y >= vor[2] && zz >= vor[3] && x + y + zz > vor[1] + vor[2] + vor[3])) fail(`[24] Stufe ${name} [${x}, ${y}, ${zz}] ist nicht in jeder Richtung mindestens so groß wie ${vor[0]} [${vor.slice(1).join(', ')}] und in einer größer: Ein Schiff, das in ${vor[0]} nicht passt, fände auch hier keinen Platz`);
      const ist = [feld[0] + x, feld[1] + zz, G.clear + y], soll = GROESSE_FELD[name];
      if (!soll.every((v, k) => Math.abs(v - ist[k]) <= 0.02)) fail(`[24] Stufe ${name}: Feld ${f2(ist[0])} x ${f2(ist[1])} m, ${f2(ist[2])} m frei; angesehen und abgenommen sind ${soll[0]} x ${soll[1]} m und ${soll[2]} m: erst rendern und hinsehen, dann die Zahl im Tor nachziehen (GROESSE_FELD)`);
      else stufen++;
    });
  }
  // (b) jedes Schiff der Halle: Stufe der Seite gegen die Größenklasse, Stufe der Halle aus camPlan des ausgelieferten Viewers, und ob es auf dem Feld steht
  let mod = null;
  try { mod = await import(pathToFileURL(viewerFile).href); } catch (e) { fail(`[24] dist/assets/hangar-viewer.js laedt nicht als Modul (${e.message})`); }
  const zahl = { S: 0, M: 0, L: 0, XL: 0, '': 0 }, bad = [], fremd = [], hallen = new Set(), gesehen = new Map();
  let schiffe = 0, luftMin = Infinity, ohneStufe = 0;
  if (mod && formOk && feld && hall?.room) {
    const KL = new Map(JSON.parse(readFileSync(join(ROOT, 'src/data/vehicles.json'), 'utf8')).vehicles.map((v) => [v.id, v.sizeClass ?? null]));
    const { figures } = DOCK.en;
    const fps = new Map([...PAGES[0].html.matchAll(/<li data-id="([^"]+)"([^>]*)>/g)].map((m) => [m[1], (/\sdata-fp="([^"]*)"/.exec(m[2])?.[1] ?? '').split(' ').map(Number)]));
    for (const [id, e] of Object.entries(models)) {
      if (!Array.isArray(e) || e[3] !== 'halle') continue;
      const seite = e[4] ?? null, klasse = GROESSE_KLASSE[KL.get(id)] ?? null;
      if (seite !== klasse) bad.push(`${id}: die Seite gibt der Bühne die Stufe ${JSON.stringify(seite)} mit, nach seiner Größenklasse ${KL.get(id) ?? '–'} gehört es in ${JSON.stringify(klasse)} (hangarOfClass in src/lib/hangar/stage.ts, GROESSE_KLASSE hier)`);
      if (seite === null) ohneStufe++;
      // Maße wie [23]: das Größere aus Katalog und Umriss, die Höhe notfalls geschätzt
      const fig = figures.get(id) ?? {}, fp = fps.get(id) ?? [];
      const len = Math.max(fig.len ?? 0, fp[1] || 0), wid = Math.max(fig.wid ?? 0, fp[0] || 0);
      if (!(len > 0 && wid > 0)) continue;
      const hgt = fig.hgt > 0 ? fig.hgt : Math.max(3, wid / 4);
      const p = mod.camPlan(hall, { len, halfW: wid / 2, height: hgt, hangar: seite });
      if (!p || typeof p.size !== 'string' || !(p.size === '' || GROESSEN.includes(p.size)) || !Array.isArray(p.grow) || !p.grow.every(Number.isFinite)) { bad.push(`${id}: camPlan nennt keine Hangargröße (size ${JSON.stringify(p?.size)}, Zuwachs ${JSON.stringify(p?.grow)}): Die Halle rastet nicht ein`); continue; }
      schiffe++;
      zahl[p.size]++;
      gesehen.set(id, { seite, halle: p.size });
      hallen.add(p.grow.join('/'));
      const z = sizes.find((x) => x[0] === p.size);
      if (z && !p.grow.every((v, k) => v === z[k + 1])) bad.push(`${id}: Stufe ${p.size}, der Zuwachs der Halle ist aber [${p.grow.join(', ')}] statt [${z.slice(1).join(', ')}]: Die Halle steht nicht auf der Stufe`);
      if (seite && p.size !== '' && GROESSEN.indexOf(p.size) < GROESSEN.indexOf(seite)) bad.push(`${id}: die Halle steht auf ${p.size}, kleiner als seine Stufe ${seite}: Die Stufe des Schiffs ist die kleinste, die es bekommt`);
      // selbst nachgemessen, nicht dem Viewer geglaubt: mit 1 m Rand auf dem Feld, 4 m unter den Wannen
      const luft = [feld[0] + p.grow[0] - wid - 2, feld[1] + p.grow[2] - len - 2, G.clear + p.grow[1] - hgt - 4];
      luftMin = Math.min(luftMin, ...luft);
      if (!luft.every((v) => v >= -1e-6)) bad.push(`${id}: ${f2(len)} x ${f2(wid)} x ${f2(hgt)} m ragt in ${p.size || 'seiner Halle nach Maß'} über das Feld ${f2(feld[0] + p.grow[0])} x ${f2(feld[1] + p.grow[2])} m oder unter die Wannen bei ${f2(G.clear + p.grow[1])} m (Luft quer ${f2(luft[0])}, längs ${f2(luft[1])}, oben ${f2(luft[2])} m bei 1 m Rand und 4 m unter den Wannen): Es stünde über dem Rand des Aufzugs oder in den Lichtwannen`);
      const a = GROESSE_AUSNAHMEN[id];
      if (p.size !== seite && !(a && a.auf === p.size && a.von === seite)) fremd.push(`${id} (${seite ?? 'ohne Stufe'} nach Größenklasse, die Halle steht auf ${p.size || 'Maß'}; ${f2(len)} x ${f2(wid)} x ${f2(hgt)} m)`);
    }
    // Zombie-Wächter: Jede Ausnahme braucht ihren Anlass
    for (const [id, a] of Object.entries(GROESSE_AUSNAHMEN)) {
      const g = gesehen.get(id);
      if (!g) fail(`[24] Ausnahme ${id} (${a.anlass}) ohne Schiff: Es steht nicht mehr auf dem Feld oder hat keine Maße; Ausnahme in GROESSE_AUSNAHMEN streichen`);
      else if (g.halle === g.seite) fail(`[24] Ausnahme ${id} (${a.anlass}) ohne Anlass: Es steht jetzt in der Stufe seiner Größenklasse (${g.seite}); Ausnahme in GROESSE_AUSNAHMEN streichen`);
      else if (g.halle !== a.auf || g.seite !== a.von) fail(`[24] Ausnahme ${id} nennt ${a.von} auf ${a.auf || 'Maß'}, gebaut ist ${g.seite ?? 'ohne Stufe'} auf ${g.halle || 'Maß'}: Ausnahme in GROESSE_AUSNAHMEN nachziehen (mit Anlass)`);
    }
    // so viele verschiedene Hallen wie Stufen in Gebrauch, dazu je Halle nach Maß eine
    const erlaubt = GROESSEN.filter((g) => zahl[g]).length + zahl[''];
    if (hallen.size > erlaubt) bad.push(`${hallen.size} verschiedene Hallen für ${schiffe} Schiffe, mit ${GROESSEN.filter((g) => zahl[g]).length} Stufen und ${zahl['']} Hallen nach Maß dürften es höchstens ${erlaubt} sein: Die Halle wächst wieder je Schiff`);
  }
  // Abweichung von der Größenklasse ohne Eintrag: kein Schaden (die Halle
  // fasst das Schiff, die Zeile nennt die Halle), aber benannt gehört sie
  if (fremd.length) say(`    WARNUNG: ${fremd.length} Schiffe stehen nicht in der Stufe ihrer Größenklasse und nicht in GROESSE_AUSNAHMEN: ${fremd.slice(0, 4).join('; ')}${fremd.length > 4 ? '; …' : ''}. Maße im Katalog prüfen, sonst dort mit Anlass eintragen`);
  // (c) die Naht: Bühne, Controller und Seite
  const draht = [
    [viewer, /function growFor\(info\) \{[\s\S]{0,300}?const pick = growPick\(info, L, G\.s, realHall\.room\.height\);[\s\S]{0,400}?hangarTell\(info\.id \?\? null, pick\.size,[\s\S]{0,300}?return out\.fromArray\(pick\.grow\);/, 'growFor im Viewer nimmt den Zuwachs nicht mehr aus growPick oder meldet die Stufe nicht (hangarTell): Die Halle wüchse wieder je Schiff, oder die Zeile bliebe leer'],
    [viewer, /for \(let i = Math\.max\(0, s\.sizes\.findIndex\(\(z\) => z\[0\] === info\.hangar\)\); i < s\.sizes\.length; i\+\+\)/, 'growPick beginnt nicht mehr bei der Stufe des Schiffs (info.hangar): Ein Schiff der Stufe Medium, das in Small passte, stünde in Small'],
    [viewer, /id: o\.id \?\? null, hangar: o\.hangar \?\? null \};/, 'show() im Viewer gibt Id und Stufe des Schiffs nicht mehr in die Maße (info.id, info.hangar)'],
    [viewer, /onHangar\(fn\) \{ hangarFn = fn; if \(hangarNow\) fn\(\{ \.\.\.hangarNow \}\); \}/, 'der Viewer bietet onHangar nicht mehr an'],
    [viewer, /\[null, t\.maker, t\.name, t\.role, t\.hangar\]\.forEach\(/, 'das Hologramm über dem Schiff zeigt die Zeile der Hangargröße nicht mehr (t.hangar)'],
    [ctrl, /const \[glb, tex, maker, ort, hangar\] = stageCfg\.models\[id\];[\s\S]{0,900}?viewer\.show\(glb, \{ maker, tex, ort, id, hangar, label: labelOf\(id\) \}\)/, 'der Controller gibt show() die Stufe des Schiffs nicht mehr mit (models[id][4]): Jedes Schiff bekäme die kleinste Halle, die es fasst'],
    [ctrl, /v\.onHangar\?\.\(onHangar\);/, 'der Controller hört nicht mehr auf onHangar: Die Zeile der Hangargröße bliebe leer'],
    [ctrl, /function onHangar\(e\) \{[\s\S]{0,300}?grOf\.set\(e\.id, e\);[\s\S]{0,200}?paintGr\(\);\s*viewer\?\.label\?\.\(e\.id, labelOf\(e\.id\)\);/, 'onHangar im Controller schreibt die Zeile nicht mehr in den Titelblock und ins Hologramm'],
    [ctrl, /role: txt\('\.hg-role'\), hangar: grText\(id\) \};/, 'labelOf im Controller gibt dem Hologramm die Hangargröße nicht mehr mit'],
  ];
  let verdrahtet = 0;
  for (const [text, re, was] of draht) { if (re.test(text)) verdrahtet++; else fail(`[24] ${was}`); }
  // Wörter der Zeile je Sprache: alle da, die mit Maßen tragen ihre Platzhalter, und Deutsch ist nicht Englisch
  let worte = 0;
  const wort = PAGES.map((page) => {
    const tag = /<span data-msg="gr"([^>]*)>/.exec(page.html)?.[1] ?? null, o = {};
    if (tag === null) fail(`[24] ${page.file}: die Wörter der Hangargröße fehlen (#hgx-msg [data-msg="gr"])`);
    for (const k of ['s', 'm', 'l', 'xl', 'own', 'feld', 'frei']) {
      o[k] = (new RegExp(`\\sdata-${k}="([^"]*)"`).exec(tag ?? '')?.[1] ?? '').trim();
      if (tag !== null && !o[k]) fail(`[24] ${page.file}: data-${k} der Hangargröße ist leer`);
      else if (tag !== null) worte++;
    }
    if (tag !== null && !['{w}', '{l}'].every((x) => o.feld.includes(x))) fail(`[24] ${page.file}: data-feld („${o.feld}“) trägt nicht {w} und {l}: Die Zeile nennte das Feld nicht`);
    if (tag !== null && !['{w}', '{l}', '{h}'].every((x) => o.frei.includes(x))) fail(`[24] ${page.file}: data-frei („${o.frei}“) trägt nicht {w}, {l} und {h}`);
    if (!/<header class="hg-title">[\s\S]{0,4000}?<p class="hg-role hg-gr" id="hgx-gr" hidden><\/p>[\s\S]{0,200}?<div class="hgx-actions"/.test(page.html)) fail(`[24] ${page.file}: die Zeile #hgx-gr steht nicht mehr leer und verborgen im Titelblock (.hg-title, vor der Knopfreihe): Ohne Hologramm und für Vorleser fehlte die Hangargröße`);
    return o;
  });
  for (const k of ['s', 'm', 'l', 'xl', 'own', 'frei']) if (wort[0][k] && wort[0][k] === wort[1][k]) fail(`[24] data-${k} der Hangargröße lautet deutsch wie englisch („${wort[0][k]}“): vergessene Übersetzung`);
  for (const t of bad.slice(0, 12)) fail(`[24] ${t}`);
  if (bad.length > 12) fail(`[24] … und ${bad.length - 12} weitere Befunde an den Hangargrößen`);
  sollIst(`${GROESSEN.length} Stufen mit den abgenommenen Maßen; Schiffe der Halle >= ${GROESSE.schiffe}, jedes auf dem Feld seiner Halle, nie kleiner als seine Stufe; Small >= ${GROESSE.S}, Medium >= ${GROESSE.M}, Large >= ${GROESSE.L}, Extra Large >= ${GROESSE.XL}; Abweichungen von der Größenklasse nur benannt (${Object.keys(GROESSE_AUSNAHMEN).length}); Naht >= ${GROESSE.draht} Stellen, Wörter >= ${GROESSE.worte}`,
    `${stufen} Stufen, ${schiffe} Schiffe (${zahl.S} Small, ${zahl.M} Medium, ${zahl.L} Large, ${zahl.XL} Extra Large, ${zahl['']} nach Maß; ${ohneStufe} ohne Stufe von der Seite), ${hallen.size} verschiedene Hallen, knappste Luft ${Number.isFinite(luftMin) ? luftMin.toFixed(2) : '—'} m, ${bad.length} Befunde, ${fremd.length} unbenannte Abweichungen, Naht ${verdrahtet} von ${draht.length}, ${worte} Wörter`);
  if (mod && formOk) {
    if (schiffe < GROESSE.schiffe) fail(`[24] nur ${schiffe} Schiffe der Halle gerechnet (Klinke ${GROESSE.schiffe}): lädt der Viewer nicht, fehlt #hg-stage oder nennt das Dock keine Maße mehr?`);
    for (const g of GROESSEN) if (zahl[g] < GROESSE[g]) fail(`[24] nur ${zahl[g]} Schiffe in der Stufe ${g} (Klinke ${GROESSE[g]}): Fällt die Größenklasse im Katalog weg, oder rastet die Halle anders ein?`);
  }
  if (verdrahtet < GROESSE.draht) fail(`[24] nur ${verdrahtet} Stellen der Naht geprüft (Klinke ${GROESSE.draht})`);
  if (worte < GROESSE.worte) fail(`[24] nur ${worte} Wörter der Hangargröße auf den Seiten (Klinke ${GROESSE.worte})`);
  ist.grStufen = stufen; ist.grSchiffe = schiffe; ist.grZahl = zahl; ist.grHallen = hallen.size; ist.grDraht = verdrahtet; ist.grWorte = worte;
}

say('\n[Selbstauskunft]');
say(`    Hangarseiten: ${PAGES.length}   Buchten: EN ${BAYS.en.length}, DE ${BAYS.de.length}   Zeilen EN: ${ist.slotZeilen}   Marker EN: ${ist.marker}   Grafikchips: ${ist.chips}   Waffenmodelle: ${ist.tauschModelle}   Tauschports: ${ist.tauschPorts}   Komponentenmodelle: ${ist.kompModelle}   Serienanker: ${ist.kompSerie}   Lackierungen: ${ist.lackierungen} in ${ist.lackSchiffe} Schiffen   Raketenslots: ${ist.raketenSlots} in ${ist.raketenSchiffe} Schiffen   Einhaengepunkte: ${ist.haken ?? 0} von 2   Ton-Schalter: ${ist.tonSeiten ?? 0} Seiten   Klaenge: ${ist.tonDateien ?? 0} Dateien   Schiffe mit Bildablage: ${ist.bildSchiffe ?? 0} (${ist.bildDateien ?? 0} Bilder, ${ist.bildMB ?? 0} MB)   Platzhalter: ${ist.platzhalter ?? 0} Dreiecke in ${ist.platzhalterSchiffe ?? 0} Schiffen   Karten mit Bild: ${ist.wahlKarten ?? 0}   Proben der Suche: ${ist.wahlProben ?? 0}   Innenräume: ${ist.innen ?? 0} (${ist.innenLampen ?? 0} Lampen)   Stationen: ${ist.stationen ?? 0} (${ist.stationenProben ?? 0} Proben der Adresse)   Wörter der Werkstatt: ${ist.werkstattWoerter ?? 0}   Datenblatt: ${ist.blattKauf ?? 0} Bauteile mit Laden, ${ist.blattRezept ?? 0} mit Rezept, ${ist.blattSeite ?? 0} mit Item-Seite (${ist.blattProben ?? 0} Proben der Rang-Rechnung)   Raum der Kamera: ${ist.raumSchiffe ?? 0} Schiffe, ${ist.raumGang ?? 0} mit Gang (${ist.raumProben ?? 0} Proben, ${ist.raumRand ?? 0} Ziele am Rand), Federarm ruht in ${ist.raumRuhe ?? 0} Lagen   Hangargrößen: ${ist.grStufen ?? 0} Stufen, ${ist.grSchiffe ?? 0} Schiffe (S ${ist.grZahl?.S ?? 0}, M ${ist.grZahl?.M ?? 0}, L ${ist.grZahl?.L ?? 0}, XL ${ist.grZahl?.XL ?? 0}, nach Maß ${ist.grZahl?.[''] ?? 0}), ${ist.grHallen ?? 0} Hallen, Naht ${ist.grDraht ?? 0}, ${ist.grWorte ?? 0} Wörter`);

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
