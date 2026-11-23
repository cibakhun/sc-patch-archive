# Item-Finder — DataCore-Deep-Dive (Entscheidungsgrundlage)

**Stand:** 23.07.2026 · **Live-Patch:** `sc-alpha-4.9.0` (build_manifest 20.07.2026)
**Frage:** Können wir für den Universal Item Finder akkuratere / granularere Daten holen, und sind wir aktuell?
**Methode:** direkte Messung gegen die live installierte `Data.p4k` über den repo-eigenen node-nativen DataCore-Reader (`scripts/lib/datacore.mjs`, ~1,4 s Ladezeit für 116.512 Records). Alle Zahlen unten sind gemessen, nicht geschätzt.

> **Umsetzungs-Stand (23.07.2026):** VOLLSTÄNDIG umgesetzt inkl. Tier 1–4. `scripts/datamine-items.mjs` → `assets/items-gamefiles.json`, integriert in `build-universal-db.mjs`, „Technische Daten"-Block im Modal (DE+EN, im Preview verifiziert). Tier 4 nachgezogen: Cooler-Kühlleistung + PowerPlant-Leistung (Resource-Network-Modell dekodiert), Missile-Schaden (`ExplosionParams`), Rüstungs-Temp/Strahlung (aus Beschreibung geparst). Offen bleibt nur Tier 5 (Food/Drink-Nährwerte) sowie Radar-Detektionsreichweiten.

---

## 0. Kurzverdikt

| Frage | Antwort |
|---|---|
| **Aktuell?** | **Ja, patch-seitig.** Live-Build = 4.9.0, unsere DB = 4.9 / Preise 20.07. Kein neuerer Patch existiert. Nur UEX-Preise sind 3 Tage alt (trivial nachziehbar). |
| **Akkurater?** | **Ja an einer Kernstelle:** Kategorie & Item-Identität raten wir heute aus Namens-Strings. Der DataCore liefert die spiel-eigene Taxonomie direkt (kein Raten). |
| **Granularer?** | **Massiv.** Wir nutzen den DataCore für den Finder heute zu **0 %**. Er enthält pro Item die vollen Komponenten-Stats. |

---

## 1. Was der Finder heute hat (dünn)

Datei: `assets/universal-items.json`, gebaut von `scripts/build-universal-db.mjs`. Pro Item nur:

```json
{ "id", "name", "category", "obtain": [{ "kind", "loc", "price" }], "guide?" }
```

- **9.764 Items**, davon **5.510 (56 %) „Katalog-only"** — reiner Name, keinerlei Daten.
- Kategorie per **Namens-Regex** → **3.716 Items (38 %) = „Other"**.
- Identität = Display-Name-String-Matching (global.ini ↔ UEX ↔ Loot). Fragil.
- Preise/Orte kommen aus UEX (23.705 Zeilen) — **das ist bereits die beste Quelle** (Shop-Preise sind seit ~3.20 serverseitig, *nicht* in der p4k). Daran ist nichts zu verbessern.

---

## 2. Was der DataCore bietet — die spiel-eigene Taxonomie

Von **29.108** `EntityClassDefinition`-Records tragen **24.916** ein `AttachDef` mit echtem `Type`. Damit fallen drei Dinge auf einen Schlag ab, **flach und quasi lückenlos**:

- **Echte Kategorie** aus `AttachDef.Type` (+ `SubType`) → ersetzt das Regex-Raten, killt „Other".
- **Size** (S0–S12, echte Varianz gemessen: `{S1:173, S2:68, S3:59, S4:31, …, S12:6}`) und **Grade** (1–6, echte Varianz) — **zu 100 % vorhanden**.
- **Manufacturer** (90–100 % bei Spieler-Gear) — als Ref auflösbar zum Herstellernamen.
- **Lokalisierter Name + Beschreibung** (EN **und** DE via `global.ini`) — Abdeckung je Typ siehe Tabelle.
- **Stabile interne GUID** je Record (24.916/24.916 non-null).

### Type-Verteilung (Auszug, nach Spieler-Relevanz gruppiert)

`name%` = Anteil mit auflösbarem Anzeigenamen (der Rest ist Infrastruktur ohne UI-Namen).

