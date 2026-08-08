---
phase: 03-ueberlagerungen-entstapeln
plan: 04
subsystem: ui
tags: [css, codemod, mass-migration, intersection-observer, mask-image, patch-archive]

requires:
  - phase: 03-ueberlagerungen-entstapeln
    provides: "Plan 01/02 bauten die woertliche Endform in assets/detail.css (body::after maskiert, ::before-Zeilenraster je Medien-Archetyp, .reveal ohne Hoehendeckel) — dieser Plan repliziert sie unveraendert in die 19 Patch-Koerper, die assets/detail.css nicht verlinken"
provides:
  - "scripts/migrate-layers.mjs — ueberpruefbarer Massendurchlauf (Volltext-Ersatz, keine Zeilen-Regex) mit Soll-Zahlen 19/87/19 und Abbruch bei Abweichung"
  - "19 Patch-Koerper (src/components/patches/sc-4-*.astro): body::after maskiert+rasterfrei (identisch zu assets/detail.css), 87 neue ::before-Rasterregeln (hero=19, shot=19, tile.img=19, video=17, ship=13), .reveal-Beobachter auf rootMargin statt threshold:.1"
  - "scripts/verify-layers.mjs Zusicherung 1+3: Patch-Kopien von Beobachtungswert auf scharf (blockierend) umgestellt; neuer dist-unabhaengiger --patches-Vorablauf gegen die Quelle"
affects: [03-05]

tech-stack:
  added: []
  patterns:
    - "Volltext-String-Ersatz statt zeilenweiser Regex fuer Massendurchlaeufe an bestandsalten Dateien — vermeidet die Plan-03-Falle (eingebettetes \\r ohne \\n zerstoert eine zeilenbasierte Erfassung, der Build meldet trotzdem gruen)"
    - "Erlaubnisliste der Eigenschaften als Selbsttest gegen die eigenen Ersetzungs-Vorlagen (assertAllowedProps), nicht als Diff-Nachanalyse ueber fremden Text — moeglich, weil jede Ersetzung ein woertlich bekannter Block ist, kein generisches Pattern"

key-files:
  created:
    - scripts/migrate-layers.mjs
  modified:
    - scripts/verify-layers.mjs
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
    - .planning/REQUIREMENTS.md

key-decisions:
  - "migrate-layers.mjs arbeitet NIE zeilenweise -- jede Aenderung ist String.replace() gegen einen vorab auf Eindeutigkeit geprueften, woertlich bekannten Block (body::after-Volltext, Anker-Regel fuer die neue ::before-Einfuegung, Beobachter-Zeile). Grund: Plan 03 hat gezeigt, dass ein zeilenweiser Entferner an einem eingebetteten \\r-ohne-\\n scheitern kann, waehrend npm run build trotzdem gruen bleibt"
  - "Vor jedem Schreiben wird JE ZIEL (hero/shot/tile.img/video/ship) die Container-Regel auf position:(relative|sticky|...) + overflow:hidden geprueft; fehlt eine Voraussetzung, bricht der Lauf fuer die betroffene Datei ab, statt eine Regel zu schreiben, die ins Leere malt. Bei diesem Lauf war JEDE Voraussetzung erfuellt (0 Abbrueche)"
  - ".hero::before wird NACH .hero__photo::after eingefuegt (wie assets/detail.css), die uebrigen vier NEUE ::before-Regeln VOR der jeweils schon vorhandenen ::after-Scrim-Regel derselben Basisklasse -- dasselbe Muster wie .band/.split__media im geteilten System (03-02-SUMMARY.md)"
  - "verify-layers.mjs Zusicherung 1+3 fuer die Patch-Kopien von 'Beobachtungswert (nicht blockierend)' auf scharf (fail() bei Abweichung) umgestellt -- das ist die einzige Beruehrung dieses Plans an der Tor-Datei, wie im Plan vorgegeben"
  - "Neuer --patches-Modus in verify-layers.mjs prueft die 19 Quelldateien direkt (kein dist/ noetig) -- schnelle Rueckmeldung unmittelbar nach migrate-layers.mjs --apply, bevor der ~60s-Produktionsbuild laeuft"

