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

Plan war: `pc/hangar-innenraum` einmischen, in `verify:hangar` eine Klinke
„Dreiecke ohne Material“ über alle Web-Schiffe (vorgeführt rot), Cockpits im
Viewer ansehen (325a, 300i, Hornet F7C, Nox), PR auf staging,
`check:staging` vom PC. Stand 28.10.2026:

- Eingemischt (Merge 4ccde68). Die Prüfung ist Tor **[18]** geworden, nicht
  [17] (das ist die Ablage). Erst als Deckel 390 151 in 26 Schiffen
  (089cde3), nach dem Nachtrag umgebaut: kein Schiff trägt Platzhalter außer
  `PLATZHALTER_AUSNAHMEN` (Caterpillar und Caterpillar Pirate je 22,
  Scorpius Antares 12, jede mit Anlass). Mehr Dreiecke als die Ausnahme
  deckt ist FEHLER, keine mehr auch (Zombie). Vorgeführt rot: Gladius-
  Material `metal_steel_025` ohne Namen → `aegs-gladius 25072 Dreiecke`;
  Scorpius-Platzhalter mit Namen → „Ausnahme … ohne Anlass … streichen“.
- Im echten Viewer (Software-WebGL, Stufe niedrig, Haube durchsichtig)
  angesehen: 325a Sitz schwarzes Leder, Konsolen mit blauen Leuchtstreifen,
  Triebwerksgondel schwarz mit „325A“ (vorher alles reinweiß); 300i Sitz,
  Steuer und Innenraum dunkel; Hornet F7C StorAll-Frachtluke dunkel mit
  Spielmaterial; Nox in der Werkhalle.
- Fahrwerk 300er (`gear: true` → `false`): an staging nachgemessen,
  `lg_hinge_front_left` steckt dort schon 3,70 m unter dem Boden, weit über
  `GEAR_SINK` 0,2, `standFor` gibt also heute schon `null`. Unsichtbar.
- Nicht von diesem Lauf (im Viewer per Strahl zugeordnet, Material schon
  auf staging): helle Platte oben am Heck der 300i =
  `orig_300i_ext_mtl_hull_d_014` (Lackfläche, Farbe e1e1e1); grünlich-graue
  Kästen oben auf der Nox = `VNCL_Scythe_mtl_vs_panels_b_02` (gleiche
  Dreieckszahl vorher und nachher).
- Sichturteil an Krisz: `.planning/WINDOWS.md` #123.
- `check:staging` geht aus der Cloud nicht (Cloudflare 403); nach dem Merge
  vom PC.

## Befund PC

PC-Lauf 27.10.2026, Branch `pc/hangar-innenraum` (Basis 9b6fe426),
Worktree `.claude/worktrees/hangar-innenraum`, Spielstand der Rohexporte
CL 12913470. Rohbestand `ships/`, `ships-dec/` aus dem Haupt-Checkout
(Junctions), `tex-m1/` aus wot-hangar.

**Ergebnis: Dreiecke ohne Material über alle 231 Web-Schiffe 390 151 → 56.**
23 der 26 Schiffe haben keine mehr; die 56 übrigen sind Lücken im Spiel
selbst (unten). Alle 26 in Stufe 0 gebaut (kein Abstrich gegen die 16 MB),
0 Fehler. Tor [17]: GLB 741,3 MB + Ablage 210,6 MB = **951,9 MB** (Deckel
1600 MB); die 26 Schiffe GLB 74,1 → 75,5 MB, Ablage +38 Bilder, 0,29 MB.

### Teil A: Nachtrag im Extraktor

1. StarBreaker 0.3.2 hat keine Option für den Rückfall auf das Material der
   Geometrie (`entity export --help`: nur `--materials none|colors|textures|all`,
   `--kind`, `--lod`, `--mip`, `--no-interior` u. a.). Also Punkt 2.
