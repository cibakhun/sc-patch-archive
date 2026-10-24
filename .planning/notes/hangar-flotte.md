# Hangar: alle Schiffe auf ihrem Fahrwerk (2026-10-24)

Auslöser für die PC-Sitzung: **„Hangar-Flotte“**. Derselbe Satz noch einmal
setzt den Lauf fort, wo er stand.

Anlass, Krisz 2026-10-24 13:23: „hol mal alle texturen, geometrien,
interior, materialien, alles was du holen kannst damit wir alle schiffe so
realistisch wie möglich nachstellen könnnen.“ Und 13:24: „mach dann so dass
alle schiffe korrekt auf dem boden stehen mit deren landinggear. also wie
intended.“

Es gelten die Regeln aus [`hangar-katalog.md`](hangar-katalog.md): alles aus
dem Spiel, keine Roh-Exporte, kein `.mtl`-XML und keine Rohtexturen im Repo
(das Repo ist öffentlich). Rohdaten bleiben im gitignorierten Cache.

## Was schon da ist

Das Holen hat der PC in der Nacht zum 24.10. erledigt (Branch
`pc/schiffe-komplett`, Notiz [`schiffe-komplett.md`](schiffe-komplett.md)):
Alle 231 Hangar-Schiffe liegen im Rohbestand `.cache/hangar-src/ships/`
(4.10.2, LOD 1, mip 1, `--materials all`, mit Innenraum, ausgenommen
Großschiffe über der Speichergrenze von 24 GB je Export), dazu der zerlegte
Export mit Lacken, Paletten, Finish und allen Untermaterialien. Gebaut sind
die zehn Web-Schiffe neu und die Lack-Baupläne. Diesen Rohbestand **nicht**
neu holen. Die Cloud bringt `pc/schiffe-komplett` nach staging.

Offen ist das Fahrwerk:

- Der Viewer stellt jedes Schiff mit dem tiefsten Punkt seines Hüllquaders
  auf den Boden (`robustBox`, `wrap.position.set(-center.x, -box.min.y,
  -center.z)` in `assets/hangar-viewer.js`). Über das Fahrwerk weiß er
  nichts.
- Ob es ausgefahren ist, hängt davon ab, in welcher Lage das Modell
  exportiert wurde: Die Gladius steht in den Renders auf ihren Beinen, die
  Geometrie-Fassung der Prospector zeigt keins. Schiffe mit eingefahrenem
  Fahrwerk liegen auf dem Rumpf oder auf dem, was am tiefsten hängt. Eine
  Schräglage auf ungleich langen Beinen kennt der Viewer nicht.
- 221 der 231 Schiffe zeigen im Hangar die Geometrie-Fassung aus
  `public/holo/` (ohne Lack). Sie ist auch das Hologramm im Datenblatt und
  liegt im Raum der Hardpoints (auf 1 mm).

## Auftrag PC

0. Branch `pc/hangar-flotte` von `origin/staging`. Ist `pc/schiffe-komplett`
   dort noch nicht eingemischt, von `origin/pc/schiffe-komplett`. Vor jedem
   Push `npm run build && npm run gate`; ohne PR, die Cloud merged. Nach
   jedem Teil pushen, damit ein abgebrochener Lauf nichts verliert.

### Teil A: Fahrwerk verstehen (Bericht in „Befund PC“)

1. An fünf Proben (`aegs-gladius`, `misc-prospector`, `anvl-carrack`,
   `rsi-polaris`, `tmbl-cyclone`), mit Quelle:
   - Wie das Spiel das Fahrwerk beschreibt: welcher Datensatz oder welche
     Datei die Beine nennt (Suchbegriffe: LandingSystem, landing_gear, Gear,
     Mannequin-Fragmente Deploy/Retract, `.cga`/`.anm`/`.caf`/`.dba`, ADB),
     welche Knoten und Knochen dazugehören, welche Animation sie ausfährt.
   - In welcher Lage der Rohexport steht (ein- oder ausgefahren).
   - Ob StarBreaker eine Pose beim Export setzen kann. Wenn nicht: Beine als
     eigene Knoten behalten und das letzte Bild der Ausfahr-Animation
     anwenden. `scripts/lib/ivo-caf.mjs` liest IVO-`.caf` schon (Lift und
     Schachttor nutzen es); für `.dba` erweitern.
   - Ob das Spiel eine Einfederung im gelandeten Zustand kennt (Wert und
     Quelle); wenn ja, anwenden.
