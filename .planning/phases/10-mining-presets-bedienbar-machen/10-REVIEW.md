---
phase: 10-mining-presets-bedienbar-machen
reviewed: 2026-08-15T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - src/components/MiningWorkbench.astro
  - assets/mining-workbench.js
  - src/i18n/help.ts
  - tests/e2e/helpers/mining-dom.js
  - tests/e2e/mining-shortlist.test.js
findings:
  critical: 0
  high: 1
  medium: 1
  low: 3
  total: 5
status: issues_found
---

# Phase 10: Code-Review-Bericht

**Geprüft:** 15.08.2026
**Tiefe:** deep (inkl. Migrationen `20260812040000_mining_sig_presets.sql`/`20260815090000_mining_preset_locations.sql` als Kontext für RLS/Primärschlüssel)
**Geprüfte Dateien:** 5 (siehe oben)
**Umfang:** Commits `f10a69f`..`90e4d90` (Phase 10, beide Pläne)

## Zusammenfassung

Die fünf im Auftrag benannten Risikofelder wurden gezielt geprüft. Drei davon
sind sauber gelöst: die Umbenennen-Kodierung/409-Erkennung, die
Lösch-Rückfrage als Zustandsmaschine (kein Ziel-Verwechseln zwischen Klick 1
und Klick 2) und XSS/Selektor-Escaping. Ein echter Fund mit Datenintegritäts-
Charakter sitzt in `preRemoveEntry()`: ein klassisches Lost-Update bei zwei
schnell aufeinanderfolgenden Entfernungen aus demselben Feld desselben
Presets. Daneben ein PostgREST-spezifisches Detail (Filter `eq.null`), das
alle drei namensbasierten Schreibpfade (Umbenennen/Löschen/Einzeleintrag-
Entfernen) für ein Preset mit dem Literalnamen `null` unbemerkt wirkungslos
macht, während die Oberfläche trotzdem Erfolg meldet. Der Rest sind kleinere
Konsistenz- und Aufräum-Funde.

---

## 1. Umbenennen-Pfad (PATCH auf den Primärschlüssel)

**Befund: kein Fehler.**

- `preRename()` (`assets/mining-workbench.js:606`) baut den Pfad als
  `TBL + '?name=eq.' + encodeURIComponent(oldName)`. `encodeURIComponent`
  kodiert Leerzeichen, Komma, `&`, `=`, `%` und `"` korrekt weg; die von
  `encodeURIComponent` bewusst NICHT kodierten Zeichen (`. ! ~ * ' ( )`) haben
  in einem PostgREST-`eq.`-Filter keine Sonderbedeutung (der komplette Rest
  des Strings nach `eq.` ist der Wert, es wird nicht am `.` weiter
  gesplittet). Namen mit Leerzeichen, Komma, Punkt getestet — alle
  funktionieren.
- Die 409-Kollisionsbehandlung ist erreichbar: `if (r.status === 409)`
  (Zeile ~611) prüft den nativen `fetch`-`Response.status`, der bei einer
  Unique-Verletzung auf `(user_id, name)` von PostgREST tatsächlich als 409
  zurückgegeben wird (Primärschlüssel-UPDATE, keine Anwendungslogik dazwischen,
  die den Code verfälschen könnte). Die UPDATE-Politik der Migration
  `20260812040000_mining_sig_presets.sql:41-44` prüft ausschließlich
  `user_id`, nie `name` — der Rename-Pfad ist also nicht durch RLS blockiert,
  wie im Code-Kommentar behauptet.
- Fehlgeschlagenes Umbenennen (409 oder Netzwerkfehler) ruft **kein**
  `preLoad()` auf — der lokale `presets`-Cache bleibt unverändert, die Zeile
  zeigt weiterhin den alten, tatsächlich noch gültigen Namen. Es gibt hier
  keinen Pfad, der einen serverseitig nicht mehr existierenden Namen anzeigt.
