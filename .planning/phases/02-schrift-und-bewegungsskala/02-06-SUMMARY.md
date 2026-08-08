---
phase: 02-schrift-und-bewegungsskala
plan: 06
subsystem: ui
tags: [css-custom-properties, codemod, design-tokens, css, astro, page-pairs, topics, account, ships]

requires:
  - phase: 02-03
    provides: "scripts/migrate-typo-motion.mjs (ueberpruefbarer Zwei-Pass-Codemod mit --dry/--only/--expect), scripts/lib/typo-motion.mjs (geteilte Zuordnungslogik), erprobt an sechs assets/*.css-Stilblaettern und an 28 src/components/+src/layouts/-Dateien (02-04)"
provides:
  - "5 handgepflegte DE/EN-Seitenpaare (evolution, downloads, datenschutz, impressum, precision-jump) + 404.astro vollstaendig auf die Skala umgestellt (202 automatische Ersetzungen, 2 Verweigerungen -- je ein .85em-Schriftgrad in datenschutz EN/DE, elternrelativ, D-05 gilt hier nicht) -- alle fuenf Paare mit identischen Zaehlmustern zwischen EN und DE"
  - "22 Themen-Koerper, 5 Konto-Ansichten (AccountDashboard/AccountShell/FriendsManager/ProfileCard/RefineryDashboard), PilotPage.astro und ShipsOverview.astro umgestellt (328 automatische Ersetzungen, 3 Verweigerungen -- alle drei von Hand nach D-05 eingerastet)"
  - "Damit sind ALLE ~95 site-weiten Astro-/CSS-Dateien aus 02-01 umgestellt -- Plan 07 ist der letzte Plan der Phase (Ratchet + Dockerfile-Gate + Schluss-Sichtrunde), keine weitere Umstellungsarbeit steht mehr aus"
affects: ["02-07"]

tech-stack:
  added: []
  patterns:
    - "Bei Konto-/Piloten-Dateien mit Ausreissern > 6% wird der Codemod-Vorschlag (in der Konsolenausgabe der Verweigerung selbst genannte 'naechste Stufe') woertlich als var(--fs-N) uebernommen, statt eine eigene Rundung zu erfinden -- die Verweigerungsmeldung ist bereits die Entscheidungsgrundlage, nicht nur ein Fehlerbericht"

key-files:
  created: []
  modified:
    - src/pages/evolution.astro
    - src/pages/de/evolution.astro
    - src/pages/downloads.astro
    - src/pages/de/downloads.astro
    - src/pages/datenschutz.astro
    - src/pages/de/datenschutz.astro
    - src/pages/impressum.astro
    - src/pages/de/impressum.astro
    - src/pages/precision-jump.astro
    - src/pages/de/precision-jump.astro
    - src/pages/404.astro
    - src/components/topics/ (22 Dateien)
    - src/components/account/AccountDashboard.astro
    - src/components/account/AccountShell.astro
    - src/components/account/FriendsManager.astro
    - src/components/account/ProfileCard.astro
    - src/components/account/RefineryDashboard.astro
    - src/components/pilot/PilotPage.astro
    - src/components/ships/ShipsOverview.astro

