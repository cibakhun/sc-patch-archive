---
phase: 02-schrift-und-bewegungsskala
plan: 02
subsystem: testing
tags: [node-test, regression-gate, css-custom-properties, morph-animation]

requires:
  - phase: 02-01
    provides: "Token-Schicht (--fs-10=1rem, --ls-15=0.18em) und die Umstellung von SiteNav.astro/beiden index.astro darauf"
provides:
  - "tests/e2e/typo-motion-morph.test.js: bleibendes Regressionstor, pinnt die zwei Messeingaenge von measureMorph() (--fs-10, --ls-15) und die Hero-Ausnahme gegen dist/"
  - ".planning/WINDOWS.md Eintrag id 3: benannte, offene Sichtrunde fuer Erfolgskriterium 3 (fuenf Pruefpunkte, Pruefweg+Erwartung+Gegenprobe je Punkt)"
affects: ["02-03", "02-04", "02-05", "02-06", "02-07"]

tech-stack:
  added: []
  patterns:
    - "Regressionsgatter als node:test-Datei gegen dist/ statt gegen die Quelle -- gleiche Begruendung wie verify-typo-motion.mjs (geprueft gehoert, was ausgeliefert wird)"
    - "Negativkontrolle als dokumentiertes, durchgefuehrtes Verfahren (Token testweise perturbieren, Fehlschlag beobachten, zuruecksetzen) statt einer unbelegten Behauptung ueber die Testqualitaet"

key-files:
  created:
    - tests/e2e/typo-motion-morph.test.js
  modified:
    - .planning/WINDOWS.md

key-decisions:
  - "Sichtrunde als Eintrag id 3 in WINDOWS.md angelegt statt per `gsd-tools windows append` -- das Werkzeug scheitert an einem bestehenden CRLF-Parserfehler im Ledger-Frontmatter (letzte Zeile vor dem schliessenden --- behaelt ihr \\r); Eintrag von Hand nach demselben Tabellen-/JSON-Schema angelegt und mit JSON.parse() gegengeprueft"
  - "Ledger-Kopfzeile (fixed_count/total_count) im selben Schritt korrigiert -- sie war seit dem manuellen Abhaken von Eintrag 2 (Phase 1.2) nicht neu gerechnet worden (fixed_count stand noch auf 0, obwohl Eintrag 2 laengst 'fixed' ist)"
  - "TYPO-03 in REQUIREMENTS.md bewusst NICHT abgehakt -- die Zeile dort dokumentiert bereits korrekt, dass es ein Sichturteil ist ('bleibt offen'); die Machbarkeit dieses Plans beweist nur, dass die EINGANGSWERTE der Wandlung unveraendert sind, nicht dass die Choreografie sich im Browser noch richtig anfuehlt"

patterns-established:
  - "Ein Test, der nie rot war, beweist nichts -- Negativkontrolle als Pflichtschritt vor dem Task-Commit, nicht als optionale Nachtraeglichkeit"

requirements-completed: []

coverage:
  - id: D1
    description: "tests/e2e/typo-motion-morph.test.js pinnt --fs-10=1rem, --ls-15=0.18em, die Migrationsprobe (.snav__brand liest wirklich ueber var(--fs-10)/var(--ls-15)) und die Hero-Ausnahme (clamp(2.9rem,12vw,8.5rem)+letter-spacing:-.02em, 360px-Regel) gegen dist/; Randfall fehlendes dist/ bricht mit klarer Meldung ab"
    requirement: TYPO-03
    verification:
      - kind: unit
        ref: "tests/e2e/typo-motion-morph.test.js (9/9 gruen, node --test)"
        status: pass
      - kind: other
        ref: "Negativkontrolle: --fs-10 in dist/assets/theme.css testweise auf 0.95rem gesetzt -- Zusicherung 1 schlug fehl (8/9), danach zurueckgesetzt (9/9 wieder gruen)"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm run test:e2e (215/215), verify:typo, verify:fx, verify:help laufen nach der neuen Testdatei weiterhin vollstaendig gruen -- keine Regression durch das neue Tor"
    verification:
      - kind: e2e
        ref: "npm run test:e2e (215 tests, 0 fail)"
        status: pass
      - kind: other
        ref: "npm run verify:typo (5/5 Zusicherungen), npm run verify:fx (7/7), npm run verify:help (6/6)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sichtrunde Phase 2 (Erfolgskriterium 3, scroll-verknuepfte Wandlung) als benannter, offener Eintrag id 3 in .planning/WINDOWS.md hinterlegt -- fuenf Pruefpunkte mit Pruefweg, erwartetem Ergebnis und Gegenprobe, DE+EN, 1280px+360px, beide Farbmodi"
    verification: []
    human_judgment: true
    rationale: "Kein Automat kann 'liest sich als ein Bewegungsbild' beurteilen (02-RESEARCH.md Architectural Responsibility Map weist das ausdruecklich dem Menschen zu). Die maschinelle Seite davon (D1) ist bewiesen; das Sichturteil selbst braucht einen Browser und einen Menschen und wird in Plan 07 mit der Schluss-Sichtrunde zusammengefuehrt."

