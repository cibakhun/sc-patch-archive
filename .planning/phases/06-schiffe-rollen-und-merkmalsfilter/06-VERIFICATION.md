---
phase: 06-schiffe-rollen-und-merkmalsfilter
verified: 2026-08-02T00:00:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 6: Schiffe — Rollen- und Merkmalsfilter Verification Report

**Phase Goal:** Wer auf der Schiffsübersicht ein Schiff für einen bestimmten Zweck sucht,
findet es über Filter, die die Fachsprache des Spiels sprechen — nicht über acht Grobtypen.
Die Filterwerte stammen aus den Spieldateien (DataCore), nicht aus geratenen Kategorien, und
lassen sich kombinieren, sodass auch Nischen wie „Frachter mit abgesenkter Signatur" (Prowler
Utility) auffindbar werden.

**Verified:** 2026-08-02
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + ROLE-01..10)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Jedes Schiff trägt eine spielgenaue Rolle aus dem DataCore; die 4 nicht joinbaren ATLS-Einträge sind benannt statt stillschweigend leer | ✓ VERIFIED | `src/data/vehicle-roles.json.unmatched` listet exakt die 4 ATLS-ids; die 4 Karten in `dist/schiffe.html`/`dist/de/schiffe.html` zeigen den Chip „Industrial"/„Industrie" (via `vRole()`→`fociDe`-Rückfall, D-11), nie einen leeren Chip |
| 2 | Die Filter finden die vom Nutzer genannten Beispielfälle (Tarnkappenbomber, Frachter mit gesenkter Signatur, Bergung, Bergbau, Betankung) | ✓ VERIFIED | Von der Auftraggeberin bereits im Browser bestätigt (7 Chips, Treffer 1/1/5/6/3); durch `npm run verify:vehicle-roles` Abschnitt I/J erneut bestätigt |
| 3 | Merkmale sind belegt, nicht behauptet — jedes Merkmal nennt seine Quelle | ✓ VERIFIED | `vehicle-roles.json.sources` führt alle 5 Achsen (career/role/sig/feat) mit DataCore-Feldpfad; `verify-vehicle-roles.mjs` Abschnitt L prüft die Belegpflicht (0 fehlend) |
| 4 | DE und EN tragen dieselben Filter mit CIG-eigenen Übersetzungen; Lücken sind gefüllt, nicht englisch durchgereicht | ✓ VERIFIED (mit Einschränkung, siehe unten) | Beide Seiten: identische 9 `sf-*`-IDs; alle 17 `ROLE_DE_GAPFILL`-Begriffe im DE-Build gefunden; kein EN-Chip auf der DE-Seite außer 3 Fällen, in denen CIGs eigene DE-Lokalisierung wörtlich mit der EN-Fassung übereinstimmt (siehe Anti-Patterns) |
| 5 | Seite bleibt ohne JavaScript lesbar; Filterung läuft clientseitig ohne spürbare Verzögerung über alle 227 Karten | ✓ VERIFIED | Beide Builds: 227 `<article class="fcard">`, 0× `display:none`, 0× `hidden`-Attribut serverseitig; `apply()` liest nur `data-*`-Attribute, kein `offsetWidth`/`getBoundingClientRect` |
| 6 (ROLE-01) | Beruf UND Rolle aus dem DataCore, Nicht-Treffer benannt | ✓ VERIFIED | s. Zeile 1 |
| 7 (ROLE-02) | Alle Filterwerte + DE/EN-Beschriftung stammen aus Game2.dcb/global.ini, keine Ableitung aus Wiki-Foci/Beschreibung | ✓ VERIFIED | `apply()` liest ausschließlich `data-career`, `data-rolefam`, `data-sig`, `data-feat` — keiner davon aus `vFoci`/`typeDe`; `data-type` (Wiki-Feld) bleibt im Markup, wird aber von keinem Filter mehr gelesen |
| 8 (ROLE-03) | Verbundrollen zählen für jede enthaltene Rolle | ✓ VERIFIED | `verify:vehicle-roles` Abschnitt H: alle 8 Verbundrollen mit ≥1 Fahrzeug in ≥2 Familien; `starterlightfreight` (5 Schiffe) trägt sowohl `einsteiger` als auch `frachttransport` |
| 9 (ROLE-04) | Rollenfilter arbeitet auf Familienebene, Karte nennt exakte CIG-Rolle | ✓ VERIFIED | Genau EIN Rollenfilter (`sf-rolefam`, Label „Rolle"/„Role", 18 Familien) in beiden Builds; `sf-role` (exakte Ebene, aus Plan 01) wurde in Plan 03 nach Sichtprüfung entfernt; Karte zeigt weiterhin `vRoleCig()` (exakte Rolle) |
| 10 (ROLE-05) | Signaturfilter findet 16 Katalogschiffe (11 unter 0,80), CIG-eigene Beschriftung auf der Karte | ✓ VERIFIED | `verify:vehicle-roles` Abschnitt I: „sig-Objekt: 16, davon unter 0,80: 11"; Karten zeigen `IR-Signatur`/`EM-Signatur`/`RQ-Signatur` (aus `hud_scanning_info_*`), locale-formatiert (Komma auf DE) |
| 11 (ROLE-06) | Schnellzugriffe setzen Rolle+Signatur in einem Klick, finden die 5 Beispielfälle | ✓ VERIFIED | 7 Chips in beiden Builds; erste beiden setzen `data-set-rolefam` UND `data-set-sig` gleichzeitig |
| 12 (ROLE-07) | Rollen ohne deutsche CIG-Fassung selbst übersetzt; keine Rolle englisch auf der DE-Seite | ✓ VERIFIED (mit Einschränkung) | Alle 17 Gapfill-Begriffe im DE-Build vorhanden; siehe Anti-Patterns für 3 Grenzfälle, in denen CIGs eigene(!) DE-Lokalisierung wörtlich „Touring"/„Bomber"/„Expedition" liefert |
| 13 (ROLE-08) | EIN Körper, kein zweiter Stil-/Skriptblock | ✓ VERIFIED | `src/pages/schiffe.astro` (17 Zeilen) und `src/pages/de/schiffe.astro` (17 Zeilen) sind reine Hüllen; beide importieren `ShipsOverview.astro` als einzigen Körper |
| 14 (ROLE-09) | Ohne JS lesbar, Filterung ohne spürbare Verzögerung | ✓ VERIFIED | s. Zeile 5 |
| 15 (ROLE-10) | Wiederholbarer Prüfschritt belegt Join-Rate, schlägt bei Unterschreitung fehl | ✓ VERIFIED | `npm run verify:vehicle-roles` läuft grün (Exit 0, 223/227); Tamper-Test (ein Fahrzeugsatz aus `vehicle-roles.json` entfernt) → Exit 1 mit 5 benannten Fehlschlägen (Join-Rate, Familienstand, Merkmalszahl); Datei danach per `git checkout --` zurückgesetzt, `git status` bestätigt sauberen Baum |

