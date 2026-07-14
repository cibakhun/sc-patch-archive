// Price join (UEX snapshot), FleetYards extras (3D holo, paints, variants,
// loaners), performance profile + similar-ship picker for the data sheets.
// Plain TS module — page frontmatter stays thin (Astro compiler gotcha).
import type { CollectionEntry } from 'astro:content';
import pricesSnapshot from '../data/vehicle-prices.json';
import extrasSnapshot from '../data/ship-extras.json';
import videosSnapshot from '../data/ship-videos.json';
import { pickThumb, pickHero } from './shipRenders';
import { useTranslations, type Locale, type UIKey, DEFAULT_LOCALE } from '../i18n/ui';
import { vType } from '../i18n/vehicleText';

type VehicleData = CollectionEntry<'vehicles'>['data'];
const numLoc = (lang: Locale) => (lang === 'en' ? 'en-US' : 'de-DE');

export type PricePlace = { price: number; shop: string; where: string; system: string };
export type ShipPrices = { buy: PricePlace[]; rent: PricePlace[] } | null;

export const pricesFetchedAt: string = (pricesSnapshot as { fetchedAt: string }).fetchedAt;

export function aUEC(n: number, lang: Locale = DEFAULT_LOCALE): string {
  return `${n.toLocaleString(numLoc(lang))} aUEC`;
}

export function priceInfo(id: string): ShipPrices {
  const p = (pricesSnapshot as { prices: Record<string, { buy: PricePlace[]; rent: PricePlace[] }> }).prices[id];
  if (!p || (p.buy.length === 0 && p.rent.length === 0)) return null;
  return p;
}

/* ---------- FleetYards extras: 3D holo, paints, variants, loaners ---------- */
export type ShipRef = { name: string; id: string | null };
export type ShipExtras = {
  fySlug: string;
  holo: string | null;
  storeImage: string | null;
  paints: { name: string; image: string | null }[];
  variants: ShipRef[];
  loaners: ShipRef[];
} | null;

export const extrasFetchedAt: string = (extrasSnapshot as { fetchedAt: string }).fetchedAt;

export function extrasInfo(id: string): ShipExtras {
  const e = (extrasSnapshot as { extras: Record<string, NonNullable<ShipExtras>> }).extras[id];
  return e ?? null;
}

/* ---------- Kopf-Medien: Video (kuratiert) + Bild-Galerie ---------- */

/** kuratierte offizielle RSI-Ship-Commercials (YouTube). null = kein Video. */
export function shipVideo(id: string): string | null {
  const v = (videosSnapshot as { videos: Record<string, string> }).videos[id];
  return v && v.trim() ? v.trim() : null;
}

/** Geordnete, deduplizierte Bildliste pro Schiff für die Kopf-Slideshow:
 *  Hero-Render zuerst, dann FleetYards-Store-Bild, dann die Paint-Varianten.
 *  Auf 12 Bilder gedeckelt (DOM/Traffic). */
export function shipGallery(id: string, d: VehicleData): string[] {
  const urls: string[] = [];
  const push = (u?: string | null) => {
    if (u && !urls.includes(u)) urls.push(u);
  };
  const hero = pickHero(d);
  if (hero) push(hero.src);
  const e = extrasInfo(id);
  if (e) {
    push(e.storeImage);
    for (const p of e.paints) push(p.image);
  }
  return urls.slice(0, 12);
}

/* ---------- Leistungsprofil: Perzentile im Gesamtkatalog ---------- */
export type ProfileBar = { label: string; value: string; pct: number };

type MetricDef = {
  labelKey: UIKey;
  get: (d: VehicleData) => number | null;
  fmt: (n: number, loc: string) => string;
};
const nf = (n: number, loc: string) => n.toLocaleString(loc, { maximumFractionDigits: 0 });
const METRICS: MetricDef[] = [
  { labelKey: 'metric.speed', get: (d) => d.scmSpeed ?? null, fmt: (n, loc) => `${nf(n, loc)} m/s SCM` },
  {
    labelKey: 'metric.agility',
    get: (d) => (d.pitch != null && d.yaw != null && d.roll != null ? (d.pitch + d.yaw + d.roll) / 3 : null),
    fmt: (n) => `${n.toFixed(1)} °/s Ø`,
  },
  {
    labelKey: 'metric.firepower',
    get: (d) => {
      const s = (d.pilotDps ?? 0) + (d.turretDps ?? 0);
      return s > 0 ? s : null;
    },
    fmt: (n, loc) => `${nf(n, loc)} DPS`,
  },
  {
    labelKey: 'metric.defense',
    get: (d) => {
      const s = (d.hullHp ?? 0) + (d.shieldHp ?? 0);
      return s > 0 ? s : null;
    },
    fmt: (n, loc) => `${nf(n, loc)} HP`,
  },
  { labelKey: 'metric.cargo', get: (d) => (d.cargoSCU != null && d.cargoSCU > 0 ? d.cargoSCU : null), fmt: (n, loc) => `${nf(n, loc)} SCU` },
  { labelKey: 'metric.qspeed', get: (d) => d.qtSpeedMs ?? null, fmt: (n, loc) => `${nf(n / 1000, loc)} km/s` },
];

let sortedCache: number[][] | null = null;
function sortedValues(all: { data: VehicleData }[]): number[][] {
  if (!sortedCache) {
    sortedCache = METRICS.map((m) =>
      all.map((v) => m.get(v.data)).filter((x): x is number => x != null).sort((a, b) => a - b)
    );
  }
  return sortedCache;
}

/** percentile rank (0-100) of x within sorted asc array */
function pctRank(sorted: number[], x: number): number {
  if (sorted.length === 0) return 0;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((lo / sorted.length) * 100);
}

export function buildProfile(all: { data: VehicleData }[], d: VehicleData, lang: Locale = DEFAULT_LOCALE): ProfileBar[] {
  const t = useTranslations(lang);
  const loc = numLoc(lang);
  const sorted = sortedValues(all);
  const bars: ProfileBar[] = [];
  METRICS.forEach((m, i) => {
    const x = m.get(d);
    if (x == null) return;
    bars.push({ label: t(m.labelKey), value: m.fmt(x, loc), pct: Math.max(3, pctRank(sorted[i], x)) });
  });
  return bars;
}

export type SimilarShip = {
  id: string;
  name: string;
  meta: string;
  thumb: string | null;
};

/** rank the catalog against one ship: same type first, closest length wins */
export function similarShips(
  all: { id: string; data: VehicleData }[],
  self: { id: string; data: VehicleData },
  lang: Locale = DEFAULT_LOCALE,
  n = 4
): SimilarShip[] {
  const loc = numLoc(lang);
  const L = self.data.lengthM ?? 0;
  const scored = all
    .filter((v) => v.id !== self.id)
    .map((v) => {
      const d = v.data;
      let score = 0;
      // Scoring bleibt sprachunabhängig (Vergleich der Rohwerte)
      if (d.typeDe !== self.data.typeDe) score += 2.2;
      if (d.sizeDe !== self.data.sizeDe) score += 0.9;
      if (L > 0 && d.lengthM) score += Math.abs(Math.log(d.lengthM / L));
      else score += 1;
      return { v, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, n);
  return scored.map(({ v }) => ({
    id: v.id,
    name: v.data.name,
    meta: [vType(v.data, lang), v.data.lengthM ? `${v.data.lengthM.toLocaleString(loc)} m` : null]
      .filter(Boolean)
      .join(' · '),
    thumb: pickThumb(v.data)?.src ?? null,
  }));
}
