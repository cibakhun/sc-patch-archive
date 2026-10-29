-- register_rate_limit_rpc: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260718211825, Name
-- register_rate_limit_rpc, angewandt 18.07.2026 21:18 UTC. Alles unterhalb der
-- Trennlinie ist der dort gespeicherte Wortlaut (statements, mit ';\n'
-- verbunden), zeichengleich.
-- md5 des Wortlauts: e3f40860650acbff7b6dcd20778087cb
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
-- Fix: PostgREST erreicht Nicht-API-Schemas auch mit service_role NICHT —
-- der direkte Tabellenzugriff der Edge Function lief ins Leere (fail-open).
-- Stattdessen eine RPC in public, die Check + Buchung atomar erledigt;
-- EXECUTE ausschließlich für service_role.
create or replace function public.register_rate_ok(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
begin
  select count(*) into recent
  from private.register_attempts
  where ip_hash = p_ip_hash
    and created_at > now() - interval '1 hour';
  if recent >= 5 then
    return false;
  end if;
  insert into private.register_attempts (ip_hash) values (p_ip_hash);
  delete from private.register_attempts where created_at < now() - interval '24 hours';
  return true;
end;
$$;

revoke execute on function public.register_rate_ok(text) from public, anon, authenticated;
grant execute on function public.register_rate_ok(text) to service_role;
