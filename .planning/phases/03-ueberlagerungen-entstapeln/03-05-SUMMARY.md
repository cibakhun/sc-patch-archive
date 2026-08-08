---
phase: 03-ueberlagerungen-entstapeln
plan: 05
subsystem: ui
tags: [css, wcag-contrast, registry-driven-gate, ci, dockerfile, alpha-compositing]

requires:
  - phase: 03-ueberlagerungen-entstapeln
    provides: "Plan 01 lieferte compositeOver()/flattenStack() und den Tracer-Registry-Eintrag (.hero); Plan 02-04 trugen die Schicht in den restlichen Archetypen, /archiv und den 19 Patch-Koerpern ab (LAYER-01 vollstaendig) und liessen den Hellmodus-Fliesstext-Befund (2,98:1) fuer diesen Plan liegen"
provides:
  - "scripts/lib/layer-registry.mjs -- die vollstaendige, hergeleitete Aufzaehlung der Messstellen (A1-A10 geteiltes System, B1-B6 die 19 Patch-Koerper, C1-C3 Eigenbauten, D1-D5 von der Vollstaendigkeitspruefung selbst gefundene Archetyp-Varianten), samt benannter EXCLUSIONS-Liste"
  - "scripts/verify-layers.mjs Zusicherung 5 (Vollstaendigkeitswaechter, scannt dist/**/*.css + dist/**/*.html nach jeder Scrim/Raster-Selektor-Familie) und Zusicherung 6 (Abdeckung, ein uebersprungener Messpunkt ist ein Fehlschlag)"
  - "WCAG-AA-Zielmarke scharf gestellt und erreicht: 25 Registry-Eintraege, 344 Einzelmessungen, 0 unter der Marke, in beiden Farbmodi"
  - "npm run verify:layers haengt im Dockerfile-Tor hinter verify:typo -- ein Kontrast-Rueckfall kann kein Auslieferungsimage mehr erzeugen"
  - ".planning/WINDOWS.md Eintrag id 6 -- die Sichtrunde zu Erfolgskriterium 3, benannt und nach gemessener Schwere sortiert, an den Betreiber uebergeben"
affects: []

tech-stack:
  added: []
  patterns:
    - "Registry-Eintraege sind nach SELEKTOR-FAMILIE geschlossen (Zusicherung 5), aber nach BILDDATEI/PALETTE gemessen (Zusicherung 6) -- ein Eintrag kann mehrere Bilder/Paletten tragen (B1-B6 haben je 13-19), ohne dass die Closure-Pruefung 19 identische Registry-Zeilen braucht"
    - "Genereller Verlaufs-Compositor (axisFraction/gradientLayerColorAt/scrimColorAt in layer-registry.mjs) deckt jeden im Bestand vorkommenden axis-aligned CSS-Gradienten (0/90/180/270deg, beliebig viele Stops, Token- oder Fixfarben) ab -- ein Modell fuer alle Archetypen statt einer Handrechnung je Archetyp wie im Tracer (Plan 01)"
    - "Der Vollstaendigkeitswaechter (Zusicherung 5) hat waehrend der Entwicklung selbst 18 vorher unbekannte Selektor-Familien im GESAMTEN Bestand gefunden (nicht nur dieser Phase) -- 5 davon echte Text-auf-Foto-Stellen (D1-D5), aufgenommen statt uebergangen"

key-files:
  created:
    - scripts/lib/layer-registry.mjs
  modified:
    - scripts/verify-layers.mjs
    - assets/detail.css
    - src/components/patches/sc-4-0-0.astro
    - src/components/patches/sc-4-0-1.astro
    - src/components/patches/sc-4-0-2.astro
    - src/components/patches/sc-4-1-0.astro
    - src/components/patches/sc-4-1-1.astro
    - src/components/patches/sc-4-2-0.astro
    - src/components/patches/sc-4-2-1.astro
    - src/components/patches/sc-4-3-0.astro
    - src/components/patches/sc-4-3-1.astro
    - src/components/patches/sc-4-3-2.astro
    - src/components/patches/sc-4-4-0.astro
    - src/components/patches/sc-4-5-0.astro
    - src/components/patches/sc-4-6-0.astro
    - src/components/patches/sc-4-7-0.astro
    - src/components/patches/sc-4-8-0.astro
    - src/components/patches/sc-4-8-1.astro
    - src/components/patches/sc-4-8-2.astro
    - src/components/patches/sc-4-8-3.astro
    - src/components/patches/sc-4-9-0.astro
    - src/components/ships/ShipsOverview.astro
    - src/components/topics/4-0-1-fight-for-pyro.astro
    - Dockerfile
    - .planning/REQUIREMENTS.md
    - .planning/WINDOWS.md

