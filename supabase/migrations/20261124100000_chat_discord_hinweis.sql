-- Discord-Hinweis bei neuen Chat-Nachrichten (24.11.2026, UX-Audit Paket I,
-- I7 Schritt 3). Noch NICHT eingespielt; der Hauptstrang spielt sie nach
-- Freigabe durch den Betreiber ein, zusammen mit bot-role-sync und dem Bot.
--
-- WAS SICH AENDERT
--   public.notification_settings
--     chat_discord        Privatnachricht vom Verse-Bot, wenn eine Chat-
--                         Nachricht ungelesen liegen bleibt, waehrend man
--                         nicht auf der Seite ist (Vorgabe aus)
--     chat_discord_since  wann der Schalter zuletzt angeschaltet wurde; setzt
--                         nur der Trigger. Nur Nachrichten danach zaehlen.
--     lang                wie bisher die Sprache der Discord-Nachrichten
--   private.chat_discord_notified   je Paar (Empfaenger, Absender) die
--     hoechste gemeldete Nachricht und wann; ohne Rechte fuer Clients. Eine
--     eigene Tabelle statt einer Spalte an direct_messages: die Nachrichten
--     gehen per Realtime an beide Seiten, und der Absender soll nicht sehen,
--     ob der Empfaenger Discord-Hinweise bekommt.
--   public.chat_discord_due(p_limit)   faellige Hinweise fuer den Bot
--   public.chat_discord_sent(p_ids)    markiert sie als gemeldet
--     Beide nur fuer service_role (Edge Function bot-role-sync). Der Bot sieht
--     discord_user_id, Sprache, Name und Handle des Absenders und die Zahl
--     der Nachrichten, nie eine Konto-ID und nie den Text einer Nachricht.
--
-- Faellig ist ein Paar, wenn es ungelesene, noch nicht gemeldete Nachrichten
-- gibt, die neueste davon mindestens 5 Minuten alt ist (Zeit, sie auf der
-- Seite zu lesen), keine aelter als 24 Stunden und keine vor dem Einschalten
-- liegt, der Empfaenger den Schalter an und Discord verbunden hat, er nicht
-- online ist (Puls der Seite aelter als 3 Minuten, wie „Abwesend“ in den
-- Profil-Sichten) und das Paar in den letzten 30 Minuten keinen Hinweis
-- bekam. Ein Hinweis je Absender, nicht je Nachricht.
--
-- Rueckweg:
--   drop function public.chat_discord_sent(bigint[]);
--   drop function public.chat_discord_due(integer);
--   drop table private.chat_discord_notified;
--   die Trigger-Funktion aus 20261030180000 neu setzen;
--   alter table public.notification_settings drop column chat_discord_since,
--     drop column chat_discord;

begin;

alter table public.notification_settings
  add column if not exists chat_discord       boolean     not null default false,
  add column if not exists chat_discord_since timestamptz;

grant insert (chat_discord) on public.notification_settings to authenticated;
grant update (chat_discord) on public.notification_settings to authenticated;

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
  if not new.chat_discord then
    new.chat_discord_since := null;
  elsif tg_op = 'INSERT' or not old.chat_discord then
    new.chat_discord_since := now();
  else
    new.chat_discord_since := old.chat_discord_since;
  end if;
  return new;
end;
$$;
revoke all on function public.notification_settings_stamp() from public, anon, authenticated;

create table if not exists private.chat_discord_notified (
  receiver_id  uuid        not null references auth.users(id) on delete cascade,
  sender_id    uuid        not null references auth.users(id) on delete cascade,
  last_msg_id  bigint      not null,
  notified_at  timestamptz not null default now(),
  primary key (receiver_id, sender_id)
);
alter table private.chat_discord_notified enable row level security;
revoke all on private.chat_discord_notified from public, anon, authenticated;

create or replace function public.chat_discord_due(p_limit integer default 50)
returns table (
  msg_id          bigint,
  discord_user_id text,
  lang            text,
  sender_name     text,
  sender_handle   text,
  unread          integer,
  last_at         timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with offen as (
    select m.receiver_id, m.sender_id, max(m.id) as msg_id, count(*)::integer as unread,
           max(m.created_at) as last_at, min(m.created_at) as first_at
      from public.direct_messages m
      join public.notification_settings s on s.user_id = m.receiver_id and s.chat_discord
      left join private.chat_discord_notified n on n.receiver_id = m.receiver_id and n.sender_id = m.sender_id
     where m.read_at is null
       and m.created_at >= greatest(s.chat_discord_since, now() - interval '24 hours')
       and m.id > coalesce(n.last_msg_id, 0)
       and (n.notified_at is null or n.notified_at < now() - interval '30 minutes')
     group by m.receiver_id, m.sender_id
  )
  select o.msg_id, d.discord_user_id, s.lang,
         coalesce(nullif(btrim(p.display_name), ''), p.handle, ''), coalesce(p.handle, ''),
         o.unread, o.last_at
    from offen o
    join public.notification_settings s on s.user_id = o.receiver_id
    join public.discord_role_state d on d.user_id = o.receiver_id and d.discord_user_id is not null
    join public.profiles r on r.id = o.receiver_id
    join public.profiles p on p.id = o.sender_id
   where o.last_at <= now() - interval '5 minutes'
     and (r.last_seen is null or r.last_seen < now() - interval '3 minutes')
   order by o.last_at
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
revoke all on function public.chat_discord_due(integer) from public, anon, authenticated;
grant execute on function public.chat_discord_due(integer) to service_role;

-- p_ids: die msg_id aus chat_discord_due (je Paar die neueste Nachricht).
-- Merkt sich je Paar die hoechste gemeldete Nachricht; eine kleinere ID
-- ueberschreibt nie eine groessere.
create or replace function public.chat_discord_sent(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into private.chat_discord_notified as c (receiver_id, sender_id, last_msg_id, notified_at)
  select m.receiver_id, m.sender_id, max(m.id), now()
    from public.direct_messages m
   where m.id = any(p_ids)
   group by m.receiver_id, m.sender_id
  on conflict (receiver_id, sender_id) do update
     set last_msg_id = greatest(c.last_msg_id, excluded.last_msg_id),
         notified_at = excluded.notified_at;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.chat_discord_sent(bigint[]) from public, anon, authenticated;
grant execute on function public.chat_discord_sent(bigint[]) to service_role;

commit;
