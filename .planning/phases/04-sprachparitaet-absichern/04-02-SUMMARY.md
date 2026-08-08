---
phase: 04-sprachparitaet-absichern
plan: 02
subsystem: testing
tags: [i18n, build-gate, astro, item-data, legal-page]

requires:
  - phase: 04-sprachparitaet-absichern
    provides: "04-01: npm run verify:sync — Struktur-Fingerabdruck-Tor, scripts/lib/page-pairs.mjs, scripts/lib/sync-exclusions.mjs, 81 unerklaerter Erstbefund"
provides:
  - "src/lib/items.ts description() haengt an g.desc — D-05 vollzogen, 79 Items ohne englische Quelle zeigen die Beschreibung in KEINER Sprache mehr"
  - "scripts/lib/sync-exclusions.mjs — zwei neue benannte cut-region-Ausnahmen (X-onepager-de-only, X-impressum-mstv) fuer die einzigen zwei verbleibenden, quellbelegten Abweichungen"
  - "scripts/verify-sync.mjs — Zusicherung 5 (Zombie-Waechter): jede Ausnahme muss mindestens ein Paar erklaert haben, sonst FEHLER"
  - "npm run verify:sync meldet 0 unerklaerte Abweichungen ueber alle 8678 gebauten Paare, Exit 0 — Plan 03 darf es jetzt blockierend ins Dockerfile haengen"
  - "verify-fx.mjs, verify-help.mjs, verify-typo-motion.mjs beziehen die EN/DE-Paarung aus scripts/lib/page-pairs.mjs statt aus drei Kopien"
affects: [04-03]

tech-stack:
  added: []
  patterns:
    - "cut-region-Ausnahmen (mode:'cut-region' in sync-exclusions.mjs) schneiden VOR dem Tokenisieren eine per Quellstelle verankerte Region aus einer Seite eines Paars — cutRegion() aus Plan 01 bleibt die einzige Ausschneide-Implementierung; der Trick fuer 'Ueberschrift + folgender Absatz' ist ein openTagPattern, das am <h2> startet, kombiniert mit tagName:'p' (cutRegion() depth-trackt dann nur <p>-Tags ab diesem Index)"
    - "Zombie-Waechter (Zusicherung 5): jede Registry-Ausnahme traegt einen Nutzungszaehler; 0 Treffer = FEHLER statt stiller Karteileiche — Gegenrichtung zu Zusicherung 4 (unbenannte Abweichung)"

key-files:
  created: []
  modified:
    - src/lib/items.ts
    - scripts/lib/sync-exclusions.mjs
    - scripts/verify-sync.mjs
    - src/pages/de/impressum.astro
    - scripts/verify-fx.mjs
    - scripts/verify-help.mjs
    - scripts/verify-typo-motion.mjs

key-decisions:
  - "D-05 vollzogen woertlich wie in CONTEXT.md verankert: description() liefert null wenn g.desc fehlt, unabhaengig von lang — descDe gilt als Uebersetzung eines vorhandenen desc, nicht als eigene Quelle. Kein englischer Text erfunden oder uebersetzt (Verifikation vergleicht ausschliesslich dp-desc-ELEMENTZAHL, nie Textinhalt)."
  - "Das zusaetzliche p.muted auf der ENGLISCHEN Impressum-Seite ('German law … requires this provider identification') war unbelegte Drift (keine Quellkommentar-Absicht) und wurde nach Regel 2 der residue_argument-Entscheidungsregel BEHOBEN (deutsches Gegenstueck in src/pages/de/impressum.astro ergaenzt), nicht ausgenommen — nur die rechtlich zwingende MStV-Ueberschrift samt Absatz bleibt eine benannte Ausnahme."
  - "cutRegion() aus Plan 01 bleibt die EINZIGE Ausschneide-Implementierung: X-impressum-mstv nutzt tagName:'p' mit einem openTagPattern, der bereits am <h2> beginnt, statt eine zweite Funktion fuer 'zwei benachbarte, verschiedenartige Tags' zu schreiben."
  - "Beim woertlichen Vorher-Vergleich (Task 3, Plan-Vorgabe) gefunden: verify-help.mjs war die einzige der drei Kopien OHNE die '< 60 Paare'-Plausibilitaetsgrenze. Die Vereinheitlichung schliesst diese Luecke (macht die Zusicherung staerker, nicht schwaecher, D-02) statt sie fortzuschreiben."

