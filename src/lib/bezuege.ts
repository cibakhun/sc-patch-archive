// Betroffene Schiffe und Items einer Themen- oder Patchseite (UX-Audit H7).
//
// Anlass: keine der Themenseiten verlinkte die Schiffe und Items, um die es
// in ihr geht; wer von „Hunt The Polaris“ zur Polaris wollte, musste suchen.
// Patchseiten verlinkten sie nur tief im Dossier.
//
// Themenseiten: von Hand gepflegt, nur was die Seite selbst nennt (Belohnung,
// Headliner, Gegner, Pflichtausruestung). Patchseiten: aus den Daten (Schiffe
// des Patches mit eigener Seite, Feature-Links auf Schiffe und Items), dazu
// wenige gepflegte Ergaenzungen. Jede Kennung wird beim Laden gegen den
// Bestand geprueft; fehlt eine Seite, bricht der Bau mit ihrem Namen ab.

import vehiclesSnapshot from '../data/vehicles.json';
import { pageItems } from './items';
import { stripSpine } from '../../scripts/lib/patch-spine.mjs';

export type Bezug = { art: 'schiff' | 'item'; id: string; name: string };

const s = (id: string, name: string): Bezug => ({ art: 'schiff', id, name });
const i = (id: string, name: string): Bezug => ({ art: 'item', id, name });

/** Schluessel: Themen-Slug wie in src/pages/topics/<slug>.astro. */
const THEMEN: Record<string, Bezug[]> = {
  '4-0-1-fight-for-pyro': [i('ripper-smg', 'Ripper SMG')],
  '4-0-2-supply-or-die': [s('misc-fortune', 'MISC Fortune'), s('drak-vulture', 'Drake Vulture'), s('misc-prospector', 'MISC Prospector')],
  '4-1-1-hunt-the-polaris': [s('rsi-polaris', 'RSI Polaris')],
  '4-2-0-storm-breaker': [i('deconpen-xtra', 'CureLife DeconPen Xtra')],
  '4-2-1-resource-drive': [s('rsi-meteor', 'RSI Meteor')],
  '4-3-1-medical-overhaul': [
    s('rsi-apollo-medivac', 'RSI Apollo Medivac'),
    s('rsi-apollo-triage', 'RSI Apollo Triage'),
    s('drak-cutlass-red', 'Drake Cutlass Red'),
    i('pancea-medgel-canister', 'MedGel Canister'),
  ],
  '4-3-2-frontier-fighters': [s('rsi-polaris', 'RSI Polaris'), s('anvl-paladin', 'Anvil Paladin')],
  '4-4-0-vanduul': [s('vncl-stinger', 'Vanduul Stinger'), s('vncl-glaive', 'Vanduul Glaive'), s('vncl-scythe', 'Vanduul Scythe'), s('vncl-blade', 'Vanduul Blade')],
  '4-8-2-alien-week': [
    s('gama-railen', 'Gatac Railen'),
    s('gama-syulen', 'Gatac Syulen'),
    s('gama-tyilui', 'Gatac Tyilui'),
    s('espr-talon', 'Esperia Talon'),
    s('xian-scout', 'Aopoa Khartu-al'),
    s('xian-nox', 'Aopoa Nox'),
  ],
  '4-8-3-xenothreat': [s('aegs-hammerhead', 'Aegis Hammerhead')],
};

/** Ergaenzungen je Patch-Version, die die Daten nicht verlinken. */
const PATCH_EXTRA: Record<string, Bezug[]> = {
  '4.0.1': [i('ripper-smg', 'Ripper SMG')],
  '4.2.0': [i('deconpen-xtra', 'CureLife DeconPen Xtra')],
  '4.3.1': [i('pancea-medgel-canister', 'MedGel Canister')],
};

const VEHICLES = (vehiclesSnapshot as { vehicles: { id: string; name: string }[] }).vehicles;
const SCHIFFE = new Set(VEHICLES.map((v) => v.id));
const ITEMS = new Set(pageItems.map((x) => x.id));
const daIst = (b: Bezug) => (b.art === 'schiff' ? SCHIFFE.has(b.id) : ITEMS.has(b.id));

const fehlend = [...Object.values(THEMEN), ...Object.values(PATCH_EXTRA)].flat().filter((b) => !daIst(b));
if (fehlend.length > 0) {
  throw new Error(`Bezuege ohne Seite (src/lib/bezuege.ts): ${fehlend.map((b) => `${b.name} -> ${b.art} ${b.id}`).join(', ')}`);
}

export const bezugPfad = (b: Bezug): string => (b.art === 'schiff' ? `/schiffe/${b.id}.html` : `/items/${b.id}.html`);

export const themaBezuege = (slug: string): Bezug[] => THEMEN[slug] ?? [];

const schiffNachName = new Map(VEHICLES.map((v) => [stripSpine(v.name), v]));

type PatchDaten = {
  version: string;
  ships: { name: string }[];
  features: { links?: { label: string; href: string }[] }[];
};

/** Schiffe des Patches mit eigener Seite, Feature-Links auf Schiffe und Items, Ergaenzungen; ohne Doppel. */
export function patchBezuege(p: PatchDaten): Bezug[] {
  const out: Bezug[] = [];
  const seen = new Set<string>();
  const add = (b: Bezug) => {
    const k = bezugPfad(b);
    if (seen.has(k) || !daIst(b)) return;
    seen.add(k);
    out.push(b);
  };
  for (const sh of p.ships) {
    const v = schiffNachName.get(stripSpine(sh.name));
    if (v) add(s(v.id, sh.name));
  }
  for (const f of p.features)
    for (const l of f.links ?? []) {
      const m = /^\/(schiffe|items)\/([^/#?]+)\.html$/.exec(l.href);
      if (m) add({ art: m[1] === 'schiffe' ? 'schiff' : 'item', id: m[2], name: l.label });
    }
  for (const b of PATCH_EXTRA[p.version] ?? []) add(b);
  return out;
}
