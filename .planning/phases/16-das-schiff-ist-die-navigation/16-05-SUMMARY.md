---
phase: 16-das-schiff-ist-die-navigation
plan: 05
subsystem: ui
tags: [gate, verify-script, ratchet, contrast, wcag, css-grid, node, playwright]

requires:
  - phase: 16-das-schiff-ist-die-navigation
    provides: "15-01..15-04: die Konsole (Rail/Buehne/Auslesung) steht end-to-end, verify:shipconsole ausgesetzt mit benanntem Anlass, D-05 hochformatige Buehne bei schmalen Breiten"
provides:
  - "Vier 1280px-Kollisionen behoben: Hero-Chrome (.holo__frame/.holo__hud/.holo__dims) ist jetzt Kind von .holo__wrap (rahmt nur die Buehne, nicht mehr die ganze Konsole); .holo{margin-top} beruecksichtigt die sichtbare Zurueck-Marke; .sd__slot .t bricht in der schmalen Auslesung-Spalte um"
  - "verify:shipconsole SCHARF im Laufplan der Schiene A (disabled entfernt), vorgefuehrte Rot-Meldung fuer verify:shipcards erweiterten Entdopplungs-Scan im SUMMARY dokumentiert"
  - "Textbestands-Klinke auf den nach dem Konsolen-Umbau gemessenen Minimalwert 3.224 Bytes gesetzt (Ausgangswert Welle 1/2: 3.177)"
  - "Hoehenklinke aus Phase 14 (4.200px) gegen den Konsolen-Stand nachgemessen -- haelt weit darunter (3.609/3.641px EN/DE), Fall 1 der Drei-Faelle-Regel, Marke unveraendert"
  - "Neue Messgruppe j-konsolen-kontrast in schiffskarte-messung.mjs (Rail-Zaehlzeile + Auslesung-Kopfzeile gegen 4,5:1), fand und behob einen echten Kontrastfund bei der Gruppe Antrieb im dunklen Modus"
  - "Fuenf neue Sichturteile in .planning/WINDOWS.md (ids 23-27), Tabelle+JSON+Kopfzeilen deckungsgleich"
affects: []

tech-stack:
  added: []
  patterns:
    - "Hero-Chrome-Elemente ohne eigenes grid-column/-row spannen bei CSS Grid den GESAMTEN Grid-Bereich, nicht nur eine Spalte -- Fallstrick, wenn ein frueher randloser Ein-Spalten-Container nachtraeglich zum Mehrspalten-Grid wird. Fix: als Kind der gewuenschten Spalte verschieben, nicht neu positionieren."
    - "Ein `:root:has(.snav__back:not([hidden]))`-Zuschlag auf die margin-top eines randlosen Bloecke haelt exakt in Hoehe des dortigen --nav-h-Zuwachses (SiteNav.astro), statt den Bezugspunkt selbst zu wechseln -- vermeidet Doppelverschiebung an nachgelagerten Elementen, die bereits einen eigenen (jetzt ueberholten) Zuschlag trugen."
    - "j-konsolen-kontrast-Messgruppe wiederverwendet dieselbe contrast()/luminance()-Bibliothek und dasselbe sampleExtremes()-Muster wie die bestehende f-kontrast-chip-Gruppe -- kein zweites Kontrastmass fuer eine neue Flaeche."

key-files:
  created: []
  modified:
    - src/components/ShipDetail.astro
    - scripts/lib/gate-registry.mjs
    - scripts/verify-shipconsole.mjs
    - scripts/probes/schiffskarte-messung.mjs
    - .planning/WINDOWS.md

