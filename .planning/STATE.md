---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 10
current_phase_name: mining-presets-bedienbar-machen
status: verifying
stopped_at: Completed 10-02-PLAN.md
last_updated: "2026-08-15T04:28:49.215Z"
last_activity: 2026-08-15
last_activity_desc: Phase 10 execution started
progress:
  total_phases: 15
  completed_phases: 10
  total_plans: 50
  completed_plans: 43
parked_phase: 1.1
parked_phase_stopped_at: Completed 01.1-02-PLAN.md
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-28)

**Core value:** Spielgenaue Daten, direkt aus den Spieldateien gewonnen — wenn die Zahlen nicht stimmen, ist die Seite wertlos.
**Current focus:** Phase 10 — mining-presets-bedienbar-machen

> **Nachtrag 15.08.2026 — Phase 10 ist geplant, ausführbereit.**
> „Mining-Presets bedienbar machen", 2 Pläne in 2 Wellen
> (`.planning/phases/10-mining-presets-bedienbar-machen/`), Plan-Prüfer bestanden.
> Nächster Schritt: `/gsd-execute-phase 10`.
>
> ⚠ Der übrige Text dieser Datei beschreibt weiterhin den Stand vom **02.08.2026**
> (Phase 5). Die Phasen 6, 7, 8 und 9 sind seither aus anderen Sitzungen
> ausgeliefert worden, ohne diesen Abschnitt fortzuschreiben — die Angaben unter
> „Current Position" sind entsprechend veraltet und nicht als Lagebild zu lesen.
> Absichtlich nicht überschrieben: an Phase 5 arbeitet laut demselben Abschnitt
> eine parallele Sitzung.

## Current Position

Phase: 10 (mining-presets-bedienbar-machen) — EXECUTING
Plan: 2 of 2
Status: Phase complete — ready for verification

---

**Ab hier: Alttext vom 02.08.2026 zu Phase 5** (vom Werkzeug beim Fortschreiben
angeschnitten, Satzanfang rekonstruiert). Der Abgleich mit `origin/staging` hatte
gezeigt, dass `/support.html` bereits existiert und live ist (Commit `517a9a7`,
`src/components/SupportBody.astro` als EIN Körper für DE+EN, Empfänger
`paypal.me/mkrisz22`, Fuß und Menü verdrahtet). Dieser Worktree war von `a23a22a`
abgezweigt und blind dafür. Phase 5 ist deshalb kein Neubau mehr, sondern der
**Umbau der bestehenden Seite** auf die Gestaltungsrichtung „Instandsetzung".
Branch: claude/donation-button-feature-98ba38 (Worktree)
Last activity: 2026-08-15 — Phase 10 execution started

**Was der bestehenden Seite fehlt** (gemessen, nicht vermutet):

- Datenschutzerklärung nennt PayPal in KEINER der beiden Sprachfassungen (0 Treffer)
  — der einzige Punkt mit rechtlicher Relevanz

- Keine eigene Optik (Standard-Palette `--accent:#2dd4ff`), keine Betragswahl, kein Ko-fi
- Als Grund steht die generische Serverkosten-Begründung statt des defekten Netzteils

**Was bleibt und übernommen wird:** die Abschnitte „Was genauso hilft" und
„Kein Kleingedrucktes" — inhaltlich stark, sie bekommen nur die neue Form.

**Achtung Mehrfachsitzung:** Der Betreiber arbeitet parallel in einer zweiten
Sitzung an Phase 5. `SupportBody.astro` darf nicht gleichzeitig aus zwei Sitzungen
geändert werden.

**Geparkt:** Phase 1.1 „Ambiente-Effekte stilllegen" steht bei Plan 2 von 3
(Plan-Prüfer bestanden, ausführbereit) auf Branch
`claude/site-feedback-effects-docs-3f4edf`. Sie ist NICHT abgebrochen und wird
nach Phase 5 fortgesetzt; Phase 5 fasst keine der dort geänderten Dateien an.

**Ebenfalls fertig, aus einer dritten Sitzung:** Phase 7 „Komponenten-Filter für Schiffe"
(Branch `claude/gsd-ship-component-filter-f81262`) ist ausgeführt und am 03.08.2026 mit
`staging` zusammengeführt. Sie lief parallel zu Phase 6 und ging noch von zwei
handduplizierten Schiffsseiten aus; beim Zusammenführen wanderte der Filter in den von
Phase 6 eingeführten gemeinsamen Körper `components/ships/ShipsOverview.astro`.

