---
phase: 03-ueberlagerungen-entstapeln
plan: 03
subsystem: ui
tags: [css, intersection-observer, dead-code-removal, archiv, reveal-gate]

requires:
  - phase: 03-ueberlagerungen-entstapeln
    provides: "Plan 01 heilte den geteilten .reveal-Beobachter (assets/detail.js, threshold:0) — Voraussetzung dafuer, dass Task 2 dieses Plans die 21 defensiven Notregeln gefahrlos entfernen konnte (T-03-07)"
provides:
  - "assets/archive.js — beide unabhaengigen Beobachter der Archivseite (revealIO fuer .reveal, nodeIO fuer die Archiv-Knoten) ohne Hoehendeckel (threshold:0, D-05)"
  - "21 Quelldateien ohne die defensive .reveal-Notregel — D-03 vollstaendig abgetragen (Ursache behoben statt an 21 Stellen verwaltet)"
  - "scripts/verify-layers.mjs Zusicherung 3 (revealIO-Beobachtungswert) repariert, meldet jetzt den tatsaechlichen Wert statt eines durch die D-05-Aenderung zufaellig getroffenen falschen Beobachters"
affects: [03-04, 03-05]

tech-stack:
  added: []
  patterns:
    - "archiv.js uebernimmt woertlich dasselbe Beobachter-Muster wie detail.js aus Plan 01: rootMargin statt threshold als Sichtbarkeits-Deckel"
    - "Massendurchlauf ueber 21 zeichengleiche Fundstellen mit Vorher-/Nachher-Zaehlung (21 -> 0) als Zusicherung, nicht nur behauptet"

key-files:
  created:
    - .planning/phases/03-ueberlagerungen-entstapeln/deferred-items.md
  modified:
    - assets/archive.js
    - scripts/verify-layers.mjs
    - src/components/ItemFinderPage.astro
    - src/components/pilot/PilotPage.astro
    - src/components/topics/crafting.astro
    - src/components/topics/mining.astro
    - src/components/topics/wikelo-emporium.astro
    - src/pages/account/index.astro
    - src/pages/account/login.astro
    - src/pages/account/register.astro
    - src/pages/account/reset.astro
    - src/pages/account/update-password.astro
    - src/pages/de/account/index.astro
    - src/pages/de/account/login.astro
    - src/pages/de/account/register.astro
    - src/pages/de/account/reset.astro
    - src/pages/de/account/update-password.astro
    - src/pages/feedback.astro
    - src/pages/de/feedback.astro
    - src/pages/precision-jump.astro
    - src/pages/de/precision-jump.astro
    - src/pages/refinery.astro
    - src/pages/de/refinery.astro

key-decisions:
  - "Reihenfolge strikt eingehalten: Task 1 (archive.js heilen) VOR Task 2 (21 Notregeln entfernen) — T-03-07 (high). Alle 21 betroffenen Seiten laden assets/detail.js (den in Plan 01 geheilten geteilten Beobachter), nicht archive.js — die depends_on:[\"03-01\"]-Absicherung war damit tatsaechliche Voraussetzung, nicht nur Vorsicht."
  - "assets/archive.css bewusst NICHT angefasst — beide vom Plan genannten Fundstellen (Zeile 1421 js-Gatter, Zeile 1780 prefers-reduced-motion) gepruft und bereits korrekt, siehe Abschnitt unten."
  - "Rule-1-Fund waehrend Task 2: der zeilenweise Entferner (Split auf /\\r?\\n/) traf in PilotPage.astro auf einen vorbestehenden eingebetteten \\r OHNE folgendes \\n zwischen der Notregel und </style> — das entfernte </style> versehentlich mit. Sofort im selben Ausfuehrungslauf gefunden (npm.cmd run build lief zwar durch, aber die Struktur war kaputt) und mit einer gezielten Byte-Ersetzung repariert, siehe Deviations."
  - "Rule-1-Fund waehrend Task 1: scripts/verify-layers.mjs (Eigentum Plan 01) hatte eine Regex, die revealIOs threshold nur erkennt, wenn es das ERSTE Feld im Optionen-Objekt ist. Die D-05-Heilung fuegt rootMargin VOR threshold ein, wodurch die Regex am falschen (unabhaengigen Counters-)Beobachter haengenblieb und faelschlich 0.6 statt 0 meldete. Repariert, siehe Deviations."

