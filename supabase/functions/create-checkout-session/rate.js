// Bremse je Anschluss fuer create-checkout-session (Datenbankseite:
// supabase/migrations/20261030160000_checkout_rate_limit.sql).
//
// Reines JavaScript ohne Deno-Abhaengigkeit, damit tests/e2e/checkout-rate.test.js
// genau diesen Code prueft; index.ts reicht nur Umgebung, fetch und Log hinein.
//
// IP-Adresse: cf-connecting-ip, wie die Anlage sie in ihren Function-Logs
// selbst fuehrt (am 29.10.2026 gezaehlt: in 26 von 26 Aufrufen gesetzt und
// gleich x-real-ip). Cloudflare setzt diesen Kopf und ueberschreibt einen vom
// Aufrufer mitgeschickten. x-forwarded-for traegt dagegen vorne, was der
// Aufrufer selbst hineinschreibt, und dient nur als letzter Rueckfall, dann
// mit dem LETZTEN Eintrag (vom naechsten Proxy angehaengt).
//
// Gezaehlt wird je IPv4-Adresse bzw. je IPv6-/64. Gespeichert wird nie die
// Adresse, nur HMAC-SHA-256(Geheimwert, Adresse) als Hex. Der Geheimwert ist
// CHECKOUT_RATE_SECRET, sonst der Service-Key der Function (beide nur in der
// Function). Ohne Geheimwert liesse sich eine
// IPv4-Adresse aus ihrem blossen SHA-256 in Minuten zurueckrechnen.
//
// Ausfall offen: ist die Adresse unbekannt, die Datenbank nicht erreichbar
// oder die Antwort unklar, laeuft die Spende durch, und das Log sagt es. Eine
// kaputte Buchfuehrung darf den Spendenknopf nicht abschalten; die Bremse ist
// Schutz vor Masse, keine Zugangskontrolle.

export const LIMIT_PER_HOUR = 10;
export const RETRY_AFTER_S = 3600;
export const RPC_TIMEOUT_MS = 3000;

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/**
 * Zaehlbare Einheit einer Adresse: IPv4 wie sie ist, IPv6 nur ihr /64 (ein
 * Anschluss bekommt meist ein ganzes /64 und koennte sonst je Aufruf eine neue
 * Adresse nehmen), "::ffff:a.b.c.d" als IPv4. '' = unbrauchbar.
 */
export function subjectOf(v) {
  const ip = String(v || '').trim();
  if (IPV4.test(ip)) return ip;
  const mapped = /^::ffff:((?:\d{1,3}\.){3}\d{1,3})$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!/^[0-9a-f:]{2,39}$/i.test(ip) || (ip.match(/::/g) || []).length > 1) return '';
  let groups;
  if (ip.includes('::')) {
    const [l, r] = ip.split('::');
    const left = l ? l.split(':') : [];
    const right = r ? r.split(':') : [];
    const fill = 8 - left.length - right.length;
    if (fill < 1) return '';
    groups = [...left, ...Array(fill).fill('0'), ...right];
  } else {
    groups = ip.split(':');
  }
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return '';
  return groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':') + '::/64';
}

/** Zaehleinheit des Aufrufers oder '' (unbekannt). */
export function clientIp(headers) {
  const get = (k) => (headers && typeof headers.get === 'function' ? headers.get(k) : null);
  const cf = subjectOf(get('cf-connecting-ip'));
  if (cf) return cf;
  const real = subjectOf(get('x-real-ip'));
  if (real) return real;
  const xff = String(get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff.length ? subjectOf(xff[xff.length - 1]) : '';
}

/** HMAC-SHA-256(secret, 'checkout-rate:' + ip) als 64 Hex-Zeichen. */
export async function ipKey(ip, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('checkout-rate:' + ip)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * true = weiter, false = gebremst (429). Wirft nie.
 * env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional CHECKOUT_RATE_SECRET.
 * @param {{ headers: { get(name: string): string | null }, env: Record<string, string | undefined>,
 *           fetch: (url: string, init: object) => Promise<{ ok: boolean, status: number, json(): Promise<unknown> }>,
 *           log?: (message: string) => void }} opts
 * @returns {Promise<boolean>}
 */
export async function checkoutAllowed({ headers, env, fetch: fetchImpl, log = () => {} }) {
  try {
    const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
    const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
    const secret = String(env.CHECKOUT_RATE_SECRET || '') || serviceKey;
    if (!url || !serviceKey) {
      log('checkout-rate: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen, ungebremst');
      return true;
    }
    const ip = clientIp(headers);
    if (!ip) {
      log('checkout-rate: keine Adresse des Aufrufers, ungebremst');
      return true;
    }
    const res = await fetchImpl(`${url}/rest/v1/rpc/checkout_rate_ok`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ip_key: await ipKey(ip, secret) }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!res.ok) {
      log(`checkout-rate: RPC ${res.status}, ungebremst`);
      return true;
    }
    const verdict = await res.json().catch(() => null);
    if (verdict === false) return false;
    if (verdict !== true) log('checkout-rate: unklare RPC-Antwort, ungebremst');
    return true;
  } catch (e) {
    log(`checkout-rate: ${e && e.name ? e.name : 'Fehler'}, ungebremst`);
    return true;
  }
}
