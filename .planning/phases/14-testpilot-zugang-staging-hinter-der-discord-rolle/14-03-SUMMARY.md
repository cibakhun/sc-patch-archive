---
phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle
plan: 03
subsystem: auth
tags: [supabase, postgres, plpgsql, security-definer, discord-oauth, auth-users, gotrue]

requires:
  - phase: 14-02
    provides: "discord_role_state (Bot-Spiegel), trg_sync_discord_identity (AFTER INSERT ON auth.identities), gate_verdict()"
provides:
  - "D-02-Riegel gegen die stille Kontoerstellung ueber den Discord-Weg -- live auf trgjhmbnodoarnfmlcqx, vorgefuehrt rot in drei Richtungen"
  - "Rueckbau-Dokumentation (vorherige Fassung von public.handle_new_user()) im Migrationskommentar, ohne Archaeologie zurueckspielbar"
  - "Erster tatsaechlicher (nicht nur logisch erschlossener) Nachweis fuer trg_sync_discord_identity aus Plan 02 -- schliesst 14-02-SUMMARY.md coverage D6"
affects: [14-04, 14-08, 14-09, 14-12]

tech-stack:
  added: []
  patterns:
    - "42501 'must be owner of relation' auf einer von Supabase verwalteten auth.*-Tabelle: kein eigener Trigger anlegbar -- stattdessen die bestehende, projekteigene AFTER-INSERT-Trigger-Funktion erweitern, sofern sie einer eigenen Rolle (hier postgres) gehoert. Neue Bedingung als ERSTER Zweig, mit raise exception fuer den Sperrfall -- Postgres rollt bei einer Ausnahme in einem AFTER-Trigger die gesamte Transaktion inkl. der bereits eingefuegten Zeile zurueck, Wirkung identisch zu einem BEFORE-INSERT-Trigger."
    - "SET search_path TO '' (leerer Suchpfad, staerker als 'public') verlangt vollqualifizierte Referenzen ausnahmslos -- jede kuenftige Ergaenzung an einer solchen Funktion muss das einhalten."

key-files:
  created:
    - supabase/migrations/20260818002000_block_discord_signup.sql
  modified: []

key-decisions:
  - "Riegel sitzt in public.handle_new_user() (Eigentuemer postgres, aenderbar) statt in einem eigenen Trigger auf auth.users -- auth.users gehoert supabase_auth_admin, apply_migration(block_discord_signup) scheiterte gemessen an ERROR 42501: must be owner of relation users. Betreiber hat nach Abwaegung von drei vorgelegten Wegen (Funktion erweitern / Auth-Hook / Dashboard-Trigger) die Funktionserweiterung gewaehlt."
  - "Meldungstext ohne Vorschau-Begruendung: der Riegel wirkt site-weit (auch auf verse-base.com selbst, nicht nur staging -- D-01 macht Discord zum zweiten Anmeldeweg FUER DIE SEITE). Alt: 'Für diese Vorschau...'. Neu: 'Zu diesem Discord-Konto gibt es noch kein Konto auf verse-base.com. Registriere dich zuerst mit E-Mail und Passwort und verknüpfe Discord danach in deinem Konto.' -- sagt nur, was zu tun ist, ohne Vorschau-Vorwissen vorauszusetzen."
  - "Migrationsdatei aendert AUSSCHLIESSLICH die Funktion -- legt keinen Trigger an, droppt keinen. Der bestehende Trigger on_auth_user_created (seit der allerersten Migration des Projekts, nicht im Repo) bleibt unberuehrt; ein DROP/CREATE TRIGGER wuerde an derselben 42501-Sperre scheitern wie der urspruenglich geplante eigene Trigger."

patterns-established:
  - "Vor jeder Migration, die auf auth.* schreibend eingreifen will: pruefen, ob die Zieltabelle supabase_auth_admin gehoert (42501-Risiko). Falls ja: nach einer bestehenden, postgres-eigenen Funktion suchen, die vom vorhandenen Trigger ohnehin aufgerufen wird, statt einen eigenen Trigger zu planen."
  - "Bei jeder Aenderung an einer Funktion mit SET search_path TO '': jede Tabellen-/Funktionsreferenz vollqualifizieren (public.profiles statt profiles) -- keine Ausnahme."

requirements-completed: [D-02]

