// Die Schiffssuche des Docks (Krisz 29.10.2026: „man kann ohne manufacturer
// name oder schiff name kaum nach etwas suchen“). Ein Modul beantwortet, wonach
// man ein Schiff finden kann, ohne seinen Namen zu kennen:
//
//   PURPOSES  „Wofür?“: elf Zwecke statt der Typen des Wikis. Sie fassen die
//             Rollenfamilien aus vehicle-roles.json (D-05) zusammen, Fahrzeuge
//             kommen ueber das Bodenmerkmal (feat.ground) dazu. Ein Schiff kann
//             mehrere Zwecke tragen (Starter-Frachter: einsteiger + fracht).
//   ROLES     Unterrollen fuer die grossen Zwecke (Kampf hat 90 Schiffe): die
//             atomaren Rollenschluessel des Spiels, zu Gruppen gefaltet.
//   SIZES     die sechs Groessen der Schiffsliste (sizeDe), Fahrzeug bis Kapital.
//   CREW, CARGO, PRICE  Stufen der Filterpillen.
//   vocab()   die Woerter, unter denen die Suche einen Filter erkennt, in
//             beiden Sprachen, dazu Spitznamen. Der Client bekommt sie als
//             JSON (#hgx-vocab) und fuehrt selbst keine Wortliste.
//
// Wie bei catalog.ts: rein und synchron, gelesen nur beim Bauen.

import vehicleRoles from '../../data/vehicle-roles.json';
import type { Locale } from '../../i18n/ui';
import { shipData, type ShipId } from './catalog';

type RoleEntry = { roleKeys?: string[]; families?: string[]; feat?: string[] };
const ROLES_BY_ID = (vehicleRoles as unknown as { vehicles: Record<string, RoleEntry> }).vehicles;

type Words = { readonly de: string; readonly en: string };

export type PurposeKey =
  | 'kampf' | 'fracht' | 'bergbau' | 'bergung' | 'erkundung' | 'personen'
  | 'medizin' | 'rennen' | 'betankung' | 'boden' | 'einsteiger';

export interface PurposeDef {
  readonly key: PurposeKey;
  readonly label: Words;
  /** Rollenfamilien (vehicle-roles.json families), die den Zweck tragen. */
  readonly families: readonly string[];
  /** Bodenfahrzeuge (feat.ground) zaehlen zu diesem Zweck. */
  readonly ground?: boolean;
  /** Zeichen, 24er-Raster, Strich. */
  readonly icon: string;
  /** Suchwoerter ausser dem Namen selbst, klein, beide Sprachen. */
  readonly words: readonly string[];
}

