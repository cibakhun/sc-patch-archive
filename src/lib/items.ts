// Item-Snapshot + Helfer fuer die STATISCHEN Item-Seiten (/items/<id>.html).
//
// Warum es die Seiten gibt: der Item-Finder laedt assets/universal-items.json
// erst im Browser nach. Fuer Suchmaschinen existierte damit kein einziges Item —
// obwohl genau danach gesucht wird ("star citizen <item> price / where to buy").
// Diese Schicht liefert dieselben Daten build-time an echte HTML-Seiten.
//
// Die Typen stehen hier explizit und werden NICHT aus dem JSON abgeleitet: die
// Datei ist ~7 MB, `typeof import(...)` darauf macht den TS-Server zaeh (gleiche
// Begruendung wie in lib/missions.ts).

import DB from '../../assets/universal-items.json';
import type { Locale } from '../i18n/ui';

/* ---------- Typen (Spiegel von scripts/build-universal-db.mjs) ---------- */

export type ObtainKind = 'shop' | 'vehicle' | 'loot' | 'exclusive';

export interface Obtain {
  kind: ObtainKind;
  loc: string;
  /** aUEC; fehlt bei Loot-Fundorten */
  price?: number;
  /**
   * Nur bei `kind: 'exclusive'`: warum das Item nicht als Loot entstehen kann
   * (PromotionalItem, Concierge, TwitchDrop, InGameReward.Wikelo, …). Kommt aus
   * dem Spiel-Tag `LootGeneration.CannotGenerateAsLoot.*` — das ist die einzige
   * beweisbare Aussage darueber, ob ein Item ueberhaupt droppen kann.
   */
  reason?: string;
}

/** Schadens-/Widerstandswerte je Typ (nur gesetzte Kanaele stehen drin). */
export interface DamageMap {
  physical?: number;
  energy?: number;
  distortion?: number;
  thermal?: number;
  biochemical?: number;
  stun?: number;
}

export interface ItemStats {
  damage?: DamageMap;
  resist?: DamageMap;
  blastRadius?: number;
  fireRate?: number;
  dps?: number;
  magazine?: number;
  shieldHp?: number;
  regen?: number;
  driveSpeed?: number;
  cooldown?: number;
  coolingRate?: number;
  powerOutput?: number;
  fuelCapacity?: number;
  sensitivity?: number;
  jammerRange?: number;
  empRadius?: number;
  distortionDamage?: number;
  chargeTime?: number;
  tempMin?: number;
  tempMax?: number;
  radiation?: number;
  oxygen?: number;
  ndr?: number;
  effects?: string[];
  storageScu?: number;
  lifetime?: number;
  health?: number;
  [k: string]: unknown;
}

/** Eine von mehreren Ausführungen, die sich einen Anzeigenamen teilen. */
export interface ItemVariant {
  size: number;
  grade: string | null;
  manufacturer: string | null;
  stats: ItemStats | null;
}

export interface ItemGame {
  gameType?: string;
  subType?: string;
  size?: number;
  /** Größen ALLER Ausführungen dieses Namens — gesetzt statt `size`, wenn das
   *  Spiel mehrere unterschiedlich große Items so nennt ("Revenant Gatling"
   *  gibt es als S3, S4 und S6). Dann sind auch grade/manufacturer/stats leer
   *  und stehen stattdessen je Ausführung in `variants`. */
  sizes?: number[];
  variants?: ItemVariant[];
  grade?: string;
  class?: string;
  manufacturer?: string;
  manufacturerCode?: string;
  volumeScu?: number;
  stats?: ItemStats;
  desc?: string;
  descDe?: string;
  nameDe?: string;
  guid?: string;
  /* -- Tag-Facetten aus der spiel-eigenen Tag-Datenbank (scripts/lib/tags.mjs) -- */
  /** Panzerungsklasse: Undersuit | Light | Medium | Heavy | SuperHeavy | Flightsuit | FullSuit.* */
  weight?: string;
  /** Slot laut Spiel: Helmet | Arms | Core | Legs | Backpack | FullBody */
  part?: string;
  /** Common | Uncommon | Rare | Epic | Legendary */
  rarity?: string;
  archetype?: string;
  specialization?: string;
  color?: string;
  /** false = kann laut Spieldaten NIE als Loot entstehen (siehe Obtain.reason) */
  lootable?: boolean;
  lootReason?: string;
  /** Verweis in `db.sets` */
  setId?: string;
}

