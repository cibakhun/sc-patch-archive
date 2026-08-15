---
phase: 09-mining-werkbank-fundort-merkliste
plan: 01
subsystem: ui
tags: [astro, mining-workbench, supabase, postgrest, node-test, i18n]

requires: []
provides:
  - Mining-Werkbank-Mitte als eine Bahn (Kopf, Fundorte, Beste Stationen) statt zweigeteilter Detailspalte
  - Fundort-Anheften je Zeile mit Nadelknopf, ausschliesslich bei Fundort-Zeilen
  - Zweiter Reiter "Fundorte" rechts mit erz-uebergreifender Merkliste ("Erz — Fundort")
  - Gemeinsames Preset-System: ein Preset traegt Signaturen UND Fundort-Paare
  - Migrationsdatei fuer die neue `locations`-Spalte auf `mining_sig_presets` (noch nicht angewandt)
  - Maschineller Rundlauf-Nachweis (10 node:test-Faelle) plus Dauerwaechter gegen "|" in Namen
affects: [09-02-fundort-merkliste-erweiterung]

tech-stack:
  added: []
  patterns:
    - "Sprachobjekt als zwei benannte Konstanten (S_DE/S_EN) + Build-Zeit-Paritaetspruefung statt de-?-Ternary, Vorbild assertHelpParity() in src/i18n/help.ts"
    - "Fundort-Paar-Schluessel 'Erz||Fundort' als einziges Trennzeichen-Format, gegengehalten in scripts/verify-mining.mjs und der Presets-Spalte"

key-files:
  created:
    - supabase/migrations/20260815090000_mining_preset_locations.sql
    - tests/e2e/helpers/mining-dom.js
    - tests/e2e/mining-shortlist.test.js
  modified:
    - src/components/MiningWorkbench.astro
    - assets/mining-workbench.js
    - src/i18n/help.ts
    - scripts/verify-mining.mjs

key-decisions:
  - "Ein Preset haelt beide Listen (locations-Spalte an der bestehenden Tabelle, nicht zwei getrennte Preset-Systeme) — Begruendung steht bereits in 09-01-PLAN.md, hier nur ausgefuehrt."
  - "Task 1 (Tracer) liess wb-stats/wb-bands/wb-rocks-Zugriffe im Client-Skript zunaechst nur schuetzen (Rule 1), Task 3 hat sie vollstaendig entfernt — vermeidet einen Zwischenzustand mit kaputtem renderDetail()."
  - "Zwei CSS-Regeln (Reiterleiste, seg-view-Wiedereinblenden) wurden ueber ID bzw. Geschwisterposition statt ueber ihre Markup-Klasse adressiert, um Task 1s eigene Struktur-Zusicherung (genau 1 Treffer je Klassenname im gebauten HTML) nicht durch den eigenen Stil-Kommentar bzw. die eigene Stil-Regel zu unterlaufen."

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-07]