**Ebenfalls neu, aus einer vierten Sitzung (06.08.2026):** Phase 1.2 „Werkzeuge erklären"
ist besprochen, recherchiert und in **fünf** Plänen geschnitten (nicht zwei — der Textumfang
von elf Werkzeugen passt nicht in zwei Pläne). **Plan 01 von 5 ist ausgeführt**: die
Hilfe-Mechanik steht end-to-end am Item Finder — Textkatalog `src/i18n/help.ts` ohne
Sprachrückfall, Bauteil `src/components/ToolHelp.astro`, Stufe-2-Maschine
`assets/tool-help.js` und das bleibende Prüftor `scripts/verify-help.mjs`
(`npm run verify:help`, 5 Zusicherungen). **Plan 02 von 5 ist ebenfalls ausgeführt**:
Crafting, Mining und Refinery-Finder hängen jetzt an derselben Mechanik (38 neue
DE/EN-Schlüssel, 20 erklärte Bedienelement-ARTen) — dabei ist der Mehrfach-Instanz-Fall
bewiesen: Mining und Refinery-Finder sitzen auf derselben gebauten Seite
(`src/components/topics/mining.astro`) mit zwei unabhängigen `ToolHelp`-Instanzen, ohne
Kollision und mit nur einem wirksam geladenen `tool-help.js`. **Plan 03 von 5 ist
ebenfalls ausgeführt**: Patch-Archiv, Missionen, Rüstungssets und Wikelo's Emporium
hängen jetzt an derselben Mechanik (37 neue DE/EN-Schlüssel) — dabei sind die beiden
im Plan benannten Sonderfälle gelöst: die fünf strukturgleichen Auswahllisten der
Missionsleiste teilen sich einen Erklärtext und werden trotzdem alle fünf umrandet
(ein `data-help`-Wert auf mehreren Ankern), und Rüstungssets (keine Werkzeugleiste)
bekam seinen Einstieg zwischen Einleitungstext und Sprungmarken-Leiste — im Code
ausdrücklich als **Annahme A2, keine Entscheidung des Betreibers** markiert, zur
Bestätigung in Plan 04 Task 3. **Plan 04 von 5 ist ebenfalls ausgeführt**: Schiffe und
Precision Jump hängen jetzt an derselben Mechanik (20 neue DE/EN-Schlüssel) — dabei
stellte sich heraus, dass Schiffe seit der Phase-6/7-Zusammenführung keine zwei
handgepflegten Seitendateien mehr sind, sondern EINEN gemeinsamen Körper
(`src/components/ships/ShipsOverview.astro`) hat; die Hilfe wurde deshalb nur dort
verdrahtet, nicht mehr in `src/pages/schiffe.astro` und `src/pages/de/schiffe.astro`
wie ursprünglich geplant — der Class-A-Duplikationsbefund entfällt für dieses
Werkzeug. Precision Jump bekam seinen Einstieg vor der Steuerkonsole, ebenfalls als
**Annahme A2** markiert. `verify-help.mjs` meldet jetzt 10 von 11 Werkzeugen. **Plan 05
von 5 ist ebenfalls ausgeführt**: der Refinery-Tracker (`/refinery.html`, kontogebunden)
hängt jetzt an derselben Mechanik (14 neue DE/EN-Schlüssel, 163 gesamt) — `ToolHelp`
sitzt INNERHALB des serverseitig `hidden`-Blocks `div#rfd`, unmittelbar nach
`div.rfd-top` (Regel R-1: die Seite leitet abgemeldete Besucher sofort weg, es gibt
außerhalb von `#rfd` nichts zu erklären), acht `data-help`-Anker auf acht
Huellelementen, vier davon im gebauten HTML leer und client-seitig befüllt (Regel
R-4). Anders als bei Plan 04 stimmten alle im Plan genannten Zeilennummern exakt mit
dem tatsächlichen Code überein — keine Planabweichung dieser Art. `node
scripts/verify-help.mjs --complete` meldet jetzt **„Abgedeckt: 11 von 11"**, alle fünf
Zusicherungen erfüllt; ebenso grün: `npm run audit:site` (0 FEHLER), `npm run
audit:csp` (10 externe Quellen, alle abgedeckt), `npm run verify:fx` (Phase 01.1
unverändert), `npm run verify` (0 gebrochene Verweise). DOC-01 bis DOC-07 in
`.planning/REQUIREMENTS.md` auf dieser maschinellen Grundlage abgehakt.
**Die im Plan verlangte Sichtrunde (12 Punkte + Annahmen A2/A4, braucht ein
angemeldetes Konto) wurde bewusst NICHT vom Executor durchgeführt** — sie ist als
offener Punkt in `.planning/WINDOWS.md` (id 2, `unrun-verify`) und in
`01.2-05-SUMMARY.md` an den Betreiber zurückgegeben. **Phase 1.2 ist damit
technisch fertig (5/5 Pläne, 11/11 Werkzeuge maschinell belegt), aber NICHT als
„Complete" markiert**, solange die Sichtrunde aussteht.
⚠ Beim Einbringen wurden die Phase-01.1-03-Commits jener Sitzung **bewusst weggelassen** —
der Mauszeiger-Schein ist auf `staging` bereits getilgt (0 Treffer für `cursorglow`/`--mx`),
die Arbeit wäre ein Duplikat gewesen. Phase 1.1 bleibt hier bei 2/3.

**Aus einer fünften, parallelen Sitzung (08.08.2026): Phase 2 „Schrift- und
Bewegungsskala" ist mit Plan 07 von 7 fertig ausgeführt.** Die Sperrklinke in
`scripts/verify-typo-motion.mjs` (Zusicherung 2) ist von 183 (Tracer-Stand nach
Plan 01) auf 235.775 (site-weiter Ist-Stand) angehoben, eine sechste Zusicherung
zählt den skalenpflichtigen Rest über den GESAMTEN Quellbestand (0 über 96
Dateien) als Dauerwächter, und `npm run verify:typo` läuft jetzt im
Dockerfile-Tor nach dem Build — eine gerissene Skala kann kein Auslieferungsimage
mehr erzeugen. Negativkontrolle durchgeführt und bestanden (siehe
`02-07-SUMMARY.md`). `TYPO-01`/`TYPO-02` sind in `REQUIREMENTS.md` auf dieser
Grundlage abgehakt; `TYPO-03` bleibt offen, weil die BREITERE Schluss-Sichtrunde
über die ~92 site-weit umgestellten Dateien (die engere Kopfleiste+Startseite-Runde
ist bereits abgenommen) noch aussteht — als offener Punkt `.planning/WINDOWS.md`
id 5 an den Betreiber übergeben. **Phase 2 ist damit technisch fertig (7/7 Pläne),
aber NICHT als „Complete" markiert**, solange die Sichtrunde aussteht — derselbe
Umgang wie bei Phase 1.2 oben.

