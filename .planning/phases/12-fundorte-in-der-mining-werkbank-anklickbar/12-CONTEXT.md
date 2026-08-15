# Phase 12: Fundorte in der Mining-Werkbank anklickbar — Kontext

**Erhoben:** 2026-08-15
**Status:** Bereit zur Planung

Anlass war ein Hinweis des Betreibers mit scmdb als Vergleich („da sind die
Fundorte einzeln anklickbar"), ausdrücklich als Hinweis auf den *Informationsgehalt*,
nicht auf die Gestaltung: „vom Aussehen her halten wir uns an unsere Standards."

<domain>
## Phasengrenze

Die Werkbank beantwortet heute nur eine Richtung — „wo finde ich DIESES Erz?".
Diese Phase liefert die Gegenrichtung — „was gibt es an DIESEM Ort?" — als
umschaltbare Ansicht der **Mittelspalte**. Kein neues Werkzeug, keine neue Seite,
keine neue Route, keine Datenarbeit.

Die Datenhälfte liegt fertig und ungenutzt im Bestand: `assets/mining-db.json`
führt neben `minerals[]` auch `bodies[]` — 45 Fundorte, je Erz `chance`,
`maxShare`, `eff`, `mining`, `rarity`. `scripts/verify-mining.mjs` prüft beide
Richtungen bereits paarweise gegeneinander (Zeilen 62–83). Im UI wird `bodies[]`
bisher **nirgends** benutzt.

**Nicht in dieser Phase:** eigene Fundort-Seiten (vorgelegt und verworfen),
Preise, Gruppenanteile im scmdb-Stil, Adernzahlen, Änderungen an der Extraktion.
</domain>

<decisions>
## Umsetzungsentscheidungen

### Ein- und Ausstieg

- **D-01: Die ganze Fundort-Zeile ist das Klickziel**, nicht nur der Name.
  Die Anheft-Nadel bleibt ein eigener Klickbereich innerhalb der Zeile.
  Begründung aus der Historie: beim Anheft-Knopf hat drei Runden gekostet, dass
  das Ziel zu klein war — und zu klein war nie der Knopf, sondern die Kachel.
  ⚠ **Nebenbedingung:** `row2()` (`assets/mining-workbench.js:212`) rendert
  Fundort- **und** Stationszeilen. Die Stationszeilen dürfen **nicht**
  mitklickbar werden — dieselbe Abgrenzung, die dort schon für die Nadel gilt
  (der siebte Parameter `pinKey` wird nur vom Fundort-Aufruf übergeben).
  Der bestehende Mechanismus ist damit auch der Träger für den Klick.

- **D-02: Die Erzzeilen INNERHALB der Fundort-Ansicht sind ihrerseits klickbar**
  und führen zu diesem Erz. Zusätzlich immer ein Zurück-Pfeil im Kopf der
  Spalte. Die Werkbank wird damit ein Netz aus beiden Richtungen statt einer
  Sackgasse.

- **D-03: Die Fundort-Merkliste rechts (`#wb-locpins`) trägt denselben Klick.**
  Ohne das gäbe es zwei Fundortlisten, von denen nur eine reagiert — genau die
  Halbheit, die in Phase 10 bei den Reitern zurückgemeldet wurde.
  ⚠ Die Merklistenzeile trägt bereits ein `data-locpin`-Element zum Lösen
  (`assets/mining-workbench.js:401`); der delegierte Handler wertet Attribute in
  fester Reihenfolge aus. Der neue Klick darf diese Vorrangordnung nicht
  aufweichen (vgl. den Kommentar bei `data-pre-rmmin`/`data-pre-rmloc`, Zeile 522).

- **D-04: Die Ansicht ist per Adresse aufrufbar** (`?fundort=<Name>`).
  Die Werkbank liest bereits `?mineral=` beim Laden
  (`assets/mining-workbench.js:923`) — dieselbe Mechanik. Damit ist ein Fundort
  verlinkbar, ohne dass eine Seite entsteht.
  — **Reversibility:** costly — die Adresse ist ab Auslieferung eine öffentliche
  Zusage: geteilte Verweise (Discord, Lesezeichen) brechen, wenn der
  Parametername oder die Schreibweise des Ortsnamens später wechselt. Der Name
  ist der Schlüssel aus `bodies[].body`, also an die Datenextraktion gebunden.

### Aufbau der Erzliste

- **D-05: Immer nach Abbaumethode gruppieren**, auch bei den 20 der 45
  Fundorte mit nur einer Methode. Die einzelne Überschrift ist dort kein
  Zierrat, sondern eine wahre Aussage („hier geht nur Schiffsabbau"), und der
  Aufbau der Ansicht springt zwischen zwei Fundorten nicht um.
  ⚠ `methodLabel()` (`assets/mining-workbench.js:149`) fasst `fps` und `hand`
  bewusst zu „Hand" zusammen — diese Zusammenfassung gilt hier unverändert
  weiter, sie ist begründet und nicht neu zu entscheiden.

- **D-06: Rechts an der Erzzeile steht die CHANCE**, nicht der Erwartungswert.
  **Balken und Sortierung folgen derselben Größe** — die sichtbare Zahl muss die
  Reihenfolge erklären, sonst wirkt die Liste unsortiert (in Phase 9 bereits
  einmal behoben). Der Balken misst relativ zur höchsten Chance **dieses Ortes**.
  ⚠ Bewusst asymmetrisch zur Erz-Ansicht, die Fundorte nach `eff` rangiert.
  Vom Betreiber gegen die Empfehlung gewählt und nach Vorlage der Folge (D-07)
  bestätigt: an einem Ort ist „wie oft treffe ich das an" die Leitfrage, beim
  Ort-Vergleich „wie viel bringt es".

- **D-07: Spurenerze bleiben an ihrer sortierten Stelle**, gedämpft und mit
  einem Abzeichen „Spur". Kein eigener Abschnitt — EIN Mechanismus, keine
  verschachtelten Überschriften unter der Methodengruppe.
  ⚠ Diese Entscheidung wurde **nach** D-06 nachgeschärft: unter
  Chance-Sortierung stehen die Spuren **nicht** mehr am Ende, sondern verstreut
  in der Liste (an Pyro Deep Space Asteroids: Aluminium 29,8 · Corundum 29,8 ·
  Torite 28,5 · **Hephaestanit 14,9 Spur** · Quarz 14,9 · **Silicon 14,9 Spur**
  · **Kupfer 14,8 Spur** · Zinn 14,8 …). Dämpfung und Abzeichen sind damit
  nicht Beiwerk, sondern das einzige, was abbauwürdig von nutzlos trennt.
  **Schwelle:** Höchstanteil ≤ 10 %. Das ist keine Ermessensfrage — die 521
  Paare verteilen sich auf 171 mit ≤ 10 % und 350 mit > 50 %, **dazwischen
  liegt nichts**. Die Grenze ist gemessen, nicht gesetzt.

- **D-08: Keine Scan-Signatur in der Erzzeile.** Die Signaturenliste in Spalte 3
  leistet das bereits; die Unterzeile bleibt kurz.

### Verhalten der übrigen Werkbank

- **D-09: Die Kachelspalte hebt die Erze dieses Ortes hervor.** Alle 37 Kacheln
  bleiben stehen, die 6–17 hier vorkommenden bekommen eine Markierung — kein
  Filter, nichts verschwindet. Damit ist auch sichtbar, was hier *nicht*
  vorkommt. Die Filterzeile darüber behält ihre alleinige Zuständigkeit.

- **D-10: Die Fußzeile bleibt unverändert** beim zuletzt gewählten Erz
  (Stationswahl und Fracturing-Verweis). Sie gehört zum Werkzeug, nicht zur
  Ansicht; der Weg zum Rechner bleibt immer offen.

- **D-11: Der Kopf der Mittelspalte zeigt** Ortsname, darunter Art · System und
  die Anflugpunkte, links den Zurück-Pfeil. **Signaturkasten und großer
  Anheft-Knopf entfallen in dieser Ansicht** — beide beziehen sich auf ein Erz,
  und einen Ort allein kann man nicht anheften (angeheftet werden Paare
  „Erz — Ort"). Ausdrücklich verworfen: den Anheft-Knopf mit der Bedeutung
  „letztes Erz an diesem Ort" weiterzuverwenden — ein gleich aussehender Knopf
  mit anderer Wirkung hat in Phase 10 ein Preset gekostet.
  ⚠ `locName()` (Zeile 140) hängt die Anflugpunkte heute an den Ortsnamen; im
  Kopf gehören sie in die Unterzeile, nicht in die Überschrift.

### Claudes Ermessen

- **Zustand beim Neuladen.** Vorschlag: die Adresse gewinnt (`?fundort=` öffnet
  die Ansicht), der `localStorage` merkt sich die Ansicht **nicht** — genau wie
  `?mineral=` es heute hält. Ein Neuladen ohne Parameter zeigt wieder das Erz.
- Bezeichner der Zustandsvariablen, Aufbau der Umschaltung (eigene
  Render-Funktion neben `renderDetail()` gegen Verzweigung innerhalb),
  Übergangsanimation, genaue Dämpfungswerte der Spurenzeilen.
- Wortlaut der deutschen und englischen Beschriftungen — die
  Build-Zeit-Paritätsprüfung (`S_DE`/`S_EN`, `src/components/MiningWorkbench.astro:200`)
  fängt einseitige Schlüssel ohnehin ab.
</decisions>

<canonical_refs>
## Verbindliche Bezugsdokumente

**Nachgelagerte Agenten müssen diese vor Planung und Umsetzung lesen.**

### Werkbank — Vorgeschichte und geltende Nebenbedingungen
- `.planning/phases/10-mining-presets-bedienbar-machen/CONTEXT.md` — die Reiter
  sind bewusst abgeschafft (beide Listen gleichzeitig sichtbar); zwei gleich
  aussehende Knöpfe mit gegensätzlicher Wirkung sind der teuerste Befund der
  Werkbank-Geschichte; `.wb__row2` rendert Fundorte UND Stationen
- `.planning/phases/09-mining-werkbank-fundort-merkliste/CONTEXT.md` — Zuschnitt
  der Fundort-Merkliste, Trennung Arbeitsstand (localStorage) gegen benanntes
  Preset (Konto)
- `.planning/notes/signaturliste-anheften.md` — die Messung hinter „zu klein war
  nie der Knopf, sondern die Kachel" (Grundlage für D-01)
- `.planning/ROADMAP.md` §Phase 12 — Zielbild und die vier ausdrücklichen
  Ausschlüsse

### Daten
- `assets/mining-db.json` → `bodies[]` — die 45 Fundorte, Datengrundlage dieser Phase
- `scripts/datamine-locations.mjs:96-180` — die Semantik von `chance`,
  `maxShare` und `eff`. Wer eine der drei Zahlen anders darstellt, muss hier
  gelesen haben, was sie bedeutet
- `scripts/verify-mining.mjs:62-83` — die bestehende Paarprüfung beider
  Richtungen; sie muss grün bleiben

### Hausregeln
- `.planning/codebase/CONVENTIONS.md`
- `docs/maschinelle-validierung.md` — was `npm run gate` prüft

**Kein externer Spec.** Der scmdb-Vergleich ist eine Beobachtung, kein
Bezugsdokument — die Gestaltung folgt dem Hausstandard.
</canonical_refs>

<code_context>
## Erkenntnisse aus dem Bestand

### Wiederverwendbar
- **`row2(main, sub, barPct, right, amber, mark, pinKey)`**
  (`assets/mining-workbench.js:212`) — dieselbe Zeilenform trägt heute Fundorte
  und Stationen und kann die Erzzeilen der neuen Ansicht ohne Umbau tragen.
  Der optionale siebte Parameter ist bereits das Muster für „nur diese Zeilenart
  bekommt das Zusatzelement".
- **`pctSub()` / `locSub()` / `locName()` (Zeilen 114–142)** — die Textbausteine
  für „x % Chance · bis y %" und „Art · System". Beide Richtungen sollen
  denselben Text zeigen; `pctSub()` wird schon von Fundortliste UND Merkliste
  genutzt.
- **Delegierter Klick-Handler (`assets/mining-workbench.js:765-850`)** — ein
  einziger `document`-Listener mit `inWb()`-Wächter und `closest()`-Kette. Der
  neue Klick reiht sich dort ein, kein zweiter Listener.
- **Deep-Link-Eintritt (Zeile 923)** — `URLSearchParams(location.search)`,
  bereits vorhanden für `?mineral=`.
- **`methodLabel()` (Zeile 149)** und die Ortsart-Beschriftungen `TYPE_LBL`
  (Zeile 125) — die Gruppenüberschriften und der Kopf brauchen nichts Neues.

### Geltende Muster
- **Zweisprachigkeit über `S_DE`/`S_EN`** mit Build-Zeit-Paritätsprüfung
  (`src/components/MiningWorkbench.astro:200-213`) — jeder neue Text braucht
  beide Schlüssel, sonst bricht der Build.
- **Werkzeug-Hilfe:** `scripts/verify-help.mjs` (Zusicherung 6) verlangt je
  `data-tool-id` eigene `data-help`-Anker. ⚠ Der Text `mining.ctl.locpin`
  (`src/i18n/help.ts:99` / `:304`) beschreibt die Fundort-Zeile heute als reinen
  Anheft-Ort — mit D-01 tut die Zeile zwei Dinge und der Text wird falsch. **Beide
  Sprachen nachziehen.**
- **Nur die Astro-Datei trägt inline-CSS**; die Theme-Generatoren sehen
  ausschließlich `<style>` in `.astro`. Neue Farbflächen brauchen eine
  Hell-Fassung, und `build-light-overrides.mjs` deckt **kein `background`** ab —
  für die Dämpfung der Spurenzeilen ist `currentColor`/Deckkraft der sichere Weg.
- **Bildlauf-Kästen** müssen in `assets/theme.css` **und** `mobile-ux.css`
  eingetragen sein, sonst versteckt die globale `!important`-Regel die Leiste.

### Anschlussstellen
- **`MiningWorkbench.astro:84-106`** baut `payload` aus `DB.minerals` —
  `DB.bodies` wird **nicht** mitgegeben. Die Nutzlast muss erweitert werden.
  ⚠ Seitengewicht messen: `mining-db.json` ist 124 KB, `bodies[]` ist die
  zweite Hälfte derselben 521 Paare. Eine Ableitung aus `minerals[].locs`
  im Browser wäre die Alternative — der Planer entscheidet, aber die Wahl ist
  zu begründen und zu beziffern.
- **`renderDetail()` (Zeile 227)** — heute die einzige Zeichenroutine der
  Mittelspalte.
- **Zustand `S` (Zeile 67)** `{sel, pins, locPins, ref, q, sys}` plus
  `localStorage` — die Ansichtsumschaltung braucht dort einen Platz.
- **`.wb__pane{overflow:hidden}`** — ⚠ ein Panel NEBEN die Spalte zu setzen ist
  eine vorgeführte Sackgasse. Die Fundort-Ansicht ersetzt den Inhalt der
  Mittelspalte, sie tritt nicht daneben.
</code_context>

<specifics>
## Konkrete Vorgaben

- **scmdb ist Informations-, nicht Gestaltungsvorbild.** Wörtlich: „vom Aussehen
  her halten wir uns an unsere Standards, aber ich wollte dir nur zeigen, was
  die so darstellen an Infos."
- **Kein Preis.** Vom Betreiber angezweifelt („ich glaube Preis ist unsinnig")
  und durch Nachsehen bestätigt: scmdb zeigt auf seiner Fundort-Seite selbst
  keinen. `assets/refinery-data.json` trägt zwar `sell` für 26 der 37 Erze —
  das bleibt für diese Phase ungenutzt.
- **Keine Gruppenanteile** („Ship Mining 51,0 %"). Deren Zahl rechnet Derelict
  Salvage und Debris mit; diese Grundmenge führen wir nicht. Ohne sie wäre der
  Anteil erfunden.
- **Keine Adernzahl** („3–5"). Steht nicht in unseren Daten. `deposits`
  (`scripts/datamine-locations.mjs:157`) zählt Felsarten und wird nicht einmal
  herausgeschrieben — es ist auch nicht dasselbe.
- **Spurenerze werden markiert, nicht ausgeblendet.** Bewusst anders als scmdb,
  das sie weglässt: „hier ist auch Taranit, aber nur in Spuren" ist mehr wert
  als eine geschönte Liste.

### Aus dem scmdb-Vergleich geprüft und verworfen — hier ist NICHTS zu reparieren
Zwei Abweichungen fielen beim Vergleich auf und wurden nachgelesen, bevor sie zu
einem Auftrag wurden:
1. Wir listen an Pyro Deep Space Asteroids **12 Erze, scmdb 7.** Die fünf
   fehlenden sind genau die mit Höchstanteil 5–10 % — scmdb blendet Spuren aus.
2. Aluminium steht bei uns auf **29,8 % Chance, bei scmdb auf 14,9 %.** Unsere
   Chance summiert über alle Felsarten, die das Erz führen (hier 2 × 14,9);
   das ist in `scripts/datamine-locations.mjs:97-107` so definiert und begründet.
   Das Mehrfach-Slot-Doppelzählen ist dort getrennt behandelt (Zeilen 130–149).

Beides ist ein Definitionsunterschied, kein Datenfehler. **Wer diese Phase
umsetzt, ändert an den Zahlen nichts.**
</specifics>

<deferred>
## Zurückgestellte Ideen

- **Eigene Fundort-Seiten** (45 × DE/EN = 90 statische Seiten, indexierbar und
  teilbar, wie es bei Item-Finder und Crafting den Ausschlag gab). Vorgelegt und
  vom Betreiber zugunsten der reinen Werkbank-Umschaltung verworfen. Bleibt der
  naheliegende nächste Schritt, falls Auffindbarkeit später wieder Thema wird —
  `?fundort=` (D-04) wäre die Brücke dorthin.
- **Preis am Fundort** („was hole ich hier am besten raus", `sell`/`sellMax`/
  `sellLoc` für 26 Erze). Bewusst draußen. Der offene Punkt „die Werkbank zeigt
  bis heute keinen Preis" bleibt damit offen.
- **Adernzahl je Erz und Fundort** — bräuchte eine Erweiterung der Extraktion
  (Slots je Element je Komposition herausschreiben). Eigene Datenphase.
- **Salvage- und Debris-Vorkommen** je Fundort — ein anderes Sachgebiet
  (Bergung), keine Erweiterung dieser Phase.

### Geprüfte, nicht übernommene Todos
- `signatur-liste-kontogebunden.md` („Angeheftete Signatur-Minerale kontogebunden
  speichern") — Trefferquote 0,6 über Stichwortähnlichkeit, inhaltlich aber
  bereits in Phase 9/10 erledigt. Nicht in diese Phase gefaltet.
</deferred>

---

*Phase: 12-fundorte-in-der-mining-werkbank-anklickbar*
*Kontext erhoben: 2026-08-15*
