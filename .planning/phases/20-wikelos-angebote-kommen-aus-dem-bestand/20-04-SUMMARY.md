---
phase: 20-wikelos-angebote-kommen-aus-dem-bestand
plan: 04
subsystem: ui
tags: [astro, audit-site, provenance, wikelo, broken-windows]

# Dependency graph
requires:
  - phase: 20-wikelos-angebote-kommen-aus-dem-bestand
    provides: "scripts/build-wikelo-trades.mjs, assets/wikelo-trades.json/.meta.json (69 Vertraege, 285 Warenposten, 59 kuratiert), zwei Sperrklinken + Verzugstor-Zeile, Register id 51 fixed — Plan 01-03"
provides:
  - "Berichtigte Quellenangabe in src/components/topics/wikelo-emporium.astro — Angebote/Mengen ohne Herkunftsnennung (0 Datenherkunft-Funde), wikelotrades.com nur noch fuer Bild/Ausstattung/Reputationstext"
  - "Schlussmessung aller vier Phase-20-Erfolgskriterien mit Kommando und Zahl (nicht Behauptung)"
  - "Register-Eintrag id 57 (unrun-verify, Phase 20) — vier Sichtbloecke, verweist auf id 55 (D-02) und id 56 (D-03)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Herkunftsfreie Spielversions-Anzeige (Muster ship.version aus ShipDetail.astro/ShipsOverview.astro) auf eine weitere Themenseite uebertragen, ohne neuen i18n-Schluessel — die Seite fuehrt ihre Texte weiterhin als inline DE/EN-Ternaere"

key-files:
  created: []
  modified:
    - src/components/topics/wikelo-emporium.astro
    - .planning/WINDOWS.md

key-decisions:
  - "Fassungsangabe als 'Spielversion: Alpha {TRADES_META.patch}' inline ternaer statt ueber den zentralen i18n-Katalog (t('ship.version')) — die Datei fuehrt ihre Texte durchgaengig als DE/EN-Ternaere, ein neuer Import waere ein Bruch mit dem bestehenden Muster dieser einen Seite, nicht mit dem Projekt (Plan-Vorgabe: 'keine neuen i18n-Schluessel noetig')."
  - "assets/wikelo-trades.meta.json zweimal durch Regenerierung beruehrt (Task-1-Build und Task-2-Schlussmessung), beide Male auf den committeten Stand zurueckgesetzt (git checkout) — nur generatedAt aendert sich bei identischem Inhalt (bekannte, in 20-03-SUMMARY.md dokumentierte Eigenheit), gehoert nicht in den Diff eines Plans, der die Datei laut Frontmatter nicht aendert."

requirements-completed: []  # Plan-Frontmatter: requirements: [] -- Phase 20 fuehrt D-01..D-04 statt REQ-IDs

coverage:
  - id: D1
    description: "Sichtbarer Text nennt Angebote/Mengen ohne Fremdquelle und ohne veraltete Patch-Nummer; wikelotrades.com bleibt nur fuer Bild/Ausstattung/Reputationstext genannt; audit:site meldet 0 Datenherkunft-Funde"
    verification:
      - kind: integration
        ref: "node scripts/audit-site.mjs: 'Datenherkunft: 17450 Seiten + 19 JS-Dateien + 13 JSON-Dateien geprueft, 0 Fund(e)'; Inline-Node-Assertion aus Task 1 <verify> (kein '4.8.1', TRADES_META.patch '4.10.0' vorhanden, 'wikelotrades.com' vorhanden, 69× class=\"wk-tc\" in DE und EN)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Alle vier Phase-20-Erfolgskriterien am Endstand gemessen und beziffert (69 Vertraege/285 Warenposten aus dem Bestand, Register id 51 geschlossen, Sperrklinke haelt, Tore gruen normal+STAGING)"
    verification:
      - kind: integration
        ref: "node scripts/build-wikelo-trades.mjs (69/285/239/46/52/33/2/59/10/53) + drei Stichproben gegen assets/wikelo-gamefiles.json + node scripts/verify-metrics.mjs (wikeloVertraege/wikeloWarenposten) + node scripts/verify-datastand.mjs ([1]/[4]/[5]/[7]) + npm run build && npm run gate (23/23 normal, 23/23 STAGING=1) + npm run gate:data"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ein offener Sichtrunden-Punkt (id 57, kind unrun-verify, Phase 20) mit vier benannten Bloecken, DE+EN, beide Farbmodi, 1920x1080 UND 1280x720, verweist auf id 55/56"
    verification:
      - kind: unit
        ref: ".planning/WINDOWS.md id 57 (phase 20, status open, 2268 Zeichen, referenziert id 55/56) + Inline-Node-Assertion aus Task 2 <verify> (sicht.length>=1, description.length>400, id 51 fixed)"
        status: pass
    human_judgment: true
    rationale: "Die vier Bloecke (Anzeigenamen, Bild-Platzhalter, Filter-Pillen, berichtigte Quellenangabe) sind ausdruecklich Sichturteile am ausgelieferten staging-Stand (npm run check:staging) — kein Skript darf 'liest sich noch als Angebot' oder 'wirkt als Luecke' fuer den Betreiber entscheiden."

