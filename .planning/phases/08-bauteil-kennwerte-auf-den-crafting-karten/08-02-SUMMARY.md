---
phase: 08-bauteil-kennwerte-auf-den-crafting-karten
plan: 02
subsystem: ui
tags: [astro, crafting-db, data-join, e2e-test]

requires:
  - phase: 08-bauteil-kennwerte-auf-den-crafting-karten (Plan 01)
    provides: "blueprintSpecs(), COLLIDING_NAMES, ul.cbp__spec-Markup, Testinfrastruktur, Dauergatter"
provides:
  - "blueprintSpecs() vollstaendig — Ton-Zweig aus dem Kategorie-Pfad fuer die 96 Schiffswaffen (D-04)"
  - "SPEC_ROLLOUT-Sperre entfernt — jeder der 1594 Blueprints durchlaeuft blueprintSpecs()"
  - "tests/e2e/crafting-specs.test.js — Gesamtzahlen-Nachweis am gebauten dist/, DE+EN, 39 Subtests"
  - "scripts/verify-crafting-specs.mjs um 3 Pruefbloecke erweitert (Schiffswaffen-Ton, Gesamtabdeckung, Wertebereich Ton)"
  - "gemessenes Seitengewicht nach der vollen Ausrollung (roh+gzip, DE+EN), unter dem Deckel"
affects: [08-03]

tech-stack:
  added: []
  patterns:
    - "Ton-Fallback ueber das dritte Segment des BLUEPRINT-Kategorie-Strings, nur wenn game.class leer UND Kategorie mit Vehiclegear/Weapons beginnt — Armour/Ammo bleiben unberuehrt, weil ihre Kategorie-Wurzel nicht Vehiclegear ist"
    - "Gatter-Spiegelung aus Plan 08-01 fortgeschrieben: toneFromWeaponCategoryPath() ist in src/lib/crafting.ts und scripts/verify-crafting-specs.mjs Zeile fuer Zeile identisch"

key-files:
  created: []
  modified:
    - src/lib/crafting.ts
    - src/components/CraftingApp.astro
    - tests/e2e/crafting-specs.test.js
    - scripts/verify-crafting-specs.mjs

key-decisions:
  - "toneFromWeaponCategoryPath() als eigene, benannte Funktion statt Inline-Logik in blueprintSpecs() — dieselbe Funktion wird 1:1 in scripts/verify-crafting-specs.mjs gespiegelt, eine benannte Funktion macht die Deckungsgleichheit einfacher pruefbar als verstreute Inline-Bedingungen"
  - "Referenzkarten in tests/e2e/crafting-specs.test.js ERGAENZT statt ersetzt — die 5 Karten aus Plan 08-01 (Allegro/Atlas/Hemera/Erebos/Drift) bleiben Teil der Liste, die 6 neuen (Lotus/Cassandra/Cirrus/AD4B Ballistic Gatling/9-Series Longsword Cannon/Agure) kommen dazu"
  - "Kein neuer Pruefblock fuer size/grade-Einzelzahlen im e2e-Test — 1513/1513 sind bereits Teil von npm run verify:crafting (Pruefblock 8); der e2e-Test deckt die HTML-sichtbaren Zaehlgroessen ab (1514 Chip-Reihen, 496 Ton-Chips), die per Grep direkt aus dist/ ablesbar sind"

requirements-completed: [CRAFT-01, CRAFT-02, CRAFT-03]

