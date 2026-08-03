# Phase 5: Komponenten-Filter für Schiffe - Research

**Researched:** 2026-08-03
**Domain:** CryXmlB-Extraktion aus Data.p4k (Star Citizen Game-Dateien), Node-nativer Parser, statischer Astro-Filter
**Confidence:** HIGH — jede Zahl in diesem Dokument stammt aus tatsächlich ausgeführten Probe-Skripten gegen das lokale
Data.p4k (`F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k`), nicht aus Vermutung. Wo eine Aussage Spielwissen statt
Messung ist, ist sie explizit als `[ASSUMED]` markiert.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Gefiltert wird nach der **Steckplatz-Größe** (`ItemPort.maxSize`), nicht nach der Größe des ab Werk
  verbauten Bauteils. `src/data/ship-loadouts.json` (Stock-Loadout) ist **nicht** die Quelle. Reversibility: costly.
- **D-02:** Quelle ist `Scripts/Entities/Vehicles/Implementations/Xml/<SCHIFF>.xml` im Data.p4k, CryXmlB-kodiert.
  Je `<Part>` hängt ein `<ItemPort>` mit `minSize`/`maxSize` und einer `Types`-Liste.
- **D-03:** Der Join Schiff → XML läuft über den **Dateiverweis im DataCore-Schiffsrecord**, nicht über
  zusammengesetzte Dateinamen.
- **D-04:** Trefferregel „einer reicht": ein Schiff erscheint, sobald **mindestens ein** Steckplatz dieser Art
  `maxSize >= X` hat.
- **D-05:** Kategorien: **Waffe, Turm, Rakete, Schild, Kühler, Kraftwerk, Quantenantrieb, Radar**. Gegenmaßnahmen
  ausdrücklich ausgeschlossen.
- **D-06:** „Turm" meint nur Steckplätze, die im Spiel tatsächlich Turmpositionen sind — Trennregel muss an
  Stichproben belegt werden. Alles, was kein echter Turm ist, zählt als „Waffe". Reversibility: costly.
- **D-07:** Nur filtern, nicht anzeigen — weder Karte noch Datenblatt zeigen Steckplatz-Größen.
- **D-08:** Fahrzeuge ohne Steckplatz-Daten fallen bei aktivem Filter aus der Trefferliste, der Ergebniszähler
  nennt sie ausdrücklich.
- **D-09:** Zwei Auswahlfelder — „Komponente" und Mindestgröße, nicht acht Einzelfelder.
- **D-10:** Das Größenfeld zeigt nur Größen, die es bei der gewählten Bauteilart wirklich gibt.
- **D-11:** Bauteilart ohne Größe filtert noch nicht — beide Felder müssen gesetzt sein.
- **D-12:** Der neue Filter arbeitet mit den bestehenden Feldern zusammen; der Ergebniszähler bleibt korrekt.

### Claude's Discretion

- Format und Dateiname des erzeugten JSON, Zuschnitt des CryXmlB-Lesers (`scripts/lib/`), Abbildung der
  `Types`-Werte auf die acht Kategorien, Aufbau der `data-*`-Attribute und des Inline-JS.
- Der Datamine-Lauf ist lokal, nicht CI: Data.p4k liegt nur auf dem Entwicklungsrechner (~147 GB). Das
  Ergebnis-JSON wird eingecheckt, wie bei den übrigen `datamine-*`-Ausgaben.

### Deferred Ideas (OUT OF SCOPE)

- Steckplatz-Größen sichtbar machen (eigene Folge-Phase, D-07 schließt es hier aus).
- Gegenmaßnahmen als Kategorie.
- Zahl der Steckplätze als Filterkriterium (Erweiterung von D-04).
- Entdopplung der beiden `schiffe.astro`-Fassungen (Class-A-Befund, Phase 4 behandelt den Nachweis, nicht diese Phase).

</user_constraints>

<phase_requirements>
## Phase Requirements

