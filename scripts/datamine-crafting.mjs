// Crafting-Datenbank direkt aus dem Spiel extrahieren (statt sc-craft.tools).
//
// Quelle: Data.p4k -> Data/Game2.dcb (DataCore v8) + Localization/english/global.ini.
// Ersetzt scripts/fetch-craft.mjs: sc-craft.tools extrahiert selbst nur aus der
// Game2.dcb und hinkt am Patch-Day hinterher (16.07.2026: LIVE ist 4.9, die
// Community-API kann nur PTU-4.9) — mit scripts/lib/{p4k,datacore}.mjs geht es
// ohne Umweg. Ausgabeformat bleibt 1:1 kompatibel zur bestehenden App
// (assets/crafting-app.js, CraftingApp.astro, item-finder-app.js).
//
// Aufruf:   node scripts/datamine-crafting.mjs
//           SC_P4K=<pfad> node scripts/datamine-crafting.mjs
//           node scripts/datamine-crafting.mjs --dcb <datei> --ini <dir>   (offline)
// Ausgabe:  assets/crafting-db.json           (Blueprints + Ressourcen, komplett neu)
//           assets/dismantling-items.json     (nur die recipe-Bloecke; Preise/Kauforte
//                                              bleiben kuratiert erhalten)
//
// Datenpfade im DataCore (alle in dieser Session gegen LIVE 4.9 verifiziert):
//   CraftingBlueprintRecord.blueprint
//     .processSpecificData(CraftingProcess_Creation).entityClass  -> Item-Entity
//     .tiers[0].recipe.costs.craftTime                            -> TimeValue_Partitioned
//     .tiers[0].recipe.costs.mandatoryCost(CraftingCost_Select)
//       .options[] = Slots (CraftingCost_Select, nameInfo.debugName "FRAME"/"STOCK:")
//         .context[CraftingCostContext_ResultGameplayPropertyModifiers] -> quality_effects
//         .options[] (CraftingCost_Resource) -> resource-Ref + quantity(SCU) + minQuality
//   EntityClassDefinition.Components:
//     SAttachableComponentParams.AttachDef.Localization.Name  -> Anzeigename (loc)
//     SAttachableComponentParams.AttachDef.Type               -> WeaponMining-Erkennung
//     SEntityPhysicsControllerParams.PhysType.Mass            -> mass_kg
//     ...PhysType.temperature.itemResourceParams.overheatTemperature -> overheat
//     SCItemWeaponComponentParams.fireActions[]               -> fire_modes
//     SAmmoContainerComponentParams.maxAmmoCount/maxRestockCount -> magazine
//     SCItemClothingParams.TemperatureResistance              -> armor temp min/max
//     SCItemSuitArmorParams.damageResistance -> DamageResistanceMacro (profile + Multiplikatoren)
//   CraftingGlobalParams.dismantleBlacklistResources          -> out.dismantle_blacklist (App leitet isRare daraus ab)
//   Missionszuordnung: invertiert aus src/data/missions.json (datamine-missions.mjs),
//   Blueprint-Schluessel = Recordname ohne BP_CRAFT_/_SCItem.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDataCore } from './lib/datacore.mjs';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DB = resolve(__dirname, '..', 'assets', 'crafting-db.json');
const OUT_DIS = resolve(__dirname, '..', 'assets', 'dismantling-items.json');
const MISSIONS = resolve(__dirname, '..', 'src', 'data', 'missions.json');

const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

