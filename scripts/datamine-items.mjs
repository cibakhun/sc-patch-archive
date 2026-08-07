// datamine-items.mjs — Item-Finder-Datenbank direkt aus den Spieldateien (node-nativ
// über den DataCore-Reader, kein scmdb/unforge). Ersetzt das Namens-Raten des alten
// Katalogs durch die spiel-eigene Item-Taxonomie und ergänzt echte Stats.
//
// Grundsatz (wie build-universal-db): KEINE erfundenen Werte. Ein Feld, das ein Item
// nicht hat, bleibt weg — nichts wird aufgefüllt. Preise/Kauforte sind serverseitig
// (nicht in der p4k) und kommen weiter aus UEX; sie sind hier bewusst NICHT enthalten.
//
// Je Item: Identität (Typ→Kategorie, Size, Grade, Hersteller, EN+DE-Name/Beschreibung,
// Inventar-Volumen, stabile GUID) + typ-spezifische Kennzahlen (Schild/QD/Kühler/…,
// Waffen-Schaden via Magazin→Munition, Rüstungs-Resistenz via geteiltem Makro).
//
// Aufruf: node scripts/datamine-items.mjs [--p4k <Data.p4k>] [--debug]
// Ausgabe: assets/items-gamefiles.json
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
import { buildTagIndex, leafUnder } from './lib/tags.mjs';
import { resolveArmorSets, shortNamesByStem } from './lib/armor-sets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets', 'items-gamefiles.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const DEBUG = argv.includes('--debug');
const norm = (s) => (s || '').replace(/\\/g, '/');

// ---- p4k / DataCore / Localization (EN + DE) ----
const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
let iniDe = null;
for (const rx of [/Localization[\\/]german[\\/]global\.ini$/i, /Localization[\\/]german_\(germany\)[\\/]global\.ini$/i]) {
  try { iniDe = p4k.read(rx).toString('utf8'); break; } catch { /* nächste Variante */ }
}
p4k.close();
// Patch-Kennung aus build_manifest.id neben der p4k (best effort, wie
// datamine-crafting.mjs/extract-hardpoints.mjs). Vorher stand hier ein
// statischer Branch-String OHNE Changelist-Nummer — zwei Laeufe gegen
// verschiedene Builds desselben Branches waeren ununterscheidbar gewesen (D-16).
let patchLabel = 'sc-alpha-4.9.0'; // Fallback, falls build_manifest.id fehlt
{
  const bm = resolve(dirname(DEFAULT_P4K), 'build_manifest.id');
  if (existsSync(bm)) {
    try {
      const d = JSON.parse(readFileSync(bm, 'utf8'))?.Data;
      if (d?.Branch && d?.RequestedP4ChangeNum) patchLabel = `${d.Branch}@${d.RequestedP4ChangeNum}`;
    } catch { /* Fallback bleibt */ }
  }
}

const mkMap = (ini) => { const m = new Map(); if (!ini) return m; for (const line of ini.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) m.set(line.slice(0, i).replace(/^﻿/, '').toLowerCase(), line.slice(i + 1)); } return m; };
const EN = mkMap(iniEn), DE = mkMap(iniDe);
// Nicht übersetzte Einträge liefert die deutsche global.ini als sichtbaren
// Fehlerstring („! GERMAN_(GERMANY) TRANSLATION NOT FOUND FOR LOCID: … !").
// Der muss weg — sonst steht er als Item-Name auf den DE-Seiten. In dem Fall
// gilt: kein DE-Name, die UI fällt auf den englischen zurück.
const BAD_LOC = /^@|PLACEHOLDER|LOC_EMPTY|\[PH\]|TRANSLATION NOT FOUND/;
const locFrom = (map, k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const v = map.get(k.slice(1).toLowerCase()); return v && !BAD_LOC.test(v) ? v : null; };
const locEn = (k) => locFrom(EN, k);
const locDe = (k) => locFrom(DE, k);

const db = openDataCore(dcb);
const TAGS = buildTagIndex(db);
const SHORT_SETS = shortNamesByStem(EN);

// ---- Tag-Facetten je Item ----
// Nur echte Blätter übernehmen: viele Items tragen den Kategorie-Knoten selbst
// (blankes `Armor.FPS.Set` ohne Set, `Global.Color` ohne Farbe) — das ist „nicht
// gesetzt" und darf nicht als Wert durchgereicht werden.
const RARITY_ORDER = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 };
function facetsFrom(paths) {
  const f = {};
  const weight = leafUnder(paths, 'Armor.FPS.Type.');
  if (weight) f.weight = weight;
  const part = leafUnder(paths, 'Armor.FPS.Part.');
  if (part) f.part = part;
  const rarity = leafUnder(paths, 'LootGeneration.LootRarity.');
  if (rarity && RARITY_ORDER[rarity]) f.rarity = rarity;
  const arche = leafUnder(paths, 'Armor.FPS.Archetype.');
  if (arche) f.archetype = arche;
  const spec = leafUnder(paths, 'Armor.FPS.Specialization.');
  if (spec) f.specialization = spec;
  const color = leafUnder(paths, 'Global.Color.');
  if (color) f.color = color;
  // Loot-Erzeugbarkeit: die einzige beweisbare Aussage über „kann das droppen?".
  // `CannotGenerateAsLoot.PromotionalItem` -> reason `PromotionalItem`; der blanke
  // Knoten `CannotGenerateAsLoot` bedeutet „gar nicht lootbar, ohne Begründung".
  const no = paths.find((p) => p.startsWith('LootGeneration.CannotGenerateAsLoot'));
  if (no) {
    f.lootable = false;
    const reason = no.slice('LootGeneration.CannotGenerateAsLoot'.length).replace(/^\./, '');
    if (reason) f.lootReason = reason;
  } else if (paths.some((p) => p.startsWith('LootGeneration.CanGenerateAsLoot'))) {
    f.lootable = true;
  }
  return f;
}

