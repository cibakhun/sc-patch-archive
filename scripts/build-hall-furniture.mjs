/* ============================================================
   build-hall-furniture.mjs — die Einrichtung der Halle als eigene Datei
   (laeuft in `npm run build` und `npm run dev`, vor Astro).

   WARUM ES DEN GIBT: Die volle Hallenstufe (<halle>.glb, vom PC gebaut)
   stellt jedes Moebel als eigenen Knoten mit Bezugspunkt
   (extras.furniture, extras.anchor). Ihre Waende und Boeden sehen am
   Bildschirm aus wie die der dichten Kopie (<halle>-lod1.glb, ohne
   Moebel), kosten aber das Vierfache an Dreiecken und das Doppelte an
   Bytes (Vergleich im selben Blick am 08.10.2026: neu sind nur Pflanzen,
   Kisten und Moebel). Darum laedt die Seite am Rechner die dichte Kopie
   und dazu nur die Moebel. Dieses Skript schneidet sie aus der vollen
   Stufe nach public/hangar/hall/<halle>.furniture.glb (gitignored wie
   public/assets; HangarApp.astro reicht sie weiter, wenn es sie gibt).

   ERGAENZUNG (seit 10.10.2026): Ganz gleich sind die Stufen doch nicht.
   Der dichten Kopie fehlen zwei Drittel des Glases (7 297 statt 19 946
   Dreiecke): die Abdeckungen der Kabelrinnen an den Seitenwaenden und
   der Bodenkanaele, die hinteren Scheiben der vier Glassaeulen, die
   Kabine an der Suedwand und sechs Glaskoerper hoch an den
   Seitenwaenden. Dazu die Rohre in den Glassaeulen. Wo das Glas fehlt,
   liegen Kabel und Kanaele blank, und durch die Tuersymbole der
   Glassaeulen sieht man schwarz. Strahlen aus dem Raum gegen beide
   Stufen (10.10.2026): sonst unterscheiden sie sich nur um Fasen und
   Rundungen. Darum nimmt die Datei diese Materialien (DETAIL) ganz aus
   der vollen Stufe mit, als Knoten mit extras.detail; der Viewer laesst
   dafuer die Teile der dichten Kopie mit denselben Materialien fallen
   (Marke hall-detail in assets/hangar-viewer.js). 15 482 Dreiecke, ohne
   Texturen bis auf 1 KB.

   Gleiche Quelle, gleiche Datei: Die Ausgabe nennt in extras.furnitureOf
   Datei und sha1 ihrer Quelle und die Regel der Ergaenzung. Stimmt alles,
   bleibt sie liegen. Traegt die Quelle keine Moebel mehr, verschwindet eine
   alte Ausgabe, damit die Seite keine veraltete Einrichtung laedt.
   verify:hangar-hall prueft am Artefakt, dass die ausgelieferte
   Einrichtung zur ausgelieferten vollen Stufe passt und die Ergaenzung
   alles ersetzt, was die dichte Kopie davon traegt.

       node scripts/build-hall-furniture.mjs
   ============================================================ */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import { texcoordBits } from './lib/uv-islands.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'src/data/hangar-assets.json');
const HALL_DIR = join(ROOT, 'public/hangar/hall');

// Was die dichte Kopie zu duenn traegt und die Datei darum ganz aus der
// vollen Stufe mitnimmt (Materialname). Aendert sich die Regel, baut sich
// die Datei neu (extras.furnitureOf.detail.rule).
const DETAIL = /glass|nernies_pipes_011/i;
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');
// Nur den JSON-Block eines GLB lesen (Kopf 12 Bytes, dann Laenge, Typ, JSON)
function glbJson(file) {
  const b = readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) return null;
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
let io = null;
for (const [key, asset] of Object.entries(manifest.hall ?? {})) {
  const out = join(HALL_DIR, `${key}.furniture.glb`);
  const srcName = String(asset?.url ?? '').split('?')[0].split('/').pop();
  const src = join(HALL_DIR, srcName);
  const drop = (why) => {
    if (existsSync(out)) { rmSync(out); console.log(`Einrichtung ${key}: ${why}, alte Datei entfernt`); }
    else console.log(`Einrichtung ${key}: ${why}, keine Datei`);
  };
  if (!srcName || !existsSync(src)) { drop(`Quelle ${srcName || '(keine)'} fehlt`); continue; }
  const bytes = readFileSync(src), hash = sha1(bytes);
  const had = existsSync(out) ? glbJson(out)?.extras?.furnitureOf : null;
  if (had?.file === srcName && had?.sha1 === hash && had?.detail?.rule === DETAIL.source) {
    console.log(`Einrichtung ${key}: aktuell (${had.nodes} Moebel und ${had.detail.tris} Dreiecke Ergaenzung aus ${srcName}, sha1 ${hash.slice(0, 8)})`);
    continue;
  }
  // Ohne Moebelknoten (etwa die dichte Kopie als Hauptstufe) gar nicht erst dekodieren
  if (!(glbJson(src)?.nodes ?? []).some((n) => n.extras?.furniture != null && Array.isArray(n.extras?.anchor))) {
    drop(`${srcName} stellt keine Moebel als eigene Knoten`);
    continue;
  }
  io ??= new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
  const doc = await io.readBinary(new Uint8Array(bytes));
  const root = doc.getRoot();
  let nodes = 0, tris = 0, detailTris = 0;
  const detail = {};
  const count = (p) => (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  for (const n of root.listNodes()) {
    const x = n.getExtras() ?? {};
    const furn = x.furniture != null && Array.isArray(x.anchor);
    const mesh = n.getMesh();
    if (furn) {
      nodes++;
      for (const p of mesh?.listPrimitives() ?? []) tris += count(p);
    } else if (mesh) {
      // Hallenknoten: nur die Primitive der Ergaenzung bleiben (die Halle
      // kommt nach Material zusammengelegt, ein Primitiv je Material)
      for (const p of mesh.listPrimitives()) {
        const name = p.getMaterial()?.getName() ?? '';
        if (DETAIL.test(name)) { detail[name] = (detail[name] ?? 0) + count(p); detailTris += count(p); }
        else { mesh.removePrimitive(p); p.dispose(); }
      }
      if (mesh.listPrimitives().length) n.setExtras({ ...x, detail: true });
      else n.dispose();
    }
  }
  // Wie der Build: Lage 16 Bit (Halle), Normalen 10, UV so fein wie noetig
  await doc.transform(prune(), draco({ method: 'edgebreaker', quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: Math.max(texcoordBits(root, 'TEXCOORD_0'), texcoordBits(root, 'TEXCOORD_1')) }));
  root.setExtras({ ...(root.getExtras() ?? {}), furnitureOf: { file: srcName, sha1: hash, nodes, tris, detail: { rule: DETAIL.source, tris: detailTris, materials: detail } } });
  const glb = await io.writeBinary(doc);
  writeFileSync(out, glb);
  console.log(`Einrichtung ${key}: ${nodes} Moebel, ${tris} Dreiecke, Ergaenzung ${detailTris} Dreiecke in ${Object.keys(detail).length} Materialien, ${(glb.byteLength / 1e6).toFixed(1)} MB -> public/hangar/hall/${key}.furniture.glb (aus ${srcName}, sha1 ${hash.slice(0, 8)})`);
}
