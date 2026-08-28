---
phase: 20-wikelos-angebote-kommen-aus-dem-bestand
plan: 01
subsystem: data
tags: [datamine, build-pipeline, wikelo, astro, json]

# Dependency graph
requires:
  - phase: 18-missionen-wissen-wo-sie-spielen
    provides: "verify-datastand.mjs (Kreuzvergleich der Patch-Kennungen), scripts/datamine-wikelo.mjs (fertiger Extraktor)"
provides:
  - "scripts/build-wikelo-trades.mjs — Zusammenfuehrung Spieldaten + Kuration zu assets/wikelo-trades.json/.meta.json"
  - "assets/wikelo-curated.json — kuratierte Zulieferdatei, keyed by Vertrags-id, ein Eintrag (ATLS Cool Metal)"
  - "npm run sync:wikelo — Extraktion + Zusammenfuehrung + Asset-Spiegelung in einer Kette"
  - "wikelo-trades.meta.json Feld `patch`, gelesen von TopicFacts dataVersion"
affects: [20-02-wikelo-kuration-umzug, 20-03-wikelo-sperrklinke, 20-04-wikelo-anzeige]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Kuratierte Zulieferdatei, keyed by stabilem Schluessel, vom Erzeuger gelesen und nie ueberschrieben (Vorbild build-mining-db.mjs/mining-curated.json)"
    - "Einmisch-Merge ueber Entitaets-id statt Anzeigename (drei der 69 Vertraege haben titel: null)"

key-files:
  created:
    - scripts/build-wikelo-trades.mjs
    - assets/wikelo-curated.json
    - .planning/phases/20-wikelos-angebote-kommen-aus-dem-bestand/COVERAGE.md
  modified:
    - assets/wikelo-trades.json
    - assets/wikelo-trades.meta.json
    - src/components/topics/wikelo-emporium.astro
    - package.json

key-decisions:
  - "Vertrags-id (32-stelliger Hex-String) ist der einzige Zusammenfuehrungs-Schluessel, niemals der Anzeigename — drei ATLS-Farbvertraege tragen titel: null."
  - "assets/wikelo-trades.meta.json behaelt in dieser Welle reviewedVersion/reviewedAt zusaetzlich zu patch — verify-datastand.mjs liest die HANDPFLEGE-Tabelle noch unveraendert, der Umzug in STANDS folgt in Plan 03."
  - "Favor-Filter vergleicht exakt (===), nicht per Praefix — Carryable_1H_CY_banu_favour_Wikelo_special (Polaris Bit) bleibt dadurch in mats erhalten."

patterns-established:
  - "Build-Zeit-Merge mit Abbruchbedingung bei verwaister Kuration (ASVS V5): eine id in wikelo-curated.json ohne Treffer im Bestand laesst das Skript mit Code 1 und namentlicher Liste abbrechen statt still zu ignorieren."

requirements-completed: []  # Phase 20 fuehrt keine REQ-IDs (ROADMAP nennt D-01..D-04 statt IDs, s. Plan-Frontmatter)

coverage:
  - id: D1
    description: "build-wikelo-trades.mjs erzeugt 69 Karten aus dem Bestand (Mengen/Favor aus wikelo-gamefiles.json, nicht aus der alten Handliste)"
    verification:
      - kind: unit
        ref: "node scripts/build-wikelo-trades.mjs && node -e \"...69/239/46/1-Assertions...\" (siehe Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Genau eine Karte (ATLS Cool Metal, id a7405276a983ba2f34bc1b65f81c61b7) traegt ein kuratiertes Bild — Kuration -> Zusammenfuehrung -> Seite end-to-end bewiesen"
    verification:
      - kind: integration
        ref: "npm run build && node -e \"dist/topics/wikelo-emporium.html enthaelt wk-atls und 69× class=wk-tc\""
        status: pass
    human_judgment: false
  - id: D3
    description: "Zusammenfuehrung schluesselt ueber contract.id, nie ueber den Anzeigenamen"
    verification:
      - kind: unit
        ref: "scripts/build-wikelo-trades.mjs: curatedById = new Map(Object.entries(curated.trades)); Abbruch bei verwaister id (kuenstlicher Fantasieschluessel-Test, Task 1, manuell durchgefuehrt und zurueckgenommen)"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run build && npm run gate gruen, normal UND mit STAGING=1; npm run gate:data gelaufen"
    verification:
      - kind: integration
        ref: "npm run gate (23/23), STAGING=1 npm run gate (23/23), npm run gate:data (verify:items OK, verify:vehicles vorbestehend rot — s. Deviations)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 1: Wikelo-Zusammenfuehrung aus dem Bestand Summary

