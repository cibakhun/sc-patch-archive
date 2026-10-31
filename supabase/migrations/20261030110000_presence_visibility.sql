-- Online-Status: wer ihn sieht, entscheidet der Nutzer (30.10.2026).
-- Entscheidung des Betreibers vom 29.10.: "standardmaessig nur Freunde, sonst
-- aber auch einstellbar vom User".
--
-- WAS SICH AENDERT
--   profiles.presence_visibility (neu): 'friends' (Vorgabe, auch fuer alle
--   bestehenden Konten), 'all' oder 'none'. Andere Werte lehnt der CHECK ab;
--   schreiben darf jeder nur die eigene Zeile (bestehende RLS profiles_*_own).
--
--   public_profiles (auch ohne Anmeldung lesbar, Pilotenseite):
--     presence nur bei 'all', sonst null.
--   social_profiles (nur angemeldet, Freundesliste):
--     presence fuer die eigene Zeile, bei 'all' fuer jeden, bei 'friends'
--     nur fuer bestaetigte Freunde (Zeile in public.friends), sonst null.
--     activity ("Im Hangar · Gladius") bleibt wie bisher an share_activity
--     und an die Freundschaft gebunden -- auch bei 'all' sehen sie nur
--     Freunde, so verspricht es der Schalter -- und faellt bei 'none' weg.
--
--   Bei 'none' leert ein Trigger last_seen, last_active, activity und
--   activity_at bei jedem Schreiben der Zeile. Damit wird nichts mehr
--   gespeichert, auch nicht von aelteren Seitenstaenden, die den Puls noch
--   ohne Ruecksicht auf die Einstellung schicken. Das Umschalten auf 'none'
--   leert die Werte sofort mit.
--
-- WARUM
--   Bisher zeigten beide Views den abgeleiteten Status (online/abwesend/
--   offline) jedem, der sie lesen durfte -- public_profiles auch ohne
--   Anmeldung, fuer alle Konten mit Handle, ohne Einstellung.
--
-- NEBENBEI (Datensparsamkeit, gleiche Views)
--   public_profiles.created_at: nur noch der Monat (Monatsmitte, damit die
--     Anzeige "Dabei seit <Monat Jahr>" in jeder Zeitzone den richtigen
--     Monat zeigt; Typ bleibt timestamptz).
--   public_favorites.created_at: nur noch der Tag (UTC-Mitternacht).
--     Ausgeblendete Favoriten (show_favorites = false) bleiben ausgeblendet;
--     die Bedingung stammt aus 20261029205000_profile_showcase (live seit
--     29.10.2026) und steht unten wortgleich.
--   social_profiles: security_barrier wie die anderen drei Views.
--
-- WAS ES FUER DIE SEITE HEISST
--   Spalten, Reihenfolge und Typen bleiben gleich (create or replace), die
--   Rechte bleiben erhalten (public_profiles/public_favorites: SELECT fuer
--   anon + authenticated; social_profiles: SELECT nur authenticated).
--   presence kann jetzt null sein. Der heutige Seitenstand zeigt null als
--   "Offline", der neue blendet den Punkt dann aus. Die Pilotenseite fragt
--   angemeldet social_profiles, damit Freunde und man selbst den Status
--   dort weiter sehen. Der Puls (account-lite.js) sendet bei 'none' nicht.
--
-- Die Freundschaft sieht social_profiles wie bisher bei activity selbst in
-- public.friends nach (EXISTS mit den Rechten des View-Besitzers), nicht ueber
-- public.are_friends(): sonst haengt jede Abfrage der View am EXECUTE-Recht
-- des Lesers auf dieser Funktion, und wer es spaeter entzieht, legt die
-- Freundesliste lahm. Ohne Anmeldung (auth.uid() null) gibt es keine
-- Freundschaft; bekaeme anon je wieder SELECT auf social_profiles, saehe es
-- den Status also nur bei 'all', wie in public_profiles.

-- ------------------------------------------------------------ Vorbedingung --
-- Ohne profiles.show_favorites gaebe es die Bedingung in public_favorites
-- nicht; dann ist der Live-Stand ein anderer als der, gegen den diese Datei
-- geschrieben ist. Abbruch ohne Aenderung.
do $vorbedingung$
begin
  if not exists (select 1 from pg_catalog.pg_attribute
                 where attrelid = 'public.profiles'::regclass
                   and attname = 'show_favorites' and not attisdropped) then
    raise exception 'presence_visibility: profiles.show_favorites fehlt -- zuerst 20261029205000_profile_showcase einspielen';
  end if;
end
$vorbedingung$;

alter table public.profiles
  add column if not exists presence_visibility text not null default 'friends'
    constraint profiles_presence_visibility_check
    check (presence_visibility in ('friends', 'all', 'none'));

-- ------------------------------------------------------------ 'none' leert --
create or replace function public.presence_none_clears()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.presence_visibility = 'none' then
    new.last_seen := null;
    new.last_active := null;
    new.activity := null;
    new.activity_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.presence_none_clears() from public, anon, authenticated;

drop trigger if exists trg_presence_none_clears on public.profiles;
create trigger trg_presence_none_clears
  before insert or update on public.profiles
  for each row execute function public.presence_none_clears();

