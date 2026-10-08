# Halle: Neubau ohne Dezimierung, dann Spiegelungssonden (2026-10-07 abends)

Auslöser für die PC-Sitzung: **„Hallensonden“**. Folgt auf „Halle Tiefe“
(7748b0a): volle Stufe, Einrichtung und Lampen sind drin.

Das ist der einzige PC-Lauf, den die Halle noch braucht (Stand 2026-10-08
nachts). Zwei Teile, in dieser Reihenfolge. Teil A ist der wichtigere und
schnell gemacht: bitte als eigenen Commit pushen, bevor Teil B beginnt.

### Stand der Cloud vor dem Lauf (2026-10-08)

- Der Viewer lädt ohne Einfrieren (Shader einmal, im Hintergrund) und
  beleuchtet die Halle mit den Spiellampen aus `revelyork-single.lights.json`
  (feste Auswahl: 6 Lampen am Rechner, 3 am Telefon). Die Spiegelungen nimmt
  er vorerst selbst auf (eine Umgebungskugel aus der geladenen Halle); die
  Sonden aus Teil B ersetzen sie.
- Im Manifest (`src/data/hangar-assets.json`) zeigt der Eintrag
  `revelyork-single` vorübergehend auf die dichte Kopie
  `revelyork-single-lod1.glb`. Der Neubau aus Teil A schreibt den Eintrag neu
  (`url` wieder `revelyork-single.glb`, `floor` misst der Build jetzt selbst):
  genau so gewollt. `revelyork-single-lod1.glb` bitte **liegen lassen**, die
  Cloud gibt sie danach den Telefonen (kleiner, gleiche Lampen).

## Teil A: Halle neu bauen (ohne Dezimierung, Möbel als eigene Knoten)

### Befund (Cloud)

Die Halle auf staging hat Löcher in beiden Längswänden: hinter den
Galerien, über der Rückwand der Seitennischen und über dem Tor sieht man
ins Leere; an der Nischenöffnung stehen schiefe Holz- und Weißdreiecke, die
R&Y-Schrift und die Pfeile an der Nische fehlen. Die Halle davor (85d2bab,
LOD 1) war dicht.

Ursache: Der Build hat die Halle dezimiert. Das Budget stand bei 700k
Dreiecken, die volle Stufe hat 1,24 Mio.; damit lief die Dezimier-Leiter bis
zur Schwelle 0,04 (≈ 7 m). Die Bausatzteile sind große ebene Flächen mit
Öffnungen, in der Ebene kostet ein Kollaps keinen Fehler, und der
Vereinfacher zog Ränder über die Öffnungen. Gemessen mit Blickstrahlen aus
dem Raum (`scripts/lib/hall-hull.mjs`): 0,04 % entkommen bei der heilen
Halle, 2,3 % bei der von heute. Gegenprobe: dieselbe Leiter auf die heile
Halle angewandt ergibt 1,1 %, mit den Löchern an denselben Stellen
(Längswände, 0 bis 16 m Höhe).

Schon im Build (Cloud): Die Halle wird nie mehr dezimiert (Budget nur noch
Warnschwelle), und die Selbstauskunft misst die Dichtheit gegen das
geschriebene GLB (Zeile „Hülle: …“, `hull` im Manifest).

### Auftrag PC

1. `git pull` auf `claude/wot-hangar-hzs46w`.
2. Nur die Halle neu bauen, erzwungen (die Eingaben sind unverändert, ohne
   `--force` nimmt der Build das alte Ergebnis):
   `node scripts/build-hangar-assets.mjs --only revelyork-single --force`
3. Selbstauskunft melden, wörtlich:
   - `Hülle: … %` — soll unter 0,5 % liegen (heute 2,3 %). Liegt sie
     darüber, die ganze Zeile nennen und Teil A nicht pushen.
   - `Einrichtung: N Möbel in M eigenen Knoten …, Halle D Draw-Calls` —
     heute 88 Draw-Calls; werden es mehr als 500, die Zahl nennen.
   - die Kopfzeile der Halle (Dreiecke, MB) und eine etwaige
     `WARNUNG Halle`.
4. `npm run build && npm run gate`, dann `STAGING=1` ebenso, committen,
   pushen. Kein PR: Sichtprüfung, PR und Merge macht die Cloud.
5. Gleich danach Teil B, in derselben Sitzung (kein zweites Stichwort nötig).

Zum Hintergrund der Möbel: Für große Schiffe wächst die ganze Halle mit
(Faktor bis ≈ 3). Der Build lässt jetzt jedes Möbel als eigenen Knoten mit
Bezugspunkt (`markFurniture`, `extras: { furniture, anchor }`, alles andere
wird wie bisher zusammengelegt). Der Viewer hält Kisten und Spinde damit in
Originalgröße; das kommt mit demselben Neubau.

## Teil B: Spiegelungssonden aus dem Spiel

### Stand (Cloud)

