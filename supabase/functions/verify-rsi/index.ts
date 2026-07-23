// Supabase Edge Function 'verify-rsi' — die EINZIGE serverseitige Komponente
// der RSI-Verifizierung.
//
// Warum Edge Function: verse-base.com ist eine statische Site (Astro-Build in
// Docker, ausgeliefert per nginx auf Coolify; Cloudflare macht nur DNS/Proxy/
// TLS davor). Es gibt KEIN Cloudflare-Pages-Projekt — serverseitiger Code kann
// nur hier laufen, analog zu den bestehenden Functions 'delete-account' und
// 'register'.
//
// Ablauf:
//   1. Server-zu-Server GET auf robertsspaceindustries.com/citizens/<handle>
//      (Browser-Clients werden dort von Cloudflare CORS/Bot-Protection blockiert).
//   2. Prueft, ob <rsi_code> im HTML der Profilseite (Bio) enthalten ist.
//   3. Die User-ID kommt aus dem Session-JWT (Authorization-Header), NIEMALS
//      aus dem Request-Body. Persistiert wird mit der Service Role — ein
//      DB-Trigger (supabase/migrations/*guard_rsi_verified.sql) verbietet
//      Client-Writes auf rsi_verified=true, die Persistierung MUSS daher
//      serverseitig erfolgen.
//
// Aufruf: supabase.functions.invoke('verify-rsi', { body: { rsi_handle, rsi_code } })
// (supabase-js haengt das Session-JWT automatisch an; die Function verlangt
// gueltiges JWT — Supabase-Gateway-Default.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { rsi_handle, rsi_code } = await req.json();

    if (!rsi_handle || !rsi_code) {
      return new Response(
        JSON.stringify({ verified: false, error: 'rsi_handle and rsi_code are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Server-to-server fetch of the RSI profile (bypasses browser blocks)
    const rsiUrl = `https://robertsspaceindustries.com/citizens/${encodeURIComponent(rsi_handle)}`;
    const rsiRes = await fetch(rsiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!rsiRes.ok) {
      return new Response(
        JSON.stringify({ verified: false, error: `RSI Profile HTTP ${rsiRes.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const html = await rsiRes.text();
    const verified = html.includes(rsi_code);

    // Persistierung: User aus dem JWT aufloesen, mit Service Role schreiben.
    let persisted = false;
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();

      if (user) {
        const supabaseAdmin = createClient(
          supabaseUrl,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
          id: user.id,
          rsi_handle,
          rsi_code,
          rsi_verified: verified,
          updated_at: new Date().toISOString()
        });
        persisted = !upsertError;
      }
    }

    return new Response(
      JSON.stringify({
        verified,
        persisted,
        rsi_handle,
        message: verified ? 'RSI Account successfully verified!' : `Code "${rsi_code}" not found in RSI bio.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ verified: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
