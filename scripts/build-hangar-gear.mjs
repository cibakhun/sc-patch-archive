// Fahrwerk der Hangar-Flotte (.planning/notes/hangar-flotte.md, Teil B):
// Aufstandspunkte je Schiff und eine Geometrie-Fassung mit ausgefahrenem,
// eingefedertem Fahrwerk.
//
// Spielseite: VehicleComponentParams.landingSystem (VehicleLandingGearSystem)
// nennt je Bein den Helfer-Knochen am Schiff, die Geometrie (.cdf) und die
// Feder (lengthTarget = Länge im gelandeten Zustand, lengthMin/Max, offset =
// Ursprung der Feder im Raum des Helfers). Höhe des Aufstands = Welt(Helfer) ·
// (offset + (0, 0, −lengthTarget)), y; die seitlichen Anteile des offset sind
// keine Lage (Carrack: links −2 m, rechts gespiegelt +2 m nach innen), x/z
// kommen deshalb vom tiefsten Punkt des Beins in der Geometrie.
//
// Geometrie: Rohexport .cache/hangar-src/ships/<slug>.glb (entity export,
// Ruhelage der Modelle = Fahrwerk ausgefahren, ungefedert). Die Primitive
// teilen sich einen Vertex-Puffer: gemessen wird nur über die Indizes.
// Einfederung: jedes Bein wird starr gesenkt bzw. gehoben, bis sein tiefster
// Punkt auf der Aufstandshöhe des Spiels liegt (das Spiel federt über das
// Mannequin-Fragment „Compress“; dessen Gelenkkette baut hier niemand nach).
//
// Ausgabe:
//   public/hangar/geo/<slug>.glb      ohne Innenraum, dezimiert, Draco; Raum
//                                     wie public/holo/ (Hardpoints auf 1 mm)
//   src/data/hangar-assets.json       gear.<slug>, geo.<slug>
//
// Usage: node scripts/build-hangar-gear.mjs [--only a,b] [--no-geo] [--force]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, flatten, join, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync, openSync, readSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
import { parseCryXmlNodes } from './lib/cryxml.mjs';
import { readCaf, readDba, sample, sampleRot } from './lib/ivo-caf.mjs';

const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const ONLY = arg('--only')?.split(',').filter(Boolean) ?? null;
const NO_GEO = argv.includes('--no-geo');
const FORCE = argv.includes('--force');
const RAW = process.env.HANGAR_SHIPS ?? fileURLToPath(new URL('../.cache/hangar-src/ships/', import.meta.url));
const OUT = process.env.HANGAR_GEO_OUT ?? fileURLToPath(new URL('../public/hangar/geo/', import.meta.url));
const MANIFEST = process.env.HANGAR_MANIFEST ?? fileURLToPath(new URL('../src/data/hangar-assets.json', import.meta.url));
const REPORT = process.env.HANGAR_GEAR_REPORT ?? fileURLToPath(new URL('../.cache/hangar-src/gear-report.json', import.meta.url));
// Geometrie-Fassung: Silhouette mit Fahrwerk; alle zusammen rund 90 MB
const TARGET_TRIS = Number(process.env.GEO_TRIS ?? 80000);
const r3 = (v) => Math.round(v * 1000) / 1000;

// ─── Spieldaten ─────────────────────────────────────────────────────────
const p4k = openP4k(DEFAULT_P4K); const dcb = p4k.read(/^Data[\\/]Game2\.dcb$/i);
const db = openDataCore(dcb);
const byName = new Map(db.records.map((r) => [r.name, r]));
function gameGear(record) {
  const rec = byName.get(`EntityClassDefinition.${record}`);
  if (!rec) return { error: `Record ${record} fehlt` };
  const o = db.readRecord(rec, { maxDepth: 4, typed: true });
  const vc = (o.Components || []).find((c) => c?.__type === 'VehicleComponentParams');
  const v3 = (p) => (p ? [p.x, p.y, p.z].map(r3) : null);
  const ls = vc?.landingSystem?.__ref ? db.recordById.get(vc.landingSystem.__ref) : null;
  const lso = ls ? db.readRecord(ls, { maxDepth: 8, typed: true }) : null;
  return {
    landingSystem: ls?.name?.replace(/^VehicleLandingGearSystem\./, '') ?? null,
    fragments: lso ? { name: lso.fragment, deploy: lso.fragmentDeploy, retract: lso.fragmentRetract, compress: lso.fragmentCompress } : null,
    landingOffset: v3(vc?.landingOffset), landingRotationOffset: v3(vc?.landingRotationOffset),
    gears: (lso?.gears || []).filter(Boolean).map((g) => ({
      bone: g.bone, geometry: g.geometry?.path ?? null, alwaysVisible: !!g.alwaysVisible,
      spring: g.spring ? { target: g.spring.lengthTarget, min: g.spring.lengthMin, max: g.spring.lengthMax, offset: [g.spring.offset?.x || 0, g.spring.offset?.y || 0, g.spring.offset?.z || 0], springBone: g.spring.springBone || null } : null,
    })),
  };
}

