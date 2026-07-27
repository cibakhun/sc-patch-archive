// Patch-Textauflösung für alle Sprachen.
// DEUTSCH ist die Quelle: src/data/patches/*.json. Jede Übersetzung liegt als
// eigenes Overlay daneben (patches-en.json, patches-hu.json), index-aligned zu
// den Quelldateien. mergePatch() legt das Overlay strukturerhaltend über die
// DE-Daten; strukturelle Felder (version/codename/palette/trailer/kind/
// topicSlug/period/slug/unverified) bleiben aus DE.
import type { CollectionEntry } from 'astro:content';
import patchesEn from '../data/patches-en.json';
import patchesHu from '../data/patches-hu.json';
import { DEFAULT_LOCALE, type Locale } from './ui';

type PatchData = CollectionEntry<'patches'>['data'];

type Overlay = Record<string, any>;
const unwrap = (m: unknown) => (m as { patches: Overlay }).patches;

/**
 * Overlay je Sprache. 'de' fehlt bewusst — Deutsch IST die Quelle, dort gibt es
 * nichts zu überlagern.
 */
const OVERLAY: Partial<Record<Locale, Overlay>> = {
  en: unwrap(patchesEn),
  hu: unwrap(patchesHu),
};

// era-Enum -> Übersetzung (Nav-Dropdown-Kopf, Patch-Seiten). Schlüssel = der
// deutsche Quellwert.
const ERA: Partial<Record<Locale, Record<string, string>>> = {
  en: {
    'Pyro-Ära': 'Pyro Era',
    'Sturm & Stahl': 'Storm & Steel',
    'Onyx & Heilung': 'Onyx & Healing',
    'Neue Horizonte': 'New Horizons',
    'Tactical Strike': 'Tactical Strike',
    Frontier: 'Frontier',
  },
  hu: {
    'Pyro-Ära': 'Pyro-korszak',
    'Sturm & Stahl': 'Vihar és acél',
    'Onyx & Heilung': 'Onyx és gyógyítás',
    'Neue Horizonte': 'Új horizontok',
    'Tactical Strike': 'Tactical Strike',
    Frontier: 'Frontier',
  },
};
/** Rückwärts-kompatibler Export (EN-Karte) für bestehende Aufrufer. */
export const ERA_EN = ERA.en!;
export function eraLabel(era: string, lang: Locale): string {
  return ERA[lang]?.[era] ?? era;
}

/**
 * Codenamen sind strukturell (englische Eigennamen) und liegen deshalb NICHT in
 * den Overlays. Ausnahme: die wenigen beschreibenden Titel von Point-Releases,
 * die auf Deutsch verfasst sind — die brauchen eine Fassung pro Sprache.
 */
const CODENAME: Partial<Record<Locale, Record<string, string>>> = {
  en: { '4-0-1': 'Stability & Save Stanton II' },
  hu: { '4-0-1': 'Stabilitás és Save Stanton II' },
};
export function codenameLabel(id: string, codename: string, lang: Locale): string {
  return CODENAME[lang]?.[id] ?? codename;
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
 * Patch-Daten in der Zielsprache. lang='de' -> unverändert (DE ist die Quelle).
 * Sonst wird der übersetzte Freitext über die DE-Struktur gelegt, mit
 * DE-Fallback pro Feld: fehlt ein Overlay-Eintrag, steht dort weiter Deutsch —
 * sichtbar, aber nie kaputt.
 */
export function mergePatch(id: string, data: PatchData, lang: Locale): PatchData {
  const tr = OVERLAY[lang]?.[id];
  if (!tr) return data;
  return {
    ...data,
    tagline: tr.tagline ?? data.tagline,
    summary: tr.summary ?? data.summary,
    // patches-en.json trägt das Datum historisch als `dateDisplayEn`; neuere
    // Overlays schreiben schlicht `dateDisplay`. Beides wird akzeptiert.
    dateDisplay: tr.dateDisplay ?? tr.dateDisplayEn ?? data.dateDisplay,
    keyFacts: data.keyFacts.map((f, i) => pick(tr.keyFacts, i, f, ['label', 'value'])),
    features: data.features.map((f, i) => {
      const merged = pick(tr.features, i, f, ['name', 'system', 'desc']);
      const ef = tr.features?.[i]?.facts;
      if (ef && f.facts) merged.facts = f.facts.map((x, j) => pick(ef, j, x, ['label', 'value']));
      return merged;
    }),
    ships: data.ships.map((s, i) => pick(tr.ships, i, s, ['role', 'status', 'notes'])),
    events: data.events.map((e, i) => pick(tr.events, i, e, ['name', 'desc'])),
    fixesNote: tr.fixesNote ?? data.fixesNote,
    wipe: tr.wipe ?? data.wipe,
    topics: data.topics.map((tp, i) => pick(tr.topics, i, tp, ['title'])),
  } as PatchData;
}
