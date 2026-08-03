# Phase 5: Komponenten-Filter für Schiffe - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 5-Komponenten-Filter für Schiffe
**Areas discussed:** Größenart, Kategorien, Bedienung, Trefferregel, Turm vs. Waffe, fehlende Daten, Anzeige, Größenskala, Verhalten ohne Größe

---

## Größenart (vorab, vor der Phasenanlage)

| Option | Description | Selected |
|--------|-------------|----------|
| Steckplatz-Größe | Was ein Schiff aufnehmen KANN. Braucht einen neuen Datamine-Durchgang. | ✓ |
| Größe des Stock-Bauteils | Was ab Werk drinsteckt. Daten lägen fertig vor (`ship-loadouts.json`). | |
| Beides — filtern nach Steckplatz, anzeigen nach Stock | Vollständigste Antwort, größter Aufwand. | |

**User's choice:** Steckplatz-Größe
**Notes:** Diese Wahl legte fest, dass die Datenquelle erst erschlossen werden muss. Vor der Phasenanlage per Spike abgesichert, dass `ItemPort.maxSize` in den Fahrzeug-XMLs überhaupt greifbar ist.

---

## Kategorien

| Option | Description | Selected |
|--------|-------------|----------|
| Waffen + Schild + Kühler + Kraftwerk | Die vier, die beim Aufrüsten zählen. | ✓ |
| Zusätzlich Quantenantrieb + Radar | Restliche klassische Komponenten-Steckplätze. | ✓ |
| Zusätzlich Raketen + Gegenmaßnahmen | Raketenschächte und Täuschkörper-Werfer. | teilweise |
| Zusätzlich Türme | Turmwaffen getrennt von fest verbauten Waffen. | ✓ |

**User's choice:** „all diese sachen ausser gegenmassnahmen"
**Notes:** Gegenmaßnahmen ausdrücklich abgewählt, obwohl die Daten vorhanden wären. Ergibt acht Kategorien.

---

## Bedienung

| Option | Description | Selected |
|--------|-------------|----------|
| Pro Kategorie ein Größen-Auswahlfeld | Acht Felder, je „ab S*x*". | zuerst gewählt, dann verworfen |
| Größen-Chips zum Anklicken | Reihe von Schaltern je Kategorie. | |
| Panel „Komponenten" zum Aufklappen | Alle Kategorien in einem Ausklappbereich. | |
| **Ein Feld „Komponente" + ein Feld Größe** | Korrektur des Nutzers während des Gesprächs. | ✓ |

**User's choice:** „ne nicht pro kateogrie nach grössen sonjder ‚komponente' und da halt"
**Notes:** Ausdrückliche Korrektur der zuerst angenommenen Variante. Zwei Felder statt acht.

---

## Trefferregel bei mehreren Steckplätzen

| Option | Description | Selected |
|--------|-------------|----------|
| Einer reicht | Mindestens ein Steckplatz dieser Art ist groß genug. | ✓ |
| Alle müssen | Sämtliche Steckplätze dieser Art mindestens so groß. | |

**User's choice:** Einer reicht
**Notes:** Entspricht der Frage „kann ich da eine S5 dranbauen".

---

## Turm vs. Waffe

| Option | Description | Selected |
|--------|-------------|----------|
| Turm nur bei echten Türmen | Trennregel über Portname/Struktur, an Stichproben zu belegen. | ✓ |
| Beide Körbe | `[Turret, WeaponGun]` zählt bei beiden Kategorien. | |
| Kein eigener Turm-Filter | Türme laufen unter „Waffe". | |

**User's choice:** Turm nur bei echten Türmen
**Notes:** Ausgangspunkt war der Spike-Befund, dass `hardpoint_gun_left_wing` (Gladius) `types=[Turret, WeaponGun]` trägt, obwohl es eine feste Flügelkanone ist. Die Trennregel ist damit eine Bringschuld der Umsetzung, kein Nebenbei.

---

## Fahrzeuge ohne Steckplatz-Daten

| Option | Description | Selected |
|--------|-------------|----------|
| Raus, aber der Zähler nennt sie | „37 Treffer · 12 ohne Steckplatz-Daten". | ✓ |
| Bleiben immer sichtbar | Gekennzeichnet als „Steckplätze unbekannt". | |
| Still raus | Kommentarlos verschwinden. | |

**User's choice:** Raus, aber der Zähler nennt sie

---

## Anzeige der Größen

| Option | Description | Selected |
|--------|-------------|----------|
| Im Schiffs-Datenblatt | Aufstellung „Waffe 2× S3 · Schild 1× S1 …" (empfohlen). | |
| Datenblatt und Karte | Zusätzlich Chip im Kartenraster. | |
| Nur filtern | Keine Anzeige. | ✓ |

**User's choice:** Nur filtern
**Notes:** Gegen die Empfehlung entschieden. Die Anzeige ist als eigene Idee unter „Deferred Ideas" festgehalten, damit sie nicht verlorengeht.

---

## Größenskala im Auswahlfeld

| Option | Description | Selected |
|--------|-------------|----------|
| Nur vorkommende Größen | Feld passt sich der Bauteilart an. | ✓ |
| Feste Liste S0–S12 | Immer dieselben Einträge. | |

**User's choice:** Nur vorkommende Größen

---

## Verhalten ohne Größenauswahl

| Option | Description | Selected |
|--------|-------------|----------|
| Zeigt alle Schiffe mit so einem Steckplatz | „Turm, beliebige Größe" als eigene Frage. | |
| Filtert noch nicht | Bauteilart ist reine Vorauswahl fürs Größenfeld. | ✓ |

**User's choice:** Filtert noch nicht

---

## Claude's Discretion

- JSON-Format und Dateiname der neuen Datenausgabe
- Zuschnitt des CryXmlB-Lesers in `scripts/lib/`
- Abbildung der `Types`-Werte auf die acht Kategorien
- Aufbau der `data-*`-Attribute und des Inline-JS
- Dass der Datamine-Lauf lokal bleibt und das Ergebnis-JSON eingecheckt wird

## Deferred Ideas

- Steckplatz-Größen im Schiffs-Datenblatt sichtbar machen (D-07 abgewählt)
- Gegenmaßnahmen als neunte Kategorie
- Anzahl der Steckplätze als Filterkriterium („mindestens 2× S5")
- Entdopplung der beiden `schiffe.astro` (Class-A-Befund, gehört zu Phase 4)