// ─── Animation des Beins ────────────────────────────────────────────────
// .cdf -> Model File (.chr) -> <chr>.chrparams: $TracksDatabase (.dba) und die
// Animationsnamen. Mannequin (z. B. ARGO_MPUV_LandingGearAnims.adb): Deploy =
// extend, Retract = extend rückwärts, Compress = compress. Die .dba hält je
// .caf einen Block, Knochen über CRC32 des Namens; die Knoten des Rohexports
// tragen die relative Ruhelage der .chr, die Spuren gelten im selben Raum.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pathRe = (p) => new RegExp(`(^|[\\\\/])${esc(p.replace(/\\/g, '/')).replace(/\//g, '[\\\\/]')}$`, 'i');
const xmlAttrs = (buf) => (buf.toString('latin1', 0, 7) === 'CryXmlB' ? parseCryXmlNodes(buf).map((n) => ({ tag: n.tag, a: n.attr || {} })) : [...buf.toString('utf8').matchAll(/<(\w+)\b([^>]*)>/g)].map((m) => ({ tag: m[1], a: Object.fromEntries([...m[2].matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]])) })));
const animCache = new Map();
function legAnims(cdfPath) {
  if (animCache.has(cdfPath)) return animCache.get(cdfPath);
  let out = null;
  try {
    const rel = (p) => `Data/${String(p).replace(/\\/g, '/').replace(/^data\//i, '')}`;
    // .cdf: Charakter -> .chr -> .chrparams daneben; .cga/.cgf: .chrparams neben der Geometrie
    let paramsPath;
    if (/\.cdf$/i.test(cdfPath)) {
      const chr = xmlAttrs(p4k.read(pathRe(rel(cdfPath)))).find((n) => n.tag === 'Model')?.a.File;
      if (!chr) throw new Error('.cdf ohne Model');
      paramsPath = rel(chr).replace(/\.chr$/i, '.chrparams');
    } else paramsPath = rel(cdfPath).replace(/\.(cga|cgf)$/i, '.chrparams');
    const anims = xmlAttrs(p4k.read(pathRe(paramsPath))).filter((n) => n.tag === 'Animation').map((n) => n.a);
    const dbaPath = anims.find((a) => a.name === '$TracksDatabase')?.path;
    const dir = anims.find((a) => a.name === '#filepath')?.path ?? '';
    const pick = (re) => anims.find((a) => re.test(a.name || '') && !/retract/i.test(a.name || '') && /\.caf$/i.test(a.path || ''));
    const ext = pick(/extend|deploy/i), comp = pick(/compress/i);
    // „*“: alle .caf der Datenbank (Reclaimer); Wahl je Bein nach Knochen
    if (!ext && dbaPath && anims.some((a) => a.name === '*')) out = { src: dbaPath, all: readDba(p4k.read(pathRe(rel(dbaPath)))) };
    else if (!ext) out = { error: 'keine extend-Animation' };
    else if (dbaPath) {
      const dba = readDba(p4k.read(pathRe(rel(dbaPath))));
      const block = (a) => (a ? dba.find((b) => b.name?.toLowerCase().endsWith(String(a.path).toLowerCase().replace(/\\/g, '/'))) ?? null : null);
      out = { src: dbaPath, extend: block(ext), compress: block(comp), extendName: ext.name, compressName: comp?.name ?? null };
    } else {
      // einzelne .caf (z. B. Polaris: .cga-Beine)
      const caf = (a) => { if (!a) return null; const c = readCaf(p4k.read(pathRe(rel(`${dir}/${a.path}`)))); return { name: a.path, bones: c.bones }; };
      out = { src: dir, extend: caf(ext), compress: caf(comp), extendName: ext.name, compressName: comp?.name ?? null };
    }
  } catch (e) { out = { error: e.message }; }
  animCache.set(cdfPath, out);
  return out;
}
// Endlage des Ausfahrens je Knochen und Kanal. Belegt: das letzte Bild von
// extend ist gleich dem ersten von compress (Gladius, Prospector: jede
// Drehung). Ist eine Spur nicht lesbar (Position 0xC1), kommt der Wert aus der
// anderen. Zeitformat 0x40 trägt keine lesbare Zeitspur, die Werte selbst
// schon: Anfang und Ende brauchen keine Zeiten.
const endOf = (ch, first) => (ch?.values ? (first ? ch.values[0] : ch.values[ch.values.length - 1]) : null);
function deployedPose(ext, comp) {
  const out = new Map();
  const put = (hash, k, v) => { if (!v) return; const e = out.get(hash) || {}; if (!e[k]) e[k] = v; out.set(hash, e); };
  for (const b of ext?.bones || []) { put(b.hash, 'q', endOf(b.rot, false)); put(b.hash, 't', endOf(b.pos, false)); }
  for (const b of comp?.bones || []) { put(b.hash, 'q', endOf(b.rot, true)); put(b.hash, 't', endOf(b.pos, true)); }
  const need = new Set([...(ext?.bones || [])].flatMap((b) => [b.rot && `${b.hash}q`, b.pos && `${b.hash}t`]).filter(Boolean));
  const miss = [...need].filter((k) => !out.get(k.slice(0, -1))?.[k.slice(-1)]);
  return { pose: out, missing: miss.length, missingRot: miss.filter((k) => k.endsWith('q')).length };
}
// compress zum Anteil f der Spur (Zeiten, wo lesbar; sonst gleichmäßig)
function compressAt(comp, f) {
  const out = new Map();
  for (const b of comp?.bones || []) {
    const e = {};
    for (const [k, ch] of [['q', b.rot], ['t', b.pos]]) {
      if (!ch?.values) continue;
      const times = ch.times ?? ch.values.map((_, i) => i);
      const at = f * times[times.length - 1];
      e[k] = k === 'q' ? sampleRot({ times, values: ch.values }, at) : sample({ times, values: ch.values }, at);
    }
    out.set(b.hash, e);
  }
  return out;
}
function applyPose(pose, nodes) {
  const byHash = new Map(nodes.map((n) => [(crc32(Buffer.from(n.getName())) >>> 0).toString(16), n]));
  let hit = 0;
  for (const [hash, e] of pose) {
    const n = byHash.get(hash); if (!n) continue;
    if (e.q) n.setRotation(e.q);
    if (e.t) n.setTranslation(e.t);
    hit++;
  }
  return hit;
}

