---
phase: 02-schrift-und-bewegungsskala
plan: 07
subsystem: ui
tags: [css-custom-properties, codemod, design-tokens, ci-gate, dockerfile, requirements-traceability]

requires:
  - phase: 02-01
    provides: "scripts/verify-typo-motion.mjs (fuenf Zusicherungen gegen dist/), MIN_TOKEN_USAGES-Sperrklinke auf Tracer-Stand (183)"
  - phase: 02-03
    provides: "scripts/lib/typo-motion.mjs (geteilte Zuordnungslogik), scripts/audit-typo-motion.mjs als Erhebungswerkzeug gegen die Quelle"
  - phase: 02-06
    provides: "alle ~95/96 site-weiten Dateien vollstaendig auf die Schrift-/Bewegungsskala umgestellt, 0 verbliebener skalenpflichtiger Rest"
provides:
  - "verify-typo-motion.mjs Zusicherung 2 (Sperrklinke) von 183 (Plan-01-Tracer-Stand) auf 235775 (site-weiter Ist-Stand) angehoben"
  - "Neue Zusicherung 6: skalenpflichtiger Rest ueber den GESAMTEN Quellbestand (96 Dateien) ist 0 -- ruft ausschliesslich scripts/lib/typo-motion.mjs auf, kein drittes Muster; Dauerwaechter gegen neue Dateien mit alten Gewohnheiten, noch vor jedem Build"
  - "npm run verify:typo im Dockerfile-Tor eingehaengt (nach dem Build, vor dem Auslieferungs-Image) -- eine gerissene Skala kann kein Image mehr erzeugen"
  - "Negativkontrolle durchgefuehrt und bestanden: temporaerer Rueckfall in LangSwitcher.astro liess Zusicherung 6 fehlschlagen, danach zurueckgesetzt"
  - "TYPO-01/TYPO-02 in REQUIREMENTS.md auf Complete gesetzt; TYPO-03 bleibt bewusst Pending"
  - "Schluss-Sichtrunde (site-weit) als offener Eintrag id 5 in .planning/WINDOWS.md an den Betreiber uebergeben, inklusive Phase-2-Bilanz in Zahlen"
affects: []

tech-stack:
  added: []
  patterns:
    - "Ein Prueftor, das gegen die QUELLE (nicht nur gegen dist/) prueft, faengt eine Regression VOR jedem Build ab -- ergaenzt, ersetzt aber nicht die dist/-Zusicherungen, die den vollstaendigen Ausliefer-Pfad (Token-Schicht -> gescoptes CSS -> HTML) belegen"
    - "Ratchet-Werte immer aus einem tatsaechlichen Lauf des eigenen Pruefskripts uebernehmen, nie schaetzen -- Kommentar im Code nennt den Lauf, aus dem die Zahl stammt"
    - "Negativkontrolle vor dem Commit eines neuen/verschaerften Gates: einen bekannten guten Wert testweise auf einen alten Rohwert zuruecksetzen, das Gate muss dabei sichtbar fehlschlagen, danach exakt zuruecksetzen und per git status/diff belegen, dass keine Restdifferenz bleibt"

