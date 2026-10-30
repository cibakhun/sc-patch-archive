# Komponenten an ihren Ports: Probe

Stand 30.10.2026, PC, Branch `pc/hangar-komponenten`. Rümpfe neu gebaut mit `markSwapParts` für Komponenten (Anker wie bei den Waffen: `extras.swap` = Port, `item`, `inst`, `anchor` = Matrix im Modellraum, dazu `cat`). Trägt der Export am Port das Serienteil, hängen dessen Netze unter dem Anker (Matrix seiner Wurzel, liegt bei allen hier am Helfer, Abstand 0 m); sonst ein leerer Knoten `swap_anchor_<n>` an der Matrix des Port-Helfers. „Web“ = gebaute Komponente `public/hangar/components/<datei>.glb` (Budget 4 000 Dreiecke, Karten 256/128 px).

## aegs-gladius

Rumpf 231.731 Dreiecke, 2,54 MB. Ports mit Serienteil im Export: 5, leere Anker: 2. Bild: `probe/aegs-gladius.jpg`.

| Port | Art | Klasse | Anker (x / y / z, m) | im Export | roh Dreiecke | Web-Datei | Web Dreiecke | Web KB |
|---|---|---|---|---|---:|---|---:|---:|
| hardpoint_quantum_drive | Quantenantrieb | QDRV_WETK_S01_Beacon_SCItem | -0,254 / -1,755 / -1,715 | ja | 7.987 | beacon | 4.040 | 44 |
| hardpoint_radar | Radar | RADR_GRNP_S01_Ecouter | 0,005 / -1,686 / -8,682 | ja | 4.584 | ecouter | 4.039 | 53 |
| hardpoint_shield_generator_right | Schild | SHLD_GODI_S01_AllStop_SCItem | 0 / 0,491 / -3,726 | nein (leerer Anker) | – | allstop | 4.050 | 54 |
| hardpoint_shield_generator_left | Schild | SHLD_GODI_S01_AllStop_SCItem | 0 / 0,491 / -4,072 | nein (leerer Anker) | – | allstop | 4.050 | 54 |
| hardpoint_power_plant | Kraftwerk | POWR_AEGS_S01_Regulus_SCItem | -0,001 / 0,127 / -1,697 | ja | 6.758 | regulus | 4.787 | 50 |
| hardpoint_cooler_right | Kühler | COOL_AEGS_S01_Bracer_SCItem | 1,337 / 0,735 / 1,22 | ja | 14.754 | bracer | 5.590 | 62 |
| hardpoint_cooler_left | Kühler | COOL_AEGS_S01_Bracer_SCItem | -1,326 / 0,717 / 1,214 | ja | 14.754 | bracer | 5.590 | 62 |

## aegs-avenger-titan

Rumpf 210.138 Dreiecke, 2,03 MB. Ports mit Serienteil im Export: 0, leere Anker: 7. Bild: `probe/aegs-avenger-titan.jpg`.

| Port | Art | Klasse | Anker (x / y / z, m) | im Export | roh Dreiecke | Web-Datei | Web Dreiecke | Web KB |
|---|---|---|---|---|---:|---|---:|---:|
| hardpoint_power_plant | Kraftwerk | POWR_JUST_S01_Endurance_SCItem | 0 / 0,822 / 3,415 | nein (leerer Anker) | – | endurance | 4.169 | 52 |
| hardpoint_cooler_left | Kühler | COOL_AEGS_S01_Bracer_SCItem | -2,488 / -1,866 / 3,499 | nein (leerer Anker) | – | bracer | 5.590 | 62 |
| hardpoint_cooler_right | Kühler | COOL_AEGS_S01_Bracer_SCItem | 2,488 / -1,866 / 3,499 | nein (leerer Anker) | – | bracer | 5.590 | 62 |
| hardpoint_shield_generator_left | Schild | SHLD_BASL_S01_Bulwark_SCItem | -3,524 / -0,299 / 4,426 | nein (leerer Anker) | – | bulwark | 4.704 | 58 |
| hardpoint_shield_generator_right | Schild | SHLD_BASL_S01_Bulwark_SCItem | 3,524 / -0,299 / 4,426 | nein (leerer Anker) | – | bulwark | 4.704 | 58 |
| hardpoint_quantum_drive | Quantenantrieb | QDRV_TARS_S01_Expedition_SCItem | 0 / 0,822 / 4,772 | nein (leerer Anker) | – | expedition | 4.121 | 52 |
| hardpoint_radar | Radar | RADR_GRNP_S01_Ecouter | 0 / -1,547 / -9,628 | nein (leerer Anker) | – | ecouter | 4.039 | 53 |

