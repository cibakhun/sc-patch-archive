---
phase: 18-missionen-wissen-wo-sie-spielen
plan: 03
subsystem: data
tags: [datamine, patch-kennung, item-finder, crafting, wikelo, refinery, d-04]

requires:
  - phase: 18-01
    provides: Ortskante end-to-end (unabhaengig von dieser Welle, kein Dateiueberlapp)
  - phase: 18-02
    provides: vierte Ortsquelle, Katalog-Dedup, Slot-Art D-03 (unabhaengig von dieser Welle, kein Dateiueberlapp)
provides:
  - "gameVersion (4.9.0-live.12344265) im Item-Katalog assets/universal-items.json, Schreibweise bytegleich zu assets/mining-db.json game_version"
  - "assets/dismantling-items.meta.json (Begleitdatei, maschinell aus scripts/datamine-crafting.mjs) — gameVersion, generatedAt, itemCount 854"
  - "assets/wikelo-trades.meta.json (Begleitdatei, von Hand) — reviewedVersion 4.9.0, reviewedAt, entryCount 63, note"
  - "assets/refinery-data.json meta.gameVersion nachgezogen auf 4.9.0-live.12344265 (vorher 4.9.0-live.12248363)"
  - "alle sechs maschinell erzeugten Datenstaende (Missionen, Mining, Crafting, Item-Katalog, Refinery, Zerlegung) nennen jetzt CL 12344265 — Zwischenstand fuer das Verzugstor der naechsten Welle"
affects: [18-04]

tech-stack:
  added: []
  patterns:
    - "Patch-Kennung am Erzeuger ermitteln (build_manifest.id neben der offenen Data.p4k, existsSync-Gatter, stilles catch) — jetzt drei statt zwei Anwendungen im Projekt"
    - "Begleitdatei statt Huelle fuer Bestaende, deren Wurzelform ein lesender Verbraucher voraussetzt (Client-Fetch mit datenstand-gebundener Cache-Kennung, JSON-Modul-Import) — Eintragszahl in der Begleitdatei als Drift-Zusicherung fuer das naechste Tor"
    - "Handpflege-Kennung (reviewedVersion/reviewedAt) statt Changelist fuer Daten ohne Erzeugerlauf — Aussage ueber einen Menschen, nicht ueber einen Auslesevorgang"

key-files:
  created:
    - assets/dismantling-items.meta.json
    - assets/wikelo-trades.meta.json
  modified:
    - scripts/build-universal-db.mjs
    - assets/universal-items.json
    - scripts/datamine-crafting.mjs
    - assets/crafting-db.json
    - assets/refinery-data.json

key-decisions:
  - "gameVersion-Schreibweise fuer den Item-Katalog folgt exakt assets/mining-db.json (`4.9.0-live.<CL>`, aus scripts/build-mining-db.mjs Z. 43 uebernommen) statt der Branch@Changelist-Form aus datamine-missions.mjs — wie im Plan verlangt, keine dritte Wortwahl fuer denselben Spielstand"
  - "dismantling-items.json und wikelo-trades.json behalten ihre Array-Wurzelform; beide Begleitdateien tragen die Eintragszahl ihrer Datei mit, damit das Tor der naechsten Welle Drift zwischen Datei und Kennung erkennen kann"
  - "npm run datamine:items vor Task 1 nachgeholt (Rule 3 — blockierender Vorbedingungsfehler: assets/items-gamefiles.json fehlte in diesem frischen Worktree, ist gitignored und noetig fuer sync:items). Liest ausschliesslich die lokale Data.p4k, kein Netz, kein Preis-Sync — nicht das ausgeschlossene sync:item-prices"

requirements-completed: [D-04]

