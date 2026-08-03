---
phase: 05-komponenten-filter-f-r-schiffe
plan: 01
subsystem: data
tags: [cryxmlb, datacore, p4k, astro, filter-ui, datamine]

requires: []
provides:
  - "scripts/lib/cryxml.mjs — eigener CryXmlB-Binaerformat-Parser (parseCryXml)"
  - "scripts/datamine-ship-components.mjs — Steckplatz-Groessen je Bauteilart aus Data.p4k, 7/8 Kategorien"
  - "src/data/ship-components.json — 223 Schiffe mit Max-Steckplatzgroesse je Kategorie, 4 ohne Daten"
  - "src/lib/shipComponents.ts — compAttr(id) Filter-Kodierung mit Sentinel/Platzhalter-Unterscheidung"
  - "src/pages/schiffe.astro (EN) — sf-comp/sf-size Auswahlfelder, D-04/D-08/D-09/D-11/D-12-Filterlogik"
affects: [05-02-turm-kategorie, 05-03-de-page-und-e2e-tests]

tech-stack:
  added: []
  patterns:
    - "CryXmlB-Reader nach demselben Muster wie p4k.mjs/datacore.mjs: node-nativ statt externer .NET-Tools"
    - "Max-Groesse-je-Kategorie statt volle Portliste im generierten JSON (80x kleiner, reicht fuer D-04 'einer reicht')"
    - "Sentinel vs. Platzhalter im data-*-Attribut: zwei nicht verwechselbare 'leere' Zustaende fuer D-08"

key-files:
  created:
    - scripts/lib/cryxml.mjs
    - scripts/datamine-ship-components.mjs
    - src/lib/shipComponents.ts
    - src/data/ship-components.json
  modified:
    - package.json
    - src/pages/schiffe.astro

key-decisions:
  - "compAttr liefert bei 'Daten, aber keine passende Kategorie' den Platzhalter '_' statt der leeren Zeichenkette, weil Astro leere String-Attributwerte ohne '=' rendert (bares data-comp statt data-comp='') und der automatisierte HTML-Check dadurch scheiterte"
  - "m wird vor w geprueft (MissileLauncher/BombLauncher vor WeaponGun), sonst landen 29 Kombi-Halterungen (MissileLauncher+WeaponGun, BombLauncher+WeaponGun) faelschlich bei den Waffen statt bei den Raketen"
  - "Turret-Platz bleibt in CAT_ORDER und im sf-comp-Auswahlfeld bewusst frei zwischen Weapon und Missile fuer Plan 05-02 (D-06)"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-07, D-08, D-09, D-10, D-11, D-12]

