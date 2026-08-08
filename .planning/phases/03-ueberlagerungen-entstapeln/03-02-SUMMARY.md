---
phase: 03-ueberlagerungen-entstapeln
plan: 02
subsystem: ui
tags: [css, stacking-context, z-index, prefers-reduced-motion, intersection-observer, scrollytelling]

requires:
  - phase: 03-ueberlagerungen-entstapeln
    provides: "Plan 01 bewies das Muster (::before-Zeilenraster, z-index:1, ueber dem Foto unter dem Text) an .hero und lieferte scripts/verify-layers.mjs als bleibendes Kontrast-/Schicht-Tor"
provides:
  - "assets/detail.css — die sieben verbleibenden Medien-Archetypen (.band, .split__media, .editorial__img, .sticky__media, .gtile, .video, .scrolly__media) tragen jetzt dieselbe ::before-Rasterregel wie .hero — acht Rasterregeln insgesamt, das geteilte System ist fuer diese Phase vollstaendig"
  - ".sstep undurchsichtig als Standard (D-02a); Abdunklung inaktiver Schritte haengt an der Betriebsmarke data-sstep-live, die ausschliesslich assets/detail.js setzt"
  - "prefers-reduced-motion-Regel fuehrt jetzt .sstep und .sstep .sn mit explizitem transition:none (D-02b) — der bestehende *{animation:none!important}-Allquantor deckte nur animation, nicht die Deckkraft-/Farb-/Schatten-Uebergaenge dieser zwei Selektoren ab"
  - "Rule-1-Fund: .gtile figcaption/.zoomic brauchten z-index:2, sonst waeren Bildunterschrift und Lupensymbol unter das neue Raster gerutscht (positionierte Geschwister ohne explizites z-index stehen in der CSS-Stapelreihenfolge IMMER unter jedem Geschwister mit EXPLIZITEM z-index, auch 1)"
affects: [03-03, 03-04, 03-05]

tech-stack:
  added: []
  patterns:
    - "Ein z-index:1 ::before je Medien-Archetyp, EIN Deklarationstext ueberall (repeating-linear-gradient(0deg,var(--scanline) 0 1px,transparent 1px 3px), opacity:var(--ambient-opacity)) — Plan 04 repliziert diesen woertlichen Text in die 19 Patch-Koerper"
    - "Betriebsmarke am Container statt Umkehrung des Selektors: eine Dimmregel, die ZUSAETZLICH ein von JS gesetztes Attribut verlangt, schliesst den Vor-dem-ersten-Tick-Kurzschluss (der naive Ansatz .sstep{opacity:1};.sstep:not(.active){opacity:.5} traefe ohne Marke JEDEN Schritt, bevor JS ueberhaupt gelaufen ist)"

key-files:
  created: []
  modified:
    - assets/detail.css
    - assets/detail.js

key-decisions:
  - "D-01 zu Ende gebracht: alle acht Medien-Archetypen des geteilten Systems tragen jetzt ihr eigenes Zeilenraster, --ambient-opacity unveraendert (0.5 dunkel / 0.4 hell), im ganzen Plan nicht angefasst"
  - ".band/.scrolly__media: das neue ::before liegt auf DEMSELBEN z-index:1 wie der jeweils schon vorhandene Scrim-::after — bewusst so gelassen (Plan-Vorgabe), das Raster malt vor dem Scrim (::before vor ::after in der Stapelreihenfolge bei gleichem z-index) und bleibt trotzdem sichtbar, weil der Scrim halbdurchlaessig ist; kein z-index einer bestehenden Scrim-Regel wurde verschoben"
  - ".gtile figcaption/.zoomic auf z-index:2 gehoben (Rule 1, nicht im Plan benannt) — ohne diese Aenderung waere die Bildunterschrift/das Lupensymbol unter das neue z-index:1-Raster gerutscht, weil positionierte Geschwister ohne EXPLIZITES z-index (z-index:auto) in der CSS-Stapelreihenfolge kategorisch unter jedem Geschwister mit einem expliziten Wert stehen, auch 1"
  - "D-02 als zwei unabhaengige Regeln gebaut: .sstep-Standard ist jetzt opacity:1, die Abdunklung inaktiver Schritte sitzt in .scrolly[data-sstep-live] .sstep:not(.active) — die Marke setzt AUSSCHLIESSLICH detail.js, unmittelbar nach dem ersten setActive(0)"
  - "Sichtbares Endverhalten bei laufendem JS ist mit dem Vorherigen IDENTISCH (siehe Abschnitt weiter unten) — nur der Vor-JS-/Ohne-JS-/reduzierte-Bewegung-Fall aendert sich, wie D-02 verlangt"

