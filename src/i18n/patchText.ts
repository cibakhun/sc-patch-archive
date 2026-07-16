// Patch text resolution DE/EN (Stufe 3).
// Der übersetzte Patch-Content liegt in src/data/patches-en.json (index-aligned
// zu src/data/patches/*.json). mergePatchEn() legt ihn strukturerhaltend über
// die DE-Daten; strukturelle Felder (version/codename/palette/trailer/kind/
// topicSlug/period/slug/unverified) bleiben aus DE.
import type { CollectionEntry } from 'astro:content';
import patchesEn from '../data/patches-en.json';
import type { Locale } from './ui';

type PatchData = CollectionEntry<'patches'>['data'];

const EN = (patchesEn as { patches: Record<string, any> }).patches;

// era-Enum -> EN (Nav-Dropdown-Kopf, Patch-Seiten)
export const ERA_EN: Record<string, string> = {
  'Pyro-Ära': 'Pyro Era',
  'Sturm & Stahl': 'Storm & Steel',
  'Onyx & Heilung': 'Onyx & Healing',
  'Neue Horizonte': 'New Horizons',
  'Tactical Strike': 'Tactical Strike',
  Frontier: 'Frontier',
};
export function eraLabel(era: string, lang: Locale): string {
  return lang === 'en' ? ERA_EN[era] ?? era : era;
}

/** at(index) mit Fallback auf das DE-Objekt, falls EN fehlt/kürzer */
function pick<T>(enArr: any[] | undefined, i: number, de: T, keys: (keyof T)[]): T {
  const e = enArr?.[i];
  if (!e) return de;
  const out: any = { ...de };
  for (const k of keys) if (e[k as string] != null) out[k] = e[k as string];
  return out;
}

/**
 * Patch-Daten in der Zielsprache. lang='de' -> unverändert. lang='en' ->
 * EN-Freitext über die DE-Struktur gelegt (mit DE-Fallback pro Feld).
 */
export function mergePatchEn(id: string, data: PatchData, lang: Locale): PatchData {
  if (lang !== 'en') return data;
  const en = EN[id];
  if (!en) return data;
  return {
    ...data,
    tagline: en.tagline ?? data.tagline,
    summary: en.summary ?? data.summary,
    dateDisplay: en.dateDisplayEn ?? data.dateDisplay,
    keyFacts: data.keyFacts.map((f, i) => pick(en.keyFacts, i, f, ['label', 'value'])),
    features: data.features.map((f, i) => {
      const merged = pick(en.features, i, f, ['name', 'system', 'desc']);
      const ef = en.features?.[i]?.facts;
      if (ef && f.facts) merged.facts = f.facts.map((x, j) => pick(ef, j, x, ['label', 'value']));
      return merged;
    }),
    ships: data.ships.map((s, i) => pick(en.ships, i, s, ['role', 'status', 'notes'])),
    events: data.events.map((e, i) => pick(en.events, i, e, ['name', 'desc'])),
    fixesNote: en.fixesNote ?? data.fixesNote,
    wipe: en.wipe ?? data.wipe,
    topics: data.topics.map((tp, i) => pick(en.topics, i, tp, ['title'])),
  } as PatchData;
}