requirements-completed: [SYNC-02]

coverage:
  - id: D1
    description: "description(i, lang) in src/lib/items.ts liefert fuer Items ohne englische Quelle (g.desc fehlt) in BEIDEN Sprachen null — D-05 vollzogen, kein erfundener oder uebersetzter Spieltext"
    requirement: "SYNC-02"
    verification:
      - kind: integration
        ref: "node -e Skript aus 04-02-PLAN.md Task 1 <verify> gegen dist/items/hardy-boots.html + dist/de/items/hardy-boots.html — dp-desc EN=DE=0"
        status: pass
      - kind: integration
        ref: "node -e Katalog-Erhebung gegen assets/universal-items.json — 79 Items mit descDe ohne desc, gegen die 78 gebauten Paare abgeglichen (Differenz erklaert: origin-jumpworks-85x-remote-turret hat keine eigene Detailseite, isIndexable() liefert false mangels obtain/guide/variants/stats)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zwei benannte cut-region-Ausnahmen (X-onepager-de-only, X-impressum-mstv) decken die verbleibenden, quellbelegten Abweichungen ab; die unbelegte Drift (p.muted auf der EN-Impressum-Seite) ist behoben, nicht ausgenommen"
    requirement: "SYNC-02"
    verification:
      - kind: unit
        ref: "node -e Begruendungslaenge-Check aus 04-02-PLAN.md Task 2 <verify> — alle drei EXCLUSIONS-Eintraege >= 120 Zeichen Begruendung"
        status: pass
      - kind: integration
        ref: "node scripts/verify-sync.mjs (gegen echten Build) — Exit 0, 8678 Paare, 0 unerklaerter Rest, Zombie-Waechter: X-langsw-order 1634, X-onepager-de-only 2, X-impressum-mstv 1 (keine Ausnahme trifft ins Leere)"
        status: pass
      - kind: unit
        ref: "node --test tests/e2e/sync-fingerprint.test.js — 9/9 gruen, unveraendert seit Plan 01"
        status: pass
    human_judgment: false
  - id: D3
    description: "verify-fx.mjs, verify-help.mjs, verify-typo-motion.mjs beziehen die EN/DE-Paarung aus scripts/lib/page-pairs.mjs statt aus drei separaten Kopien, ohne schwaecher zu werden"
    requirement: "SYNC-02"
    verification:
      - kind: integration
        ref: "Vorher/Nachher-Diff gegen denselben gebauten dist/-Stand: git-show-Originalkopien vs. umgehaengte Fassungen — alle drei Ausgaben zeichengleich (diff liefert keine Zeilen), inkl. Paarzahl 8678 je Tor"
        status: pass
      - kind: unit
        ref: "node -e Import-Check aus 04-02-PLAN.md Task 3 <verify> — alle drei Dateien importieren page-pairs.mjs"
        status: pass
      - kind: e2e
        ref: "npm run test:e2e — 234/234 gruen"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-09
status: complete
---

# Phase 4 Plan 2: D-05 vollzogen, Restabweichungen benannt, Paarungslogik vereinheitlicht Summary

**`npm run verify:sync` meldet 0 unerklaerte Abweichungen ueber alle 8678 gebauten EN/DE-Paare (Exit 0) — die 79-Item-Beschreibungsluecke ist nach D-05 symmetrisch geloest, zwei quellbelegte Restabweichungen sind benannt und durch einen Zombie-Waechter abgesichert, und die dreifach kopierte Seitenpaarung ist jetzt einmalig.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-09T00:28:00Z
- **Completed:** 2026-08-09T00:58:41Z
- **Tasks:** 3/3 completed
- **Files modified:** 7

## Accomplishments

- **D-05 vollzogen** (Task 1): `description(i, lang)` in `src/lib/items.ts` liefert `null`, wenn `g.desc`
  (die englische Quelle) fehlt — unabhaengig von `lang`. Betrifft 79 Items, deren LOCID-Schluessel in
  CIGs `Localization/english/global.ini` vollstaendig fehlt. `descDe` gilt jetzt als Uebersetzung
  eines vorhandenen `desc`, nicht als eigenstaendige Quelle; die Rueckfallrichtung (4.992 Items mit
  `desc` ohne `descDe`) bleibt unveraendert. Kein englischer Text wurde erfunden oder uebersetzt —
  die Verifikation vergleicht ausschliesslich die Zahl der `dp-desc`-Elemente, nie Textinhalt.
