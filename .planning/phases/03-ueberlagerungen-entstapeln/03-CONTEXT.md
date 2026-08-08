# Phase 3: Überlagerungen entstapeln - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning
**Source:** discuss-phase-Lauf vom 08.08.2026, vier Entscheidungen vom Betreiber.

<domain>
## Phase Boundary

Der Class-B-Befund aus `.planning/codebase/CONCERNS.md` wird abgetragen: Text steht nicht mehr
hinter mehr als einer dekorativen Deckkraftschicht, und für jede betroffene Stelle liegt ein
**gemessener** Kontrastwert für Hell- und Dunkelmodus vor.

**Ausdrücklich NICHT in dieser Phase:** Farbpalette, Bildmotive, Layout und Typografie
(Phase 2 ist durch). Die Ambiente-Effekte selbst — Partikel, Ken Burns, Parallaxe — sind
Gegenstand von Phase 1.1 und bleiben unberührt; hier geht es nur um Schichten, die über
**Text** liegen.

</domain>

<measured_state>
## Gemessener Ist-Zustand (08.08.2026, NACH Phase 1.1 und Phase 2)

Die Roadmap verlangte ausdrücklich, diese Erhebung erst nach Phase 1.1 zu machen — der
Mauszeiger-Schein lag als Schicht bei `z-index:8800` über allem und hätte das Bild verzerrt.
Er ist weg; von den fünf in CONCERNS aufgeführten Schichten sind es noch vier.

| Schicht | Wert heute | Wirkung über Text |
|---|---|---|
| `body::after` — Vignette + CRT-Zeilen, `z-index:9000` | `--ambient-opacity: 0.5` | **global, auf jeder Seite** |
| davon Vignette | `rgba(0,0,0,0.62)` | am dunkelsten an den Rändern — dort sitzen Navigation, Brotkrumen, Bildunterschriften |
| davon CRT-Zeilen | `rgba(0,0,0,0.14)` | schwarzes Raster über jeder Glyphe |
| Seiten-Scrims | bis `--scrim-4: rgba(0,0,0,0.58)` | multipliziert sich mit der Ambiente-Schicht |
| `#embers` | `mix-blend-mode:screen; opacity:.85` | hellt Text auf betroffenen Seiten auf |
| `#stars` | `opacity:.5` im Hero | Rauschen unter dem Titel |
| `.sstep` | `opacity:.5` bis JS aktiviert | **17 Dateien** (CONCERNS nannte 34 — die Körper-Zusammenlegung hat das halbiert) |
| `.reveal` | `opacity:0` bis der Beobachter greift | **72 Dateien**, davon **21 mit defensivem `!important`-Override** |
| `.cursorglow` | **entfernt** | — (Phase 1.1) |

⚠ Die Zahlen in CONCERNS.md stammen aus der Zeit vor der Körper-Zusammenlegung und vor
Phase 1.1. Der Planer muss die eigene Erhebung ansetzen, nicht CONCERNS zitieren.

</measured_state>

<decisions>
## Implementation Decisions

- **D-01: Die Ambiente-Schicht wird RÄUMLICH BEGRENZT, nicht nur gedimmt.** CRT-Zeilen nur noch
  über Bild- und Hero-Bereichen; die Vignette endet vor der Textspalte. Begründung des
  Betreibers: Dämpfen verdünnt das Problem, Begrenzen behebt es — und der Effekt bleibt dort
  erhalten, wo er gestalterisch gemeint war. — **Reversibility:** costly — `body::after` ist eine
  einzige globale Regel; sie in bereichsgebundene Regeln zu zerlegen berührt die Struktur, nicht
  nur einen Wert.
- **D-02: `.sstep` bekommt BEIDES** — der Standardzustand wird undurchsichtig (die Animation
  blendet höchstens *von* voller Deckkraft weg statt zu ihr hin), UND `.sstep` kommt in die
  `prefers-reduced-motion`-Regel, in der heute nur `.reveal` steht. Damit sind der Ohne-JS-Fall
  und der Reduzierte-Bewegung-Fall beide zu.
- **D-03: Bei `.reveal` wird die URSACHE behoben**, nicht das Symptom verwaltet: die
  Sichtbarkeitsschwelle so ändern, dass auch sehr hohe Elemente auslösen (z. B. `rootMargin`
  statt `threshold`), danach die **21 defensiven `!important`-Overrides entfernen**. Eine Lösung
  an einer Stelle statt an 21 — und künftige Seiten erben sie.
- **D-04: Maßstab ist WCAG AA** — 4,5:1 für Fließtext, 3:1 für große Schrift, **in beiden
  Farbmodi**. Nicht nur messen und dokumentieren: der Wert ist eine Zielmarke, die erreicht
  werden muss.

### Claude's Discretion
- Wie „Bild-/Hero-Bereich" und „Textspalte" technisch abgegrenzt werden (eigene Klassen,
  Container-Query, `:has()`, eigene Pseudo-Elemente je Bereich)