**`build-wikelo-trades.mjs` fuehrt 69 Wikelo-Vertraege aus `wikelo-gamefiles.json` mit einer kuratierten Overlay-Datei zusammen (Schluessel: Vertrags-id) und beweist den vollen Weg bis zur gerenderten Karte an genau einem kuratierten Bild (ATLS "Cool Metal").**

## Performance

- **Duration:** ca. 25 min
- **Started:** 2026-08-28T10:40Z (Phase-Start laut STATE.md)
- **Completed:** 2026-08-28T11:05Z
- **Tasks:** 3
- **Files modified:** 6 (2 neu: `scripts/build-wikelo-trades.mjs`, `assets/wikelo-curated.json`; 4 geaendert)

## Accomplishments
- `scripts/build-wikelo-trades.mjs` (neu, Vorbild `build-mining-db.mjs`) liest `assets/wikelo-gamefiles.json` (maschinell) + `assets/wikelo-curated.json` (kuratiert) und schreibt `assets/wikelo-trades.json`/`.meta.json` neu — 69 Vertraege, 239 Materialzeilen, 46 Favor-Karten, exakt 1 kuratiertes Bild.
- Favor-Zeile wird per exaktem Klassenvergleich (`===`) aus `orders[]` herausgetrennt, nicht per Praefix — der Polaris Bit (`..._Wikelo_special`) bleibt dadurch als Materialzeile erhalten (Beleg: mindestens ein Vertrag zeigt "Polaris Bit" in `mats`).
- `assets/wikelo-curated.json` (neu) enthaelt genau einen kuratierten Eintrag (`a7405276a983ba2f34bc1b65f81c61b7`, ATLS GEO "Cool Metal") — belegt end-to-end, dass Kuration durch den Merge bis in die gerenderte Karte durchschlaegt.
- `package.json`: neue Kette `sync:wikelo` (Extraktion + Zusammenfuehrung + Asset-Spiegelung), Vorbild `sync:mining`.
- `src/components/topics/wikelo-emporium.astro` Zeile 218: `TopicFacts dataVersion` liest jetzt `TRADES_META.patch` statt `reviewedVersion`.
- `COVERAGE.md` angelegt — beantwortet den `api-coverage`-Fehlalarm (Treffer stammt aus den Recherche-Diagnosesonden, nicht aus der Build-Kette).
- `npm run build && npm run gate` gruen (23/23), normal UND mit `STAGING=1`; `npm run gate:data` gefahren.

## Task Commits

1. **Task 1: Ein Vertrag durch alle Schichten — Zusammenfuehrung, Kuration, Ausgabe, Seite** - `5d0782d` (feat)
2. **Task 2: COVERAGE.md — begruendete Erklaerung "keine externe API"** - `d4082a2` (docs)
3. **Task 3: Torlauf — normal, mit STAGING=1 und nach dem Datenlauf** - kein eigener Commit (reiner Verifikationslauf, keine Dateiaenderungen; die geprueften Dateien wurden bereits in Task 1 committet)

**Plan metadata:** siehe unten (folgt nach diesem Summary)

## Files Created/Modified
- `scripts/build-wikelo-trades.mjs` - NEU: liest Spieldaten + Kuration, schreibt die zwei Ausgabedateien, druckt Selbstauskunft
- `assets/wikelo-curated.json` - NEU: kuratierte Zulieferdatei, ein Eintrag
- `assets/wikelo-trades.json` - ERSETZT: von Hand (63 Eintraege) auf build-generiert (69 Eintraege) umgestellt
- `assets/wikelo-trades.meta.json` - ERSETZT: neue Felder `patch`/`contractCount`/`orderLineCount`/`curatedCount`/`curatedReviewedAt`, `reviewedVersion`/`reviewedAt` bewusst erhalten
- `src/components/topics/wikelo-emporium.astro` - `TopicFacts dataVersion` liest `TRADES_META.patch`
- `package.json` - neue Zeile `sync:wikelo`
- `.planning/phases/20-wikelos-angebote-kommen-aus-dem-bestand/COVERAGE.md` - NEU

