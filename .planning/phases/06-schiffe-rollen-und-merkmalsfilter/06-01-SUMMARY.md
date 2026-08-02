---
phase: 06-schiffe-rollen-und-merkmalsfilter
plan: 01
subsystem: ui
tags: [astro, datacore, i18n, filter, ships, datamine]

requires: []
provides:
  - "scripts/datamine-vehicle-roles.mjs — DataCore-Extraktor für vehicleCareer/vehicleRole, DE+EN aus CIGs global.ini"
  - "src/data/vehicle-roles.json — committete Momentaufnahme, 223/227 gejoint, 4 ATLS-ids benannt als unmatched"
  - "vRoleCig(id, d, lang) in src/i18n/vehicleText.ts — exakte CIG-Rolle als Kartenbeschriftung, fällt auf vRole() zurück"
  - "src/components/ships/ShipsOverview.astro — EIN Körper für /schiffe.html und /de/schiffe.html"
  - "sf-role-Filter (clientseitig, data-role) auf der Schiffsübersicht"
affects: [06-02, 06-03]

tech-stack:
  added: []
  patterns:
    - "EIN-Körper-Migration (localeFromPath + de-Flag) für ein weiteres Seitenpaar, analog components/topics/crafting.astro"
    - "Datamine-Skript lädt ZWEI Lokalisierungsdateien (EN+DE) statt nur EN — neues Muster gegenüber datamine-ship-loadouts.mjs"
    - "window.__SDB-Objekt (set:html) trägt den einzigen sprachabhängigen String (Treffer/results) ins ansonsten sprachneutrale Inline-Filterskript"

key-files:
  created:
    - scripts/datamine-vehicle-roles.mjs
    - scripts/verify-vehicle-roles.mjs
    - src/data/vehicle-roles.json
    - src/components/ships/ShipsOverview.astro
  modified:
    - src/i18n/vehicleText.ts
    - src/pages/schiffe.astro
    - src/pages/de/schiffe.astro
    - package.json

key-decisions:
  - "npm run theme lief repo-weit und veränderte 84 unbeteiligte Dateien (Alt-Drift bei Farb-Tokens, u. a. einen fehlerhaften Selbstbezug var(--chrome-solid, var(--chrome-solid)) in SiteNav.astro) — alle 84 zurückgesetzt, nur die für dieses Plan-Ziel nötige Regenerierung (bereits Teil der manuell übertragenen Stilblöcke) blieb stehen (Scope Boundary, Rule-Grenzen der Deviation-Regeln)."
  - "Filterskript bleibt vollständig sprachneutraler Text; der einzige Sprachunterschied (Treffer-Suffix) kommt über ein kleines window.__SDB-Objekt statt {ausdruck}-Interpolation direkt im <script is:inline> (kein belegtes Muster dafür im Bestand, window.__X ist das etablierte Muster aus ItemFinderApp/MiningApp/MissionsApp)."

requirements-completed: [ROLE-01, ROLE-02, ROLE-08, ROLE-09, ROLE-10]
# ROLE-04 (Familienebene-Filter) steht in der Plan-Frontmatter, ist aber NICHT durch Plan 01
# erfüllt — Task 1 filtert auf exakter Rollenebene (sf-role/data-role), nicht auf Familienebene.
# Familien (D-05) sind laut "Artifacts this phase produces" ausdrücklich Plan-02-Scope
# (data-rolefam/sf-rolefam). REQUIREMENTS.md wurde entsprechend NICHT auf Complete gesetzt.

