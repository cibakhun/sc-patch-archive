// Die Daten der Layout-Werkstatt im Hangar: welche Slots jedes Schiff zum
// Tauschen anbietet und welche Bauteile hineinpassen. Gebaut einmal je Build
// und ausgeliefert als /hangar-layouts.json (src/pages/hangar-layouts.json.ts);
// die Hangarseite nennt die Datei mit ?v=<Inhalts-Hash> (layoutDataHref), weil
// nginx JSON einen Tag lang cacht.
//
// EIN Format fuer beide Sprachen: jedes Bauteil traegt seinen englischen und,
// wo er abweicht, seinen deutschen Namen. Die Datei waechst damit nicht mit
// den Sprachen, und ein geteilter Link meint in beiden dasselbe Bauteil.
//
// Tauschbar ist, was ein Spieler am Terminal tauscht und was der Katalog mit
// Zahlen kennt: Waffen des Piloten und bemannter oder ferngesteuerter Tuerme,
// Raketen, Torpedos und Bomben je Halterung, Generator, Kuehler, Schild,
// Quantum-Antrieb, Radar. Taeuschkoerper und Tanks sind im Spiel fest
// verbaut; Punktverteidigung und Bergbaulaser bleiben in Serie. Passend
// heisst: dieselbe Art und dieselbe Groesse wie das Serienteil. Bei Raketen
// ist die Art der Untertyp des Spiels (Rakete, Torpedo, Bodenrakete, Bombe):
// in eine Halterung kommt, was ihr Serienteil ist, nur ein anderes Modell.
//
// Neben dem Kennwert traegt jedes Bauteil seine weiteren Zahlen (Schaden je
// Art, Feuerrate, Magazin, Schildaufladung, Haltbarkeit, Preis); die Ansicht
// "Alle Werte" der Werkstatt zeigt sie je Teil und summiert sie je Layout.

import { createHash } from 'node:crypto';
import hangarAssets from '../../data/hangar-assets.json';
import { items, type Item, type ItemStats } from '../items';
import { HANGAR_IDS } from './catalog';
import { shipGeometry, type StockItem } from './ports';

/** Art eines tauschbaren Slots. Die Werkstatt waehlt danach Gruppe, Kennwert und Kandidaten. */
export type LayoutType = 'gun' | OrdnanceType | 'power' | 'cooler' | 'shield' | 'quantum' | 'radar';
/** Raketen und ihre Verwandten, getrennt nach dem Untertyp des Spiels (gmissile: Rakete fuer Bodenfahrzeuge). */
export type OrdnanceType = 'missile' | 'torpedo' | 'gmissile' | 'bomb';
/** Gruppe in der Werkstatt, dieselben Schluessel wie die Gruppen der Bucht (bay.ts GroupKey). */
export type LayoutGroup = 'pilot' | 'manned' | 'remote' | 'missile' | 'bomb' | 'power' | 'cooler' | 'shield' | 'quantum' | 'radar';

const CATEGORY: Readonly<Record<string, LayoutType>> = {
  'Vehiclegear / Weapons / Guns': 'gun',
  'Vehiclegear / Powerplant': 'power',
  'Vehiclegear / Cooler': 'cooler',
  'Vehiclegear / Shield': 'shield',
  'Vehiclegear / Quantumdrive': 'quantum',
  'Vehiclegear / Radar': 'radar',
};
const ORDNANCE: Readonly<Record<string, OrdnanceType>> = { Missile: 'missile', Torpedo: 'torpedo', GroundVehicleMissile: 'gmissile' };
const isOrdnance = (t: LayoutType): t is OrdnanceType => t === 'missile' || t === 'torpedo' || t === 'gmissile' || t === 'bomb';