requirements-completed: [LAYER-01]

coverage:
  - id: D1
    description: "19 body::after-Kopien maskiert (identischer Wortlaut wie assets/detail.css), rasterfrei, an var(--maxw) gekoppelt"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "node scripts/verify-layers.mjs (Zusicherung 1, patchOkCount 19/19) + node scripts/verify-layers.mjs --patches (19/19 OK)"
        status: pass
    human_judgment: false
  - id: D2
    description: "87 neue Rasterschichten (::before, z-index:1) ueber .hero/.shot/.tile.img/.video/.ship, verteilt 19/19/19/17/13 wie in den measured_targets vorhergesagt"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "node scripts/migrate-layers.mjs (Trockenlauf, Soll/Ist 87/87) + node scripts/migrate-layers.mjs --apply (87 geschrieben)"
        status: pass
    human_judgment: false
  - id: D3
    description: "19 .reveal-Beobachter ohne Hoehendeckel (rootMargin statt threshold:.1)"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "node scripts/verify-layers.mjs (Zusicherung 3, 19/19) + node scripts/verify-layers.mjs --patches"
        status: pass
    human_judgment: false
  - id: D4
    description: "Design-Welten der 19 Patches maschinell unveraendert: animation: 133 und transition: 160 vor/nach identisch, Bildmotiv-Menge (url()) unveraendert, jede geaenderte Zeile traegt nur erlaubte Eigenschaften"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "migrate-layers.mjs eigene Invarianten-Zusicherung (Pass 2, vor jedem Schreiben) + Handgegenprobe (node-Einzeiler nach --apply: animation:133, transition:160)"
        status: pass
    human_judgment: false
  - id: D5
    description: "sc-4-9-0 (#dust) und sc-4-2-0 (Regen/Blitz) von Hand im Diff gelesen: beide Ambiente-Bloecke liegen ausserhalb jedes geaenderten Hunks"
    requirement: "LAYER-01"
    verification:
      - kind: manual_procedural
        ref: "git diff -- src/components/patches/sc-4-9-0.astro und sc-4-2-0.astro, Zeilenbereich der Partikel-/Sturm-Bloecke gegen die Diff-Hunks abgeglichen"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-08
status: complete
---

# Phase 3 Plan 4: Die 19 Patch-Körper — überprüfbarer Massendurchlauf Summary

**Alle 19 Patch-Körper tragen jetzt dieselbe Behandlung wie das geteilte System: `body::after` maskiert statt gedimmt, 87 neue `::before`-Rasterschichten über den Bildmotiven, `.reveal`-Beobachter ohne Höhendeckel — per überprüfbarem Massendurchlauf, dessen Soll-Zahlen (19/87/19) exakt eintrafen, und `verify:layers` prüft die Patch-Kopien jetzt scharf statt beobachtend.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-08T20:47:00Z (unmittelbar nach 03-03)
- **Completed:** 2026-08-08T21:11:00Z
- **Tasks:** 2
- **Files modified:** 22 (1 neu, 21 geändert)

## Ist-Zahlen gegen die Soll-Zahlen des Plans

| Größe | Soll (Plan) | Ist (dieser Lauf) | Abweichung |
|---|---|---|---|
| `body::after`-Umschreibungen | 19 | 19 | keine |
| Rasterregeln gesamt | 87 | 87 | keine |
| davon `.hero::before` | 19 | 19 | keine |
| davon `.shot::before` | 19 | 19 | keine |
| davon `.tile.img::before` | 19 | 19 | keine |
| davon `.video::before` | 17 | 17 | keine |
| davon `.ship::before` | 13 | 13 | keine |
| Beobachter-Heilungen | 19 | 19 | keine |
| `animation:`-Deklarationen (vor/nach) | 133 / 133 | 133 / 133 | keine |
| `transition:`-Deklarationen (vor/nach) | 160 / 160 | 160 / 160 | keine |

