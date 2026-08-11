---
sketch: 006
name: baujahr-2026
question: "Wie sieht die Werkbank aus, wenn sie aussehen soll, als wäre sie 2026 entworfen worden — industriell, modern, nicht futuristisch?"
winner: "A"
tags: [design, mining, werkbank, modernitaet, dichte]
---

# Skizze 006: Baujahr 2026

## Vorgabe

Wörtlich: *„aber es geht nicht nur um das glas sondern um ein industrial, modern
but not futuristic design that looks like something that got designed in 2026."*

## Das korrigiert 004 und 005

Was dort gebaut wurde, ist zu großen Teilen **Spiel-UI-Vokabular, nicht
Industriedesign**. Es datiert. Die Gegenüberstellung:

| 004 / 005 | Baujahr 2026 |
|---|---|
| Eckradius 0–2 px | **8–12 px** — der stärkste Jahreszahl-Verräter überhaupt |
| Versal-Mono-Labels, `.18em` gesperrt | Sans, normale Laufweite, Satzschreibung. **Mono nur für Zahlen** |
| Ränder an allem | Flächenabstufungen (`--s0…--s3`) + weiche, große, flache Schatten |
| Angeschrägte Ecke | ersatzlos |
| Warnstreifen, gezähnte Balken | ersatzlos — **Ausnahme Qualitätsstufen**, dort *sind* die Segmente die Daten |
| Zustandslämpchen, eckig, gerahmt | runder, matter Punkt, 8 px, ohne Rahmen |
| Polsterung 8 px | 12–18 px |
| Teal + Bernstein + Oliv + Rost gleichzeitig | fast monochrom; **Farbe nur für Zustand** |

**„Industriell" heißt hier nicht Blech und Nieten**, sondern der Ernst
professioneller Werkzeuge: dichte, präzise Zahlen; Hierarchie über
Schriftgewicht statt über Rahmen; Farbe streng als Bedeutungsträger; keine
Dekoration, die nicht misst.

## Ansehen

```
.planning/sketches/006-baujahr-2026/index.html
```

## Varianten

- **A: Ruhig** — Register heutiger Werkzeugsoftware. Radius 12/8/6, Polsterung
  12–18 px, viel Luft.
- **B: Dicht** — dieselbe Moderne im Register professioneller Werkzeuge:
  engere Zeilen, Radius 10/6/5, mehr Zahl pro Fläche.
- **C: Materiell** — wie A, aber die Flächen tragen einen leisen warmen Ton
  statt neutralem Graphit. Anodisiertes Aluminium statt Serverschrank.

## Gemessen

### Bei 1280×720 — Endstand

| Variante | 1. Mineralzeile | Zeilen über der Falz | Mittelspalten-Überlauf | Fundorte sichtbar |
|---|---|---|---|---|
| **A Ruhig ★** | 202 px | 9 von 19 | **0 px** | 10 von 10 |
| B Dicht | **192 px** | **11 von 19** | 0 px | 10 von 10 |
| C Materiell | 202 px | 9 von 19 | 0 px | 10 von 10 |
| *(Skizze 005, HUD-Sprache)* | *150 px* | *12 von 19* | *0 px* | *10 von 10* |

**⚠ A und C liefen zunächst 8 px über.** Behoben durch `.sec`-Polsterung unten
15 → 12 px: über drei Abschnitte 9 px zurückgeholt, Ruhe unverändert. Der Wert
oben ist der Stand *nach* dieser Korrektur — ein Entwurf mit bekanntem Überlauf
wird nicht als gewählt festgeschrieben.

### Bei 1366×768

| Variante | 1. Zeile | Zeilen über der Falz | Überlauf |
|---|---|---|---|
| B | 192 px | 12 | 0 px |
| A | 202 px | 10 | 0 px |
| C | 202 px | 10 | 0 px |

## Befunde

