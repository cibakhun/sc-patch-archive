// Supabase-Client für die /account/-Seiten (dort von Astro/Vite gebundelt).
//
// flowType 'pkce': Ein Discord-Rücksprung (Anmelden, Verbinden) trägt nur
// noch einen `?code=`, den supabase-js mit dem code_verifier aus dem Speicher
// DIESES Browsers einlöst. Ein fremder Rücksprung ohne passenden Verifier
// erzeugt keine Sitzung, und Sitzungs-Tokens im Fragment übernimmt der
// Client auf keiner Seite mehr (auth-js 2.110.9 lehnt sie bei pkce ab;
// zusätzlich nimmt lib/auth-url.ts sie vorher aus der Adresse).
//
// E-Mail-Links (Passwort zurücksetzen, E-Mail bestätigen/wechseln) sollen auf
// JEDEM Gerät funktionieren. Sie laufen deshalb nicht über den
// code_verifier, sondern über `?token_hash=…&type=…` aus den Mailvorlagen
// und verifyOtp() in einem eigenen, nicht speichernden Client
// (linkClient() unten). So landet eine Sitzung aus einem Mail-Link nie in
// der gemeinsamen Sitzung dieses Browsers.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../consts';
import { takeAuthFromUrl, type AuthUrl } from './auth-url';

/** Auth-Parameter dieses Seitenaufrufs; die Adresse ist danach bereinigt. */
export const AUTH_URL: AuthUrl = takeAuthFromUrl();

export const supabase = createClient(SUPABASE.url, SUPABASE.publishableKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    // Nur der PKCE-`code` wird eingelöst. Die Funktion verneint jede
    // Deutung als impliziten Rücksprung (Tokens/Fehler im Fragment), auch
    // falls eine künftige supabase-js-Version das bei pkce wieder zuließe.
    detectSessionInUrl: () => false,
  },
});

let link: SupabaseClient | null = null;
/**
 * Eigener Client für E-Mail-Links: Sitzung nur im Speicher dieser Seite,
 * kein Auffrischen, kein Lesen der Adresse, eigener Speicherschlüssel (kein
 * Übersprechen mit der gemeinsamen Sitzung, auch nicht über andere Tabs).
 * flowType 'implicit' nur, damit ein hier angeforderter Recovery-Link KEINEN
 * code_verifier braucht: mit den alten Mailvorlagen bleibt er so auf einem
 * anderen Gerät benutzbar, mit den neuen (token_hash) ist es ohnehin egal.
 */
export function linkClient(): SupabaseClient {
  if (!link) {
    link = createClient(SUPABASE.url, SUPABASE.publishableKey, {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'vb-link',
      },
    });
  }
  return link;
}

/** Basisform-Pfad (EN) je Favoriten-Kind — DE-Seiten präfixen mit /de. */
export const FAV_PATH: Record<string, string> = {
  ship: '/schiffe/%s.html',
  mission: '/missionen/%s.html',
  mineral: '/topics/mining.html#%s',
  item: '/item-finder.html#%s',
  patch: '/patches/sc-%s.html',
  topic: '/topics/%s.html',
};
