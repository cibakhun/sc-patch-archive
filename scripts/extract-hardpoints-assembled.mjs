// Hardpoint-Extraktion für ZUSAMMENGESETZTE Schiffe (Teil-Assembly ohne eigene
// Hull-.cga) — Ergänzung zu extract-hardpoints.mjs.
//
// Hintergrund: Ein paar Schiffe haben KEINE einzelne Rumpf-.cga, sondern werden
// von der Entity aus einer Basis-Geometrie + Modulen zusammengesetzt (RSI Hermes
// sitzt z. B. auf dem Apollo-Airframe rsi_apollo.cga + Nacelles/Skycap/Caps).
// Die COMPILED_BONES der Basis-.cga liegen im Basis-LOKALraum, NICHT im
// zusammengesetzten Schiffsraum — der reguläre Extraktor (der eine Hull-.cga
// annimmt) findet für sie gar nichts.
//
// Lösung: StarBreaker `entity export --dump-hierarchy` liefert den ZUSAMMEN-
// GESETZTEN Knotenbaum mit `bone_to_world`-Transforms (Schiffsraum, identisch zum
// gebündelten GLB-Mesh) UND den `loadout`-Baum (welcher Port real bestückt ist).
// Wir nehmen genau die bestückten, sichtbaren Ports + ihre Welt-Position — das
// ist sogar loadout-genau (keine Apollo-Bones, die die Hermes gar nicht nutzt).
//
// Reihenfolge im Buildstep: NACH extract-hardpoints.mjs laufen lassen — dieses
// Skript MERGT nur die Assembly-Schiffe in den bestehenden Snapshot.
//
// Usage:  node scripts/extract-hardpoints-assembled.mjs [--dry]
// Voraussetzung (lokal, wie die StarBreaker-GLBs): StarBreaker-CLI + Data.p4k.
//   SC_STARBREAKER=<pfad zur starbreaker.exe>  (Default siehe unten)
//   SC_P4K=<pfad zur Data.p4k>
// Cache:  .cache/starbreaker-hier/<slug>.json  (gitignored, wie starbreaker-glb)
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3d';

const SNAP = new URL('../src/data/ship-hardpoints.json', import.meta.url);
const HIER_DIR = new URL('../.cache/starbreaker-hier/', import.meta.url);
const GLB_DIR = new URL('../.cache/starbreaker-glb/', import.meta.url);
const STARBREAKER = process.env.SC_STARBREAKER ?? 'G:/Projects/games/Star Citizen/tools/starbreaker-cli/starbreaker.exe';
const P4K = process.env.SC_P4K ?? 'F:/Games/Star Citizen/StarCitizen/LIVE/Data.p4k';
const DRY = process.argv.includes('--dry');

// Assembly-Schiffe: slug (vehicles.json id) -> StarBreaker-Entity-Name (Substring)
const ASSEMBLED = [
  { slug: 'rsi-hermes', entity: 'rsi_hermes' },
];

/* ---------- Klassifikation (identisch zu extract-hardpoints.mjs) ---------- */
const KINDS = [
  ['quantum', /quantum_?drive|hardpoint_quantum(?!_fuel)/i],
  ['power', /power_?plant/i],
  ['shield', /shield_?gen/i],
  ['cooler', /cooler/i],
  ['radar', /radar/i],
  ['fuel', /fuel_?(tank|intake|port)|quantum_fuel|hydrogen/i],
  ['thruster_main', /(main_?thruster|thruster_main|engine(?!er))/i],
  ['thruster_retro', /retro/i],
  ['thruster_vtol', /vtol/i],
  ['thruster_mav', /thruster/i],
  ['turret', /turret/i],
  ['missile', /missile|torpedo|bomb/i],
  ['weapon', /weapon|_gun(_|$)|cannon/i],
  ['countermeasure', /counter_?measure|cm_?launcher/i],
];
const CORE_KIND = new Set(['power', 'shield', 'cooler', 'quantum', 'radar']);
// Steuerpanels/Sekundär-Mounts sind keine verbauten Kern-Komponenten
const SECONDARY_HP = /controller|cockpit|gunner|co[_-]?pilot|_screen|screen|remote_|_turret_/i;
function kindOf(name) {
  if (!/^hardpoint/i.test(name)) return null;
  for (const [k, re] of KINDS) {
    if (!re.test(name)) continue;
    if (CORE_KIND.has(k) && SECONDARY_HP.test(name)) return null;
    return k;
  }
  return null;
}

/* ---------- Hierarchie holen (Cache -> StarBreaker) ---------- */
function loadHierarchy(slug, entity) {
  mkdirSync(HIER_DIR, { recursive: true });
  const file = new URL(`${slug}.json`, HIER_DIR);
  if (!existsSync(file)) {
    console.log(`  hierarchy fehlt -> StarBreaker entity export --dump-hierarchy ${entity}`);
    const r = spawnSync(STARBREAKER, ['entity', 'export', entity, fileURLToPath(file), '--p4k', P4K, '--dump-hierarchy'], { encoding: 'utf8' });
    if (r.status !== 0 || !existsSync(file)) throw new Error(`StarBreaker-Hierarchie fehlgeschlagen: ${r.stderr || r.status}`);
  }
  // StarBreaker gibt nicht-striktes JSON (Trailing Commas) aus
  const txt = readFileSync(file, 'utf8').replace(/,(\s*[\]}])/g, '$1');
  return JSON.parse(txt);
}

