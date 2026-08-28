---
status: testing
phase: 20-wikelos-angebote-kommen-aus-dem-bestand
source: [20-VERIFICATION.md, 20-REVIEW.md]
started: 2026-08-28T12:50:00.000Z
updated: 2026-08-28T12:50:00.000Z
---

# Phase 20 — Sichtrunde und offene Urteile

Die Phase ist technisch vollständig: 4 von 4 Plänen ausgeführt, alle vier
ROADMAP-Erfolgskriterien belegt, `npm run build && npm run gate` 23/23 grün
(normal und mit `STAGING=1`). Was hier steht, ist ausschließlich das, was
kein Skript entscheiden kann.

**Vorbedingung für Block 3:** `npm run check:staging` — die Blöcke sind am
ausgelieferten staging-Stand zu beurteilen, nicht am lokalen Build.

## Current Test

Block 1 (Register id 55) — steht als erstes an.

## Tests

### 1. Register id 55 (D-02) — echtes Angebot oder Werkstattrest?

Fünf bzw. sechs Verträge sind unkuratiert geblieben, darunter
`Wikelo Arrive to System` (ohne Belohnung, offensichtlich ein Intro-Vertrag).

**Zu entscheiden:** Welcher dieser Verträge erscheint überhaupt als Tauschkarte,
und mit welchem Bild bzw. welcher Ausstattung?

**Erwartet:** Betreiber-Sichturteil am laufenden Spiel, nachgetragen in
`assets/wikelo-curated.json`, danach `WINDOWS.md` id 55 schließen.

**Warum menschlich:** „Echtes Angebot vs. Werkstattrest" darf kein Skript
entscheiden — die Zuordnungssonde hat diese Fälle ausdrücklich als
unauflösbar markiert, statt zu raten.

- [ ] entschieden

### 2. Register id 56 (D-03) — welcher ATLS-Auftrag trägt welchen Namen?

Vier Fälle: `OrangeNGrey`, `WhiteNGreen`, sowie `Make ATLS shoot` gegen
`Make jumpy ATLS shoot` (IKTI vs. IKTI_GEO). Die Materialmengen der letzten
beiden unterscheiden sich **nur** in der Favor-Zahl (2 gegen 1); beide
Handkarten passen textlich auf beide Verträge.

**Zu entscheiden:** Welcher Auftrag trägt welchen Namen und welches Bild?

**Erwartet:** Sichturteil am laufenden Spiel, nachgetragen in
`assets/wikelo-curated.json`, danach `WINDOWS.md` id 56 schließen.

**Warum menschlich:** Jede automatische Zuteilung wäre hier ein Münzwurf.
Bereits gelöst und **nicht** Teil dieser Entscheidung: `RedNBlue` =
„ATLS GEO Cool Metal" (exakter Materialabgleich, in Plan 01 umgesetzt).

- [ ] entschieden

### 3. Register id 57 — Sichtrunde an der Wikelo-Seite

Je DE **und** EN, beide Farbmodi, 1920×1080 **und** 1280×720.

**(a) Anzeigenamen.** 53 der 69 Karten tragen jetzt einen von der Kuration
überschriebenen Belohnungsnamen statt der kurzen Handlisten-Bezeichnung.
Liest sich das an Karten mit *und* ohne Überschreibung weiterhin als
Angebot — oder wie eine Katalogzeile?

**(b) Platzhalter statt Foto.** 18 von 69 Karten zeigen das Kategoriesymbol:
17, weil keine Kuration ein Bild trägt, und eine zusätzlich (`Guardian MX`),
weil `wk-guardian.png` bereits zweimal auf der Seite steht und die bestehende
Bild-Regel ab dem dritten Vorkommen den Platzhalter erzwingt — das ist keine
Folge dieser Phase. Wirkt die Reihe als Lücke, oder trägt das Symbol?

**(c) Filter-Pillen.** Verteilung laut Selbstauskunft: ship 36, weapon 9,
armor 8, conv 5, misc 11 — Summe 69. Jede Pille einmal durchklicken und die
Trefferzahl dagegen halten.

**(d) Berichtigte Quellenangabe.** Liest sich der Absatz unter dem Raster
(jetzt „Spielversion: Alpha 4.10.0" statt der festen Patch-Nummer 4.8.1) als
Aussage über den eigenen Stand? Und bleibt `wikelotrades.com` als Quelle für
Bilder, Ausstattung und Reputationstext erkennbar zugeschrieben?

- [ ] abgenommen

## Bereits erledigt — keine Handlung nötig

Der Verifier hatte für die zwei Critical-Befunde aus `20-REVIEW.md` verlangt:
*entweder beheben oder bewusst als getrackte Schuld ins Register aufnehmen —
nicht stillschweigend liegen lassen.* Der zweite Weg ist gegangen:

- **CR-01** (Zuordnungssonde, Eindeutigkeit nur pro Schlüssel) → `WINDOWS.md`
  **id 58**. Read-only nachgemessen: der Befund ist **latent, nicht
  eingetreten** — die Sonde meldet 59↔59 als saubere Bijektion und alle drei
  Mehrdeutigkeiten namentlich. Der ausgelieferte Datenstand ist in Ordnung;
  das Risiko betrifft den nächsten Datenlauf.
- **CR-02** (`contractCount`/`orderLineCount` ungegengerechnet) → `WINDOWS.md`
  **id 59**. Die Sperrklinke funktioniert heute nachweislich (in Plan 03
  dreimal vorgeführt rot); der Mangel ist die fehlende Gegenrechnung.

Beide bleiben offene Registerpunkte und blockieren `/gsd-ship`, bis sie
behoben oder bewusst gewaivt sind.

## Summary

Offen: drei Urteilsblöcke (Register id 55, 56, 57).
Erledigt: CR-01 und CR-02 als Register id 58/59 erfasst.

## Gaps

Keine — die vier ROADMAP-Erfolgskriterien sind belegt. Was hier steht, ist
Sichturteil, keine Lücke in der Umsetzung.