coverage:
  - id: D1
    description: "CryXmlB-Parser liest den Implementierungs-XML-Binaerbaum korrekt, inkl. lowercased Attribut-Keys gegen die minSize/maxSize-Case-Falle"
    requirement: "D-02"
    verification:
      - kind: other
        ref: "node scripts/datamine-ship-components.mjs (Konsolen-Zusammenfassung: 223/227 aufgeloest)"
        status: pass
    human_judgment: false
  - id: D2
    description: "datamine-ship-components.mjs erzeugt src/data/ship-components.json ueber p4k -> DataCore -> XML-Dateiverweis (D-03) -> CryXmlB, mit 223 Schiffen und den 4 erwarteten ATLS-Luecken unter missing"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node -e Assertion aus PLAN.md Task 1 <verify> (ships.length===223, missing.length===4, w.length===164, orig-100i.w===3, argo-atls NICHT unter ships)"
        status: pass
      - kind: other
        ref: "node -e Assertion aus PLAN.md Task 2 <verify> (m=145, s=204, c=218, p=216, q=172, r=220; maxSchild=4; maxRakete=10; orig-100i {m:2,s:1,q:1,p:1,r:1}; kein t-Schluessel)"
        status: pass
    human_judgment: false
  - id: D3
    description: "compAttr(id) unterscheidet 'keine Steckplatz-Daten' (Sentinel -) von 'Daten, aber keine Kategorie' (Platzhalter _) -- Grundlage fuer den D-08-Zaehler"
    requirement: "D-08"
    verification:
      - kind: other
        ref: "dist/schiffe.html Regex-Check: genau 4 Karten data-comp=\"-\", genau 223 Karten mit anderem quotiertem Wert (siehe Deviations)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zwei Auswahlfelder sf-comp/sf-size (nicht acht Einzelfelder), sf-size zeigt nur Groessen 1..Maximum je Kategorie, sf-comp fuehrt 7 Kategorien (Turret-Platz bleibt frei)"
    requirement: "D-09"
    verification:
      - kind: other
        ref: "dist/schiffe.html Regex-Check: genau 2 neue Selects (sf-comp, sf-size), sf-comp hat genau 8 <option>-Eintraege (Leereintrag + 7 Kategorien)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Keine Steckplatz-Groesse ist irgendwo im UI sichtbar -- weder in fcard__chips/stats/prices noch im Datenblatt"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "git diff src/pages/schiffe.astro: keine neuen Zeilen in fcard__chips/fcard__stats/fcard__prices; kein Diff unter src/components/; Palettenblock unveraendert"
        status: pass
    human_judgment: false
  - id: D6
    description: "Filterlogik im Browser: Weapon + S5 and up filtert die Liste, Komponente ohne Groesse filtert noch nicht (D-11), Zaehler nennt Schiffe ohne Steckplatz-Daten (D-08), kombiniert korrekt mit bestehenden Feldern (D-12)"
    verification: []
    human_judgment: true
    rationale: "Plan-Verification Punkt 4 weist den echten Browser-Verhaltensnachweis ausdruecklich Plan 05-03 zu ('dieser Plan sichert Datenstand und SSR-Verdrahtung'). Diese Plan-Ausfuehrung hat die Logik nur ueber statische HTML-Struktur- und Datenpruefungen abgesichert (siehe D2-D5), nicht interaktiv im Browser."

duration: 35min
completed: 2026-08-03
status: complete
---

# Phase 5 Plan 1: Komponenten-Filter — CryXmlB-Kette und Weapon+6-Kategorien Summary

**Eigener CryXmlB-Parser + p4k/DataCore-Datamine-Skript liefert 7 von 8 Bauteilkategorien
(Waffe, Rakete, Schild, Kuehler, Kraftwerk, Quantenantrieb, Radar) als
Steckplatz-Maximalgroessen fuer 223 von 227 Katalog-Schiffen; zwei neue Auswahlfelder
auf der englischen Schiffsseite filtern danach, Turm folgt in Plan 05-02.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-03T18:53:00+02:00 (nach Abschluss der Planungssitzung)
- **Completed:** 2026-08-03T19:28:00+02:00
- **Tasks:** 2
- **Files modified:** 6 (4 neu, 2 geaendert)

## Accomplishments

- `scripts/lib/cryxml.mjs`: node-nativer CryXmlB-Parser (`parseCryXml`), lowercased
  Attribut-Indizierung gegen die gemessene Case-Falle bei `minSize`/`maxSize`.
- `scripts/datamine-ship-components.mjs`: vollstaendige Kette p4k -> `Data/Game2.dcb` ->
  Schiff-Record -> XML-Dateiverweis (D-03, kein Namensraten) -> p4k-Eintrag (Pitfall-1-
  Normalisierung) -> CryXmlB -> Ports -> Kategorie-Maximum. 223/227 Katalog-Schiffe
  loesen sich auf, die 4 ATLS-Exoskelett-Varianten landen bewusst unter `missing` (D-08).
- `catOf()` deckt 7 der 8 Kategorien ab (Waffe, Rakete inkl. Bomben, Schild, Kuehler,
  Kraftwerk, Quantenantrieb, Radar); `m` wird vor `w` geprueft, damit Kombi-Halterungen
  korrekt bei den Raketen landen. Turm bleibt Platzhalter fuer Plan 05-02 (D-06).
