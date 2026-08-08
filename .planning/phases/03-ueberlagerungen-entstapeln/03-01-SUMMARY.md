---
phase: 03-ueberlagerungen-entstapeln
plan: 01
subsystem: ui
tags: [css, mask-image, intersection-observer, wcag-contrast, sharp, alpha-compositing]

requires:
  - phase: 02-schrift-und-bewegungsskala
    provides: Schrift-/Bewegungsskala (--fs-*, --ls-*, --dur-*, --ease-ui), von diesem Plan nicht angefasst
provides:
  - "body::after (assets/detail.css) begrenzt statt gedimmt: Vignette maskiert vor der Textspalte, Zeilenraster ausgelagert"
  - ".hero::before traegt das Zeilenraster ueber dem Foto, unter dem Text (z-index:1)"
  - ".reveal-IntersectionObserver ohne Hoehendeckel (threshold:0 + rootMargin)"
  - "compositeOver()/flattenStack() in scripts/lib/theme-color.mjs — Schichten zusammenlegen vor der WCAG-Kontrastrechnung"
  - "scripts/verify-layers.mjs — Registry-getriebenes, bleibendes Kontrast-/Schicht-Tor mit Vorher-/Nachher-Messung"
affects: [03-02, 03-03, 03-04, 03-05]

tech-stack:
  added: []
  patterns:
    - "Registry-getriebenes Pruefskript (wie verify-typo-motion.mjs): eine Tabelle von Messstellen, ein Eintrag in diesem Plan, Plan 05 haengt an"
    - "Schichten-Zusammenlegung vor WCAG-Kontrast: compositeOver()/flattenStack() statt CSS-Rohfarben zu vergleichen"
    - "Ambiente-Deckkraft raeumlich begrenzen (mask-image + Pseudo-Element-Umzug) statt dimmen"

key-files:
  created:
    - scripts/verify-layers.mjs
    - tests/e2e/layer-compositing.test.js
  modified:
    - assets/detail.css
    - assets/detail.js
    - scripts/lib/theme-color.mjs
    - package.json

key-decisions:
  - "D-01 umgesetzt als Maske+Pseudo-Element-Umzug, NICHT als --ambient-opacity-Absenkung (Werte 0.5/0.4 unveraendert)"
  - "Maskenfeder (80px) liegt AUSSERHALB der --maxw-Spalte (Abweichung von 03-RESEARCH.md Pattern 2, bewusst laut Plan) — die volle Spaltenbreite bleibt frei"
  - "D-03 per threshold:0 + rootMargin, mathematisch korrekt statt symptomatisch (die 21 !important-Overrides bleiben bewusst stehen, Plan 03 traegt sie ab)"
  - "verify-layers.mjs blockiert nur auf dem GETEILTEN System (dist/assets/detail.css + dist/_astro/*.css); die 19 Patch-Kopien und sonstige Fundstellen (z. B. das Downloads-Onepager) sind in diesem Plan Beobachtungswert, nicht Abbruchgrund"
  - "Vignetten-Anteil im --vorher-Vergleich ist der volle Token-Wert (konservative Naeherung), nicht die exakte radiale Position — dokumentierte Vereinfachung, siehe Deviations"

requirements-completed: [LAYER-01, LAYER-02]

coverage:
  - id: D1
    description: "body::after ohne Zeilenraster, mit beiden Masken-Schreibweisen, an --maxw gekoppelt; .hero::before traegt das Raster unter dem Text"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "scripts/verify-layers.mjs Zusicherung 1+2 (node scripts/verify-layers.mjs)"
        status: pass
    human_judgment: false
  - id: D2
    description: ".reveal-IntersectionObserver ohne Hoehendeckel (threshold:0)"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "scripts/verify-layers.mjs Zusicherung 3 (node scripts/verify-layers.mjs)"
        status: pass
    human_judgment: false
  - id: D3
    description: "compositeOver()/flattenStack() — Schichten korrekt zusammenlegen vor der WCAG-Kontrastrechnung"
    requirement: "LAYER-02"
    verification:
      - kind: unit
        ref: "tests/e2e/layer-compositing.test.js (node --test tests/e2e/layer-compositing.test.js)"
        status: pass
    human_judgment: false
  - id: D4
    description: "verify:layers misst einen zusammengerechneten Kontrastwert (Foto+Scrim+Raster) fuer Hell/Dunkel am Hero, inkl. Vorher-/Nachher-Vergleich"
    requirement: "LAYER-02"
    verification:
      - kind: unit
        ref: "node scripts/verify-layers.mjs --vorher"
        status: pass
    human_judgment: false
  - id: D5
    description: "Erfolgskriterium 3 (Bildmotive tragen die Seite optisch weiterhin) — Sichturteil"
    verification: []
    human_judgment: true
    rationale: "Per Plan explizit human_verify_mode: end-of-phase — Plan 05 uebergibt es benannt an den Betreiber, kein Skript entscheidet ein Sichturteil."

