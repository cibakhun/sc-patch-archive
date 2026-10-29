// Logik der Edge Function 'verify-rsi', ohne Deno-Abhaengigkeit.
//
// index.ts reicht Umgebung, fetch und Log hinein; tests/e2e/verify-rsi.test.js
// tut dasselbe mit Attrappen und prueft so genau den Code, der ausgeliefert
// wird. Bewusst reines JavaScript: Deno laedt es ohne Uebersetzung, Node ohne
// Typ-Entfernung.
//
// ABLAUF
//   1. Sitzung pruefen (GET /auth/v1/user mit dem JWT des Aufrufers), dann die
//      Drosselung (public.rsi_rate_ok, 30 je Konto und Stunde) -- beides VOR
//      jedem Abruf bei RSI.
//   2. action 'challenge' { rsi_handle }: Der Server stellt den Code aus
//      (public.rsi_challenge_issue) und gibt ihn zurueck. Der Code ist an Konto
//      und Handle gebunden.
//   3. action 'verify' { rsi_handle? }: Handle (angefragt oder das des Profils)
//      und Code kommen aus der Datenbank (public.rsi_challenge_get). Ein Code
//      im Anfragekoerper zaehlt nur fuer das alte Dashboard, und nur solange
//      RSI_LEGACY_FLOW=1 gesetzt ist (siehe index.ts).
//   4. GET https://robertsspaceindustries.com/citizens/<handle>: 8 s Zeitlimit,
//      hoechstens 2 MB gelesen, die Endadresse nach Weiterleitungen muss auf
//      demselben Host und derselben Citizen-Seite liegen. Der Code zaehlt nur
//      im Bio-Abschnitt (pageVerdict).
//   5. Ergebnis festhalten (public.rsi_challenge_result): gefunden -> Abzeichen
//      an genau dieses Handle; nicht gefunden beim verifizierten Handle ->
//      Abzeichen weg.
//
// ANTWORTEN: 200 nur mit einem echten Pruefergebnis { verified, ... }. Alles
// andere (Drosselung 429, Zeitlimit 504, RSI nicht erreichbar 502, kein Code
// 409, abgelaufen 410, ...) ist Nicht-2xx mit { error: '<kennung>' }. Das alte
// Dashboard nimmt das Abzeichen nur bei 200 mit verified:false; auf Nicht-2xx
// liefert supabase.functions.invoke ihm data = null, und es tut nichts.
// Fehlertexte aus Ausnahmen gehen nur ins Log, nie in die Antwort.

export const HANDLE_RE = /^[A-Za-z0-9_-]{3,60}$/;
export const CODE_RE = /^VB-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;
/** Format des alten, im Browser erzeugten Codes (VERSEBASE-VERIFY- + bis zu 6 Zeichen). */
export const LEGACY_CODE_RE = /^VERSEBASE-VERIFY-[A-Z0-9]{1,6}$/;

export const ALLOWED_ORIGINS = [
  'https://verse-base.com',
  'https://www.verse-base.com',
  'https://staging.verse-base.com',
];

export const RSI_HOST = 'robertsspaceindustries.com';
export const RSI_TIMEOUT_MS = 8000;
export const SUPABASE_TIMEOUT_MS = 5000;
export const MAX_PAGE_BYTES = 2 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 4 * 1024;

const RSI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Kennzeichen einer Cloudflare-Zwischenseite statt der Profilseite. */
const INTERSTITIAL_MARKERS = ['_cf_chl_opt', '<title>just a moment'];

export function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** Handle aus einer Eingabe: Leerraum und fuehrendes @ weg. Kein String -> null. */
export function cleanHandle(v) {
  if (typeof v !== 'string') return null;
  return v.trim().replace(/^@+/, '');
}

/**
 * Liest einen Strom bis hoechstens `max` Bytes. Mehr -> null (der Rest wird
 * nicht mehr gelesen, der Strom abgebrochen).
 */
export async function readBounded(stream, max) {
  if (!stream) return '';
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      try { await reader.cancel(); } catch { /* schon zu */ }
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.byteLength; }
  return new TextDecoder().decode(all);
}

/** Endadresse nach Weiterleitungen: gleicher Host, Citizen-Seite genau dieses Handles. */
export function isProfileUrl(finalUrl, handle) {
  let u;
  try { u = new URL(finalUrl); } catch { return false; }
  if (u.protocol !== 'https:' || u.hostname !== RSI_HOST) return false;
  let path;
  try { path = decodeURIComponent(u.pathname); } catch { return false; }
  path = path.replace(/\/+$/, '').toLowerCase();
  return path.endsWith('/citizens/' + handle.toLowerCase());
}

/** Laenge des Ausschnitts hinter der Bio-Marke, in dem der Code stehen muss. */
export const BIO_WINDOW = 20000;