Container-Platzierungen von Komponenten:

- Schild: `shld_seco_s01_pl04.cgf` im Container `base_int_mid` bei -0,92 / -0,02 / -0,55, nächster Port der Art hardpoint_shield_generator_left 5,62 m → nicht am Port, bleibt Innenraum
- Schild: `shld_seco_s01_pl04.cgf` im Container `base_int_mid` bei -0,92 / -0,02 / 0,19, nächster Port der Art hardpoint_shield_generator_left 4,98 m → nicht am Port, bleibt Innenraum
- Kraftwerk: `powr_acom_s01_pl01.cgf` im Container `base_int_mid` bei 1,43 / -0,79 / -0,89, nächster Port der Art hardpoint_power_plant 4,81 m → nicht am Port, bleibt Innenraum
- Quantenantrieb: `qdrv_just_s01_pl04.cgf` im Container `base_int_mid` bei 1,41 / -1,4 / -0,89, nächster Port der Art hardpoint_quantum_drive 6,24 m → nicht am Port, bleibt Innenraum
- Kühler: `cool_acom_s01_pl03.cga` im Container `base_int_mid` bei 1,14 / -0,46 / 0,14, nächster Port der Art hardpoint_cooler_right 3,88 m → nicht am Port, bleibt Innenraum
- Kühler: `cool_acom_s01_pl03.cga` im Container `base_int_mid` bei 1,14 / -0,96 / 0,14, nächster Port der Art hardpoint_cooler_right 3,73 m → nicht am Port, bleibt Innenraum

## drak-cutlass-black

Rumpf 325.241 Dreiecke, 3,54 MB. Ports mit Serienteil im Export: 0, leere Anker: 6. Bild: `probe/drak-cutlass-black.jpg`.

| Port | Art | Klasse | Anker (x / y / z, m) | im Export | roh Dreiecke | Web-Datei | Web Dreiecke | Web KB |
|---|---|---|---|---|---:|---|---:|---:|
| hardpoint_quantum_drive | Quantenantrieb | QDRV_TARS_S02_Odyssey_SCItem | 2,614 / -2,7 / 0 | nein (leerer Anker) | – | odyssey | 4.102 | 52 |
| hardpoint_radar | Radar | RADR_WLOP_S02_Chernykh | -1,94 / -2,616 / -7,571 | nein (leerer Anker) | – | chernykh | 4.084 | 58 |
| hardpoint_shield_generator_right | Schild | SHLD_SECO_S02_STOP_SCItem | -4,15 / -1,65 / -3,08 | nein (leerer Anker) | – | stop | 4.033 | 57 |
| hardpoint_power_plant | Kraftwerk | POWR_SASU_S02_DayBreak_SCItem | -3,51 / -1,879 / 7,91 | nein (leerer Anker) | – | daybreak | 4.939 | 58 |
| hardpoint_cooler_right | Kühler | COOL_LPLT_S02_ColdSnap_SCItem | 3,596 / -2,58 / 7,979 | nein (leerer Anker) | – | coldsnap | 5.701 | 62 |
| hardpoint_cooler_left | Kühler | COOL_LPLT_S02_ColdSnap_SCItem | -4,139 / -2,458 / -3,123 | nein (leerer Anker) | – | coldsnap | 5.701 | 62 |

## rsi-constellation-andromeda

Rumpf 816.702 Dreiecke, 8,17 MB. Ports mit Serienteil im Export: 6, leere Anker: 1. Bild: `probe/rsi-constellation-andromeda.jpg`.

