# Hangar: Schiffe von innen hohl (2026-10-29)

Auslöser für die PC-Sitzung: **„Cockpit hohl“**. Derselbe Satz noch einmal
setzt den Lauf fort, wo er stand.

Anlass, Krisz 2026-10-29 11:16 mit Bild eines Cockpits auf staging (olivgrün
mit gelben Streifen, Light Fighter: die Gladius in ihrem Werkslack): „siehst
wie das schiff von innen hohl ist?“ Neben und hinter dem Sitz sieht man
durch das Schiff hindurch in die Halle.

Ziel: Durch die Haube sieht man, was das Spiel dort zeigt: Wände, Rückwand,
Boden des Cockpits. Kein Blick durch das Schiff hindurch. Es gelten die
Regeln aus [`hangar-katalog.md`](hangar-katalog.md) und
[`hangar-alle-schiffe.md`](hangar-alle-schiffe.md) (Budget je Schiff,
16 MB, alles aus dem Spiel).

## Befund aus der Cloud

- **Nachgestellt** im echten Viewer (Gladius, Kamera vorn links vor dem Sitz,
  wie Krisz' Bild). Strahlen von dort: Nach dem Haubenglas (2 m) trifft der
  Blick links hinter dem Sitz erst nach rund 6 m wieder etwas, und zwar die
  **Rückseite** von `AEGS_Gladius_mtl_internal_mesh_016` und
  `AEGS_Gladius_mtl_primary_hardsurface_021`, also die Innenseite des
  Rumpfs auf der anderen Seite. Die ist einseitig, der Viewer zeichnet sie
  von innen nicht, man sieht in die Halle. Dazwischen 4 m ohne Fläche.
- **Messwerkzeug** `scripts/measure-hangar-cockpit.mjs` (Werkzeug, noch kein
  Tor): je Modell 160 Strahlen von außen durch das Haubenglas hinein, fester
  Startwert. Zählt, ob hinter dem Glas zuerst eine Vorderseite („zu“), eine
  Rückseite („hohl“) oder nichts („frei“) kommt.
  ```
  node scripts/measure-hangar-cockpit.mjs public/hangar/ships [regex] [--json datei]
  ```
  Web-Fassung, alle 231 (230 mit Haubenglas): **hohl im Mittel 25 %**, 180
  Schiffe über 10 %, 135 über 20 %. Mit entferntem Innenraum
  (`interiorDropped > 0`, 130 Schiffe) 30 %, mit behaltenem (100) 20 %.

  | Schiff | hohl | Innenraum entfernt | Dreiecke Web / roh |
  |---|---:|---:|---|
  | Gladius | 14 % | 0 | 233 147 / 417 041 |
  | Arrow | 21 % | 0 | 196 090 / 189 516 (nicht dezimiert) |
  | Hornet F7C | 3 % | 0 | 199 630 / 203 433 |
  | Hornet F7C Mk II | 48 % | 0 | 203 607 / 219 205 |
  | Hornet F7A Mk II | 68 % | 0 | 213 429 / 227 066 |
  | Avenger Titan | 39 % | 0 | 214 745 / 289 558 |
  | 325a | 7 % | 0 | 211 605 / 195 884 |
  | L-21 Wolf | 52 % | 2 | 328 726 / 531 698 |
  | Cutlass Black | 22 % | 3 | 325 165 / 749 280 |
  | Starlifter A2 | 64 % | 10 | 595 031 / 1 562 658 |

- **Was von hinten getroffen wird** (Material der ersten Fläche, die man von
  hinten sieht, Abstand hinter dem Glas):
  - Arrow: `ANVL_Arrow_mtl_internal_pom_026` (22 von 33), dazu
    `anvl_arrow_int_mtl_metal_dark_07`, meist 1,8 bis 2,3 m;
  - Hornet F7C Mk II: `anvl_hornet_f7_mk2_b_mtl_metal_gunmetal_06` (53 von
    77) und die Schadensgeometrie `…_Damage_Internals_Tile/Structure`, meist
    2,2 bis 3,5 m, ein Teil schon 0,3 bis 0,4 m hinter dem Glas;
  - Gladius: `AEGS_Gladius_mtl_metal_steel_025`,
    `…_internal_mesh_016`, `…_quilting_019`, 1,7 bis 3,5 m.
- **Nicht die Dezimierung allein:** Arrow (nicht dezimiert) und Hornet Mk II
  (kaum) sind ebenso hohl. Drei Kandidaten bleiben, die nur der PC
  entscheiden kann:
  1. **LOD:** Die Rohexporte sind `--lod 1`. Wenn das Spiel in LOD 1 die
     Innenwände des Cockpits weglässt (für den Blick aus der Ferne), fehlen
     sie im Export.
  2. **Zweiseitig:** Die Flächen sind da, aber im Spiel zweiseitig
     (`MtlFlags` mit Bit 0x2 im `.mtl`), und der Export trägt
     `doubleSided` nicht für sie.
  3. **Bau:** `dropUnreachable`, `dropJunk`/`DROP_MAT` oder `simplify`
     werfen sie weg (Gladius: 417 041 → 233 147 Dreiecke).
  Dazu, unabhängig davon: bei 130 Schiffen wirft `dropInterior` den ganzen
  Innenraum weg, auch dort, wo man ihn durch Glas sieht (Cockpit, Brücke).
- Gladius im GLB-Raum (vor `SHIP_YAW`): Sitz `aegs_gladius_int_mtl_seat_015`
  x −0,24…0,24, y −0,64…0,06, z −8,74…−7,93; Haube
  `AEGS_Gladius_mtl_glass_ext_04` z −10,18…−7,44, y −0,40…0,89.

## Auftrag PC

### Teil A: Ursache (erst messen, dann bauen)

1. Rohexport gegen Web-Fassung mit demselben Werkzeug:
   ```
   node scripts/measure-hangar-cockpit.mjs .cache/hangar-src/ships "^(aegs-gladius|anvl-arrow|anvl-hornet-f7c-mk2|anvl-hornet-f7c|krig-l21-wolf|drak-cutlass-black)\.glb$"
   node scripts/measure-hangar-cockpit.mjs public/hangar/ships "^(aegs-gladius|anvl-arrow|anvl-hornet-f7c-mk2|anvl-hornet-f7c|krig-l21-wolf|drak-cutlass-black)\.glb$"
   ```
   Roh ≈ Web → nicht der Bau, weiter bei 2. Roh deutlich besser → im Bau
   Schritt für Schritt (Fahrwerk, `dropUnreachable`, `dropInterior`,
   Nachtrag, `dropJunk`, `simplify`) messen, wo es verloren geht.
2. **LOD:** Gladius, Arrow und Hornet F7C Mk II einmal mit `--lod 0`
   exportieren (in einen eigenen Ordner, den Rohbestand nicht
   überschreiben) und messen. Wird es zu: Welche Knoten/Meshes kommen in
   LOD 0 im Cockpit dazu (Namen, Dreiecke)?
3. **Zweiseitig:** Für die Materialien oben (`internal_pom`,
   `metal_gunmetal`, `metal_steel_025`, `internal_mesh`, `quilting`) im
   `.mtl` die `MtlFlags` nachsehen. Trägt das Spiel dort zweiseitig und der
   Export nicht?
4. Je Kandidat ein Bild aus derselben Sicht wie Krisz (vorn links vor dem
   Sitz der Gladius), Rohexport, Web und ggf. LOD 0, klein nach
   `.planning/notes/hangar-cockpit-hohl/`.

### Teil B: Beheben

5. An der Ursache, in Extraktor oder Bau, für alle Schiffe gleich (keine
   Liste einzelner Schiffe). Je nach Befund:
   - LOD: die Cockpit- und Innenraumteile aus LOD 0, der Rumpf bleibt wie
     er ist (Budget);
   - zweiseitig: `doubleSided` aus den `MtlFlags` übernehmen;
   - Bau: den verlustreichen Schritt am Cockpit vorbei führen.
6. **Innenraum hinter Glas behalten:** `dropInterior` wirft heute alle
   `interior_*`-Container weg, wenn das Budget knapp ist. Stattdessen die
   Knoten behalten, die man durch Glas sieht (Hüllquader des
   Haubenglases plus ein Rand, z. B. 2,5 m, nach Messung einstellen), den
   Rest wie bisher entfernen. Kosten in Dreiecken und MB je Schiff nennen.
7. Betroffene Schiffe neu bauen über `node scripts/build-hangar-alle.mjs
   --only <slugs> --redo` (Stufen gegen 16 MB wie bisher). Danach
   `measure-hangar-cockpit.mjs` über alle 231 Web-Schiffe, vorher/nachher
   je Schiff in den Befund, `--json` nach
   `.planning/notes/hangar-cockpit-hohl/messung.json`.
8. `npm run check:hangar-shader -- --base <Vorschau> --ship <slug>` für
   Gladius, Arrow, Hornet F7C Mk II und ein Schiff aus Punkt 6.
9. `npm run build && npm run gate` grün, Branch `pc/hangar-cockpit` pushen.

### Selbstauskunft am Ende

Die übliche Kopfzeile. Ursache mit Beleg (Messung roh/Web/LOD 0, `MtlFlags`).
Je geändertem Schiff: hohl vorher → nachher, Dreiecke, MB. Summe GLB +
Ablage gegen den Deckel von Tor [17].

## Cloud danach

Einmischen, im Viewer ansehen (Gladius wie Krisz' Bild, Hornet Mk II,
Arrow, ein großes Schiff mit Brücke), `measure-hangar-cockpit` zum Tor
machen (Schiene A, Klinke je Schiff: hohl sinkt nur), vorgeführt rot, PR
auf staging, `check:staging` vom PC.
