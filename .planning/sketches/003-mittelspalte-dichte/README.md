---
sketch: 003
name: mittelspalte-dichte
question: "Passen Identität, Fundorte, Physik, Fracturing-Urteil und Refinery-Ertrag in EINE Spalte — und wenn nein, was gibt nach?"
winner: "C (nur strukturell)"
tags: [layout, mining, werkbank, dichte]
---

# Skizze 003: Mittelspalte — wie dicht darf sie werden?

## Design-Frage

Fünf Inhaltsarten in einer Spalte: Identität · Fundorte · Physik ·
Fracturing-Urteil · Refinery-Ertrag. Skizze 002 hat das Budget ausgemessen und
den Engpass beziffert — **575 px Inhalt gegen 597 px Platz bei sieben von zehn
Fundorten**, und **−50 px bei allen zehn**. Diese Skizze zeigt deshalb
durchgehend **Taranite mit allen zehn Fundorten**: den Belastungsfall, nicht den
Schönwetterfall.

Der Rahmen steht auf exakt dem Budget aus 002: **768 × 597 px** (bzw. 854 × 645
bei 1366×768). Was überläuft, sieht man sofort.

## Ansehen

```
.planning/sketches/003-mittelspalte-dichte/index.html
```

## Varianten

- **A: Ein Fluss, klebende Zwischenköpfe** — alles untereinander, Köpfe kleben
  beim Scrollen. Nichts versteckt, die Reihenfolge sagt was wichtig ist.
- **B: Urteil zuerst, Rest hinter Aufklappern** — Urteil und Kennzahlen immer
  sichtbar, Fundorte/Stufen/Refinery zugeklappt. Jede Kopfzeile trägt rechts eine
  Kurzantwort („10 Orte · bester 18 %").
- **C: Zweispaltig innerhalb der Spalte** — bei 768 px Breite zwei Spalten zu je
  383 px. Links Identität, Urteil, Physik, Qualitätsstufen; rechts alle zehn
  Fundorte und die Refinery.

## Gemessen

Am gerenderten Mockup abgelesen. „Klicks" = wie oft man klicken muss, bis alles
sichtbar ist.

### Bei 768 × 571 px (Budget aus 002 @1280×720)

| Variante | Überlauf | Fundorte ohne Scrollen | Klicks bis alles sichtbar |
|---|---|---|---|
| C zweispaltig | **0 px** | **10 von 10** | **0** |
| A ein Fluss | **51 px** | 10 von 10 | 0 |
| B Aufklapper | 0 px | **0 von 10** | **3** |

### Bei 854 × 619 px (@1366×768)

| Variante | Überlauf | Fundorte ohne Scrollen | Klicks |
|---|---|---|---|
| C | 0 px | 10 | 0 |
| A | 3 px | 10 | 0 |
| B | 0 px | 0 | 3 |

## Ausgang

**Struktur entschieden: C (zweispaltig), messungsgestützt.** Die Zahlen sind
eindeutig — nur C zeigt bei 1280×720 alles ohne Scrollen und ohne Klick.

**Verarbeitungsgrad NICHT entschieden.** Rückmeldung des Nutzers an dieser
Stelle wörtlich: *„vom design her sollte es so hochwertig sein wie ingame
panels. nur nicht so generisch."* Der Einwand richtet sich nicht gegen das
Raster, sondern gegen die Ausführung: die Skizze ist ein solides dunkles
Dashboard, und das ist zu wenig. → **Skizze 004** setzt den Verarbeitungsgrad
auf C auf.

## Befunde

**1. Die befürchtete Überfüllung tritt nicht ein — sie war ein Ein-Spalten-
Problem.** C passt nicht knapp, sondern mit **298 px Luft** in der rechten
Teilspalte (547 px verfügbar, Fundorte brauchen ~250). Die Mittelspalte ist mit
768 px so breit, dass sie zwei Spalten trägt; einspaltig wurde Breite verschenkt
und Höhe verbraucht.

**2. A verliert genau eine Sache: die Refinery-Zahlen.** Die 51 px Überlauf sind
der Refinery-Block am Ende — alle zehn Fundorte stehen bei A sehr wohl ohne
Scrollen da. Bei 1366×768 sind es nur noch 3 px Überlauf, A ist dort praktisch
gleichwertig.

**3. B tauscht Scrollen gegen Klicken und verliert dabei mehr.** Ohne Klick sieht
man **keinen einzigen** Fundort. Die Kurzantworten in den Kopfzeilen („10 Orte ·
bester 18 %") federn das ab, aber wer Fundorte vergleichen will, klappt sowieso
alles auf — und hat dann A mit drei Extraklicks.

**4. Die 298 px Luft in C sind ein Angebot, kein Rest.** Dort könnten stehen:
die Zusammensetzung (welche Steine dieses Erz führen), die Mining-Schiffe für
dieses Erz, oder der Fundort-Rückwärtsblick. **Vorsicht:** das ist genau die
Stelle, an der die Seite wieder zur Leinwand wird. Was dort hin soll, muss
aussieben helfen.

## Worauf beim Vergleichen achten

- **In A wirklich scrollen** — halten die klebenden Zwischenköpfe die
  Orientierung, oder verliert man den Bezug zum Mineral oben?
- **In B alles auf- und zuklappen** — reicht die Kurzantwort rechts in der
  Kopfzeile, oder klappt man ohnehin alles auf?
- **In C prüfen, ob es noch als EINE Ansicht liest** oder als zwei
  zusammengeschobene Kästen. Das ist der einzige echte Einwand gegen C, und er
  ist gestalterisch, nicht messbar.
- **Auf 854 × 645 umschalten** — A wird dort fast gleichwertig. Wenn die meisten
  Nutzer breit sitzen, verliert C an Vorsprung.

## Für den echten Bau notiert

- In C sind **zwei** weitere innen scrollende Kästen (`.colscroll`) — zusammen
  mit den drei Spalten aus 002 also **fünf**, die alle in die Selektorliste
  `assets/mobile-ux.css:503-516` müssen, sonst sind sie unsichtbar scrollbar.
- C braucht für die Ein-Spalten-Ansicht auf schmalen Fenstern einen Rückfall auf
  `grid-template-columns:1fr` — das ist derselbe Umschalter wie beim
  Segment-Wechsler aus Entscheidung 4, nicht ein zweiter.
- Die Brech-Rechnung ist auch hier ein **Platzhalter** (Rig fest: Helix II +
  Rieger). Die echte Heuristik steht in `FracturingCalc.astro`.
