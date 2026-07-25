// Dynamische Präsenz: aus einem last_seen-Heartbeat abgeleitet
// (online/away/offline). Optional überschrieben von einer manuellen Aktivität
// (ingame/mission), solange der Nutzer online ist — Discord-Stil.
// Geteilt von account-dashboard.ts, PilotPage und FriendsManager. account-lite.js
// (SDK-frei) trägt eine eigene Inline-Kopie der Schwellen.
export type Presence = 'online' | 'away' | 'offline';

// Schwellen müssen zur SQL-Ableitung in den Views public_profiles/social_profiles
// passen (dort now()-last_seen < 3min = online, < 15min = away).
export const ONLINE_MS = 3 * 60_000;
export const AWAY_MS = 15 * 60_000;

/** Präsenz aus einem last_seen-Zeitstempel ableiten (Client-Seite, z. B. eigenes Dashboard). */
export function derivePresence(lastSeen?: string | null, nowMs: number = Date.now()): Presence {
  if (!lastSeen) return 'offline';
  const age = nowMs - new Date(lastSeen).getTime();
  if (Number.isNaN(age)) return 'offline';
  if (age < ONLINE_MS) return 'online';
  if (age < AWAY_MS) return 'away';
  return 'offline';
}

/**
 * Anzuzeigenden STATUS_STATES-Schlüssel bestimmen: die automatische Präsenz —
 * aber wenn online UND eine manuelle Aktivität (ingame/mission) gesetzt ist,
 * gewinnt die Aktivität. Alt-Werte (online/away/offline) in `activity` zählen
 * NICHT als Aktivität → reine Auto-Präsenz.
 */
export function resolveStatusKey(presence: Presence, activity?: string | null): string {
  if (presence === 'online' && (activity === 'ingame' || activity === 'mission')) return activity;
  return presence;
}
