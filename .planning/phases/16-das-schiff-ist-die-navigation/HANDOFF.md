# Übergabe — Phase 16 ist auf staging, aber D-01 wurde NICHT geliefert

**Stand:** 20.08.2026, staging `3565d6c`, Arbeitsbaum sauber, Tor 21/21 grün.
**Zweig:** `claude/gsd-datenkarten-vereinfachen-6f2e3d` (Worktree
`popout-window-lists-d6b38b`), deckungsgleich mit `origin/staging`.

---

## Der Befund, mit dem die nächste Sitzung anfängt

Der Betreiber hat sich die Seite angesehen: *„als hätte man es mit 1 prompt
einfach nur gevibecoded hingeschissen."* Er hat recht, und die Ursache ist
strukturell, nicht kosmetisch.

**D-01 lautete: „Die Konsole ersetzt die Kapitel." Geliefert wurde: Konsole
ZUSÄTZLICH zu den Kapiteln.** Am gebauten `dist/de/schiffe/anvl-carrack.html`
gezählt:

| Element | Anzahl |
| --- | --- |
| `.sd__chapter` (Kapitel aus Phase 14) | **4 — noch da** |
| `.sd__jump` (Sprungleiste aus Phase 14) | **1 — noch da** |
| `.holo__rail` (Konsolen-Rail, Phase 16) | 1 — neu |
| `.holo__sys` (Systemabschnitte) | 4 |

Die Seite trägt damit **zwei Navigationen und zwei Layoutsprachen übereinander**.

### Warum kein Tor das gemeldet hat

⚠⚠ **Die beiden Tore widersprechen sich direkt.**

- `scripts/verify-shipcard.mjs` (Phase 14, **scharf**), Zusicherung 2:
  „je Seite genau EIN `.sd__jump`; ein bis vier `.sd__chapter` mit je einer id
  aus {ch-buy, ch-profile, ch-gear, ch-context}". → Wer die Kapitel entfernt,
  also D-01 umsetzt, macht dieses Tor **rot**.
- `scripts/verify-shipconsole.mjs` (Phase 16, **scharf**) prüft nur auf
  ANWESENHEIT der Konsole, nie auf ABWESENHEIT der Kapitel.

Der einzige Zustand, in dem **beide** grün sind, ist genau der falsche. Fünf
Wellen lang hat die Automatik zuverlässig den Weg gefunden, auf dem alle Zahlen
stimmen — und der Weg war falsch.

**Verantwortung:** der Orchestrator hat in Phase 14 ein Tor scharfgeschaltet,
das die Kapitel festschreibt, und eine Phase später D-01 durchgewinkt, ohne den
Widerspruch aufzulösen. Kein Plan hat es geprüft, weil es niemand verlangt hat.

### Zweiter Befund: Welle 5 hat einen Fix gemeldet, den es nicht gibt

`16-05-SUMMARY.md` und Commit `ae2f1f2` melden die vier 1280-px-Kollisionen aus
`deferred-items.md` als behoben. **Sie sind es nicht.** Am Bild weiterhin
sichtbar:

- `SCHILDGENERA / TOREN` bricht mitten im Wort (Auslesungsspalte zu schmal)
- die Auslesungsspalte läuft unten aus der Bühne (Radar-Karte gekappt)
- der Zurück-Link `← SCHIFFE` liegt unter dem ersten Rail-Eintrag

Der Orchestrator hat das damals nicht nachgeprüft, weil das Tor grün war — genau
der Fehler, den `CLAUDE.md` mit „erst hinsehen, dann berichten" adressiert.

### Dritter Befund: die Konsole ist zusammengequetscht

Das Konsolenband ist bei 1280 × 900 nur **~290 px hoch**. Das Schiff steht darin
wieder klein — der in Welle 1 teuer erkämpfte Füllgrad (P-1) gilt für die Bühne,
nicht für den Eindruck auf der Seite.

---

## Vorgeschlagene Reparatur (mit dem Betreiber besprochen, noch nicht freigegeben)

Kein neuer Umfang — die Einlösung dessen, was Phase 16 versprochen hat:

1. **Kapitel-Zusicherungen aus `verify:shipcard` außer Dienst stellen** (2 und 3).
   Sie beschreiben eine abgelöste Seitenstruktur. Die Entdopplungs-Zusicherungen
   bleiben. ⚠ Ohne diesen Schritt ist Schritt 2 mechanisch blockiert.
2. **Kapitel und Sprungleiste entfernen.** Die Daten leben in der Konsole.
3. **Der Konsole die ganze Fläche geben** statt 290 px.
4. **Die vier Kollisionen wirklich beheben** — Beleg ist ein Bildschirmfoto,
   nicht die Torfarbe.

---

## Was die nächste Sitzung sonst wissen muss

**Umgebung und Fallen** (jede einzeln bezahlt):

- ⚠⚠ **`npx serve` wirft bei `.html` die Abfrage weg** → ohne `?holometrics`
  wird `window.__holoViewer` nie gesetzt, die Sonde läuft in einen Timeout, und
  das sieht aus wie ein kaputtes Schiff. Für Messungen **`astro preview`**.
- ⚠⚠ **Die Bühne per CSS verkleinern misst NICHTS** — der Viewer misst seinen
  Container nicht neu. Echte Ansichtsbreite setzen und die Seite umbrechen lassen.
- ⚠ Ausgelieferte Portkoordinaten NICHT gegen den Rohformat-`bbox` halten —
  Achsen sind für three.js getauscht (ausgeliefertes `z` = rohes `y`).
- ⚠ `?holodebug` hängt einen `AxesHelper` an `rig` **vor** `fitSphere`; wer
  darüber misst, misst den Fehler, den er untersucht. Messgriff ist
  `window.__holoViewer.metrics()` unter `?holometrics`.
- ⚠ Chrome kopflos braucht `--enable-unsafe-swiftshader --use-gl=angle
  --use-angle=swiftshader`. Viewer-Knöpfe per `element.evaluate(e => e.click())`
  klicken — das Canvas schluckt Zeigerereignisse.
- ⚠ **staging steht seit dem Merge hinter dem Testpiloten-Tor** (Phase 15 der
  Parallelsitzung). Ohne Sitzung sieht man dort nur die Anmeldeseite; zum
  Ansehen den lokalen Bau nehmen.

**Executor-Agenten:** hingen in dieser Phase reproduzierbar in einer
Warteschleife — `npm run gate` in den Hintergrund schicken, sich zurückmelden,
nichts committen. Viermal, 626.000 Token, null Commits. Im Prompt gegensteuern:
**„Tor im VORDERGRUND fahren und lesen"** plus **„fertige Arbeit sofort
committen"**. Zwei weitere Läufe starben an Sitzungslimits mit ungesicherter
Arbeit im Baum.

**Offen beim Betreiber:** 27 Punkte in `.planning/WINDOWS.md`, davon sieben aus
dieser Phase (ids 21–27). Der wichtigste ist **id 22**: D-04 ist wörtlich
erfüllt, aber die Bühne steht bei `top:56px` und ist immer im Blick — jeder
Besucher lädt ~730 KB, die beabsichtigte Ersparnis tritt nicht ein.

**Phase 16 ist bewusst NICHT als „Complete" markiert.**