/** Ruestungs-Set (scripts/lib/armor-sets.mjs). `slots` bildet Slot -> Teilenamen ab. */
export interface ArmorSet {
  id: string;
  name: string;
  manufacturer: string | null;
  weight: string | null;
  /** woher der Set-Name stammt: short (global.ini) | prefix (Anzeigenamen) | tag */
  source: 'short' | 'prefix' | 'tag';
  parts: number;
  slots: Record<string, string[]>;
  /** wie viele der vier Kernslots (Helm/Core/Arme/Beine) das Set fuehrt */
  coreSlots: number;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  obtain: Obtain[];
  /** eigene Fundort-Recherche (Prosa) */
  guide?: string;
  game?: ItemGame;
}

export interface ItemsDb {
  generator: string;
  generatedAt: string;
  pricesAsOf: string;
  note?: string;
  sources?: unknown;
  counts: Record<string, number>;
  sets?: ArmorSet[];
  items: Item[];
}

export const db = DB as unknown as ItemsDb;
export const items = db.items;
export const itemById = new Map(items.map((i) => [i.id, i]));

/* ---------- Ruestungs-Sets ---------- */

export const armorSets: ArmorSet[] = db.sets ?? [];
export const armorSetById = new Map(armorSets.map((s) => [s.id, s]));

/** Alle Items eines Sets, nach Slot gruppiert — Reihenfolge wie im Anzug getragen. */
export const SLOT_ORDER = ['Helmet', 'Torso', 'Arms', 'Legs', 'Backpack', 'Undersuit'];

const bySet = (() => {
  const m = new Map<string, Item[]>();
  for (const i of items) {
    const sid = i.game?.setId;
    if (!sid) continue;
    const list = m.get(sid);
    if (list) list.push(i);
    else m.set(sid, [i]);
  }
  for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return m;
})();

export const setItems = (id: string): Item[] => bySet.get(id) ?? [];

