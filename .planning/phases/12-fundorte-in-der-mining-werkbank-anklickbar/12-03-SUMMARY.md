---
phase: 12-fundorte-in-der-mining-werkbank-anklickbar
plan: 03
subsystem: ui
tags: [astro, vanilla-js, es5, mining-workbench, mock-dom-testing, playwright-core, contrast-measurement]

# Dependency graph
requires:
  - phase: 12-fundorte-in-der-mining-werkbank-anklickbar (Plan 01)
    provides: Fundort-Index (locIndex), renderLocation(), S.view/S.selLoc, row2() achter Parameter opts, pctRight()/pctSub() byChance-Parameter
  - phase: 12-fundorte-in-der-mining-werkbank-anklickbar (Plan 02)
    provides: "[data-ore]-Zweig, Merklisten-Zeile mit data-loc, Kachel-Markierung .wb__tile.is-here (D-09)"
provides:
  - "Deep-Link-Zweig fromQueryLoc() in assets/mining-workbench.js -- ?fundort=<Name> oeffnet beim Laden die Fundort-Ansicht (D-04), Allow-List-Abgleich gegen locIndex, kanonischer Schluessel, stiller Rueckfall bei Unbekanntem"
  - "Inhaltlich korrigierte Hilfetexte mining.ctl.locpin/mining.ctl.shortlist (DE+EN) -- beschreiben seit D-01/D-03 beide Bedeutungen der Zeile"
  - "Messsonde scripts/probes/mining-locview-messung.mjs -- 4 Laeufe x 3 Orte x 6 Messgruppen = 72 Messpunkte am gerenderten Bildpunkt, ausserhalb der Torkette"
  - "Gemessene, korrigierte Spurenzeilen-Daempfung (82%/90% statt 62%/65%) und behobene Zeilenhoehen-Abweichung bei Spurenzeilen mit Abzeichen (line-height:1 auf .wb__tag.is-trace)"
  - "Offener Sichtrunde-Eintrag id 12 in .planning/WINDOWS.md fuer die sieben nicht-maschinell pruefbaren Fragen der Phase"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zweiter Deep-Link-Zweig als eigene sofort ausgefuehrte Funktion NACH dem bestehenden Mineral-Zweig, gleiche Bauform (try/catch, trim()+toLowerCase(), Allow-List-Schleife) statt eines zweiten Verfahrens"
    - "Messsonden gegen die GERENDERTE Seite (nicht nur gegen Spieldaten) gehoeren nach scripts/probes/, mit derselben Browser-Suche wie scripts/browser-smoke.mjs und derselben Kontrastformel wie scripts/lib/theme-color.mjs -- keine zweite Formel fuer dieselbe Zahl"
    - "Kontrast am gerenderten Bildpunkt: Extremwert (hellster/dunkelster Bildpunkt) eines eng zugeschnittenen Screenshot-Ausschnitts, nicht eine zweite CSS-Auswertung -- funktioniert unabhaengig davon, ob die Flaeche eine einzelne Farbe oder ein Stapel halbtransparenter Ebenen ist"

key-files:
  created:
    - scripts/probes/mining-locview-messung.mjs
    - .planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/deferred-items.md
  modified:
    - assets/mining-workbench.js
    - src/i18n/help.ts
    - src/components/MiningWorkbench.astro
    - tests/e2e/helpers/mining-dom.js
    - tests/e2e/mining-shortlist.test.js
    - scripts/probes/README.md
    - .planning/WINDOWS.md

