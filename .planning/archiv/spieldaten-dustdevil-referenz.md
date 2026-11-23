# ALLES zu Dust Devil — aus Data.p4k (Stand 29.07.2026, Patch 4.9)

> Erzeugt von [`scripts/probes/dustdevil-all.mjs`](../scripts/probes/dustdevil-all.mjs).
> Zweck: an **einem** Item durchspielen, wie weit die Spieldaten tatsächlich tragen —
> als Messlatte für die geplante Spieldaten-Datenbank.
>
> Das wichtigste Ergebnis steht nicht in einer Tabelle, sondern ist eine Grenze:
> **Fundorte sind aus den Spieldaten nicht ableitbar.** Typ, Kategorie, Werte, Hersteller
> und Bauplan-Verkettung stehen drin; *wo* ein Item auftaucht, entscheidet der
> PopulationManager zur Laufzeit. Jede Fundort-Angabe auf der Seite ist deshalb kuratiert,
> nicht extrahiert — und muss als solche behandelt werden.


==============================================================================
## Dust Devil Armor Core   [srvl_armor_heavy_core_02_01_01]
==============================================================================
Datei: libs/foundry/records/entities/scitem/characters/human/armor/pu_armor/heavy/core/srvl_armor_heavy_core_02_01_01.xml

### Namen
  EN : Dust Devil Armor Core
  DE : — (keine dt. Übersetzung)
  Beschreibung DE: — (fehlt)

### Kernwerte
  Masse        : 7 kg
  Größe / Grade: 1 / 1
  Typ          : Char_Armor_Torso / Heavy
  Hersteller   : —

### Schadenswiderstände (Multiplikator; niedriger = besser)
  Physical      : ×0.6
  Energy        : ×0.6
  Distortion    : ×0.6
  Thermal       : ×0.6
  Biochemical   : ×0.6
  Stun          : ×0.4
  Nahkampf ignoriert: false

### Temperatur
  Aushaltbar: -85 °C bis 115 °C

### Strahlung
  Kapazität: 26800 | Abbaurate: 145.8/s

### Geschützte Körperteile
  [{"partHealthStat":"HealthTorso","partWearStat":"WearTorso","jointName":"Torso"}]

### Stauraum
  "microSCU":10500

### Anbauplätze (16)
  - wep_stocked_2  (Size 2–4)
  - wep_stocked_3  (Size 2–5)
  - magazine_attach_1  (Size 1–1)
  - magazine_attach_2  (Size 1–1)
  - magazine_attach_3  (Size 1–1)
  - magazine_attach_4  (Size 1–1)
  - magazine_attach_5  (Size 1–1)
  - magazine_attach_6  (Size 1–1)
  - magazine_attach_7  (Size 1–1)
  - magazine_attach_8  (Size 1–1)
  - grenade_attach_1  (Size 1–1)
  - grenade_attach_2  (Size 1–1)

### Tags (12)
  · Item.Small.SuitArmor.Heavy
  · Item.Small.SuitArmor.Core
  · LootGeneration.LootRarity.Common
  · Armor.FPS
  · Armor.FPS.Type.Heavy
  · Armor.FPS.Part.Core
  · Global.Race.Human
  · Global.Manufacturer
  · Armor.FPS.Set
  · Global.Color.Red
  · Item.Interactions.ReceiveParentActorInteractions
  · LootGeneration.CanGenerateAsLoot

==============================================================================
## Dust Devil Armor Arms   [srvl_armor_heavy_arms_02_01_01]
==============================================================================
Datei: libs/foundry/records/entities/scitem/characters/human/armor/pu_armor/heavy/arms/srvl_armor_heavy_arms_02_01_01.xml

### Namen
  EN : Dust Devil Armor Arms
  DE : — (keine dt. Übersetzung)
  Beschreibung DE: — (fehlt)

### Kernwerte
  Masse        : 6 kg
  Größe / Grade: 1 / 1
  Typ          : Char_Armor_Arms / Heavy
  Hersteller   : —

### Schadenswiderstände (Multiplikator; niedriger = besser)
  Physical      : ×0.6
  Energy        : ×0.6
  Distortion    : ×0.6
  Thermal       : ×0.6
  Biochemical   : ×0.6
  Stun          : ×0.4
  Nahkampf ignoriert: false

### Temperatur
  Aushaltbar: -85 °C bis 115 °C

### Strahlung
  Kapazität: 26800 | Abbaurate: 145.8/s

### Geschützte Körperteile
  [{"partHealthStat":"HealthRightArm","partWearStat":"WearRightArm","jointName":"RightArm"},{"partHealthStat":"HealthLeftArm","partWearStat":"WearLeftArm","jointName":"LeftArm"}]

