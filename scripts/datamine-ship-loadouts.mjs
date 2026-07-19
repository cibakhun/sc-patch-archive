// datamine-ship-loadouts.mjs — Default-(Stock-)Loadout je Hardpoint aus dem
// DataCore (Game2.dcb), node-nativ über scripts/lib/datacore.mjs. Ausgabe:
// src/data/ship-loadouts.json  { <ship-id>: { <itemPortName>: {name,size,cat,cls} } }.
//
// WARUM: vehicles.json (aus der FleetYards-API) aggregiert das Loadout und wirft
// die Zuordnung Waffe->Hardpoint weg. Das Holo jointe darum per Reihenfolge und
// produzierte namenlose/gestapelte Marker. Der DataCore hält die echte Bindung
// itemPortName -> Item, und itemPortName == der Bone-Name in ship-hardpoints.json
// (COMPILED_BONES) -> exakter Join per Namen.
//
// Kernstruktur im Spiel: EntityClassDefinition (Schiff) -> Komponente
// SEntityComponentDefaultLoadoutParams -> SItemPortLoadoutManualParams.entries[]
// -> je Eintrag { itemPortName, entityClassReference, loadout(verschachtelt) }.
// Das ITEM steht in entityClassReference (NICHT entityClassName — das ist bei
// Waffen leer); die eigentliche Waffe sitzt eine Ebene tiefer unter dem Mount
// (Gimbal S4 -> BEHR_LaserCannon_S4). Namen via AttachDef.Localization.Name.
//
// Aufruf: node scripts/datamine-ship-loadouts.mjs [--p4k <Data.p4k>] [--audit] [--ship <id>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'src', 'data', 'ship-loadouts.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const AUDIT = argv.includes('--audit');
const ONLY = argOf('--ship');
const norm = (s) => (s || '').replace(/\\/g, '/');

const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
p4k.close();
const db = openDataCore(dcb);

const EN = new Map();
for (const line of iniEn.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) EN.set(line.slice(0, i).replace(/^﻿/, '').toLowerCase(), line.slice(i + 1)); }
const loc = (k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const v = EN.get(k.slice(1).toLowerCase()); return v && !/^@|PLACEHOLDER|LOC_EMPTY/.test(v) ? v : null; };
const findType = (o, rx) => { let r; (function w(x){ if(r!==undefined||!x||typeof x!=='object')return; if(x.__type&&rx.test(x.__type)){r=x;return;} for(const [k,v] of Object.entries(x)){ if(k==='__type')continue; if(v&&typeof v==='object')w(v);} })(o); return r; };
const findKey = (o, key) => { let r; (function w(x){ if(r!==undefined||!x||typeof x!=='object')return; if(x&&key in x){r=x[key];return;} for(const v of Object.values(x)) if(v&&typeof v==='object') w(v);})(o); return r; };

