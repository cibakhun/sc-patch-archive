# Phase 14: Testpilot-Zugang: staging hinter der Discord-Rolle - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

`staging.verse-base.com` bekommt einen Türsteher. Wer auf dem Discord-Server die
Rolle „Test Pilots" trägt, kommt hinein; alle anderen sehen ausschließlich eine
Anmeldeseite. Die Rolle wandelt sich dabei vom selbst vergebbaren Ping-Abo zur
vom Betreiber **vergebenen** Auszeichnung und bekommt vier sichtbare Vorteile.

**Drei Systeme sind betroffen:** Discord-Server (Blueprint + Bot),
Konto/Supabase (Discord-Kopplung, Profil), Auslieferung (nginx/Cloudflare/CI).

**Ausdrücklich NICHT in dieser Phase:**

- Das Tor auf die Live-Seite oder Teile davon ausweiten (D-12)
- Ein allgemeines Berechtigungs-/Rollensystem als Vorratsbau (D-12)
- Community-Funktionen jenseits der vier beschlossenen Perks
- Bewerbungsverfahren oder automatische Rollenvergabe (vom Betreiber verworfen)

⚠ **Diese Phase hebt eine `Out of Scope`-Zeile aus PROJECT.md auf.** Dort steht
„Konto-, Community- und Discord-Ausbau — bleibt bestehen, wird in dieser Roadmap
aber nicht vorangetrieben". Die Aufhebung ist bewusst und folgt dem Präzedenzfall
der Phasen 5 und 6, die dasselbe für Zahlungsverkehr bzw. Datamine getan haben.
Sie gilt **nur für diese Phase**; die Grenze bleibt für weitere Vorhaben bestehen.

</domain>

<decisions>
## Implementation Decisions

Alle 22 Entscheidungen stammen aus der Besprechung vom 17.08.2026. Vier davon
(D-01 Strenge-Grundsatz, D-16 Vergabeart, D-03 Identitätsweg, Perk-Auswahl)
waren bereits vor Anlage der Phase getroffen und stehen so in der ROADMAP.md.

### Zugang & Identität

