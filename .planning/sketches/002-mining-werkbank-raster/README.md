---
sketch: 002
name: mining-werkbank-raster
question: "Passen drei Spalten plus eingefaltetes Fracturing und Refinery bei 1280×720 — und wo kostet die Rig-Leiste am wenigsten?"
winner: "D"
tags: [layout, mining, werkbank, hoehenbudget]
---

# Skizze 002: Mining-Werkbank — Raster und Höhenbudget

## Design-Frage

Drei Spalten (Minerale · Ansicht · Signaturen) **plus** einer dauerhaften
Rig-Leiste **plus** eingefaltetem Fracturing- und Refinery-Block — passt das bei
1280×720 so, dass Filterkonsole und erste Mineralzeile über der Falz stehen?

Die drei Varianten unterscheiden sich **ausschließlich** darin, wo die Rig-Leiste
sitzt. Der Spalteninhalt ist in allen dreien identisch, damit der Vergleich das
Höhenbudget misst und nicht den Inhalt.

## Ansehen

```
.planning/sketches/002-mining-werkbank-raster/index.html
```

Die Werkzeugleiste oben schaltet Varianten und Fenstergrößen um und **misst
laufend mit** — Titelstreifenhöhe, Lage der Filterkonsole, Position der ersten
Mineralzeile und wie viele Zeilen ganz über der Falz stehen.

## Varianten

- **A: Kopfstreifen** — Rig-Leiste als volle Breite über allen drei Spalten.
- **B: In der linken Spalte** — Rig sitzt über den Filtern; Mittel- und rechte
  Spalte bekommen die volle Höhe, die Kosten trägt allein die Liste.
- **C: Kompakt, ausklappbar** — Rig als einzeilige Anzeige, auf Klick ausklappbar.
- **D: Unten, mit dem Sockel verschmolzen ★ GEWÄHLT** — dieselbe volle Leiste wie
  A, aber am unteren Rand, wo sie den ohnehin nötigen Sockel (Datenstand, Quellen)
  gleich mit aufnimmt. Der Warnstreifen läuft an der Oberkante und trennt
  *Anzeige oben* von *Bedienung unten*.

## Gemessen

Alle Werte am gerenderten Mockup abgelesen, nicht geschätzt.

### Bei 1280×720

| Variante | 1. Mineralzeile | Zeilen ganz über der Falz | Mittelspalte nutzbar | Rest bei 7 Fundorten | Rest bei allen 10 |
|---|---|---|---|---|---|
| **D unten ★** | **162 px** | **12 von 19** | 597 px | +22 px | −50 px |
| C kompakt | 194 px | 11 von 19 | 600 px | +25 px | −47 px |
| A Kopfstreifen | 217 px | 11 von 19 | 577 px | **+2 px** | **−70 px** |
| B linke Spalte | 362 px | 7 von 19 | 632 px | +57 px | **−15 px** |

### Bei 1366×768

| Variante | 1. Mineralzeile | Zeilen über der Falz | Mittelspalte | Rest bei 7 | Rest bei allen 10 |
|---|---|---|---|---|---|
| **D ★** | **162 px** | **13** | 645 px | +70 px | −2 px |
| C | 194 px | 12 | 648 px | +73 px | **+1 px** |
| A | 217 px | 12 | 625 px | +50 px | −22 px |
| B | 362 px | 9 | 680 px | +105 px | **+33 px** |

Inhaltshöhe der Mittelspalte, aufgeschlüsselt (Taranite, 7 Fundorte):
Kopf 68 · Urteilsband 51 · Fundorte 211 · Physik 88 · Qualitätsstufen 71 ·
Refinery 86 = **575 px**. Eine Fundortzeile ist 24 px.

## Befunde

