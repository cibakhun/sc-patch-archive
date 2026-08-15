---
phase: 10-mining-presets-bedienbar-machen
plan: 01
subsystem: ui
tags: [astro, vanilla-js, postgrest, supabase, mining-workbench, tdd]

requires:
  - phase: 09-mining-werkbank-fundort-merkliste
    provides: "mining_sig_presets Tabelle mit locations-Spalte (Migration 20260815090000), preSave()/preDrop()/preApply()-Grundgeruest"
provides:
  - "sichtbare Preset-Liste (#wb-preset-list) statt <select> mit Auswahlzustand (D-05)"
  - "Umbenennen per einzelnem PATCH auf (user_id, name), inkl. 409-Kollisionsbehandlung (D-02 Form 1)"
  - "Loeschen mit zweiklickiger, beschrifteter Rueckfrage statt sofortigem DELETE (D-01)"
  - "Ueberschreiben mit dem aktuellen Arbeitsstand ueber denselben Upsert-Pfad (D-02 Form 2)"
  - "Einzeleintrag-Entfernen (Erz oder Fundort-Paar) per gezieltem PATCH, ohne Preset zu laden (D-02 Form 3)"
affects: [10-mining-presets-bedienbar-machen/10-02]

tech-stack:
  added: []
  patterns:
    - "renderPresetList() als Textbaustein-Funktion (.map().join('') auf innerHTML), Vorbild renderPins()"
    - "PATCH ueber window.VBAccount.rest() fuer Umbenennen und Einzeleintrag-Entfernen, Vorbild hbWrite() in account-lite.js"
    - "data-pre-* Attributnamensraum fuer Preset-Zeilen-Aktionen, bewusst getrennt von data-pin/data-locpin"

key-files:
  created: []
  modified:
    - src/components/MiningWorkbench.astro
    - assets/mining-workbench.js
    - tests/e2e/helpers/mining-dom.js
    - tests/e2e/mining-shortlist.test.js

key-decisions:
  - "Umbenennen als EIN PATCH auf den Primaerschluessel statt POST+DELETE — atomar, ein Fehlerfall (409), keine Datenverlust-Zwischenzustaende"
  - "Loeschen-Bestaetigung als eigener Inline-Zustand (zwei Klicks, zweiter traegt Worte), kein window.confirm() — dieselbe Begruendung wie das bestehende wb-pre-edit-Muster"
  - "Einzeleintrag entfernen OHNE preApply(): Ansehen und Ausduennen aendern nie den Arbeitsstand, sonst loest sich die Grenze zu Ueberschreiben auf (CONTEXT.md-Entscheidung)"
  - "Keine neuen CSS-Farbtoken — Warnschraffur der Rueckfrage und alle neuen Farben ausschliesslich ueber var(--...)/color-mix(), damit verify:theme gruen bleibt"

requirements-completed: [D-01, D-02, D-05]

coverage:
  - id: D1
    description: "Sichtbare Preset-Liste ersetzt <select>, Klick waehlt aus und markiert is-sel (D-05)"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Presetliste zeigt jedes gespeicherte Preset als eigene Zeile mit data-preset"
        status: pass
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Klick auf eine Preset-Zeile wendet sie an und markiert genau diese Zeile mit is-sel"
        status: pass
    human_judgment: false
  - id: D2
    description: "Umbenennen per einzelnem PATCH mit eigenem 409-Zweig (presetNameTaken) (D-02 Form 1)"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Umbenennen schickt genau EINEN PATCH-Aufruf (Pfad und Rumpf tragen den alten bzw. neuen Namen), keinen POST/DELETE"
        status: pass
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Umbenennen auf einen bereits vergebenen Namen meldet presetNameTaken, die Zeile behaelt ihren alten Namen"
        status: pass
    human_judgment: false
  - id: D3
    description: "Loeschen fragt zurueck: erster Klick loest kein DELETE aus, erst die beschriftete Zeile; Rueckfrage wandert korrekt (D-01)"
    requirement: "D-01"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Erster Klick auf den Loeschknopf loest keinen DELETE aus, die Zeile zeigt danach presetDelAsk"
        status: pass
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Zweiter Klick (auf die beschriftete Schaltflaeche) loest genau EIN DELETE aus"
        status: pass
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Rueckfrage bei Preset A, Klick auf den Loeschknopf von Preset B: die Rueckfrage wandert zu B, A wird nicht geloescht"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ueberschreiben (aktueller Arbeitsstand via Upsert) und Einzeleintrag-Entfernen (gezielter PATCH, ohne Arbeitsstand anzufassen) (D-02 Form 2+3)"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Ueberschreiben schickt den bestehenden Upsert unter demselben Namen mit dem AKTUELLEN Arbeitsstand, kein DELETE, kein zweiter Aufruf"
        status: pass
      - kind: unit
        ref: "tests/e2e/mining-shortlist.test.js#Ein Erz aus einer aufgeklappten Preset-Zeile entfernen schickt genau ein PATCH mit dem Feld minerals; die Arbeitslisten bleiben unveraendert"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sichttauglichkeit der neuen Preset-Zeilen-Optik (Layout, Warnschraffur, Icon-Sprache) im echten Browser"
    verification: []
    human_judgment: true
    rationale: "Der e2e-Testlauf verifiziert Markup und Klick-Protokoll gegen ein Mock-DOM, nicht die tatsaechliche visuelle Wirkung (Abstaende, Kontrast der Warnschraffur, Icon-Groessen im Browser)."

