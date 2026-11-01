# Hangar: alle Schiffe mit echten Texturen (2026-10-25)

Auslöser für die PC-Sitzung: **„Hangar-Alle“**. Derselbe Satz noch einmal
setzt den Lauf fort, wo er stand.

Anlass, Krisz 2026-10-25 09:29: „hol mal alle texturen, geometrien,
interior, materialien, alles was du holen kannst damit wir alle schiffe so
realistisch wie möglich nachstellen könnnen. aber diesmal wirklich ich will
zum 4. mal oder so die scheisse machen und nie wirds gemacht“. Dazu
24.10.2026 13:24: „mach dann so dass alle schiffe korrekt auf dem boden
stehen mit deren landinggear“.

Ziel: Jedes Schiff im Hangar auf staging zeigt die Fassung mit den echten
Texturen und Materialien aus dem Spiel, steht auf seinem Fahrwerk, und der
Lauf endet erst, wenn alle gebaut sind. Kein Probelauf, kein Halt für eine
Speicherfrage: die ist unten entschieden. Ersetzt Teil C von
[`hangar-flotte.md`](hangar-flotte.md) und „Hangar-Schichten“.

Es gelten die Regeln aus [`hangar-katalog.md`](hangar-katalog.md): alles aus
dem Spiel, keine Roh-Exporte, kein `.mtl`-XML und keine Rohtexturen im Repo
(das Repo ist öffentlich). Rohdaten bleiben im gitignorierten Cache.

## Was schon da ist

- **Rohbestand** (nicht neu holen): 225 der 231 Hangar-Schiffe in
  `.cache/hangar-src/ships/` (4.10.2, LOD 1, mip 1, `--materials all`, mit
  Innenraum, 54,6 GB), dazu der zerlegte Export `ships-dec/` mit Lacken,
  Paletten und allen Untermaterialien. Siehe [`schiffe-komplett.md`](schiffe-komplett.md).
- **Fahrwerk**: `gear.<slug>` im Manifest und die Geometrie-Fassungen
  `public/hangar/geo/` (225, ausgefahren und eingefedert), seit PR #207 auf
  staging. Die Pose rechnet `scripts/build-hangar-gear.mjs`.
- **Werkslack**: zehn Web-Schiffe in `public/hangar/ships/`. Alle übrigen
  zeigen bis jetzt nur die Geometrie-Fassung ohne Texturen.
- **Gemeinsame Bildablage** (Cloud, 25.10.2026): Viele Bilder sind in jedem
  Schiff dieselben (Schichten, Decals, Lackkanäle). `scripts/build-hangar-assets.mjs`
  legt seit heute jedes Bild eines Schiffs als `public/hangar/tex/<sha256, 16
  Zeichen>.webp` ab und lässt im GLB nur den Verweis `../tex/<datei>`
  (`scripts/lib/glb-texpool.mjs`); Bilder, auf die kein Schiff mehr zeigt,
  entfernt der Bau. Verlustfrei, der Viewer lädt sie wie bisher, Tor
  `verify:hangar` [17]. Gemessen an den zehn: 134,7 MB wurden 83,0 MB
  (GLB 32,9 MB + Ablage 50,1 MB); nach dem ersten Schiff brachte jedes
  weitere nur 2,3 bis 5,8 MB neue Bilder.

## Speicher: entschieden. Nutzungsrechte: offen, Frage an Krisz

Die Schiffe kommen ins Repo und werden wie bisher hinter dem Testpilot-Tor
ausgeliefert (D-06). Eine fremde Ablage (R2, CDN) läge außerhalb des Tors,
und über die Nutzung der Spielinhalte hat Krisz noch nicht entschieden.
Entschieden ist hier NUR der Ablageort, nicht die Rechtefrage; die gehört dem
Betreiber. Nachtrag 31.10.2026: er hat sie für die Auslieferung beantwortet —
der Hangar bleibt aus dem Live-Bau draußen, solange sie offen ist
(`scripts/lib/hangar-switch.mjs`).
Deckel für Schiffe und Ablage zusammen: **1,6 GB** (Tor [17] reißt
darüber), Ziel **1,3 GB**. Je Datei höchstens 50 MB (GitHub).

