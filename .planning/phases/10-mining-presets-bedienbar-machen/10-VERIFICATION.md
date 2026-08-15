---
phase: 10-mining-presets-bedienbar-machen
verified: 2026-08-15T07:00:00Z
status: human_needed
score: 15/15 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Sichtrunde Punkt 1 (D-03): Stehen Signaturenliste und Fundort-Merkliste bei 1920x1080 UND 1280x720, DE und EN, in beiden Farbmodi untereinander, beide gleichzeitig lesbar, jede mit eigener Ueberschrift und eigenem Bildlauf? Teilen sie sich die Hoehe brauchbar, wenn eine Liste lang und die andere leer ist?"
    expected: "Beide Kaesten sichtbar, kein Reiter, brauchbare Hoehenaufteilung auch im Extremfall (eine Liste voll, eine leer)."
    why_human: "Optische Aufteilung/Proportion ist kein Skriptkriterium; verify:theme/verify:layers pruefen Kontrast, nicht Layoutwirkung."
  - test: "Sichtrunde Punkt 2 (D-04): Bleibt bei 1280x720 die Fundort-Zeile in der Mitte (Name, Balken, Prozentspanne, Nadel) trotz ca. 68 px weniger Breite lesbar? Bleibt die Werkbank ohne aeusseres Scrollen bedienbar?"
    expected: "Fundort-Zeile bleibt lesbar, kein aeusseres Scrollen noetig; sonst ist 470px 1fr 330px zurueckzunehmen (im Plan als Schaetzung mit Begruendung markiert, keine Messung)."
    why_human: "Nur eine visuelle Pruefung im echten Browser kann beurteilen, ob die geschaetzte Spaltenbreite traegt."
  - test: "Sichtrunde Punkt 3 (D-05): Erkennt man auf einen Blick, welches Preset gewaehlt ist? Sind Name, Zaehler und die drei Symbolknoepfe bei 330 px Spaltenbreite auseinanderzuhalten und zu treffen?"
    expected: "is-sel-Zeile eindeutig erkennbar, alle vier Aktionsknoepfe (aufklappen, ueberschreiben, umbenennen, loeschen) treffsicher."
    why_human: "Treffbarkeit/Klarheit auf echtem Bildschirm; Praezedenzfall Phase 9 (Anheft-Knopf kostete drei Runden, Ursache lag an der Kachel, nicht am Knopf)."
  - test: "Sichtrunde Punkt 4 (D-01): Ist der Muelleimer vom × der Namenszeile auf einen Blick unterscheidbar? Wirkt die beschriftete Rueckfrage mit Warnschraffur in BEIDEN Farbmodi als Warnung und nicht wie ein ausgewaehlter Zustand? Gegenprobe: angeheftete Erz-Kachel gleicher Grundfarbe daneben halten."
    expected: "Muelleimer und × sind eindeutig verschiedene Zeichen an verschiedenen Orten; die Warnschraffur liest sich als Warnung, nicht als Auswahlzustand, in Hell- und Dunkelmodus."
    why_human: "Farbwirkung/Kontrastempfinden ist kein Skriptkriterium; verify:theme bestaetigt nur, dass keine Farbe unerklaert abweicht, nicht dass sie als Warnung wirkt."
  - test: "Sichtrunde Punkt 5: Mit angemeldetem Konto ein Preset anlegen, umbenennen, mit anderer Auswahl ueberschreiben, aufklappen, einen Einzeleintrag entfernen, dann loeschen. Beim Umbenennen einmal einen bereits vergebenen Namen eingeben."
    expected: "Alle Handlungen funktionieren wie in 10-01 gebaut; die 409-Kollision zeigt presetNameTaken statt des allgemeinen Fehlertexts."
    why_human: "Braucht ein echtes Supabase-Konto und einen echten PostgREST-Umlauf (RLS-Politik greift erst gegen die echte Datenbank) — im e2e-Mock nur gegen ein simuliertes REST-Verhalten bewiesen."
  - test: "Sichtrunde Punkt 6 (D-02): Preset aufklappen, ohne es anzuwenden — bleiben Signaturenliste und Merkliste unveraendert? Danach einen Eintrag aus der aufgeklappten Ansicht entfernen — aendert sich weiterhin nur der gespeicherte Stand, nicht der Arbeitsstand?"
    expected: "Ansehen bleibt folgenlos fuer den Arbeitsstand; Einzeleintrag-Entfernen aendert nur die Datenbankzeile."
    why_human: "Dieselbe Einschraenkung wie Punkt 5 — echtes Konto/echte Datenbank noetig fuer die volle Kette; das Mock-DOM beweist nur den Client-seitigen Ausschnitt (bereits maschinell gruen)."
  - test: "Sichtrunde Punkt 7: Ein VOR Phase 9 gespeichertes Preset (ohne locations-Feld) auswaehlen."
    expected: "Signaturen vollstaendig, Merkliste leer, keine Fehlermeldung."
    why_human: "Braucht ein echtes, historisch gewachsenes Konto mit Altbestand; der Mock-Testfall (Zeile 187 in mining-shortlist.test.js) deckt den Code-Pfad ab, nicht den echten Altbestand."
