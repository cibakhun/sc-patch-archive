-- Unterstützen-Seite: der erreichte Stand, von Hand gepflegt.
--
-- WARUM VON HAND und nicht automatisch: Der Zahlungsweg der Seite ist ein
-- PayPal.me-Link. Der meldet NICHTS zurück — Webhooks feuern bei PayPal für
-- Zahlungen aus einer REST-Integration, ein persönlicher Zahlungslink gehört
-- nicht dazu. Es gibt also keine Datenquelle, aus der sich der Stand ableiten
-- ließe. Die Alternative wäre ein PayPal-Geschäftskonto (Identitätsprüfung,
-- genau die Wand, an der Stripe gescheitert ist) oder Ko-fi als Hauptweg.
-- Beides steht offen; bis dahin trägt der Betreiber den Stand selbst ein.
--
-- WARUM IN DER DATENBANK und nicht als Konstante im Code: Eine Konstante in
-- src/consts.ts bräuchte für jede Änderung einen Build und ein Deploy. Hier
-- ändert der Betreiber den Wert direkt auf der Seite, und er ist sofort da.
--
-- WARUM DAS EHRLICH BLEIBT: updated_at wird vom Trigger gesetzt, nicht vom
-- Client. Die Seite zeigt den Stempel immer mit an ("Stand: …"). Eine
-- handgepflegte Zahl ist vertretbar, solange danebensteht, wie alt sie ist —
-- vergessen kann man das so nicht mehr. Fehlt die Zeile oder scheitert der
-- Abruf, zeigt die Seite GAR KEINEN Balken statt eines leeren (Hausregel
-- „Never fabricate data", verankert in tests/e2e/db.test.js).
create table if not exists public.support_progress (
  slug         text        primary key check (char_length(slug) between 1 and 60),
  goal_cents   integer     not null check (goal_cents > 0 and goal_cents <= 100000000),
  raised_cents integer     not null default 0 check (raised_cents >= 0 and raised_cents <= 100000000),
  note         text        check (note is null or char_length(note) <= 200),
  updated_at   timestamptz not null default now()
);

comment on table public.support_progress is
  'Erreichter Stand der Unterstützen-Seite. Von Hand gepflegt, weil ein PayPal.me-Link keine Rückmeldung liefert. Öffentlich lesbar, nur von Admins änderbar.';

alter table public.support_progress enable row level security;

-- Lesen: JEDER, auch nicht angemeldet. Die Tabelle enthält bewusst keine
-- personenbezogenen Daten — nur zwei Beträge, eine Notiz und einen Zeitstempel.
drop policy if exists support_progress_select_public on public.support_progress;
create policy support_progress_select_public on public.support_progress
  for select using (true);

-- Schreiben: NUR Admins. Der Test läuft ohne security-definer-Funktion, weil
-- user_roles bereits eine Regel hat, die jedem das Lesen der EIGENEN Zeile
-- erlaubt (scripts/supabase-schema.sql) — genau das braucht dieser Ausdruck.
-- Eine definer-Funktion wäre zusätzliche Angriffsfläche ohne Gegenwert.
drop policy if exists support_progress_update_admin on public.support_progress;
create policy support_progress_update_admin on public.support_progress
  for update
  using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'))
  with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));

drop policy if exists support_progress_insert_admin on public.support_progress;
create policy support_progress_insert_admin on public.support_progress
  for insert
  with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));

-- Kein DELETE für irgendjemanden: die Zeile soll nicht verschwinden können.
-- Wer aufhören will zu sammeln, setzt raised_cents und blendet den Abschnitt
-- über die Seite aus.

-- Der Zeitstempel kommt vom Server, nicht vom Client. Sonst könnte ein
-- veralteter Stand mit frischem Datum erscheinen — genau die Unehrlichkeit,
-- gegen die der Stempel gedacht ist.
--
-- KEIN updated_by: die select-Regel gilt für ALLE Spalten, die Nutzer-ID des
-- Admins wäre also öffentlich lesbar. Für eine Seite mit einem Admin trägt sie
-- keine Information, die das wert wäre. (Gemessen: ein anonymer Abruf mit
-- select=* lieferte die Spalte mit aus.)
create or replace function public.support_progress_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.slug := old.slug;  -- Schlüssel ist nicht änderbar
  return new;
end;
$$;

drop trigger if exists support_progress_stamp_trg on public.support_progress;
create trigger support_progress_stamp_trg
  before update on public.support_progress
  for each row execute function public.support_progress_stamp();

-- Startzeile: das Netzteil-Ziel aus der Seite (120,00 EUR), Stand 0.
-- on conflict do nothing, damit ein erneuter Lauf einen bereits gepflegten
-- Stand NICHT auf null zurücksetzt.
insert into public.support_progress (slug, goal_cents, raised_cents)
values ('netzteil', 12000, 0)
on conflict (slug) do nothing;
