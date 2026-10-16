# Hangar: Werkstatt statt Ausstellungsraum (2026-10-16)

Auslöser für die PC-Sitzung: **„Hangar-Werkstatt“**. Der Lauf hat zwei
Teile: A (Werkstatt, neu, zuerst) und B (der liegengebliebene Auftrag
„Schacht-Tiefe“ aus [`hangar-schacht-tiefe.md`](hangar-schacht-tiefe.md)).
Wird die Zeit knapp, Teil A zuerst pushen.

Anlass: Krisz 2026-10-16 (über den Projekt-Chat): „okay das ganzer hangart
sieht iwi so steril aus, es wirkt nicht wie ein flugzeughnagar sozusagen,
es fehlt öl, cracks auf dem boden, beton, werkzeuge, schläuche, fuel,
diagnosegeräte etc etc etc“.

Lesart (ihm so gesagt, nicht korrigiert): Die Halle soll benutzt und
bearbeitet aussehen. Öl- und Treibstoffflecken und Risse auf dem Boden,
ein rauerer, betonartiger Boden, echtes Arbeitsgerät um das Schiff:
Werkzeugwagen, Schläuche, Tanks oder Pumpen, Diagnosestationen.

Regel 10-07 gilt: Geometrie und Texturen aus dem Spiel, nichts
Selbstgebautes, auch keine selbst gemalten Flecken. Die Anordnung soll,
wo es geht, aus einer Spielhalle übernommen werden statt erfunden. Keine
Bilder, keine Roh-Exporte, kein `.mtl`-XML committen (das Repo ist
öffentlich); alles Rohe bleibt in `.cache/`.

## Warum die Halle steril wirkt (Befund Cloud)

1. **Die Revel-&-York-Deluxe ist im Spiel ein Ausstellungsraum.** Alle
   Hallenmaterialien sind `Illum` ohne Schichten und ohne Abnutzungsmaske,
   die Bodenlacke sind spiegelglatt (Rauheit im Mittel 0,03), es gibt keine
   Decal-Entities (Befund PC vom 12.10. in
   [`hallen-relief.md`](hallen-relief.md)). Wir bilden das richtig ab; die
   Halle ist im Spiel genauso sauber.
2. **Die Abziehbilder der Halle sind Logos und Beschriftung.** Im Export
   stecken neun `%DECAL`-Materialien: Logos, Ziffern, Symbole,
   Landetor-Markierungen und eine Laufspur `leakings_019` (320 Dreiecke) an
   den Wänden. Auf dem Boden liegt nichts davon.
3. **Das Möbel (137 Stück) steht an den Wänden:** Kisten, Planen, Konsolen,
   Sitzgruppen. Um das Schiffsfeld (32 × 96 m) steht nichts, und nichts
   davon ist Werkstattgerät.

Ein benutzter Hangar muss also aus anderen Orten des Spiels kommen:
Abnutzung, Boden und Gerät aus Hallen und Werkstätten, die im Spiel
gearbeitet aussehen.

## Auftrag PC, Teil A: Werkstatt

1. `git pull` auf `claude/wot-hangar-hzs46w`.

### A1. Bericht (hier unter „Befund PC“, knappe Tabellen)

2. **Bodenabnutzung.** Im Spiel nach Boden-Decals suchen: Öl-, Treibstoff-
   und Kühlmittellachen, Laufspuren, Pfützen, Brandspuren von Triebwerken,
   Reifen- und Schleifspuren, Risse, ausgebesserter Beton, Schmutz,
   abgelaufene Bodenmarkierungen. Je Fund: Pfad, Art (Decal-Entity,
   `%DECAL`-Untermaterial, eigenes Mesh), Texturslots, Größe in m, POM ja
   oder nein, in welchen socpaks er vorkommt und wie oft.
3. **Bodenmaterialien.** Beton- und Industrieböden aus Spielhallen
   (Beton, gestrichener Beton mit Abnutzung, Stahlplatten mit Ölspuren,
   Gitterroste). Je Material: `.mtl`, Texturen mit Slot und Kachelung,
   Glätte, alle `<MatLayers>` mit Mischmaske, wo das Spiel es einsetzt.
4. **Werkstattgerät.** Requisiten suchen: Werkzeugwagen und -kisten,
   Werkbänke, Werkzeugwände, Schläuche und Schlauchtrommeln, Treibstofftanks,
   -pumpen und -wagen, Diagnosestationen und Terminals auf Ständern,
   Generatoren und Stromaggregate, Bodenkabel und Kabelbrücken, Wagenheber,
   Stützen, Hebezeuge und Kräne, Fässer und Kanister, Auffangwannen,
   Leitern und Arbeitsbühnen, Transportwagen, Munitions- und Raketenwagen.
   Je Requisit: Pfad (`.cgf`/`.cga` oder Entity-Klasse), Dreiecke je
   LOD-Stufe, Materialien, Maße in m, welche Hallen es nutzen und wie oft.
