-- Unterstuetzen-Stand: Client schreibt nur noch die handgepflegten Spalten
-- (30.10.2026). Noch NICHT live eingespielt; der Hauptstrang spielt sie nach
-- Freigabe durch den Betreiber ein, NACH 20261030100000_rechte_nur_nach_bedarf
-- (deren Abschnitt 3 vergibt UPDATE tabellenweit und wuerde diese Grenze
-- sonst wieder aufweiten).
--
-- AUSGANGSLAGE: Die RLS-Policies support_progress_update_admin und
-- support_progress_insert_admin lassen nur Admins schreiben, aber ohne
-- Spaltengrenze. Ein Admin-Konto haette damit auch stripe_cents und
-- goal_cents ueber die Seite schreiben koennen, obwohl
-- 20260803160000_donations.sql zusagt, dass den gemessenen Anteil allein der
-- Trigger donations_bump_progress schreibt.
--
-- WAS SICH AENDERT: anon und authenticated verlieren INSERT und UPDATE auf
-- der Tabelle; authenticated bekommt UPDATE nur auf raised_cents und note.
-- Die RLS-Policy laesst dabei weiterhin nur Admins durch. SELECT bleibt fuer
-- alle (die Spendenanzeige liest die Zeile oeffentlich).
--
-- WARUM DAS REICHT: der einzige Schreibweg der Seite ist der Admin-PATCH
-- {raised_cents} in src/components/SupportBody.astro. updated_at setzt der
-- Trigger support_progress_stamp (BEFORE UPDATE); Postgres prueft Spalten-
-- rechte nur fuer die Spalten der Anweisung, nicht fuer Aenderungen im
-- Trigger. donations_bump_progress ist SECURITY DEFINER (Besitzer postgres)
-- und braucht keine Rechte von anon/authenticated. Ein INSERT ueber die
-- Seite gibt es nicht; die Zeile "netzteil" legt der Betreiber per SQL an.
--
-- WAS ES FUER DIE SEITE BEDEUTET: nichts. Der Admin traegt den PayPal-Stand
-- wie bisher ein; Ziel und Stripe-Anteil sind nur noch per SQL/Service-Rolle
-- aenderbar.

revoke insert, update on public.support_progress from anon, authenticated, public;
grant update (raised_cents, note) on public.support_progress to authenticated;
grant select on public.support_progress to anon, authenticated;

-- ============================================================================
-- RUECKBAU:
--   revoke update (raised_cents, note) on public.support_progress from authenticated;
--   grant insert, update on public.support_progress to authenticated;
--   (vor 20261030100000 zusaetzlich: grant insert, update ... to anon)
-- ============================================================================
