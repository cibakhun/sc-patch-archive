---
phase: 260802-3fw-zurueck-button-site-weit
plan: 01
subsystem: ui
tags: [astro, nav, i18n, a11y, breadcrumbs]

# Dependency graph
requires: []
provides:
  - "Site-weites Zurück-Element in SiteNav.astro, aus dem crumbs-Prop + Pfad abgeleitet"
  - "assets/back-link.js: history.back()-Aufwertung nur bei nachweislicher Herkunft von der Elternseite"
  - "nav.back.aria i18n-Schlüssel (DE/EN)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chrome-Verhalten aus bereits vorhandenen Props ableiten statt ~100 Aufrufer anzufassen (Pfadsegmente als Diskriminator, nicht Crumb-Anzahl)"
    - "Progressive Enhancement: echter <a href> als Basis, JS wertet nur AUF (history.back()) bei geprüfter Herkunft, nie das Ziel"

key-files:
  created:
    - assets/back-link.js
  modified:
    - src/components/SiteNav.astro
    - src/components/MissionDetail.astro
    - src/i18n/ui.ts

key-decisions:
  - "Kein nacktes history.back() — Basis ist immer ein serverseitig gerendertes <a href>, das ohne JS und für Google-Ankömmlinge korrekt funktioniert"
  - "Pfadsegmente (verschachtelt = >=2) statt Crumb-Länge als Gate, weil Naben wie /schiffe.html selbst 2 Crumbs mit href tragen aber nur 1 Segment tief sind"
  - "account/* explizit ausgeschlossen — Auth-Fluss ist keine Inhaltsnavigation"
  - "MissionDetail.md__back entfernt statt daneben bestehen zu lassen — Regel 'genau eine sichtbare Elternnavigation pro Seite'"

patterns-established:
  - "Neue Chrome-Skripte folgen dem versioned()-Muster aus src/lib/assetVersion.ts und werden nur bedingt eingebunden, wenn die Seite sie braucht"

requirements-completed: [QOL-BACK-01, QOL-BACK-02, QOL-BACK-03, QOL-BACK-04]

coverage:
  - id: D1
    description: "Zurück-Element auf Schiff-/Missions-/Patch-/Themen-Detailseiten (DE+EN), abgeleitet aus crumbs, ohne Aufrufer anzufassen"
    requirement: "QOL-BACK-01"
    verification:
      - kind: automated_ui
        ref: "dist-Grep: dist/schiffe/*.html, dist/de/schiffe/*.html, dist/missionen/*.html, dist/de/missionen/*.html, dist/patches/sc-4-9-0.html, dist/de/patches/sc-4-9-0.html, dist/topics/mining.html, dist/de/topics/mining.html — je 1× data-backlink"
        status: pass
      - kind: manual_procedural
        ref: "agent-browser Screenshots 01-04 (EN/DE Ships, DE Patch, EN Topic, 1440px)"
        status: pass
    human_judgment: false
  - id: D2
    description: "history.back() nur bei nachweislicher Herkunft von der Elternseite, sonst normale Navigation (kein nacktes history.back())"
    requirement: "QOL-BACK-02"
    verification:
      - kind: unit
        ref: "node --check assets/back-link.js (Syntaxprüfung); Logikprüfung durch Quelltext-Review (Referrer-Origin+Pathname-Abgleich vor history.back())"
        status: pass
    human_judgment: true
    rationale: "Das eigentliche Referrer-Verzweigungsverhalten (kommt-von-Elternseite vs. kommt-von-Google) lässt sich in dieser Session nicht end-to-end im Browser nachstellen (document.referrer ist bei direkter agent-browser-Navigation leer/nicht die Elternseite) — Code-Review + die dokumentierte Logik sind die vorliegende Evidenz, ein Mensch sollte den Referrer-Pfad einmal mit echter Klick-Navigation bestätigen."
  - id: D3
    description: "Kein Doppelangebot: MissionDetail zeigt nach dem Umbau genau ein Zurück-Element, nicht zwei"
    requirement: "QOL-BACK-03"
    verification:
      - kind: automated_ui
        ref: "dist/missionen/bounty.html, dist/de/missionen/bounty.html — data-backlink count == 1; grep class=\"md__back\" count == 0"
        status: pass
      - kind: manual_procedural
        ref: "agent-browser Screenshot 05 (DE Missions-Detail) + get count [data-backlink] == 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "DataShell-Seiten (Item-/Crafting-Detail) bleiben unverändert — keine Zurück-Element, Brotkrumenspur intakt"
    requirement: "QOL-BACK-03"
    verification:
      - kind: automated_ui
        ref: "dist/items/*.html — data-backlink count == 0, dp-crumbs count >= 1"
        status: pass
      - kind: manual_procedural
        ref: "agent-browser Screenshot 06 (EN Item-Detail 300i)"
        status: pass
    human_judgment: false
  - id: D5
    description: "DE + EN, Tastatur (Tab+Enter), aria-label, Sci-Fi-Optik, Fingerkuppenmaß mobil"
    requirement: "QOL-BACK-04"
    verification:
      - kind: automated_ui
        ref: "grep 'nav.back.aria' src/i18n/ui.ts count == 2; dist aria-label Stichproben (Back to Archive / Zurück zu Archiv)"
        status: pass
      - kind: manual_procedural
        ref: "agent-browser: focus [data-backlink] + Screenshot 11 (sichtbarer Fokusring) + press Enter -> get url == /schiffe.html; Screenshots 07/08 bei 390px (kein Verdecken der Heldensektion)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Beide Farbmodi (hell/dunkel) tragen die Optik"
    verification: []
    human_judgment: true
    rationale: "Theme-Wahl ist projektweit Admin-only (Nicht-Admins fest Dunkel, siehe MEMORY.md dark-light-theme.md) — der Theme-Umschalter zeigte im Preview-Browser ohne Admin-Session keine Wirkung. Das neue Element nutzt ausschließlich var(--muted)/var(--accent), dieselben Tokens wie Suche/Menü/Konto direkt daneben, die bereits site-weit in beiden Modi verifiziert sind — aber der Hellmodus wurde für DIESES Element nicht selbst fotografiert. Ein Mensch mit Admin-Session sollte das nachholen."
    build:
      - kind: unit
        ref: "npm.cmd run build (17363 Seiten)"
        status: pass
      - kind: unit
        ref: "npm.cmd run audit:csp"
        status: pass

