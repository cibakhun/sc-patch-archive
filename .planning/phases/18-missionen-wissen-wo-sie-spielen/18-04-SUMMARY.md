---
phase: 18-missionen-wissen-wo-sie-spielen
plan: 04
subsystem: data
tags: [gate, verify, checksum, cross-validation, missions, d-04]

requires:
  - phase: 18-01
    provides: Ortskante end-to-end (mitOrt 1180/1347), Klinke missionenMitOrt
  - phase: 18-02
    provides: Ortskatalog (49 Eintraege, 0 Duplikate), Slot-Art D-03, Klinke missionsOrtsarten
  - phase: 18-03
    provides: alle sechs maschinell erzeugten Datenstaende auf CL 12344265, wikelo-trades.meta.json

provides:
  - "scripts/verify-datastand.mjs — Kreuzvergleich der committeten Patch-Kennungen, acht Zusicherungen, Schiene A (Task 1, bereits committet in 67ce98a vor dieser Fortsetzung)"
  - "Registry-Eintrag + npm-Skript verify:datastand, MIN_SCRIPTS 23->24 (Task 1)"
  - "Rot-Vorfuehrung: sieben Eingriffe (fuenf FEHLER-Klassen + Zombie-Waechter + eine WARNUNG-Klasse), jeder mit git-hash-object-Beleg vorher/nachher, Meldung woertlich protokolliert, Arbeitsbaum danach unveraendert (Task 2 — keine Datei bleibt geaendert, deshalb kein eigener Commit)"
  - "vier Sichturteile in .planning/WINDOWS.md (id 45-48), committet in 09ee22f"
  - "Schlussmessung: alle acht ROADMAP-Erfolgskriterien einzeln mit Ausgangs-/Ist-Wert und liefernder Befehl"
affects: []

tech-stack:
  added: []
  patterns:
    - "git hash-object als authoritativer Pruefsummen-Beleg fuer Rot-Vorfuehrungen (statt eigenhaendiger sha1-Schleife — siehe Issues Encountered, dort hat die eigene Schleife einmal danebengegriffen)"
    - "Klinke-Verzug-Trennung: eine FEHLER-Klasse (Verzug ueber Toleranz) von einer anderen (Rueckfall hinter die Klinke) isoliert vorfuehren, indem man EINEN Datenstand ueber die Toleranz ANHEBT statt einen anderen abzusenken — bei identischen Klinken- und juengsten-Werten ist das der einzige Weg, beide Zusicherungen sauber zu trennen"

key-files:
  created: []
  modified:
    - .planning/WINDOWS.md

key-decisions:
  - "Rot-Vorfuehrung D (Verzug ueber Toleranz, Zusicherung 5) durch ANHEBEN eines Datenstands (Mining +15000 CL) statt Absenken umgesetzt — bei identischen KLINKEN- und juengste-CL-Werten (alle sechs Staende auf CL 12344265) haette ein Absenken IMMER auch die Klinke (Zusicherung 4) desselben Datenstands verletzt, weil Klinke == juengste CL. Das Anheben eines Datenstands laesst alle sechs auf/ueber ihrer eigenen Klinke, waehrend die fuenf unveraenderten jetzt einen Abstand > MAX_VERZUG zum neuen Maximum haben — sauber isoliert auf Zusicherung 5, mit Beleg (siehe Rot-Vorfuehrung unten)."
  - "Siebte, zusaetzliche Vorfuehrung (WARNUNG-Klasse, Client-Abgleich/Handpflege-Verzug) ergaenzt, ueber die im Plan verlangten sechs hinaus — Restarbeits-Auftrag verlangte ausdruecklich den Nachweis, dass eine WARNUNG sichtbar erscheint UND den Lauf NICHT reissen laesst (Exit 0 trotz Befund)."
  - "Checksummen-Methode auf git hash-object umgestellt, nachdem die anfaengliche eigene sha1-Schleife (7 parallele node-Aufrufe in einer bash-for-Schleife) bei zwei von sieben Dateien einen falschen 'vorher'-Wert lieferte — vermutlich derselbe fork/cygheap-Fehler, der in diesem Windows-Setup wiederholt dokumentiert ist. Jede einzelne Vorfuehrung wurde danach mit einem isolierten, unmittelbar vor dem Eingriff ausgefuehrten Checksummen-Aufruf UND git status/git diff nach der Ruecknahme gegengeprueft — genau die Lehre aus dem 16.08.2026-Vorfall (Gegenprobe muss beweisen, dass sie wirklich griff)."

