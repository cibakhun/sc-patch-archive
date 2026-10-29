-- Testpilot-Zugang (Phase 14, Plan 03): Riegel gegen die stille
-- Kontoerstellung ueber den Discord-Weg (D-02).
--
-- ⚠⚠ GEFAEHRLICHSTE STELLE DER GANZEN PHASE. Diese Funktion laeuft bei JEDER
-- Registrierung jedes Kontos -- ein Fehler hier wirkt sich nicht lokal aus,
-- sondern auf jede Neuanmeldung, egal ueber welchen Weg. Vorgefuehrt rot in
-- alle drei Richtungen (14-03-PLAN.md Aufgabe 2) VOR dem Anwenden; die
-- woertlichen Testausgaben stehen in 14-03-SUMMARY.md.
--
-- ============================================================================
-- ⚠ WARUM DIESE DATEI NICHT DAS TUT, WAS SIE URSPRUENGLICH SOLLTE
-- ============================================================================
-- Geplant war ein EIGENER Trigger `trg_block_discord_signup`, `before insert
-- on auth.users` (siehe Git-Historie dieser Datei, Commits abda325/f2a6e46).
-- Das ist auf der verwalteten Supabase-Plattform NICHT umsetzbar -- gemessen,
-- nicht vermutet:
--
--   apply_migration(block_discord_signup) ->
--   ERROR: 42501: must be owner of relation users
--
-- `auth.users` gehoert der Rolle `supabase_auth_admin`. Die Rolle, mit der
-- Migrationen ueber die Management API laufen, darf dort weder einen Trigger
-- ANLEGEN noch einen bestehenden DROPPEN -- die zweite Einschraenkung ist
-- ebenso wichtig wie die erste: diese Datei darf auch nie versuchen, den
-- bestehenden Trigger `on_auth_user_created` zu droppen oder neu anzulegen,
-- das scheitert an DERSELBEN 42501-Sperre.
--
-- Der Betreiber wurde mit drei Wegen konfrontiert (Funktion erweitern /
-- Supabase-Auth-Hook / Trigger von Hand im Dashboard anlegen), samt Preisen,
-- und hat sich fuer den ersten entschieden: die bereits bestehende Funktion
-- `public.handle_new_user()` um den Riegel als ERSTE Bedingung erweitern.
-- Diese Funktion:
--   - wird von einem Trigger `on_auth_user_created` aufgerufen, der auf
--     `auth.users` bereits existiert -- angelegt von der allerersten
--     Migration dieses Projekts (`accounts_profiles_favorites`, 18.07.2026,
--     selbst NICHT im Repo, wie die meisten der 24 lebenden Migrationen).
--   - gehoert der Rolle `postgres`, ist also AENDERBAR (`create or replace
--     function` statt der table-DDL, an der `auth.users` scheitert).
--   - laeuft AFTER INSERT bei jeder Registrierung. Eine `raise exception`
--     darin rollt die GESAMTE Transaktion zurueck, einschliesslich der
--     `auth.users`-Zeile, die der (fremd-eigentuemliche) INSERT gerade erst
--     angelegt hat -- Postgres macht bei einer unbehandelten Ausnahme in
--     einem AFTER-Trigger den gesamten auslösenden Vorgang rueckgaengig.
--     Wirkung also IDENTISCH zum urspruenglich geplanten BEFORE-INSERT-
--     Trigger, nur an einer anderen, tatsaechlich beschreibbaren Stelle.
--
-- Diese Migration aendert AUSSCHLIESSLICH die Funktion. Sie legt KEINEN
-- Trigger an und droppt KEINEN -- `on_auth_user_created` bleibt unberuehrt
-- im Bestand und wird hier bewusst nicht erwaehnt in einer DDL-Anweisung.
--
-- Angewandt ueber die Supabase Management API (nicht `supabase db push`,
-- siehe 14-02-SUMMARY.md "Migrationsweg" -- derselbe, bereits etablierte Weg)
-- unter dem Anlagennamen `block_discord_signup_in_handle_new_user`. Dieser
-- Dateiname und der Anlagenname dieser Migration decken sich NICHT -- wie in
-- diesem Projekt durchgaengig (14-CONTEXT.md, "Der Migrationsverlauf deckt
-- sich nicht").
--
-- ============================================================================
-- Was der Riegel tut (unveraendert in der Wirkung, D-02)
-- ============================================================================
-- D-02: "Der Discord-Knopf meldet nur an, er legt nie ein Konto an." Wer sich
-- ueber Discord anmeldet und noch KEIN Site-Konto hat, bekommt eine Absage
-- statt eines still erzeugten Kontos -- der Betreiber behaelt damit von jedem
-- Testpiloten eine bestaetigte E-Mail-Adresse (Grund fuer D-02, siehe
-- 14-CONTEXT.md).
--
-- Die Bedingung ist exakt EIN Zweig, eng gefasst: greift NUR, wenn
-- new.raw_app_meta_data ->> 'provider' = 'discord'. In JEDEM anderen Fall
-- (email-Registrierung, spaeteres Anlegen anderer Provider) laeuft die
-- Funktion unveraendert weiter zum Profil-Insert -- kein zweiter Zweig, keine
-- Ausnahmeliste, kein Umgebungsschalter. Bewusst NICHT eingebaut
-- (14-03-PLAN.md, Aufgabe 1): eine Ausnahme fuer den ersten Nutzer, eine
-- Liste erlaubter Discord-IDs, ein Env-Flag -- jede davon waere ein zweiter
-- Schluessel neben der Tuer.
--
-- ⚠ Der Meldungstext wurde nach Koordinator-Ruecklauf korrigiert (Befund 1,
-- 18.08.2026): der Riegel wirkt site-weit (auch auf verse-base.com selbst,
-- nicht nur auf staging -- D-01 macht Discord zum zweiten Anmeldeweg FUER DIE
-- SEITE). Der Satz begruendet deshalb nichts mehr mit Vorschau-Wissen,
-- sondern sagt nur, was zu tun ist.
--
-- ============================================================================
-- Warum linkIdentity NICHT getroffen wird -- die tragende Annahme
-- ============================================================================
-- Der Trigger `on_auth_user_created`, der diese Funktion aufruft, sitzt auf
-- `auth.users`, nicht auf `auth.identities`. Wenn ein Nutzer, der bereits ein
-- Konto per E-Mail hat, danach seinen Discord-Account VERKNUEPFT
-- (supabase-js `linkIdentity()`, oder Supabase's automatische Verknuepfung
-- bei uebereinstimmender E-Mail-Adresse), legt Supabase dafuer KEINE neue
-- Zeile in `auth.users` an -- die Zeile existiert bereits, nur
-- `auth.identities` bekommt einen neuen Eintrag mit provider = 'discord'.
-- `handle_new_user()` wird fuer diesen Vorgang gar nicht aufgerufen, weil
-- ihr Trigger nur auf INSERT-Ereignisse von `auth.users` reagiert.
--
-- Genau das ist der Vorteil dieser Bauform: die Funktion laeuft
-- ausschliesslich dann, wenn Supabase im Begriff ist, ueber den Discord-Weg
-- ein NEUES Konto in `auth.users` anzulegen -- wortwoertlich der Fall, den
-- D-02 verbietet. Der `trg_sync_discord_identity`-Trigger aus Plan 02
-- (supabase/migrations/20260818000000_discord_tester_gate.sql, AFTER INSERT
-- ON auth.identities) spiegelt die Discord-ID unabhaengig davon weiter, ob
-- die Identitaet aus einer Neuanmeldung oder aus einer Verknuepfung stammt --
-- dieser Riegel kommt ihm nicht in die Quere, weil er auf einer anderen
-- Tabelle sitzt.
--
-- Aufgabe 2 hat diese Annahme GEMESSEN, nicht geglaubt: ein `insert into
-- auth.identities` mit provider = 'discord' auf ein BESTEHENDES Konto ging
-- durch, loeste den Riegel nicht aus, UND setzte
-- `discord_role_state.discord_user_id` ueber `trg_sync_discord_identity`
-- korrekt -- der erste tatsaechliche (nicht nur logisch erschlossene)
-- Nachweis fuer diesen Trigger aus Plan 02 (schliesst eine offene
-- Zusicherung aus 14-02-SUMMARY.md, coverage D6). Woertliche Testausgaben in
-- 14-03-SUMMARY.md.
--
-- ============================================================================
-- Warum kein Auth-Hook "Before User Created" (RESEARCH.md Open Question 1)
-- ============================================================================
-- Supabase bietet fuer genau diesen Anwendungsfall einen offiziellen
-- "Before User Created"-Auth-Hook an. Er wurde bewusst NICHT gewaehlt (einer
-- von drei dem Betreiber vorgelegten Wegen, siehe oben):
--   1. Die Verfuegbarkeit auf dem gebuchten Supabase-Tarif ist unbelegt
--      (RESEARCH.md Assumption A1) -- eine `postgres`-eigene Funktion braucht
--      keine Tarif-Freischaltung.
--   2. Ein Auth-Hook lebt im Supabase-Dashboard (Konfiguration ausserhalb
--      des Repos), nicht in einer versionierten Migration -- er waere bei
--      einem Blick ins Repo unsichtbar und liesse sich nicht "vorgefuehrt
--      rot" gegen die Anlage fahren, wie es CLAUDE.md fuer jede neue
--      Sicherung verlangt.
--   3. RESEARCH.md Open Question 1 weist darauf hin, dass unklar ist, ob eine
--      Hook-Implementierung `linkIdentity` zuverlaessig von einer echten
--      Discord-Neuanmeldung unterscheidet -- die Bauform hier loest dieses
--      Problem strukturell (siehe Absatz oben), nicht durch eine
--      zusaetzliche Bedingung, die es falsch treffen koennte.
-- Ein Trigger von Hand im Supabase-Dashboard (dritter vorgelegter Weg) haette
-- dasselbe Sichtbarkeits-/Versionierungsproblem wie der Auth-Hook gehabt.
-- Die Funktionserweiterung ist stattdessen versioniert, wandert mit den
-- Migrationen mit und ist gegen die lebende Anlage rot fahrbar (Aufgabe 2) --
-- das war die entscheidende Abwaegung.
--
-- ============================================================================
-- ⚠ WARNUNG fuer jeden, der diese Funktion spaeter erweitert
-- ============================================================================
-- `SET search_path TO ''` -- LEERER Suchpfad, nicht `public` wie bei den
-- Migrationen aus Plan 02. JEDE Referenz muss deshalb voll qualifiziert sein
-- (`public.profiles`, niemals nur `profiles`) -- ein unqualifizierter Name
-- schlaegt hier nicht etwa fehl, weil ihn niemand findet, sondern koennte
-- sich (bei einer boesartig plazierten gleichnamigen Relation in einem
-- fuer den Aufrufer beeinflussbaren Schema) auf ETWAS ANDERES auflösen als
-- gemeint -- genau die search_path-Umlenkung, vor der T-14-22
-- (14-03-PLAN.md Threat Register) warnt. Diese Datei haelt sich bereits
-- daran (`public.profiles`); jede kuenftige Ergaenzung MUSS es auch.
--
-- ============================================================================
-- ANGEWANDTE FASSUNG (pg_get_functiondef, 18.08.2026, nach dem Anwenden --
-- Koordinator-Beleg, woertlich uebernommen)
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- D-02: nur der Discord-Provider wird abgewiesen. Jeder andere Provider
  -- (email, spaetere Ergaenzungen) ist unberuehrt. linkIdentity() schreibt
  -- ausschliesslich nach auth.identities und loest diesen Trigger nie aus --
  -- ein bestehendes Konto darf Discord also weiterhin verknuepfen (D-01).
  if new.raw_app_meta_data ->> 'provider' = 'discord' then
    raise exception 'Zu diesem Discord-Konto gibt es noch kein Konto auf verse-base.com. Registriere dich zuerst mit E-Mail und Passwort und verknuepfe Discord danach in deinem Konto.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Ab hier zeichengleich die bisherige Fassung (siehe RUECKBAU unten).
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

comment on function public.handle_new_user() is
  'D-02 (14-03-PLAN.md): weist die stille Kontoerstellung ueber den '
  'Discord-Weg ab, bevor das Konto-Profil angelegt wird. Aufgerufen vom '
  'bestehenden Trigger on_auth_user_created (AFTER INSERT ON auth.users, '
  'nicht Teil dieser Migration -- siehe Kopfkommentar der Datei fuer den '
  '42501-Befund, der diese Bauform statt eines eigenen Triggers erzwingt). '
  'SET search_path TO ''''; jede Referenz MUSS voll qualifiziert sein.';

-- ============================================================================
-- RUECKBAU -- Fassung VOR dieser Migration (pg_get_functiondef, ebenfalls
-- 18.08.2026, VOR dem Anwenden geholt). Bei Bedarf 1:1 zurueckspielen --
-- entfernt den Riegel wieder vollstaendig und stellt den Vorzustand her,
-- OHNE Archaeologie:
--
-- create or replace function public.handle_new_user()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path to ''
-- as $function$
-- begin
--   insert into public.profiles (id, display_name)
--   values (
--     new.id,
--     left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)), 60)
--   )
--   on conflict (id) do nothing;
--   return new;
-- end;
-- $function$;
--
-- Der Unterschied zur angewandten Fassung ist GENAU der if-Block plus zwei
-- Kommentarzeilen -- das Profil-Insert ist zeichengleich, vergleichbar durch
-- direktes Gegenlesen der beiden Bloecke in dieser Datei.
-- ============================================================================

-- ============================================================================
-- Trigger-Bestand (NICHT Teil dieser Migration, nur zur Einordnung):
--   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION handle_new_user()
-- Eigentuemer auth.users: supabase_auth_admin (--> 42501 fuer jede Trigger-
-- DDL). Eigentuemer public.handle_new_user: postgres (--> aenderbar). Dieser
-- Trigger existiert bereits seit der allerersten Migration des Projekts
-- (`accounts_profiles_favorites`, 18.07.2026, nicht im Repo) und wird von
-- dieser Datei absichtlich weder erwaehnt noch angefasst.
-- ============================================================================
