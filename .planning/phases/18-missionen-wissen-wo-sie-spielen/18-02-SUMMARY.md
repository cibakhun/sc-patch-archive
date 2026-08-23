---
phase: 18-missionen-wissen-wo-sie-spielen
plan: 02
subsystem: data
tags: [datacore, datamine, missions, star-citizen, p4k, slot-labels]

requires:
  - phase: 18-01
    provides: erste Ortsquelle (localityAvailable), zweite Ortsquelle (locationMissionAvailable), dritte Ortsquelle (ContractPrerequisite_Location), Messsonde missionsorte-messung.mjs, Ableser missionenMitOrt
provides:
  - "vierte Ortsquelle (ContractPrerequisite_Locality.localityAvailable -> MissionLocality), zusaetzlich auf Contract-, subContract- (neu gelesen) und Handler-Ebene — Familien mit Ortsangabe 609 -> 1.180 von 1.347"
  - "kanonRoh(): E-2-Dedup (Stanton/Pyro/Nyx *Star vs. *SolarSystem vs. bloss MissionLocality-Systemname) + E-3-Aussenposten-Hochzug auf den tragenden Planeten/Mond"
  - "prettyLoc() dreistufig (kuratiert/spielintern/rueckfall) — spielintern loest den gesamten Langschwanz (Monde, Lagrange-Punkte, Rest Stops, Gefaengniskolonie) ueber StarMapObject.name auf, ohne eine zweite kuratierte Tabelle"
  - "D-03: braces() erhaelt die Slot-Art (Spielort/Zielort/Abholort/Lieferort) statt sie auf {Address} zu kollabieren; phLabel() in src/lib/missions.ts fuer lesbare Chip-Beschriftung"
  - "zweite Sperrklinke missionsOrtsarten (min 4); missionenMitOrt auf 1150 angehoben (Grundsatz 5, nur nach oben)"
  - "scripts/probes/missionsorte-messung.mjs: neuer Schalter --slots"
affects: [18-03, 18-04]

tech-stack:
  added: []
  patterns:
    - "Rohbezeichner-Kanonisierung VOR der Bucket-Bildung (kanonRoh): Alias-Tabelle fuer Duplikat-Paare + Praefix-Regex fuer Hochzug, angewendet an EINER Stelle (locBucket/MissionLocality-Konstruktion), nicht an jedem Aufrufer"
    - "Drei-Stufen-Namensaufloesung (kuratiert -> spielintern via StarMapObject.name -> humanize()-Rueckfall) ersetzt eine zweite Handtabelle: das Spiel fuehrt die meisten Langschwanz-Namen bereits selbst"
    - "Selektive Ortsform-Erkennung in braces() ueber das LETZTE Trennsegment (ORT_FORM), nicht ueber eine pauschale Split-Richtungsumkehr — schuetzt die 47 uebrigen Markensorten"

key-files:
  created: []
  modified:
    - scripts/datamine-missions.mjs
    - src/data/missions.json
    - src/lib/missions.ts
    - src/components/MissionsApp.astro
    - src/components/MissionDetail.astro
    - scripts/probes/missionsorte-messung.mjs
    - scripts/verify-metrics.mjs
    - scripts/lib/metrics-baseline.mjs
    - .planning/WINDOWS.md

