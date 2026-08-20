---
phase: 16-das-schiff-ist-die-navigation
plan: 03
subsystem: ui
tags: [astro, i18n, ship-console, no-js, playwright, probe]

requires:
  - phase: 16-das-schiff-ist-die-navigation
    provides: "15-01: P-3 entschieden (Variante C), P-1/P-2 gemessen; 15-02: verify:shipconsole angelegt und vorgefuehrt rot, ausgesetzt bis 15-05"
provides:
  - "Vier Systemabschnitte (section.holo__sys, id sys-core/sys-arms/sys-prop/sys-other) im ausgelieferten HTML aller 454 Seiten -- sichtbar ohne JavaScript, kein Versteck-Attribut, keine Vorlagenhuelle (D-02)"
  - "Rail (nav.holo__rail) als reine Anker-Liste, ersetzt den schwebenden Ebenen-Kasten -- funktioniert vollstaendig ohne Skript"
  - "Bewaffnung und Bauteilliste sind vollstaendig aus ch-gear in die Konsole gewandert, an genau einer Stelle der Seite -- verify:shipcard sieht in beide Bloecke und bleibt gruen"
  - "verify:shipconsole --report meldet nach diesem Plan 0 Befunde in allen acht Zusicherungen (bleibt bis 16-05-PLAN.md ausgesetzt)"
  - "D-02 mit ABGESCHALTETEM JavaScript am gebauten dist/ bewiesen (Messgruppe j-ohne-javascript), nicht durch Lesen des Codes -- 36/36 Anker-Spruenge landen am Abschnitt, Gegenprobe mit JavaScript liefert dieselbe Abschnittszahl"
  - "Textbestand ueber alle 454 Seiten NICHT geschrumpft: min 3177->3242, median 4652->4798, max 5391->5557, Carrack DE 4971->5157 Bytes (Messgruppe k-textbestand-danach)"
affects: [15-04-das-schiff-ist-die-navigation, 15-05-das-schiff-ist-die-navigation]

tech-stack:
  added: []
  patterns:
    - "Hoehe/Beschnitt eines wachsenden Containers gehoeren an die INNERE Buehne, nicht an den AEUSSEREN Block, sobald der aeussere Block mit neuem Inhalt wachsen soll -- sonst rutschen bottom-verankerte Dekorationen (.holo__grid/.holo__pad/.holo__toggle) an den neuen, falschen Fuss"
    - "Rail als reine Anker-Liste (nav > a[href=#id]) statt Button-plus-JS-Toggle -- dasselbe Muster wie die Kapitel-Sprungleiste aus Phase 14, funktioniert ohne Skript und wird erst in einer spaeteren Welle progressiv erweitert"
    - "location.hash setzen statt locator.click() fuer Playwright-Anker-Spruenge -- vermeidet den Konflikt zwischen Playwrights Scroll-in-View-Stabilitaetswarten und CSS scroll-behavior:smooth"
  data-media-surface:
    - "[data-media-surface] (theme.css 'Dunkle Inseln') remapped --text/--muted/--line/--bg/--bg-2/--accent/--accent-2 fuer ALLE Nachfahren automatisch, auch im Hellmodus -- neue CSS in section.holo braucht dafuer KEINE eigene Farbregel"

key-files:
  created: []
  modified:
    - src/components/ShipDetail.astro
    - src/i18n/ui.ts
    - scripts/probes/schiffskonsole-messung.mjs
    - .planning/phases/16-das-schiff-ist-die-navigation/deferred-items.md

key-decisions:
  - "Zwei zusaetzliche bottom-verankerte Dekorationen (.holo__toggle) mussten wie die im Plan genannten .holo__grid/.holo__pad in .holo__wrap wandern -- .holo__frame/.holo__hud/.holo__dims (top-verankert) blieben bewusst aussen, weil ihre Positionierung durch das Wachstum von .holo NICHT bricht"
  - "prop/other bekommen eine neue Klasse .holo__sys-list/.holo__sys-row statt die Bewaffnungs-spezifischen arm__*-Klassen wiederzuverwenden -- strukturgleiche Formel (Anzahl+Art gruppiert), aber eigener Klassenname, weil arm__scell semantisch an Bewaffnung gebunden ist"
  - "Playwrights locator.click() fuer die Anker-Sprung-Pruefung durch location.hash-Navigation + Scroll-Stillstands-Polling ersetzt -- die urspruengliche Klick-Kette liess spaetere Rail-Anker bis zum 30s-Timeout haengen (Automatisierungs-Artefakt aus dem Zusammenspiel mit scroll-behavior:smooth, kein Produktfehler)"
  - "Vorher-Werte fuer Messgruppe k-textbestand-danach aus den bereits in 16-01-SUMMARY.md/16-02-PLAN.md protokollierten Zahlen uebernommen (3177/4652/5391/4971), keine risikoreiche Neumessung gegen einen temporaer ausgecheckten Vorzustand"