duration: ~35min
completed: 2026-08-08
status: complete
---

# Phase 2 Plan 2: Regressionstor vor der Breite Summary

**Ein bleibendes `node:test`-Regressionsgatter (`tests/e2e/typo-motion-morph.test.js`) pinnt die beiden Messeingänge der scroll-verknüpften Hero↔Leiste-Wandlung (`--fs-10=1rem`, `--ls-15=0.18em`) gegen den gebauten Stand, mit durchgeführter Negativkontrolle; die Sichtprüfung, die kein Skript entscheiden kann, liegt als fünf-Punkte-Liste offen in `WINDOWS.md`.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (1 neu, 1 geändert)

## Accomplishments

- `tests/e2e/typo-motion-morph.test.js`: neun Zusicherungen gegen `dist/`, die exakt die zwei Werte pinnen, aus denen `measureMorph()` (`SiteNav.astro`) seine Wandlung berechnet — `--fs-10` (Schriftgrad-Token der Wortmarke, muss `1rem` bleiben) und `--ls-15` (Laufweiten-Token, muss `0.18em` bleiben) — plus eine Migrationsprobe (`.snav__brand` liest wirklich über `var(--fs-10)`/`var(--ls-15)`, kein zufällig passender Altwert) und eine Bewachung der Hero-Ausnahme (`.hero__mark h1` behält seine wörtliche `clamp(2.9rem,12vw,8.5rem)` + `letter-spacing:-.02em` + die 360px-Regel `2.5rem`, MARK-07).
- Negativkontrolle durchgeführt und dokumentiert: `--fs-10` im gebauten `dist/assets/theme.css` testweise auf `0.95rem` gesetzt — die Migrationszusicherung schlug wie erwartet fehl (8/9 statt 9/9), danach zurückgesetzt (wieder 9/9). Ein Test, der nie rot war, beweist nichts.
- Randfall geprüft: fehlt `dist/` (Ordner umbenannt), bricht der Test mit einer klaren `before()`-Fehlermeldung ab statt grün durchzulaufen oder mit einem nackten `ENOENT` zu crashen.
- `npm run test:e2e` (215/215), `npm run verify:typo` (5/5), `npm run verify:fx` (7/7), `npm run verify:help` (6/6) laufen nach dem neuen Test unverändert vollständig grün — kein Regressionsschaden am Werkzeugbestand aus Plan 01.
- `.planning/WINDOWS.md` trägt Eintrag `id 3`: die Sichtrunde für Erfolgskriterium 3, fünf benannte Punkte (Landung, Fortschrittskurve mit den 55%/75%-Marken aus `01-SUMMARY.md`, Tempo-Gegenprobe, Bewegungssprache-Eindruck mit Scroll-Reveal-Gegenprobe, 360px-Monogramm) je mit Prüfweg, erwartetem Ergebnis und Gegenprobe — kein „bitte mal draufschauen".

## Task Commits

1. **Task 1: Die beiden Messeingänge der Wandlung festnageln** - `207d781` (test)
2. **Task 2: Die Sichtrunde benennen und an den Betreiber übergeben** - `e2aebfb` (docs)

_Kein separater Metadaten-Commit vorab — dieser Summary-Commit übernimmt diese Rolle (siehe unten)._

