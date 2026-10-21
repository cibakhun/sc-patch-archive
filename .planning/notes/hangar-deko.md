# Hangar: Halle schwer dekorieren, mit Bedeutung (2026-10-21)

Auslöser für die PC-Sitzung: **„Hangar-Deko“**.

Anlass, Krisz 2026-10-21 14:00 (Projekt-Thread „Hangar-Deko mit
Spiel-Assets“): „okay mehr assets auch für hintergrund also nicht alles muss
um das schiff direkt herumstehen, wir dekorieren mal bisschen das hangar,
also nicht nur bisschen sondern heavy, hol viele assets, sowie wir das schon
gemacht haben mit semantik undso damit wir sie logischer platzieren können“.

Lesart:
- Die ganze Halle wird ausgestattet, nicht nur der Wartungsplatz am Schiff:
  die Streifen zwischen Feldrand und Wand (je Längsseite 12–16 m breit,
  96 m lang), die Stirnseiten, die Wände selbst.
- Viele neue Requisiten aus dem Spiel, mit Bedeutung wie im Katalog
  ([`hangar-katalog.md`](hangar-katalog.md) K2,
  [`hangar-requisiten.md`](hangar-requisiten.md) R1), damit die Cloud sie in
  Zonen stellt, die ein Spieler versteht: Lager, Fracht, Munition und
  Bauteile, Energie und Technik, Gas und Treibstoff, Werkstatt,
  Crew-Ecke, Sicherheit an der Wand.

Es gelten die Regeln von dort: Geometrie und Texturen aus dem Spiel; keine
Bilder, keine Roh-Exporte und kein `.mtl`-XML im Repo (es ist öffentlich);
ausgeliefert werden nur gebaute, verkleinerte Dateien.

## Was die Cloud heute hat (Katalog v2)

256 Requisiten in 14 Kategorien, davon nutzt der Wartungsplatz rund 60.
Was für eine große Halle fehlt, ist alles, was Fläche und Höhe füllt und
sofort nach Star Citizen aussieht: Frachtkisten in SCU-Größen, Regale,
Spinde und Crew-Möbel, Bauteile, große Maschinen, Wandleitungen,
Bodenmarkierungen für Zonen. Werkzeugwände und Stützen gibt es laut R2 im
Spiel nicht als Requisit; das gilt weiter.

Die Arbeitsplätze im Katalog nennen ihre Mitglieder, aber nicht, auf
welcher Seite die Wand steht. Für Plätze an der Wand braucht die Cloud das.

## Auftrag PC

1. Eigener Worktree oder Branch `pc/hangar-deko` von
   `origin/claude/project-thread-0h9tau` (dort liegt diese Notiz). Die
   Spielquellen liegen wie zuletzt unter `.cache` des Hangar-Worktrees.

### D1. Mehr Fundorte

2. Zu den 111 Hangar-socpaks aus K1 dazu, soweit es sie gibt:
   - Verteilzentren und Lagerhallen (Hallen mit Regalreihen und
     Frachtstapeln);
   - Frachtdecks und Hangars der Stationen;
   - Hangars und Frachtbereiche der Landezonen;
   - Ladenflächen für Schiffsteile (Dumper's Depot, Teach's, Cousin Crow's
     o. ä.), wegen der Bauteile.
   Je Fundort zählen wie in K1 (Brushes aus der .soc, Entities aus dem XML).

### D2. Neue Requisiten (mindestens 80, je Kategorie mindestens 5)