/* ---------------- Quellen laden ---------------- */
let dcbBuf, iniEn, patchLabel = null;
const dcbArg = argOf('--dcb');
if (dcbArg) {
  const iniDir = argOf('--ini') ?? dirname(dcbArg);
  dcbBuf = readFileSync(dcbArg);
  iniEn = readFileSync(join(iniDir, 'global_en.ini'), 'utf8');
  console.log(`offline: ${dcbArg}`);
} else {
  const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
  console.log(`p4k: ${p4k.path} (${(p4k.size / 2 ** 30).toFixed(1)} GiB, ${p4k.entryCount} Eintraege)`);
  dcbBuf = p4k.read(/^Data[\\/]Game2\.dcb$/i);
  iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
  const bm = resolve(dirname(p4k.path), 'build_manifest.id');
  if (existsSync(bm)) {
    try {
      const d = JSON.parse(readFileSync(bm, 'utf8'))?.Data ?? {};
      // 4.9-Manifest: Branch "sc-alpha-4.9.0" + RequestedP4ChangeNum "12232306";
      // aeltere Builds fuehrten stattdessen RequestedP4kVersion.
      patchLabel = d.RequestedP4kVersion
        ?? (d.Branch ? `${d.Tag === 'public' ? 'LIVE' : (d.Tag ?? 'LIVE').toUpperCase()}-${d.Branch.replace(/^sc-alpha-/, '')}-${d.RequestedP4ChangeNum ?? ''}`.replace(/-$/, '') : null);
    } catch { /* egal */ }
  }
  p4k.close();
}

// Achtung ini-Format: Keys koennen ein ",P"-Suffix tragen (Platzhalter-Flag,
// z. B. "item_NameMining_Head_S00_Helix_SCItem,P=S0 Helix") — beim Nachschlagen
// zaehlt der Key OHNE Suffix, sonst fehlen hunderte Item-Namen.
const EN = new Map();
for (const line of iniEn.split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i <= 0) continue;
  const key = line.slice(0, i).replace(/^﻿/, '').toLowerCase().replace(/,p$/, '');
  if (!EN.has(key)) EN.set(key, line.slice(i + 1));
}
const EMPTY_LOC = new Set(['@LOC_UNINITIALIZED', '@LOC_EMPTY', '@LOC_PLACEHOLDER', '@blank_space', '']);
function loc(key) {
  if (typeof key !== 'string' || EMPTY_LOC.has(key)) return null;
  if (!key.startsWith('@')) return key.trim() || null;
  const v = EN.get(key.slice(1).toLowerCase());
  const t = v == null ? '' : v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}
// sc-craft-kompatibler Notnagel, wenn das Spiel keinen Loc-Namen fuehrt:
// Klassenname in Titel-Tokens ("COOL_AEGS_S04_Javelin_SCItem" -> "Cool Aegs S04 Javelin Scitem")
const humanize = (cls) => String(cls).split('_').filter(Boolean)
  .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join(' ');

const t0 = Date.now();
const db = openDataCore(dcbBuf);
console.log(`DataCore v${db.version}: ${db.records.length} Records, ${db.structs.length} Structs (${Date.now() - t0} ms)`);
const sname = (r) => db.structs[r.structIndex]?.name;

/* ---------------- Helfer ---------------- */
// float32-Artefakte kappen (0.019999999552 -> 0.02); die App lerpt selbst.
const r6 = (x) => (typeof x === 'number' && Number.isFinite(x)) ? Math.round(x * 1e6) / 1e6 : x;
const scuOf = (q) => q?.standardCargoUnits != null ? q.standardCargoUnits
  : q?.centiSCU != null ? q.centiSCU / 100
    : q?.microSCU != null ? q.microSCU / 1e6 : null;

// Kategorie: Blueprint-Dateipfad nach blueprints/crafting/, fpsgear/ faellt weg.
// Gross-/Kleinschreibung exakt wie die bisherigen (sc-craft-)Kategorien.
const SEG = {
  lmg: 'LMG', smg: 'SMG', weapons: 'Weapons', armour: 'Armour', ammo: 'Ammo',
  vehiclegear: 'Vehiclegear', quantumdrive: 'Quantumdrive', mininglaser: 'Mininglaser',
  tractorbeam: 'Tractorbeam', massdriver: 'Massdriver', refuelling: 'Refuelling',
  missionitems: 'Missionitems',
};
const segLabel = (s) => SEG[s] ?? (s.charAt(0).toUpperCase() + s.slice(1));
function categoryOf(fileName) {
  const m = fileName.match(/blueprints\/crafting\/(.+)\/[^/]+$/);
  if (!m) return null;
  // fpsgear ist nur Ordner-Praefix; $templates ist CIG-Ablage, keine Kategorie
  // (dort liegen auch fertige Items wie die Novian-Crossbows).
  const parts = m[1].split('/').filter((p) => p !== 'fpsgear' && p !== '$templates');
  return parts.map(segLabel).join(' / ');
}

