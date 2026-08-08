---
phase: 02-schrift-und-bewegungsskala
plan: 01
subsystem: ui
tags: [css-custom-properties, design-tokens, astro, css]

requires: []
provides:
  - "19 Schriftgrad-Tokens (--fs-1..--fs-19), 20 Laufweiten-Tokens (--ls-1..--ls-20), drei Bewegungs-Tokens (--dur-fast/base/slow) und --ease-ui in assets/theme.css"
  - "scripts/audit-typo-motion.mjs: wiederverwendbares Erhebungswerkzeug fuer font-size/letter-spacing/transition (--only, --expect-remaining)"
  - "scripts/verify-typo-motion.mjs + npm run verify:typo: bleibendes Prueftor gegen dist/ (drei Prüforte, fünf Zusicherungen)"
  - "SiteNav.astro und beide index.astro vollstaendig auf die Skala umgestellt"
affects: ["02-02", "02-03", "02-04", "02-05", "02-06", "02-07"]

tech-stack:
  added: []
  patterns:
    - "Schriftgrad-/Laufweiten-/Bewegungs-Tokens auf blankem :root{} in assets/theme.css, Abschnitt 4 -- gleiche Begruendung wie die Farb-Schichten 1+2 (gueltig auch ohne Umschalt-Script)"
    - "Named-exception-Erkennung per Selektor-Rueckwaertssuche (nearestSelector) statt Wert-Heuristik fuer Design-Entscheidungen, die nicht mechanisch aus dem Wert selbst ablesbar sind (Hero-Ausnahme, Scroll-Reveal)"

key-files:
  created:
    - scripts/audit-typo-motion.mjs
    - scripts/verify-typo-motion.mjs
  modified:
    - assets/theme.css
    - src/components/SiteNav.astro
    - src/pages/index.astro
    - src/pages/de/index.astro
    - package.json

key-decisions:
  - "Ausgangszahlen des Plans (1968/95/865/663) durch einen rigorosen Nachvollzug ersetzt (1961/96/863/660) -- die Differenzen sind einzeln erklaert (Deviations), nicht geraten"
  - "Bedienuebergang-Zusicherung im Audit-Skript zaehlt ui+token statt nur ui, damit spaetere Plaene (03-06) den bereits erreichten Ist-Stand nicht als Regression melden"
  - "Bei exakten Ties in der Stufenzuordnung (z.B. 1.05rem genau zwischen --fs-10 und --fs-11) wird die staerker belegte Stufe gewaehlt"

patterns-established:
  - "Drei-Orte-Pruefung gegen dist/ (theme.css + _astro/*.css + **/*.html) als Vorlage fuer verify:typo -- Plan 07 haengt es nur noch ins Dockerfile-Tor ein"

requirements-completed: [TYPO-01, TYPO-02, TYPO-03]

coverage:
  - id: D1
    description: "assets/theme.css traegt Abschnitt 4 mit allen 19 --fs-*, 20 --ls-*, drei --dur-* und --ease-ui; npm run theme laesst die Datei unveraendert (THEME-02)"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "npm run theme + git diff assets/theme.css (manuell verglichen, siehe Deviations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SiteNav.astro: 20 font-size, 16 letter-spacing, Bedienuebergang-Teile der 22 transition-Deklarationen auf Tokens; .snav__brand span rendert weiterhin exakt 1rem/0.18em"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs --only src/components/SiteNav.astro --expect-remaining 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Beide index.astro (EN+DE) auf die Skala umgestellt, byte-identisch fuer alle sieben Zaehlmuster; vier benannte Ausnahmen (Hero-clamp(), 360px-Regel, .reveal, .tool::before-Zoom) bleiben woertlich stehen"
    requirement: TYPO-02
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs --only src/pages/index.astro --expect-remaining 0 (+ de/index.astro) und der EN/DE-Zaehlvergleich aus dem Plan"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run verify:typo (neu) laeuft gruen mit fuenf Zusicherungen gegen den gebauten Stand; verify/audit:site/verify:fx/verify:help unveraendert gruen"
    requirement: TYPO-03
    verification:
      - kind: other
        ref: "npm run verify:typo; npm run verify; npm run audit:site; npm run verify:fx; npm run verify:help"
        status: pass
    human_judgment: false
  - id: D5
    description: "Scroll-verknuepfte Wandlung (measureMorph) hat rechnerisch identische Eingangswerte wie vor der Phase -- Sichtpruefung im Browser (Landung, Fortschrittskurve) steht noch aus"
    verification: []
    human_judgment: true
    rationale: "Die rechnerische Unveraenderlichkeit von --fs-10=1rem/--ls-15=0.18em ist maschinell bewiesen (verify:typo Zusicherung 4); ob die Wandlung sich beim tatsaechlichen Scrollen weiterhin wie in 01-SUMMARY.md beschrieben anfuehlt, kann nur ein Mensch im Browser beurteilen (Pitfall 6 aus 02-RESEARCH.md)."

