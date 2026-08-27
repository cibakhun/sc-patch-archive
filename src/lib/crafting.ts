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
import { hasGradeSemantics, hasMeaningfulGrade, itemSizes, items, type Item, type ItemVariant } from './items';

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
  /**
   * Record-Id der EntityClassDefinition des gecrafteten Items — derselbe
   * Id-Raum wie `item.game.guid`. Ein echter Schluessel, im Gegensatz zum
   * Anzeigenamen. Seit dem 07.08.2026 von datamine-crafting.mjs geschrieben;
   * aeltere Snapshots haben ihn nicht, deshalb optional.
   */
  entity_guid?: string | null;
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

/** Patch-Label aus der DB-Version ("PUBLIC-4.10.0-12519617" -> "4.10"). */
export const craftPatch = (/(\d+\.\d+)/.exec(craftDb.version) ?? [])[1] ?? '4.10';

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

/* ---------- Join Blueprint <-> Item ---------- */

const itemByName = new Map(items.map((i) => [i.name.toLowerCase(), i]));
/**
 * Record-Id -> Item, und wo bekannt die konkrete Ausfuehrung.
 *
 * Drei Wege fuehren auf denselben Katalogeintrag, und alle drei sind noetig,
 * weil `datamine-items.mjs` gleichnamige Spiel-Items zusammenzieht:
 *  1. `game.guid` — der Eintrag selbst.
 *  2. `game.guidAliases` — Geschwister, die beim Dedupe wegfielen. Sie tragen
 *     nachweislich dieselbe Groesse, denselben Grade und dieselbe Klasse,
 *     sonst waeren sie nicht aufgenommen worden.
 *  3. `game.variants[].guid` — bei mehrdeutigen Anzeigenamen die einzelne
 *     Ausfuehrung. Hier zaehlt der Treffer MEHR als der Eintrag: er sagt, dass
 *     dieses Rezept die S3 meint und nicht "S3 / S4 / S6".
 */
interface GuidTreffer { item: Item; variant?: ItemVariant }
const itemByGuid = new Map<string, GuidTreffer>();
for (const i of items) {
  const g = i.game;
  if (!g) continue;
  if (g.guid && !itemByGuid.has(g.guid)) itemByGuid.set(g.guid, { item: i });
  for (const a of g.guidAliases ?? []) if (!itemByGuid.has(a)) itemByGuid.set(a, { item: i });
}
// Ausfuehrungen ZULETZT und ueberschreibend: die guid des Katalogeintrags ist
// zugleich die einer seiner Ausfuehrungen (der beste Vertreter IST eine davon).
// Wuerde der Eintrags-Treffer gewinnen, saehe ausgerechnet diese Karte
// "S2 / S3" statt ihres eigenen "S2" — der unpraezisere Wert.
for (const i of items) {
  for (const v of i.game?.variants ?? []) if (v.guid) itemByGuid.set(v.guid, { item: i, variant: v });
}

