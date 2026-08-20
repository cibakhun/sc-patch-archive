---
phase: 14-schiffs-datenkarte-entstapeln
plan: 04
subsystem: ui
tags: [astro, css-grid, gate-registry, ship-detail, dedup-gate, playwright-core]

requires:
  - phase: 14-schiffs-datenkarte-entstapeln (Plan 01)
    provides: "verify-shipcard.mjs (disabled, Zielzustandspruefer) + schiffskarte-messung.mjs (Messsonde), beide vorgefuehrt/reproduziert"
  - phase: 14-schiffs-datenkarte-entstapeln (Plan 03)
    provides: "vier Kapitel (Kaufen/Leistung/Ausstattung/Umfeld), Datenblatt entfernt, sechs Balkenstellen aufgeloest, verify-shipcard.mjs erstmals gruen"
provides:
  - "`.sd__ch2col`/`.sd__chsec` — kapitelinterne Zweispaltigkeit ab 1100px fuer Ausstattung (4 Zellen) und Umfeld (4 Zellen), darunter unveraendert einspaltig"
  - "Gescopete Mindestbreiten-Ueberschreibungen fuer sd__dims/sd__grid/sd__qgrid/sd__slots/sd__inscards/arm__sum innerhalb .sd__ch2col — verhindern, dass Innenraster in der halbierten Spalte in mehr Zeilen umbrechen als bei voller Breite"
  - "scripts/probes/schiffskarte-messung.mjs: Messgruppe i (Backstop E2, Kapitel-/Innenraster-Breitenueberlauf bei 1280x720), Perzentilzeilen-/Kapitelhoehen-Auskunft in Gruppe h, Hoehen-Sperrklinke in Hausform (Wert/Regel/Anlass)"
  - "verify:shipcard scharf in scripts/lib/gate-registry.mjs (Aussetzungsgrund entfernt, laeuft in Schiene A)"
  - "fuenf neue Sichturteile (id 16-20) in .planning/WINDOWS.md, kind sight, phase 14, jeweils mit gemessenem Wert"
affects: []

tech-stack:
  added: []
  patterns:
    - "Site-weite auto-fit/minmax-Grids per hoeherer Selektor-Spezifitaet (.sd__ch2col .sd__grid statt .sd__grid) NUR innerhalb eines schmaleren Containers ueberschreiben, statt eine zweite Bauform einzufuehren — dieselbe Regel bleibt ausserhalb unveraendert wirksam"
    - "hyphens:auto + overflow-wrap:anywhere als Sicherheitsnetz fuer einzelne lange, unuebersetzte zusammengesetzte Woerter in schmalen Grid-Zellen — kontrollierter Wortumbruch statt Rohtext-Ueberlauf in die Nachbarzelle"

key-files:
  created: []
  modified:
    - src/components/ShipDetail.astro
    - scripts/probes/schiffskarte-messung.mjs
    - scripts/lib/gate-registry.mjs
    - .planning/WINDOWS.md
    - .planning/ROADMAP.md

key-decisions:
  - "Die aus Task 1 vorweggenommene Zwangs-Einspaltigkeit des Grundriss-Rasters (sd__dims) wurde nach der Schlussmessung wieder auf zwei Spalten zurueckgenommen: Bewaffnung (arm__list, turmgruppen-getrieben) ist in Zeile 1 der Ausstattung IMMER die groessere Zelle, die Zeilenhoehe haengt also nicht an dims — zweispaltig misst 76px weniger UND wirkt am Bildpunkt nicht gequetscht. Die urspruengliche Sorge war eine Annahme aus dem UI-SPEC, keine Messung."
  - "arm__sum (Bewaffnung-Kennzahlen) bekam als einziges der ueberschriebenen Innenraster zusaetzlich hyphens:auto + overflow-wrap:anywhere, weil eine reine Mindestbreiten-Verkleinerung dort das zusammengesetzte deutsche Wort 'GEGENMASSNAHMEN' ueber die Zellgrenze laufen liess (per Bildschirmfoto vorgefuehrt) — kontrollierter Wortumbruch statt Rohtext-Ueberlauf, optisch nicht perfekt, aber ohne Bruch."
  - "Die Hoehen-Sperrklinke bleibt bei den in Erfolgskriterium 6 festgeschriebenen 4.200px stehen, NICHT auf den gemessenen Ist-Wert (4.179px DE) abgesenkt — 21px Reserve gegen Rundungsschwankungen zwischen zwei Laeufen desselben Standes, wie in der Sonde dokumentiert (Grundsatz 5: eine Klinke ist eine Untergrenze fuer kuenftige Laeufe, kein exakter Momentwert)."
  - "scripts/probes/schiffskarte-messung.mjs bekam eine neunte Messgruppe (i-rasterbreite-1280, Backstop E2) und eine Erweiterung von Gruppe h um die Perzentilzeilen-/Kapitelhoehen-Auskunft — nicht im Plan-Dateisatz vorgeschrieben, aber von der eigenen Acceptance-Criteria-Formulierung des Plans verlangt ('kein Innenraster ueberschreitet die Kapitelbreite', 'die Sonde meldet die Zahl der Perzentilzeilen')."