key-decisions:
  - "Heilung ausschliesslich ueber lokale Scrim-Aenderungen: Verlauf-Stopp verschoben (Hero/Shot, 55%->90% Plateau) oder falscher Tokensatz korrigiert (.fcard, .sdb__sub) -- --ambient-opacity blieb bei 0.5/0.4, die Palette wurde nicht angefasst, die --scrim-*-Skala wurde nicht vereinheitlicht"
  - "Zusicherung 5 erkennt eine Selektor-Familie an vier Merkmalen (content:''/position:absolute|fixed/inset:0/*-gradient()) -- echte Elemente (archive.css .space, .dsr::after, .dp::before, .sdb::before) faellen bewusst NICHT darunter, weil sie keine Pseudo-Elemente sind; als benannte Grenze dokumentiert (X-ambient-family), nicht stillschweigend uebersehen"
  - "C3b (.node--point .node__art) wurde in Task 1 zunaechst faelschlich als Text-auf-Foto-Stelle gemessen (3,20:1, unter der Marke) -- .node__tag sitzt aber als FLEX-GESCHWISTER von .node__body neben dem Foto, nicht darueber (anders als .node--major). Auf Kontrollfall korrigiert, bevor die Zahl in die Healing-Liste haette einfliessen koennen"
  - "D1-D5 (von Zusicherung 5 selbst gefundene Archetyp-Varianten aus Item Finder, Ships Overview, Startseite und einer Themenseite) wurden gemessen und, wo sie die Marke verfehlten, hier mitgeheilt -- nicht auf einen spaeteren Plan verschoben, weil das Tor sie sonst als Registry-Luecke haette melden muessen"
  - "WINDOWS.md id 6 fuehrt die Sichtrunde; LAYER-01/02 sind auf Complete gesetzt, die Phase bleibt aber technisch fertig statt abgenommen, bis der Betreiber sie prueft -- derselbe Umgang wie Phase 1.2 und Phase 2"

requirements-completed: [LAYER-01, LAYER-02]

coverage:
  - id: D1
    description: "scripts/lib/layer-registry.mjs -- vollstaendige, hergeleitete Aufzaehlung (25 Eintraege: A1-A10, B1-B6, C1-C3, D1-D5) mit Begruendung je Eintrag und einer benannten EXCLUSIONS-Liste"
    requirement: "LAYER-02"
    verification:
      - kind: unit
        ref: "node scripts/verify-layers.mjs --report --json (entries.length===25, jeder Eintrag measured&&rationale)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zusicherung 5 (Vollstaendigkeitswaechter) schliesst die Aufzaehlung maschinell gegen den GEBAUTEN Stand -- 0 Selektor-Familien ohne Registry- oder EXCLUSIONS-Eintrag"
    requirement: "LAYER-02"
    verification:
      - kind: unit
        ref: "node scripts/verify-layers.mjs --closure"
        status: pass
      - kind: unit
        ref: "Negativkontrolle: selectorFamilies aus A2-band entfernt -> Zusicherung 5 nennt .band::before/.band::after als Funde ohne Eintrag; danach wiederhergestellt und gruen"
        status: pass
    human_judgment: false
  - id: D3
    description: "WCAG-AA-Zielmarke scharf (Zusicherung 4): 344 Einzelmessungen, 0 unter der Marke, in beiden Farbmodi; Zusicherung 6 (Abdeckung) bestaetigt alle 25 Eintraege vollstaendig gemessen"
    requirement: "LAYER-02"
    verification:
      - kind: unit
        ref: "npm run verify:layers (alle 6 Zusicherungen)"
        status: pass
      - kind: unit
        ref: "Negativkontrolle: --on-media-dim in dist/assets/theme.css testweise verdunkelt -> 9 Registry-Eintraege schlagen fehl; danach wiederhergestellt und gruen"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run verify:layers haengt im Dockerfile-Tor hinter verify:typo, nach dem Build"
    verification:
      - kind: unit
        ref: "node -e Pruefung aus 03-05-PLAN.md Task 3 (package.json + Dockerfile-Reihenfolge)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Erfolgskriterium 3 (Bildmotive tragen die Seite optisch weiterhin) -- Sichturteil, WINDOWS.md id 6"
    verification: []
    human_judgment: true
    rationale: "human_verify_mode: end-of-phase laut Plan -- kein Skript kann 'wirkt noch wie ein Motiv' entscheiden. Sechs Sichtbloecke mit den nach Schwere sortierten Fundstellen an den Betreiber uebergeben, nicht vom Executor durchgefuehrt."

