# Hangar: Schacht mit Stimmung und Detail (2026-10-16)

Auslöser für die PC-Sitzung: **„Schacht-Tiefe“**. Anlass: Krisz
2026-10-16 09:17 mit Bildschirmfoto von oben in den Schacht: „es sind jhz
schon wände da aber halt wieder super basic und langweilig und nicht
überhaupt nicht mit "tiefe" erledigt worden“, 09:21: „ich meinte nicht
physische tiefe, ich meinte ästhetische tiefe oder krative tiefe“.

Gemeint ist also Stimmung und Charakter, kein Relief. Die Cloud baut
Licht, Dunst und Inszenierung selbst (Abschnitt unten). Was dafür aus dem
Spiel kommen muss, ist das Detail, das man gern ansieht: die Trimsheets
mit ihren Warnstreifen und Paneelen, Decals mit Beschriftung, Kabel,
Lampengehäuse. Regel 10-07 gilt dafür: Geometrie und Texturen aus dem
Spiel, nichts Selbstgebautes. Keine Bilder, keine Roh-Exporte committen
(das Repo ist öffentlich).

Folgeauftrag zu [`hangar-schacht.md`](hangar-schacht.md) (Bausatz
`medtop`, fc60b39).

## Warum der Schacht leer wirkt (Befund Cloud)

0. **Die Wände nahmen kein Licht an** (Fehler im Viewer seit PR #110,
   behoben am 16.10.2026, siehe unten). Was man sah, war nur die
   Spiegelung der Umgebung: gleichmäßig dunkelgrau, keine Lampe des
   Spiels zeichnete sich ab.
1. **Keine Texturkoordinaten.** `medtop.glb` trägt nur POSITION, NORMAL
   und COLOR_0. Die Trimsheets (`trim_hightech_c/_d`), die Greebles und
   die Lackschicht liegen als Texturen bei, lassen sich ohne UVs aber
   nicht auflegen. Der Viewer nimmt von jeder Karte nur den Mittelwert:
   Jede Wand ist eine gleichmäßig dunkelgraue Fläche, ohne Streifen,
   Fugen, Schrift oder Abnutzung.
2. **Nur die erste Materialschicht.** Abnutzung und Schmutz (Wear-Schicht,
   über Vertexfarbe gemischt) fehlen. Die Lackschicht allein ist fast
   schwarz (Tönung 0,051/0,056/0,063).
3. **Kein Beiwerk.** Exportiert sind Wand, Rippe, Ecke, Randleisten und
   zwei Lampenkörper. Decals, Kabel, Rohre, Geländer, Schilder und die
   Gehäuse der Leisten-, Boden- und Fluterlampen fehlen.
4. **Licht und Stimmung** sind Cloud-Sache: Der Viewer dunkelt heute alles
   unter dem Hallenboden noch nach dem alten Stand ohne Schacht ab (bis
   92 % ab 22 m Tiefe), und die Spiellampen haben keinen Dunst, keine
   Kegel und keine Farbregie.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. **UVs.** Herausfinden, wo TEXCOORD_0 verloren geht: im StarBreaker-
   Export (`.cache/hangar-src/lift/medtop.glb`) oder in
   `scripts/build-hangar-assets.mjs` (Art `lift`). Beheben, sodass jedes
   Teil seine Spiel-UVs trägt, dazu TEXCOORD_1, wenn ein Material es
   nutzt. Selbstauskunft je Teil und Material: UV-Sätze, Wertebereich,
   Anteil Dreiecke ohne UV-Fläche.
3. **Schichten.** Für jedes Submaterial der Schachtteile in `medtop.json`
   unter `materials` (Schlüssel = Materialname im GLB): alle Schichten der
   Reihe nach (Pfad, Tönung, Tiling, Glanz, Karten) und womit sie gemischt
   werden (Vertexfarbkanal oder Maske). Die Karten der zweiten Schicht
   (Wear/Schmutz) und die Mischmaske mit ins GLB. Rohwerte wörtlich, die
   Umrechnung macht die Cloud.
