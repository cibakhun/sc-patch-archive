---
title: "Crafting-Karten: Größe, Grade und Ton — Datenlage und Messung"
date: 2026-08-06
context: "Discord-Feedback [SYN] Froggy; Erkundung vor der Planung"
branch: feature/crafting-card-size-grade-tone
---

# Crafting-Karten: Größe, Grade und Ton

## Anlass

Discord-Feedback von **[SYN] Froggy**: auf den Blueprint-Karten der Crafting-Datenbank
soll direkt sichtbar sein, (a) welche **Größe** ein Bauteil hat, (b) welchen
**Grade/Klasse** (A, B, C, D) und (c) welchen **Ton** — military, industrial,
civilian, stealth. Genannte Beispiele: Allegro, Atlas, Cassandra, Cirrus, Drift,
Erebos, Hemera, Lotus (Quantumdrives, Powerplants, Radar).

Heute zeigen die Karten nur Kategorie, Zeit, Zutatenzahl, Stufe und Material-Chips.

## Kernbefund

**Alles Nötige liegt bereits im Repo. Kein Data.p4k-Lauf, keine Neu-Extraktion.**
Das ist reine Frontend-Arbeit.

| Was | Wo |
|---|---|
| Kartenrenderer | `src/components/CraftingApp.astro:321-349` (Markup), `:565-600` (CSS) |
| Karten-Datenaufbereitung | `src/components/CraftingApp.astro:179-191` (`cardsData`) |
| Blueprint-Daten | `assets/crafting-db.json` (1594 Einträge), Loader `src/lib/crafting.ts:10` |
| Item-Daten mit size/grade/class | `assets/universal-items.json`, Typ `ItemGame` in `src/lib/items.ts:74-103` |
| Brücke Blueprint→Item | `src/lib/crafting.ts:191-201` (`itemForBlueprint`, per Anzeigename) |
| Fertiger Chip-Renderer | `src/lib/itemStats.ts:57-70` (rendert bereits „S{size} / grade / class") |
| Gate | `hasGradeSemantics()` in `src/lib/items.ts:359-364` |

`crafting-db.json` selbst hat **keine** Felder `size`/`grade`/`class` — nur 57 von 1594
Blueprints tragen ein `SizeN`-Segment im Kategorie-String (ausschließlich Quantumdrives).
Die Angaben kommen daher aus `universal-items.json`: `game.size`, `game.grade`,
`game.class`, zusätzlich `game.manufacturer`, `game.subType`, `game.guid`.

Froggys „Ton" ist exakt **`game.class`**. Ein Feld `tone` gibt es nicht.

## Messung 1 — ist der Namens-Join belastbar?

Projektgedächtnis warnt: „Anzeigename ist kein Schlüssel" (40 Item-Namen stehen für
mehrere unterschiedlich große Items; kostete schon 15 Schiffe mit falscher
Waffengröße). Gegenprobe deshalb gerechnet:

Für alle 57 Blueprints, deren Kategorie-String eine **unabhängige** Größe trägt,
`SizeN` gegen `game.size` aus dem Namens-Join gestellt:

```
mit SizeN in Kategorie: 57 | übereinstimmend: 57 | ABWEICHEND: 0
mehrdeutige Item-Namen von einem Blueprint getroffen: 0
```

**57/57, null Abweichungen.** Der Namens-Join ist damit empirisch gedeckt; die
guid-Route (`blueprint.entity_guid === item.game.guid`) ist **nicht zwingend**.

⚠ Einschränkung, die bestehen bleibt: `assets/universal-items.json` merged intern
selbst schon per Name (`scripts/build-universal-db.mjs:73-84`, last-wins). Gleichnamige
Items sind dort also bereits kollabiert — die 0 mehrdeutigen Namen sind teilweise ein
Artefakt dieses Merges, nicht der Beweis, dass es keine Mehrdeutigkeit gibt.

**Verbliebenes Risiko: 15 Blueprint-Namensdubletten**, die alle auf denselben
Item-Eintrag zeigen. Vor Auslieferung einzeln prüfen:

`antium core jet` (2×), `argus helmet black/silver` (2×), `broadspec` (2×),
`cinch scraper module` (3×), `dustup legs desert` (2×), `foxfire` (2×),
`fullforce` (2×), `glacis` (2×), `inquisitor core olive` (2×),
`main powerplant` (2×), `serac` (2×), `stellate` (2×),
`truedef-pro arms black/silver` (2×), `truedef-pro core black/silver` (2×),
`truedef-pro legs black/silver` (2×)