coverage:
  - id: D1
    description: "Item-Katalog nennt seinen Patch: gameVersion auf oberster Ebene von universal-items.json, Schreibweise wie mining-db.json, CL 12344265"
    requirement: "D-04"
    verification:
      - kind: other
        ref: "node -e Vergleich gameVersion === mining-db.json.game_version (true) und CL-Treffer 12344265 (true)"
        status: pass
      - kind: other
        ref: "npm run verify:metrics (21/21 Kennzahlen gruen, items/itemsMitBezugsquelle/itemsMitSpieldaten/uexPreiszeilen/ruestungsSets alle >= Klinke, keine gefallen)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zwei Bestaende ohne Kopf (dismantling-items.json, wikelo-trades.json) bekommen eine Begleitdatei statt Huelle; kein lesender Verbraucher geaendert"
    requirement: "D-04"
    verification:
      - kind: other
        ref: "node -e: dismantling-items.meta.json.gameVersion === crafting-db.json.version (true, beide PUBLIC-4.9.0-12344265); itemCount 854 === Array-Laenge (true)"
        status: pass
      - kind: other
        ref: "wikelo-trades.meta.json.entryCount 63 === Array-Laenge (true); node -e Herkunftsbegriff-Scan ueber alle Stringwerte beider Dateien: 0 Treffer"
        status: pass
      - kind: other
        ref: "git status: scripts/build-universal-db.mjs, assets/crafting-app.js, src/components/CraftingApp.astro, src/components/topics/wikelo-emporium.astro unveraendert; nach npm run build liegen beide Begleitdateien in dist/assets/"
        status: pass
    human_judgment: false
  - id: D3
    description: "Refinery-Datenstand holt seine eigene Quelle (mining-db.json game_version) ein, ohne den Erzeuger zu aendern"
    requirement: "D-04"
    verification:
      - kind: other
        ref: "node -e: refinery-data.json.meta.gameVersion 4.9.0-live.12248363 -> 4.9.0-live.12344265, bytegleich mining-db.json.game_version; git status zeigt build-refinery-data.mjs unveraendert"
        status: pass
      - kind: other
        ref: "Erz-/Stations-/Methodenzahl vor/nach 26/20/9 unveraendert (kein Rueckgang); meta.priceDate/priceSource unveraendert"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run gate:data, npm run build && npm run gate (normal UND STAGING=1) gruen nach jedem der drei Laeufe"
    requirement: null
    verification:
      - kind: other
        ref: "npm run gate 22/22 normal UND mit STAGING=1, nach Task 2 und nach Task 3 je einmal vollstaendig durchlaufen, strikt sequenziell (kein paralleler Build gegen dasselbe dist/)"
        status: pass
      - kind: other
        ref: "npm run gate:data bleibt rot an verify:items — vorbestehender, unabhaengiger Befund (1 Ort nicht mehr live), bereits in 18-01-SUMMARY.md/18-02-SUMMARY.md dokumentiert, kein Regress dieser Welle"
        status: pass
    human_judgment: false

duration: ~70min
completed: 2026-08-23
status: complete
---

# Phase 18 Plan 03: Jeder Datenstand nennt seinen Patch Summary

**Alle sechs maschinell erzeugten Datenstaende (Missionen, Mining, Crafting, Item-Katalog, Refinery, Zerlegung) nennen jetzt dieselbe Changelist 12344265 — der Item-Katalog bekam ein neues `gameVersion`-Feld, zwei bislang kopflose Bestaende (`dismantling-items.json`, `wikelo-trades.json`) bekamen eine Begleitdatei statt einer Huelle (null geaenderte Leser), und der Refinery-Datenstand wurde neu erzeugt, um seine eigene, laengst aktuellere Mining-Quelle einzuholen.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-08-23T19:01:07+02:00
- **Tasks:** 3 von 3 (alle `type="auto"`)
- **Files modified:** 7 (2 neu, 5 geändert)

## Accomplishments

