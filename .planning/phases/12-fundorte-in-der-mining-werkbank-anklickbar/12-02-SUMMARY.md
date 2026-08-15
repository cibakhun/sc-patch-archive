---
phase: 12-fundorte-in-der-mining-werkbank-anklickbar
plan: 02
subsystem: ui
tags: [astro, vanilla-js, es5, mining-workbench, mock-dom-testing]

# Dependency graph
requires:
  - phase: 12-fundorte-in-der-mining-werkbank-anklickbar (Plan 01)
    provides: Fundort-Index (locIndex), renderLocation(), S.view/S.selLoc, row2() achter Parameter opts (cls/attrs/badge), pctRight()/pctSub() byChance-Parameter, delegierter Klick-/Tastatur-Handler mit [data-back]/[data-loc]-Zweigen, unverdrahtetes data-ore-Markup als Vorbereitung
provides:
  - "[data-ore]-Zweig im delegierten Klick- UND Tastatur-Handler (Erzzeile in der Fundort-Ansicht fuehrt zurueck zum Erz, D-02)"
  - "Fundort-Merklistenzeile (#wb-locpins) traegt zusaetzlich data-loc/role/tabindex -- der bestehende [data-loc]-Zweig aus Plan 01 findet sie ohne Handler-Aenderung (D-03)"
  - "Kachel-Markierung .wb__tile.is-here in renderList() (D-09) -- Nachschlageobjekt aus locIndex[S.selLoc], gebunden an S.view === 'loc'"
  - "fire(el, type, init) im Mock-DOM-Helfer -- init reicht Event-Felder wie key an den delegierten keydown-Handler durch"
  - "6 neue e2e-Testfaelle (T-12-10..15) gegen das echte Skript im node:vm-Mock-DOM"
