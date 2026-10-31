# Auflösungs-Durchgang, 30.08.2026

Ein Messlauf über **44 Seiten × 10 Auflösungen** (320×568 bis 1920×1080,
inklusive der flachen Fenster 1024×768 und 1181×560), danach Reparatur,
danach derselbe Messlauf noch einmal. Werkzeug:
[`.planning/sketches/tools/audit-responsive.mjs`](../sketches/tools/audit-responsive.mjs)
gegen `dist/`, Bericht mit `report-responsive.mjs`.

## Was gemessen wurde

| Größe | vorher | nachher |
|---|---|---|
| Messungen mit waagerechtem Überlauf (von 440) | 25 auf 8 Seiten | **0** |
| Liste der Verursacher-Elemente | 30 Einträge (gekappt) | **leer** |
| Zu kleine Bedienziele (< 40 px, mobil) | 3 569¹ | 2 487² |
| Klebende Leisten / Raumfresser | 26 | 12³ |
| Textstellen unter 11,5 px, **nur 390×844** | 21 327 | 3⁴ |

¹ enthielt ~1 800 Fehlalarme: der erste Messer kannte den Kniff
`::after{inset:0}` nicht, mit dem eine ganze Karte zur Hitfläche wird
(`.fcard__name a`, `.icard__t a`, `.uif-card-link`). Der Messer wurde
korrigiert, **bevor** repariert wurde — sonst wären 1 800 Nicht-Probleme
„behoben" worden.
² der Rest sind benannte Ausnahmen, siehe `assets/mobile-ux.css` Abschnitt 2c
(zu kurzes Wort statt zu kleinem Ziel, Beschriftungen über 44-px-Feldern,
dichte Raster).
³ davon 6 × dieselbe Filterleiste (siehe Register 60) und 6 × ein
dekoratives Wandblech, das absichtlich über den Rand steht — nachgemessen
mit `probe-abschnitt.mjs`: nichts Bedienbares ist abgeschnitten.
⁴ Der Vorher-Wert stammt aus dem ersten Probelauf über EINE Auflösung
(390×844); über alle sechs Mobilauflösungen zusammen sind es nachher 16.
Die Reste sind `em`-/`%`-basierte Größen, die nicht an der Skala hängen
(`.uif-chip-n`, `h1 .thin`). **Am Schreibtisch bleibt alles wie es war**:
bei 1280×720 stehen unverändert 21 785 solcher Stellen — der Boden gilt
ausdrücklich nur unter 821 px.

## Die fünf Ursachen

1. **Spaltenrezepte, die nicht schrumpfen können.**
   `repeat(auto-fit, minmax(320px, 1fr))` liest sich wie „mindestens
   320 px, sonst umbrechen" — ist es aber nicht: `auto-fit` bricht nur die
   *Anzahl* der Spalten um. Bleibt eine übrig, ist sie weiter 320 px breit,
   auch in einem 284 px breiten Kasten. **87 Rezepte in 43 Dateien** auf
   `minmax(min(…,100%), 1fr)` umgestellt. Neues Tor: `verify:responsive`.

2. **Rasterzellen und Flex-Kinder mit `min-width:auto`.**
   Dieselbe Sache eine Ebene tiefer: eine Zelle kann nicht schmaler werden
   als ihr längstes unteilbares Wort. Auf `/topics/crafting.html` blieben
   dadurch **alle 1 596 Karten** 311 px breit in einem 284-px-Kasten.
   Behoben in `.cdb-layout > *`, `.cbp`, `.cbp__cat`.

3. **Eigenständige Seiten unter `public/`.** Die beiden One-Pager gehen an
   Astro und an `assets/mobile-ux.css` vorbei und hatten genau eine
   Medienabfrage (1024 px). Bei 390 px ragte ihre `h1` mit 6 rem **268 px**
   über den Rand. Eigener Mobilblock ergänzt; das neue Tor erzwingt ihn.

4. **Klebende Leisten ohne eigenen Bildlaufkasten.** `assets/mobile-ux.css`
   5d gibt Ergebnislisten erst **ab 821 px** einen eigenen Bildlaufkasten.
   Darunter klebten drei Leisten trotzdem: `.mx__bar` (Missionen, 396 px =
   39 % bei 768×1024), `.cdb-bar` (Crafting, 305 px = 54 % bei 320 px),
   `.tools` (Downloads, 310 px = 55 %). Alle drei kleben jetzt an
   derselben Grenze wie der Kasten: 821 px.
   Der schwerste Fall war die Sprungleiste auf `/armor-sets.html` — sie
   brach um und war bei 320 px **1 044 px hoch = 184 % des Fensters**,
   klebend. Sie läuft jetzt unter 1181 px (und auf flachen Fenstern) in
   einer Zeile und wird seitwärts gewischt.

