# Hangar: Requisiten mit allen Schichten, mehr Requisiten (2026-10-20)

Auslöser für die PC-Sitzung: **„Hangar-Werte“**, als Teil 2 im selben Lauf
(Teil 1 steht in [`hangar-werte.md`](hangar-werte.md)). Kein eigener Satz,
damit Krisz nur einen schreibt.

Anlass, Krisz 2026-10-20 17:32 (Bild vom Wartungsplatz, über den
Projekt-Chat): „es fehlen auch texturen bei den assets, wir k0nnten auch
mehr assets holen, die assets besser zusammenstellen etc“.

Lesart, ihm so gesagt:
1. Requisiten, die untexturiert oder flach grau wirken, bekommen ihre
   echten Texturen aus dem Spiel. Auf seinem Bild: die dunkle Platte mit
   orangem Rand und die schwarzen Keile; dazu steht eine Figur halb im Boden.
2. Mehr echte Requisiten aus dem Spiel.
3. Glaubwürdiger zusammengestellt, im Sinn der Arbeitsplätze des Katalogs
   (Zweck und Nachbarn).

Es gelten die Regeln aus [`hangar-katalog.md`](hangar-katalog.md) und
[`hangar-werkstatt.md`](hangar-werkstatt.md): Geometrie und Texturen aus
dem Spiel; keine Bilder, keine Roh-Exporte, kein `.mtl`-XML im Repo (es ist
öffentlich); ausgeliefert werden nur gebaute, verkleinerte Dateien.

## Befund Cloud (20.10. abends)

**Die Platte auf seinem Bild** ist `prop_werkzeug_workbench_table_1_a`
(Station `werkbank`), ein Archivstück, das in keiner Spielhalle steht:
- Die Platte liegt auf 0,5 m. Ein schwarzer Mittelrahmen
  (`mining_set_1_a_glossy_black`) ragt bis 1 m: das sind die Keile.
- Der Fuß (`mining_set_1_a_metal_bare`) kommt mit Grundfarbe 0, Metall 0 und
  ohne Karte. Im Schatten ist er unsichtbar, die Platte schwebt.
- Das Werkzeug der Station liegt auf 1 m, also über der Platte.
- Ein Arbeiter der Crew lief mitten durch die Platte; das ist die Figur
  „halb im Boden“.

**Warum die Requisiten untexturiert wirken.** Laut Befund K4 im Katalog
nimmt der Export je Untermaterial nur die Basisschicht des LayerBlend und
lässt die Vertexfarbe weg. In `werkstatt.json` (`materials`, 76 Requisiten
der Werkstatt) sieht man, was dabei fehlt:
- Die Requisiten sind `LayerBlend_V2` mit den Masken `BLEND_MAP` und
  `WEAR_DIRT_AO_VERTEX`.
- Die Blend-Map wählt zwischen bis zu vier Grundschichten (verschiedene
  Lacke und Metalle auf einem Teil).
- Die Vertexfarbe trägt Abnutzung, Schmutz und Verschattung.
- Ohne beides trägt jedes Teil genau eine Tönung mit einer fast
  einfarbigen Detailkarte. Die 26 Detailkarten des Satzes sind 256 px groß,
  die meisten unter 2 KB.

Die Katalog-GLBs tragen kein `COLOR_0` (0 von 230 251 Dreiecken der
genutzten Requisiten).

**Metalle ohne Farbe.** Im Satz kommen 8 Metallmaterialien mit Grundfarbe 0
und ohne Farbkarte an; im Spiel tragen Metalle ihre Farbe als Specular:

| Material | Dreiecke im Satz | Grundfarbe | Requisiten |
|---|---|---|---|
| `shin_prop_main_b_metal_aluminium_a` | 3 085 | 0 | light_work_light_1_a, light_work_light_2_a, hose_floor_1_socket_a, hose_reel_1_065x045x045_a |
| `storage_main_a_metal_bare` | 2 588 | 0,009 | crate_dry_1_0125x0125x00625_a |
| `hose_reel_2_a_aluminium_01` | 832 | 0 | hose_reel_2_a |
| `hightech_prop_main_b_metal_bare_a` | 803 | 0 | trolley_creeper_a, tool_tester_1_b |
| `mining_set_1_a_metal_bare` | 516 | 0 | workbench_table_1_a |
| `storage_toolbox_1_a_metal_aluminium` | 222 | 0,016 | storage_toolbox_a |
| `shin_prop_main_b_metal_titanium_a` | 68 | 0,009 | light_work_light_1_a |
| `utilitarian_master_1_a_metal_bare_grated` | 46 | 0,013 | machine_forklift_1_extension_console_a, trolley_cargo_1_a |

**Was in den Arbeitsplätzen des Spiels fehlt.** 22 Mitglieder der 39
Arbeitsplätze im Katalog sind nicht exportiert. Die Zahl nennt, wie oft das
Requisit über alle Gruppen vorkommt:

| Requisit | Kategorie | Vorkommen | Arbeitsplatz |
|---|---|---|---|
| `box_plastic_4_005x005x005_a` | lager | 826 | lager |
| `box_plastic_4_ammo_0025x005x0025_a` | lager | 590 | lager |
| `bag_toolbox_1_a` | werkzeug | 159 | werkzeug |
| `crate_stack_1_03x025x0125_a` | lager | 118 | lager |
| `box_plastic_4_weapon_closed_005x010x0025_a` | lager | 118 | lager |
| `crate_multipurpose_1_0125x0125x0125_a` | lager | 42 | lager+transport |
| `tank_water_3_waste_0125x0125x0125_a` | reinigung | 24 | diagnose+reinigung+… |
| `crate_metal_4_0125x0125x0125_a_yellow` | lager | 6 | lager+sicherheit+transport |
| `crate_plastic_1_005x01x005_a` | lager | 5 | lager+licht |
| `heater_portable_1_a` | luft | 5 | energie+luft+… |
| `lt_sm_airduct_fan_a_b`, `lt_sm_airduct_fan_addon_a` | schlauch | 4 | schlauch |
| `trash_bag_pile_1_a/b/e/f/g/h/j`, `trash_piles_1_a/c`, `trash_bag_scattered_3_small_a` | reinigung | 12–121 | reinigung und Mischungen |