key-decisions:
  - "Reversibilitaet von ?fundort= als 'costly' gekennzeichnet, nicht gegattert (Plan-Vorgabe): der Parametername und die Ortsnamen-Schreibweise sind ab Auslieferung eine oeffentliche Zusage, weil der Name der Schluessel aus der Fundort-Datenextraktion ist. Kein Entscheidungs-Checkpoint noetig, die Bewertung steht hier in der Projektgeschichte."
  - "Zentrier-Warteschleife (Z. 932-949 vor diesem Plan) NICHT auf den Fundort-Zweig ausgeweitet, wie vom Plan als offene Frage markiert: bestaetigt beim Umsetzen an der laufenden Seite (T-12-16/T-12-18 pruefen das strukturell, mining-locview-messung.mjs Gruppe c pruefte es zusaetzlich am gerenderten Bildpunkt) -- die Fundort-Ansicht ersetzt den Spalteninhalt und zeichnet bei Bildlaufposition 0, es gibt dort keine bestehende Zeile, zu der gescrollt werden muesste."
  - "Messgruppe (e) NICHT ueber offsetWidth-clientWidth gemessen, wie der Plan es vorschlug -- siehe Deviations. Stattdessen: scrollt der Kasten TATSAECHLICH innen (scrollTop verschiebt den sichtbaren Inhalt)."
  - "Spurenzeilen-Daempfung auf 82%/90% gesetzt (UI-SPEC-Startwerte 62%/65% ausdruecklich kein Freigabewert) -- iterativ per Sonden-Kalibrierung ermittelt, schlechtester gemessener Wert 4,91:1 gegen die 4,5:1-Marke."
  - "line-height:1 NUR auf die neue Modifikatorklasse .wb__tag.is-trace gesetzt, nicht auf das geerbte .wb__tag selbst -- das lebt auch ausserhalb der Fundort-Ansicht (#wb-tags), eine Aenderung dort haette unbeabsichtigte Nebenwirkungen."

requirements-completed: [D-01, D-03, D-04, D-07]

coverage:
  - id: D1
    description: "?fundort=<Name> (case-insensitiv, getrimmt) oeffnet beim Laden die Fundort-Ansicht dieses Ortes, #wb-locname traegt die kanonische Schreibweise (D-04)"
    requirement: "D-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-16"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sicherheitsnachweis: ein unbekannter Wert mit HTML-Sonderzeichen und Skript-Anfang faellt still auf die Erz-Ansicht zurueck, erreicht das gezeichnete Markup an keiner Stelle (D-04, T-12-09 im Threat-Register)"
    requirement: "D-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-17"
        status: pass
    human_judgment: false
  - id: D3
    description: "?mineral= und ?fundort= gleichzeitig: der genannte Ort ist offen UND das genannte Erz gewaehlt, die Fusszeile nennt weiterhin das Erz (D-04)"
    requirement: "D-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-12-18"
        status: pass
    human_judgment: false
  - id: D4
    description: "mining.ctl.locpin nennt seit D-01 beide Bedeutungen der Zeile (Zeile oeffnet den Fundort, Nadel heftet zusaetzlich an), in DE und EN"
    requirement: "D-01"
    verification: []
    human_judgment: true
    rationale: "verify:help prueft nur Anwesenheit und Nicht-Leere des Ankers, nie den Textinhalt (12-RESEARCH.md Pitfall 1) -- der Wortlaut selbst braucht Gegenlesen durch einen Menschen."
  - id: D5
    description: "mining.ctl.shortlist nennt seit D-03 beide Bedeutungen der Merklisten-Zeile (Klick oeffnet den Fundort, Kreuz loest ihn), in DE und EN"
    requirement: "D-03"
    verification: []
    human_judgment: true
    rationale: "Gleicher Grund wie D4 -- verify:help ist blind fuer den Textinhalt."
  - id: D6
    description: "Spurenzeilen-Kontrast (Name, Unterzeile, Prozentzahl gegen Zeilenflaeche; Abzeichen gegen eigene Flaeche) haelt >=4,5:1, in beiden Farbmodi, am gerenderten Bildpunkt"
    verification:
      - kind: automated_ui
        ref: "scripts/probes/mining-locview-messung.mjs (Gruppe a-kontrast-spur, 12/12 Laeufe x Orte bestanden nach Korrektur auf 82%/90%; einmal vorgefuehrt rot mit 20%, 4/24 Punkte fielen mit 1,3-1,4:1 durch)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Fundort-Kopf ueberschreitet die Hoehe des Erz-Kopfs nicht (--wb-chrome-Budget)"
    verification:
      - kind: automated_ui
        ref: "scripts/probes/mining-locview-messung.mjs (Gruppe b-kopfhoehe, 12/12 bestanden; Fundort 65,8px vs Erz 69,8px, Diff -4,0px in jedem Lauf)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Bei 1280x720 ist die erste Erzzeile der Fundort-Ansicht ohne Scrollen vollstaendig sichtbar"
    verification:
      - kind: automated_ui
        ref: "scripts/probes/mining-locview-messung.mjs (Gruppe c-erste-zeile-sichtbar, 12/12 bestanden, auch bei 1920x1080 gemessen)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Eine Spurenzeile mit dem laengsten Erznamen und Abzeichen ist genauso hoch wie eine gewoehnliche Zeile -- kein Umbruch"
    verification:
      - kind: automated_ui
        ref: "scripts/probes/mining-locview-messung.mjs (Gruppe d-zeilenhoehe-langname, 12/12 bestanden NACH dem line-height:1-Fund; vorher 12/12 durchgefallen mit 45,4px statt 43,8px)"
        status: pass
    human_judgment: false
  - id: D10
    description: "Der Bildlauf-Kasten der Fundort-Ansicht scrollt tatsaechlich innen, wenn er ueberlaeuft"
    verification:
      - kind: automated_ui
        ref: "scripts/probes/mining-locview-messung.mjs (Gruppe e-bildlauf, 12/12 bestanden; Messmethode gegenueber Plan-Vorschlag angepasst, siehe Deviations)"
        status: pass
    human_judgment: false
  - id: D11
    description: "Die Dreifach-Ueberlagerung auf einer Kachel (is-here + is-sel + Nadel is-on) laesst alle drei Zustaende einzeln ablesen -- Kachelecke, Kachelflaeche und Nadelflaeche unterscheiden sich messbar"
    verification:
      - kind: automated_ui
        ref: "scripts/probes/mining-locview-messung.mjs (Gruppe f-dreifach-ueberlagerung, 12/12 bestanden, RGB-Abstaende 84-231 gegen die 8er-Marke)"
        status: pass
    human_judgment: false
  - id: D12
    description: "Ob die Dreifach-Ueberlagerung LESBAR wirkt, ob Spurenzeilen im Fluss als 'vorhanden, aber nicht abbauwuerdig' gelesen werden, und die uebrigen fuenf Fragen aus der Sichtrunde"
    verification: []
    human_judgment: true
    rationale: "Kein Skript kann beurteilen, ob eine messbar unterschiedliche Flaeche auch LESBAR wirkt oder ob eine gedaempfte Zeile im Lesefluss richtig gedeutet wird -- ausdruecklich an den Betreiber delegiert, geführt in .planning/WINDOWS.md id 12."

