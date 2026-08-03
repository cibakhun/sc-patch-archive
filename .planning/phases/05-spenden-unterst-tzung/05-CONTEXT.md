# Phase 05: Spenden-Unterstützung - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Ein Besucher, der VerseBase nützlich findet, kann in unter einer Minute Geld
geben — Betrag wählen, zahlen, Bestätigung sehen — ohne Konto, in DE und EN,
und das Geld kommt tatsächlich an. Dazu die Seite, die ehrlich sagt wofür, und
der Nachweis, dass die gezeigten Zahlen aus echten Zahlungen stammen.

**Ausdrücklich NICHT in dieser Phase:**
- Mitgliedschaften, Stufen mit Gegenleistung, exklusive Inhalte für Unterstützer
- PayPal (vom Betreiber ausgeschlossen)
- Automatische Umsatz-/Steuerauswertung, Buchhaltungsexport
- Änderungen an der Kopfleiste (Phase 1 hat sie gerade neu geordnet)

**Erweitert den Meilenstein bewusst:** Die Roadmap war auf UI-Feinschliff
abgesteckt, `PROJECT.md` § Out of Scope schließt serverseitige Logik und
Konto-Ausbau aus. Für diese Phase ist beides aufgehoben — ohne Edge Function
gibt es keinen sicheren Zahlungsweg. Siehe `.planning/ROADMAP.md` § Phase 5.

</domain>

<decisions>
## Implementation Decisions

