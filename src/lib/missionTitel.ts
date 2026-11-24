// Lesbare, unterscheidbare Missionstitel (UX-Audit Paket F, Punkt F1).
//
// ⚠ ANLASS (Audits 24.11.2026): 213 Missionen zeigten ihren Arbeitsnamen
// („Hockrow Stanton Missing Person Space Easy"), 77 Titel standen auf 258
// Seiten gleich („{ReputationRank} Hauler Needed for {CargoGradeToken}
// Shipment" 46-mal), und Vorlagen-Marken standen als Kaestchen in Liste,
// Kopf und Suche. Wer die Liste ueberflog, sah 46 gleiche Karten.
//
// Was hier entsteht, je Mission:
//   teile   der Titel als Text, Laufzeit-Platzhalter als allgemeines Wort
//           („Target", „Location") mit gen=true — die Seite setzt es kursiv,
//           damit es als Stellvertreter lesbar bleibt (Ehrlichkeitsregel).
//           Was die Missionsdaten selbst wissen, wird eingesetzt: die
//           Frachtklasse steht im Modul („HaulCargo_SingleToMulti2_Small_…").
//   zusatz  die Merkmale, die gleichnamige Missionen unterscheiden (Fracht,
//           Route, Auftraggeber, Region, Stufe …) — nur so viele, wie es
//           braucht, ausgesucht in fester Reihenfolge.
//
// Missionen ohne festen Titel (noTitle) bekommen einen Namen aus ihrem
// Arbeitsnamen: Auftraggeber, System, Rechtslage, Stufe und Kistenzahl
// wandern aus dem Namen in den Zusatz („Missing Person Space" · Hockrow
// Agency · Hurston · leicht).
//
// Rein und ohne JSON-Import: nimmt die Missionen als Argument. So bleibt die
// Ableitung fuer sich pruefbar, und missions.ts behaelt den einzigen Import
// der grossen Datei.

import type { Locale } from '../i18n/ui';

export interface TitelTeil { t: string; gen: boolean }

/** Was die Ableitung von einer Mission braucht (Teilmenge von Mission). */
export interface MissionFuerTitel {
  slug: string;
  title: string;
  noTitle: boolean;
  typeNames: string[];
  giverNames: string[];
  localityNames: string[];
  lawful: boolean;
  unlawful: boolean;
  sources: ('broker' | 'contract')[];
  module: string | null;
  variants: { key: string; giver: string | null; rankMin: string | null }[];
}

/* ---------- Platzhalter -> lesbares Wort ---------- */

// Stellvertreter fuer Laufzeitwerte. '' = ersatzlos, der Satz traegt ohne
// („{ReputationRank} Hauler Needed for …" -> „Hauler Needed for …").
const SLOT: Record<string, string> = {
  targetname: 'Target',
  last: 'Target',
  location: 'Location',
  playlocation: 'Location',
  defendlocationwrapperlocation: 'Location',
  address: 'Location',
  destination: 'Destination',
  pickuplocation: 'Pickup Location',
  dropofflocation: 'Dropoff Location',
  ship: 'Ship',
  objects: 'Assets',
  creature: 'Creatures',
  racetype: '',
  reputationrank: '',
  cargogradetoken: '',
  reward: '',
  danger: '',
  item: '',
};
// Tokens, die den ganzen Titel tragen: sie sind der Titel, kein Stellvertreter.
const GANZTITEL: Record<string, string> = {
  timesensitiverecovertitle: 'Time-Sensitive Recovery',
  recoverstashtitle: 'Stash Recovery',
  recoverstashstealtitle: 'Stash Recovery',
  localdeliverydrugprodtitle: 'Local Delivery',
  // Einzelfall „{Title} ({Item})" (Abfallbeseitigung auf Stationen)
  title: 'Maintenance',
};

/** "CargoGradeToken" -> "Cargo Grade Token"; "location" -> "Location". */
export const deCamel = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^[a-z]/, (c) => c.toUpperCase());