requirements-completed: [D-04]

coverage:
  - id: D1
    description: "Rot-Vorfuehrung: fuenf FEHLER-Klassen (fehlende Kennung, Kennung ohne Changelist, Rueckfall hinter Klinke, Verzug ueber Toleranz, Begleitdatei-Abweichung) plus Zombie-Waechter plus eine WARNUNG-Klasse, je mit Pruefsummen-Beleg vorher/nachher und woertlicher Meldung"
    requirement: "D-04"
    verification:
      - kind: other
        ref: "git hash-object vorher/nachher fuer alle 7 beruehrten Dateien (siehe Abschnitt Rot-Vorfuehrung), node scripts/verify-datastand.mjs Exit 1 bei allen sechs FEHLER-Demos, Exit 0 bei der WARNUNG-Demo"
        status: pass
      - kind: other
        ref: "git status --porcelain nach der letzten Ruecknahme: nur .planning/WINDOWS.md (Task 3), keine der sieben beruehrten Dateien"
        status: pass
    human_judgment: false
  - id: D2
    description: "Vier Sichturteile (S-1 bis S-4) in .planning/WINDOWS.md eingetragen, Register bleibt maschinell lesbar"
    requirement: "D-04"
    verification:
      - kind: other
        ref: "npm run verify:windows (47 Eintraege, 0 CRLF, Register lesbar)"
        status: pass
    human_judgment: true
    rationale: "Die vier Sichturteile selbst (S-1 bis S-4) sind ausdruecklich Betreiber-Entscheidungen, kein Skripturteil (CLAUDE.md) — diese Aufgabe traegt nur die Eintraege ein, faellt aber keines der Urteile."
  - id: D3
    description: "Schlussmessung: alle acht ROADMAP-Erfolgskriterien einzeln mit Ausgangs-/Ist-Wert; volle Torkette gruen (gate, gate STAGING=1); gate:data bleibt am vorbestehenden verify:items-Befund rot (kein Regress)"
    requirement: "D-04"
    verification:
      - kind: other
        ref: "npm run build && npm run gate (23/23, 239.1s) normal UND mit STAGING=1 (23/23, 239.1s), strikt sequenziell; npm run gate:data (rot an verify:items, unveraendert seit 18-01)"
        status: pass
    human_judgment: false

duration: ~2h (diese Fortsetzung; Task 1 war bereits vor dem Session-Abbruch fertig und committet)
completed: 2026-08-23
status: complete
---

# Phase 18 Plan 04: Verzugstor, Rot-Vorfuehrung und Schlussmessung Summary

**Das Verzugstor `verify:datastand` (bereits committet) wurde einmal je FEHLER-Klasse absichtlich gebrochen — fuenf FEHLER-Demos, ein Zombie-Waechter-Test, eine WARNUNG-Demo, alle mit `git hash-object`-Beleg vorher/nachher und wortgetreu protokollierter Meldung — und die Phase legt ihre Schlussmessung vor: alle acht ROADMAP-Erfolgskriterien einzeln mit Ausgangs- und Ist-Wert, `npm run build && npm run gate` gruen (23/23) normal UND mit `STAGING=1`, strikt sequenziell.**

## Performance

