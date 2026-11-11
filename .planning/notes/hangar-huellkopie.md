# Hüllkopien in Innenraum-Containern (10.11.2026)

Anlass: Krisz, 10.11.2026, Screenshot des Ursa Medivac in der Halle:
„madivac ist komplett broken“. Zu sehen: die rote Hülle und darüber eine
braune zweite, Teile versetzt, ein Rad scheint zu schweben.

## Ursache 1: die eigene Hülle als Teil des Innenraums

Der Container `medivac_int` setzt unter seinen 25 Teilen auch
`Objects/Spaceships/Ships/RSI/Ursa/RSI_Ursa_Rover.cga`, die Rumpfdatei
des Fahrzeugs selbst. StarBreaker legt dafür die ganze Rumpfdatei in den
Container. Mit dem Versatz des Containers (placeContainers) steht sie als
zweite Karosserie 1,5 m vor und 0,6 m neben der echten. Ihre Farbe ist
die Palette des Containers (`rsi_ursa_default`, braun). Im Spiel gibt es
diese zweite Hülle nicht.

Suche über alle 231 Rohexporte (Stand 4.10.2, `ships-dec`, Netzname =
Datei, Vergleich mit `root_entity.geometry_path` aller Fahrzeuge): neun
Schiffe tragen eine solche Kopie. Das sind Ursa Medivac, Argo SRV (6 Knoten),
Crusader Intrepid, Drake Corsair, Guardian, Guardian QI, Guardian MX (die
Hülle des Guardian), Aurora Mk II (5) und Zeus CL (2). Sichtbar war nur der
Medivac. Bei den anderen fiel der Innenraum im Rumpf weg (dropInterior), und
die begehbare Innenraum-Datei wirft Teile außerhalb der Hülle ab
(keepInteriorOnly).

Behoben:

- **Bauregel** `dropBodyCopies` in `scripts/build-hangar-assets.mjs`,
  Rechnung in `scripts/lib/hangar-huellkopie.mjs`. Sie nimmt vor
  placeContainers jedem Knoten unter einem `interior_*`-Container das Netz,
  wenn es eine Fahrzeug-Rumpfdatei ist. Gemeint ist die eigene
  (`extras.geometry_path` an der Wurzel) oder die eines anderen Fahrzeugs
  aus `ships-dec`. trisRaw zählt die Kopie weiter, damit dropInterior gleich
  entscheidet. Das Manifest trägt `bodyCopies` (Knoten, Dreiecke, Dateien),
  der Bau meldet sie im Protokoll. Verloren geht nichts: Gehört die Datei
  dem Schiff selbst, trägt der Rumpf jedes ihrer Teile schon an der
  richtigen Stelle.
- **Medivac in der Cloud korrigiert:** `interior_part_23` (13 271 Dreiecke,
  Material `rsi_medivac_mtl_Painted_Metal_Tiled_Grey_021`) aus
  `public/hangar/ships/rsi-ursa-medivac.glb` entfernt, ungenutzte
  Netze, Materialien und Bilder mit. Danach 201 698 Dreiecke statt 214 969
  und 219 Bilder statt 223. Der nächste Neubau am PC erzeugt dasselbe über
  die Bauregel. Dock-Bild und Draufsicht neu: Maße 5,5 × 7,8 × 3,5 m statt
  5,5 × 9,3 × 4,7 m, jetzt so lang wie der Ursa Rover.
- **Tor** `verify:hangar-lage` [5] (Rechnung `overhang` in
  `scripts/lib/hangar-lage.mjs`, Fassung `hangar-lage 3`): Kein
  Innenraumteil im Rumpf (`extras.interior`) darf mehr als 0,5 m über den
  Hüllquader des übrigen Rumpfs ragen, außer mit benannter Ausnahme. Die
  Kopie hing an der echten Hülle, war also für [4] keine Insel, und [2]
  misst nur den begehbaren Innenraum. Vorgeführt rot mit dem alten Medivac:
  `[5] rsi-ursa-medivac: 1 Innenraumteile ragen ueber die Huelle
  (interior_part_23 13271 Dr. 1.5 m, …)` und `6 Schiffe …, Klinke 5`.
  Benannte Ausnahmen: die vier Avenger (Feuerlöscherschrank über dem Dach,
  1,52 m, dieselbe Stelle wie ihre Ausnahme der losen Teile) und die 325a
  (Innenraumteil 32 m seitlich, ebenso).

## Ursache 2: vertauschte Netze bei wiederholten Teilen (offen)

