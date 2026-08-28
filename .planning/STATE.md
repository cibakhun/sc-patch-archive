---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 14
current_phase_name: das-schiff-ist-die-navigation
status: executing
stopped_at: Completed 18-04-PLAN.md -- Verzugstor vorgefuehrt rot (7 Demos), Schlussmessung aller acht Erfolgskriterien, vier Sichturteile in WINDOWS.md; Phase 18 technisch vollstaendig, Abschluss haengt an offener Sichtrunde
last_updated: "2026-08-28T03:55:17.790Z"
last_activity: 2026-08-17
last_activity_desc: Phase 14 execution started
progress:
  total_phases: 23
  completed_phases: 15
  total_plans: 82
  completed_plans: 71
parked_phase: 1.1
parked_phase_stopped_at: Completed 01.1-02-PLAN.md
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-28)

**Core value:** Spielgenaue Daten, direkt aus den Spieldateien gewonnen — wenn die Zahlen nicht stimmen, ist die Seite wertlos.
**Current focus:** Phase 15 — testpilot-zugang-staging-hinter-der-discord-rolle

**Current focus:** Phase 16 — das-schiff-ist-die-navigation

> **Nachtrag 23.08.2026 (dritter) — Phase 18 Plan 3 von mind. 3 ausgefuehrt
> (D-04: jeder Datenstand nennt seinen Patch).**
> `18-03-PLAN.md` ist ausgefuehrt: `assets/universal-items.json` traegt jetzt
> ein Feld `gameVersion` (`4.9.0-live.12344265`), Schreibweise bytegleich zu
> `assets/mining-db.json` `game_version` (Muster aus `build-mining-db.mjs`
> uebernommen, nicht aus `datamine-missions.mjs`). Zwei bislang kopflose
> Bestaende bekamen eine **Begleitdatei statt Huelle** (RESEARCH.md-Annahme
> A4 bewusst nicht gefolgt — der Client-Fetch in `CraftingApp.astro` haengt
> an einer Abrufkennung, die nur am Crafting-Datenstand haengt, nicht an
> `dismantling-items.json` selbst): `assets/dismantling-items.meta.json`
> (maschinell, aus `datamine-crafting.mjs`, `itemCount` 854) und
> `assets/wikelo-trades.meta.json` (von Hand, `reviewedVersion`/`reviewedAt`
> statt Changelist — 63 handgepflegte Eintraege haben keinen Auslesevorgang).
> `assets/refinery-data.json` neu erzeugt (`build-refinery-data.mjs`
> unveraendert), holt seine Kennung von `mining-db.json` ein
> (`4.9.0-live.12248363` -> `4.9.0-live.12344265`). Alle sechs maschinell
> erzeugten Datenstaende (Missionen, Mining, Crafting, Item-Katalog,
> Refinery, Zerlegung) nennen jetzt CL 12344265 — Zwischenstand fuer das
> Verzugstor der naechsten Welle (`18-04-PLAN.md`, noch nicht gebaut).
> Vorbedingung `assets/items-gamefiles.json` fehlte im frischen Worktree und
> wurde per `npm run datamine:items` nachgeholt (nur lokale `Data.p4k`, kein
> Netz — Rule 3, siehe `18-03-SUMMARY.md`). Alle Bestandszahlen halten exakt
> auf ihrer Klinke (kein Rueckgang): Item-Katalog 9168/4574/6642/23705/136,
> Refinery 26/20/9. `npm run gate` gruen (22/22), normal UND mit `STAGING=1`,
> strikt sequenziell nach Task 2 und Task 3 durchlaufen. `npm run gate:data`
> bleibt rot an `verify:items` — derselbe vorbestehende, unabhaengige Befund
> aus 18-01/18-02, kein Regress dieser Welle. D-04 ist damit zur Haelfte
> erfuellt (Kennungen stehen); das Verzugs-Tor selbst ist Welle 4. ⚠
> `current_phase` im Kopf dieser Datei zeigt weiterhin auf 14 (eine parallele
> Sitzung) — nicht veraendert, dieselbe Konvention wie bei allen vorherigen
> Nachtraegen dieser Art. Naechster Schritt: `18-04-PLAN.md` (`verify:datastand`-
> Tor bauen) oder Betreiber-Sichtrunde ueber die Phase-18-Rueckfall-Katalogeintraege.
>
> **Nachtrag 23.08.2026 (zweiter) — Phase 18 Plan 2 von mind. 2 ausgefuehrt
> (vierte Ortsquelle, Katalog-Dedup, Langschwanz lesbar, Slot-Art D-03).**
> `18-02-PLAN.md` ist ausgefuehrt, ERWEITERT um drei Betreiber-Auftraege nach
> Welle 1 (E-1/E-2/E-3, siehe `18-02-SUMMARY.md`): E-1 erschliesst eine vierte
> Ortsquelle (`ContractPrerequisite_Locality.localityAvailable`, zusaetzlich
> auf der bislang ungelesenen `subContracts[]`-Ebene) und hebt Familien mit
> Ortsangabe von 609 auf **1.180 von 1.347** — deutlich ueber dem
> urspruenglichen ROADMAP-Zielwert 800 (`.planning/WINDOWS.md` id 44
> geschlossen). E-2 entdoppelt den Ortskatalog (Stanton/Pyro/Nyx als
> *Star/*SolarSystem/blosser Systemname fielen sonst dreifach in den Filter).
> E-3 loest den Langschwanz (Monde, Lagrange-Punkte, Rest Stops, Gefaengnis)
> ueber das Spiel-eigene `StarMapObject.name`-Feld auf statt ueber eine
> zweite Handtabelle — u.a. `Klescher Rehabilitation Facility`, `Aberdeen`,
> `CRU L1`, `Starlight Service Station`. D-03 (Slot-Art) laesst `braces()`
> Spielort/Zielort/Abholort/Lieferort wieder unterscheiden statt sie auf
> `{Address}` zusammenfallen zu lassen (932 -> 0 Vorkommen); Chip-Text laeuft
> jetzt durch `phLabel()` in beiden Anzeige-Bauteilen. Zweite Sperrklinke
> `missionsOrtsarten` (min 4) + `missionenMitOrt` auf 1150 angehoben.
> `npm run build && npm run gate` gruen (22/22), normal UND mit `STAGING=1`
> (ein erster STAGING-Lauf riss an einer selbstverursachten Nebenlaeufigkeit,
> siehe SUMMARY „Issues Encountered" — der saubere Wiederholungslauf ist
> gruen). ⚠ `current_phase` im Kopf dieser Datei zeigt weiterhin auf 14 (eine
> parallele Sitzung) — nicht veraendert, dieselbe Konvention wie bei allen
> vorherigen Nachtraegen dieser Art. Naechster Schritt: `18-03-PLAN.md` (D-04,
> Patch-Kennung je Datenstand) oder Betreiber-Sichtrunde ueber die neun
> verbleibenden Rueckfall-Katalogeintraege (Region A-D u.a., siehe SUMMARY
> „Next Phase Readiness").
>
> **Nachtrag 20.08.2026 (sechster) — Phase 16 Plan 5 von 5 ausgefuehrt (Welle 5: Torschaerfung, Schlussmessung, fuenf Sichturteile).**
> `16-05-PLAN.md` ist ausgefuehrt — **Phase 16 ist damit technisch vollstaendig
> (5/5 Plaene)**. Vor Task 1 zusaetzlich die vier 1280px-Kollisionen behoben,
> die der Orchestrator nach Welle 4 gefunden hatte (`deferred-items.md`):
> Hero-Chrome-Elemente (`.holo__frame`/`.holo__hud`/`.holo__dims`) spannten
> ohne eigenes `grid-column` den GESAMTEN Konsolen-Bereich statt nur die
> Buehne — jetzt Kind von `.holo__wrap`. Rot-Vorfuehrung eingeloest
> (Bewaffnungs-Kennwert absichtlich doppelt, `verify:shipcard` riss woertlich
> in beiden Regionen, Dopplung zurueckgenommen). `verify:shipconsole` ist
> SCHARF (`disabled` entfernt, Schiene A jetzt 19 Strecken, 0 ausgesetzt).
> Textbestands-Klinke auf 3.224 Bytes (Ausgang 3.177). Hoehenklinke aus
> Phase 14 (4.200px) haelt trotz neuer Konsole bei 3.609-3.641px — Fall 1
> der Drei-Faelle-Regel, Marke unveraendert. Neue Kontrast-Messgruppe fand
> und behob einen echten Fund (Rail-Gruppe „Antrieb" 4,43:1 im dunklen
> Modus, jetzt >=4,54:1 site-weit). Fuenf neue Sichturteile in
> `.planning/WINDOWS.md` (ids 23-27). `npm run build && npm run gate` gruen
> (20/20), normal UND mit `STAGING=1`. Details in `16-05-SUMMARY.md`.
> **Phase 16 bleibt NICHT als „Complete" markiert** — sieben offene
> Sichtrunden-Punkte (ids 21-27) warten auf den Betreiber, dieselbe
> Konvention wie bei den Phasen 1.2/2/3/9/10/12/14.
> ⚠ `current_phase` im Kopf dieser Datei stand seit einer frueheren Sitzung
> faelschlich auf 12 (Phase 12, laengst abgeschlossen), waehrend
> `current_phase_name` bereits korrekt „das-schiff-ist-die-navigation" (Phase
> 15) nannte — in dieser Sitzung berichtigt. Ebenso: `16-03-PLAN.md` und
> `16-04-PLAN.md` haben in fruaeheren Sitzungen keinen eigenen Nachtrag-Absatz
> hier hinterlassen (nur `16-04-SUMMARY.md` und der ROADMAP-Haken belegen sie)
> — nicht rekonstruiert, ausserhalb des Aufgabenbereichs dieser Welle.
>
> **Nachtrag 20.08.2026 — Phase 16 Plan 2 von 5 ausgefuehrt (Welle 2: Werkzeug vor Eingriff).**
> `16-02-PLAN.md` ist ausgefuehrt: `scripts/verify-shipconsole.mjs` angelegt
> (acht Zusicherungen gegen den Zielzustand der Konsole — Rail<->System-
> Bijektion, P-3-Markerzahl gegen `#holodata`, D-02-Sichtbarkeit ohne
> JavaScript, Textbestands-Klinke, Sprachparitaet), gegen den heutigen Stand
> vorgefuehrt rot (454/454 Seiten ohne `.holo__sys`, erste reissende
> Zusicherung [2]) und mit benanntem Anlass ausgesetzt (Registry-Eintrag
> `disabled`, scharfgeschaltet in `16-05-PLAN.md`, Praezedenz
> `verify:shipcard` 14-01->14-04). `verify:shipcard`s Entdopplungs-Scan
> nimmt jetzt zusaetzlich `section.holo` in die Regionsbildung auf — und hat
> dabei sofort einen echten, vorher unsichtbaren Fund gemacht: `.holo__dims`
> (HUD-Kurzanzeige L/B/H auf der Buehne) dupliziert dieselben Werte wie das
> Kapitel "Ausstattung > Masse & Fracht". Als fuenfte benannte Ausnahme
> `X-holo-dims-hud` dokumentiert statt die Erweiterung zurueckzudrehen.
> Textbestands-Klinke (Erfolgskriterium 3) auf den heute gemessenen
> Minimalwert 3.177 Bytes ueber alle 454 Seiten gesetzt, mit 2% Reserve.
> `#holoact` (toter Knopf, `deferred-items.md`) bewusst NICHT angefasst —
> ausserhalb des Aufgabenbereichs dieser Welle, Einschaetzung im
> Deferred-Dokument korrigiert. `npm run build && npm run gate` gruen,
> normal UND mit `STAGING=1`. Details in `16-02-SUMMARY.md`. Naechster
> Schritt: `16-03-PLAN.md` (Welle 3: D-02 — vier Systemabschnitte
> serverseitig im HTML, Rail als Ankerliste, Beweis ohne JavaScript).
>
> **Nachtrag 18.08.2026 (fuenfter) — Phase 16 Plan 1 von 5 ausgefuehrt (Welle 1: Tracer P-1/P-2/P-3).**
> `16-01-PLAN.md` ist ausgefuehrt: P-3 auf gemessener Grundlage entschieden
> (Variante C — `thruster_main`/`thruster_retro`/`thruster_vtol` bekommen
> immer einen Marker, `thruster_mav` bleibt aussen vor; gegen das
> ausgelieferte `holodata` gegengeprueft, 908 Schiff-Gruppen-Paare, 0
> Abweichungen). `fitCamera()` in `assets/holo-viewer.js` iterativ
> umgebaut — zielt auf die KUeRZERE Buehnenkante statt symmetrisch auf beide,
> das schoepft bei langen Schiffen zusaetzlichen Zoom-Spielraum aus. P-2
> (nur der gewaehlte/ueberfahrene Marker traegt Text) umgesetzt, inkl. eines
> gefundenen Bugs (`setLabels(false)` schaltete mobil die gesamte
> Beschriftungsschicht ab, auch fuer den aktiven Marker — Aufruf entfernt).
> **Ergebnis der fertigen Sonde** (`scripts/probes/schiffskonsole-messung.mjs`,
> 180 Messpunkte): 168 bestehen. Kompakte/mittlere Schiffe erfuellen P-1
> (≥70% Fuellgrad) an allen sechs Pruefbreiten; die zwei laengsten
> Pruefschiffe (Carrack, Ironclad) verfehlen die Marke bei 860/414/360px
> (53,5-68,3% statt 70%) — geometrisch bedingt bei fixer 3/4-Kamera und
> landscape-Buehne, kein Bug. **Nicht eigenmaechtig per Kamera-Azimut
> geloest** (sichtbare, seitenweite Design-Aenderung) — als S-0
> (`.planning/WINDOWS.md` id 21) mit 24 Bildschirmfotos an den Betreiber
> uebergeben. `npm run build && npm run gate` gruen, normal UND mit
> `STAGING=1`. Details in `16-01-SUMMARY.md`. Naechster Schritt:
> `16-02-PLAN.md` (Welle 2: `verify:shipconsole` als Werkzeug vor dem
> Eingriff, Entdopplungs-Scan erweitert).
>
> **Nachtrag 18.08.2026 (vierter) — Phase 14 Plan 4 von 4 ausgefuehrt (Welle 4: Zweispaltigkeit, Schlussmessung, Tor scharf).**
> `14-04-PLAN.md` ist ausgefuehrt: Ausstattung und Umfeld stehen ab 1100px
> als kapitelinterne Zweispaltigkeit (`.sd__ch2col`/`.sd__chsec`). Die
> Schlussmessung landet bei **4.179px DE / 4.117px EN** (Ausgang 5.554px,
> Marke 4.200px) — unterwegs widerlegte die Messung eine eigene Annahme aus
> Welle 4 Task 1 selbst (das Grundriss-Raster sollte einspaltig stehen; die
> Messung zeigt, Bewaffnung dominiert die Zeile ohnehin, zweispaltig ist
> 76px kuerzer) und fand einen zweiten, im UI-SPEC nicht vorausberechneten
> Hoehentreiber (mehrere `auto-fit`-Innenraster brachen in der halbierten
> Spalte um und wurden dadurch HOEHER als bei voller Breite — gescopet mit
> kleineren Mindestbreiten behoben, jeder Wert per Bildschirmfoto gegen
> Text-Ueberlauf geprueft). `verify:shipcard` ist scharf geschaltet
> (Aussetzungsgrund entfernt, 0 Befunde, Zombie-Waechter greift), `npm run
> gate` laeuft jetzt 19 statt 18 Schritte gruen, normal UND mit
> `STAGING=1`. Fuenf neue Sichturteile (id 16-20, `.planning/WINDOWS.md`)
> uebergeben — auffaelligster Neubefund: das kargste Pruefschiff
> (`argo-atls`) rendert ueberhaupt kein Leistungsprofil-Kapitel, nicht bloss
> ein duennes. **Phase 14 ist damit technisch vollstaendig (4/4 Plaene),
> aber NICHT „Complete" markiert** — 7 offene Sichtrunden-Punkte zu Phase 14
> (id 14-20) warten auf den Betreiber, dieselbe Konvention wie bei den
> Phasen 1.2/2/3/9/10/12. Details in `14-04-SUMMARY.md`.
>
> **Nachtrag 18.08.2026 (zweiter) — Phase 14 Plan 2 von 4 ausgefuehrt (Welle 2: Tracer).**
> `14-02-PLAN.md` ist ausgefuehrt: EIN Weg durch alle Schichten — klebende
> Kapitel-Sprungleiste unter der Kennwerte-Leiste, "Kaufen im Verse" als
> erstes Kapitel mit Zahl-Chip und goldener Rahmenoberkante, sieben neue
> i18n-Schluessel, Aktivmarkierung per IntersectionObserver. Am gerenderten
> Bildpunkt gemessen statt geschaetzt: das Hoehenbudget bei 1280x720 betraegt
> nur 34px (nicht die im UI-SPEC angenommenen ~90px — die Schaetzung vergass
> `.holo{margin-top:56px}`), die Sprungleiste wurde entsprechend auf 30,6px
> verdichtet (Rahmen als `box-shadow:inset` statt `border`) und passt jetzt
> mit 3px Reserve ohne Scrollen ins Bild (Erfolgskriterium 3).
> `verify-shipcard --report`: Zusicherung 2/3/7 ohne Befund auf allen 454
> Seiten; 4/5/6 melden erwartungsgemaess weiter Befunde (Tracer, nicht
> Phasenabschluss). `npm run build && npm run gate` gruen, je zweimal
> zusaetzlich mit `STAGING=1`. Details in `14-02-SUMMARY.md`. Naechster
> Schritt: `14-03-PLAN.md` (Leistung, Ausstattung und Umfeld als Kapitel).
>
> **Nachtrag 18.08.2026 (erster) — Phase 14 Plan 1 von 4 ausgefuehrt (Welle 1: Werkzeug vor Eingriff).**
> „Schiffs-Datenkarte entstapeln" (`.planning/phases/14-schiffs-datenkarte-entstapeln/`),
> 4 Plaene. **Plan 01 ist ausgefuehrt**: `verify-shipcard.mjs` (acht
> Zusicherungen gegen `dist/schiffe`+`dist/de/schiffe`, einmal vorgefuehrt
> rot: 1.385 Doppelungsbefunde, 4.256 verbliebene Einheitsrahmen) und
> `scripts/probes/schiffskarte-messung.mjs` (reproduziert die Ausgangsmessung
> Carrack 1280×720 dunkel exakt bei 5.554 px/DE, 5.498 px/EN). Diese Welle
> aendert keine ausgelieferte Zeile — reine Messapparatur, Details in
> `14-01-SUMMARY.md`. Naechster Schritt: `14-02-PLAN.md` (Tracer: ein
> Kapitel end-to-end mit Sprungleiste).
> ⚠ Phase 12 ist NICHT erledigt — sie wartet weiterhin auf ihre Sichtrunde
> (`.planning/WINDOWS.md`, id 12). Der Kopf-Eintrag `current_phase` ist nur
> deshalb auf 14 gewandert, weil dort jetzt gearbeitet wird.
>
> **Nachtrag 15.08.2026 (zweiter) — Phase 12 ist geplant, ausführbereit.**
> „Fundorte in der Mining-Werkbank anklickbar", **3 Pläne in 3 Wellen**
> (`.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/`),
> Plan-Prüfer bestanden, Struktur maschinell validiert (3 × `valid: true`,
> 8 Tasks). Zweig `claude/mining-site-clickable-locations-dec7bc`, von
> `origin/staging` (`e20c56c`) aus — der Worktree hing anfangs auf `main`
> und wurde zurückgesetzt.
> Nächster Schritt: `/gsd-execute-phase 12`.
>
> ⚠ **Phase 10 ist damit NICHT erledigt.** Sie liegt auf staging und wartet
> weiterhin auf ihre Sichtrunde (`.planning/WINDOWS.md`, id 11). Der
> Kopf-Eintrag `current_phase` ist nur deshalb auf 12 gewandert, weil dort
> jetzt gearbeitet wird — nicht, weil 10 abgenommen wäre.
>
> **Nachtrag 15.08.2026 (erster) — Phase 10 ist geplant, ausführbereit.**
> „Mining-Presets bedienbar machen", 2 Pläne in 2 Wellen
> (`.planning/phases/10-mining-presets-bedienbar-machen/`), Plan-Prüfer bestanden.
>
> ⚠ Der übrige Text dieser Datei beschreibt weiterhin den Stand vom **02.08.2026**
> (Phase 5). Die Phasen 6, 7, 8 und 9 sind seither aus anderen Sitzungen
> ausgeliefert worden, ohne diesen Abschnitt fortzuschreiben — die Angaben unter
> „Current Position" sind entsprechend veraltet und nicht als Lagebild zu lesen.
> Absichtlich nicht überschrieben: an Phase 5 arbeitet laut demselben Abschnitt
> eine parallele Sitzung.

## Current Position

Phase: 14 (testpilot-zugang-staging-hinter-der-discord-rolle) — EXECUTING
Plan: 12 of 12
Status: Ready to execute
Phasen 1.2/2/3/9/10: die menschliche Sichtrunde (7 Punkte, DE+EN, beide
Farbmodi, 1920x1080 UND 1280x720) steht noch aus, offener Eintrag
`.planning/WINDOWS.md` id 12. Alle 18 Schienen-A-Schritte gruen (normal UND
`STAGING=1`), 297 e2e-Testfaelle gruen, die neue Messsonde
`scripts/probes/mining-locview-messung.mjs` bestaetigt alle 9 UI-SPEC-
Backstops am gerenderten Bildpunkt (72/72 Messpunkte).

Phase: 15 (das-schiff-ist-die-navigation) — 5/5 Plaene ausgefuehrt
Plan: 5 of 5 — abgeschlossen (`16-05-SUMMARY.md`)
Status: **Technisch fertig, NICHT „Complete" markiert** — dieselbe Konvention wie
Phasen 1.2/2/3/9/10/12/14: die menschliche Sichtrunde steht noch aus, sieben
offene Eintraege `.planning/WINDOWS.md` ids 21-27 (S-0/Markererkennbarkeit,
D-04-Wirtschaftlichkeit, und die fuenf Punkte aus Welle 5: schmalste
Buehnenbreite, Rail-Einfachauswahl, Auslesung-Uebersicht, dichteste
Einzelgruppe am groessten Schiff, Buehnen-Anziehungskraft ohne
Video-Standardmodus). Alle 20 Schienen-A-Schritte gruen (normal UND
`STAGING=1`), inklusive des jetzt scharfen `verify:shipconsole`.

(Die vorherige Phase 12 — fundorte-in-der-mining-werkbank-anklickbar — bleibt
unveraendert bei 3/3 Plaenen, ebenfalls technisch fertig und NICHT „Complete"
markiert, offener Eintrag `.planning/WINDOWS.md` id 12.)

---

**Ab hier: Alttext vom 02.08.2026 zu Phase 5** (vom Werkzeug beim Fortschreiben
angeschnitten, Satzanfang rekonstruiert). Der Abgleich mit `origin/staging` hatte
gezeigt, dass `/support.html` bereits existiert und live ist (Commit `517a9a7`,
`src/components/SupportBody.astro` als EIN Körper für DE+EN, Empfänger
`paypal.me/mkrisz22`, Fuß und Menü verdrahtet). Dieser Worktree war von `a23a22a`
abgezweigt und blind dafür. Phase 5 ist deshalb kein Neubau mehr, sondern der
**Umbau der bestehenden Seite** auf die Gestaltungsrichtung „Instandsetzung".
Branch: claude/donation-button-feature-98ba38 (Worktree)
Last activity: 2026-08-17 — Phase 14 execution started

**Was der bestehenden Seite fehlt** (gemessen, nicht vermutet):

- Datenschutzerklärung nennt PayPal in KEINER der beiden Sprachfassungen (0 Treffer)
  — der einzige Punkt mit rechtlicher Relevanz

- Keine eigene Optik (Standard-Palette `--accent:#2dd4ff`), keine Betragswahl, kein Ko-fi
- Als Grund steht die generische Serverkosten-Begründung statt des defekten Netzteils

**Was bleibt und übernommen wird:** die Abschnitte „Was genauso hilft" und
„Kein Kleingedrucktes" — inhaltlich stark, sie bekommen nur die neue Form.

**Achtung Mehrfachsitzung:** Der Betreiber arbeitet parallel in einer zweiten
Sitzung an Phase 5. `SupportBody.astro` darf nicht gleichzeitig aus zwei Sitzungen
geändert werden.

**Geparkt:** Phase 1.1 „Ambiente-Effekte stilllegen" steht bei Plan 2 von 3
(Plan-Prüfer bestanden, ausführbereit) auf Branch
`claude/site-feedback-effects-docs-3f4edf`. Sie ist NICHT abgebrochen und wird
nach Phase 5 fortgesetzt; Phase 5 fasst keine der dort geänderten Dateien an.

**Ebenfalls fertig, aus einer dritten Sitzung:** Phase 7 „Komponenten-Filter für Schiffe"
(Branch `claude/gsd-ship-component-filter-f81262`) ist ausgeführt und am 03.08.2026 mit
`staging` zusammengeführt. Sie lief parallel zu Phase 6 und ging noch von zwei
handduplizierten Schiffsseiten aus; beim Zusammenführen wanderte der Filter in den von
Phase 6 eingeführten gemeinsamen Körper `components/ships/ShipsOverview.astro`.

**Ebenfalls neu, aus einer vierten Sitzung (06.08.2026):** Phase 1.2 „Werkzeuge erklären"
ist besprochen, recherchiert und in **fünf** Plänen geschnitten (nicht zwei — der Textumfang
von elf Werkzeugen passt nicht in zwei Pläne). **Plan 01 von 5 ist ausgeführt**: die
Hilfe-Mechanik steht end-to-end am Item Finder — Textkatalog `src/i18n/help.ts` ohne
Sprachrückfall, Bauteil `src/components/ToolHelp.astro`, Stufe-2-Maschine
`assets/tool-help.js` und das bleibende Prüftor `scripts/verify-help.mjs`
(`npm run verify:help`, 5 Zusicherungen). **Plan 02 von 5 ist ebenfalls ausgeführt**:
Crafting, Mining und Refinery-Finder hängen jetzt an derselben Mechanik (38 neue
DE/EN-Schlüssel, 20 erklärte Bedienelement-ARTen) — dabei ist der Mehrfach-Instanz-Fall
bewiesen: Mining und Refinery-Finder sitzen auf derselben gebauten Seite
(`src/components/topics/mining.astro`) mit zwei unabhängigen `ToolHelp`-Instanzen, ohne
Kollision und mit nur einem wirksam geladenen `tool-help.js`. **Plan 03 von 5 ist
ebenfalls ausgeführt**: Patch-Archiv, Missionen, Rüstungssets und Wikelo's Emporium
hängen jetzt an derselben Mechanik (37 neue DE/EN-Schlüssel) — dabei sind die beiden
im Plan benannten Sonderfälle gelöst: die fünf strukturgleichen Auswahllisten der
Missionsleiste teilen sich einen Erklärtext und werden trotzdem alle fünf umrandet
(ein `data-help`-Wert auf mehreren Ankern), und Rüstungssets (keine Werkzeugleiste)
bekam seinen Einstieg zwischen Einleitungstext und Sprungmarken-Leiste — im Code
ausdrücklich als **Annahme A2, keine Entscheidung des Betreibers** markiert, zur
Bestätigung in Plan 04 Task 3. **Plan 04 von 5 ist ebenfalls ausgeführt**: Schiffe und
Precision Jump hängen jetzt an derselben Mechanik (20 neue DE/EN-Schlüssel) — dabei
stellte sich heraus, dass Schiffe seit der Phase-6/7-Zusammenführung keine zwei
handgepflegten Seitendateien mehr sind, sondern EINEN gemeinsamen Körper
(`src/components/ships/ShipsOverview.astro`) hat; die Hilfe wurde deshalb nur dort
verdrahtet, nicht mehr in `src/pages/schiffe.astro` und `src/pages/de/schiffe.astro`
wie ursprünglich geplant — der Class-A-Duplikationsbefund entfällt für dieses
Werkzeug. Precision Jump bekam seinen Einstieg vor der Steuerkonsole, ebenfalls als
**Annahme A2** markiert. `verify-help.mjs` meldet jetzt 10 von 11 Werkzeugen. **Plan 05
von 5 ist ebenfalls ausgeführt**: der Refinery-Tracker (`/refinery.html`, kontogebunden)
hängt jetzt an derselben Mechanik (14 neue DE/EN-Schlüssel, 163 gesamt) — `ToolHelp`
sitzt INNERHALB des serverseitig `hidden`-Blocks `div#rfd`, unmittelbar nach
`div.rfd-top` (Regel R-1: die Seite leitet abgemeldete Besucher sofort weg, es gibt
außerhalb von `#rfd` nichts zu erklären), acht `data-help`-Anker auf acht
Huellelementen, vier davon im gebauten HTML leer und client-seitig befüllt (Regel
R-4). Anders als bei Plan 04 stimmten alle im Plan genannten Zeilennummern exakt mit
dem tatsächlichen Code überein — keine Planabweichung dieser Art. `node
scripts/verify-help.mjs --complete` meldet jetzt **„Abgedeckt: 11 von 11"**, alle fünf
Zusicherungen erfüllt; ebenso grün: `npm run audit:site` (0 FEHLER), `npm run
audit:csp` (10 externe Quellen, alle abgedeckt), `npm run verify:fx` (Phase 01.1
unverändert), `npm run verify` (0 gebrochene Verweise). DOC-01 bis DOC-07 in
`.planning/REQUIREMENTS.md` auf dieser maschinellen Grundlage abgehakt.
**Die im Plan verlangte Sichtrunde (12 Punkte + Annahmen A2/A4, braucht ein
angemeldetes Konto) wurde bewusst NICHT vom Executor durchgeführt** — sie ist als
offener Punkt in `.planning/WINDOWS.md` (id 2, `unrun-verify`) und in
`01.2-05-SUMMARY.md` an den Betreiber zurückgegeben. **Phase 1.2 ist damit
technisch fertig (5/5 Pläne, 11/11 Werkzeuge maschinell belegt), aber NICHT als
„Complete" markiert**, solange die Sichtrunde aussteht.
⚠ Beim Einbringen wurden die Phase-01.1-03-Commits jener Sitzung **bewusst weggelassen** —
der Mauszeiger-Schein ist auf `staging` bereits getilgt (0 Treffer für `cursorglow`/`--mx`),
die Arbeit wäre ein Duplikat gewesen. Phase 1.1 bleibt hier bei 2/3.

**Aus einer fünften, parallelen Sitzung (08.08.2026): Phase 2 „Schrift- und
Bewegungsskala" ist mit Plan 07 von 7 fertig ausgeführt.** Die Sperrklinke in
`scripts/verify-typo-motion.mjs` (Zusicherung 2) ist von 183 (Tracer-Stand nach
Plan 01) auf 235.775 (site-weiter Ist-Stand) angehoben, eine sechste Zusicherung
zählt den skalenpflichtigen Rest über den GESAMTEN Quellbestand (0 über 96
Dateien) als Dauerwächter, und `npm run verify:typo` läuft jetzt im
Dockerfile-Tor nach dem Build — eine gerissene Skala kann kein Auslieferungsimage
mehr erzeugen. Negativkontrolle durchgeführt und bestanden (siehe
`02-07-SUMMARY.md`). `TYPO-01`/`TYPO-02` sind in `REQUIREMENTS.md` auf dieser
Grundlage abgehakt; `TYPO-03` bleibt offen, weil die BREITERE Schluss-Sichtrunde
über die ~92 site-weit umgestellten Dateien (die engere Kopfleiste+Startseite-Runde
ist bereits abgenommen) noch aussteht — als offener Punkt `.planning/WINDOWS.md`
id 5 an den Betreiber übergeben. **Phase 2 ist damit technisch fertig (7/7 Pläne),
aber NICHT als „Complete" markiert**, solange die Sichtrunde aussteht — derselbe
Umgang wie bei Phase 1.2 oben.

Progress: [█████████░] 91%

Progress: [█████████░] 85%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01.1 P01 | 45min | 3 tasks | 8 files |
| Phase 01.1 P02 | ~2h | 3 tasks | 39 files |
| Phase 06 P01 | 45min | 2 tasks | 8 files |
| Phase 06 P02 | 55min | 2 tasks | 5 files |
| Phase 06 P03 | ~2h55min | 2 tasks | 1 files |
| Phase 07 P01 | ~35min | 2 tasks | 6 files |
| Phase 07 P02 | 55min | 3 tasks | 3 files |
| Phase 07 P03 | ~45min | 3 tasks | 3 files |
| Phase 1.2 P01 | 35min | 2 tasks | 6 files |
| Phase 1.2 P02 | ~40min | 2 tasks | 4 files |
| Phase 1.2 P03 | ~40min | 2 tasks | 5 files |
| Phase 01.2 P04 | ~35min | 2 tasks | 3 files |
| Phase 01.2 P05 | ~40min | 2 tasks | 4 files |
| Phase 02 P01 | ~55min | 3 tasks | 5 files |
| Phase 02 P02 | ~40min | 2 tasks | 2 files |
| Phase 02 P03 | ~90min | 2 tasks | 9 files |
| Phase 02 P05 | ~45min | 2 tasks | 20 files |
| Phase 02 P06 | ~50min | 2 tasks | 40 files |
| Phase 02 P07 | ~40min | 2 tasks | 4 files |
| Phase 03-ueberlagerungen-entstapeln P01 | 40min | 3 tasks | 6 files |
| Phase 03-ueberlagerungen-entstapeln P02 | 41min | 2 tasks | 2 files |
| Phase 03-ueberlagerungen-entstapeln P03 | ~30min | 2 tasks | 23 files |
| Phase 03-ueberlagerungen-entstapeln P04 | ~25min | 2 tasks | 22 files |
| Phase 03-ueberlagerungen-entstapeln P05 | ~2h | 3 tasks | 25 files |
| Phase 04-sprachparitaet-absichern P01 | 40min | 2 tasks | 5 files |
| Phase 04-sprachparitaet-absichern P02 | 30min | 3 tasks | 7 files |
| Phase 04 P03 | 65min | 3 tasks | 9 files |
| Phase 10 P01 | 35min | 3 tasks | 4 files |
| Phase 10 P02 | 35min | 3 tasks | 7 files |
| Phase 12 P01 | 50min | 2 tasks | 4 files |
| Phase 12 P02 | 50min | 3 tasks | 4 files |
| Phase 12 P03 | ~100min | 3 tasks | 7 files |
| Phase 14 P01 | 75min | 2 tasks | 6 files |
| Phase 14 P02 | 50min | 2 tasks | 5 files |
| Phase 14 P03 | 70min | 2 tasks | 6 files |
| Phase 14 P04 | ~75min | 3 tasks | 5 files |
| Phase 15 P01 | 110min | 2 tasks | 7 files |
| Phase 15 P02 | ~65min | 3 tasks | 2 files |
| Phase 15 P10 | ~55min | 3 tasks | 4 files |
| Phase 15 P05 | ~2h35min | 2 tasks | 1 files |
| Phase 15 P03 | ~30min | 2 tasks | 1 files |
| Phase 15-testpilot-zugang-staging-hinter-der-discord-rolle P04 | ~50min | 2 tasks | 3 files |
| Phase 15 P06 | ~55min | 2 tasks | 2 files |
| Phase 15 P07 | ~50min | 3 tasks | 8 files |
| Phase 15 P08 | ~2h30min | 3 tasks | 4 files |
| Phase 15 P11 | ~50min | 2 tasks | 4 files |
| Phase 15 P09 | ~2h | 3 tasks | 8 files |
| Phase 15 P12 | 35min | 3 tasks | 2 files |
| Phase 18 P01 | 65min | 2 tasks | 6 files |
| Phase 18 P02 | ~3h | 3 tasks | 9 files |
| Phase 18 P03 | ~70min | 3 tasks | 7 files |
| Phase 18 P04 | ~2h | 3 tasks | 1 files |

| Phase 16 P01 | 185min | 3 tasks | 6 files |
| Phase 16 P02 | 30min | 2 tasks | 6 files |
| Phase 16 P03 | ~90min | 2 tasks | 3 files |
| Phase 16 P05 | ~1h50min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Meilenstein-Richtung ist UI-/Design-Feinschliff; Daten, Konto und Discord bleiben unangetastet
- Init: Grobe Granularität — 4 Phasen, je 2 Pläne
- Init: Projekt-Recherche übersprungen (Bestandsprojekt mit festem, dokumentiertem Stack; kein Web-Such-MCP verbunden). Recherche pro Phase bleibt aktiv.
- [Phase ?]: 01.1-01: data-fx/vb.fx/vbfxchange/js-fx-toggle als endgueltiger FX-Vertrag festgelegt (reversibility: costly) — Plaene 02/03 bauen direkt darauf auf
- [Phase ?]: 01.1-01: 11 vorbestehende, unabhaengige test:e2e-Fehlschlaege (item-finder-app.js Cache-Bust) in deferred-items.md dokumentiert, nicht behoben (Scope Boundary)
- [Phase ?]: archive.js: eine gemeinsame running-Variable traegt Tab-Sichtbarkeit UND FX-Wahl statt zweier konkurrierender Riegel
- [Phase ?]: Codemod liest den Leinwandnamen aus getElementById statt ihn festzuverdrahten -- erkennt dadurch die abweichende dust-Leinwand von sc-4-9-0 korrekt
- [Phase ?]: sc-4-2-0 Regen und Blitz bewusst aus dem Codemod ausgeschlossen und von Hand gegattert, inkl. Reset des Zeitgebers beim Wiedereinschalten
- [Phase 6]: 06-01: vRoleCig() ersetzt fociDe als Kartenbeschriftung, Fallback auf vRole() fuer die 4 ATLS-Faelle; EIN Koerper (ShipsOverview.astro) fuer /schiffe.html + /de/schiffe.html
- [Phase 6]: 06-01: npm run theme lief repo-weit und veraenderte 84 unbeteiligte Dateien (Alt-Drift) -- alle zurueckgesetzt, nur die 4 fuer diesen Plan vorgesehenen Dateien blieben veraendert
- [Phase 6]: 06-02: 18 Rollenfamilien (CAREER_LEGACY/ROLE_COMPOUND/ROLE_FAMILY) + Signatur (sig, 16 Schiffe) + Merkmalsleiste (feat: cargo 102, ground 37) aus dem DataCore; Bewaffnet (dogfightEnabled 220/223) bewusst nicht als Merkmal erzeugt (D-09)
- [Phase 6]: 06-02: npm run theme beruehrte erneut dieselben 84 unbeteiligten Dateien aus Plan 01 (Alt-Drift) -- zurueckgesetzt, nur die 5 Plan-Dateien blieben veraendert
- [Phase 6]: 06-03: 7 Schnellzugriff-Chips (sdb__quick/sdb__qchip) setzen Rollenfamilie+Signatur in einem Klick (D-10, ROLE-06); sf-type (Wiki-Grobfilter) abgeloest
- [Phase 6]: 06-03: Sichtpruefung fand doppelten Rollenfilter (sf-role neben sf-rolefam) -- sf-role entfernt, sf-rolefam ist jetzt DER Rollenfilter (D-05); Konsole 9 statt 10 Bedienelemente
- [Phase 7]: 07-01: compAttr liefert bei "Daten, aber keine Kategorie" den Platzhalter `_` statt der leeren Zeichenkette -- Astro rendert leere String-Attributwerte ohne `=`, was die automatisierte HTML-Zaehlung im Plan brach (siehe 07-01-SUMMARY.md Deviations)
- [Phase 7]: 07-01: catOf() prueft `m` (MissileLauncher/BombLauncher) VOR `w` (WeaponGun), sonst landen Kombi-Halterungen faelschlich bei den Waffen; Turm-Platz bleibt bewusst frei fuer 07-02 (D-06)
- [Phase 7]: 07-02: D-06 -> D-06a waehrend des blockierenden Checkpoints verschaerft -- die geratene Fernturm-Namenserkennung (`remote`/`tractor`) ist ersatzlos gestrichen, Turm zaehlt nur noch `TurretBase` ohne `Container` (reversibility: costly). Preis: Carrack/Redeemer/Polaris verlieren ihre ferngesteuerten Turm-Ports; 47 statt 59 Schiffe tragen jetzt `t`. `t` speichert wie alle Kategorien die maximale Steckplatzgroesse, NICHT die Turmanzahl (Verwechslungsgefahr, siehe 07-02-SUMMARY.md).
- [Phase 7]: 07-03: 26 automatisierte `node:vm`-Testfaelle (`tests/e2e/ship-component-filter.test.js`) fuehren das echte Inline-Skript aus und decken D-04/D-08/D-10/D-11/D-12 ab.
- [Phase 7]: Zusammenfuehrung 03.08.2026: Phase 7 lief parallel zu Phase 6 und ging von zwei handduplizierten Schiffsseiten aus. Phase 6 hat die beiden zu EINEM Koerper zusammengelegt -- der Filter sitzt seither in `components/ships/ShipsOverview.astro`, nicht mehr zweimal in den Seiten. Das Groessenfeld heisst `sf-compsize`, weil Phase 6 `sf-size` bereits fuer die Schiffs-Groessenklasse belegt.
- [Phase 1.2]: 01.2-01: useHelp()/assertHelpParity() statt useTranslations() — Hilfetexte duerfen nie auf Englisch zurueckfallen (DOC-04). Der eingebaute EN-Rueckfall in src/i18n/ui.ts ist fuer Hilfetexte das Gegenteil des Erfolgskriteriums.
- [Phase 1.2]: 01.2-01: Stufe-2-Markup/CSS/Blase entsteht ausschliesslich per JS in activate() — vor dem Klick existiert nichts davon (DOC-06/D-11)
- [Phase 1.2]: 01.2-01: data-help auf stabilen Huellelementen statt auf ihren Kindern — ueberlebt jeden innerHTML-Neuaufbau der Item-Finder-Chips (DOC-03)
- [Phase 1.2]: 01.2-01: tool-help.js haengt am Bauteil ToolHelp.astro, NICHT an Layout.astro — es liegt damit auf elf Werkzeugseiten statt auf ~26.000 gebauten Seiten (DOC-06 maschinell beweisbar)
- [Phase 1.2]: 01.2-02: Mehrfach-Instanz-Fall bewiesen — zwei ToolHelp auf src/components/topics/mining.astro (mining + refineryfinder) kollidieren nicht, weil details.tool-help ohne name-Attribut keine native HTML-Exklusivitaet hat und getrennte data-tool-id getrennte vb.help.seen-Eintraege schreiben
- [Phase 1.2]: 01.2-03: Ein data-help-Wert auf mehreren gleichartigen Elementen (missions.ctl.select fuenfmal auf der Missionsleiste) erfuellt D-01 (alle umrandet) und D-03 (einmal je ART erklaert) gleichzeitig, ohne Aenderung an tool-help.js
- [Phase 1.2]: 01.2-03: Ruestungssets-Platzierung (zwischen p.as-intro und nav.as-jump) im Code ausdruecklich als Annahme A2 kommentiert, nicht als Entscheidung — offen zur Bestaetigung in Plan 04 Task 3
- [Phase 1.2]: 01.2-04: Schiffe seit Phase 6 EIN gemeinsamer Koerper (ShipsOverview.astro) statt zweier Seitendateien — Class-A-Sprachparitaets-Risiko fuer dieses Werkzeug entfaellt, Hilfe nur an EINER Stelle verdrahtet
- [Phase 1.2]: 01.2-04: Precision-Jump-Platzierung (vor .pj-console, kein Filterleiste) im Code als Annahme A2 markiert, zur Bestaetigung im Phasen-Tor von Plan 05
- [Phase 1.2]: 01.2-05: ToolHelp sitzt INNERHALB des serverseitig hidden-Blocks div#rfd (Regel R-1) — die Sprachparitaetspruefung greift trotzdem unveraendert, weil hidden ein Sichtbarkeits-Attribut ist, kein Ausschluss aus dem ausgelieferten HTML (ausdruecklich NICHT der Item-Finder-Fall)
- [Phase 1.2]: 01.2-05: DOC-01 bis DOC-07 auf Grundlage von verify-help.mjs --complete (11/11) abgehakt; die im Plan verlangte Sichtrunde (12 Punkte + Annahmen A2/A4) wurde bewusst NICHT vom Executor durchgefuehrt (braucht angemeldetes Konto + menschliches Urteil) und ist als offener Punkt in WINDOWS.md (id 2) an den Betreiber zurueckgegeben — Phase 1.2 bleibt deshalb "In Progress", nicht "Complete"
- [Phase ?]: [Phase 2]: 02-01: Ausgangszahlen aus PLAN.md (1968/95/865/663) durch rigorosen Nachvollzug ersetzt (1961/96/863/660) -- Differenzen einzeln erklaert in 02-01-SUMMARY.md
- [Phase ?]: [Phase 2]: 02-01: Audit-Skript zaehlt Bedienuebergaenge als ui+token statt nur ui, damit spaetere Plaene (03-06) den erreichten Ist-Stand nicht als Regression melden
- [Phase ?]: [Phase 2]: 02-02: tests/e2e/typo-motion-morph.test.js pinnt die beiden Messeingaenge von measureMorph() (--fs-10=1rem, --ls-15=0.18em) gegen dist/ als bleibendes Regressionstor vor der site-weiten Breite (Plaene 03-07); Negativkontrolle durchgefuehrt (--fs-10 testweise auf 0.95rem, Test schlug fehl, zurueckgesetzt)
- [Phase ?]: [Phase 2]: 02-02: die menschliche Sichtrunde (Erfolgskriterium 3) bewusst NICHT vom Executor durchgefuehrt (human_verify_mode: end-of-phase) -- als offener Eintrag id 3 in WINDOWS.md hinterlegt, wird in Plan 07 mit der Schluss-Sichtrunde zusammengefuehrt; dabei die seit Phase 1.2 nicht mehr nachgerechnete Ledger-Kopfzeile (fixed_count/total_count) korrigiert
- [Phase ?]: [Phase 2]: 02-03: Zuordnungslogik aus audit-typo-motion.mjs nach scripts/lib/typo-motion.mjs herausgezogen -- Erhebung UND Massendurchlauf teilen sich jetzt EIN Modul, koennen nicht mehr auseinanderdriften
- [Phase ?]: [Phase 2]: 02-03: migrate-typo-motion.mjs nutzt zwei VERSCHIEDENE, je nach Eigenschaft etablierte Ausreisser-Schwellen (font-size: >6% relativ, letter-spacing: >0.02em absolut, aus 02-01-PLAN.md uebernommen, nicht neu erfunden) -- eine einheitliche 6%-Schwelle haette bei Laufweiten-Werten praktisch jeden zweiten Wert als Ausreisser gemeldet
- [Phase ?]: [Phase 2]: 02-03: lokale Kurven-Aliase (archive.css --ease/--ease-out, data-page.css --dp-ease) werden generisch erkannt (eigene Definition zeigt auf ease-Keyword/cubic-bezier), nicht dateispezifisch festverdrahtet -- data-page.css war im Plan nicht namentlich genannt, --dp-ease nach vollstaendiger Migration seiner 6 Fundstellen als totes Token entfernt
- [Phase ?]: [Phase 2]: 02-03: archive.css letter-spacing 0.5em (56% Abweichung) und drei weitere font-size-Ausreisser (9px x2, 1.7rem) waren vom Plan NICHT namentlich benannt, wurden aber vom Codemod mechanisch gefunden und nach D-05-Praezedenz von Hand auf die naechste Stufe gesetzt, siehe 02-03-SUMMARY.md
- [Phase ?]: [Phase 2]: 02-03: REQUIREMENTS.md TYPO-01/02/03 bewusst NICHT auf "Complete" in der Traceability-Tabelle gesetzt -- site-weite Abdeckung ist erst nach Plan 07 vollstaendig (Plaene 04-07 stehen noch aus), Praezedenzfall aus 02-02-SUMMARY.md fortgefuehrt
- [Phase ?]: [Phase 2]: 02-04: scripts/audit-typo-motion.mjs --only unterstuetzte nur EINEN Wert (indexOf statt Sammeln); auf collectFlagValues() umgestellt wie migrate-typo-motion.mjs -- ohne die Aenderung haetten die im Plan selbst vorgegebenen Mehrfach-`--only`-Verify-Befehle (auch in 02-05/06) still nur die erste Datei geprueft
- [Phase ?]: [Phase 2]: 02-04: die plan-vorgegebene Verify-Formel "--only src/components/ --only src/layouts/" als exakte Dateiliste dieses Plans (28 Einzelpfade) interpretiert statt als Verzeichnis-Praefix -- woertlich ausgefuehrt haette sie faelschlich die noch nicht umgestellten Verzeichnisse patches/topics/account/ships (Eigentum von 02-05/06) erfasst
- [Phase ?]: [Phase 2]: 02-04: FxToggle.astro vier "visibility 0s [linear] Xs"-Uebergaenge (0ms-Sichtbarkeits-Synchronisation, durch keine bestehende Ausnahmekategorie gedeckt) von Hand auf var(--dur-fast) gesetzt; Verzoegerungswerte bleiben immer woertlich -- neues Referenzmuster fuer 02-05/06, falls dort aehnliche Faelle auftauchen
- [Phase ?]: [Phase 2]: 02-04: ItemFinderPage.astro letter-spacing 0.44em (27% Abweichung, zweitgroesster Ausreisser der Phase) auf var(--ls-20) gerastet; das gekoppelte text-indent (laut Quellkommentar exakte Kompensation der Sperrung) im selben Schritt mitgezogen
- [Phase ?]: [Phase 2]: 02-04: assets/hero-video.js transition:opacity 1.4s ease bewusst NICHT migriert (Ambient-Loop laut eigenem Kommentar, 1400ms weit ueber der 350ms-Bedienuebergang-Schwelle) -- Praezedenz aus 02-03 (archive.css Aeren-Uebergaenge) fortgefuehrt
- [Phase ?]: [Phase 2]: 02-04: REQUIREMENTS.md TYPO-01/02/03 weiterhin NICHT auf "Complete" gesetzt -- site-weite Abdeckung ist erst nach Plan 07 vollstaendig (Plaene 05-07 stehen noch aus)
- [Phase ?]: [Phase 2]: 02-05: alle 19 Patch-Koerper (956 Ersetzungen, 0 Verweigerungen) auf die Skala umgestellt -- groesster Einzelblock der Phase; sc-4-2-0 (Regen/Blitz) und sc-4-9-0 (#dust) per Diff-Zeilenbereich geprueft, Ambiente-JS ausserhalb aller Hunks
- [Phase ?]: [Phase 2]: 02-05: animation-Sollzahl aus dem Plan (160) war eine Verwechslung mit der transition-Deklarationszahl (ebenfalls 160) -- tatsaechliche, vor/nach dem Lauf identische Zahl ist 133; REQUIREMENTS.md korrigiert
- [Phase ?]: [Phase 2]: 02-06: fuenf handgepflegte DE/EN-Seitenpaare + 404 sowie 22 Themen-Koerper/5 Konto-Ansichten/PilotPage/ShipsOverview umgestellt (530 Ersetzungen, 5 Verweigerungen -- 2 .85em elternrelativ, 3 von Hand nach D-05 eingerastet); alle Paare EN=DE identisch (0 Abweichungen), 29 ship-component-filter-Testfaelle weiterhin gruen
- [Phase ?]: [Phase 2]: 02-06: die im Plan genannten Ausgangszahlen/Ausreisser waren Prosa-Schaetzungen -- tatsaechlich nur 3 Ausreisser (PilotPage 2.8rem/2rem, mining.astro .sh-icon 2.4rem), nicht 4; PilotPage 2.2rem liegt exakt auf --fs-17 (kein Ausreisser), RefineryDashboard/FriendsManager 1.5rem liegen bei 3.45% (unter der Schwelle)
- [Phase ?]: [Phase 2]: 02-07: MIN_TOKEN_USAGES (Sperrklinke, verify-typo-motion.mjs Zusicherung 2) von 183 (Plan-01-Tracer-Stand) auf 235775 (site-weiter Ist-Stand nach 02-06) angehoben -- gemessen mit dem Skript selbst, nicht geschaetzt
- [Phase ?]: [Phase 2]: 02-07: sechste Zusicherung ergaenzt (skalenpflichtiger Rest ueber den GESAMTEN Quellbestand ist 0), ruft ausschliesslich scripts/lib/typo-motion.mjs auf -- kein drittes Muster; Negativkontrolle durchgefuehrt (LangSwitcher.astro testweise auf font-size:0.8rem zurueckgesetzt, Zusicherung 6 schlug fehl, zurueckgesetzt)
- [Phase ?]: [Phase 2]: 02-07: npm run verify:typo ans Dockerfile-Tor gehaengt (Zeile 34, nach dem Build) -- ab jetzt build-blockierend fuer das Auslieferungsimage, nicht mehr nur von Hand aufrufbar
- [Phase ?]: [Phase 2]: 02-07: REQUIREMENTS.md Traceability-Tabelle hatte eine HTML-Kommentarzeile MITTEN in der Tabelle (zwischen DOC-07/DATA-01), die jede zeilenweise Tabellensuche ab dort abbrach (gsd-tools requirements mark-complete meldete faelschlich table_unmatched fuer TYPO-01/02 und alle folgenden Zeilen) -- Kommentar unveraendert ans Tabellenende verschoben (Rule 3)
- [Phase ?]: [Phase 2]: 02-07: TYPO-01/TYPO-02 in REQUIREMENTS.md auf Complete gesetzt (0 Rest site-weit, 96 Dateien); TYPO-03 bleibt Pending -- die breitere Schluss-Sichtrunde (WINDOWS.md id 5) steht noch aus, die engere bereits abgenommene Pruefung (WINDOWS.md id 3) bleibt unangetastet. Phase 2 technisch fertig (7/7 Plaene), NICHT "Complete" markiert, solange die Sichtrunde aussteht
- [Phase ?]: [Phase 3]: 03-01: body::after maskiert (linear-gradient an --maxw, Feder AUSSERHALB der Spalte) statt gedimmt -- --ambient-opacity bleibt 0.5/0.4 (D-01 begrenzt, daempft nicht)
- [Phase ?]: [Phase 3]: 03-01: .reveal-IntersectionObserver auf threshold:0 (D-03) -- 21 defensive !important-Overrides bleiben bewusst stehen, Plan 03 traegt sie ab
- [Phase ?]: [Phase 3]: 03-01: verify-layers.mjs rechnet Kontrast aus echtem Bildpunkt (sharp) + Scrim + Zeilenraster (compositeOver/flattenStack) statt zwei CSS-Tokens zu vergleichen -- Dunkelmodus 7.50:1 vorher -> 18.22:1 nachher am Hero-Fliesstext, negativkontrolliert (Tor faellt nachweislich bei gestoerter Maske)
- [Phase ?]: [Phase 3]: 03-02: alle acht Medien-Archetypen des geteilten Systems tragen jetzt ihr Zeilenraster (::before, z-index:1); .gtile figcaption/.zoomic brauchten z-index:2 (Rule 1, sonst waere Raster ueber der Bildunterschrift gelandet); .sstep undurchsichtig ohne JS (D-02), Betriebsmarke data-sstep-live ausschliesslich von detail.js gesetzt, prefers-reduced-motion fuehrt jetzt auch .sstep/.sstep .sn
- [Phase ?]: [Phase 3]: 03-03: assets/archive.js revealIO/nodeIO auf threshold:0 (D-05, wie assets/detail.js nach Plan 01) -- archive.css unangetastet, beide genannten Fundstellen bereits korrekt
- [Phase ?]: [Phase 3]: 03-03: 21 defensive .reveal-Notregeln entfernt (D-03), 21 -> 0 belegt, 8/8 DE/EN-Paare symmetrisch; zwei Rule-1-Bugs durch eigene Aenderung gefunden+behoben (verify-layers.mjs revealIO-Beobachtungswert, PilotPage.astro </style> nach vorbestehendem eingebettetem \r wiederhergestellt)
- [Phase ?]: [Phase 3]: 03-04: alle 19 Patch-Koerper per migrate-layers.mjs (Volltext-Ersatz statt zeilenweise, Lehre aus 03-03) auf den Stand des geteilten Systems gehoben -- 19 body::after maskiert, 87 Rasterregeln (hero=19,shot=19,tile.img=19,video=17,ship=13), 19 Beobachter geheilt; alle Soll-Zahlen trafen exakt ein (0 Abbrueche), animation:133/transition:160 unveraendert; verify-layers.mjs Zusicherung 1+3 fuer Patch-Kopien von Beobachtungswert auf scharf umgestellt, neuer --patches-Vorablauf; LAYER-01 komplett abgetragen
- [Phase ?]: [Phase 3]: 03-05: scripts/lib/layer-registry.mjs (neu) fuehrt 25 Registry-Eintraege (A1-A10, B1-B6 ueber alle 19 Patch-Koerper, C1-C3, D1-D5) vollstaendig auf; verify-layers.mjs Zusicherung 5 (Vollstaendigkeitswaechter gegen den gebauten Stand) fand beim ersten Lauf 18 vorher unbekannte Selektor-Familien site-weit, 5 davon echte Text-auf-Foto-Stellen (Item Finder, Ships Overview, Startseite, eine Themenseite, ein Patch-eigenes Video) -- als D1-D5 aufgenommen statt uebergangen
- [Phase ?]: [Phase 3]: 03-05: Leitbefund aus 03-01 behoben -- Hero-Fliesstext hell 2,93:1 -> 18,34:1 durch verschobenen Verlauf-Stopp (Plateau 55%-90% statt sofortiger Interpolation Richtung --bg), --ambient-opacity unveraendert 0.5/0.4, Palette unangetastet; woertlich derselbe Fix in allen 19 Patch-Koerpern (.hero__photo::after + .shot::after)
- [Phase ?]: [Phase 3]: 03-05: zwei eigenstaendige Rule-1-Kontrastbugs gefunden+behoben (.fcard auf Themenseite 4-0-1 nutzte Flaechen- statt Medien-Tokens; ShipsOverview.astro .sdb__sub trug eine fixe Farbe mit falschem generiertem Hellmodus-Override); 344 Einzelmessungen insgesamt, 0 unter der WCAG-AA-Marke; verify:layers haengt jetzt im Dockerfile-Tor nach verify:typo; LAYER-01/LAYER-02 komplett; Sichtrunde als WINDOWS.md id 6 an den Betreiber uebergeben, Phase 3 technisch fertig (5/5 Plaene), NICHT "Complete" solange id 6 offen ist
- [Phase ?]: [Phase 4]: 04-01: verify:sync — Struktur-Fingerabdruck (tag.class, Autorenreihenfolge, ohne Sortieren/Tiefe) ueber alle 8.678 gebauten EN/DE-Paare; X-langsw-order als per-Instanz-Mengenvergleich statt Seitenausschluss (Bruch C der Negativkontrolle belegt die Enge)
- [Phase ?]: [Phase 4]: 04-01: Erstbefund 81 unerklaerter Rest (78 Item-Beschreibung, 2 Onepager, 1 Impressum-MStV) exakt wie von 04-RESEARCH.md vorhergesagt; die vier diff=4-Verdachtspaare bestaetigt ein Messartefakt der Recherche-Sonde, kein fuenftes Muster. verify:sync bewusst noch NICHT im Dockerfile (D-03: erst beheben in Plan 02, dann scharf in Plan 03)
- [Phase ?]: [Phase 4]: 04-01: REQUIREMENTS.md SYNC-01/SYNC-02/THEME-02 bewusst NICHT auf Complete gesetzt -- verify:sync existiert und misst, aber der Erstbefund ist noch offen (81 Paare) und das Tor haengt noch nicht scharf im Dockerfile (D-03); Praezedenz aus Phase 2 (TYPO-01/02 erst im letzten Plan abgehakt)
- [Phase ?]: [Phase 4]: 04-02: D-05 vollzogen -- description() in src/lib/items.ts liefert null unabhaengig von lang, wenn g.desc fehlt (79 Items ohne englische Quelle, 78 mit eigener Detailseite); descDe gilt als Uebersetzung eines vorhandenen desc, nicht als eigene Quelle. Zwei benannte cut-region-Ausnahmen (X-onepager-de-only, X-impressum-mstv) fuer die verbleibenden quellbelegten Abweichungen, neue Zusicherung 5 (Zombie-Waechter) in verify-sync.mjs. node scripts/verify-sync.mjs meldet jetzt 0 unerklaerte Abweichungen ueber alle 8678 Paare, Exit 0 -- Handover-Bedingung fuer Plan 03 (D-03 "erst beheben, dann scharf" vollzogen) erfuellt. Unbelegte Drift (p.muted nur auf der EN-Impressum-Seite) behoben statt ausgenommen (Gegenstueck in src/pages/de/impressum.astro ergaenzt). verify-fx/help/typo-motion.mjs beziehen die Paarung jetzt aus scripts/lib/page-pairs.mjs; dabei fehlende "< 60"-Untergrenze in verify-help.mjs nachgezogen (echter Befund beim vorgeschriebenen Vorher-Vergleich, macht die Zusicherung staerker). SYNC-02 in REQUIREMENTS.md auf Complete gesetzt.
- [Phase ?]: [Phase 4]: 04-03: verify:theme-gen.mjs (npm run verify:theme) — die echten Generatoren gegen eine Ablagekopie unter os.tmpdir(), nie gegen den Arbeitsbaum. Der vorgeschriebene echte Lauf deckte zwei vorbestehende Bugs in build-light-overrides.mjs auf (stripTrailingRootRules loeschte einen gueltigen generierten Block, topLevelRules zerbrach an einem Kommentar mit literalen Klammern) -- beide behoben, plus ein Schutz gegen doppelte Wahrheiten (keine automatische Hell-Entsprechung fuer Selektoren mit bereits handgeschriebenem Gegenstueck). PilotPage.astro/ProfileCard.astro von den dadurch entstandenen Duplikaten bereinigt. ShipsOverview.astro's vorbestehende, echte Luecke (.fcard__status.fr) als benannte EXCLUSIONS-Ausnahme gehalten, nicht nachgezogen -- WINDOWS.md id 7. assets/theme.css Kopfangabe richtiggestellt (Marke HANDGEPFLEGT). Beide Tore (verify:sync, verify:theme) jetzt blockierend im Dockerfile; alle neun Tore auf dem committeten Stand gruen. SYNC-01/SYNC-02/THEME-02 auf Complete. Sichtprobe an WINDOWS.md id 8 uebergeben -- Phase 4 bleibt 'In Progress'.
- [Phase ?]: Umbenennen als EIN PATCH auf (user_id,name) statt POST+DELETE — atomar, ein Fehlerfall (409)
- [Phase ?]: Loeschen-Rueckfrage als eigener Inline-Zustand statt window.confirm() — zwei Klicks, zweiter traegt Worte
- [Phase ?]: Einzeleintrag entfernen ohne preApply() — Ansehen/Ausduennen aendern nie den Arbeitsstand
- [Phase ?]: 10-02: Reiterleiste ersatzlos entfernt statt umgebaut -- beide Listen wurden ohnehin bei jedem renderAll() gezeichnet, der Reiter blendete nur eine aus
- [Phase ?]: 10-02: Rastermass 470px 1fr 330px wie im Plan vorentschieden uebernommen (Claude's Discretion aus CONTEXT.md)
- [Phase ?]: 10-02: mining.ctl.pins wird zum Nachschlagewerk-Text, mining.ctl.presets nennt die vier Preset-Handlungen aus 10-01; scripts/verify-help.mjs bewusst nicht angefasst
- [Phase ?]: 12-01: [data-ore]-Klick in der Fundort-Ansicht bewusst unverdrahtet -- Markup-Vorbereitung (data-ore/role/tabindex) fuer Welle 2/3, Objective weist diesen Ein-/Ausstieg dort explizit zu
- [Phase ?]: 12-01: T-12-04 auf gruppenlokale statt globale Chance-Monotonie korrigiert -- Sortieren-dann-Gruppieren (Schiff->ROC->Hand) macht die Gesamtliste nicht monoton, nur jede Methodengruppe fuer sich; Implementierung folgt dem detaillierten Handlungstext
- [Phase ?]: 12-02: hereIdx-Berechnung an S.view === 'loc' gebunden, nicht nur an S.selLoc -- ein direkter Kachelklick waehrend die Fundort-Ansicht offen ist setzt S.view sofort zurueck, laesst S.selLoc aber stehen; ohne die View-Bedingung bliebe is-here faelschlich aktiv
- [Phase ?]: 12-02: mining-dom.js fire(el, type, init) um optionalen dritten Parameter erweitert (Rule 3) -- reicht Event-Felder wie key an den delegierten keydown-Handler durch, sonst war Enter/Leertaste im node:vm-Fixture nicht pruefbar
- [Phase ?]: 12-03: ?fundort=<Name> als zweiter Deep-Link-Zweig (fromQueryLoc), dieselbe Bauform wie der bestehende ?mineral=-Zweig -- Allow-List-Abgleich gegen locIndex, kanonischer Schluessel statt gelesenem Wert, kein Treffer heisst nichts tun. Reversibilitaet "costly" gekennzeichnet, nicht gegattert (Plan-Vorgabe)
- [Phase ?]: 12-03: mining.ctl.locpin/mining.ctl.shortlist (DE+EN) inhaltlich korrigiert -- verify:help prueft nur Ankerpraesenz, nie den Text; Gegenlesen war Pflicht
- [Phase ?]: 12-03: neue Messsonde scripts/probes/mining-locview-messung.mjs (ausserhalb der Torkette) fand zwei echte, vorher unentdeckte Maengel: Spurenzeilen-Kontrast bei 62%/65% lag real bei bis zu 1,33:1 (Marke 4,5:1) -- auf gemessene 82%/90% angehoben; Spurenzeilen mit Abzeichen waren 1,6px hoeher als gewoehnliche Zeilen (geerbtes .wb__tag hoeher als eine .p-Zeile, erstmals sichtbar weil Phase 12 beide erstmals in derselben Flex-Zeile platziert) -- behoben mit line-height:1 auf die neue Klasse .wb__tag.is-trace. Sonde einmal vorgefuehrt rot (Daempfung testweise 20%, 4/24 Punkte fielen durch), dann zurueckgesetzt
- [Phase ?]: 12-03: Backstop "Bildlaufleiste sichtbar" liess sich NICHT ueber offsetWidth-clientWidth messen (Plan-Vorschlag) -- dieses Chromium rendert scrollbar-width:thin als echten Overlay (0px reservierte Breite trotz echten Ueberlaufs); auf tatsaechliche Scroll-Wirkung (scrollTop verschiebt sichtbaren Inhalt) umgestellt
- [Phase ?]: 12-03: npm install (ohne Argument) im Worktree ausgefuehrt, weil playwright-core in node_modules fehlte (weder Worktree noch Hauptrepo) -- reconciliert ausschliesslich aus dem committeten package-lock.json, package.json/package-lock.json vor/nach dem Lauf unveraendert (git status leer). Kein Fall des ausgeschlossenen "npm install <pkg>"-Musters
- [Phase ?]: 12-03: Phase 12 technisch fertig (3/3 Plaene), NICHT "Complete" markiert -- Sichtrunde als WINDOWS.md id 12 an den Betreiber uebergeben, deckt inhaltlich auch die noch offenen id 10 (Phase 9) und id 11 (Phase 10) mit ab
- [Phase 14]: 14-01: verify:shipcard registriert mit disabled statt scharf -- beurteilt den Zielzustand der Phase, ist bis 14-04-PLAN.md zwangslaeufig rot (Praezedenz verify:sync)
- [Phase 14]: 14-01: Ausgangsmessung lief gegen npm run preview auf Port 4322 statt 4321 -- 4321 war von einem laufenden astro-dev-Server belegt
- [Phase 14]: 14-01: document.fonts.ready vor jeder Bildpunkt-Messung ergaenzt -- ohne diese Wartestelle schwankte die Carrack-Seitenhoehe je nach Font-Swap-Zeitpunkt um bis zu 150 px zwischen zwei Laeufen derselben Seite
- [Phase 14]: 14-02: Rahmen der Sprungleisten-Pillen als box-shadow:inset statt border gesetzt (kostet bei auto-Hoehe 0px Layout) -- noetig, weil das gemessene Hoehenbudget bei 1280x720 nur 34px betraegt, nicht die geschaetzten ~90px
- [Phase ?]: Kein Kapitel-Icon fuer Ausstattung/Umfeld — keine natuerliche Vorlage, UI-SPEC fuehrt keine neuen Icons ein
- [Phase ?]: verify-shipcard.mjs Ausnahme-Pruefung auf Unterabschnitts-Ebene erweitert (war seit Welle 1 dokumentiert, aber nicht implementiert) — noetig fuer zwei neue benannte Ausnahmen
- [Phase 14]: 14-04: Grundriss-Raster (sd__dims) bleibt in der halbierten Ausstattung-Spalte zweispaltig, entgegen der in 14-04 Task 1 selbst vorweggenommenen Annahme -- Bewaffnung dominiert Zeile 1 ohnehin (turmgruppen-getrieben), zweispaltig ist 76px kuerzer und am Bild nicht gequetscht
- [Phase 14]: 14-04: auto-fit-Innenraster (sd__grid/sd__qgrid/sd__slots/sd__inscards) brachen in der halbierten Kapitelspalte in mehr Zeilen um als bei voller Breite -- gescopete kleinere Mindestbreiten (nur innerhalb .sd__ch2col) behoben, per Bildschirmfoto gegen Text-Ueberlauf geprueft
- [Phase 14]: 14-04: arm__sum bekam hyphens:auto + overflow-wrap:anywhere, weil eine reine Mindestbreiten-Verkleinerung "GEGENMASSNAHMEN" ueber die Zellgrenze laufen liess -- kontrollierter Wortumbruch statt Rohtext-Ueberlauf
- [Phase 14]: 14-04: Hoehen-Sperrklinke bleibt bei 4.200px stehen (nicht auf den gemessenen 4.179px abgesenkt) -- 21px Reserve gegen Rundungsschwankungen zwischen Laeufen
- [Phase 14]: 14-04: verify:shipcard scharf geschaltet (Aussetzungsgrund entfernt) -- 0 Befunde, npm run gate laeuft 19 statt 18 Schritte gruen, normal UND STAGING=1
- [Phase 14]: 14-04: Phase 14 technisch vollstaendig (4/4 Plaene), NICHT "Complete" markiert -- 7 offene Sichtrunden-Punkte (WINDOWS.md id 14-20) warten auf den Betreiber
- [Phase ?]: Docker laeuft auf dem Entwicklungsrechner nicht (com.docker.service braucht Administratorrechte) — beide Plan-Verifikationen (njs-Machbarkeit, E2E-Weg) liefen stattdessen in GitHub Actions gegen das echte Artefakt, vom Betreiber ausdruecklich gebilligt (Grundsatz 7)
- [Phase ?]: js_fetch_trusted_certificate (nicht ssl_trusted_certificate) ist die richtige Direktive fuer ngx.fetch()-TLS-Verifikation in njs — der server{}-Block hat keinen eigenen SSL-Kontext
- [Phase ?]: Login mit einem echten E-Mail/Passwort-Testkonto auf gate.html bleibt eine manuelle Pruefung — kein Supabase-Testkonto als Repo-Secret angelegt (Vorsicht vor spekulativen Credentials)
- [Phase ?]: Strukturbefund fuer 15-08/15-09/15-12: jede Pruefung gegen einen laufenden Container ist auf diesem Rechner nur per CI-Sonde moeglich, nie lokal
- [Phase ?]: [Phase 15]: 15-02: sync_discord_identity() faengt unique_violation auf discord_user_id (nicht user_id) ab und ersetzt sie durch eine sprechende Meldung (Kandidat a); foreign_key_violation/others werfen nur noch WARNING -- ein Spiegel-Eintrag ist nie wichtiger als eine funktionierende Anmeldung
- [Phase ?]: [Phase 15]: 15-02: public_profiles wird gegen die JUENGSTE Migration gebaut (20260725110000_presence_two_signal.sql, presence-Spalte), nicht gegen ihre Urfassung -- is_tester ganz am Ende angehaengt
- [Phase ?]: [Phase 15]: 15-02: Migrationen dieses Projekts laufen ueber die Supabase Management API (apply_migration, Namen ohne Datei-Zeitstempel), NICHT ueber supabase db push -- der CLI-Weg ist strukturell kaputt (24 lebende Migrationen tragen andere Namen als die 11 Repo-Dateien)
- [Phase ?]: [Phase 15]: 15-10: Testpilot-Abzeichen-Farbe #ff5e1a von der Discord-Rolle uebernommen (C.craftOrange), nach dem RSI-Abzeichen gepusht; Hellmodus-Gegenstueck von Hand ergaenzt
- [Phase ?]: [Phase 15]: 15-10: Admin-Uebersicht (D-13) per direkter user_roles-Abfrage vor tester_overview() gegattert statt der is-admin-Klasse aus account-lite.js, das auf /account/-Seiten nicht laeuft
- [Phase ?]: [Phase 15]: 15-10: Namensnennung auf der Feedback-Seite statt Unterstuetzen-Seite verdrahtet (die sagt woertlich 'no perks in your account'); vier Sichtpruefungen (D1-D4) an Plan 12 uebergeben, WINDOWS.md-Eintrag scheiterte an vorbestehendem CRLF-Parserfehler
- [Phase ?]: [Phase 15]: 15-05: D-14 woertlich umgesetzt (nur Rollen-Kommentar geaendert, Objektzeile git-diff-unveraendert); D-15 vollstaendig inkl. zwei zusaetzlicher Fundstellen (start-here-Seed, Onboarding-Kopfkommentar); D-18 mit flight-computer-Mitsicht fuer den kuenftigen Deploy-Ping
- [Phase ?]: [Phase 15]: 15-05: Task 2 (Live-Anwendung) NICHT vom Executor ausgefuehrt -- Bash-Berechtigungsklassifikator blockierte node build.mjs zweimal hart; Betreiber hat den Lauf selbst gefahren, Vorher/Nachher-Gegenprobe per audit.mjs bestaetigt 0 Fehler/1 Warnung (unveraenderte #support-Warnung, plangemaess)
- [Phase ?]: [Phase 15]: 15-05: Navigators sehen #test-pilots nicht (woertlich korrekte D-18-Umsetzung, vermutlich nicht die Absicht) -- als offene Betreiberentscheidung in WINDOWS.md #15 dokumentiert, nicht eigenmaechtig geaendert
- [Phase ?]: [Phase 15]: 15-03: D-02-Riegel sitzt in public.handle_new_user() statt einem eigenen Trigger auf auth.users -- auth.users gehoert supabase_auth_admin, ein eigener Trigger scheiterte gemessen an ERROR 42501 (must be owner of relation). Betreiber hat nach Abwaegung von drei Wegen die Funktionserweiterung gewaehlt; Wirkung identisch zum Plan.
- [Phase ?]: [Phase 15]: 15-03: trg_sync_discord_identity aus Plan 02 ist jetzt real bestaetigt (T3-SQL-Gegenprobe setzt discord_role_state.discord_user_id) -- schliesst 15-02-SUMMARY.md coverage D6.
- [Phase ?]: AuthLogin.astro Discord-redirectTo zeigt auf die Login-Seite selbst statt auf /account/ -- Rule-1-Fix, sonst ginge die D-02-Absage im Dashboard-Redirect verloren
- [Phase ?]: D-02-Erkennung matcht zweigleisig (eigener Text ODER GoTrue-Generic-Wrapper) -- WINDOWS.md id 16 laesst offen, welche Form ankommt
- [Phase ?]: 15-06: Trockenlauf zeigt 0 aktuelle Traeger der Discord-Rolle Test Pilots (5 Mitglieder gesamt) -- Massenentzug aus D-16 waere aktuell ein No-Op, Checkpoint-Zustimmung trotzdem erforderlich vor --rolle-wirklich-entziehen
- [Phase ?]: 15-06: Betreiber vertagt D-16-Vollzug (18.08.2026) statt allen-entziehen/liste-kuerzen/nicht-entziehen -- vor dem Scharfschalten in 14-12 erneut node tester-dry-run.mjs fahren, dann entscheiden. Verdrahtet in WINDOWS.md #20. Trockenlauf-Ergebnis (5 Mitglieder, 0 Traeger) vom Betreiber unabhaengig bestaetigt
- [Phase ?]: [Phase 15]: 15-07: PostgREST-PATCH statt Upsert fuer den Rollenspiegel -- discord_role_state.user_id ist Primaerschluessel ohne Default und wird nur vom sync_discord_identity()-Trigger gesetzt; PATCH+Filter auf discord_user_id trifft nie daneben
- [Phase ?]: [Phase 15]: 15-07: audit.mjs/prune.mjs fordern jetzt selbst GatewayIntentBits.GuildMembers an und melden dessen Abwesenheit als Fund statt es als gewollten Zustand zu behandeln (vorher konnten beide Skripte das Fehlen gar nicht maschinell feststellen)
- [Phase ?]: [Phase 15]: 15-07: die vier live-Zustandswechsel-Nachweise (Rolle geben/nehmen/Austritt/Ausfallfall) sind NICHT gefahren -- brauchen einen mit dem neuen Code deployten Bot, Deploy war ausdruecklich nicht Teil dieses Plans; als WINDOWS.md ids 21/22 verdrahtet
- [Phase ?]: 15-08: mint() urteilt ueber gate_verdict() (Testpilot/Sperrliste/Admin/D-09 in einem Aufruf); Ausnahmeliste auf 7 gemessene GATE-AUSNAHME-Eintraege gebracht; stille Ausweis-Erneuerung in account-lite.js; CI-Sonde probe-gate-e2e.yml erweitert (nicht neu gebaut) -- alle Zusicherungen gruen (run 32133474158)
- [Phase ?]: D-21 XP-Bonus 50 (Skala aus config.mjs/leveling.mjs hergeleitet, im Kopfkommentar begruendet); Sperre ist Primaerschluessel bug_xp_threads(thread_id), nicht Code-Logik
- [Phase ?]: D-20 Quelle GitHub-Compare-API statt git log (Checkout ist flach); ein Embed statt zwei EN/DE (Betreffzeilen sind keine uebersetzbaren Redaktionstexte)
- [Phase ?]: verify-gate.mjs (Schiene A) friert die 7-Eintrag GATE-AUSNAHME-Liste ein; check-gate.mjs (Schiene C) misst die ausgelieferte Zugriffskontrolle -- zwei Prüfer, weil Schiene A nie einen HTTP-Status sehen kann
- [Phase ?]: Rauchtest-Bypass (X-VB-Gate-Bypass gegen VB_GATE_BYPASS) ist ein Prüfschlüssel, kein Dauerschlüssel: je CI-Lauf gewürfelt, nirgends gespeichert, voller Längenvergleich
- [Phase ?]: Docker lokal nicht verfügbar -- check-gate.mjs und der Bypass wurden gegen einen unabhängig implementierten node:http-Testwerkstand geprüft, echter Container-Nachweis steht in WINDOWS.md id 28 für Plan 12 offen
- [Phase ?]: Aufgabe 2 (staging-Ausrollen) bewusst nicht ausgefuehrt -- Coolify-Umgebungsvariablen unbestaetigt, kein Push
- [Phase ?]: WINDOWS.md: 15 scattered Phase-14-Sichtpunkte zu 9 ortsbezogenen Eintraegen konsolidiert (ids 15/20 unveraendert, 7 neue ids 29-35) statt fuenf weiterer Anhaenge

- [Phase ?]: [Phase 16]: 15-01: P-3=Variante C entschieden und gegen ausgeliefertes holodata gegengeprueft (908 Paare, 0 Abweichungen); P-1/P-2 fuer kompakte/mittlere Schiffe an allen sechs Breiten belegt, fuer stark elongierte Schiffe (Carrack, Ironclad) bei 860/414/360px bleibt eine gemessene Fuellgrad-Luecke -- als S-0 (WINDOWS.md id 21) an den Betreiber uebergeben, nicht eigenmaechtig per Kamera-Azimut geloest
- [Phase ?]: [Phase 16]: 15-02: verify:shipconsole angelegt (8 Zusicherungen), vorgefuehrt rot (454/454 Seiten ohne .holo__sys), ausgesetzt bis 15-05; verify:shipcard scannt jetzt auch section.holo und fand dabei einen echten Fund (.holo__dims dupliziert L/B/H) -- als X-holo-dims-hud-Ausnahme benannt statt versteckt
- [Phase ?]: 15-03: D-02 mit abgeschaltetem JavaScript bewiesen -- vier Systemabschnitte serverseitig, Rail als Ankerliste, Bewaffnung/Bauteilliste vollstaendig in die Konsole gewandert, Textbestand gewachsen (min 3177->3242 Bytes)
- [Phase ?]: 15-05: Vier 1280px-Kollisionen (Hero-Chrome ohne grid-column spannte den gesamten Konsolen-Bereich) vor der Torschaerfung behoben; verify:shipconsole scharf; Hoehenklinke haelt trotz Konsole weit unter der Marke; ein neuer Kontrastfund (Rail-Gruppe Antrieb, dunkler Modus) behoben statt uebergeben
- [Phase ?]: Phase 18 Plan 01: Sperrklinke missionenMitOrt auf gemessenem Wert 600 (nicht ROADMAP-Zielwert 800) -- Ortskante erreicht 609/1347 Familien, dritte reale Datenquelle ausgeschoepft, Betreiber-Entscheidung zum Zielwert offen (siehe WINDOWS.md)
- [Phase ?]: Phase 18 Plan 02: E-1 (vierte Ortsquelle, ContractPrerequisite_Locality.localityAvailable inkl. subContracts-Ebene) hebt Familien mit Ortsangabe 609 -> 1180/1347, ueber dem ROADMAP-Zielwert 800
- [Phase ?]: Phase 18 Plan 02: E-3-Langschwanz ueber Spiel-eigenes StarMapObject.name geloest statt einer zweiten kuratierten Tabelle -- deckt Monde, Lagrange-Punkte, Rest Stops und Gefaengniskolonie mit echten Spielnamen ab
- [Phase ?]: Phase 18 Plan 03: alle sechs maschinell erzeugten Datenstaende nennen jetzt CL 12344265 (D-04) — universal-items.json gameVersion neu, dismantling-items.meta.json + wikelo-trades.meta.json als Begleitdateien statt Huelle, refinery-data.json nachgezogen
- [Phase 14]: Rot-Vorfuehrung D (Verzug ueber Toleranz) durch Anheben statt Absenken einer Changelist umgesetzt — bei identischen Klinken-/juengste-CL-Werten war das der einzige Weg, Zusicherung 4 und 5 sauber zu trennen
- [Phase 14]: Checksummen-Methode auf git hash-object umgestellt, nachdem die anfaengliche eigene sha1-Batch-Schleife bei 2 von 7 Dateien einen fehlerhaften vorher-Wert lieferte (vermutlich Windows fork/cygheap-Fehler)

### Pending Todos

None yet.

### Blockers/Concerns

- Class A aus CONCERNS.md: 67 EN/DE-Seitenpaare pflegen Kopf, Palette, Inline-Style und Prosa von Hand doppelt; nichts im Build vergleicht sie. Jede Änderung an Startseite oder Layout muss beide Fassungen gleichzeitig treffen. Phase 4 baut den Nachweis dafür.
- Generierte `:root[data-theme="light"]`-Blöcke: Handänderungen verwirft `npm run theme` stillschweigend.
- GSD-Subagenten (`gsd-planner`, `gsd-executor`, …) liegen in `~/.claude/agents/`, waren in der Init-Sitzung aber noch nicht in der Agenten-Registry. Nach einem Neustart von Claude Code stehen sie zur Verfügung. Phase 1 lief deshalb inline.
- Vorbestehend, nicht aus Phase 1: der Astro-Dev-Server bricht bei `src/layouts/Layout.astro` mit `Unexpected ")"` in einem Inline-Skript ab. Der Produktionsbuild ist nicht betroffen — die Sichtprüfung lief deshalb gegen das gebaute `dist/`.
- Reduzierte Bewegung ist in Phase 1 aus dem Code abgeleitet, nicht im Browser gemessen: der Prüfbrowser meldet `prefers-reduced-motion: false` und bietet keine Emulation.
- ~~14-05 Task 2: discord/.env fehlte im Worktree~~ — behoben: Betreiber hat Token bereitgestellt und `node build.mjs` selbst gefahren (Bash-Berechtigungsklassifikator blockierte den Ausfuehrungs-Agenten zweimal hart, korrekt nicht umgangen). Vorher/Nachher-Gegenprobe per `audit.mjs`: 1 Fehler/2 Warnungen -> 0 Fehler/1 Warnung (verbleibende Warnung ist der vorbestehende, plangemaess unberuehrte #support-Kanal). Plan 14-05 vollstaendig, siehe 14-05-SUMMARY.md.
- Offen (nicht blockierend): Navigators sehen den neuen Kanal #test-pilots nicht -- woertlich korrekte D-18-Umsetzung, vermutlich nicht die Absicht. Betreiberentscheidung ausstehend, siehe WINDOWS.md #15.
- 14-02: drei Verhaltens-Zusicherungen (guard_is_tester Schreibsperre, anon darf gate_verdict() nicht ausfuehren, doppelte Discord-Kopplung liefert sprechende Meldung) sind gegen die lebende Anlage NICHT geprueft -- brauchen eine echte Sitzung/echte Konten, fuer die Sichtrunde des Betreibers vorgesehen (14-02-SUMMARY.md coverage D4-D6)
- Plan 14-03 Aufgabe 2 [BLOCKING]: kein SUPABASE_ACCESS_TOKEN/Supabase-CLI in dieser Ausfuehrungssitzung verfuegbar -- der gefaehrlichste Riegel der Phase (BEFORE INSERT auf auth.users, D-02) liegt geschrieben und Schiene-A-gepruefft (18/18) im Repo (Commit abda325), ist aber NICHT auf die lebende Anlage angewandt. Braucht Koordinator/Betreiber: Management-API-Anwendung + vorgefuehrt-roter Nachweis in 3 SQL-Faellen (Discord blockt / E-Mail geht durch / linkIdentity geht durch), je in einer zurueckgerollten Transaktion, plus vier echte Browser-Anmeldevorgaenge auf verse-base.com/account/ (LIVE) als Sichtpunkt fuer WINDOWS.md.
- 14-12 Aufgabe 2 (staging-Ausrollen) blockiert: fuenf Coolify-Umgebungsvariablen unbestaetigt (VB_GATE_SECRET/VB_SUPABASE_URL/VB_SUPABASE_ANON_KEY am Vorschau-Container, SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY am Bot-Container). Vor dem Push zusaetzlich node discord/tester-dry-run.mjs neu fahren (D-16).

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260802-3fw | Zurück-Button site-weit (SiteNav leitet ihn aus `crumbs` ab; `--nav-h` löst die verdrahteten 68px in drei Filterleisten ab) | 2026-08-02 | b12a3b5, 03ead2d | | [260802-3fw-zurueck-button-site-weit](./quick/260802-3fw-zurueck-button-site-weit/) |
| 260802-5qd | Zurück folgt der tatsächlichen Herkunft (Herkunfts-Notiz + parser-blockierender Leser; crafting→Material→zurück behält Suche und Scroll) | 2026-08-02 | d66dbb6, 9e0133a | | [260802-5qd-zurueck-folgt-der-herkunft](./quick/260802-5qd-zurueck-folgt-der-herkunft/) |
| 260802-7eb | UEX-Durchschnittspreis-Spalte für Items (DE+EN) — vierte Ø-Spalte in Datenblatt, Kategorie-Liste und Finder-Modal; Mittelwert über alle Verkaufsorte aus `obtain[]`, ohne API-/Pipeline-Änderung | 2026-08-02 | aa391d8, bcc99b7 | Verified | [260802-7eb-uex-durchschnittspreis-spalte-fuer-items](./quick/260802-7eb-uex-durchschnittspreis-spalte-fuer-items/) |
| 260802-7f5 | Item-Finder als Werkzeug: Suche und Filter ohne Scrollen direkt unter dem Titel (DE+EN) | 2026-08-02 | 8001901 | Verified | [260802-7f5-item-finder-als-werkzeug-suche-und-filte](./quick/260802-7f5-item-finder-als-werkzeug-suche-und-filte/) |
| 260802-ose | Größenachse (CIG-Hangarklasse 1-6, `AttachDef.Size`) als dritte Filterachse neben Beruf/Rolle; Boden/Raum-Merkmal bewusst NICHT auf `AttachDef.SubType` umgestellt (verliert 10 Schweberäder gegenüber dem bestehenden Merkmal) | 2026-08-02 | 3ecddb4, bf05687, 330c29a, 85ebd90 | | [260802-ose-groessenachse-boden-raum](./quick/260802-ose-groessenachse-boden-raum/) |
| 260807-sso | Ergebnislisten mit eigenem Bildlauf (`.vb-scrollbox`): Rad über der Liste bewegt die Liste, daneben die Seite; Filterspalte des Item Finders erstmals bis zur letzten Kategorie erreichbar; 5 seit jeher unsichtbare Bildlaufleisten mitbehoben | 2026-08-07 | a05176a, 7a6824e, 3b28e29, e8fd093, 9ce50d3, 145a9b6, ffd8eea | Verified | [20260807-tabellen-eigener-bildlauf](./quick/20260807-tabellen-eigener-bildlauf/) |

### Roadmap Evolution

- Phase 19 added (23.08.2026): Der Ortskatalog traegt bis in die Chips. Entstanden aus der Betreiber-Abnahme von Phase 18 (`WINDOWS.md` id 45-48) — **alle sieben Befunde stammen aus dem Hinsehen, keiner aus einem Tor.** Kein Pruefskript des Projekts sieht Listenmarken, Doubletten in einer Chipreihe oder ein englisches Bindewort im deutschen Filter. Drei der sieben Punkte haben EINE Ursache: `MissionDetail.astro:246` rendert die Chipliste aus dem rohen `m.places`, Zeile 361 die Angebotstabelle ebenso, waehrend Phase 18 nur `localityNames` (Zeile 228) und den Filter kuratiert hat — die Arbeit wurde an zwei von vier Stellen getan. Daraus D-01 (Chipliste zeigt kuratierte Namen; ⚠ `HUR L1` ist nicht falsch, nur falsch geschrieben — im Spiel `HUR-L1` mit Bindestrich, der Unterstrich der Rohform wurde zu einem Leerzeichen statt zu einem Bindestrich), D-02 (Region A-D tragen 452 Missionen und sagen nichts; aus ihren `places` benennbar), D-03 (unter der Filterbeschriftung „Region" stehen vier einzelne Stationen; dazu fuenf Rohbezeichner und drei Eintraege mit englischem „And"), D-04 (die Tabelle „Appears in game as" zieht aus `titleVariants` und blieb bei der Beschriftungsumstellung aussen vor — beide Schreibweisen derselben Marke auf einer Seite). **Zwei Zusicherungen aus Phase 18 wurden dabei widerlegt:** „0 Rohbezeichner im Ortskatalog" traf nicht zu (es sind fuenf — die Pruefregex suchte nach outpost/scrp/otlw und war zu eng), und die Annahme in Ledger id 43, die Blende des Holo-Viewers sei deckend, ist falsch (`rgba(0,0,0,0)`; undurchsichtig sind nur die Reiter-Pillen, weshalb der Befund von der Fensterbreite abhaengt). Bereits vorab behoben, weil die Wirkung sonst mit Phase 18 live gegangen waere: die `.md__tags`-Listen trugen ihre Listenmarken sichtbar mit (`ul` mit `display:flex` ohne `list-style`-Ruecksetzung) — vor Phase 18 auf 43 Seiten, danach auf 1.180 mit bis zu 40 Chips je Seite (`7a0ab58`).
- Phase 18 added (23.08.2026): Missionen wissen, wo sie spielen. Anlass war eine Zuschrift, die VerseBase nicht als „noch eine Datenbank" beschreibt, sondern als Explorer fuer die inneren Zusammenhaenge des Spiels — entlang der Kette Mission → Auftraggeber → Voraussetzung → Belohnungstopf → Bauplan → Gegenstand → Zutat → Fundort. Die Messsitzung ergab, dass diese Kette im Bestand fast vollstaendig geschlossen ist: 335 Missionen ↔ 335 Bauplan-Rueckverweise, sauber ueber `slug`, in BEIDE Richtungen; 34 von 37 Bauplan-Zutaten haben einen Fundort; 712 Missionen tragen eine Rangvoraussetzung. Es fehlt kein Datensatz, es fehlt das Durchreichen — drei belegte Befunde gegen die installierte 4.9.0 (CL 12344265): (1) `MissionBrokerEntry` fuehrt ZWEI Ortsfelder, der Erzeuger liest nur `localityAvailable` (407 gefuellt) und nicht `locationMissionAvailable` (**1836** gefuellt), das auf denselben `StarMapObject`-Knoten zeigt, den `datamine-missions.mjs:200` bereits einliest — daher heute nur 43 von 1347 Familien mit Ortsangabe; (2) `datamine-missions.mjs:244` normalisiert die Spieltexte mit `t.split('|').pop()` und wirft damit die Slot-Art weg: Spielort (1256x), Zielort (438x), Abholort (77x) und Lieferort (73x) werden ununterscheidbar `{Address}` (932x in `missions.json`), die Frachtroute ist nicht mehr rekonstruierbar; (3) `missions.json` stand auf CL 12326004 bei installierter CL 12344265 — rund 18.000 Changelists Verzug, aufgefallen NUR weil diese Datei ihre Kennung mitfuehrt, waehrend `universal-items.json`, `wikelo-trades.json`, `dismantling-items.json` und `refinery-data.json` gar keine fuehren. Ein Trockenlauf von `datamine:missions` gegen die aktuelle p4k ist gefahren und inhaltlich identisch (1347 Familien, 3756 Varianten, 335 mit Blueprints, dieselben 75 Platzhalter), nur die Kennung aktualisiert — der Lauf liegt im Stash, nicht committet. **Eine Vermutung wurde dabei kassiert:** die Annahme, der Platzhalter-Parser laufe gegen ein totes Format (`{...}` gegen `~mission(...)`), war falsch; der Erzeuger uebersetzt seit jeher korrekt, nur eben verlustbehaftet. Ausdruecklich als Sackgasse ausgeschlossen: `CraftingQualityLocationOverrideRecord` (12 Eintraege) sieht nach einer Ort↔Fertigung-Kante aus, fuehrt aber bei allen zwoelf einen leeren Verteilungssatz — unfertige Herstellerarbeit, keine Daten. Haengt an keiner Vorgaengerphase; die vom Geruest eingetragene Abhaengigkeit von Phase 17 ist ein Nummernfolge-Artefakt und wurde in der ROADMAP.md aufgehoben.
- Phase 14 added (17.08.2026): Testpilot-Zugang — staging hinter der Discord-Rolle. `staging.verse-base.com` ist heute fuer jeden offen; kuenftig kommt nur hinein, wer die Discord-Rolle „Test Pilots" traegt. Vier Betreiberentscheidungen VOR der Planung getroffen: Nicht-Tester sehen ausschliesslich eine Anmeldeseite (kein 403, kein blosses Banner); die Rolle wird vom Betreiber VON HAND vergeben und faellt dafuer aus dem Discord-Onboarding; Discord wird an das bestehende Supabase-Site-Konto gekoppelt statt einen zweiten Anmeldeweg nur am Tor zu bauen; alle vier Perks sind gewaehlt (Profil-Abzeichen, privater Kanal mit Deploy-Ping, XP-Bonus, Namensnennung). Drei Vorbefunde aus der Bestandsaufnahme, gegen den Bestand gemessen: die `tester`-Rolle EXISTIERT bereits (blueprint.mjs:143), ist aber im Onboarding selbst vergebbar (blueprint.mjs:402) und taugt so nicht als Tuersteher; die Site hat KEINEN OAuth-Provider und keine Bruecke zwischen Discord-Identitaet und Konto — die Kopplung ist Grundlage von Tor UND Abzeichen; staging ist statisches nginx-HTML hinter Cloudflare, ein Gate im Browser-JS waere per `curl` umgehbar, das Tor muss vor die Auslieferung. Architektur bewusst NICHT vorentschieden (Cloudflare Worker vs. nginx auth_request gegen den Bot vs. njs + Edge Function) — Aufgabe der Recherche. Haengt an keiner Vorgaengerphase; die vom Geruest eingetragene Abhaengigkeit von Phase 13 ist ein Nummernfolge-Artefakt und wurde in der ROADMAP.md ausdruecklich aufgehoben.
- Phase 12 added (15.08.2026): Fundorte in der Mining-Werkbank anklickbar. Die Werkbank kann bisher nur „wo finde ich DIESES Erz?"; die Gegenrichtung „was gibt es an DIESEM Ort?" fehlt, weil die Fundortzeilen tote Textzeilen sind (nur die Anheft-Nadel reagiert). Datengrundlage liegt seit der Fundort-Korrektur fertig und ungenutzt im Bestand: `mining-db.json` → `bodies[]`, 45 Fundorte mit vollstaendiger Erzliste, von `verify:mining` bereits gegen die Vorwaertsrichtung geprueft. Anlass: Betreiber-Hinweis mit scmdb als Vergleich. **Betreiberentscheidung: ausschliesslich Umschaltung in der Werkbank, KEINE eigenen Fundort-Seiten** (Alternative „45 x DE/EN statische Seiten" wurde vorgelegt und verworfen). Aus dem scmdb-Vergleich uebernommen: Gruppierung nach Methode, Signatur, Hoechstanteil, Chance, Balken. Bewusst NICHT uebernommen: Preise (scmdb zeigt dort selbst keine), Gruppenanteile (rechnen Salvage/Debris mit — Grundmenge fehlt uns, waere erfunden), Adernzahl (nicht in unseren Daten). Der scheinbare Datenbefund aus dem Vergleich (12 Erze gegen 7, Aluminium 29,8 % gegen 14,9 %) wurde nachgelesen und ist ein Definitionsunterschied, kein Fehler — haengt an keiner Vorgaengerphase ausser 10.
- Phase 9 added (15.08.2026): Mining-Werkbank — Fundort-Merkliste. Die mittlere Spalte wird neu belegt: die Detailspalte (Physik, Qualitaetsstufen, „Steine mit diesem Erz") entfaellt ersatzlos und wird spaeter anders dargestellt; die Fundorte-Liste rueckt an ihre Stelle; auf dem frei werdenden Platz entsteht eine anheftbare Merkliste „Erz — Fundort" ueber mehrere Erze hinweg, als benanntes Preset kontogebunden speicherbar (wie `mining_sig_presets`). Anlass: Nutzerwunsch waehrend der Arbeit an den Fundort-Daten (Phase-fremd, haengt an keiner Vorgaengerphase). Datengrundlage ist bereits da — seit 14.08. traegt jedes Mineral seine vollstaendige Fundortliste (521 Paare statt 273).
- Phase 01.1 inserted after Phase 1: Ambiente-Effekte stilllegen — Mauszeiger-Schein raus, Partikel opt-in (Besucher-Rueckmeldung 29.07.2026) (URGENT)
- Phase 01.2 inserted after Phase 1: Werkzeuge erklaeren — Zweck- und Bedienungshilfe je Werkzeug (Besucher-Rueckmeldung 29.07.2026) (URGENT)
- Phase 5 added (31.07.2026): Spenden-Unterstuetzung — Stripe Checkout + Ko-fi, eigene Seite, Ziel und Unterstuetzer-Wand (DON-01…DON-14). ERWEITERT den Meilenstein bewusst ueber die Oberflaeche hinaus (DB-Tabelle, zwei Edge Functions, Zahlungsverkehr); die „Out of Scope"-Zeilen zu serverseitiger Logik und Konto-Funktionen sind fuer diese Phase aufgehoben. Anlass: defektes Netzteil im Entwicklungsrechner, zufaellige Neustarts. Haengt an keiner Vorgaengerphase — Phase 1.1 bleibt geplant liegen und wird NICHT abgebrochen.
- Phase 6 added (02.08.2026): Schiffe — Rollen- und Merkmalsfilter. Granulare, spielgenaue Filter statt acht Wiki-Grobtypen; Datengrundlage neu aus dem DataCore. Beanspruchte zunaechst Nummer 5 und wurde beim staging-Abgleich auf 6 umnummeriert, weil Spenden-Unterstuetzung zuerst auf staging war. ABGESCHLOSSEN, Verifikation 10/10.
- Phase 7 added (03.08.2026): Komponenten-Filter fuer Schiffe — Filter nach Steckplatz-Groesse je Bauteilart, eigener Zweig `claude/gsd-ship-component-filter-f81262`. Beanspruchte zunaechst Nummer 5 und wurde beim staging-Abgleich auf 7 umnummeriert (5 = Spenden, 6 = Rollenfilter waren zuerst da). Vorab-Spike hat die Datenquelle belegt: `Scripts/Entities/Vehicles/Implementations/Xml/<SCHIFF>.xml` (CryXmlB) traegt je Part einen `ItemPort` mit `minSize`/`maxSize`/`Types`; der DataCore-Schiffsrecord fuehrt den Pfad dieser XML selbst als Dateiverweis, der Join braucht also kein Namensraten.
- Phase 7 Plan 1/3 ausgefuehrt (03.08.2026): CryXmlB-Leser + Datamine-Skript liefern 223/227 Schiffe ueber 7 von 8 Bauteilkategorien (Turm folgt in 07-02). Alle vier Hausgates gruen. Details: `.planning/phases/07-komponenten-filter-f-r-schiffe/07-01-SUMMARY.md`.
- Phase 7 Plan 2/3 ausgefuehrt (03.08.2026): Turm-Regel (D-06a, vom Nutzer im blockierenden Checkpoint auf reine `TurretBase`-Ablesung verschaerft) + achte Bauteilart. 47/223 Schiffe tragen `t`. Alle vier Hausgates gruen. Details: `07-02-SUMMARY.md`.
- Phase 7 Plan 3/3 ausgefuehrt (03.08.2026): Zweisprachigkeit + 26 automatisierte `node:vm`-Testfaelle (D-04/D-08/D-10/D-11/D-12). Alle vier Hausgates gruen, Sichtpruefung in beiden Sprachen/Farbmodi/360 px bestaetigt. Details: `07-03-SUMMARY.md`.
- Phase 7 auf staging ausgeliefert und dort abgenommen (03.08.2026, `bfae647`): auf https://staging.verse-base.com/schiffe.html und /de/schiffe.html im Browser bedient. Gemessen: "Waffe ab S5" = 36 Treffer · 4 ohne Steckplatz-Daten (deckt sich mit `ship-components.json`), "Turm ab S5" = 42 (Verteilung 4:5 5:12 6:25 7:2 8:1 10:2 — Haeufung bei S6 ist die uebliche bemannte Turmgroesse), zusammen mit dem Rollenfilter aus Phase 6 = 14. Alle vier Hausgates gruen auf dem committeten Stand (17351 Seiten, 816573 Verweise, 0 FEHLER, 151/151 Tests).
- Phase 7 mit staging zusammengefuehrt (03.08.2026): Phase 6 hatte die beiden Schiffsseiten inzwischen zu EINEM Koerper zusammengelegt. Der Filter wanderte deshalb aus den zwei Seiten in `components/ships/ShipsOverview.astro`; `sf-size` war dort bereits fuer die Schiffs-Groessenklasse vergeben, das Bauteil-Groessenfeld heisst darum `sf-compsize`. **Phase 7 damit abgeschlossen.**

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-23T18:47:25.113Z
Stopped at: Completed 18-04-PLAN.md -- Verzugstor vorgefuehrt rot (7 Demos), Schlussmessung aller acht Erfolgskriterien, vier Sichturteile in WINDOWS.md; Phase 18 technisch vollstaendig, Abschluss haengt an offener Sichtrunde

Last session: 2026-08-20T15:45:30.317Z
Stopped at: Completed 16-05-PLAN.md -- Phase 16 technisch vollstaendig (5/5), sieben offene Sichtrunden-Punkte
Resume file: None
