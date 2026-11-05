-- ============================================================
-- Backup-Leserolle vb_backup fuer die taegliche Sicherung.
-- Ablauf, Schluessel und Wiederherstellung: docs/betrieb/datenbank-backup.md
--
-- WARUM EINE EIGENE ROLLE: Die Sicherung braucht einen Datenbankzugang, der
-- ausserhalb dieser Anlage liegt (privates Backup-Repo). Mit dem Passwort von
-- `postgres` laege dort ein Schluessel, der alles aendern und loeschen kann.
-- vb_backup kann nur lesen.
--
-- WAS SIE DARF:
--   * alles lesen: Mitglied von pg_read_all_data (SELECT auf jede Tabelle,
--     View und Sequenz, USAGE auf jedes Schema, auch auth und storage);
--   * an RLS vorbei lesen (BYPASSRLS): pg_dump liest mit row_security = off
--     und bricht sonst an jeder Tabelle mit RLS ab, auth.users eingeschlossen.
--     Gegenprobe in probe-backup.yml: ohne BYPASSRLS reisst der Dump.
-- WAS SIE NICHT DARF: schreiben. Sie ist Mitglied keiner schreibenden Rolle,
-- besitzt nichts, und jede ihrer Sitzungen beginnt read-only. Hoechstens zwei
-- gleichzeitige Verbindungen, Abfragen nach zehn Minuten abgebrochen.
--
-- WAS HIER BEWUSST FEHLT: LOGIN und Passwort. Die Rolle entsteht ohne
-- Anmeldung. Der Betreiber schaltet sie einmal im SQL-Editor frei
-- (docs/betrieb/datenbank-backup.md, Abschnitt Einrichtung), und das Passwort
-- steht danach nur im Secret des privaten Backup-Repos. Ein Passwort in dieser
-- Datei stuende in einem oeffentlichen Repo.
--
-- Auf einem neuen Projekt (Vorschau, Wiederherstellung) entsteht die Rolle
-- mit dieser Datei ebenfalls, aber ohne LOGIN: sie kann dort niemand nutzen,
-- bis jemand sie bewusst freischaltet.
--
-- Rechte von anon, authenticated und PUBLIC aendert diese Datei nicht
-- (supabase/rights.expected.json bleibt unveraendert).
--
-- RUECKBAU (zieht der Sicherung den Zugang, aendert sonst nichts):
--   revoke pg_read_all_data from vb_backup;
--   drop role if exists vb_backup;
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'vb_backup') then
    create role vb_backup with nologin inherit bypassrls
      nosuperuser nocreatedb nocreaterole noreplication connection limit 2;
  end if;
end $$;

grant pg_read_all_data to vb_backup;

alter role vb_backup set default_transaction_read_only = on;
alter role vb_backup set statement_timeout = '10min';

comment on role vb_backup is
  'Nur-Lese-Rolle der taeglichen Sicherung (docs/betrieb/datenbank-backup.md). LOGIN und Passwort setzt nur der Betreiber, nie eine Migration.';

-- Selbstpruefung, auch fuer den Fall, dass es vb_backup vorher schon gab
-- (dann hat "create role" oben nichts gesetzt): genau die Attribute von
-- oben, nichts besitzen, in keiner weiteren Rolle stecken (auch nicht ueber
-- pg_read_all_data), und keine andere Rolle erbt ihre Leserechte oder kann
-- zu ihr wechseln. Die ADMIN-Mitglied-
-- schaft, die Postgres dem Ersteller (postgres) selbst gibt, zaehlt nicht:
-- sie erbt nichts und ist genau das, womit der Betreiber das Passwort setzt.
-- Schlaegt das an, bricht die Migration als Ganzes ab.
do $$
declare
  r record;
  n_besitz int;
  n_rollen int;
  n_mitglieder int;
begin
  select * into r from pg_roles where rolname = 'vb_backup';
  if r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolreplication
     or not r.rolbypassrls or not r.rolinherit or r.rolconnlimit <> 2 then
    raise exception 'backup_leserolle: vb_backup hat unerwartete Attribute (super=%, createdb=%, createrole=%, replication=%, bypassrls=%, inherit=%, connlimit=%) — von Hand pruefen, nicht ueberschreiben',
      r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls, r.rolinherit, r.rolconnlimit;
  end if;
  select (select count(*) from pg_class where relowner = r.oid)
       + (select count(*) from pg_proc where proowner = r.oid)
       + (select count(*) from pg_namespace where nspowner = r.oid)
       + (select count(*) from pg_type where typowner = r.oid)
       + (select count(*) from pg_database where datdba = r.oid)
    into n_besitz;
  -- alle Rollen, in denen vb_backup steckt, auch auf Umwegen (etwa wenn
  -- pg_read_all_data selbst in eine schreibende Rolle gesteckt wurde)
  with recursive oben(oid) as (
    select m.roleid from pg_auth_members m where m.member = r.oid
    union
    select m.roleid from pg_auth_members m join oben o on m.member = o.oid
  )
  select count(*) into n_rollen
    from oben o join pg_roles g on g.oid = o.oid
   where g.rolname <> 'pg_read_all_data';
  select count(*) into n_mitglieder from pg_auth_members
   where roleid = r.oid and (inherit_option or set_option);
  if n_besitz > 0 or n_rollen > 0 or n_mitglieder > 0 then
    raise exception 'backup_leserolle: vb_backup besitzt % Objekte, steckt in % weiteren Rollen und hat % Mitglieder (Soll: 0, 0, 0)', n_besitz, n_rollen, n_mitglieder;
  end if;
end $$;