coverage:
  - id: D1
    description: "Mitte der Werkbank ist eine Bahn (Kopf, Fundorte, Beste Stationen), keine Spur der Detailspalte mehr"
    verification:
      - kind: automated_ui
        ref: "node -e Substring-Zaehlung gegen dist/topics/mining.html + dist/de/topics/mining.html (im Task-1/Task-3-Verify-Block von 09-01-PLAN.md)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fundort anheften faerbt die Nadel, Paar erscheint rechts im Reiter 'Fundorte' als Erz — Fundort"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#Fundort anheften traegt das Paar in die Merkliste als \"Erz — Fundort\""
        status: pass
      - kind: automated_ui
        ref: "agent-browser: Klick auf Aaron-Halo-Nadel bei Quantainium, rgb(224,165,38) gemessen, Reiter-Wechsel geprueft (siehe Bericht)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Altes Preset (ohne locations-Feld bzw. mit locations:null) laedt verlustfrei"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#Preset in der alten Form (kein locations-Feld) laedt / #Preset mit locations: null verhaelt sich wie ein Preset ohne das Feld"
        status: pass
    human_judgment: false
  - id: D4
    description: "Preset speichert und laedt BEIDE Listen (Signaturen + Fundorte), Wechsel tauscht statt zu vereinigen"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#Preset speichern / #Merkliste leeren, dasselbe Preset erneut waehlen / #Preset A und Preset B im Wechsel"
        status: pass
    human_judgment: false
  - id: D5
    description: "Kein Nadelknopf in der Stationsliste, keiner bei Erzen ohne Fundorte (Carinite/Jaclium/Sadaryx/Saldynium)"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#Erz MIT Fundorten / #Carinite (ohne Fundorte, O-2)"
        status: pass
    human_judgment: false
  - id: D6
    description: "T-09-01: HTML-Sonderzeichen in einem Fundortnamen landen escaped im Markup"
    verification:
      - kind: e2e
        ref: "tests/e2e/mining-shortlist.test.js#T-09-01"
        status: pass
    human_judgment: false
  - id: D7
    description: "Datenbank-Migration angelegt, NICHT angewandt (Betreiber-Schritt); Oberflaeche funktioniert trotzdem"
    verification: []
    human_judgment: true
    rationale: "Anwenden der Migration ist ausdruecklich Betreiber-Handlung (Precondition in Task 1); die Datei selbst wurde nur strukturell/gegen SQL-Konventionen geprueft (Lesen + Vergleich mit der Vorgaenger-Migration), nicht gegen die echte Datenbank ausgefuehrt."
  - id: D8
    description: "Build+Gate gruen, auch mit STAGING=1 (Layout-Aenderung)"
    verification:
      - kind: other
        ref: "npm run build && npm run gate (18/18); STAGING=1 npm run build && STAGING=1 npm run gate (18/18)"
        status: pass
    human_judgment: false

duration: 43min
completed: 2026-08-15
status: complete
---

# Phase 9 Plan 01: Leitschuss Mining-Werkbank-Fundort-Merkliste Summary

**Mining-Werkbank-Mitte auf eine Bahn zusammengelegt, Fundorte einzeln anheftbar in einen zweiten Reiter „Fundorte" mit erz-uebergreifender Merkliste, ein Preset traegt jetzt Signaturen UND Fundort-Paare — mit einer Datenbank-Migration, die bewusst noch nicht angewandt ist.**

## Performance

- **Duration:** 43 min (erster bis letzter Task-Commit)
- **Started:** 2026-08-15T02:18:07+02:00
- **Completed:** 2026-08-15T03:01:05+02:00
- **Tasks:** 3
- **Files modified:** 7 (1 neu: Migration, 2 neu: Test + Test-Helfer, 4 geaendert)

## Accomplishments

