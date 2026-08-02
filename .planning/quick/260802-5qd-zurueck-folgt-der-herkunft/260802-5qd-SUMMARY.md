---
phase: 260802-5qd-zurueck-folgt-der-herkunft
plan: 01
subsystem: ui
tags: [sessionStorage, history-api, back-navigation, i18n, astro, bfcache]

requires:
  - phase: 260802-3fw-zurueck-button-site-weit
    provides: assets/back-link.js (Basismechanik, semantischer Elternlink + history.back()-Aufwertung), SiteNav.astro Zurück-Element, DataShell.astro letzte-Krume-Aufwertung
provides:
  - "Herkunfts-Notiz (sessionStorage['vb:from']) mit Referrer als Echtheitssiegel"
  - "Parser-blockierender Inline-Leser in SiteNav.astro, der das Zurück-Element vor dem ersten Bild auf die tatsächliche Herkunft statt den semantischen Elternteil umschreibt"
  - "DataShell.astro markiert jetzt ALLE Krumen mit href statt nur der letzten -- back-link.js waehlt automatisch die zur Herkunft passende aus"
affects: [navigation, crafting-page, mining-page, item-finder, breadcrumbs]

tech-stack:
  added: []
  patterns:
    - "Herkunfts-Notiz + Referrer-Echtheitssiegel: sessionStorage traegt Pfad+Kurzname, document.referrer bestaetigt, dass die Notiz zu GENAU diesem Sprung gehoert (zwei Tore: gleiche Origin, referrer.pathname === notiz.p)"
    - "Parser-blockierendes Inline-Skript (kein defer, kein type=module) unmittelbar hinter dem strukturellen Element als Anti-Flacker-Muster (analog Theme-Skripten)"

key-files:
  created: []
  modified:
    - assets/back-link.js
    - src/components/SiteNav.astro
    - src/components/DataShell.astro

key-decisions:
  - "sessionStorage-Notiz mit Referrer als Echtheitssiegel gewaehlt statt URL-Serialisierung (Browser/bfcache kann Suchtext+Scroll bereits selbst) oder document.referrer allein (liefert keinen lokalisierten Kurznamen)"
  - "Leser-Selektor auf .snav__back statt a[data-backlink] umgestellt -- der Attribut-String landete sonst woertlich im Skripttext und verdoppelte sich im gebauten HTML"

requirements-completed: [QOL-ORIGIN-01, QOL-ORIGIN-02, QOL-ORIGIN-03, QOL-ORIGIN-04, QOL-ORIGIN-05, QOL-ORIGIN-06]

coverage:
  - id: D1
    description: "Vom Crafting (DE+EN) ueber einen Material-Chip zur Materialseite: das Zurueck-Element nennt die Herkunft (Crafting) statt des semantischen Elternteils (Archiv) und fuehrt per history.back() dorthin zurueck"
    requirement: "QOL-ORIGIN-01"
    verification:
      - kind: automated_ui
        ref: "agent-browser: crafting.html -> #cdb-search 'cannon' -> scroll 2600px -> Material-Chip 'Iron' -> mining.html; Zurueck-Element href=/topics/crafting.html, aria-label='Back to Crafting'; Klick -> zurueck auf crafting.html, Suchfeld='cannon', scrollY=2600 (EN); dasselbe fuer DE (href=/de/topics/crafting.html, Text '← Crafting', scrollY=2600 nach Rueckkehr)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rueckfallebene: leerer/fremder Referrer oder fehlende Notiz laesst den servergerenderten Eltern-Link (Archiv) unveraendert; ein hartes Neuladen der umgeschriebenen Seite faellt korrekt auf den Elternteil zurueck (Selbstbezug-Tor greift)"
    requirement: "QOL-ORIGIN-04"
    verification:
      - kind: automated_ui
        ref: "agent-browser: direkter Aufruf /topics/mining.html und /de/topics/mining.html (leerer Referrer) -> Element zeigt '← Archive'/'← Archiv', href=/archiv.html bzw. /de/archiv.html; nach Chip-Klick umgeschrieben auf 'Crafting', dann location.reload() -> referrer=Selbstpfad -> Element faellt zurueck auf '← Archiv'"
        status: pass
    human_judgment: false
  - id: D3
    description: "DataShell-Brotkrumen: jede Krume mit href traegt jetzt data-backlink; beim Sprung von einer Kategorieliste in ein Datenblatt und zurueck wird die passende (nicht zwingend letzte) Krume zu history.back() und stellt die Scrollposition wieder her, ohne eine Beschriftung umzuschreiben"
    requirement: "QOL-ORIGIN-06"
    verification:
      - kind: automated_ui
        ref: "agent-browser: /items/category/vehiclegear-weapons-guns.html -> scroll 1500px -> Item 10-series-greatsword-cannon.html; Krumen-Labels 'Items'/'Guns' unveraendert; Klick auf 'Guns'-Krume -> zurueck auf Kategorieliste, scrollY=1500"
        status: pass
    human_judgment: false
  - id: D4
    description: "Kein Aufflackern: der Inline-Leser ist parser-blockierend platziert (kein defer/type=module) unmittelbar hinter </nav>, bevor irgendetwas darunter gerendert wird"
    verification: []
    human_judgment: true
    rationale: "Netzwerk-/CPU-Drosselung zur Beobachtung eines moeglichen Zwischenzustands ist mit den verfuegbaren agent-browser-Kommandos in dieser Umgebung nicht steuerbar (kein throttle-Befehl gefunden). Strukturell bestaetigt (kein defer, kein type=module, Platzierung vor jedem folgenden Markup), aber die visuelle Drosselprobe selbst wurde nicht durchgefuehrt -- siehe 'Not verified'."

