# Hangar: Naht zwischen Szene und Oberfläche (2026-10-07)

Absprache zwischen der Szenen-Arbeit (Halle, Schiffsmodelle, Licht, Crew in
`assets/hangar-viewer.js`) und der Oberfläche um die Szene (Schiffswahl,
Waffen, Systeme, Fracht, Vergleich, Flotte in `src/components/hangar/`).

## Was die Szene der Oberfläche zusagt

`initHangar()` liefert zusätzlich zu `show/setLivery/resetView/onProgress/dispose`:

| Methode | Vertrag |
| --- | --- |
| `project(points, out?)` | `points` = `[[x, y, z], …]` im Modellraum der geladenen `.glb` (glTF-Achsen, Meter). Liefert je Punkt `{ x, y, d }` in CSS-Pixeln relativ zum Container, `d` = Abstand zur Kamera in Metern, oder `null`, solange kein Schiff sichtbar ist oder der Punkt hinter der Kamera liegt. |
| `focus(point)` | Kamerafahrt auf den Punkt (gleicher Raum), Abstand ~0,6 × Spannweite. `focus(null)` = zurück in die Startansicht dieses Schiffs. |
| `onFrame(fn)` | `fn()` läuft nach jedem gezeichneten Bild, nur solange die Bühne sichtbar ist. Ein Aufruf ersetzt den vorigen. |

Der Raum ist derselbe wie `src/data/ship-hardpoints.json` nach der Achstausch
`(x, z, -y)` (CryEngine → glTF), für `/holo/*.glb` UND `/hangar/ships/*.glb`.
Gemessen am 07.10.: Gladius x ±8,69, Cutlass Black x ±13,06 und z −14,81…20,9,
300i deckungsgleich, C2 z deckungsgleich (x breiter durch Anbauten).

## Was die Szene dafür einhalten muss

- `current.model` bleibt das geladene `gltf.scene`, unter Drehung, Zentrierung
  und Ein-/Ausfahrt. Wer die Gruppen umbaut, lässt `project` weiter über
  `current.model.matrixWorld` rechnen.
- `homeTgt` hält das Blickziel der Startansicht; `resetView()` fliegt dorthin
  (nach `focus()` steht das Ziel sonst auf einem Hardpoint).
- `onFrame` wird NACH dem Zeichnen aufgerufen, damit die Weltmatrizen frisch sind.

## Was die Oberfläche nicht tut

Sie greift nicht in Szene, Licht, Modelle oder Kamera ein, außer über
`focus()` und `resetView()`. Marker sind HTML-Elemente über der Leinwand,
nicht Teil der Szene.

## Seitenvertrag seit dem Schnitt

`HangarApp.astro` ist seitdem nur die Szene. Die Oberfläche um sie herum steht
in `HangarPage.astro`; beide Seitenhüllen (`src/pages/hangar.astro`,
`src/pages/de/hangar.astro`) rendern `HangarPage.astro`.

| Sitzung | Dateien |
| --- | --- |
| Szene | `assets/hangar-viewer.js`, `src/components/hangar/HangarApp.astro`, `src/data/hangar-assets.json`, `public/hangar/**`, `scripts/extract-hangar-sources.mjs`, `scripts/build-hangar-assets.mjs` |
| Oberfläche | `src/components/hangar/HangarPage.astro`, `ShipBay.astro`, `BayDocument.astro`, `src/lib/hangar/*.ts`, `src/i18n/hangarText.ts`, `src/pages/hangar-bay/[id].astro` mit DE-Zwilling, `scripts/verify-hangar.mjs` |

### Was die Szene bereitstellt

1. `section.hg-stage[data-hg-stage]` mit `#hg-canvas`, `#hg-load` (Balken
   `<b><i>`, Breite über `--p`), `#hg-fallback` und danach einem `<slot />`.
   Die Oberfläche legt Titel, Werkzeuge und später die Marker in diesen Slot.
   Sie liegen damit im selben Kasten wie die Leinwand, und `project()`
   braucht keinen Versatz.
2. `<script type="application/json" id="hg-stage">` mit genau einer
   `StageConfig` (`src/lib/hangar/stage.ts`): `viewer` (versionierte URL),
   `opts` (wird unverändert in `initHangar` gespreizt) und
   `models[id] = [glb, Werkslack-glb oder null, Herstellerkürzel]` für jede Id
   aus `HANGAR_IDS`.
3. Die Import-Map für three.js, vor jedem Modul-Skript der Seite.