2. Ohne Gegenansage gleich weiter mit Teil B.

### Teil B: Aufstandspunkte für alle 231

3. Je Schiff aus dem ausgefahrenen Fahrwerk die Aufstandspunkte: den
   tiefsten Punkt jedes Rads, Fußes oder Kufenstücks, im Modellraum der
   Webdatei (glTF, Y oben, Meter). Dazu die Ebene durch diese Punkte
   (Neigung um Quer- und Längsachse in Grad) und ihre Höhe. Neu exportieren
   nur, wo der Rohbestand die Beine nicht hergibt.
4. Ins Manifest `src/data/hangar-assets.json` je Schiff `gear: { pose:
   "aus", contacts: [[x, y, z] …], ground, tilt: [quer, längs], source,
   game }`, auch für die Schiffe, die nur die Geometrie-Fassung haben (ein
   eigener Abschnitt `gear` neben `ships`, Schlüssel = Slug). Schiffe, die im
   Spiel ohne Fahrwerk aufsetzen (Kufen am Rumpf, Räder bei
   Bodenfahrzeugen), bekommen `pose: "keins"` mit `why` und ihre tiefsten
   Punkte als `contacts`.
5. Geometrie-Fassung für den Hangar mit ausgefahrenem Fahrwerk, ohne
   Innenraum, im selben Raum wie `public/holo/` (Hardpoints auf 1 mm wie
   bisher), als eigene Ablage `public/hangar/geo/<slug>.glb` mit
   Manifest-Eintrag. `public/holo/` (Datenblatt) bleibt unverändert.
   Zusammen höchstens rund 90 MB; sonst Dreiecke senken und die Größe
   nennen.

### Teil C: Werkslack mit Fahrwerk

6. Die zehn Web-Schiffe mit ausgefahrenem Fahrwerk neu bauen, sonst wie in
   `pc/schiffe-komplett`. Kein Schiff wird schwerer als nach
   `pc/schiffe-komplett` auf staging (PR #204; Gladius 12,6 MB, Aurora
   18,3 MB, Bytes je Schiff in `ships.<slug>.bytes`). Ob die schwereren
   Lacke bleiben, entscheidet Krisz in WINDOWS 112 (4); sagt er nein, gilt
   für die zehn wieder der Stand vor PR #204. Seit PR #204 tragen die
   Lackkarten eine Inhaltskennung im Namen und der Bau entfernt verwaiste;
   der Austausch in `public/hangar/paints/tex/` ist also erwartet. Lacke ohne
   Palette im zerlegten Export nehmen die Farben aus `ship-paints.json`.
7. Dann die zweiten zehn aus `SHIPS` (Corsair, Zeus ES, Prospector, Sabre,
   Intrepid, Vulture, Pisces Expedition, 400i, Carrack, Polaris), gleicher
   Weg, Budget je Schiff: 200 000 Dreiecke, Farbe 1024 px, Normalen 512 px,
   höchstens rund 14 MB (darüber Karten verkleinern und die Größe
   nennen).
8. Halt. Im Befund: Bytes, Dreiecke und Texturen je Schiff und die Summe für
   alle 231 hochgerechnet. Alle 231 mit Lack wären bei 10 bis 14 MB je
   Schiff 2,3 bis 3,2 GB, zu viel für das Repo (rund 1 GB); über die Ablage
   ab hier entscheidet Krisz mit diesen Zahlen.

### Teil D: offene Fragen der Schichten

9. [`hangar-schichten.md`](hangar-schichten.md) S1 bis S4 im selben Lauf
   beantworten; Schmutz und Richtung der Abnutzung gelten für die
   Schiffsmaterialien genauso.

### Selbstauskunft

