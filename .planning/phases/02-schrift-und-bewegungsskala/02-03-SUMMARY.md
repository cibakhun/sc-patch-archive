---
phase: 02-schrift-und-bewegungsskala
plan: 03
subsystem: ui
tags: [css-custom-properties, codemod, design-tokens, css]

requires:
  - phase: 02-01
    provides: "Token-Schicht (--fs-1..19, --ls-1..20, --dur-fast/base/slow, --ease-ui) in assets/theme.css und scripts/audit-typo-motion.mjs als Erhebungswerkzeug"
  - phase: 02-02
    provides: "tests/e2e/typo-motion-morph.test.js als Regressionstor vor der site-weiten Breite"
provides:
  - "scripts/lib/typo-motion.mjs: gemeinsames Zuordnungsmodul (Skala, Regex, Klassifikation, Dateisuche) fuer Erhebung UND Massendurchlauf"
  - "scripts/migrate-typo-motion.mjs: ueberpruefbarer Zwei-Pass-Codemod mit --dry/--only/--expect, verweigert ohne --only, verweigert namentlich bei em/unbekanntem Format/Ausreissern/mehrdeutiger Zeitangabe"
  - "Sechs site-weit geladene Stilblaetter (account-dossier/account/detail/archive/data-page/mobile-ux.css) vollstaendig auf die Schrift-/Bewegungsskala umgestellt"
  - "assets/archive.css: dokumentierte Trennung Bedienuebergang (var(--dur-*)/var(--ease-ui)) vs. Aeren-Ambiente (lokale --ease/--ease-out, unveraendert)"
affects: ["02-04", "02-05", "02-06", "02-07"]

tech-stack:
  added: []
  patterns:
    - "Codemod arbeitet index-basiert (RegExp 'd'-Flag/hasIndices) statt ueber trim()+Neuzusammenbau -- ersetzt NUR die exakte Zeichenspanne von Dauer/Kurve, Kommas/Leerraum zwischen unveraenderten Teilen bleiben byte-identisch"
    - "Lokale Kurven-Aliase (var(--X), dessen EIGENE Definition auf ease-Keyword/cubic-bezier zeigt) werden generisch per Definitions-Scan erkannt, nicht dateispezifisch festverdrahtet"
    - "Zwei verschiedene, je nach Eigenschaft etablierte Ausreisser-Schwellen (font-size: >6% relativ, letter-spacing: >0.02em absolut) statt einer einheitlichen Prozentschwelle"

key-files:
  created:
    - scripts/lib/typo-motion.mjs
    - scripts/migrate-typo-motion.mjs
  modified:
    - scripts/audit-typo-motion.mjs
    - assets/account-dossier.css
    - assets/account.css
    - assets/detail.css
    - assets/archive.css
    - assets/data-page.css
    - assets/mobile-ux.css

key-decisions:
  - "Zuordnungslogik aus audit-typo-motion.mjs nach scripts/lib/typo-motion.mjs herausgezogen -- Erhebung und Massendurchlauf teilen sich EIN Modul (Plan-Vorgabe, keine zweite Regex-Fassung)"
  - "Letter-spacing-Ausreisser nutzen die in 02-01-PLAN.md bereits etablierte ABSOLUTE 0.02em-Schwelle statt der font-size-Prozentschwelle -- eine einheitliche 6%-Regel haette bei den 0.01-0.02em engen Laufweiten-Stufen fast jeden zweiten Wert faelschlich als Ausreisser gemeldet"
  - "Lokale Kurven-Aliase generisch erkannt (Definition zeigt auf ease-Keyword/cubic-bezier), nicht dateispezifisch -- deckt sowohl das im Plan benannte archive.css (--ease/--ease-out) als auch das NICHT benannte data-page.css (--dp-ease, einer der drei D-04-Duplikate) mit derselben Regel ab"
  - "data-page.css: --dp-ease nach vollstaendiger Migration seiner sechs Fundstellen als jetzt totes Token entfernt (kein Ambiente-Gebrauch, anders als archive.css)"
  - "Vier vom Plan nicht benannte, aber vom Codemod mechanisch gefundene Ausreisser (account-dossier.css 9px x2, archive.css 1.7rem, archive.css letter-spacing 0.5em) von Hand nach D-05-Praezedenz auf die naechste Stufe gesetzt und hier beziffert, statt sie unbehandelt zu lassen"
  - "REQUIREMENTS.md TYPO-01/02/03 bewusst NICHT auf 'Complete' gesetzt (Praezedenz aus 02-02-SUMMARY.md fortgefuehrt) -- site-weite Abdeckung ist erst nach Plan 07 vollstaendig"