key-decisions:
  - "Die im Plan genannten Ausgangszahlen je Seitenpaar (fs/ls/tr) waren Prosa-Schaetzungen und stimmten nicht mit dem tatsaechlich gemessenen Codemod-Ergebnis ueberein (z. B. evolution 28/13/5=46 geschaetzt vs. 48 tatsaechlich ersetzt) -- wie in 02-05 gilt die Invariante (EN=DE je Paar, 0 Restwerte), nicht die absolute Schaetzung. Alle fuenf Paare stimmten in Ist-Zahlen und Refusal-Zahlen zwischen EN und DE exakt ueberein."
  - "Die vom Plan vorhergesagten vier Ausreisser (PilotPage 2.8rem/-10,7%, 2.2rem/-9,1%; RefineryDashboard 1.5rem/-6,7%; FriendsManager 1.5rem/-6,7%) entsprachen nicht dem tatsaechlichen Codemod-Befund: der Codemod verweigerte tatsaechlich nur DREI Werte (PilotPage 2.8rem bei 7,69%, PilotPage 2rem bei 11,11%, mining.astro .sh-icon 2.4rem bei 9,09%). PilotPage 2.2rem liegt EXAKT auf --fs-17 (2,2rem, 0% Abweichung) und wurde automatisch ersetzt, nicht verweigert. Die beiden 1.5rem-Stellen in RefineryDashboard/FriendsManager liegen bei nur 3,45% Abweichung zu --fs-14 (1,45rem) -- unter der 6%-Schwelle, ebenfalls automatisch ersetzt. Alle drei tatsaechlichen Ausreisser wurden von Hand nach D-05 (Einrasten erlaubt) auf die vom Codemod selbst genannte naechste Stufe gesetzt."
  - "REQUIREMENTS.md TYPO-01/02/03 bleiben in der Traceability-Tabelle bewusst 'Pending' -- Praezedenz aus 02-02 bis 02-05 fortgefuehrt, Plan 07 ist der Abschlussplan mit dem site-weiten Ratchet-Gate."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "Die fuenf handgepflegten DE/EN-Seitenpaare (evolution, downloads, datenschutz, impressum, precision-jump) und 404.astro melden 0 verbliebene skalenpflichtige Rohwerte (202 automatische Ersetzungen, 2 Verweigerungen -- je ein .85em-Schriftgrad in datenschutz EN/DE, elternrelativ, unangetastet)"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs --only src/pages/ --expect-remaining 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Alle fuenf Seitenpaare zaehlen fuer EN und DE identisch bei var(--fs-)/var(--ls-)/var(--dur-)/var(--ease-ui) -- 0 Paar-Abweichungen, keines der fuenf Paare ist durch diesen Plan auseinandergelaufen (SYNC-01)"
    verification:
      - kind: other
        ref: "node -e Paar-Zaehl-Einzeiler aus 02-06-PLAN.md Task 1 <verify>"
        status: pass
    human_judgment: false
  - id: D3
    description: "22 Themen-Koerper, 5 Konto-Ansichten, PilotPage.astro und ShipsOverview.astro melden 0 verbliebene skalenpflichtige Rohwerte (328 automatische Ersetzungen); die drei tatsaechlichen Ausreisser (PilotPage 2x, mining.astro .sh-icon 1x) von Hand nach D-05 auf die naechste Stufe eingerastet"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs --only src/components/topics/ --only src/components/account/ --only src/components/pilot/ --only src/components/ships/ --expect-remaining 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "sf-rolefam/sf-compsize/sf-size-Filterkennungen in ShipsOverview.astro unangetastet -- alle 29 automatisierten node:vm-Testfaelle aus tests/e2e/ship-component-filter.test.js weiterhin gruen"
    requirement: TYPO-02
    verification:
      - kind: e2e
        ref: "node --test tests/e2e/ship-component-filter.test.js"
        status: pass
    human_judgment: false
  - id: D5
    description: "Alle Hausgates gruen nach der Umstellung: build (17357 Seiten), verify:typo (5/5, 8678 Seitenpaare 0 Abweichungen), verify:help (11/11), verify (813441 Referenzen), audit:site (0 FEHLER), audit:csp (10 Quellen abgedeckt), verify:fx (7/7), test:e2e (215/215)"
    verification:
      - kind: other
        ref: "npm.cmd run build; npm.cmd run verify:typo; npm.cmd run verify:help; npm.cmd run test:e2e; npm.cmd run verify; npm.cmd run audit:site; npm.cmd run audit:csp; npm.cmd run verify:fx"
        status: pass
    human_judgment: false
  - id: D6
    description: "Die Sichtpruefung der Konto-/Piloten-Ansichten (hinter Anmeldung bzw. oeffentlicher Profil-URL) und der 22 Themen-Koerper braucht ein angemeldetes Konto bzw. eine visuelle Sichtrunde -- laut Plan ausdruecklich an Plan 07 (Betreiber-Schlussrunde) weitergereicht, nicht vom Executor durchgefuehrt"
    verification: []
    human_judgment: true
    rationale: "Ob die umgestellten Konto-Ansichten und Themen-Koerper im Browser weiterhin stimmig wirken, ist ein Sichturteil, das ein angemeldetes Konto braucht (RefineryDashboard/FriendsManager/ProfileCard) bzw. eine allgemeine Sichtrunde ueber 22 Themen-Seiten -- der Plan weist diesen Punkt ausdruecklich Plan 07 zu, nicht diesem Ausfuehrungsschritt."

