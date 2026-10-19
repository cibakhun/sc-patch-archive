// datamine-missile-racks.mjs — Raketen-, Torpedo- und Bombenhalter je Schiffsport:
// welcher Halter serienmaessig sitzt und welche Halter das Spiel dort zulaesst.
// Ausgabe: src/data/ship-missile-racks.json
//   ships: { <schiff-id>: { <port>: { rack, min, max, fit[] } } }
//   racks: { <halter-klasse>: { name, size, n, ms, types[] } }
//
// WOFUER: die Layout-Werkstatt im Hangar tauscht Halter. ship-loadouts.json
// kennt nur die Raketen unter dem Serien-Halter, nicht den Halter selbst und
// nicht, was an seinen Port passt.
//
// PORTS: Port-Schluessel wie in ship-loadouts.json (klein). Sitzt der Halter
// nicht direkt am Schiff, sondern unter einem Turm oder Modul (Ballista,
// Storm AA, Cyclone, F7C-M Mk II, Polaris-Fernturm, 890 Jump, MOTH, Nova,
// Starlancer TAC), ist der Schluessel der Pfad "<schiffsport>/<traegerport>"
// und `carrier` nennt den Traeger: dessen Ports bestimmen, was passt.
// `locked`: der Port traegt das Flag uneditable — im Spiel nicht tauschbar.
//
// PASSREGEL — so wie das Spiel ein Item an einen Port laesst. Port-Definition
// aus der Fahrzeug-Implementierungs-XML (<ItemPort>, Variante samt patchFile)
// bzw. bei Traegern aus deren SItemPortContainerComponentParams.Ports:
//   1. Typ: ein Port-<Type> nennt genau AttachDef.Type und, falls er Untertypen
//      listet, AttachDef.SubType. Es gibt keine Typ-Hierarchie (EItemType ist
//      flach): GroundVehicleMissileLauncher passt nicht an MissileLauncher.
//   2. Groesse: minSize <= AttachDef.Size <= maxSize.
//   3. Die requiredTags des Ports stehen alle in AttachDef.Tags des Halters.
//   4. Die AttachDef.RequiredTags des Halters stehen alle in den angebotenen
//      Tags: portTags des Ports + itemPortTags des Fahrzeugs (<Vehicle>) bzw.
//      die Container-PortTags des Traegers.
//   Ein fuehrendes "$" zaehlt beim Vergleich nicht ("$ORIG_400i_Missile" ==
//   "ORIG_400i_Missile"). Gemessen am Serien-Loadout (jeder Serien-Halter muss
//   an seinem eigenen Port zugelassen sein): mit "$" woertlich 393/483, ohne
//   478/483; die Differenz sind ausschliesslich schiffseigene Halter an ihrem
//   eigenen Schiff (400i, 600i, Apollo, Eclipse …). Dass Tags eines Ports an
//   Ports darunter weitergereicht werden, aendert an keiner Liste etwas und ist
//   deshalb nicht modelliert. Die 5 Rest-Faelle sind Widersprueche im Spiel
//   selbst (Serien-Loadouts werden nicht geprueft): Ballista-Turm links S5
//   (Port MissileLauncher, Halter GroundVehicleMissileLauncher; die drei
//   Geschwister-Ports nennen GroundVehicleMissileLauncher) und Cyclone MT
//   (Modulport MissileLauncher/MissileRack, Serie ist der GMRCK-Bodenhalter).
//
// Aufruf: node scripts/datamine-missile-racks.mjs [--p4k <Data.p4k>] [--audit] [--ship <id>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { preferGoldStandard } from './lib/vehicle-records.mjs';
import { openDataCore } from './lib/datacore.mjs';
import { parseCryXml, findAll, findAllLive, applyModification } from './lib/cryxml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'src', 'data', 'ship-missile-racks.json');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const AUDIT = argv.includes('--audit');
const ONLY = argOf('--ship');
const P4K = argOf('--p4k') ?? DEFAULT_P4K;
const norm = (s) => (s || '').replace(/\\/g, '/');
const words = (s) => (typeof s === 'string' ? s.split(/\s+/).filter(Boolean) : []);
const attrCI = (attrs, key) => { const k = Object.keys(attrs).find((x) => x.toLowerCase() === key.toLowerCase()); return k ? attrs[k] : undefined; };
const numOrNull = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const findType = (o, rx) => { let r; (function w(x){ if(r!==undefined||!x||typeof x!=='object')return; if(x.__type&&rx.test(x.__type)){r=x;return;} for(const [k,v] of Object.entries(x)){ if(k==='__type')continue; if(v&&typeof v==='object')w(v);} })(o); return r; };