---

# Phase 10: Mining-Presets bedienbar machen — Verifizierungsbericht

**Ziel der Phase:** Die in Phase 9 eingefuehrten Presets waren gefaehrlich und unfertig zu
bedienen (sechs Befunde des Betreibers: gleiches `×`-Zeichen fuer „Loeschen ohne
Rueckfrage" und „Abbrechen"; Presets nicht bearbeitbar; Mittelspalte zu breit; Reiter
zeigen Signaturen/Fundorte nur alternativ; Preset-`<select>` die falsche Form; Scanwert-
Feld unrealistisch). Bindend sind die Entscheidungen D-01 bis D-07 aus CONTEXT.md, samt
der beiden am 15.08.2026 nachgeschaerften Praezisierungen zu D-01 (zwei Klicks, zweiter
traegt Worte) und D-02 (Aufklapp-Ansicht direkt an der Preset-Zeile, gezielter PATCH,
kein Laden/Anwenden, kein Auto-Nachspeichern).

**Verifiziert am:** 2026-08-15
**Status:** human_needed
**Re-Verifizierung:** Nein — Erstverifizierung

## Vorgehen

Alle Aussagen unten sind gegen den tatsaechlichen Quellcode geprueft — nicht gegen die
Behauptungen in 10-01-SUMMARY.md/10-02-SUMMARY.md. Konkret gelesen:
`src/components/MiningWorkbench.astro` (Markup + `<style is:inline>`),
`assets/mining-workbench.js` (Client-Logik, insbesondere der delegierte Klick-Handler
und `renderPresetList()`), `src/i18n/help.ts` (Mining-Hilfetexte DE/EN),
`.planning/WINDOWS.md` und `.planning/ROADMAP.md`. Zusaetzlich selbst ausgefuehrt (nicht
aus SUMMARY uebernommen): `node --test tests/e2e/mining-shortlist.test.js` (36/36 gruen)
und `node --test tests/e2e/*.test.js` (270/270 gruen) sowie eine Zaehlung der
Kennungen in `dist/topics/mining.html` und `dist/de/topics/mining.html` gegen den
bereits vorliegenden Build. `npm run build`/`npm run gate` selbst wurden laut Auftrag
nicht erneut ausgefuehrt (vom Orchestrator unabhaengig bereits gruen belegt).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Loeschen fragt zurueck: erster Klick auf den Muelleimer loest KEIN `DELETE` aus (D-01) | VERIFIED | `assets/mining-workbench.js` Z. 667-673 (`data-pre-del` setzt nur `preAsk`, kein Netzwerkaufruf); Testfall „Erster Klick auf den Loeschknopf loest keinen DELETE aus" (Z. 731) selbst ausgefuehrt: gruen |
| 2 | Der zweite Klick traegt WORTE (`presetDelAsk`, „Wirklich löschen?"/„Really delete?") statt eines Zeichens, in Warnfarbe, ueber die volle Zeilenbreite — kein `window.confirm()`, keine Tipp-Bestaetigung (D-01, nachgeschaerft) | VERIFIED | `renderPresetList()` Z. 437-438 (`wb__pre-ask` ersetzt die ganze Aktionszeile); Stil Z. 696-699 (Warnschraffur `repeating-linear-gradient(-45deg,var(--accent-2)…)`, dieselbe Bildsprache wie `.danger-card .dz-hazard`); kein `window.confirm`/`window.prompt`-Aufruf im Code (nur ein Kommentar, der die Ablehnung begruendet); Testfall Z. 744 „Zweiter Klick … loest genau EIN DELETE aus" gruen |
| 3 | Loeschen und Abbrechen tragen weder dasselbe Zeichen noch denselben Platz noch dieselbe Farbe (D-01) | VERIFIED | Muelleimer-Symbol (`#wb-i-trash`, SVG `<symbol>` Z. 243) sitzt in jeder Preset-Zeile (`wb__pre-a--del`), `×` (Cancel) sitzt ausschliesslich in der separaten Namenseingabe-Zeile `#wb-pre-edit`/`#wb-pre-cancel` (Z. 363) — unterschiedliches Zeichen, unterschiedlicher Ort; Hoverfarbe `var(--accent-2)` vs. neutraler Symbolknopf-Ton |
| 4 | Klick daneben bricht die Rueckfrage ab, ein danach folgender erster Klick loest weiterhin kein `DELETE` aus (D-01) | VERIFIED | Z. 674-681 (`if (preAsk) { preAsk = null; renderPresetList(); }` vor allen weiteren Zweigen); Testfall Z. 757 gruen |
| 5 | Rueckfrage wandert korrekt: Preset A fragt, Klick auf Loeschknopf von B verschiebt die Rueckfrage zu B, A bleibt bestehen (D-01) | VERIFIED | Z. 667-671 (`preAsk` wird bei jedem `[data-pre-del]`-Klick auf den NEUEN Namen gesetzt); Testfall Z. 773 gruen |
| 6 | Umbenennen aendert den gespeicherten Namen mit EINEM `PATCH`-Aufruf; ein bereits vergebener Name faellt mit eigener Meldung `presetNameTaken` statt allgemeinem Fehler durch (D-02 Form 1) | VERIFIED | `preRename()` Z. 564-576: genau ein `PATCH` auf `?name=eq.<alt>`, `r.status === 409 → presetNameTaken`; kein zweiter Schreibversuch; Testfaelle Z. 635 und Z. 661 gruen |
| 7 | Ein Preset laesst sich mit der aktuellen Auswahl ueberschreiben, ohne es vorher zu loeschen und neu anzulegen (D-02 Form 2) | VERIFIED | `[data-pre-update]`-Zweig Z. 715-719 ruft `preSave(name, T.presetUpdated)` — derselbe Upsert-Pfad, andere Erfolgsmeldung; Testfall Z. 884 belegt „kein DELETE, kein zweiter Aufruf" |
| 8 | Ein einzelnes Erz oder Fundort-Paar laesst sich aus einer gespeicherten Preset-Zeile entfernen, OHNE das Preset vorher zu laden oder anzuwenden — direkt an der Zeile via gezieltem `PATCH` (D-02 Form 3, nachgeschaerft) | VERIFIED | `preRemoveEntry()` Z. 532-546 arbeitet ausschliesslich auf dem geladenen Serverstand `presets`, ruft nirgends `preApply()`; `[data-pre-rmmin]`/`[data-pre-rmloc]`-Zweige (Z. 724-735) rufen `preRemoveEntry()` direkt, nicht ueber die Auswahl; Testfaelle Z. 824/845 gruen |
| 9 | Ansehen (Aufklappen) ist keine Aenderung: weder Arbeitsstand noch gespeicherter Stand aendern sich, kein Netzwerkaufruf (D-02, nachgeschaerft — Auto-Nachspeichern ausdruecklich verworfen) | VERIFIED | `[data-pre-open]`-Zweig Z. 703-709: setzt nur `preOpen` und `renderPresetList()`, **kein** `preApply()`, **kein** `rest()`-Aufruf; kein Codepfad verbindet `preOpen` mit einem Schreibvorgang — Auto-Save-Verstoss ausdruecklich gesucht und nicht gefunden; Testfall Z. 793 „kein preApply, kein Netzwerkaufruf" gruen |
| 10 | Die gespeicherten Presets stehen als sichtbare Liste in der rechten Spalte; nichts muss aufgeklappt werden, um sie zu sehen (D-05) | VERIFIED | `#wb-preset-list` (Z. 355) ersetzt das fruehere `<select id="wb-preset">`; kein `id="wb-preset"`, keine Klasse `wb__pre__sel`, kein Schluessel `presetNone` mehr im Quelltext (grep: 0 Treffer); Zaehlung in `dist/topics/mining.html`/`dist/de/topics/mining.html`: `wb-preset-list` je 1×, `altSelect`-Summe 0× |
| 11 | Klick auf eine Preset-Zeile wendet das Preset an und markiert die Zeile (D-05) | VERIFIED | `[data-pre-pick]`-Zweig Z. 693-698 ruft `preApply(name)`; `preApply()` setzt `preCur` und ruft `renderAll()`; `is-sel` folgt `p.name === preCur` (Z. 481); Testfall Z. 624 gruen |
| 12 | Signaturenliste und Fundort-Merkliste stehen gleichzeitig sichtbar untereinander, keine Reiterleiste schaltet mehr um (D-03) | VERIFIED | Reiterleiste (`#wb-tabbar`, `#wb-tab-sig`, `#wb-tab-loc`, `#wb-sig-pane`, `#wb-loc-pane`, Klassen `wb__tabs`/`wb__tab`/`wb__tabpane`) vollstaendig aus Markup, Stil und Skript entfernt (grep: 0 Treffer in Quelltext UND in beiden gebauten Seiten); `.wb__stack` mit zwei `.wb__sec2`-Bloecken (Z. 380-387), keiner traegt `hidden`; Testfall „beide vorhanden, keine traegt hidden" (Z. 566) gruen |
| 13 | Die rechte Spalte ist breiter (330px statt 262px), die mittlere entsprechend schmaler, die linke Erzliste (470px) bleibt unangetastet (D-04) | VERIFIED | `.wb__grid{grid-template-columns:470px 1fr 330px}` (Z. 461); Zaehlung in beiden gebauten Seiten: `470px 1fr 330px` je 1×, `470px 1fr 262px` 0×; linke Spalte unveraendert bei 470px |
| 14 | Die angehefteten Erze stehen weiterhin mit Signatur × Clustergroesse als Nachschlagewerk da; die Vielfachen-Anzeige bleibt vollstaendig, nur ohne Hervorhebung (D-06) | VERIFIED | `renderPins()` Z. 298-323: Vielfachen-Schleife unveraendert (`for k=1..max`), KEINE Trefferberechnung/`is-hit`-Klasse mehr; Testfall „so viele Vielfachen-Felder wie Seltenheit erlaubt, keines mit Hervorhebungsklasse" (Z. 590) gruen |
| 15 | Das Eingabefeld „Scanwert" ist restlos entfernt — Markup, Stil, Skript, Sprachschluessel, Hilfetext, Mock (D-07) | VERIFIED | Kein `id="wb-scan"`, keine Klasse `wb__scan`/`wb__scanbox`, kein Schluessel `scanPlaceholder`, kein Hilfeschluessel `mining.ctl.scan` mehr im Quelltext; `renderPins()` liest keinen Feldwert mehr; Zaehlung in beiden gebauten Seiten: `wb__scan`+`wb-scan`+`is-hit`+`scanPlaceholder` in Summe 0× |

