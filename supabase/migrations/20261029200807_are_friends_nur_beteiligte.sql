-- are_friends(a, b) antwortet nur noch, wenn der Aufrufer selbst a oder b ist.
-- Vorher konnte jedes angemeldete Konto fuer zwei beliebige Konto-IDs
-- abfragen, ob sie befreundet sind. Die RLS-Policy dm_insert ruft
-- are_friends(sender_id, receiver_id) mit sender_id = auth.uid() auf und
-- funktioniert unveraendert.
--
-- Live eingespielt am 29.10.2026 (Version 20261029200807, Freigabe Krisz).
-- Geprueft, nur gezaehlt: ein Unbeteiligter bekommt fuer 0 von 2
-- Freundschaften true, ein Beteiligter fuer 2 von 2.
--
-- Rueckbau: dieselbe Funktion ohne die Bedingung "(select auth.uid()) in (a, b)".
create or replace function public.are_friends(a uuid, b uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select (select auth.uid()) in (a, b)
     and exists (
       select 1 from public.friends
       where (user_id = a and friend_id = b) or (user_id = b and friend_id = a)
     );
$function$;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