# Metrics
duration: ~100min
completed: 2026-08-15
status: complete
---

# Phase 12 Plan 3: Adresse, wahrheitsgemaesse Hilfe, gemessene Backstops Summary

**`?fundort=<Name>` macht die Fundort-Ansicht teilbar (Allow-List, kein Rohtext im DOM), die beiden Hilfetexte zur Fundort-Zeile und -Merkliste sagen wieder, was die Zeile tatsaechlich tut, und eine neue Messsonde belegt alle neun offenen UI-SPEC-Backstops am gerenderten Bildpunkt — dabei zwei echte, vorher unentdeckte Mängel gefunden und behoben: die Spurenzeilen-Dämpfung lag bei bis zu 1,33:1 statt der verlangten 4,5:1, und jede Spurenzeile mit Abzeichen war 1,6px höher als eine gewöhnliche.**

## Performance

- **Duration:** ~100 min
- **Started:** ~2026-08-15T16:30Z (Anschluss an 12-02)
- **Completed:** 2026-08-15T17:30Z
- **Tasks:** 3 (Task 1 tdd, Task 2 auto, Task 3 auto)
- **Files modified:** 7 (1 neu: `scripts/probes/mining-locview-messung.mjs`)

## Accomplishments

- Deep-Link-Zweig `fromQueryLoc()` in `assets/mining-workbench.js`, dieselbe Bauform wie der bestehende `?mineral=`-Zweig: Allow-List-Abgleich gegen `locIndex`, kanonischer Schlüssel wird gesetzt statt des gelesenen Werts, kein Treffer heißt nichts tun. Läuft nach dem Laden des gespeicherten Zustands und vor dem ersten `renderAll()`; beide Parameter vertragen sich nebeneinander (D-04)
- 3 neue e2e-Testfälle (T-12-16 bis T-12-18), 63 Testfälle insgesamt in `mining-shortlist.test.js`, 297 in der gesamten `test:e2e`-Suite, alle grün
- `mining.ctl.locpin` und `mining.ctl.shortlist` in `src/i18n/help.ts` (DE+EN) inhaltlich nachgezogen — beide Texte nennen jetzt beide Bedeutungen der Zeile, die Ankerzahl bleibt unverändert (`verify:help` weiterhin 12/12 Werkzeuge)
- Neue Messsonde `scripts/probes/mining-locview-messung.mjs` (außerhalb der Torkette): 4 Läufe (1280×720/1920×1080 × hell/dunkel) × 3 aus `assets/mining-db.json` selbst ermittelte Orte (meiste Erze, längster Name, meiste Anflugpunkte) × 6 Messgruppen = 72 Messpunkte am gerenderten Bildpunkt, alle bestanden
- Dabei zwei echte Mängel gefunden und behoben: Spurenzeilen-Dämpfung von 62%/65% auf gemessene 82%/90% angehoben (schlechtester Wert vorher 1,33:1, nachher 4,91:1 gegen die 4,5:1-Marke); 1,6px-Zeilenhöhenabweichung bei Spurenzeilen mit Abzeichen behoben (`line-height:1` auf `.wb__tag.is-trace`)
- Sonde einmal vorgeführt rot (Dämpfung testweise auf 20%, 4 von 24 Messpunkten fielen mit 1,3–1,4:1 durch), danach zurückgesetzt und erneut grün bestätigt
- `.planning/WINDOWS.md` trägt den neuen offenen Sichtrunde-Eintrag id 12 (Tabelle + JSON-Spiegel), `open_count`/`total_count` mitgewandert

