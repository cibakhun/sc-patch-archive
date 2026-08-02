---
phase: quick-260802-ose
plan: 01
subsystem: ships
tags: [ships, datacore, filters, i18n, vehicle-roles]
dependency-graph:
  requires: [scripts/datamine-vehicle-roles.mjs, src/data/vehicle-roles.json, src/i18n/vehicleText.ts, src/components/ships/ShipsOverview.astro]
  provides: [vSizeClass(), sizeClassLabel(), sf-size Filterachse, size/subType-Felder in vehicle-roles.json]
  affects: [scripts/verify-vehicle-roles.mjs]
tech-stack:
  added: []
  patterns: ["AttachDef-Achsen (Size/SubType) als zusaetzliche, rein informative Datamine-Felder neben den bestehenden Rollen-Achsen"]
key-files:
  created: []
  modified:
    - scripts/datamine-vehicle-roles.mjs
    - src/data/vehicle-roles.json
    - src/i18n/vehicleText.ts
    - src/components/ships/ShipsOverview.astro
    - scripts/verify-vehicle-roles.mjs
decisions:
  - "AttachDef.SubType (27 Bodenfahrzeuge) ersetzt NICHT das bestehende Bodenfahrzeug-Merkmal (isGravlevVehicle/movementClass, 37) — die Differenzmenge sind ausnahmslos Schweberaeder (Nox, Dragonfly, Pulse, X1, Hoverquad), die CIG als Vehicle_Spaceship fuehrt. SubType ist informativ mitgefuehrt (Belegpflicht), steuert aber keine Oberflaeche."
  - "Groessenklasse (AttachDef.Size, 1-6) traegt keine erfundenen Kategorienamen — CIG liefert keine Namen fuer die Zahlen; Beschriftung ist die nackte Klasse (Groesse N / Size N), plus eine erklaerende Konsolenzeile in DE+EN."
  - "Neuer Groessen-Chip auf der Karte ist ZUSAETZLICH zur bestehenden Wiki-Groesse (Klein/Mittel/Gross), nicht deren Ersatz — beide Werte weichen bewusst und gemessen voneinander ab (z. B. Reclaimer: CIG-Groesse 6, Wiki-Groesse 'Gross')."
metrics:
  duration: ~55min
  completed: 2026-08-02
status: complete
---

# Phase quick-260802-ose Plan 01: Größenachse und Boden/Raum aus dem DataCore Summary

Dritte Filterachse "Größe" (CIGs Hangar-/Landeplatzklasse 1–6 aus `AttachDef.Size`) neben Beruf/Rolle; Boden/Raum-Merkmal bewusst NICHT auf `AttachDef.SubType` umgestellt, weil die spielgenauere Quelle dort sechs Schweberad-Modelle verliert.

## Was gebaut wurde

- **`scripts/datamine-vehicle-roles.mjs`**: liest zusätzlich `SAttachableComponentParams.AttachDef.{Size,SubType}` je Schiffs-Record (`Type` bleibt ungenutzt — bei allen 360 Records `NOITEM_Vehicle`). Neue Report-Abschnitte für Größenklassen- und SubType-Verteilung samt Differenzmenge. `sources`-Kopf um `size`/`subType` erweitert (Belegpflicht).
- **`src/data/vehicle-roles.json`**: Momentaufnahme neu erzeugt — jedes der 223 gejointen Fahrzeuge trägt jetzt `size: 1..6` und `subType: 'Vehicle_Spaceship' | 'Vehicle_GroundVehicle'`.
- **`src/i18n/vehicleText.ts`**: `vSizeClass(id)` (liest `size` aus der Momentaufnahme, `null` für die 4 ATLS-Fehlstellen) und `sizeClassLabel(n, lang)` (nackte Klasse "Größe N"/"Size N" — keine erfundene Kategorie, siehe Entscheidung oben).
- **`src/components/ships/ShipsOverview.astro`**: neues `<select id="sf-size">` zwischen `sf-rolefam` und `sf-sig` (Optionen "Größe 1 (48)" … "Größe 6 (7)"), `data-size` auf jeder Karte, `apply()`-Zweig mit exaktem String-Vergleich, Listener-Registrierung, neuer Größen-Chip auf der Karte zusätzlich zu Rolle und Wiki-Größe, sowie eine erklärende Zeile über der Filterkonsole in DE und EN ("Die Größenklasse … bestimmt, auf welchen Landeplatz bzw. in welchen Hangar das Schiff passt").
- **`scripts/verify-vehicle-roles.mjs`**: zwei neue Prüfabschnitte — M) sechs Größenklassen müssen exakt 48/82/38/22/26/7 tragen (jedes gejointe Fahrzeug muss eine Größe haben), N) SubType-Stand 196/27 informativ geprüft (ausdrücklich nicht das Bodenfahrzeug-Merkmal). Belegpflicht-Check (Abschnitt L) um beide neuen Achsen erweitert.

## Die Abbruchbedingung (Task 2) — bewusst NICHT umgestellt