duration: ca. 22min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 4: Wikelo-Anzeige Summary

**Die Wikelo-Seite nennt ihre Quelle wieder richtig — Angebote/Mengen ohne Fremdquellen-Behauptung (0 Datenherkunft-Funde), wikelotrades.com nur noch fuer Bild/Ausstattung/Reputationstext — und alle vier Phase-20-Erfolgskriterien sind am Endstand mit Kommando und Zahl belegt.**

## Performance

- **Duration:** ca. 22 min
- **Started:** 2026-08-28T11:58Z (unmittelbar nach Plan 03, `3d5963f`)
- **Completed:** 2026-08-28T12:20Z
- **Tasks:** 2
- **Files modified:** 2 (`src/components/topics/wikelo-emporium.astro`, `.planning/WINDOWS.md`)

## Accomplishments
- `src/components/topics/wikelo-emporium.astro`: der Absatz unter dem Karten-Raster nennt jetzt die Kartenzahl (`TRADES.length`, dynamisch) und die Fassungsangabe aus `TRADES_META.patch` in der herkunftsfreien Form (`Spielversion: Alpha 4.10.0` / `Game version: Alpha 4.10.0`, Muster `ship.version` aus `ShipsOverview.astro`/`ShipDetail.astro`) — die veraltete Patch-Nummer `4.8.1` und die Behauptung, Angebote kaemen "direkt aus der Datendatei des Live-Trackers", sind entfernt. Der weiterhin wahre Hinweis ("Wikelos Bestand rotiert mit jedem Patch — im Zweifel im Spiel nachsehen") bleibt.
- Der erste Absatz im Abschnitt `<!-- SOURCES -->` nennt `wikelotrades.com` weiterhin, jetzt ausdruecklich eingegrenzt auf "Bilder, Ausstattung & Reputationstext" statt "Trade-Daten"; die Klammer mit fester Patch-Nummer und Abzugsdatum ist entfallen. `<Attribution sources={["starcitizen.tools", "wikelotrades.com", "RSI"]} />` unveraendert.
- Kopfkommentar ueber der Handelsliste zieht die tatsaechliche Quelle nach: `build-wikelo-trades.mjs` + `wikelo-curated.json` statt "wikelotrades.com scrape, patch 4.8.1".
- `node scripts/audit-site.mjs`: **0 Datenherkunft-Funde** (17450 Seiten + 19 JS-Dateien + 13 JSON-Dateien geprueft) — die neue Formulierung besteht die einzige Prüfung, die diese Regel als Tor traegt.
- Schlussmessung aller vier Erfolgskriterien: `build-wikelo-trades.mjs` erneut gefahren (69 Vertraege, 285 Warenposten, 239 Materialzeilen, 46 Favor-Karten, 52 mit Bild, 33 mit comps, 2 mit rep, 59 mit kuratierter Kategorie, 10 auf dem misc-Rueckfall, 53 Namensueberschreibungen); drei Stichprobenkarten (Asgard mit Favor, Armor with horn and string mit 5 Materialzeilen ohne Favor, Drake Clipper Wikelo War Special mit 1 Materialzeile ohne Favor) Zeile fuer Zeile gegen `assets/wikelo-gamefiles.json` gehalten — deckungsgleich.
- `node scripts/verify-metrics.mjs`: `wikeloVertraege >= 67 Ist 69`, `wikeloWarenposten >= 279 Ist 285`, Bijektion 24 Ableser/24 Baseline-Zeilen.
- `node scripts/verify-datastand.mjs`: 7 maschinelle/0 handgepflegte Datenstaende, `Wikelo: CL 12519617 Klinke 12519617`, Abstand 0.
- `npm run build && npm run gate`: **23/23 gruen**, normal (217.2s) UND mit `STAGING=1` (191.4s), erneut nach der WINDOWS.md-Aenderung (207.9s) — dreimal gelaufen, dreimal gruen.
- `npm run gate:data`: `verify:items` OK (35 Preis-Drift-Zeilen als WARNUNG), `verify:vehicles` vorbestehend rot (`src/data/vehicles-gamefiles.json` fehlt lokal) — derselbe phasenfremde Befund wie in Plan 01-03, nicht behoben, kein Regress.
- Neuer Register-Eintrag `.planning/WINDOWS.md` id 57 (`kind: unrun-verify`, `phase: 20`): vier benannte Sichtbloecke (Anzeigenamen, Bild-Platzhalter, Filter-Pillen, berichtigte Quellenangabe) mit konkreten Kartennamen und Zahlen, verweist ausdruecklich auf id 55 (D-02) und id 56 (D-03).

## Task Commits

1. **Task 1: Die Quellenangabe sagt wieder die Wahrheit** - `241819f` (fix)
2. **Task 2: Schlussmessung der vier Erfolgskriterien und Sichtrunde ins Register** - `7b4bc39` (docs)

