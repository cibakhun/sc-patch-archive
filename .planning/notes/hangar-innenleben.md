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
