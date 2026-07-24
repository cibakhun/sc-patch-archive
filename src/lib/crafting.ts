// Blueprint-Snapshot + Helfer fuer die STATISCHEN Blueprint-Seiten
// (/crafting/<slug>.html).
//
// Der Crafting-Planer rendert zwar die Karten-NAMEN serverseitig, aber alles,
// wonach gesucht wird — Zutaten, Mengen, Qualitaets-Effekte, Missions-Quellen,
// Item-Werte — liegt in crafting-db.json und wird erst im Browser eingeblendet.
// Fuer Suchmaschinen existierte davon nichts. Diese Schicht macht jeden
// Blueprint zu einer eigenen, verlinkbaren Seite.

import DB from '../../assets/crafting-db.json';
import type { Locale } from '../i18n/ui';
import { items, type Item } from './items';

/* ---------- Typen (Spiegel von scripts/datamine-crafting.mjs) ---------- */

export interface IngredientOption {
  name: string;
  quantity_scu: number;
  min_quality: number;
}

export interface QualityEffect {
  stat: string;
  quality_min: number;
  quality_max: number;
  modifier_at_min: number;
  modifier_at_max: number;
  multiplicative: boolean;
}

export interface Ingredient {
  slot: string;
  options: IngredientOption[];
  quality_effects?: QualityEffect[];
}

/** Schadens-Multiplikatoren der Ruestung (0,6 = 40 % weniger Schaden). */
export interface DamageResistance {
  physical?: number;
  energy?: number;
  distortion?: number;
  thermal?: number;
  biochemical?: number;
  stun?: number;
  impact_force?: number;
  /** Ruestungsklasse aus den Spieldaten, z. B. "HeavyArmor" */
  profile?: string;
}

export interface BlueprintItemStats {
  type?: string;
  mass_kg?: number;
  overheat_temperature?: number;
  /** Betriebstemperatur-Fenster in °C */
  temperature_resistance?: { min: number; max: number };
  damage_resistance?: DamageResistance;
  fire_modes?: { name: string }[];
  max_ammo?: number;
  max_restock?: number;
  [k: string]: unknown;
}

export interface BlueprintMission {
  id: string;
  name: string;
  drop_chance: number;
}

export interface Blueprint {
  name: string;
  category: string;
  craft_time_seconds: number;
  tiers: number;
  item_stats?: BlueprintItemStats;
  ingredients: Ingredient[];
  missions?: BlueprintMission[];
}

export interface CraftingDb {
  source: string;
  source_url: string;
  source_note: string;
  version: string;
  snapshot_date: string;
  counts: { blueprints: number; resources: number };
  dismantle_blacklist: string[];
  dismantle_efficiency: number;
  blueprints: Blueprint[];
  resources: { name: string; used_in_blueprints: number }[];
}

export const craftDb = DB as unknown as CraftingDb;

/** Patch-Label aus der DB-Version ("LIVE-4.9.0-12232306" -> "4.9"). */
export const craftPatch = (/(\d+\.\d+)/.exec(craftDb.version) ?? [])[1] ?? '4.9';

/* ---------- Slugs ---------- */

export function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'blueprint';
}

export interface BlueprintEntry extends Blueprint {
  slug: string;
  /** Index in craftDb.blueprints — der Planer adressiert Karten ueber ihn. */
  index: number;
}

/**
 * 16 Blueprint-Namen kommen doppelt vor (gleiches Item in zwei Varianten).
 * Der zweite und jeder weitere bekommt ein "-2"/"-3"-Suffix, damit die URL
 * eindeutig bleibt — Reihenfolge = DB-Reihenfolge, also build-stabil.
 */
export const blueprints: BlueprintEntry[] = (() => {
  const used = new Map<string, number>();
  return craftDb.blueprints.map((b, index) => {
    const base = slugify(b.name);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return { ...b, index, slug: n > 1 ? `${base}-${n}` : base };
  });
})();

export const blueprintBySlug = new Map(blueprints.map((b) => [b.slug, b]));
/** Name (klein) -> Blueprint, fuer den Join Item <-> Rezept. */
export const blueprintByName = new Map(blueprints.map((b) => [b.name.toLowerCase(), b]));

/* ---------- Kategorien ---------- */

export const craftRoot = (cat: string) => (cat || 'Other').split('/')[0].trim() || 'Other';
export const craftLeaf = (cat: string) => {
  const p = (cat || 'Other').split('/').map((s) => s.trim()).filter(Boolean);
  return p.length > 1 ? p[p.length - 1] : p[0] || 'Other';
};

export interface CraftCategory {
  cat: string;
  slug: string;
  root: string;
  leaf: string;
  blueprints: BlueprintEntry[];
}

export const craftCategories: CraftCategory[] = (() => {
  const by = new Map<string, BlueprintEntry[]>();
  for (const b of blueprints) {
    const list = by.get(b.category);
    if (list) list.push(b);
    else by.set(b.category, [b]);
  }
  return [...by.entries()]
    .map(([cat, list]) => ({
      cat,
      slug: slugify(cat),
      root: craftRoot(cat),
      leaf: craftLeaf(cat),
      blueprints: list.sort((a, b) => a.name.localeCompare(b.name, 'en')),
    }))
    .sort((a, b) => a.cat.localeCompare(b.cat, 'en'));
})();

