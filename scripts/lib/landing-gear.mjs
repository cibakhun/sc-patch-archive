// Fahrwerk eines Schiffs aus den Spieldaten: Pose (ausgefahren, eingefedert)
// und Aufstandspunkte. Gemeinsam für die Geometrie-Fassung
// (scripts/build-hangar-gear.mjs) und die Web-Fassung (scripts/
// build-hangar-assets.mjs, Schiffe): beide stehen damit auf denselben Beinen.
// Herleitung und Belege: .planning/notes/hangar-flotte.md, Befund PC.
//
// Spielseite: VehicleComponentParams.landingSystem (VehicleLandingGearSystem)
// nennt je Bein den Helfer-Knochen am Schiff, die Geometrie (.cdf/.cga) und
// die Feder (lengthTarget = Länge im gelandeten Zustand, lengthMin/Max,
// offset = Ursprung der Feder im Raum des Feder-Knochens, springBone). Höhe
// des Aufstands = Welt(springBone | Helfer) · (offset + (0, 0, −lengthTarget)),
// y; die seitlichen Anteile des offset sind keine Lage (Carrack: links −2 m,
// rechts gespiegelt +2 m nach innen), x/z kommen vom tiefsten Punkt des Beins.
//
// Rohexport: Primitive teilen sich einen Vertex-Puffer (gemessen wird nur über
// die Indizes), Knoten können im Kreis hängen (eigene Weltmatrix).
//
// initGear(p4k, db) einmal, dann poseShip(doc, record, { skip }) je Rohexport:
// verändert die Knoten der Beine in doc (Animation des Spiels, Einfederung)
// und gibt den Eintrag gear.<slug> zurück. skip(node) = Knoten, die beim
// Messen nicht zählen (Innenraum, Deko); sie werden nicht verändert.
import { crc32 } from 'node:zlib';
import { parseCryXmlNodes } from './cryxml.mjs';
import { readCaf, readDba, sample, sampleRot } from './ivo-caf.mjs';

let p4k = null, db = null, byName = null;
export function initGear(p4kHandle, dataCore) {
  p4k = p4kHandle; db = dataCore;
  byName = new Map(db.records.map((r) => [r.name, r]));
}
const r3 = (v) => Math.round(v * 1000) / 1000;
// Deko ohne Silhouetten-Wert, wie build-holo-meshes
export const GEAR_DROP = /decal|damage|livery|_light|light_|glass|window|interior|proxy|shadow|_lod[1-9]|emissive|sticker|logo|stencil|_dmg|^dmg_|debris|nodraw|helper/i;
export function underInterior(n) { for (let p = n, k = 0; p && k < 512; p = p.getParentNode(), k++) if (/^interior_/i.test(p.getName())) return true; return false; }
// Standard: Innenraum und Deko zählen beim Messen nicht
export const defaultSkip = (n) => GEAR_DROP.test(n.getName() || '') || underInterior(n);

