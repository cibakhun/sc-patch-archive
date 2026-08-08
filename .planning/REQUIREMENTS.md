# Requirements: VerseBase — UI-/Design-Feinschliff

**Defined:** 2026-07-28
**Core Value:** Spielgenaue Daten, direkt aus den Spieldateien gewonnen — wenn die Zahlen nicht stimmen, ist die Seite wertlos.

> Milestone-Kontext: Das Produkt ist gebaut und live. Der Meilenstein begann als
> reine Oberflächenarbeit; am 03.08.2026 kamen mit den Phasen 1.3 und 1.4 zwei
> Datenphasen dazu (Entscheidung des Betreibers nach der Datenquellen-Prüfung).
> Der Bestand ist in `.planning/PROJECT.md` unter „Validated" verzeichnet und
> wird hier nicht wiederholt.

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

> Stand 08.08.2026, Phase 2 Plan **7 von 7** ausgeführt (Ratchet angehoben,
> `verify:typo` sechs Zusicherungen, ins Dockerfile-Tor eingehaengt).
> TYPO-01 und TYPO-02 gelten jetzt SITE-WEIT als erfüllt und maschinell belegt:
> `node scripts/audit-typo-motion.mjs` meldet 0 skalenpflichtigen Rest über alle
> 96 site-weiten Dateien (1.961 `font-size` + 863 `letter-spacing` + 660
> Bedienübergang-Teile, siehe `.planning/WINDOWS.md` § Phase 2 Bilanz), und
> `verify:typo` Zusicherung 6 hält diesen Stand als Dauerwächter fest.
> TYPO-03 bleibt in der Traceability-Tabelle offen: die enge Sichtrunde
> (Kopfleiste + Startseite, Plan 02) hat der Betreiber am 08.08.2026 bereits
> abgenommen (siehe Häkchen unten und `WINDOWS.md` id 3, fixed) — die BREITERE
> Schluss-Sichtrunde über die restlichen ~92 site-weit umgestellten Dateien
> steht noch aus und ist als offener Punkt in `WINDOWS.md` id 5 an den
> Betreiber übergeben.

- [x] **TYPO-01**: Schriftgrade und Laufweiten der Kopfleiste und der Startseite folgen einer gemeinsamen Skala statt seitenlokaler Einzelwerte
- [x] **TYPO-02**: Übergangsdauern und Beschleunigungskurven sind über die Startseite hinweg vereinheitlicht
- [x] **TYPO-03**: Kopfleiste und Startseite lesen sich als ein zusammenhängendes Bewegungsbild, nicht als zwei unabhängige Zustände
  > Vom Betreiber am 08.08.2026 am ausgelieferten Stand auf staging.verse-base.com abgenommen
  > (DE und EN): Wandlung stetig ohne Sprung, Tempo unverändert gegenüber vorher, Kopfleiste und
  > Seiteninhalt als eine Bewegungssprache — und die Gegenprobe hält: Scroll-Reveal fühlt sich
  > unverändert an, der Durchlauf hat die Ambiente nicht erwischt.

### Überlagerungen

- [ ] **LAYER-01**: Die in `CONCERNS.md` als Class B verzeichneten dekorativen Überlagerungen über Text sind abgetragen (Plan 03-01: Hero-Archetyp bewiesen; Plan 02/03/04 tragen die restlichen Archetypen, `/archiv` und die 19 Patch-Körper ab)
- [ ] **LAYER-02**: Text über Bildmotiven erreicht in beiden Farbmodi einen belegten Kontrastwert (Plan 03-01: Messverfahren + erster Registry-Eintrag bewiesen; Plan 05 schließt die Aufzählung und zieht die WCAG-AA-Zielmarke scharf)

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