3. Neue Kategorien, je eine Datei `public/hangar/props/<kategorie>.glb`:
   - **`fracht`**: Frachtkisten in den SCU-Größen 1, 2, 4, 8, 16, 24, 32 im
     Standardlook, dazu zwei, drei Varianten, die in Frachtdecks häufig
     stehen; Frachtpaletten und -gitter.
   - **`regal`**: Schwerlast- und Palettenregale, Wandregale, Regalreihen,
     wo das Spiel sie bestückt hat auch die bestückte Fassung.
   - **`crew`**: Spinde, Bänke, Tische, Hocker und Stühle, Wasserspender,
     Kaffee- oder Getränkeautomat, Mülleimer. Sitze waren bisher
     ausgeschlossen (`NOT_PROP`); hier gehören sie dazu.
   - **`bauteile`**: Schiffsbauteile als Gegenstand, je ein Kraftwerk,
     Kühler, Schildgenerator und Quantenantrieb in S1 bis S3 (Geometrie des
     Items), dazu Kisten und Ständer für Bauteile und Triebwerke, wo es sie
     gibt.
   - **`maschine`**: große Geräte: der ATLS-Lastenanzug geparkt (falls als
     Requisit oder Fahrzeug ohne Fahrer exportierbar), Schlepper oder
     Zugmaschine, Hub- und Scherenbühnen, fahrbare Arbeitsbühnen und
     Gerüste, Brücken- oder Portalkran mit Haken, Tankwagen.
   - **`wand`**: was an Wänden hängt: Rohr- und Kabeltrassen, Schalt- und
     Verteilerkästen, Steuerpulte, Monitore und Infotafeln, Warn- und
     Hinweisschilder.
   - **`decke`**: Kabeltrassen, Lüftungsrohre, Hängeleuchten der
     Werkstatt, Kettenzüge.
4. **Boden.** Decals für Zonen und Wege, wie sie in Hallen liegen:
   Gelb-Schwarz-Schraffur, Linien, Pfeile, Ziffern, Parkfelder,
   Abflussgitter; dazu weitere Öl-, Reifen- und Schleifspuren. Als
   `public/hangar/props/boden.glb`, Knoten `decal_<name>` wie in
   `werkstatt-boden.glb` (Einheitsquadrat oder Spiel-Mesh, Größe in der
   JSON).
5. Grenzen wie K4: ein Requisit ≤ 8 000 Dreiecke, große ≤ 20 000; je Datei
   ≤ 3 MB; Draco, WebP; Farbe ≤ 1024 px, Normalen und Masken ≤ 512 px.
   Materialien vollständig wie R1 (alle Schichten, Blend-Map,
   Detailkarten unter `schichten/`, `COLOR_0`, Metalle).

### D3. Bedeutung je Requisit

6. Wie K2 (Spielname, Beschreibung, Typ, Tags, Aufstellung, Nachbarn,
   Zweck und Nutzung, `quelle`). Für alle Requisiten, auch die alten 256,
   neu dazu:
   - **`zone`**: wo in einer Halle, gezählt über alle Aufstellungen:
     `feldrand` (≤ 6 m vom Feld), `halle` (weiter weg, frei), `wand`
     (≤ 1,5 m von einer Wand), `ecke` (≤ 3 m von zwei Wänden), `decke`,
     `tor` (≤ 8 m vom Hallentor). Je Zone der Anteil.
   - **`stapel`**: worauf es steht (Boden, Palette, Kiste, Regalboden: Knoten
     und Höhe) und was darauf steht; bei Frachtkisten die übliche
     Stapelhöhe.
   - **`reihen`**: wo es in Reihen steht (Regale, Kisten): Abstand in der
     Reihe, Länge der Reihe, Gangbreite dazwischen.

### D4. Zonen aus den Spielhallen

7. Wie K3, aber größer: Gruppen, deren Requisiten näher als 6 m
   zueinander stehen (Lagerzone mit Regalen, Stapler und Paletten;
   Frachtstapel; Crew-Ecke). Je häufiger Zusammensetzung ein Vertreter aus
   dem Spiel mit Mitgliedern in **Platzkoordinaten mit Wandseite**:
   +z zeigt zur nächsten Wand, z = 0 ist die Wand, Drehung 0 heißt
   Vorderseite des Spiels (−z) zur Halle. Liegt keine Wand näher als 3 m,
   steht `wand: null` und die Achse zeigt zum Feld.
8. Dasselbe nachträglich für die 39 Arbeitsplätze im Katalog: Vertreter in
   Platzkoordinaten mit Wandseite, sonst unverändert.

### D5. Dateien und Abschluss