// Item-Kategorie aus dem Dateipfad des Items (unabhängig vom Bone-Kind).
// Träger (Gimbal/Turm-Basis/Raketen-Rack) sind 'mount' -> wir rekursieren auf
// das echte Item darunter (Kanone/Rakete).
function itemCat(file, cls) {
  const f = norm(file || '').toLowerCase();
  const c = (cls || '').toLowerCase();
  // Nicht-Komponenten ZUERST (Screens/Displays/Sitze) — sonst faengt z.B.
  // "Radar_Display_Screen_Template" faelschlich die radar-Regel.
  if (/screen|display|annunciator|dashboard|hologram|_mfd|\bseat\b|_door|elevator|cargogrid|personalstorage|_locker|armou?r|\bpaint\b|selfdestruct|lifesupport|_flair/.test(f + ' ' + c)) return 'fixture';
  if (/\/weapon_mounts?\/|\/turrets?\/|\/missile_?racks?\/|\/missilelaunchers?\/|\/gimbal/.test(f)) return 'mount';
  if (/\/missiles?\/|\/bombs?\/|\/ordnance\//.test(f) || /^misl_|^bomb_|^torp_/.test(c)) return 'missile';
  if (/\/ships\/weapons?\//.test(f)) return 'weapon';
  if (/\/power_?plants?\//.test(f)) return 'power';
  if (/\/shield_?generators?\/|\/shields?\//.test(f)) return 'shield';
  if (/\/coolers?\//.test(f)) return 'cooler';
  if (/\/quantum_?drives?\//.test(f)) return 'quantum';
  if (/\/ships\/radars?\//.test(f)) return 'radar';
  if (/\/countermeasures?\//.test(f)) return 'countermeasure';
  if (/\/controller\//.test(f) || /^controller_/.test(c)) return 'controller';
  if (/\/thrusters?\//.test(f)) return 'thruster';
  if (/\/fuel|\/qtnk|\/htnk|\/intk/.test(f)) return 'fuel';
  return 'other';
}

// Item-Record aufloesen: aus entityClassReference (Ref) ODER entityClassName
// (String). SC nutzt BEIDE Konventionen inkonsistent (Corsair: Ref, Freelancer:
// String). recByName cachet den Namens-Index einmalig.
const recByNameIdx = new Map();
for (const r of db.records) { const n = r.name || ''; if (n && !recByNameIdx.has(n)) recByNameIdx.set(n, r); }
const recByName = (nm) => nm ? (recByNameIdx.get(nm) || recByNameIdx.get('EntityClassDefinition.' + nm)) : null;
function resolveEntryRecord(entry) {
  if (entry.entityClassReference?.__ref) { const r = db.recordById.get(entry.entityClassReference.__ref); if (r) return r; }
  if (entry.entityClassName) { const r = recByName(entry.entityClassName); if (r) return r; }
  if (entry.entityClassReference?.name) return recByName(entry.entityClassReference.name);
  return null;
}

// Item-Metadaten cachen (Name/Größe/Kategorie)
const itemCache = new Map();
function itemInfoFromRecord(r) {
  if (!r) return null;
  if (itemCache.has(r.id)) return itemCache.get(r.id);
  const o = db.readRecord(r, { maxDepth: 6, typed: true });
  const att = findType(o, /SAttachableComponentParams/i)?.AttachDef || {};
  const cls = (r.name || '').replace(/^EntityClassDefinition\./, '');
  const info = { cls, name: loc(att.Localization?.Name) || null, size: att.Size ?? null, cat: itemCat(r.fileName, cls), file: norm(r.fileName) };
  itemCache.set(r.id, info);
  return info;
}

// Alle Items im Port-Teilbaum einsammeln (Self + verschachtelte Kinder). Der
// REAL-Filter (Aufrufer) wirft Träger/Fixtures raus -> uebrig bleibt die echte
// Komponente (Self) bzw. die Waffe/Rakete unter dem Mount.
const entriesOf = (x) => Array.isArray(x?.loadout?.entries) ? x.loadout.entries : [];
function subtreeItems(entry, acc = [], depth = 0) {
  if (!entry || typeof entry !== 'object' || depth > 12) return acc;
  const r = resolveEntryRecord(entry);
  const info = r ? itemInfoFromRecord(r) : null;
  if (info) acc.push(info);
  for (const n of entriesOf(entry)) subtreeItems(n, acc, depth + 1);
  return acc;
}

// ---- Schiff-Records + ID-Join ----
const hp = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', 'ship-hardpoints.json'), 'utf8')).ships;
const ourIds = Object.keys(hp);
const isVariantJunk = (f) => /_ai_|_pu_|_test|_template|_dummy|_unmanned|_hijacked|_turretless|_debug|_showdown_scramble|_swarm|_simpod|_modifiers/i.test(f);
const shipRecs = db.records.filter((r) =>
  db.structs[r.structIndex]?.name === 'EntityClassDefinition' &&
  /\/(spaceships|groundvehicles)\/[^/]+\.xml$/i.test(norm(r.fileName)) && !isVariantJunk(norm(r.fileName)));

const recId = (r) => (r.name || '').replace(/^EntityClassDefinition\./, '').toLowerCase().replace(/_/g, '-');
const byId = new Map();
for (const r of shipRecs) { const id = recId(r); if (!byId.has(id)) byId.set(id, r); }

// Loadout eines Ship-Records extrahieren: { port -> {name,size,cat,cls,count} }
const REAL = new Set(['weapon', 'missile', 'power', 'shield', 'cooler', 'quantum', 'radar', 'countermeasure']);
function extractLoadout(rec) {
  const o = db.readRecord(rec, { maxDepth: 20, typed: true });
  const comp = findType(o, /SEntityComponentDefaultLoadoutParams/i);
  const entries = entriesOf(comp);
  const ports = {};
  for (const e of entries) {
    const port = e.itemPortName || '';
    if (!port) continue;
    const leaves = subtreeItems(e).filter((it) => REAL.has(it.cat)); // nur echte Komponenten/Waffen
    if (!leaves.length) continue;
    // gleiche Items zusammenfassen (2× CF-227 …)
    const by = {};
    for (const it of leaves) { const k = it.name || it.cls; (by[k] = by[k] || { ...it, count: 0 }).count++; }
    // lowercase-Key: Bone-Namen (.cga) und Port-Namen (DataCore) weichen bei
    // manchen Schiffen in der Groß-/Kleinschreibung ab -> case-insensitiver Join.
    ports[port.toLowerCase()] = Object.values(by).map((it) => ({ name: it.name, size: it.size, cat: it.cat, cls: it.cls, count: it.count }));
  }
  return ports;
}

// ---- Lauf ----
const idsToDo = ONLY ? [ONLY] : ourIds;
const out = {};
const matched = [], unmatched = [];
for (const id of idsToDo) {
  const rec = byId.get(id);
  if (!rec) { unmatched.push(id); continue; }
  matched.push(id);
  out[id] = extractLoadout(rec);
}

// ---- Audit ----
const GRP = { power: 1, shield: 1, cooler: 1, quantum: 1, radar: 1, turret: 1, missile: 1, weapon: 1 };
const SECONDARY = /controller|regen|seat_?access|seat_rack|weapon_rack|rifle_rack|_locker|_door|airlock|_screen|remote_|weak_point|stairwell|cockpit|gunner|copilot|dashboard|_console|turret_cap|_storage/i;
let bonesTot = 0, bonesNamed = 0, bonesLogical = 0, bonesUnmatched = 0;
const worstUnmatched = [];
const gapHisto = {}; // Namensmuster der "echter Bone OHNE Item"
for (const id of matched) {
  const lo = out[id];
  const bones = (hp[id].hp || []).filter((h) => GRP[h.k]);
  let named = 0, logical = 0, unm = 0;
  for (const h of bones) {
    if (SECONDARY.test(h.n)) { logical++; continue; }
    if (lo[h.n.toLowerCase()]) named++; else { unm++; const s = h.n.replace(/^hardpoint_/i, '').replace(/_\d+$/, '').replace(/_(left|right|top|bottom|rear|front|upper|lower|inner|outer|mid|centre|center|a|b|c|d|l|r)$/gi, ''); gapHisto[s] = (gapHisto[s] || 0) + 1; }
  }
  bonesTot += bones.length; bonesNamed += named; bonesLogical += logical; bonesUnmatched += unm;
  if (unm > 0) worstUnmatched.push({ id, unm, named, logical, bones: bones.length });
}

console.log(`\n=== ID-JOIN ===`);
console.log(`gematcht:   ${matched.length} / ${idsToDo.length}`);
console.log(`ungematcht: ${unmatched.length}${unmatched.length ? '  ' + unmatched.join(', ') : ''}`);
console.log(`\n=== BONE-JOIN (core+arms Bones der gematchten Schiffe) ===`);
console.log(`Bones gesamt:              ${bonesTot}`);
console.log(`  mit Stock-Item benannt:  ${bonesNamed}`);
console.log(`  logische Knoten (Filter):${bonesLogical}`);
console.log(`  echter Bone OHNE Item:    ${bonesUnmatched}`);
console.log(`\nSchiffe mit unbenannten Nicht-Logik-Bones (Top 20):`);
for (const w of worstUnmatched.sort((a, b) => b.unm - a.unm).slice(0, 20))
  console.log(`  ${w.id.padEnd(28)} ${w.unm} ohne Item  (${w.named} benannt, ${w.logical} logisch, ${w.bones} gesamt)`);
console.log(`\n=== Namensmuster der "echter Bone OHNE Item" (Top 30) ===`);
for (const [n, c] of Object.entries(gapHisto).sort((a, b) => b[1] - a[1]).slice(0, 30))
  console.log(`  ${String(c).padStart(4)}  ${n}`);
// Schiffe, die mit dieser Regel (Marker nur bei Stock-Item) 0 core+arms-Marker bekämen
const zero = matched.filter((id) => {
  const lo = out[id];
  return (hp[id].hp || []).filter((h) => GRP[h.k] && !SECONDARY.test(h.n) && lo[h.n.toLowerCase()]).length === 0;
});
console.log(`\n=== Schiffe mit 0 benannten core+arms-Ports (${zero.length}) ===\n  ${zero.join(', ') || 'keine'}`);

if (!AUDIT && !ONLY) {
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), source: 'DataCore Game2.dcb / SEntityComponentDefaultLoadoutParams', count: matched.length, ships: out }, null, 0));
  console.log(`\n-> ${OUT} geschrieben (${matched.length} Schiffe)`);
} else {
  console.log(`\n(Audit-Modus: keine Datei geschrieben)`);
}
