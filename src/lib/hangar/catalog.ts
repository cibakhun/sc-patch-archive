// Der Schiffsbestand des Hangars und seine schiffsweiten Kennwerte. EIN Modul
// beantwortet "welche Schiffe" und "welche Zahlen" fuer jede Hangar-Flaeche:
// das Dock (Filter-, Sortier- und Vergleichswerte als data-*), den Ueberblick
// jedes Buchtdokuments, die Routen der Buchtdokumente und die Modellliste der
// Szene (HANGAR_IDS).
//
// STATS ist das EINE Kennwert-Verzeichnis: wer einen Kennwert ergaenzt,
// ergaenzt eine Zeile, und Balken, Sortierung, Vergleich und Dock-Attribute
// folgen daraus. Keine zweite Liste der Kennwerte daneben.
//
// Liest die rohe JSON statt getCollection('vehicles'), damit alles synchron
// und rein bleibt; die Schema-Vorgaben des Inhaltsschemas werden dafuer an der
// Grenze nachgetragen (toVehicle).

import type { CollectionEntry } from 'astro:content';
import vehiclesSnapshot from '../../data/vehicles.json';
import holoMeshes from '../../data/holo-meshes.json';
import vehiclePrices from '../../data/vehicle-prices.json';
import { vType, vRoleCig, vRoleFamilies } from '../../i18n/vehicleText';
import type { Locale } from '../../i18n/ui';
import { num } from '../items';
import { pickThumb } from '../shipRenders';

type VehicleData = CollectionEntry<'vehicles'>['data'];
// Schluessel, die das Inhaltsschema mit .default() fuellt: in der Datei fehlen
// sie bei Fahrzeugen ohne Wert (vehicle-external.json fuehrt sie nur dann).
type Defaulted = 'roleEn' | 'roleDe' | 'sizeClass' | 'descriptionEn' | 'crewMax' | 'msrpUSD'
  | 'fixedWeaponMounts' | 'fixedWeaponSizes' | 'turretWeapons' | 'pledgeUrl' | 'image';
type VehicleJson = Omit<VehicleData, Defaulted> & Partial<Pick<VehicleData, Defaulted>>;

const toVehicle = (v: VehicleJson): VehicleData => ({
  roleEn: null, roleDe: null, sizeClass: null, descriptionEn: null, crewMax: null, msrpUSD: null,
  fixedWeaponMounts: [], fixedWeaponSizes: [], turretWeapons: [], pledgeUrl: null, image: null,
  ...v,
});

declare const shipIdBrand: unique symbol;
/** Eine vehicles.json-Id mit Hangar-Modell. Entsteht nur in HANGAR_IDS und parseShipId. */
export type ShipId = string & { readonly [shipIdBrand]: true };

export type StatKey =
  | 'scm' | 'max' | 'hull' | 'shield' | 'dps' | 'cargo' | 'crew' | 'len'
  | 'missiles' | 'qtSpeed' | 'qtRange' | 'h2' | 'price';

export interface StatDef {
  readonly key: StatKey;
  readonly unit: '' | 'm/s' | 'HP' | 'DPS' | 'SCU' | 'm' | 'Mm/s' | 'Gm' | 'aUEC';
  readonly digits: 0 | 1;
  /** Richtung von "besser" fuer ein Vergleichs-Delta: 1 mehr, -1 weniger, 0 keine. */
  readonly better: 1 | -1 | 0;
  /** Sortieroption des Docks UND Balken im Ueberblick: beide zeigen den Rang. */
  readonly sortable: boolean;
  readonly comparable: boolean;
  /** Wert in Anzeigeeinheit; null = unbekannt, eine echte 0 bleibt 0 (Fracht, Raketen). */
  readonly read: (v: VehicleData, id: string) => number | null;
}

const pos = (x: number | null | undefined): number | null => (x != null && x > 0 ? x : null);
const known = (x: number | null | undefined): number | null => (x == null ? null : x);
const lowestBuy = (id: string): number | null => {
  const buy = (vehiclePrices as { prices: Record<string, { buy?: { price: number }[] }> }).prices[id]?.buy ?? [];
  return buy.length ? Math.min(...buy.map((b) => b.price)) : null;
};