coverage:
  - id: D1
    description: "Datamine extrahiert vehicleCareer/vehicleRole DE+EN aus Game2.dcb, joint 223/227 Katalog-Schiffe, benennt die 4 ATLS-Fehltreffer"
    requirement: "ROLE-01"
    verification:
      - kind: other
        ref: "node scripts/datamine-vehicle-roles.mjs --audit (Konsole: gematcht 223/227, unmatched exakt die 4 ATLS-ids)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Jede Karte zeigt die exakte CIG-Rolle in der Sprache der Seite (vRoleCig ersetzt fociDe/vRole)"
    requirement: "ROLE-02"
    verification:
      - kind: other
        ref: "node -e Prüfung gegen dist/schiffe.html + dist/de/schiffe.html: 'Light Salvage' (EN) / 'Leichtes Bergungsschiff' (DE) für drak-vulture vorhanden"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rollenfilter (sf-role/data-role) blendet Karten clientseitig aus; ohne JS bleiben alle sichtbar (progressive enhancement, reines CSS-display)"
    requirement: "ROLE-09"
    verification:
      - kind: other
        ref: "node -e Prüfung: id=\"sf-role\" in dist/schiffe.html und dist/de/schiffe.html; ≥223 data-role-Attribute je Seite"
        status: pass
    human_judgment: true
    rationale: "Automatisiert geprüft ist nur die Markup-Präsenz; dass der Filter sich beim Klicken tatsächlich sichtbar korrekt verhält (visuelle Bedienprobe), verlangt eine menschliche Sichtprüfung im Browser."
  - id: D4
    description: "Übersichtsseite auf EINEN Körper gezogen (ShipsOverview.astro); beide Hüllen ≤24 Zeilen"
    requirement: "ROLE-08"
    verification:
      - kind: other
        ref: "node -e Zeilenzahl-Prüfung src/pages/schiffe.astro + de/schiffe.astro (15 Zeilen je Datei); node scripts/sync-style-blocks.mjs --check (schiffe.astro nicht mehr unter Eigenständiges DE-CSS, 6→5)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Wiederholbarer Prüfschritt belegt die Join-Rate 223/227 und schlägt unter dieser Grenze mit Exit 1 fehl"
    requirement: "ROLE-10"
    verification:
      - kind: unit
        ref: "npm run verify:vehicle-roles (Exit 0, 223/227, 4 benannte Fehlstellen); Tamper-Test (ein Satz gelöscht) → Exit 1, danach zurückgespielt"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm run build läuft fehlerfrei, ShipDetail.astro bleibt unberührt, vRole() unverändert"
    verification:
      - kind: other
        ref: "npm.cmd run build (17365 Seiten); git diff --stat src/components/ShipDetail.astro (leer); git diff -- src/i18n/vehicleText.ts (nur Zusätze)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-02
status: complete
---

# Phase 6 Plan 1: Bergung von der Spieldatei bis auf die Karte — EIN Körper, beide Sprachen Summary

**CIG-eigene Fahrzeug-Taxonomie (`vehicleCareer`/`vehicleRole`) aus dem DataCore ersetzt die Wiki-Foci als Kartenrolle, gefiltert über einen neuen `sf-role`-Filter auf einem einzigen, DE+EN gemeinsamen Übersichts-Körper.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-02 (Sitzungsbeginn)
- **Completed:** 2026-08-02T11:11:55Z
- **Tasks:** 2/2
- **Files modified:** 8 (4 neu, 4 geändert)

## Accomplishments

- `scripts/datamine-vehicle-roles.mjs` liest `VehicleComponentParams.vehicleCareer`/`.vehicleRole` aus `Game2.dcb` und löst sie über **zwei** `global.ini`-Dateien (EN + `german_(germany)`) auf — gemessene Join-Rate exakt **223/227**, `unmatched` exakt `argo-atls`, `argo-atls-geo`, `argo-atls-geo-collector-grad01`, `argo-atls-geo-collector-grad03` (deckungsgleich mit den beim Planen erhobenen Zahlen — keine Abweichung).
- `vRoleCig(id, d, lang)` in `src/i18n/vehicleText.ts` liefert die exakte CIG-Rolle in Kartensprache und fällt für die 4 ATLS-Fälle auf das bestehende `vRole()` zurück; `vRole()` selbst bleibt unverändert (weiter von `ShipDetail.astro` genutzt, nicht im Umfang dieser Phase).
- `src/components/ships/ShipsOverview.astro` vereint die beiden bisher unabhängig gepflegten Seitenkopien (`schiffe.astro`/`de/schiffe.astro`) zu einem Körper; beide Hüllen sind auf 15 Zeilen (Layout-Import + `<Body />`) eingedampft.
- Neuer `sf-role`-Filter (Select hinter `sf-type`, befüllt aus den distinkten `vRoleCig`-Werten) plus `data-role`-Attribut je Karte; das Inline-Filterskript filtert rein clientseitig über `style.display`, ohne JS bleiben alle Karten sichtbar.
- `scripts/verify-vehicle-roles.mjs` prüft ausschließlich committete Dateien (kein Archivzugriff), belegt die Join-Rate gegen eine benannte Untergrenze (223) und schlägt bei einem gelöschten Satz nachweislich mit Exit 1 fehl.

## Task Commits

1. **Task 1: „Bergung" von der Spieldatei bis auf die Karte — EIN Körper, beide Sprachen** - `31f1293` (feat)
2. **Task 2: Prüfschritt für die Join-Rate — schlägt fehl, wenn sie sinkt** - `ee2be27` (test)

_Beide Tasks wurden ohne Checkpoint-Unterbrechung durchlaufen (autonomous plan)._

## Files Created/Modified

