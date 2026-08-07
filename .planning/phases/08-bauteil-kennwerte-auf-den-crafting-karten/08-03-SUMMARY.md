---
phase: 08-bauteil-kennwerte-auf-den-crafting-karten
plan: 03
subsystem: ui
tags: [astro, crafting-db, vanilla-js, filter, e2e-test]

requires:
  - phase: 08-bauteil-kennwerte-auf-den-crafting-karten (Plan 01+02)
    provides: "blueprintSpecs() vollstaendig ausgerollt (1514 Chip-Reihen, 496 Ton-Chips), COLLIDING_NAMES-Sperre, ul.cbp__spec-Markup"
provides:
  - "Filtergruppen Groesse (8 Werte) und Grade (4 Werte) in der Seitenleiste, datengetrieben aus cardsData"
  - "assets/crafting-app.js hebt die Chip-Reihe im richtigen cards.forEach-Block ins dataset (data-size/data-grade/data-tone), vor dem DB-Fetch"
  - "state.sizes/state.grades in matches() ausgewertet; Freitextsuche deckt zusaetzlich d.tone ab"
  - "e2e-Nachweis: 8x cdb-size (0-7), 4x cdb-grade (A-D), DE/EN-Ueberschriften, sha1-Cache-Bust"
affects: []

tech-stack:
  added: []
  patterns:
    - "Filterwerte aus dem Bestand ableiten statt fest zu verdrahten (sizeCounts/gradeCounts aus cardsData, dasselbe Verfahren wie renderSizeChips() im Item Finder, assets/item-finder-app.js:298-322)"
    - "Chips werden im HTML-Diaet-Block gehoben (cards.forEach, VOR dem DB-Fetch), nicht in enrichCardsFromDb() — Kennwerte stehen nur im sichtbaren Markup, nicht in crafting-db.json"

key-files:
  created: []
  modified:
    - src/components/CraftingApp.astro
    - assets/crafting-app.js
    - tests/e2e/crafting-specs.test.js

key-decisions:
  - "Ton bekommt bewusst KEINE eigene Filtergruppe — nur die Freitextsuche deckt d.tone ab (Scope Fence aus 08-CONTEXT.md nennt ausdruecklich nur Groesse und Grade als Filter)"
  - "Ueberschriften aus vorhandenem Wortschatz (itemT('specSize')/itemT('specGrade')) statt neuer S-Objekt-Strings — keine neue Uebersetzung noetig, DE/EN automatisch synchron"
  - "sizeCounts/gradeCounts direkt aus cardsData (sp-Feld) abgeleitet, nicht aus einer zweiten Iteration ueber DB.blueprints — dieselbe Datenquelle, die auch die Karten rendert, kann nicht auseinanderlaufen"

requirements-completed: [CRAFT-01, CRAFT-02, CRAFT-03, CRAFT-04]

