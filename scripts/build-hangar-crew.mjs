// Baut die Hangar-Crew aus den Spieldateien der Deckcrew (RSI Deck Crew):
// eine Figur mit echtem Skelett, Gewichten und Spielanimationen, dazu die
// Schichtfarben der 20 Farbstellungen. Ersetzt die starre Figur aus
// build-hangar-assets.mjs (npc/deckcrew-m.glb), die der Viewer in Glieder
// zerschnitt und an ein Gerüst aus Grundkörpern hängte.
//
// Eingabe (gitignored): .cache/hangar-src/crew-raw/Data/…  .chr, .skin/.skinm,
//   .mtl, .dds, .caf/.dba — auf dem Betreiber-PC aus der Data.p4k entpackt
//   (Ordner npc-roh neben dem Projekt) und hierher kopiert, Pfade wie im Spiel
// Ausgabe:
//   public/hangar/npc/crew.glb   eine Hautmasche (alle Teile, LOD2), Skelett,
//                                Animationen ohne Fortbewegung, zwei Karten
//   src/data/hangar-crew.json    Adresse, Größe, Kennzahlen für die Seite
//
// Figur: Unteranzug, Rumpf, Arme, Beine und Helm der Deckcrew, je Teil die
// Stufe LOD2 (25 000 Dreiecke zusammen). Achsen wie im Viewer: Y oben, Blick
// nach +Z (CryEngine: Z oben, Blick +Y; x -> -x).
//
// Farbe: Die Montur ist ein Schichtmaterial des Spiels (LayerBlend_V2): je
// Teilmaterial vier Grund- und vier Abnutzungsschichten, gemischt über die
// Blendkarte (Rot, Grün, Blau; Schwarz = Schicht 4) und, für die Abnutzung,
// die Verschleißkarte. Die Karten sind für alle Farbstellungen gleich; die
// Stellungen unterscheiden sich nur in Schicht und Tönung. Darum trägt das
// Modell die Karten einmal (Atlas aus drei Kacheln: Rüstung, Unteranzug,
// Helm) und je Stellung eine Farbtafel (Teilmaterial × Schicht), aus der der
// Viewer im Shader mischt (assets/hangar-crew.js). Eine Schicht ist
// Diffuse × Tönung × Mittel ihrer Kachelkarte; Metall ist sie, wenn die
// Spiegelung des Schichtmaterials hoch ist (dann färbt die Spiegelung, mal
// Tönung); die Glätte ist das Mittel der Glanzkarte × GlossMult ×
// Shininess/255.
//
// Animationen: Die Fortbewegung steckt im Knochen World; er bleibt in Ruhe,
// der Viewer bewegt die Figur selbst (Geschwindigkeit und Bahn je Clip in
// den Metadaten). Schlüssel werden ausgedünnt (Abweichung unter 0,3° bzw.
// 1 mm), Drehungen als Int16 abgelegt.
//
// Usage: node scripts/build-hangar-crew.mjs [roh-ordner]
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import * as THREE from 'three';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import { readSkeleton } from './lib/ivo-skeleton.mjs';
import { readSkinMesh, readSkinBones } from './lib/ivo-skin.mjs';
import { readAnimations } from './lib/ivo-anim.mjs';
import { readDds, decodeLevel } from './lib/dds-bc.mjs';
import { parseCryXml } from './lib/cryxml.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW = process.argv[2] ?? join(ROOT, '.cache/hangar-src/crew-raw');
const OUT_GLB = join(ROOT, 'public/hangar/npc/crew.glb');
const OUT_JSON = join(ROOT, 'src/data/hangar-crew.json');
const D = (p) => join(RAW, 'Data', p);
const CHAR = 'Objects/Characters/Human/male_v7';
const SUIT = `${CHAR}/armor/rsi/deckcrew`;
const ANIM = 'Animations/Characters/Human/male_v7';

// Teile der Figur: Datei, Kachel im Atlas, Material (Grundstellung 01)
const PARTS = [
  { key: 'undersuit', tile: 'undersuit' },
  { key: 'core', tile: 'armor' },
  { key: 'arms', tile: 'armor' },
  { key: 'legs', tile: 'armor' },
  { key: 'helmet', tile: 'helmet' },
];
const LOD = '_lod2';
// Kacheln: Lage im Atlas (Bruchteile), Karten des Spiels
const TILES = {
  armor: { at: [0, 0], tex: 'm_rsi_deckcrew_armor', mtl: 'm_rsi_deckcrew_armor_01_01' },
  undersuit: { at: [0.5, 0], tex: 'm_rsi_deckcrew_undersuit', mtl: 'm_rsi_deckcrew_undersuit_01_01' },
  helmet: { at: [0, 0.5], tex: 'm_rsi_deckcrew_helmet', mtl: 'm_rsi_deckcrew_helmet_01_01' },
};
const ATLAS = 2048, TILE = ATLAS / 2;
// Farbstellungen des Spiels (mtl_var 02 … 20, 01 ist die Grundstellung)
const VARIANTS = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0'));

