-- Admin-Rechte nur mit zweitem Faktor (aal2) (30.10.2026). Noch NICHT live
-- eingespielt. ERST einspielen, wenn das Admin-Konto im Konto unter
-- "Sicherheit" einen Authenticator eingerichtet hat (am besten zwei Geraete)
-- und mit Code angemeldet ist. Abschnitt 0 prueft genau das und bricht sonst
-- ab, ohne etwas zu aendern.
--
-- Ausserdem erst, wenn die Code-Abfrage (Anmeldung, Konto) auch auf main
-- ausgeliefert ist, nicht nur auf staging: Die Datenbank ist geteilt, und
-- eine Sitzung gilt nur fuer ihre Adresse. Ohne Code-Abfrage auf
-- verse-base.com bleibt eine Admin-Anmeldung dort auf aal1, und Spenden,
-- Spendenstand und Testpiloten-Liste gingen auf der Live-Seite nicht mehr.
-- Diese Bedingung prueft Abschnitt 0 nicht.
--
-- AUSGANGSLAGE: Die Admin-Pfade pruefen nur public.user_roles.role = 'admin':
-- donations (Lesen), support_progress (Anlegen/Aendern), tester_overview()
-- und der Admin-Zweig von gate_verdict(). Seit sec/haertung bietet das Konto
-- TOTP an (supabase.auth.mfa), und Anmeldeseite, Konto, "Passwort
-- zuruecksetzen" und Torseite fragen den Code ab, sobald ein Konto einen
-- bestaetigten Faktor hat. Supabase traegt das Ergebnis als Claim aal in das
-- signierte Sitzungs-JWT ein: 'aal1' nach Passwort oder Discord, 'aal2' nach
-- dem Code. Ein Auffrischen der Sitzung behaelt die Stufe.
--
-- WAS SICH AENDERT
--   1. donations_select_admin, support_progress_insert_admin,
--      support_progress_update_admin: zusaetzlich auth.jwt()->>'aal' = 'aal2'.
--      Ohne zweiten Faktor sieht ein Admin keine Spenden und schreibt nichts
--      (PostgREST: leere Antwort; SupportBody meldet "Nicht gespeichert").
--   2. tester_overview(): ohne aal2 eine Absage (42501, hint 'aal2'); das
--      Konto zeigt dann einen Hinweis mit "Code eingeben" statt der Liste.
--   3. gate_verdict(): der Admin-Zweig gilt nur mit aal2. KEINE Absage ohne
--      aal2 -- dann wird das Konto wie jedes andere geprueft (Sperrliste,
--      Testpilot-Rolle). Ein Admin, der auch Testpilot ist, kommt so auch mit
--      aal1 in die Vorschau, nur nicht mehr an der Sperrliste vorbei.
--   Rechte (GRANT/REVOKE) aendert diese Datei nicht; create or replace
--   behaelt die bestehenden.
--
-- GRUNDLAGE der beiden Funktionen: tester_overview ist die Live-Fassung vom
-- 29.10.2026, gate_verdict die Fassung aus
-- 20261030131000_sperrliste_discord_id.sql (Sperrliste auch nach
-- Discord-ID). Abschnitt 0 vergleicht den live stehenden Quelltext (md5,
-- ohne CR) mit genau diesen Fassungen. Steht etwas anderes da (die
-- Sperrlisten-Migration fehlt oder wurde inzwischen geaendert), bricht die
-- Migration ab, statt fremde Aenderungen still zurueckzudrehen. Dann diese
-- Datei auf den neuen Stand umbauen: im Admin-Zweig kommt nur die
-- aal2-Bedingung dazu.
--
-- WAS ES FUER DIE SEITE BEDEUTET: fuer Nutzer nichts. Fuer das Admin-Konto:
-- Admin-Funktionen nur nach Anmeldung mit Code. Wer alle Authenticator-
-- Geraete verliert, kommt nicht mehr auf aal2, und Wiederherstellungscodes
-- bietet die Anmeldung nicht an. Ausweg: Supabase-Dashboard ->
-- Authentication -> Users -> Konto -> MFA-Faktor entfernen, danach neu
-- einrichten; oder den Rueckbau unten einspielen.
--
-- VOR DEM EINSPIELEN (nur Anzahlen):
--   select (select count(*) from public.user_roles where role = 'admin') as admins,
--          (select count(*) from public.user_roles r join auth.mfa_factors f on f.user_id = r.user_id
--            where r.role = 'admin' and f.factor_type = 'totp' and f.status = 'verified') as admin_faktoren,
--          (select count(*) from public.user_roles r join auth.sessions s on s.user_id = r.user_id
--            where r.role = 'admin' and s.aal = 'aal2') as admin_sitzungen_mit_code;
-- Live am 29.10.2026: 1 Admin, 0 Faktoren, 0 Sitzungen mit Code.

-- -------------------------------------------- 0. Vorbedingungen -------------
do $vorbedingung$
declare
  v_ohne_faktor int;
  v_ohne_sitzung int;
  v_einzeln int;
  v_gate text;
  v_overview text;
