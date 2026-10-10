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

   FUELLUNG (seit 10.10.2026): Was die dichte Kopie an einer Stelle ganz
   weglaesst, steht in FILL, je Eintrag ein Material und ein Kasten im
   Modellraum der Halle. Die Datei nimmt dort die Dreiecke der vollen
   Stufe mit, die die dichte Kopie nicht deckungsgleich traegt (ihr
   Schwerpunkt liegt weiter als FILL_TOL von jeder Flaeche der dichten
   Kopie), als Knoten mit extras.fill (Name des Eintrags). Der Viewer setzt
   sie nur dazu (Marke hall-fill). Vermessen am 10.10.2026: Aus dem Raum
   sichtbar fehlen der Seite weniger als 8 m² Flaeche der vollen Stufe,
   die weiter als 30 cm von ihren eigenen liegt; davon 5 m² eine
   Holzblende auf einem Deckenkasten, der erste Eintrag in FILL.

   Ergaenzung und Fuellung bringen von ihren Materialien nur Name und
   Faktoren mit, ohne Texturen: Der Viewer gibt ihnen das gleichnamige
   Material der dichten Kopie.

   Gleiche Quelle, gleiche Datei: Die Ausgabe nennt in extras.furnitureOf
   Datei und sha1 ihrer Quelle, die Regel der Ergaenzung und die der
   Fuellung samt sha1 der dichten Kopie, gegen die sie gerechnet ist.
   Stimmt alles,
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
import { prune, draco, compactPrimitive } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import { texcoordBits } from './lib/uv-islands.mjs';
import { FILL_TOL, inBox, touches, centroid, worldTris, dist2 } from './lib/hall-fill.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'src/data/hangar-assets.json');
const HALL_DIR = join(ROOT, 'public/hangar/hall');