## Auftrag PC

0. Branch `pc/hangar-alle` von `origin/staging`. Fehlt dort
   `scripts/lib/glb-texpool.mjs`, zuerst `origin/claude/wot-hangar-hzs46w`
   einmischen. Vor jedem Push `npm run build && npm run gate`, ohne PR; die
   Cloud merged. Push nach je rund 25 Schiffen, damit ein abgebrochener Lauf
   nichts verliert; der Stand je Schiff steht in
   `.cache/hangar-src/alle-stand.json`, derselbe Satz setzt dort fort.
   Ohne Gegenansage von Teil zu Teil weiter, ohne Halt zwischen den Stapeln.

### Teil A: die sechs ohne Rohexport

1. Idris M, Idris P, Ironclad, Ironclad Assault, Perseus (über der
   Speichergrenze von 24 GB je Export) und Constellation Mk V Centaurus:
   Außenhülle ohne Innenraum neu holen, notfalls mit `--lod 2` oder
   `--mip 2`; bei der Centaurus den Record mit `_GS`-Vorrang wie
   `scripts/lib/vehicle-records.mjs` suchen. Danach für sie Fahrwerk und
   Geometrie-Fassung wie in `build-hangar-gear.mjs`. Geht eines nicht, Grund
   und Meldung in den Befund und weiter.

### Teil B: alle Web-Schiffe

2. Für jedes Schiff aus dem Rohbestand die Web-Fassung, auf demselben Weg
   wie die zehn (Werkslack, Lackkanäle, Lack-Bauplan, Tauschteile, Ablage):
   `node scripts/build-hangar-assets.mjs --kind ships --ships <slug,…>` je
   Stapel, am Ende alle im Manifest unter `ships`.
3. **Fahrwerk**: Beine ausgefahren und eingefedert wie in der
   Geometrie-Fassung (dieselbe Pose wie `build-hangar-gear.mjs`, nicht neu
   erfinden). Stimmen die Aufstandspunkte der Webdatei auf 2 cm mit
   `gear.<slug>.contacts`, `ships.<slug>.gear = true` setzen; dann stellt
   die Seite den Werkslack aufs Fahrwerk, und `verify:hangar-gear` misst
   die Webdatei mit. Sonst bleibt `gear` weg, mit Grund im Befund.
4. **Bewegliche Teile in Landestellung** (32 Schiffe, Liste
   `gear.<slug>.below`: Polaris-Flossen, Redeemer `thruster_bar`, 300i-Reihe
   `lg_hinge_front_left`, Sabre `foot_flap_a` …): wo das Spiel dafür eine
   Lande-Animation hat (Fragment Deploy), ihr letztes Bild anwenden, in
   Web- und Geometrie-Fassung gleich, dann `gear` für sie neu. Ebenso die
   schwebenden Füße und die losen Knoten im Kreis aus „Für den nächsten
   Lauf“ in `hangar-flotte.md`.
5. **Innenraum**: Die Container `interior_*` bleiben, wenn Rumpf und
   Innenraum roh höchstens das 1,5-fache des Dreiecksbudgets haben (dann
   kostet die Dezimierung den Rumpf kaum etwas), außerdem immer bei den
   Schiffen in `KEEP_INTERIOR`. Sonst fallen sie (`interiorDropped`); der
   Rohbestand behält sie für eine spätere Innenansicht.
6. **Budget je Schiff**: 200 000 Dreiecke (ab 60 m Länge 400 000), Farbe
   und Leuchten 1024 px, übrige Karten 512 px. GLB plus neu in der Ablage
   höchstens 16 MB. Darüber in dieser Folge: Innenraum weg, eigene
   Farbkarten des Schiffs auf 512 px, WebP-Qualität 72. Die Größe nennen.
7. **Gesamt**: Nach den ersten 25 neuen Schiffen die Summe für alle
   hochrechnen. Liegt sie über 1,3 GB, zuerst die großen Schiffe kleiner
   (Farbe 512 px), nicht die kleinen. Über 1,6 GB reißt das Tor.
8. **Reihenfolge**: die zehn, die es schon gibt (jetzt mit Fahrwerk), dann
   Corsair, Zeus ES, Prospector, Sabre, Intrepid, Vulture, Pisces
   Expedition, 400i, Carrack, Polaris, dann nach Länge aufsteigend,
   Bodenfahrzeuge zuletzt.
