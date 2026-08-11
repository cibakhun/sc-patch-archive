---
sketch: 004
name: verarbeitungsgrad
question: "Wie hochwertig muss die Werkbank verarbeitet sein, um neben einem Panel aus dem Spiel zu bestehen — ohne generisch zu werden?"
winner: "A"
tags: [design, mining, werkbank, verarbeitung, material]
---

# Skizze 004: Verarbeitungsgrad

## Design-Frage

Skizze 003 hat das Raster entschieden (zweispaltig). Der Einwand danach galt
nicht dem Raster, sondern der Ausführung — wörtlich:

> *„vom design her sollte es so hochwertig sein wie ingame panels. nur nicht so
> generisch."*

Alle drei Varianten zeigen **denselben Inhalt im selben Raster** (Taranite, alle
zehn Fundorte, Budget 768 × 597 aus Skizze 002). Unterschiedlich ist **nur die
Verarbeitung**.

## Ansehen

```
.planning/sketches/004-verarbeitungsgrad/index.html
```

Unter den Rahmen sitzt eine Laser-Auswahl mit echten Werten — damit sich das
Urteil bewegt und man sieht, wie jede Verarbeitungsstufe einen Zustandswechsel
trägt.

## Varianten

- **A: Zurückgenommen ★ GEWÄHLT** — Handwerk allein über Typografie, Abstand,
  Haarlinien. Keine Kante, keine Wanne, kein Winkel, kein Korn. Das „alte
  Regolith"-Ende.
- **B: Verarbeitet** — Blechbau: erhabene Träger, versenkte Wannen für jeden
  Messwert, angeschrägte Ecke, segmentierte Balken, Eckwinkel, Teilstriche,
  Passkreuz, 2 % Materialkorn.
- **C: Instrument** — alles aus B, plus: das Urteil wird ein **Messgerät** mit
  versenkter Skala, Teilung, schraffiertem Grenz- und Gutbereich und Zeiger.

## Ausgang: A — „hochwertig" heißt hier Präzision, nicht Detail

**Gewählt wurde A, die zurückgenommenste Variante.** Damit ist die Frage anders
beantwortet, als die Skizze sie gestellt hat: Der Weg zu „so hochwertig wie ein
Panel im Spiel" führt hier **nicht** über mehr Verarbeitung, sondern über
strengere Typografie und Abstände. B und C waren nicht schlecht — sie waren
*Dekor auf einem Werkzeug*, und das ist auf dieser Seite mehrfach als falsch
markiert worden.

Was das konkret für den Bau heißt:

- **Es entfallen:** angeschrägte Ecken, versenkte Wannen, erhabene Platten,
  segmentierte Balken, Eckwinkel, Passkreuz, Materialkorn, das Messgerät.
- **Es bleibt:** größere Überschrift, weiter gesperrte 8,5-px-Mikrolabels
  (`letter-spacing:.2em`), eine Haarlinie unter jedem Blockkopf, Messwerte in
  Mono ohne Fettung, ruhige Flächen ohne Verlauf.
- **Nebeneffekt:** der billigste Weg ist auch der, der am wenigsten mit dem
  Bestands-CSS kämpft — keine `clip-path`/`overflow`-Konflikte, keine
  z-index-Frage beim Korn, keine Kontrast-Sonderregel für die Zähnung.

Die Tabelle unten steht trotzdem im Bestand: sie hält fest, **was geprüft und
verworfen wurde**, damit die Frage nicht in einem halben Jahr neu aufgemacht
wird.

## Was „hochwertig wie im Spiel" hier konkret hieße

Damit das nicht Geschmackssache bleibt, ausformuliert — **ja** wie **nein**:

| ✓ Eingesetzt | ✗ Bewusst vermieden |
|---|---|
| Angeschrägte Ecke über `clip-path` — steht schon als Formensprache im MANIFEST, wird hier nur konsequent angewandt | Ecken an **allen vier** Seiten anschrägen — das ist der generische Griff |
| Versenkte Wannen (`inset`-Schatten) für Messwerte, erhabene Platten für Träger. **Licht immer von oben** | Sechsecke, Neongitter, Zielkreuze, Scanlines, „SYSTEM ONLINE" |
| Segmentierte, gefräste Balken statt durchgezogener Füllungen | `--glow` (`0 0 44px`) aus `mining.astro:30` |
| Eckwinkel, Teilstriche, Passkreuz, Index „01 / 04" | Leuchtränder als Zustandsanzeige |
| Materialkorn (feine Schraffur, 2 %) statt toter Flächen | Farbverlaufstext, `-webkit-text-stroke` |
| 9-px-Mikrolabels weit gesperrt gegen große Mono-Zahlen | Gleichförmige 12-px-Grautexte überall |

Ein Detail, das den Unterschied gut zeigt: die **Eckwinkel am Urteilsband
übernehmen die Zustandsfarbe** — Oliv bei brechbar, Bernstein bei grenzwertig,
Rost bei nicht brechbar. Am Mockup nachgemessen: `rgb(143,179,57)` im Zustand
„ok". Das ist billiger als ein Leuchtrand und liest sich als Gerät statt als
Warnung.

## Gemessen

Verarbeitung kostet Pixel. Die Messung hält nach, ob das Budget aus 002 trotzdem
hält.

| Variante | Überlauf @768×597 | Fundorte ohne Scrollen | Überlauf @854×645 |
|---|---|---|---|
| A Zurückgenommen | **0 px** | 10 von 10 | 0 px |
| B Verarbeitet | **0 px** | 10 von 10 | 0 px |
| C Instrument | **0 px** | 10 von 10 | 0 px |

**Befund: Verarbeitung ist hier gratis.** Der teuerste Weg (C) kostet gegenüber
dem billigsten (A) 41 px in der linken Teilspalte (422 statt 463 nutzbar) — und
die werden nicht gebraucht, weil dort nur Physik, Stufen und Refinery stehen.
Die Entscheidung ist damit rein gestalterisch, nicht budgetär.

## Worauf beim Vergleichen achten

- **Nah herangehen.** Der Unterschied zwischen A und B lebt in den Kanten, nicht
  in der Silhouette. Aus zwei Metern Abstand sehen beide gleich aus — genau das
  ist der Punkt bei „hochwertig".
- **Laser umschalten** (Helix II → Arbor MH2 → Hofstede-S1). In C wandert der
  Zeiger durch Gut-, Grenz- und Schlechtbereich; in A und B springen nur zwei
  Balken. Trägt das Messgerät den Zustandswechsel besser?
- **A ernst nehmen.** A ist nicht der Strohmann — es ist die Gegenprobe, ob B zu
  viel tut. Wenn A neben B nicht billig wirkt, ist B Dekor.
- **C auf Übertreibung prüfen.** Ein Messgerät für eine Zahl, die auch als „×1,17"
  dasteht: Instrument oder Selbstzweck?

## Für den echten Bau notiert

- Die angeschrägte Ecke ist `clip-path` — **`overflow` und `clip-path` vertragen
  sich schlecht** mit innen scrollenden Kästen. Im Bau die Schräge auf einen
  Kopfbereich legen, nie auf den Scroll-Container selbst.
- Das Materialkorn liegt als `::after` mit `pointer-events:none` über allem und
  hat `z-index:30` — im echten Bau muss es unter Modals/Overlays bleiben.
- Die Segment-Balken sind `repeating-linear-gradient` auf dem Füllelement, nicht
  auf der Spur. Bei `prefers-reduced-motion` ändert sich daran nichts (keine
  Bewegung im Spiel), aber bei erhöhtem Kontrast sollte die Zähnung entfallen.
- Alle Effekte sind reines CSS: keine Bilder, keine SVG-Daten-URIs, kein JS.
  Das war Absicht — Verarbeitung darf kein Ladegewicht kosten.
