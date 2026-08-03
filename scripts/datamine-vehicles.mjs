// datamine-vehicles.mjs — Fahrzeug-Katalog direkt aus den Spieldateien.
//
// ZWECK: löst sync-vehicles.mjs (Star-Citizen-Wiki-API) ab. Die Wiki ist selbst
// nur ein Spiegel der Spieldaten — sie hinkt hinterher (nennt den Buccaneer
// „Interdiction", das Spiel „Light Fighter") und verliert Präzision, wo sie über
// Anzeigenamen joint (siehe enrich-weapon-sizes.mjs).
//
// QUELLEN — drei Ebenen, alle in der Data.p4k:
//   1. DataCore (Game2.dcb): Identität, Rolle/Fokus, Besatzung, Versicherung,
//      Loadout; die Flugwerte am Flugcontroller-Item, Schild/QT an den
//      verbauten Items.
//   2. Fahrzeug-Implementierung (Data/Scripts/.../Implementations/Xml/*.xml,
//      CryXmlB): Bauteil-Trefferpunkte (Summe = Hüllen-HP) und die Item-Ports
//      mit ihren zulässigen Größen. Der Pfad steht je Schiff in
//      VehicleComponentParams.vehicleDefinition — NICHT nach Namenskonvention
//      raten, die trägt nur bei 113 von 227 Schiffen (Varianten teilen sich
//      eine Basis-XML).
//   3. InventoryContainer-Records: Innenmaße der Frachtgitter. 1 SCU = 1,25 m
//      Kantenlänge, also SCU = x·y·z / 1,953125.
//
// NICHT im Spiel und deshalb aus src/data/vehicle-external.json:
//   msrpUSD, pledgeUrl (RSI-Store) und die publizierten Abmessungen. Alles
//   andere kommt aus den Spieldateien. Die Datei ist der sichtbare Rest an
//   Fremddaten — sie soll schrumpfen, nicht wachsen.
//
// Schreibt bewusst NICHT direkt src/data/vehicles.json, sondern
// src/data/vehicles-gamefiles.json. Der Tausch passiert erst, wenn
// verify-vehicles.mjs den Feld-für-Feld-Vergleich sauber zeigt.
//
// Aufruf: node scripts/datamine-vehicles.mjs [--p4k <Data.p4k>] [--ship <id>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
import { parseCryXml, findAll, findAllLive, applyModification } from './lib/cryxml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'src', 'data', 'vehicles-gamefiles.json');
const EXTERNAL = resolve(__dirname, '..', 'src', 'data', 'vehicle-external.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const ONLY = argOf('--ship');
const norm = (s) => (s || '').replace(/\\/g, '/');
const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

// gameVersion (01.4-02, Gruppe C, 0 Proben): build_manifest.id neben der p4k,
// wie datamine-items.mjs/datamine-crafting.mjs/extract-hardpoints.mjs seit
// Phase 01.3. Ersetzt den Wiki-`v.version`-Wert (dort z. B. "4.9.0-LIVE.12232306").
let GAME_VERSION = 'sc-alpha-4.9.0'; // Fallback, falls build_manifest.id fehlt
{
  const bm = resolve(dirname(argOf('--p4k') ?? DEFAULT_P4K), 'build_manifest.id');
  if (existsSync(bm)) {
    try {
      const d = JSON.parse(readFileSync(bm, 'utf8'))?.Data;
      if (d?.Branch && d?.RequestedP4ChangeNum) GAME_VERSION = `${d.Branch}@${d.RequestedP4ChangeNum}`;
    } catch { /* Fallback bleibt */ }
  }
}

/* ---------------------------------------------------------------- */
/* p4k / DataCore / Localization                                     */
/* ---------------------------------------------------------------- */
const p4k = openP4k(argOf('--p4k') ?? DEFAULT_P4K);
const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
let iniDe = null;
for (const rx of [/Localization[\\/]german[\\/]global\.ini$/i, /Localization[\\/]german_\(germany\)[\\/]global\.ini$/i]) {
  try { iniDe = p4k.read(rx).toString('utf8'); break; } catch { /* nächste Variante */ }
}
// Implementierungs-XMLs einmal indizieren (Pfad kleingeschrieben -> Eintrag).
// Gecacht wird der ROHE Puffer, nicht der Baum: applyModification() mutiert ihn,
// und 300i/315p/325a/350r teilen sich eine Datei — ein geteilter Baum würde die
// Varianten gegenseitig verfälschen.
const implByPath = new Map();
for (const e of p4k.entries(/Implementations.Xml.[^\\/]+\.xml$/i)) implByPath.set(norm(e.name).toLowerCase(), e);
const bufCache = new Map();
const readImpl = (path, modification) => {
  const key = ('data/' + norm(path)).toLowerCase();
  let buf = bufCache.get(key);
  if (buf === undefined) {
    const e = implByPath.get(key) ?? [...implByPath.entries()].find(([k]) => k.endsWith(key.split('/').pop()))?.[1];
    try { buf = e ? p4k.extract(e) : null; } catch { buf = null; }
    bufCache.set(key, buf);
  }
  if (!buf) return { root: null, modOk: null };
  let root = null;
  try { root = parseCryXml(buf); } catch { return { root: null, modOk: null }; }
  const modOk = modification ? applyModification(root, modification) : 0;
  return { root, modOk };
};

const mkMap = (ini) => { const m = new Map(); if (!ini) return m; for (const line of ini.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) m.set(line.slice(0, i).replace(/^﻿/, '').toLowerCase(), line.slice(i + 1).trim()); } return m; };
const EN = mkMap(iniEn), DE = mkMap(iniDe);
const BAD = /^@|PLACEHOLDER|LOC_EMPTY|\[PH\]|TRANSLATION NOT FOUND/;
const locFrom = (map, k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const v = map.get(k.slice(1).toLowerCase()); return v && !BAD.test(v) ? v : null; };
const locEn = (k) => locFrom(EN, k);
const locDe = (k) => locFrom(DE, k) ?? locEn(k);

