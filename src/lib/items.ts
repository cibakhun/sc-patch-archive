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
import { fassung } from './fassung';
import { AUSFUEHRUNGEN_JE_MODELL, modellName, waffenArt } from '../../scripts/lib/waffen-art.mjs';
import { setHersteller } from '../../scripts/lib/armor-sets.mjs';

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
  /**
   * Nur bei Shop-Zeilen aus dem kuratierten Shop-Schnappschuss
   * (assets/dismantling-items.json, greift nur ohne UEX-Treffer): "schnappschuss".
   * Ohne Feld kommt eine Shop- oder Haendlerzeile von UEX.
   */
  src?: 'schnappschuss';
  /**
   * Nur bei Loot-Zeilen mit bestaetigtem Fundort: Schluessel der Ortsart
   * (db.fundorte.arten, scripts/lib/loot-orte.mjs). Solche Zeilen stehen NICHT
   * in der Datei, sondern entstehen beim Laden aus `item.fund` (lootZeilen).
   * Loot-Zeilen ohne `ort` stammen aus der eigenen Recherche: unbestaetigt.
   */
  ort?: string;
  /** zu `ort`: deutscher Name der Ortsart (`loc` traegt den englischen) */
  locDe?: string;
  /** zu `ort`: System -> Himmelskoerper; '*' = im All, an keinem Koerper */
  wo?: Record<string, string[]>;
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

/**
 * Widerstaende: Ruestungen tragen je Kanal einen Schadens-MULTIPLIKATOR
 * (0.8 = 20 % weniger Schaden), Schilde eine Spanne [min, max] als ANTEIL
 * (0.25 = 25 % Widerstand) — so liest sie auch der Hangar (layouts.ts).
 */
export type ResistMap = { [K in keyof DamageMap]?: number | [number, number] };

export interface ItemStats {
  damage?: DamageMap;
  resist?: ResistMap;
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
  /* Flugblaetter (PHB/TSB): dieselben Flugwerte wie auf dem Schiffsblatt */
  scmSpeed?: number;
  maxSpeed?: number;
  boostForward?: number;
  pitch?: number;
  yaw?: number;
  roll?: number;
  [k: string]: unknown;
}

/** Eine von mehreren Ausführungen, die sich einen Anzeigenamen teilen. */
export interface ItemVariant {
  size: number;
  /**
   * Record-Id dieser Ausfuehrung. Erst damit kann ein Aufrufer, der ein
   * bestimmtes Spiel-Item meint, sagen WELCHE der Groessen seine ist — statt
   * nur "S3 / S4 / S6" zu sehen. Aeltere Snapshots fuehren sie nicht.
   */
  guid?: string | null;
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
  /**
   * Record-Ids gleichnamiger Geschwister, die `datamine-items.mjs` beim Dedupe
   * zusammengezogen hat — mitgefuehrt NUR, wo sie in Groesse, Grade und Klasse
   * mit diesem Eintrag uebereinstimmen (gemessen 07.08.2026: 265 Faelle, 501
   * Geschwister, davon 0 abweichend). Wer ueber eine dieser Ids sucht, meint
   * dieses Item; ohne sie ginge er leer aus.
   */
  guidAliases?: string[];
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
  /**
   * Nur Identitaet: das Spiel fuehrt das Item, aber in einer Art, deren Werte
   * die Extraktion nicht auswertet (Moebel, Pflanzen, Pluesch, Tankduesen …).
   * Name, Hersteller, Volumen und Beschreibung stammen aus dem Spiel; Werte
   * gibt es dazu keine (build-universal-db.mjs, IA C8 26.11.2026).
   */
  ohneWerte?: boolean;
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
  /** Index in db.fundorte.profile: bestaetigte Fundorte (scripts/apply-loot-fundorte.mjs) */
  fund?: number;
  /**
   * Kein Item im aktuellen Spielstand traegt diesen Namen — Preise oder
   * Fundorte nennen ihn trotzdem (build-universal-db.mjs, IA C8 26.11.2026).
   */
  nichtImSpiel?: boolean;
}

/** Bestaetigte Fundorte (scripts/lib/loot-orte.mjs wendeFundorteAn). */
export interface Fundorte {
  /** Spielstand des Datenlaufs, z. B. "sc-alpha-4.10.2@12913470" */
  patch: string;
  arten: Record<string, { de: string; en: string }>;
  systeme: Record<string, string>;
  /** je Profil: [Ortsart, {System: [Koerper…]}] in Anzeige-Reihenfolge */
  profile: Array<Array<[string, Record<string, string[]>]>>;
}

