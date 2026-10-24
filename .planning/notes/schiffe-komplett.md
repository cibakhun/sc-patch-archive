# Schiffe komplett: ein Rohbestand aller Hangar-Schiffe aus 4.10.2

Stand 2026-10-24. Krisz, 23.10.2026: „hole alle schiffstexturen, finishes,
interiors am besten wenns geht, einfach mal alles was mit schiff und schiff
textur zutun hat“. Statt Schiff für Schiff nachzuziehen (veraltete
Constellation, flache Rümpfe, Muster-Lacke nur als Farbe) holt der PC einmal
alles, was die Seite brauchen kann, in den gitignorierten Rohbestand, und baut
daraus, was jetzt schon passt. Branch `pc/schiffe-komplett` von `origin/staging`.

## Was im Archiv steckt (Data.p4k 4.10.2, CL 12913470)

| Bereich | Dateien | entpackt |
|---|---|---|
| `Objects/Spaceships` (Geometrie, Schiffstexturen, .mtl) | 296 290 | 51,0 GB |
| `Objects/Vehicles` (Bodenfahrzeuge) | 6 420 | 1,4 GB |
| `Textures/vehicles` (Schichten, Decals, Logos) | 11 872 | 5,2 GB |
| `Materials/vehicles` (Schicht-.mtl) | 591 | 0,02 GB |
| `ObjectContainers/Ships` (Innenräume als socpak) | 651 | 1,0 GB |

Texturen: 5 825 Bilder unter `Objects/Spaceships` (19,5 GB alle Mips, davon
8,1 GB Normalen/Glätte `_ddna`, 5,4 GB Farbe), 1 248 unter `Textures/vehicles`
(5,2 GB). Lacke: 555 eigene Lack-.mtl (SubGeometry-Material), 347 davon mit
eigenen Karten (468 Bilder, 1,7 GB): Camo-Masken, Logos, Graffiti, Decal-Atlanten.

## Rohbestand (gitignoriert, nur PC)

`node scripts/extract-hangar-sources.mjs ships` holt jedes Schiff aus
`src/data/holo-meshes.json` (231), die 20 bisherigen zuerst:

- **`.cache/hangar-src/ships/<slug>.glb`**: `entity export <Record> --materials all
  --mip 1 --lod 1`, mit Innenraum (Container als Knoten `interior_*` unter der
  Wurzel). `--materials all` statt `textures`: Schichtmaterialien (Rumpf,
  Lackkanäle) bekommen Normalen- und Metall/Rauheitskarten, vorher hatten sie
  nur Farbe (Gladius: 140 von 182 Materialien mit mehr Karten, +5 % Rohgröße).
- **`<slug>.json`** daneben: Record, Exportschalter und Spielstand
  (`build_manifest.id`). Ein neuer Patch oder andere Schalter machen den Eintrag
  veraltet, der Extraktor holt ihn dann neu; sonst überspringt er ihn.
- **Record mit `_GS`-Vorrang** wie `scripts/lib/vehicle-records.mjs`:
  Constellation Andromeda/Aquila/Phoenix/Taurus und Hammerhead kommen aus dem
  4.10.2-Neubau. Vorher nahm StarBreaker den kürzesten Treffer, den alten Record.
- **`.cache/hangar-src/ships-dec/`**: derselbe Record als zerlegter Export in
  einen gemeinsamen Ordner (geteilte Karten liegen einmal). Je Schiff ein Paket
  `Packages/<Anzeigename>_LOD1_TEX1/` mit `paints.json` (Lackvarianten:
  SubGeometry-Tag, Palette, eigene .mtl), `palettes.json` (Farben A/B/C/Glas,
  Finish je Kanal, Palettendecal), `liveries.json`, `scene.json`; je .mtl eine
  `<mtl>_TEX1.materials.json` mit allen Untermaterialien (Shader, Schichten
  samt Kartenpfaden, Stencil, Public Params); alle Karten als PNG (mip 1).
  `index.json` ordnet Slug -> Record -> Paket. Die Meshes liegen dort als
  zstd-gepackte .blend und sind für uns ohne Nutzen.
- Speichergrenze 24 GB je Export; ein Großschiff darüber kommt ohne Innenraum.

## Was der Build daraus macht (`scripts/build-hangar-assets.mjs`)

