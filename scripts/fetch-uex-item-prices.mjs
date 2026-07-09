// fetch-uex-item-prices.mjs — holt Item-Kaufpreise + Kauforte von UEX Corp und
// schreibt deterministisch src/data/item-prices.json.
//
// Das sind exakt die Preisdaten, die starcitizen.tools auf den Item-Seiten
// anzeigt: Die Star-Citizen-Wiki-API führt seit dem Server-Side-Umzug der
// Shop-Daten (~3.20) ein leeres shops:[] und bettet stattdessen uex_prices ein.
// Quelle der Wahrheit ist also UEX (Community-erhoben, in-game verifiziert).
//
// Aufruf: node scripts/fetch-uex-item-prices.mjs   (npm run sync:item-prices)
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'src', 'data', 'item-prices.json');
const BASE = 'https://api.uexcorp.space/2.0';

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`UEX ${path}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'ok') throw new Error(`UEX ${path}: status ${body.status}`);
  return body.data;
}

// UEX-Sektion/Kategorie -> Site-Taxonomie (Wurzeln wie in universal-items)
function mapCategory(section, name) {
  switch (section) {
    case 'Armor': return `Armour / ${name}`;
    case 'Undersuits': return 'Armour / Undersuits';
    case 'Clothing': return `Clothing / ${name}`;
    case 'Personal Weapons': return name === 'Attachments' ? 'Attachment' : 'Weapons';
    case 'Vehicle Weapons': return `Vehiclegear / Weapons / ${name}`;
    case 'Systems':
    case 'Avionics':
    case 'Propulsion':
    case 'Module':
    case 'Liveries': return `Vehiclegear / ${name}`;
    case 'Utility': return name === 'Gadgets' ? 'Utility / Gadgets' : `Vehiclegear / ${name}`;
    case 'Consumable':
    case 'Miscellaneous': return `Utility / ${name}`;
    case 'Technology': return `Utility / ${name}`;
    case 'Decorations': return 'Other / Decorations';
    case 'Flair': return 'Other / Flair';
    default: return 'Other';
  }
}

console.log('Lade UEX: categories, terminals, items_prices_all …');
const [categories, terminals, priceRows] = await Promise.all([
  getJson('/categories'),
  getJson('/terminals'),
  getJson('/items_prices_all'),
]);

const catById = new Map(categories.map((c) => [c.id, mapCategory(c.section, c.name)]));
const termById = new Map(terminals.map((t) => [t.id, t]));

function locOf(row) {
  const t = termById.get(row.id_terminal);
  let loc = (t && t.name) || row.terminal_name || 'Unbekanntes Terminal';
  // Multi-System-Klarheit: Nicht-Stanton-Systeme kennzeichnen (Namen tragen es selten selbst)
  const sys = t && t.star_system_name;
  if (sys && sys !== 'Stanton' && !loc.includes(sys)) loc += ` (${sys})`;
  return loc;
}

const items = new Map(); // key: name lower
let usedRows = 0;
for (const row of priceRows) {
  if (!row.item_name || !(row.price_buy > 0)) continue;
  const key = row.item_name.toLowerCase().trim();
  if (!items.has(key)) {
    items.set(key, {
      name: row.item_name.trim(),
      category: catById.get(row.id_category) || 'Other',
      rows: new Map(), // loc -> price (bei Dubletten günstigster)
    });
  }
  const it = items.get(key);
  const loc = locOf(row);
  const prev = it.rows.get(loc);
  if (prev === undefined || row.price_buy < prev) it.rows.set(loc, row.price_buy);
  usedRows++;
}

// deterministisch: Items nach Key, Rows nach Preis dann Ort
const outItems = {};
for (const key of [...items.keys()].sort()) {
  const it = items.get(key);
  const rows = [...it.rows.entries()]
    .map(([loc, price]) => ({ loc, price }))
    .sort((a, b) => a.price - b.price || a.loc.localeCompare(b.loc));
  outItems[key] = { name: it.name, category: it.category, rows };
}

const snapshot = {
  fetchedAt: new Date().toISOString().slice(0, 10),
  source: 'UEX Corp (uexcorp.space) — identisch mit den Kaufpreis-Tabellen auf starcitizen.tools (uex_prices der Wiki-API)',
  endpoints: ['/2.0/items_prices_all', '/2.0/terminals', '/2.0/categories'],
  counts: { priceRows: priceRows.length, usedRows, items: items.size },
  items: outItems,
};

writeFileSync(OUT, JSON.stringify(snapshot));
console.log(`OK: ${OUT}`);
console.log(snapshot.counts);
