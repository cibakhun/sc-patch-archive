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
// NICHT im Spiel und deshalb aus src/data/vehicle-external.json (01.4-03,
// scripts/build-vehicle-external.mjs, einmalig aus dem Wiki-Snapshot vom
// 18.07.2026 eingefroren, VOR dem Tausch, D-17): msrpUSD, pledgeUrl (RSI-Store),
// lengthM/widthM/heightM (publizierte Abmessungen), image (fotografisches
// Material, keine Engine-Textur), crewMax (D-11/D-17, beide Extraktionswege
// Sackgassen), statusEn/statusDe (keine Ableitung unterscheidet die Javelin
// strukturell) und fociDe (roleEn/roleDe ist eine andere, gröbere Taxonomie,
// deckt nur 79/223 exakt). Alles andere kommt aus den Spieldateien. Die
// Fremddatei ist der sichtbare Rest — sie soll schrumpfen, nicht wachsen. Die
// Einmisch-Schleife unten übernimmt JEDES Feld, das die Fremddatei je Fahrzeug
// führt, nicht eine feste Liste — bleibt also richtig, wenn die Liste schrumpft.
//
// Zusätzlich übernimmt vehicle-external.json (Block `overrides`) die vier
// ARGO-ATLS-Varianten komplett aus dem Wiki-Snapshot (D-13): sie sind im
// DataCore keine /spaceships/- oder /groundvehicles/-Fahrzeug-Entity, sondern
// ein "Power Suit" (Character-Taxonomie) — s. Kommentar bei OVERRIDES unten.
//
// STAND 01.4-05 (der Tausch): schreibt jetzt ZWEI Dateien — die Zwischenstufe
// src/data/vehicles-gamefiles.json (gitignored, frischer Lauf) UND das
// ausgelieferte src/data/vehicles.json (committet). scripts/verify-vehicles.mjs
// vergleicht künftig genau diese zwei: den frischen Lauf gegen den zuletzt
// committeten Katalog — derselbe Zweck wie vorher (Feld-für-Feld-Vergleich vor
// dem Übernehmen), nur ist der Bezugspunkt nicht mehr die Wiki, sondern der
// eigene letzte Stand. sync-vehicles.mjs (Wiki-API) ist gelöscht (D-16).
//
// Patch-Rückgrat (patches[], D-19): diese Rechnung stand bis 01.4-05 in
// sync-vehicles.mjs und ist mit dessen Löschung hierher umgezogen (samt
// SPINE_ALIAS, unverändert) — s. Abschnitt PATCH-RÜCKGRAT unten.
//
// Aufruf: node scripts/datamine-vehicles.mjs [--p4k <Data.p4k>] [--ship <id>]
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
import { parseCryXml, findAll, findAllLive, applyModification } from './lib/cryxml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_GAMEFILES = resolve(__dirname, '..', 'src', 'data', 'vehicles-gamefiles.json');
const OUT_FINAL = resolve(__dirname, '..', 'src', 'data', 'vehicles.json');
const EXTERNAL = resolve(__dirname, '..', 'src', 'data', 'vehicle-external.json');
const PATCHES_DIR = resolve(__dirname, '..', 'src', 'data', 'patches');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const ONLY = argOf('--ship');
const norm = (s) => (s || '').replace(/\\/g, '/');
const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

