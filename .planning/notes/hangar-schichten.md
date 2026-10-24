# Hangar: fehlende Karten der Schichten im Wartungsplatz (2026-10-21)

Läuft mit im Auftrag **„Hangar-Flotte“** ([`hangar-flotte.md`](hangar-flotte.md),
Teil D). Der eigene Satz „Hangar-Schichten“ wurde nie vergeben.

Anlass, Krisz 2026-10-20 17:32: „es fehlen auch texturen bei den assets“.
Teil 2 von „Hangar-Werte“ hat Katalog v2 geliefert
([`hangar-requisiten.md`](hangar-requisiten.md), Befund PC). Die Cloud hat
daraus die Schichten im Wartungsplatz gebaut (PR „Wartungsplatz mit den
Schichten des Spiels“):
- Blend-Karte mischt die vier Grundschichten, die Abnutzungskarte legt die
  Abnutzungsschicht darüber, B der Vertexfarbe verschattet.
- Die erste Grundschicht trägt ihre Detail- und Normalenkarte, wenn die
  Karte ein Muster hat (Standardabweichung über 4 von 255).
- Alles in einem Material, ohne Zeichenbefehl mehr. Das Tor
  `verify:hangar-hall` [14] prüft Tafel, Raster und jede Zeile gegen den
  Katalog.

Es gelten die Regeln aus [`hangar-katalog.md`](hangar-katalog.md): Karten
aus dem Spiel, höchstens 256 px, als `.webp`; keine Roh-Exporte und kein
`.mtl`-XML im Repo.

## S1. Fehlende Abnutzungskarten (TexSlot11)

Von 9 Abnutzungskarten, die die Materialien des Wartungsplatzes nennen,
liegt nur `universal_shared_4_a_wear.webp` in
`public/hangar/props/schichten/`. Ohne Karte bleibt die Zeile ohne
Abnutzung (Spalte 3: Zeilen des Satzes, die sie bräuchten):

| Karte (TexSlot11) | Zeilen |
|---|---|
| `utilitarian_blend_1_a_wear` | 20 |
| `utilitarian_1_cloth_a_wear` | 5 |
| `wda_shared_1_a_wear` | 4 |
| `universal_shared_1_a_wear` | 4 |
| `cryostaging_panelline_1_a_wear` | 3 |
| `lowtech_storage_panellines_2_wear` | 3 |
| `universal_shared_3_a_wear` | 1 |
| `storage_tank_1_a_wear` | 1 |

Bitte als `<Dateiname>.webp` (wie TexSlot11, Endung `.webp`) in denselben
Ordner. Am besten gleich alle TexSlot11 aller LayerBlend-Materialien des
Katalogs, damit neue Requisiten sie schon haben.

## S2. Schmutz (Kanal der Vertexfarbe ungeklärt)

Die Cloud lässt Schmutz aus: Sie weiß nicht, welche Farbe oder Karte
LayerBlend_V2 dafür nimmt. Gesucht: Woher kommt der Schmutz (eigene
Schicht, globale Karte, Wert in den PublicParams)? Wenn es eine Karte oder
Farbe gibt: in den Katalog (`materials[].dirt` oder unter `schichten`).

## S3. Abnutzung: welche Richtung

Die Cloud nimmt an: Abnutzung beginnt in den dunklen Kratzern der
Abnutzungskarte und wächst mit R der Vertexfarbe (R 0 = keine, R 1 =
überall). Belegt ist das nicht. Gesucht: ein Beleg aus den
Shader-Definitionen oder Standardwerte für `WearBlendBase` /
`WearBlendFalloff` bei LayerBlend_V2. Falls das Spiel es umgekehrt macht
(helle Stellen zuerst), genügt ein Satz im Befund.

## S4. Glatte Normalenkarten

Viele Normalenkarten der Schichten sind in der Ablage völlig glatt (r und g
konstant 128, z. B. `noise_speckled_01_ddna`, `polished_surface_02_ddna`,
`grunge_medium_01_ddna`); das Muster steht nur in der Glätte (Alpha). Bitte
prüfen, ob sie auch in der Quelle glatt sind oder ob der Export die
Normalen verloren hat (BC5 nur rg, falsche Mip-Stufe). Wenn der Export:
neu ablegen.

## Befund PC

(leer)