patterns-established:
  - "Vorweggenommene Sonderfaelle aus einem frueheren Task bleiben nur so lange gueltig, wie die Schlussmessung sie bestaetigt — eine Annahme, die sich als teurer als vermutet herausstellt, wird zurueckgenommen und die Ruecknahme im selben Kommentar begruendet, nicht stillschweigend uebermalt."

requirements-completed: [D-01, D-03]

coverage:
  - id: D1
    description: "Ab 1100px stehen die Unterabschnitte der Ausstattung als 2x2-Raster und die des Umfelds zweispaltig; darunter beide einspaltig wie in Welle 3"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node -e Zaehlung sd__chsec je Kapitel gegen dist/schiffe/anvl-carrack.html (Ausstattung 4, Umfeld 3 — Carrack traegt keine Patch-Chronik) und dist/schiffe/argo-atls.html (Ausstattung 1, Umfeld 4)"
        status: pass
      - kind: other
        ref: "playwright-core Screenshots gegen localhost:4322 (Carrack/Idris-M/ATLS, DE+EN, dunkel+hell, 1280x720+360x740) — visuell bestaetigt: 2x2-Raster ab 1100px, keine Ueberlappung, keine abgeschnittenen Woerter ausser dem dokumentierten arm__sum-Kompromiss"
        status: pass
    human_judgment: false
  - id: D2
    description: "Die Carrack liegt bei 1280x720 bei hoechstens 4.200px, in beiden Sprachen, mit der Sperrklinke in Hausform (Wert/Regel/Anlass) in der Sonde festgeschrieben"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4322 — 216/216 Messpunkte bestanden, Carrack DE 4.179px / EN 4.117px gegen die Marke 4.200px"
        status: pass
    human_judgment: false
  - id: D3
    description: "Kargstes und groesstes Schiff mitgemessen; bei 360px kein Ueberlauf, alle Pillen erreichbar, sichtbare Bildlaufleiste, keine umbrechende Pille — in beiden Sprachen und Farbmodi; kein Innenraster ueberschreitet die Kapitelbreite (Backstop E2)"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4322 — Gruppen d/e/g/i, alle 216 Messpunkte OK, schmalster gemessener Spielraum 28.0px an allen drei Schiffen"
        status: pass
    human_judgment: false
  - id: D4
    description: "Das Entdopplungs-Tor verify:shipcard ist scharf geschaltet (Aussetzungsgrund entfernt), laeuft im Laufplan der Schiene A, und npm run build && npm run gate sind gruen, normal UND mit STAGING=1"
    requirement: "D-03"
    verification:
      - kind: other
        ref: "node scripts/verify-shipcard.mjs (Exit 0, 0 Befunde, Zombie-Waechter mit 4 greifenden Ausnahmen); node scripts/run-gate.mjs --list (verify:shipcard im Laufplan, kein Schuldenposten); npm run build + npm run gate (19/19 gruen, normal UND STAGING=1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Fuenf Sichturteile aus dem Gestaltungsvertrag stehen einzeln, offen, mit Messwert in .planning/WINDOWS.md — Tabelle und JSON-Spiegel deckungsgleich, Kopfzeilen-Zaehler mitgewandert"
    verification: []
    human_judgment: true
    rationale: "Reine Sichturteile (14-UI-SPEC.md § Sichturteile) — kein Skript kann 'wirkt subtil', 'wirkt vollstaendig oder wie ein Rest', 'traegt als Orientierung', 'liest sich als EIN Kapitel' oder 'wirkt nackt' entscheiden. Als fuenf eigenstaendige Punkte (id 16-20) mit den in Task 2 gemessenen Werten an den Betreiber uebergeben."

