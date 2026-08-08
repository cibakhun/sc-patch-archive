---
phase: 04-sprachparitaet-absichern
plan: 01
subsystem: testing
tags: [build-gate, node-test, astro, dom-fingerprint, i18n]

requires:
  - phase: 03-vollstaendige-aufzaehlung-plus-aa-scharf
    provides: "verify-layers.mjs Registry-/Vollstaendigkeitswaechter-Muster (EXCLUSIONS, --report/--json)"
provides:
  - "npm run verify:sync — Struktur-Fingerabdruck-Tor ueber alle 8.678 gebauten EN/DE-Seitenpaare (D-01/D-02)"
  - "scripts/lib/page-pairs.mjs — die dreifach kopierte EN/DE-Paarungslogik als EIN Modul"
  - "scripts/lib/sync-exclusions.mjs — benannte Ausnahmen-Registry (bisher ein Eintrag: X-langsw-order)"
  - "Beziffertes Erstbefund (Task 1) + ausgefuehrte, dreifache Negativkontrolle (Task 2) mit SHA-256-Beleg"
affects: [04-02, 04-03]

tech-stack:
  added: []
  patterns:
    - "Registry-getriebene benannte Ausnahmen (Vorbild layer-registry.mjs EXCLUSIONS), hier fuer Struktur statt Farbe"
    - "Ausnahmen VOR dem linearen Gleichheitstest anwenden, teure Umfeld-Diagnose nur fuer das gefallene Paar (Performance-Vorgabe aus dem Plan)"

key-files:
  created:
    - scripts/lib/page-pairs.mjs
    - scripts/lib/sync-exclusions.mjs
    - scripts/verify-sync.mjs
    - tests/e2e/sync-fingerprint.test.js
  modified:
    - package.json

key-decisions:
  - "Fingerabdruck = tag.class1.class2 in Autorenreihenfolge, ohne Sortieren, ohne Tiefe — die Recherche zeigt, dass Sortieren/Tiefe ueber alle 8.678 Paare KEIN zusaetzliches Signal liefern (D-01 empirisch bestaetigt)"
  - "Sprachumschalter-Ausnahme ist ein per-Instanz-Mengenvergleich (X-langsw-order), KEIN Seitenausschluss — belegt durch Bruch C der Negativkontrolle"
  - "Eigene Paarungs-Untergrenze 5000 (zusaetzlich zur geerbten 60) ist ausdruecklich eine Plausibilitaets-, keine Sperrklinken-Pruefung (D-03)"
  - "Die vier diff=4-Paare aus 04-RESEARCH.md (missionen.html, schiffe.html, topics/crafting.html, rank-cargo-haul-emptymission.html) sind bestaetigt ein Messartefakt der Recherche-Sonde — mit dem echten Tor fallen alle vier nach der langsw-Ausnahme auf null"

requirements-completed: [SYNC-02]

coverage:
  - id: D1
    description: "npm run verify:sync liest JEDES gebaute EN/DE-Seitenpaar (8.678), zieht einen textfreien Struktur-Fingerabdruck (D-01) und vergleicht reihenfolgeempfindlich"
    requirement: "SYNC-02"
    verification:
      - kind: unit
        ref: "tests/e2e/sync-fingerprint.test.js — 9 Rechenfaelle fuer tokenize/splitLangsw/cutRegion"
        status: pass
      - kind: integration
        ref: "node scripts/verify-sync.mjs --report (gegen echten Build) — 8678 Paare, 6966 zeichengleich, 1631 durch X-langsw-order erklaert, 81 unerklaerter Rest"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sprachumschalter ist NICHT seitenweit ausgenommen — Kinder werden je Instanz als Menge verglichen, ein fehlendes a.langsw__opt faellt weiterhin auf"
    requirement: "SYNC-02"
    verification:
      - kind: unit
        ref: "tests/e2e/sync-fingerprint.test.js — 'EN/DE-Anordnung liefern dieselbe Menge; entferntes a.langsw__opt liefert eine andere'"
        status: pass
      - kind: integration
        ref: "Negativkontrolle Bruch C (Commit 7f401cd) — a.langsw__opt einer Instanz entfernt, Exit 1, SHA-256 wiederhergestellt"
        status: pass
    human_judgment: false
  - id: D3
    description: "Negativkontrolle: drei absichtliche Brueche (fehlendes Element, vertauschte Reihenfolge, beschaedigter Umschalter), drei Fehlschlaege, Bestand danach zeichengleich wiederhergestellt"
    requirement: "SYNC-02"
    verification:
      - kind: integration
        ref: "Commit 7f401cd — Bruch A/B/C, je Exit 1 + SHA-256-Vorher/Nachher-Gleichheit + abschliessender --report zeichengleich zum Task-1-Bericht"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-09
