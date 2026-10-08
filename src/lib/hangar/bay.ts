// buildBay(id, lang) ist die ganze Serverseite eines Schiffs im Hangar: er
// verbindet Schiffswerte, Serienausstattung, 3D-Punkte und Item-Kennwerte,
// uebersetzt jedes Wort, formatiert jede Zahl und liefert ein Modell, das
// ShipBay.astro ohne eigene Entscheidung druckt.
//
// Zwei Stellen rendern eine Bucht mit derselben Komponente: die Hangarseite
// fuer das Startschiff (kein Abruf fuers erste Schiff) und die Buchtdokumente
// /hangar-bay/<id>.html und /de/hangar-bay/<id>.html, die der Controller holt
// und einsetzt.
//
// REGEL, die verify:sync gruen haelt: eine Verzweigung hier oder in
// ShipBay.astro prueft DATEN, nie `lang`. EN- und DE-Bucht eines Schiffs haben
// damit dieselbe Elementfolge, und verify:sync beweist es an 227 Paaren.

import { href, type Locale } from '../../i18n/ui';
import { hangarT, type HangarKey } from '../../i18n/hangarText';
import { displayName, hasMeaningfulGrade, itemPath, items, num, pageItemIds, type Item, type ItemStats } from '../items';
import { statRows } from '../itemStats';
import { STATS, formatStat, percentile, shipData, shipFacts, type ShipId } from './catalog';
import { shipGeometry, type PortName, type StockItem, type Vec3 } from './ports';

/** Die eine Tab-Liste. Die Seite rendert daraus die Tab-Knoepfe, ShipBay je Tab ein Panel. */
export const TABS = ['overview', 'weapons', 'systems', 'cargo'] as const;
export type Tab = (typeof TABS)[number];
export type SlotTabKey = Exclude<Tab, 'overview'>;
export const SLOT_TABS: readonly SlotTabKey[] = ['weapons', 'systems', 'cargo'];

/** Was eine Zeile IST, abgeleitet aus dem Loadout-Item. Die Tabelle KIND ordnet ihr alles Weitere zu. */
export type SlotKind =
  | 'gun' | 'mannedTurret' | 'remoteTurret' | 'pdcTurret' | 'missile' | 'bomb' | 'cm'
  | 'power' | 'cooler' | 'shield' | 'quantum' | 'radar'
  | 'h2tank' | 'qttank' | 'orepod';

export type GroupKey =
  | 'pilot' | 'manned' | 'remote' | 'pdc' | 'missile' | 'bomb' | 'cm'
  | 'power' | 'cooler' | 'shield' | 'quantum' | 'radar' | 'fuel' | 'ore';

/**
 * 'item': Name und Groesse waehlen das Item, daraus kommen Name, Kennwert,
 * Details und Links. 'name': nur der lokalisierte Name. Tanks finden ueber den
 * Namen "Internal Tank" Kapazitaeten anderer Groessen (Bericht 02), ihre Zahlen
 * waeren falsch; Erzbehaelter stehen nicht im Katalog.
 */
type Join = 'item' | 'name';
type Figure = 'dps' | 'damage' | 'magazine' | 'powerOutput' | 'coolingRate' | 'shieldHp' | 'driveSpeed' | 'sensitivity';
/**
 * Zweite Zeile: Hersteller bei Waffen, Klasse und Grade bei Bauteilen des
 * Energie-Dreiecks, die Art bei Tanks (Wasserstoff- und Quantumtank heissen
 * beide "Internal Tank").
 */
type Sub = 'maker' | 'grade' | 'kind';

interface KindRule {
  readonly tab: SlotTabKey;
  readonly group: GroupKey;
  readonly join: Join;
  readonly figure: Figure | null;
  readonly sub: Sub | null;
}

