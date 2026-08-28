# Roadmap: VerseBase — UI-/Design-Feinschliff

## Overview

VerseBase ist gebaut, live und inhaltlich vollständig — dieser Meilenstein fasst
ausschließlich die Oberfläche an. Der Weg führt vom auffälligsten Einzelstück (die
Startseite begrüßt mit einer Überschrift, die beim Scrollen zur Kopfleiste wird) über
die Vereinheitlichung von Schrift und Bewegung zu den beiden Altlasten, die die
Codebase-Analyse benannt hat: dekorative Überlagerungen über Text und das
Auseinanderdriften der zweisprachigen Seitenpaare. Jede Phase liefert eine sichtbare,
abgeschlossene Verbesserung; keine Phase hinterlässt einen Halbzustand.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Wortmarken-Wandlung** - Hero-Überschrift oben mittig, scroll-verknüpfte Wandlung in die Kopfleiste
- [x] **Phase 1.1: Ambiente-Effekte stilllegen** (INSERTED) - Mauszeiger-Schein ersatzlos raus, Partikel nur noch auf ausdrücklichen Wunsch
- [x] **Phase 1.2: Werkzeuge erklären** (INSERTED) - Jedes Werkzeug sagt, wofür es da ist und wie man es bedient
- [ ] **Phase 1.3: Datenschicht aufraeumen** (INSERTED) - Reste alter Datenläufe raus, falsche Quellenangabe weg, Datenstand auf den laufenden Client
- [ ] **Phase 1.4: Fahrzeug-Katalog auf Spieldaten** (INSERTED) - Der Schiffskatalog kommt aus der eigenen Extraktion statt aus der Wiki-API
- [x] **Phase 2: Schrift- und Bewegungsskala** - Eine gemeinsame Skala für Schriftgrade und Übergänge statt seitenlokaler Einzelwerte
- [ ] **Phase 3: Überlagerungen entstapeln** - Class-B-Befund abtragen, Textkontrast über Bildmotiven belegen
- [ ] **Phase 4: Sprachparität absichern** - Deckungsgleichheit der Seitenpaare nachweisbar statt behauptet
- [x] **Phase 5: Spenden-Unterstützung** - Ein Unterstützen-Weg, der tatsächlich Geld annimmt: PayPal-Link, eigene Seite in der Richtung „Instandsetzung" (Ko-fi bei der Umstellung am 02.08. ersatzlos gestrichen)
- [x] **Phase 6: Schiffe: Rollen- und Merkmalsfilter** - Granulare, spielgenaue Filter statt acht Grobtypen
- [x] **Phase 7: Komponenten-Filter für Schiffe** - Schiffsliste filtert nach Steckplatz-Größe je Bauteilart
- [x] **Phase 8: Bauteil-Kennwerte auf den Crafting-Karten** - Größe, Grade und Ton stehen auf der Karte, nicht erst in der Detailansicht

## Phase Details

### Phase 1: Wortmarken-Wandlung

**Goal**: Die Startseite empfängt mit „VerseBase" oben mittig über dem Hero-Motiv; beim Runterscrollen wandert dieser Schriftzug stetig in die Kopfleiste und wird dort zur Wortmarke. Am Seitenanfang trägt die Kopfleiste keine Wortmarke.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: MARK-01, MARK-02, MARK-03, MARK-04, MARK-05, MARK-06, MARK-07, MARK-08, MOTN-01, MOTN-02, MOTN-03, MOTN-04, THEME-01
**Success Criteria** (what must be TRUE):

  1. Beim Aufruf der Startseite steht „VerseBase" oben mittig, und die Kopfleiste zeigt an dieser Stelle keinen Schriftzug
  2. Beim langsamen Scrollen bewegt sich der Schriftzug ohne sichtbaren Sprung oder Umschaltpunkt in die Kopfleiste und bleibt dort als Verweis auf die Startseite bedienbar
  3. Auf einer Unterseite ohne Hero ist die Kopfleisten-Wortmarke sofort da, genau wie vorher
  4. Bei aktiviertem `prefers-reduced-motion` bleiben Überschrift und Kopfleiste in jedem Scroll-Zustand lesbar und bedienbar, ohne die Wanderbewegung
  5. Deutsche und englische Startseite verhalten sich identisch, in beiden Farbmodi und bis hinunter auf 360 px Breite

**Plans**: 2 plans

Plans:

- [x] 01-01: Hero-Überschrift nach oben mittig, Kopfleisten-Wortmarke auf der Startseite am Seitenanfang zurückhalten — in beiden Sprachfassungen
- [x] 01-02: Scroll-verknüpfte Wandlung am bestehenden Listener, inklusive reduzierter Bewegung, Farbmodi und schmaler Ansichten

Beide Pläne liegen in einem Commit (`002e5a3`): 01-01 allein hinterliesse einen kaputten
Zustand — die Kopfleisten-Wortmarke wäre verborgen, ohne dass das JS aus 01-02 sie wieder
hereinholt.

### Phase 01.1: Ambiente-Effekte stilllegen (INSERTED)

**Goal**: Wer die Seite aufruft, bekommt eine ruhige Fläche: der Schein um den Mauszeiger ist ersatzlos verschwunden, und es läuft keine Partikel-Animation, solange sie niemand ausdrücklich einschaltet. Der Rechner des Besuchers arbeitet nicht mehr für Zierrat.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: FX-01, FX-02, FX-03, FX-04, FX-05, FX-06, FX-07, FX-08
**Success Criteria** (what must be TRUE):

  1. Auf keiner Seite folgt dem Mauszeiger noch ein Schein — das Element, die CSS-Regel und der `pointermove`-Listener, der `--mx`/`--my` schreibt, sind aus dem Bestand entfernt
  2. Beim ersten Aufruf einer Werkzeugseite startet keine `requestAnimationFrame`-Schleife für `#stars` oder `#embers`; im Leerlauf ist die Bildrate der Seite null
  3. Ein für alle Besucher erreichbarer Umschalter aktiviert die Partikel; die Wahl überdauert Seitenwechsel und Sitzung und gilt in beiden Sprachfassungen
  4. Das Abschalten beendet eine laufende Schleife sofort und ohne Neuladen — es bleibt kein eingefrorenes Standbild auf der Leinwand stehen
  5. `prefers-reduced-motion: reduce` schlägt weiterhin die gespeicherte Wahl
  6. Parallaxe, Ken Burns, Scanlines/Vignette und Scroll-Reveal sind unverändert; Holo-Viewer-Orbit und Konto-Bildzuschnitt (eigene `pointermove`-Nutzer) funktionieren wie zuvor

**Plans**: 2/3 plans executed

Plans:

- [x] 01.1-01-PLAN.md
- [x] 01.1-02-PLAN.md
- [ ] 01.1-03-PLAN.md

- [x] 01.1-01 (Welle 1): Schaltstelle end-to-end auf EINER Seite beweisen — Kopf-Flagge, Umschalter für alle Besucher, `#stars`/`#embers` in `assets/detail.js` gattern, im Browser gemessen, dazu ein automatisierter Nachweis für reduzierte Bewegung
- [ ] 01.1-02 (Welle 2): Die übrigen 40 Schleifen anhängen — Sternenfeld des Patch-Archivs plus 38 Patch-Seiten per überprüfbarem Codemod, Regen-und-Blitz-Ausnahme von Hand
- [ ] 01.1-03 (Welle 3): Mauszeiger-Schein aus 107 Dateien tilgen — Element, Regel und Listener — plus bleibendes Prüfskript für DE/EN-Gleichstand und eine Sichtprüferrunde

Hinweis: Die Tilgung des Scheins entfernt eine dekorative Deckkraftschicht, die
site-weit über allem lag (`z-index: 8800`). Phase 3 zählt genau solche Schichten —
deren Bestandsaufnahme muss NACH dieser Phase erhoben werden, sonst misst sie einen
Zustand, den es nicht mehr gibt.

### Phase 01.2: Werkzeuge erklären (INSERTED)

