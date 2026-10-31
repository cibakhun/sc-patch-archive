-- crafting_entries_touch_search_path: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260725173248, Name
-- crafting_entries_touch_search_path, angewandt 25.07.2026 17:32 UTC. Alles
-- unterhalb der Trennlinie ist der dort gespeicherte Wortlaut (statements, mit
-- ';\n' verbunden), zeichengleich.
-- md5 des Wortlauts: afc44adb82918f8554879583b53350a9
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
-- Folgemigration zu 20260725171913_crafting_entries: setzt den festen
-- search_path nach. Die fruehere Repo-Datei hatte beide Schritte in einer
-- Datei zusammengefasst.
-- ============================================================================
create or replace function public.touch_crafting_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
