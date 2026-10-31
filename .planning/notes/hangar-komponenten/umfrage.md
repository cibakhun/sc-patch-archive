# Komponenten im Rohexport: Umfrage

Stand 30.10.2026, PC. 231 Rohexporte (`.cache/hangar-src/ships/`), Ports aus `src/data/ship-loadouts.json` mit Kraftwerk, Kühler, Schild, Quantenantrieb, Radar und Tanks. Werkzeug `.cache/zweiseitig/komponenten.mjs` (nicht im Repo), Rohdaten je Schiff und Port: `umfrage.json`. „Geometrie“ = unter dem Port hängt ein Knoten der Serienklasse (Name = Klasse) mit Netz. „Im Rumpf“ = Mitte im Hüllquader des Rumpfs. Ob ein Teil in einem Container liegt, steht je Port in `umfrage.json` (`inContainer`), gilt aber für die Lage im Rohexport vor der Regel aus `hangar-innenlage.md`. Tanks haben im Spiel keine eigene Geometrie (kein Pfad); Schilde haben eine, der Export hängt sie aber an keinen Port.

| Kategorie | Schiffe mit Teil | … mit Port im Export | … mit Geometrie | … im Rumpf | Ports | gefunden | mit Geometrie | im Rumpf | ohne Geometrie, Pfad im Spiel |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kraftwerk | 227 | 227 | 138 | 138 | 301 | 295 | 193 | 193 | 108 |
| Kühler | 227 | 227 | 135 | 135 | 398 | 397 | 233 | 233 | 161 |
| Schild | 212 | 212 | 0 | 0 | 398 | 382 | 0 | 0 | 392 |
| Quantenantrieb | 179 | 179 | 107 | 107 | 179 | 179 | 107 | 107 | 70 |
| Radar | 225 | 224 | 114 | 114 | 229 | 228 | 114 | 114 | 109 |
| Wasserstofftank | 206 | 206 | 0 | 0 | 315 | 311 | 0 | 0 | 0 |
| Quantentank | 179 | 174 | 0 | 0 | 179 | 174 | 0 | 0 | 0 |

## Als Platzierung in einem Container

Unabhängig vom Port: Komponenten, die ein Container als feste Platzierung trägt (scene.json `interiors[].placements`, Pfad der Geometrie; `platzierungen.json`). Sie kommen mit dem Innenraum, nicht mit dem Loadout.

- Kraftwerk: 15 Schiffe, 19 Platzierungen (aegs-avenger-stalker, aegs-avenger-titan, aegs-avenger-titan-renegade, aegs-avenger-warlock, aegs-hammerhead-showdown, anvl-centurion, anvl-spartan, argo-raft, argo-srv, crus-spirit-a1, crus-spirit-c1, crus-starlifter-a2, crus-starlifter-c2, crus-starlifter-m2, drak-corsair)
- Kühler: 12 Schiffe, 18 Platzierungen (aegs-avenger-stalker, aegs-avenger-titan, aegs-avenger-titan-renegade, aegs-avenger-warlock, aegs-vanguard, aegs-vanguard-harbinger, aegs-vanguard-hoplite, aegs-vanguard-sentinel, anvl-asgard, misc-hull-b, misc-starlancer-max, rsi-constellation-phoenix-emerald)
- Schild: 5 Schiffe, 10 Platzierungen (aegs-avenger-stalker, aegs-avenger-titan, aegs-avenger-titan-renegade, aegs-avenger-warlock, rsi-constellation-phoenix-emerald)
- Quantenantrieb: 12 Schiffe, 12 Platzierungen (aegs-avenger-stalker, aegs-avenger-titan, aegs-avenger-titan-renegade, aegs-avenger-warlock, anvl-carrack, anvl-carrack-expedition, anvl-paladin, argo-raft, crus-star-runner, drak-clipper, drak-vulture, misc-hull-b)
- Radar: 3 Schiffe, 5 Platzierungen (anvl-centurion, anvl-spartan, misc-hull-c)
- Wasserstofftank: 2 Schiffe, 3 Platzierungen (drak-corsair, drak-vulture)
- Quantentank: 0 Schiffe, 0 Platzierungen

## Ohne Geometrie: häufigste Spielpfade

- 512× `(kein Geometriepfad)`
- 58× `Objects/Spaceships/Radar/small_component/grnp/radr_grnp_s01_pl01.cga`
- 45× `Objects/Spaceships/Shields/medium_component/godi/shld_godi_s02_pl03.cga`
- 44× `Objects/Spaceships/Shields/large_component/basl/shld_basl_s03_pl03.cga`
- 43× `Objects/Spaceships/Coolers/small_component/aegs/cool_aegs_s01_pl03.cga`
- 38× `Objects/Spaceships/Shields/small_component/godi/shld_godi_s01_pl03.cgf`
- 33× `Objects/Spaceships/Shields/small_component/asas/shld_asas_s01_pl03.cgf`
- 29× `Objects/Spaceships/Shields/small_component/basl/shld_basl_s01_pl03.cgf`
- 25× `objects/spaceships/shields/vehicle_component/seco/shld_seco_v01_pl03.cga`
- 23× `Objects/Spaceships/Radar/medium_component/grnp/radr_grnp_s02_pl01.cga`
- 22× `Objects/Spaceships/Radar/vehicle_component/grnp/radr_grnp_v01_pl01.cga`
- 20× `Objects/Spaceships/Shields/medium_component/behr/shld_behr_s02_pl03.cga`
- 19× `Objects/Spaceships/Shields/small_component/seco/shld_seco_s01_pl03.cgf`
- 16× `objects/spaceships/power_plants/vehicle_component/lplt/powr_lplt_v01_pl03.cga`
- 16× `objects/spaceships/coolers/vehicle_component/jspn/cool_jspn_v01_pl03.cga`
- 14× `Objects/Spaceships/Power_Plants/small_component/aegs/powr_aegs_s01_pl03.cga`
- 14× `Objects/Spaceships/Coolers/small_component/aegs/cool_aegs_s01_pl02.cga`
- 14× `Objects/Spaceships/Shields/medium_component/seco/shld_seco_s02_pl03.cga`
- 14× `Objects/Spaceships/Quantum_drives/small_component/rsi/qdrv_rsi_s01_pl03.cgf`
- 13× `Objects/Spaceships/Shields/small_component/yorm/shld_yorm_s01_pl03.cga`
- 13× `Objects/Spaceships/Quantum_drives/small_component/tars/qdrv_tars_s01_pl03.cgf`
- 12× `Objects/Spaceships/Coolers/small_component/tydt/cool_tydt_s01_pl03.cga`
- 12× `Objects/Spaceships/Shields/medium_component/basl/shld_basl_s02_pl02.cga`
- 10× `Objects/Spaceships/Power_Plants/small_component/lplt/powr_lplt_s01_pl03.cgf`
- 10× `Objects/Spaceships/Coolers/small_component/lplt/cool_lplt_s01_pl03.cga`
