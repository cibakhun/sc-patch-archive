-- Live-Chat unter Freunden (Kontoseite, Runde 3, 29.10.2026).
--
-- Eine Tabelle für Direktnachrichten, lesbar nur für Absender und Empfänger,
-- schreibbar nur an bestätigte Freunde. Neue Nachrichten kommen per Supabase
-- Realtime (postgres_changes, RLS gilt pro Abonnent); die Seite fragt
-- zusätzlich in Abständen nach, falls die Websocket-Verbindung nicht steht.
--
-- Dabei geschlossen: zwei Lücken, durch die sich jemand ohne Zustimmung zum
-- Freund machen konnte -- und damit auch Nachrichten schreiben dürfte:
--   1. friends_insert erlaubte jedem, eine Zeile (user_id = ich,
--      friend_id = beliebig) anzulegen. Die Kontoseite zeigt Freundschaften
--      in beide Richtungen an, also stand man danach in der Freundesliste
--      des anderen. Freundschaften entstehen aber ausschliesslich über
--      accept_friend_request() (security definer, umgeht RLS) -- die Seite
--      schreibt friends nie direkt (FriendsManager: nur select/delete).
--      Die Policy fällt deshalb ersatzlos weg.
--   2. freq_insert prüfte nur sender_id; eine Anfrage liess sich gleich mit
--      status = 'accepted' oder an sich selbst anlegen. Jetzt nur noch
--      'pending' und an jemand anderen (die Seite sendet nie einen Status).
-- Vorher in der Anlage: 2 Freundschaftszeilen, beide einseitig angelegt
-- wie accept_friend_request() es tut (eine Zeile pro Freundschaft).

-- ---------------------------------------------------------------- Lücken --
drop policy if exists friends_insert on public.friends;

drop policy if exists freq_insert on public.friend_requests;
create policy freq_insert on public.friend_requests
  for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and sender_id <> receiver_id
    and status = 'pending'
  );

-- ------------------------------------------------------------- Freundschaft --
-- Eine Freundschaft ist EINE Zeile, angelegt vom Annehmenden (siehe
-- accept_friend_request). Darum in beide Richtungen nachsehen.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.friends
    where (user_id = a and friend_id = b) or (user_id = b and friend_id = a)
  );
$$;
revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- Tabelle --
create table if not exists public.direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists direct_messages_unread_idx
  on public.direct_messages (receiver_id, sender_id) where read_at is null;
create index if not exists direct_messages_pair_idx
  on public.direct_messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), id desc);

alter table public.direct_messages enable row level security;

create policy dm_select on public.direct_messages
  for select to authenticated
  using ((select auth.uid()) in (sender_id, receiver_id));

create policy dm_insert on public.direct_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and sender_id <> receiver_id
    and public.are_friends(sender_id, receiver_id)
  );
-- Kein update/delete: gelesen wird nur über mark_messages_read().

-- Zeitstempel und Lesestatus setzt der Server, nicht der Client; dazu eine
-- grobe Bremse gegen Fluten (30 Nachrichten pro Minute und Absender).
create or replace function public.direct_messages_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  new.created_at := now();
  new.read_at := null;
  new.body := btrim(new.body);
  if (select count(*) from public.direct_messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Zu viele Nachrichten in kurzer Zeit' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger direct_messages_guard
  before insert on public.direct_messages
  for each row execute function public.direct_messages_guard();

create or replace function public.mark_messages_read(friend uuid)
returns integer
language sql
security definer
set search_path to ''
as $$
  with upd as (
    update public.direct_messages
       set read_at = now()
     where receiver_id = (select auth.uid())
       and sender_id = friend
       and read_at is null
    returning 1
  )
  select count(*)::integer from upd;
$$;
revoke all on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;

grant select, insert on public.direct_messages to authenticated;
revoke all on public.direct_messages from anon;

-- Realtime: neue Nachrichten an den Empfänger schieben.
alter publication supabase_realtime add table public.direct_messages;

-- ============================================================================
-- RÜCKBAU
--   alter publication supabase_realtime drop table public.direct_messages;
--   drop table public.direct_messages;          -- nimmt Trigger + Policies mit
--   drop function public.direct_messages_guard();
--   drop function public.mark_messages_read(uuid);
--   drop function public.are_friends(uuid, uuid);
--   drop policy freq_insert on public.friend_requests;
--   create policy freq_insert on public.friend_requests for insert
--     to authenticated with check ((select auth.uid()) = sender_id);
--   create policy friends_insert on public.friends for insert
--     to authenticated with check ((select auth.uid()) = user_id);
-- ============================================================================
