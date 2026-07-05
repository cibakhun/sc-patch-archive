// Weapon-hardpoint size enrichment for the vehicle catalog.
//
// The vehicle LIST endpoint (used by sync-vehicles.mjs) exposes pilot fixed
// weapons only as name/count/dps — no size class. The per-vehicle DETAIL
// endpoint, however, carries a `components` array whose `weapons` entries give
// the pilot-weapon MOUNT size (e.g. "S4 Weapon", size 4, mounts 2). That mount
// size is exactly the "Größe" we want to show next to each ship's guns.
//
// This is a surgical, additive pass: it reads the committed snapshot, fetches
// ONLY the weapon-mount sizes per vehicle (joined by uuid), and writes back a
// single new field `fixedWeaponMounts: [{size, count}]`. Every other field in
// vehicles.json is left byte-for-byte untouched, so the diff is minimal and the
// enrichment can be re-run any time after a full sync.
//
// Usage:  node scripts/enrich-weapon-sizes.mjs
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.star-citizen.wiki/api/v2';
const OUT = new URL('../src/data/vehicles.json', import.meta.url);
const UA = 'sc-patch-archiv fan site (non-commercial German patch archive)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (r.ok) return r.json();
      if (r.status === 404) return null;
    } catch { /* retry */ }
    await sleep(400 * (i + 1));
  }
  return null;
}

const snapshot = JSON.parse(await readFile(OUT, 'utf8'));
const bySlug = new Map(snapshot.vehicles.map((v) => [v.id, v]));

// 1) page the list to map slug -> uuid (the detail endpoint keys on uuid;
//    some list slugs 404 on the detail route).
const uuidBySlug = new Map();
for (let n = 1; ; n++) {
  const r = await get(`${API}/vehicles?limit=50&page=${n}`);
  if (!r) break;
  for (const v of r.data) if (v.slug && v.uuid) uuidBySlug.set(v.slug, v.uuid);
  if (n >= r.meta.last_page) break;
  await sleep(250);
}
console.log(`mapped ${uuidBySlug.size} slugs -> uuid`);

// 2) fetch each catalog vehicle's detail, extract the weapon-mount sizes.
let enriched = 0, withMounts = 0, missing = [];
for (const v of snapshot.vehicles) {
  const uuid = uuidBySlug.get(v.id);
  const d = uuid ? await get(`${API}/vehicles/${uuid}`) : null;
  if (!d?.data) { missing.push(v.id); v.fixedWeaponMounts = []; continue; }
  const bySize = new Map();
  for (const c of d.data.components ?? []) {
    if (c.type !== 'weapons') continue;
    const size = Number(c.size);
    const count = (c.mounts ?? 1) * (c.quantity ?? 1);
    if (!Number.isFinite(size) || size <= 0 || count <= 0) continue;
    bySize.set(size, (bySize.get(size) ?? 0) + count);
  }
  v.fixedWeaponMounts = [...bySize.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([size, count]) => ({ size, count }));
  enriched++;
  if (v.fixedWeaponMounts.length) withMounts++;
  await sleep(120);
}

console.log(`enriched ${enriched}/${snapshot.vehicles.length} (${withMounts} have weapon mounts)`);
if (missing.length) console.log(`no detail for ${missing.length}: ${missing.join(', ')}`);

await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log('wrote src/data/vehicles.json (added fixedWeaponMounts)');
