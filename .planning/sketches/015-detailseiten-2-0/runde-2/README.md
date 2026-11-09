---
sketch: 015
round: 2
name: detailseiten-2-0-runde-2
question: "Trägt Richtung B „Einordnung“ im Rahmen von Skizze 016 auch dort, wo es kein Modell, keine Kaufpreise oder keinen Lohn zum Vergleichen gibt?"
winner: null
tags: [detailseiten, items, ruestung, missionen, kategorien, einordnung]
---

# Skizze 015, Runde 2: Richtung B im neuen Rahmen

**Wegwerf-Entwürfe, kein Produktionscode.** Anlass: Der Betreiber hat am
09.11.2026 Richtung B „Einordnung“ gewählt. Der Rahmen kommt aus Skizze 016
„Bedienung vereinheitlichen“: unter dem Kopf stehen die Wege zum Item,
Herstellen führt in einem Schritt ins Crafting-Werkzeug, 2.0 entwirft keine
eigene Bauplan-Seite. Seiten-Code entsteht erst nach Abnahme dieser Runde.

Öffnen: die HTML-Dateien direkt aus dem Repo im Browser. Grundsprache aus
`../basis.css`, Bausteine dieser Runde in `r2.css`, Bilder aus `../img/`.
Keine externen Anfragen. Alle Werte sind aus `assets/universal-items.json`,
`assets/crafting-db.json` und `src/data/missions.json` gerechnet
(staging `6f186ccc`, Spielversion 4.10.2), nichts geschätzt.

| Datei | Seite | Zeigt |
|---|---|---|
| `1-waffe.html` | Attrition-3-Repetierer | B im Rahmen: Kopf mit Modell, drei Wege (Kaufen, Herstellen, Ab Werk), Einordnung in Größe 3, Baureihe in sechs Größen, Kaufen nach System |
| `2-ruestung.html` | PAB-1-Arme | Rüstung ohne Modell: Farbfelder statt Bild, zwei Wege plus Baureihe, Feld der leichten Arme, derselbe Hersteller in drei Gewichtsklassen, alle 26 Ausführungen |
| `3-mission.html` | Retrieve Additional Smuggler Intel | Was je Abschluss fällt (zwei Gruppen), Einordnung unter 342 Missionen mit Bauplänen, Voraussetzung, Auftragstext, weitere Aufträge desselben Auftraggebers |
| `4-kategorie.html` | Rüstung · Arme | 48 Baureihen statt 453 Einzelzeilen, nach Gewichtsklasse, mit Temperaturbalken, Preis und Bezugswegen |

Die Seiten verlinken einander dort, wo es die echte Seite auch täte (Waffe →
Mission, Mission → Waffe, Kategorie → Rüstung).

## Was sich gegenüber Runde 1 ändert

- **Streifen als HTML statt gestrecktem SVG.** Jeder Punkt sitzt an einer
  Prozent-Position und bleibt am Handy rund. Anzahlen gleicher Werte stehen
  nur dort über dem Punkt, wo sie nicht mit einer Nachbarzahl kollidieren;
  sonst im Tooltip.
- **Wege-Leiste aus 016 direkt unter dem Kopf.** Herstellen ist die einzige
  orange Fläche und führt mit „Im Crafting öffnen“ ins Werkzeug. Rezepttabelle
  und Herstellkette (Entwurf C) stehen nicht mehr auf der Itemseite.
- **Die Leiste zeigt nur Wege, die es gibt.** Rüstung wird nicht ab Werk
  verbaut; an dritter Stelle steht dort die Baureihe mit allen Teilen und dem
  Gesamtpreis, sichtbar als Information abgesetzt, nicht als Weg.
- **Leiter als gemeinsamer Baustein.** Waffe: dieselbe Reihe in sechs Größen.
  Rüstung: derselbe Hersteller in drei Gewichtsklassen.

## Befunde aus den Daten