const ESC = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const A = '\u0001';
const Z = '\u0002';

/**
 * Titel-Vorlage -> Teile. `fill` setzt bekannte Werte ein (Schluessel klein,
 * ohne Klammern). Regeln, in dieser Reihenfolge:
 *   1. Platzhalter in Klammern ohne Wert fallen samt Klammern weg
 *      („Refuel Request ({Ship})" -> „Refuel Request").
 *   2. Platzhalter direkt nach einem Doppelpunkt, hinter dem nur noch eine
 *      Klammer, ein Strich oder das Ende kommt, fallen weg
 *      („Wanted: {TargetName} (HRT)" -> „Wanted (HRT)").
 *   3. „| {Danger}" und „- {Reward}" am Ende fallen weg.
 *   4. Alles andere wird zum Stellvertreter-Wort; steht das Wort schon im
 *      festen Titel, faellt es weg („Target at {Location}" bleibt, aber
 *      „Target …: {TargetName}" wird nicht „Target …: Target").
 */
export function titelTeile(vorlage: string, fill: Record<string, string> = {}): TitelTeil[] {
  const hat = (k: string) => Object.prototype.hasOwnProperty.call(fill, k.toLowerCase()) && !!fill[k.toLowerCase()];
  let s = String(vorlage);
  s = s.replace(/\s*\(\{(\w+)\}\)/g, (x, k) => (hat(k) ? ` (${fill[k.toLowerCase()]})` : ''));
  s = s.replace(/:\s*\{(\w+)\}(?=\s*(?:\(|\||$))/g, (x, k) => (hat(k) ? `: {${k}}` : ''));
  s = s.replace(/\s*\|\s*\{(\w+)\}\s*$/g, (x, k) => (hat(k) ? x : ''));
  s = s.replace(/\s*-\s*\{reward\}\s*$/i, '');
  const fest = s.replace(/\{[^}]*\}/g, ' ');
  const schonDa = (w: string) => new RegExp(`\\b${ESC(w)}\\b`, 'i').test(fest);
  const person = /missing|vanished|whereabouts|reported/i.test(vorlage);
  s = s.replace(/\{(\w+)\}/g, (x, k: string) => {
    const kl = k.toLowerCase();
    if (hat(kl)) return fill[kl];
    if (kl in GANZTITEL) return GANZTITEL[kl];
    let w = kl in SLOT ? SLOT[kl] : deCamel(k);
    if (w === 'Target' && person) w = 'Person';
    if (!w || schonDa(w)) return '';
    return `${A}${w}${Z}`;
  });
  // Nach ersatzlosem Rang: „Rank - Small Cargo Haul", „DEAD SAINTS - Rank - …"
  if (/\{reputationrank\}/i.test(vorlage)) s = s.replace(/(^\s*|-\s*)Rank\s*[-,]\s*/g, "$1");
  s = s
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,:–—|-]+|[\s,:–—|-]+$/g, '');
  const teile: TitelTeil[] = [];
  for (const p of s.split(new RegExp(`(${A}[^${Z}]*${Z})`))) {
    if (!p) continue;
    if (p.startsWith(A)) teile.push({ t: p.slice(1, -1), gen: true });
    else teile.push({ t: p, gen: false });
  }
  return teile;
}

export const titelText = (teile: TitelTeil[]) => teile.map((p) => p.t).join('').replace(/\s{2,}/g, ' ').trim();

/* ---------- Merkmale einer Mission ---------- */

type Text = { de: string; en: string };
const T = (de: string, en: string = de): Text => ({ de, en });

// Frachtklasse: das Wort, das das Spiel fuer {CargoGradeToken} einsetzt.
const KLASSE_RE = /_(Small|Medium|Large|Bulk|Supply)_/;

