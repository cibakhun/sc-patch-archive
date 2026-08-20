# Phase 14: Testpilot-Zugang: staging hinter der Discord-Rolle — Pattern Map

**Kartiert:** 2026-08-17
**Analysierte Dateien:** 20 (geschätzt aus CONTEXT.md/RESEARCH.md, Zuschnitt in Pläne bleibt Aufgabe des Planers)
**Vorbilder gefunden:** 15 / 20 (fünf Dateien haben **kein** Vorbild im Bestand — siehe „Kein Vorbild gefunden")

Diese Phase berührt vier getrennte Bereiche. Die Tabelle unten ordnet jede
erwartete Datei einem Vorbild zu; wo keins existiert, steht das ausdrücklich
so da, statt ein schwaches Vorbild zu erzwingen.

## File Classification

| Neue/geänderte Datei | Rolle | Datenfluss | Nächstes Vorbild | Trefferqualität |
|---|---|---|---|---|
| `nginx/gate.js` (njs-Modul, Cookie mint+verify) | middleware | request-response | **kein Vorbild im Bestand** | keins — erstes Server-JS im nginx-Image überhaupt |
| `nginx/default.conf` (Änderung: `location`-Block(e) für `/_gate/mint`, Ausnahmeliste, `js_import`) | config | request-response | `nginx/default.conf` selbst (Bestand) | struktur-match (gleiche Datei, neue Blöcke) |
| `Dockerfile` (Änderung: `apk add nginx-module-njs`, `load_module`) | config | build-time | `Dockerfile:65-69` (STAGING-`sed`+Gegenkontrolle) | struktur-match — einzige „nur auf Vorschau aktiv"-Bauform im Repo |
| `supabase/migrations/2026….discord_tester_gate.sql` (Tabellen `discord_role_state`, `tester_blocklist`, Trigger) | migration | CRUD | `supabase/migrations/20260812040000_mining_sig_presets.sql` (neueste Tabelle+RLS) + `20260722200000_guard_rsi_verified.sql` (Trigger) | exact (Tabellenbau) / exact (Trigger) |
| `supabase/migrations/…_profiles_is_tester.sql` (Spiegelspalte `is_tester` an `profiles`, Trigger analog `guard_rsi_verified`) | migration | CRUD | `20260722200000_guard_rsi_verified.sql` | exact |
| `supabase/migrations/…_public_profiles_add_tester.sql` (View-Erweiterung) | migration | CRUD | `20260723000000_public_profile_views.sql` | exact |
| `supabase/functions/link-discord-role/index.ts` (od. äquivalente Logik in njs — Zuschnitt offen) | service | request-response | `supabase/functions/verify-rsi/index.ts` | exact |
| `supabase/config.toml` (Änderung: neuer Function-Eintrag `verify_jwt`) | config | — | `supabase/config.toml` selbst (Bestand) | struktur-match |
| `discord/blueprint.mjs` (Änderung: Onboarding-Eintrag D-15 entfernen, `#testpilot-lounge`-Kanal in `cat-build` ergänzen D-18, `renames{}` falls nötig) | config | event-driven | `discord/blueprint.mjs` (Bestand, Zeilen 143/195-235/402) | exact (gleiche Datei) |
| `discord/tester-dry-run.mjs` (NEU, D-16 Trockenlauf) | utility | batch | `discord/prune.mjs` (Rollen-/Mitgliederbericht) + `discord/announce-update.mjs` (`--dry-run`-Flag) | role-match |
| `discord/tester-revoke.mjs` (NEU, D-16 Entzug bei allen) | utility | batch | `discord/prune.mjs` | role-match |
| `discord/bot/src/index.mjs` (Änderung: `GatewayIntentBits.GuildMembers` ergänzen, Event-Handler verdrahten) | provider | event-driven | `discord/bot/src/index.mjs` (Bestand) | exact (gleiche Datei) |
| `discord/bot/src/role-sync.mjs` (NEU, `guildMemberUpdate`-Handler → Supabase PATCH) | service | event-driven | `discord/bot/src/patch-watch.mjs` (Poll-Event → externe Senke) + `discord/prune.mjs` (Rollenlogik) | role-match |
| `discord/bot/src/role-reconcile.mjs` (NEU, Startup-Vollabgleich) | service | batch | `discord/prune.mjs` (voller Mitgliederabgleich per REST) | role-match |
| `discord/bot/src/bug-thread-xp.mjs` (NEU, D-21 XP je Forum-Thread) | service | event-driven | `discord/bot/src/award.mjs` (`grantXp()`) + `discord/bot/src/leveling.mjs` | role-match |
| `.github/workflows/deploy-staging.yml` (Änderung: Bypass für `browser-smoke.mjs`) | config | request-response | `.github/workflows/deploy-staging.yml` (Bestand) | struktur-match |
| `scripts/browser-smoke.mjs` (Änderung: Gate-Bypass-Header) | test | request-response | `scripts/browser-smoke.mjs` (Bestand) | struktur-match |
| `scripts/verify-gate.mjs` (NEU, Schiene-A-Prüfer für die Ausnahmeliste) | test | batch | `scripts/verify-help.mjs` (Zusicherungs-Struktur, Soll/Ist-Druck) + `scripts/verify-sync.mjs` (benannte Ausnahmen + Zombie-Wächter) | role-match |
| `scripts/lib/gate-registry.mjs` (Änderung: neuer Eintrag für `verify:gate`) | config | — | `scripts/lib/gate-registry.mjs` (Bestand) | exact |
| `src/pages/gate.astro` (Torseite, EN-only, ohne SiteNav) | component | request-response | **kein enges Vorbild** — nächstliegend: `src/components/account/AuthLogin.astro` (Anmeldeformular-Bauform) | teilweise |
| `src/components/account/AuthLogin.astro` (Änderung: „Mit Discord anmelden"-Knopf, `signInWithOAuth`) | component | request-response | `src/components/account/AuthLogin.astro` (Bestand) | exact |
| `src/components/pilot/PilotPage.astro` (Änderung: Testpilot-Abzeichen D-19) | component | CRUD (Lesen) | `src/components/pilot/PilotPage.astro` (Bestand, RSI-Badge-Muster) | exact |
| `src/components/account/*.astro` (Änderung: Namensnennung-Schalter D-22, Testpiloten-Übersicht D-13) | component | CRUD | `assets/account-lite.js` (Rollen-Gatter) + eine bestehende kontogebundene Übersichtsseite (z. B. Refinery-Tracker) | role-match |

## Pattern Assignments

### 1. nginx/njs — der Türsteher selbst

**`nginx/gate.js`** hat **kein Vorbild im Bestand.** Das Projekt hatte bis
heute keine Serverlogik in nginx — jede bisherige Antwort ist eine statische
Datei oder ein `return`/`rewrite`. Das ist in RESEARCH.md ausdrücklich so
vermerkt („eigene Herleitung … NICHT aus dem Projekt übernommen, da hier
keine Vorlage existiert"). Der Plan muss das Skript aus den
nginx.org/njs-Dokumenten und dem RESEARCH-Codebeispiel neu bauen, nicht aus
dem Repo kopieren.

**Was aus `nginx/default.conf` respektiert werden MUSS** (Bestand, komplette
Datei gelesen):

**Die Kopfzeilen-Falle** (Kommentarblock ab Zeile 1, wiederholt bei
`/build.json`):
```nginx
# ⚠ NUR `expires -1` … und bewusst KEIN `add_header Cache-Control …`:
# ein add_header in einer location verwirft die Security-Header des
# server-Blocks — HSTS, CSP, X-Frame-Options waeren fuer diese Datei weg.
location = /build.json {
    expires -1;
}
```
Jeder neue `location`-Block für `/_gate/mint` oder das Torseiten-Escape
darf **keinen** `add_header` verwenden, wenn er im `server{}`-Block sitzt
und die geerbten Kopfzeilen (HSTS, CSP, X-Frame-Options, `add_header
Content-Security-Policy` Zeile ~106) behalten soll. Wo eigene Kopfzeilen
zwingend nötig sind (z. B. `Set-Cookie` beim Mint), müssen HSTS/CSP/X-Frame
dort **erneut** gesetzt werden — die Datei warnt genau davor im Kopfkommentar.

**Prefix-Location-Muster** (bereits zweimal im Bestand, `^~` stoppt
Regex-Suche und respektiert `try_files`/Redirect-Reihenfolge):
```nginx
location ^~ /_astro/ { expires 1y; }
location ^~ /holo/   { types { model/gltf-binary glb; } expires 1y; }
```
Ein neuer `location ^~ /_gate/` (Mint-Endpunkt) oder eine Ausnahmeliste
sollte diesem Präfix-Muster folgen, nicht Regex-`location ~*`, weil Regex
gegen die bestehende `.html`-Zwillingsregel und die `/en/`-Redirects
konkurriert (siehe Kommentar zu `location /`).

**`map`-Block-Muster** für bedingtes Verhalten ohne `if`:
```nginx
map $http_cookie $vb_rum_script {
    default             "https://static.cloudflareinsights.com https://stats.verse-base.com";
    ~*vb_noanalytics=1  "";
}
```
Dasselbe Muster (`map $http_cookie $vb_gate_valid { … }` oder ähnlich) ist
der nächstliegende Weg, um den Ausweis-Cookie VOR dem njs-Aufruf grob zu
befragen, falls eine reine Existenzprüfung ohne HMAC nötig ist — die
eigentliche Signaturprüfung gehört aber in `gate.js` (njs), nicht in eine
`map`, weil `map` kein HMAC kann.

**Die einzige „nur auf Vorschau aktiv"-Bauform im Repo** — Vorbild für D-23s
„funktional aktiv nur auf staging, gleiches Image":
```dockerfile
# Source: Dockerfile:65-69 (VERIFIED)
ARG STAGING=""
RUN if [ -n "$STAGING" ]; then \
      sed -i '/^map \$http_cookie \$vb_rum_/,/^}/ s|^\( *default *\).*;|\1"";|' /etc/nginx/conf.d/default.conf; \
      ! sed -n '/^map \$http_cookie \$vb_rum_/,/^}/p' /etc/nginx/conf.d/default.conf | grep -q 'default .*https'; \
    fi
```
Struktur: `sed` verändert die Konfiguration bedingt auf `$STAGING`, gefolgt
von einer **Gegenkontrolle** (`!... grep -q`), die den Build hart bricht,
wenn die Änderung NICHT griff. Für das Gate wäre die Übertragung: das
Gate-Modul/-Aktivierung nur greifen lassen, wenn `$STAGING` gesetzt ist,
mit derselben Gegenkontrolle-Idee (nicht nur hoffen, dass die Bedingung
traf).

**Modul-Installation** (aus RESEARCH.md, kein Repo-Vorbild, aber konkrete
Doku-Quelle):
```dockerfile
RUN apk add --no-cache nginx-module-njs
# nginx.conf, main-Kontext:
# load_module modules/ngx_http_js_module.so;
```

### 2. Supabase — Rollen-Spiegel, Sperrliste, Kontosperre, Abzeichen

**Tabellen- und RLS-Bauform** (nächstliegendes, jüngstes Vorbild):
```sql
-- Source: supabase/migrations/20260812040000_mining_sig_presets.sql (Struktur
-- als Vorbild — Feindetails der Testpilot-Tabelle sind Planaufgabe)
```
→ Lies diese Datei direkt beim Planen für Feldtypen/RLS-Policy-Syntax; hier
ist wichtiger das übertragbare **Trigger**-Muster für die
Client-Schreibsperre, exakt das, was `discord_role_state.is_tester` und
`profiles.is_tester` (Spiegelspalte) brauchen:

```sql
-- Source: supabase/migrations/20260722200000_guard_rsi_verified.sql (VERIFIED,
-- vollständig übertragbar — nur Feldname tauschen)
create or replace function public.guard_rsi_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if caller_role = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.rsi_verified := false;
    return new;
  end if;
  if new.rsi_verified is distinct from old.rsi_verified
     and new.rsi_verified = true then
    raise exception 'rsi_verified kann nur nach serverseitiger RSI-Pruefung gesetzt werden'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_rsi_verified on public.profiles;
create trigger trg_guard_rsi_verified
  before insert or update on public.profiles
  for each row execute function public.guard_rsi_verified();
```
Übertragung für D-19: `is_tester` statt `rsi_verified`, Tabelle bleibt
`public.profiles`. Der Bot/njs-Mint-Pfad läuft mit der Service-Rolle und
darf schreiben; jeder Client-Schreibversuch auf `true` fliegt.

**Öffentliche View-Erweiterung** (D-19, Abzeichen auf `/pilot/<handle>`):
```sql
-- Source: supabase/migrations/20260723000000_public_profile_views.sql:22-40
-- (VERIFIED) — Spalte is_tester einfach in die SELECT-Liste aufnehmen:
create or replace view public.public_profiles
with (security_barrier = true) as
select
  handle, display_name, bio, banner_url, avatar_url, avatar_icon,
  avatar_color, role, status_state, status_text, rsi_handle,
  rsi_verified, /* NEU */ is_tester, org_name, created_at
from public.profiles
where handle is not null;

grant select on public.public_profiles to anon, authenticated;
```

**Fremdidentität serverseitig binden, mit Service-Rolle schreiben** (D-03,
Blaupause laut CONTEXT.md explizit benannt):
```typescript
// Source: supabase/functions/verify-rsi/index.ts:69-93 (VERIFIED)
const authHeader = req.headers.get('Authorization') ?? '';
const userClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user } } = await userClient.auth.getUser();
if (user) {
  const supabaseAdmin = createClient(
    supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  await supabaseAdmin.from('profiles').upsert({ id: user.id, /* … */ });
}
```
Vollständiges Muster (siehe Datei komplett gelesen): CORS-Header-Konstante
am Kopf, `OPTIONS`-Kurzschluss, try/catch um den ganzen Handler, JSON-Response
mit `{ verified, persisted, … }`-Form, 500 im catch-Zweig. Für
`link-discord-role` (falls als eigene Function statt in njs) 1:1 übertragbar
— nur die externe Gegenstelle (RSI-Website → Discord-API) und die
geschriebenen Felder ändern sich.

**⚠ `supabase/config.toml`**: jede neue Function braucht hier ihren
Eintrag mit begründetem `verify_jwt` — nicht aufgeführte Functions bekommen
beim Deploy `verify_jwt = true` automatisch, was `register`-artige
öffentliche Aufrufe stillschweigend sperren würde.

### 3. Discord — Blueprint, Bot, XP, Trockenlauf

**Rollendefinition** (Bestand, unverändert als Fundstelle, D-14):
```javascript
// Source: discord/blueprint.mjs:143 (VERIFIED)
{ key: 'tester', name: 'Test Pilots', color: C.craftOrange, hoist: false, mentionable: false, permissions: [] },
```

**Onboarding-Eintrag, der für D-15 ENTFERNT wird:**
```javascript
// Source: discord/blueprint.mjs:402 (VERIFIED)
{ title: 'Test pilot · Testpilot', description: 'Try things before they ship · Neues testen, bevor es live geht', emoji: '🧪', roles: ['tester'], channels: ['tools'] },
```

**Kanalstruktur/`renames{}`-Mechanik** für D-18 (neuer privater Kanal in
`BUILD & FEEDBACK`) — Vorbild ist der `bug-reports`-Forumskanal in
derselben Kategorie inkl. `overwrites` für sichtbarkeitsbeschränkte
Kanäle:
```javascript
// Source: discord/blueprint.mjs:195-220 (VERIFIED, gekürzt)
{
  key: 'cat-build', name: 'BUILD & FEEDBACK',
  channels: [
    {
      key: 'bug-reports', name: 'bug-reports', type: 'forum',
      topic: '…', tags: [ /* … */ ], layout: 'gallery', sort: 'activity',
      overwrites: { everyone: { allow: ['EmbedLinks', 'AttachFiles'] } },
    },
    // …
  ],
},
```
Für den neuen Testpiloten-Kanal: `type: 'text'`, `overwrites: { everyone:
{ deny: ['ViewChannel'] }, tester: { allow: ['ViewChannel', 'SendMessages',
'ReadMessageHistory'] } }` — analog zum bestehenden `STAFF_VIEW`-Konstrukt
(Zeilen 164-169) für die private Staff-Kategorie, nur mit der Rolle
`tester` statt `fleet-command`/`navigators`/`flight-computer`. Der
`renames{}`-Mechanismus (im Onboarding-Umbau am 17.08.2026 für
`#suggestions`→`#feedback` verwendet) ist NUR relevant, falls ein
bestehender Kanal umbenannt statt neu angelegt wird — für D-18 (neuer
Kanal) nicht nötig.

**Intent-Registrierung** (D-25, Voraussetzung für den Push-Mechanismus):
```javascript
// Source: discord/bot/src/index.mjs:35 (VERIFIED)
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates],
});
```
→ `GatewayIntentBits.GuildMembers` ergänzen; ⚠ wirkungslos ohne die
Portal-Aktivierung (Handarbeit des Betreibers, siehe CONTEXT D-25).

**Event-Handler-Verdrahtung, Struktur der `ClientReady`-Sequenz** (Vorbild
für wo `role-sync.mjs`/`role-reconcile.mjs` eingehängt werden):
```javascript
// Source: discord/bot/src/index.mjs:39-56 (VERIFIED, gekürzt)
client.once(Events.ClientReady, async (c) => {
  // … Presence, Slash-Commands, roles.ensure(guild) je Guild …
  startVoiceSweep(ctx);
  startPatchWatch(ctx);
});
```
`role-reconcile.mjs`s Startup-Vollabgleich gehört neben `roles.ensure()` in
denselben `ClientReady`-Block; `role-sync.mjs` registriert einen neuen
`client.on(Events.GuildMemberUpdate, …)`-Handler nach demselben
Registrierungsmuster wie die vorhandenen Events (siehe restlichen Teil von
`index.mjs`, nicht in dieser Passage gezeigt — bei der Umsetzung dort
weiterlesen).

**„Lies etwas, poste in einen Kanal"-Automat** (Vorbild für D-20
Deploy-Ping, falls im Bot statt in GH Actions realisiert):
```javascript
// Source: discord/bot/src/patch-watch.mjs:1-9,44-70 (VERIFIED, gekürzt)
const CHECK_MS = 30 * 60 * 1000;
const findPatchChannel = (guild) =>
  guild.channels.cache.find((c) => c.isTextBased?.() && !c.isVoiceBased?.() && /patch-notes/i.test(c.name));
async function check(ctx) {
  reload();
  const p = latestPatch();
  if (!p) return;
  for (const guild of ctx.client.guilds.cache.values()) {
    const last = ctx.db.getMeta(guild.id, 'lastPatch');
    if (last === p.version) continue;
    const channel = findPatchChannel(guild);
    if (!channel) continue; // nie als "erledigt" verbuchen, wenn der Kanal fehlt
    // … embed senden, DB-Meta aktualisieren …
  }
}
```
Kernidee, die übertragbar ist: (a) Kanal per Namensmuster suchen statt
hartkodierter ID, (b) „letzten bekannten Stand" in der Bot-DB puffern, (c)
NIE als erledigt verbuchen, wenn die Zielressource (Kanal) fehlt — sonst
verschluckt ein Fehlerzustand den Post für immer. Für den Deploy-Ping ist
die Datenquelle allerdings `git log` (Commit-Betreffe), nicht ein
Patch-JSON — laut RESEARCH.md hat GH Actions eher Zugriff darauf als der
Bot-Container (kein git im Bot-Image); Planer muss entscheiden, ob der
Ping aus dem Workflow oder aus dem Bot kommt.

**XP-Vergabe** (D-21, einmal je Thread):
```javascript
// Source: discord/bot/src/award.mjs:14-31 (VERIFIED, gekürzt)
export async function grantXp(ctx, { member, guild, amount = 0, stats = {}, currentChannel = null }) {
  const before = ctx.db.getUser(guild.id, member.id);
  const beforeLevel = levelForXp(before.xp);
  let row;
  if (amount > 0) {
    row = ctx.db.addXp(guild.id, member.id, amount, stats);
  } else {
    ctx.db.addStats(guild.id, member.id, stats);
    row = ctx.db.getUser(guild.id, member.id);
  }
  const afterLevel = levelForXp(row.xp);
  if (afterLevel > beforeLevel) {
    await onLevelUp(ctx, { member, guild, beforeLevel, afterLevel, row, currentChannel });
  }
  return { row, beforeLevel, afterLevel, leveledUp: afterLevel > beforeLevel };
}
```
`bug-thread-xp.mjs` ruft `grantXp()` aus einem neuen
`Events.ThreadCreate`-Handler im Forum `#bug-reports`, mit einer
„einmal je Thread"-Sperre (z. B. eine neue Bot-DB-Tabelle
`bug_xp_threads(thread_id UNIQUE)`) — dasselbe „vor dem Schreiben prüfen,
ob schon vergeben" Muster wie `patch-watch.mjs`s `lastPatch`-Meta.

**Trockenlauf-Pflicht bei Massenaktionen** (D-16):
```javascript
// Source: discord/announce-update.mjs:18,41 (VERIFIED)
//     node announce-update.mjs --dry-run     # resolve + preview, send nothing
const DRY = process.argv.includes('--dry-run');
```
`discord/tester-dry-run.mjs`/`tester-revoke.mjs` übernehmen dieses exakte
Flag-Muster: `--dry-run` → nur auflisten (Namen + Anzahl, laut D-16), ohne
Flag → tatsächlicher Entzug bei allen Trägern der Rolle `tester`.

**Mitgliederliste OHNE `GuildMembers`-Intent lesen** (relevant für den
Trockenlauf, der VOR der Intent-Aktivierung laufen kann — siehe RESEARCH
Open Question 5):
```javascript
// Source: discord/prune.mjs:149-165 (VERIFIED) — Muster: race gegen Timeout,
// weil ein Fetch ohne Intent ewig haengen kann; Ergebnis ehrlich als
// "nicht verfuegbar" statt Muster
try {
  await Promise.race([
    guild.members.fetch(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10_000)),
  ]);
  memberCounts = true;
} catch {
  memberCounts = false;
}
```
Für den Trockenlauf empfiehlt RESEARCH.md stattdessen die REST-Route
`guild.members.list()`/`fetchMembers()` mit Bot-Token (funktioniert OHNE
privilegiertes Intent, da einmaliger REST-Aufruf statt Gateway-Cache) —
`prune.mjs` zeigt trotzdem die richtige Vorsicht (Timeout-Race, ehrliches
Scheitern statt Vortäuschen).

### 4. Gate/Check-Skripte

**Registry-Eintragsform** (Pflicht für jedes neue `verify:*`):
```javascript
// Source: scripts/lib/gate-registry.mjs:57-63 (VERIFIED)
{
  id: 'verify:wiring',
  npm: 'verify:wiring',
  script: 'scripts/verify-wiring.mjs',
  rail: 'A',
  checks: 'Verzeichnis, Dateibestand und package.json sind deckungsgleich; kein Pruefskript liegt lose herum',
},
```
`verify:gate` braucht einen analogen Eintrag; `rail` ist zu bestimmen —
prüft es nur `dist/` und `nginx/default.conf`/`nginx/gate.js` als Quelltext
(kein Netz, kein git), gehört es auf Schiene A. Prüft es die AUSGELIEFERTE
Ausnahmeliste gegen den laufenden Container, gehört es auf Schiene C
(`env`-Feld Pflicht laut Kopfkommentar der Registry).

**Zusicherungs-/Berichtsform** (Soll/Ist-Druck, „wie viele Einheiten
geprüft"):
```javascript
// Source: scripts/verify-help.mjs:118,137,141 (VERIFIED, Muster)
console.log('\n[1] Kostenfreiheit vor dem Oeffnen — dist/assets/tool-help.js');
// …
console.log(`    Verbotene Bezeichner ausserhalb der Marken — Soll: 0   Ist: ${leaks.length}`);
// …
console.log(`\nverify-help: ${ok ? 'ALLE ZUSICHERUNGEN ERFUELLT ✓' : 'FEHLGESCHLAGEN ✗'}`);
if (!ok) process.exit(1);
```
`scripts/verify-gate.mjs` sollte dasselbe Muster fahren: nummerierte
Zusicherungen, jede mit „Soll: X Ist: Y"-Zeile, am Ende ein
Gesamt-Exit-Code. Konkrete Zusicherung 1 für dieses Tor: „jede Datei in der
Ausnahmeliste ist erreichbar OHNE Cookie — Soll: [Liste] Ist: [gemessen]",
vorgeführt rot durch einen Testlauf, der eine Datei absichtlich aus der
Liste streicht.

**Benannte Ausnahmen mit Zombie-Wächter** (falls die Torseiten-Ausnahme
über denselben Mechanismus wie DE/EN-Paarungen läuft):
```javascript
// Source: scripts/lib/sync-exclusions.mjs Kopf-Kommentar (VERIFIED, paraphrasiert):
// jede Ausnahme trägt Fundstellen-Text, der sie selbst begründet — verschwindet
// die Fundstelle, greift die Ausnahme nicht mehr und der Zombie-Wächter
// (verify-sync Zusicherung 5) meldet sie als FEHLER statt sie stillschweigend
// zu behalten.
```
Für `scripts/verify-gate.mjs` gilt dieselbe Regel: die Ausnahmeliste
(HTML/CSS/JS/OAuth-Rückweg/`/build.json`) muss so kodiert sein, dass ein
verschwindender Grund (z. B. die Torseite lädt gar kein externes JS mehr)
das Tor **reißen** lässt, nicht stillschweigend weiter besteht.

## Shared Patterns

### Fremdidentität → serverseitig prüfen, Service-Rolle schreibt
**Quelle:** `supabase/functions/verify-rsi/index.ts`
**Gilt für:** `link-discord-role`-Function/njs-Mint-Pfad, `role-sync.mjs`
(Bot schreibt `discord_role_state` — dieselbe Regel gilt sinngemäß: der
Bot handelt mit dem Bot-Token, nicht mit einem Nutzertoken).

### Client-Schreibsperre auf ein Vertrauensfeld
**Quelle:** `supabase/migrations/20260722200000_guard_rsi_verified.sql`
**Gilt für:** `profiles.is_tester`, `discord_role_state.*` — jede Spalte,
die die Wahrheit aus Discord/Bot spiegelt und nicht vom Client verändert
werden darf.

### Öffentliche Ansicht über schmale View
**Quelle:** `supabase/migrations/20260723000000_public_profile_views.sql`
**Gilt für:** D-19 Abzeichen auf `/pilot/<handle>` — Spalte in
`public_profiles` aufnehmen, NICHT `profiles` selbst für `anon` öffnen.

### Kopfzeilen-Falle bei `add_header` in einer `location`
**Quelle:** `nginx/default.conf` (Kopfkommentar + `/build.json`-Block)
**Gilt für:** jeden neuen `location`-Block im Gate — Mint-Endpunkt,
Ausnahmeliste, Torseiten-Redirect.

### Nur-auf-Vorschau-aktiv über `STAGING`-Build-Arg + Gegenkontrolle
**Quelle:** `Dockerfile:65-69`
**Gilt für:** die Aktivierung des njs-Gates selbst (D-23 nennt genau diesen
Präzedenzfall).

### Trockenlauf-Pflicht vor destruktiven Discord-Massenaktionen
**Quelle:** `discord/announce-update.mjs` (`--dry-run`-Flag)
**Gilt für:** `tester-dry-run.mjs`/`tester-revoke.mjs` (D-16).

### Registrierungspflicht für neue Prüfskripte
**Quelle:** `scripts/lib/gate-registry.mjs`
**Gilt für:** `scripts/verify-gate.mjs` — ohne Eintrag reißt
`verify:wiring`.

## Kein Vorbild gefunden

| Datei | Rolle | Datenfluss | Grund |
|---|---|---|---|
| `nginx/gate.js` | middleware | request-response | Erstes Server-JS im nginx-Image; das Projekt hatte bis heute ausschließlich statische Auslieferung + `return`/`rewrite`. RESEARCH.md liefert ein Muster-Codebeispiel (nicht aus dem Repo), das als Ausgangspunkt dient, aber Feindetails (Cookie-Format, HMAC-Schlüsselverwaltung) sind Neuentwurf. |
| `src/pages/gate.astro` | component | request-response | Keine bestehende Seite ist absichtlich einsprachig, ohne `SiteNav`, mit inline-CSS/JS UND als bewusst ungepaarte Astro-Seite gebaut. Nächstliegend nur einzelne Bausteine: `AuthLogin.astro` für den Anmelde-/OAuth-Teil, ein bestehender Onepager für die „ungepaarte Datei bei verify:sync"-Fallgruppe (Pitfall 5) — kein Ganzes zum Kopieren. |
| `discord/bot/src/role-sync.mjs` | service | event-driven | Kein bestehender Handler schreibt bei einem Gateway-Event in Supabase (bisherige Bot-Persistenz ist reines SQLite über `db.mjs`). `patch-watch.mjs` ist das nächste Muster für „Event → externe Senke", aber die Senke dort ist ein Discord-Kanal, nicht Supabase — Übertragung, kein Kopieren. |
| `discord/bot/src/role-reconcile.mjs` | service | batch | Kein bestehender Bot-Code liest die volle Mitgliederliste EINER Rolle und gleicht sie gegen eine externe DB ab; `prune.mjs` gleicht gegen den Blueprint ab, nicht gegen Supabase. |
| `scripts/verify-gate.mjs` | test | batch | Erstes Tor, das die AUSGELIEFERTE Zugriffskontrolle selbst prüft (nicht Inhalt, sondern Erreichbarkeit mit/ohne Cookie). `verify-help.mjs`/`verify-sync.mjs` liefern die Berichts-/Ausnahme-FORM, nicht den Prüfgegenstand. |

## Metadaten

**Suchbereich:** `nginx/`, `Dockerfile`, `supabase/functions/`,
`supabase/migrations/`, `supabase/config.toml`, `discord/`,
`discord/bot/src/`, `src/components/account/`, `src/components/pilot/`,
`assets/account-lite.js`, `scripts/`, `scripts/lib/`
**Geprüfte Dateien:** 15 vollständig gelesen (nginx/default.conf,
Dockerfile, verify-rsi/index.ts, guard_rsi_verified.sql,
public_profile_views.sql, PilotPage.astro-Ausschnitte, account-lite.js-
Ausschnitte, blueprint.mjs-Ausschnitte, bot/index.mjs-Ausschnitte,
award.mjs, patch-watch.mjs, prune.mjs-Ausschnitt, gate-registry.mjs-
Ausschnitt, verify-help.mjs-Ausschnitt, verify-sync.mjs/sync-exclusions.mjs-
Ausschnitte, announce-update.mjs-Ausschnitt)
**Kartierungsdatum:** 2026-08-17
