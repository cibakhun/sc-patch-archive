# Item-Finder — Rüstungs-Sets, NPC-Träger & Fundorte (Entscheidungsgrundlage)

**Stand:** 25.07.2026 · **Live-Patch:** `sc-alpha-4.9.0` (Data.p4k mtime 24.07.2026, 147 GB)
**Frage:** Können wir einen Rüstungs-Set-Finder bauen? Können wir sagen, welcher NPC welche Rüstung trägt und wo er spawnt? Welche Nicht-NPC-Quellen gibt es?
**Methode:** direkte Messung gegen die live installierte `Data.p4k` über `scripts/lib/datacore.mjs` + `scripts/lib/p4k.mjs`, dazu ein neu geschriebener CryXmlB-Parser für die Loadout-XMLs. **Alle Zahlen unten sind gemessen, nicht geschätzt.**

> Ergänzt [item-finder-datacore-deep-dive.md](item-finder-datacore-deep-dive.md) (Tier 1–4, umgesetzt 23.07.). Dort ging es um *Stats pro Item*, hier um *Beziehungen zwischen Items* (Set, Träger, Fundort).

> **Umsetzungs-Stand (25.07.2026): Stufe 1 + 2 GEBAUT** (Branch `claude/item-finder-armor-sets-3e5098`, Build grün, im Preview DE+EN verifiziert).
> Neu: `scripts/lib/tags.mjs`, `scripts/lib/armor-sets.mjs`, Tag-Facetten + Set-Auflösung in `datamine-items.mjs`, Durchreichen in `build-universal-db.mjs`, Filter „Panzerungsklasse"/„Seltenheit" + Set-Block im Finder, Set-Sektion auf den Item-Datenblättern, neue Seite `/armor-sets.html` (DE+EN, 136 Sets).
> Ebenfalls in diesem Zug: die **289 widerlegten Fundort-Zeilen entfernt** (§4.2) und durch die echte Bezugsart ersetzt. **Stufe 3 (Träger + Loot-Kette) steht noch aus.**

---

## 0. Kurzverdikt

| Frage | Antwort |
|---|---|
| **Set-Finder möglich?** | **Ja — aber nur aus drei Quellen kombiniert.** Die Set-Taxonomie `Armor.FPS.Set.<Hersteller>.<Set>` (64 Sets, 75,5 %) ist **allein nicht verlässlich**: sie hat Lücken und echte Fehl-Tags. Gegenprobe über Dateistamm + `_short`-Namensschlüssel nötig — siehe §2.3. |
| **Gewichtsklasse (Light/Medium/Heavy)?** | **Ja, 100 % Abdeckung.** Steht heute nirgends im Finder. Größter Einzelgewinn. |
| **Seltenheit?** | **Ja, 92,7 %** der Ausrüstung trägt `LootGeneration.LootRarity` (Common → Legendary). |
| **„NPC X trägt Rüstung Y"?** | **Ja, bewiesen** — Kette NPC → Loadout-XML → Item vollständig aufgelöst (2.265/2.266 XMLs geparst). |
| **„NPC X spawnt bei Y"?** | **Nein, nicht aus den Spieldateien.** Die Belegung ist serverseitig/Laufzeit — belegt, nicht vermutet (§5). *Der Finder zeigt heute trotzdem Fundorte* — aus einer handkuratierten, ungeprüften Datei; Qualitätsmessung in §4.1. |
| **Nicht-NPC-Quellen?** | **Teilweise.** Loot-Tabellen sind tag-getrieben und auflösbar; Ortstyp ja, Ortsname nein. |

---

## 1. Ist-Zustand des Finders (gemessen an `assets/universal-items.json`, Stand 23.07.)

| Kennzahl | Wert |
|---|---|
| Items gesamt | 9.788 |
| davon mit Bezugsquelle (`obtain`) | 4.254 |
| davon reine Katalog-Einträge | 5.534 |
| mit Spieldaten (`game`-Block) | 6.642 · davon mit Stats 3.501 |
| **Kategorie „Armour"** | **2.489** — mit Shop-Zeile nur **814 (32,7 %)**, mit Loot-Zeile 1.286, ganz ohne Quelle 468 |

**Was komplett fehlt:** Set-Zugehörigkeit, Gewichtsklasse, Seltenheit, Farbvariante, Träger-NPC, Loot-Herkunft. Alles davon liegt in den Spieldaten bereit.

---

## 2. Die Tag-Datenbank — der bisher ungenutzte Schatz