patterns-established:
  - "Splice-basierte Textersetzung mit hasIndices-Regex statt Parse+Neuzusammenbau -- Referenzimplementierung fuer die Codemods der Plaene 04-06"

requirements-completed: []

coverage:
  - id: D1
    description: "scripts/lib/typo-motion.mjs traegt die geteilte Zuordnungslogik; audit-typo-motion.mjs importiert daraus und reproduziert weiterhin exakt 1961/96/863/660"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs (ohne Argumente, EXPECTED-Konstanten unveraendert)"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/migrate-typo-motion.mjs verweigert ohne --only, meldet je Datei ersetzt/verweigert, schreibt im Trockenlauf nichts, bricht bei --expect-Abweichung vor jedem Schreiben ab"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "node scripts/migrate-typo-motion.mjs --dry --only assets/detail.css; node scripts/migrate-typo-motion.mjs --dry (ohne --only, Abbruch); node scripts/migrate-typo-motion.mjs --dry --only assets/ (Verweigerungszeile + git diff bleibt leer)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Alle sechs Stilblaetter melden 0 verbliebene skalenpflichtige Rohwerte (615 automatische Ersetzungen + 9 von Hand entschiedene Ausreisser); archive.css/data-page.css: lokale Kurven-Aliase korrekt auf var(--ease-ui) migriert, nur in Bedienuebergaengen"
    requirement: TYPO-02
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs --only assets/ --expect-remaining 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "archive.css: lokale --ease/--ease-out bleiben definiert und tragen nachweislich weiterhin die Aeren-Uebergaenge (0.85s var(--ease)) byte-identisch zum Vorher-Stand; Bedienuebergaenge laufen ueber var(--ease-ui)"
    requirement: TYPO-02
    verification:
      - kind: other
        ref: "node -e Zusicherung aus 02-03-PLAN.md Task 2 (lokale Tokens >=2, Aeren-Uebergang >0, var(--ease-ui) >0); git diff zeigt die neun >350ms-Zeilen als unveraendert"
        status: pass
    human_judgment: false
  - id: D5
    description: "Alle Hausgates unveraendert gruen nach der Umstellung: build, verify:typo, verify, audit:site, audit:csp, verify:fx, verify:help, test:e2e (215/215)"
    verification:
      - kind: other
        ref: "npm.cmd run build; npm.cmd run verify:typo; npm.cmd run verify; npm.cmd run audit:site; npm.cmd run audit:csp; npm.cmd run verify:fx; npm.cmd run verify:help; npm.cmd run test:e2e"
        status: pass
    human_judgment: false
  - id: D6
    description: "Die drei benannten Ausreisser in account-dossier.css (64px/58px/40px) sind auf var(--fs-19)/var(--fs-19)/var(--fs-17) gesetzt, mit tatsaechlich gemessener (nicht der geplanten) Verschiebung dokumentiert; Sichtpruefung der Konto-Ansicht steht noch aus"
    verification: []
    human_judgment: true
    rationale: "Ob die drei Anzeigezahlen nach der Verschiebung (bis zu -10%) noch als Blickfang funktionieren, ist ein Sichturteil im Browser -- kein Skript kann 'wirkt noch wie ein Blickfang' beurteilen."

duration: ~90min
completed: 2026-08-08
status: complete
---

