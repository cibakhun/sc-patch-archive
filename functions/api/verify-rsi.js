// Cloudflare Pages Function: serverseitige RSI-Bio-Pruefung + DB-Persistierung.
//
// GET /api/verify-rsi?handle=<rsi_handle>&code=<rsi_code>
//   Authorization: Bearer <supabase-access-token>   (optional, fuer Persistierung)
//
// Ablauf:
//   1. Server-zu-Server GET auf robertsspaceindustries.com/citizens/<handle>
//      (Browser-Clients werden dort von Cloudflare CORS/Bot-Protection blockiert).
//   2. Prueft, ob <code> im HTML der Profilseite (Bio) enthalten ist.
//   3. Wenn ein gueltiges User-JWT mitgeschickt wurde, wird die User-ID
//      serverseitig ueber die Supabase Auth-API aufgeloest und das Ergebnis
//      mit der Service Role in public.profiles persistiert (verified + handle + code).
//      Ein DB-Trigger (siehe supabase/migrations/*guard_rsi_verified.sql) verbietet
//      Client-Writes auf rsi_verified=true — die Persistierung MUSS serverseitig
//      erfolgen.
//
// Benoetigte Environment Variables (Cloudflare Pages → Settings → Environment):
//   SUPABASE_URL              – https://<projekt>.supabase.co
//   SUPABASE_ANON_KEY         – Publishable/Anon Key (fuer die JWT-Pruefung)
//   SUPABASE_SERVICE_ROLE_KEY – Service Role Key (schreibt profiles; NIEMALS clientseitig)
// Ohne diese Variablen funktioniert die Pruefung weiterhin, persisted ist dann false.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const handle = url.searchParams.get('handle') || '';
  const code = url.searchParams.get('code') || '';

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type'
  };

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!handle || !code) {
    return new Response(JSON.stringify({ verified: false, error: 'Missing handle or code' }), {
      headers: corsHeaders,
      status: 400
    });
  }

  try {
    const rsiUrl = `https://robertsspaceindustries.com/citizens/${encodeURIComponent(handle)}`;
    const rsiRes = await fetch(rsiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      cf: { cacheTtl: 0, cacheEverything: false }
    });

    if (!rsiRes.ok) {
      return new Response(JSON.stringify({ verified: false, error: `RSI Profile returned HTTP ${rsiRes.status}` }), {
        headers: corsHeaders,
        status: 200
      });
    }

    const html = await rsiRes.text();
    const verified = html.includes(code);

    // Serverseitige Persistierung — nur mit gueltigem User-JWT. Die User-ID
    // kommt aus der Supabase Auth-API, niemals aus Request-Parametern.
    let persisted = false;
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'apikey': env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': authHeader
          }
        });

        if (userRes.ok) {
          const user = await userRes.json();
          if (user && user.id) {
            const upRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
              method: 'POST',
              headers: {
                'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
              },
              body: JSON.stringify({
                id: user.id,
                rsi_handle: handle,
                rsi_code: code,
                rsi_verified: verified,
                updated_at: new Date().toISOString()
              })
            });
            persisted = upRes.ok;
          }
        }
      } catch (dbErr) {
        // Persistierungsfehler darf die Pruefung selbst nicht brechen —
        // persisted=false signalisiert dem Client das Problem.
      }
    }

    return new Response(JSON.stringify({
      verified,
      persisted,
      handle,
      message: verified ? 'RSI Account successfully verified!' : `Code "${code}" was not found in @${handle}'s RSI bio.`
    }), {
      headers: corsHeaders,
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({ verified: false, error: err.message }), {
      headers: corsHeaders,
      status: 500
    });
  }
}