Der DataCore enthält **18.845 `Tag`-Records** in einem echten Baum (`tagName` + `children`), 66 Wurzeln. Items referenzieren Tags über `EntityClassDefinition.tags[]`. **Der Finder nutzt davon heute 0 %.**

Abdeckung über **4.922 benannte Gear-Items** (Rüstung + Kleidung + FPS-Waffen): **95,3 % tragen mindestens einen Tag.**

### 2.1 `Armor.FPS.Set` — die Set-Taxonomie (122 Knoten)

Zweistufig **Hersteller → Set**, genau wie im Spiel benannt:

| Hersteller | Sets |
|---|---|
| ClarkeDefense | A23, ADP, ADP-mk4, Balor, CBH-3, FBL-8a, FBL-8u, FieldRecon, G-2, G-8, ORC-mkV, ORC-mkX, PAB-1, TCS-4 |
| KastakArms | Calico, Citadel, Citadel-SE, Defiance, DustUp, Fortifier, Inquisitor, Lynx, Microid, Morningstar, Oracle, Renegade, Scaleweave, Stoneskin |
| RSI | Beacon, Caudillo, Horizon, MacFlex, Odyssey, OdysseyII, RustSociety, Venture, Zeus |
| Caldera | Novikov, Pembroke, Stirling |
| Virgil | Argus, ForceFlex, Paladin, TrueDef |
| Greycat | Aril (BlackCherry/Harvester/Hazard/Quicksilver), Strata |
| QuirinusTech | Sabine, Calva, Antium |
| Doomsday | Clash, Overlord |
| CCsConversions | Aves (Shrike/Talon), Fieldsbury, HillHorror, Lamont, Neoni, Parasite, SnarlingVanduul |
| weitere | UBA.Prison, Scavenged, Novelty, Tehachapi.Aztalan, SakuraSun.Mandible |

**Messung:** 2.344 benannte Rüstungsteile (ohne Platzhalter) → **1.770 (75,5 %) mit Set-Tag**, verteilt auf **64 Set-Pfade**, davon **16 Sets mit allen vier Kernslots** (Helm/Core/Arme/Beine).

Abdeckung je Slot: Arme 83 %, Beine 80 %, Undersuit 82 %, Core 74 %, Helm 73 %, **Rucksack nur 27 %**.

Größte Sets: RSI.Venture (145 Teile), KastakArms.Lynx (129), KastakArms.Inquisitor (87), ClarkeDefense.ORC-mkV (87), ClarkeDefense.PAB-1 (80), Greycat.Strata (77).

> Die hohen Teilezahlen sind **Farbvarianten** desselben Teils („Venture Legs Seagreen", „… Lovestruck", …). Für die UI heißt das: Set → Slot → Farbvariante ist die richtige Hierarchie, nicht eine flache Liste.

### 2.2 Weitere Facetten (alle heute ungenutzt)

| Tag-Zweig | Werte | Abdeckung |
|---|---|---|
| **`Armor.FPS.Type`** | Undersuit, Light, Medium, Heavy, SuperHeavy, FullSuit (→ EnvironmentSuit, ColdSuit, HeatSuit, EVASuit, RadiationSuit), Flightsuit | **100 %** der Rüstungsteile |
| `Armor.FPS.Part` | Helmet, Arms, Core, Legs, Backpack, FullBody | hoch |
| `Armor.FPS.Archetype` | Combat, HeavyCombat, Support, Specialist, Utilitarian | teilweise |
| `Armor.FPS.Specialization` | Medic, Sniper | selten |
| `Armor.FPS.Faction` | XenoThreat | selten |
| **`LootGeneration.LootRarity`** | Common 3.429 · Uncommon 587 · Rare 470 · Epic 75 · Legendary 2 | **92,7 %** der Gear-Items |
| `Global.Color` | Farbvariante | vorhanden, Werte noch nicht ausgewertet |
| `Clothing.Type` / `.Style` / `.Purpose` | Jacket/Boots/…, Business/Military/Racing/…, Formal/Sport/Work | Kleidung (55 Knoten) |

**`Armor.FPS.Type` mit 100 % Abdeckung ist der größte Einzelgewinn** — „zeig mir alle schweren Rüstungen" ist heute unmöglich und wäre danach ein Ein-Klick-Filter.

### 2.3 ⚠ Der Set-Tag allein reicht NICHT — zwei weitere Spuren nötig