Dieser Meilenstein führt Requirement-IDs über `.planning/REQUIREMENTS.md` (v1/v2 „UI-/Design-Feinschliff"); Phase 5
ist ein eigenständig eingefügter Zweig ohne zugeordnete REQ-IDs (siehe STATE.md „Roadmap Evolution": *Phase 5 added
… hängt an keiner Vorgängerphase*). Die bindenden Anforderungen sind stattdessen die Entscheidungen D-01–D-12 aus
CONTEXT.md (oben). Es gibt keine tabellarische REQ→Research-Zuordnung nachzutragen.

</phase_requirements>

## Project Constraints (from CLAUDE.md)

Kein `./CLAUDE.md` bzw. `./.claude/CLAUDE.md` mit zusätzlichen, über `.planning/codebase/CONVENTIONS.md`
hinausgehenden Direktiven gefunden (Pfad `.claude/CLAUDE.md` ist in `.planning/config.json` als
`claude_md_path` hinterlegt, existiert im Worktree aber nicht als eigenständige Datei mit Zusatzregeln —
die verbindlichen Hausregeln sind die in `CONVENTIONS.md` dokumentierten, siehe unten).

## Summary

Der Spike vom 03.08.2026 hatte den CryXmlB-Header und den Join-Mechanismus (DataCore-Record → XML-Dateiverweis)
bereits entziffert. Diese Recherche hat den kompletten Lauf über alle 227 Katalog-Schiffe tatsächlich ausgeführt
und dabei **zwei Fehler im ursprünglichen Spike-Code gefunden und korrigiert**, die die Coverage von 0 auf 223/227
gehoben haben:

1. p4k-Eintragsnamen tragen Backslashes **und** ein `Data\`-Präfix (`Data\Scripts\Entities\Vehicles\...`), während
   `record.fileName` aus dem DataCore bereits Forward-Slash **ohne** `Data/`-Präfix liefert. Ein naiver Match
   zwischen beiden schlägt komplett fehl (0 Treffer), obwohl beide Seiten „richtig" aussehen.
2. Die Attribut-**Schlüssel** `minSize`/`maxSize` sind — zusätzlich zu den bereits bekannten uneinheitlichen
   Portnamen — selbst uneinheitlich groß-/kleingeschrieben (`minSize`/`maxSize` vs. `minsize`/`maxsize` je nach
   Schiff). Und der Portname sitzt nicht auf `<ItemPort>` selbst, sondern auf dem **Eltern**-Knoten `<Part name="...">`.

Mit beiden Korrekturen lösen sich **223 von 227** Katalog-Schiffen komplett auf (98,2 %). Die 4 Ausreißer sind alle
ATLS-Exoskelett-Varianten (Mining-Powerarmor), die DataCore-seitig als `Actor`-Klasse unter
`libs/foundry/records/actor/actors/*.xml` geführt werden — außerhalb des Pfadmusters, das der bestehende
Ship-Record-Filter (`isVariantJunk` + `/(spaceships|groundvehicles)/`) erkennt.

Für die Turm/Waffe-Trennung (D-06) hat sich eine belegbare Regel gefunden: echte Turmpositionen tragen den
Type-Wert `TurretBase` (bei Bodenfahrzeug-Modulanbauten kombiniert mit `Container` — dann KEIN Turm), ferngesteuerte
Türme sind zusätzlich über den Portnamen (`*remote*`, ohne `tractor`) erkennbar. Die Regel trifft **192/223 (86,1 %)
exakt auf die Turmzahl** aus `vehicles.json` und **211/223 (94,6 %)** auf die binäre Frage „hat dieses Schiff
überhaupt Türme". Bei Kapitalschiffen mit PDC-Batterien (Polaris, Idris, Javelin, Reclaimer, Perseus) versagt die
Zahl systematisch — die PDC-Stationen tauchen in der Implementierungs-XML gar nicht als eigene `ItemPort`-Knoten auf.

**Primäre Empfehlung:** Das erzeugte JSON speichert **nicht** die volle Portliste, sondern pro Schiff nur die
**maximale Steckplatzgröße je Kategorie** (8 Zahlen statt hunderter Ports) — das ist exakt die Information, die
D-04s „einer reicht"-Regel braucht, und reduziert die Dateigröße von ca. 1 MB auf 12,8 KB (gemessen). Ein einziges
kompaktes `data-comp`-Attribut pro Karte (z. B. `w4t6m10s3c3p3q2r2`) statt acht Einzelattribute.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CryXmlB-Extraktion aus Data.p4k | Build-Zeit-Skript (Node, lokal) | — | Data.p4k ist ~147 GB, nur auf dem Entwicklungsrechner vorhanden; kann nie zur Laufzeit oder in CI laufen |
| Kategorie-Zuordnung (Types → 8 Kategorien) | Build-Zeit-Skript | — | Ist eine reine Datentransformation, kein Laufzeitzustand |
| Speicherung der Ergebnisse | Statisches JSON (`src/data/*.json`, eingecheckt) | — | Deckt sich mit jedem anderen `datamine-*`-Output im Repo |
| Filter-UI (zwei `<select>`, Größen-Optionen je Kategorie) | Browser / Client | — | Reines DOM-Verhalten, kein Server im Spiel (statisches Astro-Build) |
| Filterlogik (`apply()`, D-04/D-08/D-11-Regeln) | Browser / Client | — | Bereits bestehendes Muster: `data-*`-Attribute + `<script is:inline>`-IIFE, kein Modul, kein Build-Schritt |
| Ergebniszähler inkl. „ohne Steckplatz-Daten" | Browser / Client | — | Muss dieselbe Kartenliste lesen wie `apply()`, keine zweite Quelle |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `scripts/lib/p4k.mjs` (repo-eigen) | — | Öffnet Data.p4k, liest Central Directory, entpackt zstd/AES-Einträge | Bereits verifiziert und in `datamine-ship-loadouts.mjs` produktiv im Einsatz; kein Grund für eine zweite Implementierung |
| `scripts/lib/datacore.mjs` (repo-eigen) | v8-Format | Parst `Data/Game2.dcb`, liefert Records + `readRecord()` | Gleiches Argument — bestehende, verifizierte Eigenentwicklung |
| **NEU:** `scripts/lib/cryxml.mjs` (vorzuschlagen) | — | CryXmlB-Binärformat (`ItemPort`/`Part`/`Types`) in ein Node-Objektbaum lesen | Noch nicht im Repo vorhanden; diese Recherche liefert eine geprüfte Referenzimplementierung (siehe Code Examples) |

Keine neuen npm-Abhängigkeiten nötig — alles läuft mit Node-Bordmitteln (`node:zlib` zstd, `node:crypto` AES),
identisch zum bestehenden `p4k.mjs`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` bzw. `node:fs` | Node 22 (installiert, siehe Environment Availability) | JSON-Ausgabe schreiben | Wie in jedem anderen `datamine-*`-Skript |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Eigener CryXmlB-Parser | unp4k / StarFab (externe .NET-Tools) | Wurde für `p4k.mjs`/`datacore.mjs` bereits bewusst verworfen (siehe deren Kopfkommentare) — externe Tools müssten bei jedem Patch neu besorgt werden. Derselbe Grund gilt hier. |
| Max-Größe-je-Kategorie (empfohlen) | Volle Portliste im JSON | Volle Liste ist ~80× größer (1045 KB vs. 12,8 KB, gemessen) und liefert keine zusätzliche Filter-Fähigkeit, da D-04 nur den Maximalwert je Kategorie braucht |

**Installation:** keine — reine Wiederverwendung vorhandener Repo-Module, keine `npm install`-Zeile nötig.

**Version verification:** entfällt (keine externen Pakete).

## Package Legitimacy Audit

**N/A — diese Phase installiert keine externen Pakete.** Sie nutzt ausschließlich bereits im Repo vorhandene,
verifizierte Eigenentwicklungen (`scripts/lib/p4k.mjs`, `scripts/lib/datacore.mjs`) und fügt eine neue,
NICHT-externe Bibliotheksdatei (`scripts/lib/cryxml.mjs`, repo-eigener Code, keine Registry-Abhängigkeit) hinzu.
Der Package-Legitimacy-Gate-Prozess ist damit nicht anwendbar; es gibt keine `npm view`/`pip index`-Prüfung
durchzuführen.

## Architecture Patterns

### System Architecture Diagram

```
Data.p4k (lokal, ~147 GB, NUR Entwicklungsrechner)
   |
   |  scripts/lib/p4k.mjs: openP4k() -> Central Directory -> read(/Data\/Game2\.dcb/)
   v
Game2.dcb (DataCore-Blob)
   |
   |  scripts/lib/datacore.mjs: openDataCore() -> records[]
   v
Ship-Records (EntityClassDefinition, Pfadmuster /spaceships/|/groundvehicles/, isVariantJunk-Filter)
   |
   |  db.readRecord(rec, {maxDepth:40, typed:true}) -> Baum durchlaufen
   |  -> ersten String finden, der auf .../Implementations/Xml/*.xml passt   [D-03]
   v
XML-Dateiverweis (z.B. "Scripts/Entities/Vehicles/Implementations/Xml/AEGS_Gladius.xml")
   |
   |  p4k.entries(/Implementations\\Xml\\.+\.xml$/i) EINMAL indiziert,
   |  Normalisierung (Data\-Präfix weg, Backslash->Slash, lowercase) für den Join
   v
p4k-Eintrag -> p4k.extract() -> CryXmlB-Rohbytes
   |
   |  scripts/lib/cryxml.mjs: parseCryXml() -> Node-Baum (Tag/Attrs/Children)
   |  Attribut-Keys lowercased indiziert (minSize/minsize-Uneinheitlichkeit)
   v
<Part name="..."> -> Kind <ItemPort minSize maxSize> -> Kind <Types><Type type="..."/></Types>
   |
   |  je Kategorie: max(maxSize) über alle Ports, deren Types-Liste die Kategorie erfüllt
   |  (Turm-Regel: TurretBase ohne Container, ODER Turret+remote-Portname ohne WeaponGun/tractor)
   v
src/data/ship-components.json  { ships: { "<id>": {w,t,m,s,c,p,q,r} }, missing: [...] }
   |
   |  Build-Zeit: src/pages/schiffe.astro liest die Datei, joint per Schiff-id,
   |  schreibt EIN data-comp="w4t6m10s3c3p3q2r2"-Attribut pro <article class="fcard">
   v
Browser: <script is:inline> apply() liest data-comp, wertet D-04/D-08/D-11 aus, schreibt Zähler
```

### Recommended Project Structure

```
scripts/
├── lib/
│   ├── p4k.mjs                    # unverändert, bereits vorhanden
│   ├── datacore.mjs                # unverändert, bereits vorhanden
│   └── cryxml.mjs                  # NEU — CryXmlB-Parser, isoliert wie die beiden anderen lib-Module
└── datamine-ship-components.mjs    # NEU — analog zu datamine-ship-loadouts.mjs
src/data/
└── ship-components.json            # NEU — generiert + eingecheckt
```

### Pattern 1: Portname sitzt auf dem Eltern-Knoten, nicht auf `<ItemPort>`

**What:** `<Part name="hardpoint_shield_generator" class="ItemPort">` trägt den technischen Namen; das
darunterliegende `<ItemPort minSize="1" maxSize="1" .../>` trägt nur Größe/Types/Flags — kein eigenes `name`-Attribut.

**When to use:** Immer beim Extrahieren von Portnamen aus der Implementierungs-XML.

**Example:**
```js
// Quelle: diese Recherche, verifiziert gegen ORIG_100i.xml und RSI_Polaris.xml
for (const part of nodes) {
  if (part.tag !== 'Part') continue;
  const ip = part.children.find((c) => c.tag === 'ItemPort');
  if (!ip || ip.attrs.maxsize == null || ip.attrs.maxsize === '') continue;
  const typesNode = ip.children.find((c) => c.tag === 'Types');
  const types = typesNode
    ? typesNode.children.filter((c) => c.tag === 'Type').map((c) => c.attrs.type).filter(Boolean)
    : [];
  // Portname kommt von PART, nicht von ItemPort:
  const portName = part.attrs.name || '';
}
```

### Pattern 2: p4k-Eintragsnamen normalisieren, bevor sie gegen DataCore-Dateiverweise verglichen werden

**What:** p4k-Zip-Eintragsnamen sind `Data\Scripts\Entities\Vehicles\Implementations\Xml\AEGS_Gladius.xml`
(Backslash, `Data\`-Präfix). `record.fileName` liefert bereits `Scripts/Entities/Vehicles/Implementations/Xml/...`
(Forward-Slash, kein Präfix). Beide Seiten müssen normalisiert werden.

**Example:**
```js
// Quelle: diese Recherche
const norm = (s) => (s || '').replace(/\\/g, '/');
const stripDataPrefix = (s) => norm(s).replace(/^data\//i, '');
const implEntries = p4k.entries(/Implementations\\Xml\\.+\.xml$/i); // Backslash-Muster fuer p4k.entries()!
const implByLowerName = new Map();
for (const e of implEntries) implByLowerName.set(stripDataPrefix(e.name).toLowerCase(), e);
// Lookup:
const entry = implByLowerName.get(stripDataPrefix(xmlRefFromRecord).toLowerCase());
```

### Anti-Patterns to Avoid

- **Attribut-Keys case-sensitiv lesen:** `n.attrs.maxSize` findet nur die Hälfte der Ports; manche Schiffe
  schreiben `minsize`/`maxsize` klein. Immer `key.toLowerCase()` beim Indizieren der Attribute.
- **Regex mit Forward-Slash gegen `p4k.entries()`:** p4k-Rohnamen sind Backslash-getrennt; ein Forward-Slash-Muster
  liefert 0 Treffer, OHNE Fehler zu werfen — das sieht wie „keine Daten vorhanden" aus, ist aber ein Matching-Bug
  (in dieser Recherche live reproduziert: Coverage sprang von 0/227 auf 223/227 nach der Korrektur).
- **`Type`-Wert `"Turret"` mit „Turm" gleichsetzen:** ist die häufigste Falle in dieser Phase — siehe Abschnitt
  „Die Turm-Regel" unten. `Turret` alleine (ohne `TurretBase`) ist bei ~68 % der betroffenen Ports eine feste
  Waffe, keine Turmposition.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| p4k-Zugriff | Eigener Zip64/zstd-Reader | `scripts/lib/p4k.mjs` | Bereits verifiziert, in Produktion (`datamine-ship-loadouts.mjs`) |
| DataCore-Parsing | Eigener Game2.dcb-Reader | `scripts/lib/datacore.mjs` | Bereits verifiziert, v8-Format vollständig dokumentiert |
| Schiff-Auswahl + Varianten-Filter | Eigene Heuristik | `isVariantJunk`-Regex + Pfadmuster + `recId()` aus `datamine-ship-loadouts.mjs` | Wortwörtlich kopierbar, in Q1 gegen alle 227 Katalog-Einträge erneut verifiziert |
| Größen-Optionen je Kategorie im UI | Serverseitige Logik | Client-JS liest die 8 gespeicherten Max-Werte und baut die `<option>`-Liste dynamisch beim `change`-Event des Komponentenfelds | Passt zum bestehenden ES5-IIFE-Muster, kein Build-Schritt nötig |

**Key insight:** Der einzige wirklich neue Baustein dieser Phase ist der CryXmlB-Parser. Alles andere (p4k öffnen,
DataCore lesen, Schiff-IDs bilden, JSON nach `src/data/` schreiben, Filter-Mechanik in `.astro`) hat ein
funktionierendes Vorbild im Repo, das direkt kopiert werden kann.

## Turret- und Kategorie-Regeln (D-06) — der Abschnitt, auf den die Planung sich am stärksten stützt

### Types-Vokabular (alle 82 rohen Werte, gemessen über 223 aufgelöste Schiffe)

| Type (roh) | Ports | Schiffe | Disposition |
|---|---:|---:|---|
| ManneuverThruster | 3142 | 196 | verworfen — Triebwerk, keine der 8 Kategorien |
| MainThruster | 714 | 196 | verworfen — Triebwerk |
| Turret | 679 | 194 | **gemischt** — siehe Turm-Regel unten; NICHT automatisch „Turm" |
| Seat | 670 | 222 | verworfen — Sitz |
| SeatAccess | 668 | 222 | verworfen — Sitz-Zugang |
| Door | 527 | 160 | verworfen — Tür |
| **WeaponGun** | 500 | 164 | → **Waffe** (auch wenn zusätzlich `Turret` getaggt, siehe Turm-Regel) |
| **MissileLauncher** | 494 | 142 | → **Rakete** |
| WeaponDefensive | 494 | 195 | **explizit ausgeschlossen (D-05)** — Gegenmaßnahmen (Chaff/Flare) |
| Room | 465 | 158 | verworfen — Innenraum-Marker |
| FuelIntake | 403 | 208 | verworfen — Treibstoff |
| **Cooler** | 392 | 218 | → **Kühler** |
| **Shield** | 391 | 204 | → **Schild** |
| WeaponController | 363 | 220 | verworfen — Logik-Controller, kein Bauteil-Slot |
| FuelTank | 352 | 212 | verworfen — Treibstoff |
| WeaponRegenPool | 346 | 187 | verworfen — Logik (Energie-Pool für Waffen) |
| SeatDashboard | 318 | 168 | verworfen — Sitz-Zubehör |
| Usable | 307 | 102 | verworfen — generisches Interagierbar-Flag |
| **PowerPlant** | 298 | 216 | → **Kraftwerk** |
| CargoGrid | 267 | 67 | verworfen — Fracht |
| Flair_Cockpit | 250 | 158 | verworfen — Deko |
| **Radar** | 238 | 220 | → **Radar** |
| Misc | 237 | 72 | verworfen — Sammelkategorie ohne Bedeutung |
| SelfDestruct | 230 | 221 | verworfen |
| LightController | 225 | 221 | verworfen — Logik-Controller |
| CoolerController | 222 | 222 | verworfen — Logik-Controller (NICHT der Kühler selbst) |
| EnergyController | 222 | 222 | verworfen — Logik-Controller |
| CommsController | 221 | 221 | verworfen |
| CapacitorAssignmentController | 220 | 220 | verworfen |
| DoorController | 219 | 219 | verworfen |
| Armor | 217 | 217 | verworfen — Panzerungs-Slot, nicht angefragt |
| Paints | 215 | 215 | verworfen — Lackierung |
| ShieldController | 215 | 215 | verworfen — Logik-Controller (NICHT der Schild selbst) |
| LandingSystem | 209 | 207 | verworfen |
| FlightController | 207 | 207 | verworfen |
| MissileController | 182 | 174 | verworfen — Logik-Controller |
| QuantumFuelTank | 177 | 175 | verworfen — Treibstoff (NICHT der Antrieb selbst) |
| **QuantumDrive** | 175 | 172 | → **Quantenantrieb** |
| Ping | 169 | 161 | verworfen — Scan-Funktion, bewusst getrennt von „Radar" |
| Scanner | 167 | 156 | verworfen — Scan-Kopf (Mining/Salvage), bewusst getrennt von „Radar" |
| Avionics | 161 | 114 | verworfen — Avionik-Slot, bewusst getrennt von „Radar" |
| **TurretBase** | 129 | 53 | → **Turm** (außer kombiniert mit `Container`, siehe Regel) |
| Cargo | 124 | 57 | verworfen — Fracht |
| AttachedPart | 101 | 17 | verworfen — generischer Anbau |
| **BombLauncher** | 100 | 42 | → **Rakete** (Bomben/Torpedos werden wie im bestehenden `itemCat()` aus `datamine-ship-loadouts.mjs` mit Raketen zusammengefasst) |
| Battery | 77 | 56 | verworfen — Batterie, NICHT das Kraftwerk |
| Display | 72 | 50 | verworfen |
| Transponder | 61 | 61 | verworfen |
| DockingCollar | 58 | 39 | verworfen |
| LifeSupportGenerator | 57 | 57 | verworfen |
| SalvageController | 51 | 38 | verworfen |
| GravityGenerator | 46 | 40 | verworfen |
| DockingAnimator | 41 | 30 | verworfen |
| MultiLight | 35 | 34 | verworfen |
| Container | 30 | 19 | verworfen — Fracht/Modul-Anbau; relevant als Ausschluss-Signal für die Turm-Regel |
| WheeledController | 27 | 27 | verworfen |
| Module | 25 | 18 | verworfen — generischer Modul-Slot |
| ToolArm | 21 | 19 | verworfen |
| Flair_Surface | 20 | 4 | verworfen — Deko |
| ControlPanel | 19 | 10 | verworfen |
| QuantumInterdictionGenerator | 17 | 17 | verworfen — Interdiktion, nicht der Antrieb |
| AirTrafficController | 16 | 16 | verworfen |
| EMP | 15 | 14 | verworfen |
| Relay | 13 | 10 | verworfen |
| MiningController | 11 | 8 | verworfen |
| TargetSelector | 8 | 3 | verworfen |
| SalvageFillerStation | 8 | 5 | verworfen |
| UtilityTurret | 8 | 4 | verworfen — Tractor-/Salvage-Arm-Mount, KEIN Waffenturm |
| Light | 6 | 6 | verworfen |
| MISC | 4 | 4 | verworfen (Großschreib-Variante von `Misc`) |
| Computer | 3 | 3 | verworfen |
| FuelController | 3 | 3 | verworfen |
| WeaponMount | 2 | 1 | verworfen — einmalig, keine erkennbare eigene Semantik |
| Crafter | 2 | 2 | verworfen |
| ExternalFuelTank | 2 | 1 | verworfen |
| LifeSupportSystem | 2 | 2 | verworfen |
| SalvageFieldSupporter | 2 | 1 | verworfen |
| Useable | 1 | 1 | verworfen (Schreibvariante von `Usable`) |
| TractorBeam | 1 | 1 | verworfen |
| Powerplant - Power | 1 | 1 | verworfen — Einzelfall `drak-mule` (`hardpoint_batteries`, max=1); sieht wie ein Datenartefakt/Batterie-Port aus, NICHT wie ein echtes Kraftwerk. Bewusst NICHT als Kraftwerk-Alias behandelt, `[ASSUMED]` da Spielwissen fehlt, ob dieser Slot je ein echtes Kraftwerk aufnehmen kann. |
| Interior | 1 | 1 | verworfen |
| SalvageFieldEmitter | 1 | 1 | verworfen |

**Multi-Type-Kombinationen** (ein Port kann mehreren Types angehören; die Kombination entscheidet die Kategorie,
sie wird nie ignoriert):

| Kombination | Anzahl Ports | Bedeutung |
|---|---:|---|
| `Turret+WeaponGun` | 446 | feste Waffe, gimbal-/turmfähig — zählt als **Waffe**, NICHT als Turm |
| `BombLauncher+MissileLauncher` | 92 | Torpedo-/Bombenbucht — zählt als **Rakete** |
| `MissileLauncher+WeaponGun` | 21 | seltene Kombi-Halterung — zählt als **Rakete** (MissileLauncher sticht) |
| `Turret+Turret` | 9 | Duplikat-Tag (Datenartefakt, z. B. `anvl-hornet-f7a-mk1` „hardpoint_class_4_nose"), ändert nichts an der Auswertung |
| `BombLauncher+WeaponGun` | 8 | zählt als **Rakete** |
| `Module+Turret` | 8 | Turret-getaggter Modul-Slot, kein WeaponGun — durch Turm-Regel korrekt NICHT als Turm erfasst (kein `TurretBase`, kein `remote`-Portname) |
| `Container+TurretBase` | 6 | **Bodenfahrzeug-Modulanbau** (z. B. `tmbl-cyclone` „hardpoint_module_attach"), KEIN Turm — deshalb der `Container`-Ausschluss in der Regel |
| übrige Kombinationen (≤5×) | — | einzeln geprüft, keine ändert die Kategorie-Zuordnung |

### Die Turm-Regel (D-06)

**Befund:** Der rohe Type-Wert `Turret` bedeutet NICHT „Turmposition". Er kennzeichnet lediglich, dass ein Waffenport
gimbal-/turmartig ausgerichtet werden kann — das gilt genauso für feste Flügelkanonen (`hardpoint_gun_left_wing`
beim Gladius, `hardpoint_weapon_gun_right` beim 100i). Der Type-Wert, der eine **echte, bemannte oder
ferngesteuerte Turmposition** kennzeichnet, ist `TurretBase` — das ist der Mount-Sockel selbst, getrennt vom
`Turret`-Tag auf dem Waffenport darüber.

**Regel (empfohlen, an 223 Schiffen validiert):**

```
Turm  = ItemPort, dessen Types  TurretBase enthält UND NICHT Container enthält
        ODER
        ItemPort, dessen Types  Turret enthält, NICHT WeaponGun,
        UND dessen Portname /remote/i entspricht UND NICHT /tractor/i entspricht

Waffe = ItemPort, dessen Types  WeaponGun enthält (unabhängig davon, ob zusätzlich Turret getaggt ist)
```

Der `Container`-Ausschluss existiert, weil Bodenfahrzeug-Modulanbaupunkte (`tmbl-cyclone` u. a.) mit
`TurretBase+Container` getaggt sind, aber echte generische Anbauslots sind, keine Waffentürme — ohne diesen
Ausschluss hätten alle vier Cyclone-Varianten fälschlich „1 Turm" bekommen (in `vehicles.json` stehen 0 Türme).
Der `remote`/`tractor`-Zusatz für ferngesteuerte Türme existiert, weil diese (z. B. Carrack, Redeemer, Polaris)
NICHT mit `TurretBase` getaggt sind, sondern nur mit `Turret` — aber im Portnamen konsequent `remote` tragen
(`hardpoint_turret_remote_turret`, `hardpoint_turret_remote_front`); die Ausnahme `tractor` verhindert, dass
Tractor-Beam-Mounts mit „remote" im Namen (z. B. `hardpoint_remote_turret_interior_tractor` beim Polaris)
fälschlich mitgezählt werden.

### Validierung gegen `vehicles.json` (`turrets[].stations`, unabhängige Drittquelle)

Stichprobe der 15 vom Auftrag genannten Schiffe (Hinweis: der korrekte Katalog-Id für „Mole" ist **`argo-mole`**,
nicht `arg-mole`):

| Schiff | Türme laut `vehicles.json` | Regel-Ergebnis | Treffer? |
|---|---:|---:|---|
| orig-100i | 0 | 0 | ✅ |
| aegs-gladius | 0 | 0 | ✅ |
| aegs-hammerhead | 6 | 6 | ✅ |
| rsi-constellation-andromeda | 2 | 2 | ✅ |
| drak-corsair | 2 | 2 | ✅ |
| misc-freelancer | 1 | 1 | ✅ |
| anvl-carrack | 4 | 4 | ✅ |
| rsi-polaris | 14 | 7 | ❌ (siehe unten) |
| aegs-redeemer | 4 | 4 | ✅ |
| drak-caterpillar | 2 | 2 | ✅ |
| cnou-mustang-alpha | 0 | 0 | ✅ |
| aegs-avenger-titan | 0 | 0 | ✅ |
| misc-prospector | 0 | 0 | ✅ |
| argo-mole | 0 | 0 | ✅ |
| banu-defender | 0 | 0 | ✅ |

**14/15 Treffer (93,3 %)** in der Stichprobe. Der einzige Fehltreffer, **RSI Polaris**, hat einen klar diagnostizierten
Grund: `vehicles.json` weist 7 PDC-Stationen (Punktverteidigung) zusätzlich zu 5 bemannten und 2 ferngesteuerten
Türmen aus — aber in `RSI_Polaris.xml` existiert **keinerlei** `ItemPort`, der auf eine PDC-Station hindeutet (die
volle Portliste wurde geprüft, siehe Rohdaten oben in der Recherche-Historie). Entweder sind PDC-Stationen in
diesem Build strukturell anders abgelegt (nicht als eigener `Part`/`ItemPort`), oder die Drittquelle
`vehicles.json` (aus der `star-citizen.wiki`-API, siehe `scripts/sync-vehicles.mjs`) führt hier veraltete/andere
Zahlen als die aktuelle LIVE-Buildversion. `[ASSUMED]` — ohne Blick ins Spiel selbst nicht abschließend zu klären.

**Vollflotten-Validierung** (alle 223 aufgelösten Schiffe gegen `vehicles.json`):

- **Exakte Turmzahl trifft bei 192/223 (86,1 %)**.
- Segmentiert nach Größe: bei Schiffen mit **≤6 Türmen laut Drittquelle** (213 von 223, praktisch alle
  Kampf-/Multicrew-Schiffe außer echten Kapitalschiffen) trifft die Zahl bei **191/213 (89,7 %)**.
  Bei den **10 größten Schiffen (>6 Türme, i. d. R. PDC-tragende Kapitalschiffe)** trifft sie nur bei **1/10 (10 %)**
  — hier ist die Diskrepanz systematisch (fehlende PDC-Ports in der XML), nicht ein Regelfehler.
- **Binäre Frage „hat das Schiff überhaupt mindestens einen Turm" trifft bei 211/223 (94,6 %)** — das ist die für
  D-04 eigentlich entscheidende Zahl, da der Filter nach „mindestens ein Port" fragt, nicht nach der genauen Anzahl.

**Verbleibende 14 Abweichungen (binär falsch):** überwiegend Einzelfälle mit `hardpoint_turret` (ohne Richtungssuffix,
ohne `remote`) als einzigem Turret-Port (`anvl-ballista`, `argo-mpuv-1t`, `grin-mdc`, `cnou-nomad`) — die Regel
erkennt sie nicht, weil weder `TurretBase` noch das `remote`-Namensmuster zutrifft; sowie ein Fall
(`rsi-scorpius-antares`) mit einem als `Turret,Turret` (doppelt getaggt) plus `remote` im Namen erfassten Port, den
die Regel als Turm zählt, `vehicles.json` aber mit 0 Türmen führt (evtl. ein neuerer Schiffstyp, dessen
Drittquellen-Daten noch nicht aktuell sind — `[ASSUMED]`).

**Empfehlung an die Planung:** Die Regel ist die beste an Stichproben belegte Trennung, die sich aus den
verfügbaren Daten herleiten lässt (86,1 % exakt, 94,6 % binär richtig). Kapitalschiff-PDC-Batterien sind ein
bekannter, dokumentierter Blinder Fleck (die Daten fehlen strukturell in der XML, keine Regel kann sie erfinden) —
D-08s „ohne Steckplatz-Daten"-Philosophie deckt genau diesen Fall ab: lieber ehrlich zu wenig Türme zählen, als
raten. Ein `checkpoint:human-verify` nach dem ersten Testlauf des Skripts, das die Turmzahlen der 15 Stichproben-Schiffe
gegen dieses Dokument gegenprüft, wird empfohlen, bevor das JSON breit committed wird.

## Coverage (Q1)

**223 von 227 Katalog-Schiffen (98,2 %)** lösen sich vollständig auf: DataCore-Record gefunden → XML-Dateiverweis
im Record gefunden → XML-Eintrag im p4k gefunden → mindestens 1 `ItemPort` mit `maxSize` extrahiert.

| Fehlerkategorie | Anzahl | Betroffene ids |
|---|---:|---|
| Kein DataCore-Record unter dem Ship-Pfadmuster | 4 | `argo-atls`, `argo-atls-geo`, `argo-atls-geo-collector-grad01`, `argo-atls-geo-collector-grad03` |
| Kein XML-Verweis im Record gefunden | 0 | — |
| XML-Verweis nicht im p4k gefunden | 0 | — |
| XML ohne sized `ItemPort` | 0 | — |

**Alle 4 Fehltreffer sind ATLS-Exoskelett-Varianten** (bemannte Bergbau-Powerarmor, kein klassisches Schiff/Bodenfahrzeug).
Ihr DataCore-Record existiert (`EntityClassDefinition.ARGO_ATLS`, `EntityClassDefinition.ARGO_ATLS_GEO`, …), aber
unter `libs/foundry/records/actor/actors/argo_atls.xml` — einer `Actor`-Klasse, nicht unter `.../spaceships/` oder
`.../groundvehicles/`. Der bestehende Ship-Record-Filter aus `datamine-ship-loadouts.mjs`
(`/\/(spaceships|groundvehicles)\/[^/]+\.xml$/i`), der per D-03/CONTEXT.md als Vorbild vorgegeben ist, erkennt sie
deshalb bauartbedingt nicht. Selbst wenn man den Filter erweitern würde: Powerarmor nutzt vermutlich ein anderes
Component-System (`SActorGear` o. ä.) statt der Schiffs-`Part`/`ItemPort`-Struktur — `[ASSUMED]`, nicht verifiziert,
da außerhalb des Recherche-Budgets. **Empfehlung: diese 4 als „ohne Steckplatz-Daten" (D-08) behandeln, keine
Sonderbehandlung bauen** — der Aufwand steht in keinem Verhältnis zu 4 von 227 Einträgen.

**Bodenfahrzeuge verhalten sich NICHT anders** als Raumschiffe: alle 27 Bodenfahrzeuge im Katalog (von 33
DataCore-seitig unter `/groundvehicles/` geführten Records) lösen sich exakt gleich auf, mit derselben
`Part`/`ItemPort`/`Types`-Struktur. Die einzige Ausnahme (ATLS) ist keine „Bodenfahrzeug"-Eigenheit, sondern die
oben beschriebene `Actor`-Klassifizierung.

## Größenverteilung je Kategorie (Q4)

Gemessen über alle 223 aufgelösten Schiffe, mit der Kategorie-Zuordnung aus dem Types-Vokabular oben:

| Kategorie | Schiffe mit ≥1 Port | Größen, die vorkommen (Schiffe je Größe) |
|---|---:|---|
| Waffe | 164 | S1:35 · S2:34 · S3:54 · S4:43 · S5:35 · S7:2 · S10:6 |
| Turm | 59 | S1:1 · S2:2 · S3:8 · S4:10 · S5:18 · S6:31 · S7:2 · S8:1 · S9:1 · S10:2 |
| Rakete | 145 | S1:14 · S2:35 · S3:33 · S4:52 · S5:30 · S6:4 · S7:3 · S8:2 · S9:1 · S10:7 |
| Schild | 204 | S0:21 · S1:97 · S2:48 · S3:34 · S4:5 |
| Kühler | 218 | S0:40 · S1:107 · S2:47 · S3:25 · S4:4 |
| Kraftwerk | 216 | S0:40 · S1:103 · S2:59 · S3:24 · S4:2 |
| Quantenantrieb | 172 | S1:99 · S2:53 · S3:18 · S4:2 |
| Radar | 220 | S0:35 · S1:116 · S2:61 · S3:13 · S4:2 |

**Offene Frage für D-10 (Größenfeld):** Bei Schild/Kühler/Kraftwerk/Radar kommt reproduzierbar **S0** vor (z. B.
`anvl-ballista`, `anvl-centurion`, `tmbl-cyclone`, `argo-csv-cargo` — alles Bodenfahrzeuge/kleine Fahrzeuge). Diese
Ports sind stellenweise als `$editable` markiert, teils als `invisible`. Ob „S0" ein sinnvoller Filterwert ist
(„mindestens Größe 0" matcht dann triv­ial jedes Schiff mit diesem Port) oder ob die UI bei 0 abschneiden sollte,
ist Spielwissen, das diese Recherche nicht abschließend klären kann — `[ASSUMED: S0 ist kein sinnvoller
Nutzerfilter]`. Empfehlung: Dropdown ab S1 beginnen lassen, S0-Ports zählen aber weiterhin korrekt für die
„hat Kategorie überhaupt"-Fallunterscheidung mit.

## Empfohlene Datenform, Größe und Laufzeit (Q5)

**Kernentscheidung:** D-04 fragt nur „gibt es mindestens einen Port dieser Kategorie mit `maxSize >= X`" — das ist
äquivalent zu „ist der **Maximalwert** dieser Kategorie bei diesem Schiff `>= X`". Die volle Portliste zu speichern
ist für den Filter **unnötig**; ein einziger Maximalwert je Kategorie reicht.

Gemessen an den echten Daten aus dem vollen Lauf:

| Form | Inhalt | Größe (gemessen) |
|---|---|---:|
| A — volle Portliste | `{ships: {id: [{n,x,t}, ...]}}` über alle 223 Schiffe | 1045,0 KB |
| **B — Max je Kategorie (empfohlen)** | `{ships: {id: {w,t,m,s,c,p,q,r}}}` | **12,8 KB** |

**Empfohlener Dateiname:** `src/data/ship-components.json` (folgt dem `datamine-*` → `src/data/*.json`-Muster, analog
zu `ship-loadouts.json`).

**Vorschlag JSON-Form:**
```json
{
  "generatedAt": "2026-08-03",
  "source": "Data.p4k Scripts/Entities/Vehicles/Implementations/Xml (CryXmlB ItemPort.maxSize)",
  "count": 223,
  "ships": {
    "orig-100i": { "w": 3, "m": 2, "s": 1, "c": 1, "p": 1, "q": 1, "r": 1 },
    "aegs-hammerhead": { "t": 6, "m": 5, "s": 4, "c": 4, "p": 4, "q": 3, "r": 4 }
  },
  "missing": ["argo-atls", "argo-atls-geo", "argo-atls-geo-collector-grad01", "argo-atls-geo-collector-grad03"]
}
```
Kürzel: `w`=Waffe, `t`=Turm, `m`=Rakete (missile), `s`=Schild, `c`=Kühler, `p`=Kraftwerk, `q`=Quantenantrieb,
`r`=Radar. Fehlt ein Kürzel bei einem Schiff, hat es keinen Port dieser Kategorie (nicht „Größe 0" — echte
Größe-0-Ports werden als `0` gespeichert und bleiben damit unterscheidbar von „nicht vorhanden").

**Gemessene Laufzeit des vollen Laufs** (p4k öffnen → Game2.dcb parsen → 360 Ship-Records filtern →
Implementations/Xml-Index bauen (170 Einträge) → für alle 227 Katalog-Schiffe: Record finden → XML-Verweis
auflösen → p4k-Eintrag extrahieren → CryXmlB parsen → Ports sammeln): **1872 ms** end-to-end, tatsächlich gemessen
(nicht geschätzt). Das ist lokal und schnell genug, um bei jedem Patch-Day-Refresh ohne Sonderbehandlung
mitzulaufen (siehe D-Diskretion: Lauf bleibt lokal, Ergebnis wird eingecheckt).

### Karten-Attribut-Kodierung

Ein einziges kompaktes `data-comp`-Attribut statt acht Einzelattribute — passt zum bestehenden Muster
(`data-q` konkateniert bereits Name+Hersteller zu einem String). Format: Kategorie-Buchstabe direkt gefolgt von der
Größe, Größe `>=10` als `X` kodiert (da im gesamten Datensatz keine Größe über 10 vorkommt), keine Trennzeichen
nötig, da jeder Größen-Code genau 1 Zeichen ist:

```
data-comp="w3m2s1c1p1q1r1"     <!-- orig-100i: kein t (kein Turm) -->
data-comp="t6m5s4c4p4q3r4"     <!-- aegs-hammerhead: kein w (keine feste Waffe) -->
data-comp=""                    <!-- ATLS-Varianten: gar keine Steckplatzdaten -->
```

**Gemessene Bytekosten** über alle 223 Karten mit Daten: Schnitt **12,5 Zeichen/Karte**, in Summe **2796 Byte**
Rohdaten, **~5,7 KB** inklusive `data-comp=""`-Attributname und Anführungszeichen auf allen 227 Karten. Das ist
gegenüber der bereits ausgelieferten Seite (227 Karten mit Bildern, Preisen, Chips) vernachlässigbar.

Client-seitiges Parsen (ES5, passend zu `schiffe.astro`s bestehendem IIFE-Stil):
```js
// Quelle: diese Recherche — Vorschlag, kein bestehender Code
var CAT_RX = /([wtmscpqr])(\d|X)/g;
function parseComp(s) {
  var out = {}, m;
  CAT_RX.lastIndex = 0;
  while ((m = CAT_RX.exec(s))) out[m[1]] = m[2] === 'X' ? 10 : parseInt(m[2], 10);
  return out;
}
```

## Integration-Oberfläche (Q6)

| Datei | Änderung |
|---|---|
| `scripts/lib/cryxml.mjs` (NEU) | CryXmlB-Parser (siehe Code Examples), inkl. Kommentar zu den zwei Case-Sensitivity-Fallen aus dieser Recherche |
| `scripts/datamine-ship-components.mjs` (NEU) | Analog zu `datamine-ship-loadouts.mjs`: p4k+DataCore öffnen, Ship-Records filtern, XML je Schiff auflösen, Ports extrahieren, Turm-Regel anwenden, Max-je-Kategorie aggregieren, `src/data/ship-components.json` schreiben |
| `package.json` | neuer Eintrag `"datamine:components": "node scripts/datamine-ship-components.mjs"` (Muster: `"datamine:loadouts"`) |
| `src/data/ship-components.json` (NEU, generiert+eingecheckt) | Output des obigen Skripts |
| `src/pages/schiffe.astro` | zwei neue `<select>` in `.sdb__filter` (Komponente, Größe, EN-Labels); `data-comp`-Attribut auf `<article class="fcard">` (Join per `id` gegen `ship-components.json`); `apply()` im `<script is:inline>` um D-04/D-08/D-11-Logik erweitern; Zählertext um „… ohne Steckplatz-Daten" ergänzen (D-08) |
| `src/pages/de/schiffe.astro` | identische Änderung, von Hand dupliziert (bestehendes Class-A-Muster aus `CONCERNS.md`), deutsche Labels „Komponente"/„Größe" |
| `src/i18n/ui.ts` | **keine Änderung erwartet** — die bestehenden Filter-Labels („All manufacturers"/„Alle Hersteller" etc.) sind bereits bespoke Inline-Literale je Seite, nicht im Katalog (siehe `CONVENTIONS.md`: „Bespoke page prose lives in the page, once per locale") |

**Gates, die vor „fertig" grün sein müssen** (aus `CONVENTIONS.md`):
```
npm run build        # inkl. _sync-assets, Thumbs, Downloads, astro build
npm run verify        # jeder lokale href/src/url() muss in dist/ existieren
npm run audit:site    # Links, DE/EN-Parität, SEO, A11y — FEHLER blockieren, WARNUNGEN nicht
npm run test:e2e      # node --test tests/e2e/**/*.test.js
```
`npm run theme` ist **nicht** nötig — es werden keine neuen `:root{}`-Palettenwerte eingeführt, die neuen
`<select>`-Elemente erben `.sdb__filter select` (bereits token-basiert: `--veil`, `--line`, `--text`, `--font-ui`).

## Common Pitfalls

### Pitfall 1: p4k-Pfad-Normalisierung stillschweigend übersehen
**What goes wrong:** Ein Regex-Match zwischen p4k-Eintragsnamen und DataCore-`fileName` liefert 0 Treffer, ohne
einen Fehler zu werfen — sieht aus wie „keine Daten im Spiel", ist aber ein Normalisierungsfehler.
**Why it happens:** p4k nutzt Backslash + `Data\`-Präfix, DataCore nutzt Forward-Slash ohne Präfix.
**How to avoid:** Immer `norm()` + `stripDataPrefix()` + `.toLowerCase()` auf BEIDEN Seiten vor dem Vergleich.
**Warning signs:** `p4k.entries(...)` liefert eine leere Liste, obwohl `Implementations/Xml` sichtbar existiert.

### Pitfall 2: Attribut-Case-Sensitivität bei `minSize`/`maxSize`
**What goes wrong:** Ports werden als „ohne Größe" übersehen, obwohl sie eine Größe tragen.
**Why it happens:** Manche Schiffe schreiben die Attribute klein (`minsize`/`maxsize`), andere groß.
**How to avoid:** Alle Attribut-Keys beim Parsen lowercased indizieren (nicht nur Portnamen, wie der ursprüngliche
Spike es tat).
**Warning signs:** Coverage-Zahl bricht bei einer Teilmenge der Schiffe komplett ein (in dieser Recherche: 6 von
227 Schiffen fielen auf „xml-has-no-sized-ports", bevor der Fix griff).

### Pitfall 3: `Turret`-Type mit Turmposition verwechseln
**What goes wrong:** Jede feste Flügelkanone würde fälschlich als „Turm" gezählt.
**Why it happens:** CIG nutzt `Turret` als generisches „kann sich drehen"-Flag auf Waffenports, unabhängig davon,
ob eine bemannte/ferngesteuerte Station dahintersteckt.
**How to avoid:** Nur `TurretBase` (ohne `Container`) bzw. `remote`-benannte `Turret`-Ports (ohne `WeaponGun`, ohne
`tractor`) als Turm zählen — siehe Turm-Regel-Abschnitt oben.
**Warning signs:** Turmzahl pro Schiff liegt systematisch höher als bei `vehicles.json`.

## Code Examples

### Vollständiger CryXmlB-Parser (verifiziert gegen ORIG_100i.xml, AEGS_Gladius.xml, AEGS_Hammerhead.xml, RSI_Polaris.xml)
```js
// Quelle: diese Recherche (Header-Layout aus dem Spike vom 03.08.2026, Case-Fixes aus dieser Recherche)
function parseCryXml(buf) {
  if (buf.toString('latin1', 0, 7) !== 'CryXmlB') throw new Error('kein CryXmlB');
  const nodeTablePos = buf.readUInt32LE(12), nodeCount = buf.readUInt32LE(16);
  const attrTablePos = buf.readUInt32LE(20), attrCount = buf.readUInt32LE(24);
  const childTablePos = buf.readUInt32LE(28), childCount = buf.readUInt32LE(32);
  const strTablePos = buf.readUInt32LE(36);
  const str = (rel) => { const a = strTablePos + rel; if (a < 0 || a >= buf.length) return '';
    let e = buf.indexOf(0, a); if (e < 0) e = buf.length; return buf.toString('utf8', a, e); };
  const attrsAll = [];
  for (let i = 0; i < attrCount; i++) { const o = attrTablePos + i * 8;
    attrsAll.push([str(buf.readUInt32LE(o)), str(buf.readUInt32LE(o + 4))]); }
  const childRefs = [];
  for (let i = 0; i < childCount; i++) childRefs.push(buf.readUInt32LE(childTablePos + i * 4));
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) { const o = nodeTablePos + i * 28;
    nodes.push({ tag: str(buf.readUInt32LE(o)), content: str(buf.readUInt32LE(o + 4)),
      attrCount: buf.readUInt16LE(o + 8), childCount: buf.readUInt16LE(o + 10),
      parent: buf.readUInt32LE(o + 12), firstAttr: buf.readUInt32LE(o + 16),
      firstChild: buf.readUInt32LE(o + 20), attrs: {}, children: [] }); }
  for (const n of nodes) {
    // Attribut-KEYS lowercased indizieren -- minSize/maxSize vs minsize/maxsize
    for (let i = 0; i < n.attrCount; i++) { const a = attrsAll[n.firstAttr + i]; if (a) n.attrs[a[0].toLowerCase()] = a[1]; }
    for (let i = 0; i < n.childCount; i++) { const c = nodes[childRefs[n.firstChild + i]]; if (c) n.children.push(c); } }
  return nodes;
}
```

### Ports mit Größe + Types extrahieren (Portname vom Eltern-`Part`-Knoten)
```js
// Quelle: diese Recherche
function extractPorts(nodes) {
  const ports = [];
  for (const part of nodes) {
    if (part.tag !== 'Part') continue;
    const ip = part.children.find((c) => c.tag === 'ItemPort');
    if (!ip || ip.attrs.maxsize == null || ip.attrs.maxsize === '') continue;
    const typesNode = ip.children.find((c) => c.tag === 'Types');
    const types = typesNode
      ? typesNode.children.filter((c) => c.tag === 'Type').map((c) => c.attrs.type).filter(Boolean)
      : [];
    ports.push({ name: part.attrs.name || '', min: Number(ip.attrs.minsize ?? ip.attrs.maxsize), max: Number(ip.attrs.maxsize), types });
  }
  return ports;
}
```

## State of the Art

Nicht anwendbar — CryXmlB ist ein stabiles, seit Jahren unverändertes Binärformat von CIG; es gibt keine
„aktuellere" Alternative zu dokumentieren. Der einzige Versionsunterschied im Repo ist DataCore v6→v8
(bereits in `scripts/lib/datacore.mjs` behandelt, nicht Gegenstand dieser Phase).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Powerplant - Power` (1 Port, `drak-mule`) ist ein Batterie-Datenartefakt und kein echtes Kraftwerk | Types-Vokabular | Gering — betrifft 1 von 227 Schiffen; falls doch ein echtes Kraftwerk, fehlt `drak-mule` fälschlich in der Kraftwerk-Kategorie (fällt unter D-08 „ohne Daten" statt echtem Nichttreffer — konservativ falsch, nicht optimistisch falsch) |
| A2 | RSI Polaris' PDC-Diskrepanz (7 Stationen laut `vehicles.json`, 0 in der XML) beruht auf strukturell fehlenden Daten in der aktuellen LIVE-XML, nicht auf einem Fehler in der Turm-Regel | Turm-Regel / Validierung | Mittel — falls die PDC-Ports doch existieren, aber unter einem anderen Type-Wert/Struktur verborgen sind, unterschätzt die Turm-Kategorie systematisch bei Kapitalschiffen. Betrifft nur die ~10 größten Schiffe im Katalog (>6 Türme laut Drittquelle) |
| A3 | S0-Größen (Schild/Kühler/Kraftwerk/Radar bei kleinen/Bodenfahrzeugen) sind für Nutzer kein sinnvoller Filterwert | Größenverteilung (Q4) | Gering — betrifft nur die untere Grenze des Größenfelds; falsche Entscheidung zeigt höchstens einen zusätzlichen, wenig nützlichen Dropdown-Eintrag |
| A4 | ATLS-Powerarmor nutzt ein anderes Component-System als Schiffe (keine `Part`/`ItemPort`-Struktur) und würde auch bei erweitertem Record-Filter keine Steckplatzdaten liefern | Coverage (Q1) | Gering — betrifft nur 4 von 227 Katalog-Einträgen, die ohnehin unter D-08 fallen |
| A5 | `rsi-scorpius-antares`s per Regel erkannter „Turm" (0 laut `vehicles.json`) ist ein Fall veralteter Drittquellen-Daten, nicht ein Regelfehler | Vollflotten-Validierung | Gering — ein Einzelschiff, betrifft die binäre Ja/Nein-Klassifikation bei einem von 223 Schiffen |

## Open Questions

1. **Warum fehlen RSI Polaris' PDC-Stationen komplett in der Implementierungs-XML?**
   - What we know: 5 bemannte + 2 ferngesteuerte Türme sind über `TurretBase`/`remote`-Portnamen exakt auflösbar;
     die 7 PDC-Stationen aus `vehicles.json` haben in `RSI_Polaris.xml` keine Entsprechung.
   - What's unclear: ob PDCs strukturell anders abgelegt sind (z. B. als Teil einer Waffen-Gruppe statt eigener
     `ItemPort`) oder ob `vehicles.json` (Drittquelle `star-citizen.wiki`) hier von einem älteren/anderen Balancing
     ausgeht.
   - Recommendation: Als bekannten Blinden Fleck bei Kapitalschiffen dokumentieren (D-08-Pfad), keine Sonderlogik
     bauen. Bei Bedarf menschliche Sichtprüfung im Spiel.