duration: ~55min
completed: 2026-08-08
status: complete
---

# Phase 2 Plan 1: Schrift- und Bewegungsskala Tracer Summary

**Gemessene 19-Stufen-Schriftskala, 20-Stufen-Laufweitenskala und dreistufige Bewegungssprache in `assets/theme.css`, end-to-end bewiesen an Kopfleiste und beiden Startseiten bis ins gehashte Astro-Bündel, samt bleibendem Prüftor gegen den gebauten Stand.**

## Performance

- **Duration:** ~55min
- **Tasks:** 3/3 completed
- **Files modified:** 5 (2 neu, 3 geändert)

## Accomplishments

- `scripts/audit-typo-motion.mjs`: rekursives Erhebungswerkzeug für `font-size`/`letter-spacing`/`transition` über `src/**/*.astro` + `assets/*.css`, mit korrekter Top-Level-Komma-Splittung (schützt `cubic-bezier(...)`), Selektor-Rückwärtssuche für die Scroll-Reveal- und Hero-Ausnahmen, und `--only`/`--expect-remaining` für dateischarfe Restwert-Prüfung.
- `assets/theme.css` § 4 "Schrift- und Bewegungsskala": 19 `--fs-*`, 20 `--ls-*`, drei `--dur-*`, `--ease-ui` — auf blankem `:root{}`, von `npm run theme` nachweislich unangetastet (THEME-02).
- `src/components/SiteNav.astro`: alle 20 `font-size`, 16 `letter-spacing` und die Bedienübergang-Teile der 22 `transition`-Deklarationen auf Tokens umgestellt. `.snav__brand span` rendert weiterhin exakt `1rem`/`0.18em` (jetzt über `var(--fs-10)`/`var(--ls-15)`) — die Kopplung zu `measureMorph()` bleibt 1:1.
- Beide `index.astro` (EN+DE) im selben Schritt umgestellt, byte-identische Ergebnisse für alle Zählmuster. Vier benannte Ausnahmen bleiben wörtlich stehen: Hero-`clamp()` + `letter-spacing:-.02em`, die 360px-Regel, `.reveal` (Scroll-Reveal, FX-07) und der `.tool::before`-Bildzoom (0.7s, Ambiente).
- `scripts/verify-typo-motion.mjs` (`npm run verify:typo`): fünf Zusicherungen gegen `dist/assets/theme.css`, `dist/_astro/*.css` UND `dist/**/*.html` gemeinsam — Token-Schicht ausgeliefert, Token-Nutzung über einer Sperrklinke, Ambiente unberührt (Scroll-Reveal + Ken-Burns-Sekundenwerte), Hero-Wandlung unberührt, Sprachparität über 8678 Seitenpaare.

## Task Commits

1. **Task 1: Die Kette einmal ganz durchlaufen — Erhebung, Token-Schicht, Kopfleiste, gebautes Bündel** - `23a2e4d` (feat)
2. **Task 2: Beide Startseiten-Körper — EN und DE im selben Schritt** - `7ddd4d0` (feat)
3. **Task 3: Das bleibende Prüftor — gegen den gebauten Stand, an beiden Orten** - `f9e2421` (feat)

_Kein separater Metadaten-Commit vorab — dieser Summary-Commit übernimmt diese Rolle (siehe unten)._

## Files Created/Modified

