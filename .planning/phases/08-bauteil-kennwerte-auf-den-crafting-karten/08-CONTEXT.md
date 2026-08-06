---
phase: 8
phase_name: Bauteil-Kennwerte auf den Crafting-Karten
slug: bauteil-kennwerte-auf-den-crafting-karten
date: 2026-08-06
source: Erkundung (/gsd-explore) + Nutzerentscheidungen
branch: feature/crafting-card-size-grade-tone
---

# Phase 8 — Kontext

## Domain

Die Crafting-Datenbank auf verse-base.com listet 1594 Blueprints als Karten. Eine
Discord-Rückmeldung von **[SYN] Froggy** verlangt drei zusätzliche Angaben auf der
Karte: Größe, Grade (A–D) und Ton (military / industrial / civilian / stealth).

Die vorgeschaltete Erkundung hat die Datenlage vermessen. Ergebnis in
`08-RESEARCH.md` — **es ist zwingend zuerst zu lesen**. Alle Dateipfade,
Zeilennummern und Zahlen stehen dort; nichts davon neu erheben.

## Locked Decisions

Diese Punkte sind entschieden. Nicht neu aufrollen.

1. **Keine Neu-Extraktion, kein Data.p4k-Lauf.** Sämtliche Angaben liegen in
   `assets/universal-items.json` (`game.size`, `game.grade`, `game.class`). Dies ist
   reine Frontend-Arbeit.

2. **Der Namens-Join bleibt.** Die vorhandene Brücke `itemForBlueprint()` in
   `src/lib/crafting.ts:191-201` wird verwendet. Sie ist gegengeprüft: für alle 57
   Blueprints mit unabhängiger Größe im Kategorie-String stimmt `game.size` exakt
   überein — 57/57, null Abweichungen.

   ⚠ **Eine guid-Route steht nicht zur Wahl:** `assets/crafting-db.json` führt gar
   kein `entity_guid`. Die Felder eines Blueprints sind abschließend `name`,
   `category`, `craft_time_seconds`, `tiers`, `item_stats`, `ingredients`, `missions`.
   Die guid läge nur nach einer Skriptänderung plus Data.p4k-Lauf vor — und der ist
   durch Entscheidung 1 ausgeschlossen. Nicht versuchen.

   ⚠⚠ **Der Namens-Join versagt bei 5 Gruppen nachweislich** (gemessen, siehe
   Entscheidung 9). Er ist deshalb nur mit der dort verlangten Sperre zulässig.

3. **Ton = `game.class`.** Ein Feld `tone` existiert nicht und wird nicht erfunden.

4. **Ton für Schiffswaffen kommt aus dem Kategorie-Pfad.** Die 96 Vehiclegear-Waffen
   haben `game.class = null`, tragen ihren Ton aber im Kategorie-String:
   `Vehiclegear / Weapons / Ballistic / Cannon` → Ballistic. Das dritte Pfadsegment
   wird dort gelesen.

5. **Rüstung bekommt keinen Ton-Chip.** Alle 913 Armour-Blueprints haben
   `game.class = null`. Rüstung hat keinen military/industrial-Ton, sondern
   Light/Medium/Heavy — eine andere Achse. Kein Platzhalter, kein leerer Chip.

6. **Fehlende Angabe = keine Anzeige.** Niemals raten, niemals 0 oder „—" als
   Kennwert ausgeben. Das Projekt lebt von Spielgenauigkeit.

7. **Ein Körper für DE und EN.** Die Karten werden aus
   `src/components/CraftingApp.astro` gerendert; es gibt keine zweite Fassung.

8. **Datenherkunft bleibt unsichtbar.** Kein UI-Text nennt Data.p4k, DataCore,
   scmdb oder „datamined" — das erzwingt `npm run audit:site` als Fehler.

9. **Kollidierende Namensgruppen bekommen gar keine Chips.** Nachgemessen am Bestand:
   von den 15 gleichnamigen Blueprint-Gruppen sind **5 nachweislich verschiedene
   Items** — sie tragen bei gleichem Namen und gleicher Kategorie unterschiedliche
   `item_stats`:

   | Gruppe | Kategorie | `mass_kg` |
   |---|---|---|
   | `main powerplant` | Vehiclegear / Powerplant | 60000 ↔ 7600 |
   | `stellate` | Vehiclegear / Powerplant | 12000 ↔ 17000 |
   | `serac` | Vehiclegear / Cooler | 10000 ↔ 14000 |
   | `broadspec` | Vehiclegear / Radar | 590 ↔ 220 |
   | `antium core jet` | Armour / Hunter / Heavy | 7 ↔ 5 |

   Masse skaliert bei Bauteilen mit der Größe; Faktor 8 bei `main powerplant` ist
   keine Rundung. Da `itemForBlueprint()` per Name joint, bekämen beide Karten
   denselben Item-Eintrag — mindestens eine zeigte die Kennwerte eines fremden Items.
   Nach Entscheidung 6 bleiben diese Karten deshalb **chiplos**. Die Sperrliste wird
   **aus den Daten abgeleitet** (Namensgruppe mit abweichenden `item_stats`), nicht
   von Hand gepflegt — sonst geht eine künftige Kollision still durch.

   Die übrigen 10 Gruppen sind unkritisch: identische Kategorie *und* identische
   `item_stats` (Lackvarianten wie `truedef-pro …`, `argus helmet …`).

