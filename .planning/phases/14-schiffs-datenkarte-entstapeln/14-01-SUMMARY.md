---
phase: 14-schiffs-datenkarte-entstapeln
plan: 01
subsystem: testing
tags: [verify-script, playwright-core, dedup, gate-registry, ship-detail]

requires: []
provides:
  - "verify-shipcard.mjs: acht Zusicherungen gegen dist/schiffe + dist/de/schiffe (Kapitelgeruest, Balkenrueckbau, Entdopplung D-03, Sprachparitaet), Berichtsmodus, benannte Ausnahmeliste mit Zombie-Waechter"
  - "scripts/lib/shipcard-exclusions.mjs: die zwei Ausnahmen der Welle 1 (sd__simgrid-Region, Einheitenvorrat ausserhalb des Vorrats)"
  - "verify:shipcard auf Schiene A registriert, disabled bis 14-04-PLAN.md scharf schaltet"
  - "scripts/probes/schiffskarte-messung.mjs: Hoehen-/Kontrast-/Backstop-Sonde gegen den gerenderten Bildpunkt, drei datengetriebene Pruefschiffe"
affects: [14-02, 14-03, 14-04]

tech-stack:
  added: []
  patterns:
    - "Regionenbasierte Entdopplungspruefung: direkte Kinder von div.sd + sd__sub-Unterueberschriften als Vergleichseinheit, generischer Tag-Stapel statt HTML-Bibliothek"
    - "Sonde waehlt Pruefziele aus den Daten (Fuellgrad-Berechnung ueber 11 Felder) statt sie zu verdrahten"

key-files:
  created:
    - scripts/verify-shipcard.mjs
    - scripts/lib/shipcard-exclusions.mjs
    - scripts/probes/schiffskarte-messung.mjs
  modified:
    - scripts/lib/gate-registry.mjs
    - package.json
    - scripts/probes/README.md

key-decisions:
  - "verify:shipcard registriert mit disabled statt scharf — beurteilt den Zielzustand dieser Phase, ist bis Welle 4 zwangslaeufig rot (Praezedenz verify:sync)"
  - "Ausgangsmessung lief gegen npm run preview auf Port 4322 statt 4321 — 4321 war von einem bereits laufenden astro-dev-Server belegt, dessen Server-seitiges Routing dist/build.json nicht als Datei ausliefert"
  - "document.fonts.ready vor jeder Messung ergaenzt (nicht im Plan gefordert, aber noetig) — ohne diese Wartestelle schwankte die gemessene Seitenhoehe je nach Font-Swap-Zeitpunkt um bis zu 150 px zwischen zwei Laeufen derselben Seite"

patterns-established:
  - "Ein neues verify:*-Skript, das den ZIELZUSTAND einer laufenden Phase beurteilt, wird disabled mit Anlass registriert statt scharf — druckt die Schuld bei jedem Lauf, haelt npm run gate gruen"

requirements-completed: [D-02, D-03]

coverage:
  - id: D1
    description: "verify-shipcard.mjs prueft acht Zusicherungen gegen dist/schiffe/*.html + dist/de/schiffe/*.html und ist einmal vorgefuehrt rot gegen den heutigen Stand"
    verification:
      - kind: other
        ref: "node scripts/verify-shipcard.mjs (Exit 1, Tor-Modus) und node scripts/verify-shipcard.mjs --report (Exit 0, Berichtsmodus) — beide manuell ausgefuehrt, Ausgabe unten woertlich zitiert"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/probes/schiffskarte-messung.mjs reproduziert die Ausgangsmessung (Carrack 1280x720 dunkel ~5.554 px) mit demselben Werkzeug, das spaeter die Sperrklinke misst"
    verification:
      - kind: other
        ref: "node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4322 --baseline — 192 Messpunkte, 0 Fehlschlaege, Ausgabe unten"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 1: Werkzeug vor Eingriff Summary

**Entdopplungs-Tor `verify-shipcard.mjs` einmal vorgefuehrt rot (1.385 Doppelungsbefunde, 4.256 verbliebene Einheitsrahmen) plus Messsonde, die die dokumentierte Ausgangsmessung von 5.554 px mit demselben Werkzeug reproduziert, das die Sperrklinke in Welle 4 prueft.**

