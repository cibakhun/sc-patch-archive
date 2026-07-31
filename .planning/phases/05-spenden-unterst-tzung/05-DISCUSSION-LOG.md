# Phase 05: Spenden-Unterstützung - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 05-Spenden-Unterstützung
**Areas discussed:** Platzierung site-weit, Ziel & Ehrlichkeit, Unterstützer-Wand, Beträge & Rechtsrahmen

---

## Vorgelagert: Zahlungsweg und Zielart

Vor dem Anlegen der Phase abgefragt, weil beides die Architektur bestimmt.

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Stripe Checkout | Betrag frei, einmalig/monatlich, gehostete Bezahlseite, Edge Functions nötig | ✓ |
| Ko-fi | Gehostete Spendenseite, nur ein Link | ✓ |
| PayPal | PayPal.me-Link, kein sauberer Webhook | |
| Alle drei nebeneinander | Maximale Reichweite, mehr Konfiguration | |

**Wahl:** Stripe Checkout + Ko-fi.

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Ja, Serverkosten anzeigen | Ziel-Balken mit konfiguriertem Wert | ✓ |
| Kein Ziel, nur Danke | Ohne Zahlen-Ziel | |
| Ziel ohne konkrete Summe | Unterstützerzahl statt Euro | |

**Wahl:** Ziel anzeigen.
**Notiz (wörtlich):** „Ja, mein Netzteil geht kaputt, mein pc restartet sich random,
schwierig zu entwickeln..." — der Anlass ist die Rechner-Reparatur, nicht Serverkosten.
Diese Konkretheit wurde zum Kern der Seite gemacht (D-11).

---

## Vorgehen

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| GSD, eigene Phase | /gsd-phase, dann discuss → plan → execute → review → secure → verify | ✓ |
| Direkt bauen, ohne GSD | Schneller, ohne Artefakte und .planning-Spur | |
| GSD light: nur plan + execute | Mittelweg ohne Roadmap-Eintrag | |

**Notiz:** Vor der Frage wurde offengelegt, dass bis dahin KEIN GSD im Einsatz war
(die Codebase war direkt gelesen worden) und dass der Cursor von der laufenden
Phase 1.1 wegwandern würde.

---

## Platzierung site-weit

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Fuß + Menü-Overlay | Zwei Stellen auf jeder Seite, Kopfleiste unangetastet | ✓ |
| Zusätzlich in der Kopfleiste | Maximale Sichtbarkeit, verdrängt dort aber etwas | |
| Nur die eigene Seite | Am zurückhaltendsten, sehr wenige Spenden | |
| Schwebender Knopf | Am auffälligsten, passt nicht zur FX-Entscheidung aus Phase 1.1 | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Nein — nur Fuß und Menü | Kein zusätzlicher Einschub | |
| Ja, auf den Werkzeugseiten | Dezenter Streifen dort, wo Nutzen entstanden ist | ✓ |
| Ja, auf allen Seiten | Maximale Reichweite, maximale Wiederholung | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Im Grauwert wie die übrigen Nav-Elemente | Fügt sich ein | |
| Akzentuiert, hebt sich ab | Nutzt die Seitenpalette, sieht überall anders aus | |
| Eigene, feste Farbe | Wiedererkennbar, bricht bewusst mit der Seitenpalette | ✓ |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| /support.html | Englischer Slug wie item-finder, precision-jump, feedback | ✓ |
| /unterstuetzen.html | Deutscher Slug wie archiv, schiffe, missionen | |
| /spenden.html | Deutscher Slug, legt „Spende" fest | |

**Notiz:** Die feste Farbe wurde beim Notieren um eine Auflage ergänzt — sie muss
als Token in beiden Farbmodi gesetzt werden, weil der Hellmodus-Generator nur
inline-`<style>` in `.astro` sieht.

---

## Ziel & Ehrlichkeit

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Wörtlich: defektes Netzteil | Konkret, überprüfbar, menschlich | ✓ |
| Allgemeiner: Entwicklungsrechner | Nennt den Anlass ohne das Teil | |
| Ganz allgemein: Technik & Zeit | Kein Blick ins Private, bewegt aber niemanden | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Eurobetrag-Balken | „35 € von 120 €", aus echten Zahlungen | ✓ |
| Nur Unterstützerzahl | Zeigt Wirkung ohne Einnahmen offenzulegen | |
| Beides nebeneinander | Vollständigste Information, zwei konkurrierende Zahlen | |
| Gar kein Fortschritt | Am zurückhaltendsten | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Als erreicht markieren, Spenden bleiben offen | Ziel sichtbar abgeschlossen | ✓ |
| Neues Ziel eintragen | Fortlaufende Finanzierung | |
| Spendenweg schließen | Maximal glaubwürdig, verschenkt Unterstützung | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| ~120 € — nur das Netzteil | Klein, glaubwürdig, schnell erreichbar | ✓ |
| ~250 € — plus Ersatzteile | Realistischer bei größerem Schaden | |
| ~600 € — Ersatzrechner | Nur ehrlich, wenn tatsächlich geplant | |

