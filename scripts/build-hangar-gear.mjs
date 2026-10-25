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
import { openP4k, DEFAULT_P4K } from './lib/p4k.mjs';
import { openDataCore } from './lib/datacore.mjs';
import { initGear, poseShip, GEAR_DROP } from './lib/landing-gear.mjs';

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
const p4k = openP4k(DEFAULT_P4K);
initGear(p4k, openDataCore(p4k.read(/^Data[\\/]Game2\.dcb$/i)));

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

// Pose und Aufstand: scripts/lib/landing-gear.mjs (dieselbe Pose wie die Web-Fassung)
async function oneShip(slug, meta) {
  const doc = await io.read(`${RAW}${slug}.glb`);
  const root = doc.getRoot();
  // Innenraum und Deko weg (wie die Holo-Fassung)
  for (const scene of root.listScenes()) for (const top of scene.listChildren()) for (const c of top.listChildren()) if (/^interior_/i.test(c.getName())) { c.traverse((n) => n.setMesh(null)); top.removeChild(c); }
  for (const node of root.listNodes()) if (node.getMesh() && GEAR_DROP.test(node.getName() || '')) node.setMesh(null);
  return { out: poseShip(doc, meta.record), doc };
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
