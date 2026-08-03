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
> **UMGESTELLT 02.08.2026 — Stripe ist raus, PayPal ist der Weg.** Der Betreiber
> kann Stripes Identitätsprüfung nicht erbringen (Ausweis nicht verfügbar), und
> ohne sie zahlt Stripe kein Geld aus. Gewählt: **PayPal als einfacher Link**
> (kein Server, keine Datenbank, keine Edge Function), **Ko-fi** bleibt zweiter
> Weg.
>
> Das ist eine echte Verkleinerung: ein PayPal-Link hat keinen Webhook und damit
> keine Datenquelle. Fortschrittsbalken, Unterstützer-Wand, Moderation,
> Profil-Abzeichen und monatliche Unterstützung entfallen ersatzlos. Die
> gestrichenen Anforderungen sind unten als solche gekennzeichnet statt gelöscht
> — sie sind die Vorlage für eine spätere Phase mit PayPal-Geschäftskonto.

**Unterstützen (PayPal-Link)**

- [ ] **DON-01**: Ein Besucher wählt einen Betrag (Vorschläge 3/5/10/25 €, 5 € vorgewählt, plus freie Eingabe) und landet mit genau diesem Betrag bei PayPal — PayPal.me nimmt ihn im Pfad entgegen, die Auswahl steuert also wirklich etwas
- [ ] **DON-02**: Unterstützen funktioniert ohne Konto und ohne Anmeldung
- [ ] **DON-03**: Ko-fi ist als zweiter, nachgeordneter Weg verlinkt — und ausgeblendet, solange kein Ko-fi-Name hinterlegt ist
- [ ] **DON-31**: Der Empfänger steht als GENAU EINE Konstante in `src/consts.ts`. Solange dort der Platzhalter steht, läuft die Seite sichtbar im Demo-Modus (Muster `FEEDBACK_DEMO`) und kein Knopf zeigt ins Leere

**Wahrhaftigkeit**

- [ ] **DON-09**: Ohne hinterlegten Empfänger steht das Feature sichtbar im Demo-Modus, behauptet keine Zahlen und bricht nicht
- [ ] **DON-27**: **Kein Fortschrittsbalken.** Ein PayPal-Link liefert keine Zahlungsdaten; eine handgepflegte Zahl könnte veralten und würde genau die Glaubwürdigkeit beschädigen, die diese Seite trägt. Das Ziel steht stattdessen im Fließtext
- [ ] **DON-28**: **Keine Unterstützer-Wand.** Gleiche Begründung — keine Datenquelle, keine erfundene Liste
- [ ] **DON-26**: Keine erfundenen Kennzahlen zu Ausfallhäufigkeit oder Zeitraum. Die Kopie bleibt qualitativ. Die einzigen Zahlen auf der Seite sind die Betragsstufen und der Zielbetrag im Text

**Darstellung**

- [ ] **DON-10**: Eine eigene Unterstützen-Seite in DE und EN erklärt in der Gestaltungsrichtung „Instandsetzung", wofür das Geld ist — Kern der Aussage ist der Arbeitsverlust durch die unangekündigten Abstürze, nicht der Sachschaden
- [ ] **DON-11**: Ein Unterstützen-Zugang ist site-weit erreichbar (Fuß und Menü) plus als Streifen am Ende der Werkzeugseiten, ohne die Kopfleiste anzufassen
- [ ] **DON-29**: Nur einmalige Unterstützung. Der Umschalter einmalig/monatlich entfällt ersatzlos, statt eine Möglichkeit vorzutäuschen, die PayPal.me nicht hat

**Pflichten des Bestands**

- [ ] **DON-13**: `npm run audit:csp` bleibt grün. Beim Weiterleitungs-Link zu PayPal ist wie bei Stripe **kein** neuer CSP-Eintrag nötig — eine Navigation unterliegt der CSP nicht. Die Weiterleitung erfolgt als normaler `<a href>` bzw. `location.href`, **nie** als Formular-POST (der fiele unter `form-action` und würde still blockiert)
- [ ] **DON-14**: Die Datenschutzerklärung nennt PayPal und Ko-fi als Empfänger mit Zweck; `npm run verify` und `npm run audit:site` bleiben grün, die Seitenpaare DE/EN bleiben deckungsgleich

**Gestrichen mit der PayPal-Umstellung (02.08.2026) — Vorlage für eine spätere Phase**

Diese Anforderungen setzten einen signaturgeprüften Webhook voraus. Ein PayPal-Link
hat keinen. Sie werden NICHT gelöscht: sobald ein PayPal-Geschäftskonto mit
Webhook existiert, sind sie die fertige Grundlage. `05-RESEARCH.md` § Datenschicht
ist anbieterneutral und bleibt gültig.

- ~~**DON-04**~~: Dankesseite nach der Zahlung — PayPal kehrt nicht kontrolliert zurück
- ~~**DON-05**~~: Checkout-Sitzung serverseitig anlegen — es gibt keinen Server mehr
- ~~**DON-06**~~: Betragsprüfung serverseitig — der Betrag steht im Link, PayPal zeigt ihn vor der Zahlung an
- ~~**DON-07**~~: Zeilen entstehen nur im Webhook nach Signaturprüfung — keine Tabelle
- ~~**DON-08**~~: Öffentliche View mit ausgewählten Spalten — keine Tabelle
- ~~**DON-12**~~: Nennung nur nach Zustimmung, Anzeigename entschärft — keine Wand

