# Hangar: Schiffswechsel über den Bodenaufzug (2026-10-14)

Auslöser für die PC-Sitzung: **„Hangar-Aufzug“**. Anlass: Krisz 2026-10-14
17:05: „wir brauchen mehr assets, vllt mehr animationen wenn wir zb einen
neuen schiff auswählen, so wie ingame? licht effekte dazu, sowas? also das
schiff wechsel erlebnis verbessern“.

## Befund (Cloud)

- Die Halle (`hangar_revelyork_single.socpak`) stammt aus dem alten
  Hangarmodul (abgeschaltet mit 3.13.1a, mit 3.23 durch die persönlichen
  Hangars ersetzt). Dort standen die Schiffe fest; einen Weg hinein gab es
  nicht. Am Export bestätigt: Unter dem Boden liegt nichts (die
  Bodenplatte reicht von y 0 bis 1, darunter nur ein Rest am Nordtor), an
  der Decke über dem Schiff sitzt das Glasdach, kein Tor.
- Das heutige Spiel bringt Schiffe in den persönlichen Hangars über einen
  großen Aufzug im Boden herauf und senkt sie beim Einlagern dort ab
  (TechRaptor zu 3.23: „physically lifted into the hangar via a massive
  lift on the floor“).
- Das Schiffsfeld der Halle ist ein eigenes Bodenmodul: Im Modellraum
  x 16…48, z −120…−24 (32 × 96 m, Mitte 32 / −72) mit den 3 × 10
  gepunkteten Platten (`metal_dotty_01_016`, x 24,25…39,75,
  z −111,75…−32,25). An genau diesen vier Linien schneidet **kein**
  Bodendreieck (gezählt an `revelyork-single-lod1.glb`, Boden y −0,3…1,2;
  daneben 0,25 m weiter 145 bis 2 238 Dreiecke). Innen liegen
  40 650 `metal_grey_04`, 30 282 `metal_white_03`, 4 656
  `plastic_white01_06`, 2 376 `metal_mid_01`, 770 `metal_dotty_01_016`,
  264 `glow_multi_36_015`, 96 `lights01_08`.
- Der Viewer stellt das Schiff heute auf die Raummitte (36 / −68), also
  4 m neben und 4 m vor die Mitte des Schiffsfelds.
- Bei 32 × 96 m passen 197 von 231 Schiffen beim heutigen Hallenmaßstab
  aufs Feld; die übrigen 28 (Spirit, Vanguard, Starlifter, Reclaimer …)
  brauchen bis zu 1,34-mal mehr Maßstab.

## Weg (Cloud, Standard ohne Gegenansage)

Der Wechsel wird der Aufzug des heutigen Spiels, gebaut aus diesem
Bodenmodul: Das Schiff steht auf der Mitte des Felds; beim Wechsel fährt
das Feld mit dem alten Schiff ab, das neue lädt derweil, dann kommt es auf
dem Feld herauf. Die Teile, die die Halle nicht hat (Schacht, Kante,
Warnlichter) und die Abläufe kommen aus dem Aufzug der heutigen Hangars.
Die Cloud schneidet das Feld zur Laufzeit aus (kein Neubau der Halle
nötig) und baut den ersten Schritt ohne PC-Teile; die Spielteile folgen
mit diesem Auftrag.

## Stand Cloud (14.10.2026, erster Schritt ohne PC-Teile)

- `HALL_LIFT` in `assets/hangar-viewer.js` nennt das Feld (x 16…48,
  z −120…−24, Boden y −0,3…1,2). `cutHallLift` nimmt beim Laden jedes
  Dreieck, das ganz darin liegt, aus der Halle in eine eigene Gruppe
  (82 939 Dreiecke in 8 Teilen, die Ecken bleiben geteilt); die Halle
  steht mit der Feldmitte im Ursprung, das Schiff auf der Feldmitte.
- Wechsel: Das Feld fährt mit dem alten Schiff in 1,9 s ab
  (`LIFT_DOWN_MS`), 26 m plus Schiffshöhe tief (`LIFT_DEPTH`), das neue
  lädt derweil; unten wird getauscht, dann fährt es in 2,8 s herauf
  (`LIFT_UP_MS`), sanft an- und abbremsend. Im Schacht wird es mit der
  Tiefe dunkel (`LIFT_DARK`, im Hallenshader und an Schiff und Crew);
  Leuchtstreifen und Schiffslichter bleiben hell. Wer von der Crew auf
  dem Feld steht, fährt mit; gegangen wird nur, solange der Aufzug oben
  ist. Die Hardpoint-Marker fehlen, solange das Schiff im Schacht ist.
