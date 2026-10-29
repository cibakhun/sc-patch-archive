-- Profilspalten: Wertebereiche in der Datenbank statt nur im Formular
-- (30.10.2026). Noch NICHT live eingespielt; der Hauptstrang spielt sie nach
-- Freigabe durch den Betreiber ein.
--
-- AUSGANGSLAGE: Das Handle-Format (profiles_handle_check: a-z, 0-9, _, 3-24
-- Zeichen, also nur Kleinbuchstaben), den Anzeigenamen, die Aktivitaet und
-- die drei Social-Felder prueft die Datenbank schon. Alle anderen
-- Profilfelder prueft nur das Formular im Konto. Die eigene Zeile darf jeder
-- angemeldete Nutzer schreiben (RLS profiles_*_own), die Datenbank nahm dabei
-- aber auch Werte an, die das Formular nie erzeugt.
--
-- WAS SICH AENDERT
--   1. CHECK-Regeln, die genau das erlauben, was die Seite selbst schreibt:
--        handle        keine Betreiber- und Funktionsnamen (admin, support,
--                      versebase ...); das Format galt schon vorher
--        role          eine der acht Citizen-Rollen (src/lib/profilePresets.ts)
--        status_state  online, away, offline, ingame, mission
--        bio <= 500, status_text <= 80, org_name <= 60, discord_tag <= 40
--        avatar_icon   1 bis 4 Zeichen (die Seite setzt ein Symbol)
--        avatar_color  '#rrggbb'
--        avatar_url    das eigene Bild im Bucket avatars (<id>/avatar, wie
--                      account-dashboard.ts es hochlaedt) oder ein
--                      Discord-Profilbild (cdn.discordapp.com/avatars/<id>/
--                      <hash>.<endung>, wie handle_new_user es uebernimmt)
--        banner_url    ein Motiv der Seite (/assets/<name>.jpg|png|webp) oder
--                      das eigene Bild im Bucket banners (<id>/banner)
--      Die Bild-Regeln nennen den Projekt-Host trgjhmbnodoarnfmlcqx.supabase.co
--      ausdruecklich. Zieht das Projekt um (eigene Domain, neues Projekt),
--      muessen beide Regeln mit.
--   2. Trigger trg_profiles_guard_times (BEFORE INSERT/UPDATE):
--        created_at ("Dabei seit") bleibt beim UPDATE, wie er ist, und ist
--        beim INSERT der Zeitpunkt des Anlegens (updated_at ebenso).
--        last_seen, last_active und activity_at liegen nie in der Zukunft:
--        sie werden auf now() gekappt, nicht abgelehnt (eine vorgehende Uhr
--        im Browser ist kein Fehler, der 30-s-Puls soll nie scheitern). Die
--        Service-Rolle (Edge Functions, Bot) ist beim created_at ausgenommen,
--        wie bei guard_is_tester/guard_rsi_verified.
--
-- WARUM GEPRUEFT UND NICHT NOT VALID: Eine NOT-VALID-Regel prueft bei JEDEM
-- spaeteren UPDATE trotzdem die ganze neue Zeile. Eine Altzeile mit einem
-- Wert ausserhalb der Regel koennte dann nicht einmal mehr den Puls
-- (account-lite.js) oder das Abmelden (account-dashboard.ts) schreiben. Live
-- am 29.10.2026 gezaehlt (nur Anzahlen, 13 Profile): 0 Verstoesse je Regel,
-- 0 Zeitstempel in der Zukunft, 0 created_at abweichend vom Anlegen des
-- Kontos; kein Handle ist ein reservierter Name (auch das des Admins nicht).
-- Die Regeln werden darum sofort geprueft angelegt. Hat sich seither eine
-- Zeile geaendert, die nicht passt, bricht ALTER TABLE ab und mit ihm die
-- ganze Migration (eine Transaktion) -- dann die Zaehlung unten wiederholen,
-- die Zeile klaeren und neu einspielen. Ein halber Stand entsteht nicht.
--
-- WARUM KEINE SPALTENRECHTE: Spaltengenaue INSERT/UPDATE-Rechte auf profiles
-- muessten bei jeder neuen Spalte (zuletzt activity, share_activity,
-- presence_visibility) mitgezogen werden. Fehlt eine, scheitert das Speichern
-- im Konto. Was Spaltenrechte hier schuetzen wuerden (created_at,
-- updated_at, is_tester, rsi_verified), halten Trigger:
-- trg_profiles_guard_times, profiles_set_updated_at, guard_is_tester,
-- guard_rsi_verified.
--
-- WAS ES FUER DIE SEITE BEDEUTET: nichts, solange sie schreibt, was sie heute
-- schreibt. Ein Wert ausserhalb der Regeln endet mit 23514
-- (check_violation); das Konto meldet das jetzt beim Speichern (DE/EN),
-- statt still nur Name und Handle zu sichern. Ein reserviertes Handle bekommt
-- eine eigene Meldung. Soll ein Konto des Betreibers doch einen reservierten
-- Namen tragen, ist das eine bewusste Aenderung an profiles_handle_reserved.
--
-- ZAEHLUNG VOR DEM EINSPIELEN (nur Anzahlen, alle muessen 0 sein):
--   select count(*) filter (where handle is not null and (handle = any (array['admin','administrator','moderator','mod','support','staff','team','system','root','official','owner','operator','security','help','versebase','verse_base']) or handle ~ 'verse_?base')) as handle,
--          count(*) filter (where role is not null and not (role = any (array['bounty_hunter','miner','salvager','trader','commander','explorer','medic','pirate']))) as role,
--          count(*) filter (where status_state is not null and not (status_state = any (array['online','away','offline','ingame','mission']))) as status_state,
--          count(*) filter (where char_length(bio) > 500 or char_length(status_text) > 80 or char_length(org_name) > 60 or char_length(discord_tag) > 40) as laengen,
--          count(*) filter (where (avatar_icon is not null and char_length(avatar_icon) not between 1 and 4) or (avatar_color is not null and avatar_color !~ '^#[0-9A-Fa-f]{6}$')) as avatar_deko,
--          count(*) filter (where avatar_url is not null and not (avatar_url ~ ('^https://trgjhmbnodoarnfmlcqx\.supabase\.co/storage/v1/object/public/avatars/' || id::text || '/avatar(\?v=[0-9]{1,16})?$') or avatar_url ~ '^https://cdn\.discordapp\.com/avatars/[0-9]{5,25}/[A-Za-z0-9_]{1,80}\.(png|jpe?g|webp|gif)(\?[A-Za-z0-9=&_-]{0,60})?$')) as avatar_url,
--          count(*) filter (where banner_url is not null and not (banner_url ~ '^/assets/[A-Za-z0-9_-]{1,60}\.(jpe?g|png|webp)$' or banner_url ~ ('^https://trgjhmbnodoarnfmlcqx\.supabase\.co/storage/v1/object/public/banners/' || id::text || '/banner(\?v=[0-9]{1,16})?$'))) as banner_url,
--          count(*) filter (where last_seen > now() or last_active > now() or activity_at > now()) as zukunft
--   from public.profiles;