coverage:
  - id: D1
    description: "Der Riegel blockt einen Discord-Signup-Versuch fuer ein unbekanntes Konto (INSERT INTO auth.users mit provider=discord scheitert mit insufficient_privilege) und laesst E-Mail-Registrierung sowie linkIdentity() auf ein bestehendes Konto unveraendert durch"
    requirement: D-02
    verification:
      - kind: integration
        ref: "Koordinator, Supabase Management API, 18.08.2026 -- drei SQL-Gegenproben in EINER Transaktion mit erzwungenem Rollback gegen trgjhmbnodoarnfmlcqx: T1 E-Mail-Registrierung durchgelassen + Profil angelegt; T2 Discord-Registrierung abgewiesen mit dem korrigierten Meldungstext; T3 Discord-Verknuepfung auf bestehendes Konto durchgelassen + discord_role_state.discord_user_id gesetzt. Vorher-Probe gegen die unveraenderte Funktion lief zusaetzlich (Testaufbau bewiesen, bevor geaendert wurde). Ruckstandskontrolle danach: 7 Nutzer/7 Profile unveraendert, 0 Probe-Nutzer, 0 Probe-Identitaeten, 0 Spiegelzeilen."
        status: pass
    human_judgment: false
  - id: D2
    description: "trg_sync_discord_identity aus Plan 02 wird im Zusammenspiel tatsaechlich ausgeloest und setzt discord_role_state.discord_user_id korrekt -- schliesst die bis dahin nur logisch erschlossene Zusicherung aus 14-02-SUMMARY.md (coverage D6)"
    requirement: D-03
    verification:
      - kind: integration
        ref: "Derselbe T3-Testfall wie D1 oben (Koordinator, 18.08.2026, zurueckgerollte Transaktion)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Der formulierte Meldungstext ('Zu diesem Discord-Konto gibt es noch kein Konto...') kommt tatsaechlich im Browser beim Nutzer an, statt von GoTrue in eine generische Antwort ('Database error saving new user') verpackt zu werden"
    verification: []
    human_judgment: true
    rationale: "Per SQL nicht pruefbar -- die SQL-Gegenproben zeigen nur, dass der INSERT abbricht (D1), nicht, wie GoTrue die Ausnahme beim echten Discord-OAuth-Ruecklauf gegenueber dem Browser verpackt. Erst ab Plan 14-04 pruefbar, wenn der Discord-Provider bei Supabase eingerichtet ist. Als offener Punkt in .planning/WINDOWS.md id 16 gefuehrt."
  - id: D4
    description: "Vier echte Anmeldevorgaenge (Registrierung, Login, Logout/Login, Passwort-Reset) auf verse-base.com/account/ (LIVE) funktionieren unveraendert, nachdem der Riegel in public.handle_new_user() -- der Funktion, die JEDE Registrierung traegt -- scharf ist"
    verification: []
    human_judgment: true
    rationale: "Braucht echte Browser-Anmeldevorgaenge gegen die live ausgelieferte Seite, kein automatisierter Check in dieser Ausfuehrungssitzung moeglich. Jetzt wichtiger als urspruenglich geplant, weil der Riegel nicht mehr in einem isolierten neuen Trigger sitzt, sondern in der bereits von jeder Registrierung durchlaufenen Funktion. Als offener Punkt in .planning/WINDOWS.md id 17 gefuehrt."

duration: ~30min aktive Ausfuehrung (erster bis letzter Task-Commit) zzgl. zwei Koordinator-Checkpoint-Runden (Meldungstext-Korrektur nach Befund 1, Migrations-Umschreibung nach dem 42501-Befund)
completed: 2026-08-18
status: complete
---

# Phase 14 Plan 03: Der Discord-Signup-Riegel (D-02) Summary

**public.handle_new_user() um eine erste Bedingung erweitert, die jeden Discord-Signup fuer ein unbekanntes Konto mit `insufficient_privilege` abweist -- live auf trgjhmbnodoarnfmlcqx, vorgefuehrt rot in drei Richtungen, nachdem der urspruenglich geplante eigene Trigger auf `auth.users` an ERROR 42501 (must be owner of relation) scheiterte.**

## Performance

- **Duration:** ~30 min aktive Ausfuehrung (Commit `abda325` bis `f7b74f7`), zzgl. zwei Koordinator-Checkpoint-Runden mit Wartezeit dazwischen (Text-Korrektur, Migrations-Umschreibung)
- **Started:** 2026-08-18T01:46:20+02:00 (erster Task-Commit)
- **Completed:** 2026-08-18T02:15:34+02:00 (letzter Commit dieser Sitzung; Aufgabe 2 wurde vom Koordinator ueber die Management API angewendet und gegengeprueft)
- **Tasks:** 2 (Aufgabe 1: Riegel schreiben; Aufgabe 2: [BLOCKING] anwenden + vorgefuehrt rot fahren)
- **Files modified:** 1 (Migration, mehrfach ueberarbeitet)