requirements-completed: [LAYER-01]

coverage:
  - id: D1
    description: "Acht Zeilenraster-::before-Regeln in assets/detail.css (.hero aus Plan 1 + die sieben hier), alle z-index:1, body::after bleibt raster-frei"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "scripts/verify-layers.mjs Zusicherung 1 (node scripts/verify-layers.mjs) + Task-1-eigene Verify-Skripte im Plan"
        status: pass
    human_judgment: false
  - id: D2
    description: ".sstep undurchsichtig ohne JavaScript; Abdunklung inaktiver Schritte ausschliesslich an die von detail.js gesetzte Betriebsmarke data-sstep-live gebunden"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "Task-2-Verify-Skript im Plan (node -e ..., 5 Zusicherungen) + node scripts/verify-layers.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: "prefers-reduced-motion-Regel fuehrt .sstep und .sstep .sn mit explizitem transition:none; Abdunklung entfaellt in diesem Modus ebenfalls"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "Task-2-Verify-Skript im Plan (rm-Block-Extraktion) — grep bestaetigt, siehe Abschnitt unten"
        status: pass
    human_judgment: false
  - id: D4
    description: "Erfolgskriterium 3 (Bildmotive tragen die Seite optisch weiterhin) — Sichturteil"
    verification: []
    human_judgment: true
    rationale: "Wie in 03-01-SUMMARY.md festgehalten: per Plan explizit human_verify_mode: end-of-phase — Plan 05 uebergibt es benannt an den Betreiber, kein Skript entscheidet ein Sichturteil."

duration: 41min
completed: 2026-08-08
status: complete
---

# Phase 3 Plan 2: Zeilenraster fuer die uebrigen sieben Medien-Archetypen + .sstep (D-02) Summary

**Alle acht Medien-Archetypen des geteilten Systems tragen jetzt ihr eigenes ::before-Zeilenraster ueber dem Foto/unter dem Text, und `.sstep` ist ohne JavaScript und bei reduzierter Bewegung dauerhaft voll lesbar — die Abdunklung inaktiver Schritte haengt an einer Betriebsmarke, die ausschliesslich `assets/detail.js` setzt.**

## Performance

- **Duration:** ~41 min
- **Started:** 2026-08-08T19:32:00Z (unmittelbar nach 03-01)
- **Completed:** 2026-08-08T20:13:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Sieben neue `::before`-Rasterregeln (`.band`, `.split__media`, `.editorial__img`, `.sticky__media`, `.gtile`, `.video`, `.scrolly__media`) — woertlich derselbe Deklarationstext wie `.hero::before` aus Plan 1: `content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:repeating-linear-gradient(0deg,var(--scanline) 0 1px,transparent 1px 3px);opacity:var(--ambient-opacity)`. Zusammen mit `.hero` sind das jetzt genau acht Rasterregeln — das geteilte System (`assets/detail.css`) hat damit die Form, die Plan 04 in die 19 Patch-Koerper repliziert.
- `.band::before` und `.scrolly__media::before` liegen wie im Plan vorgegeben auf demselben `z-index:1` wie ihr jeweils bereits vorhandener Scrim-`::after` — das Raster malt VOR dem Scrim (gleicher z-index, `::before` kommt vor `::after` in der Stapelreihenfolge) und bleibt trotzdem sichtbar, weil der Scrim halbdurchlaessig ist. Kein `z-index` einer bestehenden Scrim-Regel wurde verschoben.
- **Eigenstaendig gefunden (Rule 1, nicht im Plan benannt):** `.gtile figcaption` und `.gtile .zoomic` hatten kein explizites `z-index` (`z-index:auto`). In der CSS-Stapelreihenfolge stehen positionierte Elemente ohne explizites `z-index` KATEGORISCH unter jedem Geschwister mit einem expliziten Wert — auch `z-index:1`. Ohne Korrektur waere die Bildunterschrift und das Lupensymbol unter das neue Raster gerutscht, exakt der Fehler, den diese Phase ueberall sonst behebt. Beide auf `z-index:2` gesetzt (dieselbe Schicht wie `.band__in`, `.split__text` usw.).
- `.sstep` startet jetzt bedingungslos auf `opacity:1`. Die Abdunklung inaktiver Schritte wurde in `.scrolly[data-sstep-live] .sstep:not(.active){opacity:.5}` verschoben — eine Regel, die zusaetzlich das Attribut `data-sstep-live` am umgebenden `.scrolly`-Container verlangt.
- `assets/detail.js` setzt `data-sstep-live` unmittelbar nach dem ersten `setActive(0)` im `.scrolly`-Durchlauf (Zeile 152/157) — ausschliesslich dort. Ohne JS existiert das Attribut nie, die Dimmregel greift nie, alle Schritte bleiben voll lesbar.
- Die `prefers-reduced-motion`-Regel fuehrt jetzt `.sstep` (`opacity:1;transition:none`) und `.sstep .sn` (`transition:none`) sowie eine explizite Ausnahme fuer die Betriebsmarken-Dimmregel (`opacity:1`) — der bestehende `*{animation:none!important}`-Allquantor deckte nur `animation` ab, nicht die `transition`-basierten Deckkraft-/Farb-/Schatten-Uebergaenge dieser zwei Selektoren.