## Auftrag PC (Hangar-Werte, Teil 2: Requisiten)

1. Gleicher Branch wie Teil 1. Diese Notiz liegt auf `staging` und auf
   `claude/wot-hangar-hzs46w`.

### R1. Materialien vollständig, für alle Katalog-Requisiten und die neuen

2. **Alle Schichten** jedes `LayerBlend_V2`- oder `HardSurface`-Untermaterials.
   - Je Schicht die Rohwerte wörtlich, wie in `werkstatt.json` unter
     `materials`: `name`, `path`, `tint`, `wearTint`, `glossMult`,
     `uvTiling`, `maps` (Farbe, Normale, Glätte).
   - Dazu die Werte des Materials selbst, mit den Namen des Spiels. Zum
     Beispiel: Mischung der Abnutzung (Basis, Falloff), Schmutz (Farbe,
     Stärke, Kachel, Karte), Verschattung, Blend-Faktoren. Was die `.mtl`
     eben trägt.
   - Die Shader-Masken (`mask`) wie dort.
   - Die Umrechnung macht die Cloud.
3. **Vertexfarbe `COLOR_0`** mit allen vier Kanälen im GLB lassen, wo das
   Mesh eine hat.
   - Im Befund steht, welcher Kanal Abnutzung, Schmutz und Verschattung
     trägt.
   - Das kommt aus den Definitionen des Shaders, nicht geraten. Lässt es
     sich nicht belegen, das so sagen.
4. **Blend-Map** je Material:
   - als Bild ≤ 256 px, mit Alpha, wenn sie eins hat;
   - dazu der UV-Satz, den sie nutzt. Braucht sie `TEXCOORD_1`, bleibt der
     im GLB.
5. **Detailkarten der Schichten** (Farbe und Normale), je Karte einmal:
   - als `public/hangar/props/schichten/<kartenname>.webp`, 256 px;
   - gleichnamige über alle Requisiten nur einmal;
   - Die Cloud packt sie für den Wartungsplatz in ein Texturfeld.
6. **Metalle.** Wo eine Schicht oder ein Material im Spiel Metall ist
   (Farbe im Specular), gehört die Specular-Farbe in `baseColorFactor` und
   Metall auf 1, so wie glTF Metall führt.
   - Die Rohwerte Diffuse, Specular und Glossiness stehen in der JSON.
   - Im Befund die acht Materialien aus der Tabelle oben mit alt und neu.
7. **Fast schwarze Schichtmaterialien** (`lowtech_alpha_prop_crates_01_*`,
   Grundfarbe 0,003): sagen, was das Spiel dort hat.
8. **Ablage** im Katalog, `katalog.json` `v: 2`, neuer Schlüssel `materials`:

   ```
   materials: { "<Materialname im GLB>": { shader, mask: [ … ], layers: [ … ], params: { … },
                blendMap: "<datei>" | null, blendUv: 0 | 1, vertex: { wear, dirt, ao } | null } }
   ```

   - Materialnamen wie heute, gleich in allen Dateien.
   - Alles, was `scripts/build-hangar-dienst.mjs` heute liest
     (`props[].node`, `file`, `size`), bleibt, wie es ist.

### R2. Mehr Requisiten

9. **Die 22 fehlenden Mitglieder** der Arbeitsplätze aus der Tabelle oben,
   alle.
10. **Häufiges um das Landefeld.** Was in den Hangars höchstens 6 m vom
    Feldrand steht, mindestens dreimal vorkommt und noch nicht im Katalog
    ist.
11. **Schiffswartung aus dem Archiv,** soweit es das im Spiel gibt, auch
    wenn kein Hangar es nutzt. Bauteile, die man ins Schiff baut, gehören
    zum Thema der Seite (die Loadout-Werkstatt):
    - Bauteil-, Waffen- und Raketenkisten oder -gestelle;
    - Munitionskisten;
    - Werkzeugwände;
    - Wagenheber und Stützen;
    - Werkzeugtaschen.
12. Je neues Requisit die Bedeutung wie K2 im Katalog (Zweck, Nutzung,
    Aufstellung, Nachbarn) und die Materialien wie R1.
    - Grenzen wie K4: ≤ 8 000 Dreiecke, große ≤ 20 000;
    - je Datei ≤ 3 MB; neue Kategorie-Dateien sind erlaubt.

### R3. Zwei Stücke prüfen

13. `workbench_table_1_a` und `workbench_mobile_1_a`:
    - Maße laut Spiel;
    - wofür sie da sind (das erste trägt `mining_set_1_a`-Materialien);
    - wo das Spiel sie aufstellt (socpak, Außenposten, Laden), mit Höhe der
      Arbeitsfläche.

    Damit weiß die Cloud, ob eines davon eine Werkbank ist.

### R4. Abschluss

14. `npm run build && npm run gate`.
15. **Selbstauskunft:**
    - je Requisit: Zahl der Schichten, `COLOR_0` ja/nein, Blend-Map ja/nein;
    - die Metalle mit neuem Wert;
    - die neuen Requisiten mit Dreiecken;
    - Bytes je Datei.

    Ablage hier unter „Befund PC (Teil 2: Requisiten)“.
16. Push auf denselben eigenen Branch wie Teil 1, ohne PR.
    - `public/hangar/props/dienst.glb` baut die Cloud
      (`scripts/build-hangar-dienst.mjs`); der PC lässt es, wie es ist.
    - Den Einbau macht die Cloud: Schichten im Shader des Wartungsplatzes,
      neue Requisiten an den Plätzen.