// Clips: Kurzname -> Quelle (Ordner/Datei.caf oder Datenbank.dba#Name)
const CLIPS = {
  // gehen
  walk: { src: 'ai/locomotion/nw.dba#ai_nw_neutral_stand_walkslow_forward', loop: true },
  walk2: { src: 'ai/locomotion/nw.dba#ai_nw_neutral_stand_walkslow_forward_02', loop: true },
  walkfast: { src: 'ai/locomotion/nw.dba#ai_nw_neutral_stand_walkfast_forward', loop: true },
  start: { src: 'ai/locomotion/nw.dba#ai_nw_neutral_stand_walkslow_start_l000_lf' },
  stop: { src: 'ai/locomotion/nw.dba#ai_nw_neutral_stand_walkslow_forward_stop_lfup' },
  turnL: { src: 'weapons/no_weapon/locomotion/stand.dba#nw_neutral_stand_turn90left' },
  turnR: { src: 'weapons/no_weapon/locomotion/stand.dba#nw_neutral_stand_turn90right' },
  turn180: { src: 'weapons/no_weapon/locomotion/stand.dba#nw_neutral_stand_turn180left' },
  // stehen
  idle: { src: 'weapons/no_weapon/idle_fidget.dba#nw_neutral_stand_idle_01', loop: true },
  idleA: { src: 'ai/civ/standing_idles/ai_nw_neutral_stand_a_idle_01.caf', loop: true },
  idleB: { src: 'ai/civ/standing_idles/ai_nw_neutral_stand_a_idle_02.caf', loop: true },
  fidget1: { src: 'weapons/no_weapon/idle_fidget.dba#nw_neutral_stand_idlefidget_03' },
  fidget2: { src: 'weapons/no_weapon/idle_fidget.dba#nw_neutral_stand_idlefidget_07' },
  crossarms: { src: 'ai/fidgets/nw_neutral_standfidget_sv02_crossarms_01.caf' },
  hipslook: { src: 'ai/fidgets/nw_neutral_standfidget_sv02_handsonhipslookaround_01.caf' },
  // Mobiglas am Handgelenk
  mobiIn: { src: 'ai/civ/standing_idles/ai_nw_neutral_stand_a_mobiglas_a_tran_enter_01.caf' },
  mobi: { src: 'ai/civ/standing_idles/ai_nw_neutral_stand_a_mobiglas_a_idle_02.caf', loop: true },
  mobiOut: { src: 'ai/civ/standing_idles/ai_nw_neutral_stand_a_mobiglas_a_tran_exit_01.caf' },
  // Wartungsklappe (hoch: vor der Brust, tief: in der Hocke)
  panelIn: { src: 'ai/wkr/mpnl/ai_wkr_stand_ntrl_mpnl_enter_b1_01.caf' },
  panel: { src: 'ai/wkr/mpnl/ai_wkr_ntrl_mpnl_high_a_idle_01.caf', loop: true },
  panelLook: { src: 'ai/wkr/mpnl/ai_wkr_ntrl_mpnl_high_visual_a_inspect_01.caf' },
  panelFeel: { src: 'ai/wkr/mpnl/ai_wkr_ntrl_mpnl_high_fuse_a_tactile_inspect_01.caf' },
  panelDown: { src: 'ai/wkr/mpnl/ai_wkr_ntrl_mpnl_high_a_idle_to_low_a_idle_01.caf' },
  panelLow: { src: 'ai/wkr/mpnl/ai_wkr_ntrl_mpnl_low_a_idle_01.caf', loop: true },
  panelLowLook: { src: 'ai/wkr/mpnl/ai_wkr_ntrl_mpnl_low_visual_a_inspect_01.caf' },
  panelOut: { src: 'ai/wkr/mpnl/ai_wkr_stand_ntrl_mpnl_exit_b1_01.caf' },
  // Werkbank
  benchIn: { src: 'ai/civ/work_bench/ai_civ_stand_ntrl_workbench_a_tran_enter_01.caf' },
  bench: { src: 'ai/civ/work_bench/ai_civ_stand_ntrl_workbench_a_idle_01.caf', loop: true },
  benchOut: { src: 'ai/civ/work_bench/ai_civ_stand_ntrl_workbench_a_tran_exit_01.caf' },
  // Konsole: Tasten vorn
  pressC: { src: 'ai/civ/controls/ai_civ_stand_ntrl_button_front_center_r_hand_a_press_01.caf' },
  pressL: { src: 'ai/civ/controls/ai_civ_stand_ntrl_button_front_left_l_hand_a_press_01.caf' },
  pressR: { src: 'ai/civ/controls/ai_civ_stand_ntrl_button_front_right_r_hand_a_press_01.caf' },
  // Fahrwerk prüfen (Deckcrew der Träger)
  gear: { src: 'npc/military/npc_mil_green_catapult_right_checklandinggear_idle_01_ntrl.caf', loop: true },
  gearLook: { src: 'npc/military/npc_mil_green_catapult_right_checklandinggear_examine_01_ntrl.caf' },
  area: { src: 'npc/military/npc_mil_green_catapult_right_check_area_01_ntrl.caf' },
  // Einweiser beim Aufsetzen
  marshalIn: { src: 'ai/mil/landing_officer/ai_mil_ntrl_stand_ac_ramp_marshal_cometostop_enter_01.caf' },
  marshal: { src: 'ai/mil/landing_officer/ai_mil_ntrl_stand_ac_ramp_marshal_cometostop_01.caf', loop: true },
  marshalHold: { src: 'ai/mil/landing_officer/ai_mil_ntrl_stand_ac_ramp_marshal_cometostop_to_holdpos_01.caf' },
  marshalOut: { src: 'ai/mil/landing_officer/ai_mil_ntrl_stand_ac_ramp_marshal_holdpos_exit_01.caf' },
};
// erlaubte Abweichung beim Ausdünnen: Finger, Hilfsknochen (_def), Rest
const TOL_ROT = { finger: (1.0 * Math.PI) / 180, def: (0.6 * Math.PI) / 180, body: (0.35 * Math.PI) / 180 }, TOL_POS = 0.0015;
const tolOf = (name) => (/Hand(Index|Middle|Ring|Pinky|Thumb)|InHand|Thumb_def/.test(name) ? TOL_ROT.finger : /_def$/.test(name) ? TOL_ROT.def : TOL_ROT.body);

