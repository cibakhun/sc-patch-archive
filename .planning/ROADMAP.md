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

- [ ] **Phase 1: Wortmarken-Wandlung** - Hero-Überschrift oben mittig, scroll-verknüpfte Wandlung in die Kopfleiste
- [ ] **Phase 2: Schrift- und Bewegungsskala** - Eine gemeinsame Skala für Schriftgrade und Übergänge statt seitenlokaler Einzelwerte
- [ ] **Phase 3: Überlagerungen entstapeln** - Class-B-Befund abtragen, Textkontrast über Bildmotiven belegen
- [ ] **Phase 4: Sprachparität absichern** - Deckungsgleichheit der Seitenpaare nachweisbar statt behauptet

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
- [ ] 01-01: Hero-Überschrift nach oben mittig, Kopfleisten-Wortmarke auf der Startseite am Seitenanfang zurückhalten — in beiden Sprachfassungen
- [ ] 01-02: Scroll-verknüpfte Wandlung am bestehenden Listener, inklusive reduzierter Bewegung, Farbmodi und schmaler Ansichten

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Wortmarken-Wandlung | 0/2 | Not started | - |
| 2. Schrift- und Bewegungsskala | 0/2 | Not started | - |
| 3. Überlagerungen entstapeln | 0/2 | Not started | - |
| 4. Sprachparität absichern | 0/2 | Not started | - |