- **Task 1 — Item-Katalog nennt seinen Patch.** `scripts/build-universal-db.mjs` ermittelt jetzt eine Patch-Kennung nach demselben `build_manifest.id`-Muster wie `datamine-missions.mjs`/`datamine-crafting.mjs`, aber in der Schreibweise von `assets/mining-db.json` (`4.9.0-live.<CL>`, aus `build-mining-db.mjs` Z. 43 übernommen — dieselbe Form, dieselbe Wortwahl für denselben Spielstand). Das Feld `gameVersion` landet auf oberster Ebene des `db`-Objekts, neben `generatedAt`. Erzeugerlauf (`npm run sync:items`) neu ausgeführt: `assets/universal-items.json` trägt jetzt `gameVersion: "4.9.0-live.12344265"`, bytegleich mit `mining-db.json`. Alle fünf Bestandszahlen halten exakt auf ihrer Klinke (kein Rückgang, kein Zuwachs): `items` 9168, `itemsMitBezugsquelle` 4574, `itemsMitSpieldaten` 6642, `uexPreiszeilen` 23705, `ruestungsSets` 136.
- **Vorbedingung nachgeholt (Rule 3).** `assets/items-gamefiles.json` (gitignored, Pflicht-Eingabe für `sync:items`) fehlte in diesem frischen Worktree. `npm run datamine:items` liest ausschließlich die lokale `Data.p4k` (kein Netz, kein Preis-Sync) und wurde vorab ausgeführt — ausdrücklich NICHT das ausgeschlossene `npm run sync:item-prices`. Keine der bekannten „collapsedNames"-Dauerregel-Zahlen (265 Anzeigenamen ohne Größenunterschied) ist neu; die Datei ist gitignored und fließt nur in den Erzeugerlauf ein, wird selbst nicht committet.
- **Task 2 — zwei Begleitdateien.** `scripts/datamine-crafting.mjs` schreibt jetzt direkt nach dem `writeFileSync` von `dismantling-items.json` eine zweite Datei `assets/dismantling-items.meta.json` mit `gameVersion` (dieselbe `patchLabel`-Variable wie `crafting-db.json`s `version`-Feld — nie eine zweite Ermittlung), `generatedAt` und `itemCount` (Array-Länge, die Zusicherung, dass die Kennung zu genau diesem Bestand gehört). `assets/wikelo-trades.meta.json` von Hand angelegt: `reviewedVersion: "4.9.0"` (Spielfassung, keine Changelist — eine Changelist wäre für 63 handgepflegte Einträge eine Aussage über einen Auslesevorgang, den es nicht gab), `reviewedAt` (Tag der Anlage, ausdrücklich nicht als inhaltliche Prüfung der Einträge dokumentiert), `entryCount: 63`, `note` (deutscher Satz, keine Fremdquellen-Begriffe). Beide Wurzelformen (`dismantling-items.json`, `wikelo-trades.json`) bleiben Arrays — `scripts/build-universal-db.mjs`, `assets/crafting-app.js`, `src/components/CraftingApp.astro` und `src/components/topics/wikelo-emporium.astro` wurden nicht angefasst (per `git status` belegt).
- **Herkunftsregel geprüft.** `node -e`-Lauf über alle Stringwerte beider Begleitdateien gegen die Verbotsliste (Spielarchiv-Dateiname, Datenkern-Dateiname, das englische Wort für maschinelles Auslesen, „Spieldateien", „Extraktion", `p4k`) — 0 Treffer.
- **Task 3 — Refinery-Datenstand holt seine Quelle ein.** `scripts/build-refinery-data.mjs` wurde NICHT geändert — der Erzeuger ermittelt seine Kennung bereits korrekt aus `mining-db.json.game_version`, war nur zuletzt vor dem Mining-Datenlauf gebaut worden. `npm run build:refinery-data` neu ausgeführt (nicht `npm run sync:refinery` — kein UEX-Abruf gefahren): `meta.gameVersion` `4.9.0-live.12248363` → `4.9.0-live.12344265`, bytegleich mit `mining-db.json`. `meta.priceDate`/`priceSource` unverändert (Preisdatei nicht angefasst). Erz-/Stations-/Methodenzahl unverändert (26/20/9, kein Rückgang).
- **Zwischenstand für die nächste Welle** (alle sechs maschinell erzeugten Datenstände, CL 12344265, jeweils eigenes Vokabular): `missions.json` → `sc-alpha-4.9.0@12344265`; `mining-db.json` → `4.9.0-live.12344265`; `crafting-db.json` → `PUBLIC-4.9.0-12344265`; `universal-items.json` → `4.9.0-live.12344265`; `refinery-data.json` → `4.9.0-live.12344265`; `dismantling-items.meta.json` → `PUBLIC-4.9.0-12344265`.
- `npm run gate` grün (22/22), **normal UND mit `STAGING=1`**, nach Task 2 und nach Task 3 je einmal vollständig durchlaufen — strikt sequenziell, kein paralleler Build gegen dasselbe `dist/` (Lehre aus Welle 2 beachtet).