## Accomplishments

- `public.handle_new_user()` blockt jeden Discord-Signup-Versuch fuer ein unbekanntes Konto, laesst E-Mail-Registrierung und das Verknuepfen von Discord mit einem bestehenden Konto (`linkIdentity`) unveraendert durch -- D-02 vollstaendig umgesetzt und live.
- Architektur-Pivot mitten in der Ausfuehrung, gemessen statt vermutet: der urspruenglich geplante eigene `before insert on auth.users`-Trigger ist auf der verwalteten Supabase-Plattform nicht anlegbar (`auth.users` gehoert `supabase_auth_admin`). Der Betreiber hat nach Abwaegung von drei Wegen die Erweiterung der bestehenden, `postgres`-eigenen Funktion `public.handle_new_user()` gewaehlt.
- Meldungstext nach Koordinator-Ruecklauf korrigiert: begruendet die Absage nicht mehr mit Vorschau-Wissen (der Riegel wirkt site-weit, D-01), sondern sagt nur, was zu tun ist.
- Migrationsdatei enthaelt die woertlich angewandte Funktionsfassung, die vorherige Fassung als Rueckbau-Kommentarblock (beide per `pg_get_functiondef` aus der lebenden Anlage geholt), den 42501-Befund samt Begruendung, und eine Warnung zu `SET search_path TO ''`.
- Drei SQL-Gegenproben in einer zurueckgerollten Transaktion gegen die lebende Anlage gefahren (Koordinator, Supabase Management API) -- alle drei bestanden, wortgetreue Ausgaben unten.
- Nebenbefund: `trg_sync_discord_identity` aus Plan 02 wurde dabei zum ERSTEN MAL tatsaechlich im Zusammenspiel gemessen (vorher nur logisch erschlossen, 14-02-SUMMARY.md coverage D6) -- schliesst diese offene Zusicherung.

## Task Commits

1. **Aufgabe 1: Der Riegel als Trigger auf auth.users (D-02)** -- `abda325` (feat, urspruengliche Fassung mit eigenem Trigger)
2. **Meldungstext-Korrektur (Koordinator-Befund 1+2)** -- `f2a6e46` (fix)
3. **Aufgabe 2: [BLOCKING] Riegel druecken und beidseitig vorgefuehrt rot fahren** -- kein eigener Executor-Commit; angewandt vom Koordinator ueber die Supabase Management API (`apply_migration name="block_discord_signup_in_handle_new_user"`, nach einem gescheiterten Erstversuch `apply_migration(block_discord_signup)` -> `ERROR 42501`), mit ausdruecklicher Betreiber-Entscheidung fuer den Umweg ueber `handle_new_user()`
4. **Migrationsdatei auf den tatsaechlich angewandten Weg umgeschrieben** -- `f7b74f7` (fix, nach woertlichen `pg_get_functiondef`-Belegen des Koordinators)

Dazwischen zwei Dokumentations-Commits: `f965ef5` (Blocker vermerkt, vor der Anwendung), `9ad80ea` (WINDOWS.md id 16/17).

**Plan-Abschluss:** dieser Commit (SUMMARY + State/Roadmap/Requirements)

## Woertliche Testausgaben (Aufgabe 2, Koordinator, 18.08.2026)

Alle drei Faelle in EINER Transaktion mit erzwungenem Rollback gegen `trgjhmbnodoarnfmlcqx`; eine Vorher-Probe gegen die unveraenderte Funktion lief zusaetzlich, um den Testaufbau selbst zu beweisen:

```
T1 E-Mail-Registrierung:  DURCHGELASSEN + Profil angelegt   [SOLL]
T2 Discord-Registrierung: ABGEWIESEN                        [SOLL]
   -> "Zu diesem Discord-Konto gibt es noch kein Konto auf verse-base.com.
       Registriere dich zuerst mit E-Mail und Passwort und verknuepfe
       Discord danach in deinem Konto."
T3 Discord an bestehendes Konto verknuepfen:
   DURCHGELASSEN + Spiegel gesetzt                          [SOLL]
```

Ruckstandskontrolle danach: 7 Nutzer, 7 Profile -- unveraendert; 0 Probe-Nutzer, 0 Probe-Identitaeten, 0 Spiegelzeilen.

**3 von 3 Faellen gefahren, 3 von 3 im Soll.**

## Files Created/Modified

- `supabase/migrations/20260818002000_block_discord_signup.sql` -- beschreibt jetzt exakt den angewandten Zustand: `create or replace function public.handle_new_user()` mit dem D-02-Riegel als erste Bedingung, keine Trigger-DDL (der bestehende `on_auth_user_created` bleibt unberuehrt), Rueckbau-Block mit der vorherigen Fassung, `SET search_path TO ''`-Warnung, 42501-Befund als Kommentarblock.

