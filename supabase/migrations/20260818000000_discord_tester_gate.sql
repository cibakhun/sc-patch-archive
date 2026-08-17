-- Testpilot-Zugang (Phase 14): Rollenspiegel, Sperrliste, Spiegelspalten und
-- oeffentliche Sichten.
--
-- D-08 verlangt "sofort beim naechsten Aufruf" und schliesst gleichzeitig eine
-- Discord-Anfrage je Seitenaufruf aus. Deshalb liegt der Rollenstand hier, wo
-- der Tuersteher (nginx/gate.js, Plan 01/Aufgabe 2 dieser Phase) ohnehin
-- fragt -- der Bot PUSHT bei guildMemberUpdate, niemand fragt Discord live.
--
-- D-05 gilt unveraendert: public.user_roles (scripts/supabase-schema.sql
-- Zeilen 68-91) bleibt in dieser Datei UNERWAEHNT. Die Testpilot-Eigenschaft
-- lebt in Discord, nicht in user_roles -- user_id ist dort Primaerschluessel,
-- ein Konto koennte sonst nicht gleichzeitig Admin und Testpilot sein.

-- ============================================================================
-- 1. public.discord_role_state -- der Spiegel, den der Bot pflegt (D-03/D-25)
-- ============================================================================
create table if not exists public.discord_role_state (
  user_id           uuid        primary key references auth.users(id) on delete cascade,
  discord_user_id   text        unique,
  is_tester         boolean     not null default false,
  last_staging_seen timestamptz,
  updated_at        timestamptz not null default now()
);

comment on table public.discord_role_state is
  'Spiegel des Discord-Rollenstands je Konto. Wahrheit ist Discord; der Bot '
  'schreibt hier bei guildMemberUpdate und beim Start-Reconcile (D-25). Kein '
  'Client-Schreibzugriff -- ausschliesslich Service-Rolle und die '
  'security-definer-Funktionen dieser Phase duerfen aendern.';

alter table public.discord_role_state enable row level security;

-- GENAU EINE Politik: der Kontoinhaber darf seine eigene Zeile lesen (fuer ein
-- kuenftiges Konto-UI, z. B. "meine Rolle"). Kein insert/update/delete fuer
-- Client-Rollen -- das schreibt ausschliesslich die Service-Rolle (Bot) und
-- die security-definer-Funktion aus Aufgabe 2 (public.gate_verdict()).
drop policy if exists discord_role_state_select_own on public.discord_role_state;
create policy discord_role_state_select_own on public.discord_role_state
  for select using ((select auth.uid()) = user_id);

-- Uebersicht aus D-13 ("wer traegt die Rolle und wann war er zuletzt da")
-- filtert und sortiert ueber is_tester -- eigener Index dafuer, der
-- Eindeutigkeitsindex auf discord_user_id entsteht bereits durch `unique`.
create index if not exists idx_discord_role_state_is_tester
  on public.discord_role_state (is_tester);

-- ============================================================================
-- 2. public.tester_blocklist -- der Sofort-Rauswurf aus D-10
-- ============================================================================
create table if not exists public.tester_blocklist (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  reason     text        not null,
  created_at timestamptz not null default now()
);

comment on table public.tester_blocklist is
  'Sofort-Rauswurf unabhaengig von der Discord-Rolle (D-10). Bewusst OHNE '
  'jede Client-Politik -- kein Konto darf erfahren, ob es (oder ein anderes) '
  'auf dieser Liste steht; wer gesperrt ist, erfaehrt es an der Tuer '
  '(public.gate_verdict() liefert allowed=false), nicht durch eine Abfrage.';

alter table public.tester_blocklist enable row level security;
-- Bewusst KEINE Politik: RLS ist an, aber kein SELECT/INSERT/UPDATE/DELETE
-- fuer anon/authenticated -- die Tabelle ist fuer jeden Client unsichtbar.
-- Zugriff haben nur die Service-Rolle und security-definer-Funktionen.

-- ============================================================================
-- 3. Zwei Spalten an public.profiles (D-19 Abzeichen, D-22 Zustimmung)
-- ============================================================================
alter table public.profiles
  add column if not exists is_tester boolean not null default false,
  add column if not exists tester_credit boolean not null default false;

comment on column public.profiles.is_tester is
  'Oeffentlich sichtbare Spiegelung des Discord-Testpilot-Status fuer das '
  'Abzeichen auf /pilot/<handle> (D-19). Wahrheit bleibt Discord/'
  'discord_role_state; das hier ist reine Anzeige. Client-Schreibzugriff auf '
  'true ist per Trigger gesperrt (guard_is_tester).';
