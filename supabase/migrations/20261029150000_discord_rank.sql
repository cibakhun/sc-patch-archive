-- Kontoseite: Discord-Rang und XP (29.10.2026).
--
-- Der Rang-Bot (discord/bot) zählt XP in seiner eigenen SQLite-Datei. Für
-- Konten, die Discord verbunden haben (discord_role_state, angelegt vom
-- Trigger sync_discord_identity), schreibt er jetzt zusätzlich Level, Rang,
-- XP, Nachrichten, Sprachzeit und Platz auf der Bestenliste hierher -- mit
-- dem Service-Schlüssel, wie schon is_tester (role-sync.mjs). Die Kontoseite
-- liest die eigene Zeile über die bestehende Policy discord_role_state_select_own.
--
-- Öffentlich (Pilotenseite, Freundesliste) erscheinen nur Level, Rang und
-- Prestige, und nur, wenn das Mitglied auf dem Server ist und Discord noch
-- mit dem Konto verbunden ist (die Zeile bleibt nach dem Trennen stehen).
-- Die Views werden wie zuvor nur HINTEN erweitert.

alter table public.discord_role_state
  add column if not exists in_guild boolean,
  add column if not exists level integer,
  add column if not exists xp integer,
  add column if not exists total_xp bigint,
  add column if not exists prestige integer,
  add column if not exists rank_key text,
  add column if not exists messages integer,
  add column if not exists voice_seconds integer,
  add column if not exists server_rank integer,
  add column if not exists server_members integer,
  add column if not exists stats_at timestamptz;

create or replace view public.social_profiles as
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
            WHEN (last_seen IS NULL) THEN 'offline'::text
            WHEN ((now() - last_seen) < '00:01:20'::interval) THEN
            CASE
                WHEN ((last_active IS NOT NULL) AND ((now() - last_active) < '00:03:00'::interval)) THEN 'online'::text
                ELSE 'away'::text
            END
            WHEN ((now() - last_seen) < '00:03:00'::interval) THEN 'away'::text
            ELSE 'offline'::text
        END AS presence,
        CASE
            WHEN share_activity
             AND activity IS NOT NULL
             AND activity_at > (now() - '00:03:00'::interval)
             AND (id = (select auth.uid()) OR EXISTS (
                   SELECT 1 FROM public.friends f
                   WHERE (f.user_id = (select auth.uid()) AND f.friend_id = profiles.id)
                      OR (f.friend_id = (select auth.uid()) AND f.user_id = profiles.id)))
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
   FROM profiles
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
    created_at,
        CASE
            WHEN (last_seen IS NULL) THEN 'offline'::text
            WHEN ((now() - last_seen) < '00:01:20'::interval) THEN
            CASE
                WHEN ((last_active IS NOT NULL) AND ((now() - last_active) < '00:03:00'::interval)) THEN 'online'::text
                ELSE 'away'::text
            END
            WHEN ((now() - last_seen) < '00:03:00'::interval) THEN 'away'::text
            ELSE 'offline'::text
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
   FROM profiles
  WHERE (handle IS NOT NULL);

-- ============================================================================
-- RÜCKBAU: Views ohne die drei hinteren Spalten gehen nur per drop view +
-- create (Rechte neu setzen: anon + authenticated SELECT, public_profiles mit
-- security_barrier). Die Spalten an discord_role_state stören nicht.
-- ============================================================================
