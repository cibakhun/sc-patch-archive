// datamine-vehicle-roles.mjs — CIGs eigene Fahrzeug-Taxonomie aus dem
// DataCore (Game2.dcb), node-nativ über scripts/lib/datacore.mjs. Ausgabe:
// src/data/vehicle-roles.json { generatedAt, source, count, unmatched, vehicles }.
//
// WARUM: Die Übersichtsseite filtert heute über 8 Grobtypen aus der
// FleetYards/Wiki-API (typeDe/typeEn). CIG selbst trägt an jedem Schiffs-
// Record eine zweiachsige Klassifikation — VehicleComponentParams.vehicleCareer
// (Beruf) und .vehicleRole (Rolle) — beides Lokalisierungsschlüssel, deren
// DE- UND EN-Text CIG selbst in Localization/<sprache>/global.ini liefert.
// Das ist granularer und spielgenauer als die Wiki-Foci (siehe RESEARCH.md).
//
// Bewusst eine EIGENE Ausgabedatei statt Anreicherung von vehicles.json:
// vehicles.json wird von `npm run sync:vehicles` aus der Wiki-API neu
// erzeugt und würde inline eingetragene Felder überschreiben (D-02).
//
// Aufbau nach scripts/datamine-ship-loadouts.mjs (Record-Auswahl, Varianten-
// Filter, ID-Join, Lokalisierungs-Map). Neu gegenüber dem Vorbild: ZWEI
// Lokalisierungsdateien (EN + DE) statt nur EN.
//
// Aufruf: node scripts/datamine-vehicle-roles.mjs [--p4k <Data.p4k>] [--audit] [--ship <id>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'src', 'data', 'vehicle-roles.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const AUDIT = argv.includes('--audit');
const ONLY = argOf('--ship');
const norm = (s) => (s || '').replace(/\\/g, '/');

const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
const iniDe = p4k.read(/Localization[\\/]german_\(germany\)[\\/]global\.ini$/i).toString('utf8');
p4k.close();
const db = openDataCore(dcb);

function buildLocMap(ini) {
  const map = new Map();
  for (const line of ini.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) map.set(line.slice(0, i).replace(/^﻿/, '').toLowerCase(), line.slice(i + 1));
  }
  return map;
}
const EN = buildLocMap(iniEn);
const DE = buildLocMap(iniDe);
function mkLoc(map) {
  return (k) => {
    if (!k || typeof k !== 'string' || !k.startsWith('@')) return null;
    const v = map.get(k.slice(1).toLowerCase());
    return v && !/^@|PLACEHOLDER|LOC_EMPTY/.test(v) ? v : null;
  };
}
const locEn = mkLoc(EN);
const locDe = mkLoc(DE);

const findType = (o, rx) => { let r; (function w(x){ if(r!==undefined||!x||typeof x!=='object')return; if(x.__type&&rx.test(x.__type)){r=x;return;} for(const [k,v] of Object.entries(x)){ if(k==='__type')continue; if(v&&typeof v==='object')w(v);} })(o); return r; };

// Rohschlüssel normalisieren: führendes '@' weg, Präfix 'vehicle_class_' bzw.
// 'vehicle_focus_' weg. Altschlüssel (z. B. 'item_ShipFocus_Starter') behalten
// ihr Präfix, damit sie im Ergebnis unterscheidbar bleiben (Plan 02 mappt sie).
function normKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let k = raw.replace(/^@/, '');
  k = k.replace(/^vehicle_class_/i, '').replace(/^vehicle_focus_/i, '');
  return k || null;
}

// ---- Schiff-Records + ID-Join (identisch zu datamine-ship-loadouts.mjs) ----
const vehiclesCatalog = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', 'vehicles.json'), 'utf8'));
const ourIds = vehiclesCatalog.vehicles.map((v) => v.id);
const isVariantJunk = (f) => /_ai_|_pu_|_test|_template|_dummy|_unmanned|_hijacked|_turretless|_debug|_showdown_scramble|_swarm|_simpod|_modifiers/i.test(f);
const shipRecs = db.records.filter((r) =>
  db.structs[r.structIndex]?.name === 'EntityClassDefinition' &&
  /\/(spaceships|groundvehicles)\/[^/]+\.xml$/i.test(norm(r.fileName)) && !isVariantJunk(norm(r.fileName)));

const recId = (r) => (r.name || '').replace(/^EntityClassDefinition\./, '').toLowerCase().replace(/_/g, '-');
const byId = new Map();
for (const r of shipRecs) { const id = recId(r); if (!byId.has(id)) byId.set(id, r); }

// ---- Lauf ----
const idsToDo = ONLY ? [ONLY] : ourIds;
const out = {};
const matched = [], unmatched = [];
for (const id of idsToDo) {
  const rec = byId.get(id);
  if (!rec) { unmatched.push(id); continue; }
  const o = db.readRecord(rec, { maxDepth: 8, typed: true });
  const comp = findType(o, /VehicleComponentParams/i);
  if (!comp) { unmatched.push(id); continue; }
  const careerRaw = comp.vehicleCareer;
  const roleRaw = comp.vehicleRole;
  matched.push(id);
  out[id] = {
    careerKey: normKey(careerRaw),
    careerDe: locDe(careerRaw),
    careerEn: locEn(careerRaw),
    roleKey: normKey(roleRaw),
    roleDe: locDe(roleRaw),
    roleEn: locEn(roleRaw),
  };
}

// ---- Audit/Report ----
console.log(`\n=== ID-JOIN ===`);
console.log(`gematcht:   ${matched.length} / ${idsToDo.length}`);
console.log(`unmatched:  ${unmatched.length}${unmatched.length ? '  ' + unmatched.join(', ') : ''}`);

const careerHisto = {}, roleHisto = {};
for (const id of matched) {
  const v = out[id];
  const ck = v.careerKey ?? '(leer)';
  const rk = v.roleKey ?? '(leer)';
  careerHisto[ck] = (careerHisto[ck] || 0) + 1;
  roleHisto[rk] = (roleHisto[rk] || 0) + 1;
}
console.log(`\n=== BERUF-VERTEILUNG (vehicleCareer, normalisiert) ===`);
for (const [k, c] of Object.entries(careerHisto).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(c).padStart(4)}  ${k}`);
console.log(`\n=== ROLLEN-VERTEILUNG (vehicleRole, normalisiert, Top 30) ===`);
for (const [k, c] of Object.entries(roleHisto).sort((a, b) => b[1] - a[1]).slice(0, 30))
  console.log(`  ${String(c).padStart(4)}  ${k}`);

const rolesWithoutDe = [...new Set(matched.filter((id) => out[id].roleKey && !out[id].roleDe).map((id) => out[id].roleKey))].sort();
console.log(`\n=== ROLLENSCHLÜSSEL OHNE DEUTSCHES LABEL (${rolesWithoutDe.length}, Lückenfüllung ist Plan 02) ===`);
for (const k of rolesWithoutDe) console.log(`  ${k}`);

if (!AUDIT && !ONLY) {
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'DataCore Game2.dcb / VehicleComponentParams (vehicleCareer, vehicleRole)',
    count: matched.length,
    unmatched,
    vehicles: out,
  }, null, 0));
  console.log(`\n-> ${OUT} geschrieben (${matched.length} Fahrzeuge, ${unmatched.length} unmatched)`);
} else {
  console.log(`\n(Audit-/Einzel-Modus: keine Datei geschrieben)`);
}
