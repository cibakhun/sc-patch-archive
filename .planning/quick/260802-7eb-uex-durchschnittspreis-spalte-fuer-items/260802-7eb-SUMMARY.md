---
phase: quick-260802-7eb
plan: 01
subsystem: items
tags: [items, pricing, i18n, item-finder]
dependency-graph:
  requires: [src/lib/items.ts, src/i18n/itemText.ts, assets/universal-items.json]
  provides: [avgPrice()]
  affects: [src/components/ItemDetail.astro, src/components/ItemListing.astro, src/components/ItemFinderApp.astro, assets/item-finder-app.js]
tech-stack:
  added: []
  patterns: ["build-time + client-mirrored helper (avgPrice() twin in TS and JS)"]
key-files:
  created:
    - tests/e2e/items-avg-price.test.js
  modified:
    - src/lib/items.ts
    - src/i18n/itemText.ts
    - src/components/ItemDetail.astro
    - src/components/ItemListing.astro
    - src/components/ItemFinderApp.astro
    - assets/item-finder-app.js
decisions:
  - "avgPrice() liefert number | null, niemals 0 — dieselbe Filterregel wie minPrice/maxPrice (price != null && price > 0)."
  - "Ø-Zelle traegt NIE die Klasse dp-price (nur dp-muted), damit .dp-best .dp-price::after keinen zweiten Stern in die guenstigste Zeile haengt."
  - "Karten-Zusatz (uif-card-avg) nur gerendert, wenn Ø vom Minimum abweicht — sonst reine Wiederholung."
metrics:
  duration: ~35min
  completed: 2026-08-02
status: complete
---

# Phase quick-260802-7eb Plan 01: UEX-Durchschnittspreis-Spalte fuer Items Summary

Vierte Tabellenspalte mit dem UEX-Durchschnittspreis auf allen drei Item-Preis-Oberflaechen (Datenblatt, Kategorie-Liste, Finder-Modal), vollstaendig auf Deutsch und Englisch, mit hartem Gedankenstrich statt 0 fuer preislose Items.

## Was gebaut wurde

- **`avgPrice(i: Item): number | null`** in `src/lib/items.ts`, direkt neben `minPrice`/`maxPrice`: Mittelwert ueber alle bepreisten `obtain`-Eintraege eines Items, dieselbe Filterregel (`price != null && price > 0`), `Math.round`, `null` bei leerem Preis-Set (nicht 0).
- **`thAvg`/`avgNote`** in beiden Sprachbloecken von `src/i18n/itemText.ts` (`Ø UEX` / `UEX avg`), automatisch verfuegbar auf allen drei Oberflaechen ueber `ITEM_UI[lang]` → `JS_T` → `window.__UIF.t`.
- **`ItemDetail.astro`**: vierte Spalte in der Bezugsquellen-Tabelle (`dp-muted`, NICHT `dp-price` — sonst zwei Sterne in der guenstigsten Zeile durch `.dp-best .dp-price::after`), plus bedingter Erlaeuterungssatz in der `dp-note`, wenn `avg != null`.
- **`ItemListing.astro`**: vierte Spalte in der Kategorie-Liste, Wert je Zeile unterschiedlich (anderes Item pro Zeile).
- **`assets/item-finder-app.js`**: `avgPrice(item)`-Zwilling zur TS-Fassung (identische Regel, per Kommentar als Zwilling markiert), vierte Modal-Spalte (`uif-td-avg`, einmal vor `.map()` berechnet statt je Zeile), sowie ein dezenter Ø-Zusatz auf der Ergebnis-Karte (`uif-card-avg`), der nur erscheint, wenn Ø vom "ab"-Preis abweicht.
- **`ItemFinderApp.astro`**: CSS-Regeln `.uif-td-avg`/`.uif-card-avg` (gedaempfte Farbe, vorhandene Tokens), Karten-Zusatz bei ≤480px ausgeblendet (der Fundortname darf nicht wegrutschen).
- **`tests/e2e/items-avg-price.test.js`**: 12 Pruefungen — Datenregel gegen die echte DB (min ≤ Ø ≤ max, ≥6000 preislose Items strikt `null`, Fixture-Wachhund), Beweis gegen frisches `dist/` in DE+EN (Datenblatt, Kategorie-Liste, `__UIF`-Konfigurationsblock), Mock-DOM-Tests fuer Modal und Karten-Regel. Alle Erwartungswerte werden zur Laufzeit aus `assets/universal-items.json` abgeleitet, keine Zahl ist fest verdrahtet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Item-Matching in Tests 7/8 nutzte den englischen Item-Namen statt der ID**
- **Found during:** Task 2, erster Testlauf gegen frisches `dist/`
- **Issue:** Die ursprüngliche Regex suchte in der DE-Kategorie-Liste nach `it.name` (Englisch) — die DE-Seite rendert aber `game.nameDe` ("10er-Serie-Greatsword-Kanone" statt "10-Series Greatsword Cannon"), daher schlug der Zeilenfund fehl. Zusätzlich fand eine lazy `[\s\S]*?`-Regex, die vom ersten `<tr>` im gesamten Dokument bis zur Fund-ID durchgriff, quer durch alle vorangehenden Tabellenzeilen (Header-Zeile eingeschlossen) statt nur die eine Zielzeile.
- **Fix:** Zeilen werden jetzt über die stabile Item-ID im `href`-Attribut gefunden (`findRowById`-Helfer, der zunächst alle `<tr>…</tr>`-Blöcke einzeln über eine globale, nicht-überlappende Regex extrahiert und dann filtert) — sprachunabhängig und robust gegen den abweichenden deutschen Anzeigenamen.
- **Files modified:** tests/e2e/items-avg-price.test.js
- **Commit:** bcc99b7 (im selben Commit wie Task 2, da vor dem ersten grünen Testlauf entdeckt — kein separater Fix-Commit nötig)

