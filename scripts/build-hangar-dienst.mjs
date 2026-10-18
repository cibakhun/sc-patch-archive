#!/usr/bin/env node
// Gerätesatz für den Wartungsplatz am Schiff (18.10.2026).
//
// Der Viewer stellt je Schiff Arbeitsplätze, Leitungen und Ölspuren um den
// Rumpf (Block /* work-dienst */ in assets/hangar-viewer.js). Die Requisiten
// stammen aus dem Gerätekatalog des Spiels (public/hangar/props/, PC-Auftrag
// .planning/notes/hangar-katalog.md): 13 Dateien, zusammen 23,6 MB. Der
// Viewer braucht davon etwa zwanzig Stücke; dieses Skript packt genau die
// Knoten, die der Block nennt, in eine Datei public/hangar/props/dienst.glb.
// Läuft ohne Netz, ohne git und ohne Spieldaten, nur aus dem Repo:
//
//   node scripts/build-hangar-dienst.mjs
//
// Zeichenbudget. Jedes Material ist im Viewer ein Zeichenbefehl (je Material
// ein BatchedMesh). Die Spielrequisiten tragen bis zu 16 Untermaterialien,
// die meisten davon nur eine Tönung mit fein gekachelter Detailkarte (Lack,
// Gummi, Metall). Diese „flachen“ Untermaterialien legt das Skript zu einem
// Material zusammen (dienst_flach): Farbe, Rauheit und Metall wandern als
// Eckenwerte mit (_TINT, _RM), die Tönung mal der mittleren Farbe der
// Detailkarte; die Kachelkarten selbst fallen weg (aus Hangarentfernung
// nicht zu sehen). Was eigene Bilder trägt (Beschriftung, Leisten, Leuchten,
// Bildschirme), bleibt eigenes Material, gleichnamige aus allen Dateien als
// eines. POM-Decals fallen weg wie auf den Schiffen: Im Spiel sind sie
// Reliefschichten, deren Farbbild nie zu sehen ist.
//
// Selbstauskunft: Requisiten, Dreiecke, Materialien (flach und eigene), Bytes.
// Die Datei trägt in asset.extras.dienst den Fingerabdruck des Blocks und
// ihrer Quellen; verify:hangar-hall [14] reißt, wenn sie nicht dazu passt.

import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, draco, unpartition } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import sharp from 'sharp';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeUvIslands, texcoordBits } from './lib/uv-islands.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VIEWER = `${ROOT}assets/hangar-viewer.js`;
const KATALOG = `${ROOT}public/hangar/props/katalog.json`;
const BODEN = `${ROOT}public/hangar/hall/werkstatt-boden.glb`;
const OUT = `${ROOT}public/hangar/props/dienst.glb`;
const FLAT = 'dienst_flach';

const sha = (b) => createHash('sha1').update(b).digest('hex').slice(0, 8);

/** Block /* work-dienst *\/ aus dem Viewer, als Text (Fingerabdruck) und JSON. */
export function readDienst(viewerText) {
  const m = /\/\* work-dienst \*\/([\s\S]*?)\/\* \/work-dienst \*\//.exec(viewerText);
  if (!m) return null;
  return { text: m[1].trim(), block: JSON.parse(m[1]) };
}

/** Knoten, die der Block nennt: Requisiten (prop_*) und Spuren (decal_*). */
export function dienstNodes(block) {
  const props = new Set(), decals = new Set();
  for (const s of block.stationen ?? []) for (const [n] of s.glieder ?? []) props.add(n);
  for (const l of block.leitungen ?? []) props.add(l.node);
  for (const [n] of block.spuren ?? []) decals.add(n);
  return { props: [...props], decals: [...decals] };
}

/** Fingerabdruck: Block, Katalog und jede Quelldatei. */
export function dienstStamp(text, files) {
  return { block: sha(text), quellen: Object.fromEntries(files.map((f) => [f.replace(ROOT, ''), sha(readFileSync(f))])) };
}

// sRGB-Mittel eines Bildes in lineare Farbe
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
async function meanColour(tex) {
  if (!tex) return [1, 1, 1];
  const { channels } = await sharp(Buffer.from(tex.getImage())).stats();
  return channels.slice(0, 3).map((c) => lin(c.mean / 255));
}
async function meanChannel(tex, k) {
  if (!tex) return 1;
  const { channels } = await sharp(Buffer.from(tex.getImage())).stats();
  return (channels[k] ?? channels[0]).mean / 255;
}

