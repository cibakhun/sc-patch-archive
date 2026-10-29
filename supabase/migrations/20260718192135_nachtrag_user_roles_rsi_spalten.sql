-- Nachtrag 29.10.2026: Objekte, die live existieren, aber von KEINER Migration
-- angelegt werden.
--
-- WAS: die Tabelle public.user_roles mit ihrer Lese-Policy und die drei
-- Spalten profiles.rsi_verified, profiles.rsi_code, profiles.rsi_handle.
-- Beides entstand live ausserhalb der Migrationshistorie, vermutlich im
-- SQL-Editor (user_roles nach Abschnitt 4 von scripts/supabase-schema.sql;
-- die RSI-Spalten vor dem 23.07.2026, als verify-rsi dazukam). Der genaue
-- Zeitpunkt ist nicht protokolliert.
--
-- WARUM: ein Aufbau nur aus supabase/migrations/ (Branch, Wiederherstellung,
-- `supabase db reset`) bricht sonst bei 20260724143938_user_roles_allow_beta
-- ab ("relation public.user_roles does not exist"), und ohne rsi_code liefe
-- verify-rsi ins Leere. Gemessen am 29.10.2026 auf einer lokalen Replik:
-- leerer Supabase-Unterbau, dann alle Migrationen der Reihe nach, dann
-- Abgleich mit dem Live-Katalog. Ohne diese Datei Abbruch bei Migration 12;
-- mit ihr stimmen alle Tabellen, Spalten (samt Reihenfolge), Constraints,
-- Indizes, Trigger, Policies, Rechte und Views mit live ueberein.
--
-- VERSION: frei gewaehlt, nur fuer die Reihenfolge, direkt nach der ersten
-- Migration. Die RSI-Spalten muessen VOR 20260723182225 kommen, sonst
-- stimmt die Spaltenreihenfolge nicht; user_roles vor 20260724143938.
-- Die Anlage kennt diese Version noch nicht. Weil sie aelter ist als die
-- letzte dort angewandte, verweigert `supabase db push` den Lauf und
-- verlangt --include-all, das ALLE ausstehenden Dateien einspielen wuerde.
-- Deshalb vor dem naechsten db push nur eintragen, nicht einspielen:
--   supabase migration repair --status applied 20260718192135
-- Eingespielt waere sie ohnehin wirkungslos, weil jede Anweisung vorher
-- prueft, ob es das Objekt schon gibt.
--
-- WAS ES FUER DIE SEITE BEDEUTET: nichts, live ist alles schon da.
--
-- Die Rechte auf user_roles bleiben hier bewusst so, wie die
-- Supabase-Standardrechte sie live vergeben haben; Schutz kommt aus RLS
-- (nur die eigene Zeile lesbar, kein Schreiben). Ein Einengen der Rechte
-- gehoert in eine eigene Migration, nicht in diesen Nachtrag. Die
-- Admin-Zeile selbst ist Nutzerdaten und steht nicht hier.

alter table public.profiles
  add column if not exists rsi_verified boolean default false,
  add column if not exists rsi_code text,
  add column if not exists rsi_handle text;

create table if not exists public.user_roles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

alter table public.user_roles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_roles'
      and policyname = 'Nutzer koennen eigene Rolle lesen'
  ) then
    create policy "Nutzer koennen eigene Rolle lesen" on public.user_roles
      for select using (auth.uid() = user_id);
  end if;
end $$;
