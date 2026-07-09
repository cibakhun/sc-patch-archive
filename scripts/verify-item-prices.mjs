// verify-item-prices.mjs — gleicht assets/universal-items.json gegen die
// Referenzquellen ab und meldet Abweichungen:
//   1) VOLL-Abgleich aller Shop-Zeilen gegen UEX live (/2.0/items_prices_all):
//      prüft Join-/Dedupe-Fehler des Fetch-Skripts und Preis-Drift seit Snapshot.
//   2) STICHPROBE gegen die Star-Citizen-Wiki-API (starcitizen.tools zeigt deren
//      uex_prices an): ~30 Items via UUID, Terminal+Preis-Vergleich.
//   3) AUDIT: tote Locations (Levski, Port Olisar, …) in allen obtain-Zeilen.
//
// Aufruf: node scripts/verify-item-prices.mjs   (npm run verify:items)
// Exit 0 = konsistent (Drift wird gemeldet, ist aber kein Fehler),
// Exit 1 = strukturelle Abweichung (Join-Fehler, tote Locations, Wiki-Widerspruch).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const db = JSON.parse(readFileSync(resolve(ROOT, 'assets', 'universal-items.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// WICHTIG: Locations dürfen NICHT auf den bloßen Terminal-Namen normalisiert
// werden — Stationsnamen sind systemübergreifend mehrdeutig („Stanton Gateway"
// existiert in Pyro UND Nyx, mit unterschiedlichen Preisen). Der Vergleich
// nutzt daher exakt dieselbe Suffix-Logik wie fetch-uex-item-prices.mjs.
function withSystemSuffix(name, system) {
  let loc = name || 'Unbekanntes Terminal';
  if (system && system !== 'Stanton' && !loc.includes(system)) loc += ` (${system})`;
  return loc;
}

// ---------- 1) UEX-Live-Voll-Abgleich ----------
console.log('1) UEX live ziehen …');
const [uexPrices, uexTerminals] = await Promise.all([
  getJson('https://api.uexcorp.space/2.0/items_prices_all').then((b) => b.data),
  getJson('https://api.uexcorp.space/2.0/terminals').then((b) => b.data),
]);
const termById = new Map(uexTerminals.map((t) => [t.id, t]));
const live = new Map(); // nameLower -> Map(loc -> minPrice)
const uuidByName = new Map();
for (const row of uexPrices) {
  if (!row.item_name || !(row.price_buy > 0)) continue;
  const key = row.item_name.toLowerCase().trim();
  if (row.item_uuid) uuidByName.set(key, row.item_uuid);
  const t = termById.get(row.id_terminal);
  const loc = withSystemSuffix((t && t.name) || row.terminal_name, t && t.star_system_name);
  if (!live.has(key)) live.set(key, new Map());
  const m = live.get(key);
  if (!m.has(loc) || row.price_buy < m.get(loc)) m.set(loc, row.price_buy);
}

let itemsChecked = 0, rowsOk = 0, priceDrift = 0, locMissingLive = 0, locExtraLive = 0;
const fallbackItems = [];
const driftSamples = [];
for (const it of db.items) {
  const shopRows = it.obtain.filter((o) => o.kind === 'shop');
  if (!shopRows.length) continue;
  const key = it.name.toLowerCase();
  const liveRows = live.get(key);
  if (!liveRows) { fallbackItems.push(it); continue; } // Snapshot-Fallback, kein UEX-Item
  itemsChecked++;
  for (const o of shopRows) {
    if (!liveRows.has(o.loc)) { locMissingLive++; continue; }
    if (liveRows.get(o.loc) === o.price) rowsOk++;
    else {
      priceDrift++;
      if (driftSamples.length < 8) driftSamples.push(`${it.name} @ ${o.loc}: DB ${o.price} vs live ${liveRows.get(o.loc)}`);
    }
  }
  const ourLocs = new Set(shopRows.map((o) => o.loc));
  for (const loc of liveRows.keys()) if (!ourLocs.has(loc)) locExtraLive++;
}
console.log(`   Items mit UEX-Quelle: ${itemsChecked}`);
console.log(`   Zeilen identisch: ${rowsOk} | Preis-Drift: ${priceDrift} | Ort fehlt live: ${locMissingLive} | live hat mehr Orte: ${locExtraLive}`);
for (const s of driftSamples) console.log(`     drift: ${s}`);

