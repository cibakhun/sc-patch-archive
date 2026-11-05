-- ============================================================
-- katalog.sql — Bestandsaufnahme einer Datenbank fuer die Sicherung.
--
-- Liefert EIN JSON-Objekt (eine Zeile): welche Objekte es gibt, mit welchen
-- Rechten, und wie viele Zeilen jede Tabelle hat. Keine Nutzerdaten: nur
-- Namen, Definitionen (als md5), Rechte und Zaehlungen.
--
-- Laeuft zweimal je Sicherung (scripts/backup/sichern.sh, wiederherstellen-
-- probe.sh): gegen die Quelle mit der Nur-Lese-Rolle vb_backup und gegen die
-- frisch wiederhergestellte Probe. scripts/verify-backup.mjs vergleicht beide
-- Eintrag fuer Eintrag. Was sich unterscheidet, hat die Wiederherstellung
-- nicht mitgebracht.
--
-- Umfang: die eigenen Schemas public und private vollstaendig; in auth und
-- storage nur, was dieses Projekt dort selbst anlegt (Trigger auf eigene
-- Funktionen, Policies, Bucket-Einstellungen). Was die Plattform in auth und
-- storage pflegt, bringt jedes neue Supabase-Projekt selbst mit.
-- ============================================================
set search_path = pg_catalog;

