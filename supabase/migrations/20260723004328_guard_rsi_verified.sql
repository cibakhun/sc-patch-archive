-- Schutz der RSI-Verifizierung auf Datenbankebene.
--
-- rsi_verified darf von Client-Rollen (anon / authenticated) NIEMALS auf true
-- gesetzt werden — nur die Service Role (Supabase Edge Functions, Admin-API)
-- darf das Badge setzen. Die Richtung false (Revoke, z. B. bei Handle-Wechsel
-- oder "Verifizierung aufheben") bleibt fuer Clients erlaubt.
--
-- Hintergrund: RLS kann keine spaltenweisen Schreibverbote; dieser Trigger
-- greift unabhaengig von den RLS-Policies auf jede INSERT/UPDATE-Operation
-- der Tabelle public.profiles.

create or replace function public.guard_rsi_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  -- Service Role (Edge Functions, Admin-API) darf alles.
  if caller_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Neue Profil-Zeilen starten grundsaetzlich unverifiziert.
    new.rsi_verified := false;
    return new;
  end if;

  -- UPDATE: Das Badge darf clientseitig nur entzogen, nie gesetzt werden.
  if new.rsi_verified is distinct from old.rsi_verified
     and new.rsi_verified = true then
    raise exception 'rsi_verified kann nur nach serverseitiger RSI-Pruefung gesetzt werden'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_rsi_verified on public.profiles;
create trigger trg_guard_rsi_verified
  before insert or update on public.profiles
  for each row execute function public.guard_rsi_verified();
