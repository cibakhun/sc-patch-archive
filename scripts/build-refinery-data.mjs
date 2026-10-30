// build-refinery-data.mjs — baut die kompakte Datengrundlage fürs Refinery-
// Dashboard: raffinierbare Erze, Raffinerie-Stationen, Methoden und (aus UEX)
// Verkaufspreise, in EINER schlanken assets/refinery-data.json.
//
// Fakten sind game-sourced (aus den eigenen Mining-Extraktionen):
//   - Erz-Liste + Attribute  ← assets/mining-db.json
//   - Stationen + Yield-Boni  ← assets/mining-model.json (refineries/refineryProfiles)
//   - Methoden (qualitativ)   ← hier gepflegt, identisch zu RefineryFinder.astro
// Preise sind UEX (Community, attribuiert) ← src/data/commodity-prices.json
//
// Aufruf: node scripts/build-refinery-data.mjs   (npm run build:refinery-data)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const R = (...p) => resolve(__dirname, '..', ...p);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const DB = readJson(R('assets', 'mining-db.json'));
const MODEL = readJson(R('assets', 'mining-model.json'));
let PRICES = { commodities: {}, fetchedAt: null, source: null };
try { PRICES = readJson(R('src', 'data', 'commodity-prices.json')); } catch { console.warn('! commodity-prices.json fehlt — Preise bleiben leer (npm run sync:commodity-prices)'); }

// ---- Methoden (qualitativ, Stand 4.8.0; identisch zu RefineryFinder.astro) ----
// Exakte Yield-%/Zeit/Kosten pro Methode sind serverseitig und NICHT öffentlich
// dokumentiert — daher nur die Trade-off-Stufen als Auswahlhilfe.
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const METHODS = [
  { name: 'Dinyx Solventation', speed: 'low', cost: 'high', yield: 'high' },
  { name: 'Gaskin Process', speed: 'low', cost: 'mid', yield: 'high' },
  { name: 'Pyrometric Chromalysis', speed: 'vlow', cost: 'low', yield: 'high' },
  { name: 'Ferron Exchange', speed: 'low', cost: 'low', yield: 'mid' },
  { name: 'Kazen Winnowing', speed: 'mid', cost: 'mid', yield: 'mid' },
  { name: 'Thermonatic Deposition', speed: 'high', cost: 'high', yield: 'mid' },
  { name: 'Cormack Method', speed: 'high', cost: 'mid', yield: 'low' },
  { name: 'Electrostarolysis', speed: 'mid', cost: 'low', yield: 'low' },
  { name: 'XCR Reaction', speed: 'high', cost: 'high', yield: 'low' },
].map((m) => ({ key: slug(m.name), ...m }));

// ---- Stationen (game-sourced) ----
const shortName = (n) => {
  const code = String(n).match(/^[A-Z]{2,4}-L\d+/);
  if (code) return code[0];
  return String(n).replace(/\s+Station$/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
};
const refineries = MODEL.refineries || [];
const stations = refineries
  .map((r) => ({ key: slug(r.name), name: r.name, short: shortName(r.name), system: r.system, profileId: r.profileId }))
  .sort((a, b) => (a.system === b.system ? a.short.localeCompare(b.short) : a.system.localeCompare(b.system)));

// ---- Yield-Boni je Station und Erz ----
// Die Profile nennen das Rohmaterial ("Gold (Ore)", "Raw Ice"); das Erz heißt
// schlicht "Gold"/"Ice". Ein Erz, das ein Profil nicht nennt, hat dort ±0 %.
const profiles = MODEL.refineryProfiles || {};
const oreKey = (s) => String(s).replace(/ \((?:Ore|Raw|Pure)\)$/i, '').replace(/^Raw /i, '').trim().toLowerCase();
const bonusOf = (profileId, oreName) => {
  for (const [k, v] of Object.entries(profiles[profileId] || {})) if (oreKey(k) === oreName.toLowerCase()) return v;
  return 0;
};

// ---- Erze (game-sourced Fakten + UEX-Preis) ----
const priceOf = (name) => PRICES.commodities?.[String(name).toLowerCase().trim()] || null;
const minerals = DB.minerals || [];
const missingPrice = [];
const ores = minerals
  .filter((m) => m.needs_refine) // raffinierbare (schiffsgeminte) Erze
  .map((m) => {
    const p = priceOf(m.name);
    if (!p) missingPrice.push(m.name);
    return {
      name: m.name,
      code: m.code || (p && p.code) || null,
      kind: m.kind || (p && p.kind) || null,
      weight_scu: m.weight_scu ?? (p ? p.weight_scu : null),
      rarity: m.rarity || null,
      systems: m.systems || [],
      sell: p ? p.sell : null,
      sellMax: p ? p.sellMax : null,
      sellLoc: p ? p.sellLoc : null,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// profileId bleibt intern; nach außen geht der aufgelöste Bonus je Erz (nur ≠ 0).
const outStations = stations.map(({ profileId, ...rest }) => ({
  ...rest,
  bonus: Object.fromEntries(ores.map((o) => [o.name, bonusOf(profileId, o.name)]).filter(([, v]) => v !== 0)),
}));

const out = {
  meta: {
    builtAt: new Date().toISOString().slice(0, 10),
    gameVersion: DB.game_version || null,
    priceDate: PRICES.fetchedAt || null,
    priceSource: PRICES.source || null,
    note: 'Verkaufspreise UEX (Community). Methoden qualitativ — exakte Yield-/Zeit-/Kostenwerte der Raffinerie sind serverseitig und werden im Dashboard manuell aus dem Ingame-Terminal eingetragen.',
  },
  methods: METHODS,
  stations: outStations,
  ores,
};

writeFileSync(R('assets', 'refinery-data.json'), JSON.stringify(out));
console.log('OK: assets/refinery-data.json');
console.log(`  Stationen: ${outStations.length} | Methoden: ${METHODS.length} | Erze: ${ores.length}`);
console.log(`  Erze mit Preis: ${ores.length - missingPrice.length}/${ores.length}`);
if (missingPrice.length) console.log('  ohne UEX-Preis:', missingPrice.join(', '));