### Tags (11)
  · Item.Small.SuitArmor.Heavy
  · LootGeneration.LootRarity.Common
  · Armor.FPS
  · Armor.FPS.Type.Heavy
  · Armor.FPS.Part.Arms
  · Global.Race.Human
  · Global.Manufacturer
  · Armor.FPS.Set
  · Global.Color.Red
  · Item.Interactions.ReceiveParentActorInteractions
  · LootGeneration.CanGenerateAsLoot

==============================================================================
## Dust Devil Armor Legs   [srvl_armor_heavy_legs_02_01_01]
==============================================================================
Datei: libs/foundry/records/entities/scitem/characters/human/armor/pu_armor/heavy/legs/srvl_armor_heavy_legs_02_01_01.xml

### Namen
  EN : Dust Devil Armor Legs
  DE : — (keine dt. Übersetzung)
  Beschreibung DE: — (fehlt)

### Kernwerte
  Masse        : 8 kg
  Größe / Grade: 1 / 1
  Typ          : Char_Armor_Legs / Heavy
  Hersteller   : —

### Schadenswiderstände (Multiplikator; niedriger = besser)
  Physical      : ×0.6
  Energy        : ×0.6
  Distortion    : ×0.6
  Thermal       : ×0.6
  Biochemical   : ×0.6
  Stun          : ×0.4
  Nahkampf ignoriert: false

### Temperatur
  Aushaltbar: -85 °C bis 115 °C

### Strahlung
  Kapazität: 26800 | Abbaurate: 145.8/s

### Geschützte Körperteile
  [{"partHealthStat":"HealthRightLeg","partWearStat":"WearRightLeg","jointName":"RightLeg"},{"partHealthStat":"HealthLeftLeg","partWearStat":"WearLeftLeg","jointName":"LeftLeg"}]

### Stauraum
  "microSCU":6500

### Anbauplätze (7)
  - medPen_attach_1  (Size 1–1)
  - medPen_attach_2  (Size 1–1)
  - utility_attach_1  (Size 1–1)
  - utility_attach_2  (Size 1–1)
  - oxyPen_attach_1  (Size 1–1)
  - oxyPen_attach_2  (Size 1–1)
  - wep_sidearm  (Size 1–1)

### Tags (12)
  · Item.Small.SuitArmor.Heavy
  · LootGeneration.LootRarity.Common
  · Armor.FPS
  · Armor.FPS.Type.Heavy
  · Armor.FPS.Part.Legs
  · Global.Race.Human
  · Global.Manufacturer.Doomsday
  · Armor.FPS.Set.Doomsday.Overlord
  · Global.Color.Red
  · Item.Interactions.ReceiveParentActorInteractions
  · Item.Interactions.ReceiveParentActorInteractions
  · LootGeneration.CanGenerateAsLoot

==============================================================================
## Dust Devil Core Epoque   [srvl_armor_heavy_core_02_02_01]
==============================================================================
Datei: libs/foundry/records/entities/scitem/characters/human/armor/pu_armor/heavy/core/srvl_armor_heavy_core_02_02_01.xml

### Namen
  EN : Dust Devil Core Epoque
  DE : — (keine dt. Übersetzung)
  Beschreibung EN: Item Type: Heavy Armor Damage Reduction: 40% Temp. Rating: -85 / 115 °C Radiation Protection: 26800 REM Radiation Scrub Rate: 145.8 REM/s Carrying Capacity: 8.0 µSCU Backpacks: All  Reinforced alloys are carefully layered to recreate the appearance of warriors from Humanity's past to create an armor
  Beschreibung DE: — (fehlt)

### Kernwerte
  Masse        : 7 kg
  Größe / Grade: 1 / 1
  Typ          : Char_Armor_Torso / Heavy
  Hersteller   : —

### Schadenswiderstände (Multiplikator; niedriger = besser)
  Physical      : ×0.6
  Energy        : ×0.6
  Distortion    : ×0.6
  Thermal       : ×0.6
  Biochemical   : ×0.6
  Stun          : ×0.4
  Nahkampf ignoriert: false

### Temperatur
  Aushaltbar: -85 °C bis 115 °C

### Strahlung
  Kapazität: 26800 | Abbaurate: 145.8/s

### Geschützte Körperteile
  [{"partHealthStat":"HealthTorso","partWearStat":"WearTorso","jointName":"Torso"}]

### Stauraum
  "microSCU":10500