5. **Anordnung aus dem Spiel.** Die ein oder zwei Spielhallen nehmen, die
   am meisten nach Arbeit aussehen (am meisten Gerät aus Punkt 4 nah am
   Landefeld; Kandidaten: die heutigen Hangar-Bausätze wie
   `hangar_medtop_*`, `hangar_lrgtop_*`, `hangar_smalltop_*`, Hallen in
   Städten und auf Stationen, ältere Industriehallen; was der PC findet,
   zählt). Daraus die Lage aller Requisiten und Boden-Decals relativ zur
   Mitte des Landefelds: `[x, z, drehungY, skalierung]` in m und Grad,
   dazu Größe und Ausrichtung des Felds. Die Cloud überträgt diese
   Anordnung auf unser Feld; so bleibt auch das Arrangement aus dem Spiel.

### A2. Export im selben Lauf (kein zweiter Satz nötig)

6. **Requisiten.** Je Art aus Punkt 4 bis zu drei, bevorzugt die, die die
   Anordnung aus Punkt 5 nutzt. LOD-Stufe je Requisit so wählen, dass es
   ≤ 8 000 Dreiecke hat (große wie Kran oder Bühne ≤ 20 000), alle zusammen
   ≤ 150 000. Je Requisit ein Knoten `prop_<rolle>_<n>`, Ursprung unten
   mittig, +Y oben, Meter; die Vorderseite des Spiels in der JSON nennen.
   Materialien mit allen Schichten (Abnutzung, Schmutz) wie in
   Schacht-Tiefe Punkt 3: Rohwerte wörtlich, die Umrechnung macht die
   Cloud.
7. **Boden-Decals.** Alle aus Punkt 2, die die Anordnung nutzt, sonst bis
   zu drei je Art. Texturen (Farbe mit Alpha, Normale und Glätte, falls
   vorhanden) als Material im GLB; je Decal ein Knoten `decal_<rolle>_<n>`:
   das Spiel-Mesh, wenn es eins ist, sonst ein Einheitsquadrat 1 × 1 m in
   der XZ-Ebene mit der Größe in der JSON.
8. **Böden.** Bis zu zwei Materialien aus Punkt 3 als Texturset (Farbe,
   Normale, Glätte, Schichten und Masken) mit Kachelung in m, jeweils als
   Material an einem kleinen Musterquadrat `floor_<name>` im GLB.
9. **Dateien.** `public/hangar/hall/werkstatt.glb` (Draco, WebP; Farbe
   ≤ 1024 px, Normalen und Masken ≤ 512 px) und
   `public/hangar/hall/werkstatt.json`:

   ```
   { v: 1,
     props:  [ { node, rolle, path, tris, size: [x, y, z], front, from: [<socpak>, …], count } ],
     decals: [ { node, rolle, path, size: [w, l], alpha, pom, from: [ … ] } ],
     floors: [ { node, name, path, tiling: [u, v], layers: [ … ] } ],
     materials: { "<Materialname im GLB>": { layers: [ … ] } },
     layout: { source, pad: { size: [x, z], dir }, items: [ { node, at: [x, z, drehungY, skalierung] } ] } }
   ```

   Alles zusammen ≤ 8 MB. Manifest `src/data/hangar-assets.json`: neuer
   Schlüssel `props` mit `werkstatt: { url, v, json, tris, bytes, props,
   decals, floors }` (neue Art `props` in `scripts/build-hangar-assets.mjs`,
   so wie `lift`).
10. **Selbstauskunft** im Build: Requisiten mit Dreiecken, Decals, Böden,
    Einträge der Anordnung, Bytes je Datei. Steht im Spiel etwas davon
    nicht, das klar sagen (zum Beispiel: keine Boden-Risse als Decal);
    dann fehlt es eben.

## Auftrag PC, Teil B: Schacht-Tiefe

11. Die Punkte 2 bis 7 aus [`hangar-schacht-tiefe.md`](hangar-schacht-tiefe.md)
    im selben Lauf (UVs des Bausatzes, Schichten, Beiwerk, Projektortexturen,
    Packen, Selbstauskunft). Befund dort eintragen.

## Abschluss PC

12. Vor dem Push `npm run build && npm run gate` (normal und `STAGING=1`).
    Das Tor [11] in `verify:hangar-hall` prüft den Schacht wie gehabt. Auf
    den Branch, ohne PR. Einbau, Merge nach staging und Vorher/Nachher
    macht die Cloud.

## Cloud (läuft parallel, wartet nicht auf den PC)

- Den Viewer auf `props.werkstatt` vorbereiten: optional laden (ohne
  Eintrag bleibt die Halle wie heute), Requisiten nach `layout` um das Feld
  stellen, Decals flach auf den Boden (gegen Flimmern versetzt wie die
  Wand-Decals seit #98), zusammengefasst je Material.
- Budget: Stufe hoch höchstens 40 Zeichenbefehle mehr, mittel höchstens
  20, niedrig und Telefone nur Decals (höchstens 5). Die statischen
  Schatten der Deckenspots nehmen die Requisiten mit; die Requisiten fahren
  nicht mit dem Aufzug, außer sie stehen im Feld.
- Ein Betonboden aus Teil A ersetzt die Bodenlacke nur als Variante mit
  Vorher/Nachher; ob die Halle damit gewinnt, urteilt Krisz.
- Vorher/Nachher derselben Ansichten (Startansicht, flach über dem Boden
  am Schiff, von oben) nach dem Einbau auf staging.

## Befund PC

(offen)
