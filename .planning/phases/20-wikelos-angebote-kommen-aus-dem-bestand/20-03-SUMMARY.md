---
phase: 20-wikelos-angebote-kommen-aus-dem-bestand
plan: 03
subsystem: data
tags: [gate, ratchet, wikelo, verify-metrics, verify-datastand, broken-windows]

# Dependency graph
requires:
  - phase: 20-wikelos-angebote-kommen-aus-dem-bestand
    provides: "scripts/build-wikelo-trades.mjs, assets/wikelo-trades.json/.meta.json (69 Vertraege, 285 Warenposten, 59 kuratiert) — Plan 01 + Plan 02"
provides:
  - "Zwei Sperrklinken wikeloVertraege (min 69) und wikeloWarenposten (min 285) in scripts/lib/metrics-baseline.mjs, je mit einem Ableser in scripts/verify-metrics.mjs gegen das committete assets/wikelo-trades.meta.json"
  - "Wikelo als siebter maschineller Datenstand in scripts/verify-datastand.mjs (STANDS-Zeile, Klinke 12519617), HANDPFLEGE-Tabelle jetzt leer"
  - "Register-Eintrag id 51 geschlossen (.planning/WINDOWS.md), mit Begruendung"
affects: [20-04-wikelo-anzeige]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sperrklinke + Ableser als Bijektion gegen ein COMMITTETES Artefakt (nicht die gitignorierte Rohextraktion) — Grundsatz 4, Torfaehigkeit vor Verkabelung"
    - "Handpflege-Zeile -> maschinelle STANDS-Zeile im Verzugstor, Begleitdatei-Fall wie 'Zerlegung'"

key-files:
  created: []
  modified:
    - scripts/lib/metrics-baseline.mjs
    - scripts/verify-metrics.mjs
    - scripts/verify-datastand.mjs
    - scripts/build-wikelo-trades.mjs
    - scripts/lib/gate-registry.mjs
    - assets/wikelo-trades.meta.json
    - .planning/WINDOWS.md

key-decisions:
  - "Ableser lesen assets/wikelo-trades.meta.json (committet), NICHT die von 20-RESEARCH.md vorformulierte, aber gitignorierte Rohextraktion — sonst reisst das Tor auf jeder Bauumgebung ohne lokale Spielinstallation (Grundsatz 4)."
  - "reviewedVersion/reviewedAt entfallen aus der Meta-Ausgabe (build-wikelo-trades.mjs) — ihr einziger Leser war die jetzt entfernte HANDPFLEGE-Zeile. curatedReviewedAt bleibt: andere Frage (Kuration geprueft) als gameVersion (Datenlauf)."
  - "Register-Eintrag id 51 per gsd-tools windows fixed 51 auf fixed gesetzt; das Werkzeug nimmt keinen reason-Parameter entgegen, die Begruendung wurde von Hand in JSON-Objekt UND Tabellenzeile nachgetragen (Plan sah diesen Fall ausdruecklich vor)."

requirements-completed: []  # Plan-Frontmatter: requirements: [] -- Phase 20 fuehrt D-01..D-04 statt REQ-IDs

coverage:
  - id: D1
    description: "Zwei Sperrklinken wikeloVertraege (min 69) und wikeloWarenposten (min 285) mit je einem Ableser, Bijektion haelt, Anlass nennt Register id 51 und CL 12519617"
    verification:
      - kind: unit
        ref: "node scripts/verify-metrics.mjs (24/24 Kennzahlen gelesen, 0 ohne Regel/Ableser/Anlass) + Inline-Node-Assertion aus Task 1 <verify>"
        status: pass
    human_judgment: false
  - id: D2
    description: "Wikelo als siebte STANDS-Zeile (gameVersion, Begleitdatei-Deckung 69/69), HANDPFLEGE leer, Zusicherung 1 auf 7/0 mitgezogen"
    verification:
      - kind: unit
        ref: "node scripts/verify-datastand.mjs (7 maschinell/0 handgepflegt, Wikelo CL 12519617, Abstand 0) + Inline-Node-Assertion aus Task 2 <verify>"
        status: pass
    human_judgment: false
  - id: D3
    description: "Drei Rot-Vorfuehrungen (wikeloVertraege < Klinke 67, wikeloWarenposten < Klinke 279, Wikelo-CL < Klinke 12519617), je per Erzeugerlauf zurueckgenommen"
    verification:
      - kind: unit
        ref: "manuelle Feldaenderung in assets/wikelo-trades.meta.json + node scripts/verify-metrics.mjs / verify-datastand.mjs, Meldungen woertlich im SUMMARY zitiert"
        status: pass
    human_judgment: false
  - id: D4
    description: "Register-Eintrag id 51 auf fixed, Begruendung nennt CL 12519617, 69, 285, loest 56/62 ab, verweist auf id 55/56; npm run build && npm run gate gruen normal UND STAGING=1; npm run gate:data gefahren"
    verification:
      - kind: integration
        ref: "npm run gate 23/23 (normal + STAGING=1); npm run gate:data (verify:items OK, verify:vehicles vorbestehend rot mangels lokaler vehicles-gamefiles.json, phasenfremd)"
        status: pass
    human_judgment: false

