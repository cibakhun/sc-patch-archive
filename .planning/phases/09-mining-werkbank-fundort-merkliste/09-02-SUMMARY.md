---
phase: 09-mining-werkbank-fundort-merkliste
plan: 02
subsystem: ui
tags: [astro, mining-workbench, i18n, node-test]

requires:
  - phase: 09-01
    provides: Reiterleiste, S.locPins, renderLocPins(), Preset-Rundlauf ueber beide Listen, Migrationsdatei (nicht angewandt)
provides:
  - Merklisten-Eintrag traegt System, Chance und Hoechstanteil aus dem Katalog (nicht aus dem gespeicherten Paar)
  - Loesen ueber den x-Knopf in der Merkliste und ueber die Nadel in der Fundort-Zeile schalten nachgewiesen dasselbe Paar
  - Obergrenze 128 Paare mit Meldung ueber die bestehende Zeile #wb-pre-msg statt stillem Abweisen
  - Reiter-Beschriftung "Fundorte" zeigt die Paarzahl, sobald welche da ist
  - Werkzeug-Hilfe (mining.purpose/step2/step4/ctl.presets) beschreibt die Werkbank ohne Physik/Qualitaetsstufen
  - WINDOWS.md-Eintrag id 10 mit der Sichtrunde fuer den Betreiber
affects: []

tech-stack:
  added: []
  patterns:
    - "Nachschlagefunktion (locOf) statt gespeicherter Wert: Anzeigewerte kommen zur Anzeigezeit aus dem ausgelieferten Katalog, der gespeicherte Zustand traegt nur den Schluessel (T-09-06) — Fortsetzung desselben Musters wie locPinValid() aus 09-01"
    - "Eine Formel, zwei Aufrufer: pctRight() wird von renderDetail() UND renderLocPins() genutzt, damit die Fundort-Zeile in der Mitte und die Wertezeile der Merkliste garantiert denselben Text zeigen"

key-files:
  created: []
  modified:
    - assets/mining-workbench.js
    - src/components/MiningWorkbench.astro
    - src/i18n/help.ts
    - tests/e2e/mining-shortlist.test.js
    - tests/e2e/helpers/mining-dom.js
    - .planning/WINDOWS.md
    - .planning/ROADMAP.md

key-decisions:
  - "locPinsFull und die erweiterte presetEmpty-Fassung wurden im Task-1-Commit statt im Task-2-Commit ergaenzt, weil die Grenzpruefung aus Task 1(e) den Text bereits braucht, um ueberhaupt funktionsfaehig zu sein — kein separater Zwischenzustand mit einer werfenden oder leeren Meldung."
  - "tests/e2e/helpers/mining-dom.js war nicht in der Dateiliste des Plans, wurde aber angefasst (Rule 3, blockierend): das Test-Sprachobjekt kannte weder chance/upTo (bereits von 09-01s row2() fuer #wb-locs genutzt, aber nie wortwoertlich geprueft) noch das neue locPinsFull, und die Reiterknoepfe wb-tab-sig/wb-tab-loc fehlten fuer den Zaehler-Testfall."

requirements-completed: [D-04, D-05, D-06, D-07]

