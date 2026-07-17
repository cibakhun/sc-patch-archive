// datamine-gear.mjs — Mining-Gear (Laser/Module/Gadgets) 100% aus den Spieldateien,
// node-nativ über den DataCore-Reader (kein scmdb). Beam-DPS = FireBeam.damagePerSecond.
// DamageEnergy; Mods aus MiningLaserModifier; Namen/Hersteller aus Localization.
//
// Aufruf: node scripts/datamine-gear.mjs [--p4k <Data.p4k>] [--verify] [--debug]
// Ausgabe: assets/mining-gear-gamefiles.json
import { writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'mining-gear-gamefiles.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const VERIFY = argv.includes('--verify'), DEBUG = argv.includes('--debug');
const norm = (s) => (s || '').replace(/\\/g, '/');

const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
p4k.close();
const db = openDataCore(dcb);
const EN = new Map();
for (const line of iniEn.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) EN.set(line.slice(0, i).replace(/^﻿/, '').toLowerCase(), line.slice(i + 1)); }
const loc = (k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const v = EN.get(k.slice(1).toLowerCase()); return v && !/^@|PLACEHOLDER|LOC_EMPTY/.test(v) ? v : null; };
const findType = (o, rx, hits = []) => { if (!o || typeof o !== 'object') return hits; if (o.__type && rx.test(o.__type)) hits.push(o); for (const v of Object.values(o)) if (v && typeof v === 'object') findType(v, rx, hits); return hits; };
const findKey = (o, key) => { let r; (function w(x) { if (r !== undefined || !x || typeof x !== 'object') return; if (key in x) { r = x[key]; return; } for (const v of Object.values(x)) w(v); })(o); return r; };
const recByName = (rx) => db.records.find((r) => rx.test(r.name || ''));

// Manufacturer-Namen (SCItemManufacturer.<CODE> -> Localization.Name)
const manName = (ref) => { if (!ref) return null; const r = ref.__ref ? db.recordById.get(ref.__ref) : recByName(new RegExp('^' + ref + '$')); if (!r) return typeof ref === 'string' ? ref : ref.name; const o = db.readRecord(r, { maxDepth: 3 }); return loc(findKey(o, 'Name')) || (r.name || '').replace(/^SCItemManufacturer\./, ''); };

// MiningLaserModifier -> scmdb-Mod-Schema
const val = (m) => (m && typeof m === 'object' ? m.value ?? 0 : 0);
const mapMods = (mlm, filterVal) => mlm ? {
  instability: val(mlm.laserInstability), optimalChargeWindowSize: val(mlm.optimalChargeWindowSizeModifier),
  resistance: val(mlm.resistanceModifier), shatterDamage: val(mlm.shatterdamageModifier),
  clusterFactor: val(mlm.clusterFactorModifier), optimalChargeRate: val(mlm.optimalChargeWindowRateModifier),
  catastrophicChargeRate: val(mlm.catastrophicChargeWindowRateModifier), filter: filterVal ?? 0,
} : {};

const isTest = (f) => /_test|template|_best/i.test(f);
const lRecs = db.records.filter((r) => db.structs[r.structIndex]?.name === 'EntityClassDefinition' && /ships\/weapons\/mining_laser_/i.test(norm(r.fileName)) && !isTest(norm(r.fileName)) && !/_mpuv_arm|_atls/i.test(norm(r.fileName)));

const lasers = [];
for (const r of lRecs) {
  const f = norm(r.fileName);
  const deep = db.readRecord(r, { maxDepth: 16, typed: true });
  const shallow = db.readRecord(r, { maxDepth: 8, typed: true });
  if (DEBUG && lasers.length === 0) {
    for (const src of [['deep', deep], ['shallow', shallow]]) {
      const cont = findType(src[1], /SItemPortContainerComponentParams/i);
      console.log(`DEBUG ${src[0]}: ${cont.length} Container`);
      for (const c of cont) console.log('  ', JSON.stringify(c, (k, v) => k === '__type' ? undefined : v).slice(0, 900));
    }
  }
  const att = (findType(shallow, /SAttachableComponentParams/i)[0] || {}).AttachDef || {};
  const ml = findType(deep, /SEntityComponentMiningLaserParams/i)[0] || {};
  const beam = findType(deep, /FireBeamParams/i)[0] || {};
  const dInfo = beam.damagePerSecond || {};
  // moduleSlots = Ports, die MiningModifier-Items (miningConsumable) aufnehmen
  const cont = findType(deep, /SItemPortContainerComponentParams/i)[0] || findType(shallow, /SItemPortContainerComponentParams/i)[0] || {};
  const modSlots = (cont.Ports || []).filter((p) => /MiningModifier/i.test(JSON.stringify(p.Types || '')) || /miningConsumable/i.test((p.RequiredPortTags || '') + ' ' + (p.PortTags || ''))).length;
  lasers.push({
    file: basename(f),
    name: loc(att.Localization?.Name) || basename(f, '.xml'),
    size: att.Size, grade: att.Grade, maker: manName(att.Manufacturer),
    builtIn: /drak_golem|_arm|mpuv|atls|vehicle/i.test(f) || null,
    moduleSlots: modSlots,
    throttleMin: ml.throttleMinimum,
    mining: { dps: dInfo.DamageEnergy ?? dInfo.DamagePhysical ?? null, full: beam.fullDamageRange, zero: beam.zeroDamageRange },
    mods: mapMods(ml.miningLaserModifiers, val(findKey(ml.filterParams || {}, 'filterModifier'))),
  });
}

