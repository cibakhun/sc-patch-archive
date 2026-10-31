# Phase 20: Wikelos Angebote kommen aus dem Bestand — Recherche

**Recherchiert:** 2026-08-28
**Domain:** Interne Datamine-/Build-Pipeline (DataCore-Extraktion, Zusammenführung mit kuratierten Daten, Sperrklinken-Tore) — kein Frontend-Neubau, keine neue Bibliothek
**Konfidenz:** HOCH für die Zahlen (heute selbst gemessen, read-only, gegen den lokalen Spielstand und die Wiki-API) · MITTEL für die architektonische Empfehlung (zwei tragende Präzedenzfälle im eigenen Repo gefunden und gelesen) · NIEDRIG für die inhaltliche Einordnung einzelner Verträge (D-02/D-03 brauchen eine Betreiber-Sichtung, s. Offene Fragen)

## Zusammenfassung

Diese Phase hängt die Wikelo-Seite von einer 100 % handgepflegten Datei (`assets/wikelo-trades.json`, 63 Einträge, eingefroren auf Patch 4.8.1) auf eine **Zusammenführung** um: Angebote und Mengen kommen maschinell aus `scripts/datamine-wikelo.mjs` (liest `ContractGenerator.TheCollector` aus der DataCore), Bild, Ausstattung (`comps`) und Reputationstext (`rep`) bleiben kuratiert. Der Erzeuger existiert bereits und ist fertig (188 Zeilen, lauffähig); was fehlt, ist die **Zusammenführung selbst** (D-01), zwei **inhaltliche Sichtungen** (D-02, D-03) und die **Sperrklinke** (D-04).

Für die Zusammenführung gibt es im eigenen Repo bereits zwei tragende Präzedenzfälle, die exakt dasselbe Problem lösen — maschinelle Extraktion + eine handgepflegte Datei mit *nur* den Feldern, die keine Spieldatei hergibt, zusammengeführt über einen stabilen Schlüssel: `scripts/build-mining-db.mjs` liest `assets/mining-curated.json` (kuratierte Attribute, "wird NIE überschrieben") neben den maschinellen Extrakten, und `scripts/datamine-vehicles.mjs` mischt `src/data/vehicle-external.json` per `{ ...v, ...ext }`-Schleife ein. Diese Recherche empfiehlt, dasselbe Muster 1:1 auf Wikelo zu übertragen.

Die in der ROADMAP genannten Zahlen sind an drei Stellen ungenau oder stammen aus zwei verschiedenen, nicht direkt vergleichbaren Messläufen. Der Abschnitt „Zahlen-Abgleich" unten löst das mit heute selbst gemessenen, read-only erhobenen Werten auf und nennt explizit, welche Zahl auf die Sperrklinke (D-04) gehört: **69 Verträge, 285 Warenposten** — nicht 56, nicht 59, nicht 62.

