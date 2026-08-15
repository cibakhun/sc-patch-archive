---
phase: 12
slug: fundorte-in-der-mining-werkbank-anklickbar
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-15
---

# Phase 12 — UI Design Contract

> Design-Vertrag für „Fundorte in der Mining-Werkbank anklickbar". Diese Phase
> fügt der bestehenden Werkbank (`src/components/MiningWorkbench.astro`,
> `assets/mining-workbench.js`) sechs neue Oberflächen hinzu — keine neue
> Seite, keine neue Komponente, kein neues Werkzeug. Dieser Vertrag EXTRAHIERT
> deshalb die geltende visuelle Sprache aus dem bereits ausgelieferten
> `<style is:inline>`-Block (Zeilen 423–815) und erweitert sie nur an den
> sechs von `12-CONTEXT.md` benannten Stellen. Es wird nichts Neues erfunden,
> was der Bestand schon hat.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — kein shadcn, keine Komponentenbibliothek. `components.json` existiert nicht im Repo |
| Preset | not applicable |
| Component library | none — handgeschriebenes Astro `<style is:inline>` + ES5-IIFE-Vanilla-JS (`assets/mining-workbench.js`), kein Radix/Base UI |
| Icon library | none als Paket — ein einziges inline `<svg class="wb__sprite">` mit `<symbol>`-Einträgen (`#wb-i-pin`, `#wb-i-edit`, `#wb-i-trash`, `#wb-i-save`), referenziert über `<use href="#…">`. Alle Symbole: `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`, `viewBox="0 0 24 24"`, fill `none`. Diese Phase reiht sich mit **einem neuen Symbol** (`#wb-i-back`, Zurück-Pfeil) in exakt dieselbe Familie ein — kein neuer Zeichensatz, kein Icon-Font, kein Emoji |
| Font | `var(--font-ui, system-ui)` für Fließtext, `var(--font-mono, ui-monospace)` für Zahlen (`.num`) — beides bereits global gesetzt in `.wb{…}`. Diese Phase führt keine neue Schriftfamilie ein |

Kein `npm install`, keine neue Abhängigkeit — deckt sich mit `12-RESEARCH.md`
§ Standard Stack (Konfidenz HIGH).

---

## Spacing Scale

