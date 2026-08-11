---
title: "Mining-Seite als Drei-Spalten-Werkbank — Entscheidungen und Fallen"
date: 2026-08-11
context: "/gsd-explore — Nutzerwunsch: Werkzeug ohne Scrollen sichtbar, Minerale links, Ansicht Mitte, Signaturliste rechts"
branch: claude/mining-site-redesign-c8c523
---

# Mining-Seite als Drei-Spalten-Werkbank

## Anlass

Wörtlich: *„when you open the site the tool in its entirety visible. so you don't
have to scroll down to see stuff. i want all the minerals listed on the left side
of the screen, in the middle should be the view panel which shows you the infos
and stuff for the mineral you clicked on the left side. also the signature list
should be on the right side of the screen."*

Dieselbe Haltung wie bei der Schiffsübersicht: **Werkzeug, keine Leinwand.**

## Ist-Zustand

`/topics/mining.html` (+ `/de/…`) ist eine Scrollseite mit Hero und fünf
gestapelten Abschnitten — `src/components/topics/mining.astro:86-133`:

| # | Abschnitt | Komponente |
|---|---|---|
| — | Hero mit MOLE-Bild + Sterne-Canvas | `topics/mining.astro:87-96` |
| 01 | Mineral-Datenbank | `MiningApp.astro` (440 Z.) + `assets/mining-app.js` (344 Z.) |
| 02 | Scan-Signatur-Identifier | `SignatureIdentifier.astro` |
| 03 | Fracturing-Rechner | `FracturingCalc.astro` |
| 04 | Refinery Finder | `RefineryFinder.astro` |
| 05 | Mining-Schiffe | inline in `topics/mining.astro:133` |