Ohne Item-Treffer: 14 von 1594.

## Messung 2 — die Ton-Lücke betrifft nicht Froggys Bauteile

Grobzahl über alle Blueprints wäre: `class` nur bei 406 von 1580 (~26 %). Nach
Kategorie aufgeschlüsselt löst sich das auf:

| Vehiclegear-Typ | n | size | grade | class |
|---|---|---|---|---|
| Powerplant | 75 | 75 | 75 | **73** |
| Cooler | 75 | 73 | 73 | **72** |
| Shield | 62 | 62 | 62 | **61** |
| Radar | 60 | 57 | 57 | **57** |
| Quantumdrive | 57 | 57 | 57 | **56** |
| Vehiclegear/Weapons | 96 | 95 | 95 | **0** |
| Mininglaser | 17 | 15 | 15 | 0 |
| Tractorbeam | 12 | 12 | 12 | 0 |
| Refuelling | 8 | 1 | 1 | 0 |
| Salvage | 5 | 5 | 5 | 0 |

Oberkategorien: Armour 913 BP (size/grade 889, **class 0**), Vehiclegear 467
(452/452/**319**), Weapons 174 (165/165/87), Ammo 36 (36/36/**0**).

**Genau die Bauteile, nach denen Froggy fragt, haben den Ton zu ~98 %.**
Die Nullen stehen bei Rüstung und Schiffswaffen — und beide sind keine echten Lücken:

- **Schiffswaffen** tragen ihren Ton bereits im Kategorie-String:
  `Vehiclegear / Weapons / Ballistic / Cannon`. Nur lesen, nicht extrahieren.
- **Rüstung** hat keinen military/industrial-Ton, sondern Light/Medium/Heavy —
  eine andere Achse, kein Defekt.

`game.class` wird per Regex aus dem Beschreibungskopf geparst
(`scripts/datamine-items.mjs:102`, `classFrom`), nicht aus einem Struct-Feld. Das
erklärt die Lücken, ist für die betroffenen Bauteiltypen aber unschädlich.

Wertebereich `class`: Ballistic 150, Civilian 124, Military 75, Industrial 65,
Stealth 32, Competition 28, Melee 23, Gadget 19, Electron 10, Rocket 4, Foam Dart 4,
Laser 3, je 1× Salvage and Repair / Medical / Mining / Cutter / Tractor Beam.

## Stichprobe (Froggys eigene Beispiele)

| Blueprint | size | grade | class |
|---|---|---|---|
| Allegro | 4 | A | Civilian |
| Atlas | 1 | A | Civilian |
| Hemera | 2 | A | Civilian |
| Erebos | 3 | A | Civilian |
| Lotus | 2 | A | Civilian |
| Cassandra | 2 | A | Stealth |
| Cirrus | 2 | C | Stealth |
| Drift | 1 | C | Stealth |

„Devour" aus dem Screenshot existiert weder als Item noch als Blueprint unter diesem
Namen — vermutlich verlesen (Screenshot zeigt „Devour", Kategorie Radar).

## Offene Punkte für die Planung

1. Die 15 Dubletten-Namen einzeln prüfen, bevor Größe/Grade ausgeliefert werden.
2. Ton für die 96 Schiffswaffen aus dem Kategorie-String ableiten statt aus `game.class`.
3. Rüstung: entweder Light/Medium/Heavy als eigene Achse zeigen oder Ton dort weglassen —
   nicht leere Chips rendern.
4. `hasGradeSemantics()` beachten: Grade/Größe sind nur für
   `Vehiclegear|Weapons|Armour|Attachment` sinnvoll, sonst konstant.
5. DE + EN gleichermaßen — die Karten haben EINEN Körper (`CraftingApp.astro`).
6. Naheliegende Erweiterung über den Wunsch hinaus: Größe und Grade als **Filter**,
   nicht nur als Anzeige. Die Filter-Hydration liegt in `assets/crafting-app.js`.

## Verwandt

- [[display-name-not-a-key]] — die Warnung, gegen die hier gemessen wurde
- [[crafting-page]] — die Seite selbst
- [[item-finder-datacore-opportunity]] — Herkunft von `game.size`/`grade`/`class`
