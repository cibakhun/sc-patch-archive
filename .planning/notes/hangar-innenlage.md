# Innenlage: Sitzen die begehbaren Innenräume im Rumpf?

Stand 30.10.2026. Krisz, 30.10.2026 13:20: „ja aber am ende sollen
innenräüme auch dabei sein, und jedes schiff soll komplett angeschaut
werden, innen und aussen. componente sollen auch physicalized sein und an
deren richtige stelle sitzen“. Zusammenhang: `hangar-cockpit-hohl.md`
(Neubau nur zweiseitig), `hangar-innenleben.md` (#263, 217 Innenräume).

## Befund aus der Cloud

**Röntgenbilder** aller 217 Innenräume: Rumpf durchsichtig, Innenraum
farbig, je Schiff oben, Seite, vorn, schräg (Seite +X: Bug links). Alle
217 angesehen.

**Messung** `node scripts/measure-hangar-innenlage.mjs all` (Werkzeug,
rail null): Ein Dreieck liegt außen, wenn sein Mittelpunkt auf mindestens
zwei Achsen 0,4 m jenseits der Rumpfspanne liegt (Rechnung im Kopf des
Skripts). 217 gemessen in 477 s: **37 mit mindestens 1 % außen, 33 mit
mindestens 5 %, 15 mit mindestens 20 %.** `--versatz` sucht den Versatz des
ganzen Innenraums bis 4 m (4,4 = am Rand der Suche, der wahre Versatz kann
größer sein):

| Schiff | Dreiecke | außen % | bester Versatz x / y / z (m) | danach außen % |
|---|---:|---:|---|---:|
| drak-vulture | 180 766 | 44.1 | 0 / 0 / 4.4 | 8.92 |
| banu-defender | 126 727 | 38.4 | 0.7 / -0.3 / 4.4 | 1.73 |
| drak-cutlass-black | 233 015 | 28.4 | 0.3 / -1.6 / 2.5 | 7.56 |
| aegs-hammerhead | 1 451 004 | 27.8 | 0.6 / -2.4 / -4.4 | 12.29 |
| aegs-hammerhead-showdown | 1 409 899 | 26.0 | -0.4 / -2.1 / -4.4 | 13.18 |
| rsi-aurora-mk2 | 509 661 | 25.6 | -0.4 / 0.9 / -0.3 | 0.05 |
| rsi-constellation-taurus | 428 691 | 24.4 | 0 / 2.2 / 4.4 | 2.23 |
| aegs-tiburon | 1 435 727 | 23.0 | 0 / -2.2 / -4.4 | 9.51 |
| rsi-constellation-andromeda | 518 960 | 22.5 | -0.3 / 3.2 / 4.3 | 0.18 |
| glsn-shiv | 305 663 | 22.2 | -0.5 / -1.4 / 1.9 | 4.02 |
| aegs-vanguard | 293 766 | 21.3 | -4.4 / 0.5 / -2.7 | 9.61 |
| drak-cutlass-blue | 477 866 | 20.7 | 0 / -2 / 4.2 | 0.73 |
| aegs-vanguard-harbinger | 307 111 | 20.4 | -4.4 / 0.4 / -2.8 | 9.18 |
| aegs-vanguard-sentinel | 310 948 | 20.2 | -4.4 / 0.5 / -2.7 | 9.02 |
| drak-cutlass-steel | 335 682 | 20.1 | 0.3 / -1.6 / 2.4 | 5.26 |
| drak-cutlass-red | 319 722 | 18.9 | -0.5 / -2 / 2.6 | 1.23 |
| rsi-constellation-phoenix-emerald | 403 610 | 17.2 | 0 / 2.9 / 4.3 | 0 |
| aegs-vanguard-hoplite | 378 356 | 16.5 | -4.4 / 0.4 / -2.7 | 7.42 |
| rsi-constellation-phoenix | 509 110 | 16.4 | 0.1 / 1.4 / 3.3 | 0.64 |
| rsi-constellation-aquila | 209 497 | 16.2 | -0.5 / 3 / 4 | 0.01 |
| anvl-carrack | 2 703 544 | 15.6 | -0.8 / -3.6 / 4.3 | 8.98 |
| anvl-carrack-expedition | 2 703 544 | 15.6 | -0.8 / -3.6 / 4.3 | 8.98 |
| misc-starfarer | 784 097 | 13.1 | -3.4 / -3.2 / -3.1 | 6.56 |
| crus-star-runner | 1 031 603 | 13.1 | 2.9 / -2.3 / 4.2 | 0.01 |
| misc-starfarer-gemini | 775 220 | 12.6 | -3.4 / -3.3 / -3.1 | 6.54 |
| drak-caterpillar-pirate | 1 645 285 | 11.9 | 0.9 / -1.2 / 4.4 | 1.51 |
| drak-caterpillar | 1 509 921 | 10.0 | 0.1 / -1.2 / 4.4 | 0.35 |
| tmbl-nova | 68 921 | 9.6 | -0.2 / -0.8 / 0.1 | 0.07 |
| rsi-zeus-cl | 495 845 | 9.2 | -0.3 / -1.2 / -0.9 | 0.14 |
| espr-prowler-utility | 268 228 | 8.8 | 0 / -3 / 0 | 0 |
| rsi-zeus-es | 525 449 | 7.9 | -0.3 / -1.1 / -1.3 | 0.02 |
| aegs-retaliator | 445 985 | 6.0 | 0.8 / -0.3 / 0.9 | 4.43 |
| espr-prowler | 373 129 | 5.1 | -0.5 / -2.5 / -3.5 | 0 |
| aegs-javelin | 2 130 695 | 4.4 | 0.9 / 1 / 4.4 | 3.61 |
| glsn-basher | 19 306 | 2.4 | -4 / -1 / 1.5 | 0 |
| crus-spirit-c1 | 506 683 | 1.3 | 0.1 / 1 / 3.3 | 0.04 |
| crus-spirit-a1 | 576 473 | 1.1 | 0.5 / 1 / 1 | 0 |
- **Ein Versatz je Schiff reicht oft:** Andromeda, Aquila, Phoenix,
  Star Runner, Aurora Mk II, Prowler (rein 3 m senkrecht), Zeus, Nova,
  Cutlass Blue/Red, Caterpillar sitzen danach fast ganz im Rumpf. Bei
  Hammerhead, Tiburon, Vanguard, Carrack, Starfarer, Vulture bleibt mehr
  als 5 % außen: dort sitzen einzelne Container verschieden falsch, oder
  der Versatz ist größer als 4 m.
- **Kein gemeinsamer Wert:** Constellation-Familie etwa y +2 bis +3,
  z +4; Cutlass y −1,6 bis −2, z +2,5 bis +4; Aegis-Großschiffe y −2,
  z ≤ −4,4. Gleiche Familie, ähnlicher Fehler: Das deutet auf eine
  Lageangabe je Schiff (Container-Versatz oder Bezugspunkt), die der
  Export anders anwendet als das Spiel.
- **Nicht der Bau:** Der Rumpf von staging (708595ee) und der von #257
  liegen deckungsgleich (Hüllquader je Material, Abweichung 0), und der
  grobe Innenraum aus #257 liegt, wo der scharfe liegt. Beide kommen aus
  demselben Rohexport, Fahrwerk und Landestellung bewegen die Wurzel nicht.
  Die Lage stammt also aus dem Rohexport.
- **Was die Messung nicht sieht** (nur im Bild): Teile, die innerhalb der
  Rumpfspanne falsch liegen. Bei den 180 unauffälligen auffällig:
  - `crou-nomad`: Innenraum wirkt gedreht und zur Seite versetzt.
  - `krig-p52-merlin`, `krig-p72-archimedes(-emerald)`: ein kleiner
    Würfel schwebt vor und über dem Rumpf.
  - `argo-mpuv` (Fracht) und `argo-mpuv-transport`: Der Fracht- bzw.
    Personenmodul steckt im Innenraum, der Rumpf hat ihn nicht; von außen
    fehlt dann das Modul (im Rumpfbild prüfen).
  - Rumpf, nicht Innenraum: `orig-325a`, `orig-300i`, `orig-315p` tragen
    kleine Teile weit unter dem Schiff (325a Hüllquader 48,6 m breit);
    `xian-nox`, `xian-nox-kue`: großer runder Schatten um das Rad.
- `inHull` des Baus (Hüllquader + 0,5 m) war bei allen 217 „ja“: Der Test
  ist zu grob, er sieht Versätze innerhalb des Hüllquaders nicht.

## Auftrag PC (Teil 3 des Laufs „Rümpfe nur zweiseitig“)

Je Container des Rohexports Lage gegen das Spiel klären, zuerst Cutlass
Black, Prowler (rein senkrecht), Andromeda, Hammerhead, Vanguard, Carrack:

1. `node scripts/measure-hangar-innenlage.mjs --roh .cache/hangar-src/ships/<slug>.glb --versatz`
   (Bericht je Container: Dreiecke, außen %, Lage, bester Versatz).
2. Für dieselben Container die Lage im Spiel: Eintrag des Containers am
   Fahrzeug (Versatz, Drehung, Bezugspunkt/Helfer) und wie StarBreaker ihn
   anwendet. Regel finden, mit der der Export abweicht.
3. Regel in den Export oder in `keepInteriorOnly` (`build-hangar-assets.mjs`)
   übernehmen, die betroffenen Innenräume neu bauen
   (`build-hangar-alle.mjs --kind interior --only …`) und mit
   `measure-hangar-innenlage.mjs` nachmessen (Ziel: unter 1 % außen).
   Ein Tor über die Innenlage folgt, wenn die Innenräume sitzen.

## Befund vom PC

Branch `pc/hangar-zweiseitig`, auf Teil 1 (6a38c768) und 611cac24. Je Schiff:
`hangar-innenlage/je-schiff.md`, Messungen `vorher.json`, `nachher.json`,
Rohexporte `roh-<slug>.json`.

**Regel aus den Spieldaten.** Das Spiel setzt jeden Container mit dem
Eintrag `EntityClassDefinition.<Record>.Components[VehicleComponentParams]
.objectContainers[]` in den Schiffsraum: `fileName` (die .socpak, deren Name
der Container `interior_<name>` trägt), `boneName` (Knoten des Rumpfs, an dem
er hängt) und `Offset.Position`/`Offset.Rotation` (Meter, Grad, Schiffsraum
Z oben). StarBreaker legt alle Container an die Wurzel und trägt nur ihre
eigene Matrix (= `container_transform` aus scene.json), Offset und Knochen
lässt es weg. Gegenprobe über alle Rohexporte: 403 Container haben Offset und
Helfer (`scene.json interiors[].parent_node_name`); Schiffswurzel × Offset
ergibt bei 385 die Weltlage des Helfers auf 2 cm (höchstens 15 mm), bei 18
nicht (Phoenix und Taurus: base-Container 2 bis 7,5 m; Mantis/Meteor-Lichter
3 m; Wolf-Lichter 2 m; MPUV, Hoverquad, STV, X1, Syulen, Retaliator unter
1 m). Gedreht sind per Offset Nova (±180°) und Ironclad (ohne Container im
Rohexport), per Helfer Hammerhead und Showdown (Turmlichter, Heck),
Starlancer TAC, Valkyrie und Blade, alle um die Hochachse.

**Umgesetzt** in `placeContainers` (`scripts/build-hangar-assets.mjs`), für
den Rumpf (`markInterior`) und den Innenraum (`--kind interior`), direkt
nach `dropUnreachable`: Lage = Offset über die Schiffswurzel; ohne Eintrag
der Helfer; ohne beides bleibt der Container. Gleichnamige der Reihe nach.
Danach fällt jedes Container-Netz weg, das der Rumpf oder ein früherer
Container gleich und an derselben Stelle (2 cm) schon trägt. Manifest je
Schiff: `containerPlace` (placed, moved, byOffset, byHelper, unplaced, dup,
dupTris).

**Gladius** (Cloud-Hinweis „Innenraum-Material an zwei Stellen“): Der Rumpf
trägt Sitz und Armaturenbrett als eigene Teile am Helfer `interior_cockpit`
(Body > Nose), richtig unter der Kanzel. Der Container
`base_int_all_geo_sc` ist die Cockpitwanne (16 579 Ecken) und lag 8,5 m zu
weit hinten. Mit der Regel liegt sie um den Sitz (z −10,3 bis −6,9, Sitz
z −8,37), keine Doppelung (verschiedene Netze).

**Neu gebaut:** alle 217 Innenräume und die 67 Rümpfe mit gekennzeichnetem
Innenraum. Rümpfe: bei 45 bewegen sich Container (79 per Offset, 88 per
Helfer), 7 doppelte Netze weg (C8R 1, Spartan 2, MDC 2, Lynx 2; 2 000
Dreiecke), keine Abweichung über 2 % bei den Dreiecken, GLB 121,0 MB wie
vorher. Innenräume: bei 146 bewegen sich Container (416 per Offset, 305 per
Helfer, 4 ohne Angabe), 334 doppelte Netze weg (994 212 Dreiecke), Teile
außerhalb der Hülle entfernt 209 → 175, GLB 418,9 MB wie vorher. 14 Schiffe
ohne Container (Idris, Reclaimer, ATLS, Ironclad, 890, Centaurus, Perseus,
Polaris) haben wie vorher keine Innenraum-Datei.

**Messung** (`measure-hangar-innenlage.mjs all`, jetzt mit Pilotensitz):

| | vorher | nachher |
|---|---:|---:|
| mindestens 1 % außen | 41 | 5 |
| mindestens 5 % | 34 | 1 |
| mindestens 20 % | 15 | 0 |
| Innenraum am Pilotensitz (✓) | 100 von 215 | 192 von 215 |

Die sechs zuerst gemessenen und die Gladius (außen %, Sitz):

| Schiff | vorher | nachher |
|---|---|---|
| drak-cutlass-black | 28,35 %, ✗ (nächstes 3,97 m) | 0 %, ✓ 2 271 Dreiecke |
| espr-prowler | 5,13 %, ✗ (6,74 m) | 0 %, ✓ 18 900 |
| rsi-constellation-andromeda | 22,54 %, ✗ (10,15 m) | 0 %, ✓ 75 |
| aegs-hammerhead | 27,77 %, ✗ (23,04 m) | 0 %, ✓ 1 399 |
| aegs-vanguard | 21,31 %, ✗ (4,78 m) | 0 %, ✓ 23 489 |
| anvl-carrack | 15,55 %, ✗ (26,64 m) | 0 %, ✓ 357 |
| aegs-gladius | 0 %, ✗ (6,56 m) | 0 %, ✓ 10 955 |

**Noch über 1 % außen (5):**

- `rsi-constellation-phoenix` 16,87 %: Der Record nennt die base-Container
  der Andromeda (`base_cockpit_comp_bay`, `base_habs_usables`,
  `base_engineering_comp_bay`) mit deren Offsets. Im kürzeren Phoenix-Rumpf
  ragen sie heraus (gemessen am gesetzten Rohexport: Rechenräume 100 %,
  `base_habs_usables` 58 % außen); die Phoenix bringt eigene Container für
  dieselben Räume mit. Ob das Spiel die base-Container dort zeigt, sagen
  die Daten nicht; die Teile über der Hülle nimmt `keepInteriorOnly` weg
  (49 Knoten), der Rest bleibt. Taurus (dieselbe Lage, 19 Knoten weg)
  misst 0 %.
- `misc-starfarer` 3,12 %, `misc-starfarer-gemini` 2,99 %: Container
  `base_int_bdall_main` (gesetzt 7,8 % außen); Grund offen, im Bild prüfen.
- `drak-caterpillar-pirate` 2,59 %: Kommandomodul (`command_module_interior`,
  `base_pira_int_command_geo`); Sitz ✓.
- `cnou-mustang-beta` 1,48 %: `beta_int_body_main`, Sitz ✓.

**Sitz ✗ (23):** nur Innenraum-Dateien ohne Dreiecke (Dragonfly, Talon,
PTV, Razor, X1, Cyclone, Glaive, Scythe, Nox, Scout, Santok.yai): ihre
Container tragen nur Lichter, vorher wie nachher.

**Über dem Sitz frei bis 4 m (43):** offene Fahrzeuge (Cyclone, Nox,
Dragonfly, PTV …) und Schiffe mit hoher Kanzel oder Kuppel (Hammerhead,
Tiburon, Constellation, Zeus, Aurora Mk II, Fortune). Nur Angabe, kein
Kriterium; die Liste steht in `nachher.json` und im Lauf.

**Aurora Mk II −70 % Dreiecke im Innenraum** ist gewollt: Der Container
`rsi_aurora_mk2_cabin` trägt fünf Kopien des ganzen Außenrumpfs
(`rsi_aurora_mk2.cga`, je 408 691 Dreiecke) an verstreuten Stellen. Eine
lag bisher zufällig im Rumpfquader und blieb drin (25,6 % außen). Mit der
Regel liegen alle fünf 4 bis 10 m über der Hülle und fallen weg; 0 % außen,
Sitz ✓ mit 11 683 Dreiecken.

**Blick durch die Kanzel** (`verify:hangar-cockpit --nachziehen`, kein
Wert gestiegen): Wo der Rumpf seinen Innenraum behält, sitzt das Cockpit
jetzt hinter dem Glas. „durch“ im Mittel 1,47 → 1,21 % (533 → 440 von
36 287 Strahlen), 12 Klinken gesunken: Blade 39 → 1 (Ausnahme gestrichen,
es bleiben 7), 125a 14 → 1, 100i 11 → 1, Mustang Beta 12 → 0, 135c 7 → 0,
MPUV 1T 3 → 0, Mustang Alpha/Delta/Gamma/Omega 2 → 0, MPUV und Avenger
Stalker 1 → 0.

**Werkzeug:** `measure-hangar-innenlage.mjs` prüft zusätzlich den
Pilotensitz (Web: `spots` aus dem Manifest, roh: `hardpoint_*seat*`, Pilot
vor Kopilot): ✓ ab 20 Dreiecksmitten des Innenraums bis 1,5 m, dazu was der
Blick aus 0,8 m Kopfhöhe senkrecht nach oben bis 4 m trifft. Kein Tor.

## Durchsicht Cloud (Teil 3 und 4 gegen staging)

Stand: `claude/project-thread-x4oyij` mit den PC-Commits bis 00fbd61d, gegen
staging 73369043 (#267). Gerendert mit three.js wie die Seite, Bilder unter
`/mnt/project-files/hangar-innenlage/`.

**Pilotensicht, alle 215 Innenräume.** Kamera 0,8 m über dem Pilotensitz
(Einstiegspunkte aus dem Manifest, Pilot zuerst), sechs Blickrichtungen,
Rumpf plus Innenraum-Datei wie beim Einsteigen, Magenta = Blick ins Leere.
132 Schiffe sehen anders aus als auf staging, 83 gleich. Bei den geänderten
liegt das Cockpit jetzt um den Sitz: Gladius, alle Hornets, Avenger, Sabre,
Vanguard, Hammerhead, Retaliator, 100i/125a/135c, Apollo, 600i, Blade, MPUV,
Basher, Shiv. Mehr Magenta als vorher zeigen nur Schiffe, deren Kanzel
vorher von einem falsch liegenden Container verstellt war (Reliant, Nova,
Ursa Rover). Keine neue Lücke.

**Grenze dieser Prüfansicht:** Bei rund 25 Schiffen liegt der erste
Einstiegspunkt nicht im Cockpit (Kamera über dem Schiff: Wolf, Stingray,
Prospector, Aurora Mk II, Zeus, Constellation; in Geometrie: Valkyrie,
Defender, Merlin/Archimedes, Hull C, Asgard; hinter der Lehne: Cutlass,
Cutter, C8, Basher, 100i). Auf staging genauso, die Seite sucht beim
Einsteigen ihren Standpunkt über das Stoßgitter selbst und hängt daran
nicht.

**Röntgen** (Rumpf durchsichtig, Innenraum farbig, oben/Seite/vorn/schräg),
alle Schiffe mit verschobenen Containern, je Baureihe ein Vertreter neben
staging: Innenräume liegen in der Hülle, Cockpits unter der Kanzel; was
vorher aus dem Dach ragte (Cutlass, Vanguard, Star Runner, Hammerhead,
Tiburon), liegt jetzt längs im Rumpf. Carrack: Innenraum reicht jetzt bis
zur Brücke im Bug (0 % außen).

**Hornet:** Mit den heilen Ablöseteilen sind Außenflügel samt Flügelwaffe
und das Leitwerk (zwei nach hinten gezogene Streben mit Querholm) wieder
da. F7C: 18,5 × 19,2 × 6,0 m (L × B × H) auf staging, jetzt 22,5 × 21,6 ×
6,6 m; die Herstellerangabe ist 22,5 × 21,5 × 6,5 m. Auf staging fehlten
also gut 4 m Heck.

**Außen, alle 62 neu gebauten Rümpfe** (Teil 3 mit behaltenem Innenraum und
Teil 4 mit Ablöseteilen) von vier Seiten und durch die Kanzel, neben
staging: Was auf staging aus dem Dach ragte, ist weg (Ursa Medivac und
Rover: Kisten und Wände auf dem Dach), die Hornets sind vollständig, die
Pulse hat ihre Seitenpaneele, die Blade-Kanzel ist von außen zu sehen. Kein
Rumpf hat außen etwas verloren. Prüffalle: Liegt Innenraum-Glas jetzt an
seinem Platz (Zellen der Avenger Stalker im Heck), verschiebt ein
Kanzelsucher, der über alles Glas mittelt, seine Mitte nach hinten; das ist
die Prüfseite, nicht das Modell.

**Ergebnis:** keine Verschlechterung gegen staging gefunden. Offen bleiben die
oben genannten fünf Innenräume über 1 % außen und die elf losen Teile aus
`hangar-inseln.md`. Sichturteil WINDOWS #143.

## Tor (31.10.2026)

`verify:hangar-lage` (Schiene A, `scripts/verify-hangar-lage.mjs`) prüft
gegen `dist/` mit derselben Rechnung wie dieses Werkzeug
(`scripts/lib/hangar-lage.mjs`, Viewer-Regel `isDamageMesh`, nur Knoten
der Szene): [2] Anteil außen je Innenraum unter seiner Klinke (+0,3
Prozentpunkte), ab 1 % nur mit benannter Ausnahme (die fünf oben), [3] ein
Innenraum mit Dreiecken hat am Pilotensitz mindestens 20 Dreiecke bis
1,5 m (192 von 215; die 23 ohne Dreiecke zählen nur mit). Klinke mit
Fingerabdruck je Schiff in `scripts/lib/hangar-lage-klinke.json`: ohne
geänderte Datei 2 s, nach einem Neubau alle 231 Schiffe gut 2 Minuten auf
4 Kernen, danach `--nachziehen`.

Vorgeführt rot: Gladius-Innenraum in `dist/` 8,5 m nach hinten gesetzt
(der Fehler vor #269) → „[2] aegs-gladius: 100 % des Innenraums liegen
ausserhalb des Rumpfs“, „[3] aegs-gladius: am Pilotensitz
hardpoint_seat_pilot nur 0 Dreiecke des Innenraums bis 1.5 m (naechstes
7.24 m)“, „[3] nur 191 Sitze mit Innenraum, Klinke 192“; Datei
zurückgelegt → grün.
