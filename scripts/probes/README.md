# scripts/probes — Einmal-Sonden gegen die Data.p4k und die gerenderte Seite

Diese Skripte sind **keine** Teil der Build-Kette und werden von keinem `npm run`-Ziel
aufgerufen. Sie sind Untersuchungswerkzeuge: einmal geschrieben, um eine konkrete Frage
zu beantworten, und hier abgelegt, damit die Antwort reproduzierbar bleibt. Die meisten
fragen die Spieldaten; eine Sonde (seit Phase 12) misst stattdessen gegen die
**gerenderte Seite** in einem echten Browser — dieselbe Erweiterung, die
`scripts/browser-smoke.mjs` fürs Rauchtesten schon vollzogen hat.

| Skript | Frage, die es beantwortet | Ergebnis liegt in |
|---|---|---|
| `census.mjs` | Was steckt überhaupt in der Data.p4k? Alle Record-Typen, Zählungen, Feldformen. | [`docs/spieldaten-bestandsaufnahme.md`](../../docs/spieldaten-bestandsaufnahme.md) |
| `dustdevil-all.mjs` | Wie viel lässt sich über **ein** Item aus den Spieldaten wirklich zusammentragen? | [`docs/spieldaten-dustdevil-referenz.md`](../../docs/spieldaten-dustdevil-referenz.md) |
| `recipe.mjs` | Wie hängen `CraftingBlueprintRecord` und Materialien zusammen? | — (nur Konsolenausgabe) |
| `mining-locview-messung.mjs` | Halten die neun 🧪-backstop-Zusicherungen der Fundort-Ansicht (Phase 12, UI-SPEC „UI Considerations") am GERENDERTEN Bildpunkt — Spurenzeilen-Kontrast in beiden Farbmodi, Kopf-/Zeilenhöhen, Bildlauf, Dreifach-Überlagerung auf der Kachel? Braucht `playwright-core` + einen installierten Chrome/Edge gegen eine echte Vorschau. | [`.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/12-03-SUMMARY.md`](../../.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/12-03-SUMMARY.md) |
| `schiffskarte-messung.mjs` | Haelt die Schiffs-Detailseite (Phase 14, „Schiffs-Datenkarte entstapeln") die Hoehen-Sperrklinke (Carrack bei 1280×720 dunkel ≤ 4.200 px), die Sprungleisten-Backstops bei 360 px und den Kontrast des Kapitel-Zahl-Chips — am gerenderten Bildpunkt, in drei aus den Daten gewaehlten Schiffen, zwei Sprachen, zwei Breiten, zwei Farbmodi? `--baseline` reproduziert stattdessen nur die Ausgangsmessung (kein Urteil). Braucht `playwright-core` + einen installierten Chrome/Edge gegen eine echte Vorschau. | [`.planning/phases/14-schiffs-datenkarte-entstapeln/14-01-SUMMARY.md`](../../.planning/phases/14-schiffs-datenkarte-entstapeln/14-01-SUMMARY.md) und spaeter [`14-04-SUMMARY.md`](../../.planning/phases/14-schiffs-datenkarte-entstapeln/14-04-SUMMARY.md) |
| `schiffskonsole-messung.mjs` | Belegen die drei bindenden Punkte P-1/P-2/P-3 aus `16-UI-SPEC.md` § 3a (Phase 16, „Das Schiff ist die Navigation") am ARTEFAKT statt aus der Konfiguration: `--census` (kein Browser) zaehlt am ausgelieferten `#holodata` in `dist/`, rechnet drei P-3-Varianten aus der Quelle nach und prueft sie gegen; ohne `--census` misst sie am gerenderten Bildpunkt (Fuellgrad, Markergroesse, Dauerlabels, Buehnenbreite) gegen einen laufenden Vorschau-Server. Braucht `playwright-core` + einen installierten Chrome/Edge fuer den Browser-Teil. | [`16-01-SUMMARY.md`](../../.planning/phases/16-das-schiff-ist-die-navigation/16-01-SUMMARY.md) |
| `missionsorte-messung.mjs` | Wie viele der 1.347 Missionsfamilien in `src/data/missions.json` tragen eine Ortsangabe (Phase 18, „Missionen wissen, wo sie spielen"), und wie sieht der Ortskatalog/die Token-Haeufigkeit aus? Liest AUSSCHLIESSLICH die committete `missions.json` — kein p4k, kein Browser, keine lokale Spielinstallation noetig. Erste Sonde des Bestands, die nur ein committetes Artefakt liest. | [`18-01-SUMMARY.md`](../../.planning/phases/18-missionen-wissen-wo-sie-spielen/18-01-SUMMARY.md) |

Aufruf, jeweils aus dem Projektwurzelverzeichnis:

```
node scripts/probes/census.mjs
node scripts/probes/mining-locview-messung.mjs --base http://localhost:4321
node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4321 --baseline
node scripts/probes/schiffskonsole-messung.mjs --census
node scripts/probes/schiffskonsole-messung.mjs --base http://localhost:4321
node scripts/probes/missionsorte-messung.mjs
```

Die datengetriebenen Sonden lesen über `scripts/lib/p4k.mjs` und `scripts/lib/datacore.mjs`
direkt aus der installierten `Data.p4k` und schreiben **nichts** in den Arbeitsbaum — die
Ausgabe geht auf die Konsole und wurde von Hand in die obigen Dokumente übernommen. Die
seitengetriebene Sonde startet stattdessen einen echten, installierten Browser gegen eine
laufende Vorschau (kein Bau-Container hat einen Browser) und liest Bildpunkte über `sharp`;
auch sie schreibt nichts in den Arbeitsbaum.

Nach einem Spiel-Patch bzw. einer Layout-/Farbänderung geben sie andere Zahlen aus. Das
ist der Zweck: die Dokumente tragen ihren Stand im Kopf, und ein erneuter Lauf zeigt, was
sich verschoben hat.
