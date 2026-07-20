// fetch-uex-commodities.mjs — holt Verkaufspreise raffinierter Materialien +
// besten Verkaufsort von UEX Corp und schreibt deterministisch
// src/data/commodity-prices.json. Für die Wert-Schätzung im Refinery-Dashboard
// („wie viel man am Ende hat").
//
// Gleiche Quelle & Attribution wie die Item-/Schiffspreise der Seite: UEX Corp
// (Community-erhoben, in-game verifiziert). Es werden NUR raffinierte OUTPUTS
// (verkaufbare Endprodukte) gespeichert — Roh-Erz verkauft man nicht.
//
// Aufruf: node scripts/fetch-uex-commodities.mjs   (npm run sync:commodity-prices)
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'src', 'data', 'commodity-prices.json');
const BASE = 'https://api.uexcorp.space/2.0';

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`UEX ${path}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'ok') throw new Error(`UEX ${path}: status ${body.status}`);
  return body.data;
}

console.log('Lade UEX: commodities, terminals, commodities_prices_all …');
const [commodities, terminals, priceRows] = await Promise.all([
  getJson('/commodities'),
  getJson('/terminals').catch(() => []),
  getJson('/commodities_prices_all').catch(() => []),
]);

const termById = new Map(terminals.map((t) => [t.id, t]));
function locOf(row) {
  const t = termById.get(row.id_terminal);
  let loc = (t && (t.name || t.displayname)) || row.terminal_name || 'Unbekanntes Terminal';
  // Multi-System-Klarheit: Nicht-Stanton-Systeme kennzeichnen (Namen tragen es selten selbst)
  const sys = t && t.star_system_name;
  if (sys && sys !== 'Stanton' && !loc.includes(sys)) loc += ` (${sys})`;
  return loc;
}

// bester Verkaufsort je Rohstoff (per commodity_name gematcht — direkt in der Zeile)
const bestSell = new Map(); // name(lower) -> { price, loc }
for (const row of priceRows) {
  if (row.status_sell !== 1 || !(row.price_sell > 0)) continue;
  const key = String(row.commodity_name || '').toLowerCase().trim();
  if (!key) continue;
  const prev = bestSell.get(key);
  if (!prev || row.price_sell > prev.price) bestSell.set(key, { price: row.price_sell, loc: locOf(row) });
}

// Nur raffinierte OUTPUTS: is_raw==0 mit positivem Durchschnitts-Verkaufspreis.
const out = {};
let n = 0;
for (const c of commodities) {
  if (c.is_raw || !(c.price_sell > 0)) continue;
  const key = String(c.name).toLowerCase().trim();
  const best = bestSell.get(key);
  out[key] = {
    name: String(c.name).trim(),
    code: c.code || null,
    kind: c.kind || null,
    weight_scu: c.weight_scu ?? null,
    sell: Math.round(c.price_sell), // Verse-Durchschnitt (robust) — Primärwert
    buy: c.price_buy > 0 ? Math.round(c.price_buy) : null,
    sellMax: best ? Math.round(best.price) : null, // bester aktueller Terminal-Preis
    sellLoc: best ? best.loc : null,
    is_mineral: !!c.is_mineral,
    wiki: c.wiki || null,
  };
  n++;
}

const snapshot = {
  fetchedAt: new Date().toISOString().slice(0, 10),
  source: 'UEX Corp (uexcorp.space) — Community-erhobene Verkaufspreise, in-game verifiziert (dieselbe Quelle wie die Item- und Schiffspreise der Seite).',
  endpoints: ['/2.0/commodities', '/2.0/commodities_prices_all', '/2.0/terminals'],
  counts: { commodities: commodities.length, refinedOutputs: n, priceRows: priceRows.length },
  commodities: Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]])),
};

writeFileSync(OUT, JSON.stringify(snapshot));
console.log('OK:', OUT);
console.log(snapshot.counts);