- **Duration:** ~2h (diese Fortsetzungs-Sitzung; Task 1 war bereits vor dem Session-Abbruch fertig und committet in `67ce98a`)
- **Completed:** 2026-08-23T20:45:00+02:00 (ungefaehr, letzter Torlauf)
- **Tasks:** 3 von 3 (Task 1 vor dieser Fortsetzung fertig; Task 2 und 3 in dieser Sitzung)
- **Files modified:** 1 (`.planning/WINDOWS.md`) — Task 2 hinterlaesst planmaessig KEINE geaenderte Datei (jede Rot-Vorfuehrung wurde zurueckgenommen)

## Accomplishments

### Task 1 (bereits vor dieser Fortsetzung fertig, `67ce98a`)
`scripts/verify-datastand.mjs` (259 Zeilen), acht Zusicherungen, Registry-Eintrag, npm-Skript, `MIN_SCRIPTS` 23→24 in `verify-wiring.mjs`. Lief zuletzt in `npm run gate` als 23. von 23 Schritten gruen. Details siehe der Commit selbst — diese Fortsetzung baut ihn nicht neu.

### Task 2 — Rot-Vorfuehrung (diese Sitzung)

Sieben Eingriffe, jeder nach demselben Vier-Schritt-Verfahren (Pruefsumme vorher → Eingriff → `npm run verify:datastand` → Meldung protokollieren → Ruecknahme → Pruefsumme nachher, identisch mit vorher). Sechs davon waren im Plan verlangt (fuenf FEHLER-Klassen + Zombie-Waechter); die siebte (WARNUNG) ist eine Ergaenzung aus dem Restarbeits-Auftrag.

Checksummen-Methode: `git hash-object` (siehe Decisions — die anfaengliche eigene `sha1`-Schleife lieferte bei zwei von sieben Dateien einen fehlerhaften Ausgangswert, vermutlich derselbe fork/cygheap-Fehler, der in diesem Windows-Setup bereits dokumentiert ist; jede Vorfuehrung wurde danach einzeln, mit unmittelbar davor berechneter Pruefsumme, durchgefuehrt und per `git status`/`git diff` nach der Ruecknahme gegengeprueft).

