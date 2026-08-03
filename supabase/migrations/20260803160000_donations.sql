-- Stripe-Spenden: eine Zeile je bestaetigter Zahlung.
--
-- WER SCHREIBT: ausschliesslich die Edge Function `stripe-webhook`, und die
-- erst NACH geprueter Stripe-Signatur. Es gibt bewusst KEINE insert-Regel fuer
-- anon oder authenticated — die Function arbeitet mit der Service Role, die RLS
-- ohnehin umgeht. Ohne Regel heisst: niemand sonst kommt hier hinein.
--
-- WER LIEST: niemand oeffentlich. Die Tabelle traegt Zahlungsreferenzen, und
-- die gehen niemanden etwas an (DON-08). Nach aussen sichtbar ist nur die
-- SUMME, und die steht in support_progress.stripe_cents — dorthin traegt ein
-- Trigger sie ein. Bewusst KEINE oeffentliche View auf diese Tabelle: eine
-- solche View muesste die RLS umgehen, und genau dafuer meldet der
-- Supabase-Linter bereits drei bestehende Views als Fehler. Eine vierte
-- kommt nicht dazu.
--
-- DOPPELZUSTELLUNG: Stripe liefert dasselbe Ereignis mehrfach aus, wenn die
-- erste Antwort ausbleibt oder langsam ist — das ist normales Verhalten, kein
-- Fehlerfall. Die Eindeutigkeitsbedingung auf stripe_event_id faengt das in
-- der DATENBANK ab, nicht in der Anwendung: ein zweiter Versuch mit derselben
-- Ereignis-Kennung schlaegt fehl statt den Betrag ein zweites Mal zu zaehlen.
create table if not exists public.donations (
  id                     bigint      generated always as identity primary key,
  stripe_event_id        text        not null unique,
  stripe_session_id      text,
  stripe_payment_intent  text,
  amount_cents           integer     not null check (amount_cents > 0 and amount_cents <= 5000000),
  currency               text        not null default 'eur' check (char_length(currency) = 3),
  livemode               boolean     not null default false,
  created_at             timestamptz not null default now()
);

comment on table public.donations is
  'Bestaetigte Stripe-Spenden. Nur der signaturgepruefte Webhook schreibt hier. Nicht oeffentlich lesbar — nach aussen zaehlt allein die Summe in support_progress.stripe_cents.';

alter table public.donations enable row level security;

-- Admins duerfen lesen (Abgleich mit dem Stripe-Dashboard). Sonst niemand.
drop policy if exists donations_select_admin on public.donations;
create policy donations_select_admin on public.donations
  for select
  using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));

-- Die Summe der Stripe-Zahlungen bekommt eine eigene Spalte NEBEN dem
-- handgepflegten Wert. Getrennt, weil sie verschiedene Herkunft haben:
--   stripe_cents — automatisch, aus bestaetigten Zahlungen
--   raised_cents — von Hand, fuer PayPal-Eingaenge (D-34)
-- Zusammengezaehlt wird erst in der Anzeige. So bleibt jederzeit erkennbar,
-- welcher Teil gemessen und welcher eingetragen ist.
alter table public.support_progress
  add column if not exists stripe_cents integer not null default 0
    check (stripe_cents >= 0 and stripe_cents <= 100000000);

comment on column public.support_progress.raised_cents is
  'Von Hand eingetragener Anteil (PayPal-Eingaenge). Nur Admins.';
comment on column public.support_progress.stripe_cents is
  'Automatisch gezaehlter Anteil aus bestaetigten Stripe-Zahlungen. Nur der Trigger schreibt hier.';

-- Zaehlt eine frisch eingetragene Spende auf den Stand. Laeuft als Trigger,
-- damit Function und Datenbank nicht auseinanderlaufen koennen: es gibt genau
-- EINEN Weg, wie stripe_cents waechst, und der haengt an einer echten Zeile in
-- donations. Kein zweiter Schreibpfad, den man vergessen koennte.
create or replace function public.donations_bump_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_progress
     set stripe_cents = stripe_cents + new.amount_cents
   where slug = 'netzteil';
  return new;
end;
$$;

-- security definer ist hier noetig, weil der Trigger auch dann greifen soll,
-- wenn spaeter einmal nicht die Service Role schreibt. EXECUTE wird deshalb
-- allen ausser dem Besitzer entzogen — sonst meldet der Linter zu Recht eine
-- oeffentlich aufrufbare definer-Funktion (die drei bestehenden Warnungen im
-- Projekt kommen genau daher).
revoke all on function public.donations_bump_progress() from public, anon, authenticated;

drop trigger if exists donations_bump_progress_trg on public.donations;
create trigger donations_bump_progress_trg
  after insert on public.donations
  for each row execute function public.donations_bump_progress();
