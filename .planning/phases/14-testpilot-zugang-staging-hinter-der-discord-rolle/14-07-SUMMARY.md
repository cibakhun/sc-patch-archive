---
phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 07
subsystem: discord
tags: [discord.js, discord-gateway, postgrest, supabase, privileged-intent]

# Dependency graph
requires:
  - phase: 14-02
    provides: "public.discord_role_state (Bot-Spiegel, RLS mit genau einer select-Politik), Schluessel discord_user_id"
  - phase: 14-05
    provides: "Rolle 'Test Pilots' faellt aus dem Onboarding heraus, Blueprint-Schluessel 'tester' auf dem lebenden Server bestaetigt"
provides:
  - "GatewayIntentBits.GuildMembers im always-on Bot -- zweckgebunden, einziges neues privilegiertes Intent"
  - "role-sync.mjs: registerRoleSync(ctx) -- guildMemberUpdate/Add/Remove schreiben is_tester per PostgREST-PATCH nach public.discord_role_state, nur bei tatsaechlichem Tester-Rollenwechsel"
  - "role-reconcile.mjs: reconcileRoles(ctx, guild) -- Vollabgleich beim Bot-Start in BEIDE Richtungen, mit Selbstauskunft (X Mitglieder, Y Traeger, Z Aenderungen)"
  - "env.mjs: getSupabaseConfig() -- SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY optional fuer den Bot-Start (T-14-45)"
  - "discord/README.md + discord/bot/README.md richtiggestellt -- 'no privileged intents' stimmt seit dieser Phase nicht mehr"
  - "discord/audit.mjs + discord/prune.mjs behandeln das fehlende Server Members Intent nicht mehr als gewollten Zustand"
