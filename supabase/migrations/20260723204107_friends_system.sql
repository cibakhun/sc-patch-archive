-- friends_system: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260723204107, Name
-- friends_system, angewandt 23.07.2026 20:41 UTC. Alles unterhalb der
-- Trennlinie ist der dort gespeicherte Wortlaut (statements, mit ';\n'
-- verbunden), zeichengleich.
-- md5 des Wortlauts: 8de4e8473f7a9b1686ca5172074708a5
--
-- WARUM DIESE DATEI: die Migration lief direkt gegen die Anlage (Management
-- API) und lag bis heute nicht im Repo. Ohne sie bildet supabase/migrations/
-- die Anlage nicht ab, und `supabase db push` haelt die Live-Historie fuer
-- fremd.
--
-- WAS SIE FUER DIE SEITE BEDEUTET: nichts. Sie ist live angewandt und wird
-- nicht erneut eingespielt. Wortlaut nicht aendern; Korrekturen gehoeren in
-- eine neue Migration.
--
-- Spaeter geaendert: die Policy friends_insert entfernt
-- 20261029130000_direct_messages; das UPDATE-Recht der Clients auf
-- friend_requests nimmt 20261029145718_friend_requests_no_client_update
-- zurueck; social_profiles ist seither mehrfach per create or replace
-- erweitert worden. Der Kopfkommentar unten nennt scripts/supabase-schema.sql
-- "nie ausgefuehrt" -- fuer die Tabelle user_roles stimmt das nicht, siehe
-- 20260724143938_user_roles_allow_beta.
-- ============================================================================
-- Freundes-System: Tabellen + RLS. Existierten live bisher NICHT (nur im nie
-- ausgefuehrten scripts/supabase-schema.sql), waehrend das UI Dummy-Daten im
-- localStorage hielt.

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (sender_id, receiver_id),
  constraint friend_requests_no_self check (sender_id <> receiver_id)
);

-- Eine Zeile pro Freundschaft; beide Seiten sehen sie ueber die Policy.
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  constraint friends_no_self check (user_id <> friend_id)
);

create index if not exists friends_user_idx      on public.friends(user_id);
create index if not exists friends_friend_idx    on public.friends(friend_id);
create index if not exists freq_receiver_idx     on public.friend_requests(receiver_id, status);
create index if not exists freq_sender_idx       on public.friend_requests(sender_id, status);

alter table public.friend_requests enable row level security;
alter table public.friends          enable row level security;

-- friend_requests: Beteiligte sehen; Sender sendet; Empfaenger beantwortet;
-- beide duerfen loeschen (zuruecknehmen bzw. aufraeumen).
drop policy if exists freq_select on public.friend_requests;
create policy freq_select on public.friend_requests
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists freq_insert on public.friend_requests;
create policy freq_insert on public.friend_requests
  for insert to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists freq_update on public.friend_requests;
create policy freq_update on public.friend_requests
  for update to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

drop policy if exists freq_delete on public.friend_requests;
create policy freq_delete on public.friend_requests
  for delete to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- friends: beide Seiten sehen und duerfen die Freundschaft loesen.
drop policy if exists friends_select on public.friends;
create policy friends_select on public.friends
  for select to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists friends_insert on public.friends;
create policy friends_insert on public.friends
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists friends_delete on public.friends;
create policy friends_delete on public.friends
  for delete to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Basis-Profildaten fuer eingeloggte Nutzer (Suche + Freundesliste). Enthaelt
-- id fuer Joins, aber nur oeffentliche Spalten und nur Profile MIT Handle
-- (dasselbe Opt-in wie public_profiles). Bewusst NICHT fuer anon freigegeben.
create or replace view public.social_profiles
with (security_barrier = true) as
select id, handle, display_name, avatar_url, avatar_icon, avatar_color,
       role, status_state, status_text, rsi_verified, org_name
from public.profiles
where handle is not null;

grant select on public.social_profiles to authenticated;

-- Annehmen atomar: Status setzen UND Freundschaft anlegen in einer Transaktion,
-- damit kein halber Zustand entstehen kann. Prueft selbst, dass nur der
-- Empfaenger einer offenen Anfrage annehmen darf.
create or replace function public.accept_friend_request(req_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.friend_requests%rowtype;
begin
  select * into r from public.friend_requests where id = req_id;
  if not found then raise exception 'request not found'; end if;
  if r.receiver_id <> auth.uid() then raise exception 'not allowed'; end if;
  if r.status <> 'pending' then raise exception 'already handled'; end if;

  update public.friend_requests
     set status = 'accepted', responded_at = now()
   where id = req_id;

  insert into public.friends (user_id, friend_id)
  values (r.receiver_id, r.sender_id)
  on conflict (user_id, friend_id) do nothing;
end;
$$;

revoke all on function public.accept_friend_request(uuid) from public;
grant execute on function public.accept_friend_request(uuid) to authenticated;