Gegenprobe am Praxisfall **Dust Devil** (6 Teile: Arme/Core/Beine × 2 Ausführungen, kein Helm):

| Teil | Datei | Set-Tag |
|---|---|---|
| Dust Devil Armor Legs | `srvl_armor_heavy_legs_02_01_01` | **`Doomsday.Overlord`** ← falsch |
| Dust Devil Legs Epoque | `srvl_armor_heavy_legs_02_02_01` | **`Doomsday.Overlord`** ← falsch |
| Dust Devil Armor Arms / Core, … Epoque | `srvl_armor_heavy_{arms,core}_02_*` | **kein Tag** |

Ein rein tag-basierter Set-Finder würde „Dust Devil Legs" also unter **Doomsday Overlord** einsortieren und die anderen vier Teile gar nicht zuordnen. Das ist ein Datenfehler bei CIG, kein Extraktionsfehler.

**Spur 2 — Dateistamm.** Slot-Wort und Varianten-Ziffern aus dem Dateinamen streichen ⇒ `srvl_armor_heavy#02` gruppiert alle 6 Dust-Devil-Teile korrekt. Gemessen: **1.979/2.344 Teile (84,4 %) haben einen ableitbaren Stamm**, ergibt **167 Gruppen**.

**Spur 3 — `_short`-Namensschlüssel.** `global.ini` führt 715 `item_name*_short`-Schlüssel; sie tragen den **Set-Anzeigenamen**:

```
item_name_srvl_armor_heavy_armor_02_short   = Dust Devil
item_name_outlaw_legacy_armor_medium_armor_01_short = Inquisitor
item_name_rrs_specialist_heavy_armor_01_short       = Morozov-SH
```

Über den Stamm auf die Gruppen gejoint: **30 Gruppen erhalten so einen sauberen Set-Namen (841 Teile, 35,9 %)**. Bilanz gegen den Tag:

| Fall | N | Bedeutung |
|---|---|---|
| Tag passt zum `_short`-Namen | 11 | bestätigt |
| **`_short` liefert ein Set, das der Tag gar nicht kennt** | **14** | Morozov-SH/-CH/-SH-I/-CH-I, Palatino, Chiron, Outback, Arden-SL, Wrecker, Carrion, Piecemeal, Geist, Cataby, Sinkhole |
| Tag nur auf Hersteller-Ebene (unschärfer) | 3 | Testudo/Artimex/Bokto → nur `QuirinusTech` |
| Namensvariante | 1 | `TruDef-Pro` ↔ Tag `Virgil.TrueDef` |
| **echter Widerspruch** | **1** | **Dust Devil → `Doomsday.Overlord`** |

**Konsequenz für den Bau:** Set-Zuordnung als **Dreier-Kette** — Dateistamm gruppiert, `_short` benennt, Tag ergänzt Hersteller-Hierarchie und dient als Gegenprobe. Bei Widerspruch gewinnen Stamm + `_short`; abweichende Tags gehören ins Build-Log, nicht in die UI. Gruppen ohne `_short` behalten den Tag-Namen, Gruppen ohne beides bleiben ehrlich „keinem Set zugeordnet".

---

## 3. „Welcher NPC trägt welche Rüstung?" — bewiesen auflösbar

Es gibt **zwei NPC-Familien** mit unterschiedlicher Mechanik:

### 3.1 Familie A — `NPC_Archetypes-*` (1.457 Records): **deterministisch**

Kette: `EntityClassDefinition` → `SEntityComponentDefaultLoadoutParams.loadout` → `SItemPortLoadoutOutfitParams` → `loadoutPath` → **CryXmlB-Datei im p4k** → `<Item portName itemName tag>` → Item-Record.

**Messung:** 2.266 Loadout-XMLs unter `Data/Scripts/Loadouts/Character/Human/{Armor,Clothing}/NPC/`, davon **2.265 erfolgreich geparst** (ein neuer, verifizierter CryXmlB-Parser, ~40 Zeilen). **1.425/1.457 Archetypen** tragen einen Loadout-Pfad; **200 davon führen Rüstung** (der große Rest sind Zivilisten mit Kleidung — über dieselbe Kette ebenfalls auflösbar).

Verifiziertes Beispiel:

```
NPC_Archetypes-Male-Human-Pirate-Bunker_Outlaw_Medium_02
  [Undersuit] Venture Undersuit Tan/Brown   set=RSI.Venture          type=Undersuit  rar=Common
  [Arms     ] Inquisitor Arms Red           set=KastakArms.Inquisitor type=Medium    rar=Uncommon
  [Helmet   ] DustUp Helmet Desert          set=KastakArms.DustUp     type=Medium    rar=Common
  [Legs     ] MacFlex Legs Sienna           set=RSI.MacFlex           type=Light     rar=Common
  [Torso    ] MacFlex Core Tan              set=RSI.MacFlex           type=Light     rar=Common
```

> **Wichtiger Ehrlichkeitsbefund:** NPCs tragen **gemischte** Sets, nicht komplette. Eine UI-Aussage „NPC trägt Set X" wäre falsch — korrekt ist eine Teile-Liste pro NPC.

### 3.2 Familie B — `PU_*`-Akteure (700 Records): **probabilistisch**

Diese nutzen statt fester XML-Pfade **`SLoadoutAssortment`** (321 Records): `GroupedLoadouts[].Group` (z. B. `PrimaryWeapon`) → `Loadouts[]` → weitere Assortments. **1.069 EntityClassDefinitions referenzieren Assortments.**

Beispiel: `PU_Human-Xenothreat-Grunt-Male-Heavy_01_Sniper` → Bundle `Xenothreat_sniper` (+ Basis-Bundle `Bodies_Generic_01`, + Inventar `crlf_consumable_healing_01`).

Verzeichnis = **Fraktion/Region**:

| Verzeichnis | N | | Verzeichnis | N |
|---|---|---|---|---|
| pyro | 198 | | ninetails | 28 |
| crusader | 98 | | dusters | 14 |
| populace | 75 | | hurston | 10 |
| distrohubs | 55 | | area18 | 6 |
| pu_pilots | 52 | | blacjac / outlaws | je 4 |
| xenothreat | 29 | | microtech | 28 |

> Hier ist die korrekte Aussage **„kann tragen"**, nicht „trägt" — das Bundle würfelt zur Laufzeit. Muss in der UI so formuliert werden.

---

## 4. Nicht-NPC-Quellen

| Quelle | Datenlage | Bewertung |
|---|---|---|
| **Shops** | UEX (serverseitig, nicht minebar) — deckt **32,7 %** der Rüstung ab | unverändert beste Quelle, nichts zu verbessern |
| **Loot-Container** | 161 `LootTable` + 233 `LootArchetype`. **Tag-getrieben**, nicht itemweise: `primaryOrGroup.entries[].tag` + `positiveTags`/`negativeTags`/`excludedTags`. Über die Item-Tags aus §2 **auflösbar zu konkreten Items** | mittlerer Aufwand, hoher Wert |
| **Container-Platzierung** | `SubHarvestableMultiConfigRecord` (518 Referenzen) + `SubHarvestableConfigRecord` (132) — z. B. `DistributionCentre_MultiConfig`, `LootGeneration_MultiSlotPreset_UGFs`, `…_ShippingContainer_JustBoxes` | gibt **Ortstyp**, keinen Ortsnamen |
| **Loot-Table-Namen** | tragen den Ortstyp selbst: `UGF_Rare`, `DerelictCommon/UnCommon/Rare`, `SecurityOutpost_Loot`, `LootTable_B_Weapon_02` (Contested Zone), `Prison_*`, `LootTable_NPC_CZ_Soldier_001` | direkt nutzbar |
| **Crafting** | 1.598 `CraftingBlueprintRecord` — bereits im Repo als Crafting-DB | nur verlinken |
| **Missionen** | 2.584 `MissionBrokerEntry` (cargo 869, mercenary 353, infiltrateanddefend 309, delivery 258, …), `MissionReward`-Structs | Belohnungen prüfenswert, nicht gemessen |
| **Wikelo** | eigene Seite vorhanden | nur verlinken |

---

## 4.1 ⚠ Der Finder zeigt schon Fundorte — aber aus einer ungeprüften Quelle

**Wichtige Abgrenzung:** Der Finder zeigt heute bereits Zeilen wie „Dust Devil Armor Core → Maker's Point, Picker's Field, Rappel (Hurston), Weeping Cove". Diese stammen **nicht** aus den Spieldateien, sondern aus `src/data/loot-items.json` (493 KB, 1.367 Item-Einträge) — einer **handkuratierten Recherchedatei**, angelegt im Commit „Item Finder: echte Daten statt fabrizierter Werte".

### Qualitätsmessung der Datei selbst

