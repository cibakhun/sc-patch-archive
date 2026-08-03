---
phase: 05-komponenten-filter-f-r-schiffe
plan: 03
subsystem: ui
tags: [astro, filter-ui, i18n, node-test, node-vm, e2e]

requires:
  - phase: 05-komponenten-filter-f-r-schiffe (Plan 01)
    provides: "compAttr(id), CAT_ORDER, sf-comp/sf-size-Auswahlfelder und die erweiterte Filterlogik auf der EN-Seite"
  - phase: 05-komponenten-filter-f-r-schiffe (Plan 02)
    provides: "Turm-Kategorie (D-06a, TurretBase ohne Container), 47 Schiffe mit t, achter sf-comp-Eintrag"
provides:
  - "src/pages/de/schiffe.astro — identischer Komponenten-Filter wie die EN-Seite, nur Beschriftungen deutsch (sf-comp/sf-size, parseComp, sizesFor, rebuildSizeOptions, D-04/D-08/D-11/D-12-Logik)"
  - "tests/e2e/helpers/ships-dom.js — eigenstaendiges Mock-DOM (node:vm) fuer 227 Schiffskarten, zweite unabhaengige data-comp-Kodierung"
  - "tests/e2e/ship-component-filter.test.js — 26 Faelle gegen das ECHTE Inline-Skript beider Sprachfassungen, deckt D-04/D-08/D-10/D-11/D-12 und Sprachparitaet ab"
affects: [ship-catalog-maintenance, future-en-de-deduplication]

tech-stack:
  added: []
  patterns:
    - "Zweite, unabhaengige Kodierung der data-comp-Regel im Testhelfer statt Wiederverwendung von compAttr() -- ein Test darf nicht dieselbe Funktion pruefen, mit der er seine eigene Erwartung bildet"
    - "Mock-DOM praegt den anfaenglichen sf-count-Text vor (server-gerendeter Zustand), weil das Inline-Skript apply() beim Laden NIE selbst aufruft -- nur bei spaeteren Eingaben"

key-files:
  created:
    - tests/e2e/helpers/ships-dom.js
    - tests/e2e/ship-component-filter.test.js
  modified:
    - src/pages/de/schiffe.astro

key-decisions:
  - "PLAN.md-eigene Ankererwartung korrigiert: 'aegs-hammerhead bei Turm und 6 sichtbar' ist mit den D-06a-Realdaten falsch (gespeicherter Max-Wert t=5, nicht 6 -- 05-02-SUMMARY.md hatte das bereits als bekannte Verwechslung Anzahl/Groesse dokumentiert). Test und manueller Nachweis pruefen stattdessen Turm+S5 (sichtbar) -- konsistent mit der echten JSON."
  - "PLAN.md-eigene Zahl '59 Turmkarten' im Task-1-<verify>-Regex durch die seit D-06a gueltige Zahl 47 ersetzt (bereits in 05-02-SUMMARY.md als notwendige Korrektur fuer diesen Plan vermerkt)."
  - "ships-dom.js baut initial nur einen Leereintrag in sf-size und praegt sf-count je nach opts.lang mit dem server-gerenderten Ausgangstext vor -- ohne diese Vorpraegung würde jeder 'unveraenderter Zaehler'-Test fehlschlagen, weil das Inline-Skript beim Laden nichts schreibt."

requirements-completed: [D-04, D-05, D-07, D-08, D-09, D-10, D-11, D-12]