begin
  select count(*) into v_ohne_faktor
  from public.user_roles r
  where r.role = 'admin'
    and not exists (select 1 from auth.mfa_factors f
                    where f.user_id = r.user_id and f.factor_type = 'totp' and f.status = 'verified');
  if v_ohne_faktor > 0 then
    raise exception 'admin_second_factor: % Admin-Konto/-Konten ohne bestaetigten TOTP-Faktor -- erst im Konto unter Sicherheit einrichten', v_ohne_faktor;
  end if;

  select count(*) into v_ohne_sitzung
  from public.user_roles r
  where r.role = 'admin'
    and not exists (select 1 from auth.sessions s where s.user_id = r.user_id and s.aal = 'aal2');
  if v_ohne_sitzung > 0 then
    raise exception 'admin_second_factor: % Admin-Konto/-Konten ohne Sitzung mit Code (aal2) -- erst mit Code anmelden und angemeldet bleiben', v_ohne_sitzung;
  end if;

  select count(*) into v_einzeln
  from public.user_roles r
  where r.role = 'admin'
    and (select count(*) from auth.mfa_factors f
         where f.user_id = r.user_id and f.factor_type = 'totp' and f.status = 'verified') < 2;
  if v_einzeln > 0 then
    raise warning 'admin_second_factor: % Admin-Konto/-Konten mit nur EINEM Faktor -- ein zweites Geraet wird empfohlen', v_einzeln;
  end if;

  select md5(replace(p.prosrc, chr(13), '')) into v_gate
  from pg_catalog.pg_proc p where p.oid = 'public.gate_verdict()'::regprocedure;
  if v_gate not in ('3ba3588b88485118649c120f694ffbb0',   -- 20261030131000
                    '73fa946bead70240ba44cedc0009a484') then -- diese Fassung (erneuter Lauf)
    raise exception 'admin_second_factor: gate_verdict live (md5 %) ist nicht die erwartete Grundlage -- Datei auf den Live-Stand umbauen', v_gate;
  end if;

  select md5(replace(p.prosrc, chr(13), '')) into v_overview
  from pg_catalog.pg_proc p where p.oid = 'public.tester_overview()'::regprocedure;
  if v_overview not in ('0b9a80bd265116da8ca674fc374d6fe5',   -- live 29.10.2026
                        'dd6e1df0cd5da07388e620e3a40a83e8') then -- diese Fassung (erneuter Lauf)
    raise exception 'admin_second_factor: tester_overview live (md5 %) ist nicht die erwartete Grundlage -- Datei auf den Live-Stand umbauen', v_overview;
  end if;
end
$vorbedingung$;

-- -------------------------------------------- 1. Policies -------------------
alter policy donations_select_admin on public.donations
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (select 1 from public.user_roles r
                where r.user_id = (select auth.uid()) and r.role = 'admin')
  );

alter policy support_progress_insert_admin on public.support_progress
  with check (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (select 1 from public.user_roles r
                where r.user_id = (select auth.uid()) and r.role = 'admin')
  );

alter policy support_progress_update_admin on public.support_progress
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (select 1 from public.user_roles r
                where r.user_id = (select auth.uid()) and r.role = 'admin')
  )
  with check (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (select 1 from public.user_roles r
                where r.user_id = (select auth.uid()) and r.role = 'admin')
  );

-- -------------------------------------------- 2. tester_overview ------------
-- Live-Fassung vom 29.10.2026, dazu nur die aal2-Pruefung nach der
-- Admin-Pruefung (Nicht-Admins bekommen weiter die Admin-Absage).
create or replace function public.tester_overview()
returns json
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_uid uuid := auth.uid();
begin
  -- Die Rechtepruefung sitzt IN der Funktion, nicht im Grant, damit ein
  -- Nicht-Admin eine klare Absage bekommt statt einer leeren Liste.
  if not exists (
    select 1 from public.user_roles
    where user_id = v_uid and role = 'admin'
  ) then
    raise exception 'tester_overview() ist nur fuer admin-Konten zugaenglich'
      using errcode = 'insufficient_privilege';
  end if;

  -- Seit dem 30.10. nur mit zweitem Faktor. Der Hinweis 'aal2' laesst das
  -- Konto die Absage von der Admin-Absage unterscheiden.
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'tester_overview() verlangt eine Anmeldung mit zweitem Faktor'
      using errcode = 'insufficient_privilege', hint = 'aal2';
  end if;

  return (
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
    from (
      select
        p.handle,
        p.display_name,
        d.discord_user_id,
        d.is_tester,
        d.last_staging_seen
      from public.discord_role_state d
      join public.profiles p on p.id = d.user_id
      where d.is_tester = true
      order by d.last_staging_seen desc nulls last
    ) t
  );
end;
$function$;

