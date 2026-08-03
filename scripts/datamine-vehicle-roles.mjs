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
// Nachtrag 02.08.2026 (Quick-Task 260802-ose): zusätzlich SAttachableComponent-
// Params.AttachDef.{Size,SubType} je Schiffs-Record. `Size` ist CIGs Hangar-/
// Landeplatzklasse (1–6, KEIN Wiki-Größenwert — siehe PLAN.md der Quick-Task
// für gemessene Abweichungen). `SubType` (Vehicle_Spaceship/Vehicle_Ground-
// Vehicle) wird NUR informativ mitgeführt, NICHT als Bodenfahrzeug-Merkmal
// verwendet — SubType liefert 27 statt der bestehenden 37 (isGravlevVehicle),
// weil CIG Nox/Dragonfly/Pulse/X1/Hoverquad (Schweberäder) als
// Vehicle_Spaceship führt. Geprüft und bewusst NICHT umgestellt, siehe
// .planning/quick/260802-ose-groessenachse-boden-raum/SUMMARY.md.
// `Type` bleibt bei allen Records `NOITEM_Vehicle` und wird nicht übernommen.
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
const SOURCES = {
  career: 'VehicleComponentParams.vehicleCareer (Localization/<sprache>/global.ini); 4 Altwerte auf ihren kanonischen Berufsschlüssel gemappt (CAREER_LEGACY)',
  role: 'VehicleComponentParams.vehicleRole (Localization/<sprache>/global.ini); 8 Verbundrollen in atomare Bestandteile zerlegt (ROLE_COMPOUND), Familien aus ROLE_FAMILY (D-05/D-06)',
  signature: 'SSCSignatureSystemParams.radarProperties.baseSignatureParams.signatures[0..2] (IR/EM/RQ); 0 bedeutet "nicht angegeben" und wird als null abgelegt (D-07)',
  'feat.cargo': 'src/data/vehicles.json cargoSCU > 0',
  'feat.ground': "VehicleComponentParams.movementClass === 'ArcadeWheeled' ODER .isGravlevVehicle === true (D-09)",
  size: 'SAttachableComponentParams.AttachDef.Size (Hangar-/Landeplatzklasse 1–6; CIGs eigene Klasse, KEIN Wiki-Größenwert — Quick-Task 260802-ose)',
  subType: 'SAttachableComponentParams.AttachDef.SubType (Vehicle_Spaceship/Vehicle_GroundVehicle); rein informativ, NICHT das Bodenfahrzeug-Merkmal (feat.ground) — geprüft und bewusst nicht umgestellt, siehe Quick-Task 260802-ose SUMMARY',
};

// ---- Schiff-Records + ID-Join (identisch zu datamine-ship-loadouts.mjs) ----
const vehiclesCatalog = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', 'vehicles.json'), 'utf8'));
const ourIds = vehiclesCatalog.vehicles.map((v) => v.id);
const cargoById = new Map(vehiclesCatalog.vehicles.map((v) => [v.id, v.cargoSCU]));