key-files:
  created: []
  modified:
    - scripts/verify-typo-motion.mjs
    - Dockerfile
    - .planning/WINDOWS.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "MIN_TOKEN_USAGES auf 235775 gesetzt -- der mit demselben Skript (Zusicherung 2) gegen den nach 02-06 gebauten dist/ tatsaechlich gemessene Wert, nicht geschaetzt. Kuenftige Aenderungen duerfen ihn nur noch anheben."
  - "Zusicherung 6 importiert ausschliesslich die exportierten Primitiven aus scripts/lib/typo-motion.mjs (allTargetFiles, classifyFontSizeValue, classifyLetterSpacingValue, classifyTransitionPart, getStyleText, nearestSelector, splitTopLevel) -- dieselben, die audit-typo-motion.mjs und migrate-typo-motion.mjs nutzen. Kein drittes Regex-Muster, das auseinanderdriften koennte."
  - "verify:typo haengt NACH dem Build im Dockerfile (Zeile 34 der Torkette), NICHT in npm run build selbst -- dieselbe Begruendung wie im Kopf von verify-fx.mjs (ein Tor, das den Build blockiert, wird beim ersten Fehlalarm herausgenommen). Die Torkette blockiert stattdessen nur das Auslieferungsimage."
  - "REQUIREMENTS.md: eine vorbestehende HTML-Kommentarzeile MITTEN in der Traceability-Tabelle (zwischen DOC-07 und DATA-01) brach jede zeilenweise Tabellensuche ab dieser Stelle -- gsd-tools requirements mark-complete meldete deshalb faelschlich table_unmatched fuer TYPO-01/02 (und jede andere Zeile danach). Kommentar unveraendert ans Tabellenende verschoben (Rule 3, blockierender Werkzeugfehler), Inhalt identisch."
  - "TYPO-01/TYPO-02 auf Complete gesetzt (Grundlage: audit-typo-motion.mjs meldet 0 Rest ueber alle 96 Dateien). TYPO-03 bleibt Pending -- die BREITERE Schluss-Sichtrunde ueber die ~92 nach Plan 02 site-weit hinzugekommenen Dateien steht noch aus; die bereits vom Betreiber abgenommene ENGERE Pruefung (Kopfleiste+Startseite, WINDOWS.md id 3) bleibt unangetastet."
  - "WINDOWS.md id 3 (Plan-02-Sichtrunde) NICHT wiedereroeffnet -- sie ist fuer ihren eigenen, engeren Umfang korrekt abgenommen. Stattdessen ein NEUER Eintrag (id 5) fuer die breitere, jetzt faellige Runde ueber die Pläne 03-06."

patterns-established:
  - "Ratchet-Zusicherungen tragen im Code einen Kommentar, AUS WELCHEM LAUF die Zahl stammt (Datum/Plan/Skript-Aufruf) -- macht eine spaetere Anhebung nachvollziehbar statt eine weitere Schaetzung"

requirements-completed: [TYPO-01, TYPO-02]

coverage:
  - id: D1
    description: "verify-typo-motion.mjs Zusicherung 2 (Sperrklinke) von 183 auf 235775 angehoben, gemessen mit dem Skript selbst gegen den nach 02-06 gebauten dist/"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "npm.cmd run verify:typo (Zusicherung 2: Soll >= 235775, Ist 235775)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sechste Zusicherung ergaenzt: skalenpflichtiger Rest ueber den gesamten Quellbestand (96 Dateien: src/**/*.astro + assets/*.css) ist 0, nutzt ausschliesslich scripts/lib/typo-motion.mjs"
    requirement: TYPO-02
    verification:
      - kind: other
        ref: "npm.cmd run verify:typo (Zusicherung 6: Soll 0 Restwerte, Ist 0 ueber 239 durchsuchte Dateien)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Negativkontrolle bewiesen: LangSwitcher.astro testweise auf font-size:0.8rem statt var(--fs-6) zurueckgesetzt liess Zusicherung 6 mit 'Ist: 1' fehlschlagen (korrekt benannte Fundstelle); danach exakt zurueckgesetzt, git status zeigt keine Restdifferenz"
    verification:
      - kind: other
        ref: "npm.cmd run verify:typo vor/waehrend/nach dem temporaeren Rueckfall in src/components/LangSwitcher.astro; git status --short nach dem Reset"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run verify:typo ans Dockerfile-Tor gehaengt (Zeile 34, nach npm run build, vor dem nginx-Auslieferungsimage), mit Begruendungszeile im Kommentarblock analog den fuenf bestehenden Toren"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "node -e Zusicherung aus 02-07-PLAN.md Task 1 <verify> (verify:typo im Tor: true, steht nach dem Build: true)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Die vollstaendige Dockerfile-Torkette lokal in identischer Reihenfolge gefahren: test:e2e (215/215), scripts/_verify.mjs (813441 Referenzen), verify:vendor, audit:csp (10/10), verify:crafting, verify:typo (6/6) -- alle gruen. Uebrige Hausgates nicht schlechter als vor der Phase: audit:site (0 FEHLER), verify:fx (7/7), verify:help (11/11)"
    verification:
      - kind: other
        ref: "npm.cmd run test:e2e; node scripts/_verify.mjs; npm.cmd run verify:vendor; npm.cmd run audit:csp; npm.cmd run verify:crafting; npm.cmd run verify:typo; npm.cmd run audit:site; npm.cmd run verify:fx; npm.cmd run verify:help"
        status: pass
    human_judgment: false
  - id: D6
    description: "TYPO-01/TYPO-02 in REQUIREMENTS.md auf Complete gesetzt (Traceability-Tabelle + Checkboxen), auf Grundlage von 0 skalenpflichtigem Rest ueber alle 96 site-weiten Dateien"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "gsd-tools requirements mark-complete TYPO-01 TYPO-02 (marked_complete: [TYPO-01, TYPO-02]); grep TYPO-0 .planning/REQUIREMENTS.md"
        status: pass
    human_judgment: false
  - id: D7
    description: ".planning/WINDOWS.md traegt die site-weite Schluss-Sichtrunde (id 5, offen) mit fuenf Bloecken (Plan-02-Punkte gegen den vollstaendigen Stand, eingerastete Ausreisser mit tatsaechlich gemessenen Werten, Konto-Ansichten, D-03-Gegenprobe, 22 Themen-Koerper) und die Phase-2-Bilanz in Zahlen (96 Dateien, 3.141 Token-Verweise, 527 begruendete Ausnahmen, 11 eingerastete Ausreisser >6%)"
    verification: []
    human_judgment: true
    rationale: "Die Sichtrunde selbst ist ein menschliches Urteil im Browser (DE+EN, beide Farbmodi, 1280px+360px) -- kein Skript kann 'liest sich als ein Bewegungsbild' oder 'wirkt noch wie ein Blickfang' fuer die eingerasteten Ausreisser entscheiden. Dieser Coverage-Eintrag deckt nur, dass der Eintrag korrekt und vollstaendig im Ledger steht, nicht dass die Runde durchgefuehrt wurde."