const hash = (s) => crc32(Buffer.from(s)) >>> 0;
const cq = (q) => [-q[0], q[2], q[1], q[3]];          // Drehung CryEngine -> Viewer
const cv = (v) => [-v[0], v[2], v[1]];                // Lage CryEngine -> Viewer
const read = (p) => readFileSync(D(p));
const has = (p) => existsSync(D(p));
// Dateien ohne Rücksicht auf Groß-/Kleinschreibung (Pfade in den .mtl sind klein)
const lower = new Map();
(function walk(abs, rel) {
  for (const n of readdirSync(abs)) {
    const a = join(abs, n), r = rel ? `${rel}/${n}` : n;
    if (statSync(a).isDirectory()) walk(a, r); else lower.set(r.toLowerCase(), a);
  }
})(join(RAW, 'Data'), '');
const findCI = (p) => lower.get(p.toLowerCase()) ?? null;

// ─── Skelett ──────────────────────────────────────────────────────────────
const skel = readSkeleton(read(`${CHAR}/export/bhm_skeleton_v7.chr`));
const byName = new Map(skel.map((b, i) => [b.name, i]));

// ─── Teile ────────────────────────────────────────────────────────────────
const parts = PARTS.map((p) => {
  const base = `${SUIT}/m_rsi_deckcrew_01_${p.key}${LOD}`;
  const bones = readSkinBones(read(`${base}.skin`));
  const mesh = readSkinMesh(read(`${base}.skinm`));
  // Knochen der Teiltafel -> Skelett; fehlt einer (Anbauknochen *_override),
  // gilt sein nächster Vorfahr in der Teiltafel
  const map = bones.map((b) => {
    for (let k = b, n = 0; k && n < 64; k = bones[k.parent], n++) if (byName.has(k.name)) return byName.get(k.name);
    return byName.get('Hips');
  });
  return { ...p, bones, mesh, map };
});

// benutzte Knochen samt Vorfahren, dazu World und Hips
const keep = new Set([0, byName.get('Hips')]);
for (const p of parts) {
  const { joints, weights, influences: k } = p.mesh;
  for (let i = 0; i < weights.length; i++) if (weights[i]) keep.add(p.map[joints[i]]);
}
for (const i of [...keep]) for (let j = skel[i].parent; j >= 0; j = skel[j].parent) keep.add(j);
const kept = [...keep].sort((a, b) => a - b);
const newIndex = new Map(kept.map((o, n) => [o, n]));
for (const o of kept) if (skel[o].parent >= 0 && !newIndex.has(skel[o].parent)) throw new Error(`Elternknochen fehlt: ${skel[o].name}`);

// Ruhelage im Viewer-Raum: Welt aus dem Skelett, örtlich = Eltern⁻¹ · Welt
const worldM = kept.map((o) => new THREE.Matrix4().compose(new THREE.Vector3(...cv(skel[o].world.t)), new THREE.Quaternion(...cq(skel[o].world.q)).normalize(), new THREE.Vector3(1, 1, 1)));
const localTRS = kept.map((o, n) => {
  const p = skel[o].parent;
  const m = p >= 0 ? worldM[newIndex.get(p)].clone().invert().multiply(worldM[n]) : worldM[n].clone();
  const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  m.decompose(t, q, s);
  return { t: t.toArray(), q: q.toArray() };
});

// ─── Masche zusammenlegen ─────────────────────────────────────────────────
// Teilmaterialien der Kacheln in fester Folge (Rüstung, Unteranzug, Helm)
const mtlOf = (tile, v) => {
  const t = TILES[tile];
  return v === '01' ? `${SUIT}/${t.mtl}_01.mtl` : `${SUIT}/mtl_var/${t.mtl}_01/${t.mtl}_${v}.mtl`;
};
const subsOf = (tile, v) => parseCryXml(read(mtlOf(tile, v))).children.find((c) => c.tag === 'SubMaterials').children.filter((c) => c.tag === 'Material');
const SUB_BASE = {}, SUB_NAMES = [];
for (const tile of ['armor', 'undersuit', 'helmet']) { SUB_BASE[tile] = SUB_NAMES.length; for (const s of subsOf(tile, '01')) SUB_NAMES.push(`${tile}/${s.attr.Name}`); }

