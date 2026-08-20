---
phase: 14-schiffs-datenkarte-entstapeln
plan: 03
subsystem: ui
tags: [astro, i18n, dedup-gate, ship-detail, css-tokens]

requires:
  - phase: 14-schiffs-datenkarte-entstapeln (Plan 01)
    provides: "verify-shipcard.mjs (disabled, Zielzustandspruefer) + schiffskarte-messung.mjs (Messsonde)"
  - phase: 14-schiffs-datenkarte-entstapeln (Plan 02)
    provides: "Kapitelliste-als-einzige-Quelle (CHAPTERS_SOURCE), Sprungleiste, Kapitelrahmen samt allen vier Akzent-Modifikatoren, sieben i18n-Schluessel, Kaufen-Kapitel als Tracer"
provides:
  - "Vier statt zehn Rahmen: CHAPTERS_SOURCE um ch-profile/ch-gear/ch-context verlaengert; Leistung, Ausstattung (Masse&Fracht/Bewaffnung/Flugleistung/Komponenten als Unterabschnitte) und Umfeld (Versicherung/Lackierungen/Varianten&Loaner/Patch-Chronik als Unterabschnitte) sind jetzt Kapitel"
  - "Datenblatt-Panel vollstaendig entfernt (buildFacts-Aufruf, facts-Konstante, ship.sheet.title-Schluessel) — shipFacts.ts selbst unangetastet"
  - "Sechs Balkenstellen aufgeloest: drei Masse-Balken + zwei Feuerkraft-Balken ERSATZLOS weg (D-02), vier weitere (Tanks/Geschwindigkeit/Wendigkeit/Verteidigung) zu Zahlen im sd__grid/sd__item-Raster"
  - "Turm-DPS-Summenzelle (arm.stat.totalDps) nur bei mehr als einer Turmgruppe"
  - "shipVisuals.ts: Quantum-Tank nur noch im Quantum-Kennwert, nicht mehr zusaetzlich als Tank-Balken"
  - "shipExtras.ts: ProfileBar/MetricDef tragen showValue — Tempo/Fracht/Quantum-Tempo zeigen in der Profilzeile nur noch das Perzentil, Rohwert bleibt im aria-label"
  - "verify-shipcard.mjs computeRegions() prueft Ausnahmen jetzt auch je Unterabschnitt (Subpiece), nicht nur je direktem Kind von div.sd — vervollstaendigt eine seit Welle 1 dokumentierte, aber nicht implementierte Faehigkeit"
  - "shipcard-exclusions.mjs: zwei neue benannte Ausnahmen (X-ch-profile-aggregate, X-cargo-cube-legende)"
affects: [14-04]

tech-stack:
  added: []
  patterns:
    - "Balken-zu-Zahl-Umwandlung wiederverwendet das bestehende sd__grid/sd__item-Paar statt eine neue Bauform einzufuehren — dasselbe Muster, das bis Task 1 exklusiv das Datenblatt trug"
    - "Bedingte Sichtbarkeit ueber ein durchgereichtes Boolean-Feld (showValue) statt Markup-Verzweigung in der Bibliothek — die Bibliothek liefert weiterhin ALLE Werte, nur die Vorlage entscheidet, was sichtbar wird (Screenreader verlieren nichts)"
    - "Ausnahme-Pruefung auf Unterabschnitts-Ebene (Subpiece) statt nur auf direkte Kinder von div.sd — noetig, sobald ein Kapitel mehrere Unterabschnitte buendelt und nur EINER davon eine Ausnahme braucht"

key-files:
  created: []
  modified:
    - src/components/ShipDetail.astro
    - src/lib/shipVisuals.ts
    - src/lib/shipExtras.ts
    - src/i18n/ui.ts
    - scripts/verify-shipcard.mjs
    - scripts/lib/shipcard-exclusions.mjs

