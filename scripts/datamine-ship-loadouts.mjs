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
// getrimmt: die global.ini liefert einzelne Namen mit Rand-Leerzeichen
// ("MVSA Cannon "). Das ist unsichtbar, verhindert aber jeden Join per Namen.
const loc = (k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const v = EN.get(k.slice(1).toLowerCase())?.trim(); return v && !/^@|PLACEHOLDER|LOC_EMPTY/.test(v) ? v : null; };
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
  // Treibstoffbehaelter getrennt nach Typ (01.4-02, Gruppe B): Quantum- und
  // Wasserstofftank tragen ihre Kapazitaet als ResourceContainer — Belegt am
  // Buccaneer (qtnk 1,3 SCU == qtFuel 1,3; 2x htnk 3,75 SCU == h2Fuel 7,5) und
  // an der Carrack (qtnk 10,6 SCU; 2x htnk 180 SCU == h2Fuel 360). Die
  // Einlaesse (intk_*) tragen keine Kapazitaet und bleiben unter 'fuel' —
  // NICHT als eigene Kategorie, sie sind kein Behaelter.
  if (/\/fueltanks\/qtnk_/.test(f)) return 'qtfueltank';
  if (/\/fueltanks\/htnk_/.test(f)) return 'h2fueltank';
  // Erzbehaelter der Bergbau-Ausleger (01.4-02, Gruppe B, oreSCU): NUR die
  // aktiven Pods (`cargo_shipmining_pod_*`), NICHT die eingeklappten
  // Reserve-Pods (`..._collapsed`) — sonst zaehlt die Kapazitaet doppelt.
  // Belegt: Prospector 4x8 SCU = 32 (Wiki: 32), Mole 8x12 SCU = 96 (Wiki: 96).
  if (/\/miningpods\/cargo_shipmining_pod_(?!.*_collapsed)/.test(f)) return 'orepod';
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

// Turm-Gattung (01.4-02, Gruppe A/turrets[]): der Turm-ITEM-Record selbst
// (nicht die Waffe darin) traegt am DataCore einen strukturellen Unterschied,
// den Portnamen/Dateipfade allein nicht zuverlaessig hergeben (Hammerhead und
// Retaliator heissen z.B. beide nur nach Lage, "side_frontleft"/"upper" — kein
// "manned"/"remote" im Pfad). Belegt an vier Proben (Hammerhead, Retaliator,
// Idris, Javelin — eine mehr als die Grenze von 3 vorsah, weil Idris allein
// bereits sowohl 'remote' als auch 'pdc' zeigt und Javelin die Wortprobe
// "manned" im Dateinamen bestaetigt; siehe 01.4-feldurteile.md):
//   - `SCItemSeatParams` vorhanden -> ein Crewmitglied sitzt darin: bemannt
//     (Hammerhead UND Retaliator tragen beide einen Sitz — die im Plan
//     erwartete Zuordnung "Retaliator = ferngesteuert" haelt der Messung
//     nicht stand, das Spiel widerspricht der Annahme, nicht die Extraktion)
//   - sonst `SCItemTurretRemoteParams` vorhanden -> kein Sitz, aber ein
//     Fernsteuerungs-Parametersatz: ferngesteuert (Idris' "remote_camera_*"
//     UND die unbenannten "ai_turret_*" tragen beide diesen Typ)
//   - sonst (nur die Basis-Turmparameter, kein Sitz, keine Fernsteuerung):
//     Punktverteidigung (Idris' 11 "turret_pdc_*"-Staende)
const turretKindCache = new Map();
function turretKind(r) {
  if (!r) return null;
  if (turretKindCache.has(r.id)) return turretKindCache.get(r.id);
  const o = db.readRecord(r, { maxDepth: 12, typed: true });
  let kind;
  if (findType(o, /SCItemSeatParams/i)) kind = 'manned';
  else if (findType(o, /SCItemTurretRemoteParams/i)) kind = 'remote';
  else kind = 'pdc';
  turretKindCache.set(r.id, kind);
  return kind;
}