| Bereich | Types (N) |
|---|---|
| **Personenwaffen** | WeaponPersonal 450 (name 92 %), WeaponAttachment 476 (35 %*), WeaponMining 18, Grenade 3 |
| **Rüstung** | Char_Armor_Helmet 678 (95 %), Torso 472 (98 %), Legs 461 (98 %), Arms 452 (99 %), Undersuit 219 (92 %), Backpack 138 (97 %) → **~2.420** |
| **Kleidung** | Char_Clothing_* Torso 558/347, Legs 382, Feet 322, Hat 211, Hands 140 → **~1.970** |
| **Schiffswaffen** | WeaponGun 200 (96 %), Turret 314 (98 %), WeaponDefensive 188 (Kontermaßnahmen), MissileLauncher 145, Missile 66, BombLauncher 14, Bomb 3 |
| **Schiffskomponenten** | Shield 67, ShieldController 139, Cooler 76, PowerPlant 83, QuantumDrive 59, Radar 74, FuelTank 182, QuantumFuelTank 150, ExternalFuelTank 29, JumpDrive 8, EMP 7, QuantumInterdictionGenerator 5, LifeSupportGenerator 8 |
| **Verbrauch/Utility** | Food 168 (76 %), Drink 100 (82 %), FPS_Consumable 37, Bottle 12, MobiGlas 23, Gadget 25, MiningModifier 29, TractorBeam 9, ToolArm 17, Battery 10 |
| **Lackierungen** | Paints 1012 (94 %) — kosmetisch, optionale Aufnahme |
| **Infrastruktur (NICHT in den Finder)** | NOITEM_Player 2257, Cargo 1708, Misc 1366, Usable 1248, Door 839, Seat 469, Display 478, ControlPanel 376, ShopDisplay 393, Thruster (Main/Manneuver) 1265, CargoGrid 142, Hangar 83, Room 38 … |

\* WeaponAttachment name-% niedrig, weil viele Einträge reine Magazine/Interna sind; die *benannten* Aufsätze (Visiere, Läufe, Unterläufe) sind sauber dabei.

**Konsequenz:** Ein DataCore-first-Aufbau filtert Infrastruktur über `Type` sauber weg (statt heute per Namens-Heuristik) und liefert einen stat-reichen, korrekt kategorisierten Katalog. Die 5.510 „Katalog-Leichen" und die 38 % „Other" verschwinden **beide** als Nebeneffekt.

---

## 3. Feld-für-Feld-Coverage je Item-Typ (nach Extraktions-Aufwand)

Gemessen an konkreten Repräsentanten (tiefer Read, Feldnamen wörtlich aus den Spieldaten).

### Tier 1 — universell, flach, ~100 % (der Backbone)
Für **alle** 24.916 Items ohne Sonderlogik: `Type`/`SubType`, `Size`, `Grade`, `Manufacturer`, `Name`+`Description` (EN/DE), interne GUID. **Allein das hebt den Finder von „Name + wo kaufen" auf „korrekt kategorisiert + Größe/Klasse/Hersteller".**

### Tier 2 — Typ-Stats mit flacher, sauberer Struktur (geringer Aufwand)
| Typ | Struct | Kennzahlen (gemessen) |
|---|---|---|
| **Shield** | `SCItemShieldGeneratorParams` (100 %) | MaxShieldHealth, MaxShieldRegen, DecayRatio, ReservePool*, Down/Damaged-RegenDelay, ElectricalChargeDamageResistance |
| **QuantumDrive** | `SCItemQuantumDriveParams.params` (100 %) | driveSpeed (z. B. 190 000 000), cooldownTime, stageOne/TwoAccelRate, engageSpeed, calibrationRate, quantumFuelRequirement, jumpRange |
| **Helm** | `SCItemSuitHelmetParams` (98 %) | atmosphereCapacity (Atemreserve), min/maxFOV, punctureMaxArea/Number |
| **Undersuit** | `SCItemGasProducer/GasTankParams` (98 %) | atmosphericPressureRange, recipientTransferRate, selfRefillRate |
| **Rüstung Torso/Backpack** | `SCItemInventoryContainerComponentParams` | Stauraum-Kapazität (SCU) |
| **FuelTank** | `SCItemFuelTankParams` (85 %) | hydrogen/quantumMaxFlowMultiplier |
| **Missile** | `SCItemMissileParams` (98 %) | maxLifetime, armTime, igniteTime, projectileProximity |
| **Health** (fast alle Schiffsitems) | `SHealthComponentParams` | Health, DamageCap (Bauteil-Lebenspunkte) |

### Tier 3 — erfordert Referenz-Auflösung (mittlerer Aufwand; Muster wie `datamine-gear.mjs`)
| Typ | Weg | Ergebnis |
|---|---|---|
| **Waffenschaden** (FPS + Schiff) | `SAmmoContainerComponentParams.ammoParamsRecord.__ref` → AmmoParams-Record | Schaden pro Projektil (physical/energy/…); dazu `SProjectileLauncher` (pelletCount, spread, damageMultiplier) + Feuerrate aus den Fire-Actions |
| **Rüstungs-Resistenzen** | `SCItemSuitArmorParams.damageResistance.__ref` → `DamageResistanceMacro` | Multiplier/Threshold je Schadensart. Makros sind geteilt (LightArmor, MediumArmor, CombatFlightsuitArmor) → einmal auflösen, mehrfach nutzen |