Alle neun Zahlen trafen exakt wie im Plan vorhergesagt ein — keine einzige Abweichung. `migrate-layers.mjs` musste dadurch nie in den "Menschen-Entscheidung nötig"-Pfad ausweichen; jede der fünf Container-Voraussetzungen (`.hero`/`.shot`/`.tile`/`.video`/`.ship` jeweils `position:relative` + `overflow:hidden`) war bei allen betroffenen Dateien bereits erfüllt.

## Von Hand gelesener Diff-Befund: sc-4-9-0 (#dust) und sc-4-2-0 (Regen/Blitz)

- **`sc-4-9-0.astro`:** Der `#dust`-Partikel-Block (Staub-Motes, Frontier-Wind-Treiber) sitzt im `<script>`-Teil bei Zeile ~406-410 der Originaldatei. Die einzige Änderung im `<script>`-Bereich dieser Datei ist die Beobachter-Zeile (`const io=new IntersectionObserver(...)`, Zeile 394→395 nach der Rasterregel-Einfügung weiter oben im `<style>`-Block) — der `#dust`-Block liegt danach unverändert im Diff, kein Hunk berührt ihn.
- **`sc-4-2-0.astro`:** Der Sturm-Canvas-Kommentar ("Sturm-Canvas (themed: fallender Regen + gelegentliche Blitze)") steht bei Zeile 334 der Originaldatei, 15 Zeilen nach dem einzigen geänderten `<script>`-Hunk (der Beobachter-Zeile bei Zeile 319/320). Der Regen-/Blitz-Block selbst ist im `git diff` nicht sichtbar — kein Hunk reicht in seinen Zeilenbereich hinein.
- In beiden Dateien betreffen alle `<script>`-seitigen Änderungen ausschließlich die eine Beobachter-Zeile (`threshold:.1` → `rootMargin:'0px 0px -10% 0px',threshold:0`); die Partikel-/Sturm-Schleifen selbst (FX-Gatter, `running`-Variable, `requestAnimationFrame`) sind in keinem der beiden Diffs vorhanden.

## Voraussetzung verletzt? Nein — 0 Abbrüche

`migrate-layers.mjs` hat bei keiner der 19 Dateien und keinem der 87 geplanten Rasterziele eine verletzte Voraussetzung (Container nicht positioniert/nicht beschnitten) vorgefunden. Der Trockenlauf und der `--apply`-Lauf meldeten identische Zahlen (19/87/19) — kein Ziel musste wegen einer fehlenden Voraussetzung übersprungen werden, und die Erlaubnisliste (`assertAllowedProps`) hat gegen die eigenen Vorlagen bestätigt, dass keine neu geschriebene Regel eine unzulässige Eigenschaft trägt.

## Task Commits

1. **Task 1: Den Massendurchlauf bauen und trocken laufen lassen** — `00e990b` (feat)
2. **Task 2: Ausführen und beweisen, dass die 19 Design-Welten unberührt sind** — `505d96a` (feat, inkl. `verify-layers.mjs`-Anhebung und `REQUIREMENTS.md`/`ROADMAP.md`)

**Plan metadata:** wird mit diesem Commit abgeschlossen (docs: complete plan)

## Files Created/Modified

- `scripts/migrate-layers.mjs` — neu, Volltext-basierter Massendurchlauf mit Soll-Zahlen 19/87/19, Erlaubnisliste, Invarianten-Zusicherung (animation/transition/url())
- `scripts/verify-layers.mjs` — Zusicherung 1+3 für Patch-Kopien scharf gestellt; neuer `--patches`-Modus (dist-unabhängiger Vorablauf gegen die Quelle)
- 19 Patch-Körper (`src/components/patches/sc-4-*.astro`) — `body::after` maskiert, je vorhandenem Ziel eine neue `::before`-Rasterregel, `.reveal`-Beobachter geheilt
- `.planning/REQUIREMENTS.md` — LAYER-01 auf Complete, Out-of-Scope-Ausnahme für diesen Plan ergänzt (zweite, benannte Ausnahme neben der Phase-2-Ausnahme)
- `.planning/ROADMAP.md` — Plan-04-Zeile abgehakt