/**
 * 11 Blueprint-Namen kommen doppelt vor (gleiches Item in zwei Varianten).
 * Der zweite und jeder weitere bekommt ein "-2"/"-3"-Suffix, damit die URL
 * eindeutig bleibt — Reihenfolge = DB-Reihenfolge, also build-stabil.
 *
 * ⚠ Die Zahl stand hier als "16" und war nach dem 4.10-Datenlauf still falsch:
 * `datamine-crafting.mjs` entdoppelt seit dem 27.08.2026 zeichengleiche
 * Eintraege (FullForce, Glacis), und 4.10 selbst hat weitere Namensgruppen
 * aufgeloest. Sie ist reine Beschreibung, keine Zusicherung — die harte Zahl
 * steht in verify-crafting-specs.mjs.
 *
 * ---
 *
 * Und: Bauplaene ohne jedes Item dahinter erscheinen NICHT auf der Seite.
 *
 * Anlass (Register id 53, gemessen 27.08.2026): 42 der 1.605 Bauplaene trafen
 * ihr Item nicht ueber die entity_guid. 33 davon finden es doch — ueber den
 * Namen; ihre Seiten sind vollstaendig. Die uebrigen 9 finden es auf KEINEM
 * Weg, und ihre Seite zeigt darum ein Rezept ohne einen einzigen Kennwert:
 *
 *   Cool Aegs S04 Javelin Scitem · Cool S04 Cnou Pioneer · Torrez
 *   Radr Gnrp S03 Idris Temp · Radr Rsi S04 Polaris · Radr Wlop S03 Lephari
 *   Metamaterial Test #146 · Metamaterial Test #152 · Probe
 *
 * Alle neun tragen unfertige Werkstattnamen aus dem Spielbuild ("Cool …" =
 * Kuehler, "Radr …" = Radar, dazu zwei ausdrueckliche Tests). Sie sind keine
 * Extraktionsfehler — sie liegen so im ausgelieferten Spiel; der Erzeuger
 * arbeitet richtig. Sie gehoeren nur nicht auf eine Seite, die vorgibt, ein
 * Item zu beschreiben.
 *
 * Gefiltert wird HIER und nicht im Erzeuger: crafting-db.json bleibt damit ein
 * vollstaendiges Abbild des Spielbestands (und verify:crafting prueft weiter
 * gegen alle 1.605), waehrend die SEITE nur zeigt, was etwas zeigen kann.
 * Die Bedingung ist bewusst hart — kein Namensmuster, keine Liste: was ein
 * Item findet, bleibt. Faellt ein kuenftiger Patch-Lauf hier hinein, sinkt die
 * Zahl und die Klinke `blueprints` in metrics-baseline.mjs meldet es.
 */
const hatItem = (b: Blueprint): boolean => {
  if (b.entity_guid && itemByGuid.has(b.entity_guid)) return true;
  return itemByName.has(b.name.toLowerCase());
};

export const blueprints: BlueprintEntry[] = (() => {
  const used = new Map<string, number>();
  return craftDb.blueprints
    .map((b, index) => {
      const base = slugify(b.name);
      const n = (used.get(base) ?? 0) + 1;
      used.set(base, n);
      return { ...b, index, slug: n > 1 ? `${base}-${n}` : base };
    })
    .filter(hatItem);
})();

/** Wie viele Bauplaene die Seite auslaesst, weil kein Item dahinter steht. */
export const blueprintsOhneItem = craftDb.blueprints.length - blueprints.length;

export const blueprintBySlug = new Map(blueprints.map((b) => [b.slug, b]));
/** Name (klein) -> Blueprint, fuer den Join Item <-> Rezept. */
export const blueprintByName = new Map(blueprints.map((b) => [b.name.toLowerCase(), b]));

/**
 * Beschriftungen fuer eine LISTE von Bauplaenen — mit Unterscheider dort, wo
 * derselbe Anzeigename mehrfach in DERSELBEN Liste steht.
 *
 * Anlass (Register id 49, gefunden 27.08.2026): die Bauplan-Liste der
 * Missionsseite zeigte zweimal `BroadSpec`, und die beiden Chips fuehrten auf
 * `/crafting/broadspec.html` und `/crafting/broadspec-2.html`. Der Slug war
 * eindeutig, die Beschriftung nicht — der Leser konnte nicht entscheiden,
 * welchen er will. Wieder derselbe Grundfehler: der Anzeigename ist kein
 * Schluessel.
 *
 * Unterschieden wird an der ersten Angabe, die WIRKLICH auseinandergeht:
 *   1. die Masse, wenn sie fuer alle Gleichnamigen vorliegt und paarweise
 *      verschieden ist (BroadSpec 590 kg vs. 220 kg — zwei echte Items);
 *   2. sonst eine laufende Nummer, die zum Slug passt (`… (2)` -> `…-2`).
 * Der zweite Fall trifft die Gruppen, die sich nur in den ZUTATEN
 * unterscheiden (FoxFire: gleiche guid, gleiche Werte, Torite statt Tungsten)
 * — zwei Wege zum selben Item. Deren Unterschied gehoert auf die Bauplanseite,
 * nicht in einen Chip.
 *
 * Namen, die nur EINMAL in der Liste stehen, bleiben unangetastet.
 * Zugesichert von verify-crafting-specs.mjs Pruefblock 10, je DE und EN.
 */
