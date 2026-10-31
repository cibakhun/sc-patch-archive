-- register_rate_limit: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260718211613, Name
-- register_rate_limit, angewandt 18.07.2026 21:16 UTC. Alles unterhalb der
-- Trennlinie ist der dort gespeicherte Wortlaut (statements, mit ';\n'
-- verbunden), zeichengleich.
-- md5 des Wortlauts: 970a31b68fd164a55f3a542dfccb1c55
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
-- Schema private und private.register_attempts fuer das Anmelde-Limit der
-- Function register. Nur service_role hat Zugriff.
-- ============================================================================
-- Rate-Limit-Buchführung für die register-Edge-Function.
-- Schema "private": bewusst NICHT in der PostgREST-API (nur public ist
-- exponiert) — Zugriff ausschließlich für service_role (Edge Function).
-- IPs werden nur als SHA-256-Hash gespeichert (Datensparsamkeit).
create schema if not exists private;

create table private.register_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index register_attempts_ip_time
  on private.register_attempts (ip_hash, created_at desc);

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on private.register_attempts to service_role;
