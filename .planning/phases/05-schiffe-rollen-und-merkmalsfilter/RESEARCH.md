# Phase 5 — Forschung: Woher kommen granulare Schiffsdaten?

**Erhoben am:** 2026-08-02
**Quelle:** eigene Extraktion aus `Data.p4k` → `Data/Game2.dcb` (DataCore), gelesen mit
`scripts/lib/p4k.mjs` + `scripts/lib/datacore.mjs`. Spielstand `4.9.0-LIVE`, p4k vom 29.07.2026.
**Nicht** aus Wiki, FleetYards oder Marketingtext.

---

## 1. Ausgangslage: was die Seite heute filtert

`src/pages/schiffe.astro` (EN) und `src/pages/de/schiffe.astro` (DE, eigene Kopie) filtern über:

| Filter | Quelle | Werte | Problem |
|---|---|---|---|
| Hersteller | `manufacturer` | ~25 | ok |
| Typ | `typeDe`/`typeEn` | **8** | zu grob — „Gewerblich" wirft Bergbau, Bergung, Betankung und Wissenschaft in einen Topf |
| Status | `statusEn` | 3 | ok |
| Archiv | `patches.length` | 2 | ok |
| Sortierung | Preis/Fracht/Crew | 5 | ok |

Als Kartenbeschriftung dient bereits `vRole()` → `fociDe` (65 Werte). Diese Foci sind
**unbrauchbar als Filterachse**: Mischsprache (`Bergung` neben `Salvage` neben
`Medium Salvage`), Tippfehler (`Abrieglung` neben `Abriegelung`), Dubletten
(`Aufklärung + Aufklärung`). Sie stammen aus der Wiki-API, nicht aus dem Spiel.

## 2. Fund A — CIG hat eine eigene, zweiachsige Taxonomie

Jeder Schiffs-Record trägt eine Komponente `VehicleComponentParams` mit **zwei**
Klassifikationsfeldern, beide als Lokalisierungsschlüssel:

```
vehicleCareer = "@vehicle_focus_combat"        → EN "Combat"        DE "Kampf"
vehicleRole   = "@vehicle_class_stealthfighter" → EN "Stealth Fighter" DE "Tarnjäger"
```

Das ist **CIG-eigene Klassifikation samt CIG-eigener Übersetzung** (aus
`Localization/<sprache>/global.ini`) — nicht unsere Interpretation.

### Achse 1 — `vehicleCareer` (Beruf), 15 Rohwerte

Sieben tragende Werte, dazu Altlasten:

| Rohwert | EN | DE | Schiffe |
|---|---|---|---|
| `@vehicle_focus_combat` | Combat | Kampf | 158 |
| `@vehicle_focus_transporter` | Transporter | Transport | 54 |
| `@vehicle_focus_exploration` | Exploration | Erkundung | 41 |
| `@vehicle_focus_support` | Support | Unterstützung | 29 |
| `@vehicle_focus_resources` | Industrial | Industrie | 26 |
| `@vehicle_focus_competition` | Competition | Wettkampf | 19 |
| `@vehicle_focus_multirole` | Multi-Role | Mehrzweck | 15 |
| `@vehicle_focus_ground` | Ground | Boden | 2 |

**Altlasten, die normalisiert werden müssen:** `@procedural_text_null` (9× → leer),
`@item_ShipFocus_Starter|Transport|Gunship|CapitalShip` (Alt-Schema, 5×), sowie
Records, bei denen versehentlich ein `@vehicle_class_*` im Career-Feld steht
(`snubfighter`, `destroyer`).

### Achse 2 — `vehicleRole` (Rolle), 59 Rohwerte

Das ist die vom Nutzer gewünschte Granularität. Auszug:

`heavyfighter` 33 · `lightfighter` 25 · `lightfreight` 22 · `mediumfreight` 20 ·
`racing` 19 · `mediumfighter` 19 · `pathfinder` 17 · `medical` 17 · `expedition` 15 ·
`passenger` 12 · `dropship` 10 · `antiair` 9 · `interdiction` 7 · **`stealthfighter` 7** ·
`heavyrefuelling` 7 · `lightmining` 5 · `lightsalvage` 5 · `heavybomber` 5 · `frigate` 5 ·
`heavysalvage` 4 · `gunship` 4 · `mediummining` 3 · `destroyer` 3 · **`stealthbomber` 2** ·
`heavyfreight` 2 · `interceptor` 2 · `corvette` 2 · `lightrefueling` 1 · `mediumsalvage` 1 ·
`mediumdata` 1 · `lightscience` 1 · `recovery` 1 · `snubcarrier` 1 · `reporting` 1 · …

