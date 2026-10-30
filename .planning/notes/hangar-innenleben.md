# Hangar: begehbare Innenräume (2026-10-29)

Auslöser für die PC-Sitzung: **„Hangar-Innenleben“**. Derselbe Satz noch
einmal setzt den Lauf fort, wo er stand. Nicht zu verwechseln mit
„Hangar-Innenraum“ (27.10., Materialnachtrag für weiße Cockpits, erledigt,
[`hangar-innenraum.md`](hangar-innenraum.md)).

Anlass, Krisz 2026-10-29 17:34: „railen sieht gutaus ausser das interior“,
20:23: „was zm fck ist mit interiors?“, und auf die Frage, ob die Kamera
auch hinein soll, 20:49: „ja ich will auch in die innenräume“. Schon am 24.
und 25.10. bat er um „alle texturen, geometrien, interior, materialien“.

Ziel: Jedes Schiff mit Innenraum im Spiel hat ihn im Hangar, und man kann
hinein: Cockpit, Gänge, Kabinen, Laderaum, aus der Nähe scharf genug. Der
Hangar bleibt dabei so flüssig wie heute, weil der Innenraum eine eigene
Datei ist, die der Viewer erst beim Einsteigen lädt.

Es gelten die Regeln aus [`hangar-katalog.md`](hangar-katalog.md): alles aus
dem Spiel, keine Roh-Exporte, kein `.mtl`-XML und keine Rohtexturen im Repo.
Licht und Stimmung darf die Cloud selbst bauen (Krisz 16.10.2026).

## Befund aus der Cloud

- 130 der 231 Web-Schiffe haben keinen Innenraum (`ships.<slug>.interiorDropped`
  > 0 in `src/data/hangar-assets.json`), darunter Railen, Freelancer (alle
  vier), Starlancer TAC und MAX, Carrack, Corsair, Constellation Andromeda,
  Cutlass Black, Hammerhead, Caterpillar. Grund: `dropInterior` in
  `scripts/build-hangar-assets.mjs` nimmt die Container `interior_*` heraus,
  wenn Rumpf und Innenraum roh mehr als das 1,5-fache des Dreiecksbudgets
  haben (Railen roh 1,67 Mio., Budget 400 000), und
  `HANGAR_SHIP_NO_INTERIOR` als erste Stufe gegen die 16 MB.
- 101 Schiffe tragen ihn im Rumpf-GLB mit (`interiorDropped` 0), mit dem
  Rumpf zusammen ausgedünnt, also für die Nähe zu grob. Die Knoten der
  Web-Fassung haben keine Namen; der Viewer kann diesen Innenraum heute
  nicht vom Rumpf trennen.
- Der Rohbestand `.cache/hangar-src/ships/` trägt alle Innenräume (bis auf
  Exporte über der 24-GB-Grenze, siehe [`schiffe-komplett.md`](schiffe-komplett.md)).
- Tor [17] heute: GLB 741,7 MB + Ablage 214,0 MB = 955,7 MB, Deckel 1600 MB.

## Auftrag PC

0. Branch `pc/hangar-innenleben` von `origin/claude/wot-hangar-hzs46w`
   (staging plus diese Notiz). Vor jedem Push `npm run build && npm run
   gate`, nach dem Datenlauf zusätzlich `npm run gate:data`; ohne PR, die
   Cloud merged. Ohne Gegenansage von Teil zu Teil weiter, bis alle Schiffe
   gebaut sind.

### Teil A: Innenraum-Dateien