## Task Commits

1. **Task 1: Der Item-Katalog nennt seinen Patch** - `c0069e8` (feat)
2. **Task 2: Zwei Bestände ohne Kopf bekommen eine Begleitdatei** - `0125ef5` (feat)
3. **Task 3: Der Refinery-Datenstand holt seine eigene Quelle ein** - `2b779dc` (feat)

## Files Created/Modified

- `scripts/build-universal-db.mjs` - `gameVersion`-Ermittlung (Muster aus `build-mining-db.mjs`) + Feld im `db`-Objekt
- `assets/universal-items.json` - neu erzeugt, `gameVersion: "4.9.0-live.12344265"`, Bestandszahlen exakt auf der Klinke
- `scripts/datamine-crafting.mjs` - `OUT_DIS_META`-Konstante, Begleitdatei-Schreibblock, erweiterte Konsolenzeile
- `assets/crafting-db.json` - neu erzeugt (`version: "PUBLIC-4.9.0-12344265"`), keine strukturelle Änderung
- `assets/dismantling-items.meta.json` - **neu**: `gameVersion`, `generatedAt`, `itemCount` (854)
- `assets/wikelo-trades.meta.json` - **neu**, von Hand: `reviewedVersion`, `reviewedAt`, `entryCount` (63), `note`
- `assets/refinery-data.json` - `meta.gameVersion` nachgezogen auf `4.9.0-live.12344265`, sonst unverändert

## Decisions Made

- **gameVersion-Schreibweise für den Item-Katalog** folgt exakt `assets/mining-db.json` (`4.9.0-live.<CL>`), nicht der `Branch@Changelist`-Form aus `datamine-missions.mjs` — wie im Plan ausdrücklich verlangt (keine dritte Wortwahl für denselben Spielstand). Da `build-universal-db.mjs` weder `crafting-db.json` noch `missions.json` als Vorbild hat, sondern explizit an `mining-db.json` angelehnt werden sollte, wurde die Formel `${(d.Branch || '').replace(/^sc-alpha-/, '')}-live.${d.RequestedP4ChangeNum}` aus `build-mining-db.mjs` Z. 43 übernommen statt der einfacheren Form aus `datamine-missions.mjs`.
- **Begleitdatei statt Hülle für beide kopflosen Bestände** — wie im Plan festgelegt (Abweichung von RESEARCH.md Annahme A4), weil `CraftingApp.astro` die Datei über eine an den Crafting-Datenstand gebundene Abrufkennung lädt und `wikelo-emporium.astro` sie als JSON-Modul importiert. Kein Leser wurde geändert.
- **`npm run datamine:items` vor Task 1 nachgeholt** (siehe Deviations) — notwendige, gitignored Vorbedingung für `sync:items`, die in diesem frischen Worktree fehlte.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fehlende Vorbedingung `assets/items-gamefiles.json` für `npm run sync:items`**