key-decisions:
  - "Kein Kapitel-Icon fuer Ausstattung und Umfeld — anders als Kaufen (IC.handel) und Leistung (IC.profil), die ihr Icon vom vormaligen Einzel-Panel erben, buendeln die beiden neuen Kapitel je vier zusammengelegte Unterabschnitte ohne einen natuerlichen 'Leit'-Icon; das UI-SPEC fuehrt fuer diese Phase ausdruecklich keine neuen Icons ein. Die vier bzw. drei Unterabschnitts-Icons bleiben an ihrer bisherigen Stelle (jetzt an h3/h4)."
  - "Turm-DPS-Summe (turretDpsTotal) in ShipDetail.astro-Frontmatter vorab berechnet statt inline im Markup — Astro 5.18 verschluckt bei einem Ausdruck auf oberster Ebene das schliessende Tag; ein einfacher Variablen-Verweis im Markup umgeht die Falle vollstaendig, statt sie mit set:text zu umschiffen."
  - "Umfeld-Kopfzeilen-Code (ctxCode) ebenfalls als String in JS vorberechnet statt als JSX-Ternary im Markup — dieselbe Vorsichtsmassnahme, konsistenter Umgang mit der Astro-5.18-Falle an mehreren Stellen dieses Plans."
  - "verify-shipcard.mjs computeRegions() um eine Subpiece-Ausnahme-Pruefung erweitert (nicht im Plan-Dateisatz gelistet, aber von der eigenen Task-2-Abnahmekriterien-Formulierung verlangt: 'jeder Befund ... steht mit ausformuliertem Anlass in scripts/lib/shipcard-exclusions.mjs'). Der Kommentarkopf der Ausnahme-Datei beschrieb diese Faehigkeit schon seit Welle 1 als Design-Absicht ('bzw. ein per sd__sub abgetrennter Unterabschnitt davon') — der Code lieferte sie nur noch nicht. Kein Verhalten fuer bestehende Ausnahmen (X-sd-simgrid, X-ch-profile-aggregate) geaendert, da beide weiterhin nur auf ihre jeweils treffende Ebene matchen."

patterns-established:
  - "Ausnahmen im Entdopplungs-Tor koennen jetzt gezielt EINEN Unterabschnitt eines mehrteiligen Kapitels treffen, ohne das ganze Kapitel aus der Pruefung zu nehmen — wichtig, sobald mehrere fruehere Einzel-Panels zu einem Kapitel verschmelzen."

requirements-completed: [D-01, D-02, D-03]

