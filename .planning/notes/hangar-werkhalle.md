# Hangar-Werkhalle: Werkstatthalle für Bodenfahrzeuge hinter der Westnische

Stand 2026-10-24. Krisz verwirft die Fahrzeugwerkstatt in der Westnische
(PR #197) als Deko: Die Westnische wird ein Durchgang zu einer eigenen
Werkstatthalle. Wählt man ein Bodenfahrzeug, fährt die Kamera durch den
Durchgang in diese Halle, das Fahrzeug fährt dort von unten herauf, die
Lichter gehen von hinten nach vorn nacheinander an, zuletzt das mittlere
Spotlicht, genau wenn Kamera und Fahrzeug ankommen. Dort gibt es dieselbe
Loadout-Werkstatt wie bei Schiffen.

Der PC liefert die Halle aus dem Spiel (Geometrie mit Texturen, Lampen,
Maße); Einbau, Kamerafahrt, Licht-Abfolge, Aufzug und Prüfung macht die Cloud.

## Was schon feststeht (Cloud, am ausgelieferten Hallenmodell gemessen)

- Westnische im Modellraum von `revelyork-single`: Boden y 1,0, Rückwand
  eine Fläche bei x −15,0 (y 0,96 bis 12,1, z −87,8 bis −56,2), Decke
  meist bei y 9,6 (8,6 m über dem Boden), hinten ein höherer Streifen bis
  12,1. Hinter x −15,5 liegt im Modell nichts: Die Werkhalle kann frei
  dahinter stehen (x < −15, Mitte der Nische z −72).
- Die Cloud schneidet die Öffnung in die Rückwand (Shader), setzt die Halle
  dahinter und verbindet beide. Die Halle darf dafür gedreht und verschoben
  werden; ihr Tor muss nur zur Nische zeigen können.
- Im Spiel gibt es den Bausatz `Objects/buildingsets/human/hightech/delta/int/garage/`
  (daraus kam `prop_tor_high_tech_garage_door_s`, aus dem Container eines
  Teileladens in Orison). Das ist der erste Kandidat für einen ganzen Raum.
- Eine Hebebühne für Fahrzeuge gibt es laut PC-Befund vom 23.10. nicht
  (hangar-fahrzeuge.md, F3).

## Auftrag PC

- **W1 Halle.** Einen geschlossenen Innenraum aus dem Spiel finden, der als
  Werkstatt- oder Garagenhalle für Bodenfahrzeuge taugt, und ihn wie die
  große Halle exportieren (Geometrie mit Texturen, Materialien
  aufgeräumt wie bei `revelyork-single`, Lampenliste v 2 wie
  `revelyork-single.lights.json`).
  - Grundfläche etwa 24 bis 40 m mal 24 bis 40 m, lichte Höhe 8 bis 14 m,
    ebener Boden, Industrie-Anmutung (Garage, Werkstatt, Fahrzeugbucht):
    Deckenleuchten in Reihen, Wandpaneele, gern Gerät und Leitungen.
  - Auf einer Seite ein großes Tor oder eine Öffnung, mindestens 6 m breit
    und 4,5 m hoch (die Kamera fliegt hindurch; mehr ist besser).
  - In der Mitte freier Boden für die Fahrzeugbühne, möglichst 12 × 22 m
    (das längste Bodenfahrzeug, die Nova, ist 20 m lang). Ist es weniger,
    hier sagen wie viel.
  - Suchen in Containern und Bausätzen mit garage, vehicle, veh, asop,
    workshop, repair, maintenance, depot, motorpool im Namen: zuerst die
    Hightech-Garage (delta, siehe oben), dann Außenposten-Garagen,
    Garagen der Verteilzentren, Stadtgaragen (Lorville, Area18, New Babbage,
    Orison), Fahrzeugbuchten in Stationen. Die 5 bis 10 besten Kandidaten
    mit Maßen, Torgröße, Dreiecken und Lampenzahl unten auflisten, den
    besten exportieren.
  - Budget: höchstens 600 000 Dreiecke, 80 Materialien, 12 MB GLB. Lose
    Einrichtung im Raum darf bleiben, wenn sie ins Budget passt.
  - Jede Deckenleuchte (Leuchtkörper mit leuchtendem Material) bleibt ein
    eigener, benannter Knoten (nicht mit anderen zusammengelegt), damit der
    Viewer sie einzeln einschalten kann. In der Lampenliste je Lampe, wenn
    bekannt, der Name des Leuchtkörpers.
- **W2 Maße** in `<schlüssel>.json` neben der GLB: Bodenhöhe, Innenraum
  (x/z min/max), Deckenhöhe, Tor (Mitte, Breite, Höhe, Richtung nach
  draußen), die Deckenleuchten (Knoten, Lage, zugehörige Lampen), der freie
  Boden in der Mitte (Rechteck). Achsen wie bei der großen Halle (y oben,
  Meter).
- **W3 Tor.** Hat die Halle ein Tor: seine Blätter als eigene Knoten, dazu
  die Bewegung im Spiel (rollt hoch, fährt nach oben, teilt sich), damit der
  Viewer es öffnen und schließen kann. Gibt es das Blatt nur als animierte
  Entity: geschlossen exportieren und die Bewegung hier beschreiben.
- **W4 Fahrzeugbühne.** Falls es im Spiel eine Plattform gibt, auf der ein
  Fahrzeug steht oder fährt (Fahrzeugaufzug, Drehteller eines
  Ausstellungsraums, Fahrzeug-Pad der Garagen, 10 bis 22 m, rund oder
  eckig, mit Rand): als eigenes Teil mitliefern. Sonst hier festhalten, dass
  nicht; dann baut die Cloud sie aus dem Bodenmaterial der Halle.
- Dateien: `public/hangar/werkhalle/<schlüssel>.glb`, `<schlüssel>.lights.json`,
  `<schlüssel>.json`, Eintrag im Manifest `src/data/hangar-assets.json`
  (eigener Abschnitt `werkhalle`), gebaut über `scripts/build-hangar-assets.mjs`
  (neue Art, wenn nötig). Rohdateien bleiben in `.cache/`.
- Bilder zur Sichtprüfung (von der Tür in den Raum, von hinten zur Tür, von
  oben, je ein JPG unter 400 KB) nach `.cache/werkhalle-bilder/` im
  Arbeitsverzeichnis des PCs, nicht ins Repo.
- Bestehende Dateien (große Halle, Katalog, Schiffe) bleiben unverändert.
  Branch `pc/hangar-werkhalle` von `origin/claude/project-thread-xl1tqa`,
  Push ohne PR. Vor dem Push `npm run build && npm run gate` grün, dazu
  einmal mit `STAGING=1`.

## Befund PC

(offen)
