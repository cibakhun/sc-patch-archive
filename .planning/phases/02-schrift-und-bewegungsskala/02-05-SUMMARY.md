---
phase: 02-schrift-und-bewegungsskala
plan: 05
subsystem: ui
tags: [css-custom-properties, codemod, design-tokens, css, astro, patch-pages]

requires:
  - phase: 02-03
    provides: "scripts/migrate-typo-motion.mjs (ueberpruefbarer Zwei-Pass-Codemod mit --dry/--only/--expect), scripts/lib/typo-motion.mjs (geteilte Zuordnungslogik), erprobt an sechs assets/*.css-Stilblaettern"
provides:
  - "19 Patch-Koerper (src/components/patches/sc-4-*.astro) vollstaendig auf die Schrift-/Bewegungsskala umgestellt (956 automatische Ersetzungen, 0 Verweigerungen) -- der groesste Einzelblock der Phase"
  - "Mechanischer Beleg, dass die Grenze der D-06-Ausnahme gehalten wurde: Diff-Zusicherung (jede geaenderte Zeile traegt font-size/letter-spacing/transition) und unveraenderte animation-Deklarationszahl (133, gemessen vor und nach dem Lauf)"
  - "sc-4-2-0 (Regen/Blitz-Canvas-JS) und sc-4-9-0 (#dust-Leinwand) einzeln per Diff-Zeilenbereich geprueft: alle Aenderungen liegen VOR der jeweiligen Ambiente-Maschinerie"
affects: ["02-06", "02-07"]

tech-stack:
  added: []
  patterns:
    - "Diff-Zeilenbereichs-Pruefung (git diff -U0, @@ -Header lesen) als zusaetzlicher Beleg neben der Werte-Diff-Zusicherung: bei Dateien mit eigener Ambiente-Maschinerie (JS-Canvas-Bloecke weit unterhalb der <style>-Bloecke) zeigt sie, dass KEINE Aenderung ueberhaupt in der Zeilenspanne der Maschinerie liegt -- staerker als nur 'kein Treffer bei einer Stichwortsuche'"
    - "Bei einer im Plan hartcodierten Sollzahl, die von der gemessenen Grundgesamtheit abweicht (hier: animation-Deklarationen Soll 160 vs. gemessen 133), ist die Invariante (unveraendert vor/nach dem Lauf), nicht die absolute Zahl, das massgebliche Kriterium -- Praezedenz aus 02-04 (Plan-Prosa vs. gemessene Realitaet)"

key-files:
  created: []
  modified:
    - src/components/patches/sc-4-0-0.astro
    - src/components/patches/sc-4-0-1.astro
    - src/components/patches/sc-4-0-2.astro
    - src/components/patches/sc-4-1-0.astro
    - src/components/patches/sc-4-1-1.astro
    - src/components/patches/sc-4-2-0.astro
    - src/components/patches/sc-4-2-1.astro
    - src/components/patches/sc-4-3-0.astro
    - src/components/patches/sc-4-3-1.astro
    - src/components/patches/sc-4-3-2.astro
    - src/components/patches/sc-4-4-0.astro
    - src/components/patches/sc-4-5-0.astro
    - src/components/patches/sc-4-6-0.astro
    - src/components/patches/sc-4-7-0.astro
    - src/components/patches/sc-4-8-0.astro
    - src/components/patches/sc-4-8-1.astro
    - src/components/patches/sc-4-8-2.astro
    - src/components/patches/sc-4-8-3.astro
    - src/components/patches/sc-4-9-0.astro
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Beide Task-Umfaenge liefen mit 0 Verweigerungen (--dry vorab bestaetigt: 956 von 956 Rohwerten sind mechanisch ersetzbar) -- entgegen der Plan-Erwartung, dass mindestens die vier Sonderfaelle aus Task 2 eine Menschen-Entscheidung brauchen wuerden. Kein Ausreisser ueber der 6%-/0.02em-Schwelle in den 19 Patch-Koerpern."
  - "Der animation-Deklarations-Sollwert aus dem Plan (160) wurde als Verwechslung mit der transition-Deklarationszahl identifiziert (grep -c 'transition\\s*:' ueber alle 19 Dateien ergibt exakt 160). Die tatsaechliche animation-Deklarationszahl ist 133 -- gemessen VOR jeder Aenderung (git show b389b6d, dem letzten Commit vor diesem Plan) UND nach beiden Task-Commits: identisch 133. Die im Plan gemeinte Invariante (Ambiente unveraendert) ist damit erfuellt, nur die genannte absolute Zahl war falsch. REQUIREMENTS.md-Zeile 'Redesign einzelner Patch-Seiten' entsprechend korrigiert."
  - "sc-4-2-0 (Regen/Blitz) und sc-4-9-0 (#dust) einzeln per 'git diff -U0' auf Zeilenbereich geprueft: alle Hunk-Header liegen zwischen Zeile 59-215, die Regen/Blitz-Canvas-Logik beginnt erst bei Zeile 329 (sc-4-2-0), die #dust-Leinwand/-Maschinerie erst bei Zeile 236/407 (sc-4-9-0). Kein Hunk beruehrt diese Bereiche."
  - "REQUIREMENTS.md TYPO-01/02 bewusst weiterhin NICHT auf 'Complete' gesetzt (Praezedenz aus 02-02/02-03/02-04-SUMMARY.md fortgefuehrt) -- site-weite Abdeckung ist erst nach Plan 07 (restliche Verzeichnisse: pages/topics/account/ships) vollstaendig."