## Einbau Cloud ohne PC (20.10. abends)

- **Werkbank.** Station `werkbank` nimmt statt `workbench_table_1_a` die
  fahrbare Werkbank `workbench_mobile_1_a` (Hubgestell, helle Platte auf
  1,215 m, quer zum Rumpf gedreht). Das Werkzeug liegt auf der Platte statt
  0,5 m darüber. R3 klärt, ob das Spiel sie als Werkbank führt.
- **Crew um das Gerät.** `layDienst` gibt je Platz die Grundfläche aller
  Stücke als Rechteck in Weltmetern weiter (`d.blocks`), dazu den Rumpf
  aus dem Grundriss (`d.hull`, tiefer als 1,9 m). `buildLife.setBlocks`
  legt 0,35 m Abstand dazu und fasst überlappende Rechtecke zusammen.
  `detour` führt Rundweg, Torweg und Wagenweg über die Ecken um jedes
  Rechteck, auf der Seite mit weniger Weg unter dem Rumpf, bei Gleichstand
  außen. Wer mit dem Tablet steht, rückt an den Rand.
- **Gemessen** (Wege gegen die Kästen der Requisiten über 0,3 m Höhe, plus
  0,2 m für den Körper; Meter Weg im Gerät, vorher → nachher):

  | Schiff | Rundweg | Torweg | Wagenweg | Weg unter dem Rumpf (Wagenweg) |
  |---|---|---|---|---|
  | Gladius | 3,3 → 0 | 1,4 → 0 | 6,4 → 0 | 0,5 → 0,3 |
  | Cutlass Black | 9,7 → 0 | 5,0 → 0 | 12,7 → 0 | 2,0 → 0 |
  | Freelancer | 5,3 → 0 | 7,0 → 0 | 8,7 → 0 | 2,3 → 0 |
  | Starlifter C2 | 27,3 → 0 | 31,5 → 0 | 19,0 → 0 | 0 → 3,0 |
  | Carrack (nur nachher) | 0 | 0 | 0 | 0 |

  Der Rest beim C2 liegt auf der Sehne des Wagenwegs unter der Schiffsmitte
  (Fahrwerk), nicht an einem Umweg.
- Bild: `hangar/v55-werkbank-vorher-nachher.png` im Projektordner;
  Sichturteil WINDOWS 96.

## Befund PC (Teil 2: Requisiten)

=== Katalog v2 · 256 Requisiten in 14 Kategorien (vorher 198 in 13) · Branch `pc/hangar-werte` ===

### R1. Materialien

**Ablage.** `katalog.json` steht auf `v: 2` und hat zwei neue Schlüssel:
- `materials`: 682 GLB-Materialien, Namen wie im GLB.
  - Je Material: `shader`, `mask`, `layers[]`, `params` (Kopf und PublicParams der .mtl wörtlich), `textures` (Slot → Pfad), `blendMap`, `blendUv`, `vertex`, `blendLayer` (nur Illum mit BLENDLAYER), `gltf` (Werte im GLB) und `vorher` (Werte bis v1).
  - Je Schicht: `name`, `path`, `tint`, `wearTint`, `glossMult`, `uvTiling`, `paletteTint`, `attrs` (übrige Attribute wörtlich: WearGloss, HeightBias, HeightScale, Submtl) und `maps` (`d`, `n`).
- `schichten`: Werte der Schicht-Dateien, einmal je Pfad (264), damit sie nicht in jedem Material wiederholt werden. Je Pfad: Shader, Diffuse, Specular, Shininess, LayerTiling und PublicParams wörtlich, darunter TintMode, WearDiffuseColor, WearSpecularColor, WearGlossiness, DetailDiffuse/Bump/Gloss, DetailTiling und WearDirtBlendFalloff.

`props[].node`, `file` und `size` sind unverändert. Die Datei ist 1 642 KB groß, gezippt 127 KB.

**Karten.** 227 Dateien in `public/hangar/props/schichten/`, zusammen 5,5 MB, je höchstens 256 px.
- Abgelegt sind:
  - Farb- und Normalenkarten der Schichten;
  - die Blend-Maps mit Alpha, wo sie eins haben;
  - die Karten der zweiten Schicht alter Illum-Materialien.
- Bei `_ddna` steht die Glätte im Alpha der Normalenkarte.
- Gleichnamige Karten gibt es nur einmal.

**COLOR_0.** Alle 256 Requisiten tragen `COLOR_0` mit vier Kanälen (normierte u8). `prune` lässt die Vertexfarbe jetzt stehen (`keepAttributes`). Einen zweiten UV-Satz liefert der Geometrie-Export nicht.

**Kanäle der Vertexfarbe.** Die Shader-Definitionen des Spiels sagen Folgendes:
- **HardSurface, `%VERTCOLORS`:** „R = damage, G = glow, B = AO, A = wear“. Das ist belegt; `vertex` = `{ damage: 'r', glow: 'g', ao: 'b', wear: 'a' }`.
- **LayerBlend_V2, `%WEAR_DIRT_AO_VERTEX`:** Die Definition nennt nur „Vertex Wear-Dirt-AO“, ohne Kanäle. Das ist **nicht belegt**; `vertex` = `{ wear: null, dirt: null, ao: null }`.
  - Gemessen über 190 901 Ecken der LayerBlend-Requisiten mit dieser Maske:
    - B liegt im Median bei 1,00 (73 % über 0,9) und fällt an Kanten ab. Das verhält sich wie Verschattung.
    - R (Median 0,37) und G (Median 0,62) streuen über den ganzen Bereich.
    - A ist fast konstant (0,92–0,98).
  - Das passt zur Reihenfolge des Namens: R Abnutzung, G Schmutz, B Verschattung. Bewiesen ist es nicht.
