---
phase: 20-wikelos-angebote-kommen-aus-dem-bestand
plan: 02
subsystem: data
tags: [datamine, curation-merge, wikelo, json]

# Dependency graph
requires:
  - phase: 20-wikelos-angebote-kommen-aus-dem-bestand
    provides: "scripts/build-wikelo-trades.mjs, assets/wikelo-curated.json (1 Saat-Eintrag), Vertrags-id als Zusammenfuehrungs-Schluessel (Plan 01, Tracer)"
provides:
  - "scripts/probes/wikelo-kuration-zuordnung.mjs — Zuordnungssonde in drei deterministischen, kollisionsfesten Stufen"
  - "assets/wikelo-curated.json — 59 von 69 Vertraegen kuratiert (Bild/Ausstattung/Reputationstext/Name/Kategorie), jeder Eintrag mit basis-Feld"
  - "zwei benannte Sichturteile in .planning/WINDOWS.md (id 55 D-02, id 56 D-03)"
  - "ROADMAP Phase 20: D-02 zaehlt sieben Namen, D-03 stellt die Zuordnungs- statt der Existenzfrage"
affects: [20-03-wikelo-sperrklinke, 20-04-wikelo-anzeige]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zuordnungssonde mit beidseitiger Eindeutigkeit je Stufe (Schluessel muss unter den noch offenen Vertraegen UND den noch offenen Handeintraegen genau einmal vorkommen) — Kollisionen werden namentlich gemeldet statt per greedy 'erster gewinnt' aufgeloest"
    - "Kollisionen und unaufloesbare Reste gehen als benannte Punkte ins Broken-Windows-Register statt als geratene Automatik in den Erzeuger"

key-files:
  created:
    - scripts/probes/wikelo-kuration-zuordnung.mjs
  modified:
    - assets/wikelo-curated.json
    - assets/wikelo-trades.json
    - assets/wikelo-trades.meta.json
    - .planning/WINDOWS.md
    - .planning/ROADMAP.md

key-decisions:
  - "Materialvergleich in Stufe 1 ist eine strikte Multimengen-Gleichheit nach Normalisierung (keine Stemming/Synonym-Aufloesung) — deshalb bleibt 'Ana Armor Endro (Set)' trotz inhaltlich klarer Zuordnung offen (Hand: 'Antium Armor Core', Spieldaten: 'Antium Core', ein woertlich abweichendes Wort reicht zum Ausschluss)."
  - "Defekter Handbestand-Bildverweis ('img': 'wk-l22', keine Datei unter assets/ mit diesem Namen) beim Schreiben entfernt statt uebernommen (Rule 1) — Task 2 verlangt, dass jeder genannte img-Dateiname existiert."
  - "Die Sonde meldet echte, von der ROADMAP nicht vorhergesehene Kollisionen (ATLS IKTI vs. ATLS GEO IKTI) als eigenen Punkt statt sie unter D-03 unterzumischen; beide Handkarten passen textlich UND materiell auf beide Vertraege, eine automatische Zuteilung waere ein Muenzwurf."

requirements-completed: []  # Plan-Frontmatter: requirements: [] -- Phase 20 fuehrt D-01..D-04 statt REQ-IDs

coverage:
  - id: D1
    description: "Zuordnungssonde in drei Stufen (materialien-exakt/belohnungsname-exakt/belohnungsname-teilmenge) mit beidseitiger Eindeutigkeit, Kollisionen namentlich berichtet"
    verification:
      - kind: unit
        ref: "node scripts/probes/wikelo-kuration-zuordnung.mjs --hand <handbestand>: Stufe 1 = 52 Paare, Stufe 2 = 1 Paar (Polaris Bit -> b54af3de06d5a082342f10c73388e0b0), Stufe 3 = 6 Paare, 3 Kollisionen namentlich"
        status: pass
    human_judgment: false
  - id: D2
    description: "assets/wikelo-curated.json vollstaendig aus der Sonde erzeugt: 59 Eintraege, jeder mit basis, kein mats/favor, jedes img existiert unter assets/"
    verification:
      - kind: unit
        ref: "node scripts/build-wikelo-trades.mjs && node -e \"...59 kuratiert, 69 Karten, 52 mit Bild (Untergrenze 48)...\" (Task 2 <verify>)"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run build && npm run gate gruen, normal UND mit STAGING=1"
    verification:
      - kind: integration
        ref: "npm run gate (23/23), STAGING=1 npm run build && npm run gate (23/23)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Offene Urteile (D-02 Werkstattrest-Frage, D-03 ATLS-Zuordnung inkl. neuer IKTI-Kollision) im Register statt geraten; ROADMAP D-02/D-03 berichtigt"
    verification:
      - kind: unit
        ref: ".planning/WINDOWS.md id 55/56 (phase 20, status open, >200 Zeichen, ATLS/Wikelo Arrive to System genannt); git diff --stat .planning/ROADMAP.md nur Phase-20-Bereich"
        status: pass
    human_judgment: true
    rationale: "D-02 (echtes Angebot vs. Werkstattrest) und D-03 (welche ATLS-Farbe/welcher ATLS-Zusatzauftrag traegt welchen Namen) sind Sichturteile am laufenden Spiel — kein Skript darf sie fuer den Betreiber entscheiden."