- **D-01:** Discord wird ein **zweiter, gleichberechtigter Anmeldeweg** neben
  E-Mail/Passwort („Mit Discord anmelden"). Supabase kann den Provider ab Werk.
  — **Reversibility:** costly — mit dem Provider entstehen Discord-Identitäten
  an echten Konten; ein Rückbau müsste diese Verknüpfungen migrieren, sonst
  verlieren die betroffenen Nutzer ihren einzigen Anmeldeweg.

- **D-02:** Der Discord-Knopf **meldet nur an, er legt nie ein Konto an**. Wer
  unbekannt ist, bekommt „bitte erst regulär registrieren" statt eines still
  erzeugten Kontos. Damit behält der Betreiber von jedem Testpiloten eine
  bestätigte E-Mail-Adresse. Der Riegel ist serverseitig zu setzen (Auth-Hook
  oder Trigger auf `auth.users`), **nicht** im Client.
  ⚠ Dieser Riegel sitzt an der Anmeldung: ein Fehler dort sperrt im Zweifel
  *alle* aus. Er ist vorgeführt rot zu fahren, bevor er scharf geht.

- **D-03:** Die Discord-Identität wird **einmal** per OAuth bewiesen; danach
  beantwortet der **Bot-Token** server-zu-server, ob die Rolle vorliegt. Der
  Nutzer wird für Rollenprüfungen nie erneut behelligt. Bauform übernommen von
  `supabase/functions/verify-rsi/index.ts`: Nutzer-ID aus dem Sitzungs-JWT,
  niemals aus dem Rumpf; Schreiben mit der Service-Rolle.

- **D-04:** Die Rolle `admin` aus `user_roles` **öffnet das Tor allein**,
  unabhängig von Discord. Das ist der Aussperr-Riegel: weder eine
  Discord-Störung noch ein Fehler im Rollenabgleich darf den Betreiber aus
  seiner eigenen Vorschau aussperren. Kein zweites Notschloss per
  Umgebungsvariable — ein nie benutzter Schlüssel wird nie geprüft.

- **D-05:** `public.user_roles` bleibt **unangetastet**. Die `CHECK`-Klausel
  (`role IN ('user','admin')`, `scripts/supabase-schema.sql:73`) wird **nicht**
  um `tester` erweitert. Grund: `user_id` ist Primärschlüssel, ein Konto trägt
  also genau eine Rolle — ein Betreiber könnte sonst nicht gleichzeitig Admin
  und Testpilot sein. Die Testpilot-Eigenschaft lebt in **Discord**; die
  Tabelle trägt weiterhin nur `user`/`admin`.

### Das Tor

- **D-06:** Das Tor sperrt **alles** — HTML, JSON, Bilder, `/_astro/`-Bündel —
  außer einer **benannten, aufgezählten Ausnahmeliste**. Die Liste umfasst
  mindestens: die Torseite selbst, deren CSS/JS, den OAuth-Rückweg und
  `/build.json` (D-07).
  ⚠ Diese Liste ist die typische Leckstelle solcher Tore. Sie gehört
  aufgezählt, begründet und **vorgeführt rot** — nicht angenommen.

- **D-07:** `/build.json` bleibt **offen**. Der Stempel enthält nur Commit-Hash
  und Datum, nichts Schützenswertes. `npm run check:staging` bleibt damit
  unverändert lauffähig — der Schritt, den CLAUDE.md zur Bedingung jeder
  Fertig-Meldung macht und dessen Fehlen schon vier Stunden Vortagsstand
  gekostet hat.

- **D-08:** Ein Rollenentzug wirkt **sofort beim nächsten Aufruf**.
  ⚠ „Sofort" heißt ausdrücklich **nicht** „eine HTTP-Anfrage an Discord je
  Seitenaufruf" — bei ~17.000 Unterseiten wäre das weder bezahlbar noch
  schnell. Der Bot kennt den Mitgliederstand aus dem Gateway-Ereignis
  (`guildMemberUpdate`) in Millisekunden. Wie dieser Stand an den Türsteher
  kommt, ist offen und Aufgabe der Recherche (siehe Claude's Discretion).

- **D-09:** Ist Discord nicht erreichbar (Störung, Rate-Limit), laufen
  **gültige Ausweise weiter**, neue werden verweigert. Eine Discord-Störung
  legt die Vorschau damit nicht lahm, öffnet sie aber auch nicht.

- **D-10:** Zusätzlich eine **Sperrliste** für den Sofort-Rauswurf: ein Eintrag
  macht den Ausweis ab dem nächsten Aufruf wertlos, unabhängig von der
  Discord-Rolle. Für den Fall, dass jemand Bildschirmfotos streut, ohne dass
  ihm gleich die Rolle genommen werden soll.

- **D-11:** Die Torseite zeigt: Wortmarke, zwei Sätze („Diese Vorschau ist für
  Testpiloten"), den Discord-Anmeldeknopf **und den Weg zur Rolle** (Link zum
  Discord-Server). **Ohne** `SiteNav` — die Menüstruktur wird nicht preisgegeben
  und die ~37 KB fallen weg. **Nur Englisch**; nach dem Anmelden geht es normal
  in der gewünschten Sprache weiter.
  ⚠ Folge: Ist die Torseite eine gebaute Astro-Seite, braucht sie eine benannte
  Ausnahme in `verify:sync` (das Tor vergleicht 8.678 EN/DE-Paare). Wird sie
  vom Rand ausgeliefert, sieht `verify:sync` sie gar nicht. Der Zuschnitt hat
  das zu klären.

- **D-12:** **Einzelstück für staging.** Kein Vorratsbau für ein späteres
  Gattern einzelner Live-Bereiche. Käme das je, ist es eine eigene Phase mit
  eigener Begründung.

- **D-13:** Eine Übersicht nennt, **wer die Rolle trägt und wann er zuletzt auf
  staging war**. Zeigt, wer wirklich testet und wer die Rolle nur trägt — die
  Frage, die bei Handvergabe unweigerlich kommt.

### Discord-Server

- **D-14:** Die Rolle behält den Anzeigenamen **„Test Pilots"** und den internen
  Schlüssel **`tester`**. Der Name passt zur Sprache der übrigen Rollen (Fleet
  Command, Navigators, Flight Computer) — alles Bordfunktionen, keine
  IT-Begriffe. Kein Umbenennen, keine doppelt zu pflegenden Texte.

- **D-15:** Die Rolle **fällt aus dem Discord-Onboarding heraus**
  (`discord/blueprint.mjs:402`, Prompt „Where should we ping you?", Option „Test
  pilot · Testpilot"). Sie ist danach nicht mehr selbst vergebbar.
  — **Reversibility:** reversible — ein Blueprint-Eintrag, per Build-Lauf
  wiederherstellbar.

- **D-16:** **Bestandsträger:** erst ein **Trockenlauf**, der Namen und Anzahl
  nennt, dann der Entzug bei **allen**. Danach vergibt der Betreiber gezielt
  neu. Sauberer Schnitt — ab dem Tor trägt die Rolle nur, wem er sie gegeben
  hat.
  — **Reversibility:** costly — der Entzug trifft echte Nutzerdaten auf dem
  lebenden Server; ein irrtümlicher Entzug ist nur durch erneute Handvergabe zu
  heilen, und der Betroffene bemerkt ihn.
  ⚠ **Ohne diesen Schritt ist das Tor wirkungslos.** Jeder, der sich die Rolle
  je im Onboarding geklickt hat, trägt sie heute noch und wäre in der Sekunde
  drin, in der das Tor scharf geht. Wie viele das sind, steht auf dem lebenden
  Server und ist im Repo nicht ablesbar — der Trockenlauf muss es zuerst
  feststellen. Vorbild: die `--dry-run`-Pflicht der Discord-Ankündigungen.

- **D-17:** Die Rolle darf **auf beliebigem Weg** vergeben werden — Discord-
  Oberfläche oder Bot-Befehl. Der Bot hängt seine Folgehandlungen (Begrüßung,
  Buchführung) an das Ereignis `guildMemberUpdate`, **nicht** an einen
  exklusiven Befehl. Ein Befehl als einziger Weg hätte genau das Loch, dass ein
  Rechtsklick aus Gewohnheit alle Folgehandlungen überspringt.

- **D-18:** **EIN** neuer privater Kanal in der bestehenden Kategorie
  `BUILD & FEEDBACK`, nur für Testpiloten sichtbar. Dort landen Deploy-Ping und
  die Rede über Unfertiges.
  ⚠ Begründungspflicht beachtet: am 17.08.2026 wurden `#suggestions` und
  `#support` zu **einem** `#feedback` zusammengelegt, weil zwei Türen für
  dieselbe Sache bei dieser Servergröße zwei halb leere Räume ergeben. Ein
  einzelner Raum für eine Gruppe, die es bisher nicht gibt, läuft dieser
  Richtung nicht zuwider — eine eigene Kategorie hätte es getan und wurde
  deshalb verworfen.

### Perks

- **D-19:** **Abzeichen** im Piloten-Profil, als zweites Abzeichen in derselben
  Reihe und Bauform wie die bestehende RSI-Verifizierung — gleiche Größe,
  gleicher Ort, eigene Farbe. Beschriftung „Testpilot" / „Test Pilot". Nutzt
  ein eingespieltes Muster statt eines neuen Gestaltungsproblems.
  ⚠ Das Abzeichen ist auf dem **öffentlichen** Profil `/pilot/<handle>` zu
  sehen, also auch für Besucher, die nicht der Testpilot sind. Der Zustand muss
  daher öffentlich lesbar gespiegelt werden (Spalte an `profiles` plus die
  bestehende `public_profiles`-View) — Discord bleibt die Wahrheit, die
  Spiegelung ist Anzeige.

- **D-20:** **Deploy-Ping** im Testpiloten-Kanal: „Neuer Vorschau-Stand" plus
  die **Commit-Betreffzeilen seit dem letzten Deploy**, dazu Commit-Kennung und
  Link. Die Betreffzeilen dieses Projekts sind in ganzen Sätzen geschrieben und
  lesen sich als Änderungsliste. Der Tester weiß, wo er hinsehen soll, statt
  die Seite abzusuchen. Keine Freigabeschleife — ein Perk, der auf Freigabe
  wartet, kommt in der Praxis oft gar nicht.

- **D-21:** **XP-Bonus** für jeden Fehlerbericht mit eigenem Thread in
  `#bug-reports` — **einmal je Thread**, nicht je Nachricht. Belohnt genau das
  Verhalten, wegen dem es die Rolle gibt, und ist durch Geplauder nicht zu
  erschleichen. Kein dauerhafter Multiplikator (belohnte Anwesenheit statt
  Arbeit), keine einmalige Gutschrift bei Ernennung (danach wirkungslos).

- **D-22:** **Namensnennung** ausschließlich auf **ausdrücklichen Wunsch** —
  ein Schalter im Konto, Standard **AUS**. Einen Namen zu veröffentlichen
  braucht eine Grundlage; die Datenschutzerklärung dieses Projekts ist an
  dieser Stelle sorgfältig, und die Liste soll dem nicht widersprechen.

### Claude's Discretion

Diese Punkte sind bewusst **nicht** entschieden und gehören in die Recherche:

1. **Wo der Türsteher sitzt.** Drei Kandidaten, gegeneinander zu bewerten:
   Cloudflare Worker vor staging · nginx `auth_request` gegen den Bot · njs im
   nginx-Image plus Supabase Edge Function. Bewertungsmaßstäbe: die Hausregel
   „Serverlogik nur als Supabase Edge Function" (PROJECT.md Constraints; es
   gibt **kein** Cloudflare-Pages-Projekt), die Zahl der Auslieferungsziele,
   die dadurch entsteht, und D-08 („sofort", ohne Anfrage je Seitenaufruf).

2. **Wie der Rollenstand zum Türsteher kommt.** Hängt der Bot direkt im
   Anfragepfad (dann ist er ein Einzelausfallpunkt für die ganze Vorschau), oder
   schiebt er Rollenänderungen bei `guildMemberUpdate` nach Supabase, sodass der
   Türsteher nur eine schnelle, verlässliche Quelle fragt? Der zweite Weg
   braucht zusätzlich einen vollständigen Abgleich beim Bot-Start, sonst driftet
   der Stand nach jedem Neustart.

3. **Wie der Nachweis den Rand erreicht.** ⚠ Die Sitzung liegt im
   `localStorage` (`assets/account-lite.js:11`, `sb-…-auth-token`) — nginx und
   Cloudflare sehen sie **nicht**. Es braucht zwingend einen eigenen,
   signierten Cookie. Dessen Form, Lebensdauer und Erneuerung sind offen.

4. **Ob die Torseite eine gebaute Astro-Seite ist oder vom Rand kommt** — und
   was das für `verify:sync` bedeutet (siehe D-11).

5. **Der Zuschnitt in Pläne.** Die Kopplung (D-01…D-03) ist Voraussetzung für
   Tor **und** Abzeichen und gehört in die erste Welle. Ob Discord-Umbau,
   Torbau und Perks je eine eigene Welle bilden, entscheidet der Planer gegen
   den gemessenen Umfang — die Phasen 2, 3 und 9 haben gezeigt, dass die
   Init-Granularität den tatsächlichen Umfang regelmäßig um ein Vielfaches
   unterschätzt.

### Folded Todos

Keine.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Projektregeln (bindend)

- `CLAUDE.md` — Liefergrundsätze: `npm run build && npm run gate` vor JEDEM
  Push; bei Toren/SEO/Sitemaps/Layout zusätzlich der Vorschau-Build mit
  `STAGING=1`; Fertig-Meldung erst nach `npm run check:staging`. Dazu die
  sieben Grundsätze für neue Prüfungen (vorgeführt rot, Selbstauskunft,
  FEHLER blockt/WARNUNG nicht, Torfähigkeit vor Verkabelung, Sperrklinken,
  benannte Ausnahmen, gegen das Artefakt prüfen).
- `docs/maschinelle-validierung.md` — das Konzept hinter der Torkette, § 4
  enthält die Grundsätze ausführlich.
- `scripts/lib/gate-registry.mjs` — jedes neue Prüfskript ist hier
  einzutragen; `verify:wiring` erzwingt das.
- `.planning/PROJECT.md` — Constraints (Serverlogik nur als Supabase Edge
  Function; DE/EN deckungsgleich; `versioned()`-Pflicht für Assets) und die
  `Out of Scope`-Zeile zum Discord-Ausbau, die diese Phase aufhebt.

### Auslieferung & Tor

- `nginx/default.conf` — Ursprungs-Konfiguration: Sicherheits-Kopfzeilen, CSP
  (Zeile 145), Cache-Regeln, `/build.json`-Sonderfall (Zeile 172),
  Sprach-Weiterleitungen, `.html`-Zwillingsregel.
- `Dockerfile` — Bauablauf, `STAGING`-Argument, die `npm run gate`-Stufe vor
  dem Auslieferungs-Image, der `sed` auf die RUM-Map bei Vorschau-Builds.
- `.github/workflows/deploy-staging.yml` — wie das Vorschau-Image entsteht,
  geprüft und ausgerollt wird; enthält den Rauchtest gegen den laufenden
  Container und den (weichen) Deploy-Check.
- `scripts/check-deployed.mjs` — was `npm run check:staging` tatsächlich
  abfragt; relevant für D-07.
- `.planning/codebase/INTEGRATIONS.md` — Übersicht, **aber mit Vorsicht**:
  die Datei lag bereits zweimal falsch (siehe `<code_context>`).

### Konto, Auth & Profil

- `supabase/functions/verify-rsi/index.ts` — die Blaupause für D-03:
  Fremdidentität serverseitig prüfen, Nutzer-ID aus dem Sitzungs-JWT, Schreiben
  mit der Service-Rolle.
- `supabase/config.toml` — ⚠ **nicht aufgeführte Functions bekommen beim
  Deploy `verify_jwt = true`.** Jede neue Function ist hier ausdrücklich
  einzutragen, sonst schaltet ein späterer Deploy sie still ab.
- `scripts/supabase-schema.sql` §4 (Zeilen 68–91) — `user_roles`, die
  `CHECK`-Klausel und die RLS-Politik; Grundlage von D-04 und D-05.
- `assets/account-lite.js` — SDK-freier Sitzungsleser, `window.VBAccount`, das
  bestehende Rollen-Gatter (Zeile 200 ff.) und die `localStorage`-Ablage
  (Zeile 11), die D-03/Discretion-3 begründet.
- `src/lib/supabase.ts` — Client-Aufbau, `flowType: 'implicit'`.
- `src/components/account/AuthLogin.astro`, `AuthRegister.astro` — die
  bestehenden Anmelde-/Registrierwege, an die D-01 andockt.
- `supabase/migrations/20260723000000_public_profile_views.sql` — die Views
  `public_profiles`/`public_favorites`, über die das Abzeichen aus D-19
  öffentlich sichtbar wird.
- `supabase/migrations/20260722200000_guard_rsi_verified.sql` — Präzedenzfall
  für einen Trigger, der Client-Schreibzugriff auf ein Vertrauensfeld sperrt;
  dieselbe Bauform braucht der Testpilot-Spiegel aus D-19.

### Discord

- `discord/blueprint.mjs` — Rollendefinition (Zeile 143), Onboarding-Eintrag
  (Zeile 402), Kategorien und Kanäle, `everyonePermissions`, die
  `renames{}`-Mechanik. Grundlage von D-14, D-15, D-18.
- `discord/build.mjs` — wie der Blueprint auf den lebenden Server angewandt
  wird; **löscht keine Kanäle**.
- `discord/bot/src/index.mjs`, `roles.mjs`, `ranks.mjs`, `leveling.mjs`,
  `award.mjs` — der laufende Bot; Rollenlogik und die XP-Maschinerie, an die
  D-21 andockt.
- `discord/bot/src/db.mjs` — SQLite-Ablage des Bots (getrennt von Supabase);
  relevant für D-13, falls die Buchführung dort landet.
- `discord/bot/src/patch-watch.mjs` — bestehender Automat, der Seiten-JSON
  liest und in einen Kanal postet; nächstes Vorbild für D-20.
- `discord/verify-invite.mjs` — Präzedenz für ein Discord-Prüfskript ohne
  Token-Bedarf.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`supabase/functions/verify-rsi/index.ts`** — vollständiges Muster für
  „Fremdidentität an das Konto binden": Nutzer-ID aus dem JWT, server-zu-server
  prüfen, mit Service-Rolle schreiben. Die Discord-Kopplung ist derselbe
  Vorgang mit anderer Gegenstelle.
- **`user_roles` + `account-lite.js:200-261`** — es gibt bereits ein
  rollenbasiertes Gatter, das `is-admin` auf das `<html>` setzt. Für D-04
  wiederverwendbar; für das Tor selbst **nicht** ausreichend (client-seitig).
- **`public_profiles`-View** — der Weg, auf dem das Abzeichen aus D-19
  öffentlich sichtbar wird, ohne die `profiles`-Tabelle freizugeben.
- **`guard_rsi_verified`-Trigger** — fertiges Muster gegen Client-Schreibzugriff
  auf ein Vertrauensfeld.
- **Bot-Ereignisschleife** — der Bot hält den Mitgliederstand ohnehin und
  bekommt `guildMemberUpdate` in Millisekunden. D-08 („sofort") ist damit
  billiger zu haben als ein Ausweis mit kurzer Laufzeit.
- **`discord/bot/src/patch-watch.mjs`** — bestehender „lies etwas, poste es in
  einen Kanal"-Automat; D-20 ist derselbe Bauplan mit anderer Quelle.

### Established Patterns

- **Statisches Astro-Build hinter nginx, kein Node in Produktion.**
  Serverlogik geht nur als Supabase Edge Function (PROJECT.md Constraints).
  Ein Cloudflare-**Pages**-Projekt existiert nicht — ob ein Cloudflare-**Worker**
  unter diese Regel fällt oder eine neue Auslieferungsschiene wäre, ist in der
  Recherche zu klären, nicht anzunehmen.
- **Torkette statt Einzelprüfung.** Neue Prüfskripte gehören in
  `scripts/lib/gate-registry.mjs`; `verify:wiring` erzwingt es. Jedes neue Tor
  wird einmal vorgeführt rot gefahren und druckt, wie viele Einheiten es
  geprüft hat.
- **DE/EN deckungsgleich**, maschinell erzwungen über `verify:sync` (8.678
  gebaute Paare, benannte Ausnahmen mit Anlass plus Zombie-Wächter). D-11
  (Torseite nur Englisch) braucht deshalb eine benannte Ausnahme **oder** liegt
  außerhalb des Builds.
- **Zerstörerische Handlungen brauchen zwei Klicks, der zweite trägt Worte**
  (Betreiberentscheidung 15.08., Phase 10). Gilt für den Rollenentzug aus D-16.
- **Discord-Massenaktionen immer erst als Trockenlauf.** Steht so in der
  Projekt-Erinnerung zu den Ankündigungen; D-16 folgt dem.
- **`versioned()`-Pflicht** für hand-verlinkte Assets — `/assets/*` liegt bis
  zu 24 h in nginx- und Cloudflare-Cache. Betrifft CSS/JS der Torseite.

### Integration Points

- **`nginx/default.conf`** — hier oder davor sitzt der Türsteher. Achtung: ein
  `add_header` in einer `location` **verwirft die Sicherheits-Kopfzeilen des
  `server`-Blocks** (im Kopf der Datei ausdrücklich vermerkt). Wer dort
  Kopfzeilen setzt, muss HSTS, CSP und X-Frame-Options mitführen.
- **CSP `connect-src`** — steht heute auf `'self' blob:` plus Supabase und
  Web3Forms. Kommt eine Gegenstelle dazu (Discord-OAuth-Rückweg, ein eigener
  Auth-Endpunkt), ist sie hier einzutragen **und** `npm run audit:csp` erneut
  zu fahren, sonst blockt die Richtlinie still.
- **`supabase/config.toml`** — jede neue Edge Function braucht hier ihren
  Eintrag mit begründetem `verify_jwt`.
- **`discord/blueprint.mjs` + `build.mjs`** — Rolle und Kanal entstehen über
  den Blueprint, nicht von Hand am Server.
- **`.github/workflows/deploy-staging.yml`** — Ort für den Deploy-Ping aus
  D-20 (der Lauf kennt Commit-Kennung und Zeitpunkt), sofern der Ping nicht
  vom Bot selbst ausgelöst wird.

### ⚠ Zwei Irrtümer in der eigenen Dokumentation (gegen den Bestand geprüft)

1. **`INTEGRATIONS.md` nennt für `user_roles` die Rollen „`admin`, `beta`".**
   Tatsächlich erlaubt die `CHECK`-Klausel nur `'user'` und `'admin'`
   (`scripts/supabase-schema.sql:73`) — ein `beta` gibt es nicht. Außerdem ist
   `user_id` Primärschlüssel: **ein Konto trägt genau eine Rolle**. Beides ist
   Grundlage von D-05.

2. Dieselbe Datei lag am 03.08.2026 schon einmal falsch (sie behauptete, alle
   Edge Functions verlangten ein Session-JWT; `register` läuft seit jeher ohne).
   Der Irrtum hätte die Kontoanmeldung abgeschaltet. **Für diese Phase gilt
   deshalb: `INTEGRATIONS.md` ist ein Wegweiser, kein Beleg** — jede Aussage
   über die lebende Anlage ist dort zu prüfen, wo sie herkommt.

</code_context>

<specifics>
## Specific Ideas

- **Der Anlass in Betreiberworten:** „momentan ist staging.verse-base.com alle
  erreichbar. ich möchte dass es so ist dass nur leute die die Tester rolle auf
  discord haben, haben nur zugriff auf die seite." Dazu die Erwartung, dass die
  Rolle „mit perks und zeug" kommt — die Rolle soll etwas wert sein, nicht bloß
  eine Schranke bedienen.

- **Der Betreiber hielt die Rolle für nicht existent** („es gibt ausserdem noch
  glaube ich gar keine tester rolle auf discord"). Sie existiert seit dem
  Serveraufbau, ist aber selbst vergebbar — genau deshalb ist D-15/D-16 der
  Kern und nicht das Beiwerk.

- **Vorbild für das Abzeichen** ist die vorhandene RSI-Verifizierung: gleiche
  Reihe, gleiche Bauform, eigene Farbe. Ausdrücklich **nicht** prominenter als
  RSI — das würde die Rangfolge der beiden Nachweise verdrehen.

- **Vorbild für den Ton der Rollennamen** sind die bestehenden Rollen: Fleet
  Command, Navigators, Flight Computer, Test Pilots. Alles Bordfunktionen. Ein
  nüchternes „Testers" wurde deshalb verworfen.

</specifics>

<deferred>
## Deferred Ideas

- **Das Tor auf Teile der Live-Seite ausweiten** — als eigene Phase mit eigener
  Begründung, falls je gebraucht (aus D-12).
- **Bewerbungsverfahren für die Rolle** (Knopf/Formular im Discord, Betreiber
  winkt durch) — verworfen zugunsten der Handvergabe; wieder aufzugreifen,
  sobald die Zahl der Anfragen die Handvergabe sprengt.
- **Automatische Rollenvergabe ab Rang oder nach N Fehlerberichten** —
  verworfen, weil der Betreiber die Kontrolle darüber behalten will, wer die
  unfertige Seite sieht.
- **Eigene Kategorie mit mehreren Testpiloten-Kanälen** — verworfen zugunsten
  eines einzelnen Raums (D-18); erst sinnvoll, wenn der eine Raum zu voll wird.

### Reviewed Todos (not folded)

- **„Angeheftete Signatur-Minerale kontogebunden speichern (Tabelle + RLS)"**
  (`.planning/todos/signatur-liste-kontogebunden.md`) — vom Werkzeug mit
  Übereinstimmung 0,6 vorgeschlagen, aber der Treffer beruht ausschließlich auf
  deutschen Füllwörtern („die", „der", „2026", „context", „voraussetzung"). Der
  Inhalt betrifft die Mining-Signaturen und ist in den Phasen 9/10 erledigt.
  **Nicht eingefaltet** — kein Bezug zu dieser Phase.

</deferred>

---

*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Context gathered: 2026-08-17*
