// ═══════════════════════════════════════════════════════════════════════════
//  data.mjs — the "Flight Computer" data layer.
//
//  Loads a snapshot of the site's own JSON (ships, commodity/item prices,
//  patches, manufacturers) and exposes fuzzy search. Same data that builds
//  verse-base.com, so nothing drifts. Reloaded periodically so committed
//  price/patch updates flow through without a restart.
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
      type: v.typeEn || v.typeDe || null,
      size: v.sizeDe || null,
      status: v.statusEn || v.statusDe || null,
      focus: Array.isArray(v.fociDe) ? v.fociDe.join(', ') : null,
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
    .map((p) => ({ ...p, ...(en[p.version] || {}) }));
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
