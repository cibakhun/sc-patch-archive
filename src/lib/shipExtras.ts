// Price join (UEX snapshot), FleetYards extras (3D holo, paints, variants,
// loaners), performance profile + similar-ship picker for the data sheets.
// Plain TS module — page frontmatter stays thin (Astro compiler gotcha).
import type { CollectionEntry } from 'astro:content';
import pricesSnapshot from '../data/vehicle-prices.json';
import extrasSnapshot from '../data/ship-extras.json';
import { pickThumb } from './shipRenders';

type VehicleData = CollectionEntry<'vehicles'>['data'];

export type PricePlace = { price: number; shop: string; where: string; system: string };
export type ShipPrices = { buy: PricePlace[]; rent: PricePlace[] } | null;

export const pricesFetchedAt: string = (pricesSnapshot as { fetchedAt: string }).fetchedAt;

export function aUEC(n: number): string {
  return `${n.toLocaleString('de-DE')} aUEC`;
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

/* ---------- Leistungsprofil: Perzentile im Gesamtkatalog ---------- */
export type ProfileBar = { label: string; value: string; pct: number };

type MetricDef = {
  label: string;
  get: (d: VehicleData) => number | null;
  fmt: (n: number) => string;
};
const nf = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
const METRICS: MetricDef[] = [
  { label: 'Geschwindigkeit', get: (d) => d.scmSpeed ?? null, fmt: (n) => `${nf(n)} m/s SCM` },
  {
    label: 'Agilität',
    get: (d) => (d.pitch != null && d.yaw != null && d.roll != null ? (d.pitch + d.yaw + d.roll) / 3 : null),
    fmt: (n) => `${n.toFixed(1)} °/s Ø`,
  },
  {
    label: 'Feuerkraft',
    get: (d) => {
      const s = (d.pilotDps ?? 0) + (d.turretDps ?? 0);
      return s > 0 ? s : null;
    },
    fmt: (n) => `${nf(n)} DPS`,
  },
  {
    label: 'Verteidigung',
    get: (d) => {
      const s = (d.hullHp ?? 0) + (d.shieldHp ?? 0);
      return s > 0 ? s : null;
    },
    fmt: (n) => `${nf(n)} HP`,
  },
  { label: 'Fracht', get: (d) => (d.cargoSCU != null && d.cargoSCU > 0 ? d.cargoSCU : null), fmt: (n) => `${nf(n)} SCU` },
  { label: 'Quantum-Tempo', get: (d) => d.qtSpeedMs ?? null, fmt: (n) => `${nf(n / 1000)} km/s` },
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

export function buildProfile(all: { data: VehicleData }[], d: VehicleData): ProfileBar[] {
  const sorted = sortedValues(all);
  const bars: ProfileBar[] = [];
  METRICS.forEach((m, i) => {
    const x = m.get(d);
    if (x == null) return;
    bars.push({ label: m.label, value: m.fmt(x), pct: Math.max(3, pctRank(sorted[i], x)) });
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
  n = 4
): SimilarShip[] {
  const L = self.data.lengthM ?? 0;
  const scored = all
    .filter((v) => v.id !== self.id)
    .map((v) => {
      const d = v.data;
      let score = 0;
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
    meta: [v.data.typeDe, v.data.lengthM ? `${v.data.lengthM.toLocaleString('de-DE')} m` : null]
      .filter(Boolean)
      .join(' · '),
    thumb: pickThumb(v.data)?.src ?? null,
  }));
}
