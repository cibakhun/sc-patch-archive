-- Sicherheits-Istzustand 29.10.2026: die Social-Profile sind nur noch fuer
-- angemeldete Nutzer lesbar. Live eingespielt am 29.10.2026 (Version
-- 20261029145731), nach Freigabe durch den Betreiber.
--
-- DAS PROBLEM: social_profiles (View ueber public.profiles) war mit dem
-- oeffentlichen anon-Schluessel aus dem Seiten-JavaScript lesbar und lieferte
-- fuer jedes Konto mit Handle die hinterlegten Social-Links und den
-- Aktivitaetsstatus — als vollstaendige Liste, ohne Anmeldung.
--
-- DIE KORREKTUR: anon verliert SELECT. Angemeldete lesen weiter; die Seite
-- fragt die View ohnehin nur im Kontobereich ab (FriendsManager, FriendsDock,
-- account-dashboard). Die oeffentliche Pilotenseite liest public_profiles und
-- ist nicht betroffen.
--
-- NACHWEIS: als anon in einer Transaktion
--   select 1 from public.social_profiles limit 1
--   -> "permission denied for view social_profiles"

revoke select on public.social_profiles from anon;
