// Crew-Aufruf an Freunde (Konto, „Freunde & Social“; Tabellen crew_calls und
// crew_call_members, Migration 20261124110000). Hier nur das Rechnen ohne
// Seite: Tätigkeiten, Beginn aus „Heute/Morgen + Uhrzeit“, Zeitangabe für die
// Karte und welche Aufrufe noch zählen. FriendsManager malt, tests/e2e/crew.test.js
// prüft.

export const CREW_ACTIVITIES = ['mining', 'salvage', 'cargo', 'bounty', 'combat', 'exploration', 'racing', 'other'] as const;
export type CrewActivity = (typeof CREW_ACTIVITIES)[number];

export const CREW_LABELS: Record<'de' | 'en', Record<CrewActivity, string>> = {
  de: {
    mining: 'Mining', salvage: 'Salvage', cargo: 'Fracht', bounty: 'Kopfgeldjagd',
    combat: 'Kampf', exploration: 'Erkundung', racing: 'Rennen', other: 'Sonstiges',
  },
  en: {
    mining: 'Mining', salvage: 'Salvage', cargo: 'Cargo', bounty: 'Bounty hunting',
    combat: 'Combat', exploration: 'Exploration', racing: 'Racing', other: 'Other',
  },
};

/** Höchstens so viele Plätze; dieselbe Grenze prüft die Datenbank. */
export const CREW_MAX_SLOTS = 8;
/** Eine Stunde nach Beginn verschwindet ein Aufruf von der Seite. */
export const CREW_SHOW_AFTER_MS = 60 * 60 * 1000;
/** Die Datenbank nimmt einen Beginn höchstens 10 Minuten zurück an. */
export const CREW_PAST_MS = 10 * 60 * 1000;

export interface CrewCall {
  id: number;
  owner_id: string;
  activity: string;
  starts_at: string;
  slots: number;
  note: string | null;
}

export const isActivity = (v: unknown): v is CrewActivity =>
  typeof v === 'string' && (CREW_ACTIVITIES as readonly string[]).includes(v);

export const activityLabel = (v: string, lang: 'de' | 'en') =>
  isActivity(v) ? CREW_LABELS[lang][v] : CREW_LABELS[lang].other;

/**
 * Beginn aus Tag (0 heute, 1 morgen) und Uhrzeit „HH:MM“, in der Ortszeit des
 * Browsers. Liegt „heute 01:00“ schon mehr als 10 Minuten zurück, ist morgen
 * gemeint. null bei ungültiger Uhrzeit.
 */
export function crewStart(day: number, hhmm: string, now: Date = new Date()): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (day === 1 ? 1 : 0), h, min, 0, 0);
  if (day !== 1 && d.getTime() < now.getTime() - CREW_PAST_MS) d.setDate(d.getDate() + 1);
  return d;
}

/** Vorschlag für die Uhrzeit: nächste volle halbe Stunde, mindestens 20 Minuten hin. */
export function crewDefaultTime(now: Date = new Date()): { day: number; hhmm: string } {
  const t = new Date(now.getTime() + 20 * 60 * 1000);
  const add = t.getMinutes() % 30 === 0 && t.getSeconds() === 0 ? 0 : 30 - (t.getMinutes() % 30);
  t.setMinutes(t.getMinutes() + add, 0, 0);
  const sameDay = t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { day: sameDay ? 0 : 1, hhmm: `${pad(t.getHours())}:${pad(t.getMinutes())}` };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** „heute 20:00“, „morgen 18:30“, „Do., 26. Nov., 20:00“, „läuft seit 19:50“. */
export function crewWhen(iso: string, lang: 'de' | 'en', now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const loc = lang === 'de' ? 'de-DE' : 'en-GB';
  const time = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  if (t <= now.getTime()) return lang === 'de' ? `läuft seit ${time}` : `running since ${time}`;
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (days === 0) return lang === 'de' ? `heute ${time}` : `today ${time}`;
  if (days === 1) return lang === 'de' ? `morgen ${time}` : `tomorrow ${time}`;
  const date = d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${date}, ${time}`;
}

/** Aufrufe, die noch auf der Seite stehen, nach Beginn sortiert. */
export function openCrewCalls<T extends CrewCall>(rows: T[], now: Date = new Date()): T[] {
  const cut = now.getTime() - CREW_SHOW_AFTER_MS;
  return rows
    .filter((r) => Number.isFinite(Date.parse(r.starts_at)) && Date.parse(r.starts_at) > cut)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id - b.id);
}
