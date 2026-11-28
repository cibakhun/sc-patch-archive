-- mengen_je_konto: Obergrenzen je Konto fuer die Werkzeugdaten, gerechte
-- Verteilung der Raffinerie-Meldungen, alter RSI-Uebergangsweg entfernt.
-- (28.11.2026; NOCH NICHT eingespielt, erst nach Freigabe durch den Betreiber.
-- Ohne begin/commit einspielen, falls die Anbindung selbst eine Transaktion
-- anlegt.)
--
-- WARUM: Mengenregeln je Konto fuer die Werkzeugdaten, nach dem Muster von
-- crew_calls_guard, damit die Zahlen aller Tabellen gleich behandelt werden.
-- Die Grenzen liegen weit ueber der Nutzung am 28.11.2026 (je Konto
-- hoechstens 6 Favoriten, 3 Crafting-Eintraege, 1 Mining-Vorlage,
-- 3 Raffinerie-Auftraege, 4 Layouts, 2 Anfragen).
--
-- WAS SICH AENDERT
--   1. Neue Trigger, je einer BEFORE INSERT, mit Transaktionssperre je Konto
--      (wie crew_calls_guard):
--        favorites            hoechstens  2000 Zeilen je Konto
--        crafting_entries     hoechstens  5000 (1634 Bauplaene am 28.11.)
--        mining_sig_presets   hoechstens    50
--        refinery_jobs        hoechstens  2000
--        friend_requests      hoechstens    20 je Stunde, 200 offene
--      Ein Upsert auf eine schon vorhandene Zeile zaehlt nicht: PostgREST
--      schickt merge-duplicates als INSERT … ON CONFLICT, und der
--      BEFORE-INSERT-Trigger feuert auch dann.
--   2. mining_sig_presets: minerals und locations nur eindimensional und mit
--      begrenzter Laenge ihres Inhalts.
--   3. direct_messages_guard: zaehlt nach einer Sperre je Absender und
--      begrenzt zusaetzlich auf 1000 Nachrichten je Tag. Neuer Index
--      (sender_id, created_at) fuer beide Zaehlungen.
--   4. touch_hangar_layout: zaehlt nach einer Sperre je Konto; hoechstens
--      200 nicht geloeschte Layouts (Grabsteine zaehlen weiter nur gegen die
--      bisherige Gesamtgrenze 1000). Ein Upsert auf ein vorhandenes Layout und
--      das Wiederherstellen eines Grabsteins pruefen nur die 200.
--   5. refinery_discord_due: hoechstens drei Auftraege je Konto und Lauf, erst
--      danach die gemeinsame Grenze. Ein Konto mit vielen faelligen Auftraegen
--      haelt die Meldungen der anderen nicht mehr auf.
--   6. rsi_challenge_result: ohne ausgestellte Herausforderung gibt es keine
--      ERSTverifizierung mehr ('stale'). Der Uebergang fuer das alte Dashboard
--      (Code aus dem Browser) ist vorbei; main nutzt seit 06.11.2026 den neuen
--      Ablauf. Nachpruefungen schon gebundener Altcodes laufen unveraendert
--      ueber den v_bound-Zweig. Gehoert zusammen mit verify-rsi ohne
--      RSI_LEGACY_FLOW (supabase/functions/verify-rsi/handler.js).
--
-- REIHENFOLGE LIVE: erst diese Migration, dann verify-rsi neu ausrollen, dann
-- das Secret RSI_LEGACY_FLOW entfernen (falls gesetzt; die neue Function
-- liest es nicht mehr). Zwischen Migration und Ausrollen bekommt ein Altcode
-- aus dem Browser 'stale' statt eines Abzeichens; main schickt keinen mehr.
--
-- Rueckweg:
--   drop trigger favorites_guard on public.favorites;           drop function public.favorites_guard();
--   drop trigger crafting_entries_guard on public.crafting_entries;  drop function public.crafting_entries_guard();
--   drop trigger mining_sig_presets_guard on public.mining_sig_presets;  drop function public.mining_sig_presets_guard();
--   drop trigger refinery_jobs_guard on public.refinery_jobs;   drop function public.refinery_jobs_guard();
--   drop trigger friend_requests_guard on public.friend_requests;  drop function public.friend_requests_guard();
--   alter table public.mining_sig_presets drop constraint mining_sig_presets_minerals_form,
--     drop constraint mining_sig_presets_locations_form;
--   drop index public.direct_messages_sender_created_idx;
--   direct_messages_guard, touch_hangar_layout, refinery_discord_due und
--   rsi_challenge_result in der Fassung vor dieser Migration erneut anlegen
--   (Rumpf: 20261029130000_direct_messages.sql, 20261029121000_hangar_layouts.sql,
--   20261030180000_refinery_benachrichtigung.sql, 20261030120000_rsi_challenge.sql).
-- ============================================================================