duration: ~2h
completed: 2026-08-08
status: complete
---

# Phase 3 Plan 5: Vollstaendige Aufzaehlung + WCAG-AA scharf + Dockerfile-Tor Summary

**scripts/lib/layer-registry.mjs zaehlt jetzt 25 Messstellen (A1-A10 geteiltes System, B1-B6 ueber alle 19 Patch-Koerper, C1-C3 Eigenbauten, D1-D5 von der neuen Vollstaendigkeitspruefung selbst gefunden) vollstaendig auf und schliesst sie maschinell gegen den gebauten Stand — 344 Einzelmessungen, 0 unter der WCAG-AA-Marke in beiden Farbmodi, nachdem der urspruengliche Leitbefund (Hero-Fliesstext hell 2,93:1) durch einen verschobenen Verlauf-Stopp auf 18,34:1 gehoben wurde; `verify:layers` haengt jetzt im Dockerfile-Tor.**

## Performance

- **Duration:** ~2h
- **Completed:** 2026-08-08T20:21:00Z
- **Tasks:** 3
- **Files modified:** 25 (1 neu, 24 geaendert)

## Accomplishments

- **Die Aufzaehlung ist vollstaendig und maschinell geschlossen, nicht stichprobenhaft.** `scripts/lib/layer-registry.mjs` fuehrt A1-A10 (geteiltes System, inkl. vier Kontrollfaelle und der von der Maske "freigestellten" Fusszeile), B1-B6 (5 Archetyp-Familien ueber die 19 Patch-Koerper, aus den Quelldateien HERGELEITET statt abgetippt, plus die flaechige Fusszeile), C1-C3 (PilotPage, Startseiten-Hero, /archiv) und eine benannte Ausschlussliste (D-06, `#stars`, `.lb`, Scrim-Skalen-Vereinheitlichung, eine Ambiente-Backdrop-Familie aus vier unabhaengigen Subsystemen).
- **Der erste echte Lauf von Zusicherung 5 gegen den VOLLEN Bestand foerderte 18 vorher unbekannte Selektor-Familien zutage** — genau der Fall, den die Zusicherung beweisen soll. Fuenf davon waren echte, bisher unentdeckte Text-auf-Foto-Stellen aus Werkzeugseiten ausserhalb dieser Phase (Item Finder, Ships Overview, Startseiten-Werkzeugkacheln, eine Themenseiten-Kartenreihe, ein patch-eigenes Video-Banner) — als D1-D5 aufgenommen und gemessen, nicht uebergangen. Die uebrigen 13 sind benannte Kontrollfaelle, totes CSS oder Blend-Modi.
- **Der urspruengliche Leitbefund ist behoben: Hero-Fliesstext im Hellmodus 2,93:1 → 18,34:1.** Die Ursache war ein Verlauf-Stopp ("`var(--scrim-4) 55%,var(--bg)`"), der den Ankerpunkt (yFrac 0,85) in die Interpolation Richtung `--bg` zog — im Hellmodus hell. Der Fix ist ein VERSCHOBENER Stopp (die Stufe haelt jetzt bis 90% durch), nicht ein Absenken von `--ambient-opacity` und nicht eine Palettenaenderung. Derselbe woertliche Fix traf den `.shot`-Archetyp ueber alle 19 Patch-Koerper.
- **Zwei weitere, eigenstaendige Rule-1-Bugs gefunden und behoben:** `.fcard` (Themenseite 4-0-1) benutzte Flaechen-Tokens (`--veil`/`--text`) statt Medien-Tokens ueber einem Foto; `.sdb__hero .sdb__sub` (Ships Overview) trug eine fixe Farbe mit einem GENERIERTEN, aber fuer eine Foto-Flaeche falschen dunklen Hellmodus-Override.
- **`npm run verify:layers` haengt jetzt im Dockerfile-Tor** hinter `verify:typo`, nach dem Build — ein Kontrast-Rueckfall kann kein Auslieferungsimage mehr erzeugen.
- **Die Sichtrunde ist an den Betreiber uebergeben** (WINDOWS.md id 6), mit den fuenf Stellen des kleinsten gemessenen Abstands zur Marke benannt und sortiert, plus dem urspruenglichen Leitbefund als Vergleichspunkt.