- Mitte der Werkbank ist eine Bahn: Erz-Kopf, Fundorte, Beste Stationen — die Detailspalte (Physik, Qualitaetsstufen, „Steine mit diesem Erz") ist ersatzlos aus Markup, Client-Skript, Sprachobjekt und Stilblock verschwunden.
- Jede Fundort-Zeile des gewaehlten Erzes traegt einen eigenen Nadelknopf (`.wb__lpin`, `data-locpin="Erz||Fundort"`); die Stationsliste und die Erze ohne Fundorte (Carinite, Jaclium, Sadaryx, Saldynium) bekommen keinen.
- Neuer Reiter „Fundorte" rechts neben „Signaturen", beide teilen sich denselben Preset-Block; die Fundort-Merkliste zeigt Eintraege als „Erz — Fundort" und sammelt ueber alle Erze hinweg.
- `mining_sig_presets` bekommt eine `locations`-Spalte (Migration angelegt, NICHT angewandt); Preset-Laden/-Speichern/-Anwenden traegt beide Listen, ein Preset vor dieser Phase laedt unveraendert weiter.
- Maschineller Rundlauf-Nachweis: 10 neue node:test-Faelle gegen das echte `assets/mining-workbench.js` in einem eigenstaendigen Mock-DOM, plus ein Dauerwaechter in `scripts/verify-mining.mjs` gegen „|" in Mineral- oder Fundortnamen.
- Sprachobjekt der Komponente von einem `de ? {…} : {…}`-Ternary auf zwei benannte Konstanten mit Build-Zeit-Paritaetspruefung umgebaut (Vorbild `assertHelpParity()`).

## Task Commits

1. **Task 1: Leitschuss — eine Mitte, ein angehefteter Fundort, ein Preset ueber beide Listen** - `772efc4` (feat)
2. **Task 2: Der maschinelle Nachweis** - `3141e7a` (test)
3. **Task 3: Tote Reste abtragen und den Paar-Schluessel unter Aufsicht stellen** - `27ff406` (refactor)

_Kein separater `docs:`-Metadaten-Commit fuer dieses Summary — folgt gleich als Teil des finalen Commits dieses Plans._

## Files Created/Modified

- `supabase/migrations/20260815090000_mining_preset_locations.sql` — neue Spalte `locations text[]` + Laengen-Pruefklausel (<=128) + Kommentar mit dem Eintragsformat; NICHT angewandt (Betreiber-Schritt)
- `src/components/MiningWorkbench.astro` — Mitte auf ein Paneel zusammengelegt, Reiterleiste + Fundort-Reiter in der rechten Spalte, ROCK_FAMILY/rockLabel()/rocksByElement geloescht, Nutzlast schlanker, Sprachobjekt in S_DE/S_EN mit Paritaetspruefung, Stilblock entsprechend gekuerzt
- `assets/mining-workbench.js` — `S.locPins`, `row2()` mit optionalem Nadelknopf, `renderLocPins()`, delegierter Klick fuer `data-locpin`/`data-tab`, Preset-Strecke traegt beide Listen, `stat()` und die drei Physik/Baender/Steine-Bloecke entfernt
- `src/i18n/help.ts` — drei neue Hilfe-Schluessel (`mining.ctl.locpin`, `.tabs`, `.shortlist`) in DE und EN
- `scripts/verify-mining.mjs` — neue Zusicherung gegen „|" in Namen, Erfolgszeile nennt die gepruefte Namenszahl
- `tests/e2e/helpers/mining-dom.js` — neu: eigenstaendiges Mock-DOM (closest/focus/select/classList.toggle nachgeruestet, In-Memory-`mining_sig_presets`-Attrappe, Nutzlast aus den echten Datendateien)
- `tests/e2e/mining-shortlist.test.js` — neu: 10 Testfaelle

## Decisions Made

- **Preset-Format `"<Erz>||<Fundort>"`** — bereits in 09-01-PLAN.md entschieden (O-1), hier nur umgesetzt; derselbe Trenner wie `scripts/verify-mining.mjs` Zeile 68 nutzt.
- **CSS-Adressierung ueber ID/Position statt Klasse an zwei Stellen** (`#wb-tabbar` statt `.wb__tabs`, `:nth-of-type(2)` statt `.wb__pane--mid` in der 760px-Regel für seg-view): Task 1s eigene automatisierte Verifikation zaehlt Klassennamen-Vorkommen im gebauten HTML und verlangt GENAU 1 Treffer je Name — eine zweite, stilistisch naheliegende CSS-Regel mit demselben Klassennamen haette diesen Zaehler selbst gerissen. Funktional identisch, keine sichtbare Aenderung.
- **`code`-Feld im Nutzlast-Objekt bleibt** (nicht in Task 3s explizit aufgezaehlter „faellt weg"- oder „bleibt"-Liste erwaehnt) — unbenutzt, aber nicht Teil des ausdruecklich benannten Streichungsumfangs; belassen statt zusaetzlich entfernt, um nicht ueber den beauftragten Umfang hinauszugehen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] renderDetail() haette nach dem Entfernen von wb-stats/wb-bands/wb-rocks (Task 1) sofort geworfen**
- **Found during:** Task 1, beim Umbau der Astro-Mitte
- **Issue:** Der Plan weist Task 1 an, die drei Kaesten (Physik, Qualitaetsstufen, Steine) aus dem Astro-Koerper zu entfernen, laesst aber laut Aufgabenteilung das Client-Skript dafuer erst in Task 3 an. Ungeschuetzt haette `$('wb-stats').innerHTML = …` (und die beiden Folgezeilen) beim ersten `renderAll()` — also schon beim Seitenaufruf — eine `TypeError` geworfen und den gesamten Rest von `renderDetail()` (Fundorte, Stationen, Verweise, Fracturing-Link) mitgerissen.
- **Fix:** Die drei Bloecke in Task 1 mit `if (element) {...}`-Waechtern versehen (dokumentiert im Code als befristete Maßnahme), in Task 3 dann vollstaendig entfernt statt weiter geschuetzt — kein Zwischenzustand blieb im finalen Stand.
- **Files modified:** assets/mining-workbench.js
- **Verification:** Browser-Kontrolle nach Task 1 (agent-browser) zeigte Fundorte/Stationen/Verweise korrekt gezeichnet; Task 3 baute + lief gruen ohne die geschuetzten Bloecke.
- **Committed in:** 772efc4 (Guards, Task 1), 27ff406 (vollstaendige Entfernung, Task 3)

