# Phase 5: Komponenten-Filter für Schiffe - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Die Schiffsliste (`/schiffe.html` EN + `/de/schiffe.html` DE) bekommt einen Filter
nach **Steckplatz-Größe**: ein Auswahlfeld benennt die Bauteilart, ein zweites die
Mindestgröße. Gemessen wird, was ein Steckplatz aufnehmen **kann** (`ItemPort.maxSize`
aus den Spieldateien), nicht was ab Werk drinsteckt.

Dazu gehört eine neue, im Repo noch nicht vorhandene Datenquelle: ein CryXmlB-Leser
plus ein `datamine-*`-Skript, das die Steckplätze je Fahrzeug aus dem p4k zieht.

**Nicht in dieser Phase:** Anzeige der Steckplatz-Größen im UI (bewusst
ausgeschlossen, siehe D-07), Gegenmaßnahmen als Kategorie, Entdopplung der beiden
Sprachfassungen der Schiffsseite.

</domain>

<decisions>
## Implementation Decisions

### Datenquelle

- **D-01:** Gefiltert wird nach der **Steckplatz-Größe** (`ItemPort.maxSize`), nicht
  nach der Größe des ab Werk verbauten Bauteils. Grund: die Frage, die Spieler
  stellen, ist „was kann ich da dranbauen", nicht „was ist drin".
  `src/data/ship-loadouts.json` (Stock-Loadout) ist damit **nicht** die Quelle.
  — **Reversibility:** costly — die gesamte Datenerzeugung hängt daran; ein Wechsel
  auf Stock-Größen macht Skript, JSON-Format und Filterwerte gleichzeitig ungültig.

- **D-02:** Quelle ist `Scripts/Entities/Vehicles/Implementations/Xml/<SCHIFF>.xml`
  im Data.p4k, CryXmlB-kodiert. Je `<Part>` hängt ein `<ItemPort>` mit
  `minSize`/`maxSize` und einer `Types`-Liste. **Per Spike belegt** (ORIG_100i,
  AEGS_Gladius) — siehe `<specifics>` für das Header-Format.

- **D-03:** Der Join Schiff → XML läuft über den **Dateiverweis im
  DataCore-Schiffsrecord** (der Record führt den Pfad seiner Implementierungs-XML
  selbst), **nicht** über zusammengesetzte Dateinamen. `RSI_Constellation_Andromeda.xml`
  existiert z.B. nicht unter diesem Namen — Namensraten scheitert nachweislich und
  träfe dieselbe Falle wie [[display-name-not-a-key]].

### Filterverhalten

- **D-04:** Trefferregel „**einer reicht**": ein Schiff erscheint bei „Waffe ab S5",
  sobald **mindestens ein** Waffensteckplatz `maxSize >= 5` hat. Nicht „alle
  Steckplätze dieser Art".

- **D-05:** Kategorien: **Waffe, Turm, Rakete, Schild, Kühler, Kraftwerk,
  Quantenantrieb, Radar**. Gegenmaßnahmen wurden ausdrücklich ausgeschlossen.

- **D-06:** „**Turm**" meint nur Steckplätze, die im Spiel tatsächlich Turmpositionen
  sind. Die Rohdaten trennen das nicht: `hardpoint_gun_left_wing` (Gladius) trägt
  `types=[Turret, WeaponGun]`, ist aber eine feste Flügelkanone. Es braucht eine
  Trennregel (Portname/Struktur), und die ist **an Stichproben zu belegen**, nicht
  zu behaupten. Alles, was kein echter Turm ist, zählt als „Waffe".
  — **Reversibility:** costly — die Regel bestimmt die Zuordnung im erzeugten JSON;
  eine Änderung erfordert Neuerzeugung und macht jede vorher geprüfte Stichprobe wertlos.

- **D-06a (Revision am blockierenden Prüfpunkt, 03.08.2026):** Die ausgeführte Regel hatte zwei
  Teile — den direkten Spieldaten-Typ `TurretBase` (ohne `Container`) und eine **geratene**
  Zusatzregel, die Fernürme am Portnamen erkannte (`/remote/i`, aber nicht `/tractor/i`). Der
  Nutzer hat die Namensregel am Prüfpunkt **gestrichen**: „Turm" wird ausschließlich über
  `TurretBase` bestimmt — genauso direkt aus den Spieldaten gelesen wie `Shield` oder `Cooler`.
  Damit steht **keine Heuristik** mehr im Auslieferungsstand.
  **Preis, ausdrücklich in Kauf genommen:** Carrack, Redeemer und Polaris verlieren ihre
  ferngesteuerten Türme — die tragen im Spiel nur `Turret`, nie `TurretBase`.
  **Vorgeschichte:** Zuerst war „Turm-Kategorie ganz weglassen" gewählt. Dagegen sprach, dass die
  Hammerhead **gar keine feste Waffe** trägt — ihre sechs S5-Geschütze sitzen sämtlich in Türmen,
  ihr Eintrag hat kein `w`. Ersatzloses Streichen hätte sie und 58 weitere Turmschiffe über jeden
  Waffenfilter unauffindbar gemacht. Daraufhin diese Fassung.
  — **Reversibility:** costly — dieselbe Begründung wie D-06.

