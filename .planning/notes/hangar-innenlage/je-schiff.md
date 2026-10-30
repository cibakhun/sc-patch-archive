# Innenlage je Schiff: vorher → nachher

vorher = Rümpfe von 6a38c768 (nur zweiseitig) mit den Innenräumen von staging; nachher = Regel „Container an ihren Helfer“ (Rümpfe mit behaltenem Innenraum und alle Innenräume neu). Werkzeug `scripts/measure-hangar-innenlage.mjs all`. Sitz: ✓, wenn mindestens 20 Dreiecksmitten des Innenraums bis 1,5 m um den Pilotensitz liegen; in Klammern der Abstand der nächsten. „oben“: was der Blick aus Kopfhöhe senkrecht nach oben bis 4 m trifft.

**Außen mindestens 1 %:** vorher 41, nachher 5. **Mindestens 5 %:** 34 → 1. **Mindestens 20 %:** 15 → 0.

**Innenraum am Pilotensitz:** vorher 100 von 215, nachher 192 von 215. **Oben frei:** vorher 43, nachher 43.

| Schiff | außen vorher | außen nachher | Sitz vorher | Sitz nachher | oben nachher | Container verschoben | ohne Helfer | doppelt entfernt | außerhalb entfernt |
|---|---:|---:|---|---|---|---:|---|---:|---:|
| aegs-avenger-stalker | 0 % | 0 % | ✗ 0 (2,78 m) | ✓ 5166 (0,25 m) | Glas | 4/4 |  |  | 1 |
| aegs-avenger-titan | 0 % | 0 % | ✗ 0 (2,78 m) | ✓ 5166 (0,25 m) | Glas | 4/4 |  |  | 1 |
| aegs-avenger-titan-renegade | 0 % | 0 % | ✗ 0 (2,78 m) | ✓ 5166 (0,25 m) | Glas | 4/4 |  |  | 1 |
| aegs-avenger-warlock | 0 % | 0 % | ✗ 0 (2,78 m) | ✓ 5166 (0,25 m) | Glas | 4/4 |  |  | 1 |
| aegs-eclipse | 0 % | 0 % | ✗ 0 (4,95 m) | ✓ 20733 (0,05 m) | Rumpf | 1/1 |  |  | 0 |
| aegs-gladius | 0 % | 0 % | ✗ 0 (6,56 m) | ✓ 10955 (0,1 m) | Glas | 3/3 |  |  | 0 |
| aegs-gladius-pir | 0 % | 0 % | ✗ 0 (6,56 m) | ✓ 10955 (0,1 m) | Glas | 3/3 |  |  | 0 |
| aegs-gladius-valiant | 0 % | 0 % | ✗ 0 (6,56 m) | ✓ 10955 (0,1 m) | Glas | 3/3 |  |  | 0 |
| aegs-hammerhead | 27,77 % | 0 % | ✗ 0 (23,04 m) | ✓ 1399 (0,16 m) | frei | 15/15 | lights_turret_side, lights_turret_side, lights_turret_side | 3 | 3 |
| aegs-hammerhead-showdown | 25,99 % | 0 % | ✗ 0 (30,5 m) | ✓ 1002 (0,14 m) | frei | 14/14 |  | 9 | 0 |
| aegs-javelin | 4,41 % | 0,06 % | ✓ 197 (0,68 m) | ✓ 256 (0,21 m) | Glas | 10/10 |  | 39 | 0 |
| aegs-redeemer | 0 % | 0 % | ✓ 29252 (0,08 m) | ✓ 29252 (0,08 m) | Glas | 0/2 |  |  | 0 |
| aegs-retaliator | 6,02 % | 0 % | ✗ 0 (19,45 m) | ✓ 8817 (0,98 m) | Glas | 7/7 |  |  | 0 |
| aegs-sabre | 0 % | 0 % | ✗ 0 (9,43 m) | ✓ 13206 (0,35 m) | Rumpf | 2/2 |  |  | 0 |
| aegs-sabre-comet | 0 % | 0 % | ✗ 0 (9,43 m) | ✓ 13206 (0,35 m) | Rumpf | 2/2 |  |  | 0 |
| aegs-sabre-firebird | 0 % | 0 % | ✓ 22320 (0,35 m) | ✓ 22320 (0,35 m) | frei | 0/2 |  |  | 0 |
| aegs-sabre-peregrine | 0 % | 0 % | ✓ 15317 (0,12 m) | ✓ 15317 (0,12 m) | Rumpf | 0/2 |  |  | 0 |
| aegs-sabre-raven | 0 % | 0 % | ✓ 17363 (0,14 m) | ✓ 17363 (0,14 m) | Rumpf | 0/2 |  |  | 0 |
| aegs-sabre-raven-ex | 0 % | 0 % | ✓ 17363 (0,14 m) | ✓ 17363 (0,14 m) | Rumpf | 0/2 |  |  | 0 |
| aegs-tiburon | 23,01 % | 0 % | ✗ 0 (4,89 m) | ✓ 1382 (0,14 m) | frei | 10/10 |  | 3 | 3 |
| aegs-vanguard | 21,31 % | 0 % | ✗ 0 (4,78 m) | ✓ 23489 (0,36 m) | Rumpf | 2/3 |  |  | 0 |
| aegs-vanguard-harbinger | 20,38 % | 0 % | ✗ 0 (4,78 m) | ✓ 23489 (0,36 m) | Rumpf | 2/3 |  | 1 | 0 |
| aegs-vanguard-hoplite | 16,54 % | 0 % | ✗ 0 (4,78 m) | ✓ 23489 (0,36 m) | Rumpf | 2/3 |  |  | 0 |
| aegs-vanguard-sentinel | 20,16 % | 0 % | ✗ 0 (4,78 m) | ✓ 23489 (0,36 m) | Rumpf | 2/3 |  | 6 | 0 |
| anvl-arrow | 0 % | 0 % | ✗ 0 (2,67 m) | ✓ 10714 (0,13 m) | Glas | 1/2 |  |  | 0 |
| anvl-asgard | 0 % | 0 % | ✓ 3005 (0,07 m) | ✓ 2741 (0,15 m) | Rumpf | 3/3 |  |  | 0 |
| anvl-ballista | 0,09 % | 0,09 % | ✓ 3232 (0,18 m) | ✓ 3232 (0,18 m) | Rumpf | 0/2 |  |  | 0 |
| anvl-ballista-dunestalker | 0,09 % | 0,09 % | ✓ 3232 (0,18 m) | ✓ 3232 (0,18 m) | Rumpf | 0/2 |  |  | 0 |
| anvl-ballista-snowblind | 0,09 % | 0,09 % | ✓ 3232 (0,18 m) | ✓ 3232 (0,18 m) | Rumpf | 0/2 |  |  | 0 |
| anvl-c8-pisces | 0 % | 0 % | ✓ 2309 (0,25 m) | ✓ 1430 (0,35 m) | Glas | 2/2 |  |  | 0 |
| anvl-c8r-pisces | 0 % | 0 % | ✓ 1991 (0,25 m) | ✓ 1561 (0,35 m) | Glas | 2/2 |  | 1 | 0 |
| anvl-c8x-pisces-expedition | 0 % | 0 % | ✓ 2309 (0,25 m) | ✓ 1430 (0,35 m) | Glas | 2/2 |  |  | 0 |
| anvl-carrack | 15,55 % | 0 % | ✗ 0 (26,64 m) | ✓ 357 (0,15 m) | Rumpf | 3/4 |  | 15 | 3 |
| anvl-carrack-expedition | 15,55 % | 0 % | ✗ 0 (26,64 m) | ✓ 357 (0,15 m) | Rumpf | 3/4 |  | 15 | 3 |
| anvl-centurion | 0 % | 0 % | ✓ 1498 (0,18 m) | ✓ 1498 (0,18 m) | Rumpf | 0/3 |  | 3 | 0 |
| anvl-gladiator | 0 % | 0 % | ✗ 0 (2,21 m) | ✓ 6867 (0,4 m) | Glas | 2/2 |  |  | 0 |
| anvl-hawk | 0 % | 0 % | ✓ 60 (1,4 m) | ✓ 14820 (0,07 m) | frei | 3/3 |  |  | 0 |
| anvl-hornet-f7a-mk1 | 0 % | 0 % | ✗ 0 (3,24 m) | ✓ 15648 (0,26 m) | Glas | 1/2 |  |  | 0 |
| anvl-hornet-f7a-mk2 | 0 % | 0 % | ✗ 0 (2,65 m) | ✓ 13673 (0,2 m) | Glas | 1/2 |  |  | 0 |
| anvl-hornet-f7c | 0 % | 0 % | ✗ 0 (3,23 m) | ✓ 5341 (0,36 m) | Glas | 2/2 |  |  | 0 |
| anvl-hornet-f7c-mk2 | 0 % | 0 % | ✗ 0 (2,65 m) | ✓ 13673 (0,2 m) | Glas | 1/2 |  |  | 0 |
| anvl-hornet-f7c-wildfire | 0 % | 0 % | ✗ 0 (3,23 m) | ✓ 5341 (0,36 m) | Glas | 2/2 |  |  | 0 |
| anvl-hornet-f7cm | 0 % | 0 % | ✗ 0 (3,17 m) | ✓ 10696 (0,35 m) | Glas | 2/2 |  |  | 0 |
| anvl-hornet-f7cm-heartseeker | 0 % | 0 % | ✗ 0 (3,17 m) | ✓ 10696 (0,35 m) | Glas | 2/2 |  |  | 0 |
| anvl-hornet-f7cm-mk2 | 0 % | 0 % | ✗ 0 (4,22 m) | ✓ 26894 (0,2 m) | Glas | 1/2 |  |  | 0 |
| anvl-hornet-f7cm-mk2-heartseeker | 0 % | 0 % | ✗ 0 (4,22 m) | ✓ 26894 (0,2 m) | Glas | 1/2 |  |  | 0 |
| anvl-hornet-f7cr | 0 % | 0 % | ✗ 0 (3,23 m) | ✓ 5341 (0,36 m) | Glas | 2/2 |  |  | 0 |
| anvl-hornet-f7cr-mk2 | 0 % | 0 % | ✗ 0 (2,65 m) | ✓ 13673 (0,2 m) | Glas | 1/2 |  |  | 0 |
| anvl-hornet-f7cs | 0 % | 0 % | ✗ 0 (3,23 m) | ✓ 5341 (0,36 m) | Glas | 2/2 |  |  | 0 |
| anvl-hornet-f7cs-mk2 | 0 % | 0 % | ✗ 0 (2,65 m) | ✓ 13673 (0,2 m) | Glas | 1/2 |  |  | 0 |
| anvl-hurricane | 0 % | 0 % | ✗ 0 (6,16 m) | ✓ 3942 (0,39 m) | Glas | 2/2 |  |  | 0 |
| anvl-lightning-f8 | 0 % | 0 % | ✗ 0 (8,42 m) | ✓ 7720 (0,23 m) | Glas | 2/2 |  |  | 0 |
| anvl-lightning-f8c | 0 % | 0 % | ✗ 0 (8,42 m) | ✓ 7720 (0,23 m) | Glas | 2/2 |  |  | 0 |
| anvl-lightning-f8c-exec | 0 % | 0 % | ✗ 0 (8,42 m) | ✓ 7720 (0,23 m) | Glas | 2/2 |  |  | 0 |
| anvl-paladin | 0 % | 0 % | ✓ 7407 (0,2 m) | ✓ 7407 (0,2 m) | Glas | 0/2 |  | 6 | 0 |
| anvl-spartan | 0 % | 0 % | ✓ 6716 (0,09 m) | ✓ 6716 (0,09 m) | Rumpf | 0/4 |  | 2 | 0 |
| anvl-terrapin | 0 % | 0 % | ✓ 6094 (0,23 m) | ✓ 6094 (0,23 m) | Glas | 0/2 |  | 1 | 0 |
| anvl-terrapin-medic | 0 % | 0 % | ✓ 5985 (0,25 m) | ✓ 5985 (0,25 m) | Glas | 0/2 |  |  | 0 |
| anvl-valkyrie | 0,01 % | 0,01 % | ✓ 3006 (0,07 m) | ✓ 2741 (0,15 m) | Rumpf | 9/9 |  |  | 0 |
| argo-csv-cargo | 0 % | 0 % | ✓ 19926 (0,09 m) | ✓ 19926 (0,09 m) | frei | 0/2 |  |  | 0 |
| argo-mole | 0 % | 0 % | ✓ 2751 (0,03 m) | ✓ 2751 (0,03 m) | Rumpf | 0/3 |  |  | 0 |
| argo-moth | 0 % | 0 % | ✓ 2751 (0,03 m) | ✓ 2751 (0,03 m) | Rumpf | 0/3 |  |  | 0 |
| argo-mpuv | 0 % | 0 % | ✓ 4616 (0,88 m) | ✓ 7576 (0,14 m) | Rumpf | 5/6 |  |  | 0 |
| argo-mpuv-1t | 4,42 % | 0 % | – | – | – | 3/4 |  |  | 0 |
| argo-mpuv-transport | 0,14 % | 0 % | ✓ 9579 (0,46 m) | ✓ 18789 (0,09 m) | Rumpf | 5/7 |  |  | 0 |
| argo-raft | 0 % | 0 % | ✓ 5484 (0,05 m) | ✓ 5484 (0,05 m) | Rumpf | 0/2 |  |  | 0 |
| argo-srv | 0 % | 0 % | ✓ 18683 (0,02 m) | ✓ 18683 (0,02 m) | Rumpf | 0/2 |  |  | 6 |
| banu-defender | 38,44 % | 0 % | ✓ 4041 (0,3 m) | ✓ 17877 (0,08 m) | Rumpf | 4/4 |  |  | 0 |
| cnou-hoverquad | 0 % | 0 % | ✓ 223 (1,2 m) | ✓ 223 (1,2 m) | frei | 0/1 |  |  | 0 |
| cnou-mustang-alpha | 0,13 % | 0 % | ✓ 7134 (0,51 m) | ✓ 8352 (0,15 m) | Glas | 2/3 |  |  | 0 |
| cnou-mustang-alpha-citizencon2018 | 0,13 % | 0 % | ✓ 7134 (0,51 m) | ✓ 8352 (0,15 m) | Glas | 2/3 |  |  | 0 |
| cnou-mustang-beta | 0,06 % | 1,48 % | ✓ 910 (1,13 m) | ✓ 4400 (0,15 m) | Glas | 2/3 |  |  | 0 |
| cnou-mustang-delta | 0,13 % | 0 % | ✓ 7134 (0,51 m) | ✓ 8352 (0,15 m) | Glas | 2/3 |  |  | 0 |
| cnou-mustang-gamma | 0,12 % | 0 % | ✓ 7134 (0,51 m) | ✓ 8352 (0,15 m) | Glas | 2/3 |  |  | 0 |
| cnou-mustang-omega | 0,12 % | 0 % | ✓ 7134 (0,51 m) | ✓ 8352 (0,15 m) | Glas | 2/3 |  |  | 0 |
| cnou-nomad | 0 % | 0 % | ✗ 0 (7,5 m) | ✓ 2824 (0,56 m) | Glas | 3/4 |  |  | 0 |
| crus-intrepid | 0 % | 0 % | ✓ 11366 (0,57 m) | ✓ 11366 (0,57 m) | Glas | 0/4 |  | 6 | 1 |
| crus-spirit-a1 | 1,13 % | 0 % | ✗ 0 (11,26 m) | ✓ 19746 (0,54 m) | Glas | 3/5 |  | 2 | 0 |
| crus-spirit-c1 | 1,28 % | 0 % | ✗ 0 (11,26 m) | ✓ 19746 (0,54 m) | Glas | 3/5 |  | 2 | 0 |
| crus-star-runner | 13,05 % | 0,03 % | ✗ 0 (5,82 m) | ✓ 3060 (0,57 m) | Glas | 2/3 |  |  | 0 |
| crus-starfighter-inferno | 0 % | 0 % | ✗ 0 (7,99 m) | ✓ 17901 (0,3 m) | Glas | 1/2 |  |  | 0 |
| crus-starfighter-ion | 0 % | 0 % | ✗ 0 (7,99 m) | ✓ 17901 (0,3 m) | Glas | 1/2 |  |  | 0 |
| crus-starlifter-a2 | 0,44 % | 0 % | ✗ 0 (6,85 m) | ✓ 17749 (0,03 m) | Rumpf | 9/10 |  | 6 | 0 |
| crus-starlifter-c2 | 0,44 % | 0 % | ✗ 0 (6,85 m) | ✓ 17749 (0,03 m) | Rumpf | 7/8 |  | 4 | 0 |
| crus-starlifter-m2 | 0,39 % | 0 % | ✗ 0 (6,85 m) | ✓ 17749 (0,03 m) | Rumpf | 9/10 |  | 4 | 0 |
| drak-buccaneer | 0 % | 0 % | ✓ 1437 (0,17 m) | ✓ 17959 (0,39 m) | Glas | 1/1 |  |  | 0 |
| drak-caterpillar | 10,02 % | 0 % | ✗ 0 (2,83 m) | ✓ 7053 (0,44 m) | Glas | 9/9 |  |  | 0 |
| drak-caterpillar-pirate | 11,94 % | 2,59 % | ✗ 0 (1,67 m) | ✓ 7172 (0,44 m) | Glas | 9/9 | base_pira_int_command_geo |  | 0 |
| drak-clipper | 0 % | 0 % | ✓ 18862 (0,25 m) | ✓ 18862 (0,25 m) | Glas | 0/2 |  | 1 | 1 |
| drak-corsair | 0,03 % | 0 % | ✗ 0 (5,44 m) | ✓ 2918 (0,82 m) | Rumpf | 2/4 |  |  | 5 |
| drak-cutlass-black | 28,35 % | 0 % | ✗ 0 (3,97 m) | ✓ 2271 (0,39 m) | Glas | 3/3 |  |  | 0 |
| drak-cutlass-blue | 20,66 % | 0 % | ✗ 0 (7,9 m) | ✓ 2043 (0,39 m) | Glas | 5/5 |  | 2 | 0 |
| drak-cutlass-red | 18,87 % | 0 % | ✗ 0 (7,93 m) | ✓ 1984 (0,4 m) | Glas | 5/5 |  |  | 0 |
| drak-cutlass-steel | 20,06 % | 0 % | ✗ 0 (3,97 m) | ✓ 2320 (0,39 m) | Glas | 3/3 |  |  | 0 |
| drak-cutter | 0 % | 0 % | ✗ 17 (1,41 m) | ✓ 7841 (0,12 m) | Rumpf | 2/3 |  |  | 1 |
| drak-cutter-rambler | 0 % | 0 % | ✓ 290 (1,21 m) | ✓ 8114 (0,12 m) | Rumpf | 3/4 |  |  | 0 |
| drak-cutter-scout | 0 % | 0 % | ✓ 70 (1,39 m) | ✓ 7894 (0,12 m) | Rumpf | 3/4 |  |  | 1 |
| drak-dragonfly | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/1 |  |  | 0 |
| drak-dragonfly-yellow | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/1 |  |  | 0 |
| drak-golem | 0 % | 0 % | ✓ 293 (0,65 m) | ✓ 293 (0,65 m) | Rumpf | 0/2 |  |  | 0 |
| drak-golem-ox | 0 % | 0 % | ✓ 293 (0,65 m) | ✓ 293 (0,65 m) | Rumpf | 0/2 |  |  | 0 |
| drak-herald | 0 % | 0 % | ✓ 15923 (0,62 m) | ✓ 15923 (0,62 m) | Glas | 0/2 |  |  | 0 |
| drak-mule | 0 % | 0 % | ✓ 17277 (0,39 m) | ✓ 17277 (0,39 m) | Rumpf | 0/2 |  |  | 0 |
| drak-pitbull | 0 % | 0 % | ✓ 9789 (0,36 m) | ✓ 9789 (0,36 m) | Glas | 0/2 |  |  | 0 |
| drak-vulture | 44,12 % | 0,46 % | ✓ 12815 (0,26 m) | ✓ 11156 (0,13 m) | Rumpf | 2/3 |  | 1 | 1 |
| espr-prowler | 5,13 % | 0 % | ✗ 0 (6,74 m) | ✓ 18900 (0,17 m) | Rumpf | 5/6 |  |  | 1 |
| espr-prowler-utility | 8,75 % | 0 % | ✗ 0 (6,75 m) | ✓ 18900 (0,17 m) | Rumpf | 5/6 |  |  | 1 |
| espr-talon | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 2/2 |  |  | 0 |
| espr-talon-shrike | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 2/2 |  |  | 0 |
| gama-railen | 0,11 % | 0,11 % | ✓ 5974 (0,27 m) | ✓ 5974 (0,27 m) | frei | 2/5 |  | 31 | 0 |
| gama-syulen | 0 % | 0 % | ✓ 6925 (0,05 m) | ✓ 6925 (0,05 m) | Rumpf | 0/2 |  |  | 0 |
| gama-tyilui | 0,09 % | 0,09 % | ✓ 5974 (0,27 m) | ✓ 5974 (0,27 m) | frei | 2/5 |  | 35 | 0 |
| glsn-basher | 2,41 % | 0 % | ✗ 0 (2,43 m) | ✓ 15199 (0,32 m) | Rumpf | 1/2 |  |  | 3 |
| glsn-shiv | 22,24 % | 0,43 % | ✗ 0 (3,96 m) | ✓ 1861 (0,4 m) | Glas | 3/3 |  |  | 0 |
| grin-mdc | 0 % | 0 % | ✓ 20036 (0,09 m) | ✓ 20036 (0,09 m) | Rumpf | 0/3 |  | 2 | 0 |
| grin-mtc | 0 % | 0 % | ✓ 13602 (0,09 m) | ✓ 13602 (0,09 m) | Rumpf | 0/3 |  |  | 0 |
| grin-ptv | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 1/1 |  |  | 0 |
| grin-roc | 0 % | 0 % | ✓ 2123 (0,86 m) | ✓ 2205 (0,44 m) | Glas | 1/2 |  |  | 0 |
| grin-roc-ds | 0 % | 0 % | ✓ 2123 (0,86 m) | ✓ 2205 (0,44 m) | Glas | 1/2 |  |  | 0 |
| grin-stv | 0 % | 0 % | ✓ 124 (0,54 m) | ✓ 124 (0,54 m) | frei | 0/2 |  |  | 0 |
| grin-utv | 0 % | 0 % | ✓ 228 (1,24 m) | ✓ 228 (1,24 m) | Rumpf | 0/2 |  |  | 0 |
| krig-l21-wolf | 0,95 % | 0,36 % | ✓ 9751 (0,6 m) | ✓ 23226 (0,38 m) | frei | 1/2 |  |  | 0 |
| krig-l22-alphawolf | 0,94 % | 0,35 % | ✓ 9751 (0,6 m) | ✓ 23220 (0,38 m) | frei | 1/2 |  |  | 0 |
| krig-p52-merlin | 0 % | 0 % | ✓ 3768 (1,2 m) | ✓ 13143 (0,26 m) | Rumpf | 1/1 |  |  | 0 |
| krig-p72-archimedes | 0 % | 0 % | ✓ 3657 (1,2 m) | ✓ 13610 (0,26 m) | Rumpf | 2/2 |  |  | 0 |
| krig-p72-archimedes-emerald | 0 % | 0 % | ✓ 3657 (1,2 m) | ✓ 13610 (0,26 m) | Rumpf | 2/2 |  |  | 0 |
| krig-s65-stingray | 0 % | 0 % | ✗ 0 (1,52 m) | ✓ 42625 (0,37 m) | Glas | 1/2 |  |  | 0 |
| misc-fortune | 0 % | 0 % | ✓ 4262 (0,15 m) | ✓ 4262 (0,15 m) | frei | 0/3 |  | 1 | 1 |
| misc-freelancer | 0,41 % | 0 % | ✗ 0 (3,79 m) | ✓ 6890 (0,07 m) | Glas | 4/4 |  |  | 0 |
| misc-freelancer-dur | 0,8 % | 0 % | ✗ 0 (3,79 m) | ✓ 6890 (0,07 m) | Glas | 5/5 |  |  | 0 |
| misc-freelancer-max | 0,81 % | 0 % | ✗ 0 (3,79 m) | ✓ 6890 (0,07 m) | Glas | 4/4 |  |  | 0 |
| misc-freelancer-mis | 0,13 % | 0 % | ✗ 0 (3,79 m) | ✓ 6890 (0,07 m) | Glas | 5/5 |  |  | 0 |
| misc-fury | 0 % | 0 % | ✓ 44 (0,64 m) | ✓ 44 (0,64 m) | Rumpf | 0/2 |  |  | 0 |
| misc-fury-lx | 0 % | 0 % | ✓ 44 (0,64 m) | ✓ 44 (0,64 m) | Rumpf | 0/2 |  |  | 0 |
| misc-fury-miru | 0 % | 0 % | ✓ 42 (0,64 m) | ✓ 42 (0,64 m) | Rumpf | 0/2 |  |  | 0 |
| misc-hull-a | 0 % | 0 % | ✓ 7659 (0,11 m) | ✓ 7659 (0,11 m) | Rumpf | 0/3 |  |  | 0 |
| misc-hull-b | 0 % | 0 % | ✓ 9731 (0,14 m) | ✓ 9731 (0,14 m) | Rumpf | 0/2 |  | 5 | 0 |
| misc-hull-c | 0 % | 0 % | ✗ 0 (34,75 m) | ✓ 3756 (0,11 m) | Rumpf | 7/9 |  | 4 | 0 |
| misc-prospector | 0 % | 0 % | ✗ 0 (3,12 m) | ✓ 767 (0,13 m) | frei | 2/2 |  |  | 0 |
| misc-razor | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | Glas | 1/1 |  |  | 0 |
| misc-razor-ex | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | Glas | 1/1 |  |  | 0 |
| misc-razor-lx | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | Glas | 1/1 |  |  | 0 |
| misc-reliant | 0 % | 0 % | ✓ 2695 (0,87 m) | ✓ 688 (0,9 m) | Rumpf | 3/3 |  |  | 0 |
| misc-reliant-mako | 0 % | 0 % | ✓ 7514 (0,08 m) | ✓ 688 (0,9 m) | Rumpf | 3/3 |  |  | 0 |
| misc-reliant-sen | 0 % | 0 % | ✓ 8007 (0,08 m) | ✓ 688 (0,9 m) | Rumpf | 3/3 |  |  | 0 |
| misc-reliant-tana | 0 % | 0 % | ✓ 7289 (0,08 m) | ✓ 688 (0,9 m) | Rumpf | 3/3 |  |  | 0 |
| misc-starfarer | 13,1 % | 3,12 % | ✗ 0 (11,03 m) | ✓ 1794 (0,26 m) | Rumpf | 6/6 |  | 19 | 1 |
| misc-starfarer-gemini | 12,55 % | 2,99 % | ✗ 0 (11,03 m) | ✓ 1794 (0,26 m) | Rumpf | 6/6 |  | 1 | 1 |
| misc-starlancer-max | 0 % | 0 % | ✓ 4606 (0,14 m) | ✓ 4880 (0,14 m) | Rumpf | 0/7 |  | 44 | 0 |
| misc-starlancer-tac | 0 % | 0 % | ✓ 4041 (0,14 m) | ✓ 4341 (0,14 m) | Rumpf | 2/8 |  |  | 0 |
| misc-starlite | 0 % | 0 % | ✓ 20480 (0,52 m) | ✓ 20480 (0,52 m) | Rumpf | 0/2 |  | 2 | 0 |
| mrai-guardian | 0 % | 0 % | ✓ 12340 (0,1 m) | ✓ 12340 (0,1 m) | Rumpf | 0/2 |  |  | 19 |
| mrai-guardian-mx | 0 % | 0 % | ✓ 416 (1,08 m) | ✓ 416 (1,08 m) | Rumpf | 0/2 |  | 2 | 20 |
| mrai-guardian-qi | 0 % | 0 % | ✓ 12340 (0,1 m) | ✓ 12340 (0,1 m) | Rumpf | 0/2 |  |  | 19 |
| mrai-pulse | 0 % | 0 % | ✓ 525 (1,07 m) | ✓ 525 (1,07 m) | frei | 0/2 |  |  | 0 |
| mrai-pulse-lx | 0 % | 0 % | ✓ 1478 (1,07 m) | ✓ 1478 (1,07 m) | frei | 0/2 |  |  | 0 |
| orig-100i | 0,14 % | 0 % | ✓ 1123 (1,08 m) | ✓ 1673 (0,14 m) | Glas | 3/3 |  |  | 0 |
| orig-125a | 0,14 % | 0 % | ✓ 1123 (1,08 m) | ✓ 1673 (0,14 m) | Glas | 3/3 |  |  | 0 |
| orig-135c | 0,14 % | 0 % | ✓ 1123 (1,08 m) | ✓ 1673 (0,14 m) | Glas | 3/3 |  |  | 0 |
| orig-300i | 0 % | 0 % | ✓ 1900 (0,31 m) | ✓ 1900 (0,31 m) | Glas | 0/2 |  |  | 0 |
| orig-315p | 0 % | 0 % | ✓ 1900 (0,31 m) | ✓ 1900 (0,31 m) | Glas | 0/2 |  |  | 0 |
| orig-325a | 0 % | 0 % | ✓ 1900 (0,31 m) | ✓ 1900 (0,31 m) | Glas | 0/2 |  |  | 1 |
| orig-350r | 0 % | 0 % | ✓ 1448 (0,18 m) | ✓ 1448 (0,18 m) | Glas | 0/2 |  |  | 0 |
| orig-400i | 0 % | 0 % | ✓ 3296 (0,16 m) | ✓ 2819 (0,16 m) | Rumpf | 2/4 |  |  | 0 |
| orig-600i | 0,01 % | 0 % | ✗ 0 (31,44 m) | ✓ 89 (1,24 m) | Rumpf | 4/4 |  | 16 | 0 |
| orig-600i-bis2951 | 0,01 % | 0 % | ✗ 0 (31,44 m) | ✓ 89 (1,24 m) | Rumpf | 4/4 |  | 16 | 0 |
| orig-600i-touring | 0,01 % | 0 % | ✗ 0 (31,44 m) | ✓ 89 (1,24 m) | Rumpf | 4/4 |  | 18 | 0 |
| orig-85x | 0 % | 0 % | ✓ 15034 (0,25 m) | ✓ 15034 (0,25 m) | Glas | 0/2 |  |  | 0 |
| orig-m50 | 0 % | 0 % | – | – | – | 1/2 |  |  | 0 |
| orig-m80 | 0 % | 0 % | ✓ 13843 (0,43 m) | ✓ 13843 (0,43 m) | Glas | 0/2 |  |  | 0 |
| orig-x1 | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/2 |  |  | 0 |
| orig-x1-force | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/2 |  |  | 0 |
| orig-x1-velocity | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/2 |  |  | 0 |
| rsi-apollo-medivac | 0,26 % | 0 % | ✗ 0 (11,53 m) | ✓ 4192 (0,1 m) | Rumpf | 8/11 |  | 1 | 0 |
| rsi-apollo-triage | 0,29 % | 0 % | ✗ 0 (11,53 m) | ✓ 4192 (0,1 m) | Rumpf | 8/11 |  | 1 | 0 |
| rsi-aurora-gs-cl | 0 % | 0 % | ✗ 0 (3,97 m) | ✓ 11856 (0,03 m) | Glas | 2/2 |  |  | 0 |
| rsi-aurora-gs-es | 0 % | 0 % | ✗ 0 (3,97 m) | ✓ 11856 (0,03 m) | Glas | 2/2 |  |  | 0 |
| rsi-aurora-gs-ln | 0 % | 0 % | ✗ 0 (3,97 m) | ✓ 11856 (0,03 m) | Glas | 2/2 |  |  | 0 |
| rsi-aurora-gs-lx | 0 % | 0 % | ✗ 0 (3,97 m) | ✓ 11856 (0,03 m) | Glas | 2/2 |  |  | 0 |
| rsi-aurora-gs-mr | 0 % | 0 % | ✗ 0 (3,97 m) | ✓ 11856 (0,03 m) | Glas | 2/2 |  |  | 0 |
| rsi-aurora-gs-se | 0 % | 0 % | ✗ 0 (3,97 m) | ✓ 11641 (0,03 m) | Glas | 2/2 |  |  | 0 |
| rsi-aurora-mk2 | 25,55 % | 0 % | ✓ 2488 (1 m) | ✓ 11683 (0,05 m) | frei | 1/2 |  |  | 5 |
| rsi-constellation-andromeda | 22,54 % | 0 % | ✗ 0 (10,15 m) | ✓ 75 (0,72 m) | frei | 9/10 |  |  | 0 |
| rsi-constellation-aquila | 16,16 % | 0 % | ✗ 0 (10,15 m) | ✓ 73 (0,72 m) | frei | 9/10 |  |  | 0 |
| rsi-constellation-phoenix | 16,35 % | 16,87 % | ✗ 0 (2,85 m) | ✓ 61 (0,72 m) | frei | 10/11 |  | 1 | 49 |
| rsi-constellation-phoenix-emerald | 17,21 % | 0 % | ✗ 0 (13,54 m) | ✓ 1134 (0,48 m) | frei | 6/7 |  |  | 0 |
| rsi-constellation-taurus | 24,42 % | 0,03 % | ✗ 0 (10,15 m) | ✓ 75 (0,72 m) | frei | 8/9 |  |  | 19 |
| rsi-hermes | 0,05 % | 0 % | ✗ 0 (11,53 m) | ✓ 4192 (0,1 m) | Rumpf | 3/4 |  | 1 | 0 |
| rsi-lynx | 0,35 % | 0,35 % | ✓ 11351 (0,07 m) | ✓ 11351 (0,07 m) | frei | 0/2 |  | 2 | 0 |
| rsi-mantis | 0 % | 0 % | ✓ 6373 (0,13 m) | ✓ 6373 (0,13 m) | Rumpf | 0/2 |  |  | 0 |
| rsi-meteor | 0 % | 0 % | ✓ 6371 (0,12 m) | ✓ 6371 (0,12 m) | Rumpf | 0/2 |  |  | 0 |
| rsi-salvation | 0 % | 0 % | ✓ 6315 (0,14 m) | ✓ 6315 (0,14 m) | Rumpf | 0/2 |  |  | 0 |
| rsi-scorpius | 0 % | 0 % | ✓ 18907 (0,13 m) | ✓ 18907 (0,13 m) | Glas | 0/2 |  |  | 0 |
| rsi-scorpius-antares | 0 % | 0 % | ✓ 18907 (0,13 m) | ✓ 18907 (0,13 m) | Glas | 0/3 |  |  | 0 |
| rsi-skylark | 0 % | 0 % | ✓ 7811 (0,47 m) | ✓ 7811 (0,47 m) | frei | 0/2 |  |  | 0 |
| rsi-ursa-medivac | 8,95 % | 0 % | ✗ 0 (2,21 m) | ✓ 7609 (0,05 m) | Glas | 2/2 |  |  | 1 |
| rsi-ursa-rover | 3,7 % | 0 % | ✗ 0 (2,11 m) | ✓ 7564 (0,04 m) | Glas | 2/2 |  |  | 0 |
| rsi-ursa-rover-emerald | 3,7 % | 0 % | ✗ 0 (2,11 m) | ✓ 7564 (0,04 m) | Glas | 2/2 |  |  | 0 |
| rsi-zeus-cl | 9,18 % | 0 % | ✗ 0 (10,33 m) | ✓ 3093 (0,07 m) | frei | 3/3 |  |  | 2 |
| rsi-zeus-es | 7,87 % | 0 % | ✗ 0 (10,33 m) | ✓ 3093 (0,07 m) | frei | 3/3 |  |  | 0 |
| tmbl-cyclone | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/2 |  |  | 0 |
| tmbl-cyclone-aa | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/2 |  |  | 0 |
| tmbl-cyclone-mt | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/2 |  |  | 0 |
| tmbl-cyclone-rc | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/2 |  |  | 0 |
| tmbl-cyclone-rn | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/2 |  |  | 0 |
| tmbl-cyclone-tr | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/2 |  |  | 0 |
| tmbl-nova | 9,61 % | 0 % | ✓ 3582 (0,4 m) | ✓ 6260 (0,04 m) | Rumpf | 2/2 |  |  | 0 |
| tmbl-storm | 0 % | 0 % | ✓ 14659 (0,3 m) | ✓ 21988 (0,29 m) | Rumpf | 1/2 |  |  | 0 |
| tmbl-storm-aa | 0 % | 0 % | ✓ 14659 (0,3 m) | ✓ 21988 (0,29 m) | Rumpf | 1/2 |  |  | 0 |
| vncl-blade | 0 % | 0 % | ✗ 0 (3,27 m) | ✓ 12096 (0,3 m) | Rumpf | 4/4 |  |  | 0 |
| vncl-glaive | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 2/2 |  |  | 0 |
| vncl-scythe | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | Rumpf | 2/2 |  |  | 0 |
| vncl-stinger | 0 % | 0 % | ✓ 12230 (0,06 m) | ✓ 12230 (0,06 m) | Rumpf | 0/8 |  |  | 0 |
| xian-nox | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/1 |  |  | 0 |
| xian-nox-kue | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | frei | 0/1 |  |  | 0 |
| xian-scout | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | Glas | 1/2 |  |  | 0 |
| xnaa-santokyai | 0 % | 0 % | ✗ 0 (null m) | ✗ 0 (null m) | Glas | 1/2 |  |  | 0 |
