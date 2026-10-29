-- Crafting: „Im Besitz" + Fabricator-Planer ans Konto binden.
--
-- Bis hierher lebten beide Zustände nur im localStorage (craft.owned.v1 /
-- craft.plan.v1) — pro Browser, pro Gerät, und verloren beim Cache-Leeren.
--
-- Schlüssel ist der BLUEPRINT-SLUG, nicht der DB-Index: der localStorage nutzte
-- den Index in crafting-db.json, der sich bei jedem Datamine-Lauf verschiebt
-- (nach einem Patch zeigte „im Besitz" dann auf fremde Blueprints). Der Slug ist
-- derselbe wie in /crafting/<slug>.html und damit patch-stabil.
--
-- Eine Zeile pro Blueprint und Nutzer trägt BEIDE Zustände (owned + Planmenge);
-- der Client upserted auf (user_id, slug) und löscht die Zeile, sobald weder
-- Besitz noch Planmenge übrig ist. RLS wie bei favorites/refinery_jobs:
-- ausschließlich der Eigentümer sieht und schreibt seine Zeilen.
create table if not exists public.crafting_entries (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  slug       text        not null check (char_length(slug) between 1 and 120),
  owned      boolean     not null default false,
  plan_qty   integer     not null default 0 check (plan_qty >= 0 and plan_qty <= 9999),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

comment on table public.crafting_entries is
  'Crafting-Status pro Nutzer und Blueprint-Slug: „im Besitz" + Menge im Fabricator-Planer.';

alter table public.crafting_entries enable row level security;

drop policy if exists crafting_entries_select_own on public.crafting_entries;
create policy crafting_entries_select_own on public.crafting_entries
  for select using ((select auth.uid()) = user_id);

drop policy if exists crafting_entries_insert_own on public.crafting_entries;
create policy crafting_entries_insert_own on public.crafting_entries
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists crafting_entries_update_own on public.crafting_entries;
create policy crafting_entries_update_own on public.crafting_entries
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists crafting_entries_delete_own on public.crafting_entries;
create policy crafting_entries_delete_own on public.crafting_entries
  for delete using ((select auth.uid()) = user_id);

-- updated_at serverseitig setzen: der Client schickt es nicht mit, und bei einem
-- Upsert (ON CONFLICT DO UPDATE) bliebe sonst der alte Zeitstempel stehen.
-- search_path fest verdrahtet (Supabase-Linter 0011): sonst könnte ein Aufrufer
-- mit eigenem search_path bestimmen, welche Objekte die Funktion sieht.
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

drop trigger if exists trg_touch_crafting_entry on public.crafting_entries;
create trigger trg_touch_crafting_entry
  before insert or update on public.crafting_entries
  for each row execute function public.touch_crafting_entry();
