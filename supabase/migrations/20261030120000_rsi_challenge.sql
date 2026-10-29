-- RSI-Verifizierung: der Pruefcode kommt vom Server, das Abzeichen haengt am
-- Handle (30.10.2026). Noch NICHT live eingespielt; der Hauptstrang spielt sie
-- nach Freigabe durch den Betreiber ein, als EINE Transaktion, und zwar VOR
-- dem Deploy der Edge Function verify-rsi aus demselben Commit.
--
-- WAS SICH AENDERT
--   1. private.rsi_challenges: je Konto und RSI-Handle ein Pruefcode der Form
--      VB-XXXX-XXXX-XXXX (48 Zufallsbit aus gen_random_uuid), mit
--      Ausstellzeit, Zeitpunkt der erfolgreichen Pruefung und der letzten
--      Nachpruefung. Ein offener Code gilt 24 Stunden. Ein bestaetigter Code
--      bleibt, solange er in der Bio steht, und wird fuer dasselbe Handle
--      wieder ausgegeben. Hoechstens fuenf offene Codes je Konto.
--   2. private.rsi_attempts: Drosselung, 30 Aufrufe je Konto und Stunde
--      (Code holen, pruefen und nachpruefen zusammen). Das Dashboard prueft
--      bei jedem Besuch eines verifizierten Kontos nach; die Edge Function
--      ruft RSI dafuer hoechstens alle 6 Stunden wirklich ab.
--   3. Vier Funktionen in public, SECURITY DEFINER mit leerem search_path,
--      ausfuehrbar NUR fuer service_role (die Edge Function verify-rsi ruft
--      sie mit dem Service-Key): rsi_rate_ok, rsi_challenge_issue,
--      rsi_challenge_get, rsi_challenge_result. Das Schema private ist ueber
--      die REST-Schnittstelle nicht erreichbar; das ist dieselbe Bauart wie
--      register_rate_ok mit private.register_attempts.
--   4. guard_rsi_verified: aendert ein Client rsi_handle (ohne Ruecksicht auf
--      Gross-/Kleinschreibung) oder rsi_code, faellt rsi_verified in derselben
--      Zeile auf false. service_role bleibt ausgenommen. search_path jetzt
--      leer statt public (auth.jwt() war schon voll qualifiziert).
--   5. Ein verifiziertes RSI-Handle gehoert hoechstens einem Konto
--      (eindeutiger Teilindex). Eine erfolgreiche Pruefung mit einem vom
--      Server ausgestellten Code nimmt das Abzeichen anderen Konten mit
--      demselben Handle ab: den Code in die Bio setzen kann nur, wer das
--      RSI-Profil besitzt. Ein alter Code aus dem Browser kann das nicht; er
--      zaehlt nur, wenn er im eigenen Profil steht, in keinem anderen, und das
--      Handle bei keinem anderen Konto verifiziert ist.
--   6. Laengengrenzen in profiles: rsi_handle hoechstens 60, rsi_code
--      hoechstens 64 Zeichen. Das Dashboard begrenzt das Feld auf 32.
--   7. Bestand: verifizierte Zeilen, deren Handle oder Code keinem gueltigen
--      Format entspricht, und doppelt verifizierte Handles verlieren das
--      Abzeichen. Live am 29.10.2026 gezaehlt: 4 verifizierte Profile, alle
--      im alten Codeformat, kein Treffer. Der Schritt ist eine Absicherung fuer
--      den Fall, dass sich das bis zum Einspielen aendert.
--
-- WAS ES FUER DIE SEITE BEDEUTET
--   * Das neue Dashboard (dieser Commit) holt den Code beim Server, zeigt ihn
--     an und laesst pruefen; Handle und Code schickt es dabei nicht mehr mit.
--   * Das alte Dashboard (main bis zum naechsten Release) laeuft weiter:
--     Speichern, Handle-Wechsel und "Verifizierung aufheben" wie bisher, der
--     Entzug beim Handle-Wechsel passiert jetzt zusaetzlich serverseitig. Seine
--     Erstpruefung mit selbst erzeugtem Code nimmt verify-rsi nur an, solange
--     das Secret RSI_LEGACY_FLOW=1 gesetzt ist (Deploy-Hinweis in
--     supabase/functions/verify-rsi/index.ts).
--   * Schon verifizierte Konten behalten ihr Abzeichen. Bei der naechsten
--     Nachpruefung uebernimmt der Server ihren bisherigen Code als
--     bestaetigten Code, wenn er noch in der RSI-Bio steht; sonst faellt das
--     Abzeichen wie bisher. Gezaehlt wird nur noch der Bio-Abschnitt der
--     Citizen-Seite (supabase/functions/verify-rsi/handler.js, pageVerdict).
--
-- ACHTUNG BEIM TESTEN VON HAND: rsi_challenge_result setzt rsi_verified=true.
-- Der Trigger laesst das nur zu, wenn die JWT-Claims service_role tragen (so
-- ruft PostgREST mit dem Service-Key). Im SQL-Editor ohne Claims bricht es ab.