---

## Unterstützer-Wand

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Name + Datum, kein Betrag | Alle gleichrangig, keine Rangliste | ✓ |
| Name + Betrag + Datum | Transparent, Balken nachrechenbar, aber Rangliste | |
| Name + Nachricht + Datum | Liest sich als Gästebuch, verlangt Prüfung | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Anonym, Nennung per Häkchen | Einwilligung statt Widerspruch | ✓ |
| Genannt, Anonymität per Häkchen | Vollere Wand, aber oft der Klarname | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Ja, aber erst nach Freigabe | Schutz gegen Missbrauch, ein Handgriff pro Spende | ✓ |
| Ja, sofort sichtbar | Kein Aufwand, aber Haftung für fremden Text | |
| Nein, keine Nachrichten | Nichts zu moderieren, reine Namensliste | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Ja, Handle + Unterstützer-Abzeichen | Verbindet Spenden mit dem Kontosystem | ✓ |
| Ja, aber nur der Handle | Weniger Berührung mit Konto-Code | |
| Nein, nur ein frei gewählter Name | Am einfachsten, jeder kann sich als jeder ausgeben | |

**Notiz:** Aus der Moderations-Wahl folgt eine echte Bedienoberfläche zum Freigeben
und Ablehnen — beim Notieren ausdrücklich festgehalten (D-18), damit sie nicht als
bloße Datenbankspalte endet.

---

## Beträge & Rechtsrahmen

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| „Unterstützen" / „Support" | Verspricht keine Spendenquittung | ✓ |
| „Spende" / „Donation" | Geläufiger, weckt falsche Erwartung | |
| „Spende" plus Klarstellung | Reichweite und Ehrlichkeit, kostet eine Zeile | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| 3/5/10/25 € + freie Eingabe | Niedriger Einstieg, bewegt den 120-€-Balken sichtbar | ✓ |
| 5/10/20/50 € + freie Eingabe | Weniger Spender nötig, Gebühren fallen weniger ins Gewicht | |
| Nur freie Eingabe | Am neutralsten, eine Entscheidung mehr | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Beides, einmalig vorausgewählt | Passt zum einmaligen Ziel | ✓ |
| Nur einmalig | Ein Weg, verschenkt dauerhafte Unterstützer | |
| Beides, monatlich vorausgewählt | Verlässliche Einnahmen, wirkt aufdringlich | |

| Option | Beschreibung | Gewählt |
|--------|--------------|---------|
| Zweiter Weg, sichtbar aber nachgeordnet | Ein klarer Hauptweg | ✓ |
| Gleichrangig nebeneinander | Ko-fi-Zahlungen fehlten still in den Zahlen | |
| Nur ein Fußnoten-Link | Ko-fi faktisch ungenutzt | |

**Notiz:** Zur Wortwahl wurde ausdrücklich vermerkt, dass dies eine Einordnung und
keine Steuerberatung ist.

---

## Abschluss: Kontostand

| Frage | Antwort |
|-------|---------|
| Stripe-Konto | Noch keins — legt der Betreiber selbst an |
| Ko-fi-Konto | Noch keins — legt der Betreiber selbst an |
| Bereit für die Planung | Ja |

**Folge, in CONTEXT.md als D-05 festgehalten:** Erfolgskriterium 1 der Roadmap
(„echte Zahlung im Testmodus läuft durch") kann in dieser Phase nicht von Claude
belegt werden. Es wird zur Nutzer-Abnahme, sobald die Schlüssel stehen. Zur Phase
gehört stattdessen eine Einrichtungsanleitung, und ohne Schlüssel läuft alles
sichtbar im Demo-Modus.

---

## Claude's Discretion

Vom Betreiber nicht abgefragt, weil Umsetzungsdetail — in CONTEXT.md § Claude's
Discretion aufgeführt: Tabellenschema und Spaltennamen, Namen der Edge Functions
und Konstanten, Idempotenz-Mechanik des Webhooks, CSS-Klassenpräfix, Bauform des
Werkzeugseiten-Streifens, technische Übergabe von Zustimmung und Anzeigename an
Stripe, genaue Optik von Balken, Wand und Betragsauswahl, Ort der
Freigabe-Oberfläche.

## Deferred Ideas

- Ko-fi-Webhook, damit auch Ko-fi-Zahlungen in Balken und Wand einlaufen
- Unterstützer-Stufen mit Gegenleistung
- Buchhaltungs-/Umsatzübersicht für den Betreiber
- Automatisch nachrückende Folgeziele nach Zielerreichung