- Autorisierung: Da im Query-String kein `user_id`-Filter steht, sichert
  ausschließlich RLS die Grenze zwischen Nutzern ab (`WHERE name=eq.'X' AND
  user_id=auth.uid()` wird von Postgres implizit UND-verknüpft). Ein
  Namenskonflikt mit dem Preset eines FREMDEN Nutzers kann diesen Pfad nicht
  erreichen — geprüft gegen die Politik-Definition, kein Finding.

Siehe aber Abschnitt 3 unten für eine verwandte, tatsächliche Schwäche
desselben Codes (kein Zeilen-Treffer-Check).

---

## 2. Zwei-Klick-Lösch-Bestätigung

**Befund: kein Fehler — die Zustandsmaschine ist robust gegen Ziel-Verwechslung.**

- Zustand `preAsk` (`assets/mining-workbench.js:451`) hält NUR den Namen der
  Zeile mit offener Rückfrage; der eigentliche Löschaufruf beim zweiten Klick
  liest das Ziel aber NICHT aus `preAsk`, sondern frisch aus dem DOM:
  `delOk.closest('[data-preset]').getAttribute('data-preset')`
  (Zeilen 702-707). Ein Klick trifft also strukturell immer genau das
  Element, an dem er tatsächlich stattfand — es gibt keinen Zwischenspeicher,
  der veralten könnte.
- Klick auf den Löschknopf einer ANDEREN Zeile B, während bei A eine
  Rückfrage offensteht: Zeile 709-714 (`delAsk`-Zweig) greift zuerst (B trägt
  noch `[data-pre-del]`, weil B nie in den Ask-Zustand versetzt wurde),
  setzt `preAsk = 'B'` und rendert neu — A verliert dabei seinen
  Rückfrage-Zustand vollständig (da `renderPresetList()` bei jedem Aufruf
  `preAsk === p.name` für JEDE Zeile neu auswertet). Von einem `test`-Fall
  exakt so abgedeckt (`tests/e2e/mining-shortlist.test.js:416`).
