---
title: "Mining-Werkbank: die Defekte der zweiten Fassung — Befunde, Ursachen, Gegenprobe"
date: 2026-08-11
context: "Abnahme der zweiten Fassung: „die Arbeit dient nur als Grundlage, man kann noch diverse Verbesserungen vornehmen“"
branch: claude/mining-site-rework-34e03f
---

# Mining-Werkbank: die Defekte der zweiten Fassung

Alle Befunde am **gebauten** Stand erhoben (`dist/topics/mining.html`), die
sichtbaren zusätzlich im echten Chrome gerendert und vermessen — 1280×720,
1920×1080, 390×844, DE und EN. Grundsatz 7: gegen das Artefakt prüfen.

## Was gehalten hat

Die Kernbehauptung des Umbaus stimmt: **37 von 37 Kacheln** stehen bei
1280×720 *und* 1920×1080 ohne Scrollen über der Falz, `scrollHeight ==
clientHeight`, 0 px Überlauf. Erste Kachel bei 272 px.

## Der teuerste Befund: ein stiller Fehlgriff auf den Feldnamen

`MiningWorkbench.astro` las `l.slots`. Das Feld heißt in `mining-model.json`
**`moduleSlots`**. `|| 0` fing den Fehlgriff auf, ohne zu mucken.

Am ausgelieferten Payload nachgewiesen: **Summe aller `slots` über alle 14
Laser = 0.** Folge, in dieser Reihenfolge:

1. `usable = i < (L.slots || 0)` ist für alle drei Steckplätze falsch → alle
   drei Modulknöpfe dauerhaft `disabled`.
2. Der Tooltip behauptete „Dieser Laser hat nur 0 Modulplätze“. Die Helix II
   hat drei.
3. Die **26 Module** lagen im Payload und waren unerreichbar.
4. `dpsMult` blieb dadurch immer `1` — die Brech-Rechnung, also die zentrale
   Aussage des Werkzeugs, **ignorierte Module vollständig**.

Gleiche Bauart wie der `maxSize`-Fehlgriff bei den Schiffs-Bauteilgrößen.
Merkposten: `|| 0` und `|| {}` auf einem geratenen Feldnamen erzeugen ein
funktionierendes, leeres Werkzeug.

## Die übrigen Befunde

| # | Befund | Beleg |
|---|--------|-------|
| 1 | Modulplätze überall 0 | Payload: Summe `slots` = 0 |
| 2 | Anheft-Stern auf Touch unerreichbar (`opacity:0`, nur `:hover`) | im Handy-Kontext gemessen: `opacity` = 0. Damit ist die Signaturen-Spalte auf Touch dauerhaft leer — obwohl ihr eigener Hinweis genau auf diesen Stern verweist. Mit Tastatur: fokussierbarer, unsichtbarer Halt (WCAG 2.4.7) |
| 3 | Stationswahl wirkungslos | `S.ref` wird gespeichert und löst ein Neuzeichnen aus, aber `renderDetail()` liest es nie |
| 4 | Schiff-Verweise für alle 37 Erze gleich | `D.ships.slice(0,3)` — Prospector/MOLE/Golem auch unter den **11** Erzen, die sich nicht per Schiff abbauen lassen |
| 5 | Methoden-Marke falsch | vier Werte in den Daten (ship 26, roc 4, fps 4, hand 3), im Code `method === 'ship' ? Schiff : Hand` → die vier ROC-Erze standen als „Hand“ da |
| 6 | Rohe Fließkommazahlen | „28.29999923 78.30000305 %“, in 44 px Breite über drei Zeilen umbrechend |
| 7 | Interne Bezeichner im sichtbaren Text | „LegendaryShipMineablesAsteroid_Quantainium“, „FelsicDeposit_Aluminium“ — `.replace(/_/g,' ')` entfernt nur Unterstriche |
| 8 | Hilfetext beschrieb das abgelöste Werkzeug | alle vier Schritte nannten Sortierung, Raster/Liste, Methoden-/Typfilter, „Fundorte nach Himmelskörper“ — nichts davon existiert in der Werkbank. Dazu neun `mining.ctl.*` für verschwundene Knöpfe, DE und EN |
| 9 | Element-Hilfe (Stufe 2) komplett verloren | **0** `data-help` in der Werkbank gegen 8–10 in jedem anderen Werkzeug |
| 10 | Erstbesuch: Hilfe deckt die Mineralliste zu | `tool-help.js:43` öffnet jeden ungesehenen Abschnitt; der Körper liegt `position:absolute` über dem Kachelraster |
| 11 | Brotkrume überlappt die Eyebrow-Zeile auf 390 px | Hero rechnet mit `padding-top:4.4rem` = 70 px, die Leiste meldet mit sichtbarer Zurück-Marke `--nav-h: 116px` (SiteNav:877) |
| 12 | 1.366 Zeilen toter Code | `MiningApp.astro` (421), `mining-app.js` (319), `SignatureIdentifier.astro` (343), `FracturingCalc.astro` (283) — von keiner Seite mehr eingebunden |

## ⚠⚠ Die Torlücke — und die Gegenprobe

`verify:help` Zusicherung 6 verlangte „**jede Seite** mit `data-tool-id` trägt
mindestens einen `data-help`-Anker“.

