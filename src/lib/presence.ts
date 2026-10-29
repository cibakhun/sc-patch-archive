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
// Wer den Status sieht, wählt jeder selbst (profiles.presence_visibility):
// 'friends' (Vorgabe) zeigt ihn in social_profiles nur bestätigten Freunden,
// 'all' auch in public_profiles, 'none' niemandem. Wer ihn nicht sehen darf,
// bekommt presence = null; die Anzeigen blenden den Punkt dann aus, statt
// "Offline" zu behaupten.
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

// Rich Presence (Kontoseite Runde 4): der Präsenz-Puls in account-lite.js
// schreibt nach profiles.activity, WAS man gerade auf der Seite macht, als
// 'art|Name' (z. B. 'hangar|Gladius'). Sprachneutral gespeichert, damit ein
// englischer Freund denselben Eintrag englisch liest. social_profiles gibt
// den Wert nur an Freunde und nur frisch (3 min) heraus.
const ACTIVITY: Record<string, { de: [string, string]; en: [string, string] }> = {
  hangar: { de: ['Im Hangar · %s', 'Im Hangar'], en: ['In the hangar · %s', 'In the hangar'] },
  loadout: { de: ['Loadout für %s', 'Baut ein Loadout'], en: ['Loadout for %s', 'Building a loadout'] },
  ship: { de: ['Schaut sich %s an', 'Stöbert in Schiffen'], en: ['Looking at %s', 'Browsing ships'] },
  mining: { de: ['Plant Mining', 'Plant Mining'], en: ['Planning mining', 'Planning mining'] },
};

/** 'art|Name' -> Anzeigetext; unbekannte Arten ergeben '' (dann gilt der Status). */
export function formatActivity(raw: string | null | undefined, lang: 'de' | 'en'): string {
  if (!raw) return '';
  const i = raw.indexOf('|');
  const kind = i < 0 ? raw : raw.slice(0, i);
  const name = i < 0 ? '' : raw.slice(i + 1).trim();
  const t = ACTIVITY[kind];
  if (!t) return '';
  const [withName, plain] = t[lang];
  return name ? withName.replace('%s', name) : plain;
}
