# Hangar: Gerätekatalog mit Bedeutung (2026-10-18)

Auslöser für die PC-Sitzung: **„Hangar-Katalog“**.

Anlass, Krisz 2026-10-18 (über den Projekt-Chat):

- 10:16: „das rohr ist durchsichtig, die assets sind allgemein zu wenige,
  und sind nicht belivable plaziert“
- 10:26 (Draufsicht einer Fury MX): „hier nochmal wegen believable“
- 10:32: „ich möchte dann ausserdem dass du viel mehr assets holst und die
  semantik von denen auhc mit speicherst, also was macht man damit, wofür
  ist es da etc so dass wir die assets nacher besser nutzen können und
  nicht nur random“

Lesart, ihm so gesagt und nicht korrigiert:
- Es sollen deutlich mehr Werkstatt-Requisiten aus dem Spiel kommen.
- Zu jedem Requisit gehört seine Bedeutung: was es ist, wofür man es
  braucht, wie man es benutzt, wo es im Spiel steht und womit es
  zusammengehört.
- Die Cloud stellt danach nach Bedeutung auf statt nach Zufall:
  - Schläuche und Kabel laufen vom Generator oder Tank zum Schiff.
  - Werkzeug und Wagen stehen gruppiert an Arbeitsplätzen.
  - Wandgerät hängt in Gruppen.
- Die Crew ist ihm vorerst egal.

Es gelten die Regeln aus [`hangar-werkstatt.md`](hangar-werkstatt.md):
- Regel 10-07: Geometrie und Texturen aus dem Spiel.
- Keine Bilder, keine Roh-Exporte und kein `.mtl`-XML committen; das Repo
  ist öffentlich.
- Ausgeliefert werden nur gebaute, verkleinerte Dateien.

`werkstatt.glb` und `werkstatt.json` bleiben unverändert, denn der Viewer
liest sie heute. Alles Neue kommt in neue Dateien.

## Was die Cloud heute hat und was fehlt

- 25 Requisiten aus `util_a hangar_medtop_002`, je mit Rolle, Maßen und
  Häufigkeit. Die Anordnung dieser einen Halle wird auf unser Feld
  gestaucht.
- Es fehlen:
  - die Bedeutung (Zweck, Benutzung, Zusammengehörigkeit);
  - Anschlusspunkte (wo ein Schlauch oder Kabel ansetzt);
  - die Regeln, nach denen das Spiel Gerät zu Arbeitsplätzen gruppiert.
- Darum wirkt es verstreut: Ein Schlauch liegt allein an der Wand,
  Kisten stehen weit vom Schiff.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.

### K1. Mehr Requisiten finden

2. Alle Requisiten in den 87 schon ausgepackten Hangar-socpaks (`util_a`,
   VFG Industrial, Self-Land, Asteroidenbasis), dazu Werkstattgerät aus
   dem Archiv, das in Hangars fehlt. Beispiele dafür: `workbench_mobile`,
   `crane_welding_arm`, `trolley_creeper`, `generator_oxygen`, Werkzeugkisten
   und -schränke, Leitern, Absperrungen, Feuerlöscher, Wartungsterminals,
   Lampen auf Ständern, Pumpen, Kanister.
3. Im Katalog stehen alle Fundstücke, die etwas mit Wartung, Energie,
   Treibstoff, Luft, Werkzeug, Diagnose, Transport, Lager, Heben, Reinigung
   oder Sicherheit zu tun haben.
4. Exportiert werden mindestens 60 Requisiten. Den Vorrang haben:
   - alles, was in Hangars mindestens dreimal steht;
   - die Fundstücke aus Punkt 2;
   - Kabel- und Schlauchstücke in allen Längen und Biegungen, die es gibt
     (gerade, Bogen, Ende mit Stecker), damit sich Leitungen von einem
     Gerät zum Schiff zusammensetzen lassen.

### K2. Bedeutung je Requisit, so weit wie möglich aus den Spieldaten

5. Zu jedem Requisit, in dieser Reihenfolge der Quellen:
   - **Spielname und Beschreibung** aus der Lokalisierung (Schlüssel der
     Entity oder des Items, Englisch wörtlich; Deutsch, wenn vorhanden).
   - **Klasse, Typ, Untertyp, Tags** aus den Datensätzen der Entity, dazu
     Benutzungspunkte (Interaction Points, „use“, „pickup“, tragbar ja/nein).
   - **Anschlusspunkte** aus Helfern, Sockets und Knochen des Modells
     (Stecker, Ports, Schlauch- und Kabelenden): Name, Lage und Richtung im
     Requisitenraum, Art (Strom, Treibstoff, Luft, Daten, Wasser), soweit
     der Name sie verrät.
   - **Aufstellung im Spiel**, gezählt über alle Hangars:
     - Boden, Wand, Regal, Tisch oder Decke, mit Höhe;
     - Abstand zum Feldrand und zur nächsten Wand (Median und Spanne);
     - Ausrichtung zum Feld (zugewandt, abgewandt, längs).
   - **Nachbarn:** welche Kategorien und Requisiten in 3 m Umkreis stehen,
     mit Anteil der Aufstellungen und mittlerem Abstand. Zum Beispiel:
     Kabeltrommel neben Generator in x %.