- **Katalog- gegen Build-Zahl abgeglichen**: 79 Items mit `descDe` ohne `desc` im Katalog, aber nur
  78 gebaute Paare in der Erstbefund-Gruppe. Erklaerte Differenz: `origin-jumpworks-85x-remote-turret`
  hat leeres `obtain`, kein `guide`, keine `variants`, keine `stats` — faellt durch die
  vorbestehende Thin-Content-Schwelle `isIndexable()` in `src/lib/items.ts` und bekommt deshalb
  gar keine eigene Detailseite. Unabhaengig von D-05, keine neue Luecke.
- **Nachpruefung der `dp-sec`-Symmetrie**: keines der 78 betroffenen Items verliert den GESAMTEN
  Spezifikations-Abschnitt (`chips.length>0 || stats.length>0 || desc` in `ItemDetail.astro:130`) —
  alle 78 tragen `chips` oder `stats`, die Seite verliert nur den Beschreibungsabsatz, nie die
  Ueberschrift "Spielwerte" selbst.
- **Zwei benannte cut-region-Ausnahmen** (Task 2, `scripts/lib/sync-exclusions.mjs`):
  - `X-onepager-de-only` — `section.opl-wrap` auf der DE-Fassung von `4-0-0-contested-zones` und
    `4-2-0-storm-breaker`; der Onepager existiert nur auf Deutsch, der Quellkommentar in beiden
    `.astro`-Dateien sagt das ausdruecklich.
  - `X-impressum-mstv` — die Ueberschrift "Verantwortlich fuer den Inhalt nach § 18 Abs. 2 MStV"
    samt unmittelbar folgendem Absatz auf der DE-Impressum-Seite; Pflichtangabe des deutschen
    Medienstaatsvertrags ohne englisches Gegenstueck. Der Anker haengt am WORTLAUT der Ueberschrift.
  - Beide nutzen `cutRegion()` aus Plan 01 unveraendert — fuer den MStV-Fall via dem Trick,
    `tagName:'p'` mit einem `openTagPattern` zu kombinieren, der bereits am `<h2>` beginnt: `cutRegion()`
    depth-trackt dann nur `<p>`-Tags ab diesem Index und schneidet Ueberschrift + Absatz in EINEM
    Aufruf — keine zweite Ausschneide-Implementierung noetig.
- **Drift behoben statt ausgenommen**: das zusaetzliche `p.muted` auf der ENGLISCHEN Impressum-Seite
  ("German law … requires this provider identification") war NICHT im Quelltext als Absicht belegt.
  Nach der residue_argument-Entscheidungsregel (Regel 2: nicht belegt = Drift, beheben statt
  ausschliessen) bekam `src/pages/de/impressum.astro` das deutsche Gegenstueck
  ("Deutsches Recht (§ 5 DDG) verlangt diese Anbieterkennzeichnung").
- **Zombie-Waechter** (neue Zusicherung 5 in `scripts/verify-sync.mjs`): jede Ausnahme aus
  `EXCLUSIONS` muss im laufenden Durchgang mindestens ein Paar erklaert bzw. tatsaechlich eine
  Region geschnitten haben, sonst FEHLER ("Ausnahme X-… trifft auf kein Paar mehr zu"). Ergebnis
  nach dem Build: `X-langsw-order` 1634, `X-onepager-de-only` 2, `X-impressum-mstv` 1 — keine
  Ausnahme trifft ins Leere.
- **Ergebnis: `node scripts/verify-sync.mjs` — Exit 0**, 8678 Paare, 7044 zeichengleich, 1634 durch
  `X-langsw-order` erklaert (darunter die 3 Paare, bei denen zusaetzlich eine cut-region-Ausnahme
  griff), **0 unerklaerter Rest**. Laufzeit ~42s.
- **Paarungslogik vereinheitlicht** (Task 3): `verify-fx.mjs`, `verify-help.mjs`,
  `verify-typo-motion.mjs` beziehen `findPagePairs()`/`assertMinimumPairs()` aus
  `scripts/lib/page-pairs.mjs` statt drei eigener Kopien. Die je eigene Vergleichslogik (Marker
  zaehlen, Hilfe-Marken, Skalen-Token) blieb unangetastet.
