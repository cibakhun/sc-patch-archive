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
import { hasGradeSemantics, items, type Item } from './items';

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

/**
 * Schluesselsortierte, rekursive Serialisierung eines Werts — Grundlage des
 * Kollisionsvergleichs unten. Objektschluessel werden sortiert, damit die
 * Reihenfolge im JSON nicht mitentscheidet; Arrays behalten ihre Reihenfolge,
 * weil sie fachlich bedeutsam ist (z. B. fire_modes).
 */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`;
}

/**
 * Kleingeschriebene Namen von Blueprint-Gruppen, deren Mitglieder trotz
 * gleichem Namen UND gleicher Kategorie unterschiedliche `item_stats`
 * fuehren — also nachweislich verschiedene Items sind (D-09). Weil
 * `itemForBlueprint()` per Name joint, traefen alle Mitglieder einer solchen
 * Gruppe denselben Item-Eintrag; mindestens eine Karte zeigte dann fremde
 * Kennwerte. Die Menge wird bei jedem Build **aus den Daten abgeleitet**,
 * nie von Hand gepflegt — eine kuenftige Kollision sperrt sich damit selbst,
 * statt still durchzugehen. Verglichen wird das gesamte `item_stats`-Objekt
 * (nicht nur `mass_kg`/`overheat_temperature`), weil bei drei der fuenf
 * heute bekannten Gruppen `overheat_temperature` identisch ist und ein
 * schmalerer Vergleich sie uebersaehe.
 */
export const COLLIDING_NAMES: Set<string> = (() => {
  const byName = new Map<string, Blueprint[]>();
  for (const b of blueprints) {
    const key = b.name.toLowerCase();
    const list = byName.get(key);
    if (list) list.push(b);
    else byName.set(key, [b]);
  }
  const colliding = new Set<string>();
  for (const [name, list] of byName) {
    if (list.length < 2) continue;
    const signatures = new Set(list.map((b) => stableStringify(b.item_stats ?? null)));
    if (signatures.size > 1) colliding.add(name);
  }
  return colliding;
})();

/** Groesse/Grade/Ton einer Blueprint-Karte — Ergebnis von blueprintSpecs(). */
export interface BlueprintSpecs {
  size: number | null;
  grade: string | null;
  tone: string | null;
}

/**
 * Ton der Schiffswaffen aus dem Kategorie-Pfad des BLUEPRINTS (D-04): die 96
 * Vehiclegear-Waffen fuehren `game.class = null`, tragen ihren Ton aber im
 * Kategorie-String selbst, z. B. `Vehiclegear / Weapons / Ballistic / Cannon`
 * -> `Ballistic` (drittes Segment). Getrennt und getrimmt wie craftRoot/
 * craftLeaf im selben Modul. Fehlt das dritte Segment, bleibt der Ton `null`
 * (D-06, nichts raten). Greift ausdruecklich nur fuer Schiffswaffen — fuer
 * Mininglaser/Tractorbeam/Salvage/Refuelling liefert keine Quelle einen Ton
 * (vertagt als CRAFT-05 nach v2, ausserhalb des Umfangs dieser Phase).
 */
function toneFromWeaponCategoryPath(category: string): string | null {
  const segs = (category || '').split('/').map((s) => s.trim()).filter(Boolean);
  if (segs[0] === 'Vehiclegear' && segs[1] === 'Weapons' && segs[2]) return segs[2];
  return null;
}

/**
 * Groesse, Grade und Ton fuer die Kartenanzeige — die einzige Quelle dafuer.
 * Gibt `null` zurueck, wenn der Blueprint-Name kollidiert (D-09, kein Chip
 * ist besser als ein fremder) oder wenn keine der drei Angaben vorliegt.
 * Alle Werte kommen aus dem bereits vorhandenen Item-Katalog (D-01) — kein
 * Data.p4k-Lauf, keine Neu-Extraktion.
 */
export function blueprintSpecs(b: Blueprint): BlueprintSpecs | null {
  if (COLLIDING_NAMES.has(b.name.toLowerCase())) return null;
  const item = itemForBlueprint(b);
  if (!item) return null;
  const g = item.game;
  const eq = hasGradeSemantics(item);
  const size = eq && g?.size != null ? g.size : null;
  const grade = eq && g?.grade ? g.grade : null;
  const tone = g?.class ?? toneFromWeaponCategoryPath(b.category);
  if (size == null && grade == null && tone == null) return null;
  return { size, grade, tone };
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