- Ob `--ambient-opacity` zusätzlich sinkt, solange die räumliche Begrenzung die Hauptarbeit tut
- Welcher Mechanismus die `.reveal`-Schwelle ersetzt
- Welche Textstellen als „betroffen" gelten und damit gemessen werden müssen — die Auswahl muss
  begründet und vollständig sein, nicht stichprobenhaft
- Ob die Kontrastmessung ein bleibendes Prüfskript wird oder eine einmalige Erhebung

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` § „Phase 3" — Ziel und die drei Erfolgskriterien
- `.planning/REQUIREMENTS.md` — LAYER-01, LAYER-02
- `.planning/codebase/CONCERNS.md` § „Class B" — der Befund samt B-1/B-2/B-3, aber mit veralteten
  Zahlen (siehe `<measured_state>`)
- `assets/theme.css` — `--ambient-opacity`, `--vignette`, `--scanline`, `--scrim-*`
- `assets/detail.css` — `body::after` (Z. 48), `#embers` (286), `#stars` (94), `.sstep` (315-316),
  `.reveal` (278), die `prefers-reduced-motion`-Regel (333)
- `assets/detail.js` — der IntersectionObserver (Z. 13-14, `threshold:.12`) und der
  Scroll-Handler für `.sstep` (Z. 133)
- `src/pages/topics/wikelo-emporium.astro` — dort ist der Grund für den defensiven Override
  im Quelltext dokumentiert

</canonical_refs>

<code_context>
## Existing Code Insights

### Wiederverwendbar
- **`assets/theme.css` als Token-Schicht** — trägt seit Phase 2 auch Schrift- und Bewegungstoken;
  die Generatoren fassen nur Farben an, andere Token sind für sie unsichtbar.
- **`scripts/verify-typo-motion.mjs`, `verify-fx.mjs`, `verify-help.mjs`** — drei erprobte
  Vorbilder für ein bleibendes Prüftor gegen den GEBAUTEN Stand, alle mit DE/EN-Paarvergleich
  über 8.678 Seitenpaare. Ein Kontrast-Tor kann sich daran anlehnen.
- **`scripts/migrate-typo-motion.mjs`** — Vorbild für einen überprüfbaren Massendurchlauf mit
  Soll-Zahlen und Abbruch bei Abweichung, falls die 21 Overrides per Skript fallen.

### Fallen (dokumentiert)
- ⚠ **`assets/theme.css` ist GENERIERT** (`npm run theme`) — Handänderungen am
  `:root[data-theme="light"]`-Block werden still verworfen (THEME-02).
- ⚠ **Der Hellmodus ist der zweite Prüffall, nicht der Nebenfall.** D-04 verlangt WCAG AA in
  **beiden** Farbmodi; die Vignette wirkt dort völlig anders als auf dunklem Grund.
- ⚠ **DE/EN-Seitenpaare werden von Hand doppelt gepflegt** (SYNC-01). Die drei bestehenden
  Prüftore vergleichen 8.678 Paare — eine einseitige Änderung fällt dort auf.
- ⚠ **`:global()` in `<style is:inline>` verpufft** — der Browser wirft die Regel still weg.
- ⚠ Erfolgskriterium 3 („die Bildmotive tragen die Seite optisch weiterhin — die Entstapelung hat
  sie nicht flachgeschliffen") ist ein **Sichturteil**. Es gehört als menschlicher Prüfpunkt in
  den Plan, kein Skript entscheidet es. Genau dieser Punkt hat in Phase 2 gut funktioniert.

### Messpunkt für Erfolgskriterium 2
Ein Kontrastwert ist nur belastbar, wenn er die **tatsächlich übereinanderliegenden** Schichten
einrechnet — Textfarbe über Scrim über Ambiente über Bildmotiv. Eine Messung, die nur Vorder-
gegen Hintergrundfarbe im CSS vergleicht, übersieht genau das, worum es in diesem Befund geht.

</code_context>

<specifics>
## Specific Ideas

- Der Betreiber hat mehrfach betont, dass die Bildsprache erhalten bleiben soll — die
  Rückmeldung, aus der Phase 1.1 entstand, enthielt ausdrückliches Lob dafür. „Entstapeln" heißt
  nicht „entfernen": die Vignette darf über dem Bild bleiben, sie soll nur den Text loslassen.
- Bei der Wahl zwischen Dämpfen und Begrenzen hat er bewusst den aufwendigeren Weg genommen,
  weil er die Ursache trifft. Ein Planer, der daraus doch ein Herunterdrehen von
  `--ambient-opacity` macht, hat die Entscheidung überschrieben.

</specifics>

<deferred>
## Deferred Ideas

- `#embers` (`mix-blend-mode:screen`) und `#stars` grundsätzlich überarbeiten — sie stehen in der
  Class-B-Tabelle, laufen aber seit Phase 1.1 nur noch auf ausdrücklichen Wunsch. Ihre Wirkung
  über Text ist damit ein Sonderfall, kein Regelfall.
- Die Scrim-Werte (`--scrim-1` bis `--scrim-4`) als eigene Skala vereinheitlichen — wäre die
  logische Fortsetzung von Phase 2, ist hier aber nicht verlangt.

</deferred>

---

*Phase: 3-ueberlagerungen-entstapeln*
*Context gathered: 2026-08-08*
