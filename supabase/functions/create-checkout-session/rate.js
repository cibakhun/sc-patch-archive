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
// Gezaehlt wird je IPv4-Adresse bzw. je IPv6-/56 (ein Anschluss bekommt meist
// ein /56 oder /48; je /64 gezaehlt, haette ein billiges /48 65.536 Konten).
// Nur oeffentliche Adressen: eine private, CGNAT- oder Loopback-Adresse waere
// ein Proxy der Anlage, und alle Spender teilten sich ein Konto; dann lieber
// ungebremst (siehe unten) und im Log. Gespeichert wird nie die
// Adresse, nur HMAC-SHA-256(Geheimwert, Adresse) als Hex. Der Geheimwert ist
// CHECKOUT_RATE_SECRET, sonst der Service-Key der Function (beide nur
// serverseitig, nie in der Datenbank; den Service-Key haben auch die anderen
// Functions und der Bot). Ohne Geheimwert liesse sich eine
// IPv4-Adresse aus ihrem blossen SHA-256 in Minuten zurueckrechnen.
//
// Ausfall offen: ist die Adresse unbekannt, die Datenbank nicht erreichbar
// oder die Antwort unklar, laeuft die Spende durch, und das Log sagt es. Eine
// kaputte Buchfuehrung darf den Spendenknopf nicht abschalten; die Bremse ist
// Schutz vor Masse, keine Zugangskontrolle.

export const LIMIT_PER_HOUR = 10;
export const RETRY_AFTER_S = 3600;
export const RPC_TIMEOUT_MS = 3000;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Oeffentliche IPv4-Adresse normalisiert, sonst ''. */
function publicV4(ip) {
  const m = IPV4.exec(ip);
  if (!m) return '';
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((x) => x > 255)) return '';
  if (a === 0 || a === 10 || a === 127 || a >= 224) return ''; // dieses Netz, privat, Loopback, Multicast, Klasse E
  if (a === 100 && b >= 64 && b <= 127) return ''; // CGNAT 100.64/10
  if (a === 169 && b === 254) return ''; // Link-local
  if (a === 172 && b >= 16 && b <= 31) return ''; // privat 172.16/12
  if (a === 192 && b === 168) return ''; // privat 192.168/16
  return `${a}.${b}.${c}.${d}`;
}

/**
 * Zaehlbare Einheit einer Adresse: oeffentliche IPv4 wie sie ist, IPv6 nur
 * ihr /56 (ein Anschluss bekommt meist ein ganzes /56 und koennte sonst je
 * Aufruf eine neue Adresse nehmen), "::ffff:a.b.c.d" als IPv4. '' =
 * unbrauchbar oder nicht oeffentlich.
 */
export function subjectOf(v) {
  const ip = String(v || '').trim();
  if (IPV4.test(ip)) return publicV4(ip);
  const mapped = /^::ffff:((?:\d{1,3}\.){3}\d{1,3})$/i.exec(ip);
  if (mapped) return publicV4(mapped[1]);
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
  const n = groups.map((g) => parseInt(g, 16));
  // Nur global: kein ::/::1, kein ULA fc00::/7, kein Link-local fe80::/10,
  // kein Multicast ff00::/8.
  if (n.slice(0, 7).every((x) => x === 0)) return '';
  if ((n[0] & 0xfe00) === 0xfc00 || (n[0] & 0xffc0) === 0xfe80 || (n[0] & 0xff00) === 0xff00) return '';
  return [n[0], n[1], n[2], n[3] & 0xff00].map((x) => x.toString(16)).join(':') + '::/56';
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