4. **Beiwerk.** Alles im Schachtbereich des socpak (innen 56 × 88 m, vom
   Hallenboden bis zur Plattformoberkante in Ruhe, im Exportraum y −50
   bis −86), was der Bausatz noch nicht hat: Decals (Warnstreifen,
   Nummern, Schilder, Pfeile), Kabel, Rohre, Geländer, Leitern, die
   Gehäuse der Lampen (`elev`, `base`, Fluter, `side_proj`). Je Art ein
   Knoten `deco_<rolle>` (Ursprung am Montagepunkt, Achsen wie die
   Wandteile), dazu in der JSON `deco: [ { node, kind, at: [ [x, y, z,
   drehungY], … ] } ]` in Schachtraumkoordinaten wie `lights[].pos`.
   Decals mit Material und Alpha. Steht im Schacht nichts davon, das klar
   sagen; dann gibt es eben nur die Trims.
5. **Projektortexturen.** Die Fluter sind `Projector`-Lichter. Hat ein
   Licht eine Projektortextur (Muster im Kegel), den Pfad in
   `lights[].projector` und das Bild klein (≤ 256 px, WebP) als
   `public/hangar/lift/medtop-proj-<n>.webp`. Die Cloud nimmt das Muster
   für die Lichtkegel.
6. Packen wie bisher (Draco, WebP; Farbe ≤ 1024 px, Normalen und Masken
   ≤ 512 px), alles zusammen ≤ 4 MB. Dreiecke des fertigen Schachts (so
   wie ihn der Viewer reiht, 46 Teile) ≤ 60 000; reicht das nicht, das
   Beiwerk nach Wirkung kürzen und das im Befund sagen. Manifest
   `src/data/hangar-assets.json` wie gehabt.
7. Selbstauskunft wie beim letzten Lauf, dazu: UV-Sätze je Teil,
   Materialien mit allen Schichten, Decals, Beiwerk-Arten mit Anzahl,
   Projektortexturen, Bytes je Datei. Unten unter „Befund PC“ eintragen.
8. Vor dem Push `npm run build && npm run gate`. Das Tor [11] in
   `verify:hangar-hall` prüft den Bausatz: neue Knoten dürfen dazukommen,
   die neun alten bleiben mit ihren Rahmen. Auf den Branch, ohne PR.
   Einbau, Merge nach staging und Vorher/Nachher der Fahrt macht die
   Cloud.

## Cloud (läuft parallel, wartet nicht auf den PC)

- Lichtregie für die Fahrt: kühler Dunst im Schacht gegen die warme,
  helle Halle; die orangen Warnlampen als Akzent; Lichtkegel der Fluter
  im Dunst; ein Lauflicht, das während der Fahrt mit der Plattform die
  Wände entlangzieht.
- Grafikbudget wie bisher: die Fahrt nicht teurer als die Halle in Ruhe,
  Telefone mit eigener Stufe.
- Nach der PC-Lieferung: Trims mit UVs, Abnutzung, Decals und Beiwerk
  einbauen; bringt der PC Projektortexturen (`lights[].projector`), die
  Lichtkegel in `shaftFx` damit mustern (heute ohne Muster gebaut).

### Stand Cloud 16.10.2026

- **Fehler gefunden und behoben.** Der Loader gibt den Schachtmaterialien
  `vertexColors` mit, weil der Bausatz COLOR_0 trägt. `buildShaft` legt
  die Vertexfarbe aber als `hgShade` ab und kein `color`; der Shader las
  das fehlende Attribut als Schwarz und nahm die Grundfarbe mal null. Das
  Licht der Spiellampen, der Fluter und der Lampenleisten kam so nie auf
  den Wänden an. Jetzt `vertexColors = false` für die Schachtmaterialien
  (die Hallenmaterialien hatten das schon). Gefunden mit einem Bild, das
  die Grundfarbe mal zehn zeigt: schwarz auf allen Wänden.
