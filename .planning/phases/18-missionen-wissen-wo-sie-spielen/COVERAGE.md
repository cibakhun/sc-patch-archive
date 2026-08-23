# Phase 18 — API-Abdeckung

No external API integration: Die Phase liest ausschliesslich lokale Spieldateien und committete JSON-Bestaende und schreibt statische JSON-Dateien fuer die vorgerenderte Website; Fremdquellen wie UEX oder die Wiki werden nicht angefasst, und `npm run sync:item-prices` sowie `npm run sync:refinery` sind in den Plaenen ausdruecklich ausgeschlossen.

## Nachgeprueft

- `scripts/datamine-missions.mjs`, `scripts/build-universal-db.mjs`, `scripts/datamine-crafting.mjs` und `scripts/build-refinery-data.mjs` beziehen ihre Eingaben aus `Data.p4k`, `build_manifest.id` und bereits committeten Dateien unter `assets/` bzw. `src/data/`.
- `scripts/verify-datastand.mjs` (neu, Plan 04) liest committete JSON-Dateien und — hinter einem Vorhandenseins-Gatter — eine lokale Manifest-Textdatei. Es ist bewusst ohne Fremdquellen-Zugriff entworfen, damit es auf Schiene A auch in der Bauumgebung wirkt.
- Die Oberflaechen-Aenderungen (Ortsfilter, Marken-Beschriftung) laufen ueber serverseitig gerendertes Astro-Markup und ein bestehendes clientseitiges Ein-/Ausblenden ueber Datenattribute — kein Abruf zur Laufzeit.
- Der einzige Erzeuger mit Fremdquellen-Zugriff im Umfeld dieser Phase ist der Preis-Abruf vor `build-refinery-data.mjs` bzw. `build-universal-db.mjs`. Er wird in Plan 03 ausdruecklich NICHT gefahren; die Plaene benutzen die bereits committeten Preisdaten.
