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
   Modellraum der Halle. Die Datei nimmt die Dreiecke der vollen Stufe mit
   diesem Material, auf den Kasten zugeschnitten (Lage, Normalen und
   Texturkoordinaten laufen am Schnitt linear mit), ohne die, die die
   dichte Kopie an allen Probepunkten ohnehin traegt (naeher als
   FILL_TOL), als Knoten mit extras.fill (Name des Eintrags) im Modellraum.
   Der Viewer setzt sie nur dazu (Marke hall-fill). Zugeschnitten, weil
   die volle Stufe grosse Dreiecke ueber die Luecke hinaus fuehrt: Die
   Holzblende ist je Seite ein Rechteck aus zwei Dreiecken, unten liegt
   ihr die dichte Kopie mit Kunststoff auf, oben fehlt sie. Nach Dreiecken
   ausgewaehlt kam nur eines der beiden, die Blende endete schraeg, und wo
   es unten auflag, flimmerte es. Vermessen am 10.10.2026 (Proben aus dem
   Raum gegen beide Stufen, 10 cm): Sichtbar fehlen der Seite noch 11 m²,
   ein Rohrstueck mitten an der Decke, Leisten unten und oben am Nordtor
   und die Holzblende. Die Eintraege in FILL schliessen alles bis auf die
   Leisten oben am Tor.

   Ergaenzung und Fuellung bringen von ihren Materialien nur Name und
   Faktoren mit, ohne Texturen: Der Viewer gibt ihnen das gleichnamige
   Material der dichten Kopie. Ihre Attribute (Texturkoordinaten,
   Eckfarben) bleiben, wie das Material der vollen Stufe sie braucht, bei
   der Fuellung genau die der gleichnamigen Primitive der dichten Kopie.

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
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import { texcoordBits } from './lib/uv-islands.mjs';
import { FILL_TOL, touches, samples, clipToBox, worldTris, normalOf, withNormals, onLite } from './lib/hall-fill.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'src/data/hangar-assets.json');
const HALL_DIR = join(ROOT, 'public/hangar/hall');

// Was die dichte Kopie zu duenn traegt und die Datei darum ganz aus der
// vollen Stufe mitnimmt (Materialname). Aendert sich die Regel, baut sich
// die Datei neu (extras.furnitureOf.detail.rule).
const DETAIL = /glass|nernies_pipes_011/i;
// Was die dichte Kopie an einer Stelle ganz weglaesst: Material (voller
// Name) und Kasten im Modellraum der Halle, auf den die Teile der vollen
// Stufe zugeschnitten werden. Jeder Eintrag nennt, was dort fehlte;
// verify:hangar-hall haelt je Eintrag eine Klinke.
const FILL = [
  // Auf dem Deckenkasten an der Ostwand, nahe dem Nordtor, steht in der
  // vollen Stufe eine Holzblende (2 x 4,8 m, 16 cm stark). Bis 37,9 m
  // traegt die dichte Kopie an ihrer Stelle Kunststoff (in der vollen
  // Stufe liegen beide in einer Ebene), darauf eine Eichenleiste bis
  // 38,0 m; darueber fehlt ihr die Blende ganz, der Kasten wirkte dort von
  // unten offen (Flaechenvergleich und Bild, 10.10.2026). Der Kasten
  // beginnt darum ueber der Leiste.
  { name: 'Holzblende auf dem Deckenkasten', material: 'hangar_deluxe_kit_master_mtl_wood_largeplank_020', box: [[63.9, 38.0, -116.9], [64.3, 39.1, -111.9]] },
  // Mitten an der Decke laeuft ein Rohr (80 cm stark) die Halle entlang.
  // Der dichten Kopie fehlt ein Stueck von 4 m davon (z -102 bis -98), von
  // unten sah man dort die Decke durch; ab z -102 traegt sie es selbst
  // (Strahlen und Bild, 10.10.2026).
  { name: 'Rohrstueck mitten an der Decke', material: 'hangar_deluxe_kit_master_mtl_metal_grey_04', box: [[35.5, 48.4, -102.0], [36.5, 49.4, -97.95]] },
  // Unten im Nordtor zwei Schlitze (2,6 x 0,4 m, 19 cm tief). In der
  // vollen Stufe schliesst sie eine Rueckwand aus weissem Metall; der
  // dichten Kopie fehlt sie, man sah 7 cm dahinter ins Dunkle, die
  // Schlitze standen schwarz statt grau (Bild und Flaechenvergleich,
  // 10.10.2026). Der Kasten fasst nur die Ebene der Rueckwand.
  { name: 'Rueckwand der Schlitze unten im Nordtor', material: 'hangar_deluxe_kit_master_mtl_metal_white_03', box: [[23.0, 1.9, -144.62], [49.0, 2.4, -144.57]] },
];
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');
// Die Regel der Fuellung samt dem Code, der sie rechnet: Aendert sich
// eines davon, baut sich die Datei neu
const FILL_RULE = sha1(JSON.stringify({ FILL, FILL_TOL }) + readFileSync(fileURLToPath(import.meta.url)) + readFileSync(fileURLToPath(new URL('./lib/hall-fill.mjs', import.meta.url)))).slice(0, 12);