const db = openDataCore(dcb);
const ECD = db.records.filter((r) => db.structs[r.structIndex]?.name === 'EntityClassDefinition');

const findType = (o, name, d = 0) => {
  if (!o || typeof o !== 'object' || d > 10) return null;
  if (Array.isArray(o)) { for (const x of o) { const r = findType(x, name, d); if (r) return r; } return null; }
  if (o.__type === name) return o;
  for (const [k, v] of Object.entries(o)) { if (k === '__type') continue; if (v && typeof v === 'object') { const r = findType(v, name, d + 1); if (r) return r; } }
  return null;
};

/* ---------------------------------------------------------------- */
/* Schiffs-Records + ID (identisch zu datamine-ship-loadouts.mjs)     */
/* ---------------------------------------------------------------- */
const HP = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', 'ship-hardpoints.json'), 'utf8')).ships;
const LOAD = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', 'ship-loadouts.json'), 'utf8'));
const ourIds = Object.keys(HP);
const isVariantJunk = (f) => /_ai_|_pu_|_test|_template|_dummy|_unmanned|_hijacked|_turretless|_debug|_showdown_scramble|_swarm|_simpod|_modifiers/i.test(f);
const shipRecs = ECD.filter((r) => /\/(spaceships|groundvehicles)\/[^/]+\.xml$/i.test(norm(r.fileName)) && !isVariantJunk(norm(r.fileName)));
const recId = (r) => (r.name || '').replace(/^EntityClassDefinition\./, '').toLowerCase().replace(/_/g, '-');
const byId = new Map();
for (const r of shipRecs) { const id = recId(r); if (!byId.has(id)) byId.set(id, r); }

// Flugcontroller einmal indizieren (Basename ohne .xml -> Record)
const flightCtrlByCls = new Map();
for (const r of ECD) {
  const f = norm(r.fileName).toLowerCase();
  if (!/\/controller_flight_[^/]+\.xml$/.test(f)) continue;
  const key = f.split('/').pop().replace(/\.xml$/, '');
  if (!flightCtrlByCls.has(key)) flightCtrlByCls.set(key, r);
}

/* ---------------------------------------------------------------- */
/* Item-Auflösung (für Schild/QD/Frachtgitter aus dem Loadout)        */
/* ---------------------------------------------------------------- */
const recByNameIdx = new Map();
for (const r of db.records) { const n = r.name || ''; if (n && !recByNameIdx.has(n)) recByNameIdx.set(n, r); }
const itemByCls = (cls) => (cls ? recByNameIdx.get(cls) ?? recByNameIdx.get('EntityClassDefinition.' + cls) : null);
const itemCache = new Map();
// maxDepth 14 (statt vormals 9): die Waffen-Schadenskette (SAmmoContainerComponentParams
// -> ammoParamsRecord -> BulletProjectileParams.damage) und der Quantum-Treibstoffbedarf
// (quantumFuelRequirement) liegen tiefer verschachtelt als die bisher gelesenen
// Schild-/Antriebs-Werte. 01.4-02, Gruppe A/B.
const readItem = (cls) => {
  if (itemCache.has(cls)) return itemCache.get(cls);
  const r = itemByCls(cls);
  const o = r ? db.readRecord(r, { maxDepth: 14, typed: true }) : null;
  itemCache.set(cls, o);
  return o;
};

