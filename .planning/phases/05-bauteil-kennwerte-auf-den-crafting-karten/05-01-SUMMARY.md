---
phase: 05-bauteil-kennwerte-auf-den-crafting-karten
plan: 01
subsystem: ui
tags: [astro, crafting-db, data-join, e2e-test]

requires: []
provides:
  - "blueprintSpecs() in src/lib/crafting.ts — einzige Quelle fuer Groesse/Grade/Ton eines Blueprints"
  - "COLLIDING_NAMES — aus den Daten abgeleitete Sperre kollidierender Namensgruppen (D-09)"
  - "ul.cbp__spec Chip-Reihe auf den 57 Quantumdrive-Karten in CraftingApp.astro (DE+EN, ein Koerper)"
  - "tests/e2e/crafting-specs.test.js — dist-Nachweis der Referenzkarten"
  - "scripts/verify-crafting-specs.mjs (npm run verify:crafting) — Dauergatter fuer die 15 Namensgruppen"
  - "gemessene Seitengewicht-Grundlinie (roh+gzip, DE+EN) fuer Plan 05-02"
affects: [05-02-ausrollen-auf-alle-karten, 05-03]

tech-stack:
  added: []
  patterns:
    - "Datengetriebene Sperrliste statt Handliste: COLLIDING_NAMES wird bei jedem Build aus item_stats-Signaturen abgeleitet"
    - "Verify-Skripte, die .ts-Quellcode nicht importieren koennen (extensionlose relative Importe unter blossem Node), spiegeln die Logik explizit gekennzeichnet"

key-files:
  created:
    - tests/e2e/crafting-specs.test.js
    - scripts/verify-crafting-specs.mjs
  modified:
    - src/lib/crafting.ts
    - src/components/CraftingApp.astro
    - package.json

key-decisions:
  - "Kollisionsvergleich auf dem GESAMTEN item_stats-Objekt (schluesselsortiert, rekursiv serialisiert), nicht nur mass_kg/overheat_temperature — 3 der 5 Kollisionen teilen identisches overheat_temperature"
  - "CSS-Fallbacks fuer neue Tokens (--text, --veil, --line-soft, --accent-2) bewusst OHNE Hex-Fallback geschrieben, um die Acceptance-Criteria-Grep-Pruefung auf neue Farbliterale exakt zu erfuellen"
  - "verify-crafting-specs.mjs spiegelt blueprintSpecs()/COLLIDING_NAMES/hasGradeSemantics statt sie zu importieren — Node's natives TS-Stripping loest extensionlose relative Importe (./items, ../i18n/ui) nicht auf, gemessen mit einem direkten import()-Versuch"

requirements-completed: [CRAFT-01, CRAFT-02, CRAFT-03]

coverage:
  - id: D1
    description: "57 Quantumdrive-Karten tragen Groesse/Grade/Ton als Chips, DE und EN, aus EINEM Koerper gerendert"
    requirement: CRAFT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/crafting-specs.test.js#Crafting-Karten Groesse/Grade/Ton (EN) + (DE), alle 8 Subtests"
        status: pass
    human_judgment: false
  - id: D2
    description: "Frontline zeigt Groesse+Grade ohne Ton-Chip statt eines geratenen/leeren Werts"
    requirement: CRAFT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/crafting-specs.test.js#Frontline traegt Groesse und Grade, aber keinen Ton-Chip"
        status: pass
    human_judgment: false
  - id: D3
    description: "Die 5 kollidierenden Namensgruppen (10 Karten) bleiben chiplos; die Sperre ist aus den Daten abgeleitet, nicht handverdrahtet"
    requirement: CRAFT-03
    verification:
      - kind: unit
        ref: "npm run verify:crafting — Pruefblock 3 (15 Namensgruppen, item_stats-Diskriminante)"
        status: pass
      - kind: other
        ref: "Gegentest: Sperre in scripts/verify-crafting-specs.mjs versuchsweise ausgehaengt -> Exit 1, alle 10 Karten genannt; danach zurueckgenommen"
        status: pass
    human_judgment: false
  - id: D4
    description: "Seitengewicht-Grundlinie (roh+gzip, DE+EN) gemessen und dokumentiert fuer Plan 05-02"
    requirement: CRAFT-01
    verification:
      - kind: other
        ref: "node -e mit fs.statSync + zlib.gzipSync gegen dist/topics/crafting.html und dist/de/topics/crafting.html, vor jeder Aenderung ausgefuehrt"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-08-07