Beim Medivac fehlen zwei der sechs Reifen. An ihrer Stelle sitzt ein
unterer Querlenker (`bottom_arm`). Das ist das „schwebende Rad“ im
Screenshot. Grund: Wird dieselbe .cga mehrfach gesetzt (sechs Radaufhängungen),
tragen im Rohexport einzelne Knoten das Netz des nächsten Exemplars, um
eins verschoben. Beim Ursa tragen die `tyre`-Knoten von wheel4 und wheel5 das
`bottom_arm`-Netz. Über alle 231 Rohexporte sind 217 Schiffe betroffen,
mit 4 892 Knoten.

**Bauregel** `repairSwapped` in `scripts/build-hangar-assets.mjs`, Rechnung
in `scripts/lib/hangar-netztausch.mjs`. Sie läuft für Rumpf und Innenraum
als erster Schritt, vor Fahrwerk und Containern. Erkennt sie ein Netz, das
zwei verschieden benannte Knoten benutzen und das den Namen des einen trägt,
gibt der andere Knoten es ab. Ersatz liefert ein Knoten gleichen Namens,
dessen Netz seinen Namen trägt, mit der längsten gleichen Ahnenkette, beim
Ursa wheel6 für wheel4 und wheel3 für wheel5. Ohne Ersatz wird das falsche
Netz abgenommen. Das Manifest trägt `swapFix` (Knoten, ersetzt, abgenommen,
falsch gesetzte Dreiecke).

Geprüft am PC gegen den Rohexport des Medivac: 4 Knoten (zwei Reifen,
barrel_03 und pitch_part am Geschütz), alle 4 ersetzt. Danach stehen alle
sechs Reifen an ihrem Rad, je 0,74 × 1,87 × 1,87 m.

**Ersatz auch bei mitbenutztem Netz (11.11.2026).** Die erste Fassung nahm
als Ersatz nur einen Knoten, dessen Netz kein anders benannter Knoten
mitbenutzt. Der erste Neubau aller Schiffe zeigte, was das kostet: Beim
Gladius trägt die Rakete im ersten Werfer den Werferkörper des zweiten
(`missile` mit Netz `bodye`). Die Rakete im zweiten Werfer trägt ihr eigenes
Netz, das dort aber auch der verschobene `bone1b_s3s2` benutzt. Sie fiel als
Ersatz aus, die erste Rakete verlor ihr falsches Netz und blieb leer. Ein
Netz, das den Namen seines Knotens trägt, gehört ihm aber, auch wenn ein
verschobener Nachbar es mitbenutzt. Über alle 231 Rohexporte:

| Fassung | ersetzt | ohne Ersatz | davon Raketen |
|---|---|---|---|
| streng (kein Mitbenutzer) | 3 538 | 1 354 | 284 auf 61 Schiffen |
| Name gleich | 4 157 | 735 | 26 |

Was ohne Ersatz bleibt, sind vor allem dritte Leitflossen (`fin03` der
Storm AA, 63 Stück, trugen je einen zweiten Raketenkörper), Zünderleuchten,
Schubdüsen und Läufe, deren richtiges Netz nirgends in der Datei steht.

**Neubau aller Schiffe (Krisz 10.11.2026: „Gleich alle 231 Schiffe“).** Am PC
im eigenen Arbeitsbaum, Rümpfe und Innenräume. Rümpfe: 231 gebaut, 0 Fehler,
keine neuen Bilder in der Ablage, 2,30 Mio. Dreiecke und 21,7 MB weniger.
14 Schiffe bestehen jetzt die Fahrwerksprobe, die sie vorher nicht bestanden
(Sabre-Reihe, Constellation Aquila, Phoenix und Taurus, Starfarer und
Gemini, MOLE, MOTH, Star Runner, Golem, Redeemer). Ihre Landebeine waren
verschobene Teile. Bei Andromeda und Phoenix Emerald sinkt die Abweichung
der Aufstandspunkte von 2,1 auf 0,17 m und von 4,1 auf 0,67 m. Keins fiel
zurück. Angesehen, alt gegen neu: Gladius (Raketen links und unter dem
Rumpf wieder da, wo vorher graue Werferkörper hingen), Ironclad Assault
(Triebwerke heil statt zerknüllt), Sabre Raven (Landebeine), Scorpius
(sieben doppelte Geschützkörper an den Kardanaufhängungen weg), Storm AA,
Idris-M, Starlifter A2, Sabre Comet, Cutlass Blue.
