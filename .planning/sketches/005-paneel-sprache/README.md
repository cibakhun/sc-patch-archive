---
sketch: 005
name: paneel-sprache
question: "Wie viel Glas trägt die Werkbank — wenn der Foto-Hintergrund, der das Glas in den Mockups erst lesbar macht, gestrichen ist?"
winner: "D (überholt durch Skizze 006)"
tags: [design, mining, werkbank, glas, leistung, ueberholt]
---

# Skizze 005: Paneel-Sprache

> ## ⚠ ÜBERHOLT DURCH SKIZZE 006
>
> Gewählt war hier **D** (Glas nur tragend, reicherer Grund). Unmittelbar danach
> präzisierte der Nutzer die Vorgabe: *„es geht nicht nur um das glas sondern um
> ein industrial, modern but not futuristic design that looks like something
> that got designed in 2026."* Skizze 006 zieht daraus die Konsequenz und lässt
> Glas, Schräge und Zähnung **ganz** fallen — sie sind Spiel-UI-Vokabular.
>
> **Was aus dieser Skizze trotzdem gilt und in 006 weiterlebt:**
> Flächenfarben **müssen** CSS-Variablen sein. `build-light-overrides.mjs:85`
> kennt nur `color`/`border-*-color`/`outline-color`/`fill`/`stroke` — kein
> `background`, kein `box-shadow`. Nur über Variablen (`:228`) entsteht
> überhaupt eine Hell-Entsprechung. 006 benutzt deshalb `--s0…--s3`.
>
> Ebenfalls gültig: die 5 innen scrollenden Kästen müssen nach
> `assets/mobile-ux.css:503-516`.

## Herkunft

Zwei KI-Mockups des Nutzers (ARGO-Dashboard). Sie tragen erkennbar meine
Skizzen-Beschriftungen weiter („GLEICHER INHALT", „01 / 04 · HELIX II",
Taranite 3555, 4860/5678, ×1.17, 341 k) — **die KI hat Skizze 004 genommen und
eingekleidet.** Der Inhalt ist also bereits abgestimmt; neu ist ausschließlich
die Behandlung. Das macht den Vergleich sauber.

**Übernommen wird ausdrücklich nur die Paneel-Sprache** — Glas, angeschrägte
Ecke, Segmentbalken. **Nicht übernommen:** Foto-Hintergrund, schwebender
3D-Brocken, Sparklines an jeder Kennzahl, Radialanzeigen. Struktur bleibt die
gemessene: Raster D aus 002 (Rig-Leiste unten), Mittelspalte C aus 003
(zweispaltig).

## Design-Frage

**Glas braucht etwas zum Weichzeichnen.** In den Mockups liest sich das Glas nur
deshalb als Glas, weil ein Schiffsinnenraum dahinterliegt. Der ist gestrichen.
Auf ruhigem Grund hat `backdrop-filter` kaum etwas zu tun — „Glas" verkommt dann
zu „leicht durchscheinendes dunkles Paneel", von einem massiven kaum zu
unterscheiden. Die drei Varianten probieren aus, ob die Sprache trotzdem trägt.

## Ansehen

```
.planning/sketches/005-paneel-sprache/index.html
```

## Varianten

- **A: Echtes Glas überall** — `backdrop-filter` auf jedem Paneel *und* jeder
  Kachel darin. Am nächsten an den Mockups.
- **B: Glas ohne Weichzeichner** — kein `backdrop-filter`. Der Glaseindruck kommt
  allein aus durchscheinender Fläche, heller Oberkante und flachem Innenverlauf.
- **C: Weichzeichner nur an den tragenden Flächen** — echtes Glas an den drei
  Spalten, dem Titelstreifen und der Rig-Leiste; alles darin ohne.

## Gemessen

| Variante | Compositing-Layer durch Weichzeichner | `clip-path` | 1. Mineralzeile | Zeilen über der Falz |
|---|---|---|---|---|
| A Glas überall | **53** | 0 | 150 px | 12 von 19 |
| B ohne Weichzeichner | **0** | 0 | 150 px | 12 von 19 |
| C nur tragend | **6** | 0 | 150 px | 12 von 19 |

In A verteilen sich die 53 Layer auf `i×14` (Segmentbalken-Füllungen),
`loc×10`, `chip×4`, `stat×4` und die 6 Paneele.

### ⚠ Was hier NICHT gemessen wurde

