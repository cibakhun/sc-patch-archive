# Hangar: Werkstatt statt Ausstellungsraum (2026-10-16)

Auslöser für die PC-Sitzung: **„Hangar-Werkstatt“**. Der Lauf hat zwei
Teile: A (Werkstatt, neu, zuerst) und B (der liegengebliebene Auftrag
„Schacht-Tiefe“ aus [`hangar-schacht-tiefe.md`](hangar-schacht-tiefe.md)).
Wird die Zeit knapp, Teil A zuerst pushen.

Anlass: Krisz 2026-10-16 (über den Projekt-Chat): „okay das ganzer hangart
sieht iwi so steril aus, es wirkt nicht wie ein flugzeughnagar sozusagen,
es fehlt öl, cracks auf dem boden, beton, werkzeuge, schläuche, fuel,
diagnosegeräte etc etc etc“.

Lesart (ihm so gesagt, nicht korrigiert): Die Halle soll benutzt und
bearbeitet aussehen. Öl- und Treibstoffflecken und Risse auf dem Boden,
ein rauerer, betonartiger Boden, echtes Arbeitsgerät um das Schiff:
Werkzeugwagen, Schläuche, Tanks oder Pumpen, Diagnosestationen.

Regel 10-07 gilt: Geometrie und Texturen aus dem Spiel, nichts
Selbstgebautes, auch keine selbst gemalten Flecken. Die Anordnung soll,
wo es geht, aus einer Spielhalle übernommen werden statt erfunden. Keine
Bilder, keine Roh-Exporte, kein `.mtl`-XML committen (das Repo ist
öffentlich); alles Rohe bleibt in `.cache/`. Ausgeliefert werden nur die
gebauten, verkleinerten Dateien (Draco, WebP, Größengrenzen unten), so wie
Halle, Schiffe und Schacht; ob Spielinhalte öffentlich ausgeliefert werden
dürfen, entscheidet der Betreiber (der Hangar steht bisher nur auf
staging).

## Warum die Halle steril wirkt (Befund Cloud)

1. **Die Revel-&-York-Deluxe ist im Spiel ein Ausstellungsraum.** Alle
   Hallenmaterialien sind `Illum` ohne Schichten und ohne Abnutzungsmaske,
   die Bodenlacke sind spiegelglatt (Rauheit im Mittel 0,03), es gibt keine
   Decal-Entities (Befund PC vom 12.10. in
   [`hallen-relief.md`](hallen-relief.md)). Wir bilden das richtig ab; die
   Halle ist im Spiel genauso sauber.
2. **Die Abziehbilder der Halle sind Logos und Beschriftung.** Im Export
   stecken neun `%DECAL`-Materialien: Logos, Ziffern, Symbole,
   Landetor-Markierungen und eine Laufspur `leakings_019` (320 Dreiecke) an
   den Wänden. Auf dem Boden liegt nichts davon.
3. **Das Möbel (137 Stück) steht an den Wänden:** Kisten, Planen, Konsolen,
   Sitzgruppen. Um das Schiffsfeld (32 × 96 m) steht nichts, und nichts
   davon ist Werkstattgerät.

Ein benutzter Hangar muss also aus anderen Orten des Spiels kommen:
Abnutzung, Boden und Gerät aus Hallen und Werkstätten, die im Spiel
gearbeitet aussehen.

## Auftrag PC, Teil A: Werkstatt

1. `git pull` auf `claude/wot-hangar-hzs46w`.

### A1. Bericht (hier unter „Befund PC“, knappe Tabellen)

2. **Bodenabnutzung.** Im Spiel nach Boden-Decals suchen: Öl-, Treibstoff-
   und Kühlmittellachen, Laufspuren, Pfützen, Brandspuren von Triebwerken,
   Reifen- und Schleifspuren, Risse, ausgebesserter Beton, Schmutz,
   abgelaufene Bodenmarkierungen. Je Fund: Pfad, Art (Decal-Entity,
   `%DECAL`-Untermaterial, eigenes Mesh), Texturslots, Größe in m, POM ja
   oder nein, in welchen socpaks er vorkommt und wie oft.