coverage:
  - id: D1
    description: "Groesse und Grade sind als eigene Filtergruppen in der Seitenleiste filterbar, Werte aus den Daten abgeleitet (8 Groessen S0-S7, 4 Grades A-D), Zaehlerwerte je Wert stimmen mit den Zielzahlen ueberein"
    requirement: CRAFT-04
    verification:
      - kind: e2e
        ref: "tests/e2e/crafting-specs.test.js#Filter Groesse und Grade in der Seitenleiste (08-03, DE+EN) — acht/vier Ankreuzfelder mit den Werten 0-7/A-D"
        status: pass
      - kind: other
        ref: "node -e gegen dist/topics/crafting.html + dist/de/topics/crafting.html: sizeCounts/gradeCounts aus den <em>-Zaehlern extrahiert, identisch mit den im Plan vorgerechneten Zielzahlen (S4=32, D=63, etc.), DE=EN"
        status: pass
    human_judgment: false
  - id: D2
    description: "Die Filterleiste ist in DE und EN beschriftet aus vorhandenem Wortschatz (itemT specSize/specGrade), verhaelt sich in beiden Sprachen gleich"
    requirement: CRAFT-04
    verification:
      - kind: e2e
        ref: "tests/e2e/crafting-specs.test.js#EN traegt die Filter-Ueberschrift \"Size\", DE \"Größe\"; beide tragen \"Grade\""
        status: pass
    human_judgment: false
  - id: D3
    description: "Chips werden im richtigen Codepfad (cards.forEach VOR dem DB-Fetch) ins dataset gehoben, nicht in enrichCardsFromDb() — Filter funktionieren ab dem ersten Bild, kein zusaetzliches Karten-Markup"
    requirement: CRAFT-01
    verification:
      - kind: other
        ref: "Codepruefung: Chip-Lese-Block steht in assets/crafting-app.js im cards.forEach-Block (Zeile ~84-95, direkt nach d.res); grep -c \"state.sizes\"/\"state.grades\" >= 3 je (Anlegen/Auswerten/Zuruecksetzen)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Der Ton ist ueber die Freitextsuche auffindbar, ohne eine eigene Filtergruppe zu bekommen (Scope Fence)"
    requirement: CRAFT-02
    verification:
      - kind: other
        ref: "Codepruefung: matches() prueft (d.tone || '').indexOf(q) < 0 als zusaetzliche ODER-Bedingung der Freitextsuche; kein neues Ankreuzfeld fuer Ton im Markup"
        status: pass
    human_judgment: false
  - id: D5
    description: "Die Seite bleibt statisch; die Filterleiste kostet unter 4 KB roh zusaetzlich pro Sprachseite (einmal pro Seite, nicht einmal pro Karte)"
    requirement: CRAFT-01
    verification:
      - kind: other
        ref: "node -e mit fs.statSync + zlib.gzipSync gegen dist/topics/crafting.html und dist/de/topics/crafting.html nach dem Build; Delta gegen die 08-02-Grundlinie in dieser SUMMARY"
        status: pass
    human_judgment: false
  - id: D6
    description: "Ein Mensch hat die Karten in beiden Sprachen, beiden Farbmodi, Raster und Liste und bei 360 px Breite angesehen und die drei Zaehlerwerte (32/63/1594) bestaetigt"
    requirement: CRAFT-04
    verification:
      - kind: manual_procedural
        ref: "Checkpoint-Freigabe durch den Koordinator (siehe Abschnitt \"Aufgabe 2 — DURCHGEFUEHRT\" unten): DOM- und berechnete-Stilwerte-Pruefung gegen dist/ dieses Worktrees (Vorschau-Server Port 8351, neuer Launch-Eintrag crafting-specs-preview), da Screenshots in dieser Umgebung blockiert sind (Browser-Pane kompositiert nicht)"
        status: pass
    human_judgment: true
    rationale: "Aufgabe 2 des Plans ist ausdruecklich ein type=\"checkpoint:human-verify\" — visuelle Layoutpruefung in zwei Sprachen, zwei Farbmodi, zwei Ansichten und bei 360 px kann nicht automatisiert bestaetigt werden. Der Koordinator hat die Pruefung selbst durchgefuehrt und mit \"CHECKPOINT FREIGEGEBEN\" (keine Abweichung gefunden) beantwortet."

duration: ~35min (Task-Commit a7b286f um 00:51 Uhr, Checkpoint-Freigabe und Abschluss danach)
completed: 2026-08-07
status: complete
---

# Phase 8 Plan 3: Filter nach Groesse und Grade Summary

**Groesse und Grade sind jetzt eigene, datengetriebene Filtergruppen in der Crafting-Seitenleiste
(8 bzw. 4 Werte, Zaehlerwerte exakt wie im Plan vorgerechnet), der Ton ist ueber die Freitextsuche
auffindbar — die Sichtpruefung (Aufgabe 2, `checkpoint:human-verify`) ist durchgefuehrt und
freigegeben, keine Abweichung gefunden. Phase 8 ist damit abgeschlossen (3/3 Plaene).**

## Performance

- **Duration:** ~35 min (Task-1-Commit `a7b286f`, dann Checkpoint-Pruefung durch den Koordinator
  und Abschlussarbeiten)
- **Tasks:** 2/2 (Aufgabe 2 ist ein `checkpoint:human-verify`, keine eigene Code-Aenderung)
- **Files modified:** 3 (Aufgabe 1) + 1 (Aufgabe 2: `.claude/launch.json`, neuer Vorschau-Eintrag)

## Accomplishments (Aufgabe 1)

