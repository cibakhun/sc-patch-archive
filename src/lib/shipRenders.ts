// Ship imagery picking, shared by the browser table and the data sheets.
// Local verified renders from the archive win; otherwise the wiki-API image
// (starcitizen.tools media, attributed on the page). Plain TS module so page
// frontmatter stays thin (see the compiler note in shipFacts.ts).
import type { CollectionEntry } from 'astro:content';

type VehicleData = CollectionEntry<'vehicles'>['data'];

/** verified local renders from the archive, keyed by maker-stripped name */
export const RENDERS: Record<string, string> = {
  polaris: 'img-polaris.jpg',
  railen: 'img-railen.jpg',
  tyilui: 'img-tyilui.jpg',
  syulen: 'img-syulen.jpg',
  guardian: 'img-guardian.jpg',
  meteor: 'img-meteor.jpg',
  ironclad: 'img-ironclad.jpg',
  hammerhead: 'img-hammerhead.jpg',
  perseus: 'img-perseus.jpg',
  hermes: 'img-hermes.jpg',
  'idris-m': 'img-idris.jpg',
  'apollo triage': 'img-apollo.jpg',
  'apollo medivac': 'img-apollo2.jpg',
  'l-21 wolf': 'img-kruger.jpg',
  paladin: 'img-paladin.jpg',
  prowler: 'img-prowler.jpg',
  'aurora mk ii': 'img-aurora.jpg',
  atls: 'img-atls.jpg',
  mole: 'img-mole.jpg',
  'cutlass black': 'img-cutlass.jpg',
  // Basher hat kein Wiki-/FleetYards-Bild -> Standbild aus dem offiziellen
  // "Behind the Ships"-Commercial (reine Schiffsansicht, Frontpose). Gibt der
  // sonst bildlosen Bühne einen Bild-Boden (kein Schwarz mehr).
  basher: 'img-basher.jpg',
};

const MAKERS = ['rsi', 'drake', 'aegis', 'anvil', 'mirai', 'gatac', 'argo', 'misc', 'origin', 'crusader', 'esperia', 'kruger', 'banu', 'aopoa', 'vanduul'];

export function stripName(name: string): string {
  let n = name.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const m of MAKERS) if (n.startsWith(m + ' ')) n = n.slice(m.length + 1);
  return n;
}

export type ShipImage = { src: string; fallback?: string; api: boolean };

/** hero image for the data sheet: local render > API hero (1280px thumb) */
export function pickHero(d: VehicleData): ShipImage | null {
  const local = RENDERS[stripName(d.name)];
  if (local) return { src: `/assets/${local}`, api: false };
  if (d.image?.hero)
    return { src: d.image.hero, fallback: d.image.thumb ?? undefined, api: true };
  return null;
}

/** small thumb for the browser table: API thumb first — the 320px webp is
 *  ~15KB vs. hero-size local renders (2.8MB across 20 ships); local render
 *  only when the API has no image */
export function pickThumb(d: VehicleData): ShipImage | null {
  if (d.image?.thumb) return { src: d.image.thumb, api: true };
  const local = RENDERS[stripName(d.name)];
  if (local) return { src: `/assets/${local}`, api: false };
  return null;
}