3. **Bodenmaterialien.** Beton- und Industrieböden aus Spielhallen
   (Beton, gestrichener Beton mit Abnutzung, Stahlplatten mit Ölspuren,
   Gitterroste). Je Material: `.mtl`, Texturen mit Slot und Kachelung,
   Glätte, alle `<MatLayers>` mit Mischmaske, wo das Spiel es einsetzt.
4. **Werkstattgerät.** Requisiten suchen: Werkzeugwagen und -kisten,
   Werkbänke, Werkzeugwände, Schläuche und Schlauchtrommeln, Treibstofftanks,
   -pumpen und -wagen, Diagnosestationen und Terminals auf Ständern,
   Generatoren und Stromaggregate, Bodenkabel und Kabelbrücken, Wagenheber,
   Stützen, Hebezeuge und Kräne, Fässer und Kanister, Auffangwannen,
   Leitern und Arbeitsbühnen, Transportwagen, Munitions- und Raketenwagen.
   Je Requisit: Pfad (`.cgf`/`.cga` oder Entity-Klasse), Dreiecke je
   LOD-Stufe, Materialien, Maße in m, welche Hallen es nutzen und wie oft.
5. **Anordnung aus dem Spiel.** Die ein oder zwei Spielhallen nehmen, die
   am meisten nach Arbeit aussehen (am meisten Gerät aus Punkt 4 nah am
   Landefeld; Kandidaten: die heutigen Hangar-Bausätze wie
   `hangar_medtop_*`, `hangar_lrgtop_*`, `hangar_smalltop_*`, Hallen in
   Städten und auf Stationen, ältere Industriehallen; was der PC findet,
   zählt). Daraus die Lage aller Requisiten und Boden-Decals relativ zur
   Mitte des Landefelds: `[x, z, drehungY, skalierung]` in m und Grad,
   dazu Größe und Ausrichtung des Felds. Die Cloud überträgt diese
   Anordnung auf unser Feld; so bleibt auch das Arrangement aus dem Spiel.

### A2. Export im selben Lauf (kein zweiter Satz nötig)

6. **Requisiten.** Je Art aus Punkt 4 bis zu drei, bevorzugt die, die die
   Anordnung aus Punkt 5 nutzt. LOD-Stufe je Requisit so wählen, dass es
   ≤ 8 000 Dreiecke hat (große wie Kran oder Bühne ≤ 20 000), alle zusammen
   ≤ 150 000. Je Requisit ein Knoten `prop_<rolle>_<n>`, Ursprung unten
   mittig, +Y oben, Meter; die Vorderseite des Spiels in der JSON nennen.
   Materialien mit allen Schichten (Abnutzung, Schmutz) wie in
   Schacht-Tiefe Punkt 3: Rohwerte wörtlich, die Umrechnung macht die
   Cloud.
7. **Boden-Decals.** Alle aus Punkt 2, die die Anordnung nutzt, sonst bis
   zu drei je Art. Texturen (Farbe mit Alpha, Normale und Glätte, falls
   vorhanden) als Material im GLB; je Decal ein Knoten `decal_<rolle>_<n>`:
   das Spiel-Mesh, wenn es eins ist, sonst ein Einheitsquadrat 1 × 1 m in
   der XZ-Ebene mit der Größe in der JSON.
8. **Böden.** Bis zu zwei Materialien aus Punkt 3 als Texturset (Farbe,
   Normale, Glätte, Schichten und Masken) mit Kachelung in m, jeweils als
   Material an einem kleinen Musterquadrat `floor_<name>` im GLB.