// ─── Geometrie ──────────────────────────────────────────────────────────
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
// wie build-holo-meshes: Deko ohne Silhouetten-Wert
const DROP = /decal|damage|livery|_light|light_|glass|window|interior|proxy|shadow|_lod[1-9]|emissive|sticker|logo|stencil|_dmg|^dmg_|debris|nodraw|helper/i;
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
function invert(m) {
  const inv = new Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  return inv.map((v) => v / det);
}
// Weltmatrix mit Kreis-Schutz: in zwei Exporten (Hornet F7C-R, CSV-Cargo)
// hängt ein Knoten im Kreis, gltf-transforms getWorldMatrix läuft dann endlos
const CYCLIC = new Set();
function worldOf(n) {
  const chain = []; const seen = new Set();
  for (let p = n; p; p = p.getParentNode()) { if (seen.has(p)) { CYCLIC.add(n.getName()); return null; } seen.add(p); chain.push(p); }
  let m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let i = chain.length - 1; i >= 0; i--) m = mul(m, chain[i].getMatrix());
  return m;
}
const ap = (m, v) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * (v[3] ?? 1));

// tiefster Punkt eines Teilbaums (nur über Indizes erreichbare Ecken)
function lowest(nodes) {
  let best = null;
  const e = [0, 0, 0];
  for (const n of nodes) {
    const m = n.getMesh(); if (!m) continue;
    const W = worldOf(n); if (!W) continue;
    for (const p of m.listPrimitives()) {
      const a = p.getAttribute('POSITION'), idx = p.getIndices(); if (!a) continue;
      const seen = new Uint8Array(a.getCount());
      const list = idx ? idx.getArray() : Array.from({ length: a.getCount() }, (_, i) => i);
      for (const i of list) {
        if (seen[i]) continue; seen[i] = 1;
        a.getElement(i, e);
        const y = W[1] * e[0] + W[5] * e[1] + W[9] * e[2] + W[13];
        if (!best || y < best[1]) best = [W[0] * e[0] + W[4] * e[1] + W[8] * e[2] + W[12], y, W[2] * e[0] + W[6] * e[1] + W[10] * e[2] + W[14]];
      }
    }
  }
  return best;
}
const subtree = (n) => { const out = []; n.traverse((x) => out.push(x)); return out; };

