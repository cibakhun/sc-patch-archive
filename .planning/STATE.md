---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 5
current_phase_name: Spenden-Unterstuetzung
status: in_progress
stopped_at: "Phase 7 Plan 3/3 ausgefuehrt (Komponenten-Filter, Branch claude/gsd-ship-component-filter-f81262) und auf den gemeinsamen Schiffskoerper aus Phase 6 umgebaut; Phase 5 (Unterstuetzen-Seite) weiter offen"
last_updated: "2026-08-03T21:40:00.000Z"
last_activity: 2026-08-03
last_activity_desc: Phase 7 abgeschlossen (Komponenten-Filter fuer Schiffe); zuvor Phase 6 abgeschlossen, Phase 5 auf PayPal neu ausgerichtet
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 14
  completed_plans: 8
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

**Ebenfalls fertig, aus einer dritten Sitzung:** Phase 7 „Komponenten-Filter für Schiffe"
(Branch `claude/gsd-ship-component-filter-f81262`) ist ausgeführt und am 03.08.2026 mit
`staging` zusammengeführt. Sie lief parallel zu Phase 6 und ging noch von zwei
handduplizierten Schiffsseiten aus; beim Zusammenführen wanderte der Filter in den von
Phase 6 eingeführten gemeinsamen Körper `components/ships/ShipsOverview.astro`.

Progress: [████░░░░░░] 40%

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
| Phase 06 P01 | 45min | 2 tasks | 8 files |
| Phase 06 P02 | 55min | 2 tasks | 5 files |
| Phase 06 P03 | ~2h55min | 2 tasks | 1 files |
| Phase 07 P01 | ~35min | 2 tasks | 6 files |
| Phase 07 P02 | 55min | 3 tasks | 3 files |
| Phase 07 P03 | ~45min | 3 tasks | 3 files |

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
- [Phase 6]: 06-01: vRoleCig() ersetzt fociDe als Kartenbeschriftung, Fallback auf vRole() fuer die 4 ATLS-Faelle; EIN Koerper (ShipsOverview.astro) fuer /schiffe.html + /de/schiffe.html
- [Phase 6]: 06-01: npm run theme lief repo-weit und veraenderte 84 unbeteiligte Dateien (Alt-Drift) -- alle zurueckgesetzt, nur die 4 fuer diesen Plan vorgesehenen Dateien blieben veraendert
- [Phase 6]: 06-02: 18 Rollenfamilien (CAREER_LEGACY/ROLE_COMPOUND/ROLE_FAMILY) + Signatur (sig, 16 Schiffe) + Merkmalsleiste (feat: cargo 102, ground 37) aus dem DataCore; Bewaffnet (dogfightEnabled 220/223) bewusst nicht als Merkmal erzeugt (D-09)
- [Phase 6]: 06-02: npm run theme beruehrte erneut dieselben 84 unbeteiligten Dateien aus Plan 01 (Alt-Drift) -- zurueckgesetzt, nur die 5 Plan-Dateien blieben veraendert
- [Phase 6]: 06-03: 7 Schnellzugriff-Chips (sdb__quick/sdb__qchip) setzen Rollenfamilie+Signatur in einem Klick (D-10, ROLE-06); sf-type (Wiki-Grobfilter) abgeloest
- [Phase 6]: 06-03: Sichtpruefung fand doppelten Rollenfilter (sf-role neben sf-rolefam) -- sf-role entfernt, sf-rolefam ist jetzt DER Rollenfilter (D-05); Konsole 9 statt 10 Bedienelemente
- [Phase 7]: 07-01: compAttr liefert bei "Daten, aber keine Kategorie" den Platzhalter `_` statt der leeren Zeichenkette -- Astro rendert leere String-Attributwerte ohne `=`, was die automatisierte HTML-Zaehlung im Plan brach (siehe 07-01-SUMMARY.md Deviations)
- [Phase 7]: 07-01: catOf() prueft `m` (MissileLauncher/BombLauncher) VOR `w` (WeaponGun), sonst landen Kombi-Halterungen faelschlich bei den Waffen; Turm-Platz bleibt bewusst frei fuer 07-02 (D-06)
- [Phase 7]: 07-02: D-06 -> D-06a waehrend des blockierenden Checkpoints verschaerft -- die geratene Fernturm-Namenserkennung (`remote`/`tractor`) ist ersatzlos gestrichen, Turm zaehlt nur noch `TurretBase` ohne `Container` (reversibility: costly). Preis: Carrack/Redeemer/Polaris verlieren ihre ferngesteuerten Turm-Ports; 47 statt 59 Schiffe tragen jetzt `t`. `t` speichert wie alle Kategorien die maximale Steckplatzgroesse, NICHT die Turmanzahl (Verwechslungsgefahr, siehe 07-02-SUMMARY.md).
- [Phase 7]: 07-03: 26 automatisierte `node:vm`-Testfaelle (`tests/e2e/ship-component-filter.test.js`) fuehren das echte Inline-Skript aus und decken D-04/D-08/D-10/D-11/D-12 ab.
- [Phase 7]: Zusammenfuehrung 03.08.2026: Phase 7 lief parallel zu Phase 6 und ging von zwei handduplizierten Schiffsseiten aus. Phase 6 hat die beiden zu EINEM Koerper zusammengelegt -- der Filter sitzt seither in `components/ships/ShipsOverview.astro`, nicht mehr zweimal in den Seiten. Das Groessenfeld heisst `sf-compsize`, weil Phase 6 `sf-size` bereits fuer die Schiffs-Groessenklasse belegt.

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
| 260802-ose | Größenachse (CIG-Hangarklasse 1-6, `AttachDef.Size`) als dritte Filterachse neben Beruf/Rolle; Boden/Raum-Merkmal bewusst NICHT auf `AttachDef.SubType` umgestellt (verliert 10 Schweberäder gegenüber dem bestehenden Merkmal) | 2026-08-02 | 3ecddb4, bf05687, 330c29a, 85ebd90 | | [260802-ose-groessenachse-boden-raum](./quick/260802-ose-groessenachse-boden-raum/) |