## Task Commits

1. **Task 1: Die Aufzaehlung vollstaendig machen und maschinell schliessen** — `d82741e` (feat)
2. **Task 2: Die Zielmarke erreichen und scharf stellen (D-04)** — `a3d138e` (fix)
3. **Task 3: Ans Dockerfile-Tor haengen und das Sichturteil uebergeben** — `4073a6a` (feat)

**Plan metadata:** wird mit diesem Commit abgeschlossen (docs: complete plan)

## Files Created/Modified

- `scripts/lib/layer-registry.mjs` — neu, die vollstaendige Registry (25 Eintraege) + Compositor-Bausteine (axisFraction/gradientLayerColorAt/scrimColorAt) + EXCLUSIONS
- `scripts/verify-layers.mjs` — Zusicherung 5 (Vollstaendigkeitswaechter) + Zusicherung 6 (Abdeckung), AA jetzt scharf (Zusicherung 4), `--closure`/`--report`/`--json`-Modi
- `assets/detail.css` + 19 Patch-Koerper (`src/components/patches/sc-4-*.astro`) — `.hero__photo::after`/`.shot::after`-Verlauf-Stopp verschoben (55%→90%-Plateau)
- `src/components/topics/4-0-1-fight-for-pyro.astro` — `.fcard` auf Medien-Tokens umgestellt (Rule 1)
- `src/components/ships/ShipsOverview.astro` — `.sdb__sub` auf `var(--on-media-dim)` umgestellt, generierter Hellmodus-Override entfernt (Rule 1)
- `Dockerfile` — `verify:layers` in der Torkette nach `verify:typo`
- `.planning/REQUIREMENTS.md` — LAYER-01/LAYER-02 auf Complete
- `.planning/WINDOWS.md` — Eintrag id 6 (Sichtrunde, offen)

## Gemessene Werte — die fuenf kleinsten Abstaende zur Marke (nach der Heilung)

| Stelle | Bild/Palette | Modus | Wert | Marke | Abstand |
|---|---|---|---|---|---|
| D3 `.sdb__hero .sdb__sub` (Ships Overview) | ships-overview-hero | hell | 4,96:1 | 4,5:1 | 0,46 |
| D1 `.hero--tool` h1 (Item Finder) | item-finder-hero | hell | 3,63:1 | 3,0:1 | 0,63 |
| B6 Patch-Fusszeile | sc-4-0-2 | dunkel | 5,84:1 | 4,5:1 | 1,34 |
| B6 Patch-Fusszeile | sc-4-7-0 | dunkel | 6,01:1 | 4,5:1 | 1,51 |
| B6 Patch-Fusszeile | sc-4-2-1 | hell | 6,04:1 | 4,5:1 | 1,54 |