// Ebene y = a·x + b·z + c durch die Punkte (kleinste Quadrate), Neigung in Grad
function plane(pts) {
  if (pts.length < 3) return { tilt: [0, 0], ground: pts.length ? r3(pts.reduce((s, p) => s + p[1], 0) / pts.length) : null };
  let sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0; const n = pts.length;
  for (const [x, y, z] of pts) { sx += x; sz += z; sy += y; sxx += x * x; szz += z * z; sxz += x * z; sxy += x * y; szy += z * y; }
  const A = [[sxx, sxz, sx], [sxz, szz, sz], [sx, sz, n]], B = [sxy, szy, sy];
  const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(A);
  if (Math.abs(D) < 1e-9) return { tilt: [0, 0], ground: r3(sy / n) };
  const col = (k) => A.map((row, i) => row.map((v, j) => (j === k ? B[i] : v)));
  const a = det3(col(0)) / D, b = det3(col(1)) / D, c = det3(col(2)) / D;
  // quer = Drehung um die Längsachse (z), längs = um die Querachse (x)
  return { tilt: [r3((Math.atan(a) * 180) / Math.PI), r3((Math.atan(b) * 180) / Math.PI)], ground: r3(c) };
}

async function oneShip(slug, meta) {
  const game = gameGear(meta.record);
  const doc = await io.read(`${RAW}${slug}.glb`);
  const root = doc.getRoot();
  // Innenraum und Deko weg (wie die Holo-Fassung)
  for (const scene of root.listScenes()) for (const top of scene.listChildren()) for (const c of top.listChildren()) if (/^interior_/i.test(c.getName())) { c.traverse((n) => n.setMesh(null)); top.removeChild(c); }
  for (const node of root.listNodes()) if (node.getMesh() && DROP.test(node.getName() || '')) node.setMesh(null);
  const byLower = new Map(root.listNodes().map((n) => [n.getName().toLowerCase(), n]));
  const legs = [];
  const gearNodes = new Set();
  // Knoten, die unter mehreren Beinen zugleich hängen (Sabre, Star Runner: zwei
  // Beine mit exakt gleich tiefem „Fuß“), zählen für kein Bein
  const owners = new Map();
  for (const h of new Set((game.gears || []).map((g) => byLower.get(String(g.bone).toLowerCase())).filter(Boolean))) { for (const c of h.listChildren()) for (const x of subtree(c)) owners.set(x, (owners.get(x) || 0) + 1); }
  for (const g of game.gears || []) {
    const h = byLower.get(String(g.bone).toLowerCase());
    if (!h) { legs.push({ bone: g.bone, missing: 'Helfer fehlt im Export' }); continue; }
    const kids = h.listChildren().filter((c) => subtree(c).some((x) => x.getMesh()));
    const parts = kids.flatMap(subtree).filter((x) => owners.get(x) === 1);
    parts.forEach((x) => gearNodes.add(x));
    const s = g.spring || { target: 0, max: 0, offset: [0, 0, 0] };
    // springBone: die Feder misst von diesem Knochen aus (Eclipse: „body“,
    // Reclaimer: hardpoint_spring_*), sonst vom Helfer des Beins
    const sb = s.springBone ? byLower.get(String(s.springBone).toLowerCase()) : null;
    const W = worldOf(sb || h) ?? worldOf(h);
    const yAt = (len) => ap(W, [s.offset[0], s.offset[1], s.offset[2] - len])[1];
    const leg = { bone: g.bone, node: h, kids, parts, helper: ap(worldOf(h), [0, 0, 0]), springFrom: sb ? s.springBone : g.bone, foot: lowest(parts), game: { y: yAt(s.target), yMax: yAt(s.max) }, spring: s, geometry: g.geometry, from: 'ruhelage' };
    // Ruhelage eingefahren (Fuß mehr als 0,5 m über dem Aufstand): letztes Bild
    // der extend-Animation, wenn jede Spur lesbar ist und der Fuß danach
    // höchstens 0,6 m vom Aufstand des Spiels liegt; sonst bleibt das Bein, wie es ist
    // Geometrie des Beins: Knoten unter dem Helfer (das Spiel nennt bei der
    // Polaris für alle drei Beine dieselbe Front.cga), Ordner aus dem Spiel
    const geoNode = parts.find((n) => /\.(cdf|cga|cgf)$/i.test(n.getName()));
    leg.geometry = geoNode && g.geometry ? (/[\\/]/.test(geoNode.getName()) ? geoNode.getName() : `${g.geometry.replace(/[^/\\]+$/, '')}${geoNode.getName()}`) : g.geometry;
    if (leg.foot && leg.foot[1] > leg.game.y + 0.5 && leg.geometry) {
      let an = legAnims(leg.geometry);
      if (an?.all) {
        const hashes = new Set(parts.map((n) => (crc32(Buffer.from(n.getName())) >>> 0).toString(16)));
        const best = (re) => an.all.filter((b) => re.test(b.name || '') && !/retract/i.test(b.name || '')).map((b) => [b, b.bones.filter((x) => hashes.has(x.hash)).length]).filter(([, k]) => k > 0).sort((p, q) => q[1] - p[1])[0]?.[0] ?? null;
        const e = best(/extend|deploy/i), c = best(/compress/i);
        an = e ? { src: an.src, extend: e, compress: c, extendName: e.name.split('/').pop(), compressName: c?.name.split('/').pop() ?? null } : { error: 'keine extend-Animation für dieses Bein' };
      }
      const dp = an?.extend ? deployedPose(an.extend, an.compress) : null;
      if (!an?.extend) leg.animError = an?.error ?? 'keine Animation';
      // fehlen nur Positionen (Format 0xC1), gelten die lesbaren Kanäle; die
      // übrigen behalten die Ruhelage, die Prüfung unten entscheidet
      else if (dp.missingRot) leg.animError = `${dp.missingRot} Drehungen ohne lesbare Endlage (${an.extendName})`;
      else {
        const keep = parts.map((n) => [n, n.getTranslation().slice(), n.getRotation().slice()]);
        applyPose(dp.pose, parts);
        let f2 = lowest(parts);
        leg.from = an.extendName + (dp.missing ? ` (${dp.missing} Positionen in Ruhelage)` : '');
        // Einfederung über compress: Anteil suchen, bei dem der Fuß auf der
        // Aufstandshöhe des Spiels steht (Halbierung); Kanäle ohne lesbare
        // compress-Spur bleiben in der Endlage des Ausfahrens
        if (f2 && f2[1] < leg.game.y && an.compress) {
          let lo = 0, hi = 1, best = null;
          for (let it = 0; it < 14; it++) {
            const mid = (lo + hi) / 2;
            applyPose(dp.pose, parts); applyPose(compressAt(an.compress, mid), parts);
            const fm = lowest(parts);
            if (!fm) break;
            best = [mid, fm];
            if (fm[1] < leg.game.y) lo = mid; else hi = mid;
          }
          if (best) { applyPose(dp.pose, parts); applyPose(compressAt(an.compress, best[0]), parts); f2 = best[1]; leg.from = `${an.extendName} + ${an.compressName} ${r3(best[0])}`; }
        }
        if (f2 && Math.abs(f2[1] - leg.game.y) <= 0.6) leg.foot = f2;
        else { for (const [n, t, r] of keep) n.setTranslation(t).setRotation(r); leg.animError = `nach ${leg.from} Fuß bei ${f2 ? r3(f2[1]) : '?'}, Aufstand ${r3(leg.game.y)}`; leg.from = 'ruhelage'; }
      }
    }
    legs.push(leg);
  }
  // Rumpf ohne Fahrwerk
  const hullNodes = root.listNodes().filter((n) => n.getMesh() && !gearNodes.has(n));
  const hull = lowest(hullNodes);
  // Steht ein Helfer mehrfach im Landesystem (Avenger: Hinterbeine mit zwei
  // Federn), zählt der Eintrag, dessen Feder am besten zur Geometrie passt
  const bestOf = new Map();
  for (const l of legs.filter((x) => x.foot)) { const b = bestOf.get(l.node); if (!b || Math.abs(l.game.y - l.foot[1]) < Math.abs(b.game.y - b.foot[1])) bestOf.set(l.node, l); }
  const withGeo = [...bestOf.values()];
  // ausgefahren: jeder Fuß höchstens 0,5 m über dem Aufstand des Spiels
  const down = (l) => l.foot[1] <= l.game.y + 0.5;
  let pose, why = null, contacts;
  if (!game.gears?.length) {
    pose = 'keins';
    why = game.landingSystem ? 'Landesystem ohne Beine' : 'kein Landesystem im Spiel (setzt auf Rumpf, Kufen oder Rädern auf)';
  } else if (!withGeo.length) {
    pose = 'keins'; why = 'Fahrwerk im Export ohne Geometrie';
  } else if (withGeo.every(down)) pose = 'aus';
  else { pose = 'ein'; why = withGeo.filter((l) => !down(l)).map((l) => `${l.bone}: ${l.animError ?? 'eingefahren'}`).join('; '); }
  // Einfederung: Bein starr auf die Aufstandshöhe des Spiels
  const shifts = [];
  if (pose === 'aus') for (const l of withGeo) {
    const dy = l.game.y - l.foot[1];
    if (Math.abs(dy) < 1e-4) continue;
    // mehr als 0,6 m ist keine Einfederung: Spielhöhe und Geometrie passen
    // nicht zusammen (Star Runner 5,7 m, Prowler 5,2 m); dann bleibt das Bein,
    // und der Aufstand kommt vom Fuß der Geometrie
    if (Math.abs(dy) > 0.6) { l.mismatch = r3(dy); continue; }
    for (const k of l.kids) {
      const parentW = worldOf(l.node);
      const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, dy, 0, 1];
      k.setMatrix(mul(mul(mul(invert(parentW), T), parentW), k.getMatrix()));
    }
    shifts.push(r3(dy));
    l.foot = [l.foot[0], l.foot[1] + dy, l.foot[2]];
  }
  // auch „ein“: Höhe aus der Feder des Spiels, damit das Schiff richtig hoch
  // steht; die Beine der Geometrie-Fassung bleiben dann eingefahren
  // Höhe immer aus der Feder des Spiels: Beine, deren Geometrie mehr als 0,6 m
  // abweicht (Gelenkteile wie foot_flap_a der Sabre in anderer Stellung),
  // bleiben unverschoben und stehen mit ihren Teilen in below
  const geoOnly = withGeo.some((l) => l.mismatch != null);
  if (pose === 'aus' || pose === 'ein') contacts = withGeo.map((l) => [r3(l.foot[0]), r3(l.game.y), r3(l.foot[2])]);
  else contacts = lowestClusters(hullNodes);
  // ohne Fahrwerk: waagrecht auf den tiefsten Punkt (die Ebene durch die tiefsten
  // Ecken je Viertel kippte Schweber und Schiffe mit Antennen bis 49°)
  const pl = pose === 'keins' ? { tilt: [0, 0], ground: contacts.length ? Math.min(...contacts.map((p) => p[1])) : null } : plane(contacts);
  // Teile, die mehr als 2 cm unter die Aufstandsebene reichen (bewegliche
  // Flossen, Antennen …): je Knoten die größte Tiefe, die zehn tiefsten
  const below = [];
  if (pl.ground != null) {
    const a = Math.tan((pl.tilt[0] * Math.PI) / 180), b = Math.tan((pl.tilt[1] * Math.PI) / 180), e = [0, 0, 0];
    for (const n of root.listNodes()) {
      const m = n.getMesh(); if (!m) continue;
      const W = worldOf(n); if (!W) continue; let worst = 0;
      for (const p of m.listPrimitives()) { const acc = p.getAttribute('POSITION'), idx = p.getIndices(); if (!acc) continue; const list = idx ? idx.getArray() : null;
        const cnt = list ? list.length : acc.getCount();
        for (let k = 0; k < cnt; k++) { acc.getElement(list ? list[k] : k, e); const x = W[0] * e[0] + W[4] * e[1] + W[8] * e[2] + W[12], y = W[1] * e[0] + W[5] * e[1] + W[9] * e[2] + W[13], z = W[2] * e[0] + W[6] * e[1] + W[10] * e[2] + W[14]; const d = a * x + b * z + pl.ground - y; if (d > worst) worst = d; } }
      if (worst > 0.02) below.push({ node: n.getName(), depth: r3(worst), gear: gearNodes.has(n) });
    }
    below.sort((p, q) => q.depth - p.depth);
  }
  const out = {
    pose, ...(why ? { why } : {}), contacts, ground: pl.ground, tilt: pl.tilt,
    below: below.slice(0, 10), belowCount: below.length,
    source: pose === 'aus' ? (geoOnly ? 'Feder des Spiels (lengthTarget) für die Höhe, x/z vom Bein; einzelne Beine weichen in der Geometrie ab (legs[].mismatch, below)' : 'Feder des Spiels (lengthTarget) für die Höhe, tiefster Punkt je Bein für x/z') : pose === 'ein' ? 'Feder des Spiels für die Höhe; Fahrwerk der Geometrie-Fassung eingefahren (siehe why), x/z vom eingefahrenen Bein' : 'tiefste Punkte des Rumpfs',
    game: {
      landingSystem: game.landingSystem, landingOffset: game.landingOffset, landingRotationOffset: game.landingRotationOffset,
      legs: legs.map((l) => ({ bone: l.bone, ...(l.missing ? { missing: l.missing } : { pose: l.from, ...(l.animError ? { animError: l.animError } : {}), ...(l.mismatch != null ? { mismatch: l.mismatch } : {}), foot: l.foot ? l.foot.map(r3) : null, y: r3(l.game.y), yMax: r3(l.game.yMax), spring: { target: r3(l.spring.target), min: r3(l.spring.min ?? 0), max: r3(l.spring.max), offset: l.spring.offset.map(r3) } }) })),
      compress: shifts.length ? shifts : null,
    },
    hullLowest: hull ? r3(hull[1]) : null,
  };
  return { out, doc };
}

