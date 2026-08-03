---
phase: 05-komponenten-filter-f-r-schiffe
plan: 02
subsystem: data
tags: [cryxmlb, datacore, p4k, astro, filter-ui, datamine, turret-rule]

requires:
  - phase: 05-komponenten-filter-f-r-schiffe (Plan 01)
    provides: "CryXmlB-Kette, catOf() mit sieben Kategorien, sf-comp/sf-size-Auswahlfelder, compAttr()-Kodierung"
provides:
  - "isTurret(port) in scripts/datamine-ship-components.mjs — D-06a: NUR TurretBase (ohne Container), keine Namenserkennung"
  - "--audit-Modus mit 15-Stichproben-Vergleich + 3 Summenzeilen gegen src/data/vehicles.json (turrets[].stations)"
  - "src/data/ship-components.json neu erzeugt: 47 Schiffe tragen jetzt das Kuerzel t (unveraendert: 162 w, 145 m, 204 s, 218 c, 216 p, 172 q, 220 r)"
  - "src/pages/schiffe.astro (EN): achter Eintrag Turret in sf-comp, zwischen Weapon und Missile"
affects: [05-03-de-page-und-e2e-tests]

tech-stack:
  added: []
  patterns:
    - "TurretBase als direkt aus den Spieldaten gelesener Type-Wert (wie Shield/Cooler) statt einer Namenserkennung auf dem Portnamen -- D-06a verbietet geratene Zuordnungen im Auslieferungsstand"
    - "--audit-Modus als Nachweismodus gegen eine unabhaengige Drittquelle (vehicles.json), der NIE die Datenquelle des Filters selbst ist"

key-files:
  created: []
  modified:
    - scripts/datamine-ship-components.mjs
    - src/data/ship-components.json
    - src/pages/schiffe.astro

key-decisions:
  - "D-06 -> D-06a: der Nutzer hat die geratene Fernturm-Namenserkennung (`Turret` ohne `WeaponGun` + Portname passt auf `/remote/i` ohne `/tractor/i`) NACH dem ersten Checkpoint dieses Plans ERSATZLOS gestrichen. Grund: `TurretBase` ist ein direkt aus den Spieldaten gelesener Type-Wert, die Namenserkennung war geraten und geratene Zuordnungen sollen nicht im Auslieferungsstand stehen -- auch wenn sie in der 15er-Stichprobe 14/15 Treffer erzielte."
  - "Bewusst in Kauf genommener Preis von D-06a: Carrack, Redeemer und Polaris verlieren ihre ferngesteuerten Turm-Ports in dieser Kategorie, weil diese im Spiel NUR `Turret` tragen, nie `TurretBase`. Kein Ersatz gebaut."
  - "`t` speichert -- wie alle sieben anderen Kategorie-Kuerzel -- die MAXIMALE Steckplatzgroesse, NICHT die Anzahl der Tuerme. Diese Unterscheidung wurde im ersten Checkpoint dieses Plans explizit herausgearbeitet und haelt hier fest, damit sie nicht wieder verwechselt wird (siehe Abschnitt 'Korrigierte Erwartungswerte' unten)."

requirements-completed: [D-05, D-06, D-08]

coverage:
  - id: D1
    description: "isTurret() setzt D-06a um (TurretBase ohne Container); --audit-Modus stellt die Regel gegen vehicles.json turrets[].stations, 15-Stichproben-Vergleich plus 3 Summenzeilen; der PDC-Blinde-Fleck bei Kapitalschiffen steht als Quellkommentar"
    requirement: "D-06"
    verification:
      - kind: other
        ref: "node scripts/datamine-ship-components.mjs --audit (siehe 'Gemessene Zahlen' unten)"
        status: pass
    human_judgment: true
    rationale: "D-06 verlangt ausdruecklich Beleg statt Behauptung durch einen Menschen; der Nutzer hat den ersten Regelentwurf im Checkpoint dieses Plans gepr��ft und daraufhin die Regel selbst verschaerft (D-06a) -- die menschliche Pruefung ist bereits erfolgt und hat die Regel veraendert, nicht nur bestaetigt."
  - id: D2
    description: "src/data/ship-components.json neu erzeugt mit dem Kuerzel t nach D-06a: 47 Schiffe, groesster Wert 10, alle sieben anderen Kategorien unveraendert"
    requirement: "D-06"
    verification:
      - kind: other
        ref: "node -e Assertion (angepasste Erwartungswerte, siehe Deviations): t.length===47, orig-100i/aegs-gladius/tmbl-cyclone ohne t, anvl-carrack.t===5, max(t)===10"
        status: pass
    human_judgment: false
  - id: D3
    description: "Turret als achte Bauteilart in sf-comp (EN) zwischen Weapon und Missile, D-07 (keine Groessenanzeige) unangetastet, Gegenmassnahmen kommt nicht vor"
    requirement: "D-05"
    verification:
      - kind: other
        ref: "npm run build + node -e Regex-Check gegen dist/schiffe.html: 9 Eintraege in sf-comp, Reihenfolge w,t,m,s,c,p,q,r, 47 Karten mit Turmwert, kein Gegenmassnahmen-Eintrag"
        status: pass
    human_judgment: false
  - id: D4
    description: "Alle vier Hausgates (build/verify/audit:site/test:e2e) laufen gruen nach der Turm-Freischaltung"
    verification:
      - kind: other
        ref: "npm run build (17365 Seiten), npm run verify (816195 lokale Referenzen), npm run audit:site (0 FEHLER, 4 vorbestehende A11y-Warnungen), npm run test:e2e (98/98)"
        status: pass
    human_judgment: false