10. Die übliche Kopfzeile; Zahl der Schiffe mit Fahrwerk, ohne Fahrwerk
    (mit Grund), neu gebaut; Bytes; Fehler mit Schiff und Meldung.

## Cloud danach

Erledigt am 25.10.2026 (Teil A, B und D sind eingebaut):

- Viewer: `standOn` stellt das Schiff auf seine Aufstandspunkte; die Ebene
  rechnet `gearPlane` (exportiert, dieselbe Rechnung im Tor), steiler als
  15 Grad gilt als Lesefehler. Aufzug, Wartungsplatz (`shipUnder`), Marker
  und getauschte Waffen gehen mit, weil die Neigung zwischen Drehung und
  Zentrierung sitzt. Ohne Fahrwerk nennt `opts.gear` nur `ground`.
- `HangarApp.astro` lädt die Geometrie-Fassung aus `public/hangar/geo/` und
  entscheidet je Schiff (`standFor`): `aus` mit mindestens drei Punkten und
  nichts tiefer als 20 cm unter der Ebene (`GEAR_SINK`) auf das Fahrwerk;
  `keins` und `aus` mit nur zwei Punkten waagrecht auf `ground`; sonst wie
  bisher auf den tiefsten Punkt. Stand: 127 auf dem Fahrwerk, 47 waagrecht,
  32 mit Teilen in Flugstellung, 19 eingefahren, 6 ohne Export. Der
  Werkslack bleibt bis Teil C wie bisher.
- Tor `verify:hangar-gear`: misst jede Datei, die die Seite aufs Fahrwerk
  stellt, gegen die Ebene des ausgelieferten Viewers. Nichts tiefer als
  20 cm im Boden, die tiefste Ecke höchstens 5 cm (große Schiffe 0,1 % der
  Länge) darüber, jedes Schiff zugeordnet; Klinken 127 und 47. Die Grenze
  von 2 cm aus dem Plan hielt nicht: Fußplatten und Düsen bis 17 cm
  (Skylark, Hull A und B, Wolf) verdeckt der Rumpf, ein Rückfall auf den
  tiefsten Punkt sähe dort schlechter aus.

### Für den nächsten Lauf (vom Tor gefunden)

Zusätzlich zu Teil C, mit derselben Regel: alles aus dem Spiel.

- **Werkslack aufs Fahrwerk.** Trägt eine Webdatei nach Teil C die Beine
  wie die Geometrie-Fassung (ausgefahren und eingefedert, gleiche
  Aufstandspunkte), in `ships.<slug>` `gear: true` setzen. Dann stellt die
  Seite auch den Werkslack darauf, und das Tor misst die Webdatei mit.
- **Bewegliche Teile in Landestellung** (32 Schiffe tiefer als 20 cm, Liste
  in `gear.<slug>.below`): Polaris-Flossen 5,9 m, Redeemer `thruster_bar`
  12,7 m, 300i-Reihe `lg_hinge_front_left` 3,7 m, Paladin, Star Runner,
  Starfarer, Constellation, Prowler, Corsair, Sabre `foot_flap_a`,
  Starlancer, Guardian, Stinger, Caterpillar, Asgard, Golem, Hoverquad.
  Wo das Spiel dafür eine Lande-Animation hat (Fragmente Deploy), ihr
  letztes Bild anwenden wie bei den Beinen.
- **Schwebende Füße** (Tor-WARNUNG, Fußpunkt mehr als 5 cm über der
  Ebene): Starlifter A2, C2, M2 rund 32 cm; Spirit A1 und C1 7 bis 14 cm;
  Hull B 13 bis 14 cm; 600i (drei Fassungen), Hermes, Apollo (zwei),
  Starlite 6 bis 9 cm. Das Bein steht in der Fassung anders als die Feder.
- **Nur zwei Aufstandspunkte**: Mantis, Meteor, Buccaneer (Beine mit
  demselben Helfer fallen zusammen); stehen bis dahin waagrecht.
- **Lose Knoten im Kreis** in sechs Fassungen (Blade, CSV-Cargo, Hornet
  F7C-R, M80, Nova, Salvation): von der Szene nicht erreicht, nicht
  gezeichnet; beim Bau entfernen.
