# Halle: dichte Nähte (2026-10-08 abends)

Auslöser für die PC-Sitzung: **„Hallen-Nähte“**. Folgt auf
„Hallen-Vertexfarben“ (5195a87); Möbel und Abdunkelung sind seit PR #88 auf
staging.

## Befund (Cloud)

- An vielen Paneelkanten stehen gepunktete helle Linien, alt wie neu, am
  deutlichsten an den Seitenwänden der Nischen. Ein Strahl durch so einen
  Punkt trifft nichts: Er geht durch einen Spalt in der Wand und zeigt den
  Hintergrund (0x9aa0a8).
- Ursache ist das Packen, nicht das Spiel: Draco rundet die Lage jeder
  Primitive auf ein eigenes Raster (`quantizationVolume` 'mesh', 16 Bit über
  die Ausdehnung der Primitive, bei den großen Hallenteilen bis 188 m, also
  2,9 mm). Kanten zweier Teile, die im Spiel aufeinanderliegen, rücken so
  bis zu einer Rasterweite je Achse auseinander. Beispiel Nischenwand
  (Modellraum x −10,95…−1,56, z −56,22): Das Paneel `metal_white_02_07`
  endet bei y 4,4778, die Leiste `plastic_white01_06` darunter bei 4,4755,
  also 2,3 mm Spalt über 9,4 m.
- Gezählt mit `seamStats` (neu, `scripts/lib/hall-seams.mjs`) an
  `revelyork-single-lod1.glb` (41f0388d): 266 884 Randecken, **0 dicht**,
  **123 373 klaffend** (bis 5 mm neben der Ecke eines anderen Teils),
  3 527 T-Stöße mit Spalt.
- Gegenprobe an einer Kopie (`sealSeams` mit 5 mm, dann ein Raster für alle
  Teile, 18 Bit): **120 942 dicht, 78 klaffend**, 3 068 T-Stöße. Im Bild
  sind die Punkte weg (Nische von nah und in der Startansicht; die
  Längsblicke zeigten vorher keine), sonst ändert sich nichts. 12,43 statt
  12,21 MB. Beleg: `/mnt/project-files/hangar/v16-naehte-vorher-nachher.png`.
  Die 5 mm braucht nur die Cloud, weil ihre Quelle schon gerundet ist; der
  PC hat die ungerundete Quelle.
- Für den Viewer ist das Einbacken der Knoten unschädlich: HALL_DROP, der
  Hallenshader (Lage über `modelMatrix`), Lampen und Möbel rechnen im
  Modellraum, und die Kastenprojektion greift bei dieser Halle nicht.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. Build (`scripts/build-hangar-assets.mjs`), **nur die dichte Kopie der
   Halle** (`isLite(kind, name)`, heute `revelyork-single-lod1`):
   - `import { sealSeams, seamStats } from './lib/hall-seams.mjs'`;
   - unmittelbar vor dem letzten `doc.transform(prune(), textureCompress(…),
     textureCompress(…), draco(…))`: erst `seamStats(doc, { eps: 1e-4 })`
     (Stand der Quelle; dicht heißt dort bis 0,1 mm, weil die Knoten
     Rundungsrauschen tragen), dann `sealSeams(doc, { tol: 1e-4 })` (backt
     die Knoten ein, legt Ecken verschiedener Teile bis 0,1 mm auf einen
     Punkt);
   - in diesem `draco(…)` für die dichte Kopie `quantizePosition: 18` und
     `quantizationVolume: 'scene'` (ein Raster für alle Teile, 0,7 mm).
   - Die volle Stufe (`revelyork-single.glb`) bleibt, wie sie ist: Die
     Seite zeigt von ihr nur noch die Möbel, und die schneidet und packt
     die Cloud beim Build neu. Schiffe und Crew bleiben unverändert.
