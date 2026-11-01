-- Datenbankrechte nur noch nach Bedarf (30.10.2026). Noch NICHT live
-- eingespielt; der Hauptstrang spielt sie nach Freigabe durch den Betreiber
-- ein, als EINE Transaktion.
--
-- AUSGANGSLAGE: Supabase vergibt in public ueber Standardrechte (alter default
-- privileges der Rolle postgres) jedem neuen Objekt sofort alles an anon und
-- authenticated: Tabellen und Views ALL, Sequenzen ALL, Funktionen EXECUTE.
-- Postgres selbst gibt zusaetzlich jeder neuen Funktion EXECUTE an PUBLIC.
-- Schutz kam damit allein aus RLS. Das hat heute gehalten -- jede Tabelle hat
-- RLS --, war aber fuer die Profil-Views (20261029123218) schon einmal nicht
-- genug, und ein "grant select ... to anon" in einer Migration liest sich wie
-- eine Beschraenkung, ohne eine zu sein: ein GRANT fuegt nur hinzu.
--
-- WAS SICH AENDERT
--   1. Standardrechte fuer KUENFTIGE Objekte von postgres:
--      - Funktionen: kein EXECUTE mehr fuer PUBLIC (global, ohne "in schema":
--        das Postgres-Standardrecht ist global und laesst sich schemabezogen
--        nicht zuruecknehmen) und keins fuer anon/authenticated in public.
--      - Tabellen, Views, Sequenzen in public: nichts fuer anon/authenticated.
--      service_role behaelt seine Standardrechte (Edge Functions, Bot).
--   2. Bestehende Objekte in public: anon, authenticated und PUBLIC verlieren
--      alles (auch TRUNCATE, REFERENCES, TRIGGER und MAINTAIN, die kein
--      Client braucht und die RLS nicht abdeckt) ...
--   3. ... und bekommen ausdruecklich zurueck, was die Seite braucht. Abschnitt
--      3 IST damit die Soll-Liste; supabase/rights.expected.json traegt
--      dieselbe Liste fuer das Tor verify:db-rights.
--
-- WOHER DIE SOLL-LISTE KOMMT: aus allen Aufrufstellen in src/, assets/,
-- nginx/gate.js (neu abgeleitet 01.11.2026 gegen den Stand, der mit 2b43b068
-- live gegangen ist; die erste Ableitung stand auf staging bf31efe und war um
-- notification_settings und profile_badges veraltet) -- supabase.from(..),
-- .rpc(..), VBAccount.rest(..), fetch(../rest/v1/..) -- und aus den
-- RLS-Policies (fuer jede Policy, die authenticated erreicht, das passende
-- Recht). Ohne Anmeldung liest die Seite nur public_profiles,
-- public_favorites, public_showcase, tester_credits und support_progress.
-- Schreiben ohne Anmeldung gibt es nirgends. public_showcase ist live seit
-- 29.10.2026 (20261029205000_profile_showcase) und muss vor dieser Migration
-- da sein, sonst bricht ihr GRANT die ganze Migration ab.
--
-- WAS ES FUER DIE SEITE BEDEUTET: nichts, solange sie tut, was sie heute tut.
-- In der lokalen Replik der Live-Datenbank laufen alle 54 nachgebauten
-- Aufrufe (Seite als anon und authenticated, Edge Functions und Bot als
-- service_role) vor und nach dieser Migration gleich durch. Anders wird es nur fuer Aufrufe, die die Seite nie
-- macht: sie enden jetzt mit "permission denied" (PostgREST: 401/403)
-- statt mit einer leeren Antwort. Fuer gate.js heisst ein anonymer Aufruf von
-- gate_verdict damit 401 statt {"grund":"keine-sitzung"}; gate.js behandelt
-- beides als "kein Zugang".
--
-- FUER KUENFTIGE MIGRATIONEN (die eigentliche Aenderung):
--   * Jede neue Tabelle/View/Sequenz/Funktion in public ist fuer anon und
--     authenticated UNSICHTBAR, bis die Migration ausdruecklich granted:
--       grant select, insert on public.neu to authenticated;
--       grant execute on function public.neu_fn(uuid) to authenticated;
--   * Eine Hilfsfunktion, die eine RLS-Policy aufruft (wie are_friends in
--     dm_insert), braucht EXECUTE fuer die Rolle, gegen die die Policy laeuft
--     -- sonst scheitert schon das Lesen mit "permission denied for function".
--   * Neue Funktionen von postgres sind auch ausserhalb von public nicht mehr
--     fuer PUBLIC ausfuehrbar (z. B. in private).
--   * supabase/rights.expected.json im selben Commit nachziehen; sonst meldet
--     verify:db-rights FEHLER (zu viel) bzw. WARNUNG (fehlt).
--   * Das gilt auch fuer Tabellen, die jemand im Supabase-Dashboard anlegt
--     (Table Editor, SQL-Editor laufen als postgres): ohne GRANT antwortet
--     die REST-Schnittstelle mit "permission denied", auch Realtime liefert
--     dann nichts.
--   * Die oeffentlichen Views (public_profiles, public_favorites,
--     public_showcase, tester_credits) lesen profiles mit den Rechten ihres Besitzers. Wer sie
--     auf security_invoker umstellt (etwa wegen eines Advisor-Hinweises),
--     braucht fuer anon zusaetzlich SELECT auf profiles/favorites und eine
--     passende Lese-Policy -- sonst bleibt die Pilotenseite leer.
--
-- NICHT BERUEHRT: service_role und postgres; die Plattformschemas storage,
-- auth, realtime; die Standardrechte der Rolle supabase_admin (postgres kann
-- sie nicht aendern; ein Objekt, das supabase_admin in public anlegt, faengt
-- verify:db-rights). Spaltengenaue Rechte (profiles, support_progress) sind
-- eine eigene Migration; sie muss NACH dieser laufen, sonst weitet Abschnitt
-- 3 sie wieder auf. Abschnitt 0 bricht deshalb ab, wenn schon Spaltenrechte
-- fuer anon, authenticated oder PUBLIC bestehen -- ausgenommen die drei
-- Spalten von notification_settings, die Abschnitt 3 seit 01.11.2026 selbst
-- wieder vergibt (siehe dort).