**Abweichung vom Vorlagen-Raster, bewusst dokumentiert statt stillschweigend
verletzt:** Anders als Schrift und Bewegung (`--fs-*`, `--ls-*`, `--dur-*` in
`assets/theme.css`, seit Phase 2 eine benannte, gemessene Token-Schicht) hat
dieses Projekt **keine** Abstands-Token-Schicht. `CONVENTIONS.md` nennt
Farb-, Schrift- und Bewegungsregeln als „load-bearing", aber kein
4-px-Abstandsraster. Die tatsächlichen Werte in `.wb__*` sind ad hoc gemessen
(3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 16, 22, 28 px …) und folgen keinem
gemeinsamen Vielfachen. Ein neu erfundenes 4-px-Raster für nur sechs neue
Elemente würde die Werkbank optisch spalten, nicht vereinheitlichen. Diese
Phase hält sich deshalb an die **bereits vorhandenen, benachbarten** Werte
statt neue zu erfinden — das ist die tatsächliche Hausregel („Werte kommen
aus Nachbarelementen, nicht aus einer Tabelle").

| Verwendungszweck | Gemessener Wert (Bestand) | Fundstelle | Gilt für |
|---|---|---|---|
| Zeilen-internes Gap (Name/Unterzeile ↔ rechter Block) | `10px` | `.wb__row2{gap:10px}` (Z. 581) | neue klickbare Zeilen (Fundort- UND Erzzeile) — unverändert übernehmen |
| Zeilen-Innenabstand | `5px 9px` | `.wb__row2{padding:5px 9px}` (Z. 582) | dito |
| Kopf-Innenabstand (Spalte 2) | `11px 14px 9px` | `.wb__id{padding:11px 14px 9px}` (Z. 554) | Fundort-Kopf (Ersatz für `.wb__id`) — **exakt übernehmen**, nicht vergrößern (Pitfall 6, `--wb-chrome`-Budget) |
| Abstand Titel → Unterzeile im Kopf | `6px` (margin-top) | `.wb__tags{margin-top:6px}` (Z. 557) | Abstand h2 → Art-·-System-·-Anflugpunkte-Zeile |
| Icon-Knopf, quadratisch | `28×28px` sichtbar, `40×36px` Tippziel über `::before` | `.wb__pin` (Z. 535–544) | Zurück-Pfeil-Knopf im Fundort-Kopf |
| Kleines Icon in einem 28-px-Knopf | `15×15px` (bzw. `13×13px` bei den 22-px-Knöpfen) | `.wb__pin__i`/`.wb__lpin__i` | Zurück-Pfeil-Glyphe: `17×17px`, wie `.wb__pinbig__i` — der Zurück-Knopf ersetzt den großen Anheft-Knopf an derselben Stelle, nicht den kleinen |
| Badge/Pille-Innenabstand | `2px 7px`, `border-radius:999px` | `.wb__tag` (Z. 558) | „Spur"-Abzeichen — exakt übernehmen |
| Abschnitts-Innenabstand | `0 14px 11px` | `.wb__sec` (Z. 575) | jede Methodengruppe (wiederholtes `.wb__sec`) |
| Abstand Überschrift → Zeilenliste | `7px` (margin-bottom) | `.wb__sec h4{margin:0 0 7px}` (Z. 576) | Methodengruppen-Überschrift → ihre Erzzeilen |
| Reihen-Zwischenraum in einer Liste | `3px` | `.wb__locs,.wb__refs{gap:3px}` (Z. 580) | Erzzeilen innerhalb einer Methodengruppe |

Exceptions: keine — jeder oben gelistete Wert IST die Ausnahme vom
Vorlagen-Raster, mit Fundstelle belegt statt neu erfunden.

---

## Typography

Ebenfalls extrahiert, nicht neu erfunden. Basis: `html{font-size:112.5%}` in
`Layout.astro` → **1 rem = 18 px** auf dieser Seite (Kommentar
`assets/theme.css:346`).

| Role | Größe | Gewicht | Zeilenhöhe | Fundstelle / Verwendung in dieser Phase |
|------|-------|---------|------------|------------------------------------------|
| Badge/Pille | `var(--fs-3)` = 11,7 px | 400 (ererbt) | 1 (Pillenhöhe) | `.wb__tag` — Vorbild für das „Spur"-Abzeichen |
| Label | `var(--fs-4)` = 12,6 px | 600 | 1.3 (Komponentenbasis) | `.wb__sec h4`, `.wb__lbl` — Methodengruppen-Überschrift, Zurück-Knopf-Beschriftung falls sichtbar |
| Body | `var(--fs-5)` = 13,5 px | 500 | 1.3 | `.wb__row2 .p`, `.wb__tn` — Zeilentext (Fundort- **und** Erzzeile), Unterzeile in `.s` bei `var(--fs-3)` |
| Heading | `var(--fs-13)` = 23,4 px | 600 | 1.05 | `.wb__id h2` — Fundort-Name im neuen Kopf, wortgleiche Regel wie der bisherige Erz-Name |

Vier Größen, zwei Gewichte (500/600) — erfüllt die 3–4-Größen-/2-Gewichte-Vorgabe,
weil es die bereits im Bestand benutzte Teilmenge ist. Eine „Display"-Stufe
gibt es in diesem Panel nicht: `--fs-13` ist bereits die größte Schrift, die
in `.wb__pane`-Kästen vorkommt (der Rest der Seite geht höher, aber das ist
außerhalb dieser Phase).

---

## Color

Palette-Quelle: `src/components/topics/mining.astro:26/28` (Dunkel/Hell).
Dunkel: `--accent:#2FBFA4` (Teal), `--accent-2:#E0A526` (Amber-Gold),
`--bg:#14181a`, `--surface:#1e2427`. Hell: `--accent:#036a5a`,
`--accent-2:#704f00`. `--hot` ist auf dieser Seite **identisch mit
`--accent`** (kein separater Gefahrton) — laut Kopfkommentar der Komponente
KEIN neuer Farbtoken für diese Phase, jede Fläche über `color-mix()` gegen
bestehende Variablen.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--bg)` / `var(--surface)` (über `color-mix(in srgb,var(--surface) 78%,transparent)` an den Glas-Paneelen) | Seiten- und Panelfläche — unverändert |
| Secondary (30%) | `color-mix(in srgb,var(--ink) 22–34%,transparent)` — die „Tinten-Wäsche" | Zeilen-, Kachel-, Chip-, Preset-Flächen — Fundort-Kopf, Methodengruppen-Zeilen und das „Spur"-Abzeichen (gedämpfte Variante) benutzen dieselbe Formel |
| Accent (10%) | `var(--accent)` (Teal dunkel / dunkles Teal hell) | **Ausschließlich:** Chance-Balkenfüllung (`.wb__bar i`), Signaturzahl auf der Kachel (`.wb__ts`), Crafting-/Schiffs-Verweis-Text (`.wb__link b`), Fracturing-CTA-Icon — **und NEU in dieser Phase:** die Kachel-Markierung „Erz kommt an diesem Fundort vor" (D-09) |
| Destructive | nicht verwendet in dieser Phase | Diese Phase führt keine löschende/zerstörende Handlung ein (die bestehende Löschbestätigung `.wb__pre-ask` bleibt unangetastet, D-10) |

**Zweiter Zustands-Akzent, getrennt von der 10-%-Zeile geführt, weil er eine
andere Bedeutung trägt:** `var(--accent-2)` (Amber-Gold) ist site-weit in
dieser Werkbank **ausschließlich** für „an/ausgewählt/angeheftet" reserviert:
`.wb__tile.is-sel`, `.wb__pin.is-on`, `.wb__lpin.is-on`, `.wb__pinbig.is-on`,
`.wb__chip.is-on`, `.wb__row2.is-pick`, `.wb__pre-item.is-sel`,
`.wb__pre__b.is-go`. **Diese Phase fügt dieser Liste NICHTS hinzu.** Die neue
Zeilen-Klickbarkeit (D-01/D-02) und der Zurück-Knopf dürfen `--accent-2`
NICHT für ihren Hover-/Fokus-Zustand verwenden — das würde fälschlich „schon
angeheftet/ausgewählt" signalisieren, wo tatsächlich nur „hier kann man
klicken" gemeint ist. Hover einer neu klickbaren Zeile benutzt stattdessen
denselben neutralen Hover wie `.wb__tile:hover`:
`color-mix(in srgb,var(--surface-2) 88%,var(--text))`.

Accent reserved for: Chance-Balken, Kachel-Signaturzahl, Crafting-/Schiffs-Link-Zahl,
Fracturing-CTA-Icon, **und (neu) die Kachel-Fundort-Markierung**. Nichts sonst — insbesondere
NICHT der Zeilen-Hover, NICHT der Zurück-Knopf im Ruhezustand (der bleibt
neutral/gedämpft wie `.wb__pin` im Ruhezustand).

---

## Copywriting Contract

Zweisprachig zwingend: `assertMiningLangParity()`
(`MiningWorkbench.astro:199-213`) bricht den Build ab, wenn `S_DE`/`S_EN`
auseinanderlaufen. Jede Zeile unten ist ein Vorschlag für Wortlaut — die
exakte Schlüsselbenennung liegt laut `12-CONTEXT.md` „Claudes Ermessen" beim
Planer/Executor, die Parität ist ohnehin maschinell erzwungen.

| Element | Copy (DE) | Copy (EN) |
|---------|-----------|-----------|
| Primary CTA | **entfällt.** Diese Phase fügt keinen neu beschrifteten Haupt-Knopf hinzu — das Klickziel ist die **ganze Zeile** (D-01/D-02), kein Button mit Textlabel. Die bestehende Fracturing-CTA („Bricht der Brocken? →") bleibt unverändert (D-10) | — |
| Zurück-Knopf (aria-label + title, icon-only wie `.wb__pin`) | „Zurück zur Erz-Ansicht" | „Back to ore view" |
| „Spur"-Abzeichen (Text, wie `.wb__tag`) | „Spur" | „Trace" |
| Methodengruppen-Überschrift | `{methodLabel}` (`T.ship`/`T.hand`/`T.roc`, bereits vorhanden) + `' · ' + Anzahl` — **kein neuer Text**, exakt das Muster von `#wb-loch` (`T.locations + ' · ' + locs.length`) | dito |
| Fundort-Kopf-Unterzeile | `{Art} · {System}` (`locSub()`, vorhanden) + optional `· {Anflugpunkt, Anflugpunkt, …}` bei Lagrange-Punkten — **kein neuer Text**, nur eine neue Zusammensetzung: `locName()` hängt die Anflugpunkte heute an den NAMEN (Überschrift); im Kopf gehören sie laut D-11 in die Unterzeile, NICHT in die `<h2>` | dito |
| `mining.ctl.locpin` (Hilfetext, MUSS aktualisiert werden — Pitfall 1) | „Die ganze Zeile öffnet diesen Fundort; die Nadel rechts heftet ihn zusätzlich an die Fundort-Merkliste darunter." | „The whole row opens this location; the pin on the right additionally pins it to the shortlist below." |
| `mining.ctl.shortlist` (Hilfetext, MUSS aktualisiert werden — dieselbe Zeile ist jetzt auch hier klickbar, D-03) | „Die angehefteten Fundorte über alle Erze hinweg, als „Erz — Fundort". Klick öffnet den Fundort, das × löst ihn." | „The pinned locations across every ore, as “Ore — Location”. Click opens the location, the × unpins it." |
| Empty state heading | nicht anwendbar — jeder der 45 Fundorte hat mindestens 6 Erze (gemessen, `12-RESEARCH.md`); ein leerer Zustand kommt in der Fundort-Ansicht nicht vor | — |
| Empty state body | bereits vorhanden, unverändert wiederverwendet: `T.noLocs` = „Keine Fundorte bekannt." / „No locations known." — gilt weiterhin für ein Erz OHNE Fundorte (Erz-Ansicht), nicht für die neue Fundort-Ansicht | dito |
| Error state | **kein neuer Fehlertext.** Ein unbekannter `?fundort=`-Wert fällt still auf die Erz-Ansicht zurück — exakt das bestehende `?mineral=`-Verhalten (`12-RESEARCH.md` Pattern 3, sicherheitsrelevant: Allow-List-Abgleich, roher Query-Wert wird nie gerendert). Eine sichtbare Fehlermeldung wäre hier ein NEUES, unbegründetes Muster |
| Destructive confirmation | nicht anwendbar — diese Phase führt keine löschende Handlung ein | — |

