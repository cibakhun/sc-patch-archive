# Hangar: Alle Werte der Loadout-Werkstatt

Anlass: Krisz 2026-10-20 13:48: „ich würde sagen wir machen noch ein advanced loadout manager tab oder so wo man halt alle werte genau sieht, projectile speed, rpm, alle stats halt eben. das was wir jetzt haben ist wenn man sich schon auskennt eine ganz schnelle möglichkeit sein loadout zusammen zu stellen“.

## Stand Cloud (PR „Alle Werte“, 20.10.)

Die Werkstatt hat die Ansicht **Schnell | Alle Werte**. Unter „Alle Werte“ steht, was `assets/universal-items.json` heute je Teil führt:

- Waffe: Schaden je Schuss nach Art, Feuerrate, Magazin, Magazin leer nach, Haltbarkeit.
- Rakete, Torpedo, Bombe: Schaden nach Art, Zielsuche, Explosionsradius, Scharf nach, Zündung, Flugzeit.
- Schild: HP, Aufladung, Pause nach Treffer, Neustart nach Ausfall.
- Quantum: Geschwindigkeit, Abkühlung, Verbrauch, Beschleunigung Stufe 1 und 2.
- Alle Teile: Haltbarkeit und Ladenpreis.
- Für das ganze Layout: Feuerkraft, Schaden je Salve, DPS je Art, Raketenschaden und -anzahl, Schild, Aufladung, Leistung, Kühlung, Quantum.

Die Seite sagt offen: „Noch nicht dabei: Projektilgeschwindigkeit, Reichweite, Hitze und Stromverbrauch.“ `scripts/datamine-items.mjs` liest bei Schiffswaffen nur Schaden, Feuerrate und Magazin. Geschwindigkeit, Lebensdauer, Hitze und Strom stehen in denselben Records, werden aber nicht übernommen.

## Auftrag PC (Hangar-Werte)

1. `git fetch origin staging`, eigener Branch von `origin/staging`.
2. **`scripts/datamine-items.mjs` erweitern**, je Schiffs-Bauteil in `game.stats` bzw. `variants[].stats`, nur gesetzte Werte, gerundet wie die übrigen:
   - **Schiffswaffen (Guns).** Aus den Ammo-Params (`ammoParamsRecord`, wie `ammoDamageFromRef`):
     - `speed` (m/s) und `lifetime` (s), daraus `range` = speed × lifetime (m).
     - Aus der Waffe:
       - `heatPerShot` und die Überhitzungsgrenze (`maxTemperature` / `overheatTemperature`, wie das Spiel sie nennt).
       - Strombedarf `powerDraw` (Ressourcen- bzw. Power-Komponente, Verbrauch in Betrieb).
       - Streuung `spreadMin`/`spreadMax` (Grad), wenn vorhanden.
       - Bei Energiewaffen Ladungen bzw. Kapazitor (`ammoLoad`, `regenPerSec`) statt Magazin.
     - Hat eine Waffe mehrere Feuermodi, den Standardmodus nehmen und die anderen als `modes: [{ name, fireRate, dps }]`.
   - **Raketen, Torpedos, Bomben:**
     - `speed` (m/s, Höchstgeschwindigkeit), `lockRange` (m), `lockTime` (s), `lockAngle` (Grad).
     - Bei Bomben nur, was es gibt.
   - **Schilde:** Widerstände je Schadensart (`resist: { physical, energy, distortion }`, wie im Spiel als Anteil) und Absorption, wenn getrennt geführt.
   - **Generator, Kühler, Schild, Quantum, Radar:**
     - `powerDraw` bzw. Leistungsbedarf.
     - Signaturen `em` und `ir`, wenn das Bauteil sie setzt.
     - Beim Quantum zusätzlich die Spool-Zeit (`spoolTime`).
3. Datenlauf und `npm run gate:data`. Danach `npm run build && npm run gate`.
4. **Selbstauskunft mit der üblichen Kopfzeile.** Je neuem Schlüssel die Zahl der Bauteile, die ihn tragen. Dazu Stichproben mit Werten:
   - Mantis GT-220
   - CF-337 Panther
   - Revenant S3
   - Arrester III
   - FR-66
   - Atlas
   
   Ablage hier unter „Befund PC (Hangar-Werte)“.