duration: ~40min
completed: 2026-08-08
status: complete
---

# Phase 2 Plan 7: Die Sperrklinke, das Dockerfile-Tor und die Schluss-Sichtrunde Summary

**`verify-typo-motion.mjs` bekommt eine sechste, quellbasierte Zusicherung und eine auf 235.775 angehobene Sperrklinke, `npm run verify:typo` blockiert jetzt das Auslieferungsimage im Dockerfile, eine Negativkontrolle beweist, dass das Tor beisst, TYPO-01/02 sind abgehakt, und die site-weite Schluss-Sichtrunde liegt benannt beim Betreiber.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2/2 completed
- **Files modified:** 6 (scripts/verify-typo-motion.mjs, Dockerfile, .planning/WINDOWS.md, .planning/REQUIREMENTS.md, .planning/STATE.md, .planning/ROADMAP.md)

## Accomplishments

- `scripts/verify-typo-motion.mjs`: Zusicherung 2 (Sperrklinke) von 183 (Plan-01-Tracer-Stand: nur SiteNav+beide index.astro) auf 235.775 angehoben — der tatsächlich mit demselben Skript gegen den nach Plan 06 gebauten `dist/` gemessene Wert, nicht geschätzt.
- Sechste Zusicherung ergänzt: skalenpflichtiger Rest über den **gesamten Quellbestand** (239 durchsuchte Dateien inkl. `assets/*.css`, davon 96 mit mindestens einem Treffer) ist 0. Ruft dazu ausschließlich die exportierten Primitiven aus `scripts/lib/typo-motion.mjs` auf (`allTargetFiles`, `classifyFontSizeValue`, `classifyLetterSpacingValue`, `classifyTransitionPart`, `getStyleText`, `nearestSelector`, `splitTopLevel`) — kein drittes Muster. Das ist der eigentliche Dauerwächter: Zusicherung 2 zählt Token-Benutzung im gebauten Stand, Zusicherung 6 zählt übrig gebliebene Einzelwerte in der Quelle, noch bevor ein Build läuft.
- Negativkontrolle durchgeführt (wie bei `verify-fx.mjs`/`verify-help.mjs`): `src/components/LangSwitcher.astro`s `font-size: var(--fs-6)` testweise auf `font-size: 0.8rem` zurückgesetzt → `npm run verify:typo` schlägt bei Zusicherung 6 fehl (`Ist: 1`, Fundstelle korrekt benannt) → zurückgesetzt, `git status` bestätigt keine Restdifferenz.
- `Dockerfile`: `npm run verify:typo` ans Ende der bestehenden Torkette (Zeile 34, nach `npm run build`) angehängt, mit Begründungszeile im Kommentarblock analog den fünf bestehenden Toren — eine gerissene Skala bricht nichts sichtbar, sie sieht nur wieder aus wie vorher.
- Vollständige Dockerfile-Torkette lokal in identischer Reihenfolge gefahren: `test:e2e` (215/215), `scripts/_verify.mjs` (813.441 Referenzen), `verify:vendor`, `audit:csp` (10/10 Quellen), `verify:crafting`, `verify:typo` (6/6 Zusicherungen) — alle grün. Übrige Hausgates nicht schlechter als vor der Phase: `audit:site` (0 FEHLER), `verify:fx` (7/7), `verify:help` (11/11).
- `.planning/WINDOWS.md`: neuer offener Ledger-Eintrag (id 5) für die site-weite Schluss-Sichtrunde über die ~92 nach Plan 02 hinzugekommenen Dateien, mit fünf Blöcken (Plan-02-Punkte gegen den vollständigen Stand, eingerastete Ausreißer mit den tatsächlich gemessenen Werten aus den Summaries, Konto-Ansichten, D-03-Gegenprobe, 22 Themen-Körper) plus einer Phase-2-Bilanz in Zahlen (96 umgestellte Dateien, 3.141 Token-Verweise, 527 begründete Ausnahmen, 11 eingerastete Ausreißer über 6 %).
- `.planning/REQUIREMENTS.md`: TYPO-01/TYPO-02 in der Traceability-Tabelle auf Complete gesetzt. TYPO-03 bleibt bewusst Pending — die breitere Sichtrunde steht noch aus.