### Tier 4 — neues „Item-Resource-Network"-Modell (höherer Aufwand, Recherche nötig)
Cooler, PowerPlant, Radar tragen **keine** flache `SCItemCoolerParams`-artige Struktur. Ihre Kennzahlen liegen im Resource-Network-Modell:
- **Cooler:** `CoolingEqualizationRateAtTemperatureDifference` (z. B. rate 3.75 @ Δ400), `ItemResourceComponentParams`, `SPowerSegmentResourceUnit`.
- **PowerPlant:** `ItemResourceDeltaGeneration` + `SPowerSegmentResourceUnit` (units = Leistungssegmente).
- **Radar:** `SCItemRadarComponentParams` + `SCItemRadarSensitivityModifierType…ContactGroups` (Detektionsreichweiten).

Extrahierbar, aber man muss das Modell erst dekodieren. Für einen ersten Wurf können diese Typen mit Tier-1-Feldern (Size/Grade/Hersteller/Health) laufen und die Rate-Kennzahlen nachgezogen werden.

### Tier 5 — unsicher / vermutlich nicht sauber verfügbar
- **Nährwerte von Food/Drink** („stellt X Hunger/Durst her"): der Effekt hängt an einer referenzierten Consume-Interaktion, nicht als flacher Zahlenwert. `SCItemConsumableParams` liefert Volumen (microSCU) und Verhalten, aber keine sauberen Sättigungszahlen an der Oberfläche. **Als offen markieren**, nicht versprechen.

---

## 4. Preis-Join: per Name, **nicht** per GUID (mit Beleg)

Der Finder braucht: Item + Stats (DataCore) + Kaufpreis/-ort (UEX). Wie verbinden?

- **Per GUID: nein.** UEX liefert zwar `item_uuid` (z. B. „Omnisky III Cannon" = `26838ca7-418a-47d2-8429-7339ebbb8993`), aber dieser Namespace matcht **0 / 2.424** DataCore-Record-GUIDs — weder direkt noch in Mixed-Endian-Byte-Ordnung. Die DataCore-Dateinamen sind zudem **interne Codenamen** (kein „Omnisky"), also auch kein Datei-Join. UEXs UUID stammt aus einer eigenen (Wiki-)Quelle.
- **Per lokalisiertem Anzeigenamen: ja.** UEX `item_name` **ist** der Spiel-Anzeigename = `loc(AttachDef.Localization.Name)`. Verlässlich für die **2.421 bepreisten** Items.
- **Namens-Kollisionen** existieren (mehrere „Remote Turret", „Seat", „Access") — aber praktisch nur bei Infrastruktur, die eh nicht in den Finder gehört. Wo doch, **eindeutig auflösbar über (Size, Grade, Manufacturer)** — die wir jetzt haben.

**Fazit:** Der Name-Join bleibt der pragmatische, robuste Weg — aber **besser als heute**, weil beide Seiten aus derselben String-Quelle normalisiert werden und Kollisionen über echte Attribute aufgelöst werden. Ein GUID-Join wäre schöner, ist aber nicht ohne weitere Recherche zu haben (nicht empfohlen als Blocker).

---

## 5. Gaps & ehrliche Vorbehalte

1. **Preise bleiben UEX** (serverseitig, nicht minebar) — unverändert. Datenherkunft-Regel ([[data-provenance-hidden]]) beachten: UEX-Attribution behalten, DataCore nicht im UI benennen.
2. **Cooler/PowerPlant/Radar-Kennzahlen** brauchen das Resource-Network-Modell (Tier 4) — nicht im ersten Durchgang zwingend.
3. **Consumable-Nährwerte** (Tier 5) evtl. gar nicht sauber → ehrlich weglassen statt raten.
4. **Grade-Semantik** (1–6 vs. A–D) beim Bau kurz verifizieren, bevor angezeigt.
5. **Katalog-Umfang ist eine Design-Entscheidung:** Ship-Paints (1012) rein? Jede Kleidungs-Variante? Ammo? Das steuert die Item-Zahl — bewusst wählen.
6. **„Ehrliche Werte"-Prinzip** bleibt: Felder, die ein Item nicht hat, leer lassen — kein Auffüllen.

---

## 6. Empfohlener Bau-Pfad (wenn grün)

1. **Neuer Extraktor** `datamine-items.mjs` (Muster: `datamine-gear.mjs`): enumeriere `EntityClassDefinition` mit `AttachDef.Type`, filtere auf Spieler-relevante Types, ziehe Tier-1-Backbone universell + Tier-2/3-Stats je Typ, EN/DE-Namen. Ausgabe: `assets/items-gamefiles.json` (GUID-keyed).
2. **`build-universal-db.mjs` erweitern:** DataCore-Items als Identitäts-Basis; UEX-Preise + Loot-Recherche **per Name (mit Size/Grade/Mfr-Tiebreak)** anhängen; Crafting-Link wie bisher.
3. **UI:** Modal um einen „Technische Daten"-Block je Typ ergänzen (Karten können Size/Grade/Hersteller zeigen).
4. **Refresh** (UEX-Preise neu) im selben Zug — dann ist alles taggenau.

**Grober Aufwand:** Tier 1+2 + Name-Join + UI = solides erstes Release. Tier 3 (Waffenschaden, Resistenzen) als zweiter Pass. Tier 4/5 optional/später.