/** Frachtklasse(n) aus Modul oder (einstimmig) aus den Angebots-Kennungen. */
export function frachtKlassen(m: Pick<MissionFuerTitel, 'module' | 'variants'>): string[] {
  const aus = (s: string | null) => (s ? KLASSE_RE.exec(s)?.[1] ?? null : null);
  const mod = aus(m.module);
  if (mod) return [mod];
  const set = new Set<string>();
  for (const v of m.variants) {
    if (!/HaulCargo/i.test(v.key)) continue;
    const k = aus(v.key);
    if (k) set.add(k);
  }
  return [...set];
}

// Abkuerzungen in Warennamen der Modulnamen
// Potasium: so (mit einem s) steht es im Modulnamen; die Ware heisst Potassium.
const WARE: Record<string, string> = { Souv: 'Souvenirs', ProcessedFood: 'Processed Food', Potasium: 'Potassium' };
function ware(m: MissionFuerTitel): string | null {
  const x = /HaulCargo_[A-Za-z0-9]+_(?:Small|Medium|Large|Bulk|Supply)_([A-Za-z]+)$/.exec(m.module ?? '');
  if (!x) return null;
  return WARE[x[1]] ?? deCamel(x[1]);
}

function route(m: MissionFuerTitel): Text | null {
  const mod = m.module ?? '';
  let p = 0, d = 0, waren = 0, kisten = 0;
  let r: RegExpExecArray | null;
  if ((r = /SingleToMulti(\d)/.exec(mod)) || (r = /SingleToMulti_1to(\d)/.exec(mod))) { p = 1; d = +r[1]; }
  else if ((r = /Multi(\d)ToSingle/.exec(mod)) || (r = /MultiToSingle_(\d)to1/.exec(mod))) { p = +r[1]; d = 1; }
  else if (/HaulCargo_AtoB/i.test(mod)) { p = 1; d = 1; }
  else if ((r = /DeliveryPilot_(\d)Pickup_(\d)Dropoff_(\d)Items/.exec(mod))) { p = +r[1]; d = +r[2]; waren = +r[3]; }
  else if ((r = /Courier_(\d)box/i.exec(mod))) { kisten = +r[1]; }
  const kampf = /CombatEncounter/.test(mod);
  const de: string[] = [];
  const en: string[] = [];
  if (p) {
    de.push(`${p} ${p > 1 ? 'Abholorte' : 'Abholort'}, ${d} ${d > 1 ? 'Ziele' : 'Ziel'}`);
    en.push(`${p} ${p > 1 ? 'pickups' : 'pickup'}, ${d} ${d > 1 ? 'drop-offs' : 'drop-off'}`);
  }
  if (waren) { de.push(`${waren} Waren`); en.push(`${waren} goods`); }
  if (kisten) { de.push(`${kisten} ${kisten > 1 ? 'Kisten' : 'Kiste'}`); en.push(`${kisten} ${kisten > 1 ? 'boxes' : 'box'}`); }
  if (kampf) { de.push('mit Kampf'); en.push('with combat'); }
  return de.length ? { de: de.join(', '), en: en.join(', ') } : null;
}

// Stufen, wie sie in Arbeitsnamen und Kennungen stehen. Laengere zuerst.
const STUFEN: [RegExp, Text][] = [
  [/\bVery ?Easy\b/, T('sehr leicht', 'very easy')],
  [/\bVery ?Hard\b/, T('sehr schwer', 'very hard')],
  [/\bEasy\b/, T('leicht', 'easy')],
  [/\bMedium\b/, T('mittel', 'medium')],
  [/\bHard\b/, T('schwer', 'hard')],
  [/\bSuper\b/, T('Super', 'super')],
  [/\bIntro\b/, T('Einstieg', 'intro')],
  [/\bRehire\b/, T('Folgeauftrag', 'rehire')],
];