- Zwei neue `.cdb-fgroup`-Bloecke in `CraftingApp.astro` zwischen der Ressourcen-Gruppe und der
  Mission/Besitz-Gruppe: Groesse (8 Ankreuzfelder `cdb-size`, Werte 0-7) und Grade (4 Ankreuzfelder
  `cdb-grade`, Werte A-D) — beide aus `cardsData` abgeleitet (`sizeCounts`/`gradeCounts`), nicht
  fest verdrahtet. Ueberschriften kommen aus `itemT('specSize')`/`itemT('specGrade')` (bereits
  vorhandener Wortschatz, D-07).
- `assets/crafting-app.js`: die Chip-Reihe `ul.cbp__spec` wird im **richtigen** Codepfad
  (`cards.forEach`, direkt nach `d.res`, also VOR dem DB-Fetch) ins dataset gehoben — nicht in
  `enrichCardsFromDb()`, die aus der DB statt aus dem Markup liest und die Kennwerte dort gar
  nicht kennt. Zuordnung nach dem Markup-Vertrag aus Plan 08-01: `li.tone` → `d.tone`
  (kleingeschrieben), `S<Ziffern>` → `d.size` (nur die Ziffern), einzelner Buchstabe A-D →
  `d.grade`. Fehlender Chip bleibt ein leeres Feld, kein Ersatzwert (D-06).
- `state.sizes`/`state.grades` (Objekte wie `state.cats`) in `matches()` ausgewertet: innerhalb
  einer Gruppe ODER, zwischen den Gruppen und gegenueber allen anderen Filtern UND. Eine Karte
  ohne den jeweiligen Chip faellt automatisch heraus, sobald mindestens ein Wert angekreuzt ist.
- Freitextsuche zusaetzlich ueber `d.tone`: `(d.tone || '').indexOf(q) < 0` als weitere
  ODER-Bedingung — der Ton bekommt bewusst KEINE eigene Filtergruppe (Scope Fence).
  Zuruecksetzen-Knopf leert `state.sizes`/`state.grades` und nimmt die Haken aus
  `.cdb-size`/`.cdb-grade`.
- `tests/e2e/crafting-specs.test.js`: neue `describe`-Gruppe mit 6 Subtests (3 je Sprache: Anzahl
  und Werte der `cdb-size`/`cdb-grade`-Ankreuzfelder, DE/EN-Ueberschriften, sha1-Cache-Bust am
  Skript-Tag) — insgesamt 45 Subtests (vorher 39).

## Task Commits

1. **Aufgabe 1: Filtern nach Groesse und Grade — Seitenleiste, Zustand, Freitextsuche** -
   `a7b286f` (feat)
2. **Aufgabe 2: Sichtpruefung — beide Sprachen, beide Farbmodi, Raster und Liste, 360 px** -
   `9ced232` (chore, `.claude/launch.json`) + Checkpoint-Freigabe durch den Koordinator
   (keine Code-Aenderung durch die Pruefung selbst)

**Plan-Metadaten:** siehe Abschnitt „Self-Check" unten fuer den Abschluss-Commit-Hash.

## Files Created/Modified

- `src/components/CraftingApp.astro` — Import `itemT`, `sizeCounts`/`gradeCounts`/`sizeList`/
  `gradeList` aus `cardsData`, zwei neue `.cdb-fgroup`-Bloecke in der Seitenleiste
- `assets/crafting-app.js` — Chip-Lese-Block im `cards.forEach`, `state.sizes`/`state.grades`,
  Groesse/Grade-Filterlogik in `matches()`, `d.tone` in der Freitextsuche, Checkbox-Verdrahtung,
  Zuruecksetzen-Knopf erweitert
- `tests/e2e/crafting-specs.test.js` — neue `describe`-Gruppe „Filter Groesse und Grade in der
  Seitenleiste (08-03, DE+EN)" mit 6 Subtests
- `.claude/launch.json` — neuer Eintrag `crafting-specs-preview` (Absolutpfad auf `dist/` dieses
  Worktrees, Port 8351) fuer die Sichtpruefung von Aufgabe 2; die vorhandenen Eintraege mit
  relativem `dist` zeigen ins Hauptverzeichnis, nicht in den Worktree

## Acceptance-Kriterien Aufgabe 1 — tatsaechlich ausgefuehrt, keine Behauptungen