duration: 35min
completed: 2026-08-15
status: complete
---

# Phase 10 Plan 01: Preset-Bedienung Summary

**Preset-Auswahlfeld durch eine klickbare Zeilenliste ersetzt; Umbenennen/Ueberschreiben/Loeschen/Einzeleintrag-Entfernen laufen ausschliesslich ueber gezielte `PATCH`/`POST`/`DELETE`-Aufrufe gegen `mining_sig_presets`, mit einer zweiklickigen, wortbeschrifteten Loesch-Rueckfrage statt eines zweiten `×`.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-15T03:14:58Z (Init/Zustandsuebernahme)
- **Completed:** 2026-08-15T03:48:21Z (letzter Task-Commit)
- **Tasks:** 3
- **Files modified:** 4 (`src/components/MiningWorkbench.astro`, `assets/mining-workbench.js`, `tests/e2e/helpers/mining-dom.js`, `tests/e2e/mining-shortlist.test.js`)

## Accomplishments

- Das `<select>` fuer Presets ist aus beiden gebauten Mining-Seiten verschwunden; `#wb-preset-list` zeigt jedes gespeicherte Preset als eigene, anklickbare Zeile mit Auswahlzustand (`is-sel`), im Formvorbild von `.wb__tile`/`.wb__pin-item`.
- Umbenennen laeuft ueber genau EINEN `PATCH` auf `?name=eq.<alt>`; eine Namenskollision (HTTP 409) zeigt die eigene Meldung `presetNameTaken` statt des allgemeinen Fehlertexts, die Zeile behaelt dabei ihren alten Namen.
- Der Loeschknopf ist jetzt ein Muelleimer-Symbol (`#wb-i-trash`, dieselbe Bildsprache wie die Konto-Gefahrenzone) statt eines zweiten `×`. Der erste Klick loest keinen Netzwerkaufruf aus, sondern verwandelt die ganze Aktionszeile in eine ueber die volle Breite beschriftete Rueckfrage mit Warnschraffur; erst der zweite Klick loescht.
- Eine Preset-Zeile laesst sich aufklappen (Zaehlzeile als Griff, `aria-expanded`), ohne das Preset anzuwenden; darin laesst sich ein einzelnes Erz oder Fundort-Paar per gezieltem `PATCH` entfernen, ohne den Arbeitsstand zu beruehren. Ein neuer Ablage-Knopf ueberschreibt das Preset mit der aktuellen Auswahl (eigene Rueckmeldung `presetUpdated`).
- 22 Testfaelle (Phase 9: 15) wurden auf den Klickweg umgestellt bzw. hinzugefuegt in Task 1, weitere 4 in Task 2 und 7 in Task 3 — Endstand **33 Testfaelle**, alle gruen, jeder neue Fall einmal rot vorgefuehrt (siehe „Vorgefuehrt rot" unten).

## Task Commits

Each task was committed atomically:

1. **Task 1: Leitschuss — sichtbare Preset-Liste statt Auswahlfeld, Umbenennen durch alle Schichten** - `f10a69f` (feat)
2. **Task 2: Loeschen fragt zurueck — anderes Zeichen, anderer Ort, andere Farbe (D-01)** - `eac6c4d` (feat)
3. **Task 3: Ueberschreiben und Ausduennen — die Preset-Zeile zeigt und aendert ihren Inhalt (D-02)** - `aeaa177` (feat)

_Hinweis: Die drei Tasks sind funktional TDD-artig (Tests zuerst rot, dann Implementierung gruen), aber jeweils als EIN Commit gefasst — das entspricht dem Plan-Vertrag, der pro Task genau eine `<verify>`-Strecke und einen Abnahmezustand vorgibt, nicht einen RED/GREEN-Commit-Wechsel wie beim formalen TDD-Plan-Typ._

## Files Created/Modified

- `src/components/MiningWorkbench.astro` — Preset-Block umgebaut (Liste statt `<select>`), drei neue SVG-Symbole (`wb-i-edit`, `wb-i-trash`, `wb-i-save`), neue Sprachschluessel in `S_DE`/`S_EN`, neue CSS-Regeln fuer Zeilen/Aktionen/Rueckfrage/Aufklapp-Ansicht
- `assets/mining-workbench.js` — `renderPresetList()` ersetzt `preFill()`; neue Funktionen `preRename()`, `preRemoveEntry()`; `preMode()`, `preApply()`, `preSave()`, `preDrop()` erweitert; drei neue Zustandsvariablen (`preCur`, `preEditFor`, `preAsk`, `preOpen`); sieben neue Zweige im delegierten Klick-Handler
- `tests/e2e/helpers/mining-dom.js` — Mock-DOM auf Liste statt `<select>` umgestellt, `makeAccount()` um `status`-Feld und `PATCH`-Zweig (409 bei Namenskollision, gezielte Feldersetzung) erweitert, neue Mock-Sprachschluessel
- `tests/e2e/mining-shortlist.test.js` — sechs bestehende Testfaelle auf `selectPreset()` (Klickweg) umgestellt, 18 neue Testfaelle fuer D-01/D-02/D-05 und T-10-01 ergaenzt

## Decisions Made

- Umbenennen als EIN `PATCH` auf den Primaerschluessel (nicht POST+DELETE) — atomar, ein Fehlerfall (409), keine Zwischenzustaende mit Datenverlustrisiko. Begruendet in RESEARCH.md Vertiefung 1, bereits im Plan vorentschieden.
- Loeschen-Rueckfrage als eigener Inline-Zustand (zwei Klicks, zweiter traegt Worte, volle Zeilenbreite, Warnschraffur), kein `window.confirm()` — konsistent mit der bestehenden Begruendung gegen `window.prompt()` im selben Bauteil.
- Einzeleintrag-Entfernen OHNE `preApply()`: das blosse Ausduennen einer gespeicherten Zeile darf weder den Arbeitsstand noch das aktive Preset veraendern, sonst waere die Grenze zu „Ueberschreiben" aufgeloest (CONTEXT.md, Abschnitt „Im Planungslauf nachgeschaerft").
- Keine neuen CSS-Farbtoken: jede neue Farbe (Rueckfrage-Warnschraffur, Hover-Ton des Loeschknopfs) kommt ausschliesslich aus `var(--...)`/`color-mix()` — `verify:theme` bestaetigt am Ende, dass keine erzeugte Hellmodus-Entsprechung fehlt.