9. `HOLD` in `HangarApp.astro` (Freelancer, Constellation Andromeda) bleibt,
   wie es ist. Die Lackfrage aus WINDOWS 112 (Glanz) bleibt offen; gebaut
   wird wie bisher.

### Teil C: Prüfen vor jedem Push

10. `npm run build && npm run gate`; am Ende einmal mit `STAGING=1`.
11. `npm run check:hangar-shader -- --base <Vorschau> --ship <slug>` mit
    zwei bis drei Schiffen je Stapel, die größten zuerst: höchstens 16
    Texturen je Bildshader, sonst bleibt ein Material in Chrome unter
    Windows unsichtbar.

### Selbstauskunft

12. Die übliche Kopfzeile. Je Stapel: Schiffe gebaut, Bytes GLB und neu in
    der Ablage, Dreiecke, Bilder, Innenraum behalten oder entfernt,
    `gear: true` ja oder nein (mit Grund), höchste Zahl Karten je Material,
    Zeit je Schiff. Am Ende: Summe GLB + Ablage, Zahl der Schiffe mit
    Werkslack, Fehler mit Schiff und Meldung.

## Cloud danach

Nach jedem Push: `pc/hangar-alle` nach staging bringen, die Klinke
„Schiffe mit Bildablage“ in `verify:hangar` [17] auf den neuen Stand heben,
Stichproben im Hangar ansehen (klein, mittel, groß, Bodenfahrzeug) und den
Stand mit `check:staging` an der ausgelieferten Seite prüfen.

## Was dieser Lauf nicht macht

- Keine begehbaren Innenräume: Der Innenraum ist nur zu sehen, wo er von
  außen sichtbar ist (Cockpit, offene Rampe). Die Rohdaten dafür liegen auf
  dem PC.
- Lacke mit Muster (Stencil, Decals) zeichnet der Viewer noch nicht; die
  Lackliste färbt die Grundfarben um wie bisher.
- Texturen höchstens 1024 px; das Spiel hat bis 4096 px. Mehr ginge nur mit
  einer Ablage außerhalb des Repos.
- Das Auslieferungs-Image wird um rund 1,2 GB größer; jedes Deploy lädt
  entsprechend länger.

## Befund PC

PC-Lauf 25.10.2026, Branch `pc/hangar-alle` (Stapel 1 bis 7). Stand je
Schiff in `.cache/hangar-src/alle-stand.json`, Treiber
`scripts/build-hangar-alle.mjs` (setzt dort fort, `--only`, `--redo`).

**Ergebnis: alle 231 Web-Schiffe gebaut, 0 Fehler.** Tor [17]: GLB 730,0 MB
+ Ablage 5703 Dateien 209,7 MB = **939,7 MB** (Ziel 1,3 GB, Deckel 1,6 GB).
Größte Datei: Polaris-GLB 12,8 MB. Klinke „Schiffe mit Bildablage“ kann auf 231.

### Teil A

Alle sechs exportiert, jeweils im dritten Versuch (ohne Innenraum, mip 2;
mit Innenraum über 24 GB Speicher), den neuen vierten (lod 2) brauchte
keins: Centaurus 214 MB, Perseus 287 MB, Ironclad 243 MB, Ironclad Assault
247 MB, Idris M 181 MB, Idris P 176 MB (roh). Fahrwerk und Geometrie-Fassung
gerechnet: Idris M/P, Centaurus, Perseus „aus“; Ironclad und Assault „ein“
(Animation des Fahrwerks fehlt im Spiel unter dem erwarteten Pfad).

### Teil B

- Fahrwerk im Web-Bau: `scripts/lib/landing-gear.mjs` (aus
  `build-hangar-gear.mjs` gelöst, an acht Schiffen gleiche Ergebnisse wie
  vorher). `build-hangar-assets.mjs` stellt jedes Schiff vor allem anderen in
  dieselbe Pose und prüft die geschriebene Datei: je Aufstandspunkt die
  tiefste Ecke im Umkreis 0,6 m auf 2 cm, dazu nichts tiefer als 20 cm unter
  der Ebene (wie `verify:hangar-gear` [3]).