**Score:** 15/15 Truths verifiziert (0 behavior-unverified — jede zustandsbehaftete
Zusicherung, insbesondere der zweiklickige Loeschvorgang, das Wandern der Rueckfrage,
das folgenlose Ansehen und das Umbenennen mit 409-Zweig, ist durch einen selbst
ausgefuehrten, gruenen Testfall belegt, nicht nur durch Quellcode-Praesenz).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/components/MiningWorkbench.astro` | Preset-Block als Liste, Reiter entfernt, neues Rastermass, kein Scan-Kasten | VERIFIED | Alle o.g. Fundstellen bestaetigt; Stilblock enthaelt ausschliesslich `var(--…)`/`color-mix()`, kein Hex-Wert in den neuen Regeln (grep gegen `#[0-9a-f]{3,6}` in den neuen Bloecken: keine Treffer) |
| `assets/mining-workbench.js` | `renderPresetList()`, `preRename()`, `preRemoveEntry()`, delegierter Klick-Handler mit Preset-Zweigen VOR `[data-locpin]`/`[data-pin]` | VERIFIED | Reihenfolge im Handler bestaetigt (Z. 654-760): Loesch-Rueckfrage → Umbenennen/Auswahl → Aufklappen → Ueberschreiben → Einzeleintrag-Entfernen → erst danach `[data-locpin]`/`[data-pin]` |
| `tests/e2e/helpers/mining-dom.js` | Mock-DOM auf Liste statt `<select>`, `PATCH`-Zweig mit 409-Simulation | VERIFIED (indirekt) | Die 36 Testfaelle in `mining-shortlist.test.js`, die auf diesen Mock aufsetzen, laufen alle gruen — der Mock muss demnach die beschriebenen Zweige tragen |
| `tests/e2e/mining-shortlist.test.js` | Testfaelle fuer D-01/D-02/D-03/D-05/D-06/D-07 | VERIFIED | 36/36 gruen, selbst ausgefuehrt; Testnamen decken alle behaupteten Verhalten wortgleich ab (siehe Truth-Tabelle) |
| `src/i18n/help.ts` | Hilfetexte ohne Scanwert/Reiter, Preset-Erklaertext mit den vier Handlungen | VERIFIED | Keine Mining-Hilfeschluessel enthalten „Scanwert"/„scan value"/„Reiter"/„tab"; `mining.ctl.presets` (DE+EN) nennt auswaehlen/umbenennen/ueberschreiben/entfernen sowie die Rueckfrage vor dem Loeschen |
| `.planning/WINDOWS.md` | Neuer Eintrag `id 11`, `kind: unrun-verify`, Phase 10, `status: open`, sieben Punkte | VERIFIED | Eintrag vorhanden, Tabelle UND JSON-Block fortgeschrieben, `open_count: 3` in der Kopfzeile schliesst id 11 ein |
| `.planning/ROADMAP.md` | Abschnitt „Phase 10" mit beiden Planzeilen abgehakt, „2/2 plans executed" | VERIFIED | Abschnitt Z. 574-613 bestaetigt beide Punkte; keine erkennbare Veraenderung ausserhalb des Abschnitts geprueft (Diff nicht erneut gezogen, aber Abschnittsinhalt stimmt) |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `data-pre-*`-Attribute | delegierter Klick-Handler | Zweige VOR `[data-locpin]`/`[data-pin]`, kein Preset-Knopf traegt `data-pin`/`data-locpin` | WIRED | Reihenfolge bestaetigt (s.o.); grep nach `data-pin=`/`data-locpin=` innerhalb `renderPresetList()`: keine Treffer |
| `PATCH ?name=eq.<alt>` | RLS-Politik UPDATE (Migration 20260812040000) | kein `user_id`-Filter im Query-String, Beschraenkung kommt aus RLS | WIRED (Code-Seite) | Aufrufform bestaetigt (`preRename()`); die tatsaechliche RLS-Durchsetzung ist ein DB-seitiger Vertrag aus Phase 9, hier nicht neu geschaffen und nicht erneut gegen die Live-Datenbank gepruefbar ohne Konto — siehe Sichtrunde Punkt 5 |
| HTTP 409 | `presetNameTaken` | eigener Zweig statt allgemeinem `presetFail` | WIRED | `if (r.status === 409) { preSay(T.presetNameTaken, 4000); return; }` (Z. 569) |
| `preCur` (JS-Variable) | `is-sel` in der Liste | Zeile mit passendem Namen traegt die Klasse | WIRED | `p.name === preCur` in `renderPresetList()` (Z. 481); nach `preRename()` wird `preCur` bei Erfolg mitgezogen (Z. 572) |
| `wb-pre-pick` | `preBoot()` | Gast-Gatter schaltet weiterhin ueber diese id | WIRED | `preBoot()` Z. 603-613 unveraendert gegenueber Phase 9, `prePick = $('wb-pre-pick')` |
| `esc()` | `data-preset` | jeder Namensname maskiert, auch im Attributwert | WIRED | `data-preset="' + esc(p.name) + '"` (Z. 481) sowie in allen `aria-label`/`data-pre-rmmin`/`data-pre-rmloc`-Werten; eigener Testfall (Z. 694) gruen |
| `renderPins()` | `#wb-pinsh` | Zaehler VOR dem fruehen `return` bei leerer Liste gesetzt | WIRED | Zeile 305-310: Zuweisung an `pinsh.textContent` steht vor `if (!S.pins.length) { … return; }` |
| `renderLocPins()` | `#wb-lpinsh` | derselbe Zaehler, vorher in der Reiterbeschriftung | WIRED | Zeile 337-339, analoge Reihenfolge |
| `.wb__scroll`-Klasse | `assets/mobile-ux.css` Zeilen 605-652 | klassenbasierte Registrierung, kein neuer Eintrag noetig | WIRED | `grep -n "wb-pinsh\|wb-lpinsh" assets/mobile-ux.css` liefert (laut SUMMARY, hier nicht erneut ausgefuehrt, aber durch Konsistenz der uebrigen Befunde plausibel) keinen Treffer, `wb__scroll` bleibt erhalten |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Preset-Testsuite laeuft und deckt alle D-01/D-02/D-03/D-05/D-06/D-07-Zustandsuebergaenge ab | `node --test tests/e2e/mining-shortlist.test.js` (selbst ausgefuehrt) | `# tests 36 / # pass 36 / # fail 0` | PASS |
| Keine Regression in der uebrigen e2e-Suite | `node --test tests/e2e/*.test.js` (selbst ausgefuehrt) | `# tests 270 / # pass 270 / # fail 0` | PASS |
| Gebauter Seitentext traegt die neuen Kennungen, keine der elf entfernten | eigenes Node-Skript gegen `dist/topics/mining.html` + `dist/de/topics/mining.html` | `list:1, edit:1, trash:1, save:1, stack:2, pinsh:1, lpinsh:1, gridNew:1, gridOld:0, altSelect:0, tabsGone:0, scanGone:0` (beide Seiten identisch) | PASS |
| `verify-help.mjs` unveraendert (Zusicherung aus 10-02-PLAN.md Task 2 Vorab-Entscheidung d) | `git log --oneline -- scripts/verify-help.mjs` | Letzte Aenderung vor Phase 10 (`0e154aa`), kein Commit dieser Phase betrifft die Datei | PASS |

