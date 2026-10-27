# Hangar: Landestellung und Grundfarben (2026-10-25)

Auslöser für die PC-Sitzung: **„Hangar-Landung“**. Derselbe Satz noch einmal
setzt den Lauf fort, wo er stand.

Anlass, Krisz 2026-10-25 18:15 mit Bild der Railen auf staging: „steht der
railen so ingame?“ Nein: Sie steht auf den Spitzen ihrer unteren Flügel,
weil Flügel und Vorderbeine im Export in Flugstellung sind. Dazu die offene
Frage vom selben Tag, warum Corsair, Polaris, Freelancer und Andromeda fast
schwarz sind (Bilder `hangar/v83-corsair-polaris-dunkel.png`,
`hangar/v84-freelancer-andromeda-dunkel.png`), und Krisz 24.10.2026 13:24:
„mach dann so dass alle schiffe korrekt auf dem boden stehen mit deren
landinggear. also wie intended.“

Ziel: Jedes Schiff im Hangar steht wie im Spiel gelandet, mit Beinen und
beweglichen Teilen in Landestellung, und trägt seine echten Grundfarben.
Ersetzt Teil C von [`hangar-flotte.md`](hangar-flotte.md) und den offenen
Punkt „bewegliche Teile in Landestellung“ aus
[`hangar-alle-schiffe.md`](hangar-alle-schiffe.md). Es gelten die Regeln aus
[`hangar-katalog.md`](hangar-katalog.md): alles aus dem Spiel, keine
Roh-Exporte, kein `.mtl`-XML und keine Rohtexturen im Repo.

## Befund aus der Cloud

- **Railen** (`gear.gama-railen`): `pose: 'ein'`. Nach `landing_deploy`
  enden die Vorderfüße bei y −6,84 statt beim Aufstand −19,03, 12,2 m zu
  kurz. Die Hinterfüße liegen bei −33,97, also 15 m unter dem Aufstand: Die
  unteren Flügel hängen in Flugstellung (`below`: `dbr_wing_bottom_*`,
  `arm_bottom_*` 16,7 m unter der Ebene). Die vier Federhöhen liegen alle bei
  −19,03, im Spiel steht sie also waagrecht und rund 17 m tiefer. Syulen und
  Tyilui (auch Gatac) stehen ebenfalls auf `ein`.
