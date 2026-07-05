// fetch-mining.mjs — Snapshot der UEX-Mining-Daten für die Mining-Seite.
// Zieht extrahierbare Commodities (Minerale/Erze) + deren Fundort-IDs, joint sie
// gegen Systeme/Planeten/Monde zu NAMEN, hängt Verkaufspreise pro Terminal an,
// plus die 9 Refinery-Methoden und die Mining-Fahrzeuge. Schreibt deterministisch
// nach assets/mining-db.json (kanonisch; wird per _sync-assets.mjs nach
// public/assets gespiegelt).
//
//   node scripts/fetch-mining.mjs
//
// Quelle: https://api.uexcorp.space/2.0 (öffentlicher GET, kein Key) — crowdsourced,
// patch-volatil. Preise/Fundorte ingame prüfen.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'mining-db.json');

const BASE = 'https://api.uexcorp.space/2.0';
const UA = 'sc-patch-archiv fan site (non-commercial German patch archive)';
const HEADERS = { 'User-Agent': UA, Accept: 'application/json' };

const SNAP_DATE = process.env.SNAP_DATE || '2026-07-05';

async function getJSON(path, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      const j = await res.json();
      return j.data ?? [];
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw lastErr;
}

const num = (n) => (n == null || n === '' ? null : Number(n));
const ids = (s) =>
  String(s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number);

// Basisname: " (Ore)" / " (Raw)" / " (Pure)" abstreifen → Erz und Rohform zusammenführen.
function baseName(name) {
  return String(name)
    .replace(/\s*\((Ore|Raw|Pure|Refined)\)\s*$/i, '')
    .trim();
}

// Grobe Mining-Methode je Mineral — NÄHERUNG (UEX hat kein sauberes Feld dafür).
// Hand-/ROC-abbaubare Edelsteine werden ganz verkauft (kein Refining).
const HAND_GEMS = new Set([
  'Aphorite', 'Dolivine', 'Hadanite', 'Janalite', 'Beradom', 'Feynmaline',
  'Glacosite', 'Carinite', 'Atacamite', 'Saldynium', 'Jaclium', 'Sadaryx', 'Caranite',
]);
function deriveMethod(base, c) {
  if (HAND_GEMS.has(base)) return 'hand'; // Multitool/ROC, ganz verkauft
  if (c.is_refinable === 1 || c.is_raw === 1) return 'ship'; // Prospector/MOLE + Refinery
  return 'ship';
}