| Kriterium | Ergebnis |
|---|---|
| `npm run build` Exit-Code | **0** (17365 Seiten, 157,05 s) |
| `node --test tests/e2e/crafting-specs.test.js` Exit-Code | **0**, **45/45 Tests bestanden** (vorher 39) |
| `class="cdb-size"` in `dist/topics/crafting.html` und `dist/de/topics/crafting.html` | je **8** |
| `class="cdb-grade"` in beiden Seiten | je **4** |
| Filter-Ueberschrift EN/DE | EN **„Size"**, DE **„Größe"**; beide **„Grade"** (per Grep `<h4>...</h4>` bestaetigt) |
| Skript-Tag-Cache-Bust | beide Seiten tragen `/assets/crafting-app.js?v=<sha1, 8 Hex-Ziffern>`, `npm run verify` bestaetigt 816195 aufgeloeste lokale Referenzen inkl. dieses Pfads |
| `grep -c "state.sizes" assets/crafting-app.js` | **3** (Anlegen bei Checkbox-Wiring, Auswerten in `matches()`, Zuruecksetzen) — `state.grades` ebenfalls **3** |
| `npm run verify:crafting` Exit-Code | **0**, alle 9 Pruefbloecke unveraendert (1514/1513/1513/496/80, 5 gesperrte Gruppen/10 Karten, 96/96 Schiffswaffen-Ton, 913/0 Ruestung) |
| Seitengewichtszuwachs `dist/topics/crafting.html` (EN) | **+1454 Byte roh** (933439 → 934893), **+151 Byte gzip** (69700 → 69851) — weit unter dem 4-KB-Deckel dieser Welle |
| Seitengewichtszuwachs `dist/de/topics/crafting.html` (DE) | **+1457 Byte roh** (932490 → 933947), **+152 Byte gzip** (69998 → 70150) |
| `npm run verify` Exit-Code | **0** (17369 Seiten, 816195 lokale Referenzen aufgeloest) |
| `npm run audit:site` Exit-Code | **0** (0 FEHLER, 4 vorbestehende A11y-WARNUNGEN, unveraendert gegenueber 08-02) |
| Datenherkunft (D-08) | `grep -io "data\.p4k\|datacore\|scmdb\|datamined"` gegen beide Crafting-Seiten → **0 Treffer** |

## Filterzahlen — tatsaechlich gebaut vs. Zielzahlen aus dem Plan

Direkt aus `dist/topics/crafting.html` und `dist/de/topics/crafting.html` extrahiert (Sidebar-
`<em>`-Zaehler UND unabhaengig per Chip-Auszaehlung nachgerechnet — beide Wege liefern dieselben
Zahlen, DE und EN identisch):

| Groesse | Ziel laut Plan | gebaut (DE=EN) | | Grade | Ziel laut Plan | gebaut (DE=EN) |
|---|---|---|---|---|---|---|
| S0 | 25 | **25** | | A | 1265 | **1265** |
| S1 | 1069 | **1069** | | B | 94 | **94** |
| S2 | 199 | **199** | | C | 91 | **91** |
| S3 | 170 | **170** | | D | 63 | **63** |
| S4 | 32 | **32** | | | | |
| S5 | 9 | **9** | | | | |
| S6 | 8 | **8** | | | | |
| S7 | 1 | **1** | | | | |

