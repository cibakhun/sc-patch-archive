// searchWelt.ts — Erze, Orte, Laeden und Kategorielisten fuer die Suche.
//
// Anlass (UX-Audit 24.11.2026, Umsetzungsplan Paket B, B3): „Laranite" ergab
// „keine Treffer", „Lorville" nur einen Patch-Eintrag, „Quantainium" zuerst
// eine Wasserflasche, und wer „Helme" suchte, fand einzelne Helme, aber nie
// die Liste. Die Seiten dafuer gibt es alle schon; es fehlten nur die
// Eintraege im Register.
//
// Jeder Eintrag zeigt auf eine bestehende Seite, nie auf eine neue:
//  Erz       -> Mining-Werkbank mit diesem Erz (?mineral=, dieselbe Adresse wie
//               aus der Crafting-Werkbank, src/lib/miningLinks.ts); zweiter Weg
//               „Refinery" mit diesem Erz (?erz=), wenn es dort gefuehrt wird.
//  Ort       -> Item Finder mit dem Ort als Suchtext (?q=), wenn dort etwas
//               verkauft wird; sonst Mining-Werkbank in der Fundort-Ansicht
//               (?fundort=); sonst Missionen dieses Orts (?loc=). Der zweite
//               Weg ist der naechste davon, den es gibt.
//  Laden     -> Item Finder mit dem Ladennamen als Suchtext.
//  Liste     -> die Kategorieliste der Items bzw. Blueprints.
// Ein Ort, den mehrere Quellen kennen (Daymar: Fundort und Missionsort;
// Levski: Laeden, Raffinerie, Missionen), steht EINMAL im Register.
import MINE from '../../assets/mining-db.json';
import { href, useTranslations, type Locale } from '../i18n/ui';
import { categoryLabel } from '../i18n/itemText';
import { categories, categoryPath, items, midCategory } from './items';
import { craftCategories, craftCategoryPath } from './crafting';
import { db as missionDb, missions } from './missions';
import { REFINERY, oreByName } from './refinery';
import { gattungsWoerter } from './searchAliases';
import type { SearchEntry } from './searchIndex';

const SYSTEME = ['Stanton', 'Pyro', 'Nyx'];
const SYSTEM_SUFFIX = /\s*\((Stanton|Pyro|Nyx)\)\s*$/;