coverage:
  - id: D1
    description: "src/pages/de/schiffe.astro traegt denselben Filter wie die EN-Seite: compAttr-Import, data-comp-Attribut, sf-comp/sf-size mit deutschen Beschriftungen, identische Optionswerte, erweitertes Inline-IIFE (parseComp/sizesFor/rebuildSizeOptions/D-04/D-08/D-11/D-12)"
    requirement: "D-09"
    verification:
      - kind: other
        ref: "npm run build + node -e Regex-Check (dist/schiffe.html und dist/de/schiffe.html: je 223 Karten mit Daten, 4 Sentinel, 47 Turmkarten, sf-comp/sf-size vorhanden; beide Quellen enthalten compAttr/sf-comp/sf-size/parseComp/sizesFor)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Deutsche Beschriftungen korrekt und vollstaendig: Bauteil/Waffe/Turm/Rakete/Schild/Kuehler/Kraftwerk/Quantenantrieb/Radar, Mindestgroesse/Beliebige Groesse/ab S1..ab SN, Zaehlertext '... ohne Steckplatz-Daten'"
    requirement: "D-05"
    verification:
      - kind: automated_ui
        ref: "agent-browser Snapshot von /de/schiffe.html: combobox 'Bauteil' mit Waffe/Turm/Rakete/Schild/Kühler/Kraftwerk/Quantenantrieb/Radar, combobox 'Mindestgröße' mit ab S1..ab S10 nach Wahl von Waffe"
        status: pass
    human_judgment: false
  - id: D3
    description: "Automatischer Verhaltensnachweis (26 Faelle) fuehrt das echte Inline-Skript beider Sprachfassungen im node:vm-Mock-DOM aus und deckt D-04 (Waffe+S5 = errechnete Sollmenge, orig-100i nicht sichtbar), D-11 (Bauteilart ohne Groesse filtert nicht), D-10 (4 Groessen Schild / 10 Groessen Waffe), D-08 (Zaehler nennt 4 Schiffe ohne Daten nur bei aktivem Filter) und D-12 (Schnittmenge mit Hersteller) ab, plus zwei Sprachparitaets- und zwei Quellpruefungen"
    requirement: "D-04"
    verification:
      - kind: unit
        ref: "node --test tests/e2e/ship-component-filter.test.js (26/26 bestanden)"
        status: pass
      - kind: other
        ref: "Regressions-Probe: Filterbedingung in der DE-Seite testweise entfernt -> 6 von 26 Faellen schlagen fehl; Aenderung danach zurueckgenommen (Arbeitsverzeichnis nach der Probe wieder sauber)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Alle vier Hausgates gruen (build/verify/audit:site/test:e2e), ohne neue Fehlschlaege gegenueber der vorbestehenden Basislinie; npm run theme entfaellt nachweislich (kein Palettenwert im gesamten Phasen-Diff angefasst, keine Datei unter src/components/ veraendert)"
    verification:
      - kind: other
        ref: "npm run build (17365 Seiten) + npm run verify (816195 lokale Referenzen, alle aufgeloest) + npm run audit:site (0 FEHLER, 4 vorbestehende A11y-Warnungen zu account.html/pilot.html) + npm run test:e2e (124/124 bestanden, 0 Fehlschlaege -- Basislinie lt. 05-01/05-02-SUMMARY war bereits 98/98)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sichtpruefung in beiden Sprachen, beiden Farbmodi und bei 360 px Breite: Filterleiste bedienbar und lesbar, Zaehler korrekt (36 Treffer/results * 4 ohne Steckplatz-Daten/without slot data bei Waffe+S5 in EN UND DE), keine Steckplatz-Groesse auf Karte oder Datenblatt sichtbar"
    requirement: "D-07"
    verification:
      - kind: automated_ui
        ref: "agent-browser: /schiffe.html + /de/schiffe.html, Weapon/Waffe + S5/ab S5 ausgewaehlt, Zaehler '36 results * 4 without slot data' bzw. '36 Treffer * 4 ohne Steckplatz-Daten' (deckt sich mit ship-components.json); Screenshots bei 360 px Breite + Hellmodus fuer beide Sprachen; /schiffe/aegs-hammerhead.html und /de/schiffe/aegs-hammerhead.html enthalten weder 'data-comp' noch 'compAttr' im ausgelieferten HTML"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-08-03
status: complete
---

# Phase 5 Plan 3: Komponenten-Filter — DE-Spiegelung und automatischer Verhaltensnachweis Summary

