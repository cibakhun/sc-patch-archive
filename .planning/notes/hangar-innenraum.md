# Hangar: Innenraum-Materialien nachtragen (2026-10-27)

Auslöser für die PC-Sitzung: **„Hangar-Innenraum“**. Derselbe Satz noch
einmal setzt den Lauf fort, wo er stand.

Anlass, Krisz 2026-10-27 21:05 mit Bild eines Cockpits auf staging (schwarze
Hülle mit Goldring, nach Form und Lack eine 325a): „was ist mit schiff
interior?“ Sitz, Konsolen und Wände hinter der Haube sind reinweiß, die Hülle
trägt ihre Texturen.

Ziel: Kein Schiff im Hangar zeigt mehr Flächen ohne Spielmaterial. Cockpit,
Sitz, Konsolen, Innenraum, Triebwerke und Fahrwerk tragen das Material, das
das Spiel ihnen gibt. Es gelten die Regeln aus
[`hangar-katalog.md`](hangar-katalog.md): alles aus dem Spiel, keine
Roh-Exporte, kein `.mtl`-XML und keine Rohtexturen im Repo.

## Befund aus der Cloud

- **Kein Viewer- und kein Shader-Problem.** Die weißen Flächen tragen in der
  Web-Fassung ein Material ohne Namen: Grundfarbe 0,8, Rauheit 0,5, keine
  Karte. Das ist der Platzhalter des Exports für „kein Material gefunden“.
- **Betroffen** (Dreiecke ohne Material in `public/hangar/ships/*.glb`, Anteil
  am Schiff): 315p 87 799 (44 %), 325a 85 417 (40 %), 300i 82 294 (46 %),
  350r 72 582 (38 %), Hornet F7C 20 118 (10 %), Mantis 15 133, Nox und
  Nox Kue je 9 749 (11 bzw. 16 %), M50 2 592, Meteor 2 036, dazu 16 Schiffe
  mit 8 bis 448 (Hornet Mk II, Talon, Javelin, Syulen, Caterpillar, P-52,
  Scorpius Antares, Constellation Andromeda/Aquila). 26 Schiffe.
- **Rohexport 300i** (`.cache/hangar-src/ships/orig-300i.glb`): 67 440
  Dreiecke außerhalb und 14 912 innerhalb der `interior_*`-Container ohne
  Material. Größte Meshes: `300i_Thruster_Mav_Joint` 18 048,
  `orig_300i_interior` 13 429, `orig_300i_seat` 12 322, Fahrwerk
  (`BONE_LandingGear_*`), `300i_Thruster_Main`, `300i_intake`,
  `300i_rear_cargo_cover`, `…/orig_300i_bathroom.cga`, `…_fridge_door.cga`,
  `TV`, `bed`, `pedal_*`, `console`, `ejection_handle`,
  `…/ORIG_300i_Personal_Storage.cga`.
- **Ursache** im zerlegten Export (`ships-dec/Packages/<Paket>/scene.json`):
  Genau diese Entities und Container-Teile stehen dort mit
  `material_path: "Data/"` und `material_sidecar: null`. Der DataCore nennt
  für sie kein Material, und StarBreaker fällt dann nicht auf das Material
  zurück, das die `.cga`/`.cgf`/`.skin` selbst nennt. Das Spiel tut das.
  - 300i: `ORIG_300I_Seat_Pilot.cga`, `ORIG_300I_SeatAccess(_Ladder).cga`,
    `ORIG_300I_Dashboard_Pilot.cga`, Yoke und Waffenhalter
    (`ORIG_350r_winglet_nose_left.cga`), `ORIG_300I_Intake.cga`, alle
    `ORIG_300_Thrusters/*.cga`, `300I_LandingGear_*_SKIN.skin`,
    `ORIG_300I_cargo_cover_rear.cga`, `ORIG_300I_Bed.cga`,
    `ORIG_300I_Weapon_Rack.cga`; im Container `base_int_body_main`:
    `ORIG_300I_Interior.cgf`, `…_Bathroom.cga`, `…_Fridge_Door.cga`,
    `ORIG_300i_Personal_Storage.cga`.
  - 350r: dasselbe, dazu `ORIG_350R_Interior.cgf` (obwohl
    `ORIG_350R_int.mtl` für andere Teile gefunden wird) und die Winglets.
  - Hornet F7C: `ANVL_Hornet_SeatAccess.cga`,
    `StorAll_BigBoxAnvilHornet.cga`. Nox: Sitz, Sitzzugang, alle Triebwerke,
    Täuschkörperwerfer.
- Die Hallen hatten dasselbe Problem; dort löst es `hallMaterialFix` in
  `scripts/extract-hangar-sources.mjs` (Materialpfad aus der `.cgf`,
  Untermaterial-IDs aus der `.cgfm`, `.mtl` geparst, Texturen nach
  `tex-m1/` dekodiert) und `applyMatFix` + `attachHallTextures` im Bau.
  Für Schiffe läuft das bisher nicht.