Zum Vergleich der urspruengliche Leitbefund (nicht der kleinste Abstand mehr, aber der groesste gemessene Sprung der Phase):

| Stelle | Bild | Modus | Vorher (Plan 01) | Nachher (Plan 05) |
|---|---|---|---|---|
| A1 `.hero .lead` (Fliesstext) | cz-facility.jpg | hell | 2,93:1 | **18,34:1** |
| A1 `.hero h1` (grosse Schrift) | cz-facility.jpg | hell | 3,14:1 | **19,65:1** |
| B2 `.shot p` (Fliesstext, Mittel ueber 19 Koerper) | — | hell | 3,16–3,55:1 | **16,03–19,43:1** |

## Jede Scrim-Heilung einzeln

| # | Stelle | Datei(en) | Was geaendert | Vorher (hell) | Nachher (hell) |
|---|---|---|---|---|---|
| 1 | `.hero__photo::after` | `assets/detail.css` + 19 Patch-Koerper (20 Dateien, Soll/Ist-Zahl vorab geprueft) | Verlauf-Stopp `var(--scrim-4) 55%,var(--bg)` → `var(--scrim-4) 55%,var(--scrim-4) 90%,var(--bg)` (Plateau statt sofortiger Interpolation Richtung `--bg`) | 2,60–3,06:1 (je Patch-Palette) | 12,05–19,59:1 |
| 2 | `.shot::after` | 19 Patch-Koerper (19 Dateien) | Derselbe Plateau-Fix: `var(--scrim-3) 60%,var(--bg)` → `var(--scrim-3) 60%,var(--scrim-3) 90%,var(--bg)` | 3,16–3,55:1 | 16,03–19,43:1 |
| 3 | `.fcard` (h3/p/.fk/.ftag + `::after`) | `src/components/topics/4-0-1-fight-for-pyro.astro` | `--veil`/`--veil-2`/`--text`/`--accent`/`--accent-2` → `--scrim-6`/`--scrim-1`/`--on-media`/`--on-media-dim`/`--accent-media`/`--accent-2-media` | 2,93:1 (geschaetzt anhand des Tokenfehlers, nicht separat vor-gemessen — Fund und Fix im selben Durchlauf) | 18,59–19,54:1 |
| 4 | `.sdb__sub` | `src/components/ships/ShipsOverview.astro` | Fixe Farbe `#dbe6ff` + generierter Hellmodus-Override `#4d5871` → `var(--on-media-dim)`, Override entfernt | 4,25:1 | 4,96:1 |

Keine Aenderung an `--ambient-opacity` (bleibt 0,5 dunkel / 0,4 hell, maschinell bestaetigt), an der Palette oder an der `--scrim-*`-Skala selbst (nur STOPP-Positionen bzw. welches Token an bestehenden Stufen verwendet wird).

## Negativkontrolle (Beweis, dass beide neuen Zusicherungen faellen koennen)

**Zusicherung 5 (Vollstaendigkeitswaechter):** `selectorFamilies` aus dem `A2-band`-Registry-Eintrag testweise entfernt (nur im Arbeitsverzeichnis, vor dem Commit) → `node scripts/verify-layers.mjs --closure` meldet `2 Selektor-Familie(n) ohne Registry-Eintrag: .band::before, .band::after` und schlaegt mit Code 1 fehl. Datei aus der Sicherung wiederhergestellt, danach wieder `GESCHLOSSEN ✓`.

**Zusicherung 4 (WCAG AA):** `--on-media-dim` in `dist/assets/theme.css` testweise von `#f4f7ff` auf `#3a3f4a` verdunkelt (nur die `dist/`-Kopie, `dist/` ist gitignored) → `npm run verify:layers` meldet 9 nicht vollstaendig gemessene/fehlgeschlagene Registry-Eintraege (`A1-hero, A2-band, A5-scrolly, C2-home-hero, D3-ships-overview-hero, D4-home-tool-tiles, D5-topic-fcard, B-hero, B-shot`) und schlaegt mit Code 1 fehl. `dist/assets/theme.css` aus der Sicherung wiederhergestellt, danach wieder `ALLE ZUSICHERUNGEN ERFUELLT ✓`.