Ansonsten: Plan exakt wie geschrieben umgesetzt, keine architektonischen Abweichungen, keine Auth-Gates.

## Test-Ergebnisse

- `npm.cmd run build`: erfolgreich, 17365 Seiten.
- `node --test tests/e2e/items-avg-price.test.js`: 12/12 bestanden.
- `npm.cmd run test:e2e` (volle Suite, gegen frisches `dist/`): **110 bestanden, 0 fehlgeschlagen** (Basislinie 98 + 12 neue Ø-Spalten-Tests).

## Verifizierte Stichproben

- `10-series-greatsword-cannon` (4 bepreiste Quellen: 23.905/23.905/27.287/27.287 → Ø 25.596): Ø-Spalte in allen vier Zeilen, EN und DE, korrekt lokalisiert formatiert (`25,596 aUEC` / `25.596 aUEC`).
- `adp-mk4-arms-justified` (3 Loot-Quellen, kein Preis): Ø-Spalte zeigt in jeder Zeile den Gedankenstrich, DE und EN, keine 0 im HTML.
- Kategorie-Listen `vehiclegear-weapons-guns` und `armour-arms`: vierte Spalte korrekt befüllt bzw. mit Gedankenstrich, in beiden Sprachen.
- Mock-DOM: `beta-helmet` (500/800 → Ø 650) zeigt 650 in beiden Modal-Zeilen und trägt den Karten-Zusatz; `epsilon-runner` (eine Preisquelle, Ø == min) trägt ihn nicht; `gamma-jacket` (reine Loot-Zeile) zeigt den Gedankenstrich.

## Known Stubs

Keine.

## Threat Flags

Keine neue Oberfläche jenseits des im Plan dokumentierten `threat_model` (T-7eb-01/02/03) — alle drei Dispositionen (mitigate/accept) wie im Plan umgesetzt: der Ø-Wert im Client ist ausschließlich die Ausgabe von `fmtNum(Number)` bzw. eine feste HTML-Entität, nie ein String-Feld aus der Datendatei.

## Ausstehend

**Task 3 (checkpoint:human-verify, gate="blocking") ist NICHT durchgeführt** — Sichtprüfung erfordert einen Menschen. `dist/` ist frisch gebaut (siehe Test-Ergebnisse oben) und bereit für die Prüfung gemäß der `how-to-verify`-Anleitung im PLAN.md (6 Seiten in DE+EN, plus 375px-Mobilprüfung).

## Self-Check: PASSED

- FOUND: src/lib/items.ts (avgPrice-Export vorhanden)
- FOUND: src/i18n/itemText.ts (thAvg/avgNote in beiden Blöcken)
- FOUND: src/components/ItemDetail.astro (vierte Spalte)
- FOUND: src/components/ItemListing.astro (vierte Spalte)
- FOUND: src/components/ItemFinderApp.astro (CSS-Regeln)
- FOUND: assets/item-finder-app.js (avgPrice-Zwilling, Modal-Spalte, Karten-Zusatz)
- FOUND: tests/e2e/items-avg-price.test.js (12 Tests)
- FOUND: Commit aa391d8 (Task 1) in git log
- FOUND: Commit bcc99b7 (Task 2) in git log
- FOUND: dist/ frisch gebaut (letzter Build nach Task 2, vor Checkpoint-Report)