---

## UI Considerations

> Populated by the ui-phase UI-consideration probe (Step 9.5) and lifted by plan-phase's
> `## UI Considerations` lift rule via the identical rule as SPEC `## Edge Coverage`. Shape-rooted UI *state*
> coverage (empty / loading / error / populated / partial / overflow / zero-one-many / long-text).
> Empty-state and error-state COPY live in `## Copywriting Contract` above — this section covers
> state coverage and REFERENCES those rows rather than restating the copy (de-dup).

Applicable state considerations resolved: {N covered, M backstop, K unresolved — or "none applicable"}

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| {empty} | {list-collection} | ✅ covered | {concrete truth string — e.g. "Empty results render the documented 'No results' copy"} |
| {long-text} | {static-content} | 🧪 backstop | {held-out/visual UI-state test — lifts as `{ statement, verification: backstop }`} |
| {overflow} | {list-collection} | ⚠ unresolved | {planner treats as assumption} |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | keine — shadcn ist in diesem Projekt nicht initialisiert | not required |
| Drittanbieter | keine | not required |

---

## Detailvertrag je Oberfläche

> Ergänzt die Tabellen oben um die sechs konkreten Oberflächen aus
> `12-CONTEXT.md`. Jede Angabe ist entweder aus dem Bestand extrahiert
> (Fundstelle genannt) oder eine explizite Ermessensentscheidung dieser
> Recherche (als solche markiert).