duration: ~75min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 4: Zweispaltig, unter der Klinke, Tor scharf Summary

**Kapitelinterne Zweispaltigkeit fuer Ausstattung und Umfeld bringt die Carrack von 4.464px auf 4.179px (DE) / 4.117px (EN) — unter die 4.200px-Sperrklinke; unterwegs widerlegte die Messung eine eigene Annahme aus Task 1 (Grundriss-Raster bleibt zweispaltig) und fand einen zweiten, ungeplanten Hoehentreiber (auto-fit-Raster brechen in der halben Spalte um); `verify:shipcard` laeuft jetzt scharf in der Torkette.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-08-18T05:10:00Z (im Anschluss an 14-03)
- **Completed:** 2026-08-18T06:13:26Z
- **Tasks:** 3
- **Files modified:** 5 (4 aus dem Plan-Dateisatz + 1 Kommentarkorrektur an einer bereits gelisteten Datei)

## Accomplishments

- `.sd__ch2col`/`.sd__chsec` heben Ausstattung und Umfeld ab 1100px auf zwei Spalten (Ausstattung als 2x2-Raster, Umfeld ebenso) — darunter unveraendert einspaltig wie in Welle 3, keine neue Zahl ausser den bereits im UI-SPEC benannten Werten.
- Schlussmessung: Carrack bei 1280x720 dunkel **4.179px DE / 4.117px EN** (Ausgang 5.554px, −24,8 %), 21px unter der 4.200px-Marke, DE/EN-Abstand 1,5 % (Marke 5 %). Alle 216 Messpunkte der Sonde bestanden (3 Schiffe × 2 Sprachen × 2 Breiten × 2 Farbmodi × 9 Messgruppen).
- Zwei echte, gemessene Hoehentreiber gefunden und behoben, keiner davon exakt wie im UI-SPEC vorausberechnet:
  1. **Task 1s eigene Vorsichtsmassnahme war zu teuer.** Das Grundriss-Raster (`sd__dims`) wurde vorsorglich einspaltig gesetzt ("waere gequetscht"). Die Messung zeigt: Bewaffnung dominiert Zeile 1 der Ausstattung ohnehin (turmgruppen-getriebene `arm__list`), dims' eigene Spaltenzahl aendert die Zeilenhoehe nicht — zweispaltig ist 76px kuerzer und am Bild nicht gequetscht. Zurueckgenommen.
  2. **Auto-fit-Raster brechen in der halbierten Spalte um.** `sd__grid`/`sd__qgrid`/`sd__slots`/`sd__inscards` kalibrieren ihre Mindestbreite auf die volle ~1023px-Kapitelbreite; in der ~469px-Spalte liessen dieselben Mindestbreiten nur 2 statt 3-5 Spalten zu und wurden dadurch HOEHER als vor der Zweispaltigkeit. Gescopet auf kleinere Mindestbreiten gesetzt (per Bildschirmfoto gegengeprueft — ein erster, zu kleiner Wert liess "SCHILDGENERATOREN" ueber die Zellgrenze laufen, verworfen zugunsten sicherer Werte).
- `arm__sum` (Bewaffnung-Kennzahlen) bekam zusaetzlich `hyphens:auto` + `overflow-wrap:anywhere`, weil eine reine Mindestbreiten-Verkleinerung dort "GEGENMASSNAHMEN" ueber die Zellgrenze laufen liess — kontrollierter Wortumbruch statt Rohtext-Ueberlauf.
- Sonde erweitert: neue Messgruppe `i-rasterbreite-1280` (Backstop E2 — kein Innenraster ueberschreitet die Kapitelbreite, kein Kapitel ueberschreitet 1100px; schmalster gemessener Spielraum an allen drei Schiffen 28,0px), Gruppe `h-struktur` meldet zusaetzlich Perzentilzeilen und Kapitelhoehe des Leistungsprofils (messbarer Teil von Backstop E4).
- Hoehen-Sperrklinke in Hausform eingetragen (Wert 4.200px, Regel "wandert nur nach unten", Anlass mit Messlauf/Datum/Breite/Farbmodus/Ist-Wert) — bleibt bewusst bei 4.200px stehen, nicht auf den Ist-Wert abgesenkt.
- `verify:shipcard` scharf geschaltet: Aussetzungsgrund aus `scripts/lib/gate-registry.mjs` entfernt, `node scripts/run-gate.mjs --list` fuehrt es jetzt als Schritt 12 von 19, kein Schuldenposten dieser Phase bleibt gedruckt.
- `npm run build && npm run gate` gruen (19/19 Schritte, ~163s), zusaetzlich einmal vollstaendig mit `STAGING=1` (ebenfalls 19/19).
- Fuenf neue Sichturteile (id 16-20) in `.planning/WINDOWS.md`, jedes mit dem in dieser Welle gemessenen Wert — Tabelle und JSON-Spiegel deckungsgleich (7 Eintraege zu Phase 14 insgesamt: die 2 aus Welle 2 plus die 5 neuen), Kopfzeilen-Zaehler mitgezogen (offen 7→12, gesamt 15→20).