// ---------- 2) Wiki-Stichprobe (systematisch, deterministisch) ----------
console.log('2) Wiki-Stichprobe …');
const priced = db.items.filter((i) => i.obtain.some((o) => o.kind === 'shop' && live.has(i.name.toLowerCase())));
const step = Math.max(1, Math.floor(priced.length / 30));
const sample = priced.filter((_, i) => i % step === 0).slice(0, 30);
let wikiOk = 0, wikiDrift = 0, wikiMissing = 0, wikiErrors = 0, wikiNoUuid = 0;
const wikiNotes = [];
for (const it of sample) {
  const uuid = uuidByName.get(it.name.toLowerCase());
  if (!uuid) { wikiNoUuid++; continue; } // ohne UUID nicht prüfbar (kein Widerspruch)
  try {
    const w = await getJson(`https://api.star-citizen.wiki/api/v2/items/${uuid}`);
    const purchase = w.data?.uex_prices?.purchase || [];
    const wikiRows = new Map();
    for (const p of purchase) {
      if (!(p.price_buy > 0)) continue;
      const loc = withSystemSuffix(p.terminal_name, p.starmap_location?.star_system_name);
      if (!wikiRows.has(loc) || p.price_buy < wikiRows.get(loc)) wikiRows.set(loc, p.price_buy);
    }
    // Fallback ohne System-Suffix, falls dem Wiki die starmap_location fehlt
    const stripSys = (s) => s.replace(/\s\((Pyro|Nyx)\)$/i, '');
    const ours = it.obtain.filter((o) => o.kind === 'shop');
    let allOk = true;
    for (const o of ours) {
      let want = wikiRows.get(o.loc);
      if (want === undefined) want = wikiRows.get(stripSys(o.loc));
      if (want === undefined) { wikiMissing++; allOk = false; wikiNotes.push(`${it.name}: Ort "${o.loc}" nicht im Wiki`); }
      else if (want !== o.price) { wikiDrift++; allOk = false; wikiNotes.push(`${it.name} @ ${o.loc}: DB ${o.price} vs Wiki ${want}`); }
    }
    if (allOk) wikiOk++;
  } catch (e) { wikiErrors++; wikiNotes.push(`${it.name}: Wiki-Fehler ${e.message}`); }
  await sleep(200);
}
console.log(`   Stichprobe: ${sample.length} Items | vollständig identisch: ${wikiOk} | Preis-Abweichung: ${wikiDrift} | Ort fehlt im Wiki: ${wikiMissing} | nicht prüfbar (keine UUID): ${wikiNoUuid} | Fehler: ${wikiErrors}`);
for (const n of wikiNotes.slice(0, 10)) console.log(`     wiki: ${n}`);

// ---------- 3) Tote Locations ----------
// Levski/Nyx ist KEIN Fehler: in 4.8 im Spiel (UEX-Preismeldungen Juni 2026)
// und starcitizen.tools listet die Levski-Shops identisch (verifiziert
// 2026-07-09, z.B. ADP Arms Black @ Cordry's - Levski, 1559 aUEC).
console.log('3) Audit tote Locations …');
const DEAD = /port olisar/i;
const deadRows = [];
for (const it of db.items) {
  for (const o of it.obtain) {
    if (DEAD.test(o.loc)) deadRows.push(`${it.name} [${o.kind}] @ ${o.loc}`);
  }
}
console.log(`   Zeilen mit toten Locations: ${deadRows.length}`);
for (const d of deadRows.slice(0, 15)) console.log(`     tot: ${d}`);

// ---------- 4) Fallback-Audit ----------
console.log(`4) Snapshot-Fallback-Items (kein UEX-Treffer): ${fallbackItems.length}`);
for (const it of fallbackItems) {
  for (const o of it.obtain.filter((o) => o.kind === 'shop')) console.log(`     fallback: ${it.name} @ ${o.loc} (${o.price} aUEC)`);
}

// ---------- Verdict ----------
const structuralIssues = locMissingLive + deadRows.length + wikiMissing;
console.log('---');
console.log(structuralIssues === 0
  ? `OK: strukturell konsistent. Drift (Preis-Updates seit Snapshot ${db.pricesAsOf}): ${priceDrift + wikiDrift} Zeilen — mit sync:item-prices aktualisierbar.`
  : `ANPASSUNG NÖTIG: ${locMissingLive} Orte nicht mehr live, ${wikiMissing} Orte nicht im Wiki, ${deadRows.length} tote Locations.`);
process.exit(structuralIssues === 0 ? 0 : 1);
