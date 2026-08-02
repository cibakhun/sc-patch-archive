// datamine-vehicle-roles.mjs — CIGs eigene Fahrzeug-Taxonomie aus dem
// DataCore (Game2.dcb), node-nativ über scripts/lib/datacore.mjs. Ausgabe:
// src/data/vehicle-roles.json { generatedAt, source, count, unmatched, sources, vehicles }.
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

// ---- D-04: Beruf (vehicleCareer) — kanonische Beschriftung je Berufsschlüssel ----
// Berufswerte laut RESEARCH.md/05-CONTEXT.md, direkt aus dem normalisierten
// @vehicle_focus_*-Rohwert. Gilt für ALLE Fahrzeuge (auch die 4 Altwert-Fälle
// unten via CAREER_LEGACY) — so bleibt die Kartenbeschriftung unabhängig davon,
// welcher Rohwert ursprünglich im Berufsfeld stand.
const CAREER_LABEL = {
  combat: { de: 'Kampf', en: 'Combat' },
  transporter: { de: 'Transport', en: 'Transporter' },
  exploration: { de: 'Erkundung', en: 'Exploration' },
  competition: { de: 'Wettkampf', en: 'Competition' },
  resources: { de: 'Industrie', en: 'Industrial' },
  support: { de: 'Unterstützung', en: 'Support' },
  multirole: { de: 'Mehrzweck', en: 'Multi-Role' },
  ground: { de: 'Boden', en: 'Ground' },
};

// D-04/Plan-02-Interfaces „Altwerte im Berufsfeld — genau 4 Schiffe, namentlich":
// diese 4 ids tragen im Berufsfeld einen Alt- oder Rollenwert statt eines
// echten @vehicle_focus_*-Werts (Erhebungsstand 02.08.2026, per id, nicht per
// Rohwert — der Rohwert allein wäre für andere Fahrzeuge nicht eindeutig).
const CAREER_LEGACY = {
  'crus-intrepid': 'transporter', // Rohwert @item_ShipFocus_Starter (Alt-Schema); eigene Rolle starterlightfreight
  'aegs-javelin': 'combat', // Rohwert @vehicle_class_destroyer (Rollen- statt Berufswert); eigene Rolle destroyer
  'anvl-paladin': 'combat', // Rohwert @item_ShipFocus_Gunship (Alt-Schema); eigene Rolle gunship (alt)
  'drak-pitbull': 'combat', // Rohwert @vehicle_class_snubfighter (Rollen- statt Berufswert); eigene Rolle snubfighter
};

// ---- D-06: Verbundrollen → atomare Bestandteile ----
// Erhebungsstand 02.08.2026 (05-02-PLAN.md <interfaces>). Die Kartenbeschriftung
// (roleDe/roleEn) bleibt die WÖRTLICHE CIG-Fassung der Verbundrolle — nur die
// Familienzugehörigkeit wird zerlegt.
const ROLE_COMPOUND = {
  starterlightfreight: ['starter', 'lightfreight'],
  starterpathfinder: ['starter', 'pathfinder'],
  starterlightfighter: ['starter', 'lightfighter'],
  startermining: ['starter', 'lightmining'],
  startersalvage: ['starter', 'lightsalvage'],
  heavyfighterbomber: ['heavyfighter', 'bomber'],
  lightfreight_mediumfighter: ['lightfreight', 'mediumfighter'],
  mediumfreightgunshio: ['mediumfreight', 'gunship'], // CIG-Tippfehler im Rohschlüssel ("gunshio"), Bestandteile trotzdem gültig
};

// ---- D-05: atomarer Rollenschlüssel → Familien-Slug ----
// Die 18 Familien, Erhebungsstand 02.08.2026 (05-02-PLAN.md <interfaces>).
// `starter` ist kein DataCore-Rohschlüssel — er entsteht ausschließlich aus
// der Zerlegung der fünf `starter*`-Verbundrollen oben.
const ROLE_FAMILY = {
  // jaeger (63)
  lightfighter: 'jaeger', mediumfighter: 'jaeger', heavyfighter: 'jaeger',
  stealthfighter: 'jaeger', snubfighter: 'jaeger', interceptor: 'jaeger',
  // frachttransport (35)
  lightfreight: 'frachttransport', mediumfreight: 'frachttransport', heavyfreight: 'frachttransport',
  // erkundung (27)
  pathfinder: 'erkundung', expedition: 'erkundung',
  // passagiere (17)
  passenger: 'passagiere', item_ShipFocus_LuxuryTouring: 'passagiere', item_ShipFocus_Touring: 'passagiere',
  // rennen (17)
  racing: 'rennen', item_ShipFocus_Racing: 'rennen',
  // einsteiger (12)
  starter: 'einsteiger',
  // bodenkampf (11)
  antiair: 'bodenkampf', lighttank: 'bodenkampf', heavytank: 'bodenkampf', antivehicle: 'bodenkampf',
  // kanonenschiff (9)
  gunship: 'kanonenschiff', item_ShipFocus_HeavyGunship: 'kanonenschiff', item_ShipFocus_Gunship: 'kanonenschiff',
  // medizin (7)
  medical: 'medizin', recovery: 'medizin',
  // bomber (6)
  bomber: 'bomber', heavybomber: 'bomber', stealthbomber: 'bomber',
  // truppentransport (6)
  dropship: 'truppentransport', heavydropship: 'truppentransport',
  // bergung (6)
  lightsalvage: 'bergung', mediumsalvage: 'bergung', heavysalvage: 'bergung',
  // abriegelung (5)
  interdiction: 'abriegelung',
  // bergbau (5)
  lightmining: 'bergbau', mediummining: 'bergbau',
  // grosskampfschiff (5)
  frigate: 'grosskampfschiff', destroyer: 'grosskampfschiff', corvette: 'grosskampfschiff', snubcarrier: 'grosskampfschiff',
  // daten-wissenschaft (3)
  mediumdata: 'daten-wissenschaft', lightscience: 'daten-wissenschaft', reporting: 'daten-wissenschaft',
  // betankung (3)
  heavyrefuelling: 'betankung', lightrefueling: 'betankung',
  // mehrzweck (2)
  generalist: 'mehrzweck', modular: 'mehrzweck',
};