/* ---------------------------------------------------------------- */
/* PATCH-RÜCKGRAT (01.4-05, D-19): umgezogen aus sync-vehicles.mjs,      */
/* UNVERÄNDERT (strip() + SPINE_ALIAS + Join-Regel). `patches[]` ist    */
/* KEINE Spieldaten-Angabe — sie verknüpft einen Katalog-Eintrag mit     */
/* jeder Patch-Seite, die ihn nennt (src/data/patches/*.json). Zieht    */
/* dieser Block mit dem Skript, das ihn berechnet hatte (sync-vehicles  */
/* .mjs, D-16), verlieren alle heute verknüpften Fahrzeuge ihre Archiv- */
/* Verweise — ein leeres patches:[] ist syntaktisch gültig, KEIN Fehler,*/
/* der beim Bauen auffiele. Deshalb: Rechnung zuerst umziehen, dann erst*/
/* (Task 3) das alte Skript löschen.                                    */
/* ---------------------------------------------------------------- */
const SPINE_MAKERS = ['rsi', 'drake', 'aegis', 'anvil', 'mirai', 'gatac', 'argo', 'misc', 'origin', 'crusader', 'esperia', 'kruger', 'banu', 'aopoa', 'vanduul'];
function stripSpine(name) {
  let n = (name || '').toLowerCase().replace(/["„“”‚‘’']/g, '').replace(/\s+/g, ' ').trim();
  for (const m of SPINE_MAKERS) if (n.startsWith(m + ' ')) n = n.slice(m.length + 1);
  return n;
}
const spine = new Map();
if (existsSync(PATCHES_DIR)) {
  for (const f of readdirSync(PATCHES_DIR).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(readFileSync(resolve(PATCHES_DIR, f), 'utf8'));
    for (const s of j.ships ?? []) {
      const k = stripSpine(s.name);
      if (!spine.has(k)) spine.set(k, new Set());
      spine.get(k).add(j.version);
    }
  }
}
// variant → base aliases: patch-data ships whose exact variant the catalog
// drops as unclassified — the base entry carries the spine link instead.
const SPINE_ALIAS = { 'atls ikti': 'atls' };
for (const [from, to] of Object.entries(SPINE_ALIAS)) {
  if (!spine.has(from)) continue;
  if (!spine.has(to)) spine.set(to, new Set());
  for (const p of spine.get(from)) spine.get(to).add(p);
}
/** Patch-Verknüpfung für ein gebautes Fahrzeug (Join-Schlüssel: der bereits
 *  manufacturer-gestrippte Anzeigename, s. D-19 — der Spieldaten-Katalog
 *  liefert denselben Namen wie der bisherige Wiki-Katalog). */
const spineFor = (name) => {
  const k = stripSpine(name);
  return spine.has(k) ? [...spine.get(k)].sort() : [];
};

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

// Ini-Format-Falle (01.4-03, D-08-Nachtrag, identisch zu datamine-crafting.mjs
// Zeile 88-90): Keys können ein ",P"-Suffix tragen (Platzhalter-/Grammatik-Flag,
// z. B. "vehicle_NameDRAK_Pitbull,P=Drake Pitbull") — beim Nachschlagen zählt der
// Key OHNE Suffix, sonst bleibt der Pitbull (und potenziell weitere Fahrzeuge)
// auf den rohen `id`-Fallback zurückfallen, weil @vehicle_NameDRAK_Pitbull ohne
// Komma-Suffix nie im Ini-Index steht.
const mkMap = (ini) => { const m = new Map(); if (!ini) return m; for (const line of ini.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) m.set(line.slice(0, i).replace(/^﻿/, '').toLowerCase().replace(/,p$/, ''), line.slice(i + 1).trim()); } return m; };
const EN = mkMap(iniEn), DE = mkMap(iniDe);
const BAD = /^@|PLACEHOLDER|LOC_EMPTY|\[PH\]|TRANSLATION NOT FOUND/;
const locFrom = (map, k) => { if (!k || typeof k !== 'string' || !k.startsWith('@')) return null; const v = map.get(k.slice(1).toLowerCase()); return v && !BAD.test(v) ? v : null; };
const locEn = (k) => locFrom(EN, k);
const locDe = (k) => locFrom(DE, k) ?? locEn(k);

// Spieltexte (descriptionEn/descriptionDe, 01.4-05, Task 2) tragen eine
// Metadaten-Kopfzeile ("Manufacturer: …\nFocus: …\n\n") und woertliche
// "\n"-Zeichenfolgen (Backslash+n als zwei Textzeichen, KEIN echtes
// Whitespace) statt echter Zeilenumbrueche. Die Kopfzeile ist im Datenblatt
// Dopplung (Hersteller und Rolle stehen bereits daneben) und wird
// abgeschnitten; die "\n"-Folgen werden zu echten Zeilenumbruechen gewandelt
// (Anzeige: ShipDetail.astro .sd__desc, white-space:pre-line). Bereinigt wird
// HIER, an der Quelle — nicht erst beim Anzeigen — weil die Abnahme den
// committeten vehicles.json-Rohwert prueft, nicht nur das gerenderte HTML.
const DESC_HEADER_RX = /^(?:Manufacturer|Hersteller)\s*:.*?\\n(?:Focus|Fokus)\s*:.*?(?:\\n)+/i;
function cleanDesc(s) {
  if (!s) return s;
  const cleaned = s.replace(DESC_HEADER_RX, '').replace(/\\n/g, '\n').trim();
  return cleaned || null;
}

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
/* Marken-Urteile (01.4-03, Task 2, Schritt 3 — D-22): manufacturer/makerCode  */
/* ---------------------------------------------------------------- */
// Drei Fälle, in denen das Spiel selbst zwei unterschiedliche Antworten gibt
// (Klassenpräfix der Entity vs. der Manufacturer-Record, den das Schiff
// referenziert) — KEIN Kürzel-Automatismus entscheidet das allein. Belegt
// (scratch/probe-mfr-suffix.mjs): eine globale Regel "nimm das Kürzel aus dem
// Lokalisierungsschlüssel des Manufacturer-Records" träfe 12 Fälle besser,
// aber 20 SCHLECHTER (Origin ORIG -> "ORIGIN", Greycat GLSN -> "GREY") — also
// keine Regel, sondern ein Urteil je Fall (Begründung: scratch/01.4-urteile-kosmetik.md).
const MFR_OVERRIDE = {
  // Esperia baut in der Spiel-Lore erbeutete/nachgebaute Vanduul-Schiffe.
  // Blade/Glaive/Stinger referenzieren im Spiel BEREITS den Esperia-
  // Manufacturer-Record (SCItemManufacturer.ESPR, Anzeigename "Esperia" —
  // 0 Abweichung bei `manufacturer`) — nur das Klassenpräfix (VNCL_*) ist
  // historisch die alte Vanduul-Kennung geblieben, `makerCode` folgt heute
  // fälschlich dem Präfix statt dem referenzierten Hersteller.
  'vncl-blade': { code: 'ESPR' },
  'vncl-glaive': { code: 'ESPR' },
  'vncl-stinger': { code: 'ESPR' },
  // Scythe referenziert dagegen (allein unter den vier VNCL-Schiffen) direkt
  // den älteren VNCL-Manufacturer-Record ("Vanduul"), nicht Esperia — für
  // Konsistenz mit den drei Geschwistern, dem Wiki, dem bereits vorhandenen
  // Logo-Datensatz (manufacturer-logos.json führt "Esperia", kein "Vanduul")
  // und dem Filterschlüssel data-maker wird die gesamte Gruppe auf den
  // Erbauer vereinheitlicht. Nebeneffekt: der volle Anzeigename lautet im
  // Spiel bereits "Vanduul Scythe" — mit mfr.name "Esperia" greift stripMfr()
  // (das "Vanduul "-Präfix passt nicht zu "Esperia") nicht mehr, der Name
  // bleibt "Vanduul Scythe" wie im Wiki (löst den `name`-Diff mit).
  'vncl-scythe': { name: 'Esperia', code: 'ESPR' },
  // Mirai ist im Spiel eine eigenständig referenzierte Untermarke von MISC
  // (SCItemManufacturer.MRAI, Anzeigename "Mirai" — 0 Abweichung bei
  // `manufacturer`); nur das Klassenpräfix (MISC_Fury/MISC_Razor) ist von der
  // Mutter geerbt. Der öffentliche RSI-Herstellercode folgt der Untermarke.
  // (Manufacturer.Code selbst trägt hier "MIS" — kollidiert mit MISCs eigenem
  // Code und ist damit kein brauchbarer Ersatz für "MRAI".)
  'misc-fury': { code: 'MRAI' },
  'misc-fury-lx': { code: 'MRAI' },
  'misc-fury-miru': { code: 'MRAI' }, // Klassenname MISC_Fury_Miru = "Fury MX"
  'misc-razor': { code: 'MRAI' },
  'misc-razor-ex': { code: 'MRAI' },
  'misc-razor-lx': { code: 'MRAI' },
  // Xian ist der interne Record-Name; "Aopoa" (0 Abweichung bei
  // `manufacturer`) ist die im Spiel wie im Wiki geführte Marke. Der
  // Wiki-Herstellercode "XNAA" ist das öffentliche RSI-Kürzel — im DataCore
  // NUR über den Lokalisierungsschlüssel des Manufacturer-Records
  // (@manufacturer_NameXNAA) sichtbar, nicht über Manufacturer.Code (dort
  // leer) oder den Klassennamen (XIAN_*).
  'xian-scout': { code: 'XNAA' }, // Klassenname XIAN_Scout = "Khartu-al"
  'xian-nox': { code: 'XNAA' },
  'xian-nox-kue': { code: 'XNAA' },
  // Banu Souli ist die im Wiki UND im bereits vorhandenen Logo-Datensatz
  // (manufacturer-logos.json führt "Banu Souli", kein rohes "Banu") geführte
  // Markenform für den Defender-Hersteller — spezifischer als der rohe
  // Manufacturer-Name "Banu", den das Spiel liefert. makerCode stimmt bereits
  // überein (BANU == BANU), nur der Anzeigename wird vereinheitlicht, damit
  // Logo-Zuordnung und data-maker-Filter treffen statt ins Leere zu zeigen.
  'banu-defender': { name: 'Banu Souli' },
};
// Kosmetik-Tabelle für `manufacturer` (Schreibweise, KEIN Marken-Urteil):
// benannte Einzel-Ersetzung statt globalem "&"->"and"-Suchen-und-Ersetzen —
// eine globale Regel würde einen künftigen Hersteller mit echtem "&" im Namen
// still beschädigen. Ziel ist die "and"-Schreibweise: sie steht schon im Wiki
// UND im bestehenden Logo-Datensatz (manufacturer-logos.json) — der
// bestehenden Quelle folgen, sonst verliert die MISC-Flotte (18 Schiffe) ihr
// Hersteller-Logo.
const MFR_NAME_COSMETIC = {
  'Musashi Industrial & Starflight Concern': 'Musashi Industrial and Starflight Concern',
};

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
  const mfrOverride = MFR_OVERRIDE[id];
  // Anzeigename des Herstellers: erst das per-Schiff-Urteil (Marken-Fälle,
  // s. o.), sonst der rohe Spielwert, danach die benannte Kosmetik-Ersetzung
  // (MISC "&" -> "and"). Reihenfolge wichtig: die Kosmetik-Tabelle greift
  // NUR auf den bereits aufgelösten Namen, nicht auf ein Override-Ergebnis.
  const mfrNameRaw = mfrOverride?.name ?? mfr?.name ?? null;
  const mfrName = MFR_NAME_COSMETIC[mfrNameRaw] ?? mfrNameRaw;
  const ports = LOAD.ships[id] ?? {};

  // --- Identität ---
  // Trailing-Zeilenumbruch-Falle (01.4-03, D-08-Nachtrag): manche Ini-Werte
  // tragen ein wörtliches "\n" (Backslash+n als zwei Textzeichen, KEIN echtes
  // Whitespace — `.trim()` in mkMap() greift hier nicht) als Rest eines
  // Mehrzeilen-Templates, z. B. "Argo CSV-SM\n". Bei Namen (anders als bei
  // descriptionEn/De, wo \n-Folgen bewusst erhalten bleiben, D-07) ist das
  // ein Datenrest, kein Gestaltungsmittel — wird entfernt.
  const fullNameRaw = locEn(veh?.vehicleName) ?? locEn(att.Localization?.Name) ?? id;
  const fullName = fullNameRaw ? fullNameRaw.replace(/\\n+\s*$/, '').replace(/^\s*\\n+/, '').trim() : fullNameRaw;
  // Anzeigename ohne Herstellerpräfix ("Drake Buccaneer" -> "Buccaneer"),
  // wie ihn die Seite bisher führt (der Hersteller steht daneben).
  // Der Herstellername steht im Datenblatt daneben — im Schiffsnamen ist er
  // Dopplung. Abgeschnitten wird das erste Wort des Herstellers
  // ("Drake Buccaneer"), sein Kürzel ("RSI Apollo Medivac") ODER ein aus den
  // Anfangsbuchstaben gebildetes, punktiertes Kürzel ("Consolidated Outland"
  // -> "C.O. HoverQuad", 01.4-03: das gebräuchliche Kürzel für Consolidated
  // Outland ist "C.O." mit Punkten, trifft keine der beiden ursprünglichen
  // Regeln).
  const initials = mfrName ? mfrName.split(/\s+/).filter(Boolean).map((w) => w[0]).join('.') + '.' : null;
  // WICHTIG: der Code-Kandidat ist das ROHE `mfr?.code` (Manufacturer.Code aus
  // dem DataCore-Record, meist dreistellig gekappt, z. B. "MIS" für Mirai UND
  // für die MISC-Mutter), NICHT das aufgelöste `makerCode` von unten. Der
  // Unterschied ist beabsichtigt: die MISC-Mutter selbst führt im Spiel
  // Manufacturer.Code="MIS" (drei Buchstaben, kein Leerzeichen-Treffer auf
  // "MISC Fortune") — würde hier stattdessen das vierstellige, aufgelöste
  // `makerCode` "MISC" verwendet, stripte das fälschlich das "MISC"-Präfix aus
  // Namen wie "MISC Fortune" heraus, die der Wiki-Bestand UNGEKÜRZT führt.
  const stripMfr = (s) => {
    if (!s) return s;
    const pre = [mfrName?.split(/\s+/)[0], mfr?.code, initials].filter(Boolean);
    for (const p of pre) {
      const rx = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
      if (rx.test(s)) return s.replace(rx, '').replace(/\s{2,}/g, ' ').trim();
    }
    return s.replace(/\s{2,}/g, ' ').trim();
  };
  const sizeClass = att.Size ?? null;
  // Herstellerkürzel: `Manufacturer.Code` ist im Spiel dreistellig gekappt
  // ("AEG", "MIS"), gebräuchlich und eindeutig ist das Präfix der Klasse
  // (AEGS_Gladius -> AEGS, MRAI_Fury -> MRAI). Das Präfix gewinnt — AUSSER das
  // per-Schiff-Urteil (MFR_OVERRIDE, s. o.) sagt etwas anderes (drei
  // Marken-Fälle: Esperia/Vanduul, Mirai/MISC, Xian/Aopoa, D-22).
  const clsPrefix = (rec.name || '').replace(/^EntityClassDefinition\./, '').split('_')[0];
  const makerCode = mfrOverride?.code ?? (/^[A-Z]{2,5}$/.test(clsPrefix) ? clsPrefix : mfr?.code ?? null);

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
      // Rule 1 (01.4-05): ein paar fest verbaute Kapitalschiff-Bauteile
      // (Idris/Javelin/Polaris-Radar, ROC-DS-Laser) referenzieren im Spiel
      // eine Item-Klasse ohne Shop-Lokalisierung (Klassenname traegt sogar
      // "_TEMP") — `it.name` ist dann `null`. Die Anzeige braucht trotzdem
      // einen Namen (Schema verlangt einen String); Rueckfall ist die rohe
      // Item-Klasse statt eines leeren Feldes, das die Astro-Content-Prüfung
      // ablehnt. Betrifft gemessen 9 Eintraege auf 227 Fahrzeugen.
      if (it.name == null && it.cls) it.name = it.cls;
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
  // Zaehlregel (01.4-04, D-20): mehr als zwei Schildgeneratoren desselben Typs
  // erhoehen NICHT die Gesamt-Schildstaerke — sie sind Redundanz (Backup, das
  // bei Ausfall des aktiven Generators einspringt), keine Kapazitaetsaddition.
  // Belegt an allen 32 Abweichungen vom 03.08.2026 (17x Verhaeltnis 1,5 bei 3
  // Generatoren, 13x 2,0 bei 4, 2x 3,0 bei 6 — Spielwert/Wiki-Wert ==
  // Generatoren/2 in JEDEM Fall, 0 Ausnahmen; Schiffe mit 1 oder 2 Generatoren
  // stimmen exakt). Gesucht, aber NICHT gefunden: ein expliziter Zahlenwert
  // "2" im DataCore (weder in SCItemShieldGeneratorParams noch in
  // SCItemShieldEmitterParams/ItemControllerComponentParams/
  // ItemControlComponentParams des Controller_Shield-Items — Ports[] dort
  // sogar leer, s. scratch/probe-shield-ports.mjs). Die Struktur STUETZT die
  // Redundanz-Deutung aber: jeder Generator traegt eigene
  // `ReservePool*Ratio`-Felder (Reserve-POOL, nicht addierte Kapazitaet) —
  // dennoch bleibt die "2" selbst eine aus der Messung abgeleitete Regel, kein
  // abgelesener Parameter (D-14, ehrlich benannt). Kein Schiff im Katalog
  // mischt zwei verschiedene Generator-Typen (0/227) — die Kappung je Gruppe
  // ist deshalb aequivalent zu einer Kappung je Schiff.
  //
  // AUSNAHME, gemessen statt vermutet: die Kappung gilt nur fuer Raumschiffe.
  // `tmbl-nova` (Bodenfahrzeug, `movementClass` "ArcadeWheeled") ist das
  // EINZIGE Fahrzeug im Katalog mit >2 Schildgeneratoren, das KEIN Raumschiff
  // ist (0/227 andere Bodenfahrzeuge haben ueberhaupt >2 Generatoren) — und
  // die Wiki fuehrt dort den vollen additiven Wert (2160 = 3x720), nicht den
  // gekappten (1440). Ohne diese Ausnahme wuerde die Kappung die einzige
  // bislang schon korrekte Bodenfahrzeug-Messung kaputt machen.
  let shieldHp = 0;
  const isSpaceshipVeh = veh?.movementClass === 'Spaceship';
  for (const s of comp.shields) {
    const io = readItem(ports && Object.values(ports).flat().find((x) => x.cat === 'shield' && x.name === s.name)?.cls);
    const sp = io ? findType(io, 'SCItemShieldGeneratorParams') : null;
    const max = sp?.MaxShieldHealth ?? (io ? findKeyNum(io, 'MaxShieldHealth') : null);
    if (max) shieldHp += max * (isSpaceshipVeh ? Math.min(s.count, 2) : s.count);
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

  const finalName = stripMfr(fullName);
  return {
    id,
    name: finalName,
    manufacturer: mfrName ?? null,
    makerCode,
    typeEn: locEn(veh?.vehicleCareer),
    typeDe: locDe(veh?.vehicleCareer),
    roleEn: locEn(veh?.vehicleRole),
    roleDe: locDe(veh?.vehicleRole),
    sizeClass,
    sizeDe: veh?.movementClass === 'Spaceship' ? SIZE_LABEL[sizeClass] ?? null : 'Fahrzeug',
    descriptionEn: cleanDesc(locEn(veh?.vehicleDescription)),
    descriptionDe: cleanDesc(locDe(veh?.vehicleDescription)),
    // Besatzung (D-17, 01.4-04): die Spanne bleibt auf dem Datenblatt.
    // `crewMin` kommt aus dem Spiel (`crewSize`) — Betriebsbesatzung, deckt
    // sich auf 223/223 gemessenen Fahrzeugen exakt mit der bisherigen
    // Wiki-`crewMin`. `crewMax` liefert NICHT dieses Skript, sondern die
    // Einmisch-Schleife unten aus vehicle-external.json (01.4-03, einmalig aus
    // dem Wiki-Snapshot eingefroren, 9 rückläufige Spannen bewusst ausgelassen
    // — betroffene Fahrzeuge tragen dann nur `crewMin`, keine künstlich
    // gleichgesetzte Spanne).
    crewMin: veh?.crewSize ?? null,
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
    // cls BLEIBT an fixedWeapons/turretWeapons (01.4-05, D-19, zweite tragende
    // Falle): scripts/verify-weapon-sizes.mjs joint künftig über die Klasse,
    // nicht über den Anzeigenamen — vier Items heißen "Revenant Gatling" in
    // vier Größen (display-name-not-a-key). Vorher wurde `cls` hier beim
    // Ausgeben entfernt; das ist die Zeile, die diese Grenze aufhob.
    fixedWeapons: pilotWithDps,
    fixedWeaponMounts: mounts,
    fixedWeaponSizes,
    turretWeapons: turretWithDps,
    turrets,
    missileCount,
    missileRacks: [...racks.values()].map(({ cls, ...w }) => w),
    cmLaunchers,
    components: comp,
    gameVersion: GAME_VERSION,
    // Patch-Rückgrat (D-19): umgezogen aus sync-vehicles.mjs, s. o.
    patches: spineFor(finalName),
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
const external = existsSync(EXTERNAL) ? JSON.parse(readFileSync(EXTERNAL, 'utf8')) : { vehicles: {}, overrides: {} };
const ids = ONLY ? [ONLY] : ourIds;
const out = [];
const builtIds = new Set();
for (const id of ids) {
  const v = buildVehicle(id);
  if (!v) continue;
  // Einmisch-Schleife (01.4-03): übernimmt ALLES, was die Fremddatei je Fahrzeug
  // führt, nicht eine feste Liste — bleibt so richtig, wenn die Liste aus Plan 02
  // schrumpft. Die zehn möglichen Felder (Kopfkommentar) sind bereits beim
  // Erzeugen von vehicle-external.json auf Nicht-Leere gefiltert; kein Feld hier
  // kollidiert mit einem von buildVehicle() gelieferten Schlüssel.
  const ext = external.vehicles?.[id] ?? {};
  out.push({ ...v, ...ext });
  builtIds.add(id);
}

// ATLS-Übernahmen (D-13, 01.4-03): vier Kennungen ohne DataCore-Record
// (stats.noRec) — genau hier, an derselben Stelle, an der buildVehicle() sie
// bisher stillschweigend übersprungen hat, kommen die aus dem Wiki-Snapshot
// übernommenen Volldatensätze aus vehicle-external.json (Block `overrides`)
// dazu. Ein `continue` ohne Ersatz war der Grund, warum der Katalog bislang
// 223 statt 227 führte.
let overridesAdded = 0;
for (const id of ids) {
  if (builtIds.has(id)) continue;
  const ov = external.overrides?.[id];
  if (!ov) continue;
  out.push(ov);
  overridesAdded++;
}
p4k.close();

console.log(`Fahrzeuge gebaut: ${out.length}/${ids.length}`);
console.log(`  Implementierungs-XML: ${stats.impl}   Hüllen-HP: ${stats.hull}`);
console.log(`  Flugwerte (IFCS):     ${stats.ifcs}`);
console.log(`  Schild-HP:            ${stats.shield}   Quantum: ${stats.qt}   Fracht: ${stats.cargo}`);
console.log(`  QT-Treibstoff:        ${stats.qtFuel}   QT-Reichweite: ${stats.qtRange}   H2-Treibstoff: ${stats.h2Fuel}   Erz: ${stats.ore}`);
if (stats.noRec.length) console.log(`  ohne DataCore-Record: ${stats.noRec.length} (${stats.noRec.join(', ')})`);
if (overridesAdded) console.log(`  aus vehicle-external.json übernommen (ATLS): ${overridesAdded}`);
const patchLinked = out.filter((v) => Array.isArray(v.patches) && v.patches.length).length;
console.log(`  Patch-Rückgrat (patches[]): ${patchLinked} Fahrzeuge verknüpft`);

if (!ONLY) {
  const snapshot = {
    // fetchedAt/gameVersion: dieselben Feldnamen wie zuvor der Wiki-Snapshot
    // (drei Anzeigestellen lesen sie unverändert, s. schiffe.astro/ShipDetail
    // .astro) — nur der Inhalt wechselt: kein Wiki-Abrufdatum mehr, sondern der
    // Tag dieses Extraktionslaufs gegen die lokale Data.p4k.
    fetchedAt: new Date().toISOString().slice(0, 10),
    gameVersion: GAME_VERSION,
    source: 'Data.p4k — DataCore (Game2.dcb), Fahrzeug-Implementierungen (CryXmlB), InventoryContainer',
    external: 'src/data/vehicle-external.json (msrpUSD, pledgeUrl, Abmessungen, image, crewMax, statusEn/De,'
      + ' fociDe — nicht in den Spieldateien; plus vier komplett übernommene ATLS-Datensätze, D-13)',
    count: out.length,
    vehicles: out,
  };
  const payload = JSON.stringify(snapshot, null, 2) + '\n';
  // Zwischenstufe (gitignored, immer frisch) — scripts/verify-vehicles.mjs
  // vergleicht sie künftig gegen das ausgelieferte vehicles.json (s. Kopf).
  writeFileSync(OUT_GAMEFILES, payload, 'utf8');
  console.log(`-> ${OUT_GAMEFILES} geschrieben`);
  // Ausgeliefert (committet) — der eigentliche Tausch (01.4-05).
  writeFileSync(OUT_FINAL, payload, 'utf8');
  console.log(`-> ${OUT_FINAL} geschrieben`);
} else {
  console.log(JSON.stringify(out[0], null, 1));
}
