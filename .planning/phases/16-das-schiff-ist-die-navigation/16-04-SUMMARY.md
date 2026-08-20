# 15-04 — Konsolen-Raster, Einfachauswahl, Scroll-Laden, Hochformat

**Abgeschlossen:** 2026-08-20
**Plan:** `16-04-PLAN.md`
**Commits:** `21cb059`, `dde04e0`, `318d4f1`

---

## Was gebaut wurde

- **Das Raster (D-01).** Rail links, Bühne Mitte, Auslesung rechts; genau eine
  Gruppe ist sichtbar. Die Auslesung beantwortet Gruppe **und** Einzelteil aus
  derselben Spalte, statt zwei getrennte Orte zu führen.
- **Umhängen statt Kopieren.** Die Systemabschnitte werden per `appendChild`
  verschoben, nicht dupliziert — derselbe Knoten, kein zweiter im DOM. Kein
  Bauteiltext steht danach zweimal.
- **`#holoact` ersatzlos entfernt.** Der „Hologramm aktivieren"-Knopf war
  funktionslos und saß bei 360 px mitten auf dem Schiff. Er fällt mit D-04 weg,
  nicht durch einen Zwischen-Fix.
- **D-04 per `IntersectionObserver`.** Kein Startknopf mehr.
- **Die Bühne startet als Mesh** (`data-default="holo"` statt `"video"`), damit
  die Rail beim ersten Blick auf etwas zeigt.
- **D-05: hochformatige Bühne bei schmalen Breiten** — 360 × 542 statt
  querformat.

## Gemessen, nicht behauptet

**D-05 / P-1** — Füllgrad über `window.__holoViewer.metrics()` gegen das gebaute
`dist/`. Vergleichsmarke: `.planning/WINDOWS.md` id 21.

| Schiff | 360 px vorher | 360 px nachher | 414 px | 1280 px |
| --- | --- | --- | --- | --- |
| anvl-carrack | 55,4 % | **92,5 %** | 92,7 % | 72,5 % |
| drak-ironclad | 53,5 % | **91,8 %** | 92,2 % | 70,9 % |
| argo-csv-cargo | 76,4 % | **92,6 %** | 92,8 % | 90,9 % |

**P-1 (≥ 70 %) ist bei jeder geprüften Breite für alle drei Prüfschiffe
erfüllt** — vorher verfehlten zwei von drei die Marke.

**`verify:shipconsole --report`** — alle acht Zusicherungen sauber, obwohl das
Tor planmäßig bis Welle 5 ausgesetzt bleibt:

| Zusicherung | Ergebnis |
| --- | --- |
| Bestand | 454 Seiten |
| Konsolen-Gerüst | 0 Verstöße |
| Rail ↔ Abschnitt (Bijektion) | 3.304 Paare, 0 Verstöße |
| Kein Rail-Eintrag ohne Marker (P-3) | 1.652 Gruppen, 0 Abweichungen |
| Ohne JavaScript sichtbar (D-02) | 0 `hidden`, 0 `<template>` |
| Textbestand | min 3.224 · Median 4.777 · max 5.536 (vorher 3.177 / 4.652 / 5.391) |
| Sprachparität | 227 Paare, 0 Abweichungen |
| Zombie-Wächter | 0 Ausnahmen registriert |

**D-04, Netzverkehr** — beim `load`-Ereignis: `three.module.min.js` = 0,
GLB = 0, `holo-viewer.js` = 0. Alle drei treffen innerhalb von rund vier
Sekunden danach ein. Die Verzögerung greift.

**Tor** — `npm run build && npm run gate` grün (19/19, 323 s), ebenso der
Vorschau-Bau mit `STAGING=1`.

## Befund an den Betreiber

**`.planning/WINDOWS.md` id 22 — D-04 ist wörtlich erfüllt, aber wirtschaftlich
hohl.** `#holostage` steht bei `top: 56 px` und ist bei 1280 px wie bei 360 px
vom ersten Moment an im Blick. Der Beobachter feuert deshalb für jeden Besucher
sofort; jeder Aufruf lädt rund 730 KB (three.js 360 KB + GLB im Median 0,37 MB).
Die beabsichtigte Ersparnis „wer nie hinunterscrollt, lädt nichts" tritt nicht
ein — nicht wegen eines Fehlers, sondern weil die Bühne nach D-01 das erste
Element der Seite IST. Das ist eine Produktentscheidung, keine Aufgabe.

## Abweichungen

**Drei Zusicherungen der Sonde waren veraltet und wurden repariert, nicht
umgangen.** Sie meldeten Befunde, die keine waren:

1. **`drak-ironclad` lief in einen Timeout** bei jeder Breite. Das Schiff
   rendert einwandfrei (Canvas 740 × 450, null Konsolenfehler, null
   fehlgeschlagene Anfragen) — die Sonde wartete auf eine Bedingung der ALTEN
   Rail. Im gebauten HTML heißt die Rail jetzt `.holo__rail` (32 Vorkommen) mit
   `.holo__sys` (37); `.holo__layer` überlebt nur noch 3-mal als Restbestand.
2. **Die Gegenprobe ohne JavaScript** verlangte „gleich viele sichtbare
   Abschnitte mit und ohne JS" — eine Annahme aus Welle 3, als noch nichts
   umgehängt wurde. Welle 4 zeigt bewusst **genau einen**. Ohne JS alle, mit JS
   einer ist der richtige Zielzustand unter D-01 + D-02; die Zusicherung wurde
   umgedreht.
3. **Der Netzverkehrsnachweis** meldete `three.module.min.js=1` „am
   `load`-Ereignis". Sein Erfassungsfenster reichte über `load` hinaus.
   Unabhängig nachgemessen: 0 bei `load`, 1 kurz danach.

Die Sonde wurde außerdem auf `page.route()`-Injektion umgebaut, weil das
zuverlässiger arbeitet als die vorherige Methode.

**Ausführung durch den Orchestrator abgeschlossen.** Zwei Executor-Läufe sind an
Sitzungslimits gestorben, ein dritter hing in einer Schleife (viermal
hintereinander `npm run gate` in den Hintergrund geschickt und sich darauf
zurückgemeldet, ohne zu committen — 626.000 Token, 278 Werkzeugaufrufe, null
Commits). Der Orchestrator hat die Abnahme selbst gefahren und die Arbeit
gesichert.

## Messfalle fürs Protokoll

⚠ **`npx serve` wirft bei `.html` die Abfrage weg.** Ohne `?holometrics` wird
`window.__holoViewer` nie gesetzt, die Sonde läuft in einen `waitForFunction`-
Timeout, und das sieht aus wie ein kaputtes Schiff. Diese Messung braucht
`astro preview`, nicht `serve`. Hat zwei Läufe gekostet.

## Artefakte dieser Welle

- Klassen: `.holo__rail`, `.holo__sys`, `.holo__readout`, `.holo__toggle`
- Anker-ids: `sys-core`, `sys-arms`, `sys-prop`, `sys-other`
- Entfernt: `.holo__activate` / `#holoact`
- Messgriff: `window.__holoViewer` (nur unter `?holometrics`)
- Ledger: `.planning/WINDOWS.md` id 22
