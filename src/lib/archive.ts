// Archive hub data layer — turns the patch collection into everything the
// /archiv page renders. Pure functions, no markup: the DE and EN pages call
// buildArchive() with their locale and get identical structure back.
//
// Before the redesign both archive pages carried 19 hand-written <a class="pcard">
// blocks with dates, codenames, taglines and accents baked into the HTML — the
// same facts the collection already validates, duplicated twice and drifting.
// Everything below is derived from src/data/patches/*.json instead.
import type { CollectionEntry } from 'astro:content';
import { mergePatchEn, eraLabel, codenameLabel } from '../i18n/patchText';
import { type Locale, href } from '../i18n/ui';

type Patch = CollectionEntry<'patches'>;

/**
 * Card art per patch. NOT derivable from the data: `heroImage` is set on only
 * two patches, and the trailer-<id>.jpg convention has no file for the point
 * releases (they borrow their series trailer or a subject photo). One map, one
 * place — the page never hardcodes an image path.
 */
const ART: Record<string, string> = {
  '4-0-0': 'trailer-4-0-0',
  '4-0-1': 'trailer-4-0-0', // 4.0.x series trailer
  '4-0-2': 't-pyro-3',
  '4-1-0': 'trailer-4-1-0',
  '4-1-1': 'trailer-4-1-0', // 4.1.x series trailer
  '4-2-0': 'trailer-4-2-0',
  '4-2-1': 'img-meteor',
  '4-3-0': 'trailer-4-3-0',
  '4-3-1': 'trailer-4-3-1',
  '4-3-2': 'img-paladin',
  '4-4-0': 'trailer-4-4-0',
  '4-5-0': 'trailer-4-5-0',
  '4-6-0': 'trailer-4-6-0',
  '4-7-0': 'trailer-4-7-0',
  '4-8-0': 'trailer-4-8-0',
  '4-8-1': 'trailer-4-8-0', // 4.8.x series trailer
  '4-8-2': 'img-railen',
  '4-8-3': 't-xeno-1',
  '4-9-0': 'trailer-4-9-0',
};

/**
 * Cards use the 480px WebP thumbnails (public/assets/thumb/, built by
 * scripts/build-thumbs.mjs), not the 60–400 KB source JPEGs: the art sits under
 * a ~75% dark gradient at card size, so the full-resolution file would cost
 * ~1.3 MB of page weight for no visible gain.
 */
const artUrl = (id: string) => (ART[id] ? `/assets/thumb/${ART[id]}.webp` : null);