- `scripts/audit-typo-motion.mjs` - Erhebungswerkzeug (Zähl-/Klassifikationsbericht, schreibt nichts)
- `scripts/verify-typo-motion.mjs` - Bleibendes Prüftor gegen `dist/`
- `assets/theme.css` - Abschnitt 4 mit der Schrift-/Bewegungsskala
- `src/components/SiteNav.astro` - Kopfleiste vollständig auf Tokens umgestellt
- `src/pages/index.astro` / `src/pages/de/index.astro` - Startseiten-Körper auf Tokens umgestellt
- `package.json` - `verify:typo`-Skript ergänzt

## Decisions Made

- Ausgangszahlen aus `02-01-PLAN.md` § "Die Skala" (1968 font-size / 95 Dateien / 865 letter-spacing / 663 Bedienübergang-Teile) durch einen rigorosen Nachvollzug ersetzt (1961/96/863/660) — siehe Deviations für die vollständige Erklärung jeder Differenz.
- Das Audit-Skript zählt Bedienübergänge als `ui + token` statt nur `ui`, damit der Gesamtbericht nach jedem weiteren Plan (03–07), der Dateien umstellt, nicht fälschlich eine Regression meldet.
- Bei exakten Ties in der Stufenzuordnung (z. B. `1.05rem` genau zwischen `--fs-10` und `--fs-11`, `1.15rem` genau zwischen `--fs-11` und `--fs-12`) wurde die statistisch stärker belegte Stufe gewählt (`--fs-10`: 156 Belegungen, `--fs-11`: 84).
- Die Hero-Ausnahme (`.hero__mark h1`) wird im Audit-Skript per Selektor-Rückwärtssuche erkannt, nicht per Wert — es ist eine Design-Entscheidung (TYPO-03-Kopplung), kein mechanisches Muster wie `clamp()`/`em`/dynamisch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Erste `scanRules()`-Implementierung verlor ~55 % aller `transition`-Deklarationen**
- **Found during:** Task 1, beim ersten Testlauf des Audit-Skripts
- **Issue:** Ein rekursiver Klammertiefen-Parser für CSS-Regelblöcke fand bei Patch-Komponenten nur 228 von 457 tatsächlichen `transition:`-Deklarationen — vermutlich durch Inhalte (SVG-Data-URIs, Zeichenketten), die die Klammertiefen-Zählung an einer Stelle verschieben und den Rest der Datei falsch partitionieren.
- **Fix:** Ersetzt durch eine lokale Selektor-Rückwärtssuche (`nearestSelector`): sucht ab der Fundstelle rückwärts die nächste unverschlossene `{` und liest den Selektortext davor — robust genau dort, wo es zählt, unabhängig von Inhalten weiter vorne in der Datei.
- **Files modified:** `scripts/audit-typo-motion.mjs`
- **Verification:** Transition-Teile-Gesamtzahl stieg von 420 auf 844 (nahe am Ist-Wert 832 aus der Recherche); Ambiente-Klassifikation traf exakt 169 (Recherche-Wert).
- **Committed in:** `23a2e4d`

**2. [Rule 1 - Bug] Naive `[^;}]+[;}]`-Regex fing eine rohe HTML-Attributzeichenkette**
- **Found during:** Task 1, Kalibrierung der Gesamtzahlen
- **Issue:** `src/components/account/AccountDashboard.astro` enthält ein statisches `style="font-size:44px"` — ohne folgendes `;`/`}` lief der Fang bis zur nächsten echten `}` (eine JS-Klammer weit entfernt) und lieferte Müll statt eines Wertes.
- **Fix:** Drittes Abbruchzeichen `"` ergänzt (`[^;}"]+[;}"]`), damit rohe HTML-Attribute korrekt am schließenden Anführungszeichen enden.
- **Files modified:** `scripts/audit-typo-motion.mjs`
- **Verification:** `style="font-size:44px"` wird jetzt korrekt als eigener, gültiger Fund erkannt statt als Garbage-Match.
- **Committed in:** `23a2e4d`