- „Klick daneben bricht ab": Zeile 723 (`if (preAsk) { preAsk = null;
  renderPresetList(); }`) läuft für JEDEN Klick innerhalb der Werkbank, der
  nicht selbst der Ask- oder Bestätigen-Button ist — noch VOR der
  Interpretation als Umbenennen/Auswahl/Aufklappen/Update/Einzeleintrag, and
  KEIN `return` danach. Re-Render nach Auswahlwechsel, Aufklappen etc.
  bestätigt konsistent den Reset.
- Das ursprüngliche Konstruktionsproblem aus CONTEXT.md (gleiches Zeichen `×`
  an gleicher Stelle für „Löschen" und „Abbrechen") ist strukturell behoben:
  Löschen nutzt jetzt ein Mülleimer-Symbol plus wortbeschriftete
  Vollbreiten-Rückfrage (`.wb__pre-ask`, `MiningWorkbench.astro:279-282`),
  `×` kommt nur noch im Umbenennen/Neu-Panel als „Abbrechen" vor
  (`MiningWorkbench.astro:363`) — räumlich und stilistisch getrennt vom
  Löschweg.

**Nebenbemerkung (nicht separat gezählt, siehe Fund 3):** Ist eine Zeile
gleichzeitig aufgeklappt (`preOpen`) UND im Ask-Zustand (`preAsk`), bleiben
die Einzeleintrag-Entfernen-Knöpfe im aufgeklappten Bereich unterhalb der
Rückfrage weiterhin klickbar (`renderPresetList()`, Zeile 467, `head`- und
`body`-Berechnung sind unabhängig voneinander). Ein Klick auf einen solchen
Knopf bricht die Rückfrage ab UND entfernt den Eintrag — das ist exakt das
dokumentierte „Klick daneben" -Verhalten, keine Abweichung vom Entwurf, aber
in der Kombination beider Zustände leicht überraschend. Nicht als eigener
Befund gezählt, da durch die CONTEXT.md-Entscheidung gedeckt.

---

## 3. Einzeleintrag-Entfernen per gezieltem PATCH

### HIGH — Lost-Update bei zwei schnellen Entfernungen aus demselben Feld

**Datei:** `assets/mining-workbench.js:574-587` (`preRemoveEntry`), Aufrufer
`assets/mining-workbench.js:766-777`

**Befund:** `preRemoveEntry(name, field, value)` berechnet das neue Array
IMMER aus dem zuletzt per `preLoad()` geladenen, lokal gecachten
`presets`-Array (Zeile 578-580: `for (...) if (presets[i].name === name)
{ preset = presets[i]; break; }`), nicht aus einer frischen Serverabfrage.
Dieses lokale Array wird erst NACH erfolgreichem `PATCH` durch
`return preLoad();` aktualisiert (Zeile 584) — asynchron, nach einem echten
Netzwerk-Umlauf.

Es gibt keine Sperre, kein „busy"-Flag und keine Deaktivierung der
Entfernen-Knöpfe während dieses Umlaufs (`grep busy|pending|disabled\s*=\s*true`
liefert außerhalb des Presets nichts Einschlägiges).

**Konkretes Ausfallszenario:** Ein Preset „A" trägt in `minerals`
`['Gold', 'Quantainium', 'Aphorite']`. Der Nutzer klappt es auf und klickt in
schneller Folge zwei „×"-Knöpfe im selben Feld, z. B. erst bei „Gold", dann
sofort bei „Quantainium" (noch bevor der erste `PATCH`-Request zurück ist —
ein plausibler Doppelklick-artiger Bedienfall, gerade weil die UI keinerlei
Sperr-Rückmeldung zeigt):

1. Klick 1 liest `presets` (noch `['Gold','Quantainium','Aphorite']`),
   berechnet `next = ['Quantainium','Aphorite']`, schickt `PATCH
   {minerals: ['Quantainium','Aphorite']}`.
2. Klick 2 liest — weil `presets` noch NICHT durch `preLoad()` aus Klick 1
   aktualisiert wurde — denselben alten Stand, berechnet `next =
   ['Gold','Aphorite']`, schickt `PATCH {minerals: ['Gold','Aphorite']}`.
3. Beide `PATCH`-Aufrufe ersetzen das GESAMTE Feld (kein `array_remove` auf
   Serverseite, volle Feldüberschreibung). Je nachdem, welcher Request
   zuletzt beim Server ankommt, gewinnt entweder `['Quantainium','Aphorite']`
   oder `['Gold','Aphorite']` — in jedem Fall geht EINE der beiden vom Nutzer
   angestoßenen Entfernungen verloren, und das entfernt geglaubte Erz taucht
   nach dem folgenden `preLoad()` wieder auf.

Das ist exakt der in der Aufgabenstellung benannte Lost-Update-Fall
(„zwei rapide Entfernungen, beide aus einem stale Snapshot berechnet"). Die
Testsuite deckt diesen Fall nicht ab — `tests/e2e/mining-shortlist.test.js:634`
prüft nur eine einzelne, isolierte Entfernung pro Testfall.

Bei UNTERSCHIEDLICHEN Feldern (ein Klick auf einen Erz-Entfernen-Knopf, der
zweite auf einen Fundort-Entfernen-Knopf desselben Presets) tritt der Effekt
NICHT auf, weil `PATCH` mit `{minerals: [...]}` bzw. `{locations: [...]}`
jeweils nur die genannte Spalte setzt und die andere unberührt lässt — das
Risiko ist auf „zwei Entfernungen im selben Feld desselben Presets, dicht
hintereinander" begrenzt, aber real und leise (kein Fehlertext, keine
sichtbare Warnung; die zweite Rückmeldung lautet weiterhin „Gespeichert.").

**Fix (Vorschlag):** Entweder (a) den betroffenen Entfernen-Knopf sofort
serverseitig sperren/`disabled` setzen, bis der zugehörige `PATCH`
zurückkehrt, oder (b) `preRemoveEntry()` gegen ein serverseitig aktuelles
Array patchen lassen (z. B. per Postgres-Funktion `array_remove`, die serverseitig
auf dem tatsächlich gespeicherten Array arbeitet statt auf einem
client-seitig berechneten vollständigen Ersatz), oder (c) minimal: eine
modulweite Warteschlange/`inFlight`-Markierung pro `(name, field)`, die einen
zweiten Klick auf dasselbe Feld erst nach Abschluss des ersten `PATCH`
zulässt bzw. dessen Berechnungsbasis aktualisiert.

```js
// Minimalvariante (c): Klicks auf dasselbe (name, field) serialisieren,
// bis der laufende PATCH zurueck ist.
var preRmBusy = {}; // key = name + ' ' + field
function preRemoveEntry(name, field, value) {
  var key = name + ' ' + field;
  if (preRmBusy[key]) return; // zweiter Klick waehrend des ersten PATCH: ignorieren
  var preset = null;
  for (var i = 0; i < presets.length; i++) if (presets[i].name === name) { preset = presets[i]; break; }
  if (!preset) return;
  var next = (preset[field] || []).filter(function (v) { return v !== value; });
  var body = {};
  body[field] = next;
  preRmBusy[key] = true;
  return window.VBAccount.rest(preSess, 'PATCH', TBL + '?name=eq.' + encodeURIComponent(name), body)
    .then(function (r) {
      delete preRmBusy[key];
      if (!r.ok) { preSay(T.presetFail, 4000); return; }
      preSay(T.presetSaved);
      return preLoad();
    })
    .catch(function () { delete preRmBusy[key]; preSay(T.presetFail, 4000); });
}
```

**Bestätigt fehlerfrei:** Der Aufruf mutiert weder `S.pins` noch
`S.locPins` und ruft nirgends `preApply()` auf (Zeilen 574-587 lesen und
schreiben ausschließlich `presets[i]` und den `PATCH`-Rumpf) — die
CONTEXT.md-Vorgabe „Ansehen/Ausdünnen ändert nie den Arbeitsstand" ist
eingehalten.

---

## 4. XSS

**Befund: kein Fehler.**

- `esc()` (`assets/mining-workbench.js:89-93`) escaped `&`, `<`, `>`, `"` —
  ausreichend für alle Stellen im Bauteil, da AUSNAHMSLOS doppelte
  Anführungszeichen für Attributwerte verwendet werden (kein `'`-quotierter
  Attributwert im gesamten Diff, ein einfaches Anführungszeichen im
  Presetnamen kann daher nichts aufbrechen).