- **Innenraum** fällt für die Außenfassung weg (`dropInterior`), außer bei den
  Jägern mit Blick ins Cockpit (`KEEP_INTERIOR`, wie bisher). Der Rohexport
  trägt ihn trotzdem, für eine spätere Innenansicht.
- **Web-Schiffe**: wie bisher die, die schon im Manifest stehen; weitere mit
  `--ships a,b` (oder `all`). Probelauf ohne Folgen: `HANGAR_OUT=<ordner>`
  schreibt Modelle und Manifest dorthin, `--kind ships` lässt den Rest stehen.
- **Herkunft im Manifest**: `ships.<slug>.record`, `.game` (CL), `.interiorDropped`.
- **Lackkanäle** (`palette_tint`) folgen der Palette des Records; vorher fand
  die Constellation keine (Palette `…_andromeda_gs`, gesucht `…_andromeda`).
- **Lack-Bauplan** `public/hangar/paints/<slug>.json` (Manifest `ships.<slug>.paints`),
  Karten unter `public/hangar/paints/tex/` (≤ 512 px, .webp, schiffsübergreifend
  geteilt). Siehe Datenvertrag unten.
- **Gerätekatalog**: Werkstatt-Requisiten mit Alpha-Test behalten ihre Karten
  (`ausschnitt` in `werkstattPlan`), einfarbig verloren sie die Löcher:
  Cyclone-Gitter (MASK 0,33), Gitter im Garagentor (0,25), ROC-Frachtnetz (0,02).
- `scripts/build-holo-meshes.mjs --src hangar` baut die Holo-Modelle aus diesem
  Rohbestand (ohne Innenraum). Für diesen Lauf nicht nötig: die Holo-Fassungen
  der _GS-Schiffe sind schon die Neubauten (Datenlauf 4.10.2, gleicher Hüllquader).

## Datenvertrag Lack-Bauplan (für den Viewer)

```
{ v: 1, ship, package,
  paints: [ {
    tag,                 // SubGeometry-Tag, = ship-paints.json paints[].tag
    ids: [ … ],          // Kennungen aus ship-paints.json / hangar-layouts.json mit diesem Tag
    name,                // Anzeigename des Spiels oder null
    palette: { a, b, c, glass,            // #rrggbb (sRGB), wie ship-paints.json
               finish: { a|b|c: { gloss: 0–255|null, specular: #rrggbb|null } },
               decal: { map, colors: [#R, #G, #B] } | null },   // Logo-Schablone $TintPaletteDecal
    materials: {         // nur GLB-Materialien, die dieser Lack gegenüber dem Serienmaterial ändert
      "<GLB-Materialname>": {
        stencil: { map, uv: 0|1, tiling, tint, opacity, colors: [3× #rrggbb|null],
                   specular: [3× #rrggbb|null], breakup, breakupTiling, sticker },
        layers: [ { name, mtl, palette: 1|2|3|null, tint: "r,g,b", gloss, tiling,
                    diffuse?, normal? } ]       // Karten nur, wenn die Schicht-.mtl wechselt
      } } } ] }
```

- Materialien mit Lack-Änderung tragen im GLB `extras.paint` (= ihr Name);
  `dedup()` legt sie deshalb nicht mehr mit gleich aussehenden zusammen.
- **Stencil**: `%STENCIL_MAP` ist laut `HardSurface.ext` eine dreikanalige
  SDF-Maske (Kanäle R/G/B je eine Fläche, Kante bei 0,5, `breakup` franst sie
  aus). `uv: 1` = zweiter UV-Satz (TEXCOORD_1). Die Zuordnung Kanal -> Farbe
  (Palette A/B/C, `StencilDiffuseColor1–3`, `StencilTintOverride`) ist aus den
  Daten nicht eindeutig; die Werte stehen roh drin. Für die Umsetzung braucht
  es Vergleichsbilder aus dem Spiel (z. B. Gladius Nightbreak, Frostbite).
- **Finish**: `specular` hoch und farbig = Metall (Gold, Chrom), `gloss` = Glätte.
  Heute färbt der Viewer nur die Grundfarbe um.
- **Decal**: die Logo-Meshes (Untermaterial `stencil`, Shader MeshDecal mit
  `$TintPaletteDecal`) wirft der Build weiter weg (`DROP_MAT`), sonst lägen
  sie als weiße Platten auf dem Rumpf. Sobald der Viewer `palette.decal`
  zeichnet, kann der Build sie behalten.