Die Mining-Seite trägt **zwei** Werkzeuge: `mining` (Werkbank) und
`refineryfinder` (Abschnitt darunter). Als die Werkbank sämtliche Anker
verlor, hielten die **drei Anker des Refinery-Finders** die Seite grün. Das
Tor meldete „erfüllt“, während der Knopf „Elemente erklären“ der Werkbank nur
noch fremde Elemente weit außerhalb des Blickfelds hervorhob — Stufe 2 ist
seitenweit (`html[data-help-on] [data-help]`), nicht je Werkzeug gefasst.

Zusicherung 6 zählt jetzt **je Werkzeug**. Zuordnung über die
Dokumentreihenfolge: ToolHelp steht in jedem Werkzeug am Kopf seiner eigenen
Filterleiste, die Bedienelemente folgen; alles bis zum nächsten
`data-tool-id` gehört dazu. Mehrfachvorkommen derselben Kennung (ToolHelp
setzt sie auf `<details>` **und** auf den Knopf) zählen einmal.

**Vorgeführt rot** (Grundsatz 1) — das neue Tor gegen das *alte*, defekte
`dist/`, also bevor die Anker nachgerüstet waren:

```
[6] Element-Hilfe je WERKZEUG (WR-05): jedes data-tool-id verlangt >=1 eigenen, nicht-leeren data-help-Anker
  FEHLER: dist/de/topics/mining.html: Werkzeug "mining" hat KEINEN eigenen data-help-Anker
  FEHLER: dist/topics/mining.html: Werkzeug "mining" hat KEINEN eigenen data-help-Anker
    Gepruefte Werkzeug-Vorkommen: 22   ohne eigenen Anker: 2   mit leerem Wert: 0   Soll: 0 / 0

verify-help: FEHLGESCHLAGEN ✗
```

Die übrigen **20** Werkzeug-Vorkommen (11 Werkzeuge × 2 Sprachen, minus die
zwei beanstandeten) bestanden — die Zuordnung über die Dokumentreihenfolge
trägt also für alle elf Werkzeuge, nicht nur für das eine.

## Offenes Sichturteil: die Hilfe beim Erstbesuch

Der Hilfe-Körper liegt über dem Kachelraster, und `tool-help.js:43` klappt ihn
beim Erstbesuch selbsttätig auf (D-09). Der Text stimmt jetzt, der Kasten ist
von 400 auf **244 px** eingeschnürt — aber der erste Eindruck bleibt eine
teilweise zugedeckte Mineralliste. Vollständig lösen lässt sich das hier
nicht, und die Wege dorthin sind **vorgeführt**, nicht vermutet:

| Weg | Ergebnis |
|-----|----------|
| Weiter einschnüren | hilft nicht — das Raster ist rund 330 px hoch und beginnt direkt unter der Filterleiste; jede für vier Schritte brauchbare Kastenhöhe deckt es zu |
| ⚠ **Neben die Spalte legen** (`left:calc(100% + 10px)`) | **Sackgasse, ausprobiert und zurückgenommen.** `.wb__pane` trägt `overflow:hidden` → der Kasten wird restlos weggeschnitten, die Hilfe ist **unsichtbar**. Schlimmer als zugedeckt. Nicht noch einmal versuchen |
| Auto-Öffnen für `mining` abschalten | bräche den geteilten Onboarding-Vertrag D-09 |
| `ToolHelp` aus der Spalte über das Raster heben | kostet rund 30 px Höhenbudget und fasst die sorgfältig vermessene Falz-Zusicherung an |

Die letzten beiden sind **Produktentscheidungen**, keine Fehlerbehebungen —
sie gehören dem Betreiber, nicht diesem Durchgang. Die Hilfe öffnet sich
einmal je Browser und schließt mit einem Klick auf ihre Überschrift.

## Nicht angefasst — bewusst

Der Nutzer hat den Umfang auf Defekte und Liegengebliebenes begrenzt. Offen
bleiben damit, alle belegt:

- **Kein Preis.** `assets/refinery-data.json` trägt UEX-Verkaufspreise für
  **26 der 37** Erze (`sell`, `sellMax`, `sellLoc`); die Werkbank nutzt sie
  nicht. „Was ist das wert?“ ist beim Mining die erste Frage.
- **Cluster-Obergrenze erfunden.** `MAXCLUSTER` (common 6 … legendary 2)
  steht so nicht in den Daten; `clusterFactor` liegt für alle 38 Elemente
  vor. Bei Quantainium endet die Reihe deshalb bei ×2 (6.340) — ein Scan von
  9.510 findet nichts.
- **Lagrange-Punkte werden weggeworfen.** 30 der 273 Fundorte tragen `points`
  (Lagrange D → ARC-L3, CRU-L5, MIC-L4); das Mapping lässt das Feld fallen.
- **Keine Sortierung** der 37 Kacheln.
- **Ungenutzte Fläche** bei 1920×1080: 390 px unter den Kacheln, die gesamte
  Signaturspalte (844 px) leer, bis etwas angeheftet ist.
- **`RefineryFinder` doppelt die Mittelspalte** — beantwortet „welche
  Station?“ ein zweites Mal aus einer anderen Datei.
- **Physik-Werte werden bei 1280 mitten durch die Zahl abgeschnitten**, weil
  die Mittelspalte dort zweizeilig stapelt.
