// build-universal-db.mjs — baut assets/universal-items.json für den Universal Item Finder.
//
// Grundsatz: KEINE erfundenen Werte. Jeder Preis und jeder Fundort stammt aus einer
// benannten Quelle; Items ohne bekannte Bezugsquelle werden ehrlich als Katalog-
// Eintrag (obtain: []) ausgewiesen statt mit Fantasie-Shops/-Preisen befüllt.
// (Ersetzt sc-dataminer/build_universal_db.py, das Preise/Orte per MD5-Hash
// fabrizierte — Shop-Preise sind seit ~3.20 serverseitig und NICHT in Data.p4k.)
//
// Quellen:
//   1) src/data/item-prices.json       — UEX-Kaufpreise + Kauforte (fetch-uex-item-
//      prices.mjs); dieselben Daten, die starcitizen.tools auf Item-Seiten zeigt.
//      Hat für ein Item Vorrang vor dem älteren Shop-Snapshot (2).
//   2) assets/dismantling-items.json   — kuratierter Shop-Snapshot (Name, Kategorie,
//      Kaufpreis, Kaufort, Zerlege-Rezept); Fallback, wenn UEX ein Item nicht führt.
//   3) src/data/loot-items.json        — eigene Loot-Recherche (Fundorte + Guide-Text).
//   4) src/data/vehicles.json + src/data/vehicle-prices.json — Schiffe/Fahrzeuge,
//      Kaufpreise von UEX Corp (uexcorp.space).
//   5) global.ini (optional, lokal aus Data.p4k extrahiert) — echte Anzeigenamen
//      aller item_Name*-Klassen als Katalog-Einträge ohne Handelsdaten.
//
// Aufruf:
//   node scripts/build-universal-db.mjs [--global-ini <pfad>]
//   Ohne erreichbare global.ini wird der Katalog-Teil übersprungen (Warnung + counts).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'assets', 'universal-items.json');

const argIx = process.argv.indexOf('--global-ini');
const GLOBAL_INI = argIx >= 0
  ? resolve(process.argv[argIx + 1])
  : resolve('G:/Projects/games/Star Citizen/sc-dataminer/extracted/Data/Localization/english/global.ini');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// --- Platzhalter-Filter: Wortgrenzen, damit „Testudo“/„Contest“ NICHT rausfliegen;
//     „(PH) …“ / „PH - …“ ist die CIG-Konvention für unfertige Einträge ---
const PLACEHOLDER = /placeholder|<=|=>|\btbd\b|\bunknown\b|\bmissing\b|\btest\b|\bdebug\b|\btemp\b|^\(?ph\)?\s*[-–]?\s/i;
const isPlaceholder = (name) => !name || PLACEHOLDER.test(name) || name.startsWith('@');

// --- Kategorie-Ableitung (nur fürs Einsortieren; konservativ, sonst „Other“) ---
const CAT_RULES = [
  [/\b(helmet|undersuit|armor|armour|backpack|torso|visor|balaclava|mask)\b/i, 'Armour'],
  [/\b(jacket|pants|shirt|t-shirt|shoes|sneakers?|boots?|hat|cap|beanie|glasses|sunglasses|vest|slacks|skirt|dress|sweater|hoodie|jumpsuit|flightsuit|gloves?)\b/i, 'Clothing'],
  [/\b(rifle|pistol|shotgun|smg|lmg|sniper|launcher|railgun|knife|dagger|blade|sword|grenade|crossbow)\b/i, 'Weapons'],
  [/\b(magazine|scope|sight|suppressor|compensator|barrel|underbarrel|foregrip)\b/i, 'Attachment'],
  [/\b(ammo|ammunition)\b/i, 'Ammo'],
  [/\b(cooler|power ?plant|quantum (drive|enforcement)|shield generator|radar|mining (laser|head|module)|tractor beam|salvage|thruster|missile|torpedo|turret|gimbal|fuel (tank|intake|pod)|nozzle|scanner module)\b/i, 'Vehiclegear'],
  [/\b(medpen|med-?gun|multi-?tool|gadget|cutter|beacon|flare|batter(y|ies)|oxypen|cruz|burrito|sandwich|coffee|water|whiskey|vodka|beer|snack|food|drink|bottle|flask)\b/i, 'Utility'],
];
function inferCategory(name) {
  for (const [re, cat] of CAT_RULES) if (re.test(name)) return cat;
  return 'Other';
}