key-decisions:
  - "Vier 1280px-Kollisionen (Zurueck-Marke auf der Rail, Brotkrume abgeschnitten, Massanzeige auf der Auslesung, unumbrochenes Kategorie-Label) VOR der Torschaerfung behoben, obwohl sie nicht in der urspruenglichen Plan-Frontmatter files_modified standen -- der Orchestrator hatte sie explizit als Blocker fuer staging benannt (deferred-items.md 20.08.2026) und dieselbe Ursachenfamilie: Hero-Chrome-Elemente, die den gesamten .holo-Grid-Bereich statt nur die Buehnenspalte spannen."
  - "Hoehenklinke NICHT abgesenkt und NICHT praezisiert (Fall 1 der Drei-Faelle-Regel aus 16-05-PLAN.md): die Konsole ist ein kompaktes Drei-Spalten-Band, keine gestapelte Kapitelinhalt-Erweiterung -- die volle Seitenhoehe faellt trotz neuer Konsole von 4.179px (Phase 14) auf 3.609-3.641px."
  - "Neue Kontrast-Messgruppe fuer die Konsole selbst geschrieben (schiffskarte-messung.mjs, nicht schiffskonsole-messung.mjs, da nur ersteres in files_modified stand) -- fand einen echten, bislang unentdeckten Befund: die Gruppe 'Antrieb' lag bei 4,43:1 im dunklen Modus, weil kein bisher gemessenes Pruefschiff sie als EINZIGE Rail-Gruppe hatte."
  - "Kontrastfund behoben statt an WINDOWS.md uebergeben: .holo__rail-ct traegt jetzt die reine --gc-Farbe statt einer 80/20-Mischung mit --muted -- derselbe kleine, risikoarme Eingriff, den Icon und Rahmen der Gruppe ohnehin schon nutzen (Groesse des Eingriffs entscheidet laut Planvorgabe, ob behoben oder uebergeben wird)."

requirements-completed: [D-01, D-02, P-1, P-2, P-3]

duration: ~1h50min
completed: 2026-08-20
status: complete
---

# Phase 16 Plan 5: Torschaerfung, Schlussmessung und fuenf Sichturteile -- die vier 1280px-Kollisionen sind mitbehoben Summary

**`verify:shipconsole` laeuft scharf in der Torkette, vier Hero-Chrome-Kollisionen bei 1280px sind behoben (Ursache: Elemente ohne grid-column spannten den gesamten Konsolen-Bereich statt nur die Buehne), die Hoehenklinke aus Phase 14 haelt trotz neuer Konsole weit unter der Marke (3.609px statt 4.200px), und ein neuer Kontrastfund bei der Rail-Gruppe "Antrieb" im dunklen Modus (4,43:1) ist behoben.**

## Performance

- **Duration:** ~1h50min
- **Completed:** 2026-08-20T17:40:00Z
- **Tasks:** 3/3 (Plan) + 1 zusaetzlicher Fund-Fix (die vier 1280px-Kollisionen, vom Orchestrator-Auftrag ausdruecklich verlangt)
- **Files modified:** 5

## Accomplishments

- **Vier 1280px-Kollisionen behoben, per Bildschirmfoto belegt (nicht nur per gruener Torfarbe).** `.holo__frame`/`.holo__hud`/`.holo__dims` waren Kind von `section.holo` ohne eigenes `grid-column`/`grid-row` -- CSS Grid spannt einem so positionierten Kind automatisch den GESAMTEN Grid-Bereich, nicht nur eine Spalte. Das war unbedenklich, solange `.holo` die einzige Spalte war; seit 16-04-PLAN.md Rail und Auslesung als eigene Spalten anlegte, lag die Zurueck-Marke auf der ersten Rail-Zeile, die Brotkrume wurde von der Rail verdeckt, und die Massanzeige ueberlagerte den Auslesung-Kopf. Fix: alle drei sind jetzt Kind von `.holo__wrap` (rahmen nur noch die Buehne). Zusaetzlich: `.holo{margin-top:56px}` kannte die sichtbare Zurueck-Marke nicht (SiteNav-Zuschlag `--nav-h` 68->104/116px) -- ein passender `:root:has(.snav__back:not([hidden]))`-Zuschlag ergaenzt, die dadurch ueberholten Text-Nachjustierungen an `.holo__hud`/`.holo__dims` entfernt. Vierte Kollision: `.sd__slot .t` (Kategorie-Label wie "SCHILDGENERATOREN") fehlte in der overflow-wrap/hyphens-Liste der schmalen Auslesung-Spalte und lief unumbrochen ueber den Rand -- ergaenzt.
- **Rot-Vorfuehrung eingeloest.** Ein Bewaffnungs-Kennwert ("48.433 DPS", Javelin) voruebergehend zusaetzlich im Ausstattungs-Kapitel dupliziert, `verify:shipcard` riss mit der woertlichen Meldung `"48,433 DPS" in Regionen [Specs › Defense | Weapons]` (EN) / `"48.433 DPS" in Regionen [Ausstattung › Verteidigung | Bewaffnung]` (DE) -- Dopplung sofort zurueckgenommen, zweiter Lauf wieder gruen, `git status --porcelain` nennt `ShipDetail.astro` nicht mehr.
- **`verify:shipconsole` scharf geschaltet.** `disabled` aus dem Registry-Eintrag entfernt, `run-gate --list` zeigt Schiene A mit 19 Strecken, 0 ausgesetzt, keinen Schuldenposten mehr aus dieser Phase.
- **Textbestands-Klinke auf 3.224 Bytes gesetzt** (Ausgangswert Welle 1/2: 3.177, +47 Bytes, wandert nach oben wie Grundsatz 5 verlangt).
- **Hoehenklinke aus Phase 14 nachgemessen, nicht abgesenkt.** Carrack/1280x720/dunkel: 3.609px EN / 3.641px DE -- weit unter der 4.200px-Marke (Fall 1 der Drei-Faelle-Regel). Grund verstanden: die Konsole ist ein kompaktes Drei-Spalten-Band, ihre Rail-/Auslesung-Spalten wachsen nicht additiv zur Seitenhoehe wie die vormaligen gestapelten Kapitel.
- **Neue Messgruppe `j-konsolen-kontrast`** (schiffskarte-messung.mjs) misst Rail-Zaehlzeile und Auslesung-Kopfzeile gegen 4,5:1 -- fand einen echten, bislang unentdeckten Fund (Gruppe "Antrieb", dunkler Modus, 4,43:1) und wurde behoben (siehe Decisions).
- **Fuenf Sichturteile** in `.planning/WINDOWS.md` (ids 23-27) eingetragen, je mit gemessenem Wert und Bildschirmfoto-Beleg.