status: complete
---

# Phase 5 Plan 1: Quantumdrive-Kennwerte (Tracer) Summary

**57 Quantumdrive-Karten tragen jetzt Groesse-, Grade- und Ton-Chips in DE und EN,
`blueprintSpecs()` als einzige Datenquelle mit datengetriebener Kollisionssperre fuer
die 15 gleichnamigen Blueprints, plus ein Dauergatter (`npm run verify:crafting`),
das nachweislich fehlschlagen kann.**

## Performance

- **Duration:** ~26 min (erste Baseline-Messung ca. 23:53 Uhr, letzter Commit 00:18:58 Uhr)
- **Tasks:** 2/2
- **Files modified:** 5 (2 neu, 3 geaendert)

## Accomplishments

- `blueprintSpecs()` + `BlueprintSpecs`-Interface + `COLLIDING_NAMES` in `src/lib/crafting.ts`: die einzige Quelle fuer Groesse/Grade/Ton, mit einer bei jedem Build aus den Daten abgeleiteten Sperre kollidierender Namensgruppen
- `ul.cbp__spec`-Chip-Reihe auf den Quantumdrive-Karten in `CraftingApp.astro` (ein Koerper fuer DE+EN), hinter der Ausrollsperre `SPEC_ROLLOUT` (nur diese eine Kategorie, entfernt in Plan 05-02)
- `tests/e2e/crafting-specs.test.js`: 16 Subtests gegen das gebaute `dist/`, DE und EN, inkl. Referenzkarten und der 57er-Zaehlung
- `scripts/verify-crafting-specs.mjs` (`npm run verify:crafting`): Dauergatter mit 6 Pruefbloecken; der Gegentest belegt, dass Pruefblock 3 tatsaechlich fehlschlagen kann

## Task Commits

Each task was committed atomically:

1. **Aufgabe 1: Quantumdrive-Karten tragen Groesse, Grade und Ton — durchgehend bis ins gebaute HTML** - `be0ab67` (feat)
2. **Aufgabe 2: Datengatter — die 15 gleichnamigen Blueprints und die Wertebereiche maschinell absichern** - `1e54256` (test)

## Files Created/Modified

- `src/lib/crafting.ts` - `BlueprintSpecs`, `blueprintSpecs()`, `COLLIDING_NAMES`, `stableStringify()` ergaenzt
- `src/components/CraftingApp.astro` - Import von `blueprintSpecs`, `SPEC_ROLLOUT`-Konstante, `sp`-Feld in `cardsData`, Chip-Markup nach `.cbp__meta`, CSS-Regeln fuer `.cbp__spec`
- `tests/e2e/crafting-specs.test.js` - neu; prueft dist/topics/crafting.html und dist/de/topics/crafting.html
- `scripts/verify-crafting-specs.mjs` - neu; Datengatter mit gespiegelter Logik
- `package.json` - `verify:crafting`-Skripteintrag ergaenzt

## Gemessene Grundlinie des Seitengewichts (vor jeder Aenderung dieses Plans)

| Datei | Roh (Bytes) | gzip (Bytes) |
|---|---|---|
| `dist/topics/crafting.html` (EN) | 835973 | 65614 |
| `dist/de/topics/crafting.html` (DE) | 835024 | 65940 |

Nach diesem Plan (57 Chip-Reihen, nur Anzeige, kein zusaetzliches Item-Objekt):

| Datei | Roh (Bytes) | gzip (Bytes) | Delta roh | Delta gzip |
|---|---|---|---|---|
| `dist/topics/crafting.html` (EN) | 844344 | 66630 | +8371 | +1016 |
| `dist/de/topics/crafting.html` (DE) | 843395 | 66955 | +8371 | +1015 |

