---
phase: 14-schiffs-datenkarte-entstapeln
plan: 02
subsystem: ui
tags: [astro, css-tokens, i18n, intersection-observer, playwright-core, sticky-nav]

requires:
  - phase: 14-schiffs-datenkarte-entstapeln (Plan 01)
    provides: "verify-shipcard.mjs (disabled, Zielzustandspruefer) + schiffskarte-messung.mjs (Messsonde), beide vorgefuehrt/reproduziert gegen den unveraenderten Bestand"
provides:
  - "Kapitelliste im Frontmatter von ShipDetail.astro (CHAPTERS_SOURCE -> chapters) als EINZIGE Quelle fuer Sprungleiste UND Kapitelkoepfe, mit Kaufen-im-Verse als erstem (und in dieser Welle einzigem) Eintrag"
  - "`.sd__jump`/`.sd__jump__in` — klebende Kapitel-Sprungleiste unter der Kennwerte-Leiste, position:sticky/top:var(--nav-h), Bauform von .cdb-bar (CraftingApp.astro) uebernommen, GEMESSEN kompakt (30,6px statt der geschaetzten 46-50px)"
  - "`.sd__chapter`/`.sd__chapter--{buy,profile,gear,context}`/`.sd__chtitle`/`.sd__chnum` — Kapitelrahmen-Bauform samt allen vier Akzent-Modifikatoren (nur --buy in dieser Welle benutzt, die uebrigen drei fuer Welle 3 vorbereitet)"
  - "Sieben neue i18n-Schluessel je DE/EN (ship.ch.gear, ship.ch.context, ship.jump.buy, ship.jump.profile, ship.jump.aria, ship.code.spec, ship.code.ctx)"
  - "IIFE-Aktivmarkierung nach </main>: IntersectionObserver setzt .is-active + aria-current, degradiert sauber ohne JS/Observer/Sprungleiste"
  - "scripts/probes/schiffskarte-messung.mjs: scrollIntoViewIfNeeded()-Fix vor der Kontrastmessung (Zusicherung f war sonst an jedem unterhalb des Falzes liegenden Ziel blind)"
affects: [14-03, 14-04]

tech-stack:
  added: []
  patterns:
    - "Rahmen als `box-shadow: inset` statt `border` bei auto-Hoehe-Elementen mit engem Hoehenbudget — visuell identisch, kostet 0px Layout (box-sizing:border-box wirkt NUR bei explizit gesetzten Massen, nicht bei auto-Hoehe)"
    - "Kapitelliste-als-einzige-Quelle: ein Array im Frontmatter treibt sowohl die Sprungleisten-Pillen als auch die Kapitelkoepfe; Zahl-Chip-Nummer wird aus der GEFILTERTEN Liste abgeleitet (fortlaufend), nicht aus einer festen Zuordnung"

key-files:
  created: []
  modified:
    - src/components/ShipDetail.astro
    - src/i18n/ui.ts
    - assets/mobile-ux.css
    - assets/scroll-affordance.js
    - scripts/probes/schiffskarte-messung.mjs

key-decisions:
  - "Heading-Vergroesserung (fs-9 -> fs-12) auf `.sd__chapter .sd__phead h2` statt global `.sd__phead h2` gescopet — das UI-SPEC nennt den Selektor `.sd__phead h2` ohne Scope, aber ein globaler Treffer haette die Kopfzeilen-Groesse der neun noch UNKONVERTIERTEN .sd__panel in dieser Welle veraendert, obwohl der Phasenrahmen nur das Kaufen-Kapitel betrifft. Wird in Welle 3 automatisch site-weit, sobald alle vier Panels zu Kapiteln werden."
  - "Kapitel-Akzentfarben ueber Modifikator-Klassen (`.sd__chapter--buy .sd__chnum{background:var(--gold)}`) statt der im UI-SPEC vorgeschlagenen `--kapitel-akzent`-Inline-Variable — das UI-SPEC nennt beides als gleichwertige Option (\"per Inline-Style ODER Modifikator-Klasse\"), Modifikator-Klassen brauchen keinen zusaetzlichen Inline-Style-Ausdruck im Markup."
  - "Hoehenbudget-Korrektur: Rahmen der Sprungleisten-Pillen als `box-shadow: inset` statt `border`, Aussenabstand .55rem->.25rem, Pillen-Innenabstand .35rem->.2rem, `line-height:1` (Kniff aus .snav__back uebernommen). Gemessene Sprungleistenhoehe sank von 58,4px auf 30,6px — noetig, weil das tatsaechliche Hoehenbudget bei 1280x720 nur 34px betraegt, nicht die im UI-SPEC geschaetzten ~90px (die Schaetzung vergass `.holo{margin-top:56px}`)."
  - "scroll-margin-top-Zuschlag auf den GEMESSENEN Wert 31px gesetzt (vorher 64px geschaetzt) — identisch an 1280px und 360px, da die Sprungleistenhoehe breitenunabhaengig ist."

