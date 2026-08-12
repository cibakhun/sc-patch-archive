# Fracturing-Rechner wird eine eigene Seite (12.08.2026)

Auftrag: „eigentlich kann das ganze fracturing calculator und alles was
dazugehört auf einer separate seite." — unmittelbar nachdem das Messgerät in
die Rig-Leiste der Mining-Werkbank gezogen war
([[mining-werkbank-rigbalken]]).

Rückgefragt wurde genau eine Sache, weil sie den Zuschnitt entscheidet: an der
Ausrüstung hingen auf der Mining-Seite drei weitere Dinge — der farbige Punkt
auf jeder Kachel, der Filter „nur brechbar" und der Physikwert „effektiv".
Antwort: **ganz raus aus Mining.**

## Die Trennlinie

| bleibt im Mining | zieht nach /fracturing.html |
|---|---|
| Erz-Kacheln mit Signatur | Erz-Kacheln mit Punkt **und Verhältniszahl** |
| Physik: Widerstand, Instabilität, Dichte, Fenster | Physik: Widerstand, **effektiv**, Instabilität, Fenster |
| Qualitätsstufen, Steine, Fundorte | Messgerät, Rechenweg |
| Beste Stationen + Stationswahl | Laser, Module, Gadget, Felsmasse |
| Signaturenliste, Anheften | Laser-DPS, Res-Mod |
| Blueprint- und Schiffsbezüge | Filter „nur brechbar" |

Die **Station** bleibt bewusst im Mining: sie gehört zum Ertrag, nicht zum
Brechen. Aus der „Rig-Leiste" ist damit eine Fußzeile mit zwei Kindern
geworden — Stationswahl und der Weg zum Rechner.

## Warum der Verweis kein Zierrat ist

Die Brechbarkeit war eine **sichtbare Zusage** der Mining-Seite: sie stand im
Untertitel, in der Werkzeug-Hilfe und als Punkt auf 37 Kacheln. Wer sie sucht
und nicht findet, hält sie für gelöscht. Deshalb an drei Stellen ein Weg:

- Fußzeile der Werkbank, **mit dem gerade gewählten Erz im Namen** und als
  Tieflink `?mineral=<Name>#calc`,
