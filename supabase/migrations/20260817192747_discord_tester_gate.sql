-- Testpilot-Zugang (Phase 14): Rollenspiegel, Sperrliste, Spiegelspalten und
-- oeffentliche Sichten.
--
-- D-08 verlangt "sofort beim naechsten Aufruf" und schliesst gleichzeitig eine
-- Discord-Anfrage je Seitenaufruf aus. Deshalb liegt der Rollenstand hier, wo
-- der Tuersteher (nginx/gate.js, Plan 01/Aufgabe 2 dieser Phase) ohnehin
-- fragt -- der Bot PUSHT bei guildMemberUpdate, niemand fragt Discord live.
--
-- D-05 gilt unveraendert: public.user_roles bleibt in dieser Datei
-- UNERWAEHNT. Die Testpilot-Eigenschaft lebt in Discord, nicht in
-- user_roles -- user_id ist dort Primaerschluessel, ein Konto koennte sonst
-- nicht gleichzeitig Admin und Testpilot sein.
-- ⚠ scripts/supabase-schema.sql (Zeilen 68-91) ist bei dieser Aussage NICHT
-- die lebende Wahrheit: dort steht `CHECK (role IN ('user','admin'))`, live
-- gilt seit der Migration `user_roles_allow_beta` (24.07.2026, im Repo NICHT
-- vorhanden) `role = ANY (ARRAY['user','admin','beta'])`. D-05 aendert das
-- nicht -- die Entscheidung traegt auf dem Primaerschluessel (user_id, genau
-- eine Rolle je Konto), nicht auf der Zahl der erlaubten Werte -- aber der
-- Dateiverweis waere sonst irrefuehrend. Siehe auch die Warnung vor Abschnitt
-- 5: in diesem Projekt ist KEINE Repo-Datei ein Beleg ueber die lebende
-- Anlage, das gilt fuer Tabellen genauso wie fuer Views.

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
-- 5. public.public_profiles neu erzeugen -- is_tester GANZ AM ENDE angehaengt
--    (D-19: Abzeichen auf dem OEFFENTLICHEN /pilot/<handle> sichtbar, ohne
--    dass profiles selbst geoeffnet wird).
--
--    ⚠ WARNUNG fuer kuenftige Leser/Aenderer dieser View: die Spaltenliste
--    ist ueber DREI Migrationen gewachsen, nicht nur eine:
--      1. supabase/migrations/20260723000000_public_profile_views.sql
--         -- Urfassung, 14 Spalten, endet auf created_at.
--      2. supabase/migrations/20260725000000_add_last_seen_presence.sql
--         -- + presence (CASE-Ausdruck aus last_seen).
--      3. supabase/migrations/20260725110000_presence_two_signal.sql
--         -- presence auf ein Zwei-Signal-Modell (last_seen + last_active)
--         umgestellt. DIES ist die aktuell lebende Fassung -- wer diese View
--         ersetzt, MUSS von HIER aus weiterbauen, nicht von Datei 1.
--    (Ein fruehrer Entwurf dieser Migration hat genau diesen Fehler gemacht:
--    er baute gegen Datei 1 und liess presence ersatzlos wegfallen.
--    `create or replace view` erlaubt nur ANHAENGEN ans Ende -- Name, Typ und
--    Position bestehender Spalten sind unveraenderlich; waere presence nicht
--    die letzte Spalte gewesen, haette der Push mit "cannot change name of
--    view column" abgebrochen. presence WAR die letzte Spalte, also haette
--    der Push stattdessen durchgegriffen und die Spalte stillschweigend
--    entfernt -- src/components/pilot/PilotPage.astro fragt sie alle 40
--    Sekunden fuer die Live-Praesenzanzeige auf JEDEM oeffentlichen
--    Pilotenprofil ab, site-weit, nicht nur auf staging. Gefunden vor dem
--    Anwenden, siehe 14-02-SUMMARY.md.)
--
--    security_barrier wird hier erneut EXPLIZIT gesetzt, obwohl Datei 2/3
--    das WITH-Attribut weglassen -- `create or replace view` OHNE WITH-
--    Klausel aendert bestehende Reloptions nicht (es ersetzt nur die Abfrage,
--    nicht die View-Eigenschaften), die View sollte also ohnehin noch
--    security_barrier tragen. Das hier zusaetzlich erneut zu setzen ist
--    trotzdem sicherer als sich darauf zu verlassen.
-- ============================================================================
create or replace view public.public_profiles
with (security_barrier = true) as
  select
    handle, display_name, bio, banner_url, avatar_url, avatar_icon, avatar_color,
    role, status_state, status_text, rsi_handle, rsi_verified, org_name, created_at,
    case
      when last_seen is null then 'offline'
      when now() - last_seen < interval '80 seconds' then
        case when last_active is not null and now() - last_active < interval '3 minutes' then 'online' else 'away' end
      when now() - last_seen < interval '3 minutes' then 'away'
      else 'offline'
    end as presence,
    is_tester
  from public.profiles
  where handle is not null;

-- Der Grant geht bei `create or replace view` nicht verloren, steht hier
-- trotzdem erneut, damit diese Migration fuer sich allein vollstaendig ist.
grant select on public.public_profiles to anon, authenticated;

