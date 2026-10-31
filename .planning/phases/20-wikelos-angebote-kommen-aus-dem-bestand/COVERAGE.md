# Phase 20 — API-Abdeckung

No external API integration: Diese Phase liest ausschliesslich lokale Spieldateien (`assets/wikelo-gamefiles.json`, erzeugt aus der lokalen `Data.p4k`) und eine kuratierte lokale JSON-Datei (`assets/wikelo-curated.json`) und schreibt daraus statische JSON-Dateien fuer die vorgerenderte Website — kein Fremddienst, kein Netzaufruf in der Build-Kette.

## Nachgeprueft

- `scripts/build-wikelo-trades.mjs` (Task 1) liest ausschliesslich zwei lokale Dateien (`assets/wikelo-gamefiles.json`, `assets/wikelo-curated.json`) und schreibt zwei lokale Dateien (`assets/wikelo-trades.json`, `assets/wikelo-trades.meta.json`) — kein `fetch`, kein `http`-Modul, kein Kindprozess.
- `scripts/datamine-wikelo.mjs` (unveraendert, Vorbedingung fuer Task 1) liest `Data.p4k` lokal und schreibt `assets/wikelo-gamefiles.json` — dieselbe lokale Zugriffsschicht wie alle anderen `datamine-*.mjs`-Skripte des Projekts.
- Der einzige Netzzugriff im Umfeld dieser Phase steckt in `20-RESEARCH.md`: die beiden diagnostischen Sonden `scripts/probes/wikelo-dreivergleich.mjs` und `scripts/probes/wikelo-mengen-abgleich.mjs` fragen read-only die MediaWiki-API von `starcitizen.tools` ab, um D-02/D-03 sichtungsseitig zu stuetzen. Das ist die vom automatischen Erkenner getroffene Fundstelle (das Substantiv „api" in der Recherche) — die Sonden sind Messwerkzeuge der Recherche, weder Teil der Build-Kette (`scripts/build-wikelo-trades.mjs`, `sync:wikelo`) noch des Auslieferungs-Tors (`npm run gate`, `npm run gate:data`).
