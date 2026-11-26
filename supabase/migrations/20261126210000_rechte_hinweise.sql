-- rechte_hinweise: zwei Angleichungen und Kommentare zu Objekten, die mit den
-- Rechten ihres Besitzers laufen. Aendert kein Verhalten.
--
-- 1. private.register_attempts bekommt RLS wie seine Nachbartabellen im Schema
--    private (alle mit RLS an und ohne Policy). Zugriff hat weiter nur
--    register_rate_ok() (security definer, Besitzer postgres = Tabellenbesitzer,
--    kein FORCE) und service_role (BYPASSRLS); das Schema ist fuer anon und
--    authenticated ohnehin nicht erreichbar.
-- 2. accept_friend_request() bekommt einen leeren Suchpfad wie are_friends()
--    und mark_messages_read(). Der Rumpf nennt jedes Objekt schon mit Schema
--    (public.friend_requests, public.friends, auth.uid()).
-- 3. Kommentare halten fest, warum die sechs oeffentlichen Sichten und drei
--    Funktionen mit Besitzerrechten laufen, damit eine spaetere Pruefung sie
--    nicht erneut als offen fuehrt. gate_verdict() und tester_overview()
--    tragen ihren Kommentar schon.
-- ============================================================================

alter table private.register_attempts enable row level security;

alter function public.accept_friend_request(uuid) set search_path = '';

comment on view public.public_profiles is
  'Oeffentliches Profil je Handle. Laeuft mit Besitzerrechten, weil profiles per RLS nur die eigene Zeile zeigt; gibt nur ausgewaehlte Spalten aus, Praesenz nur bei presence_visibility = all, Beitrittsdatum nur auf den Monat genau. security_barrier an.';
comment on view public.social_profiles is
  'Profilkarte fuer Freundesliste und Chat. Laeuft mit Besitzerrechten wie public_profiles; Praesenz und Aktivitaet nur fuer den Fragenden selbst oder Freunde laut public.friends, je nach presence_visibility und share_activity. security_barrier an.';
comment on view public.public_showcase is
  'Hangar-Vitrine eines Profils: nur die Layouts, die der Besitzer in profiles.showcase ausgewaehlt hat und die nicht geloescht sind. Laeuft mit Besitzerrechten, weil hangar_layouts per RLS privat ist. security_barrier an.';
comment on view public.public_favorites is
  'Favoriten eines Profils, nur wenn der Besitzer show_favorites gesetzt hat; Zeitpunkt nur auf den Tag genau. Laeuft mit Besitzerrechten, weil favorites per RLS privat ist. security_barrier an.';
comment on view public.profile_badges is
  'Abzeichen "Profil vollstaendig" je Handle, nur als Wahrheitswert. Laeuft mit Besitzerrechten, weil profiles und auth.identities fuer Fremde nicht lesbar sind. security_barrier an.';
comment on view public.tester_credits is
  'Danksagung an Testpiloten: nur Handle und Anzeigename, nur wenn is_tester und tester_credit gesetzt sind. Laeuft mit Besitzerrechten wie public_profiles. security_barrier an.';

comment on function public.accept_friend_request(uuid) is
  'Nimmt eine Freundschaftsanfrage an. Security definer, weil friends bewusst keine INSERT-Policy hat und die Freundschaft nur hier entsteht; prueft selbst, dass der Aufrufende der Empfaenger ist und die Anfrage offen ist. Von den Nutzerrollen darf nur authenticated sie aufrufen.';
comment on function public.are_friends(uuid, uuid) is
  'Antwortet nur, wenn der Aufrufende selbst a oder b ist; sonst false. Wird von den Policies dm_insert (direct_messages) und crew_calls_select (crew_calls) gefragt; security definer, damit diese Pruefung nicht von der RLS auf friends abhaengt.';
comment on function public.mark_messages_read(uuid) is
  'Markiert Nachrichten als gelesen, aber nur Nachrichten an den Aufrufenden, und setzt nur read_at. Security definer, weil direct_messages bewusst keine UPDATE-Policy hat.';
