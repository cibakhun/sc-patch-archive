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

  // Fundorte pro Element ranken — EXAKT nach scmdb: effectivePct = depositPct(%)
  // × maxPercent/100 (depositPct = Deposit-Anteil innerhalb der Gruppe). Kein
  // groupProbability/part.probability im Score. Je Location der beste Wert.
  const MINING_LBL = {
    SpaceShip_Mineables: 'ship', SpaceShip_Mineables_Rare: 'ship',
    FPS_Mineables: 'fps', GroundVehicle_Mineables: 'roc', Harvestables: 'harvest',
  };
  // Bei Gleichstand: Asteroiden-Spots (Belt/Cluster/Lagrange) vor Körpern —
  // das sind die typischen Ship-Mining-Reviere (z. B. Aaron Halo).
  const TYPE_PREF = { belt: 0, cluster: 1, lagrange: 2, planet: 3, moon: 4, cave: 5, station: 6, event: 7, special: 8 };
  const locByElem = {};
  for (const loc of data.locations || []) {
    for (const g of loc.groups || []) {
      const tot = (g.deposits || []).reduce((s, d) => s + (d.relativeProbability || 0), 0);
      const mining = MINING_LBL[g.groupName] || null;
      for (const d of g.deposits || []) {
        const comp = data.compositions[d.compositionGuid];
        if (!comp?.parts) continue;
        const depositPct = tot > 0 ? ((d.relativeProbability || 0) / tot) * 100 : 0;
        for (const p of comp.parts) {
          const en = p.elementName;
          if (!en) continue;
          const eff = depositPct * ((p.maxPercent ?? 100) / 100);
          (locByElem[en] ??= {});
          const k = loc.locationName;
          if (!locByElem[en][k] || locByElem[en][k].eff < eff) {
            locByElem[en][k] = { location: loc.locationName, system: loc.system, type: loc.locationType, mining, abundance: Math.round(p.maxPercent ?? 0), eff };
          }
        }
      }
    }
  }
  // Top-N je SYSTEM (damit ein System-Filter immer die besten Stanton/Pyro/Nyx-
  // Spots hat), dann als eine nach effectivePct sortierte Liste zusammengeführt.
  const cmp = (a, b) => (b.eff - a.eff) || ((TYPE_PREF[a.type] ?? 9) - (TYPE_PREF[b.type] ?? 9)) || a.location.localeCompare(b.location);
  const topLocs = (en, nPerSys = 5) => {
    const all = Object.values(locByElem[en] || {});
    const bySys = {};
    for (const x of all) (bySys[x.system] ??= []).push(x);
    const picked = [];
    for (const sys of Object.keys(bySys)) picked.push(...bySys[sys].sort(cmp).slice(0, nPerSys));
    return picked.sort(cmp).map((x) => ({ location: x.location, system: x.system, type: x.type, mining: x.mining, abundance: x.abundance }));
  };

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
    locations: topLocs(e.name),
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

  // Refinery-Yield-Boni: Stationen + Profile (pro Erz Yield-Bonus in %).
  const refineries = (data.refineries || []).map((r) => ({ name: r.name, system: r.system, profileId: r.profileId }));
  const refineryProfiles = data.refineryProfiles || {};

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
      refineries: refineries.length,
    },
    elements,
    compositions,
    lasers,
    modules,
    gadgets,
    refineries,
    refineryProfiles,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload) + '\n', 'utf8');
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0);
  console.log(`\nGeschrieben: ${OUT}`);
  console.log(
    `  ${elements.length} Elemente, ${compositions.length} Kompositionen, ${lasers.length} Laser, ${modules.length} Module, ${gadgets.length} Gadgets, ${refineries.length} Raffinerien, ~${kb} KB`
  );
}

main().catch((e) => {
  console.error('\nFEHLER:', e.message);
  process.exit(1);
});
