# Phase 05 — Stripe-Nachtrag (verbindlich)

**Erstellt:** 2026-08-02
**Quelle:** offizielle Stripe-Best-Practices-Skill (`npx skills add https://docs.stripe.com`,
installiert 02.08.2026), Referenzdateien `payments.md`, `billing.md`, `security.md`.
**Status:** VERBINDLICH — schlägt bei Widerspruch `05-RESEARCH.md`, weil aus Stripes
eigener, aktuell ausgelieferter Leitlinie und nicht aus abgeleiteter Recherche.

> **Warum dieser Nachtrag existiert.** Die sieben Pläne waren vom Plan-Prüfer
> freigegeben, bevor die offizielle Stripe-Leitlinie vorlag. Ein Abgleich danach
> förderte sechs Punkte zutage, die in KEINER Plandatei vorkommen — geprüft per
> `grep` über alle sieben Pläne. Fünf davon würde ein Ausführender falsch machen,
> ohne dass irgendein Tor anschlägt. Sie stehen deshalb hier als harte Regeln
> statt als Prosa in einem Rechercheanhang.

---

## S-01 — `payment_method_types` NIEMALS übergeben

**Regel:** Der Parameter `payment_method_types` darf in KEINEM Stripe-Aufruf dieser
Phase vorkommen. Weder bei `checkout.sessions.create` noch sonst wo. Ersatzlos
weglassen.

**Warum das zählt, und zwar hier besonders:** Wird der Parameter weggelassen,
schaltet Stripe „dynamic payment methods" ein und wählt aus über 100 Signalen
(Währung, Standort, Betrag, Gerät) die passenden Zahlarten aus. Für deutsche
Unterstützer heißt das konkret: SEPA-Lastschrift, Klarna, Apple Pay und Google Pay
erscheinen automatisch, ohne eine Zeile Code. Ein hartverdrahtetes
`payment_method_types: ['card']` schaltet all das ab — und zwar still, ohne Fehler.
Bei einem Spendenformular ist das unmittelbar teuer: wer keine Karte nutzen will
oder kann, bricht ab.

**Die Falle:** Genau diese Zeile steht in unzähligen Stripe-Anleitungen im Netz und
ist der naheliegende Reflex, wenn jemand „Kartenzahlung" liest. Die offizielle
Leitlinie nennt sie ausdrücklich als Anti-Muster.

**Wenn Zahlarten eingeschränkt werden sollen** (in dieser Phase nicht vorgesehen):
`payment_method_configurations` oder `excluded_payment_method_types` — nie
`payment_method_types`.

**Prüfbar:** `grep -rn "payment_method_types" supabase/functions/` liefert **0 Treffer**.

---

## S-02 — Restricted API Key (`rk_`) statt Secret Key (`sk_`)

**Regel:** Die Edge Functions arbeiten mit einem **Restricted API Key** (Präfix
`rk_`), nicht mit dem Secret Key (`sk_`). Die Leitlinie sagt wörtlich: nicht auf
Secret Keys zurückfallen, sondern je Dienst einen eigenen RAK mit genau den
Rechten, die er braucht.

**Konkret für diese Phase — zwei getrennte Schlüssel, nicht einer:**

| Function | Braucht | Rechte im RAK |
|---|---|---|
| Checkout-Session anlegen | schreiben | `Checkout Sessions: write`; `Customers: write` nur falls die Umsetzung einen Customer anlegt |
| Webhook | nichts von der API | im Zweifel **gar keinen** API-Schlüssel — die Signaturprüfung braucht nur das Webhook-Secret. Nur falls die Umsetzung Objekte nachlädt: `Events: read`, `Checkout Sessions: read`, `Subscriptions: read` |

**Warum:** Ein abgegriffener Secret Key kann alles — Rückerstattungen auslösen,
Auszahlungen umleiten, Kundendaten lesen. Ein RAK mit „Checkout Sessions: write"
kann eine Bezahlseite anlegen. Mehr nicht. Da die Function nach S-05 öffentlich
erreichbar ist, ist das kein theoretischer Unterschied.

