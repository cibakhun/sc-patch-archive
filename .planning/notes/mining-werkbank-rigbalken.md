# Messgerät runter in die Rig-Leiste (12.08.2026)

Auftrag: „mach mal den balken da runter" — mit drei Bildern: die Werkbank als
Ganzes, ein Ausschnitt des Brech-Messgeräts oben in der Mittelspalte, und ein
Ausschnitt der Oberkante der Rig-Leiste. Also: das Messgerät aus Spalte 2 nach
unten in die Leiste, in der Laser, Module, Gadget, Felsmasse und Station
stehen — genau die fünf Regler, aus denen es gerechnet wird.

Rückgefragt und bestätigt: „In die Rig-Leiste unten", nicht „tiefer in der
Mittelspalte".

## Warum das nicht nur ein Umhängen ist

`.wb__grid` bekommt seine Höhe als `100vh - var(--wb-chrome)` (236 px). An dieser
Konstante hängen zwei harte Zusagen der Werkbank:

- alle **37 Kacheln ohne Scrollen** bei 1280×720,
- die Werkbank **endet über der Falz**.

Beide hatten vorher **2 px** Luft. Jede Zeile, die die Rig-Leiste zulegt, geht
davon ab. Das Messgerät war in der Mittelspalte **87 px** hoch — senkrecht
gestapelt (Kopfzeile, Skala, Zonenbeschriftung) — und passte dort, weil Spalte 2
innen scrollt. In der Rig-Leiste tut sie das nicht.

## Ausgangsmessung (Chrome, playwright-core, `/de/topics/mining.html`)

| | 1280×720 | 1920×1080 |
|---|---|---|
| Rig-Leiste hoch | 69 px | 69 px |
| Messgerät | 87 px, in Spalte 2 | 87 px, in Spalte 2 |
| Kachelraster scrollt | nein (0 px) | nein (0 px) |
| Luft bis zur Falz | 2 px | 2 px |

## Der Fehlversuch, der die Regel gezeigt hat

Erste Fassung: Messgerät als letztes Kind der Rig-Leiste, `flex:1 1 330px`,
dreizeilig, Kennzahl in einer zweiten Rasterspalte daneben.

| | 1280×720 | 1440×900 | 1920×1080 |
|---|---|---|---|
| Rig-Leiste hoch | **139 px** | **139 px** | 71 px |
| Luft bis zur Falz | **−68 px** | **−68 px** | 0 px |

Bei 1920 passt alles in eine Zeile, darunter **bricht die Leiste um**. Ein
Umbruch kostet 68 px — und die gibt es nicht. Die Umbruchkante liegt gemessen
bei rund **1465 px**: bei 1512 blieben dem Messgerät 379 px, bei 1440 zu wenig
für seine 330 px Grundbreite.

Nachrechnen ohne Bildschirm hätte hier nicht gereicht: `.wb__rgrp` ist wegen des
`<select>` **51 px** hoch, nicht die geschätzten 47 — und das ist genau die
Grenze, unter der das Messgerät bleiben muss.

## Was jetzt drinsteht

- **Waagerecht statt senkrecht**: Worturteil und Auslesung in Zeile 1, Skala in
  Zeile 2, Zonenbeschriftung in Zeile 3 — und die große Kennzahl `×1,03` als
  **zweite Rasterspalte daneben** statt als vierte Zeile. Damit 50 px statt 87.
- **Bediengruppen geben nichts ab** (`.wb__rgrp,.wb__rstat{flex:0 0 auto}`).
  Ohne das wandern die vier Felsmasse-Chips in eine zweite Zeile und die Leiste
  wächst auf demselben Weg wie beim Umbruch.
- **`@media(max-width:1500px)`** rückt zusammen: Abstände 16→9, Stationsfeld
  190→150, Modulfelder 124→104, Chip-Polsterung 9→7. Das schafft die Breite,
  die das Messgerät braucht, statt sie über einen Umbruch zu holen. 1500 statt
  der gemessenen 1465, damit Schriftrundungen nicht in die Kante laufen.
- **Was dort weichen muss, ist die Auslesung „x verfügbar · y benötigt"**, nicht
  die Zonenbeschriftung. Erste Fassung hatte es andersherum, das Ergebnis war
  ein mitten im Wort abgeschnittenes „1.652 verfügbar · 1.60…" — abgeschnittener
  Text liest sich als Defekt. Die Beschriftung braucht bei `--fs-1` rund 162 px
  und passt in die 182 px Textspalte; die Auslesung bräuchte 170 px und passt
  nicht. Sie erklärt außerdem den Balken, und der Balken ist hier der Zweck.
- **Handy (≤760)**: eigene Zeile über die volle Breite, alles sichtbar,
  `.wb__gtop{flex-wrap:wrap}` — sonst schneidet die lange deutsche Fassung ab.
- **`--wb-chrome`** ist jetzt eine Variable statt einer festen 236 im `calc()`.
  Sie bleibt bei 236; die Variable existiert, damit der nächste, der die Leiste
  anfasst, die Stellschraube findet.

## Schlussmessung

| | 1280×720 | 1366×768 | 1465×900 | 1512×850 | 1920×1080 |
|---|---|---|---|---|---|
| Rig-Leiste hoch | 70 px | 70 px | 70 px | 69 px | 69 px |
| Umbruch | nein | nein | nein | nein | nein |
| Messgerät breit | 265 px | 351 px | 450 px | 389 px | 437 px |
| Kachelraster scrollt | nein | nein | nein | nein | nein |
| Text abgeschnitten | nein | nein | nein | nein | nein |
| Luft bis zur Falz | 1 px | 1 px | 1 px | 2 px | 2 px |

DE und EN einzeln gemessen (die deutschen Zeichenfolgen sind die längeren),
375×812 zusätzlich fürs Handy.

## Gegenprobe an der Rechnung

Über die Bedienelemente durchgespielt, nicht am Quelltext geraten:

| Schritt | Urteil | Verhältnis | Füllung |
|---|---|---|---|
| Start (Quantainium, mittel) | Grenzwertig | ×1,03 | 51,6 % |
| Erz → Ice | Brechbar | ×3,08 | 100 % |
| Felsmasse → riesig | Nicht brechbar | ×0,55 | 27,4 % |
| Laser → schwächster | Nicht brechbar | ×0,00 | 0,006 % |

Alle drei Zustandsfarben (`is-ok` / `is-warn` / `is-bad`) treten auf, im
Hellmodus ebenfalls geprüft. Die Hilfe-Hervorhebung findet das `data-help` am
neuen Ort (`outline: dashed` gemessen, nicht aus dem CSS abgeleitet).

## Ein Nebenbefund, der aus dem Umzug entstand

In der Rig-Leiste stand „verfügbar 4.930", im Messgerät „1.652 verfügbar".
Zwei verschiedene Zahlen unter demselben Wort, ab jetzt nebeneinander. Es sind
auch zwei verschiedene Dinge: das eine ist die rohe Laser-Ausgabe mal
Modulfaktor, das andere der Schaden **nach** dem Widerstand des Erzes. Die erste
heißt jetzt „Laser-DPS" / „Laser DPS".

Nebenbei mitgenommen: die Skalen-Obergrenze stand fest verdrahtet als „2,0" —
auch auf der englischen Seite.