duration: 40min
completed: 2026-08-08
status: complete
---

# Phase 3 Plan 1: Ambiente-Schicht begrenzen + Kontrast-Tor (Tracer) Summary

**body::after maskiert vor der Textspalte statt gedimmt, Zeilenraster nach .hero::before verlegt, .reveal-Beobachter mathematisch geheilt, und ein neues Registry-Tor (verify:layers) rechnet WCAG-Kontrast aus echtem Bildpunkt+Scrim+Raster statt zwei CSS-Token zu vergleichen — Dunkelmodus-Fliesstext misst 7.50:1 vorher gegen 18.22:1 nachher.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-08T16:50:00Z
- **Completed:** 2026-08-08T17:26:00Z
- **Tasks:** 3 (Task 2 als TDD: RED + GREEN)
- **Files modified:** 6 (2 neu, 4 geaendert)

## Accomplishments

- `body::after` (assets/detail.css) traegt nur noch die radiale Vignette, gekoppelt an `var(--maxw)`, mit beiden Masken-Schreibweisen (`-webkit-mask-image` zuerst, dann `mask-image`) — die Vignette endet vor der Textspalte, die 80px-Feder liegt AUSSERHALB der Spalte (volle Spaltenbreite bleibt frei, Abweichung von der Recherche, siehe unten).
- Das Zeilenraster ist nach `.hero::before` umgezogen: `z-index:1`, ueber dem Foto (`.hero__photo`, z:0), unter dem Text (`.hero__in`, z:2) — eigener `background`/`opacity`-Regler, getrennt vom Scrim.
- `--ambient-opacity` UNVERAENDERT: 0.5 (dunkel) / 0.4 (hell) — begrenzt, nicht gedimmt (die Zusicherung ist Teil des Verify-Tors, siehe unten).
- `.reveal`-Beobachter (`assets/detail.js`) auf `{rootMargin:'0px 0px -10% 0px', threshold:0}` — mathematisch kein Hoehendeckel mehr (spiegelt den bereits bewaehrten `.sstep`-Beobachter zwei Bildschirmseiten weiter unten in derselben Datei).
- `compositeOver()`/`flattenStack()` in `scripts/lib/theme-color.mjs` (TDD: RED-Test zuerst, dann GREEN-Implementierung) — Vordergrund UND Hintergrund werden je fuer sich durch den Schichtstapel geschickt, bevor `contrast()` (unveraendert) sie ins Verhaeltnis setzt.
- `scripts/verify-layers.mjs` (neu, `npm run verify:layers`): Registry-getriebenes Tor mit vier Zusicherungen gegen `dist/`, plus `--vorher`-Modus fuer den Vergleich mit dem Stand vor diesem Plan. Negativkontrolle bewiesen (siehe unten).

## Task Commits

1. **Task 1: Ambiente-Schicht begrenzen + Beobachter heilen** — `3bc5786` (feat)
2. **Task 2 (TDD RED): failing tests fuer compositeOver()/flattenStack()** — `bba292a` (test)
3. **Task 2 (TDD GREEN): compositeOver()/flattenStack() implementiert** — `fd272c6` (feat)
4. **Task 3: verify-layers.mjs + package.json** — `20e9faa` (feat)

**Plan metadata:** wird mit diesem Commit abgeschlossen (docs: complete plan)

## Files Created/Modified

- `assets/detail.css` — `body::after` maskiert (Vignette only), `.hero::before` neu (Zeilenraster)
- `assets/detail.js` — `.reveal`-IntersectionObserver auf `threshold:0`
- `scripts/lib/theme-color.mjs` — `compositeOver()`/`flattenStack()` neu, bestehende Exporte unveraendert
- `tests/e2e/layer-compositing.test.js` — neu, 10 Testfaelle (RED vor GREEN)
- `scripts/verify-layers.mjs` — neu, Registry-getriebenes Kontrast-/Schicht-Tor
- `package.json` — `"verify:layers"`-Skript ergaenzt, keine neue Abhaengigkeit (package-lock.json unveraendert)

