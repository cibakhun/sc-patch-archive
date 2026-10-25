#!/usr/bin/env node
// Leitungen unter der Decke der Werkhalle (24.10.2026).
//
// Krisz zur fast schwarzen Decke der Werkhalle: „decke iwi verbessern,
// rohre, kablen etc“. Der Viewer hängt Lüftungskanäle, Rohre, Kabelzüge und
// Seilrollen aus dem Gerätekatalog des Spiels (public/hangar/props/) unter
// die Decke; welche und wo, steht im Block /* work-werkdecke */ in
// assets/hangar-viewer.js. Dieses Skript packt genau die Knoten, die der
// Block nennt, in public/hangar/props/werkdecke.glb. Läuft ohne Netz, ohne
// git und ohne Spieldaten, nur aus dem Repo:
//
//   node scripts/build-werkhalle-decke.mjs
//
// Anders als der Gerätesatz (build-hangar-dienst.mjs) bleiben die
// Materialien, wie der Katalog sie trägt: Die Werkhalle hat ihr eigenes
// Licht (werkShader), und der Viewer legt es auf die Materialien der
// Garage wie auf diese. POM-Decals fallen weg wie dort (Reliefschichten,
// deren Farbbild im Spiel nie zu sehen ist). Bilder höchstens 512 px: Die
// Stücke hängen 7 bis 8 m hoch, meist 10 bis 30 m von der Kamera.
//
// Selbstauskunft: Stücke, Dreiecke, Materialien, Bytes. Die Datei trägt in
// asset.extras.werkdecke den Fingerabdruck des Blocks und ihrer Quellen;
// verify:hangar-hall [18] reißt, wenn sie nicht dazu passt.

import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, draco, unpartition } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import sharp from 'sharp';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readBlock, dienstStamp } from './build-hangar-dienst.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VIEWER = `${ROOT}assets/hangar-viewer.js`;
const KATALOG = `${ROOT}public/hangar/props/katalog.json`;
export const WERKDECKE_OUT = `${ROOT}public/hangar/props/werkdecke.glb`;
export const WERKDECKE_TEX = 512;

/** Knoten, die der Block nennt (Stücke und Läufe). */
export function werkdeckeNodes(block) {
  const n = new Set();
  for (const s of block.stuecke ?? []) n.add(s[0]);
  for (const l of block.laeufe ?? []) n.add(l.node);
  return [...n];
}
export const readWerkdecke = (viewerText) => readBlock(viewerText, 'werkdecke');
const isPom = (m) => m?.getAlphaMode() === 'BLEND' && /(^|_)pom(_|$)|decals?_pom/i.test(m.getName());

async function main() {
  const viewer = readFileSync(VIEWER, 'utf8');
  const D = readWerkdecke(viewer);
  if (!D) throw new Error('assets/hangar-viewer.js trägt keinen Block /* work-werkdecke */');
  const want = werkdeckeNodes(D.block);
  const kat = JSON.parse(readFileSync(KATALOG, 'utf8'));
  const byNode = new Map(kat.props.map((p) => [p.node, p]));
  const files = new Set();
  for (const n of want) {
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
  const scene = doc.createScene('werkdecke');
  root.setDefaultScene(scene);
  const wanted = new Set(want), kept = new Map();
  for (const s of root.listScenes()) {
    if (s === scene) continue;
    for (const n of s.listChildren()) if (wanted.has(n.getName()) && !kept.has(n.getName())) kept.set(n.getName(), n);
    s.dispose();
  }
  const missing = want.filter((n) => !kept.has(n));
  if (missing.length) throw new Error(`Knoten fehlen in den Quellen: ${missing.join(', ')}`);
  const report = [];
  let dropped = 0;
  for (const name of [...kept.keys()].sort()) {
    const node = kept.get(name);
    scene.addChild(node);
    const mesh = node.getMesh();
    if (!mesh) throw new Error(`${name} hat kein Mesh`);
    if (node.listChildren().length) throw new Error(`${name} hat Kindknoten; der Satz erwartet ein Mesh je Stück`);
    const S = node.getScale(), T0 = node.getTranslation(), R0 = node.getRotation();
    if (T0.some((v) => Math.abs(v) > 1e-6) || R0.slice(0, 3).some((v) => Math.abs(v) > 1e-6) || S.some((v) => Math.abs(v - 1) > 1e-6)) throw new Error(`${name} trägt eine eigene Lage (T ${T0}, R ${R0}, S ${S}); der Satz erwartet sie im Mesh`);
    let tris = 0;
    for (const p of mesh.listPrimitives()) {
      if (isPom(p.getMaterial())) { mesh.removePrimitive(p); p.dispose(); dropped++; continue; }
      for (const sem of p.listSemantics()) if (!/^(POSITION|NORMAL|TEXCOORD_0)$/.test(sem)) p.setAttribute(sem, null);
      const I = p.getIndices();
      tris += (I ? I.getCount() : p.getAttribute('POSITION').getCount()) / 3;
    }
    report.push([name, tris, mesh.listPrimitives().length]);
  }
  // gleichnamige Materialien zu einem (der Katalog benennt sie über alle Dateien gleich)
  const firstOf = new Map();
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial(), key = m.getName();
    if (!firstOf.has(key)) firstOf.set(key, m);
    else if (firstOf.get(key) !== m) p.setMaterial(firstOf.get(key));
  }
  await doc.transform(prune({ keepAttributes: true }), dedup(), unpartition());
  let shrunk = 0;
  for (const t of root.listTextures()) {
    const img = t.getImage();
    if (!img) continue;
    const meta = await sharp(Buffer.from(img)).metadata();
    if (Math.max(meta.width, meta.height) <= WERKDECKE_TEX) continue;
    t.setImage(new Uint8Array(await sharp(Buffer.from(img)).resize(WERKDECKE_TEX, WERKDECKE_TEX, { fit: 'inside' }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toBuffer())).setMimeType('image/webp');
    shrunk++;
  }
  await doc.transform(draco({ method: 'edgebreaker', quantizeNormal: 10, quantizeTexcoord: 12, quantizePosition: 14 }));
  doc.createExtension(KHRDracoMeshCompression).setRequired(true);
  doc.createExtension(EXTTextureWebP).setRequired(true);
  root.getAsset().extras = { werkdecke: dienstStamp(D.text, [KATALOG, ...[...files].sort()]) };
  await io.write(WERKDECKE_OUT, doc);
  const bytes = statSync(WERKDECKE_OUT).size, T = report.reduce((s, r) => s + r[1], 0);
  console.log(`Decke der Werkhalle ${WERKDECKE_OUT.replace(ROOT, '')}: ${want.length} Stücke, ${Math.round(T)} Dreiecke, ${root.listMaterials().length} Materialien, ${dropped} POM-Teile weg, ${shrunk} Bilder verkleinert, ${(bytes / 1048576).toFixed(2)} MB`);
  for (const [n, t, k] of report) console.log(`  ${n.padEnd(52)} ${String(Math.round(t)).padStart(6)} Dreiecke  ${k} Teile`);
  console.log(`  Materialien: ${root.listMaterials().map((m) => m.getName()).join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