async function main() {
  console.log('Lookups (Systeme/Planeten/Monde/Orbits/POIs) …');
  const [systems, planets, moons, orbits, pois, gameVersions] = await Promise.all([
    getJSON('/star_systems'),
    getJSON('/planets'),
    getJSON('/moons'),
    getJSON('/orbits').catch(() => []),
    getJSON('/poi').catch(() => []),
    getJSON('/game_versions').catch(() => ({})),
  ]);
  const liveVer =
    (Array.isArray(gameVersions) ? null : gameVersions?.live) ||
    (await getJSON('/game_versions').then((d) => d?.live).catch(() => null)) ||
    '4.8';

  const sysById = new Map(systems.map((s) => [s.id, s.name]));
  const planetById = new Map(planets.map((p) => [p.id, p]));
  const moonById = new Map(moons.map((m) => [m.id, m]));
  const orbitById = new Map(orbits.map((o) => [o.id, o]));
  const poiById = new Map(pois.map((p) => [p.id, p]));

  console.log('Commodities …');
  const commodities = await getJSON('/commodities');

  // Nur extrahierbare / Minerale / Rohstoffe behalten; klare Nicht-Minerale
  // (Bau-Schutt, Salvage-Nebenprodukte, Bio-Pods) ausschließen.
  const EXCLUDE = /Construction Material|Inert Materials|Decari Pod|Wuotan Seed/i;
  const mineable = commodities.filter(
    (c) =>
      (c.is_extractable === 1 || c.is_mineral === 1 || c.is_raw === 1) &&
      !EXCLUDE.test(c.name)
  );

  // Nach Basisname gruppieren (Erz + Rohform + verkaufbare Form zusammen).
  const groups = new Map();
  for (const c of mineable) {
    const base = baseName(c.name);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(c);
  }

  console.log(`Minerale: ${groups.size} Basisnamen aus ${mineable.length} Commodities`);

  // Verkaufspreise je verkaufbarer Commodity holen (Terminal-Ebene).
  async function sellData(id) {
    const rows = await getJSON(`/commodities_prices?id_commodity=${id}`).catch(() => []);
    const sells = rows
      .filter((r) => num(r.price_sell) > 0)
      .map((r) => ({
        terminal: r.terminal_name,
        system: r.star_system_name,
        location: r.planet_name || r.moon_name || r.space_station_name || null,
        price: Math.round(num(r.price_sell)),
        version: r.game_version || null,
      }));
    return sells;
  }

  const minerals = [];
  for (const [base, variants] of groups) {
    // Fundorte aus allen Varianten sammeln (i.d.R. trägt die Ore/Raw-Form die IDs).
    const sysSet = new Set();
    const locBySys = new Map(); // system name -> Set(body names)
    const spaceBySys = new Map(); // system name -> Set(asteroid belt / lagrange names)
    for (const c of variants) {
      for (const sid of ids(c.ids_star_systems)) {
        const sn = sysById.get(sid);
        if (sn) sysSet.add(sn);
      }
      for (const pid of ids(c.ids_planets)) {
        const p = planetById.get(pid);
        if (!p) continue;
        const sn = p.star_system_name;
        if (!locBySys.has(sn)) locBySys.set(sn, new Set());
        locBySys.get(sn).add(p.name);
        sysSet.add(sn);
      }
      for (const mid of ids(c.ids_moons)) {
        const m = moonById.get(mid);
        if (!m) continue;
        const sn = m.star_system_name;
        if (!locBySys.has(sn)) locBySys.set(sn, new Set());
        // Mond als "Mond (Planet)" für Kontext.
        locBySys.get(sn).add(m.planet_name ? `${m.name} (${m.planet_name})` : m.name);
        sysSet.add(sn);
      }
      // Space-Fundorte: POIs sind die Asteroidenfelder (Aaron Halo, Yela Ring,
      // Keeger Belt, …), Orbits die Lagrange-Punkte mit Asteroiden-Clustern.
      for (const oid of ids(c.ids_orbits)) {
        const o = orbitById.get(oid);
        if (!o) continue;
        const sn = o.star_system_name;
        if (!spaceBySys.has(sn)) spaceBySys.set(sn, new Set());
        spaceBySys.get(sn).add(o.name);
        sysSet.add(sn);
      }
      for (const pid of ids(c.ids_poi)) {
        const p = poiById.get(pid);
        if (!p) continue;
        const sn = p.star_system_name;
        if (!spaceBySys.has(sn)) spaceBySys.set(sn, new Set());
        spaceBySys.get(sn).add(p.name);
        sysSet.add(sn);
      }
    }

    // Verkaufbare Form finden (bevorzugt refined / höchster price_sell).
    const sellable = variants
      .filter((c) => c.is_sellable === 1)
      .sort((a, b) => (num(b.price_sell) || 0) - (num(a.price_sell) || 0));
    const priceCarrier =
      sellable.find((c) => (num(c.price_sell) || 0) > 0) || sellable[0] || variants[0];

    let sells = [];
    if (priceCarrier?.is_sellable === 1) {
      sells = await sellData(priceCarrier.id);
      await new Promise((r) => setTimeout(r, 120)); // sanft zur API
    }
    sells.sort((a, b) => b.price - a.price);
    const prices = sells.map((s) => s.price);
    const sell = prices.length
      ? {
          best: sells[0],
          min: prices[prices.length - 1],
          max: prices[0],
          avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
          count: prices.length,
          terminals: sells.slice(0, 12),
        }
      : null;

    const rawForm = variants.find((c) => c.is_raw === 1);
    const refForm = variants.find((c) => c.is_refined === 1);
    const anyMineral = variants.some((c) => c.is_mineral === 1);
    const anyHarvest = variants.some((c) => c.is_harvestable === 1);
    const needsRefine = variants.some((c) => c.is_refinable === 1);
    const method = deriveMethod(base, priceCarrier || variants[0]);

    const locations = {};
    for (const [sn, set] of locBySys) locations[sn] = [...set].sort();
    const space = {};
    for (const [sn, set] of spaceBySys) space[sn] = [...set].sort();

    minerals.push({
      name: base,
      code: (priceCarrier || variants[0]).code || null,
      kind: (rawForm || priceCarrier || variants[0]).kind || null,
      weight_scu: num((priceCarrier || variants[0]).weight_scu),
      method, // 'ship' | 'hand' (Näherung)
      is_mineral: anyMineral,
      is_harvestable: anyHarvest,
      needs_refine: needsRefine, // Rohform muss raffiniert werden
      base_price_sell: num((refForm || priceCarrier || {}).price_sell) || null,
      systems: [...sysSet].sort(),
      locations,
      space,
      sell,
      wiki: (priceCarrier || variants[0]).wiki || null,
    });
  }

  minerals.sort((a, b) => a.name.localeCompare(b.name));

  console.log('Refinery-Methoden …');
  const methodsRaw = await getJSON('/refineries_methods');
  const rate = (n) => ({ 1: 'low', 2: 'mid', 3: 'high' }[n] || null);
  // ECHTE Methoden-Modifikatoren [yield, zeit, kosten] aus dem Regolith-Formelkern
  // (github.com/regolithco/RegolithCo-Common, MIT; deckt sich mit dem UEX-Audit
  // Laranite+Dinyx: 2417/2872 ≈ 0,84 = 0,85 × 1,0). Gesamtformel (equations.ts):
  //   refined_cSCU = raw_cSCU × 0,85 × methodYield × stationBonus
  //   zeit_s       = raw_cSCU × ore.time_cscu × methodTime   (Stand ≤4.6; 4.2 hat global beschleunigt)
  //   kosten_aUEC  = raw_cSCU × ore.cost_cscu × methodCost
  const METHOD_MODS = {
    CORMACK: [0.7, 0.25, 2],
    ELECTROSTAROLYSIS: [0.85, 1, 2],
    'FERRON EXCHANGE': [1, 4, 2],
    'DINYX SOLVENTATION': [1, 12, 1],
    'GASKIN PROCESS': [0.85, 0.5, 6],
    'KAZEN WINNOWING': [0.7, 0.75, 1],
    'PYROMETRIC CHROMALYSIS': [1, 2, 6],
    'THERMONATIC DEPOSITION': [0.85, 3, 1],
    'XCR REACTION': [0.7, 0.125, 6],
  };
  const BASE_YIELD = 0.85; // globaler Ore-Processing-Faktor (alle Erze identisch)
  const methods = methodsRaw
    .map((m) => {
      const mods = METHOD_MODS[m.name.toUpperCase()] || [0.85, 1, 2];
      return {
        name: m.name,
        code: m.code,
        yield: m.rating_yield,
        cost: m.rating_cost,
        speed: m.rating_speed,
        yield_label: rate(m.rating_yield),
        cost_label: rate(m.rating_cost),
        speed_label: rate(m.rating_speed),
        yield_mod: mods[0],
        time_mod: mods[1],
        cost_mod: mods[2],
        yield_effective: Math.round(BASE_YIELD * mods[0] * 1000) / 1000, // refined/raw
      };
    })
    .sort((a, b) => b.yield_effective - a.yield_effective || a.name.localeCompare(b.name));

  // Per-Erz-Verarbeitungsfaktoren [Sekunden/cSCU, aUEC/cSCU] (Regolith
  // oreProcessingLookup; 1 SCU = 100 cSCU). Neue 4.x-Erze (Stileron, Riccite,
  // Torite, …) fehlen im archivierten Datensatz → Zeit/Kosten dort unbekannt.
  const ORE_PROC = {
    AGRICIUM: [3, 1.54], ALUMINUM: [2, 0.08], BERYL: [2.3, 1.23], BEXALITE: [2.9, 3.7],
    BORASE: [2.5, 1.51], COPPER: [2.3, 0.09], CORUNDUM: [2.1, 0.1], DIAMOND: [2.3, 0.16],
    GOLD: [2.8, 3.85], HEPHAESTANITE: [2.6, 1.2], IRON: [2.3, 0.1], LARANITE: [3.1, 1.25],
    QUANTAINIUM: [4, 7.19], QUANTANIUM: [4, 7.19], QUARTZ: [2.7, 0.1], TARANITE: [3.2, 3.74],
    TITANIUM: [2.2, 0.08], TUNGSTEN: [2.1, 0.55],
  };
  for (const m of minerals) {
    const proc = ORE_PROC[m.name.toUpperCase()];
    if (proc) m.refine_proc = { time_cscu: proc[0], cost_cscu: proc[1] };
  }

  // Live-Stationsboni pro Erz (UEX /refineries_yields, crowdsourced, in %):
  // z. B. Iron (Ore) an Nyx Gateway: -5 %. Nach Terminal gruppiert.
  console.log('Refinery-Stationsboni …');
  const yieldsRaw = await getJSON('/refineries_yields').catch(() => []);
  const stationMap = new Map();
  for (const r of yieldsRaw) {
    if (r.value == null || !r.terminal_name) continue;
    const key = r.terminal_name;
    if (!stationMap.has(key)) {
      stationMap.set(key, {
        terminal: r.terminal_name,
        system: r.star_system_name || null,
        station: r.space_station_name || r.orbit_name || r.planet_name || null,
        ores: {},
      });
    }
    stationMap.get(key).ores[baseName(r.commodity_name)] = Number(r.value);
  }
  const refinery_stations = [...stationMap.values()].sort(
    (a, b) => (a.system || '').localeCompare(b.system || '') || a.terminal.localeCompare(b.terminal)
  );

  // Scan-Signaturen (4.7+): Signatur identifiziert das dominante Mineral.
  // Quelle: github.com/Diftic/SC_Signature_Scanner (aus Game-Files, Stand 4.7+).
  const signatures = [
    { tier: 'Legendary', entries: [ { sig: 3170, name: 'Quantainium' }, { sig: 3185, name: 'Stileron' }, { sig: 3200, name: 'Savrilium' } ] },
    { tier: 'Epic', entries: [ { sig: 3370, name: 'Ouratite' }, { sig: 3385, name: 'Riccite' }, { sig: 3400, name: 'Lindinium' } ] },
    { tier: 'Rare', entries: [ { sig: 3540, name: 'Beryl' }, { sig: 3555, name: 'Taranite' }, { sig: 3570, name: 'Borase' }, { sig: 3585, name: 'Gold' }, { sig: 3600, name: 'Bexalite' } ] },
    { tier: 'Uncommon', entries: [ { sig: 3825, name: 'Laranite' }, { sig: 3840, name: 'Aslarite' }, { sig: 3855, name: 'Titanium' }, { sig: 3870, name: 'Tungsten' }, { sig: 3885, name: 'Agricium' }, { sig: 3900, name: 'Torite' } ] },
    { tier: 'Common', entries: [ { sig: 4180, name: 'Hephaestanite' }, { sig: 4195, name: 'Tin' }, { sig: 4210, name: 'Quartz' }, { sig: 4225, name: 'Corundum' }, { sig: 4240, name: 'Copper' }, { sig: 4255, name: 'Silicon' }, { sig: 4270, name: 'Iron' }, { sig: 4285, name: 'Aluminum' }, { sig: 4300, name: 'Ice' } ] },
    { tier: 'Other', entries: [ { sig: 3000, name: 'FPS-Handminerals' }, { sig: 4000, name: 'ROC-Deposits' }, { sig: 2000, name: 'Salvage-Panel (×N)' } ] },
  ];

  // Mining-Fahrzeuge werden NICHT aus UEX gezogen: die scu-Werte dort sind für
  // Miner unzuverlässig (z.B. MOLE=32 statt 96). Stattdessen kuratierte Tabelle
  // im MiningApp-Component (Quelle: starcitizen.tools).

  // ---- Mining-Gear (Laserköpfe / Module / Gadgets) für den Fracturing-Rechner ----
  // Kategorien: 29 = Mining Laser Heads, 30 = Mining Modules, 28 = Gadgets.
  // Stats aus /items_attributes (echte UEX-Werte); die Fracturing-FORMEL selbst
  // ist nicht öffentlich — der Rechner nutzt sie als Heuristik.
  function attrMap(rows) {
    const m = {};
    (rows || []).forEach((a) => { m[a.attribute_name] = String(a.value == null ? '' : a.value).trim(); });
    return m;
  }
  const pn = (s) => {
    if (s == null) return null;
    s = String(s).replace('%', '').replace(/µSCU|SCU|m\b/g, '').replace(/\s/g, '').replace(',', '.');
    if (s === '' || s === '-') return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };
  const prange = (s) => {
    if (!s) return [null, null];
    const m = String(s).match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    const n = pn(s);
    return [n, n];
  };
  async function fetchCat(id) {
    const items = await getJSON(`/items?id_category=${id}`).catch(() => []);
    const out = [];
    for (const it of items) {
      const rows = await getJSON(`/items_attributes?id_item=${it.id}`).catch(() => []);
      await new Promise((r) => setTimeout(r, 80));
      out.push({ item: it, attr: attrMap(rows) });
    }
    return out;
  }

  console.log('Mining-Gear (Laser/Module/Gadgets) …');
  const [rawLasers, rawModules, rawGadgets] = await Promise.all([
    fetchCat(29), fetchCat(30), fetchCat(28),
  ]);

  const platformBySize = { 0: 'Hand / ROC', 1: 'Prospector / ROC', 2: 'MOLE' };
  const lasers = rawLasers
    .map(({ item, attr }) => {
      const [pmin, pmax] = prange(attr['Mining Laser Power']);
      const size = pn(attr['Size']) != null ? pn(attr['Size']) : pn(item.size);
      return {
        name: item.name.replace(/\s*Mining Laser\s*$/i, ''),
        company: item.company_name || null,
        size: size,
        platform: platformBySize[size] || null,
        power_min: pmin, power_max: pmax,
        window: pn(attr['Optimal Charge Window Size']),
        resistance: pn(attr['Resistance']),
        instability: pn(attr['Laser Instability']),
        inert: pn(attr['Inert Material Level']),
        slots: pn(attr['Module Slots']),
        optimal_range: pn(attr['Optimal Range']),
        max_range: pn(attr['Maximum Range']),
        wiki: item.wiki || null,
      };
    })
    .filter((l) => l.power_max != null)
    .sort((a, b) => (a.size - b.size) || a.name.localeCompare(b.name));

  const modules = rawModules
    .map(({ item, attr }) => ({
      name: item.name.replace(/\s*Module\s*$/i, ''),
      company: item.company_name || null,
      type: attr['Item Type'] || null,
      power_mult: pn(attr['Mining Laser Power']),
      window: pn(attr['Optimal Charge Window Size']),
      resistance: pn(attr['Resistance']),
      instability: pn(attr['Laser Instability']),
      inert: pn(attr['Inert Material Level']),
      shatter: pn(attr['Shatter Damage']),
      wiki: item.wiki || null,
    }))
    .filter((m) => m.window != null || m.resistance != null || m.power_mult != null || m.instability != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const gadgets = rawGadgets
    .map(({ item, attr }) => ({
      name: item.name,
      company: item.company_name || null,
      window: pn(attr['Optimal Charge Window Size']),
      resistance: pn(attr['Resistance']),
      instability: pn(attr['Instability']) != null ? pn(attr['Instability']) : pn(attr['Laser Instability']),
      wiki: item.wiki || null,
    }))
    .filter((g) => g.window != null || g.resistance != null || g.instability != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Standort-Reverse-Lookup: Body -> [Minerale], gruppiert nach System.
  const bodyIndex = {};
  const spaceKeys = new Set();
  for (const m of minerals) {
    for (const [sn, bodies] of Object.entries(m.locations)) {
      for (const b of bodies) {
        const key = `${sn}␟${b}`;
        (bodyIndex[key] ||= []).push(m.name);
      }
    }
    for (const [sn, sites] of Object.entries(m.space)) {
      for (const b of sites) {
        const key = `${sn}␟${b}`;
        (bodyIndex[key] ||= []).push(m.name);
        spaceKeys.add(key);
      }
    }
  }
  const bodies = Object.entries(bodyIndex)
    .map(([key, mins]) => {
      const [system, body] = key.split('␟');
      const entry = { system, body, minerals: mins.sort() };
      if (spaceKeys.has(key)) entry.space = true;
      return entry;
    })
    .sort((a, b) => a.system.localeCompare(b.system) || a.body.localeCompare(b.body));

  const liveSystems = systems
    .filter((s) => s.is_available_live === 1)
    .map((s) => s.name)
    .sort();

  const payload = {
    source: 'UEX (uexcorp.space)',
    source_url: 'https://uexcorp.space/',
    source_note:
      'Snapshot der Community-DB UEX (crowdsourced). Preise & Fundort-Flags patch-volatil — ingame prüfen. Fundorte = Vorkommen laut Spieldaten, keine Spawn-Wahrscheinlichkeit.',
    game_version: liveVer,
    snapshot_date: SNAP_DATE,
    counts: {
      minerals: minerals.length,
      priced: minerals.filter((m) => m.sell).length,
      bodies: bodies.length,
      methods: methods.length,
      lasers: lasers.length,
      modules: modules.length,
      gadgets: gadgets.length,
    },
    live_systems: liveSystems,
    refine_base_yield: BASE_YIELD,
    minerals,
    methods,
    refinery_stations,
    signatures,
    bodies,
    lasers,
    modules,
    gadgets,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0);
  console.log(`\nGeschrieben: ${OUT}`);
  console.log(
    `  ${minerals.length} Minerale (${payload.counts.priced} mit Preis), ${bodies.length} Fundort-Bodies, ${methods.length} Refinery-Methoden, ${lasers.length} Laser, ${modules.length} Module, ${gadgets.length} Gadgets, ~${kb} KB`
  );
}

main().catch((e) => {
  console.error('\nFEHLER:', e.message);
  process.exit(1);
});