- Jede Einspeisung eines Preset-Namens läuft durch `esc()`: `data-preset`
  (`renderPresetList()`, Zeile ~508), sichtbarer Name (Zeile ~510),
  Zähl-Text `cnt` (der selbst wieder `T.signatures`/`T.locations` enthält —
  unproblematisch, feste Übersetzungstexte), `data-pre-rmmin`/`data-pre-rmloc`
  (Zeilen ~495/~499), `aria-label`-Werte.
- Eigener Testfall bestätigt das explizit gegen alle vier von `esc()`
  abgedeckten Zeichen inkl. Anführungszeichen im Attributwert:
  `tests/e2e/mining-shortlist.test.js:673`
  („T-10-01: ein Preset-Name mit HTML-Sonderzeichen landet escaped im
  Markup").
- `title=`-Attribute (`renderPresetList()`, z. B. Zeile ~483) tragen
  ausschließlich feste Übersetzungstexte (`T.presetHide`/`T.presetShow`),
  keine Nutzereingabe — dennoch ebenfalls durch `esc()` geführt.

---

## 5. Escaping/Quoting in Selektoren

**Befund: kein Fehler.**

Der Code baut an KEINER Stelle einen Wert-Selektor wie
`[data-preset="' + name + '"]` aus einem Preset-Namen zusammen. Jeder Zugriff
läuft über `t.closest('[data-preset]')` (reine Attribut-Anwesenheit, keine
Wertprüfung) und liest den tatsächlichen Namen erst danach über
`.getAttribute('data-preset')` aus dem gefundenen Element (Zeilen 706, 713,
732, 738, 749, 761, 768, 774). Ein Preset-Name mit `"`, `[`, `]` oder anderen
CSS-Sonderzeichen kann diesen Mechanismus dadurch strukturell nicht brechen.

---

## Weitere Funde

### MEDIUM — Kein Treffer-Check bei PATCH/DELETE: „Erfolg" auch bei null Zeilen; `eq.null`-Falle bei Presetnamen „null"

**Dateien:** `assets/mining-workbench.js:589-596` (`preDrop`), `574-587`
(`preRemoveEntry`), `606-618` (`preRename`)

**Befund:** Alle drei namensbasierten Schreibpfade prüfen ausschließlich
`r.ok`/`r.status`, nie die Anzahl tatsächlich betroffener Zeilen. Der
`Prefer`-Header wird für diese Aufrufe nicht gesetzt und fällt in
`assets/account-lite.js:66` auf `count=none` zurück — PostgREST liefert bei
einem `PATCH`/`DELETE`, das null Zeilen trifft, trotzdem HTTP 200/204 (kein
404, kein Fehler). Der Client kann „echt geändert" von „nichts getroffen"
nicht unterscheiden und zeigt in beiden Fällen die Erfolgsmeldung
(„Umbenannt.", „Gelöscht.", „Gespeichert.").

**Konkretes Ausfallszenario 1 (Cross-Device-Race):** Nutzer hat die Werkbank
in zwei Tabs/Geräten offen. Tab 1 löscht Preset „X". Tab 2 (noch mit dem
alten, gecachten `presets`-Array) klickt „Umbenennen" auf „X" → `PATCH
?name=eq.X` trifft null Zeilen, Antwort ist trotzdem `ok`, UI meldet
„Umbenannt." — tatsächlich ist nichts passiert, das Preset bleibt gelöscht,
der Nutzer glaubt es existiere unter dem neuen Namen.

**Konkretes Ausfallszenario 2 (PostgREST-Spezialwert `null`):** PostgREST
interpretiert den LITERALEN String `null` in einem `eq.`-Filter standardmäßig
als `IS NULL`-Test, nicht als Gleichheit mit dem Text „null" (dafür wäre
`eq."null"` mit Anführungszeichen nötig — dieser Client quotiert nie). Legt
ein Nutzer ein Preset exakt „null" an (per `preSave()`, das den Namen im
JSON-Body schickt, dort unproblematisch), erzeugt jeder spätere Versuch,
dieses Preset umzubenennen, zu löschen oder einen Eintrag daraus zu
entfernen, den Filter `?name=eq.null`. Da die Spalte `name` per Migration
`not null` ist, trifft `WHERE name IS NULL` grundsätzlich keine Zeile — der
Aufruf läuft „erfolgreich" ins Leere, das Preset „null" lässt sich über
dieses Bauteil dauerhaft weder umbenennen noch löschen noch ausdünnen, ohne
dass die Oberfläche das je meldet.

