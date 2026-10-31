// Was Discord (und andere Chats) zeigen, wenn jemand /pilot/<handle> teilt.
// nginx setzt diese Werte vor der Auslieferung in die Kopfzeilen der Seite
// (nginx/pilot.js, withPilot); die Einladungskarte im Freunde-Bereich zeigt
// mit genau dieser Regel vorab, wie die Karte aussehen wird. Beide stehen
// getrennt (njs kann kein TypeScript laden), tests/e2e/pilot-og.test.js
// spielt sie gegeneinander und hält sie gleich.

export type PreviewProfile = {
  handle: string | null;
  display_name?: string | null;
  bio?: string | null;
  banner_url?: string | null;
  avatar_url?: string | null;
  avatar_color?: string | null;
  org_name?: string | null;
};

export type PilotPreview = {
  url: string;
  title: string;
  desc: string;
  /** leer = das Standardbild der Seite */
  image: string;
  /** Titelbild als Breitbild; das Profilbild nur als Daumen daneben */
  large: boolean;
  /** Randfarbe der Discord-Karte; leer = Seitenfarbe */
  color: string;
};

export const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

const TEXT = {
  de: { tail: ' | VerseBase', fallback: 'Pilotenprofil auf VerseBase: Status, Rolle, Flotte und Favoriten.' },
  en: { tail: ' | VerseBase', fallback: 'Pilot profile on VerseBase: status, role, fleet and favourites.' },
};

/** Eine Zeile, höchstens n Zeichen, am Wortende gekürzt. */
export const clip = (s: string | null | undefined, n: number): string => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut) + '…';
};

/** Pfad auf dieser Seite -> absolut, sonst nur https. */
export const imageUrl = (origin: string, u: string | null | undefined): string => {
  const v = String(u || '').trim();
  if (/^\/[A-Za-z0-9._~/-]+$/.test(v) && v.indexOf('//') === -1) return origin + v;
  if (/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/[^\s"'<>]*$/.test(v)) return v;
  return '';
};

export const pilotPreview = (p: PreviewProfile, lang: 'de' | 'en', origin: string): PilotPreview | null => {
  const T = TEXT[lang];
  const handle = String(p.handle || '').toLowerCase();
  if (!HANDLE_RE.test(handle)) return null;
  const name = clip(p.display_name, 60) || handle;
  const org = clip(p.org_name, 60);
  const banner = imageUrl(origin, p.banner_url);
  const avatar = imageUrl(origin, p.avatar_url);
  const col = String(p.avatar_color || '');
  return {
    url: origin + (lang === 'de' ? '/de' : '') + '/pilot/' + handle,
    title: name + ' (@' + handle + ')' + T.tail,
    desc: clip((org ? org + ' · ' : '') + (clip(p.bio, 240) || T.fallback), 280),
    image: banner || avatar,
    large: !!banner,
    color: /^#[0-9a-fA-F]{6}$/.test(col) ? col : '',
  };
};