// gameVersion wie datamine-vehicles.mjs: build_manifest.id neben der p4k.
let GAME_VERSION = null;
{
  const bm = resolve(dirname(P4K), 'build_manifest.id');
  if (existsSync(bm)) {
    try {
      const d = JSON.parse(readFileSync(bm, 'utf8'))?.Data;
      if (d?.Branch && d?.RequestedP4ChangeNum) GAME_VERSION = `${d.Branch}@${d.RequestedP4ChangeNum}`;
    } catch { /* bleibt null */ }
  }
}

const p4k = openP4k(P4K);
const db = openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i));
const iniEn = p4k.read(/Localization[\\/]english[\\/]global\.ini$/i).toString('utf8');
// Implementierungs-XMLs MIT Unterordner: die Varianten-Patches liegen unter
// Implementations/Xml/Modifications/ (patchFile, s. readImpl).
const implIdx = new Map();
for (const e of p4k.entries(/Implementations.Xml.*\.xml$/i)) implIdx.set(norm(e.name).toLowerCase(), e);

const EN = new Map();
for (const line of iniEn.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) EN.set(line.slice(0, i).replace(/^\uFEFF/, '').toLowerCase().replace(/,p$/, ''), line.slice(i + 1).trim()); }
const loc = (k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const v = EN.get(k.slice(1).toLowerCase()); return v && !/^@|PLACEHOLDER|LOC_EMPTY/.test(v) ? v : null; };

const recByNameIdx = new Map();
for (const r of db.records) { const n = r.name || ''; if (n && !recByNameIdx.has(n)) recByNameIdx.set(n, r); }
const recByName = (nm) => nm ? (recByNameIdx.get(nm) || recByNameIdx.get('EntityClassDefinition.' + nm)) : null;
function resolveEntryRecord(entry) {
  if (entry.entityClassReference?.__ref) { const r = db.recordById.get(entry.entityClassReference.__ref); if (r) return r; }
  if (entry.entityClassName) { const r = recByName(entry.entityClassName); if (r) return r; }
  if (entry.entityClassReference?.name) return recByName(entry.entityClassReference.name);
  return null;
}
const entriesOf = (x) => Array.isArray(x?.loadout?.entries) ? x.loadout.entries : [];
const clsOf = (r) => (r.name || '').replace(/^EntityClassDefinition\./, '');

/* ---- Portdefinitionen: eine Form fuer XML- und DataCore-Ports ---- */
// { min, max, types: [{type, sub[]}], flags[], requiredTags[], portTags[] }
function xmlPort(ip) {
  return {
    min: numOrNull(attrCI(ip.attr, 'minSize')),
    max: numOrNull(attrCI(ip.attr, 'maxSize')),
    types: findAll(ip, 'Type')
      .map((t) => ({ type: attrCI(t.attr, 'type') ?? '', sub: (attrCI(t.attr, 'subtypes') ?? '').split(',').map((s) => s.trim()).filter(Boolean) }))
      .filter((t) => t.type),
    flags: words(ip.attr.flags),
    requiredTags: words(attrCI(ip.attr, 'requiredTags')),
    portTags: words(attrCI(ip.attr, 'portTags')),
  };
}
function dcPort(p) {
  return {
    min: numOrNull(p.MinSize),
    max: numOrNull(p.MaxSize),
    types: (p.Types ?? []).map((t) => ({ type: t?.Type ?? '', sub: (t?.SubTypes ?? []).filter((s) => s && s !== 'UNDEFINED') })).filter((t) => t.type),
    flags: words(p.Flags),
    requiredTags: words(p.RequiredPortTags),
    portTags: words(p.PortTags),
    hasDefault: !!p.defaultItem?.entityClass,
  };
}