export const STATS: readonly StatDef[] = [
  { key: 'scm', unit: 'm/s', digits: 0, better: 1, sortable: true, comparable: true, read: (v) => known(v.scmSpeed) },
  { key: 'max', unit: 'm/s', digits: 0, better: 1, sortable: true, comparable: true, read: (v) => known(v.maxSpeed) },
  // 0 HP tragen nur die vier ATLS, deren Wert fehlt: unbekannt, nicht null.
  { key: 'hull', unit: 'HP', digits: 0, better: 1, sortable: true, comparable: true, read: (v) => pos(v.hullHp) },
  { key: 'shield', unit: 'HP', digits: 0, better: 1, sortable: true, comparable: true, read: (v) => known(v.shieldHp) },
  { key: 'dps', unit: 'DPS', digits: 1, better: 1, sortable: true, comparable: true, read: (v) => known(v.pilotDps) },
  { key: 'cargo', unit: 'SCU', digits: 0, better: 1, sortable: true, comparable: true, read: (v) => known(v.cargoSCU) },
  { key: 'crew', unit: '', digits: 0, better: 0, sortable: true, comparable: true, read: (v) => known(v.crewMax ?? v.crewMin) },
  // Laenge 0 (Javelin, Moth) ist eine fehlende Angabe, kein Mass.
  { key: 'len', unit: 'm', digits: 1, better: 0, sortable: true, comparable: true, read: (v) => pos(v.lengthM) },
  { key: 'missiles', unit: '', digits: 0, better: 1, sortable: false, comparable: true, read: (v) => v.missileCount ?? 0 },
  { key: 'qtSpeed', unit: 'Mm/s', digits: 0, better: 1, sortable: false, comparable: true, read: (v) => (v.qtSpeedMs == null ? null : v.qtSpeedMs / 1e6) },
  { key: 'qtRange', unit: 'Gm', digits: 0, better: 1, sortable: false, comparable: true, read: (v) => (v.qtRangeM == null ? null : v.qtRangeM / 1e9) },
  { key: 'h2', unit: 'SCU', digits: 1, better: 1, sortable: false, comparable: true, read: (v) => pos(v.h2Fuel) },
  { key: 'price', unit: 'aUEC', digits: 0, better: -1, sortable: false, comparable: true, read: (_v, id) => lowestBuy(id) },
];

export const STAT: Readonly<Record<StatKey, StatDef>> = Object.fromEntries(STATS.map((s) => [s.key, s])) as Record<StatKey, StatDef>;

const VEHICLES = new Map(
  (vehiclesSnapshot as unknown as { vehicles: VehicleJson[] }).vehicles.map((v) => [v.id, toVehicle(v)]),
);
const MESHES = (holoMeshes as { meshes: Record<string, unknown> }).meshes;

/** Fahrzeuge mit Holo-Modell, in Katalogreihenfolge. Dock, Buchtrouten und Modellliste lesen genau diese Liste. */
export const HANGAR_IDS: readonly ShipId[] = [...VEHICLES.keys()].filter((id) => MESHES[id]).map((id) => id as ShipId);

const IDS = new Set<string>(HANGAR_IDS);

/** Grenze fuer Ids, die als Zeichenkette ankommen (Routenparameter). */
export function parseShipId(raw: string | undefined): ShipId | null {
  return raw && IDS.has(raw) ? (raw as ShipId) : null;
}

export const HANGAR_DEFAULT_SHIP: ShipId = (() => {
  const id = parseShipId('aegs-gladius');
  if (!id) throw new Error('catalog: das Startschiff aegs-gladius hat kein Hangar-Modell mehr');
  return id;
})();

const vehicle = (id: ShipId): VehicleData => VEHICLES.get(id) as VehicleData;

/** Rohdaten eines Hangar-Schiffs (Gruppensummen in bay.ts lesen daraus). */
export function shipData(id: ShipId): VehicleData {
  return vehicle(id);
}