## Files Created/Modified

- `tests/e2e/typo-motion-morph.test.js` - Bleibendes Regressionstor gegen `dist/`, neun Zusicherungen, Teil von `npm run test:e2e` über den bestehenden Glob
- `.planning/WINDOWS.md` - Eintrag id 3 (offene Sichtrunde Phase 2) + korrigierte Zähl-Kopfzeile

## Decisions Made

- Sichtrunde als Eintrag `id 3` von Hand nach dem exakten Tabellen-/JSON-Schema angelegt statt per `gsd-tools windows append` — das globale Werkzeug scheitert an einem bestehenden CRLF-Parserfehler im Ledger-Frontmatter (siehe Issues Encountered). Konsistenz mit `JSON.parse()` gegengeprüft.
- Die Ledger-Kopfzeile (`fixed_count`/`total_count`) im selben Schritt korrigiert — sie war seit dem manuellen Abhaken von Eintrag 2 (Phase 1.2) nicht neu gerechnet (`fixed_count` stand noch auf `0`, obwohl Eintrag 2 längst `fixed` ist).
- `TYPO-03` in `REQUIREMENTS.md` bewusst **nicht** angerührt — die Zeile dokumentiert dort bereits korrekt „bleibt offen: es ist ein Sichturteil" (siehe Commit `5b2fa0f` vor diesem Plan). Dieser Plan liefert den maschinellen Beweis, dass die Eingangswerte der Wandlung unverändert sind — das ersetzt nicht das Sichturteil selbst.

## Deviations from Plan

None - plan executed exactly as written. Die im Plan verlangten Verhaltenspunkte (sechs Behavior-Zeilen in Task 1, fünf Prüfpunkte in Task 2) sind vollständig umgesetzt, keine Abweichung nötig.

## Issues Encountered

- **`gsd-tools windows append` scheitert an einem CRLF-Parserfehler im Ledger:** `.planning/WINDOWS.md` ist durchgehend CRLF-terminiert (Windows-Umgebung). Der Frontmatter-Parser in `broken-windows.cjs` sucht die schließende `---`-Zeile über `raw.indexOf('\n---', ...)` (sucht nur `\n`, nicht `\r\n`) und schneidet dadurch den `\r` der letzten Frontmatter-Zeile vom folgenden `\n` ab — beim anschließenden Split über `/\r?\n/` bleibt dieser eine `\r` an der letzten Zeile hängen (`"last_updated: ...Z\r"`), was die Zeile als „nicht key: value" zurückweist. Das ist ein Fehler im globalen `~/.claude/gsd-core`-Werkzeug, nicht im Projekt-Repo — nicht behoben (außerhalb des Projekt-Scopes), sondern umgangen: Eintrag von Hand nach exakt demselben Schema angelegt, `JSON.parse()`-gegengeprüft, Tabellenzeile und JSON-Block synchron gehalten.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

Das Regressionstor steht: jede der ~90 verbleibenden Dateien in Plänen 03–06 kann jetzt an `.snav__brand`/`.hero__mark h1` vorbeigebaut werden, ohne dass eine Verschiebung der Wandlungs-Eingangswerte unbemerkt bliebe — `npm run test:e2e` schlägt dann fehl, nicht erst eine Sichtprüfung Wochen später. Die Sichtrunde selbst (Erfolgskriterium 3) bleibt bewusst offen und wird in Plan 07 mit der Schluss-Sichtrunde der gesamten Phase zusammengeführt; bis dahin ist Phase 2 nicht abnehmbar.

**Offener Punkt für den Betreiber** (`.planning/WINDOWS.md` id 3): fünf Sichtpunkte in DE+EN, 1280px und 360px, beide Farbmodi — Landung, Fortschrittskurve (55%/75%-Marken aus `01-SUMMARY.md`), Tempo-Gegenprobe, Bewegungssprache-Eindruck (mit expliziter Scroll-Reveal-Gegenprobe, D-03/FX-07), 360px-Monogramm (MARK-07, erwartungsgemäß kein Fund).

---
*Phase: 02-schrift-und-bewegungsskala*
*Completed: 2026-08-08*
