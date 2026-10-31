-- social_profiles (Freundes-Verzeichnis) um dieselbe abgeleitete presence
-- erweitern, damit die Freundesliste die echte Präsenz statt des manuellen
-- status_state anzeigt.
create or replace view public.social_profiles as
  select
    id, handle, display_name, avatar_url, avatar_icon, avatar_color,
    role, status_state, status_text, rsi_verified, org_name,
    case
      when last_seen is null then 'offline'
      when now() - last_seen < interval '3 minutes'  then 'online'
      when now() - last_seen < interval '15 minutes' then 'away'
      else 'offline'
    end as presence
  from public.profiles
  where handle is not null;