**Kernempfehlung:** `scripts/build-wikelo-trades.mjs` neu anlegen (Vorbild `build-mining-db.mjs`), liest `assets/wikelo-gamefiles.json` (maschinell, existiert bereits) + `assets/wikelo-curated.json` (neu, kuratiert, keyed by Vertrags-`id`) und schreibt `assets/wikelo-trades.json` + `assets/wikelo-trades.meta.json` neu — beide wandern damit von „handgepflegt" zu „build-generiert mit kuratiertem Zulieferer", genau wie `assets/mining-db.json`. `scripts/verify-datastand.mjs` verliert dadurch seine `HANDPFLEGE`-Zeile und bekommt eine normale `STANDS`-Zeile.

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md` gilt projektweit und bindet auch diese Phase:

- **Vor jedem Push:** `npm run build && npm run gate` grün — keine Ausnahme, auch nicht für "nur Daten". Da diese Phase Tore berührt (`verify:datastand`, `verify:metrics`), zusätzlich einmal mit `STAGING=1` bauen (genau das nennt die Phase selbst als Erfolgskriterium 4).
- **Nach Datenläufen** (`datamine:wikelo` gehört dazu): zusätzlich `npm run gate:data`.
- **Neue Prüfskripte** gehören in `scripts/lib/gate-registry.mjs` — `verify:wiring` erzwingt das. Diese Phase braucht wahrscheinlich **kein** neues Prüfskript (die vorhandenen `verify:datastand` und `verify:metrics` reichen, s. unten), aber falls doch eines entsteht, MUSS es eingetragen werden.
- **Sieben Grundsätze für Tore** (§4 des Konzepts, `docs/maschinelle-validierung.md`): u. a. „Vorgeführt rot" (jedes neue Tor einmal absichtlich brechen und die Meldung protokollieren), „Selbstauskunft" (wie viele Einheiten geprüft wurden), „Sperrklinken statt Momentwerte" (nur nach oben, Rückgang nur per Commit mit genannter Ursache). Diese Phase erbt diese Pflicht direkt für die neuen `metrics-baseline.mjs`-Zeilen.
- **Datenherkunft (Data.p4k, DataCore, „datamined") taucht nirgends im sichtbaren Text auf.** Die aktuelle Wikelo-Seite nennt an zwei Stellen ausdrücklich `wikelotrades.com` und „Patch 4.8.1" als alleinige Quelle der Handelsdaten (`src/components/topics/wikelo-emporium.astro` Zeile 338 und 407/419 `<Attribution>`). Das wird nach dieser Phase **sachlich falsch**, weil Angebote/Mengen jetzt aus den Spieldateien kommen. Die Formulierung "aus den Spieldateien" ist im Projekt etabliert (`src/components/MissionDetail.astro`, `ShipDetail.astro`) und audit-sicher — sie muss die neue Herkunft nennen, ohne technische Begriffe wie „DataCore" zu verwenden.
- **Sichturteile entscheidet kein Skript.** Die Frage, ob ein Vertrag ein echtes Angebot oder ein „Werkstattrest" ist (D-02), sowie die Bild-/Ausstattungs-Zuordnung für die drei ATLS-Farbvarianten (D-03), gehören als benannte Punkte nach `.planning/WINDOWS.md` an den Betreiber — nicht als geratene Automatik in den Merge-Code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vertrags-Extraktion (Angebote, Mengen) | Build-Zeit-Skript (`datamine-wikelo.mjs`) | Database/Storage (`assets/wikelo-gamefiles.json`, gitignored Build-Eingabe) | Reine Leseoperation gegen `Data.p4k`; existiert bereits, produziert ein committetes Zwischenformat |
| Kuratierte Zusatzfelder (img, comps, rep) | Database/Storage (`assets/wikelo-curated.json`, neu, git-getrackt) | — | Keine Spieldatei führt diese Felder; von Hand gepflegt, analog `mining-curated.json` |
| Zusammenführung (D-01) | Build-Zeit-Skript (neu: `build-wikelo-trades.mjs`) | Database/Storage (schreibt `assets/wikelo-trades.json`) | Muss VOR dem Astro-Build laufen, wie `build-mining-db.mjs`/`build-vehicle-external.mjs` es für ihre Domänen tun |
| Anzeige (Karten, Filter, Bilder) | Frontend Server (SSR, Astro) | Browser/Client (Filter-Pillen, Lightbox, `assets/wikelo-bridge.js`) | Unverändert — `wikelo-emporium.astro` konsumiert weiterhin `assets/wikelo-trades.json`, nur dessen Herkunft ändert sich |
| Bestandsschutz (D-04 Sperrklinke) | Build-Zeit-Tor (`verify:metrics`, `verify:datastand`, beide Rail A) | — | Beide Tore laufen bereits ohne `Data.p4k`/Netz gegen committete Artefakte — Grundsatz 4 („Torfähigkeit vor Verkabelung") ist damit automatisch erfüllt |
| Patch-Kennung (Verzugstor) | Build-Zeit-Tor (`verify:datastand.mjs`) | — | Wikelo wechselt von der `HANDPFLEGE`-Tabelle in die `STANDS`-Tabelle desselben Skripts |

## Standard Stack

Diese Phase installiert **keine neue Bibliothek**. Sie nutzt ausschließlich vorhandene, projekteigene Module:

### Core (bereits im Repo, keine Änderung nötig)
| Modul | Zweck | Warum Standard hier |
|-------|-------|----------------------|
| `scripts/lib/p4k.mjs` (`openP4k`, `DEFAULT_P4K`) | Öffnet die lokale `Data.p4k`, liest `global.ini` und `Game2.dcb` | Dieselbe Zugriffsschicht wie alle anderen `datamine-*.mjs` |
| `scripts/lib/datacore.mjs` (`openDataCore`) | Parst `Game2.dcb`, löst `__ref`-Verweise zwischen Records auf | Von `datamine-wikelo.mjs` bereits verwendet, unverändert weiterverwenden |

### Neu anzulegende Dateien (keine Bibliotheken, projekteigenes JSON/JS)
| Datei | Zweck | Vorbild |
|-------|-------|---------|
| `assets/wikelo-curated.json` | Kuratierte Felder je Vertrags-`id`: `img`, `comps`, `rep`, vermutlich `cat` (s. Offene Fragen) | `assets/mining-curated.json` (`"source"`-Kopf + `"minerals": { <key>: {...} }`) |
| `scripts/build-wikelo-trades.mjs` | Liest `wikelo-gamefiles.json` + `wikelo-curated.json`, schreibt `assets/wikelo-trades.json` + `assets/wikelo-trades.meta.json` | `scripts/build-mining-db.mjs` |

### Alternativen erwogen
| Statt | Könnte man auch | Tradeoff |
|-------|------------------|----------|
| Separate `build-wikelo-trades.mjs` | Merge-Logik direkt in `datamine-wikelo.mjs` einbauen (wie `datamine-vehicles.mjs` es mit `vehicle-external.json` tut) | Beide Muster existieren im Repo. `datamine-vehicles.mjs` mischt inline, weil die Fremddaten nur EINMALIG (Wiki-Snapshot) eingefroren wurden. `build-mining-db.mjs` ist ein SEPARATER Schritt, weil es aus MEHREREN maschinellen Quellen UND einer laufend gepflegten kuratierten Quelle zusammensetzt — das trifft auf Wikelo genauer zu (Bild/Ausstattung werden vermutlich weiter gepflegt, wenn neue Angebote auftauchen). Empfehlung: separates Skript, Vorbild `build-mining-db.mjs`. |

**Installation:** keine (keine neuen npm-Pakete).

## Package Legitimacy Audit

**Nicht anwendbar.** Diese Phase installiert keine externen Pakete — reine Erweiterung projekteigener `.mjs`-Skripte und JSON-Dateien. `npm view`/`pip`/`cargo`-Prüfungen entfallen.

## Architecture Patterns

### System Architecture Diagram

```
                 Data.p4k (lokal, kein Netz)
                        │
                        ▼
        scripts/datamine-wikelo.mjs   [BEREITS FERTIG, unverändert]
        liest ContractGenerator.TheCollector
        (Verträge → objectiveTokens[].objectiveHandler.haulingOrders[]
         ODER paramOverrides.propertyOverrides[].haulingOrderContent[])
                        │
                        ▼
        assets/wikelo-gamefiles.json   (gitignored, Build-Eingabe)
        { counts:{contracts,withOrders,orderLines}, gameVersion, contracts:[...] }
                        │
                        │         assets/wikelo-curated.json   [NEU, git-getrackt]
                        │         { <vertrags-id>: { img, comps, rep, cat? } }
                        │                       │
                        ▼                       ▼
             scripts/build-wikelo-trades.mjs   [NEU, D-01]
             Schlüssel: Vertrags-id (NICHT Anzeigename)
             je Vertrag: orders → mats[] + favor (Wikelo-Favor-Zeile abgetrennt)
                         + curated[id]?.img/comps/rep/cat
             fehlt curated[id] → Platzhalter-Icon statt Foto (bereits vorhandenes
             Fallback-Verhalten in wikelo-emporium.astro, hasAsset())
                        │
                        ▼
        assets/wikelo-trades.json      (NEU: build-generiert statt handgepflegt)
        assets/wikelo-trades.meta.json (NEU: gameVersion/itemCount statt
                                         reviewedVersion/reviewedAt — oder beides,
                                         s. Offene Fragen)
                        │
                        ▼
   src/components/topics/wikelo-emporium.astro   [Konsument, UNVERÄNDERTE Struktur]
   TRADES.map(...) — Karten, Filter-Pillen, Lightbox, Item-Finder-Brücke
                        │
                        ├──▶ scripts/verify-datastand.mjs  (D-04, Zeile wandert von
                        │    HANDPFLEGE → STANDS, prüft gameVersion-Verzug)
                        └──▶ scripts/verify-metrics.mjs    (D-04, neue Sperrklinken
                             wikeloVertraege≥69, wikeloWarenposten≥285)
```

### Recommended Project Structure
```
scripts/
├── datamine-wikelo.mjs        # unverändert — reine Extraktion
├── build-wikelo-trades.mjs    # NEU (D-01) — Zusammenführung, Vorbild build-mining-db.mjs
└── lib/
    └── metrics-baseline.mjs   # ERWEITERT (D-04) — zwei neue BASELINE-Zeilen