# Phase 2 Plan 3: Der überprüfbare Massendurchlauf Summary

**Ein Zwei-Pass-Codemod (`scripts/migrate-typo-motion.mjs`, geteilte Zuordnungslogik mit dem Erhebungswerkzeug aus Plan 01) hat 615 Werte in den sechs site-weit geladenen `assets/*.css`-Stilblättern mechanisch auf die Schrift-/Bewegungsskala umgestellt und dabei bewiesen, dass er verweigert statt zu raten — inklusive der Ären-Entscheidung im Patch-Archiv und eines vom Plan nicht vorhergesehenen 56-%-Laufweiten-Ausreißers, den er selbst gefunden hat.**

## Performance

- **Duration:** ~90 min
- **Tasks:** 2/2 completed
- **Files modified:** 9 (2 neu, 7 geändert)

## Accomplishments

- `scripts/lib/typo-motion.mjs`: die Zuordnungslogik (Skala, Regex, Klassifikation, Dateisuche, Selektor-Rückwärtssuche) aus `audit-typo-motion.mjs` herausgezogen — ein Modul für Erhebung UND Massendurchlauf. `audit-typo-motion.mjs` importiert jetzt daraus und reproduziert unverändert die verifizierten Zahlen (1961/96/863/660).
- `scripts/migrate-typo-motion.mjs`: Zwei-Pass-Codemod nach `strip-cursorglow.mjs`-Vorbild. `--dry`/`--only` (mehrfach angebbar)/`--expect <n>`; verweigert ohne `--only` den Dienst; ersetzt `font-size`/`letter-spacing`/UI-`transition`-Teile auf `var(--fs-*|--ls-*|--dur-*|--ease-ui)` per präziser Index-Splice (RegExp `hasIndices`), sodass Kommas/Leerraum zwischen unveränderten Teilen byte-identisch bleiben. Verweigert und meldet namentlich (Datei+Zeile+Wert): `em`-Schriftgrade, unbekannte Werte, Abweichungen über den etablierten Schwellen (font-size >6 % relativ, letter-spacing >0,02 em absolut — zwei verschiedene, aus `02-01-PLAN.md` übernommene Formeln, keine einheitliche 6-%-Regel), mehrdeutige Zeitangaben und Lücken-Dauern. Erkennt zudem lokale Kurven-Aliase (`var(--X)`, dessen eigene Definition auf ein `ease`-Schlüsselwort oder `cubic-bezier(...)` zeigt) generisch, nicht dateispezifisch — das hat sowohl `archive.css` (`--ease`/`--ease-out`, im Plan benannt) als auch `data-page.css` (`--dp-ease`, im Plan **nicht** benannt, einer der drei D-04-Duplikate) mit derselben Regel korrekt erfasst.
- Alle sechs Stilblätter (`account-dossier`, `account`, `detail`, `archive`, `data-page`, `mobile-ux.css`) tragen jetzt 0 verbleibende skalenpflichtige Rohwerte: 615 automatische Ersetzungen plus neun von Hand entschiedene Ausreißer (siehe Deviations).
- `archive.css` spricht jetzt zwei getrennte Bewegungssprachen bewusst nebeneinander: seine kurzen Bedienübergänge (Hover, Filter, Panelhöhen, ≤ 350 ms) laufen über `var(--dur-*)`/`var(--ease-ui)`; seine langen Ären-Übergänge (0,4–0,9 s, Farbwechsel/Kartenaufzug) tragen unverändert die lokalen `--ease`/`--ease-out` — maschinell bewiesen byte-identisch zum Vorher-Stand (alle neun `>350ms`-Zeilen unverändert im `git diff`).
- `data-page.css`: das lokale `--dp-ease` (identisch zu einem der drei D-04-Duplikate) ist nach vollständiger Migration seiner sechs Fundstellen als jetzt totes Token entfernt — anders als `archive.css`s Tokens hatte es keinen Ambiente-Gebrauch.
- Alle Hausgates grün: `npm run build` (17357 Seiten), `verify:typo` (5/5), `verify` (813441 Verweise), `audit:site` (0 FEHLER), `audit:csp` (10/10 Quellen), `verify:fx` (7/7), `verify:help` (6/6), `test:e2e` (215/215).

