// Equipped pilot-weapon size enrichment for the vehicle catalog.
//
// WHY THIS EXISTS / WHAT WENT WRONG BEFORE:
// The vehicle LIST endpoint gives pilot fixed weapons only as name/count/dps —
// no size. A first attempt pulled a size from the DETAIL endpoint's
// `components[].weapons`, but that field is the HARDPOINT (max mountable) size,
// NOT the size of the weapon actually fitted. They diverge: the Avenger Titan's
// nose is an S4 hardpoint but ships with an S3 gun; the Arrow's four guns are
// S1+S3, not the "S3×2" the hardpoints implied; the Esperia Talon's S4
// hardpoints historically carry S3 gimbaled guns. Presenting hardpoint size as
// "weapon size" was therefore wrong.
//
// WHAT THIS DOES NOW:
// It resolves the ACTUAL EQUIPPED weapon. The detail endpoint's
// `weaponry.fixed_weapons.weapons` lists the fitted guns BY NAME; the items
// catalog (`/items?filter[type]=WeaponGun`) gives each gun's real size class.
// We join name -> size and aggregate, so the site shows the size of the gun the
// ship is actually equipped with. Weapons the catalog can't resolve are left
// out rather than guessed. Writes `fixedWeaponSizes: [{size, count}]` and drops
// the old, misleading `fixedWeaponMounts` field. Every other field is untouched.
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

// 1) weapon-gun catalog: name -> size class (the real fitted-weapon size)
const gunSize = new Map();
for (let page = 1; ; page++) {
  const j = await get(`${API}/items?filter[type]=WeaponGun&limit=100&page=${page}`);
  if (!j || !j.data?.length) break;
  for (const it of j.data) if (it.name && it.size != null) gunSize.set(it.name.toLowerCase(), it.size);
  if (!j.meta || page >= j.meta.last_page) break;
  await sleep(150);
}
console.log(`indexed ${gunSize.size} WeaponGun items (name -> size)`);

// 2) slug -> uuid (the detail route keys on uuid; some list slugs 404)
const uuidBySlug = new Map();
for (let n = 1; ; n++) {
  const r = await get(`${API}/vehicles?limit=50&page=${n}`);
  if (!r) break;
  for (const v of r.data) if (v.slug && v.uuid) uuidBySlug.set(v.slug, v.uuid);
  if (n >= r.meta.last_page) break;
  await sleep(200);
}

// 3) resolve each vehicle's equipped fixed weapons -> sizes
let withSizes = 0, partial = 0, noDetail = 0;
const unresolvedNames = new Map();
for (const v of snapshot.vehicles) {
  delete v.fixedWeaponMounts; // remove the old (hardpoint-based) field
  v.fixedWeaponSizes = [];
  const uuid = uuidBySlug.get(v.id);
  const d = uuid ? await get(`${API}/vehicles/${uuid}`) : null;
  if (!d?.data) { noDetail++; continue; }
  const fitted = d.data.weaponry?.fixed_weapons?.weapons ?? [];
  if (!fitted.length) { await sleep(90); continue; }
  const bySize = new Map();
  let unresolved = 0;
  for (const w of fitted) {
    const size = gunSize.get((w.name ?? '').toLowerCase());
    if (size == null) { unresolved++; unresolvedNames.set(w.name, (unresolvedNames.get(w.name) ?? 0) + 1); continue; }
    bySize.set(size, (bySize.get(size) ?? 0) + 1);
  }
  v.fixedWeaponSizes = [...bySize.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => ({ size, count }));
  // flag = true when at least one fitted gun could not be resolved to a size
  // (so the consumer can decide whether to trust a partial list)
  v.fixedWeaponSizesPartial = unresolved > 0 && bySize.size > 0 ? true : undefined;
  if (v.fixedWeaponSizes.length) withSizes++;
  if (unresolved > 0) partial++;
  await sleep(90);
}

console.log(`resolved sizes for ${withSizes}/${snapshot.vehicles.length} vehicles (${partial} partial, ${noDetail} no detail)`);
if (unresolvedNames.size) {
  const top = [...unresolvedNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('unresolved weapon names (not in WeaponGun catalog):');
  for (const [n, c] of top) console.log(`  ${c}× ${n}`);
}

await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log('wrote src/data/vehicles.json (fixedWeaponSizes = equipped-weapon sizes)');