// ─── Spieldaten ─────────────────────────────────────────────────────────
export function gameGear(record) {
  const rec = byName.get(`EntityClassDefinition.${record}`);
  if (!rec) return { error: `Record ${record} fehlt` };
  const o = db.readRecord(rec, { maxDepth: 4, typed: true });
  const vc = (o.Components || []).find((c) => c?.__type === 'VehicleComponentParams');
  const v3 = (p) => (p ? [p.x, p.y, p.z].map(r3) : null);
  const ls = vc?.landingSystem?.__ref ? db.recordById.get(vc.landingSystem.__ref) : null;
  const lso = ls ? db.readRecord(ls, { maxDepth: 8, typed: true }) : null;
  const deep = db.readRecord(rec, { maxDepth: 8, typed: true });
  const comp = (t) => (deep.Components || []).find((c) => c?.__type === t);
  return {
    geometry: comp('SGeometryResourceParams')?.Geometry?.Geometry?.Geometry?.path ?? null,
    adb: comp('SAnimationControllerParams')?.AnimationDatabase ?? null,
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
// .cdf -> Model File (.chr) -> <chr>.chrparams; .cga/.cgf: .chrparams daneben.
// Die .chrparams nennt $TracksDatabase (.dba) und die Animationsnamen, einzelne
// .caf oder „*“ (alle der Datenbank). Mannequin: Deploy = extend, Retract =
// extend rückwärts, Compress = compress. Knochen über CRC32 des Namens; die
// Knoten des Rohexports tragen die relative Ruhelage der .chr.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pathRe = (p) => new RegExp(`(^|[\\\\/])${esc(p.replace(/\\/g, '/')).replace(/\//g, '[\\\\/]')}$`, 'i');
const xmlAttrs = (buf) => (buf.toString('latin1', 0, 7) === 'CryXmlB' ? parseCryXmlNodes(buf).map((n) => ({ tag: n.tag, a: n.attr || {} })) : [...buf.toString('utf8').matchAll(/<(\w+)\b([^>]*)>/g)].map((m) => ({ tag: m[1], a: Object.fromEntries([...m[2].matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]])) })));
const animCache = new Map();
// names: { extend, compress } = Animationsnamen aus dem Mannequin (Rumpf);
// ohne sie die erste extend/deploy- und compress-Animation der .chrparams
function legAnims(cdfPath, names = null) {
  const key = names ? `${cdfPath}|${names.extend}|${names.compress}` : cdfPath;
  if (animCache.has(key)) return animCache.get(key);
  let out = null;
  try {
    const rel = (p) => `Data/${String(p).replace(/\\/g, '/').replace(/^data\//i, '')}`;
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
    const named = (n) => (n ? anims.find((a) => (a.name || '').toLowerCase() === n.toLowerCase() && /\.caf$/i.test(a.path || '')) : null);
    const ext = names ? named(names.extend) : pick(/extend|deploy/i), comp = names ? named(names.compress) : pick(/compress/i);
    // „*“ = alle der Datenbank (300i): Block nach dem Dateinamen der .caf
    if (names && !ext && dbaPath && anims.some((a) => a.name === '*')) {
      const all = readDba(p4k.read(pathRe(rel(dbaPath))));
      const blk = (n) => (n ? all.find((b) => b.name?.toLowerCase().split('/').pop() === `${n.toLowerCase()}.caf`) ?? null : null);
      const e = blk(names.extend);
      out = e ? { src: dbaPath, extend: e, compress: blk(names.compress), extendName: names.extend, compressName: names.compress } : { error: `${names.extend} nicht in ${dbaPath}` };
      animCache.set(key, out);
      return out;
    }
    if (!ext && dbaPath && anims.some((a) => a.name === '*')) out = { src: dbaPath, all: readDba(p4k.read(pathRe(rel(dbaPath)))) };
    else if (!ext) out = { error: 'keine extend-Animation' };
    else if (dbaPath) {
      const dba = readDba(p4k.read(pathRe(rel(dbaPath))));
      const block = (a) => (a ? dba.find((b) => b.name?.toLowerCase().endsWith(String(a.path).toLowerCase().replace(/\\/g, '/'))) ?? null : null);
      out = { src: dbaPath, extend: block(ext), compress: block(comp), extendName: ext.name, compressName: comp?.name ?? null };
    } else {
      const caf = (a) => { if (!a) return null; const c = readCaf(p4k.read(pathRe(rel(`${dir}/${a.path}`)))); return { name: a.path, bones: c.bones }; };
      out = { src: dir, extend: caf(ext), compress: caf(comp), extendName: ext.name, compressName: comp?.name ?? null };
    }
  } catch (e) { out = { error: e.message }; }
  animCache.set(key, out);
  return out;
}
// Landestellung des Rumpfs: Das Mannequin des Schiffs (SAnimationController-
// Params.AnimationDatabase, .adb) spielt beim Landen das Fragment des
// Landesystems (fragment/fragmentDeploy, z. B. Landing_Gear/Deploy) im
// Bereich „Ship“ ab, also auf dem Skelett des Schiffs selbst: Bei der Railen
// klappt landing_deploy die unteren Flügel an. Die .adb ordnet nach Gruppen
// (Element = FragmentID, z. B. <Landing_Gear>); darin je Fragment Tags
// (Zustand/Bereich) und FragTags (Deploy …). Eine Gruppe trägt oft ein
// Fragment für die Beine (Tags=Landing_Gear) und eins ohne Tags für den
// Rumpf (Polaris: Landing_Deploy). Gespielt wird jede Deploy-Animation der
// Gruppe, die die .chrparams der Schiffsgeometrie kennt (.dba oder .caf).
function adbTree(buf) {
  if (buf.toString('latin1', 0, 7) === 'CryXmlB') return parseCryXmlNodes(buf)[0];
  const root = { tag: '#', attr: {}, children: [] }, stack = [root];
  for (const m of buf.toString('utf8').matchAll(/<(\/?)([\w.-]+)([^>]*?)(\/?)>/g)) {
    if (m[1]) { stack.pop(); continue; }
    const n = { tag: m[2], attr: Object.fromEntries([...m[3].matchAll(/([\w.-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]])), children: [] };
    stack[stack.length - 1].children.push(n);
    if (!m[4]) stack.push(n);
  }
  return root;
}
function shipAnims(game) {
  if (!game.adb || !game.geometry || !game.fragments?.name) return { error: 'kein Mannequin oder keine Geometrie' };
  try {
    const find = (n, tag) => (n.tag === tag ? n : n.children.map((c) => find(c, tag)).find(Boolean) ?? null);
    const group = find(adbTree(p4k.read(pathRe(`Data/Animations/Mannequin/ADB/${game.adb}`))), game.fragments.name);
    if (!group) return { error: `Gruppe ${game.fragments.name} nicht im Mannequin` };
    const anims = (frag) => {
      const out = [];
      const walk = (n) => { if (n.tag === 'Animation' && n.attr.name) out.push(n.attr.name); n.children.forEach(walk); };
      for (const f of group.children) if (f.tag === 'Fragment' && f.attr.FragTags === frag) walk(f);
      return [...new Set(out)];
    };
    const dep = anims(game.fragments.deploy || 'Deploy'), cmp = anims(game.fragments.compress || 'Compress');
    if (!dep.length) return { error: `${game.fragments.name}/${game.fragments.deploy} nicht im Mannequin` };
    // je Deploy-Animation die Spur der Schiffsgeometrie; compress = gleicher Index, sonst keine
    const list = dep.map((d, i) => legAnims(game.geometry, { extend: d, compress: cmp[i] ?? null })).filter((a) => a?.extend);
    // Einfedern über den Rumpf (Reclaimer: lg_arm_compress_main_left …), Spur je Animation
    const comps = cmp.filter((c) => !dep.includes(c)).map((c) => legAnims(game.geometry, { extend: c, compress: null })).filter((a) => a?.extend).map((a) => ({ name: a.extendName, track: a.extend }));
    return list.length ? { list, comps, fragment: `${game.fragments.name}/${game.fragments.deploy}` } : { error: `${dep.join(', ')} nicht in der Schiffsgeometrie` };
  } catch (e) { return { error: e.message }; }
}
// Endlage des Ausfahrens je Knochen und Kanal; belegt: letztes Bild von
// extend = erstes von compress. Fehlt eine Spur, kommt der Wert aus der anderen.
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
// Gleichnamige Knoten bekommen alle die Lage (zwei Einbauten derselben .cga)
function applyPose(pose, nodes) {
  const byHash = new Map();
  for (const n of nodes) { const h = (crc32(Buffer.from(n.getName())) >>> 0).toString(16); if (!byHash.has(h)) byHash.set(h, []); byHash.get(h).push(n); }
  let hit = 0;
  for (const [hash, e] of pose) {
    for (const n of byHash.get(hash) ?? []) {
      if (e.q) n.setRotation(e.q);
      if (e.t) n.setTranslation(e.t);
      hit++;
    }
  }
  return hit;
}

// ─── Matrizen und Messen ────────────────────────────────────────────────
export const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
export function invert(m) {
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
// Weltmatrix mit Kreis-Schutz: in einigen Exporten (Hornet F7C-R, CSV-Cargo)
// hängt ein Knoten im Kreis, gltf-transforms getWorldMatrix läuft dann endlos
export const CYCLIC = new Set();
export function worldOf(n) {
  const chain = []; const seen = new Set();
  for (let p = n; p; p = p.getParentNode()) { if (seen.has(p)) { CYCLIC.add(n.getName()); return null; } seen.add(p); chain.push(p); }
  let m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let i = chain.length - 1; i >= 0; i--) m = mul(m, chain[i].getMatrix());
  return m;
}
const ap = (m, v) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * (v[3] ?? 1));
// tiefster Punkt (nur über Indizes erreichbare Ecken)
function lowest(nodes, skip) {
  let best = null;
  const e = [0, 0, 0];
  for (const n of nodes) {
    const m = n.getMesh(); if (!m || skip(n)) continue;
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
// ohne Fahrwerk: je Viertel der Grundfläche der tiefste Punkt
function lowestClusters(nodes, skip) {
  const pts = [];
  const e = [0, 0, 0];
  for (const n of nodes) { const m = n.getMesh(); if (!m || skip(n)) continue; const W = worldOf(n); if (!W) continue;
    for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), idx = p.getIndices(); if (!a) continue; const used = idx ? new Set(idx.getArray()) : null;
      for (let i = 0; i < a.getCount(); i++) { if (used && !used.has(i)) continue; a.getElement(i, e); pts.push([W[0] * e[0] + W[4] * e[1] + W[8] * e[2] + W[12], W[1] * e[0] + W[5] * e[1] + W[9] * e[2] + W[13], W[2] * e[0] + W[6] * e[1] + W[10] * e[2] + W[14]]); } } }
  if (!pts.length) return [];
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  const best = new Map();
  for (const p of pts) { const k = `${p[0] < cx ? 'l' : 'r'}${p[2] < cz ? 'v' : 'h'}`; const b = best.get(k); if (!b || p[1] < b[1]) best.set(k, p); }
  return [...best.values()].map((p) => p.map(r3));
}

