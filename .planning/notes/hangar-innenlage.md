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