// Zahl auf 2 Nachkommastellen runden — die DataCore liefert Float32-Werte wie
// 0.7599999904632568 statt 0.76 (D-07 verlangt "zwei Nachkommastellen").
const round2 = (n) => Math.round(n * 100) / 100;
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
let dogfightEnabledCount = 0; // Report-Zaehler fuer D-09 — kein Merkmal, nur zur Nachpruefbarkeit
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

  // D-07: Signatur. Eine 0 heißt "nicht angegeben", nicht "abgesenkt" — als
  // null ablegen. Fehlt das Bauteil ganz, entfällt `sig` (Normalwert 1 gilt
  // dann im Filter-Akzessor, nicht hier in der Momentaufnahme).
  const sigComp = findType(o, /SSCSignatureSystemParams/i);
  const sigArr = sigComp?.radarProperties?.baseSignatureParams?.signatures;
  let sig = null;
  if (Array.isArray(sigArr) && sigArr.length >= 3) {
    const [ir, em, cs] = sigArr;
    sig = {
      ir: ir ? round2(ir) : null,
      em: em ? round2(em) : null,
      cs: cs ? round2(cs) : null,
    };
  }

  // D-09: Merkmalsleiste. "Bewaffnet" (dogfightEnabled) wird bewusst NICHT
  // erzeugt — bei 220 von 223 Schiffen gesetzt, siebt damit praktisch nichts
  // aus, was die Rolle nicht schon aussiebt (Report unten zählt den Stand
  // trotzdem mit, damit die Entscheidung nachprüfbar bleibt).
  const feat = [];
  if ((cargoById.get(id) ?? 0) > 0) feat.push('cargo');
  if (comp.movementClass === 'ArcadeWheeled' || comp.isGravlevVehicle === true) feat.push('ground');
  if (comp.dogfightEnabled === true) dogfightEnabledCount++;

  // Quick-Task 260802-ose: SAttachableComponentParams.AttachDef.{Size,SubType}.
  // `Type` ist bei allen Records "NOITEM_Vehicle" und wird bewusst NICHT
  // übernommen (PLAN.md: "damit wertlos").
  const attachComp = findType(o, /SAttachableComponentParams/i);
  const attachDef = attachComp?.AttachDef;
  const size = typeof attachDef?.Size === 'number' ? attachDef.Size : null;
  const subType = attachDef?.SubType ?? null;

  out[id] = {
    careerKey,
    careerDe: careerLabel?.de ?? null,
    careerEn: careerLabel?.en ?? null,
    roleKey,
    roleDe: locDe(roleRaw),
    roleEn: locEn(roleRaw),
    roleKeys,
    families,
    ...(sig ? { sig } : {}),
    ...(feat.length ? { feat } : {}),
    size,
    subType,
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

// D-07/D-09: Signatur + Merkmalsleiste, drei Zählstände zur Nachprüfbarkeit
// der D-09-Abbruchbedingung ("Bewaffnet" siebt praktisch nichts aus).
const sigCount = matched.filter((id) => out[id].sig).length;
const sigLow = matched.filter((id) => out[id].sig && Math.min(out[id].sig.ir ?? 1, out[id].sig.em ?? 1) < 0.8).length;
const cargoCount = matched.filter((id) => (out[id].feat || []).includes('cargo')).length;
const groundCount = matched.filter((id) => (out[id].feat || []).includes('ground')).length;
console.log(`\n=== SIGNATUR + MERKMALSLEISTE (D-07/D-09) ===`);
console.log(`  Signatur (sig-Objekt):        ${sigCount} (davon unter 0,80: ${sigLow})`);
console.log(`  Bewaffnet (dogfightEnabled):   ${dogfightEnabledCount} — NICHT als Merkmal erzeugt (D-09: siebt fast nichts aus)`);
console.log(`  Frachtraum (feat=cargo):       ${cargoCount}`);
console.log(`  Bodenfahrzeug (feat=ground):   ${groundCount}`);

// Quick-Task 260802-ose: Größenklasse (48/82/38/22/26/7) + SubType-Stand,
// letzterer NUR zur Nachprüfbarkeit der Abbruchbedingung (informativ, nicht
// das Bodenfahrzeug-Merkmal).
const sizeHisto = {}, subTypeHisto = {};
for (const id of matched) {
  const v = out[id];
  if (v.size != null) sizeHisto[v.size] = (sizeHisto[v.size] || 0) + 1;
  if (v.subType) subTypeHisto[v.subType] = (subTypeHisto[v.subType] || 0) + 1;
}
console.log(`\n=== GRÖSSENKLASSE (AttachDef.Size, 1–6) ===`);
for (const n of [1, 2, 3, 4, 5, 6]) console.log(`  ${String(sizeHisto[n] || 0).padStart(4)}  Größe ${n}`);
console.log(`\n=== SUBTYPE (AttachDef.SubType, informativ) ===`);
for (const [k, c] of Object.entries(subTypeHisto).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(c).padStart(4)}  ${k}`);
const subTypeGroundOnly = matched.filter((id) => out[id].subType === 'Vehicle_GroundVehicle');
const featGroundOnly = matched.filter((id) => (out[id].feat || []).includes('ground'));
const diffNames = featGroundOnly.filter((id) => !subTypeGroundOnly.includes(id));
console.log(`  Differenz feat=ground (${featGroundOnly.length}) vs. SubType=Vehicle_GroundVehicle (${subTypeGroundOnly.length}): ${diffNames.length} nur im heutigen Merkmal — ${diffNames.join(', ') || '(keine)'}`);

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