// ─── Pose und Aufstand ──────────────────────────────────────────────────
// Mit und ohne Landestellung des Rumpfs rechnen und die bessere behalten:
// erst „aus“ vor „ein“ vor „keins“, dann weniger tief Steckendes. So
// verschlechtert die Rumpfanimation kein Schiff (Syulen: sie verdreht Teile)
// (eine Ebene steiler als 15° ist keine Landung: Syulen mit Bein oben, 89°;
// ausgefahren, aber über 1 m im Boden, ist schlechter als eingefahren:
// Reclaimer, Mole, deren Beine der Rumpf ausfährt, ohne einzufedern)
const deepOf = (g) => Math.max(0, ...(g.below ?? []).map((b) => b.depth));
const score = (g) => ({ aus: 0, ein: 2, keins: 3 }[g.pose] ?? 4) + (Math.max(...(g.tilt ?? [0]).map(Math.abs)) > 15 ? 3 : 0) + (deepOf(g) > 0.2 ? 1 : 0) + (g.pose === 'aus' && deepOf(g) > 1 ? 1.5 : 0) + Math.min(0.9, deepOf(g) / 100);
// Rumpfanimation, die das Bild verschlechtert, obwohl die Messung besser wird:
// orig_300i_landing_gear_open legt die Fahrwerksscharniere lose vor den Rumpf
// (angesehen 27.10.2026); die Knoten hängen im Export anders als im Skelett
const HULL_SKIP = /^ORIG_3\d\d/i;
export function poseShip(doc, record, opts = {}) {
  const nodes = doc.getRoot().listNodes();
  const keep = nodes.map((n) => [n, n.getTranslation().slice(), n.getRotation().slice(), n.getScale().slice()]);
  const withHull = poseOnce(doc, record, { ...opts, useHull: true });
  if (!withHull.game.hullAnim?.bones) return withHull;
  const after = nodes.map((n) => [n, n.getTranslation().slice(), n.getRotation().slice(), n.getScale().slice()]);
  for (const [n, t, r, s] of keep) n.setTranslation(t).setRotation(r).setScale(s);
  const without = poseOnce(doc, record, { ...opts, useHull: false });
  if (score(without) <= score(withHull)) { without.game.hullAnim = { ...withHull.game.hullAnim, rejected: `ohne Rumpfanimation besser (${without.pose}, tiefstes Teil ${Math.max(0, ...without.below.map((b) => b.depth))} m statt ${withHull.pose}, ${Math.max(0, ...withHull.below.map((b) => b.depth))} m)` }; return without; }
  for (const [n, t, r, s] of after) n.setTranslation(t).setRotation(r).setScale(s);
  return withHull;
}
function poseOnce(doc, record, { skip = defaultSkip, useHull = true } = {}) {
  const game = gameGear(record);
  const root = doc.getRoot();
  // erst der Rumpf in Landestellung (Flügel, Klappen), dann die Beine
  const ha = !useHull ? { error: 'nicht angewandt' } : HULL_SKIP.test(record) ? { error: 'ausgenommen: Scharniere landen lose vor dem Rumpf (300er-Reihe)' } : shipAnims(game);
  let hullAnim;
  if (ha.list) {
    let bones = 0;
    for (const a of ha.list) bones += applyPose(deployedPose(a.extend, a.compress).pose, root.listNodes());
    hullAnim = { fragment: ha.fragment, anim: ha.list.map((a) => a.extendName).join(' + '), bones };
  } else hullAnim = { error: ha.error };
  const byLower = new Map(root.listNodes().map((n) => [n.getName().toLowerCase(), n]));
  const legs = [];
  const gearNodes = new Set();
  // Knoten, die unter mehreren Beinen zugleich hängen, zählen für kein Bein
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
    const leg = { bone: g.bone, node: h, kids, parts, foot: lowest(parts, skip), game: { y: yAt(s.target), yMax: yAt(s.max) }, spring: s, from: 'ruhelage' };
    // Geometrie des Beins: Knoten unter dem Helfer (die Polaris nennt für alle
    // drei Beine dieselbe Front.cga), Ordner aus dem Spiel
    const geoNode = parts.find((n) => /\.(cdf|cga|cgf)$/i.test(n.getName()));
    leg.geometry = geoNode && g.geometry ? (/[\\/]/.test(geoNode.getName()) ? geoNode.getName() : `${g.geometry.replace(/[^/\\]+$/, '')}${geoNode.getName()}`) : g.geometry;
    // Ruhelage eingefahren (Fuß mehr als 0,5 m über dem Aufstand): Endlage von
    // extend, dann compress bis zur Federlänge; gilt, wenn der Fuß danach
    // höchstens 0,6 m vom Aufstand liegt, sonst bleibt das Bein, wie es ist
    const legAnim = () => {
      const an = legAnims(leg.geometry);
      if (!an?.all) return an;
      const hashes = new Set(parts.map((n) => (crc32(Buffer.from(n.getName())) >>> 0).toString(16)));
      const best = (re) => an.all.filter((b) => re.test(b.name || '') && !/retract/i.test(b.name || '')).map((b) => [b, b.bones.filter((x) => hashes.has(x.hash)).length]).filter(([, k]) => k > 0).sort((p, q) => q[1] - p[1])[0]?.[0] ?? null;
      const e = best(/extend|deploy/i), c = best(/compress/i);
      return e ? { src: an.src, extend: e, compress: c, extendName: e.name.split('/').pop(), compressName: c?.name.split('/').pop() ?? null } : { error: 'keine extend-Animation für dieses Bein' };
    };
    // Ruhelage zu lang (Fuß mehr als 0,6 m unter der Feder: Constellation,
    // Idris, Sabre-Varianten …): compress des Beins, bis der Fuß auf der
    // Federhöhe steht; gilt, wenn er danach höchstens 0,6 m daneben liegt
    if (leg.foot && leg.foot[1] < leg.game.y - 0.6 && leg.geometry) {
      const an = legAnim();
      if (an?.compress) {
        const keep = parts.map((n) => [n, n.getTranslation().slice(), n.getRotation().slice()]);
        const restore = () => { for (const [n, t, r] of keep) n.setTranslation(t).setRotation(r); };
        // Ausgangslage: wie exportiert, oder Endlage von extend (Corsair: compress
        // setzt das ausgefahrene Bein voraus)
        const dp = an.extend ? deployedPose(an.extend, an.compress) : null;
        let best = null;
        for (const base of [null, dp?.missingRot ? null : dp?.pose].filter((b, i) => i === 0 || b)) {
          const at = (f) => { restore(); if (base) applyPose(base, parts); applyPose(compressAt(an.compress, f), parts); return lowest(parts, skip); };
          let lo = 0, hi = 1;
          for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; const fm = at(mid); if (!fm) break; if (fm[1] < leg.game.y) lo = mid; else hi = mid; }
          const f = (lo + hi) / 2, fm = at(f);
          if (fm && (!best || Math.abs(fm[1] - leg.game.y) < Math.abs(best.fm[1] - leg.game.y))) best = { base, f, fm };
        }
        if (best && Math.abs(best.fm[1] - leg.game.y) <= 0.6) {
          restore(); if (best.base) applyPose(best.base, parts); applyPose(compressAt(an.compress, best.f), parts);
          leg.foot = best.fm; leg.from = `${best.base ? `${an.extendName} + ` : ''}${an.compressName} ${r3(best.f)}`;
        } else { restore(); leg.animError = `nach ${an.compressName} Fuß bei ${best ? r3(best.fm[1]) : '?'}, Aufstand ${r3(leg.game.y)}`; }
      }
    }
    if (leg.foot && leg.foot[1] > leg.game.y + 0.5 && leg.geometry) {
      const an = legAnim();
      const dp = an?.extend ? deployedPose(an.extend, an.compress) : null;
      if (!an?.extend) leg.animError = an?.error ?? 'keine Animation';
      else if (dp.missingRot) leg.animError = `${dp.missingRot} Drehungen ohne lesbare Endlage (${an.extendName})`;
      else {
        const keep = parts.map((n) => [n, n.getTranslation().slice(), n.getRotation().slice()]);
        applyPose(dp.pose, parts);
        let f2 = lowest(parts, skip);
        leg.from = an.extendName + (dp.missing ? ` (${dp.missing} Positionen in Ruhelage)` : '');
        if (f2 && f2[1] < leg.game.y && an.compress) {
          let lo = 0, hi = 1, best = null;
          for (let it = 0; it < 14; it++) {
            const mid = (lo + hi) / 2;
            applyPose(dp.pose, parts); applyPose(compressAt(an.compress, mid), parts);
            const fm = lowest(parts, skip);
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
  // Hat der Rumpf die Beine zu weit ausgefahren (Fuß unter der Feder), jede
  // Compress-Animation der Gruppe so weit spielen, bis die Füße, die sie
  // bewegt, im Mittel auf der Federhöhe stehen (Halbierung über den Anteil)
  if (ha.comps?.length) {
    const all = root.listNodes();
    const feet = () => legs.map((l) => (l.parts ? lowest(l.parts, skip) : null));
    const used = [];
    for (const c of ha.comps) {
      const hashes = new Set(c.track.bones.map((b) => b.hash));
      const touched = all.filter((n) => hashes.has((crc32(Buffer.from(n.getName())) >>> 0).toString(16)));
      const save = touched.map((n) => [n, n.getTranslation().slice(), n.getRotation().slice()]);
      const restore = () => { for (const [n, t, r] of save) n.setTranslation(t).setRotation(r); };
      const f0 = feet();
      applyPose(compressAt(c.track, 1), touched);
      const f1 = feet();
      restore();
      const mine = legs.map((l, i) => i).filter((i) => f0[i] && f1[i] && Math.abs(f1[i][1] - f0[i][1]) > 0.01 && f0[i][1] < legs[i].game.y - 0.02);
      if (!mine.length) continue;
      const err = (fs) => mine.reduce((s, i) => s + (fs[i][1] - legs[i].game.y), 0) / mine.length;
      let lo = 0, hi = 1;
      for (let it = 0; it < 14; it++) {
        const mid = (lo + hi) / 2;
        restore(); applyPose(compressAt(c.track, mid), touched);
        if (err(feet()) < 0) lo = mid; else hi = mid;
      }
      restore(); applyPose(compressAt(c.track, (lo + hi) / 2), touched);
      used.push(`${c.name} ${r3((lo + hi) / 2)}`);
    }
    if (used.length) {
      const fs = feet();
      legs.forEach((l, i) => { if (fs[i]) l.foot = fs[i]; });
      hullAnim.compress = used;
    }
  }
  const hullNodes = root.listNodes().filter((n) => n.getMesh() && !gearNodes.has(n));
  const hull = lowest(hullNodes, skip);
  // Steht ein Helfer mehrfach im Landesystem (Avenger), zählt der Eintrag,
  // dessen Feder am besten zur Geometrie passt
  const bestOf = new Map();
  for (const l of legs.filter((x) => x.foot)) { const b = bestOf.get(l.node); if (!b || Math.abs(l.game.y - l.foot[1]) < Math.abs(b.game.y - b.foot[1])) bestOf.set(l.node, l); }
  const withGeo = [...bestOf.values()];
  const down = (l) => l.foot[1] <= l.game.y + 0.5;
  let pose, why = null, contacts;
  if (!game.gears?.length) {
    pose = 'keins';
    why = game.error ?? (game.landingSystem ? 'Landesystem ohne Beine' : 'kein Landesystem im Spiel (setzt auf Rumpf, Kufen oder Rädern auf)');
  } else if (!withGeo.length) {
    pose = 'keins'; why = 'Fahrwerk im Export ohne Geometrie';
  } else if (withGeo.every(down)) pose = 'aus';
  else { pose = 'ein'; why = withGeo.filter((l) => !down(l)).map((l) => `${l.bone}: ${l.animError ?? 'eingefahren'}`).join('; '); }
  // Einfederung: Bein starr auf die Aufstandshöhe des Spiels, höchstens 0,6 m;
  // mehr ist keine Einfederung, dann bleibt das Bein (legs[].mismatch)
  const shifts = [];
  if (pose === 'aus') for (const l of withGeo) {
    const dy = l.game.y - l.foot[1];
    if (Math.abs(dy) < 1e-4) continue;
    if (Math.abs(dy) > 0.6) { l.mismatch = r3(dy); continue; }
    for (const k of l.kids) {
      const parentW = worldOf(l.node);
      const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, dy, 0, 1];
      k.setMatrix(mul(mul(mul(invert(parentW), T), parentW), k.getMatrix()));
    }
    shifts.push(r3(dy));
    l.foot = [l.foot[0], l.foot[1] + dy, l.foot[2]];
  }
  // Höhe immer aus der Feder des Spiels (auch „ein“: das Schiff steht richtig hoch)
  const geoOnly = withGeo.some((l) => l.mismatch != null);
  if (pose === 'aus' || pose === 'ein') contacts = withGeo.map((l) => [r3(l.foot[0]), r3(l.game.y), r3(l.foot[2])]);
  else contacts = lowestClusters(hullNodes, skip);
  // ohne Fahrwerk: waagrecht auf den tiefsten Punkt
  const pl = pose === 'keins' ? { tilt: [0, 0], ground: contacts.length ? Math.min(...contacts.map((p) => p[1])) : null } : plane(contacts);
  // Teile mehr als 2 cm unter der Aufstandsebene, die zehn tiefsten
  const below = [];
  if (pl.ground != null) {
    const a = Math.tan((pl.tilt[0] * Math.PI) / 180), b = Math.tan((pl.tilt[1] * Math.PI) / 180), e = [0, 0, 0];
    for (const n of root.listNodes()) {
      const m = n.getMesh(); if (!m || skip(n)) continue;
      const W = worldOf(n); if (!W) continue; let worst = 0;
      for (const p of m.listPrimitives()) { const acc = p.getAttribute('POSITION'), idx = p.getIndices(); if (!acc) continue; const list = idx ? idx.getArray() : null;
        const cnt = list ? list.length : acc.getCount();
        for (let k = 0; k < cnt; k++) { acc.getElement(list ? list[k] : k, e); const x = W[0] * e[0] + W[4] * e[1] + W[8] * e[2] + W[12], y = W[1] * e[0] + W[5] * e[1] + W[9] * e[2] + W[13], z = W[2] * e[0] + W[6] * e[1] + W[10] * e[2] + W[14]; const d = a * x + b * z + pl.ground - y; if (d > worst) worst = d; } }
      if (worst > 0.02) below.push({ node: n.getName(), depth: r3(worst), gear: gearNodes.has(n) });
    }
    below.sort((p, q) => q.depth - p.depth);
  }
  return {
    pose, ...(why ? { why } : {}), contacts, ground: pl.ground, tilt: pl.tilt,
    below: below.slice(0, 10), belowCount: below.length,
    source: pose === 'aus' ? (geoOnly ? 'Feder des Spiels (lengthTarget) für die Höhe, x/z vom Bein; einzelne Beine weichen in der Geometrie ab (legs[].mismatch, below)' : 'Feder des Spiels (lengthTarget) für die Höhe, tiefster Punkt je Bein für x/z') : pose === 'ein' ? 'Feder des Spiels für die Höhe; Fahrwerk der Geometrie-Fassung eingefahren (siehe why), x/z vom eingefahrenen Bein' : 'tiefste Punkte des Rumpfs',
    game: {
      landingSystem: game.landingSystem, landingOffset: game.landingOffset, landingRotationOffset: game.landingRotationOffset, hullAnim,
      legs: legs.map((l) => ({ bone: l.bone, ...(l.missing ? { missing: l.missing } : { pose: l.from, ...(l.animError ? { animError: l.animError } : {}), ...(l.mismatch != null ? { mismatch: l.mismatch } : {}), foot: l.foot ? l.foot.map(r3) : null, y: r3(l.game.y), yMax: r3(l.game.yMax), spring: { target: r3(l.spring.target), min: r3(l.spring.min ?? 0), max: r3(l.spring.max), offset: l.spring.offset.map(r3) } }) })),
      compress: shifts.length ? shifts : null,
    },
    hullLowest: hull ? r3(hull[1]) : null,
  };
}