/** Art eines Katalog-Items; Raketen und Torpedos nach Untertyp, nicht nach Ordner (Reaper V ist ein Torpedo). */
function itemType(it: Item): LayoutType | null {
  const c = CATEGORY[it.category];
  if (c) return c;
  if (/^Vehiclegear \/ Weapons \/ (Missiles|Torpedoes)$/.test(it.category)) return ORDNANCE[it.game?.subType ?? ''] ?? null;
  return it.category === 'Vehiclegear / Weapons / Bombs' ? 'bomb' : null;
}

/**
 * Ein Bauteil in einer Groesse, als Tupel, damit die Datei klein bleibt:
 *   [nameEn, nameDe|0, art, groesse, hersteller|0, klasse|0, grade|0, kennwert|0, extra, preis|0]
 * kennwert: DPS (Waffe), Schaden (Rakete, Torpedo, Bombe), Leistung, Kuehlrate,
 * Schild-HP, Quantum Mm/s, Empfindlichkeit.
 * extra: zusaetzliche Zahlen fuer spaetere Kennwerte, nur gesetzte Schluessel.
 * preis: niedrigster Ladenpreis in aUEC.
 */
export type LayoutItem = readonly [
  nameEn: string, nameDe: string | 0, type: LayoutType, size: number,
  maker: string | 0, cls: string | 0, grade: string | 0, figure: number | 0,
  extra: Readonly<Record<string, number | string>>, price: number | 0,
  // 1: Spieler kommen irgendwie dran (Laden, Beute, Belohnung, Fahrzeug,
  // exklusiv); 0: keine bekannte Quelle, meist an ein Fahrzeug gebunden
  // (Reign-3 nur am Storm). Die Kampfwerte der Werkstatt messen nur daran.
  source: 1 | 0,
];

/**
 * Ein tauschbarer Slot: [schluessel, art, groesse, serienteil|0, gruppe, anzahl, halter?].
 * schluessel = Portname ohne 'hardpoint_', bei mehreren Items im Port mit '.<i>'.
 * Er ist patch-stabil wie der Portname und steht so im geteilten Link.
 * halter: nur an Raketenports mit Wahl, die Halterungen, die das Spiel dort
 * erlaubt (Schluessel in racks), die Serienhalterung zuerst.
 */
export type LayoutSlot = readonly [key: string, type: LayoutType, size: number, stock: string | 0, group: LayoutGroup, count: number, racks?: readonly string[]];

/**
 * Eine Raketenhalterung: [nameEn, nameDe|0, groesse, plaetze, raketengroesse, art, hersteller|0, preis|0].
 * art: was die Werkstatt in ihre Plaetze anbietet (Untertyp wie bei LayoutItem).
 */
export type LayoutRack = readonly [nameEn: string, nameDe: string | 0, size: number, n: number, ms: number, type: OrdnanceType, maker: string | 0, price: number | 0];

export interface LayoutData {
  readonly v: 1;
  readonly items: Readonly<Record<string, LayoutItem>>;
  readonly ships: Readonly<Record<string, readonly LayoutSlot[]>>;
  /** 3D-Modell je Bordwaffe (Schluessel wie items, URL mit ?v=): der Hangar setzt sie getauscht ans Schiff. */
  readonly models: Readonly<Record<string, string>>;
  /** Lackierungen je Schiff (nur Schiffe mit mindestens einer); fehlt die Datendatei, leer. */
  readonly paints: Readonly<Record<string, ShipPaints>>;
  /** Raketenhalterungen, die an mindestens einem Port eine Wahl bieten; fehlt die Datendatei, leer. */
  readonly racks: Readonly<Record<string, LayoutRack>>;
}

/**
 * Lackierungen eines Schiffs: base = Serienpalette [Haupt, Zweit, Akzent] als
 * #rrggbb, list = [kennung, name, haupt, zweit, akzent, muster 1|0]. muster:
 * die Lackierung bringt eigene Texturen mit, die Vorschau zeigt nur ihre Farben.
 */
export interface ShipPaints {
  readonly base: readonly [string, string, string];
  readonly list: readonly (readonly [id: string, name: string, a: string, b: string, c: string, pattern: 1 | 0])[];
}