let nV = 0, nI = 0;
for (const p of parts) { nV += p.mesh.info.vertices; nI += p.mesh.idx.length; }
const POS = new Float32Array(nV * 3), NOR = new Float32Array(nV * 3), UV = new Float32Array(nV * 2), SUB = new Float32Array(nV * 2);
const JNT = new Uint8Array(nV * 4), WGT = new Float32Array(nV * 4), IDX = new Uint32Array(nI);
let vo = 0, io = 0, agree = 0, faces = 0, uvOut = 0;
const subTris = new Map();
for (const p of parts) {
  const m = p.mesh, k = m.influences, [tu, tv] = TILES[p.tile].at;
  for (let v = 0; v < m.info.vertices; v++) {
    POS.set(cv([m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]]), (vo + v) * 3);
    if (m.nor) NOR.set(cv([m.nor[v * 3], m.nor[v * 3 + 1], m.nor[v * 3 + 2]]), (vo + v) * 3);
    let u = m.uv[v * 2], w = m.uv[v * 2 + 1];
    if (u < -1e-3 || u > 1.001 || w < -1e-3 || w > 1.001) uvOut++;
    u = Math.min(1, Math.max(0, u)); w = Math.min(1, Math.max(0, w));
    UV[(vo + v) * 2] = tu + u * 0.5; UV[(vo + v) * 2 + 1] = tv + w * 0.5;
    // die vier stärksten Einflüsse, gleiche Zielknochen zusammengefasst
    const acc = new Map();
    for (let j = 0; j < k; j++) {
      const wt = m.weights[v * k + j];
      if (!wt) continue;
      const g = newIndex.get(p.map[m.joints[v * k + j]]);
      acc.set(g, (acc.get(g) ?? 0) + wt);
    }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((s, x) => s + x[1], 0) || 1;
    top.forEach(([g, wt], j) => { JNT[(vo + v) * 4 + j] = g; WGT[(vo + v) * 4 + j] = wt / sum; });
    if (!top.length) { JNT[(vo + v) * 4] = newIndex.get(byName.get('Hips')); WGT[(vo + v) * 4] = 1; }
  }
  for (const s of m.subs) {
    const sub = SUB_BASE[p.tile] + s.mat;
    subTris.set(sub, (subTris.get(sub) ?? 0) + s.numIndices / 3);
    for (let i = s.firstIndex; i < s.firstIndex + s.numIndices; i++) {
      const v = m.idx[i];
      SUB[(vo + v) * 2] = sub;
      IDX[io++] = vo + v;
    }
  }
  vo += m.info.vertices;
}
// Umlaufsinn: Flächennormale gegen die Eckennormalen
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e = new THREE.Vector3();
for (let t = 0; t < io; t += 3) {
  a.fromArray(POS, IDX[t] * 3); b.fromArray(POS, IDX[t + 1] * 3); c.fromArray(POS, IDX[t + 2] * 3);
  n.subVectors(b, a).cross(e.subVectors(c, a));
  const vn = new THREE.Vector3().fromArray(NOR, IDX[t] * 3).add(new THREE.Vector3().fromArray(NOR, IDX[t + 1] * 3)).add(new THREE.Vector3().fromArray(NOR, IDX[t + 2] * 3));
  if (n.lengthSq() > 0) { faces++; if (n.dot(vn) > 0) agree++; }
}
const flip = agree < faces / 2;
if (flip) for (let t = 0; t < io; t += 3) { const x = IDX[t + 1]; IDX[t + 1] = IDX[t + 2]; IDX[t + 2] = x; }
const tris = io / 3;
console.log(`Figur: ${parts.length} Teile, ${nV} Ecken, ${tris} Dreiecke, ${kept.length} von ${skel.length} Knochen, Umlauf ${flip ? 'gedreht' : 'wie im Spiel'} (${((100 * agree) / faces).toFixed(0)} % übereinstimmend), UV außerhalb: ${uvOut}`);

// ─── Karten (Atlas) ───────────────────────────────────────────────────────
// Stufen neben einer .dds: <name>.<N> (Alphakanal: <name>.<N>a), Groß- und
// Kleinschreibung egal
function partsOf(dir, base, suffix = '') {
  const pre = `${base.toLowerCase()}.`, parts = {};
  for (const f of readdirSync(dir)) {
    const l = f.toLowerCase();
    if (!l.startsWith(pre) || !l.endsWith(suffix)) continue;
    const n = l.slice(pre.length, l.length - suffix.length);
    if (/^\d+$/.test(n)) parts[n] = readFileSync(join(dir, f));
  }
  return parts;
}
function texture(p, level = null) {
  const head = findCI(`${p}.dds`);
  if (!head) return null;
  const dds = readDds(readFileSync(head), partsOf(dirname(head), basename(head)));
  const lv = level == null ? dds.levels[0] : dds.levels.find((l) => l.w <= level) ?? dds.levels.at(-1);
  return decodeLevel(dds, lv.level);
}
// Glanz der Schichtkarten: Alphakanal getrennt (.dds.a, .dds.Na)
function glossMean(p) {
  const head = findCI(`${p}.dds.a`);
  if (!head) return null;
  const dds = readDds(readFileSync(head), partsOf(dirname(head), basename(head).replace(/\.a$/i, ''), 'a'));
  const lv = dds.levels.find((l) => l.w <= 64) ?? dds.levels.at(-1);
  const im = decodeLevel(dds, lv.level);
  let s = 0;
  for (let i = 0; i < im.w * im.h; i++) s += im.data[i * 4];
  return s / (im.w * im.h);
}
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

