# Halle: Relief und Schichten der Spielmaterialien (2026-10-11)

Auslöser für die PC-Sitzung: **„Hallen-Relief“**. Anlass: Krisz 2026-10-11
11:10 zum Stand auf staging: „boden textur kann mehr tiefe bekommen, alles
geht wie gesagt in die richtige richtung aber es braucht tiefe alles
einfach“. Zuerst der Boden, dann Wände, Decke und Einrichtung.

## Befund (Cloud, am Artefakt `revelyork-single-lod1.glb` 1a878120)

- Der begehbare Boden (Draufsicht, 0,25-m-Raster, oberste nach oben
  zeigende Fläche) besteht aus: `metal_white_03` 5 725 m² (die hellen
  Platten), `metal_dotty_01_016` 1 593 m² (die gepunkteten Platten unter
  dem Schiff), `wood_largeplank_020` 1 328 m² (Holzstege an den Wänden),
  `metal_grey_04` 700 m² (dunkle Rinnen und Schienen), `starfarer
  wood_dark_00` 179 m², kleine Reste (`metal_mid_01`, `lights01_08`).
- **Keine dieser Flächen hat im Export ein Relief.** `metal_white_03` hat
  gar keine Normalenkarte, die von `metal_grey_04` (alle Fassungen),
  `wood_largeplank_020`, `floor_iron_07`, `metal_mid_01`,
  `wall_whitepaint_tint_01_01`, `plastic_white_08`, `plastic_black_01_024`
  sind konstant (Standardabweichung < 1 je Kanal). Nur
  `metal_dotty_01_016` trägt Punkte. Die größte Wandfläche
  `plastic_white01_06` hat ebenfalls keine Normalenkarte.
- Die Rauheit aus der Glätte ist bei den großen Flächen ein fester Wert
  nahe 0: `metal_white_03` und `plastic_white01_06` 0,033 überall. Das
  passt zu einem flachen Platzhalter-`_ddna` (Alpha 255), nicht zu einer
  echten Oberfläche. Der Viewer klemmt deshalb heute auf ≥ 0,34.
- Laut `extract-hangar-sources.mjs` sind viele `_ddna` der Halle **im
  Spiel selbst** flach (jeder BC5-Block 0/0/1). Das Relief der großen
  Flächen steckt dann woanders: in den **Schichtmaterialien** (MatLayers,
  `Layer`/`Path` → Schicht-`.mtl`, schon am 2026-10-07 in
  `hallentexturen.md` Befund 1 vermutet, nie aufgelöst), in Detailkarten
  oder in Höhenkarten (Parallax). Der Extraktor liest heute nur TexSlot1,
  2, 4 und die zweite Blendschicht (TexSlot9/12).

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.

### Teil A: Bericht (in diese Datei, Abschnitt „Befund PC“)

2. Für die Bodenmaterialien oben, dann für `plastic_white01_06`,
   `metal_white_02_07`, `metal_white_03_13`, `plastic_white_pattern_01_025`,
   `wood_oak_01`, `cables_01_012`: der vollständige Eintrag aus der `.mtl`
   (Shader, StringGenMask, alle `<Texture>` mit Slot, Datei und `TexMod`,
   alle PublicParams) und **alle `<MatLayers>`/`<Layer>` mit allen
   Attributen**. Für jede genannte Schicht-`.mtl` dasselbe (ihre Texturen,
   Kachelung, Parameter). Als knappe Tabelle je Material, keine XML-Blöcke.
3. Ob ein `_ddna` dieser Materialien oder ihrer Schichten wirklich Relief
   trägt (Standardabweichung der dekodierten X/Y), welche Höhenkarten
   (`_displ`, Parallax/POM) und Detailkarten es gibt.
4. Decals der Halle: welche Decal-Entities der socpak hat (Anzahl,
   Materialien, POM ja/nein) und ob sie in unserem Export stecken.
5. Spielbilder als Vergleich: bis zu acht öffentliche Bilder vom Inneren der
   Revel-&-York-Halle (Wiki, RSI-Comm-Links, Videos) nur lokal laden
   (`.cache/referenz/`, nie einchecken). Je Bild in drei Zeilen: Boden
   (Glanz, Spiegelung, Relief, Abnutzung), Wände, Licht (Farbe, Kontrast,
   Lichtinseln, Dunst). Dann die eigene Seite lokal mit echter GPU aus zwei
   bis drei ähnlichen Blickwinkeln ansehen und die Unterschiede nach
   Sichtbarkeit ordnen. Die Cloud kommt an diese Bilder nicht heran (Netz
   gesperrt) und hat nur SwiftShader.