Beide Tore koennen also nachweislich fehlschlagen, nicht nur bestehen — dieselbe Beweispflicht wie bei `verify:typo` (Phase 2, 02-07) und `verify:crafting`.

## Decisions Made

- Heilung ausschliesslich ueber lokale Scrim-Aenderungen (Verlauf-Stopp verschoben oder falscher Tokensatz korrigiert) — `--ambient-opacity` unveraendert, Palette unveraendert, `--scrim-*`-Skala nicht vereinheitlicht (bewusst in `<deferred>` belassen).
- Zusicherung 5 erkennt eine Selektor-Familie an vier textuellen Merkmalen (`content:''`, `position:absolute|fixed`, `inset:0`, ein `*-gradient()`-Hintergrund) — echte Elemente ohne `::before`/`::after` (z. B. `archive.css` `.space`, `.dsr::after` im Konto-Bereich, `data-page.css` `.dp::before`, `ShipsOverview.astro` `.sdb::before`) fallen bewusst NICHT darunter. Als benannte Grenze dokumentiert (`X-ambient-family` in `layer-registry.mjs`), nicht stillschweigend uebersehen — vier unabhaengige Subsysteme teilen dasselbe Muster eines sehr blassen, hinter einer eigenen Flaeche liegenden Ambiente-Backdrops.
- `.node--point .node__art` (C3b) wurde beim ersten Messlauf faelschlich als Text-auf-Foto-Stelle behandelt (3,20:1) — bei genauerem Lesen des Markups stellte sich heraus, dass `.node__tag` als FLEX-GESCHWISTER von `.node__body` neben dem Foto sitzt, nicht darueber (anders als `.node--major`, wo `.node__body` das Foto absolut ueberlagert). Auf Kontrollfall korrigiert, BEVOR die (falsche) Zahl in eine Healing-Massnahme haette einfliessen koennen.
- D1-D5 (von Zusicherung 5 selbst gefundene Varianten) wurden in diesem Plan mitgemessen und -geheilt, nicht auf einen spaeteren Plan verschoben — ein neuer Fund, der nur registriert aber nicht auf die Marke gebracht wird, waere ein Etikettenschwindel gegenueber dem, was Zusicherung 4 verspricht.
- `layer-registry.mjs` traegt den Scrim VERLAUF als eigenes, deklaratives Modell (Stops je Ebene), das mit der echten CSS-Deklaration UEBEREINSTIMMEN MUSS — bei der Heilung wurden beide (CSS-Text und Registry-Modell) synchron geaendert; ein erster Versuch, nur die CSS-Datei zu aendern, zeigte weiterhin die alten (falschen) Messwerte, bis das Modell nachgezogen wurde. Als Betriebshinweis im Kopfkommentar von `SCRIM_LAYERS` festgehalten.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `.fcard` (4-0-1-fight-for-pyro.astro) benutzte Flaechen-Tokens ueber einem Foto**
- **Found during:** Task 1, erster Lauf von Zusicherung 5 gegen den vollen Bestand (`.fcard::after` als unbekannte Selektor-Familie gemeldet)
- **Issue:** `.fcard` (drei Feature-Karten auf dieser einen Themenseite) benutzte `--veil`/`--veil-2` als Scrim und `--text`/`--accent`/`--accent-2` als Textfarbe ueber einem Foto (`.fbg`). `--veil`/`--veil-2` sind im Hellmodus absichtlich fast durchsichtig (Flaechen-Design, siehe theme.css-Kommentar "leichte Eintruebung statt Abdunklung") — ueber einem Foto blieb das Bild darunter fast unveraendert hell, waehrend `--text` im Hellmodus dunkel wird.
- **Fix:** Auf `--scrim-6`/`--scrim-1` (Scrim) und `--on-media`/`--on-media-dim`/`--accent-media`/`--accent-2-media` (Text) umgestellt — denselben Tokensatz, den jeder andere Text-auf-Foto-Archetyp in diesem Bestand benutzt.
- **Files modified:** `src/components/topics/4-0-1-fight-for-pyro.astro`
- **Verification:** `node scripts/verify-layers.mjs` meldet D5 jetzt 18,59–19,54:1 in beiden Modi.
- **Committed in:** `a3d138e`

