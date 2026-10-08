# Halle: Vertexfarben aus dem Spiel behalten (2026-10-08 nachmittags)

Auslöser für die PC-Sitzung: **„Hallen-Vertexfarben“**. Folgt auf
„Hallensonden“ (2bc2701, Teil A gepusht, Teil B ohne Karten, Teil C Auskunft).

## Befund (PC, Teil C von „Hallensonden“)

- Die großen Wandmaterialien tragen im Shader `%VERTCOLORS`
  (`plastic_white01`, `metal_white`, `metal_white_02`). Ihr `COLOR_0` ist eine
  Graustufen-Abdunkelung (R = G = B), mit der das Spiel die Paneele
  unterschiedlich abdunkelt. Der Build verwirft `COLOR_0` heute überall
  (`stripAttributes`), darum stehen alle Paneele im selben Weiß.
- Die Reliefkarten dieser Flächen sind im Spiel flach. Tiefe kommt dort aus
  Geometrie, Vertex-Abdunkelung und Laufzeitlicht. Die Vertexfarben sind also
  das, was der Wand aus den Spieldaten noch fehlt.
- Krisz am 08.10. um 11:25: „die wand fühlt sich immer noch nicht echt an“.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. Extraktor (`scripts/extract-hangar-sources.mjs`, `parseSubMaterials`): je
   Material merken, ob die `StringGenMask` `%VERTCOLORS` enthält (etwa
   `vc: true`), so wie heute schon `%BLENDLAYER`.
3. Build (`scripts/build-hangar-assets.mjs`), **nur die Halle**: `COLOR_0`
   behalten, wenn das Material der Primitive `%VERTCOLORS` trägt, sonst wie
   bisher verwerfen. Schiffe bleiben unverändert (dort ist `COLOR_0` eine
   Abnutzungsmaske).
   - Als normalisiertes UNORM8 (`VEC3` oder `VEC4`), damit die Halle kaum
     schwerer wird. Der Viewer liest nur den Rotkanal.
   - Primitive, die ihr Material erst über die matfix-Zuordnung bekommen:
     ebenso behandeln (das zugeordnete Material entscheidet), aber in der
     Selbstauskunft getrennt ausweisen. Die Cloud prüft im Bild, ob ihre
     Abdunkelung trägt.
4. Beide Hallenstufen neu bauen, erzwungen: die volle Stufe
   (`revelyork-single.glb`) und die dichte Kopie (`revelyork-single-lod1.glb`,
   die bekommen die Telefone). Die Lampenliste bleibt, wie sie ist.
5. Selbstauskunft, wörtlich in die Rückmeldung:
   - je Material mit behaltenem `COLOR_0`: Name, Dreiecke, Mittel von R und
     Anteil der Ecken mit R < 0,98, getrennt nach eigener und matfix-Zuordnung;
   - Bytes beider Stufen vorher und nachher;
   - die übliche Kopfzeile, `Hülle: …` und `Einrichtung: …`.
6. `npm run build && npm run gate`, dann `STAGING=1` ebenso, committen,
   pushen. Kein PR: Den Viewer (Abdunkelung im Hallenshader, ohne neue
   Shaderprogramme), die Sichtprüfung und den Merge macht die Cloud.
7. Lässt sich `%VERTCOLORS` aus den `.mtl` nicht sicher lesen: nichts raten,
   sondern melden, was in der `StringGenMask` der zehn größten Materialien
   steht.