1. Neue Art `interior` in `scripts/build-hangar-assets.mjs` (oder ein
   Schalter für `ships`), je Schiff, dessen Rohexport Container `interior_*`
   hat (auch die 101 mit grobem Innenraum im Rumpf):
   - **Quelle**: derselbe Rohexport wie der Rumpf, mit demselben
     Materialnachtrag (`ships/<slug>.matfix.json`, Schichten, Paletten,
     Lackkanäle) und denselben Regeln (`DROP_MAT`, POM-Decals,
     Schadensnetze: Materialname mit `damage`, aber nicht `nodamage`,
     `damageable`, `damaged`; siehe `isDamageMesh` im Viewer).
   - **Umkehrung von `dropInterior`**: Nur die Container `interior_*`
     bleiben, alles andere unter dem obersten Knoten fällt. Der oberste
     Knoten und die Szene behalten **genau die Transformation des Rumpfs**,
     damit die Datei im selben Modellraum liegt wie
     `public/hangar/ships/<slug>.glb`. Der Viewer hängt sie neben das Modell
     des Rumpfs, ohne eigene Verschiebung. Was der Rumpfbau an der Wurzel
     ändert (Achse, Mitte, Landestellung des Rumpfs), gilt hier ebenso.
   - **Lichter**: Lichtquellen der Innenraum-Container (falls der Export sie
     trägt, z. B. als `KHR_lights_punctual` oder Licht-Entities in
     `scene.json`) mit Lage, Farbe, Stärke und Reichweite in die Datei oder
     ins Manifest (`interior.<slug>.lights`). Wenn es keine gibt: so melden.
   - **Einstiegspunkte**: Lage der Sitze (Pilot zuerst), Türen, Rampen,
     Leitern und Aufzüge des Innenraums aus Helfer-Knoten oder Entities
     (Name enthält z. B. `seat`, `door`, `ramp`, `ladder`, `elevator`), im
     Modellraum ins Manifest (`interior.<slug>.spots = [{ kind, name, p }]`).
   - **Budget** für die Nähe: höchstens 500 000 Dreiecke (ab 60 m Länge
     1 000 000), Farbe und Leuchten 1024 px, übrige Karten 512 px,
     gemeinsame Bildablage `public/hangar/tex`. GLB plus neu in der Ablage
     höchstens 16 MB; darüber in dieser Folge: Karten 512 px, WebP-Qualität
     72, gröbere Dezimierung. Die Größe nennen.
   - **Ziel**: `public/hangar/interior/<slug>.glb`, im Manifest
     `interior.<slug> = { url, v, tris, trisRaw, containers, bytes, pool,
     lights?, spots }`.
2. Je Schiff prüfen, bevor es zählt: Der Hüllquader des Innenraums liegt im
   Hüllquader des Rumpfs (mit 0,5 m Rand). Sonst stimmt der Modellraum
   nicht; das Schiff mit Grund ins Protokoll statt in die Ablage.
3. Zuerst fünf Schiffe bauen und pushen, damit die Cloud das Einsteigen
   daran baut: Railen, Freelancer, Cutlass Black, Carrack, Constellation
   Andromeda. Dann alle übrigen.
4. Nach den ersten 25 Schiffen die Summe aus Rumpf, Innenraum und Ablage
   gegen den Deckel von Tor [17] melden und hochrechnen. Der Deckel reicht
   für alle nicht; weiterbauen. Die Cloud hebt ihn mit benanntem Anlass,
   keine Frage an Krisz. Push nach je etwa 25 Schiffen (unter 1 GB je Push).

### Teil B: Rumpf ohne doppelten Innenraum

5. Bei den 101 Schiffen mit Innenraum im Rumpf-GLB: die Knoten aus den
   Containern `interior_*` im Rumpfbau mit `extras.interior = true`
   kennzeichnen (sonst nichts ändern, gleiche Stufe, gleiche Landestellung).
   Der Viewer blendet sie aus, sobald die scharfe Datei geladen ist.

### Selbstauskunft am Ende

Die übliche Kopfzeile. Je Schiff: Container, Dreiecke roh → Web, Bytes GLB
und neu in der Ablage, Stufe, höchste Zahl Karten je Material, Lichter,
Einstiegspunkte. Summe aller Innenräume und Gesamtsumme gegen den Deckel von
Tor [17]. Was nicht aufging (zu groß, außerhalb der Hülle, ohne Rohexport),
mit Grund.

## Cloud danach

- Viewer „Einsteigen“: Knopf und Doppelklick aufs Schiff. Die Kamera fährt
  zu einem Einstiegspunkt hinein, der Innenraum lädt dabei. Drinnen:
  Ziehen schaut umher, rechte Maustaste oder WASD bewegt, Wände und Boden
  halten die Kamera auf Augenhöhe. „Aussteigen“ bringt sie zur Ansicht von
  vorher zurück. Licht drinnen aus den Lichtern des Spiels, sonst eigenes.
- HangarApp reicht `interior.<slug>` durch. Durch die Haube von außen sieht
  man den Innenraum, sobald er geladen ist.
- Tor: `verify:hangar` zählt Innenräume in [17] mit (Deckel mit Anlass
  gehoben) und prüft neu: jede Innenraum-Datei da, Hüllquader im Rumpf
  (Klinke, vorgeführt rot).
- Ansehen im echten Viewer, `check:hangar-shader` für die Innenräume mit
  den meisten Karten, Sichturteil an Krisz nach `.planning/WINDOWS.md`.

## Befund PC

PC-Lauf 29./30.10.2026, Branch `pc/hangar-innenleben`. Stand je Schiff in
`.cache/hangar-src/alle-innen.json`, Treiber
`node scripts/build-hangar-alle.mjs --kind interior [--only …] [--redo]`.

### Teil A, die ersten fünf

