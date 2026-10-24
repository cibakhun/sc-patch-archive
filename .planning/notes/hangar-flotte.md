# Hangar: die ganze Flotte aus dem Spiel, auf ihrem Fahrwerk (2026-10-24)

Auslöser für die PC-Sitzung: **„Hangar-Flotte“**. Derselbe Satz noch einmal
setzt den Lauf fort, wo er stand (alles hier ist wiederaufnehmbar).

Anlass, Krisz 2026-10-24 13:23: „hol mal alle texturen, geometrien,
interior, materialien, alles was du holen kannst damit wir alle schiffe so
realistisch wie möglich nachstellen könnnen.“ Und 13:24: „mach dann so dass
alle schiffe korrekt auf dem boden stehen mit deren landinggear. also wie
intended.“

Es gelten die Regeln aus [`hangar-katalog.md`](hangar-katalog.md): alles aus
dem Spiel, keine Roh-Exporte, kein `.mtl`-XML und keine Rohtexturen im Repo
(das Repo ist öffentlich). Rohdaten bleiben im gitignorierten Cache.

## Befund Cloud

- Die Schiffsauswahl des Hangars bietet 231 Fahrzeuge (200 Raumschiffe,
  31 Bodenfahrzeuge, Liste wie `HANGAR_IDS`). 10 davon haben Werkslack aus
  dem Spiel (`public/hangar/ships/`, 5,2 bis 13,5 MB, im Mittel 10 MB, je
  93 bis 218 Texturen, Budget 200 000 Dreiecke, Farbe 1024 px, Normalen
  512 px). Die übrigen 221 zeigen die Geometrie-Fassung aus `public/holo/`
  (ohne Texturen, Shader-Lack, 81 MB zusammen), die auch das Hologramm im
  Datenblatt ist.
- Die zweiten zehn aus `SHIPS` in `scripts/extract-hangar-sources.mjs`
  (Corsair, Zeus ES, Prospector, Sabre, Intrepid, Vulture, Pisces
  Expedition, 400i, Carrack, Polaris) wurden nie gebaut: Der Lauf
  „Hangar-Aufzug“ endete vorher.
- Zurückgehalten (`HOLD` in `HangarApp.astro`): Freelancer (Rumpf schwarz
  glänzend, die Lackschichten fehlen), Constellation (fast schwarzbraun).
  Beides sind Schichten, die der Export nicht auflöst; die Props haben
  seit „Hangar-Werte“ alle Schichten, die Schiffe noch nicht.
- Innenraum steckt nur bei Jägern mit Glashaube im Webmodell
  (`KEEP_INTERIOR`). Bei allen anderen schaut man durch Cockpit- und
  Brückenfenster ins Leere.
- **Fahrwerk:** Der Viewer stellt jedes Schiff mit dem tiefsten Punkt seines
  Hüllquaders auf den Boden (`robustBox`, `wrap.position.set(-center.x,
  -box.min.y, -center.z)` in `assets/hangar-viewer.js`). Über das Fahrwerk
  weiß er nichts. Ob es ausgefahren ist, hängt davon ab, in welcher Lage das
  Modell exportiert wurde: Die Gladius steht in den Renders auf ihren
  Beinen, die Geometrie-Fassung der Prospector zeigt keins. Schiffe mit
  eingefahrenem Fahrwerk liegen auf dem Rumpf oder auf dem, was am tiefsten
  hängt; eine Schräglage auf ungleich langen Beinen kennt der Viewer nicht.
- Das Repo ist rund 1 GB groß (`.git`). Jeder Neubau einer Webdatei bleibt
  in der Geschichte und steckt im Auslieferungs-Image.

## Schätzung (Cloud, ungeprüft; Teil A misst sie)

| | Menge | Annahme |
|---|---|---|
| Rohdaten im Cache (LOD 0, mip 1, mit Innenraum und Texturen) | grob 150 bis 300 GB | unter 15 m 0,3 GB, 15–30 m 0,6, 30–60 m 1,2, 60–120 m 2,5, über 120 m 5 GB je Schiff (59 / 91 / 42 / 28 / 11 Fahrzeuge); weniger, wenn Texturen geteilt abgelegt werden |
| Rechenzeit Rohexport | grob 8 bis 30 Stunden | 2 bis 10 min je Schiff |
| Webmodelle mit Werkslack, alle 231 | rund 2,3 GB | 10 MB je Schiff wie heute |
| Webmodelle Etappe 1 und 2 (20 Schiffe) | rund 200 MB | passt ins Repo |
| Geometrie-Fassungen mit Fahrwerk, alle 231 | rund 80 MB | wie `public/holo/` |