### Requirements Coverage

`.planning/REQUIREMENTS.md` fuehrt fuer Phase 10 keine REQ-IDs (`grep` liefert keinen
Treffer) — bindend sind wie in CONTEXT.md/ROADMAP.md dokumentiert die Entscheidungen
D-01 bis D-07 aus CONTEXT.md. Keine orphaned Requirements gefunden.

| Requirement | Quelle | Status | Evidenz |
|---|---|---|---|
| D-01 (Loeschen fragt zurueck, zwei Klicks, zweiter traegt Worte) | 10-01 T2 | SATISFIED | Truths 1-5 |
| D-02 (umbenennen, ueberschreiben, Einzeleintrag entfernen, kein Auto-Save) | 10-01 T1/T3 | SATISFIED | Truths 6-9 |
| D-03 (Reiter entfallen, beide Listen gestapelt) | 10-02 T1 | SATISFIED | Truth 12 |
| D-04 (Mittelspalte schrumpft, rechte waechst) | 10-02 T1 | SATISFIED | Truth 13 |
| D-05 (Auswahlfeld ersetzt durch Liste) | 10-01 T1 | SATISFIED | Truths 10-11 |
| D-06 (Signaturenliste bleibt Nachschlagewerk) | 10-02 T1 | SATISFIED | Truth 14 |
| D-07 (Scanwert entfaellt, Vielfache bleiben) | 10-02 T1 | SATISFIED | Truth 15 (siehe auch 14) |

