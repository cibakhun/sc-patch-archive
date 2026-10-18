# Hangar: Gerätekatalog mit Bedeutung (2026-10-18)

Auslöser für die PC-Sitzung: **„Hangar-Katalog“**.

Anlass, Krisz 2026-10-18 (über den Projekt-Chat):

- 10:16: „das rohr ist durchsichtig, die assets sind allgemein zu wenige,
  und sind nicht belivable plaziert“
- 10:26 (Draufsicht einer Fury MX): „hier nochmal wegen believable“
- 10:32: „ich möchte dann ausserdem dass du viel mehr assets holst und die
  semantik von denen auhc mit speicherst, also was macht man damit, wofür
  ist es da etc so dass wir die assets nacher besser nutzen können und
  nicht nur random“

Lesart, ihm so gesagt und nicht korrigiert:
- Es sollen deutlich mehr Werkstatt-Requisiten aus dem Spiel kommen.
- Zu jedem Requisit gehört seine Bedeutung: was es ist, wofür man es
  braucht, wie man es benutzt, wo es im Spiel steht und womit es
  zusammengehört.
- Die Cloud stellt danach nach Bedeutung auf statt nach Zufall:
  - Schläuche und Kabel laufen vom Generator oder Tank zum Schiff.
  - Werkzeug und Wagen stehen gruppiert an Arbeitsplätzen.
  - Wandgerät hängt in Gruppen.
- Die Crew ist ihm vorerst egal.

Es gelten die Regeln aus [`hangar-werkstatt.md`](hangar-werkstatt.md):
- Regel 10-07: Geometrie und Texturen aus dem Spiel.
- Keine Bilder, keine Roh-Exporte und kein `.mtl`-XML committen; das Repo
  ist öffentlich.
- Ausgeliefert werden nur gebaute, verkleinerte Dateien.

`werkstatt.glb` und `werkstatt.json` bleiben unverändert, denn der Viewer
liest sie heute. Alles Neue kommt in neue Dateien.

## Was die Cloud heute hat und was fehlt

- 25 Requisiten aus `util_a hangar_medtop_002`, je mit Rolle, Maßen und
  Häufigkeit. Die Anordnung dieser einen Halle wird auf unser Feld
  gestaucht.
- Es fehlen:
  - die Bedeutung (Zweck, Benutzung, Zusammengehörigkeit);
  - Anschlusspunkte (wo ein Schlauch oder Kabel ansetzt);
  - die Regeln, nach denen das Spiel Gerät zu Arbeitsplätzen gruppiert.
- Darum wirkt es verstreut: Ein Schlauch liegt allein an der Wand,
  Kisten stehen weit vom Schiff.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.

### K1. Mehr Requisiten finden

2. Alle Requisiten in den 87 schon ausgepackten Hangar-socpaks (`util_a`,
   VFG Industrial, Self-Land, Asteroidenbasis), dazu Werkstattgerät aus
   dem Archiv, das in Hangars fehlt. Beispiele dafür: `workbench_mobile`,
   `crane_welding_arm`, `trolley_creeper`, `generator_oxygen`, Werkzeugkisten
   und -schränke, Leitern, Absperrungen, Feuerlöscher, Wartungsterminals,
   Lampen auf Ständern, Pumpen, Kanister.
3. Im Katalog stehen alle Fundstücke, die etwas mit Wartung, Energie,
   Treibstoff, Luft, Werkzeug, Diagnose, Transport, Lager, Heben, Reinigung
   oder Sicherheit zu tun haben.
4. Exportiert werden mindestens 60 Requisiten. Den Vorrang haben:
   - alles, was in Hangars mindestens dreimal steht;
   - die Fundstücke aus Punkt 2;
   - Kabel- und Schlauchstücke in allen Längen und Biegungen, die es gibt
     (gerade, Bogen, Ende mit Stecker), damit sich Leitungen von einem
     Gerät zum Schiff zusammensetzen lassen.

### K2. Bedeutung je Requisit, so weit wie möglich aus den Spieldaten

