# Requirements: VerseBase — UI-/Design-Feinschliff

**Defined:** 2026-07-28
**Core Value:** Spielgenaue Daten, direkt aus den Spieldateien gewonnen — wenn die Zahlen nicht stimmen, ist die Seite wertlos.

> Milestone-Kontext: Das Produkt ist gebaut und live. Dieser Meilenstein betrifft
> ausschließlich die Oberfläche. Der Bestand ist in `.planning/PROJECT.md` unter
> „Validated" verzeichnet und wird hier nicht wiederholt.

## v1 Requirements

### Wortmarke & Kopfleiste

- [x] **MARK-01**: Beim ungescrollten Aufruf der Startseite steht die Überschrift „VerseBase" oben mittig im Hero
- [x] **MARK-02**: Beim ungescrollten Aufruf der Startseite ist die Wortmarke in der Kopfleiste nicht sichtbar
- [x] **MARK-03**: Beim Runterscrollen wandert die Hero-Überschrift scroll-verknüpft in Position und Größe der Kopfleisten-Wortmarke — als stetiger Verlauf, nicht als harter Umschaltpunkt
- [x] **MARK-04**: Nach abgeschlossener Wandlung trägt die Kopfleiste den Schriftzug und dieser bleibt ein Verweis auf die Startseite mit `aria-label`
- [x] **MARK-05**: Auf allen Seiten ohne Hero ist die Kopfleisten-Wortmarke unverändert sofort sichtbar
- [x] **MARK-06**: Die Wandlung erzeugt keinen Layout-Sprung — es wird keine Layout-Eigenschaft animiert. Bewegung und Größe laufen über `transform`, die Übergabe über `opacity`; dazu `color` als reine Malen-Eigenschaft, weil die Schrift unterwegs die Unterlage wechselt (ursprünglich als „ausschließlich `transform` und `opacity`" formuliert — in Phase 1 präzisiert, siehe 01-SUMMARY.md)
- [x] **MARK-07**: Unter 580 px Breite zeigt die Kopfleiste weiterhin nur das Monogramm, wie bisher
- [x] **MARK-08**: Die Wandlung läuft in der deutschen und der englischen Startseite identisch

### Bewegung & Zugänglichkeit

- [x] **MOTN-01**: Bei `prefers-reduced-motion: reduce` entfällt die scroll-verknüpfte Bewegung; Überschrift und Kopfleiste bleiben in jedem Scroll-Zustand lesbar und bedienbar
- [x] **MOTN-02**: Jede Seite hat genau eine sichtbare `h1`
- [x] **MOTN-03**: Der Effekt hängt am bestehenden Scroll-Listener in `SiteNav.astro`; es kommt kein zweiter globaler Scroll-Listener hinzu
- [x] **MOTN-04**: Die Wandlung läuft ruckelfrei — die Arbeit pro Bild bleibt auf Compositor-Eigenschaften beschränkt

### Farbmodi

- [x] **THEME-01**: Die Wandlung ist in Hell- und Dunkelmodus gleichwertig lesbar — sowohl über dem Hero-Foto als auch über der Seitenfläche
- [ ] **THEME-02**: Kein generierter `:root[data-theme="light"]`-Block wird von Hand verändert; Hellwerte entstehen über `npm run theme`

### Typografie & Bewegungsbild

- [ ] **TYPO-01**: Schriftgrade und Laufweiten der Kopfleiste und der Startseite folgen einer gemeinsamen Skala statt seitenlokaler Einzelwerte
- [ ] **TYPO-02**: Übergangsdauern und Beschleunigungskurven sind über die Startseite hinweg vereinheitlicht
- [ ] **TYPO-03**: Kopfleiste und Startseite lesen sich als ein zusammenhängendes Bewegungsbild, nicht als zwei unabhängige Zustände

### Überlagerungen

- [ ] **LAYER-01**: Die in `CONCERNS.md` als Class B verzeichneten dekorativen Überlagerungen über Text sind abgetragen
- [ ] **LAYER-02**: Text über Bildmotiven erreicht in beiden Farbmodi einen belegten Kontrastwert

### Sprachparität

- [ ] **SYNC-01**: Jede Änderung an einer Startseiten- oder Layout-Datei trifft die EN- und die DE-Fassung im selben Arbeitsschritt
- [ ] **SYNC-02**: Ein Prüfschritt belegt für die geänderten Seitenpaare, dass Struktur und Stil deckungsgleich sind — nicht nur die Absicht

### Ambiente-Effekte

> Quelle: Rückmeldung eines Besuchers am 29.07.2026. Er nutzt die Seite vor allem
> für Waffen- und Modulwerte von Schiffen und für Crafting-Materiallisten. Der
> Schein am Mauszeiger und die schwebenden Staubpartikel lenken beim Suchen eines
> Wertes in einer Liste ab, tragen keine Information und kosten Rechenleistung,
> die beim Spielen dem Spiel fehlt.

- [x] **FX-01**: Der Schein um den Mauszeiger ist ersatzlos entfernt — Element (`.cursorglow`), CSS-Regel und der `pointermove`-Listener, der `--mx`/`--my` auf `<html>` schreibt
- [x] **FX-02**: Beim Erstaufruf startet keine Partikel-Animation; für `#stars`, `#embers` und `#dust` läuft keine `requestAnimationFrame`-Schleife
  > `#dust` kam erst bei der Planung ans Licht: `sc-4-9-0.astro` (EN+DE) trägt eine
  > dritte Partikel-Leinwand („Staub-Partikel: warme Motes, driften seitwärts"),
  > die bei der ersten Erhebung durch die Suche nach `stars|embers` fiel. Sie ist
  > wörtlich das, was die Rückmeldung „dust particles floating in the background"
  > nennt — und sitzt auf der Seite des aktuellen Patches.

- [x] **FX-03**: Eine gespeicherte Wahl schaltet die Partikel ein; sie gilt site-weit und überdauert Seitenwechsel und Sitzung
- [x] **FX-04**: Der Umschalter ist für alle Besucher erreichbar — anders als die Farbmodus-Wahl ist er nicht auf Admins beschränkt — und in DE und EN beschriftet
- [x] **FX-05**: Das Abschalten beendet eine laufende Schleife ohne Neuladen und hinterlässt kein eingefrorenes Standbild
- [x] **FX-06**: `prefers-reduced-motion: reduce` bleibt wirksam und schlägt die gespeicherte Wahl
- [x] **FX-07**: Parallaxe, Ken Burns, Scanlines/Vignette und Scroll-Reveal bleiben unverändert — sie waren nicht Teil der Rückmeldung
- [ ] **FX-08**: Fremde `pointermove`-Nutzer bleiben unangetastet: Holo-Viewer-Orbit (`assets/holo-viewer.js`) und Bildzuschnitt im Konto (`src/scripts/account-dashboard.ts`)

### Werkzeug-Dokumentation

> Quelle: dieselbe Rückmeldung. „Diese Werkzeuge sind sehr mächtig, aber nur wenn
> der Nutzer weiß, wofür sie da sind und wie man sie benutzt." Der Zweck steht vor
> der Bedienung — wer nicht weiß, wofür ein Werkzeug gut ist, liest keine Anleitung.

- [ ] **DOC-01**: Jedes Werkzeug trägt einen aufklappbaren Abschnitt, der zuerst den Zweck nennt und dann die Bedienung
- [ ] **DOC-02**: Ein Hilfe-Schalter heftet auf der aktuellen Ansicht an jedes bedienbare Element eine Erklärung
- [ ] **DOC-03**: Die Hilfe erreicht auch client-seitig gerendertes Markup (`assets/item-finder-app.js`, `assets/crafting-app.js`)
- [ ] **DOC-04**: Alle Erklärungen liegen in DE und EN vollständig vor; keine Fassung fällt auf die andere Sprache zurück
- [ ] **DOC-05**: Die Hilfe ist per Tastatur zu öffnen, zu durchlaufen und mit Esc zu verlassen
- [ ] **DOC-06**: Ungeöffnet kostet die Hilfe nichts — kein Nachladen, keine Schleife, kein spürbares Seitengewicht
- [ ] **DOC-07**: Abgedeckt sind Item Finder, Crafting, Mining, Schiffe, Missionen, Refinery, Precision Jump, Patch-Archiv, Wikelo's Emporium, Rüstungssets

### Spenden-Unterstützung

> Anlass: Der Entwicklungsrechner startet wegen eines defekten Netzteils zufällig
> neu — Entwickeln wird dadurch mühsam (Nutzerentscheidung 31.07.2026). Das ist
> das erklärte Spendenziel; es wird so benannt und nicht als abstrakte
> „Serverkosten" verkleidet. Diese Sektion hebt für Phase 5 die „Out of Scope"-
> Zeilen zu serverseitiger Logik und Konto-Funktionen ausdrücklich auf: ohne
> Edge Function gibt es keinen sicheren Zahlungsweg.
>
> Zahlungswege laut Nutzerentscheidung: **Stripe Checkout** (Hauptweg) und
> **Ko-fi** (Alternative). PayPal ausdrücklich nicht.

**Spenden abgeben**

- [ ] **DON-01**: Ein Besucher wählt einen Betrag (Vorschläge + freie Eingabe) und ob einmalig oder monatlich, und landet auf der von Stripe gehosteten Checkout-Seite
- [ ] **DON-02**: Spenden funktioniert ohne Konto und ohne Anmeldung
- [ ] **DON-03**: Ko-fi ist als zweiter, gleichwertig sichtbarer Weg verlinkt
- [ ] **DON-04**: Nach der Zahlung landet der Spender auf einer Dankesseite, die den Erfolg bestätigt; ein Abbruch führt zurück auf die Spendenseite ohne Fehlermeldung

**Sicherheit & Wahrheit der Zahlen**

- [ ] **DON-05**: Die Checkout-Sitzung wird serverseitig in einer Supabase Edge Function angelegt; der geheime Stripe-Schlüssel taucht in keinem ausgelieferten Byte auf
- [ ] **DON-06**: Der Betrag wird serverseitig gegen Ober- und Untergrenze geprüft — ein manipulierter Client kann keinen beliebigen Betrag erzwingen
- [ ] **DON-07**: Spendenzeilen entstehen ausschließlich im Webhook nach geprüfter Stripe-Signatur; kein Client-Schreibrecht auf die Tabelle, Doppelzustellung erzeugt keine Dublette
- [ ] **DON-08**: Öffentlich lesbar ist nur, was öffentlich sein soll (Anzeigename, Betrag, Datum, Nachricht) — nie E-Mail, Zahlungs-ID oder Kunden-ID
- [ ] **DON-09**: Ohne hinterlegte Schlüssel läuft das Feature im sichtbaren Demo-Modus (Muster `FEEDBACK_DEMO`): es behauptet keine Zahlen und bricht nicht

**Darstellung**

- [ ] **DON-10**: Eine eigene Spendenseite in DE und EN erklärt, wofür das Geld ist, und zeigt Zielstand und Unterstützer-Wand aus echten Zahlungsdaten
- [ ] **DON-11**: Ein Spenden-Zugang ist site-weit erreichbar (Navigation und Fuß), ohne die bestehende Kopfleiste zu überladen
- [ ] **DON-12**: Genannt wird ein Unterstützer nur nach ausdrücklicher Zustimmung; Vorgabe ist anonym, und ein selbst gewählter Anzeigename wird vor der Anzeige entschärft

**Pflichten des Bestands**

- [ ] **DON-13**: Die CSP kennt Stripe (Skript, Frame, Verbindung), bevor die Seite live geht; `npm run audit:csp` bleibt grün
- [ ] **DON-14**: Die Datenschutzerklärung nennt Stripe und Ko-fi als Empfänger mit Zweck; `npm run verify` und `npm run audit:site` bleiben grün, Seitenpaare DE/EN bleiben deckungsgleich

## v2 Requirements

### Sprachparität

- **SYNC-03**: Ein Build- oder Audit-Schritt vergleicht alle 67 EN/DE-Seitenpaare automatisch und schlägt bei Struktur-Drift fehl
- **SYNC-04**: Die von Hand gedoppelte Seiten-Chrome der driftenden Paare (`precision-jump`, DE-Konto-Seiten) ist in gemeinsame Komponenten zusammengeführt

### Typografie & Bewegungsbild

- **TYPO-04**: Die vereinheitlichte Skala gilt über die Startseite hinaus für alle handgebauten Seiten

## Out of Scope

| Feature | Reason |
|---------|--------|
| Serverseitige Renderlogik | Statisches Astro-Build hinter nginx — geht nur als Supabase Edge Function |
| Ausbau der Datamine-Pipeline | Dieser Meilenstein ist ausdrücklich Oberfläche, nicht Daten |
| Konto-, Community- und Discord-Funktionen | Bestand bleibt, wird in diesem Meilenstein aber nicht vorangetrieben |
| CSS-Framework oder Bundler für `assets/` | Handgeschriebenes CSS/JS ist bewusste Entscheidung, nicht Altlast |
| Redesign einzelner Patch-Seiten | Jede Patch-Seite hat absichtlich ihre eigene Design-Welt |
| Vollständige Zusammenführung aller 67 Seitenpaare | Zu groß für diesen Meilenstein — als SYNC-04 nach v2 verschoben |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MARK-01 | Phase 1 | Complete |
| MARK-02 | Phase 1 | Complete |
| MARK-03 | Phase 1 | Complete |
| MARK-04 | Phase 1 | Complete |
| MARK-05 | Phase 1 | Complete |
| MARK-06 | Phase 1 | Complete |
| MARK-07 | Phase 1 | Complete |
| MARK-08 | Phase 1 | Complete |
| MOTN-01 | Phase 1 | Complete |
| MOTN-02 | Phase 1 | Complete |
| MOTN-03 | Phase 1 | Complete |
| MOTN-04 | Phase 1 | Complete |
| THEME-01 | Phase 1 | Complete |
| FX-01 | Phase 1.1 | Complete |
| FX-02 | Phase 1.1 | Complete |
| FX-03 | Phase 1.1 | Complete |
| FX-04 | Phase 1.1 | Complete |
| FX-05 | Phase 1.1 | Complete |
| FX-06 | Phase 1.1 | Complete |
| FX-07 | Phase 1.1 | Complete |
| FX-08 | Phase 1.1 | Pending |
| DOC-01 | Phase 1.2 | Pending |
| DOC-02 | Phase 1.2 | Pending |
| DOC-03 | Phase 1.2 | Pending |
| DOC-04 | Phase 1.2 | Pending |
| DOC-05 | Phase 1.2 | Pending |
| DOC-06 | Phase 1.2 | Pending |
| DOC-07 | Phase 1.2 | Pending |
| TYPO-01 | Phase 2 | Pending |
| TYPO-02 | Phase 2 | Pending |
| TYPO-03 | Phase 2 | Pending |
| LAYER-01 | Phase 3 | Pending |
| LAYER-02 | Phase 3 | Pending |
| SYNC-01 | Phase 4 | Pending |
| SYNC-02 | Phase 4 | Pending |
| THEME-02 | Phase 4 | Pending |
| DON-01 | Phase 5 | Pending |
| DON-02 | Phase 5 | Pending |
| DON-03 | Phase 5 | Pending |
| DON-04 | Phase 5 | Pending |
| DON-05 | Phase 5 | Pending |
| DON-06 | Phase 5 | Pending |
| DON-07 | Phase 5 | Pending |
| DON-08 | Phase 5 | Pending |
| DON-09 | Phase 5 | Pending |
| DON-10 | Phase 5 | Pending |
| DON-11 | Phase 5 | Pending |
| DON-12 | Phase 5 | Pending |
| DON-13 | Phase 5 | Pending |
| DON-14 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-28*
*Last updated: 2026-07-31 — Spenden-Unterstützung (DON-01…DON-14) für Phase 5 ergänzt*
