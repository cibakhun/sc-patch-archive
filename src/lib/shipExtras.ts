// Price join (UEX snapshot) + similar-ship picker for the ship data sheets.
// Plain TS module — page frontmatter stays thin (Astro compiler gotcha).
import type { CollectionEntry } from 'astro:content';
import pricesSnapshot from '../data/vehicle-prices.json';
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
