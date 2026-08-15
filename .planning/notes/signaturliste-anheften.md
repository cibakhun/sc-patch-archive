# Anheften: Symbol, Kachelgröße, Presets (12.08.2026)

Rückmeldung des Nutzers: „das hinzufügen zur signaturen liste von materialien
ist schwer, und undurchdacht. sowohl aus design gründen als auch aus dem prozess
des hinzufügens." Auf Nachfrage konkretisiert: ein Anheft-Icon, das zum Stil
passt; die Elemente der Materialliste links größer, damit das Icon zugänglicher
wird; und **Presets** für angemeldete Nutzer, kontogebunden gespeichert.
Umfang auf Ansage: **„erstmal nur signaturen liste"** — die Fundorte bleiben
unberührt.

Das ist die **dritte** Runde an diesem Knopf. Die beiden vorigen stehen in
`.planning/notes/mining-werkbank-defekte.md`: erst war er unsichtbar
(`opacity:0` + `:hover` — auf Touch existiert er dann gar nicht), dann mit
28 px Tippziel „zu schwer". Beide Male wurde am Knopf geschraubt, nicht an der
Kachel. Diesmal an der Kachel.

## 1. Symbol statt Schriftzeichen

`☆` / `★` waren Textzeichen: sie sehen in jeder Schrift anders aus, passen nicht
zur Strichstärke der übrigen Symbole der Seite und ließen sich nicht wie ein
Icon färben. Ersetzt durch **eine Reißbrettnadel** als `<symbol>` im Stil der
Seite (24er Raster, Strichstärke 2, runde Enden) — Nadel statt Stern, weil die
Handlung „Anheften" heißt.

EIN `<symbol>` für 38 Knöpfe, eingebunden per `<use>`; das Pfad-`d` steht
einmal im HTML statt 38-mal. Der Zustand kommt **nicht** aus einem zweiten
Symbol, sondern aus `.is-on` am Knopf — das Skript tauscht damit kein Markup
mehr aus, und „angeheftet" spricht dieselbe Sprache wie `.wb__chip.is-on`:
gefüllte Fläche in `--accent-2`. Für Screenreader trägt der Knopf jetzt
`aria-pressed`, also ein Umschalter statt eines Links.

## 2. Kachel statt Aufkleber

| | vorher | jetzt |
|---|---|---|
| Kachel | 79 × 41 px | **110 × 57 px** |
| Spalten in der Säule | 5 (bei 420 px) | 4 (bei 470 px) |
| Platz für den Namen | ~54 px | **volle Kachelbreite** |
| Namen mit „…" abgeschnitten | mehrere | **0 von 37** |
| Anheft-Knopf sichtbar | 22 px in der Ecke | **28 px, eigenes Feld** |
| Tippziel | 28 × 28 px | **38 × 37 px** |

Der Knopf lag als Aufkleber über der Signaturzeile und drückte den Namen auf
rund 54 px. Jetzt hat die Kachel zwei Zeilen: oben der Name über die **ganze**
Breite, unten Signatur und Knopf nebeneinander, jeder in seiner Rasterspalte.
Dass danach **kein einziger** der 37 Namen mehr abschneidet, ist der eigentliche
Gewinn — vorher las man „Hephaes…", „Quantai…", „Saldyniu…".

Die 50 px Breite kommen aus der Mittelspalte (Raster 470/1fr/262 statt
420/1fr/232); die hat seit dem Auszug des Fracturing-Rechners Luft. Die
Signaturenspalte hat 30 px bekommen, weil dort die Preset-Zeile dazukam.

### ⚠ Was das kostet

Die Zusage „alle 37 ohne Scrollen" hält **nicht mehr auf jedem Fenster**:

| Fenster | Überlauf der Erzliste |
|---|---|
| 1920×1080 | **0 px** — alle 37 im Bild |
| 1600×900 | 96 px (rund 1,5 Reihen) |
| 1280×720 | 276 px (rund 4,5 Reihen) |