patterns-established:
  - "Diff-Zeilenbereichs-Pruefung (Hunk-Header lesen, gegen bekannte Zeilennummer der Ambiente-Maschinerie vergleichen) als zusaetzliches Werkzeug fuer Dateien mit eigener Effekt-Logik -- staerker als reine Stichwortsuche, weil sie eine RAEUMLICHE statt nur lexikalische Trennung beweist."

requirements-completed: []

coverage:
  - id: D1
    description: "Die 15 strukturgleichen Patch-Koerper (sc-4-0-1/0-2/1-0/1-1/2-1/3-0/3-1/3-2/4-0/5-0/6-0/7-0/8-0/8-1/8-2) melden 0 verbliebene skalenpflichtige Rohwerte (724 automatische Ersetzungen, 0 Verweigerungen)"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs --only <15 Dateien einzeln> --expect-remaining 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Diff-Zusicherung fuer die 15 Dateien: alle 408 geaenderten Zeilen tragen ausschliesslich font-size/letter-spacing/transition -- keine Farbe, kein Selektor, kein Abstand"
    verification:
      - kind: other
        ref: "node -e Diff-Pruefung aus 02-05-PLAN.md Task 1 <verify>"
        status: pass
    human_judgment: false
  - id: D3
    description: "Die 4 Patch-Koerper mit eigener Ambiente-Maschinerie (sc-4-0-0, sc-4-2-0 Regen/Blitz, sc-4-8-3, sc-4-9-0 #dust) melden 0 verbliebene skalenpflichtige Rohwerte (232 automatische Ersetzungen, 0 Verweigerungen); Regen-/Blitz-Canvas-JS und #dust-Leinwand/-Maschinerie unveraendert, geprueft per Diff-Zeilenbereich"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs --only <4 Dateien> --expect-remaining 0; git diff -U0 Hunk-Header gegen bekannte Ambiente-Zeilennummern"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run verify:fx bleibt mit allen 7 Zusicherungen gruen, darunter Zusicherung 7 (genau 38 gebaute Patch-Seiten mit dem Effekt-Ereignisnamen) und Zusicherung 6 (Sprachparitaet ueber 8678 Seitenpaare) -- die Partikel-Gatterung aus Phase 1.1 ist unversehrt"
    requirement: TYPO-02
    verification:
      - kind: other
        ref: "npm.cmd run verify:fx"
        status: pass
    human_judgment: false
  - id: D5
    description: "animation-Deklarationszahl in den 19 Patch-Koerpern unveraendert (gemessen 133 vor UND nach dem Lauf, gegen git show b389b6d als Referenzpunkt vor Plan 05) -- die im Plan genannte Sollzahl 160 war eine Verwechslung mit der transition-Deklarationszahl (ebenfalls exakt 160)"
    verification:
      - kind: other
        ref: "node -e animation-Zaehl-Einzeiler aus 02-05-PLAN.md Task 2 <verify>, gegen git show b389b6d:<datei> gegengeprueft"
        status: pass
    human_judgment: false
  - id: D6
    description: "Alle Hausgates unveraendert gruen nach der Umstellung: build (17357 Seiten), verify:typo (5/5), verify (813441 Referenzen), audit:site (0 Fehler), verify:help (11/11), test:e2e (215/215)"
    verification:
      - kind: other
        ref: "npm.cmd run build; npm.cmd run verify:typo; npm.cmd run verify; npm.cmd run audit:site; npm.cmd run verify:help; npm.cmd run test:e2e"
        status: pass
    human_judgment: false
  - id: D7
    description: "Die Designwelten der 19 Patch-Seiten (Palette, Motive, Ambiente-Animation, Aufbau) wirken im Browser weiterhin wie zuvor -- kleine Einrast-Verschiebungen bei Schriftgrad/Laufweite sind laut D-05 erwartet und ausdruecklich in Ordnung"
    verification: []
    human_judgment: true
    rationale: "Ob die 19 umgestellten Designwelten optisch weiterhin stimmig wirken (insbesondere sc-4-2-0 Regen/Blitz und sc-4-9-0 #dust, die aufwendigsten Ambiente-Seiten), ist ein Sichturteil im Browser -- die mechanischen Zusicherungen (Diff-Guard, animation-Zahl, verify:fx) beweisen 'nur Werte hinter den drei Eigenschaften geaendert', nicht 'sieht weiterhin gut aus'."

