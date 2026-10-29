-- refinery_jobs: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260719174028, Name
-- refinery_jobs, angewandt 19.07.2026 17:40 UTC. Alles unterhalb der
-- Trennlinie ist der dort gespeicherte Wortlaut (statements, mit ';\n'
-- verbunden), zeichengleich.
-- md5 des Wortlauts: 98332a03a9f94af8e2eed96217d05dc8
--
-- WARUM DIESE DATEI: die Migration lief direkt gegen die Anlage (Management
-- API) und lag bis heute nicht im Repo. Ohne sie bildet supabase/migrations/
-- die Anlage nicht ab, und `supabase db push` haelt die Live-Historie fuer
-- fremd.
--
-- WAS SIE FUER DIE SEITE BEDEUTET: nichts. Sie ist live angewandt und wird
-- nicht erneut eingespielt. Wortlaut nicht aendern; Korrekturen gehoeren in
-- eine neue Migration.
-- ============================================================================
-- Refinery work orders per user. Tracker: figures are entered from the in-game
-- refinery terminal (the exact yield/time/cost economy is server-side in SC).
-- Mirrors the RLS pattern of public.favorites (per-command, own rows only).
create table if not exists public.refinery_jobs (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  station       text not null check (char_length(station) between 1 and 80),
  method        text not null check (char_length(method) between 1 and 60),
  items         jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  input_scu     numeric(12,2) not null default 0 check (input_scu >= 0),
  yield_scu     numeric(12,2) not null default 0 check (yield_scu >= 0),
  cost          numeric(14,2) not null default 0 check (cost >= 0),
  est_value     numeric(14,2) check (est_value is null or est_value >= 0),
  sold_value    numeric(14,2) check (sold_value is null or sold_value >= 0),
  started_at    timestamptz not null default now(),
  ready_at      timestamptz not null,
  collected_at  timestamptz,
  status        text not null default 'active' check (status in ('active','done')),
  note          text check (note is null or char_length(note) <= 500),
  created_at    timestamptz not null default now()
);

comment on table public.refinery_jobs is 'Refinery work orders per user (station/method/ores + timing + value). Tracker; numbers entered from the in-game terminal.';

alter table public.refinery_jobs enable row level security;

create index if not exists refinery_jobs_user_ready_idx  on public.refinery_jobs (user_id, ready_at);
create index if not exists refinery_jobs_user_status_idx on public.refinery_jobs (user_id, status);

create policy refinery_jobs_select_own on public.refinery_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy refinery_jobs_insert_own on public.refinery_jobs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy refinery_jobs_update_own on public.refinery_jobs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy refinery_jobs_delete_own on public.refinery_jobs
  for delete to authenticated using ((select auth.uid()) = user_id);