coverage:
  - id: D1
    description: "Vier unterscheidbare Kapitel statt zehn gleichfoermiger Panels — je eigene Rahmenoberkante, Zahl-Chip, Kopfzeilen-Codezeile; Datenblatt vollstaendig entfernt, alle sechs Felder bleiben an ihrer jeweils einzigen Stelle bestehen"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "node scripts/verify-shipcard.mjs --report — Zusicherung [2] 0/454 Verstoesse, [4] sd__panel=0 site-weit, sd__code===sd__chapter 0 Abweichungen; node -e Heading-Check ch-gear-Region liefert 1×h2/4×h3/2×h4"
        status: pass
      - kind: other
        ref: "playwright-core Screenshot gegen localhost:8411/schiffe/anvl-carrack (1280x5200) — visuell bestaetigt: vier Kapitel mit Gold/Cyan/Stahlblau/Muted-Akzent, kein Datenblatt-Block zwischen Beschreibung und Ausstattung"
        status: pass
    human_judgment: false
  - id: D2
    description: "Kargstes Schiff (ATLS) rendert weiterhin drei Kapitel und drei Sprungleisten-Pillen ohne toten Anker, wenn das Leistungsprofil-Kapitel mangels Daten entfaellt"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "grep -c auf dist/schiffe/argo-atls.html: sd__chapter=3, sd__code=3, href=\"#ch-=3; id=\"ch-profile\"=0 und href=\"#ch-profile\"=0; npm run audit:site meldet 0 tote Anker"
        status: pass
    human_judgment: false
  - id: D3
    description: "Balkenspuren gibt es nur noch im Leistungsprofil — die drei Masse-Balken und zwei Feuerkraft-Balken sind ersatzlos weg, die vier uebrigen Stellen sind Zahlen; Turm-DPS-Summenzelle nur bei mehr als einer Turmgruppe"
    requirement: "D-02"
    verification:
      - kind: other
        ref: "node scripts/verify-shipcard.mjs --report — Zusicherung [5] sd__gtrack=0 site-weit, sd__proftrack-Kopplung 0 Verstoesse; grep sd__gtrack in vier Pruefseiten (Carrack EN/DE, Idris-M, ATLS) je 0; grep -c auf src/components/ShipDetail.astro fuer sd__gfill|sd__grow|sd__gval = 0, sd__glabel = 4"
        status: pass
      - kind: other
        ref: "node-Skript zaehlt Total-DPS-Zelle site-weit: 23 von 227 Schiffen (mehr als eine Turmgruppe) tragen sie, 204 nicht — aegs-idris-m.html traegt sie, aegs-avenger-stalker.html nicht"
        status: pass
    human_judgment: false
  - id: D4
    description: "Der Quantum-Tank steht nur noch einmal (Entdopplung des zweifach gezaehlten Werts aus 14-CONTEXT.md); die drei Profilzeilen mit anderswo vorhandenem Rohwert (Tempo/Fracht/Quantum-Tempo) zeigen nur noch ihr Perzentil, die Vorlesebeschriftung behaelt den Rohwert"
    requirement: "D-03"
    verification:
      - kind: other
        ref: "node-Skript auf dist/schiffe/anvl-carrack.html: jeder SCU-Wert im Ausstattungs-Kapitel kommt genau 1x vor ({456,32,360,10.6} je 1x); Profilzeile Speed enthaelt kein 'm/s SCM'-Textstueck aber <i>P9</i>; aria-label der Perzentilspur enthaelt weiterhin '140 m/s SCM'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Das Entdopplungs-Tor (D-03, Zusicherung 6) ist gruen — jeder verbleibende Befund ist eine benannte, ausformulierte Ausnahme mit funktionierendem Zombie-Waechter"
    requirement: "D-03"
    verification:
      - kind: other
        ref: "node scripts/verify-shipcard.mjs (Tor-Modus) — ALLE ZUSICHERUNGEN ERFUELLT, Exit 0; Zusicherung [6] 0 Befunde von 2515 Token-Vorkommen; Zusicherung [8] Zombie-Waechter: X-ch-profile-aggregate 446 Treffer, X-cargo-cube-legende 206 Treffer, X-sd-simgrid 454 Treffer, X-einheiten-ausserhalb-des-vorrats 3412 Treffer (keine Ausnahme mit 0 Treffern)"
        status: pass
    human_judgment: false
  - id: D6
    description: "npm run build && npm run gate laufen gruen, normal UND mit STAGING=1 (CI-Bauform)"
    verification:
      - kind: other
        ref: "npm run build (17359 Seiten) + npm run gate (18/18 Schritte gruen, verify:shipcard bewusst disabled bis 14-04); STAGING=1 npm run build + STAGING=1 npm run gate (18/18 gruen), danach normaler Rebuild"
        status: pass
    human_judgment: false
  - id: D7
    description: "Sichtpruefung: wirken die vier Kapitel am gerenderten Bildpunkt tatsaechlich wie vier unterscheidbare Kapitel, und sieht die Balken-zu-Zahl-Umwandlung fertig statt kaputt aus?"
    verification: []
    human_judgment: true
    rationale: "Reines Sichturteil (14-UI-SPEC.md § Sichturteile Punkt 1, 2, 5) — ein Screenshot wurde gegen die Carrack angesehen und bestaetigt den erwarteten Aufbau, aber ob die Akzentfarben-Differenzierung 'am gerenderten Bildschirm zu subtil' wirkt oder ein 1-2-Balken-Leistungsprofil an einem kargen Schiff wie ein vollstaendiges Kapitel wirkt, ist laut UI-SPEC ausdruecklich dem Betreiber vorbehalten. Geht als benannter Punkt an .planning/WINDOWS.md."