begin;

-- 1. Obergrenzen je Konto ------------------------------------------------------

create or replace function public.favorites_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('favorites:' || new.user_id::text, 0));
  if not exists (select 1 from public.favorites f
                  where f.user_id = new.user_id and f.kind = new.kind and f.slug = new.slug)
     and (select count(*) from public.favorites f where f.user_id = new.user_id) >= 2000 then
    raise exception 'Zu viele Favoriten' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.favorites_guard() from public, anon, authenticated;

drop trigger if exists favorites_guard on public.favorites;
create trigger favorites_guard
  before insert on public.favorites
  for each row execute function public.favorites_guard();

create or replace function public.crafting_entries_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('crafting_entries:' || new.user_id::text, 0));
  if not exists (select 1 from public.crafting_entries c
                  where c.user_id = new.user_id and c.slug = new.slug)
     and (select count(*) from public.crafting_entries c where c.user_id = new.user_id) >= 5000 then
    raise exception 'Zu viele Crafting-Eintraege' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.crafting_entries_guard() from public, anon, authenticated;

drop trigger if exists crafting_entries_guard on public.crafting_entries;
create trigger crafting_entries_guard
  before insert on public.crafting_entries
  for each row execute function public.crafting_entries_guard();

create or replace function public.mining_sig_presets_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('mining_sig_presets:' || new.user_id::text, 0));
  if not exists (select 1 from public.mining_sig_presets m
                  where m.user_id = new.user_id and m.name = new.name)
     and (select count(*) from public.mining_sig_presets m where m.user_id = new.user_id) >= 50 then
    raise exception 'Zu viele Mining-Vorlagen' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.mining_sig_presets_guard() from public, anon, authenticated;

drop trigger if exists mining_sig_presets_guard on public.mining_sig_presets;
create trigger mining_sig_presets_guard
  before insert on public.mining_sig_presets
  for each row execute function public.mining_sig_presets_guard();

create or replace function public.refinery_jobs_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('refinery_jobs:' || new.user_id::text, 0));
  if (select count(*) from public.refinery_jobs r where r.user_id = new.user_id) >= 2000 then
    raise exception 'Zu viele Raffinerie-Auftraege' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.refinery_jobs_guard() from public, anon, authenticated;

drop trigger if exists refinery_jobs_guard on public.refinery_jobs;
create trigger refinery_jobs_guard
  before insert on public.refinery_jobs
  for each row execute function public.refinery_jobs_guard();

-- friend_requests: die Seite legt nur an und loescht (FriendsManager.astro);
-- created_at setzt jetzt der Trigger, damit die Stundengrenze nicht ueber ein
-- mitgeschicktes Datum zu umgehen ist.
create or replace function public.friend_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  perform pg_advisory_xact_lock(hashtextextended('friend_requests:' || new.sender_id::text, 0));
  if (select count(*) from public.friend_requests r
       where r.sender_id = new.sender_id and r.created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.friend_requests r
          where r.sender_id = new.sender_id and r.status = 'pending') >= 200 then
    raise exception 'Zu viele Anfragen' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.friend_requests_guard() from public, anon, authenticated;

drop trigger if exists friend_requests_guard on public.friend_requests;
create trigger friend_requests_guard
  before insert on public.friend_requests
  for each row execute function public.friend_requests_guard();

-- 2. Mining-Vorlagen: Form der Listen -------------------------------------------
-- 64 Minerale bzw. 128 Fundorte zu je hoechstens 80 Zeichen passen hinein;
-- der laengste Eintrag am 28.11.2026 hat 35 Zeichen.

alter table public.mining_sig_presets
  add constraint mining_sig_presets_minerals_form check (
    (array_ndims(minerals) is null or array_ndims(minerals) = 1)
    and octet_length(array_to_string(minerals, '')) <= 8192
  ),
  add constraint mining_sig_presets_locations_form check (
    (array_ndims(locations) is null or array_ndims(locations) = 1)
    and octet_length(array_to_string(locations, '')) <= 16384
  );

-- 3. Direktnachrichten: Sperre und Tagesgrenze -----------------------------------

create index if not exists direct_messages_sender_created_idx
  on public.direct_messages (sender_id, created_at);