**2. [Rule 1 - Bug] `.sdb__sub` (Ships Overview) trug eine fixe Farbe mit falschem generiertem Hellmodus-Override**
- **Found during:** Task 1, Messung des von Zusicherung 5 gefundenen D3-Eintrags
- **Issue:** `color:#dbe6ff` (fix) plus ein von `scripts/build-light-overrides.mjs` generierter Hellmodus-Override `#4d5871` (dunkel) — der Generator behandelte `.sdb__sub` wie Flaechentext, obwohl `.sdb__hero` ein Foto-Hero ist (`.sdb__hero::before` traegt das Bild). Hellmodus-Kontrast lag bei 4,25:1, knapp unter der Marke.
- **Fix:** Basisregel auf `var(--on-media-dim)` umgestellt (theme-invariant, kein Hellmodus-Unterschied noetig); der generierte Override-Eintrag entfernt, mit Begruendungskommentar an seiner Stelle.
- **Files modified:** `src/components/ships/ShipsOverview.astro`
- **Verification:** 4,96:1 im Hellmodus (Marke 4,5:1).
- **Committed in:** `a3d138e`

**3. [Rule 1 - Bug] C3b (`.node--point .node__art`) faelschlich als Text-auf-Foto-Stelle registriert**
- **Found during:** Task 1, beim genaueren Lesen von `src/components/PatchArchive.astro` nach dem ersten (fehlschlagenden) Messlauf
- **Issue:** Erste Fassung der Registry mass C3b wie C3a (Text ueberlagert Foto) und erhielt 3,20:1 in beiden Modi — unter der Marke. Das Markup zeigt aber, dass `.node__art` (figure) und `.node__body` (div, traegt `.node__tag`) bei `.node--point` FLEX-GESCHWISTER sind (`display:flex;align-items:stretch`), nicht ineinander verschachtelt wie bei `.node--major`.
- **Fix:** Auf Kontrollfall (`kind:'flat'`, `controlCase:true`) umgestellt, mit Begruendung im Registry-Eintrag.
- **Files modified:** `scripts/lib/layer-registry.mjs`
- **Verification:** Kein AA-Fehlschlag mehr fuer C3b; C3a (die tatsaechliche Text-auf-Foto-Stelle) bleibt scharf gemessen (16,91:1 beide Modi).
- **Committed in:** `d82741e`

---

**Total deviations:** 3 Rule-1-Autofixes (zwei echte Kontrastbugs in Fremdcode, ein Registrierungsfehler im eigenen Modell vor dem ersten Commit korrigiert), 0 Abweichungen von einer expliziten Plan-Vorgabe.
**Impact on plan:** Erweitert den Umfang um fuenf von der Vollstaendigkeitspruefung selbst gefundene Archetyp-Varianten (D1-D5) — genau das, was Zusicherung 5 leisten soll. Keine Aenderung an `--ambient-opacity`, der Palette oder der `--scrim-*`-Skala.

## Issues Encountered

