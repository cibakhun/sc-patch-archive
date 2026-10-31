// Socials im Profil (Kontoseite Runde 5): Twitch, YouTube, X.
// Gespeichert wird nur der NAME (profiles.social_*; die Datenbank prüft
// dasselbe Muster per check), nie eine Adresse -- den Link baut die Seite,
// damit hinter einem Symbol nie ein fremdes Ziel steckt.
export type SocialKey = 'social_twitch' | 'social_youtube' | 'social_x';

type Social = { key: SocialKey; label: string; url: string; re: RegExp; host: RegExp; path: string; color: string };

export const SOCIALS: Social[] = [
  {
    key: 'social_twitch', label: 'Twitch', url: 'https://www.twitch.tv/', re: /^[A-Za-z0-9_]{3,25}$/,
    host: /^(?:https?:\/\/)?(?:www\.|m\.)?twitch\.tv\/([^/?#]+)/i, color: '#a970ff',
    path: 'M4.3 3 3 6.4v13.1h4.5V22h2.5l2.4-2.5h3.6L21 14.6V3H4.3Zm14.9 10.7-2.8 2.8h-4.5l-2.4 2.4v-2.4H5.7V4.8h13.5v8.9ZM16.4 7.6h-1.8v5.1h1.8V7.6Zm-4.9 0H9.7v5.1h1.8V7.6Z',
  },
  {
    key: 'social_youtube', label: 'YouTube', url: 'https://www.youtube.com/@', re: /^[A-Za-z0-9_.-]{3,30}$/,
    host: /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/@([^/?#]+)/i, color: '#ff4e45',
    path: 'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z',
  },
  {
    key: 'social_x', label: 'X', url: 'https://x.com/', re: /^[A-Za-z0-9_]{1,15}$/,
    host: /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([^/?#]+)/i, color: '#e7e9ea',
    path: 'M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.8 2.3h7l4.8 6.4 5.6-6.4Zm-1.2 17.9h1.9L7 4.2H5l12 16Z',
  },
];

/**
 * Eingabe -> gespeicherter Name. Eine eingefügte Adresse wird auf den Namen
 * gekürzt, ein führendes @ fällt weg. '' = leer, null = passt nicht.
 */
export function normalizeSocial(key: SocialKey, raw: string): string | null {
  const s = SOCIALS.find((x) => x.key === key)!;
  let v = (raw || '').trim();
  if (!v) return '';
  const m = s.host.exec(v);
  if (m) {
    try { v = decodeURIComponent(m[1]); } catch { return null; }
  }
  v = v.replace(/^@/, '');
  return s.re.test(v) ? v : null;
}

/** Symbol-Links für ein Profil in `box` legen; versteckt `box`, wenn keiner da ist. */
export function renderSocialLinks(box: HTMLElement, p: Record<string, unknown>): void {
  box.textContent = '';
  for (const s of SOCIALS) {
    const v = String(p[s.key] || '');
    if (!v || !s.re.test(v)) continue;
    const a = document.createElement('a');
    a.className = 'soc-link';
    a.href = s.url + encodeURIComponent(v);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = `${s.label}: ${v}`;
    a.setAttribute('aria-label', a.title);
    a.style.setProperty('--soc', s.color);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', s.path);
    svg.appendChild(path);
    a.appendChild(svg);
    box.appendChild(a);
  }
  box.hidden = !box.childElementCount;
}