## Task Commits

1. **Task 1: Zweispaltig innerhalb des Kapitels** - `332a4f1` (feat)
2. **Task 2: Schlussmessung, Sperrklinke, und das Tor wird scharf** - `b69377b` (fix) + `a87f8cd` (docs, Kommentarkorrektur nach Review)
3. **Task 3: Die fuenf Fragen, die kein Skript beantwortet** - `5230e3c` (docs)

**Plan metadata:** siehe finaler Commit dieses Plans (folgt nach diesem SUMMARY)

## Files Created/Modified

- `src/components/ShipDetail.astro` - `.sd__ch2col`/`.sd__chsec` Markup+Stil, gescopete Mindestbreiten-Ueberschreibungen fuer sechs Innenraster-Klassen, `hyphens:auto`/`overflow-wrap:anywhere` fuer arm__sum
- `scripts/probes/schiffskarte-messung.mjs` - neunte Messgruppe (Backstop E2), Perzentilzeilen-/Kapitelhoehen-Auskunft in Gruppe h, Hoehen-Sperrklinke in Hausform
- `scripts/lib/gate-registry.mjs` - `verify:shipcard`-Eintrag: Aussetzungsgrund entfernt
- `.planning/WINDOWS.md` - fuenf neue Sichturteile (id 16-20), Kopfzeilen-Zaehler aktualisiert
- `.planning/ROADMAP.md` - Schlussmessung ergaenzt, Plan 4/4 abgehakt, verwaisten Textrest entfernt

## Decisions Made

- **Grundriss-Raster (`sd__dims`) bleibt zweispaltig, entgegen der in Task 1 vorweggenommenen Annahme.** Bewaffnung dominiert Zeile 1 der Ausstattung ohnehin (turmgruppen-getriebene `arm__list`); dims' eigene Spaltenzahl aendert die Zeilenhoehe nicht. Zweispaltig gemessen 76px kuerzer und am Bild nicht gequetscht — die urspruengliche Sorge war eine Annahme, keine Messung, wie der Kommentar an der Fundstelle jetzt dokumentiert.
- **arm__sum bekommt `hyphens:auto` + `overflow-wrap:anywhere` statt einer noch kleineren Mindestbreite.** Eine reine Verkleinerung auf vier Spalten liess "GEGENMASSNAHMEN" ueber die Zellgrenze laufen (Bildschirmfoto). Kontrollierter Wortumbruch ist optisch nicht perfekt, aber ohne Bruch — nur innerhalb `.sd__ch2col` gescopet, keine site-weite Typografie-Aenderung.
- **Sperrklinke bleibt bei 4.200px, nicht auf 4.179px gesenkt.** 21px Reserve gegen Rundungsschwankungen zwischen zwei Laeufen desselben Standes; die Klinke ist eine Untergrenze fuer kuenftige Laeufe, kein Momentwert des heutigen (Grundsatz 5).
- **Sonde um Gruppe i und die Gruppe-h-Erweiterung ergaenzt**, ausserhalb des im Plan gelisteten Umfangs, aber von dessen eigenen Acceptance-Criteria verlangt (Backstop E2 muss "gemeldet" werden, Perzentilzeilen/Kapitelhoehe muessen "im SUMMARY stehen").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1s vorweggenommene Einspaltigkeit des Grundriss-Rasters war teurer als das Problem, das sie loesen sollte**
- **Found during:** Task 2 (Schlussmessung zeigte 4.464px statt der verlangten ≤4.200px)
- **Issue:** `sd__dims` wurde in Task 1 vorsorglich auf eine Spalte gesetzt, weil zwei ~230px-Unterspalten "gequetscht" wirken koennten. Gemessen dominiert stattdessen Bewaffnung (turmgruppen-getrieben) ohnehin Zeile 1 der Ausstattung — die Einspaltigkeit von dims kostete ~76px Hoehe, ohne einen Nutzen zu bringen, den die Messung bestaetigt haette.
- **Fix:** `.sd__ch2col .sd__dims` auf `minmax(0,1fr) minmax(0,1fr)` (zweispaltig) zurueckgesetzt.
- **Files modified:** src/components/ShipDetail.astro
- **Verification:** Zeilenhoehe 589px→513px (−76px), Bildschirmfoto bei 1280px zeigt lesbaren Grundriss-Kasten und Frachtwuerfel ohne Quetschung.
- **Committed in:** `b69377b` (Task 2 Commit)

