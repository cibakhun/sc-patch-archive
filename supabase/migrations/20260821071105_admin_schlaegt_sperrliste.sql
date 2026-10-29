-- Betreiberentscheidung 20.08.2026 (WINDOWS.md id 39): der Admin-Riegel
-- schlaegt die Sperrliste, nicht umgekehrt.
--
-- WAS SICH AENDERT: in public.gate_verdict() tauschen Schritt 2 und 3 die
-- Reihenfolge. Bisher wurde die Sperrliste VOR der Admin-Pruefung abgefragt,
-- ein gesperrter Admin bekam also {allowed:false, grund:"gesperrt"}. Jetzt
-- gewinnt admin.
--
-- WARUM: der Admin-Weg ist der einzige Rettungsanker dieser Anlage. Er haengt
-- an keiner Discord-Bedingung und traegt, wenn Discord, der Bot oder der
-- Rollenspiegel klemmen. Es gibt GENAU EIN Admin-Konto. Landete es je auf der
-- Sperrliste -- Vertipper, falsche user_id, ein spaeterer Automatismus --,
-- waere die Vorschau fuer alle unerreichbar und nur noch ueber einen direkten
-- Datenbankzugriff zu retten. Die Gefahr, sich selbst auszusperren, wiegt hier
-- schwerer als die Gefahr, einen Admin nicht per Sperrliste hinauswerfen zu
-- koennen: wer Admin ist, entscheidet ohnehin ueber user_roles, und dort ist
-- der Entzug einen Handgriff entfernt.
--
-- WAS D-10 DAZU SAGT: woertlich nur "ein Eintrag macht den Ausweis ab dem
-- naechsten Aufruf wertlos, unabhaengig von der DISCORD-ROLLE". Der Admin-Fall
-- ist dort gar nicht entschieden -- die bisherige Reihenfolge war eine
-- Auslegung, keine Vorgabe. Am 20.08. gemessen und dem Betreiber vorgelegt,
-- weil die Eintraege id 35/38 des Registers seit Plan 08 das GEGENTEIL
-- behaupteten ("gesperrter Admin durchgelassen") und es niemandem auffiel:
-- der Fall lief bis dahin nur gegen einen Mock.
--
-- FUER TESTPILOTEN AENDERT SICH NICHTS: wer kein Admin ist, wird von einem
-- Sperrlisteneintrag weiterhin sofort abgewiesen, unabhaengig von der
-- Discord-Rolle. Genau dafuer ist die Liste da.
--
-- RUECKBAU: die beiden if-Bloecke wieder tauschen, sonst nichts.

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

  -- 2. Admin-Aussperr-Riegel (D-04) -- haengt an keiner Discord-Bedingung UND
  --    seit dem 20.08. auch an keinem Sperrlisteneintrag. Siehe Kopf.
  if exists (
    select 1 from public.user_roles
    where user_id = v_uid and role = 'admin'
  ) then
    v_reason := 'admin';

  -- 3. Sperrliste (D-10) -- der Sofort-Rauswurf, unabhaengig von der
  --    Discord-Rolle. Greift fuer alle ausser Admins.
  elsif exists (select 1 from public.tester_blocklist where user_id = v_uid) then
    return json_build_object('allowed', false, 'grund', 'gesperrt');

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
  -- Admin ohne Discord-Kopplung).
  insert into public.discord_role_state (user_id, last_staging_seen)
  values (v_uid, now())
  on conflict (user_id) do update
    set last_staging_seen = excluded.last_staging_seen;

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
  'Nutzer-ID kommt ausschliesslich aus auth.uid(). Reihenfolge seit '
  '20.08.2026: admin schlaegt die Sperrliste (Betreiberentscheidung, '
  'WINDOWS.md id 39 -- der Admin-Weg ist der einzige Rettungsanker und darf '
  'nicht kappbar sein); fuer alle anderen schlaegt die Sperrliste jede Rolle. '
  'Ein erlaubendes Urteil schreibt last_staging_seen fort.';

revoke all on function public.gate_verdict() from public;
grant execute on function public.gate_verdict() to authenticated;