5. Zu jedem Requisit, in dieser Reihenfolge der Quellen:
   - **Spielname und Beschreibung** aus der Lokalisierung (Schlüssel der
     Entity oder des Items, Englisch wörtlich; Deutsch, wenn vorhanden).
   - **Klasse, Typ, Untertyp, Tags** aus den Datensätzen der Entity, dazu
     Benutzungspunkte (Interaction Points, „use“, „pickup“, tragbar ja/nein).
   - **Anschlusspunkte** aus Helfern, Sockets und Knochen des Modells
     (Stecker, Ports, Schlauch- und Kabelenden): Name, Lage und Richtung im
     Requisitenraum, Art (Strom, Treibstoff, Luft, Daten, Wasser), soweit
     der Name sie verrät.
   - **Aufstellung im Spiel**, gezählt über alle Hangars:
     - Boden, Wand, Regal, Tisch oder Decke, mit Höhe;
     - Abstand zum Feldrand und zur nächsten Wand (Median und Spanne);
     - Ausrichtung zum Feld (zugewandt, abgewandt, längs).
   - **Nachbarn:** welche Kategorien und Requisiten in 3 m Umkreis stehen,
     mit Anteil der Aufstellungen und mittlerem Abstand. Zum Beispiel:
     Kabeltrommel neben Generator in x %.
6. Erst danach, deutlich als abgeleitet markiert: **Zweck** und
   **Benutzung** in einem Satz. Zum Beispiel: „mobiler Generator, versorgt
   Gerät am Schiff mit Strom; steht am Feldrand, Kabel laufen zur
   Kabeltrommel und zum Schiff.“ Abgeleitet heißt: aus Name, Beschreibung,
   Tags und Aufstellung geschlossen. Was sich nicht schließen lässt, bleibt
   leer.

### K3. Arbeitsplätze und Leitungen aus den Spielhallen

7. **Arbeitsplätze:** In den 87 Hangars Gruppen finden, in denen Requisiten
   näher als 2,5 m zueinander stehen. Je Gruppe:
   - Mitglieder mit Lage und Drehung relativ zum Gruppenmittelpunkt;
   - Halle;
   - Abstand zum Feldrand, Boden oder Wand.
   Häufige Zusammensetzungen zusammenfassen, zum Beispiel „Generator +
   Kabeltrommel + Diagnose“ in n Hallen, mit einem Vertreter aus dem Spiel.
8. **Leitungen:** Wo Kabel- oder Schlauchstücke liegen: die Kette der
   Stücke (Reihenfolge, Lage, Drehung), ihre Länge, und welche Requisiten
   an ihren beiden Enden stehen (das Nächste in 1,5 m). So sieht die Cloud,
   wie das Spiel Leitungen verlegt.
9. **Schiffsseite:** Gibt es an Schiffen Anschlusspunkte fürs Tanken oder
   für Strom (Helfer, Ports, Items mit Namen wie fuel, refuel, intake,
   umbilical)? Name und Lage bei drei verbreiteten Schiffen (Gladius,
   Cutlass Black, Constellation). Gibt es keine, das klar sagen.

### K4. Dateien

10. **Requisiten**, je Kategorie eine Datei
    `public/hangar/props/<kategorie>.glb` (Draco, WebP; Farbe ≤ 1024 px,
    Normalen und Masken ≤ 512 px; je Datei ≤ 3 MB).
    - Je Requisit ein Knoten `prop_<kategorie>_<name>`, Ursprung unten
      mittig, +Y oben, Meter, Vorderseite des Spiels in der JSON.
    - LOD-Stufe so, dass ein Requisit ≤ 8 000 Dreiecke hat (große ≤ 20 000).
    - Materialien gleichen Namens in allen Dateien gleich benennen, damit
      der Viewer sie zusammenlegen kann.
    - Der Viewer lädt nur die Kategorien, aus denen er etwas aufstellt.