6. Erst danach, deutlich als abgeleitet markiert: **Zweck** und
   **Benutzung** in einem Satz. Zum Beispiel: „mobiler Generator, versorgt
   Gerät am Schiff mit Strom; steht am Feldrand, Kabel laufen zur
   Kabeltrommel und zum Schiff.“ Abgeleitet heißt: aus Name, Beschreibung,
   Tags und Aufstellung geschlossen. Was sich nicht schließen lässt, bleibt
   leer.

### K3. Arbeitsplätze und Leitungen aus den Spielhallen

7. **Arbeitsplätze:** In den 87 Hangars Gruppen finden, in denen Requisiten
   näher als 2,5 m zueinander stehen. Je Gruppe:
   - Mitglieder mit Lage und Drehung relativ zum Gruppenmittelpunkt;
   - Halle;
   - Abstand zum Feldrand, Boden oder Wand.
   Häufige Zusammensetzungen zusammenfassen, zum Beispiel „Generator +
   Kabeltrommel + Diagnose“ in n Hallen, mit einem Vertreter aus dem Spiel.
8. **Leitungen:** Wo Kabel- oder Schlauchstücke liegen: die Kette der
   Stücke (Reihenfolge, Lage, Drehung), ihre Länge, und welche Requisiten
   an ihren beiden Enden stehen (das Nächste in 1,5 m). So sieht die Cloud,
   wie das Spiel Leitungen verlegt.
9. **Schiffsseite:** Gibt es an Schiffen Anschlusspunkte fürs Tanken oder
   für Strom (Helfer, Ports, Items mit Namen wie fuel, refuel, intake,
   umbilical)? Name und Lage bei drei verbreiteten Schiffen (Gladius,
   Cutlass Black, Constellation). Gibt es keine, das klar sagen.

### K4. Dateien

10. **Requisiten**, je Kategorie eine Datei
    `public/hangar/props/<kategorie>.glb` (Draco, WebP; Farbe ≤ 1024 px,
    Normalen und Masken ≤ 512 px; je Datei ≤ 3 MB).
    - Je Requisit ein Knoten `prop_<kategorie>_<name>`, Ursprung unten
      mittig, +Y oben, Meter, Vorderseite des Spiels in der JSON.
    - LOD-Stufe so, dass ein Requisit ≤ 8 000 Dreiecke hat (große ≤ 20 000).
    - Materialien gleichen Namens in allen Dateien gleich benennen, damit
      der Viewer sie zusammenlegen kann.
    - Der Viewer lädt nur die Kategorien, aus denen er etwas aufstellt.
11. **Katalog** `public/hangar/props/katalog.json`, `v: 1`:

    ```
    { v: 1,
      kategorien: { "<kategorie>": { file, bytes, props: [<node>, …] } },
      props: [ { node, kategorie, file, path, klasse, name: { en, de }, beschreibung: { en, de },
                 typ, tags: [ … ], benutzung: [ … ], tragbar,
                 zweck, nutzung, quelle: { zweck: "spiel" | "abgeleitet", … },
                 size: [x, y, z], footprint: [x, z], front, tris, lod,
                 anschluesse: [ { name, at: [x, y, z], dir: [x, y, z], art } ],
                 aufstellung: { boden, wand, regal, tisch, decke, hoehe, abstandFeld: [median, min, max], abstandWand: [ … ], richtung },
                 nachbarn: [ { node | kategorie, anteil, abstand } ],
                 from: [ <socpak>, … ], count } ],
      arbeitsplaetze: [ { name, mitglieder: [ { node, at: [x, z, drehungY], y } ], hallen, abstandFeld, ort } ],
      leitungen: [ { stuecke: [ { node, at: [x, y, z, drehungY] } ], laenge, von, nach, halle } ],
      schiffe: [ { schiff, anschluesse: [ … ] } ] }
    ```

    Achsen wie in den GLBs (Y oben), Drehungen in Grad um Y. Die
    Beschreibungen bleiben im Wortlaut des Spiels, nur gekürzt, wo sie
    lang sind.
12. **Manifest** `src/data/hangar-assets.json`: unter `props` ein neuer
    Schlüssel `katalog: { url, v, bytes, props, kategorien }`.
13. **Selbstauskunft** im Build:
    - Requisiten je Kategorie mit Dreiecken und Bytes je Datei;
    - Einträge mit Spielname, mit Beschreibung, mit Anschlusspunkten;
    - Anzahl der Arbeitsplätze und Leitungen.
    Was es im Spiel nicht gibt, klar sagen.

## Abschluss PC

14. Vor dem Push `npm run build && npm run gate` (normal und `STAGING=1`).
    Auf den Branch, ohne PR. Einbau, Merge nach staging und Vorher/Nachher
    macht die Cloud.

## Cloud (läuft parallel)

- Zuerst Schlauch und Feldmitte nach staging.
- Mit dem Katalog:
  - Arbeitsplätze ums Schiff nach den Gruppen aus K3 stellen;
  - Leitungen vom Gerät zum Schiff aus Kabel- und Schlauchstücken legen;
  - Spuren und Gerät an die Schiffsgröße anpassen.
- Budget bleibt: Stufe hoch höchstens so viele Zeichenbefehle wie heute
  plus 40, mittel plus 20. Geladen wird nur, was steht.
- Vorher/Nachher von oben und aus Krisz' Blick.

## Befund PC

(leer)