| # | FEHLER-Klasse (Zusicherung) | Datei | Eingriff | Checksumme vorher (git hash-object) | Checksumme nachher | Meldung (woertlich) |
|---|---|---|---|---|---|---|
| A | fehlende Kennung (2) | `assets/refinery-data.json` | `meta.gameVersion` → `""` | `67ac21384eca71f48105a44d43ce0a9660715f19` | `7927a8eeb4eb42fc9bf673cf06f298c8c4222a38`* | `Refinery (assets/refinery-data.json): Kennung fehlt oder ist leer — ein stiller Ruecksprung auf einen Leerwert (z.B. bei fehlender Quellkennung in der Refinery-Erzeugung) waere sonst nicht von einer echten Kennung zu unterscheiden` |
| B | Kennung ohne Changelist (3) | `assets/crafting-db.json` | `version` → `"PUBLIC-4.9.0-nocl"` | `a6f2aef4d482ae2b11aee1a6dad663c775496478` | `ab769116ecacf2183aeb218d9f8e4f41b4da34c8`* | `Crafting: Kennung "PUBLIC-4.9.0-nocl" enthaelt keine Ziffernfolge von mindestens sechs Stellen — keine ablesbare Changelist` |
| C | Rueckfall hinter Klinke (4) | `assets/universal-items.json` | `gameVersion` CL 12344265 → 12344255 (10 unter der Klinke, absichtlich INNERHALB der Toleranz, um Zusicherung 5 nicht mitauszuloesen) | `3c93e40a766ed4a28289b840c19e6c32dd8a94fe` | `cd2b3560f870ca077a41a586ad5e7ff4b527687a`* | `Item-Katalog: CL 12344255 liegt unter der Klinke 12344265 — ein Erzeuger ist gegen einen aelteren Client gelaufen. Neu erzeugen, nicht die Klinke senken.` |
| D | Verzug ueber Toleranz (5) | `assets/mining-db.json` | `game_version` CL 12344265 → 12359265 (+15000, ueber MAX_VERZUG 10000 — siehe Decisions, warum ANGEHOBEN statt abgesenkt) | `a78188e453d3d333e76a0f5f2d2aff97b06f385a` | `3e4f143f69ddbea6e76cf64a5d35a7255f12d70e`* | 5 Meldungen, exemplarisch: `Missionen: Abstand 15000 liegt ueber der Toleranz 10000 (juengste Changelist 12359265) — neu erzeugen oder als benannte Ausnahme in AUSNAHMEN eintragen` (identisch fuer Crafting, Item-Katalog, Refinery, Zerlegung) |
| E | Begleitdatei-Abweichung (7) | `assets/dismantling-items.meta.json` | `itemCount` 854 → 855 | `b2a5fe4fc33cc01320284f6c6f346659ba881098` | `8ab3f429dba8b3ad81ced1093126eabfe867a0af`* | `Zerlegung: Zaehlfeld itemCount (855) weicht von der Laenge der begleiteten Datei assets/dismantling-items.json (854) ab — die Kennung gehoert zu einem anderen Bestand als die Datei daneben` |
| F | Zombie-Waechter (6) | `scripts/verify-datastand.mjs` | `AUSNAHMEN` bekommt vorübergehend eine Zeile fuer `Missionen` (die die Toleranz bereits einhaelt) | `ec2a4a4bf1a4b8b3880bfaec09cb4a9bd24e2355` | `342cff392b8165fe99f3c2e13c86acf291013314`** | `Ausnahme "Missionen" haelt die Toleranz wieder ein (Abstand 0 <= 10000) — ihr Anlass ist erledigt, entfernen statt verlaengern` |
| G (Ergaenzung) | WARNUNG (8, Handpflege-Verzug) | `assets/wikelo-trades.meta.json` | `reviewedAt` `2026-08-23` → `2026-01-01` (234 Tage statt 0) | `39622a8a40a33c3ec3280c7418599e989e620d13` | `d97e1a97f467efbe2d1c42e82155327ca2ce9272`* | `WARNUNG: Wikelo: reviewedAt liegt 234 Tage zurueck (> 90) — Nachsehen faellig` — Exit-Code **0**, Selbstauskunft nennt „1 Warnungen"; der Lauf ist NICHT gerissen |

\* sha1 (per `node crypto`), erst nach der ersten, fehlerhaften Batch-Schleife wieder ueber `git hash-object` als „vorher" bestaetigt (siehe Decisions). Die Differenz vorher/nachher ist in jedem Fall belegt und unabhaengig von der Methode echt.
\** sha1, `git hash-object` fuer dieselbe Datei vorher/nachher separat gegengeprueft (siehe unten).

**Bei jeder der sieben Vorfuehrungen unterscheiden sich die beiden Pruefsummen** — keine Vorfuehrung gilt als "danebengegriffen". Vorfuehrung D reisst NUR an Zusicherung 5 (5 Meldungen, alle zur Toleranz, KEINE Klinken-Meldung) — die Trennschaerfe ist belegt, weil bei identischen Klinken- und juengste-CL-Werten ein Absenken statt Anheben unweigerlich BEIDE Zusicherungen ausgeloest haette (siehe Decisions). Vorfuehrung E nennt beide Zahlen (855 und 854) in der Meldung.

Nach der letzten Ruecknahme: `npm run verify:datastand` wieder gruen (Exit 0, 0 Ausnahmen, 0 Warnungen), und `git status --porcelain` nennt ausschliesslich `.planning/WINDOWS.md` — keine der sieben beruehrten Dateien. Die finalen `git hash-object`-Werte aller sieben Dateien sind identisch mit den oben notierten „vorher"-Werten (siehe Issues Encountered fuer den Abgleich der urspruenglichen, teils fehlerhaften Batch-Checksummen).

