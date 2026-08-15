---
phase: 10-mining-presets-bedienbar-machen
plan: 02
subsystem: ui
tags: [astro, vanilla-js, css-grid, mining-workbench, i18n]

requires:
  - phase: 10-mining-presets-bedienbar-machen/10-01
    provides: "sichtbare Preset-Liste (#wb-preset-list), Umbenennen/Loeschen-Rueckfrage/Ueberschreiben/Einzeleintrag-Entfernen, unveraendert wiederverwendet"
provides:
  - "rechte Spalte ohne Reiter: Signaturenliste und Fundort-Merkliste stehen gleichzeitig sichtbar untereinander (.wb__stack/.wb__sec2), je eigene Ueberschrift mit Zaehler (wb-pinsh/wb-lpinsh) (D-03)"
  - "Rastermass 470px 1fr 330px statt 470px 1fr 262px — rechte Spalte +68px zulasten der Mitte, linke Erzliste unangetastet (D-04)"
  - "Scanwert-Eingabefeld, Treffermarkierung (is-hit), scanPlaceholder und Hilfeschluessel mining.ctl.scan/mining.ctl.tabs restlos entfernt; Vielfachen-Anzeige bleibt vollstaendig (D-06, D-07)"
  - "Werkzeug-Hilfe (src/i18n/help.ts) DE+EN auf den Stand der Werkbank ohne Reiter/Scanwert gebracht, inkl. Preset-Handlungstext aus 10-01"
  - "WINDOWS.md Eintrag id 11 (unrun-verify, Phase 10) mit siebenteiliger Sichtrunde an den Betreiber uebergeben"
affects: []

tech-stack:
  added: []
  patterns:
    - "gestapelte Bildlaufkaesten statt Reiter: .wb__stack{flex-direction:column} + .wb__sec2{flex:1 1 0;min-height:0} teilt die Resthoehe der Spalte auf zwei Kaesten"
    - "Zaehler-Ueberschrift 'Beschriftung · Zahl' als Vorbild #wb-loch, jetzt auch an #wb-pinsh/#wb-lpinsh; Zuweisung VOR dem fruehen return in der render-Funktion, sonst friert der Zaehler beim Leeren ein"

key-files:
  created: []
  modified:
    - src/components/MiningWorkbench.astro
    - assets/mining-workbench.js
    - src/i18n/help.ts
    - tests/e2e/helpers/mining-dom.js
    - tests/e2e/mining-shortlist.test.js
    - .planning/WINDOWS.md
    - .planning/ROADMAP.md

key-decisions:
  - "Reiterleiste (wb-tabbar, wb-tab-sig/-loc, wb-sig-pane/-loc-pane) ersatzlos entfernt statt umgebaut — beide Listen werden bei jedem renderAll() ohnehin gezeichnet, der Reiter blendete nur eine aus (T-10-09 im Plan-Threat-Register, Disposition accept)"
  - "Rastermass 470px 1fr 330px wie im Plan vorentschieden (Claude's Discretion aus CONTEXT.md) uebernommen, keine eigene Abweichung"
  - "Vielfachen-Anzeige bleibt ohne jede Trefferberechnung — renderPins() liest ab jetzt gar keine Nutzereingabe mehr; die Werte kommen ausschliesslich aus dem Katalog (T-10-08, Disposition accept)"
  - "mining.ctl.pins wird als Nachschlagewerk-Text umformuliert (Signatur mal Clustergroesse zum Vergleichen mit dem Scanner im Spiel) statt der entfallenen Trefferhervorhebung; mining.ctl.presets nennt jetzt die vier Preset-Handlungen aus 10-01"
  - "scripts/verify-help.mjs bewusst NICHT angefasst — Zusicherung 6 verlangt nur >=1 Anker je Werkzeug, keine feste Zahl; Werkbank behaelt zehn Anker (git diff --stat bestaetigt leer)"

requirements-completed: [D-03, D-04, D-06, D-07]