patterns-established:
  - "Bei extrem engem Hoehenbudget zuerst border->box-shadow(inset) tauschen, bevor Innenabstaende weiter gekuerzt werden — reklamiert 2px pro Kante ohne sichtbare Aenderung."

requirements-completed: [D-01]

coverage:
  - id: D1
    description: "Kapitel-Sprungleiste steht unter der Kennwerte-Leiste, ist bei 1280x720 ohne Scrollen sichtbar (Erfolgskriterium 3) und bleibt beim Scrollen erreichbar (position:sticky)"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4322 (Gruppe b-sprungleiste), 192 Messpunkte (3 Schiffe x 2 Sprachen x 2 Breiten x 2 Farbmodi) — Unterkante 717,0px bei 1280x720 (Fenster 720px)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Navigation funktioniert ohne JavaScript (echte <a href=\"#...\">-Anker), Aktivmarkierung ist reine Verbesserung mit sauberem Degradieren"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node -e \"...\" gegen dist/schiffe/anvl-carrack.html prueft <a href=\"#ch-...\"> als echten Anker (kein JS-Handler) — Ergebnis true, siehe Task 1 acceptance criteria"
        status: pass
    human_judgment: false
  - id: D3
    description: "Kapitelgeruest/Bijektion Pille<->Kapitel-id/Sprachparitaet ueber alle 454 Seiten ohne Befund (verify-shipcard Zusicherung 2, 3, 7)"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node scripts/verify-shipcard.mjs --report — Zusicherung [2] 0 Verstoesse/454 Seiten, [3] 908 geprueft/0 Verstoesse, [7] 227 Seitenpaare/0 Abweichungen"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bei 360px sind alle Pillen erreichbar, die Bildlaufleiste ist sichtbar, keine Pille bricht um, kein waagerechter Ueberlauf — an allen drei Pruefschiffen, beiden Sprachen, beiden Farbmodi"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4322 (Gruppen d/e/g), 192 Messpunkte, 0 Fehlschlaege ausser der erwarteten a-seitenhoehe-Sperrklinke"
        status: pass
    human_judgment: false
  - id: D5
    description: "Zahl-Chip haelt in beiden Farbmodi mindestens 4,5:1 Kontrast am gerenderten Bildpunkt"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node scripts/probes/schiffskarte-messung.mjs (Gruppe f-kontrast-chip, nach Fix von scrollIntoViewIfNeeded) — 9,58:1 dunkel / 7,31:1 hell"
        status: pass
    human_judgment: false
  - id: D6
    description: "Backstop: 11-Zeichen-DE-Pille „Ausstattung“ bricht bei 360px nicht um und sprengt die Pille nicht"
    verification: []
    human_judgment: true
    rationale: "Die Pille „Ausstattung“ rendert in diesem Tracer noch nicht (nur Kaufen-Kapitel existiert) — die Sonde kann sie nicht am echten Text pruefen. Ersatzweise mit dem gerenderten „Kaufen“ (6 Zeichen) und „Buy“ (3 Zeichen) belegt (Gruppe e-umbruch: 1 Pille, keine Hoehenabweichung). Der 11-Zeichen-Fall bleibt ausdruecklich offen und muss in Welle 3 (sobald die Pille real existiert) nachgeprueft werden — kein Verifier darf das hier als erledigt werten."
  - id: D7
    description: "Sichturteil: traegt die Sprungleiste bei 360px noch als Orientierung, wirkt das kompakte Hoehenbudget zu gedraengt?"
    verification: []
    human_judgment: true
    rationale: "Reines Sichturteil (14-UI-SPEC.md § Sichturteile Punkt 3) — kein Skript entscheidet, ob die auf 30,6px verdichtete Leiste noch komfortabel wirkt. Geht als benannter Punkt an .planning/WINDOWS.md."

duration: ~50min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 2: Sprungleiste und erstes Kapitel — der Tracer Summary

**Ein Weg durch alle Schichten: klebende Kapitel-Sprungleiste (30,6px kompakt statt der geschaetzten 46-50px) unter der Kennwerte-Leiste, "Kaufen im Verse" als erstes Kapitel mit Zahl-Chip und goldener Rahmenoberkante, sieben neue i18n-Schluessel, Aktivmarkierung per IntersectionObserver — alles am gerenderten Bildpunkt gemessen, nicht angenommen.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-18T03:29:00Z (im Anschluss an 14-01)
- **Completed:** 2026-08-18T04:10:00Z
- **Tasks:** 2
- **Files modified:** 5 (4 aus dem Plan + 1 Werkzeugfix)

## Accomplishments

- Kapitelliste im Frontmatter (`CHAPTERS_SOURCE` -> `chapters`) ist ab jetzt die EINZIGE Quelle fuer Sprungleiste und Kapitelkoepfe; die Kapitelnummer wird aus der gefilterten Liste fortlaufend abgeleitet.
- `.sd__jump`/`.sd__jump__in` (klebende Sprungleiste) und `.sd__chapter`/`.sd__chtitle`/`.sd__chnum` (Kapitelrahmen samt allen vier Akzent-Modifikatoren) stehen im Stilblock; nur der Kaufen-Modifikator ist in dieser Welle tatsaechlich im Markup verwendet.
- Das Kauf-Panel ist zum ersten Kapitel geworden: `sd__panel` -> `sd__chapter sd__chapter--buy`, `id="ch-buy"`, dreiteilige Kopfzeile (Zahl-Chip + Icon-Titel + Codezeile). Sein Inhalt (Preis-Held, Verkaufszeilen, Mietblock, Pledge-Zeile) ist unveraendert.
- Sieben neue Sprachschluessel je DE/EN in `src/i18n/ui.ts`, gruppiert als eigener Kommentarblock nach `ship.slot.radar`.
- Der neue Bildlauf-Kasten steht in allen drei Selektorlisten von `assets/mobile-ux.css` Abschnitt 5c UND in `assets/scroll-affordance.js` (`SEL_DRAG`, `SEL_FADE` — bewusst NICHT `SEL_VFADE`, die Leiste ist waagerecht).
- Aktivmarkierung: eigenstaendiges IIFE nach `</main>`, IntersectionObserver ueber `.sd__chapter[id]`, bricht sofort ab ohne Observer-Schnittstelle oder ohne Sprungleiste — kein Fehlerzustand, sauberes Degradieren.
- **Hoehenbudget gemessen, nicht geschaetzt (Task 2):** die tatsaechliche Kante zwischen Kennwerte-Leiste und Fensterunterkante liegt bei 1280x720 bei 686px, nicht den im UI-SPEC angenommenen 630px (`.holo{margin-top:56px}` fehlte in der Rechnung) — bleiben nur 34px statt ~90px. Sprungleiste auf 30,6px verdichtet (Rahmen als `box-shadow:inset` statt `border`, kleinere Innen-/Aussenabstaende, `line-height:1`), passt jetzt mit 3px Reserve ohne Scrollen ins Bild.
- `scroll-margin-top`-Zuschlag von der Task-1-Schaetzung (64px) auf den gemessenen Wert (31px) korrigiert; zweiter Messlauf bestaetigt, dass die Kapitelueberschrift nach einem Ankersprung an beiden Breiten ~32px unter beiden klebenden Leisten steht.
- Zahl-Chip-Kontrast gemessen: 9,58:1 dunkel / 7,31:1 hell — weit ueber der 4,5:1-Marke, keine Anpassung noetig.
- `verify-shipcard --report`: Zusicherung 2 (Kapitelgeruest), 3 (Bijektion) und 7 (Sprachparitaet) ohne Befund auf allen 454 Seiten; 4/5/6 melden erwartungsgemaess weiter Befunde (Tracer baut ein Kapitel, nicht die Phase).

## Task Commits

1. **Task 1: Sprungleiste und erstes Kapitel — ein Weg durch alle Schichten** - `4736e88` (feat)
2. **Task 2: Der Falz haelt — Hoehenbudget, Ankerziel und 360px am gerenderten Bildpunkt** - `4dd7fc7` (fix)

**Plan metadata:** siehe finaler Commit dieses Plans (folgt nach diesem SUMMARY)

## Files Created/Modified

- `src/components/ShipDetail.astro` - Kapitelliste (Frontmatter), Sprungleisten-Markup + -Stil, Kauf-Panel -> erstes Kapitel, Aktivmarkierungs-Skript, gemessenes Hoehenbudget + scroll-margin-top
- `src/i18n/ui.ts` - sieben neue Schluessel je DE/EN (ship.ch.*, ship.jump.*, ship.code.spec/ctx)
- `assets/mobile-ux.css` - `.sd__jump__in` in allen drei Selektorlisten von Abschnitt 5c
- `assets/scroll-affordance.js` - `.sd__jump__in` in `SEL_DRAG` und `SEL_FADE`
- `scripts/probes/schiffskarte-messung.mjs` - `scrollIntoViewIfNeeded()` vor der Kontrastmessung (Rule-3-Fix, siehe Deviations)

## Decisions Made

- **Heading-Vergroesserung nur innerhalb `.sd__chapter` gescopet, nicht global auf `.sd__phead h2`.** Das UI-SPEC nennt den Selektor ohne Scope-Praefix; ein ungescopeter Treffer haette in dieser Welle auch die neun noch unkonvertierten `.sd__panel` veraendert — ausserhalb des Phasenrahmens dieses Plans (nur das Kaufen-Kapitel). Wird in Welle 3 automatisch site-weit wirksam, sobald alle Panels zu Kapiteln werden.
- **Kapitel-Akzentfarben per Modifikator-Klasse statt `--kapitel-akzent`-Inline-Variable.** Das UI-SPEC nennt beides als gleichwertig ("per Inline-Style ODER Modifikator-Klasse"); die Modifikator-Klasse braucht keinen Inline-Style-Ausdruck im Markup und haelt die vier Farben zentral im Stilblock.
- **Rahmen als `box-shadow: inset` statt `border` an der Sprungleiste.** `box-sizing:border-box` (site-weit gesetzt) wirkt nur bei EXPLIZIT gesetzten Massen — bei auto-Hoehe kostet ein `border` immer zusaetzliche Layout-Hoehe. Ein `box-shadow: inset 0 0 0 1px` sieht optisch identisch aus und kostet 0px. Notwendig, um das gemessene 34px-Budget einzuhalten.
- **`scroll-margin-top`-Zuschlag auf den gemessenen Wert (31px) statt der Task-1-Schaetzung (64px).** Identisch an 1280px und 360px, weil die Sprungleistenhoehe breitenunabhaengig ist (Innenabstaende nutzen keine Breiten-Medienabfrage).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kontrastmessung der Sonde nahm den Screenshot ohne Ins-Bild-Scrollen**
- **Found during:** Task 2 (erster Testlauf der Sonde gegen das neue `.sd__chnum`)
- **Issue:** `.sd__chnum` liegt bei 1280x720 unterhalb des Falzes (y≈778px bei 720px Fensterhoehe) — `page.screenshot({ clip: box })` akzeptiert nur den sichtbaren Ausschnitt und wirft `Clipped area is either empty or outside the resulting image`, sobald die Box (teilweise) ausserhalb des Viewports liegt. Ohne Fix waere die im Plan geforderte Kontrastmessung (Konkrete Vorgabe 4/Task 2) an allen 24 Laeufen fehlgeschlagen — eine blockierende Luecke im eigenen Abnahmewerkzeug dieser Aufgabe.
- **Fix:** `chip.scrollIntoViewIfNeeded()` vor dem erneuten Lesen der Bounding-Box ergaenzt (`scripts/probes/schiffskarte-messung.mjs`, Gruppe f).
- **Files modified:** scripts/probes/schiffskarte-messung.mjs
- **Verification:** Alle 24 Kontrastmessungen (3 Schiffe x 2 Sprachen x 2 Breiten x 2 Farbmodi) liefern seither einen Wert statt eines Fehlers; 9,58:1 dunkel / 7,31:1 hell an der Carrack.
- **Committed in:** `4dd7fc7` (Task 2 Commit)

---

**Total deviations:** 1 auto-fixed (1 Blocking)
**Impact on plan:** Notwendig, um die im Plan verlangte Kontrastmessung (Konkrete Vorgabe 4 aus Task 2) ueberhaupt durchfuehren zu koennen — reine Werkzeug-Korrektheit, kein Scope-Creep. Die Datei ist nicht Teil der `files_modified`-Liste des Plans, war aber Voraussetzung fuer eine der acht Task-2-Zusicherungen.

## Issues Encountered

- **UI-SPEC-Hoehenrechnung war zu optimistisch.** Detailvertrag Punkt 1 schaetzte ~90px Restplatz bei 1280x720 (Hero 540px + Kennwerte-Leiste 90px = 630px), maass aber tatsaechlich 686px (34px Restplatz) — der Fehler war `.holo{margin-top:56px}`, das in der Schaetzung fehlte. Geloest durch Kompaktierung der Sprungleiste (siehe Decisions Made) statt einer Korrektur des Erfolgskriteriums, exakt wie Task 2 es vorschreibt ("Stellschrauben ... nicht das Kriterium gesenkt").
- Port 4321 war (wie in 14-01 dokumentiert) weiterhin durch einen fremden Dev-Server belegt; Task 2 lief gegen `npx astro preview --port 4322`, danach beendet.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Known Stubs

Keine. Die drei noch nicht verwendeten Kapitel-Modifikatoren (`--profile`, `--gear`, `--context`) sind KEIN Stub im Sinne von "faelschlich leer wirkende UI" — sie sind CSS-Regeln ohne zugehoeriges Markup in dieser Welle, ausdruecklich als Vorbereitung fuer Welle 3 im Plan verlangt und im SUMMARY dokumentiert. `verify-shipcard --report` meldet konsistent Zusicherung 4/5/6 als "weiterhin Befunde" — kein stiller Ausfall.

## Next Phase Readiness

- Die Bauform der Kapitelseite steht end-to-end und ist maschinell belegt: Kapitelliste-als-einzige-Quelle, Sprungleiste, Kapitelrahmen samt allen vier Akzentfarben, i18n, Bildlaufleisten-Ausnahmeliste, Aktivmarkierung, gemessenes Hoehenbudget.
- Welle 3 (`14-03-PLAN.md`, laut Roadmap: Balkenrueckbau + drei weitere Kapitel) kann die `CHAPTERS_SOURCE`-Liste direkt um drei Eintraege verlaengern, ohne die Bauform erneut anzufassen — die drei restlichen Modifikatorklassen und i18n-Schluessel liegen bereits bereit.
- **Offener Punkt fuer Welle 3:** der 11-Zeichen-Backstop ("Ausstattung"-Pille bei 360px) ist in diesem Tracer NICHT geprueft (die Pille rendert noch nicht) — muss nachgeholt werden, sobald sie real existiert (siehe `coverage: D6`).
- **Offener Punkt fuer die Sichtrunde:** ob die auf 30,6px verdichtete Sprungleiste noch komfortabel wirkt, ist ein Sichturteil (siehe `coverage: D7`) und geht als benannter Punkt an `.planning/WINDOWS.md`.
- Die Hoehen-Sperrklinke (Erfolgskriterium 6, 4.200px) bleibt erwartungsgemaess gerissen (5.544px EN / 5.600px DE) — das ist Aufgabe von Welle 4, nicht dieser.
- Kein Blocker. `npm run build && npm run gate` gruen, zusaetzlich je einmal mit `STAGING=1` nach Task 1 UND nach Task 2 (Layoutaenderungen in beiden Tasks).

## Self-Check: PASSED

All modified files found on disk; both task commits (`4736e88`, `4dd7fc7`) found in `git log`.

---
*Phase: 14-schiffs-datenkarte-entstapeln*
*Completed: 2026-08-18*