// ---- Belegpflicht (ROADMAP-Erfolgskriterium 3) ----
// Kopffeld, das je Achse den Bauteil-/Feldnamen nennt, aus dem der Wert stammt.
// Erweitert in Task 2 um signature/feat.cargo/feat.ground.
const SOURCES = {
  career: 'VehicleComponentParams.vehicleCareer (Localization/<sprache>/global.ini); 4 Altwerte auf ihren kanonischen Berufsschlüssel gemappt (CAREER_LEGACY)',
  role: 'VehicleComponentParams.vehicleRole (Localization/<sprache>/global.ini); 8 Verbundrollen in atomare Bestandteile zerlegt (ROLE_COMPOUND), Familien aus ROLE_FAMILY (D-05/D-06)',
};

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

  let careerKey = CAREER_LEGACY[id] ?? normKey(careerRaw);
  if (careerKey && /^procedural_text_null$/i.test(careerKey)) careerKey = null; // defensiv (D-04) — kommt im 223er-Ausschnitt nicht vor
  const careerLabel = careerKey ? CAREER_LABEL[careerKey] : null;

  const roleKey = normKey(roleRaw);
  const roleKeys = roleKey ? (ROLE_COMPOUND[roleKey] ?? [roleKey]) : [];
  const families = [...new Set(roleKeys.map((k) => ROLE_FAMILY[k]).filter(Boolean))];

  out[id] = {
    careerKey,
    careerDe: careerLabel?.de ?? null,
    careerEn: careerLabel?.en ?? null,
    roleKey,
    roleDe: locDe(roleRaw),
    roleEn: locEn(roleRaw),
    roleKeys,
    families,
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
console.log(`\n=== BERUF-VERTEILUNG (vehicleCareer, normalisiert, CAREER_LEGACY angewandt) ===`);
for (const [k, c] of Object.entries(careerHisto).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(c).padStart(4)}  ${k}`);
console.log(`\n=== ROLLEN-VERTEILUNG (vehicleRole, normalisiert, Top 30) ===`);
for (const [k, c] of Object.entries(roleHisto).sort((a, b) => b[1] - a[1]).slice(0, 30))
  console.log(`  ${String(c).padStart(4)}  ${k}`);

const rolesWithoutDe = [...new Set(matched.filter((id) => out[id].roleKey && !out[id].roleDe).map((id) => out[id].roleKey))].sort();
console.log(`\n=== ROLLENSCHLÜSSEL OHNE DEUTSCHES LABEL (${rolesWithoutDe.length}, Lückenfüllung über ROLE_DE_GAPFILL in vehicleText.ts, D-13) ===`);
for (const k of rolesWithoutDe) console.log(`  ${k}`);

// D-05: Stand je der 18 Familien.
const FAMILY_ORDER = ['jaeger', 'frachttransport', 'erkundung', 'passagiere', 'rennen', 'einsteiger', 'bodenkampf', 'kanonenschiff', 'medizin', 'bomber', 'truppentransport', 'bergung', 'abriegelung', 'bergbau', 'grosskampfschiff', 'daten-wissenschaft', 'betankung', 'mehrzweck'];
const familyHisto = {};
for (const id of matched) for (const f of out[id].families) familyHisto[f] = (familyHisto[f] || 0) + 1;
console.log(`\n=== FAMILIENSTAND (18 Familien, D-05) ===`);
for (const f of FAMILY_ORDER) console.log(`  ${String(familyHisto[f] || 0).padStart(4)}  ${f}`);
const unknownFamilies = Object.keys(familyHisto).filter((f) => !FAMILY_ORDER.includes(f));
if (unknownFamilies.length) console.log(`  UNERWARTETE FAMILIEN: ${unknownFamilies.join(', ')}`);

// Atomare Rollenschlüssel ohne ROLE_FAMILY-Eintrag — MUSS leer sein, sonst
// fiele ein Schiff komplett aus allen Familien.
const atomicRolesUsed = new Set();
for (const id of matched) for (const k of out[id].roleKeys) atomicRolesUsed.add(k);
const rolesWithoutFamily = [...atomicRolesUsed].filter((k) => !ROLE_FAMILY[k]).sort();
console.log(`\n=== ATOMARE ROLLENSCHLÜSSEL OHNE FAMILIE (muss leer sein) ===`);
if (rolesWithoutFamily.length) {
  for (const k of rolesWithoutFamily) console.log(`  ${k}`);
} else {
  console.log(`  (keine — jeder atomare Rollenschlüssel trägt eine Familie)`);
}

if (!AUDIT && !ONLY) {
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'DataCore Game2.dcb / VehicleComponentParams (vehicleCareer, vehicleRole)',
    count: matched.length,
    unmatched,
    sources: SOURCES,
    vehicles: out,
  }, null, 0));
  console.log(`\n-> ${OUT} geschrieben (${matched.length} Fahrzeuge, ${unmatched.length} unmatched)`);
} else {
  console.log(`\n(Audit-/Einzel-Modus: keine Datei geschrieben)`);
}