// Blendkarte (RGB) in voller Größe: die Grenzen der Farbfelder sollen scharf
// bleiben. Normale (RG), Verschleiß (B) und Verdeckung (A, aus _hal Grün)
// in halber: Feinheiten, die auf Abstand verschwimmen.
const blendPx = Buffer.alloc(ATLAS * ATLAS * 3), detPx = Buffer.alloc(ATLAS * ATLAS * 4);
for (let i = 0; i < ATLAS * ATLAS; i++) { detPx[i * 4] = 128; detPx[i * 4 + 1] = 128; detPx[i * 4 + 3] = 255; }
for (const t of Object.values(TILES)) {
  const tp = `${SUIT}/textures/${t.tex}`;
  const blend = texture(`${tp}_blend`), wear = texture(`${tp}_wear`), ddn = texture(`${tp}_ddn`), hal = texture(`${tp}_hal`);
  if (!blend || !ddn) throw new Error(`Karten fehlen: ${tp}`);
  const x0 = t.at[0] * ATLAS, y0 = t.at[1] * ATLAS;
  const at = (im, x, y) => { const sx = Math.min(im.w - 1, Math.floor((x * im.w) / TILE)), sy = Math.min(im.h - 1, Math.floor((y * im.h) / TILE)); return (sy * im.w + sx) * 4; };
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const o = (y0 + y) * ATLAS + x0 + x, q = at(blend, x, y), r = at(ddn, x, y);
    for (let j = 0; j < 3; j++) blendPx[o * 3 + j] = Math.round(blend.data[q + j] * 255);
    detPx[o * 4] = Math.round((ddn.data[r] * 0.5 + 0.5) * 255); detPx[o * 4 + 1] = Math.round((ddn.data[r + 1] * 0.5 + 0.5) * 255);
    detPx[o * 4 + 2] = wear ? Math.round(wear.data[at(wear, x, y)] * 255) : 0;
    detPx[o * 4 + 3] = hal ? Math.round(hal.data[at(hal, x, y) + 1] * 255) : 255;
  }
}
const DET = ATLAS / 2;
const blendWebp = await sharp(blendPx, { raw: { width: ATLAS, height: ATLAS, channels: 3 } }).webp({ quality: 90 }).toBuffer();
const detWebp = await sharp(detPx, { raw: { width: ATLAS, height: ATLAS, channels: 4 } }).resize(DET, DET, { kernel: 'lanczos3' }).webp({ quality: 85, alphaQuality: 80 }).toBuffer();
console.log(`Atlas: Blend ${ATLAS}² ${(blendWebp.length / 1024).toFixed(0)} KB, Normale/Verschleiß/Verdeckung ${DET}² ${(detWebp.length / 1024).toFixed(0)} KB`);

