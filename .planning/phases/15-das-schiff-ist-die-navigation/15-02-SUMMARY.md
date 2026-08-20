---
phase: 15-das-schiff-ist-die-navigation
plan: 02
subsystem: testing
tags: [gate, verify-script, dedup-scan, ratchet, node]

requires:
  - phase: 15-das-schiff-ist-die-navigation
    provides: "15-01: P-3 entschieden (Variante C), P-1/P-2 gemessen, Textbestands-Ausgangswert je Seite"
provides:
  - "scripts/verify-shipconsole.mjs — acht Zusicherungen gegen den ZIELZUSTAND der Konsole (Rail<->System-Bijektion, P-3-Markerzahl, D-02-Sichtbarkeit ohne JS, Textbestands-Klinke, Sprachparitaet), vorgefuehrt rot, ausgesetzt bis 15-05-PLAN.md"
  - "verify:shipcard's Entdopplungs-Scan sieht jetzt in section.holo hinein (zwei Bloecke statt einem), mit eigener Selbstauskunft je Block"
  - "Ein echter, vorher unsichtbarer Fund (holo__dims dupliziert L/B/H) benannt und als Ausnahme dokumentiert statt versteckt"
affects: [15-03-das-schiff-ist-die-navigation, 15-04-das-schiff-ist-die-navigation, 15-05-das-schiff-ist-die-navigation]

tech-stack:
  added: []
  patterns:
    - "extractRegionByClass()/extractAllRegionsByClass(): Verallgemeinerung von extractRegion() (verify-shipcard.mjs), die die Tagart aus dem Fund selbst liest statt sie vorab zu kennen — noetig, weil section.holo/.holo__rail/.holo__sys keine feste Tagart vorschreiben"
    - "Zwei-Block-Regionsbildung in computeRegions(): der Entdopplungs-Scan zerlegt jetzt div.sd UND section.holo in EINE gemeinsame Regionsliste, jede Region traegt ihren Quellblock fuer die Selbstauskunft"
    - "Ausgesetztes Zielzustand-Tor (Praezedenz verify:shipcard 14-01->14-04): ein Tor wird GEGEN den kuenftigen Zustand geschrieben, einmal vorgefuehrt rot, dann mit benanntem Anlass ausgesetzt (disabled) bis der Zustand existiert — npm run gate bleibt gruen, die Schuld wird bei jedem Lauf gedruckt"
    - "Byte-Textbestands-Klinke in Hausform (regel:'min' + toleranzProzent), analog scripts/lib/metrics-baseline.mjs, hier erstmals auf visibleText()-Bytes je Seite statt auf eine Bestandszahl angewendet"

key-files:
  created:
    - scripts/verify-shipconsole.mjs
  modified:
    - scripts/lib/gate-registry.mjs
    - package.json
    - scripts/verify-shipcard.mjs
    - scripts/lib/shipcard-exclusions.mjs
    - .planning/phases/15-das-schiff-ist-die-navigation/deferred-items.md

key-decisions:
  - "Textbestands-Klinke (Erfolgskriterium 3) auf 3.177 Bytes gesetzt — der heute (20.08.2026) gemessene Minimalwert ueber alle 454 Schiffsseiten (argo-atls-geo-collector-grad01), mit 2% Reserve (effektive Untergrenze ~3.113 Bytes) gegen Rundungsschwankungen zwischen zwei Laeufen desselben Standes (z. B. durch das Preisdatum je Seite). Dieselbe Sperrklinken-Mechanik wie scripts/lib/metrics-baseline.mjs (regel 'min' + toleranzProzent), hier erstmals auf Textbytes angewendet."
  - "Der erste Lauf gegen die erweiterte Entdopplungs-Regionsbildung widerlegte eine Planungsannahme aus 15-02-PLAN.md ('section.holo traegt heute keine Zahl-plus-Einheit-Token'): .holo__dims spiegelt L/B/H als HUD-Kurzanzeige auf der Buehne, identisch zu den Werten im Kapitel 'Ausstattung > Masse & Fracht'. Statt die Erweiterung zurueckzudrehen (ausdruecklich verboten von der Planvorgabe) wurde eine fuenfte benannte Ausnahme X-holo-dims-hud angelegt, in derselben Form wie die vier bestehenden (Precedent X-cargo-cube-legende: eine Kurzreferenz direkt am visuellen Objekt ist keine Doppelung im Sinne von D-03)."
  - "shipcard-exclusions.mjs wurde dafuer beruehrt, obwohl es NICHT in files_modified der Plan-Frontmatter stand — Deviation Rule 3 (blockierender Fund: ohne die Ausnahme waere verify:shipcard rot geworden und haette npm run gate gerissen, was gegen die Hausregel 'vor jedem Push gruen' verstossen haette)."
  - "#holoact (toter 'Hologramm aktivieren'-Knopf, deferred-items.md) wurde in dieser Welle NICHT angefasst — 15-02-PLAN.md's beide Tasks beruehren ausschliesslich Pruefskripte, kein Markup/CSS. deferred-items.md's Einschaetzung 'voraussichtlich 15-02' war falsch geraten und wurde korrigiert (jetzt: spaeter, wenn Detailvertrag Punkt 7 umgesetzt wird)."