**Die Malkosten des Weichzeichners.** Aus JS heraus geht das nicht seriös:
erzwungenes Layout (`offsetHeight`) löst kein Neu-Compositing aus, und
`performance.now()` um eine Scroll-Zuweisung misst nur die Zuweisung. Ein erster
Anlauf lieferte „0,2 ms gegen 0,1 ms" — das wäre eine erfundene Zahl gewesen und
ist deshalb aus der Skizze entfernt. Was dasteht, ist die **Zählung der
erzwungenen Compositing-Layer**: nachprüfbar, und der Größe nach der eigentliche
Kostentreiber. Die echte Bildrate gehört in die Rendering-Ansicht der DevTools
oder auf die Seite unter Last.

Der belastbarste Hinweis liegt ohnehin im Projekt selbst: **der Menü-Eintritt
fiel von 840 ms auf 320 ms, als genau diese Schicht wegfiel.**

## Befunde

**1. Die Schräge braucht kein `clip-path` — in allen drei Varianten 0.** Ein
einzelnes Pseudo-Element mit 45°-Verlauf füllt die Ecke mit der Seitenfarbe und
zeichnet die Schnittkante als Haarlinie. Kein Compositing-Layer, kein Konflikt
mit `backdrop-filter`, kein Beschneiden von Scroll-Inhalt. **Die dokumentierte
840-ms-Falle ist damit baulich ausgeschlossen, nicht bloß umgangen.**
Der Trick funktioniert, *weil* der Grund eine bekannte Farbe ist — mit
Foto-Hintergrund ginge er nicht. Ein weiterer Grund, warum das Foto draußen
bleibt.

**2. Die Paneel-Sprache kostet im Höhenbudget nichts — sie gewinnt.** Erste
Mineralzeile bei **150 px** gegen 162 px in Skizze 002. Die Paneele mit Abstand
und eigener Kante brauchen weniger Trennlinien-Höhe als die durchgehenden
Flächen vorher.

**3. Glas ist als Token ausgedrückt, nicht als Fläche — und das ist Pflicht, kein
Stil.** `build-light-overrides.mjs:85` kennt nur `color`, `border-*-color`,
`outline-color`, `fill`, `stroke` — **kein `background`, kein `box-shadow`**. Ein
Glas-Design ist zu 90 % genau das. Stünde hier `background:rgba(...)` direkt, gäbe
es im Hellmodus still *keine* Entsprechung. Über `--glass-bg` / `--glass-line` /
`--glass-hi` greift dagegen `:228`, das Variablen sehr wohl mitnimmt.

**4. `backdrop-filter` ist schon Bestandssprache.** `assets/account-dossier.css`
benutzt es durchgehend im mobiGlas-Kontobereich. Nichts an A oder C ist neu für
diese Seite.

## Worauf beim Vergleichen achten

- **A und B direkt hintereinander umschalten.** Das ist die ganze Frage: Sieht
  man 53 Compositing-Layer überhaupt? Wenn nicht, ist B die richtige Antwort und
  A ist bezahlter Aufwand ohne Gegenwert.
- **C ist der Kompromiss, der wahrscheinlich gewinnt** — echtes Glas an der
  großen Kante gegen den Grund, wo es liest; die 47 kleinen Kacheln sparen sich
  den Layer.
- **Auf die Ecken sehen.** Oben rechts an jedem Paneel sitzt die Schräge mit
  Haarlinie. Zu dezent? Zu viel?
- **Segmentbalken:** Widerstand/Verfügbar in der Mitte, Häufigkeit bei den
  Fundorten. Aus den Mockups übernommen — tragen sie, oder ist die Zähnung nur
  Unruhe bei 5 px Höhe?
- **Der Grund ist absichtlich kein Foto:** weicher Lichtabfall in Teal und
  Bernstein plus ein sehr feines 34-px-Raster. Genug, damit der Weichzeichner
  etwas zu tun hat — wenig genug, um nicht Leinwand zu sein.

## Für den echten Bau notiert

- **Fünf** innen scrollende Kästen (3 Spalten + 2 Teilspalten), alle nach
  `assets/mobile-ux.css:503-516`, sonst unsichtbar scrollbar.
- Glasflächen **ausschließlich** über `--glass-*`-Token, nie direkt. Sonst kein
  Hellmodus.
- `clip-path` auf Paneelen bleibt verboten, solange `backdrop-filter` im Spiel
  ist. Die Schräge kommt aus dem Pseudo-Element-Verlauf.
- Bei `prefers-reduced-transparency` (und als Rückfall) muss `--glass-bg` auf
  eine deckende Farbe umschalten — dann fällt der Weichzeichner ohnehin weg.