requirements-completed: [D-02, D-01, P-3]

coverage:
  - id: D1
    description: "Jedes System steht als eigener, sichtbarer section.holo__sys im ausgelieferten HTML, ohne Versteck-Attribut, ohne Vorlagenhuelle -- 454/454 Seiten, Verteilung 4=179/3=20/2=22/1=6 je Sprache (exakt die Welle-1-Messung)"
    requirement: "D-02"
    verification:
      - kind: automated
        ref: "node scripts/verify-shipconsole.mjs --report (Zusicherung 2/5: 0 Befunde)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-02 mit ABGESCHALTETEM JavaScript am gebauten dist/ bewiesen, nicht durch Lesen des Codes -- Kopfzeile der Sonde druckt den Kontextzustand"
    requirement: "D-02"
    verification:
      - kind: automated_ui
        ref: "node scripts/probes/schiffskonsole-messung.mjs (Messgruppe j-ohne-javascript, 3 Schiffe x 2 Sprachen x 2 Breiten, 36/36 Anker-Spruenge bestanden)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bewaffnung und Bauteilliste stehen an genau einer Stelle der Seite -- kein Zahl-plus-Einheit-Token gleichzeitig in der Konsole und im Ausstattungs-Kapitel"
    requirement: "D-01"
    verification:
      - kind: automated
        ref: "node scripts/verify-shipcard.mjs (Zusicherung 6, 0 Befunde ueber 2827 Token)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Kein Systemeintrag ohne Marker (P-3): Rail-Zaehl-Chip == Portzahl der Gruppe im ausgelieferten holodata, > 0"
    requirement: "P-3"
    verification:
      - kind: automated
        ref: "node scripts/verify-shipconsole.mjs --report (Zusicherung 4: 1652 Gruppen geprueft, 0 Abweichungen, kleinste Markerzahl 1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Der indexierbare Textbestand je Seite ist NICHT kleiner geworden -- Tabelle vorher/nachher"
    requirement: "Erfolgskriterium 3"
    verification:
      - kind: automated
        ref: "node scripts/probes/schiffskonsole-messung.mjs --census (Messgruppe k-textbestand-danach: min/median/max/Carrack-DE alle gestiegen)"
        status: pass
    human_judgment: false

duration: ~90min
completed: 2026-08-20
status: complete
---

# Phase 16 Plan 3: Die Konsole ohne JavaScript -- vier Systemabschnitte, Rail als Ankerliste, D-02 gemessen Summary

**D-02 ist die Bedingung, unter der D-01 sicher ist -- und sie ist nach diesem Plan gemessen erfuellt: alle 454 Schiffsseiten zeigen ihre Systeme mit ABGESCHALTETEM JavaScript als lesbare Liste, der Textbestand ist durchgehend gewachsen statt geschrumpft, und `verify:shipconsole --report` meldet bereits 0 Befunde in allen acht Zusicherungen -- vier Wellen vor dessen Scharfschaltung.**

## Performance

- **Duration:** ~90min
- **Completed:** 2026-08-20T09:48:58Z
- **Tasks:** 2/2
- **Files modified:** 3 (Task 1: 2, Task 2: 1) + 1 Deferred-Dokument

## Accomplishments