**1. Die Moderne kostet 42–52 px und ein bis drei Mineralzeilen.** Das ist der
ehrliche Tausch und die eigentliche Erkenntnis dieser Skizze: größere Radien,
mehr Polsterung und Flächenabstufungen statt Haarlinien brauchen Platz. Wer die
2026er-Sprache will, zahlt sie in Zeilen über der Falz.

**2. Die Falz-Regel hält trotzdem in allen drei Varianten.** Filterkonsole und
erste Ergebniszeile stehen überall über der Falz. Es geht nicht um bestanden
oder durchgefallen, sondern um 9 gegen 12 Zeilen.

**3. B ist der Kompromiss, der nichts aufgibt.** Es bleibt vollständig in der
2026er-Sprache — Radius 10/6/5 ist modern, nicht retro —, holt aber 2 Zeilen
zurück und ist als einzige Variante bei 1280 ohne Mittelspalten-Überlauf. A und
C laufen dort 8 px über und müssten scrollen.

**4. Der Radius ist der Hebel, nicht die Polsterung.** Von A (12/8/6) zu B
(10/6/5) sind es nur 2 px Radius — der Rest der 10 px Gewinn kommt aus engeren
Zeilen. Radius unter 8 px kippt aber wieder ins Retro-Technische; darunter sollte
man nicht gehen, auch wenn es Platz spart.

## Worauf beim Vergleichen achten

- **A und B im Wechsel.** Fühlt sich B kompetent an oder gehetzt? Das ist die
  ganze Frage — 2 Mineralzeilen gegen Luft.
- **C nur wegen der Farbe ansehen.** Es ist strukturell identisch zu A; einzig
  die Flächen sind warm statt neutral. Zu nah am Sepia, oder genau der Anteil
  „Material", der dem Ding Charakter gibt?
- **Auf die Labels achten.** „Widerstand", nicht „WIDERSTAND". Das ist der
  zweitgrößte Jahreszahl-Unterschied nach dem Radius und fällt erst auf, wenn
  man 005 daneben legt.
- **Rig unten, Laser umschalten** — der Zustandspunkt in der Liste springt
  weiterhin mit. Die Funktion ist unverändert, nur die Sprache ist neu.

## Ausgang: A — ruhig, modern, industriell im Sinne von ernsthaft

**Gewählt wurde A.** Damit steht die Gestaltungssprache der Werkbank fest, und
Skizze 005 (Glas, Schräge, Zähnung) ist **überholt** — nicht falsch, aber
abgelöst. Die Werkbank spricht ab hier:

- **Radius 12 / 8 / 6.** Nicht darunter: unter 8 px kippt es ins
  Retro-Technische, so viel Platz das auch spart.
- **Labels in Sans, Satzschreibung, normale Laufweite.** „Widerstand", nicht
  „WIDERSTAND". Der zweitgrößte Jahreszahl-Unterschied nach dem Radius.
- **Mono ausschließlich für Zahlen**, tabellarisch, leicht negativ gesperrt.
- **Flächenabstufungen `--s0…--s3` statt Rändern**, dazu weiche große flache
  Schatten. Fast keine Haarlinien mehr.
- **Fast monochrom. Farbe nur als Bedeutungsträger:** Bernstein = Auswahl und
  Handlung, Teal = Signaturwert, Grün/Gelb/Rot = Brechbarkeit.
- **Kein Ornament:** keine Schräge, kein Warnstreifen, keine Zähnung, kein Glas,
  kein Korn, kein Messgerät, kein Foto, kein 3D-Objekt.
- **Ausnahme, die bleibt:** die Qualitätsstufen sind segmentiert — dort *sind*
  die acht Segmente die Daten.

Der rote Faden über 004 → 006 ist übrigens stabil: schon 004 entschied sich gegen
Ornament („Präzision, nicht Detail"). 006 ändert nicht die Haltung, sondern das
**Idiom** — von zurückgenommenem HUD auf zeitgenössisches Werkzeug.

**Preis, offen benannt:** 52 px und 3 Mineralzeilen gegen die HUD-Sprache aus
005 (9 statt 12 über der Falz bei 1280×720). Bewusst bezahlt.