> ✅ **Stand 06.08.2026: 11 von 11 Werkzeugen abgedeckt** (Plan 05 ausgeführt:
> Refinery-Tracker als letztes und kontogebundenes Werkzeug angehängt).
> `npm run verify:help --complete` meldet „Abgedeckt: 11 von 11" und alle fünf
> Zusicherungen erfüllt — das ist die Instanz, die DOC-01 bis DOC-07 entscheidet,
> und sie ist jetzt grün. Die Häkchen unten stehen auf dieser maschinellen
> Grundlage.
>
> ⚠ **Offen bleibt die Sichtrunde** (Plan 05 Task 2b): die zwölf Punkte der
> Sichtprüfung in DE und EN, die Bestätigung der beiden A2-Platzierungen
> (Rüstungssets, Precision Jump) und die Antwort auf Annahme A4 (Zweck-Abschnitt
> des Trackers für abgemeldete Besucher unsichtbar) sind an den Betreiber
> zurückgegeben — siehe `.planning/phases/01.2-werkzeuge-erklaeren/01.2-05-SUMMARY.md`
> und `.planning/WINDOWS.md`. Ein Fund dort wirkt auf die Häkchen zurück, ändert
> aber nichts an der maschinell bewiesenen Vollzähligkeit.

- [x] **DOC-01**: Jedes Werkzeug trägt einen aufklappbaren Abschnitt, der zuerst den Zweck nennt und dann die Bedienung
- [x] **DOC-02**: Ein Hilfe-Schalter heftet auf der aktuellen Ansicht an jedes bedienbare Element eine Erklärung
- [x] **DOC-03**: Die Hilfe erreicht auch client-seitig gerendertes Markup (`assets/item-finder-app.js`, `assets/crafting-app.js`)
- [x] **DOC-04**: Alle Erklärungen liegen in DE und EN vollständig vor; keine Fassung fällt auf die andere Sprache zurück
- [x] **DOC-05**: Die Hilfe ist per Tastatur zu öffnen, zu durchlaufen und mit Esc zu verlassen
- [x] **DOC-06**: Ungeöffnet kostet die Hilfe nichts — kein Nachladen, keine Schleife, kein spürbares Seitengewicht
- [x] **DOC-07**: Abgedeckt sind elf Werkzeuge — Item Finder, Crafting, Mining, **Refinery-Finder** (Abschnitt der Mining-Themenseite), **Refinery-Tracker** (`/refinery.html`, kontogebunden), Schiffe, Missionen, Precision Jump, Patch-Archiv, Wikelo's Emporium, Rüstungssets

### Datenschicht-Wahrhaftigkeit

> Quelle: Datenquellen-Prüfung am 03.08.2026. Die Seite lebt vom Versprechen
> spielgenauer Zahlen. Die Prüfung fand keine erfundenen Werte — aber Reste
> früherer Datenläufe, die dem Versprechen widersprechen: eine falsche
> Quellenangabe auf ~3.200 Seiten, rohe Klassennamen in einem Rechner, tote
> Datenstände im Build und zwei Skripte, die einen frischen Stand still
> zurückdrehen können. Dazu ist der Datenstand zwei Client-Builds alt.

- [x] **DATA-01**: Keine Crafting-Oberfläche nennt `sc-craft.tools` als Quelle — die Crafting-Daten kommen seit dem 16.07.2026 aus den Spieldateien
- [x] **DATA-02**: Kein Werkzeug zeigt einen rohen Klassennamen; die beiden namenlosen S0-Mining-Laser erscheinen mit Anzeigenamen oder gar nicht
- [x] **DATA-03**: `src/data/holo-markers.json` und sein Fallback-Zweig in `ShipDetail.astro` sind entfernt — der Zweig greift bei 0 von 227 Schiffen
- [x] **DATA-04**: `src/data/crafting-blueprints.json` ist entfernt, samt Verweis in `.planning/codebase/STRUCTURE.md`
- [x] **DATA-05**: Kein Skript kann die game-sourced Crafting-DB durch einen Fremdquellen-Snapshot ersetzen (`scripts/fetch-craft.mjs`)
- [x] **DATA-06**: `build-universal-db.mjs` bricht ab, wenn die `global.ini` fehlt oder älter ist als der Datenstand, statt den Katalog still zurückzudrehen
- [x] **DATA-07**: Alle Datamine-Ausgaben tragen dieselbe Build-Kennung wie der installierte Client (aktuell `12326004`)
- [x] **DATA-08**: Die Fahrzeugpreise sind nicht älter als der jüngste Datamine-Lauf
- [x] **DATA-09**: `MINING-DATENQUELLE.md`, `FAKTEN-AUDIT.md` und `.planning/codebase/STRUCTURE.md` beschreiben den tatsächlichen Stand

