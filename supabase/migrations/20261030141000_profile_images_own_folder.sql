-- Profilbilder: Lesen ueber die Datenbank nur noch im eigenen Ordner, feste
-- Dateinamen, engere Bucket-Grenzen (30.10.2026). Noch NICHT live
-- eingespielt; der Hauptstrang spielt sie nach Freigabe durch den Betreiber
-- ein.
--
-- AUSGANGSLAGE (live gelesen 29.10.2026): Die Buckets avatars und banners
-- sind public. Ausgeliefert werden die Bilder ueber
-- /storage/v1/object/public/<bucket>/<pfad>; dieser Weg fragt die
-- Zeilenregeln von storage.objects nicht ab. Die allgemeine Lese-Regel
-- profile_images_public_read wird fuer die Auslieferung also nicht
-- gebraucht. Ueber die Datenbank lesen soll nur noch, wer es fuer das
-- eigene Konto braucht. Hochladen ging bisher im eigenen Ordner <uid>/
-- unter jedem Dateinamen.
--
-- WAS SICH AENDERT
--   1. profile_images_public_read faellt weg. Neu ist
--      profile_images_owner_select: angemeldet, nur im eigenen Ordner. Die
--      braucht das Hochladen mit upsert (die Storage-API liest die
--      bestehende Datei beim Ueberschreiben, INSERT ... ON CONFLICT ...
--      RETURNING).
--   2. Anlegen und Ueberschreiben nur noch unter genau dem Namen, den die
--      Seite benutzt (account-dashboard.ts: `${user.id}/${kind}`):
--      avatars/<uid>/avatar und banners/<uid>/banner. Damit gibt es je
--      Nutzer und Bucket hoechstens eine Datei. Loeschen bleibt im ganzen
--      eigenen Ordner erlaubt (profile_images_owner_delete unveraendert).
--   3. Bucket-Grenzen (Abschnitt 3, SQL auf storage.buckets; dasselbe ginge im
--      Dashboard unter Storage -> Bucket -> Edit): nur image/webp und
--      image/png, avatars hoechstens 2 MB, banners hoechstens 4 MB. Die
--      Seite laedt nur den Zuschnitt hoch (canvas.toBlob 'image/webp',
--      512x512 bzw. 1600x450); kann ein Browser kein WebP schreiben, liefert
--      toBlob PNG. Ein PNG dieser Groesse hat hoechstens rund 1,1 MB bzw.
--      2,9 MB. Die Storage-API prueft den angegebenen Content-Type, nicht den
--      Inhalt der Datei; das kann die Datenbank nicht leisten.
--
-- WAS ES FUER DIE SEITE BEDEUTET: nichts Sichtbares. Bilder kommen weiter
-- ueber die oeffentliche Adresse (getPublicUrl), Hochladen und Entfernen im
-- Konto bleiben gleich. delete-account raeumt mit der Service-Rolle auf und
-- ist von RLS nicht betroffen.
--
-- VORAUSSETZUNG (live am 29.10.2026 gezaehlt, nur Anzahlen): 4 Objekte, alle
-- unter <uid>/avatar bzw. <uid>/banner im Ordner ihres Besitzers, alle
-- image/webp, das groesste 43 718 Byte. Keine Datei verliert ihren Zugang.
--   select bucket_id, count(*),
--          count(*) filter (where name = owner_id::text || '/' || case bucket_id when 'avatars' then 'avatar' else 'banner' end) as fester_name,
--          string_agg(distinct metadata->>'mimetype', ','), max((metadata->>'size')::bigint)
--   from storage.objects group by bucket_id;

-- -------------------------------------------- 1.+2. Regeln -----------------
drop policy if exists "profile_images_public_read" on storage.objects;
drop policy if exists "profile_images_owner_select" on storage.objects;
drop policy if exists "profile_images_owner_insert" on storage.objects;
drop policy if exists "profile_images_owner_update" on storage.objects;

create policy "profile_images_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "profile_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar')
    or (bucket_id = 'banners' and name = (select auth.uid())::text || '/banner')
  );

create policy "profile_images_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar')
    or (bucket_id = 'banners' and name = (select auth.uid())::text || '/banner')
  );

-- -------------------------------------------- 3. Bucket-Grenzen ------------
update storage.buckets
   set allowed_mime_types = array['image/webp', 'image/png'],
       file_size_limit = case id when 'avatars' then 2097152 else 4194304 end
 where id in ('avatars', 'banners');

-- -------------------------------------------- 4. Selbstpruefung ------------
do $pruefung$
begin
  if (select count(*) from storage.buckets
       where id in ('avatars', 'banners') and public
         and allowed_mime_types = array['image/webp', 'image/png']
         and file_size_limit = case id when 'avatars' then 2097152 else 4194304 end) <> 2 then
    raise exception 'profile_images_own_folder: Buckets avatars/banners nicht wie erwartet';
  end if;
  if exists (select 1 from pg_catalog.pg_policies
              where schemaname = 'storage' and tablename = 'objects' and cmd in ('SELECT', 'ALL')
                and ('public' = any (roles) or 'anon' = any (roles))) then
    raise exception 'profile_images_own_folder: storage.objects hat noch eine Lese-Regel fuer anon/public';
  end if;
  if (select count(*) from pg_catalog.pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname like 'profile\_images\_owner\_%') <> 4 then
    raise exception 'profile_images_own_folder: erwartet 4 Eigentuemer-Regeln (select, insert, update, delete)';
  end if;
end
$pruefung$;

-- ============================================================================
-- RUECKBAU (Stand vor dieser Migration):
--   drop policy if exists "profile_images_owner_select" on storage.objects;
--   drop policy if exists "profile_images_owner_insert" on storage.objects;
--   drop policy if exists "profile_images_owner_update" on storage.objects;
--   create policy "profile_images_public_read" on storage.objects
--     for select using (bucket_id in ('avatars','banners'));
--   create policy "profile_images_owner_insert" on storage.objects
--     for insert to authenticated
--     with check (bucket_id in ('avatars','banners') and (storage.foldername(name))[1] = auth.uid()::text);
--   create policy "profile_images_owner_update" on storage.objects
--     for update to authenticated
--     using (bucket_id in ('avatars','banners') and (storage.foldername(name))[1] = auth.uid()::text)
--     with check (bucket_id in ('avatars','banners') and (storage.foldername(name))[1] = auth.uid()::text);
--   update storage.buckets
--      set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'],
--          file_size_limit = case id when 'avatars' then 5242880 else 8388608 end
--    where id in ('avatars','banners');
-- ============================================================================