-- Denkfehler-Gegenprobe (Koordinator-Auftrag, 17.08.2026): beide Migrationen
-- dieser Phase wurden danach durchsucht, ob irgendwo sonst ein bestehendes
-- Objekt gegen seine ERSTE statt seine JUENGSTE Definition geschrieben
-- steht. Ergebnis: KEINE weitere Fundstelle. discord_role_state,
-- tester_blocklist und tester_credits sind neue Objekte ohne Vorgeschichte;
-- die profiles-Spalten kommen per `add column if not exists` (kein
-- Redefinieren des gesamten Objekts); guard_is_tester(), sync_discord_
-- identity(), gate_verdict() und tester_overview() sind neue Funktionsnamen.
-- public_profiles (oben) ist das einzige bestehende Objekt, dessen
-- Spaltenliste in dieser Phase neu geschrieben wird.

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
--
--    ACHTUNG Eindeutigkeit: discord_role_state.discord_user_id traegt einen
--    EIGENEN unique-Index, getrennt vom Primaerschluessel user_id. `on
--    conflict (user_id)` deckt nur Konflikte auf DIESEM Index ab -- haelt
--    ein ANDERES Konto dieselbe discord_user_id bereits, verletzt der Insert
--    den unique-Index auf discord_user_id, den die on-conflict-Klausel nicht
--    anspricht, und wirft roh weiter. Da dieser Trigger AFTER INSERT auf
--    auth.identities sitzt, rollt eine unbehandelte Ausnahme das Anlegen der
--    Identitaet komplett zurueck -- deshalb wird sie hier explizit
--    abgefangen und durch eine sprechende Meldung ersetzt (Kandidat a,
--    Koordinator-Entscheidung 17.08.2026): die Kopplung scheitert weiterhin
--    -- ein Discord-Account darf nur an EIN Konto gebunden sein, das ist
--    die gewollte Invariante -- aber mit einer Meldung, die die Oberflaeche
--    dem Nutzer zeigen kann, statt der rohen Postgres-Fehlermeldung.
--    Kandidat (b), die aeltere Zeile stillschweigend zu loesen, waere eine
--    Entscheidung ueber ein FREMDES Konto und gehoert dem Betreiber, nicht
--    dieser Migration.
--
--    Ein Spiegel-Eintrag ist trotzdem NIE wichtiger als eine funktionierende
--    Anmeldung: jede ANDERE, unerwartete Ausnahme (z. B. new.provider_id ist
--    null, oder new.user_id haette strukturwidrig kein Gegenstueck in
--    auth.users) darf die Identitaets-Anlage nicht mitreissen und wird nur
--    protokolliert.
-- ============================================================================
create or replace function public.sync_discord_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.provider <> 'discord' then
    return new;
  end if;

  -- Ohne provider_id gibt es nichts Sinnvolles zu spiegeln -- eine Zeile mit
  -- discord_user_id = NULL waere ohne Aussagekraft (und wuerde, weil NULL
  -- in einem unique-Index nie mit einem anderen NULL kollidiert, ohnehin
  -- keine der beiden Ausnahmen unten ausloesen). Einfach nichts tun.
  if new.provider_id is null then
    return new;
  end if;

  begin
    insert into public.discord_role_state (user_id, discord_user_id)
    values (new.user_id, new.provider_id)
    on conflict (user_id) do update
      set discord_user_id = excluded.discord_user_id;
  exception
    when unique_violation then
      -- discord_user_id ist bereits an ein ANDERES Konto gebunden (siehe
      -- Kommentar oben) -- die Kopplung scheitert bewusst, aber verstaendlich.
      --
      -- Der RAISE EXCEPTION hier wirft eine NEUE Ausnahme, nachdem der
      -- Handler bereits ausgewaehlt wurde -- keine Schleife, kein erneutes
      -- Abfangen durch denselben EXCEPTION-Block: ein Handler faengt nur
      -- Ausnahmen aus dem zugehoerigen BEGIN-Block ab (Zeilen 230-233 oben),
      -- niemals seine eigenen. Die neue Ausnahme verlaesst die Funktion
      -- ungefangen -- genau das gewollte Verhalten, siehe Kommentarblock vor
      -- der Funktion.
      raise exception 'Dieser Discord-Account ist bereits mit einem anderen Konto verknuepft.'
        using errcode = 'unique_violation',
              hint = 'discord_role_state.discord_user_id ist bereits an ein anderes Konto gebunden';
    when foreign_key_violation then
      -- Strukturell sollte das nicht vorkommen -- auth.identities.user_id
      -- ist selbst per FK an auth.users gebunden, also bereits gueltig, wenn
      -- dieser AFTER-INSERT-Trigger laeuft. Falls doch: nur protokollieren,
      -- die Identitaet trotzdem anlegen lassen.
      raise warning 'sync_discord_identity: FK-Verletzung beim Spiegeln von user_id %, Identitaet wird trotzdem angelegt', new.user_id;
    when others then
      -- Jede weitere, unvorhergesehene Ausnahme wuerde sonst die gesamte
      -- Identitaets-Anlage zurueckrollen (AFTER-INSERT-Trigger) -- fuer eine
      -- reine Spiegeltabelle unverhaeltnismaessig. Protokollieren statt
      -- scheitern lassen.
      raise warning 'sync_discord_identity: unerwarteter Fehler beim Spiegeln von user_id %: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_sync_discord_identity on auth.identities;
create trigger trg_sync_discord_identity
  after insert on auth.identities
  for each row execute function public.sync_discord_identity();

-- public.user_roles bleibt in dieser Migration unerwaehnt. Das ist D-05 und
-- keine Auslassung.