## Task Commits

1. **Task 1: Die sieben uebrigen Medien-Archetypen bekommen ihr Zeilenraster** — `10dc445` (feat)
2. **Task 2: `.sstep` — lesbar ohne JavaScript, ruhig bei reduzierter Bewegung (D-02)** — `ce862e1` (feat)

**Plan metadata:** wird mit diesem Commit abgeschlossen (docs: complete plan)

## Files Created/Modified

- `assets/detail.css` — sieben neue `::before`-Rasterregeln, Kommentarblock zur Stapel-Begruendung, `.gtile figcaption`/`.zoomic` `z-index:2`, `.sstep`-Standard auf `opacity:1`, neue `.scrolly[data-sstep-live] .sstep:not(.active)`-Dimmregel, `prefers-reduced-motion`-Regel um `.sstep`/`.sstep .sn` erweitert
- `assets/detail.js` — `sc.setAttribute('data-sstep-live', '')` unmittelbar nach `setActive(0)` im `.scrolly`-Durchlauf

## Die Endform der Rasterregel (woertlich, fuer Plan 04)

Jede der acht Regeln in `assets/detail.css` hat exakt diese Form (nur der Selektor wechselt):

```css
.ARCHETYP::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:repeating-linear-gradient(0deg,var(--scanline) 0 1px,transparent 1px 3px);opacity:var(--ambient-opacity)}
```

Betroffene Selektoren im geteilten System: `.hero` (Plan 1), `.band`, `.split__media`, `.editorial__img`, `.sticky__media`, `.gtile`, `.video`, `.scrolly__media`. Voraussetzung an jedem Container: `position:relative` (oder `sticky`) + `overflow:hidden` — bei allen acht bereits vorhanden, kein Zusatz noetig.

## Abweichungen von der Sonderfall-Behandlung (.band/.scrolly__media)

Keine. Die Plan-Vorgabe wurde woertlich umgesetzt: beide Container behalten ihren Scrim auf `z-index:1`, das neue Raster liegt auf demselben `z-index:1` und malt dadurch VOR dem Scrim (unter ihm, aus Sicht des Betrachters). Kein `z-index` einer bestehenden Scrim-Regel wurde angefasst. Der einzige Sonderfall, der ueber die Plan-Vorgabe hinausging, ist der `.gtile`-Fund (siehe Deviations unten) — der betrifft nicht `.band`/`.scrolly__media`, sondern `.gtile`s eigene Bildunterschrift/Symbol.

## Wirkt die Scrollytelling-Animation noch, oder ist sie ein No-Op geworden? (Orchestrator-Frage)

**Sie wirkt weiterhin identisch zum vorherigen Verhalten, sobald JS laeuft** — geprueft durch Nachvollzug der Selektor-Spezifitaet, nicht nur behauptet:

- Vorher: `.sstep{opacity:.5}` als Basis, `.sstep.active{opacity:1}` als Ueberschreibung. Wechselt ein Schritt von aktiv zu inaktiv, faellt er auf die Basisregel zurueck (Uebergang 1→.5); wechselt er zu aktiv, greift die Ueberschreibung (Uebergang .5→1). Beide Uebergaenge animieren ueber `transition:opacity .5s` auf `.sstep`.
- Nachher: `.sstep{opacity:1}` als Basis, `.scrolly[data-sstep-live] .sstep:not(.active){opacity:.5}` als Ueberschreibung (hoehere Spezifitaet: Attribut+Klasse+Klasse+Pseudoklasse schlaegt die einfache Klasse). Wechselt ein Schritt von aktiv zu inaktiv, GREIFT jetzt die Ueberschreibung (Uebergang 1→.5); wechselt er zu aktiv, matcht `:not(.active)` nicht mehr, er faellt auf die Basisregel zurueck (Uebergang .5→1). Dieselben zwei Uebergaenge, nur die Rollen von Basis- und Ueberschreibungsregel sind vertauscht — das sichtbare Verhalten (aktiver Schritt hell, uebrige gedimmt, beide Richtungen animiert ueber `transition:opacity .5s`) ist beim laufenden JS **byte-identisch zum vorherigen Stand**.
- Der einzige Unterschied liegt in den drei Faellen, die D-02 beheben sollte: **vor** dem ersten IntersectionObserver-Tick (jetzt voll lesbar statt halbtransparent), **ohne** JavaScript ueberhaupt (jetzt dauerhaft voll lesbar) und **bei reduzierter Bewegung** (jetzt voll lesbar UND ohne Uebergang). Das ist der beabsichtigte Effekt von D-02, kein Nebenschaden an der Kernanimation.

## Decisions Made

- `.band`/`.scrolly__media`-Sonderfall exakt wie im Plan vorgegeben umgesetzt (kein Ermessensspielraum genutzt).
- `.gtile figcaption`/`.zoomic` `z-index:2` als eigenstaendiger Rule-1-Fund (siehe Deviations) — dieselbe Schicht wie die bereits explizit gesetzten Text-z-index-Werte anderswo im Bestand (`.band__in`, `.editorial__card`, `.scrolly__steps` = alle 2).
- Kein Entfernen der (nun redundanten) alten `.sstep.active{opacity:1}`-Regel als separate Ueberschreibung noetig — sie wurde durch die neue Basisregel (`opacity:1` als Standard) schlicht ersetzt, nicht daneben stehen gelassen (vermeidet zwei konkurrierende Deckkraft-Quellen fuer denselben Zustand).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `.gtile figcaption`/`.zoomic` fehlte ein explizites `z-index`, das neue Raster waere ueber der Bildunterschrift gelandet**
- **Gefunden waehrend:** Task 1, beim Durchgehen der CSS-Stapelreihenfolge fuer jeden der sieben Archetypen (nicht im Plan-Text ausdruecklich behandelt — der Plan benennt fuer `.gtile` nur die Skalierungs-Ausnahme, nicht die Stapelreihenfolge).
- **Problem:** `.gtile figcaption` und `.gtile .zoomic` sind `position:absolute` ohne `z-index` (also `z-index:auto`). Nach CSS-Spezifikation stehen positionierte Elemente mit `z-index:auto` in der Stapelreihenfolge IMMER unter jedem Geschwister mit einem EXPLIZITEN `z-index` — unabhaengig vom Zahlenwert. Das neue `.gtile::before` (Raster, `z-index:1` explizit) haette dadurch ueber der Bildunterschrift und dem Lupensymbol gemalt, statt darunter — exakt die Fehlerklasse (Text hinter einer dekorativen Deckkraftschicht), die diese Phase behebt.
- **Fix:** `z-index:2` auf `.gtile figcaption` und `.gtile .zoomic` ergaenzt (dieselbe Schicht wie `.band__in`/`.editorial__card`/`.scrolly__steps`).
- **Verifikation:** Stapelreihenfolge von Hand gegen die CSS2.1-Regeln nachvollzogen (kein automatisierter Test fuer visuelle Ueberlappung vorhanden — der Plan-eigene Task-1-Verify prueft nur die Existenz/Form der acht Regeln, nicht deren Wechselwirkung mit bestehenden Geschwistern); `npm.cmd run build` + `node scripts/verify-layers.mjs` liefen danach unveraendert gruen.
- **Files modified:** `assets/detail.css`
- **Committed in:** `10dc445` (Teil des Task-1-Commits, kein separater Fix-Commit noetig — der Fehler wurde vor dem Commit gefunden und behoben, nie fehlerhaft eingecheckt)

