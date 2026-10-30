# Lose Teile am Rumpf (30.10.2026)

Anlass: Krisz, 30.10.2026 13:20: „jedes schiff soll komplett angeschaut
werden, innen und aussen“. Beim Ansehen aller 231 Rümpfe von staging
(Stand 081d9ca0, also vor dem Neubau „nur zweiseitig“) hingen bei 29
Teile frei in der Luft. Zugehörig: `hangar-cockpit-hohl.md` (Neubau),
`hangar-innenlage.md` (Innenräume).

## Werkzeug

`node scripts/measure-hangar-inseln.mjs all` rastert jeden Rumpf
(Voxel 0,5 m), verbindet, was höchstens 1 m auseinanderliegt, und meldet
jeden Verbund außer dem größten, der außerhalb von dessen Hüllquader
liegt. Inseln im Rumpf (Kraftwerke, Kühler, Relais in ihren Schächten,
44 Schiffe) sind gewollt und erscheinen nur mit `--alle-inseln`.
Gegen einen Rohexport (`--roh <glb>`) nennt es je Insel die Knoten mit
ihrem Pfad unter der Schiffswurzel; `--mit-ausgeblendet` nimmt die Teile
dazu, die der Bau weglässt (Schild, Proxy, Kollision, Schaden, LOD), um
zu sehen, ob eines davon die Insel mit dem Rumpf verbindet.

Lauf über alle 231 Rümpfe: 284 s, 29 mit losen Teilen.

## Befund

| Schiffe | Insel | Abstand | Bild |
|---|---|---:|---|
| Hornet F7C, F7CR, F7CS (Mk I) | beide Flügelwaffen neben der Flügelspitze | 1,3 m | Waffe hängt neben dem Flügelende |
| Hornet F7CM, F7CM Heartseeker | beide Flügelwaffen | 2,1 m | wie oben |
| Hornet F7A Mk I, Wildfire | eine Flügelwaffe | 1,3–1,4 m | die andere Seite sitzt |
| Hornet F7A/F7C/F7CR/F7CS Mk II | linke Flügelwaffe | 0,9 m | rechte sitzt |
| Hornet F7CM Mk II (+Heartseeker) | 47 Dreiecke Milchglas | 1,5 m | klein |
| Avenger Stalker, Titan, Titan Renegade, Warlock | Feuerlöscherschrank über dem Rumpf | 1,4 m | gut sichtbar |
| 300i, 315p, 325a, 350r | zwei Kleinteile (84 und 99 Dreiecke) unter dem Schiff | 2 und 3,5 m | sichtbar unter dem Bauch |
| 325a | Innenraumteil (`ORIG_300i_int_mtl_mat_dark_09`) | 32 m | weit seitlich, Hüllquader 48,6 m breit |
| Star Runner | zwei Teile à 190 Dreiecke unter dem Schiff | 1,7 m | sichtbar |
| Vulture | Kleinteil über dem Rumpf | 2,8 m | klein |
| ROC | Teil neben dem Fahrzeug | 1,6 m | klein |
| Asgard, Fury (+Miru), 890 Jump, Polaris | 1–12 Dreiecke (Glas, Leuchtfläche) | 0,8–5,4 m | unsichtbar klein |

Die Hornet-Flügelwaffen sind Tauschteile (`swap` an
`hardpoint_class_2_left_wing` / `_right_wing`, Anker bei x = ±9,35 m),
der Flügel endet beim F7C bei x ≈ 7,7 m. Der Halter selbst liegt also
neben dem Flügel: entweder fehlt im Bau die Flügelspitze oder ein
Waffenhalter (als Schaden/LOD ausgeblendet?), oder der Export setzt den
Halter falsch. Dass Mk-II-Hornets nur links betroffen sind, spricht für
einen Fehler in den Daten einer Seite, nicht im Bau.

## Auftrag PC (Teil 4 des Laufs „Rümpfe nur zweiseitig“)

1. Je betroffener Rohexport `node scripts/measure-hangar-inseln.mjs --roh
   .cache/hangar-src/ships/<slug>.glb` und dasselbe mit
   `--mit-ausgeblendet`: Verschwindet die Insel, lässt der Bau ein
   verbindendes Teil weg (Name und Grund nennen). Bleibt sie, die Knoten
   der Insel und ihres Ports gegen die Spieldaten halten (Lage des Ports
   am Fahrzeug, Halter-Teil im Loadout).
2. Regel umsetzen (Bau oder Export, keine Versätze je Schiff von Hand),
   betroffene Rümpfe neu bauen, `measure-hangar-inseln.mjs all`
   nachmessen. Ziel: keine sichtbare Insel mehr; unsichtbar kleine (unter
   50 Dreiecken) dürfen bleiben, wenn der Grund genannt ist.
3. Danach baut die Cloud daraus ein Tor (Klinke auf die Zahl der Rümpfe
   mit Inseln, benannte Ausnahmen).
