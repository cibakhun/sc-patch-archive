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

-- Selbstpruefung: die Rolle darf nichts besitzen und in keiner schreibenden
-- Rolle stecken. Schlaegt das an, bricht die Migration als Ganzes ab.
do $$
declare
  n_besitz int;
  n_rollen int;
begin
  select count(*) into n_besitz from pg_class c join pg_roles r on r.oid = c.relowner where r.rolname = 'vb_backup';
  select count(*) into n_rollen
    from pg_auth_members m
    join pg_roles g on g.oid = m.roleid
    join pg_roles r on r.oid = m.member
   where r.rolname = 'vb_backup' and g.rolname <> 'pg_read_all_data';
  if n_besitz > 0 or n_rollen > 0 then
    raise exception 'backup_leserolle: vb_backup besitzt % Objekte und steckt in % weiteren Rollen (Soll: 0 und 0)', n_besitz, n_rollen;
  end if;
end $$;
