-- Präsenz auf Zwei-Signal-Modell umgestellt:
--   last_seen   = "Tab offen"-Ping (account-lite.js pingt alle ~30s, solange der
--                 Tab offen ist — auch idle/versteckt; stoppt beim Schließen/Logout)
--   last_active = letzte Interaktion (Maus/Taste/…)
-- Ableitung zum Lesezeitpunkt:
--   Tab offen (last_seen < 80s):  aktiv (<3min) -> online, sonst -> away (NIE offline)
--   Tab zu   (last_seen >= 80s):  < 3min -> away, sonst -> offline
alter table public.profiles add column if not exists last_active timestamptz;

create or replace view public.public_profiles as
  select
    handle, display_name, bio, banner_url, avatar_url, avatar_icon, avatar_color,
    role, status_state, status_text, rsi_handle, rsi_verified, org_name, created_at,
    case
      when last_seen is null then 'offline'
      when now() - last_seen < interval '80 seconds' then
        case when last_active is not null and now() - last_active < interval '3 minutes' then 'online' else 'away' end
      when now() - last_seen < interval '3 minutes' then 'away'
      else 'offline'
    end as presence
  from public.profiles
  where handle is not null;

create or replace view public.social_profiles as
  select
    id, handle, display_name, avatar_url, avatar_icon, avatar_color,
    role, status_state, status_text, rsi_verified, org_name,
    case
      when last_seen is null then 'offline'
      when now() - last_seen < interval '80 seconds' then
        case when last_active is not null and now() - last_active < interval '3 minutes' then 'online' else 'away' end
      when now() - last_seen < interval '3 minutes' then 'away'
      else 'offline'
    end as presence
  from public.profiles
  where handle is not null;