2. **Sollte das Größenfeld S0-Werte anzeigen?**
   - What we know: S0 kommt real vor (Schild/Kühler/Kraftwerk/Radar bei ~9 % der Schiffe je Kategorie).
   - What's unclear: ob „mindestens Größe 0" für Nutzer sinnvoll ist oder nur Verwirrung stiftet.
   - Recommendation: Dropdown ab S1 beginnen lassen (Claude's Discretion laut CONTEXT.md deckt UI-Detailfragen ab),
     S0-Ports bleiben intern für die Existenzprüfung der Kategorie relevant.

3. **Sollte `BombLauncher` wirklich unter „Rakete" laufen, oder braucht es eine eigene Unterscheidung?**
   - What we know: Der bestehende `itemCat()` in `datamine-ship-loadouts.mjs` fasst `/missiles?/` und `/bombs?/`
     bereits als eine Kategorie (`'missile'`) zusammen — ein Präzedenzfall im selben Repo.
   - What's unclear: ob Nutzer „Bomben" (z. B. Retaliator-Torpedobucht) unter „Rakete" erwarten.
   - Recommendation: Präzedenzfall folgen (BombLauncher → Rakete), da D-05 keine neunte Kategorie vorsieht und der
     bestehende Code diese Zusammenfassung bereits trifft.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Data.p4k (`F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k`) | gesamter Datamine-Lauf | ✓ | LIVE-Build (Größe ~147 GB) | keiner nötig — lokal vorhanden, per D-Diskretion bewusst nicht CI-pflichtig |
| Node.js | alle Skripte | ✓ | v22.18.0 (getestet) | — |
| `scripts/lib/p4k.mjs` / `scripts/lib/datacore.mjs` | p4k-/DataCore-Zugriff | ✓ | bereits im Repo, unverändert wiederverwendet | — |
| `src/data/vehicles.json` (`turrets`/`fixedWeapons`-Felder) | Turm-Regel-Validierung (Q3) | ✓ | vorhanden, 227 Einträge | — |
| `src/data/ship-hardpoints.json` | Katalog-id-Liste (227 Schiffe) | ✓ | vorhanden | — |

**Missing dependencies with no fallback:** keine.

**Missing dependencies with fallback:** keine — alle benötigten Werkzeuge und Daten waren zum Zeitpunkt dieser
Recherche vorhanden.

## Security Domain

`security_enforcement` ist in `.planning/config.json` aktiv (`security_asvs_level: 1`). Diese Phase führt jedoch
keine neue Angriffsfläche ein:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | nein | keine Authentifizierung betroffen |
| V3 Session Management | nein | — |
| V4 Access Control | nein | — |
| V5 Input Validation | ja (bestehend, nicht neu) | Das neue Größenfeld ist ein `<select>` mit serverseitig vorgegebenen Optionen (keine Freitext-Eingabe), das neue Komponentenfeld ebenso — beide werden analog zu den bestehenden `sf-maker`/`sf-type`-Selects behandelt, kein neues Eingabemuster |
| V6 Cryptography | nein | AES/zstd-Handling in `p4k.mjs` ist unverändert und bereits verifiziert; diese Phase fügt keine Krypto-Logik hinzu |

### Known Threat Patterns for {stack}

Kein Bedrohungsmuster einschlägig: der Datamine-Lauf ist ein lokales, offline ausgeführtes Build-Skript ohne
Netzwerkzugriff und ohne Nutzereingabe; das Ergebnis ist ein statisches, eingechecktes JSON; die Filter-UI liest
ausschließlich `data-*`-Attribute aus dem eigenen, serverseitig gerenderten HTML (kein `innerHTML` aus Nutzereingabe,
kein `eval`). Kein neues STRIDE-relevantes Muster gegenüber dem bestehenden Filter in `schiffe.astro`.

## Sources

### Primary (HIGH confidence — selbst ausgeführte Probe-Skripte gegen Data.p4k)
- `scripts/lib/p4k.mjs`, `scripts/lib/datacore.mjs` — gelesen und wiederverwendet, unverändert
- `scripts/datamine-ship-loadouts.mjs` — gelesen, Muster für Schiff-Auswahl/Varianten-Filter/ID-Bildung übernommen
- Eigene Probe-Läufe gegen `F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k` (223/227 Schiffe voll aufgelöst,
  Types-Vokabular über alle Ports, Turm-Regel gegen 223 Schiffe validiert) — alle Zahlen in diesem Dokument stammen
  von hier
- `src/data/vehicles.json`, `src/data/ship-hardpoints.json`, `src/pages/schiffe.astro`, `src/pages/de/schiffe.astro`,
  `.planning/codebase/CONVENTIONS.md` — gelesen im Repo

### Secondary (MEDIUM confidence)
- `scripts/sync-vehicles.mjs`, `scripts/enrich-weapon-sizes.mjs` — gelesen zur Einordnung, woher `turrets`/
  `fixedWeapons`/`fixedWeaponSizes` in `vehicles.json` stammen (Drittquelle `star-citizen.wiki`-API), erklärt die
  Polaris-Diskrepanz

### Tertiary (LOW confidence)
- keine — es wurde keine Websuche für diese Phase benötigt, da die gesamte Recherche empirisch gegen lokale
  Spieldateien und den vorhandenen Code lief

## Metadata

**Confidence breakdown:**
- Coverage/Types-Vokabular/Größenverteilung: HIGH — direkt gemessen über 223 von 227 Katalog-Schiffen
- Turm-Regel: HIGH für Nicht-Kapitalschiffe (89,7 % exakt, ~95 % binär), MEDIUM für Kapitalschiffe mit
  PDC-Batterien (strukturelle Datenlücke, kein Regelproblem, aber ungelöst)
- Ausgabeform/Bytegröße/Laufzeit: HIGH — gemessen, nicht geschätzt
- Integrationsoberfläche (Dateien, Gates): HIGH — direkt aus gelesenem Code und `CONVENTIONS.md` abgeleitet

**Research date:** 2026-08-03
**Valid until:** bis zum nächsten größeren Patch, der Schiffs-Hardpoints ändert (Star Citizen ändert ItemPort-Layouts
gelegentlich patchweise) — 30 Tage als konservative Faustregel, da Data.p4k-Struktur selbst (CryXmlB-Format) stabil
ist, aber Einzelschiff-Daten bei jedem Patch neu gezogen werden müssen (der Datamine-Lauf ist genau dafür gebaut).