Die Modellpolitik bleibt in der Szene: `HOLD`, die Werkslack-Fassungen, Halle
und Crew. Eine neue `initHangar`-Option kommt in `opts`; die Oberfläche
reicht sie ungelesen durch. Das CSS der Szene liest die `--hg-*`-Token, die
`HangarPage.astro` auf `.hg-stagewrap` setzt (die dunkle Insel).

Unter 760 px trägt die Leinwand `touch-action: pan-y`. Senkrechtes Wischen
scrollt die Seite, waagerechtes Ziehen dreht das Schiff. Die Regel braucht
`!important`, weil OrbitControls `touch-action: none` als Inline-Stil setzt.

### Was die Oberfläche damit tut

Sie importiert `stage.viewer`, ruft `initHangar(#hg-canvas, { reduceMotion,
...opts })`, zeigt `#hg-load` und setzt `--p` aus `onProgress`, zeigt bei
einem Fehler `#hg-fallback` und lädt Schiffe mit
`show(models[id][0], { maker: models[id][2], tex: models[id][1] })`.

Sobald `initHangar` aufgelöst hat, hängt die Oberfläche die Viewer-API als
`hangarViewer` an `section.hg-stage` und sendet dort das Ereignis
`hangar:viewer` (`detail` = die API). Ein szenenseitiges Skript, etwa ein
künftiger Hallenschalter, hört darauf, statt den Viewer ein zweites Mal zu
importieren. `show`, `focus`, `project` und `onFrame` gehören der Oberfläche.

### Marker und project()

Die Marker sind HTML-Elemente der Bucht-Region `marks` im Slot der Bühne.
Die Oberfläche setzt sie nur, wenn beides zum gewählten Schiff gehört: das
`show()` genau dieser Auswahl ist fertig (ein eigener Zähler, weil ein
überholtes `show()` ebenfalls auflöst) und die eingesetzte Region trägt die
Id dieses Schiffs. `project()` bleibt dafür an kein Schiff gebunden. Bitte
`current` weiter innerhalb von `show()` umschalten, oder der Oberfläche
Bescheid geben.

### focus() seit dem Fokus-Umbau

- Das Ziel entsteht in der Ruhelage: `focus()` setzt die Gruppe kurz auf
  `userData.baseY` und Drehung 0, rechnet den Punkt um und stellt die Lage
  zurück. Während der Einfahrt lag es vorher bis zu 18 % der Spannweite
  daneben (kalter Link auf die Bugkanone des Gladius: 247 px neben der
  Bildmitte).
- Die Blickrichtung läuft von der Schiffsmitte (`homeTgt`) durch den
  Hardpoint, zu 70 % gemischt mit der aktuellen Ansicht, mindestens rund
  10 Grad über dem Boden. Bauchtürme sieht man so von der Seite statt durch
  den Rumpf (C2, `hardpoint_remote_turret_bottom`: vorher hinter der
  Rumpfmitte, jetzt 4 m davor und mittig).
- Vor dem Wechsel auf ein anderes Schiff ruft die Oberfläche `focus(null)`,
  damit die Nahansicht nicht auf das nächste Schiff übergeht.

### Bitte an die Szene: Halle nach dem Schiff

`loadRealHall` setzt `current.group.userData.baseY` auf 0,02, wenn die Halle
nach dem Schiff fertig wird. Ein Schiff, das in der gebauten Halle auf
`0.3 * S + 0.25` stand, sinkt dann unter eine bereits gezielte Kamera.
Gemessen mit verzögertem Hallenabruf: Gladius-Bugkanone 49 px, C2-Bauchturm
27 px neben der Bildmitte; kommt die Halle zuerst, 0 px. Vorschlag: in
`loadRealHall` beim Ändern von `baseY` Kameraziel, Kamera und einen
laufenden Flug um dieselbe Differenz mitverschieben, wenn die Kamera
gezielt steht (`touched`). `focus()` allein kann das nicht, es läuft vor
dem Hallenwechsel.

### Was verify:hangar für die Szene prüft

Zusicherung 1 vergleicht Dock, `#hg-stage.models` und beide Buchtordner und
prüft die Form der `StageConfig`. Zusicherung 7 prüft, dass der ausgelieferte
Viewer `project`, `focus` und `onFrame` liefert. Zusicherung 8 prüft die
Import-Map vor dem ersten Modul-Skript. Eine rote Zeile nennt diese Notiz.