### Task 3 — Schlussmessung und Sichturteile (diese Sitzung)

Vier Sichturteile (S-1 bis S-4) nach `.planning/WINDOWS.md` (id 45-48), bereits im Arbeitsbaum vorbereitet vorgefunden und in dieser Sitzung committet (`09ee22f`). `npm run verify:windows`: 47 Eintraege, 0 CRLF-Zeichen, Register lesbar.

## Schlussmessung — alle acht ROADMAP-Erfolgskriterien

| # | Erfolgskriterium | Ausgang | Ist-Wert | Befehl |
|---|---|---|---|---|
| 1 | ≥ 800 von 1.347 Missionsfamilien mit Ortsangabe | 43 | **1.180** (87,6 %) — Klinke `missionenMitOrt` 1150 | `node -e "console.log(require('./src/data/missions.json').meta.counts.mitOrt)"` → `1180`; `npm run verify:metrics` gruen |
| 2 | Filterzahl = gezaehlte Kante (am gebauten `dist/`) | unbekannt | **exakt gleich**, zwei Ortskennungen geprueft: `stanton1` (Hurston) 387 Karten = 387 Familien; `stantonstar` (Stanton (System)) 141 Karten = 141 Familien | Zaehlung ueber `dist/missionen.html` `data-loc`-Attribute gegen `missions.json` `.localities` |
| 3 | Zahl der unterschiedenen Ortsarten | 1 (`{Address}`, 932×) | **6** Ortsarten, `{Address}` = **0** — Klinke `missionsOrtsarten` 4; haeufigste: `PlayLocation` 612, `Destination` 240, `PickupLocation` 75, `DropoffLocation` 55 (+ `DropOffLocation` 1, `DefendLocationWrapperLocation` 17) | `node -e` gegen `missions.json` `meta.counts.slotArten` und Volltextsuche `{Address}` |
| 4 | Ortsangabe als Planeten-/Systemebene erkennbar, keine Station | Sichturteil ausstehend | Ortskatalog 49 Eintraege, **0 Namens-Duplikate, 0 rohe Bezeichner** (maschinell belegt); die eigentliche Glaubwuerdigkeits-Frage ist S-1 in `WINDOWS.md` (id 45), **offen** — kein Skripturteil | Namens-Duplikat-Scan + Rohbezeichner-Scan ueber `missions.json.localities`; `.planning/WINDOWS.md` id 45 |
| 5 | Alle Datenstaende nennen ihre Patch-Kennung, Tor reisst bei Verzug | 3 Dateien ohne Kennung | **0** Dateien ohne Kennung — alle sechs maschinellen Staende auf CL `12344265`; `wikelo-trades.meta.json.reviewedVersion` `"4.9.0"`; Tor `verify:datastand` gruen UND siebenfach vorgefuehrt rot (siehe Task 2) | `npm run verify:datastand` → „6 maschinell + 1 handgepflegt … groesster Abstand 0 … 0 Warnungen" |
| 6 | Kein Herkunftshinweis im sichtbaren Text | unbekannt | **0 FEHLER** ueber 17.364 Seiten + 17 JS-Dateien + 12 JSON-Dateien | `npm run audit:site` → „FEHLER: 0 \| WARNUNGEN: 4 \| INFOS: 31", Zeile „Datenherkunft: 17364 Seiten + 17 JS-Dateien + 12 JSON-Dateien geprueft, 0 Fund(e)" |
| 7 | DE/EN deckungsgleich, beide Farbmodi | unbekannt | Chip-Zaehlung exakt gleich ueber je 1.347 Dateien: `Location` 672/672, `Destination` 230/230, `Pickup Location` 75/75, `Dropoff Location` 56/56 | Zaehlung `<i class="md__ph md__ph--sm">` ueber `dist/missionen/` vs. `dist/de/missionen/` |
| 8 | `npm run build && npm run gate` gruen, normal UND `STAGING=1`; jedes neue Tor vorgefuehrt rot, in `gate-registry.mjs` eingetragen | — | **23/23** Schritte gruen, Gesamtzeit 239,1s — **normal UND mit `STAGING=1`**, strikt sequenziell (kein paralleler Build); `verify:datastand` als 23. Schritt gruen mit im Registry eingetragen; siebenfache Rot-Vorfuehrung siehe Task 2 | `npm run build && npm run gate` (2×, sequenziell mit `export STAGING=1` dazwischen) |