// Was die dichte Kopie zu duenn traegt und die Datei darum ganz aus der
// vollen Stufe mitnimmt (Materialname). Aendert sich die Regel, baut sich
// die Datei neu (extras.furnitureOf.detail.rule).
const DETAIL = /glass|nernies_pipes_011/i;
// Was die dichte Kopie an einer Stelle ganz weglaesst: Material (voller
// Name) und Kasten im Modellraum der Halle. Jeder Eintrag nennt, was dort
// fehlte; verify:hangar-hall haelt je Eintrag eine Klinke.
const FILL = [
  // Auf dem Deckenkasten an der Ostwand, nahe dem Nordtor, steht in der
  // vollen Stufe eine Holzblende (2 x 4,8 m, 16 cm stark). Der dichten
  // Kopie fehlt sie ganz, der Kasten wirkte dort von unten offen
  // (Flaechenvergleich und Bild, 10.10.2026).
  { name: 'Holzblende auf dem Deckenkasten', material: 'hangar_deluxe_kit_master_mtl_wood_largeplank_020', box: [[63.9, 36.9, -116.9], [64.3, 39.1, -111.9]] },
];
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');
const FILL_RULE = sha1(JSON.stringify({ FILL, FILL_TOL })).slice(0, 12);
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
  // Die Fuellung rechnet gegen die dichte Kopie, die die Seite dazu laedt
  const liteName = `${key}-lod1.glb`, liteFile = join(HALL_DIR, liteName);
  const liteBytes = existsSync(liteFile) && liteName !== srcName ? readFileSync(liteFile) : null;
  const liteHash = liteBytes ? sha1(liteBytes) : null;
  const had = existsSync(out) ? glbJson(out)?.extras?.furnitureOf : null;
  if (had?.file === srcName && had?.sha1 === hash && had?.detail?.rule === DETAIL.source && had?.fill?.rule === FILL_RULE && (had?.fill?.sha1 ?? null) === liteHash) {
    const filled = (had.fill.regions ?? []).reduce((sum, r) => sum + r.tris, 0);
    console.log(`Einrichtung ${key}: aktuell (${had.nodes} Moebel, ${had.detail.tris} Dreiecke Ergaenzung und ${filled} Fuellung aus ${srcName}, sha1 ${hash.slice(0, 8)})`);
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
  // Je Eintrag der Fuellung die Dreiecke der dichten Kopie um seinen Kasten
  const regions = FILL.map((f) => ({ ...f, near: [], tris: 0, skipped: 0 }));
  if (liteBytes && regions.length) {
    const lite = await io.readBinary(new Uint8Array(liteBytes));
    for (const n of lite.getRoot().listNodes()) for (const p of n.getMesh()?.listPrimitives() ?? []) {
      for (const t of worldTris(n, p)) for (const r of regions) if (touches(r.box, t, 0.05)) r.near.push(t);
    }
  }
  const scene = root.listScenes()[0];
  // Ergaenzung und Fuellung tragen von ihrem Material nur Name und Faktoren:
  // Der Viewer gibt ihnen das gleichnamige der dichten Kopie, mit deren
  // Texturen; die der vollen Stufe kaemen sonst ungenutzt mit.
  const stubs = new Map();
  const stub = (m) => {
    const name = m?.getName() ?? '';
    if (!stubs.has(name)) stubs.set(name, doc.createMaterial(name).setAlphaMode(m.getAlphaMode()).setAlphaCutoff(m.getAlphaCutoff()).setDoubleSided(m.getDoubleSided()).setBaseColorFactor(m.getBaseColorFactor()).setMetallicFactor(m.getMetallicFactor()).setRoughnessFactor(m.getRoughnessFactor()));
    return stubs.get(name);
  };
  for (const n of root.listNodes()) {
    const x = n.getExtras() ?? {};
    if (x.fill != null) continue; // eben angelegt
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
        if (DETAIL.test(name)) { detail[name] = (detail[name] ?? 0) + count(p); detailTris += count(p); p.setMaterial(stub(p.getMaterial())); continue; }
        // Fuellung: was davon im Kasten liegt und die dichte Kopie nicht
        // deckungsgleich traegt, als eigener Knoten (ohne Kopie keine)
        for (const r of liteBytes ? regions : []) {
          if (name !== r.material) continue;
          const I = p.getIndices()?.getArray(), keep = [];
          worldTris(n, p).forEach((t, i) => {
            const c = centroid(t);
            if (!inBox(r.box, c)) return;
            if (r.near.some((l) => dist2(c, l) <= FILL_TOL * FILL_TOL)) { r.skipped++; return; }
            keep.push(...(I ? [I[i * 3], I[i * 3 + 1], I[i * 3 + 2]] : [i * 3, i * 3 + 1, i * 3 + 2]));
          });
          if (!keep.length) continue;
          const part = p.clone().setMaterial(stub(p.getMaterial())).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)).setBuffer(p.getAttribute('POSITION').getBuffer()));
          compactPrimitive(part);
          scene.addChild(doc.createNode(`fill:${r.name}`).setMesh(doc.createMesh(`fill:${r.name}`).addPrimitive(part)).setMatrix(n.getWorldMatrix()).setExtras({ fill: r.name }));
          r.tris += keep.length / 3;
        }
        mesh.removePrimitive(p); p.dispose();
      }
      if (mesh.listPrimitives().length) n.setExtras({ ...x, detail: true });
      else n.dispose();
    }
  }
  // Wie der Build: Lage 16 Bit (Halle), Normalen 10, UV so fein wie noetig
  await doc.transform(prune(), draco({ method: 'edgebreaker', quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: Math.max(texcoordBits(root, 'TEXCOORD_0'), texcoordBits(root, 'TEXCOORD_1')) }));
  const fill = { rule: FILL_RULE, file: liteBytes ? liteName : null, sha1: liteHash, regions: regions.map((r) => ({ name: r.name, material: r.material, tris: r.tris, skipped: r.skipped })) };
  root.setExtras({ ...(root.getExtras() ?? {}), furnitureOf: { file: srcName, sha1: hash, nodes, tris, detail: { rule: DETAIL.source, tris: detailTris, materials: detail }, fill } });
  const glb = await io.writeBinary(doc);
  writeFileSync(out, glb);
  const filled = fill.regions.map((r) => `${r.name} ${r.tris}, ${r.skipped} deckungsgleich ausgelassen`).join('; ');
  console.log(`Einrichtung ${key}: ${nodes} Moebel, ${tris} Dreiecke, Ergaenzung ${detailTris} Dreiecke in ${Object.keys(detail).length} Materialien, Fuellung ${liteBytes ? filled || 'keine' : `keine (${liteName} fehlt)`}, ${(glb.byteLength / 1e6).toFixed(1)} MB -> public/hangar/hall/${key}.furniture.glb (aus ${srcName}, sha1 ${hash.slice(0, 8)})`);
}