- Die 19 mit `pose: ein` und die 6 ohne Export wie im Befund.

## Befund PC

=== Hangar-Flotte Teil A, B, D · 4.10.2 (CL 12913470) · Branch `pc/hangar-flotte` · 24./25.10.2026 ===

Teil C (Web-Schiffe mit Fahrwerk und Lack) ist noch offen. Er kommt mit dem nächsten „Hangar-Flotte“.

### Teil A: Wie das Spiel das Fahrwerk beschreibt

**Datensatz.** `VehicleComponentParams` des Schiffs-Records nennt `landingSystem` (Record `VehicleLandingGearSystem.<Schiff>_LandingSystem`, 133 im Spiel), `landingOffset` und `landingRotationOffset`. Der Port `landingpad_helper` trägt nur das allgemeine Item `Default_LandingSystem`.

Das Landesystem enthält:
- das Mannequin-Fragment `Landing_Gear` mit den Untertags `Deploy`, `Retract` und `Compress`;
- je Bein:
  - `bone`, den Helfer am Schiff (z. B. `helper_landing_gear_front`);
  - `geometry` (`.cdf`-Charakter oder `.cga`);
  - die Feder: `lengthTarget` (Länge im gelandeten Zustand), `lengthMin`, `lengthMax`, `offset` und `springBone`.

**Animationen.** Der Weg geht `.cdf` → `<Model File=".chr">` → `<chr>.chrparams`, bei `.cga` liegt die `.chrparams` daneben. Die `.chrparams` nennt entweder `$TracksDatabase` (`.dba`) samt Namen der `.caf` oder einzelne `.caf` (Polaris) oder `*` (alle der Datenbank, Reclaimer).
- Mannequin (`ARGO_MPUV_LandingGearAnims.adb`): Deploy = extend, Retract = extend rückwärts (Speed −1), Compress = compress.
- **`.dba`:** Ich habe den Aufbau entschlüsselt (`scripts/lib/ivo-caf.mjs`, `readDba`). Chunk 0x194FBC50 enthält nacheinander Blöcke `#dba`, die wie ein `#caf`-Block gebaut sind. Am Dateiende stehen die `.caf`-Pfade in Blockreihenfolge.
- **Skelett der `.chr`:** Chunk 0xC2011111 in Version 0x900, je Knochen 68 Byte, Namen über CRC32 (`scripts/lib/ivo-skeleton.mjs`).
- **Knoten des Rohexports:** Sie tragen die relative Ruhelage der `.chr`, die Spuren gelten im selben Raum.
- **Belegt:** Das letzte Bild von extend ist gleich dem ersten von compress, jede Drehung und jede Position. Geprüft an Prospector-Bugbein (17/17) und Gladius.
- **Spurformate:**
  - Drehung 0x82 lesbar.
  - Position 0xC0 und 0xC2 lesbar. Bei 0xC2 liegen die Kanäle nacheinander, nicht verschränkt; der Leser ist korrigiert.
  - Zeitformat 0x40 trägt keine lesbare Zeitspur, Anfang und Ende gehen trotzdem.
  - **Position 0xC1 ist nicht entschlüsselt** (3 Floats Kopf, dann 16-Bit-Dreiergruppen; kein getesteter Maßstab trifft).
  - Von 264 Beinen sind 76 voll lesbar. Fehlende Positionen kommen aus der jeweils anderen Spur oder bleiben in Ruhelage.

**StarBreaker** kann beim Export keine Pose setzen; `entity export --help` hat keinen Schalter dafür. Der Rohexport steht in der Ruhelage der Modelle, und die ist je Schiff verschieden: ausgefahren (Gladius, Carrack), gemischt (Prospector: Bugbein ein) oder eingefahren (Polaris).

