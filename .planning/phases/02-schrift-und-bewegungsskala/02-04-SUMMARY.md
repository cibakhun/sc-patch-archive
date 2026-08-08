---
phase: 02-schrift-und-bewegungsskala
plan: 04
subsystem: ui
tags: [css-custom-properties, codemod, design-tokens, css, astro]

requires:
  - phase: 02-03
    provides: "scripts/migrate-typo-motion.mjs (ueberpruefbarer Zwei-Pass-Codemod mit --dry/--only/--expect), scripts/lib/typo-motion.mjs (geteilte Zuordnungslogik), erprobt an sechs assets/*.css-Stilblaettern"
provides:
  - "27 Werkzeug-/Bauteil-Koerper (6 grosse + 21 kleinere, davon 2 unter dossier/) + src/layouts/Layout.astro vollstaendig auf die Schrift-/Bewegungsskala umgestellt (889 automatische Ersetzungen + 13 von Hand entschiedene Ausreisser/Sonderfaelle)"
  - "Die vier bislang von keiner Erhebung erfassten Laufzeitwerte in assets/tool-help.js (2x font-size + 1 zusaetzliche letter-spacing) und assets/crafting-app.js (1x font-size) lesen jetzt aus der Skala; assets/hero-video.js bewusst NICHT migriert (Ambient-Loop, 1400ms weit ueber der 350ms-Bedienuebergang-Schwelle)"
  - "scripts/audit-typo-motion.mjs: --only akzeptiert jetzt mehrere Werte (collectFlagValues, wie migrate-typo-motion.mjs) statt nur den ersten -- notwendig, damit die im Plan selbst vorgegebenen Mehrfach---only-Verify-Befehle ueberhaupt etwas pruefen"
affects: ["02-05", "02-06", "02-07"]

tech-stack:
  added: []
  patterns:
    - "Ambient-Transitions (>350ms) bleiben unangetastet, AUCH wenn sie per JavaScript in eine Stilzeichenkette gesetzt werden (assets/hero-video.js) -- die D-03-Grenze gilt unabhaengig davon, ob der Wert in .astro/.css oder .js steht"
    - "Gekoppelte, nicht-audit-pflichtige Werte (text-indent neben letter-spacing, wenn ein Quellkommentar die Kopplung explizit macht) werden im selben Schritt mitgezogen, damit ein Einrasten der Skala keine zweite, unsynchronisierte Fundstelle hinterlaesst"
    - "Bei transition-Teilen mit ZWEI Zeitangaben (Dauer+Verzoegerung) wird NUR die Dauer auf var(--dur-*) gesetzt; die Verzoegerung bleibt immer woertlich stehen -- D-01..07 definieren ausschliesslich Dauer+Kurve fuer Bedienuebergaenge, keinen Verzoegerungs-Wert"

key-files:
  created: []
  modified:
    - src/components/ShipDetail.astro
    - src/components/CraftingApp.astro
    - src/components/PrecisionJumpApp.astro
    - src/components/MiningApp.astro
    - src/components/ItemFinderApp.astro
    - src/components/MissionDetail.astro
    - src/components/SupportBody.astro
    - src/components/SignatureIdentifier.astro
    - src/components/RefineryFinder.astro
    - src/components/MissionsApp.astro
    - src/components/FracturingCalc.astro
    - src/components/SearchOverlay.astro
    - src/components/FeedbackForm.astro
    - src/components/ItemFinderPage.astro
    - src/components/ArmorSets.astro
    - src/components/TopicFacts.astro
    - src/components/WikeloBridge.astro
    - src/components/Attribution.astro
    - src/components/OnepagerLink.astro
    - src/components/RelatedTopics.astro
    - src/components/ToolHelp.astro
    - src/components/HomeLaunchpad.astro
    - src/components/FxToggle.astro
    - src/components/LangSwitcher.astro
    - src/components/ThemeToggle.astro
    - src/components/dossier/PatchDossier.astro
    - src/components/dossier/QuickFacts.astro
    - src/layouts/Layout.astro
    - assets/tool-help.js
    - assets/crafting-app.js
    - scripts/audit-typo-motion.mjs

