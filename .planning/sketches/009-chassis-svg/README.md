---
sketch: 009
name: chassis-svg
question: "Bekommt man ein gefrästes Gehäuse aus Code — oder braucht es eine Grafik?"
winner: "beantwortet, nicht gewonnen — siehe unten"
tags: [design, mining, werkbank, gehaeuse, svg, sackgasse]
---

# Skizze 009: SVG-Chassis

## Design-Frage

Nach Skizze 008 die Rückmeldung des Nutzers: *„kommt näher aber es ist noch
universen entfernt … du hast so die 2000er Spiele-Version gegeben."* Zu Recht:
008 war ein Stapel `linear-gradient`, und daraus wird eine Kante, nie ein
Bauteil.

Diese Skizze prüft die nächste Stufe: **das Gehäuse aus echter Pfadgeometrie mit
gerichtetem Licht.** Nicht Verläufe malen, sondern die Beleuchtung rechnen
lassen.

## Ansehen

```bash
start .planning/sketches/009-chassis-svg/index.html
```

## Die Technik (das eigentliche Ergebnis dieser Skizze)

- **`feSpecularLighting` als Fräsung.** Die Alphakante jeder Form wird
  weichgezeichnet und daraus ein Glanzlicht aus EINER festen Richtung gerechnet
  (Azimut 235°, Elevation 56°). Jede Form — auch die schrägen Schulterplatten und
  die Fußblöcke — bekommt dadurch von selbst eine stimmige Lichtkante, statt dass
  jede Schräge von Hand gemalt werden müsste. Das ist der qualitative Sprung
  gegenüber 008.
- **`feTurbulence` als Materialkorn**, entsättigt und schwach überlagert. Ohne
  das bleibt jede Fläche ein Farbverlauf und liest sich als Plastik.
- **Verschattung an der Aussparung** über einen weichgezeichneten schwarzen
  Konturstrich — erst dadurch ist die Bildfläche ein Loch und kein aufgemaltes
  Rechteck.
- Zwei Schalter in der Werkzeugleiste zeigen den Anteil jedes Effekts:
  „Fräsung aus/an", „Korn aus/an".

## Befund

**Die Technik trägt, das Ergebnis trägt nicht.** Die Kanten sind echt gefräst
statt angedeutet, aber das Material liest sich als helles Aluminium-Spielzeug,
nicht als das gebürstete Stahlblech der Vorlage. Was fehlt, ist nicht Geometrie,
sondern **Oberfläche**: Kratzer, Verlaufsflecken, unregelmäßige Reflexe,
Kantenabnutzung. Genau das leistet ein gerendertes Bild und keine Filterkette.

**Entscheidung daraus:** der Rahmen kommt als **Grafik** in den Bau, nicht als
Code — der Nutzer hat dafür sein Mockup freigegeben. Das Werkzeug dafür liegt in
[`../tools/make-frame.mjs`](../tools/make-frame.mjs): es schneidet aus der
Vorlage einen 9-Slice-Rahmen für `border-image`, stanzt die Bildfläche
transparent aus und misst die Schnittkanten selbst ein (Helligkeitssprung von
der Bildmitte nach außen, Median über fünf Abtastlinien).

Diese Skizze bleibt als **Rückfallweg** liegen: wenn die Grafik aus Gründen der
Dateigröße, der Lizenz oder des Hellmodus nicht in den Bau kann, ist der
SVG-Weg die beste codeseitige Näherung — und die Filterkette ist dann schon
gebaut und vorgeführt.

## Offene Punkte, falls der SVG-Weg doch gezogen wird

- **Kein `preserveAspectRatio="none"`.** Das Chassis steht in einem festen
  1280×720-Koordinatensystem, damit die Schrägen nicht verzerren. Für den echten
  Bau müsste es in neun Kacheln zerlegt oder mit festen Seitenteilen und nur
  gedehnten Strecken dazwischen gebaut werden — dasselbe Problem, das
  `border-image` beim Grafikweg von Haus aus löst.
- **`feSpecularLighting` ist teuer.** Auf einem unbewegten Rahmen ist es eine
  einmalige Rasterung, aber es darf nicht in etwas geraten, das animiert oder
  bei jedem Zustandswechsel neu gezeichnet wird.
- Der Hellmodus ist ungelöst: die Filterkette rechnet mit festen Lichtfarben.