- Nicht Teil dieses Laufs: benannte Materialien ohne eigene Karte (z. B.
  `ORIG_X1_A:Interior_White`). Stichprobe X1: das ist im Spiel weißer
  Kunststoff (Schicht `Primary`, Diffus 1/1/1), also kein Fehler.

## Auftrag PC

0. Branch `pc/hangar-innenraum` von `origin/claude/project-thread-x4oyij`
   (staging plus diese Notiz). Vor jedem Push `npm run build && npm run
   gate`, nach dem Datenlauf zusätzlich `npm run gate:data`; ohne PR, die
   Cloud merged. Ohne Gegenansage von Teil zu Teil weiter.

### Teil A: Materialnachtrag für Schiffe (Extraktor)

1. Erst prüfen, ob die vorhandene StarBreaker-Fassung eine Option hat, die
   bei leerem `material_path` das Material der Geometrie nimmt. Wenn ja und
   ein Neuexport der 300i alles auflöst: die 26 Schiffe so neu exportieren
   (`--materials all --mip 1 --lod 1`, mit Innenraum wie bisher, der
   zerlegte Export ebenso) und weiter bei Teil B. Sonst Punkt 2.
2. Neuer Teil `ships-matfix` in `scripts/extract-hangar-sources.mjs`, je
   Schiff mit Rohexport und Primitiven ohne Material (nur diese):
   - die Meshes ohne Material mit ihren Index-Zahlen je Primitiv sammeln
     (wie `hallMaterialFix`);
   - die Quelle je Mesh aus `scene.json`: `children[].geometry_path` und
     `interiors[].placements[].cgf_path` mit `material_sidecar: null`. Bei
     einer `.cga` heißt das Mesh im Rohexport wie der Knoten darin
     (`orig_300i_seat`), bei einer `.cgf` wie der Pfad;
   - `.cga/.cgf/.skin` samt `.cgam/.cgfm/.skinm` (und `_lod1`) aus der
     Data.p4k holen, das `.mtl` aus der Geometrie lesen, die
     Untermaterial-IDs je Knoten aus der Submesh-Tabelle (bei mehreren
     Knoten je Datei: Zeilen nach Knoten trennen, über die Index-Zahlen
     zuordnen wie `readSubsets`);
   - `.mtl` parsen (`parseSubMaterials`), Texturen (Farbe, Normalen mit
     Glätte, Specular, Blendschicht) nach `tex-m1/` dekodieren; für
     Schicht-Materialien ohne eigene Farbkarte die Karten der ersten
     Schicht wie `layerMaterials` für Schacht und Werkhalle;
   - schreiben: `ships/<slug>.matfix.json` (Form wie bei der Halle,
     Schlüssel = Meshname im Rohexport) und bei Bedarf
     `ships/<slug>.layers.json`.
3. Selbstauskunft je Schiff: Dreiecke ohne Material vorher → nachher,
   gefundene `.mtl`, Untermaterialien, Texturen dekodiert/fehlend. Was nicht
   aufgeht, mit Mesh und Grund.

### Teil B: Bau

4. `scripts/build-hangar-assets.mjs`, `kind === 'ships'`: gibt es
   `ships/<slug>.matfix.json`, dann `applyMatFix`, dann `applyLayers` mit
   `ships`, und Texturen **nur an die nachgetragenen Materialien** hängen
   (`attachHallTextures` mit Filter auf Materialien aus dem Nachtrag; die
   eingebetteten Schiffstexturen und Lackkanäle bleiben unberührt).
   Nachgetragene Materialien bekommen kein `palette_tint`. Abdeckung vorher/
   nachher ins Manifest (`matfix`, `cover`) und ins Protokoll.
5. Die 26 Schiffe neu bauen über `scripts/build-hangar-alle.mjs --only
   <slugs> --redo` (dieselben Stufen gegen 16 MB, dieselbe Landestellung wie
   auf staging). Danach in jeder Web-Fassung: Dreiecke ohne Material = 0,
   sonst Grund im Befund.
6. `npm run check:hangar-shader -- --base <Vorschau> --ship <slug>` für
   325a, 300i, Hornet F7C, Nox: höchstens 16 Texturen je Bildshader.
7. Wenn möglich je ein Bild aus der Cockpitsicht (325a, Hornet F7C) vorher
   und nachher nach `.planning/notes/hangar-innenraum/` (klein, JPG); die
   Cloud sieht ohnehin selbst hin.

### Selbstauskunft am Ende

Die übliche Kopfzeile. Je Schiff: Dreiecke ohne Material vorher/nachher,
neue Materialien, Bytes GLB und neu in der Ablage, Stufe, höchste Zahl
Karten je Material. Summe GLB + Ablage gegen den Deckel von Tor [17].

## Cloud danach

`pc/hangar-innenraum` einmischen, in `verify:hangar` [17] eine Klinke
„Dreiecke ohne Material“ über alle Web-Schiffe (FEHLER über dem Stand,
vorgeführt rot), Cockpits im Viewer ansehen (325a, 300i, Hornet F7C, Nox),
PR auf staging, `check:staging` vom PC.

## Befund PC

(offen)