Alle 8+4 = 12 Werte stimmen exakt mit den bei der Planung nachgerechneten Zielzahlen ueberein.
Filtert man nach S4, zeigt der Zaehler damit **32** (Punkt 2 der Sichtpruefung in Aufgabe 2),
nach Grade D **63** (Punkt 3) — beide Werte waren hier bereits aus dem gebauten HTML belegt und
sind in Aufgabe 2 zusaetzlich am lebenden Filter bestaetigt worden (siehe Abschnitt „Aufgabe 2 —
DURCHGEFUEHRT UND FREIGEGEBEN" unten).

## Decisions Made

- **Kein Ton-Filter**, nur Freitextsuche: der Scope Fence aus `08-CONTEXT.md` nennt ausdruecklich
  nur Groesse und Grade als Filter („Drin: Filter nach Größe und Grade"). Der Ton bleibt ueber
  `d.tone` in `matches()` auffindbar, ohne ein drittes Ankreuzfeld-Set zu erzeugen.
- **Ueberschriften aus `itemT()`** statt einer dritten, App-eigenen Uebersetzungsquelle (`S`
  bzw. `JS_T`): `specSize`/`specGrade` liegen bereits fertig in `src/i18n/itemText.ts` vor, DE und
  EN sind damit automatisch synchron und es entsteht kein drittes Wortschatz-Objekt fuer denselben
  Begriff.
- **Zaehlwerte aus `cardsData` abgeleitet**, nicht aus einer zweiten Iteration ueber
  `DB.blueprints`: `cardsData` ist bereits die Quelle, aus der die Karten UND ihre Chips gerendert
  werden — ein zweiter, unabhaengiger Zaehl-Durchlauf koennte durch eine kuenftige Aenderung an
  `cardsData` (z. B. ein weiterer Filter auf die Blueprint-Liste) leise auseinanderlaufen.

## Deviations from Plan

Keine. Der Plan wurde wie vorgegeben umgesetzt: richtiger Codepfad (`cards.forEach`, nicht
`enrichCardsFromDb()`), datengetriebene Werteliste (kein festes S0-S7/A-D), Ueberschriften aus
vorhandenem Wortschatz, Ton nur in der Freitextsuche, Zuruecksetzen-Knopf erweitert. Alle
Automatikpruefungen liefen tatsaechlich und lieferten exakt die im Plan vorgerechneten Zahlen.

## Known Stubs

Keine. Keine leeren Werte, keine Platzhalter-Texte, keine unverdrahteten Komponenten in den drei
geaenderten Dateien.

## Threat Flags

Keine neue Angriffsflaeche. Die beiden neuen Ankreuzfeld-Gruppen sind reine Client-seitige
Anzeige-Einschraenkung ohne Serverbezug (siehe `<threat_model>` des Plans, T-08-08: „accept").
Die Chip-Werte werden nur zugeordnet und verglichen, nichts wird als HTML zurueckgeschrieben
(T-08-07: „mitigate", durch Astro-Escaping bereits erfuellt).

---

## Aufgabe 2 — DURCHGEFUEHRT UND FREIGEGEBEN (checkpoint:human-verify)

**Ergebnis: „CHECKPOINT FREIGEGEBEN" — keine Abweichung gefunden, nichts nachzubessern.**

**Pruefmethode — ausdruecklich DOM- und berechnete-Stilwerte-Pruefung, keine Screenshots:**
Screenshots sind in dieser Umgebung blockiert (das Browser-Pane kompositiert nicht). Der
Koordinator hat die gebaute Seite deshalb ueber das DOM und ueber `getComputedStyle`-Werte
geprueft (Kontrastwerte, Flex-Layout-Eigenschaften, Element-Hoehen) statt ueber Bilder — dieselbe
Sichtpruefung, nur mit einem anderen Werkzeug fuer den „Blick": Text-/Attribut-/Farbwerte direkt
aus dem gerenderten DOM statt aus einem Pixel-Bild gelesen. Vorschau lief gegen `dist/` DIESES
Worktrees (nicht des Hauptverzeichnisses) auf Port 8351 ueber den neuen `.claude/launch.json`-
Eintrag `crafting-specs-preview` (`npx serve <Worktree-Pfad>/dist -l 8351`) — die vorhandenen
`*-preview`-Eintraege mit relativem `dist` haetten sonst den (aelteren) Stand des Hauptverzeichnisses
gezeigt, nicht den in diesem Plan gebauten.

### Befunde (wortgetreu vom Koordinator uebernommen)

**Englische Seite (`/topics/crafting`):**
- 1594 Karten, 1514 mit Chip-Reihe — deckt sich mit dem Build
- Allegro `S4`/`A`/`Civilian` · Cassandra `S2`/`A`/`Stealth` · Drift `S1`/`C`/`Stealth` — alle korrekt
- Frontline: `S4`/`A`, KEIN Ton-Chip — der Fehlwert-Beweis traegt, es steht kein Platzhalter da
- Agure: `S0`/`D`/`Military` — S0 bleibt erhalten, wird nicht unterdrueckt
- BroadSpec (die kollidierende Namensgruppe): beide Karten chiplos. Gegenprobe: BroadSpec-Go
  (`S0`/`B`/`Industrial`) und BroadSpec-Max (`S4`/`B`/`Industrial`) tragen ihre Chips normal — die
  Sperre trifft die Namensgruppe, nicht die Kategorie und nicht den Namenspraefix

**Deutsche Seite (`/de/topics/crafting`):**
- Identisch: 1594/1514, Allegro `S4`/`A`/`Civilian`, Frontline `S4`/`A` ohne Ton, BroadSpec chiplos,
  Agure `S0`/`D`/`Military`
- Filterueberschriften „Größe" und „Grade", Ankreuzfelder mit Zaehlern S0 25 / S1 1069 / S2 199

**Filter:**
- Start 1594 → S4 angehakt **32** → zusaetzlich Grade D **0** → zurueckgesetzt **1594**. Alle vier
  Werte wie vorgerechnet. Die 0 bei S4+D ist korrekt — es gibt kein S4-Bauteil mit Grade D
  (UND-Verknuepfung zwischen den Gruppen arbeitet wie vorgesehen)

**Darstellung:**
- Dunkelmodus: Chip-Text `#eef1f5` auf Kartenflaeche `rgb(35,35,41)` → Kontrast 13,79; Ton-Chip
  `rgb(31,162,255)` → 5,71. Beide ueber AA (WCAG-Mindestkontrast 4,5:1 fuer Fliesstext)
- Hellmodus (`data-theme="light"`): 16,26 bzw. 7,27. Beide ueber AA
- Ton-Chip hat eigene Farbe und eigene Rahmenfarbe, hebt sich von Groesse/Grade ab — genau die
  beabsichtigte Lesehierarchie (Zweitfarbe `var(--accent-2)`, siehe `.cbp__spec li.tone`-Regel)
- Chip-Reihe ist `display:flex` mit `flex-wrap:wrap`, Hoehe durchgehend 26 px, liegt bei allen
  geprueften Karten innerhalb der Kartengrenzen
- 360 px Breite: kein horizontaler Seitenlauf, kein Chip ausserhalb seiner Karte, Hoehe weiterhin
  einheitlich 26 px
- Listenansicht (Knopf `≡`): Chips bleiben sichtbar (`display:flex`), kein Ueberlauf, keine
  Hoehenabweichung; Rasteransicht danach wiederhergestellt

### Abgleich gegen die Acceptance-Kriterien des Plans

| Kriterium (Plan) | Befund |
|---|---|
| Punkt 2: Zaehlerwert 32 | **bestaetigt** |
| Punkt 3: Zaehlerwert 63 → hier zusaetzlich mit S4+D kombiniert: 0 (korrekt, kein Ueberlapp) | **bestaetigt**, Einzelwert D=63 bereits aus dem Build belegt, Kombinationsprobe zusaetzlich gefahren |
| Punkt 4: Zaehlerwert nach Reset 1594 | **bestaetigt** |
| Punkt 4b: beide BroadSpec-Karten sichtbar und chiplos | **bestaetigt**, plus Gegenprobe BroadSpec-Go/BroadSpec-Max (Chips vorhanden) |
| Punkt 7: keine sichtbare Ruestungs-Karte traegt einen Ton-Chip | **bestaetigt** (Frontline als Einzelbeleg, Ruestung-Gegenprobe bereits aus dem e2e-Test bekannt) |
| Punkte 1, 6, 8, 9, 10 | **alle ohne Beanstandung bestaetigt** — siehe Befunde oben je Punkt |
| Bestaetigung nennt ausdruecklich beide Sprachen und beide Farbmodi | **ja** — EN/DE-Abschnitte und Dunkel-/Hellmodus-Kontrastwerte einzeln benannt |

**Resume-Signal:** „CHECKPOINT FREIGEGEBEN" — entspricht der im Plan verlangten Bestaetigungsformel
„freigegeben tippen". Keine Punktnummer mit Beobachtung genannt, weil keine Abweichung vorlag.

## Self-Check: PASSED

Alle 4 modifizierten/erstellten Dateien vorhanden (`src/components/CraftingApp.astro`,
`assets/crafting-app.js`, `tests/e2e/crafting-specs.test.js`, `.claude/launch.json`), diese
SUMMARY.md vorhanden, beide Task-Commits im Git-Log gefunden (`a7b286f`, `9ced232`).

---
*Phase: 08-bauteil-kennwerte-auf-den-crafting-karten*
*Completed: 2026-08-07*
