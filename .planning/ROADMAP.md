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
- [ ] **Phase 1.1: Ambiente-Effekte stilllegen** (INSERTED) - Mauszeiger-Schein ersatzlos raus, Partikel nur noch auf ausdrücklichen Wunsch
- [ ] **Phase 1.2: Werkzeuge erklären** (INSERTED) - Jedes Werkzeug sagt, wofür es da ist und wie man es bedient
- [ ] **Phase 1.3: Datenschicht aufraeumen** (INSERTED) - Reste alter Datenläufe raus, falsche Quellenangabe weg, Datenstand auf den laufenden Client
- [ ] **Phase 1.4: Fahrzeug-Katalog auf Spieldaten** (INSERTED) - Der Schiffskatalog kommt aus der eigenen Extraktion statt aus der Wiki-API
- [ ] **Phase 2: Schrift- und Bewegungsskala** - Eine gemeinsame Skala für Schriftgrade und Übergänge statt seitenlokaler Einzelwerte
- [ ] **Phase 3: Überlagerungen entstapeln** - Class-B-Befund abtragen, Textkontrast über Bildmotiven belegen
- [ ] **Phase 4: Sprachparität absichern** - Deckungsgleichheit der Seitenpaare nachweisbar statt behauptet
- [ ] **Phase 5: Spenden-Unterstützung** - Ein Unterstützen-Weg, der tatsächlich Geld annimmt: PayPal-Link + Ko-fi, eigene Seite in der Richtung „Instandsetzung"
- [x] **Phase 6: Schiffe: Rollen- und Merkmalsfilter** - Granulare, spielgenaue Filter statt acht Grobtypen
- [x] **Phase 7: Komponenten-Filter für Schiffe** - Schiffsliste filtert nach Steckplatz-Größe je Bauteilart

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

**Plans**: 2/5 plans executed

Plans:

- [x] 01.2-01-PLAN.md — Leitschuss: Hilfe-Mechanik end-to-end am Item Finder (Katalog ohne Sprachrückfall, ToolHelp-Bauteil, Stufe-2-Maschine, Prüfskript)
- [x] 01.2-02-PLAN.md — Crafting, Mining und Refinery-Finder anheften; zwei Hilfen auf einer Seite
- [ ] 01.2-03-PLAN.md — Patch-Archiv, Missionen, Rüstungssets und Wikelo anheften; Platzierung ohne Filterleiste
- [ ] 01.2-04-PLAN.md — Schiffe (zwei handgepflegte Seitendateien) und Precision Jump anheften
- [ ] 01.2-05-PLAN.md — Refinery-Tracker (kontogebunden) anheften; Phasen-Tor auf 11 von 11

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

**Plans**: 2 plans

Plans:

- [ ] 02-01: Schriftskala erheben und als Tokens zusammenführen
- [ ] 02-02: Übergangsdauern und Kurven vereinheitlichen

### Phase 3: Überlagerungen entstapeln

**Goal**: Der in CONCERNS.md als Class B verzeichnete Befund ist abgetragen — Text über Bildmotiven steht nicht mehr hinter gestapelten Deckkraftschichten, und der erreichte Kontrast ist gemessen statt geschätzt.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: LAYER-01, LAYER-02
**Success Criteria** (what must be TRUE):

  1. Kein Text steht mehr hinter mehr als einer dekorativen Deckkraftschicht
  2. Für jede betroffene Stelle liegt ein gemessener Kontrastwert für Hell- und Dunkelmodus vor
  3. Die Bildmotive tragen die Seite optisch weiterhin — die Entstapelung hat sie nicht flachgeschleift

**Plans**: 2 plans

Plans:

- [ ] 03-01: Betroffene Stellen aus CONCERNS.md Class B erheben und Kontrast messen
- [ ] 03-02: Überlagerungen zusammenführen und Werte erneut messen

### Phase 4: Sprachparität absichern

**Goal**: Für die in diesem Meilenstein angefassten Seitenpaare ist die Deckungsgleichheit von Struktur und Stil nachgewiesen, nicht bloß behauptet — und der Nachweis lässt sich wiederholen.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SYNC-01, SYNC-02, THEME-02
**Success Criteria** (what must be TRUE):

  1. Für jedes angefasste Seitenpaar belegt ein wiederholbarer Prüfschritt, dass EN und DE dieselbe Struktur und dieselben Stilregeln tragen
  2. Der Prüfschritt schlägt fehl, wenn eine Sprachfassung nachträglich auseinanderläuft
  3. Kein generierter Hellmodus-Block wurde von Hand verändert; die Hellwerte entstehen weiterhin über `npm run theme`

**Plans**: 2 plans

Plans:

- [ ] 04-01: Prüfschritt für die Deckungsgleichheit der angefassten Seitenpaare bauen
- [ ] 04-02: Prüfschritt in `npm run verify` bzw. `audit:site` einhängen und Hellmodus-Generierung bestätigen

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 1.2 → 2 → 3 → 4 → 5 → 6 → 7
(Phase 5 und Phase 6 hängen an keiner Vorgängerphase und werden auf Wunsch vorgezogen.
Phase 6 lief am 02.08.2026 vorab durch, während 1.1 noch offen war. Phase 7 setzt auf Phase 6 auf.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Wortmarken-Wandlung | 2/2 | Complete | 2026-07-28 |
| 1.1 Ambiente-Effekte stilllegen | 2/3 | In Progress|  |
| 1.2 Werkzeuge erklären | 2/5 | In Progress|  |
| 2. Schrift- und Bewegungsskala | 0/2 | Not started | - |
| 3. Überlagerungen entstapeln | 0/2 | Not started | - |
| 4. Sprachparität absichern | 0/2 | Not started | - |
| 5. Spenden-Unterstützung | 0/3 | Planned (PayPal) | - |
| 6. Schiffe: Rollen- und Merkmalsfilter | 3/3 | Complete | 2026-08-02 |
| 7. Komponenten-Filter für Schiffe | 3/3 | Complete | 2026-08-03 |