Folgerung: Alle Rohdaten holen geht, wenn der Platz da ist. Alle 231
Webmodelle ins Repo zu legen geht nicht gut (rund 3,3 GB Repo, jede neue
Fassung kommt dazu). Die Webmodelle kommen darum in Etappen; über die
Ablage ab Etappe 3 entscheidet Krisz, wenn die gemessenen Zahlen da sind.

## Weg (Standard ohne Gegenansage)

1. Erst messen (Teil A), dann alles holen (Teil B).
2. Das Fahrwerk sofort für alle 231 nutzen (Teil C): Die Geometrie-Fassung
   wird neu gebaut, mit ausgefahrenem Fahrwerk und den Aufstandspunkten.
   Dann stehen alle Schiffe richtig, bevor ihr Lack fertig ist.
3. Werkslack in Etappen (Teil D): zuerst die 10 vorhandenen mit Fahrwerk und
   allen Schichten, dann die zweiten zehn. Danach Halt und Bericht.

Reihenfolge der Schiffe überall: die 10 mit Werkslack, die zweiten zehn
aus `SHIPS`, dann die übrigen nach Länge von klein nach groß,
Bodenfahrzeuge zuletzt. Varianten mit gleicher Geometrie (Gladius, Gladius
Valiant, Gladius PIR …) nur einmal ablegen, wenn der Export Byte für Byte
gleich ist; sonst einzeln.

## Auftrag PC

0. `git pull` auf `claude/wot-hangar-hzs46w`. Vor jedem Push
   `npm run build && npm run gate`; auf den Branch, ohne PR. Den Merge nach
   staging macht die Cloud. Nach jeder Etappe pushen (nur Bericht und
   gebaute Dateien, nie Rohdaten), damit ein abgebrochener Lauf nichts
   verliert.

### Teil A: Probe und Plan (Bericht in „Befund PC“)

1. Fünf Proben mit Innenraum, LOD 0, `--materials textures`, mip 1:
   `aegs-gladius`, `misc-freelancer`, `anvl-carrack`, `rsi-polaris`, ein
   Bodenfahrzeug (`tmbl-cyclone`). Je Probe:
   Bytes roh (Geometrie und Texturen getrennt), Dreiecke außen und innen,
   Zahl der Texturen, Sekunden. Wie viele Texturbytes wären doppelt, wenn
   man alle fünf zusammen ablegt (gleicher Pfad in der Data.p4k)?
2. Hochrechnung auf alle 231 nach Länge (Tabelle oben ersetzen) und freier
   Platz auf dem Laufwerk des Caches. Liegt die Hochrechnung über dem
   freien Platz minus 50 GB Reserve: Cache auf ein anderes Laufwerk legen
   (Variable für den Pfad statt `.cache/hangar-src/` im Skript) oder hier
   anhalten und im Befund sagen, wie viel fehlt.
3. Fahrwerk an den Proben verstehen, mit Quelle:
   - Wie das Spiel es beschreibt: welcher Datensatz oder welche Datei die
     Beine nennt (Suchbegriffe: LandingSystem, landing_gear, Gear,
     Mannequin-Fragmente Deploy/Retract, `.cga`/`.anm`/`.caf`/`.dba`,
     ADB), welche Knoten und Knochen dazugehören, welche Animation sie
     ausfährt und wie lang sie ist.
   - In welcher Lage der Export heute steht (ein- oder ausgefahren), je
     Probe.
   - Ob StarBreaker eine Animation oder Pose beim Export setzen kann. Wenn
     nicht: Beine als eigene Knoten exportieren und das letzte Bild der
     Ausfahr-Animation anwenden. `scripts/lib/ivo-caf.mjs` liest IVO-`.caf`
     schon (Lift und Schachttor nutzen es); für `.dba` erweitern.
   - Ob das Spiel eine Einfederung im gelandeten Zustand kennt (Wert und
     Quelle); wenn ja, anwenden.
4. Ohne Gegenansage gleich mit Teil B weiter.

### Teil B: alles holen (Cache, nie ins Repo)

5. Alle 231 in der Reihenfolge oben: Geometrie in LOD 0 mit Innenraum,
   Texturen in mip 1, Fahrwerk ausgefahren (Teil A), Anbauteile wie heute.
   Außen und Innen getrennt halten (zwei Exporte oder eine Trennung, die
   der Build lesen kann).
6. Materialien mit allen Schichten wie bei den Requisiten seit
   „Hangar-Werte“ (Grund- und Abnutzungsschichten, Blend-, Abnutzungs- und
   Detailkarten, Palettenkanäle A/B/C, Glas, Leuchtflächen, Decals) als
   JSON je Schiff im Cache, mit den Karten.