- eigene Karte über den beiden bestehenden CTAs unter dem Refinery-Finder,
- eigener Eintrag im Menü-Deck (Gruppe „Bergbau-Kreislauf", vor Refinery).

Zurück geht es genauso: der Rechner verlinkt
`/topics/mining.html?mineral=<Name>#db`. Beide Seiten lesen den Parameter mit
Vorrang vor dem gespeicherten Zustand. Geteilter localStorage wäre der
andere Weg gewesen — dagegen sprach, dass zwei Werkzeuge sich dann gegenseitig
den Zustand überschreiben, ohne dass man es sieht. Der Parameter steht in der
Adresse.

## Was neu ist statt nur verschoben

Ein Umzug allein hätte die Seite nicht verdient. Neu:

- **Der Rechenweg steht ausgeschrieben.** Vier Zeilen und eine Summe, jede mit
  den eingesetzten Zahlen und ihrem Zwischenergebnis: Laserschaden →
  Widerstand mit Res-Mod → wirksamer Schaden → nötiger Schaden → Verhältnis.
  Ein Urteil ohne Herleitung ist auf einer Rechnerseite zu wenig: wer „nicht
  brechbar" liest, will wissen, an welcher Schraube es hängt.
- **Jede Kachel trägt ihr Verhältnis**, nicht nur einen Punkt. Der Punkt sagt
  „geht / geht nicht", die Zahl sagt, wie knapp — und darum geht es hier.
- **Das Messgerät ist wieder groß** (105 px statt 50): auf dieser Seite ist es
  die Hauptsache und nicht mehr Gast in einer Bedienleiste.
- **Die Modulplätze stehen an der Beschriftung** („Module · 3 Modulplätze"),
  statt sich nur durch graue Felder zu zeigen.

## Die Brech-Formel steht jetzt an EINER Stelle

Sie stand zuletzt in `assets/mining-workbench.js` mit dem Hinweis „zeichengleich
mit FracturingCalc.astro" — auf eine Datei, die es seit dem Werkbank-Umbau gar
nicht mehr gab. Jetzt lebt sie in `assets/fracturing-calc.js`, und die Werkbank
kennt sie nicht mehr. Es gibt keine zweite Fassung, die man mitändern müsste.

## Zwölftes Werkzeug

`fracturing` ist eine neue Kennung im Werkzeug-Hilfe-Vertrag: eigener Titel,
Zweck, vier Bedienschritte und zehn `data-help`-Anker. Eingetragen in
`TOOL_IDS` in `scripts/verify-help.mjs`. Die Mining-Kennung hat dabei sechs
`ctl`-Schlüssel abgegeben (`laser`, `modules`, `gadget`, `mass`, `verdict`,
`breakable`) und einen bekommen (`fracturing`, der Verweis).

⚠ Nebenbefund: die Zahl der Werkzeuge stand in `verify-help.mjs` als Wort
(„ELF") in der Ausgabe und im Kopfkommentar — nach dem zwölften still falsch.
Sie zählt jetzt `TOOL_IDS.length`.

## Messungen (Chrome, gerenderte Pixel, DE und EN)

Fracturing-Seite, `--fc-chrome` = 178 px:

| | 1280×720 | 1920×1080 |
|---|---|---|
| Erz-Kacheln sichtbar | 37/37, kein Scrollen | 37/37, kein Scrollen |
| Messgerät hoch | 105 px | 105 px |
| Rechenweg-Zeilen | 5 | 5 |
| Waagerechter Überlauf | 0 | 0 |
| Luft bis zur Falz | 0 px | 0 px |

⚠ Mit dem ersten Wert (186 px) fehlten dem Kachelraster bei 1280×720 genau
**7 px** — die letzte Reihe (Soldynium) rutschte ins Scrollen, während unter
der Werkbank 8 px Falzluft ungenutzt lagen. 178 gibt sie dem Raster. Wer die
Zahl anfasst, misst beides nach: `#fc-list` darf nicht scrollen UND `.fc` nicht
unter die Falz laufen.

Mining-Seite nach dem Rückbau: 37/37 Kacheln ohne Scrollen, Fußzeile 69 px
(unverändert), 2 px Falzluft, keine Reste (`.wb__gauge`, `.wb__dot`,
`#wb-laser`, `#wb-mass`, `#wb-slots`, `[data-only]` allesamt weg — am
gerenderten DOM geprüft, nicht am Quelltext).

Handy (390×844): beide Seiten ohne waagerechten Überlauf.

## Gegenprobe an der Rechnung

Über die Bedienelemente durchgespielt, mit den Zwischenergebnissen des
Rechenwegs:

| Schritt | Urteil | Verhältnis | Rechenweg |
|---|---|---|---|
| Start (Quantainium, mittel) | Grenzwertig | ×1,03 | 4.930 → 0,66 → 1.652 → 1.600 |
| Erz → Ice | Brechbar | ×3,08 | 4.930 → 0,00 → 4.930 → 1.600 |
| Felsmasse → riesig | Nicht brechbar | ×0,55 | 4.930 → 0,00 → 4.930 → 9.000 |
| Laser → schwächster | Nicht brechbar | ×0,00 | 1 → 0,00 → 1 → 9.000 |

Alle drei Zustandsfarben treten auf, im Hellmodus ebenfalls geprüft. Tieflink
in beide Richtungen geöffnet und das Ziel-Erz gelesen.

## Offen

- Der Res-Mod wird auf eine Nachkommastelle gerundet (`-24,5 %`); Module
  erzeugen krumme Werte. Vorher standen dort ungerundete Fließkommazahlen.
- Der schwächste Laser hat in den Spieldaten `mining.dps` = 1. Das ist die
  Datenlage, nicht ein Anzeigefehler — fällt auf der Rechnerseite nur stärker
  auf als vorher.