affects: ["14-08 (nginx-Tuersteher, liest denselben Spiegel via gate_verdict())", "14-12 (Ausrollen -- der Bot braucht SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in Coolify, bevor die Spiegelung wirkt)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PostgREST-PATCH mit Filter auf einen unique-Schluessel (discord_user_id) statt Upsert/POST -- schreibt NIE neue Zeilen, nur bestehende. Ein Treffer von 0 Zeilen ist der Normalfall (Konto noch nicht per Discord verknuepft), kein Fehler -- protokollieren und weiter, exakt patch-watch.mjs' Regel"
    - "Vollabgleich in BEIDE Richtungen (Rolle->Spiegel UND Spiegel->Rolle) statt nur Nachtragen -- eine einseitige Angleichung liesse die gefaehrliche Richtung offen (gueltiger Ausweis ohne Rolle)"
    - "Privilegiertes Intent zweckgebunden anfordern und das im Code-Kommentar an der Intent-Liste selbst festhalten, nicht nur in der Doku -- der naechste Leser der Intent-Liste findet die Begruendung direkt daneben"

key-files:
  created:
    - discord/bot/src/role-sync.mjs
    - discord/bot/src/role-reconcile.mjs
  modified:
    - discord/bot/src/index.mjs
    - discord/bot/src/env.mjs
    - discord/README.md
    - discord/bot/README.md
    - discord/audit.mjs
    - discord/prune.mjs

key-decisions:
  - "Schreibweg ist reines PostgREST-PATCH (nie POST/Upsert) -- discord_role_state.user_id ist Primaerschluessel OHNE Default und wird ausschliesslich vom sync_discord_identity()-Trigger (Plan 02) gesetzt; ein Upsert ohne user_id waere entweder unmoeglich (NOT NULL) oder haette die falsche Zeile getroffen. PATCH+Filter auf discord_user_id trifft nie daneben und legt nie eine Zeile ohne user_id an."
  - "registerRoleSync(ctx) wird TOP-LEVEL registriert (wie MessageCreate/InteractionCreate), NICHT innerhalb ClientReady -- reconcileRoles(ctx, guild) dagegen INNERHALB der ClientReady-Sequenz je Gilde, neben roles.ensure(guild) -- folgt exakt der im Plan vorgegebenen Unterscheidung zwischen laufendem Ereignis-Listener und einmaligem Start-Abgleich."
  - "discord/bot/README.md zusaetzlich zur Doku-Richtigstellung herangezogen (Rule 1), obwohl nicht in files_modified gelistet -- dieselbe jetzt falsche 'no privileged intents'-Behauptung stand dort an ZWEI Stellen, ueber genau DIESEN Bot, nicht nur ueber den Blueprint-Builder aus discord/README.md."
  - "audit.mjs UND prune.mjs fordern jetzt selbst GatewayIntentBits.GuildMembers an (nicht nur im always-on Bot) -- ohne das eigene Anfordern koennten beide Skripte das Fehlen des Intents gar nicht maschinell FESTSTELLEN, sondern nur behaupten; audit.mjs meldet die Abwesenheit jetzt als err()-Zusicherung statt eines INFO-Nebensatzes."
  - "Die vier realen Zustandswechsel-Nachweise aus den Akzeptanzkriterien (Rolle geben/nehmen, Server-Austritt, Ausfallfall+Neustart) sind NICHT gegen die lebende Anlage gefahren -- sie brauchen einen mit dem NEUEN Code deployten Bot, und 'Do NOT deploy the bot' ist eine ausdrueckliche Vorgabe dieses Plans (Deploy ist Betreiber-/Coolify-Sache). Als drei WINDOWS.md-Eintraege (ids 21/22/23) verdrahtet, nicht nur in Prosa vermerkt."

patterns-established:
  - "Bei privilegierten Discord-Intents: Zweckbindung als Kommentar UNMITTELBAR an der Intent-Liste im Client-Konstruktor festhalten (nicht nur in der README) -- der naechste Leser, der eine Intent-Zeile aendert, sieht die Begruendung ohne Kontextwechsel."
  - "Diagnose-/Admin-Skripte (audit.mjs, prune.mjs), die ein fehlendes privilegiertes Intent frueher als 'by design' meldeten, muessen bei jeder Aenderung an der zugrunde liegenden Annahme (hier: das Intent wird jetzt gebraucht) mitgezogen werden -- sonst driften Doku UND Diagnose-Tools gemeinsam gegen die Wahrheit."

requirements-completed: [D-08, D-17]  # D-25 bewusst NICHT hier -- die vier live-Zustandswechsel-Nachweise stehen aus (siehe key-decisions), Requirement bleibt formal offen bis zum naechsten Deploy

coverage:
  - id: D1
    description: "GatewayIntentBits.GuildMembers zweckgebunden ergaenzt, KEIN weiteres privilegiertes Intent (Presence/MessageContent bleiben aus); registerRoleSync(ctx) in index.mjs verdrahtet"
    requirement: D-25
    verification:
      - kind: other
        ref: "node --check src/index.mjs + der im Plan vorgegebene automatisierte <verify>-Block (Aufgabe 2), tatsaechlich ausgefuehrt -- Ausgabe: 'Bot: 1 neues Intent, 3 Ereignisse, Spiegelziel verdrahtet'"
        status: pass
    human_judgment: false
  - id: D2
    description: "role-sync.mjs registriert genau drei Ereignisse (GuildMemberUpdate/Add/Remove); schreibt nur bei tatsaechlichem Tester-Rollenwechsel, PATCH ohne Treffer ist protokollierter Normalfall, Netzfehler werden verschluckt"
    requirement: D-17
    verification:
      - kind: other
        ref: "node --check src/role-sync.mjs + der automatisierte <verify>-Block aus Aufgabe 2 (grep auf GuildMemberUpdate/Add/Remove, discord_role_state, is_tester) -- bestanden"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vier reale Zustandswechsel gegen die lebende Anlage (Rolle geben -> is_tester=true binnen 5s, Rolle nehmen -> false, andersartige Rollenaenderung loest KEINEN Schreibzugriff aus, Server-Austritt -> false)"
    requirement: D-08
    verification: []
    human_judgment: true
    rationale: "Braucht einen mit dem NEUEN Code deployten Bot und ein Testkonto mit verknuepftem Site-Konto; Deploy ist ausdruecklich NICHT Teil dieses Plans (kritische Vorgabe: 'Do NOT deploy the bot' -- Rollout ist Betreiber-/Coolify-Sache). WINDOWS.md id 21."
  - id: D4
    description: "role-reconcile.mjs: Vollabgleich in ClientReady, beide Richtungen, Selbstauskunft mit drei Zahlen, Supabase-Ausfall wird protokolliert und uebersprungen"
    requirement: D-25
    verification:
      - kind: other
        ref: "node --check src/role-reconcile.mjs + der automatisierte <verify>-Block aus Aufgabe 3 (grep auf members.fetch, discord_role_state, Rollenabgleich, reconcileRoles in index.mjs) -- bestanden"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ausfallfall-Nachweis: Bot gestoppt, Rolle im Stillstand vergeben/entzogen, Bot neu gestartet -> Vollabgleich holt beide Richtungen nach"
    requirement: D-25
    verification: []
    human_judgment: true
    rationale: "Braucht denselben deployten Bot wie D3 plus einen kontrollierten Stopp/Start-Zyklus gegen die lebende Anlage -- Deploy ist nicht Teil dieses Plans. WINDOWS.md id 22."
  - id: D6
    description: "discord/README.md und discord/bot/README.md enthalten die 'no privileged intents'-Behauptung nicht mehr, sondern die neue Lage samt Klickweg"
    requirement: D-25
    verification:
      - kind: other
        ref: "grep 'No privileged intents are required' auf beide Dateien -- 0 Treffer; der im Plan vorgegebene automatisierte <verify>-Block aus Aufgabe 3 prueft dasselbe fuer discord/README.md"
        status: pass
    human_judgment: false

# Metrics
duration: ~50min
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 07: Testpilot-Rollenstand per Push -- guildMemberUpdate/-Add/-Remove plus Start-Vollabgleich Summary

**Der always-on Bot bekommt ein zweckgebundenes GuildMembers-Intent, spiegelt Rollenwechsel binnen Millisekunden per PostgREST-PATCH nach public.discord_role_state und gleicht beim Start einmal vollstaendig in beide Richtungen ab -- Doku und Diagnose-Skripte (README, audit.mjs, prune.mjs) sind nachgezogen, damit "kein privilegiertes Intent" nicht mehr gegen den eigenen Bot arbeitet.**

## Performance

- **Duration:** ~50min
- **Completed:** 2026-08-18T10:57:08Z
- **Tasks:** 3 (Aufgabe 1: Checkpoint -- Server Members Intent im Developer Portal; Aufgabe 2: Rollenwechsel-Push; Aufgabe 3: Start-Vollabgleich + Doku)
- **Files modified:** 8 (2 neu, 6 geaendert)

## Accomplishments

- **Aufgabe 1 (Checkpoint) bereits vor Sitzungsbeginn aufgeloest:** Der Koordinator hat das Server Members Intent im Discord Developer Portal fuer die Bot-Anwendung (`1530625191011422330`) eingeschaltet, gespeichert und nach einem Neuladen der Seite bestaetigt, dass es weiterhin an ist -- Presence- und MessageContent-Intent blieben ausdruecklich aus. Diese Bestaetigung wurde dieser Ausfuehrung als gepruefte Tatsache uebergeben (siehe `<state_of_the_world>` des Ausfuehrungsauftrags); Plan 06 (`discord/tester-dry-run.mjs`) hatte bereits belegt, dass der Bot-Token mit `GatewayIntentBits.GuildMembers` verbinden kann.
- `discord/bot/src/index.mjs`: `GatewayIntentBits.GuildMembers` als zweckgebundenes viertes Intent ergaenzt (mit erklaerendem Kommentar direkt an der Intent-Liste), `registerRoleSync(ctx)` top-level verdrahtet (wie `MessageCreate`/`InteractionCreate`), `reconcileRoles(ctx, guild)` innerhalb der `ClientReady`-Sequenz je Gilde, neben `roles.ensure(guild)`.
- `discord/bot/src/role-sync.mjs` (neu): `registerRoleSync(ctx)` registriert `GuildMemberUpdate`/`GuildMemberAdd`/`GuildMemberRemove`. Schreibt NUR bei tatsaechlichem Wechsel der Zugehoerigkeit zur Rolle "Test Pilots" (Blueprint-Schluessel `tester`, keine fest eingetragene ID). Schreibweg ist PostgREST-`PATCH` auf `public.discord_role_state`, gefiltert auf `discord_user_id`, gesetzt werden ausschliesslich `is_tester` und `updated_at` -- `user_id`/`discord_user_id`/`last_staging_seen` bleiben dem Trigger aus Plan 02 bzw. dem Torurteil vorbehalten. Ein Treffer von 0 Zeilen (Discord-Konto noch nicht mit der Website verknuepft) ist der protokollierte Normalfall, kein Fehler. Netzfehler werden protokolliert und verschluckt.
- `discord/bot/src/role-reconcile.mjs` (neu): `reconcileRoles(ctx, guild)` laeuft einmal beim Start, laedt die vollstaendige Mitgliederliste (`guild.members.fetch()`, jetzt mit Intent moeglich, im Wettlauf gegen einen 10-Sekunden-Zeitgeber nach dem Muster von `prune.mjs`), liest den aktuellen Spiegelstand und schreibt die Differenz in BEIDE Richtungen (Rolle vorhanden aber Spiegel `false` -> `true`; Spiegel `true` aber Rolle fehlt -> `false`). Selbstauskunft: `Rollenabgleich: X Mitglieder gelesen, Y Traeger, Z Aenderungen geschrieben`. Scheitert Supabase oder haengt der Mitgliederabruf, wird protokolliert und uebersprungen -- der Bot startet trotzdem.
- `discord/bot/src/env.mjs`: `getSupabaseConfig()` liest `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, beide OPTIONAL fuer den Start (T-14-45). Fehlen sie, meldet `index.mjs` eine deutliche Zeile und alle uebrigen Aufgaben (Raenge/XP/Sprache/Patch-Wache) laufen unveraendert weiter.
- `discord/README.md` und `discord/bot/README.md`: die Aussage "No privileged intents are required — leave them off" durch die neue Lage ersetzt -- Server Members Intent IST seit Phase 14 erforderlich, wofuer, dass die anderen beiden aus bleiben, und der Klickweg im Developer Portal.
- `discord/audit.mjs` und `discord/prune.mjs`: fordern jetzt selbst `GatewayIntentBits.GuildMembers` an und melden dessen Abwesenheit als Fund (`audit.mjs`: neue `err()`-Zusicherung "Server Members Intent nicht verfuegbar"; `prune.mjs`: roter Hinweis statt des bisherigen "by design"-Kommentars) -- beide behandelten das Fehlen vorher ausdruecklich als gewollten Zustand.
- `npm run build && npm run gate`: 18/18 Schienen-A-Schritte gruen, 0 FEHLER, 4 vorbestehende WARNUNGEN (kein `<h1>` auf vier Konto-/Piloten-Seiten -- unveraendert seit vorherigen Plaenen, nicht durch diesen Plan beruehrt).

## Task Commits

1. **Aufgabe 1: Server Members Intent einschalten** -- kein Code-Commit (Checkpoint, ausserhalb des Repos); vom Koordinator vor Sitzungsbeginn bestaetigt, siehe "Accomplishments" oben
2. **Aufgabe 2: Rollenwechsel schreiben -- guildMemberUpdate/-Add/-Remove** -- `6074bdb` (feat)
3. **Aufgabe 3: Vollabgleich beim Start und Doku richtigstellen** -- `110f1df` (feat)

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap)

## Files Created/Modified

- `discord/bot/src/role-sync.mjs` -- `registerRoleSync(ctx)`, `writeIsTester()`, `TESTER_ROLE_NAME`
- `discord/bot/src/role-reconcile.mjs` -- `reconcileRoles(ctx, guild)`
- `discord/bot/src/index.mjs` -- viertes Intent, `registerRoleSync`/`reconcileRoles` verdrahtet, `supabase` in `ctx`
- `discord/bot/src/env.mjs` -- `getSupabaseConfig()`
- `discord/README.md` -- Intent-Aussage richtiggestellt
- `discord/bot/README.md` -- dieselbe Richtigstellung an zwei Stellen (Rule 1, siehe Deviations)
- `discord/audit.mjs` -- eigenes `GuildMembers`-Intent + `err()`-Zusicherung
- `discord/prune.mjs` -- eigenes `GuildMembers`-Intent + roter Hinweis statt "by design"

## Decisions Made

Siehe `key-decisions` im Frontmatter oben -- Kurzfassung: PATCH statt Upsert (Primaerschluessel-Sicherheit), Top-Level- vs. ClientReady-Registrierung nach Ereignistyp, `discord/bot/README.md` als zusaetzliche Rule-1-Korrektur, `audit.mjs`/`prune.mjs` fordern das Intent jetzt selbst an, um dessen Abwesenheit ueberhaupt feststellen zu koennen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - irrefuehrende Doku] `discord/bot/README.md` enthielt dieselbe jetzt falsche Behauptung wie `discord/README.md`, an zwei Stellen**
- **Found during:** Aufgabe 3 (Doku richtigstellen)
- **Issue:** Der Plan listet nur `discord/README.md` unter `files_modified` und in Aufgabe 3 nur diese Datei namentlich. `discord/bot/README.md` -- die README GENAU DES BOTS, der in diesem Plan das neue Intent bekommt -- behauptete an zwei Stellen ("It needs no privileged intents", "No privileged intents are required — leave them off") dasselbe jetzt falsche Faktum. Ein Leser, der den Bot statt den Server-Builder einrichtet, waere direkt in die Falle gelaufen, die Aufgabe 3 fuer `discord/README.md` ausdruecklich vermeiden wollte.
- **Fix:** Beide Stellen richtiggestellt: die "Why always-on"-Einleitung nennt jetzt das Server-Members-Intent und verweist auf Setup-Schritt 1; Setup-Schritt 1 selbst nennt den Klickweg im Developer Portal und die Folge (`guildMemberUpdate` feuert sonst nie, ohne Fehlermeldung).
- **Files modified:** `discord/bot/README.md`
- **Verification:** `grep -n -i "privileged intent"` zeigt nur noch die zwei neuen, korrekten Stellen; kein "no privileged intents"/"leave them off" mehr im Text. `npm run gate` weiterhin 18/18.
- **Committed in:** `110f1df` (Aufgabe-3-Commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, irrefuehrende Dokumentation an einer vom Plan nicht namentlich gelisteten, aber sachlich identischen Stelle)
**Impact on plan:** Kein Scope-Creep -- derselbe Fehler, derselbe Bot, dieselbe Korrektur wie in Aufgabe 3 fuer `discord/README.md` vorgesehen, nur an einer zweiten Fundstelle.

## Issues Encountered

- **Die vier live-Zustandswechsel aus den Akzeptanzkriterien beider Aufgaben (Rolle geben/nehmen, Server-Austritt, Ausfallfall+Neustart) wurden NICHT gegen die lebende Anlage gefahren.** Sie setzen einen mit dem NEUEN Code deployten Bot voraus -- der `<critical_notes>`-Abschnitt dieser Ausfuehrung untersagt ausdruecklich, den Bot zu deployen ("Do NOT deploy the bot... Rollout ist Betreiber-/Coolify-Sache"). Stattdessen wurden alle im Plan vorgegebenen automatisierten `<verify>`-Bloecke tatsaechlich ausgefuehrt (siehe Task Commits/Coverage oben) sowie `npm run build && npm run gate` (18/18). Die vier Live-Nachweise sind als WINDOWS.md-Eintraege **id 21** (Aufgabe 2: Rolle geben/nehmen/andere-Aenderung/Austritt) und **id 22** (Aufgabe 3: Ausfallfall) verdrahtet, mit dem Hinweis, dass sie erst nach dem naechsten Deploy nachholbar sind (Coolify-Umgebungsvariablen `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` sind laut Plan-`user_setup` ohnehin noch nicht gesetzt -- ohne sie liefe die Spiegelung selbst nach einem Deploy zunaechst inaktiv, siehe naechster Punkt).
- **`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` sind in Coolify noch NICHT gesetzt** (Plan-`user_setup`, siehe "User Setup Required" unten) -- ohne diese beiden Variablen bleibt die Rollenspiegelung nach dem naechsten Deploy zunaechst inaktiv (der Bot meldet das beim Start als eine Zeile und laeuft ansonsten normal weiter, wie von T-14-45 verlangt). Kein Blocker fuer DIESEN Plan (Code ist fertig und maschinell belegt), aber Voraussetzung dafuer, dass D3/D4 (WINDOWS.md ids 21/22) je nachgeholt werden koennen.

## User Setup Required

**Zwei Coolify-Umgebungsvariablen fuer die Bot-Anwendung `verse-base-rank-bot`** (Coolify -> Anwendung -> Environment Variables), noch NICHT gesetzt:

| Variable | Wert |
|---|---|
| `SUPABASE_URL` | `https://trgjhmbnodoarnfmlcqx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard -> Project Settings -> API -> `service_role` (geheim -- niemals ins Repo, niemals in ein Protokoll) |

Ohne diese beiden Variablen startet der Bot weiterhin normal (T-14-45), die Rollenspiegelung bleibt aber inaktiv -- eine deutliche Startzeile meldet das. Beide Variablen sind Vorbedingung fuer die Live-Nachweise aus WINDOWS.md ids 21/22.

**Deploy des Bots selbst** war ausdruecklich NICHT Teil dieser Ausfuehrung (kritische Vorgabe) -- der neue Code liegt committet auf `claude/staging-tester-role-access-308ebf`, aber die laufende Coolify-Instanz von `verse-base-rank-bot` faehrt weiterhin den ALTEN Stand (ohne das Intent, ohne die Rollenspiegelung), bis der Betreiber ausdruecklich ausrollt.

## Next Phase Readiness

- Der Rollenspiegel (`public.discord_role_state`) bekommt seinen Schreiber: Code fuer Push (Aufgabe 2) UND Start-Vollabgleich (Aufgabe 3) steht, maschinell gepruefte Verdrahtung bestaetigt, Doku und Diagnose-Skripte sind nachgezogen.
- **Blocker fuer die Live-Wirksamkeit, nicht fuer diesen Plan:** Deploy des Bots (Betreiber/Coolify) plus die beiden Umgebungsvariablen aus "User Setup Required" muessen VOR den in WINDOWS.md ids 21/22 verdrahteten Live-Nachweisen liegen.
- Plan 14-08 (nginx-Tuersteher/`gate_verdict()`) kann unveraendert fortfahren -- er liest denselben Spiegel (`public.discord_role_state`), unabhaengig davon, ob der Bot bereits deployed ist; der Spiegel ist nur so aktuell wie der letzte Deploy/Vollabgleich.
- Drei neue WINDOWS.md-Eintraege (ids 21, 22, 23) fuer diesen Plan -- open_count jetzt 15 (vorher 12).

---
*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: discord/bot/src/role-sync.mjs
- FOUND: discord/bot/src/role-reconcile.mjs
- FOUND: discord/bot/src/index.mjs (GuildMembers, registerRoleSync, reconcileRoles bestaetigt per grep)
- FOUND: discord/bot/src/env.mjs (getSupabaseConfig bestaetigt)
- FOUND: discord/README.md, discord/bot/README.md (kein "No privileged intents are required" mehr, per grep bestaetigt)
- FOUND: commit 6074bdb (Aufgabe 2)
- FOUND: commit 110f1df (Aufgabe 3)
- FOUND: .planning/WINDOWS.md ids 21/22/23 (kind unrun-verify x2, deviation x1, phase 14)
- `npm run build && npm run gate`: 18/18 gruen, zuletzt nach 110f1df