# Metrics
duration: 35min
completed: 2026-08-02
status: complete
---

# Phase 260802-3fw Plan 01: Zurück-Button site-weit Summary

**SiteNav.astro leitet ein Zurück-Element aus dem bereits vorhandenen `crumbs`-Prop und der Pfadtiefe ab — kein einziger der ~100 Aufrufer wurde angefasst; `assets/back-link.js` wertet nur bei nachweislicher Herkunft von der Elternseite zu `history.back()` auf.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 abgeschlossen
- **Files modified:** 4 (1 neu: `assets/back-link.js`; 3 geändert)

## Accomplishments
- Schiffe-, Missionen-, Patch- und Themen-Detailseiten zeigen in DE und EN ein sichtbares, tastaturbedienbares Zurück-Element mit korrektem `aria-label`, ohne dass ein einziger der ~100 SiteNav-Aufrufer geändert werden musste.
- `assets/back-link.js` liefert progressive Aufwertung: echter `<a href>` als Basis (funktioniert ohne JS, ist crawlbar), `history.back()` nur wenn `document.referrer` Herkunft UND Pfad der Elternseite exakt entspricht.
- MissionDetail.astro verlor seinen handgebauten `.md__back`-Doppelgänger — jetzt genau ein Zurück-Element pro Seite, site-weit konsistent.
- Naben (`/schiffe.html`, `/missionen.html`, Startseiten) und alle DataShell-Seiten (Items/Crafting, ~17.000 Seiten) bleiben unverändert bestätigt im gebauten `dist/`.

## Task Commits

1. **Task 1: Zurück-Element an EINER Stelle — SiteNav leitet es aus crumbs ab** - `b12a3b5` (feat)
2. **Task 2: Vollbau, CSP-Audit und Abdeckungsprüfung im dist** - kein Commit (nur `dist/` gelesen, keine Quelländerung; Build 17363 Seiten grün, `audit:csp` grün)
3. **Task 3: Hinsehen — Screenshots DE und EN, Schreibtisch und Telefon** - kein Commit (keine Quelländerung nötig, keine Fehler gefunden)

## Files Created/Modified
- `assets/back-link.js` - neues, klassisches (kein Modul) Skript: sucht `a[data-backlink]`, vergleicht `document.referrer` mit `data-back-path`, hängt bei Treffer einen `click`-Listener an, der unmodifizierte Linksklicks zu `history.back()` umleitet (modifizierte Klicks/Mittelklick unangetastet)
- `src/components/SiteNav.astro` - `backTarget`-Ableitung im Frontmatter (Pfadsegmente + letzter `crumbs`-Eintrag mit `href` vor dem aktuellen), neues `a.snav__back`-Markup als 4. Grid-Kind hinter `.snav__right`, bedingtes `<script>`-Tag über `versioned()`, CSS-Regelpaar inkl. 44px-Fingerkuppenmaß unter 860px
- `src/components/MissionDetail.astro` - `.md__back`-Link + zugehöriges CSS entfernt; unbenutzte `back:`-Locale-Keys in beiden Sprachobjekten entfernt
- `src/i18n/ui.ts` - `nav.back.aria` in beiden Sprachblöcken ergänzt (`Zurück zu` / `Back to`)