duration: 40min
completed: 2026-08-28
status: complete
---

# Phase 20 Plan 2: Wikelo-Kuration-Umzug Summary

**Zuordnungssonde in drei deterministischen, kollisionsfesten Stufen bindet 59 der 63 handgepflegten Wikelo-Kuration-Eintraege an Vertrags-`id`s; die restlichen 10 Vertraege und 4 Handkarten stehen namentlich im Register statt geraten zu werden.**

## Performance

- **Duration:** ca. 40 min
- **Started:** 2026-08-28T11:00Z (ungefaehr, kein `record_start_time`-Zeitstempel erfasst)
- **Completed:** 2026-08-28T11:34Z
- **Tasks:** 3
- **Files modified:** 6 (1 neu: `scripts/probes/wikelo-kuration-zuordnung.mjs`; 5 geaendert)

## Accomplishments
- `scripts/probes/wikelo-kuration-zuordnung.mjs` (neu, 287 Zeilen) ordnet die 63 Handeintraege der 69 Spieldaten-Vertraege in drei Stufen zu — jede Stufe verlangt beidseitige Eindeutigkeit (Schluessel genau einmal auf beiden Seiten), Kollisionen werden namentlich gemeldet und bleiben offen statt per "erster gewinnt" aufgeloest zu werden. Gemessen: Stufe `materialien-exakt` 52 Paare (der greedy-Vorlauf der Recherche kam auf 53 — die Differenz von 1 ist exakt die neu gefundene ATLS-IKTI-Kollision), Stufe `belohnungsname-exakt` 1 Paar (Polaris Bit, wie gefordert), Stufe `belohnungsname-teilmenge` 6 Paare.
- `assets/wikelo-curated.json` traegt jetzt 59 Eintraege (vorher 1 Saat-Eintrag aus Plan 01) — jeder mit `basis`-Feld, keiner mit `mats`/`favor`.
- `assets/wikelo-trades.json`/`.meta.json` neu gebaut: weiterhin 69 Vertraege, 285 Warenposten, 239 Materialzeilen, 46 Favor-Karten; **52 von 69 Karten mit Bild** (Untergrenze 48 erreicht, Zielwert 56 verfehlt — siehe Deviations), 33 mit `comps`, 2 mit `rep`, 59 mit kuratierter Kategorie, 53 Namensueberschreibungen durch Kuration.
- Zwei neue offene Registerpunkte (`.planning/WINDOWS.md` id 55/56): D-02 (sechs unkuratierte Vertraege inkl. Sonderfall "Wikelo Arrive to System" ohne Belohnung) und D-03 (die zwei titellosen ATLS-Farbauftraege PLUS eine neu gefundene ATLS-IKTI-Kollision).
- `.planning/ROADMAP.md` Abschnitt Phase 20: D-02 zaehlt jetzt sieben statt acht Namen (mit Begruendung fuer den gestrichenen), D-03 stellt die Zuordnungs- statt der Existenzfrage.
- `npm run build && npm run gate` gruen (23/23), normal UND mit `STAGING=1`.

## Task Commits

1. **Task 1: Zuordnungssonde in drei deterministischen Stufen** - `84aea97` (feat)
2. **Task 2: `assets/wikelo-curated.json` vollstaendig — und die Bilanz der Bilder** - `e029d46` (feat)
3. **Task 3: Offene Urteile ins Register, berichtigte Praemissen in die ROADMAP** - `8eee6c6` (docs)