with
eigen as (
  select oid, nspname from pg_namespace where nspname in ('public', 'private')
),
-- Zeilen zaehlen in genau den Schemas, deren Daten der Dump der CLI
-- mitnimmt (ihre Ausschlussliste fuer --data-only, CLI 3.0.0). Jede hier
-- gezaehlte Tabelle muss einen Datenblock haben, ausser den Plattform-
-- tabellen, die die CLI ausdruecklich auslaesst (NICHT_IM_DATENDUMP in
-- scripts/verify-backup.mjs, dort mit Grund).
tabellen as (
  select c.oid, n.nspname, c.relname, c.relkind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname !~ '^(pg_|_timescaledb_|timescaledb_)'
     and n.nspname not in ('information_schema', 'graphql', 'graphql_public', 'pgsodium', 'pgsodium_masks', 'pgtle',
                           'repack', 'tiger', 'tiger_data', 'topology', 'vault', 'etl', 'extensions', 'pgbouncer',
                           'realtime', '_analytics', '_realtime', '_supavisor')
     and c.relkind in ('r', 'p')
     and not c.relispartition
),
eintraege(kategorie, eintrag) as (
  -- Schemas mit Besitzer und Rechten
  select 'schemas', nspname || ' owner=' || pg_get_userbyid(nspowner) || ' acl=' || coalesce(nspacl, acldefault('n'::"char", nspowner))::text
    from pg_namespace where nspname in ('public', 'private')
  union all
  -- Tabellen, Views, Sequenzen: Art, RLS, Besitzer, Optionen
  select 'relationen', n.nspname || '.' || c.relname || ' kind=' || c.relkind::text || ' rls=' || c.relrowsecurity
         || ' force=' || c.relforcerowsecurity || ' owner=' || pg_get_userbyid(c.relowner)
         || ' opt=' || coalesce(array_to_string(c.reloptions, ','), '-')
    from pg_class c join eigen n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
  union all
  select 'spalten', n.nspname || '.' || c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
         || case when a.attnotnull then ' not null' else '' end
         || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
         || case when a.attgenerated::text <> '' then ' generated' else '' end
         || case when a.attidentity::text <> '' then ' identity=' || a.attidentity::text else '' end
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join eigen n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where a.attnum > 0 and not a.attisdropped and c.relkind in ('r', 'p', 'v', 'm', 'f')
  union all
  select 'constraints', n.nspname || '.' || c.relname || '.' || k.conname || ' ' || pg_get_constraintdef(k.oid, true)
    from pg_constraint k join pg_class c on c.oid = k.conrelid join eigen n on n.oid = c.relnamespace
  union all
  select 'indizes', n.nspname || '.' || i.relname || ' ' || pg_get_indexdef(i.oid)
    from pg_index x join pg_class i on i.oid = x.indexrelid join eigen n on n.oid = i.relnamespace
  union all
  select 'views', n.nspname || '.' || c.relname || ' md5=' || md5(pg_get_viewdef(c.oid, true))
    from pg_class c join eigen n on n.oid = c.relnamespace where c.relkind in ('v', 'm')
  union all
  select 'funktionen', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
         || ' secdef=' || p.prosecdef || ' owner=' || pg_get_userbyid(p.proowner)
         || ' config=' || coalesce(array_to_string(p.proconfig, ','), '-')
         || ' md5=' || md5(pg_get_functiondef(p.oid))
    from pg_proc p join eigen n on n.oid = p.pronamespace
   where p.prokind in ('f', 'p', 'w')
     and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  union all
  -- Aggregate (pg_get_functiondef kann sie nicht beschreiben)
  select 'aggregate', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
         || ' owner=' || pg_get_userbyid(p.proowner)
         || ' sfunc=' || a.aggtransfn::regproc::text || ' stype=' || format_type(a.aggtranstype, null)
         || ' final=' || a.aggfinalfn::regproc::text || ' init=' || coalesce(a.agginitval, '-')
    from pg_proc p join pg_aggregate a on a.aggfnoid = p.oid join eigen n on n.oid = p.pronamespace
   where not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  union all
  -- eigene Typen: Enum mit Werten, Domain mit Basis und Checks, Composite
  -- mit Feldern, Range; Zeilentypen von Tabellen und Array-Typen nicht
  select 'typen', n.nspname || '.' || t.typname || ' typtype=' || t.typtype::text
         || ' owner=' || pg_get_userbyid(t.typowner)
         || coalesce(' werte=' || (select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid), '')
         || case when t.typtype = 'd' then ' basis=' || format_type(t.typbasetype, t.typtypmod) || ' notnull=' || t.typnotnull::text
                 || coalesce(' check=' || (select string_agg(pg_get_constraintdef(k.oid, true), ' ' order by k.conname)
                                             from pg_constraint k where k.contypid = t.oid), '')
                 else '' end
         || case when t.typtype = 'c' then ' felder=' || (select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attnum)
                                                             from pg_attribute a where a.attrelid = t.typrelid and a.attnum > 0 and not a.attisdropped)
                 else '' end
         || ' acl=' || coalesce(t.typacl, acldefault('T'::"char", t.typowner))::text
    from pg_type t join eigen n on n.oid = t.typnamespace
   where t.typtype in ('e', 'd', 'c', 'r', 'm')
     and (t.typtype <> 'c' or (select c.relkind from pg_class c where c.oid = t.typrelid) = 'c')
     and not exists (select 1 from pg_depend d where d.classid = 'pg_type'::regclass and d.objid = t.oid and d.deptype = 'e')
  union all
  -- Trigger: in public/private alle, in auth/storage nur die auf eigene Funktionen
  select 'trigger', tn.nspname || '.' || tc.relname || '.' || t.tgname || ' enabled=' || t.tgenabled::text
         || ' ' || pg_get_triggerdef(t.oid, true)
    from pg_trigger t
    join pg_class tc on tc.oid = t.tgrelid
    join pg_namespace tn on tn.oid = tc.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
   where not t.tgisinternal
     and (tn.nspname in ('public', 'private')
          or (tn.nspname in ('auth', 'storage') and pn.nspname in ('public', 'private')))
  union all
  -- Policies: eigene Schemas und die, die dieses Projekt in auth/storage anlegt
  select 'policies', schemaname || '.' || tablename || '.' || policyname || ' ' || permissive || ' ' || cmd
         || ' to=' || array_to_string(roles, ',') || ' using=' || coalesce(qual, '-') || ' check=' || coalesce(with_check, '-')
    from pg_policies where schemaname in ('public', 'private', 'auth', 'storage')
  union all
  -- RLS-Schalter der Plattformtabellen, an denen eigene Policies haengen
  select 'rls_plattform', n.nspname || '.' || c.relname || ' rls=' || c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('auth', 'storage') and c.relkind in ('r', 'p')
     and exists (select 1 from pg_policies p where p.schemaname = n.nspname and p.tablename = c.relname)
  union all
  -- Rechte, immer die wirksamen: NULL (eingebaute Standardrechte) und eine
  -- ausdrueckliche Liste mit demselben Inhalt sind dasselbe Recht
  select 'rechte_relationen', n.nspname || '.' || c.relname || ' '
         || coalesce(c.relacl, acldefault((case when c.relkind = 'S' then 's' else 'r' end)::"char", c.relowner))::text
    from pg_class c join eigen n on n.oid = c.relnamespace where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
  union all
  select 'rechte_spalten', n.nspname || '.' || c.relname || '.' || a.attname || ' ' || a.attacl::text
    from pg_attribute a join pg_class c on c.oid = a.attrelid join eigen n on n.oid = c.relnamespace
   where a.attacl is not null and a.attnum > 0 and not a.attisdropped
  union all
  select 'rechte_funktionen', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') '
         || coalesce(p.proacl, acldefault('f'::"char", p.proowner))::text
    from pg_proc p join eigen n on n.oid = p.pronamespace
   where not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  union all
  select 'standardrechte', pg_get_userbyid(a.defaclrole) || ' ' || coalesce(n.nspname, '*') || ' ' || a.defaclobjtype::text
         || ' ' || a.defaclacl::text
    from pg_default_acl a left join pg_namespace n on n.oid = a.defaclnamespace
   where pg_get_userbyid(a.defaclrole) = 'postgres'
  union all
  select 'publikation', p.pubname || ' ' || t.schemaname || '.' || t.tablename
    from pg_publication_tables t join pg_publication p on p.pubname = t.pubname
   where t.schemaname in ('public', 'private')
  union all
  select 'erweiterungen', e.extname || ' schema=' || n.nspname
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  union all
  -- eigene Rollen (alles ausser Plattform-Rollen), mit Attributen und Mitgliedschaften
  select 'rollen', r.rolname || ' login=' || r.rolcanlogin || ' inherit=' || r.rolinherit || ' bypassrls=' || r.rolbypassrls
         || ' createrole=' || r.rolcreaterole || ' createdb=' || r.rolcreatedb || ' conn=' || r.rolconnlimit
         || ' config=' || coalesce(array_to_string(r.rolconfig, ','), '-')
         || ' in=' || coalesce((select string_agg(g.rolname, ',' order by g.rolname)
                                  from pg_auth_members m join pg_roles g on g.oid = m.roleid where m.member = r.oid), '-')
    from pg_roles r
   where r.rolname !~ '^(pg_|supabase_|cli_login_)'
     and r.rolname not in ('postgres', 'anon', 'authenticated', 'service_role', 'authenticator', 'dashboard_user',
                           'pgbouncer', 'pgsodium_keyholder', 'pgsodium_keyiduser', 'pgsodium_keymaker', 'pgtle_admin')
  union all
  select 'buckets', b.id || ' public=' || b.public || ' limit=' || coalesce(b.file_size_limit::text, '-')
         || ' mime=' || coalesce(array_to_string(b.allowed_mime_types, ','), '-')
    from storage.buckets b
),
zeilen as (
  select t.nspname || '.' || t.relname as tabelle,
         (xpath('/row/n/text()',
                query_to_xml(format('select count(*) as n from %I.%I', t.nspname, t.relname), false, true, '')))[1]::text::bigint as n
    from tabellen t
)
select json_build_object(
  'erstellt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'server_version', current_setting('server_version'),
  'auth_stand', (select max(version) from auth.schema_migrations),
  'storage_stand', (select max(id) from storage.migrations),
  'migrationen', (select count(*) from supabase_migrations.schema_migrations),
  'letzte_migration', (select max(version) from supabase_migrations.schema_migrations),
  'objekte', (select json_object_agg(kategorie, liste order by kategorie)
                from (select kategorie, json_agg(eintrag order by eintrag) as liste from eintraege group by kategorie) k),
  'zeilen', (select json_object_agg(tabelle, n order by tabelle) from zeilen)
);