**Einordnung:** Beide Szenarien sind Rand-/Sonderfälle (Mehrgeräte-Race bzw.
ein sehr spezieller Presetname), aber sie widersprechen direkt dem im
Projekt selbst formulierten Grundsatz „scheitert es laut statt still"
(Kommentar zur 128-Paar-Grenze in `preSave()`, `assets/mining-workbench.js:559`)
— hier scheitert es still und meldet sogar fälschlich Erfolg.

**Fix (Vorschlag):** `Prefer: return=representation` (oder minimal
`count=exact` samt Auswertung des `Content-Range`-Headers) für
`PATCH`/`DELETE` in den drei Presets-Funktionen anfordern und bei null
betroffenen Zeilen `T.presetFail` statt der Erfolgsmeldung zeigen. Für den
`eq.null`-Fall zusätzlich (unabhängig vom obigen Fix) den Namen im
Query-String zu quotieren oder — einfacher — beim Anlegen eines Presets den
Namen „null" (case-insensitive) clientseitig abzulehnen, analog zur
bestehenden Längenprüfung.

---

### LOW — `preOpen` (Aufklapp-Zustand) folgt dem Umbenennen nicht

**Datei:** `assets/mining-workbench.js:606-618` (`preRename`), vgl. `451-452`

**Befund:** `preRename()` aktualisiert nach erfolgreichem Umbenennen zwar
`preCur` (Zeile ~614: `if (preCur === oldName) preCur = newName;`), aber
NICHT `preOpen`. War eine Preset-Zeile aufgeklappt (Einzeleintrag-Ansicht
sichtbar) und wird genau dieses Preset umbenannt, referenziert `preOpen`
danach weiterhin den alten Namen; `renderPresetList()` prüft pro Zeile
`preOpen === p.name` (Zeile ~505) — für die jetzt unter dem neuen Namen
geführte Zeile ist das `false`, die aufgeklappte Ansicht klappt beim
folgenden Render also unbemerkt zu.