| Kennzahl | Wert | Bewertung |
|---|---|---|
| Item-Einträge | 1.367 | |
| **distinkte Orte** | **70** | für 1.367 Items |
| **distinkte Guide-Texte** | **46** | stark schabloniert |
| „Dead NPC Mercenaries" | **848 Items** | Sammelbegriff, kein Ort |
| „Red Bunker Crates" | **834 Items** | Sammelbegriff, kein Ort |
| meistgenutzter Guide-Text | **272×** identisch | + 197× / 189× / 176× je Slot |

Vier Textbausteine decken ~830 Items ab. Das ist **kein pro-Item recherchiertes Wissen**, sondern eine Schablone nach Slot.

### Abgleich gegen die Spieldaten

Träger-Index über **2.302 Actor-Entities** (1.728 via XML-Loadout + 515 zusätzlich via Bundles) ⇒ **2.915 Items werden nachweislich von NPCs getragen**.

| Prüfung | Ergebnis |
|---|---|
| Einträge, die einen NPC-Drop behaupten | 1.144 |
| **davon durch ein echtes NPC-Loadout bestätigt** | **480 (42,0 %)** |
| **kein einziger NPC trägt das Item** | **566 (49,5 %)** |
| Item nicht auffindbar | 98 |
| **Gegenrichtung: real getragene Items, die in der Datei komplett FEHLEN** | **1.740** |

> **Fair bleiben:** „Kein NPC trägt es" ist *kein* Beweis, dass die Angabe falsch ist — Container-Loot läuft tag-basiert (§4), ein Item kann legitim aus einer Kiste kommen, ohne dass ein NPC es trägt (Dust Devil ist genau so ein Fall). Die 566 sind also **ungeprüfte Behauptungen**, nicht widerlegte. Belastbar ist dagegen: **1.740 nachweisbare Träger-Beziehungen fehlen heute komplett**, und die Ortsangaben sind zu 60 % Sammelbegriffe.

### Konsequenz

Es gibt damit **drei Fundort-Klassen** mit unterschiedlicher Belastbarkeit — die UI sollte sie unterscheiden statt sie zu vermischen:

| Klasse | Quelle | Belastbarkeit |
|---|---|---|
| **Kaufbar** | UEX (live) | hart, mit Preis |
| **Getragen von** | Spieldateien (NPC-Loadouts, §3) | hart, 2.915 Items |
| **Loot-Kategorie** | Spieldateien (LootTable→Tags, §4) | hart, aber nur Ortstyp |
| *Community-Hinweis* | `loot-items.json` | **weich** — als Hinweis kennzeichnen, nicht als Fakt |

Die Spieldaten können die kuratierte Datei also **verifizieren und massiv erweitern** (1.740 fehlende Beziehungen), statt sie zu ersetzen.

## 4.2 Loot-Kette: durchgemessen, funktioniert — mit einer Semantik-Falle

Kette `LootTable → LootArchetype → Tags → Items` vollständig implementiert und gemessen.

**Die Falle:** Ein naiver erster Durchlauf (alle Gruppen als ODER, Tag-Match über den ganzen Teilbaum) lieferte Unsinn — „Dust Devil Armor Legs" landete in 136 Tabellen inkl. `Tools`, `Food` und `Medical`, weil Wurzel-Tags im Teilbaum-Match alles trafen. **Korrekte Semantik:**

- **ODER innerhalb** einer Gruppe (`primaryOrGroup.entries[]`),
- **UND zwischen** `primaryOrGroup` und **jeder** `secondaryOrGroups`-Gruppe,
- Tag-Match **exakt**, nicht über den Teilbaum,
- `additionalTags.negativeTags` und `excludedTags` als Ausschluss.

**Ergebnis nach Korrektur** (plausibel: `Medical` 14, `Tools` 36, `Drugs` 6, `Consumables` 17, `Container_Heavy_Armour_Common` 402):

| Kennzahl | Wert |
|---|---|
| LootArchetypes auflösbar | 165 / 233 |
| LootTables auflösbar | 128 / 161 |
| **Rüstungsteile über eine LootTable erreichbar** | **2.001 / 2.344 (85,4 %)** |
| Items gesamt über LootTables | 3.308 |

**Ortstyp kommt aus den Nutzern der Tabelle** — `SubHarvestableConfigRecord`-Slot-Presets tragen ihn im Dateinamen: `_ugfs`, `_caves`, `cave_aberdeen_{poor,medium,rich}`, `_kareah`, `_jumptown`, `_spacederelict`, `_junksites`, `_colonialoutpost_{outlaw,indy}`, `_techoutpost`, `_covalex`, `_station`, `_shippingcontainer`, `_floatingislands`. Dazu Leichen-Entities (`mission_entities/corpse_ninetails_medium_01`, `corpse_security_crusader`, `corpse_shatteredblade`).