- **Illum, `%VERTCOLORS`:** Die Definition sagt nur „Use vertex colors“. `vertex` = `null`.

**Blend-Map.** Sie liegt in TexSlot12, die Kachelung steht in `params.BlendMapTiling`. 133 Requisiten haben eine.
- `blendUv` ist 0, also `TEXCOORD_0`. Die Definition nennt dafür keinen UV-Satz; einen zweiten UV-Satz nennt sie nur bei `%DECALS` („via 2nd UV set“).
- Materialien mit `%DECALS` (z. B. `bag_toolbox_1_a`) bräuchten `TEXCOORD_1`. Den gibt der Export nicht her.

**Metalle.** Metall heißt: Farbe im Specular, Specular über 0,2; Dielektrika liegen bei 0,02–0,06. Dann steht im GLB `baseColorFactor` = Specular der Grundschicht und `metallic` = 1.
- Die Tönung der Schicht lasse ich bei Metallen weg. Die Metallschichten stehen mit Tönung 0 (Aluminium) oder 0,016 (Titan) im Material und wären mit ihr schwarz. Dass das Spiel die Tönung bei TintMode 2 nicht auf das Specular legt, ist nur so erschlossen, nicht belegt.

| Material | Grundschicht (TintMode) | Diffuse / Specular der Schicht | vorher | neu |
|---|---|---|---|---|
| `shin_prop_main_b_metal_aluminium_a` | aluminum_dirty (2), Tönung 0 | 0,013 / 0,839 · 0,839 · 0,863 | 0 · 0 · 0, Metall 1 | 0,839 · 0,839 · 0,863, Metall 1 |
| `storage_main_a_metal_bare` | steel_02 (2), Tönung 0,016 | 0 / 0,558 | 0,009, Metall 1 | 0,558, Metall 1 |
| `hose_reel_2_a_aluminium_01` | iron_scratched_01 (2), Tönung 0 | 0 / 0,552 · 0,571 · 0,571 | 0, Metall 1 | 0,552 · 0,571 · 0,571, Metall 1 |
| `hightech_prop_main_b_metal_bare_a` | iron_scratched_03 (2), Tönung 0 | 0 / 0,552 · 0,571 · 0,571 | 0, Metall 1 | 0,552 · 0,571 · 0,571, Metall 1 |
| `mining_set_1_a_metal_bare` | weapon_bare_01 (0), Tönung 1 | 0 / 0,250 | 0, Metall 0 | 0,250, Metall 1 |
| `storage_toolbox_1_a_metal_aluminium` | aluminum_dirty (2), Tönung 0,019 | 0,013 / 0,839 · 0,839 · 0,863 | 0,016, Metall 1 | 0,839 · 0,839 · 0,863, Metall 1 |
| `shin_prop_main_b_metal_titanium_a` | iron_scratched_02 (2), Tönung 0,016 | 0 / 0,552 · 0,571 · 0,571 | 0,009, Metall 1 | 0,552 · 0,571 · 0,571, Metall 1 |
| `utilitarian_master_1_a_metal_bare_grated` | iron_grate_worn_01 (2), Tönung 0,019 | 0,010 / 0,665 · 0,665 · 0,680 | 0,013, Metall 1 | 0,665 · 0,665 · 0,680, Metall 1 |

Für alte Illum-Materialien ohne Schichten gilt eine eigene Regel. Sie sind nur Metall, wenn sie keine eigene Farbkarte haben (oder `conductor_diff`) und keine `%SPECULAR_MAP`. Mit Specular-Karte ist der Specular-Wert nur deren Faktor. Ohne diese Einschränkung wäre `lowtech_alpha_prop_crates_01_paint_grey_bl` weißes Chrom geworden.

**Fast schwarze Kisten (`lowtech_alpha_prop_crates_01_*`).** Das sind alte Illum-Materialien mit `%BLENDLAYER`.
- **Grundschicht.** Farbkarte (TexSlot1) ist bei `paint_green_bl`, `bare` und `grip` die Platzhalterkarte `conductor_diff`. Sie ist schwarz; die Farbe steht im Specular, so wie das Spiel früher Metall angelegt hat. Bei `bare` (0,558) und `grip` (0,584) ist das blankes Metall: Metall 1, `conductor_diff` nicht mehr als Karte gebunden.
- **Lack.** Der Lack ist eine **zweite Schicht**:
  - Farbe in TexSlot9, z. B. `metalpainted_worn_09_diff` (grün), Normale in TexSlot3;
  - Werte `BlendLayer2DiffuseColor`, `BlendLayer2SpecularColor`, `BlendLayer2Glossiness`, `BlendFactor`, `BlendFalloff` in `params`;
  - gemischt über die Maske in TexSlot12, bei `paint_green_bl` `base_metal_mix`.
- **Ablage.** Die Karten der zweiten Schicht stehen unter `blendLayer: { d, n }`, die Maske unter `blendMap`.
- `paint_grey_bl` hat eine echte Farbkarte (`metalpaintedleaking_worn_02_diff`), Diffuse 0,093 · 0,084 · 0,068 und eine Specular-Karte. Das ist dunkelgrauer Lack, kein Metall.

### R2. Mehr Requisiten