-- -------------------------------------------- 0. Vorbedingung --------------
-- Abschnitt 2 entzieht mit den Tabellenrechten auch alle Spaltenrechte, und
-- Abschnitt 3 vergibt nur ganze Tabellen. Laeuft eine spaltengenaue Migration
-- (z. B. 20261030133000_support_progress_spaltenrechte) schon vorher, wuerde
-- diese hier sie still wieder aufweiten. Dann lieber abbrechen: zuerst diese
-- Migration einspielen, danach die spaltengenaue noch einmal.
--
-- AUSNAHME (01.11.2026): die drei Spalten von notification_settings. Sie lagen
-- auf der Datenbank, bevor diese Migration eingespielt wurde (20261030180000
-- kam vorher live), und Abschnitt 3 vergibt sie unten wortgleich wieder. Fuer
-- sie ist diese Migration also keine Aufweitung. Die Ausnahme nennt die drei
-- Spalten einzeln: kommt eine vierte Spalte dazu, oder eine Spalte an einer
-- anderen Tabelle, bricht die Vorbedingung weiter ab.
do $vorbedingung$
declare
  v_spalten text;
begin
  select string_agg(distinct c.relname || '.' || a.attname, ', ') into v_spalten
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(a.attacl) x
  where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
    and x.grantee = any (array[0::oid, 'anon'::regrole::oid, 'authenticated'::regrole::oid])
    and (c.relname, a.attname) not in (
      ('notification_settings', 'refinery_site'),
      ('notification_settings', 'refinery_discord'),
      ('notification_settings', 'lang'));
  if v_spalten is not null then
    raise exception 'rechte_nur_nach_bedarf: es gibt schon Spaltenrechte (%) -- diese Migration muss vor den spaltengenauen laufen', v_spalten;
  end if;
