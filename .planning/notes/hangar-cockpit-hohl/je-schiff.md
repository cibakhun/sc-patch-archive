# Hangar-Cockpit: je Schiff vorher (staging b9d2476c) → nachher (pc/hangar-cockpit)

hohl = Anteil der Strahlen durch das Außenglas, die zuerst eine Rückseite
treffen (`scripts/measure-hangar-cockpit.mjs`, 160 Strahlen, fester
Startwert). Stufe nach der neuen Leiter in `scripts/build-hangar-alle.mjs`
(2 = Innenraum auch hinter Glas weg). Innenraum hinter Glas = Knoten, die
`dropInterior` behält, Dreiecke roh je Exemplar gezählt; „ganz behalten“ =
das Budget reicht für den ganzen Innenraum oder alle Knoten liegen hinter Glas.

| Schiff | hohl vorher % | nachher % | Dreiecke vorher → nachher | GLB MB vorher → nachher | Stufe | Innenraum hinter Glas (Knoten / Dreiecke roh) |
|---|---:|---:|---|---|---:|---|
| aegs-avenger-stalker | 56 | 13 | 213.632 → 213.636 | 2,00 → 2,00 | 0 | (ganz behalten) |
| aegs-avenger-titan | 44 | 21 | 214.745 → 214.749 | 2,01 → 2,01 | 0 | (ganz behalten) |
| aegs-avenger-titan-renegade | 49 | 11 | 212.560 → 212.558 | 1,99 → 1,99 | 0 | (ganz behalten) |
| aegs-avenger-warlock | 40 | 18 | 212.587 → 212.589 | 2,05 → 2,05 | 0 | (ganz behalten) |
| aegs-eclipse | 15 | 14 | 203.310 → 203.312 | 1,59 → 1,59 | 0 | (ganz behalten) |
| aegs-gladius | 14 | 3 | 233.147 → 233.431 | 2,52 → 2,52 | 0 | (ganz behalten) |
| aegs-gladius-pir | 6 | 4 | 247.340 → 247.522 | 2,70 → 2,71 | 0 | nichts |
| aegs-gladius-valiant | 9 | 6 | 238.946 → 239.118 | 2,62 → 2,63 | 0 | nichts |
| aegs-hammerhead | 21 | 22 | 683.843 → 824.572 | 6,45 → 8,17 | 0 | 167 / 434.327 |
| aegs-hammerhead-showdown | 26 | 28 | 667.396 → 810.856 | 6,48 → 7,71 | 0 | 155 / 268.307 |
| aegs-idris-m | 42 | 28 | 1.185.844 → 1.185.878 | 10,78 → 10,78 | 4 | (ganz behalten) |
| aegs-idris-p | 29 | 20 | 1.197.721 → 1.197.715 | 10,82 → 10,82 | 4 | (ganz behalten) |
| aegs-javelin | 32 | 19 | 374.924 → 854.109 | 3,02 → 7,89 | 0 | 1450 / 1.205.996 |
| aegs-reclaimer | 9 | 9 | 498.200 → 498.214 | 4,60 → 4,60 | 0 | (ganz behalten) |
| aegs-reclaimer-showdown | 9 | 9 | 498.200 → 498.214 | 4,60 → 4,60 | 0 | (ganz behalten) |
| aegs-redeemer | 4 | 2 | 465.097 → 669.191 | 4,31 → 6,39 | 0 | 205 / 450.537 |
| aegs-retaliator | 48 | 7 | 469.189 → 591.669 | 4,83 → 6,15 | 0 | 188 / 307.013 |
| aegs-sabre | 2 | 1 | 205.471 → 205.545 | 2,07 → 2,07 | 0 | (ganz behalten) |
| aegs-sabre-comet | 5 | 3 | 207.172 → 207.246 | 2,10 → 2,11 | 0 | (ganz behalten) |
| aegs-sabre-firebird | 3 | 0 | 228.220 → 228.220 | 2,43 → 2,43 | 0 | (ganz behalten) |
| aegs-sabre-peregrine | 1 | 0 | 204.565 → 204.565 | 1,97 → 1,97 | 0 | (ganz behalten) |
| aegs-sabre-raven | 35 | 0 | 214.828 → 209.125 | 2,21 → 2,22 | 0 | (ganz behalten) |
| aegs-sabre-raven-ex | 43 | 0 | 218.786 → 223.779 | 2,24 → 2,31 | 0 | (ganz behalten) |
| aegs-tiburon | 29 | 13 | 706.992 → 787.392 | 7,09 → 8,26 | 0 | 102 / 254.782 |
| aegs-vanguard | 24 | 16 | 227.212 → 237.554 | 2,43 → 2,52 | 0 | 7 / 19.402 |
| aegs-vanguard-harbinger | 31 | 28 | 228.835 → 289.010 | 2,37 → 2,87 | 0 | 45 / 146.135 |
| aegs-vanguard-hoplite | 22 | 18 | 213.078 → 220.848 | 2,27 → 2,35 | 0 | 7 / 19.402 |
| aegs-vanguard-sentinel | 23 | 22 | 254.461 → 265.907 | 2,69 → 2,78 | 0 | 7 / 19.402 |
| anvl-arrow | 21 | 19 | 196.090 → 196.090 | 1,86 → 1,87 | 0 | (ganz behalten) |
| anvl-asgard | 23 | 13 | 505.459 → 826.983 | 5,44 → 8,91 | 0 | 373 / 554.243 |
| anvl-ballista | 19 | 19 | 208.634 → 208.634 | 1,86 → 1,86 | 0 | (ganz behalten) |
| anvl-ballista-dunestalker | 19 | 19 | 208.634 → 208.634 | 1,86 → 1,86 | 0 | (ganz behalten) |
| anvl-ballista-snowblind | 19 | 19 | 208.634 → 208.634 | 1,86 → 1,86 | 0 | (ganz behalten) |
| anvl-c8-pisces | 0 | 0 | 184.184 → 184.184 | 1,59 → 1,60 | 0 | (ganz behalten) |
| anvl-c8r-pisces | 1 | 0 | 203.869 → 203.873 | 1,83 → 1,83 | 0 | (ganz behalten) |
| anvl-c8x-pisces-expedition | 0 | 0 | 206.962 → 206.962 | 1,77 → 1,77 | 0 | (ganz behalten) |
| anvl-carrack | 24 | 9 | 669.509 → 988.630 | 6,09 → 8,89 | 0 | 739 / 607.237 |
| anvl-carrack-expedition | 24 | 12 | 669.525 → 988.642 | 6,10 → 8,90 | 0 | 739 / 607.237 |
| anvl-centurion | 17 | 20 | 210.202 → 226.671 | 2,04 → 2,26 | 0 | (ganz behalten) |
| anvl-gladiator | 10 | 4 | 206.743 → 206.811 | 2,14 → 2,14 | 0 | (ganz behalten) |
| anvl-hawk | 12 | 4 | 219.276 → 221.769 | 2,20 → 2,28 | 0 | (ganz behalten) |
| anvl-hornet-f7a-mk1 | 5 | 0 | 212.711 → 217.150 | 2,20 → 2,27 | 0 | (ganz behalten) |
| anvl-hornet-f7a-mk2 | 66 | 1 | 213.429 → 213.429 | 1,83 → 1,84 | 0 | (ganz behalten) |
| anvl-hornet-f7c | 3 | 0 | 199.630 → 199.630 | 1,76 → 1,76 | 0 | (ganz behalten) |
| anvl-hornet-f7c-mk2 | 50 | 0 | 203.607 → 203.637 | 1,76 → 1,77 | 0 | (ganz behalten) |
| anvl-hornet-f7c-wildfire | 3 | 0 | 214.851 → 214.851 | 1,82 → 1,82 | 0 | (ganz behalten) |
| anvl-hornet-f7cm | 3 | 0 | 212.295 → 212.405 | 2,03 → 2,03 | 0 | (ganz behalten) |
| anvl-hornet-f7cm-heartseeker | 2 | 0 | 205.820 → 205.874 | 1,92 → 1,92 | 0 | (ganz behalten) |
| anvl-hornet-f7cm-mk2 | 19 | 1 | 217.659 → 224.184 | 2,35 → 2,51 | 0 | (ganz behalten) |
| anvl-hornet-f7cm-mk2-heartseeker | 20 | 1 | 213.635 → 216.738 | 2,30 → 2,45 | 0 | (ganz behalten) |
| anvl-hornet-f7cr | 3 | 0 | 191.520 → 191.520 | 1,67 → 1,67 | 0 | (ganz behalten) |
| anvl-hornet-f7cr-mk2 | 56 | 5 | 210.779 → 210.873 | 1,86 → 1,87 | 0 | (ganz behalten) |
| anvl-hornet-f7cs | 3 | 0 | 175.787 → 175.787 | 1,55 → 1,55 | 0 | (ganz behalten) |
| anvl-hornet-f7cs-mk2 | 53 | 6 | 205.515 → 205.567 | 1,78 → 1,78 | 0 | (ganz behalten) |
| anvl-hurricane | 21 | 11 | 241.344 → 243.974 | 2,58 → 2,61 | 0 | (ganz behalten) |
| anvl-lightning-f8 | 27 | 16 | 213.557 → 215.871 | 2,14 → 2,17 | 0 | (ganz behalten) |
| anvl-lightning-f8c | 29 | 15 | 216.904 → 219.590 | 2,23 → 2,26 | 0 | (ganz behalten) |
| anvl-lightning-f8c-exec | 29 | 15 | 216.912 → 219.544 | 2,23 → 2,26 | 0 | (ganz behalten) |
| anvl-paladin | 39 | 2 | 650.090 → 883.475 | 6,52 → 8,75 | 0 | 137 / 380.599 |
| anvl-spartan | 3 | 3 | 210.140 → 210.148 | 1,74 → 1,74 | 0 | (ganz behalten) |
| anvl-terrapin | 51 | 2 | 263.350 → 342.505 | 2,95 → 3,75 | 0 | 60 / 146.544 |
| anvl-terrapin-medic | 51 | 1 | 256.801 → 340.332 | 2,90 → 3,84 | 0 | 53 / 164.435 |
| anvl-valkyrie | 22 | 13 | 354.820 → 677.856 | 3,44 → 6,02 | 0 | (ganz behalten) |
| argo-atls | 35 | 8 | 141.960 → 141.960 | 1,17 → 1,17 | 0 | (ganz behalten) |
| argo-atls-geo | 12 | 12 | 195.239 → 195.239 | 1,57 → 1,57 | 0 | (ganz behalten) |
| argo-atls-geo-collector-grad01 | 12 | 12 | 195.239 → 195.239 | 1,57 → 1,57 | 0 | (ganz behalten) |
| argo-atls-geo-collector-grad03 | 12 | 12 | 195.239 → 195.239 | 1,57 → 1,57 | 0 | (ganz behalten) |
| argo-csv-cargo | 1 | 1 | 202.285 → 202.285 | 1,39 → 1,39 | 0 | (ganz behalten) |
| argo-mole | 48 | 2 | 425.713 → 550.060 | 4,38 → 5,56 | 0 | 69 / 352.233 |
| argo-moth | 46 | 2 | 446.875 → 555.435 | 4,42 → 5,47 | 0 | 71 / 299.637 |
| argo-mpuv | 36 | 34 | 169.954 → 169.954 | 1,26 → 1,27 | 0 | (ganz behalten) |
| argo-mpuv-1t | 44 | 19 | 196.401 → 196.401 | 1,72 → 1,72 | 0 | (ganz behalten) |
| argo-mpuv-transport | 44 | 40 | 210.526 → 210.526 | 1,64 → 1,64 | 0 | (ganz behalten) |
| argo-raft | 58 | 10 | 326.717 → 471.035 | 3,00 → 4,40 | 0 | 100 / 277.924 |
| argo-srv | 19 | 0 | 279.811 → 1.673.483 | 2,80 → 15,19 | 0 | (ganz behalten) |
| banu-defender | 43 | 67 | 223.878 → 284.315 | 2,35 → 3,07 | 0 | (ganz behalten) |
| cnou-hoverquad | 14 | 0 | 125.032 → 125.032 | 0,85 → 0,85 | 0 | (ganz behalten) |
| cnou-mustang-alpha | 21 | 1 | 200.252 → 200.252 | 1,88 → 1,88 | 0 | (ganz behalten) |
| cnou-mustang-alpha-citizencon2018 | 21 | 0 | 200.252 → 200.252 | 1,88 → 1,88 | 0 | (ganz behalten) |
| cnou-mustang-beta | 31 | 8 | 214.568 → 214.568 | 2,01 → 2,01 | 0 | (ganz behalten) |
| cnou-mustang-delta | 21 | 1 | 202.168 → 202.168 | 1,89 → 1,89 | 0 | (ganz behalten) |
| cnou-mustang-gamma | 21 | 1 | 204.626 → 204.626 | 1,88 → 1,88 | 0 | (ganz behalten) |
| cnou-mustang-omega | 21 | 1 | 204.626 → 204.626 | 1,87 → 1,87 | 0 | (ganz behalten) |
| cnou-nomad | 31 | 11 | 207.021 → 207.179 | 2,27 → 2,28 | 0 | (ganz behalten) |
| crus-intrepid | 26 | 1 | 385.179 → 743.177 | 4,70 → 8,57 | 0 | 165 / 641.797 |
| crus-spirit-a1 | 11 | 13 | 536.811 → 641.225 | 5,05 → 5,88 | 0 | 21 / 203.381 |
| crus-spirit-c1 | 16 | 17 | 402.813 → 500.638 | 3,90 → 4,72 | 0 | 26 / 203.068 |
| crus-star-runner | 20 | 16 | 375.172 → 971.528 | 3,80 → 8,80 | 0 | 561 / 1.425.913 |
| crus-starfighter-inferno | 38 | 14 | 239.028 → 239.028 | 2,40 → 2,40 | 0 | nichts |
| crus-starfighter-ion | 38 | 14 | 241.893 → 241.893 | 2,40 → 2,40 | 0 | nichts |
| crus-starlifter-a2 | 64 | 1 | 595.031 → 597.465 | 5,57 → 5,61 | 0 | 1 / 5.554 |
| crus-starlifter-c2 | 12 | 1 | 471.460 → 474.116 | 4,39 → 4,43 | 0 | 1 / 5.554 |
| crus-starlifter-m2 | 63 | 1 | 473.837 → 474.267 | 4,38 → 4,40 | 0 | nichts |
| drak-buccaneer | 34 | 2 | 207.635 → 207.713 | 2,08 → 2,09 | 0 | (ganz behalten) |
| drak-caterpillar | 39 | 5 | 837.626 → 1.365.221 | 8,04 → 13,73 | 0 | 96 / 1.140.174 |
| drak-caterpillar-pirate | 39 | 3 | 837.634 → 1.455.371 | 8,04 → 14,64 | 0 | 100 / 1.325.533 |
| drak-clipper | 19 | 1 | 496.053 → 707.037 | 5,48 → 7,88 | 0 | 193 / 398.067 |
| drak-corsair | 27 | 4 | 723.523 → 1.310.448 | 6,55 → 11,57 | 0 | 201 / 1.239.438 |
| drak-cutlass-black | 18 | 45 | 325.165 → 443.333 | 3,53 → 5,10 | 0 | 20 / 226.034 |
| drak-cutlass-blue | 31 | 6 | 377.589 → 667.319 | 4,14 → 7,22 | 0 | (ganz behalten) |
| drak-cutlass-red | 31 | 2 | 259.152 → 441.530 | 2,74 → 4,81 | 0 | (ganz behalten) |
| drak-cutlass-steel | 28 | 26 | 402.513 → 591.075 | 4,01 → 6,35 | 0 | 54 / 328.118 |
| drak-cutter | 43 | 11 | 303.652 → 409.806 | 3,02 → 4,02 | 0 | 99 / 228.911 |
| drak-cutter-rambler | 43 | 13 | 325.722 → 451.695 | 3,20 → 4,34 | 0 | 135 / 273.690 |
| drak-cutter-scout | 43 | 9 | 278.701 → 375.380 | 2,71 → 3,86 | 0 | 52 / 189.698 |
| drak-dragonfly | 23 | 0 | 166.292 → 166.292 | 1,03 → 1,03 | 0 | (ganz behalten) |
| drak-dragonfly-yellow | 23 | 0 | 166.292 → 166.292 | 1,03 → 1,03 | 0 | (ganz behalten) |
| drak-golem | 0 | 0 | 349.152 → 349.275 | 3,67 → 3,68 | 0 | 4 / 317 |
| drak-golem-ox | 1 | 0 | 276.468 → 276.609 | 3,21 → 3,22 | 0 | (ganz behalten) |
| drak-herald | 56 | 4 | 214.500 → 265.945 | 2,25 → 2,95 | 0 | 3 / 113.407 |
| drak-ironclad | 49 | 2 | 1.135.056 → 1.658.155 | 11,01 → 15,26 | 4 | (ganz behalten) |
| drak-ironclad-assault | 33 | 26 | 1.199.062 → 1.198.811 | 11,69 → 11,70 | 5 | (ganz behalten) |
| drak-mule | 3 | 3 | 206.428 → 206.428 | 1,59 → 1,59 | 0 | (ganz behalten) |
| drak-pitbull | 1 | 0 | 254.368 → 261.281 | 2,74 → 2,83 | 0 | (ganz behalten) |
| drak-vulture | 9 | 11 | 383.068 → 464.275 | 3,57 → 4,30 | 0 | 32 / 171.375 |
| espr-prowler | 25 | 21 | 339.675 → 529.009 | 3,54 → 5,44 | 0 | 29 / 317.232 |
| espr-prowler-utility | 31 | 24 | 454.199 → 635.646 | 5,04 → 6,81 | 0 | 23 / 267.624 |
| espr-talon | 3 | 3 | 239.726 → 239.726 | 2,51 → 2,51 | 0 | (ganz behalten) |
| espr-talon-shrike | 2 | 2 | 260.930 → 260.930 | 2,74 → 2,74 | 0 | (ganz behalten) |
| gama-railen | 16 | 11 | 432.522 → 451.797 | 4,31 → 4,77 | 0 | 10 / 102.595 |
| gama-syulen | 31 | 4 | 284.174 → 364.478 | 2,86 → 3,58 | 0 | 22 / 143.462 |
| gama-tyilui | 25 | 26 | 466.965 → 514.434 | 4,98 → 5,44 | 0 | 11 / 163.343 |
| glsn-basher | 14 | 4 | 242.981 → 248.597 | 2,85 → 2,92 | 0 | 2 / 19.306 |
| glsn-shiv | 49 | 49 | 377.711 → 477.586 | 3,98 → 5,51 | 0 | 18 / 217.493 |
| grin-mdc | 6 | 6 | 212.855 → 212.855 | 2,01 → 2,01 | 0 | (ganz behalten) |
| grin-mtc | 6 | 6 | 215.255 → 215.313 | 2,48 → 2,48 | 0 | (ganz behalten) |
| grin-ptv | 14 | 14 | 29.554 → 29.554 | 0,20 → 0,20 | 0 | (ganz behalten) |
| grin-roc | 0 | 0 | 111.972 → 111.972 | 0,82 → 0,82 | 0 | (ganz behalten) |
| grin-roc-ds | 1 | 1 | 203.670 → 203.670 | 1,43 → 1,43 | 0 | (ganz behalten) |
| grin-stv | 3 | 3 | 146.179 → 146.179 | 0,99 → 0,99 | 0 | (ganz behalten) |
| grin-utv | 5 | 5 | 205.594 → 205.594 | 1,66 → 1,66 | 0 | (ganz behalten) |
| krig-l21-wolf | 56 | 0 | 328.726 → 342.672 | 3,58 → 3,76 | 0 | (ganz behalten) |
| krig-l22-alphawolf | 64 | 0 | 353.956 → 367.820 | 3,88 → 4,06 | 0 | 6 / 24.024 |
| krig-p52-merlin | 29 | 7 | 214.558 → 214.738 | 1,86 → 1,86 | 0 | (ganz behalten) |
| krig-p72-archimedes | 35 | 4 | 215.944 → 219.383 | 1,88 → 1,93 | 0 | (ganz behalten) |
| krig-p72-archimedes-emerald | 35 | 4 | 215.944 → 219.383 | 1,88 → 1,93 | 0 | (ganz behalten) |
| krig-s65-stingray | 38 | 22 | 285.147 → 295.870 | 3,15 → 3,26 | 0 | (ganz behalten) |
| misc-fortune | 62 | 0 | 320.107 → 391.758 | 3,30 → 4,09 | 0 | 62 / 109.571 |
| misc-freelancer | 27 | 43 | 237.515 → 306.925 | 2,44 → 3,06 | 0 | 15 / 183.696 |
| misc-freelancer-dur | 25 | 29 | 243.118 → 330.169 | 2,61 → 3,36 | 0 | 19 / 204.568 |
| misc-freelancer-max | 34 | 39 | 231.366 → 300.031 | 2,44 → 3,06 | 0 | 13 / 175.553 |
| misc-freelancer-mis | 25 | 31 | 300.094 → 387.987 | 2,95 → 3,71 | 0 | 19 / 204.568 |
| misc-fury | 1 | 2 | 221.423 → 221.457 | 2,21 → 2,21 | 0 | (ganz behalten) |
| misc-fury-lx | 3 | 3 | 209.870 → 209.870 | 1,75 → 1,75 | 0 | (ganz behalten) |
| misc-fury-miru | 4 | 4 | 245.779 → 245.829 | 2,11 → 2,11 | 0 | (ganz behalten) |
| misc-hull-a | 33 | 3 | 258.673 → 315.845 | 2,58 → 3,09 | 0 | 76 / 102.274 |
| misc-hull-b | 60 | 1 | 596.718 → 868.265 | 6,03 → 8,35 | 0 | (ganz behalten) |
| misc-hull-c | 61 | 0 | 518.501 → 579.485 | 4,71 → 5,21 | 0 | 13 / 182.048 |
| misc-prospector | 58 | 37 | 218.815 → 219.814 | 2,34 → 2,42 | 0 | (ganz behalten) |
| misc-razor | 2 | 0 | 204.180 → 204.226 | 1,62 → 1,62 | 0 | (ganz behalten) |
| misc-razor-ex | 2 | 0 | 206.315 → 206.385 | 1,45 → 1,45 | 0 | (ganz behalten) |
| misc-razor-lx | 2 | 0 | 204.188 → 204.234 | 1,62 → 1,62 | 0 | (ganz behalten) |
| misc-reliant | 4 | 44 | 207.711 → 212.853 | 2,14 → 2,26 | 0 | 2 / 26.774 |
| misc-reliant-mako | 1 | 29 | 207.519 → 214.935 | 2,07 → 2,24 | 0 | 3 / 39.370 |
| misc-reliant-sen | 4 | 29 | 209.408 → 211.377 | 2,11 → 2,27 | 0 | 3 / 48.835 |
| misc-reliant-tana | 4 | 43 | 215.421 → 232.245 | 2,36 → 2,56 | 0 | 3 / 33.758 |
| misc-starfarer | 23 | 5 | 491.944 → 815.518 | 4,87 → 7,96 | 0 | 554 / 541.621 |
| misc-starfarer-gemini | 24 | 2 | 531.424 → 846.257 | 5,29 → 8,35 | 0 | 502 / 537.780 |
| misc-starlancer-max | 46 | 1 | 730.904 → 1.517.128 | 7,16 → 13,81 | 0 | 760 / 2.158.668 |
| misc-starlancer-tac | 28 | 0 | 906.529 → 906.645 | 9,12 → 9,14 | 2 | nichts |
| misc-starlite | 42 | 2 | 402.035 → 484.730 | 4,07 → 4,94 | 0 | (ganz behalten) |
| mrai-guardian | 5 | 5 | 525.726 → 525.782 | 5,75 → 5,75 | 2 | nichts |
| mrai-guardian-mx | 26 | 26 | 643.659 → 643.727 | 6,65 → 6,65 | 2 | nichts |
| mrai-guardian-qi | 7 | 7 | 491.373 → 491.433 | 5,35 → 5,35 | 2 | nichts |
| mrai-pulse | 8 | 8 | 118.978 → 118.978 | 0,90 → 0,90 | 0 | (ganz behalten) |
| mrai-pulse-lx | 8 | 8 | 118.118 → 118.118 | 0,91 → 0,91 | 0 | (ganz behalten) |
| orig-100i | 19 | 18 | 210.220 → 210.228 | 1,80 → 1,80 | 0 | (ganz behalten) |
| orig-125a | 22 | 21 | 217.091 → 217.121 | 1,90 → 1,90 | 0 | (ganz behalten) |
| orig-135c | 15 | 15 | 216.048 → 216.074 | 1,85 → 1,86 | 0 | (ganz behalten) |
| orig-300i | 6 | 5 | 180.535 → 180.535 | 1,50 → 1,50 | 0 | (ganz behalten) |
| orig-315p | 13 | 10 | 200.135 → 200.135 | 1,70 → 1,71 | 0 | (ganz behalten) |
| orig-325a | 6 | 6 | 211.605 → 211.605 | 1,82 → 1,82 | 0 | (ganz behalten) |
| orig-350r | 5 | 5 | 192.949 → 192.949 | 1,59 → 1,59 | 0 | (ganz behalten) |
| orig-400i | 36 | 14 | 355.435 → 564.527 | 3,81 → 5,77 | 0 | 223 / 353.680 |
| orig-600i | 34 | 59 | 420.408 → 542.961 | 3,53 → 4,77 | 0 | 90 / 434.318 |
| orig-600i-bis2951 | 34 | 59 | 420.408 → 542.961 | 3,53 → 4,77 | 0 | 90 / 434.318 |
| orig-600i-touring | 29 | 46 | 416.156 → 473.201 | 3,41 → 4,21 | 0 | 75 / 333.288 |
| orig-85x | 2 | 0 | 208.383 → 208.383 | 1,61 → 1,61 | 0 | (ganz behalten) |
| orig-890jump | 9 | 0 | 777.573 → 777.545 | 7,05 → 7,08 | 0 | (ganz behalten) |
| orig-m50 | 13 | 8 | 216.412 → 216.412 | 1,74 → 1,74 | 0 | (ganz behalten) |
| orig-m80 | 28 | 5 | 343.808 → 388.165 | 3,99 → 4,45 | 0 | 42 / 123.763 |
| orig-x1 | 5 | 5 | 198.926 → 198.926 | 1,29 → 1,29 | 0 | (ganz behalten) |
| orig-x1-force | 5 | 5 | 200.348 → 200.348 | 1,43 → 1,43 | 0 | (ganz behalten) |
| orig-x1-velocity | 5 | 5 | 186.372 → 186.372 | 1,22 → 1,22 | 0 | (ganz behalten) |
| rsi-apollo-medivac | 56 | 18 | 700.095 → 1.001.909 | 7,10 → 10,06 | 0 | 119 / 477.736 |
| rsi-apollo-triage | 58 | 19 | 675.360 → 976.944 | 6,82 → 9,78 | 0 | 119 / 477.736 |
| rsi-aurora-gs-cl | 46 | 19 | 210.288 → 218.606 | 2,19 → 2,39 | 0 | (ganz behalten) |
| rsi-aurora-gs-es | 53 | 15 | 209.416 → 216.424 | 2,21 → 2,38 | 0 | (ganz behalten) |
| rsi-aurora-gs-ln | 53 | 16 | 211.738 → 219.890 | 2,22 → 2,42 | 0 | (ganz behalten) |
| rsi-aurora-gs-lx | 54 | 17 | 211.136 → 218.946 | 2,19 → 2,39 | 0 | (ganz behalten) |
| rsi-aurora-gs-mr | 53 | 13 | 210.212 → 218.940 | 2,19 → 2,40 | 0 | (ganz behalten) |
| rsi-aurora-gs-se | 48 | 17 | 215.023 → 225.063 | 2,25 → 2,47 | 0 | (ganz behalten) |
| rsi-aurora-mk2 | 19 | 12 | 442.325 → 442.325 | 5,03 → 5,03 | 2 | nichts |
| rsi-constellation-andromeda | 33 | 19 | 824.772 → 1.022.653 | 8,18 → 10,11 | 0 | 133 / 503.249 |
| rsi-constellation-aquila | 39 | 13 | 730.580 → 801.403 | 7,13 → 7,85 | 0 | 109 / 190.213 |
| rsi-constellation-mk5-centaurus | 56 | 39 | 1.273.591 → 1.273.581 | 12,01 → 12,01 | 4 | (ganz behalten) |
| rsi-constellation-phoenix | 36 | 32 | 831.911 → 989.145 | 7,80 → 9,32 | 0 | 278 / 433.474 |
| rsi-constellation-phoenix-emerald | 33 | 51 | 554.525 → 753.855 | 6,23 → 8,37 | 0 | 248 / 402.059 |
| rsi-constellation-taurus | 30 | 12 | 551.308 → 713.246 | 5,53 → 7,11 | 0 | 120 / 411.116 |
| rsi-hermes | 33 | 24 | 688.794 → 814.885 | 6,93 → 8,23 | 0 | 46 / 233.783 |
| rsi-lynx | 3 | 3 | 208.256 → 208.426 | 1,91 → 1,91 | 0 | (ganz behalten) |
| rsi-mantis | 42 | 2 | 211.431 → 233.990 | 2,21 → 2,58 | 0 | 46 / 80.639 |
| rsi-meteor | 23 | 1 | 237.450 → 262.994 | 2,63 → 2,91 | 0 | 17 / 45.236 |
| rsi-perseus | 51 | 46 | 1.062.770 → 1.062.756 | 11,69 → 11,69 | 5 | (ganz behalten) |
| rsi-polaris | 4 | 0 | 1.087.337 → 1.087.408 | 12,76 → 12,77 | 6 | (ganz behalten) |
| rsi-salvation | 17 | 17 | 225.986 → 226.004 | 2,66 → 2,66 | 0 | 1 / 20 |
| rsi-scorpius | 33 | 0 | 405.115 → 420.988 | 3,76 → 3,90 | 0 | (ganz behalten) |
| rsi-scorpius-antares | 29 | 0 | 293.181 → 308.988 | 2,93 → 3,08 | 0 | 14 / 28.557 |
| rsi-skylark | 16 | 0 | 210.001 → 211.411 | 2,20 → 2,23 | 0 | (ganz behalten) |
| rsi-ursa-medivac | 35 | 13 | 210.941 → 211.053 | 1,99 → 1,99 | 0 | (ganz behalten) |
| rsi-ursa-rover | 30 | 2 | 160.075 → 160.075 | 1,48 → 1,48 | 0 | (ganz behalten) |
| rsi-ursa-rover-emerald | 36 | 3 | 156.030 → 156.030 | 1,47 → 1,47 | 0 | (ganz behalten) |
| rsi-zeus-cl | 28 | 0 | 465.116 → 881.912 | 4,89 → 8,78 | 0 | 57 / 713.948 |
| rsi-zeus-es | 28 | 2 | 429.579 → 665.386 | 4,46 → 6,75 | 0 | 74 / 389.543 |
| tmbl-cyclone | 25 | 25 | 143.637 → 143.637 | 0,94 → 0,94 | 0 | (ganz behalten) |
| tmbl-cyclone-aa | 25 | 25 | 165.121 → 165.121 | 1,11 → 1,11 | 0 | (ganz behalten) |
| tmbl-cyclone-mt | 25 | 25 | 193.454 → 193.454 | 1,38 → 1,38 | 0 | (ganz behalten) |
| tmbl-cyclone-rc | 18 | 18 | 148.002 → 148.002 | 0,96 → 0,96 | 0 | (ganz behalten) |
| tmbl-cyclone-rn | 25 | 25 | 156.989 → 156.989 | 1,01 → 1,01 | 0 | (ganz behalten) |
| tmbl-cyclone-tr | 25 | 25 | 162.638 → 162.638 | 1,07 → 1,07 | 0 | (ganz behalten) |
| tmbl-nova | 0 | 43 | 210.221 → 220.070 | 1,99 → 2,16 | 0 | 6 / 67.029 |
| tmbl-storm | 79 | 54 | 221.575 → 231.669 | 2,02 → 2,13 | 0 | (ganz behalten) |
| tmbl-storm-aa | 73 | 72 | 481.585 → 495.209 | 4,86 → 4,99 | 0 | (ganz behalten) |
| vncl-blade | 38 | 38 | 211.258 → 211.394 | 1,85 → 1,85 | 0 | (ganz behalten) |
| vncl-glaive | – | – | 212.226 → 212.226 | 1,38 → 1,38 | 0 | (ganz behalten) |
| vncl-scythe | 1 | 0 | 202.208 → 202.208 | 1,38 → 1,38 | 0 | (ganz behalten) |
| vncl-stinger | 19 | 19 | 267.332 → 334.174 | 2,92 → 3,66 | 0 | 5 / 133.482 |
| xian-nox | 6 | 0 | 89.009 → 89.009 | 0,83 → 0,83 | 0 | (ganz behalten) |
| xian-nox-kue | 6 | 0 | 60.842 → 60.842 | 0,54 → 0,54 | 0 | (ganz behalten) |
| xian-scout | 3 | 3 | 187.075 → 187.075 | 1,50 → 1,50 | 0 | (ganz behalten) |
| xnaa-santokyai | 4 | 4 | 385.411 → 385.411 | 3,44 → 3,44 | 0 | (ganz behalten) |