status: complete
---

# Phase 4 Plan 1: Struktur-Fingerabdruck, Ausnahmen-Registry, Tor, Negativkontrolle Summary

**`npm run verify:sync` vergleicht alle 8.678 gebauten EN/DE-Seitenpaare per Struktur-Fingerabdruck (tag.class, reihenfolgeempfindlich, ohne Text) mit einer einzigen benannten Ausnahme fuer den Sprachumschalter — Erstbefund 81 unerklaerte Paare, Negativkontrolle 3/3 belegt.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-08T23:53:00Z (nach ba596a6)
- **Completed:** 2026-08-09T00:08:04Z (Commit 7f401cd) + Nachlauf-Regressionschecks
- **Tasks:** 2/2 completed
- **Files modified:** 5 (4 neu, 1 geaendert)

## Accomplishments

- `scripts/lib/page-pairs.mjs` zieht die dreifach kopierte EN/DE-Paarungslogik (aus `verify-fx.mjs`,
  `verify-help.mjs`, `verify-typo-motion.mjs`) in EIN Modul — Verhalten der drei Vorgaenger bewusst
  UNVERAENDERT (Plan 02 haengt sie erst um, dieser Plan aendert nur, wo der Code liegt).
- `scripts/lib/sync-exclusions.mjs` fuehrt eine benannte Ausnahmen-Registry (Vorbild
  `layer-registry.mjs`), mit genau EINEM Eintrag in diesem Plan: `X-langsw-order`.
- `scripts/verify-sync.mjs` ist das Tor: Paarung, `tokenize()` (D-01), `splitLangsw()` (die enge
  Sprachumschalter-Ausnahme), Vollstaendigkeitswaechter, Soll/Ist-Bericht, `--report`, Laufzeitausgabe.
  Reines Node (`node:fs`, `node:path`, `node:url`), kein neues Paket — wie alle vier Vorgaenger.
- `tests/e2e/sync-fingerprint.test.js`: 9 Rechenfaelle fuer `tokenize`/`splitLangsw`/`cutRegion`, alle gruen.
- **Erstbefund gegen den echten Build** (8.678 Paare): 6.966 (80,3 %) zeichengleich, 1.631 (18,8 %)
  allein durch `X-langsw-order` erklaert, **81 unerklaerter Rest** — exakt die von 04-RESEARCH.md
  vorhergesagte Verteilung (78 Item-Beschreibung, 2 Onepager-DE-only, 1 Impressum-MStV).
- **Die vier `diff=4`-Verdachtspaare aus `<measured_baseline>` einzeln nachgeprueft**: `missionen.html`,
  `schiffe.html`, `topics/crafting.html`, `missionen/rank-cargo-haul-emptymission.html` fallen mit dem
  ECHTEN Tor (im Gegensatz zur Naeherungs-Sonde der Recherche) alle vier sauber auf 0 nach Anwendung
  der `X-langsw-order`-Ausnahme — bestaetigt ein Messartefakt der Recherche-Sonde, KEIN fuenftes Muster.
- **Negativkontrolle vollstaendig automatisiert, alle DREI Brueche** (nicht nur der eine, den der
  Plan-Text im `<verify>`-Block vorgab) — siehe `## Negativkontrolle` unten.
- Keine Regression: `npm run verify:fx`, `verify:help`, `verify:typo`, `verify:layers` alle
  unveraendert gruen gegen denselben Build (siehe `## Regressionspruefung`).

## Negativkontrolle (Erfolgskriterium 2 der Roadmap — ausgefuehrt, nicht behauptet)

Alle drei Brueche an `dist/de/feedback.html` (Bauartefakt, gitignored — keine bleibende Aenderung
im Repository), streng in der vorgegebenen Reihenfolge (SHA-256 sichern -> brechen -> `verify-sync`
laufen lassen -> zurueckspielen -> SHA-256 gegenpruefen), automatisiert in einem Wegwerf-Node-Skript:

