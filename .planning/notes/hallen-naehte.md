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
6. `npm run build && npm run gate`, dann `STAGING=1` ebenso, committen,
   pushen. Kein PR: Sichtprüfung, das Tor für die Nähte
   (`verify:hangar-hall`, neue Zusicherung 6, vorgeführt rot an der alten
   Datei) und den Merge nach staging macht die Cloud.
