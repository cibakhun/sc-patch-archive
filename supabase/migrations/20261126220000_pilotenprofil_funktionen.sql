-- Pilotenprofile: Zugriffs-Funktionen anlegen (26.11.2026, Stufe 1 von 2).
-- Noch NICHT live eingespielt; der Betreiber gibt den Live-Gang frei.
--
-- ZWEI STUFEN, damit ohne Anmeldung KEIN Fenster entsteht, in dem die
-- Pilotenseite bricht. Beide Stufen werden von Hand eingespielt, NICHT in
-- einem Rutsch:
--   Stufe 1 (DIESE Datei): legt die Zugriffs-Funktionen und die Bremse an und
--     gibt sie anon frei. Rein ergaenzend -- anon behaelt den direkten SELECT
--     auf die Views, die ALTE Seite laeuft unveraendert weiter, die NEUE Seite
--     (anon-Zweig ueber pilot_public) laeuft ebenfalls schon.
--   Dann: PR mergen und die neue Seite + nginx/pilot.js live ausliefern.
--   Stufe 2 (20261126220100_pilotenprofil_abruf_strenger.sql): nimmt anon den
--     direkten SELECT auf die vier Views. Erst JETZT, wenn die neue Seite live
--     ist, sodass keine alte Seite mehr direkt liest.
-- Erst nach Stufe 2 passt der Live-Stand zu rights.expected.json; verify:db-
-- rights (Schiene B) also erst nach Stufe 2 fahren. In der frueheren, EINEN
-- Transaktion (revoke + create zusammen) zeigte die noch live laufende alte
-- Seite fuer anon bis zum Deploy eine Fehlerseite -- das vermeidet die Teilung.
--
-- AUSGANGSLAGE: ohne Anmeldung las die Seite die oeffentlichen Pilotenprofile
-- ueber die Views public_profiles / public_favorites / public_showcase /
-- profile_badges, jede mit SELECT fuer anon (20261030100000, Abschnitt 3).
-- PostgREST laesst damit auch den Abruf OHNE Handle-Filter zu: ein einziger
-- Aufruf gibt alle Profile am Stueck zurueck, einschliesslich der Namen auf
-- Twitch/YouTube/X und der Discord-Werte (Level/Rang/Prestige), ohne Grenze.
-- Die Seite selbst fragt immer genau einen Handle; den Sammelabruf macht sie
-- nie.
--
-- WAS DIESE STUFE ANLEGT
--   Zwei Funktionen liefern anon je EINEN Piloten ueber seinen Handle, nie
--   eine Liste:
--     public.pilot_card(p_handle)   -- schlanke Vorschau (nginx/pilot.js):
--         nur die sieben Karten-Felder, STABLE, ohne Bremse (die Vorschau
--         kommt vom Rand und muss schnell bleiben), keine Socials/Discord.
--     public.pilot_public(p_handle) -- die Profilseite fuer anon: Profil OHNE
--         Socials (Twitch/YouTube/X) und OHNE Discord-Werte (Level/Rang/
--         Prestige), dazu Favoriten, angeheftete Loadouts und das Abzeichen
--         "Profil komplett" -- alles fuer genau diesen Handle. Angemeldet
--         liest die Seite weiter die Views (mit Socials/Discord).
--   Bremse je Anschluss in pilot_public (private.pilot_views): hoechstens 300
--   Abrufe je IP-Schluessel und Stunde. Gezaehlt wird nie die Adresse, nur
--   HMAC-SHA-256(Geheimwert, Adresse) als Hex; der Geheimwert entsteht hier
--   einmalig und steht nur in private.pilot_rate_secret (nie im Repository).
--   Ausfall offen: fehlt die Adresse in den Request-Kopfzeilen oder haengt die
--   Buchfuehrung, laeuft der Abruf durch -- die Bremse ist Schutz vor Masse,
--   keine Zugangskontrolle. Die Adresse liest die Funktion selbst aus den
--   PostgREST-Kopfzeilen (cf-connecting-ip, von Cloudflare vor Supabase gesetzt
--   und gegen Mitgeschicktes ueberschrieben), weil kein Rand davor sitzt, der
--   sie wie bei den Edge Functions mitgibt.
--
-- rights.expected.json ist im selben Commit auf den END-Stand nach Stufe 2
-- gezogen: die vier Views nur noch authenticated, die zwei Funktionen anon+
-- authenticated, die zwei privaten Tabellen und die Sequenz ohne Clientrechte.