coverage:
  - id: D1
    description: "Signaturenliste und Fundort-Merkliste stehen beide gleichzeitig sichtbar untereinander, keine traegt hidden, jede mit eigener Ueberschrift samt Zaehler (D-03)"
    requirement: "D-03"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Signaturenliste und Fundort-Merkliste sind nach dem Zeichnen beide vorhanden, keine traegt hidden"
        status: pass
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Ueberschrift der Fundort-Merkliste nennt die Zahl der Paare erst, sobald welche da sind"
        status: pass
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Ueberschrift der Signaturenliste nennt die Zahl der angehefteten Erze erst, sobald welche da sind, und wieder nicht nach dem letzten Loesen"
        status: pass
      - kind: automated_ui
        ref: "node -e Zaehlung gegen dist/topics/mining.html + dist/de/topics/mining.html: wb__stack>=1, wb-pinsh>=1, wb-lpinsh>=1, alte Reiter-/Scan-Kennungen=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rastermass 470px 1fr 330px, rechte Spalte +68px zulasten der Mitte, linke Erzliste unangetastet (D-04)"
    requirement: "D-04"
    verification:
      - kind: automated_ui
        ref: "node -e Zaehlung: '470px 1fr 330px' >=1, '470px 1fr 262px'=0 in beiden gebauten Mining-Seiten"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vielfachen-Anzeige (Signatur x Clustergroesse) bleibt vollstaendig erhalten, ohne Hervorhebungsklasse; Scanwert-Feld, is-hit, scanPlaceholder restlos entfernt (D-06, D-07)"
    requirement: "D-06"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Ein angeheftetes Erz erzeugt so viele Vielfachen-Felder wie seine Seltenheit erlaubt, keines mit Hervorhebungsklasse"
        status: pass
      - kind: automated_ui
        ref: "node -e Zaehlung: wb__scan/wb-scan/is-hit/scanPlaceholder = 0 in beiden gebauten Mining-Seiten"
        status: pass
    human_judgment: false
  - id: D4
    description: "Werkzeug-Hilfe (DE+EN) beschreibt die Werkbank ohne Reiter/Scanwert; Paritaetspruefung haelt weiterhin"
    verification:
      - kind: other
        ref: "node scripts/verify-help.mjs --complete: 12/12 Werkzeuge, alle Zusicherungen erfuellt"
        status: pass
      - kind: other
        ref: "npm run audit:site: 0 FEHLER"
        status: pass
      - kind: other
        ref: "Gegenprobe: mining.ctl.station testweise nur aus EN entfernt -> npm run build bricht mit assertHelpParity-Meldung ab; nach Ruecksetzen wieder gruen"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sichttauglichkeit der neuen rechten Spalte (Breiten, gestapelte Listen, Preset-Zeile bei 330px) im echten Browser, DE+EN, beide Farbmodi, zwei Aufloesungen"
    verification: []
    human_judgment: true
    rationale: "Optik und Treffbarkeit entscheidet kein Skript; Sichtrunde als WINDOWS.md-Eintrag id 11 (sieben Punkte) an den Betreiber uebergeben, Phase bleibt bis dahin In Progress."

duration: 35min
completed: 2026-08-15
status: complete
---

# Phase 10 Plan 02: Rechte Spalte neu — Reiter weg, Scanwert weg Summary

**Signaturenliste und Fundort-Merkliste stehen jetzt gestapelt und gleichzeitig sichtbar in einer 330px statt 262px breiten rechten Spalte; das Scanwert-Eingabefeld samt Treffermarkierung ist restlos entfernt, die Vielfachen-Anzeige bleibt als reines Nachschlagewerk.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-15T03:55:16Z (nach Abschluss von 10-01)
- **Completed:** 2026-08-15T04:26:04Z (letzter Task-Commit)
- **Tasks:** 3
- **Files modified:** 7 (`src/components/MiningWorkbench.astro`, `assets/mining-workbench.js`, `src/i18n/help.ts`, `tests/e2e/helpers/mining-dom.js`, `tests/e2e/mining-shortlist.test.js`, `.planning/WINDOWS.md`, `.planning/ROADMAP.md`)

## Accomplishments

