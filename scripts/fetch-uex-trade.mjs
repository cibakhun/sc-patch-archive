// fetch-uex-trade.mjs — holt die VOLLE Kauf/Verkauf-Matrix (Terminal × Ware) von
// UEX Corp und schreibt deterministisch assets/trade-data.json. Grundlage für den
// Handelsrouten-Rechner (/trade-routes.html).
//
// Unterschied zu fetch-uex-commodities.mjs (Refinery): das dortige Skript
// verdichtet auf EINEN Durchschnittspreis je Ware und wirft die 2.596 Terminal-
// Zeilen weg. Für Routen brauchen wir aber das Paar (Kaufterminal → Verkaufs-
// terminal), also bleibt hier jede Zeile erhalten.
//
// WICHTIG — Frische: Star-Citizen-Preise sind serverseitig und pro Shard
// unterschiedlich; es gibt keine Live-Schnittstelle. UEX ist community-erhoben,
// das Median-Alter einer Zeile liegt bei rund zwei Tagen. Deshalb wird
// `date_modified` JEDER Zeile mitgeschrieben: die Oberfläche zeigt das Alter an
// und gewichtet veraltete Zeilen in der Rangfolge ab, statt Frische vorzutäuschen.
//
// Aufruf: node scripts/fetch-uex-trade.mjs   (npm run sync:trade)
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'trade-data.json');
const BASE = 'https://api.uexcorp.space/2.0';

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`UEX ${path}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== 'ok') throw new Error(`UEX ${path}: status ${body.status}`);
  return body.data;
}

console.log('Lade UEX: star_systems, terminals, commodities, commodities_prices_all …');
const [systems, terminals, commodities, priceRows] = await Promise.all([
  getJson('/star_systems'),
  getJson('/terminals?type=commodity'),
  getJson('/commodities'),
  getJson('/commodities_prices_all'),
]);

// ---- Systeme: nur die im Spiel erreichbaren -------------------------------
const sysById = new Map();
for (const s of systems) {
  if (!s.is_available && !s.is_available_live) continue;
  sysById.set(s.id, String(s.name).trim());
}
const SYSTEM_ORDER = ['Stanton', 'Pyro', 'Nyx'];
const systemNames = [...new Set(sysById.values())].sort(
  (a, b) => {
    const ia = SYSTEM_ORDER.indexOf(a), ib = SYSTEM_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  },
);

// ---- Terminals ------------------------------------------------------------
// `name` ist der Kioskname („Admin - ARC-L1"), `displayname` der Ort
// („ARC-L1 Wide Forest Station"). Für Routen ist der ORT die nützliche Angabe.
const termIdx = new Map(); // uex-id -> Index in terminals[]
const termOut = [];
for (const t of terminals) {
  if (!t.is_available && !t.is_available_live) continue;
  if (t.is_visible === 0) continue;
  const system = sysById.get(t.id_star_system);
  if (!system) continue; // Terminal in einem (noch) nicht spielbaren System
  termIdx.set(t.id, termOut.length);
  termOut.push({
    name: String(t.displayname || t.name || '').trim(),
    kiosk: String(t.name || '').trim(),
    short: String(t.nickname || t.code || '').trim(),
    system,
    // Anfliegbarkeit: beeinflusst, ob große Schiffe dort überhaupt laden können
    dock: t.has_loading_dock ? 1 : 0,
    elevator: t.has_freight_elevator ? 1 : 0,
    noQuestions: t.is_nqa ? 1 : 0,
  });
}

// ---- Waren ----------------------------------------------------------------
const comIdx = new Map();
const comOut = [];
for (const c of commodities) {
  if (c.is_available === 0 && c.is_available_live === 0) continue;
  comIdx.set(c.id, comOut.length);
  comOut.push({
    name: String(c.name).trim(),
    code: c.code || null,
    kind: c.kind || null,
    scuWeight: c.weight_scu ?? null,
    isRaw: c.is_raw ? 1 : 0,
    isMineral: c.is_mineral ? 1 : 0,
    isHarvestable: c.is_harvestable ? 1 : 0,
    isIllegal: c.is_illegal ? 1 : 0,
    // Verse-Durchschnitt als Rückfallebene, wenn ein Terminal keine frische Zeile hat
    avgBuy: c.price_buy > 0 ? Math.round(c.price_buy) : null,
    avgSell: c.price_sell > 0 ? Math.round(c.price_sell) : null,
  });
}

// ---- Preiszeilen ----------------------------------------------------------
// Kompaktformat je Zeile: [warenIdx, terminalIdx, preis, scu, status, ts]
//   scu    = kaufbarer Bestand bzw. bekannte Abnahme (0 = unbekannt, häufig)
//   status = UEX-Bestandsstufe 1..7 (7 = voll), 0 = unbekannt
//   ts     = date_modified als Unix-Sekunden → Alter wird im Browser live berechnet
const buy = [];
const sell = [];
let skipped = 0;
for (const r of priceRows) {
  const ci = comIdx.get(r.id_commodity);
  const ti = termIdx.get(r.id_terminal);
  if (ci === undefined || ti === undefined) { skipped++; continue; }
  const ts = r.date_modified || r.date_added || 0;
  if (r.status_buy > 0 && r.price_buy > 0) {
    buy.push([ci, ti, Math.round(r.price_buy), Math.round(r.scu_buy || 0), r.status_buy || 0, ts]);
  }
  if (r.status_sell > 0 && r.price_sell > 0) {
    sell.push([ci, ti, Math.round(r.price_sell), Math.round(r.scu_sell || 0), r.status_sell || 0, ts]);
  }
}

// Deterministische Reihenfolge (Diff-Rauschen vermeiden)
const byRow = (a, b) => a[0] - b[0] || a[1] - b[1];
buy.sort(byRow);
sell.sort(byRow);

// ---- Kennzahlen zur Frische (landen sichtbar in der Oberfläche) -----------
const now = Math.floor(Date.now() / 1000);
const ages = [...buy, ...sell].map((r) => now - r[5]).sort((a, b) => a - b);
const medianAge = ages.length ? ages[Math.floor(ages.length / 2)] : 0;
const fresh24 = ages.filter((a) => a < 86400).length;

// handelbar = Ware hat irgendwo einen Kauf- UND irgendwo einen Verkaufsort
const buyable = new Set(buy.map((r) => r[0]));
const sellable = new Set(sell.map((r) => r[0]));
const tradable = [...buyable].filter((i) => sellable.has(i)).length;

const snapshot = {
  meta: {
    builtAt: new Date().toISOString(),
    source:
      'UEX Corp (uexcorp.space) — community-erhobene Terminalpreise, in-game verifiziert. Dieselbe Quelle wie die Item-, Schiffs- und Refinery-Preise der Seite.',
    endpoints: ['/2.0/star_systems', '/2.0/terminals?type=commodity', '/2.0/commodities', '/2.0/commodities_prices_all'],
    note:
      'Preise und Bestände sind in Star Citizen serverseitig und je Shard verschieden — eine Live-Schnittstelle existiert nicht. Jede Zeile trägt daher ihren Erfassungszeitpunkt (ts, Unix-Sekunden).',
    counts: {
      systems: systemNames.length,
      terminals: termOut.length,
      commodities: comOut.length,
      buyRows: buy.length,
      sellRows: sell.length,
      tradableCommodities: tradable,
      skippedRows: skipped,
    },
    freshness: {
      medianAgeHours: Math.round((medianAge / 3600) * 10) / 10,
      rowsUnder24h: fresh24,
      rowsTotal: ages.length,
    },
  },
  systems: systemNames,
  terminals: termOut,
  commodities: comOut,
  buy,
  sell,
};

writeFileSync(OUT, JSON.stringify(snapshot));
console.log('OK:', OUT);
console.log(snapshot.meta.counts);
console.log('Frische:', snapshot.meta.freshness);