key-decisions:
  - "audit-typo-motion.mjs auf mehrwertiges --only umgestellt (Rule 3, blockierender Werkzeugfehler): das Skript unterstuetzte bislang nur EINEN --only-Wert (indexOf statt Sammeln), obwohl sowohl dieser Plan als auch 02-05/06 ihre eigenen <verify>-Befehle mit mehreren --only-Praefixen in einem Aufruf formulieren. Ohne die Aenderung haette jeder solche Verify-Befehl still nur die ERSTE Datei geprueft"
  - "Die <verify>-Vorgabe 'audit-typo-motion.mjs --only src/components/ --only src/layouts/' wurde NICHT woertlich als Verzeichnis-Praefix ausgefuehrt, sondern als die EXAKTE Dateiliste dieses Plans (28 Astro-Dateien per Einzelpfad). Woertlich ausgefuehrt haette der Befehl faelschlich auch die noch nicht umgestellten Verzeichnisse patches/topics/account/ships (Eigentum der Plaene 05/06) erfasst und waere zwangslaeufig mit Restwerten > 0 gescheitert -- ein Scope-Verstoss waere die einzige Art gewesen, den Befehl woertlich gruen zu bekommen"
  - "ShipDetail.astro: zwei 1.7rem-Fundstellen (.holo__title h1, .sd__cargonum) auf var(--fs-15) gerastet, 6,25 % Abweichung -- identischer Zielwert und identische Abweichung wie archive.css:1041 in 02-03-SUMMARY.md, direkte Praezedenz fuer denselben Wert"
  - "ItemFinderApp.astro: fuenf letter-spacing-Werte in px (vom Codemod als 'unbekanntes Wertformat' verweigert, da die Laufweiten-Skala nur em kennt) von Hand in em relativ zum LOKALEN font-size-Token derselben Regel umgerechnet, dann auf die naechste --ls-N-Stufe gerastet (alle fuenf Abweichungen < 1 % relativ zur Elementschriftgroesse, weit unter der 0,02em-Schwelle)"
  - "ItemFinderPage.astro: letter-spacing:.44em (grossgeschriebene 'Star Citizen'-Randbeschriftung) auf var(--ls-20) gerastet, 0,12em/27 % Abweichung -- der zweitgroesste Einrast-Ausreisser der Phase nach archive.css's .mast__title-kicker (56 %, 02-03). Das laut Quellkommentar gekoppelte text-indent:.44em (gleicht die Sperrung beim Zentrieren exakt aus) im selben Schritt auf var(--ls-20) mitgezogen -- sonst waere die Zentrierung nach dem Einrasten der Laufweite sichtbar verschoben"
  - "FxToggle.astro: vier 'visibility 0s [linear] Xs'-Transition-Teile (Tooltip-Sichtbarkeits-Synchronisation, It Quellkommentar 'die Verzoegerung bleibt: sie ist kein Effekt, sondern Absicht') von Hand auf var(--dur-fast) gesetzt -- die vorher exakt 0ms betragende Dauer wandert damit auf ~150ms; die begleitenden Verzoegerungswerte (0.16s/0.45s) bleiben in allen Faellen woertlich stehen, da D-01..07 nur Dauer+Kurve fuer Bedienuebergaenge definieren, keinen eigenen Verzoegerungs-Wert. Kein Treffer bei verify:fx (7/7), da dessen Zusicherungen Klassennamen/Ereignisnamen/Markup pruefen, nicht Millisekunden"
  - "assets/hero-video.js: 'transition:opacity 1.4s ease' bewusst NICHT migriert -- 1400ms liegt weit ueber der 350ms-Bedienuebergang-Schwelle (D-03) und ist laut eigenem Kopfkommentar ein 'Ambient-Loop hinter dem Hero', exakt die in 02-CONTEXT.md ausgenommene Kategorie. Direkte Praezedenz: 02-03-SUMMARY.md dokumentiert denselben Carve-out fuer archive.css's 0,4-0,9s-Aeren-Uebergaenge. Der informelle Node-Einzeiler aus der Plan-Prosa (jede nicht-var(-praefigierte 'transition:'-Fundstelle als 'Rest' zaehlend) hat dafuer keinen Ambiente-Carve-out und meldet folgerichtig '1 Rest' -- das ist der korrekte, gewollte Zustand, kein uebersehener Fund"
  - "assets/tool-help.js: neben den zwei im Plan namentlich genannten font-size-Werten (.8rem/.68rem) traegt dieselbe Zeichenkette eine dritte, vom Plan nicht benannte letter-spacing:.08em -- exakt var(--ls-10) (0 % Abweichung), im selben Sonderfall-3-Schritt migriert, da sie derselben Kategorie ('Laufzeitwert, von keiner Erhebung erfasst') angehoert"
  - "REQUIREMENTS.md TYPO-01/02/03 bewusst weiterhin NICHT auf den Traceability-Status 'Complete' gesetzt (Praezedenz aus 02-02/02-03-SUMMARY.md fortgefuehrt) -- site-weite Abdeckung ist erst nach Plan 07 vollstaendig"