// Schneidet die Dreiecke einer Primitive der vollen Stufe auf den Kasten
// eines Eintrags zu, im Modellraum der Halle (Lage mit der Matrix ihres
// Knotens, Normalen mit deren Inverser-Transponierter, Drehsinn bei
// Spiegelung gewendet), und sammelt in r.out die Ecken der Dreiecke, die
// die dichte Kopie nicht an allen Probepunkten schon traegt. Attribute
// genau die einer gleichnamigen Primitive der dichten Kopie (r.sems; traegt
// sie das Material mit und ohne Eckfarben, je Primitive der vollen Stufe
// die passende, und je Satz eine Primitive in der Ausgabe).
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
function clipInto(r, node, prim) {
  const have = new Set(prim.listSemantics());
  const sem = [...r.sems.values()].filter((x) => x.every(([s]) => have.has(s))).sort((a, b) => b.length - a.length)[0];
  const w = node.getWorldMatrix(), M = [0, 1, 2].map((a) => [w[a], w[4 + a], w[8 + a]]);
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const C = [cross(M[1], M[2]), cross(M[2], M[0]), cross(M[0], M[1])];
  const sgn = Math.sign(M[0][0] * C[0][0] + M[0][1] * C[0][1] + M[0][2] * C[0][2]) || 1;
  const P = prim.getAttribute('POSITION'), I = prim.getIndices(), acc = sem?.map(([s]) => prim.getAttribute(s)), e = [];
  const mul = (R, v) => R.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
  const pos = (i) => mul(M, P.getElement(i, e)).map((v, a) => v + w[12 + a]);
  const vert = (i, p) => ({ p, a: sem.map(([s], k) => {
    if (s === 'POSITION') return p;
    const v = acc[k].getElement(i, []);
    if (s === 'NORMAL') return unit(mul(C, v)).map((x) => x * sgn);
    if (s === 'TANGENT') return [...unit(mul(M, v)), v[3] * sgn];
    return v;
  }) });
  const area2 = (t) => Math.hypot(...cross(t[1].map((v, a) => v - t[0][a]), t[2].map((v, a) => v - t[0][a])));
  const n = I ? I.getCount() : P.getCount();
  for (let t = 0; t + 2 < n; t += 3) {
    const ids = I ? [I.getScalar(t), I.getScalar(t + 1), I.getScalar(t + 2)] : [t, t + 1, t + 2];
    if (sgn < 0) ids.reverse();
    const ps = ids.map(pos);
    if (!touches(r.box, ps)) continue;
    // Kein Attributsatz der dichten Kopie passt: zaehlen, nicht mitnehmen
    if (!sem) { r.lost++; r.why = r.sems.size ? `einer Primitive der vollen Stufe fehlen Attribute (${[...have].sort().join(',')})` : 'die dichte Kopie traegt das Material nicht'; continue; }
    const key = sem.map(([s]) => s).join(',');
    r.src ??= prim.getMaterial();
    const out = (r.out[key] ??= { sem, verts: [] }).verts;
    const poly = clipToBox(ids.map((i, k) => vert(i, ps[k])), r.box);
    for (let k = 1; k + 1 < poly.length; k++) {
      const tri = [poly[0], poly[k], poly[k + 1]], q = tri.map((v) => v.p);
      if (area2(q) < 1e-8) continue; // Splitter vom Schnitt durch eine Ecke
      const nq = normalOf(q), on = samples(q).filter((s) => onLite(s, nq, r.near)).length;
      if (on === 4) { r.skipped++; continue; }
      if (on) r.partial++;
      out.push(...tri);
    }
  }
}
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
  // und die Attribute ihrer Primitive mit seinem Material: Die Fuellung
  // traegt genau dieselben (gleiches Shaderprogramm, Texturen an der
  // richtigen Stelle)
  const regions = FILL.map((f) => ({ ...f, near: [], sems: new Map(), out: {}, src: null, tris: 0, skipped: 0, partial: 0, lost: 0, why: null }));
  if (liteBytes && regions.length) {
    const lite = await io.readBinary(new Uint8Array(liteBytes));
    for (const n of lite.getRoot().listNodes()) for (const p of n.getMesh()?.listPrimitives() ?? []) {
      const name = p.getMaterial()?.getName() ?? '';
      for (const r of regions) if (name === r.material) { const sem = p.listSemantics().sort(); r.sems.set(sem.join(','), sem.map((s) => [s, p.getAttribute(s).getElementSize()])); }
      for (const t of worldTris(n, p)) for (const r of regions) if (touches(r.box, t, 0.05)) r.near.push(t);
    }
    for (const r of regions) r.near = withNormals(r.near);
  }
  const scene = root.listScenes()[0];
  const stubbed = [];
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
        if (DETAIL.test(name)) { detail[name] = (detail[name] ?? 0) + count(p); detailTris += count(p); stubbed.push(p); continue; }
        for (const r of liteBytes ? regions : []) if (name === r.material) clipInto(r, n, p);
        mesh.removePrimitive(p); p.dispose();
      }
      if (mesh.listPrimitives().length) n.setExtras({ ...x, detail: true });
      else n.dispose();
    }
  }
  // Fuellung je Eintrag ein Knoten im Modellraum der Halle, je
  // Attributsatz eine Primitive
  const buffer = root.listBuffers()[0];
  for (const r of regions) {
    const parts = Object.values(r.out).filter((o) => o.verts.length);
    if (!parts.length) continue;
    const mesh = doc.createMesh(`fill:${r.name}`);
    for (const { sem, verts } of parts) {
      const prim = doc.createPrimitive().setMaterial(r.src);
      sem.forEach(([s, size], k) => {
        const arr = new Float32Array(verts.length * size);
        verts.forEach((v, i) => arr.set(s === 'NORMAL' ? unit(v.a[k]) : v.a[k], i * size));
        prim.setAttribute(s, doc.createAccessor().setType(size === 1 ? 'SCALAR' : `VEC${size}`).setArray(arr).setBuffer(buffer));
      });
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(verts, (_, i) => i)).setBuffer(buffer));
      mesh.addPrimitive(prim);
      stubbed.push(prim);
      r.tris += verts.length / 3;
    }
    scene.addChild(doc.createNode(`fill:${r.name}`).setMesh(mesh).setExtras({ fill: r.name }));
  }
  // Erst aufraeumen, solange Ergaenzung und Fuellung ihr Material der
  // vollen Stufe tragen: prune laesst so die Attribute stehen, die es
  // braucht (wie das gleichnamige der dichten Kopie). Dann bekommen beide
  // ein Material nur mit Name und Faktoren; der Viewer gibt ihnen das
  // gleichnamige der dichten Kopie mit deren Texturen, die der vollen Stufe
  // kaemen sonst ungenutzt mit.
  await doc.transform(prune());
  const stubs = new Map();
  for (const p of stubbed) {
    const m = p.getMaterial(), name = m?.getName() ?? '';
    if (!stubs.has(name)) stubs.set(name, doc.createMaterial(name).setAlphaMode(m.getAlphaMode()).setAlphaCutoff(m.getAlphaCutoff()).setDoubleSided(m.getDoubleSided()).setBaseColorFactor(m.getBaseColorFactor()).setMetallicFactor(m.getMetallicFactor()).setRoughnessFactor(m.getRoughnessFactor()));
    p.setMaterial(stubs.get(name));
  }
  // Wie der Build: Lage 16 Bit (Halle), Normalen 10, UV so fein wie noetig
  await doc.transform(prune({ propertyTypes: [PropertyType.MATERIAL, PropertyType.TEXTURE] }), draco({ method: 'edgebreaker', quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: Math.max(texcoordBits(root, 'TEXCOORD_0'), texcoordBits(root, 'TEXCOORD_1')) }));
  const fill = { rule: FILL_RULE, file: liteBytes ? liteName : null, sha1: liteHash, regions: regions.map((r) => ({ name: r.name, material: r.material, tris: r.tris, skipped: r.skipped, partial: r.partial, ...(r.lost ? { lost: r.lost, why: r.why } : {}) })) };
  root.setExtras({ ...(root.getExtras() ?? {}), furnitureOf: { file: srcName, sha1: hash, nodes, tris, detail: { rule: DETAIL.source, tris: detailTris, materials: detail }, fill } });
  const glb = await io.writeBinary(doc);
  writeFileSync(out, glb);
  const filled = fill.regions.map((r) => `${r.name} ${r.tris}, ${r.skipped} deckungsgleich ausgelassen, ${r.partial} teilweise aufliegend${r.lost ? `, ${r.lost} nicht mitgenommen (${r.why})` : ''}`).join('; ');
  console.log(`Einrichtung ${key}: ${nodes} Moebel, ${tris} Dreiecke, Ergaenzung ${detailTris} Dreiecke in ${Object.keys(detail).length} Materialien, Fuellung ${liteBytes ? filled || 'keine' : `keine (${liteName} fehlt)`}, ${(glb.byteLength / 1e6).toFixed(1)} MB -> public/hangar/hall/${key}.furniture.glb (aus ${srcName}, sha1 ${hash.slice(0, 8)})`);
}