- `src/lib/shipComponents.ts`: `compAttr(id)` mit typsicherem JSON-Zugriff (kein `any`),
  liefert Sentinel `-` fuer fehlende Daten und Platzhalter `_` fuer "Daten, aber keine
  Kategorie" -- zwei Zustaende, die im rohen HTML unterscheidbar bleiben muessen (D-08).
- `src/pages/schiffe.astro` (EN): `data-comp`-Attribut je Karte, zwei neue Auswahlfelder
  `sf-comp`/`sf-size` (D-09), `sf-size` zeigt nur zusammenhaengende Groessen 1..Maximum
  (D-10) und ist deaktiviert, bis eine Bauteilart gewaehlt ist (D-11). Die Filterfunktion
  wertet D-04 ("einer reicht") aus, zaehlt Karten ohne Steckplatz-Daten separat (D-08) und
  bleibt mit allen bestehenden Feldern kombinierbar (D-12).

## Task Commits

1. **Task 1: Von der p4k bis zur gefilterten Liste — eine Bauteilart, ein Weg** -
   `c28b139` (feat)
2. **Task 2: Sechs weitere Bauteilarten an die bewiesene Kette haengen** - `fc410e2`
   (feat)

**Plan metadata:** siehe abschliessenden `docs`-Commit dieser Ausfuehrung.

## Files Created/Modified

- `scripts/lib/cryxml.mjs` - CryXmlB-Binaerformat-Parser, `parseCryXml(buf)`
- `scripts/datamine-ship-components.mjs` - Datamine-Skript, erzeugt `ship-components.json`
- `src/lib/shipComponents.ts` - `CAT_ORDER`, `compAttr(id)` fuer die Astro-Seite
- `src/data/ship-components.json` - generiertes, eingechecktes Steckplatz-Snapshot
- `package.json` - neuer Eintrag `datamine:components`
- `src/pages/schiffe.astro` - `data-comp`-Attribut, `sf-comp`/`sf-size`, erweiterte
  Filterlogik im Inline-IIFE

## Decisions Made

- **Platzhalter `_` statt leerer Zeichenkette** fuer "Schiff hat Steckplatz-Daten, aber
  keine passende Kategorie" (siehe Deviations unten — Astro-Rendering-Falle).
- **`m` vor `w` in `catOf()`**: MissileLauncher/BombLauncher-Kombi-Halterungen
  (`Turret+WeaponGun` waere hier nicht das Problem, sondern `MissileLauncher+WeaponGun`
  und `BombLauncher+WeaponGun`, zusammen 29 Ports laut RESEARCH.md) muessen als Rakete
  gezaehlt werden, nicht als Waffe.
- **Turret-Platz bleibt frei** in `CAT_ORDER`, im `sf-comp`-Auswahlfeld und im
  Kommentar der Zuordnungstabelle — Plan 05-02 baut die Regel (D-06), die an
  Stichproben belegt werden muss.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Astro rendert leere String-Attributwerte ohne "=", der geplante
Regex-Check auf `data-comp="[^"]*"` haette dadurch nur 164 statt 223 "reale" Karten
gefunden**
- **Found during:** Task 1, beim Ausfuehren des eigenen `<verify>`-Blocks nach dem ersten
  Build (`mitDaten=165` statt `223`)
- **Issue:** `compAttr()` sollte laut Plan-Text fuer "Daten, aber keine Kategorie" die
  leere Zeichenkette liefern. Astro serialisiert einen leeren String-Attributwert aber
  OHNE `="..."` (bares `data-comp` statt `data-comp=""`) -- exakt dasselbe beobachtbare
  Verhalten zeigt das bereits bestehende `data-archive`-Attribut auf derselben Seite
  (`d.patches.length ? '1' : ''`). Im Browser macht das keinen Unterschied
  (`getAttribute()` liefert in beiden Faellen `""`), aber der PLAN-eigene automatisierte
  `<verify>`-Regex prueft den rohen HTML-Text und haette nur die 164 Karten mit echtem
  Kategorie-Wert plus die 4 Sentinel-Karten gefunden, nicht die 223 gefordert.
