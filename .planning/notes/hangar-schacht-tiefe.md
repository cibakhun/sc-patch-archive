# Hangar: Schacht mit Stimmung und Detail (2026-10-16)

Auslöser für die PC-Sitzung: **„Schacht-Tiefe“**. Anlass: Krisz
2026-10-16 09:17 mit Bildschirmfoto von oben in den Schacht: „es sind jhz
schon wände da aber halt wieder super basic und langweilig und nicht
überhaupt nicht mit "tiefe" erledigt worden“, 09:21: „ich meinte nicht
physische tiefe, ich meinte ästhetische tiefe oder krative tiefe“.

Gemeint ist also Stimmung und Charakter, kein Relief. Die Cloud baut
Licht, Dunst und Inszenierung selbst (Abschnitt unten). Was dafür aus dem
Spiel kommen muss, ist das Detail, das man gern ansieht: die Trimsheets
mit ihren Warnstreifen und Paneelen, Decals mit Beschriftung, Kabel,
Lampengehäuse. Regel 10-07 gilt dafür: Geometrie und Texturen aus dem
Spiel, nichts Selbstgebautes. Keine Bilder, keine Roh-Exporte committen
(das Repo ist öffentlich).

Folgeauftrag zu [`hangar-schacht.md`](hangar-schacht.md) (Bausatz
`medtop`, fc60b39).

## Warum der Schacht leer wirkt (Befund Cloud)

1. **Keine Texturkoordinaten.** `medtop.glb` trägt nur POSITION, NORMAL
   und COLOR_0. Die Trimsheets (`trim_hightech_c/_d`), die Greebles und
   die Lackschicht liegen als Texturen bei, lassen sich ohne UVs aber
   nicht auflegen. Der Viewer nimmt von jeder Karte nur den Mittelwert:
   Jede Wand ist eine gleichmäßig dunkelgraue Fläche, ohne Streifen,
   Fugen, Schrift oder Abnutzung.
2. **Nur die erste Materialschicht.** Abnutzung und Schmutz (Wear-Schicht,
   über Vertexfarbe gemischt) fehlen. Die Lackschicht allein ist fast
   schwarz (Tönung 0,051/0,056/0,063).
3. **Kein Beiwerk.** Exportiert sind Wand, Rippe, Ecke, Randleisten und
   zwei Lampenkörper. Decals, Kabel, Rohre, Geländer, Schilder und die
   Gehäuse der Leisten-, Boden- und Fluterlampen fehlen.
4. **Licht und Stimmung** sind Cloud-Sache: Der Viewer dunkelt heute alles
   unter dem Hallenboden noch nach dem alten Stand ohne Schacht ab (bis
   92 % ab 22 m Tiefe), und die Spiellampen haben keinen Dunst, keine
   Kegel und keine Farbregie.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. **UVs.** Herausfinden, wo TEXCOORD_0 verloren geht: im StarBreaker-
   Export (`.cache/hangar-src/lift/medtop.glb`) oder in
   `scripts/build-hangar-assets.mjs` (Art `lift`). Beheben, sodass jedes
   Teil seine Spiel-UVs trägt, dazu TEXCOORD_1, wenn ein Material es
   nutzt. Selbstauskunft je Teil und Material: UV-Sätze, Wertebereich,
   Anteil Dreiecke ohne UV-Fläche.
3. **Schichten.** Für jedes Submaterial der Schachtteile in `medtop.json`
   unter `materials` (Schlüssel = Materialname im GLB): alle Schichten der
   Reihe nach (Pfad, Tönung, Tiling, Glanz, Karten) und womit sie gemischt
   werden (Vertexfarbkanal oder Maske). Die Karten der zweiten Schicht
   (Wear/Schmutz) und die Mischmaske mit ins GLB. Rohwerte wörtlich, die
   Umrechnung macht die Cloud.
4. **Beiwerk.** Alles im Schachtbereich des socpak (innen 56 × 88 m, vom
   Hallenboden bis zur Plattformoberkante in Ruhe, im Exportraum y −50
   bis −86), was der Bausatz noch nicht hat: Decals (Warnstreifen,
   Nummern, Schilder, Pfeile), Kabel, Rohre, Geländer, Leitern, die
   Gehäuse der Lampen (`elev`, `base`, Fluter, `side_proj`). Je Art ein
   Knoten `deco_<rolle>` (Ursprung am Montagepunkt, Achsen wie die
   Wandteile), dazu in der JSON `deco: [ { node, kind, at: [ [x, y, z,
   drehungY], … ] } ]` in Schachtraumkoordinaten wie `lights[].pos`.
   Decals mit Material und Alpha. Steht im Schacht nichts davon, das klar
   sagen; dann gibt es eben nur die Trims.
5. **Projektortexturen.** Die Fluter sind `Projector`-Lichter. Hat ein
   Licht eine Projektortextur (Muster im Kegel), den Pfad in
   `lights[].projector` und das Bild klein (≤ 256 px, WebP) als
   `public/hangar/lift/medtop-proj-<n>.webp`. Die Cloud nimmt das Muster
   für die Lichtkegel.
6. Packen wie bisher (Draco, WebP; Farbe ≤ 1024 px, Normalen und Masken
   ≤ 512 px), alles zusammen ≤ 4 MB. Dreiecke des fertigen Schachts (so
   wie ihn der Viewer reiht, 46 Teile) ≤ 60 000; reicht das nicht, das
   Beiwerk nach Wirkung kürzen und das im Befund sagen. Manifest
   `src/data/hangar-assets.json` wie gehabt.
7. Selbstauskunft wie beim letzten Lauf, dazu: UV-Sätze je Teil,
   Materialien mit allen Schichten, Decals, Beiwerk-Arten mit Anzahl,
   Projektortexturen, Bytes je Datei. Unten unter „Befund PC“ eintragen.
8. Vor dem Push `npm run build && npm run gate`. Das Tor [11] in
   `verify:hangar-hall` prüft den Bausatz: neue Knoten dürfen dazukommen,
   die neun alten bleiben mit ihren Rahmen. Auf den Branch, ohne PR.
   Einbau, Merge nach staging und Vorher/Nachher der Fahrt macht die
   Cloud.

## Cloud (läuft parallel, wartet nicht auf den PC)

- Die alte Abdunkelung unter dem Boden für den Schacht abschalten.
- Lichtregie für die Fahrt: kühler Dunst im Schacht gegen die warme,
  helle Halle; die orangen Warnlampen als Akzent; Lichtkegel der Fluter
  im Dunst; ein Lauflicht, das während der Fahrt mit der Plattform die
  Wände entlangzieht.
- Grafikbudget wie bisher: die Fahrt nicht teurer als die Halle in Ruhe,
  Telefone mit eigener Stufe.
- Nach der PC-Lieferung: Trims mit UVs, Abnutzung, Decals und Beiwerk
  einbauen.

## Befund PC

(offen)
