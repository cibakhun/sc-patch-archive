# Phase 14: Testpilot-Zugang: staging hinter der Discord-Rolle - Research

**Recherchiert:** 2026-08-17
**Domäne:** Edge-Zugriffskontrolle vor einer statischen Astro/nginx-Seite, Discord-OAuth-Kopplung an Supabase Auth, Rollen-Zustandssynchronisation aus einem Gateway-Bot
**Konfidenz:** MITTEL — die Architekturempfehlung (Abschnitt „Wo der Türsteher sitzt") ist aus verifizierten Fakten hergeleitet, enthält aber mehrere Punkte, die erst gegen die lebende Supabase-Anlage bzw. den lebenden Discord-Server bestätigt werden müssen (siehe Assumptions Log und Open Questions).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Alle 22 Entscheidungen D-01 bis D-22 aus `14-CONTEXT.md` sind bindend und werden unten nicht erneut zur Debatte gestellt. Kurzfassung (Volltext in CONTEXT.md):

- **D-01** Discord = zweiter, gleichberechtigter Anmeldeweg (Supabase-Provider ab Werk)
- **D-02** Discord-Knopf meldet nur an, legt NIE ein Konto an — Riegel serverseitig, vorgeführt rot vor Scharfschaltung
- **D-03** Discord-Identität einmal per OAuth bewiesen, danach beantwortet der Bot-Token server-zu-server; Bauform = `supabase/functions/verify-rsi/index.ts`
- **D-04** `admin`-Rolle aus `user_roles` öffnet das Tor allein, unabhängig von Discord; kein zweites Notschloss per Env-Var
- **D-05** `public.user_roles` bleibt unangetastet (`user`/`admin` only, `user_id` Primärschlüssel) — Testpilot-Eigenschaft lebt NICHT dort
- **D-06** Tor sperrt ALLES außer einer benannten, aufgezählten Ausnahmeliste — vorgeführt rot
- **D-07** `/build.json` bleibt offen (nur Commit-Hash + Datum)
- **D-08** Rollenentzug wirkt sofort beim nächsten Aufruf — AUSDRÜCKLICH NICHT eine HTTP-Anfrage an Discord je Seitenaufruf
- **D-09** Discord nicht erreichbar → gültige Ausweise laufen weiter, neue werden verweigert
- **D-10** Zusätzliche Sperrliste für Sofort-Rauswurf unabhängig von der Discord-Rolle
- **D-11** Torseite: Wortmarke, zwei Sätze, Discord-Anmeldeknopf, Weg zur Rolle; OHNE SiteNav; NUR Englisch
- **D-12** Einzelstück für staging — kein Vorratsbau für Live-Gattung
- **D-13** Übersicht: wer trägt die Rolle und wann zuletzt auf staging
- **D-14** Rolle behält Anzeigename „Test Pilots", internen Schlüssel `tester`
- **D-15** Rolle fällt aus dem Discord-Onboarding heraus (`discord/blueprint.mjs:402`)
- **D-16** Bestandsträger: erst Trockenlauf (Namen + Anzahl), dann Entzug bei ALLEN, danach gezielte Neuvergabe
- **D-17** Rolle auf beliebigem Weg vergebbar; Bot hängt Folgehandlungen an `guildMemberUpdate`, nicht an einen exklusiven Befehl
- **D-18** EIN neuer privater Kanal in `BUILD & FEEDBACK`, nur für Testpiloten sichtbar
- **D-19** Abzeichen im Piloten-Profil, gleiche Bauform wie RSI-Verifizierung, auf dem ÖFFENTLICHEN `/pilot/<handle>` sichtbar
- **D-20** Deploy-Ping im Testpiloten-Kanal mit Commit-Betreffzeilen seit letztem Deploy
- **D-21** XP-Bonus je Fehlerbericht-Thread in `#bug-reports`, einmal je Thread
- **D-22** Namensnennung nur auf ausdrücklichen Wunsch, Schalter im Konto, Standard AUS

### Claude's Discretion

1. Wo der Türsteher sitzt (Cloudflare Worker vs. nginx `auth_request` gegen den Bot vs. njs + Supabase Edge Function)
2. Wie der Rollenstand zum Türsteher kommt (Bot im Anfragepfad vs. Push nach Supabase bei `guildMemberUpdate` + Startup-Reconcile)
3. Form, Lebensdauer und Erneuerung des signierten Cookies
4. Ob die Torseite eine gebaute Astro-Seite ist oder vom Rand kommt, und was das für `verify:sync` bedeutet
5. Der Zuschnitt in Wellen; die Kopplung (D-01…D-03) gehört in die erste Welle

### Deferred Ideas (OUT OF SCOPE)

- Das Tor auf Teile der Live-Seite ausweiten (eigene Phase, eigene Begründung)
- Bewerbungsverfahren für die Rolle im Discord
- Automatische Rollenvergabe ab Rang/Fehlerberichtszahl
- Eigene Kategorie mit mehreren Testpiloten-Kanälen
- `signatur-liste-kontogebunden.md` — geprüft, kein Bezug zu dieser Phase

</user_constraints>

## Summary

Die Seite ist ein zu 100 % statisches Astro-Build hinter `nginx:alpine`, ausgeliefert als EIN Docker-Image über GitHub Actions → GHCR → Coolify, mit Cloudflare nur als DNS/TLS/Proxy davor. Es gibt **keinen Node-Prozess in Produktion** und **kein Cloudflare-Pages-Projekt**. Die einzige heute existierende Form von Server-Logik sind Supabase Edge Functions (Deno). Der Discord-Bot läuft als eigenständiges, drittes Deploy-Ziel (`ghcr.io/cibakhun/verse-base-rank-bot` auf Coolify) und ist reiner Gateway-Client — er hat **keinen HTTP-Server**, **keine privilegierten Intents** (`Guilds`, `GuildMessages`, `GuildVoiceStates`; explizit dokumentiert: „No privileged intents are required — leave them off" in `discord/README.md:79`), und kann heute keine Mitgliederliste lesen (`discord/prune.mjs:149-165`, `discord/audit.mjs:267-269` behandeln das fehlende `GuildMembers`-Intent als bewusste Design-Entscheidung).

Die zentrale Recherche-Erkenntnis, die die ganze Architektur bestimmt: **Ein signierter Cookie für `staging.verse-base.com` kann NICHT von einer Supabase Edge Function (Domain `trgjhmbnodoarnfmlcqx.supabase.co`) per `fetch()` aus dem Browser gesetzt werden** — `Set-Cookie` aus einer Cross-Origin-`fetch()`-Antwort setzt den Cookie für die ANTWORTENDE Domain, nicht für die aufrufende Seite. Der Cookie muss von einer Antwort GEMINT werden, die selbst von `staging.verse-base.com` kommt. Da dort kein Node läuft, bleibt dafür nur **njs innerhalb desselben nginx-Prozesses**, der die Seite ohnehin ausliefert — njs kann server-zu-server (nicht browser-cross-origin) mit Supabase sprechen und die Antwort mit `Set-Cookie` auf der eigenen Domain versehen.

Das favorisiert Kandidat (c): **njs im nginx-Image mints und prüft einen eigenen, opaken HMAC-signierten Cookie; die Rollen-Wahrheit liegt in Supabase Postgres, dorthin PUSHT der Bot bei `guildMemberUpdate`** (Bot ist damit nicht im Anfragepfad, nur bei Anmeldung/Erneuerung beteiligt — löst Discretion #2 zugunsten „Push"). Kandidat (a) Cloudflare Worker verstößt gegen die bestehende Projektregel „kein Server-Code außer Supabase Edge Function" und wäre ein VIERTES Ausliefungsziel mit eigener CI/Secrets-Kette — technisch machbar, aber ein Bruch einer bestehenden, nicht zur Disposition stehenden Beschränkung, der eine ausdrückliche Neu-Entscheidung des Betreibers bräuchte. Kandidat (b) nginx `auth_request` gegen den Bot ist als *reine* Pro-Request-Prüfung ein Single Point of Failure, der D-09 direkt verletzt (Bot down ⇒ auch gültige Ausweise scheitern) — als *Mint-Autorität* (nur bei Login/Renewal, nicht pro Seitenaufruf) wäre er technisch gangbar, büßt dabei aber gegenüber (c) nichts ein und gewinnt eine neue, ungetestete HTTP-Server-Rolle für den Bot, ohne einen Vorteil zu bieten.

**Primäre Empfehlung:** njs-Modul im nginx-Image (`nginx-module-njs`, per `apk` aus dem offiziellen nginx-Alpine-Repository installiert) übernimmt Prüfung und Ausstellung eines eigenen, opaken (NICHT JWT-förmigen) HMAC-SHA256-signierten Cookies mit kurzer Gültigkeit (Empfehlung: 5–10 Minuten, still erneuert durch ein clientseitiges Skript nach demselben Muster wie `assets/account-lite.js`s `ensureSession()`). Die Rollen-Wahrheit liegt in einer neuen Supabase-Tabelle, die der Bot bei jedem `guildMemberUpdate` PUSHT plus bei Bot-Start vollständig abgleicht. njs verifiziert den Supabase-Zugriffstoken NICHT selbst (Signaturverfahren unbekannt/instabil, siehe Assumptions Log A5), sondern ruft beim Mint-Vorgang server-zu-server `GET /auth/v1/user` bei Supabase auf.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Zugriffsentscheidung je Seitenaufruf | CDN/Edge (njs in nginx) | — | Muss ohne Netzlatenz und ohne Fremdaufruf laufen (D-08); reine Cookie-Signaturprüfung ist die einzige Form, die das leistet |
| Ausstellung/Erneuerung des Zugangs-Cookies | CDN/Edge (njs, server-zu-server) | Database/Storage (Supabase) | Muss auf der Site-eigenen Origin passieren (Cross-Origin-Cookie-Problem, siehe Summary); njs ruft Supabase server-zu-server, nicht der Browser |
| Discord-OAuth-Identitätsnachweis | API/Backend (Supabase Auth) | Browser/Client (Redirect-Flow) | Ab-Werk-Provider; Supabase hält den OAuth-State-Handshake |
| Kontoerstellungssperre für Discord-Login | API/Backend (Supabase Auth Hook / DB-Trigger) | — | Muss serverseitig sitzen (D-02); Client kann den Riegel umgehen |
| Rollen-Zustand „trägt jemand `tester`?" | Discord-Bot (Push bei Event) | Database/Storage (Supabase-Tabelle als Cache) | Bot ist die einzige Instanz mit Gateway-Zugriff; Supabase ist die schnelle, verlässliche Quelle für den Türsteher (D-08-Begründung) |
| Sperrliste (Sofort-Rauswurf) | Database/Storage (Supabase-Tabelle) | CDN/Edge (bei Mint geprüft) | Reine Datenhaltung; Prüfzeitpunkt ist Mint, nicht jeder Request |
| Testpilot-Übersicht (D-13) | Frontend/Account-Seite | Database/Storage | Bestehendes Muster: kontogebundene Seite liest Supabase über RLS |
| Abzeichen auf `/pilot/<handle>` | Database/Storage (View-Spalte) | Frontend/Static (Client-Fetch) | Exaktes Vorbild `rsi_verified` in `public_profiles`; Anzeige bleibt client-seitig wie der Rest der Seite |
| Deploy-Ping | API/Backend (GH-Actions-Schritt ODER Bot) | Discord (Kanal) | Commit-Betreffs liegen in git — nur GH Actions hat sie ohne Umweg; der Bot hat keinen git-Zugriff im Container |
| XP je Bug-Report-Thread | Discord-Bot (Event-Handler) | Database/Storage (SQLite des Bots) | Bestehende XP-Maschinerie (`award.mjs`), neuer Trigger auf Forum-Thread-Erstellung |
| Rollenentzug bei Bestandsträgern (D-16) | Discord-Bot (Skript, Trockenlauf-Pflicht) | — | Live-Server-Zustand, nicht in git — Skript-Präzedenz `discord/prune.mjs` |

## Standard Stack

### Core

| Library/Komponente | Version | Zweck | Warum Standard |
|---------|---------|---------|--------------|
| `nginx-module-njs` | an die im `nginx:alpine`-Basis-Image installierte nginx-Version gebunden (apk-Paket aus dem offiziellen nginx.org-Alpine-Repo) | HMAC-Cookie prüfen/minten, interne Weiterleitung auf die Torseite | Einziger Weg, Server-Logik AUF der Site-eigenen Origin laufen zu lassen, ohne Node in Produktion einzuführen [CITED: nginx.org njs docs, docker-nginx GitHub #317] |
| `@supabase/supabase-js` | ^2.110.9 (bereits Projekt-Dependency, `package.json:71`) | Discord-OAuth-Button, `linkIdentity`, Session-Handling auf der Torseite | Bereits im Einsatz auf `/account/`-Seiten; keine neue Abhängigkeit [VERIFIED: package.json] |
| `discord.js` | ^14.16.3 (bereits Bot-Dependency, `discord/bot/package.json:18`) | `GuildMembers`-Intent für `guildMemberUpdate` aktivieren | Bereits im Einsatz; Intent-Aktivierung ist Konfiguration, kein neues Paket [VERIFIED: discord/bot/package.json] |

### Supporting

| Library | Version | Zweck | Wann nutzen |
|---------|---------|---------|-------------|
| Deno `crypto.subtle` (Web Crypto API, in jeder Supabase-Edge-Function-Laufzeit eingebaut) | — | HMAC-SHA256 auf beiden Seiten (Mint in njs, ggf. Gegenkontrolle in einer Edge Function) | Falls die Signaturlogik in eine Edge Function statt vollständig in njs gelegt wird — kein neues Paket nötig |
| njs `crypto`-Modul (`require('crypto')`, ab njs 0.7.0 eingebaut) | mit nginx-module-njs mitgeliefert | `createHmac('sha256', …)` für Cookie-Signatur direkt in nginx | Kernbaustein der Empfehlung — kein externes Paket, kein `npm install` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| njs-HMAC-Cookie | Vollständige JWT-Prüfung des Supabase-Access-Tokens direkt in njs | Setzt eine bekannte, stabile Signatur voraus — dieses Projekt hat den neuen `sb_publishable_…`-Schlüsseltyp (`assets/account-lite.js:10`), was auf eine mögliche Migration zu asymmetrischer Signatur (ES256/RS256 + JWKS) hindeutet [CITED: supabase.com/blog/jwt-signing-keys]. JWKS-Rotation in njs nachzubilden ist fragil; die Empfehlung meidet das bewusst, indem der Token nur EINMAL beim Mint server-zu-server an `/auth/v1/user` verifiziert wird, statt die Signatur selbst zu prüfen |
| njs im nginx-Image | `ngx_http_secure_link_module` (offizieller, aber nicht standardmäßig in `nginx:alpine` kompilierter nginx-Kernmodul) | Schlanker (kein `.so`, kein `load_module`), aber nur MD5-basiert, nicht HMAC-SHA256 — kryptografisch schwächer, und die Verfügbarkeit im offiziellen Alpine-Image ist NICHT bestätigt (Recherche ergab kein eindeutiges Ja — siehe Open Questions). Realistische Alternative, falls njs im Bau Probleme macht |
| Push-basierter Rollen-Cache (Supabase-Tabelle) | Bot mit eigenem HTTP-Server im Anfragepfad (Kandidat b, echt) | Macht den Bot zum Single Point of Failure für die GESAMTE Vorschau bei jedem Seitenaufruf — verletzt D-09 wörtlich, sobald der Bot neu startet oder abstürzt (Coolify-Redeploys, Crashes) |
| Cloudflare Worker | — (verworfen) | Bricht `PROJECT.md` Constraints „kein serverseitiger Code außer Supabase Edge Function" und fügt ein VIERTES Ausliefungsziel mit eigenem CI/Secret hinzu; siehe eigener Abschnitt unten |

**Installation:**
```bash
# Im Dockerfile, VOR `FROM nginx:alpine` Kopierschritten:
RUN apk add --no-cache nginx-module-njs
# und in nginx.conf (main-Kontext, vor events{}):
# load_module modules/ngx_http_js_module.so;
```

**Versionsprüfung:** `nginx-module-njs` ist kein npm/PyPI/cargo-Paket, sondern ein System-Paket aus dem offiziellen nginx.org-Alpine-Repository — die übliche Registry-Prüfung (`npm view`) greift hier nicht. Es MUSS gegen die im konkreten `nginx:alpine`-Tag laufende nginx-Version verifiziert werden (`docker run --rm nginx:alpine nginx -V` und `docker run --rm nginx:alpine apk info nginx-module-njs`), weil das Paket exakt an die core-nginx-Version gebunden ist — ein Versions-Mismatch nach einem Alpine-Base-Image-Update ist ein bekanntes Bruchrisiko [CITED: mailman.nginx.org 2021-June/060741]. Dieser Check gehört als eigener Schritt in den Plan, nicht ins Vertrauen auf diese Recherche.

## Package Legitimacy Audit

Diese Phase fügt **keine neuen npm/PyPI/cargo-Pakete** hinzu. `@supabase/supabase-js` und `discord.js` sind bereits Projekt-Dependencies (siehe Standard Stack, mit Datei:Zeile verifiziert). `nginx-module-njs` ist ein Betriebssystem-Paket aus dem offiziellen nginx.org-Repository, kein Registry-Paket — die Slopsquatting-Gefahr des npm-Ökosystems entfällt strukturell, das reale Risiko ist stattdessen ein Versions-Mismatch (siehe oben).

| Package | Registry | Alter | Herunterladen | Quell-Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@supabase/supabase-js` | npm | bereits im Projekt, Version fixiert | — | github.com/supabase/supabase-js | OK | Bestand, keine Änderung |
| `discord.js` | npm | bereits im Projekt, Version fixiert | — | github.com/discordjs/discord.js | OK | Bestand, keine Änderung |
| `nginx-module-njs` | apk (nginx.org-Alpine-Repo) | Kernprojekt seit 2015 (njs), first-party nginx.org | — | github.com/nginx/njs | OK (kein Registry-Paket im klassischen Sinn) | Version MUSS gegen den konkreten Alpine-Tag geprüft werden (siehe „Versionsprüfung" oben) |

**Packages entfernt wegen [SLOP]-Urteil:** keine.
**Packages als [SUS] markiert:** keine.

## Architecture Patterns

### System Architecture Diagram

```
Browser (Test-Pilot, erster Login)
   │
   │ 1. Klick "Mit Discord anmelden" auf der Torseite
   ▼
Discord OAuth-Authorize  ──────►  Supabase Auth (trgjhmbnodoarnfmlcqx.supabase.co)
   │                                   │ (Redirect mit Access-Token im URL-Fragment,
   │                                   │  flowType:'implicit', detectSessionInUrl)
   ▼                                   │
Browser landet zurück auf der Torseite (staging.verse-base.com) ◄──────────┘
   │
   │ 2. Torseite lädt vollen supabase-js-Client (NICHT account-lite.js —
   │    braucht detectSessionInUrl), erkennt Session, liest Access-Token
   ▼
fetch POST https://staging.verse-base.com/_gate/mint   (SAME-ORIGIN!)
   │        Authorization: Bearer <supabase-access-token>
   ▼
┌─────────────────────────── nginx + njs (staging.verse-base.com) ───────────────────────────┐
│  njs-Handler für /_gate/mint:                                                                │
│    a) js_fetch server-zu-server → Supabase Auth GET /auth/v1/user  (Token → user.id)         │
│    b) js_fetch server-zu-server → Supabase PostgREST: discord_role_state + tester_blocklist  │
│       WHERE user_id = user.id  (admin-Kurzschluss: user_roles.role = 'admin')                │
│    c) Verdict: darf rein? → HMAC-SHA256(payload, secret) → opaker Cookie                      │
│    d) Set-Cookie: vb_gate=<payload>.<hmac>; Domain=staging.verse-base.com; HttpOnly; Secure;  │
│       SameSite=Lax; Max-Age=~600                                                             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
   │
   │ 3. Redirect zurück zur ursprünglich gewünschten URL
   ▼
