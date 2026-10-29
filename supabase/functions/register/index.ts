// VerseBase — öffentlicher Registrierungs-Endpoint (Ersatz für /auth/v1/signup).
// Grund: Das Projekt verlangt E-Mail-Bestätigung, der eingebaute Mailer ist
// aber hart limitiert (2/h) — Signups würden serverseitig zurückgerollt.
// Diese Funktion legt den User per Admin-API DIREKT BESTÄTIGT an
// (email_confirm) — fachlich identisch mit „Confirm email: off“.
// verify_jwt=false ist hier korrekt: Registrierung ist per Definition anonym
// (wie der native /signup); Input wird serverseitig validiert.
//
// v3: IP-Rate-Limit (5 Versuche/IP/Stunde) über die RPC
// public.register_rate_ok (SECURITY DEFINER, nur service_role) — direkter
// Tabellenzugriff auf das private-Schema geht via PostgREST NICHT, auch nicht
// mit service_role (Schema steht nicht in der API-Liste); v2 lief deshalb
// wirkungslos ins fail-open. IP nur als SHA-256-Hash.
//
// v8 (29.10.2026): PAUSIERT. Ein ohne Bestätigung angelegtes Konto übernimmt
// beim ersten Discord-Login des echten Adressinhabers dessen Identität
// (Supabase verknüpft OAuth-Identitäten mit gleicher, bestätigter E-Mail
// automatisch). Bis die Registrierung über den nativen signUp mit eigenem
// Mailversand und echter Bestätigung läuft, antwortet die Funktion 503
// `signup_paused`, BEVOR sie irgendetwas anlegt. Anmeldung bestehender
// Konten und Discord-Anmeldung laufen unverändert. Der Rest bleibt als
// Referenz stehen, bis die Funktion gelöscht wird.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SIGNUP_PAUSED = true;

const ALLOWED_ORIGINS = new Set([
  'https://verse-base.com',
  'https://www.verse-base.com',
  'https://staging.verse-base.com',
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
  }
  if (SIGNUP_PAUSED) {
    return new Response(JSON.stringify({ error: 'signup_paused' }), { status: 503, headers });
  }

  try {
    const body = await req.json().catch(() => null) as
      | { email?: string; password?: string; display_name?: string }
      | null;
    const email = (body?.email ?? '').trim().toLowerCase();
    const password = body?.password ?? '';
    const displayName = (body?.display_name ?? '').trim().slice(0, 60);

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return new Response(JSON.stringify({ error: 'email_address_invalid' }), { status: 400, headers });
    }
    if (password.length < 8 || password.length > 128) {
      return new Response(JSON.stringify({ error: 'weak_password' }), { status: 400, headers });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- IP-Rate-Limit: jeder Versuch zählt (auch abgelehnte) ---
    const ipRaw = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const ipHash = await sha256Hex('vb-reg:' + ipRaw);
    const { data: rateOk, error: rateErr } = await admin.rpc('register_rate_ok', { p_ip_hash: ipHash });
    if (rateErr) {
      // fail-open: ein Buchführungsfehler darf die Registrierung nicht killen —
      // aber laut loggen, damit es in den Function-Logs sichtbar ist.
      console.error('rate check failed', rateErr);
    } else if (rateOk === false) {
      return new Response(JSON.stringify({ error: 'over_request_rate_limit' }), { status: 429, headers });
    }

    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: displayName ? { display_name: displayName } : undefined,
    });
    if (error) {
      const code = (error as { code?: string }).code || '';
      if (code === 'email_exists' || /already.*registered|exists/i.test(error.message)) {
        return new Response(JSON.stringify({ error: 'user_already_exists' }), { status: 409, headers });
      }
      if (code === 'email_address_invalid' || /invalid/i.test(error.message)) {
        return new Response(JSON.stringify({ error: 'email_address_invalid' }), { status: 400, headers });
      }
      console.error('createUser failed', error);
      return new Response(JSON.stringify({ error: 'signup_failed' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    console.error('unexpected', e);
    return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500, headers });
  }
});