## Decisions Made
- Vertrags-`id` ist der alleinige Zusammenfuehrungs-Schluessel (siehe `assumption_delta_decision` im Plan: `promote` statt `add-alongside`) — drei Vertraege ohne auflösbaren Titel waeren bei einem Titel-Join ersatzlos verloren gegangen.
- `reviewedVersion`/`reviewedAt` bleiben in dieser Welle im Meta-Format erhalten (Plan-Vorgabe: `verify-datastand.mjs` liest sie noch als FEHLER-Pflichtfelder seiner `HANDPFLEGE`-Tabelle; der Umzug nach `STANDS` ist explizit Plan 03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mengenbereich-Formatierung erzeugte unsinnige "1–0×"-Zeilen**
- **Found during:** Task 1, erster Testlauf gegen die reale `wikelo-gamefiles.json`
- **Issue:** Der Plan-Vorschlag formatiert eine Zeile als Bereich, sobald `o.max !== o.min`. Empirisch ist `o.max` in den heutigen Spieldaten NIE groesser als `o.min` (132 von 285 Zeilen fuehren `max: 0` als Sentinel fuer "keine Bandbreite", 153 fuehren `max === min`, 0 fuehren `max > min`). Die woertliche Ungleichheitspruefung haette `max: 0` faelschlich als Bereich gelesen und z. B. "1–0× Carinite (Pure)" auf der Karte des Beweis-Vertrags ausgegeben — falsche Zahlen auf der Seite, genau der Fehler, den diese Phase beheben soll.
- **Fix:** Bereichsformat nur noch bei echter Bandbreite (`o.max > o.min`); sonst `${o.min}× ${o.name}`. Mit den heutigen Daten sind das 0 Bereichszeilen — bleibt aber korrekt, falls ein spaeterer Patch echte `max > min`-Zeilen liefert.
- **Files modified:** `scripts/build-wikelo-trades.mjs`
- **Verification:** `node -e "..."`-Pruefung bestaetigt 0 Zeilen mit „–" im `mats`-Array; die ATLS-Beweiskarte zeigt korrekt `1× Carinite (Pure)`, `1× Argo ATLS`.
- **Committed in:** `5d0782d` (Teil des Task-1-Commits — der Fehler wurde vor dem Commit gefunden und behoben, kein separater Fix-Commit noetig)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Notwendige Korrektur fuer korrekte Mengenanzeige. Kein Scope-Creep — betrifft ausschliesslich die in Task 1 beschriebene Formatierungslogik.

## Issues Encountered

**`npm run gate:data` — vorbestehender, phasenfremder Befund, aber ein ANDERER als vom Plan angekuendigt.**

Der Plan nannte `verify:items` als bekannten Vorbefund aus Phase 18. Tatsaechlich lief `verify:items` in dieser Sitzung sauber durch ("OK: strukturell konsistent", 35 Preis-Drift-Zeilen als WARNUNG, nicht FEHLER). Die Kette brach stattdessen bei `verify:vehicles` ab: `src/data/vehicles-gamefiles.json` fehlt in diesem Arbeitsverzeichnis — eine lokale, gitignorete Zwischenstufe, die `npm run datamine:loadouts && npm run datamine:vehicles` erst erzeugen wuerde. Das ist vollstaendig unabhaengig von den Wikelo-Aenderungen dieser Welle (kein Wikelo-Skript beruehrt Fahrzeugdaten) und ausserhalb des Aufgabenbereichs dieser Welle (SCOPE BOUNDARY: nur Befunde direkt aus den eigenen Aenderungen werden behoben). Protokolliert als bekannt und unveraendert, NICHT behoben, NICHT als Regress dieser Welle gewertet — analog zur vom Plan erwarteten Behandlung, nur an einer anderen Stelle der Kette manifestiert.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Next Phase Readiness

- Plan 02 (Kuration der 63 Handeintraege ins Overlay) kann direkt auf `assets/wikelo-curated.json` und `scripts/build-wikelo-trades.mjs` aufsetzen — das Merge-Muster (Schluessel `id`, Felder `img`/`comps`/`rep`/`cat`/`name`/`get`) ist bewiesen und getestet.
- Plan 03 (Sperrklinke, `STANDS`-Umzug) kann `wikelo-trades.meta.json.patch` als `get`-Funktion fuer eine neue `STANDS`-Zeile nutzen; `reviewedVersion`/`reviewedAt` sind bewusst noch vorhanden und muessen beim Umzug aus der `HANDPFLEGE`-Tabelle entfernt werden.
- Kein Blocker fuer die naechste Welle. `assets/wikelo-gamefiles.json` liegt bereits lokal vor (aus der Recherche-Sitzung), spaetere Sitzungen ohne lokalen Spielstand muessten vor einem `sync:wikelo`-Lauf zuerst `npm run datamine:wikelo` fahren (vom Skript selbst als FEHLER-Hinweis ausgegeben, falls die Datei fehlt).

---
*Phase: 20-wikelos-angebote-kommen-aus-dem-bestand*
*Completed: 2026-08-28*
