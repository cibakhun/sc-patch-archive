# API Coverage — Discord (REST + Gateway) und Supabase (Auth + PostgREST)

> Volle Abdeckung ist die Vorgabe. Jeder `OPT-OUT` ist eine ausdrückliche,
> begründete Entscheidung — nicht eine Lücke, an die niemand gedacht hat.

**Detektor:** `gsd-core/bin/lib/api-coverage.cjs --json` gegen
`15-CONTEXT.md` + `15-RESEARCH.md` + den ROADMAP-Abschnitt.
Mit dem mitgelieferten (englischen) Vokabular meldet er `detected: false` —
die Phasenunterlagen sind deutsch. Mit der am Aufrufort erlaubten
Vokabel-Erweiterung (`--verbs …,kopplung,anbinden,verdrahten --nouns
…,gateway,provider,schnittstelle`) meldet er `detected: true`
(Signal: `kopplung` + `oauth`). Die Matrix ist deshalb Pflicht.

## Discord — REST

| capability | decision | reason |
|---|---|---|
| `GET /guilds/{id}/members` (Mitgliederliste, paginiert) | INTEGRATE | Trockenlauf D-16 (`discord/tester-dry-run.mjs`); läuft ohne privilegiertes Intent |
| `GET /guilds/{id}/members/{user}` (Einzelmitglied) | INTEGRATE | Reconcile-Einzelfall und Prüfpfad im Bot |
| `DELETE /guilds/{id}/members/{user}/roles/{role}` (Rolle entziehen) | INTEGRATE | D-16 Entzug bei allen Bestandsträgern |
| `PUT /guilds/{id}/members/{user}/roles/{role}` (Rolle vergeben) | OPT-OUT | D-16/D-17: der Betreiber vergibt von Hand über die Discord-Oberfläche; ein Vergabe-Befehl wäre genau der exklusive Weg, den D-17 verwirft |
| `GET /guilds/{id}/roles` (Rollenliste) | INTEGRATE | Auflösung des Schlüssels `tester` auf die Rollen-ID, ohne ID-Verdrahtung |
| `POST /guilds/{id}/channels` + `overwrites` (Kanal anlegen, Sichtbarkeit) | INTEGRATE | D-18, über `discord/blueprint.mjs` + `discord/build.mjs` |
| `DELETE /channels/{id}` (Kanal löschen) | OPT-OUT | `build.mjs` löscht grundsätzlich keine Kanäle — Löschen nähme die Beiträge mit; Stilllegen bleibt Handarbeit (Bestandsregel) |
| `PUT /guilds/{id}/onboarding` (Onboarding-Prompts) | INTEGRATE | D-15: der selbst vergebbare Eintrag fällt heraus |
| `POST /channels/{id}/messages` bzw. Webhook-Post (Embed) | INTEGRATE | D-20 Deploy-Ping in den Testpiloten-Kanal |
| `POST /channels/{id}/threads` (Thread anlegen) | OPT-OUT | der Bot legt keine Threads an; er reagiert nur auf die von Nutzern angelegten (D-21) |
| Slash-Command-Registrierung (`PUT /applications/{id}/commands`) | OPT-OUT | D-17: Folgehandlungen hängen am Ereignis, nicht an einem Befehl — ein neuer Befehl entstünde ohne Zweck |
| `GET /users/@me/guilds` (OAuth-Gilden des Nutzers) | OPT-OUT | die Rollenwahrheit kommt aus dem Bot-Gateway (D-03/D-25), nicht aus einem Nutzer-Token; ein zusätzlicher OAuth-Scope wäre unnötige Datenerhebung |

## Discord — Gateway (Bot)