### Teil B: bauen, nur wenn Teil A Schichten, Detail- oder Höhenkarten findet

6. Schichttexturen dekodieren (mip 1): Farbe ≤ 1024 px, `_ddna` als
   Normale (X/Y aus BC5, Z rekonstruieren) ≤ 1024 px, Glätte aus Alpha als
   Rauheit (1 − Glätte × GlossMult bzw. so, wie die `.mtl` es mischt),
   Höhenkarte falls vorhanden. WebP nach `public/hangar/hall/layers/`.
7. Daneben `public/hangar/hall/revelyork-single.layers.json`:
   `{ v: 1, materials: { "<glTF-Materialname>": { layers: [ { name, path,
   tiling: [u, v], tint: [r, g, b], glossMult, normal, rough, color?,
   height?, …alle Mischparameter wörtlich aus der .mtl } ], detail?, …} } }`.
   Kachelung relativ zu den UVs des Materials, so wie das Spiel sie
   anwendet. Wenn das Spiel Schichten über Vertexfarben oder eine Maske
   mischt: Kanal und Parameter nennen.
8. Im Manifest `src/data/hangar-assets.json` beim Hallen-Eintrag
   `layers: { url, bytes, v }`. Die GLBs bleiben unverändert (Nähte,
   Vertexfarben, Möbelschnitt hängen daran).
9. Budget: alle Schichtdateien zusammen ≤ 2 MB.
10. Selbstauskunft im Build: Materialien mit Schichten, Schicht-Normalen
    mit Relief (Soll > 0), flache Schicht-Normalen mit Namen.
11. Build + Gate (normal und `STAGING=1`), committen, pushen. Kein PR: Den
    Viewer verdrahtet die Cloud (`assets/hangar-viewer.js` gehört ihr),
    dann Sichtprüfung und Merge.

Rohdateien, `.mtl`-XML und Referenzbilder bleiben in `.cache/`.

## Was die Cloud parallel macht

Spiegelung: Der Boden spiegelt heute praktisch nichts
(`envMapIntensity` 0,05 für alle Hallenmaterialien, weil die
Umgebungskugel auch als diffuses Licht den Raum gleichmäßig aufhellte).
Die Cloud trennt Glanz von diffusem Licht und projiziert die Spiegelung auf
den Raumkasten, damit Platten Lampen, Wände und Glassäulen an der richtigen
Stelle spiegeln. Die echte Glätte kommt dann aus Teil B.

## Befund PC

PC-Lauf 2026-10-12. Quelle: `.mtl` aus der Data.p4k (Cache
`.cache/hangar-src/hall-raw/`), Texturen mip 1 dekodiert, Rohblöcke der
`_ddna` direkt aus der p4k gezählt (`dds merge`, BC5-Blöcke je Mip-Stufe).

**Ergebnis vorweg: Keines der Materialien hat Schichten, Detail- oder
Höhenkarten. Teil B entfällt.** Alle sind `Illum` mit direkten Texturen;
`<MatLayers>` gibt es in keinem dieser Untermaterialien. Die flachen `_ddna`
sind im Spiel flach (jede Mip-Stufe ein einziger, wiederholter BC5-Block),
kein Dekodierfehler. Information tragen sie nur in der Glätte (Alpha).

### Materialien (Slot: Datei, TexMod; Normalen σX/σY der dekodierten Karte)