- Die Lampenliste kommt ausgerichtet an (`v: 2`): Spots aus dem
  Z-oben-Raum nach glTF umgerechnet (x, z, −y), Flächenlichter an ihrer Fläche
  ausgerichtet. Der Build macht das selbst (`scripts/lib/hall-lights.mjs`,
  aufgerufen in `hallLights`).
- Der Viewer rendert die Spiegelungen bisher selbst: eine Umgebungskugel aus
  der geladenen Halle, 2,5 m über der Plattform, beleuchtet von nur 6 der
  469 Spiellampen. Das ist eine Annäherung. Im Spiel kommen Spiegelungen und
  Streulicht aus den Umgebungssonden der Halle, mit allen Lampen des Spiels
  aufgenommen; deshalb sind sie das Wichtigste, was die Halle noch vom Spiel
  trennt.
- Versionieren muss der PC nichts: Die Seite hängt an Lampen- und
  Sondendateien selbst einen Inhalts-Hash an.

### Auftrag PC

1. Die Umgebungssonden der Halle finden: Entities im socpak der Halle (und
   in Kind-Containern) mit Würfelkarte, etwa `EnvironmentProbe` bzw. Namen wie
   `probe_*`. Je Sonde: Name, Position (glTF-Raum der Halle, wie die Lampen),
   Ausdehnung der Box, Priorität/Abschwächung, falls genannt, und die Pfade
   der Würfelkarten (spiegelnd `_cm`, diffus `_cm_diff` o. ä.).
2. Die Würfelkarten dekodieren (HDR, meist BC6H), höchste Stufe ≤ 512 px je
   Seite, und als **Equirect-HDR** schreiben (Radiance `.hdr`, RGBE,
   1024 × 512 für spiegelnd; diffus darf 128 × 64 sein). Seitenreihenfolge
   und Achsen (Z oben im Spiel) so drehen, dass +Y oben ist und die Karte zur
   Halle im GLB passt: ein Fenster oder eine Lampe der Halle muss in der
   Karte in derselben Richtung liegen wie im GLB von der Sondenposition aus.
3. Ablage: `public/hangar/hall/revelyork-single.probes/<sonde>.hdr` und eine
   Liste `public/hangar/hall/revelyork-single.probes.json`:
   `{ "probes": [{ "name": "…", "pos": [x,y,z], "box": [hx,hy,hz],
   "spec": "<sonde>.hdr", "diff": "<sonde>_diff.hdr", "priority": n }] }`.
4. Selbstauskunft: Anzahl Sonden, Größe je Karte, mittlere Helligkeit je
   Karte (soll > 0 und nicht einfarbig sein).
5. Größe gesamt möglichst ≤ 4 MB.
6. Build + Gate (normal und STAGING=1), committen, pushen. Kein PR: Den
   Viewer (Sonde statt selbst gerenderter Umgebungskugel) und die
   Sichtprüfung macht die Cloud.
7. Findet sich keine Sonde, oder lässt sich die Würfelkarte nicht dekodieren:
   genau sagen, was gefunden wurde (Entity-Typen, Dateipfade, Format), und
   nichts nachbauen. Teil A bleibt davon unberührt gepusht.

## Teil C: nur Auskunft (nach Teil B, dieselbe Sitzung, nichts bauen)

Hintergrund (2026-10-08): Krisz fand die Wandtexturen „sehr repetitiv“.
Ursache: Die Schmutzkarte von `plastic_white01_06` (größte Fläche) kachelt
alle 4 m, zweimal je 8-m-Wandpaneel, also stehen auf jedem Paneel dieselben
Flecken. Der Viewer tastet sie jetzt je Stelle anders versetzt ab (Cloud,
erledigt). Ob das Spiel die Paneele selbst noch unterscheidet, sieht die
Cloud nicht: Der Build verwirft die Vertexfarben (`COLOR_0`), und die `.mtl`
liegen nur im Cache des PCs.

Bitte nur melden, nichts ändern oder pushen:

1. `COLOR_0` im Rohexport `.cache/hangar-src/hall/revelyork-single.glb`:
   für die zehn größten Materialien (nach Dreiecken) je Kanal R, G, B, A
   Minimum, Maximum und Mittel, dazu der Anteil der Vertices mit A < 0,98
   und der Anteil mit min(R, G, B) < 0,98 (mindestens ein Farbkanal
   darunter). Als Tabelle in die Rückmeldung.
2. Aus den `.mtl` unter `.cache/hangar-src/hall-raw/` für dieselben
   Materialien je eine Zeile: `Shader`, `StringGenMask`, jede
   `<Texture Map=… File=…>` mit ihrem `TexMod` (TileU, TileV, TexGenType)
   und die `PublicParams`.
3. Die Entity-Typen im socpak der Halle mit Anzahl (etwa Decal, Light,
   EnvironmentProbe): Gibt es Abziehbilder (Schmutz, Schlieren, Schilder) als
   eigene Objekte, die der Export nicht mitnimmt?