- **Vorher/Nachher-Beleg, gegen DENSELBEN gebauten Stand** (nicht gegen einen aelteren Build):
  Originalkopien der drei Skripte via `git show` extrahiert, gegen den aktuellen `dist/` gelaufen,
  mit den umgehaengten Fassungen verglichen — alle drei Ausgaben **zeichengleich** (`diff` liefert
  keine Zeilen), inklusive der ausgewiesenen Paarzahl (8678 je Tor).
- **Echter Befund beim woertlichen Vorher-Vergleich**: `verify-help.mjs` war die EINZIGE der drei
  Kopien OHNE die "< 60 Paare = Paarungslogik kaputt"-Untergrenze (`verify-fx.mjs` und
  `verify-typo-motion.mjs` hatten sie). Die Vereinheitlichung schliesst diese Luecke — macht die
  Zusicherung STAERKER, nicht schwaecher (D-02) — und aendert die Ausgabe in diesem Lauf nicht
  (8678 ≫ 60, die neue Pruefung greift nicht sichtbar, Zeichengleichheit bestaetigt das).

## Task Commits

1. **Task 1: D-05 — die Beschreibung haengt an der englischen Quelle, in beiden Sprachen** - `d4cdadc` (feat)
2. **Task 2: Die verbleibenden Abweichungen einzeln beurteilen — benannte Ausnahme oder Behebung, plus Zombie-Waechter** - `ad12cde` (feat)
3. **Task 3: Die dreifach kopierte Paarungslogik abloesen — ohne die drei Tore zu schwaechen** - `ed29b1b` (refactor)

**Plan metadata:** siehe Abschluss-Commit dieses SUMMARY.

## Files Created/Modified

- `src/lib/items.ts` - `description()` an die Existenz von `g.desc` geknuepft (D-05), mit Begruendungskommentar
- `scripts/lib/sync-exclusions.mjs` - zwei neue Eintraege: `X-onepager-de-only`, `X-impressum-mstv` (mode `cut-region`)
- `scripts/verify-sync.mjs` - `applyCutRegionExclusions()`, cut-region-Zweig in `comparePair()`, neue Zusicherung 5 (Zombie-Waechter)
- `src/pages/de/impressum.astro` - deutsches Gegenstueck zum bislang EN-only `p.muted`-Hinweis ergaenzt (Drift-Behebung)
- `scripts/verify-fx.mjs` - Paarung auf `findPagePairs()`/`assertMinimumPairs()` umgehaengt
- `scripts/verify-help.mjs` - Paarung umgehaengt, dabei fehlende "< 60"-Untergrenze nachgezogen
- `scripts/verify-typo-motion.mjs` - Paarung umgehaengt

## Decisions Made

- **D-05 woertlich wie in CONTEXT.md vollzogen**: `description()` liefert `null` unabhaengig von `lang`,
  wenn `g.desc` fehlt — kein Nachziehen, kein Uebersetzen, keine Ausnahme fuer die 78/79 Paare.
- **Unbelegte Drift wird behoben, nicht ausgenommen** (residue_argument Regel 2): das zusaetzliche
  `p.muted` auf der EN-Impressum-Seite hatte keinen Quellkommentar, der es als Absicht auswies —
  DE bekam das Gegenstueck, statt einen dritten, schwaecheren Ausnahme-Eintrag anzulegen.
- **`cutRegion()` bleibt die einzige Ausschneide-Implementierung**: der `tagName:'p'`+`openTagPattern`-
  am-`<h2>`-Trick vermeidet eine zweite Funktion fuer "Ueberschrift plus folgender Absatz".
- **Vereinheitlichung darf eine Zusicherung nur staerker machen**: die fehlende "< 60"-Grenze in
  `verify-help.mjs` wurde beim Umhaengen nachgezogen statt stillschweigend uebernommen — mit
  Vorher/Nachher-Beleg, dass das die aktuelle Ausgabe nicht veraendert (D-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Drift behoben] Zusaetzliches `p.muted` auf der EN-Impressum-Seite war unbelegte Drift**
- **Found during:** Task 2 (Impressum-Abweichung einzeln beurteilen)
- **Issue:** `src/pages/impressum.astro` traegt einen `<p class="muted">German law (§ 5 DDG)
  requires this provider identification ("Impressum").</p>` direkt nach `<h1>`, den
  `src/pages/de/impressum.astro` nicht spiegelt. Anders als die MStV-Ueberschrift ist dieser Satz
  NICHT durch einen Quellkommentar als Absicht ausgewiesen — nach der residue_argument-
  Entscheidungsregel (Plan-Text, Regel 2) also Drift, nicht auszunehmen.