**Aufstandshöhe.** Welt(Feder-Ursprung) · (`offset` + (0, 0, −`lengthTarget`)), y. Der Feder-Ursprung ist `springBone`, wo gesetzt (Eclipse: `body`, Reclaimer: `hardpoint_spring_*`), sonst der Helfer.
- Die seitlichen Anteile des `offset` sind keine Lagen: Bei der Carrack wäre links −2 m nach außen, rechts gespiegelt +2 m nach innen. x/z kommen deshalb vom Bein.
- Gegenprobe: `landingpad_helper` der Gladius liegt bei −2,670, die Federn ergeben −2,665 / −2,671 / −2,671. Prospector −4,43 gegen `landingOffset` −4,46.

**Einfederung.** Das Spiel kennt sie: `lengthTarget` zwischen `lengthMin` und `lengthMax`, Fragment Compress. Angewandt wird sie so:
- Ist compress lesbar: Halbierungssuche über die Spur, bis der Fuß auf der Aufstandshöhe steht (Prospector-Bugbein 0,938, Polaris 0,491).
- Sonst: starr je Bein, höchstens 0,6 m. Über alle Schiffe sind es 472 Beine, im Median 0,09 m, höchstens 0,57 m.

**Die fünf Proben:**

| Schiff | Fahrwerk | Rohexport | Aufstand (y) | Einfederung | Rumpf tiefster Punkt |
|---|---|---|---|---|---|
| aegs-gladius | 3 × `.cdf`, `Gladius.dba` (9 Blöcke: compress/extend/retract je Bein), Federn 2,48 / 2,55 | ausgefahren, ungefedert (Füße −2,88 / −2,76) | −2,671, eben | starr 0,21 / 0,09 / 0,09 m | −2,20 (0,47 m Bodenfreiheit) |
| misc-prospector | 3 × `.cdf`, `Prospector.dba` (6 Blöcke), Federn 5,05 / 5,06 | Hinterbeine aus, Bugbein ein (Fuß −2,34) | −4,432, eben | Bugbein extend + compress 0,938; hinten starr −0,05 m | −3,14 |
| anvl-carrack | 3 Beine, Federn 5,53 / 5,23, Flügelbeine mit `offset` z −11 | ausgefahren | −18,51, eben | starr 0,45 / 0,15 / 0,15 m | −17,56 |
| rsi-polaris | 3 × `.cga` (Spiel nennt für alle `rsi_polaris_landing_gear_Front.cga`, Export hat Front/Left/Right), einzelne `.caf` (`polaris_landing_gear_*_deploy/compress`) | eingefahren (Füße −11,45) | −18,172, eben | deploy + compress 0,491 | Triebwerksflossen bis −24,09 (`M_DET_Rear_Mesh_Thruster_Fin_Tip_Bot_*`, beweglich) |
| tmbl-cyclone | kein Landesystem (Bodenfahrzeug) | Räder | −1,127 (`landingpad_helper` −1,124) | — | — |

### Teil B: Aufstandspunkte für alle 231

`scripts/build-hangar-gear.mjs` (neu) schreibt ins Manifest `gear.<slug>` und `geo.<slug>` und legt `public/hangar/geo/<slug>.glb` ab: ohne Innenraum, dezimiert, Draco, im Raum von `public/holo/`. Ein abgebrochener Lauf verliert nichts, das Skript sichert nach jedem Schiff.

`gear.<slug>`:
- `pose` (`aus` / `ein` / `keins` / `offen`), `why`, `contacts`, `ground`, `tilt` [quer, längs] in Grad, `source`.
- `below` (die zehn tiefsten Teile mehr als 2 cm unter der Ebene, mit Namen und Tiefe) und `belowCount`.
- `game`: Landesystem, `landingOffset`, `landingRotationOffset`, je Bein Pose, Fuß, Federwerte und gegebenenfalls `mismatch`; dazu die starre Einfederung je Bein.

| pose | Schiffe | Bedeutung |
|---|---|---|
| `aus` | 162 | Fahrwerk ausgefahren und eingefedert; 21 davon per Animation des Spiels ausgefahren |
| `ein` | 19 | Höhe aus der Feder des Spiels, Beine der Geometrie-Fassung bleiben eingefahren (Gründe unten) |
| `keins` | 44 | 31 ohne Landesystem (Bodenfahrzeuge, Javelin …), 13 mit Landesystem ohne Fahrwerksgeometrie (Schweber X1, Nox, Pulse, Fury; Scythe, Scout); waagrecht auf den tiefsten Punkt |
| `offen` | 6 | kein Rohexport: Idris M/P, Ironclad, Ironclad Assault, Perseus (über der Speichergrenze), Constellation Mk V Centaurus |