**Score:** 10/10 Requirements (ROLE-01..10) verifiziert, 0 behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/datamine-vehicle-roles.mjs` | DataCore-Extraktor, DE+EN | ✓ VERIFIED | vorhanden, liest `global.ini` unter `german_(germany)` UND `en`, normalisiert Career/Role, erzeugt Familien/Signatur/Merkmale |
| `scripts/verify-vehicle-roles.mjs` | Prüfschritt gegen committete Snapshots | ✓ VERIFIED | 12 Prüfabschnitte (A–L), kein Archivzugriff, Exit-Code-Verhalten live geprüft (s. o.) |
| `src/data/vehicle-roles.json` | committete Momentaufnahme, 223/227 gejoint | ✓ VERIFIED | `count: 223`, `unmatched` = 4 ATLS-ids, `sources`-Kopffeld über 5 Achsen |
| `src/components/ships/ShipsOverview.astro` | EIN Körper für DE+EN | ✓ VERIFIED | Import in beiden Hüllen, 9 Filterachsen (`sf-q`,`sf-maker`,`sf-career`,`sf-rolefam`,`sf-sig`,`sf-feat`,`sf-status`,`sf-archive`,`sf-sort`), 7 Schnellzugriff-Chips, kein `set:html` mehr |
| `src/i18n/vehicleText.ts` | `vRoleCig`, `vCareer`, `vRoleFamilies`, `vSignature`, `ROLE_DE_GAPFILL` (17), `FAMILY_LABELS` (18) | ✓ VERIFIED | alle Funktionen vorhanden und in `ShipsOverview.astro` importiert/genutzt |
| `src/pages/schiffe.astro` / `src/pages/de/schiffe.astro` | Hüllen ≤ ~24 Zeilen | ✓ VERIFIED | je 17 Zeilen, nur Layout-Import + `<Body />` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ShipsOverview.astro` (Karte) | `src/i18n/vehicleText.ts` (`vRoleCig`) | Kartenbeschriftung | ✓ WIRED | jede Karte rendert `vRoleCig(id, d, lang)` als Chip |
| `ShipsOverview.astro` (Filter) | `src/data/vehicle-roles.json` | `data-career`/`data-rolefam`/`data-sig`/`data-feat` | ✓ WIRED | Werte werden serverseitig aus `roleSnapshot`/`vRoleFamilies`/`vSignature` gejoint, nicht aus Wiki-Feldern |
| Schnellzugriff-Chip | Filterkonsole | Klick setzt `sf-rolefam`+`sf-sig`, ruft `apply()` | ✓ WIRED | im Inline-Skript nachvollzogen, Chip-Zieleauszählung stimmt mit `vehicle-roles.json` überein |
| `npm run verify:vehicle-roles` | `src/data/vehicle-roles.json` | Konsistenzprüfung | ✓ WIRED | Guard bricht bei Manipulation mit Exit 1 ab (live getestet, s. o.) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Join-Rate-Guard schlägt bei Manipulation fehl | Fahrzeugsatz aus `vehicle-roles.json` entfernt, `npm run verify:vehicle-roles` erneut ausgeführt | Exit 1, 5 benannte Fehlschläge (Join-Rate 222<223, Familienstand, Merkmal); Datei danach zurückgesetzt | ✓ PASS |
| `npm run theme` erzeugt keine Abweichung am generierten Hell-Block von `ShipsOverview.astro` | `npm run theme` repo-weit ausgeführt, `git diff --stat` auf die Datei geprüft | 84 phasenfremde Dateien geändert (Alt-Drift, bereits in beiden SUMMARYs dokumentiert), `ShipsOverview.astro` selbst zeigt **keinen** Diff — der committete `:root[data-theme="light"]`-Block ist bereits das generierte Ergebnis; alle 85 Dateien danach per `git checkout --` zurückgesetzt | ✓ PASS |
| Kein ATLS-Chip ist leer | `dist/schiffe.html`+`dist/de/schiffe.html`, Regex auf `data-q="atls`-Karten | Alle 4×2 Karten zeigen „Industrial"/„Industrie" als Chip | ✓ PASS |
| Keine Datenherkunfts-Begriffe im sichtbaren HTML | Grep auf `Data.p4k`, `DataCore`, `datamin`, `scmdb`, `Game2.dcb` in beiden Builds | 0 Treffer in beiden Sprachen | ✓ PASS |
| Ohne JS bleiben alle 227 Karten sichtbar | Grep auf `display:\s*none`/`hidden`-Attribut an `<article>` in beiden Builds | 227 Karten, 0 versteckt | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|------------|--------|----------|
| ROLE-01 | 06-01 | ✓ SATISFIED | ATLS benannt statt leer (s. o.) |
| ROLE-02 | 06-01/02/03 | ✓ SATISFIED | alle Filterachsen aus DataCore; `data-type` (Wiki) tot |
| ROLE-03 | 06-02 | ✓ SATISFIED | 8 Verbundrollen in ≥2 Familien |
| ROLE-04 | 06-01 (offen gelassen) → 06-03 (abgeschlossen) | ✓ SATISFIED | genau EIN Rollenfilter auf Familienebene, exakte Rolle auf der Karte |
| ROLE-05 | 06-02 | ✓ SATISFIED | 16/11 Signaturwerte, CIG-HUD-Beschriftung |
| ROLE-06 | 06-03 | ✓ SATISFIED | 7 Chips, 5 Beispielfälle bestätigt |
| ROLE-07 | 06-02 | ✓ SATISFIED (Grenzfälle dokumentiert) | 17/17 Gapfill-Begriffe vorhanden; 3 CIG-eigene DE=EN-Werte außerhalb des Gapfill-Scopes (s. Anti-Patterns) |
| ROLE-08 | 06-01 | ✓ SATISFIED | EIN Körper, Hüllen 17 Zeilen |
| ROLE-09 | 06-01/03 | ✓ SATISFIED | 227 Karten ohne JS sichtbar |
| ROLE-10 | 06-01/02 | ✓ SATISFIED | Guard live gegen Manipulation getestet, Exit 1 |