export interface ShipFacts {
  readonly id: ShipId;
  readonly name: string;
  readonly maker: string;
  readonly makerCode: string;
  /** Deutscher Typ, "Gelaende" in "Boden" gefaltet: der Filterschluessel, in beiden Sprachen gleich (verify:sync). */
  readonly typeKey: string;
  readonly typeLabel: string;
  readonly role: string | null;
  /** Rollenfamilien (vehicle-roles.json), z. B. ['einsteiger', 'frachttransport']; die Flottenzeile zaehlt sie. */
  readonly families: readonly string[];
  readonly thumb: string | null;
  /** EN-Grundform; Aufrufer lokalisieren mit href(). */
  readonly sheetPath: string;
  readonly stat: Readonly<Record<StatKey, number | null>>;
}

const factsMemo = new Map<string, ShipFacts>();

export function shipFacts(id: ShipId, lang: Locale): ShipFacts {
  const memoKey = `${lang}|${id}`;
  const hit = factsMemo.get(memoKey);
  if (hit) return hit;
  const v = vehicle(id);
  const facts: ShipFacts = {
    id,
    name: v.name,
    maker: v.manufacturer ?? '',
    makerCode: v.makerCode ?? '',
    typeKey: v.typeDe === 'Gelände' ? 'Boden' : (v.typeDe ?? v.typeEn ?? ''),
    typeLabel: vType(v, lang) ?? '',
    role: vRoleCig(id, v, lang),
    families: vRoleFamilies(id, lang).map((f) => f.slug),
    thumb: pickThumb(v)?.src ?? null,
    sheetPath: `/schiffe/${id}.html`,
    stat: Object.fromEntries(STATS.map((s) => [s.key, s.read(v, id)])) as Record<StatKey, number | null>,
  };
  factsMemo.set(memoKey, facts);
  return facts;
}

const roundTo = (x: number, digits: 0 | 1) => (digits ? Math.round(x * 10) / 10 : Math.round(x));

/** Wert in der Genauigkeit des Verzeichnisses; Vergleich und Anzeige rechnen mit derselben Zahl. */
export function statValue(key: StatKey, x: number | null): number | null {
  return x == null ? null : roundTo(x, STAT[key].digits);
}

/**
 * Die Kennwerte einer Dock-Karte (data-v), in STATS-Folge und Verzeichnis-
 * Genauigkeit, '-' fuer unbekannt. Der Client liest die Schluesselfolge aus
 * data-stats des Docks; Sortierung, Vergleich und Flottenzeile rechnen damit,
 * ohne eine Bucht zu holen.
 *   dockFigures(gladius) === '226 1193 6110 6336 1944.5 0 1 21 6 161 32 1.6 2262330'
 */
export function dockFigures(f: ShipFacts): string {
  return STATS.map((s) => statValue(s.key, f.stat[s.key]) ?? '-').join(' ');
}

/** "1,944.5 DPS", "21 m", "1"; null bleibt null (die Anzeige druckt den Strich). */
export function formatStat(key: StatKey, x: number | null, lang: Locale): string | null {
  const r = statValue(key, x);
  if (r == null) return null;
  const unit = STAT[key].unit;
  return unit ? `${num(r, lang)} ${unit}` : num(r, lang);
}

// Rang unter den Hangar-Schiffen mit positivem Wert, mindestens 4 %. Die
// sortierten Wertelisten entstehen einmal beim Laden ueber HANGAR_IDS, nie pro
// Aufruf: kein Erstaufruf-Cache wie bei buildVisuals/buildProfile, der
// spaetere Aufrufer still falsch bedient.
const SORTED: Readonly<Partial<Record<StatKey, readonly number[]>>> = Object.fromEntries(
  STATS.filter((s) => s.sortable).map((s) => [
    s.key,
    HANGAR_IDS.map((id) => s.read(vehicle(id), id)).filter((x): x is number => x != null && x > 0).sort((a, b) => a - b),
  ]),
);

/** Balkenbreite in Prozent fuer einen sortierbaren Kennwert; 0 ohne Wert. */
export function percentile(key: StatKey, x: number | null): number {
  const vals = SORTED[key];
  if (!vals || !vals.length || x == null || !(x > 0)) return 0;
  let lo = 0, hi = vals.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (vals[m] <= x) lo = m + 1; else hi = m; }
  return Math.max(4, Math.round((lo / vals.length) * 100));
}
