---
sketch: 008
name: gehaeuse-1zu1
question: "Das Gehäuse aus Bild 2 ohne Abschwächung — trägt es, und was kostet es?"
winner: null
tags: [design, mining, werkbank, gehaeuse, rahmen]
---

# Skizze 008: Gehäuse 1:1

## Design-Frage

Skizze 007 hat drei Gehäuse-*Grade* verglichen und dabei die eigentliche Vorgabe
verfehlt: alle drei waren Andeutungen, keiner war das Mockup. Rückmeldung des
Nutzers wörtlich: *„alle deine designs sind viel zu abwägig vom mockup. mir
gehts erstmal hauptsächlich um dieses rahmen."*

Diese Skizze baut den Rahmen deshalb **ohne Abschwächung** — durchgehendes
Gehäuse auf allen vier Seiten, wie in Bild 2:

- geriffelte Schulterplatten mit Lichtstreifen quer über das Kopfband
- versenkte, trapezförmige Titel-Kartusche in der Mitte
- Seitenholme mit eingefräster Nut und je zwei Leuchtsegmenten
- Sockel mit Lüftungsgittern links und rechts, Kennstreifen in der Mitte
- Eckbolzen, abgeschnittene Ecken der Außenkontur
- versenkte Bildfläche mit eigenem Gitter
- der Archiv-Knopf schwebt **außerhalb** des Gehäuses, wie im Mockup

## Ansehen

```bash
start .planning/sketches/008-gehaeuse-1zu1/index.html
```

## Varianten

- **A: Gehäuse voll** — Holme 64 px, Kopfband 104 px, Sockel 62 px. Das Mockup.
- **B: Gehäuse schlank** — dieselbe Sprache auf 36 / 74 / 40 px zusammengezogen.

## Gemessen (1280×720, Chrome, headless)

| | A: voll | B: schlank |
|---|---|---|
| Gehäuse-Aufschlag | 219 px | 189 px |
| Erste Erz-Kachel bei | 259 px | 229 px |
| Kacheln über der Falz | 28 / 37 | 32 / 37 |
| Überlauf unter 720 | 0 px | 0 px |

Das volle Gehäuse kostet gegenüber dem ausgelieferten Stand (erste Mineralzeile
bei 162 px) **97 px und neun Kacheln** — und läuft trotzdem nicht über.

**Befund zu B:** die Ersparnis ist real, aber sie kauft das Falsche. Bei 36 px
Holmbreite bleibt vom Gehäuse ein Streifen; die Leuchtsegmente stehen dann fast
ohne Blech, und der Rahmen sieht aus wie ein Rand, nicht wie ein Gerät. Wenn das
Gehäuse die Vorgabe ist, ist **A die einzige der beiden, die sie erfüllt** — B
steht als Beleg dafür da, was Sparen hier kostet.

## Drei Fehlschläge auf dem Weg, protokolliert

1. **Gehäuse dunkler als die Bildfläche.** Die erste Fassung fiel im Verlauf zu
   schnell ins Schwarze und las sich als breiter schwarzer Rand. Ein Gehäuse muss
   **heller** sein als das, was es umschließt, sonst verschwindet es genau da, wo
   es wirken soll.
2. **Die Nut fraß den Holm.** Bei 38 von 64 px Nutbreite blieb sichtbar nur ein
   dunkler Kanal übrig — Blech war keines mehr da. Jetzt 24 px.
3. **Der Deckschatten übermalte die Materialarbeit.** `.rig::before` liegt mit
   `z-index: 8` über Kopfband, Holmen und Sockel; sein flächiger
   `inset 0 -3px 10px` hat alle drei nachträglich abgedunkelt. Er zeichnet jetzt
   nur noch Kanten. — Merksatz: eine Deckschicht über allem darf Kanten setzen,
   keine Flächen tönen.

## Bauhinweise für die Umsetzung

- **Kein `backdrop-filter` mehr im Gehäuse.** Hinter einem deckenden Metallrahmen
  hat Glas nichts zu spiegeln; die Paneele sind flache Flächen. Damit ist die
  Paarung `clip-path` über `backdrop-filter` — die den Menü-Eintritt schon einmal
  auf 840 ms gedrückt hat — **baulich ausgeschlossen**, nicht nur vermieden. Der
  Silhouettenschnitt der Außenkontur ist dadurch gefahrlos.
- ⚠ **`--hull-*` und `--vio*` stehen nicht in `LIGHT_RULES`**
  (`scripts/lib/theme-color.mjs:194`). Die Liste ist eine feste Namensliste;
  unbekannte Token werden still übergangen und bekommen **keine Hell-Fassung**.
  Für ein Gehäuse aus sechs neuen Farbtoken ist das kein Detail, sondern eine
  eigene Aufgabe in der Umsetzung.
- Die Höhenkonstante `--wb-chrome` in `MiningWorkbench.astro:429` muss auf den
  neuen Aufschlag gehen; sie ist am gebauten Stand nachgemessen (236) und würde
  sonst acht Pixel über die Fensterunterkante laufen wie schon einmal.