assets/
├── wikelo-gamefiles.json      # unverändert erzeugt, gitignored
├── wikelo-curated.json        # NEU (D-01) — git-getrackt, von Hand gepflegt
├── wikelo-trades.json         # ERSETZT — künftig build-generiert
└── wikelo-trades.meta.json    # ERSETZT — künftig build-generiert
```

### Pattern 1: Kuratierte Zulieferdatei, „wird NIE überschrieben"
**Was:** Eine separate, git-getrackte JSON-Datei mit ausschließlich den Feldern, die keine Spieldatei hergibt, keyed by einem stabilen Schlüssel — nicht vom Erzeuger angefasst, nur gelesen.
**Wann verwenden:** Wenn maschinelle Extraktion und Handpflege dieselbe Entität beschreiben, aber unterschiedliche Teilmengen ihrer Felder liefern (Bild/Ausstattung bei Wikelo, wie zuvor Code/Kind/Gewicht bei Mineralien, wie zuvor Preis/Maße bei den vier ATLS-Fahrzeugen).
**Beispiel:**
```javascript
// Source: scripts/build-mining-db.mjs (Zeile 19)
const curated = rd('mining-curated.json'); // kuratierte Attribute (getrennt, wird NIE überschrieben)
```
```json
// Source: assets/mining-curated.json (Kopf)
{
  "source": "Kuratierte Mineral-Attribute (Code/Kind/Gewicht/Basis-Methode) — von Hand gepflegt. Von build-mining-db gelesen, nie überschrieben.",
  "minerals": { "Agricium": { "code": "AGRI", "kind": "Metal", "weight_scu": 1.2, "method": "ship" } }
}
```
Übertragen auf Wikelo: `assets/wikelo-curated.json` mit `{ "source": "...", "trades": { "<vertrags-id>": { "img": "wk-....png", "comps": [...], "rep": "..." } } }`.

### Pattern 2: Einmisch-Schleife über einen stabilen Schlüssel, nicht über den Anzeigenamen
**Was:** `{ ...maschinellerDatensatz, ...kuratierteFelder[stabilerSchlüssel] ?? {} }` — die kuratierten Felder überschreiben nie den maschinellen Teil, weil beide Seiten disjunkte Feldmengen führen.
**Beispiel:**
```javascript
// Source: scripts/datamine-vehicles.mjs (Zeilen 818–828)
const ext = external.vehicles?.[id] ?? {};
out.push({ ...v, ...ext });
```
D-01 fordert exakt das: „Schlüssel ist die Vertrags-Id, nicht der Anzeigename." Der Vertrag trägt bereits ein stabiles `id`-Feld (32-stelliger Hex-String, z. B. `"8449deaf626a921292715264e5db8788"`), das `datamine-wikelo.mjs` unverändert durchreicht — dieser Schlüssel ist vorhanden und muss nicht neu erfunden werden.

### Pattern 3: Sperrklinke + Ableser als Bijektion
**Was:** Jede Kennzahl in `scripts/lib/metrics-baseline.mjs` (Klinke, `regel: 'min'`, `anlass`) hat GENAU einen Ableser in `ABLESER` (`scripts/verify-metrics.mjs`) — Zusicherung 2 prüft die Bijektion und reißt, wenn eine Seite ohne die andere existiert.
**Beispiel:**
```javascript
// Source: scripts/lib/metrics-baseline.mjs (Zeile 116, Vorbild fahrzeuge)
{
  id: 'fahrzeuge',
  wert: 227,
  regel: 'exakt',
  anlass: 'Phase 01.4-03: 223 aus der Extraktion plus die vier ATLS-Varianten. …',
},
```
```javascript
// Source: scripts/verify-metrics.mjs (ABLESER)
fahrzeuge: () => rd('src/data/vehicles.json').vehicles?.length,
```
Für D-04 zwei neue Paare (siehe Code-Beispiele unten): `wikeloVertraege` und `wikeloWarenposten`, gelesen aus `assets/wikelo-gamefiles.json` (dessen `.counts`-Feld bereits existiert, s. „Zahlen-Abgleich").

### Pattern 4: Handpflege-Zeile → maschinelle Zeile im Verzugstor
**Was:** `scripts/verify-datastand.mjs` führt zwei getrennte Tabellen: `STANDS` (sechs maschinelle Datenstände, `Kennung` = Changelist-String) und `HANDPFLEGE` (aktuell nur Wikelo, `reviewedVersion`/`reviewedAt` statt Changelist). D-04 verlangt, Wikelo aus `HANDPFLEGE` zu entfernen und als siebte Zeile in `STANDS` aufzunehmen — mit `get: (j) => j?.gameVersion` wie bei den anderen sechs, weil `wikelo-trades.meta.json` künftig ein `gameVersion`-Feld führt statt (oder zusätzlich zu) `reviewedVersion`.
**Beispiel:**
```javascript
// Source: scripts/verify-datastand.mjs (Zeile 62, Vorbild "Zerlegung" —
// derselbe Begleitdatei-Fall wie Wikelo: nacktes Array + eigene Meta-Datei)
{
  id: 'Zerlegung',
  file: 'assets/dismantling-items.meta.json',
  get: (j) => j?.gameVersion,
  companion: { file: 'assets/dismantling-items.json', countField: 'itemCount' },
},
```
Und in `KLINKEN` ergänzen: `Wikelo: 12519617` (aktuell gemessener Wert, s. „Zahlen-Abgleich") — dann greift Zusicherung 4/5/6 automatisch mit.

### Anti-Patterns to Avoid
- **Titel-basiertes Matching als einzige Zuordnungslogik für die Zusammenführung verwenden:** Drei der 69 Verträge (die ATLS-Farbvarianten) haben in den aktuellen Spieldaten **keinen auflösbaren Titel** (`loc()` liefert `null`). Ein Merge, der über den Titel joint statt über die `id`, verliert diese drei Karten ersatzlos — genau der Fehler, den `scripts/probes/wikelo-dreivergleich.mjs` beim Wiki-Abgleich bereits gemacht hat (s. Common Pitfalls, Pitfall 1). D-01 verlangt explizit die `id` als Schlüssel — das ist nicht nur sauberer, sondern hier zwingend.
- **Den rohen Extraktions-Output ungefiltert nach `mats` kopieren, ohne die Wikelo-Favor-Zeile herauszurechnen:** `orders[]` enthält die Wikelo-Favor-Kosten als ganz normale Zeile (`klasse: "Carryable_1H_CY_banu_favour_Wikelo"`). Die bestehende Seite zeigt Favor separat (`t.favor`, eigenes Symbol). Der Merge muss diese eine Zeile herausfiltern und als `favor` (Zahl) statt als `mats`-Eintrag ausgeben — sonst erscheint „1× Wikelo Favor" fälschlich in der Materialliste UND die Favor-Kachel bleibt leer.
- **`assets/wikelo-gamefiles.json` committen:** Die Datei ist bewusst in `.gitignore` (Zeile 35) — derselbe Grund wie bei `mining-gamefiles.json`, `items-gamefiles.json` usw.: sie ist eine Build-EINGABE, kein Endprodukt (siehe Kopfkommentar in `datamine-wikelo.mjs`, der bereits einen fehlgeschlagenen ersten Anlauf dazu dokumentiert). Nur `assets/wikelo-trades.json` (das Ergebnis der Zusammenführung) gehört ins Repo.

## Don't Hand-Roll

| Problem | Nicht selbst bauen | Stattdessen verwenden | Warum |
|---------|---------------------|------------------------|-------|
| Kuratierte Felder neben maschinellen Daten halten | Eine neue Konvention erfinden (z. B. Kommentare im JSON, ein Overlay-Format mit anderer Struktur) | Exakt das Format von `assets/mining-curated.json` kopieren (`{"source": "...", "<gruppe>": {"<key>": {...}}}`) | Zwei bestehende, im Gate geprüfte Präzedenzfälle (`build-mining-db.mjs`, `datamine-vehicles.mjs`) lösen dasselbe Problem bereits; ein drittes, abweichendes Format erhöht nur die Zahl der Muster, die ein Betreuer im Kopf behalten muss |
| Vertrags-zu-Kürung-Zuordnung (welcher der 63 Handeinträge gehört zu welcher `id`) | Einen neuen Fuzzy-Matcher gegen Belohnungsnamen bauen | Die in dieser Recherche bereits durchgeführte Jaccard-Ähnlichkeit über die Materialmengen als STARTPUNKT nehmen (55 von 69 mit Score ≥ 0,5 automatisch zuordenbar, Liste unten) — aber JEDE automatische Zuordnung vor dem Commit von einem Menschen bestätigen lassen, weil Fehlzuordnungen unbemerkt falsche Mengen anzeigen würden (Kernwert des Projekts: „wenn die Zahlen nicht stimmen, ist die Seite wertlos") | Ein Namens- oder Belohnungs-Match ist bereits zweimal in diesem Projekt als Sackgasse dokumentiert (Register-Eintrag id 51, zwei ausdrücklich verworfene Vorläufe) |
| Sperrklinken-Mechanik | Ein eigenes Tor-Skript für Wikelo schreiben | `scripts/lib/metrics-baseline.mjs` + `scripts/verify-metrics.mjs` erweitern (zwei neue Zeilen) | Die Mechanik (Klinke, Toleranz, Bijektions-Zusicherung, Selbstauskunft) existiert bereits und läuft in Rail A; ein Parallel-Tor würde Grundsatz 7 verletzen (zwei Wahrheiten für dieselbe Kennzahl) |

**Key insight:** Diese Phase braucht so gut wie keinen neuen Mechanismus — nur die Anwendung von zwei bereits bewährten Repo-Mustern (kuratierte Zulieferdatei + Sperrklinken-Bijektion) auf eine neue Domäne. Das größte Risiko ist nicht technisch, sondern inhaltlich: welche Verträge echte Angebote sind (D-02) und welche ATLS-Farbe zu welchem Namen gehört (D-03) — das ist eine Sichtungsfrage, keine Programmierfrage.

## Runtime State Inventory

> Diese Phase ist eine Datenquellen-Migration (handgepflegt → build-generiert), deshalb geprüft.

| Kategorie | Befund | Aktion nötig |
|-----------|--------|----------------|
| Gespeicherte Daten (Datenbanken/Datastores) | Keine. `assets/wikelo-trades.json` ist eine statische, ins Build eingebettete JSON-Datei, kein Datastore. Es gibt keine Nutzer-Accounts, Sessions oder externe DB, die den Wikelo-Datenstand referenzieren. | Keine |
| Live-Dienst-Konfiguration (nur in UI/DB, nicht in git) | Keine. Es gibt keinen externen Dienst (n8n, Datadog o. ä.), der Wikelo-Daten hält. | Keine |
| OS-registrierter Zustand (Task Scheduler, pm2, launchd, systemd) | Keine. Reines Build-Zeit-Artefakt, kein laufender Prozess referenziert den alten Dateinamen. | Keine |
| Secrets/Env-Variablen | Keine. `assets/wikelo-trades.json` wird nirgends als Secret-Name oder Env-Var-Wert referenziert. | Keine |
| Build-Artefakte/installierte Pakete | `assets/wikelo-trades.json` und `assets/wikelo-trades.meta.json` selbst — sie wechseln von „handgepflegt, committet" zu „build-generiert, committet". Bestehende Konsumenten (`wikelo-emporium.astro`, `wikeloItemMatch.ts` — importiert NICHT Wikelo-Daten, nur `universal-items.json`) lesen weiterhin denselben Dateinamen/Pfad, keine Import-Umstellung nötig. | Dateiinhalt ändert sich, Pfad/Name bleibt — kein Nacharbeitsbedarf an Konsumenten außer der in Common Pitfalls Pkt. 4 genannten Copy-Text-Korrektur |

**Fazit:** Diese Migration hat keine Laufzeit-Nebenwirkungen außerhalb des Repos — reine Build-Zeit-Angelegenheit. Das vereinfacht die Planung erheblich gegenüber echten Rename-/Rebrand-Phasen.

## Common Pitfalls

### Pitfall 1: Titel-basiertes Matching übersieht Verträge ohne auflösbaren Titel
**Was schiefgeht:** Ein Vergleich, der Verträge über ihren lokalisierten Titel zuordnet, meldet Verträge mit `titel: null` fälschlich als „nicht vorhanden" oder „entfernt".
**Warum es passiert:** Drei der 69 aktuellen Verträge (`TheColllector_Vehicle_Ground_ATLS_OrangeNGrey`/`RedNBlue`/`WhiteNGreen` — man beachte den Tippfehler „TheColllector" mit drei l, der im Spiel selbst steckt, nicht im Extraktor) haben keine `Title`-`paramOverride`; `loc(strParam(c, 'Title'))` liefert `null`. `scripts/probes/wikelo-dreivergleich.mjs` filtert vor dem Join explizit `c.titel` (`spielNachTitel = new Map(spiel.contracts.filter((c) => c.titel).map(...))`) und lässt diese drei damit unsichtbar durchfallen.
**Wie vermeiden:** Für den D-01-Merge NIE über den Titel joinen — die Verträge tragen bereits ein stabiles `id`-Feld, das genau dafür gedacht ist (D-01 sagt das auch explizit). Für die D-03-Sichtung (welche ATLS-Farbe zu welchem Namen gehört) über `debugName` + Materialabgleich gehen, nicht über den Titel.
**Warnzeichen:** Eine Zusammenführung, die am Ende weniger als 69 Karten zeigt, obwohl `wikelo-gamefiles.json` 69 Verträge meldet.

### Pitfall 2: Ein Vertrag ohne strukturierte Gegenleistung im Extraktor
**Was schiefgeht:** `"Want Polaris? Need something special."` (`TheCollector_Favours_PolarisParts`, Belohnung „Polaris Bit") hat `orders: []` — der Extraktor findet keine `haulingOrders`, obwohl die Beschreibung eindeutig eine Materialabgabe verlangt ("Bring quantainium to … and will trade for bits"). Die Handliste kennt den korrekten Wert (24× Quantanium).
**Warum es passiert:** Dieser eine Vertrag nutzt eine dritte, vom Extraktor noch nicht gelesene Struktur für seine Gegenleistung (weder Weg A noch Weg B aus dem Kopfkommentar von `datamine-wikelo.mjs` greift hier) — vermutlich, weil es sich um einen „laufenden Favor-Akkumulations"-Vertrag statt eines Einmal-Tauschs handelt.
**Wie vermeiden:** Für diesen einen Vertrag (`id: "b54af3de06d5a082342f10c73388e0b0"`) die Materialmenge über die kuratierte Overlay-Datei setzen statt eine dritte Extraktions-Codepfad zu bauen, es sei denn, die Phase soll das gezielt beheben (dann: `orderLines` in `metrics-baseline.mjs` würde von 285 auf 286 steigen — Ursache dokumentieren, nicht die Klinke stillschweigend anpassen).
**Warnzeichen:** Eine Karte mit leerer „Gib"-Spalte, obwohl die Beschreibung klar eine Lieferung verlangt.

### Pitfall 3: Handliste ist auf Patch 4.8.1 eingefroren, Spieldaten stehen auf 4.10.0
**Was schiefgeht:** Selbst bei erfolgreicher Namens-/Materialzuordnung zwischen Handliste und den 69 Spieldaten-Verträgen können die konkreten Mengen abweichen, weil die Handliste laut eigenem Kopfkommentar in `wikelo-emporium.astro` (Zeile 66–68) „Patch 4.8.1, as of 2026-06-04" eingefroren ist. Die automatisierte Jaccard-Prüfung dieser Recherche fand 14 von 69 Verträgen mit Materialüberdeckung unter 50 % gegen die Handliste — mehr, als reine Fehlzuordnung erklären würde.
**Warum es passiert:** Wikelos Angebot rotiert patchweise (die 4.10-Notes nennen explizit „Wikelo Inventory Updates", Register-Eintrag id 51). Ein Merge, der die alten Handliste-Mengen unbesehen als „mats" weiterträgt, würde für Bestandsverträge falsche Zahlen zeigen — genau der Fehler, den diese Phase beheben soll.
**Wie vermeiden:** Für JEDEN der 69 Verträge müssen die Mengen aus `wikelo-gamefiles.json` kommen (bzw. aus der kuratierten Overlay-Datei NUR für den einen Sonderfall aus Pitfall 2), niemals aus der alten Handliste — die Handliste liefert für D-01 ausschließlich `img`/`comps`/`rep`, keine Mengen.
**Warnzeichen:** Ein Vertrag, dessen angezeigte Menge nicht mit `assets/wikelo-gamefiles.json` übereinstimmt.

### Pitfall 4: Veraltete Quellenangabe im sichtbaren Text
**Was schiefgeht:** `src/components/topics/wikelo-emporium.astro` behauptet an zwei Stellen, alle Handelsdaten stammten „direkt aus der Datendatei des Live-Trackers wikelotrades.com" (Zeile 338) bzw. nennt `wikelotrades.com` als alleinige Quelle für „Handels-Details" (Zeile 407). Nach dieser Phase ist das nur noch für Bild/Ausstattung/Reputationstext richtig — Angebote und Mengen kommen aus den Spieldateien.
**Warum es passiert:** Die Quellenangabe wurde nie automatisch geprüft (anders als bei `sc-craft.tools`, wo `scripts/audit-site.mjs` eine `FORBIDDEN_SOURCE`-Konstante führt, DATA-01-Präzedenzfall) — es gibt aktuell keinen Wächter, der eine falsche Quellenangabe für Wikelo erkennen würde.
**Wie vermeiden:** Copy-Text an beiden Stellen aktualisieren: Angebote/Mengen „aus den Spieldateien", Bilder/Ausstattung weiterhin `starcitizen.tools`/`wikelotrades.com` (Attribution-Komponente Zeile 418 bleibt für Bilder korrekt). Kein neues Audit-Tor nötig, es sei denn, der Betreiber wünscht ausdrücklich eines nach dem `FORBIDDEN_SOURCE`-Muster.
**Warnzeichen:** Der Satz „direkt aus der Datendatei des Live-Trackers" bleibt im Diff unverändert stehen.

### Pitfall 5: 32 von 69 Verträgen teilen ein generisches Template — bereits gelöst, nicht neu erfinden
**Was schiefgeht (historisch, bereits vermieden):** Wer nur `objectiveTokens[].objectiveHandler.haulingOrders[]` liest, sieht nur 37 von 69 Verträgen mit Gegenleistung, weil 32 Verträge das generische Template `ItemResourceGathering_TheCollector` teilen, dessen konkrete Waren aus `paramOverrides.propertyOverrides[]` mit `missionVariableName: "HaulingOverride"` kommen.
**Warum es hier steht:** Reine Warnung an den Planner, diesen bereits gelösten Fall in `datamine-wikelo.mjs` (Kommentarblock „ZWEI Wege, beide nötig") NICHT für ein neues Problem zu halten und nicht erneut zu lösen zu versuchen.
**Wie vermeiden:** `datamine-wikelo.mjs` unverändert lassen — dieser Teil ist fertig und durch die heutige Messung bestätigt (68 von 69 mit Gegenleistung, 285 Warenposten, 0 ohne Namen).
**Warnzeichen:** —

## Zahlen-Abgleich (heute, 28.08.2026, read-only gemessen)

Alle Zahlen unten stammen aus zwei read-only Läufen dieser Recherche-Sitzung: `node scripts/datamine-wikelo.mjs --report` (nur lokale `Data.p4k`, kein Netz) und `node scripts/probes/wikelo-dreivergleich.mjs` (zusätzlich MediaWiki-API von starcitizen.tools, read-only GET). `[VERIFIED: lokaler Messlauf dieser Sitzung gegen gameVersion 4.10.0-live.12519617]`

**Spieldaten (neuer Extraktor, `TheCollector`):**
- 87 Verträge insgesamt unter `TheCollector`, davon **69 ausgeliefert** (ohne `notForRelease`/`workInProgress`) — das ist die 69 aus dem Phasenziel und die Zahl, die auf die Sperrklinke (D-04) gehört.
- 68 mit Gegenleistung, 1 ohne (Pitfall 2)
- 285 Warenposten gesamt, 0 ohne Anzeigename
- 66 von 69 mit auflösbarem Titel, 3 ohne (Pitfall 1 / D-03)

**Gegenquelle (Wiki, starcitizen.tools):** 62 Verträge — deckt sich mit dem in Register-Eintrag id 51 protokollierten Wert.

**Titel-Abgleich Spieldaten ↔ Wiki** (der einzige laut Register-Eintrag id 51 tragfähige Vergleich — NICHT gegen die Handliste, NICHT über Belohnungsnamen):

| Größe | Wert | Erklärung |
|-------|------|-----------|
| Wiki-Verträge mit Titel-Treffer in den Spieldaten | 59 von 62 | 62 − 3 (s. u.) |
| davon deckungsgleich (Titel + Mengen) | 57 | Das ist die „57 von 59" der ROADMAP — korrekt, bezieht sich auf die 59 titelgleich gefundenen, NICHT auf alle 69 |
| davon abweichend | 2 | „Clipper Fight Now" (Metamaterial-Testnummer #152 vs. wiki #146 — vermutlich veraltete Wiki-Seite) und „Make jumpy ATLS shoot" (eine Materialzeile weicht ab) |
| Wiki-Verträge ohne Titel-Treffer in den Spieldaten | 3 | **NICHT „entfernt/umbenannt"** wie D-03 unterstellt — s. Pitfall 1: alle drei existieren, nur ohne auflösbaren Titel (die ATLS-Farbvarianten) |
| Spieldaten-Verträge ohne Titel-Treffer in der Wiki | **7** (nicht 8) | Die korrekte Zahl für D-02, s. u. |

Bilanz: 59 + 3 + 7 = 69. ✓

### D-02 korrigiert: sieben, nicht acht
Die ROADMAP nennt acht Namen, von denen einer — **„ICC Special Delivery"** — im heutigen 69-Vertrags-Bestand unter keinem Titel und keinem `debugName` vorkommt. Dieser Name stammt aus dem ÄLTEREN, im Register-Eintrag id 51 selbst als überholt dokumentierten ersten Fund (Basis: `missions.json`-Textsuche, nur 56 Familien, VOR dem Bau von `datamine-wikelo.mjs`). Die ROADMAP hat die alte Drei-Namen-Liste aus Register id 51 unabsichtlich mit der neuen Sieben-Namen-Liste dieser Phase vermischt. Die korrekte, heute gemessene Liste:

„Armor with horn and string", „Heavy and Bright", „New Move Big Starlancer Ship", „Noxy Mod", „Too Much Gun", „Very Hungry", „Wikelo Arrive to System" — **7 Einträge**.

Einordnung je Vertrag (gemessen, nicht vermutet):

| Vertrag | Belohnung | Bereits in Handliste? | Einordnung |
|---------|-----------|------------------------|------------|
| „Very Hungry" | keine (rewardItems leer) | **Ja** — `cat: "misc"`, Materialien decken sich 1:1 | Bereits bekanntes, geber-ohne-Gegenleistung-Angebot — braucht nur die `id` |
| „Armor with horn and string" | Ana Arms/Legs/Core/Helmet Endro | Ja — „Ana Armor Endro (Set)" (Materialien decken sich exakt: Carinite (Pure) + 4× Antium-Teile) | Braucht nur die `id`-Zuordnung, keine neue Kuration |
| „New Move Big Starlancer Ship" | MISC Starlancer TAC Wikelo War Special | Ja — „Starlancer TAC" (Materialien + Favor 50 decken sich) | Braucht nur die `id`-Zuordnung |
| „Wikelo Arrive to System" | **keine** (rewardItems leer, nur Reputation `Wikelo_10`) | Nein | Intro-/Tutorial-Charakter (Beschreibung: „Recent addition to your system…"). Kandidat für „Werkstattrest" bzw. Sonderfall ohne Tauschkarte — **Betreiber-Entscheidung nötig, ob er auf der Seite erscheint** |
| „Heavy and Bright" | BUL-H4 Helmet/Armor/Ammo Carrier Snow Camo | Nein | Echter Neuzugang, braucht neue Bild-/Ausstattungskuration |
| „Noxy Mod" | Aopoa Nox Wikelo Special | Nein | Echter Neuzugang, braucht neue Bild-/Ausstattungskuration |
| „Too Much Gun" | Vendetta „Snow Camo" HMG + Magazin | Nein | Echter Neuzugang, braucht neue Bild-/Ausstattungskuration |

Von den „sieben" sind also **drei bereits inhaltlich bekannt** (brauchen nur die `id`), **einer ist ein Sonderfall ohne Belohnung** (Betreiber-Entscheidung), und **drei sind echte Neuzugänge** ohne jede Kuration.

### D-03 korrigiert: die drei ATLS-Verträge sind nicht entfernt
„ATLS Cool Metal Color", „ATLS Orange Line", „ATLS Snowland Color" sind **nicht** entfernt — sie existieren im 4.10-Bestand, nur ohne auflösbaren Titel (Pitfall 1). Die drei Kandidaten (`debugName` `TheColllector_Vehicle_Ground_ATLS_OrangeNGrey`/`RedNBlue`/`WhiteNGreen`, alle mit Belohnung „ATLS GEO"):

| `debugName` | Orders (gemessen) | Abgleich gegen Handliste | Konfidenz |
|-------------|--------------------|-----------------------------|-----------|
| `..._RedNBlue` | 1× Wikelo Favor, 1× Carinite (Pure), 1× Argo ATLS | **Exakter Treffer** gegen „ATLS GEO 'Cool Metal'" (1× Carinite (Pure), 1× Argo ATLS, Favor 1) | Hoch |
| `..._WhiteNGreen` | 1× Wikelo Favor, 1× Irradiated Valakkar Pearl (Grade AAA), 1× Argo ATLS | Kein Treffer in der aktuellen Handliste. Name „Snowland" passt semantisch (White/Green ≈ Schnee) | Niedrig — unbestätigt, braucht Sichtprüfung |
| `..._OrangeNGrey` | 1× Wikelo Favor, 1× Argo ATLS (sonst nichts) | Passt NICHT zur Handliste „ATLS GEO 'Orange Line'" (dort: 36× SCU Quantanium + 8× Copper + 8× Tungsten + 8× Corundum — deutlich umfangreicher) | Niedrig — entweder ist die Handliste hier veraltet (Pitfall 3), oder die Zuordnung ist falsch |

### D-04: die Zahl auf der Sperrklinke
**69** (Verträge) und **285** (Warenposten) — heute gemessen gegen `gameVersion: "4.10.0-live.12519617"`. **Nicht** 56 (veralteter `missions.json`-Zwischenstand, im Register-Eintrag id 51 selbst als überholt markiert), **nicht** 59 oder 62 (Teilmengen bzw. Fremdzahl aus dem Wiki-Abgleich, keine Aussage über den eigenen Bestand).

## Code Examples

### Neue Sperrklinken-Zeilen (D-04)
```javascript
// Source: zu ergänzen in scripts/lib/metrics-baseline.mjs, Abschnitt "Wikelo"
{
  id: 'wikeloVertraege',
  wert: 69,
  regel: 'min',
  toleranzProzent: 2, // Bestand rotiert patchweise (Register-Eintrag id 51: "Wikelo Inventory Updates")
  anlass:
    'Phase 20, Messlauf 28.08.2026 gegen gameVersion 4.10.0-live.12519617. ' +
    'Vorher handgepflegt (63 Eintraege, eingefroren auf Patch 4.8.1) und ohne ' +
    'Bestandsschutz — Register-Eintrag id 51.',
},
{
  id: 'wikeloWarenposten',
  wert: 285,
  regel: 'min',
  toleranzProzent: 2,
  anlass: 'Phase 20, Messlauf 28.08.2026 — 285 Warenposten ueber 68 von 69 Vertraegen.',
},
```
```javascript
// Source: zu ergänzen in scripts/verify-metrics.mjs, ABLESER
wikeloVertraege: () => rd('assets/wikelo-gamefiles.json').counts?.contracts,
wikeloWarenposten: () => rd('assets/wikelo-gamefiles.json').counts?.orderLines,
```
Hinweis: `rd()` liest hier bewusst `assets/wikelo-gamefiles.json` (die maschinelle Rohausgabe, gitignored aber lokal/im CI-Datenlauf vorhanden), nicht `assets/wikelo-trades.json` — dieselbe Logik wie bei `items`/`fahrzeuge`, die ebenfalls gegen den unmittelbaren Erzeuger-Output lesen, nicht gegen ein zwischengeschaltetes UI-Format.

### Favor-Zeile aus `orders[]` heraustrennen
```javascript
// Vorschlag für build-wikelo-trades.mjs
const FAVOR_KLASSE = 'Carryable_1H_CY_banu_favour_Wikelo';
const favorOrder = vertrag.orders.find((o) => o.klasse === FAVOR_KLASSE);
const favor = favorOrder?.min ?? null;
const mats = vertrag.orders
  .filter((o) => o.klasse !== FAVOR_KLASSE)
  .map((o) => `${o.min}× ${o.name}`); // "×" (Multiplikationszeichen), nicht "x" — bestehende Konvention in wikelo-trades.json
