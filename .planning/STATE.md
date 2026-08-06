---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 05
current_phase_name: bauteil-kennwerte-auf-den-crafting-karten
status: verifying
stopped_at: Completed 05-03-PLAN.md (Phase 05 abgeschlossen)
last_updated: "2026-08-06T23:03:31.614Z"
last_activity: 2026-08-06
last_activity_desc: Phase 05 execution started
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 8
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-28)

**Core value:** Spielgenaue Daten, direkt aus den Spieldateien gewonnen — wenn die Zahlen nicht stimmen, ist die Seite wertlos.
**Current focus:** Phase 05 — bauteil-kennwerte-auf-den-crafting-karten

## Current Position

Phase: 05 (bauteil-kennwerte-auf-den-crafting-karten) — EXECUTING
Plan: 3 of 3
Status: Phase complete — ready for verification
Branch: claude/site-feedback-effects-docs-3f4edf
Last activity: 2026-08-06 — Phase 05 execution started

Progress: [██████░░░░] 63%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01.1 P01 | 45min | 3 tasks | 8 files |
| Phase 01.1 P02 | ~2h | 3 tasks | 39 files |
| Phase 05 P01 | 26min | 2 tasks | 5 files |
| Phase 05 P02 | 16min | 2 tasks | 4 files |
| Phase 05 P03 | ~35min | 1 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Meilenstein-Richtung ist UI-/Design-Feinschliff; Daten, Konto und Discord bleiben unangetastet
- Init: Grobe Granularität — 4 Phasen, je 2 Pläne
- Init: Projekt-Recherche übersprungen (Bestandsprojekt mit festem, dokumentiertem Stack; kein Web-Such-MCP verbunden). Recherche pro Phase bleibt aktiv.
- [Phase ?]: 01.1-01: data-fx/vb.fx/vbfxchange/js-fx-toggle als endgueltiger FX-Vertrag festgelegt (reversibility: costly) — Plaene 02/03 bauen direkt darauf auf
- [Phase ?]: 01.1-01: 11 vorbestehende, unabhaengige test:e2e-Fehlschlaege (item-finder-app.js Cache-Bust) in deferred-items.md dokumentiert, nicht behoben (Scope Boundary)
- [Phase ?]: archive.js: eine gemeinsame running-Variable traegt Tab-Sichtbarkeit UND FX-Wahl statt zweier konkurrierender Riegel
- [Phase ?]: Codemod liest den Leinwandnamen aus getElementById statt ihn festzuverdrahten -- erkennt dadurch die abweichende dust-Leinwand von sc-4-9-0 korrekt
- [Phase ?]: sc-4-2-0 Regen und Blitz bewusst aus dem Codemod ausgeschlossen und von Hand gegattert, inkl. Reset des Zeitgebers beim Wiedereinschalten
- [Phase ?]: Kollisionssperre vergleicht das gesamte item_stats-Objekt (schluesselsortiert serialisiert), nicht nur mass_kg/overheat_temperature — 3 von 5 Kollisionen teilen identisches overheat_temperature
- [Phase ?]: CSS-Tokens fuer die neuen Chips ohne Hex-Fallback geschrieben (var(--text) statt var(--text,#eef1f5)), um das woertliche Acceptance-Criterion gegen neue Farbliterale zu erfuellen
- [Phase ?]: verify-crafting-specs.mjs spiegelt blueprintSpecs()/COLLIDING_NAMES statt sie zu importieren — Node's TS-Stripping loest extensionlose relative Importe in crafting.ts (./items) nicht auf, gemessen mit einem direkten import()-Versuch vor der Entscheidung
- [Phase ?]: Ton-Ableitung fuer Schiffswaffen aus dem dritten Kategorie-Segment (toneFromWeaponCategoryPath), gespiegelt in verify-crafting-specs.mjs
- [Phase ?]: 05-03: Ton bekommt bewusst KEINE eigene Filtergruppe — nur die Freitextsuche deckt d.tone ab (Scope Fence nennt nur Groesse/Grade als Filter)
- [Phase ?]: 05-03: Filter-Ueberschriften aus vorhandenem Wortschatz itemT('specSize')/itemT('specGrade') statt neuer App-Strings — DE/EN automatisch synchron
- [Phase ?]: 05-03: sizeCounts/gradeCounts direkt aus cardsData abgeleitet (nicht aus einer zweiten DB.blueprints-Iteration) — dieselbe Quelle, die die Karten rendert, kann nicht auseinanderlaufen

### Pending Todos

None yet.

### Blockers/Concerns

- Class A aus CONCERNS.md: 67 EN/DE-Seitenpaare pflegen Kopf, Palette, Inline-Style und Prosa von Hand doppelt; nichts im Build vergleicht sie. Jede Änderung an Startseite oder Layout muss beide Fassungen gleichzeitig treffen. Phase 4 baut den Nachweis dafür.
- Generierte `:root[data-theme="light"]`-Blöcke: Handänderungen verwirft `npm run theme` stillschweigend.
- GSD-Subagenten (`gsd-planner`, `gsd-executor`, …) liegen in `~/.claude/agents/`, waren in der Init-Sitzung aber noch nicht in der Agenten-Registry. Nach einem Neustart von Claude Code stehen sie zur Verfügung. Phase 1 lief deshalb inline.
- Vorbestehend, nicht aus Phase 1: der Astro-Dev-Server bricht bei `src/layouts/Layout.astro` mit `Unexpected ")"` in einem Inline-Skript ab. Der Produktionsbuild ist nicht betroffen — die Sichtprüfung lief deshalb gegen das gebaute `dist/`.
- Reduzierte Bewegung ist in Phase 1 aus dem Code abgeleitet, nicht im Browser gemessen: der Prüfbrowser meldet `prefers-reduced-motion: false` und bietet keine Emulation.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260802-3fw | Zurück-Button site-weit (SiteNav leitet ihn aus `crumbs` ab; `--nav-h` löst die verdrahteten 68px in drei Filterleisten ab) | 2026-08-02 | b12a3b5, 03ead2d | [260802-3fw-zurueck-button-site-weit](./quick/260802-3fw-zurueck-button-site-weit/) |
| 260802-5qd | Zurück folgt der tatsächlichen Herkunft (Herkunfts-Notiz + parser-blockierender Leser; crafting→Material→zurück behält Suche und Scroll) | 2026-08-02 | d66dbb6, 9e0133a | [260802-5qd-zurueck-folgt-der-herkunft](./quick/260802-5qd-zurueck-folgt-der-herkunft/) |

### Roadmap Evolution

- Phase 01.1 inserted after Phase 1: Ambiente-Effekte stilllegen — Mauszeiger-Schein raus, Partikel opt-in (Besucher-Rueckmeldung 29.07.2026) (URGENT)
- Phase 01.2 inserted after Phase 1: Werkzeuge erklaeren — Zweck- und Bedienungshilfe je Werkzeug (Besucher-Rueckmeldung 29.07.2026) (URGENT)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-06T23:03:31.598Z
Stopped at: Completed 05-03-PLAN.md (Phase 05 abgeschlossen)
Resume file: None