Rechnerisch ~147 Bytes roh / ~18 Bytes gzip je Chip-Reihe (57 Reihen). Plan 05-02 skaliert
das auf bis zu 1513 weitere Karten (alle ausser den 57 Quantumdrives und den 81 chiplosen:
14 ohne Item-Treffer, 10 in gesperrten Gruppen, Rest ohne jede der drei Angaben) — die
Grundlinie und dieser Faktor sind die Rechenbasis dafuer.

## Decisions Made

- **Kollisionsvergleich auf dem gesamten `item_stats`-Objekt**, nicht nur `mass_kg`/`overheat_temperature`: eine Selbstprobe im Gatter zeigt, dass ein Vergleich, der nur `overheat_temperature` heranzieht, nur 2 von 5 Gruppen faende (stellate/serac/antium core jet teilen denselben Wert).
- **CSS-Tokens ohne Hex-Fallback** (`var(--text)` statt `var(--text,#eef1f5)`) für die drei neuen Regeln, um die Acceptance-Criteria-Pruefung `git diff … enthaelt kein neues Farbliteral` exakt zu erfuellen — der Rest der Datei nutzt weiterhin Hex-Fallbacks nach altem Muster, das war nicht Teil dieses Plans zu aendern.
- **Gatter-Skript spiegelt statt zu importieren**: ein direkter `import()` von `src/lib/crafting.ts` unter blossem `node` (ohne Astro/Vite) scheitert mit `Cannot find module './items'`, weil Node's natives TS-Stripping die Typen aus der angefragten Datei entfernt, aber deren extensionlose relative Importe nicht aufloest. Gemessen vor der Entscheidung (siehe Deviations). Die Spiegelung ist im Skriptkopf begruendet und Zeile-fuer-Zeile deckungsgleich mit der echten Logik.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, mit dokumentierter Alternative] Node kann `src/lib/crafting.ts` nicht direkt importieren**
- **Found during:** Aufgabe 2 (Datengatter)
- **Issue:** Der Plan sah als bevorzugten Weg vor, `blueprints`/`blueprintSpecs` direkt aus `src/lib/crafting.ts` zu importieren, mit einer explizit erlaubten Ausweichoption ("Laeuft der Import einer .ts-Datei unter blossem Node nicht, die Regeln stattdessen in einer klar als Spiegel gekennzeichneten Funktion nachbilden"). Getestet: `node -e "import('./src/lib/crafting.ts')…"` scheitert mit `Cannot find module '…/src/lib/items' imported from …/crafting.ts` — Node's native TypeScript-Unterstuetzung entfernt Typen nur aus der direkt angefragten Datei, loest aber ihre eigenen extensionlosen relativen Importe nicht auf.
- **Fix:** `scripts/verify-crafting-specs.mjs` bildet `stableStringify`, `COLLIDING_NAMES`, `hasGradeSemantics` und `blueprintSpecs` als klar gekennzeichnete Spiegel-Funktionen nach (Kopfkommentar erklaert Grund und Konsequenz: Pruefblock 3 vergleicht bewusst gegen eine unabhaengig berechnete Diskriminante, nicht gegen das Ergebnis der gespiegelten Funktion selbst, um keine Tautologie zu pruefen).
- **Files modified:** `scripts/verify-crafting-specs.mjs`
- **Verification:** Alle sechs Pruefbloecke liefern die im Plan vorgegebenen Zahlen; der Blocker-Gegentest (Sperre versuchsweise ausgehaengt) und der Verfaelschungs-Gegentest (Allegro auf Grade B gesetzt) enden beide mit Exit 1 und wurden danach zurueckgenommen.
- **Committed in:** `1e54256` (Task-2-Commit)