11. **Katalog** `public/hangar/props/katalog.json`, `v: 1`:

    ```
    { v: 1,
      kategorien: { "<kategorie>": { file, bytes, props: [<node>, …] } },
      props: [ { node, kategorie, file, path, klasse, name: { en, de }, beschreibung: { en, de },
                 typ, tags: [ … ], benutzung: [ … ], tragbar,
                 zweck, nutzung, quelle: { zweck: "spiel" | "abgeleitet", … },
                 size: [x, y, z], footprint: [x, z], front, tris, lod,
                 anschluesse: [ { name, at: [x, y, z], dir: [x, y, z], art } ],
                 aufstellung: { boden, wand, regal, tisch, decke, hoehe, abstandFeld: [median, min, max], abstandWand: [ … ], richtung },
                 nachbarn: [ { node | kategorie, anteil, abstand } ],
                 from: [ <socpak>, … ], count } ],
      arbeitsplaetze: [ { name, mitglieder: [ { node, at: [x, z, drehungY], y } ], hallen, abstandFeld, ort } ],
      leitungen: [ { stuecke: [ { node, at: [x, y, z, drehungY] } ], laenge, von, nach, halle } ],
      schiffe: [ { schiff, anschluesse: [ … ] } ] }
    ```

    Achsen wie in den GLBs (Y oben), Drehungen in Grad um Y. Die
    Beschreibungen bleiben im Wortlaut des Spiels, nur gekürzt, wo sie
    lang sind.
12. **Manifest** `src/data/hangar-assets.json`: unter `props` ein neuer
    Schlüssel `katalog: { url, v, bytes, props, kategorien }`.
13. **Selbstauskunft** im Build:
    - Requisiten je Kategorie mit Dreiecken und Bytes je Datei;
    - Einträge mit Spielname, mit Beschreibung, mit Anschlusspunkten;
    - Anzahl der Arbeitsplätze und Leitungen.
    Was es im Spiel nicht gibt, klar sagen.

## Abschluss PC

14. Vor dem Push `npm run build && npm run gate` (normal und `STAGING=1`).
    Auf den Branch, ohne PR. Einbau, Merge nach staging und Vorher/Nachher
    macht die Cloud.

## Cloud (läuft parallel)

- Zuerst Schlauch und Feldmitte nach staging.
- Mit dem Katalog:
  - Arbeitsplätze ums Schiff nach den Gruppen aus K3 stellen;
  - Leitungen vom Gerät zum Schiff aus Kabel- und Schlauchstücken legen;
  - Spuren und Gerät an die Schiffsgröße anpassen.
- Budget bleibt: Stufe hoch höchstens so viele Zeichenbefehle wie heute
  plus 40, mittel plus 20. Geladen wird nur, was steht.
- Vorher/Nachher von oben und aus Krisz' Blick.

## Befund PC

PC-Lauf 2026-10-18. Neues Skript `scripts/extract-hangar-katalog.mjs`, Leser `scripts/lib/soc-objects.mjs`, Build-Art `katalog` in `scripts/build-hangar-assets.mjs`. `werkstatt.glb` und `werkstatt.json` bleiben unverändert.

**Woher.**
- Durchsucht habe ich **111 Hangar-socpaks**, nicht nur 87: die Industrie-Hangars `util_a` mit allen Ortsvarianten, jetzt auch die Hightech-Hangars `hightech_a`, dazu VFG Industrial, Self-Land und die Asteroidenbasen.
- Die Lage jedes Brushes kommt direkt aus der .soc. Satz Typ 1, Zeilenmatrix 3×4 bei +64; das Format steht in `soc-objects.mjs`.
- Ein Export je Halle ist dafür nicht nötig.
- Gezählt: **106 987 Objekte**, davon **9 040 Requisiten in 230 Arten**.
- 170 Arten stehen mindestens dreimal.

### K1 Requisiten

