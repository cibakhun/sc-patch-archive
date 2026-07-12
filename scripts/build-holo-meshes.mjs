// Baut aus rohen StarBreaker-Schiffs-GLBs leichte Holo-Meshes fürs Web.
//
// Eingabe:  .cache/starbreaker-glb/<slug>.glb   (StarBreaker `entity export`
//           gegen die lokale Data.p4k — grobe Meshes, 20–70 MB, Kitbash-Geometrie)
// Ausgabe:  public/holo/<slug>.glb              (dezimiert + Draco, ~0,3–1 MB)
//           src/data/holo-meshes.json           (Manifest slug -> {url,tris})
//
// Warum echtes Spielmesh statt FleetYards-Holo: die Hardpoints aus
// ship-hardpoints.json (COMPILED_BONES) liegen im GLEICHEN Koordinatenraum wie
// dieses Mesh (auf 1 mm identisch, validiert). Damit sitzen die Marker exakt —
// keine Kalibrierung, kein Schweben. Der Client transformiert die cry-
// Positionen nur per fester Achsvertauschung (x, z, -y) in den glTF-Raum.
//
// Usage:  node scripts/build-holo-meshes.mjs
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, flatten, join, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import { readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const IN_DIR = new URL('../.cache/starbreaker-glb/', import.meta.url);
const OUT_DIR = new URL('../public/holo/', import.meta.url);
const MANIFEST = new URL('../src/data/holo-meshes.json', import.meta.url);
const TARGET_TRIS = 130000; // Silhouette + Grobfläche reichen fürs Hologramm

if (!existsSync(IN_DIR)) { console.error(`fehlt: ${IN_DIR.pathname} (StarBreaker-GLBs ablegen)`); process.exit(1); }
mkdirSync(OUT_DIR, { recursive: true });

await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression])
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

// reine Oberflächen-Deko ohne Silhouetten-Wert -> raus (spart massiv Dreiecke)
const DROP = /decal|damage|livery|_light|light_|glass|window|interior|proxy|shadow|_lod[1-9]|emissive|sticker|logo|stencil/i;

function countTris(root) {
  let t = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices();
    t += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
  }
  return Math.round(t);
}

async function buildOne(slug, inPath) {
  const doc = await io.read(inPath);
  const root = doc.getRoot();

  // 1) Deko-Meshes verwerfen
  for (const mesh of root.listMeshes()) if (DROP.test(mesh.getName() || '')) mesh.dispose();
  for (const node of root.listNodes()) if (DROP.test(node.getName() || '') && node.getMesh()) node.setMesh(null);

  // 2) Material/Texturen + Nicht-Geometrie-Attribute strippen (Holo-Shader
  //    kommt zur Laufzeit) — DANN verschmilzt join alles zu EINEM Primitiv,
  //    über dessen ehemalige Material-Grenzen der Remesher kollabieren kann.
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    p.setMaterial(null);
    for (const sem of p.listSemantics()) if (sem !== 'POSITION' && sem !== 'NORMAL') p.setAttribute(sem, null);
  }
  for (const mat of root.listMaterials()) mat.dispose();
  for (const tex of root.listTextures()) tex.dispose();
  await doc.transform(flatten(), dedup(), join({ keepNamed: false }), weld());

  // 3) Sloppy-Remesh: ignoriert Topologie, bricht auch die vielen separaten
  //    Kitbash-Teile runter (topologie-erhaltender Collapse stockt daran).
  //    error ist relativ zur Meshgröße -> hochtasten, bis das Ziel greift.
  const prim = root.listMeshes()[0]?.listPrimitives()[0];
  if (prim) {
    const pos = prim.getAttribute('POSITION');
    const idxAcc = prim.getIndices();
    const positions = Float32Array.from(pos.getArray());
    const indices = idxAcc ? Uint32Array.from(idxAcc.getArray())
      : Uint32Array.from({ length: pos.getCount() }, (_, i) => i);
    const target = TARGET_TRIS * 3;
    if (indices.length > target) {
      let out;
      for (const err of [8e-4, 1.5e-3, 2.5e-3, 4e-3, 6e-3, 1e-2, 2e-2]) {
        [out] = MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, target, err);
        if (out.length / 3 <= TARGET_TRIS * 1.15) break;
      }
      if (out && out.length >= 30 && idxAcc) idxAcc.setArray(Uint32Array.from(out));
    }
  }
  await doc.transform(prune(), draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 8 }));

  const outPath = new URL(`${slug}.glb`, OUT_DIR);
  await io.write(outPath.pathname.replace(/^\//, ''), doc);
  return { tris: countTris(root), bytes: statSync(outPath).size };
}

const inputs = readdirSync(IN_DIR).filter((f) => f.toLowerCase().endsWith('.glb'));
console.log(`${inputs.length} StarBreaker-GLB(s) gefunden`);
const meshes = {};
for (const f of inputs) {
  const slug = f.replace(/\.glb$/i, '');
  const inPath = new URL(f, IN_DIR).pathname.replace(/^\//, '');
  try {
    const { tris, bytes } = await buildOne(slug, inPath);
    meshes[slug] = { url: `/holo/${slug}.glb`, tris };
    console.log(`  ${slug.padEnd(30)} ${tris.toLocaleString().padStart(8)} Dreiecke  ${(bytes / 1024).toFixed(0)} KB`);
  } catch (err) {
    console.error(`  ${slug}: FEHLER ${err.message}`);
  }
}

await writeFile(MANIFEST, JSON.stringify({
  fetchedAt: new Date().toISOString().slice(0, 10),
  source: 'StarBreaker entity export (Data.p4k) -> gltf-transform/meshopt Dezimierung',
  count: Object.keys(meshes).length,
  meshes,
}, null, 2) + '\n', 'utf8');
console.log(`\nwrote public/holo/*.glb + src/data/holo-meshes.json (${Object.keys(meshes).length} Meshes)`);