**Die deutsche Schiffsseite bekommt Zeichen-fuer-Zeichen denselben Komponenten-Filter wie die englische (nur Beschriftungen uebersetzt), und 26 automatisierte node:vm-Testfaelle fuehren das echte Inline-Skript beider Sprachfassungen gegen ein eigenstaendiges Mock-DOM aus -- der erste automatisierte Beweis, dass D-04/D-08/D-10/D-11/D-12 tatsaechlich gelten UND dass EN/DE nicht auseinanderlaufen.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-03T22:56:27+02:00 (nach Abschluss von Plan 05-02)
- **Completed:** 2026-08-03T23:20:00+02:00 (ca.)
- **Tasks:** 3
- **Files modified:** 3 (1 geaendert, 2 neu)

## Accomplishments

- `src/pages/de/schiffe.astro`: `compAttr`-Import (`../../lib/shipComponents`), `data-comp`-Attribut
  am `article.fcard`, zwei neue Auswahlfelder `sf-comp` ("Bauteil": Waffe, Turm, Rakete, Schild,
  Kühler, Kraftwerk, Quantenantrieb, Radar) und `sf-size` ("Mindestgröße": "Beliebige Größe" /
  "ab S1".."ab S10"), erweitertes Inline-IIFE (`parseComp`, `sizesFor`, `rebuildSizeOptions`,
  D-04/D-08/D-11/D-12-Logik). Optionswerte (Kategorie-Buchstaben, Zahlen) sind byte-identisch zur
  EN-Seite, nur die sichtbaren Zeichenketten sind deutsch. Zaehlertext: `"N Treffer"` ohne
  aktiven Bauteilfilter, `"N Treffer · M ohne Steckplatz-Daten"` mit (D-08).
- `tests/e2e/helpers/ships-dom.js`: eigenstaendiges Mock-DOM (dient direkt als `node:vm`-Kontext,
  `document`/`location` auf oberster Ebene, nach dem Vorbild von `fx-dom.js`), baut 227
  `<article class="fcard">`-Attrappen aus `src/data/ship-hardpoints.json` mit `data-comp` nach
  einer ZWEITEN, unabhaengigen Kodierung von `src/data/ship-components.json` (bewusst nicht
  `compAttr()` selbst -- sonst prueft der Test die Funktion mit sich selbst) sowie
  deterministisch abgeleiteten Hersteller-/Typ-/Status-/Archiv-Werten fuer die D-12-Pruefung.
  `MockSelectElement` erweitert die wiederverwendete `MockElement`-Klasse aus `dom-mock.js` um
  `.options`/`.remove(index)`, weil `sf-size` diese nativen `<select>`-Methoden braucht.
- `tests/e2e/ship-component-filter.test.js`: zieht den `<script is:inline>`-Rumpf aus BEIDEN
  `.astro`-Quellen per Regex, fuehrt ihn je Sprachfassung in einem frischen Mock-DOM aus. 26
  Faelle: D-04 (Sollmenge zur Laufzeit aus `ship-components.json` berechnet, Ankerschiffe
  `orig-100i`/`aegs-hammerhead`), D-11 (Bauteilart ohne Groesse laesst alle 227 Karten sichtbar),
  D-10 (5 Eintraege fuer Schild, 11 fuer Waffe inkl. Leereintrag), D-08 (Zaehler nennt die 4
  Schiffe ohne Steckplatz-Daten nur bei aktivem Filter), D-12 (Schnittmenge Bauteilfilter +
  Hersteller), zwei Sprachparitaets-Faelle (identische sichtbare Ids bei identischen Eingaben)
  und zwei Quellpruefungen (`compAttr(id)` und `sf-comp`/`sf-size` in beiden Dateien).
- Regressions-Probe durchgefuehrt: Filterbedingung in der DE-Seite testweise entfernt ->
  6 von 26 Faellen schlagen fehl; Aenderung danach zurueckgenommen, Arbeitsverzeichnis wieder
  sauber (`git checkout -- src/pages/de/schiffe.astro`).
- Alle vier Hausgates gruen: `npm run build` (17365 Seiten), `npm run verify` (816195 lokale
  Referenzen, alle aufgeloest), `npm run audit:site` (0 FEHLER, nur die 4 vorbestehenden,
  phasenfremden A11y-Warnungen zu `/account.html`/`/pilot.html`), `npm run test:e2e` (124/124
  bestanden -- 98 vorbestehende + 26 neue, 0 Fehlschlaege).