### Anbauplätze (16)
  - wep_stocked_2  (Size 2–4)
  - wep_stocked_3  (Size 2–5)
  - magazine_attach_1  (Size 1–1)
  - magazine_attach_2  (Size 1–1)
  - magazine_attach_3  (Size 1–1)
  - magazine_attach_4  (Size 1–1)
  - magazine_attach_5  (Size 1–1)
  - magazine_attach_6  (Size 1–1)
  - magazine_attach_7  (Size 1–1)
  - magazine_attach_8  (Size 1–1)
  - grenade_attach_1  (Size 1–1)
  - grenade_attach_2  (Size 1–1)

### Tags (12)
  · Item.Small.SuitArmor.Heavy
  · Item.Small.SuitArmor.Core
  · LootGeneration.LootRarity.Common
  · Armor.FPS
  · Armor.FPS.Type.Heavy
  · Armor.FPS.Part.Core
  · Global.Race.Human
  · Global.Manufacturer
  · Armor.FPS.Set
  · Global.Color.Red
  · Item.Interactions.ReceiveParentActorInteractions
  · LootGeneration.CannotGenerateAsLoot.PromotionalItem

==============================================================================
## Dust Devil Arms Epoque   [srvl_combat_heavy_arms_02_02_01]
==============================================================================
   KEIN Record gefunden.

==============================================================================
## Dust Devil Legs Epoque   [srvl_armor_heavy_legs_02_02_01]
==============================================================================
Datei: libs/foundry/records/entities/scitem/characters/human/armor/pu_armor/heavy/legs/srvl_armor_heavy_legs_02_02_01.xml

### Namen
  EN : Dust Devil Legs Epoque
  DE : — (keine dt. Übersetzung)
  Beschreibung EN: Item Type: Heavy Armor Damage Reduction: 40% Temp. Rating: -85 / 115 °C Radiation Protection: 26800 REM Radiation Scrub Rate: 145.8 REM/s Carrying Capacity: 8.0 µSCU  Reinforced alloys are carefully layered to recreate the appearance of warriors from Humanity's past to create an armor that's intimid
  Beschreibung DE: — (fehlt)

### Kernwerte
  Masse        : 8 kg
  Größe / Grade: 1 / 1
  Typ          : Char_Armor_Legs / Heavy
  Hersteller   : —

### Schadenswiderstände (Multiplikator; niedriger = besser)
  Physical      : ×0.6
  Energy        : ×0.6
  Distortion    : ×0.6
  Thermal       : ×0.6
  Biochemical   : ×0.6
  Stun          : ×0.4
  Nahkampf ignoriert: false

### Temperatur
  Aushaltbar: -85 °C bis 115 °C

### Strahlung
  Kapazität: 26800 | Abbaurate: 145.8/s

### Geschützte Körperteile
  [{"partHealthStat":"HealthRightLeg","partWearStat":"WearRightLeg","jointName":"RightLeg"},{"partHealthStat":"HealthLeftLeg","partWearStat":"WearLeftLeg","jointName":"LeftLeg"}]

### Stauraum
  "microSCU":6500

### Anbauplätze (7)
  - medPen_attach_1  (Size 1–1)
  - medPen_attach_2  (Size 1–1)
  - utility_attach_1  (Size 1–1)
  - utility_attach_2  (Size 1–1)
  - oxyPen_attach_1  (Size 1–1)
  - oxyPen_attach_2  (Size 1–1)
  - wep_sidearm  (Size 1–1)

### Tags (12)
  · Item.Small.SuitArmor.Heavy
  · LootGeneration.LootRarity.Common
  · Armor.FPS
  · Armor.FPS.Type.Heavy
  · Armor.FPS.Part.Legs
  · Global.Race.Human
  · Global.Manufacturer.Doomsday
  · Armor.FPS.Set.Doomsday.Overlord
  · Global.Color.Red
  · Item.Interactions.ReceiveParentActorInteractions
  · Item.Interactions.ReceiveParentActorInteractions
  · LootGeneration.CannotGenerateAsLoot.PromotionalItem


==============================================================================
## CRAFTING-BLUEPRINTS
==============================================================================

### Dust Devil Armor Core
  Datei: libs/foundry/records/crafting/blueprints/crafting/fpsgear/armour/explorer/heavy/bp_craft_srvl_armor_heavy_core_02_01_01.xml
  Rohgröße: 929569 Zeichen
  Zeitfelder: "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1, "duration":1
  Referenzen (erste 20): 
     "name":"Spine3"
     "name":"Hips"
     "name":"LeftUpLeg"
     "name":"LeftFoot"
     "name":"WalkAngle"
     "name":"RightUpLeg"
     "name":"RightFoot"
     "name":"Tag.c209260a-5512-4893-ab4f-e4a173e6341a"
     "name":"@LOC_PLACEHOLDER"
     "name":"BuildingBlocks_Canvas.EmptyView"
     "name":"ShipExplosion"
     "name":"Tag.d01ee89c-4358-4004-bb97-04552840efb3"
     "name":"@LOC_EMPTY"
     "name":"GroundVehicleLarge"
     "name":"GroundVehicle"
     "name":"ScanDisplayLayoutParams.GroundVehicleScanUILayout"
     "name":"BuildingBlocks_Canvas.H_HUD_MK_Root_S42_Vehicle"
     "name":"TintPaletteTree.anvl_spartan_default_grey"
     "name":"Tag.37b0d6d5-a70f-4f7f-9ab2-ab57a3c332f3"
     "name":"Tag.23ceaffa-20c1-4f6f-8cba-53f9f9a94d1e"

