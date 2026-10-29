-- Erweiterte Profil-Spalten (Voraussetzung fuer public_profiles-View).
--
-- Die Live-Tabelle public.profiles hat nur einen Teil dieser Spalten
-- (u.a. die RSI-Verifizierungs-Spalten). Diese Migration ist die kanonische,
-- idempotente Ergaenzung entlang scripts/supabase-schema.sql (Abschnitt 1)
-- PLUS avatar_icon (fehlt dort, wird aber vom Dashboard und der View
-- genutzt). ADD COLUMN IF NOT EXISTS macht sie beliebig oft ausfuehrbar;
-- bereits vorhandene Spalten bleiben unangetastet (Defaults greifen nur
-- bei NEU angelegten Spalten).

alter table public.profiles
  add column if not exists bio text,
  add column if not exists banner_url text,
  add column if not exists avatar_url text,
  add column if not exists avatar_icon text default '◆',
  add column if not exists avatar_color text default '#2dd4ff',
  add column if not exists status_state text default 'online',
  add column if not exists status_text text,
  add column if not exists role text,
  add column if not exists rsi_handle text,
  add column if not exists rsi_verified boolean default false,
  add column if not exists discord_tag text,
  add column if not exists org_name text,
  add column if not exists updated_at timestamptz default now();