5. **Die drei untersten Schriftgrade.** `--fs-1/2/3` (9,9 / 10,8 / 11,7 px)
   tragen sämtliche Mikro-Versalien der Datenkarten. Unter 821 px haben
   sie jetzt einen gemeinsamen Boden von **12,6 px** — dem Wert der
   nächsten Stufe, damit die Skala monoton bleibt. Das macht tausende
   Etiketten bis zu 17 % breiter; genau deshalb wurde nach der Änderung
   noch einmal auf Überlauf gemessen (Ergebnis: 0).

Dazu die kleineren Punkte: `100vh` → `dvh`/`svh` dort, wo ein Kasten sich
auf das Fenster rechnet (Werkbank, Fracturing-Rechner, Scrollytelling);
`flex-wrap` für zwei Kopfzeilen mit `nowrap`-Zusatz; neun Bedienelemente
auf 44 px gebracht (`assets/mobile-ux.css` 2c).

## Tiefenprüfung (30.08.2026, direkt im Anschluss)

Der erste Durchgang hat **44** Seiten gemessen. Die Nachprüfung ging auf
**784** Seiten (alle Top-Level-Seiten EN+DE, alle Patches, alle Themen, alle
Konto- und Download-Seiten, dazu je ~150 Stichproben aus Schiffen, Items,
Blueprints und Missionen) und hat zusätzlich Zustände gemessen, die eine
ruhende Messung nie sieht.

### Was die Breite gefunden hat

Die 44-Seiten-Stichprobe hatte sieben Abschneide-Muster nicht berührt — alle
bei **320 px**, die meisten auf **deutschen** Seiten, weil die längeren
Komposita die Mindestbreite hochtreiben:

| Stelle | über dem Rand | Seiten |
|---|---|---|
| `.dp-chip` (`white-space:nowrap`) | **67 px** | 23 Item-Seiten |
| `.as-parts li` / `.as-rar--excl` | 48 px | /de/armor-sets |
| `.sec-head h2` | 40 px | 2 DE-Themenseiten |
| `.cdb-sync` | 19 px | /de/topics/crafting |
| `.qpanel`-Innenzeilen | 12 px | /de/patches/sc-4-10-0 |
| `.split__media` / `.split__text` | 12 px | /de/topics/4-5-0-engineering |
| `.do__feat` | 7 px | 7 Patch-Seiten, beide Sprachen |

Ursache ist überall dieselbe wie oben unter (2): ein Raster- oder Flex-Kind
trägt `min-width:auto`. Alle sieben sind an ihrer Quelle behoben.

### Was die Tiefe gefunden hat

- **Eine Sprachfassung war vergessen.** `.tools { position: static }` stand
  nur in `src/pages/downloads.astro`, nicht in `de/downloads.astro` — die
  beiden Seiten tragen ihr CSS getrennt. `verify:sync` prüft die Gerüstform,
  nicht das CSS, und konnte das nicht sehen. Danach wurden alle **16**
  EN/DE-Seitenpaare auf gleiche Medienabfragen und gleiche Zahl klebender
  Elemente geprüft: deckungsgleich.
- **Die Sprungleiste war bei 1280×720 immer noch vierzeilig** (226 px =
  31 % des Fensters). Die Höhengrenze stand auf 700 px und verfehlte damit
  den häufigsten Laptop. Jetzt 800 px — dieselbe Zahl wie beim Hero der
  Missionsseite; gemessen 226 → 74 px.
- **Ein Sprunglink führte ins Verdeckte.** Auf `/armor-sets.html` landete das
  Ziel nach dem Klick auf 126 px, während die klebende Kante bei 226 px lag —
  die Überschrift stand 100 px UNTER der Leiste, auf die man geklickt hatte.
  Nur dort, wo die Leiste umbricht (ab 1181 px Breite und über 800 px Höhe);
  bei 320…1180 px war dieselbe Messung mit 30…69 px Luft sauber.
- **Die Rechtstexte standen hinter der Kopfleiste.** `.lg-wrap` polsterte
  3,2 rem = 57,6 px, die feste Leiste ist 61 px (Schreibtisch), 69 px
  (Telefon) und **86 px bei 768 px Breite**. Die `h1` von `/impressum` und
  `/datenschutz` lag dort 20 px hinter der Leiste — in beiden Sprachen.
- **Ausgefahrene Zustände gemessen** (Filter-Schublade und Planer der
  Crafting-Seite, Menü-Deck, Suchschicht, Item-Modal) bei 320 und 390 px:
  alle passen aufs Pixel ins Fenster, alle scrollen innen, der
  Schließen-Knopf ist überall 44×44 px und im Bild.
- **Gegen das Artefakt geprüft** (Grundsatz 7): `dist/` enthält **6561**
  Spaltenrezepte, davon **0** starre.

### Ein Messfehler, gefunden bevor er Schaden anrichtete