## Decisions Made

- Volltext-String-Ersatz statt zeilenweiser Regex — direkte Lehre aus Plan 03s `PilotPage.astro`-Vorfall (siehe `key-decisions` oben).
- `.hero::before` nach `.hero__photo::after` eingefügt (Hero hat kein eigenes `.hero::after`); die übrigen vier neuen `::before`-Regeln jeweils vor der schon vorhandenen `::after`-Scrim-Regel derselben Basisklasse — wörtlich dasselbe Einfügemuster wie im geteilten System (`03-02-SUMMARY.md`).
- `verify-layers.mjs`s einzige Berührung in diesem Plan: Zusicherung 1 (`body::after`) und Zusicherung 3 (`.reveal`-Beobachter) für die Patch-Kopien von Beobachtungswert auf scharf umgestellt — genau der im Plan vorgegebene Umfang, keine weitere Zeile der Tor-Datei angefasst.
- Neuer `--patches`-Modus als zusätzliches, nicht im Plan-Text ausdrücklich verlangtes, aber durch den Verify-Befehl (`node scripts/verify-layers.mjs --patches`) implizit gefordertes Werkzeug: schnelle, dist-unabhängige Rückmeldung direkt nach `--apply`, bevor der ~60s-Produktionsbuild läuft.

## Deviations from Plan

None — plan executed exactly as written. Alle Soll-Zahlen trafen exakt ein, keine Voraussetzung war verletzt, kein Rule-1/2/3-Autofix nötig.

## Issues Encountered

- Die erste Fassung von `verify-layers.mjs --patches` versuchte, die komplette `IntersectionObserver(...)`-Anweisung per klammerzählender Regex zu erfassen — scheiterte, weil der Callback-Body selbst ein `;` trägt (`io.unobserve(e.target)`), wodurch keine zwei aufeinanderfolgenden `)` im erwarteten Muster vorkamen. Auf denselben wörtlichen Abgleich umgestellt, den `migrate-layers.mjs` bereits für Alt-/Neu-Form verwendet (String.includes() statt Regex) — seitdem 19/19 grün.

## User Setup Required

None — keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

- LAYER-01 ist jetzt vollständig abgetragen: geteiltes System (Plan 01/02), `/archiv` (Plan 03) und die 19 Patch-Körper (dieser Plan) tragen alle dieselbe Begrenzungs-Behandlung; `verify:layers` prüft alle drei Bestände scharf.
- Offene Anschlussarbeit für Plan 05: LAYER-02 (WCAG-AA-Zielmarke) ist weiterhin nur am `.hero`-Registry-Eintrag bewiesen (Plan 01) — die vollständige Aufzählung über alle Medien-Archetypen UND die 19 Patch-Körper (eigene Paletten, eigene Bildmotive) steht noch aus. Der Hellmodus-Fließtext-Wert am Hero (2,98:1, unverändert seit Plan 01) zeigt bereits, dass mindestens eine Stelle die Zielmarke heute noch verfehlt.
- `verify-layers.mjs` bleibt weiterhin NICHT ins Dockerfile-Tor eingehängt — das macht Plan 05, zusammen mit dem Scharfstellen der D-04-Zielmarke als hartes Abbruchkriterium.
- Erfolgskriterium 3 (Sichturteil "Bildmotive tragen die Seite optisch weiterhin") bleibt wie in `03-01-SUMMARY.md` dokumentiert `human_verify_mode: end-of-phase` — Plan 05 legt es dem Betreiber vor, jetzt erstmals über ALLE 19 Patch-Design-Welten hinweg sichtbar (dieser Plan hat sie zum ersten Mal alle gemeinsam berührt).

---
*Phase: 03-ueberlagerungen-entstapeln*
*Completed: 2026-08-08*

## Self-Check: PASSED

All 6 claimed files found on disk (`scripts/migrate-layers.mjs`, `scripts/verify-layers.mjs`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `src/components/patches/sc-4-9-0.astro`, this SUMMARY); both claimed commits found in git log (`00e990b`, `505d96a`).