-- -------------------------------------------- 1./2. Speicher (private) ------
create table private.rsi_challenges (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  handle_key  text        not null,
  rsi_handle  text        not null,
  code        text        not null,
  created_at  timestamptz not null default now(),
  verified_at timestamptz,
  checked_at  timestamptz,
  primary key (user_id, handle_key),
  constraint rsi_challenges_handle_fmt
    check (rsi_handle ~ '^[A-Za-z0-9_-]{3,60}$' and handle_key = lower(rsi_handle)),
  constraint rsi_challenges_code_fmt
    check (code ~ '^(VB-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}|VERSEBASE-VERIFY-[A-Z0-9]{1,6})$')
);
alter table private.rsi_challenges enable row level security;
revoke all on private.rsi_challenges from public, anon, authenticated;

create table private.rsi_attempts (
  id         bigint      generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index rsi_attempts_user_time on private.rsi_attempts (user_id, created_at);
alter table private.rsi_attempts enable row level security;
revoke all on private.rsi_attempts from public, anon, authenticated;
revoke all on sequence private.rsi_attempts_id_seq from public, anon, authenticated;

-- -------------------------------------------- 3. Funktionen (service_role) --
-- Drosselung je Konto. Wie register_rate_ok, aber je Konto serialisiert, damit
-- parallele Aufrufe die Grenze nicht gemeinsam ueberholen.
create or replace function public.rsi_rate_ok(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
begin
  if p_user is null then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rsi_rate:' || p_user::text, 0));
  select count(*) into recent
  from private.rsi_attempts
  where user_id = p_user
    and created_at > now() - interval '1 hour';
  if recent >= 30 then
    return false;
  end if;
  insert into private.rsi_attempts (user_id) values (p_user);
  delete from private.rsi_attempts where created_at < now() - interval '24 hours';
  return true;
end;
$$;

-- Code fuer (Konto, Handle) ausgeben: einen bestehenden (offen und frisch,
-- oder bestaetigt) wieder, sonst einen neuen.
create or replace function public.rsi_challenge_issue(p_user uuid, p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_hex text;
  v_row private.rsi_challenges;
begin
  if p_user is null or p_handle is null or p_handle !~ '^[A-Za-z0-9_-]{3,60}$' then
    raise exception 'rsi_challenge_issue: ungueltige Eingabe' using errcode = '22023';
  end if;
  v_key := lower(p_handle);

  delete from private.rsi_challenges
  where user_id = p_user
    and verified_at is null
    and created_at < now() - interval '24 hours';

  v_hex := upper(replace(pg_catalog.gen_random_uuid()::text, '-', ''));
  insert into private.rsi_challenges as c (user_id, handle_key, rsi_handle, code)
  values (p_user, v_key, p_handle,
          'VB-' || substr(v_hex, 1, 4) || '-' || substr(v_hex, 5, 4) || '-' || substr(v_hex, 9, 4))
  on conflict (user_id, handle_key) do update
    set rsi_handle = excluded.rsi_handle
  returning c.* into v_row;

  delete from private.rsi_challenges
  where user_id = p_user
    and verified_at is null
    and handle_key <> v_key
    and handle_key not in (
      select o.handle_key from private.rsi_challenges o
      where o.user_id = p_user and o.verified_at is null and o.handle_key <> v_key
      order by o.created_at desc
      limit 4);

  return jsonb_build_object(
    'rsi_handle', v_row.rsi_handle,
    'code', v_row.code,
    'confirmed', v_row.verified_at is not null,
    'expires_at', case when v_row.verified_at is null then v_row.created_at + interval '24 hours' end);
end;
$$;

-- Stand fuer eine Pruefung: welches Handle (angefragt oder das des Profils),
-- welcher Code, ob das Profil fuer genau dieses Handle verifiziert ist.
create or replace function public.rsi_challenge_get(p_user uuid, p_handle text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p_handle   text;
  v_p_verified boolean;
  v_p_code     text;
  v_handle     text;
  v_bound      boolean;
  v_row        private.rsi_challenges;
begin
  if p_user is null then
    raise exception 'rsi_challenge_get: ungueltige Eingabe' using errcode = '22023';
  end if;
  select p.rsi_handle, p.rsi_verified, p.rsi_code
    into v_p_handle, v_p_verified, v_p_code
  from public.profiles p
  where p.id = p_user;

  v_handle := coalesce(nullif(p_handle, ''), nullif(v_p_handle, ''));
  if v_handle is null then
    return jsonb_build_object('rsi_handle', null);
  end if;

  select * into v_row
  from private.rsi_challenges c
  where c.user_id = p_user and c.handle_key = lower(v_handle);

  v_bound := coalesce(v_p_verified, false)
             and lower(coalesce(v_p_handle, '')) = lower(v_handle);

  return jsonb_build_object(
    'rsi_handle', coalesce(v_row.rsi_handle, v_handle),
    'code', v_row.code,
    'expired', coalesce(v_row.verified_at is null and v_row.created_at < now() - interval '24 hours', false),
    'confirmed', v_row.verified_at is not null,
    'checked_recently', coalesce(v_row.checked_at > now() - interval '6 hours', false),
    'profile_verified', v_bound,
    'profile_code', case when v_bound then v_p_code end);
end;
$$;

-- Ergebnis einer Pruefung festhalten. p_found = Code stand auf der RSI-Seite.
-- Rueckgabe: verified | revoked | not_found | stale | taken | no_profile.
create or replace function public.rsi_challenge_result(p_user uuid, p_handle text, p_code text, p_found boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_row private.rsi_challenges;
  v_has boolean;
begin
  if p_user is null or p_found is null
     or p_handle is null or p_handle !~ '^[A-Za-z0-9_-]{3,60}$'
     or p_code is null
     or p_code !~ '^(VB-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}|VERSEBASE-VERIFY-[A-Z0-9]{1,6})$' then
    raise exception 'rsi_challenge_result: ungueltige Eingabe' using errcode = '22023';
  end if;
  v_key := lower(p_handle);

  select * into v_row
  from private.rsi_challenges c
  where c.user_id = p_user and c.handle_key = v_key
  for update;
  v_has := found;

  -- Inzwischen wurde ein anderer Code ausgestellt, oder ein VB-Code kommt
  -- nicht aus rsi_challenge_issue: nichts festhalten.
  if (v_has and v_row.code <> p_code) or (not v_has and p_code !~ '^VERSEBASE-VERIFY-') then
    return 'stale';
  end if;

  if not p_found then
    update public.profiles
       set rsi_verified = false
     where id = p_user and rsi_verified and lower(rsi_handle) = v_key;
    if found then
      return 'revoked';
    end if;
    return 'not_found';
  end if;

  -- Ein alter Code aus dem Browser ist nicht an das Konto gebunden. Er zaehlt
  -- nur, wenn er im eigenen Profil steht und sonst nirgends, und er nimmt
  -- keinem anderen Konto ein verifiziertes Handle.
  if not v_has and (
       not exists (select 1 from public.profiles p where p.id = p_user and p.rsi_code = p_code)
       or exists (select 1 from public.profiles p where p.id <> p_user and p.rsi_code = p_code)
       or exists (select 1 from private.rsi_challenges o where o.user_id <> p_user and o.code = p_code)
       or exists (select 1 from public.profiles p
                  where p.id <> p_user and p.rsi_verified and lower(p.rsi_handle) = v_key)) then
    return 'taken';
  end if;

  update public.profiles
     set rsi_verified = false
   where rsi_verified and lower(rsi_handle) = v_key and id <> p_user;

  update public.profiles
     set rsi_handle = coalesce(v_row.rsi_handle, p_handle),
         rsi_code = p_code,
         rsi_verified = true
   where id = p_user;
  if not found then
    return 'no_profile';
  end if;

  insert into private.rsi_challenges as c (user_id, handle_key, rsi_handle, code, verified_at, checked_at)
  values (p_user, v_key, coalesce(v_row.rsi_handle, p_handle), p_code, now(), now())
  on conflict (user_id, handle_key) do update
    set verified_at = coalesce(c.verified_at, now()),
        checked_at = now();

  delete from private.rsi_challenges
  where user_id = p_user and handle_key <> v_key;

  return 'verified';
end;
$$;

revoke all on function public.rsi_rate_ok(uuid) from public, anon, authenticated;
revoke all on function public.rsi_challenge_issue(uuid, text) from public, anon, authenticated;
revoke all on function public.rsi_challenge_get(uuid, text) from public, anon, authenticated;
revoke all on function public.rsi_challenge_result(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.rsi_rate_ok(uuid) to service_role;
grant execute on function public.rsi_challenge_issue(uuid, text) to service_role;
grant execute on function public.rsi_challenge_get(uuid, text) to service_role;
grant execute on function public.rsi_challenge_result(uuid, text, text, boolean) to service_role;

-- -------------------------------------------- 4. Trigger ---------------------
create or replace function public.guard_rsi_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  -- Service Role (Edge Function verify-rsi, Admin-API) darf alles.
  if caller_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Neue Profil-Zeilen starten grundsaetzlich unverifiziert.
    new.rsi_verified := false;
    return new;
  end if;

  -- UPDATE: Das Badge darf clientseitig nur entzogen, nie gesetzt werden.
  if new.rsi_verified is distinct from old.rsi_verified
     and new.rsi_verified = true then
    raise exception 'rsi_verified kann nur nach serverseitiger RSI-Pruefung gesetzt werden'
      using errcode = 'insufficient_privilege';
  end if;

  -- Das Badge gilt fuer genau das gepruefte Handle und den geprueften Code.
  if lower(coalesce(new.rsi_handle, '')) is distinct from lower(coalesce(old.rsi_handle, ''))
     or new.rsi_code is distinct from old.rsi_code then
    new.rsi_verified := false;
  end if;

  return new;
end;
$$;
revoke all on function public.guard_rsi_verified() from public, anon, authenticated;

-- -------------------------------------------- 5.-7. profiles ----------------
update public.profiles
   set rsi_verified = false
 where rsi_verified
   and (rsi_handle is null
        or rsi_handle !~ '^[A-Za-z0-9_-]{3,60}$'
        or rsi_code is null
        or rsi_code !~ '^(VB-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}|VERSEBASE-VERIFY-[A-Z0-9]{1,6})$'
        or lower(rsi_handle) in (
             select lower(d.rsi_handle) from public.profiles d
             where d.rsi_verified
             group by lower(d.rsi_handle)
             having count(*) > 1));

create unique index profiles_rsi_handle_verified_key
  on public.profiles (lower(rsi_handle))
  where rsi_verified;

alter table public.profiles
  add constraint profiles_rsi_handle_len check (rsi_handle is null or char_length(rsi_handle) <= 60),
  add constraint profiles_rsi_code_len check (rsi_code is null or char_length(rsi_code) <= 64);

-- -------------------------------------------- Selbstpruefung -----------------
do $pruefung$
declare
  v_offen text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_offen
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('rsi_rate_ok', 'rsi_challenge_issue', 'rsi_challenge_get',
                      'rsi_challenge_result', 'guard_rsi_verified')
    and (pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE'));
  if v_offen is not null then
    raise exception 'rsi_challenge: fuer Clients ausfuehrbar: %', v_offen;
  end if;

  if (select count(*) from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('rsi_rate_ok', 'rsi_challenge_issue', 'rsi_challenge_get', 'rsi_challenge_result')
         and pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')) <> 4 then
    raise exception 'rsi_challenge: service_role kann nicht alle vier Funktionen ausfuehren';
  end if;

  select string_agg(c.oid::regclass::text, ', ') into v_offen
  from pg_catalog.pg_class c
  where c.oid in ('private.rsi_challenges'::regclass, 'private.rsi_attempts'::regclass)
    and (pg_catalog.has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      or pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'));
  if v_offen is not null then
    raise exception 'rsi_challenge: fuer Clients lesbar oder schreibbar: %', v_offen;
  end if;
end
$pruefung$;

-- ============================================================================
-- RUECKBAU (erst NACH dem Zurueckrollen von verify-rsi auf die Fassung v5,
-- sonst antwortet die Function mit 500/503; Abzeichen nimmt sie dabei keine):
--   drop function if exists public.rsi_challenge_result(uuid, text, text, boolean);
--   drop function if exists public.rsi_challenge_get(uuid, text);
--   drop function if exists public.rsi_challenge_issue(uuid, text);
--   drop function if exists public.rsi_rate_ok(uuid);
--   drop table if exists private.rsi_attempts;
--   drop table if exists private.rsi_challenges;
--   drop index if exists public.profiles_rsi_handle_verified_key;
--   alter table public.profiles drop constraint if exists profiles_rsi_handle_len,
--                               drop constraint if exists profiles_rsi_code_len;
--   Trigger auf den Stand von 20260722200000 (search_path = public, ohne den
--   Block "Das Badge gilt fuer genau das gepruefte Handle"):
--   create or replace function public.guard_rsi_verified() ... wie in
--   supabase/migrations/20260722200000_guard_rsi_verified.sql
-- Der Bestandsschritt 7 laesst sich nicht zuruecknehmen (er traf live keinen).
-- ============================================================================