- `scripts/datamine-vehicle-roles.mjs` - DataCore-Extraktor, DE+EN-Lokalisierung, normalisiert Rohschlüssel (führendes `@`, `vehicle_class_`/`vehicle_focus_`-Präfix weg)
- `scripts/verify-vehicle-roles.mjs` - Prüfschritt gegen committete Snapshots, kein Archivzugriff
- `src/data/vehicle-roles.json` - committete Momentaufnahme, 223 Sätze + 4 benannte `unmatched`-ids
- `src/components/ships/ShipsOverview.astro` - neuer gemeinsamer Körper (Stilblock wörtlich aus der EN-Seite übernommen, Kommentare vereinheitlicht)
- `src/i18n/vehicleText.ts` - `vRoleCig()` ergänzt (rein additiv)
- `src/pages/schiffe.astro` / `src/pages/de/schiffe.astro` - auf Hüllen-Muster eingedampft (399/393 → 15 Zeilen)
- `package.json` - `datamine:vehicle-roles`, `verify:vehicle-roles`

## Decisions Made

- **`npm run theme` repo-weit ausgeführt, dann auf die 4 relevanten Dateien zurückgestutzt.** Der Plan verlangte den Lauf nach dem Verschieben des Stilblocks. Der Lauf berührte tatsächlich 84 unbeteiligte Dateien (Alt-Drift bei Farb-Tokens, u. a. einen fehlerhaften Selbstbezug `var(--chrome-solid, var(--chrome-solid))` statt der ursprünglichen Fallback-Farbe in `src/components/SiteNav.astro`). Alle 84 wurden per `git checkout --` zurückgesetzt (Scope Boundary aus den Deviation-Regeln: nur direkt durch diesen Task verursachte Änderungen bleiben). Der neue Körper selbst brauchte keine Nacharbeit — sein Hellmodus-Block war beim manuellen Übertragen bereits korrekt.
- **Sprachabhängiger Text im Inline-Filterskript über `window.__SDB`** statt `{ausdruck}`-Interpolation direkt im `<script is:inline>`-Textkörper — kein belegtes Muster im Bestand für Letzteres; `window.__X`-Objekte (siehe `ItemFinderApp.astro`, `MiningApp.astro`, `MissionsApp.astro`) sind der etablierte Weg, Serverwerte in ein reines Inline-Skript zu tragen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, Scope Boundary] `npm run theme`-Nebenwirkungen zurückgesetzt**
- **Found during:** Task 1, Schritt (e) (`npm.cmd run theme` laut Plan-Anweisung)
- **Issue:** Der Sammelbefehl ist repo-weit (`glob('src/**/*.astro')`) und fand Alt-Drift bei Farb-Tokens in 84 Dateien außerhalb dieser Phase — darunter eine kaputte Selbstreferenz in `SiteNav.astro`.
- **Fix:** `git checkout --` auf alle 84 unbeteiligten Dateien; nur `package.json`, `src/i18n/vehicleText.ts`, `src/pages/schiffe.astro`, `src/pages/de/schiffe.astro` sowie die neuen Dateien blieben verändert/neu.
- **Files modified:** (zurückgesetzt, nicht verändert) — siehe Decisions oben
- **Verification:** `git status --short` zeigt nach dem Reset nur noch die für diesen Plan vorgesehenen Dateien; `node scripts/sync-style-blocks.mjs --check` weiterhin korrekt (6→5 eigenständige Paare nach dem Commit)
- **Committed in:** nicht committet (zurückgesetzt vor dem Task-1-Commit)