-- -------------------------------------------- 1. Bremse: Tabellen -----------
create table if not exists private.pilot_views (
  id         bigint      generated always as identity primary key,
  ip_key     text        not null check (ip_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists pilot_views_key_time on private.pilot_views (ip_key, created_at);
alter table private.pilot_views enable row level security;
revoke all on private.pilot_views from public, anon, authenticated;
revoke all on sequence private.pilot_views_id_seq from public, anon, authenticated;

-- Geheimwert der Bremse: einmalig, nur hier, nie im Repository. Ein blosser
-- SHA-256 einer IPv4-Adresse liesse sich in Minuten zurueckrechnen.
create table if not exists private.pilot_rate_secret (
  secret text not null check (secret ~ '^[0-9a-f]{64}$')
);
alter table private.pilot_rate_secret enable row level security;
revoke all on private.pilot_rate_secret from public, anon, authenticated;
insert into private.pilot_rate_secret (secret)
select encode(extensions.gen_random_bytes(32), 'hex')
where not exists (select 1 from private.pilot_rate_secret);

-- -------------------------------------------- 2. Vorschau (schlank) ---------
-- Nur die sieben Felder der Link-Karte; dieselbe Spaltenliste wie bisher in
-- nginx/pilot.js (COLS). STABLE, damit PostgREST den GET-Aufruf zulaesst.
create or replace function public.pilot_card(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(x)
  from (
    select handle, display_name, bio, banner_url, avatar_url, avatar_color, org_name
    from public.public_profiles
    where handle = p_handle
      and p_handle ~ '^[a-z0-9_]{3,24}$'
  ) x;
$$;

comment on function public.pilot_card(text) is
  'Link-Vorschau eines Piloten (nginx/pilot.js): die sieben Karten-Felder zu '
  'genau einem Handle, ohne Socials/Discord, ohne Bremse. Nur ueber den '
  'Handle, nie eine Liste.';

revoke all on function public.pilot_card(text) from public;
grant execute on function public.pilot_card(text) to anon, authenticated;

-- -------------------------------------------- 3. Profilseite (anon) ---------
-- Ein Profil ueber seinen Handle: Kern OHNE Socials/Discord, dazu Favoriten,
-- angeheftete Loadouts und das Abzeichen "Profil komplett". Liest die Views
-- mit den Rechten des Besitzers (security definer), anon braucht auf ihnen
-- also kein SELECT. Mit Bremse je Anschluss (fail-open).
create or replace function public.pilot_public(p_handle text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hdr     text;
  v_ip      text := '';
  v_secret  text;
  v_key     text;
  recent    int;
  v_profile jsonb;
begin
  if p_handle is null or p_handle !~ '^[a-z0-9_]{3,24}$' then
    return null;
  end if;

  -- Bremse je Anschluss. Scheitert hier irgendetwas, laeuft der Abruf durch.
  begin
    v_hdr := pg_catalog.current_setting('request.headers', true);
    if v_hdr is not null then
      v_ip := coalesce(
        nullif(pg_catalog.btrim((v_hdr::jsonb) ->> 'cf-connecting-ip'), ''),
        nullif(pg_catalog.btrim((v_hdr::jsonb) ->> 'x-real-ip'), ''),
        ''
      );
    end if;
    if v_ip <> '' then
      select secret into v_secret from private.pilot_rate_secret limit 1;
      if v_secret is not null then
        v_key := pg_catalog.encode(extensions.hmac('pilot:' || v_ip, v_secret, 'sha256'), 'hex');
        -- KEINE Sperre: anonymer Heiss-Pfad an einem gemeinsamen Verbindungs-
        -- pool. Ein Wartesperre (pg_advisory_xact_lock) koennte unter einer
        -- Flut desselben Anschlusses den Pool stauen; eine Versuchssperre
        -- (pg_try_advisory_xact_lock) zaehlte bei Nicht-Erhalt NICHT und
        -- lieferte dennoch, sodass parallele Abrufe desselben Anschlusses die
        -- Grenze beliebig ueberliefen. Darum ungesperrt: jeder Abruf zaehlt.
        -- Bei Gleichzeitigkeit kann die Grenze um die Zahl zeitgleicher Abrufe
        -- ueberschritten werden, bevor die Eintraege sichtbar sind -- fuer
        -- einen Massen-Schutz von 300/h belanglos, und anders als bisher
        -- gedeckelt statt offen.
        delete from private.pilot_views where created_at < now() - interval '1 hour';
        select count(*) into recent
        from private.pilot_views
        where ip_key = v_key and created_at > now() - interval '1 hour';
        if recent >= 300 then
          return pg_catalog.jsonb_build_object('throttled', true);
        end if;
        insert into private.pilot_views (ip_key) values (v_key);
      end if;
    end if;
  exception when others then
    null; -- Buchfuehrung kaputt -> ungebremst, Profil trotzdem liefern.
  end;

  select to_jsonb(pp)
           - 'social_twitch' - 'social_youtube' - 'social_x'
           - 'discord_level' - 'discord_rank' - 'discord_prestige'
    into v_profile
  from public.public_profiles pp
  where pp.handle = p_handle;

  if v_profile is null then
    return null; -- unbekannter Handle
  end if;

  return pg_catalog.jsonb_build_object(
    'profile', v_profile,
    'favorites', coalesce(
      (select pg_catalog.jsonb_agg(to_jsonb(f) order by f.created_at desc)
         from public.public_favorites f where f.handle = p_handle),
      '[]'::jsonb),
    'showcase', coalesce(
      (select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object('id', s.id, 'pos', s.pos, 'entry', s.entry)
                order by s.pos)
         from public.public_showcase s where s.handle = p_handle),
      '[]'::jsonb),
    'badge', (select b.profile_complete from public.profile_badges b where b.handle = p_handle)
  );
end;
$$;

comment on function public.pilot_public(text) is
  'Oeffentliche Pilotenseite fuer anon: ein Profil ueber seinen Handle, OHNE '
  'Socials/Discord, mit Favoriten/Loadouts/Abzeichen. Hoechstens 300 Abrufe '
  'je IP-Schluessel (HMAC, nie die Adresse) und Stunde; fail-open, ungesperrt. '
  'Nie eine Liste.';

revoke all on function public.pilot_public(text) from public;
grant execute on function public.pilot_public(text) to anon, authenticated;

-- -------------------------------------------- 4. Selbstpruefung (Stufe 1) ---
-- Nur die ergaenzenden Rechte dieser Stufe. Den Entzug des anon-SELECT prueft
-- Stufe 2. anon behaelt hier noch SELECT auf die Views -- das ist gewollt.
do $pruefung$
begin
  if not (pg_catalog.has_function_privilege('anon', 'public.pilot_card(text)', 'EXECUTE')
     and pg_catalog.has_function_privilege('anon', 'public.pilot_public(text)', 'EXECUTE')) then
    raise exception 'pilotenprofil_funktionen: anon kann die Profil-Funktionen nicht ausfuehren';
  end if;
  if pg_catalog.has_function_privilege('public', 'public.pilot_card(text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('public', 'public.pilot_public(text)', 'EXECUTE') then
    raise exception 'pilotenprofil_funktionen: PUBLIC kann eine Profil-Funktion ausfuehren';
  end if;
  if pg_catalog.has_table_privilege('anon', 'private.pilot_views', 'SELECT,INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'private.pilot_views', 'SELECT,INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('anon', 'private.pilot_rate_secret', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'private.pilot_rate_secret', 'SELECT') then
    raise exception 'pilotenprofil_funktionen: eine private Tabelle ist fuer Clients erreichbar';
  end if;
  if not exists (select 1 from private.pilot_rate_secret) then
    raise exception 'pilotenprofil_funktionen: kein Geheimwert fuer die Bremse';
  end if;
end
$pruefung$;

-- ============================================================================
-- RUECKBAU Stufe 1 (nur noetig, wenn Stufe 2 NICHT lief; sonst erst Stufe 2
-- zuruecknehmen, dann dies):
--   drop function if exists public.pilot_public(text);
--   drop function if exists public.pilot_card(text);
--   drop table if exists private.pilot_views;
--   drop table if exists private.pilot_rate_secret;
-- ============================================================================
