// Ziele der Schlagwort-Chips im Kopf der Themen- und Patchseiten (UX-Audit H5).
//
// Die Chips sahen aus wie Knoepfe und waren keine, obwohl es etwa zu „Hunt
// The Polaris“ eine Themenseite gibt. Wo ein Ziel feststeht, wird der Chip
// ein Link (src/components/dossier/Schlagwort.astro); alle anderen stehen
// flach da. Die Liste ist von Hand gepflegt, weil ein Schlagwort nur dann
// verlinkt werden soll, wenn das Ziel eindeutig ist: „Idris“ oder „Apollo“
// meinen zwei Schiffe und bleiben deshalb flach.
//
// Gegen den Dateibestand geprueft, beim Laden dieses Moduls: fehlt eine
// Themenseite, ein Schiffsblatt oder ein Item-Blatt, bricht der Bau mit dem
// Namen des Schlagworts ab, statt einen toten Link auszuliefern.

import vehiclesSnapshot from '../data/vehicles.json';
import { pageItems } from './items';

type Ziel = { thema: string } | { schiff: string } | { item: string };

/** Schluessel: der sichtbare Text des Chips, in beiden Sprachen gleich. */
const ZIELE: Record<string, Ziel> = {
  'Contested Zones': { thema: '4-0-0-contested-zones' },
  'Pyro': { thema: '4-0-0-pyro-system' },
  'Server Meshing': { thema: '4-0-0-server-meshing' },
  'Supply or Die': { thema: '4-0-2-supply-or-die' },
  'Align & Mine': { thema: '4-1-0-align-and-mine' },
  'Hunt The Polaris': { thema: '4-1-1-hunt-the-polaris' },
  'Storm Breaker': { thema: '4-2-0-storm-breaker' },
  'Resource Drive': { thema: '4-2-1-resource-drive' },
  'Onyx': { thema: '4-3-0-onyx-facilities' },
  'Medical': { thema: '4-3-1-medical-overhaul' },
  'Frontier Fighters': { thema: '4-3-2-frontier-fighters' },
  'Nyx': { thema: '4-4-0-nyx-system' },
  'Vanduul': { thema: '4-4-0-vanduul' },
  'Engineering': { thema: '4-5-0-engineering' },
  'Crafting': { thema: 'crafting' },
  'Mining': { thema: 'mining' },
  'Strike Groups': { thema: '4-8-0-tactical-strike-groups' },
  'Defend Location': { thema: '4-8-1-defend-location' },
  'Alien Week': { thema: '4-8-2-alien-week' },
  'XenoThreat': { thema: '4-8-3-xenothreat' },
  'RSI Polaris': { schiff: 'rsi-polaris' },
  'RSI Meteor': { schiff: 'rsi-meteor' },
  'RSI Hermes': { schiff: 'rsi-hermes' },
  'Anvil Paladin': { schiff: 'anvl-paladin' },
  'Aurora Mk II': { schiff: 'rsi-aurora-mk2' },
  'Drake Ironclad': { schiff: 'drak-ironclad' },
  'Sabre Raven EX': { schiff: 'aegs-sabre-raven-ex' },
  'Mk V Centaurus': { schiff: 'rsi-constellation-mk5-centaurus' },
  'Skylark': { schiff: 'rsi-skylark' },
  'ATLS IKTI': { schiff: 'argo-atls-ikti' },
  "Grey's Market Basher": { schiff: 'glsn-basher' },
  'Ripper SMG': { item: 'ripper-smg' },
};

const THEMEN = new Set(
  Object.keys(import.meta.glob('../pages/topics/*.astro')).map((k) => k.replace(/^.*\/|\.astro$/g, '')),
);
const SCHIFFE = new Set((vehiclesSnapshot as { vehicles: { id: string }[] }).vehicles.map((v) => v.id));
const ITEMS = new Set(pageItems.map((i) => i.id));

const pfad = (z: Ziel): string =>
  'thema' in z ? `/topics/${z.thema}.html` : 'schiff' in z ? `/schiffe/${z.schiff}.html` : `/items/${z.item}.html`;

const fehlend = Object.entries(ZIELE).filter(([, z]) =>
  'thema' in z ? !THEMEN.has(z.thema) : 'schiff' in z ? !SCHIFFE.has(z.schiff) : !ITEMS.has(z.item),
);
if (fehlend.length > 0) {
  throw new Error(
    `Schlagwort-Ziele ohne Seite (src/lib/schlagworte.ts): ${fehlend.map(([k, z]) => `${k} -> ${pfad(z)}`).join(', ')}`,
  );
}

/** Pfad ohne Sprachpraefix, oder null, wenn das Schlagwort kein Ziel hat. */
export function schlagwortZiel(text: string): string | null {
  const z = ZIELE[text.replace(/\s+/g, ' ').trim()];
  return z ? pfad(z) : null;
}
