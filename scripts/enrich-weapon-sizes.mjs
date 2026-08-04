// Größe der montierten Pilotenwaffen je Schiff — aus den Spieldateien.
//
// WAS HIER SCHON ZWEIMAL SCHIEFGING:
// (1) Erst kam die Größe aus dem HARDPOINT (`components[].weapons` des
//     Detail-Endpunkts). Das ist die maximal montierbare Größe, nicht die der
//     verbauten Waffe — der Avenger Titan hat einen S4-Bug mit S3-Kanone.
// (2) Dann wurde die Größe über einen globalen Katalog Name -> Größe aufgelöst
//     (`gunSize.set(name.toLowerCase(), size)`). Anzeigenamen sind im Spiel aber
//     NICHT eindeutig. Vier verschiedene Items heißen "Revenant Gatling":
//       S3  anvl_ballisticgatling_bespoke
//       S4  apar_ballisticgatling_s4        <- die der Buccaneer wirklich trägt
//       S6  bengal_ballisticgatling_s6      <- die des Bengal-Trägers
//       S4  apar_ballisticgatling_s4_lowpoly
//     Beim Füllen der Map gewann schlicht der zuletzt gelesene Eintrag. So stand
//     auf Buccaneer, allen Hornets Mk II, den Avengers und der Idris eine
//     S6-Gatling, obwohl S4 verbaut ist ("Tarantula GT-870 Mark 3 Cannon"
//     genauso: S8 statt S3 auf F8C und Wildfire).
//
// WAS JETZT PASSIERT:
// Der Anzeigename wird nicht mehr als Schlüssel benutzt. Die Größe kommt aus
// src/data/ship-loadouts.json — dem Stock-Loadout je Schiff aus dem DataCore
// (Game2.dcb), das die Bindung Hardpoint -> Item -> Größe direkt enthält. Der
// Join läuft PRO SCHIFF: derselbe Name darf auf zwei Schiffen zwei Größen
// haben, und genau so ist es im Spiel.
//
// Die aufgelöste Größe wird an der Waffe selbst abgelegt (`fixedWeapons[].size`)
// statt nur aggregiert. Damit überlebt die Zuordnung Name<->Größe die Ausgabe
// und die Anzeige muss sie nicht mehr zurückrechnen (siehe lib/weaponSizes.ts).
// Aufgelöst wird nur, was eindeutig ist — sonst bleibt `size: null` und die
// Anzeige sagt nichts, statt zu raten.
//
// Aufruf:
//   node scripts/enrich-weapon-sizes.mjs            (offline, aus den Spieldaten)
//   node scripts/enrich-weapon-sizes.mjs --mounts   (zusätzlich: Hardpoint-Größen
//                                                    aus der Wiki-API nachladen)
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.star-citizen.wiki/api/v2';
const OUT = new URL('../src/data/vehicles.json', import.meta.url);
const LOADOUTS = new URL('../src/data/ship-loadouts.json', import.meta.url);
const UA = 'sc-patch-archiv fan site (non-commercial German patch archive)';
const WITH_MOUNTS = process.argv.includes('--mounts');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const snapshot = JSON.parse(await readFile(OUT, 'utf8'));
const loadouts = JSON.parse(await readFile(LOADOUTS, 'utf8'));

/* ------------------------------------------------------------------ */
/* Spiel-Wahrheit: Waffenname -> Größe, je Schiff                      */
/* ------------------------------------------------------------------ */
// Ein Name kann auf EINEM Schiff mehrfach vorkommen (vier gleiche Kanonen) —
// das ist eindeutig, solange alle dieselbe Größe haben. Trägt dasselbe Schiff
// denselben Namen in zwei Größen, ist der Join nicht entscheidbar und die
// Waffe bleibt ohne Größe.
const sizesByShip = new Map();
for (const [ship, ports] of Object.entries(loadouts.ships ?? {})) {
  const m = new Map();
  for (const items of Object.values(ports)) {
    for (const it of items) {
      if (it.cat !== 'weapon' || it.size == null || !it.name) continue;
      if (!m.has(it.name)) m.set(it.name, new Set());
      m.get(it.name).add(it.size);
    }
  }
  sizesByShip.set(ship, m);
}