2. Neuer Teil `ships-matfix` (`node scripts/extract-hangar-sources.mjs
   ships-matfix --ships <slugs>`), Funktion `shipMaterialFix`:
   - **Material:** Jede Geometrie nennt ihr `.mtl` selbst, in drei
     Schreibweisen: `Data/Objects/…/Custom_Paint/orig_300_seat_black_wood.mtl`
     (Sitz 300i, mit `Data/` und Endung), `Objects/…/ORIG_300i_int.mtl`
     (Innenraum), bloß `BigBox.mtl` (StorAll-Box der Hornet F7C, liegt im
     Ordner der Geometrie). Fahrwerk (`.skin`) und Triebwerke nennen das
     Außen-`.mtl` (`ORIG_300i_ext`).
   - **Quelle je Mesh:** Vorfahrenknoten mit dem Namen einer Geometrie der
     zerlegten Szene (beim Fahrwerk ohne „_SKIN“), sonst der Entity-Knoten
     (M50-Haupttriebwerk hängt direkt an `ORIG_M50_Thruster_Main`), im
     Innenraum der Mesh-Name (Pfad oder Dateiname), zuletzt die übrigen
     Geometrien im Ordner des Kandidaten.
   - **Untermaterial je Primitiv:** nicht über Reihenfolge oder
     Dreieckszahl, sondern über den **Eckenbereich**. Alle Primitive eines
     Meshes teilen den Vertex-Puffer der Datei; die Teilnetz-Tabelle der
     `_lod1.cgam/.cgfm/.skinm` (48-Byte-Zeilen) trägt bei +12 `first_vertex`,
     bei +20 `num_vertices` (`readSubsets` liest beides jetzt mit). Ein
     Primitiv einer `.cga/.cgf` deckt sein Teilnetz genau; die je Knochen
     zerlegten Meshes einer `.skin` (Fahrwerk: 11 Meshes auf einem Puffer
     von 7367 Ecken) liegen darin. Bei den `.cdf`-Haupttriebwerken (350r,
     M50) trägt ein Puffer Düse und Gehäuse hintereinander: Versatz =
     Ecken der Düse (M50 11 748, Gehäuse `ORIG_M50_Main_Thruster_Housing`).
   - Schreibt `ships/<slug>.matfix.json` (je Mesh-Name `[{ mtl, ids, tris,
     geometry, lod, offset? }]`, je `.mtl` die Untermaterialien wie bei der
     Halle, dazu `decal`, `glow`, `layers`) und `ships/<slug>.layers.json`;
     dekodiert nur die Karten der Untermaterialien, die der Export noch
     nicht trägt.
3. Selbstauskunft (Rohexport, je Exemplar gezählt): 300i 82 352 → 0,
   315p 87 945 → 0, 325a 85 563 → 0, 350r 72 768 → 0, Hornet F7C 20 118 → 0,
   Mantis 22 038 → 0, Nox/Nox Kue je 9 749 → 0, M50 2 592 → 0, Meteor
   2 236 → 0, Hornet Mk II (6) je 448 → 0, Talon/Shrike je 304 → 0, Syulen
   122 → 0, P-52 20 → 0, Constellation Andromeda/Aquila je 20 → 0.
   **Was nicht aufgeht:**
   - Caterpillar (beide) `Camera02`, 22 Dreiecke:
     `DRAK_Caterpillar_Exterior.mtl` hat kein Untermaterial 54 (nur 53).
   - Scorpius Antares `TempBox`, 12 Dreiecke:
     `rsi_scorpius_antares_missile_turret.cga` nennt kein `.mtl`
     (Platzhalterbox).
   - Javelin: 630 044 Dreiecke im Rohbau-Innenraum nennen
     `Javelin_blockout1`, `aegs_javelin_hangar`,
     `aegs_javelin_gauntlet_hangar` — die `.mtl` gibt es im Spiel nicht.
     Die Web-Fassung lässt den Innenraum weg; dort sind es 0.

### Teil B: Bau

4. `scripts/build-hangar-assets.mjs`: `applyMatFix(doc, fix, { ship: true })`
   **vor** `dropJunk` (sonst bleiben nachgetragene `RTT_`/Stencil-Materialien
   stehen; Mantis −942, Meteor −80 Dreiecke), Treffer auf Materialien des
   Exports ohne Groß/Klein, neue Materialien heißen wie die des Exports
   (`_0<index>`) und tragen `extras.matfix`. Nur an diese gehen
   `applyLayers` und `attachHallTextures` (Parameter `only`); eingebettete
   Schiffskarten und Lackkanäle bleiben unberührt, kein `palette_tint`,
   Decals `BLEND`, Glow leuchtet (`extras.glow` wie beim Export). Manifest
   je Schiff `matfix` (fixed, reused, created, layered, dropped) und
   `cover` (vorher/nachher).