**2. [Rule 3 - Blocking] MockElement kannte weder `closest()` noch `classList.toggle()` noch `focus()`/`select()`**
- **Found during:** Task 2, beim ersten Testlauf gegen das echte Skript
- **Issue:** `tests/e2e/helpers/dom-mock.js` (wiederverwendet, nicht veraendert) stellt keine dieser vier Methoden bereit; `assets/mining-workbench.js` ruft alle vier auf (closest fuer die Klick-Delegation, classList.toggle fuer den Anheft-Zustand, focus/select in preMode()). Ohne sie brach jeder Testfall, der einen Klick simulierte, mit einer `TypeError`.
- **Fix:** `closest()` neu geschrieben (Klasse/Attribut-Anwesenheit, siehe Kopfkommentar in mining-dom.js), `focus`/`select` als No-ops auf `MockElement.prototype` ergaenzt, `classList.toggle()` pro erzeugtem Element gepatcht (classList ist ein Instanz-Objekt, kein Prototyp-Feld).
- **Files modified:** tests/e2e/helpers/mining-dom.js
- **Verification:** `node --test tests/e2e/mining-shortlist.test.js` — 10/10 gruen nach dem Patch.
- **Committed in:** 3141e7a

---

**Total deviations:** 2 auto-fixed (1 Bug, 1 Blocking)
**Impact on plan:** Beide notwendig, um den Plan wie geschrieben lauffaehig auszufuehren; keine Erweiterung des beauftragten Umfangs.

## Negativkontrollen (CLAUDE.md, Grundsatz 1 — „vorgefuehrt rot")

Drei Gegenproben durchgefuehrt, jede protokolliert und danach exakt zurueckgesetzt (`git diff` leer geprueft):

1. **Fundort-Nadel-Knopf entfernt** (`row2()`-Aufruf fuer Fundorte testweise ohne `pinKey`, in `assets/mining-workbench.js`): `node --test tests/e2e/mining-shortlist.test.js` fiel von 10/10 auf **5/10 gruen** — die vier direkt betroffenen Faelle rissen mit `erwartet mindestens einen Nadelknopf in #wb-locs` bzw. Folgefehlern (Knopf nicht mehr auffindbar), ein fuenfter indirekt (Preset-Wiederherstellung baute auf dem Knopf auf). Zurueckgesetzt, danach wieder 10/10.
2. **Sprachparitaet gerissen** (Schluessel `chance` testweise nur aus `S_EN` entfernt, in `src/components/MiningWorkbench.astro`): `npm run build` brach mit Exit-Code 1 und der Meldung `MiningWorkbench: Sprachschluessel von DE und EN weichen ab. Fehlt in EN: chance; fehlt in DE: —` — genau die Zusicherung, die `assertMiningLangParity()` verspricht. Zurueckgesetzt, Build danach wieder gruen.
3. **Wachposten gegen „|"** (in einer Kopie von `assets/mining-db.json` einen Fundortnamen testweise mit `|evil` versehen, Original vorher gesichert): `node scripts/verify-mining.mjs` brach mit Exit-Code 1 und u. a. der Meldung `Fundort "Pyro Belt (Warm 1)|evil" enthaelt "|" — wuerde den Paar-Schluessel "<Erz>||<Fundort>" der Fundort-Merkliste mehrdeutig machen`. Original aus der Sicherungskopie wiederhergestellt, `verify:mining` danach wieder gruen (82 Namen geprueft).

