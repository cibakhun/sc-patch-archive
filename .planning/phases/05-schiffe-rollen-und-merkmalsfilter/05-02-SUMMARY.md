---
phase: 05-schiffe-rollen-und-merkmalsfilter
plan: 02
subsystem: ui
tags: [astro, datacore, i18n, filter, ships, datamine]

requires:
  - phase: 05-schiffe-rollen-und-merkmalsfilter/05-01
    provides: "datamine-vehicle-roles.mjs, vehicle-roles.json, vRoleCig(), ShipsOverview.astro (EIN Körper), sf-role-Filter"
provides:
  - "CAREER_LEGACY/ROLE_COMPOUND/ROLE_FAMILY in datamine-vehicle-roles.mjs — Beruf-Normalisierung, Verbundrollen-Zerlegung, 18-Familien-Zuordnung"
  - "sig (IR/EM/RQ) und feat (cargo/ground) je Fahrzeug in vehicle-roles.json, plus sources-Kopffeld über alle 5 Achsen"
  - "vCareer(id, lang), vRoleFamilies(id, lang), vSignature(id) in src/i18n/vehicleText.ts; vRoleCig() nutzt jetzt ROLE_DE_GAPFILL vor dem fociDe-Rückfall"
  - "data-career/data-rolefam/data-sig/data-feat plus sf-career/sf-rolefam/sf-sig/sf-feat-Filter in ShipsOverview.astro"
  - "fcard__sig — CIG-HUD-beschriftete, locale-formatierte Signaturzeile auf der Karte"
  - "verify-vehicle-roles.mjs prüft Familienstand, Verbundrollen-Zerlegung, Signatur- und Merkmalszahlen, Belegpflicht"
affects: [05-03]

tech-stack:
  added: []
  patterns:
    - "Flach-Map-Lookup (roleKey -> family slug) statt Familie->Array — O(1) je Fahrzeug, 48 atomare Rollenschlüssel"
    - "Zwei-Ebenen-Rollenmodell: literaler roleKey (Kartenbeschriftung, wörtliche CIG-Verbundrolle) getrennt von roleKeys[]/families[] (Filter-Zerlegung) — dieselbe Verbundrolle bleibt auf der Karte stehen, zählt aber in mehreren Filterachsen"
    - "Kanonische Beruf-Beschriftung (CAREER_LABEL) statt roher locDe()/locEn()-Auflösung — macht die 4 Altwert-Fälle (CAREER_LEGACY) unsichtbar für den Leser, ohne die JSON-Struktur zu verändern"
    - "Locale-aware Zahlenformat (toLocaleString mit minimum/maximumFractionDigits) für die Signaturzeile, analog zum bestehenden auecShort-Muster"

key-files:
  created: []
  modified:
    - scripts/datamine-vehicle-roles.mjs
    - scripts/verify-vehicle-roles.mjs
    - src/data/vehicle-roles.json
    - src/i18n/vehicleText.ts
    - src/components/ships/ShipsOverview.astro

key-decisions:
  - "npm run theme lief erneut repo-weit und berührte dieselben 84 unbeteiligten Dateien wie in Plan 01 (Alt-Drift bei Farb-Tokens) — alle 84 per git checkout -- zurückgesetzt (Scope Boundary), nur die für dieses Plan-Ziel nötige .fcard__sig-Regel blieb stehen. Der Lauf fand für diese Regel keine neue Hell-Entsprechung noch (var(--gold) war bereits tokenisiert), sodass am :root[data-theme=\"light\"]-Block von ShipsOverview.astro nichts geändert wurde."
  - "Signaturzahlen locale-formatiert statt mit toFixed(2) — Komma statt Punkt auf der deutschen Seite (0,76 statt 0.76), analog zum bestehenden auecShort-Muster in derselben Datei. War im Plan nicht explizit gefordert, aber Rule 2 (Korrektheit): eine feste Punkt-Schreibweise wäre auf der deutschen Seite ein Sprachbruch gewesen."
  - "CAREER_LABEL überschreibt careerDe/careerEn für ALLE Fahrzeuge (nicht nur die 4 CAREER_LEGACY-Fälle) aus einer kanonischen 8-Werte-Tabelle statt der rohen locDe()/locEn()-Auflösung — vermeidet, dass die 4 Altwert-Fahrzeuge einen sichtbar anderen Text tragen als ihre Berufs-Geschwister."

