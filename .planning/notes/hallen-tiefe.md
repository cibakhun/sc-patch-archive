# Halle: mehr Tiefe und Details (2026-10-07 abends)

Auslöser für die PC-Sitzung: **„Halle Tiefe“**. Krisz: „man kann hangar viel
realistischer, viel detailierter, viel tiefer machen.“ Alles muss direkt aus
dem Spiel kommen, nichts selbst gebaut.

## Befund (Cloud, aus Skripten und Artefakt)

1. **Die Halle kommt in LOD 1**, nicht in voller Stufe: `COMMON` im Extraktor
   setzt `--lod 1` für alles. Fasen, Schrauben und Kantenprofile der vollen
   Stufe fehlen deshalb.
2. **Echte Einrichtung wird verworfen**: `DROP_HALL` im Build wirft Pflanzen,
   Sofas, Stühle, Beistelltische, Kisten mit Plane und Spinde weg. Das sind
   Spielobjekte und gehören in die Halle.
3. **Lampen des Spiels fehlen**: Der Viewer beleuchtet mit einem eigenen
   Bühnenlicht. Die Lichtquellen der Halle (Position, Farbe, Stärke, Radius,
   Kegel) stecken im socpak, kommen aber nicht mit.
4. **Unklar, ob verschachtelte Objektcontainer mitkommen** (Aufzug, Konsolen,
   Landeplattform, Deckenbeleuchtung als eigene socpaks oder Entities).

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. Halle mit voller Stufe exportieren: für die Halle kein `--lod 1` (Schiffe
   bleiben wie sie sind). Halle weiter nicht dezimieren. Ziel ≤ 20 MB; wird es
   mehr, Texturen der Halle auf 1024 lassen und die Größe nennen.
3. `DROP_HALL` leeren, die Einrichtung bleibt drin. Wenn etwas davon ohne
   Spiel-Laufzeit falsch aussieht (z. B. Pflanzen ohne Alpha), einzeln
   benennen statt pauschal werfen.
4. Prüfen, was das socpak referenziert, aber der Export nicht mitbringt
   (Kind-socpaks, Entities). `starbreaker socpak export --help` und die
   Entity-Liste ansehen. Fehlendes mitexportieren und in die Halle einhängen.
5. **Lichter**: die Licht-Entities der Halle (Typ, Position, Ausrichtung,
   Farbe, Stärke, Radius, Kegelwinkel, Schatten an/aus) als
   `public/hangar/hall/revelyork-single.lights.json` schreiben, in
   glTF-Koordinaten der Halle (Meter, Y oben, gleicher Ursprung wie das GLB).
   Format: `{ "lights": [{ "type": "point|spot|area", "pos": [x,y,z],
   "dir": [x,y,z], "color": [r,g,b], "intensity": n, "radius": n,
   "angle": n, "shadow": bool, "name": "…" }] }`. Selbstauskunft: Anzahl je Typ.
6. Selbstauskunft im Build: Dreiecke Halle, Anzahl Einrichtungsobjekte,
   Anzahl Lichter, Größe.
7. Build + Gate (normal und STAGING=1), committen, pushen. Kein PR.

Den Viewer (Lichter aus der JSON setzen) macht die Cloud.