// Alle Items im Port-Teilbaum einsammeln (Self + verschachtelte Kinder). Der
// REAL-Filter (Aufrufer) wirft Träger/Fixtures raus -> uebrig bleibt die echte
// Komponente (Self) bzw. die Waffe/Rakete unter dem Mount.
//
// `carrier`: worunter das Item haengt. Das ist der EINZIGE belastbare
// Unterschied zwischen Piloten- und Turmwaffe — Portnamen taugen dafuer nicht
// (78 Ports heissen weder "...turret" noch nach einem bekannten Pilotmuster).
// Eine Kanone unter einem Turm-Traeger ist eine Turmwaffe, dieselbe Kanone
// unter einem Gimbal ist eine Pilotenwaffe. `turretStationAcc` (modulweit,
// je Schiff zurueckgesetzt) zaehlt die Turm-STAENDE selbst mit — auch wenn
// ein Stand im Stock-Loadout keine Waffe traegt, bleibt er ein Stand.
let turretStationAcc = [];
const entriesOf = (x) => Array.isArray(x?.loadout?.entries) ? x.loadout.entries : [];
const carrierKind = (info, r) =>
  info && info.cat === 'mount' && /\/turrets?\//.test(info.file)
    ? { kind: 'turret', turretKind: turretKind(r) }
    : null;