9. **Dateien.** Zwei GLBs (Draco, WebP; Farbe ≤ 1024 px, Normalen und
   Masken ≤ 512 px): `public/hangar/hall/werkstatt.glb` mit den
   Requisiten, `public/hangar/hall/werkstatt-boden.glb` mit Decals und
   Böden (≤ 2 MB; Telefone und die Stufe niedrig laden nur diese). Dazu
   eine gemeinsame `public/hangar/hall/werkstatt.json`:

   ```
   { v: 1,
     props:  [ { node, rolle, path, tris, size: [x, y, z], front, from: [<socpak>, …], count } ],
     decals: [ { node, rolle, path, size: [w, l], alpha, pom, from: [ … ] } ],
     floors: [ { node, name, path, tiling: [u, v], layers: [ … ] } ],
     materials: { "<Materialname im GLB>": { layers: [ … ] } },
     layout: { source, pad: { size: [x, z], dir }, items: [ { node, at: [x, z, drehungY, skalierung] } ] } }
   ```

   Alles zusammen ≤ 8 MB. Manifest `src/data/hangar-assets.json`: neuer
   Schlüssel `props` mit `werkstatt: { url, v, json, bytes, tris, boden:
   { url, v, bytes }, props, decals, floors }` (neue Art `props` in
   `scripts/build-hangar-assets.mjs`, so wie `lift`). `at` der Anordnung
   in denselben Achsen wie die GLBs (Y oben), Drehung in Grad um Y.
10. **Selbstauskunft** im Build: Requisiten mit Dreiecken, Decals, Böden,
    Einträge der Anordnung, Bytes je Datei. Steht im Spiel etwas davon
    nicht, das klar sagen (zum Beispiel: keine Boden-Risse als Decal);
    dann fehlt es eben.

## Auftrag PC, Teil B: Schacht-Tiefe

11. Die Punkte 2 bis 7 aus [`hangar-schacht-tiefe.md`](hangar-schacht-tiefe.md)
    im selben Lauf (UVs des Bausatzes, Schichten, Beiwerk, Projektortexturen,
    Packen, Selbstauskunft). Befund dort eintragen.

## Abschluss PC

12. Vor dem Push `npm run build && npm run gate` (normal und `STAGING=1`).
    Das Tor [11] in `verify:hangar-hall` prüft den Schacht wie gehabt. Auf
    den Branch, ohne PR. Einbau, Merge nach staging und Vorher/Nachher
    macht die Cloud.

## Cloud (läuft parallel, wartet nicht auf den PC)