/* ---------------------------------------------------------------- */
/* Waffen-Schaden je Sekunde (01.4-02, Gruppe A, Schritt 1): Item ueber `cls`
   aufloesen (readItem), Feuerrate + Munitionsschaden lesen. Belegt am
   Buccaneer gegen den Wiki-Bestand (2760,4 gesamt; 1266 / 545,6 / 201,6 je
   Waffentyp) — exakte Uebereinstimmung, nicht nur Groessenordnung. Dieselbe
   Ableitung wie scripts/datamine-items.mjs (assets/items-gamefiles.json),
   hier direkt gegen den bereits offenen DataCore statt gegen die Item-Finder-
   Datei — die traegt nicht jede Waffen-Variante (z. B. APAR_BallisticGatling_S4
   fehlt dort trotz vorhandenem DataCore-Record; Namens-Join haette hier auf
   den falschen "Revenant Gatling"-Eintrag (ANVL, S3) gegriffen — genau die
   Falle aus `display-name-not-a-key`, hier vermieden durch cls-Join). */
const findRx = (o, rx, d = 0) => {
  if (!o || typeof o !== 'object' || d > 14) return null;
  if (Array.isArray(o)) { for (const x of o) { const r = findRx(x, rx, d + 1); if (r) return r; } return null; }
  if (o.__type && rx.test(o.__type)) return o;
  for (const [k, v] of Object.entries(o)) { if (k === '__type') continue; if (v && typeof v === 'object') { const r = findRx(v, rx, d + 1); if (r) return r; } }
  return null;
};
const DMG_KEYS = { physical: 'DamagePhysical', energy: 'DamageEnergy', distortion: 'DamageDistortion', thermal: 'DamageThermal', biochemical: 'DamageBiochemical', stun: 'DamageStun' };
function damageObj(di) {
  if (!di || typeof di !== 'object') return null;
  let sum = 0;
  for (const k of Object.values(DMG_KEYS)) { const v = di[k]; if (typeof v === 'number' && v) sum += v; }
  return sum > 0 ? sum : null;
}
const ammoDmgCache = new Map();
function ammoDamagePerShot(ref) {
  if (!ref) return null;
  if (ammoDmgCache.has(ref)) return ammoDmgCache.get(ref);
  const rec = db.recordById.get(ref);
  let out = null;
  if (rec) {
    const ao = db.readRecord(rec, { maxDepth: 14, typed: true });
    const bp = findRx(ao, /BulletProjectileParams|SProjectileParams/);
    out = damageObj((bp && bp.damage) || findRx(ao, /DamageInfo/));
  }
  ammoDmgCache.set(ref, out);
  return out;
}
const dpsCache = new Map();
function weaponDps(cls) {
  if (!cls) return null;
  if (dpsCache.has(cls)) return dpsCache.get(cls);
  const io = readItem(cls);
  let dps = null;
  if (io) {
    const fa = findRx(io, /SWeaponActionFire(Single|Rapid|Burst|Charge)Params/) || findRx(io, /SWeaponActionFireParams/);
    const wc = findRx(io, /SCItemWeaponComponentParams/);
    const rof = findKeyNum(fa || wc || {}, 'fireRate');
    const ac = findRx(io, /SAmmoContainerComponentParams/);
    const perShot = ammoDamagePerShot(ac?.ammoParamsRecord?.__ref);
    if (rof && perShot) dps = round(perShot * rof / 60, 1);
  }
  dpsCache.set(cls, dps);
  return dps;
}

/* ---------------------------------------------------------------- */
/* Treibstoff- und Erzbehaelter (01.4-02, Gruppe B): Kapazitaet aus dem
   ResourceContainer des Behaelter-Items — dieselbe Fundstelle wie
   `containerScu` fuer Frachtgitter, hier je Item ueber `cls` aufgeloest
   (readItem), nicht ueber den Cargogrid-Record-Index. */
