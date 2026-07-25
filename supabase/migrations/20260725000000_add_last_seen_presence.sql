-- Dynamische Präsenz: last_seen-Heartbeat + serverseitig abgeleitete presence.
-- account-lite.js schreibt profiles.last_seen, SOLANGE der Nutzer aktiv ist
-- (Tab sichtbar + Interaktion); die public_profiles-View leitet daraus zum
-- Lesezeitpunkt online/away/offline ab. Kein Roh-Timestamp nach außen.
alter table public.profiles add column if not exists last_seen timestamptz;

create or replace view public.public_profiles as
  select
    handle, display_name, bio, banner_url, avatar_url, avatar_icon, avatar_color,
    role, status_state, status_text, rsi_handle, rsi_verified, org_name, created_at,
    case
      when last_seen is null then 'offline'
      when now() - last_seen < interval '3 minutes'  then 'online'
      when now() - last_seen < interval '15 minutes' then 'away'
      else 'offline'
    end as presence
  from public.profiles
  where handle is not null;