**2. [Rule 1 - Bug] Auto-fit-Innenraster brachen in der halbierten Spalte um und wurden dadurch hoeher statt kuerzer**
- **Found during:** Task 2 (Schlussmessung, exakt der "zweite Verdaechtige" aus dem Plan-Text)
- **Issue:** `sd__grid`/`sd__qgrid`/`sd__slots`/`sd__inscards` nutzen `repeat(auto-fit,minmax(…))` mit einer auf die volle Kapitelbreite kalibrierten Mindestbreite. In der ~469px-Spalte liessen dieselben Mindestbreiten nur 2 statt 3-5 Spalten zu — mehr Zeilen, mehr Hoehe, das Gegenteil des Planziels.
- **Fix:** Gescopete Ueberschreibungen (`.sd__ch2col .sd__grid` usw.) mit kleineren Mindestbreiten, sodass dieselbe Spaltenzahl wie bei voller Breite erhalten bleibt. Jeder Wert per Bildschirmfoto verifiziert; ein erster Versuch bei `sd__slots` (80px) liess "SCHILDGENERATOREN" ueber die Zellgrenze laufen und wurde auf 140px korrigiert.
- **Files modified:** src/components/ShipDetail.astro
- **Verification:** Carrack DE sank von 4.464px auf 4.179px; alle Bildschirmfotos zeigen keine ueber die Zellgrenze laufenden Woerter ausser dem dokumentierten arm__sum-Kompromiss (siehe Deviation 3).
- **Committed in:** `b69377b` (Task 2 Commit)

**3. [Rule 1 - Bug] arm__sum-Ueberschreibung liess "GEGENMASSNAHMEN" ueber die Zellgrenze laufen**
- **Found during:** Task 2 (Bildschirmfoto-Gegenprobe nach der arm__sum-Verkleinerung auf vier Spalten)
- **Issue:** Bei einer Mindestbreite von 110px, die vier statt drei Spalten fuer die Bewaffnung-Kennzahlen ermoeglichte, lief das Label "GEGENMASSNAHMEN" (15 Zeichen, ein zusammengesetztes Wort ohne Trennstelle) sichtbar in die Nachbarzelle hinein — kein Grid-Zeilenbruch, sondern echter Text-Ueberlauf.
- **Fix:** `hyphens:auto` (mit `lang` auf `<html>`) plus `overflow-wrap:anywhere` als Sicherheitsnetz auf `.sd__ch2col .arm__scell span`, erlaubt einen kontrollierten Umbruch innerhalb des Wortes bei einer Mindestbreite von 100px (vier Spalten).
- **Files modified:** src/components/ShipDetail.astro
- **Verification:** Bildschirmfoto nach dem Fix zeigt "GEGENMASSN"/"AHMEN" — mitten im Wort getrennt (keine Silbengrenze, `hyphens:auto` griff im getesteten Headless-Chrome nicht sichtbar), aber vollstaendig innerhalb der Zellgrenze, kein Ueberlauf mehr.
- **Committed in:** `b69377b` (Task 2 Commit), Kommentar dazu nachtraeglich korrigiert in `a87f8cd`