### Durchstich Dust Devil

| Teil | Loot-Tag | Konsequenz |
|---|---|---|
| Dust Devil Armor Arms / Core / Legs | `LootGeneration.CanGenerateAsLoot` | lootbar |
| Dust Devil Arms / Core / Legs **Epoque** | **`CannotGenerateAsLoot.PromotionalItem`** | **kann gar nicht droppen** |

Die lootbaren drei erscheinen in `LootArchetype_Container_Heavy_Armour_{Common,Uncommon,Rare}` + `ArmorCache_Common` → Tabellen `Military`, `Armor`, `Armor_Survival`, `Armor_Jumptown`, `LootTable_Container_Armour_{Medium,Large}_*` → Presets u. a. UGFs, Höhlen (Aberdeen), Kareah, Jumptown, Shipping-Container, Tech-Outpost.

`loot-items.json` gibt dagegen **allen sechs** Teilen dieselben vier Orte — für drei davon ist das nachweislich falsch.

### Harter Widerlegungs-Filter (neu verfügbar)

Der Tag `LootGeneration.CannotGenerateAsLoot.*` ist eine **beweisbare** Gegenprobe:

| Loot-Erzeugbarkeit (distinkte Item-Namen) | N |
|---|---|
| `CanGenerateAsLoot` | 3.666 |
| **`CannotGenerateAsLoot`** | **691** — davon PromotionalItem 316, (generisch) 159, InGameReward 102, Wikelo 44, Concierge 15, GoblinGathering 15, SubscriberFlair 11, Luminalia 10, TwitchDrop 8, ReferralProgram 8, CleanAir 3 |
| ohne Angabe | 3.456 |

Angewandt auf `loot-items.json` (1.367 Einträge mit Fundort-Behauptung):

| | N |
|---|---|
| Item ist lootbar | 877 |
| **nachweislich WIDERLEGT** | **289** |
| keine Angabe im Spiel | 201 |

Beispiele: *ADP-mk4 Helmet Exec* (Concierge-Belohnung) → „Hurston Security Depot 1"; *Artimex Helmet Starchaser* (Promo) → „Hurston Distribution Centers"; alle drei *Dust Devil … Epoque* (Promo) → „Rappel / Picker's Field". Diese 289 Zeilen schicken Spieler auf eine Farm-Jagd nach Items, die dort **nie** fallen können.

---

## 5. Die harte Grenze: Spawn-Orte

**Frage:** „Dieser NPC spawnt da und da." → **Nicht aus den Spieldateien beantwortbar.** Zwei unabhängige Messungen belegen das:

1. **Im DataCore werden nur 33 von 1.457 NPC-Archetypen überhaupt referenziert** — und zwar von `CommsNotification` (546), `MissionGiver` (8), `CrewManifest` (6). Es gibt **keine** Archetyp→Ort-Zuordnung.
2. **In den Level-Daten steht sie auch nicht.** Geprüft: 9.614 `.socpak` (davon 6.251 unter `PU/loc`: station 1.505, outpost 1.095, derelict 794, ugf 739, cave 315, fob 160, prison 14, sewers 8). Jedes socpak ist ein ZIP mit `.soc` (CrChF-Chunk-Format), `.entxml`, Geometrie, Cubemaps. In den entpackten `.soc`-Dateien finden sich `loadoutPath`-Einträge — aber **nur für Türen** (`DoorHighTechLoadout.xml`) und **Leichen** (`…/Corpses/Explorer_Chief_Eng_Frozen-001.xml`). Spawn-Closets erscheinen ausschließlich als **Geometrie- und Lichtnamen** (`spawncloset_lrg_narrow_001`, `lt_stm_light_entrance_spawncloset_acnt_1000k-001`) — es gibt keine Belegungsliste.

**Grund:** Spawn-Closets sind Marker; *welcher* Archetyp dort erscheint, entscheidet der PopulationManager bzw. das Missionssystem **zur Laufzeit auf dem Server** (analog zu den Shop-Preisen). Der Tag-Baum bestätigt das mit `AI.Spawning.Identifier.LevelMarkup.SpawnCloset` und der Wurzel `PopulationManager`.

