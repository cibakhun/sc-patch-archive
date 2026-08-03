---
quick_id: 260802-ose
slug: groessenachse-boden-raum
date: 2026-08-02
type: quick
files_modified:
  - scripts/datamine-vehicle-roles.mjs
  - scripts/verify-vehicle-roles.mjs
  - src/data/vehicle-roles.json
  - src/i18n/vehicleText.ts
  - src/components/ships/ShipsOverview.astro
---

# Größenachse und Boden/Raum aus dem DataCore

Nachtrag zu Phase 6 (Schiffe: Rollen- und Merkmalsfilter). Nutzerwunsch vom 02.08.2026,
wörtlich: *„was noch fehlt ist sowas wie mittel combat stelth bomber"* — Beruf, Rolle und
Signatur lassen sich bereits kombinieren, die Größe fehlt als Achse.

## Erhobene Grundlage

Aus `Data/Game2.dcb`, `SAttachableComponentParams.AttachDef` je Schiffs-Record:

- **`Size`** — Zahl 1–6. Das ist CIGs Größenklasse (Hangar-/Landeplatzklasse), nicht die
  umgangssprachliche Größe. Verteilung über die **223 gejointen Katalogschiffe**:
  `1: 48 · 2: 82 · 3: 38 · 4: 22 · 5: 26 · 6: 7`
- **`SubType`** — `Vehicle_Spaceship` (196) / `Vehicle_GroundVehicle` (27) im Katalog.
- `Type` ist bei allen 360 Records `NOITEM_Vehicle` und damit wertlos — nicht übernehmen.

Die CIG-Größe weicht bewusst von der Wiki-Größe ab. Gemessene Beispiele:

| Schiff | CIG `Size` | Wiki `sizeDe` | Länge |
|---|---|---|---|
| Eclipse | 2 | Mittel | 24,5 m |
| Vulture | 2 | Klein | 34 m |
| Prowler | 3 | Mittel | 34 m |
| Reclaimer | 6 | Groß | 160 m |
| Idris-P | 6 | Kapitalklasse | 243 m |

Der Nutzer hat die CIG-Zahl gewählt, ausdrücklich in Kenntnis dessen, dass „mittel +
Tarnkappenbomber" die Eclipse damit **nicht** findet — sie liegt bei Größe 2.

## Aufgaben

### 1. Datamine erweitern

`scripts/datamine-vehicle-roles.mjs` liest zusätzlich `AttachDef.Size` und
`AttachDef.SubType` und schreibt sie je Fahrzeug nach `src/data/vehicle-roles.json`
(Feldnamen frei, aber im Satzbau der bestehenden Felder). `sources` muss die neuen
Achsen mitführen — die Belegpflicht aus Phase 6 gilt weiter.

Momentaufnahme neu erzeugen und committen.

### 2. ⚠ Boden/Raum: erst prüfen, dann umstellen

Das heutige Merkmal „Bodenfahrzeug" trifft **37** Schiffe (aus `isGravlevVehicle` /
`sizeDe`). `AttachDef.SubType` liefert nur **27**. Die Differenz ist kein Rundungsfehler.

**Gemessen: CIG führt Nox und Dragonfly als `Vehicle_Spaceship`**, obwohl es Schweberäder
sind. Wer „Bodenfahrzeug" filtert, erwartet sie vermutlich in der Liste.

**Vorgehen:** die Differenzmenge namentlich auflisten (welche 10 Schiffe fallen weg?) und
dann entscheiden:

- Ist die SubType-Liste für einen Spieler die bessere Antwort → umstellen.
- Ist sie schlechter (Schweberäder fehlen) → **nicht umstellen**, das heutige Merkmal
  stehen lassen und im SUMMARY begründen, warum die vermeintlich spielgenauere Quelle
  hier die schlechtere ist.

Das ist dieselbe Abbruchbedingung, an der in Phase 6 schon das Merkmal „Bewaffnet"
gescheitert ist (`dogfightEnabled` traf 220 von 223). Ein Signal aus den Spieldateien ist
nur dann besser, wenn es auch besser aussiebt.

### 3. Filterachse `sf-size`

Neues `<select id="sf-size">` in `src/components/ships/ShipsOverview.astro`, neues
`data-size` auf der Karte, Zweig in `apply()`, Eintrag in der Listener-Registrierung.
Einordnung neben `sf-career`/`sf-rolefam` — die drei gehören zusammen.

**Beschriftung — hier ist Sorgfalt nötig.** CIG liefert für die Zahlen 1–6 **keine Namen**
(geprüft: `global.ini` kennt S/M/L nur für Hangars selbst, und unübersetzt). Erfinde daher
keine Kategorienamen, die die Daten nicht hergeben — „S1 = Beiboot" wäre falsch, denn von
den 48 Schiffen der Größe 1 sind 18 Bodenfahrzeuge, 18 Beiboote und 12 kleine Schiffe.

Zulässig ist die nackte Klasse plus Zählstand (`Größe 1 (48)` / `Size 1 (48)`), dazu **eine
erklärende Zeile** an der Konsole, die sagt, was die Zahl bedeutet: die Größenklasse
bestimmt, auf welchen Landeplatz bzw. in welchen Hangar das Schiff passt. Diese Zeile in
DE und EN.

Die Größe gehört zusätzlich auf die Karte, im Satzbau der bestehenden Chips.

### 4. Wächter erweitern

`scripts/verify-vehicle-roles.mjs` prüft die neuen Achsen: die sechs Größenstände
(48/82/38/22/26/7) und den Boden/Raum-Stand. Muss mit Exit 1 fehlschlagen, wenn ein Stand
abweicht — mit Manipulationsprobe belegen, wie in Phase 6.

## Abnahme

Gegen das gebaute `dist/`, nicht gegen die Quelle, und in **beiden** Sprachen:

1. `Beruf = Kampf` + `Rolle = Bomber` + `Größe = 2` → **Eclipse**
2. Größenmenü zeigt sechs Klassen mit den Ständen 48/82/38/22/26/7
3. Die sieben Schnellzugriffe treffen unverändert: Tarnkappenbomber 1 · Frachter mit
   gesenkter Signatur 1 · Bergbau 5 · Bergung 6 · Betankung 3 · Abriegelung 5 · Rennen 17
4. `npm.cmd run build` und `npm.cmd run verify:vehicle-roles` grün
5. Keine englische Beschriftung auf der deutschen Seite
6. Ohne JavaScript weiterhin alle 227 Karten sichtbar

## Umgebung

- Windows: `npm.cmd` statt `npm`; PowerShell statt Git-Bash; `git -C <pfad>` statt `cd`
- `Data.p4k`: `F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k`
- `npm run theme` ist repo-weit und fasst ~84 phasenfremde Dateien an (Alt-Drift) —
  ausführen, aber nur die eigenen Dateien committen, den Rest `git checkout --`
- Vorschau-Server läuft auf `http://localhost:8341` (`npx serve dist`)
