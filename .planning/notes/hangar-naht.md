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

### Was verify:hangar für die Szene prüft

Zusicherung 1 vergleicht Dock, `#hg-stage.models` und beide Buchtordner und
prüft die Form der `StageConfig`. Zusicherung 7 prüft, dass der ausgelieferte
Viewer `project`, `focus` und `onFrame` liefert. Zusicherung 8 prüft die
Import-Map vor dem ersten Modul-Skript. Eine rote Zeile nennt diese Notiz.