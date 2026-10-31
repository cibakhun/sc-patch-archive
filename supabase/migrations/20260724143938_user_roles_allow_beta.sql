-- user_roles_allow_beta: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260724143938, Name
-- user_roles_allow_beta, angewandt 24.07.2026 14:39 UTC. Alles unterhalb der
-- Trennlinie ist der dort gespeicherte Wortlaut (statements, mit ';\n'
-- verbunden), zeichengleich.
-- md5 des Wortlauts: fcc3bb34bcc375eafb79d522b7433fdd
--
-- WARUM DIESE DATEI: die Migration lief direkt gegen die Anlage (Management
-- API) und lag bis heute nicht im Repo. Ohne sie bildet supabase/migrations/
-- die Anlage nicht ab, und `supabase db push` haelt die Live-Historie fuer
-- fremd.
--
-- WAS SIE FUER DIE SEITE BEDEUTET: nichts. Sie ist live angewandt und wird
-- nicht erneut eingespielt. Wortlaut nicht aendern; Korrekturen gehoeren in
-- eine neue Migration.
--
-- ACHTUNG Neuaufbau: die Tabelle public.user_roles und ihre Policy "Nutzer
-- koennen eigene Rolle lesen" legte live KEINE Migration an. Sie entstanden
-- vorher ausserhalb der Migrationshistorie, vermutlich im SQL-Editor mit
-- Abschnitt 4 von scripts/supabase-schema.sql (dort noch mit Check auf
-- 'user'/'admin'). Fuer einen Aufbau nur aus supabase/migrations/ legt sie
-- seit 29.10.2026 der Nachtrag 20260718192135_nachtrag_user_roles_rsi_spalten
-- an; ohne ihn bricht der Aufbau hier ab.
-- ============================================================================
-- Beta-Whitelist-Modell: role darf jetzt auch 'beta' sein. Aktiviert NUR den
-- Wert (gewährt niemandem Zugang) — der /account-Guard in account-lite.js lässt
-- 'admin' ODER 'beta' auf die Kontofläche; Archiv/Theme-Toggle bleiben admin-only.
do $$
declare cn text;
begin
  select conname into cn
    from pg_constraint
   where conrelid = 'public.user_roles'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%role%';
  if cn is not null then execute format('alter table public.user_roles drop constraint %I', cn); end if;
end $$;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role = any (array['user'::text, 'admin'::text, 'beta'::text]));