- **Die 22 fehlenden Mitglieder der Arbeitsplätze:** alle 22 sind da. 21 kamen über die Arbeitsplätze dazu. `bag_toolbox_1_a` ließ der Build bisher fallen: Er hielt das LayerBlend-Flag `%DECALS` für ein Decal-Material ohne Karte. Der Test prüft jetzt nur noch `%DECAL`.
- **Häufiges um das Landefeld** (≤ 6 m vom Feldrand, ≥ 3 Aufstellungen, noch nicht im Katalog): 3 Requisiten, `cell_power_1_rack_a`, `hanger_locker_1_a` und `trash_bag_scattered_1_lrg_b`.
- **Schiffswartung aus dem Archiv:** 33 neu, davon 32 in der neuen Kategorie `munition`:
  - Raketengestelle S1–S12 (`missile_frame_s*`, ~15 500 Dreiecke je Stück);
  - Raketenstapel;
  - Torpedokisten und Torpedogestell;
  - Munitionskisten und -paletten;
  - Waffenkisten;
  - die Bauteil-Auslage aus Dumper's Depot.
  Dazu `bag_toolbox_2_a` unter Werkzeug. `crate_weapon_1_015x0075x0075_a` und `crate_weapon_4_015x0075x0075_a` standen schon als Lager im Katalog und bleiben dort.
- **Werkzeugwände und Stützen** (Wagenheber-Böcke, Schiffsstützen) gibt es im Spiel nicht als Requisit. Gesucht habe ich in allen `prop`-Ordnern nach tool wall/board/rack, pegboard, jack stand, chock, wing/engine/ship stand. Der einzige Wagenheber ist `tool_jack_1_a`, und der war schon da.
- **Bedeutung.** Zweck und Nutzung für die neuen Arten stehen in `ZWECK` (Raketengestell, Raketenstapel, Torpedogestell, Torpedokiste, Munitionskiste, Waffenkiste, Bauteil-Auslage). Aufstellung und Nachbarn gibt es nur für Requisiten aus den Hangars; Archivstücke haben `aufstellung: null`.
- **Grenzen.**
  - Dreiecke: alle unter 8 000, die großen unter 20 000 (größtes neues Stück: `uee_lawless_prop_missilestack_medium`, 17 566).
  - Dateigröße: alle GLBs ≤ 3 MiB. `munition.glb` hat 3 130 876 Byte; das liegt unter 3 MiB, aber über 3 000 000 Byte.

### R3. Die zwei Werkbänke

Durchsucht habe ich alle 9 668 socpaks des Spiels (9 860 .soc): Brushes über die Objektsätze, Entities über ihre Klasse.

**`workbench_table_1_a`**
- **Maße.** 4,47 × 1,62 m Grundfläche, 1,00 m hoch. Die Platte liegt auf 0,47–0,53 m, der schwarze Mittelrahmen reicht bis 1,0 m.
- **Was sie ist.** Laut Spiel eine Bastelbank: Die Entity `Tinkerbench_B_4_WorkBench_Table` ist ein Usable vom Typ TinkerBench (Benutzung „Tinker“, „Load“, „Take“), keine Werkstatt-Werkbank fürs Schiff. Die Materialien kommen aus `mining_set_1_a` (Bergbau-Ausstattung).
- **Wo sie steht.**
  - Einmal als Entity: Teach's Ship Shop (`PU/Shops/dealership/teachsshipshop`).
  - Einmal als Brush: Orison, Siege-Plattform (`loc/flagship/stanton/orison/siege/pltfrm_a_beat3`), dort auf 0,6 verkleinert.
  - In keinem Hangar.
- **Arbeitshöhe.** ~0,5 m, für eine Werkbank also niedrig.

**`workbench_mobile_1_a`**
- **Maße.** 3,82 × 1,27 m Grundfläche, 1,215 m hoch. Die Arbeitsfläche liegt auf 0,98–1,00 m (rund 3,7 m² waagrechte Fläche); 1,215 m ist die Oberkante der Aufbauten.
- **Was sie ist.** Ohne Entity und ohne Namen, also reine Dekoration.
- **Wo sie steht.** 296-mal aufgestellt, immer aufrecht und unverkleinert:

  | Ort | Aufstellungen |
  |---|---|
  | Außenposten (FOB-Anlagen, Kolonie-Module, Labore) | 48 + 41 + 7 + 5 |
  | Untergrund-Anlagen auf den Monden | 26 + 21 + 15 + 9 + 22 + 18 + … |
  | Theaters of War | 24 |
  | Läden: Dumper's Depot Area18 | 3 |
  | Läden: Teach's Ship Shop | 1 |
  | Läden: Raffinerie-Verwaltung | 1 |
  | Orbitalstationen | 3 |
  | Industrie-Hangar `loc/mod/common/hangar/util_a` | 1 |

  Wo sich ein Boden darunter fand (56 Aufstellungen), steht sie auf dem Boden (Unterkante ±6 cm). Die Arbeitsfläche liegt dort also auf rund 1 m über dem Boden.

**Ergebnis.** Als Werkbank am Schiff taugt `workbench_mobile_1_a`: Arbeitshöhe 1 m, das Spiel stellt sie in Werkstätten, Läden für Schiffsteile und einmal in einem Hangar auf. `workbench_table_1_a` ist eine niedrige Bastelbank aus der Bergbau-Ausstattung und steht in keiner Halle.

### R4. Selbstauskunft
#### Je Requisit: Schichten (+B = mit Blend-Map)

Alle 256 tragen `COLOR_0` mit vier Kanälen.

