-- Neuer Anzeigename nie mehr aus der E-Mail-Adresse (30.10.2026). Noch NICHT
-- live eingespielt; der Hauptstrang spielt sie nach Freigabe durch den
-- Betreiber ein.
--
-- AUSGANGSLAGE: handle_new_user (Trigger on_auth_user_created auf
-- auth.users) legt beim Anlegen eines Kontos die Zeile in public.profiles an.
-- Gab die Anmeldung keinen Anzeigenamen mit (das Feld im Registrierformular
-- ist optional) und kam keiner von Discord, nahm die Funktion den Teil der
-- E-Mail-Adresse vor dem @. Der Anzeigename ist fuer andere sichtbar; ein
-- Teil der Anmeldeadresse gehoert dort nicht hin.
--
-- WAS SICH AENDERT: genau eine Zeile im coalesce faellt weg; die Reihenfolge
-- ist jetzt eigener Anzeigename, Discord-Anzeigename (global_name),
-- Discord-Benutzername, sonst 'Pilot'. Grundlage ist die Live-Fassung
-- (pg_get_functiondef am 29.10.2026; live als Version 20261029121956
-- allow_discord_signup gefuehrt, im Repo unter demselben Namen
-- 20261029121956_allow_discord_signup.sql); alles andere ist wortgleich.
--
-- WAS ES FUER DIE SEITE BEDEUTET: wer sich ohne Anzeigenamen registriert,
-- heisst zunaechst "Pilot" und waehlt seinen Namen im Dashboard. Bestehende
-- Profile aendert diese Migration NICHT; ob dort etwas zu tun ist,
-- entscheidet der Betreiber.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  is_discord boolean := new.raw_app_meta_data ->> 'provider' = 'discord';
  dc_avatar text := new.raw_user_meta_data ->> 'avatar_url';
  dc_user text := nullif(new.raw_user_meta_data ->> 'full_name', '');
begin
  insert into public.profiles (id, display_name, avatar_url, discord_tag)
  values (
    new.id,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name', ''),
      dc_user,
      'Pilot'
    ), 60),
    case when is_discord and dc_avatar like 'https://cdn.discordapp.com/avatars/%' then dc_avatar end,
    case when is_discord and dc_user is not null then left('@' || dc_user, 40) end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- create or replace behaelt die Rechte; hier trotzdem ausdruecklich, damit
-- die Migration fuer sich allein stimmt (live: nur service_role).
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================================
-- RUECKBAU: die Live-Fassung von vor dieser Migration erneut einspielen (vor
-- dem Einspielen per pg_get_functiondef sichern; im Repo
-- 20261029120000_allow_discord_signup.sql, nach der Umbenennung auf die
-- Live-Version 20261029121956_allow_discord_signup.sql). Sie ist diese Datei
-- plus die Zeile
--   nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
-- vor 'Pilot'.
-- ============================================================================
