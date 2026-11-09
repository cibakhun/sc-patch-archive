-- ============================================================
-- zusatz.sql — schreibt das SQL fuer alles, was `supabase db dump` auslaesst.
--
-- Der Schema-Dump der CLI ueberspringt die Schemas auth und storage
-- vollstaendig (Supabase-Doku "Backup and Restore using the CLI", Abschnitt
-- "Schema changes to auth and storage") und legt Tabellen nicht in die
-- Realtime-Publikation. Dieses Projekt haengt aber eigene Dinge dort an:
--   * Trigger auf auth.users und auth.identities (Profil anlegen, Discord-ID
--     spiegeln und beim Trennen aufraeumen),
--   * die Policies auf storage.objects (Profilbilder nur im eigenen Ordner),
--   * public.direct_messages in der Publikation supabase_realtime.
-- Ohne sie liefe eine Wiederherstellung ohne Fehlermeldung durch, und danach
-- bekaemen neue Konten kein Profil, Bilder liessen sich nicht mehr hochladen
-- und Nachrichten kaemen nicht mehr live an.
--
-- Ausgabe: SQL-Text (eine Zeile je Anweisung), wiederholbar (erst entfernen,
-- dann anlegen). Erfasst wird nur, was auf eigene Funktionen zeigt bzw. eigene
-- Policies sind; was die Plattform in auth/storage pflegt, bringt jedes neue
-- Projekt selbst mit. Ob das vollstaendig ist, prueft die Wiederherstellungs-
-- probe ueber katalog.sql (Kategorien trigger, policies, publikation).
-- ============================================================
set search_path = pg_catalog;

select coalesce(string_agg(stmt, E'\n' order by ord, k), '-- keine Zusaetze')
from (
  -- Trigger in auth/storage, die eigene Funktionen aufrufen
  select 1 as ord, tn.nspname || '.' || tc.relname || '.' || t.tgname as k,
         format('DROP TRIGGER IF EXISTS %I ON %I.%I;', t.tgname, tn.nspname, tc.relname) || E'\n'
         || pg_get_triggerdef(t.oid, false) || ';'
         || case when t.tgenabled <> 'O'
                 then E'\n' || format('ALTER TABLE %I.%I %s TRIGGER %I;', tn.nspname, tc.relname,
                                      case t.tgenabled when 'D' then 'DISABLE' when 'A' then 'ENABLE ALWAYS'
                                                       when 'R' then 'ENABLE REPLICA' else 'ENABLE' end, t.tgname)
                 else '' end as stmt
    from pg_trigger t
    join pg_class tc on tc.oid = t.tgrelid
    join pg_namespace tn on tn.oid = tc.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
   where not t.tgisinternal
     and tn.nspname in ('auth', 'storage')
     and pn.nspname in ('public', 'private')
  union all
  -- RLS an Plattformtabellen, an denen eigene Policies haengen. Nur falls
  -- noch aus: die Tabellen gehoeren der Plattform (ALTER TABLE braucht den
  -- Besitzer), und in jedem neuen Projekt ist RLS dort schon an.
  select 2, n.nspname || '.' || c.relname,
         format($f$DO $x$ BEGIN IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = %L::regclass) THEN ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY; END IF; END $x$;$f$,
                n.nspname || '.' || c.relname, n.nspname, c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('auth', 'storage') and c.relkind in ('r', 'p') and c.relrowsecurity
     and exists (select 1 from pg_policies p where p.schemaname = n.nspname and p.tablename = c.relname)
  union all
  -- Policies in auth/storage
  select 3, schemaname || '.' || tablename || '.' || policyname,
         format('DROP POLICY IF EXISTS %I ON %I.%I;', policyname, schemaname, tablename) || E'\n'
         || format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s', policyname, schemaname, tablename, permissive, cmd,
                   (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ') from unnest(roles) r))
         || coalesce(' USING (' || qual || ')', '')
         || coalesce(' WITH CHECK (' || with_check || ')', '') || ';'
    from pg_policies
   where schemaname in ('auth', 'storage')
  union all
  -- eigene Tabellen in Publikationen (Realtime)
  select 4, t.pubname || '.' || t.schemaname || '.' || t.tablename,
         format($f$DO $x$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = %L AND schemaname = %L AND tablename = %L) THEN ALTER PUBLICATION %I ADD TABLE %I.%I; END IF; END $x$;$f$,
                t.pubname, t.schemaname, t.tablename, t.pubname, t.schemaname, t.tablename)
    from pg_publication_tables t
   where t.schemaname in ('public', 'private')
) s;