Progress: [█████████░] 86%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01.1 P01 | 45min | 3 tasks | 8 files |
| Phase 01.1 P02 | ~2h | 3 tasks | 39 files |
| Phase 06 P01 | 45min | 2 tasks | 8 files |
| Phase 06 P02 | 55min | 2 tasks | 5 files |
| Phase 06 P03 | ~2h55min | 2 tasks | 1 files |
| Phase 07 P01 | ~35min | 2 tasks | 6 files |
| Phase 07 P02 | 55min | 3 tasks | 3 files |
| Phase 07 P03 | ~45min | 3 tasks | 3 files |
| Phase 1.2 P01 | 35min | 2 tasks | 6 files |
| Phase 1.2 P02 | ~40min | 2 tasks | 4 files |
| Phase 1.2 P03 | ~40min | 2 tasks | 5 files |
| Phase 01.2 P04 | ~35min | 2 tasks | 3 files |
| Phase 01.2 P05 | ~40min | 2 tasks | 4 files |
| Phase 02 P01 | ~55min | 3 tasks | 5 files |
| Phase 02 P02 | ~40min | 2 tasks | 2 files |
| Phase 02 P03 | ~90min | 2 tasks | 9 files |
| Phase 02 P05 | ~45min | 2 tasks | 20 files |
| Phase 02 P06 | ~50min | 2 tasks | 40 files |
| Phase 02 P07 | ~40min | 2 tasks | 4 files |
| Phase 03-ueberlagerungen-entstapeln P01 | 40min | 3 tasks | 6 files |
| Phase 03-ueberlagerungen-entstapeln P02 | 41min | 2 tasks | 2 files |
| Phase 03-ueberlagerungen-entstapeln P03 | ~30min | 2 tasks | 23 files |
| Phase 03-ueberlagerungen-entstapeln P04 | ~25min | 2 tasks | 22 files |
| Phase 03-ueberlagerungen-entstapeln P05 | ~2h | 3 tasks | 25 files |
| Phase 04-sprachparitaet-absichern P01 | 40min | 2 tasks | 5 files |
| Phase 04-sprachparitaet-absichern P02 | 30min | 3 tasks | 7 files |
| Phase 04 P03 | 65min | 3 tasks | 9 files |
| Phase 10 P01 | 35min | 3 tasks | 4 files |
| Phase 10 P02 | 35min | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Meilenstein-Richtung ist UI-/Design-Feinschliff; Daten, Konto und Discord bleiben unangetastet
- Init: Grobe Granularität — 4 Phasen, je 2 Pläne
- Init: Projekt-Recherche übersprungen (Bestandsprojekt mit festem, dokumentiertem Stack; kein Web-Such-MCP verbunden). Recherche pro Phase bleibt aktiv.
- [Phase ?]: 01.1-01: data-fx/vb.fx/vbfxchange/js-fx-toggle als endgueltiger FX-Vertrag festgelegt (reversibility: costly) — Plaene 02/03 bauen direkt darauf auf
- [Phase ?]: 01.1-01: 11 vorbestehende, unabhaengige test:e2e-Fehlschlaege (item-finder-app.js Cache-Bust) in deferred-items.md dokumentiert, nicht behoben (Scope Boundary)
- [Phase ?]: archive.js: eine gemeinsame running-Variable traegt Tab-Sichtbarkeit UND FX-Wahl statt zweier konkurrierender Riegel
- [Phase ?]: Codemod liest den Leinwandnamen aus getElementById statt ihn festzuverdrahten -- erkennt dadurch die abweichende dust-Leinwand von sc-4-9-0 korrekt
- [Phase ?]: sc-4-2-0 Regen und Blitz bewusst aus dem Codemod ausgeschlossen und von Hand gegattert, inkl. Reset des Zeitgebers beim Wiedereinschalten
- [Phase 6]: 06-01: vRoleCig() ersetzt fociDe als Kartenbeschriftung, Fallback auf vRole() fuer die 4 ATLS-Faelle; EIN Koerper (ShipsOverview.astro) fuer /schiffe.html + /de/schiffe.html
- [Phase 6]: 06-01: npm run theme lief repo-weit und veraenderte 84 unbeteiligte Dateien (Alt-Drift) -- alle zurueckgesetzt, nur die 4 fuer diesen Plan vorgesehenen Dateien blieben veraendert
- [Phase 6]: 06-02: 18 Rollenfamilien (CAREER_LEGACY/ROLE_COMPOUND/ROLE_FAMILY) + Signatur (sig, 16 Schiffe) + Merkmalsleiste (feat: cargo 102, ground 37) aus dem DataCore; Bewaffnet (dogfightEnabled 220/223) bewusst nicht als Merkmal erzeugt (D-09)
- [Phase 6]: 06-02: npm run theme beruehrte erneut dieselben 84 unbeteiligten Dateien aus Plan 01 (Alt-Drift) -- zurueckgesetzt, nur die 5 Plan-Dateien blieben veraendert
- [Phase 6]: 06-03: 7 Schnellzugriff-Chips (sdb__quick/sdb__qchip) setzen Rollenfamilie+Signatur in einem Klick (D-10, ROLE-06); sf-type (Wiki-Grobfilter) abgeloest
- [Phase 6]: 06-03: Sichtpruefung fand doppelten Rollenfilter (sf-role neben sf-rolefam) -- sf-role entfernt, sf-rolefam ist jetzt DER Rollenfilter (D-05); Konsole 9 statt 10 Bedienelemente
- [Phase 7]: 07-01: compAttr liefert bei "Daten, aber keine Kategorie" den Platzhalter `_` statt der leeren Zeichenkette -- Astro rendert leere String-Attributwerte ohne `=`, was die automatisierte HTML-Zaehlung im Plan brach (siehe 07-01-SUMMARY.md Deviations)
- [Phase 7]: 07-01: catOf() prueft `m` (MissileLauncher/BombLauncher) VOR `w` (WeaponGun), sonst landen Kombi-Halterungen faelschlich bei den Waffen; Turm-Platz bleibt bewusst frei fuer 07-02 (D-06)
- [Phase 7]: 07-02: D-06 -> D-06a waehrend des blockierenden Checkpoints verschaerft -- die geratene Fernturm-Namenserkennung (`remote`/`tractor`) ist ersatzlos gestrichen, Turm zaehlt nur noch `TurretBase` ohne `Container` (reversibility: costly). Preis: Carrack/Redeemer/Polaris verlieren ihre ferngesteuerten Turm-Ports; 47 statt 59 Schiffe tragen jetzt `t`. `t` speichert wie alle Kategorien die maximale Steckplatzgroesse, NICHT die Turmanzahl (Verwechslungsgefahr, siehe 07-02-SUMMARY.md).
- [Phase 7]: 07-03: 26 automatisierte `node:vm`-Testfaelle (`tests/e2e/ship-component-filter.test.js`) fuehren das echte Inline-Skript aus und decken D-04/D-08/D-10/D-11/D-12 ab.
- [Phase 7]: Zusammenfuehrung 03.08.2026: Phase 7 lief parallel zu Phase 6 und ging von zwei handduplizierten Schiffsseiten aus. Phase 6 hat die beiden zu EINEM Koerper zusammengelegt -- der Filter sitzt seither in `components/ships/ShipsOverview.astro`, nicht mehr zweimal in den Seiten. Das Groessenfeld heisst `sf-compsize`, weil Phase 6 `sf-size` bereits fuer die Schiffs-Groessenklasse belegt.
- [Phase 1.2]: 01.2-01: useHelp()/assertHelpParity() statt useTranslations() — Hilfetexte duerfen nie auf Englisch zurueckfallen (DOC-04). Der eingebaute EN-Rueckfall in src/i18n/ui.ts ist fuer Hilfetexte das Gegenteil des Erfolgskriteriums.
- [Phase 1.2]: 01.2-01: Stufe-2-Markup/CSS/Blase entsteht ausschliesslich per JS in activate() — vor dem Klick existiert nichts davon (DOC-06/D-11)
- [Phase 1.2]: 01.2-01: data-help auf stabilen Huellelementen statt auf ihren Kindern — ueberlebt jeden innerHTML-Neuaufbau der Item-Finder-Chips (DOC-03)
- [Phase 1.2]: 01.2-01: tool-help.js haengt am Bauteil ToolHelp.astro, NICHT an Layout.astro — es liegt damit auf elf Werkzeugseiten statt auf ~26.000 gebauten Seiten (DOC-06 maschinell beweisbar)
- [Phase 1.2]: 01.2-02: Mehrfach-Instanz-Fall bewiesen — zwei ToolHelp auf src/components/topics/mining.astro (mining + refineryfinder) kollidieren nicht, weil details.tool-help ohne name-Attribut keine native HTML-Exklusivitaet hat und getrennte data-tool-id getrennte vb.help.seen-Eintraege schreiben
- [Phase 1.2]: 01.2-03: Ein data-help-Wert auf mehreren gleichartigen Elementen (missions.ctl.select fuenfmal auf der Missionsleiste) erfuellt D-01 (alle umrandet) und D-03 (einmal je ART erklaert) gleichzeitig, ohne Aenderung an tool-help.js
- [Phase 1.2]: 01.2-03: Ruestungssets-Platzierung (zwischen p.as-intro und nav.as-jump) im Code ausdruecklich als Annahme A2 kommentiert, nicht als Entscheidung — offen zur Bestaetigung in Plan 04 Task 3
- [Phase 1.2]: 01.2-04: Schiffe seit Phase 6 EIN gemeinsamer Koerper (ShipsOverview.astro) statt zweier Seitendateien — Class-A-Sprachparitaets-Risiko fuer dieses Werkzeug entfaellt, Hilfe nur an EINER Stelle verdrahtet
- [Phase 1.2]: 01.2-04: Precision-Jump-Platzierung (vor .pj-console, kein Filterleiste) im Code als Annahme A2 markiert, zur Bestaetigung im Phasen-Tor von Plan 05
- [Phase 1.2]: 01.2-05: ToolHelp sitzt INNERHALB des serverseitig hidden-Blocks div#rfd (Regel R-1) — die Sprachparitaetspruefung greift trotzdem unveraendert, weil hidden ein Sichtbarkeits-Attribut ist, kein Ausschluss aus dem ausgelieferten HTML (ausdruecklich NICHT der Item-Finder-Fall)
- [Phase 1.2]: 01.2-05: DOC-01 bis DOC-07 auf Grundlage von verify-help.mjs --complete (11/11) abgehakt; die im Plan verlangte Sichtrunde (12 Punkte + Annahmen A2/A4) wurde bewusst NICHT vom Executor durchgefuehrt (braucht angemeldetes Konto + menschliches Urteil) und ist als offener Punkt in WINDOWS.md (id 2) an den Betreiber zurueckgegeben — Phase 1.2 bleibt deshalb "In Progress", nicht "Complete"
- [Phase ?]: [Phase 2]: 02-01: Ausgangszahlen aus PLAN.md (1968/95/865/663) durch rigorosen Nachvollzug ersetzt (1961/96/863/660) -- Differenzen einzeln erklaert in 02-01-SUMMARY.md
- [Phase ?]: [Phase 2]: 02-01: Audit-Skript zaehlt Bedienuebergaenge als ui+token statt nur ui, damit spaetere Plaene (03-06) den erreichten Ist-Stand nicht als Regression melden
- [Phase ?]: [Phase 2]: 02-02: tests/e2e/typo-motion-morph.test.js pinnt die beiden Messeingaenge von measureMorph() (--fs-10=1rem, --ls-15=0.18em) gegen dist/ als bleibendes Regressionstor vor der site-weiten Breite (Plaene 03-07); Negativkontrolle durchgefuehrt (--fs-10 testweise auf 0.95rem, Test schlug fehl, zurueckgesetzt)
- [Phase ?]: [Phase 2]: 02-02: die menschliche Sichtrunde (Erfolgskriterium 3) bewusst NICHT vom Executor durchgefuehrt (human_verify_mode: end-of-phase) -- als offener Eintrag id 3 in WINDOWS.md hinterlegt, wird in Plan 07 mit der Schluss-Sichtrunde zusammengefuehrt; dabei die seit Phase 1.2 nicht mehr nachgerechnete Ledger-Kopfzeile (fixed_count/total_count) korrigiert
- [Phase ?]: [Phase 2]: 02-03: Zuordnungslogik aus audit-typo-motion.mjs nach scripts/lib/typo-motion.mjs herausgezogen -- Erhebung UND Massendurchlauf teilen sich jetzt EIN Modul, koennen nicht mehr auseinanderdriften
- [Phase ?]: [Phase 2]: 02-03: migrate-typo-motion.mjs nutzt zwei VERSCHIEDENE, je nach Eigenschaft etablierte Ausreisser-Schwellen (font-size: >6% relativ, letter-spacing: >0.02em absolut, aus 02-01-PLAN.md uebernommen, nicht neu erfunden) -- eine einheitliche 6%-Schwelle haette bei Laufweiten-Werten praktisch jeden zweiten Wert als Ausreisser gemeldet
- [Phase ?]: [Phase 2]: 02-03: lokale Kurven-Aliase (archive.css --ease/--ease-out, data-page.css --dp-ease) werden generisch erkannt (eigene Definition zeigt auf ease-Keyword/cubic-bezier), nicht dateispezifisch festverdrahtet -- data-page.css war im Plan nicht namentlich genannt, --dp-ease nach vollstaendiger Migration seiner 6 Fundstellen als totes Token entfernt
- [Phase ?]: [Phase 2]: 02-03: archive.css letter-spacing 0.5em (56% Abweichung) und drei weitere font-size-Ausreisser (9px x2, 1.7rem) waren vom Plan NICHT namentlich benannt, wurden aber vom Codemod mechanisch gefunden und nach D-05-Praezedenz von Hand auf die naechste Stufe gesetzt, siehe 02-03-SUMMARY.md
- [Phase ?]: [Phase 2]: 02-03: REQUIREMENTS.md TYPO-01/02/03 bewusst NICHT auf "Complete" in der Traceability-Tabelle gesetzt -- site-weite Abdeckung ist erst nach Plan 07 vollstaendig (Plaene 04-07 stehen noch aus), Praezedenzfall aus 02-02-SUMMARY.md fortgefuehrt
- [Phase ?]: [Phase 2]: 02-04: scripts/audit-typo-motion.mjs --only unterstuetzte nur EINEN Wert (indexOf statt Sammeln); auf collectFlagValues() umgestellt wie migrate-typo-motion.mjs -- ohne die Aenderung haetten die im Plan selbst vorgegebenen Mehrfach-`--only`-Verify-Befehle (auch in 02-05/06) still nur die erste Datei geprueft
- [Phase ?]: [Phase 2]: 02-04: die plan-vorgegebene Verify-Formel "--only src/components/ --only src/layouts/" als exakte Dateiliste dieses Plans (28 Einzelpfade) interpretiert statt als Verzeichnis-Praefix -- woertlich ausgefuehrt haette sie faelschlich die noch nicht umgestellten Verzeichnisse patches/topics/account/ships (Eigentum von 02-05/06) erfasst
- [Phase ?]: [Phase 2]: 02-04: FxToggle.astro vier "visibility 0s [linear] Xs"-Uebergaenge (0ms-Sichtbarkeits-Synchronisation, durch keine bestehende Ausnahmekategorie gedeckt) von Hand auf var(--dur-fast) gesetzt; Verzoegerungswerte bleiben immer woertlich -- neues Referenzmuster fuer 02-05/06, falls dort aehnliche Faelle auftauchen
- [Phase ?]: [Phase 2]: 02-04: ItemFinderPage.astro letter-spacing 0.44em (27% Abweichung, zweitgroesster Ausreisser der Phase) auf var(--ls-20) gerastet; das gekoppelte text-indent (laut Quellkommentar exakte Kompensation der Sperrung) im selben Schritt mitgezogen
- [Phase ?]: [Phase 2]: 02-04: assets/hero-video.js transition:opacity 1.4s ease bewusst NICHT migriert (Ambient-Loop laut eigenem Kommentar, 1400ms weit ueber der 350ms-Bedienuebergang-Schwelle) -- Praezedenz aus 02-03 (archive.css Aeren-Uebergaenge) fortgefuehrt
- [Phase ?]: [Phase 2]: 02-04: REQUIREMENTS.md TYPO-01/02/03 weiterhin NICHT auf "Complete" gesetzt -- site-weite Abdeckung ist erst nach Plan 07 vollstaendig (Plaene 05-07 stehen noch aus)
- [Phase ?]: [Phase 2]: 02-05: alle 19 Patch-Koerper (956 Ersetzungen, 0 Verweigerungen) auf die Skala umgestellt -- groesster Einzelblock der Phase; sc-4-2-0 (Regen/Blitz) und sc-4-9-0 (#dust) per Diff-Zeilenbereich geprueft, Ambiente-JS ausserhalb aller Hunks
- [Phase ?]: [Phase 2]: 02-05: animation-Sollzahl aus dem Plan (160) war eine Verwechslung mit der transition-Deklarationszahl (ebenfalls 160) -- tatsaechliche, vor/nach dem Lauf identische Zahl ist 133; REQUIREMENTS.md korrigiert
- [Phase ?]: [Phase 2]: 02-06: fuenf handgepflegte DE/EN-Seitenpaare + 404 sowie 22 Themen-Koerper/5 Konto-Ansichten/PilotPage/ShipsOverview umgestellt (530 Ersetzungen, 5 Verweigerungen -- 2 .85em elternrelativ, 3 von Hand nach D-05 eingerastet); alle Paare EN=DE identisch (0 Abweichungen), 29 ship-component-filter-Testfaelle weiterhin gruen
- [Phase ?]: [Phase 2]: 02-06: die im Plan genannten Ausgangszahlen/Ausreisser waren Prosa-Schaetzungen -- tatsaechlich nur 3 Ausreisser (PilotPage 2.8rem/2rem, mining.astro .sh-icon 2.4rem), nicht 4; PilotPage 2.2rem liegt exakt auf --fs-17 (kein Ausreisser), RefineryDashboard/FriendsManager 1.5rem liegen bei 3.45% (unter der Schwelle)
- [Phase ?]: [Phase 2]: 02-07: MIN_TOKEN_USAGES (Sperrklinke, verify-typo-motion.mjs Zusicherung 2) von 183 (Plan-01-Tracer-Stand) auf 235775 (site-weiter Ist-Stand nach 02-06) angehoben -- gemessen mit dem Skript selbst, nicht geschaetzt
- [Phase ?]: [Phase 2]: 02-07: sechste Zusicherung ergaenzt (skalenpflichtiger Rest ueber den GESAMTEN Quellbestand ist 0), ruft ausschliesslich scripts/lib/typo-motion.mjs auf -- kein drittes Muster; Negativkontrolle durchgefuehrt (LangSwitcher.astro testweise auf font-size:0.8rem zurueckgesetzt, Zusicherung 6 schlug fehl, zurueckgesetzt)
- [Phase ?]: [Phase 2]: 02-07: npm run verify:typo ans Dockerfile-Tor gehaengt (Zeile 34, nach dem Build) -- ab jetzt build-blockierend fuer das Auslieferungsimage, nicht mehr nur von Hand aufrufbar
- [Phase ?]: [Phase 2]: 02-07: REQUIREMENTS.md Traceability-Tabelle hatte eine HTML-Kommentarzeile MITTEN in der Tabelle (zwischen DOC-07/DATA-01), die jede zeilenweise Tabellensuche ab dort abbrach (gsd-tools requirements mark-complete meldete faelschlich table_unmatched fuer TYPO-01/02 und alle folgenden Zeilen) -- Kommentar unveraendert ans Tabellenende verschoben (Rule 3)
- [Phase ?]: [Phase 2]: 02-07: TYPO-01/TYPO-02 in REQUIREMENTS.md auf Complete gesetzt (0 Rest site-weit, 96 Dateien); TYPO-03 bleibt Pending -- die breitere Schluss-Sichtrunde (WINDOWS.md id 5) steht noch aus, die engere bereits abgenommene Pruefung (WINDOWS.md id 3) bleibt unangetastet. Phase 2 technisch fertig (7/7 Plaene), NICHT "Complete" markiert, solange die Sichtrunde aussteht
- [Phase ?]: [Phase 3]: 03-01: body::after maskiert (linear-gradient an --maxw, Feder AUSSERHALB der Spalte) statt gedimmt -- --ambient-opacity bleibt 0.5/0.4 (D-01 begrenzt, daempft nicht)
- [Phase ?]: [Phase 3]: 03-01: .reveal-IntersectionObserver auf threshold:0 (D-03) -- 21 defensive !important-Overrides bleiben bewusst stehen, Plan 03 traegt sie ab
- [Phase ?]: [Phase 3]: 03-01: verify-layers.mjs rechnet Kontrast aus echtem Bildpunkt (sharp) + Scrim + Zeilenraster (compositeOver/flattenStack) statt zwei CSS-Tokens zu vergleichen -- Dunkelmodus 7.50:1 vorher -> 18.22:1 nachher am Hero-Fliesstext, negativkontrolliert (Tor faellt nachweislich bei gestoerter Maske)
- [Phase ?]: [Phase 3]: 03-02: alle acht Medien-Archetypen des geteilten Systems tragen jetzt ihr Zeilenraster (::before, z-index:1); .gtile figcaption/.zoomic brauchten z-index:2 (Rule 1, sonst waere Raster ueber der Bildunterschrift gelandet); .sstep undurchsichtig ohne JS (D-02), Betriebsmarke data-sstep-live ausschliesslich von detail.js gesetzt, prefers-reduced-motion fuehrt jetzt auch .sstep/.sstep .sn
- [Phase ?]: [Phase 3]: 03-03: assets/archive.js revealIO/nodeIO auf threshold:0 (D-05, wie assets/detail.js nach Plan 01) -- archive.css unangetastet, beide genannten Fundstellen bereits korrekt
- [Phase ?]: [Phase 3]: 03-03: 21 defensive .reveal-Notregeln entfernt (D-03), 21 -> 0 belegt, 8/8 DE/EN-Paare symmetrisch; zwei Rule-1-Bugs durch eigene Aenderung gefunden+behoben (verify-layers.mjs revealIO-Beobachtungswert, PilotPage.astro </style> nach vorbestehendem eingebettetem \r wiederhergestellt)
- [Phase ?]: [Phase 3]: 03-04: alle 19 Patch-Koerper per migrate-layers.mjs (Volltext-Ersatz statt zeilenweise, Lehre aus 03-03) auf den Stand des geteilten Systems gehoben -- 19 body::after maskiert, 87 Rasterregeln (hero=19,shot=19,tile.img=19,video=17,ship=13), 19 Beobachter geheilt; alle Soll-Zahlen trafen exakt ein (0 Abbrueche), animation:133/transition:160 unveraendert; verify-layers.mjs Zusicherung 1+3 fuer Patch-Kopien von Beobachtungswert auf scharf umgestellt, neuer --patches-Vorablauf; LAYER-01 komplett abgetragen
- [Phase ?]: [Phase 3]: 03-05: scripts/lib/layer-registry.mjs (neu) fuehrt 25 Registry-Eintraege (A1-A10, B1-B6 ueber alle 19 Patch-Koerper, C1-C3, D1-D5) vollstaendig auf; verify-layers.mjs Zusicherung 5 (Vollstaendigkeitswaechter gegen den gebauten Stand) fand beim ersten Lauf 18 vorher unbekannte Selektor-Familien site-weit, 5 davon echte Text-auf-Foto-Stellen (Item Finder, Ships Overview, Startseite, eine Themenseite, ein Patch-eigenes Video) -- als D1-D5 aufgenommen statt uebergangen
- [Phase ?]: [Phase 3]: 03-05: Leitbefund aus 03-01 behoben -- Hero-Fliesstext hell 2,93:1 -> 18,34:1 durch verschobenen Verlauf-Stopp (Plateau 55%-90% statt sofortiger Interpolation Richtung --bg), --ambient-opacity unveraendert 0.5/0.4, Palette unangetastet; woertlich derselbe Fix in allen 19 Patch-Koerpern (.hero__photo::after + .shot::after)
- [Phase ?]: [Phase 3]: 03-05: zwei eigenstaendige Rule-1-Kontrastbugs gefunden+behoben (.fcard auf Themenseite 4-0-1 nutzte Flaechen- statt Medien-Tokens; ShipsOverview.astro .sdb__sub trug eine fixe Farbe mit falschem generiertem Hellmodus-Override); 344 Einzelmessungen insgesamt, 0 unter der WCAG-AA-Marke; verify:layers haengt jetzt im Dockerfile-Tor nach verify:typo; LAYER-01/LAYER-02 komplett; Sichtrunde als WINDOWS.md id 6 an den Betreiber uebergeben, Phase 3 technisch fertig (5/5 Plaene), NICHT "Complete" solange id 6 offen ist
- [Phase ?]: [Phase 4]: 04-01: verify:sync — Struktur-Fingerabdruck (tag.class, Autorenreihenfolge, ohne Sortieren/Tiefe) ueber alle 8.678 gebauten EN/DE-Paare; X-langsw-order als per-Instanz-Mengenvergleich statt Seitenausschluss (Bruch C der Negativkontrolle belegt die Enge)
- [Phase ?]: [Phase 4]: 04-01: Erstbefund 81 unerklaerter Rest (78 Item-Beschreibung, 2 Onepager, 1 Impressum-MStV) exakt wie von 04-RESEARCH.md vorhergesagt; die vier diff=4-Verdachtspaare bestaetigt ein Messartefakt der Recherche-Sonde, kein fuenftes Muster. verify:sync bewusst noch NICHT im Dockerfile (D-03: erst beheben in Plan 02, dann scharf in Plan 03)
- [Phase ?]: [Phase 4]: 04-01: REQUIREMENTS.md SYNC-01/SYNC-02/THEME-02 bewusst NICHT auf Complete gesetzt -- verify:sync existiert und misst, aber der Erstbefund ist noch offen (81 Paare) und das Tor haengt noch nicht scharf im Dockerfile (D-03); Praezedenz aus Phase 2 (TYPO-01/02 erst im letzten Plan abgehakt)
- [Phase ?]: [Phase 4]: 04-02: D-05 vollzogen -- description() in src/lib/items.ts liefert null unabhaengig von lang, wenn g.desc fehlt (79 Items ohne englische Quelle, 78 mit eigener Detailseite); descDe gilt als Uebersetzung eines vorhandenen desc, nicht als eigene Quelle. Zwei benannte cut-region-Ausnahmen (X-onepager-de-only, X-impressum-mstv) fuer die verbleibenden quellbelegten Abweichungen, neue Zusicherung 5 (Zombie-Waechter) in verify-sync.mjs. node scripts/verify-sync.mjs meldet jetzt 0 unerklaerte Abweichungen ueber alle 8678 Paare, Exit 0 -- Handover-Bedingung fuer Plan 03 (D-03 "erst beheben, dann scharf" vollzogen) erfuellt. Unbelegte Drift (p.muted nur auf der EN-Impressum-Seite) behoben statt ausgenommen (Gegenstueck in src/pages/de/impressum.astro ergaenzt). verify-fx/help/typo-motion.mjs beziehen die Paarung jetzt aus scripts/lib/page-pairs.mjs; dabei fehlende "< 60"-Untergrenze in verify-help.mjs nachgezogen (echter Befund beim vorgeschriebenen Vorher-Vergleich, macht die Zusicherung staerker). SYNC-02 in REQUIREMENTS.md auf Complete gesetzt.
- [Phase ?]: [Phase 4]: 04-03: verify:theme-gen.mjs (npm run verify:theme) — die echten Generatoren gegen eine Ablagekopie unter os.tmpdir(), nie gegen den Arbeitsbaum. Der vorgeschriebene echte Lauf deckte zwei vorbestehende Bugs in build-light-overrides.mjs auf (stripTrailingRootRules loeschte einen gueltigen generierten Block, topLevelRules zerbrach an einem Kommentar mit literalen Klammern) -- beide behoben, plus ein Schutz gegen doppelte Wahrheiten (keine automatische Hell-Entsprechung fuer Selektoren mit bereits handgeschriebenem Gegenstueck). PilotPage.astro/ProfileCard.astro von den dadurch entstandenen Duplikaten bereinigt. ShipsOverview.astro's vorbestehende, echte Luecke (.fcard__status.fr) als benannte EXCLUSIONS-Ausnahme gehalten, nicht nachgezogen -- WINDOWS.md id 7. assets/theme.css Kopfangabe richtiggestellt (Marke HANDGEPFLEGT). Beide Tore (verify:sync, verify:theme) jetzt blockierend im Dockerfile; alle neun Tore auf dem committeten Stand gruen. SYNC-01/SYNC-02/THEME-02 auf Complete. Sichtprobe an WINDOWS.md id 8 uebergeben -- Phase 4 bleibt 'In Progress'.
- [Phase ?]: Umbenennen als EIN PATCH auf (user_id,name) statt POST+DELETE — atomar, ein Fehlerfall (409)
- [Phase ?]: Loeschen-Rueckfrage als eigener Inline-Zustand statt window.confirm() — zwei Klicks, zweiter traegt Worte
- [Phase ?]: Einzeleintrag entfernen ohne preApply() — Ansehen/Ausduennen aendern nie den Arbeitsstand
- [Phase ?]: 10-02: Reiterleiste ersatzlos entfernt statt umgebaut -- beide Listen wurden ohnehin bei jedem renderAll() gezeichnet, der Reiter blendete nur eine aus
- [Phase ?]: 10-02: Rastermass 470px 1fr 330px wie im Plan vorentschieden uebernommen (Claude's Discretion aus CONTEXT.md)
- [Phase ?]: 10-02: mining.ctl.pins wird zum Nachschlagewerk-Text, mining.ctl.presets nennt die vier Preset-Handlungen aus 10-01; scripts/verify-help.mjs bewusst nicht angefasst

### Pending Todos

None yet.

### Blockers/Concerns

- Class A aus CONCERNS.md: 67 EN/DE-Seitenpaare pflegen Kopf, Palette, Inline-Style und Prosa von Hand doppelt; nichts im Build vergleicht sie. Jede Änderung an Startseite oder Layout muss beide Fassungen gleichzeitig treffen. Phase 4 baut den Nachweis dafür.
- Generierte `:root[data-theme="light"]`-Blöcke: Handänderungen verwirft `npm run theme` stillschweigend.
- GSD-Subagenten (`gsd-planner`, `gsd-executor`, …) liegen in `~/.claude/agents/`, waren in der Init-Sitzung aber noch nicht in der Agenten-Registry. Nach einem Neustart von Claude Code stehen sie zur Verfügung. Phase 1 lief deshalb inline.
- Vorbestehend, nicht aus Phase 1: der Astro-Dev-Server bricht bei `src/layouts/Layout.astro` mit `Unexpected ")"` in einem Inline-Skript ab. Der Produktionsbuild ist nicht betroffen — die Sichtprüfung lief deshalb gegen das gebaute `dist/`.
- Reduzierte Bewegung ist in Phase 1 aus dem Code abgeleitet, nicht im Browser gemessen: der Prüfbrowser meldet `prefers-reduced-motion: false` und bietet keine Emulation.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260802-3fw | Zurück-Button site-weit (SiteNav leitet ihn aus `crumbs` ab; `--nav-h` löst die verdrahteten 68px in drei Filterleisten ab) | 2026-08-02 | b12a3b5, 03ead2d | | [260802-3fw-zurueck-button-site-weit](./quick/260802-3fw-zurueck-button-site-weit/) |
| 260802-5qd | Zurück folgt der tatsächlichen Herkunft (Herkunfts-Notiz + parser-blockierender Leser; crafting→Material→zurück behält Suche und Scroll) | 2026-08-02 | d66dbb6, 9e0133a | | [260802-5qd-zurueck-folgt-der-herkunft](./quick/260802-5qd-zurueck-folgt-der-herkunft/) |
| 260802-7eb | UEX-Durchschnittspreis-Spalte für Items (DE+EN) — vierte Ø-Spalte in Datenblatt, Kategorie-Liste und Finder-Modal; Mittelwert über alle Verkaufsorte aus `obtain[]`, ohne API-/Pipeline-Änderung | 2026-08-02 | aa391d8, bcc99b7 | Verified | [260802-7eb-uex-durchschnittspreis-spalte-fuer-items](./quick/260802-7eb-uex-durchschnittspreis-spalte-fuer-items/) |
| 260802-7f5 | Item-Finder als Werkzeug: Suche und Filter ohne Scrollen direkt unter dem Titel (DE+EN) | 2026-08-02 | 8001901 | Verified | [260802-7f5-item-finder-als-werkzeug-suche-und-filte](./quick/260802-7f5-item-finder-als-werkzeug-suche-und-filte/) |
| 260802-ose | Größenachse (CIG-Hangarklasse 1-6, `AttachDef.Size`) als dritte Filterachse neben Beruf/Rolle; Boden/Raum-Merkmal bewusst NICHT auf `AttachDef.SubType` umgestellt (verliert 10 Schweberäder gegenüber dem bestehenden Merkmal) | 2026-08-02 | 3ecddb4, bf05687, 330c29a, 85ebd90 | | [260802-ose-groessenachse-boden-raum](./quick/260802-ose-groessenachse-boden-raum/) |
| 260807-sso | Ergebnislisten mit eigenem Bildlauf (`.vb-scrollbox`): Rad über der Liste bewegt die Liste, daneben die Seite; Filterspalte des Item Finders erstmals bis zur letzten Kategorie erreichbar; 5 seit jeher unsichtbare Bildlaufleisten mitbehoben | 2026-08-07 | a05176a, 7a6824e, 3b28e29, e8fd093, 9ce50d3, 145a9b6, ffd8eea | Verified | [20260807-tabellen-eigener-bildlauf](./quick/20260807-tabellen-eigener-bildlauf/) |

### Roadmap Evolution

- Phase 9 added (15.08.2026): Mining-Werkbank — Fundort-Merkliste. Die mittlere Spalte wird neu belegt: die Detailspalte (Physik, Qualitaetsstufen, „Steine mit diesem Erz") entfaellt ersatzlos und wird spaeter anders dargestellt; die Fundorte-Liste rueckt an ihre Stelle; auf dem frei werdenden Platz entsteht eine anheftbare Merkliste „Erz — Fundort" ueber mehrere Erze hinweg, als benanntes Preset kontogebunden speicherbar (wie `mining_sig_presets`). Anlass: Nutzerwunsch waehrend der Arbeit an den Fundort-Daten (Phase-fremd, haengt an keiner Vorgaengerphase). Datengrundlage ist bereits da — seit 14.08. traegt jedes Mineral seine vollstaendige Fundortliste (521 Paare statt 273).
- Phase 01.1 inserted after Phase 1: Ambiente-Effekte stilllegen — Mauszeiger-Schein raus, Partikel opt-in (Besucher-Rueckmeldung 29.07.2026) (URGENT)
- Phase 01.2 inserted after Phase 1: Werkzeuge erklaeren — Zweck- und Bedienungshilfe je Werkzeug (Besucher-Rueckmeldung 29.07.2026) (URGENT)
- Phase 5 added (31.07.2026): Spenden-Unterstuetzung — Stripe Checkout + Ko-fi, eigene Seite, Ziel und Unterstuetzer-Wand (DON-01…DON-14). ERWEITERT den Meilenstein bewusst ueber die Oberflaeche hinaus (DB-Tabelle, zwei Edge Functions, Zahlungsverkehr); die „Out of Scope"-Zeilen zu serverseitiger Logik und Konto-Funktionen sind fuer diese Phase aufgehoben. Anlass: defektes Netzteil im Entwicklungsrechner, zufaellige Neustarts. Haengt an keiner Vorgaengerphase — Phase 1.1 bleibt geplant liegen und wird NICHT abgebrochen.
- Phase 6 added (02.08.2026): Schiffe — Rollen- und Merkmalsfilter. Granulare, spielgenaue Filter statt acht Wiki-Grobtypen; Datengrundlage neu aus dem DataCore. Beanspruchte zunaechst Nummer 5 und wurde beim staging-Abgleich auf 6 umnummeriert, weil Spenden-Unterstuetzung zuerst auf staging war. ABGESCHLOSSEN, Verifikation 10/10.
- Phase 7 added (03.08.2026): Komponenten-Filter fuer Schiffe — Filter nach Steckplatz-Groesse je Bauteilart, eigener Zweig `claude/gsd-ship-component-filter-f81262`. Beanspruchte zunaechst Nummer 5 und wurde beim staging-Abgleich auf 7 umnummeriert (5 = Spenden, 6 = Rollenfilter waren zuerst da). Vorab-Spike hat die Datenquelle belegt: `Scripts/Entities/Vehicles/Implementations/Xml/<SCHIFF>.xml` (CryXmlB) traegt je Part einen `ItemPort` mit `minSize`/`maxSize`/`Types`; der DataCore-Schiffsrecord fuehrt den Pfad dieser XML selbst als Dateiverweis, der Join braucht also kein Namensraten.
- Phase 7 Plan 1/3 ausgefuehrt (03.08.2026): CryXmlB-Leser + Datamine-Skript liefern 223/227 Schiffe ueber 7 von 8 Bauteilkategorien (Turm folgt in 07-02). Alle vier Hausgates gruen. Details: `.planning/phases/07-komponenten-filter-f-r-schiffe/07-01-SUMMARY.md`.
- Phase 7 Plan 2/3 ausgefuehrt (03.08.2026): Turm-Regel (D-06a, vom Nutzer im blockierenden Checkpoint auf reine `TurretBase`-Ablesung verschaerft) + achte Bauteilart. 47/223 Schiffe tragen `t`. Alle vier Hausgates gruen. Details: `07-02-SUMMARY.md`.
- Phase 7 Plan 3/3 ausgefuehrt (03.08.2026): Zweisprachigkeit + 26 automatisierte `node:vm`-Testfaelle (D-04/D-08/D-10/D-11/D-12). Alle vier Hausgates gruen, Sichtpruefung in beiden Sprachen/Farbmodi/360 px bestaetigt. Details: `07-03-SUMMARY.md`.
- Phase 7 auf staging ausgeliefert und dort abgenommen (03.08.2026, `bfae647`): auf https://staging.verse-base.com/schiffe.html und /de/schiffe.html im Browser bedient. Gemessen: "Waffe ab S5" = 36 Treffer · 4 ohne Steckplatz-Daten (deckt sich mit `ship-components.json`), "Turm ab S5" = 42 (Verteilung 4:5 5:12 6:25 7:2 8:1 10:2 — Haeufung bei S6 ist die uebliche bemannte Turmgroesse), zusammen mit dem Rollenfilter aus Phase 6 = 14. Alle vier Hausgates gruen auf dem committeten Stand (17351 Seiten, 816573 Verweise, 0 FEHLER, 151/151 Tests).
- Phase 7 mit staging zusammengefuehrt (03.08.2026): Phase 6 hatte die beiden Schiffsseiten inzwischen zu EINEM Koerper zusammengelegt. Der Filter wanderte deshalb aus den zwei Seiten in `components/ships/ShipsOverview.astro`; `sf-size` war dort bereits fuer die Schiffs-Groessenklasse vergeben, das Bauteil-Groessenfeld heisst darum `sf-compsize`. **Phase 7 damit abgeschlossen.**

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-15T04:28:49.189Z
Stopped at: Completed 10-02-PLAN.md
Resume file: None