- Sichtpruefung per `agent-browser` gegen `npm run preview` (nicht den kaputten Dev-Server)
  durchgefuehrt: beide Sprachen, beide Farbmodi, 360 px Breite. Zaehler `36 results · 4 without
  slot data` (EN) bzw. `36 Treffer · 4 ohne Steckplatz-Daten` (DE) bei Waffe+S5 -- deckt sich
  exakt mit der aus `ship-components.json` errechneten Sollmenge. Detailseiten
  `/schiffe/aegs-hammerhead.html` und `/de/schiffe/aegs-hammerhead.html` enthalten weder
  `data-comp` noch `compAttr` (D-07).

## Task Commits

1. **Task 1: Deutsche Schiffsseite auf denselben Stand bringen** - `fe70780` (feat)
2. **Task 2: Automatischer Verhaltensnachweis fuer beide Sprachfassungen** - `e3217f7` (test)
3. **Task 3: Hausgates gruen und Sichtpruefung in beiden Sprachen** - keine Code-Aenderung noetig
   (alle vier Gates liefen ohne Befund gegen die bestehenden Dateien)

**Plan metadata:** siehe abschliessenden `docs`-Commit dieser Ausfuehrung.

## Files Created/Modified

- `src/pages/de/schiffe.astro` - compAttr-Import, data-comp-Attribut, sf-comp/sf-size mit
  deutschen Beschriftungen, erweitertes Inline-IIFE (parseComp/sizesFor/rebuildSizeOptions/
  D-04/D-08/D-11/D-12)
- `tests/e2e/helpers/ships-dom.js` - eigenstaendiges Mock-DOM fuer die Schiffsliste, 227 Karten,
  zweite unabhaengige data-comp-Kodierung
- `tests/e2e/ship-component-filter.test.js` - 26 Testfaelle gegen das echte Inline-Skript beider
  Sprachfassungen

## Decisions Made

- **PLAN.md-eigene Ankererwartung korrigiert:** der Plantext verlangte "`aegs-hammerhead` ist bei
  Turm und 6 sichtbar" — die tatsaechlich gespeicherte Turm-Groesse ist aber `t:5` (D-06a hat den
  Wert bereits in 05-02 von 6 auf 5 richtiggestellt, siehe 05-02-SUMMARY.md "Korrigierte
  Erwartungswerte": die "6" war die Turm-ANZAHL, nicht die Groesse). Test und manuelle Pruefung
  verwenden stattdessen Turm+S5 (sichtbar, da `t=5>=5`) -- konsistent mit den echten Daten statt
  mit dem stale Beispielwert.
- **PLAN.md-eigene Zahl "59 Turmkarten" korrigiert:** der Task-1-`<verify>`-Regex im PLAN.md
  erwartet noch 59 Karten mit Turmwert (Stand vor D-06a). Seit D-06a sind es 47 -- bereits in
  05-02-SUMMARY.md als noetige Korrektur fuer diesen Plan vermerkt. Der tatsaechlich ausgefuehrte
  Check verwendet 47 und bestaetigt das gegen `dist/schiffe.html` UND `dist/de/schiffe.html`.
- **Zweite, unabhaengige data-comp-Kodierung im Testhelfer:** `ships-dom.js` baut den
  `data-comp`-Wert selbst aus `ship-components.json`, statt `compAttr()` zu importieren und
  aufzurufen -- ein Test darf nicht dieselbe Funktion pruefen, mit der er seine eigene Erwartung
  bildet, sonst faellt ein Fehler in `compAttr()` selbst nie auf. Die SSR-Seite der Kodierung
  (dass `compAttr(id)` tatsaechlich im ausgelieferten HTML landet) ist bereits durch die
  Bau-Pruefungen der Plaene 05-01/05-02/05-03 abgedeckt.