end
$vorbedingung$;

-- -------------------------------------------- 1. Standardrechte (kuenftig) --
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- -------------------------------------------- 2. Bestand: alles weg ----------
revoke all on all tables in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated, public;
revoke all on all routines in schema public from anon, authenticated, public;

-- -------------------------------------------- 3. Soll: was die Seite braucht --
-- Ohne Anmeldung (anon): Pilotenseite, Feedback-Danke, Unterstuetzen-Balken.
grant select on public.public_profiles  to anon, authenticated;  -- PilotPage
grant select on public.public_favorites to anon, authenticated;  -- PilotPage
grant select on public.public_showcase  to anon, authenticated;  -- PilotPage (Schaufenster)
grant select on public.tester_credits   to anon, authenticated;  -- FeedbackForm
grant select on public.support_progress to anon, authenticated;  -- SupportBody (Policy: true)
grant select on public.profile_badges   to anon, authenticated;  -- PilotPage (Abzeichen), Konto

-- Angemeldet (authenticated). RLS begrenzt jede Zeile auf das eigene Konto.
grant select                         on public.social_profiles    to authenticated;  -- Freunde, Chat
grant select, insert, update         on public.profiles           to authenticated;  -- Konto, Puls (upsert)
grant select                         on public.user_roles         to authenticated;  -- Rolle; auch in den admin-Policies
grant select, insert, delete         on public.favorites          to authenticated;  -- Flotte, Konto
grant select, insert, delete         on public.friend_requests    to authenticated;  -- annehmen: accept_friend_request
grant select, delete                 on public.friends            to authenticated;  -- anlegen: accept_friend_request
grant select, insert                 on public.direct_messages    to authenticated;  -- gelesen: mark_messages_read
grant select, insert, update, delete on public.refinery_jobs      to authenticated;
grant select, insert, update, delete on public.crafting_entries   to authenticated;
grant select, insert, update, delete on public.mining_sig_presets to authenticated;
grant select, insert, update, delete on public.hangar_layouts     to authenticated;
grant select                         on public.discord_role_state to authenticated;  -- eigene Zeile (Rang)
grant select                         on public.donations          to authenticated;  -- Policy: nur admin
grant insert, update                 on public.support_progress   to authenticated;  -- Policy: nur admin
grant select                         on public.notification_settings to authenticated;  -- RefineryDashboard, account-lite, Datenexport
-- Geschrieben wird nur spaltengenau (user_id fuellt "default auth.uid()").
-- Wortgleich mit 20261030180000, das schon live ist; Abschnitt 0 duldet die
-- drei Spalten deshalb.
grant insert (refinery_site, refinery_discord, lang) on public.notification_settings to authenticated;
grant update (refinery_site, refinery_discord, lang) on public.notification_settings to authenticated;
-- public.tester_blocklist: kein Recht (nur gate_verdict, security definer).
-- public.discord_profile_badges: kein Recht fuer anon/authenticated. Nur der
-- Bot und bot-role-sync lesen sie, beide als service_role -- und Abschnitt 2
-- entzieht service_role nichts, hier fehlt also nichts.
-- Sequenzen: keine. Alle Schluessel sind "generated always as identity";
-- Postgres prueft dabei kein Sequenzrecht.

grant execute on function public.accept_friend_request(uuid) to authenticated;  -- FriendsManager
grant execute on function public.are_friends(uuid, uuid)     to authenticated;  -- Policy dm_insert
grant execute on function public.mark_messages_read(uuid)    to authenticated;  -- FriendsDock
grant execute on function public.gate_verdict()              to authenticated;  -- nginx/gate.js (Nutzer-JWT)
grant execute on function public.tester_overview()           to authenticated;  -- Konto (prueft admin selbst)
-- Triggerfunktionen und handle_new_user/register_rate_ok/donations_bump_progress:
-- kein Recht fuer anon/authenticated/PUBLIC. Postgres prueft EXECUTE nur beim
-- Anlegen eines Triggers, nicht wenn er feuert.