**Die teuerste Doppelung:** Abschnitt 02 lässt den Nutzer die Erze **ein zweites
Mal** auswählen, unabhängig von der Mineral-Datenbank direkt darüber
(`SignatureIdentifier.astro:1-8`: „Du wählst gezielt Erze aus → nur diese
erscheinen in der Tabelle"). Zwei Auswahl-Zustände für dieselbe Menge Minerale.

## Die fünf Entscheidungen

| # | Entscheidung | Folge |
|---|---|---|
| 1 | Fünf Abschnitte → **drei Spalten**. Fracturing und Refinery werden in die Mittelspalte **eingefaltet** — als Antworten *zu diesem Mineral*, nicht als eigene Rechner | Das Detail-**Modal** entfällt. Schiff-Abschnitt fällt weg, stattdessen Links auf `/schiffe/<slug>` (`src/lib/miningShips.ts` hat den Join schon) |
| 2 | **Dauerhafte Rig-Leiste**: Laser + bis zu 3 Module + Gadget + Refinery/Methode, kontogebunden | Einmal setzen, jedes angeklickte Mineral wird für *dieses* Setup beantwortet. Erlaubt ein Urteil je Mineral in der linken Liste — brechbar / grenzwertig / nein |
| 3 | Rechte Spalte = **von Hand angeheftete** Signaturliste, kontogebunden | Nicht angemeldet → `localStorage`; angemeldet → Konto. Muster steht in `assets/crafting-app.js:212` (`VB.session()`, Gast-Marker für die Übernahme beim Anmelden) |
| 4 | Schmales Fenster: **eine Spalte + Segment-Umschalter** (Minerale / Detail / Signaturen) | Gleiches DOM, reine CSS-Umschaltung. Keine zweite Auszeichnung, kein History-/Zurück-Handling |
| 5 | **Schmaler Titelstreifen**, Spalten darunter. URL bleibt `/topics/mining.html` | `hero--tool` existiert bereits: `ItemFinderPage.astro:54` → `min-height:0`. Bisher nur dort benutzt. Facts/Attribution unter die Spalten |

### Bewusst verworfen

- **Reiter in der Mittelspalte** (Detail / Fracturing / Refinery / Schiffe) — hätte
  vier fremde Werkzeuge in einen Bereich gestopft, der Ergebnisse zeigen soll.
- **Eigene Routen** für Fracturing und Refinery — trennt, was zu einer Tätigkeit
  gehört, und zerlegt eine indexierte Seite in drei schwache.
- **Signaturliste folgt den linken Filtern** (mein Vorschlag: Filter auf Yela →
  nur dortige Erze, ohne Anheften) — Nutzer will die Liste ausdrücklich selbst
  kuratieren **und kontogebunden** haben.
- **Voller App-Shell auf 100 vh ohne Hero** — Nutzer wählte den schmalen
  Titelstreifen; die Seite soll noch zur Site gehören.
- **Hero unverändert lassen** — widerspricht dem Kernwunsch.

## Fallen — verifiziert, nicht erinnert

### 1. ⚠⚠ Dieser Zweig hat das Tor nicht

`claude/mining-site-redesign-c8c523` steht **exakt auf `origin/main`** (46ba9e3)
und ist **11 Commits hinter `origin/staging`** (42d2dcd).

`npm run gate`, `scripts/run-gate.mjs`, `scripts/lib/gate-registry.mjs`,
`npm run smoke`, `verify:metrics` existieren **nur auf `origin/staging`** —
auf `origin/main` fehlen sie vollständig (per `git ls-tree` geprüft).

Das Projektgesetz „vor jedem Push `npm run build && npm run gate`, beides grün"
ist von diesem Zweig aus **nicht ausführbar**. → **Vor Baubeginn auf `staging`
aufsetzen**, nicht auf `main`.

### 2. Scrollbalken sind site-weit abgeschaltet

`assets/theme.css` blendet mit `html, body, *{scrollbar-width:none!important}`
**jede** Leiste aus. Drei innen scrollende Spalten heißt: drei Einträge in die
Selektorliste `assets/mobile-ux.css:503-516` (dokumentiert bei :558-560), sonst
ist die Spalte unsichtbar scrollbar. Utility `.vb-scrollbox` bei :563.

*(Der in älteren Notizen erwähnte `assets/edge-fade.js` existiert weder auf
`main` noch auf `staging` — nicht danach suchen.)*

### 3. `verify:mining` ist **jetzt** rot

```
game_version (4.9.0-live.12326004) stimmt nicht mit dem
installierten Client ueberein (4.9.0-live.12344265)
```

Bekannter Schuldenposten (Patch-Verzug), nicht durch diesen Umbau verursacht —
aber er darf am Ende nicht als „Regression des Redesigns" gelesen werden.

### 4. Die fehlende Patch-Zeile ist Absicht

`TopicFacts.astro:40,71` blendet die Herkunfts-/Debüt-Zeile bei `evergreen`
aus. Mining ist bewusst vom 4.8.0-Patch entkoppelt (Evergreen-Werkzeug, Daten
4.9). **Nicht als Bug re-koppeln.**

## Messlatte für „fertig"

Nicht „sieht kompakter aus", sondern Zahlen — wie bei der Schiffsseite:

- Filterkonsole **und** erste Mineralzeile über der Falz, gemessen bei **1280×720**.
- Wie viele Mineraleinträge stehen bei 1920 / 1440 / 1366 / 1280 / 390 über der Falz?
- Referenz im Projekt: `hero--tool` → `min-height:0`, laut Projektgedächtnis
  273 px gemessen (item-finder).
- DE **und** EN — „fertig" gilt erst für beide.
- Erst das gerenderte Bild ansehen, dann melden.

## Durch die Skizzen entschieden (11.08.2026)

Drei Skizzen, alle Zahlen am gerenderten Mockup gemessen. Belege in
`.planning/sketches/00{2,3,4}-*/`.

| # | Frage | Ergebnis |
|---|---|---|
| 002 | Wo sitzt die Rig-Leiste? | **Unten, verschmolzen mit dem Sockel.** Beide waren Boden-Chrom; zusammen kosten sie *eine* Leiste. Erste Mineralzeile bei **162 px**, **12 von 19** Zeilen über der Falz bei 1280×720 |
| 003 | Wie dicht darf die Mittelspalte werden? | **Zweispaltig innerhalb der Spalte.** Die befürchtete Überfüllung war ein Ein-Spalten-Problem: bei 768 px Breite passen alle 10 Fundorte *und* die Refinery ohne Scrollen und ohne Klick — mit 298 px Luft |
| 004 | Wie hochwertig verarbeitet? | **Zurückgenommen.** Verarbeitung wäre gratis gewesen (0 px Überlauf in allen drei Stufen), gewählt wurde trotzdem der schlichteste Weg. „Hochwertig" heißt hier Präzision, nicht Detail |

**Wichtigster Einzelbefund:** Der Titelstreifen kostet **42 px**. `hero--tool`
(`ItemFinderPage.astro:54`) wurde im Projekt mit 273 px gemessen. **Der Hero war
nie das Problem dieser Seite — die fünf gestapelten Abschnitte waren es.**

**Zusatz zur Fallenliste:** In der gewählten Kombination gibt es **fünf** innen
scrollende Kästen (3 Spalten + 2 Teilspalten in der Mitte), nicht drei. Alle
fünf müssen in `assets/mobile-ux.css:503-516`.

## Offen

- Findet ein Erstbesucher die Rig-Einstellung, wenn sie unten sitzt? Nur an
  echten Augen prüfbar, nicht am Mockup.
- Tabelle + RLS für die angehefteten Signaturen → eigener Todo.
- Was passiert mit `RefineryFinder.astro` als Komponente — ganz auflösen oder als
  Block in der Mittelspalte weiterverwenden?
- Die 298 px Luft in der rechten Teilspalte sind ein Angebot, kein Rest. Was
  dort hineinkommt, muss beim Aussieben helfen — sonst wird die Seite wieder
  Leinwand.
