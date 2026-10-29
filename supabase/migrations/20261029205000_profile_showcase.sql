-- Kontoseite: Schaufenster und sichtbare Favoriten (29.10.2026, von Krisz
-- im SQL-Editor ausgeführt).
--
-- profiles.showcase: bis zu drei IDs eigener Loadouts (hangar_layouts), die
-- der Pilot auf sein öffentliches Profil heftet. Der Inhalt kommt live über
-- die View public_showcase; gelöschte Loadouts (Grabstein) fallen heraus.
-- profiles.show_favorites: false blendet die Favoriten auf der Pilotenseite
-- aus (public_favorites filtert danach). Standard true = wie bisher.
--
-- Rückweg:
--   drop view public.public_showcase;
--   create or replace view public.public_favorites with (security_barrier = true) as
--     SELECT p.handle, f.kind, f.slug, f.label, f.created_at
--     FROM favorites f JOIN profiles p ON p.id = f.user_id WHERE p.handle IS NOT NULL;
--   alter table public.profiles drop constraint profiles_showcase_shape,
--     drop column showcase, drop column show_favorites;

begin;

alter table public.profiles
  add column if not exists showcase jsonb not null default '[]'::jsonb,
  add column if not exists show_favorites boolean not null default true;

alter table public.profiles drop constraint if exists profiles_showcase_shape;
alter table public.profiles add constraint profiles_showcase_shape
  check (jsonb_typeof(showcase) = 'array'
         and jsonb_array_length(showcase) <= 3
         and pg_column_size(showcase) <= 512);

-- Öffentliche Favoriten nur noch, wenn der Pilot sie zeigt (gleiche Spalten).
create or replace view public.public_favorites with (security_barrier = true) as
 SELECT p.handle,
    f.kind,
    f.slug,
    f.label,
    f.created_at
   FROM favorites f
     JOIN profiles p ON p.id = f.user_id
  WHERE p.handle IS NOT NULL AND p.show_favorites;

-- Schaufenster: die angehefteten Loadouts in ihrer Reihenfolge.
create or replace view public.public_showcase with (security_barrier = true) as
 SELECT p.handle,
    l.id,
    s.pos::integer AS pos,
    l.entry,
    l.updated_at
   FROM profiles p
     CROSS JOIN LATERAL jsonb_array_elements_text(p.showcase) WITH ORDINALITY s(id, pos)
     JOIN hangar_layouts l ON l.user_id = p.id AND l.id = s.id AND NOT l.deleted
  WHERE p.handle IS NOT NULL;

revoke all on public.public_showcase from anon, authenticated;
grant select on public.public_showcase to anon, authenticated;

commit;
