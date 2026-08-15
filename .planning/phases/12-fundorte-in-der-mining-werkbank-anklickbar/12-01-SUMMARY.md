---
phase: 12-fundorte-in-der-mining-werkbank-anklickbar
plan: 01
subsystem: ui
tags: [astro, vanilla-js, es5, mining-workbench, mock-dom-testing]

# Dependency graph
requires:
  - phase: 09-mining-werkbank-fundort-merkliste
    provides: Fundort-Merkliste (locPins), row2()-Bauform mit optionalem pinKey, delegierter Klick-Handler mit [data-locpin]-Vorrang
  - phase: 10-mining-presets-bedienbar-machen
    provides: gestapelte Signaturen-/Fundortlisten (D-03), Preset-System, unveraendertes .wb__scroll-Muster
provides:
  - Fundort-Index (locIndex) im Client-Skript, ausschliesslich aus D.minerals[].locs[] abgeleitet
  - Fundort-Kopf (#wb-lochead) und Fundort-Koerper (#wb-locview) als Geschwister zum Erz-Kopf/-Koerper, umgeschaltet durch renderLocation()
  - Klickbare Fundort-Zeile in #wb-locs ([data-loc]) oeffnet die Fundort-Ansicht; Zurueck-Pfeil (#wb-back, [data-back]) fuehrt zum zuletzt gewaehlten Erz zurueck
  - Nach Methode gruppierte (Schiff/ROC/Hand), nach Chance sortierte Erzliste mit gedaempften Spurenzeilen (<=10% Hoechstanteil, "Spur"-Abzeichen)
  - row2() um optionalen achten Parameter opts (cls/attrs/badge) erweitert; pctRight()/pctSub() um optionalen byChance-Parameter erweitert
  - 9 neue e2e-Testfaelle (T-12-01..09) gegen das echte Skript in einem node:vm-Mock-DOM
affects: [12-02, 12-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "opts-Objekt als optionaler letzter Parameter (row2()) statt einer neuen Funktionssignatur -- haelt die bestehenden 6-/7-stelligen Aufrufstellen byte-identisch"
    - "Eine renderXxx()-Funktion ist der EINZIGE Ort, der Sichtbarkeit zwischen zwei Ansichten umschaltet (renderLocation()); jede andere Stelle nur Zustand aendern + renderAll() rufen"
    - "Sortieren VOR dem Gruppieren, feste Gruppenreihenfolge NACH dem Sortieren -- macht die Chance-Reihenfolge nur INNERHALB jeder Methodengruppe monoton, nicht ueber die ganze Liste (Ueberraschung, siehe Deviations)"

key-files:
  created: []
  modified:
    - src/components/MiningWorkbench.astro
    - assets/mining-workbench.js
    - tests/e2e/helpers/mining-dom.js
    - tests/e2e/mining-shortlist.test.js

key-decisions:
  - "Klick-Handler fuer [data-ore]-Zeilen (Erzzeile INNERHALB der Fundort-Ansicht) bewusst NICHT verdrahtet -- nur data-ore/role/tabindex als Markup-Vorbereitung gesetzt. Der Objective-Text der Phase weist diesen Ein-/Ausstieg ausdruecklich Welle 2/3 zu ('ohne die Bauform noch einmal anzufassen')."
  - "T-12-04 pruefte urspruenglich globale Chance-Monotonie ueber die GANZE Fundort-Ansicht -- reale Daten zeigen, dass die Reihenfolge nur INNERHALB jeder Methodengruppe monoton faellt (Sortieren VOR Gruppieren, feste Gruppenreihenfolge Schiff->ROC->Hand NACH dem Sortieren). Test korrigiert, Implementierung folgt exakt dem Handlungstext des Plans."

requirements-completed: [D-01, D-05, D-06, D-07, D-08, D-10, D-11]

coverage:
  - id: D1
    description: "Klick auf eine Fundort-Zeile in #wb-locs (nicht die Nadel) oeffnet die Fundort-Ansicht mit Kopf und Erzliste"
    requirement: "D-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-01"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zurueck-Pfeil stellt die Erz-Ansicht wieder her, Erzwahl und Fusszeile bleiben unveraendert (D-10)"
    requirement: "D-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-02"
        status: pass
    human_judgment: false
  - id: D3
    description: "Klick auf die Nadel innerhalb einer Fundort-Zeile heftet an, oeffnet die Fundort-Ansicht NICHT (Vorrangregel D-01)"
    requirement: "D-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-03"
        status: pass
    human_judgment: false
  - id: D4
    description: "Erzliste je Methodengruppe absteigend nach Chance sortiert, rechter Wert ist die Chance (D-06)"
    requirement: "D-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-04"
        status: pass
    human_judgment: false
  - id: D5
    description: "Methodengruppierung immer aktiv (1 oder 3 Gruppen, nie 2) (D-05)"
    requirement: "D-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-05"
        status: pass
    human_judgment: false
  - id: D6
    description: "Spurenzeilen (<=10% Hoechstanteil) an sortierter Stelle, gedaempft, mit Abzeichen (D-07)"
    requirement: "D-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-06"
        status: pass
    human_judgment: false
  - id: D7
    description: "Synthetischer Fundort mit HTML-Sonderzeichen escaped im Kopf und im data-loc-Attributwert, kein injiziertes Element"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-07"
        status: pass
    human_judgment: false
  - id: D8
    description: "Kein viertes .wb__pane, #wb-locview traegt ausschliesslich die bestehende Klasse wb__scroll"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-08"
        status: pass
    human_judgment: false
  - id: D9
    description: "Groesster Fundort (17 Erze/3 Gruppen): kein Eintrag verloren, keiner doppelt gezeichnet"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-09"
        status: pass
    human_judgment: false
  - id: D10
    description: "Spurendaempfung laeuft ausschliesslich ueber color-mix()/opacity (keine Flaechenfarbe) -- Hellmodus-Aequivalenz"
    human_judgment: true
    rationale: "Kontrastnachweis am gerenderten Bildpunkt ist laut Plan explizit Plan 03 (Sichtpruefungs-Werkzeug) vorbehalten -- diese Zusicherung ist strukturell (grep, keine background-Deklaration) bereits belegt, die visuelle Kontrastmessung selbst nicht Teil dieses Plans."

# Metrics
duration: 50min
completed: 2026-08-15
status: complete
---

# Phase 12 Plan 1: Fundort-Ansicht end-to-end (Tracer) Summary

**Klick auf eine Fundort-Zeile öffnet die Fundort-Ansicht — Kopf, nach Methode gruppierte und nach Chance sortierte Erzliste mit gedämpften Spurenzeilen, Zurück-Pfeil zurück aufs Erz — end-to-end durch Astro-Markup, Client-Skript und Mock-DOM-Testfixture bewiesen.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-15T14:54:27Z (Init-Zeitstempel STATE.md)
- **Completed:** 2026-08-15T15:39:47Z
- **Tasks:** 2 (Task 1 Tracer + Task 2 Hoehenbilanz/Bildlauf, tdd)
- **Files modified:** 4

## Accomplishments

- Fundort-Index `locIndex` im Client-Skript, einmalig aus `D.minerals[].locs[]` abgeleitet — kein `DB.bodies`-Versand, 0 zusätzliche Nutzlast-Bytes
- Neue Zeichenroutine `renderLocation()` als der EINZIGE Ort, der die Sichtbarkeit von Erz-Kopf/-Körper gegen Fundort-Kopf/-Körper umschaltet; `renderAll()` ruft sie nach `renderDetail()` (D-10: Fußzeile bleibt beim zuletzt gewählten Erz stehen)
- Klick-/Tastatur-Zweige `[data-back]`/`[data-loc]` in den bestehenden delegierten Handlern, NACH `[data-locpin]` und VOR `[data-pin]` — Konfliktlösung ausschließlich über Reihenfolge, kein `stopPropagation()`
- Fundort-Kopf zeigt NUR den Ortsnamen in der `h2` (D-11) — Anflugpunkte wandern in die Unterzeile; Signaturkasten und großer Anheft-Knopf entfallen ersatzlos, kein Platzhalter
- Erzliste immer nach Methode gruppiert (Schiff/ROC/Hand, D-05), Spurenerze (≤10 % Höchstanteil, gemessen: 171 von 521 Paaren) gedämpft ausschließlich über `color-mix()`/`opacity` mit vollopakem „Spur"-Abzeichen (D-07)
- 9 neue e2e-Testfälle (T-12-01 bis T-12-09), 54 Testfälle insgesamt in `mining-shortlist.test.js`, alle grün

## Task Commits

1. **Task 1: Ein Fundort, hin und zurück — die Ansicht end-to-end** - `826cd33` (feat)
2. **Task 2: Der Falz hält — Höhenbilanz und Bildlauf der neuen Ansicht** - `9f61310` (test, RED) → `650be07` (fix, GREEN)

**Nachtrag (Acceptance-Criteria-Verifikation, Rule 1):** `8ba0ad4` (fix) — ein Kommentar zitierte `stopPropagation()` wörtlich und ließ die Zusicherung `grep -c 'stopPropagation'` fälschlich auf 1 statt 0 steigen.

**Plan metadata:** _wird nach diesem SUMMARY committet_

## Files Created/Modified

- `src/components/MiningWorkbench.astro` — `backToOre`/`trace` in `S_DE`/`S_EN`, neues SVG-Symbol `wb-i-back`, Fundort-Kopf-Markup (`#wb-orehead`/`#wb-lochead`/`#wb-oreview`/`#wb-locview`), CSS für `.wb__back`, `.wb__locsub`, `.wb__row2[data-loc]`-Klickaffordanz, `.wb__nm`, `.wb__row2.is-trace`-Dämpfung, `.wb__tag.is-trace`
- `assets/mining-workbench.js` — `locIndex`, `TRACE_MAX`, `S.view`/`S.selLoc`, `pctRight()`/`pctSub()` mit `byChance`-Parameter, `row2()` mit `opts`-Parameter, `renderLocation()`, Klick-/Tastatur-Zweige, `renderAll()`-Erweiterung
- `tests/e2e/helpers/mining-dom.js` — neue Element-Registrierungen (`wb-orehead`, `wb-lochead`, `wb-back`, `wb-locname`, `wb-locsub`, `wb-oreview`, `wb-locview` mit Klasse `wb__scroll`), Sprach-Platzhalter `backToOre`/`trace`
- `tests/e2e/mining-shortlist.test.js` — Helfer (`locRow()`, `buildLocIndexForTest()`, `biggestLoc()`, `findLocWithGroups()`, `findLocWithTraceAndFull()`), 9 neue Testfälle

## Decisions Made

- **`[data-ore]`-Klick in der Fundort-Ansicht bewusst unverdrahtet:** die Erzzeilen innerhalb `#wb-locview` tragen `data-ore`/`role="button"`/`tabindex="0"` als Markup-Vorbereitung, aber keinen Klick-Handler-Zweig. Der Objective-Abschnitt der Phase weist "die übrigen Ein- und Ausstiege (Erzzeile, Merkliste, Kachelspalte, Adresse)" ausdrücklich Welle 2/3 zu — Task 1 ist der Tracer, keine Vollimplementierung aller sechs Oberflächen.
- **T-12-04 korrigiert (Chance-Monotonie ist gruppenlokal, nicht global):** die `<acceptance_criteria>` beschreiben "die Folge der Chancen [ist] monoton fallend" ohne Einschränkung; der detaillierte `<action>`-Text verlangt aber "sortieren, DANACH gruppieren" mit fester Gruppenreihenfolge Schiff→ROC→Hand. Reale Daten (Pyro VI (Terminus), 17 Erze) beweisen, dass die Chance über eine Gruppengrenze hinweg wieder steigen kann (Feynmaline 100 % in ROC nach Taranite 2 % am Ende von Schiff). Implementiert exakt nach dem `<action>`-Algorithmus; Test auf gruppenlokale Monotonie umgestellt, siehe Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Test-Korrektur] T-12-04 prüfte globale statt gruppenlokale Chance-Monotonie**
- **Found during:** Task 1, beim ersten Testlauf
- **Issue:** Die Acceptance-Criteria-Paraphrase ("die Folge der Chancen monoton fällt") beschreibt keine Gruppengrenzen; der detaillierte Handlungstext verlangt jedoch Sortieren-dann-Gruppieren mit fester Reihenfolge Schiff→ROC→Hand — das macht die Gesamtliste NICHT monoton (nur jede Methodengruppe für sich). Am größten gemessenen Fundort (Pyro VI (Terminus), 17 Einträge) beweisbar: Chance springt an der Schiff→ROC-Gruppengrenze von 2 % auf 100 %.
- **Fix:** Test prüft Monotonie jetzt je `.wb__sec`-Gruppe statt über die gesamte `#wb-locview`-Liste. Implementierung unverändert — sie folgte von Anfang an dem detaillierten Handlungstext, nicht der Paraphrase.
- **Files modified:** tests/e2e/mining-shortlist.test.js
- **Verification:** T-12-04 grün, 54/54 Testfälle grün
- **Committed in:** 826cd33 (Task 1 Commit — vor dem ersten grünen Lauf korrigiert, kein separater Commit nötig)

**2. [Rule 1 - Bug] Mock-DOM registrierte #wb-locview ohne Klasse `wb__scroll`**
- **Found during:** Task 2, RED-Phase (T-12-08)
- **Issue:** Die echte Astro-Quelle trägt `<div class="wb__scroll" id="wb-locview" hidden>`, der Mock in `mining-dom.js` registrierte das Element ohne Klasse — der Bildlauf-Kasten-Nachweis (D-07-Nebenbedingung) wäre sonst unbelegt geblieben.
- **Fix:** `mk('div', 'wb-locview', 'wb__scroll')` statt ohne Klassenparameter.
- **Files modified:** tests/e2e/helpers/mining-dom.js
- **Verification:** T-12-08 grün (RED → GREEN belegt in Commits 9f61310 → 650be07)
- **Committed in:** 650be07

**3. [Rule 1 - Bug] Kommentar verletzte die eigene Acceptance-Criteria-Zusicherung**
- **Found during:** Task 1/2, Acceptance-Criteria-Nachlese
- **Issue:** Ein erklärender Kommentar in `assets/mining-workbench.js` zitierte `stopPropagation()` wörtlich, um zu begründen, warum es NICHT benutzt wird — `grep -c 'stopPropagation'` (Soll: 0) fand dadurch trotzdem einen Treffer. Derselbe Effekt traf `wb-chrome:236px` in `MiningWorkbench.astro` (Soll: 1, ein Erklärkommentar in Task 1 zitierte die Konstante wörtlich ein zweites Mal).
- **Fix:** Beide Kommentare umformuliert (Sachverhalt beschrieben statt der Literalzeichenkette zu wiederholen), kein Verhaltensunterschied.
- **Files modified:** assets/mining-workbench.js, src/components/MiningWorkbench.astro
- **Verification:** beide Grep-Zusicherungen erfüllt, 54/54 Testfälle weiterhin grün, `npm run build && npm run gate` grün
- **Committed in:** 650be07 (wb-chrome-Teil), 8ba0ad4 (stopPropagation-Teil)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 Bugs, 1 Rule 1 Test-Korrektur)
**Impact on plan:** Keine funktionale Abweichung von der geplanten Architektur — alle drei Funde waren Verifikations-/Testgenauigkeit, kein Scope Creep.