/** Schluessel fuer den Abgleich zwischen Quellen: klein, nur Buchstaben und Ziffern. */
export const ortSchluessel = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const fill = (s: string, n: number, lang: Locale) => s.replace('%n%', n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US'));
type T = ReturnType<typeof useTranslations>;
type Key = Parameters<T>[0];
/** „1 Mission" statt „1 Missionen": Schluessel mit .one fuer die Einzahl. */
const zahl = (t: T, key: Key, n: number, lang: Locale) => (n === 1 ? t(`${key}.one` as Key) : fill(t(key), n, lang));

/* ---------- Erze ---------- */

interface MineMineral {
  name: string; code?: string; kind?: string; methods?: string[]; systems?: string[];
  locations: { location: string; system: string; type: string }[];
}
interface MineDb { minerals: MineMineral[] }
const MINERALE = (MINE as unknown as MineDb).minerals;

function erzEintraege(lang: Locale): SearchEntry[] {
  const t = useTranslations(lang);
  const mining = href('/topics/mining.html', lang);
  const refinery = href('/refinery.html', lang);
  return MINERALE.map((m) => {
    const wege = (m.methods ?? []).map((w) => t(`search.ore.${w}` as Parameters<typeof t>[0]));
    const raff = oreByName.has(m.name);
    return {
      k: 'erz',
      b: t('search.kind.erz'),
      t: m.name,
      s: [t('search.kind.erz'), (m.systems ?? []).join(', '), wege.join(', ')].filter(Boolean).join(' · '),
      u: `${mining}?mineral=${encodeURIComponent(m.name)}#db`,
      x: ['erz erze ore ores mineral rohstoff', m.code ?? '', m.kind ?? ''].join(' ').trim(),
      ...(raff ? { w: `${refinery}?erz=${encodeURIComponent(m.name)}#ertrag`, wl: t('search.way.refinery') } : {}),
    };
  });
}

/* ---------- Orte ---------- */

interface Ort {
  titel: string;
  schluessel: string[];
  system: string | null;
  typ: string | null;
  laden: string | null; // Suchtext fuer den Item Finder
  fundort: string | null; // Schluessel der Mining-Werkbank (?fundort=)
  erze: number;
  missionOrt: string | null; // id fuer /missionen.html?loc=
  missionen: number;
  raffinerie: boolean;
  namen: Set<string>;
}

/** Ein Bezugsort im Item-Katalog: „Armor - Port Tressler" -> Laden „Armor", Ort „Port Tressler". */
function teileBezug(loc: string): { laden: string; ort: string } | null {
  const i = loc.lastIndexOf(' - ');
  if (i < 0) return null;
  return { laden: loc.slice(0, loc.search(/\s?-\s/)).trim(), ort: loc.slice(i + 3).trim() };
}

// Ladennamen, die nur eine Gattung sind („Pharmacy", „Pizza", „Shop
// Terminal"): als Suchziel nutzlos und als Teilwort laut („bar" in „barrel").
const GATTUNGS_LAEDEN = new Set([
  'shop terminal', 'shop', 'fps shop', 'ship weapons', 'guns', 'armor', 'weapons and armor', 'clothing shop',
  'pharmacy', 'medical shop', 'cargo services', 'refinery shop', 'tools supplies', 'cargo center supplies',
  'cargo supplies', 'ship parts', 'juice bar', 'coffee to go', 'hot dogs', 'noodle bar', 'noodles',
  'station convenience', 'burrito bar', 'shelf stable', 'bar', 'wake up', 'fried grubs', 'near beer', 'sundries',
  'filtered water', 'pizza', 'tech shop', 'rust', 'seanuts', 'factory line', 'feed the people', 'ready to trade',
  'equipment contested zone checkmate pyro', 'live fire weapons', 'unique quality', 'gear up', 'bounty office',
]);

const MISSION_SYSTEM = (key: string): string | null =>
  /^(Stanton|PrisonMine_Stanton)/.test(key) ? 'Stanton' : /^(Pyro|RR_P)/.test(key) ? 'Pyro' : /^(Nyx|Delamar)/.test(key) ? 'Nyx' : null;

function sammleOrte(): { orte: Ort[]; laeden: Map<string, { name: string; orte: Set<string> }> } {
  const orte: Ort[] = [];
  const nachSchluessel = new Map<string, Ort>();
  const neu = (titel: string, system: string | null): Ort => {
    const o: Ort = {
      titel, schluessel: [], system, typ: null, laden: null, fundort: null, erze: 0,
      missionOrt: null, missionen: 0, raffinerie: false, namen: new Set([titel]),
    };
    orte.push(o);
    return o;
  };
  const merke = (o: Ort, name: string) => {
    const k = ortSchluessel(name);
    if (!k || nachSchluessel.has(k)) return;
    o.schluessel.push(k);
    nachSchluessel.set(k, o);
  };
  const finde = (...namen: string[]) => {
    for (const n of namen) {
      const o = nachSchluessel.get(ortSchluessel(n));
      if (o) return o;
    }
    return null;
  };

  // 1. Bezugsorte (Laeden) aus dem Item-Katalog. Ein Name, der in zwei
  //    Systemen vorkommt (Pyro Gateway in Stanton und in Nyx), bleibt mit
  //    System im Titel getrennt.
  const roh = new Map<string, number>();
  const laeden = new Map<string, { name: string; orte: Set<string> }>();
  for (const it of items)
    for (const o of it.obtain) {
      if (o.kind !== 'shop' && o.kind !== 'vehicle') continue;
      const b = teileBezug(o.loc);
      if (!b) continue;
      roh.set(b.ort, (roh.get(b.ort) ?? 0) + 1);
      const lk = ortSchluessel(b.laden);
      if (!GATTUNGS_LAEDEN.has(lk)) {
        const l = laeden.get(lk) ?? { name: b.laden, orte: new Set<string>() };
        l.orte.add(b.ort);
        laeden.set(lk, l);
      }
    }
  const systemeJeBasis = new Map<string, Set<string>>();
  for (const ort of roh.keys()) {
    const basis = ortSchluessel(ort.replace(SYSTEM_SUFFIX, ''));
    const sys = ort.match(SYSTEM_SUFFIX)?.[1] ?? '';
    systemeJeBasis.set(basis, (systemeJeBasis.get(basis) ?? new Set()).add(sys));
  }
  for (const ort of [...roh.keys()].sort()) {
    const basisName = ort.replace(SYSTEM_SUFFIX, '').trim();
    const sys = ort.match(SYSTEM_SUFFIX)?.[1] ?? null;
    const mehrdeutig = [...(systemeJeBasis.get(ortSchluessel(basisName)) ?? [])].filter(Boolean).length > 1;
    const titel = mehrdeutig ? ort : basisName;
    const da = finde(titel);
    if (da) {
      da.system ??= sys;
      da.namen.add(ort);
      continue;
    }
    const o = neu(titel, sys);
    o.laden = titel;
    o.namen.add(ort);
    merke(o, titel);
  }

  // 2. Raffinerien: an den Ort mit gleichem Namen oder Kurznamen.
  for (const st of REFINERY.stations) {
    const o = finde(st.name, st.short, st.name.replace(SYSTEM_SUFFIX, ''));
    if (o) { o.raffinerie = true; o.namen.add(st.name); }
  }

  // 3. Fundorte der Mining-Werkbank (45): „Pyro II (Monox)" heisst auch Monox.
  const fundorte = new Map<string, { system: string; typ: string; erze: Set<string> }>();
  for (const m of MINERALE)
    for (const l of m.locations) {
      const f = fundorte.get(l.location) ?? { system: l.system, typ: l.type, erze: new Set<string>() };
      f.erze.add(m.name);
      fundorte.set(l.location, f);
    }
  for (const [name, f] of [...fundorte.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const alias = name.match(/\(([^)]+)\)\s*$/)?.[1];
    const o = finde(name, ...(alias && !SYSTEME.includes(alias) ? [alias] : [])) ?? neu(name, f.system);
    o.fundort = name;
    o.erze = f.erze.size;
    o.typ ??= f.typ;
    o.system ??= f.system;
    o.namen.add(name);
    merke(o, name);
    if (alias && !SYSTEME.includes(alias)) merke(o, alias);
  }

  // 4. Missionsorte (ohne die Sammel-Regionen des Spiels, „Region A" usw.).
  const jeOrt = new Map<string, number>();
  for (const m of missions) for (const id of m.localities) jeOrt.set(id, (jeOrt.get(id) ?? 0) + 1);
  for (const l of missionDb.localities) {
    if ((l as { zweig?: string }).zweig === 'rueckfall') continue;
    const n = jeOrt.get(l.id) ?? 0;
    if (!n) continue;
    const name = l.name.replace(/\s*\(System\)$/, '');
    const o = finde(l.name, name) ?? neu(l.name, MISSION_SYSTEM(l.key));
    o.missionOrt = l.id;
    o.missionen = n;
    o.system ??= MISSION_SYSTEM(l.key);
    o.namen.add(l.name);
    merke(o, l.name);
  }
  return { orte, laeden };
}

const PLATZ_TYP = new Set(['moon', 'planet', 'belt', 'cluster', 'lagrange']);

function ortEintraege(lang: Locale): SearchEntry[] {
  const t = useTranslations(lang);
  const finder = href('/item-finder.html', lang);
  const mining = href('/topics/mining.html', lang);
  const missionen = href('/missionen.html', lang);
  const { orte, laeden } = sammleOrte();
  type Weg = { u: string; l: string } | null;
  const out: SearchEntry[] = [];
  for (const o of orte) {
    const laden = o.laden ? `${finder}?q=${encodeURIComponent(o.laden)}` : null;
    const fund: Weg = o.fundort ? { u: `${mining}?fundort=${encodeURIComponent(o.fundort)}#db`, l: t('search.way.mining') } : null;
    const mis: Weg = o.missionOrt ? { u: `${missionen}?loc=${encodeURIComponent(o.missionOrt)}`, l: t('search.way.missions') } : null;
    const u = laden ?? fund?.u ?? mis?.u;
    if (!u) continue;
    // Zweiter Weg: Missionen, wenn es sie gibt und sie nicht schon das Ziel
    // sind; sonst die Fundort-Ansicht, wenn der Ort mit Laeden beginnt.
    const zweit = mis && mis.u !== u ? mis : fund && fund.u !== u ? fund : null;
    out.push({
      k: 'ort',
      b: t('search.kind.ort'),
      t: o.titel,
      s: [
        o.typ && PLATZ_TYP.has(o.typ) ? t(`search.place.${o.typ}` as Parameters<typeof t>[0]) : t('search.kind.ort'),
        o.system,
        o.laden ? t('search.place.shops') : null,
        o.raffinerie ? t('search.place.refinery') : null,
        o.erze ? zahl(t, 'search.place.ores', o.erze, lang) : null,
        o.missionen ? zahl(t, 'search.place.missions', o.missionen, lang) : null,
      ].filter(Boolean).join(' · '),
      u,
      x: ['ort place location', ...[...o.namen].filter((n) => n !== o.titel), o.raffinerie ? 'raffinerie refinery' : '']
        .join(' ').trim(),
      ...(zweit ? { w: zweit.u, wl: zweit.l } : {}),
    });
  }
  // Laeden mit eigenem Namen (Casaba Outlet, Cubby Blast, Platinum Bay).
  const ortsnamen = new Set(orte.flatMap((o) => o.schluessel));
  for (const [k, l] of [...laeden.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    if (ortsnamen.has(k)) continue;
    out.push({
      k: 'laden',
      b: t('search.kind.laden'),
      t: l.name,
      s: [t('search.kind.laden'), zahl(t, 'search.shop.places', l.orte.size, lang)].join(' · '),
      u: `${finder}?q=${encodeURIComponent(l.name)}`,
      x: ['laden shop', ...[...l.orte].slice(0, 6)].join(' '),
    });
  }
  return out;
}

/* ---------- Kategorielisten ---------- */

function listenEintraege(lang: Locale): SearchEntry[] {
  const t = useTranslations(lang);
  const out: SearchEntry[] = [];
  for (const c of categories)
    out.push({
      k: 'liste',
      b: t('search.kind.liste'),
      t: c.leaf,
      s: [categoryLabel(c.root, lang), midCategory(c.cat), fill(t('search.list.items'), c.items.length, lang)].filter(Boolean).join(' · '),
      u: href(categoryPath(c), lang),
      x: [c.cat, categoryLabel(c.root, lang), gattungsWoerter(c.cat)].join(' '),
    });
  for (const c of craftCategories)
    out.push({
      k: 'bauplanliste',
      b: t('search.kind.bauplanliste'),
      t: c.leaf,
      s: [categoryLabel(c.root, lang), midCategory(c.cat), fill(t('search.list.blueprints'), c.blueprints.length, lang)].filter(Boolean).join(' · '),
      u: href(craftCategoryPath(c), lang),
      x: [c.cat, categoryLabel(c.root, lang), 'blueprint bauplan', gattungsWoerter(c.cat)].join(' '),
    });
  return out;
}

/** Erze, Orte, Laeden und Listen fuer den ersten Teil des Registers. */
export function weltEintraege(lang: Locale): SearchEntry[] {
  return [...erzEintraege(lang), ...ortEintraege(lang), ...listenEintraege(lang)];
}
