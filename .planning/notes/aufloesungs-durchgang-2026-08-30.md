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
über `VP_LIST=…` überschreibbar. `probe-hero.mjs` misst „wie viel Fenster
ist weg, bevor die Bedienung anfängt", `probe-abschnitt.mjs` sagt, ob ein
Element wirklich abgeschnitten ist oder nur in einem Bildlaufkasten steckt,
`shoot.mjs` macht Aufnahmen (läuft vorher die Seite herunter, sonst zeigt
eine Vollseiten-Aufnahme die `.reveal`-Blöcke als leere Fläche).