const aggregate = (sizes) => {
  const m = new Map();
  for (const s of sizes) m.set(s, (m.get(s) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => ({ size, count }));
};
const expandSizes = (l) => {
  const o = [];
  for (const { size, count } of l ?? []) for (let i = 0; i < count; i++) o.push(size);
  return o;
};

let resolved = 0, partial = 0, noLoadout = 0, armed = 0;
const unresolved = new Map();
const droppedMounts = [];
for (const v of snapshot.vehicles) {
  const guns = v.fixedWeapons ?? [];
  if (!guns.length) { v.fixedWeaponSizes = []; delete v.fixedWeaponSizesPartial; continue; }
  armed++;
  const truth = sizesByShip.get(v.id);
  if (!truth) {
    noLoadout++;
    for (const w of guns) w.size = null;
    v.fixedWeaponSizes = [];
    v.fixedWeaponSizesPartial = undefined;
    continue;
  }
  const flat = [];
  let open = 0;
  for (const w of guns) {
    const hit = truth.get(w.name);
    const size = hit && hit.size === 1 ? [...hit][0] : null;
    w.size = size;
    if (size == null) {
      open++;
      unresolved.set(w.name, (unresolved.get(w.name) ?? 0) + 1);
    } else {
      for (let i = 0; i < w.count; i++) flat.push(size);
    }
  }
  v.fixedWeaponSizes = aggregate(flat);
  v.fixedWeaponSizesPartial = open > 0 && flat.length > 0 ? true : undefined;
  if (!open) resolved++;
  else partial++;

  // Hardpoint-Angabe verwerfen, wenn die verbaute Waffe gar nicht hineinpasst.
  // Eine Waffe sitzt im Spiel per Definition in ihrem Port — passt die Zahl
  // nicht, ist die Portgröße aus der Wiki veraltet, nicht die Waffengröße.
  // (M50, Mustang Alpha/Beta: S2-Badger in angeblich S1-Ports.)
  if (!open && flat.length) {
    const hp = expandSizes(v.fixedWeaponMounts).sort((a, b) => b - a);
    const gs = flat.slice().sort((a, b) => b - a);
    if (hp.length === gs.length && gs.some((s, i) => s > hp[i])) {
      droppedMounts.push(`${v.name}: Waffen [${gs}] vs. Hardpoints [${hp}]`);
      v.fixedWeaponMounts = [];
    }
  }
}

console.log(
  `Größen aus den Spieldaten: ${resolved}/${armed} bewaffnete Schiffe vollständig` +
  ` (${partial} teilweise, ${noLoadout} ohne Loadout)`
);
if (unresolved.size) {
  console.log('nicht auflösbare Waffen (Name steht nicht im Stock-Loadout des Schiffs):');
  for (const [n, c] of [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15))
    console.log(`  ${c}× ${n}`);
}
if (droppedMounts.length) {
  console.log(`Hardpoint-Angabe verworfen (Waffe passt nicht hinein) — ${droppedMounts.length}:`);
  for (const d of droppedMounts) console.log(`  ${d}`);
}

/* ------------------------------------------------------------------ */
/* Optional: Hardpoint-Größen (was PASST, nicht was drin ist)          */
/* ------------------------------------------------------------------ */
// Bleibt bewusst getrennt: es ist eine andere Aussage als die Waffengröße und
// die einzige, die noch aus dem Netz kommt. Ohne --mounts bleibt das Feld so,
// wie es im Snapshot steht.
if (WITH_MOUNTS) {
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
  const uuidBySlug = new Map();
  for (let n = 1; ; n++) {
    const r = await get(`${API}/vehicles?limit=50&page=${n}`);
    if (!r) break;
    for (const v of r.data) if (v.slug && v.uuid) uuidBySlug.set(v.slug, v.uuid);
    if (n >= r.meta.last_page) break;
    await sleep(200);
  }
  let withMounts = 0;
  for (const v of snapshot.vehicles) {
    const uuid = uuidBySlug.get(v.id);
    const d = uuid ? await get(`${API}/vehicles/${uuid}`) : null;
    if (!d?.data) continue;
    const mounts = [];
    for (const c of d.data.components ?? []) {
      if (c.type !== 'weapons') continue;
      const size = Number(c.size);
      const count = (c.mounts ?? 1) * (c.quantity ?? 1);
      if (Number.isFinite(size) && size > 0 && count > 0)
        for (let i = 0; i < count; i++) mounts.push(size);
    }
    v.fixedWeaponMounts = aggregate(mounts);
    if (mounts.length) withMounts++;
    await sleep(90);
  }
  console.log(`Hardpoint-Größen aktualisiert: ${withMounts} Schiffe`);
}

await writeFile(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log('wrote src/data/vehicles.json (fixedWeapons[].size + fixedWeaponSizes aus dem Spiel)');
