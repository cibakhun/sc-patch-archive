// Supabase-Client für die /account/-Seiten (dort von Astro/Vite gebundelt).
// flowType 'implicit': Bestätigungs-/Recovery-Links aus E-Mails tragen die
// Session im URL-Fragment und funktionieren damit auch, wenn die Mail auf
// einem ANDEREN Gerät/Browser geöffnet wird (PKCE bräuchte den code_verifier
// aus dem localStorage des anfordernden Browsers).
import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '../consts';

export const supabase = createClient(SUPABASE.url, SUPABASE.publishableKey, {
  auth: {
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Basisform-Pfad (EN) je Favoriten-Kind — DE-Seiten präfixen mit /de. */
export const FAV_PATH: Record<string, string> = {
  ship: '/schiffe/%s.html',
  mission: '/missionen/%s.html',
  mineral: '/topics/mining.html#%s',
  item: '/item-finder.html#%s',
  patch: '/patches/sc-%s.html',
  topic: '/topics/%s.html',
};