- **Vier Systemabschnitte serverseitig gerendert** (`section.holo__sys`, `id="sys-core"`/`"sys-arms"`/`"sys-prop"`/`"sys-other"`): arms/core uebernehmen ihren Koerper (armStats/armament bzw. slots) UNVERAENDERT aus dem fruehereren Ausstattungs-Kapitel — keine zweite Aggregation derselben Aussage. prop/other bekommen zum ersten Mal eine ausgeschriebene Stueckzahl-Liste (`sysKindCounts()`), dieselbe Formel wie `armStats`, nur auf eine bisher nicht ausgeschriebene Gruppe angewendet.
- **Rail als reine Anker-Liste** (`nav.holo__rail`, `id="holorail"`) ersetzt den schwebenden Ebenen-Kasten (`#holofilters`/`.holo__layers`) samt seinem eingeklappten mobilen Zustand — funktioniert vollstaendig ohne Skript, exakt das Muster der Kapitel-Sprungleiste aus Phase 14.
- **`.holo` darf wachsen**: Hoehe und Beschnitt wandern von `.holo` auf `.holo__wrap` (die Buehne selbst bleibt unveraendert gross). Beim Bildpunkt-Audit fielen ZWEI bottom-verankerte Dekorationen auf, die mitwandern mussten — die im Plan genannten `.holo__grid`/`.holo__pad` UND zusaetzlich `.holo__toggle` (Video/Bilder/3D-Umschalter), das derselben Falle unterlag, aber im Plantext nicht erwaehnt war (siehe Deviations).
- **Kapitel-Umzug abgeschlossen**: Bewaffnung ist vollstaendig aus `ch-gear` entfernt (steht nur noch in der Konsole); die Bauteilliste ebenfalls; die Widerstandswerte (Huelle/Schild) bleiben im Kapitel und bekommen eine eigene Ueberschrift (`ship.defense.title`, neuer Schluessel) statt ueberschriftslos anzufallen. `ch-gear` traegt danach drei statt vier Unterabschnitte.
- **Vier neue i18n-Schluessel** (`ship.console.rail.aria`, `ship.console.readout.aria`, `ship.console.count`, `ship.defense.title`), je DE und EN. `holo.filter.aria`/`holo.layers.title` als verwaist markiert (der Kasten, den sie beschrifteten, ist entfallen).
- **D-02 mit abgeschaltetem JavaScript bewiesen**: neue Messgruppe `j-ohne-javascript` (`newContext({ javaScriptEnabled: false })`) prueft an drei Pruefschiffen (Carrack/argo-csv-cargo/Ironclad) x zwei Sprachen x zwei Breiten (1280/360px): sichtbare Systemabschnitte == Rail-Laenge, jede Hoehe > 0, kein leerer Text, jeder Rail-Anker zeigt auf eine vorhandene id, kein waagerechter Ueberlauf, UND 36/36 tatsaechliche Anker-Spruenge landen am Zielabschnitt. Gegenprobe im selben Lauf MIT JavaScript liefert dieselbe Abschnittszahl (0 Abweichungen — in dieser Welle wird noch nichts versteckt).
- **Textbestand gewachsen statt geschrumpft**: neue Messgruppe `k-textbestand-danach` stellt den Ausgangswert (min 3177/median 4652/max 5391/Carrack-DE 4971 Bytes, protokolliert in 15-01/15-02) dem Nachher-Wert gegenueber: min 3242 (+2,0%), median 4798 (+3,1%), max 5557 (+3,1%), Carrack-DE 5157 (+3,7%) — kein Wert kleiner geworden, ein leichter Anstieg wie im Plan erwartet.
- **`verify:shipconsole --report` meldet bereits 0 Befunde** in allen acht Zusicherungen nach diesem Plan (Rail<->System-Bijektion, P-3-Markerzahl, D-02-Sichtbarkeit, Textbestands-Klinke, Sprachparitaet) — das Tor bleibt trotzdem bis `16-05-PLAN.md` ausgesetzt, weil dessen Scharfschaltung eine bewusste, geplante Reihenfolge ist (Praezedenz `verify:shipcard` 14-01->14-04) und der No-JS-Beweis dieser Sonde vorbehalten war.

## Task Commits

1. **Task 1: Vier Systemabschnitte im ausgelieferten HTML, die Rail als Ankerliste, der Umzug aus dem Kapitel** - `8f50e68` (feat)
2. **Task 2: Der Beweis mit abgeschaltetem JavaScript — und die Textbestandsmessung danach** - `cfd4878` (docs)

**Plan metadata:** siehe unten (dieser Commit)

## Files Created/Modified

- `src/components/ShipDetail.astro` - `.holo`/`.holo__wrap` Hoehe/Beschnitt getauscht; `.holo__grid`/`.holo__pad`/`.holo__toggle` in `.holo__wrap` verschoben; `.holo__layers`/`.holo__layer*`-CSS ersetzt durch `.holo__rail*`; neue `.holo__sys*`-CSS; vier `section.holo__sys` + `nav.holo__rail` als Markup; `sysKindCounts()`/`sysPortCount()`-Helfer; Bewaffnungs-Unterabschnitt aus `ch-gear` entfernt; Komponenten&Verteidigung zu reinem Verteidigungs-Unterabschnitt reduziert; `gearArms`/`gearComp` durch `gearDefense` ersetzt; tote `#holofilters`-JS-Referenzen entfernt (Ein-/Ausblenden, Einklapp-Umschalter, Mehrfachauswahl-Klick-Handler)
- `src/i18n/ui.ts` - vier neue Schluessel `ship.console.rail.aria`/`ship.console.readout.aria`/`ship.console.count`/`ship.defense.title`, je DE und EN; `holo.filter.aria`/`holo.layers.title` als verwaist markiert
- `scripts/probes/schiffskonsole-messung.mjs` - Messgruppe `k-textbestand-danach` (Familie A, dist-Scan) und `j-ohne-javascript`/`j-ohne-javascript-gegenprobe` (Familie B, JS-abgeschalteter Kontext) ergaenzt; `PRUEFBREITEN_J`-Konstante
- `.planning/phases/16-das-schiff-ist-die-navigation/deferred-items.md` - toten CSS-Fund (`.sd__ch2col .sd__slots`/`.arm__sum`) dokumentiert, nicht behoben