## Specifics

**Renderpfade** (aus der Erkundung, mit Zeilennummern):

| Zweck | Datei |
|---|---|
| Kartendaten-Aufbereitung | `src/components/CraftingApp.astro:179-191` (`cardsData`) |
| Karten-Markup | `src/components/CraftingApp.astro:321-349` |
| Karten-CSS | `src/components/CraftingApp.astro:565-600` |
| Blueprint-Loader | `src/lib/crafting.ts:10` |
| Brücke Blueprint→Item | `src/lib/crafting.ts:191-201` |
| Item-Typ | `src/lib/items.ts:74-103` (`ItemGame`) |
| Vorbild-Renderer für die Chips | `src/lib/itemStats.ts:57-70` |
| Semantik-Gate | `src/lib/items.ts:359-364` (`hasGradeSemantics()`) |
| Client-Filter-Hydration | `assets/crafting-app.js` |

**Weitere Renderer derselben Daten** — prüfen, ob sie mitziehen sollen:
`src/components/CraftingListing.astro`, `src/components/BlueprintDetail.astro`,
`src/components/CraftingHub.astro`.

**Abdeckung** (n / mit size / mit grade / mit class):
Powerplant 75/75/75/73 · Cooler 75/73/73/72 · Shield 62/62/62/61 ·
Radar 60/57/57/57 · Quantumdrive 57/57/57/56 · Vehiclegear-Weapons 96/95/95/**0** ·
Armour 913/889/889/**0** · Ammo 36/36/36/**0**.

**Die 15 gleichnamigen Blueprints**, die vor Auslieferung einzeln zu prüfen sind:
`antium core jet`, `argus helmet black/silver`, `broadspec`, `cinch scraper module` (3×),
`dustup legs desert`, `foxfire`, `fullforce`, `glacis`, `inquisitor core olive`,
`main powerplant`, `serac`, `stellate`, `truedef-pro arms/core/legs black/silver`.

**Wertebereich `class`**: Ballistic, Civilian, Military, Industrial, Stealth,
Competition, Melee, Gadget, Electron, Rocket, Foam Dart, Laser, Salvage and Repair,
Medical, Mining, Cutter, Tractor Beam.

## Claude's Discretion

- Visuelle Form der Chips (Reihenfolge, Farbgebung, Position auf der Karte). Die
  Karten folgen der „Registry-HUD"-Sprache; `src/lib/itemStats.ts:57` zeigt, wie es
  auf der Item-Seite aussieht. Ton-Chips dürfen farblich unterscheidbar sein.
- Ob die Kennwerte auch in der Listenansicht (`.cbp` List-View,
  `CraftingApp.astro:598-600`) erscheinen.
- Ob `CraftingListing.astro` / `BlueprintDetail.astro` mitgezogen werden.
- Umsetzung des Filters: neue Filterfelder oder Erweiterung der vorhandenen.

## Scope Fence

**Drin:**
- Größe, Grade und Ton auf den Blueprint-Karten der Crafting-Datenbank
- Ton-Ableitung aus dem Kategorie-Pfad für Schiffswaffen
- Prüfung der 15 gleichnamigen Blueprints
- Filter nach Größe und Grade

**Draußen:**
- Jede Änderung an `scripts/datamine-*.mjs` oder `build-universal-db.mjs`
- Jeder Data.p4k- oder UEX-Lauf
- Ton für Mininglaser / Tractorbeam / Salvage / Refuelling (existiert in keiner
  Quelle — als CRAFT-05 nach v2 vertagt)
- Light/Medium/Heavy für Rüstung
- Änderungen an der Item-Finder-Seite

## Risk Summary

- **Falsche Kennwerte durch Namenskollision.** Gedeckelt durch die 57/57-Messung,
  aber die 15 Dubletten bleiben offen und müssen einzeln geprüft werden. Ein falscher
  Kennwert ist schlimmer als ein fehlender — das Projekt verkauft Genauigkeit.
- **Seitengewicht.** Die Crafting-Seite ist statisch ausgeliefert. Item-Daten pro
  Karte einzubetten kann sie aufblähen; ein früherer Anlauf kostete +433 KB, als
  Chip-Links serverseitig gerendert wurden. Nur die drei benötigten Felder
  durchreichen, nicht das ganze Item-Objekt.
- **Leere Chips bei Rüstung** — 913 Karten würden sonst eine tote Stelle tragen.