// Flach: undurchsichtig, ohne Leuchtkarte, Farbkarte und Normalenkarte
// höchstens als Kachel (KHR_texture_transform mit Maßstab über 1)
function tiled(ti) {
  const tr = ti?.getExtension('KHR_texture_transform');
  return !!tr && Math.max(...tr.getScale()) > 1.5;
}
function isFlat(m) {
  if (!m || m.getAlphaMode() !== 'OPAQUE' || m.getEmissiveTexture()) return false;
  if (m.getBaseColorTexture() && !tiled(m.getBaseColorTextureInfo())) return false;
  if (m.getNormalTexture() && !tiled(m.getNormalTextureInfo())) return false;
  if (m.getMetallicRoughnessTexture() && !tiled(m.getMetallicRoughnessTextureInfo())) return false;
  return true;
}
const isPom = (m) => m?.getAlphaMode() === 'BLEND' && /(^|_)pom(_|$)|decals?_pom/i.test(m.getName());

async function main() {
  const viewer = readFileSync(VIEWER, 'utf8');
  const D = readDienst(viewer);
  if (!D) throw new Error('assets/hangar-viewer.js trägt keinen Block /* work-dienst */');
  const want = dienstNodes(D.block);
  const kat = JSON.parse(readFileSync(KATALOG, 'utf8'));
  const byNode = new Map(kat.props.map((p) => [p.node, p]));
  const files = new Set([BODEN]);
  for (const n of want.props) {
    const p = byNode.get(n);
    if (!p) throw new Error(`${n} steht nicht im Katalog (public/hangar/props/katalog.json)`);
    files.add(`${ROOT}public${p.file}`);
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  const doc = new Document();
  for (const f of [...files].sort()) mergeDocuments(doc, await io.read(f));
  const root = doc.getRoot();
  const scene = doc.createScene('dienst');
  root.setDefaultScene(scene);
  const wanted = new Set([...want.props, ...want.decals]), kept = new Map();
  for (const s of root.listScenes()) {
    if (s === scene) continue;
    for (const n of s.listChildren()) if (wanted.has(n.getName()) && !kept.has(n.getName())) kept.set(n.getName(), n);
    s.dispose();
  }
  const missing = [...wanted].filter((n) => !kept.has(n));
  if (missing.length) throw new Error(`Knoten fehlen in den Quellen: ${missing.join(', ')}`);

  const buf = root.listBuffers()[0];
  const flat = doc.createMaterial(FLAT).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(1);
  const meanCache = new Map();
  const cached = (key, fn) => { if (!meanCache.has(key)) meanCache.set(key, fn()); return meanCache.get(key); };
  const report = [];
  let flatMats = new Set(), ownMats = new Set(), dropped = 0;
  for (const name of [...kept.keys()].sort()) {
    const node = kept.get(name);
    scene.addChild(node);
    const mesh = node.getMesh();
    if (!mesh) throw new Error(`${name} hat kein Mesh`);
    if (node.listChildren().length) throw new Error(`${name} hat Kindknoten; der Satz erwartet ein Mesh je Requisit`);
    // Ursprung unten mittig, ohne eigene Lage (der Viewer setzt sie je Platz)
    const S = node.getScale(), T0 = node.getTranslation(), R0 = node.getRotation();
    if (T0.some((v) => Math.abs(v) > 1e-6) || R0.slice(0, 3).some((v) => Math.abs(v) > 1e-6) || S.some((v) => Math.abs(v - 1) > 1e-6)) throw new Error(`${name} trägt eine eigene Lage (T ${T0}, R ${R0}, S ${S}); der Satz erwartet sie im Mesh`);
    const pos = [], nor = [], tint = [], rm = [], idx = [];
    let tris = 0;
    for (const p of mesh.listPrimitives()) {
      const m = p.getMaterial();
      if (isPom(m)) { mesh.removePrimitive(p); p.dispose(); dropped++; continue; }
      for (const sem of p.listSemantics()) if (!/^(POSITION|NORMAL|TEXCOORD_0)$/.test(sem)) p.setAttribute(sem, null);
      const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), I = p.getIndices();
      if (!N) throw new Error(`${name}: Teil mit ${m?.getName()} ohne Normalen`);
      const cnt = I ? I.getCount() : P.getCount();
      tris += cnt / 3;
      const textured = name.startsWith('decal_') || !isFlat(m);
      if (textured && !p.getAttribute('TEXCOORD_0') && m?.getBaseColorTexture()) throw new Error(`${name}: ${m.getName()} hat ein Bild, der Teil keine Texturkoordinaten`);
      if (textured) {
        // je Material dieselben Attribute (ein BatchedMesh): ohne Bild auch ohne Koordinaten? Dann null
        if (!p.getAttribute('TEXCOORD_0')) p.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(P.getCount() * 2)).setBuffer(root.listBuffers()[0]));
        ownMats.add(m.getName());
        continue;
      }
      // flach: Farbe × mittlere Farbe der Detailkarte, Rauheit und Metall
      const bc = m.getBaseColorFactor(), tex = m.getBaseColorTexture(), mr = m.getMetallicRoughnessTexture();
      const mean = tex ? await cached(tex, () => meanColour(tex)) : [1, 1, 1];
      const col = [0, 1, 2].map((k) => Math.min(1, bc[k] * mean[k]));
      const rough = Math.min(1, Math.max(0.04, m.getRoughnessFactor() * (mr ? await cached(`${mr.getName()}|g`, () => meanChannel(mr, 1)) : 1)));
      const metal = Math.min(1, Math.max(0, m.getMetallicFactor() * (mr ? await cached(`${mr.getName()}|b`, () => meanChannel(mr, 2)) : 1)));
      flatMats.add(m.getName());
      const base = pos.length / 3, a = [0, 0, 0];
      for (let i = 0; i < P.getCount(); i++) {
        P.getElement(i, a); pos.push(a[0], a[1], a[2]);
        N.getElement(i, a); nor.push(a[0], a[1], a[2]);
        tint.push(col[0], col[1], col[2]);
        rm.push(rough, metal);
      }
      for (let i = 0; i < cnt; i++) idx.push(base + (I ? I.getScalar(i) : i));
      mesh.removePrimitive(p);
      p.dispose();
    }
    if (pos.length) {
      const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
      const q = doc.createPrimitive()
        .setAttribute('POSITION', acc('VEC3', new Float32Array(pos)))
        .setAttribute('NORMAL', acc('VEC3', new Float32Array(nor)))
        .setAttribute('_TINT', acc('VEC3', new Float32Array(tint)))
        .setAttribute('_RM', acc('VEC2', new Float32Array(rm)))
        .setIndices(acc('SCALAR', pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)))
        .setMaterial(flat);
      mesh.addPrimitive(q);
    }
    report.push([name, tris, mesh.listPrimitives().length]);
  }
  // Flache Teile ohne Texturkoordinaten, eigene mit: je Material dieselben Attribute
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    if (p.getMaterial() !== flat) { p.setAttribute('_TINT', null); p.setAttribute('_RM', null); }
  }
  // gleichnamige Materialien zu einem (der Katalog benennt sie über alle Dateien gleich)
  const firstOf = new Map();
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial(), key = m.getName();
    if (!firstOf.has(key)) firstOf.set(key, m);
    else if (firstOf.get(key) !== m) p.setMaterial(firstOf.get(key));
  }
  await doc.transform(prune(), dedup(), unpartition());
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) normalizeUvIslands(p, 'TEXCOORD_0');
  const uvBits = texcoordBits(root, 'TEXCOORD_0');
  await doc.transform(draco({ method: 'edgebreaker', quantizeNormal: 10, quantizeTexcoord: uvBits, quantizePosition: 14, quantizeGeneric: 10 }));
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const stamp = dienstStamp(D.text, [KATALOG, ...[...files].sort()]);
  root.getAsset().extras = { dienst: stamp };
  await io.write(OUT, doc);

  const bytes = statSync(OUT).size, mats = root.listMaterials().length;
  const T = report.reduce((s, r) => s + r[1], 0);
  console.log(`Gerätesatz ${OUT.replace(ROOT, '')}: ${want.props.length} Requisiten, ${want.decals.length} Spuren, ${Math.round(T)} Dreiecke, ${mats} Materialien (${FLAT} aus ${flatMats.size} flachen, ${mats - 1} eigene), ${dropped} POM-Teile weg, ${(bytes / 1048576).toFixed(2)} MB`);
  for (const [n, t, k] of report) console.log(`  ${n.padEnd(52)} ${String(Math.round(t)).padStart(6)} Dreiecke  ${k} Teile`);
  console.log(`  eigene Materialien: ${root.listMaterials().map((m) => m.getName()).filter((n) => n !== FLAT).join(', ')}`);
  console.log(`  Fingerabdruck: Block ${stamp.block}, ${Object.keys(stamp.quellen).length} Quellen`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
