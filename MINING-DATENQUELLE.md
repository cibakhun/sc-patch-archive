# Mining-Datenquelle & Exaktheits-Beweis (Patch 4.9)

**Kurz:** Die Mining-Daten kommen zu ~95 % aus der **eigenen Extraktion der lokalen
`Data.p4k`** — node-nativ über einen selbstgeschriebenen DataCore-Reader, ohne
unp4k/unforge und ohne Live-Abhängigkeit von scmdb/UEX. Nur vier Felder, die nicht
sauber im Client-DataCore liegen, sind als gelabelte Konstanten aus einem letzten
scmdb-4.9-Zug eingefroren. Preise werden bewusst **nicht** angezeigt (serverseitig,
volatil, nicht game-verifizierbar).

## Woher die Daten kommen

Patch-Kennung aus dem Client-`build_manifest.id`: **`4.9.0-live.12232306`**
(Branch `sc-alpha-4.9.0`).

**Eigene Extraktion (node-nativ, `scripts/lib/p4k.mjs` + `scripts/lib/datacore.mjs`):**

| Skript | Ausgabe | Inhalt |
|---|---|---|
| `datamine-mining.mjs` | `mining-gamefiles.json` | Element-Physik, Kompositionen (die „bis X %"), Global-Params, **density** (aus `resourceType.densityType`), **rarity** (aus Kompositions-Namensschema `<rarity>shipmineables_*`), **scanSignature** (element-spezifische `mineablerock_*_<erz>`), groundScanSignature, **qualityBands** (`crafting/qualityquantization/quantization_<erz>`) — alle byte-genau zu scmdb |
| `datamine-locations.mjs` | `mining-locations-gamefiles.json` | Fundorte je Erz + Abundance + Fund-Chance + Bodies (Reverse), Kette `providerpreset → harvestablepreset → mineablerock → composition → element` |
| `datamine-gear.mjs` | `mining-gear-gamefiles.json` | 17 Laser (DPS = `FireBeam.damagePerSecond.DamageEnergy`), 26 Module, 6 Gadgets — Mods aus `MiningLaserModifier`, Namen/Hersteller aus `Localization/english/global.ini` |

`build-mining-model.mjs` + `build-mining-db.mjs` assemblieren daraus die getrackten
`assets/mining-model.json` + `assets/mining-db.json`. Kuratierte Attribute
(code/kind/weight_scu, Planeten-Anzeigenamen) in `assets/mining-curated.json` bzw. im
Build (Starmap-Zuordnung, nicht rein im Mining-DataCore).

**Geliehen (`assets/mining-frozen.json`, aus scmdb 4.9): nur EIN Feld.**

- **Refinery-Yield-Profile** — serverseitige CIG-Economy, steht prinzipiell in keinem Client.

**Edelstein-Seltenheit** gibt es in den Spieldaten gar nicht: ein `rarity`-Feld existiert
nirgends: die Erz-Seltenheit kommt allein aus der Datei-Namenskonvention
(`<rarity>shipmineables_<erz>`), die die Gems (`fps_composition_<gem>deposit`) nicht haben —
scmdb ist für sie ebenfalls leer. Gems bleiben also bewusst ohne Stufe (das ist game-korrekt,
kein fehlender Wert). density, scanSignature und qualityBands sind game-sourced (in
`mining-frozen.json` nur noch Fallback).

## Der Beweis

Jeder Extraktor hat einen `--verify`-Modus, der die eigene DataCore-Extraktion gegen
LIVE-scmdb (gleicher Patch, 4.9.0-live.12232306) prüft — 0-Diff = byte-genau:

- **Physik + Kompositionen:** 39/40 Elemente, 63 Kompositionen, **0 Abweichungen**.
- **Fundorte:** 30/33 Elemente identisch (system+abundance-Multiset); die 3 Reste sind
  eine Event-Location außerhalb `providerpresets/system` (Nyx „Breaker Stations").
- **Gear:** Laser 15/15 DPS, Module 26/26, Gadgets 6/6 Mods == scmdb (DPS-Einzelabw. =
  live-4.9 maßgeblich, scmdb-Lag).

Der GUID-Abgleich beachtet, dass der DataCore die GUID als zwei little-endian uint64
speichert (beide 8-Byte-Hälften byteweise umgedreht = scmdb/unforge-Format).

## Frisch halten

- `npm run sync:mining` — alle drei Extraktoren + Build + Asset-Spiegelung (Patch-Day,
  braucht lokale SC-Installation; Pfad via `SC_P4K` überschreibbar).
- `npm run refresh:mining` — dasselbe + Thumbnails/Downloads + `astro build`.
- `npm run verify:mining` — Integritäts-/Konsistenz-Check der committeten JSONs (ohne
  scmdb/p4k): Namen-Joins, Physik-Vollständigkeit, Laser-DPS, Refineries, Body-Refs,
  game_version. Bricht bei jeder Inkonsistenz ab.
- `npm run freeze:mining` — die vier eingefrorenen Felder neu aus scmdb ziehen (nur
  nötig, wenn CIG Refinery-Economy/Signaturen ändert — selten).

## Client-vs-Server-Grenze

„~95 % self-sourced" heißt praktisch: **alles Client-Extrahierbare** (Physik,
Kompositionen/%, Fundorte, Signaturen[Boden], rarity[Erze], density, Gear, Params)
aus der eigenen `Data.p4k`, plus **genau EIN Feld aus dem geprüften scmdb-4.9-Snapshot**:
die **Refinery-Economy** (steht in KEINEM lokalen Client). Alles andere — auch density,
scanSignature und qualityBands — kommt aus den eigenen Spieldateien. Die Edelstein-Seltenheit
existiert in den Spieldaten überhaupt nicht und wird bewusst leer gelassen.