9. `katalog.json` auf `v: 3`: neue Kategorien, `zone`, `stapel`, `reihen`,
   `zonen` (D4) neben `arbeitsplaetze`. Was `scripts/build-hangar-dienst.mjs`
   liest (`props[].node`, `file`, `size`, `materials`, `schichten`), bleibt,
   wie es ist. Manifest wie bisher, dazu `props.boden`.
10. Am PC alle neuen Dateien als Galerie rendern und ansehen (nicht
    committen): Texturen, Tönung, nichts schwebt, nichts steht im Boden.
11. `npm run build && npm run gate`, normal und mit `STAGING=1`.
12. **Selbstauskunft** hier unter „Befund PC“: je Kategorie Requisiten,
    Dreiecke, Bytes; je Fundort aus D1, was er beigetragen hat; Zonen aus
    D4 mit Zahl und Hallen; was es im Spiel nicht gibt, klar sagen.
13. Push auf `pc/hangar-deko`, ohne PR. Einbau in die Halle, Packen und
    Vorher/Nachher macht die Cloud.

## Cloud (läuft parallel)

- Hallendeko aus dem Katalog v2, ohne auf den PC zu warten: Zonen an den
  Längsseiten und Stirnseiten, Sicherheit an den Wänden, gepackt wie der
  Wartungsplatz (ein Zeichenbefehl für alle flachen Teile).
- Mit dem PC-Stand: die neuen Kategorien in dieselben Zonen.

## Befund PC

=== Katalog v3 · 355 Requisiten in 21 Kategorien (vorher 256 in 14), dazu `boden.glb` mit 57 Decals · Branch `pc/hangar-deko` ===

Geändert sind `scripts/extract-hangar-katalog.mjs` (Auszug fast neu) und
`buildKatalog` in `scripts/build-hangar-assets.mjs`. Der Werkstatt-Bau gibt
seinen Decal-Teil jetzt an `decalMaterial()` und `quadPrim()` ab; die
Werkstatt-Dateien bleiben dabei byte-gleich.

**Was gleich bleibt.** Die 14 alten Kategorie-Dateien sind byte-gleich, ebenso
alle Karten unter `schichten/` und alle 684 Materialwerte aus v2. Knoten,
`file`, `size` und `materials` der alten 256 Requisiten sind unverändert.
`dienst.glb` habe ich nur neu gepackt, weil der Fingerabdruck auf `katalog.json`
zeigt (Tor [14]); Bytezahl und Schichtkarte sind gleich geblieben.

**Wie der Auszug auswählt.** Bestand ist der Katalog im Repo. Was dort steht,
bleibt mit Kategorie, Knoten und Reihenfolge; neu gewählt werden nur die
sieben Kategorien der Hallendeko. Läuft der Auszug ein zweites Mal auf dem
eigenen v3-Katalog, wählt er nichts dazu. Der Bau kommt dann byte-gleich
heraus, GLBs wie `katalog.json` (geprüft).

### D1. Fundorte

Gelesen aus `.cache/socpak-all` (alle 9 668 socpaks, einmal ausgepackt). Je
Fundort zählen die Wurzeln und jeder Kind-Container, den sie nennen
(`<ChildObjectContainers>` im socpak-XML). Jedes socpak zählt einmal, auch wo
das Spiel es mehrfach einsetzt.