// GPP -> Anzeigelabel. Elf Zuordnungen empirisch gegen den 4.8-Snapshot
// verifiziert (0 Konflikte), Rest nach demselben Namensschema; Loc-Fallback.
const GPP_LABEL = {
  GPP_Weapon_Recoil_Smoothness: 'Recoil Smoothness',
  GPP_Weapon_Recoil_Handling: 'Recoil Handling',
  GPP_Weapon_Recoil_Kick: 'Recoil Kick',
  GPP_Weapon_Damage: 'Impact Force',
  GPP_Weapon_FireRate: 'Fire Rate',
  GPP_Weapon_Spread: 'Spread',
  GPP_Weapon_ReloadSpeed: 'Reload Speed',
  GPP_Health_MaxHealth: 'Integrity',
  GPP_Shield_MaxHealth: 'Max. Shield Strength',
  GPP_ItemResource_PowerGeneration: 'Power Pips',
  GPP_ItemResource_CoolantGeneration: 'Coolant Rating',
  GPP_Quantum_Speed: 'Quantum Speed',
  GPP_Quantum_FuelRequirement: 'Quantum Fuel Burn',
  GPP_Armor_TemperatureMax: 'Max Temp',
  GPP_Armor_TemperatureMin: 'Min Temp',
  GPP_Armor_DamageMitigation: 'Damage Mitigation',
  GPP_Armor_RadiationCapacity: 'Radiation Capacity',
  GPP_Armor_RadiationDissipation: 'Radiation Dissipation',
  GPP_Weapon_Tractor_MaxDist: 'Max. Distance',
  GPP_Weapon_Tractor_MaxVolume: 'Max. Volume',
  GPP_Weapon_Tractor_FullStrengthDist: 'Full Strength Dist.',
  GPP_Weapon_Tractor_Force: 'Beam Force',
  GPP_Weapon_HullScraping_Speed: 'Speed',
  GPP_Weapon_HullScraping_Efficiency: 'Efficiency',
  GPP_Weapon_HullScraping_Radius: 'Radius',
};
const gppRecords = new Map(); // record.id -> gelesene Def
for (const r of db.records) {
  if (sname(r) !== 'CraftingGameplayPropertyDef') continue;
  gppRecords.set(r.id, { key: r.name.replace('CraftingGameplayPropertyDef.', ''), def: db.readRecord(r, { typed: true, maxDepth: 5 }) });
}
function gppLabel(ref, itemType) {
  const g = ref?.__ref ? gppRecords.get(ref.__ref) : null;
  if (!g) return null;
  // nameOverride greift nach Item-Typ (z. B. WeaponMining -> Laser-Label)
  for (const o of g.def?.nameOverrides ?? []) {
    const types = o?.condition?.matchItemTypes ?? [];
    if (itemType && types.includes(itemType)) {
      const l = loc(o.propertyName);
      if (l) return l;
    }
  }
  return GPP_LABEL[g.key] ?? loc(g.def?.propertyName) ?? g.key.replace(/^GPP_/, '').replace(/_/g, ' ');
}