> # ⚠ UMSTELLUNG AUF PAYPAL — 02.08.2026
>
> **Stripe ist raus. Der Betreiber kann die Identitätsprüfung nicht erbringen
> (Ausweis nicht verfügbar).** Stripe zahlt ohne diese Prüfung kein Geld aus —
> der Testmodus läuft zwar, echtes Geld käme nie an. Eine tadellos gebaute
> Anbindung, die nie auszahlt, ist wertlos, also fällt sie ersatzlos weg.
>
> Gewählt: **PayPal als einfacher Link** (PayPal.me bzw. Spenden-Link), kein
> Server, keine Datenbank, keine Edge Function. Ko-fi bleibt als zweiter Weg.
>
> **Das ist eine echte Verkleinerung, keine Umbenennung.** Ein PayPal-Link hat
> keinen Webhook und damit KEINE Datenquelle. Ersatzlos gestrichen sind deshalb:
> Fortschrittsbalken aus echten Zahlungen, Unterstützer-Wand, Zustimmungs-Logik,
> Moderationsoberfläche, Profil-Abzeichen, monatliche Unterstützung, beide Edge
> Functions, die Tabelle und der Webhook.
>
> **Aufgehobene Entscheidungen:** D-01, D-02 (teilweise), D-04, D-05, D-06,
> D-12, D-13 (Ziel bleibt als Text), D-14, D-16, D-17, D-18, D-19, D-20.
> Ebenfalls hinfällig: der gesamte `05-STRIPE-ADDENDUM.md` (S-01…S-07) und die
> Pläne 05-01 bis 05-07, die neu geschnitten werden.
>
> **Weiter gültig:** D-07 bis D-11 (Platzierung, Pfad, Grund), D-15 (im Zweifel
> nichts zeigen statt etwas Erfundenes), D-21 (Wortwahl „Unterstützen"), D-22
> (Datenschutz — jetzt PayPal statt Stripe), D-23 bis D-26 (Gestaltungsrichtung
> „Instandsetzung", Aussage Arbeitsverlust, keine erfundenen Kennzahlen).
>
> **Neue Entscheidungen aus dieser Umstellung:**
>
> - **D-27:** **Kein Fortschrittsbalken.** Ohne Zahlungsdaten bliebe nur eine
>   handgepflegte Zahl. D-15 hält bereits fest: im Zweifel gar nichts zeigen.
>   Eine Zahl, die zu aktualisieren vergessen wird, beschädigt genau das, was
>   diese Seite trägt. Das Ziel steht stattdessen im Fließtext („rund 120 €").
> - **D-28:** **Keine Unterstützer-Wand.** Gleiche Begründung. Eine
>   handgepflegte Namensliste wäre vertretbar, ist aber nicht beauftragt — erst
>   auf ausdrücklichen Wunsch.
> - **D-29:** **Nur einmalige Unterstützung.** PayPal.me kann keine
>   wiederkehrenden Zahlungen; PayPal-Abos bräuchten ein Geschäftskonto. Der
>   Umschalter einmalig/monatlich entfällt ersatzlos statt eine Möglichkeit
>   vorzutäuschen, die es nicht gibt.
> - **D-30:** **Die Betragsstufen 3/5/10/25 € bleiben und bleiben funktional.**
>   PayPal.me nimmt den Betrag im Pfad entgegen (`paypal.me/NAME/5EUR`), die
>   Auswahl steuert also wirklich etwas. 5 € bleibt vorgewählt (D-03 gilt weiter).
> - **D-31:** **Der Empfänger steht als GENAU EINE Konstante** in der
>   Konfiguration. Solange dort der Platzhalter steht, läuft die Seite sichtbar
>   im Demo-Modus (Muster `FEEDBACK_DEMO`) und der PayPal-Knopf zeigt nicht ins
>   Leere.
> - **D-32:** **Umkehrbar dokumentieren.** Balken und Wand kommen zurück, sobald
>   ein PayPal-Geschäftskonto mit Webhook existiert. Die Recherche dazu liegt
>   bereits vor (`05-RESEARCH.md`, Abschnitt Datenschicht ist anbieterneutral)
>   und wird nicht gelöscht, sondern als Grundlage für eine spätere Phase
>   vermerkt.

### Zahlungswege

- **D-01:** Stripe Checkout ist der Hauptweg (gehostete Bezahlseite von Stripe,
  nicht selbst gebaute Kartenfelder). Ko-fi ist der zweite Weg. PayPal
  ausdrücklich nicht. — **Reversibility:** costly — ein Wechsel des Anbieters
  tauscht beide Edge Functions, das Webhook-Format und die Spalten aus, in denen
  die Zahlungsreferenzen liegen.
- **D-02:** Ko-fi steht sichtbar, aber nachgeordnet: Stripe trägt Betragsauswahl
  und Hauptknopf, darunter eine Zeile „Lieber über Ko-fi? →". Grund: Ko-fi-
  Zahlungen laufen NICHT in Balken und Wand ein (kein Webhook eingerichtet).
  Zwei gleich große Knöpfe würden die Zahlen still unvollständig machen.
- **D-03:** Beträge 3 € / 5 € / 10 € / 25 €, **5 € vorausgewählt**, dazu freie
  Eingabe. Währung EUR.
- **D-04:** Einmalig UND monatlich, **einmalig vorausgewählt**. Das aktuelle Ziel
  ist ein einmaliger Kauf; ein voreingestelltes Abo passte nicht dazu.

### Kontostand des Betreibers (bestimmt, was in dieser Phase belegbar ist)

- **D-05:** Es gibt **noch kein Stripe-Konto und kein Ko-fi-Konto**. Beide legt
  der Betreiber selbst an. Folge für die Planung:
  - Das Feature muss ohne Schlüssel vollständig und sichtbar im Demo-Modus
    laufen (Muster `FEEDBACK_DEMO` in `src/consts.ts`) — es behauptet dann keine
    Zahlen und bricht nicht.
  - Der Ko-fi-Weg bleibt **ausgeblendet**, solange kein Name hinterlegt ist —
    ein Link ins Leere ist schlechter als kein Link.
  - Zur Phase gehört eine **Einrichtungsanleitung** (Konto, Testmodus-Schlüssel,
    Webhook-Endpunkt, Signatur-Geheimnis, wo genau was einzutragen ist).
  - **Erfolgskriterium 1 der Roadmap („echte Zahlung im Testmodus läuft
    durch") kann in dieser Phase NICHT von Claude belegt werden.** Es wird zur
    Nutzer-Abnahme (`/gsd-verify-work`), sobald die Schlüssel stehen. Der Plan
    muss das so ausweisen und darf es nicht als erledigt darstellen.
- **D-06:** Geheime Schlüssel werden **nie** in die Codebasis geschrieben. Der
  Stripe-Secret-Key und das Webhook-Signatur-Geheimnis leben ausschließlich in
  den Supabase-Function-Secrets. Im Repo steht höchstens der öffentliche
  Publishable Key — analog zu `SUPABASE.publishableKey`.

### Platzierung site-weit

- **D-07:** Zwei site-weite Zugänge, **die Kopfleiste bleibt unangetastet**:
  eine Zeile im `Attribution`-Fuß und ein Eintrag im Menü-Overlay in der Gruppe
  „Konto & Service" (neben Downloads und Feedback). Begründung: die Leiste trägt
  laut Bestandsregel genau EINEN Akzentpunkt (die Wortmarke), und unter 640 px
  blendet sie die linke Gruppe bereits aus.
- **D-08:** Zusätzlich ein dezenter Streifen am Ende der **Werkzeugseiten**
  (Item Finder, Crafting, Mining, Refinery, Precision Jump) — dort hat jemand
  gerade echten Nutzen gezogen. Die Lesestrecken (Patch- und Themenseiten)
  bleiben frei. Die ~17.000 generierten Datenseiten (DataShell) bekommen den
  Streifen NICHT — dort zählt jedes Byte.
- **D-09:** Eigene, **feste Farbe** für den Spenden-Zugang, unabhängig von der
  Palette der jeweiligen Seite (warmes Gold). Bewusster Bruch mit dem Prinzip
  „jede Seite ihre eigene Farbwelt" zugunsten der Wiedererkennbarkeit.
  **Zwingend:** als Token in BEIDEN Farbmodi gesetzt, nicht als Rohwert — der
  Hellmodus-Generator (`npm run theme`) sieht nur inline-`<style>` in `.astro`,
  eine feste Farbe in einer `assets/*.css` braucht ihren Hellwert von Hand.
- **D-10:** Seitenpfad `/support.html`, DE-Zwilling `/de/support.html`.
  Englischer Slug wie `/item-finder.html`, `/precision-jump.html`,
  `/downloads.html`, `/feedback.html`.

### Ziel und Ehrlichkeit der Zahlen

- **D-11:** Der Grund steht **wörtlich** auf der Seite: das Netzteil des
  Rechners, auf dem VerseBase entsteht, ist defekt — er startet mitten in der
  Arbeit neu. Kein abstrakter Kostenposten.
- **D-12:** Fortschritt als **Eurobetrag-Balken** („35 € von 120 €"), summiert
  aus echten Zahlungsdaten. Keine gepflegte Zahl, keine Schätzung.
- **D-13:** Zielbetrag **120 €**, als Wert in einer Konfigurationsdatei
  (`src/consts.ts`), jederzeit änderbar.
- **D-14:** Bei Erreichen füllt sich der Balken sichtbar auf 100 %, die Seite
  sagt Danke und benennt das Ziel als erreicht. Der Weg bleibt offen, wird aber
  nicht mehr eingefordert. Kein automatisch nachgezogenes Folgeziel.
- **D-15:** Zeigt der Balken je eine Zahl, die nicht aus einer bestätigten
  Zahlung stammt, ist die Hausregel „Never fabricate data" verletzt
  (`CONVENTIONS.md` § Error Handling, per `tests/e2e/db.test.js` verankert). Im
  Demo-Modus zeigt die Seite deshalb **keinen** Balken, nicht einen leeren.

### Unterstützer-Wand

- **D-16:** Pro Unterstützer stehen **Name und Datum**, **kein Betrag**. Alle
  stehen gleichrangig nebeneinander — bewusst keine Rangliste, die kleine
  Beträge beschämt.
- **D-17:** **Anonym ist die Vorgabe.** Genannt wird nur, wer ausdrücklich
  zustimmt (Häkchen). Ohne Zustimmung: „Anonymer Pilot". Einwilligung statt
  Widerspruch — der Name aus den Zahlungsdaten ist oft der Klarname.
  — **Reversibility:** one-way — eine nachträgliche Umstellung auf „genannt als
  Vorgabe" würde Namen veröffentlichen, für die keine Einwilligung vorliegt.
- **D-18:** Nachrichten sind erlaubt, erscheinen aber **erst nach Freigabe durch
  den Betreiber**. Dazu gehört eine echte Bedienoberfläche zum Freigeben und
  Ablehnen — nicht nur eine Datenbankspalte.
- **D-19:** Angemeldete Unterstützer können ihr VerseBase-Profil verknüpfen:
  Anzeige mit Piloten-Handle, Verweis auf `/pilot/<handle>`, Abzeichen im Profil.
  Anmelden bleibt freiwillig, Spenden ohne Konto bleibt vollwertig.
- **D-20:** Ein selbst gewählter Anzeigename wird vor der Anzeige entschärft
  (Länge, Zeichenvorrat, kein Markup).

### Wortwahl und Rechtsrahmen

- **D-21:** Die Seite sagt **„Unterstützen" / „Support"**, nicht „Spende" /
  „Donation". Grund: Als Privatperson ohne anerkannte Gemeinnützigkeit kann der
  Betreiber keine Zuwendungsbestätigung ausstellen; die Zahlung ist für den
  Geber steuerlich nicht absetzbar. „Unterstützen" verspricht das auch nicht.
  Gilt für UI-Text, Überschriften und Menüeinträge in beiden Sprachen.
  *(Einordnung, keine Steuerberatung — die steuerliche Behandlung der Einnahmen
  ist Sache des Betreibers.)*
- **D-22:** Die Datenschutzerklärung nennt Stripe und Ko-fi als Empfänger mit
  Zweck, bevor die Seite live geht — analog zum bestehenden Web3Forms-Abschnitt.

### Rückkehr zu Stripe (03.08.2026) — noch NICHT ausgeführt

> **Anlass:** Der Geldbeutel des Betreibers ist wieder aufgetaucht, das
> Stripe-Konto sollte damit durch die Identitätsprüfung sein. Genau diese
> Prüfung war der Grund, warum Stripe am 02.08. rausflog (siehe den Block
> „⚠ UMSTELLUNG AUF PAYPAL" oben).
>
> **Status: BLOCKIERT bis zur Bestätigung.** Der Betreiber hat ausdrücklich
> „erst prüfen, dann bauen" gewählt. Zu prüfen sind zwei Dinge, die der
> Assistent NICHT selbst sehen kann: ob das Konto ohne Aktivierungsbanner
> dasteht, und ob unter /settings/payouts eine Bankverbindung hinterlegt ist.
> **Ohne den zweiten Punkt ist die ganze Anbindung wertlos — das war der Fehler
> vom 31.07., als Stripe empfohlen wurde, ohne die Auszahlbarkeit zu prüfen.**

- **D-33:** Stripe wird wieder der **Hauptweg**, sobald die Freischaltung
  bestätigt ist. **PayPal bleibt als nachgeordneter zweiter Weg** — der Link
  steht bereits, kostet also nichts. Nicht gewählt: PayPal entfernen; nicht
  gewählt: beide gleichrangig.
- **D-34:** **Der Balken zählt Stripe automatisch (Webhook), PayPal trägt der
  Betreiber von Hand nach.** Das löst den Widerspruch, den D-33 sonst erzeugt:
  ein automatischer Balken, der einen von zwei Zahlungswegen systematisch
  übersieht, wäre auf einer Seite mit diesem Faktentreue-Anspruch der
  schlechteste Zustand. So bleibt er vollständig, ohne dass irgendwo geschätzt
  wird.
- **D-35:** Das am 02.08. gebaute **Admin-Feld bleibt bestehen** und wird NICHT
  vom Stripe-Umbau ersetzt. Es wechselt die Rolle: vom alleinigen Weg, den Stand
  zu pflegen, zum Nachtrag für den zweiten Zahlungsweg. Tabelle
  `support_progress` und ihre Zugriffsregeln bleiben unverändert gültig.
- **D-36:** Der geheime Stripe-Schlüssel ist nach S-02 ein **eingeschränkter**
  Schlüssel (`rk_`), kein Secret Key, und wird ausschließlich vom Betreiber in
  die Supabase-Function-Secrets eingetragen. Der Assistent bekommt ihn nicht zu
  sehen. Der öffentliche `pk_test_` liegt in `superseded-stripe/05-STRIPE-ADDENDUM.md` § S-07.
- **D-37:** Grundlage des Umbaus sind die sieben archivierten Pläne und der
  Leitlinien-Abgleich S-01…S-07 unter `superseded-stripe/`. Sie wurden am 02.08.
  bewusst nicht gelöscht, sondern mit genau dieser Begründung aufgehoben. Zu
  streichen ist daraus, was inzwischen anders entschieden wurde: Unterstützer-
  Wand, Moderationsoberfläche, Profil-Abzeichen (D-28), monatliche Zahlung
  (D-29 — bei Stripe technisch wieder möglich, aber nicht neu beauftragt).

### Gestaltungsrichtung (nachgetragen 02.08.2026 nach Sichtung der Entwürfe)

- **D-23:** Gewählt ist Richtung **A „Instandsetzung"** aus
  `.planning/sketches/001-support-page-identity/` — die Seite trägt die
  Formensprache eines technischen Werkstattauftrags: Schaltbild in echter
  Zeichnungssprache, Positionsliste, Fortschritt als geteilte Skala mit
  numerischem Ablesewert. Nicht gewählt: B „Übertragung" (reine Prosa),
  C „Besatzung" (Unterstützer-Wand führt).
- **D-24:** **Der Kern der Aussage ist NICHT das defekte Bauteil, sondern der
  Arbeitsverlust.** Ausdrückliche Nutzerkorrektur an Richtung A: „es aber so
  darstellen dass es immer ausgehen kann, und wenn man codet führt es des
  öfteren zum progressverlust und dies erschwert die entwicklung enorm."
  Die Seite erzählt also: der Rechner geht ohne Vorwarnung aus → die Arbeit seit
  dem letzten Speichern ist weg → ein laufender Durchlauf über die Spieldateien
  beginnt von vorn → Entwickeln heißt, nie länger als ein paar Minuten am Stück
  zu denken. Ein Sachschaden ist ein schwaches Argument; verlorene Arbeitszeit an
  einem Projekt, das jemand umsonst baut, ist eines, das ankommt.
- **D-25:** Das Schaltbild bleibt, ändert aber seine Aussage: **nicht** „dieses
  Bauteil ist defekt", sondern die Last-Kennlinie, die unter Volllast einbricht.
  Es illustriert das Aussetzen, nicht den Austausch.
- **D-26:** **Keine erfundenen Kennzahlen.** Der Entwurf enthielt zur
  Veranschaulichung „elf abgebrochene Datenläufe in vierzehn Tagen" — frei
  erfunden. Solche Zahlen dürfen NICHT in die echte Seite, solange der Betreiber
  keine echten nennt (Hausregel „Never fabricate data", per
  `tests/e2e/db.test.js` verankert; die Seite lebt von ihrer Faktentreue). Die
  Kopie bleibt qualitativ („ohne Vorwarnung", „von vorn") statt quantitativ.
  Will der Betreiber später echte Zahlen nennen, ist dafür eine Stelle
  vorgesehen — bis dahin steht dort nichts.

### Claude's Discretion

- Tabellenschema, Spaltennamen, Namen der Edge Functions, Namen der Konstanten
- Mechanik der Doppelzustellungs-Sicherung (Idempotenz) im Webhook
- CSS-Klassenpräfix der neuen Seite (neue Seite = neues Präfix, `CONVENTIONS.md`)
- Ob der Werkzeugseiten-Streifen eine eigene Komponente oder ein Slot im
  bestehenden Seitenfuß wird
- Wie der Zustimmungshaken und der Anzeigename technisch an Stripe übergeben
  werden (Stripe-Custom-Fields, Metadaten oder eigener Zwischenschritt)
- Genaue Optik von Balken, Wand und Betragsauswahl, solange sie der
  Gestaltungssprache der Seite folgt
- Ob die Freigabe-Oberfläche im Konto-Bereich oder als eigene Admin-Ansicht sitzt

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Anforderungen und Ziel
- `.planning/REQUIREMENTS.md` § „Spenden-Unterstützung" — DON-01 bis DON-14
- `.planning/ROADMAP.md` § „Phase 5: Spenden-Unterstützung" — Ziel, die sechs
  Erfolgskriterien und der Vermerk zur Meilenstein-Erweiterung

### Architektur-Grenzen, die diese Phase bestimmen
- `.planning/codebase/INTEGRATIONS.md` § „Webhooks & Callbacks", Zeile 105 —
  **der wichtigste Fund:** die bestehenden Edge Functions (`register`,
  `delete-account`, `verify-rsi`) *„require a valid session JWT via the Supabase
  gateway"*. Stripe kann kein Session-JWT schicken, und Spenden soll ohne Konto
  gehen. **Beide neuen Functions brauchen eine andere Torstellung als die drei
  bestehenden — das ist die erste Rechercheaufgabe.** Erschwerend: dieses Projekt
  nutzt einen Publishable Key neuen Formats (`sb_publishable_…`), der anders als
  ein klassischer Anon-Key **kein JWT** ist.
- `.planning/codebase/INTEGRATIONS.md` § „CI/CD & Deployment" — *„No Cloudflare
  Pages project exists"*; serverseitiger Code kann NUR Supabase Edge Function sein
- `.planning/PROJECT.md` § Constraints — statisches Astro hinter nginx
- `.planning/codebase/CONVENTIONS.md` § „Gates" — `npm run build`, `verify`,
  `audit:site`, `test:e2e`, `theme`
- `.planning/codebase/CONVENTIONS.md` § „Language of the Code Itself" —
  Quellkommentare auf Deutsch; UI-Text nie hartcodiert in geteilter Chrome
- `.planning/codebase/CONVENTIONS.md` § „Error Handling" — „Never fabricate
  data", per `tests/e2e/db.test.js` verankert
- `.planning/codebase/CONCERNS.md` § Class A — 67 EN/DE-Seitenpaare driften
  auseinander; jede neue Seite muss beide Fassungen gleichzeitig treffen

### Bestandsmuster, an die anzuknüpfen ist
- `supabase/functions/verify-rsi/index.ts` — die einzige vorhandene Edge
  Function im Repo: CORS-Kopfzeilen, OPTIONS-Behandlung, User-ID aus dem
  Session-JWT (NIE aus dem Body), Persistierung mit der Service Role
- `supabase/migrations/20260726000000_crafting_entries.sql` — Muster für Tabelle
  mit Row-Level-Security-Regeln pro Nutzer
- `supabase/migrations/20260722200000_guard_rsi_verified.sql` — Muster für einen
  Trigger, der Client-Schreibzugriff auf ein vertrauenswürdiges Feld verbietet;
  direkte Vorlage für „nur der Webhook schreibt Spendenzeilen"
- `supabase/migrations/20260723000000_public_profile_views.sql` — Muster für
  eine öffentliche View, die nur ausgewählte Spalten freigibt (DON-08)
- `src/consts.ts` § `FEEDBACK` / `FEEDBACK_DEMO` — das Demo-Modus-Muster, das
  D-05 verlangt; ebenso `SUPABASE` als Muster für öffentliche Schlüssel im Repo
- `src/components/FeedbackForm.astro` — geteilte Komponente mit `lang`-Prop,
  DE/EN-Copy im Frontmatter, dünne Seitenhüllen; direkte Vorlage für die
  Spenden-Komponente
- `src/pages/feedback.astro` + `src/pages/de/feedback.astro` — Muster für ein
  Seitenpaar mit Hero, eigener Palette und generiertem Hellmodus-Block
- `src/components/Attribution.astro` — hier kommt die Fuß-Zeile hinein (D-07)
- `src/components/SiteNav.astro` § `deckGroups` → Gruppe `account` — hier kommt
  der Menüeintrag hinein (D-07)
- `src/i18n/ui.ts` — Katalog für die wiederkehrenden Chrome-Strings
- `src/lib/seo.ts` § `NOINDEX_PATHS` — einzige Quelle für Indexierbarkeit; die
  Dankesseite gehört vermutlich hinein, `/support.html` ausdrücklich NICHT
- `src/lib/assetVersion.ts` § `versioned()` — Pflicht für jede hand-verlinkte
  `/assets/*`-Datei
- `assets/account-lite.js` — schlanker Session-Leser ohne supabase-js; die
  Spendenseite darf supabase-js nicht bundeln (Muster: nur `/account/`-Seiten tun das)
- `nginx/default.conf` § Content-Security-Policy — muss um Stripe erweitert
  werden; die Kommentare dort erklären, warum die Liste gemessen und nicht
  geraten wird
- `scripts/audit-csp.mjs` (`npm run audit:csp`) — das Tor, das die CSP prüft.
  **Achtung:** die zwei Cloudflare-RUM-Einträge stehen von Hand drin und sind
  für den Prüfer unsichtbar — niemals entfernen

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`FeedbackForm.astro`-Bauweise:** eine geteilte Komponente trägt Markup,
  Stil und Verhalten, DE/EN-Copy liegt als `COPY`-Objekt im Frontmatter, die
  beiden Seiten sind dünne Hüllen mit Hero und Prosa. Genau die Form, die die
  Spendenseite braucht — und sie hält den Class-A-Drift klein.
- **`FEEDBACK_DEMO`:** fertiges Muster für „Schlüssel fehlt → sichtbarer
  Demo-Hinweis, Formular validiert, sendet aber nichts". D-05 verlangt dasselbe.
- **`verify-rsi/index.ts`:** CORS-Block, OPTIONS-Zweig, Service-Role-Client,
  „User-ID kommt aus dem JWT, nie aus dem Body" — direkt übertragbar.
- **`guard_rsi_verified.sql`:** ein Trigger verbietet dem Client das Schreiben
  eines vertrauenswürdigen Feldes und erzwingt damit den Serverweg. Für DON-07
  („nur der Webhook schreibt") ist das die vorhandene Vorlage.
- **`public_profile_views.sql`:** öffentliche View mit ausgewählten Spalten —
  die Bauform für DON-08 (Wand öffentlich lesbar, E-Mail und Zahlungs-IDs nie).
- **`account-lite.js` / `window.VBAccount`:** Session-Status ohne supabase-js.
  Die Spendenseite braucht den angemeldeten Handle für D-19, darf aber die
  37-KB-Bibliothek nicht mitbringen.

### Established Patterns
- **Seitenpaare:** EN auf der Wurzel, DE unter `/de/`, gleicher Slug. Der
  Sprachumschalter leitet die Existenz aus der Routenliste ab
  (`src/lib/routeTwins.ts`) — eine neue Seite muss in BEIDEN Bäumen liegen,
  sonst zeigt der Umschalter ins Leere und `_verify.mjs` färbt sich rot.
- **Palette pro Seite:** inline `:root{…}` (dunkel) plus generierter
  `:root[data-theme="light"]{…}`-Zwilling. Nach jeder Palettenänderung
  `npm run theme` — Handänderungen am Hellblock werden stillschweigend verworfen.
- **Indexierbarkeit an einer Stelle:** `NOINDEX_PATHS` in `src/lib/seo.ts`
  speist Layout UND Sitemap; `audit-site.mjs` prüft, dass beide übereinstimmen.
- **Gates:** `build` → `verify` → `audit:site` → `audit:csp` → `test:e2e`.
  `verify` und `audit:site` brauchen ein frisches `dist/`.
- **Client-JS in `assets/`:** ES5-IIFE mit `var`, kein Modulsystem, kein
  Bundler — wird wörtlich ausgeliefert.

### Integration Points
- `src/components/Attribution.astro` — Fuß-Zeile (steht unter jeder Seite)
- `src/components/SiteNav.astro`, `deckGroups` Gruppe `account` — Menüeintrag
- `src/i18n/ui.ts` — neue Chrome-Strings in DE und EN
- `src/consts.ts` — Stripe-Publishable-Key, Ko-fi-Name, Zielbetrag, Demo-Schalter
- `nginx/default.conf` — CSP um Stripe erweitern (`script-src`, `frame-src`,
  `connect-src`), danach `npm run audit:csp`
- `src/pages/datenschutz.astro` + DE-Zwilling — Abschnitt zu Stripe und Ko-fi
- `supabase/migrations/` — neue Migration für Tabelle, RLS und öffentliche View
- `supabase/functions/` — zwei neue Functions neben `verify-rsi`
- Die fünf Werkzeugseiten für den Streifen aus D-08, je DE und EN

</code_context>

<specifics>
## Specific Ideas

- Der Anlass ist wörtlich, wie der Betreiber ihn genannt hat: „mein Netzteil
  geht kaputt, mein pc restartet sich random, schwierig zu entwickeln". Diese
  Konkretheit ist der Kern der Spendenseite — sie wird nicht in
  Marketing-Sprache übersetzt.
- Der Betreiber hat bei jeder Frage in Bereich 2 bis 4 die zurückhaltende,
  ehrliche Variante gewählt: keine Beträge auf der Wand, anonym als Vorgabe,
  Moderation vor Veröffentlichung, „Unterstützen" statt „Spende", niedrige
  Einstiegsbeträge. Diese Haltung gilt auch für Formulierungen, die hier nicht
  einzeln abgefragt wurden: im Zweifel die leisere Variante.
- Beim Ton der Platzierung ist er hingegen den auffälligeren Weg gegangen
  (eigene feste Farbe statt Grauwert) — der Zugang darf gefunden werden.

</specifics>

<deferred>
## Deferred Ideas

- **Ko-fi-Webhook**, damit auch Ko-fi-Zahlungen in Balken und Wand einlaufen.
  Ko-fi bietet das an; in dieser Phase bewusst nicht gebaut, weil noch kein
  Konto existiert. Solange es fehlt, ist die Nachordnung von Ko-fi (D-02) die
  ehrliche Darstellung.
- **Unterstützer-Stufen mit Gegenleistung** (Abzeichenfarben, Nennung in
  Patch-Notizen, früher Zugang). Eigene Fähigkeit, eigene Phase.
- **Buchhaltungs-/Umsatzübersicht** für den Betreiber (Export, Jahressumme).
  Berührt Steuerthemen und gehört nicht in die erste Ausbaustufe.
- **Automatisch nachrückende Folgeziele** nach Zielerreichung — D-14 setzt
  bewusst auf einen Handgriff, damit jedes Ziel echt bleibt.

</deferred>

---

*Phase: 05-Spenden-Unterstützung*
*Context gathered: 2026-07-31*