// tiefste Punkte ohne Fahrwerk: je Viertel der Grundfläche der tiefste Punkt
function lowestClusters(nodes) {
  const pts = [];
  const e = [0, 0, 0];
  for (const n of nodes) { const m = n.getMesh(); if (!m) continue; const W = worldOf(n); if (!W) continue;
    for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), idx = p.getIndices(); if (!a) continue; const used = idx ? new Set(idx.getArray()) : null;
      for (let i = 0; i < a.getCount(); i++) { if (used && !used.has(i)) continue; a.getElement(i, e); pts.push([W[0] * e[0] + W[4] * e[1] + W[8] * e[2] + W[12], W[1] * e[0] + W[5] * e[1] + W[9] * e[2] + W[13], W[2] * e[0] + W[6] * e[1] + W[10] * e[2] + W[14]]); } } }
  if (!pts.length) return [];
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  const best = new Map();
  for (const p of pts) { const k = `${p[0] < cx ? 'l' : 'r'}${p[2] < cz ? 'v' : 'h'}`; const b = best.get(k); if (!b || p[1] < b[1]) best.set(k, p); }
  return [...best.values()].map((p) => p.map(r3));
}

async function writeGeo(slug, doc) {
  const root = doc.getRoot();
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { p.setMaterial(null); for (const sem of p.listSemantics()) if (sem !== 'POSITION' && sem !== 'NORMAL') p.setAttribute(sem, null); }
  for (const mat of root.listMaterials()) mat.dispose();
  for (const tex of root.listTextures()) tex.dispose();
  await doc.transform(prune(), flatten(), dedup(), join({ keepNamed: false }), weld());
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), idxAcc = prim.getIndices();
    // nur Dreiecke: Linien/Punkte oder nicht durch 3 teilbare Indizes lässt der Dezimierer nicht zu
    if (!pos || !idxAcc || prim.getMode() !== 4 || idxAcc.getCount() % 3) continue;
    const positions = Float32Array.from(pos.getArray()), indices = Uint32Array.from(idxAcc.getArray());
    const share = TARGET_TRIS * 3 * (indices.length / Math.max(1, root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((s, q) => s + (q.getIndices()?.getCount() ?? 0), 0)));
    if (indices.length > share) {
      let outIdx;
      for (const err of [8e-4, 1.5e-3, 2.5e-3, 4e-3, 6e-3, 1e-2, 2e-2]) { [outIdx] = MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, Math.min(indices.length, Math.max(30, Math.floor(share / 3) * 3)), err); if (outIdx.length <= share * 1.15) break; }
      if (outIdx && outIdx.length >= 30) idxAcc.setArray(Uint32Array.from(outIdx));
    }
  }
  await doc.transform(prune(), draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 8 }));
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  mkdirSync(OUT, { recursive: true });
  const f = `${OUT}${slug}.glb`;
  await io.write(f, doc);
  let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
  return { url: `/hangar/geo/${slug}.glb`, tris: Math.round(tris), bytes: statSync(f).size, v: createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8) };
}