const MONTHS: Record<Locale, string[]> = {
  // Explicit tables rather than Intl.DateTimeFormat — the label is chrome, and
  // this can't shift with the build host's ICU data.
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** "2024-12-19" -> "Dec 2024" / "Dez 2024" */
function monthYear(iso: string, lang: Locale): string {
  const [y, m] = iso.split('-');
  return `${MONTHS[lang][Number(m) - 1]} ${y}`;
}

/** "2024-12-19" -> "19" (day cell of the timeline gutter) */
const dayOf = (iso: string) => String(Number(iso.split('-')[2]));

const DAY_MS = 86_400_000;
const utc = (iso: string) => Date.parse(iso + 'T00:00:00Z');

export interface ArchiveTopic {
  slug: string;
  title: string;
  href: string;
  /** patch version that owns it, e.g. "4.3.1" */
  version: string;
  accent: string;
  /** the feature blurb for this topic, falling back to the patch tagline */
  desc: string;
}

export interface ArchiveEntry {
  id: string;
  version: string;
  /** version with dots stripped, safe for DOM ids: "4.8.2" -> "4-8-2" */
  anchor: string;
  codename: string;
  tagline: string;
  date: string;
  dateDisplay: string;
  dateShort: string;
  day: string;
  era: string;
  type: 'major' | 'point';
  accent: string;
  accent2: string;
  href: string;
  art: string | null;
  topics: ArchiveTopic[];
  isLatest: boolean;
  /** 0..1 position between the first and last release */
  t: number;
  /** lowercased haystack for the client-side filter */
  search: string;
}

export interface ArchiveEra {
  key: string;
  label: string;
  accent: string;
  accent2: string;
  /** "Dec 2024 – Feb 2025" */
  range: string;
  entries: ArchiveEntry[];
  /** span on the hero ribbon, in percent */
  from: number;
  to: number;
}

export interface Archive {
  entries: ArchiveEntry[];
  eras: ArchiveEra[];
  latest: ArchiveEntry;
  keyTopics: ArchiveTopic[];
  topicGroups: { line: string; accent: string; topics: ArchiveTopic[] }[];
  stats: { patches: number; majors: number; topics: number; days: number; eras: number };
  ribbon: { startLabel: string; endLabel: string };
}

/** Curated lead topics — deliberately spread across eras and palettes. */
const CURATED = [
  '4-0-0-server-meshing',
  '4-0-0-contested-zones',
  '4-3-1-medical-overhaul',
  '4-4-0-vanduul',
  '4-5-0-engineering',
  'crafting',
  'mining',
];

export function buildArchive(raw: Patch[], lang: Locale): Archive {
  const patches = raw
    .slice()
    .sort((a, b) => a.data.date.localeCompare(b.data.date))
    .map((p) => ({ id: p.id, data: mergePatchEn(p.id, p.data, lang) }));

  const first = utc(patches[0].data.date);
  const last = utc(patches[patches.length - 1].data.date);
  const span = Math.max(last - first, 1);
  const latestId = patches[patches.length - 1].id;

  const topicIndex = new Map<string, ArchiveTopic>();

  const entries: ArchiveEntry[] = patches.map(({ id, data }) => {
    const accent = data.palette.accent;
    const topics: ArchiveTopic[] = data.topics.map((tp) => {
      const topic: ArchiveTopic = {
        slug: tp.slug,
        title: tp.title,
        href: href(`/topics/${tp.slug}.html`, lang),
        version: data.version,
        accent,
        desc: data.features.find((f) => f.topicSlug === tp.slug)?.desc ?? data.tagline,
      };
      topicIndex.set(tp.slug, topic);
      return topic;
    });

    const codename = codenameLabel(id, data.codename, lang);

    return {
      id,
      version: data.version,
      anchor: data.version.replace(/\./g, '-'),
      codename,
      tagline: data.tagline,
      date: data.date,
      dateDisplay: data.dateDisplay,
      dateShort: monthYear(data.date, lang),
      day: dayOf(data.date),
      era: data.era,
      type: data.type,
      accent,
      accent2: data.palette.accent2 ?? accent,
      href: href(`/patches/sc-${id}.html`, lang),
      art: artUrl(id),
      topics,
      isLatest: id === latestId,
      t: (utc(data.date) - first) / span,
      search: [data.version, codename, data.tagline, eraLabel(data.era, lang), ...topics.map((x) => x.title)]
        .join(' ')
        .toLowerCase(),
    };
  });

  // Eras keep the collection's order (patches are date-sorted, eras don't interleave).
  const eras: ArchiveEra[] = [];
  for (const e of entries) {
    let era = eras.find((x) => x.key === e.era);
    if (!era) {
      era = {
        key: e.era,
        label: eraLabel(e.era, lang),
        accent: e.accent,
        accent2: e.accent2,
        range: '',
        entries: [],
        from: e.t * 100,
        to: e.t * 100,
      };
      eras.push(era);
    }
    era.entries.push(e);
    era.to = e.t * 100;
  }
  for (const era of eras) {
    // The era's identity colour is its major release — point releases carry
    // one-off accents (a green convoy event, a teal alien week) that would
    // misrepresent the chapter.
    const lead = era.entries.find((e) => e.type === 'major') ?? era.entries[0];
    era.accent = lead.accent;
    era.accent2 = lead.accent2;
    const a = era.entries[0];
    const b = era.entries[era.entries.length - 1];
    era.range = a === b ? a.dateShort : `${a.dateShort} – ${b.dateShort}`;
  }
  // Ribbon bands tile the full width: each era runs to the start of the next.
  eras.forEach((era, i) => {
    era.from = i === 0 ? 0 : eras[i - 1].to;
    era.to = i === eras.length - 1 ? 100 : (eras[i + 1].entries[0].t * 100 + era.to) / 2;
  });

  const allTopics = [...topicIndex.values()];
  const line = (v: string) => v.split('.').slice(0, 2).join('.');
  const topicGroups: Archive['topicGroups'] = [];
  for (const t of allTopics) {
    const key = line(t.version);
    let g = topicGroups.find((x) => x.line === key);
    if (!g) topicGroups.push((g = { line: key, accent: t.accent, topics: [] }));
    g.topics.push(t);
  }

  return {
    entries,
    eras,
    latest: entries[entries.length - 1],
    keyTopics: CURATED.map((s) => topicIndex.get(s)).filter((t): t is ArchiveTopic => !!t),
    topicGroups,
    stats: {
      patches: entries.length,
      majors: entries.filter((e) => e.type === 'major').length,
      topics: allTopics.length,
      days: Math.round(span / DAY_MS),
      eras: eras.length,
    },
    ribbon: {
      startLabel: monthYear(patches[0].data.date, lang),
      endLabel: monthYear(patches[patches.length - 1].data.date, lang),
    },
  };
}