create or replace function public.direct_messages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  new.read_at := null;
  new.body := btrim(new.body);
  perform pg_advisory_xact_lock(hashtextextended('direct_messages:' || new.sender_id::text, 0));
  if (select count(*) from public.direct_messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30
     or (select count(*) from public.direct_messages
         where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 1000 then
    raise exception 'Zu viele Nachrichten in kurzer Zeit' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.direct_messages_guard() from public, anon, authenticated;

-- 4. Hangar-Layouts: Sperre, Grenze fuer nicht geloeschte -------------------------
-- Laeuft weiter mit den Rechten des Aufrufenden: die RLS zeigt ihm genau seine
-- eigenen Zeilen, und mehr zaehlt der Trigger nicht.

create or replace function public.touch_hangar_layout()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.rev < old.rev then
    return null;
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' or (old.deleted and not new.deleted) then
    perform pg_advisory_xact_lock(hashtextextended('hangar_layouts:' || new.user_id::text, 0));
    -- Upsert auf ein vorhandenes Layout: ON CONFLICT macht daraus ein UPDATE,
    -- dessen eigener Trigger-Aufruf prueft dann, ob ein Grabstein zurueckkehrt.
    if tg_op = 'INSERT' and exists (select 1 from public.hangar_layouts h
                                     where h.user_id = new.user_id and h.id = new.id) then
      return new;
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.hangar_layouts h
                              where h.user_id = new.user_id) >= 1000 then
      raise exception 'hangar_layouts: zu viele Layouts' using errcode = 'check_violation';
    end if;
    if not new.deleted and (select count(*) from public.hangar_layouts h
                             where h.user_id = new.user_id and not h.deleted) >= 200 then
      raise exception 'hangar_layouts: zu viele Layouts' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.touch_hangar_layout() from public, anon, authenticated;

-- 5. Raffinerie-Meldungen: hoechstens drei je Konto und Lauf ------------------------

create or replace function public.refinery_discord_due(p_limit integer default 50)
returns table (
  job_id          bigint,
  discord_user_id text,
  lang            text,
  station         text,
  method          text,
  items           jsonb,
  ready_at        timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.discord_user_id, f.lang, f.station, f.method, f.items, f.ready_at
    from (
      select j.id, d.discord_user_id, s.lang, j.station, j.method, j.items, j.ready_at,
             row_number() over (partition by j.user_id order by j.ready_at, j.id) as nr
        from public.refinery_jobs j
        join public.notification_settings s on s.user_id = j.user_id and s.refinery_discord
        join public.discord_role_state d on d.user_id = j.user_id and d.discord_user_id is not null
       where j.status = 'active'
         and j.discord_notified_at is null
         and j.ready_at <= now()
         and j.ready_at >= greatest(s.refinery_discord_since, now() - interval '24 hours')
    ) f
   where f.nr <= 3
   order by f.ready_at, f.id
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
revoke all on function public.refinery_discord_due(integer) from public, anon, authenticated;
grant execute on function public.refinery_discord_due(integer) to service_role;

-- 6. RSI: keine Erstverifizierung ohne ausgestellte Herausforderung ------------------

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
  v_bound boolean;
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

  -- Gebunden: das Abzeichen haengt schon an genau diesem Handle und Code
  -- (auch an einem Altcode). Nachpruefung: behalten oder nehmen.
  perform 1
  from public.profiles p
  where p.id = p_user
    and p.rsi_verified
    and lower(p.rsi_handle) = v_key
    and p.rsi_code = p_code
  for update;
  v_bound := found;

  if v_bound then
    if not p_found then
      update public.profiles
         set rsi_verified = false
       where id = p_user;
      return 'revoked';
    end if;
    if v_has then
      if v_row.code = p_code then
        update private.rsi_challenges
           set verified_at = coalesce(verified_at, now()),
               checked_at = now()
         where user_id = p_user and handle_key = v_key;
      end if;
      return 'verified';
    end if;
    insert into private.rsi_challenges (user_id, handle_key, rsi_handle, code, verified_at, checked_at)
    values (p_user, v_key, p_handle, p_code, now(), now())
    on conflict (user_id, handle_key) do nothing;
    return 'verified';
  end if;

  -- Neu verifiziert wird nur ein Code, den der Server fuer dieses Konto und
  -- Handle ausgestellt hat (rsi_challenge_issue), und nur binnen 24 Stunden.
  if not v_has
     or v_row.code <> p_code
     or (v_row.verified_at is null and v_row.created_at < now() - interval '24 hours') then
    return 'stale';
  end if;

  if not p_found then
    return 'not_found';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user) then
    return 'no_profile';
  end if;

  update public.profiles
     set rsi_verified = false
   where rsi_verified and lower(rsi_handle) = v_key and id <> p_user;

  update public.profiles
     set rsi_handle = v_row.rsi_handle,
         rsi_code = p_code,
         rsi_verified = true
   where id = p_user;

  update private.rsi_challenges
     set verified_at = coalesce(verified_at, now()),
         checked_at = now()
   where user_id = p_user and handle_key = v_key;

  delete from private.rsi_challenges
  where user_id = p_user and handle_key <> v_key;

  return 'verified';
end;
$$;
revoke all on function public.rsi_challenge_result(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.rsi_challenge_result(uuid, text, text, boolean) to service_role;

commit;