## Task Commits

1. **Task 1: Ein Fundort bekommt eine Adresse (D-04)** — `aeae2c2` (feat)
2. **Task 2: Die Werkzeug-Hilfe sagt wieder die Wahrheit — beide Sprachen** — `f743e04` (fix)
3. **Task 3: Die neun offenen Zusicherungen belegen — gemessen UND als Sichtrunde übergeben** — `bba4229` (feat)

**Plan metadata:** _wird nach diesem SUMMARY committet_

## Files Created/Modified

- `assets/mining-workbench.js` — `fromQueryLoc()` zweiter Deep-Link-Zweig, nach `fromQuery()` (Mineral), vor der Zentrier-Warteschleife
- `src/i18n/help.ts` — `mining.ctl.locpin`/`mining.ctl.shortlist` DE+EN inhaltlich korrigiert, keine neuen Schlüssel
- `tests/e2e/helpers/mining-dom.js` — Kopfkommentar der bestehenden `search`-Option ergänzt (trägt jetzt auch `?fundort=`)
- `tests/e2e/mining-shortlist.test.js` — T-12-16 bis T-12-18
- `scripts/probes/mining-locview-messung.mjs` — **neu**: die Messsonde (siehe Accomplishments)
- `scripts/probes/README.md` — neue Sonde in der Tabelle, Einleitung um "auch gegen die gerenderte Seite" erweitert
- `src/components/MiningWorkbench.astro` — Spurenzeilen-Dämpfung 82%/90%, `line-height:1` auf `.wb__tag.is-trace`, beide mit Datums-/Fundstellen-Kommentar
- `.planning/WINDOWS.md` — neuer Eintrag id 12, Zähler aktualisiert
- `.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/deferred-items.md` — **neu**: out-of-scope-Fund in `browser-smoke.mjs` (siehe Deviations)

## Decisions Made