export const PURPOSES: readonly PurposeDef[] = [
  { key: 'kampf', label: { de: 'Kampf', en: 'Combat' }, families: ['jaeger', 'kanonenschiff', 'bomber', 'abriegelung', 'grosskampfschiff'],
    icon: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    words: ['kampf', 'combat', 'jäger', 'jaeger', 'jager', 'fighter', 'fighters', 'dogfight', 'pvp', 'militär', 'military', 'kriegsschiff', 'warship', 'kopfgeld', 'bounty', 'söldner', 'mercenary', 'kampfschiff'] },
  { key: 'fracht', label: { de: 'Fracht', en: 'Cargo' }, families: ['frachttransport'],
    icon: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
    words: ['fracht', 'cargo', 'frachter', 'hauler', 'hauling', 'haul', 'freight', 'transport', 'transporter', 'handel', 'trade', 'trading', 'trader', 'händler', 'lieferung', 'kisten', 'laderaum'] },
  { key: 'bergbau', label: { de: 'Bergbau', en: 'Mining' }, families: ['bergbau'],
    icon: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M10 4l2 16 2-16"/>',
    words: ['bergbau', 'mining', 'miner', 'mine', 'abbau', 'erz', 'ore', 'schürfen', 'quantanium', 'bergbauschiff'] },
  { key: 'bergung', label: { de: 'Bergung', en: 'Salvage' }, families: ['bergung'],
    icon: '<path d="M7 4v7a5 5 0 0010 0V4"/><path d="M5 4h4M15 4h4M7 8h2M15 8h2"/>',
    words: ['bergung', 'salvage', 'salvager', 'salvaging', 'schrott', 'scrap', 'recycling', 'wrack', 'wreck', 'rmc', 'bergungsschiff'] },
  { key: 'erkundung', label: { de: 'Erkundung', en: 'Exploration' }, families: ['erkundung', 'daten-wissenschaft'],
    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    words: ['erkundung', 'exploration', 'explorer', 'explore', 'entdecker', 'forschung', 'science', 'wissenschaft', 'scan', 'scanner', 'scanning', 'scout', 'späher', 'pathfinder', 'fernspäher', 'expedition', 'daten', 'data'] },
  { key: 'personen', label: { de: 'Personen', en: 'Passengers' }, families: ['passagiere', 'truppentransport'],
    icon: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0111 0"/><circle cx="16.5" cy="9" r="2.4"/><path d="M15.5 14a4.5 4.5 0 015 5"/>',
    words: ['personen', 'passagiere', 'passagier', 'passenger', 'passengers', 'reisen', 'reise', 'touring', 'luxus', 'luxury', 'truppen', 'troops', 'troop', 'dropship', 'truppenschiff', 'taxi', 'bus'] },
  { key: 'medizin', label: { de: 'Medizin', en: 'Medical' }, families: ['medizin'],
    icon: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
    words: ['medizin', 'medical', 'medic', 'sanitäter', 'sani', 'rettung', 'rescue', 'arzt', 'hospital', 'krankenhaus', 'heilen', 'heal', 'medbay', 'medizinisch'] },
  { key: 'rennen', label: { de: 'Rennen', en: 'Racing' }, families: ['rennen'],
    icon: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    words: ['rennen', 'racing', 'racer', 'race', 'rennschiff', 'renner', 'wettkampf', 'competition'] },
  { key: 'betankung', label: { de: 'Betankung', en: 'Refueling' }, families: ['betankung'],
    icon: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 01-12 0c0-3.5 3-7 6-11z"/>',
    words: ['betankung', 'refuel', 'refueling', 'refuelling', 'tanker', 'tankschiff', 'treibstoff', 'fuel', 'auftanken'] },
  { key: 'boden', label: { de: 'Fahrzeuge', en: 'Vehicles' }, families: ['bodenkampf'], ground: true,
    icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v5.5M12 14.5V20M4 12h5.5M14.5 12H20"/>',
    words: ['fahrzeug', 'fahrzeuge', 'boden', 'bodenfahrzeug', 'ground', 'vehicle', 'vehicles', 'rover', 'buggy', 'auto', 'car', 'bike', 'motorrad', 'hoverbike', 'gravlev', 'panzer', 'tank'] },
  { key: 'einsteiger', label: { de: 'Einsteiger', en: 'Starter' }, families: ['einsteiger'],
    icon: '<path d="M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z"/>',
    words: ['einsteiger', 'starter', 'start', 'anfänger', 'anfaenger', 'beginner', 'newbie', 'neuling', 'noob', 'starterschiff'] },
];

export interface RoleGroupDef {
  readonly key: string;
  readonly purpose: PurposeKey;
  readonly label: Words;
  /** Atomare Rollenschluessel (vehicle-roles.json roleKeys). */
  readonly roles: readonly string[];
  readonly words: readonly string[];
}

/**
 * Unterrollen der grossen Zwecke, in der Folge der Reiter. Ein Schiff mit einer
 * Verbundrolle (Mittlerer Frachter / Kanonenschiff) steht in beiden Gruppen.
 */