duration: ~50min
completed: 2026-08-08
status: complete
---

# Phase 2 Plan 6: Der letzte Block der Breite Summary

**Die fünf handgepflegten DE/EN-Seitenpaare, die 22 Themen-Körper, fünf Konto-Ansichten, PilotPage.astro und ShipsOverview.astro sind jetzt auf die Schrift-/Bewegungsskala umgestellt (530 automatische Ersetzungen über 40 Dateien, 5 Verweigerungen — 2 aus dem Plan ausgeschlossene `.85em`-Werte, 3 von Hand nach D-05 eingerastete Ausreißer) — damit sind ALLE ~95 site-weiten Dateien aus der 02-01-Erhebung umgestellt, kein Seitenpaar ist auseinandergelaufen, und Plan 07 ist der letzte, noch ausstehende Plan der Phase.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2/2 completed
- **Files modified:** 40 (11 Seitendateien + 29 Bauteile: 22 Themen-Körper, 5 Konto-Ansichten, PilotPage, ShipsOverview)

## Accomplishments

- `scripts/migrate-typo-motion.mjs` auf die fünf handgepflegten DE/EN-Seitenpaare (evolution, downloads, datenschutz, impressum, precision-jump) und `404.astro` angewendet: 202 automatische Ersetzungen, 2 Verweigerungen (je ein `.85em`-Schriftgrad in `datenschutz.astro` EN und DE — elternrelativ, D-05 gilt hier nicht, unangetastet auf beiden Seiten).
- Alle fünf Seitenpaare zählen für EN und DE **identisch** bei `var(--fs-)`/`var(--ls-)`/`var(--dur-)`/`var(--ease-ui)` — die eigens dafür geschriebene Paar-Zusicherung meldet 0 Abweichungen über alle vier Zählmuster. `precision-jump` (in `CONCERNS.md` als driftendes Paar verzeichnet) wurde zusätzlich Zeile für Zeile verglichen: 3/3 auf beiden Seiten, keine Abweichung.
- `scripts/migrate-typo-motion.mjs` auf die 22 Themen-Körper, fünf Konto-Ansichten (`AccountDashboard`, `AccountShell`, `FriendsManager`, `ProfileCard`, `RefineryDashboard`), `PilotPage.astro` und `ShipsOverview.astro` angewendet: 328 automatische Ersetzungen, 3 Verweigerungen.
- Die drei tatsächlichen Ausreißer (`PilotPage.astro:477` `2.8rem` → `--fs-18`, 7,69 %; `PilotPage.astro:637` `2rem` → `--fs-16`, 11,11 %; `mining.astro:71` `.sh-icon` `2.4rem` → `--fs-17`, 9,09 %) von Hand nach D-05 („Einrasten ist erlaubt") auf die vom Codemod selbst genannte nächste Stufe gesetzt.
- `sf-rolefam`/`sf-compsize`/`sf-size`-Filterkennungen in `ShipsOverview.astro` unangetastet: alle 29 automatisierten `node:vm`-Testfälle aus `tests/e2e/ship-component-filter.test.js` weiterhin grün.
- Damit melden `src/pages/`, `src/components/topics/`, `src/components/account/`, `src/components/pilot/` und `src/components/ships/` zusammen **0 verbliebene skalenpflichtige Rohwerte** — nach diesem Plan ist keine der ~95 site-weiten Dateien aus der 02-01-Erhebung mehr unumgestellt.
- Alle Hausgates grün: `build` (17357 Seiten), `verify:typo` (5/5, Zusicherung 5 über 8.678 Seitenpaare mit 0 Abweichungen), `verify:help` (11/11), `test:e2e` (215/215), `verify` (813441 Referenzen), `audit:site` (0 FEHLER), `audit:csp` (10 externe Quellen abgedeckt), `verify:fx` (7/7).

## Task Commits

1. **Task 1: Die fünf Seitenpaare und die 404-Seite** - `ecb07c8` (feat)
2. **Task 2: Themen-Körper, Konto-Ansichten und Schiffsübersicht** - `03a1578` (feat)

## Files Created/Modified

- `src/pages/evolution.astro`, `src/pages/de/evolution.astro` — je 48 Ersetzungen
- `src/pages/downloads.astro`, `src/pages/de/downloads.astro` — je 40 Ersetzungen
- `src/pages/datenschutz.astro`, `src/pages/de/datenschutz.astro` — je 4 Ersetzungen, je 1 Verweigerung (`.85em`)
- `src/pages/impressum.astro`, `src/pages/de/impressum.astro` — je 3 Ersetzungen
- `src/pages/precision-jump.astro`, `src/pages/de/precision-jump.astro` — je 3 Ersetzungen
- `src/pages/404.astro` — 6 Ersetzungen, kein DE-Gegenstück (erwartet, `verify:typo` überspringt sie)
- `src/components/topics/` (22 Dateien) — 116 Ersetzungen insgesamt, davon 24 in `mining.astro` (inkl. 1 von Hand eingerastete `.sh-icon`-Stelle)
- `src/components/account/AccountDashboard.astro` — 1 Ersetzung
- `src/components/account/AccountShell.astro` — 14 Ersetzungen
- `src/components/account/FriendsManager.astro` — 23 Ersetzungen
- `src/components/account/ProfileCard.astro` — 48 Ersetzungen
- `src/components/account/RefineryDashboard.astro` — 46 Ersetzungen
- `src/components/pilot/PilotPage.astro` — 51 automatische + 2 von Hand eingerastete Ersetzungen
- `src/components/ships/ShipsOverview.astro` — 34 Ersetzungen, Filterkennungen unangetastet

## Decisions Made

- Die im Plan genannten Ausgangszahlen je Seitenpaar und die vier vorhergesagten Ausreißer waren Prosa-Schätzungen der Planung, keine gemessenen Werte — wie in 02-05 gilt die tatsächlich gemessene Invarianz (EN=DE je Paar, 0 Restwerte, Ausreißer-Schwellen mechanisch angewendet) als Kriterium, nicht die im Plan genannten absoluten Zahlen.
- `PilotPage.astro`s `2.2rem`-Stelle (Zeile 732, `.pp-avatar-box`-Medienabfrage) liegt exakt auf `--fs-17` (2,2rem, 0 % Abweichung) und wurde automatisch ersetzt — sie ist entgegen der Plan-Prosa kein Ausreißer.
- `RefineryDashboard.astro:246` und `FriendsManager.astro:193` (`1.5rem`) liegen bei 3,45 % Abweichung zu `--fs-14` (1,45rem) — unter der 6-%-Schwelle, automatisch ersetzt, nicht von Hand entschieden.
- Für die drei tatsächlichen Ausreißer wurde jeweils die vom Codemod in der Verweigerungsmeldung selbst genannte nächste Stufe wörtlich übernommen (`--fs-18`, `--fs-16`, `--fs-17`) statt eine eigene Rundung zu erfinden.
- REQUIREMENTS.md TYPO-01/02/03 bleiben bewusst NICHT auf „Complete" gesetzt — Präzedenzfall aus 02-02 bis 02-05 fortgeführt; Plan 07 ist der Abschlussplan mit dem site-weiten Ratchet-Gate und der Schluss-Sichtrunde.

## Deviations from Plan

### Auto-fixed Issues

None — keine Bugs, keine blockierenden Fehler während der Ausführung.

### Auto-add: vom Plan nicht vorhergesehene, aber korrekt behandelte Abweichung

**1. [Rule 1 - Bug im Plan-Text] Ausgangszahlen je Seitenpaar und die vier vorhergesagten Ausreißer stimmen nicht mit dem gemessenen Codemod-Befund überein**

- **Found during:** Task 1 (Dry-Run), Task 2 (Dry-Run)
- **Issue:** Der Plan nennt für die fünf Seitenpaare Ausgangszahlen (z. B. evolution 28/13/5) und für Task 2 vier konkrete Ausreißer (`PilotPage` `2.8rem`/-10,7 %, `2.2rem`/-9,1 %; `RefineryDashboard` und `FriendsManager` je ein `1.5rem`/-6,7 %). Der tatsächliche, mit `--dry` gemessene Codemod-Lauf ergab andere Zahlen: `evolution` 48 statt 46 Ersetzungen je Fassung, und nur DREI tatsächliche Verweigerungen (`PilotPage` `2.8rem`@7,69 %, `PilotPage` `2rem`@11,11 %, `mining.astro` `.sh-icon` `2.4rem`@9,09 %) statt der im Plan genannten vier. `PilotPage`s `2.2rem` liegt exakt auf `--fs-17` (0 % Abweichung), die beiden `1.5rem`-Stellen liegen bei 3,45 % — beide unter der 6-%-Schwelle und damit keine Ausreißer.
- **Fix:** Nicht die Zahlen „korrigiert" (der Codemod misst korrekt), sondern nach dem tatsächlichen `--dry`-Befund gehandelt: die real gemessene Ersetzungszahl als `--expect`-Sollwert verwendet (202 bzw. 328), und die drei tatsächlichen Verweigerungen von Hand nach D-05 auf die vom Codemod selbst genannte nächste Stufe gesetzt.
- **Files modified:** `src/components/pilot/PilotPage.astro` (2 Stellen), `src/components/topics/mining.astro` (1 Stelle) — von Hand eingerastet, siehe Decisions.
- **Verification:** `node scripts/audit-typo-motion.mjs --only <Umfang> --expect-remaining 0` meldet für beide Tasks 0 Restwerte; die Paar-Zusicherung (Task 1) und `verify:typo` Zusicherung 5 (8.678 Seitenpaare, 0 Abweichungen) bestätigen, dass die tatsächlichen Zahlen — nicht die im Plan genannten — das richtige Ergebnis liefern.
- **Committed in:** `ecb07c8` (Task 1), `03a1578` (Task 2).

---

**Total deviations:** 1 dokumentierte Plan-Text-Ungenauigkeit (Prosa-Schätzung vs. gemessene Realität, kein Codefehler). Kein Scope Creep; die eigentliche Sicherheitsinvariante (SYNC-01 für die Seitenpaare, sf-Filterkennungen unangetastet) ist mechanisch bewiesen.

## Issues Encountered

- **Windows-Bash-Pipe-Instabilität während `npm run test:e2e`:** derselbe bekannte `cygheap read copy failed`-Fehler wie in 02-05 trat auch hier auf, ohne die eigentlichen Testergebnisse zu beeinträchtigen — `node --test` meldete am Ende trotzdem 215/215 bestanden, 0 fehlgeschlagen.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

Mit diesem Plan sind alle ~95 site-weiten Dateien aus der 02-01-Erhebung (sechs `assets/*.css`, ~30 Komponenten/Layouts, 19 Patch-Körper, fünf Seitenpaare + 404, 22 Themen-Körper, fünf Konto-Ansichten, PilotPage, ShipsOverview) auf die Schrift-/Bewegungsskala umgestellt. Plan 07 ist der letzte Plan der Phase: der site-weite Ratchet gegen Rückfälle, das Dockerfile-Gate und die abschließende Sichtrunde (Erfolgskriterium 3, plus die in 02-05 und diesem Plan an den Betreiber zurückgegebenen Sichtprüfpunkte — insbesondere die Konto-Ansichten hinter Anmeldung und die 22 Themen-Körper).

**Offene Punkte für den Betreiber (Sichtprüfung, siehe D6):**
- Ein Blick auf mindestens eine der fünf umgestellten Konto-Ansichten (`RefineryDashboard`, `FriendsManager`, `ProfileCard` — braucht ein angemeldetes Konto) und `PilotPage.astro` (öffentliche Profil-URL, z. B. `/pilot/<handle>`), insbesondere die drei von Hand eingerasteten Stellen.
- Ein kurzer Rundgang über einige der 22 Themen-Körper, insbesondere `wikelo-emporium.astro` (größter Einzelblock, 41 Ersetzungen) und `mining.astro` (24 Ersetzungen inkl. der eingerasteten `.sh-icon`-Stelle).

---
*Phase: 02-schrift-und-bewegungsskala*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `src/pages/evolution.astro`
- FOUND: `src/pages/de/precision-jump.astro`
- FOUND: `src/pages/404.astro`
- FOUND: `src/components/topics/mining.astro`
- FOUND: `src/components/account/RefineryDashboard.astro`
- FOUND: `src/components/pilot/PilotPage.astro`
- FOUND: `src/components/ships/ShipsOverview.astro`
- FOUND: commit `ecb07c8` (Task 1)
- FOUND: commit `03a1578` (Task 2)