- **Reversibilität von `?fundort=` als „costly" gekennzeichnet, nicht gegattert** (Plan-Vorgabe): der Parametername und die Ortsnamen-Schreibweise sind ab Auslieferung eine öffentliche Zusage — geteilte Verweise brechen, wenn sich der Schlüssel aus der Fundort-Datenextraktion später ändert. Kein Entscheidungs-Checkpoint nötig, die Bewertung steht hier in der Projektgeschichte.
- **Zentrier-Warteschleife nicht auf den Fundort-Zweig ausgeweitet**, wie vom Plan als offene Frage markiert — bestätigt: die Fundort-Ansicht ersetzt den Spalteninhalt und zeichnet bei Bildlaufposition 0, es gibt dort keine bestehende Zeile, zu der gescrollt werden müsste. Strukturell durch T-12-16/T-12-18 belegt, zusätzlich am gerenderten Bildpunkt durch Messgruppe c.
- **Spurenzeilen-Dämpfung auf 82%/90% gesetzt** — iterativ per Sonden-Kalibrierung ermittelt (siehe Deviations), nicht geschätzt.
- **`line-height:1` nur auf `.wb__tag.is-trace`**, nicht auf das geerbte `.wb__tag` selbst — das lebt auch außerhalb der Fundort-Ansicht (`#wb-tags`, Kind-/Methoden-/Seltenheits-Abzeichen), eine Änderung an der Basisklasse hätte dort unbeabsichtigte Nebenwirkungen gehabt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Spurenzeilen-Dämpfung 62%/65% verfehlte die 4,5:1-Marke deutlich**
- **Found during:** Task 3, erster Messsonden-Lauf gegen den ausgelieferten Stand
- **Issue:** Der UI-SPEC-Startwert (ausdrücklich „kein Freigabewert") lag real bei 2,89:1 bis 3,38:1 (Unterzeile/Prozentzahl, beide Farbmodi) und im Hellmodus teils schon beim Namen unter der Marke (4,14:1–4,52:1) — weit unter der geforderten 4,5:1.
- **Fix:** Iterativ per Sonden-Kalibrierung (temporäre `page.addStyleTag()`-Overrides ohne Neubau) auf 82%/90% angehoben, dann in `src/components/MiningWorkbench.astro` geschrieben und mit einem vollen Build gegengeprüft. Schlechtester gemessener Wert danach: 4,91:1 (Unterzeile, hell).
- **Files modified:** src/components/MiningWorkbench.astro
- **Verification:** `scripts/probes/mining-locview-messung.mjs` 72/72 Messpunkte grün; `npm run build && npm run gate` grün (normal UND `STAGING=1`); `npm run verify:theme` grün (Hellmodus-Entsprechung generiert sich korrekt aus den neuen Prozentwerten)
- **Committed in:** `bba4229` (Task 3 Commit)

**2. [Rule 1 - Bug] Spurenzeile mit Abzeichen war 1,6px höher als eine gewöhnliche Zeile**
- **Found during:** Task 3, Messgruppe d (Zeilenhöhen-Backstop)
- **Issue:** Das geerbte `.wb__tag` benutzt die Komponentenbasis-Zeilenhöhe 1,3 (15,21px bei 11,7px Schrift) plus 2px Innenabstand oben/unten = 19,2px — höher als eine `.p`-Zeile (17,55px). Phase 12 ist der erste Verbrauchsort, der Name und Abzeichen in derselben Flex-Zeile (`.wb__nm`) platziert; vorher lebte `.wb__tag` immer auf einer eigenen Zeile (`#wb-tags`), wo die Differenz nie auffiel. Reproduzierbar an JEDER Spurenzeile, nicht nur bei langen Namen: 45,4px statt 43,8px, in allen 12 gemessenen Lauf-Orts-Kombinationen.
- **Fix:** `line-height:1` auf die neue Modifikatorklasse `.wb__tag.is-trace` (11,7px + 4px Innenabstand = 15,7px, unter den 17,55px von `.p` — die Flex-Zeile richtet sich wieder nach `.p` aus). Das geerbte `.wb__tag` selbst bleibt unangetastet.
- **Files modified:** src/components/MiningWorkbench.astro
- **Verification:** `scripts/probes/mining-locview-messung.mjs` Gruppe d 12/12 grün (vorher 12/12 rot); 297/297 `test:e2e` weiterhin grün; `npm run build && npm run gate` grün
- **Committed in:** `bba4229` (Task 3 Commit)

**3. [Rule 3 - Blocking] Precondition „playwright-core im Worktree auflösbar" traf nicht zu**
- **Found during:** Task 3, Precondition-Prüfung vor dem ersten Sondenlauf
- **Issue:** `node_modules` dieses Worktrees war leer (nur `.astro`/`.vite`-Caches); Node löste Pakete über den Haupt-Checkout auf (262 Pakete dort), aber `playwright-core` fehlte in BEIDEN — `require.resolve('playwright-core')` und `npm ls playwright-core` bestätigten das in Worktree UND Hauptrepo.
- **Fix:** `npm install` (ohne Argument) im Worktree ausgeführt — reconciliert `node_modules` ausschließlich aus dem bereits committeten `package-lock.json`, kein neues Paket, keine Versionsänderung. `git status --short package.json package-lock.json` vor UND nach dem Lauf leer bestätigt (kein Manifest-Drift). Dies ist bewusst NICHT `npm install <pkg>` (der ausgeschlossene Rule-3-Fall) — kein neuer, unrezensierter Paketname wird eingeführt, nur eine bereits gesperrte Abhängigkeit materialisiert.
- **Files modified:** keine (node_modules ist gitignored)
- **Verification:** `require.resolve('playwright-core')` löst danach auf; `git status --short package.json package-lock.json` leer
- **Committed in:** n/a (kein Dateiwechsel)

**4. [Rule 1 - Verifikationsgenauigkeit] `assets/tool-help.js`s Erstbesuch-Öffnung blockierte Messgruppe f**
- **Found during:** Task 3, erster Voll-Lauf der Sonde
- **Issue:** Der delegierte Nadel-Klick (Messgruppe f) lief in einen 30s-Playwright-Timeout: `<details class="tool-help">` öffnete sich bei jedem frischen Kontext automatisch (Erstbesuch-Verhalten), seine absolut positionierte `.tool-help__body` (`z-index:14`) überlagerte die Kachelspalte und fing den Klick ab. Ursache: der naheliegende Dismiss-Wert `localStorage.setItem('vb.help.seen', '{"all":1}')` (wörtlich aus `scripts/browser-smoke.mjs` übernommen) trifft `seen[id]` in `assets/tool-help.js` NIE — der Speicher ist je `data-tool-id` geschlüsselt (`"mining"`), nicht unter einem Sammelschlüssel `"all"`. Das ist ein latenter, vorbestehender No-op-Fehler in `browser-smoke.mjs` selbst, siehe `deferred-items.md`.
- **Fix:** In der neuen Sonde korrekt geschlüsselt: `localStorage.setItem('vb.help.seen', JSON.stringify({ mining: 1 }))`, über `context.addInitScript()` vor jedem Laden gesetzt (beide Farbmodi, nicht nur hell).
- **Files modified:** scripts/probes/mining-locview-messung.mjs (kein anderer Task betroffen)
- **Verification:** Messgruppe f lief danach ohne Timeout, 12/12 Lauf-Orts-Kombinationen grün
- **Committed in:** `bba4229` (Task 3 Commit)

**5. [Rule 1 - Messmethode korrigiert] Backstop „Bildlaufleiste sichtbar" ließ sich nicht über die Kastenbreite messen**
- **Found during:** Task 3, erster Voll-Lauf der Sonde
- **Issue:** Der plangemäße Ansatz (`offsetWidth - clientWidth > 0` als Nachweis einer sichtbaren Leiste) meldete bei nachweislichem Überlauf (914px Inhalt in einem 778px-Kasten) durchgängig `0` — dieses Chromium rendert `scrollbar-width:thin` (`assets/mobile-ux.css`) als echten Overlay, der keinen Layout-Platz reserviert. Die Breitendifferenz ist für dieses Projekt schlicht kein gültiges Signal für „Leiste sichtbar".
- **Fix:** Messung auf tatsächliche Scroll-WIRKUNG umgestellt: `scrollTop` setzen und prüfen, ob sich die erste sichtbare Zeile dadurch wirklich verschiebt (>=10px). Prüft damit die eigentliche Zusicherung der UI-SPEC-Zeile („Bis zu 27 Fundortzeilen … scrollen in ihren `.wb__scroll`-Kästen") direkter als eine Breitenmessung es könnte.
- **Files modified:** scripts/probes/mining-locview-messung.mjs
- **Verification:** Messgruppe e 12/12 grün, mit dokumentierter Begründung im Quellcode-Kommentar
- **Committed in:** `bba4229` (Task 3 Commit)

---

**Total deviations:** 5 auto-fixed (2 Rule 1 Bugs am Produktcode, 1 Rule 3 Blocking an der Umgebung, 2 Rule 1 Verifikationsgenauigkeit an der Sonde selbst)
**Impact on plan:** Zwei echte, vorher unentdeckte Produktmängel gefunden und behoben (Kontrast, Zeilenhöhe) — genau der Zweck der Messsonde. Die übrigen drei Funde betrafen die Umgebung/Sonde selbst, keine funktionale Abweichung von der geplanten Architektur.

## Issues Encountered

**`scripts/browser-smoke.mjs`s Erstbesuch-Hilfe-Dismiss ist für JEDES Werkzeug ein No-op** — außerhalb des Geltungsbereichs dieses Plans gefunden (Datei nicht in `files_modified`), nicht behoben, dokumentiert in `deferred-items.md` mit Fundstelle und Vorschlag.

## Known Stubs

Keine.

## User Setup Required

None — keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

- Phase 12 ist inhaltlich abgeschlossen: alle sechs Oberflächen aus `12-CONTEXT.md` sind verdrahtet und automatisiert bewiesen (Pläne 01/02), der Adressparameter ist da (Plan 03), die Hilfetexte stimmen wieder, und alle 48 UI-SPEC-Zustandszusicherungen sind entweder `✅ covered` oder gemessen (`🧪 backstop`, 9/9 grün).
- `npm run build && npm run gate` grün, normal UND mit `STAGING=1` (18/18 Schienen-A-Schritte, beide Läufe, auf dem committeten Stand).
- `node --test tests/e2e/*.test.js` grün, 297 Fälle (`mining-shortlist.test.js` allein: 63, Plan verlangte mindestens 54).
- `node scripts/verify-help.mjs --complete` grün, 12/12 Werkzeuge.
- `node scripts/probes/mining-locview-messung.mjs` grün, 72/72 Messpunkte — außerhalb der Torkette, von Hand gegen eine Vorschau des gebauten `dist/` zu fahren, wenn sich Spurenzeilen-Optik oder Fundort-Ansicht-Layout künftig ändern.
- **Offen für den Betreiber:** `.planning/WINDOWS.md` id 12 — die Sichtrunde (7 Punkte, DE+EN, beide Farbmodi, 1920×1080 und 1280×720), vom Executor ausdrücklich nicht durchgeführt. Deckt inhaltlich auch die noch offenen id 10 (Phase 9) und id 11 (Phase 10) mit ab; alle drei bleiben eigene Einträge, bis der Betreiber sie gemeinsam abnimmt.
- **Auslieferung:** Fertige, geprüfte Arbeit gehört auf `staging`, nie auf `main` (Hausregel) — dieser Plan wurde nicht ausgeliefert, nur committet und lokal geprüft.

---
*Phase: 12-fundorte-in-der-mining-werkbank-anklickbar*
*Completed: 2026-08-15*

## Self-Check: PASSED

All claimed files and commit hashes verified present on disk / in git log:
- `assets/mining-workbench.js`, `src/i18n/help.ts`, `src/components/MiningWorkbench.astro`, `tests/e2e/helpers/mining-dom.js`, `tests/e2e/mining-shortlist.test.js`, `scripts/probes/mining-locview-messung.mjs`, `scripts/probes/README.md`, `.planning/WINDOWS.md`, `.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/deferred-items.md`, `.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/12-03-SUMMARY.md` FOUND
- `aeae2c2`, `f743e04`, `bba4229` FOUND
