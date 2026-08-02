# Phase 5: Schiffe — Rollen- und Merkmalsfilter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 05-schiffe-rollen-und-merkmalsfilter
**Areas discussed:** Filtermodell, Rollen-Granularität, Schnellzugriff, Sprachfassungen,
Signatur/Tarnung, Merkmalsumfang

---

## Filtermodell

| Option | Description | Selected |
|--------|-------------|----------|
| Beruf + Rolle + Merkmale | Drei Bedienelemente: Beruf (7) → Rolle (~30) → Merkmale (Mehrfachauswahl) | ✓ |
| Rolle gruppiert + Merkmale | Ein Rollenmenü mit `<optgroup>` nach Beruf; spart ein Element | |
| Nur Rolle + Merkmale | Beruf entfällt, flache Rollenliste | |

**User's choice:** Beruf + Rolle + Merkmale
**Notes:** Die Rolle wurde im Verlauf auf 18 Familien verdichtet (siehe unten), das
Merkmalselement auf Signatur + drei CIG-Felder.

---

## Rollen-Granularität

| Option | Description | Selected |
|--------|-------------|----------|
| Familie filtern, exakt anzeigen | Filter kennt „Bergung", Karte zeigt „Schweres Bergungsschiff" | ✓ |
| Exakte Rolle filtern | Alle ~30 atomaren Rollen einzeln; präzise, aber lange Liste | |
| Zweistufig | Familie, dann optional Gewichtsklasse als zweites Menü | |

**User's choice:** Familie filtern, exakt anzeigen
**Notes:** Ergab 18 Familien über 223 Schiffe.

---

## Schnellzugriff

| Option | Description | Selected |
|--------|-------------|----------|
| Chip-Reihe | Voreinstellungen setzen Rolle + Merkmal in einem Klick | ✓ |
| Nur Filter | Keine Voreinstellungen | |
| Nur als Hilfetext | Beispiele als Fließtext, nicht anklickbar | |

**User's choice:** Chip-Reihe

---

## Sprachfassungen (DE/EN)

| Option | Description | Selected |
|--------|-------------|----------|
| Auf EIN Körper ziehen | Komponente unter `src/components/ships/`, Seiten werden Hüllen | ✓ |
| Kopien belassen | Umbau in beide Dateien getrennt einbauen | |

**User's choice:** Auf EIN Körper ziehen
**Notes:** Trägt den Class-A-Befund aus CONCERNS.md für dieses Seitenpaar ab.

---

## Signatur / Tarnung

Diese Frage lief über drei Runden und wurde vom Nutzer zwischendurch gedreht.

**Runde 1** — Vorschlag „Abgesenkte Signatur" statt „Tarnung", weil Nox und Dragonfly mit
0,50 die niedrigsten Werte haben, aber niemand sie Tarnkappenschiffe nennt.
**Antwort des Nutzers:** *„das musst du mir kurz und einfach erklären, was kommt denn aus
den Daten direkt? wir sollten nur die Daten die aus dem Spiel kommen benutzen."*

**Runde 2** — Nachgeschaut, ob das Spiel eigene Wörter hat. Ergebnis: ja.
`hud_Label_Stealth` = „Tarnung"/„Stealth"; `hud_scanning_info_ir_signature` = „IR-Signatur";
ebenso EM- und RQ-Signatur; `item_SubTypeSignatureReductor` = „Signaturabschwächer".
Vorgelegt als Tabelle „was steht wörtlich in den Dateien".

| Option | Description | Selected |
|--------|-------------|----------|
| CIG-Wort „Tarnung" + CIG-Zahl auf der Karte | Filter heißt „Tarnung", Karte zeigt „IR-Signatur 0,76" | |
| Nur die Rolle, keine Zahlen | Ausschließlich CIG-Rollen; Prowler Utility dann nicht als tarnfähig auffindbar | ✓ (Runde 2) |
| Filter heißt „Signatur" | Nüchtern statt griffig | |

**Runde 3** — Konsequenz vorgelegt: mit „nur die Rolle" wird das Eröffnungsbeispiel des
Nutzers („stealth cargo / prowler utility") unauffindbar, weil CIG ihn im Rollenfeld
schlicht „Leichter Frachter" nennt.
**Antwort des Nutzers:** *„okay stop. können wir andere Sachen aus den Daten holen?
Bergbau, Bergung, Dropship, etc.?"* — Der Nutzer war durch den Sonderfall verunsichert.
Daraufhin die 18 Familien vorgelegt, die alle direkt aus CIG-Rollen stammen.

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, Signatur als eigene Spalte | Eigener Filter, CIG-Beschriftung „IR-Signatur", Zahl auf der Karte | ✓ (final) |
| Nein, nur Rollen | Nur die 18 Familien | |

**User's choice (final):** Signatur kommt dazu, nüchtern beschriftet.
**Notes:** Rückblickend war die Frage in Runde 1 falsch gerahmt — sie stellte einen
Randfall (22 von 227 Schiffen) an den Anfang, bevor die tragende Achse (CIG-Rollen für
223 Schiffe) überhaupt gezeigt war. Das hat den Nutzer unnötig ins Zweifeln gebracht.

---

## Merkmalsumfang

| Option | Description | Selected |
|--------|-------------|----------|
| Tarnung + Bergbau + Abriegelung | Sofort belegbar, null Fehltreffer | |
| Plus Bergung + Betankung + Traktorstrahl | Echte Geräte, aber Pfadmuster müssen verengt werden | |
| Plus Bewaffnet / Frachtraum / Bodenfahrzeug | Aus `dogfightEnabled`, `cargoSCU`, `isGravlevVehicle` | ✓ |

**User's choice:** Bewaffnet / Frachtraum / Bodenfahrzeug
**Notes:** Bergbau und Abriegelung sind über die CIG-Rollenfamilien ohnehin abgedeckt, das
Loadout-Signal wird dafür nicht gebraucht. Bergung/Betankung/Traktorstrahl wurden auf eine
spätere Phase geschoben (Prüfaufwand gegen Fehltreffer). In CONTEXT.md D-09 ist vermerkt,
dass ein Merkmal, das gegenüber der Rolle nichts aussiebt, wieder rausfliegt.

---

## Claude's Discretion

- Ablage und Form der Rolle→Familie-Zuordnung
- Optik der Filterkonsole innerhalb der bestehenden Sci-Fi-Sprache
- Stufen oder Schieber für den Signaturfilter
- Verifikationsskript für den Datamine

## Deferred Ideas

- Schiffs-Datenblatt (`ShipDetail.astro`) mit denselben Werten anreichern
- Suchindex um Rollenbegriffe erweitern
- Bergung / Betankung / Traktorstrahl als Loadout-Merkmale (Prüfdurchgang nötig)
- ATLS-Lücke im DataCore suchen (4 Schiffe ohne Rolle)
- Die übrigen 66 Sprachpaare auf EIN Körper ziehen