- Den Viewer auf `props.werkstatt` vorbereiten: optional laden (ohne
  Eintrag bleibt die Halle wie heute), Requisiten nach `layout` um das Feld
  stellen, Decals flach auf den Boden (gegen Flimmern versetzt wie die
  Wand-Decals seit #98), zusammengefasst je Material.
- Budget: Stufe hoch höchstens 40 Zeichenbefehle mehr, mittel höchstens
  20, niedrig und Telefone nur Decals (höchstens 5). Die statischen
  Schatten der Deckenspots nehmen die Requisiten mit; die Requisiten fahren
  nicht mit dem Aufzug, außer sie stehen im Feld.
- Ein Betonboden aus Teil A ersetzt die Bodenlacke nur als Variante mit
  Vorher/Nachher; ob die Halle damit gewinnt, urteilt Krisz.
- Vorher/Nachher derselben Ansichten (Startansicht, flach über dem Boden
  am Schiff, von oben) nach dem Einbau auf staging.

## Befund PC

PC-Lauf 2026-10-17, Teil A.

**Woher.** Die Abnutzung steckt in den Industrie-Hangars `util_a` (Lorville, Levski, Nyx; Bausatz `hangar_{sml,med,lrg,xl}{top,frnt}_00x`). Ich habe 87 Hangar-socpaks ausgepackt: alle `util_a`, VFG Industrial, Self-Land und die verlassene Asteroidenbasis. Sieben davon habe ich zum Zählen der Requisiten exportiert.

**Boden-Decals stehen im Spiel nicht als Entity, sondern als eigener Objekttyp in der .soc.** Er liegt im IncludedObjects-Chunk `0x10010`, Satztyp `0x10`. StarBreaker überspringt ihn (Protokoll „skipping Type10“), deshalb fehlten sie bisher in jedem Export.
- Das Format habe ich entschlüsselt (132 Byte je Satz):
  - Weltbox (6 double)
  - Drehung (x, y, z, w)
  - Lage im Container-Raum
  - Halbmaß s: das Decal ist ein Würfel, die Fläche 2 s × 2 s
  - Index in die Materialtabelle des Chunks (256-Byte-Pfade)
- Der Leser steckt jetzt im Extraktor (`socDecals`).
- Boden-Decals erkennt man daran, dass sie sich nur um Z drehen.
- Kein Decal hat POM.

### A1.2 Bodenabnutzung (Decal-Objekte, Spiel-Materialien unter `Materials/Decals`)

Gezählt auf dem Boden in 87 socpaks; Kante = Median 2 s.

| Material | Boden | Wand | socpaks | Kante | Karten |
|---|---|---|---|---|---|
| oil/oil_dirt | 1 202 | 274 | 38 | 2,7 m | TexSlot1 Farbe+Alpha, TexSlot2 ddna |
| scratches/scratches001a | 834 | 162 | 29 | 3,0 m | Farbe+Alpha, ddna |
| dirty_rust/dirty_rust_c | 679 | 101 | 27 | 10,0 m | Farbe+Alpha |
| weathered/gloss_wear_dark_a/b/c, light_b | 332/190/123/110 | 3/0/10/0 | 28–29 | 3–4,8 m | Farbe+Alpha |
| puddles/puddle_water_a/b/c/e/f | 320/81/95/27/49 | 0 | 21–29 | 1,8–2,9 m | Farbe+Alpha |
| oil/oil_line_ramp_a | 233 | 0 | 34 | 3,2 m | Farbe+Alpha, ddna |
| rubber_dmg/scuffs_a/b (Abrieb) | 216/153 | 0 | 26 | 4,5 m | Farbe+Alpha |
| dust/dust_spots_blue_a | 135 | 27 | 24 | 2,7 m | Farbe (5× gekachelt), Deckkraft aus Maske TexSlot12 (%OPACITY_MAP) |
| manmade_marking/arrow_marking_a | 123 | 0 | 20 | 1,2 m | Farbe+Alpha |
| oil/oil_line_a | 105 | 67 | 18 | 13,2 m | Farbe+Alpha, ddna |
| streaks/tire_streak002 (Reifenspur) | 81 | 0 | 24 | 4,4 m | Farbe+Alpha |
| oil/fs_oil_dirt | 61 | 0 | 9 | 9,4 m | Farbe+Alpha |
| oil/oil_puddle_a (Öllache) | 32 | 0 | 10 | 6,2 m | Farbe+Alpha, ddna |
| oil/oil_splat_a | 5 | 0 | 3 | 14,9 m | Farbe+Alpha, ddna |
| **cracks/cracks_c (Riss)** | 3 | 0 | 3 | 5,2 m | Farbe+Alpha, ddna |
| pu/decal/concrete/decal_concrete_crack_b, _debris_a | 1 / 8 | 0 | 1 | 3,7 / 3,0 m | Farbe+Alpha, ddna |

Kaum vorhanden sind:
- **Risse**: nur 4 Stück in 4 Hallen (Grim HEX, Delving).
- **Brandspuren von Triebwerken**: keine (`damage_decals/scorch_v*` gibt es im Archiv, aber in keinem Hangar).
- **Kühlmittel**: keins.

Ausgebesserter Beton fehlt ebenfalls. Am nächsten kommen `dirty_rust` und `decal_concrete_debris_a`. Blut (`blood_spatter_b`, 81 auf Böden), Graffiti und Frost habe ich nicht übernommen.

### A1.3 Bodenmaterialien

| Material (Halle util_a medtop_002) | Wo | Schichten (Reihe nach) | Kachel |
|---|---|---|---|
| `util_a_default_mtl_asphalt_bare_025` | Aufzugsplattform (Landefeld) | Primary `asphalt_antislip_a.mtl` (asphalt_a_diff/ddna, Diffuse 0,023/0,020/0,019, GlossMult 0,4); Wear `asphalt_antislip_a_wear.mtl` (concrete_damaged_a, Diffuse 0,54/0,50/0,47, GlossMult 0,14) | 4 m je UV-Einheit |
| `util_a_default_mtl_secondary_tint_panel_floor_b_048` | Hallenboden, Schachtrand | Primary `panel_util_c.mtl`; Wear `panel_util_c_wear.mtl` (Tönung 0,17) | 9,49 m |
| `lowtech_alpha_ext_a_mtl_concrete_bare_024` | nur an Rippen | concretefloor_grunge_01 (Illum, keine Schichten) | — |

Gemischt wird die Wear-Schicht in diesen HardSurface-Materialien über die Vertexfarbe (Token VERTCOLORS/WEAR_LAYER, WearDirtBlendFalloff). Eine eigene Mischmaske gibt es nicht. Alle Rohwerte stehen in `werkstatt.json` unter `floors[].layers`.

### A1.4 Werkstattgerät

- **In den Industrie-Hangars:**
  - Diagnosekonsolen, Mobilgeneratoren
  - Kabeltrommeln (elf Bauarten), Bodenkabel, Luftschläuche, Feuerwehrschläuche
  - Gasflaschen, Treibstoffzellen, Fässer
  - Heizgerät, Schweißgerät, Akkubohrer, Ratsche, Werkzeugtasche
  - Lastenwagen, Waffen- und Metallkisten, Gabelstapler-Tank und -Konsole
- **Stark verbreitet** (je 20–29 der 87 socpaks): Werkzeug, Kabeltrommeln, Gasflaschen, Schweißgerät, Fässer, Treibstoffzellen.
- **Nicht in Hangars**, aber im Archiv:
  - `workbench_mobile_1_a`, `crane_welding_arm_1_a`, `trolley_creeper_1_a` (universal/uee)
  - `generator_oxygen_1_a`
- **Gar nicht im Spiel:** Wagenheber, Kräne in Hallengröße, Raketen- und Munitionswagen, Auffangwannen, Arbeitsbühnen. Die einzigen Gerüste stehen im Asteroiden-Hangar von VFG Industrial (`uee_asteroid_hangar_scaffolds_*`, je bis 21 000 Dreiecke).

### A1.5 Anordnung

| Halle | Boden-Decals am Feld (± 8 m) | Gerät am Feld (± 14 m) / im Raum (± 40 m) |
|---|---|---|
| **util_a hangar_medtop_002** | **48** | 25 / **101** |
| util_a hangar_medtop_001 | 41 | 20 / 76 |
| util_a hangar_medfrnt_002 | 39 | 33 / 98 |
| util_a hangar_medfrnt_001 | 33 | 26 / 65 |
| util_a hangar_lrg*/sml* | (Feldhöhe anders, nicht vergleichbar) | 50–118 im Raum |

Gewählt habe ich **util_a `hangar_medtop_002`**:
- Feld 56 × 88 m, dieselbe Größe wie der Schacht aus `hangar-schacht`.
- Längsachse z, Feldmitte im Spiel bei Container (−56, −66,99, 6,51).

Im Spiel ist das Feld selbst sauber, denn es ist die Aufzugsplattform mit Asphalt. Spuren und Gerät liegen rundherum: Öl, Abrieb und Pfeile am Feldrand, Gerät an den Wänden und in den Ecken.

### A2 Export

- `public/hangar/hall/werkstatt.glb`:
  - 2,65 MB, **25 Requisiten**, 105 970 Dreiecke (Grenze 150 000).
  - 153 Primitive, also Zeichenbefehle, wenn man jedes Requisit einmal zeichnet.
- `public/hangar/hall/werkstatt-boden.glb`: 1,87 MB.
  - **24 Decal-Arten** als Einheitsquadrat 1 × 1 m in XZ, Farbe mit Alpha, Normale wo vorhanden.
  - Zwei Böden: `floor_asphalt`, `floor_paneel`, je ein Musterquadrat 4 × 4 m und dazu `floor_*_wear` mit der Wear-Schicht.
  - Farbe 512 px, Normalen 256 px, WebP-Qualität 74, damit es unter 2 MB bleibt.
- `public/hangar/hall/werkstatt.json` (153 KB), `v: 1`:
  - `props` (`front: "-z"` = lokale +Y des Spiels)
  - `decals` (mit Spiel-Rohwerten, Texturgröße, `inLayout`)
  - `floors` (alle Schichten)
  - `materials` (76 Requisiten-Materialien mit allen Schichten)
  - `layout` (131 Einträge: 53 Requisiten, 78 Decals; `at = [x, z, Grad um Y, Maßstab]` relativ zur Feldmitte, dazu `y`)
- Zusammen 4,7 MB. Das Manifest hat den neuen Schlüssel `props.werkstatt`.

| Knoten | Spielmodell | LOD | Dreiecke | Maße x × y × z (m) | in der Halle | Prim. |
|---|---|---|---|---|---|---|
| `prop_kabel_0` | cable_straight_3_cable_2m_a | 0 | 800 | 0,60 × 1,99 × 0,27 | 3 | 3 |
| `prop_stapler_0` | machine_forklift_1_extension_tank_a | 0 | 3.014 | 1,08 × 1,29 × 1,08 | 2 | 8 |
| `prop_kabeltrommel_0` | cable_reel_6_a | 0 | 7.964 | 1,93 × 0,87 × 1,05 | 2 | 9 |
| `prop_schlauch_2` | fire_hose_1_a | 0 | 1.546 | 0,97 × 0,62 × 0,36 | 8 | 6 |
| `prop_kabel_2` | cable_bend_2_a | 0 | 1.128 | 0,92 × 1,20 × 2,30 | 1 | 3 |
| `prop_fass_0` | drum_dry_1_a | 0 | 5.534 | 0,50 × 1,00 × 0,50 | 2 | 4 |
| `prop_treibstoff_0` | cell_fuel_1_a | 0 | 1.640 | 0,24 × 0,78 × 0,55 | 4 | 3 |
| `prop_generator_0` | generator_mobile_1_b | 0 | 9.904 | 3,73 × 2,19 × 1,39 | 1 | 13 |
| `prop_kabel_1` | cable_straight_08x01x02_e | 0 | 3.522 | 6,69 × 0,46 × 2,66 | 1 | 2 |
| `prop_gasflasche_1` | tank_gas_1_0125x0125x0125_a | 0 | 6.788 | 1,28 × 1,24 × 1,29 | 1 | 5 |
| `prop_kiste_0` | crate_weapon_4_015x0075x0075_a | 0 | 7.858 | 1,50 × 0,75 × 0,75 | 2 | 5 |
| `prop_schlauch_1` | lt_airduct_hose_torn_a | 0 | 2.284 | 0,60 × 1,23 × 0,60 | 1 | 1 |
| `prop_schlauch_0` | lt_airduct_hose_straight_8m_a | 0 | 4.464 | 7,94 × 0,61 × 0,86 | 1 | 1 |
| `prop_kiste_1` | crate_metal_2_01x005x0025_a | 0 | 7.058 | 1,00 × 0,26 × 0,50 | 2 | 4 |
| `prop_kabeltrommel_1` | cable_reel_2_a | 0 | 4.496 | 1,44 × 0,47 × 0,92 | 2 | 9 |
| `prop_kabeltrommel_2` | cable_reel_11_a | 0 | 3.124 | 0,34 × 0,77 × 0,30 | 3 | 7 |
| `prop_werkzeug_2` | tool_manual_1_ratchet_a | 0 | 1.392 | 0,05 × 0,04 × 0,31 | 2 | 4 |
| `prop_werkzeug_1` | tool_power_1_drill_a | 0 | 2.448 | 0,34 × 0,18 × 0,24 | 1 | 6 |
| `prop_werkzeug_0` | tool_welder_a | 0 | 6.224 | 0,44 × 0,95 × 0,72 | 1 | 4 |
| `prop_gasflasche_0` | tank_gas_2_025x0125x0125_a | 1 | 4.386 | 2,17 × 1,04 × 1,02 | 5 | 5 |
| `prop_diagnose_0` | console_diagnostic_2_a | 1 | 4.002 | 1,17 × 1,69 × 1,11 | 1 | 10 |
| `prop_heizer_0` | heater_freestanding_1_a | 1 | 3.685 | 0,87 × 1,63 × 1,00 | 3 | 4 |
| `prop_generator_1` | generator_mobile_1_pirate_a | 1 | 5.073 | 0,50 × 0,63 × 0,74 | 2 | 9 |
| `prop_diagnose_1` | console_diagnostic_1_a | 1 | 3.562 | 0,93 × 1,12 × 1,23 | 1 | 11 |
| `prop_wagen_0` | trolley_cargo_4_a | 1 | 4.074 | 1,46 × 1,17 × 2,50 | 1 | 17 |

**Decals:**
- In der Anordnung (19 Arten): Abnutzung ×3, Pfeil, Abrieb ×2, Öl (oil_dirt, oil_line_ramp_a), Kratzer ×2, Rost, Pfützen ×6, Reifenspur, Staub.
- Zusätzlich ohne Anordnung (5): **Riss** `cracks_c`, **Riss** `decal_concrete_crack_b`, **Betonschutt**, **Öllache** `oil_puddle_a`, **Ölspritzer** `oil_splat_a`. Die Kantenlänge aus dem Spiel steht in `size`.

**Hinweise für den Einbau:**
- Wandgerät hängt im Spiel 1,6 m hoch an der Wand: Feuerwehrschlauch und Kabelkästen (`y`).
- Die Deckkraft im GLB ist Opacity × ColorBlendFactor. Der Rohwert steht in `decals[].game.params`.
- Pfützen sind im Spiel weiße Karten mit dunkler Diffuse-Farbe (0,02–0,07).
- Die Riss-Decals wirken in meinem Probebild hell. Erst ihre Normalenkarte macht sie zur Rille.
- Am PC habe ich die Anordnung um ein Feld gerendert: Asphalt, Spuren, Gerät, Öl und Risse. Die Bilder sind nicht committet.

**Geänderte Skripte:**
- Extraktor-Teil `werkstatt`: beide Stufen exportiert, Decals mit Materialien, alle Schichtmaterialien.
- Build-Art `props`: `buildWerkstatt`.
- Nebenbei: In der Art `lift` warf `prune` vor dem Anhängen der Texturen TEXCOORD_0 weg. Das betrifft Teil B.

## Einbau Cloud (17.10.2026)

- PR #114 (auf staging): Gerät und Decals nach der Anordnung, Spuren auf dem
  Feld (`WORK_FIELD`), Wartungsplatz am Schiff (`WORK_SERVICE`). Auf hoch rund
  4 % mehr Grafikzeit je Bild (gleiche Seite, abwechselnd mit und ohne).
- Feldboden (`WORK_PAD`): Auf dem Feld tragen Platten, Bänder und Fugen
  (`metal_dotty_01_016`, `metal_white_03`) die Karten eines Spielbodens aus
  der Bodendatei, auf die Fläche projiziert, Kachel aus `floors[].tiling`.
  Gewählt ist Beton (`floor_asphalt_wear`, die Wear-Schicht des
  Aufzugsasphalts); `?boden=asphalt` zeigt den Asphalt selbst, `?boden=lack`
  den Lack. Die Mischung über die Vertexfarbe des Spiels gibt es hier nicht
  (das Feld der Halle trägt keine), deshalb ganz Beton oder ganz Asphalt.
  Gleiche Zeichenbefehle, kleinere Karten als der Lack (512 statt 1024 px).
  Vergleich: /mnt/project-files/hangar/v37-feldboden-lack-beton-asphalt.png,
  Wahl liegt bei Krisz.