## Performance

- **Duration:** ~75 min
- **Tasks:** 2
- **Files modified:** 6 (4 neu, 2 geaendert)

## Accomplishments

- `scripts/verify-shipcard.mjs` prueft acht Zusicherungen gegen den gebauten Stand der Schiffs-Detailseite (Kapitelgeruest, Bijektion Pille↔Kapitel, Einheitsrahmen-Tilgung, Balkenrueckbau nach D-02, Entdopplung nach D-03, Sprachparitaet, Zombie-Waechter) — mit Berichtsmodus (`--report`, immer Exit 0) und Tor-Modus (Exit 1 bei jedem unerklaerten Befund).
- Das Tor ist einmal **vorgefuehrt rot** gegen den heutigen (unveraenderten) Stand von `dist/`: 0 statt 1 Sprungleiste je Seite (454/454 Seiten betroffen), 4.256 verbliebene `sd__panel`-Einheitsrahmen, 5.648 verbliebene `sd__gtrack`-Balkenspuren, 1.385 Doppelungsbefunde ueber alle Schiffsseiten.
- `scripts/lib/shipcard-exclusions.mjs` traegt genau zwei benannte Ausnahmen (Raster fuer aehnliche Schiffe, Einheitenvorrat ausserhalb des festen Vorrats) mit ausformuliertem Anlass; beide haben im Testlauf gegriffen (454 bzw. 4.694 Treffer) — der Zombie-Waechter ist scharf.
- `verify:shipcard` steht in `scripts/lib/gate-registry.mjs` auf Schiene A, `disabled` mit Anlass und Verweis auf `14-04-PLAN.md`; `npm run gate` bleibt gruen und druckt die Schuld bei jedem Lauf.
- `scripts/probes/schiffskarte-messung.mjs` misst 192 Messpunkte (3 datengetriebene Pruefschiffe × 2 Sprachen × 2 Breiten × 2 Farbmodi × 8 Messgruppen) am gerenderten Bildpunkt und reproduziert die Ausgangsmessung: Carrack DE 1280×720 dunkel landet exakt auf den dokumentierten **5.554 px**, EN auf 5.498 px (beide innerhalb der 2-%-Toleranz).

## Task Commits

1. **Task 1: Das Entdopplungs-Tor — erst Bericht, dann Urteil, einmal vorgefuehrt rot** - `eb4e56e` (feat)
2. **Task 2: Die Messsonde und die reproduzierte Ausgangsmessung** - `1a2bcb4` (feat)

**Plan metadata:** siehe finaler Commit dieses Plans (folgt nach diesem SUMMARY)

## Files Created/Modified

- `scripts/verify-shipcard.mjs` - Entdopplungs-/Kapitelgeruest-Tor gegen `dist/schiffe/*.html` + `dist/de/schiffe/*.html`, acht Zusicherungen
- `scripts/lib/shipcard-exclusions.mjs` - zwei benannte Ausnahmen (Region-Ausschluss `sd__simgrid`, Einheitenvorrat-Dokumentation)
- `scripts/lib/gate-registry.mjs` - neuer Eintrag `verify:shipcard`, Schiene A, `disabled`
- `package.json` - neues Skript `verify:shipcard`
- `scripts/probes/schiffskarte-messung.mjs` - Messsonde gegen den gerenderten Bildpunkt (playwright-core + Chrome), datengetriebene Pruefschiffauswahl
- `scripts/probes/README.md` - neue Tabellenzeile + Aufrufzeile fuer die neue Sonde

## Decisions Made