affects: [12-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hereIdx-Nachschlageobjekt VOR der Kachelschleife aufgebaut statt je Kachel ueber die Eintragsliste zu laufen -- vermeidet 37 * bis zu 17 Vergleiche im Zeichenpfad"
    - "Ein Bedienelement bekommt Klickbarkeit ausschliesslich ueber ein neues Attribut auf einem bereits gezeichneten Element -- kein zusaetzlicher Handler-Zweig noetig, solange der delegierte Handler schon generisch auf dieses Attribut prueft (renderLocPins() + der bestehende [data-loc]-Zweig aus Plan 01)"
    - "fire(el, type, init) im Mock-DOM: init (optional) reicht zusaetzliche Event-Felder bis zum delegierten Handler durch -- notwendig, um Tastaturzweige (e.key) im node:vm-Fixture ueberhaupt zu testen"

key-files:
  created: []
  modified:
    - assets/mining-workbench.js
    - src/components/MiningWorkbench.astro
    - tests/e2e/helpers/mining-dom.js
    - tests/e2e/mining-shortlist.test.js

key-decisions:
  - "hereIdx-Berechnung an S.view === 'loc' gebunden, NICHT nur an S.selLoc != null -- ein direkter Kachelklick waehrend die Fundort-Ansicht offen ist setzt S.view sofort auf 'ore' zurueck, laesst S.selLoc aber unveraendert stehen (bestehender Zweig aus Plan 01); ohne die View-Bedingung waere die Markierung nach genau diesem Wechsel faelschlich stehengeblieben"
  - "mining-dom.js fire(el, type, init) um einen dritten, optionalen Parameter erweitert (Rule 3, blockierend): der bestehende zweiargumentige fire() konnte keine Event-Felder wie key durchreichen, e.key blieb im Test immer undefined und der keydown-Handler kehrte sofort um, bevor T-12-11 (Enter auf der Erzzeile) ueberhaupt einen Zweig erreichte. Rein additiv -- kein bestehender Aufruf aendert sein Verhalten."
  - "T-12-11 prueft die Stationszeilen-Reglosigkeit an 'Gold' statt am angeklickten Erz aus biggestLoc(): der groesste Fundort im Testbestand enthaelt Edelsteine ohne Ertragsprofil (yieldFor() raffiniert sie laut Kopfkommentar nicht), #wb-refs waere fuer ein solches Erz leer gewesen und die Zusicherung haette nichts Reales geprueft"
  - "renderLocation()-Kommentar bei der data-ore-Markup-Erzeugung aktualisiert: die Zusage aus Plan 01 ('baut Welle 2/3 darauf auf, ohne die Bauform anzufassen') stand nach dem Verdrahten dieses Plans faktisch nicht mehr; der Kommentar beschreibt jetzt den bestehenden Zustand statt eine offene Zusage"

requirements-completed: [D-02, D-03, D-09]

coverage:
  - id: D1
    description: "Klick auf eine Erzzeile INNERHALB der Fundort-Ansicht setzt das gewaehlte Erz und schaltet auf die Erz-Ansicht; der Zurueck-Pfeil bleibt als zweiter, unveraenderter Ausgang bestehen (D-02)"
    requirement: "D-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-10"
        status: pass
    human_judgment: false
  - id: D2
    description: "Enter auf einer fokussierten Erzzeile bewirkt dasselbe wie der Klick; eine Stationszeile in #wb-refs bleibt bei Klick reglos (D-02)"
    requirement: "D-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-11"
        status: pass
    human_judgment: false
  - id: D3
    description: "Klick auf eine Merklistenzeile (nicht das Kreuz) oeffnet die Fundort-Ansicht dieses Ortes, das Paar bleibt angeheftet (D-03)"
    requirement: "D-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-12"
        status: pass
    human_judgment: false
  - id: D4
    description: "Klick auf das Loesen-Kreuz derselben Zeile loest das Paar und wechselt die Ansicht NICHT; der Sonderzeichen-Fundort steht escaped im data-loc-Attributwert (D-03, Vorrang-Nebenbedingung)"
    requirement: "D-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-13"
        status: pass
    human_judgment: false
  - id: D5
    description: "Bei offenem Fundort tragen genau die dort vorkommenden Erze die Kachel-Markierung is-here; alle 37 Kacheln bleiben stehen, die Filterzeile bleibt unveraendert zustaendig (D-09)"
    requirement: "D-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-14"
        status: pass
    human_judgment: false
  - id: D6
    description: "Nach dem Zurueckspringen auf die Erz-Ansicht traegt keine Kachel mehr is-here; is-here und is-sel schliessen einander waehrend die Fundort-Ansicht offen ist nicht aus (D-09)"
    requirement: "D-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-15"
        status: pass
    human_judgment: false
  - id: D7
    description: "Die Kachel-Markierung benutzt var(--accent), nicht den fuer 'an/ausgewaehlt/angeheftet' reservierten zweiten Akzentton; eigene Bildebene mit pointer-events:none, kollidiert weder mit is-sel noch mit dem Anheft-Knopf-Feld"
    verification:
      - kind: other
        ref: "grep -n 'accent-2' src/components/MiningWorkbench.astro (27, unveraendert gegenueber dem Stand vor diesem Plan); sed -n '/wb__tile\\.is-here/p' src/components/MiningWorkbench.astro (kein Treffer fuer --accent-2)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Visuelle Lesbarkeit der Dreifach-Ueberlagerung (is-here + is-sel + wb__pin.is-on) am gerenderten Bildpunkt, in beiden Farbmodi"
    verification: []
    human_judgment: true
    rationale: "T-12-15 belegt strukturell, dass alle drei Klassen gleichzeitig gesetzt werden koennen, ohne einander zu verdraengen -- ob die Ueberlagerung am echten Bildpunkt tatsaechlich LESBAR bleibt, ist laut 12-UI-SPEC.md 'Wie die 9 Backstops belegt werden' ausdruecklich der Sichtprobe an den Betreiber zugewiesen (playwright-core-Kontrastmessung + Sichtrunde), nicht diesem Plan. Wird zusammen mit den uebrigen Backstops dieser Phase in Plan 03 / WINDOWS.md gefuehrt."

# Metrics
duration: ~50min
completed: 2026-08-15
status: complete
---

# Phase 12 Plan 2: Erzzeile, Merkliste und Kachel-Markierung anklickbar Summary

**Die drei verbleibenden Verbindungen der Fundort-Ansicht sind verdrahtet: Erzzeilen führen zurück zum Erz (D-02), die Fundort-Merkliste rechts öffnet denselben Fundort wie die Zeile in der Mitte (D-03), und die Kachelspalte markiert die 6–17 Erze eines offenen Fundorts im Datenton `var(--accent)`, ohne eine der 37 Kacheln zu verstecken (D-09) — alles auf der in Plan 01 bewiesenen Bauform, ohne einen zweiten Klick-Handler, einen zweiten Tastatur-Listener oder `stopPropagation()`.**

## Performance

- **Duration:** ~50 min
- **Started:** ~2026-08-15T15:46 (Anschluss an 12-01)
- **Completed:** 2026-08-15T16:35Z
- **Tasks:** 3 (alle `tdd="true"`)
- **Files modified:** 4

## Accomplishments

- `[data-ore]`-Zweig im delegierten Klick-Handler, unmittelbar nach `[data-loc]` und vor `[data-pin]` — ein Klick auf eine Erzzeile INNERHALB der Fundort-Ansicht setzt `S.sel`/`S.view` zurück auf die Erz-Ansicht und `S.selLoc` auf `null`; ein unbekannter Erzname wird gegen `byName` still verworfen (Präzedenz `locPinValid()`), der Zweig endet trotzdem mit `return`
- Derselbe Zweig im delegierten Tastatur-Handler (Enter/Leertaste), unter demselben Knopf-Vorbehalt wie der bestehende `[data-loc]`-Zweig — kein dritter `keydown`-Listener (weiterhin genau 2)
- Fundort-Merklistenzeile trägt seit diesem Plan `data-loc`/`role="button"`/`tabindex="0"` — der bereits in Plan 01 geschriebene `[data-loc]`-Zweig findet sie über dasselbe Attribut, **keine** Handler-Änderung nötig; `[data-locpin]` bleibt unverändert vorrangig
- Kachel-Markierung `.wb__tile.is-here` in `renderList()`: ein Nachschlageobjekt aus `locIndex[S.selLoc]` wird einmal vor der Kachelschleife gebaut (statt 37 × bis zu 17 Vergleiche je Zeichenvorgang) und ist an `S.view === 'loc'` gebunden — Filter und Zähler bleiben unangetastet, alle 37 Kacheln bleiben stehen
- `.wb__tile.is-here::before`: 10×10-px-Eckmarkierung oben links (gegenüber der Panel-eigenen Schräge oben rechts), `var(--accent)`, `pointer-events:none`, eigene Bildebene — kollidiert weder mit `.is-sel` noch mit dem 28×28-Anheft-Feld
- `fire(el, type, init)` im Mock-DOM-Helfer erweitert (`tests/e2e/helpers/mining-dom.js`): reicht zusätzliche Event-Felder wie `key` bis zum delegierten `keydown`-Handler durch — ohne diese Erweiterung war Enter/Leertaste im Testfixture nicht simulierbar
- 6 neue e2e-Testfälle (T-12-10 bis T-12-15), 60 Testfälle insgesamt in `mining-shortlist.test.js`, alle grün; 294/294 der gesamten `test:e2e`-Suite grün

## Task Commits

1. **Task 1: Erzzeile führt zum Erz — der Rückweg aus der Fundort-Ansicht (D-02)** — `8230758` (feat)
2. **Task 2: Die Merkliste reagiert genauso — eine Zeile, zwei Bedeutungen (D-03)** — `54b9870` (feat)
3. **Task 3: Die Kachelspalte zeigt, was hier vorkommt — und was nicht (D-09)** — `cf136c4` (feat)

**Plan metadata:** _wird nach diesem SUMMARY committet_

## Files Created/Modified

- `assets/mining-workbench.js` — `[data-ore]`-Zweig im Klick- und Tastatur-Handler; `data-loc`-Attribut auf der Merklistenzeile in `renderLocPins()`; `hereIdx`-Nachschlageobjekt + `is-here`-Klassenumschaltung in `renderList()`
- `src/components/MiningWorkbench.astro` — `.wb__row2[data-ore]` teilt sich einen Regelblock mit `.wb__row2[data-loc]` (Hover/Cursor/Fokus); `.wb__pin-item[data-loc]` (Hover/Cursor/Fokus); `.wb__tile.is-here::before`
- `tests/e2e/helpers/mining-dom.js` — `fire(el, type, init)` reicht Event-Felder (z. B. `key`) an den delegierten `keydown`-Handler durch
- `tests/e2e/mining-shortlist.test.js` — Helfer (`oreRow()`, `locPinRow()`, `tileByName()`), 6 neue Testfälle T-12-10 bis T-12-15

## Decisions Made

- **`hereIdx` an `S.view === 'loc'` gebunden, nicht nur an `S.selLoc`:** ein direkter Kachelklick während die Fundort-Ansicht offen ist, setzt `S.view` sofort auf `'ore'` zurück (bestehender Zweig aus Plan 01), lässt `S.selLoc` aber unverändert stehen. Ohne die View-Bedingung wäre die Markierung nach genau diesem Wechsel fälschlich sichtbar geblieben — dieselbe Art von Zustandsleiche, die `renderLocation()` selbst schon über `S.view` statt `S.selLoc` vermeidet.
- **`fire(el, type, init)` statt eines zweiten Testwegs:** die einzige Möglichkeit, Enter/Leertaste im `node:vm`-Mock-DOM zu prüfen, ist ein Event-Objekt mit `key`-Feld bis zum delegierten `document`-`keydown`-Listener durchzureichen. Rein additiver, optionaler dritter Parameter — kein bestehender zweiargumentiger Aufruf ändert sein Verhalten.
- **T-12-11 wechselt für den Stationszeilen-Nachweis auf `'Gold'`:** der größte Fundort im Testbestand enthält Erze ohne Ertragsprofil (Edelsteine, die laut Kopfkommentar von `yieldFor()` nicht raffiniert werden) — `#wb-refs` wäre für ein solches Erz leer geblieben und die Reglosigkeits-Zusicherung hätte nichts Reales geprüft.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `fire()` im Mock-DOM-Helfer konnte keine Tastatur-Ereignisfelder durchreichen**
- **Found during:** Task 1, beim Schreiben von T-12-11
- **Issue:** `fire(el, type)` und der interne `docEvents.fire(type, target)` bauten das Event-Objekt ohne die Möglichkeit, zusätzliche Felder wie `key` zu setzen. `assets/mining-workbench.js`s `keydown`-Handler prüft `e.key !== 'Enter' && e.key !== ' '` als allerersten Wächter — mit `key: undefined` kehrte der Handler sofort um, kein Testfall konnte die Tastatur-Zweige je erreichen.
- **Fix:** Beide Funktionen um einen optionalen dritten Parameter `init` erweitert, der additiv in das Event-Objekt gemischt wird (`...(init || {})`).
- **Files modified:** tests/e2e/helpers/mining-dom.js
- **Verification:** T-12-11 grün, alle 60 Testfälle in `mining-shortlist.test.js` weiterhin grün, kein bestehender zweiargumentiger `fire()`-Aufruf verändert
- **Committed in:** 8230758 (Task 1 Commit)

**2. [Rule 1 - Verifikationsgenauigkeit] Eigener CSS-Kommentar verletzte die eigene Acceptance-Criteria-Zusicherung**
- **Found during:** Task 3, vor dem ersten Commit (Acceptance-Criteria-Nachlese)
- **Issue:** Der erste Entwurf des Erklärkommentars zu `.wb__tile.is-here::before` zitierte `var(--accent-2)` wörtlich, um zu begründen, warum es NICHT verwendet wird — `grep -c 'accent-2' src/components/MiningWorkbench.astro` (Soll: unverändert gegenüber dem Stand vor diesem Plan) stieg dadurch von 27 auf 28. Derselbe Fehlertyp wie in `12-01-SUMMARY.md` Deviation 3 (`stopPropagation()`/`wb-chrome`-Literale) — ein wörtliches Zitat der verbotenen Zeichenkette in der Begründung selbst.
- **Fix:** Kommentar umformuliert (den Sachverhalt beschrieben — "der zweite, andernorts reservierte Akzentton" — statt die Literalzeichenkette zu wiederholen), kein Verhaltensunterschied.
- **Files modified:** src/components/MiningWorkbench.astro
- **Verification:** `grep -c 'accent-2'` liefert wieder 27, `npm run build`/`gate` grün, 60/60 Testfälle grün
- **Committed in:** cf136c4 (Task 3 Commit — vor dem ersten Commit korrigiert, kein separater Commit nötig)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 Blocking, 1 Rule 1 Verifikationsgenauigkeit)
**Impact on plan:** Keine funktionale Abweichung von der geplanten Architektur — beide Funde waren Test-Infrastruktur bzw. Verifikationsgenauigkeit, kein Scope Creep.