### Dust Devil Armor Arms
  Datei: libs/foundry/records/crafting/blueprints/crafting/fpsgear/armour/explorer/heavy/bp_craft_srvl_armor_heavy_arms_02_01_01.xml
  Rohgröße: 419576 Zeichen
  Zeitfelder: —
  Referenzen (erste 20): 
     "name":"LeftForeArm"
     "name":"Neck"
     "name":"RightForeArm"
     "name":"LeftHand"
     "name":"RightHand"
     "name":"Tag.c209260a-5512-4893-ab4f-e4a173e6341a"
     "name":"LeftFoot"
     "name":"RightFoot"
     "name":"Carryable"
     "name":"Take"
     "name":"Consume"
     "name":"Inspect"
     "name":"Replace"
     "name":"Repair"
     "name":"Place"
     "name":"Load"
     "name":"Tinker"
     "name":"Open"
     "name":"Close"
     "name":"Loot"

### Dust Devil Armor Legs
  Datei: libs/foundry/records/crafting/blueprints/crafting/fpsgear/armour/explorer/heavy/bp_craft_srvl_armor_heavy_legs_02_01_01.xml
  Rohgröße: 419419 Zeichen
  Zeitfelder: —
  Referenzen (erste 20): 
     "name":"Tag.c209260a-5512-4893-ab4f-e4a173e6341a"
     "name":"LeftFoot"
     "name":"RightFoot"
     "name":"Carryable"
     "name":"Take"
     "name":"Consume"
     "name":"Inspect"
     "name":"Replace"
     "name":"Repair"
     "name":"Place"
     "name":"Load"
     "name":"Tinker"
     "name":"Open"
     "name":"Close"
     "name":"Loot"
     "name":"Occupy"
     "name":"Main"
     "name":"RadarContactTypeEntry.3fef79cf-d8da-4adf-892f-cb2d4f3087be"
     "name":"ResourceTypeGroup.Raw_Minerals"
     "name":"ResourceType.Janalite"

Dust Devil Core Epoque: kein Blueprint

Dust Devil Arms Epoque: kein Blueprint

Dust Devil Legs Epoque: kein Blueprint


==============================================================================
## LOOT-TABELLEN / -ARCHETYPEN
==============================================================================
Loot-Records gesamt: 487
Direkte Treffer (Item namentlich in der Tabelle): 0


==============================================================================
## EIGENE DATENSÄTZE (was die Seite heute hat)
==============================================================================

### Dust Devil Armor Core
  obtain: [{"kind":"loot","loc":"Maker's Point"},{"kind":"loot","loc":"Picker's Field"},{"kind":"loot","loc":"Rappel (Hurston)"},{"kind":"loot","loc":"Weeping Cove"}]
  in item-prices.json: nein

### Dust Devil Armor Arms
  obtain: [{"kind":"loot","loc":"Maker's Point"},{"kind":"loot","loc":"Picker's Field"},{"kind":"loot","loc":"Rappel (Hurston)"},{"kind":"loot","loc":"Weeping Cove"}]
  in item-prices.json: nein

### Dust Devil Armor Legs
  obtain: [{"kind":"loot","loc":"Maker's Point"},{"kind":"loot","loc":"Picker's Field"},{"kind":"loot","loc":"Rappel (Hurston)"},{"kind":"loot","loc":"Weeping Cove"}]
  in item-prices.json: nein

### Dust Devil Core Epoque
  obtain: [{"kind":"exclusive","loc":"Promotional item — not obtainable in-game","reason":"PromotionalItem"}]
  in item-prices.json: nein

### Dust Devil Arms Epoque
  obtain: [{"kind":"exclusive","loc":"Promotional item — not obtainable in-game","reason":"PromotionalItem"}]
  in item-prices.json: nein

### Dust Devil Legs Epoque
  obtain: [{"kind":"exclusive","loc":"Promotional item — not obtainable in-game","reason":"PromotionalItem"}]
  in item-prices.json: nein