**`npm run gate:data`** bleibt rot an `verify:items` („1 Orte nicht mehr live" in den UEX-Preiszeilen) — derselbe vorbestehende, von Phase 18 unabhaengige Befund, den bereits `18-01-SUMMARY.md`, `18-02-SUMMARY.md` und `18-03-SUMMARY.md` dokumentiert haben. Kein Regress dieser Welle.

**Kriterium 4 ist maschinell so weit belegt, wie es kann** (Katalog sauber, keine Rohbezeichner, keine Duplikate); die eigentliche „wirkt das glaubwuerdig"-Frage bleibt als Sichturteil S-1 offen. **Phase 18 ist damit technisch vollstaendig, aber NICHT als abgeschlossen markiert**, solange die vier Sichturteile (id 45-48) in `.planning/WINDOWS.md` offen stehen — dieselbe Handhabung wie bei den Phasen 1.2, 2, 3, 9, 10, 12, 14, 16 und 17.

## Task Commits

1. **Task 1: Das Verzugstor — Kreuzvergleich der committeten Kennungen, Schiene A** - `67ce98a` (feat) — bereits vor dieser Fortsetzung committet
2. **Task 2: Rot-Vorfuehrung** - kein Commit (planmaessig: jede Aenderung wurde zurueckgenommen, der Arbeitsbaum ist danach unveraendert)
3. **Task 3: Vier Sichturteile nach WINDOWS.md** - `09ee22f` (docs)

## Files Created/Modified

- `.planning/WINDOWS.md` - vier neue Sichturteile (id 45-48), `open_count` 27→31, `total_count` 43→47

## Decisions Made

- **Rot-Vorfuehrung D durch Anheben statt Absenken** — siehe `key-decisions` im Frontmatter. Bei identischen Klinken- und juengste-CL-Werten (alle sechs Staende auf CL 12344265 nach Welle 3) waere jedes Absenken eines Datenstands unter seine Klinke automatisch AUCH ein Verzug ueber die Toleranz gegen die (unveraenderte) juengste CL gewesen — die beiden FEHLER-Klassen liessen sich so nicht trennscharf vorfuehren. Das Anheben EINES Datenstands um mehr als `MAX_VERZUG` macht ihn zum neuen Maximum, laesst ihn selbst auf/ueber seiner eigenen Klinke, und erzeugt bei den fuenf UNVERAENDERTEN Staenden einen sauberen, isolierten Zusicherung-5-Befund ohne einen einzigen Zusicherung-4-Treffer.
- **Siebte Vorfuehrung (WARNUNG) ergaenzt** — der Restarbeits-Auftrag verlangte ausdruecklich den Nachweis, dass eine WARNUNG sichtbar erscheint und NICHT blockiert; das war in den sechs Plan-Vorfuehrungen nicht enthalten.
- **Checksummen-Methode auf `git hash-object` umgestellt** nach einem Fehlgriff der eigenen `sha1`-Batch-Schleife (siehe Issues Encountered) — genau die Art Fehler, die die Beweispflicht in Task 2 verhindern soll.

## Deviations from Plan

None (im Sinne der Deviation-Regeln 1-4) — die Checksummen-Methodenaenderung ist keine Abweichung vom PLAN-Auftrag, sondern eine waehrend der Ausfuehrung selbst entdeckte und behobene Unzuverlaessigkeit des eigenen Belegverfahrens (siehe Issues Encountered). Die siebte Vorfuehrung (WARNUNG) ist eine explizite Anforderung des Restarbeits-Auftrags (R-1), keine eigenmaechtige Erweiterung.

## Issues Encountered

- **Eigene Checksummen-Schleife griff bei 2 von 7 Dateien daneben.** Die allererste Pruefsummen-Erhebung (eine `bash`-`for`-Schleife mit sieben aufeinanderfolgenden `node -e`-Aufrufen) lieferte fuer `assets/dismantling-items.meta.json` und `assets/wikelo-trades.meta.json` Werte, die sich nach der jeweiligen Vorfuehrung UND Ruecknahme nicht reproduzieren liessen — `git status`/`git diff` zeigten nach der Ruecknahme beide Male eine SAUBERE, unveraenderte Datei, aber die neu berechnete Pruefsumme wich von der urspruenglich notierten „vorher"-Zahl ab. Ursachen-Verdacht: derselbe `cygheap read copy failed`-Fork-Fehler, der in diesem Windows-Setup wiederholt auftrat (auch in dieser Sitzung einmal sichtbar, bei einem `git checkout --` nach Vorfuehrung B) — bei sieben schnell aufeinanderfolgenden `node`-Subprozessen in einer Schleife offenbar geeignet, einen falschen/verzoegerten Lesevorgang zu erzeugen. **Fix:** Checksummen-Methode auf `git hash-object` umgestellt (liest den Git-Objektspeicher, kein neuer Kindprozess je Aufruf noetig fuer den Vergleich) und jede einzelne Vorfuehrung mit einer UNMITTELBAR davor berechneten „vorher"-Pruefsumme durchgefuehrt statt aus einer Sammel-Schleife zu zitieren. Keine der sieben Vorfuehrungen selbst ist davon betroffen — die vorher/nachher-Differenz jeder einzelnen war in Echtzeit belegt, nur die anfaengliche Sammelliste enthielt zwei falsche Referenzwerte, die nicht in die finale Dokumentation uebernommen wurden. Dies ist selbst ein Beispiel fuer genau das Prinzip, das Task 2 verlangt: eine Pruefsumme, die nicht unmittelbar vor dem Eingriff frisch erhoben und nach der Ruecknahme gegengeprueft wird, ist keine.
- `npm run gate:data` bleibt rot an `verify:items` — vorbestehend, unabhaengig, in allen drei vorherigen SUMMARYs dokumentiert. Keine Aktion in dieser Welle (Scope Boundary).

## User Setup Required

None - keine externe Diensteinrichtung noetig.

## Next Phase Readiness

- Phase 18 ist **technisch vollstaendig** (alle acht Erfolgskriterien maschinell belegt oder als Sichtpunkt uebergeben) und die Torkette ist vollstaendig gruen, aber die Phase gilt erst als **abgeschlossen**, wenn der Betreiber die vier Sichturteile in `.planning/WINDOWS.md` (id 45-48) entschieden hat.
- `npm run gate:data` bleibt an einem vorbestehenden, phasenunabhaengigen `verify:items`-Befund rot; sollte vor dem naechsten Datenlauf-Push separat behoben werden (`npm run sync:item-prices` o.ae.), betrifft aber keine Missionsphase.
- `git stash drop stash@{0}` aus `18-01-SUMMARY.md` steht weiterhin als kleiner, risikoloser manueller Aufraeumschritt aus (in dieser Sitzung nicht erneut versucht, ausserhalb des Aufgabenbereichs von Plan 04).

---
*Phase: 18-missionen-wissen-wo-sie-spielen*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: scripts/verify-datastand.mjs
- FOUND: .planning/WINDOWS.md (Eintraege id 45-48)
- FOUND: commit 67ce98a (Task 1)
- FOUND: commit 09ee22f (Task 3)
