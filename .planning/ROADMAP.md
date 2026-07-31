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
- [ ] **Phase 2: Schrift- und Bewegungsskala** - Eine gemeinsame Skala für Schriftgrade und Übergänge statt seitenlokaler Einzelwerte
- [ ] **Phase 3: Überlagerungen entstapeln** - Class-B-Befund abtragen, Textkontrast über Bildmotiven belegen
- [ ] **Phase 4: Sprachparität absichern** - Deckungsgleichheit der Seitenpaare nachweisbar statt behauptet
- [ ] **Phase 5: Spenden-Unterstützung** - Ein Spendenweg, der tatsächlich Geld annimmt: Stripe Checkout + Ko-fi, eigene Seite, Ziel und Unterstützer-Wand

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
  7. Abgedeckt sind Item Finder, Crafting, Mining, Schiffe, Missionen, Refinery, Precision Jump, Patch-Archiv, Wikelo's Emporium und Rüstungssets

**Plans**: 2 plans

Plans:

- [ ] 01.2-01: Hilfe-Mechanik bauen — aufklappbarer Zweck-/Bedienungsabschnitt und der Schalter, der Erklärungen an die Elemente heftet
- [ ] 01.2-02: Erklärtexte für alle zehn Werkzeuge schreiben und anheften, DE und EN

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

> **Erweitert den Meilenstein bewusst über die Oberfläche hinaus.** Die Roadmap
> war auf UI-Feinschliff abgesteckt; diese Phase bringt eine Datenbanktabelle,
> zwei Edge Functions und Zahlungsverkehr mit. Anlass ist kein Design-Wunsch,
> sondern ein realer Engpass: der Entwicklungsrechner startet wegen eines
> defekten Netzteils zufällig neu (Nutzerentscheidung 31.07.2026). Die
> „Out of Scope"-Zeilen zu serverseitiger Logik und Konto-Funktionen in
> REQUIREMENTS.md sind für diese Phase ausdrücklich aufgehoben.

**Goal**: Ein Besucher, der die Seite nützlich findet, kann in unter einer Minute Geld geben — mit frei gewähltem Betrag, einmalig oder monatlich, ohne Konto, in DE und EN — und das Geld kommt tatsächlich an. Die Seite sagt ehrlich, wofür (Netzteil/Rechner-Reparatur), zeigt den erreichten Stand aus echten Zahlungsdaten statt aus einer gepflegten Zahl, und nennt jeden Unterstützer nur, wenn er das ausdrücklich will.
**Mode:** mvp
**Depends on**: Nichts aus diesem Meilenstein — die Phase fasst weder Startseite noch Kopfleisten-Wandlung an und kann vor Phase 2–4 laufen.
**Requirements**: DON-01 … DON-14
**Success Criteria** (what must be TRUE):

  1. Eine echte Zahlung im Stripe-Testmodus läuft vollständig durch: Betrag wählen → Checkout → Rückkehr auf die Dankesseite → Zeile in der Datenbank, geschrieben ausschließlich vom Webhook
  2. Der Webhook weist jede Anfrage ohne gültige Stripe-Signatur ab; die Datenbank ist für anonyme Clients nur lesbar, und auch das nur für die freigegebenen Felder
  3. Ohne hinterlegte Schlüssel steht das Feature sichtbar im Demo-Modus (wie `FEEDBACK_DEMO`) und behauptet keine Zahlen — es bricht nicht und täuscht nichts vor
  4. Der Spendenweg ist in DE und EN vollständig vorhanden, in beiden Farbmodi lesbar, bis 360 px bedienbar und per Tastatur vollständig bedienbar
  5. `npm run verify`, `npm run audit:site` und `npm run audit:csp` laufen grün — die CSP kennt Stripe, bevor der erste Besucher darauf stößt
  6. Die Datenschutzerklärung nennt Stripe und Ko-fi als Empfänger, bevor die Seite live geht

**Plans**: wird von `/gsd-plan-phase 5` festgelegt

Plans:

- [ ] TBD (`/gsd-plan-phase 5` bricht die Phase in Pläne herunter)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 1.2 → 2 → 3 → 4 → 5
(Phase 5 hängt an keiner Vorgängerphase und wird auf Wunsch vorgezogen.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Wortmarken-Wandlung | 2/2 | Complete | 2026-07-28 |
| 1.1 Ambiente-Effekte stilllegen | 2/3 | In Progress|  |
| 1.2 Werkzeuge erklären | 0/2 | Not started | - |
| 2. Schrift- und Bewegungsskala | 0/2 | Not started | - |
| 3. Überlagerungen entstapeln | 0/2 | Not started | - |
| 4. Sprachparität absichern | 0/2 | Not started | - |
| 5. Spenden-Unterstützung | 0/? | Planning | - |