`scripts/build-hangar-assets.mjs` kennt die Art `interior` (nur mit
`--kind interior` gebaut). Quelle ist der Rohexport in `ships/`, dieselbe
Strecke wie der Rumpf (Fahrwerk und Landestellung, Materialnachtrag,
Schichten, Paletten mit `extras.palette`, `DROP_MAT`, Schadensnetze), nur die
Auswahl umgekehrt (`keepInteriorOnly`): Unter jedem obersten Knoten bleiben
die Container `interior_*`, Wurzel und Szene unverändert, also derselbe
Modellraum wie `public/hangar/ships/<slug>.glb`. Kein Lack-Bauplan, keine
Tauschteile. Die Bildablage räumt jetzt gegen `ships/` und `interior/` auf.

- **Lichter:** Der Rohexport trägt sie als `KHR_lights_punctual` in den
  Containern. Sie stehen im Manifest unter `interior.<slug>.lights`
  (`type, color, intensity, range, p`, Modellraum).
- **Einstiegspunkte:** Die Helfer des Schiffs hängen am Rumpf, nicht in
  den Containern (`hardpoint_seat_pilot`, `hardpoint_seat_access_*`,
  `hardpoint_door_*`, Aufzug). Gelesen werden sie deshalb über das ganze
  Modell vor dem Ausdünnen, als `spots = [{ kind: seat|access|door|ramp|
  ladder|elevator, name, p }]`, Pilot zuerst.
- **Außerhalb der Hülle:** Einzelteile der Container reichen weit über
  den Rumpf hinaus (Carrack eins 111 m zur Seite, Andromeda 14 Teile bis
  14,5 m). Was mehr als 0,5 m über den Hüllquader des Rohrumpfs ragt, fällt
  weg und wird gezählt (`outside`, `outsideTop`). Danach liegen alle fünf
  im Hüllquader der Web-Rumpfdatei (`inHull.ok`).

| Schiff | Container | Dreiecke roh → Web | MB | Stufe | Lichter | Punkte |
|---|---|---|---|---|---|---|
| Railen | 5 | 1 037 779 → 822 325 | 7,2 | 0 | 509 | 20 |
| Freelancer | 4 | 292 516 → 278 818 | 2,1 | 0 | 175 | 17 |
| Cutlass Black | 3 | 233 033 → 232 312 | 2,2 | 0 | 225 | 49 |
| Carrack | 4 | 3 641 440 → 1 082 801 | 14,3 | 2 | 2 181 | 26 |
| Andromeda | 10 | 523 066 → 506 346 | 3,6 | 0 | 371 | 21 |

Angesehen (eigener Viewer, Software-WebGL): Railen-Gang hinter dem Cockpit,
Cutlass-Laderaum und Carrack-Struktur, alle mit Spieltexturen. Summe auf
der Platte: Rumpf 741,7 MB + Innenraum 29,3 MB + Ablage 236,9 MB =
1008 MB. Die Ablage wächst um rund 23 MB, die Innenräume bringen eigene
Karten mit.

### Teil A, alle Schiffe (Stand 30.10.2026)

- **217 Innenraum-Dateien**, 418,9 MB GLB; Dreiecke roh 76,3 Mio. → Web 43,8 Mio.
  Alle liegen im Hüllquader ihres Rumpfs. 214 auf Stufe 0, Carrack und Carrack
  Expedition auf Stufe 2. Javelin: Stufe 4 (Karten 256 px, Schwelle bis 8 %)
  mit 24,4 MB, als einzige über 16 MB (roh 10 Mio. Dreiecke, 3016 Lichter).
- **Lichter** 51 149 (jedes Schiff hat welche), **Einstiegspunkte** 1932
  (jedes Schiff hat welche). Höchstens 5 Karten je Material.
- **Teile außerhalb der Hülle entfernt**: 209 bei 38 Schiffen.
- **Ohne Innenraum im Rohexport** (14): Idris M, Idris P, Reclaimer,
  Reclaimer Showdown, Ironclad, Ironclad Assault, 890 Jump, Polaris,
  Perseus, Constellation Mk V Centaurus (alle über der 24-GB-Grenze ohne
  Innenraum exportiert), ATLS, ATLS GEO und die zwei GEO-Collector (ein
  Anzug ohne Container). Für die zehn großen bräuchte es einen eigenen
  Export nur der Container.
- Kleine Jäger und Fahrzeuge bringen nur ihr Cockpit mit (Gladius 13 k,
  Hornet 6 k bis 39 k Dreiecke, 0,1 bis 0,4 MB).

### Teil B