### Roadmap Evolution

- Phase 01.1 inserted after Phase 1: Ambiente-Effekte stilllegen — Mauszeiger-Schein raus, Partikel opt-in (Besucher-Rueckmeldung 29.07.2026) (URGENT)
- Phase 01.2 inserted after Phase 1: Werkzeuge erklaeren — Zweck- und Bedienungshilfe je Werkzeug (Besucher-Rueckmeldung 29.07.2026) (URGENT)
- Phase 5 added (31.07.2026): Spenden-Unterstuetzung — Stripe Checkout + Ko-fi, eigene Seite, Ziel und Unterstuetzer-Wand (DON-01…DON-14). ERWEITERT den Meilenstein bewusst ueber die Oberflaeche hinaus (DB-Tabelle, zwei Edge Functions, Zahlungsverkehr); die „Out of Scope"-Zeilen zu serverseitiger Logik und Konto-Funktionen sind fuer diese Phase aufgehoben. Anlass: defektes Netzteil im Entwicklungsrechner, zufaellige Neustarts. Haengt an keiner Vorgaengerphase — Phase 1.1 bleibt geplant liegen und wird NICHT abgebrochen.
- Phase 6 added (02.08.2026): Schiffe — Rollen- und Merkmalsfilter. Granulare, spielgenaue Filter statt acht Wiki-Grobtypen; Datengrundlage neu aus dem DataCore. Beanspruchte zunaechst Nummer 5 und wurde beim staging-Abgleich auf 6 umnummeriert, weil Spenden-Unterstuetzung zuerst auf staging war. ABGESCHLOSSEN, Verifikation 10/10.
- Phase 7 added (03.08.2026): Komponenten-Filter fuer Schiffe — Filter nach Steckplatz-Groesse je Bauteilart, eigener Zweig `claude/gsd-ship-component-filter-f81262`. Beanspruchte zunaechst Nummer 5 und wurde beim staging-Abgleich auf 7 umnummeriert (5 = Spenden, 6 = Rollenfilter waren zuerst da). Vorab-Spike hat die Datenquelle belegt: `Scripts/Entities/Vehicles/Implementations/Xml/<SCHIFF>.xml` (CryXmlB) traegt je Part einen `ItemPort` mit `minSize`/`maxSize`/`Types`; der DataCore-Schiffsrecord fuehrt den Pfad dieser XML selbst als Dateiverweis, der Join braucht also kein Namensraten.
- Phase 7 Plan 1/3 ausgefuehrt (03.08.2026): CryXmlB-Leser + Datamine-Skript liefern 223/227 Schiffe ueber 7 von 8 Bauteilkategorien (Turm folgt in 07-02). Alle vier Hausgates gruen. Details: `.planning/phases/07-komponenten-filter-f-r-schiffe/07-01-SUMMARY.md`.
- Phase 7 Plan 2/3 ausgefuehrt (03.08.2026): Turm-Regel (D-06a, vom Nutzer im blockierenden Checkpoint auf reine `TurretBase`-Ablesung verschaerft) + achte Bauteilart. 47/223 Schiffe tragen `t`. Alle vier Hausgates gruen. Details: `07-02-SUMMARY.md`.
- Phase 7 Plan 3/3 ausgefuehrt (03.08.2026): Zweisprachigkeit + 26 automatisierte `node:vm`-Testfaelle (D-04/D-08/D-10/D-11/D-12). Alle vier Hausgates gruen, Sichtpruefung in beiden Sprachen/Farbmodi/360 px bestaetigt. Details: `07-03-SUMMARY.md`.
- Phase 7 mit staging zusammengefuehrt (03.08.2026): Phase 6 hatte die beiden Schiffsseiten inzwischen zu EINEM Koerper zusammengelegt. Der Filter wanderte deshalb aus den zwei Seiten in `components/ships/ShipsOverview.astro`; `sf-size` war dort bereits fuer die Schiffs-Groessenklasse vergeben, das Bauteil-Groessenfeld heisst darum `sf-compsize`. **Phase 7 damit abgeschlossen.**

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-03T21:40:00.000Z
Stopped at: Phase 7 abgeschlossen (Komponenten-Filter fuer Schiffe) und mit staging zusammengefuehrt — Filter sitzt jetzt im gemeinsamen Koerper ShipsOverview.astro
Resume file: .planning/phases/05-spenden-unterst-tzung/05-01-PLAN.md  (Phase 5 Spenden — naechster offener Plan)