5. Push auf den eigenen Branch, ohne PR. Den Einbau in `src/lib/hangar/layouts.ts` (`figures`), die Anzeige und den Merge nach staging macht die Cloud.
6. **Im selben Lauf Teil 2:** Requisiten mit allen Schichten und mehr Requisiten, Auftrag in [`hangar-requisiten.md`](hangar-requisiten.md) („Auftrag PC (Hangar-Werte, Teil 2: Requisiten)“). Gleicher Branch, eigener Befund dort.

Keine Datenherkunft im sichtbaren Text (`audit:site`).

## Befund PC (Hangar-Werte)

=== datamine-items: Werte-Erweiterung · Patch 4.10.2-live.12913470 · Branch `pc/hangar-werte` ===

Alle Werte stehen in `game.stats` bzw. `variants[].stats` von `assets/universal-items.json`. Es gibt nur gesetzte Werte, kein Auffüllen. Gerundet ist wie bisher: zwei Stellen, `lifetime` bei Waffen drei, `range` auf ganze Meter.

### Neue Schlüssel und Zahl der Bauteile

| Typ | Schlüssel | Bauteile | Quelle im Record |
|---|---|---|---|
| Schiffswaffe | `speed` m/s, `lifetime` s, `range` m (= speed × lifetime) | 161 | Munition: `speed`, `lifetime` |
| Schiffswaffe | `spreadMin`, `spreadMax` (Grad) | 157 | erste Feuer-Aktion, `launchParams.spreadParams.min/max` |
| Schiffswaffe | `heatPerShot` | 63 | erste Feuer-Aktion |
| Schiffswaffe | `overheatTemperature`, `coolingPerSecond`, `overheatFixTime` | 58 | `connectionParams.simplifiedHeatParams` |
| Schiffswaffe | `ammoLoad`, `regenPerSec`, `regenCooldown` (Energiewaffen) | 96 | `weaponRegenConsumerParams.maxAmmoLoad / maxRegenPerSec / regenerationCooldown` |
| Schiffswaffe | `powerDraw` / `em` | 153 / 128 | Ressourcen-Zustand „Online“ |
| Rakete, Torpedo | `speed` | 63 | `GCSParams.linearSpeed` |
| Rakete, Torpedo | `lockRange` (max) / `lockRangeMin`, `lockTime`, `lockAngle` | 63 | `targetingParams.lockRangeMax/Min, lockTime, lockingAngle` |
| Schild | `resist`, `absorb` je `physical/energy/distortion` als `[min, max]` | 61 | `ShieldResistance`, `ShieldAbsorption` |
| Schild | `powerDraw`, `em` | 61 | Online-Zustand (Umwandlung von Power) |
| Kühler | `powerDraw`, `em`, `ir` | 76 | Online-Zustand |
| Generator | `em` | 80 | Online-Zustand (verbraucht keinen Strom) |
| Quantum | `powerDraw`, `em`, `spoolTime` | 58 | Online-Zustand; `params.spoolUpTime` |
| Radar | `powerDraw` / `em` | 62 / 63 | Online-Zustand |

Zu den Spalten:
- `powerDraw` ist der Verbrauch der Ressource Power im Zustand „Online“. Die Einheit hängt vom Bauteil ab: Schilde führen Segmente (`units`), die übrigen Bauteile Standard-Einheiten. Die Werte sind deshalb nur innerhalb eines Typs vergleichbar.
- `modes` (weitere Feuermodi): 0 Bauteile. Keine Schiffswaffe dieses Builds hat mehr als eine Feuer-Aktion. Mehrere haben nur die Bergbaulaser, und die zählen als Bergbau, nicht als Schiffswaffe. Der Code dafür ist da.
- Bomben (3) tragen weder Lenkung noch Aufschaltung. Sie führen ihre Werte als `SCItemBombParams` und bekommen jetzt `lifetime`, `armTime` und `igniteTime`.

### Korrektur: Raketenschaden