duration: ~55min (aktive Ausfuehrung, exkl. Wartezeit auf Checkpoint-Antwort des Nutzers)
completed: 2026-08-03
status: complete
---

# Phase 5 Plan 2: Komponenten-Filter — Turm-Kategorie (D-06a) Summary

**Turm-Regel auf reine Spieldaten-Ablesung zurueckgeschnitten (nur `TurretBase` ohne `Container`, keine Namenserkennung auf Portnamen) -- 47 von 223 Schiffen tragen jetzt das Kuerzel `t`, Turret ist die achte waehlbare Bauteilart auf der englischen Schiffsseite.**

## Performance

- **Duration:** ~55 min aktive Ausfuehrung
- **Started:** 2026-08-03T19:35:00+02:00 (nach Abschluss von Plan 05-01)
- **Completed:** 2026-08-03T22:52:00+02:00
- **Tasks:** 3 (inkl. eines blockierenden Checkpoints, der zu einer Regelaenderung fuehrte)
- **Files modified:** 3 (2 geaendert, 1 generiert)

## Accomplishments

- `isTurret(port)` in `scripts/datamine-ship-components.mjs`: erst als D-06-Regel mit
  Namenserkennung implementiert und im blockierenden Checkpoint gegen die 15
  Stichprobenschiffe aus RESEARCH.md gegengeprueft (14/15 Treffer, einziger
  Fehltreffer `rsi-polaris` wie recherchiert). Auf Anweisung des Nutzers danach zu
  **D-06a** verschaerft: nur noch `TurretBase` ohne `Container`, die geratene
  `remote`/`tractor`-Namenserkennung ist ersatzlos gestrichen.
- `--audit`-Modus erweitert: druckt die 15-Stichprobenzeilen (Id, Drittquelle aus
  `vehicles.json` `turrets[].stations`, Regel-Ergebnis, Trefferzeichen) plus drei
  Summenzeilen (exakte Turmzahl, binaere "hat ueberhaupt einen Turm"-Frage, Zahl der
  Schiffe mit mindestens einem Turmsteckplatz) -- schreibt dabei nie eine Datei.
- `src/data/ship-components.json` neu erzeugt: **47 von 223 Schiffen** tragen jetzt
  `t` (max. Steckplatzgroesse, groesster Wert **10**); alle sieben uebrigen
  Kategorien (`w`,`m`,`s`,`c`,`p`,`q`,`r`) unveraendert.
- `src/pages/schiffe.astro` (EN): achter Eintrag `<option value="t">Turret</option>`
  im Auswahlfeld `sf-comp`, zwischen Weapon und Missile -- Reihenfolge deckt sich mit
  `CAT_ORDER` (`wtmscpqr`). Am Inline-IIFE war nichts zu aendern (Groessenliste
  entsteht zur Laufzeit aus den gespeicherten Werten).
- Bekannter Blinder Fleck bei Kapitalschiff-PDC-Batterien (Polaris, Idris, Javelin,
  Reclaimer) bleibt als Quellkommentar in `isTurret()`s Nachbarschaft dokumentiert,
  ergaenzt um den zweiten, durch D-06a neu hinzugekommenen Abschlag bei
  ferngesteuerten Tuermen (Carrack, Redeemer, Polaris).

## Task Commits

1. **Task 1: Turm-Regel einbauen und gegen eine Drittquelle nachweisen** -
   `34df37f` (feat) -- urspruengliche D-06-Regel mit Namenserkennung, im
   Checkpoint gegen die 15 Stichprobenschiffe bestaetigt (14/15 Treffer)