Rumpfbau: Die Knoten der Container `interior_*` tragen `extras.interior =
true` und den Namen `interior_part_<n>` (sonst legt `join` sie mit dem Rumpf
zusammen; `cleanMaterials` leert Knoten-Extras, deshalb wird danach
gekennzeichnet). Neu gebaut die 87 Rümpfe, die ihren Innenraum tragen und
einen haben (gleiche Stufe 0). 67 tragen danach Innenraum-Knoten. Bei 20
bleibt nach dem Junk-Filter keiner übrig (Cyclone ×6, X1 ×3, Nox ×2,
Razor ×3, Dragonfly ×2, Glaive, Scythe, Xi'an Scout, PTV: offene Cockpits).

### Summe

Rumpf 744,1 MB + Innenraum 418,9 MB + Ablage 276,6 MB = **1439,6 MB**,
größte Datei 19,3 MB (Javelin). Tor [17] zählt heute Rumpf und Ablage
(1020,7 MB). build+gate grün, auch mit `STAGING=1`;
`check:hangar-shader` an Avenger Titan und Mustang Alpha (Rümpfe mit
Innenraum-Knoten) ✓.

## Cloud, 29.10.2026 nach dem ersten Push

- `pc/hangar-innenleben` (692d5d67) ist in `claude/wot-hangar-hzs46w`
  gemergt, zusammen mit staging. Darin liegt **#257** aus einem anderen
  Thread („Schiffe von innen nicht mehr hohl“): alle 231 Rümpfe neu gebaut,
  zweiseitig wie im Spiel, und `dropInterior` lässt jetzt den Innenraum
  stehen, den man durch Glas sieht (Glas plus 2,5 m; liefert
  `{ dropped, keptNodes, keptTris }`, Manifest `interiorKept`). Die
  Konflikte in `build-hangar-assets.mjs` und `build-hangar-alle.mjs` sind
  gelöst: `markInterior` läuft bei jedem Rumpf und kennzeichnet, was vom
  Innenraum darin bleibt (ganz oder hinter dem Glas); der Innenraum wird
  wie der Rumpf zweiseitig (`twoSided: true`); die Stufen `NG` bleiben,
  `INNER` ersetzt sie.
- **Vor dem nächsten Push** `origin/claude/wot-hangar-hzs46w` in
  `pc/hangar-innenleben` mergen und die Konfliktlösung übernehmen. Ein
  Rumpfbau vom alten Stand nähme #257 zurück (einseitig, kein Innenraum
  hinter dem Glas).
- **Teil B ist jetzt dringlich**: Die fünf Rümpfe tragen hinter dem Glas
  schon einen groben Innenraum (Carrack 739 Knoten, 607 000 Dreiecke;
  Andromeda 133 / 503 000; Cutlass 20 / 226 000; Freelancer 15 / 184 000;
  Railen 10 / 103 000). Ohne `extras.interior` kann der Viewer ihn beim
  Einsteigen nicht ausblenden, grob und scharf liegen dann übereinander.
  Also Teil B (Rümpfe mit `extras.interior`, vom gemergten Stand) vor den
  übrigen Innenraum-Dateien, zuerst die fünf.
- Prüfung in der Cloud nach dem Merge: alle 1 224 Bildverweise der fünf
  Innenräume und alle 53 520 der 231 Rümpfe liegen in `public/hangar/tex`.

## Cloud, 30.10.2026 nach dem Schlussbericht

- Der Schlussstand 3b210dd7 ist gemergt, die 217 Innenräume und das Manifest
  dazu. **Teil B ist nicht übernommen**: Die 87 Rümpfe sind vom Stand vor
  #257 gebaut (einseitig, ohne den Innenraum hinter dem Glas). Bei den 68,
  die auch #257 neu gebaut hat, gilt dessen Fassung; der Viewer erkennt den
  groben Innenraum dort nach Lage (Ecken auf Flächen des scharfen) und
  blendet ihn drinnen aus. `mrai-pulse` kam ohne Konflikt mit.
- Auch die Bildablage ist nicht geräumt: 319 Bilder, die der PC als
  verwaist entfernt hatte, nutzen die Rümpfe von #257; sie bleiben.
- **Nächster PC-Lauf** (derselbe Satz „Hangar-Innenleben“): zuerst
  `origin/claude/wot-hangar-hzs46w` in `pc/hangar-innenleben` mergen
  (Konflikte dort schon gelöst: `dropInterior` liefert das Objekt von #257,
  `markInterior` läuft nach `cleanMaterials` bei jedem Rumpf), dann Teil B
  noch einmal für alle Rümpfe mit Innenraum-Knoten, vom gemergten Stand.
  Prüfen mit `npm run verify:hangar-cockpit` (Tor von #257) und
  `verify:hangar` [17] und [20].
- Die zehn großen ohne Innenraum (Idris M/P, Reclaimer ×2, Ironclad ×2,
  890 Jump, Polaris, Perseus, Centaurus): eigener Export nur der Container,
  danach als Innenraum bauen wie die übrigen.