// --- deterministische, lesbare IDs ---
const usedIds = new Set();
function slugId(name) {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  let id = base, n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
}

// =========================================================
//  Quellen einlesen und per Name (case-insensitiv) mergen
// =========================================================
const byName = new Map(); // key: name.toLowerCase()
function entry(name) {
  const k = name.toLowerCase().trim();
  if (!byName.has(k)) {
    byName.set(k, {
      name: name.trim(), category: null, catSource: 99,
      obtain: [],      // loot- + vehicle-Zeilen
      shopUex: [],     // Shop-Zeilen aus UEX (Vorrang)
      shopSnap: [],    // Shop-Zeilen aus dem Dismantling-Snapshot (Fallback)
      guide: null,
    });
  }
  return byName.get(k);
}
// catSource: kleiner = vertrauenswürdiger (0 Shop-Snapshot, 1 UEX/Vehicle, 2 Inferenz)
function setCategory(e, cat, rank) {
  if (cat && rank < e.catSource) { e.category = cat; e.catSource = rank; }
}

// 1) UEX-Kaufpreise (wie auf starcitizen.tools angezeigt)
const uexDb = readJson(resolve(ROOT, 'src', 'data', 'item-prices.json'));
let uexRows = 0;
for (const info of Object.values(uexDb.items)) {
  if (isPlaceholder(info.name)) continue;
  const e = entry(info.name);
  setCategory(e, info.category, 1);
  for (const r of info.rows) {
    e.shopUex.push({ kind: 'shop', loc: r.loc, price: r.price });
    uexRows++;
  }
}

// 2) Shop-Snapshot (dismantling-items) — Fallback für Items ohne UEX-Preis
const shopItems = readJson(resolve(ROOT, 'assets', 'dismantling-items.json'));
let snapRows = 0;
for (const it of shopItems) {
  if (isPlaceholder(it.name)) continue;
  const e = entry(it.name);
  setCategory(e, it.category, 0);
  if (it.purchaseLocation && Number(it.purchasePrice_aUEC) > 0) {
    e.shopSnap.push({ kind: 'shop', loc: it.purchaseLocation, price: Number(it.purchasePrice_aUEC) });
    snapRows++;
  }
}

// 3) Loot-Recherche
const lootDb = readJson(resolve(ROOT, 'src', 'data', 'loot-items.json'));
let lootRows = 0;
for (const [name, info] of Object.entries(lootDb)) {
  if (isPlaceholder(name)) continue;
  const e = entry(name);
  setCategory(e, inferCategory(name), 2);
  for (const loc of info.locations || []) { e.obtain.push({ kind: 'loot', loc }); lootRows++; }
  if (info.guide && !e.guide) e.guide = info.guide;
}

// 4) Fahrzeuge (Namen) + UEX-Kaufpreise
const vehicles = readJson(resolve(ROOT, 'src', 'data', 'vehicles.json')).vehicles || [];
const vehPrices = readJson(resolve(ROOT, 'src', 'data', 'vehicle-prices.json')).prices || {};
let vehicleRows = 0;
for (const v of vehicles) {
  if (!v.name || isPlaceholder(v.name)) continue;
  const e = entry(v.name);
  setCategory(e, 'Vehicle', 1);
  for (const p of vehPrices[v.id]?.buy || []) {
    if (Number(p.price) > 0) { e.obtain.push({ kind: 'vehicle', loc: `${p.shop} - ${p.where}`, price: Number(p.price) }); vehicleRows++; }
  }
}

