// fetch-scmdb-model.mjs — game-akkurates Mining-Physik-Modell (Patch 4.8.x).
// Zieht die datamined Mining-Werte (mineableElements, compositions, globalParams,
// lasers/modules/gadgets) aus den öffentlichen Versions-JSONs von scmdb.net und
// schreibt ein kompaktes Modell nach assets/mining-model.json (kanonisch; wird per
// _sync-assets.mjs nach public/assets gespiegelt).
//
//   node scripts/fetch-scmdb-model.mjs
//
// Quelle: game-file-Extraktion (CIG-Spieldaten). Physik-Konstanten & Formeln
// verifiziert am „Solver Math"-Panel der Referenz. Patch-volatil.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'mining-model.json');
const BASE = 'https://scmdb.net/data';
const HEADERS = { 'User-Agent': 'sc-patch-archiv fan site (non-commercial)', Accept: 'application/json' };
const SNAP_DATE = process.env.SNAP_DATE || new Date().toISOString().slice(0, 10);

async function getJSON(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  console.log('Versionen …');
  const versions = await getJSON(`${BASE}/versions.json`);
  // bevorzugt die LIVE-Version (nicht PTU); sonst die erste.
  const live = versions.find((v) => /-live/i.test(v.version)) || versions[0];
  const ver = live.version;
  console.log(`  Modell-Version: ${ver}`);

  console.log('Mining-Daten + Gear …');
  const [data, equip] = await Promise.all([
    getJSON(`${BASE}/mining_data-${ver}.json`),
    getJSON(`${BASE}/mining_equipment-${ver}.json`),
  ]);

  // Elemente: die datamined Physik pro Mineral (aus mining_data — reichhaltiger).
  const elements = Object.entries(data.mineableElements).map(([guid, e]) => ({
    guid,
    name: e.name,
    material: e.materialName,
    resourceType: e.resourceType,
    density: e.density,
    instability: e.instability,
    resistance: e.resistance,
    optimalWindowMidpoint: e.optimalWindowMidpoint,
    optimalWindowRandomness: e.optimalWindowRandomness,
    optimalWindowThinness: e.optimalWindowThinness,
    explosionMultiplier: e.explosionMultiplier,
    clusterFactor: e.clusterFactor,
    rarity: e.rarity,
    scanSignature: e.scanSignature,
    groundScanSignature: e.groundScanSignature,
    qualityBands: e.qualityBands,
  })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Kompositionen: Rock-Zusammensetzung pro Signatur (dominantes Mineral + Anteile).
  const compositions = Object.entries(data.compositions).map(([guid, c]) => ({
    guid,
    name: c.name,
    parts: (c.parts || []).map((p) => ({
      element: p.elementName,
      elementGuid: p.elementGuid,
      probability: p.probability,
      minPercent: p.minPercent,
      maxPercent: p.maxPercent,
      curveExponent: p.curveExponent,
      qualityScale: p.qualityScale,
    })),
  })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Gear: echte Laser/Module/Gadgets mit DPS + Modifikatoren.
  const cleanBeam = (b) => (b ? { full: b.fullDamageRange, zero: b.zeroDamageRange, dps: b.damagePerSecond } : null);
  const lasers = (equip.lasers || []).map((l) => ({
    name: l.name,
    size: l.size,
    grade: l.grade,
    maker: l.manufacturer,
    builtIn: l.vehicleBuiltIn,
    slots: l.moduleSlots,
    throttleMin: l.throttleMinimum,
    mining: cleanBeam(l.miningBeam),
    extraction: cleanBeam(l.extractionBeam),
    mods: l.modifiers,
  })).sort((a, b) => (a.size - b.size) || (a.name || '').localeCompare(b.name || ''));
  const modules = (equip.modules || []).map((m) => ({
    name: m.name, type: m.type, size: m.size, grade: m.grade, maker: m.manufacturer,
    charges: m.charges, lifetime: m.lifetime,
    miningMult: m.miningDamageMultiplier, extractionMult: m.extractionMultiplier,
    mods: m.modifiers,
  })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const gadgets = (equip.gadgets || []).map((g) => ({
    name: g.name, maker: g.manufacturer, mods: g.modifiers,
  })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const payload = {
    source_note:
      'Game-akkurates Mining-Physik-Modell aus CIG-Spieldaten (datamined). Formeln/Konstanten am Solver-Math-Modell der Community verifiziert. Patch-volatil — ingame prüfen.',
    source_version: ver,
    snapshot_date: SNAP_DATE,
    params: equip.globalParams, // ship/fps/vehicle-Konstanten (powerCapacityPerMass, resistanceCurveFactor, cSCUPerVolume …)
    qualityBandBoundaries: data.qualityBandBoundaries,
    counts: {
      elements: elements.length,
      compositions: compositions.length,
      lasers: lasers.length,
      modules: modules.length,
      gadgets: gadgets.length,
    },
    elements,
    compositions,
    lasers,
    modules,
    gadgets,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0);
  console.log(`\nGeschrieben: ${OUT}`);
  console.log(
    `  ${elements.length} Elemente, ${compositions.length} Kompositionen, ${lasers.length} Laser, ${modules.length} Module, ${gadgets.length} Gadgets, ~${kb} KB`
  );
}

main().catch((e) => {
  console.error('\nFEHLER:', e.message);
  process.exit(1);
});