**`ein` mit Grund:**

| Gruppe | Schiffe | Grund |
|---|---|---|
| Animation nicht weit genug lesbar | Eclipse, Hawk, Hull C, Reclaimer (+ Showdown), Stingray, 85X, Glaive, Mole, Moth, Railen, Tyilui | Positionen 0xC1; nach der Animation liegt der Fuß mehr als 0,6 m neben dem Aufstand |
| Animation führt woandershin | Prowler Utility, San'tok.yāi, Syulen | Fuß nach der Animation über dem Rumpf (bei Syulen ein Bein `hardpoint_lg_top`) |
| keine Animation | Nomad | — |
| Gravplatten, keine Beine | Dragonfly (+ Yellow) | — |
| Pfadfehler im Skript | 890 Jump | Pfad der Geometrie doppelt zusammengesetzt; ist zu beheben |

**`mismatch`.** Bei 23 ausgefahrenen Schiffen weicht mindestens ein Bein mehr als 0,6 m von der Feder ab. Solche Beine bleiben unverschoben, die Höhe kommt trotzdem aus der Feder, die Teile stehen in `below`.
- Ursache sind Gelenkteile in anderer Stellung als im Spiel, z. B. `foot_flap_a` der Sabre an Bug- und linkem Bein.
- Betroffen: Sabre ×4, Paladin, Star Runner, Caterpillar ×2, Corsair, Prowler, Starfarer ×2, Starlancer ×2, Guardian ×3, Constellation ×5, Stinger.

**Neigung über 1°** (aus den Federn des Spiels):
- Paladin 5,3° längs, Prowler −7,1°, Wolf/Alpha Wolf 10,6°, Stingray 8,4°, Hoverquad −12,4°, Basher 1,8°, Hull B 2,3°/0,9°.
- Syulen −86,9°: unbrauchbar, `ein`.

**Teile unter der Ebene:** 44 Schiffe, 37 davon tiefer als 0,5 m. Es sind bewegliche Teile, die im Export in Flugstellung stehen: Flossen, Flügelspitzen, Bügel, Scharniere. Die größten:
- Polaris (Flossen 5,9 m), Redeemer (`thruster_bar` 12,7 m), 300i/315p/325a/350r (`lg_hinge_front_left` 3,7 m), Paladin (Heckflossen 3,3 m);
- Guardian (Flügel unten 0,85 m), Railen/Tyilui/Syulen (`dbr_*`), Javelin.

Für das Tor heißt das: mindestens drei Aufstandspunkte oder ein benannter Grund geht; „kein Punkt mehr als 2 cm unter der Ebene“ hält bei diesen 44 nicht, ohne dass die beweglichen Teile in Landestellung gebracht werden.

**Geometrie-Fassung.** 225 Dateien, zusammen 84,7 MB (88 696 540 Byte), 17,5 Mio. Dreiecke, je Schiff rund 80 000. Die größte ist `aegs-javelin` mit 951 KB. `public/holo/` ist unverändert.

### Selbstauskunft

- 231 Schiffe mit `gear`: 162 mit Fahrwerk (`aus`), 19 `ein`, 44 ohne Fahrwerk (`keins`), 6 ohne Rohexport.
- 225 Schiffe neu gebaut (`geo`), 84,7 MB.
- Fehler im Lauf: zunächst 5 Abbrüche. Hornet F7C-R und CSV-Cargo: ein Knoten im Kreis, gltf-transforms Weltmatrix lief endlos. Salvation, Nova und Blade: Dezimierer-Zusicherung. Alle fünf sind behoben, der Abschlusslauf ging ohne Fehler durch.
- Rohbestand: aus dem Haupt-Checkout `.cache/hangar-src/ships/` (225 Schiffe, 54,6 GB), nicht neu geholt.