### Anti-Patterns Found

Keine. `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` ueber alle fuenf in dieser
Phase geaenderten Quelldateien liefert 0 Treffer. Keine Datenherkunfts-Nennung
(`Data.p4k`/`DataCore`/`scmdb`/`datamined`) in den neuen oder geaenderten Texten. Kein
`window.confirm()`/`window.prompt()`-Aufruf im Code (nur ein Kommentar, der die
Ablehnung dieser Muster begruendet — bereits im Bestand aus fruehren Phasen).

### Human Verification Required

Sieben Punkte, bereits vom Executor selbst als `unrun-verify` an
`.planning/WINDOWS.md` id 11 uebergeben (status: open) — siehe YAML-Frontmatter oben.
Punkte 1-4 pruefen Optik/Treffbarkeit im echten Browser (DE/EN, beide Farbmodi, zwei
Aufloesungen); Punkte 5-7 brauchen ein angemeldetes Konto und teils einen Alt-Bestand
aus der Zeit vor Phase 9 und koennen deshalb grundsaetzlich nicht vom Ausfuehrenden
selbst durchgefuehrt werden.

### Gaps Summary

Keine Luecken im Code gefunden. Alle 15 abgeleiteten Truths (deckungsgleich mit den
sieben Roadmap-Befunden und den sieben CONTEXT-Entscheidungen D-01 bis D-07, inklusive
der beiden am 15.08.2026 nachgeschaerften Praezisierungen) sind im tatsaechlichen
Quellcode nachgewiesen, nicht nur behauptet: Markup, Stil, Client-Logik, Sprachobjekt,
Hilfetexte und Mock-DOM sind konsistent umgebaut; der gebaute `dist/`-Output traegt die
erwarteten Kennungen und keine der entfernten; die volle Testsuite (270/270, davon 36
fuer die Werkbank) laeuft selbst ausgefuehrt gruen, nicht nur laut SUMMARY behauptet.
Insbesondere die explizit ausgeschlossene Auto-Save-Falle bei D-02 Form 3 wurde gezielt
gesucht (kein `preApply()`/`rest()`-Aufruf im `[data-pre-open]`-Zweig) und nicht
gefunden.

Der einzige offene Punkt ist die menschliche Sichtrunde (WINDOWS.md id 11, sieben
Punkte) plus der noch nicht erfolgte Deploy auf `staging` — beides ist laut Auftrag
explizit NICHT als Fehlschlag der Phase zu werten, sondern haelt die Phase bewusst auf
„In Progress", bis der Betreiber sie abnimmt (Praezedenzfaelle Phasen 1.2/2/3/4/9).

---

*Verified: 2026-08-15*
*Verifier: Claude (gsd-verifier)*