### 1. Klickbare Fundort-Zeile (`.wb__row2` in `#wb-locs` UND `#wb-locpins`)

- **Neues Attribut auf dem `.wb__row2`-Wrapper:** `data-loc="<Fundortname>"`
  — NUR beim Zeichnen von Fundort- und Merklisten-Zeilen gesetzt, NIE bei
  Stationszeilen (`#wb-refs`). Folgt exakt dem bestehenden `pinKey`-Muster
  (siebter, optionaler Parameter von `row2()`, Z. 212).
- **Ganze Zeile ist Klickziel (D-01):** `role="button" tabindex="0"` auf dem
  `.wb__row2[data-loc]`-Div — **derselbe bereits ausgelieferte Musterfall**
  wie `.wb__tile` (Z. 296: `role="button" tabindex="0"`, enthält selbst einen
  verschachtelten `<button class="wb__pin">`). Keine neue
  Barrierefreiheits-Lösung nötig, nur dieselbe auf eine zweite Zeilenart
  erweitert.
- **Cursor:** `pointer` NUR auf `.wb__row2[data-loc]`. Stationszeilen
  (`#wb-refs`, kein `data-loc`) bleiben ohne `cursor:pointer` — das ist
  bereits die Abgrenzung, die die Nadel heute über `pinKey` trägt.