REQUIREMENTS.md führt ROLE-01..10 korrekt als „Complete" (Checkbox `[x]` + Traceability-Tabelle); die dokumentierte Zwischenkorrektur (ROLE-04 in Plan 01 zunächst bewusst auf „Pending" belassen, weil nur die exakte Rollenebene lieferte, nicht die Familienebene) ist nachvollziehbar und wurde in Plan 02/03 tatsächlich geschlossen — keine Diskrepanz zwischen Buchführung und Realität.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/data/vehicle-roles.json` (Datenquelle) | — | 3 Fahrzeuge (`orig-85x` „Touring", plus je 1× „Bomber"/„Expedition"-Fälle) tragen `roleDe === roleEn`, weil **CIGs eigene** deutsche Lokalisierung das englische Wort unverändert übernimmt | ℹ️ Info | Betrifft NICHT den ROLE-07-Gapfill-Mechanismus (der greift nur, wenn `roleDe` fehlt — hier ist es vorhanden, nur identisch mit EN). Für einen deutschsprachigen Besucher liest sich der Chip „Touring" dennoch wie unübersetztes Englisch. Da die Daten wörtlich aus CIGs global.ini stammen (D-01-konform), ist dies kein Verstoß gegen die Buchstaben von ROLE-07 („wo CIG keine deutsche Fassung liefert…") — CIG liefert hier technisch eine, sie ist bloß ein Lehnwort. Kein Blocker, aber ein Kandidat für eine spätere, bewusste Übersetzungsentscheidung. |
| `.planning/PROJECT.md` | 53 | „Neue Datenquellen oder Datamine-Ausbau" steht weiterhin unter *Out of Scope*, obwohl `06-CONTEXT.md` (canonical_refs) ausdrücklich vermerkt, dass diese Phase genau das auf Nutzerwunsch durchbricht und PROJECT.md „entsprechend nachzuziehen" sei | ℹ️ Info | Reine Projektbuchführung, keine der ROADMAP-Erfolgskriterien oder ROLE-01..10 hängt davon ab. Nicht Teil dieser Phase's must-haves, aber ein offener Nachtrag. |

Keine `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`-Marker in den durch diese Phase angefassten Dateien (`scripts/datamine-vehicle-roles.mjs`, `scripts/verify-vehicle-roles.mjs`, `src/components/ships/ShipsOverview.astro`, `src/i18n/vehicleText.ts`, beide `schiffe.astro`-Hüllen).

### Human Verification Required

Keine offenen Punkte. Alle in den SUMMARYs als „human_judgment: true" markierten Punkte (Sichtprüfung Familienfilter-Klickverhalten, `fcard__sig`-Lesbarkeit, Konsolen-Optik nach der Chip-Ergänzung) wurden laut Plan-03-SUMMARY bereits im Checkpoint (Task 2) durch die Auftraggeberin am gebauten `dist/` selbst durchgeführt — inklusive einem echten Befund (doppelter Rollenfilter), der korrigiert und erneut geprüft wurde. Die Koordinatorin hat zusätzlich unmittelbar vor dieser Verifikation dieselben fünf Abnahmefälle sowie die Kontrollenzahl (9 Bedienelemente) im gebauten `dist/` bestätigt.

### Gaps Summary

Keine Gaps. Alle 10 Requirements (ROLE-01 bis ROLE-10) sowie alle 5 ROADMAP-Erfolgskriterien sind gegen den gebauten `dist/`-Output nachgewiesen, inklusive eines live durchgeführten Negativtests für den Prüfschritt (ROLE-10) und einer Provenienzprüfung des sichtbaren HTML (Datenherkunft-Projektregel). Zwei informative Nebenbefunde (CIG-eigene „Touring"-Lokalisierung, veraltete PROJECT.md-Out-of-Scope-Zeile) sind dokumentiert, blockieren aber nicht die Zielerreichung dieser Phase.

---

_Verified: 2026-08-02_
_Verifier: Claude (gsd-verifier)_