const ohneSystemZusatz = (n: string) => n.replace(/\s*\(System\)$/, '');
function region(m: MissionFuerTitel): string | null {
  // Sortiert: dieselbe Menge in anderer Reihenfolge ist dieselbe Region.
  const n = [...new Set(m.localityNames.map(ohneSystemZusatz))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  if (!n.length) return null;
  return n.length > 2 ? `${n.slice(0, 2).join(', ')} +${n.length - 2}` : n.join(', ');
}

function rang(m: MissionFuerTitel): Text | null {
  const r = [...new Set(m.variants.map((v) => v.rankMin).filter((x): x is string => !!x))];
  if (!r.length) return null;
  const s = r.slice(0, 2).join('/') + (r.length > 2 ? ' …' : '');
  return { de: `ab ${s}`, en: `from ${s}` };
}

function modulName(m: MissionFuerTitel): string | null {
  if (!m.module) return null;
  const b = m.module.split(/[\\/]/).pop()!.replace(/\.xml$/i, '').replace(/^pu_/i, '');
  const w = b.split('_').filter(Boolean).map((x) => deCamel(x)).join(' ');
  return w || null;
}

/* ---------- Titel ohne festen Spieltitel ---------- */

// Namen im Arbeitsnamen, die anders geschrieben sind als der Auftraggeber.
const GEBER_ALIAS: Record<string, string> = {
  Adaigo: 'Adagio Holdings',
  CFP: 'Citizens For Prosperity',
};
const SYSTEM_WORT = /\b(?:Stanton|Nyx|Pyro)(?:\s?\d)?(?:\s+L\d)?\b|\bRegion [A-D]\b/g;
const RECHT_WORT = /\b(?:Lawful|Unlawful|Legal|Illegal|legal)\b/g;

interface Abgeleitet { name: string; geber: string | null; stufe: Text | null; kisten: number }

function ausArbeitsname(m: MissionFuerTitel, ortName: Map<string, string>): Abgeleitet {
  let s = ` ${m.title} `;
  let geber: string | null = null;
  // Auftraggeber am Anfang oder Ende des Namens (in der Mitte gehoert er zum
  // Ort: „… Covalex S1 DC06" ist ein Verteilzentrum).
  const kandidaten = new Map<string, string>();
  for (const g of [...m.giverNames, ...m.variants.map((v) => v.giver).filter((x): x is string => !!x)]) {
    const w = g.split(/\s+/);
    for (let i = w.length; i >= 1; i--) kandidaten.set(w.slice(0, i).join(' '), g);
    for (const x of w) if (x.length >= 4) kandidaten.set(x, g);
  }
  for (const [a, g] of Object.entries(GEBER_ALIAS)) kandidaten.set(a, g);
  const nachLaenge = [...kandidaten.keys()].sort((a, b) => b.length - a.length);
  for (const k of nachLaenge) {
    const anfang = new RegExp(`^ ${ESC(k)} `, 'i');
    const ende = new RegExp(` ${ESC(k)} $`, 'i');
    if (anfang.test(s)) { s = s.replace(anfang, ' '); geber = kandidaten.get(k)!; break; }
    if (ende.test(s)) { s = s.replace(ende, ' '); geber = kandidaten.get(k)!; break; }
  }
  // „From Stanton1" / „To Stanton4": der Ort gehoert zum Namen, lesbar.
  s = s.replace(/\b(From|To) Stanton([1-4])\b/g, (x, p, n) => `${p} ${ortName.get(`stanton${n}`) ?? `Stanton ${n}`}`);
  let stufe: Text | null = null;
  for (const [re, t] of STUFEN) {
    if (re.test(s)) { stufe = t; s = s.replace(re, ' '); break; }
  }
  let kisten = 0;
  s = s.replace(/\b(\d) Box\b/, (x, n) => { kisten = +n; return ' '; });
  s = s.replace(SYSTEM_WORT, ' ').replace(RECHT_WORT, ' ')
    .replace(/\bmicro Tech\b/g, 'microTech')
    // „From Hurston Hurston Cassillo": das doppelte Wort entsteht erst durch
    // das Einsetzen des Ortsnamens
    .replace(/\b(\w+) \1\b/gi, '$1')
    .replace(/\s{2,}/g, ' ').trim();
  return { name: s || m.typeNames[0] || m.title, geber, stufe, kisten };
}

/* ---------- Unterscheiden ---------- */

// Reihenfolge, in der Merkmale zum Unterscheiden herangezogen werden —
// zugleich die Reihenfolge, in der sie im Zusatz stehen.
const ORDNUNG = ['geber', 'ware', 'klasse', 'route', 'region', 'stufe', 'rang', 'recht', 'quelle', 'typ', 'modul'] as const;
type Merkmal = (typeof ORDNUNG)[number];

export interface MissionName {
  teile: TitelTeil[];
  titel: string;
  /** Titel aus dem Arbeitsnamen abgeleitet (Mission ohne festen Spieltitel). */
  abgeleitet: boolean;
  /** Merkmale je Sprache, nur die zum Unterscheiden noetigen. */
  zusatz: Text[];
}

export interface Namensliste {
  get(slug: string): MissionName | undefined;
  /** Missionen, deren Titel + Zusatz trotzdem noch gleich lauten (Selbstauskunft). */
  restDoppelt: number;
}

export function baueMissionsNamen(
  liste: MissionFuerTitel[],
  orte: { id: string; name: string }[],
): Namensliste {
  const ortName = new Map(orte.map((o) => [o.id, o.name]));
  const basis = new Map<string, { teile: TitelTeil[]; abgeleitet: boolean; merk: Partial<Record<Merkmal, Text>>; pflicht: Merkmal[] }>();

  for (const m of liste) {
    const merk: Partial<Record<Merkmal, Text>> = {};
    const pflicht: Merkmal[] = [];
    let teile: TitelTeil[];
    let abgeleitet = false;
    const klassen = frachtKlassen(m);
    if (m.noTitle) {
      const a = ausArbeitsname(m, ortName);
      teile = [{ t: a.name, gen: false }];
      abgeleitet = true;
      if (a.geber) { merk.geber = T(a.geber); pflicht.push('geber'); }
      if (a.stufe) { merk.stufe = a.stufe; pflicht.push('stufe'); }
      if (a.kisten) merk.route = T(`${a.kisten} ${a.kisten > 1 ? 'Kisten' : 'Kiste'}`, `${a.kisten} ${a.kisten > 1 ? 'boxes' : 'box'}`);
    } else {
      const fill: Record<string, string> = {};
      if (klassen.length) fill.cargogradetoken = klassen.join('/');
      teile = titelTeile(m.title, fill);
      if (!titelText(teile)) teile = [{ t: m.typeNames[0] ?? deCamel(m.slug), gen: false }];
    }
    if (!merk.geber && m.giverNames.length) merk.geber = T(m.giverNames.slice(0, 2).join(', ') + (m.giverNames.length > 2 ? ' …' : ''));
    const w = ware(m);
    if (w) merk.ware = T(w);
    // Klasse nur als Merkmal, wenn sie nicht schon im Titel steht
    if (klassen.length && !/\{cargogradetoken\}/i.test(m.title)) merk.klasse = T(klassen.join('/'));
    const r = route(m);
    if (r && !merk.route) merk.route = r;
    const reg = region(m);
    if (reg) merk.region = T(reg);
    if (!merk.stufe && !/HaulCargo/i.test(m.module ?? '')) {
      // Stufe aus den Kennungen, wenn alle Angebote dieselbe nennen
      let einig: Text | null = null;
      let ok = m.variants.length > 0;
      for (const v of m.variants) {
        const key = v.key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
        const hit = STUFEN.find(([re]) => re.test(key));
        if (!hit) { ok = false; break; }
        if (einig && einig !== hit[1]) { ok = false; break; }
        einig = hit[1];
      }
      if (ok && einig) merk.stufe = einig;
    }
    const rg = rang(m);
    if (rg) merk.rang = rg;
    merk.recht = m.lawful && m.unlawful ? T('legal und illegal', 'lawful and unlawful') : m.unlawful ? T('illegal', 'unlawful') : T('legal', 'lawful');
    merk.quelle = m.sources.includes('broker') && !m.sources.includes('contract') ? T('Missionsbrett', 'mission board') : T('Contract-Manager', 'Contract Manager');
    if (m.typeNames.length) merk.typ = T(m.typeNames.join(', '));
    const mod = modulName(m);
    if (mod) merk.modul = T(mod);
    basis.set(m.slug, { teile, abgeleitet, merk, pflicht });
  }

  // Gruppen gleichen Titels; je Gruppe rekursiv das erste Merkmal (in
  // ORDNUNG), dessen Werte sich unterscheiden.
  const gewaehlt = new Map<string, Set<Merkmal>>();
  for (const [slug, b] of basis) gewaehlt.set(slug, new Set(b.pflicht));
  const wert = (slug: string, k: Merkmal) => basis.get(slug)!.merk[k]?.en ?? '';
  const teile = (slugs: string[], ab: number) => {
    if (slugs.length < 2) return;
    for (let i = ab; i < ORDNUNG.length; i++) {
      const k = ORDNUNG[i];
      const gruppen = new Map<string, string[]>();
      for (const s of slugs) {
        const v = wert(s, k);
        const g = gruppen.get(v);
        if (g) g.push(s); else gruppen.set(v, [s]);
      }
      if (gruppen.size < 2) continue;
      for (const s of slugs) if (wert(s, k)) gewaehlt.get(s)!.add(k);
      for (const g of gruppen.values()) teile(g, i + 1);
      return;
    }
  };
  const nachTitel = new Map<string, string[]>();
  for (const [slug, b] of basis) {
    const k = titelText(b.teile).toLowerCase();
    const g = nachTitel.get(k);
    if (g) g.push(slug); else nachTitel.set(k, [slug]);
  }
  for (const g of nachTitel.values()) teile(g, 0);

  // Wer in einer Gruppe gleichen Titels ohne Zusatz bliebe (sein Merkmal war
  // leer, das der anderen nicht), bekommt sein erstes vorhandenes Merkmal —
  // sonst steht eine Karte ohne jeden Hinweis zwischen beschrifteten.
  for (const g of nachTitel.values()) {
    if (g.length < 2) continue;
    for (const s of g) {
      const wahl = gewaehlt.get(s)!;
      const b = basis.get(s)!;
      if ([...wahl].some((k) => b.merk[k])) continue;
      const k = (['route', 'region', 'rang', 'typ', 'quelle', 'modul'] as Merkmal[]).find((x) => b.merk[x]);
      if (k) wahl.add(k);
    }
  }

  const out = new Map<string, MissionName>();
  const voll = new Map<string, number>();
  for (const [slug, b] of basis) {
    const wahl = gewaehlt.get(slug)!;
    const zusatz = ORDNUNG.filter((k) => wahl.has(k) && b.merk[k]).map((k) => b.merk[k]!);
    const titel = titelText(b.teile);
    out.set(slug, { teile: b.teile, titel, abgeleitet: b.abgeleitet, zusatz });
    const key = `${titel}|${zusatz.map((z) => z.en).join('|')}`.toLowerCase();
    voll.set(key, (voll.get(key) ?? 0) + 1);
  }
  let restDoppelt = 0;
  for (const n of voll.values()) if (n > 1) restDoppelt += n;
  return { get: (s) => out.get(s), restDoppelt };
}

/** Zusatz als eine Zeile: „Hydrogen · 1 Abholort, 2 Ziele". */
export const zusatzText = (n: MissionName, lang: Locale) => n.zusatz.map((z) => z[lang]).join(' · ');
