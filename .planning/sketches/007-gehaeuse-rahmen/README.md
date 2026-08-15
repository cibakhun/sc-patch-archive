---
sketch: 007
name: gehaeuse-rahmen
question: "Wie viel Gehäuse verträgt die Werkbank, bevor der Rahmen die Daten verdrängt?"
winner: null
tags: [design, mining, werkbank, gehaeuse, rahmen, violett]
---

# Skizze 007: Gehäuse-Rahmen

## Design-Frage

Die beiden KI-Mockups des Nutzers zeigen ein Gehäuse, das die Werkbank umschließt:
Schulterplatten oben, Titel in einer eingelassenen Kartusche, seitliche
Leuchtstreifen, Nieten unten. Auf der Werkbank ist Höhe aber das knappste Gut —
jeder Pixel Gehäuse ist ein Pixel weniger Mineralliste. Die Frage ist deshalb
nicht „gefällt es", sondern **was der Rahmen kostet und ob er das wert ist.**

## Ansehen

```bash
start .planning/sketches/007-gehaeuse-rahmen/index.html
```

## Varianten

- **A: Fassung** — schmale versenkte Kante, Titel in der normalen Leiste. Das
  Gehäuse ist eine Kante, kein Möbel.
- **B: Schulterplatten** — das Mockup wörtlich: asymmetrische Platten,
  eingelassene Titel-Kartusche, Leuchtstreifen, Nietenreihe.
- **C: Rumpf** — volles Gehäuse: durchgehende Seitenholme mit Leuchtstreifen,
  Eckbolzen, tiefere Kartusche. Am nächsten an einem Ingame-Panel.

Die Violett-Dosis ist in allen drei Varianten **identisch** — sonst vergleicht
man zwei Dinge gleichzeitig. Über Violett entscheidet Skizze 008.

## Gemessen (1280×720, Chrome, headless)

| | A: Fassung | B: Schulterplatten | C: Rumpf |
|---|---|---|---|
| Gehäuse-Aufschlag | **124 px** | 163 px | 187 px |
| Erste Erz-Kachel bei | **166 px** | 205 px | 229 px |
| Kacheln über der Falz | **36 / 37** | 32 / 37 | 32 / 37 |
| Überlauf unter 720 | 0 px | 0 px | 0 px |

Vergleichswert aus dem Bestand: der ausgelieferte Stand setzt die erste
Mineralzeile auf **162 px** (Manifest, Skizze 002). Variante A trifft das
praktisch genau; C kostet **67 px** und vier Kacheln.

## Worauf zu achten ist

1. **Trägt der Rahmen, oder ist er nur da?** In B liegen die Leuchtstreifen ganz
   außen auf 11 px und lesen sich als Kante — nachgemessen sind sie vorhanden
   und oberstes Element, sie tragen optisch nur nichts. In C sind dieselben
   Streifen in 34-px-Holmen gefasst und werden zum prägenden Element. **B ist
   dadurch von C dominiert:** es kostet fast so viel und liefert weniger.
2. **Die Kartusche funktioniert in beiden.** Titel mittig, eingelassen — das ist
   der Teil des Mockups, der sich am billigsten einlöst.
3. **Der Preis ist ehrlich klein.** 67 px für das volle Gehäuse, ohne Überlauf,
   ohne Scrollen unter 1280×720. Das Höhenargument, das in 004/006 gegen
   Verarbeitung sprach, trägt hier **nicht**.
4. **Gegenprobe eingebaut:** Der Knopf „Violett aus/an" unten rechts setzt alle
   violetten Werte zurück auf Teal. Wer nicht sieht, was sich ändert, braucht
   die Farbe an dieser Stelle nicht.

## Verhältnis zum dokumentierten Endstand

Das Manifest führt Skizze 006 A („Ruhig", Baujahr 2026) als **Endstand der
Gestaltungssprache** und verwirft dort ausdrücklich Glas, Schräge, HUD-Sprache
und Schein-Effekte. Der **gebaute** Stand hält sich daran nicht mehr:
`MiningWorkbench.astro:406ff` trägt Glas (`backdrop-filter: blur(14px)`), eine
angeschrägte Ecke (`.chamf`) und gezähnte Segmentbalken. Diese Skizze schreibt
also nicht den Endstand um, sondern den **Ist-Zustand** fort — der Bruch mit 006
ist bereits im ausgelieferten Code passiert und sollte bei der Entscheidung hier
nachgezogen im Manifest festgehalten werden.

## Bauhinweise, die aus dieser Skizze mitgehen

- **`clip-path` in B/C liegt NICHT über `backdrop-filter`** — die Platten und die
  Kartusche sind eigene, unverglaste Elemente über dem Gehäusegrund. Die
  840-ms-Falle aus dem Menü-Eintritt ist damit baulich ausgeschlossen, nicht nur
  vermieden.
- **Alle Gehäusetöne sind Variablen** (`--hull-1…3`, `--hull-edge`,
  `--hull-lamp`). Pflicht, nicht Stil: `build-light-overrides.mjs:85` deckt
  `background` nicht ab, fest verdrahtete Flächen bekämen still keine
  Hell-Fassung.
- ⚠ **Neue Farbtoken brauchen einen Eintrag in der festen Namensliste**
  (`theme-color.mjs:194ff`), sonst ignoriert `build-light-palettes.mjs` sie
  stumm. `--hull-*` und `--vio*` sind bislang **nicht** darin — das ist eine
  echte Aufgabe für die Umsetzung, keine Kleinigkeit.
