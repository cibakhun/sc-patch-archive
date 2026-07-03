// FleetYards extras sync — 3D holo files, paints/skins, variants and loaners
// for the ship data sheets. Same blueprint as the other syncs: fetch ->
// normalize -> committed snapshot; the live site never calls the API.
//
// Usage:  npm run sync:extras   (manual "build button" — run on patch day)
// Source: https://api.fleetyards.net/v1 (public, CORS *):
//   /models?perPage=200&page=n   list items carry name/slug/holo/hasPaints/loaners
//   /models/{slug}/paints        [{name, media.storeImage.url}]
//   /models/{slug}/variants      {items:[{name, slug}]}  (paginated object!)
// Join: FY name -> our maker-stripped catalog name. Holo files are Draco-
// compressed glTF blobs served with Access-Control-Allow-Origin:* — the
// viewer loads them client-side on demand (click-to-load).
// Fail-safe: fewer than 40 matched ships never overwrites the snapshot.
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.fleetyards.net/v1';
const OUT = new URL('../src/data/ship-extras.json', import.meta.url);
const UA = 'sc-patch-archiv fan site (non-commercial German patch archive)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json();
}

const MAKERS = ['rsi', 'drake', 'aegis', 'anvil', 'mirai', 'gatac', 'argo', 'misc', 'origin', 'crusader', 'esperia', 'kruger', 'banu', 'aopoa', 'vanduul', 'greycat', 'tumbril', 'consolidated outland', 'c.o.'];
function norm(name) {
  let n = String(name).toLowerCase().replace(/["„“”‚‘’'`´]/g, '').replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const m of MAKERS) if (n.startsWith(m + ' ')) n = n.slice(m.length + 1);
  return n.replace(/\s*\/\s*/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

// FY name -> catalog name where normalization can't bridge it (norm()ed both)
const ALIAS = {
  'san tok yai': 'santok yāi',
  'ares star fighter inferno': 'ares star fighter inferno',
  'ares star fighter ion': 'ares star fighter ion',
};

const cat = JSON.parse(await readFile(new URL('../src/data/vehicles.json', import.meta.url), 'utf8'));
const byNorm = new Map();
for (const v of cat.vehicles) byNorm.set(norm(v.name), v.id);
const ourId = (fyName) => byNorm.get(norm(fyName)) ?? byNorm.get(ALIAS[norm(fyName)] ?? '');

// full model list (paginated)
const models = [];
for (let page = 1; ; page++) {
  const r = await get(`/models?perPage=200&page=${page}`);
  const items = Array.isArray(r) ? r : (r.items ?? []);
  models.push(...items);
  if (items.length < 200) break;
  await sleep(120);
}
console.log(`FleetYards: ${models.length} Modelle geladen.`);

const extras = {};
const misses = [];
let holoCount = 0;
for (const m of models) {
  const id = ourId(m.name);
  if (!id) {
    misses.push(m.name);
    continue;
  }
  const e = {
    fySlug: m.slug,
    holo: m.holo ?? null,
    storeImage: m.media?.storeImage?.url ?? null,
    paints: [],
    variants: [],
    loaners: (m.loaners ?? []).map((l) => ({ name: l.name, id: ourId(l.name) ?? null })),
  };
  if (e.holo) holoCount++;
  extras[id] = { ...e, _hasPaints: !!m.hasPaints };
}

// paints + variants for matched ships (variants only via per-model endpoint)
const ids = Object.keys(extras);
let done = 0;
for (const id of ids) {
  const e = extras[id];
  try {
    if (e._hasPaints) {
      const p = await get(`/models/${e.fySlug}/paints`);
      const items = Array.isArray(p) ? p : (p.items ?? []);
      e.paints = items
        .map((x) => ({ name: x.name, image: x.media?.storeImage?.url ?? null }))
        .filter((x) => x.image);
      await sleep(100);
    }
    const v = await get(`/models/${e.fySlug}/variants`);
    const vitems = Array.isArray(v) ? v : (v.items ?? []);
    e.variants = vitems.map((x) => ({ name: x.name, id: ourId(x.name) ?? null }));
  } catch (err) {
    console.warn(`  warn ${e.fySlug}: ${err.message}`);
  }
  delete e._hasPaints;
  done++;
  if (done % 40 === 0) console.log(`  ...${done}/${ids.length}`);
  await sleep(100);
}

const withPaints = Object.values(extras).filter((e) => e.paints.length).length;
const withVariants = Object.values(extras).filter((e) => e.variants.length).length;
console.log(`Gematcht: ${ids.length} Schiffe · Holo: ${holoCount} · mit Paints: ${withPaints} · mit Varianten: ${withVariants}`);
if (misses.length) console.log(`Nicht gematcht (FY-Namen, erwartbar bei Konzept-/Sondermodellen): ${misses.length}`);

if (ids.length < 40) {
  console.error(`FAIL-SAFE: nur ${ids.length} Schiffe gematcht — Snapshot NICHT überschrieben.`);
  process.exit(1);
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString().slice(0, 10),
      source: 'FleetYards.net',
      matched: ids.length,
      holoCount,
      extras,
    },
    null,
    1
  )
);
console.log('Snapshot geschrieben: src/data/ship-extras.json');