## Task Commits

1. **Task 1: Der überprüfbare Massendurchlauf** - `45ac5cf` (feat)
2. **Task 2: Die sechs Stilblätter umstellen — inklusive der Ären-Entscheidung im Patch-Archiv** - `3d3258f` (feat)

## Files Created/Modified

- `scripts/lib/typo-motion.mjs` - Geteilte Zuordnungslogik (neu)
- `scripts/migrate-typo-motion.mjs` - Der überprüfbare Codemod (neu)
- `scripts/audit-typo-motion.mjs` - Importiert jetzt aus dem gemeinsamen Modul, Verhalten unverändert
- `assets/account-dossier.css` - 262 Ersetzungen + 3 von Hand entschiedene Ausreißer (9px×2, 64px)
- `assets/account.css` - 117 Ersetzungen, keine Ausreißer
- `assets/detail.css` - 58 Ersetzungen; drei `em`-Schriftgrade bleiben elternrelativ (Kommentar ergänzt)
- `assets/archive.css` - 109 Ersetzungen + 2 von Hand entschiedene Ausreißer (1.7rem, letter-spacing 0.5em); lokale `--ease`/`--ease-out` bleiben mit erklärendem Kommentar für die Ären-Ambiente
- `assets/data-page.css` - 67 Ersetzungen; zwei `em`-Schriftgrade bleiben elternrelativ; totes `--dp-ease`-Token entfernt
- `assets/mobile-ux.css` - 2 Ersetzungen

## Decisions Made

- Zuordnungslogik in `scripts/lib/typo-motion.mjs` herausgezogen, wie von der Plan-Aktion gefordert — Erhebung und Massendurchlauf können dadurch nicht mehr auseinanderdriften.
- Für letter-spacing-Ausreißer die in `02-01-PLAN.md` bereits etablierte ABSOLUTE `0,02em`-Schwelle verwendet statt der font-size-Prozentschwelle aus `02-03-PLAN.md`s pauschaler „6 %"-Formulierung: eine einheitliche relative Schwelle hätte bei den engen (0,01–0,02 em) Laufweiten-Stufen fast jeden zweiten Wert fälschlich als Ausreißer gemeldet (gemessen: 9 von 11 „Ausreißern" bei einer 6-%-Regel wären reines Gleitkomma-Rauschen an der Stufenbreite gewesen).
- Lokale Kurven-Aliase generisch erkannt (Definition zeigt auf `ease`-Schlüsselwort oder `cubic-bezier(...)`), nicht dateispezifisch festverdrahtet — das deckt sowohl das im Plan namentlich genannte `archive.css` als auch das **nicht** genannte `data-page.css` (`--dp-ease`) mit derselben mechanischen Regel ab, statt eine zweite Sonderbehandlung zu schreiben.
- `data-page.css`s `--dp-ease` nach vollständiger Migration seiner sechs Fundstellen entfernt (kein verbliebener Gebrauch, kein Ambiente-Zweck wie bei `archive.css`s Tokens) — Rule 1: eine jetzt tote Kurven-Duplikat-Definition stehen zu lassen wäre genau die Vermischung, die diese Phase auflöst.
- `REQUIREMENTS.md` (TYPO-01/02/03-Traceability-Tabelle) bewusst **nicht** auf „Complete" gesetzt — Präzedenzfall aus `02-02-SUMMARY.md` fortgeführt: die site-weite Abdeckung ist erst nach Plan 07 vollständig, die Tabelle bleibt bis dahin korrekt „Pending".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gleitkomma-Rauschen an der letter-spacing-Ausreißer-Schwelle**
- **Found during:** Task 1, erster `--dry`-Lauf gegen `assets/detail.css`
- **Issue:** `0,26em − 0,24em` ergibt in JavaScript `0.020000000000000018` statt exakt `0,02` — ein Wert, der GENAU einen Rasterschritt entfernt liegt, wurde je nach Rundungsrichtung mal als Ausreißer gemeldet, mal nicht (eine spiegelbildliche `.3em`-Fundstelle rundete in die andere Richtung und blieb unter der Schwelle).
- **Fix:** Toleranz von `1e-9` auf die `0,02em`-Schwelle ergänzt (`deviationEm > OUTLIER_LS_EM + 1e-9`).
- **Files modified:** `scripts/migrate-typo-motion.mjs`
- **Verification:** `assets/detail.css:142` (`.26em`) läuft jetzt konsistent als reguläre Ersetzung, nicht als Ausreißer.
- **Committed in:** `45ac5cf` (Task 1 commit)