Sie bestimmen, was „Einordnung“ je Seitenart heißen kann.

1. **Rüstungsschutz ist je Gewichtsklasse fest.** Alle 451 Arme mit
   Spielwerten haben in allen fünf Schadensarten denselben Faktor: Leicht 0,8
   (−20 %), Mittel 0,7, Schwer 0,6. Das Gewicht ebenso (2, 4, 6 kg bei allen
   mit Bauplan). Ein Vergleich „wer schützt besser“ innerhalb einer Klasse
   wäre leer. Die Seite sagt das einmal (ein einziger Punkt mit „16“) und
   ordnet nach Temperatur, Preis und Auswahl ein. Strahlung schwankt nur bei
   Schwer (26.800 oder 52.800 REM).
2. **Farben sind für Spieler keine eigenen Items.** 451 Arme fallen in 48
   Baureihen; bei 40 davon haben alle Farben dieselben Temperaturwerte.
   Vorschlag: die Kategorie listet Baureihen, jede Farbseite bleibt mit
   eigener Adresse bestehen (keine Seite fällt weg, keine Weiterleitung) und
   zeigt ihre Schwestern als Raster. Die Gruppierung nutzt `game.setId` und
   für Sondereditionen das Präfix der Kennung; für den Bau braucht es ein
   festes Feld.
3. **Lohn ist meist nicht vergleichbar.** 850 von 1.387 Missionen rechnen den
   Lohn erst im Spiel aus. Die Missionsseite ordnet deshalb über Baupläne ein:
   Anzahl im Angebot und wie viele es nur hier gibt (nur 29 von 342 Missionen
   vergeben überhaupt einen solchen).
4. **Missions-Pools haben Gruppen.** Smuggler Intel führt zwei Gruppen, jede
   mit Chance 100 %: 14 Ausrüstungs-Baupläne und 3 Schiffswaffen. Die heutige
   Missionsseite zeigt alle 17 als eine Liste, Entwurf C aus Runde 1 schrieb
   „zufällig einen von 17“. Lesart dieser Runde: je Abschluss einer aus jeder
   Gruppe. **Im Spiel zu bestätigen**, bevor eine Seite „1 aus 3“ verspricht;
   die Entwürfe tragen deshalb die Marke „im Spiel zu prüfen“.
5. **Laden → System** steht nur im Namenszusatz („(Pyro)“) oder muss aus
   bekannten Ortsnamen erschlossen werden (Lorville, ARC-L1 …). Für „Kaufen
   nach System“ braucht es ein Datenfeld.
6. **Einträge ohne Spielwerte.** Zwei Einträge der Kategorie Arme (Lynx Arms
   Base, TrueDef-Pro Arms White/Silver/Gray) und drei PAB-1-Woodland-Teile in
   „Other“ haben keine Spielwerte. Sie gehören in keine Baureihe, bis die
   Daten nachziehen.
7. **Attrition-6** mit 2.947,88 DPS bleibt als Ausreißer zu prüfen (aus
   Runde 1 offen).
8. **Farbfelder** sind Näherungen nach dem Farbnamen (`game.color`); für den
   Bau bräuchte es echte Farbwerte oder Bilder je Ausführung.

## Offen für den Betreiber

- Trägt die Rüstungsseite ohne Bild, mit den Farbfeldern im Kopf?
- Kategorie als Liste der Baureihen, Farben dahinter (alle Farbseiten bleiben):
  einverstanden?
- Soll „1 aus 3“ auf Missionsseiten erst nach einer Spielprüfung erscheinen?

Die gerenderten Bilder (Desktop 1440 und Handy 390, je Falz und ganze Seite)
sind nicht im Repo eingecheckt. Sie liegen beim Betreiber in den
Projektdateien unter `detailseiten-2-0/runde-2/`; wer sie neu braucht, öffnet
die vier HTML-Entwürfe dieses Ordners im Browser.