// ─── Farbtafel je Stellung ────────────────────────────────────────────────
// Zeile = Teilmaterial, Spalten: je Schicht 2 Texel (sRGB-Farbe + Metall,
// Rauheit), Texel 16: Leuchtfarbe (sRGB) + Art (0 Schicht, 1 Leuchte, 2 Glas),
// Texel 17: Leuchtstärke / 10
const COLS = 18, NSUB = SUB_NAMES.length;
const layerCache = new Map();
const f3 = (s, d = 1) => (s ? s.split(',').map(Number) : [d, d, d]);
function layerOf(path) {
  const k = path.toLowerCase();
  if (layerCache.has(k)) return layerCache.get(k);
  const file = findCI(k.replace(/^materials\//, 'Materials/'));
  let r = { diffuse: [1, 1, 1], spec: [0.04, 0.04, 0.04], shin: 255, diff: [1, 1, 1], gloss: 1 };
  if (file) {
    const x = parseCryXml(readFileSync(file)), at = x.attr ?? {};
    r = { diffuse: f3(at.Diffuse), spec: f3(at.Specular, 0.04), shin: Number(at.Shininess ?? 255), diff: [1, 1, 1], gloss: 1 };
    const texs = (x.children.find((c) => c.tag === 'Textures')?.children ?? []);
    const t1 = texs.find((t) => t.attr.Map === 'TexSlot1')?.attr.File, t2 = texs.find((t) => t.attr.Map === 'TexSlot2')?.attr.File;
    if (t1) {
      const im = texture(t1.replace(/\.(tif|dds)$/i, '').replace(/^textures\//i, 'Textures/'), 64);
      if (im) { const m = [0, 0, 0]; for (let i = 0; i < im.w * im.h; i++) for (let j = 0; j < 3; j++) m[j] += toLin(im.data[i * 4 + j]) / (im.w * im.h); r.diff = m; }
      else console.warn(`  Schichtkarte fehlt: ${t1}`);
    }
    if (t2) { const g = glossMean(t2.replace(/\.(tif|dds)$/i, '').replace(/^textures\//i, 'Textures/')); if (g != null) r.gloss = g; else console.warn(`  Glanzkarte fehlt: ${t2}`); }
  } else if (path) console.warn(`  Schichtmaterial fehlt: ${path}`);
  layerCache.set(k, r);
  return r;
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function layerTexels(L) {
  if (!L) return [[0, 0, 0, 0], [255, 0, 0, 0]];
  const l = layerOf(L.attr.Path), tint = f3(L.attr.TintColor);
  const metal = Math.min(1, Math.max(0, (lum(l.spec) - 0.08) / 0.12));
  const dCol = l.diffuse.map((v, i) => v * tint[i] * l.diff[i]), mCol = l.spec.map((v, i) => v * tint[i]);
  const col = dCol.map((v, i) => v + (mCol[i] - v) * metal);
  const smooth = Math.min(1, l.gloss * Number(L.attr.GlossMult ?? 1) * (l.shin / 255));
  return [[...col.map((v) => Math.round(toSrgb(Math.min(1, v)) * 255)), Math.round(metal * 255)], [Math.round((1 - smooth) * 255), 0, 0, 0]];
}
const table = Buffer.alloc(VARIANTS.length * NSUB * COLS * 4);
const kinds = {};
VARIANTS.forEach((v, vi) => {
  for (const tile of ['armor', 'undersuit', 'helmet']) subsOf(tile, v).forEach((s, si) => {
    const row = vi * NSUB + SUB_BASE[tile] + si, put = (col, px) => px.forEach((x, j) => { table[(row * COLS + col) * 4 + j] = x; });
    const sh = s.attr.Shader;
    if (sh === 'LayerBlend_V2') {
      const layers = s.children.find((c) => c.tag === 'MatLayers')?.children ?? [];
      const L = (nm) => layers.find((l) => l.attr.Name === nm);
      ['BaseLayer1', 'BaseLayer2', 'BaseLayer3', 'BaseLayer4', 'WearLayer1', 'WearLayer2', 'WearLayer3', 'WearLayer4'].forEach((nm, li) => {
        const [t0, t1] = layerTexels(L(nm) ?? L(nm.replace('Wear', 'Base')));
        put(li * 2, t0); put(li * 2 + 1, t1);
      });
      put(16, [0, 0, 0, 0]);
    } else {
      const dif = f3(s.attr.Diffuse), emi = f3(s.attr.Emissive, 0), glass = /glass/i.test(sh);
      const px = [...dif.map((x) => Math.round(toSrgb(x) * 255)), 0];
      for (let li = 0; li < 8; li++) { put(li * 2, px); put(li * 2 + 1, [glass ? 18 : 140, 0, 0, 0]); }
      put(16, [...emi.map((x) => Math.round(toSrgb(Math.min(1, x)) * 255)), glass ? 2 : 1]);
      put(17, [glass ? 0 : Math.round(Math.min(25.5, Number(s.attr.Glow ?? 0.1) * 15) * 10), 0, 0, 0]);
    }
    kinds[sh] = (kinds[sh] ?? 0) + 1;
  });
});
console.log(`Farbtafel: ${VARIANTS.length} Stellungen × ${NSUB} Teilmaterialien (${Object.entries(kinds).map(([k, n]) => `${k} ${n / VARIANTS.length}`).join(', ')}), ${layerCache.size} Schichtmaterialien`);

// ─── Animationen ──────────────────────────────────────────────────────────
const dbCache = new Map();
function clipFrom(src) {
  const [file, name] = src.split('#');
  const path = `${ANIM}/${file}`;
  if (!dbCache.has(path)) dbCache.set(path, readAnimations(read(path), basename(file, '.caf')));
  const list = dbCache.get(path);
  const c = name ? list.find((x) => basename(x.name, '.caf') === name) : list[0];
  if (!c) throw new Error(`Clip fehlt: ${src}`);
  return c;
}
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
// Schlüssel ausdünnen: behält, was lineare Mischung nicht trifft
function thin(times, vals, isRot, tol) {
  const n = times.length;
  if (n <= 2) return [...Array(n).keys()];
  const err = (i, j, k) => {
    const f = (times[k] - times[i]) / (times[j] - times[i] || 1);
    if (isRot) {
      qa.fromArray(vals[i]); qb.fromArray(vals[j]); qc.copy(qa).slerp(qb, f);
      return 2 * Math.acos(Math.min(1, Math.abs(qc.dot(qa.fromArray(vals[k])))));
    }
    return Math.hypot(...vals[k].map((v, d) => vals[i][d] + (vals[j][d] - vals[i][d]) * f - v));
  };
  const out = [0];
  let s = 0;
  for (let i = 1; i < n - 1; i++) {
    let ok = true;
    for (let k = s + 1; k <= i && ok; k++) if (err(s, i + 1, k) > tol) ok = false;
    if (!ok) { out.push(i); s = i; }
  }
  out.push(n - 1);
  return out;
}
const WORLD = hash('World');
const angle = (p, q) => 2 * Math.acos(Math.min(1, Math.abs(p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3])));
let dropped = 0;
const clips = Object.entries(CLIPS).map(([as, spec]) => {
  const c = clipFrom(spec.src);
  let last = 0;
  for (const ch of c.channels.values()) for (const tr of [ch.rot, ch.pos]) if (tr) last = Math.max(last, tr.times.at(-1));
  const dur = last / c.fps;
  // Fortbewegung aus World: Bahn (x, z, Gierwinkel) im Raum der Figur zu Beginn
  const w = c.channels.get(WORLD);
  let root = null, speed = 0, move = [0, 0], yaw = 0;
  if (w && (w.pos || w.rot)) {
    const samp = (tr, f, isRot) => {
      if (!tr) return isRot ? [0, 0, 0, 1] : [0, 0, 0];
      const t = tr.times; let i = 0;
      while (i < t.length - 1 && t[i + 1] < f) i++;
      const j = Math.min(t.length - 1, i + 1), k = t[j] > t[i] ? Math.min(1, Math.max(0, (f - t[i]) / (t[j] - t[i]))) : 0;
      if (isRot) { qa.fromArray(cq(tr.values[i])); qb.fromArray(cq(tr.values[j])); return qa.slerp(qb, k).toArray(); }
      return cv(tr.values[i].map((v, d) => v + (tr.values[j][d] - v) * k));
    };
    const p0 = samp(w.pos, 0, false), q0 = new THREE.Quaternion().fromArray(samp(w.rot, 0, true)), inv = q0.clone().invert();
    const yawOf = (q) => { const v = new THREE.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(v.x, v.z); };
    root = [];
    let prevYaw = 0, sum = 0;
    for (let f = 0; f <= last + 1e-6; f += c.fps / 10) {
      const p = new THREE.Vector3(...samp(w.pos, f, false)).sub(new THREE.Vector3(...p0)).applyQuaternion(inv);
      const y = yawOf(inv.clone().multiply(new THREE.Quaternion().fromArray(samp(w.rot, f, true))));
      let d = y - prevYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      sum += d; prevYaw = y;
      root.push([+(f / c.fps).toFixed(3), +p.x.toFixed(3), +p.z.toFixed(3), +sum.toFixed(4)]);
    }
    const e0 = root.at(-1);
    move = [e0[1], e0[2]]; yaw = e0[3];
    speed = dur ? Math.hypot(move[0], move[1]) / dur : 0;
    if (Math.hypot(...move) < 0.02 && Math.abs(yaw) < 0.02) root = null;
  }
  const tracks = [];
  for (const o of kept) {
    if (o === 0) continue;                       // World bleibt in Ruhe
    const ch = c.channels.get(skel[o].id);
    if (!ch) continue;
    const ni = newIndex.get(o);
    for (const [path, tr] of [['rotation', ch.rot], ['translation', ch.pos]]) {
      if (!tr) continue;
      const isRot = path === 'rotation', tol = isRot ? tolOf(skel[o].name) : TOL_POS;
      let vals = tr.values.map((v) => (isRot ? cq(v) : cv(v)));
      if (isRot) for (let i = 1; i < vals.length; i++) { const d = vals[i].reduce((s, x, j) => s + x * vals[i - 1][j], 0); if (d < 0) vals[i] = vals[i].map((x) => -x); }
      // bleibt die ganze Zeit in Ruhe: keine Spur (der Mixer mischt dorthin zurück)
      const rest = isRot ? localTRS[ni].q : localTRS[ni].t;
      if (vals.every((v) => (isRot ? angle(v, rest) : Math.hypot(v[0] - rest[0], v[1] - rest[1], v[2] - rest[2])) <= tol)) { dropped++; continue; }
      const frames = tr.times.map((f) => Math.round(f));
      const keepK = thin(frames, vals, isRot, tol);
      tracks.push({ bone: ni, path, frames: keepK.map((k) => frames[k]), values: keepK.map((k) => vals[k]) });
    }
  }
  return { as, spec, dur, fps: c.fps, tracks, root, speed, move, yaw, loop: !!spec.loop };
});
// Block der Animationen (Accessor "crew-anim"): glTF-Animationen kosten je
// Spur zwei Accessoren, einen Sampler und einen Kanal im JSON, bei rund
// 5 000 Spuren 1,6 MB Text. Aufbau, alles little endian:
//   "CRW1", u16 Clips, u16 Knochen; je Clip u16 Spuren; je Spur u8 Knochen
//   (Folge der Gelenke der Haut), u8 Art (0 Drehung, 1 Lage), u16 Schlüssel n,
//   n × u16 Bild, dann n × 4 × i16 (Drehung / 32767) bzw. n × 3 × f32 (Lage)
const animParts = [];
{
  const h = Buffer.alloc(8); h.write('CRW1', 0, 'latin1'); h.writeUInt16LE(clips.length, 4); h.writeUInt16LE(kept.length, 6); animParts.push(h);
}
let keys = 0;
for (const cl of clips) {
  const h = Buffer.alloc(2); h.writeUInt16LE(cl.tracks.length); animParts.push(h);
  for (const t of cl.tracks) {
    const n = t.frames.length, rot = t.path === 'rotation';
    const b = Buffer.alloc(4 + n * 2 + n * (rot ? 8 : 12));
    b[0] = t.bone; b[1] = rot ? 0 : 1; b.writeUInt16LE(n, 2);
    t.frames.forEach((f, i) => b.writeUInt16LE(f, 4 + i * 2));
    let o = 4 + n * 2;
    for (const v of t.values) {
      if (rot) { const l = Math.hypot(...v) || 1; for (const x of v) { b.writeInt16LE(Math.round((x / l) * 32767), o); o += 2; } }
      else for (const x of v) { b.writeFloatLE(x, o); o += 4; }
    }
    animParts.push(b); keys += n;
  }
}
const animBlob = Buffer.concat(animParts);
console.log(`Animationen: ${clips.length} Clips, ${(clips.reduce((s, c) => s + c.dur, 0)).toFixed(0)} s, ${clips.reduce((s, c) => s + c.tracks.length, 0)} Spuren (${dropped} ruhende weggelassen), ${keys} Schlüssel, ${(animBlob.length / 1024).toFixed(0)} KB`);

// ─── GLB schreiben ────────────────────────────────────────────────────────
const doc = new Document();
const buf = doc.createBuffer();
const acc = (arr, type, norm = false) => doc.createAccessor().setArray(arr).setType(type).setNormalized(norm).setBuffer(buf);
const webp = doc.createExtension(ALL_EXTENSIONS.find((E) => E.EXTENSION_NAME === 'EXT_texture_webp')).setRequired(true);
const texBlend = doc.createTexture('crew-blend').setImage(blendWebp).setMimeType('image/webp').setURI('crew-blend.webp');
const texNorm = doc.createTexture('crew-detail').setImage(detWebp).setMimeType('image/webp').setURI('crew-detail.webp');
void webp;
const mat = doc.createMaterial('crew').setBaseColorTexture(texBlend).setNormalTexture(texNorm).setRoughnessFactor(0.7).setMetallicFactor(0);
const prim = doc.createPrimitive()
  .setAttribute('POSITION', acc(POS, 'VEC3'))
  .setAttribute('NORMAL', acc(NOR, 'VEC3'))
  .setAttribute('TEXCOORD_0', acc(UV, 'VEC2'))
  .setAttribute('TEXCOORD_1', acc(SUB, 'VEC2'))
  .setAttribute('JOINTS_0', acc(JNT, 'VEC4'))
  .setAttribute('WEIGHTS_0', acc(WGT, 'VEC4'))
  .setIndices(acc(tris * 3 < 65536 ? new Uint16Array(IDX.subarray(0, io)) : IDX.subarray(0, io), 'SCALAR'))
  .setMaterial(mat);
const mesh = doc.createMesh('crew').addPrimitive(prim);
const nodes = kept.map((o, i) => doc.createNode(skel[o].name).setTranslation(localTRS[i].t).setRotation(localTRS[i].q));
kept.forEach((o, i) => { const p = skel[o].parent; if (p >= 0) nodes[newIndex.get(p)].addChild(nodes[i]); });
const ibm = new Float32Array(kept.length * 16);
worldM.forEach((m, i) => ibm.set(m.clone().invert().elements, i * 16));
const skin = doc.createSkin('crew').setSkeleton(nodes[0]).setInverseBindMatrices(acc(ibm, 'MAT4'));
for (const nd of nodes) skin.addJoint(nd);
const figure = doc.createNode('crew').setMesh(mesh).setSkin(skin);
const top = doc.createNode('crew-root').addChild(nodes[0]).addChild(figure);
doc.createScene('crew').addChild(top);
// unbenutzter Accessor: der Viewer findet ihn über den Namen
acc(new Uint8Array(animBlob.buffer, animBlob.byteOffset, animBlob.length), 'SCALAR').setName('crew-anim');
const meta = {
  // Knochen, an die der Viewer Werkzeug hängt oder nach denen er misst
  joints: kept.map((o) => skel[o].name),
  bones: { hips: 'Hips', head: 'Head', handR: 'RightHand', handL: 'LeftHand', weaponR: 'RightWeaponBone', footL: 'LeftFoot', footR: 'RightFoot' },
  clips: Object.fromEntries(clips.map((c) => [c.as, { fps: c.fps, dur: +c.dur.toFixed(3), loop: c.loop, speed: +c.speed.toFixed(3), move: c.move, yaw: +c.yaw.toFixed(4), root: c.root, src: c.spec.src.split('#').pop().replace(/^.*\//, '').replace(/\.caf$/, '') }])),
  variants: VARIANTS.map((v) => `deckcrew_${v}`),
  table: { cols: COLS, rows: NSUB, data: table.toString('base64') },
  subs: SUB_NAMES,
  height: +(Math.max(...Array.from({ length: nV }, (_, i) => POS[i * 3 + 1]))).toFixed(3),
};
doc.getRoot().getAsset().extras = { crew: meta };

const nio = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 13, quantizeGeneric: 12 }));
const glb = await nio.writeBinary(doc);
mkdirSync(dirname(OUT_GLB), { recursive: true });
writeFileSync(OUT_GLB, glb);
const v = createHash('sha256').update(glb).digest('hex').slice(0, 8);
const manifest = { url: '/hangar/npc/crew.glb', v, bytes: glb.length, tris, vertices: nV, bones: kept.length, clips: clips.length, variants: VARIANTS.length };
writeFileSync(OUT_JSON, JSON.stringify(manifest, null, 2) + '\n');
console.log(`-> ${OUT_GLB.replace(ROOT, '')} ${(glb.length / 1024).toFixed(0)} KB (v ${v})`);