export function blueprintListLabels(list: Blueprint[], lang: Locale): string[] {
  const anzahl = new Map<string, number>();
  for (const b of list) anzahl.set(b.name, (anzahl.get(b.name) ?? 0) + 1);

  const lauf = new Map<string, number>();
  return list.map((b) => {
    if ((anzahl.get(b.name) ?? 0) < 2) return b.name;
    const n = (lauf.get(b.name) ?? 0) + 1;
    lauf.set(b.name, n);
    const massen = list.filter((x) => x.name === b.name).map((x) => x.item_stats?.mass_kg);
    const brauchbar = massen.every((m) => typeof m === 'number') && new Set(massen).size === massen.length;
    const m = b.item_stats?.mass_kg;
    if (brauchbar && typeof m === 'number')
      return `${b.name} · ${m.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')} kg`;
    return `${b.name} (${n})`;
  });
}

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


/**
 * Wurde das Item ueber den echten Schluessel gefunden?
 *
 * `entity_guid` ist die Record-Id der EntityClassDefinition und damit
 * eindeutig — trifft sie, ist zweifelsfrei das richtige Item gefunden, auch
 * wenn mehrere Blueprints denselben Anzeigenamen tragen. Gemessen 07.08.2026:
 * 1527 der 1594 Blueprints treffen so, 56 weitere nur noch ueber den Namen
 * (ihr Katalogeintrag fuehrt keine guid), 11 gar nicht.
 */
export function resolvedByGuid(b: Blueprint): boolean {
  return !!(b.entity_guid && itemByGuid.has(b.entity_guid));
}

/**
 * Das gecraftete Item im Katalog. **Zuerst ueber `entity_guid`** — ein echter
 * Schluessel —, und nur wenn der nichts findet, ueber den Anzeigenamen.
 *
 * Der Namensweg bleibt noetig, weil `assets/universal-items.json` seine
 * Eintraege selbst nach Namen zusammenfasst und dabei bei gleichnamigen Items
 * nur einen behaelt: von zwei gleichnamigen Blueprints trifft deshalb genau
 * einer seine guid. Er ist aber nur noch der Rueckfallweg, und wo er greift,
 * schuetzt die Sperre COLLIDING_NAMES.
 */
export function itemForBlueprint(b: Blueprint): Item | null {
  const byId = b.entity_guid ? itemByGuid.get(b.entity_guid) : undefined;
  if (byId) return byId.item;
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
  /**
   * Alle Groessen des Items — meist genau eine, bei mehrdeutigen Anzeigenamen
   * mehrere ("Revenant Gatling" ist S3, S4 und S6). Leer = unbekannt.
   * Kommt aus `itemSizes()` in items.ts; diese Schicht leitet nichts eigenes
   * ab, damit sie nicht wieder hinter dem Item-Datenblatt zurueckfaellt.
   */
  sizes: number[];
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
export function toneFromWeaponCategoryPath(category: string): string | null {
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
  // Die Sperre greift nur noch dort, wo ueber den Anzeigenamen gejoint werden
  // musste. Trifft die `entity_guid`, ist das Item zweifelsfrei bestimmt — dann
  // ist die Namensgleichheit belanglos und die Karte darf ihre Kennwerte zeigen.
  if (!resolvedByGuid(b) && COLLIDING_NAMES.has(b.name.toLowerCase())) return null;
  const item = itemForBlueprint(b);
  if (!item) return null;
  const g = item.game;
  // Trifft die guid GENAU EINE Ausfuehrung, ist das die praezisere Antwort:
  // dieses Rezept baut die S3, nicht "S3 / S4 / S6". Sonst alle Groessen aus
  // items.ts — nicht selbst aus g.size abgeleitet, sonst faellt diese Schicht
  // wieder hinter das Datenblatt zurueck.
  const treffer = b.entity_guid ? itemByGuid.get(b.entity_guid) : undefined;
  const v = treffer?.variant;
  const sizes = !hasGradeSemantics(item) ? [] : v ? [v.size] : itemSizes(item);
  // Grade nur, wo er im Spiel etwas unterscheidet — siehe hasMeaningfulGrade().
  const rohGrade = v ? v.grade : g?.grade;
  const grade = rohGrade && hasMeaningfulGrade(item) ? rohGrade : null;
  const tone = g?.class ?? toneFromWeaponCategoryPath(b.category);
  if (!sizes.length && grade == null && tone == null) return null;
  return { sizes, grade, tone };
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