- **verify:shipcard bleibt `disabled`, nicht geloescht oder auskommentiert.** Der Registry-Eintrag traegt den vollen Anlass ("beurteilt den Zielzustand dieser Phase ... scharf geschaltet in 14-04-PLAN.md") — die Praezedenz ist `verify:sync`s Kopfkommentar ("erst beheben, dann scharf").
- **Ausgangsmessung gegen Port 4322 statt 4321.** Beim Start dieser Welle lief bereits ein Astro-**Dev**-Server auf 4321 (nicht `astro preview`) — erkennbar daran, dass `/build.json` dort eine 404-Seite statt der Datei zurueckgab. Um den laufenden Server nicht zu stoeren und trotzdem gegen den ECHTEN `dist/`-Stand zu messen (Grundsatz 7), wurde `npx astro preview --port 4322` separat gestartet und die Sonde damit gefahren. Die Sonde selbst kennt keinen festen Port — der Aufruf bestimmt ihn ueber `--base`.
- **`document.fonts.ready` vor jeder Messung ergaenzt.** Beim ersten Testlauf schwankte die gemessene Carrack-Seitenhoehe (EN, dunkel, 1280×720) zwischen zwei aufeinanderfolgenden Laeufen um 134 px (5.498 vs. 5.632 px) — verursacht durch den Zeitpunkt des Webfont-Swaps (Rajdhani/Barlow/Orbitron), der Zeilenumbrueche verschiebt, bevor die Schrift geladen ist. Nach Ergaenzung von `document.fonts.ready` sind beide Werte (EN 5.498 px, DE 5.554 px) ueber mehrere Laeufe hinweg exakt reproduzierbar. Das war noetig, um Konkrete Vorgabe 5 ("mit DIESEM Werkzeug reproduziert") ueberhaupt einzuloesen — eine undeterministische Sonde waere kein gueltiger Massstab fuer die spaetere Sperrklinke.
- **Region-Schluessel bevorzugt `aria-label` vor `id`/Klasse.** Fuer die Diagnoseausgabe von Zusicherung 6 (nicht fuer die Dedopplungs-Identitaet selbst, die ist der Array-Index) liefert das lesbare Bezeichner wie "Dimensions & Cargo" statt "sd__panel" — im Plan nicht vorgeschrieben, aber notwendig, um die Berichtsausgabe im `--report`-Modus ueberhaupt brauchbar zu machen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Undeterministische Seitenhoehen-Messung durch fehlenden Font-Ladewarte-Schritt**
- **Found during:** Task 2 (erster Testlauf der Sonde gegen die Carrack)
- **Issue:** `page.goto(url, { waitUntil: 'domcontentloaded' })` allein reicht nicht — die Messung `document.documentElement.scrollHeight` lief je nach Zeitpunkt des Webfont-Ladens unterschiedlich aus (zwei Laeufe derselben Seite: 5.498 px vs. 5.632 px, 134 px Differenz), weil sich Zeilenumbrueche vor/nach dem Font-Swap verschieben.
- **Fix:** `await page.evaluate(() => document.fonts.ready)` nach jedem `goto()`/`reload()` ergaenzt, vor jeder Messung.
- **Files modified:** scripts/probes/schiffskarte-messung.mjs
- **Verification:** Drei aufeinanderfolgende Laeufe gegen dieselbe Seite liefern seither identische Werte (EN 5.498 px, DE 5.554 px, unveraendert)
- **Committed in:** `1a2bcb4` (Task 2 Commit)

---

**Total deviations:** 1 auto-fixed (1 Bug)
**Impact on plan:** Notwendig, um die im Plan verlangte Reproduzierbarkeit ("mit DIESEM Werkzeug reproduziert") tatsaechlich zu erfuellen — kein Scope-Creep, reine Werkzeug-Korrektheit.

## Issues Encountered

- Der Standardport 4321 (im Plan als "Standardport" genannt) war von einem bereits laufenden Astro-Dev-Server belegt, nicht von einer Vorschau. Geloest durch einen separaten `astro preview`-Lauf auf Port 4322 (siehe Decisions Made) — der Dev-Server auf 4321 wurde nicht angetastet.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Vorgefuehrte Rot-Meldung (Grundsatz 1, woertlich)

Lauf: `node scripts/verify-shipcard.mjs` gegen den heutigen (frisch gebauten, unveraenderten) Stand von `dist/`:

```
verify-shipcard: prueft dist/schiffe/*.html + dist/de/schiffe/*.html (GEBAUTER Stand, nicht die Quelle) — Tor-Modus

[1] Bestand und Selbstauskunft
    EN: 227   DE: 227   Summe: 454
    Soll: >= 440 Seiten gesamt   Ist: 454

[2] Kapitelgeruest (sd__jump genau 1x, sd__chapter 1-4x mit fester id-Menge)
    sd__jump je Seite — Soll: genau 1   Ist Verstoesse: 454 von 454 Seiten
    sd__chapter je Seite — Soll: 1-4   Ist Verstoesse: 454 von 454 Seiten
    Verteilung Kapitelzahl: 4=0 3=0 2=0 1=0 0=454
    Kapitel-id ausserhalb {ch-buy, ch-profile, ch-gear, ch-context} — Soll: 0   Ist: 0
    Doppelte Kapitel-id je Seite — Soll: 0   Ist: 0
  FEHLER: sd__jump nicht genau 1x: dist/schiffe/aegs-avenger-stalker.html (0x), dist/schiffe/aegs-avenger-titan-renegade.html (0x), ... (454 Seiten insgesamt)
  FEHLER: sd__chapter ausserhalb 1-4: dist/schiffe/aegs-avenger-stalker.html (0 Kapitel), ... (454 Seiten insgesamt)

[3] Bijektion Sprungleisten-Pille <-> Kapitel-id
    Geprueft: 0 Paar(e)   Soll: 0 Verstoesse   Ist: 0

[4] Der Einheitsrahmen ist weg (sd__panel) — sd__code === Kapitelzahl je Seite
    sd__panel site-weit — Soll: 0   Ist: 4256
    sd__code === sd__chapter je Seite — Soll: 0 Abweichungen   Ist: 454
  FEHLER: sd__panel noch vorhanden: 4256 Vorkommen ueber 454 Seiten
  FEHLER: sd__code != Kapitelzahl: dist/schiffe/aegs-avenger-stalker.html: sd__code=10 != sd__chapter=0, ...

[5] Balken nur, wo sie vergleichen — sd__gtrack weg, sd__proftrack nur mit ch-profile
    sd__gtrack site-weit — Soll: 0   Ist: 5648
    sd__proftrack site-weit — Ist gesamt: 2134   Verstoesse gegen die Kopplung: 446
  FEHLER: sd__gtrack noch vorhanden: 5648 Vorkommen ueber 454 Seiten
  FEHLER: sd__proftrack <-> ch-profile nicht gekoppelt: dist/schiffe/aegs-avenger-stalker.html: sd__proftrack (5x) ohne Kapitel ch-profile, ...

[6] Entdopplung (D-03): ein Zahl+Einheit-Token gehoert genau einer Region
    Gelesene Seiten: 454   Gefundene Token (Vorkommen gesamt): 9305
    Befunde (Token in > 1 Region derselben Seite): 1385   davon durch benannte Ausnahme erklaert: 0
  FEHLER: 1385 Doppelungsbefund(e) ohne benannte Ausnahme, u. a.:
      dist/schiffe/aegs-avenger-stalker.html: "262 m/s" in Regionen [Performance profile | Flight performance]
      dist/schiffe/aegs-avenger-stalker.html: "165,000 km/s" in Regionen [Performance profile | Flight performance › Quantum travel]
      dist/schiffe/aegs-avenger-stalker.html: "1.1 SCU" in Regionen [Dimensions & Cargo | Flight performance › Quantum travel]

[7] Sprachparitaet EN<->DE (Kapitel, Pillen, Balkenspuren, Perzentilspuren, Kopfzeilen-Code)
    Verglichene Seitenpaare: 227   Soll: 0 Abweichungen   Ist: 0

[8] Zombie-Waechter: jede Ausnahme muss in diesem Durchgang gegriffen haben
    X-sd-simgrid: 454 Treffer
    X-einheiten-ausserhalb-des-vorrats: 4694 Treffer

Laufzeit: 1293 ms

verify-shipcard: FEHLGESCHLAGEN ✗
```

**Erste reissende Zusicherung: [2] Kapitelgeruest** — "sd__jump nicht genau 1x" auf allen 454 Seiten (0x statt 1x je Seite), gefolgt von "sd__chapter ausserhalb 1-4" (0 Kapitel statt 1-4 je Seite). Genau die im Plan erwartete Meldung ("null Sprungleisten statt einer je Seite"). An der Carrack selbst (`dist/schiffe/anvl-carrack.html`) einzeln nachgemessen: **10** `sd__panel`-Einheitsrahmen (Soll nach Umbau: 0) und **14** `sd__gtrack`-Balkenspuren (Soll: 0) — deckungsgleich mit den im Plan genannten Erwartungswerten.