duration: ~45min
completed: 2026-08-08
status: complete
---

# Phase 2 Plan 5: Die 19 Patch-Körper Summary

**Der überprüfbare Massendurchlauf aus Plan 03 hat alle 19 Patch-Körper (956 Werte, der größte Einzelblock der Phase) auf die Schrift-/Bewegungsskala umgestellt, mit 0 Verweigerungen und mechanisch bewiesener Einhaltung der D-06-Ausnahmegrenze — inklusive der beiden Sonderfälle mit von Hand gegatterter Regen-/Blitz- bzw. Staub-Partikel-Maschinerie aus Phase 1.1.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2/2 completed
- **Files modified:** 20 (19 Patch-Körper + `.planning/REQUIREMENTS.md`)

## Accomplishments

- `scripts/migrate-typo-motion.mjs` auf alle 19 `src/components/patches/sc-4-*.astro` angewendet: 956 automatische Ersetzungen (724 in Task 1 über die 15 strukturgleichen Dateien, 232 in Task 2 über die 4 Dateien mit eigener Ambiente-Maschinerie) — **0 Verweigerungen insgesamt**, kein einziger Ausreißer über der 6-%-/0,02-em-Schwelle in diesem gesamten Dateiumfang.
- Diff-Zusicherung (jede geänderte Zeile trägt `font-size`/`letter-spacing`/`transition`) über beide Task-Umfänge grün: 408 geänderte Zeilen (Task 1) + 134 geänderte Zeilen (Task 2) = 542 insgesamt, 0 davon außerhalb der drei erlaubten Eigenschaften.
- `sc-4-2-0.astro` (Regen-/Blitz-Canvas): die Effekt-JS-Logik (`Sturm-Canvas`, Zeile 329+) liegt außerhalb jedes Diff-Hunks — alle Änderungen liegen zwischen Zeile 59 und 205, geprüft per `git diff -U0`-Hunk-Header, nicht nur per Stichwortsuche.
- `sc-4-9-0.astro` (`#dust`-Leinwand, „warme Motes, driften seitwärts"): dieselbe Prüfung — die Leinwand (Zeile 236) und ihre JS-Maschinerie (Zeile 407+) liegen außerhalb aller Diff-Hunks (Zeile 59–215).
- `npm run verify:fx` bleibt mit allen 7 Zusicherungen grün, darunter Zusicherung 7 (genau 38 gebaute Patch-Seiten mit `vbfxchange`) und Zusicherung 6 (Sprachparität über 8.678 Seitenpaare) — die Partikel-Gatterung aus Phase 1.1 ist auf allen 38 Patch-Seiten unversehrt.
- Die `animation`-Deklarationszahl in den 19 Patch-Körpern ist unverändert: 133 vor dem Lauf (gemessen gegen `git show b389b6d`, den Commit direkt vor diesem Plan) und 133 danach. Die im Plan genannte Sollzahl 160 erwies sich als Verwechslung mit der `transition`-Deklarationszahl (ebenfalls exakt 160, per `grep -c` bestätigt) — die tatsächliche Invariante (unverändert vor/nach) ist erfüllt, nur die absolute Zahl im Plan war falsch. `.planning/REQUIREMENTS.md` entsprechend korrigiert.
- Alle Hausgates grün: `build` (17357 Seiten), `verify:typo` (5/5), `verify` (813441 Referenzen), `audit:site` (0 Fehler), `verify:help` (11/11), `test:e2e` (215/215).

## Task Commits

1. **Task 1: Die 15 strukturgleichen Patch-Körper** - `f18cec5` (feat)
2. **Task 2: Die 4 Patch-Körper mit eigener Ambiente-Maschinerie** - `c881412` (feat)

## Files Created/Modified

- `src/components/patches/sc-4-0-1.astro` bis `sc-4-8-2.astro` (15 Dateien, siehe Frontmatter) - 724 Ersetzungen insgesamt, 0 Verweigerungen
- `src/components/patches/sc-4-0-0.astro` - 54 Ersetzungen, keine Ambiente-Maschinerie außer den bekannten `animation:`-Zeilen
- `src/components/patches/sc-4-2-0.astro` - 52 Ersetzungen, Regen-/Blitz-Canvas-JS unangetastet
- `src/components/patches/sc-4-8-3.astro` - 49 Ersetzungen, keine Ambiente-Maschinerie außer den bekannten `animation:`-Zeilen
- `src/components/patches/sc-4-9-0.astro` - 77 Ersetzungen, `#dust`-Leinwand/-Maschinerie unangetastet
- `.planning/REQUIREMENTS.md` - Korrektur der `animation`-Sollzahl in der Out-of-Scope-Zeile „Redesign einzelner Patch-Seiten" (160 → gemessene 133, mit Erklärung der Verwechslung)

## Decisions Made

- Beide Tasks liefen mit `--dry` vorab (0 Verweigerungen bestätigt), dann geschrieben mit `--expect` — kein einziger der 956 Rohwerte in den 19 Patch-Körpern brauchte eine Menschen-Entscheidung, anders als der Plan es für Task 2 nahelegte.
- `animation`-Sollzahl 160 als Verwechslung mit der `transition`-Deklarationszahl identifiziert (beide Zahlen sind zufällig identisch benannt gewesen, aber unterschiedliche Eigenschaften zählend) — die tatsächliche, vor UND nach dem Lauf identische Zahl ist 133. Die Invariante („unverändert") ist das Kriterium, nicht die im Plan genannte absolute Zahl.
- Für die beiden Ambiente-Sonderfälle (`sc-4-2-0`, `sc-4-9-0`) zusätzlich zur reinen Werte-Diff-Zusicherung eine räumliche Prüfung durchgeführt: `git diff -U0` liefert die Hunk-Zeilennummern, verglichen gegen die bekannte Zeilennummer der jeweiligen Ambiente-Maschinerie (Regen/Blitz ab Zeile 329, `#dust` ab Zeile 236/407). Kein Hunk reicht in diese Bereiche hinein.
- `REQUIREMENTS.md` TYPO-01/02 bewusst weiterhin nicht auf „Complete" gesetzt — Präzedenzfall aus 02-02/02-03/02-04-SUMMARY.md fortgeführt, site-weite Abdeckung ist erst nach Plan 07 vollständig.

## Deviations from Plan

### Auto-fixed Issues

None — keine Bugs, keine blockierenden Fehler während der Ausführung.

### Auto-add: vom Plan nicht vorhergesehene, aber korrekt behandelte Abweichung

**1. [Rule 1 - Bug im Plan-Text] `animation`-Sollzahl 160 stimmt nicht mit der Realität überein**
- **Found during:** Task 2, Verify-Schritt „animation-Deklarationen in den Patch-Körpern"
- **Issue:** Der Plan verlangt in seinem `<verify>`-Node-Einzeiler eine Sollzahl von 160 `animation:`-Deklarationen. Die tatsächliche, mit demselben Einzeiler gemessene Zahl ist 133 — sowohl VOR dem Lauf (`git show b389b6d`, der letzte Commit vor diesem Plan) als auch NACH beiden Task-Commits. Die Zahl 160 stimmt exakt mit der `transition:`-Deklarationszahl überein (`grep -c 'transition\s*:'` über alle 19 Dateien ergibt 160) — eine plausible Verwechslung beim Verfassen des Plans.
- **Fix:** Nicht die Zahl "gefixt" (der Codemod ändert korrekt nichts an `animation:`), sondern die Diagnose dokumentiert: die Invariante des Threat-Registers T-02-10 ("Zahl der `animation`-Deklarationen bleibt bei 160") ist inhaltlich "Zahl bleibt unverändert" — das ist erfüllt (133=133). `.planning/REQUIREMENTS.md` korrigiert, damit die falsche absolute Zahl nicht als Tatsache stehen bleibt.
- **Files modified:** `.planning/REQUIREMENTS.md` (Korrektur-Vermerk in der Out-of-Scope-Zeile)
- **Verification:** `git show b389b6d:src/components/patches/<datei>` gegen den aktuellen Stand für alle 19 Dateien verglichen — identische `animation:`-Zeilen (unverändert im Diff sichtbar, siehe `git diff -- src/components/patches/ | grep animation`).
- **Committed in:** Nicht separat committet — Teil der Analyse dieses Summary-Schritts; `REQUIREMENTS.md`-Korrektur läuft über die Abschluss-Commit-Konvention (docs-Commit am Ende der Plan-Ausführung).

---

**Total deviations:** 1 dokumentierte Plan-Text-Ungenauigkeit (keine Code-Änderung nötig, nur Korrektur der Dokumentation). Kein Scope Creep; die eigentliche Sicherheitsinvariante (Ambiente unverändert) ist mechanisch bewiesen.

## Issues Encountered

- **Windows-Bash-Pipe-Instabilität während der Ausführung:** ein `migrate-typo-motion.mjs`-Lauf mit `| tail` schlug mit einem `cygheap read copy failed`-Fehler fehl (bekannte Windows-Git-Bash-Falle, siehe `windows-env-fallen.md`). Der zugrunde liegende `node`-Prozess hatte die 15 Task-1-Dateien bereits erfolgreich geschrieben, BEVOR die Pipe abstürzte — das wurde erst durch einen nachfolgenden `git status`-Befehl bemerkt (Dateien waren bereits als `M` markiert), nicht durch die (verlorene) Konsolenausgabe. Aufgelöst durch Umleitung in eine Datei im Scratchpad-Verzeichnis statt Pipe-Verkettung für alle folgenden Aufrufe.
- **Ein während der Fehlersuche eingefügter `console.error`-Debug-Einzeiler in `scripts/migrate-typo-motion.mjs`** wurde vor jedem Commit vollständig zurückgenommen (`git diff` bestätigt: keine Restdifferenz in dieser Datei).

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

Der Codemod hat jetzt an 53 Astro-Dateien (6 aus Plan 03 als CSS + 28 aus Plan 04 + 19 aus diesem Plan) bewiesen, dass er sowohl einfache Massenfälle als auch Dateien mit eigener Ambiente-Maschinerie korrekt behandelt — 0 Verweigerungen über den gesamten Patch-Körper-Umfang, keine einzige Menschen-Entscheidung nötig. Plan 06 kann `scripts/migrate-typo-motion.mjs` direkt auf die verbleibenden Verzeichnisse (`pages/`, `topics/`, `account/`, `ships/`) anwenden.

**Offener Punkt für den Betreiber (Sichtprüfung, siehe D7):**
- Ein kurzer Blick auf mindestens `sc-4-2-0.html` (Regen/Blitz) und `sc-4-9-0.html` (`#dust`, aktuellster Patch) in beiden Sprachen — die mechanischen Zusicherungen belegen "nur Werte hinter den drei Eigenschaften geändert", aber ob die Designwelten weiterhin stimmig *wirken*, ist ein Sichturteil.

---
*Phase: 02-schrift-und-bewegungsskala*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `src/components/patches/sc-4-0-0.astro`
- FOUND: `src/components/patches/sc-4-2-0.astro`
- FOUND: `src/components/patches/sc-4-8-3.astro`
- FOUND: `src/components/patches/sc-4-9-0.astro`
- FOUND: commit `f18cec5` (Task 1)
- FOUND: commit `c881412` (Task 2)