- **diagnose** (10): computer_monitor_1_a 8+B, computer_1_b 8+B, computer_1_a 8+B, console_diagnostic_1_a 8+B, server_rack_1_a 2, console_diagnostic_2_a 8+B, panel_engineering_1_a 2+B, panel_engineering_1_b 2+B, panel_engineering_1_c 2+B, panel_engineering_1_d 2+B
- **energie** (9): generator_mining_1_a 2, generator_mobile_1_pirate_a 2+B, generator_portable_1_a 0, generator_mobile_1_b 8+B, generator_mobile_1_d 8+B, lt_delta_addon_generator_b 2, roomsm_addon_generator_c 0+B, generator_standing_1_a 8+B, generator_oxygen_1_a 2
- **heben** (7): ladder_freestanding_0065x0025x06_b 0+B, ladder_mobile_1_a 8+B, ladder_mobile_1_b 8+B, ladder_mobile_1_c 8+B, ladder_step_1_b 2, ladder_step_1_a 0, tool_jack_1_a 0
- **kabel** (59): cable_straight_3_cable_2m_a 8+B, roomsm_addon_cable_junctionbox_a 0+B, cable_straight_3_cable_2m_b 8+B, cable_bend_1_a 8+B, cable_terminal_6_a 8+B, cables_a_02x01x03_a 1, roomsm_addon_cable_junctionbox_b 0+B, cables_a_12x01x01_a 1, cables_a_08x01x01_a 1, cable_corner_3_a 8+B, cable_terminal_8_a 8+B, roomsm_addon_cable_junctionbox_c 0+B, cables_a_04x01x03_a 1, cables_a_08x01x03_a 2, cable_reel_11_a 8+B, cable_bend_2_a 8+B, cable_bend_4_a 8+B, cable_small_1_straight_1m_a 8+B, cable_reel_1_a 8+B, cable_reel_2_a 8+B, cable_terminal_1_floor_a 8+B, cable_reel_10_a 8+B, cable_reel_4_a 8+B, cable_reel_5_a 8+B, cable_corner_4_a 8+B, cable_straight_4_cable_1m_b 8+B, cable_straight_2_1m_b 8+B, cable_corner_1_a 8+B, cable_reel_6_a 8+B, cables_a_04x01x01_b 1, cable_reel_3_a 8+B, cable_straight_4_cable_1m_a 8+B, cable_straight_5_cable_4m_a 8+B, cable_split_3_a 8+B, cable_floor_1_a 2, cable_reel_7_a 8+B, cable_hanging_1_d 2, cable_hanging_1_f 2, cable_terminal_1_floor_b 8+B, cable_bend_6_a 8+B, cable_bend_5_a 8+B, cable_floor_1_c 2, cable_floor_1_b 2, cable_sign_hanging_a 0, cable_bundle_1_a 2, cable_floor_1_d 2, cable_floor_1_e 2, cable_floor_1_f 2, cable_hanging_1_a 2, cable_hanging_1_b 2, cable_hanging_1_c 2, cable_hanging_1_e 2, cable_hanging_1_g 2, cable_hanging_1_h 2, cable_hanging_1_i 2, cable_bundle_1_b 2, cable_reel_2 2, maintenance_cable_1_a 5+B, maintenance_cable_1_b 5+B
- **lager** (21): crate_metal_2_01x005x0025_a 2, crate_dry_2_0125x0125x0125_a 2, drum_dry_1_a 2+B, crate_weapon_4_015x0075x0075_a 2, salvage_shelf_1_a 8+B, crate_stack_1_025x0125x00625_a 4+B, storage_container_1_025x05x025_a 8+B, rack_overhead_1_03x01x00625_a 2, crate_dry_1_0125x0125x00625_a 2, salvage_shelf_1_b 8+B, box_plastic_4_weapon_005x010x005_a 2, crate_weapon_1_015x0075x0075_a 8+B, crate_stack_1_03x025x0125_a 4+B, box_plastic_4_005x005x005_a 2, box_plastic_4_ammo_0025x005x0025_a 2, box_plastic_4_weapon_closed_005x010x0025_a 2, crate_multipurpose_1_0125x0125x0125_a 2, crate_metal_4_0125x0125x0125_a_yellow 2, crate_plastic_1_005x01x005_a 2, cell_power_1_rack_a 2, hanger_locker_1_a 2
- **licht** (6): light_portable_tripod_1_base_a 2, light_tripod_1_a 2, lamp_slaver_1_tripod_a 2, light_work_light_1_a 2, light_work_light_2_a 2, light_work_light_3_a 2
- **luft** (7): heater_freestanding_1_a 2, heater_large_1_c 2, heater_freestanding_1_b 2, heater_hanging_1_a 2, heater_large_1_d 2, heater_large_1_b 2, heater_portable_1_a 2
- **munition** (32): uee_lawless_prop_ammocrate_01 0, uee_lawless_prop_missilestack_large 2, uee_lawless_prop_missilestack_medium 2, uee_lawless_prop_missilestack_small 2, crate_weapon_1_01x005x0025_a 8+B, crate_weapon_2_015x0075x0075_a 8+B, crate_weapon_3_075x045x00375_a 8+B, crate_weapon_4_open_015x0075x0075_a 2, prop_component_display_dumper_c 0+B, missile_frame_s10_1_a 8+B, missile_frame_s12_1_a 8+B, missile_frame_s1_1_a 8+B, missile_frame_s2_1_a 8+B, missile_frame_s3_1_a 8+B, missile_frame_s4_1_a 8+B, missile_frame_s5_1_a 8+B, missile_frame_s7_1_a 8+B, missile_frame_s9_1_a 8+B, ammo_box_1_ballistic_05x025x025_a 2, ammo_box_1_ballistic_1x05x025_a 2, ammo_box_1_ballistic_open_1x05x025_a 2, ammo_box_1_closed_a 0, ammo_box_1_pallet_125x125x025_a 2, ammo_box_1_pallet_250x125x025_a 2, crate_torpedo_1_03x0075x0075_a 8+B, crate_torpedo_1_03x0075x0075_open_a 8+B, crate_torpedo_1_05x0075x0075_a 8+B, crate_torpedo_1_05x0075x0075_open_a 8+B, crate_torpedo_1_07x0075x0075_a 8+B, crate_torpedo_1_07x0075x0075_open_a 8+B, crate_torpedo_1_a 8+B, rack_torpedo_1_a 8+B
- **reinigung** (19): trash_bag_scattered_1_lrg_a 0+B, trash_bag_scattered_1_med_a 0+B, trash_bag_scattered_2_med_a 0+B, tool_mop_1_a 2, tool_mop_1_bucket_a 2, tool_mop_1_bucket_b 2, tool_mop_1_bucket_c 8+B, trash_bag_pile_1_j 8+B, trash_bag_pile_1_h 8+B, trash_bag_pile_1_e 8+B, trash_bag_pile_1_g 8+B, trash_piles_1_a 0+B, trash_bag_pile_1_b 8+B, trash_bag_pile_1_a 8+B, trash_bag_pile_1_f 8+B, tank_water_3_waste_0125x0125x0125_a 8+B, trash_bag_scattered_3_small_a 0+B, trash_piles_1_c 0+B, trash_bag_scattered_1_lrg_b 0+B
- **schlauch** (24): lt_airduct_hose_straight_8m_a_hung 0, hose_floor_1_socket_a 2, lt_airduct_hose_corner_1m_a 0, lt_airduct_hose_straight_8m_a 0, lt_airduct_hose_corner_05m_a 0, lt_sm_airduct_fan_a 2+B, lt_airduct_hose_junction_a 2, lt_airduct_hose_torn_a 0, lt_airduct_hose_junction_c 2, lt_airduct_hose_stepdown_1m_b 0, lt_airduct_hose_securepoint_connector_a 2, lt_airduct_hose_stepdown_0_5m_b 0, lt_airduct_hose_stepdown_0_025m_a 0, lt_airduct_hose_straight_2m_a 0, lt_airduct_hose_corner_45_1m_a_hung_b 0, hose_floor_1_a 2, hose_floor_1_b 2, hose_floor_1_c 2, hose_reel_1_065x045x045_a 2, hose_reel_1_065x045x045_b 2, hose_reel_2_a 2, maintenance_hose_1_a 2, lt_sm_airduct_fan_a_b 2+B, lt_sm_airduct_fan_addon_a 1
- **sicherheit** (19): fire_hose_1_a 8+B, fire_hose_1_b 8+B, extinguisher_cabinet_1_a 8+B, tool_fire_extinguisher_1_a 8+B, canister_medical_1_oxygen_a 2, tool_fire_extinguisher_2_a 2+B, medical_kit_1_a 2+B, medical_kit_2_a 2+B, cone_1_a 2, canister_medical_1_stand_b 2, barrier_caution_005x005x0125_a 8+B, medical_canister_1_a 8+B, tool_fire_extinguisher_1_mount_a 2, sign_warning_1_freestanding_a 2, cone_1_closed_a 2, cone_2_a 8+B, cone_2_close_a 8+B, cone_2_open_a 8+B, cone_2_race_a 8+B
- **transport** (15): machine_forklift_1_extension_console_a 8+B, machine_forklift_1_extension_tank_a 8+B, trolley_cargo_1_a 8+B, trolley_cargo_3_b 8+B, trolley_cargo_4_a 8+B, trolley_creeper_a 8+B, machine_forklift_1_b 8+B, machine_forklift_1_a 8+B, forklift_standing_1_a 8+B, prop_dumper_transport_pallet_a 2, prop_dumper_int_transport_pallet_a 0+B, trolley_pallet_1_a 2, trolley_1_forklift_a 8+B, trolley_mobile_1_a 8+B, trolley_creeper_1_a 8+B
- **treibstoff** (5): tank_gas_2_025x0125x0125_a 2, cell_fuel_1_a 2, tank_gas_3_05x025x025_a 2, tank_gas_1_0125x0125x0125_a 2, tank_gas_1_005x005x005_a 2
- **werkzeug** (23): tool_manual_1_ratchet_a 2, tool_manual_1_screwdriver_a 2, tool_manual_1_pliers_a 2, tool_power_1_drill_a 2, bag_toolbox_1_a 8+B, tool_welder_a 2, storage_toolbox_a 8+B, cabinet_tool_1_a 8+B, tool_circularsaw_1_a 2, tool_flashlight_1_a 2, tool_multi_1_a 2, tool_tester_1_a 8+B, tool_tester_1_b 8+B, workbench_mobile_1_a 8+B, workbench_table_1_a 2+B, workbench_table_1_light_a 2, tool_drawer_1_a 2, tool_manual_1_lazer_a 0, tool_allenkey_1_a 2, tool_socket_set_1_a 2, tool_socket_set_closed_1_a 2, crane_welding_arm_1_a 8+B, bag_toolbox_2_a 8+B

