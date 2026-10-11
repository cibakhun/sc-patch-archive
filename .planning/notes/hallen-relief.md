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

(noch offen)