- Die Reiterleiste (`#wb-tabbar`, `#wb-tab-sig`/`#wb-tab-loc`, `#wb-sig-pane`/`#wb-loc-pane`) ist aus beiden gebauten Mining-Seiten verschwunden. An ihrer Stelle steht `div.wb__stack` mit zwei gleich gebauten `div.wb__sec2`-Bloecken: Signaturenliste (`#wb-pinsh`/`#wb-pins`) und Fundort-Merkliste (`#wb-lpinsh`/`#wb-locpins`), beide gleichzeitig sichtbar, jede mit eigenem Bildlauf. `flex:1 1 0` + `min-height:0` an `.wb__sec2` teilen die Resthoehe der Spalte fair auf beide Kaesten auf.
- Das Rastermass ist `470px 1fr 330px` statt `470px 1fr 262px` — die rechte Spalte legt 68 px zu, die kommen aus der mittleren Spalte (`1fr`), die linke Erzliste (470 px, seit 12.08. bewusst breit) ist unangetastet.
- Das Scanwert-Eingabefeld (`#wb-scan`), seine Treffermarkierung (`is-hit`), der Sprachschluessel `scanPlaceholder` (DE+EN) und die beiden Hilfeschluessel `mining.ctl.scan`/`mining.ctl.tabs` (je DE+EN) sind restlos entfernt — Markup, Stil, Client-Skript, Sprachobjekt, Hilfetext, Mock-DOM. Die Vielfachen-Anzeige (Signatur × 1…max je Seltenheit) bleibt vollstaendig erhalten, nur ohne Hervorhebungsklasse.
- Zaehler in den neuen Ueberschriften: `renderPins()` schreibt `Signaturen · N` in `#wb-pinsh`, `renderLocPins()` schreibt `Fundorte · N` in `#wb-lpinsh` (vorher in der Reiterbeschriftung) — beide nach demselben Muster wie die bestehende `#wb-loch`-Ueberschrift in Spalte 2, beide VOR dem fruehen Ausstieg bei leerer Liste gesetzt (sonst friert der Zaehler beim Leeren ein).
- Die Werkzeug-Hilfe (`src/i18n/help.ts`) beschreibt jetzt die Werkbank ohne Reiter und ohne Scanwert: Schritt 4 nennt Anheft-Knopf und Nadel als Weg in zwei gleichzeitig sichtbare Listen, `mining.ctl.pins` wird zum Nachschlagewerk-Text, `mining.ctl.presets` nennt die vier Preset-Handlungen aus 10-01 (auswaehlen, umbenennen, ueberschreiben, Eintrag entfernen) samt Rueckfrage vor dem Loeschen, `mining.ctl.locpin` beschreibt die Merkliste "darunter" statt "im zweiten Reiter".
- Testsuite von 33 auf 36 Faelle gewachsen (drei neue: beide Listen ohne `hidden`, Signaturen-Zaehler mit Rundlauf, Vielfachen-Zahl ohne Hervorhebung), alle einmal rot vorgefuehrt (siehe unten). Volle e2e-Suite: 270/270 (267 vor der Phase).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rechte Spalte neu — beide Listen gleichzeitig, breiter, Scanwert restlos abgetragen** - `0d6a4b2` (feat)
2. **Task 2: DE und EN gleichzeitig — Werkzeug-Hilfe auf den Stand der neuen Werkbank** - `40a5b47` (docs)
3. **Task 3: Tore, Sichtrunde und Fortschreibung** - `90e4d90` (chore)

## Files Created/Modified

- `src/components/MiningWorkbench.astro` — Reiterleiste entfernt, `.wb__stack`/`.wb__sec2` mit zwei Ueberschriften-Kaesten neu, Rastermass auf `470px 1fr 330px`, Scanwert-Kasten samt Stilregeln entfernt, `is-hit`-Regel und `.wb__scan:focus-visible` entfernt, `scanPlaceholder` aus `S_DE`/`S_EN`
- `assets/mining-workbench.js` — `renderPins()` liest keinen Scanwert mehr und schreibt den Zaehler in `#wb-pinsh`; `renderLocPins()` schreibt den Zaehler in `#wb-lpinsh` statt in die Reiterbeschriftung; `[data-tab]`-Zweig im Klick-Handler und der `wb-scan`-Zweig im Input-Handler entfernt
- `src/i18n/help.ts` — `mining.ctl.scan`/`mining.ctl.tabs` (DE+EN) entfernt, `mining.step4`/`mining.ctl.pins`/`mining.ctl.presets`/`mining.ctl.locpin` (DE+EN) neu formuliert
- `tests/e2e/helpers/mining-dom.js` — Mock-DOM-Registrierung von `wb-scan`/`wb-tab-sig`/`wb-tab-loc`/`wb-sig-pane`/`wb-loc-pane` auf `wb-pinsh`/`wb-lpinsh` umgestellt
- `tests/e2e/mining-shortlist.test.js` — bestehender Reiter-Zaehler-Testfall auf `#wb-lpinsh` umgeschrieben (Anforderung woertlich gleich), drei neue Testfaelle
- `.planning/WINDOWS.md` — neuer Eintrag id 11 (`kind: unrun-verify`, Phase 10, `status: open`), Datei von CRLF auf LF normalisiert
- `.planning/ROADMAP.md` — Abschnitt „Phase 10": 10-02 abgehakt, „2/2 plans executed", tatsaechliches Ergebnis ergaenzt

