-- Abzeichen "Profil komplett", Nachtrag (30.10.2026).
--
-- FEHLER IN 20261030170000: public.profile_is_complete() war für Clients
-- gesperrt, damit niemand sie mit einer selbst gebauten Zeile befragen kann.
-- Postgres prüft das Ausführungsrecht einer Funktion aber beim Aufrufer, auch
-- wenn sie in einer View mit Besitzerrechten steht. Die Pilotenseite (anon)
-- bekam deshalb "permission denied for function profile_is_complete" und
-- zeigte nie ein Abzeichen.
--
-- JETZT: die Regel steht direkt in der View profile_badges (Tabellenzugriff
-- dort mit Besitzerrechten, auth.identities eingeschlossen), und
-- discord_profile_badges liest sie von dort. Weiter genau EINE Definition,
-- und keine Funktion mehr, die Clients aufrufen könnten. Dieselben zehn
-- Felder wie completeFields in src/scripts/account-dashboard.ts.

create or replace view public.profile_badges with (security_barrier = true) as
 select p.handle,
        (nullif(btrim(p.display_name), '') is not null
         and nullif(btrim(p.handle), '') is not null
         and nullif(btrim(p.bio), '') is not null
         and nullif(btrim(p.banner_url), '') is not null
         and nullif(btrim(coalesce(nullif(btrim(p.avatar_url), ''), p.avatar_icon)), '') is not null
         and nullif(btrim(p.role), '') is not null
         and nullif(btrim(p.rsi_handle), '') is not null
         and nullif(btrim(p.discord_tag), '') is not null
         and exists (select 1 from auth.identities i where i.user_id = p.id and i.provider = 'discord')
         and nullif(btrim(p.org_name), '') is not null
         and nullif(btrim(p.status_text), '') is not null) as profile_complete
   from public.profiles p
  where p.handle is not null;

create or replace view public.discord_profile_badges with (security_barrier = true) as
 select d.discord_user_id,
        coalesce(b.profile_complete, false) as profile_complete
   from public.discord_role_state d
   join public.profiles p on p.id = d.user_id
   left join public.profile_badges b on b.handle = p.handle
  where d.discord_user_id is not null;

drop function if exists public.profile_is_complete(public.profiles);

-- Rechte bleiben wie in 20261030170000 (create or replace behält sie):
-- profile_badges SELECT für anon + authenticated, discord_profile_badges nur
-- service_role.