/**
 * Der Bio-Abschnitt der Citizen-Seite: ab dem Element mit den Klassen "entry"
 * und "bio" bis zum naechsten "entry"-Element, hoechstens BIO_WINDOW Zeichen.
 * Keine Marke -> null.
 */
export function bioSection(html) {
  const cls = /class\s*=\s*["']([^"']*)["']/gi;
  let m;
  while ((m = cls.exec(html))) {
    const list = m[1].toLowerCase().split(/\s+/);
    if (list.includes('entry') && list.includes('bio')) {
      const start = m.index + m[0].length;
      let end = Math.min(html.length, start + BIO_WINDOW);
      const next = /class\s*=\s*["'][^"']*\bentry\b/gi;
      next.lastIndex = start;
      const n = next.exec(html);
      if (n && n.index < end) end = n.index;
      return html.slice(start, end);
    }
  }
  return null;
}

/**
 * 'found' | 'missing' | 'unrecognized'. Unrecognized heisst: das ist nicht
 * erkennbar die Profilseite (Zwischenseite, Handle fehlt, kein Bio-Abschnitt)
 * -- dann wird weder verifiziert noch entzogen.
 *
 * Gesucht wird NUR im Bio-Abschnitt: andere Teile der Citizen-Seite (Name und
 * Rangbezeichnung der Organisation) legen Dritte fest. Aendert RSI den
 * Seitenaufbau, faellt die Pruefung auf 'unrecognized' (502) und nimmt
 * niemandem das Abzeichen; neue Verifizierungen scheitern dann sichtbar.
 */
export function pageVerdict(html, code, handle) {
  const lower = html.toLowerCase();
  if (INTERSTITIAL_MARKERS.some((m) => lower.includes(m))) return 'unrecognized';
  if (!lower.includes(handle.toLowerCase())) return 'unrecognized';
  const bio = bioSection(html);
  if (bio === null) return 'unrecognized';
  return bio.toLowerCase().includes(code.toLowerCase()) ? 'found' : 'missing';
}

/** Ruft die Citizen-Seite ab. Ergebnis { kind, html? }. */
export async function fetchProfile(fetchImpl, handle) {
  const url = `https://${RSI_HOST}/citizens/${encodeURIComponent(handle)}`;
  let res;
  try {
    res = await fetchImpl(url, {
      headers: RSI_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(RSI_TIMEOUT_MS),
    });
  } catch (e) {
    return { kind: e && e.name === 'TimeoutError' ? 'timeout' : 'error' };
  }
  const drop = async () => { try { await res.body?.cancel(); } catch { /* egal */ } };
  if (!isProfileUrl(res.url || url, handle)) { await drop(); return { kind: 'unexpected' }; }
  if (res.status === 404) { await drop(); return { kind: 'not_found' }; }
  if (!res.ok) { await drop(); return { kind: 'error' }; }
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_PAGE_BYTES) { await drop(); return { kind: 'too_large' }; }
  let html;
  try {
    html = await readBounded(res.body, MAX_PAGE_BYTES);
  } catch (e) {
    return { kind: e && e.name === 'TimeoutError' ? 'timeout' : 'error' };
  }
  if (html === null) return { kind: 'too_large' };
  return { kind: 'ok', html };
}

const PAGE_ERRORS = {
  timeout: [504, 'rsi_timeout'],
  error: [502, 'rsi_unreachable'],
  unexpected: [502, 'rsi_unexpected'],
  not_found: [404, 'rsi_profile_not_found'],
  too_large: [502, 'rsi_too_large'],
};

class UpstreamError extends Error {
  constructor(what, status) {
    super(`${what}: HTTP ${status}`);
    this.name = 'UpstreamError';
  }
}

/**
 * createHandler({ env, fetch, log }) -> (Request) => Promise<Response>
 *   env(name)  liefert SUPABASE_URL, SUPABASE_ANON_KEY,
 *              SUPABASE_SERVICE_ROLE_KEY, RSI_LEGACY_FLOW
 *   fetch      fuer Supabase und RSI
 *   log        nur serverseitig (Fehlertexte, nie an den Client)
 */