| capability | decision | reason |
|---|---|---|
| `GuildMemberUpdate` | INTEGRATE | D-17/D-25: Kern des Push-Mechanismus |
| `GuildMemberRemove` | INTEGRATE | Austritt muss den Spiegel genauso räumen wie ein Rollenentzug, sonst bleibt ein toter Ausweis gültig |
| `GuildMemberAdd` | INTEGRATE | Reconcile-Vollständigkeit: ein Beitritt mit vorbelegter Rolle darf nicht erst beim nächsten Bot-Start ankommen |
| `ThreadCreate` (Forum `#bug-reports`) | INTEGRATE | D-21 XP je Fehlerbericht-Thread |
| `GuildMembersChunk` / `guild.members.fetch()` (Voll-Cache) | INTEGRATE | Startup-Reconcile (D-25, zweite Hälfte) |
| `PresenceUpdate` (privilegiertes Presence-Intent) | OPT-OUT | nicht gebraucht und ausdrücklich unerwünscht — ein zweites privilegiertes Intent erweitert die Datenerhebung ohne Gegenwert (RESEARCH Security Domain) |
| `MessageContent` (privilegiert) | OPT-OUT | unverändert aus; die XP-Vergabe braucht den Thread, nicht seinen Text |
| `GuildBanAdd/Remove` | OPT-OUT | die Sperrliste D-10 ist site-seitig und bewusst unabhängig von Discord-Bans |

## Supabase — Auth

| capability | decision | reason |
|---|---|---|
| Discord-Provider (`signInWithOAuth`) | INTEGRATE | D-01 |
| Identitäts-Verknüpfung bei gleicher E-Mail | INTEGRATE | Voraussetzung, damit D-02 einen bekannten Nutzer nicht fälschlich aussperrt |
| `linkIdentity` (Discord an ein angemeldetes Konto hängen) | INTEGRATE | zweiter Weg zur selben Kopplung; der Riegel D-02 darf ihn nicht treffen |
| `unlinkIdentity` | OPT-OUT | keine Entscheidung verlangt es; eine Entkopplung ohne begleitende Spiegel-Räumung wäre ein neues Loch — eigene Phase, falls je gebraucht |
| `GET /auth/v1/user` (Token → Nutzer) | OPT-OUT | der Türsteher nutzt stattdessen EINEN PostgREST-Aufruf mit demselben Token; ein zweiter Netzweg brächte keine zusätzliche Aussage |
| Auth-Hook „Before User Created" | OPT-OUT | Tarif-Verfügbarkeit unbelegt (RESEARCH A1); D-02 wird als Trigger auf `auth.users` gebaut — im Repo, versioniert, vorgeführt rot fahrbar |
| Passwort-Anmeldung, Registrierung, Reset | INTEGRATE | Bestand, bleibt unangetastet — und ist genau das, was der Riegel D-02 NICHT brechen darf |
| Anonyme Anmeldung | OPT-OUT | widerspräche D-02 (jeder Testpilot trägt eine bestätigte E-Mail-Adresse) |

## Supabase — PostgREST / Postgres

| capability | decision | reason |
|---|---|---|
| `POST /rest/v1/rpc/gate_verdict` (Torurteil) | INTEGRATE | einziger Netzaufruf des Türstehers beim Ausstellen |
| `GET /rest/v1/user_roles` mit Nutzer-Token | INTEGRATE | Admin-Kurzschluss D-04 im Tracer; wandert danach in `gate_verdict` |
| `GET/PATCH /rest/v1/discord_role_state` mit Service-Rolle | INTEGRATE | Bot-Push D-25 |
| `GET /rest/v1/public_profiles` | INTEGRATE | Abzeichen D-19 auf dem öffentlichen Profil |
| Realtime-Abonnements | OPT-OUT | Bestandsentscheidung der Seite: Präsenz läuft über Polling, kein `wss:` in der CSP — der Türsteher braucht keinen Live-Kanal |
| Storage | OPT-OUT | diese Phase legt keine Dateien ab |

## Nicht-Abdeckung, die keine ist

`user_roles` wird bewusst **nicht** um `tester` erweitert (D-05). Das ist kein
Opt-out einer Fähigkeit, sondern eine Entscheidung über den Ort der Wahrheit:
`user_id` ist Primärschlüssel, ein Konto trüge sonst entweder `admin` **oder**
`tester`, nie beides.