requirements-completed: [LAYER-01]

coverage:
  - id: D1
    description: "assets/archive.js: revealIO (.reveal) und nodeIO (Archiv-Knoten) tragen keinen Sichtbarkeitsanteil groesser 0 mehr (D-05)"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "node scripts/verify-layers.mjs (Zusicherung 3, Beobachtungswert 'revealIO — Ist 0') + eigenstaendiges Verify-Skript im Plan (Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "assets/archive.css unveraendert (Zeile 1421 js-Gatter, Zeile 1780 prefers-reduced-motion) — beide Fundstellen bereits korrekt"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "Task-1-Verify-Skript im Plan (git diff --name-only -- assets/archive.css == leer)"
        status: pass
    human_judgment: false
  - id: D3
    description: "21 defensive .reveal-Notregeln in src/ entfernt (D-03), 21 -> 0, alle 8 DE/EN-Paare symmetrisch behandelt (SYNC-01)"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "rg -c 'opacity:1 !important;transform:none !important' src (0 Treffer) + git diff --name-only -- src (21 Dateien) + Paar-Symmetrie-Skript im Plan (8/8)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Gebauter Stand traegt nach der Entfernung weiterhin .reveal-Markup UND laedt den geheilten Beobachter (assets/detail.js) auf den betroffenen Seiten"
    requirement: "LAYER-01"
    verification:
      - kind: unit
        ref: "node-Skript gegen dist/refinery.html, dist/feedback.html, dist/account/login.html, dist/topics/mining.html, dist/topics/wikelo-emporium.html (class=reveal + assets/detail.js jeweils vorhanden)"
        status: pass
    human_judgment: false
---

# Phase 3 Plan 3: Archiv-Beobachter heilen (D-05) + 21 defensive Notregeln entfernen (D-03) Summary

**assets/archive.js: beide unabhängigen `.reveal`/Knoten-Beobachter auf threshold:0 (derselbe Rechenfehler wie im geteilten System, dieselbe Lösung); danach 21 zeichengleiche `!important`-Notregeln in `src/` ersatzlos entfernt (21 → 0), alle 8 DE/EN-Paare symmetrisch — dabei zwei Rule-1-Bugs gefunden und behoben, die die eigene Änderung selbst verursacht hatte.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-08T18:13:00Z (unmittelbar nach 03-02)
- **Completed:** 2026-08-08T18:43:00Z
- **Tasks:** 2 (plus 2 Rule-1-Fixes)
- **Files modified:** 23 (2 aus Task 1/Fix, 21 aus Task 2)

## Accomplishments