export function createHandler({ env, fetch: fetchImpl, log = () => {} }) {
  const cfg = {
    url: (env('SUPABASE_URL') || '').replace(/\/+$/, ''),
    anonKey: env('SUPABASE_ANON_KEY') || '',
    serviceKey: env('SUPABASE_SERVICE_ROLE_KEY') || '',
    legacy: env('RSI_LEGACY_FLOW') === '1',
  };

  async function getUser(authHeader) {
    const res = await fetchImpl(`${cfg.url}/auth/v1/user`, {
      headers: { apikey: cfg.anonKey, Authorization: authHeader },
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new UpstreamError('auth', res.status);
    const user = await res.json();
    return user && typeof user.id === 'string' && user.id ? user : null;
  }

  async function rpc(fn, args) {
    const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: cfg.serviceKey,
        Authorization: `Bearer ${cfg.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
    if (!res.ok) throw new UpstreamError(fn, res.status);
    return res.json();
  }

  return async function handle(req) {
    const origin = req.headers.get('Origin');
    const reply = (status, body, extra = {}) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
      });
    const fail = (status, error, extra) => reply(status, { error }, extra);

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed');
    if (!cfg.url || !cfg.anonKey || !cfg.serviceKey) return fail(503, 'not_configured');

    try {
      // 1. Sitzung
      const authHeader = req.headers.get('Authorization') || '';
      if (!/^Bearer [A-Za-z0-9._~+/=-]+$/.test(authHeader)) return fail(401, 'unauthorized');
      const user = await getUser(authHeader);
      if (!user) return fail(401, 'unauthorized');

      // 2. Anfrage (klein, JSON-Objekt)
      const raw = await readBounded(req.body, MAX_REQUEST_BYTES);
      if (raw === null) return fail(413, 'too_large');
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { return fail(400, 'bad_json'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'bad_json');

      const action = body.action === undefined ? 'verify' : body.action;
      if (action !== 'challenge' && action !== 'verify') return fail(400, 'bad_action');

      let handle = null;
      if (body.rsi_handle !== undefined && body.rsi_handle !== null && body.rsi_handle !== '') {
        handle = cleanHandle(body.rsi_handle);
        if (!handle || !HANDLE_RE.test(handle)) return fail(400, 'invalid_handle');
      }
      if (action === 'challenge' && !handle) return fail(400, 'invalid_handle');

      // 3. Drosselung
      if ((await rpc('rsi_rate_ok', { p_user: user.id })) !== true) {
        return fail(429, 'rate_limited', { 'Retry-After': '3600' });
      }

      // 4. Code ausstellen
      if (action === 'challenge') {
        const c = await rpc('rsi_challenge_issue', { p_user: user.id, p_handle: handle });
        return reply(200, {
          rsi_handle: c.rsi_handle,
          code: c.code,
          confirmed: c.confirmed === true,
          expires_at: c.expires_at ?? null,
        });
      }

      // 5. Pruefen: Handle und Code aus der Datenbank
      const s = await rpc('rsi_challenge_get', { p_user: user.id, p_handle: handle });
      const target = s && typeof s.rsi_handle === 'string' ? s.rsi_handle : null;
      if (!target) return fail(409, 'no_handle');
      if (!HANDLE_RE.test(target)) return fail(409, 'invalid_handle');

      let code = null;
      if (typeof s.code === 'string' && s.code) {
        if (s.expired === true) return fail(410, 'challenge_expired');
        code = s.code;
      } else if (s.profile_verified === true && typeof s.profile_code === 'string' && LEGACY_CODE_RE.test(s.profile_code)) {
        // Altfall: vor diesem Umbau verifiziert. Nachpruefen mit dem Code aus
        // dem Profil; kann das Abzeichen nur behalten oder nehmen.
        code = s.profile_code;
      } else if (cfg.legacy && typeof body.rsi_code === 'string' && LEGACY_CODE_RE.test(body.rsi_code)) {
        // Uebergang: altes Dashboard, Code aus dem Browser. Nur mit RSI_LEGACY_FLOW=1.
        code = body.rsi_code;
      } else {
        return fail(409, 'no_challenge');
      }

      if (s.profile_verified === true && s.confirmed === true && s.checked_recently === true) {
        return reply(200, { verified: true, persisted: true, rsi_handle: target, cached: true });
      }

      // 6. RSI
      const page = await fetchProfile(fetchImpl, target);
      if (page.kind !== 'ok') {
        const [status, error] = PAGE_ERRORS[page.kind] || [502, 'rsi_unreachable'];
        return fail(status, error);
      }
      const verdict = pageVerdict(page.html, code, target);
      if (verdict === 'unrecognized') return fail(502, 'rsi_unrecognized');

      // 7. Festhalten
      const outcome = await rpc('rsi_challenge_result', {
        p_user: user.id,
        p_handle: target,
        p_code: code,
        p_found: verdict === 'found',
      });
      switch (outcome) {
        case 'verified':
          return reply(200, { verified: true, persisted: true, rsi_handle: target });
        case 'revoked':
          return reply(200, { verified: false, persisted: true, revoked: true, rsi_handle: target });
        case 'not_found':
          return reply(200, { verified: false, persisted: true, rsi_handle: target });
        case 'stale':
          return fail(409, 'challenge_changed');
        case 'taken':
          return fail(409, 'handle_taken');
        case 'no_profile':
          return fail(409, 'no_profile');
        default:
          log('verify-rsi: unbekanntes Ergebnis', outcome);
          return fail(500, 'internal');
      }
    } catch (err) {
      log('verify-rsi:', err && err.name, err && err.message);
      return fail(500, 'internal');
    }
  };
}
