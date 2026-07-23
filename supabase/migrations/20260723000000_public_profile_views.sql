-- Oeffentliche Profil-Daten fuer die /pilot/<handle>-Seite.
--
-- Die statische Site (nginx/Coolify) laedt oeffentliche Profile clientseitig
-- von Supabase. Statt die Tabelle public.profiles per RLS fuer anon
-- freizugeben (RLS ist zeilen-, nicht spaltenbasiert — private Felder wie
-- rsi_code/discord_tag waeren mitlesbar), gibt es zwei schmale Views:
--
--   public_profiles   — nur Profile MIT gesetztem Handle (Opt-in ueber das
--                       Handle), nur oeffentliche Spalten.
--   public_favorites  — Favoriten (Fleet-Showcase etc.) dieser Profile,
--                       nur kind/slug/label.
--
-- ANNAHME: favorites traegt die Besitzer-Referenz in der Spalte user_id
-- (uuid, Default auth.uid() — der Client-Insert in assets/account-lite.js
-- sendet nur {kind, slug, label}). Falls die Spalte anders heisst, schlaegt
-- das Anwenden dieser Migration fehl — dann Spaltennamen hier anpassen.
--
-- Views laufen mit den Rechten des View-Owners (postgres) und umgehen damit
-- die RLS der Basistabellen — genau der gewuenschte, kontrollierte
-- Datenpfad. Anon/Authenticated bekommen SELECT NUR auf die Views.

create or replace view public.public_profiles
with (security_barrier = true) as
select
  handle,
  display_name,
  bio,
  banner_url,
  avatar_url,
  avatar_icon,
  avatar_color,
  role,
  status_state,
  status_text,
  rsi_handle,
  rsi_verified,
  org_name,
  created_at
from public.profiles
where handle is not null;

create or replace view public.public_favorites
with (security_barrier = true) as
select
  p.handle,
  f.kind,
  f.slug,
  f.label,
  f.created_at
from public.favorites f
join public.profiles p on p.id = f.user_id
where p.handle is not null;

grant select on public.public_profiles to anon, authenticated;
grant select on public.public_favorites to anon, authenticated;