export interface ItemsDb {
  generator: string;
  generatedAt: string;
  /**
   * Spielstand der Extraktion, z. B. "4.10.0-live.12519617" — seit dem
   * Datenlauf auf 4.10.0 traegt die DB ihn selbst. Quelle von ITEM_PATCH.
   */
  gameVersion?: string;
  pricesAsOf: string;
  note?: string;
  sources?: unknown;
  counts: Record<string, number>;
  sets?: ArmorSet[];
  fundorte?: Fundorte;
  items: Item[];
}

export const db = DB as unknown as ItemsDb;
export const items = db.items;
export const fundorte: Fundorte | null = db.fundorte ?? null;

/* ---------- Bestaetigte Fundorte ---------- */

/**
 * Loot-Zeilen eines Fundort-Profils. `loc` traegt den englischen Namen der
 * Ortsart (Suche, Sortierung, Dedupe); angezeigt wird ueber obtainLabel() in
 * der Seitensprache. Zwilling: lootZeilen() in assets/item-finder-app.js.
 */
export function lootZeilen(fund: number | undefined): Obtain[] {
  const p = fund == null ? null : fundorte?.profile[fund];
  if (!p) return [];
  return p.map(([ort, wo]) => {
    const art = fundorte!.arten[ort];
    if (!art) throw new Error(`items.ts: Ortsart "${ort}" fehlt in db.fundorte.arten — npm run apply:loot-fundorte`);
    return { kind: 'loot' as const, loc: art.en, locDe: art.de, ort, wo };
  });
}

/**
 * Himmelskoerper einer bestaetigten Zeile als Text: „Stanton: Hurston,
 * microTech · Pyro: Pyro I". '*' wird zu `imAll` (Seitensprache).
 */
export function woText(wo: Record<string, string[]> | undefined, imAll: string): string {
  if (!wo) return '';
  return Object.entries(wo)
    .map(([sys, ks]) => `${fundorte?.systeme[sys] ?? sys}: ${ks.map((k) => (k === '*' ? imAll : k)).join(', ')}`)
    .join(' · ');
}

// Einmal beim Laden: bestaetigte Zeilen hinter die Kaufzeilen und VOR die
// uebrigen (Recherche, Exklusiv). So zeigen Karte, Kategorieliste und
// Datenblatt als erste Fundzeile immer die belegte.
// Idempotent: teilen sich zwei Bundle-Teile dasselbe JSON-Objekt, laeuft das
// hier zweimal ueber dieselben Items.
for (const i of items) {
  if (i.fund == null || i.obtain.some((o) => o.ort)) continue;
  const neu = lootZeilen(i.fund);
  if (!neu.length) continue;
  const preis = i.obtain.filter((o) => o.price != null);
  const rest = i.obtain.filter((o) => o.price == null);
  i.obtain = [...preis, ...neu, ...rest];
}
export const itemById = new Map(items.map((i) => [i.id, i]));

/* ---------- Ruestungs-Sets ---------- */

// Hersteller vereinheitlicht wie im Datenlauf (setHersteller, P85): ohne das
// stand derselbe Hersteller zweimal in der Sprungleiste, und „Unknown" war eine
// eigene Gruppe neben den Sets ohne Hersteller.
export const armorSets: ArmorSet[] = (db.sets ?? []).map((s) => ({ ...s, manufacturer: setHersteller(s.manufacturer) }));
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

/**
 * Sets nach Hersteller gruppiert (fuer die Set-Seite), groesste Gruppe zuerst;
 * die Sets ohne Hersteller stehen als letzte Gruppe (mfr: null), sonst waeren
 * sie mit 19 Sets die zweitgroesste.
 */