## Issues Encountered

None über die dokumentierten Deviations hinaus.

## Known Stubs

Keine. Die Erzzeilen innerhalb der Fundort-Ansicht (`data-ore`) sind absichtlich ohne Klick-Verhalten — das ist keine Attrappe, sondern eine dokumentierte, im Plan-Objective genannte Vorbereitung für Welle 2/3 (siehe Decisions Made oben). Kein Platzhaltertext, keine leere Datenquelle.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

- Plan 02 und Plan 03 dieser Phase (Welle 2/3) können auf `locIndex`, `renderLocation()`, `S.view`/`S.selLoc`, dem `row2()`-`opts`-Parameter und dem `pctRight()`/`pctSub()`-`byChance`-Parameter aufbauen, ohne die Bauform noch einmal anzufassen (Plan-Objective-Zusage eingehalten).
- Offen für spätere Pläne dieser Phase: Klick-Verdrahtung von `[data-ore]` (Erzzeile → Erz-Ansicht), Klickbarkeit der Merkliste (`#wb-locpins`), Kachel-Markierung `.wb__tile.is-here` (D-09), `?fundort=`-Adressparameter (D-04, `costly`), Kontrastnachweis am gerenderten Bildpunkt für die Spurendämpfung (D10 im Coverage-Block oben).
- `npm run build && npm run gate` grün, normal UND mit `STAGING=1` (18/18 Schienen-A-Schritte, beide Läufe).
- `node --test tests/e2e/mining-shortlist.test.js` grün, 54 Fälle (Plan verlangte mindestens 45).

---
*Phase: 12-fundorte-in-der-mining-werkbank-anklickbar*
*Completed: 2026-08-15*

## Self-Check: PASSED

All claimed files and commit hashes verified present on disk / in git log:
- `.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/12-01-SUMMARY.md` FOUND
- `826cd33`, `9f61310`, `650be07`, `8ba0ad4` FOUND