2. **Task 2 (Checkpoint-Antwort, Regelaenderung D-06a):** `8378e9e` (fix) --
   `isTurret()` auf reine `TurretBase`-Ablesung zurueckgeschnitten, JSON neu
   erzeugt (59 -> 47 Schiffe mit `t`)
3. **Task 3: Turm als achte Bauteilart freischalten** - `89d11ea` (feat)

**Plan metadata:** siehe abschliessenden `docs`-Commit dieser Ausfuehrung.

## Files Created/Modified

- `scripts/datamine-ship-components.mjs` - `isTurret(port)`, erweiterter `--audit`-Modus, `catOf()` prueft Turm zuerst
- `src/data/ship-components.json` - neu erzeugtes, eingechecktes Steckplatz-Snapshot (47 Schiffe mit `t`)
- `src/pages/schiffe.astro` - achter Eintrag `Turret` in `sf-comp`

## Decisions Made

- **D-06 -> D-06a (Regelverschaerfung nach dem Checkpoint):** Der Nutzer hat die
  geratene Fernturm-Namenserkennung ersatzlos gestrichen, weil `TurretBase` ein
  direkt aus den Spieldaten gelesener Type-Wert ist (wie `Shield`/`Cooler`),
  waehrend die Namenserkennung (`/remote/i` ohne `/tractor/i` auf dem Portnamen)
  eine Vermutung war -- auch wenn sie in der Stichprobe 14/15 traf. Bewusst in
  Kauf genommener Preis: Carrack, Redeemer und Polaris verlieren ihre
  ferngesteuerten Turm-Ports in dieser Kategorie; kein Ersatz gebaut, kein
  Sonderfall fuer diese drei Schiffe.
- **`t` speichert die maximale Steckplatzgroesse, nicht die Turmanzahl** -- wie
  alle sieben anderen Kategorie-Kuerzel. Diese Unterscheidung wurde im ersten
  Checkpoint dieses Plans explizit herausgearbeitet (siehe "Korrigierte
  Erwartungswerte" unten) und ist hier festgehalten, damit sie nicht wieder mit
  der Turm-ANZAHL verwechselt wird, die nur der `--audit`-Modus im Speicher
  mitzaehlt und ausdruckt, aber nicht im JSON ablegt.

## Korrigierte Erwartungswerte (Task 1 + Task 3 `<verify>`)

Die im PLAN.md eingebetteten automatisierten `<verify>`-Befehle basieren auf der
urspruenglichen D-06-Regel (59 Schiffe mit `t`) und sind durch D-06a ueberholt.
Zwei konkrete Anpassungen:

1. **Task 1 `<verify>`:** die Assertion `d.ships["aegs-hammerhead"].t !== 6` war
   bereits vor der D-06a-Aenderung fehlerhaft -- sie verwechselte die (korrekte)
   Turm-ANZAHL der Hammerhead (6 Türme laut `vehicles.json` UND laut Regel-Zaehlung
   im `--audit`-Modus) mit dem im JSON gespeicherten `t`-Feld, das die maximale
   Steckplatz-GROESSE traegt (`5`, da alle sechs Hammerhead-Turmports Groesse 5
   sind). Die illustrative Beispiel-JSON aus RESEARCH.md ("aegs-hammerhead":
   {"t": 6, ...}) war der wahrscheinliche Ursprung dieser Verwechslung -- sie war
   nie an echten Daten gemessen. Ich habe stattdessen gegen die tatsaechlichen
   Design-Invarianten geprueft (Anwesenheit/Abwesenheit von `t`, Container-
   Ausschluss bei `tmbl-cyclone`, `anvl-carrack` traegt `t`, Maximalwert `10`) --
   alle bestehen.
2. **Alle Zahlen, die von "59 Schiffe mit Turm" ausgehen, sind jetzt "47":** nach
   D-06a wurde neu **gemessen** (nicht geschaetzt): `Object.keys(d.ships).filter(id
   => d.ships[id].t != null).length === 47`, groesster gespeicherter Wert weiterhin
   `10`. Task 3s automatisierter Karten-Zaehl-Check wurde entsprechend auf `47`
   angepasst (statt der im Plan stehenden `59`).

**Direkte Datenpruefung von `anvl-carrack` (auf ausdruecklichen Wunsch):** die
Koordinator-Nachricht erwartete, Carrack wuerde nach D-06a KEIN `t` mehr tragen
(unter der Annahme, seine Tuerme seien ausschliesslich ferngesteuert). Direkte
CryXmlB-Inspektion der `ANVL_Carrack.xml` zeigt das Gegenteil: Carrack hat DREI
eigene `TurretBase`-Ports (`hardpoint_turret_back_rear`, `_left`, `_right`, alle
Groesse 5) PLUS einen separaten ferngesteuerten `Turret`-only-Port
(`hardpoint_turret_remote_turret`, ebenfalls Groesse 5). D-06a zaehlt deshalb
weiterhin `t:5` fuer Carrack -- nur die Regel-ANZAHL sinkt von 4 auf 3 (der
ferngesteuerte Port faellt weg), nicht der `t`-Wert selbst. Ich habe das NICHT
auf `null` erzwungen, weil das exakt die Art von unbelegter Sonderbehandlung
waere, die D-06a ausdruecklich verbietet -- die RESEARCH.md-Aussage "Carrack
traegt kein TurretBase" war eine Vereinfachung, keine vollstaendige Beschreibung.
Redeemer (2 bemannte `TurretBase`-Ports, `t:4`) und Polaris (5 bemannte
`TurretBase`-Ports, `t:5`, deckt sich exakt mit `vehicles.json`s eigener
"Bemannte Tuerme"-Aufschluesselung von 5 Stationen) verhalten sich analog.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 - Architektur-/Regelaenderung, vom Nutzer selbst angewiesen] D-06 -> D-06a**
- **Found during:** Task 2 (blockierender Checkpoint)
- **Issue:** die urspruengliche D-06-Regel (14/15 Stichproben-Treffer) enthielt
  einen Namenserkennungs-Zusatz (`remote`/`tractor`), den der Nutzer als "geraten"
  ablehnte