## Issues Encountered

- **Cross-Realm-Vergleich in Task 2:** `assert.deepStrictEqual` scheiterte einmal an zwei inhaltlich identischen Arrays, weil eines davon im `node:vm`-Sandkasten entstanden war (anderer `Array.prototype`, andere Realm). Geloest mit `Array.from(...)` vor dem Vergleich (baut das Array im Realm der Testdatei neu) — kein Verhaltensfehler im Produktionscode, reine Test-Infrastruktur-Falle.
- **dom-mock.js bildet Text als eigenes `#TEXT`-Kindelement ab:** eine erste Fassung des T-09-01-Escaping-Tests nahm faelschlich an, ein Textknoten habe `children.length === 0`; korrigiert auf „alle Kinder sind `#TEXT`", die eigentliche Injektionspruefung (kein `<danger>`-Element, voller Text erhalten) blieb unveraendert scharf.
- **Automatisierter Struktur-Check in Task 1 zaehlte zunaechst 2 statt 1** fuer `wb__pane--mid`, `wb__tabs` und `wb-loc-pane`: Ursache waren (a) eigene Stil-Kommentare, die den geloeschten bzw. neuen Klassennamen ein zweites Mal im ausgelieferten `<style is:inline>`-Block nannten, und (b) bei `wb-loc-pane` das legitime `aria-controls="wb-loc-pane"` am zugehoerigen Tab-Knopf. (a) durch umformulierte Kommentare behoben; (b) ist eine ECHTE, gewollte ARIA-Querverweisung (kein Leck) — gegengeprueft mit einer praeziseren, auf `id="wb-loc-pane"` bzw. `aria-controls="wb-loc-pane"` getrennten Zaehlung (je genau 1 Treffer je Sprachseite).

## Known Stubs

Keine — alle in diesem Plan gebauten Oberflaechen sind an echte Daten angebunden.

## Threat Flags

Keine neuen ueber das im Plan bereits erfasste `<threat_model>` hinaus. Die dort vorgesehenen Mitigationen (T-09-01 esc()+Katalogfilter, T-09-02 Spalte an bestehender Tabelle mit bestehenden RLS-Politiken, T-09-03 Laengenklausel) sind wie geplant umgesetzt und fuer T-09-01 in Task 2 als eigener Testfall belegt.

## User Setup Required

**Datenbank-Migration muss der Betreiber von Hand anwenden.** Datei: `supabase/migrations/20260815090000_mining_preset_locations.sql`, Ziel-Projekt `trgjhmbnodoarnfmlcqx`. Bis dahin laeuft die Oberflaeche unveraendert weiter (ein Preset ohne die Spalte liefert eine leere Fundort-Merkliste, keinen Fehler) — Task 2 beweist genau das maschinell. Kein weiterer Schritt noetig.

## Next Phase Readiness

- 09-02 kann direkt auf der Reiterleiste, `S.locPins`, `renderLocPins()` und dem Preset-Rundlauf aufbauen; alle dafuer noetigen Anker (`#wb-loc-pane`, `#wb-locpins`, `data-locpin`, `data-tab`) stehen.
- Erst NACH Anwenden der Migration traegt ein gespeichertes Preset tatsaechlich Fundort-Paare in der echten Datenbank — bis dahin bleibt die Fundort-Haelfte des Presets serverseitig wirkungslos (aber ungefaehrlich), lokal (`localStorage`) funktioniert das Anheften bereits vollstaendig.
- Kein Blocker fuer 09-02: der Arbeitsbaum ist in einem funktionsfaehigen, durchgehend gruenen Zustand (Build + Gate, auch mit STAGING=1).

---
*Phase: 09-mining-werkbank-fundort-merkliste*
*Completed: 2026-08-15*

## Self-Check: PASSED

Alle sieben Artefaktdateien (Migration, Astro-Koerper, Client-Skript, Test-Helfer, Testdatei, Wachposten-Skript, dieses Summary) auf der Platte gefunden; alle drei Task-Commits (`772efc4`, `3141e7a`, `27ff406`) im Log gefunden.