**Für den Betreiber:** Dashboard → Entwickler → API-Schlüssel → *Eingeschränkten
Schlüssel erstellen*. Der Name sollte den Zweck tragen (z. B.
`versebase-checkout-create`), damit später erkennbar ist, welcher Schlüssel wozu
gehört und welcher im Ernstfall rotiert werden muss.

**Anpassung an den Plänen:** Alle sieben Pläne nennen das Secret `STRIPE_SECRET_KEY`.
Der Name bleibt (Umbenennen wäre reines Rauschen), aber sein **Inhalt** ist ein
`rk_test_…` bzw. später `rk_live_…`, kein `sk_…`. Die Einrichtungsanleitung in
Plan 05-07 muss das so beschreiben.

---

## S-03 — API-Version pinnen: `2026-07-29.dahlia`

`05-RESEARCH.md` ließ die Version bewusst offen („lieber offen als ein geratenes,
bereits veraltetes Datum"). Der Wert liegt jetzt autoritativ vor.

**Regel:** `2026-07-29.dahlia` beim Anlegen des Clients bzw. als
`Stripe-Version`-Kopfzeile setzen. Ungepinnt heißt: Stripe ändert das
Antwortformat, und der Webhook bricht an einem Dienstag, an dem niemand etwas
deployt hat.

---

## S-04 — `integration_identifier` mitgeben

Ab API-Version `2026-03-25.dahlia` nimmt `checkout.sessions.create` den Parameter
`integration_identifier` — eine eigene Marke, an der sich Checkout-Abläufe im
Dashboard auseinanderhalten lassen. Die Leitlinie verlangt einen Zufallssuffix aus
8 Buchstaben.

**Regel:** mitgeben, z. B. `versebase-support-<acht zufällige Buchstaben>`. Der
Suffix wird EINMAL erzeugt und fest im Code hinterlegt — nicht pro Aufruf neu
gewürfelt, sonst ist die Marke als Filter wertlos.

---

## S-05 — Weiterleitung als Navigation, NICHT als Formular-POST

**Regel:** Der Sprung zu Stripe erfolgt über `location.href = url` aus der Antwort
der Edge Function. **Kein** `<form action="https://checkout.stripe.com" method="POST">`.

**Warum das hier bricht:** Die CSP dieser Seite setzt
`form-action 'self' https://api.web3forms.com` (siehe `nginx/default.conf`). Ein
Formular-POST an Stripe fiele unter `form-action` und würde vom Browser
**blockiert** — sichtbar nur in der Konsole, mit einer Seite, die scheinbar nichts
tut. Eine Navigation über `location.href` unterliegt `form-action` dagegen nicht.

**Das ist zugleich die Begründung, warum DON-13 keine neuen CSP-Einträge braucht:**
Es wird nichts von Stripe *geladen*, es wird zu Stripe *navigiert*. Die CSP regelt
Ressourcen auf unserer Seite, nicht wohin der Nutzer die Seite verlässt.

**Grenze dieser Aussage, ehrlich:** Stripes eigene Sicherheitsleitlinie empfiehlt
`https://*.stripe.com` in `script-src`, `frame-src` und `connect-src` — sie
adressiert damit Integrationen, die Stripe.js laden oder Stripe in einem iframe
einbetten. Für die reine Weiterleitung trifft das nicht zu. Sollte später doch auf
eingebettetes Checkout oder das Payment Element gewechselt werden, sind diese drei
Einträge fällig, **gemessen** über `npm run audit:csp`, nicht geraten.

**Prüfbar:** `grep -rn "checkout.stripe.com" src/ assets/` findet keine
`<form action=…>`-Konstruktion.

---

## S-06 — Checkout Sessions ist bestätigt der richtige Weg

Kein Änderungsbedarf, aber festgehalten, damit die Entscheidung nicht später neu
aufgerollt wird: Die Leitlinie ordnet **Checkout Sessions** ausdrücklich für
On-Session-Zahlungen zu und hält fest, dass die API **einmalige Zahlungen UND
Abonnements** trägt. PaymentIntents wären für Off-Session-Zahlungen oder eigenen
Checkout-Zustand — beides trifft hier nicht zu.

Ebenfalls bestätigt: Für Abonnements gehört `mode: 'subscription'` an die
Checkout Session, und die veraltete `plan`-Struktur wird nicht benutzt (Prices
statt Plans). Der in `05-RESEARCH.md` untersuchte Weg über inline `price_data` für
den frei gewählten Betrag bleibt bestehen; er wird beim Abnahme-Halt in Plan 05-07
an einer echten Testzahlung überprüft, nicht vorher als gesichert behandelt.

---

## S-07 — Der veröffentlichbare Testschlüssel liegt vor, wird aber ZULETZT eingetragen

Der Betreiber hat am 02.08.2026 sein Stripe-Konto angelegt und den
veröffentlichbaren Testschlüssel übergeben:

```
pk_test_51TzZCTCjsyC0bTUoyNfTsaZwuQljybqG8IsNxBTkxUbisk8nf0bl6CSOilxZJwL2xFjoAxEyVlmlX8VwtYZn3VEw00Z3EDQIGM
```

Dieser Schlüssel ist **öffentlich** — er ist dafür gemacht, im Client zu stehen,
genau wie `SUPABASE.publishableKey`. Er darf ins Repo. Der geheime Gegenpart
(nach S-02 ein `rk_test_…`) liegt dem Assistenten **nicht** vor und soll ihm auch
nicht vorliegen.

**Reihenfolge, und die ist nicht beliebig.** Plan 05-02 leitet `SUPPORT_DEMO` aus
diesem Feld ab: steht dort noch der Platzhalter, ist Demo-Modus an. Wird der echte
Schlüssel eingetragen, **verlässt die Seite den Demo-Modus** — und zwar unabhängig
davon, ob die Edge Functions ihre Geheimnisse schon haben. Trägt man ihn zu früh
ein, zeigt die Seite eine echte Betragswahl, deren Knopf ins Leere läuft.

Deshalb: Der Platzhalter bleibt während der Wellen 1 bis 6 stehen. Der echte
Schlüssel wird **erst in Welle 7** eingetragen, nachdem der Betreiber Restricted Key
und Webhook-Signaturgeheimnis in den Supabase-Function-Secrets hinterlegt hat. Die
Einrichtungsanleitung in Plan 05-07 muss diese Reihenfolge ausdrücklich benennen —
sie ist die einzige Stelle, an der die Seite kurzzeitig kaputt aussehen könnte.

**Zusätzlich abzusichern:** Schlägt der Aufruf der Checkout-Function fehl (etwa weil
das Geheimnis fehlt oder falsch ist), zeigt die Seite eine verständliche Meldung in
DE und EN und keinen stillen Nicht-Effekt. Der Knopf muss danach wieder bedienbar
sein, nicht in „Wird weitergeleitet …" hängen bleiben.

## Was sich NICHT ändert

- Die Architektur (gehostetes Checkout per Weiterleitung, Edge Function legt die
  Session an, signaturgeprüfter Webhook schreibt) ist durch die Leitlinie
  **bestätigt**, nicht in Frage gestellt.
- Der Webhook-Ereignisplan aus `05-RESEARCH.md` (`checkout.session.completed` für
  die Erstzahlung, `invoice.paid` gefiltert auf `billing_reason ===
  'subscription_cycle'` für Folgemonate) wird von der Leitlinie weder bestätigt
  noch widerlegt — sie sagt dazu nichts. Er bleibt bei seiner Einstufung MITTEL
  und wird am Abnahme-Halt mit einer Stripe-Testuhr geprüft.
- Alle 22 Nutzerentscheidungen D-01…D-22 bleiben unberührt.

## Zusätzlich empfohlen, aber NICHT in dieser Phase

- **IP-Erlaubnisliste für den Webhook** (Stripes Sicherheitsleitlinie, „defense in
  depth"): nur Stripes Adressbereiche zulassen. Bei Supabase Edge Functions gibt es
  dafür keinen offensichtlichen Schalter — die Signaturprüfung ist die tragende
  Absicherung. Als spätere Verbesserung vormerken, nicht als Lücke behandeln.
- **Pre-Commit-Haken gegen eingecheckte Schlüssel** (`sk_…`, `rk_…`). Die
  Leitlinie empfiehlt das ausdrücklich für versionierte Projekte. Eigene, kleine
  Aufgabe — gehört nicht in eine Zahlungsphase, aber ins Backlog.