/* ---- Fahrzeug-Implementierung samt Variante ---- */
const bufCache = new Map();
function implBuf(path) {
  const key = ('data/' + norm(path)).toLowerCase();
  if (!bufCache.has(key)) {
    const base = key.split('/').pop();
    const e = implIdx.get(key) ?? [...implIdx].find(([k]) => !k.includes('/modifications/') && k.endsWith('/' + base))?.[1];
    let buf = null;
    try { buf = e ? p4k.extract(e) : null; } catch { buf = null; }
    bufCache.set(key, buf);
  }
  return bufCache.get(key);
}
// patchFile einer <Modification> (Implementations/Xml/<patchFile>.xml, Wurzel
// <Modifications>): jedes oberste Kind ersetzt den Basisknoten mit derselben id
// (F7C-M, 350r, Freelancer DUR/MAX/MIS: <Parts id="xmlParts">; Vanguard
// Sentinel: das ganze <Vehicle id="modVehicle">). Zwei Patches tragen eine id,
// die es in der Basis nicht gibt (Vanguard Harbinger "modParts") — dann trifft
// der gleichnamige Knoten direkt unter der Wurzel. Ohne Patch sehen diese
// Varianten die Raketenports des Basisschiffs.
function applyPatch(root, patch) {
  const byId = new Map(), parentOf = new Map();
  (function w(n) { if (n.attr.id && !byId.has(n.attr.id)) byId.set(n.attr.id, n); for (const c of n.children) { parentOf.set(c, n); w(c); } })(root);
  for (const c of patch.children) {
    const target = (c.attr.id && byId.get(c.attr.id)) || (root.tag === c.tag ? root : root.children.find((x) => x.tag === c.tag));
    if (!target) continue;
    if (target === root) { root = c; continue; }
    const p = parentOf.get(target);
    p.children[p.children.indexOf(target)] = c;
  }
  return root;
}
function readImpl(path, modName) {
  const buf = implBuf(path);
  if (!buf) return { root: null, mod: 'xml-fehlt' };
  let root = parseCryXml(buf);
  if (!modName) return { root, mod: null };
  const mod = findAll(root, 'Modification').find((m) => (m.attr.name || '').toLowerCase() === String(modName).toLowerCase());
  if (!mod) return { root, mod: 'variante-fehlt' };
  let status = 'ok';
  if (mod.attr.patchFile) {
    const pbuf = implBuf(`scripts/entities/vehicles/implementations/xml/${mod.attr.patchFile}.xml`);
    if (pbuf) root = applyPatch(root, parseCryXml(pbuf));
    else status = 'patch-fehlt';
    // Die <Elem>-Aenderungen der Variante gelten danach; ersetzte der Patch die
    // Wurzel, haengt die <Modification> wieder an, damit applyModification sie findet.
    if (!findAll(root, 'Modification').includes(mod)) root.children.push(mod);
  }
  applyModification(root, modName);
  return { root, mod: status };
}
function implPorts(root) {
  const out = new Map();
  for (const part of findAllLive(root, 'Part')) {
    const ip = part.children.find((c) => c.tag === 'ItemPort');
    const key = (part.attr.name || '').toLowerCase();
    if (ip && key && !out.has(key)) out.set(key, xmlPort(ip));
  }
  return out;
}

