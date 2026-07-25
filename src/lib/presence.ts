// Präsenz-Anzeige (Discord-Stil): automatische Präsenz online/away/offline +
// optionale manuelle Aktivität (ingame/mission), die "online" überschreibt.
//
// Die AUTOMATISCHE Präsenz wird serverseitig in den Views public_profiles /
// social_profiles aus zwei Signalen abgeleitet (Zwei-Signal-Modell):
//   last_seen   = "Tab offen"-Ping (account-lite.js, alle 30s solange Tab offen)
//   last_active = letzte Interaktion
//   -> Tab offen + idle >3min = away (NIE offline); Tab zu -> ~1min away, 3min offline.
// Der Client liest die fertige `presence` aus der View; diese Datei macht nur
// noch die Aktivitäts-Überlagerung fürs Label/den Punkt.
export type Presence = 'online' | 'away' | 'offline';

/**
 * Anzuzeigenden STATUS_STATES-Schlüssel bestimmen: die (serverseitig) abgeleitete
 * Präsenz — aber wenn online UND eine manuelle Aktivität (ingame/mission) gesetzt
 * ist, gewinnt die Aktivität. Alt-Werte (online/away/offline) in `activity`
 * zählen NICHT als Aktivität → reine Auto-Präsenz.
 */
export function resolveStatusKey(presence: Presence, activity?: string | null): string {
  if (presence === 'online' && (activity === 'ingame' || activity === 'mission')) return activity;
  return presence;
}