export const ROLE_GROUPS: readonly RoleGroupDef[] = [
  { key: 'leicht', purpose: 'kampf', label: { de: 'Leichte Jäger', en: 'Light fighters' }, roles: ['lightfighter'], words: ['leichter jäger', 'leichte jäger', 'light fighter', 'lightfighter'] },
  { key: 'mittel', purpose: 'kampf', label: { de: 'Mittlere Jäger', en: 'Medium fighters' }, roles: ['mediumfighter'], words: ['mittlerer jäger', 'mittlere jäger', 'medium fighter', 'mediumfighter'] },
  { key: 'schwer', purpose: 'kampf', label: { de: 'Schwere Jäger', en: 'Heavy fighters' }, roles: ['heavyfighter'], words: ['schwerer jäger', 'schwere jäger', 'heavy fighter', 'heavyfighter'] },
  { key: 'tarn', purpose: 'kampf', label: { de: 'Tarnung', en: 'Stealth' }, roles: ['stealthfighter', 'stealthbomber'], words: ['tarnung', 'tarnjäger', 'tarnkappe', 'stealth', 'stealth fighter'] },
  { key: 'abfang', purpose: 'kampf', label: { de: 'Abfangjäger', en: 'Interceptors' }, roles: ['interceptor'], words: ['abfangjäger', 'abfang', 'interceptor'] },
  { key: 'annex', purpose: 'kampf', label: { de: 'Annexjäger', en: 'Snub fighters' }, roles: ['snubfighter'], words: ['annexjäger', 'snub fighter'] },
  { key: 'bomber', purpose: 'kampf', label: { de: 'Bomber', en: 'Bombers' }, roles: ['bomber', 'heavybomber', 'stealthbomber'], words: ['bomber', 'bombers', 'torpedo', 'torpedos', 'torpedobomber', 'bomben', 'bombs'] },
  { key: 'kanone', purpose: 'kampf', label: { de: 'Kanonenschiffe', en: 'Gunships' }, roles: ['gunship', 'item_ShipFocus_Gunship', 'item_ShipFocus_HeavyGunship'], words: ['kanonenschiff', 'kanonenschiffe', 'gunship', 'gunships'] },
  { key: 'abriegel', purpose: 'kampf', label: { de: 'Abriegelung', en: 'Interdiction' }, roles: ['interdiction'], words: ['abriegelung', 'interdiction', 'interdictor', 'quantum interdiction'] },
  { key: 'gross', purpose: 'kampf', label: { de: 'Großkampfschiffe', en: 'Capital ships' }, roles: ['frigate', 'corvette', 'destroyer'], words: ['großkampfschiff', 'grosskampfschiff', 'fregatte', 'frigate', 'korvette', 'corvette', 'zerstörer', 'destroyer', 'capital ship', 'capship'] },
  { key: 'leicht', purpose: 'fracht', label: { de: 'Leichte Frachter', en: 'Light freight' }, roles: ['lightfreight'], words: ['leichter frachter', 'light freight'] },
  { key: 'mittel', purpose: 'fracht', label: { de: 'Mittlere Frachter', en: 'Medium freight' }, roles: ['mediumfreight'], words: ['mittlerer frachter', 'medium freight'] },
  { key: 'schwer', purpose: 'fracht', label: { de: 'Schwere Frachter', en: 'Heavy freight' }, roles: ['heavyfreight'], words: ['schwerer frachter', 'heavy freight'] },
  { key: 'spaeher', purpose: 'erkundung', label: { de: 'Fernspäher', en: 'Pathfinders' }, roles: ['pathfinder'], words: [] },
  { key: 'expedition', purpose: 'erkundung', label: { de: 'Expedition', en: 'Expedition' }, roles: ['expedition'], words: [] },
  { key: 'daten', purpose: 'erkundung', label: { de: 'Daten & Wissenschaft', en: 'Data & science' }, roles: ['lightscience', 'mediumdata', 'reporting'], words: ['wissenschaft', 'science', 'datenschiff', 'data runner', 'reporting', 'berichterstattung'] },
  { key: 'reisen', purpose: 'personen', label: { de: 'Passagiere & Reisen', en: 'Passengers & touring' }, roles: ['passenger', 'item_ShipFocus_LuxuryTouring', 'item_ShipFocus_Touring'], words: ['luxusreisen', 'luxury touring'] },
  { key: 'truppen', purpose: 'personen', label: { de: 'Truppentransport', en: 'Troop transport' }, roles: ['dropship', 'heavydropship'], words: ['truppentransport', 'troop transport', 'dropship', 'truppenschiff'] },
];

export type SizeKey = 'fahrzeug' | 'beiboot' | 'klein' | 'mittel' | 'gross' | 'kapital';
export interface SizeDef { readonly key: SizeKey; readonly sizeDe: string; readonly label: Words; readonly words: readonly string[] }

/** Die Groessen der Schiffsliste (vehicles.json sizeDe), klein nach gross. */
export const SIZES: readonly SizeDef[] = [
  { key: 'fahrzeug', sizeDe: 'Fahrzeug', label: { de: 'Fahrzeug', en: 'Vehicle' }, words: [] },
  { key: 'beiboot', sizeDe: 'Beiboot', label: { de: 'Beiboot', en: 'Snub' }, words: ['beiboot', 'beiboote', 'snub', 'snubs', 'parasite'] },
  { key: 'klein', sizeDe: 'Klein', label: { de: 'Klein', en: 'Small' }, words: ['klein', 'kleine', 'kleines', 'small'] },
  { key: 'mittel', sizeDe: 'Mittel', label: { de: 'Mittel', en: 'Medium' }, words: ['mittel', 'mittlere', 'mittleres', 'mittelgroß', 'medium'] },
  { key: 'gross', sizeDe: 'Groß', label: { de: 'Groß', en: 'Large' }, words: ['groß', 'gross', 'große', 'grosse', 'großes', 'large', 'big'] },
  { key: 'kapital', sizeDe: 'Kapitalklasse', label: { de: 'Kapital', en: 'Capital' }, words: ['kapital', 'kapitalklasse', 'capital', 'riesig', 'huge'] },
];

export type CrewKey = 'solo' | 'klein' | 'gross';
export const CREW: readonly { key: CrewKey; min: number; max: number; label: Words; words: readonly string[] }[] = [
  { key: 'solo', min: 1, max: 1, label: { de: 'Solo', en: 'Solo' }, words: ['solo', 'allein', 'alleine', 'einsitzer', 'single', 'singleseat', 'single-seat', 'einzelpilot', 'einmann'] },
  { key: 'klein', min: 2, max: 4, label: { de: '2–4 Crew', en: '2–4 crew' }, words: ['duo', 'zu zweit', 'zweisitzer', 'two-seat'] },
  { key: 'gross', min: 5, max: Infinity, label: { de: '5+ Crew', en: '5+ crew' }, words: ['multicrew', 'multi-crew', 'org', 'gruppe', 'group'] },
];