## Decisions Made

- **Riegel in `public.handle_new_user()` statt eigenem Trigger** (siehe `key-decisions` in der Frontmatter) -- erzwungen durch `ERROR 42501: must be owner of relation users`, nicht durch Bequemlichkeit. Drei Wege wurden dem Betreiber mit Preisen vorgelegt (Funktion erweitern / Supabase-Auth-Hook / Dashboard-Trigger); er hat die Funktionserweiterung gewaehlt.
- **Meldungstext ohne Vorschau-Begruendung** -- Korrektur nach Koordinator-Ruecklauf, siehe Frontmatter.
- **Migrationsdatei aendert ausschliesslich die Funktion** -- kein Versuch, den bestehenden Trigger zu droppen oder neu anzulegen; das wuerde an derselben 42501-Sperre scheitern.

## Deviations from Plan

### Auto-fixed / Architecture Pivot (Rule 4, mit Betreiber-Entscheidung)

**1. [Rule 4 - Architectural] Eigener Trigger auf auth.users nicht anlegbar -- Riegel in bestehende Funktion verlegt**
- **Found during:** Aufgabe 2, erster `apply_migration`-Versuch
- **Issue:** Der von 14-03-PLAN.md Aufgabe 1 vorgegebene Bauplan (`create trigger trg_block_discord_signup before insert on auth.users`) scheiterte an `ERROR 42501: must be owner of relation users` -- `auth.users` gehoert der von Supabase verwalteten Rolle `supabase_auth_admin`, nicht der Rolle, mit der Migrationen laufen.
- **Fix:** Der Koordinator hat dem Betreiber drei Wege mit Preisen vorgelegt; gewaehlt wurde die Erweiterung der bestehenden, `postgres`-eigenen Funktion `public.handle_new_user()` um den Riegel als erste Bedingung. Wirkung identisch (Postgres rollt bei einer Ausnahme in einem AFTER-Trigger die gesamte Transaktion zurueck), nur an einer tatsaechlich beschreibbaren Stelle.
- **Files modified:** `supabase/migrations/20260818002000_block_discord_signup.sql` (vollstaendig umgeschrieben, `f7b74f7`)
- **Verification:** Drei SQL-Gegenproben (siehe oben), `npm run build && npm run gate` 18/18 nach jeder Ueberarbeitung.
- **Committed in:** `f7b74f7`

**2. [Rule 1 - Bug/Text] Meldungstext begruendete die Absage falsch**
- **Found during:** Koordinator-Ruecklauf nach Aufgabe 1 (Befund 1)
- **Issue:** Die urspruengliche Meldung ("Für diese Vorschau...") setzte Vorschau-Wissen voraus, das ein Nutzer im normalen Konto-Bereich von verse-base.com (D-01: Discord ist ein zweiter Anmeldeweg FUER DIE SEITE, nicht nur fuer staging) weder hat noch braucht.
- **Fix:** Text auf reine Handlungsanweisung umgestellt, ohne Vorschau-Begruendung.
- **Files modified:** `supabase/migrations/20260818002000_block_discord_signup.sql`
- **Verification:** `npm run build && npm run gate` 18/18.
- **Committed in:** `f2a6e46`

**3. [Rule 2 - Missing Critical] Nachweislücke (b) nicht explizit gefuehrt**
- **Found during:** Koordinator-Ruecklauf nach Aufgabe 1 (Befund 2)
- **Issue:** Die geplanten SQL-Gegenproben beweisen nur, dass der Riegel blockt (a) -- nicht, dass der formulierte Text beim Nutzer im Browser ankommt, statt von GoTrue generisch verpackt zu werden (b). Ohne expliziten Nachweispunkt waere (b) stillschweigend als erledigt mitgezaehlt worden, sobald (a) gruen ist.
- **Fix:** (b) als eigener `coverage`-Eintrag (D3 oben) und als `.planning/WINDOWS.md` id 16 gefuehrt, mit explizitem Pruefweg (echter Discord-Signup im Browser, erst ab Plan 14-04) und der Festlegung, dass ein Fehlschlagen von (b) NICHT den Riegel aendert, sondern ein Oberflaechen-Punkt fuer Plan 14-04 ist.
- **Files modified:** `.planning/WINDOWS.md` (`9ad80ea`), diese SUMMARY
- **Committed in:** `9ad80ea`

---

