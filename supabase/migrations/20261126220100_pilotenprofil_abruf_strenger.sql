-- Pilotenprofile: anon den direkten Listen-Zugriff nehmen (26.11.2026,
-- Stufe 2 von 2). Noch NICHT live eingespielt.
--
-- ERST EINSPIELEN, WENN die neue Seite + nginx/pilot.js LIVE sind. Reihenfolge:
--   1. Stufe 1 (20261126220000_pilotenprofil_funktionen.sql) live einspielen
--      -- legt pilot_card/pilot_public an, rein ergaenzend.
--   2. PR mergen und die neue Seite + nginx live ausliefern (check:live).
--   3. DIESE Stufe einspielen -- jetzt liest keine alte Seite mehr direkt, es
--      entsteht also kein anon-Ausfallfenster.
--   4. verify:db-rights (Schiene B, Betreiber-Token) bestaetigt den End-Stand.
-- Wird dies VOR dem Deploy der neuen Seite eingespielt, zeigt die noch live
-- laufende alte Seite fuer anon eine Fehlerseite (sie liest die Views direkt,
-- der Entzug macht daraus einen permission-denied, den ihr load() als
-- Fehlerseite rendert). Genau dafuer die Teilung.
--
-- WAS SICH AENDERT: anon verliert den direkten SELECT auf die vier Profil-
-- Views. Damit gibt es ohne Anmeldung keinen Sammelabruf und kein Durchzaehlen
-- mehr; ein einzelnes Profil bleibt ueber pilot_card/pilot_public (Stufe 1)
-- erreichbar. authenticated behaelt SELECT (Freunde, Vorschau der eigenen
-- Seite, die Pilotenseite fuer Angemeldete) -- RLS/Besitzerrechte wie bisher.

-- -------------------------------------------- anon: kein Listen-Zugriff -----
revoke select on public.public_profiles  from anon;
revoke select on public.public_favorites from anon;
revoke select on public.public_showcase  from anon;
revoke select on public.profile_badges   from anon;

-- -------------------------------------------- Selbstpruefung (Stufe 2) ------
do $pruefung$
begin
  if pg_catalog.has_table_privilege('anon', 'public.public_profiles', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.public_favorites', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.public_showcase', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.profile_badges', 'SELECT') then
    raise exception 'pilotenprofil_abruf_strenger: anon liest eine Profil-View noch direkt';
  end if;
  if not (pg_catalog.has_table_privilege('authenticated', 'public.public_profiles', 'SELECT')
     and pg_catalog.has_table_privilege('authenticated', 'public.public_favorites', 'SELECT')
     and pg_catalog.has_table_privilege('authenticated', 'public.public_showcase', 'SELECT')
     and pg_catalog.has_table_privilege('authenticated', 'public.profile_badges', 'SELECT')) then
    raise exception 'pilotenprofil_abruf_strenger: authenticated verliert eine Profil-View';
  end if;
  -- Guard: Stufe 1 muss vorher gelaufen sein, sonst haette anon jetzt gar
  -- keinen Weg mehr zu einem Profil.
  if not (pg_catalog.has_function_privilege('anon', 'public.pilot_card(text)', 'EXECUTE')
     and pg_catalog.has_function_privilege('anon', 'public.pilot_public(text)', 'EXECUTE')) then
    raise exception 'pilotenprofil_abruf_strenger: Stufe 1 fehlt (pilot_card/pilot_public nicht fuer anon ausfuehrbar)';
  end if;
end
$pruefung$;

-- ============================================================================
-- RUECKBAU (gibt anon den direkten Listen-Zugriff zurueck; Funktionen aus
-- Stufe 1 bleiben):
--   grant select on public.public_profiles, public.public_favorites,
--     public.public_showcase, public.profile_badges to anon;
-- rights.expected.json, nginx/pilot.js und die Seite (anon-Zweig) im selben
-- Zug zuruecknehmen. Fuer den vollen Rueckbau danach die Stufe-1-Datei.
-- ============================================================================
