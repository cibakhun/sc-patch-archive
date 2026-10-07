# Hallentexturen: Befund und Auftrag (2026-10-07)

Auftrag für die PC-Sitzung (StarBreaker + Data.p4k, Schiene C). Gemessen an
`public/hangar/hall/revelyork-single.glb` aus PR #67 (71 Materialien,
65 Bilder) und an Nahaufnahmen im Browser.

## Befund

1. **Lackschichten fehlen.** Die großen Flächen nutzen CryEngine-Schichtmaterialien
   (MatLayers, `Layer`/`Path` → Schicht-`.mtl`): plastic_white01_06 (237k Dreiecke,
   Wände), metal_grey_04 (152k, Bodenplatten), metal_white_03 (74k). Exportiert
   ist nur die Grund-Farbkarte. Das ist eine allgemeine, gekachelte Schmutz-/Rauschtextur
   (z. B. Bild 0, 1024 px, Helligkeit 151–184). Es fehlen die Tönung (`TintColor`) und
   die Detail-Farb- und Reliefkarten der Schicht mit ihrer Kachelung (`TexMod TileU/TileV`)
   sowie die Abnutzungsmaske. Deshalb wirken Wände und Boden flach und einfarbig.
2. **10 von 30 Reliefkarten (Normalen) sind leer** und einfarbig (z. B. Bild 5, 512 px,
   konstant 142): metal_grey_04 (alle drei Fassungen), floor_iron_07, wood_dark_00,
   wood_largeplank_020, marble_01_019, decals_logo_027, wall_whitepaint_tint_01_01,
   glass_01_021. Vermutung: `_ddna` ist BC5 (zwei Kanäle), und beim Dekodieren landet
   kein X/Y, oder es wird die Glanz-Mip gelesen. Z muss aus X/Y rekonstruiert werden.
3. **plastic_white01_06 hat gar keine Reliefkarte**, obwohl es die größte Fläche ist.
   Sie steckt vermutlich in der Schicht.
4. Glanz: `_ddna` trägt im Alpha die Glätte. Daraus ließe sich eine Rauheitskarte machen
   (roughness = 1 − gloss); heute gilt ein fester Wert.
5. Kachelung der Grundtexturen passt grob: Median 1–4 m je UV-Einheit. Gestreckt ist
   davon nichts Auffälliges. Die Schicht-Kachelung kommt aber hinzu (Punkt 1).

## Auftrag

- In `scripts/extract-hangar-sources.mjs`: Schicht-`.mtl` der Hallenmaterialien
  auflösen. Diffuse und `_ddna` der Schicht dekodieren (mip 1, Farbe ≤1024 px,
  Normalen ≤512 px), dazu `TintColor`, `TileU/TileV` und, falls vorhanden, die
  Abnutzungsmaske.
- `_ddna` richtig dekodieren: X/Y aus BC5, Z rekonstruieren, Glätte aus Alpha als
  eigene Karte.
- In `scripts/build-hangar-assets.mjs`:
  - Schichtfarbe × Tönung als Farbkarte, gekachelt über `KHR_texture_transform`
    (three liest es). Alternativ in die UVs einrechnen.
  - Schicht-Normalen als Reliefkarte.
  - Rauheit aus Glätte.
  - Die bisherige Grundtextur als Schmutzschicht beibehalten, wenn das sinnvoll
    zu mischen ist; sonst ersetzen.
- Eine Selbstauskunft im Build: Wie viele Materialien haben Schichtfarbe, wie viele
  Reliefkarten, wie viele Reliefkarten sind einfarbig (soll 0, Glas ausgenommen)?
- Größe der Halle möglichst unter 10 MB halten (heute 6,2 MB).
- Nichts aus dem Viewer ändern (`assets/hangar-viewer.js` gehört der Cloud-Sitzung).
  Der Viewer dunkelt heute weiße Hallenflächen pauschal ab (×0,58 bzw. ×0,78) und
  behandelt metal_grey als Stahl. Das passe ich an, wenn die echte Tönung kommt.
- Build + Gate (normal und STAGING=1), committen und auf `claude/wot-hangar-hzs46w`
  pushen. Kein PR, kein Merge: die Sichtprüfung macht die Cloud.
