// Links im Chat (Konto, Freundesleiste): Verweise auf eigene Seiten werden
// zu Links und Karten mit Bild und Namen. Erkannt werden nur Pfade dieser
// Seite, als volle Adresse (verse-base.com, www., staging.) oder als Pfad:
// Schiffsblatt, Itemblatt und, wenn es den Hangar gibt, ein Loadout-Link
// (Hangar oder Advanced Loadout mit ?ship= und &layout=). Fremde Adressen
// bleiben Text: aus einer Nachricht wird nie ein Link nach draußen.

export type ChatLinkKind = 'ship' | 'item' | 'loadout';

export interface ChatLink {
  /** Stelle im Text: [start, end) umfasst genau die Adresse. */
  start: number;
  end: number;
  kind: ChatLinkKind;
  /** Schiffs- oder Item-Kennung, beim Loadout das Schiff. */
  slug: string;
  /** Loadout: Seite (hangar oder hangar-loadout) und Code. */
  page?: 'hangar' | 'hangar-loadout';
  layout?: string;
}

const HOST = String.raw`(?:https?:\/\/(?:www\.|staging\.)?verse-base\.com)?`;
const SLUG = String.raw`[a-z0-9][a-z0-9-]{0,80}`;
// Vor der Adresse: Anfang oder Leerraum, wahlweise mit öffnender Klammer;
// danach: Ende, Leerraum, Klammer oder ein Satzzeichen, dem Ende oder
// Leerraum folgt. So wird „/schiffe/x.html“ mitten in einem fremden Link
// (https://example.com/schiffe/x.html, auch …/(/schiffe/x.html)) nicht
// erkannt, und „x.html?y=…“ bleibt Text statt halber Link.
const RE = new RegExp(
  String.raw`(^\(?|\s\(?)(${HOST}\/(?:de\/)?(?:(schiffe|items)\/(${SLUG})\.html|(hangar|hangar-loadout)\.html\?ship=(${SLUG})(?:&layout=([A-Za-z0-9_-]{1,4000}))?))(?=$|[\s)]|[.,!?;:](?:$|[\s)]))`,
  'g',
);

/** Alle eigenen Links im Text, in Reihenfolge. Loadouts nur mit Hangar. */
export function findChatLinks(text: string, hangarOn: boolean): ChatLink[] {
  const out: ChatLink[] = [];
  if (typeof text !== 'string' || !text) return out;
  RE.lastIndex = 0;
  for (let m = RE.exec(text); m; m = RE.exec(text)) {
    const start = m.index + m[1].length;
    const end = start + m[2].length;
    if (m[3]) {
      out.push({ start, end, kind: m[3] === 'schiffe' ? 'ship' : 'item', slug: m[4] });
    } else if (hangarOn) {
      out.push({ start, end, kind: 'loadout', slug: m[6], page: m[5] as 'hangar' | 'hangar-loadout', ...(m[7] ? { layout: m[7] } : {}) });
    }
  }
  return out;
}

/** Ziel in der Sprache des Lesers, immer als Pfad dieser Seite. */
export function chatLinkPath(l: ChatLink, lang: 'de' | 'en'): string {
  const pre = lang === 'de' ? '/de' : '';
  if (l.kind === 'ship') return `${pre}/schiffe/${l.slug}.html`;
  if (l.kind === 'item') return `${pre}/items/${l.slug}.html`;
  return `${pre}/${l.page || 'hangar'}.html?ship=${l.slug}${l.layout ? '&layout=' + l.layout : ''}`;
}

/** Text in Stücke: Klartext und erkannte Links, ohne Lücke und ohne Überlapp. */
export function splitChatText(text: string, links: ChatLink[]): Array<string | ChatLink> {
  const parts: Array<string | ChatLink> = [];
  let at = 0;
  for (const l of links) {
    if (l.start < at) continue;
    if (l.start > at) parts.push(text.slice(at, l.start));
    parts.push(l);
    at = l.end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}