requirements-completed: [ROLE-02, ROLE-03, ROLE-04, ROLE-05, ROLE-07, ROLE-10]

coverage:
  - id: D1
    description: "Beruf (vehicleCareer) und 18 Rollenfamilien aus dem DataCore — Bergung findet alle 3 Gewichtsklassen (6), Bergbau 5, Betankung 3; Familienstand exakt gegen die erhobene Tabelle geprüft"
    requirement: "ROLE-02"
    verification:
      - kind: unit
        ref: "npm run verify:vehicle-roles Abschnitt F (18 Familienstände exakt) + node-Inline-Check aus PLAN.md acceptance_criteria (18 Familien ok)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Verbundrollen zerlegt — starterlightfreight (5 Schiffe) zählt unter einsteiger UND frachttransport, alle 8 Verbundrollen mit >=2 Familien belegt"
    requirement: "ROLE-03"
    verification:
      - kind: unit
        ref: "npm run verify:vehicle-roles Abschnitt H + node-Inline-Check ROLE-03 ok"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rollenfilter arbeitet auf Familienebene (sf-rolefam/data-rolefam), Karte zeigt weiterhin die exakte CIG-Rolle (sf-role/data-role aus Plan 01 unverändert)"
    requirement: "ROLE-04"
    verification:
      - kind: unit
        ref: "node-Inline-Check gegen dist/schiffe.html: sf-rolefam vorhanden, data-rolefam bei >=223 Karten, Leerzeichen-umschlossen"
        status: pass
      - kind: manual_procedural
        ref: "Sichtprüfung, dass ein Klick auf 'Bergung' im Rollenfamilien-Filter tatsächlich alle 6 Bergungsschiffe zeigt und die Karte weiterhin die exakte Rolle (z. B. 'Schweres Bergungsschiff') nennt"
        status: unknown
    human_judgment: true
    rationale: "Automatisiert geprüft ist nur die Markup-Präsenz und Datenkorrektheit; das tatsächliche Klick-Verhalten im Browser (Familienfilter blendet korrekt, Karte behält exakte Rolle) verlangt eine visuelle Bedienprobe."
  - id: D4
    description: "Signaturfilter findet 16 Katalogschiffe mit abgesenkter Signatur (11 unter 0,80); Prowler Utility (Frachttransport + sig.ir=0,76) und Eclipse (Bomber/stealthbomber) als Stichproben bestätigt; Werte mit CIG-HUD-Beschriftung auf der Karte, locale-formatiert"
    requirement: "ROLE-05"
    verification:
      - kind: unit
        ref: "npm run verify:vehicle-roles Abschnitt I/J + node-Inline-Checks (Signatur ok, Prowler Utility, Tarnkappenbomber ok, D-08 ok)"
        status: pass
      - kind: manual_procedural
        ref: "Sichtprüfung der fcard__sig-Zeile im Browser (Lesbarkeit, Kürzung auf schmalen Karten laut mobile-ux.css Zeilen 412-430)"
        status: unknown
    human_judgment: true
    rationale: "Zahlenkorrektheit und Markup sind automatisiert geprüft; ob die Signaturzeile auf der Karte visuell sauber sitzt (Zeilenumbruch, Kürzung bei 375px), verlangt eine Bedienprobe im Browser."
  - id: D5
    description: "Alle 17 Rollen ohne deutsche CIG-Fassung sind selbst übersetzt (ROLE_DE_GAPFILL); keine der 17 erscheint als englischer Chip auf der deutschen Seite"
    requirement: "ROLE-07"
    verification:
      - kind: unit
        ref: "node-Inline-Checks gegen dist/de/schiffe.html: ROLE-07 ok (4 Stichproben-Begriffe vorhanden) + zweiter Check gegen die 9 auffälligsten EN-Fassungen als fcard__chip (keine gefunden)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Merkmalsleiste trägt genau cargo (102) und ground (37); 'Bewaffnet' bewusst nicht erzeugt (dogfightEnabled 220/223, siebt nichts aus — D-09 eigene Abbruchbedingung angewandt)"
    requirement: null
    verification:
      - kind: unit
        ref: "npm run verify:vehicle-roles Abschnitt K + node-Inline-Check 'Merkmale ok'"
        status: pass
    human_judgment: false
  - id: D7
    description: "Wiederholbarer Prüfschritt erweitert um Familienstand, Verbundrollen-Zerlegung, Signatur/Merkmals-Zahlen und Belegpflicht (sources über alle 5 Achsen); schlägt bei Abweichung mit Exit 1 fehl"
    requirement: "ROLE-10"
    verification:
      - kind: unit
        ref: "npm run verify:vehicle-roles (Exit 0, Abschnitte F–L, 0 Fehlschläge)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-02
