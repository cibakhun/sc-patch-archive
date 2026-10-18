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
// Generator, Kuehler, Schild, Quantum-Antrieb, Radar. Raketen, Taeuschkoerper,
// Tanks, Punktverteidigung und Bergbaulaser bleiben in Serie. Passend heisst:
// dieselbe Art und dieselbe Groesse wie das Serienteil.
//
// Das Format traegt mehr Zahlen, als die Werkstatt heute zeigt (Schadensart,
// Feuerrate, Schildregeneration, Preis): der spaetere Kennwert-Ueberblick und
// der Vergleich zweier Layouts rechnen aus derselben Datei.

import { createHash } from 'node:crypto';
import { items, type Item, type ItemStats } from '../items';
import { HANGAR_IDS } from './catalog';
import { shipGeometry, type StockItem } from './ports';

/** Art eines tauschbaren Slots. Die Werkstatt waehlt danach Gruppe, Kennwert und Kandidaten. */
export type LayoutType = 'gun' | 'power' | 'cooler' | 'shield' | 'quantum' | 'radar';
/** Gruppe in der Werkstatt, dieselben Schluessel wie die Gruppen der Bucht (bay.ts GroupKey). */
export type LayoutGroup = 'pilot' | 'manned' | 'remote' | 'power' | 'cooler' | 'shield' | 'quantum' | 'radar';

const CATEGORY: Readonly<Record<LayoutType, string>> = {
  gun: 'Vehiclegear / Weapons / Guns',
  power: 'Vehiclegear / Powerplant',
  cooler: 'Vehiclegear / Cooler',
  shield: 'Vehiclegear / Shield',
  quantum: 'Vehiclegear / Quantumdrive',
  radar: 'Vehiclegear / Radar',
};

/**
 * Ein Bauteil in einer Groesse, als Tupel, damit die Datei klein bleibt:
 *   [nameEn, nameDe|0, art, groesse, hersteller|0, klasse|0, grade|0, kennwert|0, extra, preis|0]
 * kennwert: DPS (Waffe), Leistung, Kuehlrate, Schild-HP, Quantum Mm/s, Empfindlichkeit.
 * extra: zusaetzliche Zahlen fuer spaetere Kennwerte, nur gesetzte Schluessel.
 * preis: niedrigster Ladenpreis in aUEC.
 */
export type LayoutItem = readonly [
  nameEn: string, nameDe: string | 0, type: LayoutType, size: number,
  maker: string | 0, cls: string | 0, grade: string | 0, figure: number | 0,
  extra: Readonly<Record<string, number | string>>, price: number | 0,
];

/**
 * Ein tauschbarer Slot: [schluessel, art, groesse, serienteil|0, gruppe, anzahl].
 * schluessel = Portname ohne 'hardpoint_', bei mehreren Items im Port mit '.<i>'.
 * Er ist patch-stabil wie der Portname und steht so im geteilten Link.
 */
export type LayoutSlot = readonly [key: string, type: LayoutType, size: number, stock: string | 0, group: LayoutGroup, count: number];

export interface LayoutData {
  readonly v: 1;
  readonly items: Readonly<Record<string, LayoutItem>>;
  readonly ships: Readonly<Record<string, readonly LayoutSlot[]>>;
}

