// ═══════════════════════════════════════════════════════════════════════════
//  data.mjs — the "Flight Computer" data layer (bilingual EN / DE).
//
//  Loads a snapshot of the site's own JSON (ships, commodity/item prices,
//  patches, manufacturers) and exposes fuzzy search. Same data that builds
//  verse-base.com, so nothing drifts. Reloaded periodically so committed
//  price/patch updates flow through without a restart.
//
//  Language: the raw records carry both languages where the site has them
//  (ships: typeEn/typeDe/statusEn/statusDe; patches: German base + an English
//  overlay in patches-en.json). Records are stored language-neutral; call
//  localizedShip()/localizedPatch(record, locale) at render time to project
//  the record into one language. Commodity/item data (names, kinds, sale
//  locations) is UEX-canonical English and shown as-is in both languages.
//
//  Path: DATA_DIR env (set in the container) or the repo's src/data in dev.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || join(here, '..', '..', '..', 'src', 'data');
export const SITE = 'https://verse-base.com';

const load = (f) => {
  try { return JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')); }
  catch { return null; }
};

// ── normalization + fuzzy search ────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

function scoreName(name, nq) {
  const n = norm(name);
  if (!n || !nq) return -1;
  if (n === nq) return 100;
  const words = n.split(' ');
  if (words.includes(nq)) return 85;
  if (n.startsWith(nq)) return 80 - (n.length - nq.length) * 0.1;
  if (words.some((w) => w.startsWith(nq))) return 65;
  if (n.includes(nq)) return 55 - (n.length - nq.length) * 0.03;
  return -1;
}

function bestMatch(list, q, nameFn) {
  const nq = norm(q);
  let best = null, score = 0;
  for (const it of list) {
    const s = scoreName(nameFn(it), nq);
    if (s > score) { score = s; best = it; }
  }
  return best;
}

function topMatches(list, q, nameFn, n = 5) {
  const nq = norm(q);
  if (!nq) return list.slice(0, n);
  return list
    .map((it) => ({ it, s: scoreName(nameFn(it), nq) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.it);
}

// ── language maps (German source → English) ─────────────────────────────────
// Ship size is a 6-value enum; ship focus is a bounded gameplay vocabulary. The
// site stores these German-only, so we translate for English readers. German
// readers get the raw value. Anything unmapped falls back to the source string.
const SIZE_EN = {
  Klein: 'Small', Mittel: 'Medium', Groß: 'Large',
  Kapitalklasse: 'Capital', Beiboot: 'Snub', Fahrzeug: 'Vehicle',
};
const FOCUS_EN = {
  Einsteiger: 'Starter', Reisen: 'Touring', 'Leichter Jäger': 'Light Fighter',
  'Leichter Frachter': 'Light Freight', Komfort: 'Comfort', Pfadfinder: 'Pathfinder',
  Abriegelung: 'Interdiction', Abrieglung: 'Interdiction', Rennsport: 'Racing',
  Forschungsreisen: 'Expedition', 'Luxus-Reisen': 'Luxury Touring', Bomber: 'Bomber',
  'Schwerer Bomber': 'Heavy Bomber', Medizin: 'Medical', 'Schwerer Jäger': 'Heavy Fighter',
  Landungsschiff: 'Dropship', Industrie: 'Industrial', Militär: 'Military',
  'Mittlerer Frachter': 'Medium Freight', Schwertransport: 'Heavy Hauling',
  Erkundung: 'Exploration', Gefecht: 'Combat', Generalist: 'Generalist',
  Kanonenboot: 'Gunship', Aufklärung: 'Reconnaissance', Luftabwehr: 'Anti-Air',
  Angriff: 'Assault', Tarnkappenbomber: 'Stealth Bomber', 'Mittlerer Jäger': 'Medium Fighter',
  Tarnkappenjäger: 'Stealth Fighter', 'Beiboot Jäger': 'Snub Fighter', Bergbau: 'Mining',
  'Schweres Kanonenboot': 'Heavy Gunship', 'Mittlerer Datentransport': 'Medium Data Runner',
  Fregatte: 'Frigate', Zerstörer: 'Destroyer', 'Luxus-Transport': 'Luxury Transport',
  'Militärischer Transport': 'Military Transport', 'Mittlerer Frachttransport': 'Medium Cargo',
  Prospektierung: 'Prospecting', Berichterstattung: 'Journalism', 'Einfache Forschung': 'Basic Research',
  Passagier: 'Passenger', Transport: 'Transport', Fracht: 'Cargo', Korvette: 'Corvette',
  Tarnung: 'Stealth', Großbergung: 'Heavy Salvage', 'Einfache Bergung': 'Light Salvage',
  Bergung: 'Salvage', Kampfunterstützung: 'Combat Support', Transporter: 'Hauler',
};

// Patch metadata (German-only in the base data) → English.
const ERA_EN = {
  'Pyro-Ära': 'Pyro', 'Sturm & Stahl': 'Storm & Steel', 'Onyx & Heilung': 'Onyx & Healing',
  'Neue Horizonte': 'New Horizons', 'Tactical Strike': 'Tactical Strike', Frontier: 'Frontier',
};
const PATCH_TYPE = {
  en: { major: 'Major', point: 'Point' },
  de: { major: 'Großes Update', point: 'Point-Release' },
};

// ── loaders ─────────────────────────────────────────────────────────────────
function loadShips() {
  const vehicles = load('vehicles.json')?.vehicles || [];
  const specs = load('ships.json')?.ships || [];
  const specByName = new Map(specs.map((s) => [norm(s.name), s]));
  return vehicles.map((v) => {
    const s = specByName.get(norm(v.name)) || {};
    return {
      id: v.id,
      name: v.name,
      manufacturer: v.manufacturer,
      makerCode: v.makerCode,
      // language-typed fields kept raw; project with localizedShip()
      typeEn: v.typeEn || null,
      typeDe: v.typeDe || null,
      sizeDe: v.sizeDe || null,
      statusEn: v.statusEn || null,
      statusDe: v.statusDe || null,
      fociDe: Array.isArray(v.fociDe) ? v.fociDe : [],
      classification: s.classification || null,
      cargoSCU: s.cargoSCU ?? null,
      crewMin: s.crewMin ?? null,
      crewMax: s.crewMax ?? null,
      lengthM: s.lengthM ?? null,
      priceUSD: s.priceUSD ?? null,
    };
  });
}

function loadCommodities() {
  const c = load('commodity-prices.json')?.commodities;
  return c ? Object.values(c) : [];
}

function loadItems() {
  const it = load('item-prices.json')?.items;
  return it ? Object.values(it) : [];
}

function loadPatches() {
  let files = [];
  try { files = readdirSync(join(DATA_DIR, 'patches')).filter((f) => f.endsWith('.json')); }
  catch { return []; }
  const en = load('patches-en.json')?.patches || {};
  const patches = files
    .map((f) => load(join('patches', f)))
    .filter(Boolean)
    .map((p) => {
      // patches-en.json is keyed "4-9-0"; base files carry version "4.9.0".
      // Normalize so the English overlay actually matches (this join silently
      // failed before → every patch fell back to German).
      const key = String(p.version).replace(/\./g, '-');
      return { ...p, en: en[key] || en[p.version] || null };
    });
  patches.sort((a, b) => (String(b.date) > String(a.date) ? 1 : -1)); // newest first
  return patches;
}

// ── in-memory store (reloadable) ────────────────────────────────────────────
let store = { ships: [], commodities: [], items: [], patches: [], manufacturers: {} };

export function reload() {
  store = {
    ships: loadShips(),
    commodities: loadCommodities(),
    items: loadItems(),
    patches: loadPatches(),
    manufacturers: load('manufacturer-logos.json') || {},
  };
  return counts();
}

export function counts() {
  return {
    ships: store.ships.length,
    commodities: store.commodities.length,
    items: store.items.length,
    patches: store.patches.length,
    manufacturers: Object.keys(store.manufacturers).length,
  };
}

reload(); // initial load at import

// ── localization projections ────────────────────────────────────────────────
/** Project a raw ship record into one language for display. */
export function localizedShip(s, locale) {
  if (!s) return s;
  const de = locale === 'de';
  const foci = s.fociDe.length
    ? (de ? s.fociDe : s.fociDe.map((f) => FOCUS_EN[f] || f)).join(', ')
    : null;
  return {
    id: s.id, name: s.name, manufacturer: s.manufacturer, makerCode: s.makerCode,
    type: de ? (s.typeDe || s.classification || s.typeEn) : (s.classification || s.typeEn || s.typeDe),
    size: s.sizeDe ? (de ? s.sizeDe : (SIZE_EN[s.sizeDe] || s.sizeDe)) : null,
    status: de ? (s.statusDe || s.statusEn) : (s.statusEn || s.statusDe),
    focus: foci,
    cargoSCU: s.cargoSCU, crewMin: s.crewMin, crewMax: s.crewMax,
    lengthM: s.lengthM, priceUSD: s.priceUSD,
  };
}

/** Project a raw patch record into one language for display. */
export function localizedPatch(p, locale) {
  if (!p) return p;
  const de = locale === 'de';
  const en = p.en || {};
  const typeMap = de ? PATCH_TYPE.de : PATCH_TYPE.en;
  return {
    version: p.version,
    codename: p.codename,
    era: p.era ? (de ? p.era : (ERA_EN[p.era] || p.era)) : null,
    type: p.type ? (typeMap[p.type] || p.type) : null,
    date: p.date,
    dateDisplay: de ? p.dateDisplay : (en.dateDisplayEn || en.dateDisplay || p.dateDisplay),
    notesUrl: p.notesUrl,
    summary: de ? (p.summary || p.tagline) : (en.summary || en.tagline || p.summary || p.tagline),
    tagline: de ? p.tagline : (en.tagline || p.tagline),
    keyFacts: de ? p.keyFacts : (en.keyFacts || p.keyFacts),
    features: de ? p.features : (en.features || p.features),
    wipe: de ? p.wipe : (en.wipe || p.wipe),
    heroImage: p.heroImage,
  };
}

// ── public queries ──────────────────────────────────────────────────────────
export const findShip = (q) => bestMatch(store.ships, q, (s) => s.name)
  || bestMatch(store.ships, q, (s) => `${s.makerCode} ${s.name}`);
export const suggestShips = (q, n = 8) => topMatches(store.ships, q, (s) => s.name, n);

export const findCommodity = (q) => bestMatch(store.commodities, q, (c) => c.name)
  || bestMatch(store.commodities, q, (c) => c.code);
export const suggestCommodities = (q, n = 8) => topMatches(store.commodities, q, (c) => c.name, n);

export const findItem = (q) => bestMatch(store.items, q, (i) => i.name);
export const suggestItems = (q, n = 8) => topMatches(store.items, q, (i) => i.name, n);

export const latestPatch = () => store.patches[0] || null;
export const findPatch = (v) => store.patches.find((p) => norm(p.version) === norm(v))
  || bestMatch(store.patches, v, (p) => `${p.version} ${p.codename}`);
export const allPatches = () => store.patches;

export const manufacturers = () => store.manufacturers;