## Decisions Made
- Pfadsegmente statt Crumb-Länge als Gate-Kriterium: `/schiffe.html` (Nabe) trägt selbst 2 Crumbs mit `href` (Archiv → Schiffe), ist aber nur 1 Pfadsegment tief — der Pfad ist der verlässlichere Diskriminator, genau wie im Plan dokumentiert.
- `account/*` explizit ausgeschlossen (Segment 1 = `account`), obwohl `/account/login.html` 2 Pfadsegmente hat und einen `href`-Crumb trägt — Auth-Fluss ist bewusst keine Inhaltsnavigation.
- Elternteil = letzter Eintrag in `crumbs.slice(0, -1)` mit `href` — liefert bei 3-Crumb-Trails (Schiffe/Missionen-Detail) den direkten Elternteil, bei 2-Crumb-Trails (Patches/Themen) das Archiv, exakt wie im Survey der Plan-Datei vorgegeben.

## Deviations from Plan

None - plan wie geschrieben ausgeführt. Alle 6 Survey-Fälle (Schiffe/Missionen/Patches/Themen ×2 Sprachen) plus Naben und DataShell-Gegenprobe wurden im gebauten `dist/` bestätigt, keine Abweichung zur Gate-Logik nötig.

## Issues Encountered
- Git-Bash-Forks waren während der Browser-Automatisierung mehrfach flakey (`cygheap read copy failed`, bekannte Windows-Falle aus MEMORY.md) — betraf nur Kommando-Ausführung, nie das eigentliche Testergebnis; alle betroffenen Befehle lieferten trotzdem ihr korrektes Resultat.
- `agent-browser`s Flag hieß nicht `--window-size` sondern `agent-browser set viewport <w> <h>` — aus der `--help`-Ausgabe ermittelt.

## Not verified

**Hellmodus (Light Theme) für das neue Element wurde NICHT fotografiert.** Grund: Theme-Wahl ist projektweit Admin-only — Nicht-Admins bleiben fest im Dunkelmodus (siehe MEMORY.md `dark-light-theme.md`). Ein Klick auf den Theme-Umschalter im Preview-Browser (ohne Admin-Session) hatte keine sichtbare Wirkung. Das neue `.snav__back`-Element nutzt ausschließlich `var(--muted)`/`var(--accent)` — dieselben Tokens wie die direkt danebenliegenden, bereits site-weit in beiden Modi verifizierten Elemente (Suche, Konto, Menü) — das Risiko ist dadurch gering, aber nicht durch einen eigenen Hellmodus-Screenshot bestätigt. Ein Mensch mit Admin-Zugang sollte `dist/patches/sc-4-9-0.html` oder `dist/schiffe/*.html` einmal im Hellmodus ansehen.

**Fehlende Screenshots (von den geplanten 8):** Alle 8 geplanten Screenshots wurden erstellt und im Rahmen dieser Ausführung selbst angesehen (nicht nur automatisiert geprüft):
1. `01-en-ship-1440.png` — EN Schiff-Detail, 1440px ✅ angesehen
2. `02-de-ship-1440.png` — DE Schiff-Detail, 1440px ✅ angesehen
3. `03-de-patch-1440.png` — DE Patch-Seite, 1440px ✅ angesehen
4. `04-en-topic-1440.png` — EN Themen-Seite, 1440px ✅ angesehen
5. `05-de-mission-1440.png` — DE Missions-Detail, 1440px, genau 1 Zurück-Element bestätigt ✅ angesehen
6. `06-en-item-1440.png` — EN Item-Detail (DataShell), 0 Zurück-Elemente, Brotkrumen intakt ✅ angesehen
7. `07-en-ship-390.png` — EN Schiff-Detail, 390px mobil ✅ angesehen
8. `08-de-patch-390.png` — DE Patch-Seite, 390px mobil ✅ angesehen

Zusätzlich: `11-keyboard-focus.png` (sichtbarer Fokusring) + Enter-Navigation zu `/schiffe.html` bestätigt per `get url`.

Alle Screenshots liegen unter `C:\Users\mkris\AppData\Local\Temp\claude\...\scratchpad\shots\` (Session-Temp-Verzeichnis, nicht Teil des Repos).

## User Setup Required

None - keine externe Service-Konfiguration nötig.

## Next Phase Readiness
- Kein Blocker. Die Ableitung sitzt vollständig in `SiteNav.astro`; künftige neue SiteNav-Seiten mit verschachteltem Pfad und `href`-tragendem Eltern-Crumb bekommen das Zurück-Element automatisch, ohne dass diese Datei erneut angefasst werden muss.
- Offen: Hellmodus-Sichtprüfung durch einen Menschen mit Admin-Zugang (siehe „Not verified" oben).

---
*Phase: 260802-3fw-zurueck-button-site-weit*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: assets/back-link.js
- FOUND: src/components/SiteNav.astro
- FOUND: src/components/MissionDetail.astro
- FOUND: src/i18n/ui.ts
- FOUND: .planning/quick/260802-3fw-zurueck-button-site-weit/260802-3fw-SUMMARY.md
- FOUND commit: b12a3b5