// 5) Katalog aus global.ini (optional): echte Namen, bewusst OHNE Preis/Ort
let catalogAdded = 0, catalogSkipped = 0;
let iniFound = existsSync(GLOBAL_INI);
if (iniFound) {
  const ini = readFileSync(GLOBAL_INI, 'utf8');
  const seen = new Set();
  for (const line of ini.split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let key = line.slice(0, eq).trim();
    const comma = key.indexOf(',');
    if (comma >= 0) key = key.slice(0, comma);
    if (!/^item_name/i.test(key)) continue;
    const val = line.slice(eq + 1).trim();
    if (isPlaceholder(val)) { catalogSkipped++; continue; }
    const k = val.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    if (byName.has(k)) continue; // echte Quelle gewinnt
    const e = entry(val);
    setCategory(e, inferCategory(val), 2);
    catalogAdded++;
  }
} else {
  console.warn(`WARN: global.ini nicht gefunden (${GLOBAL_INI}) — Katalog-Teil übersprungen.`);
}

// =========================================================
//  Dedupe je Item (identische obtain-Zeilen), sortieren, schreiben
// =========================================================
const items = [];
let snapFallbackRows = 0;
for (const e of byName.values()) {
  // Shop-Zeilen: UEX hat Vorrang, der ältere Snapshot greift nur ohne UEX-Treffer
  const shopRows = e.shopUex.length ? e.shopUex : e.shopSnap;
  if (!e.shopUex.length) snapFallbackRows += e.shopSnap.length;
  e.obtain = shopRows.concat(e.obtain);

  const seen = new Set();
  e.obtain = e.obtain.filter((o) => {
    const k = `${o.kind}|${o.loc}|${o.price ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Kaufbares zuerst (billigster zuerst), dann Loot alphabetisch
  e.obtain.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.loc.localeCompare(b.loc));
  items.push(e);
}
items.sort((a, b) => a.name.localeCompare(b.name, 'en'));
for (const e of items) e.id = slugId(e.name);

const counts = {
  items: items.length,
  withObtain: items.filter((i) => i.obtain.length).length,
  uexRows, snapFallbackRows, lootRows, vehicleRows,
  catalogOnly: items.filter((i) => !i.obtain.length).length,
  catalogSkippedPlaceholders: catalogSkipped,
};

const db = {
  generator: 'scripts/build-universal-db.mjs',
  generatedAt: new Date().toISOString().slice(0, 10),
  pricesAsOf: uexDb.fetchedAt,
  note: 'Keine fabrizierten Werte: Items ohne bekannte Quelle haben obtain:[] (Katalog). Preise/Orte Patch-volatil — ingame prüfen.',
  sources: {
    prices: `src/data/item-prices.json — UEX Corp, Stand ${uexDb.fetchedAt}; identisch mit den Kaufpreis-Tabellen auf starcitizen.tools`,
    shopsFallback: 'assets/dismantling-items.json — kuratierter Shop-Snapshot, greift nur ohne UEX-Treffer',
    loot: 'src/data/loot-items.json — eigene Loot-Recherche (Fundorte + Guides)',
    vehicles: 'src/data/vehicles.json + vehicle-prices.json — UEX Corp (uexcorp.space)',
    catalog: iniFound ? 'global.ini (item_Name*) aus lokaler Data.p4k-Extraktion' : 'ÜBERSPRUNGEN (global.ini nicht gefunden)',
  },
  counts,
  items: items.map((e) => {
    const o = { id: e.id, name: e.name, category: e.category || 'Other', obtain: e.obtain };
    if (e.guide) o.guide = e.guide;
    return o;
  }),
};

writeFileSync(OUT, JSON.stringify(db, null, 1));
console.log(`OK: ${OUT}`);
console.log(counts);
