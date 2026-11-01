# Lose Teile am Rumpf (30.10.2026)

Anlass: Krisz, 30.10.2026 13:20: „jedes schiff soll komplett angeschaut
werden, innen und aussen“. Beim Ansehen aller 231 Rümpfe von staging
(Stand 081d9ca0, also vor dem Neubau „nur zweiseitig“) hingen bei 29
Teile frei in der Luft. Zugehörig: `hangar-cockpit-hohl.md` (Neubau),
`hangar-innenlage.md` (Innenräume).

## Werkzeug

`node scripts/measure-hangar-inseln.mjs all` rastert jeden Rumpf
(Voxel 0,5 m), verbindet, was höchstens 1 m auseinanderliegt, und meldet
jeden Verbund außer dem größten, der außerhalb von dessen Hüllquader
liegt. Inseln im Rumpf (Kraftwerke, Kühler, Relais in ihren Schächten,
44 Schiffe) sind gewollt und erscheinen nur mit `--alle-inseln`.
Gegen einen Rohexport (`--roh <glb>`) nennt es je Insel die Knoten mit
ihrem Pfad unter der Schiffswurzel; `--mit-ausgeblendet` nimmt die Teile
dazu, die der Bau weglässt (Schild, Proxy, Kollision, Schaden, LOD), um
zu sehen, ob eines davon die Insel mit dem Rumpf verbindet.

Lauf über alle 231 Rümpfe: 284 s, 29 mit losen Teilen.

## Befund

| Schiffe | Insel | Abstand | Bild |
|---|---|---:|---|
| Hornet F7C, F7CR, F7CS (Mk I) | beide Flügelwaffen neben der Flügelspitze | 1,3 m | Waffe hängt neben dem Flügelende |
| Hornet F7CM, F7CM Heartseeker | beide Flügelwaffen | 2,1 m | wie oben |
| Hornet F7A Mk I, Wildfire | eine Flügelwaffe | 1,3–1,4 m | die andere Seite sitzt |
| Hornet F7A/F7C/F7CR/F7CS Mk II | linke Flügelwaffe | 0,9 m | rechte sitzt |
| Hornet F7CM Mk II (+Heartseeker) | 47 Dreiecke Milchglas | 1,5 m | klein |
| Avenger Stalker, Titan, Titan Renegade, Warlock | Feuerlöscherschrank über dem Rumpf | 1,4 m | gut sichtbar |
| 300i, 315p, 325a, 350r | zwei Kleinteile (84 und 99 Dreiecke) unter dem Schiff | 2 und 3,5 m | sichtbar unter dem Bauch |
| 325a | Innenraumteil (`ORIG_300i_int_mtl_mat_dark_09`) | 32 m | weit seitlich, Hüllquader 48,6 m breit |
| Star Runner | zwei Teile à 190 Dreiecke unter dem Schiff | 1,7 m | sichtbar |
| Vulture | Kleinteil über dem Rumpf | 2,8 m | klein |
| ROC | Teil neben dem Fahrzeug | 1,6 m | klein |
| Asgard, Fury (+Miru), 890 Jump, Polaris | 1–12 Dreiecke (Glas, Leuchtfläche) | 0,8–5,4 m | unsichtbar klein |

Die Hornet-Flügelwaffen sind Tauschteile (`swap` an
`hardpoint_class_2_left_wing` / `_right_wing`, Anker bei x = ±9,35 m),
der Flügel endet beim F7C bei x ≈ 7,7 m. Der Halter selbst liegt also
neben dem Flügel: entweder fehlt im Bau die Flügelspitze oder ein
Waffenhalter (als Schaden/LOD ausgeblendet?), oder der Export setzt den
Halter falsch. Dass Mk-II-Hornets nur links betroffen sind, spricht für
einen Fehler in den Daten einer Seite, nicht im Bau.

## Auftrag PC (Teil 4 des Laufs „Rümpfe nur zweiseitig“)