function subtreeItems(entry, acc = [], depth = 0, carrier = null) {
  if (!entry || typeof entry !== 'object' || depth > 12) return acc;
  const r = resolveEntryRecord(entry);
  const info = r ? itemInfoFromRecord(r) : null;
  if (info) acc.push(carrier ? { ...info, carrier: carrier.kind, ...(carrier.turretKind ? { turretKind: carrier.turretKind } : {}) } : info);
  const mount = carrierKind(info, r);
  if (mount) turretStationAcc.push({ port: entry.itemPortName || null, turretKind: mount.turretKind });
  const next = mount ?? carrier;
  for (const n of entriesOf(entry)) subtreeItems(n, acc, depth + 1, next);
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
// qtfueltank/h2fueltank/orepod (01.4-02, Gruppe B): nur cat+cls+count werden
// hier durchgereicht, die SCU-Kapazitaet je Item liest datamine-vehicles.mjs
// selbst nach (readItem(cls) -> ResourceContainer), wie es das schon fuer
// Schild/Quantum tut — keine Kapazitaetsrechnung an zwei Stellen.
const REAL = new Set(['weapon', 'missile', 'power', 'shield', 'cooler', 'quantum', 'radar', 'countermeasure', 'qtfueltank', 'h2fueltank', 'orepod']);
let lastCargoScu = 0;
function extractLoadout(rec) {
  const o = db.readRecord(rec, { maxDepth: 20, typed: true });
  const comp = findType(o, /SEntityComponentDefaultLoadoutParams/i);
  const entries = entriesOf(comp);
  const ports = {};
  lastCargoScu = entries.reduce((s, e) => s + gridScu(e).scu, 0);
  turretStationAcc = [];
  for (const e of entries) {
    const port = e.itemPortName || '';
    if (!port) continue;
    const leaves = subtreeItems(e).filter((it) => REAL.has(it.cat)); // nur echte Komponenten/Waffen
    if (!leaves.length) continue;
    // gleiche Items zusammenfassen (2× CF-227 …) — Pilot- und Turmwaffe gleichen
    // Namens bleiben getrennt, sonst geht die Zuordnung wieder verloren.
    // turretKind gehoert mit in den Schluessel: sonst wuerden gleichnamige
    // Waffen unter verschiedenen Turmgattungen (selten, aber moeglich) verschmelzen.
    const by = {};
    for (const it of leaves) { const k = `${it.name || it.cls}|${it.carrier ?? ''}|${it.turretKind ?? ''}`; (by[k] = by[k] || { ...it, count: 0 }).count++; }
    // lowercase-Key: Bone-Namen (.cga) und Port-Namen (DataCore) weichen bei
    // manchen Schiffen in der Groß-/Kleinschreibung ab -> case-insensitiver Join.
    ports[port.toLowerCase()] = Object.values(by).map((it) => ({
      name: it.name, size: it.size, cat: it.cat, cls: it.cls, count: it.count,
      ...(it.carrier ? { carrier: it.carrier } : {}),
      ...(it.turretKind ? { turretKind: it.turretKind } : {}),
    }));
  }
  return ports;
}

/**
 * Fracht-Kapazität: Summe der Innenmaße aller verbauten Frachtgitter.
 * 1 SCU ist ein Würfel mit 1,25 m Kante, also SCU = x·y·z / 1,953125.
 * Die Gitter selbst fliegen oben als 'fixture' raus (sie sind keine Komponente,
 * die man tauscht) — die Kapazität ist trotzdem eine Schiffsangabe.
 */
const SCU_M3 = 1.25 ** 3;
const containerCache = new Map();
function gridScu(entry, acc = { scu: 0 }, depth = 0) {
  if (!entry || typeof entry !== 'object' || depth > 12) return acc;
  const r = resolveEntryRecord(entry);
  if (r && /cargogrid/i.test(norm(r.fileName))) {
    let scu = containerCache.get(r.id);
    if (scu === undefined) {
      const o = db.readRecord(r, { maxDepth: 7, typed: true });
      const ref = findKey(o, 'containerParams')?.__ref;
      const cr = ref ? db.recordById.get(ref) : null;
      const d = cr ? db.readRecord(cr, { maxDepth: 5, typed: true })?.interiorDimensions : null;
      scu = d?.x != null ? (d.x * d.y * d.z) / SCU_M3 : 0;
      containerCache.set(r.id, scu);
    }
    acc.scu += scu;
  }
  for (const n of entriesOf(entry)) gridScu(n, acc, depth + 1);
  return acc;
}

/**
 * Port-Definitionen des Schiffs: was PASST wohin (nicht was drin steckt).
 * Ersetzt die Hardpoint-Größen, die bisher aus der Wiki kamen — und die dort
 * teils veraltet waren (S2-Waffe in angeblich S1-Port auf M50/Mustang).
 */
function extractPorts(rec) {
  const o = db.readRecord(rec, { maxDepth: 20, typed: true });
  const out = {};
  (function walk(x, depth) {
    if (!x || typeof x !== 'object' || depth > 18) return;
    if (Array.isArray(x)) { for (const v of x) walk(v, depth); return; }
    if (x.__type === 'SItemPortContainerComponentParams' && Array.isArray(x.Ports)) {
      for (const p of x.Ports) {
        if (!p?.Name || typeof p.MaxSize !== 'number') continue;
        const types = [];
        for (const t of p.Types ?? []) { const v = t?.Type ?? t; if (typeof v === 'string') types.push(v); }
        out[String(p.Name).toLowerCase()] = { min: p.MinSize ?? null, max: p.MaxSize, types };
      }
    }
    for (const [k, v] of Object.entries(x)) if (k !== '__type' && v && typeof v === 'object') walk(v, depth + 1);
  })(o, 0);
  return out;
}

// ---- Lauf ----
const idsToDo = ONLY ? [ONLY] : ourIds;
const out = {};
const portsOut = {};
const cargoOut = {};
const turretStationsOut = {};
const matched = [], unmatched = [];
for (const id of idsToDo) {
  const rec = byId.get(id);
  if (!rec) { unmatched.push(id); continue; }
  matched.push(id);
  out[id] = extractLoadout(rec);
  cargoOut[id] = Math.round(lastCargoScu);
  portsOut[id] = extractPorts(rec);
  // Turm-Staende deduplizieren (ein Port kann in der Rekursion nur einmal als
  // Turm-Mount vorkommen, aber sicherheitshalber ueber den Portnamen entdoppelt).
  const seen = new Set();
  turretStationsOut[id] = turretStationAcc.filter((s) => {
    const k = (s.port || '') + '|' + s.turretKind;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), source: 'DataCore Game2.dcb / SEntityComponentDefaultLoadoutParams', count: matched.length, ships: out, ports: portsOut, cargo: cargoOut, turretStations: turretStationsOut }, null, 0));
  console.log(`\n-> ${OUT} geschrieben (${matched.length} Schiffe)`);
} else {
  console.log(`\n(Audit-Modus: keine Datei geschrieben)`);
}
