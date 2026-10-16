# Hangar: Aufzugsschacht aus dem Spiel (2026-10-15)

Auslöser für die PC-Sitzung: **„Hangar-Schacht“**. Anlass: Krisz
2026-10-15 22:28, Bildschirmfoto vom Schiffswechsel: „wenn es runterfährt
siehts so aus beim schiff wechseln“. Fährt das Feld ab, ist das Loch eine
flache schwarze Fläche: keine Schachtwände, die Kanten des Hallenbodens
schweben mit sichtbarer Unterseite (Platte y 0 bis 1 mit Rippen), tief
unten liegt das Feld als dunkle Platte mit ein paar Leuchtstreifen.

Das ist der Teil B von [`hangar-aufzug.md`](hangar-aufzug.md), auf den
Schacht beschränkt. Die zehn Schiffe (dort Punkt 6) gehören **nicht** in
diesen Auftrag; sie bleiben geparkt. Regel 10-07 gilt: Wände, Rand,
Lichter und ihre Texturen kommen aus dem Spiel, nichts Selbstgebautes.

## Stand Cloud

- Das Feld (Modellraum x 16…48, z −120…−24, 32 × 96 m) fährt beim Wechsel
  `LIFT_DEPTH` 26 m plus Schiffshöhe tief, bei großen Schiffen also bis
  rund 50 m. Darum herum ist heute nichts; der Hintergrund ist 0x07080b.
- Der Viewer kann Spielteile wiederholen (Wandstück neben Wandstück,
  übereinander) und auf das Feld zuschneiden. Ein ganzer Schacht in
  anderer Größe geht auch; dann wird er auf 32 × 96 m gestreckt oder aus
  seinen Teilen neu gereiht.