JEDER weitere Seitenaufruf (Text-HTML, /_astro/*.js, Bilder, …):
┌─────────────────────────── nginx + njs (jede location außer Ausnahmeliste) ─────────────────┐
│  njs prüft NUR: existiert vb_gate-Cookie? HMAC gültig? nicht abgelaufen?                     │
│  → JA: Datei ausliefern wie bisher (kein Netz, keine DB, keine Discord-Anfrage)               │
│  → NEIN: interner Redirect auf /gate.html (Torseite)                                          │
└────────────────────────────────────────────────────────────────────────────────────────────┘

Stille Erneuerung (alle ~5 Min, solange Tab offen, analog account-lite.js ensureSession()):
Browser  ──fetch POST /_gate/mint (Bearer <ggf. refreshte Session>)──►  njs (wie oben)

Rollen-Wahrheit (unabhängig vom Anfragepfad, läuft im Hintergrund):
Discord Gateway ──guildMemberUpdate──► Bot (GuildMembers-Intent) ──PATCH──► Supabase
                                          │
                                          └─ bei Bot-Start: voller Reconcile
                                             (alle Mitglieder mit Rolle `tester` lesen,
                                              Tabelle diffen — braucht GuildMembers-Intent)
```

### Recommended Project Structure
```
supabase/
├── functions/
│   └── link-discord-role/    # optional, falls Verifikationslogik dorthin statt in njs wandert
├── migrations/
│   └── 20260818000000_discord_tester_gate.sql   # discord_role_state, tester_blocklist, Tabellen
nginx/
├── default.conf              # neue location-Blöcke, gate-Ausnahmeliste
└── gate.js                   # njs-Skript (mint + verify)
discord/bot/src/
├── index.mjs                 # GatewayIntentBits.GuildMembers ergänzen
├── role-sync.mjs             # NEU: guildMemberUpdate-Handler → Supabase PATCH
└── role-reconcile.mjs        # NEU: Startup-Vollabgleich
src/pages/
└── gate.astro (oder gate-en Seite)   # Torseite, EN-only, ohne SiteNav
scripts/
└── verify-gate.mjs           # NEU: Schiene-A-Prüfer für die Ausnahmeliste (vorgeführt rot)
```

### Pattern 1: Fremdidentität serverseitig prüfen, mit Service-Rolle schreiben
**Was:** Nutzer-ID kommt aus dem Session-JWT, niemals aus dem Body; Schreiben nur mit Service-Rolle.
**Wann nutzen:** Für jede Stelle, die Discord-Zustand (Rolle, Blocklist) mit dem Site-Konto verknüpft.
**Beispiel:**
```typescript
// Source: supabase/functions/verify-rsi/index.ts:69-93 (bestehendes Projektmuster, VERIFIED)
const authHeader = req.headers.get('Authorization') ?? '';
const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
const { data: { user } } = await userClient.auth.getUser();
if (user) {
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  await supabaseAdmin.from('profiles').upsert({ id: user.id, /* … */ });
}
```

### Pattern 2: Client-Schreibzugriff auf ein Vertrauensfeld sperren
**Was:** DB-Trigger, der `INSERT`/`UPDATE` abfängt und ein Feld nur für `service_role` freigibt.
**Wann nutzen:** Für die neue `is_tester`-Spiegelspalte (D-19) und für `discord_role_state` generell — genau dieselbe Bedrohung wie bei `rsi_verified`.
**Beispiel:**
```sql
-- Source: supabase/migrations/20260722200000_guard_rsi_verified.sql (VERIFIED, vollständig übertragbar)
if caller_role = 'service_role' then return new; end if;
if tg_op = 'INSERT' then new.is_tester := false; return new; end if;
if new.is_tester is distinct from old.is_tester and new.is_tester = true then
  raise exception 'is_tester kann nur serverseitig gesetzt werden' using errcode = 'insufficient_privilege';