- **Hover:** `background:color-mix(in srgb,var(--surface-2) 88%,var(--text))`
  — wortgleich mit `.wb__tile:hover` (Z. 523). **Kein** `--accent-2` (siehe
  Color-Abschnitt) — Hover bedeutet „hier kann man klicken", nicht „aktiv".
- **Fokus:** `.wb__row2[data-loc]:focus-visible` in die bestehende
  Sammel-Regel Z. 779-783 aufnehmen (`outline:2px solid var(--accent-2);
  outline-offset:2px`) — dieselbe Optik wie jedes andere fokussierbare
  Element der Werkbank.
- **Kein neues Affordanz-Icon (kein Chevron/Pfeil):** Die rechte Seite der
  Zeile ist bereits mit Nadel + Balken + Prozentzahl belegt (142 px breit,
  siehe Kommentar Z. 110-113). Ein zusätzliches Pfeilsymbol würde entweder
  die Nadel verdrängen oder umbrechen — genau der Fehler, den D-01
  ausdrücklich vermeidet. Hover + Fokusring + Cursor SIND die Affordanz,
  exakt wie bei `.wb__tile` (das ebenfalls ohne Chevron auskommt, obwohl es
  eine Auswahl auslöst).
- **Abgrenzung zur Nadel (D-01, Nebenbedingung):** Der neue Zeilen-Klick-Zweig
  im delegierten `document`-Handler muss **nach** dem bestehenden
  `[data-locpin]`-Zweig (Z. 849-852 im Original) geprüft werden — die Nadel
  bleibt vorrangig, ein Klick auf sie öffnet NICHT zusätzlich den Fundort.
  Reihenfolge ist die ganze Lösung, kein `stopPropagation()` (`12-RESEARCH.md`
  Pattern 1, bereits dreifach im Bestand belegt).

### 2. Erzzeilen innerhalb der Fundort-Ansicht (D-02)