**Total deviations:** 1 architektonischer Pivot (Rule 4, Betreiber-Entscheidung, technisch erzwungen), 2 auto-fixed (1 Text-Bug, 1 fehlender Nachweispunkt)
**Impact on plan:** Der Pivot war nicht vermeidbar (Plattform-Beschraenkung, gemessen) und wurde vor jeder Anwendung mit dem Betreiber abgestimmt. Die Wirkung von D-02 ist identisch zum urspruenglichen Plan; nur der Ort im Code hat sich geaendert. Kein Scope-Creep.

## Issues Encountered

- **Kein Datenbankzugriff in der Ausfuehrungssitzung** (kein `SUPABASE_ACCESS_TOKEN`, keine Supabase-CLI) -- wie von den `critical_notes` des Plans verlangt, wurde nichts selbst an die Datenbank angewendet. Aufgabe 2 wurde vollstaendig vom Koordinator ueber die Management API gefahren, mit den woertlichen Ausgaben oben zurueckgemeldet.
- **Das automatisierte `<verify>` aus 14-03-PLAN.md Aufgabe 1 ist jetzt strukturell veraltet** -- es prueft woertlich auf den String `before insert on auth.users`, der die tatsaechlich angewandte Architektur nicht mehr beschreibt. Das ist erwartet und in der Migrationsdatei selbst dokumentiert (Kopfkommentar), nicht ein uebersehener Fehler. Ersatzverifikation sind die drei SQL-Gegenproben (Aufgabe 2) plus `npm run build && npm run gate` (18/18, mehrfach nach jeder Ueberarbeitung gefahren).
- **Zwei Nachweispunkte bleiben offen**, beide als `.planning/WINDOWS.md`-Eintraege gefuehrt (id 16, id 17) statt stillschweigend als erledigt gezaehlt -- siehe `coverage` D3/D4 oben.

## User Setup Required

None fuer diesen Plan direkt. Die vier echten Anmeldevorgaenge (WINDOWS.md id 17) und der echte Discord-Signup-Versuch (WINDOWS.md id 16, erst ab Plan 14-04 moeglich) sind Sichtpunkte fuer den Betreiber, keine Umgebungskonfiguration.

## Next Phase Readiness

- Der D-02-Riegel ist live und in drei Richtungen vorgefuehrt rot -- Plan 14-04 (Discord-Provider einrichten + Torseite) kann darauf aufbauen, OHNE dass ein unbekanntes Discord-Konto je still ein Site-Konto anlegen kann.
- **Vertragspunkt fuer Plan 14-04** (aus 14-03-PLAN.md `artifacts_produced` unveraendert gueltig): ein abgelehnter Discord-Anmeldeversuch kommt im Browser als OAuth-Fehler zurueck (bei `flowType: 'implicit'` im URL-Fragment). Plan 14-04 muss diesen Fall auf der Torseite UND in `AuthLogin.astro` in eine verstaendliche Anzeige uebersetzen, statt einen nackten Serverfehler zu zeigen -- UND muss dabei klaeren, ob GoTrue den hier formulierten Text durchreicht oder generisch verpackt (WINDOWS.md id 16 direkt an Plan 14-04 uebergeben, inkl. der Festlegung: ein Fehlschlagen von (b) aendert NICHT den Riegel, sondern ist ein Oberflaechen-Punkt).
- `trg_sync_discord_identity` aus Plan 02 ist jetzt real (nicht nur logisch) bestaetigt -- 14-02-SUMMARY.md coverage D6 kann als geschlossen gelten.
- Kein Blocker fuer die Fortsetzung der Phase. Zwei offene Sichtpunkte (WINDOWS.md id 16, id 17) sind an den Betreiber uebergeben, keiner davon blockiert Plan 14-04.

---
*Phase: 14-testpilot-zugang-staging-hinter-der-discord-rolle*
*Completed: 2026-08-18*

## Self-Check: PASSED

Migrationsdatei (`supabase/migrations/20260818002000_block_discord_signup.sql`) und diese SUMMARY.md auf der Platte gefunden; alle sechs zitierten Commit-Hashes (`abda325`, `f965ef5`, `f2a6e46`, `9ad80ea`, `f7b74f7`, `a677f0e`) im Verlauf des Zweigs `claude/staging-tester-role-access-308ebf` gefunden. `npm run build && npm run gate` zuletzt nach `f7b74f7` grün (18/18, Schiene A). Anwendung auf die lebende Anlage vom Koordinator über die Management API bestätigt (drei SQL-Gegenproben, wörtliche Ausgaben oben); die zwei offenen Nachweispunkte (b) und die vier echten Anmeldevorgänge sind als `.planning/WINDOWS.md` id 16/17 dokumentiert, nicht als erledigt behauptet.