**198 exportiert** (Ziel ≥ 60): jede Art, die mindestens dreimal steht, mit zwei Grenzen (folgende Punkte), dazu alle Kabel- und Schlauchstücke und das Wartungsgerät des Archivs.
- Bei Lager und Müll habe ich nur die häufigsten genommen: 12 Kisten und 3 Müllhaufen.
- Von den Kabelkanälen `roomsm_addon_cable*` nur die ersten drei Arten (`taken.conduit` im Auszug); die übrigen fehlen im Katalog, obwohl sie dreimal stehen.
- 66 Stück stammen aus dem Archiv, vor allem `…/prop/maintenance/…`. Das ist der Wartungssatz der Hightech-Hangars:
  - Bodenkabel `cable_floor_1_a–f`, Hängekabel `cable_hanging_1_a–i`;
  - Bodenschläuche `hose_floor_1_a–c` mit Bodenanschluss `hose_floor_1_socket_a`, Schlauchtrommeln;
  - Werkzeugschrank, fahrbare Leitern, Arbeitsleuchten, Werkbänke, Rollbrett, Wagenheber `tool_jack_1_a`;
  - Warnschild, Leitkegel, Sauerstoffgenerator, Schweißkranarm.

| Kategorie | Requisiten | Dreiecke | Datei | aus Archiv | häufigste im Spiel (Aufstellungen) |
|---|---|---|---|---|---|
| diagnose | 10 | 28.284 | 1,72 MB | 4 | computer_monitor_1_a (105), computer_1_b (105), computer_1_a (70), console_diagnostic_1_a (40) |
| energie | 9 | 96.170 | 1,79 MB | 1 | generator_mining_1_a (52), generator_mobile_1_pirate_a (18), generator_portable_1_a (16), generator_mobile_1_b (9) |
| heben | 7 | 45.836 | 2,22 MB | 6 | ladder_freestanding_0065x0025x06_b (34), ladder_mobile_1_b (2), ladder_mobile_1_c (1) |
| kabel | 59 | 124.493 | 2,72 MB | 13 | cable_straight_3_cable_2m_a (573), roomsm_addon_cable_junctionbox_a (371), cable_straight_3_cable_2m_b (351), cable_bend_1_a (329) |
| lager | 12 | 50.768 | 2,53 MB | 0 | crate_metal_2_01x005x0025_a (84), crate_dry_2_0125x0125x0125_a (55), drum_dry_1_a (52), crate_weapon_4_015x0075x0075_a (47) |
| licht | 6 | 19.115 | 0,99 MB | 5 | light_portable_tripod_1_base_a (6) |
| luft | 6 | 21.340 | 0,74 MB | 0 | heater_freestanding_1_a (42), heater_large_1_c (22), heater_freestanding_1_b (16), heater_hanging_1_a (11) |
| reinigung | 7 | 24.872 | 1,04 MB | 4 | trash_bag_scattered_1_lrg_a (164), trash_bag_scattered_1_med_a (127), trash_bag_scattered_2_med_a (119), tool_mop_1_a (29) |
| schlauch | 22 | 67.628 | 2,85 MB | 7 | lt_airduct_hose_straight_8m_a_hung (24), hose_floor_1_socket_a (14), lt_airduct_hose_corner_1m_a (13), lt_airduct_hose_straight_8m_a (13) |
| sicherheit | 19 | 51.789 | 1,70 MB | 7 | fire_hose_1_a (237), fire_hose_1_b (183), extinguisher_cabinet_1_a (172), tool_fire_extinguisher_1_a (34) |
| transport | 15 | 136.049 | 2,01 MB | 3 | machine_forklift_1_extension_console_a (37), machine_forklift_1_extension_tank_a (36), trolley_cargo_1_a (13), trolley_cargo_3_b (11) |
| treibstoff | 5 | 21.498 | 1,11 MB | 0 | tank_gas_2_025x0125x0125_a (143), cell_fuel_1_a (107), tank_gas_3_05x025x025_a (35), tank_gas_1_0125x0125x0125_a (8) |
| werkzeug | 21 | 88.890 | 2,17 MB | 16 | tool_manual_1_ratchet_a (120), tool_manual_1_screwdriver_a (120), tool_manual_1_pliers_a (120), tool_power_1_drill_a (66) |

