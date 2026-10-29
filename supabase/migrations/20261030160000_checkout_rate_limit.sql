-- Spenden-Checkout: Bremse je Anschluss (30.10.2026). Noch NICHT live
-- eingespielt; einspielen nach Freigabe durch den Betreiber, VOR dem Deploy
-- der Edge Function create-checkout-session aus demselben Commit. In der
-- anderen Reihenfolge laeuft die Function trotzdem: ihr RPC-Aufruf scheitert,
-- und sie laesst die Spende durch (bewusst offen, siehe unten).
--
-- AUSGANGSLAGE: create-checkout-session laeuft ohne Sitzung (verify_jwt =
-- false, Spenden ohne Konto). Jeder Aufruf mit dem oeffentlichen apikey legte
-- bei Stripe eine Bezahlseite an, ohne Grenze. Eine Bezahlseite kostet nichts,
-- aber massenhaft frische Bezahlseiten sind das Werkzeug fuer Kartentests
-- gegen das eigene Stripe-Konto, und sie verbrauchen dessen API-Kontingent,
-- an dem auch die echten Spenden haengen.
--
-- WAS SICH AENDERT
--   1. private.checkout_attempts: je Aufruf eine Zeile mit einem Schluessel
--      aus der IP-Adresse (HMAC-SHA-256 mit einem Geheimwert der Function,
--      nie die Adresse selbst) und dem Zeitpunkt.
--   2. public.checkout_rate_ok(p_ip_key): zaehlt die Aufrufe dieses
--      Schluessels in der letzten Stunde; ab 10 false, sonst Buchung und true.
--      Je Schluessel serialisiert (Advisory-Lock), damit parallele Aufrufe die
--      Grenze nicht gemeinsam ueberholen. Jeder Aufruf loescht Zeilen, die
--      aelter als eine Stunde sind (laenger braucht die Zaehlung sie nicht).
--      Gezaehlt wird je IPv4-Adresse bzw. je IPv6-/64 (rate.js).
--      SECURITY DEFINER, leerer search_path, ausfuehrbar NUR fuer
--      service_role. Dieselbe Bauart wie register_rate_ok und rsi_rate_ok:
--      das Schema private ist ueber die REST-Schnittstelle nicht erreichbar.
--   3. Kein globales Limit: eine Obergrenze ueber alle Anschluesse liesse
--      einen verteilten Angreifer die Spenden aller anderen sperren.
--
-- Die Datenschutzerklaerung (#support, DE und EN) nennt den Schluessel, die
-- Grenze und die Loeschung im selben Commit. Ohne pg_cron (live nicht
-- installiert) loescht erst der naechste Aufruf; so steht es auch dort.

create table if not exists private.checkout_attempts (
  id         bigint      generated always as identity primary key,
  ip_key     text        not null check (ip_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists checkout_attempts_key_time on private.checkout_attempts (ip_key, created_at);
alter table private.checkout_attempts enable row level security;
revoke all on private.checkout_attempts from public, anon, authenticated;
revoke all on sequence private.checkout_attempts_id_seq from public, anon, authenticated;

create or replace function public.checkout_rate_ok(p_ip_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent int;
begin
  if p_ip_key is null or p_ip_key !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('checkout_rate:' || p_ip_key, 0));
  select count(*) into recent
  from private.checkout_attempts
  where ip_key = p_ip_key
    and created_at > now() - interval '1 hour';
  if recent >= 10 then
    return false;
  end if;
  insert into private.checkout_attempts (ip_key) values (p_ip_key);
  delete from private.checkout_attempts where created_at < now() - interval '1 hour';
  return true;
end;
$$;

comment on function public.checkout_rate_ok(text) is
  'Bremse fuer create-checkout-session: hoechstens 10 Aufrufe je '
  'IP-Schluessel (HMAC, nie die Adresse) und Stunde. Nur service_role. '
  'Loescht bei jedem Aufruf Zeilen aelter als eine Stunde.';

revoke all on function public.checkout_rate_ok(text) from public, anon, authenticated;
grant execute on function public.checkout_rate_ok(text) to service_role;

-- -------------------------------------------- Selbstpruefung -----------------
do $pruefung$
begin
  if pg_catalog.has_function_privilege('anon', 'public.checkout_rate_ok(text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.checkout_rate_ok(text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('public', 'public.checkout_rate_ok(text)', 'EXECUTE') then
    raise exception 'checkout_rate_limit: checkout_rate_ok ist fuer Clients ausfuehrbar';
  end if;
  if not pg_catalog.has_function_privilege('service_role', 'public.checkout_rate_ok(text)', 'EXECUTE') then
    raise exception 'checkout_rate_limit: service_role kann checkout_rate_ok nicht ausfuehren';
  end if;
  if pg_catalog.has_table_privilege('anon', 'private.checkout_attempts', 'SELECT,INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'private.checkout_attempts', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'checkout_rate_limit: private.checkout_attempts ist fuer Clients lesbar oder schreibbar';
  end if;
end
$pruefung$;

-- ============================================================================
-- RUECKBAU (die Function laeuft danach weiter, nur ungebremst):
--   drop function if exists public.checkout_rate_ok(text);
--   drop table if exists private.checkout_attempts;