5. `node scripts/build-hangar-alle.mjs --only <26> --redo`: alle Stufe 0.
   Danach in jeder Web-Fassung Dreiecke ohne Material = 0, außer den drei
   oben. 23 GLBs geändert; beide Caterpillar und die Scorpius Antares
   kommen bytegleich zu staging heraus (nichts nachzutragen).

| Schiff | ohne Material vorher | nachher | neue Materialien | GLB MB vorher → nachher | neu in Ablage MB | Stufe | Karten je Material max. |
|---|---:|---:|---:|---:|---:|---:|---:|
| orig-315p | 87 799 | 0 | 22 | 1,41 → 1,70 | 0,00 | 0 | 4 |
| orig-325a | 85 417 | 0 | 20 | 1,51 → 1,82 | 0,00 | 0 | 4 |
| orig-300i | 82 294 | 0 | 24 | 1,22 → 1,50 | 0,10 | 0 | 4 |
| orig-350r | 72 582 | 0 | 22 | 1,29 → 1,59 | 0,01 | 0 | 4 |
| anvl-hornet-f7c | 20 118 | 0 | 5 | 1,67 → 1,76 | 0,05 | 0 | 4 |
| rsi-mantis | 15 133 | 0 | 0 | 2,18 → 2,21 | 0,00 | 0 | 5 |
| xian-nox-kue | 9 749 | 0 | 3 | 0,51 → 0,54 | 0,05 | 0 | 4 |
| xian-nox | 9 749 | 0 | 1 | 0,80 → 0,83 | 0,00 | 0 | 4 |
| orig-m50 | 2 592 | 0 | 0 | 1,73 → 1,74 | 0,00 | 0 | 4 |
| rsi-meteor | 2 036 | 0 | 1 | 2,63 → 2,63 | 0,00 | 0 | 5 |
| anvl-hornet-f7a-mk2 | 448 | 0 | 0 | 1,83 → 1,83 | 0,00 | 0 | 5 |
| anvl-hornet-f7c-mk2 | 406 | 0 | 0 | 1,76 → 1,76 | 0,00 | 0 | 5 |
| anvl-hornet-f7cs-mk2 | 390 | 0 | 0 | 1,78 → 1,78 | 0,00 | 0 | 5 |
| anvl-hornet-f7cr-mk2 | 360 | 0 | 0 | 1,86 → 1,86 | 0,00 | 0 | 5 |
| anvl-hornet-f7cm-mk2-heartseeker | 254 | 0 | 0 | 2,30 → 2,30 | 0,00 | 0 | 5 |
| anvl-hornet-f7cm-mk2 | 238 | 0 | 0 | 2,35 → 2,35 | 0,00 | 0 | 5 |
| aegs-javelin | 130 | 0 | 1 | 3,02 → 3,02 | 0,06 | 0 | 5 |
| espr-talon-shrike | 130 | 0 | 6 | 2,74 → 2,74 | 0,02 | 0 | 5 |
| espr-talon | 130 | 0 | 6 | 2,50 → 2,51 | 0,00 | 0 | 5 |
| gama-syulen | 106 | 0 | 4 | 2,85 → 2,86 | 0,00 | 0 | 5 |
| drak-caterpillar-pirate | 22 | 22 | 0 | 8,04 → 8,04 | 0,00 | 0 | 5 |
| drak-caterpillar | 22 | 22 | 0 | 8,04 → 8,04 | 0,00 | 0 | 5 |
| krig-p52-merlin | 18 | 0 | 1 | 1,86 → 1,86 | 0,00 | 0 | 5 |
| rsi-scorpius-antares | 12 | 12 | 0 | 2,93 → 2,93 | 0,00 | 0 | 5 |
| rsi-constellation-andromeda | 8 | 0 | 1 | 8,18 → 8,18 | 0,00 | 0 | 5 |
| rsi-constellation-aquila | 8 | 0 | 1 | 7,13 → 7,13 | 0,00 | 0 | 5 |