Gemessen: `AttachDef.SubType` liefert 27 Bodenfahrzeuge, das bestehende Merkmal (`isGravlevVehicle`/`movementClass`) liefert 37. Die Differenzmenge, namentlich:

`drak-dragonfly`, `drak-dragonfly-yellow`, `cnou-hoverquad`, `xian-nox`, `xian-nox-kue`, `mrai-pulse`, `mrai-pulse-lx`, `orig-x1`, `orig-x1-force`, `orig-x1-velocity`

Alle zehn sind Schweberäder (Hoverbikes/Hoverquads). CIG führt sie intern als `Vehicle_Spaceship`, obwohl sie Bodenfahrzeuge sind — genau der Fund, den das PLAN.md vorab benannt hatte. Ein Nutzer, der "Bodenfahrzeug" filtert, erwartet Nox und Dragonfly vermutlich in der Liste; die SubType-Antwort wäre damit die schlechtere, nicht die spielgenauere. Es gibt keine Differenz in der Gegenrichtung (jedes `SubType=Vehicle_GroundVehicle`-Fahrzeug trägt bereits das heutige Merkmal). Entscheidung: das bestehende Merkmal bleibt unverändert; `AttachDef.SubType` wird nur informativ in der Momentaufnahme mitgeführt (Belegpflicht, Abschnitt N des Wächters), steuert aber keine Oberfläche. Dieselbe Abbruchbedingung wie beim Merkmal "Bewaffnet" in Phase 6: ein Spieldatensignal ist nur dann besser, wenn es auch besser aussiebt.

## Deviations from Plan

None — Plan exakt wie geschrieben umgesetzt. Task 2 war als Prüfung mit möglichem Abbruch angelegt und wurde in genau dieser Form ausgeübt (siehe oben).

## Task Commits

1. **Task 1: Datamine um Größenklasse und SubType erweitern** — `3ecddb4` (feat)
2. **Task 2: Boden/Raum prüfen** — keine Code-Änderung (Entscheidung: nicht umstellen), Begründung in `3ecddb4`s Kopfkommentar dokumentiert und hier im SUMMARY vertieft
3. **Task 3: Filterachse `sf-size`** — `bf05687` (feat)
4. **Task 4: Wächter erweitern** — `330c29a` (test)

## Verifizierte Abnahme (gegen frisches `dist/`, beide Sprachen)

1. **Beruf=Kampf + Rolle=Bomber + Größe=2 → Eclipse**: `data-career="combat" data-rolefam=" bomber " data-size="2"` auf der Eclipse-Karte bestätigt (zusätzlich trägt Gladiator dieselbe Kombination — beide sind laut CIG Kampf-Bomber der Größe 2; der Signatur-Schnellzugriff "Tarnkappenbomber" grenzt danach auf genau 1 Treffer ein, siehe Punkt 3).
2. **Größenmenü**: sechs Optionen "Größe 1 (48)" … "Größe 6 (7)" (DE) bzw. "Size 1 (48)" … "Size 6 (7)" (EN), exakt im gebauten HTML geprüft.
3. **Sieben Schnellzugriffe unverändert**: Tarnkappenbomber 1, Frachter mit gesenkter Signatur 1, Bergbau 5, Bergung 6, Betankung 3, Abriegelung 5, Rennen 17 — gegen die Momentaufnahme nachgerechnet, alle sieben Zahlen stimmen.
4. **`npm.cmd run build`**: 17365 Seiten, keine Fehler. **`npm.cmd run verify:vehicle-roles`**: 0 Fehlschläge, Join-Rate 223/227.
5. **Keine englische Beschriftung auf der deutschen Seite**: alle `aria-label`-Werte und die neue Erklärzeile im gebauten `de/schiffe.html` geprüft — durchgängig Deutsch.
6. **Ohne JavaScript**: 227 `.fcard`-Elemente im gebauten HTML gezählt (EN wie DE) — alle Karten serverseitig gerendert, unabhängig vom neuen Filter.

## Known Stubs

Keine.

## Threat Flags

Keine neue Oberfläche — die neuen Felder (`size`, `subType`) sind reine Zahlen/Enum-Strings aus derselben committeten, vertrauenswürdigen Momentaufnahme wie die bestehenden Rollen-Achsen; kein neuer Endpunkt, kein neuer Eingabepfad.

## Self-Check: PASSED

- FOUND: scripts/datamine-vehicle-roles.mjs (size/subType-Extraktion, SOURCES-Einträge)
- FOUND: src/data/vehicle-roles.json (223 Einträge mit size/subType, neu erzeugt)
- FOUND: src/i18n/vehicleText.ts (vSizeClass, sizeClassLabel)
- FOUND: src/components/ships/ShipsOverview.astro (sf-size, data-size, Erklärzeile, Chip)
- FOUND: scripts/verify-vehicle-roles.mjs (Abschnitte M, N)
- FOUND: Commit 3ecddb4 (Task 1) in git log
- FOUND: Commit bf05687 (Task 3) in git log
- FOUND: Commit 330c29a (Task 4) in git log
- FOUND: `npm.cmd run build` erfolgreich (17365 Seiten), `npm.cmd run verify:vehicle-roles` grün
