# Phase 9 — Kontext: Mining-Werkbank, Fundort-Merkliste

Erhoben am 15.08.2026 im Gespräch mit dem Betreiber, vor der Planung.

## Ausgangslage

`src/components/MiningWorkbench.astro` + `assets/mining-workbench.js`.
Raster heute: `grid-template-columns: 470px 1fr 262px`

| Bereich | Klasse | Inhalt heute |
|---|---|---|
| links | `wb__pane--list` | Suchfeld, System-Filter, 37 Erz-Kacheln mit Anheft-Symbol |
| Mitte links | `wb__pane--a` | Erz-Kopf (Name, Chips, Signatur, großer Anheften-Knopf), Physik, Qualitätsstufen, „Steine mit diesem Erz" |
| Mitte rechts | `wb__pane--b` | Fundorte-Liste, darunter „Beste Stationen" |
| rechts | `wb__pane--sig` | Signaturenliste mit Scan-Wert und kontogebundenen Presets (`mining_sig_presets`) |

Die Mitte ist über `.wb__mid{grid-template-columns:1fr 1fr}` zweigeteilt.

## Entschieden

1. **Detailspalte entfällt inhaltlich, der Kopf bleibt.** Physik, Qualitätsstufen und
   „Steine mit diesem Erz" verschwinden ersatzlos (kommen später anders wieder).
   Der Erz-Kopf — Name, Chips, Signaturwert, großer Anheften-Knopf — bleibt und
   setzt sich als Kopfzeile über die Fundorte. Begründung: sonst wäre nicht
   sichtbar, welches Erz gewählt ist, und der Erz-Anheften-Knopf ginge verloren.

2. **„Beste Stationen" wandert mit den Fundorten mit** — beides bezieht sich auf
   das gewählte Erz und bleibt zusammen.

3. **Die Mitte wird EINE Spalte.** Aus `1fr 1fr` wird eine Bahn: Kopf, Fundorte,
   Beste Stationen. Das ist mehr als Kosmetik — seit der Fundort-Korrektur vom
   14.08. hat ein Erz bis zu 21 Fundorte (vorher max. 11), die schmale Bahn
   reichte dafür nicht.

4. **Signaturenliste und Fundort-Merkliste teilen sich die rechte Spalte**, über
   zwei Reiter umschaltbar, mit **einem gemeinsamen Preset-System**.
   ⚠ Folgt daraus: `mining_sig_presets` muss ein Feld für Fundort-Paare
   dazubekommen, **ohne bestehende gespeicherte Sets zu entwerten** — Nutzer
   haben dort bereits Signaturen-Sets liegen. Altbestand ohne Fundort-Feld muss
   weiterhin ladbar sein.

5. **Anheften je Fundort über ein Pin-Symbol in der Zeile** — dieselbe Bedienung
   wie bei den Erz-Kacheln (gefüllte Fläche `--accent-2`, dunkles Symbol).
   ⚠ Die Zeile ist heute `.wb__row2` und wird auch anderswo verwendet
   (Steine-Liste, Stationen) — das Symbol darf dort nicht mitwandern.

6. **Merkliste ist erz-übergreifend.** Einträge lauten „Erz — Fundort"
   (z. B. „Quantainium — Aaron Halo"); angeheftet wird beim jeweils gewählten
   Erz, die Liste sammelt über alle Erze hinweg.

7. **Ein Preset hält die Auswahl fest, solange es gewählt ist** — Wechsel des
   Presets tauscht die Merkliste aus.

## Offen, in der Planung zu entscheiden

- **Preset-Format:** ein Preset = Signaturen **und** Fundorte gemeinsam, oder je
  Reiter getrennte Preset-Listen im selben Speicher? Der Betreiber sagte
  „gemeinsames Preset-System"; die verlustfreie Migration des Altbestands ist
  die härtere Anforderung und entscheidet mit.
- Verhalten bei Erzen ohne Fundorte (Carinite, Jaclium, Sadaryx, Saldynium
  zeigen „Keine Fundorte bekannt.") — Anheften dort gar nicht anbieten.
- Ob die Merkliste zusätzlich die Werte je Paar zeigt (Chance, Anteil) oder nur
  den Namen.

## Nicht verhandelbar

- DE und EN gleichzeitig — „fertig" gilt erst für beide.
- `npm run build && npm run gate` grün vor jedem Push; bei Layout-Änderungen
  zusätzlich mit `$env:STAGING='1'`.
- Kontogebundene Speicherung analog zu `favorites` (RLS), nicht im
  localStorage — dort liegt nur die unbenannte Arbeitsliste.
