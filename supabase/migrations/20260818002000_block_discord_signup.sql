-- Testpilot-Zugang (Phase 14, Plan 03): Riegel gegen die stille
-- Kontoerstellung ueber den Discord-Weg (D-02).
--
-- ⚠⚠ GEFAEHRLICHSTE STELLE DER GANZEN PHASE. Dieser Trigger sitzt an der
-- Anmeldung JEDES Kontos -- ein Fehler hier wirkt sich nicht lokal aus,
-- sondern auf jede Neuanmeldung. Er wird deshalb erst nach vorgefuehrt-rotem
-- Nachweis in BEIDE Richtungen (14-03-PLAN.md Aufgabe 2) scharf gestellt --
-- diese Datei allein ist noch keine Sicherung, nur ihre Vorstufe.
--
-- ============================================================================
-- Was der Riegel tut
-- ============================================================================
-- D-02: "Der Discord-Knopf meldet nur an, er legt nie ein Konto an." Wer sich
-- ueber Discord anmeldet und noch KEIN Site-Konto hat, bekommt eine Absage
-- statt eines still erzeugten Kontos -- der Betreiber behaelt damit von jedem
-- Testpiloten eine bestaetigte E-Mail-Adresse (Grund fuer D-02, siehe
-- 14-CONTEXT.md).
--
-- Die Bedingung ist exakt EIN Zweig, eng gefasst: greift NUR, wenn
-- new.raw_app_meta_data ->> 'provider' = 'discord'. In JEDEM anderen Fall
-- (email-Registrierung, spaeteres Anlegen anderer Provider) return new ohne
-- jede weitere Pruefung -- kein zweiter Zweig, keine Ausnahmeliste, kein
-- Umgebungsschalter. Bewusst NICHT eingebaut (14-03-PLAN.md, Aufgabe 1):
-- eine Ausnahme fuer den ersten Nutzer, eine Liste erlaubter Discord-IDs, ein
-- Env-Flag -- jede davon waere ein zweiter Schluessel neben der Tuer.
--
-- ============================================================================
-- Warum linkIdentity NICHT getroffen wird -- die tragende Annahme
-- ============================================================================
-- Dieser Trigger sitzt auf `auth.users` (BEFORE INSERT), nicht auf
-- `auth.identities`. Wenn ein Nutzer, der bereits ein Konto per E-Mail hat,
-- danach seinen Discord-Account VERKNUEPFT (supabase-js `linkIdentity()`,
-- oder Supabase's automatische Verknuepfung bei uebereinstimmender
-- E-Mail-Adresse), legt Supabase dafuer KEINE neue Zeile in `auth.users` an
-- -- die Zeile existiert bereits, nur `auth.identities` bekommt einen neuen
-- Eintrag mit provider = 'discord'. Ein Trigger auf `auth.users` kann diesen
-- Vorgang konstruktionsbedingt gar nicht sehen, geschweige denn blockieren.
--
-- Genau das ist der Vorteil dieser Bauform gegenueber einer Pruefung auf
-- `auth.identities`: der Trigger feuert ausschliesslich dann, wenn Supabase
-- im Begriff ist, ueber den Discord-Weg ein NEUES Konto in `auth.users`
-- anzulegen -- wortwoertlich der Fall, den D-02 verbietet. Der
-- `trg_sync_discord_identity`-Trigger aus Plan 02
-- (supabase/migrations/20260818000000_discord_tester_gate.sql, AFTER INSERT
-- ON auth.identities) spiegelt die Discord-ID unabhaengig davon weiter, ob
-- die Identitaet aus einer Neuanmeldung oder aus einer Verknuepfung stammt --
-- dieser Riegel hier kommt ihm nicht in die Quere, weil er auf einer anderen
-- Tabelle sitzt und zeitlich VOR jedem bestehenden AFTER-INSERT-Trigger auf
-- `auth.users` laeuft (Postgres fuehrt alle BEFORE-Trigger vor dem eigent-
-- lichen INSERT aus; bricht einer davon mit RAISE EXCEPTION ab, findet der
-- INSERT nicht statt und kein AFTER-Trigger -- auch keiner, der beim
-- Kontoanlegen ein Profil erzeugt -- feuert ueberhaupt).
--
-- Aufgabe 2 misst diese Annahme, statt sie zu glauben: ein `insert into
-- auth.identities` mit provider = 'discord' auf ein BESTEHENDES Konto muss
-- durchgehen und darf diesen Trigger nicht ausloesen (dritter Testfall,
-- 14-03-PLAN.md Aufgabe 2).
--
-- ⚠ Bestehende Trigger auf `auth.users` vor dem Schreiben dieser Datei:
-- NICHT gegen die lebende Anlage geprueft -- dieser Ausfuehrung stand kein
-- Werkzeug mit Lesezugriff auf `pg_trigger` der Supabase-Anlage
-- (trgjhmbnodoarnfmlcqx) zur Verfuegung (kein Supabase-CLI, kein
-- SUPABASE_ACCESS_TOKEN, keine Management-API in dieser Ausfuehrungssitzung
-- -- dieselbe Einschraenkung, die 14-02-SUMMARY.md fuer execute_sql/Lesezugriff
-- dokumentiert). Der Name `trg_block_discord_signup` ist neu und kollidiert
-- nach allem, was im Repo und in den Migrations-Kommentaren dokumentiert ist,
-- mit keinem bekannten Trigger; `drop trigger if exists` faengt eine
-- zufaellige Namensgleichheit ohnehin ab. Die Korrektheit dieses Riegels
-- haengt davon NICHT ab (siehe Absatz oben: ein BEFORE-INSERT-Trigger, der
-- entweder `return new` oder `raise exception` tut, ist unabhaengig von
-- Zahl und Namen anderer Trigger auf derselben Tabelle sicher) -- die
-- Auflistung ist Sorgfaltspflicht/Dokumentation, keine Korrektheits-
-- voraussetzung. Vor dem Scharfstellen (Aufgabe 2) muss diese Liste trotzdem
-- nachgeholt werden, mit Zugriff auf die Management API.
--
-- ============================================================================
-- Warum kein Auth-Hook "Before User Created" (RESEARCH.md Open Question 1)
-- ============================================================================
-- Supabase bietet fuer genau diesen Anwendungsfall einen offiziellen
-- "Before User Created"-Auth-Hook an. Er wurde bewusst NICHT gewaehlt:
--   1. Die Verfuegbarkeit auf dem gebuchten Supabase-Tarif ist unbelegt
--      (RESEARCH.md Assumption A1) -- ein Trigger auf `auth.users` braucht
--      keine Tarif-Freischaltung, er ist gewoehnliches Postgres.
--   2. Ein Auth-Hook lebt im Supabase-Dashboard (Konfiguration ausserhalb
--      des Repos), nicht in einer versionierten Migration -- er waere bei
--      einem Blick ins Repo unsichtbar und liesse sich nicht "vorgefuehrt
--      rot" gegen eine Testdatenbank fahren, wie es CLAUDE.md fuer jede neue
--      Sicherung verlangt.
--   3. RESEARCH.md Open Question 1 selbst weist darauf hin, dass unklar ist,
--      ob eine Hook-Implementierung `linkIdentity` zuverlaessig von einer
--      echten Discord-Neuanmeldung unterscheidet -- der Trigger auf
--      `auth.users` loest dieses Problem strukturell (siehe Absatz oben),
--      nicht durch eine zusaetzliche Bedingung, die es falsch treffen
--      koennte.
-- Der Trigger ist stattdessen versioniert, wandert mit den Migrationen mit
-- und ist gegen die lebende Anlage rot fahrbar (Aufgabe 2) -- das war die
-- entscheidende Abwaegung, nicht Zufall.
--
-- ============================================================================
-- security definer + search_path -- Schutz gegen search_path-Umlenkung
-- (T-14-22, Threat Register 14-03-PLAN.md)
-- ============================================================================
create or replace function public.block_discord_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Einzige Bedingung, exakt und eng: nur der Discord-Provider wird
  -- abgewiesen. Jeder andere Provider (email, spaetere Ergaenzungen) ist von
  -- diesem Riegel vollstaendig unberuehrt.
  if new.raw_app_meta_data ->> 'provider' = 'discord' then
    raise exception 'Für diese Vorschau brauchst du zuerst ein reguläres Konto auf verse-base.com. Registriere dich mit E-Mail und verknüpfe danach Discord.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