-- ------------------------------------------------------------------- Views --
create or replace view public.social_profiles with (security_barrier = true) as
 SELECT id,
    handle,
    display_name,
    avatar_url,
    avatar_icon,
    avatar_color,
    role,
    status_state,
    status_text,
    rsi_verified,
    org_name,
        CASE
            WHEN id = (select auth.uid())
              OR presence_visibility = 'all'
              OR (presence_visibility = 'friends' AND EXISTS (SELECT 1 FROM public.friends f
                    WHERE (f.user_id = (select auth.uid()) AND f.friend_id = profiles.id)
                       OR (f.friend_id = (select auth.uid()) AND f.user_id = profiles.id)))
            THEN
            CASE
                WHEN (last_seen IS NULL) THEN 'offline'::text
                WHEN ((now() - last_seen) < '00:01:20'::interval) THEN
                CASE
                    WHEN ((last_active IS NOT NULL) AND ((now() - last_active) < '00:03:00'::interval)) THEN 'online'::text
                    ELSE 'away'::text
                END
                WHEN ((now() - last_seen) < '00:03:00'::interval) THEN 'away'::text
                ELSE 'offline'::text
            END
        END AS presence,
        CASE
            WHEN share_activity
             AND activity IS NOT NULL
             AND activity_at > (now() - '00:03:00'::interval)
             AND (id = (select auth.uid())
                  OR (presence_visibility <> 'none' AND EXISTS (SELECT 1 FROM public.friends f
                        WHERE (f.user_id = (select auth.uid()) AND f.friend_id = profiles.id)
                           OR (f.friend_id = (select auth.uid()) AND f.user_id = profiles.id))))
            THEN activity
        END AS activity,
    social_twitch,
    social_youtube,
    social_x,
    (SELECT d.level FROM public.discord_role_state d
      WHERE d.user_id = profiles.id AND d.in_guild AND d.stats_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth.identities i
                    WHERE i.user_id = profiles.id AND i.provider = 'discord'
                      AND i.provider_id = d.discord_user_id)) AS discord_level,
    (SELECT d.rank_key FROM public.discord_role_state d
      WHERE d.user_id = profiles.id AND d.in_guild AND d.stats_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth.identities i
                    WHERE i.user_id = profiles.id AND i.provider = 'discord'
                      AND i.provider_id = d.discord_user_id)) AS discord_rank,
    (SELECT d.prestige FROM public.discord_role_state d
      WHERE d.user_id = profiles.id AND d.in_guild AND d.stats_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth.identities i
                    WHERE i.user_id = profiles.id AND i.provider = 'discord'
                      AND i.provider_id = d.discord_user_id)) AS discord_prestige
   FROM public.profiles
  WHERE (handle IS NOT NULL);

create or replace view public.public_profiles with (security_barrier = true) as
 SELECT handle,
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
    (date_trunc('month', created_at) + '14 days'::interval) AS created_at,
        CASE
            WHEN presence_visibility = 'all' THEN
            CASE
                WHEN (last_seen IS NULL) THEN 'offline'::text
                WHEN ((now() - last_seen) < '00:01:20'::interval) THEN
                CASE
                    WHEN ((last_active IS NOT NULL) AND ((now() - last_active) < '00:03:00'::interval)) THEN 'online'::text
                    ELSE 'away'::text
                END
                WHEN ((now() - last_seen) < '00:03:00'::interval) THEN 'away'::text
                ELSE 'offline'::text
            END
        END AS presence,
    is_tester,
    social_twitch,
    social_youtube,
    social_x,
    (SELECT d.level FROM public.discord_role_state d
      WHERE d.user_id = profiles.id AND d.in_guild AND d.stats_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth.identities i
                    WHERE i.user_id = profiles.id AND i.provider = 'discord'
                      AND i.provider_id = d.discord_user_id)) AS discord_level,
    (SELECT d.rank_key FROM public.discord_role_state d
      WHERE d.user_id = profiles.id AND d.in_guild AND d.stats_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth.identities i
                    WHERE i.user_id = profiles.id AND i.provider = 'discord'
                      AND i.provider_id = d.discord_user_id)) AS discord_rank,
    (SELECT d.prestige FROM public.discord_role_state d
      WHERE d.user_id = profiles.id AND d.in_guild AND d.stats_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth.identities i
                    WHERE i.user_id = profiles.id AND i.provider = 'discord'
                      AND i.provider_id = d.discord_user_id)) AS discord_prestige
   FROM public.profiles
  WHERE (handle IS NOT NULL);

create or replace view public.public_favorites with (security_barrier = true) as
 SELECT p.handle,
    f.kind,
    f.slug,
    f.label,
    date_trunc('day', f.created_at) AS created_at
   FROM (public.favorites f
     JOIN public.profiles p ON ((p.id = f.user_id)))
  WHERE ((p.handle IS NOT NULL) AND p.show_favorites);

-- ============================================================================
-- RUECKBAU (in dieser Reihenfolge; Spalten und Typen bleiben gleich, also
-- geht alles per create or replace, die Rechte bleiben erhalten):
--   1. die drei Views mit den Definitionen aus 20261029150000_discord_rank.sql
--      (social_profiles, public_profiles) bzw. 20261029205000_profile_showcase.sql
--      (public_favorites, f.created_at, mit show_favorites) neu setzen, danach
--      alter view public.social_profiles reset (security_barrier);
--   2. drop trigger if exists trg_presence_none_clears on public.profiles;
--      drop function if exists public.presence_none_clears();
--   3. alter table public.profiles drop column if exists presence_visibility;
-- Von 'none' geleerte Zeitpunkte kommen nicht zurueck; der naechste Puls
-- schreibt sie neu.
-- ============================================================================
