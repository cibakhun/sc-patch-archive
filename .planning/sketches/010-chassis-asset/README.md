---
sketch: 010
name: chassis-asset
question: "Wie kommt die Gehäuse-Vorlage des Betreibers als Rahmen in die Werkbank?"
winner: "angenommen 15.08.2026 — „ja der rahmen trägt so\""
tags: [design, mining, werkbank, gehaeuse, asset]
---

# Skizze 010: Chassis aus der Vorlage

## Design-Frage

Skizzen 008 und 009 haben belegt, dass ein gefrästes Blech aus Code nicht
entsteht — weder aus gestapelten Verläufen noch aus SVG-Filtern. Der Betreiber
hat daraufhin seine eigene Gehäuse-Grafik freigegeben. Die Frage ist damit nicht
mehr „wie sieht der Rahmen aus", sondern **wie er technisch eingebaut wird, ohne
die Zeichnung zu beschädigen.**

## Ansehen

```bash
start .planning/sketches/010-chassis-asset/index.html
```

Die drei Reiter sind **keine Gestaltungsvarianten**, sondern dieselbe Lösung bei
1280 / 1600 / 1920 px — die Frage ist, ab wann die Werkbank genug Fläche hat.

## Der verworfene Weg: 9-Slice (`border-image`)

Der erste Plan war ein 9-Slice-Rahmen: feste Ecken, gedehnte Strecken dazwischen.
Nach dem Vermessen der Vorlage fiel er durch — **`border-image` streckt die
Mitte jeder Kante, und genau dort hat diese Grafik ihre Zeichnung:**

- unten mittig eine Steckerbuchse mit Lüftungsgittern und Erdungssymbol,
- oben mittig ein angewinkelter Griffansatz,
- oben rechts die aufgedruckte Seriennummer.

Bei `stretch` verschmiert die Buchse, bei `repeat`/`round` steht sie mehrfach da.
Man könnte die Störstellen aus dem Rahmen herausretuschieren und separat wieder
darüberlegen — Aufwand und Fehlerquellen für einen Vorteil, den es hier nicht
braucht.

## Der gewählte Weg: eine Grafik mit festem Seitenverhältnis

Das Chassis bleibt **ein Bild**, die Bildfläche ist ein **Prozentkasten** darin:

```css
.chassis { aspect-ratio: 2552 / 1167;
           background: url('chassis-1600.webp') center/100% 100% no-repeat; }
.chassis__screen { position: absolute;
  left: 7.367%; top: 11.225%; width: 88.088%; height: 76.692%; }
```

Nichts verzerrt, die Zeichnung bleibt unangetastet, der Rahmen wächst sauber mit
der Fensterbreite. Der Preis: die Rahmenstärke skaliert mit — bei 1280 px ist
das Blech schmaler als bei 1920. Das ist bei einem *Gerät* aber richtig so.

## Gemessen

| | 1280 breit | 1600 breit | 1920 breit |
|---|---|---|---|
| Chassis | 1280 × 585 | 1600 × 732 | 1920 × 878 |
| Bildfläche | 1128 × 449 | 1409 × 561 | 1691 × 673 |
| Erz-Kacheln sichtbar | 24 / 37 | 32 / 37 | **37 / 37** |
| Austritt aus der Fläche | 0 px | 0 px | 0 px |

**Das ist die entscheidende Zahl:** bei 1280 sind 24 von 37 Kacheln im Bild. Der
Rahmen kostet Fläche, und die Werkbank hat davon nie genug. Bei 1920 passt
alles. Zum Vergleich: der ausgelieferte Stand ohne Rahmen zeigt bei 1280
scrollend ebenfalls nicht alle 37 — der Rahmen macht es also schlechter, aber
nicht kaputt.

## Aufbereitung der Vorlage

Werkzeug: [`../tools/make-chassis.mjs`](../tools/make-chassis.mjs). Es
übermalt, schneidet zu, misst die Bildfläche ein und schreibt WebP in mehreren
Breiten. Für diese Skizze:

```bash
node .planning/sketches/tools/make-chassis.mjs .planning/sketches/010-chassis-asset/chassis-src.jpg assets --crop 290,62,2552,1167 --widths 1600,2400
```

⚠ Die Quelldatei liegt **hier**, nicht in `assets/`: alles unter `assets/` wird
mit ausgeliefert, und die 2,0 MB grosse Vorlage waere dort tote Fracht im
Auslieferungs-Image. Nur die beiden zugeschnittenen WebP (43 / 78 KB) gehoeren
dorthin.

- **Zuschnitt** entfernt Szenen-Hintergrund, Tragegriff und Standfüße. Griff
  raus war eine Entscheidung des Betreibers; die Füße fielen mit dem Schnitt,
  weil sie unter dem Gerät hängen und rund 100 px Höhe gekostet hätten.
- **Dateigröße:** 43 KB (1600) und 78 KB (2400). Deutlich weniger als befürchtet
  — der Wechsel auf die große Fassung passiert erst ab 1,5× Pixeldichte oder
  1700 px Breite.

## Drei Messfehler auf dem Weg, protokolliert

1. **Zuschnitt rechts zu früh.** Die automatische Kantensuche hat auf der
   rechten Seite eine *beleuchtete Konsole im Szenen-Hintergrund* für das Gerät
   gehalten. Erst der Abgleich mit dem gerenderten Ergebnis zeigte den
   abgeschnittenen Rahmen. — Das Gerät sitzt außerdem **nicht mittig** im Bild
   (links 290, rechts 2842 von 3010), was die Symmetrie-Annahme zusätzlich
   entwertet hätte.
2. **Bildflächenmessung lief durch dunkle Einbauten.** Fünf Abtastlinien
   ergaben 36 px Blende rechts gegen 220 px links — der Scan war durch eine
   dunkle Gitterblende *im Gehäuse* hindurchgelaufen. Mit 41 Linien über die
   mittleren 60 % und Median darüber stimmt es.
3. **„Austritt aus der Fläche" maß 206 px, obwohl nichts austrat.** Die Messung
   lief über *alle* Nachfahren — auch über den Inhalt der Bildlauf-Kästen, der
   naturgemäß über deren Rand ragt und dort abgeschnitten wird. Gemessen werden
   darf nur, was wirklich im Fluss der Bildfläche liegt.

## Offen für die Umsetzung

- **Herkunft der Grafik.** Falls KI-generiert: fürs Projekt unproblematisch,
  gehört aber in die Themendatei, damit später niemand rätselt. Die
  Quelldatei `assets/chassis-src.jpg` (2,0 MB) ist bewusst **nicht committet** —
  zu klären, ob sie ins Repo soll oder außerhalb aufbewahrt wird.
- **Hellmodus entfällt** — Entscheidung des Betreibers vom 15.08.2026.
- **Schmale Fenster.** Unter rund 1100 px wird die Bildfläche zu klein für drei
  Spalten. Der Rahmen muss dort entweder entfallen oder die Werkbank auf ein
  anderes Raster wechseln. Nicht Gegenstand dieser Skizze.
- Der Titel im Kopfband ist HTML über der Grafik, nicht Teil des Bildes — er
  bleibt übersetzbar und suchbar. Das gilt auch für „← Archiv"; die
  Seriennummer oben rechts ist dagegen aufgedruckt und damit Dekoration.