- **Lichtregie** (Stellschrauben `SHAFT_*` in `assets/hangar-viewer.js`,
  Shader `HALL_SHAFT_GLSL`): Grundlicht von oben warm (Rest des
  Hallenlichts, nimmt mit der Tiefe ab), von unten im Blau der
  Nebellampe des Spiels, je nach Normale, so zeigen Rippen und Kanten ihre
  Form; Kantenlicht (Fresnel); Dunst dünn überall und als Schicht über der
  Plattform, geschlossen integriert, eine Rechnung je Bildpunkt; das
  Feld bekommt die Schachtlampen nur zu 55 % (warme Bühne statt
  ausgebrannter Fläche); Lauflicht im Orange der Warnlampen knapp über der
  Plattform; Lichtkegel nur aus den weißen Flutern (die warmen standen
  als massive orange Klingen im Bild); Lichthöfe um die Warnlampen;
  Schiff und Crew tief unten etwas kühler (`SHAFT_TINT`).
- Die alte Abdunkelung unter dem Boden bleibt für das Hallenlicht: Es
  reicht nicht in den Schacht. Was der Schacht an Licht hat, kommt
  danach dazu und wird nicht abgedunkelt.
- **Kosten** (SwiftShader, 1920 × 1080, Grafikzeit je Bild, gleiche
  Sitzung): halb abgefahren, steil von oben, Stufe hoch 9 754 ms vorher,
  8 184 ms nachher (850 gegen 854 Zeichenbefehle: Kegel und Lichthöfe);
  Stufe niedrig 4 388 gegen 4 388 ms (241 gegen 242, dort ohne Kegel). In
  Ruhe 9 663 gegen 9 320 ms bei je 1 143 Zeichenbefehlen, also gleich im
  Rauschen (ein dritter Lauf desselben Stands lag bei 10 831 ms).