- `assets/archive.js` (D-05): `revealIO` (`.reveal`-Beobachter, vormals `threshold:0.12`) trägt jetzt `rootMargin:'0px 0px -10% 0px', threshold:0` — wörtlich dasselbe Muster wie `assets/detail.js` nach Plan 01. `nodeIO` (Archiv-Knoten, vormals `threshold:0.05`) trägt jetzt `threshold:0`, `rootMargin:'0px 0px -12% 0px'` unverändert (trägt dort das Timing). Beide Beobachter können jetzt mathematisch für Elemente jeder Höhe auslösen.
- `assets/archive.css` bewusst NICHT angefasst — beide vom Plan genannten Fundstellen geprüft und bestätigt bereits korrekt: Zeile 1421 gattert die Einblendung hinter `.js` (Ohne-JS-Fall bereits zu), Zeile 1780 (innerhalb `@media (prefers-reduced-motion: reduce)`) setzt `.js .reveal` bereits auf volle Deckkraft (Reduzierte-Bewegung-Fall bereits zu).
- 21 defensive `.reveal{opacity:1 !important;transform:none !important}`-Notregeln in `src/` ersatzlos entfernt — belegt: `rg -c` fand vor der Entfernung 21 Treffer über 21 Dateien, danach 0. Alle 8 DE/EN-Seitenpaare (Konto-Übersicht, Anmeldung, Registrierung, Zurücksetzen, Passwortwechsel, Rückmeldung, Precision Jump, Refinery) im selben Arbeitsschritt behandelt — kein Paar einseitig (eigenes Symmetrie-Skript: 8/8).
- In `wikelo-emporium.astro` kam der 4-zeilige erklärende Kommentar ("Neutralize the reveal gate: content is ALWAYS visible. Reason: the very tall trade-card column …") mit der Regel weg — er beschrieb einen Zustand, der seit Plan 01 nicht mehr existiert. Alle anderen 20 Dateien trugen KEINEN erklärenden Kommentarblock zur Regel (nur unabhängige, unverändert gebliebene Kommentare wie "Hellmodus — erzeugt von …" oder "Palette lebt jetzt in …") — kein weiterer Kommentar dieser Art gefunden.
- Umgebende Leerzeilen nach jeder Entfernung auf höchstens eine Zeile geschlossen (kein Zweizeilenloch) — Ausgangszustand variierte zwischen 0 und 4 Leerzeilen je Datei, alle Fälle einzeln geprüft.
- Alle 21 betroffenen Seiten laden `assets/detail.js` (nicht `archive.js`) — bestätigt der Sicherheitsgedanke hinter `depends_on:["03-01"]` und T-03-07: die Entfernung war ausschließlich deshalb ungefährlich, weil Plan 01 diesen geteilten Beobachter bereits geheilt hatte.

## Task Commits

1. **Task 1: `assets/archive.js` — beide Beobachter ohne Höhendeckel (D-05)** — `d7d2123` (feat)
2. **Rule-1-Fix (durch Task 1 ausgelöst): `scripts/verify-layers.mjs` revealIO-Beobachtungswert repariert** — `1c5d03f` (fix)
3. **Task 2: 21 defensive `.reveal`-Notregeln entfernt (D-03, SYNC-01)** — `081e26d` (feat)
4. **Rule-1-Fix (durch Task 2 ausgelöst): `PilotPage.astro` — `</style>` wiederhergestellt** — `bf77e77` (fix)

**Plan metadata:** wird mit diesem Commit abgeschlossen (docs: complete plan)

## Files Created/Modified

- `assets/archive.js` — `revealIO`/`nodeIO` Optionen-Objekte auf `threshold:0`
- `scripts/verify-layers.mjs` — Zusicherung 3's `revealIO`-Regex repariert (zielt jetzt auf das eigene Optionen-Objekt, unabhängig von Feldreihenfolge)
- 21 Astro-Quelldateien (siehe Frontmatter `key-files.modified`) — je eine Zeile entfernt (`wikelo-emporium.astro` zusätzlich der 4-zeilige Erklärkommentar), `PilotPage.astro` zusätzlich mit wiederhergestelltem `</style>`
- `.planning/phases/03-ueberlagerungen-entstapeln/deferred-items.md` — neu, dokumentiert einen pre-existierenden, unabhängigen Editor-Artefakt-Fund (siehe unten)

## Belegte Zahl: 21 → 0

```
$ rg -c "opacity:1 !important;transform:none !important" src
# vor der Entfernung: 21 Treffer über 21 Dateien
# nach der Entfernung:
verbleibende Notregeln in src/: 0 (Soll 0, Ausgang 21)
```

Geänderte Quelldateien: `git diff --name-only -- src` → 21 (Soll 21). Sprachpaare gleich behandelt: 8/8 (kein Paar einseitig — Symmetrie-Skript aus dem Plan).