„Neue Materialien“ = aus dem `.mtl` angelegt; die übrigen Primitive gehen
auf Materialien, die der Export schon trägt (Mantis 33, M50 1, Hornet Mk II
je 4: dieselben Untermaterialien wie am Rumpf, mit dessen Karten).
„Ohne Material vorher“ = Web-Fassung auf staging, je Exemplar gezählt.

6. `check:hangar-shader` gegen `dist/` (Software-WebGL, Grenze 16), je
   Schiff höchstens 16 Texturen (die meisten haben Hallenmaterialien):
   325a ✓ 98 Programme, 300i ✓ 97, Hornet F7C ✓ 97, Nox ✓ 95. Der erste
   Lauf von 300i und Hornet meldete 2 bzw. 1 „Bild nicht geladen“, während
   das Tor daneben lief; die drei Bilder sind alte Ablage-Dateien (von 22
   bzw. 136 Schiffen geteilt), liegen in `dist/`, kommen mit 200 und
   dekodieren im Browser. Ohne Last daneben beide grün.

   Tore: `npm run build` grün, `npm run gate` 29 von 29 (Schiene A).
   `npm run gate:data` braucht die unversionierte Zwischenstufe von
   `datamine:loadouts` und `datamine:vehicles`; beide gefahren, Schiene B
   4 von 4 grün, danach `vehicles.json`, `ship-loadouts.json` und
   `ship-paints.json` auf den committeten Stand zurückgesetzt (der Lauf
   gehört nicht zu diesem Auftrag; die lokale Data.p4k ist CL 12913470,
   der Katalog CL 12881860).

7. Bilder (`hangar-innenraum/`, Blick von hinten über den Sitz, Haube
   ausgeblendet, eigene Render-Seite mit three.js): `325a-vorher.jpg` /
   `325a-nachher.jpg` (Sitz, Konsolen, Wände: weiß → schwarzes Leder mit
   Origin-Schriftzug, blaue Leuchtstreifen); Hornet F7C:
   `hornet-f7c-vorher/nachher.jpg` (Cockpit unverändert, dort war nichts
   ohne Material) und `hornet-f7c-fracht-vorher/nachher.jpg`
   (StorAll-Frachtluke weiß → Spielmaterial).

### Nebenbefunde

- **Fahrwerk der Origin 300er:** `ships.<slug>.gear` fällt bei 300i, 315p,
  325a, 350r von `true` auf `false` („ein Teil steckt 370 cm im Boden“).
  Das kommt nicht vom Nachtrag: Ein Bau ohne `matfix.json` (300i, A/B)
  liefert dieselben Bytes wie staging und dasselbe Urteil. Die
  Senk-Prüfung in `gearCheck` kam mit d225cf8f, die staging-Dateien sind
  älter. `gear.below` nennt das Scharnier `lg_hinge_front_left` (3,70 m)
  schon auf staging; `standFor` stellt diese vier deshalb heute schon nicht
  aufs Fahrwerk. Sichtbar ändert sich nichts. Alle übrigen `gear`-Werte wie
  auf staging.
- **Hornet F7C, Cockpit:** die zwei hellen Blöcke neben dem Sitz tragen
  `ANVL_Hornet_mtl_cockpit_atlas_017` mit Karte (Strahl auf die Fläche);
  kein Fall für diesen Lauf.
- **Meteor:** das neue Material des Täuschkörperwerfers (`metal_atlas`,
  HardSurface) zeigt die Farbe seiner ersten Schicht (`ship_mf_paint_a`),
  nicht den Lackkanal, weil nachgetragene Materialien kein `palette_tint`
  bekommen (Auftrag).
- **Überschneidung:** Im wot-hangar-Worktree lief zur selben Zeit ein
  `build-hangar-alle --redo` über alle 231 Schiffe mit nicht committeten
  Änderungen (`cleanMaterials`: Serienpalette über `palettePbr`). Wer
  zuletzt einmischt, baut die 26 auf dem vereinten Stand neu:
  `node scripts/build-hangar-alle.mjs --only <26> --redo`. Die
  `matfix.json` liegen im gemeinsamen Rohbestand `ships/`.