coverage:
  - id: D1
    description: "Jeder Merklisten-Eintrag zeigt neben 'Erz — Fundort' eine zweite Zeile mit System, Chance und Hoechstanteil, aus dem Katalog nachgeschlagen (O-3, T-09-06)"
    requirement: "D-04"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Merklisten-Eintrag zeigt System, Chance und Hoechstanteil aus dem Katalog, nicht aus dem gespeicherten Paar (O-3, T-09-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loesen ueber den x-Knopf im Merklisten-Eintrag raeumt auch das is-on der Nadel in der Fundort-Zeile ab; ein Paar eines nicht gewaehlten Erzes bleibt beim Erzwechsel stehen (D-06)"
    requirement: "D-06"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Loesen ueber den x-Knopf in der Merkliste raeumt auch das is-on der Nadel in der Fundort-Zeile ab"
        status: pass
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#ein angeheftetes Paar bleibt in der Merkliste stehen, wenn ein ANDERES Erz gewaehlt wird (D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Obergrenze 128 Paare: ein weiteres Anheften wird abgewiesen und ueber #wb-pre-msg gemeldet, nicht still geschluckt (T-09-07)"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Merkliste bei 128 Paaren voll: ein weiteres Anheften wird abgewiesen und ueber #wb-pre-msg gemeldet (T-09-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reiter-Beschriftung 'Fundorte' nennt die Paarzahl erst, sobald welche da sind"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Reiter-Beschriftung \"Fundorte\" nennt die Zahl der Paare erst, sobald welche da sind"
        status: pass
    human_judgment: false
  - id: D5
    description: "DE und EN vollstaendig, kein Schluessel faellt auf die andere Sprache zurueck — assertMiningLangParity() und assertHelpParity() laufen bei jedem Build"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "npm run build (beide Paritaetspruefungen laufen bei jedem Aufruf der Komponente bzw. beim Modul-Laden von help.ts)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Werkzeug-Hilfe (mining.purpose/step2/step4/ctl.presets) beschreibt die Werkbank wie sie jetzt ist, nicht mehr Physik und Qualitaetsstufen"
    verification:
      - kind: other
        ref: "node scripts/verify-help.mjs --complete (12/12 Werkzeuge, 6/6 Zusicherungen) + Gegenlesen des Texts gegen den heutigen Markup-Aufbau"
        status: pass
    human_judgment: false
  - id: D7
    description: "Gast heftet Fundorte an, Neuladen ueberlebt das im localStorage; benannte Presets bleiben kontogebunden — unveraendert seit 09-01, hier nicht neu gebaut"
    verification: []
    human_judgment: true
    rationale: "Bereits in 09-01 maschinell belegt (locPins im selben localStorage-Objekt wie pins/sel/ref, siehe assets/mining-workbench.js Kopfkommentar). Ein echter Browser-Neuladen-Test ist Teil der Sichtrunde (WINDOWS.md id 10 Punkt 3/4), nicht dieser Plan-Zusicherung."
  - id: D8
    description: "Kein sichtbarer Text nennt die Herkunft der Daten (Data.p4k/DataCore/scmdb/datamined)"
    verification:
      - kind: other
        ref: "npm run audit:site (0 FEHLER, Datenherkunft-Zusicherung eingeschlossen)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Beide Torlaeufe gruen — normal und als Vorschau (STAGING=1), Layout-Aenderung"
    verification:
      - kind: other
        ref: "npm run build && npm run gate (18/18); STAGING=1 npm run build && STAGING=1 npm run gate (18/18)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-15
status: complete
---

# Phase 9 Plan 02: Fundort-Merkliste — Ausbau Summary

**Merklisten-Eintraege tragen jetzt System, Chance und Hoechstanteil aus dem Katalog, loesen sich an beiden Enden, melden sich statt still zu schlucken bei 128 Paaren, und die Werkzeug-Hilfe beschreibt die Werkbank wie sie seit Phase 9 aussieht — beide Torlaeufe gruen, Sichtrunde als WINDOWS.md id 10 an den Betreiber.**

## Performance

- **Duration:** 8 min (erster bis letzter Task-Commit)
- **Started:** 2026-08-15T03:22:00+02:00
- **Completed:** 2026-08-15T03:30:28+02:00
- **Tasks:** 3
- **Files modified:** 7 (5 im Task-1/2-Umfang, 2 in Task 3)

## Accomplishments

- `locOf()` schlaegt Chance/Hoechstanteil eines Fundort-Paares zur Anzeigezeit im ausgelieferten Katalog nach (T-09-06); `pctRight()` ist die EINE Formel, die sowohl die Fundort-Zeile in der Mitte als auch die Wertezeile der Merkliste fuellt — beide zeigen garantiert denselben Text.
- Der `×`-Knopf im Merklisten-Eintrag und die Nadel in der Fundort-Zeile schalten seit 09-01 dasselbe `[data-locpin]`-Attribut; jetzt mit zwei node:test-Faellen nachgewiesen (Loesen raeumt `is-on` ab, ein Paar eines nicht gewaehlten Erzes bleibt beim Erzwechsel stehen).
- Obergrenze `LOCPIN_MAX = 128` (Kommentar nennt die Migrationsdatei namentlich) meldet sich beim Anheften ueber die bestehende Zeile `#wb-pre-msg`, statt das 129. Paar still zu verwerfen.
- Reiter-Beschriftung "Fundorte" zeigt die Paarzahl (Form wie `#wb-loch`), sobald mindestens ein Paar angeheftet ist.
- Werkzeug-Hilfe (`mining.purpose`, `.step2`, `.step4`, `.ctl.presets`) beschrieb noch Physik, Qualitaetsstufen und Steine — Reste aus der Zeit vor Phase 9. Neu formuliert: Fundorte nach Ergiebigkeit, beste Stationen, die Fundort-Nadel und ein Preset ueber beide Listen.
- WINDOWS.md id 10 traegt die sechs Sichtpunkte aus dem Plan; ROADMAP.md Phase 9 zeigt 09-01 abgehakt (09-02 folgt mit diesem Summary).

## Task Commits

1. **Task 1: Die Merkliste zu Ende bauen — Werte, Loesen, Gast, Grenzen** - `1660911` (feat)
2. **Task 2: DE und EN gleichzeitig — Oberflaechentexte und Werkzeug-Hilfe auf den neuen Stand** - `f7aedf1` (docs)
3. **Task 3: Tore, Sichtrunde und Fortschreibung** - `6e5c987` (docs)

_Kein separater `docs:`-Metadaten-Commit fuer dieses Summary — folgt gleich als Teil des finalen Commits dieses Plans._

## Files Created/Modified

- `assets/mining-workbench.js` — `locOf()`, `pctRight()`, `LOCPIN_MAX`, Grenzpruefung im `[data-locpin]`-Klickpfad, Wertezeile + Paarzaehler in `renderLocPins()`
- `src/components/MiningWorkbench.astro` — neuer Sprachschluessel `locPinsFull`, erweiterte `presetEmpty`-Fassung (beide Listen), CSS-Regel `.wb__lmeta`
- `src/i18n/help.ts` — `mining.purpose`, `.step2`, `.step4`, `.ctl.presets` auf den Stand nach der Werkbank (kein Physik-/Qualitaetsstufen-Text mehr), DE und EN im selben Schritt
- `tests/e2e/mining-shortlist.test.js` — 5 neue Testfaelle (Werte je Eintrag, Loesen an beiden Enden, Erzwechsel, 128er-Grenze, Reiterzaehler) + zwei Hilfsfunktionen (`nPctForTest`, `collectRealPairs`)
- `tests/e2e/helpers/mining-dom.js` — fehlende Sprach-Platzhalter (`chance`, `upTo`, `locPinsFull`) und die Reiterknoepfe/-koerper (`wb-tab-sig`, `wb-tab-loc`, `wb-sig-pane`, `wb-loc-pane`) ergaenzt
- `.planning/WINDOWS.md` — Eintrag id 10 (unrun-verify, Phase 09), Zaehler in der Kopfzeile fortgeschrieben
- `.planning/ROADMAP.md` — Phase-9-Abschnitt: 09-01 abgehakt, Plan-Fortschritt ueber `gsd-tools roadmap update-plan-progress 09` nachgezogen (nur dieser Abschnitt beruehrt)

## Decisions Made

- **`locPinsFull`/`presetEmpty` im Task-1-Commit statt im Task-2-Commit**: die Grenzpruefung aus Task 1(e) braucht den Text, um ueberhaupt lauffaehig zu sein — ein Zwischenzustand mit einer werfenden oder leeren Meldung waere kein echter Fortschritt gewesen. Beide Sprachfassungen sind trotzdem vollstaendig und zeitgleich entstanden (kein Sprachrueckfall).
- **`pctRight()` als gemeinsame Formel statt zwei Kopien**: die Fundort-Zeile in der Mitte (`renderDetail()`) und die Wertezeile der Merkliste (`renderLocPins()`) riefen vorher (bzw. haetten sonst) dieselbe Rechnung zweimal getippt — eine gemeinsame Funktion verhindert, dass die beiden Ansichten je auseinanderlaufen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Testbestand (`tests/e2e/helpers/mining-dom.js`) kannte weder `chance`/`upTo` noch `locPinsFull`, keine Reiterknoepfe**
- **Found during:** Task 1, beim Schreiben des ersten neuen Testfalls (Werte je Eintrag)
- **Issue:** Das Sprachobjekt des Mock-DOM (`buildPayload()` in `tests/e2e/helpers/mining-dom.js`, aus 09-01) hatte keine Eintraege fuer `chance`/`upTo` — obwohl `row2()` in `assets/mining-workbench.js` `T.upTo` fuer die Fundort-Zeile in der Mitte (`#wb-locs`) bereits SEIT 09-01 aufruft. Kein bestehender Testfall prueft den rechten Text wortwoertlich, deshalb fiel das nie auf: `T.upTo` war `undefined`, und die Zeile zeigte still "undefined" statt eines Wortes. Zusaetzlich fehlte `locPinsFull` (neuer Schluessel dieses Plans) und die Reiterknoepfe `wb-tab-sig`/`wb-tab-loc` waren nicht registriert, obwohl `renderLocPins()` jetzt `$('wb-tab-loc')` anfasst (guarded, aber ohne Element nicht pruefbar).
- **Fix:** Platzhalter `chance: 'CHANCE'`, `upTo: 'UP-TO'`, `locPinsFull: 'LOC-PINS-FULL'` ergaenzt; `wb-tab-sig`/`wb-tab-loc` (mit initialem `textContent`) und `wb-sig-pane`/`wb-loc-pane` registriert.
- **Files modified:** tests/e2e/helpers/mining-dom.js
- **Verification:** `node --test tests/e2e/mining-shortlist.test.js` — 15/15 gruen, inklusive des neuen Werte- und Reiterzaehler-Testfalls, der ohne den Fix am fehlenden `T.upTo`/`wb-tab-loc` gescheitert waere.
- **Committed in:** 1660911 (Task 1)

---

**Total deviations:** 1 auto-fixed (1 Blocking)
**Impact on plan:** Notwendig, um Task 1(g) (Testfaelle fuer O-3/T-09-07) ueberhaupt lauffaehig zu schreiben; keine Erweiterung des beauftragten Umfangs — die Datei stand nicht in `files_modified`, aber ohne den Fix haette entweder ein stiller Vorher-Fehler (T.upTo) unentdeckt weiterbestanden oder der neue Testfall waere nicht schreibbar gewesen.

## Negativkontrollen (CLAUDE.md, Grundsatz 1 — „vorgefuehrt rot")

Eine Gegenprobe durchgefuehrt, protokolliert und danach zurueckgesetzt (`git diff` leer geprueft):

1. **Grenzpruefung testweise entfernt** (`if (S.locPins.length >= LOCPIN_MAX) { preSay(...); return; }` durch ein bedingungsloses `S.locPins.push(lk);` ersetzt, in `assets/mining-workbench.js`): `node --test tests/e2e/mining-shortlist.test.js` fiel von 15/15 auf **14/15** — genau der Testfall `Merkliste bei 128 Paaren voll: ...` riss mit `AssertionError: Merkliste sollte bei 128 Paaren nicht weiter wachsen` (Ist: 129 statt 128). Zurueckgesetzt, danach wieder 15/15.

## Issues Encountered

- Keine ueber die oben dokumentierte Deviation hinaus. `verify-help.mjs --complete` zaehlt inzwischen 12 statt der im Plan genannten 11 Werkzeuge (Ruestungssets kam nach 01.2 dazu) — kein Fund dieses Plans, nur eine veraltete Zahl im Plantext; die Zusicherung selbst ist unveraendert 6/6 gruen.

## Known Stubs

Keine — alle in diesem Plan gebauten Oberflaechen (Wertezeile, Grenzmeldung, Reiterzaehler) sind an echte Daten bzw. echten Client-Zustand angebunden.

## Threat Flags

Keine neuen ueber das im Plan bereits erfasste `<threat_model>` hinaus. T-09-06 (Werte aus dem Katalog, nicht aus dem gespeicherten Paar) ist mit `locOf()` umgesetzt und in Task 1(g) als eigener Testfall belegt; T-09-07 (Obergrenze mit Meldung) ebenso; T-09-08 (Herkunftsregel in den neuen Texten) ist von `audit:site` als FEHLER-Zusicherung abgedeckt (0 FEHLER).

## User Setup Required

Keins ueber das aus 09-01 bereits bekannte hinaus: die Datenbank-Migration `supabase/migrations/20260815090000_mining_preset_locations.sql` bleibt bewusst NICHT angewandt (Betreiber-Schritt). Die Oberflaeche funktioniert unveraendert ohne sie — ein Preset ohne die Spalte liefert weiterhin eine leere Fundort-Merkliste, keinen Fehler.

## Next Phase Readiness

- Alle maschinellen Tore dieses Plans sind gruen: `node --test tests/e2e/mining-shortlist.test.js` (15/15), `npm run build && npm run gate` (18/18, normal UND mit `STAGING=1`), `node scripts/verify-help.mjs --complete` (12/12 Werkzeuge, 6/6 Zusicherungen), `npm run audit:site` (0 FEHLER), `npm run verify:mining` (37 Minerale, 45 Bodies, 82 Namen ohne Trennzeichen geprueft).
- Phase 9 bleibt **"In Progress"**, nicht "Complete" — die Sichtrunde (WINDOWS.md id 10, sechs Punkte, zwei davon mit angemeldetem Konto und einem VOR dieser Phase gespeicherten Preset) ist an den Betreiber uebergeben, wie in Phasen 1.2/2/3/4 vor dieser.
- `npm run check:staging` wurde in diesem Lauf NICHT ausgefuehrt: der Ausfuehrungsauftrag dieser Sitzung weist den Push auf `staging` ausdruecklich dem Orchestrator zu ("Commit locally; do NOT push to staging"). Die Fertig-Meldung im Sinne von CLAUDE.md ("erst wenn die ausgelieferte Seite den neuen Stand zeigt") steht damit noch aus, bis die Auslieferung erfolgt ist.
- Kein Blocker fuer die Sichtrunde: der Arbeitsbaum ist in einem funktionsfaehigen, durchgehend gruenen Zustand (Build + Gate, auch mit STAGING=1).

---
*Phase: 09-mining-werkbank-fundort-merkliste*
*Completed: 2026-08-15*

## Self-Check: PASSED

Alle acht Artefaktdateien (Client-Skript, Astro-Koerper, Hilfetexte, Testdatei, Test-Helfer, WINDOWS.md, ROADMAP.md, dieses Summary) auf der Platte gefunden; alle drei Task-Commits (`1660911`, `f7aedf1`, `6e5c987`) im Log gefunden.