## `assets/archive.css` — geprüft und in Ordnung (nicht Teil der Änderung)

- **Zeile 1421** (`.js .reveal{opacity:0;transform:translateY(18px);…}`): gattert die Einblendung hinter `.js` — ohne JavaScript greift die Regel nie, der Ohne-JS-Fall ist auf `/archiv` also bereits zu (keine Entsprechung zu D-02 nötig).
- **Zeile 1780** (innerhalb `@media (prefers-reduced-motion: reduce)`, Block ab Zeile 1761): setzt `.js .node__card, .js .reveal { opacity:1; transform:none }` — der Reduzierte-Bewegung-Fall ist bereits zu.

Beide Zeilen unverändert; das Verify-Skript des Plans bestätigt `git diff --name-only -- assets/archive.css` als leer.

## Decisions Made

- Reihenfolge strikt eingehalten (Task 1 vor Task 2) — siehe `key-decisions` in der Frontmatter.
- `assets/archive.css` unangetastet gelassen, mit begründetem Nachweis (siehe Abschnitt oben).
- Beide während der Ausführung gefundenen Rule-1-Bugs sofort im selben Lauf behoben (kein Aufschub), da beide von den eigenen Task-Änderungen dieses Plans direkt verursacht wurden (Scope: erlaubt).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `scripts/verify-layers.mjs` meldete nach der D-05-Heilung fälschlich den falschen Beobachter-Wert**
- **Found during:** Task 1 (unmittelbar nach dem Ändern von `assets/archive.js`, beim routinemäßigen `node scripts/verify-layers.mjs`-Lauf aus dem Plan-Verifikationsabschnitt)
- **Issue:** Zusicherung 3 dieses (von Plan 01 geschriebenen) Skripts identifizierte `revealIO`s Optionen-Objekt über eine Regex, die verlangt, dass `threshold` das ERSTE Feld direkt hinter der öffnenden `{` ist (`\{\s*threshold:\s*([\d.]+)\s*\}`). Die D-05-Heilung fügt `rootMargin` VOR `threshold` ein (`{rootMargin:'0px 0px -10% 0px', threshold:0}`), wodurch die Regex an `revealIO`s eigenem Objekt nicht mehr griff und (non-greedy weitersuchend) auf das nächste `{threshold:...}`-Vorkommen im Rest der Datei durchfiel — den völlig unabhängigen Counters-Beobachter (`threshold:0.6`). Die Beobachtungszeile meldete dadurch fälschlich `Ist 0.6` statt des tatsächlichen, jetzt geheilten Werts `0` — irreführend für Plan 05, der an dieser Beobachtung anknüpft.
- **Fix:** Regex zielt jetzt auf das eigene Optionen-Objekt des `revealIO`-Konstruktors (Callback-Ende + das direkt folgende `{...}`), liest `threshold` darin unabhängig von der Feldreihenfolge.
- **Files modified:** `scripts/verify-layers.mjs`
- **Verification:** `node scripts/verify-layers.mjs` meldet jetzt `Beobachtungswert: assets/archive.js .reveal-threshold (revealIO) — Ist 0`; alle vier Zusicherungen weiterhin `ALLE ZUSICHERUNGEN ERFUELLT ✓`.
- **Committed in:** `1c5d03f` (fix)

