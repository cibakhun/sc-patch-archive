-- Crew-Aufruf an Freunde (24.11.2026, UX-Audit Paket I, I7 Schritt 4).
-- Noch NICHT eingespielt; der Hauptstrang spielt sie nach Freigabe durch den
-- Betreiber ein.
--
-- „Heute 20 Uhr Mining, 2 Plätze“: ein Pilot ruft seine Freunde zu einer
-- Runde, Freunde sagen mit einem Klick zu. Sichtbar nur für den Rufenden und
-- seine Freunde; wer zusagt, ist für dieselben Leute sichtbar.
--
-- WAS SICH AENDERT
--   public.crew_calls          ein Aufruf: Tätigkeit, Beginn, Plätze, Notiz
--   public.crew_call_members   wer zugesagt hat (je Aufruf und Pilot eine Zeile)
--   public.crew_calls_guard()  Server setzt Zeiten, prüft Beginn (höchstens
--                              10 Minuten zurück, höchstens 7 Tage voraus) und
--                              höchstens 3 offene Aufrufe je Pilot
--   public.crew_call_members_guard()  Platz frei, Aufruf nicht vorbei, nicht
--                              der eigene; sperrt den Aufruf, damit zwei
--                              gleichzeitige Zusagen den letzten Platz nicht
--                              beide bekommen
--
-- Lesen: der Rufende und seine Freunde (are_friends antwortet nur für
-- Beteiligte, 20261029200807). Zusagen: nur wer den Aufruf sehen kann, also
-- ein Freund. Ändern gibt es nicht: absagen = Zeile löschen (der Rufende
-- seinen Aufruf, ein Mitglied seine Zusage). Eine Stunde nach Beginn zeigt
-- die Seite einen Aufruf nicht mehr; die Zeilen bleiben, bis der Rufende sie
-- löscht oder sein Konto geht.
--
-- Rueckweg:
--   drop table public.crew_call_members;   -- nimmt Trigger und Policies mit
--   drop table public.crew_calls;
--   drop function public.crew_call_members_guard();
--   drop function public.crew_calls_guard();

begin;

create table if not exists public.crew_calls (
  id          bigint generated always as identity primary key,
  owner_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  activity    text        not null check (activity in
                ('mining', 'salvage', 'cargo', 'bounty', 'combat', 'exploration', 'racing', 'other')),
  starts_at   timestamptz not null,
  slots       smallint    not null check (slots between 1 and 8),
  note        text        check (note is null or char_length(note) <= 80),
  created_at  timestamptz not null default now()
);
create index if not exists crew_calls_owner_idx on public.crew_calls (owner_id, starts_at desc);

alter table public.crew_calls enable row level security;

create policy crew_calls_select on public.crew_calls
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.are_friends((select auth.uid()), owner_id));

create policy crew_calls_insert on public.crew_calls
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy crew_calls_delete on public.crew_calls
  for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.crew_calls from public, anon, authenticated;
grant select, delete on public.crew_calls to authenticated;
grant insert (activity, starts_at, slots, note) on public.crew_calls to authenticated;

create or replace function public.crew_calls_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  if new.starts_at < now() - interval '10 minutes' or new.starts_at > now() + interval '7 days' then
    raise exception 'Beginn ausserhalb des erlaubten Rahmens' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.crew_calls
       where owner_id = new.owner_id and starts_at > now() - interval '1 hour') >= 3 then
    raise exception 'Zu viele offene Aufrufe' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.crew_calls_guard() from public, anon, authenticated;

create trigger crew_calls_guard
  before insert on public.crew_calls
  for each row execute function public.crew_calls_guard();

create table if not exists public.crew_call_members (
  call_id     bigint      not null references public.crew_calls (id) on delete cascade,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (call_id, user_id)
);
create index if not exists crew_call_members_user_idx on public.crew_call_members (user_id);

alter table public.crew_call_members enable row level security;

-- Die Unterabfragen laufen mit den Rechten des Lesenden: sichtbar ist eine
-- Zusage genau dann, wenn der Aufruf sichtbar ist.
create policy crew_call_members_select on public.crew_call_members
  for select to authenticated
  using (exists (select 1 from public.crew_calls c where c.id = call_id));

create policy crew_call_members_insert on public.crew_call_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.crew_calls c where c.id = call_id and c.owner_id <> (select auth.uid()))
  );

create policy crew_call_members_delete on public.crew_call_members
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.crew_call_members from public, anon, authenticated;
grant select, delete on public.crew_call_members to authenticated;
grant insert (call_id) on public.crew_call_members to authenticated;

create or replace function public.crew_call_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.crew_calls%rowtype;
begin
  new.created_at := now();
  select * into c from public.crew_calls where id = new.call_id for update;
  if not found or c.owner_id = new.user_id then
    raise exception 'Aufruf nicht gefunden' using errcode = 'check_violation';
  end if;
  if c.starts_at < now() - interval '1 hour' then
    raise exception 'Aufruf ist vorbei' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.crew_call_members where call_id = new.call_id) >= c.slots then
    raise exception 'Crew ist voll' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.crew_call_members_guard() from public, anon, authenticated;

create trigger crew_call_members_guard
  before insert on public.crew_call_members
  for each row execute function public.crew_call_members_guard();

commit;
