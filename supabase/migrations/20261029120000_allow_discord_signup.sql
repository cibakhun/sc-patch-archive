-- Registrierung mit Discord freigeben (Betreiber-Entscheid 29.10.2026,
-- Entscheidungskarte "Sollen neue Leute sich direkt mit Discord registrieren
-- können?" -> "Ja, mit Discord registrieren").
--
-- Hebt D-02 auf (siehe 20260818002000_block_discord_signup.sql): der
-- Discord-Knopf legt jetzt ein Konto an, wenn es zu dem Discord-Konto noch
-- keines gibt. Der Preis, den D-02 vermeiden wollte, ist bewusst angenommen:
-- ein Testpilot kann jetzt ein Konto haben, dessen E-Mail-Adresse von Discord
-- stammt statt aus einer eigenen Bestätigungsmail.
--
-- ⚠ Diese Funktion läuft bei JEDER Registrierung jedes Kontos. Darum, wie bei
-- der Vorgängerin, vorgeführt gegen die lebende Anlage, jeweils in einem
-- DO-Block, der sein Ergebnis per raise exception meldet und damit alles
-- zurückrollt (keine Probe-Konten bleiben liegen):
--   VORHER Discord-Neuanmeldung: ERROR 42501 "Zu diesem Discord-Konto gibt
--     es noch kein Konto auf verse-base.com …" (der alte Riegel)
--   VORHER E-Mail-Registrierung: name=Mail Probe avatar=<NULL> tag=<NULL>
--   NACHHER Discord-Neuanmeldung: name=DC Probe
--     avatar=https://cdn.discordapp.com/avatars/1/abc.png tag=@dcprobe
--   NACHHER Discord ohne eigenes Bild/Anzeigenamen (embed/avatars/2.png,
--     global_name null): name=plainuser avatar=<NULL> tag=@plainuser
--   NACHHER E-Mail-Registrierung: name=Mail Probe avatar=<NULL> tag=<NULL>
--     (zeichengleich zu VORHER)
--   Danach: 0 Probe-Konten in auth.users, 13 Konten / 13 Profile wie zuvor.
-- Angewandt 29.10.2026 12:19 UTC über die Management API als
-- `allow_discord_signup`, nach ausdrücklichem Ja des Betreibers zur
-- Änderung an der gemeinsamen (staging + live) Datenbank.
--
-- Was sich ändert, und nur das:
--   1. Der Discord-Zweig weist nicht mehr ab, sondern legt das Profil an.
--   2. Anzeigename: wie bisher zuerst display_name aus der Registrierung;
--      danach (neu) der selbst gewählte Discord-Name (custom_claims.
--      global_name), dann der Discord-Benutzername (full_name), dann wie
--      bisher der Teil der E-Mail-Adresse vor dem @, zuletzt 'Pilot', damit
--      eine Anmeldung ohne E-Mail nicht an einem leeren Namen scheitert.
--      Für die E-Mail-Registrierung bleibt das Ergebnis gleich (sie setzt
--      weder global_name noch full_name).
--   3. Nur beim Discord-Weg: das eigene Discord-Bild wird Profilbild
--      (nicht Discords Standardbild embed/avatars), und discord_tag wird
--      '@' + Benutzername — dieselbe Form, die die Kontoseite bei einer
--      Verbindung schreibt.
--
-- Weiterhin: kein Trigger wird angelegt oder gedroppt (42501 auf auth.users,
-- siehe Vorgängerin), search_path leer, jede Referenz voll qualifiziert.
-- trg_sync_discord_identity (auth.identities) spiegelt die Discord-ID wie
-- bisher nach discord_role_state, egal ob Neuanmeldung oder Verbindung.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
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
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Pilot'
    ), 60),
    case when is_discord and dc_avatar like 'https://cdn.discordapp.com/avatars/%' then dc_avatar end,
    case when is_discord and dc_user is not null then left('@' || dc_user, 40) end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

comment on function public.handle_new_user() is
  'Legt zu jedem neuen Konto das Profil an (Trigger on_auth_user_created, '
  'AFTER INSERT ON auth.users). Seit 29.10.2026 auch für Neuanmeldungen über '
  'Discord (D-02 aufgehoben): Name, Bild und discord_tag kommen dann aus '
  'Discord. SET search_path TO ''''; jede Referenz MUSS voll qualifiziert sein.';

-- ============================================================================
-- RÜCKBAU -- angewandte Fassung VOR dieser Migration (pg_get_functiondef,
-- 29.10.2026). 1:1 zurückspielen stellt den Riegel D-02 wieder her:
--
-- create or replace function public.handle_new_user()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path to ''
-- as $function$
-- begin
--   if new.raw_app_meta_data ->> 'provider' = 'discord' then
--     raise exception 'Zu diesem Discord-Konto gibt es noch kein Konto auf verse-base.com. Registriere dich zuerst mit E-Mail und Passwort und verknuepfe Discord danach in deinem Konto.'
--       using errcode = 'insufficient_privilege';
--   end if;
--   insert into public.profiles (id, display_name)
--   values (
--     new.id,
--     left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)), 60)
--   )
--   on conflict (id) do nothing;
--   return new;
-- end;
-- $function$;
-- ============================================================================