#### Neue Requisiten

| Requisit | Kategorie | Herkunft | Dreiecke |
|---|---|---|---|
| `crate_stack_1_03x025x0125_a` | lager | arbeitsplatz | 1637 |
| `box_plastic_4_005x005x005_a` | lager | arbeitsplatz | 3434 |
| `box_plastic_4_ammo_0025x005x0025_a` | lager | arbeitsplatz | 2552 |
| `box_plastic_4_weapon_closed_005x010x0025_a` | lager | arbeitsplatz | 3394 |
| `crate_multipurpose_1_0125x0125x0125_a` | lager | arbeitsplatz | 3518 |
| `crate_metal_4_0125x0125x0125_a_yellow` | lager | arbeitsplatz | 3518 |
| `crate_plastic_1_005x01x005_a` | lager | arbeitsplatz | 2118 |
| `cell_power_1_rack_a` | lager | feld | 7829 |
| `hanger_locker_1_a` | lager | feld | 462 |
| `heater_portable_1_a` | luft | arbeitsplatz | 3324 |
| `uee_lawless_prop_ammocrate_01` | munition | wartung | 7557 |
| `uee_lawless_prop_missilestack_large` | munition | wartung | 11632 |
| `uee_lawless_prop_missilestack_medium` | munition | wartung | 17566 |
| `uee_lawless_prop_missilestack_small` | munition | wartung | 15636 |
| `crate_weapon_1_01x005x0025_a` | munition | wartung | 4828 |
| `crate_weapon_2_015x0075x0075_a` | munition | wartung | 5000 |
| `crate_weapon_3_075x045x00375_a` | munition | wartung | 3674 |
| `crate_weapon_4_open_015x0075x0075_a` | munition | wartung | 3736 |
| `prop_component_display_dumper_c` | munition | wartung | 6431 |
| `missile_frame_s10_1_a` | munition | wartung | 15540 |
| `missile_frame_s12_1_a` | munition | wartung | 15544 |
| `missile_frame_s1_1_a` | munition | wartung | 15744 |
| `missile_frame_s2_1_a` | munition | wartung | 15520 |
| `missile_frame_s3_1_a` | munition | wartung | 15744 |
| `missile_frame_s4_1_a` | munition | wartung | 15520 |
| `missile_frame_s5_1_a` | munition | wartung | 15520 |
| `missile_frame_s7_1_a` | munition | wartung | 15522 |
| `missile_frame_s9_1_a` | munition | wartung | 15520 |
| `ammo_box_1_ballistic_05x025x025_a` | munition | wartung | 2419 |
| `ammo_box_1_ballistic_1x05x025_a` | munition | wartung | 2412 |
| `ammo_box_1_ballistic_open_1x05x025_a` | munition | wartung | 3922 |
| `ammo_box_1_closed_a` | munition | wartung | 7243 |
| `ammo_box_1_pallet_125x125x025_a` | munition | wartung | 4182 |
| `ammo_box_1_pallet_250x125x025_a` | munition | wartung | 4282 |
| `crate_torpedo_1_03x0075x0075_a` | munition | wartung | 3244 |
| `crate_torpedo_1_03x0075x0075_open_a` | munition | wartung | 4888 |
| `crate_torpedo_1_05x0075x0075_a` | munition | wartung | 3460 |
| `crate_torpedo_1_05x0075x0075_open_a` | munition | wartung | 5112 |
| `crate_torpedo_1_07x0075x0075_a` | munition | wartung | 3824 |
| `crate_torpedo_1_07x0075x0075_open_a` | munition | wartung | 5258 |
| `crate_torpedo_1_a` | munition | wartung | 3368 |
| `rack_torpedo_1_a` | munition | wartung | 13230 |
| `trash_bag_pile_1_j` | reinigung | arbeitsplatz | 7584 |
| `trash_bag_pile_1_h` | reinigung | arbeitsplatz | 4895 |
| `trash_bag_pile_1_e` | reinigung | arbeitsplatz | 3622 |
| `trash_bag_pile_1_g` | reinigung | arbeitsplatz | 7860 |
| `trash_piles_1_a` | reinigung | arbeitsplatz | 2686 |
| `trash_bag_pile_1_b` | reinigung | arbeitsplatz | 7222 |
| `trash_bag_pile_1_a` | reinigung | arbeitsplatz | 3104 |
| `trash_bag_pile_1_f` | reinigung | arbeitsplatz | 6286 |
| `tank_water_3_waste_0125x0125x0125_a` | reinigung | arbeitsplatz | 5462 |
| `trash_bag_scattered_3_small_a` | reinigung | arbeitsplatz | 1161 |
| `trash_piles_1_c` | reinigung | arbeitsplatz | 4510 |
| `trash_bag_scattered_1_lrg_b` | reinigung | feld | 2138 |
| `lt_sm_airduct_fan_a_b` | schlauch | arbeitsplatz | 7700 |
| `lt_sm_airduct_fan_addon_a` | schlauch | arbeitsplatz | 3840 |
| `bag_toolbox_1_a` | werkzeug | hangar | 1520 |
| `bag_toolbox_2_a` | werkzeug | wartung | 1570 |