### Fahrzeug-Katalog aus Spieldaten

> Quelle: dieselbe Prüfung. `src/data/vehicles.json` kommt aus der
> Star-Citizen-Wiki-API. Die ist selbst nur ein Spiegel der Spieldaten und hinkt
> strukturell hinterher — am 03.08.2026 stand sie auf Build `12232306`, der
> Client auf `12326004`. Die eigene Extraktion liefert bereits 223 Fahrzeuge
> inklusive DE- und EN-Beschreibungen aus CIGs eigener `global.ini`.

- [x] **VEH-01**: Die vier Extraktor-Skripte (`lib/cryxml.mjs`, `datamine-vehicles.mjs`, `verify-vehicles.mjs`, `verify-weapon-sizes.mjs`) liegen versioniert im Repo
- [x] **VEH-02**: `src/data/vehicle-external.json` trägt die zehn Felder, die in keiner Spieldatei stehen (D-18, CONTEXT.md — Betreiber wählte bewusst den aufwendigeren Weg: erst suchen, dann nur den belegt quellenlosen Rest einfrieren, statt vorab auf fünf zu begrenzen): `msrpUSD`, `pledgeUrl`, `lengthM`/`widthM`/`heightM`, `image`, `crewMax`, `statusEn`/`statusDe`, `fociDe`
- [x] **VEH-03**: Name und Hersteller sind normalisiert (`C.O.`-Präfix, `&` gegen `and`, abschließender Zeilenumbruch) — die rein kosmetischen Abweichungen sind weg
- [ ] **VEH-04**: Für `crew` ist entschieden und belegt, ob die Seite CIGs `crewSize` oder den bisherigen `crewMax` zeigt
- [ ] **VEH-05**: `cargoSCU` steht für jedes Fahrzeug mit Frachtraum auf einem belegten Wert; kein Frachtschiff steht auf 0
- [ ] **VEH-06**: Die 32 `shieldHp`-Abweichungen sind einzeln beurteilt — je Fahrzeug ist belegt, welche Quelle recht hat
- [x] **VEH-07**: Der Spieldaten-Katalog führt alle 227 Fahrzeuge, inklusive der vier ATLS-Varianten
- [x] **VEH-08**: `vehicles.json` entsteht aus der Extraktion; `sync-vehicles.mjs` ist gelöscht und der Wiki-Schritt aus `.github/workflows/build.yml` entfernt

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

### Crafting-Karten: Bauteil-Kennwerte

> Quelle: Discord-Rückmeldung von [SYN] Froggy — „awesome to actually see the
> different sizes on what components are and what grade they are like A B C.
> Aswell if they a mill industrial and so forth." Belege und Messung:
> `.planning/notes/crafting-karten-groesse-grade-ton.md`.

- [x] **CRAFT-01**: Jede Blueprint-Karte zeigt Größe und Grade, sofern die Angabe für dieses Item existiert
- [x] **CRAFT-02**: Jede Bauteil-Karte zeigt den Ton (Civilian, Military, Industrial, Stealth, Competition …); bei Schiffswaffen stammt er aus dem Kategorie-Pfad statt aus `game.class`
- [x] **CRAFT-03**: Fehlt eine Angabe, bleibt die Stelle leer — kein geratener, kein leerer Chip; die 15 gleichnamigen Blueprints sind einzeln geprüft, die 5 echten Kollisionen bleiben chiplos
- [x] **CRAFT-04**: Größe und Grade sind auf der Crafting-Seite filterbar, nicht nur sichtbar