```

### Verzugstor-Zeile (D-04, Wikelo von HANDPFLEGE nach STANDS)
```javascript
// Source: Vorbild scripts/verify-datastand.mjs, Zeile 62 ("Zerlegung")
// Wikelo-Zeile aus HANDPFLEGE entfernen, stattdessen in STANDS ergänzen:
{
  id: 'Wikelo',
  file: 'assets/wikelo-trades.meta.json',
  get: (j) => j?.gameVersion,
  companion: { file: 'assets/wikelo-trades.json', countField: 'entryCount' },
},
// und in KLINKEN ergänzen: Wikelo: 12519617
```

## State of the Art

| Alter Ansatz | Neuer Ansatz | Wann geändert | Bedeutung |
|---------------|---------------|-----------------|-----------|
| `assets/wikelo-trades.json` komplett von Hand getippt, Quelle `wikelotrades.com`, eingefroren auf Patch 4.8.1 (04.06.2026) | Zusammenführung: Angebote/Mengen aus `Data.p4k` via `datamine-wikelo.mjs`, nur Bild/Ausstattung/Reputationstext bleiben kuratiert | Diese Phase (Betreiber-Rückfrage 28.08.2026) | Die Seite zeigt patch-aktuelle Mengen statt eines seit Juni eingefrorenen Snapshots; Register-Eintrag id 51 kann geschlossen werden |
| Kein Bestandsschutz für Wikelo-Daten (Register id 51: „Handpflege" ohne Klinke) | `verify:metrics` + `verify:datastand` fangen Rückgänge/Verzug automatisch, Rail A | Diese Phase (D-04) | Ein zukünftiger fehlerhafter `datamine:wikelo`-Lauf (z. B. gegen einen alten Client) fällt sofort auf, statt unbemerkt zu bleiben — derselbe Ausfallmodus, den `verify-metrics.mjs`s Kopfkommentar für den Item-Katalog beschreibt (−834 Items, Wochen unbemerkt) |

**Veraltet/überholt:**
- Die 46-Treffer-Meldung eines naiven Titel-Abgleichs gegen `missions.json` (Register id 51, erster Anlauf) — ausdrücklich als Matching-Artefakt verworfen, nicht wiederverwenden.
- Ein Namensabgleich Wiki gegen Handliste (Register id 51, zweiter Anlauf) — ebenfalls verworfen, aus demselben Grund (Wiki nennt den Vertragstitel, Handliste die Belohnung).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Das `id`-Feld der Verträge (32-stelliger Hex-String) ist über Patches hinweg stabil, solange CIG den Vertrag nicht löscht/neu anlegt | Architecture Patterns, Pattern 2 | Falls die `id` sich bei jedem Datamine-Lauf ändert, bricht der D-01-Merge-Schlüssel bei jedem Patch — die kuratierte Overlay-Datei müsste dann neu zugeordnet werden. Empfehlung: nach dem nächsten Patch (4.10.x oder 4.11) `datamine-wikelo.mjs` erneut laufen lassen und die `id`-Werte gegen den heutigen Stand diffen, bevor die Zusammenführung produktiv geht |
| A2 | `..._RedNBlue` = „ATLS GEO 'Cool Metal Color'" (exakter Materialabgleich) | Zahlen-Abgleich, D-03 | Gering — Materialübereinstimmung ist exakt (1:1), hohe Konfidenz. Falsch nur, wenn zwei verschiedene ATLS-Varianten zufällig identische Materialkosten hätten |
| A3 | `..._WhiteNGreen` = „ATLS Snowland Color" (nur semantische Namensähnlichkeit, kein Materialabgleich möglich, da diese Kombination in der aktuellen Handliste fehlt) | Zahlen-Abgleich, D-03 | Mittel — falsch zugeordnetes Bild/Name auf der Karte, korrigierbar bei der nächsten Sichtung, aber sichtbar falsch bis dahin |
| A4 | `..._OrangeNGrey` ≠ „ATLS GEO 'Orange Line'" der Handliste (Materialkosten passen nicht) — vermutlich ist die Handliste hier veraltet oder die beiden sind unterschiedliche Verträge | Zahlen-Abgleich, D-03 | Mittel — falls „Orange Line" tatsächlich entfernt wurde und `OrangeNGrey` ein anderer, neuer Vertrag ist, bräuchte er eigene Kuration statt der alten „Orange Line"-Daten |
| A5 | „Wikelo Arrive to System" sollte NICHT als Tauschkarte erscheinen (Intro-/Tutorial-Charakter, keine strukturierte Belohnung) | Zahlen-Abgleich, D-02 | Gering-Mittel — reine Darstellungsentscheidung, keine Datenintegrität betroffen; falsch nur, wenn der Betreiber ihn doch zeigen möchte (dann fehlt ihm ein `img`) |
| A6 | Ein separates `build-wikelo-trades.mjs` (statt Merge-Logik inline in `datamine-wikelo.mjs`) ist die bessere Wahl, weil Wikelo eher dem `mining-db`-Fall (mehrere Quellen + laufend gepflegte Kuration) ähnelt als dem `vehicle-external`-Fall (einmalig eingefrorener Snapshot) | Standard Stack, Alternativen erwogen | Gering — beide Muster sind im Repo etabliert und Rail-A-tauglich; falsche Wahl bedeutet höchstens suboptimale Code-Organisation, keinen funktionalen Fehler |

## Offene Fragen

1. **Woher kommt das `cat`-Feld (Filterkategorie: conv/ship/weapon/armor/misc) für neue und rein spieldatenbasierte Verträge?**
   - Was bekannt ist: Die Spieldaten liefern keine direkte Kategorie-Zuordnung; `rewardItems` könnte gegen `assets/universal-items.json`-Typinformationen abgeglichen werden (ähnlich `wikeloItemMatch.ts`), das würde aber Schiffe/Waffen/Rüstung vermutlich zuverlässig treffen, „conv" (reine Favor-Umtausch-Verträge ohne Sachbelohnung) und „misc" aber nicht.
   - Was unklar ist: Ob `cat` Teil der kuratierten Overlay-Datei werden soll (wie `img`/`comps`/`rep`) oder ob eine automatische Ableitung genügt.
   - Empfehlung: `cat` als viertes kuratiertes Feld behandeln, mit sinnvollem Default (z. B. `rewardItems.length === 0 ? 'conv' : 'misc'`) für unkuratierte neue Verträge, damit nichts unsichtbar aus der Filteransicht fällt.

2. **Soll `wikelo-trades.meta.json` `reviewedVersion`/`reviewedAt` behalten, zusätzlich zu einem neuen `gameVersion`-Feld?**
   - Was bekannt ist: `verify-datastand.mjs`s `STANDS`-Tabelle erwartet ein einzelnes `get: (j) => ...`-Feld je Datenstand (i. d. R. `gameVersion`). Das bisherige `reviewedVersion`/`reviewedAt`-Paar beschreibt aber etwas anderes (wann hat ein MENSCH die Kuration zuletzt geprüft) als `gameVersion` (gegen welchen Client wurde EXTRAHIERT).
   - Was unklar ist: Ob beide Konzepte parallel sinnvoll sind (die kuratierten Felder könnten unabhängig vom Datenlauf veralten) oder ob `gameVersion` allein reicht.
   - Empfehlung: Beide Felder behalten — `gameVersion` für D-04/`verify:datastand`, `reviewedAt` (umbenannt auf die kuratierte Overlay-Datei bezogen) für „wann wurde `wikelo-curated.json` zuletzt gegen den Bestand geprüft".

3. **Die 14 von 69 Verträgen mit niedriger Materialüberdeckung gegen die Handliste (Jaccard < 0,5) — sind das durchweg Wirtschafts-Änderungen seit Patch 4.8.1, oder auch Fehlzuordnungen des automatischen Abgleichs dieser Recherche?**
   - Was bekannt ist: Die Liste enthält alle sieben D-02-Neuzugänge (erwartbar, da unkuratiert) plus sieben weitere, teils neue Namen („F8 War Mod", „Make glowy armor", „Most Special Wolf", „Pulse Plus", „Red Fight Apollo", „Want Polaris? Need something special." — der Sonderfall aus Pitfall 2 — und die drei ATLS-Farbvarianten).
   - Was unklar ist: Ob „F8 War Mod" etc. echte Titel-Änderungen bestehender Handlisten-Einträge sind oder ob die Mengen sich nur geändert haben.
   - Empfehlung: Für den Merge alle 69 grundsätzlich aus den Spieldaten bedienen (Pitfall 3) — diese Liste ist nur zur Aufwandsabschätzung der Bild-/Ausstattungskuration relevant, nicht für die Mengen selbst.

## Environment Availability

| Abhängigkeit | Benötigt für | Verfügbar | Version/Stand | Fallback |
|---------------|--------------|-----------|-----------------|----------|
| Lokale `Data.p4k` | `datamine-wikelo.mjs` (Extraktion) | ✓ | gameVersion 4.10.0-live.12519617, heute in dieser Sitzung erfolgreich gelesen | — |
| Netzzugriff zu `starcitizen.tools` (MediaWiki API) | Nur für die Probes (`wikelo-dreivergleich.mjs`, `wikelo-mengen-abgleich.mjs`) zur Sichtungsunterstützung von D-02/D-03 | ✓ | Heute erfolgreich abgefragt | Nicht erforderlich für D-01/D-04 — die Probes sind Diagnosewerkzeuge, kein Teil der Build-Pipeline |
| `npm run gate`/`gate:data` | Abnahme (Erfolgskriterium 4) | ✓ (Skripte vorhanden, Rail A/B etabliert) | — | — |

**Fehlende Abhängigkeiten:** keine, die die Ausführung blockieren.

## Validation Architecture

Übersprungen — `workflow.nyquist_validation` steht in `.planning/config.json` explizit auf `false`.

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` in `.planning/config.json` — Abschnitt daher aufgenommen, auch wenn diese Phase keine neue Angriffsfläche im klassischen Sinn öffnet (kein Nutzer-Input, keine Auth, keine Session).