// Optional: src/data/ship-paints.json entsteht auf dem Rechner mit den
// Spieldaten (npm run datamine:paints). Ohne die Datei baut die Seite weiter,
// die Werkstatt zeigt dann keinen Reiter Lackierung.
type PaintRow = { id: string; name: string; a: string; b: string; c: string; pattern?: boolean };
type PaintFile = { ships?: Record<string, { base: { a: string; b: string; c: string }; paints: PaintRow[] }> };
const PAINT_FILE = (Object.values(import.meta.glob('../../data/ship-paints.json', { eager: true, import: 'default' }))[0] ?? {}) as PaintFile;
const HEX = /^#[0-9a-f]{6}$/;

// Optional wie die Lackierungen: src/data/ship-missile-racks.json entsteht auf
// dem Rechner mit den Spieldaten (npm run datamine:racks). Je Raketenport die
// Serienhalterung und die Halterungen, die das Spiel dort erlaubt (fit: Typ,
// Groesse und Tags wie im Spiel), je Halterung Plaetze, Raketengroesse und
// erlaubte Munition. locked: das Spiel sperrt den Port (die Halterung bleibt,
// die Raketen darin nicht). Ports unter einem Traeger (Turm, Modul) heissen
// '<schiffsport>/<traegerport>'. Ohne die Datei bleiben die Halterungen in
// Serie, die Raketen darin sind trotzdem tauschbar.
type RackPort = { rack?: string; fit?: string[]; locked?: boolean };
type RackRow = { name?: string; size?: number; n?: number; ms?: number; types?: string[] };
type RackFile = { ships?: Record<string, Record<string, RackPort>>; racks?: Record<string, RackRow> };
const RACK_FILE = (Object.values(import.meta.glob('../../data/ship-missile-racks.json', { eager: true, import: 'default' }))[0] ?? {}) as RackFile;
const RACK_CATEGORIES = new Set(['Vehiclegear / Weapons / Missile Racks', 'Vehiclegear / Weapons / Bomb Racks']);

/** Munitionstypen des Spiels (Port-Typ 'Missile.Torpedo', 'Bomb', ...) als Arten der Werkstatt; ohne Untertyp jede Rakete. */
function ammoTypes(types: readonly string[] | undefined): Set<OrdnanceType> {
  const out = new Set<OrdnanceType>();
  for (const t of types ?? []) {
    const [main, sub] = String(t).split('.');
    if (/^bomb/i.test(main)) out.add('bomb');
    else if (/^missile$/i.test(main)) {
      if (!sub || /^(missile|undefined)$/i.test(sub)) out.add('missile');
      if (!sub || /^torpedo$/i.test(sub)) out.add('torpedo');
      if (!sub || /^groundvehiclemissile$/i.test(sub)) out.add('gmissile');
    }
  }
  return out;
}

type WeaponAsset = { url: string; v: string; key?: string };
const WEAPON_MODELS = ((hangarAssets as unknown as { weapons?: Record<string, WeaponAsset> }).weapons) ?? {};