## Task Commits

1. **Task 1: Die Sperrklinke anziehen und das Tor an den Auslieferungsweg hängen** - `1288c12` (feat)
2. **Task 2: Schluss-Sichtrunde und Phasenbilanz** - `ef31202` (docs)

## Files Created/Modified

- `scripts/verify-typo-motion.mjs` - MIN_TOKEN_USAGES 183→235775; sechste Zusicherung (Quell-Rest=0) via `scripts/lib/typo-motion.mjs`; Kopfkommentar auf sechs Zusicherungen + Dockerfile-Verweis aktualisiert
- `Dockerfile` - `npm run verify:typo` ans Ende der Torkette (Zeile 34) angehängt, Begründungszeile im Kommentarblock ergänzt
- `.planning/WINDOWS.md` - neuer Eintrag id 5 (offen, site-weite Schluss-Sichtrunde) + Phase-2-Bilanz; header counts (open_count 2→3, total_count 4→5) aktualisiert; id 3/4 unangetastet
- `.planning/REQUIREMENTS.md` - TYPO-01/02 auf Complete; Prosa-Hinweis vor dem TYPO-Abschnitt aktualisiert (Plan 7/7); HTML-Kommentar aus der Mitte der Traceability-Tabelle ans Ende verschoben (Rule 3, siehe Deviations)
- `.planning/STATE.md` - Performance-Metrics-Zeile "Phase 02 P07", sechs Decision-Einträge, Session-Continuity und Phase-2-Statusabsatz aktualisiert (current_phase bleibt bei 5, Mehrfachsitzungs-Konvention dieses Projekts)
- `.planning/ROADMAP.md` - Plan-Fortschritt für Phase 2 aktualisiert (via `gsd-tools roadmap update-plan-progress 2`)

## Decisions Made

