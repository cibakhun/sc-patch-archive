-- support_progress_drop_updated_by: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260802163957, Name
-- support_progress_drop_updated_by, angewandt 02.08.2026 16:39 UTC. Alles
-- unterhalb der Trennlinie ist der dort gespeicherte Wortlaut (statements, mit
-- ';\n' verbunden), zeichengleich.
-- md5 des Wortlauts: 6f21684420ceb40bec0658e1da57b1a7
--
-- WARUM DIESE DATEI: die Migration lief direkt gegen die Anlage (Management
-- API) und lag bis heute nicht im Repo. Ohne sie bildet supabase/migrations/
-- die Anlage nicht ab, und `supabase db push` haelt die Live-Historie fuer
-- fremd.
--
-- WAS SIE FUER DIE SEITE BEDEUTET: nichts. Sie ist live angewandt und wird
-- nicht erneut eingespielt. Wortlaut nicht aendern; Korrekturen gehoeren in
-- eine neue Migration.
--
-- Folgemigration zu 20260802163351_support_progress: entfernt updated_by
-- wieder. Die fruehere Repo-Datei hatte beide Schritte zusammengefasst.
-- ============================================================================
-- updated_by faellt weg: die Spalte ist oeffentlich lesbar (select-Regel gilt
-- fuer alle Spalten) und gaebe damit die Nutzer-ID des Admins preis. Fuer eine
-- Seite mit genau einem Admin traegt sie keine Information, die den Preis wert
-- waere. Der Zeitstempel bleibt — er ist der Grund, warum eine handgepflegte
-- Zahl ueberhaupt vertretbar ist.
create or replace function public.support_progress_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.slug := old.slug;
  return new;
end;
$$;

alter table public.support_progress drop column if exists updated_by;