patterns-established:
  - "Bei transition-Teilen mit Verzoegerung: Dauer auf die Skala, Verzoegerung bleibt immer woertlich -- Referenzentscheidung fuer alle folgenden Plaene, falls dort aehnliche Faelle auftauchen"
  - "Gekoppelte Nicht-Zielwerte (text-indent neben letter-spacing) im selben Schritt mitziehen, wenn ein Quellkommentar die Kopplung ausdruecklich macht"

requirements-completed: []

coverage:
  - id: D1
    description: "Die sechs grossen Werkzeug-Koerper (ShipDetail/CraftingApp/PrecisionJumpApp/MiningApp/ItemFinderApp/MissionDetail) melden 0 verbliebene skalenpflichtige Rohwerte; die zwei ItemFinderApp-Ausreisser und der ShipDetail-Ausreisser sind gemessen und beziffert, nicht geschaetzt"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs --only <je Datei> --expect-remaining 0 (kombiniert: 0/6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Die 21 kleineren Komponenten (inkl. dossier/PatchDossier, dossier/QuickFacts) und src/layouts/Layout.astro melden 0 verbliebene skalenpflichtige Rohwerte; html { font-size: 112.5% } steht unveraendert mit erklaerendem Kommentar"
    requirement: TYPO-02
    verification:
      - kind: other
        ref: "node scripts/audit-typo-motion.mjs --only <28 Dateien einzeln> --expect-remaining 0; Layout-Wurzelwert-Zusicherung (Node-Einzeiler aus 02-04-PLAN.md Task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Die vier Laufzeitwerte in assets/tool-help.js (2 font-size + 1 zusaetzliche letter-spacing) und assets/crafting-app.js (1 font-size) lesen aus der Skala; assets/hero-video.js bleibt bewusst Ambient und unmigriert"
    verification:
      - kind: other
        ref: "grep gegen assets/tool-help.js/assets/crafting-app.js nach var(--fs-/--ls-; manuelle Pruefung des hero-video.js-Ambient-Carve-outs gegen 02-CONTEXT.md § Phase Boundary"
        status: pass
    human_judgment: false
  - id: D4
    description: "verify:help (11/11 Werkzeuge, 5 Zusicherungen je Lauf) und verify:fx (7 Zusicherungen inkl. 8.678 Seitenpaar-Sprachparitaet) bleiben unveraendert gruen -- die Hilfe-Mechanik aus Phase 1.2 und der Partikel-Umschalter aus Phase 1.1 sind nachweislich unberuehrt"
    requirement: TYPO-01
    verification:
      - kind: other
        ref: "npm.cmd run verify:help; npm.cmd run verify:fx"
        status: pass
    human_judgment: false
  - id: D5
    description: "Alle Hausgates unveraendert gruen nach der Umstellung: build (17357 Seiten), verify:typo (5/5), verify (813441 Referenzen), audit:site (0 Fehler), audit:csp (10/10 Quellen), test:e2e (215/215)"
    verification:
      - kind: other
        ref: "npm.cmd run build; npm.cmd run verify:typo; npm.cmd run verify; npm.cmd run audit:site; npm.cmd run audit:csp; npm.cmd run test:e2e"
        status: pass
    human_judgment: false
  - id: D6
    description: "Die drei groessten Einrast-Ausreisser dieses Plans (ItemFinderPage.astro letter-spacing 0,44em->0,32em, 27 %; FxToggle.astro vier 0ms->~150ms-Sichtbarkeits-Synchronisationen; ShipDetail.astro 1.7rem->var(--fs-15) zweimal) sind mechanisch bewiesen unschaedlich fuer die geprueften Gates, aber eine Sichtpruefung im Browser (Item-Finder-Hero-Randbeschriftung, FX-Tooltip-Timing, Schiffs-Holo-Titel) steht noch aus"
    verification: []
    human_judgment: true
    rationale: "Ob die groesseren Laufweiten-/Timing-Verschiebungen noch als beabsichtigt wirken, ist ein Sichturteil im Browser -- kein Skript kann 'wirkt weiterhin richtig gesperrt/getaktet' beurteilen."

duration: ~50min
completed: 2026-08-08
status: complete
---

# Phase 2 Plan 4: Die Werkzeug- und Bauteil-Körper Summary

**Der überprüfbare Massendurchlauf aus Plan 03 hat 889 Werte in 27 Werkzeug-/Bauteil-Körpern plus `src/layouts/Layout.astro` auf die Schrift-/Bewegungsskala umgestellt, ergänzt um 13 von Hand entschiedene Ausreißer — darunter eine gekoppelte `text-indent`-Korrektur und vier Sichtbarkeits-Synchronisations-Übergänge in `FxToggle.astro`, deren 0ms-Dauer keiner Erhebungskategorie entsprach.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2/2 completed
- **Files modified:** 31 (30 aus dem Plan-Frontmatter + `scripts/audit-typo-motion.mjs` als Rule-3-Werkzeugfix)

## Accomplishments

- `scripts/migrate-typo-motion.mjs` auf alle 27 Astro-Komponenten (6 große Werkzeug-Körper + 21 kleinere inkl. `dossier/PatchDossier.astro`, `dossier/QuickFacts.astro`) plus `src/layouts/Layout.astro` angewendet: 889 automatische Ersetzungen (506 in Task 1, 383 in Task 2).
- `ShipDetail.astro`: zwei `1.7rem`-Fundstellen (`.holo__title h1`, `.sd__cargonum`) von Hand auf `var(--fs-15)` gerastet — identischer Zielwert/identische 6,25-%-Abweichung wie `archive.css:1041` aus Plan 03, direkte Präzedenz für denselben Wert.
- `ItemFinderApp.astro`: fünf `letter-spacing`-Werte in `px` (vom Codemod verweigert, da die Laufweiten-Skala nur `em` kennt) von Hand in `em` relativ zum lokalen `font-size`-Token derselben Regel umgerechnet und gerastet — alle fünf Abweichungen unter 1 % relativ zur Elementschriftgröße.
- `Layout.astro`: `html { font-size: 112.5% }` bleibt wörtlich stehen, jetzt mit einem Kommentar, der den Zirkelbezug erklärt, falls ein späterer Durchlauf ihn versehentlich anfasst. Die `letter-spacing:.08em` im rohen Vorschau-Banner-`style`-Attribut ist auf `var(--ls-10)` umgestellt.
- `ItemFinderPage.astro`: `letter-spacing:.44em` (großgeschriebene „Star Citizen"-Randbeschriftung) auf `var(--ls-20)` gerastet — der zweitgrößte Einrast-Ausreißer der Phase (27 % Abweichung). Das laut Quellkommentar gekoppelte `text-indent:.44em` (gleicht die Sperrung beim Zentrieren exakt aus) wurde im selben Schritt auf `var(--ls-20)` mitgezogen, sonst wäre die Zentrierung nach dem Einrasten sichtbar verschoben.
- `FxToggle.astro`: vier `visibility 0s [linear] Xs`-Übergänge (Tooltip-Sichtbarkeits-Synchronisation) von Hand auf `var(--dur-fast)` gesetzt; die begleitenden Verzögerungswerte (0.16s/0.45s) bleiben wörtlich stehen. `verify:fx` bleibt unverändert 7/7 grün.
- Sonderfall 3 (vier Laufzeitwerte in `assets/*.js`, von keiner Erhebung erfasst): `tool-help.js` zwei `font-size` plus eine zusätzlich gefundene `letter-spacing` (vom Plan nicht benannt); `crafting-app.js` eine `font-size`. `hero-video.js`s `transition:opacity 1.4s ease` bewusst **nicht** migriert — Ambient-Loop, 1400ms weit über der 350-ms-Bedienübergang-Schwelle.
- `scripts/audit-typo-motion.mjs` auf mehrwertiges `--only` umgestellt (Rule 3): das Skript unterstützte bislang nur EINEN `--only`-Wert, obwohl der Plan selbst mehrere `--only`-Praefixe in einem Aufruf vorgibt.
- Alle Hausgates grün: `build` (17357 Seiten), `verify:typo` (5/5), `verify:fx` (7/7), `verify:help` (11/11), `verify` (813441 Referenzen), `audit:site` (0 Fehler), `audit:csp` (10/10 Quellen), `test:e2e` (215/215).

## Task Commits

1. **Task 1: Die sechs großen Werkzeug-Körper** - `220cf8b` (feat)
2. **Task 2: Die 24 kleineren Bauteile, das Layout und die vier Laufzeitwerte** - `b389b6d` (feat)

## Files Created/Modified

- `src/components/ShipDetail.astro` - 138 automatische Ersetzungen + 2 von Hand gerastete `1.7rem`-Ausreißer
- `src/components/CraftingApp.astro` - 106 Ersetzungen, drei `em`-Schriftgrade bleiben elternrelativ
- `src/components/PrecisionJumpApp.astro` - 81 Ersetzungen, keine Ausreißer
- `src/components/MiningApp.astro` - 76 Ersetzungen, keine Ausreißer
- `src/components/ItemFinderApp.astro` - 66 Ersetzungen + fünf von Hand umgerechnete `px`-Laufweiten + ein `em`-Schriftgrad bleibt elternrelativ
- `src/components/MissionDetail.astro` - 39 Ersetzungen, fünf `em`-Schriftgrade bleiben elternrelativ
- `src/components/SupportBody.astro` - 48 Ersetzungen
- `src/components/SignatureIdentifier.astro` - 43 Ersetzungen
- `src/components/RefineryFinder.astro` - 30 Ersetzungen
- `src/components/MissionsApp.astro` - 27 Ersetzungen, zwei `em`-Schriftgrade bleiben elternrelativ
- `src/components/FracturingCalc.astro` - 18 Ersetzungen
- `src/components/SearchOverlay.astro` - 29 Ersetzungen
- `src/components/FeedbackForm.astro` - 25 Ersetzungen
- `src/components/ItemFinderPage.astro` - 10 Ersetzungen + ein von Hand gerasteter `letter-spacing`-Ausreißer + gekoppeltes `text-indent`
- `src/components/ArmorSets.astro` - 19 Ersetzungen
- `src/components/TopicFacts.astro` - 17 Ersetzungen
- `src/components/WikeloBridge.astro` - 8 Ersetzungen
- `src/components/Attribution.astro` - 8 Ersetzungen
- `src/components/OnepagerLink.astro` - 9 Ersetzungen
- `src/components/RelatedTopics.astro` - 6 Ersetzungen
- `src/components/ToolHelp.astro` - 7 Ersetzungen
- `src/components/HomeLaunchpad.astro` - 12 Ersetzungen
- `src/components/FxToggle.astro` - 13 Ersetzungen + vier von Hand gesetzte Sichtbarkeits-Synchronisationen
- `src/components/LangSwitcher.astro` - 3 Ersetzungen
- `src/components/ThemeToggle.astro` - 2 Ersetzungen
- `src/components/dossier/PatchDossier.astro` - 36 Ersetzungen
- `src/components/dossier/QuickFacts.astro` - 13 Ersetzungen
- `src/layouts/Layout.astro` - 1 Ersetzung (`letter-spacing`) + Wurzelwert-Kommentar; `font-size: 112.5%` bleibt wörtlich
- `assets/tool-help.js` - zwei `font-size` + eine zusätzliche `letter-spacing` auf Tokens umgestellt
- `assets/crafting-app.js` - eine `font-size` auf Token umgestellt
- `scripts/audit-typo-motion.mjs` - `--only` unterstützt jetzt mehrere Werte (Rule 3)

## Decisions Made

- `scripts/audit-typo-motion.mjs`s `--only` auf `collectFlagValues()` umgestellt, damit die im Plan selbst formulierten Mehrfach-`--only`-Verify-Befehle tatsächlich mehr als eine Datei prüfen.
- Die plan-vorgegebene Verify-Formel `--only src/components/ --only src/layouts/` als die **exakte Dateiliste dieses Plans** interpretiert (28 Einzelpfade), nicht als Verzeichnis-Präfix — ein wörtlicher Verzeichnis-Lauf hätte die noch nicht umgestellten Verzeichnisse `patches/`/`topics/`/`account/`/`ships/` (Eigentum der Pläne 05/06) mit einbezogen und wäre zwangsläufig mit Restwerten > 0 gescheitert.
- `ShipDetail.astro`s `1.7rem` (zweimal) nach der `archive.css`-Präzedenz aus Plan 03 (identischer Wert, identische Abweichung) auf `var(--fs-15)` gerastet.
- `ItemFinderApp.astro`s fünf `px`-Laufweiten anhand des jeweils LOKALEN, bereits tokenisierten `font-size` derselben Regel in `em` umgerechnet, dann gerastet — alle Abweichungen weit unter der 0,02-em-Schwelle.
- `ItemFinderPage.astro`s `text-indent` (nicht selbst audit-pflichtig) im selben Schritt wie das gekoppelte `letter-spacing` mitgezogen, weil der Quellkommentar die Kopplung explizit macht.
- `FxToggle.astro`s vier `visibility 0s [linear] Xs`-Übergänge auf `var(--dur-fast)` gesetzt (0ms → ~150ms), die begleitenden Verzögerungen bleiben wörtlich — `verify:fx` prüft Klassennamen/Ereignisse/Markup, keine Millisekunden, daher unverändert 7/7 grün.
- `assets/hero-video.js`s `1.4s`-Übergang bewusst nicht migriert (Ambient-Loop, D-03-Grenze, Präzedenz aus 02-03-SUMMARY.md).
- `REQUIREMENTS.md` TYPO-01/02/03 bewusst weiterhin nicht auf „Complete" gesetzt — Präzedenzfall aus 02-02/02-03-SUMMARY.md fortgeführt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `audit-typo-motion.mjs --only` unterstützte nur einen Wert**
- **Found during:** Task 1, Versuch die im Plan selbst vorgegebene Kombi-Verify-Zeile auszuführen
- **Issue:** `--only` wurde per `process.argv.indexOf` gelesen (nur der erste Treffer), während `migrate-typo-motion.mjs` bereits `collectFlagValues()` (mehrwertig) nutzt. Die Verify-Befehle sowohl dieses Plans als auch der Pläne 05/06 rufen `audit-typo-motion.mjs` mit mehreren `--only`-Präfixen in einem Aufruf auf — mit der Einzelwert-Fassung hätte jeder solche Aufruf still nur die ERSTE Datei geprüft und einen falschen „0 Restwerte"-Erfolg für den gesamten restlichen Dateiumfang gemeldet.
- **Fix:** `collectFlagValues('--only')` wie in `migrate-typo-motion.mjs` übernommen; alle Stellen, die `ONLY` als Wahrheitswert prüften, auf `ONLY.length` umgestellt.
- **Files modified:** `scripts/audit-typo-motion.mjs`
- **Verification:** `node scripts/audit-typo-motion.mjs` (ohne Argumente) reproduziert weiterhin unverändert 1961/96/863/660; ein Mehrfach-`--only`-Aufruf über alle 28 Dateien dieses Plans meldet jetzt korrekt "28 Datei(en) durchsucht" statt 1.
- **Committed in:** `220cf8b` (Task 1 commit)

### Auto-add: von Hand entschiedene, vom Plan nicht (oder nur teilweise) benannte Ausreißer

- `src/components/ItemFinderApp.astro`: fünf `px`-Laufweiten (`.uif-filters h3`, `.uif-card-cat-wrapper`, `.uif-modal-section h4`, `.uif-crafting-ingredients h5`, `.uif-filters-label`) — vom Plan nicht namentlich genannt (der Plan nennt nur die zwei `font-size`-Ausreißer dieser Datei). Umgerechnet relativ zur lokalen Elementschriftgröße: `1.5px`/`15,3px`≈`0,098em`→`--ls-11`(0,10em) zweimal; `0,5px`/`14,4px`≈`0,035em`→`--ls-6`(0,03em); `1px`/`19,8px`≈`0,051em`→`--ls-8`(0,05em); `0,5px`/`16,2px`≈`0,031em`→`--ls-6`(0,03em). Alle fünf Abweichungen unter 1 % relativ zur Elementschriftgröße.
- `src/components/ItemFinderApp.astro`/`src/components/ShipDetail.astro`: die vom Plan angekündigten zwei „7,7 %/8,6 %"-Ausreißer (`1.3rem`, `1.75rem`) erwiesen sich bei tatsächlicher Messung als 0 % (`1.3rem` trifft `--fs-13` exakt, wie der Plan selbst vorwarnt) bzw. 2,78 % (`1.75rem`→`--fs-16`) — beide liefen als reguläre automatische Ersetzung, keine Handarbeit nötig. Der tatsächliche Ausreißer in `ShipDetail.astro` (`1.7rem`, 6,25 %, zweimal) war vom Plan nicht als Prozentzahl benannt, aber als Datei erwartet.
- `src/components/ItemFinderPage.astro`: `letter-spacing:.44em`/`text-indent:.44em` — vom Plan nicht genannt. Auf `var(--ls-20)` gerastet, 0,12em/27 % Abweichung, zweitgrößter Einrast-Ausreißer der Phase.
- `src/components/FxToggle.astro`: sechs `transition`-Verweigerungen (vier `visibility 0s [linear] Xs`, ein `visibility 0s`, zwei mit `opacity`/`transform 0.16s ease 0.45s`) — vom Plan nicht genannt, obwohl der Plan FxToggle explizit als "vollständig skalenpflichtig" bezeichnet. Alle sechs von Hand aufgelöst: Dauer auf `var(--dur-fast)`, Verzögerung bleibt wörtlich.
- `assets/tool-help.js`: eine dritte, vom Plan nicht benannte `letter-spacing:.08em` in derselben Stilzeichenkette wie die zwei genannten `font-size`-Werte — auf `var(--ls-10)` (exakter Treffer) umgestellt, da sie derselben Sonderfall-3-Kategorie angehört.

---

**Total deviations:** 1 auto-fixed (Rule 3, Werkzeugfehler in `audit-typo-motion.mjs`) + 5 vom Plan nicht (oder nur teilweise) vorhergesehene, aber korrekt gefundene und dokumentierte Ausreißer/Sonderfälle.
**Impact on plan:** Alle Abweichungen betreffen entweder ein Werkzeugdefizit (behoben, kein Verhaltensrisiko) oder Ausreißer, die nach denselben in Plan 01/03 etablierten Regeln (D-05 Einrasten, Ambient->350ms bleibt, Verzögerung bleibt immer wörtlich) aufgelöst wurden. Kein Scope Creep; jeder Zielwert stimmt mit der Plan-Absicht überein.

## Issues Encountered

- **Die Plan-Verify-Formel für Task 2 (`--only src/components/ --only src/layouts/ --expect-remaining 0`) ist als Verzeichnis-Präfix nicht erfüllbar**, solange die Pläne 05/06 ihre Dateien noch nicht umgestellt haben (1678 Restwerte bei wörtlicher Ausführung, verteilt über `patches/`, `topics/`, `account/`, `ships/` u.a.). Aufgelöst durch Interpretation als exakte Dateiliste dieses Plans (28 Einzelpfade) statt Verzeichnis-Scope — siehe Decisions.
- **`assets/hero-video.js`s Transition widerspricht der Plan-Prosa** ("auf var(--dur-*)/var(--ease-ui) umstellen"), wenn man die etablierte >350ms-Ambient-Regel konsequent anwendet. Aufgelöst zugunsten der Regel (Präzedenz aus 02-03), nicht der Prosa — dieselbe Art Diskrepanz, die 02-01/02-03-SUMMARY.md bereits für andere Prozentzahlen/Formulierungen dokumentiert haben.
- **`FxToggle.astro`s 0ms-Übergänge fielen durch keine bestehende Ausnahmekategorie** (nicht `em`, nicht `clamp()`, nicht Ambient — da nicht `>350ms` und kein Scroll-Reveal-Selektor). Aufgelöst durch Hand-Entscheidung (siehe Decisions), nicht durch stille Auslassung.

## User Setup Required

None - keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

Der Codemod hat jetzt an 34 Astro-Dateien (6 aus Plan 03 als CSS + 28 aus diesem Plan) bewiesen, dass er sowohl einfache Massenfälle als auch mehrere neue Ausreißer-Kategorien (px-Laufweiten mit lokalem Kontext, gekoppelte Nicht-Zielwerte, 0ms-Synchronisations-Übergänge) korrekt verweigert statt zu raten. Die Pläne 05 und 06 können `scripts/migrate-typo-motion.mjs` direkt auf die Patch-Körper (19) bzw. die Verzeichnisse `pages/topics/account/ships` anwenden — inklusive des jetzt mehrwertigen `--only` in `audit-typo-motion.mjs`, das ihre eigenen Verify-Befehle erst funktionsfähig macht.

**Offene Punkte für den Betreiber (Sichtprüfung, siehe D6):**
- `src/components/ItemFinderPage.astro`: die „Star Citizen"-Randbeschriftung im Item-Finder-Hero (`letter-spacing`/`text-indent` von 0,44em auf 0,32em gerastet, 27 % enger) — prüfen, ob sie noch als „gesperrte Beschriftung" wirkt.
- `src/components/FxToggle.astro`: der FX-Tooltip am Partikel-Umschalter — die Sichtbarkeits-Übergänge sind jetzt ~150ms statt 0ms verzögert; auf Maus und Tastatur (`:focus-visible`) gegenprüfen, ob das Timing noch stimmig wirkt.
- `src/components/ShipDetail.astro`: Holo-Titel und Frachtraum-Zahl (`1.7rem`→`var(--fs-15)`, 6,25 % kleiner) — kurzer Blick aufs Schiffs-Datenblatt.

---
*Phase: 02-schrift-und-bewegungsskala*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `src/components/ShipDetail.astro`
- FOUND: `src/components/dossier/QuickFacts.astro`
- FOUND: `src/layouts/Layout.astro`
- FOUND: `scripts/audit-typo-motion.mjs`
- FOUND: commit `220cf8b` (Task 1)
- FOUND: commit `b389b6d` (Task 2)
