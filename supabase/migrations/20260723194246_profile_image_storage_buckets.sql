-- profile_image_storage_buckets: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260723194246, Name
-- profile_image_storage_buckets, angewandt 23.07.2026 19:42 UTC. Alles
-- unterhalb der Trennlinie ist der dort gespeicherte Wortlaut (statements, mit
-- ';\n' verbunden), zeichengleich.
-- md5 des Wortlauts: 8ebef4b17269f56c0f4f973322ced46e
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
-- Legt die Buckets avatars und banners an und die vier Policies auf
-- storage.objects. Die Buckets sind Konfiguration, keine Nutzerdaten.
-- ============================================================================
-- Storage-Buckets fuer echte Profil-Bild-Uploads (Avatar + Banner).
-- Oeffentlich lesbar (fuer /pilot + Nav), Schreiben nur im eigenen Ordner
-- <auth.uid()>/... . Groessen-/MIME-Limits auf Bucket-Ebene.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880,  array['image/jpeg','image/png','image/webp','image/gif']),
  ('banners', 'banners', true, 8388608,  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS-Policies auf storage.objects (RLS ist dort standardmaessig aktiv).
-- Idempotent: alte Versionen zuerst droppen.

drop policy if exists "profile_images_public_read"   on storage.objects;
drop policy if exists "profile_images_owner_insert"   on storage.objects;
drop policy if exists "profile_images_owner_update"   on storage.objects;
drop policy if exists "profile_images_owner_delete"   on storage.objects;

-- Jeder darf lesen (Buckets sind public; erlaubt zusaetzlich Auflisten).
create policy "profile_images_public_read" on storage.objects
  for select
  using (bucket_id in ('avatars','banners'));

-- Eingeloggte Nutzer schreiben NUR in ihren eigenen Ordner (<uid>/...).
create policy "profile_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars','banners')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_images_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars','banners')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatars','banners')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile_images_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars','banners')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