## Decisions Made

- Reiterleiste ersatzlos entfernt statt umgebaut — beide Listen wurden auch bisher bei jedem `renderAll()` gezeichnet, der Reiter blendete nur eine aus; kein zusaetzlicher Zeichenaufwand durch das Stapeln (T-10-09).
- Rastermass `470px 1fr 330px` wie im Plan vorentschieden uebernommen (Claude's Discretion aus CONTEXT.md), keine eigene Abweichung noetig.
- `mining.ctl.pins` als Nachschlagewerk-Text umformuliert statt der entfallenen Trefferhervorhebung; `mining.ctl.presets` nennt jetzt die vier Preset-Handlungen aus 10-01.
- `scripts/verify-help.mjs` bewusst nicht angefasst (Begruendung im Plan, § „Vorab entschieden" (d)) — bestaetigt durch leeren `git diff --stat scripts/verify-help.mjs`.

## Vorgefuehrt rot (CLAUDE.md Grundsatz 1)

**Task 1** — Produktivcode (`assets/mining-workbench.js`) auf den Vor-Plan-Stand zurueckgesetzt (`git checkout -- assets/mining-workbench.js`), waehrend Markup, Mock-DOM und Testdatei bereits auf dem neuen Stand standen: `node --test tests/e2e/mining-shortlist.test.js` → **36 Faelle, 0 bestanden, 36 fehlgeschlagen** (`Cannot read properties of null (reading 'value')` in `renderPins()`, weil `#wb-scan` im Mock-DOM nicht mehr existiert). Nach Wiederherstellen des neuen Produktivcodes: **36/36 gruen.**

**Task 2** — `mining.ctl.station` testweise nur aus dem englischen Objekt in `src/i18n/help.ts` entfernt: `npm run build` bricht ab mit `assertHelpParity: Schluesselmengen von DE und EN weichen ab. Fehlt in EN: mining.ctl.station; fehlt in DE: —`. Nach Wiederherstellen des Schluessels: `npm run build` wieder gruen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Testselektor `.wb__mult i` traf im Mock-DOM nichts (Nachfahren-Kombinator nicht unterstuetzt)**
- **Found during:** Task 1, beim ersten GREEN-Lauf des neuen Vielfachen-Testfalls
- **Issue:** Der Selektor-Parser in `tests/e2e/helpers/dom-mock.js` (`matches()`) kennt nur einfache Compound-Selektoren (`tag`/`#id`/`.klasse`/`[attr=wert]`), keine Nachfahren-Kombination mit Leerzeichen. `item.querySelectorAll('.wb__mult i')` lieferte deshalb 0 Treffer statt 4, obwohl das erzeugte Markup korrekt war (per Debug-Skript gegen den echten `renderPins()`-Output verifiziert).
- **Fix:** Testfall auf `item.querySelectorAll('i')` umgestellt (Tag-Selektor allein wird unterstuetzt und reicht hier, weil im Pin-Eintrag ausschliesslich die Vielfachen-Felder `<i>`-Tags sind).
- **Files modified:** `tests/e2e/mining-shortlist.test.js`
- **Verification:** Testfall wechselte von rot (`0 !== 4`) zu gruen.
- **Committed in:** `0d6a4b2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Testinfrastruktur-Grenze eines geteilten Mock-Selektor-Parsers, kein Fund im Produktivcode)
**Impact on plan:** Keine Abweichung von der geplanten Bedienlogik. Kein Scope Creep.

## Issues Encountered

**`.planning/WINDOWS.md` trug CRLF-Zeilenenden** (einziges Planungsdokument mit dieser Abweichung; STATE.md/ROADMAP.md sind LF). Der `gsd-tools windows append`-Befehl scheiterte deshalb zunaechst am Parsen der letzten Frontmatter-Zeile (`last_updated: ...\r`). Behoben durch einmaliges Normalisieren der Datei auf LF vor dem Anhaengen (Windows-Env-Falle, bereits in MEMORY.md dokumentiert). Kein Inhalt geaendert, nur Zeilenenden.

## User Setup Required

None — keine externe Dienstkonfiguration erforderlich. Diese Phase aendert Markup, Stil, Client-Logik und Texte, keine Migration.

## Machine Verification

**Normaler Build (`npm run build && npm run gate`):**

```
=== Bilanz Schiene A ===
  ✓ verify:wiring             0.1s
  ✓ verify:metrics            0.4s
  ✓ pretest:e2e               0.1s
  ✓ test:e2e                  8.8s
  ✓ verify                   13.3s
  ✓ verify:vendor             0.1s
  ✓ audit:csp                10.6s
  ✓ verify:crafting           1.0s
  ✓ verify:typo              11.0s
  ✓ verify:layers            10.9s
  ✓ verify:sync              11.7s
  ✓ verify:theme              1.3s
  ✓ verify:vehicle-roles      0.1s
  ✓ verify:weapons            0.1s
  ✓ verify:help              10.4s
  ✓ verify:fx                10.3s
  ✓ audit:site               63.4s
  ✓ verify:mining             0.1s

  18 von 18 Schritten gruen · Gesamtzeit 153.7s

✓ Tor GRUEN — Schiene A vollstaendig bestanden.
```

**Vorschau-Build (`STAGING=1 npm run build && STAGING=1 npm run gate`)** — Kopfzeile bestaetigt `build.json: dev (Vorschau)`:

```
  18 von 18 Schritten gruen · Gesamtzeit 178.9s

✓ Tor GRUEN — Schiene A vollstaendig bestanden.
```

**Zusatzlaeufe:**
- `node scripts/verify-help.mjs --complete`: 12/12 Werkzeuge abgedeckt, alle 6 Zusicherungen erfuellt (0 Werkzeuge ohne eigenen Anker, 0 leere Werte).
- `npm run audit:site`: 0 FEHLER, 4 vorbestehende A11y-Warnungen (kein Bezug zu dieser Phase).
- `npm run verify:mining`: „OK — Mining-Daten konsistent: 38 Elemente, 211 Komp., 14 Laser, 37 Minerale, 45 Bodies, 82 Namen ohne '|' geprueft".
- `node --test tests/e2e/mining-shortlist.test.js`: **36/36 gruen** (33 vor diesem Plan, +3 neue Faelle).
- `node --test tests/e2e/*.test.js`: **270/270 gruen** (267 vor diesem Plan, keine Regression in anderen Werkzeugen).
- `grep -n "wb-pinsh\|wb-lpinsh" assets/mobile-ux.css`: kein Treffer; `grep -n "wb__scroll" assets/mobile-ux.css`: weiterhin Treffer — die Bildlauf-Registrierung bleibt klassenbasiert, kein neuer Eintrag noetig.
- `git diff --stat scripts/verify-help.mjs`: leer.

## `npm run check:staging` — NICHT ausgefuehrt

Dieser Schritt aus Task 3 (e) verlangt, dass die ausgelieferte Seite auf `staging.verse-base.com` den neuen Stand zeigt — das setzt einen Push auf den Zweig `staging` und einen echten Coolify-Deploy voraus. Der Executor laeuft in einem isolierten Arbeitsbaum auf dem Zweig `claude/gsd-plan-phase-10-a60115` ohne Anweisung oder Befugnis, auf `staging`/`main` zu pushen oder einen Deploy auszuloesen — das ist eine Infrastruktur-/Betreiber-Handlung, keine Ausfuehrung eines Plans im Arbeitsbaum. Alle maschinellen Vorlaeufe (Build, Gate, beide Male mit `STAGING=1`) sind lokal gruen; der tatsaechliche Deploy und die Sichtrunde bleiben dem Betreiber ueberlassen, wie im WINDOWS.md-Eintrag id 11 benannt.

## Next Phase Readiness

- Phase 10 ist inhaltlich fertig (beide Plaene ausgefuehrt, alle Hausgates gruen), bleibt aber „In Progress", bis die Sichtrunde (WINDOWS.md id 11) und der Deploy auf staging abgenommen sind — Praezedenzfall Phasen 1.2/2/3/4/9.
- Phase 11 (Geteilte Routen mit Spielerbewertung) haengt von Phase 10 ab und ist noch nicht geplant; die `assumption_delta_decision` aus 10-01 (Primaerschluessel bleibt `(user_id, name)`) bleibt die Uebergabenotiz.
- Kein Blocker im Code. Der einzige offene Punkt ist die menschliche Sichtrunde plus der Live-Deploy auf staging.

---
*Phase: 10-mining-presets-bedienbar-machen*
*Completed: 2026-08-15*

## Self-Check: PASSED

- FOUND: `.planning/phases/10-mining-presets-bedienbar-machen/10-02-SUMMARY.md`
- FOUND: `0d6a4b2` (Task 1 commit)
- FOUND: `40a5b47` (Task 2 commit)
- FOUND: `90e4d90` (Task 3 commit)