## Task Commits

Vier Commits, eine zusaetzliche Fundbehebung vor Task 1:

0. **Kollisionsfix (Orchestrator-Auftrag, nicht in der urspruenglichen Plan-Frontmatter)** - `ae2f1f2` (fix)
1. **Task 1: Die Rot-Vorfuehrung einloesen und das Konsolen-Tor scharf schalten** - `79b0821` (feat)
2. **Task 2: Schlussmessung -- Hoehenklinke, DE gegen EN, beide Farbmodi** - `f07a7e3` (feat)
3. **Task 3: Die fuenf Fragen, die kein Skript beantwortet** - `028257f` (docs)

**Plan metadata:** dieser Commit (Summary + STATE/ROADMAP)

## Files Created/Modified

- `src/components/ShipDetail.astro` - Hero-Chrome-Elemente in `.holo__wrap` verschoben, `.holo`-margin-top-Zuschlag fuer die Zurueck-Marke, `.sd__slot .t`-Umbruch in der Auslesung, `.holo__rail-ct`-Farbe (reines `--gc` statt Mischung)
- `scripts/lib/gate-registry.mjs` - `disabled` von `verify:shipconsole` entfernt
- `scripts/verify-shipconsole.mjs` - Textbestands-Klinke auf 3.224 Bytes
- `scripts/probes/schiffskarte-messung.mjs` - Hoehenklinken-Anlasstext um die Welle-5-Messung ergaenzt, neue Messgruppe `j-konsolen-kontrast` (10 statt 9 Gruppen je Lauf)
- `.planning/WINDOWS.md` - fuenf neue Sichturteile (ids 23-27), Kopfzeilen-Zaehler mitgezogen

## Decisions Made

Siehe `key-decisions` im Frontmatter fuer die vollstaendige Begruendung. Kurzfassung:

- Kollisionsfix vor der Torschaerfung erledigt, obwohl nicht in der Plan-Frontmatter -- vom Orchestrator ausdruecklich als Blocker fuer staging benannt.
- Hoehenklinke unveraendert bei 4.200px belassen (Fall 1, nicht abgesenkt und nicht praezisiert).
- Kontrastfund der Gruppe "Antrieb" behoben statt an den Betreiber uebergeben (kleiner, risikoarmer Eingriff).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vier 1280px-Kollisionen behoben (nicht in `files_modified` der Plan-Frontmatter)**
- **Found during:** vor Task 1, als vom Orchestrator-Auftrag explizit verlangte Voraussetzung
- **Issue:** siehe Accomplishments oben -- Hero-Chrome-Elemente spannten nach dem CSS-Grid-Umbau (15-04) den gesamten Konsolen-Bereich statt nur die Buehne
- **Fix:** `.holo__frame`/`.holo__hud`/`.holo__dims` als Kind von `.holo__wrap` verschoben, `.holo`-margin-top-Zuschlag fuer die Zurueck-Marke ergaenzt, `.sd__slot .t`-Umbruch nachgetragen
- **Files modified:** `src/components/ShipDetail.astro`
- **Verification:** Bildschirmfotos vor/nach bei 1280px (drei Pruefschiffe, DE+EN) und Gegenprobe bei 900/760/360px; `verify:shipcard`/`verify:shipconsole`/`npm run gate` gruen
- **Committed in:** `ae2f1f2`

