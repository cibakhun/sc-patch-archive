# Phase 10 — Kontext: Mining-Presets bedienbar machen

Erhoben am 15.08.2026, unmittelbar nachdem Phase 9 auf staging ausgeliefert war.
Alle fünf Befunde stammen vom Betreiber aus der Benutzung, nicht aus einer Prüfung.

## Der teuerste Befund zuerst

`src/components/MiningWorkbench.astro` trägt **zwei Knöpfe mit dem Zeichen `×`**:

| Zeile | id | Wirkung |
|---|---|---|
| 329 | `wb-pre-del` | **Löscht das Preset** |
| 337 | `wb-pre-cancel` | Bricht das Umbenennen ab |

Sie sitzen an derselben Stelle der Preset-Leiste, nur in verschiedenen Zuständen
(`wb-pre-pick` / `wb-pre-edit`). Und in `assets/mining-workbench.js` steht:

```js
preDel.addEventListener('click', function () {
  if (preSel.value) preDrop(preSel.value);   // keine Rückfrage
```

Der Betreiber hat auf „Abbrechen" gezielt und ein Preset verloren. Das ist kein
Bedienfehler, sondern ein Konstruktionsfehler — gleiches Zeichen, gleiche Stelle,
gegensätzliche Wirkung, und die zerstörerische Variante fragt nicht nach.

## Entschieden

1. **Löschen muss rückfragen** — und darf nicht mehr wie „Abbrechen" aussehen.
   Zeichen, Farbe und Ort der beiden Aktionen müssen unterscheidbar sein.
2. **Presets werden bearbeitbar.** Alle drei Formen sind gewünscht:
   - umbenennen (ohne neu anlegen + altes löschen)
   - Inhalt überschreiben („aktualisieren" mit der aktuellen Auswahl)
   - einzelne Einträge entfernen (ein Erz oder ein Fundort-Paar aus der
     gespeicherten Liste, ohne das Preset neu zu bauen)
3. **Die Reiter entfallen.** Signaturenliste und Fundort-Merkliste stehen
   **untereinander in der rechten Spalte, beide gleichzeitig sichtbar**, jede mit
   eigener Überschrift und eigenem Bildlauf. Grund: Reiter zeigen zwangsläufig
   immer nur eine der beiden Listen — das war beim Zuschnitt von Phase 9 nicht
   deutlich gemacht worden und ist der eigentliche Grund für Befund (4).
4. **Die Mittelspalte schrumpft**, die rechte wächst entsprechend. Heute
   `470px 456px 262px`; die Mitte trägt nur noch eine Liste und ist dafür zu breit.
5. **Das `<select>` für Presets wird ersetzt.** Bei wenigen Einträgen ist ein
   Auswahlfeld die falsche Form; die gespeicherten Presets sollen sichtbar sein,
   nicht aufgeklappt werden müssen.
6. **Die Signaturenliste bleibt erhalten** — die angehefteten Erze mit ihren
   Signaturwerten und Vielfachen sind weiterhin ein Nachschlagewerk.
7. **Das Eingabefeld „Scanwert" entfällt ersatzlos** (`#wb-scan`, Zeile 347).
   Begründung des Betreibers auf Nachfrage: Der Bedienweg ist im Spielfluss
   unrealistisch — vorher die richtigen Erze anheften, im Spiel scannen, zum
   zweiten Monitor wechseln, einen fünfstelligen Wert abtippen, während man im
   Belt steht. Der übliche Weg ist näher ranfliegen; dann nennt der Scanner das
   Erz selbst. Mit dem Feld entfällt die davon abhängige Treffermarkierung
   (`is-hit`, `assets/mining-workbench.js` Zeile 299 + 307–309) sowie
   `scanPlaceholder` in `S_DE`/`S_EN` und der Hilfetext `mining.ctl.scan` in
   `src/i18n/help.ts`.
   ⚠ Die **Vielfachen-Anzeige selbst bleibt** (Signatur × 1…max je Seltenheit).
   Sie war nicht Gegenstand der Anweisung; ohne Suchfeld ist sie eine Tabelle
   zum Nachschlagen statt eine Trefferanzeige.
   ⚠ `verify-help.mjs` zählt erklärte Bedienelemente je Werkzeug — ein
   entfernter `data-help`-Anker muss dort mitgezogen werden, sonst reißt das Tor
   (oder, schlimmer, es zählt still weiter mit).

## Ausgangslage (Stand nach Phase 9, Commit 39f35d4)

- Tabelle `mining_sig_presets`: `user_id`, `name`, `minerals text[]`,
  `locations text[]` (seit 15.08.), `updated_at`. Primärschlüssel
  `(user_id, name)`, 4 RLS-Politiken, Prüfklausel ≤ 128 Fundort-Paare.
- ⚠ Der Primärschlüssel enthält den **Namen**. Umbenennen ist deshalb kein
  simples `update name` — es verschiebt den Schlüssel. Der Weg ist zu prüfen
  (update auf PK ist erlaubt, aber die Politiken und der Upsert-Pfad
  `on_conflict=user_id,name` in `preSave()` müssen mitgedacht werden).
- Angeheftete Listen liegen im `localStorage` (Arbeitsstand, gastfähig); ans
  Konto geht nur, was benannt gespeichert wird. Diese Trennung bleibt.
- `.wb__row2` rendert Fundorte UND Stationen — der Nadelknopf darf weiterhin nur
  in Fundort-Zeilen erscheinen.

## Nicht verhandelbar

- DE und EN gleichzeitig; die Build-Zeit-Paritätsprüfung aus Phase 9
  (`S_DE`/`S_EN`) fängt einseitige Schlüssel bereits ab.
- `npm run build && npm run gate` grün vor jedem Push, bei Layout zusätzlich mit
  `$env:STAGING='1'`.
- Jede neue Zusicherung wird einmal vorgeführt rot.
- Keine Datenherkunft im sichtbaren Text.

## Folgephase

Phase 11 (Geteilte Routen mit Spielerbewertung) setzt hierauf auf und wird erst
geplant, wenn diese Phase steht. Begründung: Wer sein eigenes Preset nicht
bearbeiten kann, veröffentlicht es erst recht nicht.
