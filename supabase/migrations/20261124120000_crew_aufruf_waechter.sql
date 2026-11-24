-- Crew-Aufruf: Wächter robuster (24.11.2026, UX-Audit Paket I, I7 Schritt 4).
-- Noch nicht eingespielt: wartet auf die Freigabe durch den Betreiber.
--
-- WAS SICH AENDERT (nur die beiden Triggerfunktionen aus 20261124110000;
-- Tabellen, Policies, Rechte und Trigger bleiben, wie sie sind)
--   public.crew_calls_guard()
--       zählt die offenen Aufrufe eines Piloten erst, nachdem es eine
--       Transaktionssperre auf ihn gesetzt hat. Zwei gleichzeitige Aufrufe
--       desselben Piloten warten so aufeinander und kommen zusammen nicht
--       über drei.
--   public.crew_call_members_guard()
--       antwortet auf einen Aufruf, den der Zusagende nicht sehen darf,
--       genauso wie auf einen, den es nicht gibt, und sperrt den Aufruf erst
--       danach. Sichtbar heisst wie in der Lese-Policy von crew_calls:
--       are_friends mit dem Rufenden.
--
-- Rueckweg: die beiden Funktionen aus 20261124110000_crew_aufruf.sql erneut
-- anlegen (create or replace, Rumpf unverändert dort).

begin;

create or replace function public.crew_calls_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  if new.starts_at < now() - interval '10 minutes' or new.starts_at > now() + interval '7 days' then
    raise exception 'Beginn ausserhalb des erlaubten Rahmens' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('crew_calls:' || new.owner_id::text, 0));
  if (select count(*) from public.crew_calls
       where owner_id = new.owner_id and starts_at > now() - interval '1 hour') >= 3 then
    raise exception 'Zu viele offene Aufrufe' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.crew_calls_guard() from public, anon, authenticated;

create or replace function public.crew_call_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.crew_calls%rowtype;
begin
  new.created_at := now();
  select * into c from public.crew_calls where id = new.call_id;
  if not found or c.owner_id = new.user_id
     or public.are_friends((select auth.uid()), c.owner_id) is not true then
    raise exception 'Aufruf nicht gefunden' using errcode = 'check_violation';
  end if;
  select * into c from public.crew_calls where id = new.call_id for update;
  if not found then
    raise exception 'Aufruf nicht gefunden' using errcode = 'check_violation';
  end if;
  if c.starts_at < now() - interval '1 hour' then
    raise exception 'Aufruf ist vorbei' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.crew_call_members where call_id = new.call_id) >= c.slots then
    raise exception 'Crew ist voll' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.crew_call_members_guard() from public, anon, authenticated;

commit;