/* ---------------- Entities lesen (Name + item_stats) ---------------- */
// Grosse Aeste kappen: Loadouts/AI-Daten braucht kein Feld, kostet aber Zeit.
const ENTITY_BLOCK = new Set(['loadout', 'DefaultLoadout', 'defaultLoadout', 'SubItems', 'weaponAIData', 'interactionPoints', 'attachableEntities']);
const entityCache = new Map(); // record.id -> {name, stats, itemType}
function readEntity(ref) {
  if (!ref?.__ref) return null;
  if (entityCache.has(ref.__ref)) return entityCache.get(ref.__ref);
  const rec = db.recordById.get(ref.__ref);
  if (!rec) { entityCache.set(ref.__ref, null); return null; }
  const e = db.readRecord(rec, { typed: true, maxDepth: 11, follow: (n) => !ENTITY_BLOCK.has(n) });
  const comps = new Map();
  for (const c of e?.Components ?? []) if (c?.__type && !comps.has(c.__type)) comps.set(c.__type, c);

  const attach = comps.get('SAttachableComponentParams')?.AttachDef;
  const className = rec.name.replace('EntityClassDefinition.', '');
  // Loc-Kette: AttachDef-Name -> Konvention @item_Name<klasse> -> ShortName.
  // Bleibt alles leer, entscheidet der Aufrufer (Template ueberspringen bzw.
  // humanize-Fallback wie sc-craft).
  const name = loc(attach?.Localization?.Name)
    ?? loc('@item_Name' + className)
    ?? loc(attach?.Localization?.ShortName)
    ?? null;
  const itemType = attach?.Type ?? null;

  // Basiswerte
  const phys = comps.get('SEntityPhysicsControllerParams')?.PhysType;
  const massKg = phys?.Mass ?? null;
  const overheat = phys?.temperature?.itemResourceParams?.overheatTemperature ?? null;

  let stats = null;
  const weapon = comps.get('SCItemWeaponComponentParams');
  const ammo = comps.get('SAmmoContainerComponentParams');
  const suit = comps.get('SCItemSuitArmorParams');
  const cloth = comps.get('SCItemClothingParams');
  if (weapon?.fireActions?.length) {
    const fire_modes = weapon.fireActions.map((fa) => {
      if (!fa || typeof fa !== 'object') return null;
      const lp = fa.launchParams ?? {};
      const fm = { name: fa.name ?? null };
      if (fa.fireRate != null) fm.fire_rate = r6(fa.fireRate);
      if (fa.heatPerShot != null) fm.heat_per_shot = r6(fa.heatPerShot);
      if (fa.wearPerShot != null) fm.wear_per_shot = r6(fa.wearPerShot);
      if (lp.ammoCost != null) fm.ammo_cost = lp.ammoCost;
      if (lp.pelletCount != null) fm.pellet_count = lp.pelletCount;
      if (lp.damageMultiplier != null) fm.damage_multiplier = r6(lp.damageMultiplier);
      if (lp.spreadParams) {
        fm.spread = {
          min: r6(lp.spreadParams.min), max: r6(lp.spreadParams.max),
          first_attack: r6(lp.spreadParams.firstAttack), attack: r6(lp.spreadParams.attack),
          decay: r6(lp.spreadParams.decay),
        };
      }
      return fm;
    }).filter(Boolean);
    stats = { type: 'weapon', fire_modes };
  } else if (ammo) {
    stats = { type: 'magazine', max_ammo: ammo.maxAmmoCount ?? null, max_restock: ammo.maxRestockCount ?? null };
  } else if (suit || (cloth && cloth.TemperatureResistance)) {
    stats = { type: 'armor' };
    const drmRef = suit?.damageResistance;
    const drmRec = drmRef?.__ref ? db.recordById.get(drmRef.__ref) : null;
    if (drmRec) {
      const m = db.readRecord(drmRec, { typed: true, maxDepth: 5 });
      const d = m?.damageResistance ?? {};
      stats.damage_resistance = {
        physical: r6(d.PhysicalResistance?.Multiplier),
        energy: r6(d.EnergyResistance?.Multiplier),
        distortion: r6(d.DistortionResistance?.Multiplier),
        thermal: r6(d.ThermalResistance?.Multiplier),
        biochemical: r6(d.BiochemicalResistance?.Multiplier),
        stun: r6(d.StunResistance?.Multiplier),
        impact_force: r6(m?.impactForceResistance?.impactForceResistance),
        profile: drmRec.name.replace('DamageResistanceMacro.', ''),
      };
    }
    if (cloth?.TemperatureResistance) {
      stats.temperature_resistance = { min: r6(cloth.TemperatureResistance.MinResistance), max: r6(cloth.TemperatureResistance.MaxResistance) };
    }
  }
  if (massKg != null || overheat != null) {
    stats = stats ?? {};
    if (massKg != null) stats.mass_kg = r6(massKg);
    if (overheat != null) stats.overheat_temperature = r6(overheat);
  }
  const out = { name, stats, itemType, className };
  entityCache.set(ref.__ref, out);
  return out;
}