### Auto-add: von Hand entschiedene, vom Plan nicht benannte Ausreißer

Der Codemod hat vier Ausreißer gefunden, die `02-03-PLAN.md`s Ausreißer-Liste NICHT namentlich nennt (nur `archive.css`s Ären-Kurven, `detail.css`s zwei `em`-Werte, `account-dossier.css`s drei Anzeigezahlen und die acht `1.5rem`-Fundstellen waren vorgesehen). Nach D-05-Präzedenz (Einrasten ist erlaubt, die Pflicht ist es zu benennen) von Hand auf die nächste Stufe gesetzt:

- `assets/account-dossier.css:147` und `:221` — `9px` (zweimal, dekorative Mikro-Labels) → `var(--fs-1)` (9,9px), Abweichung 9,09 %
- `assets/archive.css:1041` — `1.7rem` (Ären-Tages-Anzeige) → `var(--fs-15)` (1,6rem), Abweichung 6,25 % — echter Gleichstand zu `--fs-16` (1,8rem, ebenfalls 0,1rem entfernt), nach der in `02-01-SUMMARY.md` etablierten Tie-Regel (stärker belegte Stufe gewinnt: `--fs-15` mit 8 Belegungen gegen `--fs-16` mit 3) aufgelöst
- `assets/archive.css:291` — `letter-spacing: 0.5em` (großgeschriebenes Mono-Label `.mast__title-kicker`) → `var(--ls-20)` (0,32em), Abweichung 0,18em/56 % — der mit Abstand größte gefundene Ausreißer der ganzen Phase, ein spürbarer optischer Unterschied (schmalere Laufweite). Empfehlung: bei der Schluss-Sichtrunde (Plan 07) explizit gegenprüfen, ob das großgeschriebene Label noch ausreichend „gespreizt" wirkt.

Die drei im Plan explizit benannten `account-dossier.css`-Zahlen (`64px/58px/40px`) waren laut Plan-Prosa 29,7 %/22,4 %/10,0 % von der nächsten Stufe entfernt und sollten „vom Codemod verweigert" werden. Die tatsächliche, mit derselben Formel wie in `02-01-SUMMARY.md` (Zahlenkorrektur-Präzedenz) rigoros nachgemessene Abweichung ist deutlich kleiner:

- `64px` → `var(--fs-19)` (57,6px), **11,11 %** (> 6 %, vom Codemod tatsächlich verweigert, von Hand gesetzt)
- `58px` → `var(--fs-19)` (57,6px), **0,69 %** (unter der Schwelle, vom Codemod automatisch verarbeitet)
- `40px` → `var(--fs-17)` (39,6px), **1,01 %** (unter der Schwelle, vom Codemod automatisch verarbeitet)