**Goal**: Wer ein Werkzeug zum ersten Mal öffnet, erfährt an Ort und Stelle, wofür es gut ist und wie man es bedient — ohne Vorwissen und ohne die Seite zu verlassen. Auch Spieler, die sich im Spiel schwertun, kommen damit durch.
**Mode:** mvp
**Depends on**: Phase 1.1
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07
**Success Criteria** (what must be TRUE):

  1. Jedes Werkzeug trägt einen aufklappbaren Abschnitt, der zuerst den Zweck nennt („wofür ist das?") und dann die Bedienung — nicht umgekehrt
  2. Ein Hilfe-Schalter erklärt auf der aktuellen Ansicht jedes bedienbare Element; die Erklärung steht am Element, nicht in einer Liste woanders
  3. Die Hilfe erreicht auch die client-seitig gerenderten Oberflächen (Item Finder, Crafting), nicht nur statisches Markup
  4. Alle Erklärungen liegen in DE und EN vollständig vor — keine Fassung fällt auf die andere Sprache zurück
  5. Die Hilfe ist per Tastatur zu öffnen, zu durchlaufen und mit Esc zu verlassen
  6. Solange niemand die Hilfe öffnet, kostet sie nichts: kein Nachladen, keine Schleife, kein spürbares Gewicht auf der Seite
  7. Abgedeckt sind elf Werkzeuge: Item Finder, Crafting, Mining, **Refinery-Finder** (Abschnitt 04 der Mining-Themenseite, frei zugänglich), **Refinery-Tracker** (`/refinery.html`, kontogebundener Auftrags-Tracker), Schiffe, Missionen, Precision Jump, Patch-Archiv, Wikelo's Emporium und Rüstungssets. Die beiden Refinerys sind getrennte Werkzeuge und werden nie bloß „Refinery" genannt

**Plans**: 5/5 plans executed

Plans:

- [x] 01.2-01-PLAN.md — Leitschuss: Hilfe-Mechanik end-to-end am Item Finder (Katalog ohne Sprachrückfall, ToolHelp-Bauteil, Stufe-2-Maschine, Prüfskript)
- [x] 01.2-02-PLAN.md — Crafting, Mining und Refinery-Finder anheften; zwei Hilfen auf einer Seite
- [x] 01.2-03-PLAN.md — Patch-Archiv, Missionen, Rüstungssets und Wikelo anheften; Platzierung ohne Filterleiste
- [x] 01.2-04-PLAN.md — Schiffe (seit Phase 6/7 EIN gemeinsamer Körper statt zweier Seitendateien) und Precision Jump anheften
- [x] 01.2-05-PLAN.md — Refinery-Tracker (kontogebunden) anheften; Phasen-Tor auf 11 von 11

⚠ **5/5 Pläne ausgeführt, Phase deshalb noch NICHT als „Complete" markiert.** `npm run
verify:help --complete` meldet 11 von 11 Werkzeugen und alle fünf Zusicherungen grün —
das ist die maschinelle Seite von DOC-01..07. Die im Plan 05 verlangte Sichtrunde (12
Punkte + Annahmen A2/A4, braucht ein angemeldetes Konto) ist an den Betreiber
zurückgegeben, siehe `.planning/phases/01.2-werkzeuge-erklaeren/01.2-05-SUMMARY.md`
und `.planning/WINDOWS.md` (Eintrag id 2).

### Phase 01.3: Datenschicht aufraeumen (INSERTED)

**Goal**: Die Datenschicht sagt überall die Wahrheit über sich selbst und schleppt keine Reste alter Datenläufe mehr mit. Wer eine Crafting-Seite aufruft, liest die richtige Quelle; wer den Fracturing-Rechner öffnet, sieht Gerätenamen statt Klassennamen; und die Zahlen der Seite stammen aus demselben Client-Build, der gerade installiert ist.
**Mode:** mvp
**Depends on**: Nothing (unabhängig vom UI-Strang; berührt Datenschicht statt Oberfläche)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09
**Success Criteria** (what must be TRUE):

  1. Keine ausgelieferte Seite nennt `sc-craft.tools` als Quelle — geprüft im gebauten `dist/`, nicht nur im Quelltext
  2. Die Laser-Auswahl des Fracturing-Rechners zeigt ausschließlich lesbare Gerätenamen
  3. `src/data/holo-markers.json` ist weg, `ShipDetail.astro` hat nur noch den Spielmesh-Pfad, und alle 227 Schiffe zeigen ihr Hologramm unverändert
  4. `src/data/crafting-blueprints.json` ist weg; keine Datei verweist mehr darauf
  5. Ein frischer Datamine-Lauf gegen den installierten Client (`12326004`) ist eingespielt; alle game-sourced Ausgaben tragen dieselbe Build-Kennung
  6. `npm run sync:items` ohne frische `global.ini` bricht mit klarer Meldung ab, statt den Katalog zu verkleinern
  7. `scripts/fetch-craft.mjs` kann `assets/crafting-db.json` nicht mehr überschreiben
  8. Die Fahrzeugpreise sind neu von UEX gezogen
  9. `MINING-DATENQUELLE.md`, `FAKTEN-AUDIT.md` und `.planning/codebase/STRUCTURE.md` stimmen mit dem Bestand überein
  10. `npm run verify:mining`, `npm run audit:csp` und `npm run test:e2e` laufen nicht schlechter als vorher

**Plans**: 3/3 plans executed

Plans:

- [x] 01.3-01-PLAN.md
- [x] 01.3-02-PLAN.md
- [x] 01.3-03-PLAN.md

- [x] 01.3-01 (Welle 1): Alles, was ohne die Spielinstallation zu reparieren ist — die vier falschen Quellenangaben samt bleibendem Nachweis im gebauten `dist/`, die 4.8-Marker-Datei mit Fallback-Zweig und Erzeuger raus (227/227 zeichenweise belegt), die verwaiste Blueprint-Datei raus, der konkurrierende Crafting-Schreiber geloescht und `sync:items` auf lauten Abbruch statt stillem Rueckfall
- [x] 01.3-02 (Welle 2): Erst die Extraktion, dann der Lauf — die beiden namenlosen S0-Laser fallen in `datamine-gear.mjs` aus der Auswahl statt erfunden benannt zu werden, ein Wachposten in `verify:mining` haelt Klassennamen kuenftig auf, danach der vollstaendige Datamine-Lauf gegen den installierten Client (`12326004`) mit Kennungs- und Schrumpfpruefung. Beginnt mit einem Entscheidungs-Checkpoint
- [x] 01.3-03 (Welle 3): UEX-Fahrzeugpreise lokal nachziehen, `MINING-DATENQUELLE.md`, `FAKTEN-AUDIT.md` und `STRUCTURE.md` auf den Bestand bringen, und die Abschlussmessung aller sechs Tore gegen die in Welle 1 aufgenommene Messlatte plus Sichtpruefung in DE und EN

Hinweis zur Reihenfolge: Der Datamine-Lauf (Kriterium 5) erneuert `assets/crafting-db.json`
mit — die Quellenangabe (Kriterium 1) muss danach noch stimmen. Und Phase 1.4 setzt auf
diesem Lauf auf: der Fahrzeug-Katalog soll nicht gegen einen Stand gebaut werden, den die
übrige Seite nicht teilt.

### Phase 01.4: Fahrzeug-Katalog auf Spieldaten (INSERTED)

**Goal**: Der Schiffskatalog kommt aus der eigenen `Data.p4k`-Extraktion statt aus der Star-Citizen-Wiki-API. Extern bleiben nur die fünf Felder, die in keiner Spieldatei stehen: Pledge-Preis, RSI-Link, die drei Abmessungen und die Bild-URL. Damit ist die Seite am Patch-Tag aktuell, statt auf die Wiki zu warten — und die englischen Schiffsbeschreibungen sind CIGs Originaltext statt einer Rückübersetzung aus dem Deutschen.
**Mode:** mvp
**Depends on**: Phase 1.3 (baut auf demselben Datamine-Stand auf)
**Requirements**: VEH-01, VEH-02, VEH-03, VEH-04, VEH-05, VEH-06, VEH-07, VEH-08
**Success Criteria** (what must be TRUE):

  1. Die vier Extraktor-Skripte liegen versioniert im Repo — nicht mehr unversioniert in einem Arbeitsverzeichnis
  2. `src/data/vehicle-external.json` trägt Pledge-Preis, RSI-Link, Abmessungen und Bild-URL; sonst nichts
  3. `node scripts/verify-vehicles.mjs` meldet für Name, Hersteller und Herstellercode 0 Abweichungen
  4. Für `crew`, `cargoSCU` und `shieldHp` ist je Fahrzeug belegt, welcher Wert gilt und warum — keine Abweichung bleibt unbeurteilt
  5. Der Spieldaten-Katalog führt 227 Fahrzeuge, inklusive der vier ATLS-Varianten
  6. Das Schiffs-Datenblatt zeigt in DE und EN dieselben Werte wie vor dem Tausch oder einen belegt besseren; die Beschreibungen kommen aus den Spieldateien
  7. `scripts/sync-vehicles.mjs` ist gelöscht und `.github/workflows/build.yml` ruft keinen Wiki-Sync mehr auf
  8. Ein Stichprobenvergleich am Datenblatt (Buccaneer, Carrack, Freelancer MAX, 315p) belegt die Werte gegen das Spiel

**Plans**: 5/5 plans executed

Plans:

- [x] 01.4-01-PLAN.md
- [x] 01.4-02-PLAN.md
- [x] 01.4-03-PLAN.md
- [x] 01.4-04-PLAN.md
- [x] 01.4-05-PLAN.md

- [x] 01.4-01 (Welle 1): Die Vorarbeit sichern und den Weg Data.p4k → Katalog → Vergleichstabelle in diesem Zweig einmal ganz durchlaufen — vier (in Wahrheit fünf, D-21) Skripte versioniert übernehmen, `verify:weapons` verdrahten und grün fahren, Zwischenstufe gitignoren, frischer Lauf gegen Changelist `12326004`. Danach die Feldmatrix: für jedes Feld, das die Seite aus dem Katalog liest, eine Herkunfts-Marke — und für die quellenlosen je eine Abbruchgrenze für den Suchdurchgang in Plan 02. Plus ein bleibender Deckungs-Wächter gegen stillen Feldverlust
- [x] 01.4-02 (Welle 2): Der Suchdurchgang (D-18) — für jedes der 15 quellenlosen Felder erst in den Spieldateien nachsehen, statt es einzufrieren: Schaden und Raketenzahl aus dem Loadout, Quantum- und Behälterwerte aus dem DataCore, Produktionszustand aus der p4k, Rollen aus `vehicleRole`/`vehicleCareer`. Ergebnisoffen, aber je Feld mit Abbruchgrenze; „nicht gefunden" wird aufgeschrieben, nicht geraten. Kein Join über Anzeigenamen
- [x] 01.4-03 (Welle 3): Die Fremddaten einfrieren — aber nur den in Plan 02 belegten Rest, plus `crewMax` (D-17) und die Bild-URL. Dazu die vier ATLS-Varianten zurückholen (223 → 227) und die Identitätsfelder in Ordnung bringen, bis `verify:vehicles` bei Name, Hersteller und Herstellercode auf null steht — jede der 15 Marken-Abweichungen (D-22) und der 40 Größenlabel-Abweichungen einzeln begründet
- [ ] 01.4-04 (Welle 4): Die drei Urteile — die Besatzungs-Spanne aus D-17 umsetzen und protokollieren, `cargoSCU` für die 31 fälschlich auf 0 stehenden Fahrzeuge, `shieldHp` gegen die gemessene Zählregel `Schildgeneratoren / 2` statt gegen die Veralterungs-Vermutung (D-20). `hullHp` als vierte Klasse mitbeurteilt
- [ ] 01.4-05 (Welle 5): Der Tausch — beginnt mit einem Entscheidungs-Checkpoint. `vehicles.json` kommt aus der Extraktion, alle ~25 Leser ziehen nach (DE und EN im selben Schritt), das Patch-Rückgrat zieht in den Generator um (D-19), die Rückübersetzungsdatei fällt. Dann Wiki-Kette abschalten (`sync-vehicles.mjs` und der CI-Schritt) und am gerenderten Datenblatt beweisen: Buccaneer, Carrack, Freelancer MAX, 315p — je in beiden Sprachen

Vorarbeit (unversioniert, Stand 02.08.2026, im Worktree `.claude/worktrees/buccaneer-waffen-daten-be6ac7`):
`scripts/lib/cryxml.mjs`, `scripts/datamine-vehicles.mjs`, `scripts/verify-vehicles.mjs`,
`scripts/verify-weapon-sizes.mjs`. Sie erzeugen bereits 223 Fahrzeuge. Belegte Formeln und
Sackgassen stehen in der Projekt-Erinnerung `vehicles-wiki-to-gamefiles`. Das Sichern dieser
Dateien ist der erste Schritt der Phase — `.claude/` ist gitignored, ein Aufräumen des
Worktrees verliert sie.

Bei der Planung am 03.08.2026 kam eine **fünfte** Vorarbeit ans Licht, die in CONTEXT.md
D-01 fehlt: `scripts/datamine-ship-loadouts.mjs` ist in jenem Worktree geändert und liefert
zusätzlich `carrier` (Turm- vs. Pilotwaffe), `cargo` (SCU je Schiff) und `ports`. Die hier
liegende `src/data/ship-loadouts.json` hat diese Schlüssel nicht — ohne die Übernahme wäre
`cargoSCU` bei allen 223 Fahrzeugen null und `turretWeapons` bei allen leer. Plan 01 holt
sie mit.

### Phase 2: Schrift- und Bewegungsskala

**Goal**: Kopfleiste und Startseite folgen einer gemeinsamen Skala für Schriftgrade und einer gemeinsamen Sprache für Übergänge, sodass sie als ein Bewegungsbild gelesen werden statt als zwei unabhängige Zustände.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TYPO-01, TYPO-02, TYPO-03
**Success Criteria** (what must be TRUE):

  1. Schriftgrade und Laufweiten von Kopfleiste und Startseite stammen aus einer benannten Skala, nicht aus seitenlokalen Einzelwerten
  2. Übergänge auf der Startseite teilen sich Dauer und Beschleunigungskurve, statt jeder für sich zu laufen
  3. Ein Scrollen über die ganze Startseite zeigt keinen Bruch im Bewegungsverhalten zwischen Kopfleiste und Seiteninhalt

**Plans**: 7/7 plans executed

Plans:

- [x] 02-01-PLAN.md (Welle 1) — Leitschuss: die Skala aus der gemessenen Verteilung ableiten, als vierte Schicht in `assets/theme.css` legen und die ganze Kette an Kopfleiste und beiden Startseiten beweisen, bis ins gehashte `dist/_astro`-Bündel; dazu das bleibende Tor `verify:typo`
- [x] 02-02-PLAN.md (Welle 2) — Die Wandlung aus Phase 1 nachmessen, bevor die Breite anfängt: Regressionstest auf die beiden Messeingänge, Sichtrunde benannt an den Betreiber
- [x] 02-03-PLAN.md (Welle 3) — Der überprüfbare Massendurchlauf, erprobt an den sechs Stilblättern unter `assets/`; dabei die Entscheidung zu den Ären-Kurven des Patch-Archivs
- [x] 02-04-PLAN.md (Welle 4) — Werkzeug- und Bauteil-Körper (30 Dateien), inklusive der vier zur Laufzeit gesetzten Werte in `assets/*.js`
- [x] 02-05-PLAN.md (Welle 4) — Die 19 Patch-Körper; Design-Welten und Ambiente maschinell belegt unverändert
- [x] 02-06-PLAN.md (Welle 4) — Seitenpaare, Themen-Körper, Konto-Ansichten und Schiffsübersicht (40 Dateien); jedes DE/EN-Paar in einem Schritt
- [x] 02-07-PLAN.md (Welle 5) — Sperrklinke anziehen, `verify:typo` ans Dockerfile-Tor hängen, Schluss-Sichtrunde und Phasenbilanz

⚠ **Sieben statt zwei Pläne.** Die Zahl „2" stammt aus der Init-Granularität und wurde beim
Zuschnitt am 08.08.2026 gegen den gemessenen Umfang geprüft. Die Erhebung des Planers über
alle 95 betroffenen Dateien ergab **1968 `font-size`, 865 `letter-spacing` und 458
`transition`-Deklarationen** — rund das Fünffache dessen, was der Scout in `02-CONTEXT.md`
gezählt hatte (414 in 12 Dateien), weil der Löwenanteil in gescopten `<style>`-Blöcken von
`.astro`-Komponenten sitzt. `02-RESEARCH.md` § Open Questions 1 hatte genau diese Gegenprüfung
verlangt. Die Welle 4 läuft dreifach parallel (disjunkte Dateimengen).

Die Skala selbst ist aus der gemessenen Verteilung abgeleitet, nicht aus einem
Lehrbuch-Verhältnis: 19 Schriftgrad-Stufen (679 der 1634 statischen Werte treffen eine Stufe
exakt, nur 7 verschieben sich um mehr als 6 %), 20 Laufweiten-Stufen auf 0,02-em-Raster
(795 von 855 exakt), drei Dauern (150/200/300 ms, decken 659 der 663 Bedienübergang-Teile)
und eine Kurve. ⚠ `Layout.astro` setzt `html { font-size: 112.5% }` — **1rem sind hier 18 px**,
jede px→rem-Umrechnung teilt durch 18.

Entschieden beim Zuschnitt (offene Fragen aus `02-RESEARCH.md`): die fluide `clamp()` der
Hero-Überschrift bleibt eine benannte Ausnahme (sie ist der Nenner des Wandlungs-Maßstabs aus
Phase 1); `assets/archive.css` gibt nur seine kurzen Bedienübergänge an den globalen Token ab
und behält seine eigenen Kurven für die langen Ären-Übergänge; Scroll-Reveal bleibt nach dem
FX-07-Präzedenzfall Ambiente und wird nicht angefasst.

### Phase 3: Überlagerungen entstapeln

**Goal**: Der in CONCERNS.md als Class B verzeichnete Befund ist abgetragen — Text über Bildmotiven steht nicht mehr hinter gestapelten Deckkraftschichten, und der erreichte Kontrast ist gemessen statt geschätzt.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: LAYER-01, LAYER-02
**Success Criteria** (what must be TRUE):

  1. Kein Text steht mehr hinter mehr als einer dekorativen Deckkraftschicht
  2. Für jede betroffene Stelle liegt ein gemessener Kontrastwert für Hell- und Dunkelmodus vor
  3. Die Bildmotive tragen die Seite optisch weiterhin — die Entstapelung hat sie nicht flachgeschleift

**Plans**: 5/5 plans executed

Plans:

- [x] 03-01-PLAN.md (Welle 1) — Leitschuss: die ganze Kette an EINEM Archetyp beweisen — `body::after` räumlich begrenzen (Maske an `var(--maxw)`), das Zeilenraster als `.hero::before` UNTER den Text legen, den `.reveal`-Beobachter von seinem Höhendeckel befreien, dazu die fehlende Rechenstufe (`compositeOver`/`flattenStack`) und das Tor `verify:layers` mit Vorher-/Nachher-Zahl
- [x] 03-02-PLAN.md (Welle 2) — Das geteilte System zu Ende: die sieben übrigen Medien-Archetypen bekommen ihr Raster; `.sstep` wird ohne JavaScript und bei reduzierter Bewegung voll lesbar (D-02)
- [x] 03-03-PLAN.md (Welle 2) — `/archiv` heilen (D-05, zweite unabhängige Umsetzung desselben Rechenfehlers) und die 21 defensiven `!important`-Overrides ersatzlos abtragen — belegbar 21 → 0
- [x] 03-04-PLAN.md (Welle 3) — Die 19 Patch-Körper per überprüfbarem Massendurchlauf: 19 `body::after`-Kopien, 87 neue Rasterregeln, 19 eigene Beobachter; Design-Welten maschinell belegt unverändert
- [x] 03-05-PLAN.md (Welle 4) — Vollständige, maschinell geschlossene Aufzählung der Messstellen (25 Registry-Einträge, 344 Messungen), WCAG-AA in beiden Farbmodi erreicht (Hero-Leitbefund 2,93:1 → 18,34:1), `verify:layers` ans Dockerfile-Tor gehängt, Sichtrunde als WINDOWS.md id 6 an den Betreiber übergeben — Phase technisch fertig, nicht als "Complete" markiert

⚠ **Fünf statt zwei Pläne.** Die Zahl „2" stammt aus der Init-Granularität. Beim Zuschnitt am
08.08.2026 hat der Planer gegen den Bestand nachgemessen — mit demselben Ergebnis wie in
Phase 2 (dort: 7 statt 2): **die `body::after`-Regel existiert 20-mal, nicht einmal.** Die 19
Patch-Körper verlinken `assets/detail.css` überhaupt nicht (0 von 19) und tragen je eine eigene
Inline-Kopie. D-01 muss deshalb 20-mal umgesetzt werden.

Zwei Funde des Zuschnitts, die in keinem Vorbereitungsdokument stehen:

1. **`.reveal` hat DREI unabhängige Umsetzungen, nicht zwei.** Neben `assets/detail.js`
   (Anteil 0,12) und `assets/archive.js` (0,12) tragen alle 19 Patch-Körper einen eigenen
   Inline-Beobachter mit Anteil 0,1. `03-RESEARCH.md` kennt nur die ersten beiden und nennt D-03
   deshalb „eine Lösung an einer Stelle". Es sind drei.

2. **Die Schichtung ist mechanisch entscheidbar.** `body::after` (`z-index:9000`) ist die
   **einzige** Regel im Bestand, die über den Glyphen liegt; alle Scrims malen unter dem Text
   (`.hero__in`/`.band__in`/`.scrolly__steps` sitzen auf `z-index:2`, ihre Scrims auf 0 bzw. 1),
   und die Kopfleiste liegt mit 9100 bereits darüber. CONCERNS' Annahme, Navigation und
   Brotkrumen säßen dort, wo die Vignette am dunkelsten ist, ist damit nachweislich falsch.
   Daraus folgt der Zuschnitt von D-01 zwingend: das Zeilenraster wandert auf `z-index:1` an die
   Medien-Container (sichtbar über dem Bild, unter dem Text), die Vignette bleibt und wird über
   der Textspalte ausmaskiert. `--ambient-opacity` bleibt bei 0,5/0,4 — begrenzt, nicht gedämpft.

Erhobene Grundlage (08.08.2026, gegen den Arbeitsbaum, nicht aus CONCERNS): 20
`body::after`-Regeln · 21 zeichengleiche `!important`-Overrides in 21 Dateien · `.sstep`-Markup
in 17 Themen-Körpern, aber die CSS-Regel nur in `assets/detail.css` · 87 anzulegende
Rasterregeln in den Patches · 170 Bildmotive, alle 170 lokal unter `public/assets/` und damit
mit `sharp` messbar · `--maxw` einheitlich 1280px in allen 19 Patches.

`/archiv` ist nach D-05 mit im Umfang; B-4 (Blend-Modus über Text) ist nach D-06 zurückgestellt
und steht als begründeter Ausschluss in der Messstellen-Registry, damit eine spätere Prüfung ihn
nicht als neuen Fund wiederentdeckt.

Erfolgskriterium 3 („die Bildmotive tragen die Seite optisch weiterhin") ist ein Sichturteil und
geht wie in Phase 1.2 und Phase 2 als benannter Punkt nach `.planning/WINDOWS.md` an den
Betreiber — kein Skript entscheidet es.

### Phase 4: Sprachparität absichern

**Goal**: Für die in diesem Meilenstein angefassten Seitenpaare ist die Deckungsgleichheit von Struktur und Stil nachgewiesen, nicht bloß behauptet — und der Nachweis lässt sich wiederholen.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SYNC-01, SYNC-02, THEME-02
**Success Criteria** (what must be TRUE):

  1. Für jedes angefasste Seitenpaar belegt ein wiederholbarer Prüfschritt, dass EN und DE dieselbe Struktur und dieselben Stilregeln tragen
  2. Der Prüfschritt schlägt fehl, wenn eine Sprachfassung nachträglich auseinanderläuft
  3. Kein generierter Hellmodus-Block wurde von Hand verändert; die Hellwerte entstehen weiterhin über `npm run theme`

**Plans**: 3/3 plans executed

Plans:

- [x] 04-01-PLAN.md (Welle 1) — Leitschuss: die ganze Kette von der Paarung bis zum Exit-Code, mit dem Struktur-Fingerabdruck aus D-01 über ALLE gebauten Paare (D-02), dem engen `langsw`-Ausschluss statt eines Seitenausschlusses, dem bezifferten Erstbefund — und der ausgeführten Negativkontrolle (Erfolgskriterium 2)
- [x] 04-02-PLAN.md (Welle 2) — Den Rest schließen: D-05 (die Beschreibung hängt an der englischen Quelle, beide Sprachen lassen sie sonst weg), jede verbleibende Abweichung einzeln beurteilt (bewusste Quellstelle = benannte Ausnahme, sonst beheben), Zombie-Wächter gegen Ausnahmen ohne Anlass, und die dreifach kopierte Paarungslogik auf ein Modul umgehängt
- [x] 04-03-PLAN.md (Welle 3) — THEME-02-Wächter (D-04) gegen eine Ablagekopie statt gegen den Arbeitsbaum, die falsche Herkunftsangabe in `assets/theme.css` richtiggestellt, beide Tore blockierend ans Dockerfile (D-03 „dann scharf"), Phasenbilanz

⚠ **Drei statt zwei Pläne — und die Phase ist trotzdem klein.** Anders als in den Phasen 2 (7
statt 2) und 3 (5 statt 2) hat hier die Recherche die Messung selbst gefahren, gegen einen echten
Build: **8.678 gebaute EN/DE-Paare** (nicht 69 — die 69 sind Quellpaare, mehrere davon dynamische
Routen), davon **80,3 % bereits zeichengleich**, und **95 % aller Abweichungen aus EINER
mechanischen Ursache**: `LangSwitcher.astro` rendert die Sprach-Steckplätze in fester Reihenfolge,
weshalb Abzeichen und Verweis zwischen EN und DE die DOM-Position tauschen. Nach dieser einen
Ausnahme bleiben **~85 Paare (~1 %)**. Der dritte Plan entsteht nicht aus Umfang, sondern weil
THEME-02 ein zweiter, andersartiger Wächter ist und das Scharfschalten beider Tore einen eigenen
Nachweislauf braucht.

Korrektur am ursprünglichen Zuschnitt: die frühere Formulierung „in `npm run verify` bzw.
`audit:site` einhängen" wird NICHT umgesetzt. `_verify.mjs` prüft Verweis-Integrität,
`audit-site.mjs` SEO/A11y; alle vier bestehenden Struktur-Tore (`verify:fx`, `verify:help`,
`verify:typo`, `verify:layers`) sind eigenständige npm-Skripte in der Dockerfile-Kette. Die
beiden neuen folgen diesem Präzedenzfall.

Zwei Funde, die den Zuschnitt mitbestimmen: **79 Items tragen eine deutsche, aber keine englische
Beschreibung, weil die LOCID-Schlüssel in CIGs eigener `english/global.ini` fehlen** — deshalb
D-05, das die Anzeige an die Existenz der englischen Quelle knüpft, statt Text zu erfinden. Und
**keiner der drei `npm run theme`-Generatoren fasst `assets/theme.css` an**, obwohl dessen
Kopfkommentar das behauptet; der Wächter deckt die Datei deshalb ausdrücklich nicht ab, und die
Angabe wird richtiggestellt statt weitergeschleppt.

### Phase 5: Spenden-Unterstützung

> **UMGESTELLT 02.08.2026 — Stripe raus, PayPal rein.** Der Betreiber kann Stripes
> Identitätsprüfung nicht erbringen (Ausweis nicht verfügbar); ohne sie zahlt Stripe
> kein Geld aus. Eine tadellos gebaute Anbindung, die nie auszahlt, ist wertlos.
> Gewählt ist ein **einfacher PayPal-Link**.
>
> Damit fällt der gesamte Serverteil weg: keine Edge Functions, keine
> Datenbanktabelle, kein Webhook. Die zuvor hier notierte Aufhebung der
> „Out of Scope"-Zeilen zu serverseitiger Logik ist damit **gegenstandslos** —
> die Phase bleibt innerhalb des UI-Meilensteins. Ersatzlos gestrichen:
> Fortschrittsbalken, Unterstützer-Wand, Moderation, Profil-Abzeichen und
> monatliche Unterstützung. Die sieben Stripe-Pläne sind überholt und werden
> neu geschnitten.
>
> Anlass unverändert: der Entwicklungsrechner geht wegen eines defekten Netzteils
> ohne Vorwarnung aus.

**Goal**: Ein Besucher, der die Seite nützlich findet, kann in unter einer Minute Geld geben — Betrag wählen, ein Klick zu PayPal, fertig; ohne Konto, in DE und EN — und das Geld kommt tatsächlich an. Die Seite sagt ehrlich, wofür: nicht „ein Teil ist kaputt", sondern dass der Rechner ohne Vorwarnung ausgeht und dabei die Arbeit mitnimmt. Sie behauptet keine Zahl, die sie nicht belegen kann.
**Mode:** mvp
**Depends on**: Nichts — die Phase fasst weder Startseite noch Kopfleisten-Wandlung an und kann vor Phase 2–4 laufen.
**Requirements**: DON-01, DON-02, DON-03, DON-09, DON-10, DON-11, DON-13, DON-14, DON-26, DON-27, DON-28, DON-29, DON-31
**Success Criteria** (what must be TRUE):

  1. Ein Besucher wählt auf `/support.html` einen Betrag und landet bei PayPal mit **genau diesem Betrag** — die Auswahl steuert wirklich etwas, sie ist keine Zierde
  2. Solange kein Empfänger hinterlegt ist, steht das Feature sichtbar im Demo-Modus: kein toter Knopf, keine behaupteten Zahlen
  3. Die Seite trägt die Gestaltungsrichtung „Instandsetzung" und stellt den **Arbeitsverlust** in den Mittelpunkt, nicht den Sachschaden; keine erfundenen Kennzahlen
  4. Der Unterstützen-Weg ist in DE und EN vollständig vorhanden, in beiden Farbmodi lesbar, bis 360 px bedienbar und per Tastatur vollständig bedienbar
  5. `npm run verify`, `npm run audit:site`, `npm run audit:csp` und `npm run test:e2e` laufen grün — ohne neue CSP-Einträge, weil eine Weiterleitung der CSP nicht unterliegt
  6. Die Datenschutzerklärung nennt PayPal und Ko-fi als Empfänger, bevor die Seite live geht

**Plans**: 3 plans (neu geschnitten 02.08.2026; die sieben Stripe-Pläne liegen in `superseded-stripe/`)

Plans:

- [ ] 05-01 (Welle 1) — Tracer: Betrag → PayPal durch alle Schichten. `SUPPORT`-Block mit zwei unabhängigen Schaltern, Gold-Token in beiden Farbmodi, Formular-Komponente, Seitenpaar, Tests
- [ ] 05-02 (Welle 2) — Die „Instandsetzung"-Identität: Schaltbild als Last-Kennlinie, Befund-Text über den Arbeitsverlust, Ko-fi-Zeile. Ausdrücklich kein Balken, keine Wand, keine erfundenen Zahlen
- [ ] 05-03 (Welle 3) — Site-weit erreichbar machen: Fuß-Zeile, Menüeintrag, Streifen auf acht Einfügestellen, Datenschutz DE+EN, Abnahme-Halt

Hinweis zur Reihenfolge: die Pläne laufen streng nacheinander. Das ist bewusst gegen
Parallelität entschieden — der Entwicklungsrechner geht wegen des defekten Netzteils
ohne Vorwarnung aus, und jeder Plan hinterlässt einen committeten, lauffähigen
Zustand. Ein unerwarteter Neustart kostet damit einen Plan, nicht die Phase.

Was in dieser Phase NICHT belegbar ist: dass tatsächlich Geld ankommt. Das hängt am
PayPal-Namen des Betreibers und an einer echten Überweisung. Es ist als menschliche
Abnahme geführt und bleibt bis dahin ungehakt.

### Phase 6: Schiffe: Rollen- und Merkmalsfilter

**Goal**: Wer auf der Schiffsübersicht ein Schiff für einen bestimmten Zweck sucht, findet es
über Filter, die die Fachsprache des Spiels sprechen — nicht über acht Grobtypen. Die
Filterwerte stammen aus den Spieldateien (DataCore), nicht aus geratenen Kategorien, und
lassen sich kombinieren, sodass auch Nischen wie „Frachter mit abgesenkter Signatur"
(Prowler Utility) auffindbar werden.
**Mode:** mvp
**Depends on**: — (unabhängig vom Design-Meilenstein; berührt nur die Schiffsseiten)
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, ROLE-06, ROLE-07, ROLE-08, ROLE-09, ROLE-10
**Success Criteria** (what must be TRUE):

  1. Jedes Schiff im Katalog trägt eine spielgenaue Rolle aus dem DataCore; die 4 nicht
     joinbaren Einträge (ATLS) sind benannt statt stillschweigend leer

  2. Die Filter finden die vom Nutzer genannten Beispielfälle: Tarnkappenbomber,
     Frachter mit abgesenkter Signatur, Bergung, Bergbau, Betankung

  3. Die Merkmale sind belegt, nicht behauptet — jedes Merkmal nennt seine Quelle im
     Spieldatensatz, und kein Merkmal wird aus Marketingtext abgeleitet

  4. DE und EN tragen dieselben Filter mit CIG-eigenen Übersetzungen; wo CIG keine
     deutsche Fassung liefert, ist die Lücke bewusst gefüllt statt englisch durchgereicht

  5. Die Seite bleibt ohne JavaScript lesbar und die Filterung läuft clientseitig ohne
     spürbare Verzögerung über alle 227 Karten

**Plans**: 3/3 plans executed

Plans:

- [x] 06-01-PLAN.md — (Welle 1) Tracer: „Bergung" von der Spieldatei bis auf die Karte — EIN Körper für DE und EN, Datamine, Momentaufnahme, erster Rollenfilter, plus Prüfschritt für die Join-Rate 223/227
- [x] 06-02-PLAN.md — (Welle 2) Beruf und 18 Rollenfamilien mit zerlegten Verbundrollen und gefüllten deutschen Lücken; danach Signaturachse und Merkmalsleiste, die den Prowler Utility auffindbar machen
- [x] 06-03-PLAN.md — (Welle 3) Sieben Schnellzugriffe setzen Rolle und Signatur in einem Klick, der Wiki-Grobfilter weicht dem spielgenauen Beruf, Sichtprüfung der fünf Abnahmefälle

Erhebung des Planers am 02.08.2026 gegen das echte Archiv — drei Korrekturen an RESEARCH.md,
die in den Plänen stehen: die deutsche Lokalisierung liegt unter `german_(germany)`, nicht
unter `german`; Signaturen tragen 16 Katalog-Schiffe, nicht 22 (RESEARCH zählt über 360
DataCore-Records statt über die 223 gejointen); und `dogfightEnabled` trifft 220 von 223 —
das Merkmal „Bewaffnet" aus D-09 entfällt damit nach D-09s eigener Abbruchbedingung.

### Phase 7: Komponenten-Filter für Schiffe

**Goal**: Wer wissen will, welche Schiffe eine bestimmte Bauteilgröße aufnehmen können, findet sie in der Schiffsliste: ein Auswahlfeld benennt die Bauteilart, ein zweites die Mindestgröße — und die Liste zeigt nur noch die Schiffe, deren Steckplätze das hergeben. Gemessen wird, was reinpasst, nicht was ab Werk drinsteckt.
**Mode:** mvp
**Depends on**: Phase 6 — baut auf dem dort eingeführten gemeinsamen Körper `components/ships/ShipsOverview.astro` auf
**Requirements**: keine REQ-IDs in REQUIREMENTS.md — bindend sind stattdessen die Entscheidungen D-01 bis D-12 aus `.planning/phases/07-komponenten-filter-f-r-schiffe/07-CONTEXT.md`
**Success Criteria** (what must be TRUE):

  1. Auf `/schiffe.html` und `/de/schiffe.html` steht ein Feld „Bauteil" (Waffe, Turm, Rakete, Schild, Kühler, Kraftwerk, Quantenantrieb, Radar — keine Gegenmaßnahmen) neben einem Feld für die Mindestgröße
  2. Die Auswahl „Waffe / ab S5" lässt genau die Schiffe stehen, die mindestens einen Waffensteckplatz mit `maxSize >= 5` haben — stichprobenartig gegen die Spieldateien belegt
  3. Die Größen stammen aus der Fahrzeug-Implementierungs-XML im p4k (`ItemPort` `maxSize`), nicht aus dem Stock-Loadout und nicht aus einer Fremdquelle
  4. Der Filter greift mit den bestehenden Feldern (Suche, Hersteller, Beruf, Rolle, Größe, Signatur, Merkmal) zusammen und der Ergebniszähler stimmt
  5. Schiffe ohne Steckplatz-Daten verschwinden nicht stillschweigend, sondern sind als solche erkennbar
  6. Deutsche und englische Fassung verhalten sich identisch, bis hinunter auf 360 px Breite, in beiden Farbmodi

**Plans**: 3/3 plans executed

Plans:

- [x] 07-01-PLAN.md (Welle 1): Die Kette von der Spieldatei bis zur gefilterten Liste an einer Bauteilart beweisen — CryXmlB-Leser, Datamine-Skript, eingechecktes JSON, zwei Auswahlfelder und Filterlogik — dann auf sieben Bauteilarten verbreitern
- [x] 07-02-PLAN.md (Welle 2): Turm-Regel einbauen, gegen `vehicles.json` als Drittquelle nachweisen, an 15 Stichprobenschiffen von Hand bestaetigen und erst danach als achte Bauteilart freischalten
- [x] 07-03-PLAN.md (Welle 3): Zweisprachigkeit, automatischer Verhaltensnachweis, Hausgates und Sichtpruefung

Hinweis zur Zusammenführung am 03.08.2026: Die Phase entstand parallel zu Phase 6 und ging
ursprünglich von zwei handduplizierten Schiffsseiten aus. Phase 6 hat die beiden inzwischen zu
EINEM Körper (`components/ships/ShipsOverview.astro`) zusammengelegt — der Filter sitzt deshalb
dort, nicht zweimal in den Seiten. Das Größenfeld heißt `sf-compsize`, weil Phase 6 `sf-size`
bereits für die Schiffs-Größenklasse belegt.

### Phase 8: Bauteil-Kennwerte auf den Crafting-Karten

**Goal**: Wer die Crafting-Datenbank durchblättert, erkennt auf der Karte selbst, womit er es zu tun hat — Größe, Grade und Ton stehen dort, statt erst nach einem Klick in der Detailansicht aufzutauchen. Was die Karte zeigt, stimmt mit dem Spiel überein; wo eine Angabe fehlt, bleibt die Stelle leer statt geraten.
**Mode:** mvp
**Depends on**: Nichts — die Phase fasst nur die Crafting-Seite an.
**Requirements**: CRAFT-01, CRAFT-02, CRAFT-03, CRAFT-04
**Success Criteria** (what must be TRUE):

  1. Auf jeder Blueprint-Karte, für die es die Angabe gibt, stehen Größe und Grade — bei Vehiclegear sind das rund 98 % der Karten
  2. Der Ton (Civilian, Military, Industrial, Stealth, Competition …) steht auf allen Bauteil-Karten, die ihn führen; bei Schiffswaffen wird er aus dem Kategorie-Pfad gewonnen statt aus `game.class`
  3. Wo eine Angabe fehlt, erscheint kein leerer oder geratener Chip — insbesondere bei Rüstung und Munition
  4. Die 15 gleichnamigen Blueprints sind einzeln geprüft; keiner zeigt die Kennwerte eines anderen Items
  5. Die Karten tragen die Kennwerte in DE und EN gleichermaßen — ein Körper, keine zweite Fassung
  6. Größe und Grade sind nicht nur sichtbar, sondern filterbar
  7. Die Seite bleibt statisch ausgeliefert; die Ergänzung treibt das Seitengewicht nicht nennenswert nach oben

**Plans**: 3 plans

Plans:

- [x] 08-01 (Welle 1): Tracer — die 57 Quantumdrive-Karten tragen Größe, Grade und Ton durchgehend bis ins gebaute HTML, dazu das Dauergatter für die 15 gleichnamigen Blueprints
- [x] 08-02 (Welle 2): Ausrollen auf alle 1594 Karten, Ton der 96 Schiffswaffen aus dem Kategorie-Pfad, Seitengewicht vorher/nachher gemessen
- [x] 08-03 (Welle 3): Filter nach Größe und Grade, Ton über die Freitextsuche, Sichtprüfung in DE und EN

Anlass: Discord-Rückmeldung von [SYN] Froggy. Die Erkundung ergab, dass kein
Data.p4k-Lauf nötig war — `game.size`/`grade`/`class` lagen bereits in
`assets/universal-items.json`.

Hinweis: 5 der 15 gleichnamigen Blueprint-Gruppen sind nachweislich verschiedene
Items (abweichende `item_stats`, z. B. `main powerplant` mit 60 t gegen 7,6 t). Diese
10 Karten bleiben nach Entscheidung 9 chiplos; die Sperre leitet sich bei jedem Build
aus den Daten ab. Deshalb tragen 1514 der 1594 Karten eine Chip-Reihe. Das Gatter
`npm run verify:crafting` hängt am Dockerfile-Tor und an `datamine:crafting`.

Ursprünglich als „Phase 5" geplant — umnummeriert auf 8 beim Zusammenführen mit
`staging`, wo die 5 bereits für „Spenden-Unterstützung" vergeben war.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 1.2 → 2 → 3 → 4 → 5 → 6 → 7 → 8
(Phase 5 und Phase 6 hängen an keiner Vorgängerphase und werden auf Wunsch vorgezogen.
Phase 6 lief am 02.08.2026 vorab durch, während 1.1 noch offen war. Phase 7 setzt auf Phase 6 auf.
Phase 8 hängt ebenfalls an keiner Vorgängerphase und lief am 07.08.2026 durch.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Wortmarken-Wandlung | 2/2 | Complete | 2026-07-28 |
| 1.1 Ambiente-Effekte stilllegen | 2/3 | In Progress|  |
| 1.2 Werkzeuge erklären | 5/5 | In Progress|  |
| 2. Schrift- und Bewegungsskala | 7/7 | In Progress|  |
| 3. Überlagerungen entstapeln | 2/5 | In Progress|  |
| 4. Sprachparität absichern | 3/3 | In Progress|  |
| 5. Spenden-Unterstützung | 0/3 | Planned (PayPal) | - |
| 6. Schiffe: Rollen- und Merkmalsfilter | 3/3 | Complete | 2026-08-02 |
| 7. Komponenten-Filter für Schiffe | 3/3 | Complete | 2026-08-03 |
| 8. Bauteil-Kennwerte auf den Crafting-Karten | 3/3 | Complete | 2026-08-07 |

### Phase 9: Mining-Werkbank: Fundort-Merkliste

**Goal:** Die mittlere Spalte der Werkbank wird neu belegt. Die Detailspalte
(`wb__pane--a`: Physik, Qualitätsstufen, „Steine mit diesem Erz") entfällt
ersatzlos — diese Angaben werden später an anderer Stelle besser dargestellt.
An ihre Stelle rückt die Fundorte-Liste (bisher `wb__pane--b`). Der dadurch
frei werdende Platz nimmt ein neues Werkzeug auf: Zum ausgewählten Erz lassen
sich einzelne Fundorte anheften; jedes angeheftete Paar erscheint dort als
„Erz — Fundort" (z. B. „Quantainium — Aaron Halo"), auch über mehrere Erze
hinweg. Die Merkliste ist unter einem Namen als Preset speicherbar,
kontogebunden wie `mining_sig_presets`, und bleibt bestehen, solange das
jeweilige Preset ausgewählt ist.
**Requirements**: keine REQ-IDs in REQUIREMENTS.md — bindend sind stattdessen die
Entscheidungen D-01 bis D-07 aus
`.planning/phases/09-mining-werkbank-fundort-merkliste/CONTEXT.md` (gleicher Umgang wie
in Phase 7).
**Depends on:** Phase 8
**Plans:** 2/2 plans executed

Plans:

- [x] 09-01-PLAN.md (Welle 1) — Leitschuss durch alle vier Schichten: Spalte `locations`
  an `mining_sig_presets` (Altbestand laedt weiter), Mitte einspaltig mit umgehaengtem
  Erz-Kopf, zweiter Reiter mit der Merkliste, EIN angehefteter Fundort ueberlebt den
  Preset-Rundlauf — maschinell belegt gegen das echte Client-Skript; danach die toten
  Reste der Detailspalte und ein Wachposten in `verify:mining` fuer den Paar-Schluessel

- [x] 09-02-PLAN.md (Welle 2) — Ausbau: Werte je Paar (Chance, Hoechstanteil),
  Loesen an beiden Enden, Gast-Arbeitsstand, Obergrenze mit Ansage; Hilfetexte und
  Oberflaeche in DE und EN auf den neuen Stand; beide Torlaeufe (normal und Vorschau)
  und die Sichtrunde benannt an den Betreiber

Nachgemessen beim Zuschnitt (15.08.2026, gegen `assets/mining-db.json`): 37 Minerale,
**521 Paare, 45 verschiedene Fundorte, Spitzenreiter Eisen mit 27** — die CONTEXT.md
nennt „bis zu 21". Die Begruendung fuer die einspaltige Mitte wird dadurch staerker.
Entschieden beim Zuschnitt (offener Punkt O-1 aus der CONTEXT.md): **ein Preset haelt
beide Listen** — eine zweite Spalte `locations text[] not null default '{}'` an der
bestehenden Tabelle, Primaerschluessel unangetastet. Getrennte Preset-Listen je Reiter
haetten ein drittes Feld IM Primaerschluessel gebraucht, also Schluessel abbauen,
Bestand nachtragen, Schluessel neu setzen — drei Schritte an fremden Nutzerdaten statt
einem. Verlustfreiheit schlaegt die saubere Trennung.

### Phase 10: Mining-Presets bedienbar machen

**Goal:** Die in Phase 9 eingeführten Presets sind heute gefährlich und
unfertig zu bedienen. Fünf Befunde des Betreibers, in seiner Reihenfolge:
(1) Das `×` neben der Preset-Auswahl löscht **ohne Rückfrage** — und direkt
daneben bedeutet dasselbe `×` in der Bearbeiten-Zeile „Abbrechen". Zwei
gegensätzliche Wirkungen, ein Zeichen, dieselbe Stelle. Das hat bereits ein
Preset gekostet. (2) Presets lassen sich nur anlegen und löschen, nicht
bearbeiten: umbenennen, Inhalt überschreiben und einzelne Einträge entfernen
fehlen. (3) Die Mittelspalte ist für eine einzelne Liste zu breit. (4) Die
rechte Spalte zeigt über Reiter **entweder** Signaturen **oder** Fundorte —
gewünscht war ein Nebeneinander; die Reiter entfallen, beide Listen stehen
untereinander und sichtbar. (5) Das Preset-Dropdown (`<select>`) ist die
falsche Form für diese Aufgabe. (6) Das Eingabefeld „Scanwert" entfällt
ersatzlos — der Bedienweg ist im Spielfluss unrealistisch (anheften, scannen,
Monitor wechseln, fünfstellig abtippen, während man im Belt steht); der
übliche Weg ist näher ranfliegen, dann nennt der Scanner das Erz selbst. Die
Signaturenliste samt Vielfachen bleibt als Nachschlagewerk erhalten.
**Requirements**: keine REQ-IDs in REQUIREMENTS.md — bindend sind stattdessen die
Entscheidungen D-01 bis D-07 aus
`.planning/phases/10-mining-presets-bedienbar-machen/CONTEXT.md` (gleicher Umgang wie
in Phase 7 und Phase 9), samt der beiden Nachschaerfungen vom 15.08.2026 zu D-01
(zwei Klicks, der zweite traegt Worte) und D-02 (Aufklapp-Ansicht an der Preset-Zeile,
gezielter Schreibaufruf ohne Laden des Presets).
**Depends on:** Phase 9
**Plans:** 2/2 plans executed

Plans:

- [x] 10-01-PLAN.md (Welle 1) — Leitschuss durch alle Schichten: sichtbare Preset-Liste
  statt Auswahlfeld, Umbenennen ueber genau einen PATCH auf den Primaerschluessel samt
  eigenem Zweig fuer den vergebenen Namen; danach Loeschen mit beschrifteter Rueckfrage
  (Muelleimer statt `×`, andere Stelle, Warnschraffur) sowie Ueberschreiben und
  eintragsweises Ausduennen direkt an der gespeicherten Zeile (D-01, D-02, D-05)

- [x] 10-02-PLAN.md (Welle 2) — Ausbau vollzogen: die Reiter sind entfallen,
  Signaturenliste und Fundort-Merkliste stehen gestapelt (`.wb__stack`/`.wb__sec2`) und
  gleichzeitig sichtbar, jede mit eigener Ueberschrift samt Zaehler (`wb-pinsh`/`wb-lpinsh`);
  die rechte Spalte ist um 68 px auf 330 px gewachsen, zulasten der Mitte (`470px 1fr 330px`),
  die linke Erzliste unangetastet. Der Scanwert ist restlos abgetragen — Eingabefeld,
  Treffermarkierung `is-hit`, Sprachschluessel `scanPlaceholder`, Hilfeschluessel
  `mining.ctl.scan`/`mining.ctl.tabs` — waehrend die Vielfachen-Anzeige vollstaendig steht.
  Hilfetexte in DE und EN auf den neuen Stand (Preset-Handlungen, Nachschlagewerk-Rahmung,
  keine Reiter-/Scanwert-Erwaehnung mehr). Beide Torlaeufe gruen (normal und mit
  `STAGING=1`, 18/18 Schritte), `verify:help` 12/12 Werkzeuge, `audit:site` 0 FEHLER,
  `test:e2e` 270/270 (267 vor der Phase + 3 neue Faelle). Sichtrunde als Eintrag id 11 in
  `.planning/WINDOWS.md` an den Betreiber uebergeben (D-03, D-04, D-06, D-07)

Entschieden beim Zuschnitt (Claude's Discretion aus der CONTEXT.md): **Umbenennen ist
EIN `PATCH` auf `(user_id, name)`**, nicht „neu anlegen + altes loeschen". Die
UPDATE-Politik der Tabelle prueft ausschliesslich `user_id` und ist gegenueber dem Namen
blind; der einzige Fehlerfall ist die Eindeutigkeitsverletzung, die als HTTP 409 mit
eigener Meldung sichtbar wird. Zwei Aufrufe waeren nicht atomar und koennten genau den
Datenverlust erzeugen, den diese Phase beheben soll. Der Preis der Entscheidung steht in
`10-01-PLAN.md` unter `assumption_delta_decision`: solange der Name die Identitaet
traegt, macht jedes Umbenennen eine kuenftige oeffentliche Adresse (Phase 11) ungueltig.
**Rastermass** wird `470px 1fr 330px` statt `470px 1fr 262px` — die linke Erzliste
bleibt unangetastet, die 68 px kommen aus der Mitte (D-04).

### Phase 11: Geteilte Routen mit Spielerbewertung

**Goal:** Ein Nutzer kann ein Preset auf der Seite veröffentlichen, andere
können es ansehen, übernehmen und bewerten. Zweck ist nicht Geselligkeit,
sondern eine Datenschicht, die aus den Spieldateien nicht zu holen ist: Die
Fundortdaten sagen „Quantainium @ Aaron Halo, 2 % Chance, bis 78,3 %" — ob
sich der Flug lohnt, wie voll der Ort ist und ob dort ständig jemand campt,
weiß nur, wer ihn geflogen ist. Bewertete Routen sind die Brücke zwischen
korrekten Zahlen und brauchbarem Rat.

⚠ **Vor der Planung zu entscheiden** (bestimmt das Datenmodell):

1. Urheberschaft — es gibt bereits öffentliche Profile `/pilot/<handle>`;
   Veröffentlichen wäre damit eine Preisgabe der Identität.

2. Bewertungsform — Daumen, Sterne oder „hat funktioniert"; eine Stimme je
   Konto und Preset, sonst wertlos.

3. Missbrauch — öffentliche Namensfelder sind ein Einfallstor für Spam und
   Beleidigungen; es braucht mindestens einen Weg für den Betreiber, etwas
   zu entfernen.

4. Kopieren oder folgen — eine übernommene Route als eingefrorene Kopie
   oder als Abonnement, das sich mitändert.

⚠ **Reifegrad-Vorbehalt (gemessen 15.08.2026):** 7 Konten, 2 Favoriten, 2
Signatur-Presets (alle vom Betreiber beim Testen). Ein Bewertungssystem
braucht kritische Masse; mit dieser Nutzerzahl steht neben jeder Route eine
Null. Das spricht nicht gegen den Bau, wohl aber dagegen, ihn vorzuziehen.
**Requirements**: TBD
**Depends on:** Phase 10
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 11 to break down)

### Phase 12: Fundorte in der Mining-Werkbank anklickbar

**Goal:** Die Werkbank beantwortet bisher nur eine Richtung — „wo finde ich
DIESES Erz?". Die Gegenrichtung — „was gibt es an DIESEM Ort?" — ist die
Frage, die man sich beim Fliegen tatsächlich stellt, und sie ist heute
unbeantwortbar: die Fundortzeilen sind tote Textzeilen, allein die
Anheft-Nadel reagiert. Ein Klick auf den Namen schaltet die Mittelspalte auf
eine Fundort-Ansicht um, mit Rückweg zum Erz.

Die Datenhälfte dafür liegt seit der Fundort-Korrektur (14./15.08.) fertig im
Bestand und wird im UI **nirgends** benutzt: `assets/mining-db.json` führt
neben `minerals[]` auch `bodies[]` — 45 Fundorte, je Erz `chance`,
`maxShare`, `eff`, `mining`, `rarity`. `verify:mining` prüft beide Richtungen
bereits auf Deckungsgleichheit. Es fehlt die Ansicht, nicht die Datenarbeit.

**Inhalt der Fundort-Ansicht:**

- Erzliste, gruppiert nach Abbaumethode (ship / roc / fps / hand)
- je Erz Chance, Höchstanteil und Balken — **Chance ist die Leitgröße**, Balken
  und Sortierung folgen ihr (D-06, bewusst asymmetrisch zur Erz-Ansicht, die
  Fundorte nach `eff` rangiert). **Keine Scan-Signatur in der Zeile** (D-08) —
  die Signaturenliste in Spalte 3 leistet das bereits.
  ⚠ Hier stand bis zur Phasenbesprechung „Balken nach `eff` rangiert und
  Scan-Signatur". Beides ist am 15.08. in `12-CONTEXT.md` anders entschieden
  worden; der Stichpunkt war seither stale und ist hier richtiggestellt.

- Spurenerze (niedriger Höchstanteil) **markiert statt ausgeblendet**
- Kopf mit System und Ortstyp; bei Lagrange-Fundorten die echten
  Anflugpunkte (ARC-L3, CRU-L5 …) statt der Sammelbezeichnung

⚠ **Ausdrücklich nicht** (mit scmdb verglichen, 15.08.2026):

1. **Keine Preise.** scmdb zeigt auf seiner Fundort-Seite selbst keine —
   und `refinery-data.json` deckt nur 26 der 37 Erze.

2. **Keine Gruppenanteile** im scmdb-Stil („Ship Mining 51,0 %"). Deren Zahl
   rechnet Derelict Salvage und Debris mit; das ist eine Bergungsdatenbank,
   die wir nicht führen. Der Anteil wäre ohne diese Grundmenge erfunden.

3. **Keine Adernzahl** („3–5"). Steht nicht in unseren Daten; `deposits`
   zählt Felsarten und ist nicht dasselbe.

4. **Keine neuen Seiten oder Routen.** Betreiberentscheidung vom 15.08.:
   ausschließlich Umschaltung innerhalb der Werkbank.

⚠ **Kein Datenbefund aus dem scmdb-Vergleich.** Wir listen an Pyro Deep Space
Asteroids 12 Erze gegen deren 7, und Aluminium steht bei uns auf 29,8 % gegen
deren 14,9 %. Beides ist geprüft und erklärt: die Chance summiert bei uns über
alle Felsarten, die das Erz führen (2 × 14,9), und die fünf „fehlenden" Erze
sind genau die mit Höchstanteil 5–10 % — scmdb blendet Spuren aus. Das
Mehrfach-Slot-Doppelzählen ist in `datamine-locations.mjs:130-159` behandelt.
Definitionsunterschied, kein Fehler. Hier ist nichts zu reparieren.

**Requirements**: keine REQ-IDs in REQUIREMENTS.md — bindend sind stattdessen die
Entscheidungen D-01 bis D-11 aus
`.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/12-CONTEXT.md`
sowie die 48 Zustandszusicherungen im Abschnitt `## UI Considerations` von
`12-UI-SPEC.md` (39 belegt, 9 als Nachweis am gerenderten Bildpunkt erbracht —
`scripts/probes/mining-locview-messung.mjs`, 72/72 Messpunkte grün). Gleicher
Umgang wie in den Phasen 7, 9 und 10: technisch fertig, Sichtrunde
(`.planning/WINDOWS.md` id 12) noch beim Betreiber offen.
**Depends on:** Phase 10 (Fundort-Merkliste und Presets der Werkbank)
**Plans:** 3/3 plans executed

Plans:

- [x] 12-01-PLAN.md — Tracer: Klick auf eine Fundort-Zeile öffnet die Fundort-Ansicht (Kopf, nach Methode gruppierte und nach Chance sortierte Erzliste, gedämpfte Spurenzeilen), Zurück-Pfeil führt aufs Erz
- [x] 12-02-PLAN.md — Das Netz schließt sich: Erzzeile führt zum Erz (D-02), Merklistenzeile trägt denselben Klick (D-03), Kachelspalte markiert die Erze des Ortes (D-09)
- [x] 12-03-PLAN.md — Adresse `?fundort=` (D-04), Hilfetexte in beiden Sprachen nachgezogen, die 9 offenen Zustandszusicherungen gemessen und als Sichtrunde übergeben

### Phase 13: Verschachtelte Klickziele barrierefrei auflösen

**Goal:** An drei Stellen der Mining-Werkbank umschließt ein klickbares
Element einen echten `<button>`: die Erz-Kachel mit ihrer Anheft-Nadel
(`.wb__tile`, seit Phase 9), und seit Phase 12 die Fundort-Zeile und die
Merklisten-Zeile mit derselben Nadel. Alle drei tragen `role="button"` und
`tabindex="0"` auf dem äußeren Element. Das ist ein Verstoß gegen
WCAG 4.1.2 (axe-Regel `nested-interactive`): Screenreader kündigen ein
Bedienelement an, das ein zweites enthält, und die Reihenfolge, in der beide
erreichbar sind, ist nicht verlässlich.

**Befund-Herkunft:** Code-Review der Phase 12,
`.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/12-REVIEW.md`,
Eintrag **WR-02**. Kein Blocker — die Bedienung mit Maus und Tastatur ist
durch Tests belegt (`tests/e2e/mining-shortlist.test.js`) und die
Klick-Vorrangordnung stimmt. Der Mangel ist die *Auszeichnung*, nicht das
Verhalten.

**Warum eine eigene Phase und nicht Beiarbeit in Phase 12** (Entscheidung des
Betreibers, 15.08.2026): Das Muster betrifft **drei** Stellen, nicht nur die
zwei neuen — die Kachel trägt es seit Phase 9. Und die saubere Auflösung
ändert das Bedienmodell: Entweder wird der Name zum Knopf statt der ganzen
Zeile, oder die Nadel wandert aus dem Klickziel heraus.

⚠ **Der naheliegende Weg ist gesperrt.** „Nur der Name wird klickbar"
widerspricht **D-01** aus
`.planning/phases/12-fundorte-in-der-mining-werkbank-anklickbar/12-CONTEXT.md`:
die ganze Zeile wurde ausdrücklich als Klickziel gewählt, weil zu kleine
Ziele an genau diesem Knopf schon **dreimal** zurückgemeldet wurden
(`.planning/notes/signaturliste-anheften.md`). Diese Phase muss also eine
Lösung finden, die die Zugänglichkeit herstellt **ohne** das Ziel zu
verkleinern — z. B. die Nadel aus dem umschließenden Element herausheben
statt die Zeile zu verkleinern. Wer hier mit „dann eben nur der Name"
anfängt, dreht eine teuer bezahlte Entscheidung zurück.

**Requirements**: keine REQ-IDs — bindend ist WR-02 aus `12-REVIEW.md` sowie
die Sperre durch D-01 aus `12-CONTEXT.md`.
**Depends on:** Phase 12
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 13 to break down)

### Phase 14: Schiffs-Datenkarte entstapeln

**Goal:** Eine Schiffsseite liest sich in wenigen Kapiteln statt als Stapel
gleichförmiger Kästen. Wer sie öffnet, erkennt ohne Scrollen, welche Kapitel
es gibt, und springt in eines davon; jeder Kennwert steht genau einmal.

**Ausgangsmessung** (Carrack, 1280 × 720, Dev-Server, 18.08.2026):

| gemessen | Wert |
| --- | --- |
| Seitenhöhe | 5.554 px = 7,7 Bildschirme |
| Blöcke unter dem Hero | 14 (10 × `.sd__panel` + Kennwerte-Leiste + Beschreibung + Ähnliche + Fußblöcke) |
| Balkenspuren (`.sd__gtrack` / `.sd__proftrack`) | 20 |
| Kopfzeilen-Codes (`.sd__code`) | 10, davon 6 nur „Anvil Aerospace" |
| Sprungmarken | 0 |

**Die Doppelungen, maschinell gezählt:** `126 m` steht **4×** (Hero-Zeile,
Kennwerte-Leiste, Maße-Balken, Ähnliche Schiffe), `456 SCU` und `140 m/s`
je **3×**, dazu `74 m`, `30 m`, `319.000 km/s` und `10,6 SCU` je 2×. Nicht in
dieser Zählung, aber genauso doppelt: **alle sechs Felder des Panels
„Datenblatt"** — Typ, Größe und Status stehen als Chips unter dem Titel, die
Besatzung in der Kennwerte-Leiste, der Pledge-Preis im Kauf-Panel, der
Hersteller als Logo. Und `Hülle 88.000 HP` + `Schilde 144.000 HP` ergeben
exakt die `232.000 HP`, die zwei Panels weiter oben als „Defense" stehen.

**D-01 — Kapitel und Sprungleiste, nicht Reiter** (Betreiber, 18.08.2026):
Die zehn gleichförmigen Panels werden zu wenigen Kapiteln mit
unterschiedlichem Gewicht gebündelt, darüber eine beim Scrollen erreichbare
Sprungleiste. ⚠ **Reiter und Akkordeons sind ausgeschlossen** — der Betreiber
hat ausdrücklich festgehalten, dass „alles steht da" die Stärke dieser Seite
ist; was hinter einen Klick wandert, verletzt das. Ebenfalls verworfen: reine
Zweispaltigkeit, weil sie die Länge halbiert, ohne die Gleichförmigkeit zu
heilen.

**D-02 — Balken nur, wo sie vergleichen** (Betreiber, 18.08.2026): Das
Leistungsprofil behält seine Balken — dort steht der Balken für ein Perzentil
gegen 227 Schiffe und vergleicht wirklich etwas. Bei Maßen, Tanks,
Flugwerten und Verteidigung werden die Balken zu Zahlen. Ein Balken, der
Länge gegen Breite gegen Höhe stellt, sieht aus wie Daten und ist keine.

**Was NICHT angefasst wird:** Der Hero mit Hologramm-Bühne, Video- und
Bilderumschalter trägt und bleibt unberührt. Ebenso die Datenlage — diese
Phase ändert kein einziges Datenfeld und keinen einzigen Wert.

**Bekannte Rahmenbedingungen:**

- `src/components/ShipDetail.astro` (2141 Zeilen) ist **EIN Körper für DE und
  EN**; beide `[slug].astro` sind 27-Zeilen-Wrapper. Jede Änderung landet in
  beiden Sprachen zugleich, neue sichtbare Zeichenketten brauchen ihren
  Schlüssel in `src/i18n/ui.ts`.

- Schiffsseiten laden **kein** `detail.css` — im gebauten
  `dist/schiffe/anvl-carrack.html` stehen nur `fonts.css`, `mobile-ux.css`
  und `theme.css`. Die site-weite Falle
  `section{padding:clamp(3rem,7vw,5.5rem)…}` greift hier also nicht, und die
  lokale Regel `*{margin:0;padding:0}` (`ShipDetail.astro:404`) neutralisiert
  sie zusätzlich. Wer diese Zeile anfasst, holt die Falle zurück.

- Die Panels stehen heute als `<section class="sd__panel">` in **einer**
  Spalte (`.sd{max-width:var(--maxw)}`).

**Schlussmessung** (Carrack, 1280 × 720, dunkler Modus, 18.08.2026,
`node scripts/probes/schiffskarte-messung.mjs --base http://localhost:4322`
gegen den nach Welle 4 gebauten `dist/` dieses Worktrees): **4.179 px DE /
4.117 px EN** — 1.375 px unter dem Ausgang von 5.554 px (−24,8 %) und
21 px unter der auf 4.200 px festgeschriebenen Sperrklinke. Alle 216
Messpunkte (3 Schiffe × 2 Sprachen × 2 Breiten × 2 Farbmodi × 9
Messgruppen) bestanden.

**Requirements**: keine REQ-IDs — bindend sind D-01 und D-02.
**Depends on:** nichts
**Plans:** 4/4 plans executed

**Success Criteria** (was WAHR sein muss):

  1. Auf der gebauten Carrack-Seite kommt jeder der sieben heute doppelten
     Zahlwerte höchstens einmal vor; jede verbleibende Wiederholung ist als
     Ausnahme benannt und begründet

  2. Das Panel „Datenblatt" existiert in seiner heutigen Form nicht mehr —
     seine sechs Felder stehen an jeweils genau einer Stelle

  3. Beim Öffnen einer Schiffsseite ist ohne Scrollen erkennbar, welche
     Kapitel die Seite hat; ein Klick springt dorthin, und die Sprungleiste
     bleibt beim Scrollen erreichbar

  4. Es stehen nicht mehr zehn gleich aussehende Rahmen untereinander — die
     Kapitel sind optisch voneinander unterscheidbar

  5. Balkenspuren gibt es nur noch im Leistungsprofil; überall sonst Zahlen
  6. Die Seitenhöhe der Carrack bei 1280 × 720 liegt bei höchstens 4.200 px
     (Ausgang 5.554 px) und wird als Sperrklinke festgeschrieben

  7. Deutsche und englische Fassung sind deckungsgleich, in beiden Farbmodi,
     bis hinunter auf 360 px Breite

  8. `npm run build && npm run gate` grün, ebenso der Vorschau-Bau mit
     `STAGING=1`

Plans:

- [x] 14-01-PLAN.md — Werkzeug vor Eingriff: das Entdopplungs-Tor
      (`verify:shipcard`, vorerst ausgesetzt) einmal vorgeführt rot, plus die
      Messsonde, die die Ausgangsmessung von 5.554 px reproduziert

- [x] 14-02-PLAN.md — Tracer: Sprungleiste und erstes Kapitel end-to-end,
      Ankerziel und 360 px am gerenderten Bildpunkt gemessen

- [x] 14-03-PLAN.md — Leistung, Ausstattung und Umfeld als Kapitel; Datenblatt
      getilgt; Balken nur noch im Leistungsprofil

- [x] 14-04-PLAN.md — kapitelinterne Zweispaltigkeit, Schlussmessung samt
      Sperrklinke, Tor scharf, fünf Sichturteile nach `.planning/WINDOWS.md`

### Phase 15: Testpilot-Zugang: staging hinter der Discord-Rolle

**Goal:** `staging.verse-base.com` steht nicht mehr offen. Wer die Rolle
„Test Pilots" auf dem Discord-Server trägt, kommt hinein; alle anderen sehen
ausschließlich eine Anmeldeseite. Die Rolle ist dabei nicht länger ein
Ping-Abo, das man sich selbst nimmt, sondern eine vergebene Auszeichnung —
und sie trägt sichtbare Vorteile, damit sie etwas wert ist.

**Entscheidungen des Betreibers (17.08.2026, vor der Planung getroffen):**

1. **Strenge** — Ein Besucher ohne Rolle bekommt auf JEDER URL eine
   Anmeldeseite („Diese Vorschau ist für Testpiloten") mit Discord-Knopf.
   Nicht 403 ohne Erklärung, und ausdrücklich **kein** bloßes Banner über
   der weiterhin offenen Seite.

2. **Vergabe** — Der Betreiber vergibt die Rolle **von Hand**. Sie fällt
   dafür aus dem Discord-Onboarding heraus. Verworfen: Bewerbungsverfahren,
   automatische Vergabe ab Rang, und der Status quo (selbst vergebbar).

3. **Identität** — Discord wird an das **bestehende Supabase-Site-Konto**
   gekoppelt („Discord verknüpfen" im Konto-Bereich). Verworfen: ein
   zweiter, eigener Anmeldeweg nur am Tor — er könnte die Perks auf der
   Seite nicht tragen.

4. **Perks** — **alle vier** ausgewählt: Abzeichen im Piloten-Profil,
   privater Discord-Kanal mit Deploy-Ping, Rang-/XP-Bonus im Bot,
   Namensnennung auf der Seite.

**Vorbefunde der Bestandsaufnahme (17.08.2026, gegen den Bestand gemessen —
nicht aus der Doku):**

- ⚠ **Die Rolle existiert bereits und taugt so nicht als Türsteher.**
  `discord/blueprint.mjs:143` führt `tester` / „Test Pilots" (Farbe
  craftOrange, **null Berechtigungen**). `blueprint.mjs:402` macht sie im
  Onboarding **selbst vergebbar** — jeder Beitretende klickt einmal und hat
  sie. Entscheidung 2 ist deshalb kein Beiwerk, sondern Voraussetzung: ohne
  sie hinge der Schlüssel neben der Tür.

- ⚠ **Die Website kennt keine Discord-Identität.** Auth ist Supabase mit
  E-Mail/Passwort (`AuthLogin.astro:129`, `signInWithPassword`), **kein
  einziger OAuth-Provider** ist eingerichtet. Der Bot führt eine eigene
  SQLite-DB (`discord/bot/src/db.mjs`) mit Discord-User-IDs; zwischen beiden
  Welten gibt es **keine Brücke**. Sie ist zu bauen und ist die Grundlage
  sowohl des Tors als auch des Profil-Abzeichens.

- ⚠ **Ein Tor im Browser-JS wäre wirkungslos.** staging ist statisches HTML
  aus nginx im Coolify-Container hinter Cloudflare (`nginx/default.conf`,
  `.github/workflows/deploy-staging.yml`). Wer `curl` bedient, liest die
  Seite trotzdem. Das Tor muss **vor** die Auslieferung.

- Der Bot läuft 24/7 auf Coolify mit lebender Guild-Verbindung — er könnte
  „hat diese Person die Rolle?" in Echtzeit beantworten, **horcht aber auf
  keinem Port** (kein `createServer`/`listen` im Bestand).

**Offene Architekturfrage für die Recherche** (bestimmt den Zuschnitt, ist
NICHT vorentschieden): Cloudflare Worker vor staging · nginx `auth_request`
gegen den Bot · njs im nginx-Image + Supabase Edge Function. Zu bewerten
gegen die Hausregel „serverseitiger Code nur als Supabase Edge Function"
(die Seite läuft nicht auf Cloudflare Pages) und gegen die Zahl der
Auslieferungsziele, die dadurch entsteht.

⚠ **Die typische Leckstelle benannt:** Das Tor muss seine **eigene**
Anmeldeseite, deren Assets und den OAuth-Rückweg durchlassen. Diese
Ausnahmeliste ist der Ort, an dem solche Tore lecken — sie gehört
aufgezählt und vorgeführt rot, nicht angenommen.

⚠ **Umfang über drei getrennte Systeme:** Discord-Server (Blueprint, Bot),
Konto/Supabase (OAuth-Kopplung, Profil), Auslieferung (nginx/Cloudflare/CI).
Der Zuschnitt in Pläne hat das zu berücksichtigen; die Kopplung ist
Voraussetzung für Tor UND Abzeichen und gehört in die erste Welle.

**Requirements**: TBD — voraussichtlich wie in den Phasen 7, 9, 10 und 12
über Entscheidungen D-01… in der CONTEXT.md statt über REQ-IDs.
**Depends on:** Nichts. Die Phase berührt weder die Mining-Werkbank noch die
Oberfläche der Phasen 1–4; die im Roadmap-Gerüst voreingetragene Abhängigkeit
von Phase 13 ist ein Artefakt der Nummernfolge und gilt nicht.
**Requirements**: keine REQ-IDs — bindend sind die Entscheidungen **D-01 … D-25**
in `14-CONTEXT.md`, wie in den Phasen 7, 9, 10 und 12. Alle 25 sind auf Pläne
abgebildet; die Zuordnung steht in jedem `requirements`-Feld der Plan-Frontmatter.
**Plans:** 12/12 plans executed

Plans:

- [x] 15-01-PLAN.md — Türsteher-Tracer: njs-Machbarkeit belegen (D-23) und EIN Weg end-to-end durchs Tor über den Admin-Kurzschluss (D-04, D-06, D-11, D-24)
- [x] 15-02-PLAN.md — Supabase: Rollenspiegel, Sperrliste, Spiegelspalten, Torurteil in einem Aufruf (D-03, D-05, D-08, D-10, D-13, D-19, D-22)
- [x] 15-03-PLAN.md — Kontosperre: der Discord-Knopf legt nie ein Konto an, vorgeführt rot vor dem Scharfstellen (D-02)
- [x] 15-04-PLAN.md — Discord als zweiter Anmeldeweg im Konto und am Tor (D-01, D-03, D-11)
- [x] 15-05-PLAN.md — Discord-Server: Rolle nicht mehr selbst vergebbar, eigener privater Kanal (D-14, D-15, D-18)
- [x] 15-06-PLAN.md — Bestandsträger: Trockenlauf mit Namen und Anzahl, dann Entzug bei allen (D-16)
- [x] 15-07-PLAN.md — Bot: Server Members Intent, Rollenstand per Push, Vollabgleich beim Start (D-08, D-17, D-25)
- [x] 15-08-PLAN.md — Tor scharf: Testpiloten, Sperrliste, Ausfallverhalten, aufgezählte Ausnahmeliste (D-06, D-09, D-10, D-13)
- [x] 15-09-PLAN.md — Torkette: verify:gate (Schiene A), check:gate (Schiene C), Rauchtest-Bypass ohne Dauerschlüssel (D-06, D-07, D-12)
- [x] 15-10-PLAN.md — Perks auf der Seite: Profil-Abzeichen, Zustimmungsschalter, Namensnennung, Testpiloten-Übersicht (D-13, D-19, D-22)
- [x] 15-11-PLAN.md — Perks auf Discord: XP je Fehlerbericht-Thread, Deploy-Ping im Testpiloten-Kanal (D-20, D-21)
- [x] 15-12-PLAN.md — Scharfschaltung: beide Bauarten grün, Ausrollen, Beleg an der ausgelieferten Seite, Sichturteile an den Betreiber

### Phase 16: Das Schiff ist die Navigation

**Goal:** Die Schiffs-Detailseite wird zur Konsole. Man wählt links ein System,
das Schiff zeigt am gerenderten Mesh, **wo** dieses System sitzt, und rechts
steht die Auslesung dazu. Die vier Kapitel aus Phase 14 entfallen als
Seitenaufbau — die Konsole ist die Seite.

**Herkunft:** Betreiber-Befund 18.08.2026 zu Attrappe 012: „ich stelle mir vor
dass man so eine datenblatt seite so unfassbar kreativ machen kann. momentan
sind wir auf kreativitätstufe 0." Aus drei vorgelegten Konzepten
(`.planning/sketches/013-konzepte/`) hat der Betreiber **B — „Konsole"**
gewählt.

**Der Befund, der die Phase trägt:** Der Mechanismus existiert bereits und ist
nur begraben. Geprüft am 18.08.2026:

| geprüft | Befund |
| --- | --- |
| Abdeckung | **227 / 227 Schiffe** haben Mesh UND Hardpoints — keine Lücke |
| Hardpoints je Schiff | Median **48**, min 13, max 130 (Carrack 60 in 14 Arten) |
| Positionen | echte 3D-Koordinaten `p:[x,y,z]`, benannt (`n`), typisiert (`k`), mit Hüllkörper (`bbox`) |
| bereits angebunden | Item-Finder je Port: `cat`, `price`, `shops`, `iid` |
| bereits ehrlich | `np` = nicht physicalisiert, `est` = Position geschätzt — Vorbehalt steht am Marker |
| Gewicht | `three.module.min.js` 360 KB · GLB im Median 0,37 MB (Carrack 0,28) |
| Viewer | `public/assets/holo-viewer.js`, 41.821 Bytes, in Betrieb |

Heute ist das **einer von drei Reitern** im Hero („VIDEO | BILDER | 3D-HOLO")
hinter einem „Hologramm aktivieren"-Knopf — und die Daten stehen davon getrennt
in Kapiteln darunter. Diese Phase verbindet, was schon da ist.

⚠ **Marker auf einem Foto können nicht funktionieren** — der Kamerawinkel eines
Fotos ist unbekannt. Die Attrappe `013-konzepte/b-konsole.html` tut genau das
und ist an dieser Stelle irreführend. Marker funktionieren nur über dem
gerenderten Mesh, wo die Kamera bekannt ist. Das ist der bestehende Viewer.

**D-01 — Die Konsole ersetzt die Kapitel** (Betreiber, 18.08.2026). Ausdrückliche
**Lockerung der Sperre aus Phase 14** (`14-CONTEXT.md` D-01, „nichts hinter
einem Klick"). Dem Betreiber wurde vorgelegt, dass eine Auswahl links eine
Interaktion ist und dass die konsequente Fassung mit dem bisherigen Grundsatz
bricht; er hat sie trotzdem gewählt. Die vier Kapitel entfallen als Aufbau.

**D-02 — Alles steht im ausgelieferten HTML; die Konsole blendet nur um.**
Bedingung, unter der D-01 sicher ist. Keine Auslesung wird nachgeladen, keine
per JavaScript erzeugt. Ohne JavaScript zeigt die Seite alle Systeme
untereinander als schlichte Liste — nicht eine leere Fläche.
**Begründung, nicht verhandelbar:** ~17.000 indexierbare Seiten, und der Zulauf
kommt praktisch vollständig aus Suche (30 Tage: Bing 67, DDG 38, ChatGPT 10,
Google 7). Gemessen am 18.08.2026 trägt `dist/de/schiffe/anvl-carrack.html`
heute **~5 KB echten Text** im Quelltext — Waffennamen, Bauteilnamen, Fracht.
Eine im Quelltext leere Schiffsseite fällt aus dem Index und nimmt den Zulauf
mit.

**D-03 — Mobil gestapelt** (Betreiber): Modell oben, Systemliste als waagerechte
Chip-Reihe darunter, Auslesung darunter. Dieselbe Idee, andere Anordnung. Keine
zweite Oberfläche, kein Ausschluss mobiler Besucher.

**D-04 — Das 3D lädt beim Scrollen in den Blick** (Betreiber): ein statisches
Standbild steht sofort, das Mesh löst es ab, sobald die Bühne sichtbar wird.
Kein Startknopf — wenn das Schiff die Navigation IST, darf es nicht hinter
einem Knopf liegen. Wer nie hinunterscrollt, lädt nichts.

**Was NICHT angefasst wird:** die Datenlage. Kein Feld wird neu erhoben, keine
Zahl neu berechnet. Diese Phase ordnet an und verbindet, was vorliegt.

**Requirements**: keine REQ-IDs — bindend sind D-01 bis D-04.
**Depends on:** Phase 14 (Kapitel, Sprungleiste, `verify:shipcard`, Höhenklinke)
**Plans:** 5/5 plans executed

**Success Criteria** (was WAHR sein muss):

  1. Auf jeder der 227 Schiffsseiten wählt man ein System und sieht am
     gerenderten Schiff, wo es sitzt; die Auslesung dazu steht daneben

  2. Bei abgeschaltetem JavaScript zeigt dieselbe Seite alle Systeme
     untereinander als lesbare Liste — maschinell belegt gegen das gebaute
     `dist/`, nicht behauptet

  3. Der indexierbare Textbestand je Schiffsseite ist **nicht kleiner** als die
     heute gemessenen ~5 KB; die Zahl wird als Sperrklinke festgeschrieben

  4. Bei 360 px ist die Konsole gestapelt bedienbar: Modell, Chip-Reihe,
     Auslesung — ohne waagerechten Überlauf

  5. Beim Seitenaufruf wird weder `three.module.min.js` noch ein GLB geladen;
     beides kommt erst, wenn die Bühne in den sichtbaren Bereich gescrollt wird

  6. Marker sitzen an den Positionen aus dem Schiffsmodell, und die Vorbehalte
     `np` und `est` bleiben am Marker sichtbar

  7. Deutsche und englische Fassung sind deckungsgleich, in beiden Farbmodi
  8. `npm run build && npm run gate` grün, ebenso der Vorschau-Bau mit
     `STAGING=1` — einschließlich `verify:shipcard` aus Phase 14, das an den
     neuen Aufbau angepasst werden muss statt umgangen zu werden

Plans:

- [x] 16-01-PLAN.md — Welle 1, Tracer: P-3 an der Zählung entscheiden, P-1 (Füllgrad ≥ 70 %) und P-2 (kein Dauer-Label) am gerenderten Bildpunkt belegen, Textbestand vor dem Eingriff messen, Sichturteil S-0 nach WINDOWS.md
- [x] 16-02-PLAN.md — Welle 2, Werkzeug vor Eingriff: `verify:shipconsole` (acht Zusicherungen, ausgesetzt, einmal vorgeführt rot); `verify:shipcard`s Entdopplungs-Scan nimmt `section.holo` mit auf
- [x] 16-03-PLAN.md — Welle 3, D-02: vier Systemabschnitte serverseitig im ausgelieferten HTML, Rail als Ankerliste, Bewaffnung und Bauteilliste ziehen aus `ch-gear` in die Konsole, Beweis mit abgeschaltetem JavaScript
- [x] 16-04-PLAN.md — Welle 4, D-01/D-03/D-04: dreispaltiges Raster, Rail als Einfachauswahl, Auslesung mit zwei Zuständen, Laden beim Scrollen ohne Startknopf, gestapelt bei 360 px, Netzverkehr gemessen
- [x] 16-05-PLAN.md — Welle 5: Rot-Vorführung der erweiterten Entdopplungs-Region einlösen, `verify:shipconsole` scharf, Sperrklinken festschreiben, Schlussmessung DE/EN in beiden Farbmodi, fünf Sichturteile nach WINDOWS.md

### Phase 18: Missionen wissen, wo sie spielen

**Goal:** Die Missionsseite ist die einzige Seite, die alle anderen Bereiche
berührt — Wirtschaft, Rang, Fraktion, Auftraggeber, Bauplan — und die einzige,
die ihre eigene Ortskante nicht führt. Diese Phase zieht zwei Kanten, die in den
Quelldaten **bereits vorliegen** und beim Einlesen verworfen werden: wo eine
Mission spielt, und welcher Art eine Ortsangabe im Missionstext ist.

**Herkunft:** Messsitzung 23.08.2026. Ausgangspunkt war eine Zuschrift, die
VerseBase nicht als „noch eine Datenbank" beschreibt, sondern als Explorer für
die inneren Zusammenhänge des Spiels — entlang der Kette Mission → Auftraggeber
→ Voraussetzung → Belohnungstopf → Bauplan → Gegenstand → Zutat → Fundort. Die
Prüfung ergab, dass diese Kette im Bestand fast vollständig geschlossen ist
(335 Missionen ↔ 335 Bauplan-Rückverweise, sauber über `slug`, in beide
Richtungen). Das schwächste Glied ist der Ort.

**Der Befund, der die Phase trägt:** Es fehlt kein Datensatz. Es fehlt das
Durchreichen. Gemessen gegen die installierte 4.9.0 (CL 12344265):

1. **Zwei Ortsfelder, eines gelesen.** `MissionBrokerEntry` führt
   `localityAvailable` (407 von 2584 gefüllt) und `locationMissionAvailable`
   (**1836** von 2584 gefüllt). Der Erzeuger liest nur das erste — daraus
   entstehen heute **43 von 1347** Missionsfamilien mit Ortsangabe. Das zweite
   Feld zeigt auf `StarMapObject`, also auf denselben Ortsknoten, den
   `scripts/datamine-missions.mjs` in Zeile 200 **bereits einliest** (2067
   Einträge). Die Kante wird nur nicht weitergegeben.

2. **Die Slot-Art wird weggeworfen.** `scripts/datamine-missions.mjs:244`
   normalisiert die Spieltexte mit `t.split('|').pop()` und behält nur das
   letzte Segment. Die Quelle unterscheidet aber: Spielort (1256×), Zielort
   (438×), Abholort (77×), Lieferort (73×) — nach der Normalisierung sind alle
   vier ununterscheidbar `{Address}` (932× in `missions.json`). Damit ist die
   Frachtroute einer Liefermission nicht mehr rekonstruierbar. Insgesamt gehen
   416 unterschiedene Slot-Arten auf ihre Endsilben zusammen.

3. **Der Datenstand ist unsichtbar.** `missions.json` stand auf CL 12326004,
   während CL 12344265 installiert war — rund 18.000 Changelists Verzug, und
   aufgefallen ist es nur, weil diese Datei ihre Kennung überhaupt mitführt.
   `mining-db` und `crafting-db` führen sie ebenfalls und waren aktuell.
   `refinery-data.json` führt sie als `meta.gameVersion`, durchgereicht aus
   `mining-db.json`. Ohne Kennung sind **drei** Dateien: `universal-items.json`,
   `dismantling-items.json` und `wikelo-trades.json` — dort kann niemand
   feststellen, gegen welchen Stand sie stimmen. `wikelo-trades.json` hat
   zusätzlich kein Erzeugerskript (63 handgepflegte Einträge, kein Datum).
   *(Korrigiert nach der Recherche: die erste Fassung dieser Zeile zählte
   `refinery-data.json` fälschlich mit — sie war nur nicht dort gesucht worden,
   wo die Kennung tatsächlich steht.)*

**D-01 — Die Ortskante wird gezogen.** `locationMissionAvailable` wird
mitgelesen und als Ort geführt, wo `localityAvailable` fehlt. Erwartung: von 43
auf mindestens 800 Missionsfamilien mit Ortsangabe.

**D-02 — Die Ortsangabe wird ehrlich grob dargestellt.** Die Kante trägt 24
verschiedene Orte auf Planeten- und Systemebene (StantonStar 537, Stanton1 361,
Stanton4 338, Stanton2 265, Stanton3 209, PyroStar 84, Delamar 9, Rest
einstellig). Sie beantwortet „welche Missionen spielen bei microTech" und
**nicht** „an welcher Station". Die Anzeige darf keine Genauigkeit vortäuschen,
die die Kante nicht hat.

**D-03 — Die Slot-Art bleibt erhalten.** Abhol-, Liefer-, Ziel- und Spielort
werden im Missionstext unterscheidbar geführt und beschriftet, statt als eine
Sorte Platzhalter zu erscheinen.

**D-04 — Jeder Datenstand nennt seinen Patch.** Die drei Dateien ohne Kennung
bekommen eine, und ein Tor meldet Verzug gegenüber der gebauten Auslieferung.
Für `wikelo-trades.json` wäre eine Changelist gelogen — handgepflegte Daten
stammen aus keinem Auslesevorgang. Dort steht stattdessen, gegen welchen Stand
zuletzt **nachgesehen** wurde, und das Tor meldet Verzug dort als WARNUNG, nie
als FEHLER (Grundsatz 3: Verzug einer Fremdquelle blockt nicht).
Das ist die dünnste Verbindung zwischen den sonst autonomen Bereichen: Sie
melden nur eine Zahl, und genau die fängt den Fall, den kein Bereich allein
sehen kann.

**Was NICHT angefasst wird:** Die Datenbeschaffung. Kein Feld wird neu erhoben.
Diese Phase reicht durch, was beim Einlesen bereits vorliegt.

**Ausdrücklich ausgeschlossen — geprüfte Sackgasse:**
`CraftingQualityLocationOverrideRecord` (12 Einträge) sieht nach einer
Ort↔Fertigung-Kante aus, führt aber bei **allen zwölf** einen leeren
Verteilungssatz. Das ist unfertige Arbeit auf Herstellerseite, keine Daten.
Wer sie in dieser oder einer späteren Phase anfassen will, muss zuerst
nachweisen, dass sich das geändert hat.

**Requirements**: keine REQ-IDs — bindend sind D-01 bis D-04.
**Depends on:** keine. Die Phase berührt nur den Missionsbereich und die
Kennungszeile der Datenstände; sie hängt an keiner Arbeit aus Phase 14–17.
**Plans:** 4/4 plans executed

**Success Criteria** (was WAHR sein muss):

  1. Mindestens 800 der 1347 Missionsfamilien tragen eine Ortsangabe —
     maschinell gezählt gegen die erzeugte `missions.json`, nicht behauptet

  2. Auf der Missionsseite lässt sich nach Ort eingrenzen, und die Trefferzahl
     stimmt mit der gezählten Kante überein

  3. Im Missionstext sind Abholort, Lieferort, Zielort und Spielort
     voneinander unterscheidbar — heute erscheinen alle vier gleich

  4. Die Ortsangabe ist als Planeten-/Systemebene erkennbar und behauptet
     keine Station; ein Sichturteil nach `WINDOWS.md` bestätigt das

  5. Alle Datenstände unter `public/assets/` und `src/data/` nennen ihre
     Patch-Kennung; ein Tor reißt bei Verzug gegenüber der Auslieferung

  6. Kein Herkunftshinweis im sichtbaren Text — `audit:site` bleibt grün

  7. Deutsche und englische Fassung sind deckungsgleich, in beiden Farbmodi

  8. `npm run build && npm run gate` grün, ebenso der Vorschau-Bau mit
     `STAGING=1`; jedes neue Tor ist einmal vorgeführt rot gewesen und in
     `scripts/lib/gate-registry.mjs` eingetragen

Plans:

- [x] 18-01-PLAN.md — Welle 1, Tracer: Ausgangsmessung als Sonde gegen die erzeugte `missions.json`, zweiter Lesepfad (`locationMissionAvailable`), sieben kuratierte Ortsnamen, Beweis am gebauten HTML (Filterzahl gleich gezählte Kante), Sperrklinke `missionenMitOrt` bei 800
- [x] 18-02-PLAN.md — Welle 2, D-02 vollständig und D-03: Regeln für Monde/Lagrange-Punkte/Rest; die Slot-Art kehrt zurück — selektiv (nur Ortsmarken), leerzeichenfrei (wegen `clip()`), lesbar beschriftet; Sperrklinke `missionsOrtsarten` bei 4; Sprachparität gezählt
- [x] 18-03-PLAN.md — Welle 3, D-04 Kennungen: `universal-items.json` bekommt `gameVersion`; `dismantling-items.json` und `wikelo-trades.json` bekommen eine Begleitdatei mit Eintragszahl statt einer Hülle (kein Leser wird angefasst); `refinery-data.json` holt seine eigene Quelle ein
- [x] 18-04-PLAN.md — Welle 4, D-04 Tor: `verify:datastand` (Kreuzvergleich der committeten Kennungen, Schiene A, acht Zusicherungen), Rot-Vorführung je FEHLER-Klasse mit Prüfsummen-Beleg, Registry + `MIN_SCRIPTS` 23→24, Schlussmessung und vier Sichturteile nach `WINDOWS.md`

### Phase 19: Der Ortskatalog trägt bis in die Chips

**Goal:** Phase 18 hat einen sauberen Ortskatalog gebaut — 49 Einträge, lesbare
Namen, keine Doubletten. Er wirkt aber nur an zwei von vier Stellen. Die
Chipliste und die Angebotstabelle der Missionsseite ziehen weiter aus dem rohen
Feld, und der Filter führt vier Einträge, die niemand bedienen kann. Diese Phase
lässt den Katalog überall dort ankommen, wo Ortsnamen sichtbar werden.

**Herkunft:** Betreiber-Abnahme 23.08.2026 (`WINDOWS.md` id 45–48). Alle sieben
Befunde stammen aus dem Hinsehen, keiner aus einem Tor — kein Prüfskript des
Projekts sieht Listenmarken, Doubletten in einer Chipreihe oder ein englisches
„And" mitten im deutschen Filter.

**Der Befund, der die Phase trägt:** Drei der sieben Punkte haben **eine**
Ursache. `MissionDetail.astro:246` rendert die Chipliste aus `m.places`, Zeile
361 die Angebotstabelle ebenso; kuratiert wurde in Phase 18 nur `localityNames`
(Zeile 228) und der Filter. Wer den Katalog baut, aber die Anzeige aus dem
Rohfeld speist, hat die Arbeit an zwei von vier Stellen getan.

**D-01 — Die Chipliste zeigt kuratierte Namen.** Heute stehen dort `Pyro` neben
`Pyro System` und `Stanton` neben `Stanton System` als getrennte Chips derselben
Sache, dazu `PYAM-FARSTAT-2-0` und `RR_P2_LEO_CLINIC`. Die feineren Orte
(`Cellin`, `Daymar`, `Calliope`) sind erwünscht und bleiben — es geht um
Doubletten und Rohform, nicht um die Auflösung.
⚠ `HUR L1`, `CRU L4`, `MIC L3` sind **nicht falsch, nur falsch geschrieben**: im
Spiel heißen sie `HUR-L1` mit Bindestrich. Der Unterstrich der Rohform wurde zu
einem Leerzeichen statt zu einem Bindestrich.

**D-02 — Region A bis D bekommen Namen.** Sie tragen zusammen **452 Missionen**
— der zweitgrößte Block der Filterliste — und sagen nichts. Aus ihren `places`
sind sie ablesbar: Region A = Pyro I + Monox, B = Bloom + Orbituary, C = Pyro
IV/V + Ignis, D = Terminus.

**D-03 — Der Filter hält, was seine Beschriftung verspricht.** Unter „Region"
stehen heute vier einzelne Stationen (Klescher Rehabilitation Facility, Rod's
Fuel 'N Supplies, Starlight Service Station, Megumi Refueling). Entweder sie
wandern auf ihre Ebene hoch, oder die Beschriftung wird ehrlich. Dazu: fünf
Rohbezeichner im Katalog (`CRU L1/L4/L5`, `PYR6 L1`, `RR P6 LEO`) und drei
Einträge mit englischem `And` im deutschen Filter (`Pyro And Nyx`, `Stanton And
Nyx`, `Stanton And Pyro`).

**D-04 — Eine Marke, eine Schreibweise je Seite.** Die Tabelle „Appears in game
as" zieht aus `m.titleVariants` und wurde von der Beschriftungsumstellung nicht
erfasst; dort steht weiter roh `Bounty Assignment: {TargetName}`. Auf derselben
Seite stehen damit beide Schreibweisen derselben Marke.

**Was NICHT angefasst wird:** die Ortskante selbst. 1180 von 1347 Familien
tragen ihren Ort, und die Zahl ist mit einer Sperrklinke festgeschrieben. Diese
Phase ändert die **Darstellung**, nicht die Erhebung.

**Bereits erledigt, gehört aber zum Anlass:** Die `.md__tags`-Listen trugen ihre
Listenmarken sichtbar mit (`ul` mit `display:flex` ohne `list-style`-Rücksetzung)
— ein Punkt rechts an jeder Pille plus ein Waisenpunkt je Zeile, auf 1180 Seiten
mit bis zu 40 Chips. Behoben in `7a0ab58`, weil die Wirkung sonst mit Phase 18
live gegangen wäre.

**Requirements**: keine REQ-IDs — bindend sind D-01 bis D-04.
**Depends on:** Phase 18 (Ortskatalog und Slot-Arten müssen stehen)
**Plans:** 0 plans

**Success Criteria** (was WAHR sein muss):

  1. Kein Ort erscheint in einer Chipreihe zweimal unter verschiedenen
     Schreibweisen — gezählt über alle 1180 Missionsseiten im gebauten `dist/`

  2. Lagrange-Punkte tragen ihre Spielschreibweise mit Bindestrich
     (`HUR-L1` statt `HUR L1`), nachgezählt gegen den Katalog

  3. Region A bis D sind benannt oder aufgelöst; die 452 Missionen dahinter
     bleiben auffindbar

  4. Unter der Filterbeschriftung „Region" steht keine einzelne Station mehr —
     oder die Beschriftung sagt, was dort steht

  5. Kein Katalogeintrag trägt einen Rohbezeichner. Die Prüfung dafür ist
     **breiter als die aus Phase 18**, die `CRU L1` und `RR P6 LEO`
     durchgelassen hat, weil sie nur nach `outpost`/`scrp`/`otlw` suchte

  6. Im deutschen Filter steht kein englisches Bindewort

  7. Auf einer Missionsseite erscheint jede Marke in genau einer Schreibweise

  8. `npm run build && npm run gate` grün, ebenso der Vorschau-Bau mit
     `STAGING=1`; DE und EN deckungsgleich, beide Farbmodi

Plans:

- [ ] TBD (run /gsd-plan-phase 19 to break down)

### Phase 20: Wikelos Angebote kommen aus dem Bestand

**Goal:** `scripts/datamine-wikelo.mjs` liest die Tauschangebote seit dem
28.08.2026 aus den Spieldateien — 69 Verträge, 68 mit vollständiger
Gegenleistung, 285 Warenposten, keiner ohne Anzeigenamen. Die Seite liest
davon nichts: sie hängt weiter an der handgepflegten `wikelo-trades.json` mit
63 Einträgen. Diese Phase hängt die Anzeige um.

**Herkunft:** Betreiber-Rückfrage 28.08.2026 („hast du die Wikelo-Daten aus den
Spieldaten geholt?"). Antwort war nein — und die Annahme dahinter, es gebe dort
keine Tauschtabelle, war seit dem 23.08. im Gedächtnis festgeschrieben und
falsch. Sie hielt sich, weil zweimal die EIGENE `missions.json` geprüft wurde
statt des Bestands; genau das Muster aus [[verify-by-looking]].

**Was die Extraktion kann:** Wikelo heißt intern `TheCollector`, die
Gegenleistung `haulingOrders` — deshalb fand keine Namenssuche sie. Abgleich
gegen die Gegenquelle: **57 von 59 deckungsgleich**, Titel und Mengen. Die zwei
Abweichungen sprechen für den Bestand (bei „Clipper Fight Now" steht dort
Metamaterial Test #152, drüben #146). Sieben Verträge kennt nur der Bestand.

**Was sie NICHT kann, und warum es keine Ersetzung wird:** die Handliste trägt
Bilder (`img`), die Komponentenlisten der Belohnungsschiffe (`comps`) und die
Reputationsstufe als lesbaren Text (`rep`). Nichts davon steht in den
Spieldateien. Die Phase baut also eine ZUSAMMENFÜHRUNG: Angebote und Mengen
maschinell, Bild und Ausstattung kuratiert — mit Herkunft je Feld, wie es
[[game-data-database]] verlangt.

**D-01 — Zusammenführung statt Ersatz.** Ein Erzeuger, der die extrahierten
Verträge mit den kuratierten Feldern der Handliste vereint. Schlüssel ist die
Vertrags-Id, nicht der Anzeigename (⚠ [[display-name-not-a-key]]).

**D-02 — Die sieben unbekannten Verträge.** „Armor with horn and string",
„Heavy and Bright", „New Move Big Starlancer Ship", „Noxy Mod", „Too Much
Gun", „Very Hungry", „Wikelo Arrive to System" stehen im Bestand und in
keiner Liste — sieben, nicht acht. Der ursprünglich mitgeführte achte Name,
„ICC Special Delivery", stammt aus dem älteren, im Register-Eintrag id 51
selbst als überholt dokumentierten ersten Fund (Basis: `missions.json` mit
56 Familien, vor dem Bau von `scripts/datamine-wikelo.mjs`) und kommt im
heutigen 69-Vertrags-Bestand unter keinem Titel und keinem `debugName` vor —
gestrichen (Phase 20, Plan 02, Register-Einträge id 55/56). Erst prüfen,
welche der sieben ausgelieferte Angebote sind und welche Werkstattreste —
dieselbe Trennung wie bei den neun leeren Bauplan-Seiten (Register id 53).

**D-03 — Die ATLS-Farbaufträge fehlen nicht, sie tragen nur keinen
auflösbaren Namen.** Die drei ATLS-Zusatzaufträge (`ATLS Cool Metal Color`,
`ATLS Orange Line`, `ATLS Snowland Color`) sind NICHT entfernt oder
umbenannt — sie existieren im 4.10-Bestand, nur ohne `Title`-Feld
(`titel: null`), weshalb ein titelbasierter Vergleich sie übersehen hat. Die
Frage ist nicht mehr „entfernt oder umbenannt?", sondern „welcher
Farbauftrag trägt welchen Namen, welches Bild?" — `RedNBlue` = „ATLS GEO
'Cool Metal'" ist bereits per exaktem Materialabgleich gelöst (Plan 01);
`OrangeNGrey` und `WhiteNGreen` bleiben offen (Register-Eintrag id 56).

**D-04 — Klinke und Verzugstor.** `wikelo-gamefiles.json` braucht eine
Sperrklinke in `metrics-baseline.mjs` (Verträge, Warenposten) und einen Platz
in `verify:datastand`; die Handpflege-Zeile dort wird dann überflüssig.

**Erfolgskriterien:**

1. Die Wikelo-Seite zeigt Angebote und Mengen aus dem Bestand, nicht aus der
   Handliste — und behält Bilder, Ausstattung und Reputationstext.

2. Register id 51 (Wikelo-Verzug) ist geschlossen: die Kennung wandert mit dem
   Datenlauf, nicht mit einer Sichtung.

3. Eine Klinke fängt einen Rückgang der Vertragszahl.
4. `npm run build && npm run gate` grün, normal UND mit `STAGING=1`.

**Plans:** 2/4 plans executed

Plans:
**Wave 1**

- [x] 20-01-PLAN.md — Tracer: die Zusammenführung end-to-end an einer Karte (Erzeuger, kuratierte Zulieferdatei, `sync:wikelo`, COVERAGE.md)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 20-02-PLAN.md — Kuration: die 63 Handeinträge auf Vertrags-`id`s abbilden; offene Urteile ins Register, D-02/D-03 in der ROADMAP berichtigen

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 20-03-PLAN.md — D-04: zwei Sperrklinken mit Ablesern, Wikelo von Handpflege nach maschinell im Verzugstor, dreimal vorgeführt rot, Register id 51 schließen

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 20-04-PLAN.md — Anzeige: Quellenangabe berichtigen, Schlussmessung der vier Erfolgskriterien, Sichtrunde ins Register