/* ---------- Welt-Positionen aller Knoten sammeln ---------- */
function nodePositions(hier) {
  const pos = new Map(); // node-name -> [x,y,z] (cry ship-space)
  const walk = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 40) return;
    const nm = o.node || o.name;
    const bw = o.bone_to_world;
    if (nm && Array.isArray(bw) && bw.length >= 3 && !pos.has(nm)) {
      pos.set(nm, [bw[0][3], bw[1][3], bw[2][3]]);
    }
    for (const v of Array.isArray(o) ? o : Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(hier);
  return pos;
}

/* ---------- bestückte, sichtbare Schiff-Ebenen-Ports -> Hardpoints ---------- */
function hardpointsFromLoadout(hier, entityName) {
  const pos = nodePositions(hier);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const out = [];
  const seen = new Set();
  for (const e of hier.loadout ?? []) {
    if (!e || e.invisible) continue;           // Controller etc. sind unsichtbar
    const port = e.port;
    if (!port || !/^hardpoint/i.test(port)) continue;
    const k = kindOf(port);
    if (!k) continue;
    const p = pos.get(port);
    if (!p) continue;                           // kein Transform -> nicht platzierbar
    if (seen.has(port)) continue;
    seen.add(port);
    out.push({ n: port, k, p: p.map(r3) });
  }
  return out;
}

/* ---------- Hull-AABB aus dem gebündelten GLB (cry-Raum) ---------- */
let io = null;
async function glbHull(slug) {
  const file = new URL(`${slug}.glb`, GLB_DIR);
  if (!existsSync(file)) { console.log(`  GLB fehlt (${slug}.glb) -> keine Hull, nutze Hardpoint-BBox`); return null; }
  if (!io) io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const doc = await io.read(fileURLToPath(file));
  // WELT-Bounds (Node-Transforms angewandt) — Primitiv-min/max allein liegen im
  // Teil-Lokalraum und ergäben eine verdrehte AABB
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const bb = getBounds(scene);
  const g = [bb.min, bb.max];
  if (!Number.isFinite(g[0][0])) return null;
  // glTF -> cry: cry_x=g_x, cry_y=-g_z, cry_z=g_y  (Inverse von [x,z,-y])
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return [
    [r3(g[0][0]), r3(-g[1][2]), r3(g[0][1])],
    [r3(g[1][0]), r3(-g[0][2]), r3(g[1][1])],
  ];
}

/* ---------- Hauptlauf ---------- */
const snap = JSON.parse(readFileSync(SNAP, 'utf8'));
console.log(`Snapshot: ${Object.keys(snap.ships).length} Schiffe (build ${snap.build})`);
const CORE = new Set(['power', 'shield', 'cooler', 'quantum', 'radar']);
let changed = 0;

for (const { slug, entity } of ASSEMBLED) {
  console.log(`\n${slug}  (entity ${entity})`);
  const hier = loadHierarchy(slug, entity);
  const hp = hardpointsFromLoadout(hier, entity);
  const hull = await glbHull(slug);
  // BBox über die Hardpoints (Kalibrier-Referenz-Fallback)
  const bbox = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (const h of hp) for (let k = 0; k < 3; k++) { bbox[0][k] = Math.min(bbox[0][k], h.p[k]); bbox[1][k] = Math.max(bbox[1][k], h.p[k]); }
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const core = hp.filter((h) => CORE.has(h.k)).length;
  const kinds = {};
  for (const h of hp) kinds[h.k] = (kinds[h.k] || 0) + 1;
  console.log(`  hardpoints: ${hp.length} (${core} core)  kinds=${JSON.stringify(kinds)}`);
  console.log(`  hull(cry): ${JSON.stringify(hull)}`);
  console.log(`  ports:`);
  for (const h of hp) console.log(`     ${h.n.padEnd(40)} ${h.k.padEnd(8)} (${h.p.join(', ')})`);

  snap.ships[slug] = {
    cga: hier.root?.geometry?.replace(/\\/g, '/') ?? null,
    match: `assembled:${entity}`,
    bones: (hier.root_nmc?.length ?? 0) + (hier.loadout?.length ?? 0),
    bbox: bbox.map((c) => c.map(r3)),
    hull,
    hp,
  };
  changed++;
}

if (DRY) { console.log('\n[--dry] Snapshot NICHT geschrieben.'); process.exit(0); }
snap.count = Object.keys(snap.ships).length;
await writeFile(SNAP, JSON.stringify(snap) + '\n', 'utf8');
console.log(`\nwrote src/data/ship-hardpoints.json (+${changed} Assembly-Schiffe, ${snap.count} gesamt)`);