**4. [Rule 2 - Missing Critical] Sonde deckte Backstop E2 und den messbaren Teil von Backstop E4 noch nicht ab**
- **Found during:** Task 2 (eigene Acceptance-Criteria-Formulierung des Plans verlangte beides, der bestehende Messgruppen-Satz a-h deckte es nicht)
- **Issue:** Der Plan-Text verlangt fuer Task 2 ausdruecklich, dass die Sonde meldet, ob ein Innenraster die Kapitelbreite ueberschreitet (Backstop E2), und die Zahl der Perzentilzeilen samt Kapitelhoehe des Leistungsprofils am kargsten/groessten Schiff nennt (Backstop E4, messbarer Teil) — keine der acht bestehenden Messgruppen leistete das.
- **Fix:** Neue Messgruppe `i-rasterbreite-1280` (misst Kapitel- und Innenraster-Breiten am gerenderten Bildpunkt gegen 1100px bzw. die Kapitelbreite) und eine Erweiterung von Gruppe `h-struktur` um Perzentilzeilen-Zahl und Kapitelhoehe von `#ch-profile`.
- **Files modified:** scripts/probes/schiffskarte-messung.mjs
- **Verification:** Lauf gegen alle drei Pruefschiffe zeigt schmalsten Spielraum 28,0px (kein Ueberlauf) und deckt auf, dass das kargste Pruefschiff (`argo-atls`) gar kein Leistungsprofil-Kapitel rendert (0 statt 1-2 Perzentilzeilen) — abweichend von der im UI-SPEC angenommenen "1-2 Balken"-Erwartung, siehe WINDOWS.md id 17.
- **Committed in:** `b69377b` (Task 2 Commit)

---

**Total deviations:** 4 auto-fixed (3 Bugs, 1 Missing Critical)
**Impact on plan:** Alle vier notwendig, um Erfolgskriterium 6 (≤4.200px) tatsaechlich zu erreichen und die im Plan selbst formulierten Task-2-Abnahmekriterien zu erfuellen. Keine davon Scope-Creep — jede ist eine direkte Folge der Schlussmessung, die der Plan ausdruecklich verlangt ("Ursache gesucht und behoben, nicht die Zahl angehoben").

## Issues Encountered

- **Plan-Annahme "Carrack traegt vier Umfeld-Unterabschnitte" traf auf die Daten nicht zu.** Task 1s Acceptance Criteria erwartete `sd__chsec`-Zaehlung 4 im Umfeld-Kapitel der Carrack; tatsaechlich sind es 3 — die Carrack traegt keine verknuepften Patches (`d.patches: []` in `src/data/vehicles.json`), die Patch-Chronik-Zelle rendert deshalb nicht. Keine Datenaenderung vorgenommen (verboten fuer diese Phase); stattdessen mit `argo-atls` (dem kargsten Pruefschiff, das zufaellig einen verknuepften Patch traegt) belegt, dass die Struktur bei vollstaendigen Daten tatsaechlich vier Zellen liefert. Dokumentiert im Task-1-Commit.
- **Windows-Bash-Eigenheiten:** mehrere `tail`/`node -e`-Aufrufe scheiterten zwischenzeitlich an Cygwin-`fork`-Fehlern (`child_copy: cygheap read copy failed`) — durch Wiederholung des identischen Befehls behoben, kein Zusammenhang mit dem eigentlichen Inhalt.
- **`gsd-tools windows append` wird bewusst NICHT verwendet** (siehe Prompt-Vorgabe) — sein Frontmatter-Parser laesst das `\r` von CRLF stehen und verwirft dann seine eigene `last_updated`-Zeile. `.planning/WINDOWS.md` stattdessen direkt bearbeitet, JSON-Block nach dem Schreiben mit einer fenced-code-block-bewussten Extraktion (nicht der im Plan vorgeschlagenen naiven `lastIndexOf('[')`) auf Gueltigkeit geprueft — siehe naechster Punkt.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Known Stubs

Keine.

## Threat Flags

Keine neuen — die neuen CSS-Regeln sind reines Layout (keine neue Zeichenkette, kein `innerHTML`, keine Fremdquelle). Die erweiterten Sonden-Messgruppen lesen ausschliesslich `getBoundingClientRect()`-Werte des bereits gerenderten, vertrauenswuerdigen eigenen Markups. Threat Register des Plans (T-14-13 bis T-14-16, T-14-SC) vollstaendig wie geplant abgedeckt: `verify:shipcard` wurde erst NACH einem gruenen Lauf UND greifendem Zombie-Waechter scharf geschaltet, kein Paket installiert (`git status --porcelain` nennt an keiner Stelle `package.json`/`package-lock.json`).