comment on function public.block_discord_signup() is
  'D-02: verweigert die stille Kontoerstellung ueber den Discord-Weg. Sitzt '
  'BEFORE INSERT auf auth.users und trifft deshalb konstruktionsbedingt nicht '
  'linkIdentity()/automatische Verknuepfung (die schreiben nur nach '
  'auth.identities, niemals nach auth.users). Siehe Kommentarblock am '
  'Dateikopf fuer die vollstaendige Begruendung, inkl. warum kein '
  'Before-User-Created-Auth-Hook.';

drop trigger if exists trg_block_discord_signup on auth.users;
create trigger trg_block_discord_signup
  before insert on auth.users
  for each row execute function public.block_discord_signup();

comment on trigger trg_block_discord_signup on auth.users is
  'D-02, T-14-18/T-14-19/T-14-20 (14-03-PLAN.md Threat Register). BEFORE '
  'INSERT -- laeuft vor jedem bestehenden AFTER-INSERT-Trigger auf '
  'auth.users (z. B. einem Trigger, der beim Kontoanlegen ein Profil '
  'erzeugt) und bricht dessen Feuern mit ab, wenn er selbst abbricht. '
  'Vorgefuehrt rot in beide Richtungen (Discord blockt, E-Mail geht durch, '
  'linkIdentity geht durch) VOR dem Scharfstellen -- 14-03-PLAN.md Aufgabe 2.';