duration: ~70min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 3: Vier Kapitel, kein Datenblatt, sechs Balken weniger Summary

**Aus zehn `.sd__panel`-Rahmen werden vier unterscheidbare Kapitel (Kaufen/Leistung/Ausstattung/Umfeld); das vollstaendig redundante Datenblatt faellt; sechs Balkenstellen werden zu Zahlen oder entfallen ersatzlos (D-02); der zweifach gezaehlte Quantum-Tank steht nur noch einmal (D-03) — `verify-shipcard.mjs` ist erstmals gruen.**

## Performance

- **Duration:** ~70 min
- **Started:** 2026-08-18T04:10:00Z (im Anschluss an 14-02)
- **Completed:** 2026-08-18T05:08:00Z
- **Tasks:** 2
- **Files modified:** 6 (4 aus dem Plan + 2 Werkzeug-Erweiterung)

## Accomplishments

- `CHAPTERS_SOURCE` (Frontmatter, einzige Quelle fuer Sprungleiste + Kapitelkoepfe) ist um drei Eintraege verlaengert (`ch-profile`, `ch-gear`, `ch-context`); jede Kapitelbedingung ist wortgleich die ODER-Verknuepfung ihrer vier bzw. drei Unterbedingungen weiter unten im Markup.
- Leistungsprofil ist jetzt Kapitel 02 (`sd__chapter--profile`), unveraendert im Inhalt bis auf die Profilzeilen-Anpassung aus Task 2.
- Ausstattung (Kapitel 03, `sd__chapter--gear`) vereint Masse & Fracht, Bewaffnung, Flugleistung (mit Agilitaet und Quantum als vierte Ueberschriftenebene) und Komponenten & Verteidigung als Unterabschnitte dritter Ebene, mit EINER konsolidierten `SPEC // {Hersteller}`-Kopfzeile statt vormals vier.
- Umfeld (Kapitel 04, `sd__chapter--context`) vereint Versicherung, Lackierungen, Varianten & Loaner (mit den zwei Unterueberschriften als vierte Ebene) und die Patch-Chronik (Ueberschrift von h2 auf h3 gesenkt, Kasten mit goldener Seitenkante unveraendert) als Unterabschnitte, mit EINER bedingten `CTX // FleetYards · Stand ...` bzw. `CTX // UEE`-Kopfzeile.
- Das Datenblatt-Panel ist vollstaendig entfernt: `buildFacts`-Aufruf, die `facts`-Konstante und der ungenutzte `ship.sheet.title`-Schluessel (DE+EN) sind weg; `buildFacts` selbst bleibt in `shipFacts.ts` unangetastet (weiterhin 1 Export), `ship.code.dat` bleibt bestehen (wird von `PatchDossier.astro` weiterverwendet).
- Sechs Balkenstellen aufgeloest: die drei Masse-Balken (Laenge/Breite/Hoehe) und die zwei Feuerkraft-Balken (Piloten-/Turm-DPS) entfallen ERSATZLOS mit erklaerendem Kommentar an der Fundstelle; die vier uebrigen (Tanks, Geschwindigkeit, Wendigkeit, Verteidigung) sind jetzt `sd__grid`/`sd__item`-Listen — dasselbe Raster, das bis Task 1 exklusiv das Datenblatt trug.
- Neue Turm-DPS-Summenzelle (`arm.stat.totalDps` = „Gesamt“/„Total“) im bestehenden `arm__sum`-Raster, aber NUR bei mehr als einer Turmgruppe (23 von 227 Schiffen) — sonst waere sie die Doppelung, die D-03 verbietet.
- `shipVisuals.ts`: die Tankliste liest den Quantum-Tank nicht mehr (er bleibt exklusiv beim Quantum-Kennwert) — mit Kommentar an der Fundstelle, welches Feld welche Anzeige behaelt und warum.
- `shipExtras.ts`: `ProfileBar`/`MetricDef` tragen ein neues `showValue`-Feld; Tempo, Fracht und Quantum-Tempo zeigen in der Profilzeile nur noch ihr Perzentil, Agilitaet/Feuerkraft/Verteidigung behalten ihren Rohwert (rechnerische Aggregate, die nirgends sonst stehen). Die Vorlesebeschriftung der Perzentilspur (`aria-label`) traegt den Rohwert bei ALLEN sechs Metriken unveraendert weiter.
- `verify-shipcard.mjs` `computeRegions()` prueft benannte Ausnahmen jetzt auch je Unterabschnitt (Subpiece), nicht nur je direktem Kind von `div.sd` — noetig, weil ein Kapitel wie Ausstattung mehrere Unterabschnitte buendelt und nur einer davon eine Ausnahme braucht. Diese Faehigkeit stand schon seit Welle 1 im Kommentarkopf von `shipcard-exclusions.mjs`, war aber nicht implementiert.
- Zwei neue benannte Ausnahmen: `X-ch-profile-aggregate` (Feuerkraft-/Verteidigungs-Summe im Leistungsprofil kann zufaellig mit dem Einzelwert einer einzigen Waffengruppe bzw. nur Huelle/nur Schilden zusammenfallen) und `X-cargo-cube-legende` (die Wuerfel-Massstabslegende „■ = N SCU“ ist ein UI-Massstab, keine Schiffseigenschaft, und kann zufaellig mit einem Tankwert oder — bei vier Schiffen — mit der freien Beschreibung kollidieren).
- `node scripts/verify-shipcard.mjs` (Tor-Modus) meldet **ALLE ZUSICHERUNGEN ERFUELLT** — vorher (Task 1 allein) noch Befunde bei Zusicherung 5/6, davor (Welle 1, unveraendert) 1.385 Doppelungsbefunde.

