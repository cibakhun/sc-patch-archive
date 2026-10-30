-- Abzeichen "Profil komplett" (30.10.2026). Noch NICHT live eingespielt; der
-- Hauptstrang spielt sie nach Freigabe durch den Betreiber ein.
--
-- WAS SICH AENDERT: Ist ein Profil vollständig, verschwindet auf der
-- Kontoseite die Fortschrittskarte, und der Pilot bekommt ein Abzeichen: auf
-- der Kontoseite, auf /pilot/<handle> und als Discord-Rolle (Rang-Bot,
-- discord/bot/src/badge-sync.mjs).
--
-- EINE Definition von "vollständig": public.profile_is_complete(). Dieselben
-- zehn Felder wie der Ring auf der Kontoseite (completeFields in
-- src/scripts/account-dashboard.ts); Discord zählt wie dort erst mit echter
-- Verbindung (auth.identities), nicht mit einem getippten Namen. Wer dort
-- ein Feld ergänzt oder streicht, ändert es hier mit.
--
-- WER WAS SIEHT:
--   profile_badges (anon + authenticated): Handle und ja/nein, für die
--     Pilotenseite. Bewusst eine eigene kleine Sicht statt einer weiteren
--     Spalte an public_profiles, damit sie nicht mit den offenen Änderungen
--     an dieser Sicht (presence_visibility) kollidiert.
--   discord_profile_badges (nur Service-Rolle): Discord-ID und ja/nein, für
--     den Bot. Discord-IDs bleiben für Clients unsichtbar.
-- Die Funktion selbst ist für Clients gesperrt: sie liest auth.identities und
-- würde mit einer selbst gebauten Zeile verraten, ob ein Konto Discord hat.

create or replace function public.profile_is_complete(p public.profiles)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(p.display_name), '') is not null
     and nullif(btrim(p.handle), '') is not null
     and nullif(btrim(p.bio), '') is not null
     and nullif(btrim(p.banner_url), '') is not null
     and nullif(btrim(coalesce(nullif(btrim(p.avatar_url), ''), p.avatar_icon)), '') is not null
     and nullif(btrim(p.role), '') is not null
     and nullif(btrim(p.rsi_handle), '') is not null
     and nullif(btrim(p.discord_tag), '') is not null
     and exists (select 1 from auth.identities i where i.user_id = p.id and i.provider = 'discord')
     and nullif(btrim(p.org_name), '') is not null
     and nullif(btrim(p.status_text), '') is not null
$$;

revoke all on function public.profile_is_complete(public.profiles) from public, anon, authenticated;

create or replace view public.profile_badges with (security_barrier = true) as
 select handle,
        public.profile_is_complete(profiles) as profile_complete
   from public.profiles
  where handle is not null;

revoke all on public.profile_badges from public, anon, authenticated;
grant select on public.profile_badges to anon, authenticated;

create or replace view public.discord_profile_badges with (security_barrier = true) as
 select d.discord_user_id,
        public.profile_is_complete(p) as profile_complete
   from public.discord_role_state d
   join public.profiles p on p.id = d.user_id
  where d.discord_user_id is not null;

revoke all on public.discord_profile_badges from public, anon, authenticated;
grant select on public.discord_profile_badges to service_role;

-- ============================================================================
-- RUECKBAU:
--   drop view if exists public.discord_profile_badges;
--   drop view if exists public.profile_badges;
--   drop function if exists public.profile_is_complete(public.profiles);
-- ============================================================================
