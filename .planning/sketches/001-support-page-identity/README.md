---
sketch: 001
name: support-page-identity
question: Was führt die Unterstützen-Seite an — das defekte Teil, die Stimme des Betreibers oder die Leute, die schon tragen?
winner: A
tags: [support, identity, payments]
decided: 2026-08-02
---

## Ergebnis (02.08.2026)

**Gewählt: Variante A „Instandsetzung".**

Mit einer Korrektur des Betreibers, die die Variante deutlich verbessert: Der Kern
der Aussage ist NICHT das defekte Bauteil, sondern der **Arbeitsverlust**. Wörtlich:
„es aber so darstellen dass es immer ausgehen kann, und wenn man codet führt es des
öfteren zum progressverlust und dies erschwert die entwicklung enorm."

Ein Sachschaden ist ein schwaches Argument. Verlorene Arbeitszeit an einem Projekt,
das jemand umsonst baut, ist ein starkes.

Festgehalten als D-23 bis D-26 in `../../phases/05-spenden-unterst-tzung/05-CONTEXT.md`
und als verbindliche „§ Gestaltungsentscheidung" am Ende von `05-UI-SPEC.md`.

**Nicht übernommen wird die erfundene Kennzahl** „elf abgebrochene Datenläufe in
vierzehn Tagen" aus dem Entwurf. Sie war ein Platzhalter, um die Textwirkung zu
zeigen. Auf einer Seite, deren Kernwert Faktentreue ist, haben erfundene Zahlen
nichts verloren (D-26).

Das Schaltbild überlebt, ändert aber seine Aussage: nicht „Bauteil defekt", sondern
die Last-Kennlinie, die unter Volllast einbricht.

# 001 — Unterstützen-Seite: drei Identitäten

Eine Datei, drei Richtungen: `index.html` im Browser öffnen. Wegwerf-Skizze,
kein Produktionscode.

## Warum es diese Skizze gibt

Der geplante Bau für Phase 5 hatte Funktion, aber keine Haltung — „wir haben nur
Funktionalität und sonst nichts". Die drei Entwürfe unterscheiden sich deshalb
**nicht in der Dekoration, sondern darin, womit die Seite anfängt.** Alle drei
tragen denselben Pflichtinhalt und dieselben Copy-Strings aus `05-UI-SPEC.md`.

| | Führt mit | Fortschritt erscheint als | Grundton |
|---|---|---|---|
| **A — Instandsetzung** | dem defekten Teil (Explosionszeichnung) | Anzeige mit Teilung + Zahlen-Ablesung | kalt, maßhaltig, Werkstatt |
| **B — Übertragung** | der Stimme (Comm-Link, echter Fließtext) | Satz mit Unterstreichung | still, menschlich, Weißraum |
| **C — Besatzung** | den Leuten (Liste zuerst) | 24 Felder à 5 € | gemeinschaftlich, Register |

## Bedienung

Werkzeugleiste oben: **A / B / C** · **Breite** (360 / 414 / 768 / 1024 / Voll)
· **Hell** · **Demo-Modus**.

- Der Breiten-Umschalter ist echt: die Bühne ist ein `container-type: inline-size`,
  alle Umbrüche laufen über `@container`, nicht über `@media`. 360 px zeigt das,
  was ein Telefon zeigt.
- **Demo-Modus** nimmt die Fortschrittsanzeige *aus dem DOM* — nicht auf 0 %
  gesetzt, sondern gar nicht vorhanden (D-15). Zusätzlich erscheint das
  Demo-Band, die Ko-fi-Zeile verschwindet (D-05).
- Beträge, Rhythmus und freies Feld sind bedienbar; die Knopf-Beschriftung
  folgt wörtlich der Copy-Tabelle („5 € unterstützen" / „5 € monatlich
  unterstützen" / „12 € unterstützen" / „Wird weitergeleitet …").
- Variante C zeigt die belegte Liste **und** darunter denselben Bereich im
  Leerzustand — beide gleichzeitig sichtbar, als Anmerkung gekennzeichnet.

## Was übernommen ist

Tokens und Werte stammen aus `assets/theme.css`, `assets/detail.css`,
`assets/archive.css` und `05-UI-SPEC.md`: Seitenpalette wörtlich aus dem
Vertrag, `--support-gold` `#e8a83c` / `#7a4e05`, Mono-Mikro-Beschriftungen mit
0,18–0,50 em Sperrung, gekappte HUD-Ecken über `clip-path: polygon(…)`,
Haarlinien in `--line`, Strichstärke 1,7 mit stumpfen Enden und Gehrung für die
Zeichnung.

Schriften sind **System-Platzhalter** (Bahnschrift / Segoe UI / Cascadia Mono)
für Orbitron / Rajdhani / Barlow / Share Tech Mono — im Kopf der Datei
kommentiert. Die helle Palette ist von Hand gesetzt; im echten Bau erzeugt sie
`npm run theme`.

## Geprüft

Alle drei Varianten laufen bei 360 / 768 / 1024 / Voll in Hell und Dunkel ohne
waagerechten Überlauf; Kontraste im Hellmodus 6,6 : 1 (Gold auf Grund),
7,2 : 1 (Knopfschrift auf Gold), 15,8 : 1 (Fließtext). Keine Konsolenfehler.
Kein Betrag erscheint je auf einem Wand-Eintrag (D-16).
