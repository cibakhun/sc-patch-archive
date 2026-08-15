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
| 003 | mittelspalte-dichte | Passen Identität, Fundorte, Physik, Urteil und Refinery in EINE Spalte — und wenn nein, was gibt nach? | **C — zweispaltig innerhalb der Spalte** (11.08.2026, nur strukturell). Die befürchtete Überfüllung war ein Ein-Spalten-Problem: bei 768 px Breite passen alle 10 Fundorte plus Refinery ohne Scrollen und ohne Klick, mit 298 px Luft | layout, mining, werkbank, dichte |
| 004 | verarbeitungsgrad | Wie hochwertig muss die Werkbank verarbeitet sein, um neben einem Panel aus dem Spiel zu bestehen — ohne generisch zu werden? | **A — Zurückgenommen** (11.08.2026). Verarbeitung wäre budgetär gratis gewesen (0 px Überlauf in allen drei Stufen) — gewählt wurde trotzdem der schlichteste Weg: „hochwertig" heißt hier Präzision, nicht Detail | design, mining, werkbank, verarbeitung |
| 005 | paneel-sprache | Wie viel Glas trägt die Werkbank, wenn der Foto-Hintergrund gestrichen ist, der das Glas in den Mockups erst lesbar macht? | **D — Glas nur tragend + reicherer Grund** (11.08.2026) — ⚠ **überholt durch 006**. Bleibende Befunde: Schräge geht ganz ohne `clip-path` (840-ms-Falle baulich ausgeschlossen); Flächenfarben müssen Variablen sein, sonst kein Hellmodus | design, mining, werkbank, glas, ueberholt |
| 009 | chassis-svg | Bekommt man ein gefrästes Gehäuse aus Code — oder braucht es eine Grafik? | **Beantwortet: es braucht eine Grafik** (15.08.2026). feSpecularLighting liefert echte Fräskanten, aber kein Material. Bleibt als Rückfallweg | design, mining, werkbank, svg, sackgasse |
| 008 | gehaeuse-1zu1 | Das Gehäuse aus Bild 2 ohne Abschwächung — trägt es, und was kostet es? | offen (15.08.2026) — A voll 219 px Aufschlag, B schlank 189 px; B belegt, was Sparen kostet | design, mining, werkbank, gehaeuse |
| 007 | gehaeuse-rahmen | Wie viel Gehäuse verträgt die Werkbank, bevor der Rahmen die Daten verdrängt? | offen (15.08.2026) — A 124 px / B 163 / C 187 Aufschlag, alle ohne Überlauf | design, mining, werkbank, gehaeuse, violett |
| 006 | baujahr-2026 | Wie sieht die Werkbank aus, wenn sie aussehen soll, als wäre sie 2026 entworfen worden — industriell, modern, nicht futuristisch? | **A — Ruhig** (11.08.2026). **Endstand der Gestaltungssprache.** Radius 12/8/6, Sans-Labels in Satzschreibung, Mono nur für Zahlen, Flächenabstufungen statt Ränder, Farbe nur für Zustand. Kostet 52 px und 3 Mineralzeilen gegen die HUD-Sprache — bewusst bezahlt | design, mining, werkbank, modernitaet |

## Zweite Design-Welt: „Werkbank" (ab 002) — ENDSTAND aus Skizze 006 A

Die Mining-Werkbank ist die erste **Werkzeugoberfläche** unter den Design-Welten.
Der Weg dahin ging über drei Vorgaben des Nutzers, die einander präzisierten:

1. *„Argo-Industrie × altes Regolith, so hochwertig wie ingame panels, nur nicht
   so generisch"* → Skizze 004
2. Zwei KI-Mockups mit Glas, Schräge, Segmentbalken → Skizze 005
3. **maßgeblich:** *„industrial, modern but not futuristic design that looks like
   something that got designed in 2026"* → **Skizze 006, Variante A = Endstand**

**Die Sprache der Werkbank:**

- **Radius 12 / 8 / 6.** Nicht darunter — unter 8 px kippt es ins
  Retro-Technische. Der Radius ist der stärkste Jahreszahl-Verräter überhaupt.
- **Labels in Sans, Satzschreibung, normale Laufweite.** „Widerstand", nicht
  „WIDERSTAND". Zweitgrößter Jahreszahl-Unterschied nach dem Radius.
- **Mono ausschließlich für Zahlen**, tabellarisch, leicht negativ gesperrt.
- **Flächenabstufungen `--s0…--s3` statt Rändern**, dazu weiche, große, flache
  Schatten. Fast keine Haarlinien.
- **Fast monochrom. Farbe nur als Bedeutungsträger:** Bernstein `#E0A526` =
  Auswahl/Handlung, Teal `#2FBFA4` = Signaturwert, Grün/Gelb/Rot = Brechbarkeit.
- **Polsterung 12–18 px.** Zustandsanzeige = runder matter Punkt, 8 px, ohne
  Rahmen und ohne Schein.
- **Ausnahme, die bleibt:** Qualitätsstufen sind segmentiert — dort *sind* die
  acht Segmente die Daten.

**Geprüft und verworfen** (Belege liegen in den Skizzenordnern, damit die Fragen
nicht neu aufgemacht werden): angeschrägte Ecken (004/005), versenkte Wannen,
erhabene Platten, Eckwinkel, Passkreuz, Materialkorn, Urteil als Messgerät
(004); Glas mit `backdrop-filter`, gezähnte Balken, Warnstreifen, Versal-Mono-
Mikrolabels (005); Foto-Hintergrund, schwebender 3D-Brocken, Sparklines an jeder
Kennzahl, Radialanzeigen (aus den Mockups, nie gebaut). Nie infrage gekommen:
`--glow` (`0 0 44px`) aus `mining.astro:30`, `-webkit-text-stroke`,
Verlaufstext, Scanlines, Sechsecke, Neon.

**⚠ Zwei Bauregeln, die aus den Skizzen stammen und nicht verhandelbar sind:**

- **Flächenfarben MÜSSEN CSS-Variablen sein.** `build-light-overrides.mjs:85`
  kennt nur `color`/`border-*-color`/`outline-color`/`fill`/`stroke` — kein
  `background`, kein `box-shadow`. Nur Variablen (`:228`) erzeugen überhaupt
  eine Hell-Entsprechung. Fest verdrahtete Flächen haben still keinen Hellmodus.
- **Kein `clip-path` auf Paneelen, solange `backdrop-filter` im Spiel ist** —
  genau diese Paarung drückte den Menü-Eintritt auf 840 ms (nachher 320 ms). Im
  Endstand ist beides ohnehin nicht mehr vorhanden.

**Preis der Moderne, offen benannt:** 52 px und 3 Mineralzeilen gegen die
HUD-Sprache aus 005 — 9 statt 12 Zeilen über der Falz bei 1280×720. Bewusst
bezahlt.

## ⚠ Endstand 006 gegen den gebauten Stand (15.08.2026)

Der oben notierte „Endstand der Gestaltungssprache" (006 A, „Ruhig") beschreibt
den **gebauten Stand nicht mehr**. `MiningWorkbench.astro:406ff` trägt Glas
(`backdrop-filter: blur(14px) saturate(1.2)`), eine angeschrägte Ecke (`.chamf`)
und gezähnte Segmentbalken — alles drei ist in 005/006 ausdrücklich verworfen
worden und im Code trotzdem vorhanden. Wer 006 als geltende Vorgabe liest,
liest an der Seite vorbei. Skizze 007 schreibt deshalb den **Ist-Zustand** fort,
nicht den Endstand; mit ihrer Entscheidung ist der Abschnitt oben nachzuziehen.

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