## Task Commits

1. **Task 1: Drei Kapitel statt neun Panels — und das Datenblatt faellt** - `3f1967e` (feat)
2. **Task 2: Balken nur, wo sie vergleichen — sechs Stellen, drei Wege** - `ffc75b1` (feat)

**Plan metadata:** siehe finaler Commit dieses Plans (folgt nach diesem SUMMARY)

## Files Created/Modified

- `src/components/ShipDetail.astro` - Kapitelliste um drei Eintraege verlaengert, Leistung/Ausstattung/Umfeld als Kapitel, Datenblatt entfernt, sechs Balkenstellen aufgeloest, Turm-DPS-Summenzelle, Profilzeilen-Rohwert bedingt, `.sd__panel`-Regel entfernt, fuenf Gauge-Regeln + Medienabfrage entfernt
- `src/lib/shipVisuals.ts` - Quantum-Tank aus der Tankliste entfernt (bleibt exklusiv im Quantum-Kennwert)
- `src/lib/shipExtras.ts` - `ProfileBar`/`MetricDef` um `showValue` erweitert, `buildProfile` reicht es durch
- `src/i18n/ui.ts` - neuer Schluessel `arm.stat.totalDps` (DE+EN), ungenutzter Schluessel `ship.sheet.title` entfernt (DE+EN)
- `scripts/verify-shipcard.mjs` - Ausnahme-Pruefung in `computeRegions()` greift jetzt auch je Unterabschnitt, nicht nur je direktem Kind von `div.sd`
- `scripts/lib/shipcard-exclusions.mjs` - zwei neue Ausnahmen (`X-ch-profile-aggregate`, `X-cargo-cube-legende`), Kopfkommentar zur Ausnahme-Entstehungszeit korrigiert

## Decisions Made