1. Je betroffener Rohexport `node scripts/measure-hangar-inseln.mjs --roh
   .cache/hangar-src/ships/<slug>.glb` und dasselbe mit
   `--mit-ausgeblendet`: Verschwindet die Insel, lässt der Bau ein
   verbindendes Teil weg (Name und Grund nennen). Bleibt sie, die Knoten
   der Insel und ihres Ports gegen die Spieldaten halten (Lage des Ports
   am Fahrzeug, Halter-Teil im Loadout).
2. Regel umsetzen (Bau oder Export, keine Versätze je Schiff von Hand),
   betroffene Rümpfe neu bauen, `measure-hangar-inseln.mjs all`
   nachmessen. Ziel: keine sichtbare Insel mehr; unsichtbar kleine (unter
   50 Dreiecken) dürfen bleiben, wenn der Grund genannt ist.
3. Danach baut die Cloud daraus ein Tor (Klinke auf die Zahl der Rümpfe
   mit Inseln, benannte Ausnahmen).

## Befund vom PC

Branch `pc/hangar-zweiseitig`, auf Teil 3 (84950ba1). Messung vorher:
`hangar-inseln/vorher.json` (Rümpfe nach Teil 3), nachher: `nachher.json`.
`measure-hangar-inseln.mjs all`: **29 → 16 Rümpfe mit losen Teilen**, davon
5 unsichtbar klein (Zählfehler „4“ bis 01.11.2026).

**Ursache Hornet (alle 13): der Bau ließ den Außenflügel weg.** Die
Flügelwaffe hängt im Rohexport an `WingLeft_Debris`/`wing_left_debris`
(Hornet F7C: x −10,8 bis −4,3 m, darunter `hardpoint_class_2_left_wing`).
Im Rohexport gibt es keine Insel, auch nicht ohne die ausgeblendeten Teile.
`DROP` in `build-hangar-assets.mjs` warf jedes Netz mit „debris“ im Namen
weg. „*_Debris“ ist im Spiel aber das heile Ablöseteil (es fällt bei
Beschuss ab), seine Schadensfassungen heißen `dmg_*_debris` und
`*_Debris_intDmg`. Gegenprobe: kein debris-Netz der 22 Schiffe mit solchen
Netzen hat einen deckungsgleichen Zwilling (größte Überlappung der
Hüllquader 0,16, Hornet-Fahrwerkskasten 0,42 gegen die Fahrwerkstür). Warum
die Mk II nur links eine Insel hatten, habe ich nicht geprüft; vermutlich
reicht rechts ein anderes Flügelteil (`wing_flap_right`) bis an die Waffe.

**Regel:** `DROP` lässt „debris“ stehen und nimmt nur noch
`dmg_\w*debris` und `debris\w*dmg` (die Schadensfassungen). Gegenprobe über
alle Rohexporte: 24 betroffen, nur wieder behaltene Teile, keins fällt neu
weg (Hornets, C8/C8R/C8X-Flügel, Javelin-Bugspitzen, Hull-C-Triebwerksteile,
Pulse/Pulse-LX-Seitenpaneele, Zeus CL/ES-Streben; bei Railen und Tyilui eine
Korallen-Deko `spiky_coral_01_debris_a` im Innenraum). Ein breiteres „dmg“
statt „_dmg“ hätte bei 105 Rohexporten bisher sichtbare `DMG_*`-Netze
genommen (Polaris 138 299 Dreiecke): verworfen, nicht Teil dieses Schritts.
Neu gebaut: die 24 Rümpfe (Dreiecke −2,9 bis +2,6 %, Fahrwerk wie vorher)
und die Innenräume von Railen und Tyilui (+2 752 Dreiecke).

**Es bleiben sichtbar (11 Rümpfe), alle schon im Rohexport so:**

