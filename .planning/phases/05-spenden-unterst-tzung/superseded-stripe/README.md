# Überholt: die Stripe-Fassung von Phase 5

**Abgelegt:** 2026-08-02
**Grund:** Der Betreiber kann Stripes Identitätsprüfung nicht erbringen (Ausweis
nicht verfügbar). Ohne sie zahlt Stripe kein Geld aus — der Testmodus läuft, echtes
Geld käme nie an. Eine tadellos gebaute Anbindung, die nie auszahlt, ist wertlos.

Gewählt wurde stattdessen ein **einfacher PayPal-Link**: kein Server, keine
Datenbank, keine Edge Function.

## Was hier liegt

| Datei | Inhalt |
|---|---|
| `05-01-PLAN.md` … `05-07-PLAN.md` | Die sieben vom Plan-Prüfer freigegebenen Stripe-Pläne (7 Wellen, 21 Aufgaben, Bedrohungsmodelle) |
| `05-STRIPE-ADDENDUM.md` | Der Abgleich gegen Stripes offizielle Leitlinie, S-01…S-07 |

## Warum nicht gelöscht

Zwei Gründe.

**Erstens: das meiste ist anbieterneutral.** Die Datenschicht (Tabelle, RLS,
öffentliche View, Aggregat), die Idempotenz über eine Eindeutigkeitsbedingung, die
Torstellung für eine öffentlich erreichbare Edge Function, die Trennung von
Anzeigedaten und Zahlungsreferenzen — all das gilt für PayPal genauso. Kommt später
ein PayPal-**Geschäftskonto** mit Webhook, sind diese Pläne die fertige Vorlage;
zu ersetzen wären im Wesentlichen die Ereignisnamen und die Signaturprüfung.

**Zweitens: die Begründungen sind teuer erarbeitet.** In `05-01-PLAN.md` steht,
warum `verify_jwt` in eine committete `config.toml` gehört und nicht ans
CLI-Flag (das fällt beim nächsten Deploy still zurück). In
`05-STRIPE-ADDENDUM.md` steht, warum `payment_method_types` nie übergeben werden
darf (es schaltet SEPA, Klarna und Apple Pay ab, ohne Fehlermeldung). Solche
Funde noch einmal zu machen kostet mehr, als sie aufzuheben.

## Was daraus in die PayPal-Fassung übergeht

Nichts davon automatisch. Die neue Planung startet frisch — aber gegen dieselben
Kontext- und Gestaltungsentscheidungen (`05-CONTEXT.md` D-07…D-11, D-15,
D-21…D-32) und denselben UI-Vertrag (`05-UI-SPEC.md` samt der verbindlichen
Gestaltungsentscheidung am Ende).

`05-RESEARCH.md` bleibt eine Ebene höher liegen: sein Abschnitt zur Datenschicht
ist anbieterneutral und für die spätere Ausbaustufe weiterhin gültig. Die
Stripe-spezifischen Abschnitte sind mit diesem Verzeichnis überholt.
