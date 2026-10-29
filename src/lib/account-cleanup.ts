// Was ein Konto im Browser hinterlaesst, und was beim Abmelden bzw. Loeschen
// davon weg muss. Ohne Importe, damit tests/e2e/account-cleanup.test.js die
// Datei unveraendert laden kann.
//
// Beim Abmelden (auch einem erzwungenen, wenn GoTrue das Token ablehnt):
//   localStorage   vb_profile_<uid>  Profil-Cache des Dashboards (Bio, Status,
//                                    Discord-Name, RSI-Handle und -Code, Org …).
//                                    Alle vb_profile_*-Eintraege gehen, auch
//                                    die frueherer Konten auf diesem Geraet.
//                  vb_rsi_code       RSI-Pruefcode ohne Kontobezug
//   sessionStorage vb_user_role      gemerkte Rolle (account-lite.js, Layout)
//                  vb.dcLinking      Merker "Discord wird gerade verbunden"
// Beim Loeschen zusaetzlich die Werkzeug-Spiegel des Kontos; ihre offenen
// Schreibvorgaenge haben kein Ziel mehr:
//   localStorage   vb.fleet.v1.<uid>, craft.state.v2.<uid>, vb.layouts.v1.<uid>
// Die Supabase-Sitzung selbst entfernt supabase.auth.signOut().

export const PROFILE_CACHE_PREFIX = 'vb_profile_';
export const RSI_CODE_KEY = 'vb_rsi_code';
export const ROLE_CACHE_KEY = 'vb_user_role';
export const DC_LINKING_KEY = 'vb.dcLinking';
export const FLEET_MIRROR_PREFIX = 'vb.fleet.v1.';
export const CRAFT_MIRROR_PREFIX = 'craft.state.v2.';
export const LAYOUT_MIRROR_PREFIX = 'vb.layouts.v1.';

/** Das Noetigste von Storage, damit Tests eine Map hineinreichen koennen. */
export interface KeyStore {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

export type CleanupMode = 'signout' | 'delete';

/** Feste Schluessel fuer dieses Konto (ohne den vb_profile_-Rundumschlag). */
export function accountKeys(uid: string, mode: CleanupMode): { local: string[]; session: string[] } {
  const local = [PROFILE_CACHE_PREFIX + uid, RSI_CODE_KEY];
  if (mode === 'delete') local.push(FLEET_MIRROR_PREFIX + uid, CRAFT_MIRROR_PREFIX + uid, LAYOUT_MIRROR_PREFIX + uid);
  return { local, session: [ROLE_CACHE_KEY, DC_LINKING_KEY] };
}

function drop(store: KeyStore | null | undefined, keys: string[], prefix?: string): number {
  if (!store) return 0;
  const doomed = new Set<string>();
  try {
    for (const k of keys) doomed.add(k);
    if (prefix) {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(prefix)) doomed.add(k);
      }
    }
  } catch { /* gesperrter Speicher: dann wenigstens die festen Schluessel */ }
  let n = 0;
  for (const k of doomed) {
    try { store.removeItem(k); n++; } catch { /* weiter mit dem naechsten */ }
  }
  return n;
}

/**
 * Entfernt die Spuren eines Kontos. Wirft nie; gibt die Zahl der
 * removeItem-Aufrufe zurueck (fuer Tests, nicht fuer die Oberflaeche).
 */
export function clearAccountTraces(
  uid: string,
  mode: CleanupMode,
  stores: { local?: KeyStore | null; session?: KeyStore | null },
): number {
  const keys = accountKeys(uid, mode);
  return drop(stores.local, keys.local, PROFILE_CACHE_PREFIX) + drop(stores.session, keys.session);
}

/** Der Browser-Speicher, falls zugreifbar (privater Modus, gesperrte Cookies). */
export function browserStores(): { local: KeyStore | null; session: KeyStore | null } {
  let local: KeyStore | null = null;
  let session: KeyStore | null = null;
  try { local = window.localStorage; } catch { /* gesperrt */ }
  try { session = window.sessionStorage; } catch { /* gesperrt */ }
  return { local, session };
}