key-decisions:
  - "Betreiber-Auftrag E-1 (vierte Ortsquelle) ZUERST umgesetzt, dann E-2 (Dedup) und E-3 (Langschwanz) auf dem Ergebnis, dann Plan-Task D-03 — wie in der Erweiterung vorgegeben, weil E-1 veraendert, welche Rohbezeichner ueberhaupt vorkommen"
  - "E-3 NICHT ueber eine zweite kuratierte Tabelle (Mond-Tabelle aus datamine-stanton-anchors.mjs, wie urspruenglich im Plan vorgesehen) geloest, sondern ueber eine dritte Aufloesungsstufe, die das Spiel-eigene StarMapObject.name-Feld nutzt — deckt empirisch ALLE Monde, Lagrange-Punkte, Rest Stops und die Gefaengniskolonie ab, mit den ECHTEN Spielnamen (z.B. Klescher Rehabilitation Facility statt einer erfundenen Uebersetzung), und veraltet nicht wie eine Handtabelle"
  - "Selbstauskunft berichtet DREI statt der vom Plan angenommenen VIER Zweige (kuratiert/spielintern/rueckfall statt kuratiert/Lagrange/Mond/Rueckfall) — Konsequenz der obigen Entscheidung: Monde, Lagrange-Punkte und Rest Stops laufen durch DIESELBE Aufloesungsstufe, eine weitere Aufspaltung waere kuenstlich"
  - "E-2-Dedup zusaetzlich auf die BLOSSEN MissionLocality-Systemnamen (Pyro/Stanton/Nyx, erst durch E-1 ueberhaupt erreichbar) ausgeweitet, nicht nur auf die drei explizit genannten *SolarSystem-Paare — sonst waeren nach E-1 drei NEUE sichtbare Duplikate entstanden (Pyro/Stanton/Nyx neben Pyro (System)/Stanton (System)/Nyx (System)), exakt dieselbe Klasse Befund wie die vom Betreiber benannten drei Paare"
  - "Aussenposten ohne eigenen Spielnamen (17 Rohbezeichner) auf ihren tragenden Planeten/Mond hochgezogen (kanonRoh, Praefix-Regex) statt lesbar umbenannt — die Spieldaten fuehren fuer sie KEINEN Anzeigenamen (name = '@<eigener Rohbezeichner>', loc() findet nichts), eine Umbenennung waere Erfindung"
  - "missionsOrtsarten-Klinke steht auf 4 (D-03s Ziel), nicht auf dem gemessenen Ist-Wert 6 — mehr Ortsarten sind Zugewinn, kein Grund die Klinke schaerfer zu stellen"
  - "missionenMitOrt-Klinke auf 1150 (2% Toleranz unter dem gemessenen Wert 1180), nicht auf 800 (urspruenglicher ROADMAP-Zielwert, jetzt uebertroffen) und nicht exakt auf 1180 — der Missionsbestand schwankt legitim mit dem Patch"

requirements-completed: [D-02, D-03]

coverage:
  - id: D1
    description: "Vierte Ortsquelle (E-1): ContractPrerequisite_Locality.localityAvailable auf Contract-, subContract- und Handler-Ebene, Vorrang vor locationAvailable; Familien mit Ortsangabe 609 -> 1.180/1.347"
    requirement: "D-01 (erweitert)"
    verification:
      - kind: other
        ref: "node scripts/probes/missionsorte-messung.mjs (1180 Familien mit Ortsangabe)"
        status: pass
      - kind: other
        ref: "npm run verify:metrics (missionenMitOrt gruen gegen Klinke 1150)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Katalog-Dedup (E-2): *Star/*SolarSystem- UND blosse MissionLocality-Systemnamen (Pyro/Stanton/Nyx) fallen ueber kanonRoh() in EINEN Katalogeintrag; kein Systemname steht zweimal im Filter"
    requirement: "D-02 (erweitert)"
    verification:
      - kind: other
        ref: "node -e Namens-Duplikat-Scan ueber db.localities (0 Duplikate)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Langschwanz lesbar (E-3/Task 1): 20 der 57 Welle-1-Katalogeintraege bewusst gemergt (3x *SolarSystem, 17x Aussenposten hochgezogen), 12 neue Eintraege mit Spielnamen (Monde, Lagrange-Punkte, Rest Stops, Gefaengniskolonie); kein Eintrag unbeabsichtigt verschwunden"
    requirement: "D-02"
    verification:
      - kind: other
        ref: "node -e Katalog-Diff Welle1 (57) vs. jetzt (49): Verlust exakt die 20 beabsichtigten, Zugewinn 12 neue"
        status: pass
    human_judgment: false
  - id: D4
    description: "Slot-Art erhalten statt kollabieren (D-03): braces() unterscheidet Spielort/Zielort/Abholort/Lieferort ueber SLOT_NAMES, selektiv nur wenn das letzte Segment die Ortsform (Address) ist; phLabel() beschriftet den Chip lesbar in beiden Anzeige-Bauteilen"
    requirement: "D-03"
    verification:
      - kind: other
        ref: "node scripts/probes/missionsorte-messung.mjs --slots (6 Ortsarten, Gegenprobe deckungsgleich mit meta.counts.slotArten)"
        status: pass
      - kind: other
        ref: "dist/missionen/red-wind-discreet-courier-run.html: Pickup Location UND Dropoff Location als zwei Chips im selben Text"
        status: pass
      - kind: other
        ref: "Nicht-Regression: Top-10-Nicht-Ortsmarken vor/nach identisch, 0 Marken mit Leerzeichen, DE/EN-Chipzahlen exakt gleich (Location 1099/1099, Destination 302/302, Pickup Location 78/78, Dropoff Location 60/60)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Zweite Sperrklinke missionsOrtsarten (min 4) + missionenMitOrt auf 1150 angehoben"
    requirement: "D-03"
    verification:
      - kind: other
        ref: "npm run verify:metrics (Bijektion 21=21, alle Kennzahlen gruen)"
        status: pass
      - kind: other
        ref: "Gegenprobe: meta.counts.ortsarten auf 1 gesetzt, Tor reisst mit korrekter FEHLER-Meldung, Kopie danach entfernt"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm run build && npm run gate gruen, normal UND mit STAGING=1"
    requirement: null
    verification:
      - kind: other
        ref: "npm run gate (22/22, Gesamtzeit 354.2s)"
        status: pass
      - kind: other
        ref: "STAGING=1 npm run gate (22/22, sauberer Lauf ohne Nebenlaeufigkeit, Gesamtzeit 228.2s)"
        status: pass
    human_judgment: false