### Schiffe: Rollen- und Merkmalsfilter

> Quelle: Nutzerwunsch 02.08.2026 — die Schiffsübersicht filtert über acht Grobtypen aus
> der Wiki-API; gesucht sind Archetypen in der Fachsprache des Spiels („Salvage", „mining",
> „cargo hauling", „refueling") und kombinierbare Merkmale („stealth bomber",
> „stealth cargo"). Erhebung und Belege: `.planning/phases/06-.../RESEARCH.md`.

- [x] **ROLE-01**: Jedes Schiff des Katalogs trägt Beruf und Rolle aus dem DataCore; Einträge ohne Treffer sind namentlich benannt statt stillschweigend leer
- [x] **ROLE-02**: Alle Filterwerte und ihre DE-/EN-Beschriftung stammen aus den Spieldateien (`Game2.dcb` + CIGs `global.ini`) — keine Ableitung aus Wiki-Foci oder Beschreibungstext
- [x] **ROLE-03**: Verbundrollen zählen für jede enthaltene Rolle — „Starter / Leichter Frachter" erscheint unter *Frachttransport* **und** unter *Einsteiger*
- [x] **ROLE-04**: Der Rollenfilter arbeitet auf Familienebene, die Karte nennt weiterhin die exakte CIG-Rolle
- [x] **ROLE-05**: Der Signaturfilter findet die 16 Katalogschiffe mit abgesenkter Signatur (11 davon unter 0,80); der Wert steht mit CIG-eigener Beschriftung auf der Karte
- [x] **ROLE-06**: Die Schnellzugriffe setzen Rolle und Signatur in einem Klick und finden die genannten Beispielfälle — Tarnkappenbomber, Frachter mit abgesenkter Signatur, Bergung, Bergbau, Betankung
- [x] **ROLE-07**: Rollen ohne deutsche CIG-Fassung sind selbst übersetzt; keine Rolle erscheint auf der deutschen Seite englisch
- [x] **ROLE-08**: Die Übersichtsseite hat EINEN Körper — DE und EN beziehen ihn, es gibt keinen zweiten Stil- oder Skriptblock
- [x] **ROLE-09**: Die Seite bleibt ohne JavaScript lesbar; die Filterung läuft clientseitig ohne spürbare Verzögerung über alle Karten
- [x] **ROLE-10**: Ein wiederholbarer Prüfschritt belegt die Join-Rate und schlägt fehl, wenn sie unter den erhobenen Stand fällt

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
| DON-09 | Phase 5 | Pending |
| DON-10 | Phase 5 | Pending |
| DON-11 | Phase 5 | Pending |
| DON-13 | Phase 5 | Pending |
| DON-14 | Phase 5 | Pending |
| DON-26 | Phase 5 | Pending |
| DON-27 | Phase 5 | Pending |
| DON-28 | Phase 5 | Pending |
| DON-29 | Phase 5 | Pending |
| DON-31 | Phase 5 | Pending |
| DON-04 | — | Gestrichen 02.08.2026 (PayPal ohne Webhook) |
| DON-05 | — | Gestrichen 02.08.2026 (PayPal ohne Webhook) |
| DON-06 | — | Gestrichen 02.08.2026 (PayPal ohne Webhook) |
| DON-07 | — | Gestrichen 02.08.2026 (PayPal ohne Webhook) |
| DON-08 | — | Gestrichen 02.08.2026 (PayPal ohne Webhook) |
| DON-12 | — | Gestrichen 02.08.2026 (PayPal ohne Webhook) |
| ROLE-01 | Phase 6 | Complete |
| ROLE-02 | Phase 6 | Complete |
| ROLE-03 | Phase 6 | Complete |
| ROLE-04 | Phase 6 | Complete |
| ROLE-05 | Phase 6 | Complete |
| ROLE-06 | Phase 6 | Complete |
| ROLE-07 | Phase 6 | Complete |
| ROLE-08 | Phase 6 | Complete |
| ROLE-09 | Phase 6 | Complete |
| ROLE-10 | Phase 6 | Complete |

**Coverage:**

- v1 requirements: 44 total (21 UI-Meilenstein + 13 aktive DON + 10 ROLE)
- Mapped to phases: 44
- Unmapped: 0 ✓

> Phase-5-Kollision aufgeloest 02.08.2026: „Spenden-Unterstuetzung" (DON) und
> „Schiffe: Rollen- und Merkmalsfilter" (ROLE) entstanden parallel in getrennten
> Sitzungen und beanspruchten beide die Nummer 5. Spenden behaelt Phase 5 (war
> zuerst auf staging), Schiffe wurde auf Phase 6 umnummeriert.

- Gestrichen mit der PayPal-Umstellung: 6 (DON-04, -05, -06, -07, -08, -12) — nicht
  gelöscht, sondern als Vorlage für eine spätere Phase mit PayPal-Geschäftskonto
  aufbewahrt

---
*Requirements defined: 2026-07-28*
*Last updated: 2026-08-02 — Spenden-Unterstützung von Stripe auf PayPal umgestellt (6 gestrichen, 5 neue DON-26…DON-31); Schiffe-Rollenfilter (ROLE-01…10) ergänzt und auf Phase 6 umnummeriert*