- Zusammen 23,6 MB, je Datei unter 3 MB.
- LOD: volle Stufe, wo ≤ 8 000 Dreiecke (große Geräte ≤ 20 000), sonst `_lod1`/`_lod2`.
- Materialien:
  - Untermaterial je Teilnetz aus der `.cgfm`, Material der `.cgf`.
  - Bei LOD-Stufen das Material der Grund-`.cgf`, denn LOD-Dateien nennen keins.
  - LayerBlend-Schichten: Basisschicht mit Tönung und UV-Kachelung (`KHR_texture_transform`).
  - Gleiche Namen `<mtl>_<untermaterial>` in allen Dateien.
- Weggelassen:
  - Decal-Flächen ohne eigenes Bild: Branding aus `$TintPaletteDecal`, das das Spiel zur Laufzeit füllt.
  - Die Vertexfarbe, die nur die Abnutzungsmischung trägt.

### K2 Bedeutung

- **Spielname und Beschreibung:** Nur 4 Requisiten haben einen Namen und 3 eine Beschreibung: Console, Scrap Cable Bundle, Standard Container, Hydrogen. Fast alle Werkstatt-Requisiten sind reine Deko-Brushes ohne Entity; wo es eine Entity gibt, nennt sie `@LOC_PLACEHOLDER`. Der Name kommt dann aus DataCore `AttachDef.Localization` und `global.ini` (Englisch, Deutsch).
- **Typ und Tags:** nur dort, wo die Entity sie trägt. Benutzungspunkte und tragbar ja/nein habe ich nicht gefunden; die Felder bleiben leer.
- **Anschlusspunkte: keine.** Die Modelle (IVO-`.cgf`) tragen keine benannten Helfer, Sockets oder Knochen; `anschluesse` ist überall leer. Das Einzige, was als Anschluss gedacht ist, ist der Bodenanschluss `hose_floor_1_socket_a` als eigenes Requisit.
- **Aufstellung aus dem Spiel:** 138 Requisiten haben Werte: Ort (Boden, Wand, Regal, Tisch, Decke), Höhe, Abstand zu Feldrand und Wand, Ausrichtung zum Feld.
  - Die Archiv-Stücke stehen in keinem Hangar und haben darum keine Werte.
  - Der Wandabstand zählt nur schmale Wandstücke (unter 3 m tief), weil große Wandmodule mit ihrer Box ganze Bereiche umschließen.
- **Nachbarn in 3 m:** je Kategorie und je Requisit, mit Anteil und mittlerem Abstand. Beispiele:
  - Gasflasche neben Feuerlöscher/-schlauch in 71 % der Aufstellungen, im Mittel 1,2 m.
  - Diagnosekonsole bei Sicherheit 65 % und Treibstoff 55 %.
  - Kabeltrommel 6 in allen Fällen neben dem Staplertank.
  - Schweißgerät neben einem Generator in 31 %.
- **Zweck und Nutzung:** für 183 Requisiten, alle als `quelle.zweck: "abgeleitet"`, geschlossen aus Name, Kategorie und Aufstellung.

### K3 Arbeitsplätze, Leitungen, Schiffsseite

**Arbeitsplätze.** 1 283 Gruppen (Abstand < 2,5 m) in 58 Zusammensetzungen; 39 davon kommen mindestens dreimal vor und stehen im Katalog, je mit einem Vertreter aus dem Spiel.

