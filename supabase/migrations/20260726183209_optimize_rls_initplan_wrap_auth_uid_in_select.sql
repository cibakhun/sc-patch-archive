-- optimize_rls_initplan_wrap_auth_uid_in_select: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260726183209, Name
-- optimize_rls_initplan_wrap_auth_uid_in_select, angewandt 26.07.2026 18:32
-- UTC. Alles unterhalb der Trennlinie ist der dort gespeicherte Wortlaut
-- (statements, mit ';\n' verbunden), zeichengleich.
-- md5 des Wortlauts: fc1bd688614d02f7f9a80590f8db1474
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
-- Lief zweimal kurz nacheinander mit gleichem Ergebnis (dieser Lauf und
-- 20260726184812_rls_initplan_wrap_auth_uid_in_select). Beide stehen in der
-- Live-Historie und deshalb auch hier.
-- ============================================================================
-- Performance: auth.uid() pro Query statt pro Zeile auswerten (Supabase-Linter 0003_auth_rls_initplan)
-- ALTER POLICY behaelt Name, Kommando und Rollen unveraendert bei; nur der Ausdruck wird gewrappt.

-- friend_requests
ALTER POLICY "freq_select" ON public.friend_requests
  USING ((( SELECT auth.uid() ) = sender_id) OR (( SELECT auth.uid() ) = receiver_id));

ALTER POLICY "freq_insert" ON public.friend_requests
  WITH CHECK (( SELECT auth.uid() ) = sender_id);

ALTER POLICY "freq_update" ON public.friend_requests
  USING (( SELECT auth.uid() ) = receiver_id)
  WITH CHECK (( SELECT auth.uid() ) = receiver_id);

ALTER POLICY "freq_delete" ON public.friend_requests
  USING ((( SELECT auth.uid() ) = sender_id) OR (( SELECT auth.uid() ) = receiver_id));

-- friends
ALTER POLICY "friends_select" ON public.friends
  USING ((( SELECT auth.uid() ) = user_id) OR (( SELECT auth.uid() ) = friend_id));

ALTER POLICY "friends_insert" ON public.friends
  WITH CHECK (( SELECT auth.uid() ) = user_id);

ALTER POLICY "friends_delete" ON public.friends
  USING ((( SELECT auth.uid() ) = user_id) OR (( SELECT auth.uid() ) = friend_id));

-- user_roles
ALTER POLICY "Nutzer koennen eigene Rolle lesen" ON public.user_roles
  USING (( SELECT auth.uid() ) = user_id);
