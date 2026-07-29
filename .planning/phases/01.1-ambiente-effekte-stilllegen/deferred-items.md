# Deferred Items — Phase 01.1

Aus 01.1-01 (Ausführung). Out-of-scope-Funde: nicht behoben, nur dokumentiert
(Scope-Boundary-Regel des Executors — nur Fehler, die DIREKT durch die
aktuellen Task-Änderungen entstehen, werden automatisch behoben).

## `npm run test:e2e` — 11 vorbestehende Fehlschläge, unabhängig von 01.1-01

Beim Ausführen von Task 3 (`node --test tests/e2e/**/*.test.js`) zeigt der
volle Testlauf 11 Fehlschläge außerhalb der neuen `fx-gate.test.js`. Keiner
davon berührt eine der acht in `01.1-01-PLAN.md` `files_modified` genannten
Dateien — sie betreffen ausschließlich `assets/item-finder-app.js`,
`assets/universal-items.json` und die daraus gebauten Item-Finder-Seiten.

**Root Cause (verifiziert):** `dist/de/item-finder.html` (und vermutlich
`dist/item-finder.html`) betten `"dbUrl":"/assets/universal-items.json?v=<hash>"`
ein — der Cache-Bust-Query-String kam durch eine andere, nicht mit dieser
Phase zusammenhängende Änderung hinzu. Die Tests erwarten den Literal-String
`"dbUrl":"/assets/universal-items.json"` OHNE `?v=`, dadurch schlagen
mehrere Prüfungen fehl, die auf dieser Erwartung aufbauen (Fixture-Rendering,
Modal-Öffnen, DB-Integrität, Seiten-Konfiguration).

**Betroffene Suiten (aus dem vollen Testlauf, vor 01.1-01 bereits so):**
- `tests/e2e/behavior.test.js` → "Laden & Grundzustand" (1 Subtest),
  "Detail-Modal" (6 Subtests), "Universal Items DB — Integrität der
  Einträge" (1 Subtest)
- `tests/e2e/layout.test.js` → "Item-Finder-Seite (DE)" (2 Subtests)

**Warum out of scope:** 01.1-01 ändert `src/layouts/Layout.astro`,
`src/components/FxToggle.astro`, `src/components/SiteNav.astro`,
`src/i18n/ui.ts`, `assets/detail.js`, `assets/detail.css`,
`tests/e2e/helpers/fx-dom.js`, `tests/e2e/fx-gate.test.js` — keine davon
berührt `item-finder-app.js`, `universal-items.json` oder deren Cache-Bust.
Die neuen `fx-gate.test.js`-Testfälle (6/6) laufen isoliert grün
(`node --test tests/e2e/fx-gate.test.js`).

**Empfehlung:** eigener Fix-Task/-Plan außerhalb von Phase 01.1 — entweder
die Testerwartung auf den Cache-Bust-String anpassen (`?v=` mit Wildcard/
Regex statt Literal-Vergleich) oder die Cache-Bust-Quelle klären.