**Ausfallszenario:** Nutzer klappt Preset „Pyro-Runde" auf, um einen Eintrag
zu entfernen, benennt es aber zuerst versehentlich um in „Pyro-Runde v2" —
die aufgeklappte Liste verschwindet ohne erkennbaren Grund, der Nutzer muss
erneut auf die Zählzeile klicken. Kein Datenverlust, reine
Bedien-Inkonsistenz.

**Fix:** In `preRename()` analog zu `preCur` behandeln:
`if (preOpen === oldName) preOpen = newName;` vor `return preLoad();`.

---

### LOW — Toter Übersetzungs-Schlüssel im Test-Mock

**Datei:** `tests/e2e/helpers/mining-dom.js:217`

**Befund:** `scanPlaceholder: 'SCAN'` steht weiterhin im Mock-Sprachobjekt
`buildPayload()`, obwohl der Schlüssel `scanPlaceholder` in Plan 02 aus
`S_DE`/`S_EN` (`src/components/MiningWorkbench.astro`) und aus jedem
produktiven Verwendungsort entfernt wurde (`#wb-scan` existiert nicht mehr).
Funktional folgenlos (unbenutzter Objekt-Key), aber eine der in Plan 02
selbst dokumentierten Aufräumarbeiten wurde hier unvollständig durchgeführt.

**Fix:** Zeile in `buildPayload()` streichen.

---

### LOW — Veralteter Kommentar referenziert entfernte Funktion `preFill`

**Datei:** `tests/e2e/helpers/mining-dom.js:410`

**Befund:** Der Docstring von `flush()` nennt noch
„`session().then(preLoad).then(preFill)`" — `preFill()` wurde in Plan 01
vollständig durch `renderPresetList()` ersetzt (siehe
`10-01-SUMMARY.md`, Abschnitt „Files Modified"). Rein kosmetisch,
irreführend für künftige Leser.

**Fix:** `preFill` durch `renderPresetList` ersetzen.

---

## Nicht geprüft / außerhalb des Auftrags

- Sichttauglichkeit (Farben, Abstände, Warnschraffur im echten Browser) —
  laut `10-01-SUMMARY.md`/`10-02-SUMMARY.md` bewusst als menschliches Urteil
  zurückgestellt (WINDOWS.md id 11), kein Gegenstand dieser Quellcode-Review.
- Performance (z. B. dass `renderAll()` jetzt bei jeder Interaktion auch
  `renderPresetList()` neu zeichnet, selbst wenn sich an den Presets nichts
  geändert hat) — laut Auftrag ausdrücklich außerhalb des Scopes v1.

---

_Geprüft: 15.08.2026_
_Reviewer: Claude (gsd-code-reviewer)_
_Tiefe: deep_