end if;
```

### Pattern 3: Öffentliche Ansicht über eine schmale View statt RLS auf der Basistabelle
**Was:** `public_profiles`-View mit `security_barrier`, nur ausgewählte Spalten, `GRANT SELECT` an `anon, authenticated`.
**Wann nutzen:** Für das Abzeichen auf `/pilot/<handle>` — die Spalte muss in dieselbe View, nicht in eine neue.
**Beispiel:**
```sql
-- Source: supabase/migrations/20260723000000_public_profile_views.sql:22-40 (VERIFIED)
create or replace view public.public_profiles with (security_barrier = true) as
select handle, display_name, /* … */, rsi_verified, is_tester, /* NEU */ created_at
from public.profiles where handle is not null;
```

### Anti-Patterns to Avoid
- **Cookie-Mint per browserseitigem `fetch()` an die Supabase-Edge-Function-Domain:** Der `Set-Cookie`-Header einer Cross-Origin-Antwort setzt den Cookie für DIE ANTWORTENDE Domain, nicht für `staging.verse-base.com`. Der Mint-Endpunkt muss same-origin sein (njs innerhalb desselben nginx).
- **Rohes JWT-Parsing/-Verifizieren in njs:** Fragil gegenüber einer möglichen Umstellung auf asymmetrische Supabase-JWTs (ES256/RS256 + JWKS-Rotation). Stattdessen den Token einmalig server-zu-server gegen `/auth/v1/user` prüfen.
- **`auth_request` gegen den Bot auf JEDEM Seitenaufruf:** Macht den Bot zum Single Point of Failure für die gesamte Vorschau — widerspricht D-09 wörtlich.
- **Rollenstand aus einer HTTP-Anfrage je Seitenaufruf an Discord:** Explizit von D-08 ausgeschlossen; bei ~17.000 Unterseiten weder bezahlbar noch schnell.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Discord-OAuth-Handshake, Token-Refresh | Eigener OAuth-Client/State-Handling | Supabase Auth Discord-Provider (`signInWithOAuth`) | Ab Werk vorhanden, bereits im Stack (`supabase-js` v2), PKCE/Implicit-Handling ist bereits gelöst |
| Kontoerstellungssperre für unbekannte Discord-Nutzer | Client-seitige Prüfung „hat Konto?" vor dem OAuth-Aufruf | Supabase „Before User Created" Auth Hook (Postgres-Funktion) | Läuft VOR dem Insert in `auth.users`, serverseitig, nicht umgehbar; genau das von D-02 verlangte serverseitige Sitzverhalten [CITED: supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook] |
| Prüfung „ist der Signatur-Cookie gültig?" | Eigenes Krypto-Protokoll | HMAC-SHA256 über `njs`s eingebautes `crypto`-Modul | Standard-Primitive, keine neue Abhängigkeit, im njs-Kern seit 0.7.0 |
| Mitgliederliste/Rollenstand des Discord-Servers | Periodisches Web-Scraping oder Bot-Polling per REST | Gateway-Intent `GuildMembers` + Event `guildMemberUpdate` | Genau dafür gebaut, Latenz im Millisekundenbereich, kein Rate-Limit-Problem bei Polling |

**Key insight:** Für jede der vier Teilprobleme dieser Phase existiert bereits ein exaktes, im Repo verifiziertes Vorbild (`verify-rsi`, `guard_rsi_verified`, `public_profiles`, `account-lite.js`s Refresh-Lock). Die Aufgabe ist Übertragung, kein Neuentwurf.

## Common Pitfalls

### Pitfall 1: Cross-Origin-Cookie-Falle beim Mint
**Was schiefgeht:** Eine Supabase-Edge-Function mintet den Cookie und schickt `Set-Cookie` — der Browser setzt ihn für `trgjhmbnodoarnfmlcqx.supabase.co`, njs sieht ihn nie.
**Warum es passiert:** `fetch()` von der Site zu einer anderen Origin kann keine Cookies für die AUFRUFENDE Origin setzen — Browser-Grundregel, kein Supabase-spezifisches Problem.
**Wie vermeiden:** Mint-Endpunkt MUSS same-origin liegen (njs-Handler innerhalb des `staging.verse-base.com`-nginx). Die Edge Function/Supabase-Aufrufe passieren SERVER-zu-SERVER aus njs heraus, nicht aus dem Browser.
**Warnzeichen:** Ein Plan, der `supabase.functions.invoke('mint-gate-cookie')` direkt aus dem Browser vorschlägt.

### Pitfall 2: `browser-smoke.mjs` bricht unter dem Tor
**Was schiefgeht:** `scripts/browser-smoke.mjs` lädt in `deploy-staging.yml` (Schiene C) 15 Leitseiten gegen den GERADE GEBAUTEN, LAUFENDEN Container — nach D-06 sperrt das Tor genau diese Seiten für jeden ohne gültigen Cookie, also auch für den Rauchtest.
**Warum es passiert:** Der Rauchtest lief bisher gegen eine offene Seite; das Gate ist eine neue, harte Voraussetzung, die beim Entwurf des Rauchtests noch nicht existierte.
**Wie vermeiden:** Bypass-Mechanismus für CI nötig — z. B. ein statisches Secret (`X-Gate-Bypass: <token>` als GH-Actions-Secret, im njs-Skript gegen eine Umgebungsvariable geprüft) ODER der Rauchtest führt den echten Mint-Flow einmal durch (bräuchte einen Test-Discord-Account, unrealistisch für CI). Dies ist eine EIGENE Aufgabe im Plan, nicht Kollateralschaden.
**Warnzeichen:** `verify:wiring`/Schiene-C-Lauf in CI wird nach dem Merge dieser Phase rot, ohne dass jemand den Rauchtest angefasst hat.

### Pitfall 3: `GuildMembers`-Intent ist heute bewusst AUS
**Was schiefgeht:** Ein Plan geht stillschweigend davon aus, der Bot könne schon `guildMemberUpdate` empfangen.
**Warum es passiert:** `discord/README.md:79` sagt ausdrücklich „No privileged intents are required — leave them off", und `discord/bot/src/index.mjs:37` registriert nur `Guilds, GuildMessages, GuildVoiceStates`. `discord/prune.mjs:149-165` und `discord/audit.mjs:267-269` behandeln das Fehlen von `GuildMembers` als GEWOLLTEN Zustand, nicht als Lücke.
**Wie vermeiden:** Zwei explizite Schritte im Plan: (1) im Discord Developer Portal unter „Privileged Gateway Intents" `Server Members Intent` einschalten — Handarbeit, unter 100 Server ohne Verifizierung möglich [CITED: support-dev.discord.com/hc/en-us/articles/6207308062871]; (2) `GatewayIntentBits.GuildMembers` im Client-Konstruktor ergänzen. Ohne (1) bleibt (2) wirkungslos und der Bot startet mit einem stillen Fehler oder verweigerten Events.
**Warnzeichen:** `guildMemberUpdate`-Handler wird geschrieben, aber nie feuert — kein Fehler, nur Stille.

### Pitfall 4: Cloudflare Worker sieht aus wie eine kleine Lösung, ist aber ein neues Deploy-Ziel
**Was schiefgeht:** Ein Worker wird als „nur ein bisschen JS an der Edge" verkauft und am `PROJECT.md`-Constraint vorbeigeplant.
**Warum es passiert:** Die Constraint-Formulierung nennt wörtlich „Pages Function"; ein Worker ist technisch ein anderes Cloudflare-Produkt.
**Wie vermeiden:** Die Recherche stellt klar: Pages Functions SIND intern Workers [CITED: developers.cloudflare.com/pages/functions/, morphllm.com Cloudflare-Vergleich] — der Unterschied ist Deploy-Mechanik (`wrangler` + eigenes Konto/Token vs. Coolify/GHCR), nicht die Art von Code, die läuft. Ein Worker fügt ein VIERTES Ausliefungsziel (heute: GHCR-Image, Supabase Edge Functions, Bot-Image) mit eigenem CI-Schritt, eigenem Secret (`CLOUDFLARE_API_TOKEN`) und eigener Beobachtungsfläche hinzu. Das ist kein Verbot, aber der Preis muss dem Betreiber genannt werden, bevor jemand ihn zahlt.
**Warnzeichen:** Ein Plan, der Kandidat (a) wählt, ohne diesen Preis explizit zu benennen und ohne dass der Betreiber das Constraint ausdrücklich neu entschieden hat (Präzedenzfall: die Aufhebung der Discord-Out-of-Scope-Zeile in D-nichts / `14-CONTEXT.md` deckt NUR Discord/Konto-Ausbau ab, nicht die Serverlogik-Regel).

### Pitfall 5: `verify:sync` und die Torseite
**Was schiefgeht:** Die Torseite wird als normale, gepaarte Astro-Seite angelegt (mit `/de/`-Gegenstück) — widerspricht D-11 (nur Englisch) und würde `verify:sync`s 8.678-Paar-Vergleich für ein Paar verfälschen, das es laut Entscheidung nicht geben soll.
**Warum es passiert:** Jede andere Seite im Projekt ist gepaart; die Torseite ist die erste bewusste Ausnahme.
**Wie vermeiden:** Die Torseite als UNGEPAARTE Astro-Seite anlegen (kein `src/pages/de/gate.astro`) — genau das Muster, das `verify:sync` für die vier Onepager-Dateien bereits kennt und behandelt (`scripts/verify-sync.mjs` Zusicherung 1, „unpaired files"). Das ist eine bereits vorhandene Fallgruppe, keine neue Ausnahmeklasse nötig.
**Warnzeichen:** `npm run verify:sync` meldet nach dem Anlegen der Torseite einen neuen unerklärten Rest.

### Pitfall 6: Ausnahmeliste vergisst die Torseiten-eigenen Assets
**Was schiefgeht:** Die Torseite selbst ist erreichbar, aber ihr `<link>`-CSS oder externes JS ist es nicht — der Besucher sieht eine unstylte Seite oder der OAuth-Button funktioniert nicht.
**Warum es passiert:** D-06 sperrt „alles" — eine Ausnahmeliste, die nur die HTML-Datei nennt, aber nicht deren `/_astro/`-Bundle-Chunks, ist unvollständig.
**Wie vermeiden:** Wenn die Torseite Astro-CSS/JS über `/_astro/*.css`/`*.js` einbindet, muss die Ausnahmeliste entweder diese spezifischen Content-Hash-Dateinamen kennen (fragil bei jedem Build) ODER die Torseite bewusst mit `<style is:inline>`/`<script is:inline>` bauen, damit ALLES im HTML-Dokument selbst steckt und keine zweite Datei erreichbar sein muss. Letzteres ist robuster und sollte im Plan als Vorgabe stehen.
**Warnzeichen:** Sichtprüfung der Torseite zeigt fehlendes Styling nur bei nicht angemeldeten Besuchern.

## Code Examples

### HMAC-Cookie in njs (Muster, kein Copy-Paste — Feindetails gehören in den Plan)
```javascript
// Source: eigene Herleitung aus nginx.org/en/docs/njs/ + docs.nginx.com — NICHT aus dem
// Projekt übernommen, da hier keine Vorlage existiert. [CITED: nginx.org/en/docs/njs/]
import crypto from 'crypto';

function sign(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${hmac}`;
}

function verify(cookieValue, secret) {
  const [payload, hmac] = cookieValue.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (hmac !== expected) return null;
  const { exp, sub } = JSON.parse(Buffer.from(payload, 'base64url'));
  if (Date.now() / 1000 > exp) return null;
  return sub;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Symmetrische Supabase-JWTs (HS256, geteiltes Secret) | Asymmetrische Signatur (ES256/RS256 + JWKS) als Default für neue Projekte | Rollout ab Mai/Oktober 2025 [CITED: supabase.com/blog/jwt-signing-keys] | Direktes JWT-Parsing im Türsteher wird fragiler; server-zu-server-Verifikation über `/auth/v1/user` bleibt unabhängig vom Signaturverfahren stabil — Grund für die Architekturempfehlung |
| Selbst vergebbare „Test pilot"-Rolle im Onboarding | Betreiber-vergebene Auszeichnung | Diese Phase (D-15/D-16) | Bestandsträger müssen vor Scharfschaltung des Tors entzogen werden — sonst ist das Tor am ersten Tag wirkungslos |

**Deprecated/outdated:**
- `discord.js` v13 `Intents`-Klasse: dieses Projekt nutzt bereits die aktuelle `GatewayIntentBits`-API (v14) — kein Handlungsbedarf.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase-Projekt erlaubt „Before User Created" Auth Hooks auf dem aktuell gebuchten Plan (Free/Pro unklar) | Don't Hand-Roll, Pattern für D-02 | Falls nur auf höherem Tarif verfügbar, muss D-02 stattdessen über einen `auth.users`-Trigger laufen (technisch möglich, aber der Hook ist der von Supabase empfohlene Weg) — Kosten- statt Blockade-Risiko |
| A2 | Supabase-Projekt nutzt bereits (oder migriert demnächst zu) asymmetrischer JWT-Signatur (RS256/ES256) statt HS256 | Alternatives Considered, State of the Art | Falls das Projekt weiterhin HS256 mit dem alten geteilten Secret nutzt, wäre direkte HMAC-Prüfung des Supabase-Tokens in njs OHNE Server-zu-Server-Aufruf möglich und schneller — die Empfehlung (Server-zu-Server-Aufruf) bliebe trotzdem korrekt, nur nicht die schnellstmögliche Variante |
| A3 | Discord-OAuth-Redirect landet mit dem Access-Token im URL-**Fragment** (wegen `flowType:'implicit'`, `src/lib/supabase.ts:11`), nicht als `?code=`-Query-Parameter | Architecture Diagram | Falls Supabase für Discord-Provider dennoch PKCE/`code`-Flow erzwingt, ändert sich der Ablaufschritt 2 (Server sieht den Code, kein reines Client-Fragment-Handling) — die Same-Origin-Mint-Notwendigkeit bleibt gleich |
| A4 | Coolify betreibt Site-Container und Bot-Container im selben Docker-Netzwerk und sie können sich per Service-Name erreichen | Alternatives Considered (Kandidat b) | Falls nicht (getrennte „Destinations"), wäre Kandidat (b) sogar noch aufwendiger als angenommen — verstärkt die Empfehlung gegen (b), ändert sie nicht |
| A5 | `nginx-module-njs` ist für den im Projekt tatsächlich genutzten `nginx:alpine`-Tag im offiziellen Alpine-Repo verfügbar (nicht nur für `nginx:stable`/Debian-Varianten) | Standard Stack, Versionsprüfung | Falls nicht verfügbar für den genauen Tag, muss entweder der Tag gewechselt oder ein Custom-Build mit kompiliertem njs gefahren werden — signifikanter Mehraufwand, macht Kandidat (c) teurer als hier angenommen |
| A6 | `ngx_http_secure_link_module` ist NICHT standardmäßig im offiziellen `nginx:alpine`-Image kompiliert | Alternatives Considered | Falls doch enthalten, wäre die MD5-basierte Alternative ohne jeden njs-Umbau sofort verfügbar — deutlich einfachere, aber kryptografisch schwächere Lösung; müsste dem Betreiber als echte Option vorgelegt werden |

**Falls diese Tabelle leer wäre:** Ist sie nicht — sechs Annahmen verlangen Bestätigung gegen die lebende Anlage, bevor der Plan sie als gesichert behandelt.

## Open Questions (RESOLVED — jede Frage hat ihre Plan-Aufgabe)

> Nachgetragen am 17.08.2026 nach der Planprüfung. Keine dieser Fragen ist im
> Bestand beantwortet worden; alle fünf sind stattdessen einer Plan-Aufgabe
> zugewiesen, die sie **misst** statt sie anzunehmen. Die Zuordnung:
>
> | Frage | Geklärt durch | Art der Klärung |
> |---|---|---|
> | 1 (Auth-Hook-Verfügbarkeit) | Plan 03 | bewusste Architekturentscheidung **gegen** den Auth-Hook — der Riegel sitzt woanders, die Tarif-Frage entfällt damit |
> | 2 (JWT-Signaturverfahren) | Plan 01 / Plan 08 | bewusst umgangen: njs parst **nie** ein JWT, sondern ruft `rpc/gate_verdict` server-zu-server; das Verfahren ist damit gleichgültig |
> | 3 (`nginx-module-njs` verfügbar?) | Plan 01, Aufgabe 1 | Machbarkeitsmessung als **allererste** Aufgabe der Phase, mit `checkpoint:decision` bei Fehlschlag |
> | 4 (`secure_link` im Image?) | Plan 01, Aufgabe 1 | im selben Messlauf mit erhoben — er ist der benannte Rückfall aus D-23 |
> | 5 (Zahl der Bestandsträger) | Plan 06, Aufgabe 1 | Trockenlauf per REST-Abruf, funktioniert ohne das privilegierte Intent und ist deshalb von Frage 3 entkoppelt |
>
> ⚠ „Zugewiesen" heißt **nicht** „beantwortet". Fragen 3 und 4 können die Phase
> in Plan 01 zum Halten bringen — dafür ist der Checkpoint da.

1. **Ist „Before User Created" auf dem gebuchten Supabase-Tarif verfügbar, und ist eine Postgres-Funktion oder ein HTTP-Endpunkt der bessere Weg für D-02?**
   - Was wir wissen: Der Mechanismus existiert, läuft vor dem Insert, kann per Postgres-Funktion (bleibt im Projekt, kein externer Aufruf) implementiert werden [CITED: supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook].
   - Was unklar ist: Tarif-Gate, und ob eine `raw_user_meta_data`/`app_metadata`-Prüfung im Hook zuverlässig zwischen Discord- und E-Mail-Signups unterscheidet, wenn ein Nutzer BEREITS ein E-Mail-Konto hat und `linkIdentity` statt `signInWithOAuth` aufruft (unterschiedlicher Codepfad — der Hook darf `linkIdentity` NICHT blockieren).
   - Empfehlung: Vor der Planung einmal gegen das Supabase-Dashboard des Projekts prüfen (Auth → Hooks sichtbar? Auth → Providers → Discord vorhanden?).

2. **Welches Signaturverfahren nutzt dieses konkrete Supabase-Projekt für Access-Tokens — HS256 oder ES256/RS256?**
   - Was wir wissen: Der neue `sb_publishable_…`-Schlüsseltyp deutet auf ein neueres Projekt-Setup hin.
   - Was unklar ist: Das Signaturverfahren ist davon nicht zwingend abhängig (API-Key-Format und JWT-Signaturverfahren sind laut Supabase-Doku getrennte Migrationen).
   - Wie zu klären: Supabase-Dashboard → Project Settings → API → „JWT Settings" ansehen, ODER `curl https://trgjhmbnodoarnfmlcqx.supabase.co/auth/v1/.well-known/jwks.json` — ein leeres/404-Ergebnis deutet auf HS256, ein gefülltes auf JWKS/asymmetrisch.

3. **Ist `nginx-module-njs` für den im Projekt gepinnten `nginx:alpine`-Tag tatsächlich per `apk` installierbar, und wie groß ist der Image-Zuwachs?**
   - Was wir wissen: Das Paket existiert für aktuelle nginx-Alpine-Versionen im nginx.org-eigenen Repo [CITED: mailman.nginx.org 2021-June/060741, github.com/nginx/docker-nginx#317].
   - Was unklar ist: Ob genau der im Dockerfile verwendete Tag (`FROM nginx:alpine`, ungepinnte Version) im Moment der Planung ein passendes njs-Paket im Standard-Alpine-`apk`-Index hat, oder ob das `nginx`-eigene Zusatz-Repo (`@nginx`-Tag) in `/etc/apk/repositories` eingetragen werden muss.
   - Wie zu klären: Einmaliger Testbuild vor der eigentlichen Planung/Umsetzung (`docker build` mit `RUN apk add --no-cache nginx-module-njs` als isolierter Schritt).

4. **Ist `ngx_http_secure_link_module` im offiziellen `nginx:alpine`-Image bereits kompiliert (als leichtgewichtige Alternative zu njs)?**
   - Was wir wissen: Es ist ein offizieller, first-party nginx-Kernmodul, aber NICHT in jeder Standard-Distribution automatisch aktiv — es benötigt typischerweise `--with-http_secure_link_module` beim Kompilieren.
   - Was unklar ist: Die Recherche fand keine eindeutige Bestätigung für das AKTUELLE offizielle Alpine-Image (nur allgemeine Hinweise, dass Drittanbieter-Images es zusätzlich bündeln).
   - Wie zu klären: `docker run --rm nginx:alpine nginx -V 2>&1 | grep secure_link`.

5. **Wie viele Discord-Mitglieder tragen die Rolle `tester` heute, und wie zuverlässig lässt sich das ohne das (noch nicht aktivierte) `GuildMembers`-Intent feststellen?**
   - Was wir wissen: D-16 fordert genau diesen Trockenlauf; die Zahl steht laut CONTEXT.md „auf dem lebenden Server und ist im Repo nicht ablesbar".
   - Was unklar ist: Ohne `GuildMembers`-Intent kann selbst ein einmaliger Trockenlauf die Rollenmitgliederliste nicht über die Gateway-Cache lesen — er bräuchte entweder das Intent vorab (Henne-Ei mit Frage 3 oben) oder die REST-Route `GET /guilds/{guild.id}/members?limit=1000` mit Filterung nach Rolle (funktioniert AUCH ohne privilegiertes Intent, weil es ein einmaliger REST-Aufruf ist, kein Gateway-Event-Abo — das ist in discord.js über `guild.members.list()`/`fetchMembers()` mit dem Bot-Token möglich).
   - Empfehlung: Der Trockenlauf (D-16) kann bereits VOR der Intent-Aktivierung als einmaliger REST-Abruf gebaut werden — entkoppelt ihn von der größeren Architekturarbeit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `nginx-module-njs` (apk) | Türsteher-Logik (Kandidat c) | Nicht geprüft (siehe Open Question 3) | — | `ngx_http_secure_link_module` (Open Question 4) oder Kandidat b als Mint-Autorität |
| Discord Developer Portal Zugriff | Aktivierung `GuildMembers`-Intent | Muss der Betreiber von Hand tun (`discord/README.md`-Konvention: „Claude can't log in for you") | — | keiner — ohne das Intent funktioniert D-08s Push-Mechanismus nicht |
| Supabase Dashboard Zugriff (Auth Hooks, JWT Settings) | Open Questions 1+2 | Nicht in dieser Recherche-Sitzung geprüft — kein MCP/Werkzeugzugriff auf das Supabase-Projekt in diesem Kontext | — | keiner — der Plan muss diese Prüfung als ersten Schritt vorsehen |
| Coolify Docker-Netzwerk-Konfiguration | Alternativbewertung Kandidat (b) | Nicht geprüft (Open Question / Assumption A4) | — | — |

**Missing dependencies with no fallback:**
- Discord Developer Portal Intent-Aktivierung — ohne sie ist der Push-Mechanismus (Discretion #2) nicht baubar; der Plan muss dies als Voraussetzung/ersten Task führen.

**Missing dependencies with fallback:**
- `nginx-module-njs`-Verfügbarkeit — Fallback `secure_link`-Modul oder Kandidat (b) als reine Mint-Autorität.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | ja | Supabase Auth (Discord-OAuth-Provider) — kein selbstgebautes Passwort-/Token-Handling |
| V3 Session Management | ja | Kurzlebiger, HttpOnly, Secure, SameSite=Lax signierter Cookie mit stiller Erneuerung; Supabase-eigene Session für das Konto bleibt unverändert (`persistSession`, `autoRefreshToken` in `src/lib/supabase.ts`) |
| V4 Access Control | ja | HMAC-Signaturprüfung am Rand (njs) + serverseitige Rollen-/Blocklist-Prüfung beim Mint; Admin-Kurzschluss über `user_roles` (D-04) |
| V5 Input Validation | ja | Cookie-Payload strikt strukturiert (JSON mit festen Feldern), kein Freitext; OAuth-Redirect-Parameter werden ausschließlich von Supabase-eigenem Client-Code gelesen, nicht selbst geparst |
| V6 Cryptography | ja | HMAC-SHA256 über njs' eingebautes `crypto`-Modul bzw. Web Crypto API in der Edge Function — **nie handgerollte Kryptografie**, Secret-Länge/Rotation gehört in den Plan |

### Known Threat Patterns for diese Architektur

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cookie-Diebstahl/-Weitergabe (Screenshot-Leak, genau der in D-10 benannte Fall) | Spoofing | Kurze TTL (5–10 Min) + Sperrliste, die beim nächsten Mint-Vorgang greift — der gestohlene Cookie verliert seine Wirkung spätestens beim nächsten Renewal-Zyklus des LEGITIMEN Nutzers, nicht sofort beim Angreifer, aber begrenzt die Fensterdauer |
| HMAC-Secret-Leak (z. B. versehentlich in `nginx/default.conf` committed) | Tampering | Secret ausschließlich als Coolify-Umgebungsvariable/Docker-Secret, NIE im Repo — Präzedenzfall `COOLIFY_API_TOKEN`-Handling in `deploy-staging.yml` |
| Cross-Origin-Cookie-Verwechslung (siehe Pitfall 1) | Spoofing/Information Disclosure | Same-Origin-Mint-Endpunkt, keine Ausnahme |
| Open Redirect über die Torseiten-„Rücksprung"-URL | Tampering | Rücksprungziel gegen eine feste Allowlist/Pfadmuster validieren (nur relative Pfade innerhalb `staging.verse-base.com`), nicht ungeprüft aus dem Query-String übernehmen |
| `GuildMembers`-Intent-Missbrauch (Bot bekommt plötzlich Zugriff auf volle Mitgliederliste inkl. Präsenzdaten) | Information Disclosure | Intent ist zweckgebunden auf `guildMemberUpdate`/Reconcile zu beschränken; keine neue Funktion, die die volle Liste öffentlich exponiert |

## Sources

### Primary (HIGH confidence — im Repo verifiziert)
- `CLAUDE.md`, `docs/maschinelle-validierung.md` — Liefergrundsätze, sieben Grundsätze für neue Tore
- `.planning/PROJECT.md` — Constraints („kein Server-Code außer Supabase Edge Function")
- `nginx/default.conf`, `Dockerfile`, `.github/workflows/deploy-staging.yml` — Ausliefungskette, Artefakte, Rauchtest
- `scripts/lib/gate-registry.mjs`, `scripts/check-deployed.mjs`, `scripts/browser-smoke.mjs` — Torkette, Deploy-Prüfung
- `supabase/functions/verify-rsi/index.ts`, `supabase/config.toml`, `scripts/supabase-schema.sql`, `supabase/migrations/20260722200000_guard_rsi_verified.sql`, `supabase/migrations/20260723000000_public_profile_views.sql` — bestehende Auth-/Trust-Muster
- `src/lib/supabase.ts`, `assets/account-lite.js`, `src/consts.ts` — Client-Auth-Architektur
- `discord/blueprint.mjs`, `discord/README.md`, `discord/bot/src/index.mjs`, `discord/bot/src/roles.mjs`, `discord/bot/src/db.mjs`, `discord/bot/src/patch-watch.mjs`, `discord/bot/src/award.mjs`, `discord/prune.mjs`, `discord/audit.mjs`, `discord/verify-invite.mjs`, `discord/bot/src/env.mjs`, `discord/bot/package.json` — Discord-Bot-Architektur, Intents, Rollen-/XP-Mechanik
- `scripts/verify-sync.mjs`, `scripts/lib/sync-exclusions.mjs` — Ausnahme-Mechanik für DE/EN-Paare
- `src/components/pilot/PilotPage.astro` — Abzeichen-Rendering-Muster
- `package.json` (Wurzel + `discord/bot/package.json`) — Versionsstände `@supabase/supabase-js`, `discord.js`

### Secondary (MEDIUM confidence — WebSearch mit offizieller Quelle bestätigt)
- [Functions · Cloudflare Pages docs](https://developers.cloudflare.com/pages/functions/) — Pages Functions sind intern Workers
- [nginx JavaScript module](https://nginx.org/en/docs/njs/) — njs-Fähigkeiten, `crypto`-Modul
- [Add njs module in the alpine image · Issue #317](https://github.com/nginx/docker-nginx/issues/317) — njs-Verfügbarkeit für Alpine
- [Gateway Intents | discord.js](https://discordjs.guide/legacy/popular-topics/intents) — `GuildMembers` als privilegiertes Intent
- [What are Privileged Intents? – Discord Developer Support](https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents) — Aktivierungsweg unter 100 Server
- [Before User Created Hook | Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) — Mechanik, Postgres-Funktions-Implementierung
- [Login with Discord | Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-discord) — Default-Scopes `identify`+`email`
- [Introducing JWT Signing Keys — Supabase Blog](https://supabase.com/blog/jwt-signing-keys) — Migration HS256 → ES256/RS256
- [Module ngx_http_auth_request_module](https://nginx.org/en/docs/http/ngx_http_auth_request_module.html) — Kompilier-Flag-Abhängigkeit

### Tertiary (LOW confidence — WebSearch ohne Erstquelle, zur Validierung markiert)
- Coolify-Docker-Netzwerk-Verhalten (GitHub-Discussions, keine offizielle Doku-Seite direkt geprüft) — siehe Assumption A4
- `ngx_http_secure_link_module`-Verfügbarkeit im offiziellen `nginx:alpine`-Image — keine eindeutige Quelle gefunden, siehe Open Question 4
- Discord-Rate-Limit-Details für `GET /guilds/{guild.id}/members/{user.id}` — allgemeine Rate-Limit-Doku gefunden, kein exakter Bucket-Wert; für diese Architektur ohnehin irrelevant, da der Aufruf nur beim Trockenlauf/Reconcile läuft, nicht pro Seitenaufruf

## Metadata

**Confidence breakdown:**
- Standard-Stack (njs, bestehende Dependencies): HOCH — direkt gegen Repo und offizielle Doku verifiziert
- Architekturempfehlung (Cross-Origin-Cookie-Erkenntnis, Push-Mechanismus): HOCH in der Logik, MITTEL in der Umsetzungsdetails-Sicherheit (JWT-Signaturverfahren, njs-Paketverfügbarkeit im konkreten Image noch offen)
- Pitfalls (`browser-smoke.mjs`, `GuildMembers`-Intent, `verify:sync`): HOCH — alle direkt im Repo belegt
- Perk-Umsetzung (D-19 Abzeichen, D-21 XP): HOCH — exakte Vorbilder im Repo gefunden
- Deploy-Ping (D-20), Coolify-Netzwerk (Kandidat b): MITTEL — Quellenlage unvollständig, als offene Fragen markiert

**Research date:** 2026-08-17
**Valid until:** ~14 Tage — die Supabase-JWT-Migration (State of the Art) ist ein sich aktuell veränderndes Feld; vor Planungsbeginn sollten Open Questions 1–4 gegen die lebende Anlage nachgeprüft werden, unabhängig vom Alter dieses Dokuments