**Plan metadata:** folgt (dieser Commit)

## Files Created/Modified
- `src/components/topics/wikelo-emporium.astro` - zwei berichtigte Textstellen (Absatz unter dem Karten-Raster, erster Absatz unter `<!-- SOURCES -->`) + nachgezogener Kopfkommentar
- `.planning/WINDOWS.md` - neuer Registerpunkt id 57 (open, unrun-verify, Phase 20), Frontmatter-Zaehler mitgezogen (`open_count` 28→29, `total_count` 55→56)

## Decisions Made
- Fassungsangabe als inline DE/EN-Ternaer `Spielversion: Alpha {TRADES_META.patch}` / `Game version: Alpha {TRADES_META.patch}` statt ueber `t('ship.version')` aus dem zentralen i18n-Katalog — folgt der Plan-Vorgabe ("keine neuen i18n-Schluessel noetig") und dem bestehenden Muster dieser einen Datei (alle Texte als inline `de ? ... : ...`, kein `useTranslations`-Import).
- `assets/wikelo-trades.meta.json` beide Male nach einem Regenerierungslauf (`build-wikelo-trades.mjs`, Task 1 vor dem Bauen und Task 2 fuer die Schlussmessung) per `git checkout` auf den committeten Stand zurueckgesetzt — der Diff enthaelt ausschliesslich `generatedAt`, kein Inhaltsunterschied (dieselbe, in `20-03-SUMMARY.md` dokumentierte Eigenheit), und die Datei steht nicht im `files_modified`-Frontmatter dieses Plans.

## Deviations from Plan

None - Plan exakt wie geschrieben ausgefuehrt. Der einzige Nebeneffekt (der `generatedAt`-Diff aus den Regenerierungslaeufen) ist kein Deviation-Fall, sondern eine bereits in Plan 03 dokumentierte, bekannte Eigenheit von `build-wikelo-trades.mjs` — behandelt wie dort (zurueckgesetzt, nicht committet).

## Issues Encountered

**`npm run gate:data` — derselbe vorbestehende, phasenfremde Befund wie in Plan 01-03.**
`verify:items` läuft grün. `verify:vehicles` bricht ab: `src/data/vehicles-gamefiles.json` fehlt lokal (gitignorete Zwischenstufe, würde erst `npm run datamine:loadouts && npm run datamine:vehicles` erzeugen). Vollständig unabhängig von den Wikelo-Änderungen dieser Welle, außerhalb des Aufgabenbereichs (SCOPE BOUNDARY) — protokolliert als bekannt und unverändert, nicht behoben, nicht als Regress dieser Welle gewertet.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Next Phase Readiness

- **Phase 20 ist damit technisch vollständig (4/4 Pläne)**, aber wie bei den Phasen 1.2/2/3/9/10/12/14/16 **NICHT „Complete" markiert** — drei offene Sichtrunden-Punkte warten auf den Betreiber, alle drei explizit gebündelt fuer eine Sitzung:
  - **id 55 (D-02)**: sechs unkuratierte Vertraege, darunter „Wikelo Arrive to System" ohne jede Belohnung.
  - **id 56 (D-03)**: vier ATLS-Farb-/Zusatzauftraege ohne aufloesbare Zuordnung.
  - **id 57 (diese Welle)**: vier Sichtbloecke zur berichtigten Anzeige (Anzeigenamen, Bild-Platzhalter, Filter-Pillen, Quellenangabe) — DE+EN, beide Farbmodi, 1920x1080 UND 1280x720, nur am ausgelieferten staging-Stand zu beurteilen (`npm run check:staging` vorher, vom Betreiber nach dem Push auszufuehren — dieser Ausführende hat wie angewiesen nicht gepusht).
- Kein Blocker fuer eine naechste Phase. Alle vier ROADMAP-Erfolgskriterien der Phase sind maschinell erfuellt und mit Zahl belegt; was noch offen ist, ist ausschliesslich Sichturteil.

## Self-Check: PASSED

- FOUND: `src/components/topics/wikelo-emporium.astro` (berichtigte Textstellen bestätigt)
- FOUND: `.planning/phases/20-wikelos-angebote-kommen-aus-dem-bestand/20-01-SUMMARY.md`
- FOUND: `.planning/phases/20-wikelos-angebote-kommen-aus-dem-bestand/20-02-SUMMARY.md`
- FOUND: `.planning/phases/20-wikelos-angebote-kommen-aus-dem-bestand/20-03-SUMMARY.md`
- FOUND commit `241819f` (Task 1)
- FOUND commit `7b4bc39` (Task 2)
- FOUND: `.planning/WINDOWS.md` id 57 (status open, phase 20, kind unrun-verify)
- FOUND: `.planning/WINDOWS.md` id 51 weiterhin `fixed`

---
*Phase: 20-wikelos-angebote-kommen-aus-dem-bestand*
*Completed: 2026-08-28*
