-- Discord trennen raeumt auf (30.10.2026). Noch NICHT live eingespielt; der
-- Hauptstrang spielt sie nach Freigabe durch den Betreiber ein.
--
-- AUSGANGSLAGE: Beim Verbinden spiegelt der Trigger trg_sync_discord_identity
-- (AFTER INSERT auf auth.identities) die Discord-ID nach
-- public.discord_role_state, und das Konto-Dashboard uebernimmt Discord-Name
-- (profiles.discord_tag) und auf Wunsch das Discord-Bild (profiles.avatar_url).
-- Fuer das Trennen gab es kein Gegenstueck: nach "Discord trennen" blieben
-- Discord-ID, Testpilot-Spiegel (is_tester), die Rang-Angaben des Bots und die
-- Profilfelder am Konto stehen. Der Bot schrieb weiter auf das alte Konto (er
-- schreibt nach discord_user_id), und dieselbe Discord-ID liess sich keinem
-- anderen Konto zuordnen (discord_user_id ist unique).
--
-- WAS SICH AENDERT: neuer Trigger trg_unsync_discord_identity (AFTER DELETE
-- auf auth.identities, nur provider = 'discord'). Er
--   1. loest die Bindung in discord_role_state (discord_user_id = null,
--      is_tester = false) -- nur, wenn die Zeile genau diese Discord-ID traegt,
--   2. leert dort die Rang-Angaben des Bots (in_guild, level, xp, ...),
--   3. leert in profiles discord_tag, avatar_url nur dann, wenn es ein Bild
--      von cdn.discordapp.com ist (ein selbst hochgeladenes bleibt), und
--      is_tester (der oeffentliche Abzeichen-Spiegel; ohne Verbindung gibt es
--      keine Discord-Wahrheit mehr dahinter).
-- Die Zeile in discord_role_state selbst bleibt (gate_verdict schreibt dort
-- last_staging_seen auch fuer Admins ohne Discord).
--
-- WARUM DREI GETRENNTE BLOECKE MIT EXCEPTION: der Trigger feuert auch, wenn ein
-- Konto geloescht wird (auth.users -> auth.identities ON DELETE CASCADE). Ein
-- Fehler im Aufraeumen darf weder das Trennen noch die Kontoloeschung
-- blockieren -- dasselbe Muster wie sync_discord_identity. Getrennt, damit ein
-- Fehler in einem Teil (z. B. fehlende Rang-Spalten auf einem aelteren Stand)
-- die anderen nicht mitnimmt.
--
-- WAS ES FUER DIE SEITE BEDEUTET: nach "Trennen" zeigt das Profil keinen
-- Discord-Namen und kein Discord-Bild mehr, das Testpilot-Abzeichen
-- verschwindet, und der Zugang zur Vorschau (gate_verdict) endet mit dem
-- naechsten Ausweis. Wer Discord wieder verbindet, bekommt die Rolle beim
-- naechsten Abgleich des Bots (spaetestens nach etwa 2 Minuten) zurueck.
-- Das Dashboard leert dieselben Felder auch sofort im Formular
-- (src/scripts/account-dashboard.ts), damit ein spaeteres Speichern sie nicht
-- zurueckschreibt.
--
-- BESTAND: Zeilen mit einer Discord-ID, zu der es keine passende Identitaet
-- mehr gibt, bekommen einmal Schritt 1 (Bindung loesen, is_tester = false);
-- Rang-Angaben und Profilfelder bleiben dort stehen (am 29.10.2026 gezaehlt:
-- 0 solche Zeilen).

create or replace function public.unsync_discord_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.provider is distinct from 'discord' or old.provider_id is null then
    return old;
  end if;

  -- 1. Bindung im Rollenspiegel loesen.
  begin
    update public.discord_role_state
       set discord_user_id = null,
           is_tester = false,
           updated_at = now()
     where user_id = old.user_id
       and discord_user_id = old.provider_id;
  exception when others then
    raise warning 'unsync_discord_identity: Bindung fuer % nicht geloest: %', old.user_id, sqlerrm;
  end;

  -- 2. Rang-Angaben des Bots (Spalten seit 20261029150000_discord_rank).
  begin
    update public.discord_role_state
       set in_guild = null, level = null, xp = null, total_xp = null,
           prestige = null, rank_key = null, messages = null,
           voice_seconds = null, server_rank = null, server_members = null,
           stats_at = null
     where user_id = old.user_id
       and discord_user_id is null;
  exception when others then
    raise warning 'unsync_discord_identity: Rang-Angaben fuer % nicht geleert: %', old.user_id, sqlerrm;
  end;

  -- 3. Aus Discord uebernommene Profilfelder.
  begin
    update public.profiles
       set discord_tag = null,
           avatar_url = case when avatar_url like 'https://cdn.discordapp.com/%' then null else avatar_url end,
           is_tester = false
     where id = old.user_id
       and (discord_tag is not null
            or avatar_url like 'https://cdn.discordapp.com/%'
            or is_tester);
  exception when others then
    raise warning 'unsync_discord_identity: Profil von % nicht bereinigt: %', old.user_id, sqlerrm;
  end;

  return old;
end;
$$;

revoke all on function public.unsync_discord_identity() from public, anon, authenticated;

drop trigger if exists trg_unsync_discord_identity on auth.identities;
create trigger trg_unsync_discord_identity
  after delete on auth.identities
  for each row execute function public.unsync_discord_identity();

-- Bestand einmal bereinigen (siehe Kopf).
update public.discord_role_state d
   set discord_user_id = null,
       is_tester = false,
       updated_at = now()
 where d.discord_user_id is not null
   and not exists (
     select 1 from auth.identities i
      where i.provider = 'discord'
        and i.provider_id = d.discord_user_id
        and i.user_id = d.user_id
   );

-- ============================================================================
-- RUECKBAU (die geloesten Bindungen kommen damit nicht zurueck; wer Discord
-- wieder verbindet, wird neu gespiegelt):
--   drop trigger if exists trg_unsync_discord_identity on auth.identities;
--   drop function if exists public.unsync_discord_identity();
-- ============================================================================