/* ---------------- Ressourcen ---------------- */
const resourceName = new Map(); // record.id -> Anzeigename
const allResources = [];
for (const r of db.records) {
  if (sname(r) !== 'ResourceType') continue;
  const d = db.readRecord(r, { maxDepth: 2 });
  const n = loc(d?.displayName) ?? r.name.replace('ResourceType.', '').replace(/_/g, ' ');
  resourceName.set(r.id, n);
  allResources.push(n);
}
console.log(`resources: ${allResources.length}`);

/* ---------------- Dismantle-Blacklist (globaler Crafting-Param) ---------------- */
// CraftingGlobalParams.dismantleBlacklistResources: Materialien, die beim
// Zerlegen NIE zurueckkommen (Anti-Farming seltener Erze). Wird in die Ausgabe
// geschrieben, damit die App `isRare` daraus ableitet statt aus einer Handliste
// im JS — die veraltete sonst still, sobald CIG die Blacklist aendert (genau der
// Lindinium-Bug). Namen ueber dieselbe resourceName-Map wie die Rezepte, damit
// die Kleinschreibung exakt auf recipe.materialId passt.
const gp = db.records.find((r) => sname(r) === 'CraftingGlobalParams');
const dismantleBlacklist = [];
if (gp) {
  const d = db.readRecord(gp, { typed: true, maxDepth: 4 });
  for (const e of d?.dismantleBlacklistResources ?? []) {
    const n = (e?.__ref && resourceName.get(e.__ref)) ?? String(e?.name ?? '').replace('ResourceType.', '');
    if (n) dismantleBlacklist.push(n.toLowerCase());
  }
  dismantleBlacklist.sort((a, b) => a.localeCompare(b, 'en'));
}
console.log(`dismantle-blacklist: ${dismantleBlacklist.length} Materialien (${dismantleBlacklist.join(', ') || '—'})`);
if (!dismantleBlacklist.length) console.warn('  WARNUNG: leere Blacklist — CraftingGlobalParams nicht gefunden? App faellt auf „nichts selten“ zurueck.');

/* ---------------- Missionen -> Blueprint-Schluessel invertieren ---------------- */
// missions.json fuehrt pro Mission die Blueprint-Pools (Item-Keys ohne
// BP_CRAFT_/_SCItem). drop_chance = Pool-Chance der Mission (Gewichte innerhalb
// des Pools zeigt die App nicht an).
const missionsByKey = new Map(); // itemkey(lower) -> [{id,name,drop_chance}]
try {
  const mj = JSON.parse(readFileSync(MISSIONS, 'utf8'));
  for (const m of mj.missions ?? []) {
    const seen = new Set();
    for (const pool of m.blueprints ?? []) {
      for (const bp of pool.blueprints ?? []) {
        const key = String(bp.name ?? '').toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const arr = missionsByKey.get(key) ?? [];
        arr.push({ id: m.slug, name: m.title, drop_chance: pool.chance ?? 1 });
        missionsByKey.set(key, arr);
      }
    }
  }
  console.log(`missionen: ${missionsByKey.size} Blueprint-Keys mit Quelle`);
} catch (e) {
  console.warn('missions.json nicht lesbar — Blueprints ohne Missions-Quellen:', e.message);
}

/* ---------------- Blueprints extrahieren ---------------- */
// $templates: CIG parkt dort auch fertige Items (Novian-Crossbows, NN-Cannons —
// in 4.8 lagen die noch in normalen Pfaden). Regel: Template-Blueprints nur
// aufnehmen, wenn das Spiel einen echten Loc-Namen fuehrt; namenlose
// Template-Huellen fallen raus. Normale Blueprints ohne Loc-Namen bekommen den
// humanize-Fallback (so hielt es auch sc-craft, z. B. "Cool S04 Cnou Pioneer").
const SKIP_PATH = /blueprints\/dismantle/;
const blueprints = [];
const dismantleByName = new Map(); // name(lower) -> recipe [{materialId, quantity_cSCU}]
let skippedNoEntity = 0, skippedTemplate = 0, fallbackNames = 0;

