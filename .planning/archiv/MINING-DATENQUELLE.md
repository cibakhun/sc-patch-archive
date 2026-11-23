# Mining-Datenquelle & Exaktheits-Beweis (Patch 4.9)

**Kurz:** Die Mining-Daten kommen zu ~95 % aus der **eigenen Extraktion der lokalen
`Data.p4k`** — node-nativ über einen selbstgeschriebenen DataCore-Reader, ohne
unp4k/unforge und ohne Live-Abhängigkeit von scmdb/UEX. Nur vier Felder, die nicht
sauber im Client-DataCore liegen, sind als gelabelte Konstanten aus einem letzten
scmdb-4.9-Zug eingefroren. Preise werden bewusst **nicht** angezeigt (serverseitig,
volatil, nicht game-verifizierbar).

## Woher die Daten kommen

Patch-Kennung aus dem Client-`build_manifest.id`: **`4.9.0-live.12344265`**
(Branch `sc-alpha-4.9.0`, Client-Stand 2026-08-05, Extraktion 2026-08-14).

**Eigene Extraktion (node-nativ, `scripts/lib/p4k.mjs` + `scripts/lib/datacore.mjs`):**

| Skript | Ausgabe | Inhalt |
|---|---|---|
| `datamine-mining.mjs` | `mining-gamefiles.json` | Element-Physik, Kompositionen (die „bis X %"), Global-Params, **density** (aus `resourceType.densityType`), **rarity** (aus Kompositions-Namensschema `<rarity>shipmineables_*`), **scanSignature** (element-spezifische `mineablerock_*_<erz>`), groundScanSignature, **qualityBands** (`crafting/qualityquantization/quantization_<erz>`) — alle byte-genau zu scmdb |
| `datamine-locations.mjs` | `mining-locations-gamefiles.json` | Fundorte je Erz + Bodies (Reverse), Kette `providerpreset → harvestablepreset → mineablerock → composition → element`. Je (Erz, Fundort, Methode) **aggregiert**: `chance` = Summe der Deposit-Wahrscheinlichkeiten, `maxShare` = höchster Massenanteil („bis X %"), `eff` = Erwartungswert des Anteils (rangbildend) |
| `datamine-gear.mjs` | `mining-gear-gamefiles.json` | 17 Laser extrahiert (DPS = `FireBeam.damagePerSecond.DamageEnergy`), 26 Module, 6 Gadgets — Mods aus `MiningLaserModifier`, Namen/Hersteller aus `Localization/english/global.ini`. **14 Laser erreichen den Fracturing-Rechner:** 2 ohne Localization-Namen (`mining_laser_shin_hofstede_s0`, S0, Shubin Interstellar; `mining_laser_thcn_helix_s0`, S0, Thermyte Concern) werden bewusst ausgelassen statt mit erfundenem Namen ausgeliefert — sie stehen mit Klassenbezeichnung in `assets/mining-model.json.omitted[]`; ein drittes Geraet (Pitman, `builtIn`) ist Standardausruestung und taucht im Rechner nicht als waehlbare Option auf. |

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
LIVE-scmdb (gleicher Patch, 4.9.0-live.12326004) prüft — 0-Diff = byte-genau:

- **Physik + Kompositionen:** 39/40 Elemente, 63 Kompositionen, **0 Abweichungen**.
- **Fundorte:** seit der Korrektur unten wird das `(System, Chance, Anteil)`-Multiset über
  **alle** Fundorte verglichen, nicht mehr nur über die Top-5 je System. Der Lauf braucht
  Netzzugriff auf scmdb und ist nach dem Umbau **noch nicht ausgeführt** —
  `node scripts/datamine-locations.mjs --verify` steht aus.
- **Gear:** Laser 15/15 DPS, Module 26/26, Gadgets 6/6 Mods == scmdb (DPS-Einzelabw. =
  live-4.9 maßgeblich, scmdb-Lag).

Der GUID-Abgleich beachtet, dass der DataCore die GUID als zwei little-endian uint64
speichert (beide 8-Byte-Hälften byteweise umgedreht = scmdb/unforge-Format).

## Korrektur 08/2026 — Fundort-Ebene

Die Fundort-Daten waren bis dahin an drei Stellen falsch. Alle drei sind behoben:

1. **Gekappt.** `topLocs()` behielt nur die Top-5 Fundorte je System. Die Element-Sicht
   trug dadurch 273 statt 521 (Erz × Fundort)-Paare — knapp die Hälfte fehlte. Die
   Werkbank liest genau diese Sicht, zeigte also die halbe Wahrheit. Agricium: 10 → 21
   Fundorte. Insgesamt gewinnen 28 der 37 Erze Fundorte, keines verliert welche.
2. **Zwei widersprechende Wahrheiten.** Vorwärts- (`minerals[].locations`) und
   Rückwärtssicht (`bodies[].minerals`) wurden getrennt aufgebaut und wählten je
   (Erz, Fundort) ein *anderes* Deposit aus — die eine nach Ertrag, die andere nach
   Wahrscheinlichkeit. 163 gemeinsame Paare trugen dadurch unterschiedliche Werte
   (Agricium @ Lagrange: 74 hier, 16 dort). Beide Sichten stammen jetzt aus **einer**
   aggregierten Menge und sind per Zusicherung deckungsgleich.
3. **`abundance` war nie eine Häufigkeit.** Das Feld trug `Math.round(part.max)`, also
   die Kompositions-Obergrenze — je Erz oft an allen Fundorten identisch und damit als
   Rangkriterium wertlos. Es heißt jetzt `maxShare`, behält eine Nachkommastelle
   (74,3 statt 74) und wird von `eff` als rangbildender Größe begleitet.

Zwei Rechenfehler kamen beim Umbau ans Licht und sind mitbehoben: ein Element darf in
derselben Komposition mehrfach stehen — seine Wahrscheinlichkeit wurde dann doppelt
gezählt (Daymar: 104,3 %) — und ein Deposit mit `relativeProbability = 0` erzeugte einen
Fundort, an dem nie etwas spawnt (Feynmaline @ Euterpe).

Warum es niemandem auffiel: Der `--verify`-Modus leitete die scmdb-Seite mit *derselben*
Top-5-Auswahl ab und verglich sie gegen die eigene — er prüfte die Kappung gegen sich
selbst und meldete 0-Diff. `verify:mining` hielt die beiden Sichten nie gegeneinander.
Beides ist jetzt umgestellt; die Paar-Zusicherung in `verify-mining.mjs` ist gegen sechs
gezielte Manipulationen als rot vorgeführt.

## Bekannte Lücken (bewusst offen, nicht geraten)

- **`weight_scu`: 25 von 37 leer.** Das Frachtgewicht steht in keiner Spieldatei — die
  12 belegten Werte sind handgepflegt in `mining-curated.json`. `density` aus dem
  DataCore ist etwas anderes (Materialdichte im Gestein) und taugt nicht als Ersatz.
- **`Diamond`** hat volle Physik im DataCore, aber keinen providerpreset-Fundort und
  keinen kuratierten Eintrag → nicht in `mining-db.json`. Der Generator benennt es beim
  Lauf, statt es still zu verwerfen.
- **Carinite, Jaclium, Sadaryx, Saldynium** haben keine providerpreset-Fundorte
  (Höhlen-/Event-Deposits). Ihre Abbaumethode ist kuratiert, `methods[]` wird daraus
  gefüllt, damit sie nicht durch jeden Filter fallen.
- **15 Deposits ohne auflösbare Komposition** werden übersprungen und beim Lauf gemeldet:
  13 aus `Harvestables` (Sammel-Objekte, keine Erze) und 2 Gold-Deposits an
  Resource-Rush-Event-Orten.
- CIG führt neben `Harvestables` eine Gruppe **`Havestables`** (Tippfehler in den
  Spieldaten). Beide enthalten keine abbaubaren Elemente — für die Mining-DB folgenlos.

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