- **D-07:** **Nur filtern, nicht anzeigen.** Weder Karte noch Datenblatt zeigen die
  Steckplatz-Größen. (Vom Nutzer gegen die Empfehlung entschieden; die Anzeige ist
  als Idee unter `<deferred>` festgehalten.)

- **D-08:** Fahrzeuge **ohne** Steckplatz-Daten fallen bei aktivem Komponentenfilter
  aus der Trefferliste, aber der Ergebniszähler nennt sie ausdrücklich
  (z.B. „37 Treffer · 12 ohne Steckplatz-Daten"). Kein stillschweigendes Verschwinden.

### Bedienung

- **D-09:** **Zwei** Auswahlfelder, nicht acht: eines „Komponente" (Bauteilart),
  daneben eines für die Mindestgröße. Ausdrückliche Korrektur des Nutzers gegen einen
  früheren Vorschlag mit einem Feld je Kategorie.

- **D-10:** Das Größenfeld zeigt **nur die Größen, die es bei der gewählten Bauteilart
  wirklich gibt** (Schild z.B. nur bis S3). Keine Auswahl, die garantiert null Treffer
  liefert.

- **D-11:** Bauteilart **ohne** Größe filtert **noch nicht** — sie ist Vorauswahl für
  das Größenfeld. Der Filter greift erst, wenn beide Felder gesetzt sind.

- **D-12:** Der neue Filter arbeitet mit den bestehenden Feldern (Suche, Hersteller,
  Typ, Status, Archiv) zusammen; der Ergebniszähler bleibt korrekt.

### Claude's Discretion

- Format und Dateiname des erzeugten JSON, Zuschnitt des CryXmlB-Lesers
  (`scripts/lib/`), Abbildung der `Types`-Werte auf die acht Kategorien, Aufbau der
  `data-*`-Attribute und des Inline-JS.
- Der Datamine-Lauf ist **lokal**, nicht CI: Data.p4k liegt nur auf dem
  Entwicklungsrechner (~147 GB). Das Ergebnis-JSON wird eingecheckt, wie bei den
  übrigen `datamine-*`-Ausgaben.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Hausregeln (verbindlich)

- `.planning/codebase/CONVENTIONS.md` — deutsche Kommentare, `datamine-*`-Namensschema,
  dichtes Inline-CSS, `versioned()` statt `?v=N`, Gates (`build`/`verify`/`audit:site`/`test:e2e`/`theme`)
- `.planning/codebase/CONCERNS.md` — Class A: die 67 EN/DE-Seitenpaare werden von Hand
  doppelt gepflegt; nichts im Build vergleicht sie
- `.planning/PROJECT.md` — Kernwert: spielgenaue Daten aus den Spieldateien

### Vorhandene Datamine-Vorbilder

- `scripts/datamine-ship-loadouts.mjs` — nächstes Analogon: p4k öffnen, DataCore lesen,
  Schiff-Records filtern (`isVariantJunk`), ID-Join `recId()`, Ausgabe nach `src/data/`.
  Enthält auch den Hinweis, dass Portnamen in der Groß-/Kleinschreibung abweichen.
- `scripts/lib/p4k.mjs` — `openP4k()`, `DEFAULT_P4K` (per `SC_P4K` überschreibbar), `read(regex)`
- `scripts/lib/datacore.mjs` — `openDataCore()`, `records`, `readRecord()`, `structs`

### Betroffene Seiten

- `src/pages/schiffe.astro` — EN-Fassung, Filterleiste ab Zeile 236, Inline-JS ab Zeile 338
- `src/pages/de/schiffe.astro` — DE-Zwilling, handdupliziert
- `src/i18n/ui.ts` — Katalog für wiederkehrende UI-Strings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`scripts/lib/p4k.mjs` + `scripts/lib/datacore.mjs`**: p4k-Zugriff und
  DataCore-Parser stehen fertig bereit; Öffnen kostet ~950 ms für 116.512 Records.
- **`scripts/datamine-ship-loadouts.mjs`**: liefert das Muster für Schiff-Auswahl,
  Varianten-Filter und ID-Bildung — direkt übertragbar.
- **Bestehende Filtermechanik in `schiffe.astro`**: `data-*`-Attribute je Karte plus
  eine `apply()`-Funktion, die alle Bedingungen mit `&&` verknüpft und den Zähler
  schreibt. Der neue Filter fügt sich dort ein, ohne die Mechanik umzubauen.

### Established Patterns

- **`datamine-*` schreibt nach `src/data/*.json`**, das JSON wird eingecheckt; der
  Build liest nur die Datei, nie das p4k.
- **Client-JS in `.astro` ist `<script is:inline>` im ES5-IIFE-Stil** (`var`, kein
  Modul, kein Build-Schritt) — der neue Code muss dazu passen.
- **Kein `any` in `src/lib`**, `astro/tsconfigs/strict`.
- **Fehlende Werte werden ehrlich dargestellt, nie erfunden** — deckt sich mit D-08.

### Integration Points

- Filterleiste `.sdb__filter` in beiden `schiffe.astro` (zwei neue `<select>`)
- `apply()` im Inline-Skript beider Seiten (neue Bedingung + Zählertext)
- `data-*`-Attribute auf `<article class="fcard">` in beiden Seiten
- Neues Skript + `package.json`-Eintrag nach dem Muster `datamine:loadouts`

</code_context>

<specifics>
## Specific Ideas

**Spike-Ergebnis vom 03.08.2026 — das Format ist entziffert, nicht vermutet:**

CryXmlB-Kopf, alles LE-uint32: Offset 12 `nodeTablePos`, 16 `nodeCount`,
20 `attrTablePos`, 24 `attrCount`, 28 `childTablePos`, 32 `childCount`,
36 `stringTablePos`. Knoten sind 28 Bytes (`tagOff, contentOff, u16 attrCount,
u16 childCount, parent, firstAttr, firstChild, reserved`), Attribute 8 Bytes
(`keyOff, valueOff`), die Kindtabelle je 4 Bytes ein Knotenindex. Strings sind
nullterminiert und relativ zur Stringtabelle adressiert.

Damit gelesene Beispielwerte:

```
ORIG_100i     hardpoint_shield_generator    min=1 max=1  types=[Shield]
              hardpoint_power_plant         min=1 max=1  types=[PowerPlant]
              hardpoint_quantum_drive       min=1 max=1  types=[QuantumDrive]
              hardpoint_weapon_gun_right    min=3 max=3  types=[Turret,WeaponGun]
              hardpoint_weapon_missilebay_125a  min=2 max=2  types=[MissileLauncher]
AEGS_Gladius  Hardpoint_cooler_left         min=1 max=1  types=[Cooler]
              hardpoint_gun_left_wing       min=3 max=3  types=[Turret,WeaponGun]
              hardpoint_missilerack_left_wing_outer  min=3 max=3  types=[MissileLauncher,BombLauncher]
```

**Stolperstellen, die der Spike gezeigt hat:**

1. Groß-/Kleinschreibung der Portnamen ist uneinheitlich (`Hardpoint_cooler_left` vs.
   `hardpoint_...`) — Vergleiche case-insensitiv führen.
2. `types` ist eine **Liste**, ein Port kann mehreren Kategorien angehören
   (`[Turret, WeaponGun]`, `[MissileLauncher, BombLauncher]`). Die Abbildung auf die
   acht Kategorien muss das entscheiden, nicht ignorieren (siehe D-06).
3. Nur ein Teil der Ports ist interessant: der 100i hat 786 Knoten, davon 72 mit
   `maxSize`, davon die Mehrzahl Controller/Türen/Sitze.
4. `Scripts/Entities/…/RSI_Constellation_Andromeda.xml` gibt es nicht — deshalb D-03.

</specifics>

<deferred>
## Deferred Ideas

- **Steckplatz-Größen sichtbar machen** — eine Aufstellung „Waffe 2× S3 · Schild 1× S1 …"
  im Schiffs-Datenblatt, damit der Filter nachprüfbar wird. In dieser Phase bewusst
  abgewählt (D-07); als eigene Phase sinnvoll, weil dieselben Daten schon vorliegen.
- **Gegenmaßnahmen als Kategorie** — ausdrücklich ausgeschlossen, Daten wären da.
- **Zahl der Steckplätze als Filterkriterium** („mindestens 2× S5") — nicht besprochen,
  wäre eine Erweiterung der Trefferregel D-04.
- **Entdopplung der beiden `schiffe.astro`** — der Class-A-Befund aus CONCERNS.md; diese
  Phase pflegt bewusst beide Fassungen von Hand, statt nebenbei umzubauen. Phase 4
  adressiert den Nachweis.

</deferred>

---

*Phase: 5-Komponenten-Filter für Schiffe*
*Context gathered: 2026-08-03*