⚠⚠ **Ein geschlossenes `<details>` liefert für seinen Inhalt weiterhin einen
Kasten mit Größe.** Gemessen an `.cdb-subs` der Crafting-Filterspalte:
167 px hoch, `getBoundingClientRect()` sagt „da ist etwas", gezeichnet wird
nichts. Der Messer meldete daraufhin Phantom-Verdeckungen von
Filter-Kästchen, die es gar nicht gibt. `Element.checkVisibility()` kennt
den Unterschied, `getComputedStyle` nicht — beide Messwerkzeuge haben die
Zeile jetzt. Ohne sie wären hier Regeln gegen ein Problem geschrieben
worden, das keines ist. Dasselbe gilt für die zwei „Seite scrollt nicht"-
Befunde des ersten Durchgangs: nachgemessen war beides Dekoration
(`.wb__wall`) und die Sperre auf `/topics/mining.html` ist gewollt.

### Gegenmessung nach der Reparatur

| Lauf | Messungen | Überlauf | überstehend |
|---|---|---|---|
| 156 Seiten (alle 35 mit Befund + jede 6. der 784) × 320/390/768 | 468 | **0** | **0** |
| 79 Seiten × 280×653, 360×640, 430×932, **844×390** (Telefon quer), 1024×600, 1366×768, 2560×1440, 640×600 (200 % Zoom) | 632 → 316 nach Nachbesserung | **0** | **0** |

Die exotische Runde fand noch drei Stellen — alle bei **280 px**, dem
Außenschirm eines Fold (dieselbe CSS-Breite entsteht bei 320 px mit 114 %
Browserzoom): `.do__chip` 26 px, `.cdb-tabs` 25 px, `.dp-sec h2 .dp-muted`
16 px. Alle drei sind behoben; die Nachmessung ist sauber.

`npm run build && npm run gate` grün, zusätzlich mit `STAGING=1` grün
(24 von 24 Schritten).

### Das Tor deckt jetzt mehr ab

`verify:responsive` sucht Spaltenrezepte nun auch in `.js`/`.mjs`/`.ts` und
in den eigenständigen Seiten unter `public/` — beide Wege können CSS in die
Seite schreiben, beide waren blind. Vorgeführt rot in genau diesen zwei
neuen Zweigen, danach wieder grün.

## Was NICHT entschieden wurde

Drei Punkte liegen als Gestaltungs- bzw. Produktentscheidung im Register
`.planning/WINDOWS.md` (id 60, 61, 62):

- **60** — Hero-Höhe auf vier Werkzeugseiten: bei 1280×720 steht die erste
  Bedienung auf `/precision-jump.html` bei 611 px (85 %), `/evolution.html`
  626 px (87 %), `/schiffe.html` 545 px (76 %), `/refinery.html` 440 px
  (61 %). Für `/missionen.html` wurde die Hausregel „Werkzeug, keine
  Leinwand" in diesem Durchgang nachgezogen (928 px → ~410 px).
- **61** — Katalogseiten sind am Telefon 175 000 bis 450 000 px lang.
  Eine Blätterung berührt die mobile-first-Indexierung.
- **62** — Die Erstbesuch-Hilfe klappt auf jedem Fenster auf; auf flachen
  Fenstern kostet sie den Arbeitsplatz.

## Nachmessen

```bash
npm i --no-save playwright-core
node .planning/sketches/tools/audit-responsive.mjs
node .planning/sketches/tools/report-responsive.mjs
```

Seitenliste in `.planning/sketches/tools/out/pages.json`, Auflösungsliste
über `VP_LIST=…` überschreibbar.

Für die Tiefenprüfung:

```bash
PAGES_FILE=pages-massiv.json VP_LIST=320x568,390x844 HIT_CAP=0 \
  node .planning/sketches/tools/audit-deep.mjs
node .planning/sketches/tools/probe-zustaende.mjs 320x568,390x844
```

`audit-deep.mjs` misst zusätzlich per `elementFromPoint`, ob die Mitte eines
Bedienelements wirklich dieses Element trifft (`HIT_CAP=0` schaltet das ab
und misst nur Überlauf — dann läuft es über 784 Seiten in vertretbarer
Zeit). `probe-zustaende.mjs` fährt Schubladen, Menü, Suche und Modal aus und
misst sie. `probe-hero.mjs` misst „wie viel Fenster ist weg, bevor die
Bedienung anfängt", `probe-sprung.mjs` klickt eine Sprungmarke und sagt, ob
das Ziel unter den klebenden Leisten landet, `probe-ursache.mjs` nennt zu
einem überstehenden Kasten die Mindestbreite der Kette darunter,
`probe-abschnitt.mjs` sagt, ob ein Element wirklich abgeschnitten ist oder
nur in einem Bildlaufkasten steckt, `probe-el.mjs` gibt Kastenwerte einzelner
Selektoren, `shoot.mjs` macht Aufnahmen (läuft vorher die Seite herunter,
sonst zeigt eine Vollseiten-Aufnahme die `.reveal`-Blöcke als leere Fläche;
`NO_PRESCROLL=1` schaltet das ab, `SCROLL_TO=<px>` springt an eine Stelle).

⚠ Unter Git-Bash braucht jeder Aufruf mit einem `"/pfad@390x844"`-Argument
ein vorangestelltes `MSYS_NO_PATHCONV=1`, sonst wird der Pfad in einen
Windows-Pfad übersetzt.
