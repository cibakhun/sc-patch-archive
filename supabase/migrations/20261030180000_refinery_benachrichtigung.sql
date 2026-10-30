-- Raffinerie-Benachrichtigungen (30.10.2026). Noch NICHT live eingespielt;
-- der Hauptstrang spielt sie nach Freigabe durch den Betreiber ein.
--
-- WAS SICH AENDERT
--   public.notification_settings   eine Zeile je Konto mit den Schaltern
--     refinery_site      Mitteilung auf verse-base, wenn ein Auftrag fertig
--                        ist (Vorgabe an: fehlt die Zeile, gilt das auch)
--     refinery_discord   Privatnachricht vom Verse-Bot (Vorgabe aus)
--     refinery_discord_since  wann der Discord-Schalter zuletzt angeschaltet
--                        wurde; setzt nur der Trigger, nie der Client. Nur
--                        Auftraege, die danach fertig werden, gehen raus,
--                        damit das Einschalten keine alten Auftraege meldet.
--     lang               Sprache der Discord-Nachricht ('de'/'en'), die
--                        Sprache der Seite, auf der geschaltet wurde
--   public.refinery_jobs.discord_notified_at   wann der Bot den Auftrag
--     gemeldet hat; null = noch nicht. Verhindert doppelte Nachrichten.
--   public.refinery_discord_due(p_limit)   faellige Meldungen fuer den Bot
--   public.refinery_discord_sent(p_ids)    markiert sie als gemeldet
--     Beide nur fuer service_role (Edge Function bot-role-sync). Der Bot
--     sieht so die discord_user_id, nie die user_id.
--
-- Faellig ist ein Auftrag, wenn er aktiv ist, ready_at erreicht hat, noch
-- nicht gemeldet wurde, sein Konto den Discord-Schalter an und Discord
-- verbunden hat, und ready_at nach dem Einschalten UND in den letzten
-- 24 Stunden liegt. Faellt der Bot laenger aus, meldet er danach keine
-- Auftraege, die schon einen Tag fertig sind.
--
-- Rueckweg:
--   drop function public.refinery_discord_sent(bigint[]);
--   drop function public.refinery_discord_due(integer);
--   alter table public.refinery_jobs drop column discord_notified_at;
--   drop table public.notification_settings;
--   drop function public.notification_settings_stamp();

begin;

create table if not exists public.notification_settings (
  user_id                 uuid        primary key default auth.uid() references auth.users(id) on delete cascade,
  refinery_site           boolean     not null default true,
  refinery_discord        boolean     not null default false,
  refinery_discord_since  timestamptz,
  lang                    text        not null default 'en' check (lang in ('de', 'en')),
  updated_at              timestamptz not null default now()
);

comment on table public.notification_settings is
  'Benachrichtigungs-Schalter je Konto (Raffinerie: Seite, Discord). '
  'refinery_discord_since und updated_at setzt der Trigger.';

alter table public.notification_settings enable row level security;

create policy notification_settings_select_own on public.notification_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy notification_settings_insert_own on public.notification_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notification_settings_update_own on public.notification_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Schreiben nur die drei Schalter-Spalten; user_id setzt beim Anlegen die
-- Vorgabe auth.uid(), die Zeitstempel der Trigger. Die Seite schreibt per
-- UPDATE und legt die Zeile nur an, wenn es keine gibt (kein Upsert: der
-- braeuchte UPDATE auf user_id).
revoke all on public.notification_settings from anon, authenticated;
grant select on public.notification_settings to authenticated;
grant insert (refinery_site, refinery_discord, lang) on public.notification_settings to authenticated;
grant update (refinery_site, refinery_discord, lang) on public.notification_settings to authenticated;

create or replace function public.notification_settings_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if not new.refinery_discord then
    new.refinery_discord_since := null;
  elsif tg_op = 'INSERT' or not old.refinery_discord then
    new.refinery_discord_since := now();
  else
    new.refinery_discord_since := old.refinery_discord_since;
  end if;
  return new;
end;
$$;
revoke all on function public.notification_settings_stamp() from public, anon, authenticated;

create trigger notification_settings_stamp
  before insert or update on public.notification_settings
  for each row execute function public.notification_settings_stamp();

alter table public.refinery_jobs add column if not exists discord_notified_at timestamptz;

create index if not exists refinery_jobs_discord_due_idx
  on public.refinery_jobs (ready_at) where status = 'active' and discord_notified_at is null;

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
  select j.id, d.discord_user_id, s.lang, j.station, j.method, j.items, j.ready_at
    from public.refinery_jobs j
    join public.notification_settings s on s.user_id = j.user_id and s.refinery_discord
    join public.discord_role_state d on d.user_id = j.user_id and d.discord_user_id is not null
   where j.status = 'active'
     and j.discord_notified_at is null
     and j.ready_at <= now()
     and j.ready_at >= greatest(s.refinery_discord_since, now() - interval '24 hours')
   order by j.ready_at
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
revoke all on function public.refinery_discord_due(integer) from public, anon, authenticated;
grant execute on function public.refinery_discord_due(integer) to service_role;

create or replace function public.refinery_discord_sent(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.refinery_jobs
     set discord_notified_at = now()
   where id = any(p_ids) and discord_notified_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.refinery_discord_sent(bigint[]) from public, anon, authenticated;
grant execute on function public.refinery_discord_sent(bigint[]) to service_role;

commit;
