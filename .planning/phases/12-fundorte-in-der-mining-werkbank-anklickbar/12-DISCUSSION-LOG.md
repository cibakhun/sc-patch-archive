# Phase 12: Fundorte in der Mining-Werkbank anklickbar — Gesprächsprotokoll

> **Nur Nachweis.** Nicht als Eingabe für Planungs-, Recherche- oder
> Ausführungsagenten verwenden. Die Entscheidungen stehen in `12-CONTEXT.md` —
> dieses Protokoll bewahrt die verworfenen Alternativen.

**Datum:** 2026-08-15
**Phase:** 12-fundorte-in-der-mining-werkbank-anklickbar
**Besprochene Bereiche:** Ein- und Ausstieg, Gruppierung nach Methode,
Spurenerze darstellen, Der Rest der Werkbank währenddessen (alle vier gewählt)

---

## Vorentscheidung: Wo lebt die Fundort-Ansicht?

Vor der Phasenanlage gestellt, weil die Antwort die Phase selbst zuschneidet.

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Eigene Seiten + Klick aus der Werkbank | 45 Fundorte × DE/EN = 90 statische Seiten, teilbar, verlinkbar, indexierbar — der Hebel, der bei Item-Finder und Crafting den Ausschlag gab. Empfehlung von Claude | |
| Nur in der Werkbank umschalten | Mittelspalte wechselt auf die Fundort-Sicht, keine neuen Seiten. Billiger, bleibt im Werkzeugfluss, nichts davon auffindbar | ✓ |
| Beides gestaffelt | Erst Umschaltung, Seiten in zweiter Welle | |

**Wahl des Betreibers:** Nur in der Werkbank umschalten — gegen die Empfehlung.
**Notiz:** Die Seiten-Variante ist in `12-CONTEXT.md` unter „Zurückgestellte
Ideen" erhalten; `?fundort=` (D-04) wäre die Brücke dorthin.

## Vorentscheidung: Was steht je Fundort drin?

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Erzliste mit Chance, Höchstanteil, Balken | Die Basis aus `bodies[]` | (siehe unten) |
| Verkaufspreis je Erz + bester Erlös | `refinery-data.json`, 26 der 37 Erze | |
| Scan-Signatur je Erz | Wie scmdbs ⊙-Wert | |
| Anflugpunkte + Methodensymbole | Lagrange-Punkte, Abbaumethoden des Ortes | (siehe unten) |

**Antwort des Betreibers (Freitext):** „ich weiss es ehrlichgesagt nicht so
recht. ich glaube preis ist unsinnig. was macht scmdb? maybe das."

**Notiz:** Nachgesehen statt geraten. scmdb zeigt auf seiner Fundort-Seite
**keinen Preis** — der Instinkt war richtig. Deren Spalten: Scan-Signatur,
Höchstanteil + Adernzahl, Balken, Chance, gruppiert nach Methode mit
Gruppenanteil. Davon deckbar: Gruppierung, Signatur, Höchstanteil, Chance,
Balken. Nicht deckbar ohne Erfindung: Gruppenanteil (rechnet Salvage/Debris
mit), Adernzahl (nicht in unseren Daten). Daraus wurde der Vorschlag, der in
die vier Bereiche unten zerlegt wurde.

---

## Ein- und Ausstieg

### Klickziel

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Ganze Zeile | Größtmögliches Ziel, Nadel bleibt eigener Bereich. Historie: beim Anheft-Knopf war nie der Knopf zu klein, sondern die Kachel | ✓ |
| Nur der Ortsname | Sauberer gegen die Nadel abgegrenzt, aber kleines Ziel („Ita", „Clio") | |
| Eigener Pfeil am Zeilenende | Eindeutig, aber zwei kleine Knöpfe nebeneinander — genau die Enge, die schon einmal zurückgemeldet wurde | |

### Rückweg

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Erzzeilen klickbar → zu diesem Erz | Navigationsnetz in beide Richtungen, dazu Zurück-Pfeil im Kopf | ✓ |
| Nur der Zurück-Pfeil | Reine Lesesicht, einziger Ausgang zurück zum Ausgangserz | |

### Merkliste rechts

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Ja, denselben Klick | Sonst zwei Fundortlisten, von denen nur eine reagiert | ✓ |
| Nein, nur aus der Erz-Fundortliste | Ein Einstiegspunkt, weniger Klickwege | |

### Teilbar per Adresse

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Ja, `?fundort=` | `?mineral=` existiert bereits, dieselbe Mechanik. Verlinkbar ohne neue Seite | ✓ |
| Nein | Nur während der Sitzung, nichts verlinkbar | |

**Notiz:** Alle vier wie empfohlen.

---

## Gruppierung nach Methode

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Immer gruppieren | Auch die 20 einmethodigen Fundorte — die Überschrift ist eine wahre Aussage, der Aufbau springt nicht um | ✓ |
| Nur bei mehreren Methoden | Spart eine Zeile, lässt die Ansicht je nach Ort verschieden aussehen | |
| Nicht gruppieren, Abzeichen je Zeile | Kürzeste Darstellung, aber ROC-Zeilen muss man selbst zusammensuchen | |

**Notiz:** Wie empfohlen. Grundlage war die Messung 25 von 45 Fundorten mit
mehreren Methoden.

---

## Kennzahl an der Erzzeile

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Erwartungswert `eff` | Spiegelbildlich zur heutigen Fundort-Zeile, `row2()` unverändert nutzbar. Empfehlung von Claude | |
| Chance | Wie scmdb. Balken und Sortierung müssen mitziehen, sonst wirkt die Liste unsortiert | ✓ |
| Höchstanteil | Taugt schlecht zum Rangieren — je Erz oft an allen Fundorten identisch | |

