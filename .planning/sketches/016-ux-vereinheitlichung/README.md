---
sketch: 016
name: ux-vereinheitlichung
question: "Welche Seite beantwortet welche Frage, damit ein Spieler nie überlegen muss, welche von drei Seiten eine Aufgabe erledigt?"
winner: null
tags: [konzept, navigation, suche, crafting, items, bauplaene, seo]
---

# Skizze 016: Bedienung vereinheitlichen

**Wegwerf-Entwürfe, kein Produktionscode.** Anlass: Betreiber-Auftrag vom
09.11.2026 „UX-Vereinheitlichung und Seitenstruktur“. Erst Bestandsaufnahme,
Konzept und Entwürfe; strukturelle Änderungen erst nach Freigabe.

Konzept (Claude Doc): https://claude.ai/artifact/AZJ5P7oGg3Xw8ygFZnbQ46

Öffnen: die HTML-Dateien direkt aus dem Repo im Browser. Schriften und
Hintergrundbilder kommen relativ aus `assets/`, das Waffenbild aus `img/`.
Keine externen Anfragen. Alle Werte stammen aus dem Vorschau-Bau von staging
`44938189`.

| Datei | Zeigt | Zustände |
|---|---|---|
| `1-start-suche.html` | Startseite: Suche direkt im großen Feld, Treffer gruppiert darunter, Item und Bauplan als ein Treffer mit „Herstellen“ | `?z=leer`, `?z=mining`, `?z=panther`, `?z=gladius`; `&rahmen=dialog` zeigt dieselben Treffer im Dialog der Kopfleiste |
| `2-item-herstellen.html` | Item-Datenblatt (Sprache aus Skizze 015) mit den drei Wegen Kaufen, Herstellen, Ab Werk | Desktop und Handy über die Fensterbreite |
| `3-crafting-werkzeug.html` | Crafting-Werkzeug mit Rezeptliste, gewähltem Rezept und Planer-Leiste; Crafting-Identität bleibt | Desktop drei Spalten, Handy als Ebenen mit fester Leiste |
| `4-seitenstruktur.html` | Übersicht „Ein Ort je Frage“: Werkzeug und Datenblatt je Bereich, Querverweise | eine Tafel |

`img/hinter-datenblatt.png` ist eine Aufnahme des heutigen Item-Datenblatts,
nur als Hintergrund für den Dialog-Zustand.

Gerenderte Bilder (heute und Entwurf, Desktop 1280 und Handy 390) liegen in
den Projektdateien unter `ux-vereinheitlichung/`.

## Kernpunkte des Konzepts

- Je Bereich ein Werkzeug zum Arbeiten und ein Datenblatt zum Nachschlagen;
  Listen und Kategorien bleiben als Einstieg.
- Startseite: kein zweites Popup, das große Feld sucht selbst. Kopfleiste
  behält den Dialog. Ein Suchkern, ein Register.
- Item → Crafting in einem Schritt; das Rezept lebt im Werkzeug.
- Bauplan-Adressen `/crafting/<rezept>.html` bleiben (Option A): gleiche
  Adresse, gleiches Canonical, gleiche strukturierte Daten, Inhalt = Werkzeug
  mit diesem Rezept. Keine Weiterleitung, nichts wird entfernt.

Entscheidungen stehen am Ende des Konzepts. Bis dahin wird nichts davon gebaut.