| Port | Art | Klasse | Anker (x / y / z, m) | im Export | roh Dreiecke | Web-Datei | Web Dreiecke | Web KB |
|---|---|---|---|---|---:|---|---:|---:|
| hardpoint_powerplant_left | Kraftwerk | POWR_SASU_S02_DayBreak_SCItem | -1,969 / 2,735 / 19,251 | ja | 13.107 | daybreak | 4.939 | 58 |
| hardpoint_quantum_drive | Quantenantrieb | QDRV_JUST_S02_Bolon_SCItem | -1,994 / 2,711 / 21,004 | ja | 7.045 | bolon | 4.598 | 57 |
| hardpoint_shield_generator | Schild | SHLD_BEHR_S03_5CA_SCItem | 2,643 / 4,404 / 20,124 | nein (leerer Anker) | – | 5ca-akura | 4.021 | 54 |
| hardpoint_cooler_right | Kühler | COOL_JSPN_S02_FrostStarEX_SCItem | 2,123 / 3,227 / 19,245 | ja | 22.603 | frost-star-ex | 8.583 | 94 |
| hardpoint_radar | Radar | RADR_WLOP_S02_Chernykh | -2,687 / 1,937 / -16,145 | ja | 8.470 | chernykh | 4.084 | 58 |
| hardpoint_powerplant_right | Kraftwerk | POWR_SASU_S02_DayBreak_SCItem | 2,813 / 1,875 / -15,25 | ja | 13.107 | daybreak | 4.939 | 58 |
| hardpoint_cooler_left | Kühler | COOL_JSPN_S02_FrostStarEX_SCItem | -4,062 / 2,75 / -19,062 | ja | 22.603 | frost-star-ex | 8.583 | 94 |

## anvl-carrack

Rumpf 665.112 Dreiecke, 6,05 MB. Ports mit Serienteil im Export: 4, leere Anker: 4. Bild: `probe/anvl-carrack.jpg`.

| Port | Art | Klasse | Anker (x / y / z, m) | im Export | roh Dreiecke | Web-Datei | Web Dreiecke | Web KB |
|---|---|---|---|---|---:|---|---:|---:|
| hardpoint_radar | Radar | RADR_CHCO_S02_Surveyor | -0,01 / 0,869 / 0,652 | nein (leerer Anker) | – | surveyor | 4.084 | 58 |
| hardpoint_cooler_l | Kühler | COOL_JUST_S03_IceFlush_SCItem | -7 / -5,625 / 35,998 | ja | 9.025 | ice-flush | 4.275 | 59 |
| hardpoint_cooler_r | Kühler | COOL_JUST_S03_IceFlush_SCItem | 7 / -5,625 / 35,998 | ja | 9.025 | ice-flush | 4.275 | 59 |
| hardpoint_power_plant_01 | Kraftwerk | POWR_JUST_S03_Reliance_SCItem | 3,823 / -6,5 / 56,75 | ja | 8.622 | reliance | 4.472 | 49 |
| hardpoint_quantum_drive | Quantenantrieb | QDRV_JUST_S03_Kama_SCItem | 0 / -0,931 / 57,406 | ja | 7.045 | kama | 4.609 | 57 |
| hardpoint_shield_generator_l | Schild | SHLD_BASL_S03_Barbican_SCItem | -5,125 / -6,375 / 47,373 | nein (leerer Anker) | – | barbican | 3.991 | 46 |
| hardpoint_shield_generator_r | Schild | SHLD_BASL_S03_Barbican_SCItem | 5,125 / -6,375 / 47,373 | nein (leerer Anker) | – | barbican | 3.991 | 46 |
| hardpoint_power_plant_02 | Kraftwerk | POWR_JUST_S03_Reliance_SCItem | -4,528 / -6,5 / 56,75 | nein (leerer Anker) | – | reliance | 4.472 | 49 |

Container-Platzierungen von Komponenten:

- Quantenantrieb: `anvl_crk_eng_component_case_quantumdrive.cga` im Container `rear` bei 0 / -1,75 / 55,75, nächster Port der Art hardpoint_quantum_drive 1,85 m → nicht am Port, bleibt Innenraum

## tmbl-cyclone

Rumpf 143.637 Dreiecke, 0,94 MB. Ports mit Serienteil im Export: 0, leere Anker: 4. Bild: `probe/tmbl-cyclone.jpg`.