---

**Total deviations:** 1 selbst gefundener/behobener Implementierungsfehler (Rule 1), 0 Abweichungen von einer expliziten Plan-Vorgabe.
**Impact on plan:** Keine Scope-Aenderung. Beide Tasks sind wie im Plan beschrieben umgesetzt; der `.gtile`-Fund ergaenzt eine Luecke, die der Plan-Text selbst offen liess (er benennt fuer `.gtile` nur die Transform-Skalierung, nicht die Stapelreihenfolge mit `figcaption`/`.zoomic`).

## Issues Encountered

- Dieselbe bekannte Windows-Falle wie in Plan 01: `node -e "..."` ueber die Bash-Tool-Quotierung verschluckte Backslashes in verschachtelten Regex-Escapes (Syntax-Fehler `Unterminated group`) — umgangen, indem jedes Verify-Snippet als eigenstaendige `.cjs`-Datei ins Scratchpad geschrieben und dann per `node <pfad>` ausgefuehrt wurde, statt es inline auf der Kommandozeile zu escapen.
- Git-Bash-Fork-Fehler (`0xC0000142`) traten bei mehreren `node`-Aufrufen als Begleitrauschen auf (bekannt, `windows-env-fallen.md`) — die eigentliche `node`-Ausgabe kam trotzdem vollstaendig durch, keine Auswirkung auf die Ergebnisse.

## User Setup Required

None — keine externe Dienstkonfiguration noetig.

## Next Phase Readiness

- `assets/detail.css` hat jetzt die vollstaendige Endform fuer diese Phase: acht Rasterregeln + geheiltes `.sstep`. Plan 04 kann den woertlichen Regeltext (siehe Abschnitt oben) unveraendert in die 19 Patch-Koerper uebernehmen.
- Offene Anschlussarbeit fuer Plan 03: `assets/archive.js`s `revealIO` (`threshold:0.12`, unveraendert seit Plan 01) und die 21 defensiven `!important`-Overrides (`121.607` `!important`-Fundstellen site-weit gemessen, unveraendert seit Plan 01 — dieser Plan hat keine Datei aus Plan 03s Zustaendigkeit angefasst).
- Offene Anschlussarbeit fuer Plan 04: die 19 Patch-Kopien tragen weiterhin ihre alte, unmaskierte `body::after`-Regel MIT Zeilenraster und ihren eigenen `.reveal`-Beobachter mit `threshold:.1` — unveraendert gemessen (`node scripts/verify-layers.mjs` Beobachtungswerte, siehe Ausgabe oben).
- Offene Anschlussarbeit fuer Plan 05: Registry in `scripts/verify-layers.mjs` traegt weiterhin nur den `.hero`-Eintrag aus Plan 1 — die sieben neuen Archetypen brauchen je einen eigenen Registry-Eintrag (Bild, Ankerpunkt, Scrim-Deklaration), bevor ihr Kontrast gemessen werden kann. D-04-Zielmarke (4,5:1/3:1) bleibt als hartes Abbruchkriterium noch nicht scharf geschaltet.
- Erfolgskriterium 3 (Sichturteil "Bildmotive tragen die Seite optisch weiterhin") bleibt wie in 03-01-SUMMARY.md dokumentiert `human_verify_mode: end-of-phase` — nicht Teil dieses Plans, Plan 05 legt es dem Betreiber vor.

---
*Phase: 03-ueberlagerungen-entstapeln*
*Completed: 2026-08-08*

## Self-Check: PASSED

Both claimed files found on disk (`assets/detail.css`, `assets/detail.js`); both claimed commits found in git log (`10dc445`, `ce862e1`).