## Vorgefuehrt rot (CLAUDE.md Grundsatz 1)

Jede neue Zusicherung wurde vor der zugehoerigen Implementierung einmal absichtlich rot gesehen:

- **Task 1:** Nach dem Umbau von Mock-DOM (`wb-preset-list` statt `<select>`) und Testdatei (Klickweg statt Feldwert), aber VOR der Produktivcode-Aenderung: `node --test tests/e2e/mining-shortlist.test.js` → **22 Faelle, 0 bestanden, 22 fehlgeschlagen** (`Cannot read properties of null (reading 'addEventListener')`, da `wb-preset`/`wb-pre-del` im Mock nicht mehr existieren). Nach der Implementierung: **22/22 gruen.**
- **Task 2:** Die vier neuen Loesch-Testfaelle liefen gegen den nach Task 1 committeten Stand (Produktivcode absichtlich per `git checkout --` auf den Task-1-Commit zurueckgesetzt, Tests bereits ergaenzt): **26 Faelle, 22 bestanden, 4 fehlgeschlagen.** Nach Wiederherstellen der Task-2-Aenderungen: **26/26 gruen.**
- **Task 3:** Analoges Verfahren fuer die sieben neuen Testfaelle zu Aufklappen/Ueberschreiben/Ausduennen, Produktivcode auf den Task-2-Commit zurueckgesetzt: **33 Faelle, 26 bestanden, 7 fehlgeschlagen.** Nach Wiederherstellen: **33/33 gruen.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Leerer Attributwert wurde vom geteilten Mock-DOM-Helfer als `null` gelesen**
- **Found during:** Task 1, beim ersten GREEN-Lauf
- **Issue:** `data-pre-pick=""`/`data-pre-rename=""` (leerer Wert, wie in der Plan-Notation `[data-pre-pick]` suggeriert) wurde von `MockElement.getAttribute()` in `tests/e2e/helpers/dom-mock.js` als `this.attributes[name] || null` zurueckgegeben — ein leerer String ist falsy, der Fallback griff faelschlich und lieferte `null`. Dadurch fanden `closest('[data-pre-pick]')` etc. die Attribute nicht, obwohl das reale DOM sie korrekt liefert.
- **Fix:** Attributwert auf `"1"` (nicht-leerer Marker) statt `""` umgestellt — funktional identisch im echten Browser (Attributselektoren pruefen nur Anwesenheit), ohne den geteilten `dom-mock.js`-Helfer (von mehreren Testsuiten genutzt) anzufassen.
- **Files modified:** `assets/mining-workbench.js` (alle `data-pre-*`-Attributwerte in `renderPresetList()`)
- **Verification:** `node --test tests/e2e/mining-shortlist.test.js` — betroffene Faelle wechselten von rot zu gruen.
- **Committed in:** `f10a69f` (Task 1 commit)