function tankCapacityScu(cls) {
  const io = readItem(cls);
  if (!io) return null;
  const rc = findRx(io, /ResourceContainer/);
  const cap = rc?.capacity?.standardCargoUnits;
  return typeof cap === 'number' ? cap : null;
}

/* ---------------------------------------------------------------- */
/* Fracht: Innenmaße der Gitter -> SCU                               */
/* ---------------------------------------------------------------- */
const SCU_M3 = 1.25 ** 3; // 1 SCU = 1,25 m Kantenlänge
const containerScu = (rec) => {
  const o = db.readRecord(rec, { maxDepth: 6, typed: true });
  const d = o?.interiorDimensions;
  if (!d || d.x == null) return 0;
  return (d.x * d.y * d.z) / SCU_M3;
};
const containerByName = new Map();
for (const r of db.records) if (/inventorycontainers\//i.test(norm(r.fileName))) containerByName.set((r.name || '').toLowerCase(), r);

/* ---------------------------------------------------------------- */
/* Hersteller                                                        */
/* ---------------------------------------------------------------- */
const mfrCache = new Map();
function manufacturer(ref) {
  const id = ref?.__ref;
  if (!id) return null;
  if (mfrCache.has(id)) return mfrCache.get(id);
  const r = db.recordById.get(id);
  let out = null;
  if (r) {
    const o = db.readRecord(r, { maxDepth: 4, typed: true });
    out = { name: locEn(o.Localization?.Name) ?? o.Code ?? null, code: o.Code ?? null };
  }
  mfrCache.set(id, out);
  return out;
}

/* ---------------------------------------------------------------- */
/* Größenklassen-Label                                               */
/* ---------------------------------------------------------------- */
// Empirisch gegen den Altbestand abgeglichen (Spiel-Size -> gebräuchliches
// Label): 1 = Beiboot, 2 = Klein, 3 = Mittel, 4/5 = Groß, 6 = Kapitalklasse.
// Bodenfahrzeuge tragen unabhängig von der Größenklasse „Fahrzeug" — die Skala
// des Spiels ist feiner als die Kategorien, die Leute erwarten.
const SIZE_LABEL = {
  1: 'Beiboot', 2: 'Klein', 3: 'Mittel', 4: 'Groß', 5: 'Groß', 6: 'Kapitalklasse',
};

/* ---------------------------------------------------------------- */
/* Ein Fahrzeug bauen                                                */
/* ---------------------------------------------------------------- */
const stats = { impl: 0, ifcs: 0, hull: 0, cargo: 0, shield: 0, qt: 0, qtFuel: 0, qtRange: 0, h2Fuel: 0, ore: 0, noRec: [], badMod: [], noIfcs: [] };

function buildVehicle(id) {
  const rec = byId.get(id);
  if (!rec) { stats.noRec.push(id); return null; }
  const o = db.readRecord(rec, { maxDepth: 14, typed: true });
  const att = findType(o, 'SAttachableComponentParams')?.AttachDef ?? {};
  const veh = findType(o, 'VehicleComponentParams');
  const ins = findType(o, 'SEntityInsuranceProperties')?.shipInsuranceParams;
  const mfr = manufacturer(att.Manufacturer);
  const ports = LOAD.ships[id] ?? {};

  // --- Identität ---
  const fullName = locEn(veh?.vehicleName) ?? locEn(att.Localization?.Name) ?? id;
  // Anzeigename ohne Herstellerpräfix ("Drake Buccaneer" -> "Buccaneer"),
  // wie ihn die Seite bisher führt (der Hersteller steht daneben).
  // Der Herstellername steht im Datenblatt daneben — im Schiffsnamen ist er
  // Dopplung. Abgeschnitten wird entweder das erste Wort des Herstellers
  // ("Drake Buccaneer") oder sein Kürzel ("RSI Apollo Medivac").
  const stripMfr = (s) => {
    if (!s) return s;
    const pre = [mfr?.name?.split(/\s+/)[0], mfr?.code].filter(Boolean);
    for (const p of pre) {
      const rx = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
      if (rx.test(s)) return s.replace(rx, '').replace(/\s{2,}/g, ' ').trim();
    }
    return s.replace(/\s{2,}/g, ' ').trim();
  };
  const sizeClass = att.Size ?? null;
  // Herstellerkürzel: `Manufacturer.Code` ist im Spiel dreistellig gekappt
  // ("AEG", "MIS"), gebräuchlich und eindeutig ist das Präfix der Klasse
  // (AEGS_Gladius -> AEGS, MRAI_Fury -> MRAI). Das Präfix gewinnt.
  const clsPrefix = (rec.name || '').replace(/^EntityClassDefinition\./, '').split('_')[0];
  const makerCode = /^[A-Z]{2,5}$/.test(clsPrefix) ? clsPrefix : mfr?.code ?? null;

  // --- Flugwerte: IFCS am Flugcontroller-Item ---
  // Erst das eigene controller_flight_<klasse>, sonst das des Basisschiffs.
  // Varianten haben oft keinen eigenen Controller — welches Schiff ihre Basis
  // ist, steht in vehicleDefinition (misc_freelancer.xml -> MISC_Freelancer).
  const ownCls = (rec.name || '').replace(/^EntityClassDefinition\./, '').toLowerCase();
  const baseCls = veh?.vehicleDefinition
    ? norm(veh.vehicleDefinition).split('/').pop().replace(/\.xml$/i, '').toLowerCase()
    : null;
  let ifcs = null;
  for (const cls of [ownCls, baseCls].filter(Boolean)) {
    const cr = flightCtrlByCls.get(`controller_flight_${cls}`);
    if (!cr) continue;
    ifcs = findType(db.readRecord(cr, { maxDepth: 9, typed: true }), 'IFCSParams');
    if (ifcs) break;
  }
  if (ifcs) stats.ifcs++; else if (veh?.movementClass === 'Spaceship') stats.noIfcs.push(id);
  const ang = ifcs?.maxAngularVelocity ?? null;

  // --- Implementierungs-XML: Hüllen-HP + Waffen-Ports ---
  let hullHp = null, mounts = [];
  const { root: impl, modOk } = veh?.vehicleDefinition
    ? readImpl(veh.vehicleDefinition, veh.modification)
    : { root: null, modOk: null };
  if (veh?.modification && modOk === null) stats.badMod.push(`${id} (${veh.modification})`);
  if (impl) {
    stats.impl++;
    // Hüllen-HP = Summe der Bauteil-Trefferpunkte OHNE die `hardpoint_*`-Teile:
    // das sind Aufhängungen für Komponenten (Triebwerke, Waffen), ihre HP
    // gehören zum eingebauten Gerät, nicht zur Hülle. Gegenprobe: die Regel
    // trifft 186 der 223 Wiki-Werte, „alle Teile" nur 178 — und KEINE Regel
    // trifft alle, weil die Wiki-Hüllenwerte schlicht veraltet sind.
    const parts = findAllLive(impl, 'Part')
      .filter((n) => n.attr.damageMax && !/^hardpoint_/i.test(n.attr.name || ''));
    const sum = parts.reduce((s, n) => s + (Number(n.attr.damageMax) || 0), 0);
    if (sum > 0) { hullHp = Math.round(sum); stats.hull++; }
    // Waffen-Ports: was PASST, nicht was drin ist
    const sizes = new Map();
    for (const part of findAllLive(impl, 'Part')) {
      const ip = part.children.find((c) => c.tag === 'ItemPort');
      if (!ip) continue;
      const types = findAll(ip, 'Type').map((t) => t.attr.type || t.attr.name).filter(Boolean);
      if (!types.some((t) => /^WeaponGun$/i.test(t))) continue;
      const max = Number(ip.attr.maxSize);
      if (!Number.isFinite(max) || max <= 0) continue;
      sizes.set(max, (sizes.get(max) ?? 0) + 1);
    }
    mounts = [...sizes.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => ({ size, count }));
  }

  // --- Loadout: Waffen / Türme / Werfer / Gegenmaßnahmen / Komponenten ---
  const pilot = new Map(), racks = new Map();
  // Turmwaffen getrennt je Gattung (01.4-02, Gruppe A/turrets[]): manned/remote/pdc,
  // aus `turretKind` (D-21-Nachtrag in datamine-ship-loadouts.mjs, Turm-Item-Record-
  // Struktur SCItemSeatParams/SCItemTurretRemoteParams). `turret` bleibt zusaetzlich
  // als flache Gesamtliste bestehen (Bestandsfeld, verify-weapon-sizes.mjs liest es).
  const turret = new Map();
  const turretByKind = { manned: new Map(), remote: new Map(), pdc: new Map() };
  const comp = { powerPlants: [], shields: [], coolers: [], quantumDrives: [], radars: [] };
  const COMP_KEY = { power: 'powerPlants', shield: 'shields', cooler: 'coolers', quantum: 'quantumDrives', radar: 'radars' };
  let cmLaunchers = 0;
  const qtFuelTanks = [], h2FuelTanks = [], orePods = [];
  const add = (map, it) => {
    const k = `${it.name}|${it.size ?? ''}`;
    const e = map.get(k) ?? { name: it.name, size: it.size ?? null, count: 0, cls: it.cls };
    e.count += it.count;
    map.set(k, e);
  };
  for (const items of Object.values(ports)) {
    for (const it of items) {
      if (it.cat === 'weapon') {
        if (it.carrier === 'turret') {
          add(turret, it);
          add(turretByKind[it.turretKind ?? 'manned'] ?? (turretByKind[it.turretKind ?? 'manned'] = new Map()), it);
        } else add(pilot, it);
      }
      else if (it.cat === 'missile') add(racks, it);
      else if (it.cat === 'countermeasure') cmLaunchers += it.count;
      else if (it.cat === 'qtfueltank') qtFuelTanks.push(it);
      else if (it.cat === 'h2fueltank') h2FuelTanks.push(it);
      else if (it.cat === 'orepod') orePods.push(it);
      else if (COMP_KEY[it.cat]) {
        const list = comp[COMP_KEY[it.cat]];
        const hit = list.find((x) => x.name === it.name && x.size === it.size);
        if (hit) hit.count += it.count; else list.push({ name: it.name, size: it.size ?? null, count: it.count });
      }
    }
  }

  // --- Schild-HP + Quantum aus den verbauten Items ---
  let shieldHp = 0;
  for (const s of comp.shields) {
    const io = readItem(ports && Object.values(ports).flat().find((x) => x.cat === 'shield' && x.name === s.name)?.cls);
    const sp = io ? findType(io, 'SCItemShieldGeneratorParams') : null;
    const max = sp?.MaxShieldHealth ?? (io ? findKeyNum(io, 'MaxShieldHealth') : null);
    if (max) shieldHp += max * s.count;
  }
  if (shieldHp) stats.shield++;
  let qtSpeedMs = null, qtSpoolS = null, qtFuelReq = null;
  const qdCls = Object.values(ports).flat().find((x) => x.cat === 'quantum')?.cls;
  if (qdCls) {
    const io = readItem(qdCls);
    const params = io ? findKeyObj(io, 'driveSpeed') : null;
    if (params) { qtSpeedMs = params.driveSpeed ?? null; qtSpoolS = params.spoolUpTime ?? null; stats.qt++; }
    // quantumFuelRequirement sitzt am AEUSSEREN SCItemQuantumDriveParams-Objekt,
    // NICHT im inneren `.params` (das `driveSpeed` traegt) — eigene Suche noetig.
    qtFuelReq = io ? findKeyNum(io, 'quantumFuelRequirement') : null;
  }

  // --- Fracht: Gitter des Schiffs ---
  let cargoScu = LOAD.cargo?.[id] ?? null;
  if (cargoScu != null) stats.cargo++;

  // --- Treibstoff: Quantum- und Wasserstofftank (01.4-02, Gruppe B, Schritt 1) ---
  // Belegt am Buccaneer (qtnk 1,3 SCU, 2x htnk 3,75 SCU = 7,5) und an der Carrack
  // (qtnk 10,6 SCU, 2x htnk 180 SCU = 360) exakt gegen den Wiki-Bestand.
  let qtFuel = null;
  for (const t of qtFuelTanks) { const cap = tankCapacityScu(t.cls); if (cap != null) qtFuel = (qtFuel ?? 0) + cap * t.count; }
  if (qtFuel != null) { qtFuel = round(qtFuel, 2); stats.qtFuel++; }
  let h2Fuel = null;
  for (const t of h2FuelTanks) { const cap = tankCapacityScu(t.cls); if (cap != null) h2Fuel = (h2Fuel ?? 0) + cap * t.count; }
  if (h2Fuel != null) { h2Fuel = round(h2Fuel, 2); stats.h2Fuel++; }
  // qtRangeM: der Antriebs-Record selbst traegt keinen Reichweitenwert (`jumpRange`
  // ist ein Float-Sentinel 3.4e38, keine echte Zahl) — die Reichweite ist eine
  // Rechnung aus Tankgroesse / Verbrauch je Gm, wie im Spiel selbst (belegt am
  // Buccaneer: 1,3 / 0,010682 * 1e9 = 121.700.057.909 m, Wiki 121.700.056.169 m,
  // Abweichung < 0,000002 % — Rundung der Quelle, nicht falsche Formel).
  let qtRangeM = null;
  if (qtFuel != null && qtFuelReq) { qtRangeM = Math.round((qtFuel / qtFuelReq) * 1e9); stats.qtRange++; }

  // --- Erz: Bergbau-Pods (01.4-02, Gruppe B, oreSCU — nur 5 Fahrzeuge) ---
  let oreScu = null;
  for (const p of orePods) { const cap = tankCapacityScu(p.cls); if (cap != null) oreScu = (oreScu ?? 0) + cap * p.count; }
  if (oreScu != null) { oreScu = round(oreScu, 1); stats.ore++; }

  // --- Waffen-DPS (01.4-02, Gruppe A, Schritt 1) ---
  const withDps = (map) => [...map.values()].map((w) => ({ ...w, dps: weaponDps(w.cls) }));
  const pilotWithDps = withDps(pilot);
  const turretWithDps = withDps(turret);
  const sumDps = (ws) => (ws.length && ws.every((w) => w.dps != null) ? round(ws.reduce((s, w) => s + w.dps * w.count, 0), 1) : null);
  const pilotDps = sumDps(pilotWithDps);
  const turretDps = sumDps(turretWithDps);
  const missileCount = [...racks.values()].reduce((s, r) => s + r.count, 0) || null;

  // fixedWeaponSizes (01.4-02, Gruppe A, Schritt 4 — Urteilsfall, kein Suchfall):
  // Groesse steht bereits an jeder Pilotwaffe, die aggregierte Liste ist reine Rechnung.
  const sizeAgg = (ws) => {
    const m = new Map();
    for (const w of ws) { if (w.size == null) continue; m.set(w.size, (m.get(w.size) ?? 0) + w.count); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => ({ size, count }));
  };
  const fixedWeaponSizes = sizeAgg(pilotWithDps);

  // turrets[] (01.4-02, Gruppe A, Schritt 3): je Gattung Stationen (aus dem
  // Turm-Item-Record selbst, LOAD.turretStations — auch OHNE Stock-Waffe
  // gezaehlt) + Waffen + Groessen + DPS. payloadTypes bleibt leer: die
  // Turm-eigenen Port-Definitionen liegen NICHT im Ship-Record, sondern im
  // separaten Turm-Item — nicht mehr in der Abbruchgrenze dieses Plans
  // aufgeloest (benannte Luecke, s. Feldurteile).
  const TURRET_LABEL = { manned: 'Bemannte Türme', remote: 'Ferngesteuerte Türme', pdc: 'Punktverteidigung (PDC)' };
  const stationsByKind = { manned: 0, remote: 0, pdc: 0 };
  for (const s of LOAD.turretStations?.[id] ?? []) if (stationsByKind[s.turretKind] != null) stationsByKind[s.turretKind]++;
  const turrets = [];
  for (const kind of ['manned', 'remote', 'pdc']) {
    const stations = stationsByKind[kind];
    const wmap = turretByKind[kind];
    const weapons = wmap ? withDps(wmap) : [];
    if (!stations && !weapons.length) continue;
    turrets.push({
      label: TURRET_LABEL[kind],
      stations,
      sizes: sizeAgg(weapons),
      weapons: weapons.map(({ cls, ...w }) => w),
      payloadTypes: [],
      dps: sumDps(weapons),
    });
  }

  return {
    id,
    name: stripMfr(fullName),
    manufacturer: mfr?.name ?? null,
    makerCode,
    typeEn: locEn(veh?.vehicleCareer),
    typeDe: locDe(veh?.vehicleCareer),
    roleEn: locEn(veh?.vehicleRole),
    roleDe: locDe(veh?.vehicleRole),
    sizeClass,
    sizeDe: veh?.movementClass === 'Spaceship' ? SIZE_LABEL[sizeClass] ?? null : 'Fahrzeug',
    descriptionEn: locEn(veh?.vehicleDescription),
    descriptionDe: locDe(veh?.vehicleDescription),
    crew: veh?.crewSize ?? null,
    isGravlev: veh?.isGravlevVehicle ?? null,
    isSpaceship: veh?.movementClass === 'Spaceship',
    scmSpeed: ifcs?.scmSpeed ?? null,
    maxSpeed: ifcs?.maxSpeed ?? null,
    boostForward: ifcs?.boostSpeedForward ?? null,
    // maxAngularVelocity ist (pitch, roll, yaw) — NICHT (pitch, yaw, roll).
    // Gegenprobe Buccaneer: {49, 155, 42} = pitch 49, roll 155, yaw 42.
    pitch: round(ang?.x), yaw: round(ang?.z), roll: round(ang?.y),
    hullHp,
    shieldHp: shieldHp || null,
    qtSpeedMs, qtSpoolS, qtRangeM, qtFuel, h2Fuel,
    oreSCU: oreScu,
    cargoSCU: cargoScu != null ? Math.round(cargoScu) : null,
    insClaimMin: round(ins?.baseWaitTimeMinutes),
    insExpediteMin: round(ins?.mandatoryWaitTimeMinutes),
    insExpediteCost: ins?.baseExpeditingFee ?? null,
    pilotDps, turretDps,
    fixedWeapons: pilotWithDps.map(({ cls, ...w }) => w),
    fixedWeaponMounts: mounts,
    fixedWeaponSizes,
    turretWeapons: turretWithDps.map(({ cls, ...w }) => w),
    turrets,
    missileCount,
    missileRacks: [...racks.values()].map(({ cls, ...w }) => w),
    cmLaunchers,
    components: comp,
    gameVersion: GAME_VERSION,
  };
}

/** erste Zahl unter einem Schlüssel irgendwo im Baum */
function findKeyNum(o, key, d = 0) {
  if (!o || typeof o !== 'object' || d > 9) return null;
  if (Array.isArray(o)) { for (const v of o) { const r = findKeyNum(v, key, d); if (r != null) return r; } return null; }
  if (typeof o[key] === 'number') return o[key];
  for (const v of Object.values(o)) if (v && typeof v === 'object') { const r = findKeyNum(v, key, d + 1); if (r != null) return r; }
  return null;
}
/** erstes Objekt, das einen Schlüssel trägt */
function findKeyObj(o, key, d = 0) {
  if (!o || typeof o !== 'object' || d > 9) return null;
  if (Array.isArray(o)) { for (const v of o) { const r = findKeyObj(v, key, d); if (r) return r; } return null; }
  if (o[key] != null && typeof o[key] === 'number') return o;
  for (const v of Object.values(o)) if (v && typeof v === 'object') { const r = findKeyObj(v, key, d + 1); if (r) return r; }
  return null;
}

/* ---------------------------------------------------------------- */
/* Lauf                                                              */
/* ---------------------------------------------------------------- */
const external = existsSync(EXTERNAL) ? JSON.parse(readFileSync(EXTERNAL, 'utf8')) : { vehicles: {} };
const ids = ONLY ? [ONLY] : ourIds;
const out = [];
for (const id of ids) {
  const v = buildVehicle(id);
  if (!v) continue;
  const ext = external.vehicles?.[id] ?? {};
  out.push({ ...v, msrpUSD: ext.msrpUSD ?? null, pledgeUrl: ext.pledgeUrl ?? null, lengthM: ext.lengthM ?? null, widthM: ext.widthM ?? null, heightM: ext.heightM ?? null });
}
p4k.close();

console.log(`Fahrzeuge gebaut: ${out.length}/${ids.length}`);
console.log(`  Implementierungs-XML: ${stats.impl}   Hüllen-HP: ${stats.hull}`);
console.log(`  Flugwerte (IFCS):     ${stats.ifcs}`);
console.log(`  Schild-HP:            ${stats.shield}   Quantum: ${stats.qt}   Fracht: ${stats.cargo}`);
console.log(`  QT-Treibstoff:        ${stats.qtFuel}   QT-Reichweite: ${stats.qtRange}   H2-Treibstoff: ${stats.h2Fuel}   Erz: ${stats.ore}`);
if (stats.noRec.length) console.log(`  ohne DataCore-Record: ${stats.noRec.length} (${stats.noRec.join(', ')})`);

if (!ONLY) {
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    gameVersion: GAME_VERSION,
    source: 'Data.p4k — DataCore (Game2.dcb), Fahrzeug-Implementierungen (CryXmlB), InventoryContainer',
    external: 'src/data/vehicle-external.json (msrpUSD, pledgeUrl, Abmessungen — nicht in den Spieldateien)',
    count: out.length,
    vehicles: out,
  }, null, 2) + '\n', 'utf8');
  console.log(`-> ${OUT} geschrieben`);
} else {
  console.log(JSON.stringify(out[0], null, 1));
}
