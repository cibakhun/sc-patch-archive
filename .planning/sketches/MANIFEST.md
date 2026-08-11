# Sketch Manifest

## Design Direction

VerseBase gibt jeder Seite eine eigene Design-Welt — Patch-Seiten je eigene Palette,
das Archiv als „Stellar Cartography", der Kontobereich als „mobiGlas OS", die
Verzeichnisse als „Registry-HUD". Der genehmigte UI-Vertrag für die Unterstützen-Seite
lieferte einen sauberen Rahmen (Token, Kontraste, Zustände, Textpaare), aber keine
eigene Handschrift: er sagte im Kern „mach's wie die Feedback-Seite, nur in Gold".
Auf dieser Seite wäre das unter Standard. Die Skizzen suchen deshalb nicht nach
Dekoration, sondern nach der Frage, **was die Seite anführt**.

Gemeinsame Formensprache aller Entwürfe (aus dem Bestand übernommen, nicht erfunden):
Orbitron als Anzeigeschrift, Barlow als Fließtext, Mono für Mikro-Beschriftungen;
weit gesperrte Versal-Mikrolabels; angeschrägte Ecken über `clip-path`; 1-px-Linien
in `--line`; technische Zeichnungsstriche (1.7, gerade Enden, spitze Ecken) für
Grafiken; Filmkorn und Schleier über Fotos; genau EIN Akzent je Fläche; Bewegung
nur als Verstärkung.

## Reference Points

Keine externen Vorbilder — die Referenz ist die eigene Seite. Konkret herangezogen:
`assets/detail.css` (Signatur-Look), `src/components/PatchArchive.astro`
(Stellar Cartography), `src/components/RefineryFinder.astro` und
`src/components/PrecisionJumpApp.astro` (HUD-Identitäten der Werkzeugseiten),
`src/pages/feedback.astro` (nächstverwandtes Seitenpaar).

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | support-page-identity | Was führt die Unterstützen-Seite an — das defekte Teil, die Stimme des Betreibers oder die Leute, die schon tragen? | **A — Instandsetzung** (02.08.2026), mit Verschiebung auf den Arbeitsverlust statt auf den Sachschaden | support, identity, payments |
| 002 | mining-werkbank-raster | Passen drei Spalten plus eingefaltetes Fracturing und Refinery bei 1280×720 — und wo kostet die Rig-Leiste am wenigsten? | **D — Leiste unten, mit dem Sockel verschmolzen** (11.08.2026). Vom Nutzer eingebracht, schlägt alle drei Vorlagen gleichzeitig: erste Mineralzeile 162 px, 12 Zeilen über der Falz | layout, mining, werkbank, hoehenbudget |

## Zweite Design-Welt: „Werkbank" (ab 002)

Die Mining-Werkbank ist die erste **Werkzeugoberfläche** unter den Design-Welten
und spricht deshalb eine eigene Sprache: **Argo-Industrie × altes Regolith** —
ein Maschinenpult, das zufällig eine Webseite ist. Matte Flächen, gekantete
Blechkanten (1 px Lichtkante oben statt Leuchten), Schablonen-Mikrolabels,
Zahlen in Mono, Warnstreifen nur dort, wo etwas *eingestellt* wird.

**Bewusst NICHT benutzt** (obwohl im Bestand vorhanden): `--glow` (`0 0 44px`)
aus `mining.astro:30`, `-webkit-text-stroke` an Abschnittsnummern, Verlaufstext,
Scanlines, Neon-Lämpchen. Die Zustandslämpchen sind mattes Oliv `#8FB339` /
Bernstein `#E0A526` / Rost `#B4543A` — Maschinenpult, nicht Ampel.

**Palette unverändert übernommen** aus `mining.astro:30`; geändert hat sich nur
der Umgang: `--accent-2` (`#E0A526`, faktisch Argo-Bernstein) ist die
**Arbeitsfarbe**, `--accent` (`#2FBFA4` Teal) sinkt auf reine Information ab
(Signaturwerte, Häufigkeitsbalken).

## Übernommene Befunde aus dem Bestands-CSS

Beim Bauen der Skizze gefunden, betrifft den echten Bau:

| Fund | Folge für die Umsetzung |
|---|---|
| `detail.css:58` stylt blankes `section` mit `padding: clamp(3rem,7vw,5.5rem)` | Jedes `<section>` auf der neuen Seite erbt still große Polsterung — dieselbe Falle, die schon das Konto-Panel getroffen hat (Karten mussten dort zu `<div>` werden) |
| `detail.css:337` gattert bei reduzierter Bewegung nur `animation`, nicht `transition` | Der Balken-Übergang, den der UI-Vertrag §4 bewegungsgegattert verlangt, liefe trotzdem — braucht eine eigene Medienabfrage |
| `detail.css:40` setzt `:focus-visible { outline: 2px solid var(--accent-2) }` | `spt-*`-Bedienelemente ohne eigene Regel bekämen `#ffcf7a` statt des vorgeschriebenen Goldes |
| Transformationen verkleinern die Scrollbox nicht, und `theme.css` versteckt jede Leiste mit `!important` | Entstehender Überlauf ist unsichtbar, aber real — die Seite zieht sich seitlich, ohne dass man erkennt warum. In der Skizze gemessen: 23 px bei 360 px durch ein `translateX(-100%)`-Label |
| `transition` auf `max-width` eines `container-type: inline-size`-Elements | Friert den berechneten Wert auf `100%` ein |

## Bestätigte Korrektur

Die im UI-Vertrag notierte Dateikorrektur trägt: `assets/edge-fade.js` existiert in
diesem Worktree nicht, und `mask-image` kommt in `assets/mobile-ux.css` nicht vor.
Die Skizze umgeht das Problem über den im Vertrag ausdrücklich erlaubten billigeren
Weg — feste Eintragszahl statt Scrollbox.