- **Kein Kapitel-Icon fuer Ausstattung und Umfeld.** Kaufen und Leistung erben ihr Icon vom vormaligen Einzel-Panel; die beiden neuen Verbund-Kapitel haben keinen natuerlichen „Leit“-Icon, und das UI-SPEC fuehrt fuer diese Phase ausdruecklich keine neuen Icons ein. Alle sieben Unterabschnitts-Icons bleiben an ihrer bisherigen Stelle (jetzt an h3/h4 statt h2).
- **Turm-DPS-Summe und Umfeld-Kopfzeilen-Code als Frontmatter-Variablen vorberechnet, nicht als JSX-Ausdruck im Markup.** Umgeht die Astro-5.18-Falle (Ausdruck auf oberster Ebene verschluckt das schliessende Tag) vollstaendig, statt sie mit `set:text` zu umschiffen — beide Werte sind reine Strings, kein Grund fuer eine JSX-Verzweigung im Markup.
- **`verify-shipcard.mjs` um Subpiece-Ausnahme-Pruefung erweitert** (siehe Deviations) — ausserhalb des im Plan gelisteten Dateisatzes, aber von der eigenen Task-2-Abnahmekriterien-Formulierung verlangt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `verify-shipcard.mjs` konnte Ausnahmen nur je Kapitel, nicht je Unterabschnitt matchen**
- **Found during:** Task 2 (erster `--report`-Lauf nach der Balken-Umwandlung)
- **Issue:** Nach der Umwandlung blieben 8 Doppelungsbefunde: 6 zwischen der freien Schiffsbeschreibung (`sd__desc`) und dem Frachtraum-Text, 2 zwischen der Wuerfel-Massstabslegende und dem Quantum-Treibstoff-Wert (beide bei `rsi-salvation`, wo Wasserstoff- und Quantum-Tank zufaellig auf denselben gerundeten SCU-Wert wie die Legende fallen). Der einzige verfuegbare Ausnahme-Mechanismus (`exclude-region`) matchte nur GANZE direkte Kinder von `div.sd` (ein komplettes Kapitel) — eine Ausnahme fuer nur „Maße & Fracht“ innerhalb des vierteiligen Ausstattungs-Kapitels war damit nicht moeglich, ohne das ganze Kapitel aus der Pruefung zu nehmen.
- **Fix:** `computeRegions()` prueft `REGION_EXCLUSIONS` jetzt zusaetzlich je aufgespaltenem Unterabschnitt (Subpiece), nicht nur je direktem Kind — exakt die Faehigkeit, die der Kommentarkopf von `shipcard-exclusions.mjs` seit Welle 1 als Design-Absicht beschrieb („bzw. ein per sd__sub abgetrennter Unterabschnitt davon“), aber nicht umsetzte. Zwei neue Ausnahmen (`X-ch-profile-aggregate`, `X-cargo-cube-legende`) nutzen diese Faehigkeit; die vier verbleibenden Beschreibungs-Kollisionen loesen sich als Nebeneffekt der zweiten Ausnahme mit auf.
- **Files modified:** scripts/verify-shipcard.mjs, scripts/lib/shipcard-exclusions.mjs
- **Verification:** `node scripts/verify-shipcard.mjs` (Tor-Modus) meldet 0 Befunde und Exit 0; Zombie-Waechter bestaetigt beide neuen Ausnahmen mit 446 bzw. 206 Treffern (keine Ausnahme auf Vorrat).
- **Committed in:** `ffc75b1` (Task 2 Commit)

---

**Total deviations:** 1 auto-fixed (1 Missing Critical — Werkzeug-Faehigkeit)
**Impact on plan:** Notwendig, um die im Plan selbst verlangte Abnahme („`node scripts/verify-shipcard.mjs` gibt 0 zurueck“, „jeder Befund ... steht mit ausformuliertem Anlass in scripts/lib/shipcard-exclusions.mjs“) tatsaechlich zu erfuellen. Kein Verhalten bestehender Ausnahmen geaendert; reine Werkzeug-Vervollstaendigung, kein Scope-Creep an der Seite selbst.

## Issues Encountered