3. Nur die dichte Kopie neu bauen, erzwungen. Die Lampenliste bleibt.
4. Selbstauskunft, wörtlich in die Rückmeldung:
   - `seamStats` der Quelle (vor `sealSeams`) und der geschriebenen Datei
     (neu eingelesen), je `boundaryVerts, sealed, crack, crackMm, lone,
     tGap, tGapMm`;
   - das Ergebnis von `sealSeams` (`nodes, prims, snapped, groups,
     maxShift`);
   - Bytes vorher und nachher, Dreiecke, die übliche Kopfzeile, `Hülle: …`.
5. Bleiben in der geschriebenen Datei mehr als 1 000 klaffende Randecken:
   `tol` nicht von selbst erhöhen, sondern melden, wie sie sich verteilen
   (`crackMm` der Quelle und der Datei). Dann ist die Quelle selbst nicht
   dicht, und die Cloud entscheidet.
6. `npm run build && npm run gate`, dann als Vorschau (PowerShell:
   `$env:STAGING = '1'; npm run build; npm run gate`), committen,
   pushen. Kein PR: Sichtprüfung, das Tor für die Nähte
   (`verify:hangar-hall`, neue Zusicherung 6, vorgeführt rot an der alten
   Datei) und den Merge nach staging macht die Cloud.

## Ergebnis (10.10.2026)

- PC-Lauf 4460e71: `revelyork-single-lod1.glb` 1a878120, 12 580 432 statt
  12 213 104 Bytes, 1 197 783 Dreiecke, Hülle 0,03 %.
- Quelle (ungerundet, dicht bis 0,1 mm): 281 672 Randecken, 125 090 dicht,
  2 718 klaffend (0,1 bis 5 mm), 2 520 T-Stöße mit Spalt. Die Quelle ist
  also selbst nicht ganz dicht; das sind Spielgeometrie und keine Rundung.
- `sealSeams`: 32 Knoten, 59 Primitive, 198 043 Ecken in 63 068 Gruppen,
  größte Verschiebung 0,096 mm.
- Datei: 270 825 Randecken, **121 915 dicht, 1 753 klaffend** (vorher 0 und
  123 373), 1 690 T-Stöße. Von den 1 753 liegen 626 im Hallenraum,
  höchstens 16 in einer 2-m-Zelle; der Rest liegt außerhalb, die meisten
  im Aufzugsbereich hinter der Südwand.
- Im Bild (neun Blicke, je gegen staging und die Cloud-Probe mit 5 mm): die
  gepunkteten Linien sind weg, sonst kein Unterschied über 1 Grauwert im
  Mittel, 44 Shaderprogramme wie vorher.
- Gegenprobe mit magenta Hintergrund (was durchscheint, wird magenta), neun
  Blicke: durchscheinende Einzelpunkte 740 vorher, 145 nachher. Was bleibt,
  sind die Restspalte der Quelle und zwei Lücken der dichten Stufe, die
  die volle Stufe füllt: die Schlitze oben im Nordtor (dahinter in der
  vollen Stufe `metal_grey_04`) und die Türsymbole der blauen Glassäulen
  (dahinter Glas und `nernies_pipes_011`). Vor dem hellgrauen Hintergrund
  (0x9aa0a8) leuchteten sie weiß; der Viewer setzt hinter die echte Halle
  jetzt 0x1e2024, der Dunst bleibt hellgrau. Die Symbole wirken dadurch
  dunkel statt hell.
- Entscheidung Cloud: `tol` bleibt bei 0,1 mm. Die übrigen Spalte liegen
  schon im Spiel so; sie mit bis zu 5 mm zu schließen hieße Spielgeometrie
  verschieben, ohne dass sich im Bild etwas ändert. Beispiel: Die
  Schmutzabziehbilder (`leakings_019`) liegen 2 bis 3 mm neben Teilen
  aus `metal_grey_04` (144 von 169 ihrer klaffenden Ecken); ein Schließen
  bis 5 mm zöge ihre Ecken auf diese Teile.
- Tor `verify:hangar-hall` [6]: OBERGRENZE_KLAFFEND 1 753, KLINKE_DICHT
  121 915.