/** Untergrenzen der Frachtpille in SCU. */
export const CARGO_STEPS: readonly number[] = [1, 32, 100, 500];
/** Obergrenzen der Preispille in aUEC (niedrigster Kaufpreis im Spiel). */
export const PRICE_STEPS: readonly number[] = [1_000_000, 3_000_000, 10_000_000, 30_000_000];

// Spitznamen, die im Spiel jeder sagt, die aber in keinem Namen stehen.
// Schluessel klein; Wert: ein Wort, das im Namen des Schiffs steht.
export const NICKNAMES: Readonly<Record<string, string>> = {
  cutty: 'cutlass', connie: 'constellation', conny: 'constellation', connies: 'constellation',
  herc: 'hercules', hercs: 'hercules', msr: 'mercury', cat: 'caterpillar', catter: 'caterpillar',
  lancer: 'freelancer', prospi: 'prospector', prosp: 'prospector', f7a: 'hornet', f7c: 'hornet',
  f8: 'lightning', f8c: 'lightning', hammy: 'hammerhead', polly: 'polaris', sfg: 'starfarer',
  cyc: 'cyclone', buc: 'buccaneer', bucc: 'buccaneer',
};

export interface ShipFinder {
  readonly purposes: readonly PurposeKey[];
  /** Schluessel der Unterrollen als purpose:key, z. B. 'kampf:schwer'. */
  readonly groups: readonly string[];
  readonly size: SizeKey | null;
}

const memo = new Map<string, ShipFinder>();

export function shipFinder(id: ShipId): ShipFinder {
  const hit = memo.get(id);
  if (hit) return hit;
  const r = ROLES_BY_ID[id] ?? {};
  const fam = new Set(r.families ?? []);
  const roles = new Set(r.roleKeys ?? []);
  const ground = (r.feat ?? []).includes('ground');
  const purposes = PURPOSES.filter((p) => p.families.some((f) => fam.has(f)) || (p.ground && ground)).map((p) => p.key);
  const groups = ROLE_GROUPS.filter((g) => purposes.includes(g.purpose) && g.roles.some((x) => roles.has(x))).map((g) => `${g.purpose}:${g.key}`);
  const sizeDe = shipData(id).sizeDe;
  const size = SIZES.find((s) => s.sizeDe === sizeDe)?.key ?? null;
  const out = { purposes, groups: [...new Set(groups)], size };
  memo.set(id, out);
  return out;
}

/**
 * Was die Suche als Filter erkennt, fuer den Client (#hgx-vocab). Jeder
 * Eintrag: Art, Schluessel, Woerter (klein, beide Sprachen; die Beschriftung
 * beider Sprachen ist immer dabei). Hersteller mit Namen, erstem Wort und Kuerzel.
 */
export function vocab(makers: readonly { name: string; code: string }[]) {
  const low = (s: string) => s.toLowerCase();
  const both = (w: Words) => [low(w.de), low(w.en)];
  const uniq = (xs: readonly string[]) => [...new Set(xs.map(low).filter(Boolean))];
  return {
    pur: PURPOSES.map((p) => ({ k: p.key, w: uniq([...both(p.label), ...p.words]) })),
    grp: ROLE_GROUPS.map((g) => ({ k: `${g.purpose}:${g.key}`, w: uniq([...both(g.label), ...g.words]) })),
    size: SIZES.map((s) => ({ k: s.key, w: uniq([...both(s.label), ...s.words]) })),
    crew: CREW.map((c) => ({ k: c.key, w: uniq(c.words) })),
    maker: makers.map((m) => ({ k: m.name, w: uniq([m.name, m.name.split(' ')[0], m.code]) })),
    nick: NICKNAMES,
  };
}

export const label = (w: Words, lang: Locale): string => (lang === 'de' ? w.de : w.en);

/**
 * Klein, ohne Akzente, ß als ss, Apostrophe weg: dieselbe Faltung wie fold()
 * in assets/hangar-overview.js, damit data-q der Karten und die Suche des
 * Clients dieselben Woerter sprechen (verify-hangar [19] faltet jedes data-q
 * mit der Fassung des Clients nach und verlangt keine Aenderung).
 *   fold('  Großer  JÄGER ') === 'grosser jager'
 */
export function fold(s: string): string {
  return String(s ?? '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´]/g, '').replace(/\s+/g, ' ').trim();
}
