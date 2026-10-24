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

- Viewer: Schiff auf seine Aufstandspunkte statt auf den tiefsten Punkt
  stellen, mit der Neigung aus `gear.tilt`; Aufzug, Wartungsplatz
  (`shipUnder`) und Kamera auf die neue Lage umstellen; Geometrie-Fassung
  aus `public/hangar/geo/` laden.
- Prüfung in `scripts/lib/gate-registry.mjs`: Jedes Schiff hat `gear`,
  kein Punkt der Webdatei liegt mehr als 2 cm unter der Aufstandsebene,
  mindestens drei Aufstandspunkte oder ein benannter Grund; einmal
  vorgeführt rot.

## Befund PC

(leer)