for (const r of db.records) {
  if (sname(r) !== 'CraftingBlueprintRecord') continue;
  if (SKIP_PATH.test(r.fileName)) continue;
  const isTemplate = /\$templates/.test(r.fileName);
  const d = db.readRecord(r, { typed: true, maxDepth: 14 });
  const bp = d?.blueprint;
  const ecRef = bp?.processSpecificData?.entityClass;
  if (!ecRef?.__ref) { skippedNoEntity++; continue; }
  const ent = readEntity(ecRef) ?? { name: null, stats: null, itemType: null, className: ecRef.name?.replace('EntityClassDefinition.', '') ?? r.name.replace(/^CraftingBlueprintRecord\.BP_CRAFT_/, '') };
  if (!ent.name) {
    if (isTemplate) { skippedTemplate++; continue; }
    ent.name = humanize(ent.className);
    fallbackNames++;
  }

  const tiers = bp.tiers ?? [];
  const costs = tiers[0]?.recipe?.costs;
  const ct = costs?.craftTime;
  const craftSeconds = ct ? ((ct.days ?? 0) * 86400 + (ct.hours ?? 0) * 3600 + (ct.minutes ?? 0) * 60 + (ct.seconds ?? 0)) : 0;

  const ingredients = [];
  for (const slot of costs?.mandatoryCost?.options ?? []) {
    if (!slot || typeof slot !== 'object') continue;
    const slotName = String(slot.nameInfo?.debugName ?? '').replace(/[:\s]+$/, '') || null;
    const options = (slot.options ?? []).map((o) => {
      // Ressourcen-Kosten (SCU) — der Normalfall.
      if (o?.__type === 'CraftingCost_Resource') {
        const rid = o.resource?.__ref;
        return {
          name: (rid && resourceName.get(rid)) ?? (o.resource?.name ?? '').replace('ResourceType.', ''),
          quantity_scu: r6(scuOf(o.quantity)),
          min_quality: o.minQuality ?? 0,
        };
      }
      // Item-Kosten (FPS-Minerale/Edelsteine als Stueckzahl, z. B. 20x Glacosite
      // fuer Schilde). Konvention wie sc-craft: Roh-Count in quantity_scu.
      if (o?.__type === 'CraftingCost_Item') {
        const ge = readEntity(o.entityClass);
        return {
          name: ge?.name ?? humanize((o.entityClass?.name ?? '').replace('EntityClassDefinition.', '')),
          quantity_scu: o.quantity ?? 0,
          min_quality: o.minQuality ?? 0,
        };
      }
      return null;
    }).filter(Boolean);
    const mods = (slot.context ?? []).find((c) => c?.__type === 'CraftingCostContext_ResultGameplayPropertyModifiers')?.gameplayPropertyModifiers?.gameplayPropertyModifiers ?? [];
    const quality_effects = mods.map((mod) => {
      // Mehrere valueRanges (z. B. 0-500 + 501-1000) zu einer Spanne mergen —
      // die Teilstuecke sind kollinear, und die App lerpt ohnehin nur linear
      // ueber min..max (so hielt es auch sc-craft).
      const vrs = mod?.valueRanges ?? [];
      const first = vrs[0], last = vrs[vrs.length - 1];
      if (!first) return null;
      return {
        stat: gppLabel(mod.gameplayPropertyRecord, ent.itemType),
        quality_min: first.startQuality ?? 0,
        quality_max: last.endQuality ?? 1000,
        // multiplikative Ranges fuehren modifierAtStart/End, additive
        // (LinearIntegerAdditive, z. B. Power Pips) additiveModifierAtStart/End
        modifier_at_min: r6(first.modifierAtStart ?? first.additiveModifierAtStart),
        modifier_at_max: r6(last.modifierAtEnd ?? last.additiveModifierAtEnd),
        multiplicative: first.__type === 'CraftingGameplayPropertyModifierValueRange_Linear',
      };
    }).filter(Boolean);
    const ing = { slot: slotName, options };
    if (quality_effects.length) ing.quality_effects = quality_effects;
    ingredients.push(ing);
  }

  const entry = {
    name: ent.name,
    category: categoryOf(r.fileName) ?? '—',
    craft_time_seconds: craftSeconds,
    tiers: tiers.length,
  };
  if (ent.stats && Object.keys(ent.stats).length) entry.item_stats = ent.stats;
  entry.ingredients = ingredients;

  const key = r.name.replace('CraftingBlueprintRecord.', '').replace(/^BP_CRAFT_/i, '').replace(/_SCItem$/i, '').toLowerCase();
  const mis = missionsByKey.get(key);
  if (mis?.length) entry.missions = mis;

  blueprints.push(entry);

  // Zerlege-Rezept (Zusammensetzung = Mandatory-Slots)
  if (!dismantleByName.has(ent.name.toLowerCase())) {
    const recipe = ingredients.flatMap((ing) => ing.options.map((o) => ({
      materialId: o.name.toLowerCase(),
      quantity_cSCU: Math.round((o.quantity_scu ?? 0) * 100),
    }))).filter((x) => x.quantity_cSCU > 0);
    dismantleByName.set(ent.name.toLowerCase(), recipe);
  }
}
blueprints.sort((a, b) => a.name.localeCompare(b.name, 'en'));
console.log(`blueprints: ${blueprints.length} (ohne entityClass: ${skippedNoEntity}, Template ohne Namen uebersprungen: ${skippedTemplate}, humanize-Fallback: ${fallbackNames})`);

