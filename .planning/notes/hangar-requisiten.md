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
