-- accounts_profiles_favorites: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260718192134, Name
-- accounts_profiles_favorites, angewandt 18.07.2026 19:21 UTC. Alles unterhalb
-- der Trennlinie ist der dort gespeicherte Wortlaut (statements, mit ';\n'
-- verbunden), zeichengleich.
-- md5 des Wortlauts: d9ca9c0bb0db1a258752b30be8405778
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
-- Erste Migration des Projekts: profiles, favorites, handle_new_user() mit dem
-- Trigger on_auth_user_created auf auth.users und set_updated_at().
-- handle_new_user() ist seither zweimal ersetzt worden
-- (20260818000243_block_discord_signup_in_handle_new_user,
-- 20261029121956_allow_discord_signup). Die Profilspalten bio, avatar_url usw.
-- kamen mit 20260723182225_profiles_extended_columns dazu.
-- ============================================================================
-- VerseBase Accounts: profiles (1:1 auth.users) + favorites, Owner-only RLS.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'User profile, 1:1 to auth.users; auto-created on signup.';

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Auto-Profil bei Signup (display_name aus Metadata oder E-Mail-Localpart).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at automatisch pflegen
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Favoriten (Schiffe, Missionen, Mineralien, Items, Patches, Themen)
create table public.favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ship','mission','mineral','item','patch','topic')),
  slug text not null check (char_length(slug) between 1 and 120),
  label text check (char_length(label) <= 160),
  created_at timestamptz not null default now(),
  unique (user_id, kind, slug)
);

comment on table public.favorites is 'Bookmarked site entities per user (ship/mission/... + slug).';

alter table public.favorites enable row level security;

create policy "favorites_select_own" on public.favorites
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "favorites_insert_own" on public.favorites
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "favorites_delete_own" on public.favorites
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create index favorites_user_idx on public.favorites (user_id, created_at desc);