| Port | Art | Klasse | Anker (x / y / z, m) | im Export | roh Dreiecke | Web-Datei | Web Dreiecke | Web KB |
|---|---|---|---|---|---:|---|---:|---:|
| hardpoint_shield_generator | Schild | SHLD_SECO_S00_PIN_SCItem | 0,009 / 1,048 / -0,368 | nein (leerer Anker) | – | pin | 4.128 | 39 |
| hardpoint_radar | Radar | RADR_GRNP_S00_Prevenir | 0,308 / 0,19 / -2,151 | nein (leerer Anker) | – | prevenir | 1.423 | 26 |
| hardpoint_power_plant | Kraftwerk | POWR_LPLT_S00_Radix_SCItem | -0,206 / 0,19 / -1,862 | nein (leerer Anker) | – | radix | 1.968 | 29 |
| hardpoint_cooler | Kühler | COOL_JSPN_S00_FrostStarSL_SCItem | 0,024 / 0,19 / -2,421 | nein (leerer Anker) | – | frost-star-sl | 4.271 | 48 |

## Container-Platzierungen nahe an einem Port (alle 15 Schiffe, unter 2 m)

Gekennzeichnet (extras wie ein Tauschteil, `placed: true`) werden nur echte Komponentenmodelle (`powr_`, `cool_`, `shld_`, `qdrv_`, `radr_`) unter 0,75 m; Gehäuse, Türen und Schilder nicht.

- aegs-vanguard: Kühler `comp_room_bulkhead_coolers.cgf` 1,41 m von hardpoint_cooler_left
- aegs-vanguard-harbinger: Kühler `comp_room_bulkhead_coolers.cgf` 1,41 m von hardpoint_cooler_left
- aegs-vanguard-hoplite: Kühler `comp_room_bulkhead_coolers.cgf` 1,41 m von hardpoint_cooler_left
- aegs-vanguard-sentinel: Kühler `comp_room_bulkhead_coolers.cgf` 1,41 m von hardpoint_cooler_left
- anvl-carrack: Quantenantrieb `anvl_crk_eng_component_case_quantumdrive.cga` 1,85 m von hardpoint_quantum_drive
- anvl-carrack-expedition: Quantenantrieb `anvl_crk_eng_component_case_quantumdrive.cga` 1,85 m von hardpoint_quantum_drive
- anvl-centurion: Kraftwerk `powr_lplt_v01_pl03.cga` 0,4 m von hardpoint_power_plant → Regel kennzeichnet es als Teil des Ports
- anvl-paladin: Quantenantrieb `anvl_paladin_eng_quantum_drive_surround.cgf` 1,51 m von hardpoint_quantum_drive
- anvl-spartan: Kraftwerk `powr_lplt_v01_pl03.cga` 0,4 m von hardpoint_power_plant → Regel kennzeichnet es als Teil des Ports
- crus-star-runner: Quantenantrieb `quantum_drive_component_housing.cga` 1,44 m von hardpoint_quantum_drive
- drak-clipper: Quantenantrieb `drak_decal_quantumdrive_01.cgf` 0,36 m von hardpoint_quantum_drive
- drak-vulture: Quantenantrieb `DRAK_Vulture_Component_Quantumdrive.cga` 0,38 m von hardpoint_quantum_drive
- misc-hull-b: Quantenantrieb `misc_addon_com_label_quantumdrive_01_a.cgf` 1,05 m von hardpoint_quantum_drive
- misc-hull-b: Kühler `misc_addon_com_label_coolers_01_a.cgf` 0,89 m von hardpoint_cooler_right
- misc-hull-b: Kühler `misc_addon_com_label_coolers_01_a.cgf` 0,81 m von hardpoint_cooler_left
- misc-hull-c: Radar `radr_bltr_s02_pl02.cga` 0,5 m von hardpoint_radar → Regel kennzeichnet es als Teil des Ports
- misc-starlancer-max: Kühler `misc_starlancer_engineering_door_coolers.cga` 1 m von hardpoint_cooler_right

## Gebaute Komponenten

342 Dateien, zusammen 1.618.492 Dreiecke, GLB 18,3 MB (Bilder in der gemeinsamen Ablage). Je Klasse: `komponenten-je-klasse.md`.

## Rahmenprobe