// ─── Lauf ───────────────────────────────────────────────────────────────
const holo = JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/holo-meshes.json', import.meta.url)), 'utf8')).meshes;
const slugs = (ONLY ?? Object.keys(holo)).sort();
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
manifest.gear ??= {}; manifest.geo ??= {};
const report = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : {};
let n = 0;
for (const slug of slugs) {
  n++;
  const metaF = `${RAW}${slug}.json`;
  if (!existsSync(metaF) || !existsSync(`${RAW}${slug}.glb`)) {
    report[slug] = { error: 'kein Rohexport' };
    manifest.gear[slug] ??= { pose: 'offen', why: 'kein Rohexport: das Schiff liegt über der Speichergrenze des Exports (24 GB) oder fehlt im Rohbestand', contacts: [], ground: null, tilt: [0, 0] };
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`[${n}/${slugs.length}] ${slug}: kein Rohexport`); continue; }
  const meta = JSON.parse(readFileSync(metaF, 'utf8'));
  const geoF = `${OUT}${slug}.glb`;
  if (!FORCE && manifest.gear[slug]?.game && existsSync(geoF) && statSync(geoF).mtimeMs > statSync(`${RAW}${slug}.glb`).mtimeMs) { console.log(`[${n}/${slugs.length}] ${slug}: unverändert`); continue; }
  const t0 = Date.now();
  try {
    const { out, doc } = await oneShip(slug, meta);
    manifest.gear[slug] = { ...out, record: meta.record, gameBuild: meta.sig?.build?.change ?? null };
    if (!NO_GEO) manifest.geo[slug] = await writeGeo(slug, doc);
    report[slug] = { pose: out.pose, legs: out.contacts.length, ground: out.ground, tilt: out.tilt, compress: out.game.compress, hull: out.hullLowest, geo: manifest.geo[slug]?.bytes ?? null, s: Math.round((Date.now() - t0) / 1000) };
    console.log(`[${n}/${slugs.length}] ${slug}: ${out.pose} ${out.contacts.length} Punkte, Boden ${out.ground}, Neigung ${out.tilt.join('/')}°, Einfederung ${out.game.compress?.join('/') ?? '-'}, Rumpf ${out.hullLowest}${manifest.geo[slug] ? `, ${(manifest.geo[slug].bytes / 1024).toFixed(0)} KB ${manifest.geo[slug].tris} Dr.` : ''} (${report[slug].s} s)`);
  } catch (e) {
    report[slug] = { error: e.message };
    if (process.env.DEBUG) console.log(e.stack);
    console.log(`[${n}/${slugs.length}] ${slug}: FEHLER ${e.message}`);
  }
  // nach jedem Schiff sichern: ein abgebrochener Lauf verliert nichts
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(REPORT, JSON.stringify(report, null, 1));
}