-- -------------------------------------------- 4. Selbstpruefung -------------
-- Bricht die Migration (und damit die ganze Transaktion) ab, wenn das Ergebnis
-- nicht stimmt -- zum Beispiel, weil live ein Objekt existiert, das hier
-- niemand kannte, und ein spaeterer Schritt es wieder geoeffnet haette.
do $pruefung$
declare
  v_offen text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_offen
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and (pg_catalog.has_table_privilege('anon', c.oid, 'INSERT')
      or pg_catalog.has_table_privilege('anon', c.oid, 'UPDATE')
      or pg_catalog.has_table_privilege('anon', c.oid, 'DELETE')
      or pg_catalog.has_table_privilege('anon', c.oid, 'TRUNCATE')
      or pg_catalog.has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      or pg_catalog.has_table_privilege('authenticated', c.oid, 'REFERENCES')
      or pg_catalog.has_table_privilege('authenticated', c.oid, 'TRIGGER'));
  if v_offen is not null then
    raise exception 'rechte_nur_nach_bedarf: noch offen: %', v_offen;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_offen
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('public', p.oid, 'EXECUTE'));
  if v_offen is not null then
    raise exception 'rechte_nur_nach_bedarf: fuer anon/PUBLIC ausfuehrbar: %', v_offen;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) x
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace
      and x.grantee in ('anon'::regrole, 'authenticated'::regrole)
  ) then
    raise exception 'rechte_nur_nach_bedarf: Standardrechte in public geben anon/authenticated noch etwas';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_default_acl d
    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f'
      and not exists (select 1 from pg_catalog.aclexplode(d.defaclacl) x where x.grantee = 0)
  ) then
    raise exception 'rechte_nur_nach_bedarf: neue Funktionen von postgres waeren weiter fuer PUBLIC ausfuehrbar';
  end if;
end
$pruefung$;

-- ============================================================================
-- RUECKBAU
-- Empfohlen: gezielt das eine Recht zurueckgeben, das fehlt, z. B.
--   grant select on public.<tabelle> to authenticated;
--   grant execute on function public.<fn>(<args>) to authenticated;
-- Voller Rueckbau auf den Stand vom 29.10.2026 (oeffnet alles wieder, was
-- diese Migration geschlossen hat; die Views und direct_messages/
-- friend_requests behalten dabei ihren Stand von 20261029123218/145718/145731).
-- Er weitet auch spaeter vergebene Spaltenrechte wieder auf ganze Tabellen
-- auf; eine spaltengenaue Migration danach erneut einspielen. Funktionen, die
-- nach dieser Migration entstanden sind, behalten ihre eigenen Rechte.
--   alter default privileges for role postgres grant execute on functions to public;
--   alter default privileges for role postgres in schema public grant all on functions to anon, authenticated;
--   alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
--   alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
--   grant all on public.crafting_entries, public.discord_role_state, public.donations,
--     public.favorites, public.friend_requests, public.friends, public.hangar_layouts,
--     public.mining_sig_presets, public.profiles, public.refinery_jobs,
--     public.support_progress, public.tester_blocklist, public.user_roles to anon, authenticated;
--   revoke update on public.friend_requests from anon, authenticated;
--   grant all on public.direct_messages to authenticated;
--   grant all on all sequences in schema public to anon, authenticated;
--   grant execute on function public.accept_friend_request(uuid), public.gate_verdict(),
--     public.tester_overview() to anon;
--   grant execute on function public.direct_messages_guard(), public.guard_is_tester(),
--     public.guard_rsi_verified(), public.support_progress_stamp(),
--     public.sync_discord_identity(), public.touch_crafting_entry(),
--     public.touch_hangar_layout(), public.touch_mining_sig_preset()
--     to public, anon, authenticated;
-- ============================================================================