### Was stattdessen ehrlich geht

| Ersatzaussage | Quelle | Beispiel |
|---|---|---|
| **Fraktion** | Verzeichnis der `PU_*`-Akteure + `AI.Faction.*`-Tag am NPC | „XenoThreat", „Ninetails", „Pirates" |
| **Region** | Verzeichnis (pyro / crusader / microtech / hurston / area18) | „Pyro-Fraktionen" |
| **Ortstyp** | Dateipfad der Archetypen | `pirates/bunker_outlaw_*`, `civilians/area18`, `…/orison`, `…/newbabbage`, `…/lorville`, `…/grimhex`, `…/levski`, `…/reststop`, `…/cave`, `…/outpost` |
| **Ortstyp (Loot)** | Loot-Table-Name + Container-Preset | „Untergrund-Anlagen (UGF)", „Derelicts", „Sicherheits-Außenposten", „Contested Zone", „Verteilzentrum" |
| **Rolle** | `Subsumption.Job.*`-Tag | `Security.Sentry`, `Armourer` |

Formulierung in der UI also: **„Getragen von: Bunker-Outlaws (Piraten, mittlere Ausrüstung)"** statt „spawnt bei Koordinate X". Das ist belegbar und für Spieler trotzdem der nützliche Teil.

---

## 6. Optionen (nach Aufwand/Nutzen)

### Stufe 1 — Facetten-Ausbau (klein, sofort spürbar)
Tags aus §2 in `datamine-items.mjs` mitziehen → `set`, `weight` (Light/Medium/Heavy/…), `part`, `rarity`, `archetype`, `color`.
Finder bekommt: Filter „Gewichtsklasse", Filter „Seltenheit", Badge am Item, Sortierung nach Seltenheit.
**Abdeckung: Gewicht 100 %, Seltenheit 92,7 %.** Kein neues Format, kein neuer Parser.

### Stufe 2 — Set-Finder (mittel, das eigentliche Feature)
Set-Zuordnung als **Dreier-Kette** nach §2.3 (Dateistamm gruppiert · `_short` benennt · Tag ergänzt/prüft), **nicht** rein tag-basiert.
Neue Ansicht „Rüstungs-Sets": ~167 Stamm-Gruppen, davon 64 über Tags und 30 über `_short` benannt, gruppiert Hersteller → Set → Slot → Farbvariante. Je Set: Vollständigkeitsanzeige (welche der 4 Kernslots existieren), aggregierte Resistenzwerte (schon vorhanden aus Tier-3), Preisspanne aus UEX, Direktlinks auf die bestehenden statischen Item-Seiten.
Am Item: „Teil des Sets **X** — 3 weitere Teile".
**Voraussetzung: Stufe 1.**

### Stufe 3 — Träger & Fundorte (mittel-groß, höchster „Wow"-Faktor)
CryXmlB-Parser als `scripts/lib/cryxml.mjs` (geschrieben und verifiziert, 2.265/2.266). Neuer Extraktor `datamine-npc-loadouts.mjs`:
- Familie A deterministisch → „getragen von" pro Item,
- Familie B über Assortments → „kann getragen werden von",
- Loot-Tabellen über Tag-Auflösung → „findbar in: UGF / Derelict / Sicherheits-Außenposten / Contested Zone".
Am Item ein Block **„Woher"**: Kaufen (UEX) · Loot (Ortstyp) · Träger (Fraktion/Rolle) · Crafting (vorhandener Link).

### Was der Bau gegenüber der Analyse geändert hat

Die Dreier-Kette aus §2.3 reichte in der Praxis **nicht** — beim Bau gemessen und nachgebessert:

1. **Der Dateistamm ist stellenweise zu grob.** `qrt_combat_heavy#02` enthält „Ana"- **und** „Bokto"-Teile, `cds_combat_light#02` „FBL-8a" und „CSP-68L", `clda_utility_heavy#03` „Stirling" und „Siebe". Ohne Gegenmaßnahme landen zwei Sets in einem. **Lösung:** innerhalb einer Stamm-Gruppe nach dem führenden Wort der Anzeigenamen clustern; der gemeinsame Wort-Präfix (ohne Slot-Wort) benennt den Cluster. 27 der 201 Gruppen mussten so geteilt werden.
2. **Ein Set liegt oft auf mehreren Stämmen** — „Venture" kam zweimal (77 + 37 Teile). **Lösung:** Cluster mit gleichem normalisierten Namen zusammenführen.
3. **Einzel-Teile brauchen den Tag.** Bei einem Cluster mit nur einem Teil ist der „gemeinsame Präfix" der ganze Item-Name („Sangar Helmet (Modified)" als Set-Name). **Lösung:** ab 2 Teilen gewinnt der Präfix, bei 1 Teil der game-authored Tag. Zusätzlich werden 1–2-Teil-Cluster in den größten Cluster mit demselben Set-Tag absorbiert (28 Fälle).