- **Grundfarben**: `scripts/datamine-ship-paints.mjs` `paletteColours()`
  nimmt die Wurzel des TintPaletteTree, wenn `ChildPath` nicht gefunden wird.
  Folgen in `src/data/ship-paints.json`: 52 Lacke ganz #000000, und 19
  Grundpaletten mit mindestens zwei reinen Schwarz- oder Weißwerten, darunter
  Railen #ffffff/#000000/#000000, Syulen, Tyilui, Perseus, Nomad, Hoverquad,
  Cutlass Steel, Xi'an Scout und drei Avenger ganz #ffffff. Freelancer
  (#000000/#393b39/#484848, das ist genau die Palette von Storm Surge) und
  Corsair (#000000/…) haben einen schwarzen Primärkanal. Bei der Railen tönt
  Weiß die Linientextur von `Stone_Primary_057`, Schwarz den Rest: daher das
  harte Zebramuster. Die Linien selbst sind die Steinoberfläche aus dem Spiel.
- **600i BIS2951**: Cold Forge und Sterling haben im zerlegten Export keine
  eigene Palette; der Bau nimmt dann die Werte aus `ship-paints.json`, und
  die sind die Grundfarben der BIS2951. Im Paket `ORIG 600i` steht dieselbe
  Lackierung mit Palette.

## Auftrag PC

0. Branch `pc/hangar-landung` von `origin/staging`. Vor jedem Push
   `npm run build && npm run gate`, nach Datenläufen zusätzlich
   `npm run gate:data`; ohne PR, die Cloud merged. Push nach jedem Teil und
   bei Teil B nach je rund 15 Schiffen. Ohne Gegenansage von Teil zu Teil
   weiter.

### Teil A: Grundfarben

1. Im TintPaletteTree der betroffenen Schiffe nachsehen, wie `ChildPath`
   wirklich aufgelöst wird (Groß/Klein, Trenner, Namen mit Präfix, Pfad über
   mehrere Ebenen), und `paletteColours()` so ändern, dass er den Knoten
   findet. Ohne Treffer nicht die Wurzel nehmen: dann die Palette desselben
   Tags aus dem zerlegten Export (`ships-dec/…/palettes.json`), sonst die
   Grundpalette des Schiffs, und das in der Selbstauskunft zählen.
2. Gegenprobe je Schiff: Grundpalette aus `ship-paints.json` gegen die
   Palette der eigenen Lackierung im zerlegten Export (`liveries.json`, die
   mit `EntityClassDefinition.`). Abweichungen auflisten.
3. `npm run datamine:paints`, `npm run gate:data`. Im Befund: Fälle ohne
   `ChildPath`-Treffer vorher und nachher, alle Schiffe mit geänderter
   Grundpalette mit alt und neu.
4. `writePaints` in `scripts/build-hangar-assets.mjs`: Fehlt einer Variante
   die Palette im eigenen Paket, die Palette desselben Tags aus einem
   Schwesterpaket nehmen (600i BIS2951 aus `ORIG 600i`), statt Finish, Glas
   und Decal leer zu lassen. Nur die Lack-Baupläne neu schreiben, die das
   betrifft.
5. Aufnahmen nach der Änderung (`check:hangar-shader --ship <slug> --shot`):
   Railen, Syulen, Corsair, Polaris, Freelancer, Andromeda. Freelancer und
   Andromeda bleiben in `HOLD` (HangarApp.astro), bis Krisz sie freigibt;
   die Aufnahmen gehen in den Befund.

### Teil B: Landestellung

6. Railen zuerst: herausfinden, welche Animationen das Spiel beim Landen
   abspielt (Landesystem `GAMA_Railen_LandingSystem`, Clips für Flügel und
   Rumpf neben `landing_deploy`), und sie in `scripts/lib/landing-gear.mjs`
   `poseShip` vor den Beinen anwenden, bis alle vier Füße auf der Federhöhe
   stehen. Dann Syulen und Tyilui.
7. Die übrigen 18 mit eingefahrenem Fahrwerk: Eclipse, Reclaimer (beide),
   Hawk, Mole, Moth, Nomad, Dragonfly (beide), Prowler Utility, S65
   Stingray, Hull C, 85X, 890 Jump, Glaive, San'tok.yai, Ironclad (beide).
8. Die 35 mit Teilen in Flugstellung (`gear.<slug>.below` tiefer als
   20 cm): Polaris, Redeemer, Sabre (vier), Asgard, Paladin, Hoverquad,
   Star Runner, Caterpillar (beide), Corsair, Golem, Prowler, Starfarer
   (beide), Starlancer MAX und TAC, Guardian (drei), 300i, 315p, 325a, 350r,
   Constellation Andromeda, Aquila, Phoenix, Phoenix Emerald, Taurus,
   Centaurus, Stinger, Idris M und P. Je Schiff den Clip finden, der das Teil
   in Landestellung bringt; findet sich keiner, Grund in den Befund.
9. Für jedes geänderte Schiff Geometrie-Fassung (`build-hangar-gear.mjs`)
   und Web-Fassung (`build-hangar-assets.mjs --kind ships --ships …`) neu.
   `gear: true` setzt weiter nur `gearCheck`. Danach `verify:hangar-gear`
   grün, Klinken nicht senken.

## Befund

PC-Lauf 27.10.2026, Branch `pc/hangar-landung` (Zwischenstand 1).

### Teil A: Grundfarben

- **Die ChildPath-Annahme trifft nicht zu.** `datamine:paints` meldet vorher
  wie nachher „ChildPath nicht gefunden: 0“. Bei Railen, Corsair, Polaris,
  Perseus usw. ist `ChildPath` leer, die Wurzel des TintPaletteTree *ist* die
  Palette, und die Werte stehen genau so im Spiel (z. B.
  `gama_railen_default`: A 255/255/255, B 0/0/0, C 0/0/0).
- **Ursache der schwarzen Flächen:** Das Spiel zeichnet im
  Specular-Workflow. `tintColor` ist die Diffusfarbe, `specColor` die
  Glanzfarbe (F0), dazu `glossiness`. Lack hat `specColor` 59 (≈ 4 %,
  dielektrisch); Metall hat Tönung 0 und eine helle `specColor`. Belege
  (Tönung → spec): Corsair-Grundpalette `drak_corsair_steel_steel_yellow` A
  0 → 155; Freelancer A 0 → 227; Perseus alle drei 0 → 100; Nomad 0 → 144;
  Cutlass Steel 0 → 150; Railen B 0 → 103, C 0 → 146/110/82 (Bronze); Xi'an
  Scout 0 → 191/77/67 (Kupfer). Die 52 „ganz schwarzen“ Lacke sind Metall-
  und Chromlacke (Meridian, Best in Show, Purple Haze, Disco, Blue Steel,
  Noble, Fortuna …). Der Bau setzt `baseColorFactor` = Tönung bei metallic 0,
  der Viewer färbt nur `m.color` um, also wird jedes Metall schwarz. Die
  Polaris ist echt dunkelgrau (Tönung 43/60, spec 70, Glanz 210).
- **Umrechnung offen** (Frage an die Cloud, 27.10.): Glanzfarbe →
  metallic/roughness wie beim Konverter für KHR_materials_pbrSpecularGlossiness,
  im Bau (GLB, extras mit tint/spec/gloss) und im Viewer (`hullTint`/`paint`
  finden die Kanäle heute über `m.color` ≈ Serienton und brauchen dieselbe
  Umrechnung mit `finish.specular` aus `paints/<schiff>.json`).
- **Gegenprobe** Grundpalette (`ship-paints.json`) gegen die Palette der
  eigenen Lackierung im zerlegten Export: vorher 205 gleich, 2 abweichend
  (Gladius Pirate, Valiant), 24 ohne Vergleich. Ursache: Der Lack sitzt in der
  Standardausrüstung (`hardpoint_paint`), der Record nennt nur die
  Gladius-Grundpalette. `datamine-ship-paints.mjs` nimmt jetzt die Palette
  dieses Lacks („Ab Werk lackiert: 3“, auch Hammerhead Showdown); danach 207
  gleich, 0 abweichend. `gate:data` grün.
- **Schwesterpaket** (`writePaints`/`paintPlan`): Fehlt einer Variante die
  Palette, kommt sie aus einem Paket mit demselben Tag, zuerst aus der
  eigenen Familie (600i BIS2951 aus ORIG 600i). Alle acht Lacke der BIS2951
  tragen jetzt Palette und Finish.

### Teil B: Landestellung

- **Rumpf zuerst:** `poseShip` (`scripts/lib/landing-gear.mjs`) spielt vor
  den Beinen die Deploy-Animationen der Mannequin-Gruppe des Landesystems
  (`SAnimationControllerParams.AnimationDatabase`, Gruppe = `fragment`, z. B.
  `<Landing_Gear>`, alle Fragmente mit `FragTags=Deploy`), soweit die
  `.chrparams` der Schiffsgeometrie sie kennt (auch `*` = ganze `.dba`).
  Gerechnet wird mit und ohne Rumpfanimation; es bleibt die bessere
  (aus > ein > keins, Ebene höchstens 15° steil, ausgefahren und über 1 m im
  Boden zählt schlechter als eingefahren, dann weniger Tiefe), bei Gleichstand
  ohne. Ausgenommen die 300er-Reihe: `orig_300i_landing_gear_open` legt die
  Scharniere lose vor den Rumpf (angesehen), obwohl die Messung besser wird.
- **Ergebnis** (alle 231 neu gerechnet): aus 166 → 172, ein 21 → 15, Teile
  tiefer als 20 cm 42 → 39. Angenommen bei 11 Schiffen: Railen und Tyilui
  (ein → aus, 16,7 m → 0), Eclipse, Hawk, S65 Stingray (ein → aus), Syulen
  (153 m → 22 m, Ebene durch ein Bein oben, steht weiter auf dem tiefsten
  Punkt), Polaris (Flossen: 5,9 m → 0,55 m, Rest ist ein Glühteil), Guardian
  MX (1,2 m → 0), Skylark (0,17 → 0), Centaurus (0,97 → 0,87), Glaive.
- Web-Fassung neu für diese elf und die vier mit neuen Lackdaten. `gear: true`
  jetzt zusätzlich bei Railen, Eclipse, Hawk, S65 Stingray, Guardian MX,
  Skylark. Tyilui 2,8 cm daneben, Polaris 3,1 cm (Dezimierung).
- Abgelehnt, weil schlechter: Reclaimer (beide), Mole, Moth (Rumpf fährt die
  Beine aus, ohne sie einzufedern: 2,5 bis 8,2 m im Boden), Guardian und QI,
  Corsair (gleich).
- **Noch offen** (ein): Reclaimer ×2, Mole, Moth, Nomad (Beine ohne
  Animation), Dragonfly ×2 (Gravplatten), Prowler Utility, Hull C, 85X,
  890 Jump, Glaive, San'tok.yāi, Ironclad ×2 (Animation nicht unter dem
  erwarteten Pfad). Teile in Flugstellung bleiben bei 39 Schiffen.

Aufnahmen (`check:hangar-shader --shot`, höchstens 16 Texturen je
Bildshader): Railen, Syulen, Corsair, Polaris, Freelancer, Andromeda. Die
Farben sind unverändert, bis die Umrechnung oben entschieden ist.