## Gemessene Kontrastwerte (Hero, assets/detail.css)

Bildpunkt aus `public/assets/cz-facility.jpg` (Motiv von `4-0-0-contested-zones.astro`, `.hero__photo`), Ankerpunkt unteres linkes Viertel (xFrac 0.18 / yFrac 0.85 — dort steht `.hero .lead`, weil `.hero` auf `justify-content:flex-end` sitzt). "Vorher" = Stand vor diesem Plan (Zeilenraster + Vignette lagen BEIDE in `body::after`, EINER fixen Ebene ueber der GESAMTEN Seite — Vordergrund UND Hintergrund gleichermassen betroffen). "Nachher" = jetziger Stand (Vignette an diesem Punkt ausmaskiert, Zeilenraster liegt unter dem Text — nur der Hintergrund wird getoent).

| Modus | Textrolle (Token) | Vorher | Nachher (ungünstigst) | Nachher (zeilengemittelt) | Zielmarke D-04 |
|---|---|---|---|---|---|
| Dunkel | Fliesstext (`--on-media-dim`) | 7.50:1 | **18.22:1** | 18.14:1 | 4.5:1 — **erreicht** |
| Dunkel | Grosse Schrift (`--on-media`) | 7.98:1 | **19.52:1** | 19.45:1 | 3.0:1 — **erreicht** |
| Hell | Fliesstext (`--on-media-dim`) | 2.89:1 | **2.98:1** | 2.94:1 | 4.5:1 — noch offen |
| Hell | Grosse Schrift (`--on-media`) | 3.09:1 | **3.19:1** | 3.15:1 | 3.0:1 — erreicht |

Die grosse Verbesserung liegt im Dunkelmodus (Vignette-Alpha 0.62 dort ist substanziell; im Hellmodus ist `--vignette`/`--scanline` laut `assets/theme.css`-Kommentar "bewusst fast aus" — 0.05/0.028 — daher ist der Sprung dort klein, aber real und positiv). Der Hellmodus-Fliesstext bleibt unter der D-04-Zielmarke: das ist in diesem Plan noch kein Fehlschlag (Zusicherung 4 ist laut Plan "noch nicht scharf" — die Aufzaehlung ist unvollstaendig, Plan 05 zieht die 4,5:1/3:1-Zielmarke als hartes Kriterium an, sobald sie vollstaendig ist). Der Befund selbst ist trotzdem wertvoll: die Hero-Ecke, an der `.hero__photo::after`s Verlauf in `--bg` auslaeuft, ist im Hellmodus die schwaechste gemessene Stelle.

## Beobachtungswerte (Zusicherung 1 + 3, fuer Plan 03/04)

- **19 Patch-Kopien** (`dist/patches/sc-*.html`) tragen weiterhin die ALTE, unmaskierte `body::after`-Regel mit Zeilenraster — 19 Fundstellen ueber 19 Dateien. Nicht blockierend in diesem Plan (Plan 04 hebt sie an).
- **19 Patch-Seiten** tragen weiterhin ihren eigenen `.reveal`-Beobachter mit `threshold:.1` (Hoehendeckel) — 19 Fundstellen. Nicht blockierend (Plan 04).
- **`assets/archive.js`** (`revealIO`, praezise anvisiert statt der ersten `threshold:`-Fundstelle in der Datei — die Datei traegt drei unabhaengige Beobachter mit unterschiedlichen Schwellen) traegt weiterhin `threshold:0.12` — derselbe mathematische Fehler wie vormals in `detail.js`. Nicht blockierend (Plan 03).
- **121.607 `!important`-Fundstellen** site-weit gemessen (die 21 defensiven `.reveal`-Overrides sind darin enthalten, aber nicht isoliert gezaehlt — die Gesamtzahl ist der grobe Beobachtungswert, den Plan 03 gezielt absenkt).
- **19 Dateien ausserhalb des Registry-Bestands dieser Phase** tragen ebenfalls `body::after`-Text — bei genauer Pruefung sind das dieselben 19 Patch-Kopien (DE-Pfade), keine zusaetzliche unbekannte Fundstelle. Das Downloads-Onepager (`dist/downloads/onepager-contested-zones.html`) traegt ebenfalls eine eigene `body::after`-Regel (ausserhalb des Datei-Anfassbestands dieser Phase, nirgends in CONTEXT/RESEARCH erwaehnt) — als Randfund dokumentiert, nicht Teil dieses Plans.