Bisher kam der Schaden aus dem ersten `ExplosionParams` im Record. Das ist die Todes-Explosion der Health-Komponente, also der Abschuss der Rakete selbst, und sie ist für alle Raketen einer Größe gleich. Jetzt kommt der Schaden aus dem Sprengkopf, `SCItemMissileParams.explosionParams`.
- 61 Raketen und Torpedos ändern Schaden und `blastRadius`.
- Beispiele:
  - Arrester III: 2 526 + 37,5 thermisch → **3 200**, Radius 4,88 → 6.
  - Assailant IV: 4 255 → 6 500.
  - Assailant IV-G: 4 255 → 7 400.
  - Calamity XII-CS: 45 677 → 1 150 000.
- Bomben: Auch hier kam der Schaden aus der Todes-Explosion. Der Sprengkopf hat dieselben Werte, nur ohne den Thermalanteil. Colossus, Stormburst und Thunderball verlieren deshalb 125, 62,5 und 37,5 thermisch.

### Stichproben

| Bauteil | Werte |
|---|---|
| Mantis GT-220 Gatling (S3) | 1 600 rpm, 32 phys., DPS 853,33; speed 1 332, lifetime 1,8, **range 2 398**; heatPerShot 0,512, Überhitzung bei 100, Kühlung 40/s, Abkühlen nach Überhitzung 2,61 s; Streuung 0,6°; powerDraw 0,1, em 36 |
| CF-337 Panther Repeater (S3) | 750 rpm, 43,65 Energie, DPS 545,63; speed 1 480, lifetime 1,3, **range 1 924**; ammoLoad 75, regenPerSec 15, regenCooldown 0,74 s; Streuung 0,6°; powerDraw 1; keine Hitze je Schuss |
| Revenant Gatling S3 / S4 / S6 | range 2 166 / 2 799 / 6 002; speed 1 345,5 / 1 296 / 1 215; heatPerShot 0,435 / 0,531 / 2,37; Streuung 0,518 / 0,525 / 0,69°; em 30 / 33 / 36 |
| Arrester III (Rakete S3) | speed 857,5; lockRange 25 000 (min 1 900), lockTime 1 s, lockAngle 60°; Schaden 3 200 phys., Radius 6 |
| FR-66 (Schild S1) | resist physical [0; 0,25], distortion [0,75; 0,95]; absorb physical [0; 0,45], energy [1; 1], distortion [1; 1]; powerDraw 3, em 1 240 |
| Atlas (Quantum S1) | spoolTime 4,2 s, powerDraw 2, em 18 000 |
| Weitere | AbsoluteZero (Kühler): powerDraw 3, em 1 230, ir 7 850. Bolide (Generator): em 9 900. Abetti (Radar): powerDraw 4, em 1 280 |

### Nebenwirkungen

- **Repräsentanten im Dedupe.** Die neuen Schlüssel zählen nicht in die Wahl des Repräsentanten (`score`). Sonst wäre bei Gleichstand ein anderer Record gewählt worden: GVSR Repeater hätte 120 SCU Volumen bekommen, Radar eine andere guid. Gegen den Vorstand hat sich jetzt kein Item außerhalb von `stats`/`variants` geändert. 551 Items haben geänderte Werte.
- **Client.** Der installierte Client ist der 4.10.2-Nachbau 12913470. Der Katalog nennt jetzt diesen Stand. Sieben Items kommen neu dazu: Constellation Mk IV Andromeda/Aquila/Phoenix/Phoenix Emerald/Taurus, Constellation Mk V Centaurus und Skylark.
- **Datenstand.** Missionen, Mining, Crafting, Refinery, Zerlegung und Wikelo stehen auf 12881860. Das sind 31 610 Changelists Abstand bei einer Toleranz von 10 000. Sie stehen als benannte Ausnahmen in `verify-datastand.mjs`. Beim nächsten vollständigen Datenlauf reißt der Zombie-Wächter dort, und die Ausnahmen kommen raus.
- **Nicht übernommen.** `datamine:vehicles` und `datamine:paints` lagen für `gate:data` als Zwischenstufe vor. Ihre geänderten `vehicles.json`, `ship-loadouts.json` und `ship-paints.json` habe ich verworfen; sie gehören zum nächsten Datenlauf.

### Tore

- `npm run gate:data` grün (4/4).
- `npm run build && npm run gate` grün (28/28).
- Mit `STAGING=1` ebenfalls grün (28/28).