export const craftCategoryBySlug = new Map(craftCategories.map((c) => [c.slug, c]));

export const craftRoots = (() => {
  const by = new Map<string, CraftCategory[]>();
  for (const c of craftCategories) {
    const list = by.get(c.root);
    if (list) list.push(c);
    else by.set(c.root, [c]);
  }
  return [...by.entries()]
    .map(([root, nodes]) => ({
      root,
      slug: slugify(root),
      nodes,
      count: nodes.reduce((n, c) => n + c.blueprints.length, 0),
    }))
    .sort((a, b) => b.count - a.count);
})();

export const CRAFT_PER_PAGE = 100;
export const craftPageCount = (c: CraftCategory) =>
  Math.max(1, Math.ceil(c.blueprints.length / CRAFT_PER_PAGE));

/* ---------- Join Blueprint <-> Item ---------- */

const itemByName = new Map(items.map((i) => [i.name.toLowerCase(), i]));

/** Das gecraftete Item im Katalog (Join ueber den Namen, wie im Finder). */
export function itemForBlueprint(b: Blueprint): Item | null {
  return itemByName.get(b.name.toLowerCase()) ?? null;
}

/** Rezept zu einem Item — oder null. */
export function blueprintForItem(i: Item): BlueprintEntry | null {
  return blueprintByName.get(i.name.toLowerCase()) ?? null;
}

/**
 * Missions-Slug -> Blueprints, die diese Mission als Quelle nennen.
 *
 * Die Gegenrichtung ist die EINZIGE, die trägt: die Blueprint-Pools in
 * missions.json führen interne Kennungen ("klwe_pistol_energy_01_black02"),
 * keine Anzeigenamen — ein Join über den Namen findet dort 0 von 3.823
 * Einträgen. crafting-db.json dagegen nennt pro Blueprint die Missions-Slugs,
 * und die treffen die vorhandenen Missions-Seiten (3.563 von 3.627).
 */
export const blueprintsByMission = (() => {
  const by = new Map<string, BlueprintEntry[]>();
  for (const b of blueprints) {
    for (const m of b.missions ?? []) {
      const list = by.get(m.id);
      if (list) list.push(b);
      else by.set(m.id, [b]);
    }
  }
  for (const list of by.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return by;
})();

/** Alle Ressourcen-Namen eines Rezepts, ohne Dubletten, in Slot-Reihenfolge. */
export function resourceNames(b: Blueprint): string[] {
  const seen = new Set<string>();
  for (const ing of b.ingredients ?? [])
    for (const o of ing.options ?? []) if (o.name) seen.add(o.name);
  return [...seen];
}

/** Summe aller Mindestmengen (guenstigste Option je Slot) in SCU. */
export function totalScu(b: Blueprint): number {
  let sum = 0;
  for (const ing of b.ingredients ?? []) {
    const q = (ing.options ?? []).map((o) => o.quantity_scu).filter((n) => typeof n === 'number');
    if (q.length) sum += Math.min(...q);
  }
  return Math.round(sum * 1000) / 1000;
}

/** Verwandte Blueprints: gleiche Kategorie, alphabetisch, ohne sich selbst. */
export function relatedBlueprints(b: BlueprintEntry, limit = 12): BlueprintEntry[] {
  const pool = craftCategoryBySlug.get(slugify(b.category))?.blueprints ?? [];
  const res = new Set(resourceNames(b));
  const shared = (o: BlueprintEntry) => resourceNames(o).filter((r) => res.has(r)).length;
  return pool
    .filter((o) => o.slug !== b.slug)
    .sort((x, y) => shared(y) - shared(x) || x.name.localeCompare(y.name, 'en'))
    .slice(0, limit);
}

/* ---------- Anzeige ---------- */

/** Sekunden -> "16m" / "1h 30m" / "45s". */
export function craftTime(sec: number, _lang: Locale): string {
  const s = Number(sec) || 0;
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  if (m) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  return `${s}s`;
}

/* ---------- URLs (Basisform = EN-Pfad) ---------- */

export const blueprintPath = (b: BlueprintEntry | string) =>
  `/crafting/${typeof b === 'string' ? b : b.slug}.html`;

export const craftCategoryPath = (c: CraftCategory | string, page = 1) => {
  const slug = typeof c === 'string' ? c : c.slug;
  return page > 1 ? `/crafting/category/${slug}-${page}.html` : `/crafting/category/${slug}.html`;
};

export const craftHubPath = '/crafting.html';
/** Der interaktive Planer (Deep-Link auf einen Blueprint). */
export const plannerPath = (b?: BlueprintEntry) =>
  b ? `/topics/crafting.html?bp=${encodeURIComponent(b.name)}` : '/topics/crafting.html';