**2. [Rule 1 - Bug, waehrend der eigenen Implementierung gefunden und vor Commit behoben] CSS-Fallback-Hexwerte haetten das Farbliteral-Acceptance-Criterion verletzt**
- **Found during:** Aufgabe 1, vor dem ersten Commit
- **Issue:** Die erste Fassung der neuen `.cbp__spec`-Regeln kopierte das bestehende Muster `var(--text,#eef1f5)` / `var(--accent-2,#1FA2FF)` von `.cbp__res li`. Das erfuellt zwar den Geist der Vorgabe (nur vorhandene Tokens, keine neue Farbe), verletzt aber den woertlichen Acceptance-Criterion-Grep `git diff … enthaelt kein neues Farbliteral der Form # plus sechs Hex-Ziffern`, weil die Fallback-Hexwerte als neue Zeilen im Diff erscheinen.
- **Fix:** Fallback-Hexwerte aus den drei neuen CSS-Regeln entfernt, nur `var(--token)` ohne Fallback. Die Variablen sind in `assets/theme.css` global definiert und werden auf der Seite ueberall verwendet — ein fehlender Fallback ist zur Laufzeit unschaedlich.
- **Files modified:** `src/components/CraftingApp.astro`
- **Verification:** `git diff src/components/CraftingApp.astro | grep -E '^\+.*#[0-9a-fA-F]{6}'` liefert 0 Treffer; `npm run build` weiterhin Exit 0, Karten optisch unveraendert (Chip-Optik identisch zu `.cbp__res`).
- **Committed in:** `be0ab67` (Task-1-Commit)

---

**Total deviations:** 2 (1 dokumentierte Umsetzungs-Alternative laut Plan-Vorgabe, 1 Selbstkorrektur vor Commit)
**Impact on plan:** Keine Scope-Aenderung. Beide Punkte waren im Plan selbst als moegliche Situationen antizipiert bzw. betreffen nur die Erfuellung eines woertlichen Acceptance-Criteria.

## Tracer-Feedback-Gate (Hinweis, kein Auto-Fix)

Aufgabe 1 ist als `type="tracer"` markiert. Das Protokoll sieht bei einem *interaktiven*
Lauf einen Checkpoint direkt nach dem Tracer-Commit vor, bevor Aufgabe 2 beginnt. Dieser
Plan trägt `autonomous: true` in der Frontmatter, die Sitzung lief mit aktivem Auto-Modus
("Bias toward working without stopping"), und Aufgabe 2 ist kein Ausrollen der Karten-UI
auf weitere Kategorien, sondern das permanente Datengatter fuer denselben 57-Karten-Tracer
— keine "Expansion" im Sinne des Gates. Das Tracer-`<verify>` (`npm run build && node --test
tests/e2e/crafting-specs.test.js`) wurde vor dem Uebergang zu Aufgabe 2 tatsaechlich erneut
ausgefuehrt (Exit 0, 16/16 Tests) statt nur behauptet. Dieser Punkt wird hier transparent
gemacht, falls eine interaktive Bestaetigung dennoch gewuenscht ist.

## Issues Encountered

Keine ungeloesten Probleme. Alle im Plan vorgesehenen Automatikpruefungen liefen tatsaechlich
und lieferten die erwarteten Zahlen — keine wurde nur behauptet.

## Next Phase Readiness

- Die Chip-Kette (Daten -> `blueprintSpecs()` -> `sp`-Feld -> Markup -> CSS -> gebautes HTML)
  ist einmal vollstaendig bewiesen, in DE und EN, mit einem Dauergatter, das nachweislich
  fehlschlagen kann.
- Plan 05-02 kann `SPEC_ROLLOUT` entfernen und den Kategorie-Filter in `cardsData` auf alle
  Blueprints erweitern; die Ton-Ableitung aus dem Kategorie-Pfad fuer Schiffswaffen (D-04)
  und die Ruestungs-Sonderrolle (D-05, bereits im Gatter mit 913/0 gepruegt) folgen dort.
- Grundlinie und Delta-Faktor (oben) liegen bereit, damit Plan 05-02 gegen ein Seitengewichts-
  Budget rechnen kann.
- `COLLIDING_NAMES` und `verify:crafting` decken bereits alle 15 Namensgruppen ab — Plan 05-02
  braucht hier keine neue Logik, nur den erweiterten Rollout-Filter.

---
*Phase: 05-bauteil-kennwerte-auf-den-crafting-karten*
*Completed: 2026-08-07*