## Decisions Made

- **`.holo__toggle` zusaetzlich zu `.holo__grid`/`.holo__pad` verschoben** — siehe Deviations, Rule 1.
- **prop/other bekommen eigene Klassen (`.holo__sys-list`/`.holo__sys-row`)** statt die Bewaffnungs-spezifischen `arm__*`-Klassen zweckzuentfremden — strukturgleiche Formel, eigener, unmissverstaendlicher Klassenname.
- **Anker-Sprung-Pruefung ohne `locator.click()`** — siehe Deviations, Rule 1.
- **`.sd__ch2col`-Feinabstimmungen fuer `sd__slots`/`arm__sum` NICHT entfernt** — tote CSS, aber ausserhalb der Task-1-Anweisung; dokumentiert in `deferred-items.md` statt riskant angefasst.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `.holo__toggle` ist ebenfalls bottom-verankert und musste mit .holo__grid/.holo__pad in .holo__wrap wandern**
- **Found during:** Task 1, SCHRITT 1, beim Pruefen aller `position:absolute`-Kinder von `.holo` auf `bottom`-Verankerung (dieselbe Fallenklasse wie die im Plan explizit genannten Dekorationen)
- **Issue:** `.holo__toggle{position:absolute;right:26px;bottom:24px}` (Video/Bilder/3D-Umschalter) war — wie `.holo__grid`/`.holo__pad` — direktes Kind von `section.holo`, nicht von `.holo__wrap`. Waechst `.holo` mit den neuen Systemabschnitten/der Rail (SCHRITT 1), waere der Umschalter an den Fuss des GESAMTEN, jetzt viel hoeheren Blocks gerutscht statt am unteren Rand der Buehne zu bleiben — exakt dieselbe Bug-Klasse, die der Plan fuer `.holo__grid`/`.holo__pad` benennt, nur an einem im Plantext nicht aufgezaehlten dritten Element.
- **Fix:** Markup von `.holo__toggle` in `.holo__wrap` verschoben (kein CSS-Aenderung noetig, die Positionierung selbst war schon korrekt — nur der falsche Elternknoten). `.holo__frame`/`.holo__hud`/`.holo__dims` (alle top-verankert) blieben bewusst aussen, weil ihre Positionierung durch das Wachstum NICHT bricht.
- **Files modified:** `src/components/ShipDetail.astro`
- **Verification:** visuelle Pruefung durch Code-Audit aller `position:absolute`-Regeln in `.holo`-Kontext auf `top`- vs. `bottom`-Verankerung; `npm run build && npm run gate` gruen, `verify:shipcard`/`verify:shipconsole --report` unberuehrt (reine Positionierungs-Korrektur, keine neue Klasse/kein neuer Selektor).
- **Committed in:** `8f50e68` (Task 1 commit)