/* ---------------- used_in_blueprints + Ausgabe crafting-db.json ---------------- */
const usedCount = new Map();
for (const b of blueprints) for (const ing of b.ingredients) for (const o of ing.options) usedCount.set(o.name, (usedCount.get(o.name) ?? 0) + 1);
const resources = [...new Set(allResources)].sort((a, b) => a.localeCompare(b, 'en'))
  .map((n) => ({ name: n, used_in_blueprints: usedCount.get(n) ?? 0 }));

const out = {
  source: 'Star Citizen Data.p4k -> Data/Game2.dcb (DataCore v8) + Localization/english/global.ini — eigene Extraktion (scripts/datamine-crafting.mjs)',
  source_url: 'https://robertsspaceindustries.com/',
  source_note: 'Direkt aus den Spieldaten extrahiert. Patch-volatil — ingame prüfen.',
  version: patchLabel ?? 'LIVE (Build unbekannt)',
  snapshot_date: new Date().toISOString().slice(0, 10),
  counts: { blueprints: blueprints.length, resources: resources.length },
  dismantle_blacklist: dismantleBlacklist,
  blueprints,
  resources,
};
writeFileSync(OUT_DB, JSON.stringify(out));
console.log(`geschrieben: ${OUT_DB} (${(JSON.stringify(out).length / 1e6).toFixed(2)} MB)`);

/* ---------------- dismantling-items.json aktualisieren ---------------- */
// Kuratierte Felder (id, name, category, purchasePrice_aUEC, purchaseLocation)
// bleiben; nur recipe wird aus den Spieldaten erneuert. Items ohne passenden
// Blueprint behalten ihr altes Rezept (geloggt). Namen werden dabei
// whitespace-normalisiert (die Community-Quelle schleppt U+00A0 aus sc-craft
// mit; die App verlinkt Blueprint- und Zerlege-Tab ueber exakte Namen).
const nrm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const dis = JSON.parse(readFileSync(OUT_DIS, 'utf8'));
let updated = 0, unchanged = 0, unmatched = [];
for (const item of dis) {
  const clean = nrm(item.name);
  if (clean !== item.name) item.name = clean;
  const recipe = dismantleByName.get(clean.toLowerCase());
  if (!recipe || !recipe.length) { unmatched.push(item.name); continue; }
  const oldJson = JSON.stringify(item.recipe);
  const newJson = JSON.stringify(recipe);
  if (oldJson !== newJson) { item.recipe = recipe; updated++; } else unchanged++;
}
writeFileSync(OUT_DIS, JSON.stringify(dis, null, 2) + '\n');
console.log(`dismantling-items: ${updated} Rezepte aktualisiert, ${unchanged} unveraendert, ${unmatched.length} ohne Blueprint-Match`);
if (unmatched.length) console.log('  ohne Match:', unmatched.slice(0, 20).join(' | ') + (unmatched.length > 20 ? ` … (+${unmatched.length - 20})` : ''));

console.log(`fertig in ${((Date.now() - t0) / 1000).toFixed(1)} s — Patch: ${out.version}`);
