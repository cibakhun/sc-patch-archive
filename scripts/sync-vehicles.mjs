// Star Citizen Wiki API v2 vehicle-catalog sync — the ship database backbone
// (Phase 1). Same blueprint as sync-ships: fetch -> normalize -> committed
// snapshot; the live site never calls the API.
//
// Usage:  npm run sync:vehicles   (manual "build button" — run on patch day)
// Source: https://api.star-citizen.wiki/api/v2/vehicles (no auth; localized
// fields carry native German). ~290 vehicles over ~6 paginated requests.
// Fail-safe: a run that yields fewer than 100 vehicles never overwrites the
// existing snapshot (guards against partial/broken API responses).
import { readFile, writeFile, readdir } from 'node:fs/promises';

const API = 'https://api.star-citizen.wiki/api/v2';
const OUT = new URL('../src/data/vehicles.json', import.meta.url);
const UA = 'sc-patch-archiv fan site (non-commercial German patch archive)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** pick German from a localized object, fall back to English/string */
const loc = (x) =>
  x == null ? null : typeof x === 'string' ? x : x.de_DE ?? x.en_EN ?? null;

const MAKERS = ['rsi', 'drake', 'aegis', 'anvil', 'mirai', 'gatac', 'argo', 'misc', 'origin', 'crusader', 'esperia', 'kruger', 'banu', 'aopoa', 'vanduul'];
function strip(name) {
  let n = name.toLowerCase().replace(/["„“”‚‘’']/g, '').replace(/\s+/g, ' ').trim();
  for (const m of MAKERS) if (n.startsWith(m + ' ')) n = n.slice(m.length + 1);
  return n;
}

// patch-spine join: stripped ship name -> patch versions from the data layer
const PDIR = new URL('../src/data/patches/', import.meta.url);
const spine = new Map();
for (const f of (await readdir(PDIR)).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(await readFile(new URL(f, PDIR), 'utf8'));
  for (const s of j.ships ?? []) {
    const k = strip(s.name);
    if (!spine.has(k)) spine.set(k, new Set());
    spine.get(k).add(j.version);
  }
}

async function page(n) {
  const res = await fetch(`${API}/vehicles?limit=50&page=${n}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on page ${n}`);
  return res.json();
}

const vehicles = [];
let meta = null;
for (let n = 1; ; n++) {
  const r = await page(n);
  meta = r.meta;
  for (const v of r.data) {
    const fociRaw = Array.isArray(v.foci) ? v.foci : v.foci ? [v.foci] : [];
    const key = strip(v.name);
    vehicles.push({
      id: v.slug,
      name: v.name,
      manufacturer: v.manufacturer?.name ?? null,
      makerCode: v.manufacturer?.code ?? null,
      typeDe: loc(v.type),
      typeEn: v.type?.en_EN ?? null,
      sizeDe: loc(v.size),
      statusDe: loc(v.production_status),
      statusEn: v.production_status?.en_EN ?? null,
      fociDe: fociRaw.map((f) => loc(f)).filter(Boolean),
      descriptionDe: loc(v.description),
      crewMin: v.crew?.min ?? null,
      crewMax: v.crew?.max ?? null,
      cargoSCU: v.cargo_capacity ?? null,
      msrpUSD: v.msrp ?? null,
      lengthM: v.dimension?.length ?? null,
      widthM: v.dimension?.width ?? null,
      heightM: v.dimension?.height ?? null,
      scmSpeed: v.speed?.scm ?? null,
      maxSpeed: v.speed?.max ?? null,
      isSpaceship: v.is_spaceship ?? null,
      isGravlev: v.is_gravlev ?? null,
      pledgeUrl: v.pledge_url ?? null,
      /** patch-spine: patches in OUR archive that introduced/touched it */
      patches: spine.has(key) ? [...spine.get(key)].sort() : [],
      gameVersion: v.version ?? null,
    });
  }
  console.log(`page ${n}/${meta.last_page}: ${vehicles.length}/${meta.total}`);
  if (n >= meta.last_page) break;
  await sleep(300);
}

if (vehicles.length < 100) {
  console.error(`only ${vehicles.length} vehicles — keeping existing snapshot, aborting.`);
  process.exit(1);
}

const snapshot = {
  fetchedAt: new Date().toISOString().slice(0, 10),
  source: 'Star Citizen Wiki API (api.star-citizen.wiki/api/v2/vehicles) — Community-Projekt, Daten aus den Spieldateien',
  gameVersion: vehicles.find((v) => v.gameVersion)?.gameVersion ?? null,
  count: vehicles.length,
  vehicles: vehicles.sort((a, b) => a.name.localeCompare(b.name, 'de')),
};
await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
const joined = vehicles.filter((v) => v.patches.length).length;
console.log(`\nwrote src/data/vehicles.json: ${vehicles.length} vehicles (${joined} joined to the patch spine)`);