## Issues Encountered

None über die dokumentierten Deviations hinaus.

## Known Stubs

Keine. Alle drei Verbindungen (Erzzeile, Merkliste, Kachelspalte) sind end-to-end verdrahtet und automatisiert bewiesen; kein Platzhaltertext, keine leere Datenquelle.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

- Plan 03 dieser Phase (Deep-Link `?fundort=`, D-04, `costly`) kann auf `locIndex`, `renderLocation()`, dem jetzt vollständig verdrahteten `[data-ore]`/`[data-loc]`-Zweigpaar und der `is-here`-Markierung aufbauen, ohne die Bauform noch einmal anzufassen.
- `npm run build && npm run gate` grün, normal UND mit `STAGING=1` (18/18 Schienen-A-Schritte, beide Läufe, auf dem committeten Stand).
- `node --test tests/e2e/mining-shortlist.test.js` grün, 60 Fälle (Plan verlangte mindestens 51). `node --test tests/e2e/*.test.js` grün, 294 Fälle gesamt.
- Offen für Plan 03 / den Betreiber (laut `12-UI-SPEC.md`, „Wie die 9 Backstops belegt werden"): Kontrastnachweis am gerenderten Bildpunkt für die Dreifach-Überlagerung `is-here`+`is-sel`+`wb__pin.is-on` in beiden Farbmodi, sowie die übrigen 8 Backstops dieser Phase (Höhen-/Umbruchmessungen bei 1280×720, Spurendämpfung-Kontrast aus Plan 01). Strukturell bereits belegt (T-12-15: alle drei Zustände koexistieren, ohne einander zu verdrängen), die visuelle Lesbarkeit selbst ist explizit an die Sichtrunde delegiert.

---
*Phase: 12-fundorte-in-der-mining-werkbank-anklickbar*
*Completed: 2026-08-15*

## Self-Check: PASSED

All claimed files and commit hashes verified present on disk / in git log:
- `.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/12-02-SUMMARY.md` FOUND
- `8230758`, `54b9870`, `cf136c4` FOUND
- `assets/mining-workbench.js`, `src/components/MiningWorkbench.astro`, `tests/e2e/helpers/mining-dom.js`, `tests/e2e/mining-shortlist.test.js` FOUND