7. Lackierungen: Die Lacke stehen mit ihren Palettenfarben schon in
   `src/data/ship-paints.json`. Wo ein Lack ein eigenes Material bringt
   (Muster), dessen Material und Karten mit in den Cache.
8. Fortschritt in `.cache/hangar-src/ships/_stand.json` (je Schiff: fertig,
   Bytes, Sekunden, Fehler). Fertige Schiffe werden beim nächsten Lauf
   übersprungen. Ändert sich die Data.p4k während des Laufs (Größe oder
   Zeitstempel, also ein Spielupdate), anhalten und im Befund melden.
9. Alle 40 Schiffe eine Zeile in „Befund PC“ (wie viele fertig, Bytes,
   Fehler) und pushen.

### Teil C: alle Schiffe auf ihr Fahrwerk

10. Je Schiff aus dem ausgefahrenen Fahrwerk die Aufstandspunkte: den
    tiefsten Punkt jedes Rads, Fußes oder Kufenstücks, im Modellraum der
    Webdatei (glTF, Y oben, Meter). Dazu die Ebene durch diese Punkte
    (Neigung um Längs- und Querachse in Grad) und ihre Höhe unter dem
    Ursprung.
11. Ins Manifest `src/data/hangar-assets.json` je Schiff ein Eintrag
    `gear: { pose: "aus", contacts: [[x, y, z] …], ground, tilt: [quer,
    längs], source, gameVersion }`. Schiffe, die im Spiel ohne Fahrwerk
    aufsetzen (auf Kufen am Rumpf, schwebend, auf Rädern bei
    Bodenfahrzeugen), bekommen `gear: { pose: "keins", why }` und ihre
    tiefsten Punkte als `contacts`.
12. Die Geometrie-Fassung für den Hangar aus dem neuen Rohexport neu bauen,
    mit ausgefahrenem Fahrwerk, ohne Innenraum, im selben Koordinatenraum
    wie heute (die Hardpoints müssen wie bisher auf 1 mm sitzen), als
    eigene Ablage `public/hangar/geo/<slug>.glb` mit Manifest-Eintrag.
    `public/holo/` (Hologramm im Datenblatt) bleibt unverändert. Zusammen
    höchstens rund 90 MB; sonst Dreiecke senken und die Größe nennen.

### Teil D: Werkslack in Etappen

13. Etappe 1: die 10 vorhandenen Schiffe neu bauen, mit Fahrwerk (Teil C),
    allen Schichten der Materialien (Teil B, Punkt 6, als Tafel im Asset
    wie beim Wartungsplatz) und dem Innenraum, den man durch Glas sieht
    (Cockpit, Brücke, Kanzel). Der Rest des Innenraums bleibt im Cache.
    Budget wie heute (200 000 Dreiecke, Farbe 1024 px, Normalen 512 px,
    rund 14 MB je Schiff höchstens); der Innenraum hinter Glas geht davon
    ab, nicht obendrauf. Krisz' Grenze für die Grafiklast gilt: kein
    Schiff schwerer als heute.
14. Etappe 2: die zweiten zehn aus `SHIPS`, gleicher Weg.
15. Halt. Im Befund: Bytes, Dreiecke und Texturen je Schiff, Summe für alle
    231 hochgerechnet, und wie viel davon geteilte Texturen wären. Damit
    entscheidet Krisz die Ablage ab Etappe 3.

### Teil E: offene Fragen der Schichten (aus „Hangar-Schichten“)

16. [`hangar-schichten.md`](hangar-schichten.md) S1 bis S4 im selben Lauf
    beantworten. Die Antworten zu Schmutz und Richtung der Abnutzung gelten
    für die Schiffsmaterialien genauso.

### Selbstauskunft

17. Die übliche Kopfzeile; Zahl der Schiffe je Teil (geholt, mit
    Fahrwerk, ohne Fahrwerk mit Grund, gebaut), Bytes roh und gebaut,
    Fehler mit Schiff und Meldung.

## Cloud danach

- Viewer: Schiff auf seine Aufstandspunkte statt auf den tiefsten Punkt
  stellen, mit der Neigung aus `gear.tilt`; Aufzug, Wartungsplatz
  (`shipUnder`) und Kamera auf die neue Lage umstellen; Geometrie-Fassung
  aus `public/hangar/geo/` laden.
- Prüfung in `scripts/lib/gate-registry.mjs`: Jedes Schiff hat `gear`,
  kein Punkt der Webdatei liegt mehr als 2 cm unter der Aufstandsebene,
  mindestens drei Aufstandspunkte oder ein benannter Grund; einmal
  vorgeführt rot.
- Schichten-Shader der Requisiten auf die Schiffe übertragen; danach
  Freelancer und Constellation aus `HOLD` prüfen.

## Befund PC

(leer)
