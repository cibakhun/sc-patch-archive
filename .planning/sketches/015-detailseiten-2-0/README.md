---
sketch: 015
name: detailseiten-2-0
question: "Was soll eine generierte Datenseite zuerst beantworten: wie das Item aussieht, ob es gut ist, oder wie man drankommt?"
winner: null
tags: [design, detailseiten, items, bauplaene, missionen, konzept]
---

# Skizze 015: Detail Pages 2.0

**Wegwerf-Entwürfe, kein Produktionscode.** Anlass: Betreiber-Auftrag vom
08.11.2026, Detail Pages 2.0 als „vollständige visuelle Aufwertung der
generierten Datenseiten“ zunächst nur konzeptionell vorzubereiten, keine
umfangreiche Implementierung ohne visuelle Freigabe.

Konzept (Claude Doc): https://claude.ai/artifact/P5oGDrQ4v7sSLwR6VY3fWt

Öffnen: die drei HTML-Dateien direkt aus dem Repo im Browser. Schriften kommen
relativ aus `assets/fonts/`, Bilder aus `img/`. Keine externen Anfragen.

Alle drei zeigen dieselbe echte Seite, den **Attrition-3-Repetierer**, mit den
Werten aus `assets/universal-items.json` (4.10.2), dem Bauplan und der Mission
aus dem Build von staging `21c2cd9e`. Das Waffenbild ist ein Render des
Hangar-Modells `public/hangar/weapons/attrition-3-repeater.glb`, die
Fahrzeugbilder sind `public/hangar/cards/*.webp`.

---

## Bestand, gemessen am Build von `21c2cd9e`

| Seitentyp | Seiten je Sprache | Höhe Desktop / Handy |
| --- | --- | --- |
| Item-Datenblatt | 5.369 | 3,5 / 7,0 Bildschirme (Waffe) |
| Bauplan | 1.608 | 2,7 / 5,4 |
| Mission | 1.387 | 4,6 / 6,7 |
| Kategorie | 151 + 62 | 2,4 / 14,8 (Rüstung, Handy) |
| Schiff | 231 | (gehört zum Hangar-Vorhaben) |

- Der Attrition-3 hat **15 Spielwerte, die Seite zeigt 5** — Reichweite,
  Projektil, Munition, Wärme, EM-Signatur, Strombedarf fehlen.
- **450 von 5.369 Itemseiten** (117 Schiffswaffen, 333 Bauteile) haben ein
  Hangar-Modell; keine zeigt es.
- Kein Wert ist eingeordnet: 501,67 DPS ist Platz 16 von 26 in Größe 3.
- Drei Bildsprachen (DataShell, Missionsseite, Holo-Konsole); die DataShell
  trägt das Vokabular, das Skizze 006 als datierend aussortiert hat.

## A — „Schaustück“ (`a-schaustueck.html`)

Das Item ist ein Gegenstand. Gerendertes Spielmodell groß, Preis daneben,
Baureihe Attrition-1 bis -6 als Größenleiter, Datenblatt mit allen 15
Werten in vier Gruppen, Kaufen nach System, Ab Werk mit Fahrzeugbildern.

- **Stärke:** der größte Sprung im Eindruck.
- **Kostet:** trägt heute nur auf 8 % der Itemseiten. Rüstung, Kleidung,
  Handwaffen brauchen erst Modelle aus einem PC-Lauf.

## B — „Einordnung“ (`b-einordnung.html`) — empfohlen

Das Item ist ein Platz in einem Feld. Jeder Wert als Streifen über alle 26
Schiffswaffen der Größe 3 (gleiche Werte ein Punkt mit Anzahl, Median
gestrichelt), „Auf einen Blick“ aus Rängen und Medianen, Preis gegen DPS als
Streudiagramm, direkter Vergleich mit drei Nachbarn.

- **Stärke:** beantwortet „ist das gut, gibt es Besseres?“ — Beispiel
  CF-337 Panther: +9 % DPS, −30 % Preis. Trägt auf allen 3.571 Itemseiten mit
  Spielwerten, ohne neue Extraktion.
- **Kostet:** feste Klassenregeln je Seitentyp; die Streifen sind hier
  gestrecktes SVG (am Handy werden die Punkte oval) — im Bau als
  CSS-Punkte oder unverzerrtes SVG.

## C — „Beschaffung“ (`c-beschaffung.html`)

Das Item ist ein Ziel. Vier Wege als Kacheln (kaufen, ab Werk, herstellen,
Bauplan), Kaufen als drei Systeme nebeneinander (ohne Sprungpunkte oder Lage:
die kennt die Seite nicht), Herstellen als Kette Mission → Material →
Fabricator → Item.

- **Stärke:** macht Item, Bauplan und Mission zu einem Netz.
- **Kostet:** wird dünn bei Items mit einem Kaufort und ohne Bauplan.

## Am Rand gefunden (nicht Teil von 2.0)

- „Stand der Preise11. Oktober 2026“ ohne Leerzeichen auf 2.998 DE-Itemseiten,
  EN „Prices as ofOctober 11“.
- Leere Kennzahl „Feuermodi“ auf 29 Bauplanseiten.
- „1 Missionen droppen den Blueprint“ auf 193 DE-, „1 missions“ auf 207
  EN-Bauplanseiten.
- Ausreißer prüfen, bevor eine Skala darauf steht: Reign-3 2.041,67 DPS
  (Median Größe 3: 541,15), Attrition-6 2.947,88 gegen 875 beim Attrition-5.
- „Wärme je Schuss“ reicht in Größe 3 von 0,512 bis 1.800 — gemischte
  Einheiten, nicht vergleichen.