## Negativkontrolle (Beweis, dass das Tor faellt)

`scripts/verify-layers.mjs` wurde gegen den GEBAUTEN `dist/assets/detail.css` zweimal gezielt gestoert (nur die `dist/`-Kopie, nicht die Quelle — `dist/` ist gitignored):

1. Zeilenraster wieder in `body::after` eingeschleust → Zusicherung 1 meldet `FEHLER: dist/assets/detail.css: body::after traegt noch das Zeilenraster`, Rueckgabecode 1.
2. Beide Masken-Deklarationen aus `body::after` entfernt (Raster blieb draussen) → Zusicherung 1 UND Zusicherung 2 melden je einen `FEHLER` (`ohne -webkit-mask-image`, `ohne mask-image`, `Die verbleibende Verlaufs-Ebene "body::after" traegt keine Maske`), Rueckgabecode 1.

Nach jedem Test wurde die Datei aus einer Sicherung wiederhergestellt; `node scripts/verify-layers.mjs` lief danach wieder gruen (Rueckgabecode 0). Das Tor kann also nachweislich fehlschlagen, nicht nur bestehen.

## Decisions Made

- Maskenfeder AUSSERHALB der `--maxw`-Spalte (wie im Plan vorgegeben, bewusste Abweichung von `03-RESEARCH.md` Pattern 2) — die volle Spaltenbreite bleibt geschuetzt statt 160px davon zu verlieren.
- `.hero::before` statt einer Erweiterung von `.hero__photo::after`s `background`-Liste — haelt Scrim (`--scrim-*`) und Ambiente-Raster (`--ambient-opacity`) als zwei unabhaengige Regler getrennt.
- `verify-layers.mjs` blockiert NUR auf dem geteilten System (`dist/assets/detail.css` + `dist/_astro/*.css`); Patch-Kopien und sonstige Fundstellen sind Beobachtungswert. Konsistent mit der Plan-Vorgabe fuer Zusicherung 1 (die Patch-Kopien EXPLIZIT als "noch nicht mitzaehlen" nennt) — auf Zusicherung 2 uebertragen, damit beide Zusicherungen denselben Massstab fuer den "Anfassbestand dieses Plans" benutzen.
- Vignetten-Anteil im `--vorher`-Vergleich: voller Token-Alpha-Wert (`--vignette` × `--ambient-opacity`), NICHT die exakte radiale Position (`radial-gradient(130% 115% at 50% 42%, transparent 54%, var(--vignette) 100%)`) am Ankerpunkt. Grund: dieselbe "ungünstigster Fall ist die massgebliche Lesart"-Regel, die der Plan bereits fuer das Zeilenraster vorschreibt, auf die Vignette uebertragen — eine exakte geometrische Nachbildung der radialen Gradient-Distanz waere fuer einen Tracer unverhaeltnismaessig praezise gegenueber dem, was Zusicherung 4 in diesem Plan leisten muss (Beobachtungswert, nicht hartes Kriterium). Dokumentiert im Skript-Kommentar; Plan 05 kann das verfeinern, falls die genaue radiale Position gebraucht wird.

## Deviations from Plan

### Auto-fixed Issues

Keine Rule-1/2/3-Autofixes im Sinne von Bugfixes an fremdem Code — die drei unten stehenden Punkte sind dokumentierte Implementierungsentscheidungen innerhalb des vom Plan gelassenen Ermessensspielraums (Ankerpunkt-Koordinaten, Vignetten-Naeherung im Vorher-Vergleich, Scope-Grenze fuer Zusicherung 2), keine Abweichung von einer Vorgabe.