const norm = (s: string) => s.toLowerCase().replace(/["'`„“”‚‘’]/g, '').replace(/\s+/g, ' ').trim();
const PLACEHOLDER = /placeholder|<=|=>|\bTBD\b/i;
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Art und Gruppe eines Serienteils; bei Raketen entscheidet das Katalog-Item (stock) die Art. */
function typeOf(it: StockItem, stock: LayoutItem | undefined): { type: LayoutType; group: LayoutGroup } | null {
  switch (it.cat) {
    case 'weapon':
      if (it.carrier !== 'turret') return { type: 'gun', group: 'pilot' };
      if (it.turretKind === 'pdc') return null;
      return { type: 'gun', group: it.turretKind === 'remote' ? 'remote' : 'manned' };
    case 'missile':
      if (!stock || !isOrdnance(stock[2])) return null;
      return { type: stock[2], group: stock[2] === 'bomb' ? 'bomb' : 'missile' };
    case 'power': case 'cooler': case 'shield': case 'quantum': case 'radar':
      return { type: it.cat, group: it.cat };
    default:
      return null;
  }
}

/** Verfolgungssignal aus der englischen Beschreibung ("Tracking Signal: Infrared"); i, e, c oder null. */
function tracking(desc: string | undefined): 'i' | 'e' | 'c' | null {
  const m = /Tracking Signal:\s*([^\n]+)/i.exec(desc ?? '')?.[1] ?? '';
  return /^inf/i.test(m) ? 'i' : /^electro/i.test(m) ? 'e' : /^cross/i.test(m) ? 'c' : null;
}

/** Schaden aller Kanaele zusammen, wie der Kennwert der Bucht (bay.ts totalDamage). */
const totalDamage = (s: ItemStats): number => Object.values(s.damage ?? {}).reduce((a, b) => a + (typeof b === 'number' && b > 0 ? b : 0), 0);

/** Der Kennwert der Werkstatt und die Zahlen fuer spaeter, je Art. */
function figures(type: LayoutType, s: ItemStats, it: Item): { f: number | 0; x: Record<string, number | string> } {
  const x: Record<string, number | string> = {};
  const put = (k: string, v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) x[k] = r1(v); };
  // Fuer den Reiter "Erweitert": Haltbarkeit jedes Teils, Schaden je Art je
  // Schuss bzw. Sprengkopf (dP physisch, dE Energie, dD Distortion, dT thermisch).
  put('hp', s.health);
  const dm = s.damage ?? {};
  for (const [k, short] of [['physical', 'dP'], ['energy', 'dE'], ['distortion', 'dD'], ['thermal', 'dT']] as const) {
    if ((dm[k] ?? 0) > 0) put(short, dm[k]);
  }
  switch (type) {
    case 'missile': case 'torpedo': case 'gmissile': case 'bomb': {
      const trk = tracking(it.game?.desc);
      if (trk) x.trk = trk;
      put('blast', s.blastRadius);
      put('arm', s.armTime);
      put('ign', s.igniteTime);
      put('life', s.lifetime);
      return { f: Math.round(totalDamage(s)), x };
    }
    case 'gun': {
      const d = s.damage ?? {};
      const ch = (['physical', 'energy', 'distortion'] as const).filter((k) => (d[k] ?? 0) > 0)
        .sort((a, b) => (d[b] ?? 0) - (d[a] ?? 0))[0];
      if (ch) x.dt = ch === 'physical' ? 'p' : ch === 'energy' ? 'e' : 'd';
      put('rate', s.fireRate);
      put('mag', s.magazine);
      return { f: s.dps ? Math.round(s.dps) : 0, x };
    }
    case 'power': return { f: s.powerOutput ?? 0, x };
    case 'cooler': return { f: s.coolingRate ?? 0, x };
    case 'shield':
      put('regen', s.regen); put('dly', s.damagedRegenDelay); put('down', s.downedRegenDelay);
      return { f: s.shieldHp ?? 0, x };
    case 'quantum':
      put('cd', s.cooldown); put('fuel', typeof s.fuelPerGm === 'number' ? s.fuelPerGm * 1000 : undefined);
      // Beschleunigung in Mm/s² wie die Geschwindigkeit in Mm/s
      put('a1', typeof s.stageOneAccel === 'number' ? s.stageOneAccel / 1e6 : undefined);
      put('a2', typeof s.stageTwoAccel === 'number' ? s.stageTwoAccel / 1e6 : undefined);
      return { f: s.driveSpeed ? Math.round(s.driveSpeed / 1e6) : 0, x };
    case 'radar': return { f: s.sensitivity ?? 0, x };
  }
}

const shopPrice = (it: Item): number | 0 => {
  const p = it.obtain.filter((o) => o.kind === 'shop' && typeof o.price === 'number' && o.price > 0).map((o) => o.price as number);
  return p.length ? Math.min(...p) : 0;
};

let memo: { data: LayoutData; json: string; hash: string } | null = null;

function build(): LayoutData {
  // Katalog: je Art und Groesse ein Eintrag; Namen mit mehreren Groessen
  // bekommen je Groesse einen eigenen Schluessel '<id>~<groesse>'.
  const out: Record<string, LayoutItem> = {};
  const byName = new Map<string, Map<number, string>>();
  for (const it of items) {
    const type = itemType(it);
    if (!type || PLACEHOLDER.test(it.name)) continue;
    const g = it.game ?? {};
    const variants = g.variants?.length
      ? g.variants.map((v) => ({ size: v.size, grade: v.grade, maker: v.manufacturer, stats: v.stats, key: `${it.id}~${v.size}` }))
      : [{ size: g.size, grade: g.grade ?? null, maker: g.manufacturer ?? null, stats: g.stats ?? null, key: it.id }];
    for (const v of variants) {
      // Groesse 0 sind Fahrzeug- und Bodenteile; sie passen in keinen Schiffsslot.
      if (typeof v.size !== 'number' || v.size < 1 || !v.stats) continue;
      const { f, x } = figures(type, v.stats, it);
      if (!f) continue;
      const de = g.nameDe?.trim();
      out[v.key] = [it.name, de && de !== it.name ? de : 0, type, v.size, v.maker || 0, g.class || 0, v.grade || 0, f, x, shopPrice(it), it.obtain.length || g.lootable ? 1 : 0];
      const n = norm(it.name);
      const sizes = byName.get(n) ?? new Map<number, string>();
      if (!sizes.has(v.size)) sizes.set(v.size, v.key);
      byName.set(n, sizes);
    }
  }

  // Halterungen aus dem Katalog: deutscher Name, Hersteller, Ladenpreis.
  const rackCat = new Map<string, Item>();
  for (const it of items) if (RACK_CATEGORIES.has(it.category)) rackCat.set(norm(it.name), it);
  // Das Spiel vergibt Namen locker: "MSD-481 Missile Rack" heisst auch eine
  // Halterung mit 8x S3, "Missile Rack" ist bei Kruger 4x S1 und an der
  // Aurora 1x S2. Der Katalogeintrag (deutscher Name, Ladenpreis) gilt nur
  // fuer die Klasse, deren Belegung er nennt ("Missiles: 2xS2"); nennt er
  // keine, nur wenn der Name eindeutig ist. Jede andere Klasse bekommt ihren
  // eigenen Schluessel ohne Katalogdaten.
  const sigs = new Map<string, Set<string>>();
  for (const r of Object.values(RACK_FILE.racks ?? {})) {
    if (!r?.name) continue;
    const n = norm(r.name);
    sigs.set(n, (sigs.get(n) ?? new Set()).add(`${r.size}|${r.n}|${r.ms}|${[...(r.types ?? [])].sort().join(',')}`));
  }
  const capOf = (it: Item): string | null => {
    const d = it.game?.desc ?? '';
    const m = /\b(\d+)\s*x\s*S0?(\d+)\b/i.exec(d) ?? /\bcarries\s+(\d+)\s+S(\d+)\b/i.exec(d);
    return m ? `${Number(m[1])}|${Number(m[2])}` : null;
  };
  const catFor = (r: RackRow): Item | undefined => {
    const it = rackCat.get(norm(r.name ?? ''));
    if (!it) return undefined;
    const cap = capOf(it);
    if (cap) return cap === `${r.n}|${r.ms}` ? it : undefined;
    return sigs.get(norm(r.name ?? ''))?.size === 1 ? it : undefined;
  };
  const pool = new Set(Object.values(out).map((x) => `${x[2]}|${x[3]}`));
  const racks: Record<string, LayoutRack> = {};
  const ORDER: readonly OrdnanceType[] = ['missile', 'torpedo', 'gmissile', 'bomb'];
  /**
   * Halterung der Spieldatei als Eintrag der Werkstatt; null, wenn ihre
   * Plaetze nichts aus dem Katalog aufnehmen. Nimmt sie mehrere Arten, gilt
   * die des Serienteils (want), sonst die erste; jede weitere Art bekommt
   * einen eigenen Schluessel '<halter>~<art>', damit ein Schluessel genau
   * eine Art meint.
   */
  function rackOf(cls: string, want: OrdnanceType): string | null {
    const r = RACK_FILE.racks?.[cls];
    // Ohne Namen im Spiel traegt die Datei die Klasse; die zeigt die Werkstatt nicht.
    if (!r?.name || /^[A-Za-z0-9]+_[A-Za-z0-9_]+$/.test(r.name) || !Number.isInteger(r.n) || !Number.isInteger(r.ms) || (r.n as number) < 1 || (r.ms as number) < 1) return null;
    const ok = ammoTypes(r.types);
    const accepted = ORDER.filter((t) => ok.has(t) && pool.has(`${t}|${r.ms}`));
    if (!accepted.length) return null;
    const type = accepted.includes(want) ? want : accepted[0];
    const cat = catFor(r);
    const key = (cat?.id ?? cls.toLowerCase().replace(/[^a-z0-9._-]/g, '-')) + (type === accepted[0] ? '' : `~${type}`);
    if (!racks[key]) {
      const de = cat?.game?.nameDe?.trim();
      racks[key] = [r.name, de && de !== r.name ? de : 0, typeof r.size === 'number' ? r.size : 0, r.n as number, r.ms as number, type, cat?.game?.manufacturer || 0, cat ? shopPrice(cat) : 0];
    }
    return key;
  }
  /**
   * Die Halterungen eines Raketenports, Serie zuerst; undefined ohne Wahl,
   * an einem gesperrten Port oder wenn die Serie nicht zum Loadout passt.
   * Ein Port unter einem Traeger zaehlt, wenn er der einzige Raketenport
   * darunter ist.
   */
  function rackChoice(id: string, port: string, type: OrdnanceType, size: number, count: number): string[] | undefined {
    const all = RACK_FILE.ships?.[id] ?? {};
    const under = Object.keys(all).filter((k) => k.startsWith(`${port}/`));
    const p = all[port] ?? (under.length === 1 ? all[under[0]] : undefined);
    const stock = p?.rack ? RACK_FILE.racks?.[p.rack] : undefined;
    // Datenstand der Halterungen und des Loadouts muessen zusammenpassen.
    if (!p?.rack || p.locked || !stock || stock.n !== count || stock.ms !== size) return undefined;
    const first = rackOf(p.rack, type);
    if (!first || racks[first][5] !== type) return undefined;
    // Die Serie steht in fit nicht immer (das Spiel prueft Serien-Loadouts nicht): rack und fit zusammen.
    // Gleiche Halterungen unter zwei Klassen (MSD-322 und seine Meteor-Fassung) bieten sich einmal an.
    const same = (k: string) => JSON.stringify(racks[k].slice(0, 6));
    const seen = new Set([same(first)]);
    const rest: string[] = [];
    for (const c of p.fit ?? []) {
      const k = c === p.rack ? null : rackOf(c, type);
      if (!k || seen.has(same(k))) continue;
      seen.add(same(k));
      rest.push(k);
    }
    return rest.length ? [first, ...rest] : undefined;
  }

  // Slots: je Schiff die tauschbaren Items in Loadout-Reihenfolge.
  const ships: Record<string, LayoutSlot[]> = {};
  for (const id of HANGAR_IDS) {
    const slots: LayoutSlot[] = [];
    for (const port of shipGeometry(id).ports) {
      const base = port.name.replace(/^hardpoint_/, '');
      // Halterungen nur, wo eine einzige Rakete im Port sitzt: eine gemischte
      // Serienbelegung (Buccaneer) hat keinen Slot, der die Halterung traegt.
      const ordnance = port.items.filter((x) => x.cat === 'missile').length;
      port.items.forEach((it, i) => {
        if (typeof it.size !== 'number' || it.size < 1) return;
        const stock = it.name ? byName.get(norm(it.name))?.get(it.size) : undefined;
        const t = typeOf(it, stock ? out[stock] : undefined);
        if (!t) return;
        // Eine Waffe, die der Katalog nicht als Bordwaffe fuehrt (Bergbau-,
        // Bergungs- oder Traktorlaser), ist kein Slot der Werkstatt; eine
        // Rakete ohne Katalog-Item hat schon in typeOf keine Art.
        if (!stock && t.type === 'gun') return;
        if (stock && out[stock][2] !== t.type) return;
        const key = port.items.length > 1 ? `${base}.${i}` : base;
        const rk = ordnance === 1 && isOrdnance(t.type) ? rackChoice(id, port.name, t.type, it.size, it.count) : undefined;
        slots.push(rk ? [key, t.type, it.size, stock ?? 0, t.group, it.count, rk] : [key, t.type, it.size, stock ?? 0, t.group, it.count]);
      });
    }
    if (slots.length) ships[id] = slots;
  }

  // Nur Bauteile, die in mindestens einen Slot passen: die Datei traegt keine
  // Teile, die niemand einbauen kann.
  const fits = new Set<string>();
  for (const slots of Object.values(ships)) for (const s of slots) fits.add(`${s[1]}|${s[2]}`);
  for (const r of Object.values(racks)) fits.add(`${r[5]}|${r[4]}`);
  const used: Record<string, LayoutItem> = {};
  for (const k of Object.keys(out).sort()) if (fits.has(`${out[k][2]}|${out[k][3]}`)) used[k] = out[k];
  const models: Record<string, string> = {};
  for (const [file, a] of Object.entries(WEAPON_MODELS)) {
    const key = a.key ?? file;
    if (used[key]?.[2] === 'gun') models[key] = `${a.url}?v=${a.v}`;
  }
  const paints: Record<string, ShipPaints> = {};
  const hx = (c: unknown) => (typeof c === 'string' && HEX.test(c.toLowerCase()) ? c.toLowerCase() : null);
  for (const id of HANGAR_IDS) {
    const p = PAINT_FILE.ships?.[id];
    const base = p ? [hx(p.base?.a), hx(p.base?.b), hx(p.base?.c)] : [];
    if (!p || base.length !== 3 || base.some((c) => !c)) continue;
    const list = (p.paints ?? []).flatMap((r) => {
      const col = [hx(r.a), hx(r.b), hx(r.c)];
      const id = String(r.id ?? '').toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || typeof r.name !== 'string' || !r.name.trim() || col.some((c) => !c)) return [];
      return [[id, r.name.trim(), col[0]!, col[1]!, col[2]!, r.pattern ? 1 : 0] as const];
    });
    if (list.length) paints[id] = { base: base as [string, string, string], list };
  }
  // Nur Halterungen, die ein Slot anbietet (rackOf legt auch verworfene an).
  const offered = new Set(Object.values(ships).flatMap((slots) => slots.flatMap((s) => s[6] ?? [])));
  const rackOut: Record<string, LayoutRack> = {};
  for (const k of Object.keys(racks).sort()) if (offered.has(k)) rackOut[k] = racks[k];
  return { v: 1, items: used, ships, models, paints, racks: rackOut };
}

function ensure() {
  if (!memo) {
    const data = build();
    const json = JSON.stringify(data);
    memo = { data, json, hash: createHash('sha1').update(json).digest('hex').slice(0, 8) };
  }
  return memo;
}

/** Die ganze Datei als Objekt; je Build einmal gerechnet. */
export const layoutData = (): LayoutData => ensure().data;
/** Der ausgelieferte Text von /hangar-layouts.json. */
export const layoutJson = (): string => ensure().json;
/** Die URL der Datei mit Inhalts-Hash: ein Datenlauf ist sofort sichtbar, nicht erst nach einem Tag Cache. */
export const layoutDataHref = (): string => `/hangar-layouts.json?v=${ensure().hash}`;