- **Verifikations-Schnipsel aus dem Plan selbst ist fehlerhaft.** Die im Task-2-Acceptance-Criteria genannte Pruefzeile `s.slice(s.indexOf('id="ch-profile"'), s.indexOf('sd__desc'))` trifft auf `.sd__desc{...}` in `<style is:inline>` (VOR dem Koerper), nicht auf die Beschreibung im Markup — das ergibt eine leere oder negative Spanne und ein falsches `false false` statt des erwarteten `false true`. Ersatzweise mit `s.indexOf('id="ch-gear"')` als Ende-Marke nachgeprueft (eindeutig, kommt nur einmal vor): liefert das erwartete `false` (kein Rohwert) und `true` (Perzentil vorhanden). Keine Aenderung an Quelle oder Pruefskript noetig — nur der Ad-hoc-Verifikationsbefehl war falsch, nicht das Ergebnis.
- Port 4321 trug weiterhin einen fremden Astro-Dev-Server (siehe 14-01/14-02); die Sichtpruefung lief stattdessen gegen den vom Orchestrator bereitgestellten statischen Server auf Port 8411 (serviert das `dist/` dieses Worktrees), zusaetzlich wurde die Messsonde einmal direkt gegen Port 4321 gefahren (rein lesend, unveraendert gelassen) fuer die 190/192-Selbstauskunft.

## User Setup Required

None - keine externe Dienstkonfiguration noetig.

## Known Stubs

Keine.

## Threat Flags

Keine neuen — die Turm-DPS-Summenzelle ist eine in der Bibliothek gebildete Zahl (kein `innerHTML`, keine Fremdquellen-Zeichenkette), die konsolidierten Kopfzeilen-Codes nennen ausschliesslich bereits sichtbare Fremdquellen bzw. Standard-Angaben (siehe `14-03-PLAN.md` Threat Register T-14-09 bis T-14-12, alle wie geplant abgedeckt). Gegenprobe: `grep -c "set:html" src/components/ShipDetail.astro` liefert weiterhin 0.

## Next Phase Readiness

- Alle drei D-Entscheidungen (D-01/D-02/D-03) sind jetzt vollstaendig im Markup umgesetzt; `verify-shipcard.mjs` ist zum ersten Mal seit seiner Anlage (Welle 1) durchgaengig gruen.
- Die Seitenhoehe der Carrack ist bereits ohne Wave-4-Zweispaltigkeit von 5.554 px (Ausgangsmessung) auf 5.155 px (DE, 1280×720, dunkel) gesunken — ~400 px allein durch Kapitelbildung, Datenblatt-Wegfall und Balkenrueckbau. Die 4.200-px-Sperrklinke (Erfolgskriterium 6) bleibt erwartungsgemaess gerissen: das ist Aufgabe von Welle 4 (kapitelinterne Zweispaltigkeit, 14-UI-SPEC.md Detailvertrag Punkt 9).
- `verify:typo` (Token-Untergrenze) bleibt gruen OHNE Ratchet-Senkung: 239.841 statt der Sperrklinke 235.539 (4.302 Punkte Reserve) — die im Plan als „sehr wahrscheinlich“ vorhergesagte Rissgefahr trat nicht ein, weil die neuen Kapitelregeln (vier Akzent-Modifikatoren, Kapitel-Kopf-Regeln) die geloeschten Gauge-Regeln staerker kompensieren als erwartet. Kein Ratchet-Senkungs-Commit noetig.
- Offener Punkt fuer die Sichtrunde (siehe `coverage: D7` und UI-SPEC „Sichturteile“ 1/2/5): ob die vier Akzentfarben am gerenderten Bildschirm wirklich unterscheidbar wirken und ob ein 1-2-Balken-Leistungsprofil an einem kargen Schiff wie ein vollstaendiges Kapitel oder wie ein Rest wirkt — geht als benannter Punkt an `.planning/WINDOWS.md`.
- Welle 4 (`14-04-PLAN.md`) kann `verify:shipcard` scharf schalten (`disabled` → aktiv in `gate-registry.mjs`) und die kapitelinterne Zweispaltigkeit fuer Ausstattung/Umfeld bauen, um die 4.200-px-Marke zu erreichen.
- Kein Blocker. `npm run build && npm run gate` gruen, zusaetzlich je einmal mit `STAGING=1` nach Task 1 UND nach Task 2.

## Self-Check: PASSED

All modified files found on disk; both task commits (`3f1967e`, `ffc75b1`) found in `git log`.

---
*Phase: 14-schiffs-datenkarte-entstapeln*
*Completed: 2026-08-18*
