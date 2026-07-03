// UEX in-game price sync — where to BUY (and rent) every ship in the verse.
// Same blueprint as the other syncs: fetch -> normalize -> committed snapshot;
// the live site never calls the API.
//
// Usage:  npm run sync:prices   (manual "build button" — run on patch day)
// Source: https://api.uexcorp.space/2.0 (public GET, no auth):
//   /vehicles                        id -> name ("325a", maker-stripped-ish)
//   /vehicles_purchases_prices_all   {id_vehicle, price_buy, id_terminal}
//   /vehicles_rentals_prices_all     {id_vehicle, price_rent, id_terminal}
//   /terminals                       name/displayname + id_star_system
//   /star_systems                    id -> name (Stanton, Pyro, ...)
// Join: UEX vehicle name -> our maker-stripped catalog name (vehicles.json).
// Fail-safe: fewer than 20 matched vehicles never overwrites the snapshot.
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://api.uexcorp.space/2.0';
const OUT = new URL('../src/data/vehicle-prices.json', import.meta.url);
const UA = 'sc-patch-archiv fan site (non-commercial German patch archive)';

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  const j = await res.json();
  return j.data ?? [];
}

// same maker-strip + normalize as sync-vehicles so both sides meet in the middle
const MAKERS = ['rsi', 'drake', 'aegis', 'anvil', 'mirai', 'gatac', 'argo', 'misc', 'origin', 'crusader', 'esperia', 'kruger', 'banu', 'aopoa', 'vanduul', 'c.o.', 'greycat', 'tumbril', 'consolidated outland'];
function norm(name) {
  let n = String(name).toLowerCase().replace(/["„“”‚‘’'`´]/g, '').replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const m of MAKERS) if (n.startsWith(m + ' ')) n = n.slice(m.length + 1);
  return n.replace(/\s*\/\s*/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

// UEX name -> catalog name where plain normalization can't bridge it
// (keys and values are already norm()ed strings)
const ALIAS = {
  'retaliator bomber': 'retaliator',
  'san tok yāi': 'santok yāi',
  'ares inferno starfighter': 'ares star fighter inferno',
  'ares ion starfighter': 'ares star fighter ion',
  'dragonfly black': 'dragonfly',
  '600i explorer': '600i',
  '85x': '85x limited',
  'm50': 'm50 interceptor',
  'nova tank': 'nova',
};

const cat = JSON.parse(await readFile(new URL('../src/data/vehicles.json', import.meta.url), 'utf8'));
const byNorm = new Map();
for (const v of cat.vehicles) byNorm.set(norm(v.name), v.id);

const [uexVehicles, buys, terminals, systems] = await Promise.all([
  get('/vehicles'),
  get('/vehicles_purchases_prices_all'),
  get('/terminals'),
  get('/star_systems'),
]);
let rents = [];
try {
  rents = await get('/vehicles_rentals_prices_all');
} catch (e) {
  console.warn('rentals endpoint unavailable, skipping:', e.message);
}

const sysName = new Map(systems.map((s) => [s.id, s.name]));
const term = new Map(terminals.map((t) => [t.id, t]));
const uexById = new Map(uexVehicles.map((v) => [v.id, v]));

function place(idTerminal, terminalName) {
  const t = term.get(idTerminal);
  const shop = String(terminalName ?? t?.name ?? '').split(' - ')[0].trim() || 'Terminal';
  return {
    shop,
    where: t?.displayname ?? '',
    system: sysName.get(t?.id_star_system) ?? '',
  };
}

const prices = {}; // ourId -> {buy:[], rent:[]}
const unmatched = new Map(); // uex name -> count (nur Einträge mit Preisen)
function bucket(idVehicle) {
  const uv = uexById.get(idVehicle);
  if (!uv) return null;
  const key = ALIAS[norm(uv.name_full)] ?? ALIAS[norm(uv.name)] ?? null;
  const ourId = byNorm.get(norm(uv.name)) ?? byNorm.get(norm(uv.name_full)) ?? (key ? byNorm.get(key) : null);
  if (!ourId) {
    unmatched.set(uv.name_full, (unmatched.get(uv.name_full) ?? 0) + 1);
    return null;
  }
  if (!prices[ourId]) prices[ourId] = { buy: [], rent: [] };
  return prices[ourId];
}

for (const p of buys) {
  if (!p.price_buy) continue;
  const b = bucket(p.id_vehicle);
  if (b) b.buy.push({ price: p.price_buy, ...place(p.id_terminal, p.terminal_name) });
}
for (const p of rents) {
  const price = p.price_rent ?? p.price_rent_per_day ?? null;
  if (!price) continue;
  const b = bucket(p.id_vehicle);
  if (b) b.rent.push({ price, ...place(p.id_terminal, p.terminal_name) });
}

for (const v of Object.values(prices)) {
  v.buy.sort((a, b) => a.price - b.price);
  v.rent.sort((a, b) => a.price - b.price);
}

const matched = Object.keys(prices).length;
const buyable = Object.values(prices).filter((v) => v.buy.length).length;
console.log(`UEX: ${buys.length} Kauf- + ${rents.length} Miet-Einträge, ${matched} Schiffe gematcht (${buyable} kaufbar).`);
if (unmatched.size) {
  console.log('Nicht gematcht (UEX-Name, Einträge):');
  for (const [n, c] of [...unmatched].sort()) console.log(`  - ${n} (${c})`);
}

if (matched < 20) {
  console.error(`FAIL-SAFE: nur ${matched} Schiffe gematcht — Snapshot NICHT überschrieben.`);
  process.exit(1);
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString().slice(0, 10),
      source: 'UEX Corp (uexcorp.space)',
      matched,
      buyable,
      prices,
    },
    null,
    1
  )
);
console.log(`Snapshot geschrieben: src/data/vehicle-prices.json`);