**2. [Rule 4-artig, Requirements-Traceability-Korrektur] ROLE-04 NICHT als „Complete" geführt**
- **Found during:** State-Update-Schritt (nach beiden Task-Commits)
- **Issue:** Die Plan-01-Frontmatter listet `ROLE-04` unter `requirements`. Der tatsächliche
  REQUIREMENTS.md-Text von ROLE-04 verlangt Filterung auf **Familienebene**
  (`data-rolefam`/`sf-rolefam`) — diese ist laut demselben Plandokument („Artifacts this phase
  produces") ausdrücklich für Plan 02/03 vorgesehen, nicht für Plan 01. Ein erster Lauf von
  `requirements mark-complete` hätte ROLE-04 fälschlich auf „Complete" gesetzt.
- **Fix:** ROLE-04 in `REQUIREMENTS.md` (Checkbox + Traceability-Tabelle) auf „Pending"
  zurückgesetzt; `requirements-completed` im SUMMARY-Frontmatter um ROLE-04 bereinigt und die
  Begründung dort vermerkt.
- **Files modified:** `.planning/REQUIREMENTS.md`, `.planning/phases/06-schiffe-rollen-und-merkmalsfilter/06-01-SUMMARY.md`
- **Verification:** `grep ROLE-04 .planning/REQUIREMENTS.md` zeigt `[ ]` und „Pending"; die 5
  tatsächlich erfüllten IDs (ROLE-01, ROLE-02, ROLE-08, ROLE-09, ROLE-10) bleiben „Complete"
- **Committed in:** wird mit der Abschluss-Commit dieses Plans miterfasst (docs)

---

**Total deviations:** 2 auto-fixed (1 Scope-Boundary-Korrektur, 1 Requirements-Traceability-Korrektur)
**Impact on plan:** Kein Scope-Creep — die 84 unbeteiligten Dateien sind unangetastet im Arbeitsbaum verblieben. Der Fund (kaputte `--chrome-solid`-Fallback-Referenz) ist nicht behoben und gehört nicht in diesen Plan; er wird hier dokumentiert, nicht in `deferred-items.md` verschoben, da er außerhalb des Scope dieser Phase liegt und beim nächsten regulären `npm run theme`-Lauf ohnehin erneut auffällt. Die ROLE-04-Korrektur verhindert eine verfrühte „Complete"-Markierung, die die Traceability-Tabelle verfälscht hätte.

## Issues Encountered

None über die oben dokumentierte `npm run theme`-Nebenwirkung hinaus.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Eingangsgröße für Plan 02 (ROLE-07)

**Rollenschlüssel ohne deutsches CIG-Label (17, aus dem Audit-Lauf), Lückenfüllung ist Plan 02 (D-13):**
`antiair`, `antivehicle`, `generalist`, `heavydropship`, `heavyfighterbomber`, `heavytank`,
`item_ShipFocus_HeavyGunship`, `lightfreight_mediumfighter`, `lightrefueling`, `lighttank`,
`mediumsalvage`, `modular`, `recovery`, `snubcarrier`, `starterlightfighter`, `startermining`,
`startersalvage`.

Das deckt sich mit der in `06-CONTEXT.md` (D-13) genannten Liste, mit einer Ergänzung
(`item_ShipFocus_HeavyGunship`, Altschlüssel — dort als `ALT:HeavyGunship` bezeichnet) und ohne
`ALT:HeavyGunship`-Schreibweise (der tatsächliche Rohschlüssel behält sein `item_ShipFocus_`-Präfix,
siehe Normalisierungsregel in `scripts/datamine-vehicle-roles.mjs`).

**Berufs- und Rollen-Verteilung (223 gejointe Schiffe)** deckt sich mit den in `06-CONTEXT.md`
genannten Zahlen (Kampf 102, Transport 36, Erkundung 31, Wettkampf 16, Industrie 13,
Unterstützung 12, Mehrzweck 7, Boden 2, dazu 4 Altwerte) — keine Abweichung von den beim Planen
erhobenen Werten.

## Next Phase Readiness

- Die Architektur (DataCore → committete JSON → i18n-Akzessor → EIN Körper → `data-*`-Attribut →
  Filter) ist end-to-end bewiesen und bleibt stehen; Plan 02/03 erweitern sie additiv
  (`data-career`, `data-rolefam`, `data-sig`, `data-feat`, weitere `sf-*`-Selects, Rollen-Familien,
  Signaturachse, Merkmalsleiste, Schnellzugriff-Chips) statt sie umzubauen.
- Blocker: keine.
- Offen für Plan 02: die 17 Rollenschlüssel ohne deutsches Label (Liste oben) müssen über eine
  neue Übersetzungstabelle in `vehicleText.ts` gefüllt werden (D-13); die Verbundrollen-Zerlegung
  (D-06) und die Rollen-Familien-Zuordnung (D-05) sind noch nicht angefasst.
- **ROLE-04 bleibt für Plan 02 offen.** Die Plan-01-Frontmatter führte ROLE-04 unter
  `requirements`, tatsächlich liefert Task 1 aber nur den Filter auf **exakter** Rollenebene
  (`sf-role`/`data-role`) — die von ROLE-04 verlangte **Familienebene** (`data-rolefam`) ist laut
  „Artifacts this phase produces" explizit Plan-02-Scope. `REQUIREMENTS.md` wurde deshalb bei
  ROLE-04 NICHT auf „Complete" gesetzt (siehe Deviations unten); Plan 02 schließt es ab.

---
*Phase: 06-schiffe-rollen-und-merkmalsfilter*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: scripts/datamine-vehicle-roles.mjs
- FOUND: scripts/verify-vehicle-roles.mjs
- FOUND: src/data/vehicle-roles.json
- FOUND: src/components/ships/ShipsOverview.astro
- FOUND: src/pages/schiffe.astro
- FOUND: src/pages/de/schiffe.astro
- FOUND: src/i18n/vehicleText.ts
- FOUND commit: 31f1293
- FOUND commit: ee2be27
