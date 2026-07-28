# VerseBase

## What This Is

VerseBase ist ein inoffizielles, zweisprachiges (DE/EN) Fan-Kompendium zu Star Citizen,
ausgeliefert als statische Astro-Seite unter https://verse-base.com. Es bündelt
Nachschlagewerkzeuge — Item Finder mit Preisen und Fundorten, Mining- und Crafting-Daten,
Schiffs- und Missions-Datenbank, Wikelo-Trades, Precision-Jump-Rechner — mit dem kompletten
Patch-Archiv der Alpha-4-Ära. Zielgruppe sind Spieler, die stöbernd und lesend nachschlagen,
nicht unter Zeitdruck im Flug.

## Core Value

Spielgenaue Daten, direkt aus den Spieldateien gewonnen statt aus Community-Schätzungen —
wenn die Zahlen nicht stimmen, ist die Seite wertlos.

## Requirements

### Validated

<!-- Aus dem Bestand abgeleitet (siehe .planning/codebase/), live und in Benutzung. -->

- ✓ Patch-Archiv der Alpha-4-Ära (4.0.0 – 4.9.0), je Patch eine eigenständige themierte Seite — existing
- ✓ Item Finder mit Preisen und Fundorten, plus Item-Detailseiten über `DataShell` — existing
- ✓ Crafting-Datenbank mit Blueprints und Planer — existing
- ✓ Mining-Werkzeuge, Refinery-Tracker und Signature-Identifier — existing
- ✓ Schiffs-Datenbank mit Datenblättern und Specs — existing
- ✓ Missions-Datenbank mit Belohnungen und Reputation — existing
- ✓ Wikelo's Emporium (Banu-Trades) — existing
- ✓ Precision-Jump-Rechner für den Aaron Halo — existing
- ✓ Evolution-Ansicht: Systeme über Patches hinweg — existing
- ✓ Zweisprachigkeit DE/EN über Astro i18n (EN auf Root, DE unter `/de/`) — existing
- ✓ Konto-Funktionen über Supabase: Login, Favoriten, Pilot-Profile, RSI-Verifikation — existing
- ✓ Volltextsuche als Overlay (Strg+K) über Items, Schiffe und Patches — existing
- ✓ Hell-/Dunkelmodus, generiert aus der Dunkelpalette — existing
- ✓ Eigenbau-Datamine-Pipeline: `scripts/lib/p4k.mjs` (Data.p4k) und `scripts/lib/datacore.mjs` (Game2.dcb), ohne Fremdabhängigkeiten — existing
- ✓ Discord-Server-Builder und Rank-Bot als eigenes Image — existing
- ✓ Auslieferung als Docker/nginx-Image auf Coolify hinter Cloudflare — existing

### Active

<!-- Gewählte Richtung: UI-/Design-Feinschliff. -->

- [ ] Startseite: Hero-Überschrift „VerseBase" nach oben mittig, Wortmarke am Seitenanfang aus dem Header nehmen, beim Scrollen scroll-verknüpfte Wandlung der Überschrift in den Header-Text
- [ ] Kopfleiste und Startseite als zusammenhängendes Bewegungsbild statt zweier unabhängiger Zustände
- [ ] Typografie und Bewegung über die Seite hinweg vereinheitlichen (Schriftgrade, Übergänge, `prefers-reduced-motion`)
- [ ] Hell- und Dunkelmodus bei jeder UI-Änderung gleichwertig behandeln, nicht nachträglich flicken
- [ ] Klasse-B-Befund aus CONCERNS.md abtragen: dekorative Überlagerungen und gestapelte Deckkraft über Text

### Out of Scope

- Serverseitige Renderlogik — die Seite ist ein statisches Astro-Build hinter nginx; Serverlogik geht nur als Supabase Edge Function
- Neue Datenquellen oder Datamine-Ausbau in dieser Richtung — der aktuelle Fokus ist ausdrücklich Oberfläche, nicht Daten
- Konto-, Community- und Discord-Ausbau — bleibt bestehen, wird in dieser Roadmap aber nicht vorangetrieben
- Umstellung auf ein CSS-Framework oder einen Bundler für `assets/` — handgeschriebenes CSS/JS ist bewusste Entscheidung
- Redesign einzelner Patch-Seiten — jede Patch-Seite hat absichtlich ihre eigene Design-Welt

## Context

