// freeze-mining-constants.mjs — friert die ZWEI Felder ein, die NICHT sauber im
// Client-DataCore liegen, aus einem LETZTEN scmdb-Zug:
//   1) Refinery-Yield-Profile (serverseitige Economy — kein Client-Record)
//   2) density je Element (nicht im MineableElement-Record)
// Danach fetcht die Mining-Pipeline scmdb NIRGENDS mehr. Ausgabe getrackt:
// assets/mining-frozen.json (manuell gepflegt, wenn CIG die Werte ändert — selten).
//
// Aufruf: node scripts/freeze-mining-constants.mjs
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'mining-frozen.json');
const BASE = 'https://scmdb.net/data';
const H = { 'User-Agent': 'sc-patch-archiv fan site (non-commercial)', Accept: 'application/json' };
const SNAP = process.env.SNAP_DATE || new Date().toISOString().slice(0, 10);
const getJSON = async (u) => { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`); return r.json(); };
const cleanMat = (s) => { let x = String(s || '').replace(/\s*\((?:Ore|Raw|Pure)\)\s*$/i, '').trim(); if (/^Aluminium$/i.test(x)) x = 'Aluminum'; if (/^Carinitepure$/i.test(x)) x = 'Carinite'; if (/^Sileron$/i.test(x)) x = 'Stileron'; return x; };

const versions = await getJSON(`${BASE}/versions.json`);
const live = versions.find((v) => /-live/i.test(v.version));
if (!live) throw new Error('keine -live-Version bei scmdb');
const data = await getJSON(`${BASE}/mining_data-${live.version}.json`);

// Element-Metadaten je Material (Fallbacks für nicht sauber client-extrahierbare Felder):
// scanSignature + qualityBands (nirgends im Client gefunden), rarity (nur Edelsteine
// ohne shipmineables-Schema), density (Fallback — primär game-sourced aus resourceType).
const elementMeta = {};
for (const e of Object.values(data.mineableElements || {})) {
  const mat = cleanMat(e.materialName || e.name);
  if (!mat || mat in elementMeta) continue;
  elementMeta[mat] = { scanSignature: e.scanSignature ?? null, qualityBands: e.qualityBands ?? null, rarity: e.rarity ?? null, density: e.density ?? null };
}
// Refinery-Yield-Profile (serverseitige CIG-Economy — kein Client-Record)
const refineries = (data.refineries || []).map((r) => ({ name: r.name, system: r.system, profileId: r.profileId }));
const refineryProfiles = data.refineryProfiles || {};

const payload = {
  source_note: 'EIN Feld liegt prinzipiell nicht in der Data.p4k und ist aus scmdb eingefroren: Refinery-Yield-Profile (serverseitige CIG-Economy — kein Client-Record). Alles Übrige hier ist nur Fallback und wird primär game-sourced (density=resourceType.densityType, scanSignature=element-spez. mineable-Rock, qualityBands=crafting/qualityquantization, rarity=Kompositions-Namensschema). Hinweis: Edelsteine haben in den Spieldaten GAR KEINE Seltenheit (kein rarity-Feld existiert; scmdb ebenfalls leer) — sie bleiben bewusst ohne Stufe. Manuell pflegen, wenn CIG die Refinery-Economy ändert (selten).',
  frozen_from: `scmdb ${live.version}`,
  snapshot_date: SNAP,
  counts: { elementMeta: Object.keys(elementMeta).length, refineries: refineries.length, refineryProfiles: Object.keys(refineryProfiles).length },
  elementMeta,
  refineries,
  refineryProfiles,
};
writeFileSync(OUT, JSON.stringify(payload, null, 1) + '\n', 'utf8');
console.log(`Eingefroren aus scmdb ${live.version}: ${Object.keys(elementMeta).length} elementMeta, ${refineries.length} Refineries, ${Object.keys(refineryProfiles).length} Profile -> ${OUT}`);