/** Teile eines Sets nach Slot, in SLOT_ORDER; unbekannte Slots haengen hinten an. */
export function setItemsBySlot(id: string): Array<[slot: string, list: Item[]]> {
  const m = new Map<string, Item[]>();
  for (const i of setItems(id)) {
    const slot = (i.game?.gameType || '').replace(/^Char_Armor_/, '') || 'Other';
    const list = m.get(slot);
    if (list) list.push(i);
    else m.set(slot, [i]);
  }
  return [...m.entries()].sort((a, b) => {
    const ia = SLOT_ORDER.indexOf(a[0]), ib = SLOT_ORDER.indexOf(b[0]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a[0].localeCompare(b[0]);
  });
}

/** Sets nach Hersteller gruppiert (fuer die Set-Seite), groesste Gruppe zuerst. */
export const setsByManufacturer = (() => {
  const m = new Map<string, ArmorSet[]>();
  for (const s of armorSets) {
    const key = s.manufacturer || 'Unknown';
    const list = m.get(key);
    if (list) list.push(s);
    else m.set(key, [s]);
  }
  return [...m.entries()]
    .map(([mfr, list]) => ({ mfr, sets: list.sort((a, b) => b.parts - a.parts || a.name.localeCompare(b.name, 'en')) }))
    .sort((a, b) => b.sets.length - a.sets.length || a.mfr.localeCompare(b.mfr, 'en'));
})();

/* ---------- Was bekommt eine eigene Seite? ---------- */

/**
 * Qualitaets-Schwelle fuer eine EIGENE URL. Eine Detailseite muss mindestens
 * eine der drei Fragen beantworten koennen, die Leute tatsaechlich stellen:
 * "wo kaufe ich das" (obtain), "was kann das" (stats), "wo finde ich das"
 * (guide). Bleibt nur ein Katalogname mit Lore-Text (v. a. die 946 Lackierungen
 * und Deko-Eintraege), entstuenden tausende fast gleiche Seiten ohne Antwort —
 * klassischer Thin Content.
 *
 * Diese Items verschwinden NICHT: sie stehen weiter im Finder UND namentlich
 * auf der Kategorie-Liste (nur ohne eigenen Link), sind also indexierbar.
 */
export function isIndexable(i: Item): boolean {
  if (i.obtain.length > 0) return true;
  if (i.guide) return true;
  const g = i.game;
  // Mehrdeutige Anzeigenamen ("Revenant Gatling" = S3/S4/S6) tragen ihre Werte
  // NICHT oben, sondern je Ausfuehrung in `variants`. Sie beantworten "was kann
  // das" damit sogar ausfuehrlicher als ein einzelner Wertesatz — ohne diese
  // Zeile faelt genau die Gruppe durch die Schwelle, fuer die es die
  // Varianten-Sektion ueberhaupt gibt.
  if (g?.variants?.length) return true;
  return !!(g && g.stats && Object.keys(g.stats).length > 0);
}

/** Items mit eigener Detailseite, stabil alphabetisch sortiert. */
export const pageItems = items
  .filter(isIndexable)
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

export const pageItemIds = new Set(pageItems.map((i) => i.id));

/* ---------- Kategorien ---------- */

/** "Armour / Helmets" -> "Armour" */
export function rootCategory(cat: string): string {
  return (cat || 'Other').split('/')[0].trim() || 'Other';
}

/** "Armour / Helmets" -> "Helmets" (oder die Wurzel, wenn es keine gibt) */
export function leafCategory(cat: string): string {
  const parts = (cat || 'Other').split('/').map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || 'Other';
}

/**
 * Die Zweige ZWISCHEN Wurzel und Blatt: "Armour / Combat / Heavy" -> "Combat".
 *
 * Ohne sie ist eine Kategorie-Karte nicht identifizierbar: das Blueprint-
 * Verzeichnis zeigte unter "Armor" fuenfmal "Heavy" und viermal "Light"
 * untereinander (Combat/Hunter/Engineer/Explorer/Radiation …), das
 * Fahrzeug-Kapitel zweimal "Cannon" (Ballistic vs. Laser). Leer, wenn die
 * Kategorie nur zwei Ebenen hat — dann sagt schon die Abschnitts-
 * ueberschrift alles.
 */
export function midCategory(cat: string): string {
  const parts = (cat || '').split('/').map((s) => s.trim()).filter(Boolean);
  return parts.length > 2 ? parts.slice(1, -1).join(' · ') : '';
}

/** "Vehiclegear / Weapons / Guns" -> "vehiclegear-weapons-guns" */
export function categorySlug(cat: string): string {
  return (cat || 'Other')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface CategoryNode {
  /** voller Kategorie-String aus den Daten */
  cat: string;
  slug: string;
  root: string;
  leaf: string;
  items: Item[];
}

/**
 * Alle Blatt-Kategorien. Bewusst ueber ALLE Items (nicht nur pageItems): die
 * Listenseite ist der Ort, an dem auch ein Item ohne eigene URL namentlich —
 * und damit indexierbar — auftaucht.
 */
export const categories: CategoryNode[] = (() => {
  const by = new Map<string, Item[]>();
  for (const i of items) {
    const list = by.get(i.category);
    if (list) list.push(i);
    else by.set(i.category, [i]);
  }
  return [...by.entries()]
    .map(([cat, list]) => ({
      cat,
      slug: categorySlug(cat),
      root: rootCategory(cat),
      leaf: leafCategory(cat),
      items: list.sort((a, b) => a.name.localeCompare(b.name, 'en')),
    }))
    .sort((a, b) => a.cat.localeCompare(b.cat, 'en'));
})();

/** Zeilen pro Kategorie-Listenseite (danach wird geblaettert). */
export const PER_PAGE = 100;

export const pageCount = (c: CategoryNode) => Math.max(1, Math.ceil(c.items.length / PER_PAGE));

export const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

/** Wurzel-Kategorien mit Gesamtzahl + ihren Blaettern (fuer den Hub). */
export const roots = (() => {
  const by = new Map<string, CategoryNode[]>();
  for (const c of categories) {
    const list = by.get(c.root);
    if (list) list.push(c);
    else by.set(c.root, [c]);
  }
  return [...by.entries()]
    .map(([root, nodes]) => ({
      root,
      slug: categorySlug(root),
      nodes,
      count: nodes.reduce((n, c) => n + c.items.length, 0),
    }))
    .sort((a, b) => (a.root === 'Other' ? 1 : b.root === 'Other' ? -1 : b.count - a.count));
})();

/* ---------- Preise & Bezugsquellen ---------- */

/** Guenstigster echter Kaufpreis oder null (reine Loot-Items). */
export function minPrice(i: Item): number | null {
  let p = Infinity;
  for (const o of i.obtain) if (o.price != null && o.price > 0 && o.price < p) p = o.price;
  return p === Infinity ? null : p;
}

export function maxPrice(i: Item): number | null {
  let p = -Infinity;
  for (const o of i.obtain) if (o.price != null && o.price > 0 && o.price > p) p = o.price;
  return p === -Infinity ? null : p;
}

/**
 * Mittelwert ueber ALLE bepreisten Bezugsquellen (dieselbe Filterregel wie
 * minPrice/maxPrice: `price != null && price > 0`). `null` bei null Treffern —
 * NICHT 0. Eine 0 waere eine erfundene Aussage (das Item hat schlicht keinen
 * bekannten Kaufpreis, "0 aUEC" waere ein falscher Kaufpreis).
 */
export function avgPrice(i: Item): number | null {
  let sum = 0;
  let n = 0;
  for (const o of i.obtain) {
    if (o.price != null && o.price > 0) {
      sum += o.price;
      n++;
    }
  }
  return n === 0 ? null : Math.round(sum / n);
}

/** Bezugsquellen fuer die Tabelle: guenstigste zuerst, Loot ans Ende. */
export function sortedObtain(i: Item): Obtain[] {
  return [...i.obtain].sort((a, b) => {
    const pa = a.price ?? null;
    const pb = b.price ?? null;
    if (pa == null && pb == null) return a.loc.localeCompare(b.loc, 'en');
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb || a.loc.localeCompare(b.loc, 'en');
  });
}

export const shopCount = (i: Item) =>
  i.obtain.filter((o) => o.kind === 'shop' || o.kind === 'vehicle').length;

/* ---------- Anzeige ---------- */

const NUM = { de: 'de-DE', en: 'en-US' } as const;
export const num = (n: number, lang: Locale) => n.toLocaleString(NUM[lang]);
export const auec = (n: number, lang: Locale) => `${num(n, lang)} aUEC`;

/** Deutscher Item-Name aus den Spieldaten, falls er sich vom englischen unterscheidet. */
export function altName(i: Item, lang: Locale): string | null {
  const de = i.game?.nameDe?.trim();
  if (!de || de === i.name) return null;
  return lang === 'de' ? i.name : de;
}

/** Anzeigename in der Sprache der Seite (DE nutzt den Spieldaten-Namen). */
export function displayName(i: Item, lang: Locale): string {
  const de = i.game?.nameDe?.trim();
  return lang === 'de' && de ? de : i.name;
}

/** Spielbeschreibung in der Sprache der Seite. */
export function description(i: Item, lang: Locale): string | null {
  const g = i.game;
  if (!g) return null;
  const s = (lang === 'de' && g.descDe ? g.descDe : g.desc) ?? null;
  return s ? s.trim() : null;
}

/**
 * Groesse/Grade nur bei Ausruestung anzeigen: bei Kleidung und Nahrung ist
 * grade in den Spieldaten konstant "A" und size konstant 1 — das als "Grade A"
 * zu praesentieren waere eine erfundene Aussage. Gleiche Regel wie im Finder.
 */
export function hasGradeSemantics(i: Item): boolean {
  return /Vehiclegear|Weapons|Armour|Attachment/.test(rootCategory(i.category));
}

/**
 * Bauteilarten, bei denen der Grade tatsaechlich etwas unterscheidet.
 *
 * `hasGradeSemantics()` allein genuegt nicht: es urteilt ueber die Grob-
 * kategorie und laesst Waffen und Ruestung durch, wo `AttachDef.Grade` den
 * Vorgabewert 1 traegt, den `datamine-items.mjs` zu "A" macht. Gemessen am
 * Katalog (07.08.2026): `WeaponGun` 152x A, `WeaponPersonal` 381x A, Munition,
 * Mininglaser, Traktorstrahl und Bergung ebenso ausnahmslos A; Ruestung 886x A
 * gegen 3x B — und die drei sind alle "Aves"-Helme, eine Produktfamilie.
 * Einen Grade-Chip auf eine Dominance-1 Scattergun zu setzen behauptet eine
 * Einstufung, die es im Spiel nicht gibt.
 *
 * Echte Streuung gibt es nur bei den Bauteilen des Energie-Dreiecks:
 * Kraftwerk, Kuehler, Schild, Radar, Quantenantrieb verteilen sich sauber ueber
 * A/B/C/D.
 *
 * Abgeleitet wird das aus den Daten, nicht aus einer Handliste — sonst faellt
 * eine kuenftige Aenderung still durch. Eine Bauteilart zaehlt als
 * gradetragend, wenn mindestens zwei Grades vorkommen UND der seltenste davon
 * mindestens ein Zehntel der Art ausmacht. Der zweite Teil trennt echte
 * Streuung von Datenmarotten: die fuenf liegen bei 17,6 bis 25 %, die
 * Ausreisser (947 Lackierungen mit 6x B, 613 Helme mit 13x B) bei 0,6 bis
 * 2,1 %. Dazwischen klafft der Faktor acht; jede Schwelle zwischen 5 und 15 %
 * liefert dasselbe Ergebnis.
 *
 * Ruestung faellt damit heraus. Sie hat sehr wohl eine Abstufung, aber eine
 * andere Achse — Light/Medium/Heavy, und die steht bereits in `game.weight`
 * bzw. im Kategorie-Pfad.
 *
 * ⚠ Gespiegelt in `assets/item-finder-app.js` (clientseitiges Rendern) und in
 * `scripts/verify-crafting-specs.mjs` (Datengatter). Aendert sich die Regel
 * hier, muessen beide nachgezogen werden.
 */
export const GRADE_BEARING_TYPES: Set<string> = (() => {
  const byType = new Map<string, Map<string, number>>();
  for (const it of items) {
    const t = it.game?.gameType;
    const gr = it.game?.grade;
    if (!t || !gr) continue;
    let m = byType.get(t);
    if (!m) byType.set(t, (m = new Map()));
    m.set(gr, (m.get(gr) ?? 0) + 1);
  }
  const bearing = new Set<string>();
  for (const [type, counts] of byType) {
    if (counts.size < 2) continue;
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (Math.min(...counts.values()) / total >= 0.1) bearing.add(type);
  }
  return bearing;
})();

/**
 * Traegt dieses Item einen Grade, der etwas aussagt? Verbindet die Grob-
 * kategorie-Regel mit der gemessenen Streuung je Bauteilart.
 */
export function hasMeaningfulGrade(i: Item): boolean {
  const t = i.game?.gameType;
  return hasGradeSemantics(i) && !!t && GRADE_BEARING_TYPES.has(t);
}

/* ---------- Verwandte Items (interne Verlinkung) ---------- */

/**
 * Nachbarn fuer den "Aehnliche Items"-Block. Reihenfolge: gleiche Kategorie UND
 * gleicher Hersteller zuerst, dann gleiche Kategorie, dann gleicher Hersteller.
 * Rein deterministisch (Build-Reproduzierbarkeit) und immer aus pageItems, damit
 * kein Link auf eine nicht existierende Seite zeigt.
 */
export function relatedItems(i: Item, limit = 12): Item[] {
  const mfr = i.game?.manufacturer;
  const sameCat = categoryBySlug.get(categorySlug(i.category))?.items ?? [];
  const score = (o: Item) => {
    let s = 0;
    if (o.category === i.category) s += 4;
    if (mfr && o.game?.manufacturer === mfr) s += 3;
    if (i.game?.size != null && o.game?.size === i.game.size) s += 1;
    if (minPrice(o) != null) s += 1;
    return s;
  };
  const pool = new Map<string, Item>();
  for (const o of sameCat) if (o.id !== i.id) pool.set(o.id, o);
  if (mfr && pool.size < limit * 3) {
    for (const o of pageItems) {
      if (o.id === i.id || pool.has(o.id)) continue;
      if (o.game?.manufacturer === mfr) pool.set(o.id, o);
      if (pool.size >= limit * 4) break;
    }
  }
  return [...pool.values()]
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'en'))
    .slice(0, limit);
}

/* ---------- Text-Helfer ---------- */

/** Auf max. `max` Zeichen kuerzen — an der Wortgrenze, mit Ellipse. */
export function clip(s: string, max = 160): string {
  const flat = String(s).replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/**
 * Spielstand, aus dem der Katalog stammt. universal-items.json traegt selbst
 * keine Versionsnummer (die Extraktion laeuft gegen die installierte Data.p4k),
 * deshalb steht das Label hier an EINER Stelle — Item-Finder und Item-Seiten
 * ziehen es von hier, statt "4.9" mehrfach zu tippen.
 */
export const ITEM_PATCH = '4.9';
export const ITEM_PATCH_HREF = `/patches/sc-${ITEM_PATCH.replace(/\./g, '-')}-0.html`;

/* ---------- URLs (Basisform = EN-Pfad; href() praefixt DE) ---------- */

export const itemPath = (i: Item | string) =>
  `/items/${typeof i === 'string' ? i : i.id}.html`;

export const categoryPath = (c: CategoryNode | string, page = 1) => {
  const slug = typeof c === 'string' ? c : c.slug;
  return page > 1 ? `/items/category/${slug}-${page}.html` : `/items/category/${slug}.html`;
};

export const itemsHubPath = '/items.html';
