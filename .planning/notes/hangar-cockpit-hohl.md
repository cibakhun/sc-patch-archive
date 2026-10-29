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

## Befund vom PC

PC-Lauf 29.10.2026, Branch `pc/hangar-cockpit` (Basis b9d2476c), Worktree
`.claude/worktrees/hangar-innenraum`, Rohexporte CL 12913470.

### Teil A: Ursache

**Ursache: Das Spiel zeichnet die Rumpf- und Cockpitmaterialien
zweiseitig, die Web-Fassung einseitig.** Im `.mtl` setzt `MtlFlags`
Bit 0x2 (`MTL_FLAG_2SIDED`; 0x80 ist `PURE_CHILD`, steht bei allen
Untermaterialien). StarBreaker übernimmt das nie nach `doubleSided`: im
Rohexport tragen 26 von 26 solcher Materialien der Gladius, 24 von 24 der
Arrow und 41 von 41 der Hornet F7C Mk II `doubleSided: false`. Von innen
fehlt dann die Innenseite des Rumpfs, man sieht durch das Schiff.

1. **Rohexport gegen Web** (dasselbe Werkzeug, Glas für beide am Namen
   erkannt, weil der Rohexport sein Glas noch nicht auf `BLEND` hat; im
   Original meldet er für Gladius und Arrow „kein Haubenglas“):

   | Schiff | roh | Web | LOD 0 | roh, zweiseitig aus `MtlFlags` | LOD 0, zweiseitig |
   |---|---:|---:|---:|---:|---:|
   | Gladius | 18 % | 14 % | 19 % | 4 % | 7 % |
   | Arrow | 22 % | 21 % | 41 % | 22 % | 35 % |
   | Hornet F7C Mk II | 58 % | 48 % | 53 % | 1 % | 3 % |
   | Hornet F7C | 5 % | 3 % | | 1 % | |
   | L-21 Wolf | 33 % | 52 % | | 1 % | |
   | Cutlass Black | 46 % | 22 % | | 34 % | |

   Roh ≈ Web bei Gladius, Arrow und den Hornets (Innenraum dort ganz
   behalten): **nicht der Bau.** Wolf und Cutlass sind roh und web nicht
   vergleichbar, weil der Rohexport dort den ganzen Innenraum samt
   Innenfenstern trägt. Am Bildpunkt links neben dem Sitz (Sicht wie
   Krisz) trifft ein Strahl im Rohexport und auf staging keine
   Vorderseite (`pick` → nichts), mit „zweiseitig“ die Innenseite des
   Rumpfs (`AEGS_Gladius_mtl_primary_hardsurface_021`, 6,2 m).
2. **LOD:** Gladius, Arrow, Hornet F7C Mk II mit `--lod 0` (`--mip 4`,
   eigener Ordner `.cache/cockpit-scan/lod0/`, 55/31/33 MB): nicht zu
   (19/41/53 %). **Nicht der LOD.**
3. **Zweiseitig:** `MtlFlags` der genannten Materialien:
   `AEGS_Gladius_mtl_primary_hardsurface_021` und `…_metal_steel_025`
   0x3000082 (zweiseitig), `…_internal_mesh_016` und `…_quilting_019`
   0x3000080 (einseitig), `ANVL_Arrow_mtl_metal_dark_019` 0x3000082,
   `ANVL_Arrow_mtl_internal_pom_026` 0x3000080,
   `anvl_arrow_int_mtl_metal_dark_07` 0x80,
   `anvl_hornet_f7_mk2_b_mtl_metal_gunmetal_06` und
   `…_Damage_Internals_Tile_021` 0x3000082. Der Rest der Arrow (22 %)
   trifft die Rückseite von `internal_pom_026` an `nose_guts`, die auch
   im Spiel einseitig ist.
4. Bilder (`hangar-cockpit-hohl/`, Gladius vorn links vor dem Sitz,
   Hintergrund grün, Haube ausgeblendet, `scratch/cockpit.html` im
   Hintergrund-Chrome): `gladius-roh.jpg` und `gladius-web-vorher.jpg`
   (grün links neben und hinter dem Sitz), `gladius-lod0.jpg` (ebenso),
   `gladius-web-nachher.jpg` (zu: dort steht jetzt die Innenseite des
   Rumpfs).