duration: ~35min
completed: 2026-08-02
status: complete
---

# Phase 260802-5qd: Zurück folgt der Herkunft Summary

**Herkunfts-Notiz in sessionStorage (Referrer als Echtheitssiegel) plus parser-blockierendem Inline-Leser in SiteNav.astro schreibt das Zurück-Element auf die tatsächliche Herkunft um, statt beim semantischen Elternteil stehenzubleiben; DataShell markiert jetzt jede Krume mit href statt nur die letzte.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-02T02:35:02Z
- **Tasks:** 3 (Task 1 Implementierung, Task 2 Vollbau+Nachweis, Task 3 Hinsehen/Browser-Verifikation)
- **Files modified:** 3

## Accomplishments
- `assets/back-link.js` notiert beim Laden die eigene Seite (Pfad + Kurzname) unter `sessionStorage['vb:from']`, erneuert die Notiz bei bfcache-Rückkehr (`pageshow`, `event.persisted`) und überspringt jetzt selbstbezügliche Krumen
- `SiteNav.astro` trägt Selbstauskunft (`data-back-self`), ein umschreibbares Label-`span` und einen parser-blockierenden Inline-Leser direkt hinter `</nav>`, der die Notiz der vorherigen Seite auswertet und bei bestandenem Referrer-Echtheitssiegel `href`/`data-back-path`/Label/`aria-label` auf die Herkunft umschreibt
- `DataShell.astro` markiert jetzt jede Brotkrume mit `href` (statt nur die letzte) mit `data-backlink`/`data-back-path` — `back-link.js` wählt daraus automatisch die zur Herkunft passende, ohne eine Beschriftung zu verändern

## Task Commits

Each task was committed atomically:

1. **Task 1: Herkunft notieren, vor dem ersten Bild auswerten, Brotkrume passgenau aufwerten** - `d66dbb6` (feat)
2. **Task 2 (Deviation, gefunden während der Verifikation): Leser-Selektor doppelte data-backlink im gebauten HTML** - `9e0133a` (fix)
3. **Task 2/3: Vollbau, CSP-Audit, dist-Nachweis, Browser-Verifikation** - keine weiteren Quelländerungen (nur Build-Artefakte in `dist/`, nicht versioniert)

**Plan metadata:** wird vom Orchestrator commitet (SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md)

## Files Created/Modified
- `assets/back-link.js` - Herkunfts-Notiz schreiben/erneuern (bfcache), Selbstbezug-Abbruch, bestehende history.back()-Klick-Schleife unverändert
- `src/components/SiteNav.astro` - `data-back-self`/`data-back-aria` auf dem Zurück-Element, `data-back-label`-Span, parser-blockierender Inline-Leser, CSS für lange Herkunftsnamen (Ellipse, `max-width`)
- `src/components/DataShell.astro` - jede Krume mit `href` trägt jetzt `data-backlink`/`data-back-path`; `data-back-self` auf `nav.dp-crumbs`; `backCrumbIdx` entfernt