export const setsByManufacturer = (() => {
  const m = new Map<string | null, ArmorSet[]>();
  for (const s of armorSets) {
    const key = s.manufacturer || null;
    const list = m.get(key);
    if (list) list.push(s);
    else m.set(key, [s]);
  }
  return [...m.entries()]
    .map(([mfr, list]) => ({ mfr, sets: list.sort((a, b) => b.parts - a.parts || a.name.localeCompare(b.name, 'en')) }))
    .sort((a, b) => (a.mfr === null ? 1 : 0) - (b.mfr === null ? 1 : 0) || b.sets.length - a.sets.length || (a.mfr ?? '').localeCompare(b.mfr ?? '', 'en'));
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
  // Flugblaetter (PHB/TSB) tragen ihre Seite nur mit Bezugsweg oder Fundort.
  // Ohne Weg nennte die Seite sechs Flugwerte fuer ein Teil, das niemand
  // bekommt — Thin Content, und verify:bezugswege [10] (Decke ohneWeg) riss
  // (IA C8, 26.11.2026). Im Finder steht das Blatt trotzdem, mit Werten.
  if (g?.gameType === 'FlightController') return false;
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

/** Die Listenseite der Kategorie, auf der ein Item ohne eigene Seite namentlich steht (Seite 2 ff.: <slug>-<n>.html). */
export function kategorieSeiteVon(id: string): string | null {
  const i = itemById.get(id);
  const c = i ? categoryBySlug.get(categorySlug(i.category)) : undefined;
  if (!i || !c) return null;
  const seite = Math.floor(c.items.indexOf(i) / PER_PAGE) + 1;
  return `/items/category/${c.slug}${seite > 1 ? `-${seite}` : ''}.html`;
}

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

/**
 * Bezugsquellen fuer die Tabelle: guenstigste zuerst, dann bestaetigte
 * Fundorte in der Reihenfolge der Ortsarten, dann der Rest alphabetisch.
 */
export function sortedObtain(i: Item): Obtain[] {
  const reihe = new Map(i.obtain.map((o, n) => [o, n]));
  return [...i.obtain].sort((a, b) => {
    const pa = a.price ?? null;
    const pb = b.price ?? null;
    if (pa == null && pb == null) {
      if (a.ort && b.ort) return reihe.get(a)! - reihe.get(b)!;
      if (a.ort || b.ort) return a.ort ? -1 : 1;
      return a.loc.localeCompare(b.loc, 'en');
    }
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb || a.loc.localeCompare(b.loc, 'en');
  });
}

export const shopCount = (i: Item) =>
  i.obtain.filter((o) => o.kind === 'shop' || o.kind === 'vehicle').length;

/* ---------- Anzeige ---------- */

const NUM = { de: 'de-DE', en: 'en-US' } as const;
/** Zahl im Format der Seite. Ohne `maxFrac` hoechstens drei Nachkommastellen
 *  (Vorgabe von toLocaleString); Volumen braucht mehr ("0,0001 SCU"). */
export const num = (n: number, lang: Locale, maxFrac?: number) =>
  n.toLocaleString(NUM[lang], maxFrac == null ? undefined : { maximumFractionDigits: maxFrac });
export const auec = (n: number, lang: Locale) => `${num(n, lang)} aUEC`;

/**
 * Deutscher Item-Name aus den Spieldaten, falls er sich vom englischen
 * unterscheidet — auf beiden Sprachen der Zweitname, und die Suche findet das
 * Item unter beiden Namen. Seit der Sprachregel (Paket C4, docs/sprachregel.md)
 * ist der englische Name der Anzeigename, auch auf /de/.
 */
export function altName(i: Item, _lang?: Locale): string | null {
  const de = i.game?.nameDe?.trim();
  if (!de || de === i.name) return null;
  return de;
}

/**
 * Anzeigename: der englische Name, wie ihn der Client zeigt, in beiden
 * Sprachen (Sprachregel, Entscheidung E-Sprache 24.11.2026: Eigennamen aus
 * dem Spiel englisch; Spieler suchen mit dem Namen aus dem Spiel). Der
 * deutsche Name steht als Zweitname daneben (altName).
 */
export function displayName(i: Item, _lang?: Locale): string {
  return i.name;
}

/**
 * Spielbeschreibung in der Sprache der Seite (D-05, 04-CONTEXT.md).
 *
 * Fehlt `g.desc` (die englische Quelle), liefert diese Funktion `null` — IN
 * BEIDEN SPRACHEN, unabhaengig von `lang`. Grund: fuer 79 Items fehlt der
 * LOCID-Schluessel in CIGs eigener `Localization/english/global.ini`
 * VOLLSTAENDIG (nicht leer, nicht vorhanden); einen englischen Text zu
 * erzeugen waere eine Erfindung und ist durch die erste Regel in
 * scripts/datamine-items.mjs ausgeschlossen ("KEINE erfundenen Werte").
 * `descDe` gilt deshalb als UEBERSETZUNG eines vorhandenen `desc`, nicht als
 * eigenstaendige Quelle. Die Rueckfallrichtung bleibt unveraendert: existiert
 * `g.desc`, aber kein `g.descDe`, zeigt die DE-Seite weiterhin den
 * englischen Text (4.992 Items, harmlos, D-05 dreht das nicht um).
 */
export function description(i: Item, lang: Locale): string | null {
  const g = i.game;
  if (!g || !g.desc) return null;
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

/**
 * Groessen eines Items. Meist genau eine — hinter manchen Anzeigenamen stecken
 * aber mehrere Spiel-Items unterschiedlicher Groesse ("Revenant Gatling" gibt
 * es als S3, S4 und S6). Die tragen `sizes`; sich eine davon auszusuchen waere
 * geraten.
 *
 * Wohnt hier und nicht in itemStats.ts, weil mehrere Flaechen dieselbe Frage
 * stellen — Item-Datenblatt, Item Finder, Crafting-Karten. Vorher hatte jede
 * ihre eigene Fassung, und die schmaleren lasen nur `size`: die Crafting-Karte
 * zeigte deshalb bei den fuenf mehrdeutigen Items GAR NICHTS, obwohl das
 * Datenblatt "S3 / S4 / S6" konnte. Nicht neu implementieren — importieren.
 */
export function itemSizes(i: Item): number[] {
  const g = i.game;
  if (!g) return [];
  if (g.sizes?.length) return g.sizes;
  return g.size != null ? [g.size] : [];
}

/** "S4" bzw. "S3 / S4 / S6" — oder null, wenn keine Groesse bekannt ist. */
export function sizeLabel(i: Item): string | null {
  const s = itemSizes(i);
  return s.length ? s.map((n) => `S${n}`).join(' / ') : null;
}

/* ---------- Verwandte Items (interne Verlinkung) ---------- */

/**
 * Nachbarn fuer den "Aehnliche Items"-Block. Reihenfolge: gleiche Kategorie UND
 * gleicher Hersteller zuerst, dann gleiche Kategorie, dann gleicher Hersteller.
 * Rein deterministisch (Build-Reproduzierbarkeit) und immer aus pageItems, damit
 * kein Link auf eine nicht existierende Seite zeigt.
 *
 * Handwaffen ordnen zuerst nach ihrer Art (scripts/lib/waffen-art.mjs): die
 * gleiche Art wiegt mehr als Kategorie-Rest, Hersteller, Groesse und Preis
 * zusammen, also steht unter einem Gewehr kein fremdes Stueck vor einem
 * anderen Gewehr. Damit die Liste Alternativen zeigt statt zwoelf Lackierungen
 * derselben Waffe, kommt jedes Modell hoechstens AUSFUEHRUNGEN_JE_MODELL mal
 * vor (P64, 24.11.2026; geprueft von verify:bezugswege [14]).
 */
export function relatedItems(i: Item, limit = 12): Item[] {
  const mfr = i.game?.manufacturer;
  const art = waffenArt(i);
  const sameCat = categoryBySlug.get(categorySlug(i.category))?.items ?? [];
  const score = (o: Item) => {
    let s = 0;
    if (art && waffenArt(o) === art) s += 10;
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
  const sortiert = [...pool.values()].sort(
    (a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'en'),
  );
  if (!art) return sortiert.slice(0, limit);
  const jeModell = new Map<string, number>();
  const auswahl: Item[] = [];
  for (const o of sortiert) {
    if (auswahl.length >= limit) break;
    const modell = modellName(o.name);
    const n = jeModell.get(modell) ?? 0;
    if (n >= AUSFUEHRUNGEN_JE_MODELL) continue;
    jeModell.set(modell, n + 1);
    auswahl.push(o);
  }
  return auswahl;
}

/* ---------- Text-Helfer ---------- */

/** Auf max. `max` Zeichen kuerzen — an der Wortgrenze, mit Ellipse. */
export function clip(s: string, max = 160): string {
  const flat = String(s).replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/**
 * Spielstand, aus dem der Katalog stammt — die volle Fassung aus der
 * DB-Kennung ("4.10.3-live.13165946" -> "4.10.3"), wie craftPatch in
 * lib/crafting.ts. Item-Finder und Item-Seiten ziehen das Label von hier.
 * Fehlt die Kennung, bricht der Bau, statt einen alten Stand zu behaupten.
 *
 * Der VERWEIS auf die zugehoerige Patch-Seite gehoert NICHT hierher: sie ist
 * handgeschrieben und existiert nicht fuer jeden Datenstand. Dafuer gibt es
 * patchPageHref() in src/lib/patchPages.ts, das `null` liefert, wenn die Seite
 * fehlt. Die frueher hier stehende Konstante ITEM_PATCH_HREF war ungenutzt und
 * schrieb genau die Annahme fest, die am 27.08. zwei tote Verweise erzeugt hat.
 */
export const ITEM_PATCH = fassung(db.gameVersion, 'assets/universal-items.json gameVersion');
/** Volle Kennung des Item-Katalogs ("4.10.2-live.…") fuer patchLinkFromKennung(). */
export const ITEM_KENNUNG = db.gameVersion ?? null;

/* ---------- URLs (Basisform = EN-Pfad; href() praefixt DE) ---------- */

export const itemPath = (i: Item | string) =>
  `/items/${typeof i === 'string' ? i : i.id}.html`;

export const categoryPath = (c: CategoryNode | string, page = 1) => {
  const slug = typeof c === 'string' ? c : c.slug;
  return page > 1 ? `/items/category/${slug}-${page}.html` : `/items/category/${slug}.html`;
};

export const itemsHubPath = '/items.html';