const mRecs = db.records.filter((r) => db.structs[r.structIndex]?.name === 'EntityClassDefinition' && /ships\/utility\/mining\/miningarm\/mining_modules_(active|passive)_/i.test(norm(r.fileName)) && !isTest(norm(r.fileName)));
const modules = [];
for (const r of mRecs) {
  const f = norm(r.fileName); const o = db.readRecord(r, { maxDepth: 12, typed: true });
  const mm = findType(o, /ItemMiningModifierParams/i)[0];
  modules.push({ file: basename(f), name: loc(findKey(o, 'displayName')) || basename(f, '.xml'), type: /_active_/i.test(f) ? 'active' : 'passive', miningMult: findKey(findKey(o, 'weaponStats') || {}, 'damageMultiplier') ?? null, mods: mapMods(mm?.MiningLaserModifier) });
}

const gRecs = db.records.filter((r) => db.structs[r.structIndex]?.name === 'EntityClassDefinition' && /weapons\/devices\/mining_gadget_/i.test(norm(r.fileName)) && !isTest(norm(r.fileName)));
const gadgets = [];
for (const r of gRecs) {
  const f = norm(r.fileName); const o = db.readRecord(r, { maxDepth: 12, typed: true });
  const gm = findType(o, /MineableRockModifier|AttachableModifierParams/i)[0];
  const mlm = gm?.MiningLaserModifier || (gm?.modifiers || [])[0]?.MiningLaserModifier;
  gadgets.push({ file: basename(f), name: loc(findKey(o, 'Name')) || basename(f, '.xml'), mods: mapMods(mlm) });
}

const payload = { source: 'Star Citizen Data.p4k -> Game2.dcb (DataCore v8, node-nativ) — eigene Extraktion, kein scmdb', counts: { lasers: lasers.length, modules: modules.length, gadgets: gadgets.length }, lasers, modules, gadgets };
writeFileSync(OUT, JSON.stringify(payload, null, 1) + '\n');
console.log(`Gear: ${lasers.length} Laser, ${modules.length} Module, ${gadgets.length} Gadgets -> ${OUT}`);
if (DEBUG) { console.log('\nERSTE 3 LASER:', JSON.stringify(lasers.slice(0, 3), null, 1)); console.log('ERSTES MODUL:', JSON.stringify(modules[0])); console.log('ERSTES GADGET:', JSON.stringify(gadgets[0])); }

if (VERIFY) {
  const BASE = 'https://scmdb.net/data', H = { 'User-Agent': 'sc-patch-archiv', Accept: 'application/json' };
  const gj = async (u) => { const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
  const live = (await gj(`${BASE}/versions.json`)).find((v) => /-live/i.test(v.version));
  const eq = await gj(`${BASE}/mining_equipment-${live.version}.json`);
  console.log(`\nVERIFY gegen scmdb ${live.version}:`);
  const byName = (arr) => new Map(arr.map((x) => [String(x.name).toLowerCase().replace(/\s+/g, ''), x]));
  // Laser per (Modell-Keyword + Größe) matchen: scmdb-Name enthält das Modell, size gleich
  const model = (f) => (f.match(/mining_laser_[a-z]+_([a-z]+)_s\d/i) || [])[1] || '';
  let lok = 0, lmatched = 0; const ldiff = [];
  for (const l of lasers) { const m = model(l.file); const s = (eq.lasers || []).find((x) => m && new RegExp(m, 'i').test(x.name) && x.size === l.size); if (!s) continue; lmatched++; if (Math.abs((l.mining.dps || 0) - (s.miningBeam?.damagePerSecond || 0)) < 0.02) lok++; else ldiff.push(`${l.name}(S${l.size}): game=${l.mining.dps} scmdb=${s.miningBeam?.damagePerSecond}`); }
  console.log(`  Laser: ${lok}/${lmatched} DPS==scmdb (per Modell+Größe gematcht, von ${lasers.length})`);
  if (ldiff.length) console.log('   DPS-Abw. (game=live 4.9 maßgeblich):', ldiff.join(' | '));
  const modsClose = (a, b) => ['resistance', 'instability', 'optimalChargeWindowSize'].every((k) => Math.abs((a[k] || 0) - (b[k] || 0)) < 0.5);
  const mok = modules.filter((m) => (eq.modules || []).some((s) => modsClose(m.mods, s.modifiers || {}))).length;
  const gok = gadgets.filter((g) => (eq.gadgets || []).some((s) => modsClose(g.mods, s.modifiers || {}))).length;
  console.log(`  Module: ${mok}/${modules.length} Mods==scmdb · Gadgets: ${gok}/${gadgets.length} Mods==scmdb`);
  console.log(`  moduleSlots-Bereich: ${Math.min(...lasers.map((l) => l.moduleSlots))}–${Math.max(...lasers.map((l) => l.moduleSlots))}`);
}