**Ergebnis:** 136 Sets, **2.198 von 2.268 Rüstungsteilen zugeordnet (96,9 %)**, 35 Sets mit allen vier Kernslots, nur noch 1 heterogene Gruppe. 46 Tag-Widersprüche landen im Build-Log.

Nebenbefunde, im selben Zug behoben:
- **DE-Namen enthielten sichtbare Fehlerstrings** (`! GERMAN_(GERMANY) TRANSLATION NOT FOUND FOR LOCID: … !`) — der Filter in `datamine-items.mjs` kannte das Muster nicht. Betraf alle DE-Item-Seiten, nicht nur die neuen.
- **Meta-Descriptions zeigten interne Typnamen** („Heavy Char_Armor_Torso"). Jetzt steht dort die lesbare Kategorie.
- **`acquisition()` zählte Exklusiv-Zeilen als Fundort** → „1 bekannter Fundort" über einem Promo-Item. Eigener Modus `exclusive`.
- **`_sync-assets.mjs` kopierte die `*-gamefiles.json` mit aus** (~9 MB Build-Eingaben in `dist`, die zur Laufzeit niemand lädt und die in CI gar nicht existieren). Jetzt ausgefiltert.

### Entschieden (25.07.2026)

1. **Die 289 widerlegten Fundort-Zeilen fliegen raus** (harter Filter `CannotGenerateAsLoot`, §4.2) und werden durch die echte Bezugsart ersetzt („Promo-Gegenstand", „Concierge-Belohnung", „Wikelo", „Twitch-Drop", „Abo-Flair"). Die restlichen ungeprüften Zeilen **bleiben**, aber sichtbar degradiert als *Community-Hinweis* — sie sind nicht widerlegt, und für 468 Rüstungsteile ohne Shop-Preis sind sie die einzige Information.
2. **Alle drei Stufen bauen, in zwei PRs:** PR A = Stufe 1 + 2 (Facetten + Set-Finder, in sich versandfähig), PR B = Stufe 3 (Träger + Loot-Kette + Bereinigung).
3. **Loot-Kette ist gemessen und tragfähig** (85,4 % der Rüstung), inkl. Ortstyp aus den Slot-Presets. Semantik-Falle aus §4.2 beim Bau zwingend beachten.

### Nicht bauen
- „Spawnt an Ort X" (§5) — nicht in den Daten, wäre geraten.
- Set-Tags für Kleidung und FPS-Waffen: **0 % Abdeckung**, gibt es schlicht nicht.
- Rucksack-Sets: nur 27 % — als lückenhaft kennzeichnen, nicht auffüllen.

---

## 7. Vorbehalte

1. **`items-gamefiles.json` fehlt lokal** (gitignored) → vor jedem Bau `npm run datamine:items` (Data.p4k liegt vor, 4.9.0).
2. **Preise bleiben UEX**, Stand 23.07. — [[data-provenance-hidden]] beachten: UEX-Attribution behalten, Spieldateien-Herkunft nicht im UI benennen.
3. **NPC-Loadouts sind gemischt** — nie „trägt Set X" behaupten (§3.1).
4. **Bundles sind Wahrscheinlichkeiten** — Formulierung „kann tragen" (§3.2).
5. **Set-Abdeckung ist 75,5 %, nicht 100 %** — Items ohne Set-Tag brauchen einen ehrlichen Zustand („keinem Set zugeordnet"), keine Namens-Heuristik.
5b. **Set-Tags enthalten echte Fehler** (§2.3, Dust Devil → Doomsday.Overlord). Nie ungeprüft als einzige Quelle nutzen. Der Build muss Tag-vs-`_short`-Abweichungen loggen, damit neue Fehl-Tags nach einem Patch auffallen.
6. **Patch-Volatilität:** Tag-GUIDs sind stabil, Tag-*Namen* können sich ändern. Der Extraktor sollte über den Pfad (`Armor.FPS.Set.…`) auflösen und beim Bau die Set-Anzahl loggen, damit ein Einbruch auffällt.