**2. [Rule 1 - Bug] Neue Sprachschluessel im Mock-Sprachobjekt vergessen**
- **Found during:** Task 2 und Task 3, jeweils beim ersten GREEN-Lauf
- **Issue:** `presetDelAsk` (Task 2) sowie `presetUpdate`/`presetUpdated`/`presetShow`/`presetHide`/`presetRemoveEntry`/`presetNoEntries` (Task 3) wurden in `S_DE`/`S_EN` (Produktivcode) ergaenzt, aber im Test-Mock-Sprachobjekt `tests/e2e/helpers/mining-dom.js` zunaechst uebersehen — betroffene Testfaelle scheiterten mit `actual: 'SAVED'/'', expected: undefined`.
- **Fix:** Mock-Sprachobjekt um dieselben Schluessel mit Platzhalterwerten (`'DEL-ASK'`, `'UPDATED'` usw.) ergaenzt.
- **Files modified:** `tests/e2e/helpers/mining-dom.js`
- **Verification:** Betroffene Testfaelle wechselten von rot zu gruen; volle Suite (33 Faelle) gruen.
- **Committed in:** `eac6c4d` (Task 2), `aeaa177` (Task 3)

**3. [Rule 1 - Bug] `renameBtn()`-Testhelfer griff nach Task 3 den falschen Knopf**
- **Found during:** Vor dem Schreiben der Task-3-Testfaelle (praeventiv erkannt, nicht als Testfehler beobachtet)
- **Issue:** `renameBtn()` wählte bislang per `querySelector('.wb__pre-a')` den ERSTEN Knopf dieser Klasse. Task 3 fuegt einen weiteren Knopf derselben Klasse (Ueberschreiben) VOR dem Umbenennen-Stift ein — der Helfer haette ab Task 3 den Ueberschreiben-Knopf statt des Stifts zurueckgegeben.
- **Fix:** Auf Attributfilterung umgestellt (`.find(b => b.getAttribute('data-pre-rename') !== null)`), robust gegenueber der DOM-Reihenfolge.
- **Files modified:** `tests/e2e/mining-shortlist.test.js`
- **Verification:** Alle Umbenennen-Testfaelle (aus Task 1) liefen nach der Umstellung weiterhin gruen, jetzt zusammen mit den neuen Ueberschreiben-Testfaellen.
- **Committed in:** `aeaa177` (Task 3 commit)

