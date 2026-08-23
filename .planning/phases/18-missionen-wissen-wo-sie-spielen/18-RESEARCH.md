# Phase 18: Missionen wissen, wo sie spielen - Research

**Researched:** 2026-08-23
**Domain:** Statische Astro-Datenseite (Node-Datamine-Skript -> committetes JSON -> serverseitig gerenderte Karten/Detailseiten, kein Client-Fetch der Rohdaten)
**Confidence:** HIGH — alle vier tragenden Zahlen (D-01 bis D-04) wurden in dieser Sitzung gegen die installierte 4.9.0 (CL 12344265, `F:/Games/Star Citizen/StarCitizen/LIVE/`) selbst nachgerechnet, nicht nur aus der ROADMAP übernommen.

<user_constraints>
## User Constraints (aus ROADMAP.md — es gibt keine CONTEXT.md für diese Phase)

Diese Phase hat keine `/gsd-discuss-phase`-Sitzung durchlaufen. Die Betreiberentscheidungen
stehen stattdessen als D-01 bis D-04 direkt im ROADMAP-Eintrag „Phase 18" und sind bereits
bestätigt (gleicher Umgang wie bei Phase 7, 9 und 10). Sie sind **verbindlich**, keine
Diskussionsgrundlage.

### Locked Decisions (D-01 bis D-04, aus ROADMAP.md)

- **D-01 — Die Ortskante wird gezogen.** `locationMissionAvailable` wird zusätzlich zu
  `localityAvailable` gelesen und als Ort geführt, wo `localityAvailable` fehlt. Zielmarke:
  von 43 auf mindestens 800 Missionsfamilien mit Ortsangabe.
- **D-02 — Die Ortsangabe wird ehrlich grob dargestellt.** Die Kante trägt Orte auf
  Planeten-/Systemebene, nicht auf Stationsebene. Die Anzeige darf keine Genauigkeit
  vortäuschen, die die Kante nicht hat.
- **D-03 — Die Slot-Art bleibt erhalten.** Abhol-, Liefer-, Ziel- und Spielort werden im
  Missionstext unterscheidbar geführt und beschriftet statt als eine Sorte Platzhalter.
- **D-04 — Jeder Datenstand nennt seinen Patch.** Die vier Dateien ohne Kennung
  (`universal-items.json`, `wikelo-trades.json`, `dismantling-items.json`,
  `refinery-data.json`) bekommen eine; ein Tor meldet Verzug gegenüber der Auslieferung.

### Ausdrücklich ausgeschlossen (Sackgasse, geprüft)

`CraftingQualityLocationOverrideRecord` (12 Einträge) — führt bei allen zwölf einen leeren
Verteilungssatz. Unfertige Herstellerarbeit, keine Daten. Wer sie anfassen will, muss zuerst
belegen, dass sich das geändert hat.

### Was NICHT angefasst wird

Keine neue Datenbeschaffung. Kein Feld wird neu erhoben — die Phase reicht durch, was beim
Einlesen bereits vorliegt. Kein neues Werkzeug, keine neue Seite.

### Claude's Discretion (nicht in D-01..D-04 festgelegt, hier zu entscheiden)

