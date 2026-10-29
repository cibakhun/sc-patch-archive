-- Kontoseite Runden 4 + 5 (29.10.2026): Rich Presence und Socials.
--
-- Rich Presence: der Präsenz-Puls (account-lite.js, alle 30 s) schreibt
-- zusätzlich, WAS man gerade auf der Seite macht -- als 'art|Name', z. B.
-- 'hangar|Gladius' oder 'loadout|Cutlass Black'. Die Freundesliste formt
-- daraus "Im Hangar · Gladius". Sichtbar NUR für Freunde und einen selbst,
-- nur solange der Puls frisch ist (3 min, wie die Präsenz), und nur, wenn
-- share_activity an ist (Schalter im Profil, Vorgabe an -- wie bei Discord).
--
-- Socials: drei Namen (Twitch, YouTube, X), gespeichert als reiner Name,
-- nie als Adresse -- die Seite baut den Link selbst, damit kein fremdes Ziel
-- hinter einem Symbol stecken kann. Öffentlich wie Bio und Org.
--
-- Freundschaft wird im View selbst nachgesehen (nicht über are_friends()):
-- social_profiles ist auch für anon lesbar, und eine Funktion im View
-- bräuchte dann ein Ausführungsrecht für anon.
--
-- Die Views werden per create or replace nur HINTEN erweitert (Postgres
-- erlaubt nichts anderes); alle bestehenden Spalten bleiben zeichengleich.
-- public_profiles behält security_barrier, beide behalten ihre Rechte.

alter table public.profiles
  add column if not exists activity text
    check (activity is null or char_length(activity) <= 120),
  add column if not exists activity_at timestamptz,
  add column if not exists share_activity boolean not null default true,
  add column if not exists social_twitch text
    check (social_twitch is null or social_twitch ~ '^[A-Za-z0-9_]{3,25}$'),
  add column if not exists social_youtube text
    check (social_youtube is null or social_youtube ~ '^[A-Za-z0-9_.-]{3,30}$'),
  add column if not exists social_x text
    check (social_x is null or social_x ~ '^[A-Za-z0-9_]{1,15}$');

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
    social_x
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
    social_x
   FROM profiles
  WHERE (handle IS NOT NULL);

-- ============================================================================
-- RÜCKBAU: die beiden Views ohne die hinteren Spalten neu anlegen geht NICHT
-- per create or replace (Spalten entfernen verlangt drop view + create, mit
-- neu zu setzenden Rechten: anon + authenticated SELECT). Die Spalten an
-- profiles können bleiben (nullable / Vorgabe), ohne etwas zu stören.
-- ============================================================================