- Ohne Bewegung (prefers-reduced-motion) bleibt der alte Wechsel.
- Tor: `verify:hangar-hall` [10] prüft an jeder Hallenstufe, dass kein
  bleibendes Dreieck ins Feld reicht, dass das Feld mindestens `min`
  Dreiecke trägt, und an Möbel- und Telefon-Datei, dass nichts auf
  Bodenhöhe im Feld liegt (die setzt der Viewer erst nach dem Schnitt
  ein). Zwei Kisten (furniture_23, furniture_31) ragen 0,1 bis 0,4 m über
  den Ostrand; ihr Bezugspunkt liegt daneben, sie stehen.
- Offen für die PC-Teile: Schachtwände statt Schwarz, Rand, Warnlichter
  mit ihrem Ablauf, die Fahrzeiten aus dem Spiel (ersetzen die Werte
  oben).

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.

### Teil A: Bericht (in diese Datei, Abschnitt „Befund PC“)

2. Halle `hangar_revelyork_single.socpak`: alle Entity-Klassen mit Anzahl.
   Dazu einzeln, mit Lage, Größe und Drehung im Modellraum unseres
   Exports:
   - alles, was Schiffe platziert (Spawn-, Lande-, Fahrzeugpunkte, Pads);
     steht ein Punkt auf 32 / −72 oder woanders?
   - alles Bewegliche (Türen, Lifte, Tore, `.cga`/`.anm`, `.chr`/`.dba`,
     Mannequin, Door- oder Elevator-Entities);
   - Lichtgruppen und Lichtzustände (an, aus, Notlicht …) und Lampen mit
     Animation (Blinken, Pulsieren, Drehen, LightStyle).
   - aus welchem Objekt (`.cgf`/Brush) das Bodenmodul x 16…48,
     z −120…−24 stammt.
3. Persönliche Hangars des heutigen Spiels: den Schiffsaufzug finden
   (socpaks und Entities, Suchbegriffe etwa elevator, lift, platform,
   `hangar_*`). Für die Größe, deren Aufzugsfläche 32 × 96 m am nächsten
   kommt, sonst für die größte:
   - Plattform, Schachtwände, Rand (Schienen, Warnmarkierung,
     Abdeckungen) mit Datei, Maßen und Materialien;
   - Warnlichter und Leuchten am Aufzug: Entity, Lage relativ zur
     Aufzugsmitte, Farbe, Stärke, Radius, Kegel, Dreh- oder
     Blinkgeschwindigkeit;
   - der Ablauf: Fahrweg, Geschwindigkeit, Beschleunigung, Pausen,
     Vorwarnzeit, Öffnen und Schließen von Abdeckungen, Lichtwechsel in
     der Halle während der Fahrt. Quelle nennen (DataCore-Record,
     Animation, Transit- oder Elevator-Definition).

### Teil B: bauen

4. Die Aufzugsteile aus Punkt 3 (Schacht, Rand, Warnlichter; die
   Plattform nur, wenn sie anders aussieht als unser Bodenmodul) wie die
   Halle exportieren und packen (Draco, WebP ≤ 1024 px), Modellraum mit
   der Aufzugsmitte im Ursprung, Oberkante der Plattform auf y 0.
   Ablage `public/hangar/lift/<name>.glb`, alles zusammen ≤ 3 MB.
5. Daneben `public/hangar/lift/<name>.json`: `{ v: 1, size: [b, l],
   depth, lights: [ { pos, dir?, color, intensity, radius, angle?,
   anim: { kind, speed, … } } ], motion: { … wörtlich aus Punkt 3 },
   source }`. Im Manifest `src/data/hangar-assets.json` ein Eintrag
   `lift: { "<name>": { url, json, bytes, v } }`.
6. Zehn weitere Schiffe im Werkslack, gleicher Weg wie die zehn
   vorhandenen (`--ships`): `drak-corsair`, `rsi-zeus-es`,
   `misc-prospector`, `aegs-sabre`, `crus-intrepid`, `drak-vulture`,
   `anvl-c8x-pisces-expedition`, `orig-400i`, `anvl-carrack`,
   `rsi-polaris`. Innenraum nur bei Jägern mit Glashaube (Sabre), wie bei
   `KEEP_INTERIOR`. Je Schiff wie bisher höchstens rund 14 MB; wird eins
   größer, Texturen auf 512 px und die Größe nennen.
7. Selbstauskunft: Entity-Klassen und Anzahl (Punkt 2), gefundene
   Aufzugsteile mit Dreiecken und Bytes, Zahl der Lichter, je Schiff
   Dreiecke, Texturen, Bytes; die übliche Kopfzeile.
8. Vor dem Push `npm run build && npm run gate`; auf den Branch, ohne PR.
   Den Merge nach staging macht die Cloud.

