# Design

<!-- impeccable:design-schema 1 -->

Gilt für `/precision-jump.html` und `/de/precision-jump.html`. Die übrige Site
behält ihre bestehenden Welten; diese Datei ersetzt **nur** die Amber/Cyan-HUD-
Welt dieser einen Fläche.

## Direction contract — Fassung 2 (Modus `operate`)

Fassung 1 (unten, Modus `read`) ist **überholt**. Der Betreiber hat am
26.07.2026 festgelegt: das Werkzeug ist das Produkt, nicht der Text. Damit
wechselt der Modus von Read zu Operate, und das ist eine neue Richtung, kein
Feinschliff. Zugewiesen durch Seed `1a6c2616`, Kandidat 6 der geordneten Liste.

**THESIS** — Die Reiselinie ist die Oberfläche. Diese Fläche verweigert die
Draufsicht-als-Bühne, die jede Routenrechner-Seite ausliefert: die Aufgabe ist
eindimensional (wie weit halte ich an?), also ist die Oberfläche eine Achse,
keine Karte. Die Draufsicht bleibt als kleines Orientierungs-Inset.

**OWN-WORLD** — Unverändert aus Fassung 1: ruhiger dunkler Grund, ein Akzent
(Amber), Haarlinien, Tabellenziffern, keine Halos, keine Versaliensätze. Neu
hinzu: die Achse als durchgehendes horizontales Feld über die volle Breite,
Bänder als Zonen darauf, Distanz maßstäblich.

**STORY** — Der Nutzer wählt zwei Anker und ein Band. Er sieht die Reise als
Strecke, die durchquerten Zonen darauf, und die Marke, an der er den Antrieb
abschaltet. Er versteht die Zahl, weil er ihre Lage sieht.

**FIRST VIEWPORT** — Steuerung als schmale Leiste oben. Darunter die Achse über
die volle Breite: Start links, Ziel rechts, Bandzonen zum Maßstab, Austrittsmarke
in Amber mit der Distanz daran. Draufsicht als Inset. Tafeln folgen darunter.

**FORM** — Reiselinie-als-Oberfläche; Position 6 der geordneten Liste, Seed
`1a6c2616`, Modus operate. Keine Staging-Challenger übernommen.

## Direction contract — Fassung 1 (überholt, Modus `read`)

**THESIS** — Diese Fläche ist ein Nachschlagewerk, kein Cockpit. Sie verweigert
die Instrumententafel, die jede Rechnerseite dieser Kategorie ausliefert:
Readout-Kacheln, Mikro-Versalien, Statuslämpchen. Autorität liegt in der Tabelle
und im erklärenden Vorspann, nicht in der Anmutung von Telemetrie.

**OWN-WORLD** — Nautisches Tabellenwerk. Ruhiger dunkler Grund der Site, ein
einziger Akzent, Haarlinien statt Rahmenkästen. Tabellen mit echten
Tabellenziffern, Spaltenlineal, Zebrafreiheit; Zahlen rechtsbündig auf der
Dezimalstelle. Kein Verlaufstext, kein farbiger Halo, kein Seitenstreifen an
Karten. Erkennbar auch ohne Inhalt: Vorspann-Spalte links, Tafel rechts,
durchgehendes Grundlinienraster.

**STORY** — Der Leser versteht, was der Aaron Halo ist und warum ein Austritt
überhaupt gerechnet werden muss; er glaubt es, weil jede Tafel ihre Herkunft
nennt; er benutzt die Interpolationshilfe, um zwischen zwei Tafelzeilen den
exakten Wert zu bekommen.

**FIRST VIEWPORT** — Titel im Satzspiegel, darunter der Vorspann in 65 Zeichen
Breite, rechts daneben die Bändertafel bereits sichtbar und lesbar. Kein Hero-
Foto, kein Riesentitel. Die Interpolationshilfe sitzt am Fuß der Tafel, wo im
Almanach die Korrekturtabelle steht.

**FORM** — Tabellenwerk nach Art eines nautischen Handbuchs; Position 5 der
geordneten Liste, zugewiesen durch den Seed-Schlüssel `7bffb9be` (Re-Roll von
`ba868092`). Keine Staging-Challenger übernommen.

## Durable rules

### Typografie
- Fließtext: max. **68 Zeichen** Zeilenbreite. Harte Grenze, keine Ausnahme.
- Funktionaler Text nie unter **12px**. Der Almanach hat keine Mikro-Beschriftung;
  wo bisher 10,8px getrackte Versalien standen, steht jetzt normal gesetzte
  Schrift in Satzgröße.
- Versalien nur für einzelne Wörter, nie für Sätze oder Zellinhalte.
- Tabellenziffern: `font-variant-numeric: tabular-nums`, Zahlen rechtsbündig.

### Farbe
- Strategie **Restrained**: neutraler Grund plus ein Akzent. Der Akzent markiert
  Bezug und Zustand, niemals Dekoration.
- Kein `background-clip: text`, keine Verlaufsschrift.
- Kein Schatten ohne Versatz. Höhe wird durch Versatzschatten dargestellt.

### Flächen
- Kein farbiger Streifen an einer Kante gerundeter Karten (weder `border-left`
  noch `border-top`) — die Kombination ist Standardmuster und beißt sich mit der
  Rundung. Trennung erfolgt durch Haarlinie und Weißraum.
- Innenabstand in umrandeten Behältern mindestens 12px.

### Bewegung
- Kein Bounce-/Elastic-Easing. Verzögerung exponentiell (`ease-out-quart` oder
  ruhiger).
- Keine pulsierenden Punkte als Lebendigkeitssimulation.
- Keine Übergänge auf `width`/`height`; Bewegung über `transform` und `opacity`.

### Herkunft
- Jede Tafel nennt ihre Quelle in der Tafelfußzeile. Spielstand-Werte und die
  cstone-Vermessung werden sichtbar unterschieden; Jordesseys Namensnennung
  bleibt.

## Provisorisch

Exakte Token (Spaltenbreiten, Grundlinienmaß, Akzentwert innerhalb der
Site-Palette) werden beim ersten Build festgelegt und hier nachgetragen.