requirements-completed: [D-02, P-3]

duration: ~30min
completed: 2026-08-20
status: complete
---

# Phase 15 Plan 2: Konsolen-Tor -- vorgefuehrt rot, ausgesetzt bis Welle 5 Summary

**`scripts/verify-shipconsole.mjs` (acht Zusicherungen gegen den Zielzustand der Schiffs-Konsole) angelegt, gegen den heutigen Stand vorgefuehrt rot (454/454 Seiten ohne `.holo__sys`) und mit benanntem Anlass ausgesetzt; `verify:shipcard`s Entdopplungs-Scan sieht jetzt in `section.holo` hinein und hat dabei sofort einen echten, vorher unsichtbaren Fund gemacht (`.holo__dims` dupliziert L/B/H) -- benannt statt versteckt.**

## Performance

- **Duration:** ~30min
- **Completed:** 2026-08-20T08:50:00Z
- **Tasks:** 2/2
- **Files modified:** 6 (1 neu, 5 geaendert)

## Accomplishments

- **`scripts/verify-shipconsole.mjs` angelegt** — acht Zusicherungen (Bestand, Konsolen-Geruest, Rail<->System-Bijektion, P-3-Markerzahl gegen `#holodata`, D-02-Sichtbarkeit ohne JavaScript, Textbestands-Klinke, Sprachparitaet, Zombie-Waechter), Berichtsmodus (`--report`, immer Exit 0), Tor-Modus (Exit 1 bei Verstoss). Schienenfaehig fuer Schiene A: kein git, kein Netz, kein Kindprozess, keine `Data.p4k` (geprueft per Grep, kein Treffer).
- **Rot-Vorfuehrung durchgefuehrt** gegen den nach Welle 1 gebauten Stand (`bfdffe8`, frisch gebaut): `node scripts/verify-shipconsole.mjs` gibt Exit 1 zurueck. Erste reissende Zusicherung woertlich (siehe unten).
- **Registry-Eintrag** `verify:shipconsole` in `scripts/lib/gate-registry.mjs` (Schiene A, direkt hinter `verify:shipcard`) mit `disabled` und benanntem Anlass; `package.json` traegt das npm-Skript. `npm run gate` bleibt gruen, druckt den Schuldenposten bei jedem Lauf.
- **`verify:shipcard`s `computeRegions()` erweitert**: zwei Bloecke statt einem (`div.sd` UND `section.holo`), exakt am Klassenattribut geschnitten (Gegenprobe im Kommentar: `class="holo__bar"` enthaelt nicht die Zeichenkette `class="holo"`). Zusicherung 6 druckt jetzt zusaetzlich, wie viele Regionen aus welchem Block stammen.
- **Echter Fund durch die Erweiterung**: `.holo__dims` (HUD-Kurzanzeige "L … m · W … m · H … m" auf der 3D-Buehne) dupliziert dieselben Werte wie das Kapitel "Ausstattung > Masse & Fracht" — eine Planungsannahme des Plans hat sich als falsch erwiesen. Als fuenfte benannte Ausnahme `X-holo-dims-hud` dokumentiert (Precedent `X-cargo-cube-legende`), nicht durch Rueckbau der Erweiterung "geloest".
- **`npm run build && npm run gate` gruen**, normal UND mit `STAGING=1` (19/19 Schritte, beide Laeufe, `verify:shipconsole` als Schuldenposten sichtbar auf beiden).

## Task Commits

1. **Task 1: Das Konsolen-Tor — erst Bericht, dann Urteil, einmal vorgefuehrt rot** - `92b815c` (feat), Nachtrag `47cc58b` (fix, Soll/Ist-Vollstaendigkeit fuer Zusicherung 8)
2. **Task 2: Der Entdopplungs-Scan bekommt die Konsole ins Blickfeld** - `148e8e2` (feat)

**Plan metadata:** siehe unten (dieser Commit)

## Files Created/Modified