// ---- generische Reader-Helfer ----
const findType = (o, rx, hits = []) => { if (!o || typeof o !== 'object') return hits; if (o.__type && rx.test(o.__type)) hits.push(o); for (const v of Object.values(o)) if (v && typeof v === 'object') findType(v, rx, hits); return hits; };
const first = (o, rx) => findType(o, rx)[0] || null;
const findKey = (o, key) => { let r; (function w(x) { if (r !== undefined || !x || typeof x !== 'object') return; if (key in x && x[key] != null) { r = x[key]; return; } for (const v of Object.values(x)) w(v); })(o); return r; };
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : (typeof v === 'object' && v && typeof v.value === 'number' ? v.value : null));
const round = (v, p = 2) => (v == null ? null : Math.round(v * 10 ** p) / 10 ** p);
const clean = (obj) => { const o = {}; for (const [k, v] of Object.entries(obj)) if (v != null && v !== '' && !(typeof v === 'number' && v === 0 && ZERO_DROP.has(k))) o[k] = v; return o; };
const ZERO_DROP = new Set(); // Felder, bei denen 0 „nicht gesetzt" bedeutet (aktuell keine)
// Beschreibungen in global.ini tragen literale „\n"; für die Anzeige echte Zeilenumbrüche.
const cleanDesc = (s) => (s ? s.replace(/\\n/g, '\n').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : null);
// Grade ist im Spiel ein Buchstabe (1→A, 2→B, 3→C, 4→D …); die Beschreibungen bestätigen das.
const gradeLetter = (n) => (n && n >= 1 && n <= 8 ? String.fromCharCode(64 + n) : null);
// Klasse (Civilian/Military/Industrial/Competition/Stealth) steht CIG-seitig im Beschreibungskopf.
const classFrom = (d) => { const m = /(?:^|\n)\s*Class:\s*([A-Za-z][A-Za-z ]*?)\s*(?:\n|$)/.exec(d || ''); return m ? m[1].trim() : null; };
// Redundanten „Key: Value"-Kopf (Manufacturer/Size/Grade/Class/Temp/Strahlung …) entfernen —
// die Werte zeigen wir strukturiert als Chips/Stats; übrig bleibt der Prosa-Text.
const HEADER_KEYS = 'Item Type|Manufacturer|Size|Grade|Class|Type|Damage Reduction|Temp\\.?\\s*Rating|Temperature Rating|Radiation Protection|Radiation Scrub Rate|NDR|Effects?|Hersteller|Gegenstand|Größe|Stufe|Klasse|Schadensreduzierung|Temperaturtoleranz|Temperaturbewertung|Strahlungsschutz|Strahlungsreinigungsrate|Strahlungswert|Nährwert|Effekte?';
const HEADER_RE = new RegExp('^(?:\\s*(?:' + HEADER_KEYS + ')\\s*:\\s*[^\\n]*\\n?)+', 'i');
const stripHeader = (s) => (s ? s.replace(HEADER_RE, '').trim() || null : null);
// Rüstung: Temp-Rating (°C) + Strahlungsschutz (REM) aus dem game-authored EN-Beschreibungskopf.
function armorEnv(descEn) {
  const out = {};
  if (!descEn) return out;
  const t = /Temp\.?\s*Rating:\s*(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/i.exec(descEn);
  if (t) { out.tempMin = round(+t[1]); out.tempMax = round(+t[2]); }
  const r = /Radiation\s*Protection:\s*([\d,]+(?:\.\d+)?)/i.exec(descEn);
  if (r) { const v = +r[1].replace(/,/g, ''); if (v) out.radiation = round(v); }
  return out;
}
// Food/Drink: Nährwert (NDR) + Status-Effekte aus dem EN-Beschreibungskopf.
function foodInfo(descEn) {
  const out = {};
  if (!descEn) return out;
  const ndr = /\bNDR:\s*(-?\d+(?:\.\d+)?)/i.exec(descEn);
  if (ndr) out.ndr = round(+ndr[1]);
  const eff = /Effects?:\s*([^\n]+)/i.exec(descEn);
  if (eff) { const list = eff[1].split(/[,;]/).map((s) => s.trim()).filter((s) => s && s.length < 40 && !/^(none|keine?|n\/a|--|n\.a\.)$/i.test(s)); if (list.length) out.effects = list; }
  return out;
}

// ---- Hersteller-Cache (SCItemManufacturer.<CODE> -> Anzeigename) ----
const manCache = new Map();
function manufacturer(ref) {
  if (!ref) return null;
  const code = (ref.name || '').replace(/^SCItemManufacturer\./, '') || null;
  const id = ref.__ref;
  if (id && manCache.has(id)) return manCache.get(id);
  let name = code;
  if (id) { const r = db.recordById.get(id); if (r) { const o = db.readRecord(r, { maxDepth: 3, typed: true }); name = locEn(findKey(o, 'Name')) || code; } }
  const out = code ? { code, name: name || code } : null;
  if (id) manCache.set(id, out);
  return out;
}

// ---- Basisname -> Record (für Magazin-Follow bei Personenwaffen) ----
const ECD = db.records.filter((r) => db.structs[r.structIndex]?.name === 'EntityClassDefinition');
const byBasename = new Map();
for (const r of ECD) { const b = basename(norm(r.fileName), '.xml').toLowerCase(); if (!byBasename.has(b)) byBasename.set(b, r); }

// ---- Typ-Allowlist + Kategorie-Mapping (Site-Taxonomie beibehalten) ----
const TYPE_CAT = {
  WeaponPersonal: (s) => s === 'Knife' ? 'Weapons / Melee' : s === 'Grenade' ? 'Weapons / Grenades' : s === 'Gadget' ? 'Utility / Gadgets' : 'Weapons',
  Grenade: () => 'Weapons / Grenades',
  WeaponMining: () => 'Utility / Mining Tools',
  WeaponAttachment: (s) => s && s !== 'UNDEFINED' ? `Attachment / ${s}` : 'Attachment',
  WeaponGun: (s) => s === 'Rocket' ? 'Vehiclegear / Weapons / Rockets' : 'Vehiclegear / Weapons / Guns',
  Turret: () => 'Vehiclegear / Weapons / Turrets',
  WeaponDefensive: () => 'Vehiclegear / Countermeasures',
  MissileLauncher: () => 'Vehiclegear / Weapons / Missile Racks',
  GroundVehicleMissileLauncher: () => 'Vehiclegear / Weapons / Missile Racks',
  Missile: (s) => s === 'Torpedo' ? 'Vehiclegear / Weapons / Torpedoes' : 'Vehiclegear / Weapons / Missiles',
  Bomb: () => 'Vehiclegear / Weapons / Bombs',
  BombLauncher: () => 'Vehiclegear / Weapons / Bomb Racks',
  Char_Armor_Helmet: () => 'Armour / Helmets',
  Char_Armor_Torso: () => 'Armour / Core',
  Char_Armor_Arms: () => 'Armour / Arms',
  Char_Armor_Legs: () => 'Armour / Legs',
  Char_Armor_Backpack: () => 'Armour / Backpacks',
  Char_Armor_Undersuit: () => 'Armour / Undersuits',
  Armor: () => 'Armour',
  Suit: () => 'Armour / Undersuits',
  Char_Clothing_Torso_0: () => 'Clothing / Shirts',
  Char_Clothing_Torso_1: () => 'Clothing / Jackets',
  Char_Clothing_Torso_2: () => 'Clothing',
  Char_Clothing_Legs: () => 'Clothing / Legwear',
  Char_Clothing_Feet: () => 'Clothing / Footwear',
  Char_Clothing_Hat: () => 'Clothing / Hats',
  Char_Clothing_Hands: () => 'Clothing / Gloves',
  Char_Clothing_Backpack: () => 'Clothing / Backpacks',
  Shield: () => 'Vehiclegear / Shield',
  Cooler: () => 'Vehiclegear / Cooler',
  PowerPlant: () => 'Vehiclegear / Powerplant',
  QuantumDrive: () => 'Vehiclegear / Quantumdrive',
  JumpDrive: () => 'Vehiclegear / Jump Module',
  Radar: () => 'Vehiclegear / Radar',
  FuelTank: () => 'Vehiclegear / Hydrogen Fuel Tank',
  QuantumFuelTank: () => 'Vehiclegear / Quantum Fuel Tank',
  ExternalFuelTank: () => 'Vehiclegear / External Fuel Tank',
  EMP: () => 'Vehiclegear / EMP',
  QuantumInterdictionGenerator: () => 'Vehiclegear / Quantum Interdiction',
  LifeSupportGenerator: () => 'Vehiclegear / Life Support',
  Module: () => 'Vehiclegear / Module',
  TractorBeam: () => 'Vehiclegear / Tractor Beam',
  TowingBeam: () => 'Vehiclegear / Tractor Beam',
  SalvageHead: () => 'Vehiclegear / Salvage',
  SalvageModifier: () => 'Vehiclegear / Salvage',
  MiningModifier: () => 'Vehiclegear / Mining Module',
  ToolArm: () => 'Vehiclegear / Tool Arm',
  Food: () => 'Utility / Foods',
  Drink: () => 'Utility / Drinks',
  Bottle: () => 'Utility / Drinks',
  FPS_Consumable: () => 'Utility / Consumables',
  MobiGlas: () => 'Utility / mobiGlas',
  Gadget: () => 'Utility / Gadgets',
  Battery: () => 'Utility / Batteries',
  Container: () => 'Utility / Containers',
  Paints: () => 'Vehiclegear / Liveries',
};
const ALLOW = new Set(Object.keys(TYPE_CAT));

// Junk-/Prop-/Debug-Dateien draußen halten
const isJunk = (f) => /_test|template|dummy|_debug|placeholder|tutorial|\/ai\/|_prop(\.|_)|_collector_|deprecated|_uneditable|_dstr|_destruct/i.test(f);

// ---- Schaden: DamageInfo -> {typ: wert} (nur Nicht-Null) ----
const DMG_MAP = { physical: 'DamagePhysical', energy: 'DamageEnergy', distortion: 'DamageDistortion', thermal: 'DamageThermal', biochemical: 'DamageBiochemical', stun: 'DamageStun' };
function damageObj(di) {
  if (!di || typeof di !== 'object') return null;
  const d = {};
  for (const [k, src] of Object.entries(DMG_MAP)) { const v = round(num(di[src])); if (v) d[k] = v; }
  return Object.keys(d).length ? d : null;
}

// ---- Waffen-Schaden: Munition -> DamageInfo ----
const ammoCache = new Map();
function ammoDamageFromRef(ref) {
  if (!ref) return null;
  if (ammoCache.has(ref)) return ammoCache.get(ref);
  const rec = db.recordById.get(ref);
  let out = null;
  if (rec) {
    const ao = db.readRecord(rec, { maxDepth: 14, typed: true });
    // BulletProjectileParams.damage ODER erstes DamageInfo mit Schaden
    const bp = first(ao, /BulletProjectileParams|SProjectileParams/);
    out = damageObj((bp && bp.damage) || first(ao, /DamageInfo/));
  }
  ammoCache.set(ref, out);
  return out;
}
// Default-Loadout -> Magazin-Item -> ammoParamsRecord (Personenwaffen)
function magazineAmmoRef(deep) {
  const refs = [];
  (function walk(x) {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const ecn = x.entityClassName;
    if (ecn && /_mag(_|azine|$)/i.test(ecn)) refs.push(ecn);
    for (const v of Object.values(x)) if (v && typeof v === 'object') walk(v);
  })(deep);
  for (const ecn of refs) {
    const rec = byBasename.get(String(ecn).toLowerCase());
    if (!rec) continue;
    const mo = db.readRecord(rec, { maxDepth: 12, typed: true });
    const ac = first(mo, /SAmmoContainerComponentParams/);
    const ref = ac?.ammoParamsRecord?.__ref;
    if (ref) return { ref, magSize: num(ac.maxAmmoCount) };
  }
  return null;
}

// ---- Rüstungs-Resistenz: geteiltes Makro (gecacht) ----
const resistCache = new Map();
function resistanceFromRef(ref) {
  if (!ref) return null;
  if (resistCache.has(ref)) return resistCache.get(ref);
  const rec = db.recordById.get(ref);
  let out = null;
  if (rec) {
    const ro = db.readRecord(rec, { maxDepth: 8, typed: true });
    const dr = findKey(ro, 'damageResistance') || ro.damageResistance;
    const mult = (k) => round(num(dr?.[k]?.Multiplier), 3);
    if (dr) {
      out = clean({
        physical: mult('PhysicalResistance'), energy: mult('EnergyResistance'),
        distortion: mult('DistortionResistance'), thermal: mult('ThermalResistance'),
        biochemical: mult('BiochemicalResistance'),
      });
      if (!Object.keys(out).length) out = null;
    }
  }
  resistCache.set(ref, out);
  return out;
}

// ---- typ-spezifische Stats ----
function extractStats(type, deep) {
  const s = {};
  const health = num(findKey(first(deep, /SHealthComponentParams/) || {}, 'Health'));
  if (health) s.health = round(health);

  if (type === 'Shield') {
    const p = first(deep, /SCItemShieldGeneratorParams/);
    if (p) Object.assign(s, clean({ shieldHp: round(num(p.MaxShieldHealth)), regen: round(num(p.MaxShieldRegen)), decayRatio: round(num(p.DecayRatio), 3), downedRegenDelay: round(num(p.DownedRegenDelay)), damagedRegenDelay: round(num(p.DamagedRegenDelay)) }));
  } else if (type === 'QuantumDrive') {
    const p = first(deep, /SCItemQuantumDriveParams/);
    const pp = p?.params || {};
    if (p) Object.assign(s, clean({ driveSpeed: round(num(pp.driveSpeed)), cooldown: round(num(pp.cooldownTime)), fuelPerGm: round(num(p.quantumFuelRequirement), 4), stageOneAccel: round(num(pp.stageOneAccelRate)), stageTwoAccel: round(num(pp.stageTwoAccelRate)) }));
  } else if (type === 'Cooler') {
    // Kühlleistung = erzeugte Standard-Resource/s aus der Wärme-Konvertierung
    // (variiert je Kühler; CoolingEqualizationRate ist dagegen eine geteilte Konstante).
    const conv = first(deep, /ItemResourceDeltaConversion/);
    const rate = num(conv?.generation?.resourceAmountPerSecond?.standardResourceUnits) || num(findKey(conv?.generation || {}, 'standardResourceUnits'));
    if (rate) s.coolingRate = round(rate);
  } else if (type === 'PowerPlant') {
    // Leistungsabgabe = erzeugte Einheiten/s
    const gen = first(deep, /ItemResourceDeltaGeneration/);
    const out = num(gen?.generation?.resourceAmountPerSecond?.units) || num(findKey(gen?.generation || {}, 'units'));
    if (out) s.powerOutput = round(out);
  } else if (type === 'Radar') {
    // Kein Reichweitenwert am Item — Detektion ist signaturbasiert. Der einzige echte,
    // differenzierende Wert ist die Signatur-Empfindlichkeit (Multiplikator, ~0,8–1,0).
    const rc = first(deep, /SCItemRadarComponentParams/);
    const sens = num(rc?.signatureDetection?.[0]?.sensitivity) || num(findKey(rc?.signatureDetection || {}, 'sensitivity'));
    if (sens) s.sensitivity = round(sens, 2);
  } else if (type === 'FuelTank' || type === 'ExternalFuelTank' || type === 'QuantumFuelTank') {
    // Kapazität = Resource-Container-Fassungsvermögen (Flow-Multiplikatoren sind konstant 1)
    const rc = first(deep, /ResourceContainer/);
    const cap = num(rc?.capacity?.standardCargoUnits) || num(findKey(rc?.capacity || {}, 'standardCargoUnits'));
    if (cap) s.fuelCapacity = round(cap);
  } else if (type === 'EMP') {
    const p = first(deep, /SCItemEMPParams/);
    if (p) Object.assign(s, clean({ empRadius: round(num(p.empRadius)), distortionDamage: round(num(p.distortionDamage)), chargeTime: round(num(p.chargeTime)), cooldown: round(num(p.cooldownTime)) }));
  } else if (type === 'QuantumInterdictionGenerator') {
    const p = first(deep, /SCItemQuantumInterdictionGeneratorParams/);
    const jr = num(findKey(p || {}, 'jammerRange'));
    const ct = num(findKey(p || {}, 'chargeTimeSecs'));
    if (jr) s.jammerRange = round(jr);
    if (ct) s.chargeTime = round(ct);
  } else if (/^Char_Armor_/.test(type) || type === 'Armor' || type === 'Suit') {
    const sa = first(deep, /SCItemSuitArmorParams/);
    if (sa) {
      const res = resistanceFromRef(sa.damageResistance?.__ref);
      if (res) s.resist = res;
      const integ = round(num(sa.integrityMilestoneToBreak), 3); if (integ != null) s.integrityToBreak = integ;
    }
    if (type === 'Char_Armor_Helmet') {
      const h = first(deep, /SCItemSuitHelmetParams/);
      if (h) Object.assign(s, clean({ oxygen: round(num(h.atmosphereCapacity), 4), fovMin: round(num(h.minFOV)), fovMax: round(num(h.maxFOV)) }));
    }
    // Stauraum (Rücken/Core tragen Inventar)
    const inv = first(deep, /SCItemInventoryContainerComponentParams/);
    const capVol = num(findKey(inv || {}, 'microSCU'));
    if (capVol) s.storageScu = round(capVol / 1e6, 3);
    // (EVA-Tempo verworfen: MaxLinearVelocity ist konstant 6 über alle Anzüge → nicht differenzierend)
  } else if (type === 'Missile' || type === 'Bomb') {
    const p = first(deep, /SCItemMissileParams/);
    if (p) Object.assign(s, clean({ lifetime: round(num(p.maxLifetime)), armTime: round(num(p.armTime)), igniteTime: round(num(p.igniteTime)) }));
    // Schaden = Explosions-/Sprengkopf-Schaden (Missiles haben keinen Ammo-Container)
    const exp = first(deep, /ExplosionParams/);
    const dmg = damageObj(exp?.damage);
    if (dmg) { s.damage = dmg; const rad = round(num(exp.maxRadius)); if (rad) s.blastRadius = rad; }
  } else if (type === 'WeaponGun' || type === 'Turret' || type === 'WeaponDefensive' || type === 'MissileLauncher') {
    weaponStats(s, deep, /* direct */ true);
  } else if (type === 'WeaponPersonal' || type === 'WeaponMining') {
    weaponStats(s, deep, /* direct */ false);
  }
  return s;
}

function weaponStats(s, deep, direct) {
  const wc = first(deep, /SCItemWeaponComponentParams/);
  // Feuerrate (rpm) aus der ersten Fire-Action
  const fa = first(deep, /SWeaponActionFire(Single|Rapid|Burst|Charge)Params/) || first(deep, /SWeaponActionFireParams/);
  const rof = num(findKey(fa || wc || {}, 'fireRate'));
  if (rof) s.fireRate = round(rof);
  // Schaden + Magazingröße
  const ac = first(deep, /SAmmoContainerComponentParams/);
  if (direct) {
    const dmg = ammoDamageFromRef(ac?.ammoParamsRecord?.__ref);
    if (dmg) s.damage = dmg;
    const mag = num(ac?.maxAmmoCount); if (mag) s.magazine = round(mag);
  } else {
    const m = magazineAmmoRef(deep);
    if (m) { const dmg = ammoDamageFromRef(m.ref); if (dmg) s.damage = dmg; if (m.magSize) s.magazine = round(m.magSize); }
  }
  // DPS = Gesamtschaden/Schuss × Schuss pro Sekunde (Standard-Vergleichswert, abgeleitet)
  if (s.damage && s.fireRate) {
    const perShot = Object.values(s.damage).reduce((a, b) => a + b, 0);
    if (perShot > 0) s.dps = round(perShot * s.fireRate / 60);
  }
}

// =========================================================
//  Pass 1: Kandidaten (Typ erlaubt + auflösbarer EN-Name)
// =========================================================
const t0 = Date.now();
let scanned = 0, noAttach = 0, notAllowed = 0, noName = 0, junk = 0;
const candidates = [];
for (const r of ECD) {
  const f = norm(r.fileName);
  if (isJunk(f)) { junk++; continue; }
  scanned++;
  let shallow; try { shallow = db.readRecord(r, { maxDepth: 4, typed: true }); } catch { continue; }
  const att = (first(shallow, /SAttachableComponentParams/) || {}).AttachDef;
  if (!att || !att.Type) { noAttach++; continue; }
  if (!ALLOW.has(att.Type)) { notAllowed++; continue; }
  const nameEn = locEn(att.Localization?.Name);
  if (!nameEn) { noName++; continue; }
  // Tags hängen am Record-Wurzelknoten, sind also schon im flachen Read dabei.
  candidates.push({ r, f, att, nameEn, tagPaths: TAGS.pathsOf(shallow.tags) });
}
if (DEBUG) console.log(`Pass1: ${candidates.length} Kandidaten (scanned ${scanned}, noAttach ${noAttach}, notAllowed ${notAllowed}, noName ${noName}, junk ${junk}) · ${Date.now() - t0}ms`);

// =========================================================
//  Pass 2: Deep-Read + Stats
// =========================================================
const NEED_DEEP = new Set(['WeaponPersonal', 'WeaponMining', 'WeaponGun', 'Turret', 'WeaponDefensive', 'MissileLauncher', 'Missile', 'Bomb', 'FuelTank', 'QuantumFuelTank', 'ExternalFuelTank', 'EMP', 'QuantumInterdictionGenerator', 'Radar']);
const built = [];
for (const c of candidates) {
  const { r, f, att, nameEn, tagPaths } = c;
  const depth = NEED_DEEP.has(att.Type) ? 14 : 8;
  let deep; try { deep = db.readRecord(r, { maxDepth: depth, typed: true }); } catch { deep = null; }
  const catFn = TYPE_CAT[att.Type];
  const category = (typeof catFn === 'function' ? catFn(att.SubType) : catFn) || 'Other';
  const man = manufacturer(att.Manufacturer);
  const volMicro = num(findKey(att, 'inventoryOccupancyVolume') && att.inventoryOccupancyVolume?.microSCU);
  const stats = deep ? extractStats(att.Type, deep) : {};
  const descRaw = cleanDesc(locEn(att.Localization?.Description));
  const itemClass = classFrom(descRaw);
  // Rüstung: Temp/Strahlung stehen nur im Beschreibungskopf (kein Struct-Feld)
  if (/^Char_Armor_/.test(att.Type) || att.Type === 'Armor' || att.Type === 'Suit') Object.assign(stats, armorEnv(descRaw));
  // Food/Drink: Nährwert + Effekte ebenfalls nur im Beschreibungskopf
  if (att.Type === 'Food' || att.Type === 'Drink' || att.Type === 'Bottle' || att.Type === 'FPS_Consumable') Object.assign(stats, foodInfo(descRaw));
  built.push({
    id: r.id,
    name: nameEn,
    nameDe: locDe(att.Localization?.Name) || null,
    desc: stripHeader(descRaw),
    descDe: stripHeader(cleanDesc(locDe(att.Localization?.Description))),
    category,
    gameType: att.Type,
    subType: att.SubType && att.SubType !== 'UNDEFINED' ? att.SubType : null,
    size: num(att.Size),
    grade: gradeLetter(num(att.Grade)),
    class: itemClass,
    manufacturer: man?.name || null,
    manufacturerCode: man?.code || null,
    volumeScu: volMicro ? round(volMicro / 1e6, 4) : null,
    stats: Object.keys(stats).length ? stats : null,
    file: basename(f),
    ...facetsFrom(tagPaths),
    // nur für die Set-Auflösung unten, wird vor dem Schreiben entfernt
    _tags: tagPaths,
  });
}
if (DEBUG) console.log(`Pass2: ${built.length} gebaut · ${Date.now() - t0}ms`);

// =========================================================
//  Dedup je Anzeigename (bester Repräsentant) + sortieren
// =========================================================
// Der Anzeigename bleibt der Schlüssel — die Preise/Kauforte aus UEX kennen
// auch nur ihn, ein Aufsplitten würde den Join zerreißen. Er ist aber KEINE
// Identität: 29 Waffen-/Werfer-/Mount-Namen stehen im Spiel für mehrere,
// unterschiedlich große Items ("Revenant Gatling" gibt es als S3, S4 und S6).
// Für die trägt der beste Repräsentant nur noch die gemeinsamen Angaben; alles
// Variantenabhängige — Größe, Grade, Hersteller, Kennzahlen — steht in
// `variants`, und `size` bleibt leer statt eine der Größen zu behaupten.
const JUNK_FILE = /_pob_|_hologram|_generic/i;
const score = (it) => (it.stats ? Object.keys(it.stats).length : 0) * 10 + (it.manufacturer ? 2 : 0) + (it.desc ? 1 : 0) - (JUNK_FILE.test(it.file) ? 5 : 0);
const byName = new Map();
for (const it of built) {
  const k = it.name.toLowerCase().trim();
  const e = byName.get(k);
  if (!e) { byName.set(k, { best: it, all: [it] }); continue; }
  e.all.push(it);
  if (score(it) > score(e.best)) e.best = it;
}

let variantNames = 0;
for (const { best, all } of byName.values()) {
  // Requisiten/Hologramme sind keine eigene Variante, sondern Deko mit
  // geliehenem Namen — sie dürfen keine Größe in die Liste schmuggeln.
  const real = all.filter((x) => !JUNK_FILE.test(x.file) && x.size != null);
  const sizes = [...new Set(real.map((x) => x.size))].sort((a, b) => a - b);
  if (sizes.length < 2) continue;
  variantNames++;
  // erst lesen, dann `best` entschärfen — `best` steckt selbst in `real`
  const variants = sizes.map((size) => {
    const v = real.filter((x) => x.size === size).sort((a, b) => score(b) - score(a))[0];
    return {
      size,
      // Record-Id der Ausfuehrung — MUSS hier gelesen werden, solange `best`
      // noch seine Groesse hat. Weiter unten wird sie auf null gesetzt; ein
      // spaeterer Filter ueber `x.size` faende `best` dann nicht mehr und
      // liesse ausgerechnet die Ausfuehrung ohne Id, die im Katalog steht.
      guid: v.id ?? null,
      grade: v.grade ?? null,
      manufacturer: v.manufacturer ?? null,
      stats: v.stats ?? null,
    };
  });
  // Variantenabhängig ist nicht nur die Größe: die S3-Revenant ist eine Anvil
  // mit 1054 DPS, die S4 eine Apocalypse Arms mit 1266. Diese Felder oben stehen
  // zu lassen hieße, die Werte EINER Variante als die des Items auszugeben.
  best.sizes = sizes;
  best.size = null;
  best.grade = null;
  best.manufacturer = null;
  best.manufacturerCode = null;
  best.stats = null;
  best.variants = variants;
}
// Was der Dedupe STILL wegwirft: Geschwister mit demselben Namen, die keine
// Variantenliste ausgeloest haben (weil sie sich nicht in der Groesse
// unterscheiden oder gar keine fuehren). Von denen ueberlebt nur `best` — die
// anderen verschwinden aus dem Katalog, samt ihrer Record-Id.
//
// Das ist keine Kosmetik: genau so verlor der Katalog den Kuehler "NightFall",
// und genau deshalb bleiben fuenf Crafting-Karten leer, obwohl ihr Blueprint
// eine eigene `entity_guid` hat — die zugehoerige Id ist hier weggefallen.
// Der saubere Weg waere ein guid-scharfer Katalog; der aendert aber die
// Item-Identitaet und damit Slugs, URLs und die slug-basierten Konto-Daten
// (Besitz/Planer) — ein eigenes Vorhaben. Bis dahin gilt: NICHT still
// verwerfen. Die Faelle stehen im Lauf-Protokoll und ihre Zahl in der Ausgabe,
// damit ein Zuwachs auffaellt statt unbemerkt zu bleiben.
// Je Fall wird festgehalten, WORIN sich die Geschwister unterscheiden. Das
// entscheidet, ob der Verlust weh tut: tragen alle dieselbe Groesse, denselben
// Grade und dieselbe Klasse, ist der ueberlebende Eintrag fuer sie alle
// zutreffend — dann duerfen ihre Record-Ids als `guidAliases` mitreisen, und
// ein guid-Join findet sie wieder, ohne etwas zu raten. Weichen sie ab, ist
// echte Identitaet noetig und die Ids duerfen NICHT umgehaengt werden.
const kennwerte = (x) => `${x.size ?? '-'}|${x.grade ?? '-'}|${x.class ?? '-'}`;
const collapsed = [];
for (const { best, all } of byName.values()) {
  if (all.length < 2 || best.variants) continue;
  const dropped = all.filter((x) => x !== best);
  const gleich = dropped.every((x) => kennwerte(x) === kennwerte(best));
  collapsed.push({
    name: best.name,
    kept: best.id,
    keptSpecs: kennwerte(best),
    dropped: dropped.map((x) => x.id),
    droppedSpecs: [...new Set(dropped.map(kennwerte))],
    // true = der ueberlebende Eintrag beschreibt die Geschwister korrekt mit
    sameSpecs: gleich,
  });
  // Die Record-Ids der Geschwister reisen mit — aber NUR, wenn sie in
  // Groesse/Grade/Klasse uebereinstimmen. Dann ist der ueberlebende Eintrag
  // fuer sie zutreffend, und wer ueber eine dieser Ids sucht (Crafting-Karten
  // mit eigener `entity_guid`), findet ihn wieder, statt leer auszugehen.
  // Weichen sie ab, bleibt die Id draussen: lieber keine Angabe als eine
  // fremde. Gemessen 07.08.2026: 265 Faelle, 501 Geschwister, davon 0
  // abweichend — es sind Mehrfacheintraege desselben Gegenstands.
  if (gleich) best.guidAliases = dropped.map((x) => x.id);
}

const items = [...byName.values()].map((e) => e.best).sort((a, b) => a.name.localeCompare(b.name, 'en'));
if (variantNames)
  console.log(`${variantNames} Anzeigenamen stehen für mehrere Items — Größe als Variantenliste statt Einzelwert`);
if (collapsed.length) {
  const total = collapsed.reduce((n, c) => n + c.dropped.length, 0);
  console.log(`⚠ ${collapsed.length} Anzeigenamen stehen fuer mehrere Items OHNE Groessenunterschied — ${total} Eintraege fallen weg, nur der beste bleibt.`);
  console.log('  Ihre Record-Ids sind damit aus dem Katalog verschwunden; Joins ueber die guid finden sie nicht mehr.');
  for (const c of (DEBUG ? collapsed : collapsed.slice(0, 12)))
    console.log(`   ${c.name} — behalten ${c.kept}, weg: ${c.dropped.join(', ')}`);
  if (!DEBUG && collapsed.length > 12) console.log(`   … und ${collapsed.length - 12} weitere (DEBUG=1 zeigt alle)`);
}

// =========================================================
//  Rüstungs-Sets (Dreier-Kette, siehe lib/armor-sets.mjs)
// =========================================================
// Bewusst NACH dem Dedupe: die Set-Seite zeigt genau die Teile, die der Finder
// auch führt. Farbvarianten haben eigene Anzeigenamen und überleben den Dedupe.
const armorParts = items
  .filter((i) => /^Char_Armor_/.test(i.gameType) && !/PLACEHOLDER|<=/.test(i.name))
  .map((i) => ({ key: i.id, name: i.name, gameType: i.gameType, file: i.file.replace(/\.xml$/i, ''), tagPaths: i._tags || [], manufacturer: i.manufacturer }));
const { sets, setIdByKey, conflicts, stats: setStats } = resolveArmorSets(armorParts, SHORT_SETS);
for (const it of items) {
  const sid = setIdByKey.get(it.id);
  if (sid) it.setId = sid;
  delete it._tags;
}

// Tag-vs-`_short`-Widersprüche sind Datenfehler bei CIG. Sie gehören ins Log,
// damit ein NEUER Fehl-Tag nach einem Patch auffällt — nicht in die UI.
if (conflicts.length) {
  const show = DEBUG ? conflicts : conflicts.slice(0, 10);
  console.warn(`\n⚠ ${conflicts.length} Set-Widersprüche (Anzeigename ≠ Set-Tag) — Tag ignoriert${DEBUG ? '' : `, zeige ${show.length} (--debug für alle)`}:`);
  for (const c of show) console.warn(`   „${c.name}" (${c.source}) vs. Tag ${c.tagPath} · ${c.tagCoverage} Teile · z. B. ${c.sample.join(', ')}`);
}

// Zählungen
const byCat = {};
for (const it of items) { const root = it.category.split('/')[0].trim(); byCat[root] = (byCat[root] || 0) + 1; }
const withStats = items.filter((i) => i.stats).length;
const withDmg = items.filter((i) => i.stats?.damage).length;
const withResist = items.filter((i) => i.stats?.resist).length;
const facetCount = (k) => items.filter((i) => i[k] != null).length;

const payload = {
  generator: 'scripts/datamine-items.mjs',
  generatedAt: new Date().toISOString().slice(0, 10),
  patch: patchLabel,
  source: 'Star Citizen Data.p4k → Game2.dcb (DataCore v8, node-nativ) — eigene Extraktion',
  note: 'Nur echte Werte; fehlende Felder weggelassen. Preise/Kauforte sind serverseitig (UEX), hier NICHT enthalten.',
  counts: {
    items: items.length, rawCandidates: built.length, withStats, withDamage: withDmg, withResist, byCategoryRoot: byCat,
    withWeight: facetCount('weight'), withRarity: facetCount('rarity'), withColor: facetCount('color'),
    withArchetype: facetCount('archetype'), lootableKnown: items.filter((i) => i.lootable != null).length,
    notLootable: items.filter((i) => i.lootable === false).length,
    inSet: items.filter((i) => i.setId).length,
    // Gleichnamige Items, die der Dedupe zusammenzieht. `variantNames` sind die
    // ehrlichen Faelle (Groessen stehen in `variants`), `collapsedNames` die
    // verlustbehafteten: dort faellt je Name mindestens eine Record-Id weg.
    // Steigt die zweite Zahl nach einem Patch, sind neue Items unsichtbar
    // geworden — siehe den Kommentar am Dedupe.
    variantNames,
    collapsedNames: collapsed.length,
    collapsedEntries: collapsed.reduce((n, c) => n + c.dropped.length, 0),
    // Die Teilmenge, bei der die Geschwister sich in Groesse/Grade/Klasse
    // UNTERSCHEIDEN — nur dort geht wirklich eine Aussage verloren.
    collapsedDiffering: collapsed.filter((c) => !c.sameSpecs).length,
    sets: setStats,
  },
  // Vollstaendige Liste, damit downstream (build-universal-db.mjs) die
  // Record-Ids der weggefallenen Geschwister als `guidAliases` anhaengen kann —
  // aber nur die mit `sameSpecs`.
  collapsed,
  sets,
  items,
};
writeFileSync(OUT, JSON.stringify(payload));
console.log(`OK: ${OUT}`);
console.log(JSON.stringify(payload.counts, null, 1));
console.log(`Fertig in ${Date.now() - t0}ms`);