| Fundort | Wurzeln | socpaks mit .soc | Brushes | Entities | Requisiten | Arten | neue Requisiten von dort | häufigste Kategorien |
|---|---|---|---|---|---|---|---|---|
| Hangars (wie K1) | – | 111 | 102 715 | 17 434 | 11 656 | 292 | 32 | kabel, wand, reinigung, sicherheit |
| Verteilzentren (`ugf/util/layout/dc_*`) | 33 | 132 | 103 756 | 17 377 | 16 267 | 759 | 60 | lager, fracht, crew, decke |
| Lagerhallen (`fob/util/compound/warehouse`, `cargo`, `ht_freight`) | 43 | 39 | 8 196 | 1 615 | 1 559 | 221 | 19 | lager, fracht, crew, reinigung |
| Frachtdecks (Cargo-Hubs der Stationen, Levski-Frachtdeck, Rastplatz-Fracht, Cargo-Büros) | 32 | 38 | 25 506 | 2 642 | 6 539 | 591 | 51 | lager, regal, reinigung, decke |
| Stations-Hangars (Stationsmodule, Rastplätze, Asteroidenbasen) | 30 | 72 | 26 281 | 2 935 | 4 956 | 382 | 27 | kabel, reinigung, lager, schlauch |
| Landezonen (Raumhäfen `*_sp_int`, Frachtaufzüge der Hangars, TDD) | 21 | 30 | 18 468 | 4 573 | 2 194 | 254 | 27 | crew, lager, decke, wand |
| Läden für Schiffsteile (Dumper's Depot, Teach's, Cousin Crow's, Omega Pro, Hardpoint, Platinum Bay u. a.) | 31 | 36 | 13 602 | 2 981 | 2 617 | 487 | 34 | lager, reinigung, crew, regal |

„neue Requisiten von dort“ zählt die neuen Stücke, die mindestens einmal an
diesem Fundort stehen. Zusammen sind es 458 Hallen, 312 411 Objekte und
45 788 Requisiten in 1 434 Arten.

Drei Fallen im Spiel, im Auszug gelöst:
- **Gedrehte Weltboxen.** 214 von 458 .soc sind nicht sauber. 83 davon haben
  unter drei Brushes. In den übrigen 131 streut Mitte − Lage der Requisiten
  über 0,5 m: Die Weltbox ist dort gedreht, nicht nur verschoben. In
  `util_a/hangar_medtop_001` sind es über 100 m. Wand- und Stapelboxen wären dort falsch. Darum
  lernt der Auszug je Geometrie die lokale Box aus den 244 sauberen .soc
  (7 090 Modelle). Jede Box ist dann die Hülle der gedrehten lokalen Box.
  Bei schräg gedrehten Brushes trifft das die Weltbox mit 0,000 m im Median.
  So haben 255 380 Brushes eine Box; 30 792 behalten die Weltbox einer
  sauberen .soc, 12 352 haben keine. Nebenbei betrifft das auch die
  Wandabstände von K2.
- **Wände in großen Modulen.** Wandbildschirme und Leitstände stecken oft in
  der Box eines riesigen Moduls (Eingangsmodul 56 × 20 × 65 m). Wände sind
  darum zweierlei:
  - Bauwände: aufrecht, dünn und ≥ 3,5 m lang. Die Wandseite ergibt sich aus
    dem Spalt zum Stück, nicht aus dem Seitenverhältnis der Box.
  - Wandgeräte als Zeugen (1 687 Stück): Feuerschlauch, Feuerlöscherschrank,
    Verteilerdose, Wandbildschirm, Wegweiser. Ihre Rückseite ist die
    Wandfläche, ±4 m entlang.

  Probe, an Stücken mit bekannter Lage:

  | Stück | an Wand oder Ecke, vorher (nur Bauwände) | jetzt |
  |---|---|---|
  | Feuerlöscherschrank | 52 % | 95 % |
  | Wandbildschirm `display_video_wall_2_a` | 2 % | 81 % |
- **Böden auf Galerien.** Leitstände stehen auf Böden aus anderen Containern
  (Stühle auf 20 m, darunter kein Brush). Als Ebene gilt darum jede Höhe, auf
  der mindestens drei aufrechte Bodenstücke stehen. Die Höhe eines Stücks
  zählt über die Requisiten, auf denen es steht, bis zum Boden.
  - Schreibtischstühle liegen dadurch bei 0 m statt 17,5 m.
  - Monitore liegen bei 0 bis 1,1 m statt 14 m.
  - Die alte `aufstellung.decke` von `computer_monitor_1_a` (93 Fälle) waren
    solche Büros.

**Vorderseite geprüft.** Lokale +Y des Spiels zeigt bei Wandgeräten von der
Wand weg, im GLB −z; `front: "-z"` stimmt. Belegt an der Matrix: Schräg
gedrehte Boxen passen nur so, transponiert nicht. Belegt auch an den
Flächennormalen offener Wandgeräte (Feuerlöscherschrank −0,71 in z).

### D2. Neue Requisiten: 99 in 7 Kategorien

| Kategorie | Requisiten | Dreiecke | Bytes | größtes Stück (Dreiecke) |
|---|---|---|---|---|
| fracht | 18 | 116 677 | 2 330 136 | `cargo_multipurpose_1_025x025x1_a` (16 189) |
| regal | 14 | 80 776 | 1 903 248 | `storage_rack_1_02x0575x08_a` (19 578) |
| crew | 18 | 55 954 | 2 962 996 | `table_bar_table_2_watertank_a` (7 797) |
| bauteile | 12 | 174 327 | 1 503 020 | `shld_basl_s03_pl02` (19 448) |
| maschine | 9 | 80 059 | 2 050 232 | `uee_lawless_prop_hcrane_01` (17 814) |
| wand | 16 | 40 780 | 2 927 180 | `relay_electrical_2_a` (7 328) |
| decke | 12 | 11 423 | 984 396 | `light_hung_1_lamp_a` (2 135) |

Herkunft der 99:
- 53 stehen in den neuen Fundorten, 29 in den Hangars;
- 5 kommen aus dem Archiv (SCU 24 und 32, Hubbühne, Hubplattform, Stapler);
- 12 sind Items.

Grenzen eingehalten: ≤ 8 000 Dreiecke je Stück, große Geräte, Regale,
Bauteile und Container ab 8 SCU ≤ 20 000; je Datei ≤ 3 MiB. Draco, WebP,
Farbe 1024, Normalen und Masken 512, Materialien vollständig wie R1, `COLOR_0`.

- **fracht:**
  - Standardkiste in allen SCU-Größen: `cargo_multipurpose_1_*` 1, 2, 4, 8, 16,
    24, 32 SCU. Im Spiel heißt sie „Stor*All … Self-Storage Container“.
  - Dazu die häufigsten Kisten der Frachtdecks und Verteilzentren:
    - `crate_dry_1_0125x0125x0125_a/b/c` (924, 161, 105 Aufstellungen) und
      die Stapelfassungen;
    - `crate_metal_4`, `container_dry_3`, `storage_container_1`;
    - `shipping_container_1`, `hurston_freight_container_a`.
  - Frachtpalette `pallet_shipping_1_025x0125x0025_a`.
  - Ein „Frachtgitter“ als Requisit gibt es nicht. Das Bodengitter der
    Frachtregale ist `cargo_rack_floor_1_a` (unter regal).
- **regal:**
  - Das Frachtregal der Frachtdecks und Verteilzentren als Bausatz:
    `cargo_rack_1_a`, `_slot_`, `_floor_`, `_end_`, `_cap_bottom/middle/top_`.
  - Lagerregale `storage_rack_1_*`, `storage_rack_shelf_03_a`,
    Wandregal `shelf_wall_1_a`, Schwerlastregal
    `uee_lawless_prop_shelf_storage_large`, Bauteilregal
    `rack_storage_1_shelf_*` (Entity `display_components_s2_modular`),
    `server_rack_1_c`.
  - Eine bestückte Fassung gibt es nicht als eigene Geometrie:
    `ugf_cargo_rack_slot_1_occupied_a` und `…_empty_a` nutzen dieselbe
    `cargo_rack_slot_1_a.cga`, die Ladung setzt das Spiel zur Laufzeit.
- **crew:**
  - Spinde `storage_locker_keypad_1_a`.
  - Bänke `util_seat_bench_2_mid_a` und zwei Bausätze (Lobby links, Mitte,
    rechts; Sicherheitsbank Anfang, gerade, Ende).
  - Tische `table_bar_table_2_watertank_a/b` (IBC-Tank als Stehtisch, so
    stehen sie im Spiel), Hocker `steat_stool_1_a`.
  - Stühle `seat_desk_1_b`, `console_desk_1_chair`, Kistensitz
    `seat_improvised_box_*`.
  - Wasserspender `machine_water_cooler_1_a`, Getränkeautomat
    `machine_vending_01x01x02_a`.
  - Mülleimer `waste_bin_1_a`, `waste_trashcan_3_a`.
- **bauteile:** Je Art die Familie eines Herstellers mit S1, S2 und S3. Name,
  Beschreibung und `groesse` stehen im Katalog.

  | Art | S1 | S2 | S3 |
  |---|---|---|---|
  | Kraftwerk (Aegis) | Charger | Bolide | Centurion |
  | Kühler (Aegis) | Bracer | Arctic | Blizzard |
  | Schildgenerator (Basilisk) | Bulwark | Armada | Barbican |
  | Quantenantrieb (ArcCorp) | Burst | Cascade | Echo |

  Die Geometrie kommt per `entity export` (die meisten Bauteile sind `.cga`,
  die `skin export` nicht kann). Die Untermaterialien sind über ihren Namen
  zugeordnet. Kisten oder Ständer für Triebwerke gibt es nicht; die
  Bauteil-Auslage von Dumper's Depot steht schon unter munition, das
  Bauteilregal unter regal.
- **maschine:**
  - Scherenhubbühne `lift_scissor_1_a`, Hubplattform
    `col_lift_platform_small_a`.
  - Gabelstapler `forklift_machine_1_a`, elektrischer Palettenhubwagen
    `trolley_pallet_powered_1_a`.
  - Portalkran mit Haken `uee_lawless_prop_hcrane_01`, Mobilkran `crane_1_a`.
  - Baugerüst aus Fuß, Mittelteil und Kopf.
- **wand:**
  - Verteilerkästen `relay_electrical_1/2/3_a`, Sicherungskästen
    `fuse_mounted_1_b/c`.
  - Wandbildschirme `display_video_wall_2_a`, `_3_a`, `_3_screen_1_a`,
    Steuerpult `console_desk_2_extra_screens_a`.
  - Wegweiser `nav_sign_3_*`, `nav_sign_9_*`.
  - Rohre `roomsm_addon_pipe_bottom_a/b`, `pipe_air_processing_1_straight_*`,
    Kabelanschluss `cable_terminal_2_wall_a`.
- **decke:**
  - Lüftungskanäle `addon_hvac_*` (gerade, Bogen, Auslass).
  - Hängeleuchten `light_hung_1/2_lamp_a`, `light_hung_4_box_a`.
  - Seilrollen mit Seil `nd_addon_a_pulley_*` (Kettenzug).
  - Hängekabel `cable_hanging_h`, Hängeschild `cable_sign_hanging_b`.

**Farbpalette.** Die Lackschichten der Standardkiste tragen `PaletteTint` 1–3
mit weißer `TintColor`; im Spiel kommt die Farbe aus der Palette der Entity
(`storall_cargo_default`: A dunkelgrau, B grau, C orange).
- Für die Kategorien der Hallendeko liest der Auszug die Palette aus DataCore
  (`Components[SGeometryResourceParams].Geometry.Geometry.Palette`).
- Der Bau tönt die Grundschicht damit und hängt den Paletten-Namen an den
  Materialnamen. In `materials[].palette` stehen alle drei Einträge (linear).
- Die SCU-Reihe nimmt einheitlich die Palette der 1-SCU-Kiste; 16 bis 32 SCU
  gibt es im Spiel nur mit Warenfarben.
- Die alten Kategorien lasse ich, wie sie sind. Auch dort tragen einige
  Schichten `paletteTint` (Werte stehen in `materials`), getönt ist nichts.
- Die meisten neuen Stücke haben keine Palette. Im Spiel stehen sie als
  Brushes, deren Palette die Dateien nicht nennen.

**Boden** (`props/boden.glb`, 2 827 040 Bytes, 57 Knoten `decal_<rolle>_<name>`):
- 28 projizierte Decals als Einheitsquadrat, die Kante im Spiel steht unter
  `size`:
  - Öl 5;
  - Linien 6;
  - Felder und Ecken 4;
  - Reifenspuren 3;
  - Pfeile 3;
  - Schraffur 2;
  - Schleifspuren 2;
  - Markierung 2;
  - Ziffer 1.
- 29 Boden-Meshes des Spiels:
  - Ziffern 0–9 (`secondary_number_*`; 4–8 liegen in keiner Halle und kommen
    aus dem Archiv);
  - Gelb-Schwarz-Linien und Landefeld-Schraffuren 5;
  - Linien 1–8 m 5;
  - Parkfelder und Ecken 4 (darunter das 6 × 10 m-Feld
    `roomsm_floor_decal_06x12x0025_a`);
  - Abflussgitter und Bodenroste 3 (`trench_cover_1_b/d`,
    `roomsm_floor_grate_02x04x0025_a`);
  - Pfeile 2.
- Öl-, Reifen- und Schleifspuren, die schon in `werkstatt-boden.glb` stehen,
  sind nicht doppelt.
- Weggefallen: sechs Mesh-Kandidaten, die im Export keine eigene Farbkarte
  tragen. Das sind die Abflussdeckel `util_decal_floor_set_a_*` der
  Verteilzentren und drei Eckmarken.

### D3. Zone, Stapel, Reihen

Für alle Requisiten mit Aufstellung im Spiel; die Definitionen stehen in
`hinweise`.
- `zone`: 286 von 355. Die übrigen sind Archivstücke und Items.
  - Beispiele: Feuerlöscherschrank wand 78 %, ecke 17 %; Kistenreihen halle
    90 %; Hängeleuchte decke 94 %.
  - Wandgeräte über 2,6 m zählen als decke (Vorrang).
- `stapel`: 272. Brushes mit Box, worauf und was darauf.
  - Ohne Träger auf Bodenhöhe heißt `boden`: Der Boden liegt dann in einem
    anderen Container.
  - Kisten: Säulen bis 3 (`crate_dry_1`, Stor*All 1 SCU) und 4
    (`crate_metal_4`, `container_dry_3`). Die Stor*All-Kiste steht zu 64 % auf
    dem Boden, zu 18 % auf ihresgleichen.
- `reihen`: 59.
  - Spinde: 29 Reihen zu 5, Abstand 0,625 m.
  - Frachtregal `cargo_rack_1_a`: 31 Reihen, Teilung 2,12 m, Gang 9,5 m.
  - Kisten `crate_dry_1`: 30 Reihen, Teilung 1,29 m, Gang 4,75 m.
  - Bänke: 87 Reihen, 0,99 m.

### D4. Zonen und Plätze

**Zonen:** 1 634 Gruppen (< 6 m) in 67 Zusammensetzungen mit mindestens drei
Gruppen. Je Zusammensetzung ein Vertreter mittlerer Größe in
Platzkoordinaten.
- 32 Vertreter mit Wand, 9 mit Achse zum Feld, 26 mit Hallenachsen.
- 5 Vertreter haben eine Ecke.

| Zone | Gruppen | Hallen | häufigste Fundorte | Vertreter | Stück | Achse |
|---|---|---|---|---|---|---|
| lager | 228 | 69 | Verteilzentrum 145, Frachtdeck 31, Stations-Hangar 16 | `struct_m_ind_shp_001_occu_001` | 13 | Halle |
| crew | 176 | 39 | Verteilzentrum 111, Laden 29, Landezone 16 | `crusader_showroom_ext` | 6 | Halle |
| fracht | 109 | 20 | Verteilzentrum 99 | `hangar_smlfrnt_003_gm` | 6 | Halle |
| reinigung | 102 | 36 | Hangar 61, Stations-Hangar 24 | `dealership_rundown_001` | 8 | Wand |
| sicherheit+treibstoff | 97 | 31 | Hangar 82, Stations-Hangar 14 | `ab_collector_hangar_xltop_001` | 3 | Wand |
| fracht+lager | 94 | 36 | Verteilzentrum 72, Frachtdeck 10 | `cargo_hub_003_rund_001_nyx` | 8 | Wand |
| sicherheit | 73 | 35 | Hangar 48, Verteilzentrum 17 | `ab_collector_hangar_xltop_001` | 3 | Wand (Wandgerät) |
| crew+lager | 67 | 32 | Verteilzentrum 23, Landezone 15, Hangar 13 | `astroarmada_area18_int` | 16 | Halle |
| kabel | 54 | 30 | Hangar 47 | `ab_collector_hangar_xltop_001` | 3 | Feld |
| crew+diagnose | 49 | 41 | Hangar 34, Landezone 8 | `ab_collector_hangar_xltop_001` | 14 | Feld |
| lager+reinigung | 44 | 25 | Hangar 20, Stations-Hangar 8 | `hangar_lrgtop_002_rest_rund` | 11 | Feld |
| kabel+sicherheit+transport | 39 | 23 | Hangar 31, Stations-Hangar 8 | `ab_collector_hangar_xltop_001` | 3 | Wand |

**Arbeitsplätze:** Die 39 aus K3 stehen wörtlich wie in v2 im Katalog; neu
ist `platz`.
- Gefunden über Halle und Mitglieder in den neu gebildeten Hangar-Gruppen,
  alle 39.
- 25 mit Wand, davon 8 mit Ecke und einer über ein Wandgerät; 12 mit Achse
  zum Feld, 2 mit Hallenachsen.
- Die Leitungen bleiben ebenfalls wie in v2.

### D5. Dateien und Prüfung

- `katalog.json` `v: 3`, 2,8 MB (gzip 0,26 MB). Die Seite liest sie nur beim
  Bauen, nicht im Browser.
- Neue Schlüssel: `zonen`, `boden`, `fundorte`; je Requisit `zone`, `stapel`,
  `reihen`, `fundorte`, bei Bauteilen `groesse`; je Arbeitsplatz `platz`; je
  getöntem Material `palette`.
- Manifest: `props.boden` `{ url, v, bytes, decals }`, `props.katalog` wie
  bisher mit 21 Kategorien.
- Dateigrößen: alle neuen Dateien unter 3 000 000 Bytes.
  `munition.glb` (3 130 876, unverändert seit v2) liegt weiter knapp über
  3 000 000, unter 3 MiB.
- **Sichtprüfung am PC** als Galerie, für alle 7 neuen Kategorien und den
  Boden, mit Chrome ohne Fenster; die Bilder sind nicht committet.
  - Texturen und Tönung sitzen; die SCU-Reihe trägt den Stor*All-Look,
    Kraftwerke, Kühler, Schilde und Quantenantriebe ihre Herstellerfarben.
  - Alles steht mit der Unterkante auf 0.
  - Die Langseiten der 32-SCU-Kiste nehmen Eintrag B (grau), so ordnet es ihre
    `.cgfm` zu.
- **Tore:** `npm run build && npm run gate` grün (28/28), mit `STAGING=1`
  ebenfalls; die Laufzeilen stehen in der Commit-Botschaft.

### Was es im Spiel nicht gibt (oder nicht brauchbar)

- **ATLS:**
  - Er lässt sich nur als Figur mit Skelett exportieren (`ARGO_ATLS`, `.cdf`).
  - Unter 20 000 Dreiecken bleibt nur LOD 3 (15 839), und dort zerfällt das
    Netz, die Schichten bleiben weiß. LOD 2 hat 41 548.
  - Nicht im Katalog.
- **Schlepper oder Zugmaschine, Tankwagen:** Es gibt kein Requisit und kein
  Fahrzeug. Gesucht habe ich nach tug, tow, tractor, baggage, tanker, bowser,
  fuel truck und fuel cart.
- **Kaffeemaschine:** `hangar_business_v2_coffeemachine` ist ein ganzes
  Hangar-Café mit Säulen und Tresen. Eine einzelne Maschine gibt es nicht.
- **Warnschilder:**
  - Als Requisit gibt es nur drei Tafeln eines alten Schießstands
    (`brush/planet/uee/shooting_range/*_panel_sign_01`). Deren Decal-Karte
    fehlt im Archiv; sie sind nicht im Katalog.
  - Als Hinweisschilder dienen die Wegweiser.
  - Schon im Katalog: das freistehende Warnschild (`sign_warning_1_freestanding_a`).
- `machine_vending_1_a` ist nur das Blechgehäuse eines Automaten; dafür steht
  `machine_vending_01x01x02_a` im Katalog.
- **Werkzeugwand:** R2 hat in den `prop`-Ordnern nichts gefunden. Außerhalb
  davon gibt es `buildingsets/human/universal/engineering/uee_tool_rack_1.cgf`.
  Ich habe es nicht angesehen und nicht aufgenommen.