- **Fix:** `compAttr()` liefert jetzt bei "Daten, aber keine Kategorie" den Platzhalter
  `_` statt der leeren Zeichenkette. `_` matcht kein Kategorie-Muster (`parseComp('_')`
  liefert weiterhin `{}`), ist aber ein nicht-leerer String, den Astro quotiert rendert.
  Verhalten fuer den Client-Filter bleibt identisch zur leeren Zeichenkette.
- **Files modified:** `src/lib/shipComponents.ts`
- **Verification:** `dist/schiffe.html` zeigt nach dem Fix genau 4 Karten mit
  `data-comp="-"` und genau 223 mit einem anderen quotierten Wert (`npm run build` +
  der im PLAN.md vorgegebene Regex-Check, siehe oben).
- **Committed in:** `c28b139` (Teil des Task-1-Commits)

**2. [Rule 1 - Bug] Eigener JS-Kommentar im Inline-Skript kollidierte mit dem
Plan-eigenen Regex-Check**
- **Found during:** Task 1, zweiter Build-Durchlauf nach Fix 1 (`mitDaten=224` statt
  `223`)
- **Issue:** Ein erklaerender Kommentar im `<script is:inline>` enthielt woertlich
  `data-comp="w3m2s1c1p1q1r1"` als Beispiel. Dieser Text landet unveraendert im
  ausgelieferten HTML (Inline-Skripte werden nicht minifiziert) und wurde vom
  PLAN-eigenen `data-comp="[^"]*"`-Regex als zusaetzliche, 228. Karte mitgezaehlt.
- **Fix:** Kommentar umformuliert, ohne woertliches `data-comp="..."`-Beispiel.
- **Files modified:** `src/pages/schiffe.astro`
- **Verification:** erneuter Build, Regex-Check liefert `real=223, sent=4` exakt.
- **Committed in:** `c28b139` (Teil des Task-1-Commits)

---

**Total deviations:** 2 auto-fixed (beide Rule 1 — Bugs im eigenen Code, keine
Planabweichung in der Sache selbst)
**Impact on plan:** Beide Fixes betreffen nur die HTML-Serialisierung/den Kommentartext,
nicht die Filterlogik oder die Datenkorrektheit. Kein Scope Creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Die Kette p4k -> DataCore -> XML -> CryXmlB -> JSON -> `data-comp` -> Filter steht
  produktionsreif fuer alle sieben nicht-Turm-Kategorien; Plan 05-02 muss nur noch
  `isTurret(port)` ergaenzen (D-06) und den Turm-Buchstaben `t` in `catOf()` VOR den
  Waffen-Check einfuegen.
- **Browser-Verhaltensnachweis steht noch aus** (siehe Coverage D6):
  diese Plan-Ausfuehrung hat die Filterlogik nur ueber statische HTML-/Datenpruefungen
  abgesichert, wie es die Plan-Verification (Punkt 4) vorsieht — der interaktive Nachweis
  im Browser sowie die automatisierten E2E-Tests folgen laut Artefakt-Tabelle in Plan
  05-03 (`tests/e2e/ship-component-filter.test.js`, `tests/e2e/helpers/ships-dom.js`).
- `src/pages/de/schiffe.astro` ist bewusst UNVERAENDERT geblieben (Plan 05-03 dupliziert
  die Aenderung von Hand ins DE-Zwillingspaar, wie es das bestehende Class-A-Muster aus
  CONCERNS.md vorschreibt).
- Alle vier Gates liefen gruen: `npm run build` (17365 Seiten), `npm run verify`
  (816195 lokale Referenzen, alle aufgeloest), `npm run audit:site` (0 FEHLER, 4
  vorbestehende, phasenfremde A11y-Warnungen zu `/account.html`/`/pilot.html`),
  `npm run test:e2e` (98/98 bestanden).

---
*Phase: 05-komponenten-filter-f-r-schiffe*
*Completed: 2026-08-03*

## Self-Check: PASSED

All created files found on disk; both task commits (`c28b139`, `fc410e2`) found in git history.
