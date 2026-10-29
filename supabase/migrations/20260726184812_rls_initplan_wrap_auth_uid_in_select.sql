-- rls_initplan_wrap_auth_uid_in_select: aus der Live-Anlage uebernommen am 29.10.2026.
--
-- Quelle: supabase_migrations.schema_migrations, Version 20260726184812, Name
-- rls_initplan_wrap_auth_uid_in_select, angewandt 26.07.2026 18:48 UTC. Alles
-- unterhalb der Trennlinie ist der dort gespeicherte Wortlaut (statements, mit
-- ';\n' verbunden), zeichengleich.
-- md5 des Wortlauts: 333339b667720089746d7aa025136540
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
-- Zweiter Lauf von 20260726183209, gleiche Wirkung.
-- ============================================================================
-- Performance: auth.uid() pro Query statt pro Zeile auswerten (auth_rls_initplan).
-- Semantisch identisch, nur der Planer behandelt (select auth.uid()) als InitPlan-Konstante.
-- ALTER POLICY laesst Name, Kommando und Rollen unveraendert.

-- friend_requests
ALTER POLICY "freq_select" ON public.friend_requests
  USING (
    ((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id)
  );

ALTER POLICY "freq_insert" ON public.friend_requests
  WITH CHECK (
    (select auth.uid()) = sender_id
  );

ALTER POLICY "freq_update" ON public.friend_requests
  USING (
    (select auth.uid()) = receiver_id
  )
  WITH CHECK (
    (select auth.uid()) = receiver_id
  );

ALTER POLICY "freq_delete" ON public.friend_requests
  USING (
    ((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id)
  );

-- friends
ALTER POLICY "friends_select" ON public.friends
  USING (
    ((select auth.uid()) = user_id) OR ((select auth.uid()) = friend_id)
  );

ALTER POLICY "friends_insert" ON public.friends
  WITH CHECK (
    (select auth.uid()) = user_id
  );

ALTER POLICY "friends_delete" ON public.friends
  USING (
    ((select auth.uid()) = user_id) OR ((select auth.uid()) = friend_id)
  );

-- user_roles
ALTER POLICY "Nutzer koennen eigene Rolle lesen" ON public.user_roles
  USING (
    (select auth.uid()) = user_id
  );
