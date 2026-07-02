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
// variant → base aliases: patch-data ships whose exact variant the catalog
// drops as unclassified — the base entry carries the spine link instead.
// ("Command Module" stays an intentional miss: it's a module, not a vehicle.)
const SPINE_ALIAS = { 'atls ikti': 'atls' };
for (const [from, to] of Object.entries(SPINE_ALIAS)) {
  if (!spine.has(from)) continue;
  if (!spine.has(to)) spine.set(to, new Set());
  for (const p of spine.get(from)) spine.get(to).add(p);
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
    // fixed pilot weapons, grouped by name with counts
    const fixedList = v.weaponry?.fixed_weapons?.weapons ?? [];
    const grouped = {};
    for (const w of fixedList) {
      grouped[w.name] = grouped[w.name] ?? { name: w.name, count: 0, dps: w.dps ?? null };
      grouped[w.name].count++;
    }

    // weapon hardpoints: turret stations carry real mount size classes plus
    // the equipped weapon names in the LIST response — aggregate per category.
    // (Pilot-fixed guns come without per-mount sizes at this depth; they stay
    // name/dps-only rather than getting a fabricated S-class.)
    const turretCat = (list, label) => {
      const stations = (list ?? []).filter(
        (t) => (t.mounts?.length ?? 0) > 0 || (t.weapons?.length ?? 0) > 0
      );
      if (!stations.length) return null;
      const sizes = {};
      const weapons = {};
      const payloadTypes = new Set();
      let dps = 0;
      for (const t of stations) {
        if (t.mounts?.length) {
          for (const m of t.mounts) {
            const s = m.size ?? t.size;
            if (s != null) sizes[s] = (sizes[s] ?? 0) + 1;
          }
        } else if (t.size != null) {
          sizes[t.size] = (sizes[t.size] ?? 0) + 1;
        }
        for (const w of t.weapons ?? []) weapons[w.name] = (weapons[w.name] ?? 0) + 1;
        for (const pt of t.payload_types ?? []) payloadTypes.add(pt);
        if (t.dps_total) dps += t.dps_total;
      }
      return {
        label,
        stations: stations.length,
        sizes: Object.entries(sizes)
          .map(([size, count]) => ({ size: Number(size), count }))
          .sort((a, b) => a.size - b.size),
        weapons: Object.entries(weapons).map(([name, count]) => ({ name, count })),
        payloadTypes: [...payloadTypes],
        dps: dps ? Math.round(dps * 10) / 10 : null,
      };
    };
    const turrets = [
      turretCat(v.turrets?.manned, 'Bemannte Türme'),
      turretCat(v.turrets?.remote, 'Ferngesteuerte Türme'),
      turretCat(v.turrets?.pdc, 'Punktverteidigung (PDC)'),
    ].filter(Boolean);

    // equipped loadout from the port list: missile racks, countermeasures and
    // the core components (each with item name + size class)
    const portAgg = {};
    for (const p of v.ports ?? []) {
      const cat = p.category_label;
      const name = p.equipped_item?.name;
      if (!cat || !name) continue;
      const size = p.equipped_item?.size ?? p.sizes?.max ?? null;
      const k = `${cat}__${name}__${size}`;
      portAgg[k] = portAgg[k] ?? { cat, name, size, count: 0 };
      portAgg[k].count++;
    }
    const portsOf = (cat) =>
      Object.values(portAgg)
        .filter((g) => g.cat === cat)
        .map(({ name, size, count }) => ({ name, size, count }));
    const missileRacks = portsOf('Missile & Bomb Racks');
    const components = {
      powerPlants: portsOf('Power Plants'),
      shields: portsOf('Shields'),
      coolers: portsOf('Coolers'),
      quantumDrives: portsOf('Quantum Drives'),
      radars: portsOf('Radars'),
    };
    const cmLaunchers = Object.values(portAgg)
      .filter((g) => g.cat === 'Counter Measures')
      .reduce((n, g) => n + g.count, 0);

    // ship image from the API (starcitizen.tools media). MediaWiki thumbs are
    // width-addressable — swap the `NNNpx-` segment, capped at the original.
    const img0 = v.images?.[0] ?? null;
    const thumbAt = (img, w) => {
      if (!img.thumbnail_url) return img.original_url ?? null;
      const cap = img.original_width ? Math.min(w, img.original_width) : w;
      return img.thumbnail_url.replace(/\/\d+px-/, `/${cap}px-`);
    };
    const image = img0
      ? {
          hero: thumbAt(img0, 1280),
          thumb: thumbAt(img0, 320),
          source: img0.source ?? null,
        }
      : null;

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
      oreSCU: v.ore_capacity ?? null,
      msrpUSD: v.msrp ?? null,
      lengthM: v.dimension?.length ?? null,
      widthM: v.dimension?.width ?? null,
      heightM: v.dimension?.height ?? null,
      scmSpeed: v.speed?.scm ?? null,
      maxSpeed: v.speed?.max ?? null,
      boostForward: v.speed?.boost_forward ?? null,
      pitch: v.agility?.pitch ?? null,
      yaw: v.agility?.yaw ?? null,
      roll: v.agility?.roll ?? null,
      pilotDps: v.weaponry?.pilot_dps ?? null,
      turretDps: v.weaponry?.turret_dps ?? null,
      fixedWeapons: Object.values(grouped),
      turrets,
      missileCount: v.weaponry?.missiles?.count ?? null,
      missileRacks,
      cmLaunchers,
      components,
      hullHp: v.health ?? null,
      shieldHp: v.shield_hp ?? null,
      qtSpeedMs: v.quantum?.quantum_speed ?? null,
      qtRangeM: v.quantum?.quantum_range ?? null,
      qtSpoolS: v.quantum?.quantum_spool_time ?? null,
      qtFuel: v.quantum?.quantum_fuel_capacity ?? null,
      h2Fuel: v.fuel?.capacity ?? null,
      insClaimMin: v.insurance?.claim_time ?? null,
      insExpediteMin: v.insurance?.expedite_time ?? null,
      insExpediteCost: v.insurance?.expedite_cost ?? null,
      isSpaceship: v.is_spaceship ?? null,
      isGravlev: v.is_gravlev ?? null,
      pledgeUrl: v.pledge_url ?? null,
      /** patch-spine: patches in OUR archive that introduced/touched it */
      patches: spine.has(key) ? [...spine.get(key)].sort() : [],
      gameVersion: v.version ?? null,
      image,
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

// dedupe show/collector/paint editions that share the exact same name
// (F8C Lightning + -plat, Carrack + -bis2950, Hammerhead + -gs, Idris-P ×3 …)
// keep the base variant: unsuffixed slug wins, then the shorter slug.
const EDITION = /-(bis\d+|plat|exec(-[a-z]+)?|collector(-[a-z]+)?|gs|tsg|fw-\d+)$/;
const byName = new Map();
let dropped = 0;
for (const v of vehicles) {
  const cur = byName.get(v.name);
  if (!cur) {
    byName.set(v.name, v);
    continue;
  }
  dropped++;
  const curEd = EDITION.test(cur.id) ? 1 : 0;
  const vEd = EDITION.test(v.id) ? 1 : 0;
  const pick =
    curEd !== vEd ? (curEd < vEd ? cur : v) : cur.id.length <= v.id.length ? cur : v;
  byName.set(v.name, pick);
}
const deduped = [...byName.values()];
console.log(`deduped ${dropped} edition duplicates -> ${deduped.length} vehicles`);

// drop entries the API leaves unclassified — promo/livery SKUs (Wikelo waves,
// PYAM Exec, Executive Editions) plus a few game-file-only entities (modules,
// NPC hulls). They carry no type/status/description and would render as blank
// "—" rows. Self-maintaining: an entry gaining classification upstream is
// re-admitted on the next sync.
const classified = deduped.filter((v) => v.typeDe != null || v.statusDe != null);
const unclassified = deduped.filter((v) => v.typeDe == null && v.statusDe == null);
if (unclassified.length) {
  console.log(
    `dropped ${unclassified.length} unclassified entries (editions/liveries/modules):`
  );
  console.log('  ' + unclassified.map((v) => v.name).join(' | '));
  for (const v of unclassified.filter((x) => x.patches.length))
    console.warn(`  WARNING: dropped "${v.name}" had patch-spine joins: ${v.patches.join(', ')}`);
}

const snapshot = {
  fetchedAt: new Date().toISOString().slice(0, 10),
  source: 'Star Citizen Wiki API (api.star-citizen.wiki/api/v2/vehicles) — Community-Projekt, Daten aus den Spieldateien',
  gameVersion: classified.find((v) => v.gameVersion)?.gameVersion ?? null,
  count: classified.length,
  vehicles: classified.sort((a, b) => a.name.localeCompare(b.name, 'de')),
};
await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
const joined = classified.filter((v) => v.patches.length).length;
const withImage = classified.filter((v) => v.image).length;
console.log(
  `\nwrote src/data/vehicles.json: ${classified.length} vehicles ` +
    `(${joined} joined to the patch spine, ${withImage} with an API image)`
);
