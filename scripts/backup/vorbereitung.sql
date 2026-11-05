-- ============================================================
-- vorbereitung.sql — laeuft VOR schema.sql, wenn eine Sicherung in ein
-- frisches Supabase-Projekt (oder den Probe-Stack) zurueckgespielt wird.
--
-- Ein neues Projekt gibt jeder Tabelle, Sequenz und Funktion, die postgres
-- in public anlegt, per Standardrecht ALL fuer anon, authenticated und
-- service_role. Der Dump stellt die Rechte der Quelle nur durch GRANTs her,
-- er nimmt nichts weg (pg_dump rechnet gegen die eingebauten Standardrechte,
-- nicht gegen die des Ziels). Ohne diesen Schritt haette nach der
-- Wiederherstellung anon wieder Schreibrechte auf jede Tabelle — genau der
-- Zustand, den 20261030100000_rechte_nur_nach_bedarf.sql beseitigt hat.
-- Die Supabase-CLI-Doku nennt den Schritt ("Note on Privilege Migration");
-- service_role kommt hier dazu, weil der Dump auch dessen Rechte je Objekt
-- ausdruecklich setzt. Dass danach alle Rechte der Quelle gleichen, prueft
-- verify-backup.mjs vergleich (Kategorien rechte_* und standardrechte).
-- ============================================================
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
