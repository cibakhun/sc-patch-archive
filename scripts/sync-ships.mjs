// FleetYards ship-spec sync — the first external data source, following the
// architecture blueprint: fetch at sync time -> normalize -> snapshot
// committed to git. The live site never calls the API.
//
// Usage:  npm run sync:ships   (manual "build button" — run on patch day)
// Source: https://api.fleetyards.net/v1 (no auth, 5000 req/h unauthenticated)
// Resolution: FleetYards slugs are maker-stripped kebab names ("polaris",
// "ironclad-assault", "l-21-wolf"); specials go through the ALIAS map.
// Fail-safe: a run that resolves 0 ships never overwrites the snapshot.
import { readFile, writeFile, readdir } from 'node:fs/promises';

const API = 'https://api.fleetyards.net/v1';
const OUT = new URL('../src/data/ships.json', import.meta.url);
const UA = 'sc-patch-archiv fan site (non-commercial; German patch archive)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MAKERS = ['rsi', 'drake', 'aegis', 'anvil', 'mirai', 'gatac', 'argo', 'misc', 'origin', 'crusader', 'esperia', 'kruger', 'banu', 'aopoa', 'vanduul'];

/** special cases where the slug isn't the stripped kebab name */
const ALIAS = {
  'rsi apollo': ['apollo-triage'],
  'aegis idris': ['idris-m'],
  'argo atls ikti': ['atls-ikti', 'atls'],
  // a ship-attached module, not a ship — intentionally unresolved
  'drake command module': [],
};

function strip(name) {
  let n = name.toLowerCase().replace(/["„“”‚‘’']/g, '').replace(/\s+/g, ' ').trim();
  for (const m of MAKERS) if (n.startsWith(m + ' ')) n = n.slice(m.length + 1);
  return n;
}
const kebab = (s) => s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function fyModel(slug) {
  const res = await fetch(`${API}/models/${slug}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${slug}`);
  return res.json();
}

// Canonical vehicle ids come from the Wiki snapshot (= detail-page slugs).
// FY slugs normally coincide, but not always (Basher: FY "grey-basher" vs
// game/Wiki "glsn-basher") — join by name so ships.json ids stay canonical.
const VEH = JSON.parse(
  await readFile(new URL('../src/data/vehicles.json', import.meta.url), 'utf8')
).vehicles;
const vehId = new Map(VEH.map((v) => [v.name.toLowerCase(), v.id]));

// 1) collect unique ship names from the patch data layer
const PDIR = new URL('../src/data/patches/', import.meta.url);
const wanted = new Map();
for (const f of (await readdir(PDIR)).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(await readFile(new URL(f, PDIR), 'utf8'));
  for (const s of j.ships ?? []) {
    const key = s.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!wanted.has(key)) wanted.set(key, { name: s.name, patches: [] });
    wanted.get(key).patches.push(j.version);
  }
}
console.log(`ships referenced in patch data: ${wanted.size}`);

// 2) resolve each via slug candidates
const ships = [];
const misses = [];
for (const [key, w] of wanted) {
  const candidates =
    key in ALIAS ? ALIAS[key] : [kebab(strip(w.name)), kebab(key)];
  let m = null;
  try {
    for (const slug of candidates) {
      m = await fyModel(slug);
      await sleep(200);
      if (m) break;
    }
  } catch (e) {
    console.log(`  FAIL  ${w.name}: ${e.message}`);
  }
  if (!m) {
    misses.push(w.name);
    console.log(`  miss  ${w.name}${candidates.length ? '' : ' (intentional: no ship entry)'}`);
    continue;
  }
  ships.push({
    id: vehId.get(m.name.toLowerCase()) ?? vehId.get(strip(w.name)) ?? m.slug,
    name: m.name,
    matchedFrom: w.name,
    manufacturer: m.manufacturer?.name ?? null,
    classification: m.classificationLabel ?? null,
    focus: m.focus ?? null,
    productionStatus: m.productionStatus ?? null,
    cargoSCU: m.metrics?.cargo ?? null,
    crewMin: m.crew?.min ?? null,
    crewMax: m.crew?.max ?? null,
    lengthM: m.metrics?.length ?? null,
    sizeLabel: m.metrics?.sizeLabel ?? null,
    priceUSD: m.pledgePrice ?? null,
    fleetyardsUrl: `https://fleetyards.net/ships/${m.slug}`,
    patches: [...new Set(w.patches)].sort(),
  });
  console.log(`  ok    ${w.name}  ->  ${m.name} (${m.slug})`);
}

// 3) never wipe a good snapshot with a bad run
if (ships.length === 0) {
  console.error('0 ships resolved — keeping existing snapshot, aborting write.');
  process.exit(1);
}
const snapshot = {
  fetchedAt: new Date().toISOString().slice(0, 10),
  source: 'FleetYards.net (api.fleetyards.net/v1) — fan-made, based on the official Ship Matrix',
  misses,
  ships: ships.sort((a, b) => a.name.localeCompare(b.name)),
};
await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log(`\nwrote src/data/ships.json: ${ships.length} ships, ${misses.length} misses${misses.length ? ' (' + misses.join(', ') + ')' : ''}`);