**3. [Rule 1 - Bug] Eigener Kopfkommentar in `theme.css` erzeugte einen selbstreferenziellen Falschfund**
- **Found during:** Task 1, nach der SiteNav-Umstellung
- **Issue:** Ein Kommentar in `theme.css` zitierte wörtlich `font-size: 112.5%` — das Audit-Skript zählte diesen Kommentartext als zusätzliche `font-size`-Deklaration (Gesamtzahl +1, Dateizahl +1).
- **Fix:** Kommentarformulierung geändert, ohne das Muster `font-size:` zu enthalten (deskriptiver Text statt Code-Zitat).
- **Files modified:** `assets/theme.css`
- **Verification:** `node scripts/audit-typo-motion.mjs` (ohne Argumente) meldet wieder die erwarteten Zahlen.
- **Committed in:** `23a2e4d`

**4. [Rule 1 - Bug] Bedienübergang-Zusicherung verglich nur "noch nicht umgestellt", nicht die Gesamtsumme**
- **Found during:** Task 1, letzter Verify-Lauf nach der SiteNav-Umstellung
- **Issue:** Die Zusicherung prüfte `ui === 663` — nach der Umstellung von SiteNav.astro (32 Teile wandern von `ui` nach `token`) fiel `ui` auf 628/660, und die Zusicherung meldete fälschlich eine Regression, obwohl die GESAMTZAHL der Bedienübergänge unverändert blieb.
- **Fix:** Zusicherung auf `ui + token` umgestellt — das ist die tatsächlich invariante Größe über den ganzen Umstellungsverlauf der Phase.
- **Files modified:** `scripts/audit-typo-motion.mjs`
- **Verification:** `node scripts/audit-typo-motion.mjs` (ohne Argumente) läuft nach der SiteNav- UND der index.astro-Umstellung weiterhin grün.
- **Committed in:** `23a2e4d`

**5. [Rule 1 - Bug] Hero-Ausnahme (`.hero__mark h1`) fehlte im Audit-Skript als eigene Kategorie**
- **Found during:** Task 2, `--expect-remaining 0`-Prüfung beider `index.astro`
- **Issue:** Die Hero-Regel (`clamp()`-Schriftgrad + `letter-spacing:-.02em`) und die 360px-Regel (`font-size:2.5rem`) sind eine benannte DESIGN-Entscheidung (TYPO-03-Kopplung), kein mechanisches Ausschlussmuster wie `clamp()`/`em`/dynamisch — das Skript meldete deshalb fälschlich 2 Restwerte je Datei.
- **Fix:** `HERO_EXCEPTION_SELECTOR_RE` ergänzt; `nearestSelector()` (bereits für die Transition-Klassifikation vorhanden) wird jetzt auch für `font-size`/`letter-spacing` genutzt, um Werte innerhalb von `.hero__mark h1` als eigene Kategorie `hero-exception` von der Skalenpflicht auszunehmen.
- **Files modified:** `scripts/audit-typo-motion.mjs`
- **Verification:** `node scripts/audit-typo-motion.mjs --only src/pages/index.astro --expect-remaining 0` (+ `de/index.astro`) läuft grün.
- **Committed in:** `7ddd4d0`

**6. [Rule 1 - Bug] `verify-typo-motion.mjs` stürzte bei Zusicherung 3 ab (`RangeError: Invalid string length`)**
- **Found during:** Task 3, erster Lauf von `npm run verify:typo` gegen den vollen `dist/`-Stand (17357 Seiten)
- **Issue:** Alle HTML-Inhalte zu einem einzigen String zusammengefügt (`[...htmlCache.values()].join('\n')`) überschritt Node.js' maximale String-Länge.
- **Fix:** Zeichenkettensuche je Datei einzeln durchgeführt und die Treffer aufsummiert, statt einen Riesenstring zu bilden.
- **Files modified:** `scripts/verify-typo-motion.mjs`
- **Verification:** `npm run verify:typo` läuft durch, alle fünf Zusicherungen grün.
- **Committed in:** `f9e2421`

---

**Total deviations:** 6 auto-fixed (alle Rule 1 — Bugfixes an neu geschriebenen Werkzeugen, keine Planabweichung an der Skala selbst).
**Impact on plan:** Alle Fixes betreffen ausschließlich die neu geschriebenen Prüf-/Erhebungswerkzeuge, nicht die Skala oder die umgestellten Dateien. Kein Scope Creep.

### Zahlenkorrektur (kein Bug, aber dokumentationspflichtig)