coverage:
  - id: D1
    description: "Alle 1594 Blueprint-Karten durchlaufen blueprintSpecs() ohne Ausrollsperre; 1514 Karten zeigen mindestens einen Chip, 1513 Groesse, 1513 Grade, DE und EN identisch"
    requirement: CRAFT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/crafting-specs.test.js#die Seite enthaelt genau 1514 Chip-Reihen (volle Ausrollung), (EN)+(DE)"
        status: pass
      - kind: unit
        ref: "npm run verify:crafting — Pruefblock 8 (Gesamtabdeckung nach der Sperre)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Die 96 Schiffswaffen zeigen ihren Ton aus dem dritten Kategorie-Segment des Blueprints, nicht aus game.class (das dort leer ist)"
    requirement: CRAFT-02
    verification:
      - kind: e2e
        ref: "tests/e2e/crafting-specs.test.js#AD4B Ballistic Gatling / 9-Series Longsword Cannon traegt Groesse …, Ton Ballistic"
        status: pass
      - kind: unit
        ref: "npm run verify:crafting — Pruefblock 7 (Schiffswaffen-Ton aus dem Kategorie-Pfad, 96/96, 0 Abweichungen)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ruestung (913) und Munition (36) tragen null Ton-Chips, je Kartenausschnitt geprueft — kein leerer Chip irgendwo auf der Seite"
    requirement: CRAFT-03
    verification:
      - kind: e2e
        ref: "tests/e2e/crafting-specs.test.js#keine Armour-Karte / keine Ammo-Karte traegt einen Ton-Chip + kein Chip … ist leer"
        status: pass
      - kind: unit
        ref: "npm run verify:crafting — Pruefblock 5 (Ruestung ohne Ton, 913/0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Die 10 Karten der 5 gesperrten Namensgruppen (BroadSpec, Main Powerplant) bleiben nach dem vollen Ausrollen chiplos, auch dort wo sie ohne Sperre erstmals Chips bekaemen (Powerplant/Radar)"
    requirement: CRAFT-03
    verification:
      - kind: e2e
        ref: "tests/e2e/crafting-specs.test.js#beide Karten \"BroadSpec\"/\"Main Powerplant\" (gesperrte Namensgruppe, D-09) bleiben chiplos"
        status: pass
      - kind: unit
        ref: "npm run verify:crafting — Pruefblock 3 (unveraendert aus Plan 08-01, weiterhin 5/10/0 Abweichungen)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Seitengewicht nach der vollen Ausrollung gemessen (roh+gzip, DE+EN) und unter dem Deckel von 110 KB roh / 15 KB gzip Zuwachs je Sprachseite"
    requirement: CRAFT-01
    verification:
      - kind: other
        ref: "node -e mit fs.statSync + zlib.gzipSync gegen dist/topics/crafting.html und dist/de/topics/crafting.html nach dem Build; Deltas gegen die 08-01-Grundlinie in dieser SUMMARY"
        status: pass
    human_judgment: false

duration: ~16min
completed: 2026-08-07
status: complete
---

# Phase 8 Plan 2: Vollausrollung der Bauteil-Kennwerte Summary

**Alle 1594 Blueprint-Karten der Crafting-Datenbank tragen jetzt Groesse/Grade/Ton wo
die Angabe vorliegt (1514 Karten, 496 davon mit Ton), inklusive der 96 Schiffswaffen,
deren Ton `game.class` nicht kennt und deshalb aus dem dritten Kategorie-Segment
(`Vehiclegear / Weapons / Ballistic / Cannon` → Ballistic) gelesen wird — bei einem
gemessenen Seitengewichtszuwachs von ~95 KB roh / ~4 KB gzip je Sprachseite, weit
unter dem Deckel von 110 KB / 15 KB.**

## Performance

- **Duration:** ~16 min (erster Task-Commit 00:32:16 Uhr, letzter Commit 00:36:59 Uhr,
  zzgl. Lese- und Messphase davor)
- **Tasks:** 2/2
- **Files modified:** 4 (alle bereits aus Plan 08-01 vorhanden, keine Neuanlage)

## Accomplishments

- `toneFromWeaponCategoryPath()` + erweiterter Ton-Zweig in `blueprintSpecs()`
  (`src/lib/crafting.ts`): liest bei leerem `game.class` und Kategorie-Praefix
  `Vehiclegear / Weapons` das dritte Pfadsegment als Ton — trifft genau und
  ausschliesslich die 96 Schiffswaffen, Armour/Ammo bleiben unberuehrt
- `SPEC_ROLLOUT`-Konstante samt Bedingung aus `CraftingApp.astro` entfernt —
  `blueprintSpecs(b)` gilt jetzt fuer jeden der 1594 Blueprints, ein Koerper fuer DE+EN
- `tests/e2e/crafting-specs.test.js` auf die Gesamtzahlen umgestellt: 39 Subtests
  (vorher 16), 11 Referenzkarten, gesperrte Namensgruppen je Kartenausschnitt,
  Armour/Ammo-Gegenprobe je Kartenausschnitt, leere-Chip-Pruefung, DE/EN-Gleichstand