- **Fix:** `isTurret()` auf `TurretBase && !Container` zurueckgeschnitten,
  JSON neu erzeugt, Kommentare angepasst (siehe Decisions oben)
- **Files modified:** `scripts/datamine-ship-components.mjs`, `src/data/ship-components.json`
- **Verification:** neuer `--audit`-Lauf, direkte XML-Pruefung von Carrack/Redeemer/Polaris
- **Committed in:** `8378e9e`

**2. [Rule 1 - Bug in den PLAN-eigenen `<verify>`-Assertionen] Zahlenwerte auf D-06a angepasst**
- **Found during:** Task 1 und Task 3, beim Ausfuehren der PLAN-eigenen `<verify>`-Befehle
- **Issue:** siehe Abschnitt "Korrigierte Erwartungswerte" oben -- `hammerhead.t!==6`
  verwechselte Anzahl mit Groesse (bereits vor D-06a falsch); alle "59"-Erwartungen
  sind durch D-06a auf "47" ueberholt
- **Fix:** korrigierte Assertionen ausgefuehrt, siehe oben; keine Aenderung an
  gelieferten Dateien noetig
- **Files modified:** keine (nur die Pruefmethode angepasst)
- **Verification:** siehe "Korrigierte Erwartungswerte"
- **Committed in:** n/a (nur Pruefverfahren, kein Diff)

---

**Total deviations:** 2 (1 vom Nutzer angewiesene Regelaenderung, 1 Bug in den
PLAN-eigenen Pruefassertionen)
**Impact on plan:** Die Regelaenderung ist eine bewusste, vom Nutzer getroffene
Entscheidung (kein Scope Creep); die korrigierten Pruefwerte betreffen nur die
Verifikationsmethode, nicht den gelieferten Code.

## Issues Encountered

Kein Konflikt zwischen implementierter Regel und Spieldaten -- die einzige
"Ueberraschung" war, dass Carrack/Redeemer/Polaris entgegen einer vereinfachten
RESEARCH.md-Aussage teils bemannte `TurretBase`-Tuerme UND separate ferngesteuerte
`Turret`-only-Ports gleichzeitig tragen (siehe Abschnitt oben).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/pages/de/schiffe.astro` bleibt bewusst unveraendert (Plan 05-03 dupliziert
  von Hand, bestehendes Class-A-Muster).
- Plan 05-03 muss beim Duplizieren ins DE-Zwilling die aktuelle Zahl **47** (nicht
  59) fuer den Turm-Kartenzaehl-Check verwenden.
- Browser-Verhaltensnachweis der Filterlogik (inkl. Turm) steht laut
  Plan-Verification weiterhin fuer Plan 05-03 aus (`tests/e2e/ship-component-filter.test.js`).
- Alle vier Gates liefen gruen: `npm run build` (17365 Seiten), `npm run verify`
  (816195 lokale Referenzen, alle aufgeloest), `npm run audit:site` (0 FEHLER, 4
  vorbestehende, phasenfremde A11y-Warnungen zu `/account.html`/`/pilot.html`),
  `npm run test:e2e` (98/98 bestanden).

---
*Phase: 05-komponenten-filter-f-r-schiffe*
*Completed: 2026-08-03*