/** Die Domaenentabelle. Eine neue Art ist eine Zeile hier, keine Verzweigung im Renderer. */
const KIND: Readonly<Record<SlotKind, KindRule>> = {
  gun: { tab: 'weapons', group: 'pilot', join: 'item', figure: 'dps', sub: 'maker' },
  mannedTurret: { tab: 'weapons', group: 'manned', join: 'item', figure: 'dps', sub: 'maker' },
  remoteTurret: { tab: 'weapons', group: 'remote', join: 'item', figure: 'dps', sub: 'maker' },
  pdcTurret: { tab: 'weapons', group: 'pdc', join: 'item', figure: 'dps', sub: 'maker' },
  missile: { tab: 'weapons', group: 'missile', join: 'item', figure: 'damage', sub: 'maker' },
  bomb: { tab: 'weapons', group: 'bomb', join: 'item', figure: 'damage', sub: 'maker' },
  cm: { tab: 'weapons', group: 'cm', join: 'item', figure: 'magazine', sub: 'maker' },
  power: { tab: 'systems', group: 'power', join: 'item', figure: 'powerOutput', sub: 'grade' },
  cooler: { tab: 'systems', group: 'cooler', join: 'item', figure: 'coolingRate', sub: 'grade' },
  shield: { tab: 'systems', group: 'shield', join: 'item', figure: 'shieldHp', sub: 'grade' },
  quantum: { tab: 'systems', group: 'quantum', join: 'item', figure: 'driveSpeed', sub: 'grade' },
  radar: { tab: 'systems', group: 'radar', join: 'item', figure: 'sensitivity', sub: 'grade' },
  h2tank: { tab: 'systems', group: 'fuel', join: 'name', figure: null, sub: 'kind' },
  qttank: { tab: 'systems', group: 'fuel', join: 'name', figure: null, sub: 'kind' },
  orepod: { tab: 'cargo', group: 'ore', join: 'name', figure: null, sub: null },
};

const GROUP_ORDER: Readonly<Record<SlotTabKey, readonly GroupKey[]>> = {
  weapons: ['pilot', 'manned', 'remote', 'pdc', 'missile', 'bomb', 'cm'],
  systems: ['power', 'cooler', 'shield', 'quantum', 'radar', 'fuel'],
  cargo: ['ore'],
};
const ROW_PREFIX: Readonly<Record<SlotTabKey, string>> = { weapons: 'w', systems: 's', cargo: 'c' };
const TURRET_KIND: Readonly<Record<NonNullable<StockItem['turretKind']>, SlotKind>> = {
  manned: 'mannedTurret', remote: 'remoteTurret', pdc: 'pdcTurret',
};

function kindOf(it: StockItem): SlotKind {
  switch (it.cat) {
    case 'weapon': return it.carrier === 'turret' ? TURRET_KIND[it.turretKind ?? 'manned'] : 'gun';
    case 'missile': return it.cls.startsWith('BOMB_') ? 'bomb' : 'missile';
    case 'countermeasure': return 'cm';
    case 'h2fueltank': return 'h2tank';
    case 'qtfueltank': return 'qttank';
    case 'power': case 'cooler': case 'shield': case 'quantum': case 'radar': case 'orepod': return it.cat;
  }
}

export interface Bay {
  readonly id: ShipId;
  readonly lang: Locale;
  /** Kopf des Buchtdokuments: title, description (>= 50 Zeichen), h1. */
  readonly doc: { readonly title: string; readonly description: string; readonly h1: string };
  readonly head: BayHead;
  readonly overview: { readonly rows: readonly StatRow[]; readonly note: string };
  readonly slots: Readonly<Record<SlotTabKey, SlotPanel>>;
  readonly marks: Marks;
}

export interface BayHead {
  readonly maker: string;
  readonly name: string;
  /** Stufen kleiner fuer lange Namen im Titel ueber der Halle (nameStep). */
  readonly nameStep: 0 | 1 | 2;
  readonly roleLine: string;
  readonly sheetHref: string;
  /** Text fuer die hoefliche Live-Region nach einem Wechsel: 'Gladius, Aegis Dynamics'. */
  readonly announce: string;
}

export interface StatRow {
  readonly key: string;
  readonly label: string;
  /** '1,193 m/s', oder null fuer keine/unbekannt; ShipBay druckt dann den Strich. */
  readonly value: string | null;
  /** Balkenbreite in Prozent; null = diese Zeile hat keinen Balken. */
  readonly pct: number | null;
}

/** Ein Tab mit Gruppen oder ein benannter Leerzustand, nie beides, nie keins. */
export type SlotPanel =
  | { readonly kind: 'groups'; readonly facts: readonly StatRow[]; readonly groups: readonly SlotGroup[] }
  | { readonly kind: 'empty'; readonly message: string };