- `scripts/verify-crafting-specs.mjs` um 3 Pruefbloecke erweitert (7: Schiffswaffen-Ton,
  8: Gesamtabdeckung nach der Sperre, 9: Wertebereich Ton) — die 6 Bloecke aus Plan
  08-01 bleiben unveraendert bestehen und liefern weiterhin dieselben Zahlen
- Seitengewicht vorher/nachher gemessen (roh+gzip, DE+EN) — Zuwachs weit unter dem
  Deckel, siehe Tabelle unten

## Task Commits

Each task was committed atomically:

1. **Aufgabe 1: Alle Karten tragen ihre Kennwerte — Ausrollsperre raus, Schiffswaffen-Ton rein** - `2a900f3` (feat)
2. **Aufgabe 2: Seitengewicht belegen und das Dauergatter auf die volle Ausrollung heben** - `2da93e2` (test)

## Files Created/Modified

- `src/lib/crafting.ts` - `toneFromWeaponCategoryPath()` neu, `blueprintSpecs()` um Ton-Fallback ergaenzt
- `src/components/CraftingApp.astro` - `SPEC_ROLLOUT`-Konstante und ihre Bedingung entfernt, Kommentar am Chip-Markup aktualisiert
- `tests/e2e/crafting-specs.test.js` - auf Gesamtzahlen umgestellt, 6 neue Referenzkarten, gesperrte Gruppen/Armour/Ammo/Leerchip-Tests, DE/EN-Gleichstandstest
- `scripts/verify-crafting-specs.mjs` - `toneFromWeaponCategoryPath()`-Spiegel + 3 neue Pruefbloecke (7/8/9)

## Acceptance-Kriterien — tatsaechlich ausgefuehrt, keine Behauptungen

**Aufgabe 1:**
- `npm run build` → Exit 0 (17365 Seiten gebaut, 155,76 s)
- `node --test tests/e2e/crafting-specs.test.js` → Exit 0, **39/39 Tests bestanden** (vorher 16)
- `class="cbp__spec"` in `dist/topics/crafting.html` **und** `dist/de/topics/crafting.html`: je **1514**
- `class="tone"` in beiden Seiten: je **496**
- `AD4B Ballistic Gatling`: `S4` / `A` / `Ballistic` (in beiden Sprachen) — Ton kommt aus dem Kategorie-Pfad, `game.class` ist bei diesem Item leer
- `Agure`: Groessen-Chip `S0` (in beiden Sprachen) — belegt, dass Groesse 0 ein echter Wert ist
- `BroadSpec` (2×) und `Main Powerplant` (2×): keine der je 2 Karten traegt eine Chip-Reihe, in beiden Sprachen, je Kartenausschnitt geprueft
- Keine der 913 Armour-Karten und keine der 36 Ammo-Karten traegt einen Ton-Chip, je Kartenausschnitt geprueft, in beiden Sprachen
- `grep -c "SPEC_ROLLOUT" src/components/CraftingApp.astro` → **0**
- DE und EN liefern identische Werte fuer alle drei Zaehlpruefungen (1514 Chip-Reihen, 496 Ton-Chips, 0 Armour-/Ammo-Ton — separat mit `strictEqual` verglichen, nicht nur behauptet)

**Aufgabe 2:**
- `npm run verify:crafting` → Exit 0. Ausgabe nennt **96 gepruefte Schiffswaffen, 0 Abweichungen** (Pruefblock 7)
- Ausgabe nennt **1513 / 1513 / 496 / 1514** als gemessene Abdeckung und **80** Karten ohne jede Angabe (Pruefblock 8, wortgleich mit der Planzahl); Selbstkonsistenz 1514 + 80 = 1594 haelt (im Skript als eigener `need()`-Check)
- Kollisionspruefung (Pruefblock 3, unveraendert aus 08-01): weiterhin **5 gesperrte Gruppen, 10 Karten, 0 Abweichungen**
- `npm run audit:site` → Exit 0 (0 FEHLER, 4 WARNUNGEN — alle 4 vorbestehend und diese Phase betreffend nicht: fehlendes `<h1>` auf `/account.html`, `/de/account.html`, `/pilot.html`, `/de/pilot.html`)
- `npm run verify` → Exit 0 (816195 lokale Referenzen geprueft, alle aufgeloest)
- Rohzuwachs `dist/topics/crafting.html` (EN): **97466 Bytes** (~95,2 KB), unter dem 110-KB-Deckel
- Rohzuwachs `dist/de/topics/crafting.html` (DE): **97466 Bytes** (~95,2 KB), unter dem 110-KB-Deckel
- gzip-Zuwachs EN: **4086 Bytes** (~4,0 KB), gzip-Zuwachs DE: **4058 Bytes** (~3,96 KB) — beide unter dem 15-KB-Deckel
- INFO-Zeile „Schwere Seiten" (`npm run audit:site`), woertlich fuer beide Crafting-Seiten:
  - `/de/topics/crafting.html: 911 KB HTML`
  - `/topics/crafting.html: 912 KB HTML`