## v2 Requirements

### Crafting-Karten

- ~~**CRAFT-05**: Der Ton für Mininglaser, Tractorbeam, Salvage und Refuelling ist erschlossen~~
  — **gestrichen 07.08.2026.** Nachgemessen: dort gibt es nichts zu erschließen.
  Die Spieldaten führen für diese Bauteile keine Klasse, weil das Konzept nicht
  greift — Mining-Laser unterscheiden sich über Hersteller und Leistung, nicht
  über civilian/military. Ein Ersatz über den Hersteller wurde erwogen und
  verworfen: bei Tractorbeam (12), Salvage (5) und Refuelling (1) stammt alles
  von Greycat, ein Chip dort unterscheidet nichts und wäre derselbe Fehler wie
  das frühere „Grade A" auf jeder Waffe.

### Sprachparität

- **SYNC-03**: Ein Build- oder Audit-Schritt vergleicht alle 67 EN/DE-Seitenpaare automatisch und schlägt bei Struktur-Drift fehl
- **SYNC-04**: Die von Hand gedoppelte Seiten-Chrome der driftenden Paare (`precision-jump`, DE-Konto-Seiten) ist in gemeinsame Komponenten zusammengeführt

### Typografie & Bewegungsbild

- **TYPO-04**: Die vereinheitlichte Skala gilt über die Startseite hinaus für alle handgebauten Seiten

## Out of Scope

| Feature | Reason |
|---------|--------|
| Serverseitige Renderlogik | Statisches Astro-Build hinter nginx — geht nur als Supabase Edge Function |
| Neue Datenquellen oder neue Werkzeuge | Phase 1.3/1.4 richten den Bestand her und holen den Fahrzeug-Katalog heim; sie bauen nichts Neues |
| Refinery-Ökonomie, Loot-Recherche, Spielermarkt-Oberfläche | Als offene Punkte der Prüfung vom 03.08.2026 erkannt, aber nicht Teil dieses Meilensteins |
| Konto-, Community- und Discord-Funktionen | Bestand bleibt, wird in diesem Meilenstein aber nicht vorangetrieben |
| CSS-Framework oder Bundler für `assets/` | Handgeschriebenes CSS/JS ist bewusste Entscheidung, nicht Altlast |
| Redesign einzelner Patch-Seiten | Jede Patch-Seite hat absichtlich ihre eigene Design-Welt. **⚠ Ausnahme, vom Betreiber am 08.08.2026 ausdrücklich freigegeben:** Phase 2 fasst die 19 Patch-Körper an, aber NUR Werte hinter `font-size`, `letter-spacing` und `transition`. Palette, Motiv, Ambiente und Layout bleiben unberührt — das ist kein Redesign. Mechanisch abgesichert in `02-05-PLAN.md`: eine Diff-Zusicherung verlangt, dass jede geänderte Zeile eine dieser drei Eigenschaften trägt, und die Zahl der `animation`-Angaben muss unverändert bleiben (Ausführung 08.08.2026, siehe `02-05-SUMMARY.md`: gemessene Ist-Zahl 133, nicht die im Plan genannte 160 — der Plan hatte sie mit der `transition:`-Deklarationszahl verwechselt, die tatsächlich 160 ist; die Invariante selbst — unverändert vor/nach dem Lauf — ist erfüllt). Grund für die Ausnahme: ein grosser Teil der site-weit 1.968 Schriftgrade liegt in den Patch-Körpern; ohne sie wäre „site-weit" (D-01) eine halbe Sache |
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
| DOC-01 | Phase 1.2 | Complete |
| DOC-02 | Phase 1.2 | Complete |
| DOC-03 | Phase 1.2 | Complete |
| DOC-04 | Phase 1.2 | Complete |
| DOC-05 | Phase 1.2 | Complete |
| DOC-06 | Phase 1.2 | Complete |
| DOC-07 | Phase 1.2 | Complete |
| DATA-01 | Phase 1.3 | Complete |
| DATA-02 | Phase 1.3 | Complete |
| DATA-03 | Phase 1.3 | Complete |
| DATA-04 | Phase 1.3 | Complete |
| DATA-05 | Phase 1.3 | Complete |
| DATA-06 | Phase 1.3 | Complete |
| DATA-07 | Phase 1.3 | Complete |
| DATA-08 | Phase 1.3 | Complete |
| DATA-09 | Phase 1.3 | Complete |
| VEH-01 | Phase 1.4 | Complete |
| VEH-02 | Phase 1.4 | Complete |
| VEH-03 | Phase 1.4 | Complete |
| VEH-04 | Phase 1.4 | Pending |
| VEH-05 | Phase 1.4 | Pending |
| VEH-06 | Phase 1.4 | Pending |
| VEH-07 | Phase 1.4 | Complete |
| VEH-08 | Phase 1.4 | Complete |
| TYPO-01 | Phase 2 | Complete |
| TYPO-02 | Phase 2 | Complete |
| TYPO-03 | Phase 2 | Pending |
| LAYER-01 | Phase 3 | In Progress (Plan 2 of 5: alle acht Medien-Archetypen des geteilten Systems + .sstep abgetragen; /archiv und die 19 Patch-Koerper stehen noch aus, Plan 03/04) |
| LAYER-02 | Phase 3 | In Progress (Plan 1 of 5: Messverfahren bewiesen) |
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
| CRAFT-01 | Phase 8 | Complete |
| CRAFT-02 | Phase 8 | Complete |
| CRAFT-03 | Phase 8 | Complete |
| CRAFT-04 | Phase 8 | Complete |

