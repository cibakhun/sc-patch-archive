-- Testpilot-Zugang (Phase 14): das Torurteil als EIN einziger Aufruf
-- (D-04, D-08, D-10, D-13).
--
-- public.gate_verdict() ersetzt den bisherigen direkten Tabellenlesezugriff,
-- den nginx/gate.js's mint() (Plan 01) heute noch auf user_roles fuehrt --
-- die Umverdrahtung selbst ist eine spaetere Planaufgabe, diese Migration
-- liefert nur die Funktion.
--
-- Die Nutzer-ID kommt in BEIDEN Funktionen unten AUSSCHLIESSLICH aus
-- auth.uid() -- dieselbe Regel wie in supabase/functions/verify-rsi/index.ts:
-- die Identitaet stammt aus dem geprueften Token, niemals aus einem
-- Argument. Ein zufaelliger Aufrufer kann damit weder das Urteil ueber ein
-- fremdes Konto erfragen noch die Uebersicht eines anderen sehen.

-- ============================================================================
-- 1. public.gate_verdict() -- das Torurteil in einem Aufruf
-- ============================================================================
create or replace function public.gate_verdict()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_reason text;
begin
  -- 1. Keine Sitzung -> kein Zugang.
  if v_uid is null then
    return json_build_object('allowed', false, 'grund', 'keine-sitzung');
  end if;

  -- 2. Sperrliste VOR allem anderen (D-10) -- der Sofort-Rauswurf darf von
  --    KEINER Rolle ueberstimmt werden, auch nicht von admin.
  if exists (select 1 from public.tester_blocklist where user_id = v_uid) then
    return json_build_object('allowed', false, 'grund', 'gesperrt');
  end if;

  -- 3. Admin-Aussperr-Riegel (D-04) -- haengt an keiner Discord-Bedingung.
  if exists (
    select 1 from public.user_roles
    where user_id = v_uid and role = 'admin'
  ) then
    v_reason := 'admin';
  -- 4. Discord-Testpilot-Rolle (D-03/D-08, aus discord_role_state gespiegelt).
  elsif exists (
    select 1 from public.discord_role_state
    where user_id = v_uid and is_tester = true
  ) then
    v_reason := 'tester';
  else
    -- 5. Sonst kein Zugang.
    return json_build_object('allowed', false, 'grund', 'kein-testpilot');
  end if;

  -- Erlaubendes Urteil: last_staging_seen fortschreiben (D-13) -- auch fuer
  -- ein Konto, das noch keine Zeile in discord_role_state hatte (z. B. ein
  -- Admin ohne Discord-Kopplung). Damit beantwortet D-13 sich aus dem
  -- Torvorgang selbst, ohne zweite Buchfuehrung.
  insert into public.discord_role_state (user_id, last_staging_seen)
  values (v_uid, now())
  on conflict (user_id) do update
    set last_staging_seen = excluded.last_staging_seen;

  -- sub wandert in die signierte Nutzlast des Ausweises (njs, Plan 01);
  -- exp_hint haelt die Cookie-Laufzeit an EINER Stelle statt getrennt in
  -- njs und SQL gepflegt zu werden.
  return json_build_object(
    'allowed', true,
    'grund', v_reason,
    'sub', v_uid,
    'exp_hint', 300
  );
end;
$$;

comment on function public.gate_verdict() is
  'Torurteil in einem Aufruf (D-04/D-08/D-10/D-13). Parameterlos -- die '
  'Nutzer-ID kommt ausschliesslich aus auth.uid(). Sperrliste schlaegt jede '
  'Rolle, admin haengt an keiner Discord-Bedingung, ein erlaubendes Urteil '
  'schreibt last_staging_seen fort.';

-- Rechte scharf stellen: anon bekommt kein Ausfuehrungsrecht -- ohne Sitzung
-- gibt es nichts zu urteilen (auth.uid() waere ohnehin null, aber das Recht
-- selbst soll schon fehlen).
revoke all on function public.gate_verdict() from public;
grant execute on function public.gate_verdict() to authenticated;

-- ============================================================================
-- 2. public.tester_overview() -- die Uebersicht aus D-13
-- ============================================================================
create or replace function public.tester_overview()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Die Rechtepruefung sitzt IN der Funktion, nicht im Grant, damit ein
  -- Nicht-Admin eine klare Absage bekommt statt einer leeren Liste.
  if not exists (
    select 1 from public.user_roles
    where user_id = v_uid and role = 'admin'
  ) then
    raise exception 'tester_overview() ist nur fuer admin-Konten zugaenglich'
      using errcode = 'insufficient_privilege';
  end if;

  return (
    select coalesce(json_agg(row_to_json(t)), '[]'::json)
    from (
      select
        p.handle,
        p.display_name,
        d.discord_user_id,
        d.is_tester,
        d.last_staging_seen
      from public.discord_role_state d
      join public.profiles p on p.id = d.user_id
      where d.is_tester = true
      order by d.last_staging_seen desc nulls last
    ) t
  );
end;
$$;

comment on function public.tester_overview() is
  'Uebersicht "wer traegt die Rolle und wann war er zuletzt auf staging" '
  '(D-13). Wirft insufficient_privilege fuer jeden Nicht-Admin -- die '
  'Rechtepruefung sitzt in der Funktion, nicht im Grant. Sortiert nach '
  'last_staging_seen absteigend, Nie-Erschienene am Ende.';

revoke all on function public.tester_overview() from public;
grant execute on function public.tester_overview() to authenticated;
