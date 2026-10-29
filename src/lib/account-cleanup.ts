// Was ein Konto im Browser hinterlaesst, und was beim Abmelden bzw. Loeschen
// davon weg muss. Ohne Importe, damit tests/e2e/account-cleanup.test.js die
// Datei unveraendert laden kann.
//
// Beim Abmelden (auch einem erzwungenen, wenn GoTrue das Token ablehnt,
// und bei "Ueberall abmelden") und beim Loeschen gleichermassen:
//   localStorage   vb_profile_<uid>  Profil-Cache des Dashboards (Bio, Status,
//                                    Discord-Name, RSI-Handle und -Code, Org …).
//                                    Alle vb_profile_*-Eintraege gehen, auch
//                                    die frueherer Konten auf diesem Geraet.
//                  vb_rsi_code       RSI-Pruefcode ohne Kontobezug
//                  vb.fleet.v1.<uid>, craft.state.v2.<uid>, vb.layouts.v1.<uid>
//                                    Konto-Spiegel der Werkzeuge, auch die
//                                    frueherer Konten: auf einem geteilten
//                                    Rechner sieht nach dem Abmelden niemand,
//                                    was der Vorgaenger besitzt oder plant
//                                    (Datenschutzerklaerung #storage). Die
//                                    Gast-Ablagen ohne Punkt und Konto-ID
//                                    bleiben.
//   sessionStorage vb_user_role      gemerkte Rolle (account-lite.js, Layout)
//                  vb.dcLinking      Merker "Discord wird gerade verbunden"
//                  vb_share_<uid>    Schalterstand des Pulses (account-lite.js)
// Die Supabase-Sitzung selbst entfernt supabase.auth.signOut().

export const PROFILE_CACHE_PREFIX = 'vb_profile_';
export const RSI_CODE_KEY = 'vb_rsi_code';
export const ROLE_CACHE_KEY = 'vb_user_role';
export const DC_LINKING_KEY = 'vb.dcLinking';
export const FLEET_MIRROR_PREFIX = 'vb.fleet.v1.';
export const CRAFT_MIRROR_PREFIX = 'craft.state.v2.';
export const LAYOUT_MIRROR_PREFIX = 'vb.layouts.v1.';
export const SHARE_CACHE_PREFIX = 'vb_share_';
const LOCAL_PREFIXES = [PROFILE_CACHE_PREFIX, FLEET_MIRROR_PREFIX, CRAFT_MIRROR_PREFIX, LAYOUT_MIRROR_PREFIX];

/** Das Noetigste von Storage, damit Tests eine Map hineinreichen koennen. */
export interface KeyStore {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

export type CleanupMode = 'signout' | 'delete';

/**
 * Feste Schluessel fuer dieses Konto (ohne den Rundumschlag ueber die
 * Praefixe). Abmelden und Loeschen raeumen dasselbe weg; mode bleibt fuer
 * die Aufrufer lesbar.
 */
export function accountKeys(uid: string, _mode: CleanupMode): { local: string[]; session: string[] } {
  const local = [PROFILE_CACHE_PREFIX + uid, RSI_CODE_KEY, FLEET_MIRROR_PREFIX + uid, CRAFT_MIRROR_PREFIX + uid, LAYOUT_MIRROR_PREFIX + uid];
  return { local, session: [ROLE_CACHE_KEY, DC_LINKING_KEY, SHARE_CACHE_PREFIX + uid] };
}

function drop(store: KeyStore | null | undefined, keys: string[], prefixes: string[] = []): number {
  if (!store) return 0;
  const doomed = new Set<string>();
  try {
    for (const k of keys) doomed.add(k);
    for (let i = 0; i < store.length && prefixes.length; i++) {
      const k = store.key(i);
      if (k && prefixes.some((p) => k.startsWith(p))) doomed.add(k);
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
  return drop(stores.local, keys.local, LOCAL_PREFIXES) + drop(stores.session, keys.session);
}

/** Der Browser-Speicher, falls zugreifbar (privater Modus, gesperrte Cookies). */
export function browserStores(): { local: KeyStore | null; session: KeyStore | null } {
  let local: KeyStore | null = null;
  let session: KeyStore | null = null;
  try { local = window.localStorage; } catch { /* gesperrt */ }
  try { session = window.sessionStorage; } catch { /* gesperrt */ }
  return { local, session };
}