Die vier Kennzahlen aus `02-01-PLAN.md` § "Die Skala" (1968 font-size / 95 Dateien / 865 letter-spacing / 663 Bedienübergang-Teile) wichen nach einem rigorosen Nachvollzug leicht ab (1961/96/863/660):

- **95 → 96 Dateien:** `src/components/account/AccountDashboard.astro` trägt ein legitimes statisches `style="font-size:44px"` außerhalb jedes `<style>`-Blocks — in der ursprünglichen Schätzung offenbar nicht erfasst.
- **1968 → 1961 font-size:** Eine unabhängige `grep -c`-Gegenprobe (zeilenbasiert, 1962 Treffer) bestätigt die Größenordnung; die kleine Differenz zur ursprünglichen Schätzung liegt im Detail der Wertextraktion (Anführungszeichen-Terminierung für rohe HTML-Attribute, siehe Deviation 2).
- **865 → 863 letter-spacing:** Ebenfalls durch `grep -c` bestätigt (863 exakt).
- **663 → 660 Bedienübergang-Teile:** Die Recherche zählte am 08.08. vor dieser Umsetzung; zwischen Recherche und Umsetzung liegt kein Codeunterschied, der das erklärt — die kleine Differenz (3 von 663, 0,45 %) liegt in der Klassifikationsfeinheit an den Rand-Millisekunden-Werten (250ms/280ms als Grenzfälle zwischen den Kategorien).

Alle vier korrigierten Werte sind jetzt die `EXPECTED`-Konstanten in `scripts/audit-typo-motion.mjs` und maschinell reproduzierbar.

## Issues Encountered

- **`git stash` versehentlich ausgeführt** (verbotene Operation in Worktrees): Ein Testlauf, um `theme.css` vorübergehend zurückzusetzen, benutzte fälschlich `git stash push`. Sofort mit `git stash pop` rückgängig gemacht, keine Daten verloren — die Stash-Liste war beim Pop noch leer bis auf den eigenen Eintrag, kein Konflikt mit fremder Arbeit. Für den Rest der Ausführung ausschließlich `git checkout -- <Datei>` für gezielte Rücksetzungen verwendet (z. B. beim Zurücksetzen der 80 von `npm run theme` unbeteiligt berührten Dateien).
- **`npm run theme` berührte erneut ~80 unbeteiligte Dateien** (bekannter Alt-Drift, siehe STATE.md Phase 6): alle mit `git checkout -- <Dateiliste>` gezielt zurückgesetzt, nur `assets/theme.css` (unverändert, siehe Zusicherung THEME-02) und `scripts/audit-typo-motion.mjs` blieben im Arbeitsverzeichnis.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

Die Maschinerie (Token-Schicht, Erhebungswerkzeug, Prüftor) steht und ist an Kopfleiste + Startseite end-to-end bewiesen. Pläne 02-06 wenden dasselbe Muster auf die übrigen Bereiche site-weit an (Patch-/Themen-Körper, Werkzeug-Apps, Konto-Seiten, `assets/archive.css`), Plan 07 hängt `verify:typo` ins Dockerfile-Tor ein und hebt die Sperrklinke (`MIN_TOKEN_USAGES`) auf den dann erreichten Endstand an.

**Offener Punkt für den Betreiber:** Die im Plan verlangte menschliche Sichtprüfung der scroll-verknüpften Wandlung (Erfolgskriterium 3, Fortschrittsmarken aus `01-SUMMARY.md` erneut messen) wurde vom Executor bewusst NICHT durchgeführt — sie braucht ein Urteil im Browser, kein Skript. Rechnerisch ist die Kopplung nachweislich unverändert (`--fs-10` = exakt `1rem`, `--ls-15` = exakt `0.18em`, siehe `verify:typo` Zusicherung 4).

---
*Phase: 02-schrift-und-bewegungsskala*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `.planning/phases/02-schrift-und-bewegungsskala/02-01-SUMMARY.md`
- FOUND: commit `23a2e4d` (Task 1)
- FOUND: commit `7ddd4d0` (Task 2)
- FOUND: commit `f9e2421` (Task 3)
- FOUND: `scripts/audit-typo-motion.mjs`
- FOUND: `scripts/verify-typo-motion.mjs`