**Zwei Eigenheiten, die die Normalisierung lösen muss:**

1. **Verbundrollen** — `starterlightfreight` („Starter / Leichter Frachter", 7×),
   `lightfreight_mediumfighter` (6×), `startermining`, `starterpathfinder`,
   `starterlightfighter`, `startersalvage`, `heavyfighterbomber`,
   `mediumfreightgunshio` (sic — CIG-Tippfehler). Diese müssen in **atomare**
   Rollen zerlegt werden, sonst findet ein Filter „Leichter Frachter" die
   Starter-Frachter nicht.
2. **Fehlende deutsche Fassung** — CIG liefert für ~15 Rollen kein deutsches
   Pendant (`antiair`, `lighttank`, `generalist`, `lightrefueling`, `recovery`,
   `modular`, `snubcarrier`, `antivehicle`, `heavydropship` …). Diese Lücken
   müssen wir selbst füllen; einfach englisch durchreichen wäre ein Sprachbruch.

### Join auf unseren Katalog — **223 von 227 = 98,2 %**

Join-Weg wie in `scripts/datamine-ship-loadouts.mjs` erprobt:
Record-Name `EntityClassDefinition.AEGS_Sabre` → `aegs-sabre` → unsere `id`.

Die 4 Fehltreffer sind **alle** der ATLS (`argo-atls`, `argo-atls-geo` und zwei
Lackierungen) — der Frachtexoskelett-Anzug liegt im DataCore nicht unter
`/spaceships/` oder `/groundvehicles/`. Muss benannt statt stillschweigend leer bleiben.

## 3. Fund B — Signatur-Absenkung ist messbar („Tarnung")

`SSCSignatureSystemParams.radarProperties.baseSignatureParams.signatures` ist ein
Zahlen-Array (Multiplikatoren, `< 1` = abgesenkt). Fehlt die Komponente, gilt
Normalwert. Zusätzlich liegt eine manuelle Radarquerschnittsfläche
(`crossSectionParams.crossSection` als x/y/z) vor.

**22 Schiffe mit abgesenkter Signatur** (IR/EM/Querschnitt):

| Schiff | Signatur | Rolle laut CIG |
|---|---|---|
| Nox, Dragonfly (+Varianten, 6) | 0.50 / 0.50 / — | racing |
| Razor EX | 0.55 / 0.55 / 0.75 | stealthfighter |
| Talon, Talon Shrike | 0.60 / 0.60 / 0.80 | lightfighter |
| Mustang Delta | 0.70 / 0.70 / 0.70 | lightfighter |
| Eclipse (+BIS) | 0.75 / 0.75 / 0.50 | **stealthbomber** |
| **Prowler** | 0.76 / 0.76 / 0.80 | dropship |
| **Prowler Utility** (+Collector) | 0.76 / 0.76 / 0.80 | **lightfreight** |
| Sabre, Sabre Comet | 0.80 / 0.80 / 0.50 | stealthfighter |
| Sabre Raven | 0.83 / 0.83 / 0.75 | interdiction |
| Sabre Firebird, Peregrine (+Coll.) | 0.83 / 0.83 / 0.75 | stealthfighter / racing |

**Das ist der Schlüssel zum Wunsch „stealth cargo".** Der Prowler Utility ist laut
CIG-Rolle ein *Leichter Frachter*; dass er tarnfähig ist, steht ausschließlich in
diesen Zahlen. Nur die Kombination beider Achsen findet ihn.

⚠ **Ehrlichkeitsfalle:** Nox und Dragonfly sind Schweberäder mit 0.50 — technisch die
niedrigste Signatur im Feld, aber niemand nennt sie „Tarnkappenschiffe". Das Merkmal
muss deshalb heißen, was es ist (**„Abgesenkte Signatur"**), und den gemessenen Wert
mitzeigen. Das Wort „Tarn-" trägt bereits die CIG-Rolle (`stealthfighter`,
`stealthbomber`) für die Schiffe, die CIG selbst so nennt.

## 4. Fund C — Fähigkeiten aus dem Standard-Loadout (mit Fallstricken)

Über `SEntityComponentDefaultLoadoutParams` (rekursiv, wie in
`datamine-ship-loadouts.mjs`) sind die tatsächlich verbauten Werkzeuge sichtbar.
**Der Item-Pfad ist das verlässliche Signal, nicht der Item-Name.**

### Belastbar ✅

| Merkmal | Pfadmuster | Treffer | Beleg |
|---|---|---|---|
| **Bergbau** | `utility/mining/` | **14** | ROC, ROC DS, MOLE, Golem, MOTH, Prospector + Varianten — vollständig und ohne Fehltreffer |
| **Abriegelung (QED)** | `quantumenforcementdevice/` | **6** | Mantis, Cutlass Blue, Scorpius Antares, Guardian QI (+Varianten) — exakt |

### Verrauscht ⚠ — braucht enge Pfadmuster statt Stichwortsuche

| Naiv gesucht | Rohtreffer | Warum falsch |
|---|---|---|
| `salvage` | 55 | `Controller_Salvage_Crus_C1` hängt auch an der **Cutlass Red** (Rettungsschiff). Nur `utility/salvage/salvagehead/` beweist Bergungsfähigkeit |
| `tractor` | 47 | enthält `SeatAccess_TractorBeam` (Sitzzugang) und Andock-Traktoren. Nur `weapons/*tractorbeam*` bzw. Bergungs-Traktormodule zählen |
| `refuel` | 46 | enthält `*_Ground_Refueling_Port` — das ist der Anschluss zum **Betankt-Werden** (Apollo, Terrapin), nicht die Fähigkeit zu betanken. Nur `utility/refueling/fuelpod/` zählt |

### Nicht aus dem Loadout ableitbar ❌

**Medizin** — nur 2 Treffer (C8R Pisces). Medizinbetten stecken nicht im
Fahrzeug-Loadout, sondern in Raum-/Objektcontainern. Die CIG-Rolle
`@vehicle_class_medical` deckt dagegen **17** Schiffe sauber ab.
→ **Medizin kommt aus der Rolle, nicht aus dem Loadout.** Kein Ersatzsignal erfinden.

### Sackgasse: Item-Ports am Entity-Record ❌

`SItemPortContainerComponentParams.Ports[].Types[].Type` liefert 60 Typen, ist aber als
Fähigkeitsquelle **unbrauchbar**: `ToolArm` trifft 17 Schiffe — allesamt
Starfarer-Varianten (Betankungsarm), **kein** Prospector, **kein** MOLE. `CargoGrid`
trifft nur 21 Schiffe, obwohl weit mehr Fracht laden. Die Ports stehen bei den meisten
Schiffen nicht am Entity-Record. Diese Spur wurde geprüft und verworfen.

## 5. Was daraus folgt

1. **Archetyp-Achse = `vehicleRole`**, normalisiert (Verbundrollen zerlegt, Altwerte
   gemappt, deutsche Lücken gefüllt). Vollständig für alle 223 gejointen Schiffe,
   inklusive Medizin, Betankung, Bergung, Bergbau.
2. **Merkmals-Achse = schmal und belegt.** Nur Signale mit sauberem Beleg:
   abgesenkte Signatur (22, aus Zahlen), Bergbau (14) und Abriegelung (6) aus dem
   Loadout, Bergung/Betankung/Traktor erst nach Verengung der Pfadmuster.
   Was nicht belegbar ist, wird nicht behauptet.
3. **Beruf-Achse = `vehicleCareer`** ersetzt den heutigen 8-Werte-Typ als grobe
   Vorfilterung.
4. Jedes Merkmal muss seine Quelle mitführen, damit die Seite belegen kann, warum ein
   Schiff getaggt ist — passend zum Projektkern „spielgenaue Daten".

## 6. Offene Entscheidungen für die Diskussion

- Wie viele Achsen bekommt die Oberfläche wirklich (Beruf + Rolle + Merkmale = 3
  Bedienelemente plus Suche, Hersteller, Status, Archiv, Sortierung — wird das zu voll?)
- Rollen-Familien: filtert man „Bergung" (alle Gewichtsklassen) oder „Schweres
  Bergungsschiff" (exakt)? Vorschlag: Familie filtern, exakte Rolle auf der Karte zeigen.
- Vorgefertigte Kombinationen („Tarnkappenbomber", „Frachter mit abgesenkter Signatur")
  als anklickbare Voreinstellungen — ja/nein?
- Bleibt `fociDe` als Kartenbeschriftung, oder ersetzt die CIG-Rolle sie ganz?
- Neues Sync-Skript (`datamine-vehicle-roles.mjs`) mit eigener JSON-Ausgabe, oder
  Anreicherung von `vehicles.json` beim bestehenden Sync?