**0. ★ Gewählt: D — die Leiste gehört nach UNTEN.** Der entscheidende Gedanke kam
vom Nutzer und stand in keiner der drei Vorlagen: Rig-Leiste und Sockel sind
*beide* Boden-Chrom. Zusammengelegt kosten sie **eine** Leiste statt zwei. D
gewinnt dadurch gegen jede der drei Vorlagen gleichzeitig — 55 px besser als A
bei der ersten Zeile, 32 px besser als C, und eine Mineralzeile mehr über der
Falz als beide. Dazu passt es zur gestalterischen Vorgabe: Anzeigen oben,
Bedienung auf Handhöhe darunter — Pult-Logik statt Kopfzeilen-Logik. Der
Warnstreifen wandert an die Oberkante der Leiste und markiert genau diese Grenze.
**Offene Frage, die die Skizze nicht beantworten kann:** findet ein Erstbesucher
die Rig-Einstellung unten? Gehört in die Sichtprüfung.

**1. Die Falz-Regel ist in allen vier Varianten erfüllt.** Selbst die teuerste
(B, erste Zeile bei 362 px) stellt 7 Mineralzeilen über die Falz — mehr als die
Schiffsübersicht nach ihrem Umbau (4 bei 1280). Die Prämisse trägt.

**2. Der Titelstreifen kostet nur 42 px.** Zum Vergleich: `hero--tool` in
`ItemFinderPage.astro:54` wurde im Projekt mit 273 px gemessen. Der Hero war nie
das Problem dieser Seite — die fünf gestapelten Abschnitte waren es.

**3. ⚠ KEINE Variante fasst alle 10 Fundorte bei 1280×720.** Selbst die
großzügigste (B) liegt 15 px darüber, die gewählte (D) 50 px. Die Mittelspalte
muss also **innen scrollen** oder die Fundortliste kappen/einklappen. Das ist
genau die Frage von Skizze 003 — hier vorab beziffert statt vermutet, mit der
Ausgangszahl **575 px Inhalt gegen 597 px Platz** bei sieben von zehn Fundorten.

**4. B kostet 200 px erste-Zeile-Höhe und kauft 35 px Mittelspalte** (gegen D).
Ein schlechter Tausch, solange die Mineralliste das Hauptnavigationsmittel ist.
B gewinnt nur bei 1366×768, wo es als einzige Variante alle 10 Fundorte
unterbringt — und selbst dort um den Preis von 4 Mineralzeilen.

## Worauf beim Vergleichen achten

- **Rig wirklich verstellen.** Laser umschalten (Helix II → Arbor MH2) und
  zusehen, wie die Lämpchen in der linken Liste umspringen. Das ist der eigentliche
  Gewinn der Rig-Leiste: die Liste wird zur Antwort, nicht zum Verzeichnis.
- **In Variante C „Rig ändern" drücken.** Verrät die eingeklappte Zeile genug,
  oder klappt man ständig auf, um zu sehen, womit gerechnet wird?
- **Quantainium anklicken** (Resistenz 0.95) und dann **Aluminum** (−0.40) — die
  beiden Enden des Urteilsbands.
- **Einen Scanwert eintippen**, z. B. `7110` — trifft Taranite ×2. Oder `10665`
  für Taranite ×3.
- **Modulplätze:** Ein Laser mit 1 Platz (Hofstede-S2) sperrt die Plätze 2 und 3
  sichtbar. Reicht das als Erklärung, oder braucht es Text?

## Für den echten Bau notiert

- Die drei `.pane-body` sind innen scrollende Kästen. `assets/theme.css` blendet
  mit `html,body,*{scrollbar-width:none!important}` **jede** Leiste aus — alle
  drei müssen in die Selektorliste `assets/mobile-ux.css:503-516`, sonst sind sie
  unsichtbar scrollbar.
- Die Brech-Rechnung im Mockup ist ein **Platzhalter**, damit sich die Lämpchen
  beim Verstellen bewegen. Die echte Heuristik steht in `FracturingCalc.astro`.
- Nicht benutzt und bewusst nicht: `--glow` (`0 0 44px`) aus `mining.astro:30`,
  `-webkit-text-stroke`, Verlaufstext, Scanlines.
- `--accent-2` (`#E0A526`) ist als Arbeitsfarbe eingesetzt, `--accent`
  (`#2FBFA4`) nur noch für Signaturwerte und Häufigkeitsbalken.