- Ob die neuen Orte in dieselbe `localities`-Struktur einfließen wie die heutigen 7
  `MissionLocality`-Einträge, oder in eine parallele Liste (Empfehlung unten: dieselbe,
  siehe „Architecture Patterns").
- Die konkrete Übersetzungstabelle interner Kürzel (`Stanton1` -> `Hurston` usw.) und ihr
  Sitz im Code.
- Die Form des D-03-Tokens im JSON (voller Slot-Name vs. Kurzform) und die daraus folgende
  Anpassung von `PH_TITLE` in `src/lib/missions.ts`.
- Die konkrete Bauform des Verzugs-Tors aus D-04 (Schiene A vs. bestehendes
  Best-Effort-Muster wie `verify:mining`).

### Deferred Ideas

Keine — es gibt keine CONTEXT.md mit einem `## Deferred Ideas`-Abschnitt. Die ROADMAP nennt
unter „Was NICHT angefasst wird" nur Ausschlüsse (oben), keine zurückgestellten Ideen.
</user_constraints>

## Summary

Die Phase hat **keine Datenbeschaffungslücke** — sie hat eine **Durchreichlücke**. Alle vier
tragenden Zahlen wurden in dieser Sitzung gegen die installierte 4.9.0 (CL 12344265)
nachgemessen und bestätigen die ROADMAP exakt, mit einer wichtigen Präzisierung: die „24
verschiedenen Orte" aus D-02 sind vollständig aufgelistet (siehe unten), und **7 davon decken
98,2 % aller 1.836 Vorkommen ab** — ein kleines, kuratiertes Wörterbuch reicht für den
Löwenanteil.

Die wichtigste Erkenntnis für die Planung: **Die Oberfläche braucht wahrscheinlich KEIN
neues Filterfeld.** `MissionsApp.astro` hat bereits ein Feld „Region" (`#mx-loc`), gespeist
aus `db.localities` und `m.localities`/`m.localityNames` — exakt die Felder, die D-01 füllen
soll. Der Filtermechanismus ist rein clientseitig über `data-loc`-Attribute (kein Fetch, kein
Framework, siehe `assets/missions-app.js`). Sobald `datamine-missions.mjs` mehr Familien mit
Ortsangabe ausgibt, zeigt die bestehende Infrastruktur automatisch mehr Treffer — die Aufgabe
verschiebt sich fast vollständig in den Datamine-Schritt und in die Übersetzung der internen
Kürzel, nicht in neue UI-Arbeit.

Die zweite wichtige Erkenntnis betrifft D-04: **`refinery-data.json` trägt bereits eine
Kennung** (`meta.gameVersion`, durchgereicht aus `mining-db.json`). Die ROADMAP-Aussage „vier
Dateien ohne Kennung" ist an dieser Stelle nicht mehr ganz aktuell — es sind noch drei
(`universal-items.json`, `wikelo-trades.json`, `dismantling-items.json`), und die brauchen
unterschiedliche Lösungen: `universal-items.json` hat bereits p4k-Zugriff im Erzeuger (leicht
nachzuziehen, gleiches Muster wie `datamine-missions.mjs`), `dismantling-items.json` ist ein
JSON-Array ohne Kopf (Formänderung nötig, mit Ausstrahlung auf einen Client-Fetch), und
`wikelo-trades.json` ist vollständig handgepflegt ohne Erzeugerskript (eine Changelist-Kennung
wäre dort unwahr — braucht ein anderes Modell, siehe „Common Pitfalls").

**Primary recommendation:** Zwei nahezu unabhängige Arbeitsstränge. Strang 1 (D-01/D-02/D-03,
der Missionsbereich): `datamine-missions.mjs` um das zweite Ortsfeld und den erhaltenen
Slot-Typ erweitern, eine kleine kuratierte Namenstabelle nach dem Vorbild von
`datamine-stanton-anchors.mjs`/`datamine-locations.mjs` ergänzen, die bestehende
`localities`-Struktur mitbenutzen — keine neue UI-Komponente. Strang 2 (D-04, site-weit): ein
neues Tor, das die Patch-Kennungen der committeten JSON-Dateien gegeneinander (Schiene A,
CI-tauglich) und best-effort gegen den installierten Client (wie `verify:mining`) prüft; dafür
müssen zunächst drei Erzeuger und ein Sonderfall (Wikelo) eine Kennung bekommen.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ortsfeld aus `Game2.dcb` lesen (D-01) | Datamine-Skript (Node, lokal, Schiene B) | — | Reine Extraktion, läuft nie im Browser oder im CI-Build |
| Interne Kürzel -> lesbare Namen (D-02) | Datamine-Skript (kuratiertes Wörterbuch im Erzeuger) | — | Wie `LOC_NAMES` in `datamine-locations.mjs` — Übersetzung gehört an die Quelle, nicht in die Anzeige-Komponente |
| Ortsfilter in der Oberfläche | Statisches Astro-Markup (`MissionsApp.astro`, serverseitig gerendert) | Client-JS (`missions-app.js`, reines Ein-/Ausblenden über `data-loc`) | Kein Framework, kein Fetch der Rohdaten — Filterung ist bereits gebaut, nur die Datenbasis fehlt |
| Slot-Art im Titel/Text (D-03) | Datamine-Skript (`braces()`/`analyseTitle()`) | `src/lib/missions.ts` (`PH_TITLE`-Wörterbuch für SEO-Text) | Die Token entstehen beim Einlesen; die Anzeige (Karten/Detail) übernimmt sie unverändert als `{...}`-Chip |
| Patch-Kennung je Datenstand (D-04) | Erzeuger-Skripte (`build-universal-db.mjs`, `datamine-crafting.mjs`, `build-refinery-data.mjs`) | Neues Prüftor (Schiene A + Best-Effort wie `verify:mining`) | Die Kennung muss am Ort der Erzeugung entstehen; das Tor prüft nur, was schon im JSON steht |
| Datenherkunft im sichtbaren Text | — | `audit:site` (bestehendes Tor, unverändert) | Diese Phase fügt keinen neuen sichtbaren Text hinzu, der Datenherkunft nennen könnte — reine Ortsnamen und Slot-Bezeichnungen sind unkritisch |

## Standard Stack

Diese Phase installiert **keine neuen Pakete**. Sie arbeitet ausschließlich mit dem
bestehenden Werkzeugkasten des Projekts:

| Werkzeug | Zweck in dieser Phase | Bereits im Projekt |
|----------|------------------------|---------------------|
| `scripts/lib/datacore.mjs` | DataCore-v8-Reader (Node-nativ) | Ja — von `datamine-missions.mjs` bereits genutzt |
| `scripts/lib/p4k.mjs` | Data.p4k öffnen, `build_manifest.id` lesen | Ja |
| Node `fs`/`path` | JSON lesen/schreiben | Ja |
| `scripts/lib/gate-registry.mjs` + `scripts/run-gate.mjs` | Neues Tor eintragen und einhängen | Ja — Muster für D-04 |

**Installation:** entfällt.

## Package Legitimacy Audit

**Nicht anwendbar.** Diese Phase installiert keine externen Pakete (weder npm noch sonst
etwas). Es werden ausschließlich bestehende, bereits im Projekt verankerte Skripte erweitert.

## Architecture Patterns

### System Architecture Diagram

```
Data.p4k (lokal, F:/Games/Star Citizen/StarCitizen/LIVE/)
   |
   |  Game2.dcb (DataCore v8) + Localization/english/global.ini
   v
scripts/datamine-missions.mjs  <-- HIER setzt D-01/D-02/D-03 an
   |  - liest MissionBrokerEntry.localityAvailable (heute)
   |  - liest MissionBrokerEntry.locationMissionAvailable (NEU, D-01)
   |    -> zeigt auf StarMapObject, wird schon in Zeile 200 als `starmap` eingelesen
   |  - kuratiertes Woerterbuch: interne Kuerzel -> lesbare Namen (NEU, D-02)
   |  - braces(): ~mission(Slot|Address) -> {Token}   <-- D-03 aendert hier die
   |    Kollabierung (heute: nur letztes Segment; Ziel: Slot-Art erhalten)
   v
src/data/missions.json  (committeter Snapshot, NIE vom Client geladen)
   |  meta.patch bereits vorhanden (heute z.B. "sc-alpha-4.9.0@12326004")
   v
src/lib/missions.ts  (Typen, Formatierung, PH_TITLE-Woerterbuch fuer SEO)
   |
   +--> src/components/MissionsApp.astro  (Liste, serverseitig gerendert)
   |      - #mx-loc <select>, gespeist aus db.localities   <-- EXISTIERT SCHON
   |      - Karten tragen data-loc="stanton1 pyro2 ..."     <-- EXISTIERT SCHON
   |      - assets/missions-app.js filtert rein clientseitig, kein Fetch
   |
   +--> src/components/MissionDetail.astro  (Detailseite je Mission)
   |      - m.localityNames, m.places  (Fakten-Tabelle)
   |      - {Token}-Chips aus title/desc (md__ph)
   |
   +--> src/pages/missions-search.json.ts  (1-Tage-gecachter Suchindex,
   |      searchText() zieht localityNames/places mit ein — profitiert automatisch)
   |
   +--> src/pages/sitemap-missions.xml.ts  (unveraendert, keine neuen Seiten)

--- unabhaengiger Strang, D-04 ---

vier JSON-Dateien unter assets/ (Quelle) -> public/assets/ (Spiegel, gitignored)
   universal-items.json   <- build-universal-db.mjs        (hat p4k-Zugriff, KEINE Kennung heute)
   dismantling-items.json <- datamine-crafting.mjs (Teil)   (Array ohne Kopf, KEINE Kennung heute)
   refinery-data.json     <- build-refinery-data.mjs        (HAT bereits meta.gameVersion!)
   wikelo-trades.json     <- KEIN Erzeuger, 63 Handeintraege (KEINE Kennung, kann keine Changelist tragen)
   missions.json / mining-db.json / crafting-db.json        (bereits gekennzeichnet, Referenzmuster)
        |
        v
   neues Tor (D-04): liest NUR die committeten JSON-Meta-Felder gegeneinander
   (Schiene A, CI-tauglich) + best-effort gegen build_manifest.id (wie verify:mining)
```

### Recommended Project Structure

Keine neuen Verzeichnisse oder Dateien nötig außer dem neuen Prüfskript für D-04:

```
scripts/
├── datamine-missions.mjs      # D-01/D-02/D-03: erweitert, nicht neu
├── build-universal-db.mjs     # D-04: um patchLabel-Ermittlung erweitert
├── datamine-crafting.mjs      # D-04: dismantling-items.json bekommt eine meta-Huelle
├── build-refinery-data.mjs    # D-04: unveraendert (hat schon gameVersion)
├── verify-datastand.mjs       # D-04: NEU — das Verzugs-Tor
└── lib/
    └── gate-registry.mjs      # D-04: neuer Eintrag fuer verify-datastand
```

### Pattern 1: Kuratierte Kuerzel-Uebersetzung am Erzeuger (fuer D-02)

**Was:** Ein einfaches `Record<string,string>`-Woerterbuch direkt im Datamine-Skript, das
interne DataCore-Kuerzel auf lesbare Namen abbildet — genau das Muster, das im Projekt schon
zweimal existiert.

**Wo es bereits existiert (als Vorlage, nicht zum Wiederverwenden — andere Namensraeume):**

```javascript
// Source: scripts/datamine-locations.mjs:74-81 (LOC_NAMES, Schluessel sind
// hpp_*-Presets, ein anderer Namensraum als StarMapObject)
const LOC_NAMES = {
  hpp_stanton1: 'Hurston', hpp_stanton1a: 'Arial', /* ... */
  hpp_stanton4: 'microTech', /* ... */
};
```

```javascript
// Source: scripts/datamine-stanton-anchors.mjs:47-58 (PLANET/MOON, Schluessel
// sind Ziffern-Kuerzel "1".."4", "1a".."4c" — naeher am Zielnamensraum)
const PLANET = {
  1: { key: 'hurston', name: 'Hurston', lg: 'HUR' },
  2: { key: 'crusader', name: 'Crusader', lg: 'CRU' },
  3: { key: 'arcCorp', name: 'ArcCorp', lg: 'ARC' },
  4: { key: 'microTech', name: 'microTech', lg: 'MIC' },
};
```

**Fuer D-02 empfohlen (neu, im Zielnamensraum von `StarMapObject.name`/`shortName`):** ein
Woerterbuch, das die *tatsaechlich gemessenen* 24 Werte abdeckt (siehe „Common Pitfalls" fuer
die vollstaendige, in dieser Sitzung nachgemessene Liste). Die sieben haeufigsten Werte
(98,2 % aller Vorkommen) sind:

```javascript
// EMPFEHLUNG, noch nicht im Code — Namensraum ist StarMapObject.name (kebab'bar
// mit derselben kebab()-Funktion, die datamine-missions.mjs schon fuer
// localities.id benutzt).
const STARMAP_NAMES = {
  stantonstar: 'Stanton',   // System-Ebene: "irgendwo im Stanton-System"
  stanton1: 'Hurston', stanton2: 'Crusader', stanton3: 'ArcCorp', stanton4: 'microTech',
  pyrostar: 'Pyro',
  delamar: 'Delamar',       // bereits lesbar, nur der Vollstaendigkeit halber
};
```

Die restlichen ~17 Werte (Lagrange-Punkte, Monde, seltene Sonderzonen — je 1-4 Vorkommen)
sind Langschwanz; ein Fallback (`humanize()`-Muster, das `datamine-missions.mjs` bereits fuer
andere Felder hat, oder eine Erweiterung des kuratierten Woerterbuchs um die Mond-Namen aus
`datamine-stanton-anchors.mjs`s `MOON`-Tabelle) reicht dafuer — es ist keine harte
Anforderung, jeden der 24 Werte perfekt zu benennen, solange D-02s Grundsatz („keine
Genauigkeit vortaeuschen, die die Kante nicht hat") nicht verletzt wird.

### Pattern 2: Ortskante am selben `starmap`-Lookup, zweiter Pfad

**Was:** `locationMissionAvailable` zeigt auf `StarMapObject` — denselben Record-Typ, den
`datamine-missions.mjs` bereits in Zeile 199-203 als `starmap`-Map einliest (fuer
`MissionLocality.availableLocations`). D-01 braucht **keinen neuen Lookup**, nur einen
zweiten Lesepfad im Broker-Einlese-Block (um Zeile 568).

**Beispiel (heutiger Code, als Ansatzpunkt):**

```javascript
// Source: scripts/datamine-missions.mjs:568 (heutiger Stand, nur EIN Feld)
const locality = d.localityAvailable?.__ref ? localities.get(d.localityAvailable.__ref) : null;
```

**Empfohlene Erweiterung (Skizze, kein fertiger Code):** wenn `locality` null ist, `
d.locationMissionAvailable?.__ref` gegen `starmap` aufloesen, den Rohwert durchs
`STARMAP_NAMES`-Woerterbuch (Pattern 1) schicken, und daraus einen `localities`-Eintrag
erzeugen/wiederverwenden (`kebab(rawName)` als Id — siehe Pitfall „Zwei Namensraeume, eine
ID-Funktion" unten fuer die Fallstricke dabei).

### Pattern 3: Slot-Art erhalten statt kollabieren (fuer D-03)

**Was heute passiert:**

```javascript
// Source: scripts/datamine-missions.mjs:242-244
const TMPL_RE = /~mission\(([^)]*)\)/g;
const braces = (s) => String(s).replace(TMPL_RE, (_, t) => `{${t.split('|').pop()}}`);
```

`t.split('|').pop()` behaelt nur das LETZTE Segment. Die Quelle traegt aber
`Slot-Art|Format-Hinweis`, z.B. `Location|Address`, `Destination|Address`, `Pickup1|Address`,
`Dropoff1|Address` — nach der heutigen Normalisierung sind alle vier `{Address}`.

**Fuer D-03 zu entscheiden (Claude's Discretion, siehe oben):** ob das ERSTE Segment
(`t.split('|')[0]` -> `Location`/`Destination`/`Pickup1`/`Dropoff1`) als Token-Text verwendet
wird, oder beide Segmente kombiniert. Da die Anzeige (`MissionsApp.astro`/`MissionDetail.astro`)
den Token-Text UNVERAENDERT als Chip anzeigt (siehe `titleParts()`/`parts()`, die nur auf
`{...}` splitten, ohne eigene Uebersetzung), reicht fuer die sichtbare Unterscheidbarkeit
schon das erste Segment. Fuer die SEO-Texte (`seoTitle()`/`seoText()` in
`src/lib/missions.ts`) muss das `PH_TITLE`-Woerterbuch dann NEUE Eintraege fuer
`location`/`destination`/`pickup1`/`dropoff1` (und moeglicherweise `pickup2`,`dropoff2` —
nicht in dieser Sitzung auf hoehere Zahlen geprueft) bekommen; der bestehende Eintrag
`address: 'Location'` wird dadurch obsolet, sollte aber als Fallback stehen bleiben, falls das
Muster nicht ueberall zwei Segmente hat.

### Anti-Patterns to Avoid

- **Ein neues Filterfeld auf der Missionsseite bauen.** `#mx-loc` existiert bereits, ist
  bereits an `db.localities`/`m.localities` verdrahtet und clientseitig gefiltert. Ein
  zweites Feld waere Duplikat-Arbeit und wuerde das „Werkzeug, keine Leinwand"-Prinzip
  zusaetzlich belasten (die Seite hat schon eine volle `.mx__hero` mit Hintergrundbild — sie
  steht NICHT auf der Zielliste `tool-not-canvas` aus fruaeheren Phasen, sollte also nicht
  durch neue UI-Zeilen weiter verschlechtert werden).
- **Eine Changelist-Kennung auf `wikelo-trades.json` erzwingen.** Die Datei hat keinen
  Erzeuger; eine automatisch verglichene Changelist waere dort eine Luege ueber Herkunft, die
  es nicht gibt (Grundsatz 3 aus CLAUDE.md: „Fehlalarme sind teurer als Luecken"). Siehe
  „Common Pitfalls" fuer die empfohlene Alternative.
- **`dismantling-items.json`s Array-Form stillschweigend in ein Objekt umbauen**, ohne den
  Client-Fetch in `assets/crafting-app.js:1304` und den Leser in
  `scripts/build-universal-db.mjs:219` mitzuziehen. Beide erwarten heute ein Array am
  Wurzelknoten.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DataCore-Records lesen | eigener Binaerparser | `scripts/lib/datacore.mjs` (`openDataCore`, `readRecord`) | Bereits vorhanden, von `datamine-missions.mjs` schon fuer `MissionBrokerEntry`/`StarMapObject`/`MissionLocality` genutzt |
| Installierten Client erkennen | eigene Registry-/Prozess-Abfrage | `build_manifest.id` neben der Data.p4k lesen (Muster aus `datamine-missions.mjs:52-58` und `verify-mining.mjs:139-152`) | Bereits zweimal im Projekt erprobt, inkl. `existsSync`-Gatter fuer CI |
| Ein neues Prueftor bauen | Ad-hoc-Skript ohne Registry-Eintrag | `scripts/lib/gate-registry.mjs` + `scripts/run-gate.mjs` | `verify:wiring` erzwingt den Eintrag; ohne ihn ist das Tor ein „Streuner" (genau das Problem, das B3 in `docs/maschinelle-validierung.md` geloest hat) |
| Kuerzel-Uebersetzung | Freitext-Mapping verstreut in der UI-Komponente | Kuratiertes Woerterbuch AM ERZEUGER (Pattern 1) | Die Uebersetzung ist eine Aussage ueber die Spieldaten, nicht ueber die Darstellung — gehoert dorthin, wo auch `LOC_NAMES`/`PLANET`/`MOON` sitzen |

**Key insight:** Diese Phase hat fast keinen "neuen Problemraum" — jedes der vier D-Punkte hat
im Projekt bereits ein Referenzmuster (Lookup-Tabellen fuer Namen, Patch-Kennung aus
`build_manifest.id`, Tor-Registry). Die Arbeit besteht darin, bestehende Muster an drei/vier
Stellen zu wiederholen, nicht neue zu erfinden.

## Common Pitfalls

### Pitfall 1: Zwei Namensraeume, eine ID-Funktion

**Was schiefgehen kann:** `localities`-Map (heute 7 Eintraege) wird aus `MissionLocality`-
Records gebaut (`kebab(shortName(r))`, z.B. `stanton1` aus dem Record `"Stanton1"`). Die NEUEN
Werte aus `locationMissionAvailable` kommen aus `StarMapObject`-Records mit **denselben**
Roh-Bezeichnern (`"Stanton1"`, `"Stanton2"` etc.) — kebab't ergeben sie zufaellig dieselbe ID.
Das ist in diesem Fall ERWUENSCHT (die 43 heute schon georteten Familien und die neu
hinzukommenden teilen sich sinnvoll denselben Eimer „Hurston"), **aber** 20 der 24 gemessenen
Werte (`StantonStar`, `PyroStar`, `Delamar`, `Stanton2_L1/L4/L5`, Mond-Kuerzel wie `Stanton1b`
usw.) haben **keine** Entsprechung in den heutigen 7 `MissionLocality`-Eintraegen und muessen
als NEUE Eintraege in dieselbe Struktur eingefuegt werden.

**Warum es passiert:** Zwei verschiedene DataCore-Struct-Typen (`MissionLocality` vs.
`StarMapObject`) mit teils ueberlappenden, teils eigenen Bezeichnern.

**Wie vermeiden:** Beim Zusammenfuehren explizit pruefen, ob eine `kebab()`-ID bereits in der
`localities`-Map existiert (dann: dieselbe Bucket, ggf. `places[]` NICHT ueberschreiben) oder
neu ist (dann: neuer Eintrag mit dem uebersetzten Namen aus Pattern 1, `places: []` oder ohne
das Feld, da diese Quelle keine Unterorte liefert).

**Warning signs:** Wenn nach der Aenderung `db.localities.length` nicht um ~20 waechst, wurde
wahrscheinlich etwas ueberschrieben statt ergaenzt — mit `node -e "console.log(require('./src/data/missions.json').localities.length)"` leicht nachpruefbar (Referenzwert vor der Aenderung: 7).

### Pitfall 2: `StarMapObject`-Werte sind teils NICHT auf Planeten-/Systemebene

**Was schiefgehen kann:** D-02 verlangt explizit, keine Stationsgenauigkeit vorzutaeuschen.
Von den 24 gemessenen Werten sind die meisten sauber Planet/System (`Stanton1..4`,
`StantonStar`, `PyroStar`, `Delamar`), aber einige sind granularer: `Stanton2_L1/L4/L5`
(Lagrange-Punkte), `Stanton1b/1c/1d/4a/4b/4c/3b/2b` (Monde), und drei Werte
(`RR_P2_L4`, `RR_P3_L2`, `RR_P3_LEO`, `PrisonMine_Stanton1b`) sehen nach Sonderzonen aus
(Rettungsring/Gefaengnis-Kontext), die weder eindeutig Planet noch System sind.

**Warum es passiert:** `locationMissionAvailable` ist ein generisches Ortsfeld im Broker-
Record und bindet nicht ausschliesslich an Planeten — manche Missionen sind praeziser
verortet als andere.

**Wie vermeiden:** Fuer die 17 Langschwanz-Werte (1,8 % aller Vorkommen, je 1-4 Treffer) reicht
ein grober Fallback (z.B. Mond-Name aus der `MOON`-Tabelle in `datamine-stanton-anchors.mjs`
uebernehmen, Lagrange-Punkte als „<Planet> L<N>" anzeigen, Rest ueber `humanize()`). D-02s
Grundsatz ist damit nicht verletzt, weil diese Werte selbst schon eine feinere game-eigene
Kategorie sind (ein Mond IST planetenaehnliche Genauigkeit, keine Station).

### Pitfall 3: `dismantling-items.json` ist ein nacktes Array — D-04 aendert seine Form

**Was schiefgehen kann:** Anders als `universal-items.json` (Objekt mit `meta`-aehnlichen
Feldern auf oberster Ebene) ist `assets/dismantling-items.json` **ein Array von 854
Eintraegen ohne Kopf**. Eine Patch-Kennung dort unterzubringen heisst entweder (a) die
Wurzelform auf `{ meta: {...}, items: [...] }` aendern — dann muessen
`scripts/build-universal-db.mjs:219` (`readJson(...)` erwartet ein Array),
`scripts/datamine-crafting.mjs` (schreibt das Array direkt zurueck,
`writeFileSync(OUT_DIS, JSON.stringify(dis, null, 2))`) UND `assets/crafting-app.js:1304`
(clientseitiger `fetch()`, iteriert das Ergebnis vermutlich als Array) gleichzeitig
angepasst werden — oder (b) die Kennung als Nicht-Item-Eintrag in dasselbe Array schmuggeln
(unschoen, bricht Konsumenten, die jedes Element als Item behandeln) — oder (c) die Kennung in
einer SEPARATEN, kleinen Begleitdatei fuehren (z.B. `dismantling-items.meta.json`), die das
Tor zusaetzlich liest.

**Warum es passiert:** Die Datei ist historisch gewachsen als reiner Item-Snapshot, nie als
versionierter Datensatz gedacht.

**Wie vermeiden:** Vor der Umsetzung entscheiden, welcher der drei Wege gewaehlt wird — das
ist eine Entscheidung mit Ausstrahlung auf drei Dateien, sollte also im Plan explizit als
eigener Task auftauchen, nicht als Nebenwirkung einer anderen Aenderung.

### Pitfall 4: `wikelo-trades.json` hat keinen Erzeuger — eine Changelist waere unwahr

**Was schiefgehen kann:** Die Datei ist vollstaendig handgepflegt (63 Eintraege, kein Skript
schreibt sie). Eine automatisch-verglichene Patch-Changelist (wie bei den anderen drei)
wuerde suggerieren, die Datei sei maschinell aus der p4k gezogen — das waere schlicht falsch
und wuerde D-04s eigenen Zweck („jeder Datenstand nennt seinen Patch, EHRLICH") unterlaufen.

**Warum es passiert:** Die anderen drei Dateien haben alle einen Erzeuger mit p4k-Zugriff;
Wikelo ist die einzige Ausnahme im Vergleich.

**Wie vermeiden (Vorschlag, Claude's Discretion):** Statt einer Changelist ein manuell
gepflegtes Feld wie `reviewed_version: "4.9"` und/oder `reviewed_at: "2026-08-23"`, das ein
Mensch beim naechsten Ueberarbeiten der Liste aktualisiert. Das Prueftor behandelt das Fehlen
oder Veralten dieses Felds als **WARNUNG, nie als FEHLER** (Grundsatz 3 aus CLAUDE.md:
Fremdquellen-/Handpflege-Verzug ist nie FEHLER) — Praezedenzfall im Projekt: `verify:items`
stuft Wiki-Verzug ebenfalls auf WARNUNG herab (`docs/maschinelle-validierung.md`, B5).

### Pitfall 5: `refinery-data.json` bereits gekennzeichnet — ROADMAP ist an dieser Stelle leicht veraltet

**Was schiefgehen kann:** Wird D-04 woertlich als „vier Dateien brauchen eine NEUE Kennung"
umgesetzt, entsteht doppelte Arbeit an `refinery-data.json` — die Datei hat
**bereits** `meta.gameVersion` (aktuell `"4.9.0-live.12248363"`, durchgereicht aus
`DB.game_version` in `scripts/build-refinery-data.mjs:100`, wo `DB` = `mining-db.json` ist).

**Warum es passiert:** Die ROADMAP-Formulierung stammt aus der Messsitzung vom 23.08.2026 und
hat diese Datei vermutlich nur ueber die Abwesenheit einer Erwaehnung in `meta.source`/
`meta.note` gepruegt, nicht ueber das tatsaechliche `meta`-Objekt.

**Wie vermeiden:** Fuer `refinery-data.json` genuegt es, sie in das neue Verzugs-Tor
EINZUBEZIEHEN (das Feld existiert schon) — kein Erzeuger-Umbau noetig. Das Tor sollte
allerdings pruefen, dass `gameVersion` nicht `null` ist (`build-refinery-data.mjs` faellt bei
fehlender `mining-db.json`-Kennung still auf `null` zurueck, ohne Warnung).

## Code Examples

### Patch-Kennung ermitteln (bereits zweimal im Projekt erprobt)

```javascript
// Source: scripts/datamine-missions.mjs:48-58 — dasselbe Muster steckt in
// scripts/datamine-crafting.mjs fuer crafting-db.json (Feld "version")
const bm = resolve(dirname(p4k.path), 'build_manifest.id');
if (existsSync(bm)) {
  try {
    const d = JSON.parse(readFileSync(bm, 'utf8'))?.Data;
    patchLabel = d?.Branch && d?.RequestedP4ChangeNum
      ? `${d.Branch}@${d.RequestedP4ChangeNum}`
      : (d?.Branch ?? d?.Version ?? null);
  } catch { /* egal */ }
}
```

### Best-Effort-Abgleich gegen den installierten Client (CI-sicher durch `existsSync`-Gatter)

```javascript
// Source: scripts/verify-mining.mjs:139-152 — Vorlage fuer das D-04-Tor
const bmPath = resolve(dirname(DEFAULT_P4K), 'build_manifest.id');
if (existsSync(bmPath)) {
  try {
    const d = JSON.parse(readFileSync(bmPath, 'utf8'))?.Data ?? {};
    const clientVersion = `${(d.Branch || '').replace(/^sc-alpha-/, '')}-live.${d.RequestedP4ChangeNum}`;
    need(model.game_version === clientVersion, `game_version (${model.game_version}) stimmt nicht mit dem installierten Client ueberein (${clientVersion})`);
  } catch {
    console.log('  (game_version-Abgleich uebersprungen: build_manifest.id nicht lesbar)');
  }
} else {
  console.log('  (game_version-Abgleich uebersprungen: keine lokale Spielinstallation gefunden)');
}
```

Dieses Muster laeuft bereits auf Schiene A (kein `env`-Feld in der Registry noetig, weil es
NIE die Data.p4k selbst oeffnet, nur `build_manifest.id` als Textdatei) — es ist also schon
CI-tauglich, meldet aber in CI nichts (dort existiert die Datei nicht). Fuer ein **in CI
tatsaechlich wirksames** Verzugs-Tor (D-04 will "ein Tor meldet Verzug gegenueber der
Auslieferung") ist zusaetzlich ein Kreuzvergleich der committeten Kennungen noetig — siehe
naechstes Beispiel.

### Empfohlene Ergaenzung: Kreuzvergleich der committeten Kennungen (CI-tauglich, Schiene A)

Kein Code im Projekt vorhanden — Skizze fuer den neuen Teil von `verify-datastand.mjs`:

```javascript
// Skizze, nicht im Code vorhanden. Liest AUSSCHLIESSLICH committete JSON-Dateien
// (kein p4k, kein Netz, kein Kindprozess) -> Schiene A, laeuft in CI.
const stands = [
  { file: 'src/data/missions.json', get: (j) => j.meta.patch },
  { file: 'assets/mining-db.json', get: (j) => j.game_version },
  { file: 'assets/crafting-db.json', get: (j) => j.version },
  { file: 'assets/universal-items.json', get: (j) => j.gameVersion }, // NEU nach D-04
  { file: 'assets/refinery-data.json', get: (j) => j.meta.gameVersion }, // existiert schon
  // dismantling-items.json / wikelo-trades.json: siehe Pitfall 3/4 — eigene Behandlung
];
// Alle vorhandenen Kennungen extrahieren, auf die Changelist-Zahl reduzieren
// (Regex \d{6,}), und melden, wenn die juengste und die aelteste weiter als eine
// vereinbarte Toleranz auseinanderliegen (Grundsatz 3: WARNUNG, keine feste
// Zahl von Changelists als FEHLER-Schwelle ohne erhobenen Erfahrungswert).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `datamine-missions.mjs` liest nur `localityAvailable` | Zusaetzlich `locationMissionAvailable` als Fallback | Diese Phase (D-01) | 43 -> gemessen 1.836 Broker-Eintraege mit Ortsangabe (vor Familien-Buendelung); die ROADMAP-Zielmarke von >=800 Familien ist mit dieser Datenlage plausibel erreichbar |
| Platzhalter-Normalisierung behaelt nur das letzte Pipe-Segment | Slot-Art (erstes Segment) erhalten | Diese Phase (D-03) | 932 `{Address}`-Vorkommen werden wieder in vier unterscheidbare Sorten aufgeloest |
| `universal-items.json`/`dismantling-items.json`/`wikelo-trades.json` ohne Versionsfeld | Alle drei bekommen eine Kennung (unterschiedliche Form je nach Erzeuger) | Diese Phase (D-04) | Patch-Verzug wird sichtbar, bevor er wie beim CL-12326004-vs-12344265-Fall erst durch Zufall auffaellt |

**Deprecated/outdated:** Keine — diese Phase fuehrt keine Bibliotheks- oder Format-Migration
durch, nur Durchreichungen bestehender Felder.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Die neuen `locationMissionAvailable`-Werte sollen in DIESELBE `localities`-Struktur einfliessen wie die heutigen `MissionLocality`-Eintraege (statt einer parallelen zweiten Liste) | Architecture Patterns, Pattern 2 | Falls falsch: die UI muesste zwei verschiedene Filterlisten fuehren oder zwei Datenmodelle mergen — deutlich mehr Aufwand als angenommen. Empfehlung stuetzt sich darauf, dass beide Quellen denselben `StarMapObject`-Record-Typ referenzieren und die IDs teils bereits kollidieren (Pitfall 1) |
| A2 | Fuer D-03 reicht das ERSTE Pipe-Segment (`Location`/`Destination`/`Pickup1`/`Dropoff1`) als Anzeige-Token, ohne das Format-Segment (`Address`) zu verlieren | Architecture Patterns, Pattern 3 | Falls falsch (z.B. wenn andere Slot-Kombinationen im Missionstext existieren, die dieser Sitzung nicht aufgefallen sind): PH_TITLE-Woerterbuch muesste feiner unterscheiden. Nicht in dieser Sitzung gegen ALLE 416 Slot-Arten durchgezaehlt, nur gegen die vier von der ROADMAP genannten Address-Varianten |
| A3 | Ein manuell gepflegtes `reviewed_version`/`reviewed_at`-Feld ist die richtige Loesung fuer `wikelo-trades.json` statt einer Changelist | Common Pitfalls, Pitfall 4 | Falls der Betreiber lieber GAR keine Kennung fuer Handarbeit will: das Tor muesste diese Datei explizit ausnehmen statt WARNUNG zu melden — Detailfrage, die die Planung klaeren sollte |
| A4 | `dismantling-items.json`s Form-Aenderung (Array -> Objekt mit `meta`) ist der bevorzugte Weg gegenueber einer separaten Begleitdatei | Common Pitfalls, Pitfall 3 | Falls der Betreiber die separate Datei vorzieht (weniger Bruchflaeche): weniger Dateien aendern sich, aber eine fuenfte Datei kommt neu hinzu — Abwaegung, die die Planung treffen sollte |

## Open Questions

1. **Sollen die 17 Langschwanz-Ortswerte (Monde, Lagrange-Punkte, Sonderzonen) einzeln
   uebersetzt werden, oder reicht ein generischer Fallback?**
   - Was wir wissen: sie machen zusammen nur 1,8 % der 1.836 Vorkommen aus (33 von 1.836).
   - Was unklar ist: ob D-02s „ehrlich grob" auch fuer diese seltenen, tatsaechlich
     feineren Werte gilt, oder ob sie besser ganz aus dem Filter herausfallen (auf
     "unbekannt"/Elternplanet zurueckfallen).
   - Empfehlung: in der Planungssitzung (`/gsd-discuss-phase` oder direkt beim Plan-Zuschnitt)
     kurz vorlegen — es ist eine Zwei-Satz-Entscheidung, kein Rechercheaufwand.

2. **Wo genau soll das neue D-04-Tor in der Registry-Reihenfolge stehen, und heisst es
   `verify:datastand` oder etwas anderes?**
   - Was wir wissen: das Muster (Schiene A, `env`-Feld fuer den Best-Effort-Teil) ist klar,
     siehe Code Examples.
   - Was unklar ist: der exakte Name und ob es ein eigenstaendiges Skript wird oder eine
     achte Zusicherung in `scripts/verify-mining.mjs` (das bereits einen Kennungs-Check
     hat, aber nur fuer Mining-Daten).
   - Empfehlung: eigenstaendiges Skript, weil es SITE-WEIT ueber Bereichsgrenzen hinweg
     prueft (Mission, Crafting, Items, Refinery) — passt nicht sauber unter `verify:mining`s
     Zustaendigkeit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Data.p4k (lokal) | `datamine:missions`, `build-universal-db.mjs`, `datamine:crafting` | Ja — in DIESER Sitzung selbst verifiziert (`F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k`, CL 12344265) | 4.9.0-live.12344265 | — |
| `build_manifest.id` (lokal) | Patch-Kennung ermitteln (D-04) | Ja — selbst gelesen, `sc-alpha-4.9.0 12344265` | — | — |
| Node.js (`scripts/lib/*.mjs` sind ESM) | alle Datamine-/Verify-Skripte | Ja (Projekt laeuft bereits auf Node) | siehe `package.json#engines`, nicht separat geprueft | — |
| CI-Umgebung (fuer das neue Schiene-A-Tor) | D-04-Verzugstor, Kreuzvergleich-Teil | Kein p4k/Netz in CI (bekannte, dokumentierte Randbedingung des Projekts) | — | Kreuzvergleich-Teil braucht KEIN p4k (liest nur committete JSONs) — deshalb bewusst als Schiene A statt Schiene B entworfen |

**Missing dependencies with no fallback:** keine.

**Missing dependencies with fallback:** keine — alle fuer diese Phase noetigen lokalen
Ressourcen sind in dieser Sitzung nachweislich vorhanden.

## Security Domain

`security_enforcement` ist in `.planning/config.json` aktiv (ASVS Level 1, `security_block_on:
high`). Diese Phase fuegt jedoch **keine neue Eingabeflaeche** hinzu:

- Der Ortsfilter nutzt denselben client-seitigen `<select>`+`data-*`-Mechanismus, der fuer
  Typ/Auftraggeber/Fraktion/Gilde bereits existiert (kein neuer Eingabe-Pfad, keine neue
  Serveranfrage).
- Die neuen sichtbaren Texte sind Ortsnamen (Hurston, Crusader, ...) und Slot-Bezeichnungen
  (Abholort, Lieferort, ...) — statische, aus dem Spiel gewonnene Werte, kein
  nutzergenerierter Inhalt.
- Das neue D-04-Tor liest ausschliesslich lokale/committete Dateien, keine Netzwerkeingabe.

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | Nein | Keine Konto-/Anmeldeflaeche beruehrt |
| V3 Session Management | Nein | — |
| V4 Access Control | Nein | — |
| V5 Input Validation | Grenzwertig, nur mittelbar | Die neuen Ortsnamen/Slot-Labels landen ueber `set:html`-freie Astro-Interpolation (`{...}` in JSX-aehnlichem Markup) im DOM — Astro escaped automatisch; **kein** `set:html` fuer diese neuen Felder verwenden (im Unterschied zu `S.srcSys`/`S.srcBp` in `MissionsApp.astro`, die bewusst `set:html` fuer eigene, im Code stehende Strings nutzen — die neuen Ortsnamen kommen aus Spieldaten, nicht aus Code, und sollten deshalb NIE ueber `set:html` laufen) |
| V6 Cryptography | Nein | — |

### Known Threat Patterns for diesen Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Spieldaten enthalten unerwartetes HTML/Markup, das ueber `set:html` in die Seite gelangt | Tampering (der Spieldaten-Quelle, theoretisch) | Ortsnamen und Slot-Labels immer ueber normale Astro-Interpolation (`{value}`) ausgeben, nie ueber `set:html` — Astro escaped automatisch. Bestehende `set:html`-Stellen in `MissionsApp.astro` betreffen nur fest im Code stehende `S.*`-Strings, nicht die neuen datengetriebenen Felder |

## Sources

### Primary (HIGH confidence — in dieser Sitzung selbst gegen die installierte 4.9.0 nachgemessen)

- `Data.p4k` (lokal, CL 12344265) via `scripts/lib/datacore.mjs`/`scripts/lib/p4k.mjs` —
  `MissionBrokerEntry.localityAvailable` (407/2584), `.locationMissionAvailable` (1836/2584,
  24 distinkte Werte, vollstaendig aufgelistet), Ueberschneidung beider Felder (5 von 2584)
- `build_manifest.id` (lokal) — `sc-alpha-4.9.0 12344265`, bestaetigt die ROADMAP-Kennung
- `scripts/datamine-missions.mjs` (Projektquelle, vollstaendig gelesen)
- `scripts/datamine-locations.mjs`, `scripts/datamine-stanton-anchors.mjs` (Projektquelle,
  Vorlage fuer die kuratierte Namenstabelle)
- `scripts/build-universal-db.mjs`, `scripts/build-refinery-data.mjs`,
  `scripts/datamine-crafting.mjs` (Projektquelle, D-04-Erzeuger)
- `scripts/verify-mining.mjs`, `scripts/lib/gate-registry.mjs` (Projektquelle, Tor-Muster)
- `src/lib/missions.ts`, `src/components/MissionsApp.astro`,
  `src/components/MissionDetail.astro`, `assets/missions-app.js` (Projektquelle, Oberflaeche)
- `assets/refinery-data.json`, `assets/dismantling-items.json`, `assets/wikelo-trades.json`,
  `assets/universal-items.json` (Projektquelle, tatsaechlicher Inhalt gegen die
  ROADMAP-Behauptung gegengeprueft — `refinery-data.json` hat bereits `meta.gameVersion`)

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` § Phase 18 (Messsitzung 23.08.2026) — als Grundlage genommen und in
  dieser Sitzung an den kritischen Zahlen (D-01, D-02) exakt bestaetigt
- `.planning/STATE.md` § Roadmap Evolution, Eintrag „Phase 18 added" — deckungsgleich mit
  ROADMAP.md, keine zusaetzliche Information

### Tertiary (LOW confidence)

- Keine — diese Recherche stuetzt sich ausschliesslich auf Projektquellen und eine
  eigene Messung gegen die installierte Spielversion, keine externen Web-Quellen noetig.

## Metadata

**Confidence breakdown:**

- D-01/D-02 (Ortskante, Ortsnamen): HIGH — vollstaendig gegen die installierte 4.9.0
  nachgemessen (2584 Broker-Eintraege durchlaufen, alle 24 distinkten Ortswerte aufgelistet)
- D-03 (Slot-Art): HIGH fuer den Befund (Code gelesen, `t.split('|').pop()` bestaetigt),
  MEDIUM fuer die genaue Umsetzungsempfehlung (nicht gegen alle 416 Slot-Arten durchgezaehlt)
- D-04 (Patch-Kennung): HIGH fuer drei der vier Dateien (Inhalt direkt gelesen, inkl. der
  Korrektur zu `refinery-data.json`), MEDIUM fuer die empfohlene Loesung bei
  `wikelo-trades.json`/`dismantling-items.json` (mehrere gangbare Wege, Entscheidung gehoert
  in die Planung)
- Oberflaeche (kein neues Filterfeld noetig): HIGH — `MissionsApp.astro` und
  `assets/missions-app.js` vollstaendig gelesen, `#mx-loc` existiert nachweislich bereits

**Research date:** 2026-08-23
**Valid until:** Bis zum naechsten Star-Citizen-Patch (Missionsdaten sind CL-gebunden) oder
30 Tage, je nachdem was frueher eintritt — der Ist-Stand der vier D-04-Dateien kann sich durch
parallele Sitzungen aendern (siehe bekanntes Projektrisiko „Phasennummern/Parallelarbeit").
