-- Hangar: gespeicherte Layouts (Loadouts) ans Konto binden.
--
-- Nutzerwunsch vom 29.10.2026: „loadouts sollen accountgebunden gespeichert
-- werden". Gemeint sind „Meine Layouts" im Hangar (/hangar.html) und auf der
-- Advanced-Loadout-Seite (/hangar-loadout.html); beide teilen eine Ablage
-- (assets/hangar-layouts.js). Ohne Konto bleibt sie im localStorage, mit Konto
-- ist der localStorage nur noch Spiegel, und syncLayouts() gleicht ihn hier ab.
--
-- Eine Zeile je Layout. entry ist das bereinigte Layout genau in der Form der
-- Ablage ({id, ship, name, slots, racks?, paint?, created, updated}); die Seite
-- prüft es beim Lesen erneut (cleanEntry), deshalb hier nur Größe und Form.
-- rev ist der Zeitpunkt der letzten Änderung (ms, vom Gerät): der größere gewinnt.
-- Löschen setzt deleted und leert entry (Grabstein), damit ein zweites Gerät
-- das Layout nicht aus seinem Spiegel wieder hochlädt.
--
-- Schlüssel ist auth.users.id: hängt später ein weiterer Login (z. B. Discord)
-- am selben Konto, gehören ihm dieselben Layouts.
create table if not exists public.hangar_layouts (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null check (id ~ '^[a-z0-9]{4,32}$'),
  rev        bigint      not null check (rev >= 0),
  deleted    boolean     not null default false,
  entry      jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint hangar_layouts_entry_form check (
    (deleted and entry is null)
    or (not deleted and jsonb_typeof(entry) = 'object' and entry->>'id' = id and pg_column_size(entry) <= 16384)
  )
);

comment on table public.hangar_layouts is
  'Gespeicherte Hangar-Layouts (Loadouts) je Nutzer; entry im Format der Ablage aus assets/hangar-layouts.js, deleted = Grabstein.';

alter table public.hangar_layouts enable row level security;

drop policy if exists hangar_layouts_select_own on public.hangar_layouts;
create policy hangar_layouts_select_own on public.hangar_layouts
  for select using ((select auth.uid()) = user_id);

drop policy if exists hangar_layouts_insert_own on public.hangar_layouts;
create policy hangar_layouts_insert_own on public.hangar_layouts
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists hangar_layouts_update_own on public.hangar_layouts;
create policy hangar_layouts_update_own on public.hangar_layouts
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists hangar_layouts_delete_own on public.hangar_layouts;
create policy hangar_layouts_delete_own on public.hangar_layouts
  for delete using ((select auth.uid()) = user_id);

-- Älterer Stand überschreibt keinen jüngeren: laufen zwei Geräte gleichzeitig,
-- kann ein Upsert mit kleinerem rev nach dem größeren ankommen. Dann bleibt die
-- Zeile, wie sie ist (BEFORE-Trigger liefert NULL = Zeile übersprungen), und
-- der nächste Abgleich des älteren Geräts holt sich den jüngeren Stand.
-- updated_at serverseitig, und eine Obergrenze je Konto (Grabsteine zählen
-- mit): die Seite hält höchstens 200 Layouts, 1000 Zeilen lassen viel Luft
-- und verhindern, dass jemand die Tabelle als beliebige Ablage missbraucht.
create or replace function public.touch_hangar_layout()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.rev < old.rev then
    return null;
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' and (select count(*) from public.hangar_layouts where user_id = new.user_id) >= 1000 then
    raise exception 'hangar_layouts: zu viele Layouts' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_hangar_layout on public.hangar_layouts;
create trigger trg_touch_hangar_layout
  before insert or update on public.hangar_layouts
  for each row execute function public.touch_hangar_layout();
