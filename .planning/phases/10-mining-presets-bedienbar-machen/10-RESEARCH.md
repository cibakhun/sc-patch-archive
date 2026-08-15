# Phase 10: Mining-Presets bedienbar machen - Research

**Researched:** 2026-08-15
**Domain:** Client-seitige CRUD-Bedienung eines PostgREST-gebundenen Presets (Supabase/PostgreSQL), Astro-Komponenten-Umbau, reines Vanilla-JS ohne Framework
**Confidence:** HIGH — der gesamte Untersuchungsgegenstand ist eigener, gelesener Code in diesem Repository; keine externe Bibliothek, kein Fremdsystem.

## Summary

Phase 10 baut kein neues System — sie repariert die Bedienung eines bestehenden,
in Phase 9 gebauten Preset-Systems auf `mining_sig_presets`. Alle sieben
Kernfragen des Auftrags ließen sich direkt am Code beantworten (kein
`[ASSUMED]`-Befund in dieser Recherche): Löschen ohne Rückfrage ist real und
liegt an zwei `×`-Knöpfen mit identischem Zeichen an derselben Stelle
(`wb-pre-del` Zeile 329, `wb-pre-cancel` Zeile 337 in
`src/components/MiningWorkbench.astro`); Umbenennen ist heute technisch NICHT
implementiert, aber die Datenbank erlaubt es sauber über ein einfaches
`PATCH` auf den Primärschlüssel, weil die UPDATE-Politik nur `user_id`
prüft, nicht `name`; das Entfernen von `#wb-scan` betrifft vier Stellen
(Markup, Klick-Handler, zwei Sprachschlüssel je Sprache) und **nicht**
`scripts/verify-help.mjs` selbst — das Tor zählt generisch mindestens einen
Anker je Werkzeug, keine feste Anzahl; die Reiterleiste kann ersatzlos durch
zwei gestapelte, bereits vorhandene `.wb__scroll`-Kästen ersetzt werden, ohne
neue Einträge in `assets/mobile-ux.css`, weil die dortige Registrierung
bereits klassenbasiert (`.wb__scroll`) und nicht instanzbasiert ist; und für
das zu ersetzende `<select>` liegt im selben Bauteil bereits ein passendes,
mehrfach bewährtes Formmuster vor (`.wb__tile` für Auswahl-mit-Zustand,
`.wb__pin-item`/`.wb__pin-top` für Name-plus-Löschknopf-Zeilen).