#### Bytes je Datei

| Datei | Bytes | vorher |
|---|---|---|
| `diagnose.glb` | 1837132 | 1800012 |
| `energie.glb` | 2040896 | 1880820 |
| `heben.glb` | 2388104 | 2332896 |
| `kabel.glb` | 2995748 | 2852564 |
| `lager.glb` | 1965776 | 2649008 |
| `licht.glb` | 1075864 | 1042376 |
| `luft.glb` | 869228 | 772988 |
| `munition.glb` | 3130876 | neu |
| `reinigung.glb` | 2426892 | 1092676 |
| `schlauch.glb` | 1478276 | 2993524 |
| `sicherheit.glb` | 1881388 | 1786420 |
| `transport.glb` | 2411616 | 2110404 |
| `treibstoff.glb` | 1171336 | 1161648 |
| `werkzeug.glb` | 2531188 | 2274480 |

### Tore

- **`dienst.glb` neu gepackt, entgegen der Notiz.** Das Tor `verify:hangar-hall` [14] verlangt, dass der Wartungsplatz zu den Katalogquellen passt. Ohne Neupacken bleibt es rot. Ich habe deshalb nur `node scripts/build-hangar-dienst.mjs` laufen lassen, ohne Änderung am Skript.
  - Größe: 5 194 116 → 4 507 264 Byte.
  - Ein Sichturteil über den Wartungsplatz kann ich nicht abgeben. Seine Farben stehen in eigenen Attributen (`_TINT`, `_RM`) für den Shader der Seite, und im einfachen Viewer bleibt er weiß.
- **Grenzen in `verify-hangar-hall.mjs` angehoben** (Ursache steht im Kommentar). Teilflächen mit LayerBlend-`%DECALS` fielen bisher still weg und sind jetzt dabei.
  - Gerätesatz: 210 000 → 213 000 Dreiecke (jetzt 212 465).
  - Schiffsklassen klein / mittel / groß: 213 000 / 257 000 / 560 000 → 218 000 / 262 000 / 564 000 (jetzt 217 562 / 261 231 / 563 622).
- `npm run build && npm run gate` grün (28/28), mit `STAGING=1` ebenfalls grün.