**2. [Rule 1 - Bug] `locator.click()` liess spaetere Rail-Anker-Klicks in der No-JS-Messung bis zum 30s-Timeout haengen**
- **Found during:** Task 2, erster voller Browserlauf von Messgruppe j-ohne-javascript
- **Issue:** Das urspruengliche Verfahren klickte jeden Rail-Anker sequentiell per `locator.click()`. Nach dem ersten Klick loeste Playwrights eigene Scroll-in-View-Wartelogik in Kombination mit dem site-weiten CSS `scroll-behavior:smooth` (`@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}`) eine Instabilitaets-Schleife aus: das Ziel-Element bewegte sich waehrend der Animation kontinuierlich, Playwrights Stabilitaetspruefung wartete den vollen 30s-Timeout ab, bevor sie aufgab. 16 von 36 Anker-Spruengen scheiterten im ersten Lauf, davon einige nur knapp ausserhalb der Toleranz (top=270-295px statt erwartet nahe 0), weil die feste 300ms-Wartezeit nach dem Klick fuer laengere Scrollstrecken nicht ausreichte.
- **Fix:** Klick-Choreographie durch dieselbe Navigation ohne Playwrights Element-Interaktions-Maschinerie ersetzt: `location.hash` per `page.evaluate()` setzen (funktioniert auch im JS-abgeschalteten Kontext — Playwrights `evaluate()` laeuft ueber CDP unabhaengig vom `javaScriptEnabled`-Schalter der Seite, wie bereits die vorangehende `.holo__sys`-Messung im selben Lauf zeigt), danach auf Scroll-Stillstand gepollt (bis zu 1,5s, `window.scrollY` zwei aufeinanderfolgende identische Werte) statt eine feste Zeit zu raten.
- **Files modified:** `scripts/probes/schiffskonsole-messung.mjs`
- **Verification:** Erneuter Lauf gegen `anvl-carrack` (`--only`): 16/16 Anker-Spruenge bestanden, 0 Fehlschlaege. Voller Lauf gegen alle drei Pruefschiffe: 36/36 Anker-Spruenge bestanden.
- **Committed in:** `cfd4878` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (beide Rule 1 Bugs)
**Impact on plan:** Beide direkte Folgen der eigenen Aenderungen dieses Plans (SCHRITT 1 bzw. die neue Sonden-Messgruppe) — kein Scope-Creep, keine Aenderung ausserhalb der drei Plan-Dateien.

## Issues Encountered

- **Bewusst hingenommener Zwischenzustand** (wie in `16-03-PLAN.md` Planungsnotizen vorgesehen): die Rail ist nach diesem Plan eine Ankerliste OHNE Filterwirkung — die Buehne zeigt weiterhin die bisherige Startauswahl (Komponenten+Bewaffnung), ein Klick auf einen Rail-Eintrag springt zum Textabschnitt statt die Buehne umzuschalten. Die Einfachauswahl und die Buehnen-Umschaltung sind Welle 4. Die Seite ist in diesem Zwischenstand vollstaendig benutzbar und vollstaendig lesbar (belegt durch die No-JS-Messung).
- **Tote CSS-Regeln in `.sd__ch2col`** (`.sd__slots`/`.arm__sum`/`.arm__scell span`-Feinabstimmungen aus `14-04-PLAN.md`) greifen seit dem Kapitel-Umzug ins Leere — nicht entfernt (ausserhalb der Task-1-Anweisung), dokumentiert in `deferred-items.md` fuer den naechsten Eingriff in diesen Block.
- **`d-fuellgrad`-Fehlschlaege bei Carrack/Ironclad an 860/414/360px** sind unveraendert der bereits in `16-01-SUMMARY.md` dokumentierte, an den Betreiber uebergebene S-0-Befund (`.planning/WINDOWS.md` id 21) — nicht neu, nicht von diesem Plan verursacht, exakt dieselben Prozentwerte wie in Welle 1 gemessen.

## User Setup Required

None - keine externe Dienstkonfiguration.

## Next Phase Readiness

- **`16-04-PLAN.md` kann direkt auf dem heutigen Stand aufbauen**: die vier Systemabschnitte und die Rail existieren bereits vollstaendig serverseitig; Welle 4 fuegt das Drei-Spalten-Grid (Detailvertrag Punkt 1), die Einfachauswahl mit Buehnen-Umschaltung (Punkt 5) und die JS-Progressiv-Erweiterung (Punkt 6, Verschieben statt Kopieren) hinzu.
- **`verify:shipconsole` ist bereits inhaltlich gruen** (0 Befunde in `--report`) — Welle 4/5 sollten das nach jeder Aenderung erneut pruefen, um die Bijektion/Klinke nicht versehentlich zu reissen, bevor das Tor in `16-05-PLAN.md` scharfgeschaltet wird.
- **`.planning/phases/16-das-schiff-ist-die-navigation/deferred-items.md`**: der tote `.sd__ch2col`-CSS-Fund wartet auf den naechsten Eingriff in diesen Block (voraussichtlich Welle 4).
- `npm run build && npm run gate` gruen, normal UND mit `STAGING=1` (19/19 Schritte, beide Laeufe).

---
*Phase: 16-das-schiff-ist-die-navigation*
*Completed: 2026-08-20*

## Self-Check: PASSED

Alle vier genannten Dateien gefunden (`src/components/ShipDetail.astro`,
`src/i18n/ui.ts`, `scripts/probes/schiffskonsole-messung.mjs`,
`.planning/phases/16-das-schiff-ist-die-navigation/deferred-items.md`).
Beide genannten Commit-Hashes gefunden (`8f50e68`, `cfd4878`).