comment on column public.profiles.tester_credit is
  'Zustimmungsschalter fuer die Namensnennungsliste (D-22), Standard AUS. '
  'Anders als is_tester darf der Nutzer diese Spalte selbst setzen -- es ist '
  'seine eigene Entscheidung, nicht die Discord-Wahrheit.';

-- ============================================================================
-- 4. Schreibsperre auf is_tester -- uebertragen aus guard_rsi_verified
--    (supabase/migrations/20260722200000_guard_rsi_verified.sql), nur der
--    Feldname wechselt. tester_credit steht AUSDRUECKLICH NICHT unter dieser
--    Sperre -- der Nutzer darf seinen eigenen Zustimmungsschalter setzen.
-- ============================================================================
create or replace function public.guard_is_tester()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  -- Service-Rolle (Bot, Edge Functions, Admin-API) darf alles.
  if caller_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Neue Profil-Zeilen starten grundsaetzlich als Nicht-Testpilot.
    new.is_tester := false;
    return new;
  end if;

  -- UPDATE: is_tester darf clientseitig NIE auf true gesetzt werden. Ein
  -- Entzug (true -> false) ist hier nicht extra erlaubt, weil kein
  -- Client-Codepfad ihn heute ausloest -- die Wahrheit ist Discord, nicht
  -- das Profil.
  if new.is_tester is distinct from old.is_tester
     and new.is_tester = true then
    raise exception 'is_tester kann nur serverseitig aus der Discord-Rolle gesetzt werden'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_is_tester on public.profiles;
create trigger trg_guard_is_tester
  before insert or update on public.profiles
  for each row execute function public.guard_is_tester();

-- ============================================================================
-- 5. public.public_profiles neu erzeugen -- bestehende Spaltenliste aus
--    supabase/migrations/20260723000000_public_profile_views.sql WOERTLICH
--    uebernommen, plus is_tester (D-19: Abzeichen auf dem OEFFENTLICHEN
--    /pilot/<handle> sichtbar, ohne dass profiles selbst geoeffnet wird).
-- ============================================================================
create or replace view public.public_profiles
with (security_barrier = true) as
select
  handle,
  display_name,
  bio,
  banner_url,
  avatar_url,
  avatar_icon,
  avatar_color,
  role,
  status_state,
  status_text,
  rsi_handle,
  rsi_verified,
  is_tester,
  org_name,
  created_at
from public.profiles
where handle is not null;

-- Der Grant geht bei `create or replace view` nicht verloren, steht hier
-- trotzdem erneut, damit diese Migration fuer sich allein vollstaendig ist.
grant select on public.public_profiles to anon, authenticated;

-- ============================================================================
-- 6. public.tester_credits -- eigene, sehr schmale View fuer die
--    Namensnennung (D-22). Filtert zusaetzlich auf tester_credit = true, den
--    Zustimmungsschalter -- die Liste braucht die Namen der Zustimmenden,
--    nicht die Vorliebe jedes Einzelnen (tester_credit bleibt deshalb
--    AUSDRUECKLICH NICHT in public_profiles).
-- ============================================================================
create or replace view public.tester_credits
with (security_barrier = true) as
select
  handle,
  display_name
from public.profiles
where handle is not null
  and is_tester = true
  and tester_credit = true;

grant select on public.tester_credits to anon, authenticated;

-- ============================================================================
-- 7. Kopplung Discord-Identitaet -> Spiegel (D-03)
--    Die Discord-ID kommt aus der von Supabase GEPRUEFTEN Identitaet
--    (auth.identities), niemals aus einem Anfragerumpf -- dieselbe Regel wie
--    in supabase/functions/verify-rsi/index.ts fuer die RSI-Kopplung.
--    is_tester bleibt dabei unberuehrt; die Rollenwahrheit setzt allein der
--    Bot (Push bei guildMemberUpdate, D-25).
-- ============================================================================
create or replace function public.sync_discord_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.provider = 'discord' then
    insert into public.discord_role_state (user_id, discord_user_id)
    values (new.user_id, new.provider_id)
    on conflict (user_id) do update
      set discord_user_id = excluded.discord_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_discord_identity on auth.identities;
create trigger trg_sync_discord_identity
  after insert on auth.identities
  for each row execute function public.sync_discord_identity();

-- public.user_roles bleibt in dieser Migration unerwaehnt. Das ist D-05 und
-- keine Auslassung.