duration: ~3h
completed: 2026-08-23
status: complete
---

# Phase 18 Plan 02: Vierte Ortsquelle, Katalog-Dedup, lesbarer Langschwanz und Slot-Art Summary

**Familien mit Ortsangabe 609 → 1.180 von 1.347 (87,6 %) über eine vierte, bislang ungelesene Ortsquelle (ContractPrerequisite_Locality inkl. subContracts-Ebene); der Ortskatalog nennt jetzt Monde, Lagrange-Punkte und Rest Stops mit ihren echten Spielnamen statt Rohbezeichnern, ohne Duplikate; Abhol-, Liefer-, Ziel- und Spielort sind im Missionstext beider Sprachfassungen unterscheidbar (D-03).**

## Performance

- **Duration:** ~3h
- **Completed:** 2026-08-23T18:10:00Z
- **Tasks:** 3 Plan-Aufgaben (kombiniert mit den drei Betreiber-Erweiterungen E-1/E-2/E-3, siehe unten) in 3 Commits
- **Files modified:** 9

## Accomplishments

- **E-1 (vierte Ortsquelle, höchste Priorität).** `scripts/datamine-missions.mjs` liest jetzt zusätzlich `ContractPrerequisite_Locality.localityAvailable` (→ `MissionLocality`, die reichere Struktur mit eigenen `places[]`) auf drei Ebenen: Contract-, **neu** subContract- (bisher überhaupt nicht gelesen — `subContracts[].additionalPrerequisites[]`) und Handler-Ebene. Erkennung über das Vorhandensein des Feldes selbst (`p.localityAvailable?.__ref`), nicht über `__type` — der Warnhinweis im Auftrag, dass `__type` bei tiefem Lesen fehlen kann, wurde gegen die installierte 4.9.0 nachgemessen (an manchen Stellen ist `__type` vorhanden, an anderen nicht; die feldbasierte Erkennung ist in jedem Fall robust). Ergebnis: Familien mit Ortsangabe **609 → 1.180 von 1.347** (Ausgangswert vor Phase 18: 43). Selbstauskunft druckt die Aufschlüsselung nach Feldart (localityAvailable 1.397, locationAvailable 240) und Ebene (Contract 1.355, subContract 14, Handler 268).
- **E-2 (Katalog-Dedup).** `kanonRoh()` faltet Rohbezeichner-Varianten VOR der Katalog-Id-Bildung zusammen: die drei vom Betreiber benannten Paare (`PyroSolarSystem`→`PyroStar`, `StantonSolarSystem`→`StantonStar`, `NyxSolarSystem`→`NyxStar`) — UND zusätzlich, als direkte Folge von E-1, drei neu erreichbare bloße MissionLocality-Systemnamen (`Pyro`/`Stanton`/`Nyx`), die ohne diese Erweiterung als drei WEITERE sichtbare Duplikate neben `Pyro (System)`/`Stanton (System)`/`Nyx (System)` erschienen wären — dieselbe Fehlerklasse, nur erst durch E-1 sichtbar geworden. Ein Namens-Duplikat-Scan über den fertigen Katalog (49 Einträge) findet 0 Duplikate.
- **E-3 / Plan-Task 1 (Langschwanz lesbar).** `prettyLoc()` löst jetzt dreistufig auf: kuratiert (`STARMAP_NAMES`, 8 System-/Kerneinträge) → **spielintern** (`starmapKeyToDisplay`, das Spiel selbst nennt über sein `name`-Feld einen lesbaren Eigennamen) → `humanize()`-Rückfall. Die spielinterne Stufe deckt empirisch **den gesamten Langschwanz ab, ohne eine zweite Handtabelle**: Monde (`Stanton1b` → „Aberdeen", `Pyro5c` → „Adir"), Lagrange-Punkte (`Stanton2_L1` → „CRU L1", `Pyro6_L1` → „PYR6 L1"), Rest Stops (`RR_P3_L1` → „Starlight Service Station", `RR_P2_L4` → „Checkmate") und sogar die Gefängniskolonie (`PrisonMine_Stanton1b` → **„Klescher Rehabilitation Facility"** — der echte Spielname, nicht erfunden). Aussenposten ohne eigenen Spielnamen (17 Rohbezeichner, `name` löst zu nichts auf) werden über einen Präfix-Regex auf ihren tragenden Planeten/Mond hochgezogen (`Pyro2_Outpost_…` → dieselbe Katalog-Id wie `Pyro2` → „Monox"). Katalog-Diff gegen Welle 1: von 57 auf 49 Einträge — Verlust exakt die 20 beabsichtigten (3× SolarSystem-Merge, 17× Outpost-Hochzug), Zugewinn 12 neue (Monde, Rest Stops, Systemgruppierungen). Verbleibender Rückfall (16,3 % der Vorkommen, 9 Rohbezeichner: `RegionA`–`RegionD`, `PyroAndNyx`, `StantonAndNyx`, `StantonAndPyro`, `StantonPyroNyx`, `RR_P6_LEO`) sind mehrsystemige Quadranten-Gruppierungen ohne einzelnen Spielnamen plus eine echte Lücke (`RR_P6_LEO`/„Pyro_ruinstation" hat keinen `global.ini`-Eintrag) — `humanize()` liefert dafür bereits lesbare Labels ("Region A" etc.).
- **Plan-Task 2 (D-03, Slot-Art).** `braces()` nimmt das erste statt letzte Trennsegment **nur**, wenn das letzte Segment die Ortsform (`Address`) ist (`ORT_FORM`), über `SLOT_NAMES` (Spielort/Zielort/Abholort/Lieferort). Die 47 übrigen Markensorten (voran die Contractor-Titelfragmente) bleiben wörtlich unverändert — bestätigt: die Top-10-Nicht-Ortsmarken sind vor und nach der Änderung identisch (`TargetName` 263, `MissionMaxSCUSize` 181, `SerialNumber` 124, `Last` 95, `Location` 83, `CargoGradeToken` 80, `ScripAmount` 79, `ReputationRank` 78, `SignOff` 51, `ApprovalCode` 50). Die Sammelmarke `{Address}` fällt von 932 auf **0** Vorkommen. `phLabel()` (neu in `src/lib/missions.ts`) übersetzt eine Marke lesbar (PH_TITLE, sonst `deCamel()`) — genutzt in `titleParts()`/`parts()` in `MissionsApp.astro` und `MissionDetail.astro`, dieselbe Aufbereitung, die die SEO-Texte schon immer benutzten, jetzt auch für die sichtbaren Chips.
- **Beweis am gebauten Artefakt.** `dist/missionen/red-wind-discreet-courier-run.html` zeigt „Pickup Location" und „Dropoff Location" als zwei unterscheidbare Chips im selben Auftragstext (24 Familien mit beiden Chips im `desc` gefunden, diese als Beispiel gewählt). DE/EN-Chipzählung exakt gleich: `Location` 1.099/1.099, `Destination` 302/302, `Pickup Location` 78/78, `Dropoff Location` 60/60 (über je 1.348 Dateien, `dist/missionen`+`missionen.html` gegen `dist/de/missionen`+`de/missionen.html`).
- **Zweite Sperrklinke (Plan-Task 3).** `missionsOrtsarten` (min 4) in `scripts/verify-metrics.mjs`/`scripts/lib/metrics-baseline.mjs`; Gegenprobe durchgeführt (`meta.counts.ortsarten` auf 1 gesetzt → Tor reißt mit „liegt unter der Klinke 4"-Meldung, Kopie danach entfernt). `missionenMitOrt` von 600 auf **1150** angehoben (E-1 hat 1.180 gemessen, 2 % Toleranz) — Grundsatz 5, nur nach oben. Bijektion Ableser↔Baseline: 21 = 21.
- **`.planning/WINDOWS.md` id 44 geschlossen.** Die in `18-01-SUMMARY.md` offen gelassene Betreiber-Entscheidung („ROADMAP-Zielwert 800 senken oder vierte Quelle suchen") ist durch E-1 erledigt: 1.180 liegt deutlich über 800.
- `npm run build && npm run gate` grün (22/22), **normal UND mit `STAGING=1`** (zweimal sauber durchlaufen — ein erster `STAGING=1`-Gate-Lauf schlug an `audit:site` fehl, weil ich parallel dazu einen konkurrierenden `npm run build` ohne `STAGING=1` gegen dasselbe `dist/`-Verzeichnis laufen ließ; siehe Issues Encountered).

## Task Commits

1. **Task 1 (erweitert: E-1 + E-2 + E-3): vierte Ortsquelle, Katalog-Dedup, Langschwanz lesbar** - `8b9206b` (feat)
2. **Task 2: Slot-Art erhalten statt kollabieren (D-03)** - `8741bd7` (feat)
3. **Task 3: zweite Sperrklinke + missionenMitOrt angehoben** - `403e766` (feat)

## Files Created/Modified

- `scripts/datamine-missions.mjs` - vierte Ortsquelle (E-1), `kanonRoh()`/dreistufiges `prettyLoc()` (E-2/E-3), `braces()`/`SLOT_NAMES`/`ORT_FORM` (D-03), erweiterte Selbstauskunft
- `src/data/missions.json` - neu erzeugt gegen CL 12344265 (unveränderte Patch-Kennung — kein neuer Datenlauf gegen einen anderen Patch, nur der Erzeuger wurde erweitert)
- `src/lib/missions.ts` - `phLabel()`, vier neue `PH_TITLE`-Einträge
- `src/components/MissionsApp.astro` - `titleParts()` nutzt `phLabel()`
- `src/components/MissionDetail.astro` - `parts()` nutzt `phLabel()`
- `scripts/probes/missionsorte-messung.mjs` - neuer Schalter `--slots`
- `scripts/verify-metrics.mjs` - Ableser `missionsOrtsarten`
- `scripts/lib/metrics-baseline.mjs` - Baseline-Zeile `missionsOrtsarten`; `missionenMitOrt` 600 → 1150
- `.planning/WINDOWS.md` - id 44 (D-01-Zielwert unerreichbar) auf „fixed" gesetzt

## Decisions Made

- **Reihenfolge E-1 → E-2 → E-3 → Plan-Task D-03** wie im erweiterten Auftrag vorgegeben — E-1 verändert, welche Rohbezeichner überhaupt vorkommen, daher zuerst.
- **E-3 nicht über eine zweite kuratierte Tabelle gelöst.** Der Plan (und `read_first`) sahen vor, die `MOON`-Tabelle aus `datamine-stanton-anchors.mjs` zu übernehmen und Lagrange-Punkte über eine Regex-Formatierung zu bauen. Stattdessen: eine dritte Auflösungsstufe in `prettyLoc()`, die das bereits im Erzeuger vorhandene `starmap`-Muster (`loc(d?.displayName) ?? loc(d?.name)`) auch für den Katalog nutzt. Das deckt nicht nur Monde und Lagrange-Punkte ab, sondern auch Rest Stops und die Gefängniskolonie — mit den ECHTEN, im Spiel verwendeten Namen (z. B. „Klescher Rehabilitation Facility" statt einer selbst erfundenen Übersetzung) — und veraltet nicht wie eine Handtabelle, wenn ein künftiger Patch neue Monde/Stationen einführt.
- **Selbstauskunft mit drei statt vier Zweigen.** Direkte Folge der vorigen Entscheidung: Monde, Lagrange-Punkte und Rest Stops laufen durch dieselbe Auflösungsstufe („spielintern"), eine künstliche Aufspaltung in „Lagrange" und „Mond" hätte keine Grundlage im Code gehabt.
- **E-2-Dedup auf drei zusätzliche Paare ausgeweitet** (Pyro/Stanton/Nyx als bloße MissionLocality-Systemnamen), die der Betreiber nicht explizit nannte, aber die erst durch E-1 überhaupt sichtbar wurden — dieselbe Fehlerklasse wie die drei genannten Paare (Rule 1/2: gefundener Bug derselben Art wird mitbehoben, nicht nur der explizit benannte Teil).
- **Aussenposten hochgezogen statt umbenannt.** Die Spieldaten führen für die 17 Aussenposten-Rohbezeichner keinen Anzeigenamen (`name = '@<eigener Rohbezeichner>'`, `loc()` findet nichts in der `global.ini`) — eine Umbenennung wäre Erfindung gewesen. Hochzug auf den tragenden Planeten/Mond ist die im Auftrag selbst vorgeschlagene Alternative und die einzige, die von den Daten gedeckt ist.
- **Sperrklinken-Werte:** `missionsOrtsarten` auf 4 (D-03s Ziel), nicht auf dem gemessenen Ist-Wert 6 — mehr Ortsarten sind Zugewinn. `missionenMitOrt` auf 1150 (2 % Toleranz unter 1180), nicht auf 1180 exakt — der Missionsbestand schwankt legitim mit jedem Patch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical, im Auftrag selbst vorgegeben] Drei zusätzliche E-2-Dedup-Paare (bloße MissionLocality-Systemnamen)**
- **Found during:** Task 1 (E-2), nach dem ersten Testlauf von E-1
- **Issue:** Nach E-1 sind `Pyro`/`Stanton`/`Nyx` (bloße `MissionLocality`-Systemnamen, ohne "Star"/"SolarSystem"-Suffix) erstmals über die neue Quelle 4 erreichbar. Ohne Gegenmaßnahme wären sie als DREI ZUSÄTZLICHE, sichtbare Katalogeinträge neben `Pyro (System)`/`Stanton (System)`/`Nyx (System)` erschienen — exakt dieselbe Duplikat-Klasse, die E-2 explizit beheben sollte, nur an einer vom Betreiber nicht vorhergesehenen Stelle.
- **Fix:** `ROH_ALIAS` um `pyro: 'PyroStar'`, `stanton: 'StantonStar'`, `nyx: 'NyxStar'` ergänzt; `kanonRoh()` wird jetzt auch in der `MissionLocality`-Konstruktionsschleife angewendet (nicht nur in `locBucket()`), sodass die MissionLocality-Einträge (mit ihren eigenen `places[]`) die Katalog-Id zuerst belegen und die spätere `locBucket()`-Auflösung sie wiederverwendet statt zu überschreiben.
- **Files modified:** `scripts/datamine-missions.mjs`
- **Verification:** Namens-Duplikat-Scan über den fertigen Katalog (`node -e`) findet 0 Duplikate; `rueckfall`-Anteil sank von 28,4 % auf 16,3 % der Vorkommen.
- **Committed in:** `8b9206b` (Task 1 commit)

---

**Total deviations:** 1 (Rule 2 — Erweiterung eines vom Betreiber selbst beauftragten Fixes auf eine gleichartige, erst durch die eigene Arbeit sichtbar gewordene Instanz)
**Impact on plan:** Keine Scope-Ausweitung über den erweiterten Auftrag hinaus — die Erweiterung liegt vollständig innerhalb dessen, was E-2 ("kein System steht zweimal im Filter") ohnehin verlangte.

## Issues Encountered

- **Selbstverursachte Nebenläufigkeit beim ersten `STAGING=1 npm run gate`-Lauf.** Ein `STAGING=1 npm run gate`-Lauf im Hintergrund schlug an `audit:site` fehl. Ursache: während dieser Lauf noch aktiv war, habe ich in einem parallelen Bash-Aufruf `npm run build` (ohne `STAGING=1`) gegen dasselbe `dist/`-Verzeichnis gestartet — der Hintergrundlauf las `dist/` vermutlich während des Neuaufbaus. Ein sauberer, sequenzieller Wiederholungslauf (kein konkurrierender Prozess) war fehlerfrei: `STAGING=1 npm run build` → `STAGING=1 npm run audit:site` direkt (0 FEHLER) und `STAGING=1 npm run gate` vollständig (22/22, 228,2 s). Kein Befund in den eigenen Änderungen — reine Werkzeug-Nebenläufigkeit, die durch striktere Sequenzierung vermieden wurde. Als Lehre für künftige Sitzungen: nie einen zweiten `npm run build`/`gate`-Lauf starten, während ein Hintergrundlauf gegen dasselbe `dist/`-Verzeichnis aktiv ist.
- **`npm run gate:data` bleibt rot** an `verify:items` (1 Ort nicht mehr live in den UEX-Preiszeilen, `assets/universal-items.json`) — derselbe vorbestehende, von dieser Phase unabhängige Befund, den bereits `18-01-SUMMARY.md` dokumentiert hat. Kein Item-/Preis-Code wurde von diesem Plan berührt (`files_modified` umfasst ausschließlich Missions- und Sperrklinken-Dateien).
- **Git-Bash-Forks auf Windows sind wiederholt gestorben** (`cygheap read copy failed`) bei `tail`-Pipes und Bash-Heredocs mit Backslash-Regex — bestätigt die Umgebungswarnung. Umgangen durch Umleitung in Dateien (`> log 2>&1`, danach `Read`) statt Pipes, und durch den `Write`-Tool statt Heredocs für Node-Diagnoseskripte.

## User Setup Required

None - keine externe Diensteinrichtung nötig.

## Next Phase Readiness

- D-01/D-02/D-03-Mechanismus steht end-to-end und ist bewiesen; Phase 18 hat mit D-04 (Patch-Kennung je Datenstand) noch einen offenen Punkt aus der ROADMAP, der in dieser Welle nicht angefasst wurde (außerhalb des Aufgabenbereichs von Plan 02).
- **Sichturteil für den Betreiber (nicht von einem Skript zu entscheiden):** die neun verbleibenden `rueckfall`-Katalogeinträge (`Region A`–`Region D`, `Pyro And Nyx`, `Stanton And Nyx`, `Stanton And Pyro`, `Stanton Pyro Nyx`, `RR P6 LEO`) sind ehrlich (keine erfundene Präzision), aber nicht besonders geschliffen formuliert — z. B. ist unklar, ob „Region A"–„Region D" für Endnutzer aussagekräftig genug sind, oder ob „Pyro And Nyx" besser als „Pyro & Nyx" oder umformuliert stünde. Kein Skript kann diese Wortwahl beurteilen; empfohlen als Punkt für die nächste Sichtrunde.
- `git stash drop stash@{0}` aus `18-01-SUMMARY.md` steht weiterhin als kleiner, risikoloser manueller Aufräumschritt aus (in dieser Sitzung nicht erneut versucht, außerhalb des Aufgabenbereichs).

---
*Phase: 18-missionen-wissen-wo-sie-spielen*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: scripts/datamine-missions.mjs
- FOUND: src/data/missions.json
- FOUND: src/lib/missions.ts
- FOUND: scripts/verify-metrics.mjs
- FOUND: scripts/lib/metrics-baseline.mjs
- FOUND: commit 8b9206b (Task 1, erweitert E-1/E-2/E-3)
- FOUND: commit 8741bd7 (Task 2, D-03)
- FOUND: commit 403e766 (Task 3, Sperrklinken)