duration: ca. 22min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 3: Wikelo-Sperrklinke Summary

**Zwei Sperrklinken fangen einen Rueckgang der Wikelo-Vertrags- und Warenpostenzahl gegen ein committetes Artefakt ab, Wikelo wandert im Verzugstor aus der Handpflege in die maschinellen Datenstaende, alle drei neuen Tore wurden je einmal absichtlich gebrochen, und Register-Eintrag id 51 ist mit belegter Begruendung geschlossen.**

## Performance

- **Duration:** ca. 22 min
- **Started:** 2026-08-28T13:36Z (unmittelbar nach Plan 02, `75ff190`)
- **Completed:** 2026-08-28T13:55Z
- **Tasks:** 3
- **Files modified:** 7 (`scripts/lib/metrics-baseline.mjs`, `scripts/verify-metrics.mjs`, `scripts/verify-datastand.mjs`, `scripts/build-wikelo-trades.mjs`, `scripts/lib/gate-registry.mjs`, `assets/wikelo-trades.meta.json`, `.planning/WINDOWS.md`)

## Accomplishments
- `scripts/lib/metrics-baseline.mjs`: zwei neue Zeilen `wikeloVertraege` (min 69, Toleranz 2 %) und `wikeloWarenposten` (min 285, Toleranz 2 %), Anlass nennt Register id 51 und CL 12519617.
- `scripts/verify-metrics.mjs`: zwei neue Ableser, beide gegen `assets/wikelo-trades.meta.json` (committet) — bewusst NICHT gegen die gitignorierte Rohextraktion, wie in `20-RESEARCH.md` vorformuliert, mit begruendendem Kommentar im Code. Bijektion haelt: 24 Ableser, 24 Baseline-Zeilen, 0 unerklaerte Seite.
- `scripts/verify-datastand.mjs`: siebte `STANDS`-Zeile `Wikelo` (Begleitdatei-Fall wie „Zerlegung"), `HANDPFLEGE` jetzt leer (Mechanik bleibt stehen), `KLINKEN.Wikelo = 12519617`, Zusicherung 1 auf Soll 7 maschinell / 0 handgepflegt gezogen, Kopfkommentar nachgezogen.
- `scripts/build-wikelo-trades.mjs`: `reviewedVersion`/`reviewedAt` entfallen aus der Meta-Ausgabe (ihr einziger Leser war die entfernte `HANDPFLEGE`-Zeile), `curatedReviewedAt` bleibt bewusst (andere Frage). `assets/wikelo-trades.meta.json` neu erzeugt.
- `scripts/lib/gate-registry.mjs`: `checks`-Text von `verify:metrics` nennt die Wikelo-Bestandszahlen; `verify:datastand` bekommt einen datierten Anlass-Kommentar zum Umzug.
- Drei Rot-Vorfuehrungen, je einzeln, je per `node scripts/build-wikelo-trades.mjs` zurueckgenommen (Details unten).
- Register-Eintrag id 51 (`.planning/WINDOWS.md`) auf `fixed`, Begruendung von Hand nachgetragen (Werkzeug nimmt keinen `reason`-Parameter entgegen).
- `npm run build && npm run gate` gruen (23/23), normal UND mit `STAGING=1`; `npm run gate:data` gefahren.

## Task Commits

1. **Task 1: Zwei Sperrklinken und ihre Ableser — und zwar gegen ein committetes Artefakt** - `b0eba8a` (feat)
2. **Task 2: Wikelo wandert im Verzugstor von der Handpflege zu den maschinellen Datenstaenden** - `38347e0` (feat)
3. **Task 3: Vorgefuehrt rot (drei Tore) und Register id 51 schliessen** - `4b72d70` (docs)

**Plan metadata:** folgt (dieser Commit)

## Files Created/Modified
- `scripts/lib/metrics-baseline.mjs` - zwei neue Klinken (Wikelo-Abschnitt)
- `scripts/verify-metrics.mjs` - zwei neue Ableser gegen `assets/wikelo-trades.meta.json`
- `scripts/verify-datastand.mjs` - Wikelo aus `HANDPFLEGE` in `STANDS`, `KLINKEN.Wikelo`, Zusicherung 1 mitgezogen
- `scripts/build-wikelo-trades.mjs` - `reviewedVersion`/`reviewedAt` entfernt
- `scripts/lib/gate-registry.mjs` - `checks`-Text und Anlass-Kommentar nachgezogen
- `assets/wikelo-trades.meta.json` - neu erzeugt (ohne `reviewedVersion`/`reviewedAt`)
- `.planning/WINDOWS.md` - Register-Eintrag id 51 auf `fixed`, Begruendung ergaenzt

## Decisions Made
- Ableser lesen `assets/wikelo-trades.meta.json`, nicht die gitignorierte Rohextraktion (Grundsatz 4) — abweichend vom Code-Beispiel in `20-RESEARCH.md`, mit Begruendung im Code selbst.
- `reviewedVersion`/`reviewedAt` entfallen, `curatedReviewedAt` bleibt (siehe key-decisions oben).
- Register-Eintrag id 51: Begruendung von Hand nachgetragen, weil `gsd-tools windows fixed <id>` keinen `reason`-Parameter entgegennimmt (getestet: `--reason` unbekanntes Flag, zweites Positionsargument nicht akzeptiert) — der Plan sah diesen Fall ausdruecklich vor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kommentartext im Ableser durfte den Dateinamen der gitignorierten Quelle nicht wörtlich enthalten**
- **Found during:** Task 1, Inline-Verify-Assertion `!/wikelo-gamefiles\.json/.test(src)`
- **Issue:** Der erste Kommentarentwurf zur Begruendung der Quellenwahl nannte den Dateinamen der gitignorierten Rohextraktion wörtlich, um den Kontrast zu `20-RESEARCH.md` zu erklaeren — das ließ die eigene Verify-Assertion des Tasks reißen (sie prüft, dass die Zeichenkette nirgends in `verify-metrics.mjs` vorkommt, auch nicht im Kommentar).
- **Fix:** Kommentar umformuliert, ohne den Dateinamen wörtlich zu nennen (Umschreibung: „die gitignorierte Wikelo-Rohextraktion, .gitignore Zeile 35, Build-EINGABE von scripts/datamine-wikelo.mjs").
- **Files modified:** `scripts/verify-metrics.mjs`
- **Verification:** Inline-Assertion aus Task 1 `<verify>` läuft grün.
- **Committed in:** `b0eba8a` (Teil des Task-1-Commits — vor dem Commit gefunden und behoben)

---

**Total deviations:** 1 auto-fixed (Rule 3 — Blocking)
**Impact on plan:** Reine Formulierungskorrektur im Kommentar, keine inhaltliche Aenderung. Kein Scope-Creep.

## Issues Encountered

**Rot-Vorfuehrung 1 — `wikeloVertraege` unter der Klinke:**
`contractCount` auf 66 gesetzt, `node scripts/verify-metrics.mjs` gefahren. Meldung wörtlich:
```
wikeloVertraege: 66 liegt unter der Klinke 67 (Baseline 69, Toleranz 2%) — Ursache klaeren, nicht die Klinke senken. Anlass der Klinke: Phase 20 (D-04), Messlauf 28.08.2026 gegen gameVersion 4.10.0-live.12519617. [...]
```
Grenze `Math.floor(69 * 0.98) = 67` bestätigt. Zurückgenommen per `node scripts/build-wikelo-trades.mjs`.

**Rot-Vorfuehrung 2 — `wikeloWarenposten` unter der Klinke:**
`orderLineCount` auf 270 gesetzt. Meldung wörtlich:
```
wikeloWarenposten: 270 liegt unter der Klinke 279 (Baseline 285, Toleranz 2%) — Ursache klaeren, nicht die Klinke senken. Anlass der Klinke: Phase 20 (D-04), Messlauf 28.08.2026 gegen gameVersion 4.10.0-live.12519617 — 285 Warenposten ueber 69 Vertraege. [...]
```
Grenze `Math.floor(285 * 0.98) = 279` bestätigt. Zurückgenommen per `node scripts/build-wikelo-trades.mjs`.

**Rot-Vorfuehrung 3 — Wikelo-Klinke im Verzugstor:**
`gameVersion` auf `4.9.0-live.12344265` gesetzt, `node scripts/verify-datastand.mjs` gefahren. Meldung wörtlich:
```
Wikelo: CL 12344265 liegt unter der Klinke 12519617 — ein Erzeuger ist gegen einen aelteren Client gelaufen. Neu erzeugen, nicht die Klinke senken.
```
Als Nebeneffekt derselben Aenderung riss zusaetzlich Zusicherung 5 (Verzug im Kreuzvergleich, Abstand 175.352 > Toleranz 10.000) — beide Zusicherungen greifen unabhaengig, nicht nur wie vom Plan gefordert. Zurückgenommen per `node scripts/build-wikelo-trades.mjs`.

**`git diff --exit-code assets/wikelo-trades.meta.json` nach den Vorfuehrungen zeigte einen Rest-Diff — nur `generatedAt`, kein Inhaltsunterschied.**
Jeder Lauf von `build-wikelo-trades.mjs` schreibt `generatedAt: new Date().toISOString()` — ein live erzeugter Zeitstempel, der bei jeder Regeneration zwangslaeufig einen neuen Wert traegt, auch wenn alle Inhaltsfelder identisch zurueckkommen. Der Plan verlangt wörtlich `git diff --exit-code`, das gegen einen live-Zeitstempel strukturell nie sauber sein kann, sobald zwischen zwei Commits mehrfach neu gebaut wird. Verifiziert per Inhaltsvergleich ohne `generatedAt` (Node-Skript, JSON-Objekte nach Entfernen des Feldes byte-identisch: `true`) statt des wörtlichen Snippets — derselbe Umgang mit einem strukturellen Snippet-Stolperer wie die Markdown-Codezaun-Eigenheit in `20-02-SUMMARY.md`. Nicht behoben (kein Fehler, `generatedAt` ist by design live) und ausserhalb des Aufgabenbereichs dieser Welle — dokumentiert, damit ein spaeterer wörtlicher Nachlauf des Plan-Snippets nicht als Regress missverstanden wird. Die finale, in Task 3 committete `assets/wikelo-trades.meta.json` traegt exakt den vom letzten Erzeugerlauf gesetzten Zeitstempel; `git diff --exit-code` ist ab diesem Commit sauber.

**`npm run gate:data` — derselbe vorbestehende, phasenfremde Befund wie in Plan 01/02.**
`verify:items` läuft grün (strukturell konsistent, 35 Preis-Drift-Zeilen als WARNUNG). `verify:vehicles` bricht ab: `src/data/vehicles-gamefiles.json` fehlt lokal (gitignorete Zwischenstufe, würde erst `npm run datamine:loadouts && npm run datamine:vehicles` erzeugen). Vollständig unabhängig von den Wikelo-Änderungen dieser Welle, außerhalb des Aufgabenbereichs (SCOPE BOUNDARY) — protokolliert als bekannt und unverändert, nicht behoben, nicht als Regress dieser Welle gewertet.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

- Phase 20 ist damit technisch vollständig für D-01 bis D-04 (Zusammenführung, Kuration, Sperrklinke/Verzugstor). Plan 04 (falls geplant, Wikelo-Anzeige) kann auf einem jetzt geschützten Bestand aufsetzen — jeder Rückgang der Vertrags-/Warenpostenzahl oder ein veralteter Datenlauf fällt ab sofort maschinell auf.
- Register-Einträge id 55 (D-02, sieben unkuratierte Verträge inkl. „Wikelo Arrive to System") und id 56 (D-03, ATLS-Farbzuordnung inkl. neuer IKTI-Kollision) bleiben offen und warten auf die Betreiber-Sichtrunde — dieselbe Konvention wie bei den übrigen offenen Sichtrunden-Punkten des Projekts.
- Kein Blocker für die nächste Welle.

## Self-Check: PASSED

- FOUND: `scripts/lib/metrics-baseline.mjs` (wikeloVertraege/wikeloWarenposten bestätigt)
- FOUND: `scripts/verify-metrics.mjs` (Ableser bestätigt, 24/24 gelesen)
- FOUND: `scripts/verify-datastand.mjs` (Wikelo in STANDS, 7/0 bestätigt)
- FOUND: `assets/wikelo-trades.meta.json` (ohne reviewedVersion/reviewedAt)
- FOUND commit `b0eba8a` (Task 1)
- FOUND commit `38347e0` (Task 2)
- FOUND commit `4b72d70` (Task 3)
- FOUND: `.planning/WINDOWS.md` id 51 (status fixed, resolved_at gesetzt)

---
*Phase: 20-wikelos-angebote-kommen-aus-dem-bestand*
*Completed: 2026-08-28*