- **`gear: true` bei 129 von 231.** Ohne: 44 ohne Landesystem (alle
  Bodenfahrzeuge, Pulse, Nox, X1, Fury, Scout, Scythe, Javelin …), 21 mit
  eingefahrenem Fahrwerk (Hawk, Eclipse, Reclaimer, 890 Jump, Mole, Moth,
  Railen, Syulen, San'tok.yāi, Ironclad …), 31 mit Aufstandspunkten über 2 cm
  daneben (Constellation-Familie 2,1 m, Starfarer 3,4 m, Caterpillar 3,6 m,
  Prowler 5,2 m, Paladin 4,8 m, Sabre-Varianten 1,56 m, Guardian 0,76 bis
  0,96 m; knapp: Freelancer MAX 2,3 cm, Vanguard Sentinel 2,2 cm, Polaris
  3,1 cm nach der starken Dezimierung), 3 mit nur zwei Aufstandspunkten
  (Buccaneer, Mantis, Meteor), 3 mit einem Teil 39 cm im Boden (Apollo
  Medivac/Triage, Hermes: die Web-Fassung behält Teile, die die
  Geometrie-Fassung weglässt).
- Teile in Landestellung bewegen (Deploy-Animationen jenseits der Beine):
  nicht gemacht. Diese Schiffe stehen wie bisher auf ihrem tiefsten Punkt.
- Innenraum behalten bei 101, entfernt bei 130.
- Stufen gegen 16 MB: 224 auf Stufe 0. Mehr brauchten Polaris, Perseus,
  Ironclad, Ironclad Assault (Stufe 5), Idris M, Centaurus (4) und Idris P (3).
  Die vier Stufen des Auftrags reichten bei der Polaris nicht (29 MB),
  deshalb zwei weitere: `HANGAR_SHIP_ERR` (Schwelle bis 8 %, ab 2 % Ränder
  frei) und Karten 256 px. **Polaris bleibt bei 16,6 MB** (1,09 Mio.
  Dreiecke), alle anderen unter 16 MB.
- Dreiecke je Schiff 29 554 bis 1 199 062, zusammen 75,3 Mio. Die
  Ladder-Grenze von 1 % hält große Schiffe über dem Budget (so gewollt seit
  dem C2). Bilder je Schiff 29 bis 433, Zeit je Schiff 4 bis 450 s,
  zusammen 92 min.
- Reihenfolge: Die Gravlev-Räder zählen wie in `HangarApp.astro` zu den
  Bodenfahrzeugen. Pulse, Nox, X1, Dragonfly und HoverQuad liefen noch im
  ersten Stapel nach Länge.

### Teil C

Jeder Stapel: `build` und `gate` grün, `check:hangar-shader` an 2 bis 3
Schiffen. Geprüft: Carrack, Corsair, Polaris, Basher, M80, Blade, Alpha Wolf,
Guardian MX, Defender, Stinger, Paladin, Idris M, Caterpillar, Perseus,
Storm AA, Idris P, alle mit höchstens 16 Texturen je Bildshader. Am Ende
einmal mit `STAGING=1`. Dabei behoben: `verify:hangar-gear` sprengte mit über
einer Million Ecken (Polaris) den Aufrufstapel; M80 und Salvation trugen
Knoten im Kreis (der Bau entfernt jetzt alles, was die Szene nicht erreicht).
`check:hangar-shader` braucht einen Server ohne Clean-URL-Umleitung (`serve`
wirft sonst `?ship=` weg und zeigt die Gladius).

### Fürs Hinsehen

- Corsair, Polaris und Blade sind im Hangar fast schwarz glänzend: Ihre
  Hüllmaterialien tragen Grundfarben von 0,02 bis 0,04. Bei der Blade
  passt das zum Spiel, bei der Polaris nicht. Das ist dieselbe Frage wie
  WINDOWS 112 (Glanz) und der HOLD der Freelancer; gebaut wie bisher.
  Stimmig sehen aus: Carrack, Basher, Defender, Paladin, Storm AA.
- Die Idris wirkt im Bild klein; die Kamera rahmt das ganze Schiff.