### Teil B: Beheben

**Ergebnis über alle 230 Schiffe mit Haubenglas: hohl im Mittel 25,0 →
12,0 %; über 10 % hohl 165 → 100 Schiffe, über 20 % 133 → 45.** 231 gebaut,
0 Fehler, keines über 16 MB (größtes: Ironclad 15,3 MB). Tor [17]: GLB
741,3 → 895,4 MB, mit Ablage **1135,5 MB** (vorher 951,9; Deckel 1600).
Dreiecke ohne Material bleiben bei 56 (die drei Spiellücken aus
`hangar-innenraum.md`). Je Schiff: [`hangar-cockpit-hohl/je-schiff.md`](hangar-cockpit-hohl/je-schiff.md),
Messung vorher/nachher: `messung-vorher.json`, `messung.json`.

5. **Zweiseitig** (`cleanMaterials`, Option `twoSided`, nur Schiffe):
   `doubleSided` aus `MtlFlags` & 0x2, Glas ausgenommen. Die
   nachgetragenen Materialien aus `ships-matfix` tragen ihre `MtlFlags`
   jetzt mit (`parseSubMaterials` → `flags`, alle 26 `matfix.json` neu).
   Halle, Schacht und Werkhalle bleiben, wie sie sind (dort nicht
   gemessen).
6. **Innenraum hinter Glas behalten** (`dropInterior`): Glas außerhalb der
   `interior_*`-Container (Erkennung wie das Messwerkzeug), je
   Glas-Knoten ein Hüllquader der benutzten Ecken, um 2,5 m erweitert;
   jeder Innenraum-Knoten, dessen Hüllquader einen davon schneidet,
   bleibt. Manifest `interiorKept: { nodes, tris }`. 80 Schiffe behalten
   so einen Teil (hohl im Mittel 30,4 → 16,3 %), 40 weitere jetzt den
   ganzen, weil alle Knoten hinter Glas liegen (z. B. L-21 Wolf 56 → 0 %,
   Hull B 60 → 1 %, Sabre Raven 35 → 0 %). Dazu `dropBareInterior`:
   Innenraumteile, die auch nach dem Nachtrag kein Material haben, fallen
   weg (Javelin 13 613, Starfarer/Gemini je 37 592, 600i Touring 24 323
   Dreiecke; ihre `.mtl` gibt es im Spiel nicht), sonst stünden sie
   hinter dem Glas weiß.
   **Kosten:** 67 Schiffe wachsen um mehr als 0,5 MB GLB, am meisten Argo
   SRV 2,8 → 15,2 MB (Glas über dem ganzen Innenraum, 280 000 → 1,67 Mio.
   Dreiecke), Starlancer MAX +6,6, Caterpillar/Pirate +5,7/+6,6, Corsair
   +5,0, Star Runner +5,0, Javelin +4,9, Ironclad +4,3. **Neue Stufe 2**
   in `build-hangar-alle.mjs` (`HANGAR_SHIP_NO_GLASS_INTERIOR`): auch der
   Innenraum hinter Glas weg, bevor die Karten kleiner werden. Ohne sie
   lagen die drei Guardian auch in der letzten Stufe bei 28 bis 34 MB und
   die Aurora Mk II rutschte auf Farbkarten 256 px. Mit ihr: Guardian,
   Guardian QI, Guardian MX, Aurora Mk II und Starlancer TAC in Stufe 2,
   Karten wie auf staging, Innenraum hinter Glas weg (hohl 5/7/26/12/0 %).
   Die übrigen Stufen rücken um eins (alte 2 bis 5 = neue 3 bis 6).