- Zwei Regex-Fallen beim Lesen bestehender CSS-Dateien fuer die Fallback-Palette: (1) `assets/detail.css`s Kopfkommentar enthaelt den woertlichen Text `:root{}` als Beispielreferenz — ohne `stripComments()` VOR der Regex fing das die falsche (leere) Stelle. (2) `assets/theme.css` deklariert `:root[data-theme='light']` ZWEIMAL (Zeile 48 nur `color-scheme`, Zeile 117 die eigentliche Palette) — ein simpler erster Treffer traf die falsche, leere Stelle. Beide durch eine "suche den Block, der `--bg` tatsaechlich definiert"-Helper-Funktion geloest, nicht durch Annahme der Zeilenreihenfolge.
- CSS-Kommentar-Falle in eigener Arbeit: ein selbst geschriebener Erklaerkommentar enthielt `--scrim-*/--on-media*` — das `*` gefolgt von `/` schloss den CSS-Kommentar vorzeitig (`*/`  ist das Kommentarende), wodurch der naechste Registry-Fund als Textfragment aus dem Kommentar gemeldet wurde. Umformuliert, um kein `*` unmittelbar vor `/` stehen zu haben.
- `assets/theme.css`s `:root[data-theme='light'] {` traegt ein Leerzeichen vor der `{` (anders als die generierten `:root[data-theme="light"]{`-Bloecke ohne Leerzeichen in Patch-/Themenseiten) — alle Root-Block-Regexe brauchten `\s*` vor der `{`, um beide Schreibweisen zu treffen.
- `--veil`/`--veil-2` sind (anders als `--scrim-*`/`--on-media*`) mode-ABHAENGIG — im theme.css-Kommentar "in BEIDEN Modi dunkel" steht nur bei den Medien-Tokens, nicht bei den Flaechen-Schleiern. Das Registry-Modell musste `veil`/`veil2` deshalb als eigenes, pro-Modus aufgeloestes Tokenpaar fuehren statt sie wie Medien-Tokens zu behandeln.
- Das PLAN-eigene Verify-Snippet fuer WINDOWS.md id 6 (`.replace(/^[\s\S]*?\[/,'[')`) findet die ERSTE `[` im ganzen Dokument — die trifft auf `turrets[]` in Eintrag id 1s Beschreibungstext, nicht auf den JSON-Code-Block. Aequivalent per direkter Extraktion zwischen den ```json-Zaeunen validiert (25→6 Eintraege, id 6 vorhanden, `kind`/`status`/`phase`/Beschreibungslaenge korrekt) — dieselbe Aussage, robusterer Weg. Dokumentiert, nicht stillschweigend uebersprungen.

## User Setup Required

None — keine externe Dienstkonfiguration noetig.

## Next Phase Readiness

- **LAYER-01 und LAYER-02 sind vollstaendig abgetragen** — die Phase ist technisch fertig (5/5 Plaene).
- **Phase 3 bleibt NICHT als „Complete" markiert**, solange WINDOWS.md id 6 (Sichtrunde zu Erfolgskriterium 3) offen ist — derselbe Praezedenzfall wie Phase 1.2 (id 2) und Phase 2 (id 3/5).
- **Beobachtete Grenze, nicht geloest:** vier unabhaengige Subsysteme (`archive.css` `.space`, Konto-Bereich `.dsr::after`, `data-page.css` `.dp::before` auf ~17.000 Item-/Crafting-Seiten, `ShipsOverview.astro` `.sdb::before`) tragen einen sehr blassen, globalen Ambiente-Backdrop HINTER einer eigenen Flaeche — strukturell anders als das vormalige `body::after` (D-01), aber ob sie denselben Class-B-Fehler in einer noch nicht gefundenen Kombination tragen, wurde nicht ueberprueft (kein Registry-Eintrag noetig, weil sie keine Pseudo-Elemente sind und Zusicherung 5 sie deshalb nicht findet). Kandidat fuer eine spaetere, eigene Pruefung, kein Blocker fuer diese Phase.
- **Offen fuer den Betreiber:** WINDOWS.md id 6, sechs Sichtbloecke, DE+EN, beide Farbmodi, 1280px und 360px.

---
*Phase: 03-ueberlagerungen-entstapeln*
*Completed: 2026-08-08*

## Self-Check: PASSED

All 8 claimed files found on disk (`scripts/lib/layer-registry.mjs`, `scripts/verify-layers.mjs`, `assets/detail.css`, `src/components/ships/ShipsOverview.astro`, `src/components/topics/4-0-1-fight-for-pyro.astro`, `Dockerfile`, `.planning/REQUIREMENTS.md`, `.planning/WINDOWS.md`); all 3 claimed task commits found in git log (`d82741e`, `a3d138e`, `4073a6a`).
