# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Star-Citizen-Spieler, die sich über den Aaron Halo informieren — **nicht** im Flug,
sondern lesend und stöbernd, ohne dass gerade eine Route gebraucht wird
(vom Betreiber am 26.07.2026 bestätigt). Der Rechner ist Teil des Nachschlagens,
nicht der einzige Zweck der Seite. Zweisprachig DE/EN, kein Konto erforderlich.

## Product Purpose

VerseBase ist ein inoffizielles Fan-Kompendium zu Star Citizen. Die Seite
`/precision-jump.html` erklärt den Aaron Halo und stellt dazu einen Routenrechner:
Zwischen zwei von 25 QT-Ankern wird die Quantum-Reiselinie gelegt und der exakte
Austrittspunkt für ein gewünschtes Dichteband berechnet.

## Positioning

Anker- und Halo-Geometrie sind aus den Spieldaten der Version 4.9 gewonnen, nicht
aus Community-Schätzungen abgeleitet. Die eingesandten Werte wurden dagegen
validiert und in einem Fall (MIC-L5) korrigiert. Nur die zehn Dichtebänder
stammen aus einer externen Vermessung (cstone.space).

## Operating Context

Gelesen am Schreibtisch, überwiegend am Desktop, ohne Zeitdruck. Die Seite muss
längere Erklärtexte tragen können; der Rechner ist ein Werkzeug **im** Text, keine
Instrumententafel. Reines Client-Werkzeug ohne Serverlogik, indexierbar.

## Capabilities and Constraints

- 40 QT-Anker (Planeten, Monde, Lagrange-Punkte), 10 Halo-Dichtebänder,
  System Stanton, Spielstand 4.9. (Zahl aus dem gerenderten Wert, nicht geschätzt.)
- Rechnet vollständig im Browser; keine Anmeldung, keine Serverabfrage.
- Statisches Astro-Build hinter nginx — serverseitiger Code ist nicht möglich.
- DE- und EN-Fassung müssen inhaltlich deckungsgleich bleiben.
- Astro-Insel `PrecisionJumpApp.astro` trägt Rechner, Karte, Tabellen; die
  Seitenhülle liefert Hero, Erklärung und Einordnung.

## Brand Commitments

- Namensnennung **Jordessey** (Werkzeug und Routendaten) und **cstone.space**
  (Vermessung der Dichtebänder) bleibt sichtbar. Nicht verhandelbar.
- Kein Hinweis auf die Herkunft der Spieldaten im sichtbaren Text (site-weite Regel).
- Die Seite soll sich in die bestehende Site-Bildsprache **einfügen**, statt eine
  weitere eigene aufzumachen (vom Betreiber am 26.07.2026 bestätigt).

## Evidence on Hand

- `src/data/precision-jump.ts` — Anker und Bandtabelle, aus den Spieldaten erzeugt.
- `scripts/datamine-stanton-anchors.mjs`, `scripts/datamine-aaron-halo.mjs` — die Extraktoren.
- Keine Nutzerzahlen, keine Testimonials, keine Reichweitendaten. Nichts davon erfinden.

## Product Principles

1. Verständnis vor Bedienung — wer die Seite verlässt, soll den Aaron Halo begriffen haben.
2. Herkunft jeder Zahl bleibt nachvollziehbar; Geschätztes wird als geschätzt gekennzeichnet.
3. Fremde Arbeit wird benannt, nicht eingemeindet.
4. Was der Rechner ausgibt, muss ohne Interpretationshilfe im Spiel benutzbar sein.
5. Deutsch und Englisch sind gleichrangig, nicht Original und Übersetzung.

## Accessibility & Inclusion

Keine produktspezifische Anforderung erhoben. Es gilt der Site-Standard WCAG AA,
den der laufende Detector-Durchgang auf dieser Seite aktuell an drei Stellen
verfehlt.