## Vier Rollout-Zahlen (wie tatsaechlich gebaut, gegen die Plan-Zielzahlen)

| Kennzahl | Ziel laut Plan | gemessen (dist/, beide Sprachen identisch) |
|---|---|---|
| Chip-Reihen (`cbp__spec`) | 1514 | **1514** |
| Karten mit Groesse | 1513 | **1513** |
| Karten mit Grade | 1513 | **1513** |
| Karten mit Ton | 496 (400 `game.class` + 96 Pfad) | **496** (400 + 96) |
| Karten ohne jede Angabe | 80 | **80** |

Selbstkonsistenz: 1514 + 80 = 1594 — **haelt**, exakt die Gesamtzahl der Blueprints.

Ton-Verteilung (gemessen, identisch zur Planzahl): Ballistic 119, Civilian 115,
Military 73, Industrial 64, Laser 47, Stealth 32, Competition 29, Electron 9,
Distortion 8. Groessen-Verteilung: S0 25, S1 1069, S2 199, S3 170, S4 32, S5 9, S6 8,
S7 1. Grade-Verteilung: A 1265, B 94, C 91, D 63. Alle Werte per direktem Nachrechnen
gegen `assets/crafting-db.json` + `assets/universal-items.json` erhoben (`node -e`),
bevor die Testdatei geschrieben wurde — keine der Zahlen wurde nur aus dem Plan
uebernommen, ohne sie am Bestand nachzupruefen.

## Seitengewicht — vorher/nachher, roh und gzip, DE und EN

| Datei | Grundlinie (08-01, roh) | Nachher (roh) | Delta roh | Grundlinie (gzip) | Nachher (gzip) | Delta gzip |
|---|---|---|---|---|---|---|
| `dist/topics/crafting.html` (EN) | 835973 | 933439 | **+97466** | 65614 | 69700 | **+4086** |
| `dist/de/topics/crafting.html` (DE) | 835024 | 932490 | **+97466** | 65940 | 69998 | **+4058** |

Deckel: < 110 KB (112640 B) roh, < 15 KB (15360 B) gzip je Sprachseite. Beide Werte
liegen deutlich darunter (~95,2 KB roh, ~4 KB gzip) — die Chip-Reihen sind stark
repetitiv (kurze Klassennamen, wenige verschiedene Ton-Woerter) und komprimieren
entsprechend gut; der gzip-Zuwachs liegt bei nur ~4 % des Roh-Zuwachses.

## Decisions Made

- **`toneFromWeaponCategoryPath()` als eigene Funktion** statt Inline-Bedingung in
  `blueprintSpecs()`: macht die Zeile-fuer-Zeile-Spiegelung in
  `scripts/verify-crafting-specs.mjs` direkt vergleichbar (gleicher Funktionsname,
  gleicher Koerper) — Abweichungen zwischen echter Logik und Gatter-Spiegel fallen
  damit beim Diff sofort auf.
- **Referenzkarten ergaenzt, nicht ersetzt:** die 5 Karten aus Plan 08-01 bleiben im
  Test, die 6 neuen Referenzkarten (inkl. der beiden Schiffswaffen-Belege und Agure
  als S0-Beleg) kommen dazu — der Test deckt damit weiterhin den in 08-01 bewiesenen
  Pfad UND den neuen Ton-Zweig ab.
- **`hasGradeSemantics()` unveraendert gelassen:** die Root-Kategorie-Pruefung
  (`Vehiclegear|Weapons|Armour|Attachment`) galt schon vorher fuer Schiffswaffen (95
  von 96 hatten bereits Groesse/Grade in der Coverage-Tabelle der Erkundung) — nur der
  Ton-Pfad war die Luecke, kein Aenderungsbedarf an der bestehenden Semantik-Sperre.