<!-- Stand 06.08.2026: Phase 1.2 Plan 5 von 5 ausgefuehrt — Refinery-Tracker als
     elftes Werkzeug angehaengt, npm run verify:help --complete meldet 11 von 11.
     DOC-01..07 oben auf dieser maschinellen Grundlage abgehakt. Die Sichtrunde
     (12 Punkte + Annahmen A2/A4, Plan 05 Task 2b) ist an den Betreiber
     zurueckgegeben und in 01.2-05-SUMMARY.md sowie WINDOWS.md nachvollziehbar.
     ⚠ 02-07: dieser Kommentar stand vorher MITTEN in der Traceability-Tabelle
     (zwischen DOC-07 und DATA-01) und brach dort jede Zeilen-fuer-Zeile-Suche
     eines Werkzeugs, das die Tabelle liest (z. B. `gsd-tools requirements
     mark-complete`) -- die Suche stoppt an der ersten Zeile, die nicht mit `|`
     beginnt. Hierher verschoben (Rule 3, blockierender Werkzeugfehler), Inhalt
     unveraendert. -->

**Coverage:**

- v1 requirements: 65 total (21 UI-Meilenstein + 13 aktive DON + 10 ROLE + 9 DATA + 8 VEH + 4 CRAFT)
- Mapped to phases: 65
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
*Last updated: 2026-08-03 — DATA-01…09 (Phase 1.3, alle erfüllt) und VEH-01…08 (Phase 1.4) aus der Datenquellen-Prüfung ergänzt*
*Zuvor: 2026-08-02 — Spenden-Unterstützung von Stripe auf PayPal umgestellt (6 gestrichen, 5 neue DON-26…DON-31); Schiffe-Rollenfilter (ROLE-01…10) ergänzt und auf Phase 6 umnummeriert*