**2. [Rule 1 - Bug] `PilotPage.astro`: `</style>` beim Entfernen der Notregel versehentlich mit gelöscht**
- **Found during:** Task 2 (nach dem automatisierten Massendurchlauf über alle 21 Dateien, beim Nachvollzug einer ungewöhnlich großen `git diff`-Anzeige für genau diese Datei)
- **Issue:** Die Originaldatei trug an dieser einen Stelle einen vorbestehenden, eingebetteten `\r` (Carriage Return) OHNE folgendes `\n` zwischen der Notregel und `</style>` (wörtlich: `.reveal{opacity:1 !important;transform:none !important}\r</style>\r\n`) — vermutlich ein Artefakt eines früheren Editier-Werkzeugs. Der zeilenweise Massen-Entferner (Aufteilung auf `/\r?\n/`) erkennt einen bloßen `\r` ohne `\n` nicht als Zeilenumbruch — Regel UND `</style>` waren dadurch für das Skript EIN einziges Element. Beim Entfernen dieses Elements verschwand `</style>` mit, das erste `<style is:inline>`-Element blieb unbeendet und schloss fälschlich über HTML-Markup (`<a class="skip">`, `<SiteNav>`, `<main>`, …) bis zum nächsten `</style>` weiter unten hinweg. `npm.cmd run build` lief trotzdem durch (Astro toleriert das offenbar in `is:inline`), aber die Struktur war kaputt.
- **Fix:** Ausgangsdatei erneut aus der Basislinie vor Task 2 gezogen; die Notregel diesmal per gezielter Byte-Ersetzung entfernt (nicht zeilenweiser Split), `</style>` dabei erhalten. Ergebnis: `<style is:inline>` (Zeile 107) … `</style>` (Zeile 112) … `<style is:global>` (Zeile 336) … `</style>` (Zeile 755) — je ein sauberes Paar.
- **Files modified:** `src/components/pilot/PilotPage.astro`
- **Verification:** `npm.cmd run build` erneut grün; `dist/pilot.html` zeigt 3 `<style>`-Öffnungen/3 `</style>`-Schließungen, 0 verbleibende Notregel-Treffer; `verify:layers`, `verify:typo`, `verify:fx`, `verify:help`, `audit:site` (0 FEHLER), `scripts/_verify.mjs` (0 gebrochene Verweise) und `test:e2e` (225/225) erneut vollständig grün nach dem Fix.
- **Committed in:** `bf77e77` (fix)

---

**Total deviations:** 2 selbst gefundene/behobene Implementierungsfehler (beide Rule 1, beide direkt durch die eigenen Task-Änderungen dieses Plans verursacht), 0 Abweichungen von einer expliziten Plan-Vorgabe.
**Impact on plan:** Keine Scope-Änderung. Beide Tasks sind wie im Plan beschrieben umgesetzt; beide Fixes waren notwendig, um die vom Plan selbst verlangte Korrektheit (verify-layers.mjs' Beobachtungswert, PilotPage.astro's Markup-Struktur) tatsächlich zu erreichen statt nur zu behaupten.

## Zusätzlicher Fund (nicht behoben, out of scope)

Beim Nachvollzug des PilotPage.astro-Fehlers wurde derselbe Editor-Artefakt (ein eingebetteter `\r` ohne `\n`) auch in `src/pages/precision-jump.astro` und `src/pages/de/precision-jump.astro` gefunden — an einer völlig anderen, mit `.reveal` nicht verwandten Stelle (`max-width:74ch}\r</style>`), bestätigt vorbestehend seit mindestens `HEAD~4` in diesem Branch. Dort ist `<style>`/`</style>` trotzdem korrekt gepaart (kein Strukturschaden), daher **nicht blockierend und nicht behoben** (Scope Boundary: nur direkt durch diesen Plan verursachte Probleme werden automatisch behoben). Dokumentiert in [deferred-items.md](./deferred-items.md) als Kandidat für eine spätere kleine Hygiene-Passage.

## Beobachtung: `.reveal` wird auf 4 der 21 Seiten gar nicht auf Markup angewendet