**Wahl des Betreibers:** Chance — gegen die Empfehlung.
**Notiz:** Die Folge wurde vor der Bestätigung vorgelegt: unter
Chance-Sortierung stehen die Spurenerze nicht mehr am Ende, sondern verstreut
in der Liste. Beispiel Pyro Deep Space Asteroids gezeigt. Der Betreiber hat
danach die konsequente Variante gewählt (Zahl, Balken und Reihenfolge sagen
alle dasselbe) statt der beiden Ausweichvarianten.

---

## Spurenerze darstellen

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Gedämpft mit Abzeichen „Spur" | Ein Mechanismus, keine verschachtelten Überschriften unter der Methodengruppe | ✓ |
| Eigener Abschnitt „Nur in Spuren" | Deutlichste Trennung, aber bei drei Methoden schnell sechs Überschriften | |
| Unverändert wie alle anderen | Wenigster Aufwand, aber niemand sieht die nicht abbauwürdige Hälfte | |

### Folgefrage nach der Chance-Entscheidung

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Chance sortiert, Spuren gedämpft dazwischen | Zahl, Balken und Reihenfolge sagen dasselbe; Spuren verstreut, aber sofort erkennbar | ✓ |
| Chance sortiert, Spuren an den Schluss | Ruhigeres Bild, aber zwei Ordnungen in einer Liste | |
| Chance als Zahl, `eff` sortiert | Spuren wieder am Ende, aber die sichtbare Zahl erklärt die Reihenfolge nicht | |

**Notiz:** Die Schwelle ≤ 10 % Höchstanteil ist keine Ermessensentscheidung —
die 521 Paare verteilen sich auf 171 mit ≤ 10 % und 350 mit > 50 %, dazwischen
liegt nichts.

---

## Scan-Signatur in der Erzzeile

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Ja, in der Unterzeile | Die Zahl, die im Flug am Scanner steht. Empfehlung von Claude | |
| Nein, die Signaturenliste rechts leistet das | Unterzeile bleibt kurz | ✓ |

**Wahl des Betreibers:** Nein — gegen die Empfehlung.

---

## Der Rest der Werkbank währenddessen

### Kachelspalte links

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Erze dieses Ortes hervorheben | Alle 37 bleiben stehen, die 6–17 hier vorkommenden markiert. Kein Filter | ✓ |
| Unverändert stehen lassen | Wenigster Aufwand, wenigste Überraschung | |
| Auf die Erze des Ortes filtern | Stärkster Effekt, aber der Weg zu anderen Erzen ist verstellt und die Filterzeile hätte zwei Herren | |

### Fußzeile

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Unverändert beim zuletzt gewählten Erz | Gehört zum Werkzeug, nicht zur Ansicht | ✓ |
| Auf das ertragreichste Erz des Ortes umstellen | Zusammenhängender, wechselt aber unter der Hand das Ziel | |
| Ausgrauen | Ehrlich, nimmt aber einen funktionierenden Weg weg | |

### Kopfzeile der Mittelspalte

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Ortsname, Art · System · Anflugpunkte, Zurück-Pfeil; Signaturkasten und Anheft-Knopf entfallen | Beide beziehen sich auf ein Erz; einen Ort allein kann man nicht anheften | ✓ |
| Zusätzlich die Zahl der Erze | Dieselbe Zählform wie „Fundorte · 12", eine Zeile mehr | |
| Anheft-Knopf behalten für „letztes Erz an diesem Ort" | Bequem, aber gleich aussehender Knopf mit anderer Wirkung — hat in Phase 10 ein Preset gekostet | |

**Notiz:** Alle drei wie empfohlen.

---

## Claudes Ermessen

- Zustand beim Neuladen (Vorschlag: die Adresse gewinnt, die Ansicht wird nicht
  im `localStorage` gemerkt — wie `?mineral=` es heute hält)
- Bezeichner der Zustandsvariablen, Aufbau der Umschaltung, Übergangsanimation,
  genaue Dämpfungswerte der Spurenzeilen
- Wortlaut der DE/EN-Beschriftungen

## Zurückgestellte Ideen

- Eigene Fundort-Seiten (45 × DE/EN) — vorgelegt und zugunsten der reinen
  Werkbank-Umschaltung verworfen
- Preis am Fundort (`sell`/`sellMax`/`sellLoc`, 26 Erze)
- Adernzahl je Erz und Fundort — bräuchte eine Erweiterung der Extraktion
- Salvage- und Debris-Vorkommen — anderes Sachgebiet

## Geprüft und nicht als Auftrag übernommen

Zwei Abweichungen gegen scmdb fielen beim Vergleich auf. Ich hatte die erste
voreilig als möglichen Datenfehler gemeldet und diese Meldung nach dem
Nachlesen der Extraktion zurückgenommen:

1. 12 Erze gegen deren 7 an Pyro Deep Space Asteroids — die fünf fehlenden sind
   genau die mit Höchstanteil 5–10 %; scmdb blendet Spuren aus.
2. Aluminium 29,8 % gegen deren 14,9 % — unsere Chance summiert über alle
   Felsarten, die das Erz führen (2 × 14,9), so definiert in
   `scripts/datamine-locations.mjs:97-107`. Das Mehrfach-Slot-Doppelzählen ist
   dort getrennt behandelt (Zeilen 130–149).

Definitionsunterschied, kein Fehler. An den Zahlen wird in dieser Phase nichts
geändert.