**1. [Bugfix waehrend der Eigenentwicklung] Token-Extraktion faengt sich im Kopfkommentar von detail.css**
- **Gefunden waehrend:** Task 3 (erster Testlauf von `verify-layers.mjs`)
- **Problem:** Der Kopfkommentar von `assets/detail.css` listet Beispielwerte je Patch-Palette (`4.0.x Pyro --bg:#120f0c …`) — die naive Regex `--bg\s*:\s*([^;]+);` fing diese Kommentarzeile als "die" `--bg`-Definition ein, mit einem mehrzeiligen Fangergebnis bis zum naechsten echten Semikolon.
- **Fix:** `stripComments()` vor jeder Token-/Regel-Extraktion; Fangmuster auf `[^;\r\n]+` verschaerft (keine mehrzeiligen Fanggruppen mehr moeglich).
- **Fix 2:** `assets/archive.js`s Beobachtungswert (`revealIO`) zielte urspruenglich auf die ERSTE `threshold:`-Fundstelle nach `.reveal` im Text — traf durch Zufall den falschen Beobachter (Counters, `threshold:0.6`, statt `revealIO`s `threshold:0.12`). Auf den `revealIO`-Konstruktor namentlich verengt.
- **Verifikation:** `node scripts/verify-layers.mjs` meldet jetzt `--on-media-dim`/`--bg` korrekt aufgeloest und `assets/archive.js .reveal-threshold (revealIO) — Ist 0.12` (deckt sich mit `03-RESEARCH.md`s Fund).
- **Committed in:** `20e9faa` (Teil des Task-3-Commits, kein separater Fix-Commit noetig — der Fehler wurde vor dem ersten gruenen Lauf behoben, nie eingecheckt)

---

**Total deviations:** 0 Plan-Abweichungen (nur Entscheidungen innerhalb des ausdruecklich gelassenen Ermessensspielraums) + 1 selbst gefundener/behobener Implementierungsfehler vor dem ersten Commit.
**Impact on plan:** Keine Scope-Aenderung. Alle vier Zusicherungen aus dem Plan sind wie beschrieben umgesetzt.

## Issues Encountered

- Git-Bash-Forks brachen mehrfach mit `0xC0000142` bei `tail`/`grep`-Pipelines ab (bekannte Windows-Falle, siehe `windows-env-fallen.md`) — umgangen durch Umleiten in Dateien statt Pipes bzw. Node-eigene Auswertung.
- `npm.cmd run audit:site` lief laenger als das 2-Minuten-Standard-Timeout (17.361 Seiten) — im Hintergrund erneut gestartet, danach ausgewertet: 0 FEHLER, 4 WARNUNGEN (alle vorbestehend, unveraendert von diesem Plan), 30 INFOS.

## User Setup Required

None — keine externe Dienstkonfiguration noetig.

## Next Phase Readiness

- Der Mechanismus ist an EINEM Archetyp (`.hero`) bewiesen: Maske greift (verifiziert im gebauten `dist/`), Zeilenraster liegt nachweislich unter dem Text, Beobachter feuert ohne Hoehendeckel, und das Messverfahren liefert echte, unterscheidbare Vorher-/Nachher-Zahlen.
- `scripts/verify-layers.mjs`s REGISTRY-Struktur ist bereit, weitere Eintraege aufzunehmen, ohne das Skript umzubauen — Plan 05 kann direkt anhaengen.
- Offene Anschlussarbeit fuer Plan 02: die uebrigen sieben Medien-Archetypen (`.band`, `.split__media`, `.scrolly__media`, `.video`, `.editorial__img`, `.sticky__media`, `.gtile`) brauchen noch ihr eigenes `::before`-Zeilenraster.
- Offene Anschlussarbeit fuer Plan 03: `assets/archive.js`s `revealIO` (threshold:0.12) und die 21 defensiven `!important`-Overrides.
- Offene Anschlussarbeit fuer Plan 04: die 19 Patch-Kopien (eigene `body::after`, eigener `.reveal`-Beobachter mit `threshold:.1`) muessen dieselbe Behandlung erhalten wie `assets/detail.css`.
- Offene Anschlussarbeit fuer Plan 05: Registry auf alle betroffenen Stellen erweitern, D-04-Zielmarke (4,5:1/3:1) als hartes Abbruchkriterium scharf schalten, ins Dockerfile-Tor haengen, Erfolgskriterium 3 (Sichturteil) dem Betreiber vorlegen. Der gemessene Hellmodus-Fliesstext-Wert (2.98:1) an dieser einen Stelle zeigt bereits, dass mindestens eine Stelle die Zielmarke heute noch verfehlt — kein Uebersehen, sondern ein gemessener, dokumentierter Befund fuer Plan 05.

---
*Phase: 03-ueberlagerungen-entstapeln*
*Completed: 2026-08-08*

## Self-Check: PASSED

All 6 claimed files found on disk; all 4 claimed commits found in git log (3bc5786, bba292a, fd272c6, 20e9faa).