Beim Verifizieren der dritten Plan-Zusicherung ("gebauter Stand trägt weiterhin Einblende-Markup") wurde festgestellt, dass `precision-jump.astro`/`de` und `account/index.astro`/`de` sowie `ItemFinderPage.astro` und `pilot/PilotPage.astro` (insgesamt 4 von 21 betroffenen Seiten, 8 Dateien mit DE/EN-Paaren) **im gebauten HTML kein einziges Element mit `class="reveal"` tragen** — bestätigt sowohl im Quelltext (0 weitere `reveal`-Fundstellen außer der jetzt entfernten Notregel) als auch im gebauten `dist/`. Die defensive Notregel war auf diesen konkreten Seiten von Anfang an totes CSS, das nichts guardete — kein Regressionsrisiko, aber ein Beleg dafür, dass die Notregeln teils vorsorglich kopiert wurden, ohne zu prüfen, ob die Seite `.reveal`-Markup überhaupt nutzt. Die übrigen 13 betroffenen Dateien (`refinery`, `feedback`, alle vier Konto-Formularseiten außer `index`, `mining`, `crafting`, `wikelo-emporium`) tragen im gebauten Stand tatsächlich `.reveal`-Markup und laden `assets/detail.js` — dort war die Notregel funktional relevant und ihre Entfernung ist die eigentliche, vom Plan verlangte Reparatur.

## Issues Encountered

- Git-Bash-Fork-Fehler (`0xC0000142`, bekannt aus `windows-env-fallen.md`) traten mehrfach bei `grep`/`sed`-Pipelines auf einzelnen Dateien auf — umgangen durch den Read-Werkzeug-Pfad bzw. Node-eigene Dateizugriffe statt Shell-Pipelines.
- `node -e` mit `execSync(..., {shell:true})` scheiterte einmal an PowerShell/cmd-Quotierungskonflikten (`2>nul` innerhalb verschachtelter Anführungszeichen) — die dritte Plan-Zusicherung wurde stattdessen mit einem eigenständigen, äquivalenten Node-Skript nachgebildet (`rg` direkt statt über `execSync`/`cmd`).
- Der oben dokumentierte PilotPage.astro-Strukturfehler wurde NICHT vom Build-Schritt selbst erkannt (`npm.cmd run build` lief mit der kaputten Datei durch) — erst der ungewöhnlich große `git diff`-Ausschlag machte auf die Anomalie aufmerksam. Das ist ein Hinweis für künftige zeilenweise Massendurchläufe: `git diff --stat` nach jedem Massendurchlauf gegen die vorherige Datei-für-Datei-Erwartung prüfen, nicht nur den Build-Exitcode.

## User Setup Required

None — keine externe Dienstkonfiguration nötig.

## Next Phase Readiness

- D-03 und D-05 sind vollständig abgetragen: der geteilte Beobachter (Plan 01), `assets/archive.js`s beide Beobachter (dieser Plan) und alle 21 defensiven Notregeln (dieser Plan) sind erledigt.
- Offene Anschlussarbeit für Plan 04: die 19 Patch-Kopien tragen weiterhin ihre eigene `body::after`-Regel MIT Zeilenraster und ihren eigenen `.reveal`-Beobachter mit `threshold:.1` (unverändert seit Plan 01/02, von diesem Plan nicht angefasst — außerhalb des Datei-Anfassbestands).
- Offene Anschlussarbeit für Plan 05: Registry in `scripts/verify-layers.mjs` trägt weiterhin nur den `.hero`-Eintrag aus Plan 1. D-04-Zielmarke (4,5:1/3:1) bleibt als hartes Abbruchkriterium noch nicht scharf geschaltet. Erfolgskriterium 3 (Sichturteil) bleibt `human_verify_mode: end-of-phase`.
- `deferred-items.md` (neu, dieser Plan) enthält einen kleinen, unabhängigen Hygiene-Kandidaten (eingebettete `\r`-Artefakte in zwei Dateien) für eine spätere, eigene Aufräum-Passage — kein Blocker für Plan 04/05.

---
*Phase: 03-ueberlagerungen-entstapeln*
*Completed: 2026-08-08*

## Self-Check: PASSED

All 5 claimed files found on disk (`assets/archive.js`, `scripts/verify-layers.mjs`, `src/components/pilot/PilotPage.astro`, `deferred-items.md`, this SUMMARY); all 4 claimed commits found in git log (`d7d2123`, `1c5d03f`, `081e26d`, `bf77e77`).
