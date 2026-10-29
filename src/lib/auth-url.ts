// Auth-Rücksprünge in der Adresse: lesen, merken, aus der Adresse nehmen.
//
// Läuft beim Import von lib/supabase.ts, also VOR createClient() und vor
// jedem Seitenskript, das den Client nutzt. Zwei Gründe:
//
//  1. Sitzungs-Tokens (access_token/refresh_token …) aus der Adresse werden
//     auf KEINER Seite in die gemeinsame Sitzung übernommen. Seit der
//     Umstellung auf flowType 'pkce' lehnt supabase-js sie selbst ab
//     (auth-js 2.110.9, GoTrueClient._getSessionFromURL: Fragment-Tokens bei
//     pkce -> AuthPKCEGrantCodeExchangeError); hier verschwinden sie
//     zusätzlich aus Adresse und Verlauf, bevor überhaupt jemand sie liest.
//     Einzige Ausnahme in der Übergangszeit: auf update-password.html werden
//     sie NUR im Speicher gehalten und dort in einen eigenen, nicht
//     speichernden Client gegeben (siehe AuthUpdatePassword.astro).
//  2. Fehler- und Link-Parameter (error…, token_hash, type, message) kommen
//     je nach Ablauf in der Query (PKCE, E-Mail-Vorlagen) oder im Fragment
//     (alte Links). Die Seiten lesen sie hier aus EINER Quelle, und die
//     Adresse ist danach sauber (kein Fehlertext, kein Einmal-Schlüssel im
//     Verlauf, in Lesezeichen oder Bildschirmfotos).
//
// `code` bleibt stehen: den tauscht supabase-js (PKCE) selbst gegen die
// Sitzung und nimmt ihn danach aus der Adresse. Ohne passenden code_verifier
// im Speicher dieses Browsers ist er wertlos.
//
// Bewusst ohne Importe: tests/e2e/auth-url.test.js lädt diese Datei direkt.

/** Schlüssel, die eine Sitzung tragen (impliziter Ablauf). */
const SESSION_KEYS = [
  'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token',
  'expires_in', 'expires_at', 'token_type',
] as const;

/** Schlüssel, die nur Auth-Rücksprünge setzen. */
const INFO_KEYS = ['error', 'error_code', 'error_description', 'token_hash', 'message'] as const;

export interface LegacyTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthUrl {
  /** GoTrue-Fehler (Query oder Fragment), leer wenn keiner. */
  error: string;
  errorCode: string;
  errorDescription: string;
  /** Hinweis von GoTrue, z. B. die erste von zwei Bestätigungen eines E-Mail-Wechsels. */
  message: string;
  /** Einmal-Schlüssel aus den E-Mail-Vorlagen ({{ .TokenHash }}). */
  tokenHash: string;
  /** Art des Links (recovery, email, signup, magiclink, email_change …). */
  type: string;
  /** Stand ein PKCE-`code` in der Query? (bleibt für supabase-js stehen) */
  hasCode: boolean;
  /** Standen Sitzungs-Tokens in der Adresse? (wurden entfernt) */
  hadSessionTokens: boolean;
  /** Nur für die Übergangsseite: die entfernten Tokens, sonst null. */
  legacy: LegacyTokens | null;
  /** Bereinigte relative Adresse, oder null, wenn nichts zu entfernen war. */
  cleaned: string | null;
}

/** Seiten, auf denen alte Recovery-Links (Tokens im Fragment) noch landen. */
export const isUpdatePasswordPath = (pathname: string): boolean =>
  /^\/(?:de\/)?account\/update-password(?:\.html)?$/.test(pathname);

/**
 * Reine Funktion: liest die Auth-Parameter aus `href` und liefert die
 * bereinigte Adresse. `keepLegacy` entscheidet, ob entfernte Tokens im
 * Ergebnis bleiben dürfen (nur update-password.html).
 */
export function parseAuthUrl(href: string, keepLegacy: (pathname: string) => boolean = isUpdatePasswordPath): AuthUrl {
  const u = new URL(href);
  const q = u.searchParams;
  const rawHash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
  const h = new URLSearchParams(rawHash);

  const hashIsAuth = [...SESSION_KEYS, ...INFO_KEYS].some((k) => h.has(k));
  const pick = (k: string): string => q.get(k) || (hashIsAuth ? h.get(k) : null) || '';

  const out: AuthUrl = {
    error: pick('error'),
    errorCode: pick('error_code'),
    errorDescription: pick('error_description'),
    message: pick('message'),
    tokenHash: pick('token_hash'),
    type: '',
    hasCode: q.has('code'),
    hadSessionTokens: SESSION_KEYS.some((k) => q.has(k) || (hashIsAuth && h.has(k))),
    legacy: null,
    cleaned: null,
  };
  // `type` ist ein zu allgemeiner Name, um ihn überall zu deuten: nur neben
  // einem Auth-Parameter (Query) oder in einem Auth-Fragment.
  const qIsAuth = INFO_KEYS.some((k) => q.has(k)) || SESSION_KEYS.some((k) => q.has(k));
  out.type = (qIsAuth ? q.get('type') : null) || (hashIsAuth ? h.get('type') : null) || '';

  if (out.hadSessionTokens && keepLegacy(u.pathname)) {
    const at = q.get('access_token') || (hashIsAuth ? h.get('access_token') : null) || '';
    const rt = q.get('refresh_token') || (hashIsAuth ? h.get('refresh_token') : null) || '';
    if (at && rt) out.legacy = { access_token: at, refresh_token: rt };
  }

  let changed = false;
  for (const k of [...SESSION_KEYS, ...INFO_KEYS]) {
    if (q.has(k)) { q.delete(k); changed = true; }
  }
  if (qIsAuth && q.has('type')) { q.delete('type'); changed = true; }
  // Ein Auth-Fragment gehört ganz GoTrue; ein normales (#security, #friends)
  // bleibt unangetastet.
  const keepHash = hashIsAuth ? '' : u.hash;
  if (hashIsAuth) changed = true;

  if (changed) {
    const search = q.toString();
    out.cleaned = u.pathname + (search ? '?' + search : '') + keepHash;
  }
  return out;
}

/**
 * Wendet parseAuthUrl auf die aktuelle Seite an und räumt die Adresse auf.
 * Im Nicht-Browser-Kontext (Astro-Build) ein leeres Ergebnis.
 */
export function takeAuthFromUrl(): AuthUrl {
  const empty: AuthUrl = {
    error: '', errorCode: '', errorDescription: '', message: '', tokenHash: '', type: '',
    hasCode: false, hadSessionTokens: false, legacy: null, cleaned: null,
  };
  if (typeof window === 'undefined' || !window.location) return empty;
  let res: AuthUrl;
  try { res = parseAuthUrl(window.location.href); } catch { return empty; }
  if (res.cleaned !== null) {
    try { window.history.replaceState(window.history.state, '', res.cleaned); } catch { /* Adresse bleibt, Werte sind gemerkt */ }
  }
  return res;
}

/** Nimmt den PKCE-`code` aus der Adresse, falls supabase-js ihn nicht eingelöst hat. */
export function dropCodeFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has('code')) return;
    u.searchParams.delete('code');
    const search = u.searchParams.toString();
    window.history.replaceState(window.history.state, '', u.pathname + (search ? '?' + search : '') + u.hash);
  } catch { /* egal */ }
}