7. Gebaut über `build-hangar-alle.mjs --redo` (alle 231), danach die 29
   Schiffe neu, die vor `dropBareInterior` oder über Stufe 0 gebaut waren.
   Messwerkzeug: Ein Startpunkt zählt nur noch, wenn er von außen frei zu
   sehen ist; sonst zählten Innenfenster eines behaltenen Innenraums als
   Haube (Cutlass: 63 Startpunkte verworfen). Der Vorher-Stand ist mit
   derselben Fassung gemessen (staging-Dateien aus b9d2476c, Mittel 25,0 %
   wie in der Cloud).

   | Schiff | hohl vorher | nachher | Dreiecke | GLB MB |
   |---|---:|---:|---|---|
   | Gladius | 14 % | 3 % | 233 147 → 233 431 | 2,52 → 2,52 |
   | Arrow | 21 % | 19 % | 196 090 → 196 090 | 1,86 → 1,87 |
   | Hornet F7C Mk II | 50 % | 0 % | 203 607 → 203 637 | 1,76 → 1,77 |
   | Hornet F7A Mk II | 66 % | 1 % | 213 429 → 213 429 | 1,83 → 1,84 |
   | Hornet F7C | 3 % | 0 % | 199 630 → 199 630 | 1,76 → 1,76 |
   | Avenger Titan | 44 % | 21 % | 214 745 → 214 749 | 2,01 → 2,01 |
   | 325a | 6 % | 6 % | 211 605 → 211 605 | 1,82 → 1,82 |
   | L-21 Wolf | 56 % | 0 % | 328 726 → 342 672 | 3,58 → 3,76 |
   | Cutlass Black | 18 % | 45 % | 325 165 → 443 333 | 3,53 → 5,10 |
   | Starlifter A2 | 64 % | 1 % | 595 031 → 597 465 | 5,57 → 5,61 |

   Arrow bleibt bei 19 %: Der Rest ist die Rückseite von
   `ANVL_Arrow_mtl_internal_pom_026` an `nose_guts`, im Spiel einseitig.
8. `check:hangar-shader` (Grenze 16 Texturen je Bildshader): Gladius ✓ 104
   Programme, Arrow ✓ 101, Hornet F7C Mk II ✓ 101, Cutlass Black ✓ 106
   (Innenraum hinter Glas), Hammerhead ✓ 108. Gegen den Python-Testserver
   meldeten Arrow und Cutlass „Bild nicht geladen“ mit jedes Mal anderen
   Bildern (2, 13, dann 2 andere); alle liegen in `dist/`. Gegen
   `npx serve` (launch „hangar-innenraum-serve“) laden alle.
9. `npm run build` und `npm run gate` grün (29 von 29).

Bilder: `gladius-web-vorher/nachher.jpg`, `hornet-f7c-mk2-vorher/nachher.jpg`
(rechts neben dem Sitz grün → Boden und Rumpf), `cutlass-vorher/nachher.jpg`
(grün hinter den Sitzen → Innenwände).

### Offen für die Cloud (Sichturteil)

- **23 Schiffe messen schlechter,** alle mit behaltenem Innenraum: Reliant
  4 → 44 %, Reliant Tana 4 → 43 %, Mako 1 → 29 %, Sen 4 → 29 %, Nova
  0 → 43 %, Cutlass Black 18 → 45 %, 600i 34 → 59 %, 600i BIS2951
  34 → 59 %, 600i Touring 29 → 46 %, Defender 43 → 67 %, Phoenix Emerald
  33 → 51 %, Freelancer 27 → 43 %, Freelancer MIS/MAX/DUR 25/34/25 →
  31/39/29 %, Centurion 17 → 20 %, Hammerhead/Showdown 21/26 → 22/28 %,
  Spirit A1/C1 11/16 → 13/17 %, Vulture 9 → 11 %, Tyilui 25 → 26 %, Fury
  1 → 2 %. Grund: Der Strahl trifft zuerst die Rückseite einer
  einseitigen Innenverkleidung. Bei der Cutlass liegt hinter allen 72
  dieser Treffer eine sichtbare Fläche (1,6 bis 21 m), man sieht in die
  Kabine, nicht in die Halle; auf staging liefen 8 Strahlen ins Leere.
  Im Bild (Cutlass, Reliant) mehr Innenstruktur, kein Durchblick in die
  Halle; bei der Reliant steht eine graue Platte quer vor den Sitzen. Im
  Viewer ansehen, bevor eine Klinke „hohl sinkt nur“ diese Werte
  festschreibt.
- **Budget:** Argo SRV 15,2 MB für einen Schlepper. Wenn das zu viel ist,
  `GLASS_REACH` kleiner oder ein Deckel für den behaltenen Innenraum.