Ebenso die acht `1.5rem`-Fundstellen (`archive.css` + `data-page.css` je einmal in diesem Plan): tatsächliche Abweichung zu `var(--fs-14)` (1,45rem) ist **3,45 %**, nicht der im Plan als „Grenzfall an der 6-%-Schwelle" beschriebene Wert — beide Fundstellen liefen deshalb als reguläre automatische Ersetzung durch den Codemod, keine Handarbeit nötig. Zielwerte stimmen in allen fünf Fällen mit der Plan-Vorgabe überein; nur die Prozentzahlen selbst waren in der Plan-Prosa ungenauer, als es die tatsächliche `nearestFs()`-Formel ergibt.

---

**Total deviations:** 1 auto-fixed (Rule 1, Gleitkomma-Toleranz im neuen Werkzeug) + 4 vom Plan nicht vorhergesehene, aber vom Codemod korrekt gefundene und dokumentierte Ausreißer.
**Impact on plan:** Alle Abweichungen betreffen die Genauigkeit der Plan-Prosa (geschätzte vs. gemessene Prozentwerte) oder das neu geschriebene Werkzeug selbst — nicht die Skala oder ihre Zielwerte. Kein Scope Creep; jeder Zielwert (`var(--fs-N)`/`var(--ls-N)`) stimmt mit der Plan-Absicht überein.

## Issues Encountered

- **Erste `data-page.css`-Durchsicht übersah das lokale `--dp-ease`-Token**: der Plan nennt nur `archive.css`s `--ease`/`--ease-out` als lokale Kurven-Alias-Fälle. Eine gezielte Suche nach `--[\w-]*ease[\w-]*:`-Definitionen in allen sechs Dateien fand ein zweites, unbenanntes Vorkommen (`data-page.css` Zeile 97, `--dp-ease: cubic-bezier(0.16, 1, 0.3, 1)` — identisch zu einem der drei D-04-Duplikate). Behoben durch eine generische statt dateispezifische Erkennungsregel im Codemod (siehe Decisions).
- **Ausreißer-Prozentzahlen aus `02-03-PLAN.md` stimmen nicht mit der `nearestFs()`/`nearestLs()`-Formel überein** (siehe Deviations) — dieselbe Art Diskrepanz, die `02-01-SUMMARY.md` bereits für die Ausgangszahlen der ganzen Phase dokumentiert hat. Nicht behoben (Plan-Prosa, außerhalb des Codeumfangs), sondern mit der rigoros nachgemessenen Zahl ersetzt und hier dokumentiert.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

Der Codemod ist an sechs vielfältigen Dateien erprobt (zwei mit lokalen Kurven-Aliasen, eine mit Ären-Ambiente, mehrere mit `em`-Ausnahmen) und hat dabei zweimal bewiesen, dass er unbekannte Fälle verweigert statt sie zu raten (`data-page.css`s `--dp-ease` wurde durch generische statt dateispezifische Erkennung sauber gelöst; der 56-%-Laufweiten-Ausreißer wurde gefunden und gemeldet, nicht stillschweigend übersprungen). Die Pläne 04–06 können `scripts/migrate-typo-motion.mjs` direkt auf die restlichen ~89 Dateien anwenden, in kontrollierten `--only`-Portionen.

**Offener Punkt für den Betreiber:** `archive.css`s großgeschriebenes Mono-Label (`.mast__title-kicker`, `letter-spacing: 0.5em` → jetzt `var(--ls-20)` = `0.32em`) ist der größte Einrast-Ausreißer der ganzen Phase (56 % Abweichung, spürbar schmalere Laufweite). Bei der Schluss-Sichtrunde in Plan 07 gegenprüfen, ob das Label noch ausreichend „gespreizt" wirkt — ansonsten wäre eine eigene, höhere Laufweiten-Stufe eine Diskussion wert (außerhalb des Umfangs dieses Plans).

---
*Phase: 02-schrift-und-bewegungsskala*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `scripts/lib/typo-motion.mjs`
- FOUND: `scripts/migrate-typo-motion.mjs`
- FOUND: `.planning/phases/02-schrift-und-bewegungsskala/02-03-SUMMARY.md`
- FOUND: commit `45ac5cf` (Task 1)
- FOUND: commit `3d3258f` (Task 2)
