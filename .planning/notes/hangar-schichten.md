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

Lauf „Hangar-Flotte“, Teil D, 24.10.2026, Branch `pc/hangar-flotte`.

### S1. Abnutzungskarten

`scripts/build-hangar-wearmaps.mjs` (neu) legt jede TexSlot11-Karte, die ein Material in `katalog.json` nennt, als `public/hangar/props/schichten/<Dateiname>.webp` ab: ≤ 256 px, mip 1, Name wie TexSlot11, klein, Endung `.webp`.

- 62 Karten genannt, 1 lag schon (`universal_shared_4_a_wear`), 61 sind neu, keine fehlt.
- Darunter alle neun aus der Tabelle oben.
- Bei Glas und Displays (GlassPBR, DisplayScreen) ist TexSlot11 die Schmutzkarte (`…_dirt_diff`). Sie liegt mit im Ordner.
- Neue Requisiten bekommen ihre Karte, wenn das Skript nach dem Katalog-Bau noch einmal läuft.

### S2. Schmutz

Bei LayerBlend_V2 steht kein Schmutz in den Daten:
- **Material:** Keines der 647 LayerBlend_V2-Materialien im Katalog (von 1 110) trägt Schmutzwerte. Weder `DirtColor`, `DirtBlendBase`, `DirtBlendFalloff` noch eine Schmutzkarte.
- **Schicht-Dateien:** Sie tragen nur `WearDirtBlendFalloff`, einen gemeinsamen Übergang für Abnutzung und Schmutz, in allen 186 Schicht-.mtl. Werte stehen in `schichten[path].params`.
- **Shader-Definition:** Sie nennt nur die Maske `%WEAR_DIRT_AO_VERTEX`.

Damit kommt der Schmutz bei LayerBlend vermutlich aus der Vertexfarbe; der Kanal ist nicht belegt (Hangar-Werte, siehe `hangar-requisiten.md`, vermutlich G), und eine Schmutzfarbe steht nicht in den Spieldateien (vermutlich eine Vorgabe der Engine, ebenfalls nicht belegt). Eine Karte oder Farbe für `materials[].dirt` gibt es nicht.

Eigene Schmutzwerte haben nur andere Shader:
- GlassPBR und DisplayScreen: `DirtBlendBase`, `DirtBlendFalloff`, `DirtTiling`, `DirtBlendMask` und die Schmutzkarte in TexSlot11 (18 Materialien).
- HardSurface mit `WEAR_LAYER`: `DirtColor` (2 Materialien).

### S3. Abnutzung: Richtung

Für LayerBlend_V2 nicht belegbar.
- Kein LayerBlend-Material trägt `WearBlendBase` oder `WearBlendFalloff`. Diese Werte stehen nur bei HardSurface (`WearBlendBase` 46), GlassPBR, DisplayScreen und MeshDecal.
- Eine Vorgabe des Shaders liegt nicht im Spiel. `ShaderCache_EXT.pak` enthält nur die Masken mit Beschreibung, keine Quelltexte.
- Belegt ist bei LayerBlend nur:
  - die Abnutzungskarte in TexSlot11;
  - die eigene Abnutzungsschicht `WearLayer1` in den MatLayers, mit Tönung und Glätte;
  - je Schicht-Datei die Werte für die abgenutzte Stelle (`WearDiffuseColor`, `WearSpecularColor`, `WearGlossiness`) und `WearDirtBlendFalloff`.
- Ob dunkle oder helle Stellen der Karte zuerst abnutzen, steht nirgends. Die Annahme der Cloud bleibt Annahme.

### S4. Glatte Normalenkarten

Die drei geprüften Karten sind im Spiel glatt; für sie hat der Export nichts verloren. Volle Stufe (mip 0, 512 px) direkt aus dem Archiv dekodiert:

| Karte | R | G | Alpha (Glätte) |
|---|---|---|---|
| `noise_speckled_01_ddna` | 127, Streuung 0,0 | 127, Streuung 0,0 | Mittel 237, Streuung 9,6 |
| `polished_surface_02_ddna` | 127, Streuung 0,1 | 127, Streuung 0,1 | Mittel 221, Streuung 3,4 |
| `grunge_medium_01_ddna` | 127, Streuung 0,0 | 127, Streuung 0,0 | Mittel 231, Streuung 11,8 |
| Gegenprobe `noise_scratched_01_ddna` | 124, Streuung 7,6 | 126, Streuung 6,4 | Streuung 22,7 |

Das Muster steckt bei diesen Karten nur in der Glätte.