| Bruch | Was | Exit | Erste Fehlerzeile | SHA-256 vorher = nachher |
|---|---|---|---|---|
| A — fehlendes Element | ein `<p>` (`.lead`) aus dem Hauptteil entfernt, kein `langsw`-Element | **1** | `FEHLER: 82 Paar(e) mit unerklaerter Strukturabweichung:` | **ja** (`9049ac9…2e99`) |
| B — vertauschte Reihenfolge | zwei benachbarte `.fbx-field`-Bloecke (Nachricht/E-Mail) getauscht, KEINE Element-Zaehlung veraendert | **1** | `FEHLER: 82 Paar(e) mit unerklaerter Strukturabweichung:` | **ja** (`9049ac9…2e99`) |
| C — beschaedigter Sprachumschalter | `a.langsw__opt` EINER der beiden `.langsw`-Instanzen (Kopfleiste) entfernt | **1** | `FEHLER: 82 Paar(e) mit unerklaerter Strukturabweichung:` | **ja** (`9049ac9…2e99`) |

Bruch B ist der wichtigste der drei: er veraendert **keine** Element-Zaehlung, nur die Reihenfolge —
genau der Fall, den die von D-01 verworfene reine Zaehlung nicht gesehen haette. Bruch C belegt, dass
`X-langsw-order` ein **enger** Mengenvergleich je Instanz ist, kein blinder Seitenausschluss — waere
`.langsw` seitenweit ausgenommen, waere dieser Bruch unentdeckt geblieben.

Nach dem dritten Rueckbau ist `node scripts/verify-sync.mjs --report` **zeichengleich** (bis auf die
Laufzeit-Zeile) zum Bericht aus Task 1: 8.678 Paare, 6.966 zeichengleich, 1.631 durch
`X-langsw-order` erklaert, 81 unerklaerter Rest — der Bestand ist unveraendert. Vollstaendiger
Beleg (Befehl, Exit-Code, Fehlerzeile, SHA-256 je Bruch) steht im Commit `7f401cd`.

## Task Commits

1. **Task 1: Die ganze Kette — Paarung, Fingerabdruck, langsw-Sonderfall, Bericht, Tor** - `ef42f41` (feat)
2. **Task 2: Negativkontrolle — drei absichtliche Brueche, drei Fehlschlaege** - `7f401cd` (test, `--allow-empty` — keine bleibenden Dateiaenderungen, `dist/` ist Bauartefakt und gitignored)

**Plan metadata:** siehe Abschluss-Commit dieses SUMMARY.

_Hinweis: Task 2 hat laut Plan bewusst KEINE bleibenden Dateiaenderungen (`dist/` wird nach jedem
Bruch byteweise zurueckgespielt) — der Commit dokumentiert den Beleg in der Nachricht._

## Files Created/Modified

- `scripts/lib/page-pairs.mjs` - EN/DE-Paarungslogik als EIN Modul (`findPagePairs`, `assertMinimumPairs`)
- `scripts/lib/sync-exclusions.mjs` - benannte Ausnahmen-Registry (`X-langsw-order`)
- `scripts/verify-sync.mjs` - das Tor: Paarung, Fingerabdruck, langsw-Sonderfall, Bericht, Exit-Code
- `tests/e2e/sync-fingerprint.test.js` - 9 Rechenfaelle fuer die drei exportierten reinen Funktionen
- `package.json` - `verify:sync`-Eintrag, unmittelbar nach `verify:layers`

## Regressionspruefung

Alle vier bestehenden Tore gegen denselben Build erneut gelaufen, alle gruen (dieser Plan fasst sie
nicht an — Plan 02 haengt sie auf `page-pairs.mjs` um):

- `node scripts/verify-fx.mjs` — Exit 0, ALLE ZUSICHERUNGEN ERFUELLT
- `node scripts/verify-help.mjs` — Exit 0, ALLE ZUSICHERUNGEN ERFUELLT
- `node scripts/verify-typo-motion.mjs` — Exit 0, ALLE ZUSICHERUNGEN ERFUELLT
- `node scripts/verify-layers.mjs` — Exit 0, 25/25 Registry-Eintraege vollstaendig gemessen

## Decisions Made

- **Fingerabdruck-Definition**: `tag.class1.class2` in Autorenreihenfolge, kein Sortieren, keine
  Verschachtelungstiefe — 04-RESEARCH.md hat das ueber alle 8.678 Paare gegen vier Alternativen
  gerechnet (sortiert/tiefenbewusst liefern identische Ergebnisse, nur-Tagname ist halb so scharf,
  reine Zaehlung sieht 1.631 von 1.712 Abweichungen nicht). Kopfkommentar der Datei haelt die
  Begruendung fest, damit sie spaeter niemand "verbessert".
- **X-langsw-order als per-Instanz-Mengenvergleich, kein Seitenausschluss** — CONTEXT.md warnt
  ausdruecklich, dass eine stillschweigende (oder zu breite) Ausnahme dasselbe ist wie ein blindes
  Tor. Bruch C der Negativkontrolle ist der direkte Beleg, dass diese Enge tatsaechlich etwas bringt.