### Anwendbare ASVS-Kategorien

| ASVS-Kategorie | Trifft zu | Standard-Kontrolle |
|-----------------|-----------|----------------------|
| V2 Authentication | Nein | Keine Auth-Oberfläche betroffen |
| V3 Session Management | Nein | Keine Session-Oberfläche betroffen |
| V4 Access Control | Nein | Statische, öffentliche Seite, unverändert |
| V5 Input Validation | Bedingt ja | Die neue kuratierte Datei `assets/wikelo-curated.json` ist eine neue, von Hand editierbare Eingabefläche in die Build-Pipeline. `build-wikelo-trades.mjs` sollte bei fehlenden/unbekannten `id`-Schlüsseln laut scheitern statt still zu ignorieren (Grundsatz 2, „Selbstauskunft" — Muster aus `verify-metrics.mjs`: `null` statt `0` bei fehlender Quelle) |
| V6 Cryptography | Nein | Nicht betroffen |

### Bekannte Bedrohungsmuster für diesen Stack

| Muster | STRIDE | Standard-Gegenmaßnahme |
|--------|--------|---------------------------|
| Reflektiertes/gespeichertes XSS über kuratierten Freitext (`img`, `rep`, Beschreibungstexte) in der Astro-Seite | Tampering/Information Disclosure | Bereits gegeben: `wikelo-emporium.astro` interpoliert `TRADES`-Felder ausschließlich über normale Astro-`{ausdruck}`-Bindungen (automatisch escaped), NICHT über `set:html` — das bei dieser Seite nur für statische, im Code selbst definierte Icon-SVGs verwendet wird. Diese Trennung beim Merge unbedingt beibehalten: keine Wikelo-Datenfelder (auch nicht kuratierte) über `set:html` ausgeben |

## Sources

### Primär (HOCH — heute selbst gemessen)
- `node scripts/datamine-wikelo.mjs --report` und ohne `--report` (schreibt `assets/wikelo-gamefiles.json`) — lokale `Data.p4k`, kein Netz, diese Sitzung
- `node scripts/probes/wikelo-dreivergleich.mjs` — MediaWiki-API `starcitizen.tools`, read-only, diese Sitzung
- `.planning/WINDOWS.md`, Register-Eintrag id 51, vollständig gelesen
- `assets/wikelo-trades.json`, `assets/wikelo-trades.meta.json` (aktueller Stand)
- `scripts/verify-datastand.mjs`, `scripts/lib/metrics-baseline.mjs`, `scripts/verify-metrics.mjs`, `scripts/run-gate.mjs`, `scripts/lib/gate-registry.mjs` — vollständig gelesen
- `scripts/build-mining-db.mjs`, `assets/mining-curated.json`, `scripts/datamine-vehicles.mjs`, `src/data/vehicle-external.json` — Präzedenzfälle, vollständig/auszugsweise gelesen
- `src/components/topics/wikelo-emporium.astro`, `src/lib/wikeloItemMatch.ts`, `assets/wikelo-bridge.js`, `src/components/WikeloBridge.astro` — Konsumentenseite, gelesen
- `./CLAUDE.md` — vollständig gelesen

### Sekundär (MITTEL)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` (auszugsweise, erste ~330 Zeilen) — Projektkontext

### Tertiär (NIEDRIG)
- Keine ungeprüften Web-Suchergebnisse verwendet — diese Recherche war vollständig repo-intern plus zwei read-only Live-Messungen.

## Metadata

**Confidence breakdown:**
- Zahlen (69/285/62/59/57/2/3/7): HOCH — heute selbst gemessen, reproduzierbar über `npm run datamine:wikelo -- --report` und die beiden Probes
- Architekturempfehlung (D-01, kuratierte Zulieferdatei + separates Build-Skript): MITTEL-HOCH — zwei vollständig gelesene, im Gate laufende Präzedenzfälle im selben Repo
- Inhaltliche Zuordnung D-02/D-03 (welcher Vertrag ist ein Werkstattrest, welche ATLS-Farbe welcher Name): NIEDRIG — automatisierte Annäherung (Jaccard-Ähnlichkeit über Materialmengen), braucht Betreiber-Sichtung vor Festschreibung

**Research date:** 2026-08-28
**Valid until:** Bis zum nächsten Spiel-Patch, der Wikelos Bestand verändert (spätestens bei 4.10.x/4.11 erneut gegen den dann aktuellen `gameVersion`-Stand prüfen — insbesondere Annahme A1 zur Stabilität der Vertrags-`id`)