-- -------------------------------------------- 1. Wertebereiche --------------
alter table public.profiles
  add constraint profiles_handle_reserved check (
    handle is null
    or not (handle = any (array['admin', 'administrator', 'moderator', 'mod', 'support', 'staff',
                                'team', 'system', 'root', 'official', 'owner', 'operator',
                                'security', 'help', 'versebase', 'verse_base'])
            or handle ~ 'verse_?base')),
  add constraint profiles_role_known check (
    role is null
    or role = any (array['bounty_hunter', 'miner', 'salvager', 'trader',
                         'commander', 'explorer', 'medic', 'pirate'])),
  add constraint profiles_status_state_known check (
    status_state is null
    or status_state = any (array['online', 'away', 'offline', 'ingame', 'mission'])),
  add constraint profiles_bio_len check (bio is null or char_length(bio) <= 500),
  add constraint profiles_status_text_len check (status_text is null or char_length(status_text) <= 80),
  add constraint profiles_org_name_len check (org_name is null or char_length(org_name) <= 60),
  add constraint profiles_discord_tag_len check (discord_tag is null or char_length(discord_tag) <= 40),
  add constraint profiles_avatar_icon_len check (avatar_icon is null or char_length(avatar_icon) between 1 and 4),
  add constraint profiles_avatar_color_hex check (avatar_color is null or avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint profiles_avatar_url_source check (
    avatar_url is null
    or avatar_url ~ ('^https://trgjhmbnodoarnfmlcqx\.supabase\.co/storage/v1/object/public/avatars/'
                     || id::text || '/avatar(\?v=[0-9]{1,16})?$')
    or avatar_url ~ '^https://cdn\.discordapp\.com/avatars/[0-9]{5,25}/[A-Za-z0-9_]{1,80}\.(png|jpe?g|webp|gif)(\?[A-Za-z0-9=&_-]{0,60})?$'),
  add constraint profiles_banner_url_source check (
    banner_url is null
    or banner_url ~ '^/assets/[A-Za-z0-9_-]{1,60}\.(jpe?g|png|webp)$'
    or banner_url ~ ('^https://trgjhmbnodoarnfmlcqx\.supabase\.co/storage/v1/object/public/banners/'
                     || id::text || '/banner(\?v=[0-9]{1,16})?$'));

-- -------------------------------------------- 2. Zeitstempel ----------------
create or replace function public.profiles_guard_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.created_at := now();
      new.updated_at := now();
    else
      new.created_at := old.created_at;
    end if;
  end if;

  -- Ein Zeitpunkt in der Zukunft hiesse "dauerhaft online".
  if new.last_seen > now() then new.last_seen := now(); end if;
  if new.last_active > now() then new.last_active := now(); end if;
  if new.activity_at > now() then new.activity_at := now(); end if;
  return new;
end;
$$;

-- Triggerfunktion: EXECUTE wird beim Feuern nicht geprueft. Niemand ausser
-- dem Besitzer braucht es (die Supabase-Standardrechte geben es sonst jedem).
revoke all on function public.profiles_guard_times() from public, anon, authenticated;

drop trigger if exists trg_profiles_guard_times on public.profiles;
create trigger trg_profiles_guard_times
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_times();

-- ============================================================================
-- RUECKBAU
--   drop trigger if exists trg_profiles_guard_times on public.profiles;
--   drop function if exists public.profiles_guard_times();
--   alter table public.profiles
--     drop constraint if exists profiles_handle_reserved,
--     drop constraint if exists profiles_role_known,
--     drop constraint if exists profiles_status_state_known,
--     drop constraint if exists profiles_bio_len,
--     drop constraint if exists profiles_status_text_len,
--     drop constraint if exists profiles_org_name_len,
--     drop constraint if exists profiles_discord_tag_len,
--     drop constraint if exists profiles_avatar_icon_len,
--     drop constraint if exists profiles_avatar_color_hex,
--     drop constraint if exists profiles_avatar_url_source,
--     drop constraint if exists profiles_banner_url_source;
-- ============================================================================