## Deviations from Plan

### Beobachtung, kein Auto-Fix noetig

**1. „Provenienz-Block" in `scripts/audit-site.mjs` existiert nicht als benannter
Abschnitt** — der Plan verweist auf „Zeile 415–420 und 481: … der Provenienz-Block,
der als FEHLER greift". Das aktuelle Skript (486 Zeilen) hat an dieser Stelle die
Seitengewichts-Erhebung (bestaetigt, siehe oben) sowie die generischen Pruefungen
„FEHLER Platzhalter im HTML" und „FEHLER Mojibake/Encoding" — eine eigens benannte
Data.p4k/DataCore/scmdb/„datamined"-Pruefung mit diesem Namen findet sich im Skript
nicht (`grep -in "p4k|datacore|scmdb|datamin|provenance|herkunft" scripts/audit-site.mjs`
→ 0 Treffer). Das ist keine Regression dieses Plans: `npm run audit:site` lief mit
Exit 0 und 0 FEHLER; zusaetzlich wurde `dist/topics/crafting.html` und
`dist/de/topics/crafting.html` direkt per Grep auf die vier verbotenen Begriffe
geprueft (`grep -io "data\.p4k|datacore|scmdb|datamined" …` → 0 Treffer, Exit 1 des
Greps). D-08 ist damit auch ohne einen eigens benannten Block erfuellt — die
Chip-Texte (Groessen-Zahl, Grade-Buchstabe, Ton-Wort) enthalten ohnehin keine
Herkunftsbegriffe. Kein Fix noetig, nur zur Transparenz dokumentiert, weil der Plan
einen konkreten Blocknamen erwartete, den das Skript so nicht fuehrt.

---

**Total deviations:** 1 (Beobachtung ohne Handlungsbedarf, kein Auto-Fix)
**Impact on plan:** Keine Scope-Aenderung, keine Codeaenderung noetig — die vom Plan
verlangte Garantie (kein Provenienz-Text im UI) ist erfuellt, nur der Nachweisweg
unterscheidet sich vom im Plan angenommenen Blocknamen.

## Issues Encountered

Keine. Alle Automatikpruefungen (Build, e2e-Test, `verify:crafting`, `audit:site`,
`verify`, Seitengewicht) liefen tatsaechlich und lieferten exakt die vom Plan
vorhergesagten Zahlen — keine wurde nur behauptet.

## Mirror-Konsistenz

`toneFromWeaponCategoryPath()` und `blueprintSpecs()` in
`scripts/verify-crafting-specs.mjs` sind nach dieser Aenderung weiterhin Zeile fuer
Zeile deckungsgleich mit `src/lib/crafting.ts` (per `grep -A8` gegeneinander gestellt,
siehe Task-2-Verifikation) — die Spiegel-Pflicht aus den `wave_1_facts` ist erfuellt,
das Gatter prueft nicht seine eigene, stillschweigend veraltete Kopie.

## Next Phase Readiness

- Die volle Ausrollung ist bewiesen, gemessen und dauerhaft gegattert: 1514 Karten mit
  mindestens einer Angabe, 496 mit Ton, 0 bei Ruestung/Munition, 10 gesperrte Karten
  bleiben chiplos, DE/EN identisch, Seitengewicht weit unter dem Deckel.
- Plan 08-03 (laut `affects`) kann auf `blueprintSpecs()` als stabile, vollstaendige
  Quelle aufbauen — Groesse/Grade als Filter (Claude's Discretion aus 08-CONTEXT.md)
  ist noch offen, sofern in einem folgenden Plan gewuenscht.
- Keine Blocker.

---
*Phase: 08-bauteil-kennwerte-auf-den-crafting-karten*
*Completed: 2026-08-07*

## Self-Check: PASSED

Alle 4 modifizierten Dateien vorhanden (`src/lib/crafting.ts`,
`src/components/CraftingApp.astro`, `tests/e2e/crafting-specs.test.js`,
`scripts/verify-crafting-specs.mjs`), diese SUMMARY.md vorhanden, beide
Task-Commits (`2a900f3`, `2da93e2`) im Git-Log gefunden.