export interface SlotGroup {
  readonly key: GroupKey;
  readonly title: string;
  /** Gruppensumme aus vehicles.json: '1,944.5 DPS', '6', 'H2 1.6 SCU · QT 0.6 SCU'. */
  readonly total: string | null;
  readonly rows: readonly SlotRow[];
}

/** Eine Zeile je (Gruppe, Item, Groesse): Ports mit demselben Item fallen in eine Zeile. */
export interface SlotRow {
  /** Eindeutig in der Bucht: 'w1', 's3'. Id der Details und Verweis der Marker. */
  readonly key: string;
  readonly kind: SlotKind;
  /** Alle Ports dieses Items in Loadout-Reihenfolge; der erste mit Punkt ist das Fokusziel. */
  readonly ports: readonly PortName[];
  readonly size: string | null;
  /** Summe der Loadout-Stueckzahlen: 2 fuer die Flaechenwaffen des Gladius. */
  readonly count: number;
  /** Lokalisierter Item-Name, oder das Art-Wort, wenn das Loadout keinen Namen kennt. */
  readonly name: string;
  readonly sub: string | null;
  /** Kennwert rechts in der Zeile, je Stueck, wenn count > 1 ('546', 'DPS je Stück'). */
  readonly figure: { readonly value: string; readonly unit: string } | null;
  /** itemStats.statRows(): Woerter und Reihenfolge des Item Finders. */
  readonly details: ReadonlyArray<readonly [label: string, value: string]>;
  readonly links: { readonly finder: string; readonly page: string | null } | null;
}

export interface Marks {
  readonly center: Vec3 | null;
  readonly box: readonly [Vec3, Vec3] | null;
  readonly points: readonly Mark[];
}

/** Ein Marker je Port und Tab. Ein Port mit mehreren Items traegt alle ihre Zeilen. */
export interface Mark {
  readonly port: PortName;
  readonly tab: SlotTabKey;
  readonly p: Vec3;
  /** 'S3 Mantis GT-220 Gatling', sichtbar nur am heissen Marker. */
  readonly label: string;
  readonly rows: readonly string[];
}