- Abgestimmt an acht Bildrunden (je 4 bis 8 Ansichten, steil von oben wie
  auf Krisz' Bild, schräg, von innen an der Wand). Ob es Stimmung hat,
  urteilt Krisz (WINDOWS.md id 77).

## Befund PC

PC-Lauf 2026-10-17 (Teil B von `hangar-werkstatt`). Der Schacht ist neu gebaut: `medtop.glb` hat 1.83 MB, `medtop.json` 107 KB, dazu 5 Projektormuster mit zusammen 4654 B. Das sind 1.94 MB, die Grenze ist 4 MB.

**2. UVs.**
- Der StarBreaker-Export trägt TEXCOORD_0. Verloren ging die UV in meinem Build: `prune()` lief direkt nach dem Zuschnitt, als die Materialien noch keine Karten hatten, und warf TEXCOORD_0 als unbenutzt weg.
- Jetzt läuft `prune({ keepAttributes: true })`.
- Die Schachtmaterialien nutzen keinen zweiten UV-Satz. Im Export gibt es keinen.
- Die Tabelle zeigt die Spiel-UVs je Teil und Material vor dem Packen. „ohne Fläche“ ist der Anteil der Dreiecke ohne UV-Fläche, im Spielmodell genauso.

| Teil | Material | Sätze | Bereich u/v | ohne Fläche |
|---|---|---|---|---|
| wall | trim_greebles_a_031 | TEXCOORD_0 | -1.21/-8.85 … 9.88/1 | 0 % |
| wall | paint_c_notint_044 | TEXCOORD_0 | -1.21/-8.85 … 9.88/1 | 11.4 % |
| wall | paint_c_notint_044 | TEXCOORD_0 | -1.71/-11.92 … 2.78/4.25 | 0 % |
| wall_upper | trim_greebles_a_031 | TEXCOORD_0 | -1.21/-8.85 … 9.88/1 | 0 % |
| wall_upper | paint_c_notint_044 | TEXCOORD_0 | -1.21/-8.85 … 9.88/1 | 11.4 % |
| rib | paint_c_notint_044 | TEXCOORD_0 | -1.01/-17.06 … 2.51/14.7 | 11.3 % |
| rib | metal_a_046 | TEXCOORD_0 | -1.01/-17.06 … 2.51/14.7 | 25 % |
| rib | paint_c_notint_044 | TEXCOORD_0 | -0.99/-3.14 … 1.98/14.7 | 17.7 % |
| rib | metal_a_046 | TEXCOORD_0 | -0.99/-3.14 … 1.98/14.7 | 0 % |
| corner | paint_c_notint_044 | TEXCOORD_0 | -0.7/-5.5 … 1.7/1.7 | 17.1 % |
| corner | trim_greebles_a_031 | TEXCOORD_0 | -0.7/-5.23 … 1.7/6.5 | 0 % |
| corner | paint_c_notint_044 | TEXCOORD_0 | -0.7/-5.23 … 1.7/6.5 | 30.3 % |
| rim | trim_metal_a_030 | TEXCOORD_0 | 0/0.29 … 6.02/1 | 0 % |
| rim_8 | trim_metal_a_030 | TEXCOORD_0 | 0/0.29 … 6.02/1 | 0 % |
| rim_corner | trim_metal_a_030 | TEXCOORD_0 | 0/0.29 … 6.02/1 | 0 % |
| light_0 | decal_glow_lod_06 | TEXCOORD_0 | -0.01/0.87 … 0.14/1 | 0 % |
| light_0 | metal_painted_grey_dark_09 | TEXCOORD_0 | -0.01/0.87 … 0.14/1 | 9.3 % |
| light_1 | decal_glow_lod_06 | TEXCOORD_0 | -0.01/0.87 … 0.14/1 | 0 % |
| light_1 | metal_painted_grey_dark_09 | TEXCOORD_0 | -0.01/0.87 … 0.14/1 | 9.3 % |

**3. Schichten** (`medtop.json` → `materials`, Schlüssel = Materialname im GLB; Rohwerte samt Snapshot):

| Material | Shader | Schichten der Reihe nach | gemischt über | Wear im GLB |
|---|---|---|---|---|
| paint_c_notint_044 | HardSurface | Primary `metal_painted_a.mtl` (Tönung 0.051/0.056/0.063, GlossMult 0.699999988079071, UVTiling 1, Karten d+n); Wear `metal_painted_a_wear.mtl` (Tönung 0.089/0.127/0.156, GlossMult 0.4000000059604645, UVTiling 1, Karten d+n) | COLOR_0.a (Vertex-Alpha, HardSurface %WEAR_LAYER), WearBlendBase/WearDirtBlendFalloff in params | `wear_0` |
| metal_painted_grey_dark_09 | LayerBlend_V2 | BaseLayer1 `painted_metal_01.mtl` (Tönung 0.053/0.053/0.053, GlossMult 0.5498489737510681, UVTiling 12, ohne Farbkarte); WearLayer1 `iron_scratched_dark.mtl` (Tönung 0.156/0.156/0.156, GlossMult 0.6800000071525574, UVTiling 12, ohne Farbkarte) | nicht über die Vertexfarbe (kein %WEAR_LAYER) | – |
| trim_metal_a_030 | HardSurface | Primary `trim_hightech_c.mtl` (Tönung 0.074/0.074/0.074, GlossMult 1, UVTiling 1, Karten d+n); Wear `trim_hightech_c_metal.mtl` (Tönung 1.000/1.000/1.000, GlossMult 0.5, UVTiling 1, ohne Farbkarte) | COLOR_0.a (Vertex-Alpha, HardSurface %WEAR_LAYER), WearBlendBase/WearDirtBlendFalloff in params | – |
| trim_greebles_a_031 | HardSurface | Primary `trim_hightech_d.mtl` (Tönung 1.000/1.000/1.000, GlossMult 1, UVTiling 1, Karten d+n) | – | – |
| metal_a_046 | HardSurface | Primary `steel_base_a.mtl` (Tönung 1.000/1.000/1.000, GlossMult 1, UVTiling 1, ohne Farbkarte) | – | – |

- Im Export ist COLOR_0 ein VEC4: RGB ist Abdunklung, A die Mischmaske der Wear-Schicht (0 bis 1, im Mittel 0,7 bis 0,96).
- **Der Bausatz trägt COLOR_0 jetzt als VEC4.** Bisher war es VEC3, das Alpha fehlte. Der Viewer liest also vier Kanäle.
- Die Wear-Karten liegen auf dem Knoten `wear_0` (Material `…paint_c_notint_044_wear`).
- `trim_hightech_c_metal` (Wear der Trimleiste) hat keine Farbkarte; seine Farbe ist sein Specular.

**4. Beiwerk.**
- Im Schacht selbst stehen außer dem Bausatz zwei Arten: 35 Lichtrahmen (`util_decal_light_set_a_rect_b`, MeshDecal) an den Wänden und 52 Leuchtengehäuse (`light_fluorescent_f`, 284 Dreiecke, deckend, Glas leuchtet) für die Bodenstrahler (`base`) und Leisten.
- Kabel, Rohre, Geländer und Leitern gibt es im Schacht nicht. Die Rohre stehen außen hinter der Wand, die Laufstege bei y −50/−86 liegen hinter der Wandebene.
- Die Gehäuse der Fluter und Leisten sind Teil der Rippen (`rib_top_a`) und Ecken (`corner_top_a`), sie sind also schon im Bausatz.

Am Rand, also auf dem Hallenboden bis 14 m um die Öffnung (y −50), liegen die Leitlinien:
- Die Decal-Meshes kamen im Export ohne Dreiecke, weil StarBreaker Decal-Materialien weglässt; die Knoten mit ihrer Lage blieben erhalten.
- Ich hole die Geometrie per `skin export` und die Untermaterial-ID aus der `.cgfm`.
- Das Material steht als Überschreibung im Brush-Satz der .soc: Typ 1, u16 bei +60 = cgf-Index, u16 bei +170 = Materialindex. Meist ist es `microtech_brand_a` / `_cityset`, Untermaterial `ident_a_primary` (blau, Diffuse 0/0,42/0,86) bzw. `ident_a_secondary`.

| Knoten | Spielmodell | Material / Untermaterial | Exemplare | Dreiecke |
|---|---|---|---|---|
| `deco_leuchte_0` | light_fluorescent_f | lowtech_prop_main_2_a / glows_a,decals_pom_a,metal_panels_a_paint | 52 | 284 |
| `deco_lichtrahmen_0` | util_decal_light_set_a_rect_b | util_decal_light_set_a_atlas_ugf / decal_light_atlas_ugf | 35 | 2 |
| `deco_chevron_0` | primary_ident_line_chevron_d_4m | microtech_brand_a / ident_a_primary | 4 | 2 |
| `deco_leitlinie_0` | lowtech_a_int_decal_8m_b | microtech_brand_a_cityset / ident_a_primary | 4 | 18 |
| `deco_chevron_1` | primary_ident_line_chevron_angle_b_2m | microtech_brand_a / ident_a_primary | 4 | 16 |
| `deco_leitlinie_1` | primary_ident_line_thick_a_2m | microtech_brand_a / ident_a_primary | 2 | 2 |
| `deco_chevron_2` | primary_ident_line_chevron_d_2m | microtech_brand_a / ident_a_primary | 2 | 2 |
| `deco_ecke_0` | primary_ident_line_thin_corner_bevel | microtech_brand_a / ident_a_primary | 5 | 3 |
| `deco_ecke_1` | lowtech_a_int_decal_corner_1m_a_mirrored | microtech_brand_a_cityset / ident_a_primary | 4 | 10 |
| `deco_pfeil_0` | secondary_ident_arrow_c | microtech_brand_a_cityset / ident_a_secondary | 2 | 2 |
| `deco_pfeil_1` | primary_ident_arrow_c | microtech_brand_a_cityset / ident_a_primary | 4 | 2 |
| `deco_chevron_3` | secondary_ident_line_chevron_angle_c_left | microtech_brand_a / ident_a_secondary | 2 | 26 |
| `deco_chevron_4` | primary_ident_line_chevron_a_2m | microtech_brand_a_cityset / ident_a_primary | 2 | 2 |
| `deco_chevron_5` | secondary_ident_line_chevron_angle_c_right | microtech_brand_a / ident_a_secondary | 2 | 26 |
| `deco_rahmen_0` | primary_ident_frame_a | microtech_brand_a / ident_a_primary | 1 | 2 |

Decal-Objekte am Rand (Typ 0x10 aus der .soc, wie in der Werkstatt). Das sind keine Warnstreifen oder Nummern, sondern Abnutzung:

| Knoten | Material | Exemplare |
|---|---|---|
| `decal_oel_0` | oil/oil_dirt | 17 |
| `decal_abnutzung_0` | weathered/gloss_wear_dark_b | 4 |
| `decal_kratzer_0` | scratches/scratches001a | 39 |
| `decal_abnutzung_1` | weathered/gloss_wear_dark_a | 20 |
| `decal_abnutzung_2` | weathered/gloss_wear_dark_c | 15 |
| `decal_oel_1` | oil/oil_var01 | 2 |
| `decal_pfuetze_0` | puddles/puddle_water_g | 7 |
| `decal_oel_2` | oil/oil_puddle_a | 1 |
| `decal_pfuetze_1` | puddles/puddle_water_c | 1 |

- `deco[].at` und `decals[].at` liegen im Schachtraum wie `lights[].pos`: `[x, y, z, Gierung°]`, die Gierung ist `null`, wenn das Teil nicht nur um Y gedreht ist.
- Bei `deco` stehen dazu die volle Drehung `q` (glTF) und der Maßstab. Bei `decals` stehen die Kantenlänge `size` und die Spieldrehung.
- Ursprung von `deco_*` ist der Bezugspunkt des Spielmodells.

**5. Projektortexturen:**

| Datei | Spielpfad | Lampen |  |
|---|---|---|---|
| `medtop-proj-0.webp` | textures/lights/generic/spot_075.tif | 58 | 984 B |
| `medtop-proj-1.webp` | textures/lights/generic/spot_100.dds | 23 | 868 B |
| `medtop-proj-2.webp` | textures/lights/generic/rect_half_100.dds | 4 | 704 B |
| `medtop-proj-3.webp` | textures/lights/square_light_large.dds | 6 | 1586 B |
| `medtop-proj-4.webp` | textures/lights/light_tubeblock_soft_x3.dds | 2 | 512 B |

Sie stehen in `lights[].projector = { path, url }`. Das Muster in `rect_half_100` gehört zu den vier `side_proj`.

**6. Größe.** Bausatz und Beiwerk:
- Der Bausatz selbst hat 7 060 Dreiecke, unverändert.
- Beiwerk: 15 Arten mit je 2 bis 284 Dreiecken und 9 Decal-Quadrate.
- Für die 46 Teile des Viewers bleibt es bei der Rechnung von `hangar-schacht`: unter 30 000 Dreiecke.
- Dazu kommen die Exemplare: 125 Beiwerk (davon 52 Leuchten zu 284 Dreiecken, zusammen etwa 15 000) und 106 Decals zu je 2 Dreiecken.

**7. Sicht.**
- Am PC habe ich den Spielschacht aus den Teilen gesetzt und gerendert: Schräg von oben zeigen Trimleiste und Randleiste ihre Paneele und orangen Streifen, die Lackwand ihre Abnutzung; um die Öffnung liegen die blauen Leitlinien, ein weiß gestreifter Chevron und Öl- und Kratzerspuren.
- Die Bilder sind nicht committet.
- Die neun alten Knoten behalten Namen und Rahmen.