## Decisions Made
- **Herkunfts-Notiz mit Referrer-Echtheitssiegel statt URL-Serialisierung oder nacktem `document.referrer`:** Der Browser bringt Suchtext und Scrollposition via bfcache ohnehin zurück (nichts zu gewinnen durch URL-Zustand); reines `document.referrer` liefert keinen lokalisierten Kurznamen ohne eine unpflegbare Pfad→Name-Tabelle über ~17.000 Seiten.
- **Leser-Selektor auf `.snav__back` statt `a[data-backlink]` umgestellt:** Der Attribut-Selektor-String `a[data-backlink]` landete wörtlich im ausgelieferten Skripttext und zählte beim dist-Nachweis (`grep -o 'data-backlink'`) doppelt (2 statt 1 Treffer pro Blattseite). Funktional identisch, ohne den literalen Attributnamen im Skript zu wiederholen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inline-Leser-Selektor verdoppelte `data-backlink` im gebauten HTML**
- **Found during:** Task 2 (Vollbau, CSP-Audit und Nachweis am erzeugten HTML) — beim Ausführen der automatisierten dist-Prüfung
- **Issue:** Der Inline-Leser suchte per `document.querySelector('a[data-backlink]')`. Da dieses Skript `is:inline` (nicht extern) ausgeliefert wird, landet der Selektor-String wörtlich im HTML der Seite. `grep -o 'data-backlink'` zählte dadurch 2 Treffer statt der erwarteten 1 (Anker-Attribut + Skript-String) auf jeder Blattseite mit Zurück-Element.
- **Fix:** Selektor auf `.snav__back` (Klassenname) umgestellt — funktional identisch, wiederholt aber nicht den literalen Attributnamen.
- **Files modified:** src/components/SiteNav.astro
- **Verification:** Vollbau erneut ausgeführt; `grep -o 'data-backlink' dist/topics/mining.html` liefert wieder genau 1 Treffer; komplette Task-2-Prüfkette (`TASK2_OK`) grün.
- **Committed in:** `9e0133a`

---

**Total deviations:** 1 auto-fixed (1 Bug)
**Impact on plan:** Reiner Implementierungsfehler, während der eigenen Verifikationskette des Plans gefunden und behoben, bevor er nach außen sichtbar wurde. Kein Scope Creep.

## Issues Encountered
- Beim Browser-Test führten einige `agent-browser find text "…" click`-Aufrufe (Fließtext-Matching) nicht zum erwarteten Klick — vermutlich traf der Text-Matcher ein anderes, gleichlautendes Element (z. B. verdeckte/gefilterte Karten oder Menüpunkte). Umgangen durch präzises DOM-Targeting via `agent-browser eval` (`document.querySelector` auf die konkrete Karte/Krume, dann `.click()`). Kein Produktcode-Problem, nur eine Testwerkzeug-Eigenheit.
- Vereinzelte `child_copy`/`fork`-Warnungen von Git-Bash beim Aufruf von `agent-browser` (Windows-Cygwin-Fork-Rennen) — transiente Umgebungsfehler, die Folgeaufrufe liefen sauber durch; keine Auswirkung auf das Ergebnis.

## Not Verified
- **Drosselprobe (gedrosseltes Netz/CPU) auf sichtbares Aufflackern**, wie im Plan unter Task 3 gefordert: Die in dieser Umgebung verfügbaren `agent-browser`-Kommandos boten keinen Netzwerk-/CPU-Throttle-Befehl (`agent-browser skills get core --full` listet keinen `throttle`-Befehl). Stattdessen strukturell bestätigt: der Leser ist `is:inline` ohne `defer`/`type="module"`, sitzt unmittelbar hinter `</nav>` und läuft dadurch parser-blockierend vor jedem folgenden Markup — dasselbe Muster wie die bestehenden Theme-Anti-Flacker-Skripte der Seite. Eine echte visuelle Drosselprobe wurde jedoch nicht durchgeführt; das sollte bei einer visuellen Nachprüfung ergänzt werden.
- **Tastatur-Fokus/Enter** auf dem umgeschriebenen Element wurde in diesem Plan nicht erneut geprüft (bereits in 260802-3fw für das unveränderte Element verifiziert; die Umschrift ändert nur `href`/Text/`aria-label`, nicht die Fokussierbarkeit des `<a>`-Elements selbst).

## User Setup Required
None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness
- Der gemeldete Ablauf (Crafting → Material-Chip → Materialseite → zurück) funktioniert jetzt in DE und EN identisch zur Meldung: Suchtext und Scrollposition kehren zurück, die Beschriftung nennt die tatsächliche Herkunft.
- Alle drei Rückfallproben (leerer Referrer, hartes Neuladen, Selbstbezug) bestätigt unverändert.
- Offen für eine spätere visuelle Nachprüfung: die explizite Drosselprobe aus Task 3 (siehe „Not Verified").

---
*Phase: 260802-5qd-zurueck-folgt-der-herkunft*
*Completed: 2026-08-02*

## Self-Check: PASSED

All created/modified files found on disk; both task commits (`d66dbb6`, `9e0133a`) confirmed in git log.