**Primäre Empfehlung:** Keine neue Bibliothek, kein neues Backend-Konstrukt.
Alle sechs Befunde lassen sich mit den bereits im Bestand etablierten
Mustern lösen — direkte PostgREST-Aufrufe über `window.VBAccount.rest()`
(inkl. `PATCH` für das Umbenennen, bereits an anderer Stelle im Bestand
verwendet), die bestehende `.wb__pin-item`-Zeilenform für die Preset-Liste,
und ein eigenes, nicht-natives Bestätigungsmuster für das Löschen (kein
`window.confirm()` — dieselbe Begründung, mit der der Bestand bereits gegen
`window.prompt()` entschieden hat, plus ein vorhandenes Mülleimer-Symbol
(`#ic-trash` in `AccountDashboard.astro`) als visuell unterscheidbares
Symbol gegenüber der Nadel/dem `×`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (nummeriert als D-01..D-07, Praezedenz aus Phase 9)

1. **D-01 — Löschen muss rückfragen.** Zeichen, Farbe und Ort der beiden
   Aktionen (Löschen/Abbrechen) müssen unterscheidbar sein.
2. **D-02 — Presets werden bearbeitbar.** Alle drei Formen: umbenennen (ohne
   neu anlegen + löschen), Inhalt überschreiben (aktualisieren mit aktueller
   Auswahl), einzelne Einträge entfernen (ein Erz oder ein Fundort-Paar aus
   der gespeicherten Liste, ohne das Preset neu zu bauen).
3. **D-03 — Reiter entfallen.** Signaturenliste und Fundort-Merkliste stehen
   untereinander in der rechten Spalte, beide gleichzeitig sichtbar, jede mit
   eigener Überschrift und eigenem Bildlauf.
4. **D-04 — Mittelspalte schrumpft**, rechte wächst entsprechend. Heute
   `470px 1fr(456px) 262px`.
5. **D-05 — Das `<select>` für Presets wird ersetzt.** Presets sollen
   sichtbar sein, nicht aufgeklappt werden müssen.
6. **D-06 — Die Signaturenliste bleibt erhalten** — angeheftete Erze mit
   Signaturwert und Vielfachen bleiben Nachschlagewerk.
7. **D-07 — Das Eingabefeld „Scanwert" (`#wb-scan`) entfällt ersatzlos.**
   Mit ihm entfällt die Treffermarkierung (`is-hit`), `scanPlaceholder` in
   `S_DE`/`S_EN` und der Hilfetext `mining.ctl.scan`. Die
   Vielfachen-Anzeige selbst (Signatur × 1…max) bleibt (D-06).

### Claude's Discretion

- Exakte Bedienform des Preset-„<select>"-Ersatzes (D-05) — CONTEXT.md gibt
  nur die Anforderung „sichtbar statt aufgeklappt" vor, keine konkrete
  Komponente.
- Exakte Bestätigungsmechanik für das Löschen (D-01) — CONTEXT.md verlangt
  nur „muss rückfragen" und „unterscheidbar", nicht WIE.
- Exakte Pixelaufteilung der Spaltenbreiten (D-04).
- Technischer Weg für „einzelne Einträge entfernen, ohne das Preset neu zu
  bauen" (D-02, dritte Form) — offen, ob dies automatisches Nachspeichern
  bei aktivem Preset bedeutet oder eine eigene Löschaktion direkt an der
  gespeicherten Zeile. Siehe Offene Frage unten.

### Deferred Ideas (OUT OF SCOPE)

- Phase 11 (Geteilte Routen mit Spielerbewertung) — wird erst geplant, wenn
  Phase 10 steht.
</user_constraints>

<phase_requirements>
## Phase Requirements

Kein förmliches `REQUIREMENTS.md`-Mapping (ROADMAP führt „Requirements: TBD").
Bindend sind wie in Phase 7 und Phase 9 die nummerierten Entscheidungen aus
`CONTEXT.md`, hier als D-01..D-07 durchnummeriert (siehe `user_constraints`
oben — dieselbe Nummerierungskonvention wie Phase 9).

| ID | Beschreibung | Research-Unterstützung |
|----|-------------|------------------------|
| D-01 | Löschen fragt zurück, unterscheidbar von Abbrechen | Vertiefung 2 unten: exakte DOM-Fundstellen, Trash-Icon-Präzedenz (`#ic-trash`), kein `window.confirm()` |
| D-02 | Presets bearbeitbar: umbenennen / überschreiben / Einzeleintrag entfernen | Vertiefung 1 unten: RLS-Analyse für PATCH-Umbenennung, bestehender Upsert-Pfad für Überschreiben, offene Frage für Einzeleintrag |
| D-03 | Reiter entfallen, beide Listen gestapelt sichtbar | Vertiefung 4 unten: `.wb__scroll`-Registrierung ist bereits klassenbasiert, kein neuer Eintrag nötig |
| D-04 | Mittelspalte schrumpft, rechte wächst | Architektur-Abschnitt: aktuelle Rasterwerte, CSS-Stellen |
| D-05 | `<select>` ersetzen durch sichtbare Liste | Vertiefung 5 unten: `.wb__tile` + `.wb__pin-item` als Formvorbilder |
| D-06 | Signaturenliste bleibt | Keine Änderung nötig — nur Layout-Kontext |
| D-07 | `#wb-scan` entfällt ersatzlos | Vertiefung 3 unten: Blast-Radius-Liste, verify-help.mjs-Verhalten geklärt |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Vor jedem Push:** `npm run build && npm run gate` grün, ohne Ausnahme.
- **Bei Layout-Änderungen zusätzlich:** `$env:STAGING='1'; npm run build; npm run gate` — CI baut immer so; der Unterschied hat bereits lokal grüne Builds gerissen.
- **Nach Datenläufen:** zusätzlich `npm run gate:data` (hier nicht einschlägig — kein Datenlauf in dieser Phase).
- **Fertig-Meldung erst**, wenn `npm run check:staging` den neuen Stand auf der ausgelieferten Seite zeigt.
- **Neues Prüfskript → Eintrag in `scripts/lib/gate-registry.mjs`** (hier voraussichtlich nicht nötig, siehe unten — keine neue Prüfstrecke absehbar, nur ggf. neue Zusicherungen in bestehenden Skripten).
- **Sieben Grundsätze für Prüfungen** (§ Prüfungen bauen), insbesondere: „Vorgeführt rot" — jedes neue Tor/jede neue Zusicherung wird einmal absichtlich gebrochen und protokolliert.
- **Windows-Umgebung:** `npm.cmd` statt `npm` in PowerShell; Git-Bash-Forks kaputt → PowerShell + `git -C`.
- **Keine Datenherkunft im sichtbaren Text** (Data.p4k/DataCore/scmdb/„datamined") — `audit:site` erzwingt das als FEHLER. Neue Hilfetexte/Meldungen (Rename-Fehler, Löschbestätigung) dürfen diese Regel nicht verletzen.
- Sichturteile gehen als benannter Punkt nach `.planning/WINDOWS.md`, kein Skript entscheidet über Optik.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Preset umbenennen (PK verschieben) | Browser/Client (`assets/mining-workbench.js`, PostgREST `PATCH`) | Database/Storage (RLS UPDATE-Politik, PK-Eindeutigkeit) | Kein eigenes Backend nötig — direkter PostgREST-Aufruf wie beim Bestand (`preSave`/`preDrop`); die Datenbank erzwingt Eindeutigkeit und Eigentümerschaft |
| Preset-Inhalt überschreiben | Browser/Client | Database/Storage | Bereits vorhandener Upsert-Pfad (`POST ?on_conflict=user_id,name`), nur die Bedienführung ändert sich |
| Einzelnen Eintrag aus gespeichertem Preset entfernen | Browser/Client | Database/Storage | Client berechnet das neue Array und schreibt die Zeile zurück (PATCH oder Upsert) |
| Löschen-Bestätigung (D-01) | Browser/Client | — | Reine UI-Zustandsmaschine, kein Netzwerkaufruf vor Bestätigung |
| Gestapelte Zweitlisten statt Reiter (D-03) | Browser/Client | — | Astro-Markup + CSS + bestehende `renderPins()`/`renderLocPins()`-Funktionen, keine Datenschicht betroffen |
| Preset-Liste statt `<select>` (D-05) | Browser/Client | — | Neue Render-Funktion nach Vorbild `renderList()`/`renderPins()`, kein Datenpfad geändert |
| Scanwert entfernen (D-07) | Browser/Client | — | Entfernt DOM/JS/i18n; berührt keine Datenschicht |

**Kein Server-, SSR- oder API-Tier betroffen:** Die gesamte Mining-Werkbank
ist eine statisch gebaute Astro-Seite mit Vanilla-JS, die PostgREST direkt
über `window.VBAccount.rest()` (`assets/account-lite.js`) anspricht. Es gibt
keine Edge Function für diese Tabelle und keine wird gebraucht — dieselbe
Feststellung wie in Phase 9.

## Standard Stack

### Core

Keine neuen Abhängigkeiten. Diese Phase ist eine reine Bedien- und
Bedienoberflächen-Korrektur am bestehenden Vanilla-JS/Astro-Bestand.

| Werkzeug | Version | Zweck | Warum kein Wechsel |
|---------|---------|-------|--------------------|
| Astro | (Projektstand, unverändert) | Statischer Seitenbau | Bestand, keine neue Funktion nötig |
| Vanilla JS (`assets/mining-workbench.js`) | — | Client-Logik | Der gesamte Bestand ist bewusst frameworkfrei (`assets/`-Ordner ist eine dokumentierte Entscheidung, kein Altlast — `.planning/config.json`/Projekt-Historie) |
| PostgREST über `window.VBAccount.rest()` | — | Datenzugriff auf `mining_sig_presets` | Bereits etabliert seit Phase 9; `rest()` akzeptiert bereits beliebige HTTP-Methoden inkl. `PATCH` (siehe `assets/account-lite.js` Zeile 284, `hbWrite()`) |

### Supporting

Keine.

### Alternatives Considered

| Statt | Könnte man | Abwägung |
|-------|-----------|----------|
| Direktes `PATCH` fürs Umbenennen | Eine Postgres-Funktion (RPC) `rename_mining_sig_preset(old, new)` | Mehr Code (neue Migration, neue Funktion, neuer RLS-Gedanke) für denselben Effekt; das direkte `PATCH` nutzt die VORHANDENEN vier RLS-Politiken unverändert. Nur sinnvoll, falls die Kollisionsbehandlung serverseitig atomar mit einer Zusatzaktion verknüpft werden müsste — hier nicht der Fall. |
| Umbenennen via `PATCH` | Neue Zeile per `POST` anlegen + alte per `DELETE` löschen (zwei Aufrufe) | **Explizit abgelehnt.** Nicht atomar: schlägt der zweite Aufruf fehl, bleiben zwei Zeilen (Datenverlust-Risiko in die andere Richtung) oder eine verwaiste alte Zeile. Das `PATCH` ist EIN Aufruf, EIN Fehlerfall. |
| Eigene Preset-Listen-Komponente (`.wb__pin-item`-Vorbild) | `<select>` durch eine native `<datalist>` oder ein `<details>`-Akkordeon ersetzen | `<datalist>` löst D-05 nicht (immer noch ein Eingabefeld mit Vorschlägen, keine sichtbare Liste); `<details>` bräuchte eigenes Klappverhalten, das es im Bestand für „wenige, permanent sichtbare Einträge" nirgends gibt — `.wb__pin-item` ist die etablierte Form genau für diesen Fall (Name + Aktion, ohne Klappen). |

**Installation:** Keine — keine neuen Pakete.

**Version verification:** entfällt (keine neuen Fremdpakete). Wo Skripte
geändert werden (`assets/mining-workbench.js`, `scripts/verify-help.mjs`
sofern nötig), bleibt die vorhandene Node-/Astro-Toolchain unverändert
(`node --version` → v22.18.0, `npm --version` → 10.9.3, lokal geprüft).

## Package Legitimacy Audit

**Nicht erforderlich.** Diese Phase installiert kein einziges Paket — reine
Änderung an bestehendem Astro-Markup, Vanilla-JS und einer SQL-Migration
nach demselben Muster wie die Vorgänger-Migration. `npm view`/`pip
index`/`cargo search` entfällt, weil kein `package.json`-Eintrag hinzukommt.

## Architecture Patterns

### System Architecture Diagram

```
Browser (mining.astro / de/mining.astro, gebaut aus MiningWorkbench.astro)
  │
  ├─ Spalte 1: Erzliste (.wb__tile, unveraendert)
  │
  ├─ Spalte 2 "Mitte" (D-04: schmaler): Erz-Kopf + Fundorte + Beste Stationen
  │     Klick auf Nadel (.wb__lpin) ──────────────┐
  │                                                │
  └─ Spalte 3 "rechts" (D-04: breiter):            │
        ┌─ Preset-Leiste (immer sichtbar, ausserhalb    │
        │  beider Listen) ── NEU: Liste statt <select>  │
        │      · Zeile anklicken = auswaehlen (preApply) │
        │      · Umbenennen-Aktion = PATCH auf PK        │
        │      · Loeschen-Aktion = Bestaetigung -> DELETE │
        ├─ Signaturenliste (D-03: dauerhaft sichtbar,     │
        │  eigener .wb__scroll, KEIN #wb-scan mehr)       │
        └─ Fundort-Merkliste (D-03: dauerhaft sichtbar,  ◄┘
           eigener .wb__scroll)
                  │
                  ▼
        window.VBAccount.rest(session, METHODE, "mining_sig_presets?...", body)
                  │  (assets/account-lite.js: fetch() gegen PostgREST)
                  ▼
        Supabase PostgREST  ──RLS (4 Politiken, "own")──►  public.mining_sig_presets
                                                             PK (user_id, name)
                                                             locations text[] (Migration 15.08., NICHT angewandt)
```

Kein Backend-Code entsteht. Jede Aktion (Auswählen, Umbenennen, Überschreiben,
Löschen, Einzeleintrag entfernen) ist ein Klick im Browser, der entweder nur
`S.pins`/`S.locPins` lokal ändert (kostenlos) oder EINEN PostgREST-Aufruf
auslöst.

### Recommended Project Structure

Keine neuen Dateien. Geänderte Dateien (aus dem Bestand, siehe Vertiefungen
unten):
```
src/components/MiningWorkbench.astro   # Markup: Preset-Leiste, Spalte 3, Grid-Breiten
assets/mining-workbench.js             # Render-/Klicklogik: Presets, Reiter weg, Scan weg
src/i18n/help.ts                       # mining.ctl.scan entfernt, evtl. Hilfetexte fuer neue Preset-Bedienung
supabase/migrations/                   # ggf. NEUE Migration, falls ein RPC noetig wird (siehe Vertiefung 1 -- nicht empfohlen)
scripts/verify-mining.mjs              # unveraendert -- kein Bezug zu Presets
```

### Vertiefung 1 — Umbenennen vs. Primärschlüssel (Kernfrage 1)

**Befund, mit Belegstellen:**

- PK: `primary key (user_id, name)` — `supabase/migrations/20260812040000_mining_sig_presets.sql` Zeile 25.
- UPDATE-Politik: `for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)` — dieselbe Datei, Zeilen 41-44. **Sie prüft ausschließlich `user_id`, nicht `name`.** Ein `UPDATE ... SET name = 'neu' WHERE user_id = ... AND name = 'alt'` besteht sowohl `USING` (alte Zeile gehört dem Nutzer) als auch `WITH CHECK` (neue Zeile gehört weiterhin demselben Nutzer) — die Politik ist gegenüber einer PK-Verschiebung völlig blind, weil sie nie den Namen anfasst.
- Postgres selbst erlaubt das Ändern einer Primärschlüsselspalte per UPDATE; es ist keine Sonderoperation. Der einzige Fehlerfall ist eine **Eindeutigkeitsverletzung** (23505 `unique_violation`), wenn der Zielname beim selben Nutzer schon existiert. PostgREST übersetzt diesen Postgres-Fehler in **HTTP 409 Conflict**.
- Bestehender Upsert-Pfad `preSave()` (`assets/mining-workbench.js` Zeilen 419-437) nutzt `POST ... ?on_conflict=user_id,name` mit `Prefer: resolution=merge-duplicates` — das ist ein **INSERT ... ON CONFLICT DO UPDATE**, kein `UPDATE`. Er berührt den PK NIE (der Name im Body IST der Konfliktschlüssel). Für ein Umbenennen ist dieser Pfad ungeeignet: ein `POST` mit neuem Namen legt eine ZUSÄTZLICHE Zeile an, löscht die alte nicht.

**Empfohlener Weg:** Ein einzelner `PATCH`-Aufruf über den bestehenden
`window.VBAccount.rest()`-Mechanismus:

```js
// analog zu hbWrite() in assets/account-lite.js Zeile 284 (PATCH bereits im Bestand verwendet)
window.VBAccount.rest(preSess, 'PATCH',
  TBL + '?name=eq.' + encodeURIComponent(oldName), { name: newName })
  .then(function (r) {
    if (r.status === 409) { preSay(T.presetNameTaken, 4000); return; }
    if (!r.ok) { preSay(T.presetFail, 4000); return; }
    preSay(T.presetSaved);
    return preLoad().then(function () { preFill(newName); });
  });
```

- `rest()` (`assets/account-lite.js` Zeilen 59-70) baut Method, Body und
  Standard-`Prefer`-Kopfzeile bereits generisch; für `PATCH` ist der
  Default-`Prefer` `'count=none'` (kein `POST`), was hier korrekt ist —
  kein Rumpf im Antwortpfad nötig, nur der Status.
- PostgREST übersetzt `?name=eq.<alt>` in `WHERE name = '<alt>'`; die
  `user_id`-Einschränkung übernimmt automatisch die RLS-Politik (die
  Session-Rolle sieht durch RLS ohnehin nur eigene Zeilen).
- `trg_touch_mining_sig_preset` (Migration 20260812040000, Zeilen 53-67)
  feuert auch bei `UPDATE`, setzt `updated_at` korrekt mit.

**Kollisionsfall (Zielname existiert bereits):** HTTP 409. Muss im Client
abgefangen und mit einer NEUEN, eigenen Meldung beantwortet werden (nicht
der generische `presetFail`-Text) — z. B. `presetNameTaken`: „Dieser Name
ist schon vergeben." / „That name is already taken." Neuer DE/EN-Schlüssel
im Sprachobjekt (`S_DE`/`S_EN` in `MiningWorkbench.astro`), Parität über
`assertMiningLangParity()` bereits erzwungen.

**Verworfene Alternativen:**

1. **Zwei Aufrufe (POST neue Zeile + DELETE alte Zeile).** Abgelehnt: nicht
   atomar. Ein Netzwerkfehler zwischen beiden Aufrufen hinterlässt entweder
   eine Dublette oder — schlimmer im Sinne von D-01/D-02 — eine gelöschte
   alte Zeile ohne neue (Datenverlust). Ein einzelnes `PATCH` hat genau EINEN
   Fehlerfall.
2. **Eigene Postgres-Funktion (RPC) für den Rename.** Abgelehnt für diese
   Phase: mehr Angriffsfläche (neue Migration, neue `SECURITY DEFINER`- oder
   `SECURITY INVOKER`-Entscheidung, neuer Testpfad), ohne dass sie einen
   Vorteil gegenüber dem direkten `PATCH` böte — die bestehenden RLS-Politiken
   reichen bereits aus. Nur relevant, falls Rename UND eine serverseitige
   Zusatzaktion atomar zusammenfallen müssten (hier: nein).
3. **`on_conflict`-Upsert mit dem NEUEN Namen und `id`-Spalte als stabilem
   Schlüssel.** Abgelehnt: Die Tabelle hat gar keine `id`-Spalte — der PK
   IST `(user_id, name)` (Migration Zeile 25). Eine Umstellung auf eine
   surrogate `id`-Spalte wäre ein Schema-Umbau an einer Tabelle mit echten
   Nutzerdaten, den CONTEXT.md nirgends verlangt und der über den
   Phasenauftrag hinausginge.

**D-02, zweite Form (Inhalt überschreiben):** Bereits funktional vorhanden
über den bestehenden `preSave()`-Upsert-Pfad (unverändertem Namen). Die
heutige Bedienung dafür ist nur verwirrend verdrahtet: Der „+"-Knopf
(`wb-pre-new`) trägt bereits `title={S.presetSave}` = „Speichern" (nicht
„Neu"!) und `preMode(true)` befüllt das Namensfeld mit dem AKTUELL
gewählten Preset-Namen (`preName.value = preSel.value || ''` — Zeile 460).
Klickt der Nutzer direkt auf ✓, ohne den Namen zu ändern, überschreibt er
bereits heute technisch korrekt. Für Phase 10 heißt das: „Überschreiben"
braucht wahrscheinlich KEINE neue Serverlogik, nur eine klarere, eigene
Bedienhandlung (getrennt von „Neu" UND von „Umbenennen") in der neuen
Listenform.

**D-02, dritte Form (Einzeleintrag entfernen) — OFFENE FRAGE, siehe unten.**

### Vertiefung 2 — Die zwei `×`-Knöpfe (Kernfrage 2)

**Exaktes DOM, mit Zeilen (`src/components/MiningWorkbench.astro`, Stand
15.08.2026 nach Phase 9):**

```
Zeile 323  <div class="wb__pre" id="wb-pre" data-help={hlp('presets')}>
Zeile 324    <div class="wb__pre__row" id="wb-pre-pick" hidden>          <!-- Zustand "Auswahl" -->
Zeile 325      <select class="wb__pre__sel" id="wb-preset" ...>
Zeile 328      <button ... id="wb-pre-new" title={S.presetSave} ...>+</button>
Zeile 329      <button ... id="wb-pre-del" title={S.presetDel} ... disabled>×</button>   <!-- LÖSCHT, ohne Rückfrage -->
Zeile 330    </div>
Zeile 334    <div class="wb__pre__row" id="wb-pre-edit" hidden>          <!-- Zustand "Namenseingabe" -->
Zeile 335      <input ... id="wb-pre-name" ...>
Zeile 336      <button ... id="wb-pre-ok" class="... is-go" title={S.presetSave} ...>✓</button>
Zeile 337      <button ... id="wb-pre-cancel" title={S.presetCancel} ...>×</button>       <!-- bricht NUR die Eingabe ab -->
Zeile 338    </div>
```

Beide `<div class="wb__pre__row">` liegen an EXAKT derselben Bildschirmstelle
(Spalte 3, Kopf) und schließen sich über `hidden` gegenseitig aus — gesteuert
durch `preMode(editing)` (`assets/mining-workbench.js` Zeilen 456-461):
`prePick.hidden = editing; preEdit.hidden = !editing;`. Beide `×`-Knöpfe
tragen dieselbe CSS-Klasse `wb__pre__b` (Zeile 328/329/336/337) und damit
identische Optik (28×28 px, gleicher Grauton, gleiche Ecke).

**Event-Listener** (Zeilen 476-495):

| Knopf | Listener | Wirkung |
|---|---|---|
| `wb-pre-del` | `click` → `if (preSel.value) preDrop(preSel.value);` | Ruft SOFORT `DELETE` gegen PostgREST auf. Keine Zwischenfrage, keine zweite Bestätigung. |
| `wb-pre-cancel` | `click` → `preMode(false);` | Schaltet nur die UI zurück, kein Netzwerkaufruf. |
| `wb-pre-new` | `click` → `preMode(true);` | Öffnet den Editier-Zustand, Name vorbefüllt mit aktueller Auswahl. |
| `wb-pre-ok` | `click` → `preMode(false); preSave(n);` | Speichert (neu ODER überschreibt). |

**Warum der Fehlgriff passiert:** `wb-pre-del` ist NUR aktiv (`disabled`
entfernt), wenn ein Preset gewählt ist (`preDel.disabled = !preSel.value` in
`preFill()`, Zeile 402, und im `change`-Handler Zeile 478). Der Nutzer war
also im „Auswahl"-Zustand mit gewähltem Preset — genau der Zustand, in dem
`wb-pre-del` aktiv UND sichtbar an der Position ist, an der im „Eingabe"-
Zustand `wb-pre-cancel` steht. Gleiches Zeichen, (fast) gleiche Position,
gegensätzliche Wirkung — der im Auftrag beschriebene Konstruktionsfehler ist
am Code exakt nachvollziehbar.

**Empfehlung für D-01 (mit Belegprinzip aus dem Bestand):**

- **Anderes Symbol für Löschen.** Der Bestand führt bereits ein
  Mülleimer-Symbol: `#ic-trash` in `src/components/account/AccountDashboard.astro`
  Zeile 351 (`<g id="ic-trash" ...><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>...`),
  dort verwendet für die „Gefahrenzone" (Konto löschen), Zeile 661. Dasselbe
  Symbol (oder ein `<use>`-Verweis darauf, analog zum bestehenden
  `#wb-i-pin`-Muster in `MiningWorkbench.astro`) macht „Löschen" auf einen
  Blick vom `×` (Abbrechen/Schließen) unterscheidbar — konsistent mit der
  bestehenden Symbolsprache der Seite statt eines neu erfundenen Zeichens.
- **Andere Farbe.** Der Bestand kennt bereits eine „Gefahr"-Sprache in Rot
  im Konto-Bereich (Gefahrenzone); für die Werkbank ist keine eigene
  Rot-Variable dokumentiert — `color-mix(in srgb, var(--accent) …)`-Muster
  wie überall sonst im Bauteil verwenden (KEINE Hex-Werte, siehe
  `mobile-ux.css`-Kopfkommentar und den bereits im Bauteil dokumentierten
  Grundsatz „KEINE eigenen Farbtoken").
- **Kein `window.confirm()`.** Der Bestand hat sich bereits explizit GEGEN
  native Dialoge entschieden — Kommentar über `wb-pre-edit` (Zeile
  331-333): „Eigene Zeile statt `window.prompt()`: der Dialog ist in vielen
  Browsern unterdrückt, sieht überall anders aus und lässt sich nicht
  beschriften." Dasselbe Argument gilt unverändert für `window.confirm()`.
  Empfehlung: ein **eigenes Bestätigungsmuster** — z. B. der Löschen-Knopf
  wechselt bei Klick für ein paar Sekunden (oder bis zum nächsten Klick
  woanders) in einen zweiten Zustand „Wirklich löschen?" mit einem zweiten,
  jetzt eindeutig roten Knopf, der erst DANN `preDrop()` auslöst. Das ist
  leichter als das Muster im Konto-Bereich (Tipp-Bestätigungswort für
  Kontolöschung, `src/scripts/account-dashboard.ts` Zeilen 1503-1527) —
  angemessen, weil ein Mining-Preset im Gegensatz zu einem Konto trivial neu
  anlegbar ist, aber schwerer als ein einfacher zweiter Klick auf dasselbe
  Icon (das wäre wieder dieselbe Falle: zwei Klicks auf denselben Ort).

### Vertiefung 3 — Entfernen von `#wb-scan` (Kernfrage 3)

**Blast Radius, mit exakten Fundstellen:**

| Ort | Fundstelle | Nötige Änderung |
|---|---|---|
| Markup | `MiningWorkbench.astro` Zeile 347: `<input class="wb__scan num" id="wb-scan" ... data-help={hlp('scan')} />` sowie der umschließende `<div class="wb__scanbox">` Zeile 346-348 | Ganzen `.wb__scanbox`-Block entfernen |
| Sprachobjekt DE/EN | `MiningWorkbench.astro` Zeile 139 (`scanPlaceholder: 'Scanwert'`) und Zeile 158 (EN-Äquivalent) | Schlüssel `scanPlaceholder` aus BEIDEN (`S_DE`/`S_EN`) entfernen — `assertMiningLangParity()` (Zeilen 179-193) erzwingt das ohnehin symmetrisch, ein einseitiges Vergessen bricht den Build sofort |
| Treffermarkierung | `assets/mining-workbench.js` `renderPins()` Zeilen 298-317: liest `$('wb-scan').value` (Zeile 299), berechnet `hit`/`is-hit` je Vielfachem (Zeile 309-310) | `renderPins()` umbauen: kein `scan`-Wert mehr, `is-hit`-Klasse entfällt (die Vielfachen-Anzeige selbst — die Schleife `for (var k = 1; k <= max; k++)` — bleibt gemäß D-06/D-07-Fußnote bestehen, nur ohne Hervorhebung) |
| Input-Listener | `assets/mining-workbench.js` Zeile 599-602: `document.addEventListener('input', ...)` prüft `e.target.id === 'wb-scan'` und ruft `renderPins()` | Zweig `else if (e.target.id === 'wb-scan')` entfernen |
| Hilfe-Schlüssel | `src/i18n/help.ts` Zeile 94 (DE: `'mining.ctl.scan': 'Gemessener Scanwert. ...'`) und Zeile 282 (EN-Äquivalent) | Beide Zeilen entfernen. `assertHelpParity()` (Zeile 445-472) erzwingt Symmetrie automatisch |
| CSS | `.wb__scanbox`/`.wb__scan`/`.wb__scan::placeholder` (Zeilen 589-593 im `<style is:inline>`-Block) | Entfernen — sonst tote Regeln im ausgelieferten `is:inline`-CSS |
| Test-Mock | `tests/e2e/helpers/mining-dom.js` Zeile 322: `root.appendChild(reg(mk('input', 'wb-scan')));` | Kann stehen bleiben (harmlos, ungenutzt) ODER entfernt werden — kein Testfall hängt heute an `wb-scan` (siehe Vertiefung 7) |

**`scripts/verify-help.mjs`-Verhalten geklärt (die im Auftrag befürchtete
Torlücke besteht NICHT):** Das Skript zählt in Zusicherung 6 (Zeilen
254-287) **generisch**, ob jedes `data-tool-id`-Vorkommen **mindestens
einen** nicht-leeren `data-help`-Anker im Dokumentbereich bis zum nächsten
`data-tool-id` trägt — es gibt **keine feste Sollzahl je Werkzeug** und
**keine Liste einzelner erwarteter `data-help`-Werte** im Skript selbst. Die
Mining-Werkbank behält nach Entfernen von `mining.ctl.scan` weiterhin zehn
`data-help`-Anker (`search`, `system`, `tiles`, `pinbtn`, `pins`, `presets`,
`station`, `fracturing`, `locpin`, `tabs`/Nachfolger, `shortlist`) — weit
über der Untergrenze von 1. **`verify-help.mjs` selbst muss für diese
Änderung nicht angefasst werden.** Die im CONTEXT.md geäußerte Sorge bezieht
sich vermutlich auf den historischen Vorfall vom 11.08.2026 (dokumentiert in
`.planning/notes/mining-werkbank-defekte.md`, Abschnitt „Die Torlücke"), bei
dem die Werkbank ALLE Anker verlor und ein FREMDES Werkzeug (Refinery-
Finder auf derselben Seite) das Tor fälschlich grün hielt — das war der
Auslöser, Zusicherung 6 auf „je Werkzeug" statt „je Seite" umzustellen
(bereits geschehen, Kommentar Zeilen 49-53 in `verify-help.mjs`). Diese Lücke
ist bereits geschlossen; Phase 10 entfernt nur EINEN von zehn Ankern eines
Werkzeugs, das nach Entfernen immer noch weit über der Mindestzahl liegt.

Zusätzlich zu prüfen (Sprachparitäts-Zusicherung 3, Zeilen 170-203):
`data-help=`-Zählung muss zwischen EN- und DE-Seite weiterhin gleich sein —
automatisch erfüllt, wenn der Anker (samt `hlp('scan')`-Aufruf) komplett aus
beiden Sprachzweigen des Astro-Templates entfernt wird (es gibt nur EIN
Template für beide Sprachen).

**Vielfachen-Anzeige bleibt unabhängig vom Scanfeld:** Bestätigt — die
Schleife, die `MAXCLUSTER[rarity]`-viele `<i>`-Elemente je angeheftetem Erz
erzeugt (`renderPins()` Zeilen 307-311), hängt NICHT an `scan`; nur die
`is-hit`-Klasse (Zeile 309) tut das. Entfernt man ausschließlich die
`is-hit`-Berechnung, bleibt die Liste „Signatur × 1…max" vollständig
erhalten, wie D-07 (Fußnote) verlangt.

### Vertiefung 4 — Rechte Spalte: Reiter → zwei gestapelte Listen (Kernfrage 4)

**Aktueller Reitermechanismus** (`src/components/MiningWorkbench.astro`
Zeilen 306-311 Markup, 345-354 Panels; `assets/mining-workbench.js` Zeilen
573-582 Klick-Handler):

- `div#wb-tabbar` mit zwei `button.wb__chip.wb__tab` (`data-tab="sig"` /
  `data-tab="loc"`).
- `div#wb-sig-pane.wb__tabpane` (enthält Scan-Kasten + `div.wb__scroll#wb-pins`)
  und `div#wb-loc-pane.wb__tabpane` (enthält `div.wb__scroll#wb-locpins`,
  initial `hidden`).
- CSS-Regel-Reihenfolge ist Pflicht (Zeilen 587-588):
  `.wb__tabpane{display:flex;...}` MUSS vor `.wb__tabpane[hidden]{display:none}`
  stehen, sonst schlägt `display:flex` das `hidden`-Attribut — dieselbe
  Falle wie bei `.wb__pre__row[hidden]` (bereits gelöst, siehe Kommentar
  Zeile 180-182 im Bauteil).
- Grid: `.wb__grid{grid-template-columns:470px 1fr 262px}` (Zeile 424,
  Kommentar dort belegt: 262px reicht heute knapp für EINE sichtbare Liste
  plus Preset-Zeile).

**Für D-03 (Reiter weg, beide Listen gestapelt sichtbar) nötige Änderung:**
Beide `.wb__tabpane`-Blöcke verlieren `role="tabpanel"`/`hidden`/die
Tab-Klick-Logik; stattdessen je eine `h4`-Überschrift (Formvorbild:
`<h4 id="wb-loch" set:text={S.locations} />` vor `#wb-locs`, Zeile 294) über
jedem der beiden `.wb__scroll`-Kästen, beide dauerhaft `display:flex`. Die
verfügbare Höhe der Spalte 3 muss sich zwischen beiden Listen aufteilen
(`flex:1 1 0;min-height:0` auf beiden `.wb__scroll`-Containern, analog zum
bereits im Bauteil verwendeten `min-height:0`-Muster in `.wb__pane`, Zeile
411) statt wie bisher, dass eine Liste 100 % der Resthöhe bekommt.

**Scrollleisten-Registrierung — WICHTIGER, entlastender Befund:** Die im
CONTEXT.md zitierte Dauerregel „Jeder innen scrollende Kasten muss in die
Selektorliste in `assets/mobile-ux.css`" ist für dieses Bauteil bereits
**klassenbasiert erfüllt**, nicht instanzbasiert. `assets/mobile-ux.css`
Zeilen 605-652 (Abschnitt „5d Eigener Bildlaufbereich") registriert die
Klasse `.wb__scroll` als GANZES:

```css
.vb-scrollbox, ..., .wb__scroll, .wb__filters .tool-help__body, ... {
  scrollbar-width: thin !important; ...
}
.vb-scrollbox::-webkit-scrollbar, ..., .wb__scroll::-webkit-scrollbar, ... {
  display: block !important; width: 8px !important; height: 8px !important; ...
}
```

Jedes Element mit `class="wb__scroll"` bekommt die sichtbare Leiste
automatisch — unabhängig davon, ob es `#wb-pins`, `#wb-locpins` oder ein
künftiges drittes Element ist. **Es ist KEIN neuer Eintrag in
`mobile-ux.css` nötig, solange die neuen/umgebauten Kästen weiterhin
`class="wb__scroll"` tragen** (was sie heute schon tun, siehe Markup-Zeilen
349 und 353).

`assets/edge-fade.js` **existiert nicht mehr unter diesem Namen** — die
horizontale/vertikale Kanten-Weichzeichnung wurde in `assets/scroll-affordance.js`
zusammengeführt (Datei geprüft). Deren `SEL_VFADE = '.vb-scrollbox'` (Zeile
32) deckt `.wb__scroll` **nicht** ab — das ist aber KEINE Regression: das
Mining-Werkbank-Muster hat diese weiche Kante nie gehabt (nur die
sichtbare native Leiste über `mobile-ux.css`), und Phase 9 hat daran nichts
geändert. Für Phase 10 ist der Status quo also: zwei `.wb__scroll`-Kästen
mit sichtbarer Leiste, ohne Kanten-Fade — konsistent mit dem, was heute
bereits für `#wb-pins`/`#wb-locpins` gilt. **Keine Handlung nötig**, es sei
denn, der Planer entscheidet sich BEWUSST für eine Kanten-Fade-Ergänzung
(dann wäre `.wb__scroll` neu in `SEL_VFADE` aufzunehmen — eine echte,
benennbare Erweiterung, kein Pflichtnachzug).

**Bekannte, dokumentierte Sackgasse (Kommentar `.wb__pane{overflow:hidden}`,
Zeilen 442-449 im Bauteil):** Ein Panel „neben" die Spalte zu legen
(`position:absolute; left:calc(100% + …)`) wird vom `overflow:hidden` der
`.wb__pane`-Klasse restlos abgeschnitten — bereits vorgeführt und
zurückgenommen (siehe auch `.planning/notes/mining-werkbank-defekte.md`
„Neben die Spalte legen"). Relevant, falls der Planer erwägt, die
Preset-Liste (D-05) als Ausklapp-Overlay zu bauen — das würde in dieselbe
Falle laufen.

### Vertiefung 5 — Ersatz für das `<select>` (Kernfrage 5)

**Zwei Formvorbilder existieren bereits im selben Bauteil:**

1. **`.wb__tile`** (`MiningWorkbench.astro` Zeilen 253-259, CSS Zeilen
   472-504) — Kachel mit Auswahlzustand (`is-sel`), Klick wählt aus. Zeigt
   das Muster „aus wenigen sichtbaren Einträgen EINEN auswählen, Zustand
   sichtbar über Hintergrundfarbe" — direkt übertragbar auf „ein Preset aus
   der sichtbaren Liste wählen".
2. **`.wb__pin-item` / `.wb__pin-top`** (`assets/mining-workbench.js`
   Zeilen 298-317 `renderPins()`, Zeilen 323-353 `renderLocPins()`; CSS
   Zeilen 621-626) — Zeile mit Name links, Lösch-Knopf (`×`) rechts. Zeigt
   das Muster „Name + Aktion, ohne Klappen" — direkt übertragbar auf „ein
   Preset in der Liste umbenennen/löschen".

**Empfehlung:** Eine neue Render-Funktion (`renderPresetList()`, Vorbild
`renderPins()`) erzeugt je gespeichertem Preset EINE Zeile im
`.wb__pin-item`-Stil, ergänzt um:
- Auswahlzustand wie `.wb__tile.is-sel` (Klick auf die Zeile = `preApply()`),
- eine Umbenennen-Aktion (Stift-Symbol oder Text-Klick auf den Namen → wechselt
  in einen Inline-Eingabezustand, Vorbild: das bestehende Namensfeld-Muster
  aus `wb-pre-edit`, aber JE Zeile statt global),
- eine Löschen-Aktion mit dem Trash-Icon-Muster aus Vertiefung 2.

Damit entsteht **kein neues visuelles Vokabular** — die drei Bausteine
(Kachel-Auswahl, Name+Aktion-Zeile, Icon-Sprache) sind alle bereits im
Bauteil bzw. im Konto-Bereich vorhanden und geprüft.

**Verworfene Alternativen:** siehe Tabelle „Alternatives Considered" oben
(`<datalist>`, `<details>`-Akkordeon).

### Vertiefung 6 — Prüftore (Kernfrage 6)

**Welche `npm run`-Skripte müssen grün bleiben:**

| Skript | Registrierung | Bezug zu Phase 10 |
|---|---|---|
| `npm run build` | `package.json` Zeile 8 | Muss grün bleiben — inkl. `assertMiningLangParity()` und `assertHelpParity()`, die bei JEDEM Build laufen |
| `npm run gate` | `scripts/lib/gate-registry.mjs`, Schiene A | Führt u. a. `verify:mining`, `verify:help`, `audit:site`, `test:e2e` aus |
| `verify:mining` (`scripts/verify-mining.mjs`) | Zeile 172-189 in `gate-registry.mjs` | Prüft Datenintegrität von `mining-db.json`/`mining-model.json` — **kein Bezug zu Presets oder UI-Bedienung**. Diese Phase ändert weder Daten noch Skript. Bereits bestehende Zusicherung 12 (Zeilen 116-137) gegen `|` in Namen bleibt unverändert relevant (Paar-Schlüssel-Format ändert sich in Phase 10 nicht). |
| `verify:help` (`scripts/verify-help.mjs --complete`) | Zeile 151-189 | Wie in Vertiefung 3 geklärt: KEINE Änderung am Skript nötig, nur an den `data-help`-Werten in den betroffenen Astro-/i18n-Dateien |
| `audit:site` (`scripts/audit-site.mjs`) | Zeile 165-170 | Trägt die Datenherkunfts-Regel als einziges Tor — neue Meldungstexte (Rename-Konflikt, Löschbestätigung) dürfen keine Datenherkunft nennen (ohnehin unwahrscheinlich, aber zu beachten) |
| `test:e2e` (`node --test tests/e2e/**/*.test.js`) | Zeile 68 `package.json`, `gate-registry.mjs` Zeile 73-78 | `tests/e2e/mining-shortlist.test.js` betroffen — siehe Vertiefung 7 |

**Neue Prüfstrecke voraussichtlich NICHT nötig.** Diese Phase ändert kein
Datenformat und keine Datenintegrität — sie ändert Bedienung. Die
naheliegende Erweiterung ist eine **neue Zusicherung INNERHALB**
`tests/e2e/mining-shortlist.test.js` (Verhalten: Rename überschreibt korrekt,
Löschen fragt zurück, Einzeleintrag-Entfernen funktioniert), nicht ein neues
`verify:*`-Skript. Sollte der Planer dennoch ein neues eigenständiges
Prüfskript für UI-Vertragsfragen anlegen wollen (unwahrscheinlich für diese
Art Änderung), MUSS es nach CLAUDE.md § „Prüfungen bauen" in
`scripts/lib/gate-registry.mjs` eingetragen werden — `verify:wiring`
erzwingt das bereits maschinell.

**„Vorgeführt rot"-Pflicht (Grundsatz 1):** Jede NEUE Zusicherung in
`mining-shortlist.test.js` (Rename-Kollision, Bestätigungszustand vor
Löschen, Einzeleintrag-Entfernen) muss im Executor-Durchlauf einmal
absichtlich gebrochen und das rote Protokoll in die Zusammenfassung
aufgenommen werden — exakt das bereits in Phase 9 etablierte Verfahren
(siehe `09-01-SUMMARY.md`/`09-02-SUMMARY.md`, Abschnitt „Negativkontrollen").

### Vertiefung 7 — Bestehende e2e-Abdeckung, was bricht (Kernfrage 7)

**Datei:** `tests/e2e/mining-shortlist.test.js` (15 Testfälle, Stand nach
Phase 9 Plan 02) + `tests/e2e/helpers/mining-dom.js` (Mock-DOM).

**Direkt von D-05 (Select-Ersatz) betroffen — Testfälle, die
`ctx.elements['wb-preset'].value = '<Name>'` setzen, um `preApply()`
auszulösen** (der Mock feuert bei jedem `.value`-Setzen automatisch `input`
UND `change`, siehe `tests/e2e/helpers/dom-mock.js` Zeilen 129-135):

- Zeile 108: `Preset in der alten Form (kein locations-Feld) laedt`
- Zeile 125: `Preset mit locations: null verhaelt sich wie ein Preset ohne das Feld`
- Zeile 202: `Merkliste leeren, dasselbe Preset erneut waehlen`
- Zeilen 225/231: `Preset A und Preset B im Wechsel`
- Zeile 282: `ein Paar mit unbekanntem Erz ODER unbekanntem Fundort ...`
- Zeile 416: `Merkliste bei 128 Paaren voll ...`

**Alle sechs Fälle setzen einen `<select>`-Wert direkt.** Ersetzt man das
`<select>` durch eine Liste anklickbarer Zeilen (Vertiefung 5), funktioniert
dieses Muster nicht mehr — die Tests müssten auf `ctx.fire(presetRow,
'click')` umgestellt werden (Vorbild: `selectMineral()`-Helfer in der
Testdatei selbst, Zeilen 36-41, der bereits `ctx.fire(tile, 'click')`
nutzt). **Sowohl die Testdatei als auch `mining-dom.js`
(`root.appendChild(reg(mk('select', 'wb-preset')));` Zeile 335) müssen
angepasst werden**, wenn D-05 umgesetzt wird — das ist erwartete,
planbare Arbeit, keine Überraschung.

**Von D-03 (Reiter weg) betroffen:**

- Zeile 453-464: `Reiter-Beschriftung "Fundorte" nennt die Zahl der Paare
  erst, sobald welche da sind` — prüft `ctx.elements['wb-tab-loc'].textContent`.
  Fällt das Reiter-Konzept weg, verschiebt sich diese Beschriftung
  voraussichtlich auf eine `h4`-Überschrift über der gestapelten Liste
  (Formvorbild `#wb-loch`, das bereits „Fundorte · N" zeichnet, Zeile 231
  in `mining-workbench.js`) — der Test muss auf das neue Element
  umgeschrieben werden, die GEPRÜFTE ANFORDERUNG (Zähler erscheint erst ab
  1 Eintrag) bleibt unverändert gültig und sollte erhalten bleiben.
- `mining-dom.js` Zeilen 325-332 registrieren `wb-tab-sig`/`wb-tab-loc`/
  `wb-sig-pane`/`wb-loc-pane` — diese IDs verschwinden oder ändern
  Bedeutung, wenn Reiter zu dauerhaft sichtbaren Blöcken werden.

**Von D-01 (Löschen mit Rückfrage) NICHT direkt betroffen:** Kein
bestehender Testfall ruft `wb-pre-del` auf — die aktuelle
Sofort-Löschung ist heute UNGETESTET. Phase 10 sollte hierfür NEUE
Testfälle ergänzen (Klick löst NICHT sofort `DELETE` aus; erst der zweite,
bestätigende Klick tut es) — reiner Zugewinn, kein Bruch.

**Von D-07 (Scan entfernt) NICHT betroffen:** Kein bestehender Testfall
prüft `#wb-scan` oder `is-hit` (`mining-dom.js` registriert das Element nur
strukturell, Zeile 322, ohne dass irgendein Testfall es anfasst) — sicheres
Entfernen ohne Testbruch.

**Unverändert funktionierend, weil unabhängig von den D-01/D-02/D-03/D-05-
Änderungen:** alle Testfälle rund um `selectMineral()`, `locPinBtn()`,
`tilePinBtn()` (Spalte 1 und Mitte) — Kernauswahl- und Anheft-Mechanik ist
von diesem Umbau nicht betroffen.

## Don't Hand-Roll

| Problem | Nicht selbst bauen | Stattdessen | Warum |
|---------|-------------|----------------|--------------|
| Zeilenumbenennung mit Primärschlüssel-Verschiebung | Eigenes Transaktions-/Zwei-Schritt-Protokoll im Client | Ein `PATCH` auf den PK, RLS + Unique-Constraint der DB machen den Rest | Postgres/PostgREST lösen das bereits korrekt und atomar; ein selbstgebautes Zwei-Schritt-Verfahren (POST+DELETE) führt zu genau den Datenverlust-Szenarien, die diese Phase beheben soll |
| Bestätigungsdialog | `window.confirm()` | Eigener Inline-Zustand (Vorbild: `wb-pre-edit`-Musterreihe) | Bereits im Bestand begründet gegen native Dialoge entschieden (`window.prompt()`-Kommentar) — inkonsistente Optik, unterdrückbar, nicht beschriftbar |
| Preset-Auswahlliste | Eigenes `<datalist>`/Custom-Dropdown-Widget von Grund auf | `.wb__tile`/`.wb__pin-item`-Muster wiederverwenden | Vorhandene, geprüfte, barrierearme Bausteine — kein neues Zustandsmodell nötig |

**Key insight:** Diese Phase hat keinen einzigen Punkt, der ein neues
technisches Muster erfordert. Jede der sieben Kernfragen löst sich mit
einem bereits im Repository etablierten Baustein — die Aufgabe ist
Zusammensetzen und Konsistenz, nicht Erfinden.

## Common Pitfalls

### Pitfall 1: `.wb__pane{overflow:hidden}` frisst Overlays

**Was schiefgeht:** Ein Ausklapp-Panel oder eine Vorschlagsliste, die
außerhalb der Panel-Grenzen positioniert wird (`position:absolute;
left:calc(100%+…)`), wird komplett unsichtbar abgeschnitten.
**Warum:** `.wb__pane` trägt `overflow:hidden` (Zeile 411), Begründung: die
angeschrägte Ecke (`.chamf::after`) braucht es.
**Wie vermeiden:** Jede neue Bedienoberfläche (Preset-Liste, Umbenennen-
Eingabe) bleibt INNERHALB der Panel-Grenzen, keine Overlay-Positionierung
relativ zum Panel.
**Warnzeichen:** Ein Element mit `position:absolute` und einem `left`- oder
`top`-Wert, der über 100 % des Elternelements hinausgeht.

### Pitfall 2: `[hidden]` verliert gegen `display:flex` bei falscher Regel-Reihenfolge

**Was schiefgeht:** Ein als „ausgeblendet" gedachtes Element bleibt sichtbar.
**Warum:** CSS-Kaskade — eine spätere `display:flex`-Regel mit gleicher
Spezifität überschreibt das native `hidden`-Verhalten.
**Wie vermeiden:** Bereits zweimal im Bestand korrekt gelöst
(`.wb__pre__row[hidden]`, `.wb__tabpane[hidden]`) — IMMER die
`[hidden]`-Regel NACH der `display`-Regel deklarieren.
**Warnzeichen:** Ein Element mit `hidden`-Attribut, das trotzdem Fläche
einnimmt.

### Pitfall 3: `is:inline`-Kommentare zählen im gebauten HTML mit

**Was schiefgeht:** Ein Struktur-Zähl-Test (`grep`/`split` gegen `dist/`)
findet einen Klassennamen zweimal, obwohl er nur einmal im Markup steht.
**Warum:** `<style is:inline>` wird UNVERÄNDERT ins ausgelieferte HTML
kopiert — auch CSS-Kommentare, die einen (ggf. gelöschten) Klassennamen
noch nennen.
**Wie vermeiden:** Beim Löschen/Umbenennen von Klassen (z. B. `.wb__tab*`,
`.wb__pre__sel`) auch alle Kommentare im `<style is:inline>`-Block
durchsehen. Bereits einmal in Phase 9 als „Deviation" aufgetreten (siehe
`09-01-SUMMARY.md`, Abschnitt „Automatisierter Struktur-Check … zählte
zunächst 2 statt 1").
**Warnzeichen:** Eine automatisierte Zählung im Verify-Schritt eines Plans
liefert einen unerwarteten Wert `>1`, obwohl im Markup nur ein Vorkommen
steht.

### Pitfall 4: Zeichen-/Positions-Wiederholung bei destruktiven Aktionen

**Was schiefgeht:** Zwei Knöpfe mit identischem Symbol an (fast) derselben
Stelle, unterschiedliche Wirkung — der eigentliche Auslöser dieser Phase.
**Warum:** Zwei UI-Zustände teilen sich denselben Platz über `hidden`-
Umschaltung, beide verwenden dieselbe generische Knopf-Klasse.
**Wie vermeiden:** Für JEDE destruktive Aktion (Löschen) ein eigenes,
unverwechselbares Symbol + eigene Farbe + wenn möglich eigene Position
relativ zu nicht-destruktiven Aktionen im selben Kontext.
**Warnzeichen:** Zwei `<button>`-Elemente mit identischem sichtbarem
Zeichen (`×`, `✓`, …) in benachbarten oder sich abwechselnden UI-Zuständen.

### Pitfall 5: `S_DE`/`S_EN`-Schlüssel einseitig vergessen

**Was schiefgeht:** Build bricht erst beim Bauen ab (gutes Verhalten,
siehe unten), nicht schon beim Schreiben — wird leicht erst spät bemerkt.
**Warum:** `assertMiningLangParity()` (Zeilen 179-193) und
`assertHelpParity()` (`src/i18n/help.ts` Zeilen 445-472) laufen bei
`npm run build`, nicht beim Speichern der Datei.
**Wie vermeiden:** Jeden neuen Sprachschlüssel SOFORT in BEIDEN Zweigen
gleichzeitig anlegen (z. B. `presetNameTaken` für den Rename-Konflikt aus
Vertiefung 1).
**Warnzeichen:** `npm run build` bricht mit `MiningWorkbench:
Sprachschluessel von DE und EN weichen ab` oder `assertHelpParity: ...
Schluesselmengen ... weichen ab` ab — das ist das GEWOLLTE Verhalten, kein
Fehler im Prüfmechanismus.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | Keine Einträge — alle Befunde dieser Recherche sind direkt am Code (dieser Codebasis) verifiziert, nicht angenommen. | — | — |

**Diese Tabelle ist leer:** Jede Aussage in diesem Dokument stammt aus dem
Lesen des tatsächlichen Codes in diesem Repository (Astro-Komponente,
Client-JS, SQL-Migrationen, Testdateien, Gate-Registry) — keine
Trainingsdaten-Vermutung, keine externe Quelle. Entsprechend trägt keine
Aussage das `[ASSUMED]`-Tag; alle sind `[VERIFIED: Codebase-Lesung]`.

## Open Questions

1. **D-02, dritte Form — „einzelne Einträge entfernen, ohne das Preset neu
   zu bauen": Was genau bedeutet das bedienungstechnisch?**
   - Was wir wissen: Ein aktives Preset kopiert seinen Inhalt in `S.pins`/
     `S.locPins` (`preApply()`, Zeilen 447-455). Ein Klick auf eine
     bestehende Nadel/einen bestehenden Signatur-Pin ändert diese lokalen
     Arrays SOFORT — aber schreibt NICHT automatisch in die Datenbank
     zurück. Der Nutzer müsste heute danach explizit erneut speichern
     („+"/`wb-pre-new` → gleicher Name → ✓), was CONTEXT.md ausdrücklich
     ausschließt („ohne das Preset neu zu bauen").
   - Was unklar ist: Ob „ohne neu zu bauen" heißt (a) ein aktives Preset
     soll bei JEDER Änderung automatisch nachgespeichert werden (auto-save,
     ggf. entprellt), oder (b) die Preset-Listenzeile selbst (Vertiefung 5)
     soll — unabhängig vom aktuell geladenen Arbeitsstand — eine eigene,
     direkte „Eintrag X aus dieser gespeicherten Zeile entfernen"-Aktion
     bekommen, die einen gezielten `PATCH` auf genau diese Zeile auslöst,
     OHNE das Preset vorher zu laden/anzuwenden.
   - Empfehlung: (b) ist konsistenter mit der bestehenden Architektur (kein
     neuer impliziter Auto-Save-Zustand, der mit „Umbenennen" und
     „Überschreiben" kollidieren könnte) und vermeidet die Frage „was
     passiert, wenn ich ein Preset lade, etwas ändere, aber NICHT
     überschreiben wollte" — sollte aber in `/gsd-discuss-phase` oder direkt
     im Plan als CONTEXT-Ergänzung geklärt werden, bevor die Aufgabe
     geschnitten wird, da beide Lesarten unterschiedliche Task-Zuschnitte
     nach sich ziehen.

2. **Exakte Bestätigungsmechanik für Löschen (D-01).**
   - Was wir wissen: Kein `window.confirm()` (Begründungsprinzip aus dem
     Bestand), Trash-Icon-Präzedenz vorhanden.
   - Was unklar ist: Zwei-Klick-Inline-Zustand vs. eine kurze, zeitbasierte
     „Wirklich löschen?"-Einblendung vs. ein Muster näher am
     Kontolöschungs-Formular (Tipp-Bestätigung) — CONTEXT.md schreibt nur
     das WAS vor, nicht das WIE.
   - Empfehlung: Zwei-Klick-Inline-Zustand (Vorschlag in Vertiefung 2) —
     niedrigste Reibung bei gleichzeitig erfüllter Rückfrage-Pflicht; im
     Plan als benannte Entscheidung festhalten, nicht stillschweigend
     wählen.

## Sources

### Primary (HIGH confidence — direkt in diesem Repository gelesen)

- `src/components/MiningWorkbench.astro` (vollständig, Stand 15.08.2026 nach Phase 9)
- `assets/mining-workbench.js` (vollständig)
- `assets/account-lite.js` (vollständig, insb. `rest()` Zeilen 59-70, `hbWrite()` Zeile 284)
- `supabase/migrations/20260812040000_mining_sig_presets.sql` und `20260815090000_mining_preset_locations.sql`
- `scripts/verify-mining.mjs`, `scripts/verify-help.mjs`, `scripts/lib/gate-registry.mjs`
- `src/i18n/help.ts` (vollständig)
- `assets/mobile-ux.css`, `assets/scroll-affordance.js`
- `tests/e2e/mining-shortlist.test.js`, `tests/e2e/helpers/mining-dom.js`, `tests/e2e/helpers/dom-mock.js`
- `src/components/account/AccountDashboard.astro` (Trash-Icon, Delete-Confirmation-Muster)
- `src/scripts/account-dashboard.ts` (Tipp-Bestätigungs-Muster für Kontolöschung)
- `.planning/phases/09-mining-werkbank-fundort-merkliste/CONTEXT.md`, `09-01-PLAN.md`, `09-02-PLAN.md`, `09-01-SUMMARY.md`, `09-02-SUMMARY.md`
- `.planning/notes/signaturliste-anheften.md`, `.planning/notes/mining-werkbank-defekte.md`
- `.planning/phases/10-mining-presets-bedienbar-machen/CONTEXT.md`
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`, `CLAUDE.md`
- `package.json` (Skript-Definitionen)

### Secondary (MEDIUM confidence)

- Keine — kein Web-Research-MCP verbunden für dieses Projekt (`.planning/config.json`: alle Suchanbieter `false`), und der gesamte Untersuchungsgegenstand liegt ohnehin im eigenen Repository.

### Tertiary (LOW confidence)

- Keine.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — keine neuen Abhängigkeiten, gesamter Bestand gelesen
- Architecture (RLS/PATCH-Rename): HIGH — Migrationsdatei und Politik-Definition wörtlich gelesen, PostgREST-Verhalten (409 bei Unique-Verletzung) ist dokumentiertes Standardverhalten des eingesetzten Systems
- Pitfalls: HIGH — alle fünf Pitfalls sind bereits einmal im Repository aufgetreten und dokumentiert (nicht spekulativ)
- Offene Fragen (D-02 dritte Form, D-01 Mechanik): bewusst als offen markiert, keine Konfidenzangabe nötig — sind Produktentscheidungen, keine Recherchefragen

**Research date:** 2026-08-15
**Valid until:** Bis zur nächsten Änderung an `mining-workbench.js`/`MiningWorkbench.astro`/`account-lite.js` — reines internes Repository, kein Ablaufdatum durch externe API-Änderungen. Empfehlung: bei Planung sofort verwenden (keine Alterung zu erwarten vor Ausführung).