| glTF-Material | StringGenMask | Farbe (TexSlot1) | Normale (TexSlot2) | weitere Slots | Glätte (Alpha) | PublicParams |
|---|---|---|---|---|---|---|
| metal_white_03 (kit 3) | NORMAL_MAP, VERTCOLORS | metalpaintedfloor_worn_13_diff, Diffuse 0,644 | metalpaintedfloor_worn_13_ddna: **flach** (1 Block) | – | 225–249, Ø 247 | – |
| metal_dotty_01_016 (kit 16) | NORMAL_MAP, VERTCOLORS | metalpainted_worn_14_diff, Diffuse 0,658 | metalpainted_worn_14_ddna: **Relief** σ 13,0/12,8 (3 653 Blöcke) | – | 88–247, Ø 223 | – |
| wood_largeplank_020 (kit 20) | NORMAL_MAP | wood_clean_mahogany_06_diff | wood_clean_mahogany_06_ddna: fast flach σ 0,6/0,1 (84 Blöcke auf 2048 px) | – | 67–248, Ø 222 | – |
| metal_grey_04 (kit 4) | NORMAL_MAP, SPECULAR_MAP | conductor_diff, TexMod TileU/V 2 | aluminum_scratched_01_ddna: fast flach σ 0,4 | TexSlot4 aluminum_scratched_01_spec (Metallfarbe) | 0–238, Ø 212 | – |
| starfarer wood_dark_00 | NORMAL_MAP, VERTCOLORS | metalpainted_worn_14_diff, Diffuse 0,19/0,21/0,22 | metalpainted_worn_14_ddna: **Relief** | – | 88–247 | – |
| metal_mid_01 (generic_wall 1) | NORMAL_MAP, BLENDLAYER, VERTCOLORS | conductor_diff | metal_wall_rustedpaint…_blend_ddna: schwach σ 1,2 | TexSlot3 metal_worn_paint_01_ddna, TexSlot9 metal_worn_paint_03_diff, TexSlot12 …_blend_mask | 0–241 | BlendFactor 6,07, BlendFalloff 26,6, BlendLayer2Tiling 4, Glossiness 255 (schon eingebacken) |
| lights01_08 (kit 8) | NORMAL_MAP, VERTCOLORS | glow_pattern_grey_01_diff, TexMod 3×3 | glow_pattern_yellow_01_ddna: Relief σ 6,6/4,6 | – | 182–255 | – |
| plastic_white01_06 (kit 6) | NORMAL_MAP, VERTCOLORS | plastic_white_01_diff | metalpaintedfloor_worn_13_ddna: **flach** | – | 225–249, Ø 247 | – |
| metal_white_02_07 (kit 7) | NORMAL_MAP, BLENDLAYER, VERTCOLORS | plastic_white_03_diff, Diffuse 0,80 | plastic_white_03_ddna: **flach** | TexSlot3 dieselbe (flach), TexSlot9 plastic_white_03_diff, TexSlot12 metalpainted_worn_05_mask | 197–242 | BlendFactor 5,33, BlendFalloff 4,5, Glossiness 113 (schon eingebacken) |
| metal_white_03_13 (kit 13) | NORMAL_MAP, VERTCOLORS | metalpainted_clean_01_diff | metalpainted_clean_01_ddna: **flach** (1 Block) | – | 238–246 | – |
| plastic_white_pattern_01_025 (kit 25) | NORMAL_MAP, VERTCOLORS | metalpainted_clean_01_diff, TexMod 0,5×0,5, Diffuse 0,80, Specular 0,58 | plasticpattern_worn_01_ddna: **flach** | – | 176–250 | – |
| wood_oak_01 (kit 1) | NORMAL_MAP | wood_clean_oak_02_diff | wood_clean_oak_02_ddna: **flach** (1 Block) | – | 178–248 | – |
| cables_01_012 (kit 12) | NORMAL_MAP | cableelectric_worn_unique_uee_02_diff | …_ddna: **Relief** σ 14,9/20,3 | – | 0–211 | – |

Alle: Shader `Illum`, keine `<MatLayers>`, keine Höhenkarte (`_displ`),
keine Detailkarte. Schichtmaterialien gibt es damit nicht zu verfolgen.

### Glätte statt Relief

Wo die Normale flach ist, variiert die Glätte trotzdem leicht
(z. B. `metal_white_03` 225–249 statt fest 255). Daraus entsteht heute
schon die Rauheitskarte (1 − Glätte). Bei `metal_white_03` und
`plastic_white01_06` liegt die Rauheit damit bei 0,02–0,12, im Mittel
0,03: Das sind im Spiel sehr glatte, glänzende Lackflächen. Die Tiefe
erzeugt das Spiel dort über Spiegelungen (Sonden zur Laufzeit) und
Vertex-Abdunkelung, nicht über Relief.

### Decals

Keine eigenen Decal-Entities im socpak. Abziehbilder sind Untermaterialien
mit `%DECAL` auf den Bausatz-Meshes; alle stecken in unserem Export
(13 Materialien, u. a. `decals_landing_door_015`, `decals_buggy_parking_030`,
`decals_small_symbols_05`, `nernies_deluxe_010`, `deluxe_revel_logos_08`,
`markings_dc_018`, `Scratches_022`). POM tragen nur zwei kleine
Requisiten-Decals (`prop_dumper_dolly_a … pom_01`,
`levski_prop_elevator_button_idle … pom_decal_04`), Detail-Mapping nur der
Aufzugsknopf (`levski_prop_elevator_button_idle button_01`, `rubber_03`).

### Punkt 5 (Spielbilder, GPU-Ansicht)

Nicht gemacht: Das Laden fremder Bilder aus dem Netz und die lokalen
Renders brauchen Krisz' Freigabe (Downloads; Renders hat der Auto-Modus des
PCs früher blockiert). Angefragt.