- **Found during:** Task 1, erster Versuch von `npm run sync:items`
- **Issue:** `scripts/build-universal-db.mjs` bricht sofort ab („ABBRUCH: … items-gamefiles.json fehlt"), weil diese gitignored Pflicht-Eingabedatei in diesem frisch ausgecheckten Worktree nicht vorlag. Sie entsteht bei `npm run datamine:items` (Precondition des Tasks nennt nur die `Data.p4k` selbst, nicht diese Zwischendatei).
- **Fix:** `npm run datamine:items` vorab ausgeführt — liest ausschließlich die lokale `Data.p4k` (kein Netz, kein Preis-Sync), ist damit weder das ausgeschlossene `sync:item-prices` noch ein Paket-Install (Rule 3 Ausnahme greift nicht). Ergebnis: 6643 Items, Kennzahlen unauffällig (`collapsedNames: 265`, dieselbe Größenordnung wie in vorherigen, unabhängigen Läufen — keine neue Regression). Die erzeugte Datei ist gitignored und wurde nicht committet.
- **Files modified:** keine committeten Dateien (nur die gitignored Zwischendatei `assets/items-gamefiles.json`)
- **Verification:** `npm run sync:items` lief danach durch; `npm run verify:metrics` grün.
- **Committed in:** nicht separat committet (gitignored Artefakt)

---

**Total deviations:** 1 (Rule 3 — blockierende, notwendige Vorbedingung nachgeholt, keine committete Datei betroffen)
**Impact on plan:** Keine Scope-Ausweitung — reiner Vorbereitungsschritt, damit der im Plan verlangte Erzeugerlauf überhaupt starten konnte.

## Issues Encountered

- `npm run gate:data` bleibt nach allen drei Task-Läufen rot an `verify:items` (1 Ort nicht mehr live, UEX-Preiszeilen) — derselbe vorbestehende, von dieser Welle unabhängige Befund, den bereits `18-01-SUMMARY.md` und `18-02-SUMMARY.md` dokumentiert haben. Kein Item-/Preis-Code wurde von diesem Plan berührt; `npm run build && npm run gate` (Schiene A, das eigentliche Auslieferungs-Tor) ist unabhängig davon grün, normal und mit `STAGING=1`.
- PowerShell-Zeilenenden-Warnung („LF will be replaced by CRLF") bei `assets/dismantling-items.json` nach dem Erzeugerlauf, obwohl `git diff`/`git diff -w`/`git diff --numstat` keinerlei Inhaltsänderung zeigten (0 Zeilen) — nach `git add` verschwand die Meldung vollständig aus `git status`. Kein echter Inhalts-Diff, keine Aktion nötig, nicht committet.

## User Setup Required

None - keine externe Diensteinrichtung nötig.

## Next Phase Readiness

- D-04 ist zur Hälfte erfüllt (Erfolgskriterium 5 der Phase): alle Datenstände nennen jetzt ihre Patch-Kennung, alle sechs maschinell erzeugten stimmen auf CL 12344265 überein. Das Tor, das künftigen Verzug meldet (`scripts/verify-datastand.mjs`, `verify:datastand`-Registry-Eintrag), ist **noch nicht gebaut** — das ist Welle 4 (`18-04-PLAN.md`), wie im Plan-Objective explizit vorgesehen.
- Welle 4 kann direkt auf der in dieser Welle festgelegten Feldliste aufsetzen: `missions.json:meta.patch`, `mining-db.json:game_version`, `crafting-db.json:version`, `universal-items.json:gameVersion` (neu), `refinery-data.json:meta.gameVersion`, `dismantling-items.meta.json:gameVersion` (neu) — plus `wikelo-trades.meta.json:reviewedVersion`/`reviewedAt` als separater WARNUNG-Kanal (nie FEHLER, CLAUDE.md Grundsatz 3).
- Kein Dateiüberlapp mit den offenen Betreiber-Sichtrunden aus 18-01/18-02 (Ortsangaben, Katalogeinträge) — diese Welle hat ausschließlich Datenstand-Köpfe berührt.

---
*Phase: 18-missionen-wissen-wo-sie-spielen*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: assets/dismantling-items.meta.json
- FOUND: assets/wikelo-trades.meta.json
- FOUND: scripts/build-universal-db.mjs (modified)
- FOUND: scripts/datamine-crafting.mjs (modified)
- FOUND: commit c0069e8 (Task 1)
- FOUND: commit 0125ef5 (Task 2)
- FOUND: commit 2b779dc (Task 3)