Rechnerisch nicht zu umgehen: bei 1280×720 stehen der Liste 374 px zur
Verfügung; 37 Kacheln zu 57 px in vier Spalten brauchen 620. Für alle 37 wären
Reihen unter 34 px nötig — kleiner als die alten 41 und damit kleiner als das,
was hier beauftragt war. Eine Verkleinerung per `@media(max-height:…)` wäre
möglich gewesen, hätte aber genau dort zurückgedreht, wo es niemand sieht.
Der Nutzer hat die Größe ausdrücklich verlangt („wir haben da genug platz"); der
Überlauf ist die bezahlte Gegenleistung, mit sichtbarer Bildlaufleiste
(`.wb__scroll` steht in `assets/mobile-ux.css`).

## 3. Presets — kontogebunden

Neue Tabelle `public.mining_sig_presets` (Migration
`20260812040000_mining_sig_presets.sql`, angewandt): `(user_id, name)` als
Schlüssel, `minerals text[]`, RLS nach dem Muster von `crafting_entries`.

**Schlüssel ist der Mineralname**, nicht der Index in `mining-db.json` und nicht
der DataCore-GUID — beide verschieben sich mit dem Patch bzw. mit jedem
Datamine-Lauf. Genau dieser Fehler ist bei Crafting einmal bezahlt worden. Beim
Laden wird gegen den Katalog gefiltert: ein Erz, das ein Patch entfernt, fällt
still raus, statt die Liste zu vergiften.

**Die angeheftete Liste selbst bleibt im `localStorage`.** Sie ist der
Arbeitsstand und muss ohne Konto funktionieren; ans Konto geht nur, was man
benennt und wieder aufruft. Zwei getrennte Dinge — sie zusammenzulegen hieße,
Gästen das Anheften wegzunehmen. (Der offene Zettel
`.planning/todos/pending/signatur-liste-kontogebunden.md` wollte die Liste
selbst binden; das ist damit **nicht** erledigt und bleibt offen.)

Kein `supabase-js` auf der Themenseite: Session und PostgREST-Aufruf kommen aus
`window.VBAccount` (account-lite.js), wie bei der Crafting-DB.

Bedienung: Auswahlfeld mit den gespeicherten Presets, „+" für einen Namen, „×"
zum Löschen. Die Namenseingabe ist eine **eigene Zeile**, kein
`window.prompt()` — der Dialog ist in vielen Browsern unterdrückt, sieht überall
anders aus und lässt sich nicht beschriften. Beide Zustände sind eine Zeile
hoch, damit die Spalte beim Umschalten nicht springt. Gäste sehen statt der
Zeile „Zusammenstellungen speichern: anmelden" mit Rücksprung auf die Seite.

## Gegenproben

**Oberfläche** (Chrome, gerenderte Pixel):

| Prüfung | Ergebnis |
|---|---|
| Symbol wird als `<use>` gezogen | ja, in allen 37 Kacheln |
| Tippziel | 38 × 37 px gemessen (an vier Punkten abgetastet) |
| Namen abgeschnitten | 0 von 37 |
| Klick auf den Knopf | `is-on`, `aria-pressed=true`, Fläche `rgb(224,165,38)`, Erz erscheint rechts |
| Scanwert 7140 bei angeheftetem Borase | Vielfaches ×2 (7.140) hervorgehoben |
| Gast | Preset-Zeile verborgen, Anmelde-Hinweis mit `?next=` sichtbar |

**Preset-Strecke** (Sitzung im Speicher vorgetäuscht, PostgREST abgefangen —
geprüft wird die Verdrahtung und die Form der Anfragen):

| Schritt | Ergebnis |
|---|---|
| angemeldet | Preset-Zeile sichtbar, Gast-Hinweis weg |
| leeres Preset speichern | abgelehnt: „Erst Erze anheften, dann speichern." |
| zwei Erze anheften, speichern | `POST ?on_conflict=user_id,name`, `Prefer: resolution=merge-duplicates`, Rumpf `[{name, minerals:["Borase","Gold"]}]` |
| Auswahl ändern, Preset erneut wählen | genau die gespeicherten zwei sind wieder da |
| gleicher Name ein zweites Mal | ein Eintrag, kein Duplikat |
| löschen | `DELETE ?name=eq.…`, Auswahl leer, Knopf gesperrt |

**RLS** (an der echten Datenbank, mit Gegenprobe):

| Prüfung | Ergebnis |
|---|---|
| RLS an, Politiken | aktiviert, 4 (SELECT/INSERT/UPDATE/DELETE, je „own") |
| `anon` liest | 0 Zeilen |
| `anon` schreibt | abgewiesen — „new row violates row-level security policy" |
| `authenticated` schreibt fremde `user_id` | abgewiesen — dieselbe Meldung |

## Offen

- Die angeheftete Liste selbst ist weiterhin gerätegebunden (siehe oben).
- Bei 1280×720 scrollt die Erzliste; wenn das stört, ist die Stellschraube die
  Kachelhöhe in `.wb__tile` bzw. `minmax()` in `.wb__tiles`.
