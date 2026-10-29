-- rights.snapshot.sql: wirksame Rechte von anon, authenticated und PUBLIC.
--
-- Liest nur den Katalog (keine Nutzerdaten) und liefert je Objekt EINE Zeile:
--   kind | obj | anon | authenticated | public
-- Die drei Rechtespalten sind kommagetrennt und sortiert, leer = kein Recht.
-- Fuer Tabellen, Views, Sequenzen, Funktionen und Schemas gilt das WIRKSAME
-- Recht (has_*_privilege), also inklusive dessen, was eine Rolle ueber PUBLIC
-- oder eine Mitgliedschaft erbt. Spalten- und Standardrechte sind die
-- ACL-Eintraege selbst: was dort an PUBLIC geht, steht in der Spalte public,
-- und eine Mitgliedschaft von anon/authenticated zeigen die role-Zeilen.
--
-- Erfasst:
--   table/view/sequence/function  alles in den Schemas public und private
--   column                        Spaltenrechte (attacl-Eintraege), wo es welche gibt
--   schema                        USAGE/CREATE auf public und private
--   default                       Standardrechte (ACL-Eintraege), die ein NEUES
--                                 Objekt von postgres bzw. supabase_admin in
--                                 public bekaeme (global + schemabezogen)
--   role                          Attribute und Mitgliedschaften von anon und
--                                 authenticated (erbt eine davon mehr, steht
--                                 es hier)
--   server                        server_version_num als Kennzeile, ohne Rechte
-- Nicht erfasst: storage, auth, realtime -- Plattformschemas, deren Rechte
-- Supabase verwaltet und die Storage-API braucht.
--
-- Laeuft unveraendert auf PG 16 (lokale Replik) und PG 17 (live); MAINTAIN
-- gibt es erst ab 17 und wird nur dort abgefragt.
-- Benutzt von scripts/verify-db-rights.mjs (Management API, read-only) und
-- von Hand: im SQL-Editor ausfuehren, Ergebnis als JSON speichern, dann
--   node scripts/verify-db-rights.mjs --snapshot <datei>
-- Fingerabdruck (derselbe md5, den verify-db-rights fuer eine Momentaufnahme
-- druckt), um eine Abschrift gegen die Datenbank zu pruefen:
--   select count(*), md5(string_agg(l, E'\n' order by l collate "C"))
--   from (select kind||'|'||obj||'|'||anon||'|'||authenticated||'|'||public as l
--         from (<diese Abfrage>) q) z;
with grantees(g) as (
  values ('anon'), ('authenticated'), ('public')
),
v as (
  select pg_catalog.current_setting('server_version_num')::int >= 170000 as pg17
),
tabpriv(p) as (
  values ('DELETE'), ('INSERT'), ('MAINTAIN'), ('REFERENCES'), ('SELECT'), ('TRIGGER'), ('TRUNCATE'), ('UPDATE')
),
seqpriv(p) as (
  values ('SELECT'), ('UPDATE'), ('USAGE')
),
rels as (
  select c.oid, n.nspname, c.relname, c.relkind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private')
    and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
),
relrows as (
  select case r.relkind when 'S' then 'sequence' when 'v' then 'view' when 'm' then 'view' else 'table' end as kind,
         r.nspname || '.' || r.relname as obj,
         gr.g,
         case when r.relkind = 'S' then
           (select pg_catalog.string_agg(s.p, ',' order by s.p)
              from seqpriv s
             where pg_catalog.has_sequence_privilege(gr.g, r.oid, s.p))
         else
           (select pg_catalog.string_agg(t.p, ',' order by t.p)
              from tabpriv t, v
             where case when t.p = 'MAINTAIN' and not v.pg17 then false
                        else pg_catalog.has_table_privilege(gr.g, r.oid, t.p) end)
         end as privs
  from rels r cross join grantees gr
),
colrows as (
  select 'column' as kind,
         n.nspname || '.' || c.relname || '.' || a.attname as obj,
         gr.g,
         (select pg_catalog.string_agg(distinct x.privilege_type, ',' order by x.privilege_type)
            from pg_catalog.aclexplode(a.attacl) x
           where x.grantee = case gr.g when 'public' then 0::oid
                                       else (select ro.oid from pg_catalog.pg_roles ro where ro.rolname = gr.g) end) as privs
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join grantees gr
  where n.nspname in ('public', 'private')
    and a.attnum > 0 and not a.attisdropped
    and a.attacl is not null
),
fnrows as (
  select 'function' as kind,
         n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' as obj,
         gr.g,
         case when pg_catalog.has_function_privilege(gr.g, p.oid, 'EXECUTE') then 'EXECUTE' end as privs
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  cross join grantees gr
  where n.nspname in ('public', 'private')
),
schemarows as (
  select 'schema' as kind,
         n.nspname as obj,
         gr.g,
         (select pg_catalog.string_agg(s.p, ',' order by s.p)
            from (values ('CREATE'), ('USAGE')) s(p)
           where pg_catalog.has_schema_privilege(gr.g, n.oid, s.p)) as privs
  from pg_catalog.pg_namespace n cross join grantees gr
  where n.nspname in ('public', 'private')
),
creators as (
  select ro.oid, ro.rolname from pg_catalog.pg_roles ro where ro.rolname in ('postgres', 'supabase_admin')
),
objtypes(t, acltype, label) as (
  values ('r', 'r', 'tables'), ('S', 's', 'sequences'), ('f', 'f', 'functions')
),
defacl as (
  select cr.rolname, ot.label,
         pg_catalog.array_cat(
           coalesce((select d.defaclacl from pg_catalog.pg_default_acl d
                      where d.defaclrole = cr.oid and d.defaclnamespace = 0 and d.defaclobjtype = ot.t::"char"),
                    pg_catalog.acldefault(ot.acltype::"char", cr.oid)),
           coalesce((select d.defaclacl from pg_catalog.pg_default_acl d
                      join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
                      where d.defaclrole = cr.oid and n.nspname = 'public' and d.defaclobjtype = ot.t::"char"),
                    '{}'::aclitem[])) as acl
  from creators cr cross join objtypes ot
),
defrows as (
  select 'default' as kind,
         'public ' || d.label || ' von ' || d.rolname as obj,
         gr.g,
         (select pg_catalog.string_agg(distinct x.privilege_type, ',' order by x.privilege_type)
            from pg_catalog.aclexplode(d.acl) x
           where x.grantee = case gr.g when 'public' then 0::oid
                                       else (select ro.oid from pg_catalog.pg_roles ro where ro.rolname = gr.g) end) as privs
  from defacl d cross join grantees gr
),
rolerows as (
  select 'role' as kind,
         ro.rolname as obj,
         gr.g,
         case when gr.g = ro.rolname then
           nullif(pg_catalog.concat_ws(',',
             case when ro.rolsuper then 'SUPERUSER' end,
             case when ro.rolbypassrls then 'BYPASSRLS' end,
             case when ro.rolcreaterole then 'CREATEROLE' end,
             case when ro.rolcreatedb then 'CREATEDB' end,
             case when ro.rolreplication then 'REPLICATION' end,
             (select pg_catalog.string_agg('MEMBER:' || pr.rolname, ',' order by pr.rolname)
                from pg_catalog.pg_auth_members m
                join pg_catalog.pg_roles pr on pr.oid = m.roleid
               where m.member = ro.oid)), '')
         end as privs
  from pg_catalog.pg_roles ro cross join grantees gr
  where ro.rolname in ('anon', 'authenticated')
),
metarows as (
  -- Eine Kennzeile ohne Rechte: welcher Server geantwortet hat (MAINTAIN
  -- gibt es erst ab 17, das Tor muss das wissen).
  select 'server' as kind,
         pg_catalog.current_setting('server_version_num') as obj,
         null::text as g,
         null::text as privs
),
alle as (
  select * from relrows
  union all select * from metarows
  union all select * from colrows
  union all select * from fnrows
  union all select * from schemarows
  union all select * from defrows
  union all select * from rolerows
)
select kind, obj,
       coalesce(max(privs) filter (where g = 'anon'), '') as anon,
       coalesce(max(privs) filter (where g = 'authenticated'), '') as authenticated,
       coalesce(max(privs) filter (where g = 'public'), '') as public
from alle
group by kind, obj
order by kind collate "C", obj collate "C"