status: complete
---

# Phase 5 Plan 2: Beruf, Rollenfamilien, Signatur und Merkmale — Prowler Utility wird auffindbar Summary

**18 Rollenfamilien plus Signatur- und Merkmalsachsen aus dem DataCore auf der Schiffsübersicht; „Bergung" findet alle Gewichtsklassen, der Prowler Utility ist über Frachttransport + Signatur auffindbar.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-02T11:42:38Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- `scripts/datamine-vehicle-roles.mjs` erweitert um `CAREER_LEGACY` (4 Altwert-Ausnahmen), `ROLE_COMPOUND` (8 Verbundrollen → atomare Bestandteile) und `ROLE_FAMILY` (48 atomare Rollenschlüssel → 18 Familien-Slugs) — nachgerechnete Familienstände decken sich exakt mit der erhobenen Tabelle aus 05-02-PLAN.md `<interfaces>` (Jäger 63, Frachttransport 35, Erkundung 27, Passagiere 17, Rennen 17, Einsteiger 12, Bodenkampf 11, Kanonenschiff 9, Medizin 7, Bomber 6, Truppentransport 6, Bergung 6, Abriegelung 5, Bergbau 5, Großkampfschiff 5, Daten & Wissenschaft 3, Betankung 3, Mehrzweck 2 — **keine Abweichung**).
- Berufswerte nach Normalisierung: combat 105, transporter 37, exploration 31, competition 16, resources 13, support 12, multirole 7, ground 2 (Summe 223) — ebenfalls deckungsgleich mit der erhobenen Tabelle.
- `sig` (IR/EM/RQ, 0 als `null` abgelegt, gerundet auf 2 Nachkommastellen) und `feat` (`cargo`/`ground`) je Fahrzeug ergänzt: **genau 16** Fahrzeuge tragen ein `sig`-Objekt (11 davon unter 0,80), **102** tragen `cargo`, **37** tragen `ground` — alle drei Zahlen decken sich exakt mit der Erhebung. `dogfightEnabled` liegt bei 220/223 (Report zählt mit, wird aber bewusst NICHT als Merkmal erzeugt — D-09s eigene Abbruchbedingung).
- `src/i18n/vehicleText.ts`: `ROLE_DE_GAPFILL` (17 Einträge), `FAMILY_LABELS` (18), `SIG_LABELS`/`SIG_STEPS`/`FEAT_LABELS` plus neue Akzessoren `vCareer()`, `vRoleFamilies()`, `vSignature()`. `vRoleCig()` erweitert: bei fehlendem `roleDe` greift jetzt zuerst `ROLE_DE_GAPFILL[roleKey]`, erst danach der `vRole()`/`fociDe`-Rückfall.
- `ShipsOverview.astro`: vier neue Filterachsen (`sf-career`, `sf-rolefam`, `sf-sig`, `sf-feat`) mit passenden `data-*`-Attributen auf der Karte; `fcard__sig`-Zeile zeigt die CIG-HUD-beschrifteten, locale-formatierten Signaturwerte für die 16 Träger.
- `scripts/verify-vehicle-roles.mjs` um sechs neue Prüfabschnitte erweitert (F–L): 18-Familienstand exakt, Verbundrollen-Zerlegung ≥2 Familien, Signatur-/Merkmalszahlen, Stichproben Prowler Utility + Eclipse, Belegpflicht über alle 5 Achsen.

## Task Commits

1. **Task 1: Beruf und 18 Rollenfamilien — „Bergung" findet alle sechs, Starter-Frachter zählen doppelt** - `75b4f57` (feat)
2. **Task 2: Signaturachse und Merkmalsleiste — der Prowler Utility wird auffindbar** - `fde2b48` (feat)

_Beide Tasks wurden ohne Checkpoint-Unterbrechung durchlaufen (autonomous plan)._