- **Eigene Paarungs-Untergrenze 5000**, ausdruecklich als Plausibilitaets- nicht Sperrklinken-Pruefung
  kommentiert (D-03 verwirft das Einfrieren des Ist-Stands) — die geerbte 60er-Grenze der drei
  Vorgaenger bleibt unveraendert als eigene Zusicherung stehen.
- **Die drei weiteren, bereits von der Recherche identifizierten Ausnahmen (Onepager-DE-only,
  Impressum-MStV, Item-Beschreibungsluecke) werden in DIESEM Plan bewusst NICHT vorweggenommen** —
  der Plan-Text ist hier explizit: sonst misst der Erstbefund nicht mehr den unveraenderten Bestand.
  Das ist Plan 02s Aufgabe (D-03: "erst beheben, dann scharf").

## Deviations from Plan

### Auto-fixed Issues

**1. [Orchestrator-Anweisung — Negativkontrolle vollstaendig automatisieren] Alle drei Brueche statt nur Bruch A**
- **Found during:** Vorbereitung von Task 2
- **Issue:** Der `<verify>`-Block von Task 2 in 04-01-PLAN.md automatisiert nur Bruch A (`node -e`
  im Plan-Text); Bruch B und C sind im Plan-Text als reine Handlungsanweisung ("Vorgehen je Bruch")
  formuliert, ohne eigenes ausfuehrbares Skript. Der Orchestrator-Hinweis fordert ausdruecklich, ALLE
  DREI Brueche in den ausfuehrbaren Verify-Schritt aufzunehmen, mit SHA-256-Beleg je Bruch — Bruch C
  ist der einzige Beleg dafuer, dass `X-langsw-order` ein enger Mengenvergleich und kein
  Seitenausschluss ist.
- **Fix:** Ein Wegwerf-Node-Skript (nicht Teil des Repos) hat alle drei Brueche nacheinander
  automatisiert ausgefuehrt, mit SHA-256-Vorher/Nachher-Beleg je Bruch und einem abschliessenden
  `--report`-Vergleich gegen den Task-1-Bericht.
- **Files modified:** keine (nur `dist/de/feedback.html`, byteweise wiederhergestellt, Bauartefakt)
- **Verification:** siehe `## Negativkontrolle` oben; SHA-256 je Bruch identisch, `--report` nach
  allen drei Ruecknahmen zeichengleich zum Ausgangsbericht.
- **Committed in:** `7f401cd`

---

**Total deviations:** 1 (Orchestrator-Anweisung, keine Rule-1/2/3-Bugfix-Deviation)
**Impact on plan:** Kein Scope-Creep — reine Erweiterung der Beleg-Tiefe fuer ein bereits im Plan
gefordertes Erfolgskriterium, keine Aenderung an Produktionscode.

## Issues Encountered

Keine. Der Kopfkommentar von `page-pairs.mjs` musste einmal umformuliert werden, weil der
urspruengliche Text die Zeichenfolge `**/*.html` enthielt — in einem `/* ... */`-Blockkommentar
schliesst `*/` den Kommentar vorzeitig (SyntaxError beim Import). Sofort erkannt (RED-Lauf der
Tests) und behoben, bevor irgendein Task-Commit stattfand — kein Deviation-Eintrag, da vor dem
ersten Commit korrigiert.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Next Phase Readiness

`npm run verify:sync` und `npm run verify:sync -- --report` stehen bereit fuer Plan 02, das den
81er-Rest behebt (Onepager-DE-only, Impressum-MStV, Item-Beschreibungsluecke gemaess D-05) und die
drei bestehenden Tore (`verify-fx`, `verify-help`, `verify-typo-motion`) auf `page-pairs.mjs`
umhaengt. `verify:sync` ist **bewusst noch nicht** im Dockerfile — das ist Plan 03 (D-03: "erst
beheben, dann scharf"). Kein Blocker.

---
*Phase: 04-sprachparitaet-absichern*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: `scripts/lib/page-pairs.mjs`
- FOUND: `scripts/lib/sync-exclusions.mjs`
- FOUND: `scripts/verify-sync.mjs`
- FOUND: `tests/e2e/sync-fingerprint.test.js`
- FOUND: `.planning/phases/04-sprachparitaet-absichern/04-01-SUMMARY.md`
- FOUND commit: `ef42f41` (feat(04-01): verify:sync …)
- FOUND commit: `7f401cd` (test(04-01): Negativkontrolle …)
- FOUND: `"verify:sync": "node scripts/verify-sync.mjs"` in `package.json`