/* ---- Halter-Katalog ---- */
// Halter = Item, dessen AttachDef einer dieser Typ/Untertyp-Paare ist.
const RACK_KINDS = new Set(['MissileLauncher/MissileRack', 'BombLauncher/BombRack', 'GroundVehicleMissileLauncher/GroundVehicleMissileRack']);
// Ein Raketenplatz ist ein Port, der Munition aufnimmt; die Polaris-Torpedohalter
// tragen zusaetzlich einen AttachedPart-Port (Klappe), der kein Platz ist.
const AMMO = /^(Missile|Bomb)$/;
const itemCache = new Map();
function itemOf(rec) {
  if (itemCache.has(rec.id)) return itemCache.get(rec.id);
  const o = db.readRecord(rec, { maxDepth: 8, typed: true });
  const a = findType(o, /^SAttachableComponentParams$/)?.AttachDef ?? {};
  const cont = findType(o, /^SItemPortContainerComponentParams$/);
  const it = {
    rec, cls: clsOf(rec), file: norm(rec.fileName),
    kind: `${a.Type}/${a.SubType}`, size: a.Size ?? null,
    tags: words(a.Tags), req: words(a.RequiredTags), name: loc(a.Localization?.Name),
    containerTags: words(cont?.PortTags),
    ports: new Map((cont?.Ports ?? []).filter((p) => p?.Name).map((p) => [String(p.Name).toLowerCase(), dcPort(p)])),
  };
  itemCache.set(rec.id, it);
  return it;
}
const ECD = db.records.filter((r) => db.structs[r.structIndex]?.name === 'EntityClassDefinition');
const allRacks = ECD.filter((r) => /\/scitem\//i.test(norm(r.fileName))).map(itemOf).filter((it) => RACK_KINDS.has(it.kind));
const rackById = new Map(allRacks.map((it) => [it.rec.id, it]));
// Nicht als Tausch-Kandidat: Platzhalter- und KI-Fassungen, die kein Spieler
// besitzt. Als SERIEN-Halter werden sie trotzdem erkannt (rackById oben).
const NOT_PLAYER = /_TEMP_|PUDefenseTurret|_Derelict/i;
const candidates = allRacks.filter((it) => !NOT_PLAYER.test(it.cls));

const slotsOf = (it) => [...it.ports.values()].filter((p) => p.types.some((t) => AMMO.test(t.type)));
function rackEntry(it) {
  const slots = slotsOf(it);
  const types = [...new Set(slots.flatMap((p) => p.types.filter((t) => AMMO.test(t.type)).flatMap((t) => (t.sub.length ? t.sub.map((s) => `${t.type}.${s}`) : [t.type]))))].sort();
  const ms = slots.length ? Math.max(...slots.map((p) => p.max ?? 0)) : null;
  return { name: it.name ?? it.cls, size: it.size, n: slots.length, ms, types };
}

/* ---- Passregel (s. Kopf) ---- */
const tagKey = (t) => t.replace(/^\$/, '');
function fits(port, offered, it) {
  const [type, sub] = it.kind.split('/');
  if (!port.types.some((t) => t.type === type && (!t.sub.length || t.sub.includes(sub)))) return false;
  if (port.min != null && it.size < port.min) return false;
  if (port.max != null && it.size > port.max) return false;
  const have = new Set(it.tags.map(tagKey));
  if (!port.requiredTags.every((t) => have.has(tagKey(t)))) return false;
  const off = new Set([...offered].map(tagKey));
  return it.req.every((t) => off.has(tagKey(t)));
}

/* ---- Schiffe (dieselbe Auswahl wie datamine-ship-loadouts.mjs) ---- */
const hp = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', 'ship-hardpoints.json'), 'utf8')).ships;
const LO = JSON.parse(readFileSync(resolve(__dirname, '..', 'src', 'data', 'ship-loadouts.json'), 'utf8'));
const isVariantJunk = (f) => /_ai_|_pu_|_test|_template|_dummy|_unmanned|_hijacked|_turretless|_debug|_showdown_scramble|_swarm|_simpod|_modifiers/i.test(f);
const shipRecs = ECD.filter((r) => /\/(spaceships|groundvehicles)\/[^/]+\.xml$/i.test(norm(r.fileName)) && !isVariantJunk(norm(r.fileName)));
const recId = (r) => clsOf(r).toLowerCase().replace(/_/g, '-');
const byId = new Map();
for (const r of shipRecs) { const id = recId(r); if (!byId.has(id)) byId.set(id, r); }
const gsMoved = preferGoldStandard(byId);
if (gsMoved.length) console.log(`Gold-Standard-Record statt Altfassung: ${gsMoved.join(', ')}`);

/* ---- Lauf ---- */
const ships = {};
const used = new Set();
const unresolved = [], stockMisfit = [], modIssues = [];
const idsToDo = ONLY ? [ONLY] : Object.keys(hp);
for (const id of idsToDo) {
  const rec = byId.get(id);
  if (!rec) continue;
  const o = db.readRecord(rec, { maxDepth: 20, typed: true });
  const veh = findType(o, /^VehicleComponentParams$/);
  const { root, mod } = veh?.vehicleDefinition ? readImpl(veh.vehicleDefinition, veh.modification) : { root: null, mod: null };
  if (mod && mod !== 'ok') modIssues.push(`${id}: ${mod} (${veh.modification})`);
  const shipPorts = root ? implPorts(root) : new Map();
  const shipItem = itemOf(rec);
  const vehTags = [...words(root ? attrCI(root.attr, 'itemPortTags') : ''), ...shipItem.containerTags];
  const out = {};
  // Serien-Loadout ablaufen; ein Halter beendet den Ast (darunter haengen Raketen).
  (function walk(entries, path, carrier) {
    for (const e of entries) {
      if (!e?.itemPortName) continue;
      const r = resolveEntryRecord(e);
      const portName = String(e.itemPortName).toLowerCase();
      const port = carrier ? carrier.ports.get(portName) : (shipPorts.get(portName) ?? shipItem.ports.get(portName));
      const offered = new Set([...(port?.portTags ?? []), ...(carrier ? carrier.containerTags : vehTags)]);
      const rack = r ? rackById.get(r.id) : null;
      if (rack) {
        const key = [...path, portName].join('/');
        if (!port) { unresolved.push(`${id}: ${key} (${rack.cls})`); continue; }
        const fit = candidates.filter((c) => fits(port, offered, c)).map((c) => c.cls).sort();
        if (!fit.includes(rack.cls)) stockMisfit.push({ id, key, rack: rack.cls, port, offered: [...offered], tags: rack.tags, req: rack.req });
        for (const c of fit) used.add(c);
        used.add(rack.cls);
        out[key] = { rack: rack.cls, min: port.min, max: port.max, fit, ...(port.flags.some((f) => /^\$?uneditable$/i.test(f)) ? { locked: true } : {}), ...(carrier ? { carrier: carrier.cls } : {}) };
        continue;
      }
      if (r) walk(entriesOf(e), [...path, portName], itemOf(r));
    }
  })(entriesOf(findType(o, /SEntityComponentDefaultLoadoutParams/)), [], null);
  if (Object.keys(out).length) ships[id] = out;
}
p4k.close();

const rackByCls = new Map(allRacks.map((it) => [it.cls, it]));
const racks = {};
for (const cls of [...used].sort()) racks[cls] = rackEntry(rackByCls.get(cls));

/* ---- Audit ---- */
const portCount = Object.values(ships).reduce((s, p) => s + Object.keys(p).length, 0);
console.log(`\n=== UMFANG ===\nSchiffe mit Halter: ${Object.keys(ships).length}  Ports: ${portCount} (davon unter Traeger: ${Object.values(ships).flatMap((p) => Object.values(p)).filter((p) => p.carrier).length})  Halter im Katalog: ${Object.keys(racks).length} (von ${allRacks.length} Halter-Records, ${candidates.length} Tausch-Kandidaten)`);
console.log(`ohne Anzeigenamen (Klasse als Name): ${[...used].filter((c) => !rackByCls.get(c).name).join(', ') || 'keine'}`);
console.log(`\n=== SELBSTPROBE: Serien-Halter an seinem eigenen Port zugelassen ===\n${portCount - stockMisfit.length} / ${portCount}`);
for (const m of stockMisfit) console.log(`  NICHT: ${m.id} ${m.key} ${m.rack} | Port types=${JSON.stringify(m.port.types)} ${m.port.min}-${m.port.max} req=[${m.port.requiredTags}] portTags=[${m.port.portTags}] angeboten=[${m.offered}] | Halter tags=[${m.tags}] req=[${m.req}]`);
console.log(`\nohne Portdefinition: ${unresolved.length}${unresolved.length ? '\n  ' + unresolved.join('\n  ') : ''}`);
console.log(`Varianten-Probleme: ${modIssues.length}${modIssues.length ? '\n  ' + modIssues.join('\n  ') : ''}`);

// Gegenprobe gegen ship-loadouts.json: Plaetze x Groesse der Serien-Halter
// gegen die Raketen, die dort unter demselben obersten Port stehen.
const dev = [];
let compared = 0;
for (const [id, ports] of Object.entries(ships)) {
  const byTop = new Map();
  for (const [key, p] of Object.entries(ports)) {
    const top = key.split('/')[0];
    const it = rackByCls.get(p.rack);
    const acc = byTop.get(top) ?? { slots: [] };
    acc.slots.push(...slotsOf(it));
    byTop.set(top, acc);
  }
  for (const [top, exp] of byTop) {
    compared++;
    const ms = (LO.ships[id]?.[top] ?? []).filter((x) => x.cat === 'missile');
    const n = ms.reduce((s, x) => s + x.count, 0);
    // fehlende Grenze = offen, wie in der Passregel oben
    const sizeOk = ms.every((x) => exp.slots.some((s) => (s.min == null || x.size >= s.min) && (s.max == null || x.size <= s.max)));
    if (n === exp.slots.length && sizeOk) continue;
    // Ein leerer Schiffs-Eintrag fuellt sich aus den Plaetzen des Halters selbst
    // (Ports[].defaultItem) — Eclipse/Gladiator-Schaechte. ship-loadouts.json
    // liest nur die Eintraege am Schiff und sieht diese Bestueckung nicht.
    const own = n === 0 ? exp.slots.filter((s) => s.hasDefault).length : 0;
    const range = [...new Set(exp.slots.map((s) => (s.min === s.max ? `S${s.max}` : `S${s.min}-${s.max}`)))].join('/');
    dev.push(`${id} ${top}: Halter ${exp.slots.length}x ${range || '-'} | Loadout ${n}x ${[...new Set(ms.map((x) => 'S' + x.size))].join('/') || '-'}${own ? ` | Halter bestueckt ${own} Plaetze selbst (defaultItem), ship-loadouts.json sieht das nicht` : ''}`);
  }
}
console.log(`\n=== GEGENPROBE ship-loadouts.json (${LO.generatedAt}) ===\nverglichen: ${compared} Ports, Abweichungen: ${dev.length}${dev.length ? '\n  ' + dev.join('\n  ') : ''}`);

if (!AUDIT && !ONLY) {
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), source: 'DataCore Game2.dcb (SEntityComponentDefaultLoadoutParams, SItemPortContainerComponentParams) + Fahrzeug-Implementierungs-XML (ItemPort)', gameVersion: GAME_VERSION, ships, racks }, null, 0));
  console.log(`\n-> ${OUT} geschrieben`);
} else {
  console.log('\n(Audit-Modus: keine Datei geschrieben)');
}