- Grafikbudget (Krisz' Grafikkarte, siehe `hangar-gpu-pacing`): der
  Schacht darf höchstens rund 10 Zeichenbefehle und 60 000 Dreiecke
  kosten. Warnlichter werden im Viewer leuchtende Flächen und höchstens
  zwei echte Lichtquellen, keine weiteren Schatten.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. Persönliche Hangars des heutigen Spiels: den Schiffsaufzug finden
   (socpaks und Entities, Suchbegriffe etwa elevator, lift, platform,
   `hangar_*`, `shaft`). Für die Größe, deren Aufzugsfläche 32 × 96 m am
   nächsten kommt, sonst für die größte. Gibt es dort keinen sichtbaren
   Schacht (etwa weil das Spiel ihn nie zeigt), den Lastenaufzug einer
   Station oder Landezone mit Schacht nehmen und das im Bericht sagen.
3. Exportieren und packen wie die Halle (Draco, WebP ≤ 1024 px), alles
   zusammen ≤ 3 MB, nach `public/hangar/lift/<name>.glb`:
   - Schachtwand, Schachtecke, Rand an der Bodenkante (Schienen,
     Warnmarkierung, Abdeckungen), Schachtboden, wenn es einen gibt;
   - die Leuchten und Warnlichter am Aufzug als Meshes;
   - jedes Teil als eigener Knoten, benannt nach seiner Rolle (`wall`,
     `corner`, `rim`, `bottom`, `light_<n>`), Ursprung an seiner
     unteren linken Ecke zur Schachtmitte hin, y nach oben. Ist der
     Schacht im Spiel ein Stück, ihn ganz exportieren (Knoten `whole`,
     Aufzugsmitte im Ursprung, Oberkante der Plattform auf y 0).
4. Daneben `public/hangar/lift/<name>.json`:
   `{ v: 1, source, modules: { wall: { size: [b, h] }, corner: { size },
   rim: { size: [b, h] }, bottom?: { size } } | null, whole?: { size:
   [b, l], depth }, lights: [ { node?, pos, dir?, color, intensity,
   radius, angle?, anim: { kind, speed, … } } ], motion: { Fahrweg,
   Geschwindigkeit, Beschleunigung, Pausen, Vorwarnzeit, Lichtwechsel,
   wörtlich mit Quelle } }`. Im Manifest `src/data/hangar-assets.json`
   ein Eintrag `lift: { "<name>": { url, json, bytes, v } }`.
5. Selbstauskunft: gefundene Aufzüge (Datei, Maße), exportierte Teile mit
   Dreiecken, Materialien und Bytes, Zahl der Lichter, die übliche
   Kopfzeile. Keine Bilder und keine Roh-Exporte committen (das Repo
   ist öffentlich); die Bilder rendert die Cloud.
6. Vor dem Push `npm run build && npm run gate`; auf den Branch, ohne PR.
   Einbau, Merge nach staging und die Bildfolge vorher/nachher macht die
   Cloud.

## Befund PC

PC-Lauf 2026-10-16 (Hangar `hangar_medtop_001`, StarBreaker socpak/p4k).

**Gefundene Aufzüge** (persönliche Hangars, LandingArea x × y × z):

| socpak | Landefläche | Plattform-Entity | Schacht innen |
|---|---|---|---|
| hangar_smltop_001 | 24 × 32 × 16 m | y −44 | – |
| hangar_medtop_001 | 56 × 88 × 32 m | y −50 | **56 × 88 m, 36 m tief** |
| hangar_lrgtop_001 | 72 × 128 × 48 m | y −72 | – |
| hangar_xltop_001 | 160 × 272 × 64 m | y −112 | – |

Gewählt: **medtop**. Seine Länge (88 m) liegt am nächsten an 96 m; small (32 m lang) ist zu kurz. Der Schacht ist im Spiel sichtbar und ein Bausatz, kein Stück. Darum `modules` statt `whole`.

**Spielaufbau** (Exportraum, Hallenboden y −50, Schacht innen x ±28, z ±44, Wandunterkante y −86):
- Längswand: Wand 40 m, Rippe 8 m über der Fuge (z −4…4), Wand 40 m, an den Enden Ecken 10 × 10 m.
- Querwand: eine Wand 40 m (x −20…20) mit Rippen an beiden Enden (x ±16…24).
- Jede Wand ist zweistöckig: oben `hangar_ship_elevator_wall_40x20_top_a` (y −74…−54), unten `…wall_40x12_bot_a` (y −86…−74). Darüber sitzen Randleisten 16 m, 8 m und Eckleiste (y −54…−50,12).
- Einen Schachtboden gibt es nicht. Die Plattform (`ht_hangar_ship_elev_med_a.cga`, 55,5 × 87,6 m) füllt unten den Schacht. Ihre Oberkante liegt in Ruhe bei y −86. Darunter liegt nur ein 4-m-Laufsteg unter der Wand, unsichtbar. Darum `bottom: null`.

**Export** `public/hangar/lift/medtop.glb` (0,30 MB, Draco, WebP ≤ 1024 px) + `medtop.json` (62 KB). Neun Knoten, je Rolle ein Spielexemplar der Westwand bzw. ihrer Nordecke:

| Knoten | Größe (m) | Dreiecke | Mat. | aus |
|---|---|---|---|---|
| wall | 40 × 32 | 3 140 | 2 | wall_40x20_top_a + wall_40x12_bot_a |
| wall_upper | 40 × 20 | 2 198 | 2 | wall_40x20_top_a (zum Stapeln über 32 m) |
| rib | 8 × 32 | 1 130 | 2 | rib_top_a + rib_bot_b |
| corner | 10 × 10 × 32 | 268 | 2 | corner_top_a + corner_bot_c |
| rim | 16 × 3,88 | 12 | 1 | trim_04x016_b |
| rim_8 | 8 × 3,88 | 12 | 1 | trim_04x08_b |
| rim_corner | 5 × 5 × 3,88 | 36 | 1 | trim_corner_b |
| light_0 | 0,45 × 0,46 | 132 | 2 | light_hazard_2_d (Wand-Warnlampe) |
| light_1 | 0,33 × 0,32 | 132 | 2 | light_hazard_2_b (Ecklampe auf Bodenhöhe) |

Zusammen 7 060 Dreiecke, 6 Materialien, 16 Texturen. Ein Spielschacht in medtop-Größe kostet etwa 6 Wände, 6 Rippen, 4 Ecken und 10 Leisten, also rund 27 000 Dreiecke. Das liegt unter 60 000.

**Bezugssysteme** (stehen auch in `json.shaft.frames`):
- Wandteile: Ursprung an der unteren linken Ecke der Innenfläche, von der Schachtmitte aus gesehen. x läuft nach rechts entlang der Wand, y nach oben, z zur Schachtmitte. Die Wand liegt bei z ≤ 0.
- Ecken (`corner`, `rim_corner`, `light_1`): Ursprung in der inneren Schachtecke, das Innere liegt bei x > 0, z > 0.
- `light_0`: Mitte der Montagefläche. Im Spiel sitzt sie 0,8 bis 1,3 m hinter der Bezugsebene der Wand, in der Nische der Rippe.
- `rim` ist 3,88 m hoch. Seine Oberkante liegt im Spiel 0,12 m unter dem Hallenboden.
- Einbauprobe am PC: Mit drei Drehungen um y (West +90°, Ost −90°, Nord 180°) schließen alle Teile zum Spielschacht. Die Bilder habe ich nicht committet.

**Materialien:** Die Schachtteile tragen keine eigenen Karten. Ihr HardSurface-Material nennt Schichten (`Materials/PU/layer/…mtl`, je mit Tönung).
- Der Extraktor liest jetzt die erste Schicht (`<lift>.layers.json`: TexSlot1/2, LayerTiling). Der Build hängt ihre Karten an, die Tönung wird Grundfarbe.
- Lack: `metal_painted_a`, Tönung 0,051/0,056/0,063.
- Trims: Trimsheets `trim_hightech_c`/`_d`.
- `steel_base_a` ist Metall ohne Farbkarte, Farbe = Specular 0,55/0,57/0,57.
- Das Lampenglas (`light_hazard_1_a_mtl_decal_glow_lod_06`, Illum) leuchtet über eine Emissive-Fläche. Der Viewer sollte es mit dem Lampenzustand schalten.
- Nicht übernommen: Abnutzungsschicht (Wear, über Vertexfarbe gemischt), Detailkarten, POM. COLOR_0 bleibt drin (%VERTCOLORS wie in der Halle).

**Lichter: 100 in `lights[]`**
- 83 hängen am Schacht (`attach: "shaft"`). Ihre Lage ist in `pos` angegeben: Schachtmitte auf Hallenboden = 0, Achsen wie oben.
  - 6 `omni`: orange Warnlicht an `light_0`, SoftOmni, Radius 8, Farbe 1/0,171/0, Intensität 3, lightStyle 5.
  - 11 `flood_key`: weiß, Intensität 15 bzw. 1, Radius 80–100, Kegel 60°.
  - 6 `flood_warm` (Intensität 6), 4 `flood_cool` (Intensität 3), 11 `floodfill`, 16 `base` (Bodenstrahler), 24 `elev` (kleine Leisten am Rand), 4 `side_proj`, 1 `fog`.
- 17 hängen an der Plattform (`attach: "pad"`, Lage relativ zur Plattformoberkante): 6 `side_orange` (Emergency 10, lightStyle 2), 7 `middle_red`, 4 `lrgship`.
- **Alle Schachtlampen sind im Default-Zustand aus** (Intensität 0) und leuchten nur in Emergency. Der Manager setzt `platformInTransitLightState = Emergency`, also nur während der Fahrt.
- Die Kurve der lightStyle-Nummern steht nicht in den Spieldateien, sie ist Engine-Sache. Die Nummer steht wörtlich in `anim.style`.
- Vorschlag für die zwei echten Lichter: zwei `flood_key` (Intensität 15). Die `omni` am besten als leuchtende Fläche plus Blinken.

**Fahrablauf** (`motion`, wörtlich mit Quelle):
- Fahrweg: **36 m**. Plattform-Entity bei y −50, die Plattform des .cga ruht mit Oberkante bei y −86. ParentOffsetPos z der Plattform-Lichtgruppe = 36,000.
- Animation: `door_open`/`door_close` je 450 Bilder bei 30 Bildern/s = 15 s, `DoorAnimationSpeed` 1,2.
- Abgeleitet: **12,5 s** Fahrt, im Mittel **2,88 m/s**. Annahme: Die Animation ist die ganze Fahrt.
- Beschleunigung: steckt als Kurve in der .caf (Bone `anim_pad001`), nicht dekodiert. Die .animevents sind leer.
- Sequenzen:
  - `sq_hngr_medtop_doorclose_paddown`, 31,67 s: Lichtgruppen ab 0,83 s Emergency, ab 31,67 s Default. Hologramm blendet in 0,83 s ein und ab 30 s aus.
  - `sq_hngr_medtop_dooropen_padup`, 33 s: Emergency ab 0 s, ab 32,97 s Default.
  - Ton jeweils `Play_ENVP_FE_Light_Projector_MedTop_HT_Off`/`_On`.
- Pausen: stehen nicht in den Daten.
- Der Index der Lichtzustände (3 = Emergency) ist aus der Reihenfolge der LightStateParams abgeleitet.

**Offen:**
- Die Fahrkurve aus der .caf.
- Die zehn Schiffe aus `hangar-aufzug.md`: wie angesagt geparkt. Sie liegen exportiert im Cache, gebaut sind sie nicht.

Geänderte Skripte:
- `scripts/extract-hangar-sources.mjs`: Teil `lift` mit Lichtern, Sequenzen, Animationen und Schichtmaterialien.
- `scripts/build-hangar-assets.mjs`: Art `lift`, Manifest `lift.medtop` mit `url`, `json`, `bytes`, `v`, Teilen und Lampenzahl.

## Einbau Cloud (2026-10-16)

- **Aufbau** (`HALL_SHAFT` in `assets/hangar-viewer.js`, `buildShaft`): je
  Schachtecke eine Ecke, Längswand (96 m) aus Wand 4…44, Rippe 44…52, Wand
  52…92; Querwand (32 m) aus einer Wand −4…36 (die Enden stecken hinter den
  Längswänden, wie im Spiel hinter den Ecken) mit Rippen 4…12 und 20…28.
  Randleisten 16 m rundum (96 und 32 gehen glatt auf), Eckleiste in jeder
  Ecke, Oberkante 0,12 m unter dem Boden. Warnlampe `light_0` auf jeder
  Rippenmitte (sechs, wie im Spiel), Ecklampe `light_1` auf dem Boden an
  den vier Feldecken. 36 m tief; braucht ein Schiff mehr, kommen Lagen aus
  den Oberteilen (20 m) dazu. 28 264 Dreiecke, 6 Zeichenbefehle während
  der Fahrt, in Ruhe nur die vier Ecklampen (2 Zeichenbefehle).
- **Sichtbar** ist der Schacht nur, solange das Feld unterwegs oder unten
  ist; in Ruhe deckt das Feld ihn zu, und nur die vier Ecklampen bleiben
  stehen (die 2 Zeichenbefehle oben).
- **Materialien:** Der Export hat **keine Texturkoordinaten**. Der Viewer
  nimmt darum von jeder Karte den Mittelwert (oberste Mip-Stufe) und lässt
  die flache Normalenkarte weg. Die Lacktönung und die Abdunkelung aus den
  Eckfarben tragen das Bild; die Trimsheet-Details fehlen. Nachauftrag für
  einen späteren PC-Lauf: UVs (TEXCOORD_0) mit exportieren, dann zeigt der
  Schacht die Trimsheets.
- **Licht:** 84 Spiellampen haben im Zustand Emergency Licht (ohne Dunst,
  Fülllicht unter 0,05). Gleiche Art und nah beieinander (unter 6 m,
  Strahler in ähnlicher Richtung) wird eine, so auch die Fluterpaare, die
  das Spiel an jeder Stelle doppelt setzt (62 Gruppen). Davon rechnet der
  Shader der Wände hoch 29, mittel 20, niedrig 10 (die sechs Warnlichter
  immer, dann nach Reichweite mal Helligkeit), der des Felds nur die 11
  Fluter. Platz für Uniforms: Das Hallenprogramm belegt 145 Vektoren, die
  Lampen je 3; bei 256 Vektoren (manche Telefone) bleiben 22 Lampen, darunter
  weniger, unter 193 keine (dann nur Wände und leuchtende Warnlampen). Lage: an
  derselben Wand im selben Abstand zur Wand, entlang der Wand Rippe auf
  Rippe und Ecke auf Ecke. Farbe aus Farbtemperatur (1500 K der großen
  Fluter ist warmes Orange). Abfall mit dem Quadrat der Entfernung (3 m
  Kern), weich bis zum Radius, Kegel weich zur Mitte. Stärke `PIT_GAIN` 30
  aus zwei Bildrunden. Die Lampen der Plattform fahren mit, beleuchten die
  Wände, nicht die Plattform selbst (ihre Richtung fehlt im Export); die
  Bodenstrahler (`base`) auch nur die Wände: Sie hängen unten einen Meter
  über der Plattform und gleißten ohne Verdeckung als helle Bahnen darauf.
- **Blinken nachempfunden:** Die Kurven der lightStyles stehen nicht in
  den Spieldaten. Stil 5 (Warnlichter am Schacht) weich an und aus im
  Sekundentakt, Stil 2 (Plattform) ein Puls alle zwei Sekunden.
- **Schiff und Crew** im Schacht: Abdunkelung wie bisher, aufgehellt um das
  Schachtlicht an ihrer Stelle (`pitAt`, `PIT_SHIP` 1,5).
- **Fahrzeit** bleibt 1,9 s ab und 2,8 s auf; das Spiel braucht 12,5 s je
  Richtung. Auf Wunsch angleichen (`LIFT_DOWN_MS`, `LIFT_UP_MS`).
- **Kosten** (SwiftShader, 1920 × 1080, Stufe hoch, Grafikzeit je Bild):
  in Ruhe wie vorher (10 134 gegen 9 967 ms, gleich im Rauschen; 3
  Zeichenbefehle mehr für die Ecklampen). Während der Fahrt, steil von
  oben in den halb abgefahrenen Schacht: vorher 5 998 ms (das schwarze Loch
  kostete nichts), Wände ohne Lampen 7 662 ms, mit Lampen 9 110 ms. Ein Bild
  in der Fahrt kostet damit so viel wie die Halle in Ruhe, nicht mehr. Ein
  erster Stand mit 40 Lampen für Wand und Feld lag bei 9 600 ms, eine
  Schleife ohne feste Länge bei 12 400 ms.
- **Tor:** `verify:hangar-hall` [11] liest `HALL_SHAFT` aus dem
  ausgelieferten Viewer und prüft Bausatz, Rahmen der Teile, Wände ohne
  Lücke, Randleiste, genau eine Warnlampe je Rippe, Dreiecke und Lampen gegen
  `KLINKE_SCHACHT`. Vorgeführt rot am 16.10.2026: Längswand ohne Rippe
  („Lücke von 44.00 bis 52.00 m“, „Warnlampe bei 48 m … auf keiner Rippe“,
  „nur 26004 Dreiecke“) und Lampenliste auf 40 gekürzt („35
  Schachtlampen mit Licht, die Klinke verlangt 84“). Nach der Code-Prüfung
  von PR #110 verschärft und wieder rot vorgeführt: zwei Lampen auf einer
  Querrippe („die Rippe ab 4 m … traegt 2 Warnlampen“, „ab 20 m … 0“) und
  eine Rippe 2 m nach oben verrutscht bei gleicher Höhe („y 2.00..34.00
  (Soll 0..32)“; vorher prüfte das Tor nur die Höhe).