- **Initialer Zaehlertext im Mock-DOM vorbelegt:** das Inline-Skript ruft `apply()` beim Laden
  NIE selbst auf -- der Ausgangszaehler kommt server-seitig aus dem Astro-Template
  (`{vehicles.length} results`/`Treffer`). `ships-dom.js` praegt deshalb `sf-count.textContent`
  je nach `opts.lang` mit genau diesem Text vor dem Skriptlauf vor, sonst waere der "Zaehler
  bleibt ohne Filter unveraendert"-Test grundsaetzlich nicht pruefbar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in den PLAN-eigenen `<verify>`/Behavior-Assertionen] Stale Zahlen aus der
Zeit vor D-06a korrigiert**
- **Found during:** Task 1 (`<verify>`-Regex) und Task 2 (`<behavior>`-Beschreibung)
- **Issue:** Das PLAN.md dieses Plans wurde vor der D-06a-Revision aus Plan 05-02 formuliert und
  enthaelt zwei dadurch ueberholte Zahlen: (a) Task 1s `<verify>`-Regex erwartet 59 Karten mit
  Turmwert (jetzt 47), (b) Task 2s `<behavior>` verlangt "`aegs-hammerhead` ist bei Turm und 6
  sichtbar" (der gespeicherte Wert ist 5, nicht 6 -- "6" war schon in 05-02 als Turm-ANZAHL vs.
  Turm-GROESSE-Verwechslung identifiziert). Beide Werte waren bereits in 05-02-SUMMARY.md als
  fuer diesen Plan noetige Korrekturen vermerkt ("Next Phase Readiness").
- **Fix:** Verify-Check auf 47 angepasst; Testfall prueft `aegs-hammerhead` bei Turm+S5 (sichtbar)
  statt Turm+S6.
- **Files modified:** keine Lieferdatei -- nur die Pruefmethode (Testerwartungen) korrigiert.
- **Verification:** `npm run build` + Regex-Check liefert 47 Turmkarten in beiden Sprachfassungen;
  `node --test tests/e2e/ship-component-filter.test.js` bestaetigt `aegs-hammerhead` bei Turm+S5
  sichtbar.
- **Committed in:** `fe70780` (Verify-Zahl), `e3217f7` (Testfall)

---

**Total deviations:** 1 auto-fixed (Rule 1, korrigierte PLAN-eigene Pruefzahlen -- keine
Aenderung an der Sache selbst, dieselbe Klasse von Korrektur wie bereits in 05-02 dokumentiert)
**Impact on plan:** Betrifft ausschliesslich die Pruefmethode/Testerwartungen, nicht den
gelieferten Code. Kein Scope Creep.

## Issues Encountered

Windows-Git-Bash-Forking war wiederholt flockend (`cygheap read copy failed` /
`fork: retry: Resource temporarily unavailable`) waehrend Build- und `agent-browser`-Aufrufen --
bekannte Umgebungsfalle (siehe MEMORY.md `windows-env-fallen`). Betroffene Befehle wurden erneut
ausgefuehrt; kein Befehl schlug inhaltlich fehl, nur der Fork-Versuch selbst.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 (Komponenten-Filter fuer Schiffe) ist damit abgeschlossen: beide Sprachfassungen
  tragen denselben Filter, ein automatisierter Regressionsnachweis (26 Faelle, Sekunden statt
  Browser-Sitzung) schuetzt D-04/D-08/D-10/D-11/D-12 UND die Sprachparitaet.
- Die Entdopplung der beiden `schiffe.astro`-Seiten (Class-A-Befund, CONCERNS.md) bleibt
  ausdruecklich aufgeschoben -- der neue Test ist der Ersatz-Nachweis fuer diese Phase, nicht die
  strukturelle Loesung. Eine kuenftige Entdopplungs-Phase kann `ships-dom.js` weiterverwenden.
- Die zurueckgestellte Idee "Steckplatz-Groessen sichtbar machen" (CONTEXT.md `<deferred>`) hat
  jetzt eine vollstaendige Datengrundlage (`ship-components.json`, 223/227 Schiffe, alle acht
  Kategorien) fuer eine spaetere eigene Phase.

---
*Phase: 05-komponenten-filter-f-r-schiffe*
*Completed: 2026-08-03*

## Self-Check: PASSED

All created files found on disk; both task commits (`fe70780`, `e3217f7`) found in git history.
