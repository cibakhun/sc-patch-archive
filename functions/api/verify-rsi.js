export async function onRequest(context) {
  const url = new URL(context.request.url);
  const handle = url.searchParams.get('handle') || '';
  const code = url.searchParams.get('code') || '';

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*'
  };

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
      }
    });

    if (!rsiRes.ok) {
      return new Response(JSON.stringify({ verified: false, error: `RSI Profile returned HTTP ${rsiRes.status}` }), {
        headers: corsHeaders,
        status: 200
      });
    }

    const html = await rsiRes.text();
    const verified = html.includes(code);

    return new Response(JSON.stringify({
      verified,
      handle,
      code,
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