- `scripts/verify-shipconsole.mjs` - neues Tor, acht Zusicherungen, Berichts-/Tor-Modus, dupliziert Grundwerkzeug (`stripCommentsAndScripts`, `scanElements`, `extractRegion`, `visibleText`) aus `verify-shipcard.mjs` mit Attributionshinweis
- `scripts/lib/gate-registry.mjs` - Eintrag `verify:shipconsole` (Schiene A, `disabled` mit Anlass)
- `package.json` - npm-Skript `verify:shipconsole`
- `scripts/verify-shipcard.mjs` - `computeRegions()` scannt jetzt `div.sd` UND `section.holo`; Zusicherung 6 druckt Regionenzahl je Block
- `scripts/lib/shipcard-exclusions.mjs` - fuenfte Ausnahme `X-holo-dims-hud` (Deviation, siehe unten)
- `.planning/phases/15-das-schiff-ist-die-navigation/deferred-items.md` - Wellen-Einschaetzung fuer `#holoact` korrigiert

## Decisions Made

- **Textbestands-Klinke** auf 3.177 Bytes (Ist-Minimum ueber 454 Seiten, 20.08.2026) mit 2% Reserve gesetzt — siehe key-decisions oben fuer die volle Begruendung.
- **`X-holo-dims-hud`-Ausnahme statt Rueckbau der Erweiterung** — der Plan verlangt ausdruecklich, einen echten Fund zu benennen statt die Erweiterung zurueckzudrehen; die Ausnahme folgt derselben Form wie die vier bestehenden Eintraege.
- **`#holoact` nicht angefasst, Fehleinschaetzung in `deferred-items.md` korrigiert** — siehe Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `X-holo-dims-hud`-Ausnahme in `shipcard-exclusions.mjs` ergaenzt**
- **Found during:** Task 2, erster Lauf von `node scripts/verify-shipcard.mjs --report` gegen die erweiterte Regionsbildung
- **Issue:** Die Planungsannahme in 15-02-PLAN.md ("section.holo traegt heute … aber keine Zahl-plus-Einheit-Token") war falsch. `.holo__dims` (`ShipDetail.astro` Z. 119/725/1219) rendert "L … m · W … m · H … m" als HUD-Kurzanzeige direkt auf der 3D-Buehne — dieselben Werte wie im Kapitel "Ausstattung > Masse & Fracht". Ohne Ausnahme meldete `verify:shipcard` 513 Befunde und wuerde rot, was `npm run gate` gerissen haette (Hausregel: vor jedem Push gruen, keine Ausnahme).
- **Fix:** Fuenfte Ausnahme `X-holo-dims-hud` (mode `exclude-region`) angelegt, exakt in der Form der vier bestehenden Eintraege, mit vollstaendigem Anlasstext (Precedent `X-cargo-cube-legende`: eine Kurzreferenz unmittelbar am visuellen Objekt ist keine Doppelung im Sinne von D-03). `shipcard-exclusions.mjs` steht dadurch NICHT in der Plan-Frontmatter `files_modified` — dokumentiert hier als Deviation.
- **Files modified:** `scripts/lib/shipcard-exclusions.mjs`
- **Verification:** `node scripts/verify-shipcard.mjs` — Befunde nach der Ausnahme wieder bei 0, Token-Gesamtzahl unveraendert bei 2515 gegenueber dem Lauf vor der Erweiterung (Beleg, dass die Kennwerte-Leiste `div.holo__bar` weiterhin NICHT im Zaehlbereich ist). Zombie-Waechter: `X-holo-dims-hud: 454 Treffer`.
- **Committed in:** `148e8e2` (Task 2 commit)

**2. [Rule 1 - Bug] Zusicherung 8 (Zombie-Waechter) des neuen Tors druckte keine Soll-/Ist-Zeile**
- **Found during:** Selbstpruefung gegen Task 1s eigenes Acceptance-Criteria ("Die Ausgabe enthaelt fuer JEDE der acht Zusicherungen eine Zeile mit den Woertern Soll und Ist")
- **Issue:** Bei leerer Ausnahmeliste druckte Zusicherung 8 nur "keine Ausnahmen", ohne die geforderte Soll-/Ist-Zeile.
- **Fix:** Eine Soll-/Ist-Kopfzeile ergaenzt (Zahl registrierter Ausnahmen), zusaetzlich je Ausnahme eine Soll-/Ist-Zeile statt nur der Trefferzahl.
- **Files modified:** `scripts/verify-shipconsole.mjs`
- **Verification:** `node scripts/verify-shipconsole.mjs --report | grep -c "Soll"` liefert 21 (>=8); Rot-Vorfuehrung unveraendert (erste reissende Zusicherung bleibt [2]).
- **Committed in:** `47cc58b`

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blockierender Fund, 1 Rule 1 Bug)
**Impact on plan:** Beide noetig, um die Plan-Acceptance-Criteria ehrlich zu erfuellen (`npm run gate` gruen halten bzw. die Selbstauskunfts-Vorgabe erfuellen). Kein Scope-Creep — keine der Aenderungen beruehrt `src/` oder `ShipDetail.astro`.