Gebaute Komponente mit der `anchor`-Matrix gesetzt gegen das Serienteil im
Rumpf (`.cache/innenlage/komp-rahmen.mjs`, Hüllquader im Modellraum):
Gladius Kühler links/rechts, Kraftwerk, Quantenantrieb, Radar; Carrack
Kühler, Kraftwerk, Quantenantrieb; Andromeda Kraftwerk. Mitte auf 0 bis
3 mm gleich, Größe gleich. Erst stimmte der Quantenantrieb nicht (Gladius
0,2 m, Carrack 1 m höher im Rumpf): Unter ihm hängt im Rumpf das
Sprungmodul `JDRV_TARS_S01_Explorer_SCItem` als eigenes Item aus dem
Loadout des Schiffs. `markSwapParts` nimmt jetzt nur die Netze der
Komponente selbst; Netze unter einem weiteren `*_SCItem` bleiben Rumpf und
verschwinden beim Tausch nicht.

## Export und Bau

- Extraktor-Teil `components` (`scripts/extract-hangar-sources.mjs`):
  Werkstatt-Teile der Kategorien Powerplant, Cooler, Shield, Quantumdrive,
  Radar in den Größen der Komponenten-Ports, dazu 12 Serienklassen ohne
  Werkstatt-Teil (Schlüssel = Klasse). 350 gewollt, 342 exportiert. Ohne
  Modell (Geometriedatei fehlt in der Data.p4k): `allegro`
  (QDRV_ORIG_S04_890J), `radar~2` (RADR_S02_Fake), RADR_S00_Fake,
  RADR_GNRP_S03_Idris_TEMP, COOL/QDRV/SHLD_*_S04_Javelin, SHLD_ORIG_S04_890J.
- Bau `--kind components` (`scripts/build-hangar-assets.mjs`): Datei =
  Werkstatt-Schlüssel wie bei den Waffen (`~` → `-s`), Wurzel wie
  `prepareWeapon` (alle 342 über das einzige Kind der Wurzel), Budget 4 000
  Dreiecke, Karten 256/128 px, Bilder in der gemeinsamen Ablage
  (`public/hangar/tex`). Manifest-Abschnitt `components` (url, v, tris,
  bytes, key, anchorBy, pool). Zusammen 1 618 492 Dreiecke (roh 3 183 717),
  GLB 18,3 MB, neu in der Ablage 2,4 MB. 128 Komponenten liegen über 4 000
  Dreiecken (größte 28 464): die Fehlerschwelle (bis 4 %) hält kleine Netze
  über dem Budget. Je Klasse: `komponenten-je-klasse.md`.
- Tor [17] (`verify:hangar`) zählt `dist/hangar/components` mit (Bilder,
  Deckel, verwaiste Bilder).
- Rumpf: `extras` je Komponenten-Netz `{ swap, item, inst, anchor, cat }`,
  leere Anker als Knoten `swap_anchor_<n>` mit denselben extras (nach dem
  letzten `prune()` eingesetzt). Manifest je Schiff `swapComp` (Ports mit
  Serienteil) und `swapEmpty` (leere Anker), bei Container-Teilen am Port
  `swapPlaced`. Gebaut sind nur die sechs Probe-Rümpfe; Dreiecke 0 bis
  −1 % gegen vorher (Gladius 234 067 → 231 731, Andromeda 824 784 →
  816 702, Carrack 669 491 → 665 112; Komponenten-Netze bleiben eigene
  Knoten).
- Container-Teile am Port: im Probelauf an der Spartan geprüft (Rumpf und
  Innenraum-Datei tragen das Kraftwerk `powr_lplt_v01_pl03` des Containers
  mit `swap: hardpoint_power_plant`, `placed: true`). Der Tausch im Viewer
  blendet im Rumpf aus; ob die Innenraum-Datei beim Einsteigen ebenso
  ausgeblendet wird, entscheidet die Laufzeit (Cloud).

## Offen für die Cloud

- Der Viewer findet die Anker schon (`swapParts` nimmt jeden Knoten mit
  `swap` und `anchor`, auch ohne Netz); `fit()` braucht für Komponenten die
  URLs aus dem Manifest-Abschnitt `components` (Schlüssel wie
  `layouts.ts` sie für Werkstatt-Teile vergibt).
- Avenger Titan, Cutlass Black und Cyclone tragen an keinem Port ein Teil:
  Ihre Komponenten kommen nur zur Laufzeit. Die Avenger-Platzierungen im
  Container (Schild, Kraftwerk, Kühler, Quantenantrieb) liegen 3,7 bis
  6,2 m von den Ports: Innenraum-Ausstattung, keine Port-Teile.
- Neubau aller Rümpfe erst nach Rückmeldung.