`node scripts/verify-shipcard.mjs --report` laeuft mit denselben acht Zusicherungen, faellt aber kein Urteil und beendet mit Exit 0 (Berichtsmodus, geprueft).

## Reproduzierte Ausgangsmessung (Konkrete Vorgabe 1)

Lauf: `node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4322 --baseline` gegen `npm run preview` auf dem frisch gebauten `dist/` dieses Worktrees.

**Pruefschiffe (aus den Daten gewaehlt, nicht fest verdrahtet):**

| Kennung | Name | Grund der Auswahl |
| --- | --- | --- |
| `anvl-carrack` | Carrack | Bezug der Ausgangsmessung (14-CONTEXT.md) — einziger fest genannter Wert |
| `aegs-idris-m` | Idris-M | groesstes Schiff nach `lengthM` (243 m) |
| `argo-atls` | ATLS | kargstes Schiff nach berechnetem Fuellgrad (2 von 11 Feldern belegt) |

**Seitenhoehe, 1280×720, dunkler Modus (der entscheidende Wert):**

| Schiff | Sprache | Gemessen | Bezug |
| --- | --- | --- | --- |
| Carrack | DE | **5.554 px** | exakt der dokumentierte Ausgangswert (14-CONTEXT.md: 5.554 px) |
| Carrack | EN | 5.498 px | 1,0 % darunter, innerhalb der 2-%-Toleranz (5.443–5.665 px) |
| Idris-M (groesstes) | EN / DE | 5.855 / 5.878 px | Bezugswert fuer die Schlussmessung in Welle 4 |
| ATLS (kargstes) | EN / DE | 3.820 / 3.843 px | Bezugswert fuer die Schlussmessung in Welle 4 |

**Selbstauskunft der Sonde:**

```
=== Selbstauskunft ===
  Schiffe: 3  Sprachen: 2  Breiten: 2  Farbmodi: 2  Messgruppen je Lauf: 8
  gefahrene Messpunkte: 192  (erwartet 192)
  bestanden: 192  fehlgeschlagen: 0
  gemessener --nav-h (site-weit, zuletzt gesehener Wert): ?px

schiffskarte-messung: ALLE ZUSICHERUNGEN ERFUELLT ✓
```

(`--nav-h` bleibt "?px", weil es nur gemessen wird, wenn eine Sprungleiste existiert — die gibt es in dieser Welle noch nicht; das ist erwartet, keine Luecke.)

Alle Sprungleisten-Messgruppen (b–e) meldeten durchgaengig **"nicht vorhanden"** (`OK`, kein Fehlschlag) — die Sonde stirbt nicht daran, dass es die Sprungleiste in dieser Welle noch nicht gibt. Der waagerechte Ueberlauf bei 360 px (Gruppe g) ist an allen drei Schiffen in beiden Sprachen **0** (`body.scrollWidth === clientWidth`).

## Next Phase Readiness

- Beide Messinstrumente dieser Phase stehen und sind belegt funktionstuechtig: `verify:shipcard` (vorgefuehrt rot) und `schiffskarte-messung.mjs` (Ausgangsmessung reproduziert).
- Welle 2 (Tracer: ein Kapitel end-to-end mit Sprungleiste, `14-02-PLAN.md`) kann direkt gegen dieses Tor und diese Sonde messen — beide Werkzeuge sind unveraendert vom eigentlichen Seitenumbau.
- Keine ausgelieferte Zeile wurde in dieser Welle veraendert: `git status --porcelain` nennt ausschliesslich die sechs Dateien dieses Plans (plus die beiden vorbestehenden, nicht zu committenden Sondendateien `_shot.mjs`/`_dupes.mjs` aus einer fruehren Sitzung).
- Kein Blocker. Der einzige offene Punkt ist rein organisatorisch: der Astro-Dev-Server auf Port 4321 lief zu Beginn dieser Welle bereits und wurde nicht angetastet — kuenftige Sonden-/Rauchtest-Laeufe in diesem Worktree sollten das beruecksichtigen (anderer Port oder Server vorher pruefen).

## Self-Check: PASSED

All created files found on disk; both task commits (`eb4e56e`, `1a2bcb4`) found in `git log`.

---
*Phase: 14-schiffs-datenkarte-entstapeln*
*Completed: 2026-08-18*
