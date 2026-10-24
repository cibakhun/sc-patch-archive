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