| Zusammensetzung | Gruppen | Hallen | Vertreter | Ort |
|---|---|---|---|---|
| kabel | 320 | 31 | roomsm_addon_cable_junctionbox_a, roomsm_addon_cable_junctionbox_c, roomsm_addon_cable_junctionbox_b, roomsm_addon_cable_junctionbox_b | wand |
| werkzeug | 159 | 31 | bag_toolbox_1_a, tool_manual_1_screwdriver_a, tool_manual_1_pliers_a, tool_manual_1_ratchet_a | frei |
| lager | 118 | 43 | crate_stack_1_03x025x0125_a, box_plastic_4_weapon_005x010x005_a, box_plastic_4_005x005x005_a, box_plastic_4_weapon_005x010x005_a, box_plastic_4_weapon_005x010x005_a | frei |
| sicherheit+treibstoff | 108 | 31 | tank_gas_2_025x0125x0125_a, fire_hose_1_b, fire_hose_1_a, extinguisher_cabinet_1_a | frei |
| reinigung | 95 | 30 | trash_bag_pile_1_j, trash_bag_pile_1_h, trash_bag_pile_1_e, trash_bag_pile_1_g | frei |
| diagnose | 72 | 31 | computer_1_b, computer_1_a, computer_1_b, computer_1_b, computer_1_b | frei |
| sicherheit | 61 | 25 | medical_kit_1_a, canister_medical_1_oxygen_a, medical_kit_2_a, canister_medical_1_oxygen_a | wand |
| kabel+transport | 35 | 23 | machine_forklift_1_extension_tank_a, cable_reel_6_a | wand |
| diagnose+kabel | 23 | 15 | console_diagnostic_2_a, cable_reel_7_a | frei |
| lager+transport | 21 | 19 | crate_multipurpose_1_0125x0125x0125_a, crate_multipurpose_1_0125x0125x0125_a, trolley_pallet_1_a | frei |
| lager+reinigung | 19 | 8 | salvage_shelf_1_a, salvage_shelf_1_b, trash_piles_1_c, salvage_shelf_1_a | frei |
| diagnose+sicherheit+treibstoff | 15 | 13 | fire_hose_1_b, fire_hose_1_a, console_diagnostic_1_a, cell_fuel_1_a, cell_fuel_1_a | wand |
| kabel+lager | 15 | 11 | cable_reel_4_a, crate_dry_2_0125x0125x0125_a, crate_metal_2_01x005x0025_a, crate_dry_2_0125x0125x0125_a | frei |
| kabel+sicherheit | 14 | 12 | roomsm_addon_cable_junctionbox_a, roomsm_addon_cable_junctionbox_a, fire_hose_1_a, roomsm_addon_cable_junctionbox_c, roomsm_addon_cable_junctionbox_b | wand |

**Leitungen.** Das Spiel verlegt am Boden kaum Leitungen.
- Es gibt 41 kurze Ketten aus 2 bis 3 Stücken, oft ohne Gerät an den Enden.
- **Kein Kabel und kein Schlauch läuft vom Generator oder Tank zum Schiff.**
- Die übrigen Kabelstücke, mehrere tausend, sind Züge an Wänden und Decken.
- Stehen sie im Katalog trotzdem, sind sie Bausteine; das Verlegen zum Schiff ist eigene Regie der Cloud.

**Schiffsseite.** Die Schiffsexporte tragen Anschlusspunkte mit Lage (`schiffe[]`, Raum des Schiffsexports):
- **Gladius:**
  - Tankanschluss `DockingTube_Fuel_Ports` / `Refueling_Port` oben hinten bei (0, 0,98, −6,38);
  - Tankklappe und `IP_Panel_Fuel` unten vorn bei (0, −1,37, 3,4);
  - Datenports an den Lufteinlässen.
- **Cutlass Black:** `hardpoint_fuel_port` bei (0, 2,6, −5), Andockkragen.
- **Constellation Andromeda:** der Tankanschluss steht im Loadout (`DockingTube_Fuel_Ports … [hardpoint_fuel_port]`), hat im Export aber keinen Knoten. Es gibt nur Andockkragen und den Merlin-Andockport.
- Strom- oder Bodenanschlüsse (umbilical, ground power) gibt es bei keinem der drei.

### K4 Dateien und Manifest

- `public/hangar/props/<kategorie>.glb`: 13 Dateien. Knoten `prop_<kategorie>_<name>`, Ursprung unten mittig, +Y oben, `front: "-z"`.
- `public/hangar/props/katalog.json` (316 KB), `v: 1`, Aufbau wie im Auftrag. Dazu kommen:
  - `hinweise`: was das Spiel nicht hergibt;
  - je Requisit `count`, `hallen`, `quelle.geometrie` (hangar/archiv);
  - `arbeitsplaetze[].n`.
- Manifest `props.katalog: { url, v, bytes, props, kategorien }`.

**Sicht:** Ich habe alle 13 Dateien am PC als Galerie gerendert und angeschaut: Texturen und Tönungen sitzen. Die Bilder sind nicht committet.
