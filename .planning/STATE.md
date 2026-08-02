---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 5
current_phase_name: Spenden-Unterstuetzung
status: in_progress
stopped_at: staging zusammengefuehrt — Unterstuetzen-Seite existiert bereits, Umbau auf "Instandsetzung" laeuft
last_updated: "2026-08-02T11:00:10.543Z"
last_activity: 2026-08-02
last_activity_desc: Phase 5 als Umbau der bestehenden Support-Seite neu ausgerichtet
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 8
  completed_plans: 2
parked_phase: 1.1
parked_phase_stopped_at: Completed 01.1-02-PLAN.md
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-28)

**Core value:** Spielgenaue Daten, direkt aus den Spieldateien gewonnen — wenn die Zahlen nicht stimmen, ist die Seite wertlos.
**Current focus:** Phase 5 — Spenden-Unterstützung

## Current Position

Phase: 5 of 7 (Spenden-Unterstützung)
Plan: 3 Pläne geschnitten, noch keiner ausgeführt
Status: **Neu ausgerichtet am 02.08.2026.** Der Abgleich mit `origin/staging` hat
gezeigt, dass `/support.html` bereits existiert und live ist (Commit `517a9a7`,
`src/components/SupportBody.astro` als EIN Körper für DE+EN, Empfänger
`paypal.me/mkrisz22`, Fuß und Menü verdrahtet). Dieser Worktree war von `a23a22a`
abgezweigt und blind dafür. Phase 5 ist deshalb kein Neubau mehr, sondern der
**Umbau der bestehenden Seite** auf die Gestaltungsrichtung „Instandsetzung".
Branch: claude/donation-button-feature-98ba38 (Worktree)
Last activity: 2026-08-02 — staging zusammengeführt, Phase 5 auf Umbau umgestellt

**Was der bestehenden Seite fehlt** (gemessen, nicht vermutet):
- Datenschutzerklärung nennt PayPal in KEINER der beiden Sprachfassungen (0 Treffer)
  — der einzige Punkt mit rechtlicher Relevanz
- Keine eigene Optik (Standard-Palette `--accent:#2dd4ff`), keine Betragswahl, kein Ko-fi
- Als Grund steht die generische Serverkosten-Begründung statt des defekten Netzteils

**Was bleibt und übernommen wird:** die Abschnitte „Was genauso hilft" und
„Kein Kleingedrucktes" — inhaltlich stark, sie bekommen nur die neue Form.

**Achtung Mehrfachsitzung:** Der Betreiber arbeitet parallel in einer zweiten
Sitzung an Phase 5. `SupportBody.astro` darf nicht gleichzeitig aus zwei Sitzungen
geändert werden.

**Geparkt:** Phase 1.1 „Ambiente-Effekte stilllegen" steht bei Plan 2 von 3
(Plan-Prüfer bestanden, ausführbereit) auf Branch
`claude/site-feedback-effects-docs-3f4edf`. Sie ist NICHT abgebrochen und wird
nach Phase 5 fortgesetzt; Phase 5 fasst keine der dort geänderten Dateien an.

Progress: [███░░░░░░░] 33%

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

### Pending Todos

None yet.

### Blockers/Concerns

- Class A aus CONCERNS.md: 67 EN/DE-Seitenpaare pflegen Kopf, Palette, Inline-Style und Prosa von Hand doppelt; nichts im Build vergleicht sie. Jede Änderung an Startseite oder Layout muss beide Fassungen gleichzeitig treffen. Phase 4 baut den Nachweis dafür.
- Generierte `:root[data-theme="light"]`-Blöcke: Handänderungen verwirft `npm run theme` stillschweigend.
- GSD-Subagenten (`gsd-planner`, `gsd-executor`, …) liegen in `~/.claude/agents/`, waren in der Init-Sitzung aber noch nicht in der Agenten-Registry. Nach einem Neustart von Claude Code stehen sie zur Verfügung. Phase 1 lief deshalb inline.
- Vorbestehend, nicht aus Phase 1: der Astro-Dev-Server bricht bei `src/layouts/Layout.astro` mit `Unexpected ")"` in einem Inline-Skript ab. Der Produktionsbuild ist nicht betroffen — die Sichtprüfung lief deshalb gegen das gebaute `dist/`.
- Reduzierte Bewegung ist in Phase 1 aus dem Code abgeleitet, nicht im Browser gemessen: der Prüfbrowser meldet `prefers-reduced-motion: false` und bietet keine Emulation.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260802-3fw | Zurück-Button site-weit (SiteNav leitet ihn aus `crumbs` ab; `--nav-h` löst die verdrahteten 68px in drei Filterleisten ab) | 2026-08-02 | b12a3b5, 03ead2d | | [260802-3fw-zurueck-button-site-weit](./quick/260802-3fw-zurueck-button-site-weit/) |
| 260802-5qd | Zurück folgt der tatsächlichen Herkunft (Herkunfts-Notiz + parser-blockierender Leser; crafting→Material→zurück behält Suche und Scroll) | 2026-08-02 | d66dbb6, 9e0133a | | [260802-5qd-zurueck-folgt-der-herkunft](./quick/260802-5qd-zurueck-folgt-der-herkunft/) |
| 260802-7eb | UEX-Durchschnittspreis-Spalte für Items (DE+EN) — vierte Ø-Spalte in Datenblatt, Kategorie-Liste und Finder-Modal; Mittelwert über alle Verkaufsorte aus `obtain[]`, ohne API-/Pipeline-Änderung | 2026-08-02 | aa391d8, bcc99b7 | Verified | [260802-7eb-uex-durchschnittspreis-spalte-fuer-items](./quick/260802-7eb-uex-durchschnittspreis-spalte-fuer-items/) |
| 260802-7f5 | Item-Finder als Werkzeug: Suche und Filter ohne Scrollen direkt unter dem Titel (DE+EN) | 2026-08-02 | 8001901 | Verified | [260802-7f5-item-finder-als-werkzeug-suche-und-filte](./quick/260802-7f5-item-finder-als-werkzeug-suche-und-filte/) |

### Roadmap Evolution

- Phase 01.1 inserted after Phase 1: Ambiente-Effekte stilllegen — Mauszeiger-Schein raus, Partikel opt-in (Besucher-Rueckmeldung 29.07.2026) (URGENT)
- Phase 01.2 inserted after Phase 1: Werkzeuge erklaeren — Zweck- und Bedienungshilfe je Werkzeug (Besucher-Rueckmeldung 29.07.2026) (URGENT)
- Phase 5 added (31.07.2026): Spenden-Unterstuetzung — Stripe Checkout + Ko-fi, eigene Seite, Ziel und Unterstuetzer-Wand (DON-01…DON-14). ERWEITERT den Meilenstein bewusst ueber die Oberflaeche hinaus (DB-Tabelle, zwei Edge Functions, Zahlungsverkehr); die „Out of Scope"-Zeilen zu serverseitiger Logik und Konto-Funktionen sind fuer diese Phase aufgehoben. Anlass: defektes Netzteil im Entwicklungsrechner, zufaellige Neustarts. Haengt an keiner Vorgaengerphase — Phase 1.1 bleibt geplant liegen und wird NICHT abgebrochen.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-02T11:00:10.528Z
Stopped at: Phase 5 auf PayPal neu geplant — 3 Plaene, ausfuehrbereit
Resume file: .planning/phases/05-spenden-unterst-tzung/05-01-PLAN.md