-- -------------------------------------------- 3. gate_verdict ---------------
-- Fassung aus 20261030131000_sperrliste_discord_id.sql, geaendert nur
-- Schritt 2 (aal2 als zusaetzliche Bedingung, keine Absage).
create or replace function public.gate_verdict()
returns json
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_uid    uuid := auth.uid();
  v_reason text;
begin
  -- 1. Keine Sitzung -> kein Zugang.
  if v_uid is null then
    return json_build_object('allowed', false, 'grund', 'keine-sitzung');
  end if;

  -- 2. Admin-Aussperr-Riegel (D-04) -- haengt an keiner Discord-Bedingung UND
  --    seit dem 20.08. auch an keinem Sperrlisteneintrag. Seit dem 30.10. nur
  --    mit zweitem Faktor (aal2); ohne ihn gilt fuer ein Admin-Konto, was fuer
  --    alle gilt (Sperrliste, Testpilot-Rolle).
  if coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and exists (
    select 1 from public.user_roles
    where user_id = v_uid and role = 'admin'
  ) then
    v_reason := 'admin';

  -- 3. Sperrliste (D-10) -- Sofort-Rauswurf fuer alle ausser Admins. Greift
  --    an der Konto-ID und seit dem 30.10. auch an jeder Discord-Identitaet,
  --    die das Konto gerade verbunden hat.
  elsif exists (
    select 1 from public.tester_blocklist b
    where b.user_id = v_uid
       or (b.discord_user_id is not null and b.discord_user_id in (
             select i.provider_id from auth.identities i
             where i.user_id = v_uid and i.provider = 'discord'))
  ) then
    return json_build_object('allowed', false, 'grund', 'gesperrt');

  -- 4. Discord-Testpilot-Rolle (D-03/D-08). Zaehlt nur, solange die
  --    gespiegelte Discord-ID noch eine verbundene Identitaet des Kontos ist.
  elsif exists (
    select 1 from public.discord_role_state d
    where d.user_id = v_uid and d.is_tester = true
      and exists (
        select 1 from auth.identities i
        where i.user_id = v_uid and i.provider = 'discord'
          and i.provider_id = d.discord_user_id)
  ) then
    v_reason := 'tester';
  else
    return json_build_object('allowed', false, 'grund', 'kein-testpilot');
  end if;

  insert into public.discord_role_state (user_id, last_staging_seen)
  values (v_uid, now())
  on conflict (user_id) do update
    set last_staging_seen = excluded.last_staging_seen;

  return json_build_object(
    'allowed', true,
    'grund', v_reason,
    'sub', v_uid,
    'exp_hint', 300
  );
end;
$function$;

-- -------------------------------------------- 4. Selbstpruefung -------------
do $pruefung$
begin
  if (select count(*) from pg_catalog.pg_policies
       where (schemaname, tablename, policyname) in (
               ('public', 'donations', 'donations_select_admin'),
               ('public', 'support_progress', 'support_progress_insert_admin'),
               ('public', 'support_progress', 'support_progress_update_admin'))
         and coalesce(qual, '') || coalesce(with_check, '') like '%aal2%') <> 3 then
    raise exception 'admin_second_factor: nicht alle drei Admin-Policies verlangen aal2';
  end if;
  if (select count(*) from pg_catalog.pg_proc
       where oid in ('public.tester_overview()'::regprocedure, 'public.gate_verdict()'::regprocedure)
         and prosrc like '%''aal2''%') <> 2 then
    raise exception 'admin_second_factor: tester_overview/gate_verdict ohne aal2-Pruefung';
  end if;
end
$pruefung$;

-- ============================================================================
-- RUECKBAU (Admin wieder ohne zweiten Faktor; z. B. wenn alle Geraete weg sind):
--   alter policy donations_select_admin on public.donations
--     using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));
--   alter policy support_progress_insert_admin on public.support_progress
--     with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));
--   alter policy support_progress_update_admin on public.support_progress
--     using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'))
--     with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));
--   tester_overview: den Block "create or replace function
--   public.tester_overview()" aus 20260817192813_gate_verdict.sql (vor
--   der Umbenennung auf die Live-Versionen: 20260818001000_gate_verdict.sql)
--   unveraendert erneut einspielen (= Live-Fassung 29.10.2026, md5
--   0b9a80bd265116da8ca674fc374d6fe5).
--   gate_verdict: Abschnitt 3 ("create or replace function
--   public.gate_verdict()") aus 20261030131000_sperrliste_discord_id.sql
--   unveraendert erneut einspielen (md5 3ba3588b88485118649c120f694ffbb0).
--   Nur die Funktionen von Hand zu aendern (z. B. allein die if-Zeile),
--   laesst die Kommentare stehen; dann passt der md5 in Abschnitt 0 nicht
--   mehr, und ein spaeteres erneutes Einspielen dieser Datei bricht ab.
--   create or replace behaelt die Rechte.
-- Nur einen Faktor entfernen statt Rueckbau: Supabase-Dashboard ->
-- Authentication -> Users -> Konto -> MFA-Faktor loeschen.
-- ============================================================================