## Files Created/Modified

- `scripts/datamine-vehicle-roles.mjs` - CAREER_LEGACY/ROLE_COMPOUND/ROLE_FAMILY, sig/feat-Extraktion, erweiterter Konsolenreport (Familienstand, atomare Rollen ohne Familie, Signatur/Merkmals-Zählstände)
- `scripts/verify-vehicle-roles.mjs` - 6 neue Prüfabschnitte (Familienstand, Verbundrollen, Beruf/Familie-Vollständigkeit, Signatur, Prowler-Utility/Eclipse-Stichproben, Merkmale, Belegpflicht)
- `src/data/vehicle-roles.json` - committete Momentaufnahme neu erzeugt: `roleKeys`/`families`/`sig`/`feat` je Fahrzeug, `sources`-Kopffeld über 5 Achsen
- `src/i18n/vehicleText.ts` - ROLE_DE_GAPFILL, FAMILY_LABELS, SIG_LABELS, SIG_STEPS, FEAT_LABELS; vCareer(), vRoleFamilies(), vSignature(); vRoleCig() um Lücken-Fallback erweitert
- `src/components/ships/ShipsOverview.astro` - 4 neue `<select>`-Filter, 4 neue `data-*`-Attribute, fcard__sig-Anzeige samt CSS-Regel

## Decisions Made

- **`npm run theme` erneut repo-weit ausgeführt, auf die für dieses Ziel nötigen Dateien zurückgestutzt.** Wie in Plan 01 berührte der Sammelbefehl dieselben 84 unbeteiligten Dateien (Alt-Drift bei Farb-Tokens). Alle 84 per `git checkout --` zurückgesetzt; die neue `.fcard__sig`-Regel in `ShipsOverview.astro` brauchte keine eigene Hell-Entsprechung (`var(--gold)` war bereits tokenisiert), sodass am generierten `:root[data-theme="light"]`-Block dieser Datei nichts zu ändern war.
- **Signaturzahlen locale-formatiert** (`toLocaleString` mit `minimumFractionDigits`/`maximumFractionDigits: 2`) statt `toFixed(2)` — Komma statt Punkt auf der deutschen Seite (`0,76` statt `0.76`), analog zum bestehenden `auecShort`-Muster in derselben Datei. Nicht explizit im Plan gefordert; ergänzt nach Rule 2 (Korrektheit) — eine feste Punkt-Schreibweise wäre auf der deutschen Seite ein Sprachbruch gewesen.
- **`CAREER_LABEL` überschreibt `careerDe`/`careerEn` für ALLE 223 Fahrzeuge** aus einer kanonischen 8-Werte-Tabelle, nicht nur für die 4 `CAREER_LEGACY`-Fälle. Grund: die rohe `locDe()`/`locEn()`-Auflösung hätte für die 4 Altwert-Fahrzeuge einen anderen Text geliefert als für ihre Berufs-Geschwister (z. B. „Starter" statt „Transport" bei `crus-intrepid`), obwohl der Berufsschlüssel nach Normalisierung identisch ist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, Scope Boundary] `npm run theme`-Nebenwirkungen zurückgesetzt (wiederkehrend aus Plan 01)**
- **Found during:** Task 2, Schritt (c) (`npm.cmd run theme` laut Plan-Anweisung nach Hinzufügen der `.fcard__sig`-Regel)
- **Issue:** Der Sammelbefehl ist repo-weit und fand erneut dieselben 84 unbeteiligten Dateien mit Alt-Drift bei Farb-Tokens (Plan-01-Befund reproduziert sich unverändert, da diese Dateien seither nicht angefasst wurden).
- **Fix:** `git checkout --` auf alle 84 unbeteiligten Dateien; nur `scripts/datamine-vehicle-roles.mjs`, `scripts/verify-vehicle-roles.mjs`, `src/components/ships/ShipsOverview.astro`, `src/data/vehicle-roles.json`, `src/i18n/vehicleText.ts` blieben verändert.
- **Files modified:** (zurückgesetzt, nicht verändert)
- **Verification:** `git status --short` nach dem Reset zeigt nur die für diesen Plan vorgesehenen 5 Dateien
- **Committed in:** nicht committet (zurückgesetzt vor dem Task-2-Commit)

