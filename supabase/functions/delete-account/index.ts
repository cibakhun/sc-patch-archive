// VerseBase — Self-Service-Account-Löschung.
// Aufruf nur mit gültigem User-JWT (verify_jwt=true + eigene getUser-Prüfung).
// Entfernt zuerst die hochgeladenen Profilbilder (Buckets avatars/banners,
// Ordner <uid>/), dann den auth.users-Eintrag. Alle Tabellen in public mit
// Bezug auf das Konto (profiles, favorites, Werkzeug-Daten, Freunde,
// Nachrichten, discord_role_state, user_roles) hängen per ON DELETE CASCADE
// an auth.users; Storage-Objekte tun das nicht, deshalb purge.ts. Einzige
// Ausnahme: ein Eintrag in tester_blocklist mit Discord-ID bleibt als
// Sperrgrund stehen, nur user_id wird leer (20261030131000).
// Scheitert das Aufräumen der Bilder, bleibt das Konto bestehen (500), damit
// keine Dateien eines gelöschten Kontos öffentlich zurückbleiben.
// Ohne frische Anmeldung (fresh.ts) antwortet die Funktion 401
// reauth_required und löscht nichts.
//
// Version fest gepinnt (vorher jsr:@supabase/supabase-js@2, also jeweils die
// neueste 2.x zum Zeitpunkt des Deploys).
import { createClient } from 'jsr:@supabase/supabase-js@2.118.0';
import { purgeUserFiles } from './purge.ts';
import { signedInRecently } from './fresh.ts';

const ALLOWED_ORIGINS = new Set([
  'https://verse-base.com',
  'https://www.verse-base.com',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://verse-base.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
  }

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'missing_token' }), { status: 401, headers });
    }

    // Identität aus dem mitgeschickten JWT verifizieren — die Funktion löscht
    // ausschließlich den Account des Aufrufers, nie einen fremden.
    const supaUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401, headers });
    }
    if (!signedInRecently(jwt, Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: 'reauth_required' }), { status: 401, headers });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Erst die Bilder, dann das Konto. Nur der Ordner des Aufrufers.
    const purge = await purgeUserFiles(admin.storage, user.id);
    if (!purge.ok) {
      console.error('storage cleanup failed', purge.bucket, purge.stage, purge.message);
      return new Response(JSON.stringify({ error: 'storage_cleanup_failed' }), { status: 500, headers });
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error('deleteUser failed', delErr);
      return new Response(JSON.stringify({ error: 'delete_failed' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    console.error('unexpected', e);
    return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500, headers });
  }
});