**Technisches Umfeld:** Astro ^5 im Static-Modus mit `build.format: 'file'` (jede Route endet auf
`.html`, die DE-Startseite ist `/de.html`), TypeScript strict, Content Collections mit Zod für die
Patch-Daten. Handgeschriebenes CSS/JS unter `assets/` ohne Bundler; `public/assets/` ist generiert
und gitignored. Node 22 + npm. Auslieferung als Docker-Image (nginx:alpine) auf Coolify/Hetzner
hinter Cloudflare — in Produktion läuft kein Node.

**Bestehende Schwachstelle, die jede UI-Arbeit betrifft:** `.planning/codebase/CONCERNS.md`
dokumentiert als „Class A" das Auseinanderdriften der zweisprachigen Seitenpaare. 67 EN/DE-Paare
unter `src/pages/` und `src/pages/de/` teilen nur die inneren Komponenten — Kopf, Palette,
Inline-`<style>`, Prosa und Seiten-Chrome sind von Hand doppelt gepflegt, und nichts im Build
vergleicht sie. Ein bestätigter Fall (`precision-jump.astro`) hat die DE-Fassung auf dem alten
Layout stehen lassen, während `hreflang` Gleichwertigkeit behauptet. Jede Änderung an einer
Startseiten- oder Layout-Datei muss daher beide Sprachfassungen gleichzeitig treffen.

**Bekannte Fallen aus ARCHITECTURE.md:** Die `:root[data-theme="light"]`-Blöcke in den Seiten
werden von `scripts/build-light-palettes.mjs` erzeugt — Handänderungen daran verwirft
`npm run theme` stillschweigend. Stylesheet- und Skript-URLs brauchen den Content-Hash über
`versioned()` aus `src/lib/assetVersion.ts`, sonst liefern nginx und Cloudflare bis zu 24 Stunden
altes CSS gegen neues HTML. Massengenerierte Seiten dürfen nicht `SiteNav` einbinden, sondern
`DataShell` — `SiteNav` samt Suchoverlay wiegt ~37 KB pro Seite.

**Prüfwerkzeuge:** `npm run test:e2e` (Node-eigener Test-Runner mit DOM-Stub), `npm run verify`
und `npm run audit:site` für Integrität und SEO-Konsistenz.

## Constraints

- **Tech stack**: Statisches Astro-Build hinter nginx — kein serverseitiger Code außer Supabase Edge Functions
- **Compatibility**: DE- und EN-Fassung müssen inhaltlich und gestalterisch deckungsgleich bleiben — `hreflang` behauptet Gleichwertigkeit, und Class A in CONCERNS.md belegt, dass das ohne Disziplin bricht
- **Tech stack**: Hellmodus-Blöcke sind generiert (`npm run theme`) — nie von Hand ändern, sonst gehen die Änderungen beim nächsten Lauf verloren
- **Performance**: `/assets/*` liegt 24 h in nginx- und Cloudflare-Cache — verlinkte Assets brauchen zwingend den Content-Hash aus `versioned()`
- **Performance**: `SiteNav` ist ~37 KB pro Seite; auf den ~17k generierten Seiten läuft stattdessen `DataShell`
- **Accessibility**: `prefers-reduced-motion` wird seitenweit respektiert — Bewegung ist Verstärkung, nie Voraussetzung für Bedienbarkeit
- **Dependencies**: Datamining setzt einen lokal installierten Star-Citizen-Client voraus; ohne ihn baut die Seite aus den eingecheckten Snapshots unter `src/data/*.json`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Roadmap-Richtung ist UI-/Design-Feinschliff | Datenpipeline, Konto und Discord stehen und tragen; der sichtbare Abstand zu einer fertigen Seite liegt in der Oberfläche | — Pending |
| Grobe Phasen-Granularität | Bestandsprojekt — die Substanz steht, Phasen sind Themenblöcke statt Aufbauschritte | — Pending |
| Handgeschriebenes CSS/JS statt Framework/Bundler für `assets/` | Volle Kontrolle über Auslieferungsgröße; die Seite ist statisch und soll ohne Laufzeit-Abhängigkeiten auskommen | ✓ Good |
| Zweisprachige Seitenpaare statt einer parametrisierten Route | Historisch gewachsen; erlaubt pro Sprache eigene Prosa | ⚠️ Revisit — Ursache des Class-A-Drifts, Zusammenführung in gemeinsame Komponenten ist der dokumentierte Fix |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-28 after initialization*
