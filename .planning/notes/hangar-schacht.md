# Hangar: Aufzugsschacht aus dem Spiel (2026-10-15)

Auslöser für die PC-Sitzung: **„Hangar-Schacht“**. Anlass: Krisz
2026-10-15 22:28, Bildschirmfoto vom Schiffswechsel: „wenn es runterfährt
siehts so aus beim schiff wechseln“. Fährt das Feld ab, ist das Loch eine
flache schwarze Fläche: keine Schachtwände, die Kanten des Hallenbodens
schweben mit sichtbarer Unterseite (Platte y 0 bis 1 mit Rippen), tief
unten liegt das Feld als dunkle Platte mit ein paar Leuchtstreifen.

Das ist der Teil B von [`hangar-aufzug.md`](hangar-aufzug.md), auf den
Schacht beschränkt. Die zehn Schiffe (dort Punkt 6) gehören **nicht** in
diesen Auftrag; sie bleiben geparkt. Regel 10-07 gilt: Wände, Rand,
Lichter und ihre Texturen kommen aus dem Spiel, nichts Selbstgebautes.

## Stand Cloud

- Das Feld (Modellraum x 16…48, z −120…−24, 32 × 96 m) fährt beim Wechsel
  `LIFT_DEPTH` 26 m plus Schiffshöhe tief, bei großen Schiffen also bis
  rund 50 m. Darum herum ist heute nichts; der Hintergrund ist 0x07080b.
- Der Viewer kann Spielteile wiederholen (Wandstück neben Wandstück,
  übereinander) und auf das Feld zuschneiden. Ein ganzer Schacht in
  anderer Größe geht auch; dann wird er auf 32 × 96 m gestreckt oder aus
  seinen Teilen neu gereiht.
- Grafikbudget (Krisz' Grafikkarte, siehe `hangar-gpu-pacing`): der
  Schacht darf höchstens rund 10 Zeichenbefehle und 60 000 Dreiecke
  kosten. Warnlichter werden im Viewer leuchtende Flächen und höchstens
  zwei echte Lichtquellen, keine weiteren Schatten.

## Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. Persönliche Hangars des heutigen Spiels: den Schiffsaufzug finden
   (socpaks und Entities, Suchbegriffe etwa elevator, lift, platform,
   `hangar_*`, `shaft`). Für die Größe, deren Aufzugsfläche 32 × 96 m am
   nächsten kommt, sonst für die größte. Gibt es dort keinen sichtbaren
   Schacht (etwa weil das Spiel ihn nie zeigt), den Lastenaufzug einer
   Station oder Landezone mit Schacht nehmen und das im Bericht sagen.
3. Exportieren und packen wie die Halle (Draco, WebP ≤ 1024 px), alles
   zusammen ≤ 3 MB, nach `public/hangar/lift/<name>.glb`:
   - Schachtwand, Schachtecke, Rand an der Bodenkante (Schienen,
     Warnmarkierung, Abdeckungen), Schachtboden, wenn es einen gibt;
   - die Leuchten und Warnlichter am Aufzug als Meshes;
   - jedes Teil als eigener Knoten, benannt nach seiner Rolle (`wall`,
     `corner`, `rim`, `bottom`, `light_<n>`), Ursprung an seiner
     unteren linken Ecke zur Schachtmitte hin, y nach oben. Ist der
     Schacht im Spiel ein Stück, ihn ganz exportieren (Knoten `whole`,
     Aufzugsmitte im Ursprung, Oberkante der Plattform auf y 0).
4. Daneben `public/hangar/lift/<name>.json`:
   `{ v: 1, source, modules: { wall: { size: [b, h] }, corner: { size },
   rim: { size: [b, h] }, bottom?: { size } } | null, whole?: { size:
   [b, l], depth }, lights: [ { node?, pos, dir?, color, intensity,
   radius, angle?, anim: { kind, speed, … } } ], motion: { Fahrweg,
   Geschwindigkeit, Beschleunigung, Pausen, Vorwarnzeit, Lichtwechsel,
   wörtlich mit Quelle } }`. Im Manifest `src/data/hangar-assets.json`
   ein Eintrag `lift: { "<name>": { url, json, bytes, v } }`.
5. Selbstauskunft: gefundene Aufzüge (Datei, Maße), exportierte Teile mit
   Dreiecken, Materialien und Bytes, Zahl der Lichter, die übliche
   Kopfzeile. Keine Bilder und keine Roh-Exporte committen (das Repo
   ist öffentlich); die Bilder rendert die Cloud.
6. Vor dem Push `npm run build && npm run gate`; auf den Branch, ohne PR.
   Einbau, Merge nach staging und die Bildfolge vorher/nachher macht die
   Cloud.

## Befund PC

(leer)