## Deviations from the acceptance-criteria script itself (nicht vom Code — dokumentiert, weil sie die eigene Pruefung dieses Plans betreffen)

- **Task 1 Acceptance Criteria "Umfeld-Kapitel der Carrack liefert 4" traf nicht zu** (siehe „Issues Encountered" oben) — mit `argo-atls` als Ersatzbeleg dokumentiert, keine Code- oder Datenaenderung.
- **Task 3 Acceptance Criteria (`n===5&&rows===5`) ging von NULL vorbestehenden Phase-14-Sichturteilen aus.** Tatsaechlich existierten bereits id 14/15 aus Welle 2 (siehe Prompt-Vorgabe `<the_sight_judgements>`, die das ausdruecklich benennt: „Die UI-SPEC listet fuenf Sichturteile PLUS die zwei bereits erfassten"). `.planning/WINDOWS.md` traegt deshalb korrekt 7 Phase-14-Eintraege (2 alt + 5 neu), nicht 5 — das ist die vom Orchestrator-Prompt verlangte Zielzahl, nicht die des wortgetreu gelesenen Plan-Skripts. Mit der robusteren, fenced-code-block-bewussten Extraktion nachgewiesen, dass Tabelle und JSON-Spiegel uebereinstimmen (7/7).
- **Die im Plan vorgeschlagene naive `s.lastIndexOf('[')`-Extraktion fuer den JSON-Block ist gegen den BESTEHENDEN Dateiinhalt bereits vor diesem Plan fehlerhaft** — Eintrag id 9 (aus einer frueheren Phase) enthaelt in seiner Beschreibung die Zeichenfolge „[5]" als Markdown-aehnlichen Verweis, was `lastIndexOf('[')` faelschlich als Array-Anfang liest und `JSON.parse` mit einem Syntaxfehler abbrechen laesst — unabhaengig von den in diesem Plan neu hinzugefuegten Eintraegen. Fuer die eigene Gegenprobe stattdessen die Position des ```` ```json ````-Codezauns verwendet (robust gegen „[" innerhalb von Zeichenketten). Keine Aenderung an der Datei-Struktur noetig — nur die Pruefmethode musste robuster sein.

## Next Phase Readiness

- Phase 14 „Schiffs-Datenkarte entstapeln" ist damit **technisch vollstaendig (4/4 Plaene)**: alle acht Erfolgskriterien maschinell belegt (Entdopplung, Datenblatt weg, Kapitelgeruest+Sprungleiste, optische Unterscheidung, Balken nur im Leistungsprofil, Hoehen-Sperrklinke unter 4.200px, DE/EN-Deckungsgleichheit, `npm run build && npm run gate` gruen normal+STAGING).
- **Nicht als „Complete" markiert** (dieselbe Konvention wie Phasen 1.2/2/3/9/10/12 in diesem Projekt): fuenf neue Sichturteile stehen offen in `.planning/WINDOWS.md` (id 16-20), zusaetzlich zu den beiden bereits aus Welle 2 offenen (id 14-15) — insgesamt 7 offene Phase-14-Punkte, die eine menschliche Sichtrunde brauchen (DE+EN, beide Farbmodi, 1280x720+360px).
- Auffaelligster Neubefund fuer die Sichtrunde: das kargste Pruefschiff (`argo-atls`) rendert ueberhaupt kein Leistungsprofil-Kapitel (nicht bloss ein duennes mit 1-2 Balken, wie das UI-SPEC annahm) — der Sichtpunkt id 17 ist entsprechend umformuliert.
- Kein Blocker. `npm run build && npm run gate` gruen (19/19, ~163s), zusaetzlich einmal vollstaendig mit `STAGING=1`. Vorschau-Server dieses Worktrees lief waehrend der gesamten Welle auf Port 4322 (Port 4321 trug wie in fruehren Wellen dokumentiert einen fremden Dev-Server, Port 8411 den orchestrator-eigenen statischen Server — beide unangetastet gelassen).

## Self-Check: PASSED

All modified files found on disk; all four task commits (`332a4f1`, `b69377b`, `a87f8cd`, `5230e3c`) found in `git log`.

---
*Phase: 14-schiffs-datenkarte-entstapeln*
*Completed: 2026-08-18*