// Dieselbe Normalisierung und dieselbe "erster gewinnt"-Regel wie
// holoItems.ts, aber ohne dessen Praefix-Rueckfall: der kann falsch treffen,
// und die Waffen joinen ohne ihn zu 505 von 508.
const norm = (s: string) => s.toLowerCase().replace(/["'`„“”‚‘’]/g, '').replace(/\s+/g, ' ').trim();
const BY_NAME = new Map<string, Item>();
for (const it of items) {
  if (!it.category?.startsWith('Vehiclegear')) continue;
  const k = norm(it.name);
  if (!BY_NAME.has(k)) BY_NAME.set(k, it);
}

interface Joined {
  readonly item: Item;
  /** null, wenn der Name mehrere Groessen fuehrt und keine zur Loadout-Groesse passt. */
  readonly stats: ItemStats | null;
  readonly grade: string | null;
  readonly maker: string | null;
}

function joinItem(name: string, size: number | null): Joined | null {
  const item = BY_NAME.get(norm(name));
  if (!item) return null;
  const g = item.game;
  if (g?.variants?.length) {
    const v = g.variants.find((x) => x.size === size);
    return v ? { item, stats: v.stats, grade: v.grade, maker: v.manufacturer } : { item, stats: null, grade: null, maker: null };
  }
  return { item, stats: g?.stats ?? null, grade: g?.grade ?? null, maker: g?.manufacturer ?? null };
}

// FleetYards-Platzhalter wie in ShipDetail.astro realName(): gilt als unbenannt.
const PLACEHOLDER = /placeholder|<=|=>|\bTBD\b/i;

type T = ReturnType<typeof hangarT>;

const totalDamage = (s: ItemStats): number | null => {
  const d = s.damage;
  if (!d) return null;
  const sum = (d.physical ?? 0) + (d.energy ?? 0) + (d.distortion ?? 0) + (d.thermal ?? 0) + (d.biochemical ?? 0) + (d.stun ?? 0);
  return sum > 0 ? sum : null;
};

const FIGURE: Readonly<Record<Figure, { readonly read: (s: ItemStats) => number | null; readonly unit: (t: T) => string }>> = {
  dps: { read: (s) => (s.dps ? Math.round(s.dps) : null), unit: () => 'DPS' },
  damage: { read: (s) => { const d = totalDamage(s); return d == null ? null : Math.round(d); }, unit: (t) => t('unit.damage') },
  magazine: { read: (s) => s.magazine ?? null, unit: (t) => t('unit.charges') },
  powerOutput: { read: (s) => s.powerOutput ?? null, unit: (t) => t('unit.power') },
  coolingRate: { read: (s) => s.coolingRate ?? null, unit: (t) => t('unit.cooling') },
  shieldHp: { read: (s) => s.shieldHp ?? null, unit: () => 'HP' },
  driveSpeed: { read: (s) => (s.driveSpeed ? Math.round(s.driveSpeed / 1e6) : null), unit: () => 'Mm/s' },
  sensitivity: { read: (s) => s.sensitivity ?? null, unit: (t) => t('unit.sensitivity') },
};

type Vehicle = ReturnType<typeof shipData>;

const turretDps = (v: Vehicle, label: string) => v.turrets.find((t) => t.label === label)?.dps ?? null;
const pos = (x: number | null | undefined) => (x != null && x > 0 ? x : null);
const countText = (x: number | null | undefined, lang: Locale) => {
  const n = pos(x);
  return n == null ? null : num(n, lang);
};
const fuel = (tag: string, x: number | null, lang: Locale) => {
  const n = pos(x);
  return n == null ? null : `${tag} ${num(Math.round(n * 10) / 10, lang)} SCU`;
};

/** Gruppensumme aus vehicles.json. Der Record-Typ verlangt jede Gruppe, auch die ohne Summe. */
const GROUP_TOTAL: Readonly<Record<GroupKey, (v: Vehicle, lang: Locale) => string | null>> = {
  pilot: (v, lang) => formatStat('dps', pos(v.pilotDps), lang),
  // Die Turm-Etiketten in vehicles.json sind deutsche Datenschluessel (vehicleText.ts TURRET_EN).
  manned: (v, lang) => formatStat('dps', pos(turretDps(v, 'Bemannte Türme')), lang),
  remote: (v, lang) => formatStat('dps', pos(turretDps(v, 'Ferngesteuerte Türme')), lang),
  pdc: (v, lang) => formatStat('dps', pos(turretDps(v, 'Punktverteidigung (PDC)')), lang),
  missile: (v, lang) => countText(v.missileCount, lang),
  bomb: () => null,
  cm: (v, lang) => countText(v.cmLaunchers, lang),
  power: () => null,
  cooler: () => null,
  shield: (v, lang) => formatStat('shield', pos(v.shieldHp), lang),
  quantum: (v, lang) => {
    const parts = [
      formatStat('qtSpeed', v.qtSpeedMs == null ? null : v.qtSpeedMs / 1e6, lang),
      formatStat('qtRange', v.qtRangeM == null ? null : v.qtRangeM / 1e9, lang),
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  },
  radar: () => null,
  fuel: (v, lang) => {
    const parts = [fuel('H2', v.h2Fuel, lang), fuel('QT', v.qtFuel, lang)].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  },
  // Die Erzkapazitaet steht schon als Kennwert ueber den Behaeltern.
  ore: () => null,
};

/** Zwischenstand einer Zeile vor der Schluesselvergabe. */
interface Draft {
  readonly kind: SlotKind;
  readonly size: number | null;
  /** Loadout-Name, null bei unbenannten Teilen. */
  readonly name: string | null;
  readonly ports: PortName[];
  count: number;
}

function slotRow(d: Draft, key: string, lang: Locale, t: T): SlotRow {
  const rule = KIND[d.kind];
  const joined = d.name ? joinItem(d.name, d.size) : null;
  const numbers = rule.join === 'item' ? joined : null;
  const fig = rule.figure && numbers?.stats ? FIGURE[rule.figure].read(numbers.stats) : null;
  const unit = rule.figure ? FIGURE[rule.figure].unit(t) : '';
  return {
    key,
    kind: d.kind,
    ports: d.ports,
    size: d.size != null ? `S${d.size}` : null,
    count: d.count,
    name: joined ? displayName(joined.item, lang) : (d.name ?? t(`kind.${d.kind}`)),
    sub: rule.sub === 'kind' ? t(`kind.${d.kind}`) : numbers ? subLine(rule.sub, numbers, t) : null,
    figure: fig == null ? null : { value: num(fig, lang), unit: d.count > 1 ? `${unit} ${t('unit.each')}` : unit },
    details: numbers?.stats ? statRows(numbers.stats, lang) : [],
    links: numbers
      ? {
          finder: `${href('/item-finder.html', lang)}?item=${encodeURIComponent(numbers.item.id)}`,
          page: pageItemIds.has(numbers.item.id) ? href(itemPath(numbers.item), lang) : null,
        }
      : null,
  };
}

// Bauteilklassen aus den Itemdaten (game.class) in der Sprache der Seite.
// Eine hier unbekannte Klasse bleibt, wie die Daten sie fuehren.
const CLASS_KEY: Readonly<Record<string, HangarKey>> = {
  Military: 'cls.military', Civilian: 'cls.civilian', Industrial: 'cls.industrial', Stealth: 'cls.stealth', Competition: 'cls.competition',
};

function subLine(sub: Sub | null, j: Joined, t: T): string | null {
  if (sub === 'maker') return j.maker ?? j.item.game?.manufacturer ?? null;
  if (sub === 'grade') {
    const cls = j.item.game?.class ?? null;
    const grade = j.grade && hasMeaningfulGrade(j.item) ? t('grade', { g: j.grade }) : null;
    const parts = [cls && CLASS_KEY[cls] ? t(CLASS_KEY[cls]) : cls, grade].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }
  return null;
}

// Gemessen im Hangar-Titel (Orbitron 900, Zeilenbreite 520 px bei 1440 und
// 1280, 358 px bei 390), breitester Name je Laenge: bis 11 Zeichen passt die
// volle Groesse in eine Zeile (476 px), Namen mit 22 Zeichen wie "C2 Hercules
// Starlifter" brauchten bis 902 px, zwei grosse Zeilen. Eine Stufe kleiner passen 12 bis 17 Zeichen
// (bis 519 px), zwei Stufen kleiner 18 bis 21 (bis 483 px); laengere Namen
// brechen dann in zwei kleine Zeilen um.
const nameStep = (name: string): 0 | 1 | 2 => (name.length >= 18 ? 2 : name.length >= 12 ? 1 : 0);

const bayMemo = new Map<string, Bay>();

/** Die ganze Serverseite eines Schiffs in einer Sprache; je (id, lang) gemerkt. */
export function buildBay(id: ShipId, lang: Locale): Bay {
  const memoKey = `${lang}|${id}`;
  const hit = bayMemo.get(memoKey);
  if (hit) return hit;

  const t = hangarT(lang);
  const facts = shipFacts(id, lang);
  const v = shipData(id);
  const geo = shipGeometry(id);
  const hasLoadout = geo.ports.length > 0;

  // Zeilen sammeln: Schluessel (Art, Name oder Klasse, Groesse). Die Art statt
  // der Gruppe, weil Wasserstoff- und Quantumtank gleich heissen. Unbenannte
  // Teile gruppieren nach ihrer Klasse, damit zwei verschiedene namenlose
  // Werfer nicht zu einer Zeile verschmelzen; die Klasse wird nie angezeigt.
  const drafts = new Map<string, Draft>();
  const portDrafts = new Map<PortName, { draft: string; count: number }[]>();
  for (const port of geo.ports) {
    for (const it of port.items) {
      const kind = kindOf(it);
      const name = it.name && !PLACEHOLDER.test(it.name) ? it.name : null;
      const dk = `${kind}|${name ?? '#' + it.cls}|${it.size ?? ''}`;
      let d = drafts.get(dk);
      if (!d) drafts.set(dk, (d = { kind, size: it.size, name, ports: [], count: 0 }));
      if (!d.ports.includes(port.name)) d.ports.push(port.name);
      d.count += it.count;
      const list = portDrafts.get(port.name) ?? [];
      list.push({ draft: dk, count: it.count });
      portDrafts.set(port.name, list);
    }
  }

  // Gruppen in fester Folge, Zeilen in Loadout-Reihenfolge, Schluessel je Tab.
  const rowOf = new Map<string, SlotRow>();
  const groupsOf = (tab: SlotTabKey): SlotGroup[] => {
    let n = 0;
    return GROUP_ORDER[tab].flatMap((g) => {
      const mine = [...drafts.entries()].filter(([, d]) => KIND[d.kind].group === g);
      if (!mine.length) return [];
      const rows = mine.map(([dk, d]) => {
        const row = slotRow(d, `${ROW_PREFIX[tab]}${++n}`, lang, t);
        rowOf.set(dk, row);
        return row;
      });
      return [{ key: g, title: t(`grp.${g}`), total: GROUP_TOTAL[g](v, lang), rows }];
    });
  };

  const weapons = groupsOf('weapons');
  const systems = groupsOf('systems');
  const cargoGroups = groupsOf('cargo');
  if (rowOf.size !== drafts.size) throw new Error(`bay ${id}: eine Gruppe aus KIND fehlt in GROUP_ORDER`);
  const cargoScu = facts.stat.cargo;
  const ore = pos(v.oreSCU);

  const slots: Record<SlotTabKey, SlotPanel> = {
    weapons: weapons.length
      ? { kind: 'groups', facts: [], groups: weapons }
      : { kind: 'empty', message: t(hasLoadout ? 'empty.weapons' : 'empty.noLoadout') },
    systems: systems.length
      ? { kind: 'groups', facts: [], groups: systems }
      : { kind: 'empty', message: t(hasLoadout ? 'empty.systems' : 'empty.noLoadout') },
    cargo: pos(cargoScu) != null || ore != null || cargoGroups.length
      ? {
          kind: 'groups',
          facts: [
            { key: 'cargo', label: t('cargo.hold'), value: formatStat('cargo', pos(cargoScu), lang), pct: percentile('cargo', pos(cargoScu)) },
            ...(ore != null ? [{ key: 'ore', label: t('cargo.ore'), value: formatStat('cargo', ore, lang), pct: null }] : []),
          ],
          groups: cargoGroups,
        }
      : { kind: 'empty', message: t('empty.cargo') },
  };

  // Marker: je Port mit Punkt und je Tab, in dem seine Items stehen.
  const points: Mark[] = [];
  for (const port of geo.ports) {
    if (!port.p) continue;
    const byTab = new Map<SlotTabKey, { rows: string[]; labels: string[] }>();
    for (const { draft, count } of portDrafts.get(port.name) ?? []) {
      const row = rowOf.get(draft);
      if (!row) continue;
      const tab = KIND[row.kind].tab;
      const m = byTab.get(tab) ?? { rows: [], labels: [] };
      if (!m.rows.includes(row.key)) m.rows.push(row.key);
      m.labels.push(`${count > 1 ? `${count}× ` : ''}${row.size ? `${row.size} ` : ''}${row.name}`);
      byTab.set(tab, m);
    }
    for (const [tab, m] of byTab) points.push({ port: port.name, tab, p: port.p, label: m.labels.join(' / '), rows: m.rows });
  }

  const shipLabel = [facts.maker, facts.name].filter(Boolean).join(' ');
  const bay: Bay = {
    id,
    lang,
    doc: { title: t('doc.title', { name: facts.name }), description: t('doc.description', { ship: shipLabel }), h1: facts.name },
    head: {
      maker: facts.maker,
      name: facts.name,
      nameStep: nameStep(facts.name),
      // Ohne eigene Rolle faellt vRoleCig auf den Typ zurueck: nicht "Ground · Ground".
      roleLine: [...new Set([facts.typeLabel, facts.role].filter(Boolean))].join(' · '),
      sheetHref: href(facts.sheetPath, lang),
      announce: [facts.name, facts.maker].filter(Boolean).join(', '),
    },
    overview: {
      rows: STATS.filter((s) => s.sortable).map((s) => {
        const x = pos(facts.stat[s.key]);
        return { key: s.key, label: t(`stat.${s.key}`), value: formatStat(s.key, x, lang), pct: percentile(s.key, x) };
      }),
      note: t('overview.note'),
    },
    slots,
    marks: { center: geo.center, box: geo.box, points },
  };
  bayMemo.set(memoKey, bay);
  return bay;
}