- **Fix:** `src/pages/de/impressum.astro` bekam das deutsche Gegenstueck: `<p class="muted">Deutsches
  Recht (§ 5 DDG) verlangt diese Anbieterkennzeichnung ("Impressum").</p>` direkt nach `<h1>Impressum</h1>`.
- **Files modified:** `src/pages/de/impressum.astro`
- **Verification:** `node scripts/verify-sync.mjs --report` nach dem Fix zeigt keine `p.muted`-Gruppe
  mehr; nur noch die belegte MStV-Abweichung bleibt (durch `X-impressum-mstv` erklaert).
- **Committed in:** `ad12cde` (Task 2 commit)

**2. [Rule 2 - Missing Critical] `verify-help.mjs` fehlte die "< 60 Paare"-Plausibilitaetsgrenze**
- **Found during:** Task 3, Schritt 3 (Kopien woertlich gegeneinander halten, wie vom Plan verlangt)
- **Issue:** `verify-fx.mjs` und `verify-typo-motion.mjs` hatten beide `if (pairs < 60) fail(...)`,
  `verify-help.mjs` nicht — die drei Kopien waren NICHT dreimal dasselbe im Umlauf.
- **Fix:** Die Vereinheitlichung auf `assertMinimumPairs(pairList, fail, 60)` zieht die fehlende
  Grenze fuer `verify-help.mjs` automatisch nach.
- **Files modified:** `scripts/verify-help.mjs`
- **Verification:** Vorher/Nachher-Diff gegen denselben `dist/`-Stand ist trotzdem zeichengleich
  (8678 ≫ 60, die neue Pruefung greift nicht sichtbar in diesem Lauf).
- **Committed in:** `ed29b1b` (Task 3 commit)

---

**Total deviations:** 2 (1 Drift-Behebung, 1 nachgezogene fehlende Untergrenze)
**Impact on plan:** Beide Aenderungen sind exakt das, was die vom Plan verlangte Einzelbeurteilung
bzw. der Vorher-Vergleich finden sollte — kein Scope-Creep, keine Abschwaechung.

## Issues Encountered

Keine blockierenden Probleme. Der Build (`npm.cmd run build`, ~483s / 17357 Seiten) und
`npm run audit:site` liefen jeweils laenger als das 120s-Standard-Timeout und mussten im
Hintergrund laufen — reine Umgebungsbeobachtung, kein Code-Problem.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Randnotiz (nicht in diesem Plan zu erledigen)

`.planning/codebase/CONCERNS.md` § "Legal pages still carry unfilled placeholders" fuehrt fuer
`src/pages/impressum.astro:3` und `src/pages/de/impressum.astro:2` weiterhin `[TODO]`-Platzhalter-
Warnungen. Der tatsaechliche Quelltext ist laengst mit echten Betreiberdaten gefuellt (Name,
Anschrift, E-Mail) — CONCERNS.md ist hier veraltet. Wie im Plan-Text vermerkt: anderer Gegenstand
(CONTEXT.md § Phase Boundary), nur als Notiz festgehalten, nicht in diesem Commit behoben.

## Next Phase Readiness

`npm run verify:sync` meldet 0 unerklaerte Abweichungen ueber alle 8678 gebauten Paare und endet
mit Exit 0 — die Handover-Bedingung fuer Plan 03 ist erfuellt. Plan 03 kann das Tor jetzt
blockierend ins Dockerfile haengen (D-03: "erst beheben, dann scharf" ist vollzogen). Laufzeit
~42s ist die Grundlage fuer die Dockerfile-Kette. Kein Blocker.

---
*Phase: 04-sprachparitaet-absichern*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: `src/lib/items.ts`
- FOUND: `scripts/lib/sync-exclusions.mjs`
- FOUND: `scripts/verify-sync.mjs`
- FOUND: `.planning/phases/04-sprachparitaet-absichern/04-02-SUMMARY.md`
- FOUND commit: `d4cdadc` (feat(04-02): description() haengt an g.desc — D-05 …)
- FOUND commit: `ad12cde` (feat(04-02): verify:sync auf 0 unerklaerte Abweichungen …)
- FOUND commit: `ed29b1b` (refactor(04-02): verify-fx/help/typo-motion auf page-pairs.mjs …)
