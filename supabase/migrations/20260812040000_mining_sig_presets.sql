-- Mining-Werkbank: benannte Presets der Signaturenliste ans Konto binden.
--
-- Die angeheftete Signaturenliste lebt weiterhin im localStorage — sie ist der
-- Arbeitsstand und soll auch ohne Konto funktionieren. Was hier ans Konto geht,
-- ist etwas anderes: BENANNTE Zusammenstellungen („Pyro-Runde", „Quant-Jagd"),
-- die man wieder aufruft. Nutzerwunsch vom 12.08.2026, ausdrücklich auf die
-- Signaturenliste begrenzt („erstmal nur signaturen liste"); die Fundorte
-- bekommen dieselbe Mechanik erst, wenn sie beauftragt ist.
--
-- Schlüssel ist der MINERALNAME, nicht der DataCore-GUID und nicht der Index in
-- mining-db.json. Beide verschieben sich mit dem Patch bzw. mit jedem
-- Datamine-Lauf; der Name ist derselbe, den die Seite anzeigt und den die
-- Tieflinks aus der Crafting-DB benutzen (?mineral=<Name>). Genau dieser Fehler
-- ist bei Crafting einmal bezahlt worden (dort stand der DB-Index im Speicher).
--
-- Ein Preset ist EINE Zeile mit einem Array statt N Zeilen: es wird immer als
-- Ganzes geschrieben und als Ganzes geladen, nie einzeln ergänzt. RLS wie bei
-- favorites/crafting_entries — ausschließlich der Eigentümer sieht und schreibt.
create table if not exists public.mining_sig_presets (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  name       text        not null check (char_length(btrim(name)) between 1 and 60),
  minerals   text[]      not null default '{}'::text[]
                         check (array_length(minerals, 1) is null or array_length(minerals, 1) <= 64),
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

comment on table public.mining_sig_presets is
  'Benannte Zusammenstellungen der Signaturenliste in der Mining-Werkbank, je Nutzer. Schlüssel der Einträge ist der Mineralname.';

alter table public.mining_sig_presets enable row level security;

drop policy if exists mining_sig_presets_select_own on public.mining_sig_presets;
create policy mining_sig_presets_select_own on public.mining_sig_presets
  for select using ((select auth.uid()) = user_id);

drop policy if exists mining_sig_presets_insert_own on public.mining_sig_presets;
create policy mining_sig_presets_insert_own on public.mining_sig_presets
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists mining_sig_presets_update_own on public.mining_sig_presets;
create policy mining_sig_presets_update_own on public.mining_sig_presets
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists mining_sig_presets_delete_own on public.mining_sig_presets;
create policy mining_sig_presets_delete_own on public.mining_sig_presets
  for delete using ((select auth.uid()) = user_id);

-- updated_at serverseitig setzen: der Client schickt es nicht mit, und bei einem
-- Upsert (ON CONFLICT DO UPDATE) bliebe sonst der alte Zeitstempel stehen.
-- search_path fest verdrahtet (Supabase-Linter 0011).
create or replace function public.touch_mining_sig_preset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_mining_sig_preset on public.mining_sig_presets;
create trigger trg_touch_mining_sig_preset
  before insert or update on public.mining_sig_presets
  for each row execute function public.touch_mining_sig_preset();