- `MIN_TOKEN_USAGES` auf den tatsächlich gemessenen Wert 235.775 gesetzt (nicht geschätzt) — Code-Kommentar nennt den Lauf, aus dem die Zahl stammt.
- Zusicherung 6 nutzt ausschließlich die geteilten Primitiven aus `scripts/lib/typo-motion.mjs`, keine neue Regex-Fassung.
- `verify:typo` hängt NACH dem Build im Dockerfile, nicht in `npm run build` selbst — dieselbe Begründung wie `verify-fx.mjs`s Kopfkommentar.
- Die vorbestehende HTML-Kommentarzeile mitten in `REQUIREMENTS.md`s Traceability-Tabelle (zwischen DOC-07 und DATA-01) wurde unverändert ans Tabellenende verschoben, weil sie jede zeilenweise Tabellensuche ab dieser Stelle abbrach — siehe Deviations.
- TYPO-01/TYPO-02 auf Complete, TYPO-03 bleibt Pending (die schon abgenommene engere Prüfung, WINDOWS id 3, bleibt als Häkchen unangetastet).
- WINDOWS.md id 3 NICHT wiedereröffnet — neuer Eintrag id 5 für die breitere, jetzt fällige Runde.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] HTML-Kommentar mitten in der REQUIREMENTS.md-Traceability-Tabelle brach `gsd-tools requirements mark-complete`**
- **Found during:** Task 2, Versuch TYPO-01/TYPO-02 über `gsd-tools requirements mark-complete TYPO-01 TYPO-02` abzuhaken
- **Issue:** Zwischen den Tabellenzeilen `DOC-07` und `DATA-01` stand eine mehrzeilige `<!-- Stand 06.08.2026: ... -->`-Kommentarzeile, die NICHT mit `|` beginnt. `updateTableCell` (in `gsd-core/bin/lib/markdown-table.cjs`) bricht seinen Zeilen-Scan an der ersten Zeile ab, die nicht mit `|` beginnt — dadurch sah das Werkzeug NIE eine der Zeilen nach dem Kommentar (TYPO-01/02/03, LAYER-*, SYNC-*, THEME-02, DON-*, ROLE-*, CRAFT-*), und meldete für TYPO-01/02 fälschlich `table_unmatched` statt `marked_complete`.
- **Fix:** Kommentar unverändert (byte-identischer Text) ans Ende der Tabelle verschoben (nach `CRAFT-04`, vor `**Coverage:**`), mit einer zusätzlichen Erklärzeile im Kommentar selbst, warum er dort steht.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** `node "$HOME/.claude/gsd-core/bin/gsd-tools.cjs" requirements mark-complete TYPO-01 TYPO-02` meldet danach `"updated": true, "marked_complete": ["TYPO-01","TYPO-02"], "table_unmatched": []`.
- **Committed in:** `ef31202` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, vorbestehender Werkzeug-/Formatierungsfehler in `REQUIREMENTS.md`, nicht durch diesen Plan verursacht).
**Impact on plan:** Reiner Formatierungsfix ohne Inhaltsänderung (Kommentartext byte-identisch verschoben). Kein Scope Creep.

## Issues Encountered

- Ein JavaScript-Block-Kommentar in `verify-typo-motion.mjs`s Kopfkommentar enthielt versehentlich die Zeichenfolge `*/*.astro` (aus `src/**/*.astro`), was den Kommentar vorzeitig beendete und einen `SyntaxError` auslöste. Behoben durch Umformulierung ohne die `*/`-Zeichenfolge (`src/-.astro-Dateien` statt `src/**/*.astro`) — reiner Kommentartext, keine Verhaltensänderung.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

Phase 2 ist mit diesem Plan technisch fertig (7/7 Pläne ausgeführt, alle Hausgates grün, TYPO-01/02 maschinell belegt und abgehakt). Sie ist **NICHT als „Complete" zu markieren**, solange die site-weite Schluss-Sichtrunde (`.planning/WINDOWS.md` id 5) offen ist — derselbe Umgang, den dieses Projekt bereits bei Phase 1.2 gepflegt hat (dort ebenfalls technisch fertig, aber erst nach der Sichtrunde als „Complete" geführt). Die schmalere, bereits abgenommene Prüfung (Kopfleiste + Startseite, WINDOWS id 3) bleibt unangetastet und zählt nicht als Ersatz für die breitere Runde.

**Für den Betreiber (Schluss-Sichtrunde, siehe `.planning/WINDOWS.md` id 5 für den vollständigen Text mit allen Fundstellen und gemessenen Werten):**

1. Die fünf Punkte aus Plan 02 (Landung, Scrollweg, Choreografie-Gegenprobe, Bewegungssprache, Farbmodi/360px) gegen den jetzt vollständig umgestellten Stand prüfen.
2. Die elf eingerasteten Ausreißer über 6 % Abweichung ansehen (Orte und gemessene Werte in WINDOWS.md id 5) — wirken sie optisch noch wie beabsichtigt?
3. Konto-Ansichten (`/account/*`, `/pilot/<handle>`, `/refinery.html`) — braucht ein angemeldetes Konto, derselbe offene Punkt wie Phase 1.2.
4. Gegenprobe D-03 auf `sc-4-9-0.html`, `sc-4-2-0.html` und `/archiv.html` — fühlt sich das Ambiente weiterhin unverändert an?
5. Alles in DE+EN, beiden Farbmodi, 1280px UND 360px.

---
*Phase: 02-schrift-und-bewegungsskala*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `scripts/verify-typo-motion.mjs`
- FOUND: `Dockerfile`
- FOUND: `.planning/WINDOWS.md`
- FOUND: `.planning/REQUIREMENTS.md`
- FOUND: commit `1288c12` (Task 1)
- FOUND: commit `ef31202` (Task 2)