| Rümpfe | Insel | Befund |
|---|---|---|
| Avenger Stalker, Titan, Titan Renegade, Warlock | Feuerlöscherschrank, 0,7 m über dem Rumpf (vorher 1,4 m) | Container `base_int_mid`: scene.json nennt zwei Platzierungen von `extinguisher_cabinet_1_a.cgf`, eine bei z −1,25 m (sitzt), eine bei (0,75, 1,22, 2,92) über dem Dach. Mit der Container-Regel (Offset 0,64 m) rückt sie näher, bleibt aber draußen. Die Platzierung selbst steht so in den Daten. |
| 300i, 315p, 325a, 350r | zwei Kleinteile (99 und 84 Dreiecke), 2 und 3,5 m unter dem Bug | `nose/lg_hinge_front_left`: links und rechts spiegelbildliche Lage (±0,454 / 1,28 / −1,712), aber das linke Netz liegt in einem anderen Rahmen (Ecken bei y 4 bis 5,7, z −5,4 statt um den Ursprung) und ist um 90° anders gedreht. Das rechte sitzt. Fehler im Rohexport einer Seite. |
| 325a | Innenraumteil (`ORIG_300i_int_mtl_mat_dark_09`, 87 Dreiecke), 32 m seitlich | Teil eines behaltenen Containers, auch nach der Regel 32 m daneben. |
| Star Runner | zwei Fahrwerksarme (je 190 Dreiecke), 1,7 m außen | `…/CRUS_Star_Runner_Landing_Gear/…/BONE_arm_b`: Armknochen des Fahrwerks. Die Pose stellt die Beine, nicht die übrigen Knochen der Ausfahr-Animation (`hangar-alle-schiffe.md`: „Teile in Landestellung bewegen … nicht gemacht“). |
| Vulture | Tankstutzen oben (140 Dreiecke), 2,8 m über dem Rumpf | `DockingTube_Fuel_Ports_DRAK_Vulture` hängt direkt unter der Schiffswurzel bei (0, −2,52, 6,742); der Halter `hardpoint_fuel_port` liegt bei (0, 0,27, 1,84). |
| ROC | Fingerspitze des Bergbaulasers (558 Dreiecke), 1,6 m daneben | `…/Mining_Laser_GRIN_Arbor_S0/…/laser_finger_1_tip`, Teil des Laserkopfs; liegt im Rohexport so. |

**Unsichtbar klein (unter 50 Dreiecken), bleiben:** Asgard 12 Dreiecke
Rumpflack-Splitter 0,8 m, Fury und Fury Miru je 2 Dreiecke Kanzelglas 2 m,
890 Jump 1 Dreieck Dämmung 5,4 m, Polaris 4 Dreiecke Triebwerksglühen
1,7 m. Alle so im Rohexport.

Die elf sichtbaren brauchen je eine eigene Klärung gegen die Spieldaten
(Platzierung im Container, Bugscharnier einer Seite, Fahrwerksknochen,
Tankstutzen, Laserkopf). Eine gemeinsame Regel dafür habe ich nicht gefunden;
Versätze je Schiff von Hand habe ich nicht eingetragen.

## Tor (31.10.2026)

`verify:hangar-lage` [4] (Schiene A) prüft jeden ausgelieferten Rumpf mit
derselben Rechnung (`scripts/lib/hangar-lage.mjs`): Ein Schiff mit losem
Teil außerhalb des Hüllquaders braucht eine benannte Ausnahme (die 16
Schiffe oben, Anlass aus dieser Tabelle), mehr Inseln oder weiter draußen
(+0,5 m) als seine Klinke ist FEHLER, eine Ausnahme ohne Insel ein Zombie.
Höchstens 16 Schiffe mit losen Teilen.

Vorgeführt rot: am Gladius-Rumpf in `dist/` ein Teil (48 Dreiecke
Warnband) 25 m nach hinten gesetzt → „[4] aegs-gladius: 1 lose Teile neben
dem Rumpf (48 Dr. 7.9 m draussen, …) ohne benannte Ausnahme“, „[4] 17
Schiffe mit losen Teilen, Klinke 16“; Datei zurückgelegt → grün.