**2. [Rule 2 - Missing Critical] Kontrast-Messgruppe fuer die Konsole ergaenzt, ein echter Befund gefunden und behoben**
- **Found during:** Task 2, beim Umsetzen von "beide Farbmodi sind gemessen" (Erfolgskriterium 7)
- **Issue:** keine bestehende Sonde maass den Kontrast von Rail-Zaehlzeile/Auslesung-Kopfzeile; nach Ergaenzung fiel die Gruppe "Antrieb" (argo-atls, einziges Pruefschiff mit NUR dieser Gruppe) im dunklen Modus mit 4,43:1 unter die 4,5:1-Marke
- **Fix:** `.holo__rail-ct` traegt jetzt die reine `--gc`-Farbe (wie Icon/Rahmen der Gruppe) statt einer 80/20-Mischung mit `--muted`; alle vier Gruppen jetzt >=4,54:1
- **Files modified:** `src/components/ShipDetail.astro`, `scripts/probes/schiffskarte-messung.mjs`
- **Verification:** `node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4399` -- 240/240 Messpunkte gruen (vorher 236/240)
- **Committed in:** `f07a7e3`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 Bug, 1 Rule 2 Missing Critical)
**Impact on plan:** Beide notwendig, um die Plan-Acceptance-Criteria ehrlich zu erfuellen (Kollisionen waren ein expliziter Auftragsbestandteil, der Kontrastfund war ohne die neue Messgruppe unsichtbar). Kein Scope-Creep -- beide Aenderungen liegen innerhalb der Konsole, die diese Phase baut.

## Issues Encountered

- **Playwright/swiftshader-Flakiness bei den Sichturteil-Bildschirmfotos.** Mehrere Laeufe scheiterten mit `locator.waitFor: Timeout exceeded`, obwohl das gesuchte Element nachweislich im DOM stand (per `innerHTML()`-Dump bestaetigt) -- vermutlich Hauptthread-Konkurrenz zwischen der WebGL-Renderschleife (Software-Rasterung) und der CDP-Steuerung von Playwright bei 1280px-Canvas-Groesse. Nicht reproduzierbar bei kleineren Canvas-Groessen oder gefilterten Gruppen mit wenigen Markern. Behoben durch hoehere Timeouts (60s) und Wiederholung, kein Produktfehler.
- **`node scripts/probes/schiffskarte-messung.mjs`s eigener Verifikationsbefehl (`--only`) benennt Standardbasis `http://localhost:4321`** -- laut Umgebungsnotiz des Orchestrators ist das ein FREMDER, nicht zu dieser Sitzung gehoerender Dev-Server. Stattdessen durchgehend `astro preview` auf Port 4399 verwendet (`--base http://localhost:4399`), wie in allen vorherigen Wellen dieser Phase.

## User Setup Required

None - keine externe Dienstkonfiguration.

## Next Phase Readiness

- **Phase 16 ist technisch vollstaendig (5/5 Plaene), aber NICHT als "Complete" markiert** -- dieselbe Konvention wie bei den Phasen 1.2/2/3/9/10/12/14. Sieben offene Sichtrunden-Punkte zu Phase 16 (`.planning/WINDOWS.md` ids 21-27) warten auf den Betreiber:
  - id 21 (S-0, die tragende Frage der Phase, siehe Ergaenzung id 23)
  - id 22 (D-04 woertlich erfuellt, aber wirtschaftlich hohl -- Produktentscheidung)
  - id 23-27 (diese Welle, siehe oben)
- **Kein Blocker fuer staging mehr aus den vier 1280px-Kollisionen** -- der vom Orchestrator benannte Blocker ist behoben und per Bildschirmfoto belegt.
- `npm run build && npm run gate` gruen (20/20 Schritte), ebenso `STAGING=1`.
- `npm run check:staging` steht noch aus -- die Fertig-Meldung faellt erst, wenn die ausgelieferte Seite den neuen Stand zeigt.

---
*Phase: 16-das-schiff-ist-die-navigation*
*Completed: 2026-08-20*

## Self-Check: PASSED

Alle fuenf genannten Dateien gefunden (`src/components/ShipDetail.astro`,
`scripts/lib/gate-registry.mjs`, `scripts/verify-shipconsole.mjs`,
`scripts/probes/schiffskarte-messung.mjs`, `.planning/WINDOWS.md`).
Alle vier genannten Commit-Hashes gefunden (`ae2f1f2`, `79b0821`, `f07a7e3`,
`028257f`).