- Gleiche `.wb__row2`-Bauform, gleiche Klick-/Hover-/Fokus-Regeln wie oben,
  über ein Attribut `data-ore="<Erzname>"` statt `data-loc`.
- Aufruf **ohne** `pinKey` (sechsstellig) — an einem Fundort kann kein
  einzelnes Erz „angeheftet" werden, nur das Fundort-Erz-Paar über die
  Fundort-Ansicht selbst. Visuell ist die Zeile dadurch identisch mit den
  heutigen Stationszeilen in `#wb-refs`, MUSS aber `data-ore` tragen, um
  klickbar zu sein — sonst bleibt sie so inert wie eine Stationszeile.
- **Rechter Wert = CHANCE, nicht Erwartungswert (D-06):** `pctRight()`
  unverändert wiederverwenden, aber der Balken (`barPct`) und die Sortierung
  MÜSSEN hier gegen `l.ch` (Chance) statt `l.ef` rechnen — bewusst
  asymmetrisch zur Erz-Ansicht (die nach `ef` rangiert, Z. 267-269). Der
  Balken bezieht sich relativ auf die höchste Chance **dieses Fundorts**,
  nicht auf einen globalen Höchstwert.
- **Kein Scan-Signatur-Element in der Zeile (D-08)** — Spalte 3 leistet das
  bereits, `pctSub()`/`locSub()`-Unterzeile bleibt wie in der Fundort-Zeile.
- Zurück-Navigation: Klick führt zu `S.sel = <Erzname>; S.view = 'ore'` und
  ruft die bestehende `renderDetail()` — kein neuer Render-Pfad für die
  Erz-Seite selbst.

### 3. Fundort-Kopf (ersetzt `.wb__id`/`.wb__idrow` in dieser Ansicht)

- **Struktureller Ersatz, kein Zusatzblock** — exakt dieselbe
  Innenabstands-/Zeilenstruktur wie `.wb__id`/`.wb__idrow` (Pitfall 6,
  `--wb-chrome:236px`-Budget ist bereits knapp, 1080p-Falz-Zusage bricht bei
  zusätzlicher Höhe).
- Reihenfolge in `.wb__idrow` (`display:flex;align-items:flex-start;gap:10px`):
  **Zurück-Knopf** (28×28, `.wb__pin`-Bauform, aber NICHT toggle-artig —
  kein `is-on`-Zustand, kein `aria-pressed`, stattdessen ein normaler
  `<button>` mit `aria-label`) → **Textblock** (h2 Fundortname +
  Unterzeile Art · System · Anflugpunkte, wie `.wb__idl`/`.wb__tags`
  strukturiert) → **nichts rechts** (Signaturkasten UND großer Anheft-Knopf
  entfallen laut D-11 ersatzlos, kein Platzhalter).
- **`h2` zeigt NUR den Fundortnamen** (`l.p`), NICHT das Ergebnis von
  `locName()` (das hängt heute die Anflugpunkte an den Namen — laut D-11
  ausdrücklich falsch für den Kopf). Die Anflugpunkte wandern in die
  Unterzeile.
- Unterzeile: gleiche Textklasse wie `.wb__row2 .s`
  (`font-size:var(--fs-3);color:color-mix(in srgb,var(--muted) 88%,transparent)`),
  Inhalt `{Art} · {System}` (`locSub()`) optional erweitert um
  `· {Anflugpunkt, Anflugpunkt}`.
- Zurück-Knopf-Icon: neues Sprite-Symbol `#wb-i-back`, gleiche Bauform wie
  `#wb-i-pin`/`#wb-i-edit` (`stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round"`, `viewBox="0 0 24 24"`).
  Vorschlag (Design-Freiheit beim exakten Pfad, Stilfamilie ist bindend):
  `<path d="M11 4 4 12l7 8M4 12h16"/>` (Pfeil nach links mit Schaft).
  Knopf-Farbe im Ruhezustand **neutral** wie `.wb__pin` (`color-mix(in
  srgb,var(--muted) 78%,transparent)` auf `color-mix(in srgb,var(--ink)
  34%,transparent)`-Grund), Hover wie `.wb__tile:hover .wb__pin`
  (`background:color-mix(in srgb,var(--ink) 55%,transparent);color:var(--text)`)
  — **kein Akzent** im Ruhezustand (siehe Color-Abschnitt).