const norm = (s: string) => s.toLowerCase().replace(/["'`„“”‚‘’]/g, '').replace(/\s+/g, ' ').trim();
const PLACEHOLDER = /placeholder|<=|=>|\bTBD\b/i;
const r1 = (x: number) => Math.round(x * 10) / 10;

function typeOf(it: StockItem): { type: LayoutType; group: LayoutGroup } | null {
  switch (it.cat) {
    case 'weapon':
      if (it.carrier !== 'turret') return { type: 'gun', group: 'pilot' };
      if (it.turretKind === 'pdc') return null;
      return { type: 'gun', group: it.turretKind === 'remote' ? 'remote' : 'manned' };
    case 'power': case 'cooler': case 'shield': case 'quantum': case 'radar':
      return { type: it.cat, group: it.cat };
    default:
      return null;
  }
}

/** Der Kennwert der Werkstatt und die Zahlen fuer spaeter, je Art. */
function figures(type: LayoutType, s: ItemStats): { f: number | 0; x: Record<string, number | string> } {
  const x: Record<string, number | string> = {};
  const put = (k: string, v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) x[k] = r1(v); };
  switch (type) {
    case 'gun': {
      const d = s.damage ?? {};
      const ch = (['physical', 'energy', 'distortion'] as const).filter((k) => (d[k] ?? 0) > 0)
        .sort((a, b) => (d[b] ?? 0) - (d[a] ?? 0))[0];
      if (ch) x.dt = ch === 'physical' ? 'p' : ch === 'energy' ? 'e' : 'd';
      put('rate', s.fireRate);
      put('mag', s.magazine);
      return { f: s.dps ? Math.round(s.dps) : 0, x };
    }
    case 'power': put('hp', s.health); return { f: s.powerOutput ?? 0, x };
    case 'cooler': put('hp', s.health); return { f: s.coolingRate ?? 0, x };
    case 'shield': put('regen', s.regen); put('hp', s.health); return { f: s.shieldHp ?? 0, x };
    case 'quantum':
      put('cd', s.cooldown); put('fuel', typeof s.fuelPerGm === 'number' ? s.fuelPerGm * 1000 : undefined);
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
  const types = Object.entries(CATEGORY) as [LayoutType, string][];
  for (const it of items) {
    const type = types.find(([, c]) => c === it.category)?.[0];
    if (!type || PLACEHOLDER.test(it.name)) continue;
    const g = it.game ?? {};
    const variants = g.variants?.length
      ? g.variants.map((v) => ({ size: v.size, grade: v.grade, maker: v.manufacturer, stats: v.stats, key: `${it.id}~${v.size}` }))
      : [{ size: g.size, grade: g.grade ?? null, maker: g.manufacturer ?? null, stats: g.stats ?? null, key: it.id }];
    for (const v of variants) {
      // Groesse 0 sind Fahrzeug- und Bodenteile; sie passen in keinen Schiffsslot.
      if (typeof v.size !== 'number' || v.size < 1 || !v.stats) continue;
      const { f, x } = figures(type, v.stats);
      if (!f) continue;
      const de = g.nameDe?.trim();
      out[v.key] = [it.name, de && de !== it.name ? de : 0, type, v.size, v.maker || 0, g.class || 0, v.grade || 0, f, x, shopPrice(it)];
      const n = norm(it.name);
      const sizes = byName.get(n) ?? new Map<number, string>();
      if (!sizes.has(v.size)) sizes.set(v.size, v.key);
      byName.set(n, sizes);
    }
  }

  // Slots: je Schiff die tauschbaren Items in Loadout-Reihenfolge.
  const ships: Record<string, LayoutSlot[]> = {};
  for (const id of HANGAR_IDS) {
    const slots: LayoutSlot[] = [];
    for (const port of shipGeometry(id).ports) {
      const base = port.name.replace(/^hardpoint_/, '');
      port.items.forEach((it, i) => {
        const t = typeOf(it);
        if (!t || typeof it.size !== 'number' || it.size < 1) return;
        const stock = it.name ? byName.get(norm(it.name))?.get(it.size) : undefined;
        // Eine Waffe, die der Katalog nicht als Bordwaffe fuehrt (Bergbau-,
        // Bergungs- oder Traktorlaser), ist kein Slot der Werkstatt.
        if (!stock && t.type === 'gun') return;
        if (stock && out[stock][2] !== t.type) return;
        const key = port.items.length > 1 ? `${base}.${i}` : base;
        slots.push([key, t.type, it.size, stock ?? 0, t.group, it.count]);
      });
    }
    if (slots.length) ships[id] = slots;
  }

  // Nur Bauteile, die in mindestens einen Slot passen: die Datei traegt keine
  // Teile, die niemand einbauen kann.
  const fits = new Set<string>();
  for (const slots of Object.values(ships)) for (const s of slots) fits.add(`${s[1]}|${s[2]}`);
  const used: Record<string, LayoutItem> = {};
  for (const k of Object.keys(out).sort()) if (fits.has(`${out[k][2]}|${out[k][3]}`)) used[k] = out[k];
  return { v: 1, items: used, ships };
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
