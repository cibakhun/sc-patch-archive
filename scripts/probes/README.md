# scripts/probes — Einmal-Sonden gegen die Data.p4k

Diese Skripte sind **keine** Teil der Build-Kette und werden von keinem `npm run`-Ziel
aufgerufen. Sie sind Untersuchungswerkzeuge: einmal geschrieben, um eine konkrete Frage
an die Spieldaten zu stellen, und hier abgelegt, damit die Antwort reproduzierbar bleibt.

| Skript | Frage, die es beantwortet | Ergebnis liegt in |
|---|---|---|
| `census.mjs` | Was steckt überhaupt in der Data.p4k? Alle Record-Typen, Zählungen, Feldformen. | [`docs/spieldaten-bestandsaufnahme.md`](../../docs/spieldaten-bestandsaufnahme.md) |
| `dustdevil-all.mjs` | Wie viel lässt sich über **ein** Item aus den Spieldaten wirklich zusammentragen? | [`docs/spieldaten-dustdevil-referenz.md`](../../docs/spieldaten-dustdevil-referenz.md) |
| `recipe.mjs` | Wie hängen `CraftingBlueprintRecord` und Materialien zusammen? | — (nur Konsolenausgabe) |

Aufruf, jeweils aus dem Projektwurzelverzeichnis:

```
node scripts/probes/census.mjs
```

Sie lesen über `scripts/lib/p4k.mjs` und `scripts/lib/datacore.mjs` direkt aus der
installierten `Data.p4k` und schreiben **nichts** in den Arbeitsbaum — die Ausgabe geht
auf die Konsole und wurde von Hand in die obigen Dokumente übernommen.

Nach einem Spiel-Patch geben sie andere Zahlen aus. Das ist der Zweck: die Dokumente
tragen ihren Stand im Kopf, und ein erneuter Lauf zeigt, was sich verschoben hat.
