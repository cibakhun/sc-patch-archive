# Hangar-Werkhalle: Werkstatthalle für Bodenfahrzeuge hinter der Westnische

Stand 2026-10-24. Krisz verwirft die Fahrzeugwerkstatt in der Westnische
(PR #197) als Deko: Die Westnische wird ein Durchgang zu einer eigenen
Werkstatthalle. Wählt man ein Bodenfahrzeug, fährt die Kamera durch den
Durchgang in diese Halle, das Fahrzeug fährt dort von unten herauf, die
Lichter gehen von hinten nach vorn nacheinander an, zuletzt das mittlere
Spotlicht, genau wenn Kamera und Fahrzeug ankommen. Dort gibt es dieselbe
Loadout-Werkstatt wie bei Schiffen.

Der PC liefert die Halle aus dem Spiel (Geometrie mit Texturen, Lampen,
Maße); Einbau, Kamerafahrt, Licht-Abfolge, Aufzug und Prüfung macht die Cloud.

## Was schon feststeht (Cloud, am ausgelieferten Hallenmodell gemessen)

- Westnische im Modellraum von `revelyork-single`: Boden y 1,0, Rückwand
  eine Fläche bei x −15,0 (y 0,96 bis 12,1, z −87,8 bis −56,2), Decke
  meist bei y 9,6 (8,6 m über dem Boden), hinten ein höherer Streifen bis
  12,1. Hinter x −15,5 liegt im Modell nichts: Die Werkhalle kann frei
  dahinter stehen (x < −15, Mitte der Nische z −72).
- Die Cloud schneidet die Öffnung in die Rückwand (Shader), setzt die Halle
  dahinter und verbindet beide. Die Halle darf dafür gedreht und verschoben
  werden; ihr Tor muss nur zur Nische zeigen können.
- Im Spiel gibt es den Bausatz `Objects/buildingsets/human/hightech/delta/int/garage/`
  (daraus kam `prop_tor_high_tech_garage_door_s`, aus dem Container eines
  Teileladens in Orison). Das ist der erste Kandidat für einen ganzen Raum.
- Eine Hebebühne für Fahrzeuge gibt es laut PC-Befund vom 23.10. nicht
  (hangar-fahrzeuge.md, F3).

## Auftrag PC

- **W1 Halle.** Einen geschlossenen Innenraum aus dem Spiel finden, der als
  Werkstatt- oder Garagenhalle für Bodenfahrzeuge taugt, und ihn wie die
  große Halle exportieren (Geometrie mit Texturen, Materialien
  aufgeräumt wie bei `revelyork-single`, Lampenliste v 2 wie
  `revelyork-single.lights.json`).
  - Grundfläche etwa 24 bis 40 m mal 24 bis 40 m, lichte Höhe 8 bis 14 m,
    ebener Boden, Industrie-Anmutung (Garage, Werkstatt, Fahrzeugbucht):
    Deckenleuchten in Reihen, Wandpaneele, gern Gerät und Leitungen.
  - Auf einer Seite ein großes Tor oder eine Öffnung, mindestens 6 m breit
    und 4,5 m hoch (die Kamera fliegt hindurch; mehr ist besser).
  - In der Mitte freier Boden für die Fahrzeugbühne, möglichst 12 × 22 m
    (das längste Bodenfahrzeug, die Nova, ist 20 m lang). Ist es weniger,
    hier sagen wie viel.
  - Suchen in Containern und Bausätzen mit garage, vehicle, veh, asop,
    workshop, repair, maintenance, depot, motorpool im Namen: zuerst die
    Hightech-Garage (delta, siehe oben), dann Außenposten-Garagen,
    Garagen der Verteilzentren, Stadtgaragen (Lorville, Area18, New Babbage,
    Orison), Fahrzeugbuchten in Stationen. Die 5 bis 10 besten Kandidaten
    mit Maßen, Torgröße, Dreiecken und Lampenzahl unten auflisten, den
    besten exportieren.
  - Budget: höchstens 600 000 Dreiecke, 80 Materialien, 12 MB GLB. Lose
    Einrichtung im Raum darf bleiben, wenn sie ins Budget passt.
  - Jede Deckenleuchte (Leuchtkörper mit leuchtendem Material) bleibt ein
    eigener, benannter Knoten (nicht mit anderen zusammengelegt), damit der
    Viewer sie einzeln einschalten kann. In der Lampenliste je Lampe, wenn
    bekannt, der Name des Leuchtkörpers.
- **W2 Maße** in `<schlüssel>.json` neben der GLB: Bodenhöhe, Innenraum
  (x/z min/max), Deckenhöhe, Tor (Mitte, Breite, Höhe, Richtung nach
  draußen), die Deckenleuchten (Knoten, Lage, zugehörige Lampen), der freie
  Boden in der Mitte (Rechteck). Achsen wie bei der großen Halle (y oben,
  Meter).
- **W3 Tor.** Hat die Halle ein Tor: seine Blätter als eigene Knoten, dazu
  die Bewegung im Spiel (rollt hoch, fährt nach oben, teilt sich), damit der
  Viewer es öffnen und schließen kann. Gibt es das Blatt nur als animierte
  Entity: geschlossen exportieren und die Bewegung hier beschreiben.
- **W4 Fahrzeugbühne.** Falls es im Spiel eine Plattform gibt, auf der ein
  Fahrzeug steht oder fährt (Fahrzeugaufzug, Drehteller eines
  Ausstellungsraums, Fahrzeug-Pad der Garagen, 10 bis 22 m, rund oder
  eckig, mit Rand): als eigenes Teil mitliefern. Sonst hier festhalten, dass
  nicht; dann baut die Cloud sie aus dem Bodenmaterial der Halle.
- Dateien: `public/hangar/werkhalle/<schlüssel>.glb`, `<schlüssel>.lights.json`,
  `<schlüssel>.json`, Eintrag im Manifest `src/data/hangar-assets.json`
  (eigener Abschnitt `werkhalle`), gebaut über `scripts/build-hangar-assets.mjs`
  (neue Art, wenn nötig). Rohdateien bleiben in `.cache/`.
- Bilder zur Sichtprüfung (von der Tür in den Raum, von hinten zur Tür, von
  oben, je ein JPG unter 400 KB) nach `.cache/werkhalle-bilder/` im
  Arbeitsverzeichnis des PCs, nicht ins Repo.
- Bestehende Dateien (große Halle, Katalog, Schiffe) bleiben unverändert.
  Branch `pc/hangar-werkhalle` von `origin/claude/project-thread-xl1tqa`,
  Push ohne PR. Vor dem Push `npm run build && npm run gate` grün, dazu
  einmal mit `STAGING=1`.

## Befund PC

=== Werkhalle `ht-garage-lrg` · große Hightech-Garage aus New Babbage · Tor 16,0 × 6,2 m · 224 742 Dreiecke, 31 Materialien, 2,96 MB · 279 Lampen, 92 Leuchtkörper · Branch `pc/hangar-werkhalle` ===

Gewählt ist die große Garage der Hightech-Städte, also der Bausatz
`delta/int/garage` aus der Notiz. Sie kommt aus zwei Containern im selben
Raum: der Hülle `hightech_a/garage_lrg_001` (Wände, Pfeiler, Boden, Decke)
und ihrer Einrichtung für New Babbage `garage_lrg_001_newbab` (Torrahmen,
Leuchtkörper, alle Lampen). Die Einrichtung nennt die Hülle als externes
Kind, das StarBreaker nicht nachlädt; der Extraktor exportiert darum beide
zusammen. Das Torblatt stellt erst der Raumhafen auf, der die Garage enthält
(`newbab_sp_surface_entrance_int`, Garage bei (19, −287, 16), ungedreht). Der
Extraktor holt es dort heraus und setzt es in den Rahmen. Der Raum ist
sauber und hell, eine Werkhalle der Stadt, mit Pfeilerreihe, Wandpaneelen,
zwei Reihen Deckenleuchten und einem Mittelfeld im Boden. Gerät und
Leitungen gibt es nicht; die würde nur die Außenposten-Garage mitbringen
(Kandidat 4).

Neu sind `public/hangar/werkhalle/ht-garage-lrg.glb` (3 108 780 Bytes),
`ht-garage-lrg.lights.json` (63 409), `ht-garage-lrg.json` (Maße, 27 378),
`ht-garage-lrg-buehne.glb` (483 868), im Manifest der Abschnitt `werkhalle`
mit den Einträgen `ht-garage-lrg` und `ht-garage-lrg-buehne`. Gebaut über die
neue Art `werkhalle` in `scripts/build-hangar-assets.mjs` (wie die Halle: nie
dezimiert, Materialnachtrag, Schichtmaterialien, Texturen, Kantennormalen,
Draco 16 Bit), Quelle ist der neue Teil `werkhalle` in
`scripts/extract-hangar-sources.mjs`. Große Halle, Katalog, Schiffe und alle
übrigen Manifest-Einträge sind unverändert (im Manifest nur angehängt).

Nachbauen: `node scripts/extract-hangar-sources.mjs werkhalle`, dann
`node scripts/build-hangar-assets.mjs --only ht-garage-lrg` und
`--only ht-garage-lrg-buehne`. Rohdaten unter `.cache/hangar-src/werkhalle/`
und `werkhalle-raw/`.

### Kandidaten

Maße der Rohexporte (Außenmaß der Container, Meter), Dreiecke und Lampen in
LOD 1 je Exemplar gezählt. Tor = Breite × Höhe der Öffnung.

| # | Raum (Container) | Maße | Tor | Dreiecke | Lampen | Urteil |
|---|---|---|---|---|---|---|
| 1 | Hightech-Garage groß (`garage_lrg_001` + `_newbab`, New Babbage) | 34 × 40,6, Decke 6,9 bis 8,4 über dem Boden | 16,0 × 6,2 (Tor L) | 65 988 (LOD 0 gebaut: 224 742) | 279 | **gewählt** |
| 2 | Hightech-Garage mittel (`garage_med_001` + `_newbab`) | 26 × 30,6, gleiche Höhe | 12,0 × 6,2 (Tor M) | 54 994 | 213 | gut, aber freier Boden nur 12 m breit |
| 3 | Hightech-Garage klein (`garage_sml_001` + `_newbab`) | 22 × 26,6 | 8,0 × 6,2 (Tor S) | 44 357 | 152 | unter 24 m |
| 4 | Außenposten-Garage (`grge_a_sa_int` + Einrichtung `…_ovrly_indy_a`) | Raum 28,9 × 23,2, Höhe 9,7 | 12,2 × 7,3 (Rahmen, Blatt animiert) | 39 222 + 1 931 325 | 4 + 324 | die Werkstatt mit Rohren und Maschinen, aber die Einrichtung allein ist dreimal das Budget |
| 5 | Außenposten-Garage im Hauptgebäude (`grge_a_int` + `…_ovrly_indy_a`) | gleicher Raum | gleich | 116 954 + 1 735 414 | 2 + 370 | wie 4 |
| 6 | Wartungsladen Orison (`maintenance_orison`) | 31,5 × 33,2 × 12,5, L-förmig | 12 × 4,25 (Ladenfront) | 307 134 | 168 | Tor zu niedrig, Laden statt Halle |
| 7 | Wartungsraum Außenposten (`col_a_maintenance_room_001`) | 27,7 × 27,5 × 8,7 | nur eine Tür | 143 979 | 7 | kein Tor |
| 8 | Garage der Bodenkampf-Arena (`EA/tow/Phase2/garage`) | 56 × 56, rund 16 hoch | kein Blatt im Container | 226 700 | 16 | zu groß |
| 9 | Verladehalle der Verteilzentren (`ugf/util/rm/surf/tns/surf_base_tns_001`) | 84,5 × 54,9 | – | 1 401 722 | 316 (Einrichtung) | zu groß |
| 10 | Astro Armada Area18 (`astroarmada_area18_int`) | 45 × 62 × 29 | Glastüren 8 × 2,5 | 503 005 | 184 | Ausstellungsraum, zu groß |

Gesucht in allen 9 668 socpaks nach garage, vehicle, veh, asop, workshop,
repair, maint, depot, motorpool, showroom, dealer, distrib und den Torblättern.
Stadtgaragen als Innenraum hat nur New Babbage (Kandidaten 1 bis 3, je in
zwei, vier und sechs Exemplaren im Raumhafen). Für Lorville und Area18 fand
die Suche nur Läden, für Orison nur die offene Fahrzeugstation
(`orison_vehicle_station_a_base`, 33,5 × 16,9 × 5,3 m, ohne Decke und Lampen).
Die Fahrzeugbuchten der Stationen (`wall_straight_repairspot_*`) sind
Wandstücke, keine Räume.

### W1. Halle

- **Budget:** 224 742 Dreiecke (Grenze 600 000), 31 Materialien nach dem
  Zusammenlegen (53 im Rohexport; Grenze 80), 2,96 MB (Grenze 12 MB),
  65 Texturen. Alle Dreiecke haben ein Material; von den 53 Rohmaterialien
  haben 44 eine Farbkarte, 45 Normalen und Rauheit, 28 tragen die zweite
  Lackschicht eingebacken wie bei `revelyork-single`.
- **Leuchtkörper:** Jeder Knoten, dessen Netz ein Leuchtkörper ist (Name
  enthält `light`), bleibt ein eigener Knoten `leuchte_<netz>_<nn>`, gezählt
  je Netz von vorn (Tor) nach hinten. 92 Knoten: an der Decke 8 Lichtpaneele
  `light_panel_1_d` in zwei Reihen zu vier (x ±2,9, z 3/11/19/27, y 7,79),
  10 Lichtleisten `light_fixture_rectangular_e` oben an den Seitenwänden und
  hinten, 6 Warnleuchten `light_hazard_1_a` (x ±8, y 6,94); an den Wänden
  23 (Leisten, Wandlampen); im Boden 45 (Bodenleuchten entlang des
  Mittelfelds und der Seiten). Ihr leuchtendes Material (`…glow…`) hat die
  Farbkarte als Emissive, wie in der Halle. Identische Leuchtkörper teilen
  sich das Netz (Instanzen), die Knoten sind getrennt.
- **Lampenliste v 2** (`ht-garage-lrg.lights.json`, Aufbau wie
  `revelyork-single.lights.json`): 279 Lampen (161 Spot, 94 Punkt,
  24 Fläche), alle mit Spieltyp aus dem Exportprotokoll. Neu je Lampe das
  Feld `fixture`, der Knoten des Leuchtkörpers, wenn die Lampe in dessen um
  0,6 m erweiterter Box liegt: 193 Lampen; die übrigen 86 sind Lampen ohne
  sichtbaren Körper (Füll- und Wandlicht der Lichtgruppen). Jedes
  Deckenpaneel hat zwei Lampen.
- **Was fehlt:** Decals schreibt der socpak-Export nicht (wie bei allen
  Hallen): am Torblatt 4 Decal-Materialien mit 2 798 Dreiecken (Aufschrift,
  Prägungen), am Drehteller eines (664 Dreiecke). Ein Streifen am Blatt
  `tor_unten_1` hat UVs von 0 bis 1 535 (so im Spiel); darum packt Draco die
  UVs mit 23 Bit.

### W2. Maße (`ht-garage-lrg.json`)

glTF-Achsen, y oben, Meter. Ursprung = Ursprung des Garagen-Containers. Das
Tor liegt vorn bei z = 0 und zeigt nach −z, der Raum reicht nach +z.

- **Boden** `floorY` 0,026. Das Mittelfeld (x ±7 bis ±8,5) liegt 7 bis
  11 cm höher als der übrige Boden; alles befahrbar.
- **Innenraum** `interior`: x −16,2 … 16,18 (zwischen den Wänden der
  Seitenbuchten auf 1,5 m Höhe), z 0 … 39,2 (Tor bis Rückwand). Die Halle
  selbst (Bodenfeld zwischen den Pfeilern) ist 24 m breit (x ±12); die
  Seitenbuchten dahinter haben eine niedrigere Decke (5,0 bis 5,8 m).
- **Decke** `ceiling` über dem Bodenfeld: 6,86 bis 8,39 m, im Mittel
  7,81 m; lichte Höhe unter dem tiefsten Deckenteil 6,84 m. Kein Strahl
  nach oben entkommt: Das Glasfeld der Decke (7,1 bis 7,5 m) hat darüber
  die geschlossene Deckenplatte.
- **Tor** `gate`: Mitte (−0,02, 3,1, 0), 16,04 × 6,2 m, nach außen
  (0, 0, −1); offen bleiben 16,04 × 5,90 m frei (unten steht die Schwelle
  10 cm über dem Boden).
- **Leuchtkörper** `fixtures`: je Knoten, Netz, Mitte, Box, Montage
  (`decke`/`wand`/`boden`) und die Namen seiner Lampen.
- **Freier Boden** in der Mitte, nichts zwischen Boden und 4,5 m:
  `stage` (Bodenstufen bis 15 cm) 25 × 33,5 m, x ±12,5, z 1 … 34,5;
  `panel` (nur das ebene Mittelfeld) 14 × 31,5 m, x ±7, z 0,5 … 32.
  12 × 22 m passen in beide.

### W3. Tor

Das Blatt ist `high_tech_garage_door_l` (.cga), 8 208 Dreiecke in LOD 0,
im Raumhafen im Maßstab 1, genau im Rahmen
`garage_lrg_doorframe_02x16x07_a` (16,5 × 7,7 m). Es ist kein Rolltor,
sondern teilt sich waagerecht, und jede Hälfte schiebt sich teleskopisch
zusammen. Vier Knoten, geschlossen exportiert:

| Knoten | Knochen | geschlossen y | öffnen Δy |
|---|---|---|---|
| `tor_unten_1` | `door_bottom_primary` (Schwelle) | 0 … 1,0 | −0,899 |
| `tor_unten_2` | `door_bottom_secondary` | 0,95 … 3,0 | −2,899 |
| `tor_oben_2` | `door_top_secundary` | 3,0 … 5,05 | +3,0 |
| `tor_oben_1` | `door_top_primary` (Sturz) | 5,0 … 6,2 | +1,0 |

Öffnen dauert 6,67 s (200 Bilder zu 30/s); erst gleiten die beiden inneren
Blätter in die äußeren (ab Bild 3), ab Bild 83 (2,77 s) fahren die äußeren
mit (unten in den Boden, oben in den Sturz), alle mit weichem Anfahren und
Abbremsen. Schließen ist die Umkehrung. Die Kurve steht je
Blatt in `gate.motion.open`/`close` (11 Stützstellen, Zeit `t` und `dy`),
die rohen Spuren in `.cache/hangar-src/werkhalle/ht-garage-lrg.tor.json`.
Die Blätter sind New-Babbage-Blau (`0,011 / 0,356 / 0,768`): Das ist die
zweite Lackschicht des Materials, eingebacken wie in der Halle.

### W4. Fahrzeugbühne

Eine Plattform für Fahrzeuge gibt es; sie steht als eigene Datei
`ht-garage-lrg-buehne.glb` daneben, je Teil ein Knoten, mittig über dem
Ursprung, Oberkante y = 0:

| Knoten | Teil | Maße (x × y × z) | Dreiecke |
|---|---|---|---|
| `buehne_lift_m` | Plattform des mittleren Lastenaufzugs der Hightech-Hangars (`elev_ht_cargo_pad_m`) | 18 × 0,25 × 14 | 4 032 |
| `buehne_lift_l` | Plattform des großen Lastenaufzugs (`elev_ht_cargo_pad_l`) | 28,15 × 0,25 × 22,18 | 4 424 |
| `buehne_drehteller` | Drehteller der Ausstellungshalle New Babbage (`expo_hall_connection_turntable_001_a`) | 15,89 × 0,90 × 15,89, rund | 316 |

- Die Aufzugsplatten sind flache Platten mit Rand und eingelassenem
  Mittelfeld, aus demselben Hightech-Bausatz wie die Garage. Im Spiel fahren
  sie im Schacht hoch und runter; das passt zum Fahrzeug, das von unten
  kommt. Für die Nova (20 m) reicht nur `buehne_lift_l` in Längsrichtung
  (um 90° gedreht: 22,2 × 28,1 m, passt auf das Bodenfeld 24 × 35 m).
- Der Drehteller ist 0,9 m hoch; im Spiel steht er auf dem Boden.
- Garagen-eigene Fahrzeug-Pads gibt es nicht: Die Hightech-Garage hat ihr
  Mittelfeld im Boden (siehe `panel`).

### Prüfung

`npm run build && npm run gate`: 28 von 28 grün; mit `STAGING=1` ebenfalls
28 von 28 grün. Auszug und Bau zweimal hintereinander: alle vier Dateien
unter `public/hangar/werkhalle/` byte-gleich.

Sichtprüfung als Render im lokalen Chrome (three.js, Umgebungslicht, ohne
Spiellampen): `.cache/werkhalle-bilder/werkhalle-von-der-tuer.jpg`,
`werkhalle-von-hinten.jpg`, `werkhalle-von-oben.jpg` (Decke ab 6,6 m
weggeschnitten; gelb Lampen mit Leuchtkörper, blau ohne, grün `stage`,
rosa `panel`). Der weiße Fleck auf dem Tor in der Ansicht von hinten ist
die Spiegelung des Umgebungslichts im Viewer, kein Material.

## Einbau Cloud (2026-10-24)

Alles im Block `WERK` in `assets/hangar-viewer.js`; Gate [18] in
`scripts/verify-hangar-hall.mjs` liest ihn und misst ihn gegen die
Garagen-json in `dist/`.

- **Ort.** Jedes Modell trägt in `models` ein viertes Feld, den Ort
  (`hall` oder `werk`). Bodenfahrzeuge (`isSpaceship === false`, 31 Stück)
  gehen nach `werk`, Gravlev bleibt in der Halle. `show()` bekommt den Ort;
  wechselt er, fährt die Kamera (`werkIn`, `werkOut`), sonst bleibt alles
  wie bei Schiffen. Die Loadout-Werkstatt rechnet über
  `current.model.matrixWorld`, sie arbeitet in der Werkhalle unverändert.
- **Lage.** Garage um −90° gedreht, Torebene bei Hallen-x −52, 1 m hinter
  der Nischenrückwand (x −51). Die Wand bekommt einen Durchgang
  16,3 × 6,55 m mit Rahmen; das Logo der Rückwand rückt darüber. Kein
  Dreieck der Garage liegt vor der Wand (Gate [18] zählt nach).
- **Zwei Lichtwege.** Innen leuchtet der Werk-Shader (analytische Lampen je
  Band, Spot über der Bühne, Lichtschein der Halle vor dem Tor). Tor und
  Vorderteile sieht man auch aus der Halle: Sie tragen zwei Materialsätze,
  im Hallenmodus das Licht der Halle, in der Werkhalle bei geschlossenem
  Tor das eigene. Beide Programme werden beim Laden vorgewärmt.
- **Vertexfarben der Garage.** COLOR_0 ist nur dort Abdunklung, wo es grau
  mit vollem Bereich ist (max ≥ 0,6). Der Boden (max 0,16) und bunte
  Masken sind keine Farbe und werden weiß; sonst wird der Boden schwarz
  oder orange.
- **Bühne.** Die Plattform `buehne_lift_m` liegt in einer Grube im
  Mittelfeld, 7 m tief, und fährt hinab (1,9 s) und hinauf (2,8 s) wie das
  Schiffsfeld. Ihr Knoten behält seine eigene Drehung (sonst steht sie
  hochkant).
- **Fahrt.** Weg als CatmullRom aus der Halle tief durch die Nische ins
  Tor, Dauer 1,6 s + Weg / 22 m/s (4,2 bis 6,4 s, rein mit Gladius 95 m in
  5,9 s). Die Blickrichtung schwenkt (Gier auf kürzestem Weg, Neigung
  linear) statt Blickpunkte zu mischen; sonst kippt der Blick beim
  Herausfahren in einem Bild um 180°. Nach der Fahrt wird der
  Kameraabstand neu gesetzt, sonst gleitet sie zurück. Um das alte Schiff
  geht der Weg nur herum, wenn die Kamera es dort trifft, wo es gerade ist
  (Fahrkurve des Aufzugs, Maßstab seiner Gruppe); mit festem Quader flog
  sie von der Carrack bis an die Stirnwand und dicht am Aufzugsturm
  vorbei, obwohl die Carrack längst unten war.
- **Licht-Abfolge.** Tor auf ab 2,2 s, Bühne ab 3,1 s. Die fünf Bänder
  gehen bei 50, 58, 66, 74 und 82 % der Fahrt an, von der Rückwand zum
  Tor, jedes mit Flackern; der Spot genau bei der Ankunft, wenn die Bühne
  oben ist. Vorher lief die Folge hinter dem noch geschlossenen Tor ab.
- **Raus.** Bühne hinab, Fahrt zurück in die Halle, das Schiffsfeld fährt
  zur Ankunft herauf, das Tor schließt, die Lampen gehen aus.
- **Deko.** Die Werkstatt aus PR #197 in der Westnische ist weg. Die
  Zufahrt hat drei Zonen: `zufahrt-west` mittig nur mit Markierung und
  Fahrspuren, `zufahrt-nord-west` und `zufahrt-sued-west` am Rand mit
  Konsole bzw. Kabelterminal. Klinken der Hallendeko mit Begründung
  gesenkt.

### Gate [18] vorgeführt rot

Durchgang 1,5 m verschoben (`tuer.x` −49,5), ein Band mit Lücke
(`[23, 29]`), Lichtfolge vertauscht (`WERK_ROWS_AT` 0,58 vor 0,5):
6 FEHLER, darunter „der Tunnel endet bei x −50.5, die Torebene der Garage
steht bei x −52“, „WERK.reihen … laufen nicht lückenlos von der Rückwand
(Garage z 39.2) bis vors Tor“, „WERK_ROWS_AT (0.58, 0.5, …) braucht je
Band einen Anteil der Fahrt, steigend“, „der Durchgang … liegt auf keiner
Rückwand einer Nische“ und „nur 0 Dreiecke Wand in der Scheibe des
Durchgangs, die Klinke verlangt 740“.

Zweiter Lauf, Garage 2 m nach vorn (`garage.x` −50): 4 FEHLER, darunter
„tor.x (−52) ist nicht die Torebene der Garage (−50)“, „raum … liegt nicht
im Innenraum der Garage“ und „18991 Dreiecke der Garage ragen vor die
Nischenwand in die Halle (H x > −51 …): Ihre Außenwand stünde vor der
Wand“. Mit dem Block wie geliefert: alle Zusicherungen erfüllt.

Nachtrag (Review): [18] prüft jetzt auch die Bühnendatei der Seite
(`opts.hall.werk.buehne`) und den Knoten `feld.buehne` darin; vorher reichte
die json. Vorgeführt rot: Datei in `dist/` weggenommen („die Seite liefert
keine Bühnendatei in dist/ … Das Fahrzeug stünde ohne Plattform in der
Grube“), Knoten auf `buehne_lift_x` gestellt („… hat keinen Knoten
buehne_lift_x (feld.buehne)“ neben dem Befund der json).

## Endpunkt und Fahrt hinaus (Krisz, 24.10.2026 abends)

Krisz, 17:45 mit Bild: „die kamer is iwi in dem schiff drin“, 17:47 mit
Bild: „in dieser position ungefähr soll die kamera enden und nicht da links
oben wo jetzt isie endet“. Das zweite Bild zeigt die Werkhalle vom Tor aus,
mittig auf der Achse, knapp über Augenhöhe, das Fahrzeug auf der blauen
Bühne, dahinter die Rückwand.

- **Startansicht** `WERK_HOME_DIR` jetzt `(1, 0.12, 0)`: auf der Achse zum
  Durchgang, 6,8 Grad hoch (vorher `(0.74, 0.22, 0.64)`, vom Tor aus links
  oben). `werkRoom` misst längs dieser Richtung nur noch bis 0,8 m vor dem
  Tor (15,8 statt 17,6 H-m), große Fahrzeuge bekommen darum einen etwas
  größeren Maßstab (Nova 1,41 → 1,56). PTV: Kamera 1,9 m hinter dem Tor,
  Ursa und größer 0,8 m. Tor [18] prüft die Richtung (höchstens 1,1 Grad
  seitlich, 0 bis 11,5 Grad hoch; auf dem Einheitsvektor |z| ≤ 0,02, y ≤ 0,2), zweimal rot vorgeführt: alte Richtung
  („steht 40.9 Grad seitlich, 12.7 Grad hoch“) und ohne `.normalize()`
  („steht nicht mehr als Vector3(x, y, z).normalize() im Viewer“).
- **Weg hinein**: Der Punkt hinter dem Tor (`bahn.aus`, 4 m) liegt jetzt
  hinter dem Ziel; er kommt nur noch dazu, wenn das Ziel tiefer im Raum
  liegt oder die Gerade von der Nische nicht durch den Durchgang ginge.
- **Licht**: Das Tor ist `WERK_TOR_VOR` (1,2 s) vor der Kamera offen, die
  Bänder gehen vom ersten Blick hinein (Tor 42 % offen) bis zur Ankunft an,
  `WERK_ROWS_AT` sind jetzt Anteile dieser Spanne. Gladius → PTV: 81 m in
  5,3 s, Tor ab 1,6 s, durch bei 4,6 s, Bänder 2,5/3,1/3,6/4,1/4,6 s, Spot
  5,3 s.
- **Hinaus aus der Ansicht von vorn**: `p.at(tor.x − 1,2)` fand die Ebene
  hinter einer Kamera, die näher als 1,2 m am Tor steht, nie und gab das
  Ende: Das Tor ging erst auf, als sie hindurch war (Aufnahme: blaues
  Torblatt bildfüllend). Jetzt zählt sie dort als gleich am Tor, wartet
  (`hold`), bis es offen ist, und dreht sich derweil ganz zum Weg (vorher
  halb gedreht: Blick im Tor auf Rahmen und Nischenwand). Vorher hätte die
  Fahrt auf ein Vielfaches gestreckt werden müssen. Ursa → Gladius: 7,3 s
  mit 2,0 s Warten.
- **Kehrtwende**: `panDir` hält die Seite des Schwenks, wenn er fast genau
  180 Grad dreht; der kürzere Weg sprang sonst zwischen zwei Bildern.
- **Kamera im Fahrzeug**: Nachgestellt mit Prüfung je Bild (Strahlen von der
  Kamera, Rückseiten gezählt) über Fahrten mit Gladius, Carrack, Spartan,
  Ursa, Nova, PTV, ROC, Zoom ganz hinein und Drehen: in keinem Bild in einer
  Hülle. Ganz hineingezoomt und dann auf ein größeres Fahrzeug gewechselt,
  füllt die Hülle aus 2 m das Bild (Nova). Zwei echte Fehler dabei: (1) Auf
  dem Weg hinaus zählte das Fahrzeug nur so groß, wie es im Maßstab des
  neuen Schiffs wäre (`werkRescale` hatte die Gruppe schon mitgenommen),
  die Kamera konnte hindurchfahren; jetzt mit `vehSc`. (2) Der Nachlauf
  der Dämpfung vom letzten Ziehen ruhte während der Fahrt und drehte die
  Kamera nach der Ankunft weiter (Aufnahme: 6 m zur Seite); `tripStart`
  verwirft ihn jetzt.

## Decke, Hintergrund, Spot (Krisz, 24.10.2026 abends)

Krisz zur Frage nach der fast schwarzen Decke: „decke iwi verbessern,
rohre, kablen etc, sonst alles im hintergrund richtung wände dunkler machen,
den spotlight softer“.

- **Deckenprofil der Garage**, gemessen (senkrecht nach oben je 0,5 m, im
  Viewer): Mittelplatte (z ±6,5) 7,8 m hoch von x −81 bis −53,5; davor ein
  Träger bis 7,4 m, dahinter ein Sturz bis 6,8 m; Randträger bei z ±7,5 bis
  6,8 m herab; Seitenstreifen z ±8..10 bei 6,9 m mit Rippen alle 8 m (x −79,
  −71, −63, −55); Leuchtbuchten bei z ±10,5..12; über der Rückwand eine Bucht
  bis 8,4 m (von vorn nicht zu sehen). Die Kamera bleibt unter
  `raum.h − 0,8` = 6,0 m.
- **Leitungen** (`WERK_DECKE`, Block `/* work-werkdecke */`, gepackt von
  `scripts/build-werkhalle-decke.mjs` nach `public/hangar/props/werkdecke.glb`,
  die Materialien bleiben wie im Katalog und bekommen das Licht der
  Werkhalle wie die Garage): unter der Mittelplatte je Seite ein
  Lüftungskanal (z ±4,6, sieben 4-m-Stücke von x −81 bis −53, vom hinteren
  Sturz bis in den vorderen Träger), ein Rohr daneben (z ±6,0) und ein
  durchhängender Kabelzug (z ±3,5, zwei 12,5-m-Stücke) mit Anschlussdosen an
  beiden Enden und in der Mitte; dazu zwei Querzüge von Kanal zu Kanal über
  die Mitte (x −75 und −61, zwischen den Leuchten) mit einer Dose in der
  Mitte. Je Material eine Geometrie: 6 Zeichenbefehle. Das Rohr trägt im
  Katalog die Palettenfarbe Weiß und stand wie ein Leuchtbalken unter der
  Decke; `WERK_DECKE_TON` dunkelt es (×0,28) und die Kanäle (×0,6).
- **Zu den Wänden hin dunkler** (`WERK_WAND`): Licht der Reihen,
  Grundlicht und Spiegelung fallen ab 35 % des Wegs von der Bühnenmitte bis
  zur Wand (hinten 22,7 m, vorn 16,5 m, Seite aus der json der Garage) bis
  auf 22 % an der Wand; Leuchtflächen halb so stark. Bühne, Fahrzeug und
  Spot bleiben.
- **Spot weicher**: Kegel innen 5 statt 16 Grad, außen 36 statt 30, Stärke
  170 statt 260 (das Fahrzeug strahlte weiß), Überschlag beim Einschalten
  1,12 statt 1,25, Lichtkegel im Raum halb so dicht.
- Tor [18] prüft die Decke: Satz der Seite passt zum Block (Fingerabdruck),
  jedes Stück im Katalog, in der Garage, Oberkante an der Decke, Unterkante
  0,3 m über der Kamera, frei vom Spot, Läufe Stück an Stück, Klinke
  `KLINKE_WERK.decke`.

## Größer, mehr Leitungen, Licht, Rückfahrt, Gravlev-Räder (Krisz, 25.10.2026)

Krisz am Morgen, drei Nachrichten:

> die kamera wenn wir zurück vom bodenfahrzeug zu den schiffen gehen soll
> ungefähr da sein bzw halt einfach durch das tor, dann leicht nach oben
> thats it.

> wir können die werkstattwände und decke bisschen erweitern, und dann halt
> viele schläuche, rohre, etc an der decke laufen lassen, die wände etwas
> dunkler beleuchten so dass spotlight in der mitte prominenter ist, und die
> lichter wenn die angehen mehr effekt haben

> dragonfly undso gehört auch zur bodenfahrzeugen

Das Bild zur ersten Nachricht kam nicht an. Gelesen als: geradeaus durch
das Tor, danach leicht hinauf, Ende in der Halle 10 m vor der Nische mit
Blick zum Schiff, statt quer durch die Halle zu deren Startansicht.

- **Rückfahrt** (`WERK.bahn.zurueck` [-26, 5,0]): werkPath('out') hält die
  Höhe, auf der die Kamera in der Werkhalle steht (höchstens 55 % des
  Durchgangs), durch den Durchgang bis zur Mitte der Westnische (x −44,
  `bahn.nische` 7 m vor ihrer Rückwand; sie reicht von x −51 bis −36) und
  steigt von dort bis zum Endpunkt in der Halle, 10 m vor der Nische. Der
  liegt auf der Achse im Anflug, den Tor [18] von Hallengeometrie und
  [17] von Deko frei hält (x bis `bahn.vor`, unter `tuer.h`). Tor und
  Aufzug laufen wie vorher (Warten am Tor, Schiff kommt mit der Kamera
  oben an).
- **Größer** (`garage.s` 1,2): Die Garage wächst um ihre Torebene, alles aus
  ihrer json zählt mal s (Innenraum 38,9 × 47 m, Decke der Mittelplatte 9,3
  statt 7,8 m, Leuchten, Reichweiten, Bänder des Abfalls). Bühne, Grube und
  Durchgang der Nische bleiben; die Grube rückt mit der Mitte des Glasfelds
  auf x −71,8. Das Tor ist jetzt 19,3 × 7,4 m und größer als der Durchgang
  (16,3 × 6,55 m): Von innen sah man neben und über dem Rahmen durch die
  Rückseite der Nischenwand in die Halle. `werkBlende` deckt den Rand in der
  Torebene, der Rahmen reicht bis dorthin. Logo und Nische bleiben, wie
  Krisz sie gesehen hat.
- **Decke** (86 statt 44 Stücke): je Seite Luftrohr (z ±7,2), Lüftungskanal
  (±5,6), Wartungsschlauch (±4,5), Kabelzug mit Dosen (±2,3), Luftschlauch
  (±1,5, gerade an der Platte; die durchhängende Fassung wellte sich wie eine
  Girlande und leuchtete gelb, jetzt ×0,21; dicht an den Leuchten blieb er
  auch mit ×0,42 der hellste Strich im Bild); auf den Seitenstreifen zwei
  flache Rohrbündel (±10,2 und ±11,3, 8,3 m). Deckenprofil neu gemessen
  (Strahlen senkrecht je 0,5 m).
- **Licht**: Abfall zu den Wänden ab 15 % des Wegs bis auf 7 % an der Wand
  (vorher 35 % und 22 %), Grundlicht und Spiegelung schwächer; Reihen 40
  statt 72, Spot 1 m höher (7,4 m) und 380 statt 170, damit er in der Mitte
  trägt. Vier Stufen nebeneinander verglichen (Reihen 72/52/40/32, Spot
  280/330/380/420): Bei 72 lag die Bühne so hell wie der Boden davor und der
  Spot ging unter; bei 32 versank der Boden vorn im Schwarz. Gewählt 40.
- **Einschalten**: Die Reihen flackern mit Blitzen über voll (bis 1,6) und
  glühen in 0,9 s auf voll aus; Grundlicht, Spiegelung und Leuchtflächen
  gehen mit, jeder Blitz hellt den Raum kurz auf. Der Spot schlägt mit 1,8
  an und klingt ab.
- **Gravlev-Räder** (vehicles.json `isGravlev`, 10: Dragonfly, Nox, X1,
  Pulse, HoverQuad) stehen in der Werkhalle, obwohl das Spiel sie als
  Raumschiff führt. verify:hangar [1] und die Klinke `werkhalle` (41) zählen
  sie mit.

### Gegenproben [18] am Artefakt (25.10.2026)

Je eine Änderung an `dist/assets/hangar-viewer.js`, Lauf, zurückgesetzt:

- `werkBlende` umbenannt: „das Tor der Garage ist mal 1.2 groesser als der
  Durchgang, der Viewer baut keine Blende (werkBlende): Von innen saehe man
  neben und ueber dem Durchgang hinter die Nischenwand“
- `bahn.zurueck` [-60, 5], [-40, 5] und [-36,5, 5]: „bahn.zurueck (-40, 5)
  liegt nicht vor der Nische im Anflug (x -36.1..-26, Hoehe 2.4..6.55 m): Die
  Fahrt hinaus endete in der Nische, in ungeprueftem Raum oder ohne den
  Anstieg“. Die Vorderkante der Nische kommt aus ihrer Tiefe in
  `WORK_DEKO.nischen` (west, 14,9 m) ab der Rückwand `tuer.x`; zuerst prüfte
  die Regel nur ab der Mitte (x −44), ein Ende in der vorderen Hälfte der
  Nische ging durch (Hinweis aus dem Review)
- `bahn.zurueck` [-26, 1]: dieselbe Meldung (kein Anstieg)
- `garage.s` 1,05: „der Durchgang samt Rahmen (16.90 x 6.85 m) passt nicht
  ins offene Tor der Garage mal 1.05 (16.85 x 6.19 m frei)“, dazu raum,
  Grube/Spot und 54 Deckenstücke außerhalb der kleineren Garage
- `garage.s` 1,8: Formfehler „garage {id, x, vorn, s (1 bis 1,5)}“

Sauber: „ALLE ZUSICHERUNGEN ERFUELLT“.

## Decke wie Dumper's Depot, Hintergrund eine Spur heller (Krisz, 25.10.2026 12:33)

Krisz mit Bild der Cyclone in der Werkhalle: „so dass der hintergrund so
dunkel ist ist an sich gut, es könnte minimal heller sein, wir müssen aber
mehr decken assets machen, kabeln, röhre, geräte sowas halt damit es wie so
sagen wir mal bei dumbers depot aussieht yk“.

- **Hintergrund**: `WERK_WAND` ab 0,15 → 0,2, rest 0,07 → 0,1. Vier Stufen
  nebeneinander (a 0,07/0,15, b 0,09/0,15, c 0,1/0,2, d dazu mehr
  Grundlicht); c gewählt, die linke Wand im Startbild im Mittel 8,1 → 9,7
  (0–255), etwa 20 % heller, Bühne und Spot unverändert.
- **Deckenprofil** (senkrechte Strahlen je 0,5 m gegen die Garage):
  Mittelplatte x −86,5..−55,5, z ±8 bei 9,34 m; Seitenstreifen z ±9,5..12
  bei 8,25 m; Rinnen z ±12,75 bei 9,6 m; Bucht hinten x −91,5..−93 bei
  10,04 m. Kamera höchstens 7,3 m, also Unterkante jedes Stücks ab 7,6 m.
- **Was nicht trägt**: Stücke in der hinteren Bucht und in den Rinnen sieht
  man von keinem Kamerapunkt (Träger bei x −88 und die Seitenstreifen davor),
  sie sind wieder raus. Unbeleuchtete Geräte an den dunklen Wänden lesen sich
  nicht. `heater_large_1_b` trägt ein Material „screen“, das mit dem
  Lichtband als große weiße Fläche leuchtet: stattdessen 1_c und 1_d.
- **Was trägt**: Leuchtende Stücke. Deshalb Lampenreihen, die mit ihrem
  Lichtband (hgWkGlow nach x) von hinten nach vorn angehen; das macht auch
  das Einschalten deutlicher.
- **Lagen je Seite** (225 statt 86 Stücke, gebaut mit einem Planer gegen das
  gemessene Profil):
  - Luftrohr z ±7,2 mit 4 Leuchtbalken `light_hung_4_box_a` und 4
    Heizstäben `heater_hanging_1_a` darunter;
  - Lüftungskanal z ±5,6 mit 16 Hängeleuchten (`light_hung_1/2` im
    Wechsel, alle 2 m, nicht über den Stößen) und 3 Auslässen zur Mitte;
  - Wartungsschlauch jetzt z ±6,4, daneben kurze Kabelgirlanden
    (`cables_a_04x01x01_b`, z ±6,42 und ±2,58);
  - zweiter Kabelzug `cable_hanging_h` z ±2,85 mit Dosen;
  - Kettenzüge z ±4,6; Plattenheizer `heater_large_1_c/1_d` z ±3,45
    zwischen den Leuchtfeldern;
  - in der Mitte je ein Kabelzug vor und hinter dem Spot mit Dosen;
  - quer vor der Rückwand zwei Rohrbündel (x −89,5 und −90,4);
  - an Rück- und Seitenwänden Heizer und Schaltkästen (`relay_electrical_2/3`).
  Dreiecke im Raum der Werkhalle 359 800 → 557 300, je Material eine
  Geometrie (107 statt 76 Materialien der Halle samt Decke).
- **Prüfung** verify:hangar-hall [18]: misst jetzt die Decke der Garage in
  dist/ über der Achse jedes Stücks (Raster je 1 m, Punkte je ≤ 0,5 m). Ein
  Stück berührt sie auf 0,1 m und steckt auf höchstens einem Viertel der
  Punkte tiefer darin, oder es hängt an einem Stück darüber (Oberkante an
  dessen Unterkante, Mitte unter ihm). Vorher galt nur die Spanne der
  Deckenhöhen; ein Stück hätte unter der Platte schweben oder ganz im
  Seitenstreifen stecken können. Klinke `KLINKE_WERK.decke` 86 → 225.
  Selbstauskunft: „Decke 225 Stuecke (177 an der Decke, auf 1607 Punkten
  gemessen, 48 an einem Stueck darueber)“.

### Gegenproben [18] Deckenmessung (25.10.2026)

Je eine Änderung an `dist/assets/hangar-viewer.js`, Lauf, zurückgesetzt:

- Hängeleuchte bei x −81,5 von z 5,6 (unter dem Kanal) nach z 4,0: „1
  Stuecke falsch (prop_decke_light_hung_2_lamp_a bei x -81.50 z 4.00
  (Oberkante 8.179 m) beruehrt die Decke darueber nirgends (schwebt) und
  haengt an keinem Stueck)“
- Rohrbündel z 11,3 Oberkante 8,3 → 9,3 (in den Seitenstreifen): Der erste
  Lauf meldete das als „schwebt“, weil die Regel erst auf Berührung und dann
  aufs Stecken prüfte; umgestellt. Danach: „8 Stuecke falsch
  (prop_wand_roomsm_addon_pipe_bottom_a bei x -84.50 z 11.30 (Oberkante 9.3
  m) steckt auf 9 von 9 Punkten seiner Achse ueber 0,1 m in der Decke; …)“

Sauber: „ALLE ZUSICHERUNGEN ERFUELLT“.

## Lampen einzeln nacheinander, Spot am Ende (Krisz, 25.10.2026 18:12)

Krisz: „es sollen mehr lampen nacheinander angehen damit wir dieses
klassische effekt haben und spotlight am ende halt“.

- **Vorher gemessen** (Gladius → Cyclone TR): Licht an nach 4,1 s, fünf
  Bänder über 1,3 s (Anteile 0,05 bis 0,77 der Spanne bis zur Ankunft),
  jedes flackerte 0,9 s. So flackerten bis zu vier Bänder zugleich und
  verschwammen; der Spot kam bei der Ankunft (5,4 s), als die vorderen
  Bänder noch flackerten.
- **Jetzt**: `WERK.reihen` hat neun Bänder, je eine Lampenreihe der Garage
  (die Leuchtkörper stehen alle 4 m, Garage z 3 bis 35; abwechselnd zwei
  Deckenfelder in der Mitte und zwei Leuchten an den Seiten). Zu jeder
  Reihe gehören die Hängeleuchten der Decke darunter (2 bis 3 Paare). Je
  Band zwei Leuchten im Shader (`lampen.je` 2 statt 4); es sind dieselben
  18 Leuchtkörper wie vorher, das volle Licht bleibt gleich. Auf niedrig
  eine je Band, mal 1,45 statt 2,6.
- `WERK_STUFEN { abstand: 200, spot: 400 }`: Alle 200 ms geht ein Band an,
  von hinten nach vorn, der Spot 400 ms nach dem letzten. Die ganze Folge
  dauert 2,0 s ab dem Einschalten am Tor (4,1 s), der Spot kommt also rund
  0,7 s nach der Ankunft der Kamera (5,4 s). Zuerst 250/500 gebaut: Dann
  stand das Bild nach der Ankunft 1,2 s fast still (die letzten drei Reihen
  hängen über der Kamera), bis der Spot kam; mit 200 gehen die Reihen 1 bis
  7 noch während der Fahrt an. `WERK_FLICKER` ist jetzt ein kurzer harter
  Doppelschlag (voll nach 380 ms statt 900), damit höchstens zwei Reihen
  zugleich flackern. Den Spot setzt `werkLookIn` zusammen mit den Bändern,
  nicht mehr `werkIn` bei der Ankunft.
- **Prüfung** verify:hangar-hall [18]: Klinke `KLINKE_WERK.baender` 9; eine
  Reihe ist voll (letzter Punkt von WERK_FLICKER), bevor die übernächste
  kommt; der Spot mindestens 200 ms nach der letzten; Reihen und Spot
  zusammen höchstens `STUFEN_MAX` 3500 ms, gezählt bis der Spot voll brennt
  (mit dem Anlauf aus `WERK_SPOT_FLICKER`, 650 ms; jetzt 2650 ms; Hinweis
  aus der Durchsicht von PR #217) (Krisz 21.10.: Tempo vor Effekt).
  Ersetzt die Regel zu `WERK_ROWS_AT`.
- **Was man sieht**: Die Reihen 1 bis 7 gehen an, während die Kamera durchs
  Tor fährt und unter die Decke blickt, dort liest sich die Folge Leuchte
  für Leuchte. In der Endansicht (x ≈ -57) hängen die Reihen 7 bis 9 über
  oder hinter der Kamera; sie hellen nur den vorderen Boden auf. Probiert:
  kürzere Reichweite der Leuchten (10 und 12 statt 15 × Maßstab, Stärke
  ausgeglichen), damit jede Reihe einen eigenen Lichtfleck wirft. Der
  Unterschied je Stufe in der Endansicht blieb fast gleich (mittlere
  Änderung je Bild 1,7 bis 3,9 von 255), also bleibt die Reichweite.

### Gegenproben [18] Stufen (25.10.2026)

Je eine Änderung an `dist/assets/hangar-viewer.js`, Lauf, zurückgesetzt
(gefahren mit dem ersten Stand 250/500; die Regeln sind dieselben):

- altes Flackern (900 ms): „eine Lampenreihe ist erst nach 900 ms voll
  (WERK_FLICKER), die naechsten kommen alle 250 ms (WERK_STUFEN.abstand)“
- wieder fünf Bänder: „WERK.reihen hat 5 Baender, die Klinke verlangt 9“
- Spot 100 ms nach der letzten: „der Spot kommt 100 ms nach der letzten
  Reihe (WERK_STUFEN.spot): Unter 200 ms ginge er mit ihr an, nicht am Ende“
- abstand 500: „Reihen und Spot brauchen 4500 ms, hoechstens 3500“
- Spot läuft 2 s an (`WERK_SPOT_FLICKER` letzter Punkt 2000, Stand
  200/400): „Reihen und Spot brauchen 4000 ms, bis der Spot voll brennt
  (WERK_STUFEN, WERK_SPOT_FLICKER), hoechstens 3500“

Sauber: „ALLE ZUSICHERUNGEN ERFUELLT“.