**Plan metadata:** folgt (dieser Commit)

## Files Created/Modified
- `scripts/probes/wikelo-kuration-zuordnung.mjs` - NEU: Zuordnungssonde, `--hand <datei>` und `--schreiben`, schreibt selbst keine Datei
- `assets/wikelo-curated.json` - ERWEITERT: 1 -> 59 Eintraege, jeder mit `basis`
- `assets/wikelo-trades.json` - NEU GEBAUT ueber `build-wikelo-trades.mjs`: 69 Karten, 52 mit Bild
- `assets/wikelo-trades.meta.json` - NEU GEBAUT: `curatedCount` 1 -> 59
- `.planning/WINDOWS.md` - zwei neue offene Punkte (id 55, id 56), Frontmatter-Zaehler mitgezogen
- `.planning/ROADMAP.md` - Abschnitt Phase 20, D-02/D-03 berichtigt (nur dieser Bereich geaendert)

## Decisions Made
- Materialvergleich in Stufe 1 ist eine strikte Multimengen-Gleichheit ohne Stemming/Synonym-Aufloesung (Plan-Vorgabe: Normalisierung ist ausschliesslich Kleinschreibung + Nicht-Alphanumerisches-zu-Leerzeichen). Das laesst "Ana Armor Endro (Set)" trotz inhaltlich eindeutiger Zuordnung offen, weil die Spieldaten "Antium Core" schreiben und die Handliste "Antium Armor Core" — ein woertlich abweichendes Wort reicht zum Ausschluss. Bewusst nicht geglaettet, um keine stille Falschzuordnung zu riskieren; stattdessen im Register (id 55) benannt.
- Stufe 3 (`belohnungsname-teilmenge`) prueft je Handeintrag-Tokenmenge gegen JEDEN einzelnen Eintrag aus `rewardItems[]` (nicht gegen die Verkettung aller Eintraege) — das trifft 6 der 8 in der Recherche vermuteten Paare exakt; die zwei Ausnahmen (Ana Armor Endro, s.o.; ATLS GEO IKTI wegen der neuen IKTI-Kollision) sind gemessen, nicht behoben.
- Defekter Handbestand-Bildverweis (`"img": "wk-l22"`, keine Datei unter `assets/` mit diesem Namen — nicht einmal eine Dateiendung im Originalwert) beim Schreiben von `wikelo-curated.json` entfernt statt uebernommen (siehe Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Defekter Bildverweis aus dem Handbestand entfernt statt uebernommen**
- **Found during:** Task 2, Pruefung "jeder in `img` genannte Dateiname existiert unter `assets/`"
- **Issue:** Der Handbestand-Eintrag "L-22 Alpha Wolf" traegt `"img": "wk-l22"` (ohne Dateiendung) — unter `assets/` existiert keine Datei mit diesem Namen, auch keine Variante mit `.png`/`.jpg`. Der Verweis war bereits im Handbestand VOR Plan 01 defekt, nicht durch diese Welle entstanden.
- **Fix:** `img`-Feld fuer diesen Eintrag (`id 4945f4d45068d2d480e40bee78a4afa0`) aus der geschriebenen `wikelo-curated.json` entfernt. Die Karte zeigt jetzt bewusst den Kategorie-Platzhalter statt eines toten Verweises (`wikelo-emporium.astro`s bestehendes `hasAsset()`-Fallback haette den Effekt ohnehin erzwungen, aber die kuratierte Datei soll keine bekannt-toten Pfade fuehren).
- **Files modified:** `assets/wikelo-curated.json`
- **Verification:** Task-2-`<verify>`-Zusicherung "img verweist auf eine fehlende Datei" laeuft gruen (alle verbleibenden 52 img-Verweise existieren).
- **Committed in:** `e029d46` (Task-2-Commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Notwendig fuer die Acceptance-Criteria von Task 2 ("jeder in img genannte Dateiname existiert"). Kein Scope-Creep.

## Issues Encountered

**Zielwert 56 mit Bild verfehlt (52 statt 56) — kein Fehler, sondern ein gemessener, ehrlicherer Wert als die Plan-Annahme.**

Der Plan nannte als Zielwert 56 ("57 der 63 Handeintraege fuehren ein img, genau einer davon — 'ATLS GEO Orange Line' — findet nach heutigem Stand keinen Vertrag"). Die tatsaechliche Messung zeigt: **vier** Handkarten mit `img` bleiben offen, nicht eine — zusaetzlich zu "ATLS GEO Orange Line" auch "Ana Armor Endro (Set)" (Materialtext weicht woertlich ab, s. Decisions), "ATLS IKTI" und "ATLS GEO IKTI" (neue, von der ROADMAP nicht vorhergesehene Kollision zwischen den Vertraegen "Make ATLS shoot" und "Make jumpy ATLS shoot" — beide Handkarten passen textlich UND materiell auf beide Vertraege). 52 mit Bild liegt weiterhin klar ueber der harten Untergrenze 48. Der Plan selbst erlaubt das ausdruecklich ("Wird die 56 verfehlt, ist das KEIN Grund, eine Zuordnung zu erfinden") — alle vier offenen Faelle sind im Register (id 55, id 56) benannt statt geraten.

**Ledger-Datei endet auf eine vorbestehende Markdown-Codezaun-Zeile, die Task 3s eigenes `<verify>`-Snippet stolpert.**

`.planning/WINDOWS.md` endet mit einer schliessenden vier-Backtick-Codezaun-Zeile NACH dem JSON-Array (bereits vor dieser Welle so, git-Historie bestaetigt). Das im Plan vorgegebene `<verify>`-Snippet (`s.slice(s.lastIndexOf('\n['))` dann direkt `JSON.parse`) reisst deshalb an einem `SyntaxError` an dieser Zaunzeile. Die Datei selbst ist korrekt (drei Backend-getestete `windows append`-Laeufe ueber `gsd-tools` haben sie konsistent geschrieben, Frontmatter-Zaehler stimmen). Mit einem um die Zaunzeile bereinigten Parser laeuft dieselbe Pruefung durch (siehe Coverage D4). Nicht behoben (ausserhalb des Aufgabenbereichs dieser Welle, reine Pre-existing-Eigenheit der Datei) — dokumentiert, damit ein spaeterer Lauf des woertlichen Plan-Snippets nicht als Regress missverstanden wird.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Next Phase Readiness

- Plan 03 (D-04: Sperrklinken + Verzugstor) kann direkt auf dem jetzt vollstaendig kuratierten `assets/wikelo-curated.json` und `assets/wikelo-trades.json`/`.meta.json` aufsetzen — an den D-04-relevanten Feldern (`gameVersion`, `contractCount`, `orderLineCount`) hat diese Welle nichts geaendert.
- Zwei neue Sichtrunden-Punkte (`.planning/WINDOWS.md` id 55/56) warten auf den Betreiber, zusaetzlich zu den bereits bestehenden offenen Punkten des Projekts — dieselbe Konvention wie bei frueheren Phasen (1.2/2/3/9/10/12/14/16).
- Kein Blocker fuer Plan 03. Die vier offen gebliebenen Handkarten mit `img` (Ana Armor Endro, ATLS IKTI, ATLS GEO IKTI, ATLS GEO "Orange Line") koennen jederzeit per Hand in `assets/wikelo-curated.json` nachgetragen werden, sobald der Betreiber die Register-Punkte 55/56 entschieden hat — die Sonde muss dafuer nicht erneut laufen, ein manueller `trades`-Eintrag mit `basis: "manuell"` reicht (Erzeuger liest jede vorhandene `id`, unabhaengig von ihrer Herkunft).

## Self-Check: PASSED

- FOUND: `scripts/probes/wikelo-kuration-zuordnung.mjs`
- FOUND: `assets/wikelo-curated.json` (59 Eintraege bestaetigt)
- FOUND: `.planning/phases/20-wikelos-angebote-kommen-aus-dem-bestand/20-01-SUMMARY.md`
- FOUND commit `84aea97` (Task 1)
- FOUND commit `e029d46` (Task 2)
- FOUND commit `8eee6c6` (Task 3)
- FOUND: `.planning/WINDOWS.md` id 55/56 (phase 20, status open)

---
*Phase: 20-wikelos-angebote-kommen-aus-dem-bestand*
*Completed: 2026-08-28*