### 4. Methodengruppen-Überschrift (D-05)

- Wiederholung von `.wb__sec` (Z. 575-579) — **eine Instanz pro in diesem
  Fundort vorkommender Methode**, auch bei den 20 von 45 Fundorten mit nur
  einer Methode (kein Sonderfall, keine Bedingung „nur ab 2 Methoden
  anzeigen").
- Überschrift wortgleich zur bestehenden `.wb__sec h4`-Optik (`var(--fs-4)`,
  Gewicht 600, gedämpfte Farbe, gepunktete Unterlinie über `::after`) —
  **keine visuelle Rangordnung** zwischen den Methodengruppen, sie sind
  gleichrangige Geschwister derselben Klasse wie „Fundorte"/„Beste
  Stationen" es in der Erz-Ansicht sind.
- Reihenfolge der Methoden: `methodLabel()` unverändert (`fps`+`hand` bleiben
  zu „Hand" zusammengefasst, D-05-Nebenbedingung) — Vorschlag ship → roc →
  hand (Fahrzeug vor Handarbeit), Ermessen des Executors.

### 5. Spurenerz-Behandlung (D-07)

- **Schwelle:** `maxShare ≤ 10` (gemessen, 171 von 521 Paaren, exakte
  Grenze — nichts liegt zwischen 10 % und 50 %).
- **Kein eigener Abschnitt, keine Neusortierung** — die Zeile bleibt an
  ihrer durch Chance (D-06) bestimmten Position stehen, auch wenn dadurch
  Spuren- und Vollzeilen sich abwechseln (Beispielreihenfolge in
  `12-CONTEXT.md`: Aluminium 29,8 · Corundum 29,8 · Torite 28,5 ·
  **Hephaestanit 14,9 Spur** · Quarz 14,9 · **Silicon 14,9 Spur** …).
- **Dämpfungsmechanismus — `color`, NICHT `background` (Pitfall 3):**
  `build-light-overrides.mjs` deckt `background`/`background-color`
  NICHT ab (`PROPS`-Konstante, Zeile 85 dort) — eine gedimmte
  `background`-Fläche bekäme im Hellmodus lautlos keine Entsprechung. Die
  Dämpfung läuft deshalb über `color-mix()` gegen die bestehenden Token,
  exakt das Muster, das diese Datei bereits für Zustandsfarben nutzt
  (Kopfkommentar Z. 40-42 „Zustandsfarben über `currentColor` + `color`"):

  ```
  .wb__row2.is-trace .p{color:color-mix(in srgb,var(--text) 62%,transparent)}
  .wb__row2.is-trace .s{color:color-mix(in srgb,var(--muted) 65%,transparent)}
  .wb__row2.is-trace em{color:color-mix(in srgb,var(--muted) 65%,transparent)}
  .wb__row2.is-trace .wb__bar{opacity:.6}
  ```
  Die Zeilen-**Fläche** selbst (`background` von `.wb__row2`) bleibt
  UNVERÄNDERT — nur Text, Unterzeile, Prozentzahl und Balken dämpfen. Damit
  bleibt die Zeile als Fläche im Raster erkennbar, nur ihr Inhalt tritt
  zurück.
  ⚠ **Die Prozentwerte 62 %/65 % sind ein Ausgangspunkt, kein
  Freigabewert.** Vor Auslieferung an echten Bildpunkten messen (Präzedenz
  `scripts/verify-layers.mjs`/„Sichtprüfungs-Werkzeug", Kontrast wird am
  gerenderten Pixel gemessen, nicht aus dem CSS-Wert geschätzt) — Ziel
  ≥ 4,5:1 gegen die Zeilenfläche, in BEIDEN Farbmodi, weil `.p` bei
  `var(--fs-5)` (13,5 px) unter der WCAG-„großer Text"-Schwelle liegt und
  damit die strengere 4,5:1-Marke gilt.
- **„Spur"-Abzeichen:** neue Modifikatorklasse `.wb__tag.is-trace`, NICHT
  `.wb__tag.is-rar` (das ist für die Seltenheitsstufe reserviert) und NICHT
  `var(--accent-2)` (reserviert für „an/ausgewählt", siehe Color-Abschnitt).
  Vorschlag, in derselben gedämpften Sprache wie der Rest der Zeile:
  `background:color-mix(in srgb,var(--muted) 22%,transparent);
  color:var(--muted)` — ein bewusst zurückhaltendes, NICHT alarmierendes
  Abzeichen (Spuren sind eine Information, keine Warnung; `var(--hot)` ist
  auf dieser Seite ohnehin identisch mit `var(--accent)`, s. o., also für
  „Vorsicht" gar nicht verfügbar).
  Position: unmittelbar nach dem Erz-/Fundortnamen in der `.p`-Zeile
  (`<span class="p">Name</span><span class="wb__tag is-trace">Spur</span>`),
  volle Deckkraft (das Abzeichen selbst wird NICHT gedämpft — es ist das
  Signal, nicht das, was gedämpft wird).

### 6. Kachel-Markierung „kommt an diesem Fundort vor" (D-09)

- Alle 37 Kacheln bleiben stehen (kein Filter) — 6 bis 17 bekommen die neue
  Markierung `.wb__tile.is-here`.
- **Muss von zwei bestehenden Zuständen unterscheidbar bleiben, die
  gleichzeitig wahr sein können:** `.wb__tile.is-sel` (ganzflächige
  `--accent-2`-Tönung + Innenring, Z. 524-525) und `.wb__pin.is-on`
  (gefüllter Nadel-Knopf INNERHALB der Kachel, eigene 28×28-Fläche,
  Z. 548-549). Eine dritte, ganzflächige oder ring-basierte Lösung würde mit
  `is-sel` kollidieren.
- **Vorschlag:** eine kleine Eckmarkierung, im selben visuellen Vokabular wie
  die bestehende angeschrägte Panel-Ecke (`.chamf::after`, Z. 457-461,
  Diagonal-Verlauf in einer Ecke) — aber in der GEGENÜBERLIEGENDEN Ecke
  (oben links statt oben rechts, damit sie nicht mit der Panel-eigenen
  Chamfer verwechselt wird) und in `var(--accent)` (Teal) statt der
  40-%-`--accent`-Mischung der Panel-Ecke:
  ```
  .wb__tile.is-here::before{content:'';position:absolute;top:-1px;left:-1px;
    width:10px;height:10px;pointer-events:none;border-radius:8px 0 0 0;
    background:linear-gradient(-135deg,var(--accent) 0 50%,transparent 50% 100%)}
  ```
  Das besetzt eine eigene Bildebene (kleine Ecke, `pointer-events:none`,
  10×10 px) und überschneidet sich weder mit der `is-sel`-Flächentönung noch
  mit dem 28×28-`.wb__pin`-Feld (das am rechten Kachelrand sitzt, Z. 535).
  `var(--accent)` statt `var(--accent-2)`, weil Accent-2 exklusiv für
  „an/ausgewählt" reserviert ist (Color-Abschnitt) — „kommt hier vor" ist
  eine Dateninformation wie die Signaturzahl (`.wb__ts`, ebenfalls
  `var(--accent)`), keine Auswahl.
- Die Filterzeile (Spalte 1, Chip-Reihe) behält ihre alleinige Zuständigkeit
  für „was ist sichtbar" — die Markierung filtert nichts, sie annotiert nur.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
