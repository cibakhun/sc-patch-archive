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