**4. [Rule 1 - Bug] `.wb__pre-cnt` fehlte in der `:focus-visible`-Sammelregel (Plan-Vorgabe aus Task 1 uebersehen)**
- **Found during:** Task 3, beim Umbau der Zaehlzeile zu einem echten `<button>`
- **Issue:** Task 1's Aktionsspezifikation verlangte bereits `.wb__pre-name`, `.wb__pre-cnt`, `.wb__pre-a` in der bestehenden Fokus-Sammelregel — `.wb__pre-cnt` wurde in Task 1 vergessen (in Task 1 war es noch ein `<span>`, also folgenlos; seit Task 3 ist es ein fokussierbarer `<button>`).
- **Fix:** `.wb__pre-cnt:focus-visible` in Task 3 nachgetragen.
- **Files modified:** `src/components/MiningWorkbench.astro`
- **Verification:** Quellpruefung (grep), `npm run build` gruen.
- **Committed in:** `aeaa177` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (4× Rule 1 — Bug/Versehen in Test-Infrastruktur bzw. einer uebersehenen Plan-Detailvorgabe, keines davon veraendert sichtbares Verhalten der ausgelieferten Seite)
**Impact on plan:** Alle vier Korrekturen betreffen Test-Infrastruktur oder eine im Plan bereits geforderte, aber in Task 1 uebersehene CSS-Zeile — keine Abweichung von der geplanten Bedienlogik, kein Scope Creep.

## Issues Encountered

None über die oben dokumentierten Deviations hinaus.

## User Setup Required

None - keine externe Dienstkonfiguration erforderlich. Die Tabelle `mining_sig_presets` samt RLS-Politiken existiert bereits seit Phase 9 (Migration `20260812040000_mining_sig_presets.sql`), diese Phase legt keine Migration an.

## Machine Verification (npm run build && npm run gate)

Vollstaendig gruen nach Task 3 (Endstand des Plans):

```
=== Bilanz Schiene A ===
  ✓ verify:wiring             0.1s
  ✓ verify:metrics            0.3s
  ✓ pretest:e2e               0.1s
  ✓ test:e2e                  8.7s
  ✓ verify                   13.5s
  ✓ verify:vendor             0.1s
  ✓ audit:csp                11.3s
  ✓ verify:crafting           0.9s
  ✓ verify:typo              11.8s
  ✓ verify:layers            11.5s
  ✓ verify:sync              11.9s
  ✓ verify:theme              1.3s
  ✓ verify:vehicle-roles      0.1s
  ✓ verify:weapons            0.1s
  ✓ verify:help               9.4s
  ✓ verify:fx                10.4s
  ✓ audit:site               62.6s
  ✓ verify:mining             0.1s

  18 von 18 Schritten gruen · Gesamtzeit 154.0s

✓ Tor GRUEN — Schiene A vollstaendig bestanden.
```

Zusaetzlich: `STAGING=1 npm run build` erfolgreich (17359 Seiten), `node --test tests/e2e/*.test.js` → 267/267 gruen (gesamte e2e-Suite, keine Regression in anderen Werkzeugen).

## Next Phase Readiness

- Plan 02 (Reiter entfallen, Spaltenbreiten, Scanwert entfernt) kann auf dem hier gebauten Preset-Block aufsetzen — die Preset-Leiste selbst liegt ausserhalb der Reiter/Spaltenbreiten-Aenderung und ist unveraendert wiederverwendbar.
- Kein Blocker. `assumption_delta_decision` aus dem Plan (Primaerschluessel bleibt `(user_id, name)`) ist die Uebergabenotiz an Phase 11 (Geteilte Routen): sobald ein Preset eine oeffentliche Adresse bekommt, macht jedes Umbenennen diese Adresse ungueltig — dann braucht es einen stabilen Ersatzschluessel.

---
*Phase: 10-mining-presets-bedienbar-machen*
*Completed: 2026-08-15*