## Issues Encountered

- **Der in Welle 1 dokumentierte Textbestands-Ausgangswert (~5.114 Bytes, nur Carrack) war nicht die richtige Groesse fuer eine seitenuebergreifende Klinke.** Erfolgskriterium 3 verlangt eine Klinke ueber ALLE Seiten, nicht nur die Carrack. Deshalb wurde `npm run build` frisch gefahren und `node scripts/probes/schiffskonsole-messung.mjs --census` erneut ausgefuehrt (Messgruppe c-textbestand), um den echten Minimalwert ueber alle 454 Seiten zu erheben: 3.177 Bytes (`argo-atls-geo-collector-grad01`), nicht 5.114. Dieser Wert, nicht der Carrack-Einzelwert, ist die korrekte Grundlage fuer eine Klinke, die JEDE Seite treffen muss.
- **`#holoact` (deferred-items.md) wurde NICHT in dieser Welle behoben**, wie im Auftrag ausdruecklich erlaubt ("wenn nicht geplant, explizit sagen"): 15-02-PLAN.md's Tasks beruehren ausschliesslich `scripts/verify-shipconsole.mjs`, `scripts/lib/gate-registry.mjs`, `package.json`, `scripts/verify-shipcard.mjs` — kein Markup, kein CSS. Der Knopf ist weiterhin tot und wird laut `15-UI-SPEC.md` Detailvertrag Punkt 7 (Ladeausloeser Klick->Scroll, D-04) in einer spaeteren Welle (voraussichtlich 15-03/15-04) ersatzlos entfernt. `deferred-items.md`s Wellen-Einschaetzung war eine Vermutung des Vorgaenger-Plans, keine Zusage von 15-02 — korrigiert statt stillschweigend falsch stehen gelassen.

## User Setup Required

None - keine externe Dienstkonfiguration.

## Next Phase Readiness

- **`verify:shipconsole` liegt bereit als Bauvorschrift fuer die Wellen 3/4**: seine acht Zusicherungen (insbesondere die Selektoren `.holo__sys`, `.holo__rail`, `.holo__rail-ct`, die feste id-Menge `sys-core/sys-arms/sys-prop/sys-other`, und die Href-Konvention `#sys-*`) sind ab jetzt die verbindliche Zielform — wer sie beim Bauen abweichend benennt, muss entweder das Markup oder das Tor anpassen, nicht beides stillschweigend auseinanderlaufen lassen.
- **Die Rail-Verteilung `{1:6, 2:22, 3:20, 4:179}` (je Sprache) ist als harte Erwartung in Zusicherung 2 einprogrammiert** — sie stammt aus der in Welle 1 fest entschiedenen P-3-Variante C und aendert sich nicht mehr durch Wellen 3/4, nur durch eine neue P-3-Entscheidung.
- **Rot-Vorfuehrung wiederholbar**: `node scripts/verify-shipconsole.mjs` gegen den heutigen Stand liefert Exit 1 mit derselben ersten Meldung ("454 Seite(n) ohne `.holo__sys` innerhalb `section.holo`"). Sobald Welle 3/4 die Konsole baut, sollte dieselbe Kommandozeile schrittweise gruener werden — ein nuetzlicher Fortschrittsindikator waehrend des Bauens, nicht nur eine Endabnahme.
- **Scharfschaltung ist Aufgabe von `15-05-PLAN.md`**: Registry-Eintrag `disabled` entfernen, `verify:shipcard`s eigene Rot-Vorfuehrung der Konsolen-Erweiterung nachholen (Bewaffnungswert absichtlich doppelt stehen lassen, siehe `15-UI-SPEC.md` Punkt 11.5).
- **`#holoact` bleibt offen** fuer die Welle, die Detailvertrag Punkt 7 umsetzt — kein Blocker.
- `npm run build && npm run gate` gruen, normal UND mit `STAGING=1` (19/19 Schritte, beide Laeufe).

---
*Phase: 15-das-schiff-ist-die-navigation*
*Completed: 2026-08-20*

## Self-Check: PASSED

Alle sechs genannten Dateien gefunden (`scripts/verify-shipconsole.mjs`,
`scripts/lib/gate-registry.mjs`, `package.json`, `scripts/verify-shipcard.mjs`,
`scripts/lib/shipcard-exclusions.mjs`,
`.planning/phases/15-das-schiff-ist-die-navigation/deferred-items.md`).
Alle drei genannten Commit-Hashes gefunden (`92b815c`, `148e8e2`, `47cc58b`).