**2. [Rule 2 - Missing Critical, Korrektheit] Locale-Formatierung der Signaturzahlen**
- **Found during:** Task 2, Schritt (c) (Kartenanzeige `fcard__sig`)
- **Issue:** Erste Fassung nutzte `toFixed(2)` (immer Punkt als Dezimaltrennzeichen), was auf der deutschen Seite `0.76` statt `0,76` gezeigt hätte — ein Sprachbruch gegenüber dem übrigen Zahlenformat der Seite (`auecShort` nutzt bereits `toLocaleString`).
- **Fix:** `sigFmt()`-Hilfsfunktion nach dem `auecShort`-Muster ergänzt (`toLocaleString('de-DE'|'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`).
- **Files modified:** `src/components/ships/ShipsOverview.astro`
- **Verification:** `dist/de/schiffe.html` zeigt „IR-Signatur 0,76 · EM-Signatur 0,76 · RQ-Signatur 0,80"; `dist/schiffe.html` zeigt „IR Signature 0.76 · EM Signature 0.76 · CS Signature 0.80"
- **Committed in:** `fde2b48` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Scope-Boundary-Korrektur, 1 Korrektheits-Ergänzung)
**Impact on plan:** Kein Scope-Creep — die 84 unbeteiligten Dateien blieben im Arbeitsbaum unangetastet. Die Locale-Formatierung ist eine kleine, in sich geschlossene Korrektheits-Ergänzung, die dem bereits im Projekt etablierten Muster folgt.

## Issues Encountered

Vor der Implementierung wurden `movementClass`, `isGravlevVehicle` und `SSCSignatureSystemParams` direkt gegen das echte Archiv geprobt (nicht in RESEARCH.md dokumentiert, da der Planer diese Felder erst beim Planen fand) — bestätigt: beide Merkmalsfelder liegen direkt auf `VehicleComponentParams` (derselben Komponente wie `vehicleCareer`/`vehicleRole`/`dogfightEnabled`), und `maxDepth: 8` (bereits im bestehenden `readRecord()`-Aufruf verwendet) genügt, um sowohl diese Felder als auch `SSCSignatureSystemParams.radarProperties.baseSignatureParams.signatures` zu erreichen — keine Vertiefung der Rekursionstiefe nötig. Kein Abweichung vom Plan, nur eine Vorab-Verifikation der in `<interfaces>` behaupteten Feldpfade.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

- Beide Achsen, die die Nutzer-Beispielfälle erreichbar machen, stehen: Bergung/Bergbau/Betankung über Rollenfamilien (D-05/D-06), der Prowler Utility über Frachttransport + Signatur (D-07).
- Acht Filterachsen sind jetzt aktiv (Suche, Hersteller, Typ, Rolle, Beruf, Rollenfamilie, Signatur, Merkmal, Status, Archiv) — der bestehende `sf-type`-Grobfilter (8 Werte) bleibt laut Plan bewusst unangetastet; **Plan 03 entscheidet nach Sichtprüfung über seine Ablösung**.
- **Offen für Plan 03 (aus 05-CONTEXT.md):** Schnellzugriff-Chips (D-10, ROLE-06) — Tarnkappenbomber, Frachter mit abgesenkter Signatur, Bergbau, Bergung, Betankung, Abriegelung, Rennen; Sichtprüfung der neuen Filterkonsole (jetzt 8 Achsen — trägt die Optik das noch, oder braucht es ein „mehr Filter"-Fold?); Entscheidung über `sf-type`-Ablösung.
- Zwei Coverage-Items (D3/D4, ROLE-04/ROLE-05) verlangen eine visuelle Bedienprobe im Browser (Familienfilter-Klickverhalten, `fcard__sig`-Lesbarkeit auf schmalen Karten) — automatisiert ist nur Markup- und Datenkorrektheit geprüft, nicht das tatsächliche Bedienerlebnis.
- Blocker: keine.

---
*Phase: 05-schiffe-rollen-und-merkmalsfilter*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: scripts/datamine-vehicle-roles.mjs
- FOUND: scripts/verify-vehicle-roles.mjs
- FOUND: src/data/vehicle-roles.json
- FOUND: src/i18n/vehicleText.ts
- FOUND: src/components/ships/ShipsOverview.astro
- FOUND commit: 75b4f57
- FOUND commit: fde2b48
